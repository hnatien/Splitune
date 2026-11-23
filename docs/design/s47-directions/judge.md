# s47 directions: judge's report

I scored three directions: A "Calm workspace", B "Instrument" and C "Score-first". I read all three
rationales, the audit's top 10 and its before-scores, and the guidelines' merged checklist. For each
direction I looked at the same states (practice default, loop + pass prompt, mixer open and chords
view, library populated, import analysing), each at 1440 and at 375, alternating Dark and Light. I
also spot-checked choose source, ready, empty and every extra (B: pedal page, practice-mode pedal,
practise while analysing; C: keys and pedal, one bar tapped, keyboard count-in). Paths below are
relative to `docs/design/s47-directions/`.

Note on the fixtures: B's fixture has rests and a bend, and the three songs differ in bar count. That
makes B's tab look busier than the others. I made allowance for it where it matters.

## Scores

| Criterion | A Calm workspace | B Instrument | C Score-first |
|---|---|---|---|
| 1. Speed to start practising | 3 | 4 | 5 |
| 2. Hierarchy without colour | 5 | 2 | 4 |
| 3. Keyboard and pedal | 3 | 5 | 4 |
| 4. Legibility of notation and tab | 4 | 3 | 4 |
| 5. Phone vs desktop density | 4 | 3 | 4 |
| 6. Accessibility margin above AA | 4 | 5 | 3 |
| 7. Cost to implement and maintain | 4 | 2 | 3 |
| **Total** | **27** | **24** | **27** |

## Evidence per criterion

### 1. Speed to start practising
- **A (3).** A 4-bar loop at 70 % with a count-in takes 5 clicks, 5 taps or 6 keys (`4`, `S`, `7`,
  `0`, ↵, Space). I verified the 6-key path: it ends on "Count-in · 1 of 4", bars 1–4, 70 %.
  Library → playing is "Resume practice ↵", and an import opens practice as soon as the upload ends
  (`a/import--analysing-part-question--light--1440.png`). Both are fast. The loop path is the
  slowest of the three, because typing the speed costs three keys.
- **B (4).** The loop takes 3 clicks, 4 taps or 3 keys (`4`, `⇧7`, Space). I verified the keys:
  bars 6–9 at 70 % with the count-in running. The library deck plays in one press (Enter). Import
  adds a page, though: "Start practising now (P)" comes after the stage list, and Ready is a page of
  its own (`b/import--analysing-part-question--dark--1440.png`, `b/import--ready--light--1440.png`).
- **C (5).** The loop takes 3 / 4 / 3 actions. I verified `L`, `7`, Space (bars 1–4, 70 %,
  "Count-in 1 of 4"). A drag or two taps on the score makes the loop, and the contextual bar puts
  70 % right there. Import opens the practice screen at once, and Ready is a one-line banner over it
  (`c/import--ready--dark--375.png`).

### 2. Clarity of hierarchy without colour
- **A (5).** Play is the only fill on the practice screen and "Resume practice" the only fill in the
  library. Chrome is muted text with no fill, and selection is an ink edge everywhere
  (`a/practice--default--dark--1440.png`, `a/library--populated-all-statuses--dark--1440.png`).
  - The library groups songs by what they need: Getting ready / Needs you / Ready to practise.
  - Weak spot 1: the outlined Count-in pill reads heavier than Loop, which has no edge at rest.
  - Weak spot 2: the loop wash and the current-bar wash are close in value
    (`a/practice--loop-pass-prompt--light--1440.png`).
- **B (2).** Every state is an inversion, so a practice view carries six to seven filled keys: Tab,
  Loop, 70, 1 bar, Part loud, Bars and Play (`b/practice--loop-pass-prompt--light--1440.png`).
  - The control surface is 207 px of equally weighted keys, and nothing in it leads.
  - The library's light chassis shows three fills (Add song, All, Last practised) plus the deck's
    Play (`b/library--populated-all-statuses--light--1440.png`).
  - Choose source has two fills (`b/import--choose-source--light--1440.png`).
  - This breaks the checklist's "exactly one filled ink pill".
- **C (4).** The music clearly leads (`c/practice--default--dark--1440.png`). The loop reads as a lit
  passage on a veiled page. The cost is extra fills and duplicated toggles:
  - choices are inverted (Tab, 70 %, the mix preset), so Play is not alone;
  - Loop and Count-in appear twice, in the contextual bar and in the dock
    (`c/practice--loop-pass-prompt--light--1440.png`);
  - the phone mixer shows four fills (`c/practice--mixer-open--light--375.png`).

### 3. Keyboard and pedal ergonomics
- **A (3).** Every action has a key, ⌘K lists them all with the pedal map, and the HUD confirms each
  press. Three problems:
  - The loop path needs a typed field.
  - The left pedal's double press is ambiguous. The first press already runs "back a bar" or
    "restart", and the second then toggles the loop (`apps/web/app/prototypes/a/practice.tsx`
    lines 363–367). So a quick "back two bars" turns the loop on, and a double press loops from the
    wrong bar.
  - `S` moves focus into a text field mid-session.
- **B (5).** This is the most discoverable map: the key cap is printed on every control
  (`b/practice--default--dark--1440.png`).
  - Loop lengths are `1 2 4 8`, ⇧←/⇧→ move the loop by a phrase, and ⇧5…⇧0 are speed presets
    (read by `event.code`, so they work on any layout).
  - The pedal soft-key labels change with context, and Practice mode adds "hold to move the loop"
    (`b/practice--pedal-practice-mode--light--1440.png`, `b/practice--pedal-page--dark--375.png`).
  - Risk 1: Esc goes back to the library when no panel is open, so a stray Esc leaves practice.
  - Risk 2: the pedal defaults to Bars mode, so the hands-free session needs `F` first.
- **C (4).** The map is simple and conflict-free:
  - digits set speed in tens, `L` loops four bars, ⇧←/→ stretch the loop, `?` opens the sheet;
  - "left means again, right means go" is the clearest pedal model of the three
    (`c/practice--keys-and-pedal--dark--1440.png`).
  - Keys are discoverable only through that sheet and the caps in the contextual bar.
  - The only loop lengths are 4 bars or a stretch.

### 4. Legibility of notation and tab
- **A (4).** Digits are large and well spaced. The loop has a bracket with a "Bars 5–8 · 70 %" label,
  and the playhead is a 2 px ink line.
  - About 70 px of blank paper sits above the first system at 1440, and about 110 px at 375.
  - Bar numbers 13–16 are orphaned at the bottom of the screen, above the key row
    (`a/practice--default--dark--1440.png`).
  - The "rendered by alphaTab" credit shows (`a/practice--mixer-open--dark--1440.png`).
  - At 375, the sixteenth-note pairs crowd ("1 1", "2 2" in bar 5,
    `a/practice--default--light--375.png`).
- **B (3).** The paper has the least room: 63.3 % at 1440 and 57.1 % at 375.
  - The third system is cut mid-digit (`b/practice--loop-pass-prompt--light--1440.png`).
  - At 375, rest glyphs collide with digits (`b/practice--default--light--375.png`, bars 5–8;
    partly the fixture).
  - The dashed box plus orange "?" is the most visible unsure mark of the three.
- **C (4).** This is the most music on screen (75.4 % / 73.3 %), with chord names printed over the tab
  and the sounding digits inverted (`c/practice--default--light--375.png`). Two problems hold it back:
  - The contextual bar sits on the notation itself in four of the screenshots:
    - `c/practice--loop-pass-prompt--light--1440.png` (bars 1–4);
    - `c/practice--one-bar-tapped--light--1440.png` (bottom strings of bars 6–8);
    - `c/practice--keyboard-count-in--dark--1440.png` (bars 5–7, the next line to read);
    - `c/practice--chords-view--light--1440.png` (bars 9–11 and the Verse label).
  - The veil makes reading ahead hard: I compute it at about 3.0:1 in Light and 3.3:1 in Dark.

### 5. Density on phone vs desktop
- **A (4).** Each form factor gets its own layout: a status row for the pass prompt, two transport
  rows, and ⋯ for everything else (`a/practice--loop-pass-prompt--dark--375.png`). The phone library
  is a good stacked list (`a/library--populated-all-statuses--light--375.png`). Two defects:
  - the phone mixer sheet covers the transport (`a/practice--mixer-open--light--375.png`);
  - the phone count-in is a metronome icon with a bare "1".
- **B (3).** The phone module selector is clever: every module is one tab away and shows its value
  (`b/practice--chords-view--light--375.png`). But:
  - on desktop, 207 px of surface plus a 60 px display line squeeze the paper;
  - on the phone library, the filters push the first song down to about y = 530
    (`b/library--populated-all-statuses--dark--375.png`).
- **C (4).** Both default layouts are excellent at 1440 and 375. Three places fall short:
  - with the pass prompt, the phone dock grows to about 320 px, leaving about 1.5 systems
    (`c/practice--loop-pass-prompt--dark--375.png`);
  - the phone library shows one song above the fold (`c/library--populated--light--375.png`);
  - the desktop mixer is an overlay that covers the right-hand bars instead of reflowing them
    (`c/practice--mixer-open--dark--1440.png`).

### 6. Accessibility margin above AA
- **A (4).** The token margins are solid: dimmed chrome ≥ 4.8:1, selection ≥ 14:1, staff
  3.3–3.5:1, and confidence carries a dash plus "?". The weak points:
  - the top-bar Tab and Chords buttons measure 45×32 and 66×32 px, under the project's 44 px floor
    (the rationale's "44 px target" is not in the box);
  - the song-map chips are 24 px, which is the allowed exception.
- **B (5).** This has the widest margin:
  - every practice key is ≥ 48 px and every browse key ≥ 44 px (measured: only the song-map keys,
    26–28 px, and the waveform slider are smaller);
  - inversion is ≥ 14.7:1, and LEDs show toggle state by shape;
  - disabled controls use a dashed edge and words, never opacity;
  - focus never sits under the fixed surface;
  - one thin spot: text-3 is 4.7:1.
- **C (3).** Tokens and targets are good (ink3 ≥ 7.1:1, everything else ≥ 44 px), but the signature
  veil puts every tab digit outside the loop at about 3.0:1 (Light) or 3.3:1 (Dark). That is below
  1.4.3's 4.5:1 for 16–18 px text. The contextual bar can also cover focused bars (2.4.11 risk).

### 7. Cost to implement and maintain
None of the three uses `apps/web/app/ui`: each is about 5.5–5.9k lines with its own CSS (2,356 /
2,025 / 1,818 lines), so all of them mean a system rewrite.
- **A (4).** A's patterns carry to the other ~55 screens with the fewest new ideas:
  - hairline rows, one side panel, popovers and ⌘K, which already exists in the app (the audit
    scores the command palette 4);
  - the renderer is touched only through role variables, a few scoped overrides and `barsPerRow`.
- **B (2).** B needs a new component family (keys with caps, lips and LEDs; segment meters; a
  module grid that re-wraps below 1,400 px). That family fits settings, auth and marketing poorly.
  It also needs 16 `!important` rules, and a new set of modules for each instrument.
- **C (3).** Browse screens are simple, but practice adds its own layer over alphaTab:
  - the veil, the selection and the contextual-bar placement come from `boundsLookup` plus a
    `ResizeObserver` (`apps/web/app/prototypes/c/score.tsx`);
  - that layer has to be rebuilt for the chord chart, piano, drums and vocals;
  - the library strips need waveform and section data for every song in the list.

## Strongest and weakest point of each

| | Strongest | Weakest |
|---|---|---|
| A | The calmest, clearest hierarchy, with one fill per view; it also generalises best to the rest of the app. | The slowest loop setup (6 keys, 5 clicks) and an ambiguous double-press pedal. |
| B | Keyboard and pedal discoverability (caps printed on every key, live pedal soft keys) and the widest accessibility margin. | It looks like a console, not music: 6–7 fills per view and the least notation on screen. |
| C | The most music on screen, and loops made on the score in 3 actions. | The contextual bar and the veil cover or dim the music the learner needs to read next. |

## Defects seen in the screenshots

- **A**
  - Blank band above the first system (`a/practice--default--dark--1440.png`, `…--light--375.png`).
  - Orphaned bar numbers 13–16 above the key row (`a/practice--default--dark--1440.png`).
  - The alphaTab credit is visible (`a/practice--mixer-open--dark--1440.png`).
  - The phone mixer covers the transport (`a/practice--mixer-open--light--375.png`).
  - The phone count-in is unlabelled ("1").
  - Sixteenth-note digits crowd at 375.
  - The phone chord grid has no right gutter (`a/practice--chords-view--dark--375.png`).
  - Top-bar tabs are 32 px tall.
- **B**
  - Too many fills (`b/practice--loop-pass-prompt--light--1440.png`).
  - The third system is cut mid-digit at 1440.
  - Rests collide with digits at 375 (`b/practice--default--light--375.png`).
  - The mix presets appear twice, in the mixer and on the surface
    (`b/practice--mixer-open--light--1440.png`).
  - The phone library spends half the screen on filters
    (`b/library--populated-all-statuses--dark--375.png`).
  - Choose source has two fills.
  - Import takes an extra page before practice can start.
  - Esc leaves practice.
- **C**
  - The contextual bar sits on the notation in four of the screenshots: loop + pass prompt,
    one bar tapped, keyboard count-in and the chords view (all named under criterion 4).
  - Veiled digits are at about 3.0–3.3:1.
  - The phone dock grows to about 320 px with the prompt (`c/practice--loop-pass-prompt--dark--375.png`).
  - The desktop mixer covers bars instead of reflowing them.
  - The phone library shows one song above the fold.
  - Keyboard caps C and N are shown on the phone.
  - The phone Loop and Count-in toggles are icon only.
  - Below 375 px the transport overflows (the team says so itself).

## Pick: A, "Calm workspace"

A and C tie at 27. I pick A, for four reasons:

1. **C's defects are part of its concept; A's are parameters.** C's contextual bar and veil are its
   identity, and they are exactly what covers the music (4 screenshots) and drops it below 4.5:1.
   A's slow loop is a key-map gap that a few bindings close.
2. **A has the best hierarchy without colour.** It is the only direction that keeps one filled
   action per view across practice, library and import. That is the system rule the audit found
   drifting (problem 10), and the failure B shows most.
3. **A costs the least across the whole app.** Its patterns (hairline rows, one panel, popovers,
   ⌘K) fit the other ~55 screens and the piano, drums and vocals views without a new component
   family (B) or a renderer overlay layer (C).
4. **The music still clearly leads.** A gives the notation 73.5 % of the screen at 1440 and 64 %
   at 375, against 40 % and 0 % before. It reaches C's 75 % once the blank band above the first
   system is trimmed.

### What A should borrow

- **From C**
  - Digits for speed, or B's ⇧-digits (see below). That brings the keyboard loop to 3 keys.
  - The drag or two-tap selection with speed presets next to it. Put it in A's transport, not
    floating over the score.
  - Chord names printed over the tab.
  - "Left means again, right means go" as the pedal model, replacing A's double press.
  - The music strip and the resume clip's chord line in the library.
  - Trim the paper's top padding to reach about 75 %.
  - The phone "Bar 6 of 32" readout in the title line.
- **From B**
  - Key caps printed on the practice controls, at least on desktop.
  - Live pedal soft-key labels, plus "hold a pedal to move the loop by a phrase".
  - ⇧5…⇧0 speed presets, so A can keep `1 2 4 8` for loop lengths: `4`, `⇧7`, Space is 3 keys.
  - LED dots (hollow or filled) on toggles.
  - Disabled controls drawn as a dashed edge plus "after …", never opacity.
  - The phone module selector, as the fix for A's mixer sheet covering the transport.
  - The 44 / 48 px target discipline, to fix A's 32 px top-bar tabs.

## Ties and near-ties

- **A vs C (27 each).**
  - Criterion 7 (cost) or criterion 2 (hierarchy) breaks the tie toward A.
  - Criterion 1 (speed) breaks it toward C.
  - Criterion 6 would swing to C if its veil were raised to ≥ 4.5:1 and the contextual bar docked
    into the transport. At that point C largely becomes A with C's selection model.
- **B is 3 behind.** It wins keyboard and accessibility outright, but the fills per view
  (criterion 2) and the system cost (criterion 7) sink it.

## Verified, and what I could not judge

**What I verified.** I loaded each `Default` story in headless Chromium with the repo's Playwright
(script `/private/tmp/claude-501/-Users-hnt--claude-spares-spare-9PXLiD/fddaf2b5-0cab-4b23-be56-0e9f6ff8b7e3/scratchpad/judge/check.mjs`).
- Notation share matches every claim except A at 375, which I measured at 64.0 % against the
  claimed 64.5 %:

  | | Claimed | Measured |
  |---|---|---|
  | A | 73.5 % / 64.5 % | 73.5 % / 64.0 % |
  | B | 63.3 % / 57.1 % | 63.3 % / 57.1 % |
  | C | 75.4 % / 73.3 % | 75.4 % / 73.3 % |

- The keyboard loop flows run as claimed: A in 6 keys, B in 3, C in 3.
- Targets under 44 px outside the score: only the song-map chips and sliders in B and C. A adds its
  32 px top-bar tabs and chips.
- I computed the contrast of C's veil myself (about 3.0:1 Light, about 3.3:1 Dark).

**What I could not judge.**
- **Not checked by me.** Mouse and phone action counts. Focus rings, which no screenshot shows: each
  team's focus claim is unverified by me. Any pixel-measured contrast beyond the veil (all teams
  computed from tokens).
- **Not built in any prototype.** Audio, and with it count-in timing, playhead feel and
  slow-down quality. Real pedal hardware, and whether a double press or a hold is reliable on it.
  The piano, drums and vocals views. Screen readers.
- **Covered unevenly.**
  - Widths of 768 and 1024: only C claims to have checked them, and only B shows its wrapping
    surface (in prose).
  - Fixtures differ between teams (B has rests, 24 vs 32 bars), so the notation density comparison
    is approximate.
