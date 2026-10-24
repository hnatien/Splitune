# Step 07 — Separation stage, stem post-processing and Prototype 1

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/specs/06-ml-pipeline-service.md` §0, §2 (`separate`, `stem_post` rows), §4 "stem_post"
- `docs/specs/25-personal-mode.md` §3 (model candidates; python-audio-separator on MPS)
- `docs/specs/08-evaluation-harness-and-prototypes.md` P1 (personal-mode version in the callout)
- `docs/specs/05-analysis-schema.md` (`stems`, `presence`)
- Research: `docs/research/ml/source-separation.md`, `docs/research/ml/source-separation-model-comparison.md`

Prerequisites: Step 06.

## Goal
Produce practice-grade stems for the learner's instrument on the Mac with the best open models, plus mix-minus, presence/activity and browser-safe encodes — and pick the per-instrument model map by listening (Prototype 1).

## Deliverables
1. **`separate` stage** (torch island): `python-audio-separator` 0.44.x (requires PyTorch ≥2.13 on Apple Silicon; MPS for Demucs/RoFormer, CoreML EP for ONNX MDX). Config-driven model map `services/ml/config/separation.personal.yaml`: per target instrument → ordered list of models (fallback chain). Request only what the analysis needs (the learner's instrument plus whatever mix-minus requires). Model weights cached under a local models dir (git-ignored), verified by sha256 recorded in `compliance/register/` provenance records.
2. **Instrument tagger** (`tag` stage, onnx-cpu island): EfficientAT or PANNs clip-level presence on the mixture → which stems are worth computing.
3. **`stem_post` stage** (onnx-cpu island): alignment by cross-correlation, mix-minus (mixture − stem, or the model's complementary stem when the P1 listening shows it's cleaner — configurable per instrument), frame-energy activity + tagger gating → `presence.json` (`present_prob`, `activity[]`, `bleed_suspected`, `empty`), `quality_hint`, single shared `mix_gain_db` to −14 LUFS plus per-stem `gain_to_unity_db`, encodes AAC-LC 160 kb/s MP4 (always) + Opus 96 kb/s WebM (optional), **length/offset verification** of every encode against the PCM (priming/pre-skip), `stems.json`.
4. **Listening app** `apps/listening` (minimal TanStack Start or plain Vite page is fine): blind randomized clips, 1–5 "could I practise with this?" + pairwise preference, results to Postgres; magic-link login reuse is optional for a solo rater.
5. **Prototype 1 run:** 20 × 30 s clips (from the owner's library and/or MUSDB18-HQ/MoisesDB, re-encoded to ~128 kb/s), candidates: `htdemucs_6s`, `htdemucs_ft`, 2–3 BS-/Mel-RoFormer community checkpoints, SCNet XL, MSST 53-stem if memory allows. Also report SDR on MUSDB18-HQ/MoisesDB clips where references exist (secondary to listening). Write the chosen map into the YAML and the result report into `services/ml/eval/results/p1/<date>.md`.
6. Timing and memory per model on the Mac for a 4-minute song (MPS), feeding the P4 picture.

## Out of scope
Notes, chords, finalize. Vendor adapters (dormant).

## Acceptance criteria
- End-to-end: a song enqueued for analysis produces aligned stems + mix-minus + presence + `stems.json`, playable in Chrome and Safari via `decodeAudioData` with exact sample length (write a tiny browser check page or Playwright test that decodes both codecs and compares lengths).
- Fallback chain works: forcing the first model to fail uses the next; total failure yields an analysis without stems and a `stems_unavailable` reason.
- P1 report exists with ratings per model per instrument and the chosen map; if guitar/piano isolation is weak for every model, say so and mark those stems `rough` by default (doc 08 P1 fail rule).

## Verification to run and report
`uv run pytest -k "separate or stem_post or tag"`, the browser decode check, the P1 report path and summary table, timing/memory table.
