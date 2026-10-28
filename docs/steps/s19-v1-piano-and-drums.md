# Step 19 — v1 instruments: finish piano, then drums

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/progress-log.md` entries **17d, 18 and 18a**: most of the piano half of this step is already built (see "Already done" below). Read how it was built before touching it.
- `docs/specs/21-v1-features.md` V4, V5, V6, V13 (personal-mode callout: Transkun/Aria-AMT allowed; drums via pretrained ADTOF) and its step-18 implementation notes
- `docs/specs/06-ml-pipeline-service.md` §0, §2 (piano/drums rows)
- `docs/specs/05-analysis-schema.md` (`notes.piano` with hands, `notes.drums`)
- Research: `docs/research/ml/transcription-piano.md`, `docs/research/ml/transcription-drums.md`, `docs/research/ux/music-display-ui.md` (roll + keyboard strip, drum notation)
- `docs/specs/26-design-system.md` (incl. the step 17d/18 notes), `specs/27-screens-flows-and-content.md` §5, `specs/28-ui-quality-and-design-review.md` §5 — wait mode and drum grid: compose from the kit, add stories for new states, use catalogue copy (add keys), pass the design QA checklist

Prerequisites: MVP (steps 01–17) and the piano work on `dev` (PROGRESS steps 17d–18a). Branch `impl/19-piano-drums` from the current `dev`; split into `impl/19a-…` sub-branches if large, each shippable behind a flag. Per `specs/23-plans-free-and-paid.md` piano/drums notation is part of Full analyses (and the Welcome analysis). The owner doesn't play an instrument: no deliverable may depend on owner-played recordings; use datasets, virtual MIDI and scripted tests.

## Already done (don't rebuild)
- `notes.piano` = Transkun V2 in the torch island on MPS, chosen and calibrated by P2 piano (`services/ml/eval/results/p2/2026-10-23.md`); `views.yaml` piano gate `pass`, default view `roll`.
- Hand split: heuristic `splitHands` in music-core (Viterbi), documented in doc 21 as the stand-in for PM2S; `buildPianoScore` in the music Worker.
- Piano views: chord chart with keyboard voicings (Chart), falling-notes roll onto a keyboard (Notes), grand staff from alphaTex with two voices per hand (Staff); piano chord levels `simplified` / `as_transcribed`; "Right only" dims the left hand in the roll.

## Goal
Finish piano practice (wait mode, level adaptation; the pipeline gaps are step 24). Drums are step 25.

## Deliverables
1. **Piano pipeline gaps:** moved to step 24 (`s24-piano-accuracy.md`: solo-piano path, Aria-AMT, electric-piano gate, PM2S hands, with the rest of the piano accuracy work). Don't change the piano ML pipeline here.
2. **Piano wait mode (V5, Plus):** Web MIDI on Chromium/Firefox desktop only (feature-detected, hidden where `requestMIDIAccess` is missing, e.g. Safari/iOS); pause the transport at each chord/note event until the expected pitch set is held; octave-insensitive beginner option; hands-separate practice mutes the other hand's notes; works with the roll, the staff and the chart.
3. **Piano level adaptation (V13):** right-hand melody only; left-hand block chords from the chord labels; rhythm simplified to quarter/half notes. Rules live in `music-core/level/` with golden tests per level; the Chart/Notes/Staff views all follow the chosen level.
4. **Drums pipeline and 5. drum view:** moved to step 25 (`s25-drums.md`: test set, ADTOF and other candidates measured, calibrated `notes.drums`, drum grid, drum tab, core-groove level, gate). Don't build drums here.

## Acceptance criteria
- Piano roll stays within one frame of the clock at 60 fps on a mid-range tablet if available (report device and numbers; still unmeasured after step 18).
- Wait mode advances with zero false positives in a scripted 100-event MIDI test (virtual MIDI source in the browser test), and key-press-to-advance latency is under 30 ms (report the measurement).
- Level rules have golden tests per level for piano.
- Flags default off, then on after verification; each feature names its success metric (doc 16); `docs/progress-log.md` updated.

## Verification to run and report
`uv run pytest -k piano`, evaluation report summaries, `pnpm --filter @splitune/music-core test`, web unit/stories/E2E runs, `pnpm --filter @splitune/web budget --enforce` before/after, device notes.
