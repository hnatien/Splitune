# Direction A: Calm workspace

## The idea

Splitune is a workspace you return to every day, so it should feel like a quiet desk rather than
a mixing console. The chrome is dimmed: navigation and tools are muted text with no fill at rest,
there are few separators, and structure comes from position and spacing. The music and the task
take the ink. A screen has at most one side panel (the mixer, or the analysis while a song is
getting ready). Everything else is summoned with ⌘K, a popover or a single key, and each action
shows its key next to it. Lists use hairline rows, not card grids. There is one selection
treatment everywhere, an ink edge (or a check mark in lists). Play is the only filled control on
the practice screen, and "Resume practice" the only one in the library.

## Screens

### Practice

**Desktop (1440 × 900).** From top to bottom:

- A 52 px top bar. On the left, a muted "‹ Library" link. Then the title at 500 and one meta line
  (part · key · BPM · bars). In the centre, compact rounded Tab / Chords tabs with the key `V`. On
  the right, a quiet "? 6 unsure `U`" chip that opens the marks legend, and "Actions `⌘K`".
- A 62 px song map. Section chips sit over a waveform (Intro, Verse, Chorus, Outro; a click loops
  that section). The loop is an ink-edged band, the playhead a 2 px ink line, and the part already
  played is drawn darker. Drag to scrub by bar; ←/→ step a bar when the map has focus.
- The notation, from edge to edge: the real alphaTab view at 4 bars per system, plus a 32 px key
  row (unsure, probably, sounding, and "Tap two bars to loop · `4` loops four bars from here").
- An 81 px transport.
  - Left: From the top, Previous bar, Play (64 px, filled), Next bar, and the readout "Bar 6.3 / 24"
    with the time under it. During a count-in the readout becomes a large count ("2", "Count-in ·
    2 of 4").
  - Centre: the Loop toggle ("Bars 5–8 `L`") and the loop line ("Bars 5–8 · pass 3 · 1 clean"). The
    pass prompt takes this place after each looped pass, so it never covers the music. While it
    asks, the transport's secondary labels step aside to make room for it.
  - Right: Count-in (Off / 1 bar / 2 bars, `I`), Speed (− / "70 % · 70 BPM" / +; the readout opens
    presets and a typed field), and Mix ("Your part loud", `X`).
- The mixer opens as the single right panel (340 px). It lists the presets as rows with a check,
  then one row per stem: colour rule and name, "Your part" / "Rough ⚠" tags, M and S buttons
  (48 px), a fader, and a readout in words ("+6 dB", "Muted", "Not heard", "· solo").

**Phone (375 × 812).** From top to bottom:

- A 48 px top bar: back, title with meta, Tab / Chords, and ⋯, which opens the same palette with
  every action and key, so nothing is out of reach.
- A 52 px song map with 24 px section chips.
- The notation at 2 bars per system, set through alphaTab's own `barsPerRow` on the view handle.
- A 56 px status row, which holds the loop line or, after a pass, "How was pass 3? [Not yet]
  [✓ Felt clean]" at 48 px.
- Two transport rows: Loop · Count-in · − speed + on the first, and Mix · ⏮ · Play 64 · ⏭ · From the
  top on the second.
- The mixer becomes a bottom sheet over the notation, with solo included.

Nothing overflows: the capture script checks every element against the viewport.

**Chords view.** A "Now / Next" strip with chord diagrams (`ChordDiagram` from
`@splitune/notation`), then the bars in rows of four under section headings. Every cell is a bar
button, so the A-then-B tap loop works here too. The current bar has a wash and a 2 px ink
underline. The loop has an ink top rail and a "Loop" label on its first bar. Unsure chords get a
dashed box and "?".

### Library

**Desktop.** A 232 px side panel with muted navigation (the current item has a 2 px ink edge),
"Add song `A`", recent songs, and the worker status. The main column (max 1,080 px) has:

- a sticky header: "Library", Actions `⌘K`, and Add song `A`;
- a tools row: instrument filter as compact tabs with counts, search (`/`), and a sort menu;
- a "Continue" block: the clip's title, bars and speed goal, its four chords as a small chord line,
  and the one filled "Resume practice ↵";
- the songs as hairline rows, grouped by what each needs. "Getting ready" holds analysing (with a
  progress ring, the stage, the ETA and a bar) and queued. "Needs you" holds failed (Replace
  file), stems expired (Re-create stems) and upload not finished (Resume upload). "Ready to
  practise" holds ready (best clean pass) and chords only (Analyse fully).

Each row shows the title, then artist · instrument · key · BPM · length, then status, action, when
last practised, and a ⋯ menu.

**Phone.** No side panel and a bottom navigation bar. The search field is full width at 16 px. The
instrument filter becomes a menu button instead of a clipped chip row. Each row shows the title on
up to two lines, the meta, and the status with its action under them.

**Empty.** No box: an icon, an h2, one sentence, the three sources (file, link, record), one filled
"Add song", and "Try an example song".

### Import to ready

1. **Choose source.** A summoned dialog over the library (a bottom sheet on phones) with compact
   File / Link / Record tabs and nothing else to decide.
   - **File** focuses "Choose an audio file" (a real file picker) first, with "Use the sample file"
     for the demo.
   - **Link** validates on blur and on submit. Errors appear inline with an icon and
     `aria-describedby`, and focus returns to the field. Submit is never disabled in advance.
   - **Record** runs a simulated take with a timer, a level meter whose track meets 3:1, "Record
     again" and "Use this take".
2. **Uploading.** Determinate progress with % and MB, and "practice opens when this finishes".
3. **Practice opens at once.** The analysis takes the one side panel on desktop and a strip with
   Details on phones. The panel shows the ETA as a padded range ("about 3–6 min") that changes only
   when a stage finishes, a determinate bar, and eight named stages. Each stage says what it
   unlocks and, once done, "Unlocked: …". When the instrument tagger finishes, "Is guitar the part
   you play?" appears above the stage list: "Yes, guitar `Y`" or "Pick another". Separation waits
   for the answer ("Waiting for you") instead of guessing.

   Every unlock is real in the prototype:
   - Play and speed work from the first second.
   - Bars, sections, loops and count-in arrive with the beat; before that they show
     "Unavailable · …".
   - The mixer and Mute my part arrive with the stems.
   - Chord names fill the chord sheet when the chords stage is done.
   - The Tab tab is disabled until the tab is built. Then a quiet line says "The tab is ready ·
     Show tab `V`", and the view does not switch under the learner.
4. **Ready.** The panel reads "Ready to practise · Tab, chords, 6 stems" with every stage marked
   Done. "Close this panel `Esc`" closes it.

Timers are simulated: one typical minute runs in about 2.5 s.

## Tokens and type

All tokens live in `apps/web/app/prototypes/a/proto-a.css`, scoped to
`.proto-a[data-theme=dark|light]`. Both themes use one set of role names; only the values differ.

| Role | Dark | Light | Use |
|---|---|---|---|
| `--a-bg` | #0f0f0f | #fbfbfb | page and notation paper |
| `--a-panel` | #141414 | #f5f5f5 | the one side panel |
| `--a-raised` | #1a1a1a | #ffffff | popovers, palette, sheets |
| `--a-hover` | #202020 | #eeeeee | hover, one step up |
| `--a-ink` | #f0f0f0 (16.8:1) | #141414 (17.8:1) | text, notation ink, selection, focus, playhead |
| `--a-ink-2` | #bababa (9.9:1) | #474747 (9.0:1) | secondary text |
| `--a-ink-3` | #939393 (6.2:1) | #686868 (5.4:1) | dimmed chrome; ≥ 4.8:1 on every surface it sits on |
| `--a-line` | #232323 | #e8e8e8 | decorative hairlines only |
| `--a-edge` | #6e6e6e (3.8:1) | #858585 (3.6:1) | a control's only boundary, slider tracks |
| `--a-staff` | #6a6a6a (3.5:1) | #8a8a8a (3.3:1) | staff and bar lines |
| `--a-wash` | #1c1c1c | #f0f0f0 | current bar, always with a 2 px ink underline |
| `--a-unsure` | #82abff (8.4:1) | #2a5bd0 (5.8:1) | unsure marks, always with a dashed box and "?" |
| `--a-ok` / `--a-bad` | #63c98f / #ff8a80 | #1b7445 / #c2362b | status glyphs only |
| `--a-stem-*` | six hues | six hues | the 4 px stem rule, always next to the stem's name |

Ratios are against `--a-bg`. Every surface, text and line token has zero chroma. The app's
notation role names (`--paper`, `--ink`, `--bar-current`, `--unsure`, `--score-loop-edge`, …) are
pointed at these roles inside `.proto-a`, so the shared alphaTab view draws with A's ink without
being edited. A few scoped overrides adjust its overlay:

- the current bar gets an inset 2 px ink underline;
- the "?" is 12 px at weight 500;
- "probably" uses a dotted box, so it differs from unsure by shape;
- the loop badge uses weight 500.

**Type.** Figtree at 400 (text role) and 500 (label role) only:

| Size / line height | Use |
|---|---|
| 12/16 | captions |
| 13/18 | secondary labels |
| 14/20 | chrome |
| 15/22 | body |
| 17/24 | titles, readouts |
| 22/28 | headings, ETA |
| 28/34 | count-in |
| 30–40 | chord names in the Chords view |

The only exception is the alphaTab tab digits, which the renderer draws in Figtree bold, the
notation reading exception from the guidelines' Conflicts §1. `kbd` hints are 11 px, the smallest
size used. Every changing number uses `tabular-nums`. Fields are 16 px on phones. Radii: 6 / 10 /
14 px, and pills on every control.

## Selection, focus and confidence without colour

- **Selected or current** is drawn with ink, never with a grey fill:
  - tabs, toggles and pills get a 1.5 px ink edge, ≥ 14:1, plus `aria-selected`, `aria-pressed`
    or `aria-checked`;
  - menu and preset rows get a check plus the ink edge;
  - the current nav item gets a 2 px ink edge;
  - the current section chip gets a 2 px ink underline;
  - M and S invert when on (filled ink with a bg-coloured letter);
  - the current bar has a 2 px ink underline as well as its wash, and the playhead is a 2 px ink
    line;
  - the loop has ink brackets or rails plus `aria-pressed` on its bars;
  - the bar waiting for its partner after the first tap has a dashed ink outline.
- **Focus** is a 2 px solid ink outline at a 2 px offset (fields draw it on the field, not
  twice). A keyboard walk through the phone practice screen with the pass prompt open reached
  every control with a visible ring, and `elementFromPoint` found none covered by another layer.
- **Confidence.**
  - An unsure note has a dashed box and a "?" (12 px, weight 500), with the unsure hue as an extra
    cue.
  - "Probably" has a dotted grey box.
  - The note's ink never changes colour, and "Show unsure marks" off (`U`) leaves plain ink.
  - Unsure chords get the same dashed box and "?".
  - The legend popover explains all three marks with samples, gives the counts, and holds the
    toggle.
- **Status** in the library and the analysis is always a glyph plus words. The glyphs differ by
  shape: a check in a circle, a progress ring, a dotted circle, a triangle with "!", a box with
  lines, a struck clock, a dashed tray. Green and red only add to the glyph.
- **Soloing** dims the other stems to 45 % opacity, and their readouts say "Not heard".

## Keyboard and pedal

**Existing keys (`model/keymap.ts`, through `resolveKey` and `ignoredTarget`):**

| Key | Action |
|---|---|
| Space / Enter | Play or pause |
| ← / → | Previous or next bar (stays inside an active loop) |
| `,` / `.` | Slower or faster by 5 %; with Shift, 1 % |
| L | Loop on or off |
| M | Mute my part |
| C / N | Felt clean / Not yet |

Space on a focused bar plays instead of re-arming the loop. ↑ / ↓ say "Pedal? Page Up / Page Down
drive practice".

**New in A:**

| Key | Action |
|---|---|
| `1` `2` `4` `8` | Loop that many bars from the current bar, and turn the loop on: the proposed one-key loop |
| ⇧→ / ⇧← | Make the loop one bar longer or shorter |
| L with no loop | Loop the 4-bar phrase the playhead is in |
| R or Home | From the top of the loop or the song |
| S | Open speed with the typed field focused and selected ("70 ↵") |
| I | Count-in: off, 1 bar, 2 bars |
| X | Open or close the mixer |
| V | Switch between Tab and Chords |
| U | Show or hide unsure marks |
| ? or ⌘K | The palette: every action with its key, the sections as loop targets, mix presets, and the pedal map |
| Esc | Close popovers or cancel the first tap of a loop |

In bar focus, ←/→ move between bars and Enter taps. Every key and pedal press shows a HUD within
100 ms in the top-right corner, outside the music, for example "Key 4 · Loop bars 1–4" or
"Pedal ▶ · Pause".

**Two-button pedal.** The pedal sends Page Up / Page Down, or the arrow keys if you choose so in
⌘K. What each side does depends on the moment, and a legend in the transport shows it live
("◀ Loop start · Play ▶"):

| When | Left (◀) | Right (▶) |
|---|---|---|
| Paused or playing | Back a bar, or to the loop start while looping | Play or pause |
| Double press | Loop the 4-bar phrase, or turn the loop off | — |
| After a looped pass | Not yet | Felt clean |

A whole session therefore runs on two feet: double-press left to loop the phrase, press right to
play, then after each pass right for "Felt clean" or left for "Not yet". The pedal never changes
speed; that is kept for the hands, as in the existing map.

## Measured

Measurements come from Playwright against the running Storybook, at deviceScaleFactor 1, on the
`Default` story.

- **Notation share at 1440 × 900:** the alphaTab view is 1416 × 673 px, which is **73.5 %** of the
  viewport (74.8 % with its key row). The chrome is a 52 px top bar, a 62 px song map and an 81 px
  transport.
- **Notation share at 375 × 812:** the alphaTab view is 375 × 524 px, which is **64.5 %**. The
  chrome is a 48 px top bar, a 52 px map, a 56 px status row and a 132 px transport.
- **A 4-bar loop at 70 % with a count-in, playing.** The count-in is on at 1 bar by default, the
  same default as today.

  | Input | Actions | Steps | Checked |
  |---|---|---|---|
  | Mouse | **5** | bar 1, bar 4, speed readout, "70", Play | scripted |
  | Mouse, if the 4 bars are a section | 4 | section chip, readout, "70", Play | not scripted |
  | Phone taps | **5** | the same as the mouse path | scripted |
  | Keyboard only | **6** | `4`, `S`, `7`, `0`, ↵, Space | scripted |
  | Keyboard without the typed field | 8 | `4`, `,` × 6, Space | not scripted |

  The mouse, phone and keyboard paths each ended with the count-in running on a looped bars 1–4 at
  70 %.
- **Targets.**
  - Transport buttons are 48 px and Play is 64 px.
  - Pills, stem M/S and the pass buttons are 48 px.
  - Top-bar tabs and chips have a 32 px face with a 44 px target.
  - Song-map section chips are 24 px, the exception the guidelines allow for the song map.

## Limits

- The clock is simulated. There is no audio, and the mixer, mute and count-in change only state
  and the HUD.
- alphaTab's own top padding (room for the loop bracket) leaves about 70 px of blank paper above
  the first system.
- The renderer prints its "rendered by alphaTab" credit after the last bar.
- Piano, drums and vocals views are not part of this prototype.
