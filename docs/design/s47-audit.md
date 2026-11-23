# s47 audit of the current UI

The state of the web UI at `bd2c77e`, before the s47 redesign. Four scorers judged the screens of
`docs/design/s47-inventory.md` against the checklist in `docs/design/s47-guidelines.md`, from 2,027
screenshots (Dark and Light at 1440, 768 and 375) and the route code. The screenshots are in
`docs/design/s47-before/<group>/`, each group with an `index.md`; that folder is not tracked in git
because of its size (about 150 MB).

Scores are 1–5 per screen: 5 meets the checklist with only polish left, 4 is sound with minor issues,
3 works but has several medium issues or one serious one, 2 has serious problems in hierarchy, flow
or accessibility, 1 is broken. Issue severity is critical (blocks a task or fails WCAG AA), high,
medium or low.

## Top 10 problems, ranked

1. **The phone practice screen is broken (1/5).** The header overflows, so the view switch covers
   "Back to library" and "Tab" starts off-screen. The glance text runs over the song map and the
   transport. The notation gets 0 % of the screen by default and the transport bar takes 32 % of
   the height. Getting ready, the part question and the analysis-failed card never show, and
   Level/Capo, Progress, master mute and count-in without a loop cannot be reached at all.
   `s47-before/focus/practice--paused--dark--375.png`
2. **The music is not the hero.** At 1440×900 the notation gets about 40 % of the viewport, between
   a 264 px Now column, a 380 px inspector and a 96 px dock, and the third system is cut off. The
   library cards show an instrument tile and status pills but nothing of the song, and Home shows
   gear photography and no tab, chords or stems.
   `s47-before/focus/practice--ready-loop-active-tab--dark--1440.png`
3. **Selected and current states are below 3:1 everywhere (WCAG 1.4.11).** The segmented capsule is
   1.09:1 in Light and 1.15:1 in Dark, the current nav item 1.09–1.27:1, and the current bar, the
   loop fill and the "Bar" playhead style differ from the page by 1.08–1.27:1. This is on Pricing,
   Library, Add song, Settings, the shell, the command palette and the notation.
   `s47-before/app/settings-display--default--dark--1440.png`
4. **Confidence is carried by colour alone (WCAG 1.4.1).** Outside the selected spot, unsure notes
   and chord chips lose their dashed box and "?", leaving a blue digit at 2.48:1 against the ink in
   Dark, and the blue stays when "Show uncertainty" is off.
   `s47-before/focus/practice--playhead-bar--dark--1440.png`
5. **Controls overflow or get covered outside the wide desktop path.** At 768 with a mouse the
   click, mix and volume controls are off-screen; on tablet the pass prompt pushes the loop toggle
   off the left edge; coach marks, the correction toast and the pass prompt sit on the controls
   they refer to; on piano songs the keyboard paints over the inspector's tabs at 1440.
   `s47-before/focus/practice--paused--light--768.png`
6. **Setting up a loop is slow and has no key.** A 4-bar loop at 70 % with a count-in takes 5 clicks
   on desktop, 7–9 taps on a phone and about 10 key presses, because no key sets a loop. Accepting
   a fix has no key or pedal action, and touch and pedal users cannot step through unsure spots
   while the editor sheet is open.
7. **Bar numbers disagree on songs with a pickup.** The printed tab counts the pickup as bar 1, the
   Now column and the loop label do not, so "bars 7–10" brackets printed 8–11.
   `s47-before/focus/practice--songmap-drag-scrub--light--1440.png`
8. **Two forms break at ordinary widths.** The Record tab's panel spills over "Your part" at 768
   and 1440, and the Keyboard & pedal table is clipped mid-word at 375 with its "Press the pedal…"
   prompt below the table, off-screen.
   `s47-before/app/add-song--record-tab-recording--light--1440.png`
9. **Failure and validation states are silent or wrong.** An invalid link gets a greyed-out submit
   and no message; submit buttons start disabled with no reason; focus does not move to the first
   error; a failed plans request drops Pricing to the root error page, which offers "Go to library"
   to signed-out visitors; the mock portal shows a payment failure in the success style.
   `s47-before/app/add-song--link-tab-invalid-url--dark--375.png`
10. **The system's own rules have drifted.** Weights 600, 650 and 700 appear beside Figtree 400/500;
    several views carry two filled ink pills; fields are 15 px on phones, so iOS zooms on focus;
    the How it works scenes scale their text to about 6–7 px at 375; signed-in visitors get the
    signed-out Home hero.

## Scores before the redesign

| Group | Screen | Score |
|---|---|---|
| Public | Home | 2 |
| Public | How it works | 3 |
| Public | Pricing | 3 |
| Public | Legal | 4 |
| Public | Sign in / Sign up | 4 |
| Public | Mock checkout | 4 |
| Public | Mock portal | 3 |
| Public | Account deleted | 4 |
| Public | Unsupported browser | 3 |
| Public | Not found / error boundary | 3 |
| Public | Marketing shell and system banners | 3 |
| App | Library | 3 |
| App | Add song: File | 3 |
| App | Add song: Link | 3 |
| App | Add song: Record | 2 |
| App | Settings: Account | 3 |
| App | Settings: Privacy / data export | 4 |
| App | Settings: Delete account | 4 |
| App | Settings: Usage | 3 |
| App | Settings: Plan | 3 |
| App | Settings: Display & practice | 3 |
| App | Settings: Keyboard & pedal | 2 |
| App | Settings: About | 3 |
| App | App shell: top bar and phone bottom nav | 3 |
| App | Command palette | 4 |
| App | Account menu | 4 |
| App | Usage popover | 3 |
| App | Upgrade sheet | 3 |
| App | Toasts, drop overlay and system banners | 3 |
| Focus | Onboarding steps 1–4 | 4 |
| Focus | Onboarding guide and coach marks | 3 |
| Focus | Save progress sheet and Saved | 4 |
| Focus | Practice loading and error | 3 |
| Focus | Getting ready / analysing | 2 |
| Focus | Partial analysis states and their banners | 3 |
| Focus | Fix tab and unsure-spot queue | 3 |
| Focus | Editor sheet (touch) | 2 |
| Focus | Full editor | 3 |
| Focus | Focus shell bar | 2 |
| Practice | Desktop layout (≥ 1180) | 3 |
| Practice | Narrow desktop / tablet layout | 2 |
| Practice | Phone layout | 1 |
| Practice | Song map | 3 |
| Practice | Notation views | 3 |
| Practice | Transport dock / bar | 2 |
| Practice | Now column / strip | 3 |
| Practice | Inspector: Loop | 3 |
| Practice | Inspector: Mix, mixer drawer and mini-mixer | 3 |
| Practice | Inspector: Progress | 3 |
| Practice | Speed panel and speed ladder | 3 |
| Practice | Count-in and pass prompt | 2 |
| Practice | Confidence marks and legend | 2 |
| Practice | Display and More popovers | 3 |
| Practice | Shortcuts overlay and pedal HUD | 3 |
| Practice | Banners / loading / error | 2 |

Measured on the practice screen: the notation gets about 40 % of 1440×900, about 42 % of 768×1024
and 0 % of 375×812 by default. Audio plays in 1 action from opening the screen. A visitor reaches
audio on an example song in 4 actions from `/start`.

Limits of this audit: focus rings cannot be seen in static screenshots, so focus was judged from
the code. Two findings in the Focus section rest on screenshots only (the chords-only fallback
banner missing from its story, and E on a tablet showing no editor sheet). States that need a
running worker, an account at its allowance or billing state were captured from Storybook, not the
live app. The local example songs point at builds missing from the bucket, so live example shots
were taken with requests rerouted to the latest existing builds.

The four sections below are the scorers' own, unedited.

---

## Practice screen (_focus)

The desktop practice screen (≥ 1180 px, fine pointer) holds together. It has one filled Play, 64 px transport targets, a good loop model (tap two bars, steppers, ×2 / ÷2, fine-tune) and an inspector that keeps loop, mix and progress one click away. The music is not the hero, though. At 1440 × 900 the notation gets about 40 % of the viewport, and the Now column, the inspector and the 85 px song map take most of the rest. The touch layouts are much weaker. The tablet transport bar takes three rows (241 px) and breaks when the pass prompt appears. The phone opens on a glance view with no notation. Its top bar covers "Back to library", the glance text runs into the song map and transport, and Level/Capo, the Progress tab, the shortcuts list and (without a loop) count-in cannot be reached at all. Some faults cut across every layout and theme: the tab's printed bar numbers disagree with the app's bar numbers on songs with a pickup, the segmented "selected" capsule fails 1.4.11, and the unsure marks sometimes fall back to blue alone. Contrast figures below come from the OKLCH tokens in `packages/ui-tokens/src/themes.css` and `primitives.css`, converted to sRGB luminance (not read from pixels). Region sizes come from Playwright measurements of the `screens-practice--loop-active` story and from the screenshots. Pixel estimates are marked "≈".

### Q1. Is the music the hero?

| Viewport | Notation area | Share | What competes with it |
|---|---|---|---|
| 1440 × 900 (desktop, fine) | 796 × 658 px between the Now column (264 px) and the docked inspector (380 px); header 61, song map 85, dock 96 | **≈ 40 %** (the tab itself uses ≈ 726 px of the 796; the third system is cut off at the bottom) | Now column with an ≈ 90 px current chord, inspector, song map, dock, legend row |
| 768 × 1024 (tablet portrait, coarse) | 435 px tall (272–707) under a 211 px chord strip, over a 76 px song map and a 241 px transport bar | **≈ 42 %** (≈ 56 % in the story with a 72 px strip; ≈ 69 % on a fine-pointer 768 window). Only one 4-bar system shows, at a large reading size | Chord strip with a 250 × 170 chord card and diagram, three-row transport bar, song map |
| 375 × 812 (phone portrait, coarse) | Default view is the glance (418 px = 51 %, chords only, **0 % notation**). Tab view ≈ 440 px (≈ 54 %) but four bars per system collide; Notes view is a 120 px strip (**≈ 15 %**) under a 240 px chord card | 0–54 % depending on view | Transport bar at 257 px (**32 %** of the height), song map 76 px, huge chord card |

### Q2. Fewest steps to practise

| Goal | Desktop | Phone (portrait) |
|---|---|---|
| (a) Audio playing | **1** (Space or Play; `#main` is focused on load) | **1** (Play) |
| (b) 4-bar loop at 70 % with count-in, playing (defaults: speed 100 %, count-in on at 1 bar) | **5**: click the first bar, click the fourth bar, click the speed readout, click "70 %", Play. Keyboard only: ⌘K + "loop 1-4" + Enter, `,` × 6, Space ≈ **10**, because no key sets a loop | **7** from the Tab view: Tab (a half-clipped pill), tap bar, tap bar, speed readout, 70 %, dismiss, Play. **9** from the default glance: Loop this bar, Loop pill, ×2, ×2, dismiss, readout, 70 %, dismiss, Play |

### Q3. One key or one pedal press away?

Pedal-bindable means the action is in `ACTIONS` (`model/keymap.ts`), so "Learn this pedal" can bind it. Columns D / T / P give the visible control on desktop, tablet and phone. "—" means there is no control in that layout.

| Action | Key | Pedal | Desktop | Tablet | Phone | Presses with no key |
|---|---|---|---|---|---|---|
| Play / pause | Space, Enter | yes | dock | bar | bar | — |
| Restart (loop) / back a bar | ←, PgUp | yes | dock | bar | bar | — |
| Next bar | →, PgDn | yes | dock | **—** | **—** | key only on touch |
| Previous bar while looping | none (← restarts the loop) | no | — | — | — | not available |
| Loop on / off | L | yes | **— (the pill opens the Loop tab; only "Clear loop" there)** | repeat toggle | repeat toggle | — |
| Set loop | none (⌘K "loop a–b") | no | tap 2 bars / map handles / steppers | tap 2 bars / map handles / popover steppers | glance "Loop this bar", else Tab view + 2 taps | D 2, T 2, P 2–4 |
| Speed down / up | `,` / `.` (Shift 1 %) | yes | dock − / + | bar | bar | — |
| Speed ladder | none | no | Loop tab switch | Loop pill popover | Loop pill popover | D 1–2, T 2, P 2 (needs a loop and the flag) |
| Count-in | none | no | dock button | bar button | **Loop popover only, and only with a loop** | D 1, T 1, P 2 / unreachable without a loop |
| Metronome / click | none | no | dock | bar | **Mix → All n stems → Click** | D 1, T 1, P 3 |
| Mute my part | M | yes | via Mix tab M | drawer M | mini-mixer M | — |
| Solo / mute a stem | none | no | Mix pill → S/M | Mix → S/M | Mix → All stems → S/M | D 2, T 2, P 3 (no solo in the mini-mixer) |
| Mix preset | none | no | Mix pill → card | Mix → card | Mix → chip | 2 everywhere |
| Switch view | none (⌘K "View …") | no | top-bar segmented | top-bar segmented | segmented, "Tab" clipped at x = −15 | 1 |
| Felt clean / Not yet | C / N | yes | pass prompt after each pass | bar (always) | ✓ / ↺ icons only | — |
| Next / previous unsure spot | J / K | yes | Fix tab | — (editor sheet via a chord) | — | touch: tap an unsure chord in the strip |
| Edit this bar | E | yes | Fix tab / chord click | tap a chord in the strip | Tab view → tap a strip chip (not in glance) | T 1, P 2 |
| Display settings | none (⌘K "Display") | no | Aa | Aa | Aa | 1 |
| Capo / level | none | no | Now column rows | strip-end button | **unreachable** | D 1, T 1, P — |

### Q4. Hierarchy without colour

- Desktop hierarchy reads mostly through size and position: Play is the only filled control, and the chord readouts are large. On tablet, **Felt clean is a second filled ink pill** next to Play.
- Where colour (or a sub-3:1 grey) is the only carrier:
  - **Unsure tab digits.** The dashed box and "?" are an HTML overlay. In `playhead-bar`, `mix--soloed`, `uncertainty-off` and the light Riff captures the overlay is missing, so only the blue digit remains: 2.48:1 against ink in Dark (fails 1.4.1) and 3.17:1 in Light (borderline). With "Show uncertainty" off the digit **stays blue**.
  - **Current bar vs loop vs paper.** `--bar-current` vs paper is 1.27:1 (Dark) / 1.18:1 (Light); `--score-loop-fill` vs paper 1.14 / 1.09; current bar vs loop fill 1.12 / 1.08. With the playhead set to "Bar" the current bar is that wash alone (fails 1.4.11).
  - **Selected segment.** The capsule is 1.15:1 (Dark) / 1.09:1 (Light), with a muted-to-foreground text change of about 2.3–2.5:1.
  - **"Mix changed".** A 6 px dot with sr-only text.
  - **Fix count badge.** Blue, but it carries a number, so it is acceptable.
- Second cues already in place: stems (colour rule plus name), piano hands (L / R letters), vocal notes (note names), edited (green underline), "Rough" (warning icon) and the beat pulse (square vs circle).

### Q5. Hit targets and contrast

| Element | Measured | Verdict |
|---|---|---|
| Dock restart / play / next / count-in, loop pill, speed − / + | 64 px | ✓ practice 64 |
| Dock click, mix pill, volume trigger | 52 px | ✓ 48 |
| Volume slider thumb | 20 × 20 (track clickable) | ✗ under 24 for the thumb; the track saves 2.5.8 |
| Position readout, inspector tabs, view-switch items | 48 | ✓ |
| Loop tab From / To inputs | 71 × 40 | ✗ under the 48 practice floor |
| Stem M / S | 48 box, 32 painted | ✓ target; the face reads small |
| Now-column chips / tablet strip chips | 41 × 48 / 33–38 × 48 | ✗ width under 44/48 (passes 24) |
| Song-map loop handles | 44 × 44, invisible at rest | target ✓; affordance ✗ |
| Song-map chips | none exist (sections arrive in s41b) | — |
| Playhead line, loop bracket, loop edges | `--signal` = ink: 21:1 Dark, 19.4:1 Light | ✓ |
| Staff lines | 4.42:1 Dark, 3.95:1 Light (3.47 / 3.34 on the current-bar wash) | ✓ |
| Waveform peaks | 3.98:1 Dark, 3.50:1 Light | ✓ |
| Dock sub-labels ("88 BPM", "2 stems"), `--faint-foreground` on card | 6.26:1 Dark, 5.51:1 Light | AA ✓, below the 7:1 project floor |
| Pressed transport toggle (`--primary-soft` fill + `--primary-line` ring) | ring 5.3:1 Dark, 3.64:1 Light | ✓ |
| Unpressed outlined controls (`--border-strong` ring) | 1.73:1 on card (Dark), 1.61:1 (Light) | acceptable only because each has an icon or text |
| Focus ring (`--ring` = foreground, 2 px) | 18–21:1 | ✓ |

### Desktop layout (≥1180)
Score: 3/5

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Notation gets ≈ 40 % of 1440 × 900. The Now column (264) and inspector (380) take 644 px of width, the third tab system is cut off by the dock, and the legend sits on top of it | high | Navigation and chrome recede; music leads | docs/design/s47-before/focus/practice--ready-loop-active-tab--dark--1440.png |
| Printed tab bar numbers count the pickup as bar 1, but the app (Now column, loop label, Notes, chord sheet) calls it "Pickup". "Now · bar 6" sits on printed bar 7, and loop "bars 7–10" brackets printed 8–11. On the Riff song the bracket and the numbers disagree again | high | Loops by bar number; layouts with real content | docs/design/s47-before/focus/practice--songmap-drag-scrub--light--1440.png |
| Piano: the chord-strip keyboard overflows into the inspector and paints over its Loop / Mix / Progress / Fix tabs and the "C4" label | critical | Layout; 2.4.11 (tabs hidden) | docs/design/s47-before/focus/practice--piano--dark--1440.png |
| Segmented selection (view switch, Rest, Count-in, speed presets) is the grey capsule, 1.15:1 Dark / 1.09:1 Light | critical | 1.4.11; Pills and selection states (Fix) | docs/design/s47-before/focus/practice--ready-loop-active-tab--light--1440.png |
| Selection treatments are mixed on one screen: capsule (Tab / Notes / Chords), ink ring (piano Notes, Appearance, the current chord card) and grey fill (Loop tab presets) | medium | One selection treatment (inversion or ink edge) | docs/design/s47-before/focus/practice--piano-notes--light--1440.png |
| The chord diagram in the Now column touches the chord name ("Bm" meets the grid) | low | Spacing and density | docs/design/s47-before/focus/practice--view-notes--dark--1440.png |

What works and should survive: the five-region model with a single filled Play, the docked inspector that never covers the dock, and the large Now chord with next / then chords.

### Narrow desktop / tablet layout
Score: 2/5

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Fine-pointer 768: the dock does not wrap. Count-in is cut off and the click, mix and volume controls are off-screen (unreachable by mouse) | critical | 2.5.8 / reachability; dock never moves | docs/design/s47-before/focus/practice--ready-loop-active-tab-narrow-desktop--dark--768.png |
| Tablet with the pass prompt showing: the transport wraps and pushes the loop toggle, "−" and the prompt off the left edge, and the prompt overlaps the speed and mix row | critical | 2.4.11; layout | docs/design/s47-before/focus/practice--paused--light--768.png |
| Tablet transport bar is 241 px in three rows and holds two loop controls (repeat toggle and loop pill) | high | Media and player UI; chrome recedes | docs/design/s47-before/focus/practice--view-tab--light--768.png |
| Two filled ink pills (Play and Felt clean) | medium | Exactly one filled pill | docs/design/s47-before/focus/practice--view-tab--dark--768.png |
| "Back to library" is covered by the view switch (only "‹ Back" is partly visible; at narrow desktop only "‹") | high | Navigation uses real links, visible | docs/design/s47-before/focus/practice--ready-loop-active-tab-narrow-desktop--dark--768.png |
| No inspector on tablet: Progress is unreachable, Fix opens only through a chord, and the mixer drawer (modal = false) covers the right half of the transport including the loop pill | high | 2.4.11; persistent panels must not cover the dock | docs/design/s47-before/focus/practice--mixer--dark--768.png |
| The tab shows one 4-bar system at a large size, and a stray "Loop · bars 7–10" label floats under bar 4 while the loop is off-page | medium | Loop context visible | docs/design/s47-before/focus/practice--view-tab--dark--768.png |
| No next-bar button | medium | Every action has a control or key | docs/design/s47-before/focus/practice--view-tab--light--768.png |

What works and should survive: the coarse-pointer 64 px buttons, the pass pair living in the bar, and the song map sitting next to the thumbs.

### Phone layout
Score: 1/5

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| The top bar overflows to the left (justify-end): "Back to library" sits under the view switch (`elementFromPoint` hits the switch) and "Tab" starts at x = −15 | critical | Navigation; 2.5.8 | docs/design/s47-before/focus/practice--ready-loop-active-tab--dark--375.png |
| The glance view overflows: "Bars 7–10 · 70 %" and "Bar 8.2" run over the song map, the Play and loop buttons, and the speed readout; the chord diagram is cut off at the right edge | critical | Layout; 2.4.11 | docs/design/s47-before/focus/practice--paused--dark--375.png |
| The default view has no notation at all (glance), and the Tab view collides rests with digits at four bars per 300 px | high | Music is the hero | docs/design/s47-before/focus/practice--tab-without-chords-phone--light--375.png |
| Level / Capo are unreachable (`ChordStrip compact` drops `ScoreTools`; the glance has none). There is no master volume or mute. Count-in exists only in the loop popover with a loop. Progress and the shortcuts list are absent | high | Every practice action reachable | docs/design/s47-before/focus/practice--more-panel--dark--375.png |
| The transport bar takes 257 px (32 % of the height). Felt clean / Not yet are icon-only ✓ / ↺ (↺ reads as "restart") | high | Hierarchy; labels | docs/design/s47-before/focus/practice--ready-loop-active-tab--light--375.png |
| The loop popover is fixed at 24 rem (384 px) on a 375 viewport, and its title and "Bars 7–10" are pushed above the screen | high | Layout; 2.4.11 | docs/design/s47-before/focus/practice--popover-loop-pill--dark--375.png |
| The Notes view is a 120 px strip with ≈ 9 px fret numbers under a 240 px chord card | high | No text below 11 px; music leads | docs/design/s47-before/focus/practice--view-notes--light--375.png |
| Glance hierarchy is inverted: the current "No chord" at 400 sits above a bolder next chord "Am" at 500 | medium | Hierarchy by size / weight | docs/design/s47-before/focus/practice--glance--light--375.png |

What works and should survive: the glance idea (current chord, next chord, bar.beat and speed readable from the stand) and "Loop this bar" as a one-tap loop.

Reachability check for the capabilities the capture could not reach on phone portrait (code-verified):

| Capability | Phone | Tablet |
|---|---|---|
| Tab view from Chords | Hard to find: 39 px of the clipped pill is tappable | reachable |
| Level / Capo popover | **Unreachable** | reachable (strip end) |
| Mix "pill" popover | No pill; the sliders button opens the sheet (reachable, icon-only) | reachable (drawer) |
| Loop by bars | Hard to find: no bars in the glance; Tab view taps, popover steppers, or "Loop this bar" + ×2 | reachable |
| More → Keyboard shortcuts | **Unreachable** (`MorePanel desktop` only; the overlay mounts only on desktop) | **unreachable** |
| More → Open full editor | **Unreachable** by design (desktop only) | **unreachable** by design |
| Tap a chord to edit | Unreachable in the glance (chords are not buttons); reachable from Tab view strip chips | reachable |
| Pass-prompt and speed-ladder toggles | Hard to find: loop popover, only with a loop and (ladder) the flag | same |
| Metronome | Hard to find: Mix → All n stems → Click | reachable in the bar |
| Master mute | **Unreachable** (no `VolumeControl` on phones) | reachable |
| Count-in without a loop | **Unreachable** | reachable |
| Progress tab | **Unreachable** | **unreachable** |

### Song map
Score: 3/5

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| No section chips yet. The ruler labels every 8 bars ("1", "9") in 11 px `--faint-foreground`, so the map cannot target a bar by number | medium | Sections are labelled chips; tapping one loops it | docs/design/s47-before/focus/practice--songmap-drag-scrub--light--1440.png |
| Loop handles are invisible at rest (opacity 0 until hover / focus); on touch there is no visible grip | medium | Never drag-only; affordance visible | docs/design/s47-before/focus/practice--ready-loop-active-tab--light--1440.png |
| Placement changes by layout: under the top bar on desktop, above the transport on touch | low | Consistency across layouts | docs/design/s47-before/focus/practice--view-tab--light--768.png |
| 85 px of height on desktop for a single lane | low | Music leads | docs/design/s47-before/focus/practice--ready-loop-active-tab--dark--1440.png |

What works and should survive: the loop band with ink edges (21:1), keyboard-nudgeable 44 px handles, the bar-snapped seek and drag-scrub, and the peaks at ≥ 3.5:1.

### Notation views
Score: 3/5

| View | Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|---|
| Tab | Bar numbers off by one against the app when a song has a pickup (see Desktop) | high | Loops by bar number | docs/design/s47-before/focus/practice--count-in-counter--dark--1440.png |
| Tab | Current bar, loop fill and paper differ by 1.08–1.27:1; the "Bar" playhead leaves the current bar as a wash only | critical | 1.4.11; playhead is a line, block or bar highlight ≥ 3:1 | docs/design/s47-before/focus/practice--playhead-bar--light--1440.png |
| Tab | Unexplained "!" marks above some bars (not in the legend) | low | Errors / marks explained | docs/design/s47-before/focus/practice--view-tab--light--1440.png |
| Notes (guitar lanes) | Note circles ≈ 22 px with 13 px digits on desktop; ≈ 14 px on phone | medium | No text below 11 px | docs/design/s47-before/focus/practice--view-notes--dark--1440.png |
| Chords (sheet) | Loop bars are shown by a 1.09:1 grey fill only; cells have a half-border shape; "F#m" uses "#" while the strip uses "♯" | high | 1.4.11; consistency | docs/design/s47-before/focus/practice--view-chords--light--1440.png |
| Piano chart | The keyboard overflows over the inspector (see Desktop); the dark capture lost its Chart / Notes / Staff switch | critical | Layout | docs/design/s47-before/focus/practice--piano--light--1440.png |
| Piano roll / staff | Two segmented groups in the top bar; the selected view uses an ink ring while Hands uses the capsule; the staff story still shows the roll | medium | One selection treatment | docs/design/s47-before/focus/practice--piano-staff--dark--1440.png |
| Drums | Hits are ≈ 14 px squares in a large empty grid; the key line is 13 px text | medium | Music legible at distance | docs/design/s47-before/focus/practice--drums--dark--1440.png |
| Vocal melody | The strip holds six controls (First note, loop, On / Quiet / Off, Range, options) and a second loop toggle | medium | Chrome recedes | docs/design/s47-before/focus/practice--vocal-melody--light--1440.png |
| Glance | Overflow and inverted weights (see Phone) | critical | Layout | docs/design/s47-before/focus/practice--paused--dark--375.png |

What works and should survive: ink notation at 19–21:1 with staff lines ≥ 3.9:1, hand letters (L / R) on the piano roll, note names on vocal notes, and the chord sheet's "Pickup" naming.

### Transport dock / bar
Score: 2/5

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Narrow-desktop dock overflow, and the tablet bar breaking under the pass prompt (see the layouts above) | critical | Reachability; dock never moves | docs/design/s47-before/focus/kit-transport--pass-prompting--light--768.png |
| Desktop has no visible loop on / off: the pill opens the Loop tab, which offers only "Clear loop"; the toggle exists only as L | medium | Every action has a control and a key | docs/design/s47-before/focus/practice--ready-loop-active-tab--light--1440.png |
| Count-in ("••••") and click are icon-only, with names only in tooltips | medium | Shortcuts and labels beside actions | docs/design/s47-before/focus/practice--pass-prompt--dark--1440.png |
| Below 1440 the mix pill keeps only its icon, and the volume moves into a popover | low | Hierarchy | docs/design/s47-before/focus/practice--ready-loop-active-tab-narrow-desktop--light--768.png |
| Volume thumb is 20 px | low | 2.5.8 (track saves it) | docs/design/s47-before/focus/practice--ready-loop-active-tab--dark--1440.png |
| Tooltips crowd and clip each other along the dock ("Restart lo", "Spa") | low | Focus not obscured | docs/design/s47-before/focus/practice--pass-prompt--dark--1440.png |

What works and should survive: the 64 px restart / play / next cluster, the position readout that switches between bar.beat and time, the loop pill with pass and rest detail, the speed readout carrying "→ 100" while the ladder runs, and the "Your part loud · 2 stems" mix pill.

### Now column / strip
Score: 3/5

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| The tablet strip's current chord is a 250 × 170 card (ink ring plus grey fill) with a 140 px diagram, pushing the notation down by 211 px; upcoming chips are clipped at the right ("[") | high | Music leads | docs/design/s47-before/focus/practice--ready-loop-active-tab--dark--768.png |
| The narrow-desktop strip shrinks to one line with a meaningless grey square (the beat pulse) between the chords | low | Hierarchy | docs/design/s47-before/focus/practice--ready-loop-active-tab-narrow-desktop--dark--768.png |
| Chips are 41 × 48 (desktop) and 33–38 × 48 (tablet) | low | Practice density 48 | docs/design/s47-before/focus/practice--ready-loop-active-tab--light--1440.png |
| Level / Capo are tucked at the column foot on desktop and missing on phone | medium | Reachability | docs/design/s47-before/focus/practice--view-notes--dark--1440.png |

What works and should survive: "Now · bar 6 · beat 1" / "Next · in 4 beats" wording, unsure chords as dashed chips (not colour), and the square-vs-dot beat pulse.

### Inspector: Loop
Score: 3/5

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Rest and Count-in selection is the 1.09–1.15:1 capsule | critical | 1.4.11 | docs/design/s47-before/focus/practice--ready-loop-active-tab--light--1440.png |
| From / To inputs are 40 px tall | low | Practice density 48 | docs/design/s47-before/focus/practice--ready-loop-active-tab--dark--1440.png |
| At 900 px tall, "Ask how each pass went" and Saved clips sit below the fold; with the ladder on, its rung chart is cut off under the tabs | medium | Loop context stays visible | docs/design/s47-before/focus/practice--ladder-on-playing--light--1440.png |
| On touch the same body is a fixed-width popover that is too wide and cut off on phones (see Phone) | high | Layout | docs/design/s47-before/focus/practice--popover-loop-pill--dark--375.png |

What works and should survive: the steppers, ×2 / ÷2 / Next phrase, the "Fine-tune edges" disclosure, and the "Bars 7–10 · Best clean pass 70 %" heading.

### Inspector: Mix and mixer drawer / mini-mixer
Score: 3/5

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Soloing a stem does not de-emphasise the others: their rows, faders and dB readouts stay unchanged, and only "solo" and a filled S mark it | high | Mixer: soloing de-emphasises others by more than hue | docs/design/s47-before/focus/practice-mix--soloed--light--1440.png |
| Presets are cards (2 × 2 on desktop, four stacked ≈ 270 px on phone); with a custom mix no card shows a state | medium | Prefer lists; selection visible | docs/design/s47-before/focus/practice-mix--phone-mini-mixer--light--375.png |
| The tablet drawer (`modal={false}`) covers the right half of the transport bar, including the loop pill | high | 2.4.11 | docs/design/s47-before/focus/practice--mixer--dark--768.png |
| The phone mini-mixer has no solo; metronome is two levels deep | medium | Reachability | docs/design/s47-before/focus/practice-mix--phone-mini-mixer--dark--375.png |
| M / S faces paint at 32 px with 12 px letters | low | Practice density | docs/design/s47-before/focus/practice--tab-mix--dark--1440.png |

What works and should survive: one row per stem with a colour rule plus name, "Your part" and "Rough ⚠" badges, dB readouts, the Click and Hear-the-chords helpers, and Reset / Use as default.

### Inspector: Progress
Score: 3/5

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Desktop only: tablet and phone users have no way to see progress | high | Every screen state on every layout | docs/design/s47-before/focus/practice--inspector-progress--dark--768.png |
| Three nested surfaces (inspector → chart card → stat cards) where hairline rows would do | low | Prefer lists; surfaces nest ≤ 3 | docs/design/s47-before/focus/practice-progress--nine-sessions--dark--1440.png |
| Chart axis and legend text is ≈ 12 px `--muted-foreground` | low | Type scale | docs/design/s47-before/focus/practice-progress--nine-sessions--dark--1440.png |

What works and should survive: solid vs dashed lines and circles vs squares for the two series (no colour needed), and plain session rows ("Today · 18 min · 7 passes · best 80 %").

### Speed panel and speed ladder
Score: 3/5

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| No typed or stepper value in the panel (slider + presets only); the selected preset is the 1.15:1 capsule | high | Speed readout opens a typed value; 1.4.11 | docs/design/s47-before/focus/practice--popover-speed-panel--dark--1440.png |
| The ladder card overflows at 375 (the 100 % rung is outside the card); rung numbers are ≈ 11 px on grey tiles | medium | Layout; type floor | docs/design/s47-before/focus/kit-speedladder--each-rung--dark--375.png |
| The ladder can only be started from the Loop tab, not from the speed control | low | Speed ladder visible on the speed control | docs/design/s47-before/focus/practice--ladder-on-playing--light--1440.png |

What works and should survive: "Up 5 % after 3 clean passes…" sentence, Start / Goal / Step chips, the filled-vs-outlined rung chart (inversion, not colour), and "→ 100" on the dock readout.

### Count-in and pass prompt
Score: 2/5

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| The count-in card says "Count-in · beat 1 of 1" in a 4/4 song and overlaps the pass prompt; both cover the middle of the notation | medium | Count-in takes the bar's beats; focus not obscured | docs/design/s47-before/focus/practice--ladder-on-playing--light--1440.png |
| The desktop pass prompt covers the last system and the marks key after every pass, even with "Ask how each pass went" off | medium | 2.4.11; music leads | docs/design/s47-before/focus/practice--pass-prompt-open--light--1440.png |
| Tablet: prompting breaks the bar (see Tablet); phone: icon-only ✓ / ↺ | critical | Layout; labels | docs/design/s47-before/focus/practice--paused--light--768.png |
| The count-in counter is `aria-hidden`, so screen-reader users get no count | low | Feedback within 100 ms for every input | docs/design/s47-before/focus/practice--count-in-counter--dark--1440.png |

What works and should survive: "Pass 1 at 70 % — how was it?" with Felt clean (C) / Not yet (N) key hints on the buttons, and the count as a large number, not a flash.

### Confidence marks and legend
Score: 2/5

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| The dashed box and "?" overlay are missing in several captures, leaving the blue digit alone (2.48:1 vs ink in Dark) | critical | 1.4.1 | docs/design/s47-before/focus/practice--playhead-bar--dark--1440.png |
| With "Show uncertainty" off, unsure digits stay blue | high | 1.4.1; the setting must turn it off | docs/design/s47-before/focus/practice--uncertainty-off--dark--1440.png |
| The "?" superscript is 10 px at weight 700 | medium | No text below 11 px; two weights | docs/design/s47-before/focus/practice--legend-chip--light--1440.png |
| "Probably" (dashed grey box) and "Unsure" (dashed blue box) differ mainly by hue apart from the "?" | medium | 1.4.1 | docs/design/s47-before/focus/practice--legend-chip--light--1440.png |

What works and should survive: the legend chip "? Auto-transcribed · 12 unsure", the popover with samples plus "About 1 in 20 notes…", the in-canvas marks key, dashed chord chips, and the hatch on the song map.

### Display and More popovers
Score: 3/5

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Two selection styles in one popover (Appearance has an ink ring, the rest use the capsule) | high | 1.4.11; one treatment | docs/design/s47-before/focus/practice--display-popover--dark--1440.png |
| The phone ⋯ popover holds a single item (Keyboard & pedal) | low | Hierarchy | docs/design/s47-before/focus/practice--more-panel--dark--375.png |
| The display popover covers the inspector and part of the notation with no way to preview the reading size against the music | low | Music leads | docs/design/s47-before/focus/practice--display-popover--dark--1440.png |

What works and should survive: one place for appearance, distance, reading size, follow mode, playhead and reduced motion, plus ⌘K "Display and reading".

### Shortcuts overlay and pedal HUD
Score: 3/5

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Fifteen identical outlined "Learn this pedal" buttons dominate the list; the keys appear as ≈ 11 px mono chips | medium | One primary; hierarchy | docs/design/s47-before/focus/practice--shortcuts-overlay--light--1440.png |
| Count-in, click, ladder, view, mix preset, solo, set loop and capo / level have no key at all | high | Every action has a key | docs/design/s47-before/focus/practice--shortcuts-overlay--light--1440.png |
| The overlay is desktop-only (also unreachable from a tablet with a keyboard or pedal) | medium | Shortcuts discoverable | docs/design/s47-before/focus/practice--more-panel--dark--768.png |

What works and should survive: the HUD "Key ← · From the top of the loop" (source + action, top right, out of the music), "Pedal detected? Set it up" on ↑ / ↓, and learned keys per device.

### Banners / loading / error
Score: 2/5

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| The loading skeleton doesn't match the layout (no song map at the top, no Now column, inspector or dock shape), so the page shifts when it loads | high | Skeletons match the final layout | docs/design/s47-before/focus/practice--loading-skeleton--dark--1440.png |
| The error is "Something went wrong on this screen." with no cause, no retry and (phone) only a bare "‹" | high | What happened, what it means, what you can do | docs/design/s47-before/focus/practice--error-song-fetch-failed--light--375.png |
| With stems expired, the mix pill still says "after your part is isolated" | low | Copy accuracy | docs/design/s47-before/focus/practice--stems-expired--light--1440.png |

What works and should survive: slim banners above the music with an icon, plain text and one action ("Re-create stems").

### Summary

| Region | Score |
|---|---|
| Desktop layout (≥1180) | 3 |
| Narrow desktop / tablet layout | 2 |
| Phone layout | 1 |
| Song map | 3 |
| Notation views | 3 |
| Transport dock / bar | 2 |
| Now column / strip | 3 |
| Inspector: Loop | 3 |
| Inspector: Mix and mixer drawer / mini-mixer | 3 |
| Inspector: Progress | 3 |
| Speed panel and speed ladder | 3 |
| Count-in and pass prompt | 2 |
| Confidence marks and legend | 2 |
| Display and More popovers | 3 |
| Shortcuts overlay and pedal HUD | 3 |
| Banners / loading / error | 2 |

Top 5 issues:
1. **Phone layout is broken (critical).** The header covers "Back to library", the glance text overlaps the song map and transport, the default view has no notation, and Level/Capo, Progress, master mute and loop-less count-in are unreachable. docs/design/s47-before/focus/practice--paused--dark--375.png
2. **Transport overflows outside the 1440 / 1180 happy path (critical).** At 768 with a fine pointer the click, mix and volume controls are off-screen; on tablet the pass prompt pushes controls off the left edge. docs/design/s47-before/focus/practice--paused--light--768.png
3. **Bar numbers disagree on songs with a pickup (high).** Printed tab bars run one ahead of the Now column and loop label ("bars 7–10" brackets printed 8–11), so loops set by number land on the wrong music. docs/design/s47-before/focus/practice--songmap-drag-scrub--light--1440.png
4. **Unsure is carried by hue alone (critical, 1.4.1).** The dashed box and "?" overlay go missing while the blue digit stays (2.48:1 against ink in Dark), even with "Show uncertainty" off. docs/design/s47-before/focus/practice--playhead-bar--dark--1440.png
5. **Selected and current states sit below 3:1 (critical, 1.4.11).** The segmented capsule is 1.09–1.15:1, and current bar, loop fill and paper differ by 1.08–1.27:1 (the "Bar" playhead is wash only). Notation gets only ≈ 40 % of a 1440 × 900 screen. docs/design/s47-before/focus/practice--ready-loop-active-tab--light--1440.png

---

## Onboarding, Getting ready, Fix and the editor (_focus)

The `_focus` screens outside the main practice view are calm and copy-led, and most of them meet the monochrome pill-and-hairline language. Their best parts are the desktop Getting ready card (named stages, a padded ETA, "What works now"), the Fix key line with J / K, and the short onboarding funnel. The worst problems all come from layout rather than styling. On phone portrait the glance view replaces the notation pane, and the Getting ready card, failure card, worker-offline line and part question all live inside that pane, so none of them is shown. At ≤ 768 px on touch, the focus bar's status slot overflows over the Back link. Unsure notes and chords outside the selected spot are marked by the blue alone, and in Dark that blue is only 2.48:1 against the plain ink. Coach marks, toasts and banners land on top of controls. Contrast figures below are computed from the OKLCH tokens in `packages/ui-tokens/src/{primitives,themes}.css` (WCAG 2 relative luminance); pixel impressions are marked as such.

Step counts used below:
- **First visit (`/start`) to audio playing on an example song** takes **4 actions** for a visitor: pick an instrument, pick a level, Continue (or "Skip for now") on Where's your screen, then "Play your part" in the song dialog. Picking a distance adds a fifth. A signed-in learner needs **5**: step 4 is a separate page whose "Play your part" only claims the song and opens practice, where Play / Space is needed again.
- **Finished upload to audio playing while the analysis runs** takes **1 action**. The Add song dialog navigates to practice by itself, local playback is ready before analysis, and Play or Space starts the original.

### Onboarding steps 1–4

Score: 4/5

- **Music as hero:** none is shown until step 3, which has a live chord and tab sample that resizes with the distance and slider, a good touch. The real song is heard after 4 actions.
- **Fewest steps:** 4 actions to sound (5 signed in), close to the minimum. Two different "Skip" controls on step 3 (top bar: leave onboarding for sign-up; bottom: skip this step) add a wrong turn.
- **One key per action:** every choice is a button reachable by Tab / Enter. There are no shortcuts, which is acceptable in a form-like flow.
- **Hierarchy without colour:** clear. One question per page, the step text "Step n of 5" backs the dots, and the selected distance card has a check, an ink edge and a wash.
- **Targets and contrast:** choice cards are 64 px. "Step n of 5" uses `--faint-foreground` on `--background`: 7.02:1 Dark, 5.51:1 Light, which is AA but under the 7:1 floor for body text.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Two "Skip" controls on one page with different outcomes. The top-right Skip leaves onboarding for sign-up and adding your own song; "Skip for now" skips the step. | medium | Hierarchy without colour (one clear path); Loading and empty states / flows | docs/design/s47-before/focus/onboarding--step3-screen--dark--1440.png |
| Unavailable Piano and Drums cards have a `--muted` fill (1.27:1 Dark, 1.09:1 Light) with `border-transparent`. There is no ≥ 3:1 `--input` ring, and "Unavailable" is not in the accessible name; only "Coming soon" says why. | medium | Pills and selection states (disabled); Conflicts #9 | docs/design/s47-before/focus/onboarding--step1-instrument--light--375.png |
| Step 3 starts with no distance chosen, and on a phone Continue sits about 1,400 px down, below three tall cards and the sample. | medium | Spacing and density (content-length robustness); Forms | docs/design/s47-before/focus/onboarding--step3-screen--dark--375.png |
| "Examples failed" is a red inline box with Retry only. It doesn't say what this means or offer "Add your own song" as a way on. | medium | Loading and empty states (what happened / what it means / what you can do) | docs/design/s47-before/focus/onboarding--examples-failed--dark--375.png |
| Signed-in step 4 is a static title card. "Play your part" claims the song and opens practice without starting playback, which costs an extra action and shows no music. | low | Media and player UI; fewest steps | docs/design/s47-before/focus/onboarding--step4-first-song-signed-in--light--1440.png |
| Onboarding has its own 64 px bar (`StepFrame`, browse density) rather than `FocusShell`, so its bar, Back and density differ from the rest of `_focus`. | low | Spacing and density (density switched by `data-density`) | docs/design/s47-before/focus/onboarding--step1-instrument--dark--1440.png |

What works and should survive: one question per page with the answers in the URL, the live reading sample that resizes as you choose, and progress shown as dots plus text.

### Onboarding guide and coach marks

Score: 3/5

- **Music as hero:** the song card opens over the real practice screen, so the music is visible behind the scrim. "Play your part" is the gesture that starts audio (no autoplay).
- **Fewest steps:** "Play your part" is action 4. Closing the dialog (Esc or the scrim) does not reveal the music; it sends the learner back to step 3.
- **One key per action:** Enter on the focused "Play your part" plays. "Got it" is reachable by Tab, and the practice keys work once playing.
- **Hierarchy without colour:** one ink button in the dialog. Coach marks are neutral popovers with a bulb icon.
- **Targets and contrast:** "Got it" pads to 48 px in practice density. The collisions in the table are the real problem.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| On desktop the coach mark is placed "above the timeline", which is the top of the page, so it covers the Tab / Notes / Chords switch in the focus bar. This breaks its own rule of never sitting over a control. | high | Focus and keyboard (2.4.11 focus not obscured); Hierarchy | docs/design/s47-before/focus/onboarding-guide--coach-mark-pass--light--1440.png |
| On phone portrait the coach mark sits on the glance chord, and the glance readouts ("Bar 7.1", "Bars 7–10 · 70 %") overlap the Play and Loop buttons. A system banner pushes the glance view down without it shrinking. The banner here is the headless screen-lock artefact, but the offline and update banners would do the same. | high | Spacing and density (layouts with long content); 2.4.11; 2.5.8 spacing | docs/design/s47-before/focus/onboarding-guide--playing-with-coach--dark--375.png |
| At 768 px the coach mark covers the notation's confidence legend ("sounding" is cut off), and the view-switch capsule overlaps the song title ("Stitc…"). | medium | Borders and hairlines / layout; 2.4.11 | docs/design/s47-before/focus/onboarding-guide--count-in-counter-with-coach--light--768.png |
| Dismissing the song dialog navigates back to `/start?step=screen` instead of leaving the learner on the practice screen they can already see. | medium | Focus and keyboard (modals return focus); fewest steps | docs/design/s47-before/focus/onboarding-guide--song-dialog--dark--1440.png |
| The dialog's "Step 4 of 5" uses `--faint-foreground` on `--popover`: 5.81:1 Dark, which is under the 7:1 project floor. | low | Contrast numbers (1.4.3 project floor) | docs/design/s47-before/focus/onboarding-guide--song-dialog--light--375.png |

What works and should survive: the "card over the real screen" handoff, at most two dismissible coach marks, and the save prompt held back until a pass is complete and playback has stopped.

### Save progress sheet and Saved

Score: 4/5

- **Music as hero:** not applicable (account step). On Saved, "Keep practising" returns to the song.
- **Fewest steps:** username + password + one button, or "Not now". Saved offers Add song, Record and Keep practising.
- **One key per action:** a standard form with Enter to submit.
- **Hierarchy without colour:** one ink submit button. On Saved the success icon is paired with the heading text.
- **Targets and contrast:** fields are 52 px with an `--input` edge (Dark 3.78:1 on card, Light 3.57:1). The inline "Create an account" link has a 44 px hit area.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| When the claim fails, "Try again" is a secondary pill while "Add song" below stays the filled primary. The recovery action ranks below the next step. | medium | Hierarchy without colour (one filled pill for the main task) | docs/design/s47-before/focus/onboarding--save-failed--dark--375.png |
| The sheet's description runs into the "Username" label with almost no space (pixel estimate under 8 px), and the focus ring on the inline link hugs the glyphs. | low | Spacing and density (4 px grid, 16/24 gaps); Forms | docs/design/s47-before/focus/onboarding--save-progress--dark--1440.png |
| At 1440 px the bottom sheet spans the whole width with a 400 px form and a black void above it. A centred dialog would read better on desktop. | low | Spacing and density | docs/design/s47-before/focus/onboarding--save-progress--dark--1440.png |
| With nothing to claim, Saved reads "You're signed in." (with a full stop) over a hairline. It doesn't say the example was not saved. | low | Loading and empty states (say what it means) | docs/design/s47-before/focus/saved--signed-in-claimed-or-claiming--dark--1440.png |
| On phones the focus bar's Back is a bare chevron (the label is screen-reader-only). | low | Hierarchy (navigation recedes but stays legible) | docs/design/s47-before/focus/onboarding--save-failed--dark--375.png |

What works and should survive: asking only after a completed pass, "Not now" as a calm ghost, and Saved saying where the progress went and offering the next song.

### Practice loading and error

Score: 3/5

- **Music as hero:** the loading skeleton has no song map or notation shape. It shows a bar and three blobs at the bottom, so the music area is a black or white void.
- **Fewest steps:** the error states offer no step except the bar's Back.
- **One key per action:** none needed. Back is Tab-reachable.
- **Hierarchy without colour:** errors pair a red icon with text, which is fine.
- **Targets and contrast:** the error text is foreground on `--destructive-surface` (16.9:1 Light, 15.8:1 Dark). The skeleton is decorative.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| A failed song fetch shows only "Something went wrong on this screen." It has no Retry and no "what you can do", although the failure is often transient (network). | high | Loading and empty states (what happened / means / can do); 27 §5.4 | docs/design/s47-before/focus/practice--error-song-fetch-failed--light--1440.png |
| "We couldn't find that. It may have been deleted." offers no in-page way on. On phones the only exit is the bare chevron. | medium | Loading and empty states | docs/design/s47-before/focus/practice--error-song-not-found--dark--375.png |
| The skeleton doesn't match the final layout. There is no top song map, notation systems, Now column or inspector, and the dock blobs are left-aligned while the real transport is centred, so the page shifts when it loads. | medium | Loading and empty states (skeletons match the final layout, no shift) | docs/design/s47-before/focus/practice--loading-slow-message--dark--1440.png |
| On phones the skeleton is a blank page with two blobs and no "Loading your song…" in the first second. | low | Loading and empty states | docs/design/s47-before/focus/practice--loading-skeleton--light--375.png |

What works and should survive: the delayed "Loading your song…" line (after 1 s), and errors kept inside the focus shell so Back stays put.

### Getting ready / analysing (incl. part question, worker offline and analysis failed)

Score: 2/5 (desktop and tablet alone would be 4)

- **Music as hero:** on desktop and tablet the song map is live, Play works at once, and the card says "You can practise already". On phone portrait the learner sees "No chord" in display type instead.
- **Fewest steps:** 1 action from a finished upload to sound (Play / Space).
- **One key per action:** Space plays. The part question's "Yes, guitar" and "Pick another" have no key and sit below eight stage rows. There is no pedal path.
- **Hierarchy without colour:** stages use icon + word ("Done", "Waiting", "~2–4 min"). "What works now" pairs a word badge with each row, which is good. Done rows use a green check whose shape also carries the meaning.
- **Targets and contrast:** the part-question buttons pad to 48 px. Stage detail text in `--muted-foreground` on `--card` is 7.42:1 Dark and 8.46:1 Light.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| On phone portrait, `GettingReady` is mounted inside `NotationPane`, which the glance view replaces. Phones therefore never see the stage list, the part question, the analysis-failed card with Try again, or the worker-offline notice. The screen just says "No chord". | critical | Loading and empty states (every screen has partial / error / offline states); 1.3.1-style loss of information | docs/design/s47-before/focus/practice--analysis-failed--dark--375.png |
| At 375 px the "Analysing 4 of 8" badge is drawn over the Back link. Measured in Storybook, the badge spans x 7–247 px and the link x 16–80. | critical | 2.5.8 (targets overlap); 2.4.11 | docs/design/s47-before/focus/practice--analysing--dark--375.png |
| The part question, the one time-sensitive decision, comes after all eight stage rows. At 1440 × 900 it is below the fold of the scrolling notation area, and the badge doesn't hint at it. | high | Hierarchy without colour (position and order); Loading states | docs/design/s47-before/focus/practice--part-question--light--1440.png |
| With the worker offline, the badge and the running stage still promise "about 2–4 min left" under the calm queued line, which contradicts it. | medium | Loading and empty states (worker offline is a calm queued line, not a stalled ETA) | docs/design/s47-before/focus/practice--worker-offline--light--1440.png |
| "Yes, guitar" is a filled ink pill next to the dock's Play, which makes two filled pills plus Play. | low | Hierarchy without colour (one filled ink pill) | docs/design/s47-before/focus/practice--part-question--dark--768.png |
| The failure card says the file "may be damaged or in a format we don't support" but offers "Try again" as the primary action, which can't fix a bad file. Replace file should lead. Meanwhile the dock still says "Mix · after your part is isolated". | medium | Loading and empty states (what you can do) | docs/design/s47-before/focus/practice--analysis-failed--light--1440.png |

What works and should survive: practice opening before analysis finishes, determinate progress with named stages and a padded ETA range, "What works now" with Ready / Soon / Later words, the polite live region per milestone, and the faint empty staff behind the card.

### Partial analysis states and their banners

Score: 3/5

- **Music as hero:** yes, once chords or tab arrive. The banners are one quiet line under the bar and don't box the music.
- **Fewest steps:** the fallbacks offer the one-tap fix ("Show tab anyway", "Re-create stems"). Stems unavailable offers none.
- **One key per action:** banner actions are Tab-reachable buttons with no key. That is acceptable for rare actions.
- **Hierarchy without colour:** the tone is an icon plus words, which is good. The chord strip marks unsure chords by blue alone in some states (see the Fix table).
- **Targets and contrast:** banner buttons are `sm`, padded to 48 px.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| "Stems are unavailable right now … This didn't use an analysis." gives no action and no time frame, while the dock still promises "Mix · after your part is isolated". | medium | Loading and empty states (what it means / can do) | docs/design/s47-before/focus/practice--stems-unavailable--light--1440.png |
| The ChordsOnlyFallback story shows tab with no chords-only banner at 1440 and only "No chord / Am" at 375, so the fallback and its "Show tab anyway" can't be seen in the captures. Verify that the banner renders. | medium | Loading and empty states (partial states storied in both themes) | docs/design/s47-before/focus/practice--chords-only-fallback--light--1440.png |
| On phones any banner pushes the glance view down without it shrinking, and its readouts collide with the transport (the same failure as in the guide). | high | Spacing and density; 2.4.11 | docs/design/s47-before/focus/onboarding-guide--playing-with-coach--light--375.png |
| Copy says "This didn't use an analysis" to someone who never asked. It is jargon about quota inside an error. | low | Loading and empty states (27 §5.4 plain copy) | docs/design/s47-before/focus/practice--stems-unavailable--light--1440.png |

What works and should survive: the banner as one quiet line with an icon and a hairline (no tinted bar), the one-tap remedy beside it, and "Your loops and edits are safe" in the stems-expired line.

### Fix tab and unsure-spot queue

Score: 3/5

- **Music as hero:** the selected bars are looped on the notation with the loop band, and the inspector holds the cards. In live data the dashed "probably" boxes clutter the tab (see Full editor).
- **Fewest steps:** J (or E) selects a spot and loops it, and focus moves to its first action (Hear, or It's right), so Enter acts. That is 2 keys to hear or confirm.
- **One key per action, by action:**
  - Next / previous spot: J / K. While focus is in the tab, the arrows; also the ‹ › buttons. Pedal users can bind "Next / Previous unsure spot" with Learn this pedal.
  - Edit the bar that's playing: E. Bindable to a pedal.
  - Play the selected bars: Space / Enter. Pedal: Play.
  - Fix speed: `,` / `.` (Shift for 1 %).
  - Undo / redo: ⌘Z / ⇧⌘Z. Undo is also in the Fix pill.
  - Leave: Esc, or Done.
  - Hear an alternative, Use, It's right, Report wrong, Split at beat, type a chord, the string / fret steppers, Listen to (Original / Your part / Tab synth / Both): **no key**. They are reached by Tab, and only the first is focused for you.
  - Pedal users can step and play, but cannot accept or confirm.
- **Hierarchy without colour:** the selected spot has an ink box and the chord names carry "?", but unselected unsure notes and chord chips are blue only.
- **Targets and contrast:** chips are 30 px visual inside 48 px targets, dock buttons are 64 px, and the spot bar is blue on `--muted` (5.62:1 Light, 6.64:1 Dark).

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Unsure notes outside the selected spot (bar 4's "3") and the Then / strip chips ("G", "F") are set in the unsure blue with no dashed box or "?". Blue against plain ink is 2.48:1 in Dark and 3.17:1 in Light, so in Dark the confidence is carried by hue alone. The key line promises a dashed box. `chord-chip.tsx` also keeps the blue ink when "Show uncertainty" is off. | critical | 1.4.1 (≥ 3:1 lightness or a second cue); Hierarchy without colour | docs/design/s47-before/focus/practice-fix--replace-all--dark--1440.png |
| The correction toast ("Saved on this device … Undo") sits over the Fix dock and hides the speed −/+ and "Tab synth / Both" while you work. | high | 2.4.11 (focused component not hidden); Focus and keyboard | docs/design/s47-before/focus/practice-fix--offline-queued--light--1440.png |
| The "Listen to" selector is the segmented capsule (`--capsule` on `--muted` = 1.15:1 Dark, 1.08–1.09:1 Light) with no ink edge. | medium | 1.4.11; Pills and selection states (capsule fix) | docs/design/s47-before/focus/practice-fix--first-spot--light--1440.png |
| Filled pills compete: Done (in the pill), the first "Use", and Play are all filled ink at once. | medium | Hierarchy without colour (one filled ink pill plus Play) | docs/design/s47-before/focus/practice-fix--first-spot--dark--1440.png |
| The chord field's only visible label is its placeholder ("Type a chord, e.g. Am7"), which is truncated to "e.g" at 1440 and disappears on typing. The label exists only for screen readers. | medium | Forms (every control has a visible label) | docs/design/s47-before/focus/practice-fix--first-spot--dark--1440.png |
| The header says "Spot 1 of 3 · bar 4" but the first card is "Bar 3 · chord" (the chord spans bars 3–4), which reads like a mismatch. | low | Hierarchy (labels agree) | docs/design/s47-before/focus/practice-fix--first-spot--light--1440.png |
| The "Fixing" state is a blue pill (`--unsure-surface`). Below 1024 px its text is screen-reader-only, so the mode reads as blue plus pencil. | low | Dark/light parity / colour only for status | docs/design/s47-before/focus/practice-fix--first-spot--dark--1440.png |
| With 99+ spots the stress story shows alphaTab's "rendered by alphaTab" credit, and digits run together. | low | Spacing and density (very long content: 99+ unsure spots) | docs/design/s47-before/focus/practice-fix--many-spots--dark--1440.png |
| "Nothing marked unsure in this song." is a bare grey line with no icon or heading, while the blue Fixing pill stays up. | low | Loading and empty states (empty: icon, h2, sentence, action) | docs/design/s47-before/focus/practice-fix--empty--dark--1440.png |

What works and should survive: J / K / E with the HUD, focus handed to the spot's first action, the key line under the notation ("wrong about 1 time in 2", J K caps), "every change saves as you go" with Undo, the honest "about 1 in 4" odds on alternatives, and Fix mode restoring the learner's loop, speed and ladder on exit.

### Editor sheet (touch)

Score: 2/5

- **Music as hero:** no. On a phone the bottom sheet covers the whole notation, so the learner edits a bar they can't see. On a portrait tablet only the top system shows.
- **Fewest steps:** tap a chord or note, then act. Moving to the next unsure spot means closing the sheet and finding the next mark by eye, and in Dark those marks are hue-only.
- **One key per action:** a touch user taps; there is no next / previous spot, no spot count and no Play in the sheet, only Hear bar / Hear the tab. A pedal on a phone can't step while the sheet is open, because the modal drawer makes the input mapper ignore keys (`ignoredTarget`). The landscape side sheet is non-modal.
- **Hierarchy without colour:** the selected note chip uses an ink-line edge plus a wash, which is fine. The unsure chip is dashed with "?", which is good.
- **Targets and contrast:** targets are fine (48 px). "Delete note" is ghost text next to "It's right".

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| The sheet hides the bar being edited (phone: completely). There is no compact or peek height that keeps the selected bar in view. | high | Media and player UI (music is the hero); 2.4.11 | docs/design/s47-before/focus/practice-fix--first-spot--light--375.png |
| There is no queue in the sheet (no "Spot n of N", no ‹ ›), and J / K / pedal are ignored while the modal sheet is open. Touch and pedal users can't walk the unsure spots. | high | Focus and keyboard (every action has a key / pedal); fewest steps | docs/design/s47-before/focus/edit--full-editor--light--375.png |
| No visible close control. Leaving is by swipe, scrim or Esc only. | medium | Focus and keyboard (modals dismissible); 2.5.7 (dragging alternative) | docs/design/s47-before/focus/practice-fix--first-spot--dark--768.png |
| The "Bar Pickup · chord" / "Bar Pickup · note 12" copy is awkward, and the 11 note chips wrap into a wall with no grouping by beat. | low | Spacing and density; content | docs/design/s47-before/focus/edit--full-editor--light--768.png |
| The EnterByKey capture at 768 shows no sheet and no change after E (only the tablet strip). Verify that E opens the sheet on tablets. | medium | Motion (feedback within 100 ms) | docs/design/s47-before/focus/practice-fix--enter-by-key--light--768.png |

What works and should survive: the same chord and note cards as desktop (one mental model), the side sheet on landscape tablets, and the string / fret steppers with ± halves.

### Full editor (`/songs/:songId/edit`)

Score: 3/5

- **Music as hero:** yes. The notation is wide, the inspector is 400 px, and the selected bars are looped with an ink band. In live data nearly every digit carries a dashed "probably" box, which turns the tab into a grid of boxes.
- **Fewest steps:** ⋯ → Open full editor (2 actions from practice), then J for the first spot.
- **One key per action, by action:**
  - Play the selected bars: Space.
  - Next / previous spot: J / K.
  - Previous / next note: ← / →.
  - Delete the selected note: Delete / Backspace.
  - Undo / redo: ⌘Z / ⇧⌘Z.
  - Leave: Esc (leaves the page) or Done.
  - Hear original, Use, It's right, the string / fret steppers, Listen to and Fix speed: no key. `,` and `.` don't work here because the page has its own key handler instead of the input mapper.
  - Learned pedal keys do nothing on this page, and a pedal sending ← / → selects notes instead of moving bars.
  - Touch users are redirected to Practice `?tab=fix`.
- **Hierarchy without colour:** the same hue-only unsure marks as in Fix.
- **Targets and contrast:** fine.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Unsure notes outside the selection are blue only (bar 4's "3"). This is the same 1.4.1 failure as in Fix. | critical | 1.4.1; Hierarchy without colour | docs/design/s47-before/focus/practice-fix--editor--light--1440.png |
| Undo sits inside the centre Fix pill and Redo sits 300 px away on the right, next to "Hear original". The pair is split, and both disabled states look like empty rings. | medium | Hierarchy (related actions grouped); Pills (disabled says why) | docs/design/s47-before/focus/edit--full-editor--dark--1440.png |
| Dashed "probably" boxes on most digits plus blue "?" marks make dense bars unreadable. Confidence styling overwhelms the music. | medium | Hierarchy without colour; Media and player UI | docs/design/s47-before/focus/edit--full-editor--dark--1440.png |
| The editor ignores the practice key map: no `,` / `.` speed, no learned pedal keys, and no "?" shortcuts overlay. Only J / K appear in the key line; ← / →, Delete and Space are undiscoverable. | medium | Focus and keyboard (shortcuts shown beside actions; every action has a key) | docs/design/s47-before/focus/practice-fix--editor--light--1440.png |
| The grid is fixed at `1fr 25rem` with no breakpoint, so a narrow fine-pointer window squeezes the notation. Esc leaves the whole page, not just a popover or the selection. | low | Spacing and density; Focus and keyboard | docs/design/s47-before/focus/edit--full-editor--dark--1440.png |

What works and should survive: keyboard-first editing (J / K, ← / →, Delete, ⌘Z), the Fix components reused rather than forked, "Hear original" in the bar, and the wide notation.

### Focus shell bar

Score: 2/5

- **Music as hero:** the bar is slim (60 px), quiet and ghost-only, so it recedes as it should.
- **Fewest steps:** Back is one tap. The ⌘K palette is in the bar, plus a search button on coarse pointers.
- **One key per action:** ⌘K / Ctrl K. Back is a real `<a>`.
- **Hierarchy without colour:** no fills at rest, and the hairline below is decorative (1.26:1 Light, 1.39:1 Dark; position already identifies the bar).
- **Targets and contrast:** Back is 44 / 48 px, but it is overlapped by the status slot at narrow touch widths.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| The status slot overflows to the left and covers Back. Measured at 375 in Storybook: the view switch spans x −18 to 195 over the Back link at x 16–80, and the "Tab" segment is cut off at the screen edge. At 768 the capsule covers "Back to library" in the guide and editor too. | critical | 2.5.8 (targets overlap); 2.4.11; Spacing and density | docs/design/s47-before/focus/edit--full-editor--light--768.png |
| On phones Back is a bare chevron. With the overflow above, there is no visible way out of practice on 375 px screens. | high | Hierarchy (navigation recedes, not vanishes); 2.4.11 | docs/design/s47-before/focus/practice--chords-only-fallback--dark--375.png |
| The bar's centre is used inconsistently: the view switch, the analysing badge or the blue Fix pill. On the edit page, the title, pill, Redo and Hear original crowd it with no priority order for narrowing. | medium | Hierarchy without colour; Spacing and density | docs/design/s47-before/focus/practice-fix--editor--light--1440.png |
| Onboarding doesn't use the shell (see Onboarding), so `_focus` has two bars of different heights (64 vs 60 px) and densities. | low | Spacing and density (`data-density`) | docs/design/s47-before/focus/onboarding--step1-instrument--dark--1440.png |

What works and should survive: the slim, chrome-free bar with one way back, the page-owned status slot, and the palette available everywhere except Exit pages.

### Group summary

| Screen | Score |
|---|---|
| Onboarding steps 1–4 | 4 |
| Onboarding guide and coach marks | 3 |
| Save progress sheet and Saved | 4 |
| Practice loading and error | 3 |
| Getting ready / analysing (part question, worker offline, analysis failed) | 2 |
| Partial analysis states and their banners | 3 |
| Fix tab and unsure-spot queue | 3 |
| Editor sheet (touch) | 2 |
| Full editor | 3 |
| Focus shell bar | 2 |

Step counts:
- `/start` to audio on an example song: **4 actions** for a visitor (5 if they pick a distance), **5 actions** signed in.
- A finished upload to audio while the analysis runs: **1 action** (Play or Space).

Top 5 issues:
1. **Critical:** on phone portrait the Getting ready card, part question, analysis-failed card and worker-offline line never render, because the glance view replaces the notation pane that holds them. The learner sees only "No chord". `docs/design/s47-before/focus/practice--analysis-failed--dark--375.png`
2. **Critical:** at ≤ 768 px on touch, the focus bar's status slot (view switch or analysing badge) overflows over the Back link, so there is no reliable way out of practice or edit on phones and tablets. `docs/design/s47-before/focus/practice--analysing--dark--375.png`
3. **Critical:** unsure notes and chord chips outside the selected spot are marked by the blue alone, at 2.48:1 against the ink in Dark. This fails 1.4.1 across Fix, the full editor and the chord strip. `docs/design/s47-before/focus/practice-fix--replace-all--dark--1440.png`
4. **High:** overlays land on controls. The desktop coach mark covers the view switch, the phone glance view and coach mark overlap the transport when a banner appears, and the correction toast hides the Fix dock's speed and Listen to controls. `docs/design/s47-before/focus/onboarding-guide--coach-mark-pass--light--1440.png`
5. **High:** touch and pedal users can't walk the unsure-spot queue. The editor sheet has no spot count or ‹ ›, covers the bar it edits, and blocks J / K / pedal while open. Accept / It's right has no key or pedal anywhere. `docs/design/s47-before/focus/practice-fix--first-spot--light--375.png`

---

## Signed-in app (_app)

The signed-in group is the learner's home: library, the Add song dialog (File, Link, Record), settings, and the shell with its overlays. Its base is sound. Every hit target measured in Storybook is 44 px or larger (headless Playwright run, see the method note). Text tokens clear the 7:1 project floor almost everywhere, a returning learner is one click from practice through the Continue card, and empty, loading, error and offline states exist for most screens. The weak spots are the same across the group. Selection and "current" states are drawn with grey fills that reach only 1.09–1.27:1. Two layouts break: the Record tab at 768 px and wider, and the Keyboard & pedal table on phones. Forms disable their submit button in advance and say nothing about what is wrong. The library leads with chrome and status pills rather than anything musical.

Method: contrast figures are computed from the oklch token values in `packages/ui-tokens/src/primitives.css` and `themes.css`, converted to sRGB, with WCAG 2 relative luminance. Opacity blends are done in gamma space, as a browser does. Hit sizes come from a headless Playwright run against the running Storybook (`getBoundingClientRect`, at 1440 and 375). Reference ratios used below:

| Pair | Dark | Light |
|---|---|---|
| `--muted` (nav/current fill) vs `--background` | 1.27:1 | 1.09:1 |
| segmented `--capsule` vs `--muted` track | 1.15:1 | 1.09:1 |
| `--border` (hairline) vs background | 1.39:1 | 1.26:1 |
| `--input` vs background / vs card or popover | 4.24 / 3.51:1 | 3.57 / 3.57:1 |
| `--accent` (meter track) vs background / vs popover | 1.46 / 1.21:1 | 1.18 / 1.18:1 |
| `--muted-foreground` on background / card / muted | 8.31 / 7.42 / 6.53:1 | 8.46 / 8.46 / 7.76:1 |
| `--faint-foreground` on background / card | 7.02 / 6.26:1 | 5.51 / 5.51:1 |
| `--success` on `--success-surface` ("Ready" pill) | 7.25:1 | 5.47:1 |
| `--destructive` on `--destructive-surface` | 5.53:1 | 4.80:1 |
| `--destructive-foreground` on `--destructive` (filled delete button) | 7.37:1 | 5.51:1 |
| chip-radio selected ring `--primary-line` vs background | 5.28:1 | 3.64:1 |
| instrument tile foreground on guitar teal | 5.70:1 | 5.35:1 |

### Library

Score: 3/5

- Music as hero: Partly. The Continue card leads with the song title, the clip, its bars and a sparkline. Every song card, though, is an instrument tile, a title, a status pill and a line of metadata, with nothing musical (no key, tempo, chord preview or waveform), and on phones the status pill takes the room the title needs.
- Fewest steps: Returning learner: 2 (Resume practice or the phone's play circle, then Play). New song: 4 (Add song, choose file, Start practising, Play). Both are good.
- One key or pedal: n/a (browse screen). ⌘K is shown in the search field.
- Hierarchy without colour: Mostly yes. Resume practice is the single ink pill, and status pills carry an icon and a word. The grid/list toggle and the current nav item, however, are grey fills only (see the issues).
- Targets and contrast: All measured targets are ≥ 44 px. Text passes. The state cues for the view toggle (1.09–1.15:1) and the current nav item (1.09–1.27:1) fail 1.4.11.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Grid/list view toggle shows the chosen view only as a raised capsule on a grey track, 1.09:1 (Light) / 1.15:1 (Dark). | high | 1.4.11; Pills and selection states (segmented capsule fix) | docs/design/s47-before/app/library--populated-list--light--1440.png |
| On phones, the list row lets the status pill and the "…" button take the width the title needs: "Walking bass …", "Ballad with a c…", "Song fro…". Analysing rows then wrap their progress text into a 4-line column. | high | Spacing and density (long content); Hierarchy | docs/design/s47-before/app/library--populated-all-song-statuses--dark--375.png |
| Library prefers a card grid to hairline rows. Desktop cards also truncate metadata inside wide cards ("Bobby Nobody · Guitar · …"). The list view at 1440 is a 1,200 px row with the status pill stranded at the far right. | medium | Spacing and density (prefer lists with hairline rows) | docs/design/s47-before/app/library--populated-grid--dark--1440.png |
| The status filter hides inside the sort menu. The trigger only ever names the sort ("Last practised"), so an active "Show: Failed" filter is invisible on the toolbar. | medium | Hierarchy; Forms (state lives in the URL but not in the UI) | docs/design/s47-before/app/library--sort-menu-open--light--1440.png |
| No-results shows two "Clear filters" controls, and the second is a filled ink pill competing with Resume practice. The empty state has no h2, only a sentence. | medium | Hierarchy (one filled ink pill); Loading and empty states (icon, h2, sentence, action) | docs/design/s47-before/app/library--no-results--light--1440.png |
| On phones the empty state and the bottom nav both show a filled "Add song" pill (two primaries). | low | Hierarchy (one filled ink pill) | docs/design/s47-before/app/library--empty--light--375.png |
| The loading skeleton does not match the final layout: it draws an outlined Continue card while the real one is filled, and it omits the "Songs" heading, toolbar and chips, so content shifts on load. | medium | Loading and empty states (skeleton matches final layout, no shift) | docs/design/s47-before/app/library--loading-skeleton--light--1440.png |
| The load error is a full-width red-filled box with only "We couldn't load your library." and Retry. It doesn't say what this means (for example, that downloaded songs still play), and it uses a chroma surface for a whole region. | medium | Loading and empty states (what happened, what it means, what you can do); Hierarchy without colour | docs/design/s47-before/app/library--load-error--dark--1440.png |
| On phones there is no title filter and the instrument chip row is clipped at "Drums" with no scroll affordance. "Vocals" and "Something else" are off-screen. | medium | Spacing and density; Hierarchy | docs/design/s47-before/app/library--populated-grid--light--375.png |
| The week strip encodes minutes only by dot opacity: 0.45 vs 0.7 ink is 2.38:1 apart in Light. Practised vs not passes (fill vs `--input` ring at 3.57:1), but how much was practised is lightness-only with no per-day value. | low | 1.4.1 (information by lightness alone) | docs/design/s47-before/app/library--progress-sections--light--375.png |
| The rename toast "Renamed." doesn't name the song and has no Undo, although rename is undoable elsewhere. | low | Loading and empty states (errors/feedback copy); 27 §5 | docs/design/s47-before/app/library--toast-renamed--light--375.png |
| The "Delete song" menu item is red text only. It is labelled, so it passes, but it is the only chroma in the menu. | low | Hierarchy without colour | docs/design/s47-before/app/library--song-menu-open--dark--1440.png |

Survives the redesign: the Continue card with one ink "Resume practice" (with the phone play-circle variant), per-song status pills with an icon and a word plus a one-line explanation and its fix ("Re-create stems", "Try again"), "Needs connection" text on dimmed offline cards, and the calm "Processing machine offline. Your song is queued" line.

### Add song: File

Score: 3/5

- Music as hero: The picked file shows a waveform preview and the title is prefilled, so the content leads once a file is in. The empty dialog, though, is mostly part, hand and analysis choices.
- Fewest steps: New song is 3 actions to practice (open, pick file, Start practising), with sensible defaults (Guitar, Full). Good.
- One key or pedal: n/a.
- Hierarchy without colour: Mostly. The Full/Lite radio cards use a 2 px ink edge plus a check (good). The File/Link/Record tabs and the Right/Left hand toggle use the 1.09:1 capsule. The selected instrument chip is a soft wash plus an ink ring, not an inversion, which differs from the library's inverted "All" chip.
- Targets and contrast: Chips and controls are ≥ 44 px (min-h-target). The selected-chip ring is 5.28:1 (Dark) / 3.64:1 (Light), which passes.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Tabs (File/Link/Record) and the Hand Right/Left toggle mark the selection with a capsule at 1.09:1 (Light) / 1.15:1 (Dark) against the track. | high | 1.4.11; Pills and selection states | docs/design/s47-before/app/add-song--file-tab-file-picked--light--1440.png |
| "Start practising" is pre-disabled (grey outline) before a file is picked, with no line saying why. | medium | Forms (submit not pre-disabled); Pills and selection states (disabled says why) | docs/design/s47-before/app/add-song--file-tab-empty-dropzone--dark--1440.png |
| Cap reached: the explanation sits below the fold of the 1440×900 dialog and on phones. The used-up option ("0 of 5 left" Lite) is preselected, and the CTA is disabled without a visible reason. The Full card isn't marked "Unavailable". | high | Pills and selection states (disabled: "Unavailable" + why); Loading and empty states | docs/design/s47-before/app/add-song--cap-reached-lite--dark--1440.png |
| The selected instrument chip is a soft wash plus an ink ring rather than an inverted pill, and it differs from the library filter chips, which invert. | medium | Pills and selection states (selected chip inverted) | docs/design/s47-before/app/add-song--part-and-hand--dark--768.png |
| "Unreadable file" states what happened but offers no action in the panel (choose another file, or what formats work). | medium | Loading and empty states (what you can do) | docs/design/s47-before/app/add-song--file-unreadable--light--1440.png |
| On open, focus lands on the close button, which then shows its heavy focus ring by default. The drop zone or "choose a file" would be the useful first stop. | low | Focus and keyboard | docs/design/s47-before/app/add-song--file-tab-empty-dropzone--light--375.png |
| The "Works best" popover story renders no popover at 375 (capture shows the plain dialog), so the phone state is unverified. | low | Dark/light parity (stories in every state) | docs/design/s47-before/app/add-song--works-best-popover--dark--375.png |

Survives: "It opens right away. Loops and slow-down work while we analyse.", the prefilled title, defaults that let a learner submit in one tap, the duplicate state with "Open it" / "Add anyway", recording-quality warnings as icon pills with plain consequences, and the full-screen sheet on phones with a sticky footer CTA.

### Add song: Link

Score: 3/5

- Music as hero: n/a (input step).
- Fewest steps: 4 to practice (open, choose Link, paste with the built-in Paste button, Add and analyse). `/import?tab=link` redirects correctly to this tab (docs/design/s47-before/app/import-redirect--lands-on-add-song-link-tab--dark--1440.png).
- One key or pedal: n/a.
- Hierarchy without colour: Clear except for the tab capsule (see File).
- Targets and contrast: the field border is `--input` at 4.24:1 (Dark) / 3.57:1 (Light), which passes. Targets are ≥ 44.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Invalid text ("not a link") produces no inline error, icon or `aria-describedby`. The only signal is the greyed "Add and analyse". | high | Forms (inline errors, validate on blur/submit); WCAG 3.3.1 | docs/design/s47-before/app/add-song--link-tab-invalid-url--dark--375.png |
| The submit button is pre-disabled until the URL parses. | medium | Forms (submit not pre-disabled) | docs/design/s47-before/app/add-song--link-tab-empty--light--1440.png |
| "Also download the video" defaults to on with no hint of its cost or size. The switch is the only control in the panel, which leaves a large empty band above the part picker. | low | Spacing and density | docs/design/s47-before/app/add-song--link-tab-valid-url--light--1440.png |

Survives: the Paste button inside the field, and the helper line with limits ("Songs up to 20 minutes").

### Add song: Record

Score: 2/5

- Music as hero: The large timer and level meter lead while recording. Good. The review uses the browser's native `<audio>` player rather than the app's waveform.
- Fewest steps: 5 to practice (open, Record, Allow microphone, record/stop, Use this recording). Count-in and click are on by default, which helps.
- One key or pedal: Not wired. There is no key or pedal to start or stop a take, although the learner's hands are on the instrument.
- Hierarchy without colour: Recording state = red dot becoming a red square, plus a "Recording" pill. The shape changes, so it passes 1.4.1.
- Targets and contrast: the record button is about 84 px (estimate from pixels). The level meter track is `--accent` at 1.46:1 (Dark) / 1.18:1 (Light) on its panel, so at rest the meter's extent is invisible.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| At 768 and 1440 the record panel overflows into the next section. The Count-in/Click switches and the headset hint draw on top of "Your part" and the instrument chips, making both unreadable and partly untappable. Phones (375) are fine. Likely cause: the panel shrinks inside the dialog's scrolling flex column (`add-song-dialog.tsx` around lines 220–222); not verified. | critical | Spacing and density; 1.4.10/2.5.8 (obscured controls) | docs/design/s47-before/app/add-song--record-tab-recording--light--1440.png |
| The same overlap shows in the ready-to-record state (switches over the "Your part" row) and at 768. | critical | Spacing and density | docs/design/s47-before/app/add-song--record-tab-recording--dark--768.png |
| Review uses an unstyled native `<audio>` control (a light grey pill in Dark), which is off-system. There is no waveform of the take. | medium | Media and player UI; Dark/light parity | docs/design/s47-before/app/add-song--record-tab-review-take-ready--light--768.png |
| The input-level meter track is not visible (1.18–1.46:1). Before sound arrives there is no cue that the meter exists or where its maximum is. | medium | 1.4.11 (needed graphic) | docs/design/s47-before/app/add-song--record-tab-ready-to-record--dark--1440.png |
| Permission denied is a red-filled box above a quiet "Try again". The copy is good (what happened, what to do), but the surface is chroma. | low | Hierarchy without colour | docs/design/s47-before/app/add-song--record-tab-permission-denied--dark--1440.png |
| The "Unsupported" state (no screenshot or story) is only an `InlineError tone="info"` with a title (`record-panel.tsx:51`). There is no suggestion to use File or Link instead. | low | Loading and empty states (what you can do); every state storied | docs/design/s47-before/app/add-song--record-tab-idle--dark--1440.png |

Survives: the count-in that reads "Count-in 2" in the timer slot, the circle-to-square record button, "Record again", and the headset noise-reduction hint.

### Settings: Account (profile)

Score: 3/5

- Music as hero: n/a.
- Fewest steps: n/a (practice is 1 click away via Library).
- One key or pedal: n/a.
- Hierarchy without colour: Rows with hairlines and a single page h1 work. The selection in "Main instrument" and "How long have you played?" is the 1.09:1 capsule. The current section in the settings nav is a `--muted` fill only.
- Targets and contrast: fields are 44 px with `--input` borders (4.24 / 3.57:1). The switch track uses `--input` (passes). The nav current state fails 1.4.11.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| The current settings section ("Account") is shown only by a `--muted` fill: 1.09:1 (Light) / 1.27:1 (Dark) (`settings-layout.tsx:32`). | high | 1.4.11; Pills and selection states (current nav pill fix) | docs/design/s47-before/app/settings-account--default--light--768.png |
| Segmented "Main instrument" and "How long have you played?" use the 1.09–1.15:1 capsule. On phones "Main instrument" wraps into a two-line blob. | high | 1.4.11; Spacing and density | docs/design/s47-before/app/settings-account--default--light--375.png |
| At 375 and 768 the six-item section list stacks above the content and pushes the page h1 about 380 px down. At 768 there is room for a side column. | medium | Spacing and density; Hierarchy (chrome recedes) | docs/design/s47-before/app/settings-account--default--light--768.png |
| No top-bar item is current while in Settings. Settings is reachable only through the avatar menu, so the shell gives no "you are here". | medium | Hierarchy; Focus and keyboard (navigation state) | docs/design/s47-before/app/settings-account--default--dark--1440.png |
| The empty "Name" field has no placeholder or hint. The editable "Username" (the sign-in identifier) has no note that changing it changes how you sign in. | low | Forms | docs/design/s47-before/app/settings-account--default--dark--1440.png |

Survives: settings as hairline rows with label left and control right, and a page h1 with h2 groups.

### Settings: Privacy / data export

Score: 4/5

- Music as hero: n/a. Fewest steps: n/a. One key: n/a.
- Hierarchy without colour: Clear. "Prepare my data" is secondary, and the training opt-in is a switch, off by default with an honest description.
- Targets and contrast: ≥ 44 px. The offline-disabled buttons keep an `--input` ring plus an explanatory line.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Export failed is a red-filled box, "We couldn't prepare your file. Try again.", while the retry button sits above it ("Prepare a new file"). The order reads backwards. | medium | Loading and empty states (what you can do next to the error); Hierarchy | docs/design/s47-before/app/settings-account--export-failed--dark--375.png |
| Offline: the disabled buttons have no "Unavailable" in the name. The reason line sits above the section rather than beside the controls. | low | Pills and selection states (disabled) | docs/design/s47-before/app/settings-account--privacy-offline--light--768.png |
| Pending with the worker offline: a calm queued line. Good, nothing to fix. | — | — | docs/design/s47-before/app/settings-account--export-pending--light--1440.png |

Survives: the export pending, worker-offline, ready and failed states, all in-row and in plain language.

### Settings: Delete account

Score: 4/5

- n/a for music, steps and keys.
- Hierarchy without colour: The confirm dialog focuses Cancel first, says it can't be undone, and the destructive button is filled red with a label. Re-auth asks for the password inline.
- Targets and contrast: the destructive button text is 7.37:1 (Dark, black on `--bad-dark`) / 5.51:1 (Light, white on `--bad-light`), which passes AA but is below the 7:1 body floor in Light.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| The confirm dialog is vaguer than the row: "Delete your account and everything in it?" drops the list (songs, stems, loops, edits) given on the page. | low | Loading and empty states (what it means) | docs/design/s47-before/app/settings-account--delete-account-confirm-dialog--light--1440.png |
| The destructive buttons are the only saturated filled pills in the app, a salmon fill with black text in Dark. Acceptable as status colour, but there are two treatments (outlined red on the page, filled in the dialog). | low | Hierarchy without colour; Dark/light parity | docs/design/s47-before/app/settings-account--delete-reauth-password--dark--1440.png |

Survives: Cancel focused first, re-auth by password in the same dialog, and the `?confirm=delete` deep link.

### Settings: Usage

Score: 3/5

- n/a for music and keys. Practice is 1 click away.
- Hierarchy without colour: rows and meters are clear. "See Plus" is the one ink pill.
- Targets and contrast: meter fill `--muted-foreground` on `--accent` track is 5.68:1 (Dark) / 7.16:1 (Light), which passes. The track against the page is only 1.46:1 (Dark) / 1.18:1 (Light), so at "0 of 5 used" the meter's extent is invisible.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Empty meters (0 used) are invisible bars, so the scale only appears once something is used. | medium | 1.4.11 (needed graphic) | docs/design/s47-before/app/settings-usage--default--dark--1440.png |
| Usage appears three times in chrome (top-bar link, bottom-nav tab, settings section). For a practice app this gives quota more navigation weight than songs. | medium | Hierarchy (chrome recedes, the task leads) | docs/design/s47-before/app/settings-usage--lite-used-up--light--375.png |
| On phones two filled pills are visible together (bottom-nav Add song, See Plus). | low | Hierarchy (one filled ink pill) | docs/design/s47-before/app/settings-usage--lite-used-up--light--375.png |

Survives: "Failed analyses never count toward a limit", reset dates under each meter, and tabular "n of m used".

### Settings: Plan

Score: 3/5

- n/a for music and keys.
- Hierarchy without colour: Free has a single "See Plus" ink pill, which is clear. On Plus, "Cancel Plus" is the stronger button (secondary fill) and "Manage plan" a ghost link.
- Targets and contrast: ≥ 44. The success banner is `--success` on `--success-surface`, 7.25:1 (Dark).

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| On Plus, "Cancel Plus" is visually weightier than "Manage plan", so the cancel path is the emphasised one. | medium | Hierarchy (primary vs secondary) | docs/design/s47-before/app/settings-plan--plus--dark--768.png |
| The Plus state leads with a green-filled banner restating the plan. This is colour as decoration, and it duplicates the row below. | low | Hierarchy without colour; Spacing (fewer separators) | docs/design/s47-before/app/settings-plan--plus--dark--768.png |
| The Free page is nearly empty (one row). It doesn't show what Plus adds or the current allowance, so the learner must open the sheet. | low | Spacing and density | docs/design/s47-before/app/settings-plan--default--light--1440.png |

Survives: the "Demo billing" badge, and the checkout-cancelled line "Nothing was charged."

### Settings: Display & practice

Score: 3/5

- Music as hero: The reading-size sample ("Am 3 5 7 10") previews real notation. Good.
- Fewest steps: n/a.
- One key or pedal: n/a here (practice defaults only).
- Hierarchy without colour: The Appearance cards use a 2 px ink edge, which passes. All eight segmented controls (contrast, distance, follow, playhead, motion, count-in, rest) use the 1.09–1.15:1 capsule.
- Targets and contrast: the number-field input is 64×40 inside its stepper. The slider thumb is a 20×20 input whose track widens the hit area (measured). Everything else is ≥ 44.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Eight segmented controls signal the current value with a 1.09:1 (Light) / 1.15:1 (Dark) capsule. This is the densest concentration of the failure. | high | 1.4.11; Pills and selection states | docs/design/s47-before/app/settings-display--default--dark--1440.png |
| On phones "Where is your screen?" wraps "Floor" onto a second line inside a rounded track (a blob). The Appearance cards stack three tall cards, which pushes the page down. | medium | Spacing and density | docs/design/s47-before/app/settings-display--default--light--375.png |
| The "Saved on this device" pill is green and sits at the page top. Per-field save feedback isn't visible next to the changed control. | medium | Forms (settings save per field); Hierarchy without colour | docs/design/s47-before/app/settings-display--default--dark--1440.png |
| The "Speed ladder" stepper shows a bare "3" whose meaning lives in the label above ("+5 % after 3 clean passes"). It has no unit, unlike the "%" and "ms" steppers. | low | Forms | docs/design/s47-before/app/settings-display--default--dark--1440.png |
| The reading sample uses `font-semibold` (600). This is the documented reading-token exception (Conflicts 1), noted only for completeness. | low | Type scale (exception) | docs/design/s47-before/app/settings-display--default--light--1440.png |

Survives: the Appearance preview cards, the live reading-size sample with "Can you read the fret numbers from where you play?", and plain descriptions under every switch.

### Settings: Keyboard & pedal

Score: 2/5

- Music as hero: n/a.
- Fewest steps: n/a.
- One key or pedal: Partly. All 15 mapped actions have a default key and can each learn one pedal. Keys themselves can't be rebound. Some practice actions have no key in the map: set loop start/end, count-in, speed-ladder toggle, solo or mute other stems (inventory §6).
- Hierarchy without colour: Clear on desktop (table with Kbd caps, single-key switch with a WCAG 2.1.4 explanation).
- Targets and contrast: "Learn this pedal" ghost buttons are ≥ 44 high. The Kbd caps are small, 11–12 px mono (estimate).

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| At 375 the keys table overflows horizontally and the Action column is clipped mid-word ("ay or use", "estart op or ck a r"). The page is unusable on phones. | critical | 1.4.10 Reflow; Spacing and density | docs/design/s47-before/app/settings-keyboard--learning-a-key--dark--375.png |
| The learning prompt ("Press the pedal or key for Play or pause. Escape cancels.") renders below the whole table, far from the row being learned. On phones it is off-screen, and only the row's "Press it now" pill changes. | high | Focus and keyboard; 2.4.11 (status near the focused control) | docs/design/s47-before/app/settings-keyboard--learning-a-key--dark--375.png |
| The "Pedal" column is empty for every row until something is learned. Keys can't be remapped, only supplemented, so "Every practice action has a key" isn't fully true (see the actions above). | medium | Focus and keyboard (every action has a key) | docs/design/s47-before/app/settings-keyboard--default--light--1440.png |
| The "Try a key or pedal here" test area sits after 15 rows, below the fold. A learner setting up a pedal tests it last. | low | Hierarchy (position) | docs/design/s47-before/app/settings-keyboard--default--light--1440.png |

Survives: the single-key shortcuts switch with its reason, per-action "Learn this pedal" with Esc to cancel, and the test area with Reset to defaults.

### Settings: About

Score: 3/5

- n/a for music, steps and keys.
- Hierarchy without colour: plain rows. Mono version strings recede.
- Targets and contrast: the licence links are underlined text, with rows ≥ 44 px.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Nineteen raw model rows with checkpoint ids ("YourMT3+ YPTF.MoE+Multi (PS)…mc13_256_g4_all_v7…") dominate a learner-facing page. This is developer provenance, not learner information. | medium | Hierarchy (chrome recedes); Spacing (long content) | docs/design/s47-before/app/settings-about--default--light--1440.png |
| On phones the long mono ids wrap mid-token, and one version string sits to the right of its row while the others sit below (inconsistent). | low | Spacing and density (long content) | docs/design/s47-before/app/settings-about--default--dark--375.png |

Survives: the version/build line, the font licences, and the provenance link.

### App shell: top bar and phone bottom nav

Score: 3/5

- Music as hero: The top bar is restrained, but it carries six items (wordmark, Library, Usage, search, Add song, avatar) above a one-item page.
- Fewest steps: Add song is always one tap, and the phone bottom nav centres it.
- One key or pedal: ⌘K opens the palette from anywhere. No other shell shortcut (for example a key for Add song) is shown.
- Hierarchy without colour: The current page is a `--muted` fill (1.09 / 1.27:1). When the Usage popover is open, Library and Usage both look filled.
- Targets and contrast: all ≥ 44 (measured).

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| The current nav item ("Library") is shown only by a `--muted` fill: 1.09:1 (Light) / 1.27:1 (Dark) (`app-shell.tsx:79`). | high | 1.4.11; Pills and selection states (current nav pill fix) | docs/design/s47-before/app/library--populated-grid--light--1440.png |
| An open popover uses the same `--muted` fill as the current page, so with Usage open two items read as current. | medium | Pills and selection states | docs/design/s47-before/app/shell--usage-popover-open--light--1440.png |
| On phones the bottom nav is Library, Add song (a filled ink pill) and Usage. The filled pill appears on every page, including Settings and dialogs' backdrops, so it competes with each page's own primary. Usage gets a permanent tab. | medium | Hierarchy (one filled ink pill; chrome recedes) | docs/design/s47-before/app/settings-plan--checkout-cancelled-banner--dark--375.png |
| The bottom nav's "current" state is the label weight and icon only. A ≥ 3:1 non-text cue is unverified (estimate from pixels: Library and Usage look identical apart from text tone). | medium | 1.4.11; Pills and selection states | docs/design/s47-before/app/library--populated-grid--light--375.png |
| The wordmark is 600 (`brand.tsx:50`). This is a known conflict (Conflicts 1): set it to 500 or treat it as a logotype. | low | Type scale with two weights | docs/design/s47-before/app/library--populated-grid--dark--1440.png |

Survives: the centred search with its ⌘K hint, the phone header that collapses to wordmark plus page name, search icon and avatar, and the sticky header.

### Command palette

Score: 4/5

- Music as hero: Songs are the first group, with the instrument tile and artist.
- Fewest steps: ⌘K, type, Enter opens a song (3 key presses).
- One key or pedal: Yes. Esc and Enter are shown as Kbd caps. Actions list Appearance, Set up a pedal and settings.
- Hierarchy without colour: The match is emphasised by weight (but 600, see below). The active row is a `--muted` fill plus an "Enter" cap. The cap is the non-colour cue, which helps.
- Targets and contrast: rows ≥ 44.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| The active-row highlight is a `--muted` fill: 1.09:1 (Light) / 1.27:1 (Dark). Only the trailing "Enter" cap marks it, and that cue appears only on the active row. | medium | 1.4.11; Pills and selection states | docs/design/s47-before/app/shell--command-palette-results--light--1440.png |
| The match highlight uses `font-semibold` (600) (`command-palette.tsx:50`). | low | Type scale with two weights | docs/design/s47-before/app/shell--command-palette-results--light--1440.png |
| Actions show no shortcuts beside them (for example "Add song", "Appearance: Dark"). On phones the Esc/Enter caps are shown on a touch device and the placeholder is truncated ("…actio"). | low | Focus and keyboard (shortcuts beside actions) | docs/design/s47-before/app/shell--command-palette-open--dark--375.png |

Survives: grouped results, the "No matches. Try a song title or 'loop 17-20'" hint, and the offline label "Songs · Offline: songs saved on this device" (docs/design/s47-before/app/shell--palette-offline--light--1440.png).

### Account menu

Score: 4/5

- n/a for music and steps. One key: no shortcuts listed in the menu.
- Hierarchy without colour: group labels, a check on the current appearance, and hairline separators. Clear.
- Targets and contrast: items are 44 px.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| The header shows the raw username (e2e_s47app_…) in faint 12 px rather than the name. | low | Hierarchy | docs/design/s47-before/app/shell--account-menu-open--dark--1440.png |
| No shortcuts are shown beside items (Settings, Keyboard & pedal). Help links go to marketing pages without saying they leave the app. | low | Focus and keyboard (shortcuts beside actions) | docs/design/s47-before/app/shell--account-menu-open--dark--1440.png |

Survives: Appearance as a radio group with a check, and Keyboard & pedal one level from anywhere.

### Usage popover

Score: 3/5

- n/a for music and keys.
- Hierarchy without colour: compact and clear, with "See Plus" as a secondary pill.
- Targets and contrast: the meter tracks are `--accent` on `--popover`, 1.21:1 (Dark) / 1.18:1 (Light). Empty meters are invisible.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Empty meters ("0 of 5 used") are invisible tracks. | medium | 1.4.11 (needed graphic) | docs/design/s47-before/app/shell--usage-popover-open--light--1440.png |
| Dense small text: reset and description lines are about 12 px faint text (estimate), and the rows are tight compared with the settings page. | low | Type scale; Spacing and density | docs/design/s47-before/app/shell--usage-popover-open--dark--375.png |
| On phones the popover floats mid-left above the bottom nav and isn't anchored visually to the "Usage" tab that opened it. | low | Motion/overlays (origin); Hierarchy | docs/design/s47-before/app/shell--usage-popover-open--dark--375.png |

Survives: one glance at the limits from anywhere, with View plan and See Plus.

### Upgrade sheet

Score: 3/5

- n/a for music and keys.
- Hierarchy without colour: one ink "Continue to checkout", Monthly/Yearly radio cards with a 2 px ink edge plus a check, which passes.
- Targets and contrast: ≥ 44.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| On desktop the bottom drawer spans the full 1440 px width (edge to edge) for a 400 px column. It reads as a phone pattern stretched. | medium | Spacing and density; Media/overlays (sheet vs dialog) | docs/design/s47-before/app/upgrade-sheet--prices-loaded--dark--1440.png |
| "Not now" sits between the plan choice and the primary CTA, and there is no visible close button on desktop (swipe or Esc only). | medium | Hierarchy (position); Focus and keyboard (dismissal) | docs/design/s47-before/app/upgrade-sheet--prices-loaded--dark--1440.png |
| Prices failed: the CTA is disabled without "Unavailable", the error box is red-filled, and the benefits list disappears, so the sheet loses its point. | low | Pills and selection states (disabled); Loading and empty states | docs/design/s47-before/app/upgrade-sheet--prices-failed--light--1440.png |

Survives: "Every practice tool stays free, for every song you already have", a short benefit list with checks, and "Cancel anytime in one tap."

### Toasts, drop overlay and system banners

Score: 3/5

- Music as hero: n/a.
- Fewest steps: Dropping a file anywhere on the shell opens Add song, which saves a step.
- One key or pedal: n/a. Toast Undo is a button with no key hint (⌘Z is mapped in practice).
- Hierarchy without colour: Toasts carry an icon plus text. Banners are a hairline-separated line.
- Targets and contrast: the toast "Undo" and "Close" measured 72×44 and 44×44 in one toast but 65×40 and 40×40 in another instance of the same story. That is under the 44 floor, though it passes 2.5.8 at 24.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Toast actions render at 40 px in one instance (65×40 Undo, 40×40 close), below the project's 44 px browse floor. | low | 2.5.8 (project floor 44) | docs/design/s47-before/app/toast--with-undo--dark--1440.png |
| Toast copy breaks a bar range across lines ("17–" / "20"). It needs a no-break range. | low | Type scale (numbers never change width/wrap) | docs/design/s47-before/app/toast--with-undo--dark--1440.png |
| The drop overlay says only "Drop to add". It has no icon, no accepted formats, and no size or length limit, and it doesn't cover the whole drop surface (an inset box). | low | Loading and empty states (helpful copy) | docs/design/s47-before/app/shell--drop-overlay--dark--1440.png |
| The update-ready banner pushes the whole app shell down, above the header, on phones. Its "Reload" is a secondary pill that's easy to miss, though "It waits until you stop playing" is good. | low | 2.4.11 / Spacing | docs/design/s47-before/app/system-banners--update-ready--light--375.png |
| The offline banner is a calm single line ("Songs you've opened keep working"). Good, nothing to fix. | — | — | docs/design/s47-before/app/library--offline-banner--dark--375.png |

Survives: "Loop saved as … · Undo" toasts, the update that is held back while audio plays, the calm offline line, and drop-anywhere import.

### Group summary

| Screen | Score |
|---|---|
| Library | 3 |
| Add song: File | 3 |
| Add song: Link | 3 |
| Add song: Record | 2 |
| Settings: Account (profile) | 3 |
| Settings: Privacy / data export | 4 |
| Settings: Delete account | 4 |
| Settings: Usage | 3 |
| Settings: Plan | 3 |
| Settings: Display & practice | 3 |
| Settings: Keyboard & pedal | 2 |
| Settings: About | 3 |
| App shell: top bar and phone bottom nav | 3 |
| Command palette | 4 |
| Account menu | 4 |
| Usage popover | 3 |
| Upgrade sheet | 3 |
| Toasts, drop overlay and system banners | 3 |

Top 5 issues:

1. **Critical: the Record tab layout collides at 768 and 1440.** The record panel overflows into "Your part": the Count-in/Click switches and the headset hint draw over the instrument chips. docs/design/s47-before/app/add-song--record-tab-recording--light--1440.png
2. **Critical: the Keyboard & pedal table is clipped at 375.** Action names are cut mid-word, and the learning prompt renders below the table, off-screen. docs/design/s47-before/app/settings-keyboard--learning-a-key--dark--375.png
3. **High: every selected or current state uses grey fills under 3:1.** This covers the segmented capsule (1.09 Light / 1.15 Dark), the top-bar and settings-nav current item (1.09 / 1.27), and the palette's active row. It fails 1.4.11 on Library, Add song, Account, Display and the shell. docs/design/s47-before/app/settings-display--default--dark--1440.png
4. **High: Add song forms validate silently.** Invalid links show no inline error, submit buttons are pre-disabled with no reason, and when the cap is reached the explanation sits below the fold while the used-up option is preselected. docs/design/s47-before/app/add-song--link-tab-invalid-url--dark--375.png
5. **High: the phone library doesn't let songs lead.** Status pills and the "…" button truncate titles to about 12 characters, analysing rows wrap into 4-line columns, the chip row is clipped, and there is no title filter. docs/design/s47-before/app/library--populated-all-song-statuses--dark--375.png

---

## Public pages (_marketing, _auth, _bare)

The public pages are calm and consistent. They use one type family at 400/500, pills everywhere, hairlines instead of boxes, and token-driven Dark/Light parity with few theme-specific surprises. Body and muted text clear 4.5:1 in both themes, and every button pads out to the 44 px browse target. The weak points are product and state, not polish. Home sells the app with soft-focus gear photography and shows none of the music surface, and a signed-in visitor still gets the signed-out pitch. Several state treatments are wrong: the pricing period toggle's selected state is invisible by the numbers, a failed plans request falls through to a bare error page that sends visitors to a library they can't open, and the mock portal shows a payment failure as a green success. Forms and system pages are sound but miss checklist items: 16 px mobile inputs, focus to the first error, and a loading button that keeps its label.

Ratios below are computed from `packages/ui-tokens/src/themes.css` / `primitives.css` (achromatic OKLCH: Y = L³; chromatic tokens converted through OKLab → linear sRGB). Key values: Dark `--muted-foreground`/`--background` 8.31:1, `--faint-foreground` 7.02:1, `--input` 4.24:1, `--border` 1.39:1, `--border-strong` 1.93:1, `--muted` fill 1.27:1, capsule (`--accent` on `--muted`) 1.15:1; Light `--muted-foreground` 8.46:1, `--faint-foreground` 5.51:1, `--input` 3.57:1, `--border` 1.26:1, `--border-strong` 1.61:1, `--muted` fill 1.09:1, capsule (`--card` on `--muted`) 1.09:1; `--destructive` text 7.37:1 Dark / 5.51:1 Light on the page. Focus rings could not be seen in the static screenshots; the button and input code use `:focus-visible` outlines, so focus is judged from code only.

### Home

Score: 2/5

- Music as hero: No. The hero is a headline and the page below is colour still-life photography (strings, a spring, a pedal). No tab, chord or waveform appears anywhere, though `product-still.tsx` and the How it works scenes already exist.
- Fewest steps to practise: Signed out, about 6 actions (Try an example song → instrument → level → screen (skip) → example song → "Play your part"). Signed in, the hero still points to the guest onboarding instead of the library.
- One key / pedal: n/a (marketing page).
- Hierarchy without colour: Mostly clear (display 400/500 headline, lead, CTA). But a filled ink pill sits in the sticky header and another in the hero, and the "Hear your part" tile leaves a large empty column under its text at 1440.
- Targets and contrast: Pass. Pills ≥ 44 px; muted text 8.3–8.5:1. The hero note uses `--faint-foreground` at 13 px: 5.51:1 in Light passes AA but sits below the project's 7:1 body floor.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| No product surface on the page. The proof sections are decorative photos (alt=""), so the claims ("Tab that admits when it's unsure", dashed outline and "?") are described rather than shown. | high | Media and player UI / "music is the hero" | docs/design/s47-before/public/home--signed-out--dark--1440.png |
| Signed-in Home still shows "Sign in" and "Free to try, no account needed" in the hero, and its primary sends a member back to guest onboarding. Only the header switches to Library (`home.tsx` never reads `signedIn`). | high | Hierarchy (one primary for the task); 27 §3.1 states | docs/design/s47-before/public/home--signed-in--light--768.png |
| Two filled ink pills in the first viewport: the header "Try an example song" and the hero's. A third appears in the closing band. | medium | Hierarchy without colour (exactly one filled ink pill per view) | docs/design/s47-before/public/home--signed-out--light--1440.png |
| At lg the sticky "Hear your part" article (col-span-3) leaves about 250 px of empty space under its text beside the two tiles, which reads as a broken grid. | medium | Spacing and density (layouts work with real content) | docs/design/s47-before/public/home--signed-out--dark--1440.png |
| The secondary hero note is two 13 px lines in two greys (muted, then faint) under the CTAs, which dilutes the CTA area. Faint is 5.51:1 in Light (< 7:1 floor). | low | Type scale; Contrast (project floor) | docs/design/s47-before/public/home--signed-out--light--1440.png |
| Lazy-loaded stand thumbnails render as empty grey squares (`bg-muted`) in the 375 full-page capture. Probably a capture artefact of `loading="lazy"`, but there is no art-shaped placeholder. | low | Loading and empty states (skeleton matches final layout) | docs/design/s47-before/public/home--signed-out--dark--375.png |

What works and should survive: the headline and lead copy, display type at 500 with tight tracking, one centred CTA pair, the hairline-topped "How a session goes" list, and the honest "Guitar and bass today" note.

### How it works

Score: 3/5

- Music as hero: Yes, the best of the group. Each step has an inert, component-built picture of the real UI: import, the stem lanes, beat, chords and tab with an unsure "G?", and the loop, speed and pass controls.
- Fewest steps to practise: Same flow as Home (about 6 actions via the closing "Try an example song").
- One key / pedal: n/a. The Practise scene shows "Felt clean" / "Not yet" but no key hints. That would be the place to show "one pedal press".
- Hierarchy without colour: Clear at desktop (h1 → step h2 → lead → picture). The scenes carry their own filled pills ("Your part", "Felt clean"), so inside the picture they compete with the page CTA.
- Targets and contrast: Page controls pass (step jump-links are 44 px secondary pills). Inside the scenes, text scales with the SVG `viewBox` and falls well below 11 px on phones.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Scene SVGs scale with width (`viewBox` + `w-full`), so labels, bar numbers and tab digits fall to roughly 6–7 px at 375 (estimate: 560-unit `viewBox` in about 310 px; 12 px text → about 6.6 px). Stem names ("Bass", "Drums") are unreadable. | high | Type scale (no text below 11 px); Spacing (layouts at every width) | docs/design/s47-before/public/how-it-works--default--light--375.png |
| Scenes are decorative (`inert`, `aria-hidden`), yet they hold the page's only evidence of the product. A screen-reader user gets no description of what the separation or tab picture shows. | medium | Hierarchy / 1.1.1 good practice (the meaning is in the body text, so not a strict failure) | docs/design/s47-before/public/how-it-works--default--dark--1440.png |
| The step jump-links (Bring / Isolate / Transcribe / Practise) are `--muted` secondary pills with no current-section state while scrolling, and they look the same as the "Sign in" pill. | medium | Pills and selection states (current state needs a ≥ 3:1 cue) | docs/design/s47-before/public/how-it-works--default--dark--1440.png |
| `product-still.tsx` draws chord names and the "?" at `font-semibold` (600). That is allowed only under the notation reading-token exception, which these inline SVG classes don't use. | low | Type scale with two weights / Conflicts §1 | docs/design/s47-before/public/how-it-works-scene--transcribe--dark--1440.png |
| The Practise scene puts the filled "Felt clean" pill and the "Loop · bars 5–8 · pass 3" chip side by side with Play absent. The picture doesn't show the transport the copy describes. | low | Media and player UI (loop context, Play as the one primary) | docs/design/s47-before/public/how-it-works-scene--practise--light--1440.png |

What works and should survive: the scenes themselves (built from real ui components, both themes), the "How accurate is it?" honesty section, the alternating text-and-picture rhythm, and `scroll-mt` on the anchored steps.

### Pricing

Score: 3/5

- Music as hero: n/a (a plan page). It correctly leads with "Every practice tool is free".
- Fewest steps to practise: The Free card's "Try an example song" enters the same 6-action onboarding. A signed-in Free user's card says "Current plan" and has no way to practise.
- One key / pedal: n/a.
- Hierarchy without colour: Good. One filled "Get Plus" per card pair, the Free card's CTA is secondary, the compare table is hairline rows, and "Coming soon" is muted with words. The header CTA adds a second filled pill.
- Targets and contrast: Pills pass. The Monthly/Yearly toggle's selected state fails 1.4.11.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Monthly/Yearly segmented toggle: the selected capsule is `--card` on `--muted` = 1.09:1 (Light) and `--accent` on `--muted` = 1.15:1 (Dark). The only other cue is text going from muted to foreground. The selected state has no ≥ 3:1 indicator. | critical | WCAG 1.4.11; Pills and selection states (segmented capsule fix) | docs/design/s47-before/public/pricing--signed-out--light--1440.png |
| If the plans request fails, the loader throws to the root `ErrorPage`. The visitor loses the marketing shell and nav, sees "Something went wrong on this screen." with a raw error id, and is offered "Go to library", which signs-out users can't open. The `InlineError` path in `pricing.tsx` is never reached. | high | Loading and empty states (errors say what happened, what it means, what to do; partial states) | docs/design/s47-before/public/pricing--plans-load-error-boundary--light--1440.png |
| Two filled ink pills per view: the header "Try an example song" and "Get Plus". | medium | Hierarchy without colour | docs/design/s47-before/public/pricing--signed-out--dark--1440.png |
| Three banner treatments in the group. Pricing's demo notice is a full-bleed `--muted` bar under the header, while checkout's is a hairline row and system banners are a hairline row capped at `max-w-page`. | low | Borders and hairlines / Dark-light parity (one role set) | docs/design/s47-before/public/pricing--signed-out--dark--375.png |
| The yearly alternative "· or $79.99 a year" is 13 px `--faint-foreground` (5.51:1 Light) beside a 48 px price. It is easy to miss, and the toggle duplicates it. | low | Type scale; Contrast (project floor) | docs/design/s47-before/public/pricing--signed-out--light--1440.png |
| The compare table squeezes three columns at 375 and wraps "1 Welcome analysis", "No monthly limit" and "Coming soon" over two lines. | low | Spacing and density (short/long content at phone width) | docs/design/s47-before/public/pricing--signed-out--dark--375.png |

What works and should survive: the "Every practice tool is free" framing, card structure (name, lead, price with `tabular-nums`, one CTA, ticked list), the hairline compare table with row headers, and the demo-mode notice.

### Legal

Score: 4/5

- Music as hero: n/a.
- Fewest steps to practise: n/a (the header CTA is available).
- One key / pedal: n/a.
- Hierarchy without colour: Clear. A 72 ch reading column, the h1 and date, a sticky TOC in the margin, and section h2s.
- Targets and contrast: Pass. TOC links are 44 px rows of muted text at 8.3–8.5:1.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Privacy says "Your email address" is kept, but sign-up is username-only ("No email needed" on the auth page). The legal copy contradicts the product. | medium | Forms / 27 §5 content accuracy | docs/design/s47-before/public/legal-privacy--default--light--1440.png |
| The TOC has no current-section state while reading (all items muted, hover only). | low | Pills and selection states (current state ≥ 3:1 cue) | docs/design/s47-before/public/legal-privacy--default--light--1440.png |
| Section headings are `text-2xl` (32 px) over one- or two-line bodies, so the headings outweigh the content. "Last updated 22 Oct" has no year. | low | Type scale (text vs label roles) | docs/design/s47-before/public/legal-terms--default--dark--1440.png |

What works and should survive: the reading column with `text-lead` 17/28, the sticky margin TOC that becomes a hairline-bounded list on phones, and `scroll-mt` on sections.

### Sign in / Sign up

Score: 4/5

- Music as hero: n/a (the form is the page, correctly).
- Fewest steps to practise: Sign in → library → song → Play: about 4 actions. The page has no "Try an example song" escape for someone who came here by mistake, only the wordmark.
- One key / pedal: n/a. Enter submits.
- Hierarchy without colour: Clear. A 400 px column with h1, lead, two 52 px fields and one filled submit; Google is an outline pill after an "or" rule.
- Targets and contrast: Fields are 52 px. The `--input` border is 4.24:1 Dark and 3.57:1 Light, passing 1.4.11. Error text is 7.37:1 / 5.51:1 with an icon.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Inputs are `text-base` (15 px) on every pointer, so iOS Safari zooms the page on focus. | medium | Type scale (mobile inputs ≥ 16 px) | docs/design/s47-before/public/sign-in--empty--light--375.png |
| On submit with errors, focus stays on the button. `check()` sets messages but never focuses the first invalid field. | medium | Forms (focus moves to the first error on submit) | docs/design/s47-before/public/sign-in--validation-errors-empty--light--375.png |
| While submitting, the button turns into the disabled style (muted fill, `--input` ring) and hides its label (`opacity-0`) behind a spinner. Primary emphasis and the label disappear. | medium | Forms (submit keeps its label and shows a spinner) | docs/design/s47-before/public/sign-in--submitting--light--375.png |
| "That username and password don't match" marks only the password field invalid, which suggests the username was fine. | low | Forms (errors inline, next to the cause) | docs/design/s47-before/public/sign-in--wrong-credentials--light--1440.png |
| "Create an account" and the Terms/Privacy links are 13 px inline text links (about 18 px tall). Allowed by the 2.5.8 inline exception, but below the project's 44 px browse floor. | low | 2.5.8 / project target floor | docs/design/s47-before/public/sign-up--empty--dark--375.png |

What works and should survive: the empty, card-less 400 px column, 52 px fields with ink-on-hover borders, inline errors with icons and `aria-describedby`, correct `autocomplete`/`spellcheck`, the "No email needed" reassurance, and Google as a clearly secondary outline pill.

### Mock checkout

Score: 4/5

- Music as hero: n/a.
- Fewest steps to practise: n/a (billing).
- One key / pedal: n/a.
- Hierarchy without colour: Clear. A demo notice, h1, plan and price between hairlines, one filled "Simulate successful payment", a secondary "declined" and a ghost "Cancel".
- Targets and contrast: Pass. 48 px block buttons; the declined `InlineError` is foreground text on `--destructive-surface` (16.9:1 Light, 15.8:1 Dark) with an icon.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| The "Try again" in the declined error only dismisses the message; it doesn't retry anything, so the label promises an action that doesn't happen. | medium | Loading and empty states (errors say what you can do) | docs/design/s47-before/public/mock-checkout--after-declined-card--light--375.png |
| Four horizontal rules in about 300 px (under the banner, under the h1, above and below the plan). Whitespace would do. | low | Borders and hairlines (fewer separators) | docs/design/s47-before/public/mock-checkout--default--dark--1440.png |
| The expired-link state's only way out is "Go to billing settings". A visitor who isn't signed in is bounced to sign-in with no explanation. | low | Loading and empty states (error copy) | docs/design/s47-before/public/mock-checkout--expired-link--dark--375.png |

What works and should survive: the bare 480 px column, the explicit "Demo mode — no real charges" line, no card fields, and the three outcomes ranked by visual weight.

### Mock portal

Score: 3/5

- Music as hero: n/a.
- Fewest steps to practise: n/a.
- One key / pedal: n/a.
- Hierarchy without colour: Inverted priorities. The filled ink pill is "Cancel Plus", so the most prominent action on the page is the one a subscriber least often wants. "Back to Plan" is a left-aligned ghost under full-width blocks.
- Targets and contrast: Pass on numbers (48 px buttons, text ≥ 7:1).

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Past due: "The (simulated) payment failed" is shown in the success tone (green check, `--success-surface`), directly under a plain line saying the same thing. A failure carries the "all good" icon and colour. | high | 1.4.1 / Loading and empty states (status meaning carried by icon and colour must match) | docs/design/s47-before/public/mock-portal--past-due--dark--375.png |
| "Cancel Plus" is the filled primary pill. A destructive or reducing action should be secondary or outline, with the primary reserved for the main task (or none). | medium | Hierarchy without colour (one filled ink pill for the primary task) | docs/design/s47-before/public/mock-portal--active--light--1440.png |
| Simulation buttons are full-width `--muted` pills that look identical to "Switch to yearly". The only separation between real account actions and test simulations is a 17 px "Simulations" heading. | low | Hierarchy without colour (grouping by position and spacing) | docs/design/s47-before/public/mock-portal--active--light--1440.png |
| The confirmation line after cancelling appears above the buttons, but nothing moves focus or scrolls to it. `role="status"` announces it, so this is only a sighted-keyboard concern. | low | Focus and keyboard | docs/design/s47-before/public/mock-portal--cancelling-confirmation--light--375.png |

What works and should survive: cancel in one tap with a dated confirmation line instead of an "are you sure" loop, the shared `BillingCard` layout with checkout, and the explicit expired-link state.

### Account deleted

Score: 4/5

- Music as hero: n/a.
- Fewest steps to practise: Home → Try an example song (about 7 actions to playing).
- One key / pedal: n/a.
- Hierarchy without colour: Clear. One-sentence h1, one muted sentence, one primary pill.
- Targets and contrast: Pass (44 px pill; muted 8.3–8.5:1).

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| The message is vertically centred in an empty viewport at 1440, with the wordmark far top-left. It reads as an unstyled stop page rather than a designed end state, with no timing ("within the hour", as Legal says) or confirmation detail. | low | Loading and empty states (what happened, what it means) | docs/design/s47-before/public/account-deleted--default--light--1440.png |

What works and should survive: the system-page pattern (no card, h1 + sentence + one pill) and the plain copy.

### Unsupported browser

Score: 3/5

- Music as hero: n/a.
- Fewest steps to practise: Blocked by design; the page's job is to get the learner to another browser via "Copy link".
- One key / pedal: n/a.
- Hierarchy without colour: Mostly clear. But "Details" is a bare `<summary>` with no chevron or disclosure affordance, and "Your library is still available" is a ghost button that reads like a sentence.
- Targets and contrast: Pass (summary is `min-h-target`).

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| The "Details" disclosure has no icon or expanded-state cue (the default marker is removed by `inline-flex`). It looks like a label, not a control. | medium | Pills and selection states (state needs a non-colour cue); Focus and keyboard (discoverable controls) | docs/design/s47-before/public/unsupported--default--light--375.png |
| The secondary action "Your library is still available" points to `/library`. A signed-out guest (the usual visitor from an in-app browser) lands on sign-in instead. The label isn't phrased as an action either. | medium | Loading and empty states (what you can do) | docs/design/s47-before/public/unsupported--default--dark--1440.png |
| The body sentence lists technical names ("AudioWorklet", "WebAssembly SIMD") inline in a long 15 px paragraph. Long for a phone; the names belong under Details. | low | Type scale / 27 §5.4 plain language | docs/design/s47-before/public/unsupported--default--light--375.png |

What works and should survive: naming the specific missing capability, "Copy link" as the one primary, and feature detection rather than UA sniffing.

### Not found / error boundary

Score: 3/5

- Music as hero: n/a.
- Fewest steps to practise: From the 404, "Go to library" → (signed out: sign-in) → … There is no direct way to the example song.
- One key / pedal: n/a.
- Hierarchy without colour: Clear on 404 (a muted "404", h1, hint, one pill). The error page has no explanatory sentence, only the h1 and a mono error id.
- Targets and contrast: Pass on controls. The error id is 13 px `--faint-foreground` mono (5.51:1 Light).

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| Both pages send everyone to "Go to library", including signed-out visitors on public URLs (e.g. `/legal/nope`), who are then redirected to sign-in. There is no "Home" or "Try an example song" route out. | medium | Loading and empty states (what you can do); fewest steps | docs/design/s47-before/public/not-found--unknown-legal-page--light--375.png |
| Errors and 404s inside `_marketing` replace the marketing shell with `BareShell`, so nav and footer disappear mid-site. | medium | Hierarchy (navigation persists); Focus and keyboard (real links) | docs/design/s47-before/public/not-found--unknown-legal-page--dark--1440.png |
| The error page has only "Something went wrong on this screen." and the id. It lacks "what it means" (is my data safe?) and a sentence on what Reload will do. | medium | Loading and empty states (27 §5.4 three-part errors) | docs/design/s47-before/public/error-boundary--screen-error--light--1440.png |
| The error id uses `font-mono`, a third type family outside Figtree, at faint 13 px. | low | Type scale with two weights | docs/design/s47-before/public/error-boundary--screen-error--dark--375.png |

What works and should survive: the copyable error id (with "Copied" feedback), the quiet "404" numeral, and one primary plus one ghost action.

### Marketing shell and system banners

Score: 3/5

- Music as hero: n/a (chrome). The chrome mostly recedes: no rule under the bar, plain text links.
- Fewest steps to practise: The header CTA "Try an example song" is reachable from every public page (1 action to enter onboarding). The phone menu buries it as the last item.
- One key / pedal: n/a. Skip link present; menu is a Base UI dropdown (keyboard-operable).
- Hierarchy without colour: Header has a `--muted` "Sign in" pill plus a filled CTA, and nothing marks the current page. On phones, the "Menu" pill and the dropdown give the primary CTA no prominence.
- Targets and contrast: Pass (44 px nav items, `min-h-target` footer links). Banner actions use `size="sm"` padded to 44 px.

| Issue | Severity | Guideline violated | Screenshot |
|---|---|---|---|
| No current-page indicator. "How it works" and "Pricing" look the same on their own pages (ghost links; TanStack's `aria-current` is unstyled), in the header, the phone menu and the footer. | medium | Pills and selection states (current nav needs a ≥ 3:1 cue) | docs/design/s47-before/public/how-it-works--default--dark--1440.png |
| Phone menu: "Try an example song" is an ordinary last menu item that wraps to two lines. The page's primary action loses its pill and is ranked below "Sign in". | medium | Hierarchy without colour (one filled ink pill) | docs/design/s47-before/public/marketing-shell--menu-open--dark--375.png |
| System banners render above the sticky header in a `max-w-page` column, misaligned with the `max-w-marketing` header at 1440, and they scroll away. The offline notice is a 13 px line easily lost above the wordmark. | low | Spacing and density (one grid); Loading and empty states (offline state) | docs/design/s47-before/public/marketing-shell--in-app-browser-banner--dark--1440.png |
| "A new version is ready. It waits until you stop playing." is shown on pages that have no player, where the second sentence is noise. Its Reload is a `--muted` pill with no hairline (1.09:1 Light), identified by label only. That is allowed, but it is weak beside the banner text. | low | Hierarchy; Borders (`--muted` fills identified by label) | docs/design/s47-before/public/system-banner--update-ready--light--375.png |
| The offline banner uses the `warning` tone, which maps to `--muted-foreground`, so the only status cue is the wifi-off icon. That is acceptable (icon plus words), but it is the same weight as the info banners. | low | 1.4.1 (second cue present); Hierarchy | docs/design/s47-before/public/marketing-shell--offline-banner--light--375.png |

What works and should survive: the rule-less 64 px sticky bar, the skip link, the quiet footer with 44 px text links, banners as one quiet line plus hairline (no tinted bars), the in-app-browser hint with Copy link, and the update prompt held while audio plays.

### Group summary

| Screen | Score |
|---|---|
| Home | 2/5 |
| How it works | 3/5 |
| Pricing | 3/5 |
| Legal | 4/5 |
| Sign in / Sign up | 4/5 |
| Mock checkout | 4/5 |
| Mock portal | 3/5 |
| Account deleted | 4/5 |
| Unsupported browser | 3/5 |
| Not found / error boundary | 3/5 |
| Marketing shell and system banners | 3/5 |

Top 5 issues for the group:

1. **Pricing period toggle fails 1.4.11** (critical). The selected Monthly/Yearly capsule is 1.09:1 (Light) and 1.15:1 (Dark) against its track. Use inversion or an ink edge. `docs/design/s47-before/public/pricing--signed-out--light--1440.png`
2. **Home shows no music** (high). The landing page is gear photography; the tab, chord and stem scenes that exist on How it works (and `product-still.tsx`) should be the hero. `docs/design/s47-before/public/home--signed-out--dark--1440.png`
3. **Signed-in Home gives the signed-out pitch** (high). "Sign in", "no account needed" and a guest-onboarding primary are shown to a member, with no route to the library from the hero. `docs/design/s47-before/public/home--signed-in--light--768.png`
4. **Failure states misroute or mislabel** (high). Pricing's plans failure drops to a bare error page that offers "Go to library" to signed-out visitors (the 404 and Unsupported do the same), and the mock portal shows a payment failure in the green success tone. `docs/design/s47-before/public/pricing--plans-load-error-boundary--light--1440.png`, `docs/design/s47-before/public/mock-portal--past-due--dark--375.png`
5. **How it works scenes shrink below legibility on phones** (high). SVG text scales with the `viewBox` to about 6–7 px at 375 (estimate), so the page's only product evidence is unreadable on the device most learners use. `docs/design/s47-before/public/how-it-works--default--light--375.png`

Runners-up: two filled ink pills per view across marketing pages, no current-page or current-section indicator in nav and TOCs, 15 px inputs on phones, and a loading submit that loses its label.

## Scores after the redesign

Scored by a reviewer who took no part in the build (Phase 5c, 2026-11-24), from 260 screenshots in
`docs/design/s47-after/` (not tracked, like the before set) and the code, against the same checklist
and on the same 1–5 scale. The full review, with every finding and its evidence, is
`docs/design/s47-qa.md`. These scores were given **before** the fixes that followed the review
(listed under the table), so the screens those fixes touch may now deserve more; they were not
scored again.

| Group | Screen | Before | After |
|---|---|---|---|
| Public | Home | 2 | 4 |
| Public | How it works | 3 | 4 |
| Public | Pricing | 3 | 4 |
| Public | Legal | 4 | 5 |
| Public | Sign in / Sign up | 4 | 5 |
| Public | Mock checkout | 4 | 5 |
| Public | Mock portal | 3 | 4 |
| Public | Account deleted | 4 | 5 |
| Public | Unsupported browser | 3 | 4 |
| Public | Not found / error boundary | 3 | 4 |
| Public | Marketing shell and system banners | 3 | 4 |
| Signed-in app | Library | 3 | 4 |
| Signed-in app | Add song: File | 3 | 4 |
| Signed-in app | Add song: Link | 3 | 4 |
| Signed-in app | Add song: Record | 2 | 4 |
| Signed-in app | Settings: Account | 3 | 4 |
| Signed-in app | Settings: Privacy / data export | 4 | 4 |
| Signed-in app | Settings: Delete account | 4 | 4 |
| Signed-in app | Settings: Usage | 3 | 4 |
| Signed-in app | Settings: Plan | 3 | 4 |
| Signed-in app | Settings: Display & practice | 3 | 4 |
| Signed-in app | Settings: Keyboard & pedal | 2 | 4 |
| Signed-in app | Settings: About | 3 | 4 |
| Signed-in app | App shell: top bar and phone bottom nav | 3 | 4 |
| Signed-in app | Command palette | 4 | 4 |
| Signed-in app | Account menu | 4 | 4 |
| Signed-in app | Usage popover | 3 | 4 |
| Signed-in app | Upgrade sheet | 3 | 4 |
| Signed-in app | Toasts, drop overlay and system banners | 3 | 3 |
| Onboarding, Getting ready, Fix, editor | Onboarding steps 1–4 | 4 | 4 |
| Onboarding, Getting ready, Fix, editor | Onboarding guide and coach marks | 3 | 4 |
| Onboarding, Getting ready, Fix, editor | Save progress sheet and Saved | 4 | 4 |
| Onboarding, Getting ready, Fix, editor | Practice loading and error | 3 | 4 |
| Onboarding, Getting ready, Fix, editor | Getting ready / analysing | 2 | 3 |
| Onboarding, Getting ready, Fix, editor | Partial analysis states and their banners | 3 | 3 |
| Onboarding, Getting ready, Fix, editor | Fix tab and unsure-spot queue | 3 | 4 |
| Onboarding, Getting ready, Fix, editor | Editor sheet (touch) | 2 | 3 |
| Onboarding, Getting ready, Fix, editor | Full editor | 3 | 4 |
| Onboarding, Getting ready, Fix, editor | Focus shell bar | 2 | 4 |
| Practice | Desktop layout (≥ 1180) | 3 | 4 |
| Practice | Narrow desktop / tablet layout | 2 | 3 |
| Practice | Phone layout | 1 | 3 |
| Practice | Song map | 3 | 3 |
| Practice | Notation views | 3 | 3 |
| Practice | Transport dock / bar (now the one transport) | 2 | 4 |
| Practice | Now column / strip (now chords over the tab and the chord strip) | 3 | 4 |
| Practice | Inspector: Loop | 3 | 4 |
| Practice | Inspector: Mix, mixer drawer and mini-mixer (now the Mix tab and phone mini-mixer) | 3 | 4 |
| Practice | Inspector: Progress | 3 | 4 |
| Practice | Speed panel and speed ladder | 3 | 4 |
| Practice | Count-in and pass prompt (now the pass question in the transport) | 2 | 4 |
| Practice | Confidence marks and legend | 2 | 4 |
| Practice | Display and More popovers | 3 | 3 |
| Practice | Shortcuts overlay and pedal HUD | 3 | 4 |
| Practice | Banners / loading / error | 2 | 3 |

| Group | Screens | Before (mean) | After (mean) |
|---|---|---|---|
| Public | 11 | 3.27 | 4.36 |
| Signed-in app | 18 | 3.11 | 3.94 |
| Onboarding, Getting ready, Fix, editor | 10 | 2.90 | 3.70 |
| Practice | 16 | 2.56 | 3.63 |
| All | 55 | 2.95 | 3.89 |

The review found no critical issue, 3 high, 22 medium and 36 low. Fixed after it, each with a test:

- **High:** rests ran into fret digits at 1180 px with the panel docked, at 768 px and on phones (bars per system now follow the pane's width and the digit size); the touch editor sheet hid the bar being fixed (it takes its room from the stage and the score scrolls the bar into view); Pricing and Home promised a slow-down range the app does not have (the copy now says 50 %).
- **Medium, practice:** sheets painted over the transport's status row; unavailable controls drew the solid ring of "on" (now dashed); Space re-pressed a clicked control instead of playing; the lead-in read as bar 0; the More menu stayed open over what it opened; the Display panel ran over the transport on phones; a blank band sat above the first system; the loop grips were invisible until hovered; the click had no key (`T`); the fretboard's next shape used the "probably" dash.
- **Medium, other screens:** Getting ready promised a time while the processing machine was offline; an unreadable file led with Try again; "stems unavailable" had no action; the Keyboard & pedal page left out the keys that cannot be learned and its pedal heading could not be pressed; Add song's tabs scrolled away; the library's state line was cut off; the Home still's transport collapsed at 768 px; the How it works step nav scrolled out of view.
- **Low:** ten of the 36, among them the onboarding examples for another instrument, the library skeleton, the phone empty state, the delete dialogs' button order on phones and the settings tab line.

Left as they are, with the reason: section chips on the phone song map (sections reach the app with s41b); the Back link as a bare chevron below 1024 px (a label there squeezes the song title); the position readout's bar total against a score that prints a trailing bar; the number field's 40 px well (its step targets are 48 px); the vocal phrase strip's own loop toggle; the pricing table wrapping at 375 px; the remaining lows in `s47-qa.md`.
