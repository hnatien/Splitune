# Direction B: "Instrument"

## The idea

The practice screen is a piece of practice hardware, closer to a Teenage Engineering recorder than to a web page.
The paper takes the middle of the screen. The song map sits above it like a sequencer's pattern row, and below it
is a fixed control surface on a strict grid that never moves or folds. Every control is a labelled key with an
edge, a bottom lip and its keyboard key cap printed on it. State reads the way hardware shows it: an on key is
inverted, a toggle has an indicator LED (hollow or filled), progress is a row of segments, and the position, speed,
loop and count-in are tabular readouts on a display line. Nothing important hides in a popover. The surface holds
the transport, loop, speed, count-in and mix modules, and the display line holds the pedal panel. The mixer is the
one panel you open, and it docks beside the music instead of covering it. The library reads like the track list of
a sampler, with numbered slots and a status glyph, word and segment meter per row. The import flow is an input
selector (File, Link, Record) followed by a stage list whose finished stages unlock their tools as they land.

## Layouts

### Practice

**Desktop (1440 × 900)**
- Top bar (56 px): Library (Esc), title and facts, the unsure key (a dashed "3?" sample plus the count), and the
  Tab/Chords view keys (V).
- Song map (66 px): section keys proportional to their length ("Verse 1 5–12"). Tapping one loops it. The current
  section has an ink underline. Under the keys is a bar-ruled waveform with the loop as an ink box (dashed when the
  loop is off) and a 2 px playhead. The waveform is a slider: click or ← → to seek by bar.
- Paper (572 px): the real alphaTab tab, four bars per system, scrolled so the loop or the current bar is in view.
- Display line (60 px), the instrument's screen:
  - state (Paused, Count-in, Playing) and the position as bar.beat / 32 with the time;
  - a message slot that shows, in order of priority: the count-in (a big beat number plus 4 segments), the pass
    prompt with Not yet (N) and Felt clean (C), or the last action with its source ("Key ⇧7 · Speed 70 % · 70 BPM",
    "Pedal right (held) · Next loop");
  - the pedal panel: mode Bars | Practice (F) and two pedal soft-key labels that change with context.
- Surface (147 px), five modules on one row:
  - Transport: Restart R, ← bar, Play Space (64 px), bar → (the 48 px keys carry their caps under the icon).
  - Loop: Loop L with LED, the "Bars 9–12" readout with passes and a clean / not-yet history (filled and hollow
    squares), length keys 1 2 4 8 (from the current or tapped bar), and move-loop keys ⇧← ⇧→.
  - Speed: − , and + . around the "70 % / 70 BPM" readout, with presets 50–100 (⇧5…⇧0).
  - Count-in: Off, 1 bar, 2 bars (I), and Before each pass (⇧I).
  - Mix: Part loud, Minus one, Original (U), Mute my part M, and Mixer X.
- Mixer open: a 380 px rack docked right. Each stem row has a swatch and name ("Your part", "Rough △"), a fader with
  a 48 px track, a dB readout ("muted", "off (solo)"), and S and M keys. Soloing greys the other rows' names and
  fills and changes their readouts. Presets sit at the top.
- Below 1400 px the surface wraps to two rows (Transport, Loop, Speed / Count-in, Mix), and the pedal labels leave
  the display line (the mode keys stay).

**Phone (375 × 812)**
- Top bar (56): back, title, Tab/Chords.
- Song map (58): section keys and a 24 px waveform.
- Paper (463): two bars per system, so tab digits stay at reading size.
- Display line (52): position, then the message or the prompt with Not yet / Felt clean as 48 px keys.
- Transport row (64 + padding): ← bar, Play 64, bar →, and speed − / readout / +. Tapping the readout opens the
  Speed module.
- One module row (48 + padding): Loop, Speed, Count-in, Mix or Pedal.
- Module selector (44): five tabs, each showing its current value ("Loop 9–12", "Speed 70 %", "Count-in 1 bar",
  "Mix Part loud", "Pedal Bars"), so nothing is unreachable and state stays visible.
- The mixer takes the paper's place while open. Key caps are hidden on phones (no keyboard), but the pedal page
  still shows what each pedal does.

### Library

- **Desktop.** An app bar with one filled key, Add song (A). Below it is a resume "deck": Play 64 (Enter), "Riff in
  A minor", and Loop, Speed, Best clean and Last readouts, plus a 7-segment "this week" strip and the clean-pass
  count. Next come the Part filter keys with counts, the Sort keys and a search field (/). The track list has
  numbered slots 01–09 and the columns Song, Part, Length, Status, Last practised and Action. Status is a glyph, a
  word and a sub-line. Analysing and unfinished uploads add a segment meter, and analysing shows "about 2–4 min
  left".
- **Statuses.** Ready (filled dot), Analysing 3 of 7 (part-filled dot plus meter, "Practise now"), Queued 2nd in
  line (hollow dot), Chords only (half-filled square), Stems expired (warning triangle, Re-create stems), Failed (red
  ✕ square plus the reason, Try again, which really re-queues), Upload not finished 62 % (dashed circle plus meter,
  Resume upload).
- **Phone.** The deck is compact. Rows become slot, title and status on two lines with a 44 px action key. Play
  actions are icon-only with full accessible names; the others keep short words (Details, Re-create, Resume).
- **Empty.** No box: an icon, an h2, one sentence, the one filled Add a song key, three source keys (File F,
  Link K, Record R) and "Or try an example song". The app bar's Add song turns outlined so the view keeps one
  filled key.

### Import to ready

- **Step strip.** Song, Upload, Analyse, Ready as four segment bars: done is filled, now is dashed.
- **Song.** Three source keys (radio group; F, K, R) and the source panel:
  - File: a drop zone, then the chosen file with its waveform, size, length and Remove.
  - Link: a 16 px URL field with an inline error and focus on submit.
  - Record: a record key, a time readout and a level meter.
  - Details (title, artist) sit next to the source. Add and analyse (↵) is the one filled key and is never
    pre-disabled; submitting with nothing chosen says why and moves focus.
- **Analyse.** A big ETA range ("About 2–5 min left"), then eight named stages with glyph, name, "Unlocks …" and a
  right-hand state (Done, 46 %, Waiting, Needs your answer). The running stage has a 10-segment meter.
- **The question.** When "Hear which parts play" finishes, an ink-edged card asks "Is guitar the part you play?"
  with Yes, guitar (Y) and Bass / Piano / Drums / Vocals. The tab stage waits for the answer and shows "Needs your
  answer"; nothing else waits.
- **What works now.** Lists each tool with Ready or "after …". Start practising now (P) opens as soon as the beat
  is found.
- **Practice while analysing.** The same practice screen with what really exists:
  - play, loops by bar, speed and count-in at once;
  - the Mix module and M/X are dashed and say "after your part is isolated" until stems land;
  - Chords appears when the chords stage ends, then Tab when the tab stage ends;
  - the paper shows the live stage list until then.
- **Ready.** Play 64 (Enter), the song, and Bars / Tempo / Key / Unsure spots readouts. "Or start on a section,
  looped" offers section keys that open practice with that section looped.
- **Phone.** The question and "What works now" move above the stage list.

## Tokens and type

- **Theme.** One role set, scoped to `.proto-b[data-theme=dark|light]` in `apps/web/app/prototypes/b/b.css`. Dark
  and Light differ only in values. Every surface, text and line is pure grey (R = G = B).

| Role | Dark | Light | Notes |
|---|---|---|---|
| chassis | #0a0a0a | #e4e4e4 | |
| panel | #151515 | #f2f2f2 | |
| paper | #0f0f0f | #ffffff | |
| ink / text | #f2f2f2 | #111111 | 17.1:1 / 18.9:1 on paper |
| text-2 | #b8b8b8 | #3b3b3b | ≥ 7.2:1 on every surface |
| text-3 (labels) | #949494 | #595959 | ≥ 4.7:1 on every surface |
| edge (control boundary) | #737373 | #757575 | ≥ 3.0:1 on every surface |
| line | #2b2b2b | #cfcfcf | decorative |
| key | #1f1f1f | #fbfbfb | |
| on (inversion) | #f2f2f2 | #111111 | ≥ 14.7:1 vs surface |
| loop wash | #222222 | #f0f0f0 | |
| current-bar wash | #2c2c2c | #e0e0e0 | ink on it ≥ 12.5:1 |
| staff | #858585 | #767676 | ≥ 3.4:1 on paper and washes |
| rhythm | #8a8a8a | #6b6b6b | |

- **The only hues.** Unsure #ffad5c / #8f3a00 (≥ 5.6:1 on paper and washes), failed #ff7a7a / #b42318, warning
  #e8c55a / #7a5a00, and five stem colours (≥ 4.7:1 on the panel). Each one sits beside a glyph or a word.
- **Shared score roles.** `--paper`, `--ink`, `--staff`, `--bar-current`, `--score-loop-*`, `--conf-*`, `--primary*`
  and `--ring` are re-pointed inside `.proto-b`, so the real `AlphaTabView` draws with these values. The shared
  token files are untouched.
- **Type.** Figtree 400/500 only. Measured on every screen: one family, weights {400, 500}, smallest computed size
  11 px. alphaTab's SVG text and its overlays are set to 500 inside the prototype.
  - Scale: 11 label (500), 13 meta and keys, 15 body, 18 readout-sm, 24 readout, 32 chord names and count-in
    number.
  - Tab digits are 20 px (17 px on phones), chord names over the tab 16 px.
  - `font-variant-numeric: tabular-nums` is set on the root, so every changing number keeps its width.
  - Phone fields are 16 px.
- **Geometry.**
  - 4 px grid. Practice keys are 48 px, Play 64 px, browse keys 44 px; song-map section keys are 28 px (the 24 px
    song-map exception).
  - Radii are 6 px for keys and 3 px for caps; pills only for Play.
  - Keys have a 1 px edge plus a 2 px bottom lip, and the lip disappears when pressed. Shadows are not used as
    boundaries.

## Selection, focus and confidence without colour

- **Selected or on.** Full inversion (ink fill, paper text, ≥ 14.7:1) plus `aria-pressed`, `aria-checked`,
  `aria-selected` or `aria-current`.
- **Toggles.** Loop, Before each pass and Mute my part also carry an LED: hollow ring when off, filled dot when on.
  The shape changes, not the hue.
- **Current.**
  - The current bar has a 2 px ink playhead (≥ 17:1) plus a wash.
  - The current section key gets a 3 px ink underline.
  - The current chord cell is inverted, with its beats lit as segments.
  - The current phone module tab has a 3 px ink top rule.
  - The current nav link has a 2 px ink underline.
- **Loop.** A 2 px ink bracket over the looped bars with a "Bars 9–12 · pass 3 at 70 %" badge, the waveform's ink
  box, 2 px ink edges on chord cells, and `aria-pressed` on the bar buttons.
- **Armed first bar.** A dashed 2 px ink outline.
- **Disabled.** A dashed edge, the well fill and "unavailable until …" in the name, never opacity.
- **Focus.** A 2 px solid outline at 2 px offset in pure white or black: ≥ 3:1 on every ground, never hidden by the
  fixed surface, which sits outside the scrolling paper.
- **Confidence.**
  - Unsure tab notes and chords wear a 2 px dashed box and a "?".
  - The digit itself stays in full ink in every band, so nothing is carried by a coloured digit.
  - "Probably" notes get a dashed grey box without the "?".
  - Unsure chords in the Chords view get a dashed box and a "?". The orange is a third cue, not the only one.
  - The top bar shows a key sample and the count.

## Keyboard and pedal

**Keyboard.** The existing map holds: Space/Enter play-pause, ← → previous/next bar, `,` `.` slower/faster by 5 %
(Shift 1 %), L loop on/off, M mute my part, C felt clean, N not yet. Additions:
- Set a loop from the keyboard (the proposal):
  - **1, 2, 4, 8** loop that many bars from the current bar, or from a bar you just tapped;
  - **⇧← / ⇧→** move the loop back or forward by its own length (the next phrase);
  - **R / Home** go to the top of the loop.
- **⇧5…⇧0** speed presets 50–100 %.
- **I** cycles count-in Off / 1 / 2 bars; **⇧I** turns on a count-in before each pass.
- **U** cycles mix presets; **X** opens or closes the mixer; **V** switches Tab / Chords; **F** sets the pedal mode;
  **Esc** closes the mixer, else goes back.
- Every key is printed on its control.
- Every press shows its source and result on the display line within one frame ("Key 4 · Loop · bars 6–9 · 4 bars").

**Two-button pedal.** Pedals send Page Up / Page Down (or ↑ ↓ / ← →).
- **Bars mode** (default): left = previous bar, right = next bar, as today.
- **Practice mode** (F): one pedal pair runs a whole session hands-free:
  - right = Play / Pause, left = top of the loop;
  - while the pass prompt is up: right = Felt clean, left = Not yet;
  - hold either pedal (over 0.5 s) to move the loop back or forward by its length.
- The pedal panel shows both pedals as soft keys whose labels change with context ("Top of loop / Play" →
  "Not yet / Felt clean"). They light on press, so the player always knows what the next press does.
- **A session with only the pedal:** tap right (count-in, then playing) → loop passes → the prompt comes up → tap
  right (felt clean) or left (not yet) → hold right for the next four bars → tap right.

## Measured

- **Notation share** (the paper region's area over the viewport, Playwright):
  - default practice at 1440 × 900: **63.3 %** (Dark and Light);
  - default practice at 375 × 812: **57.1 %**;
  - with a loop and the pass prompt: 63.3 % / 57.0 %;
  - Chords view: 63.3 % / 57.1 %; the phone Pedal module page: 54.4 %;
  - with the mixer open (not the default): 46.6 % at 1440, and the mixer replaces the paper on phones.
- **A 4-bar loop at 70 % with count-in, playing** (count-in is on, 1 bar, by default):
  - Mouse: **3 clicks**: "4" (four bars from the current bar), "70", Play. Starting somewhere else adds 1 (click the
    first bar, then "4"); a section key loops a whole section in 1.
  - Phone: **4 taps**: "4", the Speed tab (or the speed readout), "70", Play.
  - Keyboard only: **3 presses**: `4`, `⇧7`, `Space`.
  - All three were exercised in headless Chromium against the stories.
- **Overflow.** No horizontal overflow at 375 on any screen.
- **Targets.** Every practice key is ≥ 48 px, Play is 64 px, and browse keys are ≥ 44 px. The only smaller targets
  are the song-map section keys (28 / 26 px, the 24 px exception) and the waveform slider (24 px, also
  keyboard-operable).

## Not done or not verified

- Audio is a simulated clock. The mixer, count-in and speed change state and readouts only.
- alphaTab's horizontal "Scroll" follow mode and the playhead styles are not exposed. Page follow is used.
- Two bars per system on phones is set through the view's `api` after its first render. The package itself fixes
  four bars per row.
- Contrast was computed from the token values (WCAG 2 luminance), not measured from pixels. A screen-reader pass
  was not done.
- Settings, progress history, the Fix flow and the full editor are outside this prototype.
