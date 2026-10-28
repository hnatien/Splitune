# Step 25 — Drums end to end: measure, choose and calibrate a transcriber, then the drum grid and drum tab

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/progress-log.md` entries for steps **06** (eval harness), **07 / 07b** (separation, P1), **08** (notes stage, calibration, P2), **18** (piano: how a new transcriber was chosen, calibrated and shipped) and **24** (P2p: test-set tiers, harness that runs the shipped code, per-tag reports, confidence calibration, gates). This step follows step 24's method for a new instrument.
- `docs/specs/21-v1-features.md` V6 and V13 (drums "core groove"), and its personal-mode callout (**V6 uses pretrained ADTOF**, no in-house training project), `specs/25-personal-mode.md` (any model or dataset is allowed; licences are a provenance record, not a gate), `specs/06-ml-pipeline-service.md` §0, §2 (`notes.drums` rows, islands, cache keys), `specs/05-analysis-schema.md` (`notes.drums`, `recommended_view` rules, `drum_grid`), `specs/07-music-algorithms.md` (quantize, drum flams), `specs/08-evaluation-harness-and-prototypes.md` (P2 definition and gate).
- Research: `docs/research/ml/transcription-drums.md` (ADTOF / ADTOF-pytorch, Riley & Dixon separation-assisted 7-class, N2N, STAR Drums, OaF-Drums, YourMT3+; MDB Drums, ENST, E-GMD, Groove MIDI, Slakh, RBMA13, IDMT), `docs/research/ml/source-separation.md`, `docs/research/ux/music-display-ui.md` (drum staff conventions, kit legend, lanes). These are from 2026-10-20: re-check for newer drum models and released weights before choosing.
- UI: `docs/specs/26-design-system.md` (incl. the step 17d/18 notes; §5 confidence encoding; `--stem-drums`), `specs/27-screens-flows-and-content.md` §5 (and the onboarding instrument step, where Drums still says "Coming soon"), `specs/28-ui-quality-and-design-review.md` §5: compose from the kit, add stories for every new state, use catalogue copy (add keys), pass the design QA checklist.
- Code:
  - ML: `services/ml/packages/stage_notes/src/stage_notes/` (`stage.py`, `transcribers.py`, `transkun.py` and `piano.py` as the model for a torch-island transcriber, `yourmt3.py`, which skips `is_drum` notes today); `services/ml/packages/splitune_ml_core/src/splitune_ml_core/stages.py` (the `notes.<instrument>` loop at line ~166 has no drums); `services/ml/config/{separation,notes}.personal.yaml` (drums chain `bs_roformer_sw → htdemucs_ft → htdemucs_6s`, `keep: [drums, bass]`), `views.yaml` (`defaults.drums: drum_grid`, no `notation_supported`/`quality_gate` entry), `config/calibration/`; `services/ml/eval/p2p.py`, `eval/sets/p2p.yaml`, `splitune_eval`; `scripts/fetch_models.py`; `compliance/register/models/*.yaml`.
  - Orchestration: `apps/api/src/pipeline.ts` (`NOTES_INSTRUMENTS` excludes drums), `apps/node-worker/src/{finalize,views}.ts`.
  - Contracts: `packages/contracts/src/analysis/notes.ts` (`DrumHit`: `class5`, `gm_note`, optional `velocity`, `approximate`; `DrumNotes`), `fixtures/notes.drums.json`.
  - music-core: `packages/music-core/src/quantize/quantize.ts` (`quantizeDrumHits`, flams within 25 ms), `level/simplify.ts`, `export/alphatex*.ts`, `piano/build-piano.ts` (shape for a `buildDrumScore`), `cli.ts`, `golden/`.
  - Web: `apps/web/app/features/practice/chord-sheet.tsx` (lazy-loaded views: `PianoNotes`, `PianoStaff`, `GuitarNotes`, `VocalMelody`), `piano-notes.tsx`, `piano-staff.tsx`, `score-theme.ts`, `level-toggle.tsx`, `mixer-drawer.tsx`, `practice.stories.tsx`, `practice-story-data.ts`; `apps/web/app/features/onboarding/onboarding-page.tsx`; `apps/web/messages/en.json`. Flags: `feature_flags` rows read through `deps.flags.flag('v1.…')` (see `apps/api/src/routes/loops.ts`).

Prerequisites: MVP (steps 01–17) and steps 18–24's work on `dev`. Branch `impl/25-drums` from the current `dev`; split into `impl/25a-…` sub-branches if large (for example ML / music-core / web), each shippable behind a flag. This step **replaces step 19's drums deliverables 4 and 5**; step 19 keeps piano wait mode and piano levels. Per `specs/23-plans-free-and-paid.md` drum notation is part of Full analyses (and the Welcome analysis). The owner doesn't play an instrument: no deliverable may depend on owner-played recordings or owner transcriptions; use datasets, rendered MIDI and scripted tests.

This is an ML step first: **every production choice is decided by numbers on the test set**, never by a paper's claim. "Training" here means fine-tuning only if Phase 3 measures a gap that a pretrained model can't close, and only with the owner's OK (Stop point 3).

## What exists today (don't rebuild)
- Contract `notes.drums` (`DrumHit`, `DrumNotes`) and a fixture; `recommended_view` already has `drum_grid`; `views.yaml` defaults drums to `drum_grid`.
- Drum stems from separation (P1 measured drums uSDR on MUSDB only, 2 clips), kept for the mixer and for chords' `no_drums` input.
- `quantizeDrumHits` in music-core (same grid as pitched parts, flam collapse); nothing calls it.
- The mixer drums row and the `--stem-drums` token.

Nothing transcribes drums, nothing renders them, and nothing measures either. The research doc's comparison (ADTOF 0.87 MDB / 0.84 ENST; ~0.60 on electronic/produced music; open/closed hi-hat and crash/ride unreliable) is the starting hypothesis, not a result.

## Goal
Learners practise the drum part of their own songs on a drum grid or an alphaTab drum tab, at a chosen level, with honest confidence: the right input (drum stem or mixture), the most accurate transcriber for it, class and kit-piece choices flagged where they're guesses, calibrated per-hit confidence, and a gate that falls back to chords-only when drums are transcribed badly — each stage measured on its own and end to end, shipped only when it wins, within the worker's time budget.

## Phase 0 — Research re-check and test set plan (stop for the owner)
1. Re-check the research doc against what exists **today**: ADTOF (TF original) and ADTOF-pytorch (which checkpoint, which of the RGW/YT/combined models, frame rate, peak-picking thresholds per class), STAR Drums models, N2N and any 2025–26 drum transcriber with released weights, OaF-Drums / hFT-Transformer drums checkpoints (velocity), YourMT3+ drums output (it already runs in the torch island for piano), drum-kit separators (MDX23C DrumSep and newer, in MSST / audio-separator), and drum-specific separation checkpoints for the drum stem. Record source, weights availability, classes, input, runtime and island for each.
2. Test set sources, best first. Label each tier clearly in every report and never merge their numbers into one figure without saying so.
   - **Real recordings with onset references:** MDB Drums (23 MedleyDB tracks: drum stem + mix), ENST-Drums (with/without accompaniment), IDMT-SMT-Drums, RBMA13 (electronic). Note which candidates trained on which (ADTOF-YT, STAR Drums, YourMT3+ on ENST/Slakh): in-sample numbers are labelled as such.
   - **Pop/rock band material with exact references:** Groove MIDI / E-GMD performances (GM-remapped; the Roland map differs) rendered through several acoustic kits with varied rooms and compression, mixed under real accompaniment from MUSDB18-HQ / MoisesDB (bass, guitars, keys, vocals) at several levels; Slakh2100's **test** split drums. Include electronic/programmed drums and drum machines as their own tag.
   - **Kit-piece detail:** a subset with open/closed hi-hat, crash/ride and per-tom references (E-GMD/Groove 7–9 classes, MDB's 21 sub-classes) to measure the `approximate` choices.
   - **The owner's songs:** 10–20 excerpts from the owner's library with drums (rock, pop, ballad with brushes, electronic, live), unreferenced: scored by agreement between models and listening checks of a synthesized playback against the stem only.
3. Target 40–60 excerpts of 20–40 s tagged: acoustic rock/pop kit, sparse ballad, dense/fast (double kick, 16th hi-hats), brushes/ghost notes, electronic/drum machine, live room, phone-quality, half-time/shuffle (swing), heavy cymbal wash. Manifests go in `services/ml/eval/sets/`; audio and datasets stay out of git, under `~/datasets/` (only `babyslakh`, `guitarset`, `musdb18hq-p1`, `p2`, `p6` exist today: say what must be downloaded and how large).
4. Write the result as `docs/research/ml/transcription-drums.md` §"2026-10 re-check" and a short plan (candidates per phase, test set, downloads, estimated hours and analysis-time cost). **Post the plan in chat and wait for the owner's OK** on the test set, downloads and the time budget before Phase 1.

## Phase 1 — Harness and baseline
1. Add `eval/p2d.py` in the style of `eval/p2p.py`, reusing `splitune_eval`, so one command reports, per tag and overall:
   - **separation:** drum stem SDR/uSDR where a clean drum track exists;
   - **hits:** onset F1/P/R at ±50 ms (`mir_eval`, the field's convention) per class and summed over classes, plus class-mean F1, on clean drums / drum stem / mixture / the input the pipeline actually chose; also ±30 ms, since a practice app is judged on tighter timing;
   - **kit pieces:** accuracy of open/closed hi-hat, crash/ride and tom choices where references have them, and the share of hits flagged `approximate`;
   - **after quantization:** per-bar pattern accuracy against the reference quantized on the same grid (the musically meaningful number: does each bar's groove match?), residual-flag share, and swing-bar detection;
   - **calibration:** ECE and a reliability table per class;
   - **time per 30 s** on the worker (Mac MPS and the Windows PC on CUDA).
   Run the shipped stage code in-process and the shipped music-core code through the CLI, so the evaluated code is the shipped code. Results go to `services/ml/eval/results/p2d/<date>.md` + `.csv` with git SHA and model versions. Add P2d to doc 08.
2. Baseline row: the research doc's recommendation as a first stage (BS-Roformer-SW drum stem → ADTOF-pytorch 5-class with its default thresholds → GM mapping below → `quantizeDrumHits`). Also run YourMT3+ drums on the mixture and the stem as a reference row. **Stop and show the owner the baseline and the phase plan with time estimates before Phase 2.**

## Phase 2 — The `notes.drums` stage
1. **Stage:** a `notes.drums` transcriber in `stage_notes` (torch island, MPS/CUDA through the existing device module), registered in `stages.py` alongside the other instruments, reading the drum stem (or the mixture on `stems_unavailable`, with `fallback` / `notes_on_mixture` as the pitched instruments do) and writing a contract-valid `notes/drums.json`. Params (model, thresholds, minimum inter-onset gap) live in `notes.personal.yaml` and are part of the cache key; say which caches the change invalidates.
2. **Class → GM mapping** in one place, used by both Python and music-core through the contract: kick 36, snare 38, closed hi-hat 42 (open 46, pedal 44), toms high/mid/low 50/47/45 (floor 43), crash 49, ride 51 (bell 53). With 5 classes, follow the research doc's defaults (cymbals → crash on a bar's first beat after a gap, ride otherwise; toms → one line; hi-hat → closed) and set `approximate: true` on every such guess. If kit-piece choices need more than `gm_note` + `approximate`, change the contract in `packages/contracts` and run `pnpm contracts:gen`; never hand-edit generated files.
3. **Orchestration:** add drums to `NOTES_INSTRUMENTS` in `apps/api/src/pipeline.ts` and to `notation_supported` in `views.yaml` only behind the flag (below) until Phase 6; `finalize` writes the drum score input the web needs (decide with music-core whether that's a `render/drums.alphatex` like the tab instruments or built in the music Worker like piano; explain).
4. **Register and weights:** `compliance/register/models/<model>.yaml` with source, licence (recorded, not a gate) and sha256 per file; weights only via `scripts/fetch_models.py`, never git.

## Phase 3 — Accuracy (each measured alone, then combined; report losers too)
- **Input choice:** drum stem vs mixture vs a drum-specific separation checkpoint, and the separation chain for drums (today's BS-Roformer-SW first); downstream hit F1 decides, not SDR. A solo-drums or drums-plus-click case doesn't need separation: measure whether a `solo_check`-style bypass (as step 24 shipped for piano) is worth it.
- **Peak picking:** sweep ADTOF's per-class thresholds and minimum gap on held-out material; cymbal wash and hi-hat bleed into snare are the expected errors.
- **Kit split:** separation-assisted 7-class expansion (DrumSep-style kit separation → open/closed hi-hat, crash/ride, toms) following Riley & Dixon; ship it only if it beats the 5-class defaults on the kit-piece subset by enough to clear fewer hits as `approximate`.
- **Candidates:** STAR Drums, YourMT3+ drums, N2N or any Phase 0 find with weights; ensembles (agreement of two transcribers) if they win.
- **Velocity:** only if a candidate gives usable velocity on real music (ghost notes, accents); otherwise leave `velocity` empty and say so. Ghost-note marks are v2.
- **Per-hit confidence:** candidates are the activation peak height, its margin over the threshold, and cross-model agreement; measure separation of correct from wrong hits (AUROC, precision per band), ship the best as `confidence_raw` and fit `config/calibration/<model>@<version>.drums.json` on held-out hits. Bands must mean something (share and precision per band, ECE).
- **Fine-tuning (only with the owner's OK, Stop point 3):** if the electronic or band-mix tags stay well below the others, propose fine-tuning the chosen model on E-GMD/Groove renders mixed under separated accompaniment (V6's original plan; the Windows PC on CUDA from step 09c is the training host), with an estimate of hours and expected gain. Never train on the test set's tracks.

## Phase 4 — music-core: drum score, levels, export
1. `buildDrumScore(drumNotes, beats, corrections, options)` in `packages/music-core/src/drums/`, using `quantizeDrumHits` (flams kept as flams), voices (hands up, feet down), and the bar structure from the beat grid (pickup bars, swing bars). Drum corrections are overlays like the others: add drum ops to `CorrectionOp` only if the editor gets drum editing in this step (it doesn't have to: say which).
2. **alphaTex drum tab export** in `export/` with the GM percussion articulations alphaTab expects; test that GM mapping round-trips through alphaTab's drum import (every class and kit piece). MusicXML percussion round-trip waits for step 20's export: note it in the progress log.
3. **Levels (V13)** in `music-core/level/`: `as_transcribed`; `core_groove` = kick + snare + hi-hat on the main pattern, fills removed (fills = bars whose pattern differs from the bar-pattern mode); optionally `simplified` (hi-hat reduced to 8ths, ghost hits dropped) if it's cheap. Golden tests per level in `golden/`, including a song with a pickup, a swing section and a fill every fourth bar.
4. CLI subcommand(s) in `cli.ts` so the harness runs the shipped code.

## Phase 5 — Drum views in the practice screen
1. **Drum grid** (default `drum_grid`): lanes with names and a kit legend (cymbals and hi-hat top, kick bottom, as on a drum staff), hits on the beat grid synced to the transport clock, bar lines and the loop range, `approximate` hits and medium/low-confidence hits drawn with the confidence encoding of doc 26 §5 (dashed outline, never colour alone), a flam mark, keyboard- and pedal-operable like every practice view. Lazy-loaded from `chord-sheet.tsx` like the piano views.
2. **Drum tab option:** alphaTab drum notation from Phase 4's alphaTex, via the existing score theme and cursor, also lazy.
3. **Level toggle** for drums through `level-toggle.tsx` (`as_transcribed` / `core_groove`), followed by both views.
4. **Mixer:** "drums" solo/mute already exists; make sure the drums view's default mix suits drum practice (mix minus drums available, click/count-in audible).
5. **Onboarding:** Drums stops saying "Coming soon" once the flag is on; the copy catalogue gets keys for every new string.
6. Stories for every state (loading, gate failed → chords only, approximate-heavy song, swing, pickup, levels, Light/Dark/Stage, increased contrast, phone/tablet/desktop) and pass `specs/28` §5's checklist. The practice route JS budget is almost used up (see shared context): everything new loads lazily outside it; report before/after bytes built the same way.

## Phase 6 — Gate, flags and end to end
1. `views.yaml`: drums in `notation_supported`, a `quality_gate.drums` from the P2d result (gate rule and threshold stated; doc 08 names none for drums, so propose one and say why), a `min_confidence_mean.drums` floor only if Phase 3's per-song confidence separates bad songs from good ones (as piano's 0.80 did), and a `changes` entry with model versions.
2. Flags `v1.drums` (pipeline + views) default off, on after verification; name the success metric (doc 16).
3. Re-analyse the owner's drum excerpts end to end on the worker; contract-valid `notes.drums`; drum grid and drum tab viewed in the local app with screenshots per level.

## Constraints
- No change to production defaults without a win on the test set; report every candidate, including losers.
- Time budget: report full analysis time with drums on the worker before and after; ask the owner before shipping anything that adds more than ~30 % to a full analysis.
- Contracts first: every new field (kit piece detail, bypass decision, drum corrections) is a Zod change in `packages/contracts` with regenerated Pydantic models and updated fixtures.
- Every new stage param or config value is part of the stage cache key; say which caches the change invalidates.
- Times are seconds on the decoded-PCM timeline; quantization stays a separate, re-runnable stage.
- Weights from `fetch_models.py` with register records; datasets and audio stay out of git.
- UI uses `@splitune/ui-tokens` and `apps/web/app/ui` components only; confidence never by colour alone; WCAG 2.2 AA.
- Don't re-litigate the guitar, bass, piano or vocal paths.

## Stop points (ask the owner in chat, wait for the answer)
1. Phase 0 plan: test set sources, downloads and sizes, time budget.
2. After the baseline row: the phase plan with estimated hours.
3. Any fine-tuning or training run, and any chain that adds more than ~30 % analysis time.
4. The drums gate threshold and turning `v1.drums` on.

## Out of scope
Piano wait mode and piano levels (step 19), mic scoring of drum playing and MIDI e-kit input (step 20 or later), MusicXML/MIDI export (step 20), sticking (R/L) and ghost-note marks, drum editing in the editor unless Phase 4 says it's small.

## Acceptance criteria
- Owner approved the Phase 0 plan; test set manifests exist (no owner-played material), covering every tag above; baseline row recorded.
- One P2d report table per phase (overall and per tag): baseline vs every candidate vs shipped, with time per 30 s on both workers.
- Shipped chain beats the baseline end to end on onset F1 (±50 and ±30 ms) and per-bar pattern accuracy, with calibrated per-hit confidence (ECE and per-band precision in the report) and the share of `approximate` hits; margins and stability across tags stated, with an honest note on the remaining ceiling per tag (electronic, brushes, cymbal wash).
- GM mapping round-trips through alphaTab drum tab (test); level rules have golden tests per level.
- Real songs from the owner's library re-analysed end to end on the worker; drum grid and drum tab screenshots; stories and a11y tests pass; route budget within limits (before/after bytes).
- Flags default off, then on after the owner's OK; success metric named.
- Docs updated: `08` (P2d), `06` (stage, islands, config, cache key), `05` (any new fields), `07` (drum score, levels), `21` V6/V13 notes, `docs/research/ml/transcription-drums.md` with what was measured; step 19's drums items marked moved. Progress-log entry appended, `docs/status.md` updated.

## Verification to run and report
`cd services/ml && uv run ruff check && uv run pyright && uv run pytest` (and `uv run pytest -k drums`), the P2d report commands, `pnpm contracts:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm --filter @splitune/music-core test`, node-worker and api tests, `pnpm --filter web test:stories`, web E2E for the drum views, `pnpm --filter @splitune/web budget --enforce` before/after, end-to-end drum analysis timings on both workers, and the production-worker update steps the owner must run after merging (`git pull`, `uv sync` for the affected island, `fetch_models.py`, `pnpm workers restart`).
