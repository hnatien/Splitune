# s47 design direction

The decision of step s47, Phase 3. It follows the audit (`s47-audit.md`), the guidelines brief
(`s47-guidelines.md`), three working prototypes (`s47-directions/{a,b,c}/`, each with a
`rationale.md` and screenshots) and an independent judge (`s47-directions/judge.md`). Docs 26–28
are rewritten from this document in Phase 4c and are the source of truth after that.

## 1. The chosen direction

**A, "Calm workspace", with C's way of making a loop on the score and B's keyboard.**

Splitune is a desk the learner returns to every day with an instrument in their hands. The music
takes the ink and the interface recedes: navigation and tools are muted text with no fill at rest,
separators are few, lists are hairline rows, and a screen has at most one side panel. Everything
else is summoned by a key, a popover or the command palette, and every action shows its key
beside it. One selection treatment is used everywhere: an ink edge or an ink line, never a grey
fill. One filled ink control exists per view.

## 2. Why

| | Today | A | B | C |
|---|---|---|---|---|
| Notation share at 1440×900 | about 40 % | 73.5 % | 63.3 % | 75.4 % |
| Notation share at 375×812 | 0 % by default | 64.0 % | 57.1 % | 73.3 % |
| Keys to a 4-bar loop at 70 % with count-in | about 10 | 6 | 3 | 3 |
| Judge's total (7 criteria × 5) | | 27 | 24 | 27 |

- **A's weaknesses are settings; C's and B's are their concepts.** A lost points on speed and
  keyboard, which a handful of key bindings fix. C's contextual bar floats on the notation in four
  of its screenshots and its veil leaves tab digits outside the loop at about 3.0:1 in Light, under
  the 4.5:1 that text needs. B shows six or seven filled keys on one practice screen, which is the
  "one primary per view" failure the audit already found.
- **A has the clearest hierarchy without colour.** It is the only direction with one filled action
  per view across practice, library and import.
- **A carries over to the rest of the app.** Hairline rows, one panel, popovers and the existing
  ⌘K palette cover the other fifty-odd screens and the piano, drums and vocals views. B needs a
  hardware-style component family; C needs its own layer over the notation renderer for every
  instrument view.
- **The phone layout is the best of the three.** A top bar, the map, two bars a line, one status
  row and two transport rows, with nothing overlapping.

**The tie.** The judge scored A and C level at 27 and picked A. A tie between them would turn on
whether speed to a slowed loop outranks cost and hierarchy. That is not a product priority left
open here, because the borrowings in §3 give A the same three-key loop without C's floating bar or
veil. So the choice does not need the owner.

**Where I differ from the judge.**

- The judge would take B's phone "module tabs" to stop the phone mixer covering the transport. I
  keep one tools sheet instead, the same panel as on desktop with the same compact tabs, capped at
  60 % of the height and sitting above the transport, so the phone has one pattern to learn and the
  notation keeps its share when the sheet is closed.
- The judge scores B's accessibility margin highest. Its margin comes from inverting every "on"
  control. I take inversion only for small two-letter toggles (M, S) and the ink edge elsewhere,
  because inverted pills on a calm page become six competing primaries.
- The page ground. A used near-black and off-white grounds; doc 26 (s46) used pure black and pure
  white. I keep A's grounds: body text stays above 16:1, halation on small Figtree 400 drops, and
  Dark gets a real "raised" step for popovers. This reverses a decision the owner made in s46 and
  is listed as an open question in the final report.

## 3. What is borrowed

From **C, Score-first**:

- A loop is a selection on the score: tap or click two bars, or drag across bars, snapping to
  barlines, in the tab, the chord sheet and the song map. The options stay in the transport, not
  on the notation.
- Chord names are printed over the tab.
- The library shows each song's music: a strip of its waveform with sections, and the resume
  block shows the clip's bars and chords.
- Import opens the practice screen at once and every finished stage unlocks a real layer.
- The pedal rule "left means again, right means go".
- No blank band above the first system.

From **B, Instrument**:

- Key caps printed on the practice controls, and a HUD line that names the source of each action
  ("Key 4 · Loop bars 5–8", "Pedal ▶ · Play").
- `1` `2` `4` `8` loop that many bars from the current bar; Shift+5 … Shift+0 set 50 … 100 %.
- Pedal labels that change with the moment, shown in the transport.
- Toggles carry a hollow or filled dot as well as their edge; a control that cannot be used yet
  has a dashed edge and says why ("Unavailable · after the beat is found").
- 44 px targets in browse screens and 48 px on practice, with no 32 px faces.

Dropped: A's double-press pedal gesture, C's veil, C's floating bar, B's always-visible module
grid, B's square keys.

## 4. Token principles

1. **Three tiers.** Primitives (two neutral ramps and the meaning hues), roles, component tokens.
   Components read roles only; component tokens read roles or carry a contrast-tested literal.
2. **A neutral ramp of twelve role-numbered steps per theme**, zero chroma, named `--gray-1` to
   `--gray-12`. A step means the same job in both themes, and the two ramps are tuned separately,
   not mirrored.

   | Step | Job | Role token |
   |---|---|---|
   | 1 | page and notation paper | `--background`, `--paper` |
   | 2 | the one side panel, wells, skeletons | `--panel` |
   | 3 | popovers, menus, sheets, dialogs, toasts | `--raised` |
   | 4 | hover; the wash under a current bar or row | `--hover`, `--wash` |
   | 5 | pressed | `--pressed` |
   | 6 | decorative hairline, no minimum | `--border` |
   | 7 | the ring of a control that also has a label or icon | `--border-strong` |
   | 8 | a control's only boundary, slider tracks, staff lines: ≥ 3:1 on steps 1–4 | `--edge`, `--staff` |
   | 9 | dimmed chrome text: ≥ 4.5:1 on steps 1–4 | `--faint-foreground` |
   | 10 | secondary text: ≥ 7:1 on step 1 | `--muted-foreground` |
   | 11 | hover of a filled ink control | `--primary-hover` |
   | 12 | ink: text, notation, the filled control, selection, focus, playhead, loop edges | `--foreground`, `--ink`, `--primary`, `--selected`, `--ring` |

3. **Selection is ink, not a fill.** There is no selected-surface token. Selected, current and
   "on" are a 1.5 px ink edge, a 2 px ink line or an inversion, each ≥ 3:1 against its neighbours
   and each carrying an ARIA state. `--wash` never appears without an ink line.
4. **Colour means something and never stands alone.** `--unsure`, `--success`, `--destructive`,
   the six `--stem-*` and the two hand hues. Each is paired with a shape, a dash, a glyph or a word.
   The digit of an unsure note stays ink.
5. **Role names stay where the job is unchanged** (`background`, `foreground`, `muted-foreground`,
   `faint-foreground`, `primary`, `border`, `border-strong`, `ring`, `destructive`, `success`,
   `unsure`). Names whose job caused the audit's failures go: `card` and `popover` become
   `raised`; `muted` becomes `panel`; `accent`, `secondary` and `capsule` (grey selection fills)
   are removed in favour of `hover` plus an ink edge; `input` becomes `edge`; the `sidebar-*` and
   `chart-*` aliases are removed.
6. **Shape.** Controls are pills or circles. Fields 10 px, the panel and popovers 14 px, dialogs
   and sheets 20 px, media 6 px. A child's radius never exceeds its parent's.
7. **Lines.** One hairline per edge. Whitespace before rules. Shadows only under floating layers,
   two translucent black layers, never the only boundary.
8. **Targets.** `--target-min` 24 (song-map section chips, fine pointers only), `--target` 44,
   `--target-practice` 48, `--target-play` 64, `--target-stand` 88. Density is set per shell by
   `data-density`.
9. **Focus.** A 2 px solid ink outline at a 2 px offset, 3 px under increased contrast, −1 px on
   fields; `:focus-visible` only.
10. **Motion.** 100 ms (press, hover), 200 ms (popovers, tabs), 300 ms (dialogs, sheets, the
    panel), 400 ms (layout morphs only); enter decelerates, exit accelerates; `transform` and
    `opacity` only; durations are 0 under reduced motion and the playhead steps.
11. **Appearances.** Dark, Light and Stage (Dark's colours with larger reading sizes), each with
    an increased-contrast variant and a forced-colours mapping, all tested in `contrast.test.ts`.

## 5. Type scale

Figtree at 400 and 500 only. A text role is 400 with the looser line height; a label role is 500
with the tighter one. Tabular figures for every number that changes. Sentence case. Nothing below
11 px; fields are 16 px on coarse pointers.

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `text-kbd` | 11 / 14 | 500 | key caps only |
| `text-caption` | 12 / 16 | 400 | captions, meta lines, bar numbers |
| `text-label-sm` | 13 / 18 | 500 | secondary labels, chips, table heads |
| `text-body-sm` | 13 / 18 | 400 | secondary text, descriptions |
| `text-label` | 14 / 20 | 500 | controls, tabs, row titles in dense lists |
| `text-body` | 15 / 22 | 400 | body |
| `text-title` | 17 / 24 | 500 | song titles, panel titles, readouts |
| `text-lead` | 17 / 26 | 400 | long-form and marketing lead |
| `text-heading` | 22 / 28 | 500 | page and dialog headings, ETA |
| `text-readout` | 28 / 34 | 500 | count-in, large readouts |
| `text-display` | 32 / 38 | 500 | marketing section heads, empty-state heads |
| `text-hero` | clamp(40, 5vw, 56) / 1.05 | 500 | Home hero only |
| `text-read-*` | distance-scaled | 500 | notation reading sizes: tab digits, chord names, bar numbers |

The wordmark is drawn as a logotype and is outside the scale. The notation renderer's own digit
weight is the one documented exception to 400/500.

## 6. Layout

**App shell (library, settings).** From 1024 px: a 232 px rail (wordmark, Library, Add song with
its key, recent songs, usage, the worker's state, the account) and one main column; no top bar.
Below 1024 px: no rail, a 48 px top bar and a bottom navigation bar. The current item has a 2 px
ink edge.

**Practice, desktop.** Top bar 52 px (back, title and one meta line, Tab / Chords tabs, the unsure
chip, Actions ⌘K). Song map 62 px (section chips over the waveform). The notation edge to edge,
with a 32 px key row. Transport 80 px: transport keys and Play (64 px) with the bar readout on the
left; the loop toggle and loop line in the centre, replaced by the pass prompt after a looped
pass; count-in, speed and Tools on the right. The one panel (340 px, closed by default) holds
Loop, Mix, Progress and Fix as compact tabs, and the analysis while a song is getting ready.

**Practice, phone.** Top bar 48 px, map 52 px, the notation at two bars a line, a 56 px status row
(loop line, pass prompt or analysis line) and two transport rows. The panel becomes a sheet above
the transport, at most 60 % of the height. Getting ready, the part question and every banner use
the status row and the sheet, so nothing is desktop-only.

**Library.** A Continue block with the one filled control, then hairline rows grouped by what each
song needs: Getting ready, Needs you, Ready to practise. A row has the song's music strip, title,
one meta line, a status glyph with words, one action, and a ⋯ menu.

**Forms and settings.** One column, labels above fields, rows divided by hairlines, each field
saving on its own. Errors sit under the field with an icon; focus moves to the first error; submit
is never disabled in advance.

## 7. Keyboard and pedal

Existing keys stay (Space / Enter, ← →, `,` `.`, L, M, C, N, J, K, E, `[` `]`, P, `?`, ⌘K, ⌘Z).
New, all subject to the single-key switch and to relearning:

| Key | Action |
|---|---|
| `1` `2` `4` `8` | loop that many bars from the current bar and turn the loop on |
| Shift+← / Shift+→ | move the loop back or forward by its own length |
| Shift+5 … Shift+0 | speed 50 … 100 % |
| S | open speed with the field focused |
| R or Home | from the top of the loop or the song |
| I | count-in: off, 1 bar, 2 bars |
| X | open or close the panel on Mix |
| V | switch between the notation views |
| U | show or hide unsure marks |
| Y | accept the suggested fix on the selected unsure spot |

A slowed loop is three keys: `4`, Shift+7, Space.

**Pedal** (Page Up / Page Down, or a learned key per side): left means again, right means go.

| When | Left | Right |
|---|---|---|
| Stopped or playing | back to the loop start, or back a bar | play or pause |
| After a looped pass | Not yet | Felt clean |
| In Fix | previous unsure spot | next unsure spot |

The transport shows the two current meanings, and every key or pedal press is confirmed by the
HUD within 100 ms, outside the music.

## 8. Components

`apps/web/app/ui` after the redesign. **New** components are marked; everything else is rebuilt to
the tokens above with stories in both themes.

- **Actions:** Button (primary, outline, quiet, destructive; optional `shortcut` key cap), Kbd,
  Toggle and ToggleGroup (ink edge when on, dot option, inverted option for M / S), Tabs (compact
  rounded tabs; the segmented look is removed), Switch, Checkbox, RadioGroup.
- **Fields:** Field, Label, Input, Select, NumberField, Slider, SaveStatus, DropZone.
- **Layers:** Dialog, AlertDialog, Drawer (sheets), Popover, DropdownMenu, Tooltip, Toast,
  **Panel** (the one side panel and its sheet form).
- **Structure:** **ListRow** and **ListGroup** (hairline rows and their group heads),
  Separator, ScrollArea, EmptyState, Skeleton, Spinner, Progress, Meter, **Status** (glyph plus
  words), Banner and InlineError, StepDots, CoachMark, WorkerStatus, Brand, icons.
- **Music:** ChordChip, ConfidenceLegend, LoopBadge, PassControl, PedalHud, SpeedControl and
  SpeedPanel, SpeedLadder, StageList, StemRow, **MixPresetList** (rows with a check),
  TransportButton, WaveformTimeline (the song map), WaveformPreview, **MusicStrip** (a song's
  waveform and sections in a list row), BeatPulse, ProgressChart, Sparkline, **Stat**.
- **Removed:** Card, SongCard and InstrumentTile (rows replace cards), ChoiceCard and RadioCard
  (replaced by **ChoiceRow**), StatCard (replaced by Stat), MixPresetGroup (replaced by
  MixPresetList), Badge (replaced by Status and by plain labels).
