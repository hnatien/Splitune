---
title: ML pipeline service (Python on Modal)
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# ML pipeline service (`services/ml`)

The Python side of the analysis job: stage implementations, provider interfaces, container "islands" on Modal, weights management, fallbacks and the callback protocol. Orchestration (step order, retries, waits) lives in the TypeScript Inngest workflow (`01-system-architecture.md` §3); this service only executes stages.

> **Personal mode is current (`25-personal-mode.md`).** The service runs as a **native Python worker on the owner's Mac** (PyTorch MPS, ONNX Runtime CoreML EP), pulling stages from the Postgres `jobs` table and writing `stage_runs`/`job_events`/`artefacts` with a restricted `ml_worker` DB role. Modal deployment (§5), vendor adapters and HMAC callbacks are the dormant hosted path. §0 lists the personal-mode stage choices.

## TL;DR
- **Python 3.12 (CI also 3.13), uv 0.13 workspace, ruff, pyright, pytest 9; torch 2.14.1 + CUDA 13.0; FFmpeg 8.1 CLI pinned in images; soundfile/TorchCodec for I/O** (torchaudio 2.11 only for transforms — its I/O was removed in 2.9).
- **Three Modal image islands** to contain dependency conflicts: `torch` (beat_this, transkun, RMVPE, drum CRNN, future RoFormer), `onnx-cpu` (Basic Pitch via bundled `nmp.onnx`, taggers, SwiftF0, decode/encode, stem post-processing), `legacy` (allin1 with NATTEN/madmom-from-git; faster-whisper instead of WhisperX's torch 2.8 pin).
- **Every stage is a pure, idempotent function** `run(inputs: presigned GETs, outputs: presigned PUTs, params) → StageResult`, validated against the generated Pydantic contracts; reports via HMAC callback. No DB access.
- **Provider interfaces** (`Separator`, `NoteTranscriber`, `ChordRecognizer`, `BeatTracker`, `SectionAnalyzer`, `Tagger`) bound by config to register ids (`09-licence-register-and-release-gates.md`), so vendor ↔ in-house swaps are configuration.
- **Separation v1 = AudioShake behind the adapter (webhooks, guitar/piano stems, says models are trained on licensed data), A/B vs Music.AI (polling)** — final choice by Prototype 1; LALAL.AI kept as a third adapter. Fallback: Spleeter (green, "rough").

## 0. Personal-mode stage choices (licences ignored, quality first)
| Stage | Personal mode | Replaces |
|---|---|---|
| `url_import` (new, first stage for URLs) | `yt-dlp` (pinned) + Deno + `yt-dlp-ejs`; best audio → `raw/`, optional video ≤720p → `video.mp4`; 300 s timeout; errors `url_unsupported`/`url_download_failed` | — |
| `separate` | `python-audio-separator` 0.44.x on MPS: `htdemucs_6s` (guitar, piano), `htdemucs_ft` / BS-RoFormer / Mel-RoFormer / SCNet checkpoints for vocals, drums, bass, other; per-instrument model map chosen by P1 in `config/separation.personal.yaml` | Vendor API step |
| `stem_post` | unchanged (alignment, mix-minus or complementary stem, gating, AAC/Opus encode) | — |
| `chords` / key | best of consonance-ACE, BTC, madmom CNN+CRF (P6); madmom key | consonance-ACE only |
| `notes.guitar`/`bass` | Basic Pitch (ONNX) or YourMT3+ (P2 decides) | Basic Pitch only |
| `notes.piano` | Transkun V2 or Aria-AMT | Transkun after sign-off |
| `notes.drums` | **ADTOF** pretrained (5 classes) | In-house CRNN training project |
| `lyrics` | Whisper (faster-whisper CPU or an MLX port) — enabled | Rights-gated |
| `sections` | allin1 in its own env | Sign-off-gated |
| Fallback when separation fails | Next model in the map → analysis without stems | Secondary vendor → Spleeter |
Environments ("islands") are separate uv projects/venvs on the worker host instead of Modal images: `torch` (torch 2.14.1 MPS/CUDA: beat_this, transkun, audio-separator, ADTOF, RMVPE), `onnx-cpu` (Basic Pitch, taggers, SwiftF0, ffmpeg tooling), `legacy` (allin1 + madmom from git). The worker dispatches each job kind to a long-lived subprocess per island so models stay loaded (the equivalent of Modal's `@modal.enter`). Concurrency: 1 GPU job at a time (MPS on Mac, CUDA on Windows PC/WSL2), ≤2 CPU jobs.

## 1. Repository layout
```
services/ml/
  pyproject.toml                # uv workspace root
  packages/
    splitune_ml_core/           # contracts (_generated.py), StageResult, callback client, presigned I/O, logging, metrics
    stage_decode/               # ffmpeg decode, ffprobe, audio_hash, loudness
    stage_beats/                # beat_this
    stage_tagger/               # EfficientAT/PANNs ONNX
    stage_separation/           # vendor adapters + post-processing + spleeter fallback
    stage_chords/               # consonance-ACE / BTC + fusion
    stage_notes/                # basic-pitch (ONNX), transkun, rmvpe, swiftf0, drums crnn
    stage_sections/             # allin1 (legacy island)
    stage_lyrics/               # faster-whisper (later; rights-gated)
  modal_app/
    app.py                      # Modal functions per island, web endpoint for spawning
    images.py                   # image definitions per island
  config/
    pipeline.{research,staging,production}.yaml
    views.yaml                  # recommended_view thresholds
    calibration/{model_id}@{version}.json
  eval/                         # harness (08-evaluation-harness-and-prototypes.md)
  train/                        # later: drums CRNN, separation on licensed data
  tests/
```

## 2. Stage catalogue
| Stage | Island / hardware | Input | Output artefact | Model (register id) | Timeout | Fallback |
|---|---|---|---|---|---|---|
| `decode` | onnx-cpu, CPU 2 vCPU | raw upload | `decoded.flac` (44.1 kHz stereo), `probe.json`, `audio_hash`, `loudness` | ffmpeg 8.1 | 120 s | reject with `unsupported_media` |
| `beats` | torch, L4 (or CPU fallback) | decoded | `beats.json` | `beat-this` final0 (small0 on CPU fallback) | 60 s | CPU small model; else `failed` (blocks loops → retry) |
| `tag` | onnx-cpu | decoded | presence (clip-level) | `efficientat` / `panns` | 60 s | assume requested instrument present |
| `separate` | API step (vendor) + onnx-cpu post | decoded (presigned GET to vendor) | vendor stems → `stem_post` | `audioshake` / `musicai` / `lalal` | 600 s | other vendor → `spleeter` (rough) → no stems |
| `stem_post` | onnx-cpu, CPU 4 vCPU | vendor stems + decoded | aligned stems, mix-minus, AAC (+Opus) files, `stems.json`, `presence.json` (with energy gating) | ffmpeg, numpy | 180 s | — |
| `chords` | torch, L4 | decoded, no-drums stem, bass stem | `chords.json` (+ key via music-core later) | `consonance-ace` | 120 s | mixture-only input |
| `notes.guitar` / `notes.bass` / `notes.vocals` | onnx-cpu (Basic Pitch ONNX) | instrument stem (or mixture if solo) | `notes/{instrument}.json` | `basic-pitch` | 180 s | `chords_only` view |
| `notes.piano` (v1) | torch, L4 | piano stem or mixture | `notes/piano.json` | `transkun` | 300 s | roll from Basic Pitch; else chords |
| `notes.drums` (v1) | torch, L4 | drum stem | `notes/drums.json` | `inhouse-drums-crnn` | 120 s | none (drum grid hidden) |
| `f0.vocals` (later) | torch, L4 | vocal stem | f0 in `notes/vocals.json` | `rmvpe` | 120 s | SwiftF0 |
| `sections` (v1) | legacy, L4 | decoded + stems | `sections.json` | `allin1` | 300 s | music-core novelty segmentation |
| `finalize` | **TypeScript** in the API (music-core) | all JSON | `tab/*.json`, `render/*.alphatex`, `summary.json` | `music-core` | 60 s | — |

**Profiles** (`23-plans-free-and-paid.md`): `full` runs every row above for the requested instrument; `lite` runs only `decode`, `beats`, `chords` (mixture input), `sections` (v1) and `finalize` — no vendor call, so it costs ≈ $0.005–0.02. Upgrading Lite → Full reuses the per-user stage cache. If G0 enables Standard stems for Lite, `lite` also runs a self-hosted Spleeter `separate` (labelled `quality_hint: rough`).

GPU stages run on L4 by default (Modal $0.000222/s); A10 if VRAM requires. CPU stages run on Modal CPU containers.

## 3. Stage contract
```python
class StageRequest(BaseModel):          # generated from packages/contracts
    analysis_id: UUID; user_id: str; stage: str; cache_key: str
    inputs: dict[str, HttpUrl]          # presigned GETs (≤1 h)
    outputs: dict[str, HttpUrl]         # presigned PUTs (≤1 h), fixed keys → idempotent
    params: dict[str, Any]
    callback_url: HttpUrl; callback_nonce: str

class StageResult(BaseModel):
    status: Literal["done", "failed", "fallback"]
    artefacts: list[ArtefactWritten]    # kind, version, key, sha256, bytes
    model_refs: list[ModelRef]
    metrics: StageMetrics               # gpu_s, cpu_s, peak_vram_mb, cold_start_s, audio_s
    error_code: str | None = None       # machine code only; stack traces go to Sentry
```
- Implementations are plain functions (`def run(req, ctx) -> StageResult`) tested without Modal; `modal_app/app.py` wraps each in a Modal function with `@modal.enter` to load weights once per container.
- The callback is `POST callback_url` with headers `X-Splitune-Timestamp`, `X-Splitune-Signature: HMAC_SHA256(secret, ts + "." + body)`; retried with backoff until 2xx (the API dedupes by `(analysis_id, stage, nonce)`).
- **No user content in logs.** Log `analysis_id`, stage, timings, error codes. Sentry `before_send` strips URLs (presigned URLs are credentials).

## 4. Key stage details
### decode
`ffmpeg -nostdin -hide_banner -i in -map a:0 -ac 2 -ar 44100 -f f32le` → hash (SHA-256 of the raw f32le stream) → write FLAC for downstream (smaller than WAV over the network) → `ffprobe -show_streams -of json` stored as `probe.json`. Hard limits: duration ≤20 min, decode wall-time ≤120 s, output size cap; run in a sandboxed container (`17-security.md`). Measure integrated loudness (pyloudnorm 0.2.0) for `mix_gain_db` (target −14 LUFS).

### separate (vendor adapters)
```python
class Separator(Protocol):
    def submit(self, audio_url: str, targets: list[StemTarget], callback_url: str | None) -> VendorJob: ...
    def poll(self, job: VendorJob) -> VendorStatus: ...
    def fetch(self, job: VendorJob) -> dict[StemTarget, bytes]: ...
    def delete(self, job: VendorJob) -> None: ...      # called right after we store stems
```
- **Request one target:** the learner's instrument (D2). Mix-minus is derived in `stem_post`.
- AudioShake: webhook per completed target; 1 credit per minute per target, rounded up per minute; uploaded assets expire after 72 h, output links after 1 h (download immediately). Music.AI: polling, $0.07/min per stem ($0.10 guitar), `DELETE /job/:id` after fetch. LALAL.AI: polling `/check/`, `/delete/` after fetch.
- The vendor call itself runs in the Inngest step (TS) because it is I/O-bound; the Python `Separator` adapters are used by the evaluation harness and by a Python fallback path. Both share the same target mapping table (`config/vendor_targets.yaml`).

### stem_post
1. Decode vendor stems to 44.1 kHz float.
2. **Align:** cross-correlate each stem with the mixture over the first 30 s of non-silent audio; shift by the lag (`alignment_offset_samples`).
3. **Mix-minus:** `mixture − stem` (after alignment, same gain).
4. **Energy gating:** frame RMS ratio stem/mixture → `activity[]`; combine with tagger prob → `present_prob`, `bleed_suspected`, `empty`.
5. **Quality hint:** `rough` if energy disagreement with the tagger exceeds a threshold or the vendor is the Spleeter fallback (calibrate against P1 ratings).
6. **Encode:** AAC-LC 160 kb/s in MP4 (always) + Opus 96 kb/s in WebM (optional variant). Verify decoded length and offset of each encode against the PCM; re-encode with explicit priming compensation if off by more than 1 sample.
7. Write `stems.json` and `presence.json`.

### beats
`beat_this` 1.1.0 (MIT code and weights), no madmom DBN post-processing (madmom is red). BPM = median IBI; `tempo_octave_ambiguous` when the activation at half/double tempo is within a margin. For the CPU fallback use the 8.1 MB small model.

### notes (Basic Pitch)
- Install `basic-pitch` 0.4.0 **without TensorFlow** (uv `override-dependencies` / `--no-deps`; it pins `tensorflow<2.15.1`, unsatisfiable on Python 3.12) and run the bundled `nmp.onnx` with ONNX Runtime 1.31. Vendor the post-processing (note creation from posteriors) if import paths require TF.
- Bass: pass `minimum_frequency≈30 Hz`; export `low_band_energy` per note for octave correction in music-core (`07-music-algorithms.md` §3).
- Confidence: mean onset posterior over the note's first 3 frames → calibrated via `config/calibration/basic-pitch@0.4.0.json` (isotonic, fitted on P2 data).

### chords
consonance-ACE (MIT code, checkpoint in repo, tested on Python 3.11 — verify on 3.12; amber due to Isophonics/Billboard training audio). Run on mixture and no-drums stem; fuse per beat by averaging log-probs, then bass-root prior from the bass stem's lowest sustained pitch class. Emit majmin and sevenths vocabularies with top-k.

### sections (v1)
allin1 1.1.0 is fragile (NATTEN API churn, madmom PyPI build failure on 3.12). Isolate in the legacy image with madmom installed from git, or replace with a music-core novelty segmentation if sign-off or maintenance fails.

## 5. Modal deployment (dormant hosted path)
- **Images:** built from `modal_app/images.py` with pinned versions and `uv sync --frozen`; FFmpeg 8.1 static binary; weights baked into the image for small models (<100 MB) or in a Modal Volume (`splitune-weights-{env}`) keyed by `register_id/sha256` and verified at `@modal.enter`.
- **Warm capacity:** `min_containers=1` for `beats` and `decode` during expected peak hours (to protect the ≤10 s beat-grid target), `buffer_containers` for bursts, `scaledown_window` 120–300 s; others scale to zero. CPU memory snapshots for CPU islands (3–10× faster start); GPU snapshots are alpha — evaluate in P4, don't depend on them.
- **Preemption:** base GPU pricing is preemptible (non-preemptible costs 3×); idempotent stages + Inngest retries make this safe.
- **Spawn interface:** a Modal web endpoint `POST /spawn` (proxy-auth token) that calls `fn.spawn(request)` and returns the call id; the API never waits on the HTTP response for completion.
- **Environments:** Modal `staging` and `prod` environments with separate secrets (`SPLITUNE_CALLBACK_SECRET`, vendor keys if Python adapters are used).

## 6. Fallback matrix (written into `summary.reasons`; personal mode replaces vendor rows with the model-map fallback in §0)
| Failure | Behaviour | Reason code |
|---|---|---|
| Vendor timeout/error | Retry once → secondary vendor → Spleeter rough stems | `separation_fallback_vendor`, `separation_rough` |
| All separation fails | Analysis without stems; notes on mixture only if instrument is solo, else chords-only | `stems_unavailable` |
| Notes stage fails | `chords_only` | `notes_unavailable` |
| Chords fail | Tab without chord strip; key hidden | `chords_unavailable` |
| Beats fail | Retry on CPU small model; if still failing, loops fall back to time-based (no bar snap) | `beats_unavailable` |

## 7. Observability and cost
- Per stage: duration, GPU seconds, cold start, peak VRAM, audio seconds → `stage_runs` (via callback) and Axiom traces (OTel, `analysis_id` as trace attribute).
- Vendor cost = billed minutes × contract price; ledger feeds `analyses.cost_usd_estimate`.
- Model drift monitor: weekly correction rate and fallback rate per `model_id@version` (`16-observability-analytics-experiments.md`).

## 8. Testing
- Unit tests per stage with tiny fixture audio (owned, seconds long); contract tests validating outputs against generated Pydantic models and golden JSON.
- Integration test: run the full stage chain locally on CPU with mocks for the vendor (`tests/fixtures/vendor/`), producing the example song's artefacts byte-for-byte reproducibly (seeded).
- GPU regression (nightly, small subset) via the harness (`08-…` §4).

## Implementation notes (step 06, 2026-10-20)
Code: `services/ml/packages/splitune_ml_core` (worker), `stage_decode`, `stage_beats`, `services/ml/islands/{torch,onnx-cpu}`, `services/ml/eval`, `services/ml/deploy`, `services/ml/scripts/{run_chain,bench_stages}.py`.
- **Worker** (`uv run splitune-ml-worker`): settings via pydantic-settings from the environment, then `.env` + `.env.worker` of the nearest directory with a `.env` (empty values = unset). Postgres via psycopg 3.3 pool as `ml_worker` (`ML_DATABASE_URL`, falling back to `DATABASE_PUBLIC_URL`). The queue module issues the statements of `packages/db/README.md` verbatim (kinds filter as `= any(array)`). Slots: `ML_MPS_SLOTS=1` slot claiming torch-island kinds, `ML_CPU_SLOTS=2` slots claiming CPU kinds; `locked_by = <worker_id>:<slot>`. `LISTEN jobs_python` on a dedicated connection with reconnect + 5 s poll fallback; a slot that finishes a job also wakes the others (dependents become runnable without any NOTIFY). Job heartbeat 15 s, `worker_heartbeats` upsert + `requeue_stale` (120 s) every 30 s. SIGTERM: stop claiming, finish running jobs; second signal exits.
- **Executor:** validates the payload as `StageRequest` (+ `jobs.kind`/`analysis_id` match, `user_id` = the analysis owner, inputs under `u/{user}/`, outputs under `u/{user}/a/{analysis}/`, packages/storage key rules) → `stage_runs` running + `stage.started` → inputs → `describe` → cache key → cache lookup → `run` → contract validation → upload (temp key → copy → delete temp) → one transaction: artefact upserts on `(analysis_id, kind, version)`, `stage_runs` done/fallback (model_refs, cache_key, gpu_seconds), songs update (decode), `stage.completed` with the artefact id, and the job's `complete` statement last; 0 rows → rollback, result discarded. Failures: `fail` + `stage_runs` (`pending` while retrying, `failed`) + `stage.failed` (permanent only) in one transaction. Unexpected exceptions → `internal_error` (retry); messages and URLs never reach logs or the DB.
- **Islands** are separate uv projects (`islands/<name>/pyproject.toml`, own lock and `.venv`, workspace packages as editable path sources; the workspace `exclude`s them). The worker spawns `python -m splitune_ml_core.island` per (slot, island) lazily and keeps it warm; JSON-lines RPC `ping|describe|run` on a private dup of stdout (fd 1 → stderr, so library prints can't corrupt it). Island env is an allow-list (no DB URL or bucket keys). Timeout → SIGKILL + `stage_timeout` (retry), EOF → `island_crashed` (retry), missing venv → `island_missing` (permanent). `ML_ISLAND_PYTHON` runs all islands with one interpreter (tests). The `legacy` island is not created yet. The RPC models (`StageJob`/`StageOutput`/`StageDescription`) are Python on both ends, so they live in `splitune_ml_core.stage_api`, not in `packages/contracts`.
- **decode** (onnx-cpu island): ffprobe JSON (protocol whitelist `file`), first audio stream, `-t max+1` cap, `pcm_f32le` → sha256 = `audio_hash`, pyloudnorm on the PCM, 24-bit FLAC to the local cache (atomic rename), `probe.json`. Errors: `unsupported_media`, `too_long` (> `max_duration_s`, default and maximum 1200 s), `audio_empty`, `decode_failed`, `decode_timeout` (120 s per ffmpeg call), `input_too_large` (> 500 MB), `input_missing`. FFmpeg 8.1.3 from Homebrew `ffmpeg@8` (keg-only; `FFMPEG_BIN_DIR`).
- **beats** (torch island): beat_this 1.1.0 `Audio2Frames` + minimal postprocessor (no DBN), checkpoints in the torch hub cache, `weights_sha256` hashed from the file. `ML_TORCH_DEVICE=auto` → final0 on MPS; without MPS → small0 on CPU, status `fallback`, `fallback_reason` `beats_cpu_small`; an MPS runtime error retries on CPU small0 (`beats_mps_failed`); explicit `cpu` keeps the requested model. `params.model` is the requested model, `models[]` the one that ran (so the cache key follows it). Bars via a port of music-core `labelBeats`; meter numerator = modal downbeat spacing, denominator 4; BPM = 60/median IBI; `tempo_octave_ambiguous` = mid-beat activation ≥ 0.5 × on-beat activation, or BPM outside [75, 150); `bpm_curve` only when bar tempi spread > 4% (p10–p90). Beat times are on beat_this's 20 ms frame grid (no sub-frame refinement). Fewer than 2 beats → `beats_not_found` (permanent).
- **Mock mode** (`ML_MODE=mock`, the `.env.example` default): same worker and bookkeeping; the `FixtureBackend` returns `packages/contracts/fixtures/<kind>.json` (notes/tab fall back to the guitar fixture) re-issued for the analysis; no downloads; decode facts come from `probe.json`.
- **Not done here:** `manifest.json` updates and analysis status/progress (step 09 orchestration), `job_events` NOTIFY for SSE, local cache eviction, orphaned `.tmp/` objects after a crash between upload and copy (sweeper).
- **Measured on the owner's Mac (M4, 16 GB), 4-min AAC song, island processes:** decode 1.32 s cold / 0.76 s warm; beats final0 MPS 2.93 / 1.45 s; final0 CPU 3.30 / 2.61 s; small0 CPU 2.33 / 1.83 s. Cold = fresh process (imports + model load). The CPU path already meets the ≤10–15 s beat-grid target.

## Implementation notes (step 07, 2026-10-21)
Code: `services/ml/packages/stage_tagger` (`tag`), `services/ml/packages/stage_separation` (`separate`, `stem_post`), `services/ml/config/separation.personal.yaml` (model map), `compliance/register/models/*.yaml` (weights hashes), `services/ml/browser/decode-check.spec.ts` (browser check), `apps/listening` + `services/ml/eval/p1*.py` (Prototype 1).
- **Graph:** `decode → tag → separate → stem_post` (`separate` reads `tags.json`; step 09 adds `beats` in parallel and the notes/chords dependants). New artefacts `tags.json` and `separation.json` (contracts 1.3.0, `05` notes). Stage jobs: `separate` params `{instrument}`; inputs `tags` (+ `source`, `probe`); `stem_post` inputs `separation`, `tags`. Outputs as `devtools.stage_request` builds them.
- **`tag`** (onnx-cpu): PANNs Cnn14 (AudioSet, mAP 0.431) exported to ONNX by `scripts/export_tagger.py` (log-mel front end inside the graph, parity 4e-7 vs PyTorch), ONNX Runtime CPU, 2 threads. 10 s windows at 32 kHz; an instrument's probability = max over its AudioSet classes per window, then the mean of the most confident quarter of windows; subtype from the acoustic/electric guitar and piano/synth/organ classes. **The scores are raw and low on full mixes** (MUSDB18-HQ test, 50 windows: bass ≤ 0.14, drums ≤ 0.34; instrumentals score vocals ≤ 0.02), so they rank well but are not probabilities: they are used only as a veto (`keep_min_prob` 0.01 for extras, `tag_absent_below` 0.01 for bleed). Missing/tampered weights → status `fallback`, `fallback_reason: tagger_unavailable`, empty list (readers assume present). EfficientAT was not used: no packaged model code.
- **`separate`** (torch, MPS slot): python-audio-separator **0.44.5** (pinned; it needs **librosa 0.11** — 0.44.5 calls `get_duration(filename=)`, removed in librosa 1.0 — and `audioread`). Driven with float WAV in/out and `normalization_threshold=1.0` (its default 0.9 peak normalisation would break mixture − stem); its public `separate()` swallows exceptions, so `_separate_file` is called. One model stays loaded per island. The chain comes from the model map; each model's weights are verified against its register record (sha256 per file, cached per size+mtime) before loading; any failure (`weights_missing`, `weights_mismatch`, `separation_oom`, `separation_failed`, `separation_output_invalid`) moves to the next model; a later model → status `fallback` + `separation_fallback_model`; none → **`stems_unavailable`, permanent** (dependants are cancelled by the queue; step 09 decides which dependants still run on the mixture). Raw stems → 24-bit FLAC in `<ML_CACHE_DIR>/separated/<run id>/<stem>.flac` (run id = hash of audio, model, weights, inference settings, kept outputs). `StageSpec.reuse_fallback=False`: a cached fallback is recomputed. A cache hit whose raw files are gone is recomputed (`local_files_present`). Kept outputs: target; complement parts when mix-minus is `complement`; `keep` extras (drums, bass) when the same run produced them and the tagger doesn't veto them. SCNet XL and the MSST 53-stem model are **not available** in audio-separator (any version), so they were not candidates.
- **Inference settings (step 07b, 2026-10-21):** each model in the map has `arch` (`mdxc` | `demucs`) and optional `inference`, which overrides single keys of audio-separator's `mdxc_params` / `demucs_params` (unknown keys rejected; the rest keep library defaults). The chain's settings are part of `separate`'s effective params (cache key) and of the raw-stem run id; a warm model reloads when its settings change. Measured: for RoFormers, MDXC `overlap` is the **window step in seconds** capped at the chunk (not a divisor), so the default 8 is already near-cheapest and smaller values cost more. Chosen on P1 (`services/ml/eval/results/p1/2026-10-21-overlap.md`, cheapest within 0.3 dB median uSDR): Demucs `shifts: 1` (≈0.55× time), Kim `overlap: 11` and SW `overlap: 9.3` (step = chunk), viperx default. Full 244.5 s song, warm: 6s 33 s, ft 97 s, SW 181 s, viperx 269–313 s, Kim 136 s — all within 600 s per model and 1500 s per stage; the 3-min full-analysis target is **not** met when SW heads the chain (separation alone ≈ 180 s). Step 07's 575 s for viperx did not reproduce (run-to-run variance on the Mac is about ±15%).
- **`stem_post`** (onnx-cpu): alignment by FFT cross-correlation over the first 30 s of non-silent audio (±2048 samples; one lag per run, from the target, reported as `alignment_offset_samples`); mix-minus per the map (`subtract` = mixture − aligned target, `complement` = sum of the model's other outputs); activity = 1 s frames / 0.5 s hop where the stem is ≥ −20 dB relative to the mixture and ≥ −50 dBFS, runs merged across 1 s gaps, ≥ 1 s; `empty` = active fraction < 2% or energy ratio < 0.001; `present_prob` = active fraction / 0.25 (≤ 0.1 if empty, ≤ 0.5 if bleed); `bleed_suspected` = not empty and tagger < 0.01; `quality_hint` rough if the map says so, or empty, bleed, or the tagger (≥ 0.3) expected it but the stem is empty. Loudness: `mix_gain_db` = −14 − mixture LUFS (one shared gain); `gain_to_unity_db` = −14 − stem LUFS (clamped ±20 dB, 0 for empty) and **replaces** `mix_gain_db` while soloing; silent stems report −70 LUFS. Tagger-only instruments appear in presence.json with `activity: []`. Cache key: the raw stems' sha256s + the tagger verdicts (describe now receives the downloaded inputs: `describe(params, inputs)`).
- **Encodes and verification (measured, `browser/decode-check.spec.ts`):** AAC-LC 160 kb/s is encoded with **AudioToolbox (`afconvert -f m4af -d aac -s 0`)** on the Mac: its `iTunSMPB` gapless record makes `decodeAudioData` return the exact PCM length at offset 0 in **both Chromium and WebKit** (all lengths tested). ffmpeg's native AAC (the fallback where `afconvert` is missing, e.g. Linux CI) with `-movie_timescale 44100` writes a sample-exact edit list that Chromium honours but WebKit ignores at the end (keeps ≤1023 padding samples; start is exact). Opus 96 kb/s WebM: WebKit exact (±1, 48→44.1 kHz rounding), **Chromium 22 samples early** → the Opus variant is **off by default** (`params.opus`), and a failed Opus check only drops the variant. Server-side verification decodes with ffmpeg (which trims priming but not AAC end padding): declared length (iTunSMPB or edit list) = PCM frames, start lag 0, tail < 2048 padding samples; Opus within ±1 sample and lag 0. Failure → `encode_verification_failed`.
- **Binary blobs:** `StageOutput.blobs` (relative key → local file) are uploaded (temp key → copy) before the JSON that references them, and must match `stems.json`'s file paths exactly; on a cache hit for another analysis they are copied next to its own stems.json. Paths stay relative (`stems/<id>.m4a`), resolved against stems.json's directory. Mock mode encodes a quiet tone for each referenced file (needs ffmpeg).
- **Settings:** `ML_MODELS_DIR` (default `~/.cache/splitune/models`; `audio-separator/` and `panns/`), `ML_SEPARATION_CONFIG` (default the repo map); both passed to islands.
- Not done here: notes/chords consumers of stems (08), `manifest.json`/analysis status (09), local cache eviction (separated/ grows with every new model run), re-creating raw stems when `stem_post` finds them gone (it fails `separated_audio_missing`; re-running `separate` fixes it), CoreML EP (no ONNX MDX model in the map).

## Implementation notes (step 08, 2026-10-21)
Code: `services/ml/packages/stage_notes` (`notes.guitar|bass|vocals`), `services/ml/packages/stage_chords` (`chords`), `apps/node-worker` (`finalize`), `services/ml/config/{notes,chords}.personal.yaml`, `services/ml/config/views.yaml`, `services/ml/config/calibration/`, `services/ml/scripts/fetch_models.py`, `services/ml/eval/{p2,p6}.py` + `splitune_eval/{local,calibration}.py`.
- **Graph:** `notes.<instrument>` after `stem_post` (inputs `separation`, `stems`; both optional → without them the mixture is transcribed, status `fallback` / `notes_on_mixture`); `chords` after `beats` and `stem_post` (inputs `beats` required, `separation`, `stems` optional); `finalize` (runner `node`) after all of them. `StageSpec.optional_downloads` = inputs fetched only when the request names them; `devtools.stage_request` builds the shapes. The queue still cancels dependants of a permanently failed job, so a failed `notes.*` cancels `finalize`; step 09 decides how partial results reach finalize (the worker already treats missing optional inputs as unavailable).
- **`notes.*` (onnx-cpu island, CPU slot):** Basic Pitch 0.4.0's ICASSP-2022 model run from its bundled `nmp.onnx` on ONNX Runtime (2 threads). The package is **not installed** (TensorFlow on 3.12, `resampy<0.4.3`): `stage_notes.basic_pitch` ports its windowing, unwrapping and note decoding (`output_to_notes_polyphonic` incl. the melodia trick) to numpy/scipy; a parity test reproduces the original package's posteriors and all 11 note events on a synthetic phrase. 44.1 → 22.05 kHz by `resample_poly` (the package used librosa/soxr). Source = the raw separated stem of the instrument (target or kept extra) shifted by `stems.json`'s `alignment_offset_samples`. Confidence = mean onset posterior over the note's first 3 frames at its pitch, calibrated by `config/calibration/<record>@<version>[.<instrument>].json` (`splitune_ml_core.calibration`, same interpolation as music-core); the table's name, content hash and bands go into the params (cache key) and finalize reads the bands from there. Bass: `min_freq_hz` 30 / `max_freq_hz` 600 and per-note `low_band_energy` (`stage_notes.lowband`). Bends are not emitted (`bend_cents` absent). Decoding thresholds per instrument from the P2 sweep (`notes.personal.yaml`): guitar onset 0.6 / frame 0.5 / min note 58 ms, bass onset 0.7 / frame 0.5 / 127.7 ms.
- **`NoteTranscriber`** (`stage_notes.transcribers`) with `basic_pitch` and `yourmt3`, chosen per instrument in `notes.personal.yaml`; the choice also places the stage (`stages.notes_placement`: basic_pitch → onnx-cpu/CPU, yourmt3 → torch/MPS). **YourMT3+** (YPTF.MoE+Multi, PS; HF space @ `5e66c1e`, GPL) runs from `ML_MODELS_DIR/yourmt3/{src,model.ckpt}` (`scripts/fetch_models.py yourmt3`), `stage-notes[yourmt3]` in the torch island and the root workspace; wandb is stubbed (training-only import). It reports no per-note score: `confidence_raw` 1.0, so its calibration table maps that to the measured precision. On the M4 (MPS, warm) it takes ≈ 8 s per 20–30 s excerpt with a ≈ 14 GB peak memory footprint (unified memory), so it can't run beside a RoFormer separation on 16 GB.
- **`chords` (torch island, MPS slot):** `ChordRecognizer` (`stage_chords.recognizers`) with **consonance-ACE** (conformer_decomposed_smooth; model code ported, no lightning/gin; vocabulary scores = log p(root) + Σ chord-tone log-likelihoods of its 12 sigmoid outputs), **BTC** (large vocabulary, 170 classes mapped onto the target vocabulary) and **madmom CNN+CRF** (majmin; CRF posterior marginals by forward-backward instead of its Viterbi path, so inputs can be fused). Shared vocabularies `majmin` (25) and `sevenths` (61). Per beat (beats.json intervals plus the stretches before the first / after the last beat) the frame log-probabilities are averaged; the `mixture` and `no_drums` (mixture − aligned drums stem) inputs are averaged in the log domain; a **bass-root prior** from the bass stem's E1–E4 chroma (`bass_root_weight`, silent beats neutral) is added; a Viterbi with a constant chord-change penalty (`change_penalty` 3.0) picks one label per beat. **Key:** madmom's CNN key model on the mixture or music-core's estimator over the segments (`node packages/music-core/src/cli.ts key`, `NODE_BIN`). All of it from `chords.personal.yaml`, overridable per request (`params`); unsupported combinations (madmom + sevenths) → `invalid_params`.
- **Prototype outcomes (defaults in config):** P2 → **Basic Pitch** for guitar and bass (stems: guitar 0.797, bass 0.807 onset F1; both pass the gate; vocals keep Basic Pitch unevaluated, no reference set). YourMT3+ stays a selectable candidate only: worse on GuitarSet stems (0.655; it over-generates on some isolated strummed comping) and its BabySlakh scores are in-sample (Slakh training tracks), at 14 GB. P6 → **BTC, sevenths, no-drums input, music-core key** (`chords.personal.yaml`): madmom's majmin is 0.017 higher (within noise) but has no sevenths; fusing mixture + no-drums lost to no-drums alone for every model; the bass-root prior was not evaluated (P6 material has no bass). Calibration: isotonic tables per transcriber and instrument in `config/calibration/` (Basic Pitch guitar held-out ECE 0.091 → 0.038, bass 0.163 → 0.067). Reports: `services/ml/eval/results/p2|p6/2026-10-21.md`.
- **`finalize` (Node worker, `apps/node-worker`):** claims `finalize` jobs (runner `node`, LISTEN `jobs_node` + 5 s poll, 15 s job heartbeats, `worker_heartbeats` + `requeueStale` every 30 s, SIGTERM finishes the running job), connects as `node_worker` (`NODE_WORKER_DATABASE_URL`, fallback `DATABASE_PUBLIC_URL`). Request = `StageRequest` with inputs `beats` (required), `chords`, `stems`, `notes.<instrument>` (optional; a missing object = unavailable) and outputs `summary` + `tab.<i>`/`render.<i>` for each fretted instrument in `params.instruments`; the same key rules as the Python executor. Writes tab/render/summary, then one transaction (`packages/db` `queue.finishStage`): artefact upserts, `stage_runs`, `stage.completed`, `analyses.status/progress/finished_at`, `analysis.done`, and the job's `complete` last (lock lost → rollback). `beats_missing`, `invalid_request`, `artefact_invalid`, `artefact_incompatible` are permanent; anything else retries as `internal_error`. Run: `pnpm --filter @splitune/node-worker dev`.

## Implementation notes (step 09, 2026-10-21)
- **`url_import`** (`services/ml/packages/stage_url_import`, onnx-cpu island, CPU slot, 300 s): yt-dlp **2026.8.19** + yt-dlp-ejs **0.8.0** (pinned), Deno from Homebrew (passed explicitly with `--js-runtimes`, since launchd's PATH may lack it). One extraction (`--dump-single-json`), then downloads from that info JSON: audio `bestaudio[ext=m4a]/bestaudio/best` ≤ 500 MB, video-only `bv*[height<=720][ext=mp4][vcodec^=avc1]` ≤ 750 MB (it plays muted). Only site extractors (`--use-extractors default,-generic`: the generic one would fetch any URL from the Mac), `--ignore-config`, URL after `--`. Codes: `url_unsupported` (no extractor, live), `url_download_failed` (permanent for private/removed/region-locked/sign-in walls, retried otherwise incl. timeouts), `too_long` (> 20 min), `file_too_large`; a missing video is `fallback` / `video_unavailable`, never a failure. The URL is read from `songs.source_url` at run time; the title/artist (track/title, artist/creator) replace the placeholder on success. Executor: `StageSpec.raw_outputs` (outputs under `u/{user}/raw/`, no artefact rows, no cache), stage.completed without an artefact. Mock mode writes a tone as the download.
- **Fallbacks in events:** `StageSpec.failure_fallback` (tag → `tagger_unavailable`, separate/stem_post → `stems_unavailable`, chords → `chords_unavailable`, notes.* → `notes_unavailable`) is sent as `stage.failed.fallback`; decode, beats and url_import have none (critical).
- `tags` became an optional input of separate and stem_post (both already handled its absence), so tag is a soft dependency.
- The executor sets `analyses.status = running` on the first stage and writes `analyses.progress` + a `progress` event after each stage finishes or fails for good.
- Node worker: `delete_prefix` (payload `{ user_id, prefixes }`, each prefix inside the user's, `deletePrefix` re-checks); finalize `params.profile` (`lite`: only missing chords make it partial); no recorded beats → analysis `failed`, finalize `skipped`, job done; song status set at the end.

## Implementation notes (step 24, 2026-10-25)
- **`separate`: solo check (piano).** `separation.personal.yaml` `instruments.piano.solo_check: {model: htdemucs_6s, threshold_db: -15}` runs htdemucs_6s first (about 3 s per 30 s on the RTX 3060).
  - When its drums + bass + vocals outputs are below −15 dB of the mixture, that run becomes the separation (`solo_bypass.applied`) and the chain (BS-Roformer-SW) is skipped.
  - Otherwise the chain runs as before, and the check's cost adds to the stage's `gpu_s`.
  - P2p: 24/24 solo excerpts caught, 0/57 band excerpts.
  - The check settings (model, threshold, its inference) are in the stage params, so the separation cache key changes for piano analyses.
- **`notes.piano`:**
  - `notes.personal.yaml` instruments take an optional `mixture: {transcriber, params}`, used when there is no stem (`stems_unavailable`, no piano stem). Piano uses YourMT3+ there. The mixture transcriber must run in the same island as the stem one (`notes_placement` checks this). `describe` picks the transcriber by source, so the key follows it.
  - A solo bypass transcribes the mixture with the stem transcriber (Transkun) and reports `done`.
  - Transkun params are now `stereo` (feed both channels), `confidence` (`constant | onset | interval | velocity | onset_velocity`), `gate_db` (drop notes whose onset is more than this far below the input's 95th-percentile 46 ms frame level), `min_velocity`, `min_duration_s` and `min_confidence`. Shipped: `{stereo: true, gate_db: 45, confidence: onset_velocity}`.
  - Scores come from the semi-CRF's forward-backward marginals, computed per 16 s segment on the GPU (`stage_notes.transkun`).
  - `hands: pm2s` adds a hand per note (`stage_notes.pm2s_hands`, vendored MIT model code, weights `pm2s-hand-part` via `scripts/fetch_models.py pm2s`) and its model ref.
  - Sustain-pedal events go to `Notes.sustain`.
  - All of these are stage params, so every `notes.piano` cache key changes.
- **Islands:** unchanged. YourMT3+, Transkun and PM2S all run in the torch island's GPU slot.

## Open questions
- Final vendor (P1) and contract terms (QL5, QM8); AudioShake credit price is not public.
- ~~Whether Beat This! on CPU meets ≤10 s for a 4-min song~~ — yes on the M4 Mac: final0 2.6 s, small0 1.8 s warm (step 06).
- ~~consonance-ACE on Python 3.12 (tested only on 3.11)~~ — runs on 3.12 as a port (step 08); features, network and decoding checked against the upstream code. It scores lowest in P6 on this material.
- Long-term: MSST training of BS-/Mel-RoFormer/SCNet on licensed multitracks (QM11) — separate project once data is licensed.

## Sources
- PyTorch 2.14.1 release matrix, torchaudio maintenance notice, TorchCodec 0.17, FFmpeg 9.0.2/8.1.3, ONNX Runtime 1.31, uv 0.13.3, ruff 0.17.1, pytest 9.1.1 (PyPI/GitHub, accessed 2026-10-20) — see `00-tech-stack.md` for URLs
- [CPJKU/beat_this releases](https://github.com/CPJKU/beat_this/releases); [spotify/basic-pitch saved models](https://github.com/spotify/basic-pitch/tree/main/basic_pitch/saved_models/icassp_2022); [mir-aidj/all-in-one issues](https://github.com/mir-aidj/all-in-one/issues); [consonance-ACE (arXiv 2509.01588)](https://arxiv.org/abs/2509.01588) — tier 1, accessed 2026-10-20
- [AudioShake models](https://developer.audioshake.ai/models.md) and [billing](https://developer.audioshake.ai/billing.md); [Music.AI pricing](https://music.ai/pricing/) and [API reference](https://music.ai/docs/api/reference/); [LALAL.AI OpenAPI](https://www.lalal.ai/api/v1/openapi.json) — tier 2, accessed 2026-10-20
- [Modal pricing](https://modal.com/pricing), [cold start guide](https://modal.com/docs/guide/cold-start), [memory snapshots](https://modal.com/docs/guide/memory-snapshot) — tier 2, accessed 2026-10-20
- Cross-linked research: `research/ml/pipeline-overview.md`, `research/ml/deployment-and-inference.md`, `research/ml/source-separation.md`, `research/ml/transcription-guitar-and-bass-tabs.md`, `research/ml/chords-beats-key-structure.md`, `research/ml/instrument-recognition.md`.
