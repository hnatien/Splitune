---
title: Evaluation harness and Phase 0 prototypes
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# Evaluation harness and Phase 0 prototypes

Executable plans for the seven prototypes defined in `research/ml/pipeline-overview.md` §4, plus the harness they share. Gates are copied from the research docs and must be written down **before** each run. Results go into `services/ml/eval/results/<prototype>/<date>.md` and update the relevant decision (D2–D12) in `research/product/recommendations-and-decisions.md`.

> **Personal mode is current (`25-personal-mode.md`).** Changes to this plan: P1 compares **open models only** (htdemucs_6s, htdemucs_ft, BS-/Mel-RoFormer community checkpoints, SCNet XL, MSST 53-stem if memory allows) and the owner (plus any willing friends) can be the raters; vendor trials and terms requests are dropped. Any dataset may be used for evaluation and fine-tuning (MUSDB18-HQ, MoisesDB, MAESTRO, GuitarSet, MDB Drums, ENST…) along with songs from the owner's own library; the "owned recordings only" rule and the NC eval/training separation no longer apply. P4 measures latency on the owner's Mac (MPS) instead of a Modal L4 — pass target "full analysis ≤3 min, beat grid ≤15 s for a 4-min song". P2 adds YourMT3+ and Aria-AMT as candidates; P6 adds madmom. The ML regression suite runs locally (`pnpm eval:regression`).

## TL;DR
- **Build the harness first (week 0–1):** test-set registry, `mir_eval`/`museval` scoring CLI, a blind A/B listening web page, and result reports. Every prototype reuses it, and it later becomes the ML regression suite in CI.
- **All audio is lawfully obtained:** Splitune-owned multitrack recordings with MIDI capture, purchased files, CC-BY datasets for training-side checks. "YouTube-style" means re-encoding to ~128 kb/s AAC/Opus, never ripped audio (`research/legal/youtube-copyright-and-platform-policy.md`).
- **NC datasets (MUSDB18-HQ, MoisesDB, MAESTRO) are evaluation-only** and live in a separate bucket and pipeline from anything used for training (`research/ml/datasets-metrics-and-licensing.md`).
- **Order:** P1 separation listening test and P3 fret DP in parallel → P2 stems vs mixture, P7 time-stretch, P4 L4 latency/cost, P6 chords → P5 live mic (can slip to week 5–6).

## 1. Harness components (`services/ml/eval/`)

| Component | Implementation | Notes |
|---|---|---|
| Test-set registry | `eval/sets/*.yaml`: id, files (bucket keys), licence, provenance, annotations path, split, tags (genre, live/studio, codec) | No file without a licence field; CI rejects missing provenance |
| Codec simulator | `ffmpeg -c:a aac -b:a 128k` and `libopus 128k` round-trips; loudness normalised with `pyloudnorm` | Produces "YouTube-style" variants of owned audio |
| Scoring CLI | `uv run splitune-eval score --task {notes,chords,beats,sep,melody,tab}` wrapping `mir_eval` (transcription, chord, beat, melody) and `museval`/MSST metrics | Always prints metric variant (cSDR vs uSDR; onset vs onset+offset F1; WCSR vocabulary) |
| Tab metrics | String/fret agreement, TDR, span-violation rate, implemented in `eval/tab_metrics.py` against GuitarSet JAMS | Calls `packages/music-core` via its Node CLI (`pnpm --filter music-core cli fret`) so the evaluated code is the shipped code |
| Listening-test app | Small web page in `apps/listening` (same stack as the web app): blind, randomised order, 1–5 "could I practise with this?", pairwise preference, rater metadata; results to Postgres | Raters log in with a magic link; no audio leaves Splitune storage; signed URLs expire in 1 h |
| Reports | Markdown + CSV per run with git sha, model refs (from the licence register), dataset ids, metric variant, date | Linked from the decision log |
| Provider adapters | Same `separate()` / `transcribe()` interfaces as production (`06-ml-pipeline-service.md`) | Guarantees we test what we ship |

## 2. In-house licensed test set (week 0–2)
- **Recording plan:** 30–40 short songs or excerpts in target genres (pop, rock, acoustic singer-songwriter, live-room takes), recorded by hired session players under a work-for-hire agreement that assigns Splitune all rights, including ML training and evaluation.
- **Ground truth captured at the source:** DI + mic for guitar and bass, MIDI pickup or hexaphonic pickup for guitar where possible, digital piano MIDI out, e-kit MIDI plus acoustic overheads for drums, per-track stems, click-free tempo maps plus human beat/downbeat annotation.
- **Annotations:** chords (Harte syntax, majmin and sevenths), sections, tab verified by the player. Use Label Studio with an audio template; store in JAMS.
- **Mastered variants:** mix and master each song "commercially loud" plus the codec variants above, so separation sees realistic inputs.
- **Example songs (M13)** come from the same sessions: 3–5 fully cleared songs whose precomputed analyses ship with the app (`13-import-onboarding-and-youtube-embed.md`).
- Budget and rights checklist: open question QP3 in `research/open-questions-and-risks.md`.

## 3. Prototype plans

### P1. Separation blind listening test (~1.5 weeks) — decides D2, D11
- **Inputs:** 20 clips × 30 s from the owned set and purchased files, re-encoded to ~128 kb/s; genres as above.
- **Systems:** AudioShake, Music.AI, LALAL.AI (trial accounts set up by a human; see `00-tech-stack.md` vendor section) vs `htdemucs_6s` (self-hosted, R&D only), with BS-Roformer SW as an R&D-only ceiling.
- **Outputs per clip:** guitar stem, piano stem (where present), "mix minus guitar/piano".
- **Raters:** ≥5 learners + 2 teachers, blind; 1–5 "could I practise with this?" and pairwise preference.
- **Pass:** at least one vendor has median ≥4 on ≥70% of guitar clips and ≥60% of piano clips, and beats `htdemucs_6s` in ≥70% of pairs.
- **Fail:** MVP stem menu = vocals, drums, bass + mix-minus; guitar/piano isolation labelled "rough".
- **Also collect:** vendor written terms on per-user retention, training on uploads, deletion SLAs, volume price and per-stem vs per-job billing (QL5, QM8).

### P2. Transcription on stems vs mixture (~2 weeks) — decides M9 scope, D3, D11
- Basic Pitch (guitar, bass, vocals) and Transkun V2 (piano) on (a) mixture, (b) winning vendor's stems.
- Ground truth: owned set, 10 excerpts per instrument.
- Metrics: onset F1 and onset+offset F1 (`mir_eval`, 50 ms / 50 cents).
- **Pass:** stem ≥ mixture, and absolute onset F1 ≥0.70 guitar, ≥0.80 piano-in-band.
- **Fail:** that instrument ships chords + roll/f0 and hides note-exact notation.
- **By-product:** the labelled set used to fit confidence calibration (isotonic regression per model) for `05-analysis-schema.md`.

### P3. Fret-assignment DP on GuitarSet (~1 week) — decides D3 fret strategy
- GuitarSet (CC-BY-4.0) ground-truth notes → `music-core` DP; then Basic Pitch notes from GuitarSet audio → DP.
- **Pass:** ≥0.90 string/fret agreement on ground-truth notes, 100% span compliance, 3 guitarists rate playability ≥ Guitar Pro 8 on 10 excerpts.
- **Fail:** roadmap a learned assigner; default rhythm parts to chord diagrams.

### P4. End-to-end latency and cost on one L4 (~1 week) — decides D6, D10 margins
- Full chain per song-minute on Modal L4: decode, `htdemucs` (separation proxy), Beat This!, `allin1`, Basic Pitch ×3, Transkun, RMVPE, finalize.
- Measure GPU-seconds per stage, peak VRAM, cold start with and without memory snapshots, time to first result.
- **Pass:** ≤6 GPU-s per song-minute total; beat grid ≤10 s for a 4-min song; full results ≤90 s p50 warm.
- **Fail:** smaller models (SCNet-S, Beat This! small), keep vendor separation longer, re-run the cost model in `research/ml/deployment-and-inference.md`.

### P5. Live mic pitch on phones (~1 week; may slip to week 5–6) — gates V7 (D12)
- SwiftF0 and PESTO v2 via ONNX Runtime Web in mobile Safari and Chrome Android, and in a native harness for comparison; iPhone 15-class + mid-range Android.
- Material: sung scales, guitar single notes, bass open strings; quiet room and backing track aloud.
- **Pass:** mic-to-display <50 ms, RPA ≥90% voice and guitar, bass E1 tracked by at least one tracker (SwiftF0 floor is 46.9 Hz, so expect CREPE-tiny or pYIN for bass).
- Also record: `AudioContext.baseLatency`/`outputLatency`, input latency via loopback, CPU %.

### P6. Chords on mixture vs no-drums stem (~1 week) — decides M8 emphasis, D4
- 30 hand-annotated songs; consonance-ACE and BTC on mixture, no-drums stem, and fusion with bass root.
- Metrics: WCSR majmin, sevenths, majmin_inv.
- **Pass:** majmin ≥0.75 on the best input. **Fail:** chord correction becomes central to the UX.

### P7. Time-stretch listening test (~1 week) — decides D5, informs D9
- 10 clips × {Signalsmith, Rubber Band R3 (R&D licence only for the test), AVAudioUnitTimePitch, Chromium WSOLA, Sonic} × {0.5×, 0.75×} × {full mix, guitar stem, drum stem}.
- Also: Signalsmith CPU in Safari AudioWorklet on iPhone and in Chrome on a mid-range Android, with 4 stems decoded and one stretcher (Option C).
- **Pass:** Signalsmith median within 0.5 of R3 at 0.5×, and CPU within the budget in `11-audio-engine.md`.
- **Fail:** budget the Rubber Band commercial licence (confirm app-store coverage first) or offline pre-render at fixed speeds.

## 4. From prototypes to CI regression
- Freeze each prototype's dataset + metric + threshold as a regression test in `services/ml/eval/regression.yaml`.
- Nightly job (GPU, small subset) and on every change to `services/ml/**` or model refs: fail if any metric drops by more than the tolerance (e.g. 1 point onset F1, 0.5 dB SDR, 1 point WCSR).
- Store per-run metrics in the experiment tracker (`00-tech-stack.md`) tagged with `pipeline_version`.

## 5. Week-by-week (Phase 0)
| Week | Work | Exit |
|---|---|---|
| 0–1 | Harness skeleton, codec simulator, scoring CLI, listening app; vendor trials and terms requests; recording sessions booked | Harness scores 10 clips end to end |
| 1–2.5 | P1 and P3 in parallel | Gate results recorded |
| 2–4 | P2, P7, P4, P6 | Updated cost model, stem menu, chord UX emphasis |
| 4–6 | P5; web practice-screen prototype usability rounds (8–10 P1 + P3 learners); fake-door pricing | Go/no-go on D1 file step, D10 price band, D11 instruments |

## Implementation notes (step 06, 2026-10-20)
- `services/ml/eval` is the uv workspace member `splitune-eval` (`src/splitune_eval/`, tests in `eval/tests/`); P3's `tab_metrics.py` moved into the package; `eval/p3_*.py` stay as the P3 scripts.
- **Registry:** `eval/sets/<id>.yaml` — `id`, `description`, `licence`, `provenance` (both required; loading fails otherwise and a test checks every registered set), `root` (default base `~/datasets`, `SPLITUNE_DATASETS_DIR` overrides), `split`, `tasks`, `tags`, and `items` or an `item_template` (glob + optional regex on the stem + `{stem}`/`{suffix}` templates). First set: `guitarset-mic-beats` (120 GuitarSet mic excerpts, progression 1 of each style, all players).
- **CLI:** `uv run splitune-eval sets [--check]`, `codec IN OUT --codec aac|opus [--bitrate 128k]` (round-trip + pyloudnorm to −14 LUFS, float WAV), `predict --task beats --set ID --out DIR [--model] [--codec]` (runs the shipped decode + beats stage code in-process and writes `<item>.beats.json` + `predict.json` with model refs, device and timings), `score --task {beats,notes,chords,sep,melody,tab} --set ID [--pred DIR]` → Markdown + CSV in `eval/results/<task>/<date>-<set>.md` with git sha, model refs, set licence/provenance, metric variant, command and per-tag breakdown.
- **Metrics:** beats = `mir_eval.beat.evaluate` (F ±70 ms, first 5 s trimmed) + downbeat F; notes = onset F1 and onset+offset F1 (50 ms, 50 cents, offset 20%/50 ms); chords = `mir_eval.chord.evaluate` WCSR (majmin, majmin_inv, sevenths, root, mirex); melody = `mir_eval.melody.evaluate`; sep = uSDR (MDX/MSST definition) and, with `--csdr`, chunk-level SDR from mir_eval's BSS Eval v3 images (1 s windows, median) — museval was not added (pandas/musdb weight); mir_eval deprecates its separation module in 0.8 (removal in 0.9), so switch cSDR to museval or MSST metrics before bumping mir_eval. tab = string/fret agreement + span compliance through `node packages/music-core/src/cli.ts fret`.
- **First result (no gate):** `eval/results/beats/2026-10-20-guitarset-mic-beats.md` — final0 on MPS F-measure 0.775 (comp 0.944, solo 0.606); small0 CPU 0.732; final0 after AAC 128 kb/s 0.779. beat_this was trained on GuitarSet's comping tracks (paper §4.1), so comp is in-sample; solo is the fairer number.
- Not built: the listening-test app (`apps/listening`, P1), `regression.yaml`/`pnpm eval:regression` (§4), provider adapters beyond the shipped stages.

## Implementation notes (step 07, 2026-10-21)
- **Listening app** `apps/listening` (Hono + `@hono/node-server`, plain HTML/JS page, no build): `LISTENING_SESSION_DIR=<dir> pnpm --filter @splitune/listening dev` → http://127.0.0.1:4100. Bound to localhost, no login (solo rater; magic link not reused). A session (`session.json` + `media/*.m4a`) is written by `eval/p1.py export`; raters see only opaque tokens, a per-rater deterministic shuffle (ratings first, then A/B pairs, A/B sides shuffled per rater) and the target instrument; the system names stay on the server. Answers: 1–5 "Could I practise with this?" per item and A / B / no preference per pair, resumable, keyboard-operable (1–5, A/B/N, ←/→). Results go to Postgres schema **`listening`** (`raters`, `ratings`, `preferences`), created idempotently by the app — local evaluation data, deliberately outside the product migrations and unreachable for the API roles. Preferences store the preferred item, not the side.
- **P1 tooling:** `eval/p1_musdb.py` reads 30 s windows of MUSDB18-HQ test songs straight from the Zenodo zip with HTTP range requests (members are deflated, so each is streamed only up to the window end; forward-only WAV parser because libsndfile's seeks restart decompression; 429 back-off; ~0.4 MB/s per connection, 6 connections). `eval/p1.py`: `codec` (AAC 128 kb/s round trip, no loudness change so references keep their scale), `separate --model` (shipped `stage_separation.models` wrapper), `energies`, `select` (writes registry set `eval/sets/musdb18hq-p1.yaml`), `export` (items loudness-matched to −16 LUFS and encoded with the shipped stem encoder), `sdr` (uSDR vs MUSDB vocals/drums/bass), `report` (ratings + preferences from Postgres, SDR, into `eval/results/p1/`). `scripts/bench_separation.py` measures each model on one song in a fresh torch-island process.
- MoisesDB was not used (sign-up required); MUSDB18-HQ has no guitar or piano references, so guitar/piano clips were chosen by BS-Roformer-SW stem energy among windows the tagger hears, and only listening decides those instruments.

## Implementation notes (step 08, 2026-10-21)
- **P2** (`eval/p2.py`: `build-guitar`, `build-bass`, `separate`, `predict`, `sweep`, `calibrate`, `report`). No owned set exists, so the gate runs on public material: 120 GuitarSet mic excerpts (progression 1, six players, comp + solo) mixed with a MUSDB18-HQ test window's drums, bass and vocals (guitar 3 LU below), and BabySlakh (19 tracks with bass, 16 with guitar; 30 s windows, MIDI references). Conditions: clean track (ceiling), BS-Roformer-SW stem (07b settings, production path), mixture. Every prediction runs the shipped `notes.<instrument>` stage in-process (`splitune_eval.local`). Fit/held-out split: GuitarSet players 00–02 / 03–05, BabySlakh tracks 1–10 / 11–20.
- **Result:** Basic Pitch passes for guitar (stem 0.797 vs mixture 0.516 onset F1) and bass (0.807 vs 0.323); YourMT3+ fails both (guitar stem 0.655 < its mixture 0.797; bass stem 0.804 < mixture 0.973). Defaults: Basic Pitch with swept thresholds; `views.yaml` gates guitar/bass `pass`. Both models were trained on GuitarSet and Slakh (BabySlakh = Slakh2100 training tracks), so all numbers are in-sample; P2 must be re-run on an owned set before the gate means much.
- **Slakh bass octave:** most BabySlakh bass patches sound an octave below their MIDI. The first reference builder only caught 7 of 19 tracks (it compared energy at f0/2 with f0, but bass patches carry little energy at f0/2), which made YourMT3+ (right) look broken and Basic Pitch (locked on the 2nd harmonic) look right. `rendered_octave` now uses the energy share at odd multiples of f0/2 (median ≥ 0.3 → −12): every bass stem is ≥ 0.33, correctly pitched guitars ≤ 0.26. The bass sweep was redone on the corrected references (thresholds changed from 0.6/0.3/58 ms to 0.7/0.5/127.7 ms).
- **Calibration:** isotonic (PAV, tied scores pooled) on matched stem notes of the fit split, ECE on the held-out split, 10 bins: Basic Pitch guitar 0.091 → 0.038, bass 0.163 → 0.067; YourMT3+ has a constant score, so its table is one knot at its precision (guitar 0.604, bass 0.846). Tables: `services/ml/config/calibration/<record>@<version>.<instrument>.json`; the reliability tables are in the P2 report.
- **P6** (`eval/p6.py`: `build`, `separate`, `predict`, `report`): the 60 GuitarSet comping excerpts + MUSDB drums; references the lead-sheet (instructed, gate) and performed chords; key from GuitarSet `key_mode`. Best majmin: madmom CNN on no-drums 0.787 → **PASS**; BTC sevenths no-drums 0.770 (paired difference 0.018, SE 0.016); consonance-ACE ≤ 0.585. The ACE port was checked against upstream (same CQT, network, and upstream's thresholded decoding scores no better on the same activations: 0.364 vs 0.377 frame-level), so the gap is the model on this material. Key: music-core over BTC/madmom chords 0.86–0.90 vs madmom's key CNN 0.715. Defaults: BTC, sevenths, no-drums, music-core key. The bass-root prior was not evaluated (no bass in the material).
- Not done: owned / Label Studio annotated songs (none exist), Billboard/Isophonics audio pairs, piano (Transkun) and vocals in P2.

## Implementation notes (step 18, 2026-10-23)
- **P2 piano** (`eval/p2.py build-piano`, `build-bass` now also writes BabySlakh piano references; `predict --instrument`): 16 MAESTRO v3 test performances (one per composer, 20–50 s, read from the dataset zip with HTTP range requests; register `maestro-v3`, evaluation only) mixed 3 LU under a MUSDB18-HQ band like the guitar set; 17 BabySlakh tracks with a General MIDI piano-class part (no octave shifts needed). Conditions and scoring as for guitar/bass; shipped stage code in-process.
- **Result** (`eval/results/p2/2026-10-23.md`), onset F1 on the stem: Transkun **0.946** (MAESTRO + band; clean 0.974, mixture 0.828) and 0.732 (BabySlakh); YourMT3+ 0.900 / 0.750; Basic Pitch 0.645 / 0.631. BabySlakh by patch: acoustic-only tracks Transkun 0.835 (n = 6), with an electric piano/clavinet 0.676 (n = 11). Gate (≥ 0.80 in a band, stem ≥ mixture) **PASS** for Transkun and YourMT3+ on MAESTRO + band. Caveats: both were trained on MAESTRO's training split (test performances are unseen but the pianos and rooms are the same) and YourMT3+ on Slakh; P2 still needs an owned pop-piano set.
- **Calibration:** `config/calibration/transkun-v2@2.0.1.piano.json`, one knot at the held-out precision (fit: even MAESTRO items + BabySlakh 1–10): ECE 0.131 → 0.049.

## Implementation notes (step 24, 2026-10-25)
- **P2p** (`eval/p2p.py`: `plan`, `build`, `separate`, `predict --chain`, `hands`, `report`): piano on the owner's kind of material, replacing P2 piano as the deciding set. Manifest `eval/sets/p2p.yaml` (a registered set, seed 24; audio is built locally under `~/datasets/p2p`). 48 excerpts of 30 s in four tiers that are reported apart:
  - `real-solo` (12): MAPS ENSTDkCl/ENSTDkAm and SMD v2, Disklavier MIDI with pedal.
  - `real-band` (8): other MAPS/SMD excerpts under a Slakh2100 test track's non-piano stems.
  - `pop-solo` (12): POP909 MELODY + PIANO rendered through Salamander, Splendid, Headroom, an upright, Rhodes, Wurlitzer, CP80, a harpsichord and a GM clavinet. Some items add a synthetic room, a phone chain (200 Hz–6 kHz, compression, MP3 128k) or ±25–30 cent detune. Ballads get a bar-wise sustain pedal.
  - `pop-band` (16): POP909 PIANO warped onto a Slakh2100 test track's beats and transposed to its key, 3 with the top line doubled by a guitar or synth. Plus 8 Slakh2100 test tracks' own piano parts in their own mixes (densest 30 s piano window).
  - P2's piano items run as a `legacy` tier.
- **References and metrics:** each item has key-release (`ref.keyoff.csv`) and pedal-extended (`ref.pedoff.csv`) references. Metrics per tier and per tag:
  - onset F1/P/R;
  - onset+offset F1 against both offset conventions;
  - onset+offset+velocity F1 and pitch-class F1;
  - piano-stem uSDR on band items;
  - ECE and per-band precision on held-out notes;
  - off-grid share: notes `buildPianoScore` flags > 60 ms from the beat grid, run through the music-core CLI on the item's own `beats` stage output;
  - wall time per 30 s.

  Conditions: `clean`, `stem`, `mixture` and `chosen` (the chain's own input choice). `hands` scores `splitHands` against ASAP's two score staves.
- **Baseline** (`eval/results/p2p/2026-10-24-baseline.md`; BS-Roformer-SW → Transkun V2 NoExt mono, pedal dropped, constant confidence), onset F1 on the chosen input (stem):
  - real-solo 0.923;
  - real-band 0.960;
  - pop-solo 0.847 (clean 0.924);
  - pop-band 0.876 (clean 0.947, mixture 0.661);
  - legacy 0.833, which matches P2 (0.836 item-weighted).

  Calibration bands are empty: every note sits in "high" at 0.918, held-out precision 0.917. Hands: 0.881 of 644,613 ASAP notes on the right staff. Time: about 17 s per 30 s of audio on the RTX 3060 (separation about 12 s).
- **Caveats:** rendered acoustic solo pianos are close to trivial (Salamander 1.0). The hard cells are separation on harpsichord/clavinet and phone audio, dense and doubled bands, and the mixture fallback. Real band items sit on synthetic Slakh bands, which separate easily (21 dB uSDR). The owner's songs are still the unreferenced tier.

## Implementation notes (step 24 phases 2–6, 2026-10-25)
- **Harness additions** (`eval/p2p.py`):
  - `detail` runs the shipped `Transkun.transcribe_detailed` with all per-note scores and the pedal, with optional `--stereo`, `--separator` and `--weights` (an alternative checkpoint).
  - `compare`, `sweep` (clean-up params chosen on fit, reported held-out) and `confidence` (AUROC, isotonic ECE, band precision) work on those runs.
  - `tags` runs the shipped tag stage. `calibrate` fits the piano tables.
  - `aria` runs Aria-AMT through `eval/aria_amt.py` in its own venv. `kong` runs the robust Kong model.
  - `separate --separator` takes `htdemucs_6s`, `vocals_then_sw` and `ens_sw_6s`.
  - `hands` compares `splitHands` with the shipped PM2S hands.
  - Chains: `baseline`, `yourmt3`, `final` (the shipped config, with the shipped solo-check decision in `chosen`).
- **Results:** `eval/results/p2p/2026-10-24-phases.md` (every candidate per phase) and `2026-10-24-final.md` (baseline vs shipped).

  Shipped chain vs baseline, chosen input:

  | tier | onset F1 | onset+offset F1, key | onset+offset F1, pedal |
  |---|---|---|---|
  | real-solo | 0.923 → 0.928 | 0.622 → 0.630 | 0.377 → 0.382 |
  | real-band | 0.960 → 0.960 | 0.613 → 0.625 | 0.330 → 0.344 |
  | pop-solo | 0.847 → **0.920** | 0.509 → 0.608 | 0.503 → 0.610 |
  | pop-band | 0.876 → 0.877 | 0.623 → 0.638 | 0.617 → 0.631 |
  | legacy | 0.833 → 0.869 | 0.539 → 0.552 | 0.539 → 0.552 |

  - Calibration: held-out ECE 0.009, bands high 0.953 / medium 0.638 / low 0.552 precision.
  - Hands: PM2S 0.927 vs `splitHands` 0.885 on unseen ASAP pieces.
  - Time per 30 s on the RTX 3060, chosen input:
    - solos 18.6 → 5.5 (real) and 17.9 → 6.3 (pop);
    - band 17.3 → 17.2 (real) and 16.4 → 20.1 (pop, +23 %: the solo check runs first);
    - legacy 32.5 → 31.7.
    - Separation seconds come from the same stored runs in both chains. The baseline's notes timings were taken while other jobs shared the GPU, so small differences are noise.
- **Per-song gate (owner, 2026-10-25):** `views.yaml` `min_confidence_mean: {piano: 0.80}`. A song whose mean calibrated note confidence is below 0.80 opens on the chord chart (reason `low_confidence`). On P2p: 4 of 81 songs gated, mean onset F1 0.516, none above 0.9.
- **Not done:** the owner's songs (the unreferenced tier).

## Implementation notes (step 25, 2026-10-28)
- **P2d** (`eval/p2d.py`: `plan`, `build`, `separate`, `predict --chain`, `report`): drums on the owner's kind of material, the deciding set for `notes.drums`. Manifest `eval/sets/p2d.yaml` (a registered set, seed 25; audio built locally under `~/datasets/p2d`). 48 excerpts of 30 s in six tiers that are reported apart, each item alternately `fit` / `test` within its tier:
  - `real-mdb` (8): MDB Drums full mix and drum-only track, 21 sub-classes mapped to GM.
  - `real-enst` (8): ENST-Drums minus-one takes, wet drum mix + accompaniment at 2/3 + 1/3 (the DTM convention); sticks, rods and brushes.
  - `real-electronic` (6): RBMA13, kick/snare/hi-hat references; audio is the free RBMA album, which the owner downloads into `~/datasets/rbma13/rbma_13/audio/` (items are skipped until then).
  - `solo-drums` (4): IDMT-SMT-Drums v2 real and drum-machine loops, kick/snare/hi-hat.
  - `rendered-band` (18): Groove MIDI test-split performances (Roland keys remapped to GM) rendered through sampled acoustic and brush kits (sfizz: DRSKit, Muldjord, Big Rusty, Unruly) and GS kits (FluidSynth, GeneralUser GS), with bus compression and some room or phone chains, mixed at −6 / 0 / +6 LU against MUSDB18-HQ test accompaniment (interference, not musical context). A kit's silent GM keys are dropped from render and reference.
  - `drum-machine` (4): the same performances quantized to 16ths at flat velocity, through 808 / electronic kits, under accompaniment.
  - Labels (reported per label): acoustic, ballad, dense, brushes, electronic, live-room, phone, swing (share of off-beat eighths at 0.58–0.72 of the beat), half-time, cymbal-wash, solo.
- **Metrics** (per tier, per label, per condition `clean` / `stem` / `mixture` / `chosen`):
  - onset F1/P/R summed over classes and class-mean F1 (mir_eval matching per class), at ±50 ms and ±30 ms; 3-class tiers score kick/snare/hi-hat only;
  - per-class F1;
  - kit pieces among class-matched hits (hi-hat open/closed, crash/ride, tom line) and the share of hits flagged `approximate`;
  - bars: both sides through the shipped `quantizeDrumHits` (music-core CLI `quantize-drums`) on the item's own `beats` stage grid; exact bar-pattern match share, mean per-bar Jaccard, residual-flag share and swing-bar share;
  - ECE and a reliability table per class on the `chosen` hits;
  - drum stem uSDR (not meaningful on MDB, whose drum-only track is not at the mix's gain) and wall time per 30 s.
- **Baseline** (`eval/results/p2d/2026-10-28-baseline.md`; BS-Roformer-SW drum stem → ADTOF Frame_RNN, published thresholds, research-default kit pieces), onset F1 ±50 ms on the chosen input:
  - real-mdb 0.848 (mixture 0.782);
  - real-enst 0.709 (clean 0.733): ADTOF misses ENST's soft kicks (0.630 kick F1);
  - solo-drums 0.976;
  - rendered-band 0.777 (clean 0.831, mixture 0.760);
  - drum-machine 0.735 (mixture 0.736: separation doesn't help programmed drums).

  Weakest labels: brushes 0.524, swing 0.538, phone 0.502. Toms 0.24–0.45 and cymbals 0.25–0.75 per tier. Exact bar patterns 0.11–0.25 outside solo loops (bar Jaccard 0.61–0.73). Raw peak heights are under-confident (ECE 0.226; precision 0.73 at 0.3–0.6, 0.96 at 0.7–0.9). notes.drums takes 0.12 s per 30 s on the RTX 3060.
- **Reference row:** YourMT3+ drums (GM keys it names itself), chosen 0.802 item mean vs 0.793. It is better on ENST (0.882, in-sample), drum machines and kit pieces (hi-hat open/closed 0.92 on MDB vs 0.77), worse on MDB (0.769), rendered bands (0.745) and cymbals. 1.3 s per 30 s.

## Open questions
- Who owns rater recruitment and compensation for P1/P7 (learners and teachers)?
- Can we obtain written R&D permission to benchmark `htdemucs_6s`/community checkpoints internally? (Benchmarking only; never shipped — D8.)
- Calibration needs per-instrument labelled notes from P2; if P2 slips, ship uncalibrated shading behind a flag and say so.

## Sources
Cross-linked research: `research/ml/pipeline-overview.md` §4 (all gates), `research/ml/datasets-metrics-and-licensing.md` (metrics, dataset licences), `research/ml/playback-time-stretch-pitch-shift.md` (P7 design), `research/ml/transcription-vocals-melody.md` (SwiftF0/PESTO), `research/ml/source-separation.md`, `research/executive-summary.md` (4–6 week plan).
