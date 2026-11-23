# Direction C: Score-first

## The idea

The screen is a music stand. The notation runs edge to edge, and the interface is what little is
left around it: one 56 px line of context at the top and one dock at the bottom that holds the song
map and the transport. Nothing sits docked beside the score. Tools work on the score itself. You
select bars on the notation (click or tap a bar, tap a second bar to stretch the selection, drag
across bars with a mouse, or use the keyboard), and the selection becomes the loop straight away. A
small contextual bar hangs from the selection with speed, loop, count-in, save as clip and clear.
Everything outside the loop goes under a paper veil, so the loop reads like a lit passage on a dim
page. The mixer, practice settings and keys slide over as one sheet and leave when you're done.
The library carries the same idea: each song appears as its music (a waveform strip with its
sections, or its chord line), and the resume block shows the four bars you were practising.

## Screens

### Practice

- **Desktop (≥ 768).** The top line holds Back, the title with artist, part, key and tempo, a
  "10 unsure" toggle, the Tab / Chords switch, Mix and Keys. The score is the real alphaTab renderer
  from `@splitune/notation/view`, fed by the real music-core `buildTab` on a 32-bar fixture song
  (the contracts' fixture shapes stretched, with chord names and unsure notes). It shows four bars a
  line with a 2 px ink playhead, the current-bar wash and the sounding fill, and turns pages while
  playing. The dock holds section chips (tap one to loop the section), the waveform (it seeks by bar,
  and the keyboard treats it as a slider), Previous bar / Play (64 px) / Next bar, the bar and beat
  readout, −/speed/+ (the readout opens a typed field and presets), Count-in, Loop and the mix
  summary. Below 1180 px the mix summary goes, because Mix stays in the top line. Below 900 px the
  Count-in and Loop toggles drop their visible labels (they keep their accessible names).
- **The contextual bar** hangs above the selection's first line, over music already played, so the
  music ahead stays clear. It drops under the last line when there's no room above. The pass prompt
  ("Pass 3 at 70 % · how did it feel?" Felt clean C / Not yet N) joins it as an upper row after
  each pass, and the loop keeps playing while it waits for an answer.
- **Chords view** is a chord chart with four bars a line, named sections and the same bar numbers
  as the tab, with the same selection, veil, bracket and playhead.
- **Phone (< 768)** is its own layout, not a squeezed desktop. The top line holds Back, the title
  with the live "Bar 6 of 32 · 0:12", Tab / Chords, and one Tools button. The score shows two bars a
  line at 18 px digits. The dock holds the map (with short section names) and one row of
  Previous / Play / Next / − / speed / +. While bars are selected, the contextual bar sits at the
  top of the dock as two rows: the title with Save and Clear, then Loop and Count-in icon toggles
  with 50 / 70 / 85 / 100 %. When the pass prompt comes up it takes the title row's place, so the
  dock stays two rows tall. Tools open as a bottom sheet over the score, and the transport stays
  visible underneath.

### Library

- **Desktop.** The top line holds the wordmark and "Add a song". Below it is "Pick up where you
  left off": the title, a line about the clip, and the four bars of the clip drawn as a chord line
  (unsure chord dashed with "?"). Under that is the whole song's waveform with its sections and the
  clip boxed in ink. "Resume at bar 13" is the only filled pill on the page. Next comes Songs with
  its count, a filter field (type to filter by title or artist), a sort menu (Last practised,
  Recently added, Title A–Z) and instrument chips (an inverted chip marks the active one). Songs sit
  in hairline rows of three columns: title and meta, the music strip, and the status. Every status
  is a glyph, a word, one line on what it means and the one action that fixes it:
  - Ready.
  - Analysing 5 of 8, with the stage, an ETA range and a determinate bar, plus "You can loop and slow
    it down already".
  - Queued: "starts by itself".
  - Failed: Replace file and Try again.
  - Chords only: Analyse fully, with a chord line instead of a waveform.
  - Stems expired: Re-create stems, "your loops and edits are safe".
  - Upload not finished, 62 %: the waveform stops at 62 % and continues as a dashed line. Resume
    upload.

  Nothing the analysis hasn't produced is drawn: a queued or failed song shows a dashed flat line,
  not a waveform. "No results" names the query and offers Clear filters.
- **Phone.** The same order in one column. The resume button runs full width, the filter and sort
  fields are 16 px, the chips wrap onto a second line (they never get clipped), and each row stacks
  title, strip and status.
- **Empty.** No box: a staff icon, an h1, one sentence, "Add a song" (the only filled pill) and a
  "Try an example song" link. The header's Add button is hidden here.

### Import to ready

A flow you can click through on simulated timers: `Prototypes/C/Import`, starting at Choose source.

1. **Choose source.** "Bring a song" with three rows: Choose a file (a real file input), Paste a
   link (it expands to a field that validates on submit, shows its error inline with an icon and
   `aria-describedby`, and moves focus back to the field) and Record it (start, then a running
   timer, then "Stop and use this take"). "Use the example file" runs the flow without a file.
2. **Uploading and analysing open the practice screen at once**, and the paper fills in as each
   stage finishes. This uses the same `Practice` component with `layers` that only switch on when
   their stage is done:
   - Read the audio: the waveform, Play and slow-down.
   - Beats, bars and sections: section chips, the bar grid (bars with "–" for chords not found yet),
     and loops by bar.
   - Recognise the instruments: the question **"Is guitar the part you play?"** It appears first in
     the card, above the steps, with "Yes, guitar" or another part from a menu. Isolation waits for
     the answer.
   - Isolate your part: the mixer.
   - Chords: the chord chart.
   - Notes and tab: the tab. Until then the Tab segment is marked unavailable, with a dashed edge
     and the reason in its name.

   The card shows the step ("step 5 of 8"), an ETA range ("about 3–6 min left") and a determinate
   bar, with an eight-step list that says "Done · what it unlocked" or "Later · what it will
   unlock". On phones the steps are collapsed by default.
3. **Ready.** A one-line banner ("Ready. Tab, chords and stems are in; 10 unsure spots are marked."
   with "Got it") above the full practice screen.

## Tokens and type

One role set in `apps/web/app/prototypes/c/tokens.ts`, applied as custom properties on `.proto-c`.
Dark and Light differ only in values. The renderer's overlay classes are remapped onto the same
roles, so the shared tokens are never edited. Every surface, text and line role is grey (zero
chroma).

| Role | Dark | Light | Use and contrast on paper |
|---|---|---|---|
| paper | #0f0f0f | #ffffff | page and score, one ground |
| raised | #1b1b1b | #ffffff (+ edge and shadow) | sheets, popovers, contextual bar |
| ink | #f4f4f4 | #111111 | notation and primary text, 17.4:1 / 18.9:1 |
| ink2 | #c2c2c2 | #444444 | secondary text, 10.8:1 / 9.7:1 |
| ink3 | #a6a6a6 | #555555 | tertiary text, 7.9:1 / 7.5:1 (7.1:1 on raised) |
| edge | #6e6e6e | #8a8a8a | control boundaries, staff lines, waveform, 3.8:1 / 3.5:1 (≥ 3.1:1 on raised and hover) |
| line | #2b2b2b | #e4e4e4 | decorative hairlines only |
| wash | #1e1e1e | #f2f2f2 | current bar, under the ink playhead |
| veil | paper at 62 % | paper at 55 % | outside the loop: ink drops to 3.3:1 / 3.0:1 |
| unsure | #86b4ff | #1d5fd6 | unsure boxes and "?", 9.1:1 / 5.7:1; always dashed + "?" |
| bad / ok | #ff8a80 / #6fd08c | #c0261b / #1d7a3e | failure glyph, record dot; always with a word |
| stems | five hues | five hues | 4 px rule beside the stem's name |

Type is Figtree at 400 (text) and 500 (labels, titles, tab digits) only. The scale: 12/16 label,
13/18 small, 15/22 body, 17/24 lead, 20/26 title and readouts, 28/34 page title, 36/40 chord-chart
chords (26/32 on phones). The renderer's bold SVG text and its semibold sounding digits and "?"
are forced to 500, and the "?" is raised from 10 to 12 px. A script measured every element at
1440, 1024, 768, 600 and 375: weights are only 400 and 500, and no text is under 12 px. Every
changing number (readouts, speed, BPM, bar numbers, progress, dB) uses `tabular-nums`. Fields are
16 px on phones. The focus ring is 2 px ink at a 2 px offset.

## Selection, focus and confidence without colour

- **Choice** (one of several: Tab / Chords, speed presets, mix presets, instrument chips, tool
  tabs, section chips): inverted, with an ink fill and paper text (17–19:1).
- **On/off toggles** (Count-in, Loop, unsure marks): a state dot (hollow when off, filled when on)
  plus a 2 px ink edge when on. Inversion is kept for choices, so each view has one filled pill
  plus Play.
- **Loop**: a 3 px ink bracket over the looped bars, a veil over everything else, and
  `aria-pressed` on the bar buttons. On the map the loop is a band with ink edges and the waveform
  inside it drawn in ink. A selection with the loop off is a dashed ink outline.
- **Current bar**: the 2 px ink playhead, the sounding digits inverted, and the wash. In the chart
  the bar number is inverted.
- **Unsure**: the digit keeps full ink. A dashed box and a 12 px "?" mark it, and the tab prints
  the chord name with "?" (for example "Em?"). Medium confidence gets a dashed grey box without
  "?". In the chart and library an unsure chord gets a dashed box and "?". Turning "unsure" off
  removes the marks and nothing stays tinted.
- **Mixer**: solo and mute buttons are inverted when on. A stem that's silent gets a struck-through
  name, a faded fader and the word "Silent" or "Muted" in its readout and its `aria-valuetext`.
- **Disabled** controls use a dashed edge, a muted fill and the reason in their label ("Mix · after
  your part is isolated", "Tab, unavailable: arrives with the notes").

## Keyboard and pedal

The default map from `features/practice/model/keymap.ts` (through `resolveKey`, `keyOf` and
`ignoredTarget`):

| Key | Action |
|---|---|
| Space, Enter | Play / pause, with the count-in |
| ← / → | Previous / next bar |
| , / . | Speed −5 % / +5 % (Shift: 1 %) |
| L | Loop on / off |
| M | Mute my part |
| C / N | Felt clean / Not yet |

My additions:

| Key | Action |
|---|---|
| L (nothing selected) | Loop four bars from the current bar |
| Shift ← / → | Shorten or stretch the selection by a bar |
| 2–9 | Speed in tens (7 = 70 %, 2 = 25 %) |
| 0 or 1 | 100 % |
| I | Count-in on / off |
| R | Restart the loop |
| V | Tab / Chords |
| S | Save as clip |
| Esc | Close a popover or sheet, else clear the selection |
| ? | The Keys & pedal sheet |

Enter on a focused bar selects it the same way a tap does. The keys listen in the capture phase, so
Space plays even while a bar of the score has focus. A short confirmation ("Speed 70 %", "Pedal
right · Felt clean") shows at the top of the paper and is announced politely.

**Two-button pedal** (Page Up / Page Down, or the arrows with "My pedal sends arrow keys" on):

- **Left means again:** Not yet while the pass prompt is up, otherwise restart the loop, or back a
  bar when nothing is looping.
- **Right means go:** Felt clean while the prompt is up, otherwise play (with the count-in) or
  pause.

So a session goes: right to start, play the pass, then right (clean) or left (not yet), and the
loop carries on. The Keys & pedal sheet draws both pads with their keys.

## Measured

Measured with Playwright on the stories (`.c-paper` is the notation region: the alphaTab scroller,
or the chord chart, edge to edge).

| | Notation region | Share |
|---|---|---|
| 1440 × 900, default | 1440 × 679 | **75.4 %** |
| 375 × 812, default | 375 × 595 | **73.3 %** |

**A 4-bar loop at 70 % with a count-in, playing** (count-in is on by default, 1 bar):

| Input | Actions | Steps |
|---|---|---|
| Mouse | **3** | Drag across bars 5–8, click "70 %" in the contextual bar, click Play. Clicking two bars instead of dragging makes it 4; when the four bars are a section, its chip does it in 1, so 3 either way. |
| Phone | **4** | Tap bar 5, tap bar 8, tap "70 %", tap Play. A section of four bars takes 3: chip, 70 %, Play. |
| Keyboard | **3** | L (loop four bars from here), 7, Space. |

Before the redesign the same task took 5 / 7–9 / about 10.

All three paths were run in headless Chromium and ended in the count-in, then playing, with the
bracket and veil on bars 5–8 (1–4 for the keyboard path, from the top of the song) at 70 %. The
pass prompt was checked after a pass, and C / N, the tap buttons and the pedal (Page Down on the
prompt) all answered it.

## How the top 10 problems are answered

1. **Phone:** a phone layout of its own. Notation takes 73 % of the screen, the dock is two rows,
   nothing overflows at 375 (checked by script), and count-in, mixer, keys and pedal are all
   reachable.
2. **Music is the hero:** about 75 % of the viewport goes to notation, and the library shows each
   song's music.
3. **Selected and current states:** choices are inverted, toggles get a 2 px ink edge and a dot,
   the playhead is 2 px ink, and the loop has an ink bracket and a veil. All of these are ≥ 3:1.
4. **Confidence:** a dashed box and "?" on every unsure note, plus "?" in chord names. The digit
   keeps full ink, and turning marks off removes all tint.
5. **Overflow:** no overflow at 1440, 1024, 768, 600 or 375. The pass prompt joins the contextual
   bar, so it never covers the transport.
6. **Loop speed:** 3 / 4 / 3 actions, with a key that sets a loop.
7. **Bar numbers:** one numbering everywhere (the fixture song has no pickup; the tab, chart, map,
   readout and labels all count from 1).
8. **Forms:** Link and Record expand in a single column with no overlaps.
9. **Failure and validation:** the link error is inline with an icon, `aria-describedby` and focus
   returned to the field. A failed song says what happened and offers "Replace file" before
   "Try again". Submit buttons are never disabled in advance.
10. **Drift:** only 400 and 500 weights, nothing under 12 px, fields 16 px on phones, one filled
    pill per view.

## What doesn't work yet

- **No real audio.** The clock is simulated. Mute, solo and gain change state and labels but play
  no sound.
- **Save clip** confirms in the readout and keeps nothing. The library's buttons (Retry, Replace,
  Re-create, Analyse fully, Resume upload) and Back links don't navigate.
- **Chord chart:** the playhead moves by fraction of the bar, not along the beat grid.
- **The renderer's own overlays** (loop bracket, current-bar wash, unsure boxes) are restyled
  through CSS custom properties and a few overrides scoped to the prototype, because
  `packages/notation` isn't touched. The tab's digits keep alphaTab's bold SVG font declaration,
  overridden to 500 by CSS.
- **Contextual bar on desktop:** it covers part of the line above the loop, or the line below when
  the loop starts on the first line. It can be cleared with Esc.
- **Below 375** (320 wide), the phone transport and the mixer sheet overflow. 375 is the
  supported minimum.
- **Biome** still reports style items in this folder: CSS specificity order, `role="group"` rather
  than fieldset, and exhaustive-deps suppressions. Typecheck is clean for this folder.
