# Step 18 — v1 practice depth: speed trainer, transpose/capo, fingerings, sections, record-and-compare

## Before you start
Read `prompts/implementation/00-shared-context.md`, then:
- `docs/implementation/21-v1-features.md` V1, V2, V3, V8, V9, V12 (and its personal-mode callout)
- `docs/implementation/07-music-algorithms.md` §5–§7 (alt fingerings, levels, transpose, capo suggestion)
- `docs/implementation/11-audio-engine.md` (transpose, loop events), `docs/implementation/12-practice-screen-and-notation.md`
- `docs/implementation/23-plans-free-and-paid.md` §3 (all of these are Free features)
- `docs/implementation/26-design-system.md`, `27-screens-flows-and-content.md` §5, `28-ui-quality-and-design-review.md` §5 — UI for speed trainer, transpose/capo, fingerings, sections and record-and-compare: compose from the kit, add stories for new states, use catalogue copy (add keys), pass the design QA checklist

Prerequisites: MVP (steps 01–17). Branch `impl/18-practice-depth` from the current `dev`. Ship each feature behind a flag (`feature_flags`). Note: `PROGRESS.md` "Step 18" is the piano notes work (part of prompt 19), not this prompt; read PROGRESS 17c–18a anyway, since the practice screen changed a lot (tab-first redesign, piano views, chord spelling). Some groundwork exists: `SpeedTrainer` in the contracts and loop API with a `speed_trainer` flag, `suggestCapo` in music-core, a manual capo input in `level-toggle.tsx`, `alt_fingerings` in `tab.*`, `set_section` as a correction op. Build on it.

## Goal
Add the v1 practice features that need no new ML: manual speed trainer, transpose with capo suggestions, alternative fingerings and tuning presets, section navigation, record-and-compare and a visual/haptic metronome.

## Deliverables
1. **Speed trainer (V1):** entry in the speed popover (doc 27 §3.7.4), progress shown in `LoopBadge` ("pass 3/4 at 70 %"); settings on loop clips (`start/end/step/plays_per_step/count_in_each_pass`), tempo changes exactly at loop seams, count-in at the upcoming tempo, % and BPM display.
2. **Transpose + capo (V2):** playback-key control (engine transpose, warning beyond ±3 semitones on vocal stems), shapes-key/capo control, "sounds like original key" confirmation, capo suggestion from `music-core`.
3. **Fingerings and tuning (V12):** tap a note to cycle `alt_fingerings`, global easiest/as-played switch, tuning presets (standard, half-step down, drop D, full-step down; bass 4/5-string), capo input — all recomputed in the Worker.
4. **Sections (V3):** enable the `sections` stage (allin1 in the `legacy` island: madmom from git, NATTEN pinned or the optional-NATTEN fork) with a music-core novelty-segmentation fallback; section chips above the timeline (kit `Badge`/`Toggle` styles, labels editable, `Part A/B/C` for the fallback) → loop presets; `set_section` edits.
5. **Record-and-compare (V8):** MediaRecorder take during a loop pass, alignment by measured output latency, A/B or L/R playback vs the reference stem; takes stay on-device by default.
6. **Visual/haptic metronome (V9)** per doc 26 §10: pulse ≤20 mm, luminance change <10%, hard cap 3 flashes/s regardless of tempo or subdivision, never full-screen or red, shape-coded downbeat, static beat counter under reduced motion; `navigator.vibrate` where supported.

## Acceptance criteria
- E2E per feature on 3 engines; tempo-change-at-seam and count-in tests in the audio offline suite; no audible glitch at the seam; trainer state survives reload; transpose keeps displayed chords and tab consistent with audio (test a known song fixture), for guitar, bass and piano views.
- Sections stage runs on the Mac and produces `sections.json`; boundaries snap to downbeats; section label edits persist across reload; fallback path covered by a test.
- Practice route budget passes (`pnpm --filter @splitune/web budget --enforce`, before/after bytes reported); new controls load on demand where they can.
- Flags default off, then on after verification; each feature names its success metric (doc 16); `PROGRESS.md` updated.

## Verification to run and report
Relevant unit/stories/E2E/audio test runs, `uv run pytest -k sections`, the budget check, manual device notes for record-and-compare latency (the owner doesn't play: use a speaker playing a reference take into the mic to measure alignment).
