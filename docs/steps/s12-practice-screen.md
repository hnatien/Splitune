# Step 12 — Practice screen (notation, loops, mixer, editing, pedals, video)

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/specs/12-practice-screen-and-notation.md` (primary spec — layouts, component tree, alphaTab external-media sync, confidence styling, loops, state machine, mixer, pedals, a11y, budgets)
- `docs/specs/13-import-onboarding-and-youtube-embed.md` §6, §6a (local video sync; embed fallback)
- `docs/specs/07-music-algorithms.md` (Worker-side `buildTab`, corrections)
- `docs/specs/11-audio-engine.md` README/API from step 11
- `docs/specs/27-screens-flows-and-content.md` §3.7, §4, §5.6 (practice regions per layout, bottom transport on touch, glance view, progressive states, overlays, practice copy)
- `docs/specs/26-design-system.md` §5 (confidence encoding), §6.3 (reading sizes by distance), §8 (targets), §10 (motion, flash cap), §12.2 (`WaveformTimeline`, overlay, kit components from step 10a)
- Research: `docs/research/ux/practice-tool-patterns.md`, `docs/research/ux/music-display-ui.md`, `docs/research/ux/hands-busy-and-device-context.md`, `docs/research/ux/accessibility.md`

Prerequisites: Steps 05, 09, 10, 11.

## Goal
The `/songs/$songId/practice` route where learning happens: synchronized tab + chord strip driven by the audio clock, bar-tap loops with pass counter, speed and count-in, mixer presets, confidence-aware editing with corrections sync, level toggle, keyboard/pedal control, and the local video pane for URL imports.

## Deliverables
1. **`packages/notation`:** `<AlphaTabView>` wrapper owning one `AlphaTabApi` (alphaTab 1.8, worker rendering, self-hosted fonts), `PlayerMode.EnabledExternalMedia` with an `IExternalMediaHandler` bridging to the engine, `updatePosition(ms)` from a rAF loop, sync points generated from the effective beat grid, confidence encoding per doc 26 §5 (ink via alphaTab `NoteStyle`, dashed outlines and "?" glyphs in an overlay positioned from `boundsLookup` with `includeNoteBounds`; never opacity that drops digits below 4.5:1) with legend and toggle, `display.resources` fonts/colours from tokens via `readToken()` and re-applied on appearance change, bar tap → seek/loop events, left-handed mirroring for diagrams.
2. **Practice route** components per doc 12 §2, composed from the step 10a kit (`TransportButton`, `SpeedControl` with presets 50/70/85/100, `LoopBadge`, `PassControl`, `ChordChip`, `ConfidenceLegend`, `StemRow`, `MixPresetGroup`, `PedalHud`): status bar (song, loop badge, upload pill, ⚙ Display popover per doc 27 §3.7.4), TransportBar, ChordStrip, NotationView, Timeline (waveform peaks, sections placeholder, loop clips, +/- zoom), MixerDrawer (M/S/volume, presets "Your part loud" / "Minus-one" / "Original", rough-stem warnings, "Your part" first), LevelToggle, EditorSheet per doc 27 §3.7.4 (top-k alternatives with frequency text, type a chord, split at beat, note steppers, "Hear this bar" / "Hear the tab", report wrong, Undo toast), PassCounter ("Felt clean / Not yet", best clean tempo), InputMapper (default keys per doc 12 §8 + "learn this pedal", plus the **Settings → Keyboard & pedal** section and the `?` shortcuts overlay on desktop), VideoPane (local video muted, rate = engine rate, re-seek on loop wrap and drift >80 ms, overlay toggle; embed fallback with syncpoints).
3. **Player state machine** (XState v5) per doc 12 §6; side effects only through the engine API.
4. **`music-core` Worker:** effective artefacts (corrections applied), re-run `buildTab` on capo/level/fingering/beat-grid changes, memoized by versions.
5. **Persistence:** corrections via `POST /v1/artefacts/{id}/corrections` with `client_op_id` (optimistic, offline queue in IndexedDB), loops CRUD, practice sessions/attempts via `/v1/practice/sync`, `player_state` debounced PATCH; undo/redo per session. Add any missing API handlers to `apps/api` using the existing contracts.
6. **Edit route** `/songs/$songId/edit` per doc 27 §3.8 (desktop two-pane: notation + inspector with alternatives and per-op corrections history with revert; touch devices redirect to practice with the editor sheet).
7. **Layouts** per doc 27 §3.7 for tablet landscape (primary), tablet portrait, phone landscape, phone portrait (glance view), desktop and local video; bottom transport on touch devices with safe-area padding; reading sizes from the distance preset + calibration; `PedalHud` feedback; progressive states (doc 27 §3.7.3) without layout shift; Stage appearance (plus the one-time "Practising in the dark? Try Stage" hint after 20:00 local time, doc 26 §2); Screen Wake Lock on entry; reduced-motion page-flip mode. `WaveformTimeline` (canvas: peak + RMS lanes, bar ruler, loop band with ≥44 px handles, unsure-bar hatching, now-line) with stories.
8. **Global fallback** banner when `summary.recommended_view = chords_only` with "Show tab anyway".

## Out of scope
Speed trainer, transpose UI, sections, piano/drums views, mic features (v1 steps).

## Acceptance criteria
- Playwright on 3 engines (with mock artefacts + real engine): open a song → play → tap bars 3 and 4 → loop runs with count-in → set 70% → mark "Felt clean" via keyboard only → reload → loop, speed, mix and correction persist.
- Cursor follows audio: measured cursor-vs-clock error ≤1 frame at 60 fps on desktop Chrome; report numbers on an iPad/iPhone if available.
- Edit a chord and a note (from the editor sheet and from `/edit` on desktop) → reload → edits persist; `report_wrong` stored; capo change recomputes tab in ≤300 ms (report timing).
- Progressive states: with mock artefacts released one by one (beats → stems → chords → tab), each layer appears per doc 27 §3.7.3 and the transport never moves (layout-shift check in the E2E).
- axe clean (no serious/critical); all practice actions reachable by keyboard; contrast tokens pass.
- Practice route JS ≤300 KB gzip excluding alphaTab and WASM (enforce in CI).
- Design QA checklist (doc 28 §5) passed for the practice screen in Light, Dark and Stage on tablet landscape, phone portrait and desktop, including the reading-distance checks at a real stand if a tablet is available.

## Verification to run and report
`pnpm --filter web e2e -- --grep practice`, `pnpm --filter notation test`, bundle-size check output, timing numbers, axe summary, manual check on at least one touch device (state which).
