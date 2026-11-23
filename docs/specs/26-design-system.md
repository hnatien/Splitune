---
title: Design system and visual language
workstream: engineering
last_researched: 2026-11-23
confidence: medium
---

# Design system and visual language

Status: rewritten in step s47 (full redesign). This document is the source of truth for how
Splitune looks and behaves at the component level. The decision behind it is recorded in
`docs/design/s47-direction.md`; the evidence is `docs/design/s47-audit.md` and
`docs/design/s47-guidelines.md`. Screens and flows are doc 27; how the system is checked is
doc 28.

Code cites this document by section ("26 §4.6", "26 §12.1"). The section numbers are stable.

## TL;DR

- **Calm workspace.** The music takes the ink and the interface recedes: navigation and tools are
  muted text with no fill at rest, separators are few, lists are hairline rows, and a screen docks
  at most one panel.
- **Black, white and the greys between them.** Two neutral ramps of twelve steps, each step named
  by its job. No accent colour. Colour means something (status, stems, the two hands, "unsure")
  and never carries that meaning alone.
- **Selection is ink.** Selected, current and "on" are an ink edge, an ink line, a check or an
  inversion. There is no selected-surface token, so a grey fill cannot stand for a state.
- **One filled control per view**, plus Play on the practice screen.
- **Figtree at 400 and 500**, sized by role. Controls are pills. Only floating layers cast a
  shadow.
- **Every practice action has a key**, shown on the control, and a two-button pedal runs a
  session.
- **Dark and Light are both first-class**, with Stage (Dark at larger reading sizes), an
  increased-contrast variant of each and a forced-colours mapping, all contrast-tested.

## 1. Design direction

### 1.1 Candidates considered

Step s47 built three working prototypes of the practice screen, the library and import-to-ready,
and had them scored by an independent judge on seven criteria (`s47-directions/judge.md`).

| Direction | Idea | Notation share at 1440×900 / 375×812 | Keys to a slowed loop | Judge |
|---|---|---|---|---|
| A. Calm workspace | dimmed chrome, one panel, tools summoned by key | 73.5 % / 64.0 % | 6 | 27 |
| B. Instrument | a dense, always-visible control surface | 63.3 % / 57.1 % | 3 | 24 |
| C. Score-first | notation edge to edge, tools on the selection | 75.4 % / 73.3 % | 3 | 27 |

A was chosen. It has the clearest hierarchy without colour and it carries over to every other
screen. It takes from C the loop made on the score, chord names over the tab, the music shown in
the library and the pedal rule; and from B the key caps on controls, the digit keys for loop
lengths and speeds, and the 44 / 48 px targets.

### 1.2 Principles (use them to settle design arguments)

1. **The music leads.** In the default practice state the notation gets at least 70 % of a
   1440×900 viewport and at least 55 % of a 375×812 one. Anything that would take that room is
   summoned, not docked.
2. **One primary per view.** A page, a dialog, a sheet or a panel tab has one filled ink control.
   The practice screen's is Play.
3. **State is shape.** Selection, confidence, status and focus are each readable with every hue
   removed.
4. **One key, one press.** Every practice action is one key or one pedal press, the key is
   printed on its control, and the HUD confirms it within 100 ms.
5. **Nothing arriving moves what is in use.** The transport never moves; a layer that arrives is
   announced, not swapped in under the playhead.
6. **Say why.** A control that cannot be used yet says what it is waiting for.

### 1.3 Character

Quiet, exact and unhurried. A desk the learner returns to every day, not a console. Sentence
case, numerals with their units, no exclamation marks except for something the learner did.

## 2. Appearance (theme) model

`<html data-appearance="dark|light|stage" data-contrast="normal|more">`, set before first paint
by the inline display script (`apps/web/app/ui/display.ts`), which also sets `data-motion`,
`data-distance`, `data-reading-font` and `color-scheme`. The choice is stored per device.

- **Dark** is the `:root` default, so a page without JavaScript is Dark.
- **Light** has the same roles with its own ramp.
- **Stage** is Dark with reading sizes one step up (`--read-scale: 1.25`).
- **Increased contrast** (`data-contrast="more"`, or `prefers-contrast: more` with no stored
  choice) moves secondary and dimmed text, hairlines, control edges, staff lines and the waveform
  one ramp step further from the ground, and widens the focus outline to 3 px.
- **Forced colours** maps surfaces and washes to `Canvas`, text and lines to `CanvasText`, and
  selection, focus and "now" to `Highlight`.
- **Subtrees.** Any element carrying `data-appearance` shows that theme (Storybook's side by
  side). Density is set per shell with `data-density="browse|practice"`.

## 3. Token architecture

Three tiers, in `packages/ui-tokens/src`.

1. **Primitives** (`primitives.css`): the two neutral ramps `--dark-1 … --dark-12` and
   `--light-1 … --light-12`, the status hues and the stem hues. Static OKLCH literals inside sRGB.
2. **Ramp and roles** (`themes.css`): each appearance binds `--gray-1 … --gray-12` to its own
   ramp, and every role reads a step, a primitive or another role. The role table is the same in
   Dark and Light (`ROLE_STEPS` in `index.ts`; `tokens.test.ts` holds the CSS to it).
3. **Component tokens** (`themes.css`): the song map, the score, beats, the keyboard diagram and
   the HUD. They read roles or carry their own contrast-tested literal, never a primitive.

`theme.tailwind.css` maps roles to Tailwind utilities and clears Tailwind's own palette, type,
radius, shadow and easing scales, so `bg-gray-800`, `text-sm` and `rounded-lg` produce nothing.
`scripts/check-ui-tokens.mjs` fails `pnpm lint` on raw colours, palette classes, any name s47
retired, a weight other than 400 or 500, a removed focus outline and one-off motion values.

## 4. Colour

### 4.1 Neutrals and surfaces

Zero chroma throughout. A step has one job in both themes; the two ramps are tuned apart, not
mirrored (Light's raised layer is lighter than its page).

| Step | Job | Roles | Dark | Light |
|---|---|---|---|---|
| 1 | page and notation paper | `--background`, `--paper`, `--primary-foreground` | `#0f0f0f` | `#fbfbfb` |
| 2 | the one panel, wells, skeletons | `--panel` | L 0.195 | L 0.968 |
| 3 | popovers, menus, sheets, dialogs, toasts | `--raised` | L 0.225 | `#ffffff` |
| 4 | hover; the wash under a current bar or row | `--hover`, `--wash` | L 0.255 | L 0.945 |
| 5 | pressed | `--pressed` | L 0.285 | L 0.905 |
| 6 | decorative hairline | `--border` | L 0.31 | L 0.92 |
| 7 | the ring of a labelled control | `--border-strong` | L 0.4 | L 0.83 |
| 8 | a control's only boundary, staff lines | `--edge`, `--staff`, `--waveform-peak` | L 0.545 | L 0.6 |
| 9 | dimmed chrome text | `--faint-foreground` | L 0.68 | L 0.52 |
| 10 | secondary text | `--muted-foreground` | L 0.8 | L 0.4 |
| 11 | hover of the filled control | `--primary-hover` | L 0.885 | L 0.32 |
| 12 | ink | `--foreground`, `--ink`, `--primary`, `--selected`, `--signal`, `--ring` | L 0.955 | L 0.19 |

Surfaces nest at most three deep: page, panel or raised layer, and a well inside it.

### 4.2 The ink as accent and interaction

The ink (step 12) is the only accent. It is body text and notation, the one filled control,
every selected or current mark (`--selected`), the focus outline (`--ring`), and "now": the
playhead, the loop's edges and the current beat (`--signal`). Its hover is step 11.

### 4.3 Status

| Role | Meaning | Always with |
|---|---|---|
| `--success`, `--success-surface` | ready, saved, clean | a check glyph and words |
| `--destructive`, `--destructive-surface` | failed, delete | a cross or a warning glyph and words |
| `--unsure`, `--unsure-surface` | a transcription the model doubts | a dashed outline and "?" |
| `--edited` | a note or chord the learner changed | a 2 px underline |

Warnings and information are muted text with a glyph: they have no hue. Every surface and line
is opaque; only the scrim behind a modal is translucent.

### 4.4 Categorical: stems, strings, hands

Six stem hues (`--stem-guitar`, `-bass`, `-drums`, `-vocals`, `-keys`, `-other`) and the full mix
(`--stem-mix`, the ink), plus the two hands on the keyboard diagram. A stem's hue is a 4 px rule
that always sits beside the stem's name. The six stay at least 12 ΔE2000 apart for normal vision
and for simulated protanopia, deuteranopia and tritanopia in every appearance (`palette.test.ts`).

### 4.5 Usage rules

- **Selection is never a grey fill.** No two surfaces of a ramp differ by 3:1, so a surface alone
  cannot be the state (`contrast.test.ts`). Selected, current and "on" are one of: a 1.5 px ink
  edge (tabs, toggles, choice rows, the loop line), a 2 px ink line (the current tab of a line of
  tabs, the current nav item, the current bar, the playhead), a check (lists, menus), or an
  inversion (the letter toggles M and S). Each is at least 7:1 against what it sits on and carries
  `aria-selected`, `aria-pressed`, `aria-checked` or `aria-current`.
- **`--wash` never appears without an ink line.** It only makes the line's area easier to find.
- **Hover is supplementary**: one step of the ramp (`--hover`), never the only cue.
- **One filled ink control per view.** Everything else is `outline`, `quiet`, `destructive` or
  `link`.
- **No hue for emphasis.** Emphasis is size, weight, position and space.

### 4.6 Verified contrast (WCAG 2.2, `colorjs.io`, the values in §4.1–§4.7)

`contrast.test.ts` checks every pair in `CONTRAST_PAIRS` in six contexts (Dark, Light, Stage ×
normal, increased). Floors: 7:1 for ink and secondary text on the page and for notation ink on
the paper, the loop band and the current bar; 4.5:1 for all other text; 3:1 for control
boundaries, focus, selection, "now", staff lines and graphics.

| Pair | Dark | Light |
|---|---|---|
| ink on the page | 16.8 | 17.8 |
| ink on a raised layer | 15.0 | 18.5 |
| secondary text on the page | 10.3 | 8.9 |
| dimmed text on the page | 6.7 | 5.3 |
| dimmed text on hover | 5.5 | 4.7 |
| control edge on the page | 3.9 | 3.8 |
| control edge on hover | 3.2 | 3.4 |
| strong hairline on the page (labelled controls only) | 2.1 | 1.6 |
| hairline on the page (decorative) | 1.5 | 1.2 |
| filled control: its text on it | 16.8 | 17.8 |
| staff on the paper | 3.9 | 3.8 |
| staff on the current bar | 3.2 | 3.4 |
| unsure on the page | 7.7 | 5.9 |
| success on the page | 9.1 | 6.0 |
| destructive on the page | 6.7 | 5.3 |

The test pins these to one decimal; a value change must update this table.

### 4.7 Component tokens (tier 3) and the remaining roles

| Token | Reads | Use |
|---|---|---|
| `--bar-current` | `--wash` | the current bar's wash, under a 2 px ink underline |
| `--score-loop-fill`, `--loop-fill` | `--panel`, `--wash` | the loop band on the score and on the song map |
| `--loop-edge`, `--score-loop-edge`, `--playhead`, `--score-playhead`, `--now-line` | `--signal` | loop edges and the playhead |
| `--staff`, `--waveform-peak` | `--edge` | staff and bar lines; the waveform |
| `--waveform-rms`, `--waveform-played`, `--waveform-loop` | secondary text, `--signal` | the song map |
| `--beat-now`, `--beat-done`, `--beat-slot` | `--signal`, dimmed text, `--edge` | the beat readout |
| `--hatch` | `--unsure` | the unsure hatch on the song map |
| `--key-*` | literals | the keyboard diagram: keys and the two hands |
| `--fret-guitar`, `--fret-bass`, `--melody-vocals` | stems | sustain tails and the sung note |
| `--hud-bg`, `--hud-fg` | `--raised`, `--foreground` | the key and pedal HUD |
| `--scrim` | literal | behind a modal dialog |
| `--elevation-popover`, `--elevation-dialog` | literals | the two shadows (§9) |

### 4.8 Surfaces and status tints

Status tints (`--success-surface`, `--destructive-surface`, `--unsure-surface`) are opaque and
used only behind a banner or an inline message that also has its glyph and words. Text on them is
ink at 4.5:1 or more.

### 4.9 Deviation register

- **Near-black and off-white grounds.** s46 used pure black and pure white. s47 uses `#0f0f0f`
  and `#fbfbfb` so small Figtree 400 does not halate on Dark and Light has a real raised step.
  Ink on the page stays above 16:1 in both.
- **Reading weights.** The reading sizes are set at 500. The notation renderer draws its own
  digits and is the one place a heavier weight appears.

## 5. Confidence encoding (one rule for every surface)

Shape first, hue last. Every digit and chord name is ink in every state.

| Confidence | Mark | Token |
|---|---|---|
| Sure | none | `--ink` |
| Probably | a 1.5 px dotted outline | `--conf-medium-edge` |
| Unsure | a 1.5 px dashed outline and a "?" (12 px, 500) | `--conf-low-edge`, the only place the unsure hue appears |
| Edited by the learner | a 2 px underline | `--edited` |
| Mostly unsure bar | one dashed outline and one "?" for the bar | `--unsure` |
| Timing flagged | a dotted underline | `--ink` |

"Show unsure marks" (U) removes the outlines and the "?" and leaves plain ink. The legend names
all the marks with samples and says how often a guess like it is wrong, as a frequency ("about 1
in 3"). `CONFIDENCE` in `@splitune/ui-tokens` is the same table for code.

## 6. Typography and reading sizes

### 6.1 Families

Figtree for everything, at weights 400 and 500 only; JetBrains Mono for key caps (it has ⌘ ⇧ ⌥ ↵)
and for reading numbers; Atkinson Hyperlegible Next as the optional reading font. Each face has a
metric-matched fallback so a font swap never reflows the transport. Lint fails on any other
weight utility.

### 6.2 Type by role (rem; root 16 px, so browser zoom and 200 % text work)

A text role is 400 with the looser line height; a label role is 500 with the tighter one.

| Utility | Size / line | Weight | Use |
|---|---|---|---|
| `text-kbd` | 11 / 14 | 500 | key caps only |
| `text-caption` | 12 / 16 | 400 | captions, meta lines |
| `text-label-sm` | 13 / 18 | 500 | secondary labels, status words, group heads |
| `text-body-sm` | 13 / 18 | 400 | secondary text, descriptions |
| `text-label` | 14 / 20 | 500 | controls, tabs, row titles |
| `text-body` | 15 / 22 | 400 | body |
| `text-field` | 16 / 22 | 400 | text in fields on coarse pointers |
| `text-title` | 17 / 24 | 500 | song and panel titles, readouts |
| `text-lead` | 17 / 26 | 400 | long-form and marketing lead |
| `text-heading` | 22 / 28 | 500 | page and dialog headings, figures |
| `text-readout` | 28 / 34 | 500 | large readouts |
| `text-display` | 32 / 38 | 500 | marketing and empty-state heads |
| `text-hero` | clamp(40, 5vw, 56) / 1.05 | 500 | the Home hero |

Nothing is set below 11 px. Tracking tightens with size from −0.01em to −0.03em. Every number
that changes is `tabular-nums`. Fields are 16 px on coarse pointers so iOS does not zoom.
Sentence case; no uppercase or letter-spaced eyebrows.

### 6.3 Practice reading scale (distance presets)

`text-read-tab`, `-chord-current`, `-chord-next`, `-chord-sheet`, `-chord`, `-bar-number`,
`-readout` and `-label` scale with the distance preset (`data-distance`: Desk, Music stand,
Floor), Stage's `--read-scale` and the device calibration. Coarse pointers start at Music stand.
Floors: tab digits never below 18 px, Music-stand tab at least 36 px, the current chord at least
32 px at Desk and 88 px at Floor.

## 7. Layout and spacing

- A 4 px grid; gutters of 16, 24 and 32 px.
- **App shell** (library, settings): from 1024 px a 232 px rail and one main column, no top bar;
  below that a 48 px top bar and a bottom navigation bar.
- **Practice**: top bar 52 px (48 on phones), song map, the music edge to edge with a key row,
  the transport (80 px; on phones a status row over two rows). The one panel is 340 px, closed by
  default, docked from 1180 px, a drawer below that and a sheet of at most 60 % of the height on
  phones. Nothing floats on the notation except the count-in and a URL import's video.
- Lists are hairline rows, not card grids. Settings are rows, not cards. Whitespace before rules.
- Content widths: library 1080, settings 880, forms 400, reading 72ch, bare pages 480.
- Layouts hold with short, typical and very long content (an 80-character title, F♯m7♭5, 99+).

## 8. Targets and hit areas (CSS px)

| Token | Size | Where |
|---|---|---|
| `--target-min` | 24 | section chips on the song map, fine pointers only |
| `--target` | 44 | every control in browse density |
| `--target-practice` | 48 | every control in practice density |
| `--target-play` | 64 | Play |
| `--target-stand` | 88 | Stage |

The target is the element's own border box. A control whose face is smaller than its target pads
out to it with a transparent border; no face is smaller than 36 px.

## 9. Shape, borders and elevation

- **Radii by what they round:** controls are pills (`rounded-full`); media 6 px
  (`rounded-media`); fields 10 px (`rounded-field`); the panel, popovers, menus and toasts 14 px
  (`rounded-panel`); dialogs and sheets 20 px (`rounded-dialog`). A child's radius never exceeds
  its parent's.
- **Lines:** `--border` is decorative and has no minimum. `--border-strong` rings a control that
  also has a label or an icon. `--edge` is a control's only boundary (fields, steppers,
  checkboxes, switch and slider tracks) and is at least 3:1. One hairline per edge.
- **Elevation:** only floating layers cast a shadow: `shadow-popover` and `shadow-dialog`, each a
  close black layer under a wide one. The panel is docked, so it has a hairline and no shadow. A
  shadow is never the only boundary.
- **Focus:** a 2 px solid ink outline at a 2 px offset, 3 px under increased contrast, inside the
  edge on fields. `:focus-visible` only. Removing an outline without a replacement fails lint.

## 10. Motion

| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 100 ms | press, hover, toggles |
| `--duration-base` | 200 ms | popovers, tabs |
| `--duration-slow` | 300 ms | dialogs, sheets, the panel |
| `--duration-slower` | 400 ms | layout morphs only |
| `--stagger` | 40 ms | lists entering |

Three curves: `ease-standard`, `ease-enter` (decelerate) and `ease-exit` (accelerate). Only
`transform` and `opacity` animate. Press scales to 0.97. The playhead follows the audio clock by
`transform`. Under reduced motion every duration is 0, pages turn and the playhead steps by beat.
Nothing flashes more than three times a second. Every key, tap and pedal press is confirmed
within 100 ms.

## 11. Iconography and brand marks

Lucide at a 1.8 stroke, 20 px in controls and 16 px in small ones, plus the custom set in
`apps/web/app/ui/icons`. Icons take `currentColor`. The wordmark is a logotype and sits outside
the type scale.

## 12. Components

All in `apps/web/app/ui`, each with stories in both themes (doc 28 §2).

### 12.1 Base

| Component | Rule |
|---|---|
| **Button** | A pill. Variants `primary` (the one filled ink control), `outline` (the everyday button), `quiet` (recedes into the chrome), `selected` (an "on" state, the 1.5 px ink edge), `destructive`, `destructiveSolid`, `link`. Sizes `sm` 36, `md` 40, `lg` 48, `xl` 56, `practice` 48, `play` 64 and the icon sizes. `shortcut` prints the key cap and sets `aria-keyshortcuts`. Loading keeps the label and adds a spinner after 300 ms. |
| **Kbd** | A key cap: 11 px, 20 px tall, a flat `--border-strong` edge, no fill. Hidden on coarse pointers. |
| **Toggle, ToggleGroup** | Pills side by side with no track. On is the 1.5 px ink edge; `invert` fills with the ink for the letter toggles; `dot` adds a hollow dot that fills. |
| **Tabs** | `look="line"`: a hairline with a 2 px ink underline on the selected tab, for sections. `look="pill"`: compact rounded tabs that never span the width, the selected one with the ink edge, for views of one thing. |
| **ChoiceRow, ChoiceRowGroup** | One of several, as rows; the chosen row has the ink edge and a check. `size="sm"` is the list form. |
| **Switch, Checkbox, RadioGroup** | An `--edge` boundary at rest; on is the ink with a knob position, a check or a dot. |
| **Field, Label, Input, Select, NumberField, Slider** | Labels above. A 1 px `--edge` border that turns to ink on hover and focus. Errors under the field with an icon and `aria-describedby`. |
| **Dialog, AlertDialog, Drawer, Popover, DropdownMenu, Tooltip, Toast** | `--raised`, one hairline, `shadow-popover` or `shadow-dialog`. AlertDialog only for deleting a song or the account. |

### 12.2 Splitune kit

| Component | Rule |
|---|---|
| **Panel** | The one docked panel: `--panel`, 340 px, a hairline towards the content, no shadow. In a Drawer it is the same content as a sheet. |
| **ListGroup, ListRow** | A quiet group head over hairline rows. A row is media, a title, one meta line and an aside (a Status, one action, a ⋯ menu). The row's link stretches to the whole row. The current row has a 2 px ink edge on its leading side. |
| **Status** | A glyph and words; each state has its own glyph shape (check in a circle, a ring that fills, dashed circle, triangle, cross in a circle, lines of music, struck clock, pause, struck cloud). Hue only for ready and failed. |
| **Stat** | A tabular figure over its label, no card. |
| **Transport** (`TransportButton`, `SpeedControl`, `LoopBadge`, `PassControl`) | Quiet 48 px controls with their key caps; Play is the 64 px filled circle. The pass prompt sits in the transport, never on the notation. |
| **StemRow, MixPresetGroup** | A stem's 4 px rule beside its name, `invert` toggles S and M, a fader and a readout in words. Presets are rows with a check. |
| **WaveformTimeline** | The song map: section chips over the waveform, the loop as an ink-edged band, the playhead a 2 px ink line. |
| **ChordChip, ConfidenceLegend** | §5. |
| **PedalHud** | One quiet line naming the source and the action, on `--raised`, outside the music. |
| **StageList, WorkerStatus, EmptyState, Skeleton, Progress, Banner, InlineError** | §13. |

### 12.3 State matrix (every interactive component, both themes, both contrast levels)

| State | Treatment |
|---|---|
| Rest | no fill; quiet controls are muted text |
| Hover | `--hover`, text to ink; supplementary |
| Pressed | scale 0.97 or `--pressed` |
| Focus | the 2 px ink outline |
| Selected, current, on | §4.5 |
| Disabled | faint text, an `--edge` boundary, no fill, never opacity; "Unavailable" in the accessible name and the reason in words where there is room |
| Loading | the label stays; a spinner after 300 ms |
| Invalid | a `--destructive` edge, an icon and the message under the field |

## 13. Feedback patterns

- **Loading:** a skeleton that matches the final layout where the layout is known; a spinner in
  the button for short actions, after 300 ms; for long jobs a determinate bar, the named stages
  and an ETA as a padded range that never sits at 99 %.
- **Empty:** no box. An icon, a heading, one sentence and the primary action.
- **Errors:** what happened, what it means, what to do. Inline, beside what failed. No raw codes.
- **Saving:** per field, "Saving…", "Saved", "Couldn't save. Try again."
- **Undo before confirm:** edits apply at once with an Undo toast. AlertDialog is for deleting a
  song or the account only.
- **Offline worker:** a calm queued line, never a stalled bar.
- **Announcements:** state changes that matter are in a polite live region; the HUD is visual
  confirmation only.

## Open questions

- Near-black and off-white grounds replace s46's pure black and white (§4.9). The owner decides
  whether to keep them.
- The reading sizes at weight 500 need the G5 music-stand test (doc 28 §6).

## Sources

`docs/design/s47-guidelines.md` lists every source with its rules: Vercel Web Interface Guidelines
and Geist, Linear's 2024 and 2026 redesign posts, Radix Colors, IBM Carbon, Uber Base Web, the
WCAG 2.2 Understanding documents, and the Soundslice and Moises help pages.
