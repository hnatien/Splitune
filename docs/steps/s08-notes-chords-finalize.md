# Step 08 — Notes and chords stages, finalize worker, summary

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/specs/06-ml-pipeline-service.md` §0, §2, §4 ("notes", "chords"), §6
- `docs/specs/05-analysis-schema.md` (`chords`, `notes.*`, `tab.*`, `summary`, `recommended_view` rule)
- `docs/specs/07-music-algorithms.md` (finalize uses `buildTab`)
- `docs/specs/08-evaluation-harness-and-prototypes.md` P2 and P6 (personal-mode candidates in the callout)

Prerequisites: Steps 05, 06, 07.

## Goal
Turn stems into what the learner reads: chords (+ key), guitar/bass note events with calibrated confidence, and — via the Node finalize worker running music-core — quantized tab, alphaTex and the per-instrument `summary` that drives the chords-only fallback. Pick the best candidates with Prototypes 2 and 6.

## Deliverables
1. **`notes.guitar` / `notes.bass` / `notes.vocals`** (onnx-cpu island): Basic Pitch 0.4.0 via its bundled `nmp.onnx` on ONNX Runtime (install basic-pitch **without TensorFlow** — uv override or `--no-deps` + vendored post-processing if needed). Bass: minimum frequency ≈30 Hz and per-note `low_band_energy` for octave correction. Confidence = mean onset posterior over the first 3 frames → calibrated via `services/ml/config/calibration/<model>@<version>.json` (start with identity; fit isotonic after P2).
2. **Optional candidate:** YourMT3+ (torch island) behind the same `NoteTranscriber` interface, selectable by config, for P2 comparison.
3. **`chords`** (torch or legacy island): implement consonance-ACE, BTC and madmom CNN+CRF behind a `ChordRecognizer` interface; fusion of mixture + no-drums stem + bass-root prior; output majmin and sevenths with top-k. Key via madmom CNN key or music-core estimator (config).
4. **Node finalize worker** (`apps/node-worker`, new app; runs on the Mac): claims `finalize` jobs (runner `node`), loads artefacts, calls music-core `buildTab` per instrument, writes `tab/*.json`, `render/*.alphatex`, computes `summary.json` per the `recommended_view` rule (thresholds from `services/ml/config/views.yaml`, readable by Node), updates `analyses.status`, emits `job_events`.
5. **Prototypes:** P2 (stems vs mixture; Basic Pitch vs YourMT3+ on guitar/bass; onset F1 and onset+offset F1 via the harness) and P6 (chords: three models × {mixture, no-drums, fusion}; WCSR majmin/sevenths/majmin_inv) on whatever annotated material is available locally (GuitarSet, owner-annotated songs via Label Studio, public chord annotations such as Billboard/Isophonics paired with audio the owner has). Fit calibration from P2 data. Reports under `services/ml/eval/results/p2|p6/<date>.md`; choose defaults in config.

## Out of scope
Piano/drums notes (v1 steps), lyrics, sections, orchestration of the full graph (step 09).

## Acceptance criteria
- Given decoded audio + stems, the stages produce contract-valid `chords`, `notes.guitar`, `notes.bass`; finalize produces `tab.*`, alphaTex that alphaTab 1.8 parses (test by loading it in alphaTab in Node or a headless browser), and a `summary` whose `recommended_view` follows the rule (unit-tested with crafted inputs for every branch).
- P2/P6 reports exist with the metric variants named and the chosen defaults recorded; gates from doc 08 are evaluated honestly (pass/fail), and failing instruments default to `chords_only`.
- Reliability diagram / ECE printed for the calibrated note confidence.

## Verification to run and report
`uv run pytest -k "notes or chords"`, `pnpm --filter node-worker test`, alphaTex parse test, P2/P6 report summaries, calibration metrics.
