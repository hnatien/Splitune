# Step 06 — ML worker foundation, decode + beats stages, evaluation harness

## Before you start
Read `prompts/implementation/00-shared-context.md`, then:
- `docs/implementation/06-ml-pipeline-service.md` §0 (personal-mode choices), §1–§4, §8
- `docs/implementation/08-evaluation-harness-and-prototypes.md` §1–§2 (harness)
- `docs/implementation/25-personal-mode.md` §3, §5 (Mac worker, MPS, concurrency, DB roles)
- `docs/implementation/03-data-model-and-storage.md` (jobs, stage_runs, artefacts, cache keys) and the queue SQL documented in `packages/db/src/jobs/` by step 03

Prerequisites: Steps 01–03.

## Goal
A long-running Python worker on the Mac that claims jobs from Postgres, runs stages as pure functions with model processes kept warm per environment "island", writes artefacts to S3 and status to Postgres — proven with the `decode` and `beats` stages — plus the evaluation harness every later ML step reuses.

## Deliverables
1. **`splitune_ml_core`:** settings (pydantic-settings), Postgres access with the `ml_worker` role (psycopg 3), Python job consumer identical in semantics to the TS queue (claim with `SKIP LOCKED` + dependency check, heartbeat every 15 s, retries/backoff, stale requeue, `LISTEN jobs_python` with 5 s polling fallback), `worker_heartbeats` row every 30 s, S3 client, artefact writer (write temp key → copy to final key → insert `artefacts` row with sha256; idempotent on re-run), `stage_runs` bookkeeping with cache-key lookup (`CACHE_SCOPE` global|user), `job_events` emission, structured logging without URLs.
2. **Island runners:** one long-lived subprocess per environment (`torch`, `onnx-cpu`, `legacy` — create `torch` and `onnx-cpu` now) speaking a tiny JSON-lines RPC so models load once. Concurrency: 1 MPS job, ≤2 CPU jobs (configurable).
3. **Stages:** `decode` (ffmpeg 8.1 CLI → f32le hash = `audio_hash`, FLAC intermediate kept on local disk cache, `probe.json`, pyloudnorm loudness, duration/size limits, timeout) and `beats` (beat_this 1.1.0 final0 on MPS with CPU fallback to small0; BPM by median IBI; `tempo_octave_ambiguous`; writes `beats.json` validated by generated Pydantic models).
4. **Mock mode:** `ML_MODE=mock` worker that returns the contracts golden fixtures for any stage (used by API/web tests and CI).
5. **Evaluation harness** `services/ml/eval/`: test-set registry YAML format, codec simulator (AAC/Opus 128 kb/s round-trip), scoring CLI `uv run splitune-eval score --task {beats,notes,chords,sep,melody,tab}` wrapping `mir_eval` (and SDR via museval or MSST metrics), Markdown/CSV reports with git sha and model refs, `tab` task that calls the music-core Node CLI.
6. Process supervision example for the Mac (`launchd` plist template or `pm2` ecosystem file) in `services/ml/deploy/`.

## Out of scope
Separation, notes, chords (steps 07–08); URL import (step 09); Railway deployment (step 17).

## Acceptance criteria
- Enqueue a `decode` → `beats` chain from a test script; the worker processes it, artefacts appear in SeaweedFS, `stage_runs`, `artefacts`, `job_events` rows are correct, and a re-run hits the cache (no recompute).
- Killing the worker mid-job leads to requeue and successful completion on restart; no duplicate artefact rows.
- Beat F-measure via the harness on any small annotated set you assemble (e.g., a few GTZAN/Harmonix-annotated tracks you have locally) is printed with the metric variant; report it (no gate).
- Measure and report on the Mac: decode time and beat-grid time for a 4-minute song (MPS and CPU), cold vs warm.

## Verification to run and report
`uv run pytest`, `uv run ruff check`, `uv run pyright`, the chain script output, the crash/requeue test, harness command output, timing table.
