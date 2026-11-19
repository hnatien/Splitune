---
title: Practice screen and notation rendering
workstream: engineering
last_researched: 2026-11-08
confidence: medium
---

# Practice screen and notation rendering

The screen where learning happens: synchronised notation and chords, bar-snapped loops, the speed ladder, mixer, count-in, confidence-aware fixing, levels and hands-busy controls. Implements M4 (UI), M5–M11, M14, M15 and the P0 patterns in `research/ux/practice-tool-patterns.md`. Audio internals are in `11-audio-engine.md`; algorithms in `07-music-algorithms.md`; regions, sizes, states and copy in `27-screens-flows-and-content.md` §3.7; tokens in `26-design-system.md`.

Updated in step s31a (2026-11-08) for the "Night Rehearsal" redesign (`redesign/report.md`, "The Practice screen: five regions serving one loop"): five regions, the inspector tabs, the new keymap and the practice tools that later steps add. Section numbers are unchanged.

## TL;DR
- **One master clock (audio time) drives everything;** alphaTab (`@coderline/alphatab` 1.8.x) runs with `PlayerMode.EnabledExternalMedia` and only *follows* the time we push with `updatePosition(ms)`. The playhead and the sounding-note highlight are our own layer, moved by `transform` from the audio clock.
- **Five regions serve one loop** (desktop): song map (where am I?), Now column (what do I play now?), notation (which notes?), inspector with **Loop / Mix / Progress / Fix** (how do I practise?), transport dock (control this pass), plus a pass prompt after each pass. Tablets get **Stand view**, phones the glance view and a **Tools** sheet (`27` §3.7).
- **Renderer-agnostic view model:** effective artefacts (`applyCorrections`) → `music-core` tab/level → alphaTex → alphaTab. The song map, Now column, chord sheet, rolls and grids read the same view model.
- **Confidence is shown by outline + "?" + words, never colour alone, never below 4.5:1** (`26` §5); the Fix tab queues unsure spots by consequence.
- **A loop in at most two actions** (tap two bars, a section chip, or "Loop this bar"), median under 3 s; every key or pedal action confirmed within 100 ms.
- **Keys:** speed is `,` / `.` (Shift = 1 %); ↑/↓ never change speed silently; single-key shortcuts can be switched off (WCAG 2.1.4); a pedal wizard maps whatever a pedal sends (§8).

## 1. Layouts
| Device / orientation | Layout | Notes |
|---|---|---|
| Desktop, fine pointer, ≥ 1180 px | Top bar 60 · song map · Now column 264 · notation · inspector 380 · transport dock 96 | `27` §3.7.1, `redesign/mockups/Main.dc.html` |
| Desktop 1024–1179 | Inspector becomes a right drawer ("Tools" in the top bar) | |
| Desktop < 1024 | Also the Now column becomes a strip above the notation | |
| Tablet (coarse pointer, shortest side > 640) | **Stand view** by default (owner decision D4, G1): Now panel 400, one tab system that always fits, four 88 px pedal-mirroring buttons, page turns on the downbeat from the audio clock; "All tools" switches to the full layout with the inspector in a drawer | `Stand.dc.html`; portrait stacks two systems and turns half a page; landscape shows a slice of the next bar |
| Phone portrait | Glance view (current and next chord, beats, loop, speed) with Glance · Tab · Chords; **Tools** sheet for speed, ladder, count-in, click, vibrate, mix, level and capo | `Phone-Practice.dc.html`, `Phone-Tools.dc.html` |
| Phone landscape | Horizontally scrolling tab strip that scrolls only when needed, compact ruler, one transport row | |
| Fix mode (any layout with an inspector) | Top bar shows the "Fixing" pill and Done; the dock plays the selected bars on repeat with Listen to: Original / Your part / Tab synth / Both | `Practice-Fix.dc.html` |

Practice hides navigation chrome and holds a Screen Wake Lock for the whole session, requested again on every `visibilitychange` (`11-audio-engine.md`), with the screen tip when it can't be held. Layout selection uses feature queries (viewport, `(pointer: coarse)`, orientation), never the user agent.

## 2. Component tree (web)
```
PracticeRoute
├─ PracticeProvider     XState actor (§6) + practice store
├─ PracticeTopBar       back · title/part line · view switch · legend chip · Display · Keyboard & pedal · More
├─ SongMap              section chips (V3) · waveform overview · unsure hatch · loop band + handles · now-line · ruler
├─ NowColumn            current chord + shape · BeatPulse (V9) · next chord · then chips · Level / Capo
├─ NotationView         alphaTab host (tab / standard / drum staff) or chord sheet / chart / rolls / grid; overlay: confidence, loop, current bar, playhead
├─ PassPrompt           "Pass n at s — how was it?" Felt clean / Not yet
├─ Inspector            tabs: LoopTab (bars, nudges, SpeedLadder V1, repeats, clips) · MixTab (presets, StemRows, helpers) · ProgressTab · FixTab
├─ TransportDock        restart · play · next · position · loop pill · speed group · count-in · click · mix pill · volume
├─ StandView            (tablet) header · Now panel · one system · pedal dock
├─ GlanceView + ToolsSheet (phone)
├─ VideoPane?           personal mode: local downloaded video, muted, slaved to the master clock
├─ PedalHud             confirmation chip ≤ 100 ms
└─ InputMapper          keyboard + pedal bindings, wizard captures, single-key switch
```
Lazy outside the route budget: Fix, Progress, Tools sheet, Stand view, command palette, every popover body, notation views (`§10`).

## 3. Notation rendering with alphaTab
- **Load path:** `tab.{instrument}` + `chords` + meta → `music-core/export/alphatex.ts` → `api.tex(alphaTex)`. Re-render only changed bars where the API allows; otherwise debounce a full re-render ≤ 150 ms after an edit.
- **Player mode:** alphaTab's synth is **disabled**: `PlayerMode.EnabledExternalMedia` with an `IExternalMediaHandler` whose transport calls are no-ops (the audio engine is the only transport); the engine clock is pushed with `updatePosition(ms)` every frame; tick ↔ time from **sync points** on the beat grid (one per downbeat), so the cursor follows rubato. When the speed changes, the rate path keeps alphaTab's interpolation in step.
- **Clock and playhead:** the playhead, the current-bar wash and the sounding-note fill are our own layers on the compositor, moved with `transform`; position = f(audio clock) read once per frame from `AudioContext.getOutputTimestamp()` (fallback `currentTime` where the output timestamp is unreliable; Safari clock check C3 below), with no extrapolation, so the cursor never overshoots and snaps back (alphaTab #318). Every view (tab, rolls, grid, chord sheet) reads the same clock.
- **Follow modes** (Display → "Notation follows the music"): **Page by page** (default; systems turn as the playhead enters the next one, the current bar always visible, at least one bar of look-ahead), **Scrolling** (fixed now-line, only when necessary), **Off** (for reading and fixing). Pausing stops any scrolling (WCAG 2.2.2). Reduced motion allows Page only and steps the playhead by beat. Stand view turns pages on the downbeat from the audio clock (never in the middle of a system); a pedal turn always wins over the automatic one.
- **Playhead style** (Display): Line (2 px `--playhead`, glow in Night), Block (a small block on the beat, for anyone who finds the line glaring), Bar (shade the current bar only).
- **Rhythm stems** under the tab always (stems and beams in `--faint-foreground`), chord names over the bars (`buildTab({ chordNames: true })`), bar numbers in mono.
- **Confidence styling** (`26` §5): ink via `NoteStyle`; dashed outlines, "?", underlines (edited), the sounding fill and the shaky-bar outline in the overlay positioned from `boundsLookup` (`core.includeNoteBounds = true`); alphaTab's SVG is never styled with CSS. The legend chip shows the unsure count and opens the key and "Show uncertainty".
- **Fonts and colours:** `display.resources` fonts use the reading family (JetBrains Mono digits, or Atkinson Hyperlegible Next) at `--read-tab`; staff, bar and glyph colours come from tokens via `readColor()` and are re-applied on appearance or contrast change. Notation sits on the page in both themes (no paper surface).
- **Wrapper, workers, licence:** `packages/notation` `<AlphaTabView>` owns one `AlphaTabApi`; alphaTab renders in a Web Worker; Bravura self-hosted; alphaTab MPL-2.0 kept unmodified.
- **Left-handed:** chord shapes and the fretboard mirror (not tab text) when `users.handedness = 'left'`.

## 4. Chords, the Fix tab and corrections (M8, M10)
- **Now column:** the current chord large with its shape, "Next · in n beats", then up to five chords; unsure chords dashed with "?"; Level and Capo below. Chord names follow the song's key spelling.
- **Fix tab** (replaces the editor sheet; `27` §3.7.4): entering it (tab, `E`, or tapping a "?") switches to Fix mode. The **queue** holds every unsure spot ranked by consequence (wrong pitch or string/fret, octave error, wrong chord root or quality) and then by probability; a mostly-unsure bar is one "shaky bar" spot. `J` / `K` (and the arrows in the tab) move through it; the selected bars loop at the Fix dock's speed with **Listen to: Original / Your part / Tab synth / Both**.
  - **Chord:** ranked alternatives with frequency wording ("about 1 in 3"), **Hear over the loop** (plays the alternative's voicing with a soft synth over the loop), **Use**, "Type a chord" (Harte-validated), "Split at beat n", Replace all in this song.
  - **Note:** "D4 · string 2, fret 3 ?" with "or play it as" alternatives from `alt_fingerings`, String and Fret steppers, length, **It's right** (`mark_correct` op: removes the mark, keeps the note), Delete note, Report wrong.
  - **Beat:** "Metronome off the beat?" Half tempo · Double tempo · Move downbeat ("This is beat 1"); after a beat fix, quantization re-runs in the browser (`music-core`) and a line states the consequence ("Re-barred 84 bars") with Undo.
  - **Your edits:** the corrections history with Revert per op and a "Show original" switch; edited marks are underlined, never only coloured.
- Every edit = `CorrectionOp` with `client_op_id`, applied optimistically, persisted via `POST /artefacts/{id}/corrections`; undo/redo per session; offline edits queue. "Report wrong" doesn't change the display. Copy says "Your fixes are saved for this song" and never implies the model learns from them.
- **Global fallback:** `recommended_view = chords_only` opens on chords with the banner and "Show tab anyway" (per instrument); with no chords to fall back on, the notation opens under "We're not confident in the notes for this song.".
- **Desktop full editor** (`/songs/$id/edit`) is "Open full editor" in Fix and shares its components.

## 5. Loops and practice loop (M6, M7)
- **Create (≤ 2 actions):** tap bar A then bar B on any notation view, the chord sheet, the song map or the rolls (same bar twice = one bar); tap a **section chip** (V3, when sections exist; "Part A/B/C" names when unnamed); **Loop this bar** in the glance view; `L` loops the current bar (or the sung phrase for vocals) when no loop exists; From/To steppers in the Loop tab; drag the loop handles (secondary); ⌘K "loop 17-20". Pickup-aware snapping (`07` §1).
- **Edit:** From/To steppers (one bar per step), ‹ › sixteenth-note nudges (Fine-tune), **Next phrase** (shift by the loop's own length), **×2** and **÷2**; section chips set the loop exactly to a section.
- **Repeats:** rest between repeats (None / 1 beat / 1 bar), count-in bars (Off / 1 / 2; the model allows 4), "Ask how each pass went before the next" (pauses after a pass until answered).
- **Speed ladder (V1, `21`):** on a loop clip; Start (best clean tempo, else 70 %), Goal (100 %), Step (5 %), clean passes per step (**3**; owner decision D3, G1; a setting), back down one step after n "Not yet" in a row (2; Off allowed), count-in before each pass, at the goal keep looping or stop. The tempo changes exactly at the loop seam and the count-in plays at the upcoming tempo. The ladder is an adjustable default, never presented as science (report); ladder check C2 below may tune the defaults later. **Contract:** the flag `v1.speed_trainer` has been off, so no saved clip should carry a trainer; s37 confirms that with a query, then reinterprets `SpeedTrainer.plays_per_step` as *clean passes per step* (same field, same 1–20 range) and adds `drop_after_misses` (0 = off, 1–5) and `on_goal` (`'keep'` / `'stop'`). If any stored trainer exists, s37 stops and reports instead of reinterpreting it. **As built (s37):** the ladder is off for a new loop until the learner switches it on in the Loop tab, or turns on "On for new loops" in Settings → Practice defaults (owner, 2026-11-11: on by default would slow every new loop and add a count-in before each pass); turning it on never speeds the learner up (a speed below the start becomes the start); the trainer also stores the learner's place (`current_pct`, `clean_count`, `miss_count`). Details in the s37 notes below.
- **Saved clips:** named, listed in the Loop tab and the command palette; the active loop auto-saves as an unnamed clip; **Rename** (PATCH) and **Delete** (DELETE) from each row's menu (s37).
- **Pass tracking:** after each pass the pass prompt "Pass {n} at {speed} — how was it?" asks Felt clean (`C`, hold right pedal) / Not yet (`N`, hold left pedal); every answer is a complete data point (clip, speed, outcome, time) for Progress; `best_clean_tempo_pct` updates. **Progress** (`GET /v1/progress`, s39) shows the 30-day history and the first clean pass of each session; the retention metric is the tempo of the first clean pass in the next session, not minutes.
- **Count-in and click** follow the beat grid; the beat pulse (V9) shows the beat visually; "Metronome off the beat?" fixes live in Fix.

## 6. Player state machine (XState v5)
```mermaid
stateDiagram-v2
  [*] --> Loading
  Loading --> Ready: buffers decoded + artefacts parsed
  Ready --> CountIn: play (count-in on)
  Ready --> Playing: play (count-in off)
  CountIn --> Playing: count-in done
  Playing --> Paused: pause / pedal
  Paused --> Playing: resume
  Playing --> LoopRest: loop end & rest>0
  LoopRest --> CountIn: rest done & count-in on (or ladder count-in each pass)
  LoopRest --> Playing: rest done
  Playing --> Assess: loop end & ask after each pass
  Assess --> CountIn: clean / not yet recorded (ladder may change speed here)
  Playing --> Audition: Fix "Hear over the loop"
  Audition --> Playing: audition done
  Playing --> Ready: stop
```
Context: speed, playback key, loop (start/end s), ladder state (rung, clean count, miss count), mix, view, level, follow mode, inspector tab. Side effects (scheduling audio, speed changes at the seam) live in the audio engine; the machine only sends commands.

## 7. Mixer (M4)
- **Channels:** one row per non-empty stem, "Your part" first and labelled; M / S / level (dB, −30…+6, `gain_to_unity_db` so soloed stems feel equally loud); a "Rough" badge where separation is poor. Today separation keeps the target, drums and bass where kept, and a mix-minus ("Band"); **s40a** keeps every separated stem (bass, drums, guitar, piano, vocals, other) and changes the cache key (owner gate G3); **s40b** shows them all.
- **Helpers:** Click (level + switch), **Hear the chords** (a soft synth plays the transcribed chords; s40b), master volume in the dock.
- **Presets:** **Your part loud** (+6 dB your stem, others −6 dB), **Minus-one** (mute your part → plays `mix_minus_*` when available), **Original** (unity), **Rhythm only** (bass and drums only; shown when both exist); "Use as default for {part}"; Reset mix. The dock's mix pill names the preset and the real stem count; a changed mix marks the Mix tab with a dot.
- **Safety:** a limiter at unity: no preset pushes the master above 0 dBFS (WHO H.870 safe listening, report).
- Changes are instant (gains on the pre-stretch submix bus; `11`). Every fader has a click-to-set track and a stepper (no drag needed, WCAG 2.5.7).
- **Later scope (not s32–s45):** per-drum channels ("Kick only", "Drums minus snare", lane focus) and per-hand piano audio need deeper separation.

## 8. Hands-busy input (M15)
| Action | Default keys | Pedal (after the wizard, preset "Restart loop · Play/pause") | Notes |
|---|---|---|---|
| Play / pause | Space, Enter | Right pedal | |
| Restart loop / back a bar | ←, PageUp | Left pedal | AirTurn mode 3 sends PageUp/PageDown |
| Next bar | →, PageDown | — | |
| Slower / faster 5 % | `,` / `.` (Shift: 1 %) | — | |
| ↑ / ↓ | **No speed change.** Until a pedal is set up, PedalHud shows "Pedal detected? Set it up" (opens the wizard); after setup they act only if the wizard bound them | — | AirTurn BT200S mode 2 and iRig BlueTurn send ↑/↓ out of the box |
| Felt clean / Not yet | `C` / `N` | Hold right / hold left (≥ 0.5 s) | |
| Loop on/off | `L` | — | No loop: loops the current bar (vocals: the phrase) |
| Mute your part | `M` | — | |
| Next / previous unsure spot | `J` / `K` | — | Enters Fix mode |
| Fix the playing bar | `E` | — | |
| Previous / next phrase, first note (vocals) | `[` / `]`, `P` | — | |
| Command palette | ⌘K / Ctrl K | — | Works with single keys off |
| Undo / redo | ⌘/Ctrl Z, Shift ⌘/Ctrl Z | — | |
| Shortcuts overlay | `?` | — | Desktop |
- **Single-key shortcuts** (Settings → Keyboard & pedal, WCAG 2.1.4): one switch, on by default. On: single keys act only while focus is in the practice screen and not in a text field. Off: single keys are inert; modifier chords and learned pedal keys keep working.
- **Pedal wizard** (s43): step 1 "Press your left pedal", step 2 "Now press your right pedal" (each captures whatever key the device sends: ↑/↓, PageUp/PageDown, Space/Enter…), step 3 choose what they do (Restart loop · Play/pause; Not yet · Felt clean; Back a bar · Next bar); a pedal held ≥ 0.5 s does a second action, so two pedals cover four; conflicting default keys are unassigned automatically; "I only have one pedal"; finish in the test area. Saved per device. The per-action "Learn key" table stays for advanced use. No Web MIDI requirement (Safari has none); a MIDI pad is optional where Web MIDI exists.
- **Focus:** the practice route keeps a focus sink so pedal keys never scroll the page or activate the focused control.
- **Targets** (`26` §8, the control's own box): the main practice controls are 64 × 64 in every layout, phones and Fix mode included: Play/Pause (phone 72), restart / back a bar, previous and next bar, speed −/+, the loop toggle or pill, count-in, Felt clean / Not yet. Secondary practice controls (click, mix pill, volume, M/S, view switch, inspector tabs) are 48, everything else 44, Stand view's dock buttons 88; every key or pedal action shows PedalHud within 100 ms ("Speed 75 %", "Loop · bars 5–6", "Left pedal · From the top of the loop").

## 9. Accessibility checklist (practice screen)
WCAG 2.2 AA plus `28` §5: contrast 4.5:1 text / 3:1 graphics in both themes; non-colour cues for confidence, the current bar, the downbeat (square), stems, hands, "Rough" and every on-state; targets per §8; every drag has a single-pointer alternative (2.5.7); the dock, Tools sheet, drawers and pass prompt never fully cover the focused element (2.4.11); single-key shortcuts can be turned off (2.1.4); pausing stops scrolling (2.2.2); no more than 3 flashes a second at any tempo, the beat pulse confined to a small dot, downbeat by shape (2.3.1, 1.4.1); text resize to 200 %; screen-reader labels on all controls with state; a text alternative for notation per bar ("Bar 12: G chord, strum down on 1 and 3; bass notes G2, B2"), read on request, never every note live; processing progress in a polite live region by stage milestone, `role="progressbar"` with `aria-valuetext`, `role="alert"` only for blocking errors.

## 10. Performance budgets (verified in `18-testing-strategy.md` and `28` §3.1)
- Cursor/now-line jitter ≤ 1 frame at 60 fps on a mid-range tablet; no Long Animation Frame from playhead, song-map or roll code during steady playback (Chromium, CPU 4×), compared with the s32 baseline.
- Key, pedal and tap confirmation ≤ 100 ms; p75 practice-action latency ≤ 100 ms.
- Re-render after an edit ≤ 150 ms; capo/level change (Worker recompute + render) ≤ 300 ms; re-quantize after a beat fix with its consequence line ≤ 300 ms.
- **Practice route JS ≤ 320 KB gzip** (`pnpm --filter @splitune/web budget --enforce`; alphaTab and WASM excluded): **318.7 KB of 320 KB, about 1.3 KB left**, measured at `8d6a3f6` before s32. New panels load lazily outside it, and every step reports before/after bytes built the same way; raising it needs the owner.

## Implementation notes (step 12, 2026-10-22)
- `packages/notation`: `.` = light exports (ChordDiagram, types); `./view` = `AlphaTabView` (alphaTab in its worker, `PlayerMode.EnabledExternalMedia`). The external-media handler's `play/pause/seekTo` are **no-ops**: alphaTab calls them on every score reload, which paused playback; the audio engine is the only transport. `output.updatePosition(ms)` runs per frame from the engine clock; sync points come from the beat grid (one per bar). The cursor and current-bar wash are our own layers (underlay z-0: bar wash then loop shading; alphaTab z-10; confidence marks z-20; bar/note buttons z-30) positioned from `boundsLookup`, so they never wait for a re-render.
- Confidence: `NoteStyle` colours (`ink` / `conf-medium` / `conf-low`) plus dashed outlines and a "?" glyph from the overlay (never colour alone); "Show uncertainty" off keeps the ink and drops the outlines/glyphs.
- MVP mixer is **two stems** (isolated part + `mix_minus_<part>`): presets part-loud (+6/−6 dB), minus-one, original; default part 0 dB / backing −6 dB. Per-instrument faders wait for multi-stem output.
- Player: XState machine (`loading → ready → countIn → playing ↔ paused`, `loopRest`, `assess`, `audition`); state persisted with a debounced `PATCH /v1/songs/{id}` (`player_state`).
- Capo/transpose redraw measured 15–66 ms (Chromium 20, WebKit 15–18, Firefox in Docker 51–66) against the 300 ms target.
- Cursor vs audio clock (p95 / worst, audio ms; one frame at 0.7× = 11.67 ms): Chromium 0.54–0.68 / 0.72–0.88, WebKit 0.50–1.10 / 0.90–2.80 — asserted ≤ 1 frame. Firefox (Linux container, software rendering) 11.7–11.8 / 12.3–18.2 — reported, not asserted.
- alphaTab always draws "rendered by alphaTab" under the score (no setting); left as is.
- Not built: profile sync of learned pedal keys (localStorage only), YouTube embed fallback (see doc 13).

## Implementation notes (step 18b, 2026-10-24)
- Guitar and bass Notes read the clock like the tab: note times are the tab's quantized positions on the beat grid (`tickOfPosition` → `tickToTime`), so the lanes, the neck and the tab cursor agree. The lanes' canvas and the neck's state each read `audio.position()` once per frame.
- **Loop seam:** inside a loop the lanes draw past the loop's end into its next pass (each pass clipped at the end), and the neck takes the loop start's window in the loop's last half second, so the wrap neither blanks nor moves anything. A clock jump over 0.25 s between frames counts as a seek: the neck re-frames at once.
- Notes load through the chord-sheet chunk (12 §10, 7.96 KB gzip); route JS 310,392 B of the 310 KB budget (317,440 B; raised by the owner on 2026-10-24), +335 B over `dev` built in the same checkout path (build output varies by path, so only same-path builds compare).


## Implementation notes (step 18c, 2026-10-24)
- Vocals' notes load with the summary (they have no tab), go through corrections in the Worker (`buildMelody`, music-core) and keep their sung timing: no quantization, since phrasing off the beat is what a singer copies. The Worker also returns the phrases, the range and the key's scale.
- The roll and the strip each read `audio.position()` once per frame; the strip's state changes only when the phrase, the next phrase or the beat count does. Inside a loop the roll draws the next pass past the loop's end (`rollStretches`, shared with the guitar lanes), and the past to the left of the now line as it was.
- The melody and the phrase strip load through the chord-sheet and chord-strip chunks (12 §10).

## Implementation notes (step 25, 2026-10-28)
- **Drums' views:** Grid / Staff / Chords on the status bar's view switch.
  - Grid is the default once the hits pass the quality gate. Below it the chord sheet opens with "Show notes anyway".
  - Both views load lazily through the chord sheet's chunk.
- **Grid** (`drum-notes.tsx` over `@splitune/notation` `DrumGrid`, a canvas drawn from the clock):
  - Five lanes named down the left in the DOM: Cymbals, Hi-hat, Toms, Snare, Kick, top to bottom as on a drum staff.
  - Time runs left to right past a playhead a quarter of the way in, two bars in view. With reduced motion it pages two bars at a time.
  - Bar numbers, faint beat lines, the loop band. A click loops bars like a chart tap.
  - Kit-piece guesses (`approximate`) and medium or low hits are hollow and dashed; low ones add "?".
  - A flam has a small grace block. Lanes holding several pieces letter them (o, p, C, R, H, M, L, F), with a key under the grid.
- **Staff** (`drum-staff.tsx`): music-core's drum staff alphaTex in the tab's `AlphaTabView`. The hit map becomes its note map, and a guess is marked medium.
- **Levels:** Main groove / Simplified / As played in the level popover, which is titled "Level" and has no capo for drums. They are computed in the music Worker (`buildDrumScore`).
  - The `level_changed` analytics enum and the route's `?level=` gained `core_groove`.
- **Data:**
  - `notes.drums` is read with the `DrumNotes` schema once the summary exists.
  - The screen holds the analysis status until the hits are in the music, as for piano.
  - Drum hits have no editor ops, so the corrections history lists none.
- **Mixer:** unchanged. The drum stem and its mix-minus are the two channels, so "Minus one" is the band without the drums, and the count-in click is the player's.
- **Onboarding** keeps Drums as "Coming soon", as it does for piano: its song step needs an example song for the instrument, and there is no drum example yet.
- **Route budget** (`pnpm budget`, production build): 317.1 KB gzip after vs 317.0 KB before, of 320 KB. The grid and staff chunks load outside it.

## Implementation notes (practice-screen fixes, 2026-11-04)
All in `model/screen.ts` (`resolveScreen`, table-tested in `screen.test.ts`) and `model/resume.ts`; owner-approved after a Storybook check of each.
- **Level popover:** the capo field is guitar's only (it fits guitar's chord shapes); bass, like drums, gets "Level" with no capo icon.
- **Chord strip:** renders only when it has something in it: the chords, the phrases over vocals' melody, or the options at its end (level, Piano options), which phones leave out. A phone with a tab or drum hits and no chords has no strip. Piano's falling notes without chords get a strip with Piano options holding only Show hands (phones: none, as with chords).
- **Chords-only without chords:** the recommendation holds the notation back only while there are chords to show instead; otherwise the notation shows (vocals with the phrase strip) under `practice.notes_unsure`.
- **Saved view (13 §5):** `player_state.view` is `chords_only` once the learner chooses Chords and `tab` once they choose a notation or "Show tab anyway"; nothing until they choose. Resume (and `?view=tab|chords`) restores it: `tab` as "Show tab anyway", `chords` as the Chords view. Notes and Staff stay session-only and open as the first notation next time.

## Implementation notes (step s35, 2026-11-10)
- **Regions:** fine pointers get the five regions (`practice-page.tsx` `DesktopRegions`; `layout.ts` `useDesktopRegions`: inspector docked at ≥ 1180, the Now column at ≥ 1024, else a strip; the volume and the Mix pill's words in the dock at ≥ 1440, the width `Main.dc.html` is drawn at; below, an icon and a popover, so the loop pill keeps its words). Coarse pointers keep the earlier arrangement (`CompactRegions`, `transport-bar.tsx`) until s43. While Getting ready shows, the inspector is a drawer at every width.
- **Inspector:** `practice-store.ts` holds `tab` (`loop` · `mix` · `progress` · `fix`, remembered in `localStorage` `splitune.inspector-tab`; `?tab=` on the route wins), `inspectorOpen` and `openTab(tab)`; J / K / E and the editor open Fix.
- **Keymap (§8):** `model/keymap.ts` `resolveKey(event, learned, singleKeys)` → an action (with `fine` for Shift), the pedal hint, or nothing. ↑/↓ map to no action; until a pedal key is learned they return the hint. `singleKeys` off leaves Space, Enter, arrows, PageUp / PageDown, learned keys and modifier chords working.
- **Follow (§3):** page turns are decided once per bar from scroller geometry cached by a ResizeObserver and scroll events; the scroll is applied in a task after the frame (`scrollAfterFrame`). The perf record shows no forced layout on desktop and 6 small ones (6.8 ms in the window, against 606 / 73 ms before) on the tablet context, at the loop's page turn. Reduced motion: page turns, a stepped playhead, no smooth scroll; pausing stops scrolling.
- **Pass prompt:** shown after every pass while a loop is active (`promptPass` > 0), lazy-loaded with its sheet.
- **Mixer (§7):** presets and faders go through `limitToUnity`: the loudest audible stem plays at 0 dB.
- **Route budget (§10):** 309.2 KB gzip after vs 304.2 KB before (`dev` at `b61d0f7`), of 320 KB. The inspector and its tabs, the Now column, Getting ready, the Display popover body, the pass prompt and the narrow dock's volume popover load lazily.

## Implementation notes (step s37, 2026-11-11)
- **Ladder rules** (`model/ladder.ts`, pure): rungs are Start, each Step above it and the Goal (the last step is shorter when the step doesn't divide the range). The rung is the player's speed: a speed set by hand stands on the highest rung at or below it, and its counts start over. Clean passes at a rung add up (a miss doesn't undo them); the nth moves up one rung. The nth "Not yet" in a row moves down one rung, never below the start; a clean pass ends the run of misses; 0 turns the rule off. At the goal the count stays at n: "Keep looping" goes on, "Stop" ends the loop at the seam (back to the loop's start, paused) and says "Goal reached · 100 %".
- **Machine (§6):** context holds `ladder` (settings, clean, misses), `pendingSpeed`, `finishing`, and counters the provider turns into the PedalHud line ("Speed 80 % · ladder"). `ASSESSED` became `PASS_RATED { outcome }`, sent for every Felt clean / Not yet; `SET_LADDER` sets or clears the ladder; `SET_SPEED` by the learner resets the counts and drops a pending move.
- **Seam rule (21 V1 accept):** a move decided while a pass plays is kept as `pendingSpeed`; the loop becomes gapped for that one wrap (`setLoop(null)` + `setStopAt(loop.end)`), so the engine pauses sample-accurately at the loop end (audio-engine `transport.test.ts`, "pauses where the heard position crosses stopAt, once"); the machine then sets the rate, seeks to the loop start and plays, with the count-in asked for after the rate, so it plays at the upcoming tempo. With a rest, the pass prompt or the ladder's count-in before each pass the loop is gapped anyway and the rate changes in the same place. Rated during the count-in between two passes (the engine holds at the loop start): the count-in starts again at the new tempo. Rated while stopped (ready, paused): the rate is set at once. No engine change was needed. `player-machine.test.ts` asserts the order of engine commands for each case; `e2e/speed-ladder.spec.ts` shows the readout staying at 75 % until the seam with the real engine.
- **Count-in with a ladder:** "Count-in before each pass" (the ladder's own setting, on by default) decides the count-in between passes while a ladder is on; the dock's count-in switch still decides it without one, and either starts playback with a count-in.
- **Persistence:** the provider writes the trainer (settings and place) on the clip after every rating, move or setting change (debounced 300 ms; a new loop's first save carries it, and a ladder set before the clip has an id is saved once it does). Choosing a saved clip (`selectClip`: the Loop tab's rows, ⌘K and resume) loads its bars, rest, count-in, ladder and the speed it was left at, instead of copying its range into a new unnamed clip as before.
- **Flag:** `v1.speed_trainer` now defaults on and acts as a kill switch; the web reads `me.flags` for the first time (guests use the declared default). Off: no ladder card, no goal in the readout, clips load without their ladder.
- **Saved clips:** Rename is inline and optimistic with an Undo toast, rolled back with an error toast if the server refuses. Delete hides the row at once and is sent when its Undo toast closes or the page hides (`clip-actions.ts`), so Undo brings back the same clip with its best clean pass. "Save this loop" shows only for the unnamed loop being played.
- **Route budget (§10):** 311.4 KB gzip after vs 309.1 KB before (`dev` at `cf76235`), of 320 KB. The ladder card, its steppers and the clip actions load with the Loop tab; the rules, the machine and the provider's wiring are in the route.

## Implementation notes (step s38, 2026-11-17)
- **Queue** (`model/fix-queue.ts`, pure): one spot per unsure chord, per unsure note outside a shaky bar, and per shaky bar (the spots the Fix badge and the legend chip already counted). Consequence classes, most costly first: `pitch` (an unsure note, a shaky bar), `octave` (an unsure note the tab had to move by octaves), `chord-root` (the second guess has another root), `chord-quality` (it keeps the root, or there is no second guess). Inside a class: the likelier the guess is wrong (1 − calibrated confidence; a shaky bar the mean over its unsure notes), then song order. Notes carry no alternative pitch, so "octave" comes from the tab's own placement fact.
- **Frequency wording** (`model/frequency.ts`): `oneIn(probability)` and `wrongOneIn(confidence | confidences)` round with `oneInBand` (s35), the nearest of 1 in 2 / 3 / 4 / 5 / 10 / 20 as a ratio; the boundaries are the geometric means of neighbours. A band's line ("Unsure: we'd guess wrong about 1 time in n") speaks from the mean confidence of the song's own unsure marks.
- **Fix mode** is the Fix tab being open (`practice-store.ts` `fixing`; `openTab('fix')`, `fixCommand` for J / K / E, `leaveFix` for Done and Esc). It is entered, never resumed: the remembered tab is the one used before it; `?tab=fix` enters it. Its controller, key line, dock and pill are `fix-mode.tsx`, loaded on entry. Tablets and phones have no inspector until s43: a chord tap or E opens the same cards in the editor sheet, without the queue, the loop or Listen to.
- **The player in Fix mode:** on entry (after the saved loop and speed are restored, `practice.resumed`) the controller keeps the learner's loop, loop switch, speed, rest, pass prompt and ladder, and sets no ladder, no rest, no prompt and the Fix dock's own speed (kept for the session). The selected bars are sent as the machine's loop directly (no clip is saved, no pass is counted for Progress; C / N and M do nothing while fixing). Done, Esc or another tab pauses and puts everything back. The machine is unchanged.
- **Audition (§6):** the synth is practice code (`fix-synth.ts` over `model/synth-schedule.ts`), on the engine's own `AudioContext`. Every 30 ms it reads the heard position, the rate and the loop from the engine and schedules the events of the next 150 ms at `currentTime + (t − position) / rate`; a loop wrap moves its horizon back by the loop's length, a seek or a pause resets it. So it holds the loop at any speed with no engine change. "Hear {chord} over the loop" strikes the alternative's voicing (guitar: the first chord shape, above the capo; else the tones stacked over the bass) on every beat the chord covers and starts playback; Listen to **Tab synth** and **Both** play the transcribed notes at their played times. Listen to maps to the stems as: Original = unity, Your part = the isolated stem alone, Tab synth = stems silent, Both = your part with the synth. "Hear bar" is still the machine's `audition` state (the bar once, original mix); "Hear the tab" plays the bar's notes once on their own.
- **It's right:** `mark_correct` on the note or chord (a shaky bar: on each of its unsure notes, one Undo). music-core doesn't read that op, so the mark is taken off in the view model (`model/confirmed.ts`): an entity is confirmed while its last `mark_correct` isn't followed by a `report_wrong` with the comment `undo:mark_correct`, which is what Undo and Revert append (the overlay has no op that takes a confirmation back).
- **Revert and Undo of a sent op** append the inverse, and music-core gives an edited entity confidence 1: the label or fret comes back, the unsure mark doesn't. Undo of an op still in the outbox drops it, and the mark returns.
- **Replace all in this song:** offered in the chord card right after a change, while other chords still hold the label (and bass) the changed one had; one `set_chord` per chord, one toast, one Undo for all. **Show original:** a switch in Your edits; the music is computed without any correction and the cards give way to a line saying so.
- **Desktop editor** (`/songs/$id/edit`): Fix mode on a page of its own from the same components; ← / → step through all notes, J / K through the spots, Delete removes the selected note. Touch devices go to Practice with `?tab=fix`, which opens the first unsure bar in the editor sheet.
- **Route budget (§10):** 312.2 KB gzip after vs 311.4 KB before (`dev` at `92c0d38`), of 320 KB. Fix mode, its cards, the history, the synth, the queue and the frequency wording load on entry; the 0.8 KB are the store's Fix state, the Listen-to mix, the confirmed marks and the detailed save toast in the provider.

## Implementation notes (step s39, 2026-11-19)
- **Metrics** (`features/practice/model/progress-metrics.ts`, pure, local calendar days in the runtime's time zone): a session's minutes run from its start to its end, to its last pass when the end never arrived (a closed tab), or to now for the session open on this screen; per clip and session the passes, clean passes, best clean pass and the first clean pass ("cold"); the Last 30 days chart is one point per session with a clean pass; **the success metric** `nextSessionRetention` is the first clean pass of the latest session that follows a session on an earlier day, beside that day's best (16). This week sums the last seven local days (a day with a pass counts as at least one minute; a day only opened doesn't count); "+n % on {clip}" compares a clip's best clean pass of the seven days with its best before them within the 31-day answer (or its first clean pass of the week when it is new). Worth a revisit: clips with a best clean tempo whose last attempt is 5 or more local days ago, up to three, the most recent first.
- **Progress tab** (`progress-tab.tsx`, lazy): "Clip" + the clip's name (an unnamed clip shows "Bars 25–28") + its bars; the Last 30 days card (`ui/progress-chart.tsx`: best clean pass solid ink with round markers, the cold pass dashed `--muted-foreground` with square markers, text alternative "Best clean speed rose from 60 to 80 percent over 9 sessions. First clean pass rose from 50 to 70 percent."); three stat cards (`ui/stat-card.tsx`): cold start today, clean passes / passes today, minutes of the song today; Sessions rows newest first with the session's minutes, the clip's passes and best. Passes the outbox hasn't sent show at once (`withPending`); a sent flush refetches, and so does every progress view as it mounts (an answer cached by the library before the passes would otherwise stand).
- **Warm up chip** (no mockup; placed for G4): an outline pill at the top of the tab on the song's first session of a day after an earlier day, "Warm up with yesterday's hard bars" (or "last session's" after a longer break); it loops the clip with the most "Not yet" on that earlier day (then the slowest best) and goes once that clip is looped.
- **Weekly goal** (owner, 2026-11-19): off by default, a number of days a week (1–7, default 3) on this device only (`progress-goal.ts`, localStorage); on, the tab says "{n} of {goal} days this week" (calendar week from Monday). No reminders, no streaks.
- **Resume:** URL bars that are exactly a saved clip's bars open that clip (`?loop=3-4` from Worth a revisit), so its passes, ladder and history carry on.
- **Route budget (§10):** 312.4 KB gzip after vs 311.8 KB before (`dev` at `b3db5c9`), of 320 KB. The tab, chart, stat cards, metrics and copy load with the tab; the 0.6 KB are the outbox's pending read and change listeners, now a chunk shared with the library.

## Open questions
- Page vs Scroll as the default follow mode at different tempos (QX13); Page is the default until tested.
- Whether one sync point per downbeat is precise enough for live takes with strong drift, or per-beat sync points are needed (measure cursor error on the owned live-take set).
- Safari clock check **C3**: whether `getOutputTimestamp()` is reliable on Safari (measure the playhead offset against the audio) or the `currentTime` fallback is needed there.
- Ladder check **C2**: whether step size and clean passes per step change the first clean pass next session (in-app A/B). The checks C1–C3 are research checks from `redesign/report.md` "Research and testing gates" (there G2, G5, G7), not the owner gates G1–G6.

## Sources
Cross-linked: `redesign/report.md` (five regions, transport, keymap, loops, ladder, Fix, Progress, Stand view, phones), `redesign/research/practice_science_ergonomics.md`, `redesign/research/stem_practice_players.md`, `redesign/research/notation_learning_apps.md`, `research/ux/practice-tool-patterns.md` (Patterns 1–7), `research/ux/music-display-ui.md` (alphaTab, confidence UI, scrolling modes, left-handed), `research/ux/hands-busy-and-device-context.md` (targets, pedals, distance), `research/ux/accessibility.md` (WCAG 2.2 AA), `research/product/recommendations-and-decisions.md` D13, `05-analysis-schema.md`, `07-music-algorithms.md`. [AirTurn BT200S manual](https://manualslib.com/manual/1986862/Airturn-Bt200s-Series.html?page=13) (mode 2 sends ↑/↓), [alphaTab #318](https://github.com/CoderLine/alphaTab/issues/318), [MDN getOutputTimestamp](https://developer.mozilla.org/docs/Web/API/AudioContext/getOutputTimestamp).
