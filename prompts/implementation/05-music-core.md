# Step 05 — music-core (quantize, fret DP, corrections, levels, alphaTex)

## Before you start
Read `prompts/implementation/00-shared-context.md`, then:
- `docs/implementation/07-music-algorithms.md` (primary spec — algorithms, cost terms, tests)
- `docs/implementation/05-analysis-schema.md` (types you consume/produce; corrections overlay)
- `docs/ml/transcription-guitar-and-bass-tabs.md` (why lowest-fret bias, span limits, bass ranges)
- `docs/implementation/08-evaluation-harness-and-prototypes.md` §3 P3 (gate you must hit)

Prerequisites: Step 02 (contracts). Independent of steps 03–04 — can run in parallel with them.

## Goal
`packages/music-core`: pure, deterministic TypeScript functions over the contracts that run in a browser Web Worker and in Node, plus a Node CLI used by the Python eval harness.

## Deliverables
1. Modules per doc 07 "Module map": `corrections/apply`, `grid/beatgrid` (incl. `tempo_octave`, `shift_downbeat`, `nudge_beat`, `timeToTick`, `tickToTime`, pickup-aware `snapToBar`), `quantize` (1/16 grid, per-bar swing detection, chord collapse within 30 ms, drum flams, residual flags), `bass/octave` (Viterbi with chord-root prior and smoothness), `harmony/key` (profile correlation + margin confidence), `harmony/chordtools` (Harte parse/format, transpose, simplify to triads, shape library for open/barre chords and difficulty scores), `fret/dp` (K-best candidates, cost terms and weights from doc 07 §5 as a typed config, `alt_fingerings`, bass presets, unplayable handling), `level/simplify` (guitar chords_only/simplified/as_transcribed; bass roots/full), `transpose` (playback key vs shapes key; capo suggestion), `export/alphatex` (verify the alphaTex syntax against the alphaTab 1.8 docs and record any differences in doc 07), `calibration/lookup`.
2. `buildTab(notes, beats, corrections, options)` — the one entry point the finalize worker and the web Worker both call; returns the `Tab` contract plus the alphaTex string.
3. **Node CLI** `pnpm --filter music-core cli <command>` with JSON stdin/stdout: `fret`, `quantize`, `build-tab`. Language-neutral golden tests (JSON in, JSON out) in `packages/music-core/golden/`.
4. **Tests:** unit + fast-check property tests listed in doc 07 §9; golden files from the contracts fixtures; Vitest bench for a dense 4-minute guitar part (generate synthetically).
5. **P3 evaluation:** a script that reads GuitarSet JAMS annotations (download GuitarSet locally — it's CC-BY-4.0 and copyright gating is off anyway; never commit the dataset) and reports string/fret agreement and span compliance of `fret/dp` on ground-truth notes. Record results in `PROGRESS.md` and in `docs/implementation/08-…` results folder convention (`services/ml/eval/results/p3/<date>.md`).

## Out of scope
UI, audio, Python stages. The learned fret assigner (not planned).

## Acceptance criteria
- P3 gate: ≥0.90 string/fret agreement on GuitarSet ground-truth notes and 100% span compliance with `maxSpan=4` (if not met, tune weights; if still not met, report the best result honestly and propose next steps — do not lower the gate).
- Property tests pass (quantize idempotent; fretted pitch equals input; span ≤ max; empty corrections = identity; transpose round-trip).
- Bench: `buildTab` on the synthetic 4-minute part ≤150 ms in Node on the dev machine (report the number; browser timing is verified in step 12).
- Zero runtime dependencies beyond the contracts package (or justify each).

## Verification to run and report
`pnpm --filter music-core test`, `pnpm --filter music-core bench`, the P3 script output, `pnpm typecheck`, `pnpm lint`.
