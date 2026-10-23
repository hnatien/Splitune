# Step 21 — Guitar and bass Notes view: a string highway onto a live fretboard

## Before you start
Read `prompts/implementation/00-shared-context.md`, then:
- `docs/implementation/PROGRESS.md` entries for steps **17c** (guitar practice redesign), **17d**, **18** (piano falling-notes roll) and **18a** (piano staff). This step is the guitar counterpart of step 18; reuse its patterns rather than inventing new ones.
- `docs/implementation/26-design-system.md` §4.4 (stems, strings, hands: **strings use numbers, not colour**), §5 (confidence encoding), §6.3 (reading sizes by distance preset), §8 (targets), §10 (motion: tokens, functional motion only, reduced motion, flash safety), and the implementation notes for steps 17c, 17d and 18.
- `docs/implementation/27-screens-flows-and-content.md` §3.7 (practice layouts, glance view, progressive states) and §5 (practice copy, message catalogue). `docs/implementation/28-ui-quality-and-design-review.md` §5 (design QA checklist).
- `docs/implementation/12-practice-screen-and-notation.md` §3 (one clock, look-ahead), §10 (route budget). `docs/implementation/11-audio-engine.md` (clock, loops, count-in, rate).
- `docs/implementation/05-analysis-schema.md` and `packages/contracts/src/analysis/tab.ts` (`TabEvent`: `string` 1 = highest, `fret`, `alt_fingerings`, `unplayable`, `tuning_midi`, `capo`, `level`).
- Research: `docs/ux/music-display-ui.md` (tab is the guitar convention; piano-roll evidence is piano-only; left-handed mirroring), `docs/ux/practice-tool-patterns.md`, `docs/ux/hands-busy-and-device-context.md`, `docs/ux/accessibility.md`.
- Code to study first: `apps/web/app/features/practice/piano-notes.tsx`, `packages/notation/src/piano-roll.tsx`, `packages/notation/src/keyboard-diagram.tsx`, `packages/notation/src/geometry.ts`, `packages/notation/src/chord-diagram.tsx`, `apps/web/app/features/practice/status-bar.tsx`, `practice-store.ts`, `practice-page.tsx`, `notation-pane.tsx`, `glance-view.tsx`, `score-theme.ts`, `practice.stories.tsx`, `practice-story-data.ts`, the music Worker and `model/view-model.ts`, and `apps/web/scripts/bundle-budget.mjs`.

Prerequisites: MVP (steps 01–17) and the piano work on `dev` (PROGRESS steps 17c–18a). Branch `impl/21-guitar-notes` from the current `dev`. No ML, API or contract changes are expected: everything the view needs is already in `tab.guitar` / `tab.bass` and the beat grid. If you find you need a contract change, stop and explain why first.

## Goal
Guitar and bass get a third practice view, **Notes**, as easy to follow as piano's falling-notes roll: the transcribed part moves toward a fretboard that lights exactly where your fingers go now, on the same audio clock as the tab, chord strip, loop and transport. It must look like a finished, calm, premium product — the "Music Stand" system, not a game — with motion that is smooth, exact and never distracting.

## Phase 1 — Design first (stop for the owner's choice)
1. **Short research pass** (subagent is fine): how Rocksmith, Yousician, Songsterr, Soundslice, Fender Play and GuitarTuna-style apps show moving guitar notes and the fretboard; what learners say helps or hurts (chasing notes, readability at a stand, position shifts, chords vs single notes, bass). Cite sources with tier and date like the other docs; say plainly where evidence is thin (there is no controlled study for guitar highways — don't claim one).
2. **Mockups** of 2–3 directions, built as Storybook stories or a throwaway HTML canvas using the real tokens and a real `tab.guitar` (fixture or the owner's local analysis), each in Light, Dark and Stage at tablet landscape 1180 × 820 and phone landscape 844 × 390. Directions to compare at least:
   - **A. Horizontal string lanes** (tab-oriented: string 1 on top as in tab, or mirrored option), notes travel right → left onto a vertical neck/hit line at the left; fret numbers ride on the notes.
   - **B. Vertical highway** falling onto a horizontal fretboard strip below (same metaphor as piano's roll + keyboard, so the two instruments feel like one product).
   - Reject a 3D perspective highway unless you can show it stays readable at the Stand distance preset and within the frame budget; say why either way.
3. Present the mockups to the owner with a recommendation and the trade-offs (readability, look-ahead, screen use on phones, how chords and position shifts read). **Do not build Phase 2 until the owner picks one.** Record the choice and date in `PROGRESS.md`.

## Phase 2 — Build the chosen design

### Deliverables
1. **`packages/notation`: `GuitarRoll` (canvas) + `FretboardDiagram` (SVG)**, mirroring `PianoRoll` / `KeyboardDiagram`:
   - Shared geometry module (like `keyboardKeys`): fret positions with real proportions (12th-root-of-2 spacing, compressed so frets 0–12 stay usable; window follows the part's fret range with smooth, eased re-framing on position shifts, never a jump), string spacing, nut, capo bar, inlay dots (3, 5, 7, 9, 12 double), string count from `tuning_midi` (6/7-string guitar, 4/5-string bass), open strings at the nut.
   - Notes: fret number on every note in the reading family at the distance preset size (doc 26 §6.3), sustain tails for held notes, chord events grouped as one shape with its chord name (`ChordSymbol` spelling from the Worker), open strings and muted/unplayable marks (`unplayable` = "!" or 8va/8vb marker, a placement fact, never a dashed outline). Bends/slides only if present in the data; don't invent techniques.
   - Fretboard strip lights the fretted positions sounding now (finger dots with fret number), and previews the **next** shape faintly (ghost dots) so the hand can move early; position-shift cue when the next note leaves the current window.
   - Strings are told apart by **position and string number/name labels**, not colour (doc 26 §4.4). Use the `--stem-guitar` / `--stem-bass` hue as the instrument's accent only, with the outline carrying contrast like the piano roll. Any new colour is a tier-3 token in `@splitune/ui-tokens` for every appearance + forced colours, with contrast pairs added to `CONTRAST_PAIRS` and the CVD test passing.
   - Confidence per doc 26 §5: dashed `--conf-medium` / `--conf-low` outline, "?" on low notes, legend chip behaviour unchanged; "Show uncertainty" off hides the marks.
   - Left-handed mirroring from `me.handedness` (like `ChordDiagram`): neck mirrored, numbers never mirrored.
2. **Motion — smooth, exact, calm** (this is the point of the step):
   - Position is a pure function of `audio.position()` read **once per animation frame** (one clock, 12 §3): no React state per frame, no easing on the time → position mapping, no drift between roll, fretboard, tab cursor and chord strip. Canvas sized for `devicePixelRatio`, layers cached (static lanes/frets on an offscreen layer), only moving content redrawn; no allocation in the frame loop.
   - Seamless at every seam: **loop wrap** shows the next pass's notes beyond the loop end before the wrap, so it never jumps or blanks; **seek** and bar taps re-frame in one frame; **count-in** shows the first notes approaching at the upcoming tempo; **speed change** changes velocity without a jump; pause freezes exactly; resume has no catch-up stutter; resize/rotate re-lays out without a flash.
   - Landing feedback: a short, small acknowledgement when a note reaches the hit line (within doc 26 §10 flash safety: ≤ 20 mm, < 10 % luminance change, hard cap 3 flashes/s across the whole view, never red, never full-screen). No decorative motion, particles, glow trails or celebration.
   - View switch Tab ↔ Notes ↔ Chords uses the existing transition pattern (View Transitions as progressive enhancement, `--duration-slower`), keeping transport, chord strip and loop in place with no layout shift.
   - **Reduced motion** (`prefers-reduced-motion` or Settings): the highway turns a bar group at a time (page-flip) and only the playhead moves, like the piano roll; landing feedback off.
   - Target: 60 fps, cursor/roll within one frame of the clock on desktop Chrome; measure and report frame times (p50/p95) for a dense part (e.g. the owner's longest guitar analysis) and report on an iPad/iPhone if available.
3. **Web integration:**
   - Guitar and bass status bar: **Tab / Notes / Chords** (reuse the piano `Notes` message key; add catalogue keys only where needed). `view` in `practice-store` stays session-only like piano. Default view unchanged (Tab) unless the owner asks otherwise.
   - Lazy chunk like `piano-notes.tsx` (loaded only when Notes is chosen), outside the route budget: **the practice route has ~61 B left** (`pnpm --filter @splitune/web budget --enforce`), so free bytes first if the switch needs any, and report before/after numbers built the same way.
   - Practice actions all work in Notes: tap/click a bar region to set A then B loop (and the loop panel from the keyboard), loop band + A/B rail, pass counter, speed, count-in, mixer, level toggle (simplified/as transcribed; bass roots/full), capo and tuning changes recompute through the Worker and the highway follows, editor sheet opens on a note tap like on the tab.
   - Layouts per doc 27 §3.7: tablet landscape (primary), tablet portrait, desktop, phone landscape (no layout must leave the paper unusable — see step 18's 844 × 390 note), phone portrait keeps the glance view. Stage appearance, distance presets, safe areas, bottom transport on touch.
   - Accessibility: the canvas is `aria-hidden`; an accessible live description of the current position like piano's "Sounding now: …" (e.g. "Bar 12: A minor; string 2 fret 1, string 3 fret 2"), throttled so screen readers aren't flooded; keyboard and pedal operable; forced colours readable; WCAG 2.2 AA contrast for every mark.
   - Analytics: `view_changed` accepts `notes` for guitar/bass (check the existing enum).
4. **Stories** (`practice.stories.tsx`, Kit/Notation): `GuitarNotes`, `GuitarNotesLoop` (wrap continuity), `GuitarNotesChords` (strummed shapes), `GuitarNotesShift` (position shift + ghost preview), `GuitarNotesUncertain`, `GuitarNotesLeftHanded`, `GuitarNotesDark`, `GuitarNotesStage`, `GuitarNotesReducedMotion`, `BassNotes` (4- and 5-string), `GuitarNotesCapo`, plus `FretboardDiagram` states in Notation. Play functions assert the switch order and pressed state, accessible text, loop by two taps, and that the view stays in step with a scripted clock.
5. **Docs:** "Implementation notes (step 21)" in docs 26 (tokens, geometry, motion rules), 27 (view, copy keys) and 12 if the clock/seam handling changed; update `docs/ux/music-display-ui.md` only with sourced findings from Phase 1.

## Out of scope
Mic scoring or note detection, alternative-fingering cycling UI (V12), speed trainer, sections, drums, any change to transcription models or the tab builder's fret choices (report problems you see instead).

## Acceptance criteria
- Owner approved one direction from the Phase 1 mockups before build (quote and date in `PROGRESS.md`).
- Notes view for guitar and bass on real analyses in the local app: notes reach the hit line exactly when heard (checked against the shared clock, not by ear), fretboard lights match the tab cursor's notes, loop wrap / seek / count-in / speed change show no jump or blank frame.
- Frame budget: one-frame sync and 60 fps on desktop Chrome with p50/p95 frame times reported; device numbers if a tablet is available, otherwise say so.
- Reduced motion, left-handed, Stage, forced colours and the distance presets all checked.
- `pnpm --filter @splitune/web budget --enforce` passes with before/after bytes reported.
- Design QA checklist (doc 28 §5) passed for the Notes view in Light, Dark and Stage at tablet landscape, phone landscape and desktop.

## Verification to run and report
`pnpm lint`, `pnpm typecheck`, `pnpm --filter @splitune/notation test`, `pnpm --filter @splitune/music-core test` (if touched), `pnpm --filter @splitune/ui-tokens test` (if tokens added), `pnpm --filter @splitune/web test`, `pnpm --filter @splitune/web test:stories`, `pnpm --filter @splitune/web budget --enforce`, `pnpm --filter @splitune/web e2e -- --grep practice` (add a guitar Notes case), visual baselines via `pnpm --filter @splitune/web e2e:visual:update` if Docker is available (otherwise say they weren't updated), frame-time numbers, screenshots of each appearance shared with the owner, and the end-to-end check on a real song in the local app.
