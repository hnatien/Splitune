# s47 design QA: the redesigned UI

This is an independent review of the s47 redesign on branch `impl/47-full-redesign`. It covers the 260 "after" screenshots in `docs/design/s47-after/` and the code behind them. Each screen is scored against `s47-guidelines.md`, the audit (`s47-audit.md`), the direction (`s47-direction.md`) and spec 27.

Scores use the audit's scale:
- **5:** meets the checklist; only polish is left.
- **4:** sound, with minor issues.
- **3:** works, but has several medium issues or one serious one.
- **2:** serious problems.
- **1:** broken.

Severities are **critical** (blocks a task or fails WCAG AA), **high**, **medium** and **low**.

Ratios come from `packages/ui-tokens/src/contrast.test.ts`.

**What was out of scope.** These gaps were already recorded, and are not counted against a screen unless they hurt the learner on it:
- e2e and visual baselines;
- no music strip in rows;
- the 40 px number well;
- no pedal wizard;
- the alphaTab render race.

**Method.**
- Every Dark and Light 1440 shot and every 375 shot was opened, plus the 768 and 1180 shots.
- The review was split four ways: Public, App, the Focus rows other than practice, and the Practice rows. Each part saw the shots and the code for its rows.

## Average scores

| Group | Rows | Before | After |
|---|---|---|---|
| Public | 11 | 3.27 | 4.36 |
| App | 18 | 3.11 | 3.94 |
| Focus (onboarding, getting ready, fix, editor, shell) | 10 | 2.90 | 3.70 |
| Practice | 16 | 2.56 | 3.63 |
| **All** | **55** | **2.95** | **3.89** |

The redesign fixed the audit's systemic failures:
- Grey-fill selection is gone everywhere; selection is now an ink edge or ink line. A token test enforces this (`contrast.test.ts`, "selection is never a grey fill").
- Confidence is no longer hue-only.
- The phone practice screen works.
- The transport no longer overflows.
- The music gets about 73 % of 1440 × 900. It got about 40 % before.

What remains is mostly:
- reading quality of the tab at narrow widths;
- phone sheets that cover the status row;
- a few state cues that read the wrong way;
- one capability promise the app does not keep (speed below 50 %).

## 1. Scores per screen

| Group | Screen | Before | After | Why |
|---|---|---|---|---|
| Public | Home | 2 | 4 | The hero is now the kit-built practice screen. It has one filled control, and signed-in visitors get "Open your library". The still's transport still breaks at 768: the loop pill shrinks to an icon over count-in (`home--signed-out--dark--768.png`). The hero tab sits in an empty band. |
| Public | How it works | 3 | 4 | Scene text is real text and readable at 375. The scenes have text alternatives, and the Practise scene shows N / C. The step links that mark the current step are not sticky, so the mark is never on screen. |
| Public | Pricing | 3 | 4 | Monthly / Yearly are rows with an ink edge and a check. One filled control. A failed load stays in the marketing shell. The row "Slow down to 25 %" promises what practice does not do (H1). The compare table wraps at 375. |
| Public | Legal | 4 | 5 | The TOC marks the current section with an ink line. The date has its year. Privacy says "username". Only polish is left. |
| Public | Sign in / Sign up | 4 | 5 | Focus moves to the first error (`sign-in.tsx:111`). Fields are 16 px on coarse pointers (`ui/input.tsx:19`). Submit keeps its fill and label. There is a quiet way to the example song. |
| Public | Mock checkout | 4 | 5 | One hairline instead of four. No dead "Try again". The expired-link copy depends on sign-in state. |
| Public | Mock portal | 3 | 4 | Past due shows the warning glyph. Cancel Plus is outline and the confirmation takes focus. Cancel Plus still comes first, and "Back to Plan" is out of line with the column. |
| Public | Account deleted | 4 | 5 | A plain message at the top of the column, with timing and one pill. |
| Public | Unsupported browser | 3 | 4 | Details has a chevron and a state. The secondary action depends on sign-in. The body still names AudioWorklet and WebAssembly SIMD. |
| Public | Not found / error boundary | 3 | 4 | Says the learner's data is safe and what Reload does. The 404 offers Home and the example song. The legal 404 stays in its shell. The signed-out error path is in code only. |
| Public | Marketing shell and system banners | 3 | 4 | The current page has a 2 px ink line. The bar CTA is outline. The phone menu marks the current page with a check. Banners are one quiet line. Banners and content still sit on different grids. |
| App | Library | 3 | 4 | Hairline rows grouped by need, status as a glyph plus words, and the filter names itself. The phone title filter is back. The status explanation is cut off even at 1440, and the skeleton doesn't match the page. |
| App | Add song: File | 3 | 4 | Submit is never disabled in advance. An early press says what is missing and moves focus there. Choices are ink-edged rows. Unreadable files offer "Choose another file". After that early press at 1440 × 900, the tabs scroll out of view. |
| App | Add song: Link | 3 | 4 | Inline error with an icon on blur. Submit stays enabled. The video switch says what it costs. |
| App | Add song: Record | 2 | 4 | The overlap is gone (asserted in the story). `R` starts and stops. The meter track is edged. The take is reviewed as a waveform. Recording and review are checked in code only. |
| App | Settings: Account | 3 | 4 | The current section has an ink line. Main instrument is a select. On phones the h1 is near the top. The read-only Username looks editable, and the phone tab line cuts "Ke…" with no cue. |
| App | Settings: Privacy / data export | 4 | 4 | Clean rows. "Prepare a new file" is out of line with the column. The failed and offline states were not captured. |
| App | Settings: Delete account | 4 | 4 | The dialog lists what goes, and Cancel gets focus. On phones the destructive button is stacked above Cancel. |
| App | Settings: Usage | 3 | 4 | Meter tracks are edged, so an empty meter is visible. |
| App | Settings: Plan | 3 | 4 | Allowance shown as `Stat`s. On Plus, Manage is outline and Cancel is quiet. |
| App | Settings: Display & practice | 3 | 4 | All eight segmented controls are ink-edged pills, and the stepper has its unit. The Light shot shows "Dark" chosen (a fixture issue). |
| App | Settings: Keyboard & pedal | 2 | 4 | Reflows at 375. The test area comes first. The learning prompt sits in its row (code). The digit and Shift keys are not listed, and "Have a pedal? Set it up" can't be pressed. |
| App | Settings: About | 3 | 4 | The models are folded into a disclosure. Its label stays "Show all 19 models" while open. |
| App | App shell: top bar and phone bottom nav | 3 | 4 | The rail's current item has a 2 px ink line and `aria-current`. An open popover uses hover, not "current". The phone bar's Add song is a plain tab. |
| App | Command palette | 4 | 4 | The active row has a 1.5 px ink edge plus the Enter cap, and Add song shows `A`. The field's square focus outline touches the text. |
| App | Account menu | 4 | 4 | Grouped, with a check on the appearance. No username line, and no external-link cue on Help. |
| App | Usage popover | 3 | 4 | Tracks edged, anchored to its trigger. The reset lines are still small faint text. |
| App | Upgrade sheet | 3 | 4 | A dialog with Close on desktop, a sheet on phones. Continue comes before Not now. If prices fail, the benefits stay. |
| App | Toasts, drop overlay and system banners | 3 | 3 | The drop overlay is fixed (full window, edge, formats). No toast was captured, and the iOS install-hint shots show no banner. There isn't enough evidence to raise the score. |
| Focus | Onboarding steps 1–4 | 4 | 4 | One page, two actions to sound. The row selection has an ink edge and a check. Remaining: the phone Exit is a bare chevron, the sticky bar truncates, there are two "Stitch Up" rows, and a bass song is offered for guitar. |
| Focus | Onboarding guide and coach marks | 3 | 4 | The guide is a line in the page flow with Got it (Esc), never over a control (story assert, phone shot). The desktop shot shows it already dismissed. |
| Focus | Save progress sheet and Saved | 4 | 4 | A centred dialog from 640 px, quiet "Not now", Saved shown as a row. The phone Back is a bare chevron. |
| Focus | Practice loading and error | 3 | 4 | The skeleton has the map, the paper and the transport. Load-failed says what happened and offers Try again. "Loading your song…" sits across a skeleton staff line. |
| Focus | Getting ready / analysing | 2 | 3 | The phone now shows the stages and the part question, and the badge no longer covers Back. Worker offline still promises "In about 2–4 min" with turning spinners. A failed analysis still leads with Try again. The desktop part question is in neither 1440 shot. |
| Focus | Partial analysis states and their banners | 3 | 3 | Banners are quiet lines with a glyph. "Stems unavailable" still has no action and still says "This didn't use an analysis". The chords-only banner wasn't captured. |
| Focus | Fix tab and unsure-spot queue | 3 | 4 | Ink digits with a dashed box and "?", F? / G? chips, `Y` accepts, Listen to has ink edges, Play is the only filled control. Remaining: Delete note is the loudest control, the header says "bar 4" over a bar 3 card, and the 99+ spots case has defects. |
| Focus | Editor sheet (touch) | 2 | 3 | Non-modal, with "Spot n of N", ‹ ›, Close and J / K / pedal. It still hides the bar being fixed (H3) and covers the status row. |
| Focus | Full editor | 3 | 4 | Uses the practice key map and learned pedals; Undo and Redo sit together. Note chips are an ungrouped wall, and presses get no confirmation. |
| Focus | Focus shell bar | 2 | 4 | No overlap with Back at any width, and onboarding uses the same bar. Back is a bare chevron below 1024 px. |
| Practice | Desktop layout (≥ 1180) | 3 | 4 | The notation gets about 73 % at 1440 × 900, the panel is closed by default, and Play is the only filled control. At 1180 with the panel open, rests collide with digits (H2). There is a 75 px empty band above system 1. The readout says "0.4 / 8" over a highlighted bar 1. |
| Practice | Narrow desktop / tablet layout | 2 | 3 | Nothing overflows any more: three rows, the drawer stops above the transport, Next bar is back. But the 768 tab keeps four bars a system, so rests overprint digits (H2). Tools and Click are icon-only. Back is a bare chevron. |
| Practice | Phone layout | 1 | 3 | No longer broken: Tab by default, two bars a system, a status row, two transport rows, everything reachable. Remaining: rests collide with digits (H2), an 80 px empty band above system 1, and the tools sheet hides the status row (M1). The compact map has no peaks, chips or handles (M5). The glance view was not captured: `glance-phone` shows Tab. |
| Practice | Song map | 3 | 3 | The loop band and now-line work, and the code has section chips with an ink line under the looped one. But no practice shot shows chips: the Riff song has no sections, and the ruler shows only "1". Loop handles are still invisible at rest (M6). The phone map drops chips, peaks and handles (M5). |
| Practice | Notation views | 3 | 3 | The tab is clean at 1440: chords over the tab, rhythm under it, a 2 px ink line under the bar playing, ink unsure digits. Rests collide at ≤ 1180 (H2). The Notes, Chords and Staff stories captured other views (`guitar-notes`, `chords-view` show Tab; `piano-staff` shows the roll). Drums show 2 bars across 1440. Vocals still carry a second loop toggle. The neck's "next shape" uses the "probably" dash (M10). |
| Practice | Transport dock / bar (now the one transport) | 2 | 4 | One 80 px row from 1024 px with key caps from 1180. Stacked rows below that. The pass question takes the loop's place. Every target is 48 / 64 (`DockTargets` asserts this). Disabled controls draw a ring that reads as "on" (M2). Space after a click re-presses that control (M3). Click has no key. |
| Practice | Now column / strip (now chords over the tab and the chord strip) | 3 | 4 | The Now column is gone. Chord names sit over the tab, and a strip appears only for lanes, drums and piano (piano's "Now · bar 2" box reads well). The drums strip shows chord names, not the bar-and-count readout spec 27 §3.7.5 asks for. |
| Practice | Inspector: Loop | 3 | 4 | Steppers, lengths 1 · 2 · 4 · 8 with an ink edge, Earlier / Next phrase with ⇧← ⇧→ caps, rest and count-in as ink-edged pills, clips as rows. A disabled "8" looks like a second selection (M2). "×2" wraps alone. The ladder is below the fold at 900. The phone sheet prints key caps. |
| Practice | Inspector: Mix, mixer drawer and mini-mixer (now the Mix tab and phone mini-mixer) | 3 | 4 | Presets are rows; stem rows have colour rule plus name, 48 px M / S and a readout. Solo dims the others with "Not heard" (story). The tablet drawer stops above the transport. A custom mix shows no state. The phone shot shows the "All stems" view, not the mini-mixer, in a sheet that has room for one stem row. |
| Practice | Inspector: Progress | 3 | 4 | Reachable on every layout now. Stats, a chart with solid/round versus dashed/square series, session rows. On phones the sheet clips the legend. |
| Practice | Speed panel and speed ladder | 3 | 4 | A typed field focused by `S`, presets with an ink edge, ladder goal on the readout ("80 BPM · → 100"). Speed is clamped to 50–100 % (H1). |
| Practice | Count-in and pass prompt (now the pass question in the transport) | 2 | 4 | "Pass 2 at 70 % — how was it?" with outline Not yet N / Felt clean C in the loop's place; nothing floats over the music. The count-in display and the phone status-row question were not captured. |
| Practice | Confidence marks and legend | 2 | 4 | Unsure is an ink digit with a dashed box and a 12 px / 500 "?" (`alphatab-view.tsx:642`). "Show uncertainty" off removes the marks and the key-row samples. The legend chip counts in words. The neck reuses the dash for "next" (M10). The legend shows a model version "(v0.4.0)". |
| Practice | Display and More popovers | 3 | 3 | One selection style (ink edge) throughout. On phones the Display popover runs over the transport, and "Floor" wraps alone (M8). The ⋯ popover stays open over the dialogs it opens, and its Search label overflows (M7). |
| Practice | Shortcuts overlay and pedal HUD | 3 | 4 | Every key grouped with caps and one "Set up a pedal". Reachable from ⋯ on phones. "Speed 50 to 100 %" caps overflow their column. The HUD and "Pedal detected? Set it up" are not in any shot (code reviewed). |
| Practice | Banners / loading / error | 2 | 3 | Quiet one-line banners with one action (Re-create stems). Two stacked banners sit on two grids (`practice--not-saved-offline--dark--1440.png`). The disabled transport turns into a row of rings with no visible reason. The screen-lock banner is not in its shot. The stems-unavailable copy is unchanged. |

## 2. Findings

### Critical and high

None of the audit's critical problems remains in the evidence. Three high issues are new or remain:

**H1. Speed cannot go below 50 % or above 100 %, but Pricing promises 25 %. (high)**
- **Screens:** Practice (speed control, speed panel, keys), Pricing.
- **What:**
  - `setSpeed` clamps to 50–100: `Math.min(100, Math.max(50, …))` (`apps/web/app/features/practice/practice-context.tsx:795`).
  - `SpeedControl` uses `[50, 100]` unless `advanced` (`apps/web/app/ui/speed-control.tsx:107`), and the transport never passes `advanced`. So at the default 100 % the "+" is always disabled.
  - Spec 27 keeps `?speed` at 25–110, and the ladder allows 110 (`model/ladder.ts:25`).
  - Pricing's compare row says "Slow down to 25 % without changing pitch" (`apps/web/messages/en.json:943`).
  - Home says "loops any bar at any speed".
- **Why:** For a hard passage 40 % is ordinary practice. The public pages promise what the app does not do (spec 27 §3.1 honesty gates).
- **Origin:** the clamp predates s47; it is not a regression of the redesign.
- **Fix:** Allow 25–110 in `setSpeed` and the transport's `SpeedControl`, with presets down to 25 %. Or change the Pricing and Home copy to the real range.

**H2. Tab rests overprint fret digits at 1180 with the panel open, at 768 and at 375. (high)**
- **Screens:** Notation on desktop with the panel open, tablet and phone.
- **What:** At 1440 the eighth-note rests sit clear of the digits. At 1180 with the panel open, rests run into digits ("1⁷0", "⁷2⁷"). Spec 27 §3.7.1 asks for "two bars a system on narrow screens", but at 768 the tab keeps four bars a system and the same rests overprint the digits. On the phone (two bars a system) "⁷2⁷" are fused, and a "3" stacks on the boxed unsure "3".
- **Evidence:**
  - `focus/practice--loop-active-1180--dark--1180.png` (bars 1–2, 5–6);
  - `focus/practice--layout-tablet--dark--768.png` (bars 2, 3, 5);
  - `focus/practice--layout-phone--dark--375.png` (bars 1–4).
- **Why:** The music is the hero, and phones and tablets on a stand are the main practice devices. Guidelines: layouts work with real content; reading from the stand.
- **Fix:**
  - Use two bars a system below about 900 px of notation width, as the spec says.
  - Raise alphaTab's minimum note spacing, or scale the stretch force with the reading size.
  - Add a story assertion that no digit's box overlaps a rest glyph at 1180 / 768 / 375.

**H3. The touch editor sheet hides the bar being fixed. (high, carried from the audit)**
- **Screen:** Editor sheet (touch).
- **What:** At 375 no notation is visible with the sheet open. At 768 the sheet covers bar 4's digits, which is the spot being fixed.
- **Evidence:** `focus/fix--editor-sheet-phone--dark--375.png`, `focus/fix--editor-sheet-tablet--dark--768.png`. The cause is `[--drawer-height:min(60dvh,34rem)]` above a roughly 190 px stacked transport (`editor-sheet.tsx:49`).
- **Why:** The learner edits a bar they can't see.
- **Fix:**
  - On phones, use a peek height of about 40 % and scroll the notation so the selected bar sits in the space left above.
  - Or show the selected bar as a one-bar strip at the top of the sheet.

### Medium

| # | Screen | What is wrong | Why it matters | Evidence | Fix |
|---|---|---|---|---|---|
| M1 | Phone and tablet practice: Tools sheet, editor sheet | The sheets cover the transport's status row, so the loop line, the pass question and the key / pedal confirmation are hidden while a sheet is open, even though keys and the pedal keep working. The sheet is about 540 px, 66 % of 812, against a 60 % cap. Its bottom sits about 50 px below `--transport-height`. Inferred cause: the drawer's `--bleed:3rem` (`ui/drawer.tsx:120`) paints over the status row. | 2.4.11 (focused or confirming content hidden); spec 27 §3.7.2 (sheet stops above the transport; confirmation at the end of the status row) | `practice-loop--phone-sheet--dark--375.png`, `practice-mix--phone-mini-mixer--dark--375.png`, `fix--editor-sheet-phone--dark--375.png` | Clip the bleed while open, or add the bleed to `bottom`. Add an assertion that the sheet's bottom is at or above the status row's top. |
| M2 | Transport, Loop tab, every `Button` / `TransportButton` | A disabled control gets a solid `--edge` ring with faint text. An "on" control gets a 1.5 px ink ring. An enabled quiet control has no ring. So at the default 100 % the disabled "+" looks more active than the enabled "−". A disabled "8" sits next to the selected "2" like a second selection. When audio isn't ready, the whole transport becomes rings. The direction asked for a dashed edge plus a reason for unavailable controls; neither is shown. | Hierarchy without colour; direction §3 ("dashed edge and says why"); 26 §12.3 | `ui/button.tsx:15`, `ui/transport-button.tsx:18`; `practice--ready--dark--1440.png` (+), `practice--loop-active-1180--dark--1180.png` (8), `practice--not-saved-offline--dark--1440.png` | Draw disabled as a dashed `--edge` ring. Pass `unavailableLabel` everywhere ("Unavailable · fastest speed", "Unavailable · the song is shorter"). |
| M3 | Practice keyboard | Space and Enter are ignored by the mapper whenever a button, tab or switch has focus (`model/keymap.ts:204-209`). After a mouse click on Loop, −, Count-in or a panel tab, Space presses that control again instead of playing. | Media controls are keyboard-operable "where it doesn't conflict with focus"; a hands-busy learner expects Space = play | `features/practice/model/keymap.ts:204` | Return focus to `#main` after pointer activation of transport and panel controls, or keep Space global for buttons that took focus by pointer. |
| M4 | Transport position | At 0:00 the readout says "0.4 / 8". A time before the first downbeat is shown as bar 0 (`transport.tsx:125-126`). Meanwhile the tab washes and underlines bar 1 and prints 9 bars. | The audit's top-10 #7 (bar numbers agree); labels agree | `practice--layout-desktop--dark--1440.png`; `transport.tsx:125,140` | Show the lead-in as "–" or "1.1", and count the total as the printed bars. Cover it with a pickup / lead-in story. |
| M5 | Phone song map | The compact map draws no peaks (`columns = 0`), no section chips (`!compact && sections`) and no loop handles (`if (!loop \|\| compact) return null`). Phones can't loop a section from the map. The `SectionChipsOnAPhone` story renders a non-compact map, so it passes while the real phone screen has no chips. | Guidelines: sections are chips and tapping one loops it; tests must exercise the real path | `ui/waveform-timeline.tsx:209,351,398`; `practice--layout-phone--dark--375.png` | Show chips on compact (one 44 px row, scrolling) and keep peaks. Point the phone story at `compact`. |
| M6 | Song map (desktop) | Loop handles are still `opacity-0` until hover or focus. On touch there is no visible grip. | Audit medium carried over; never drag-only; affordance visible | `ui/waveform-timeline.tsx:390` | Show a 6 px grip at rest at `--edge` contrast. |
| M7 | ⋯ More popover | Choosing "Keyboard shortcuts" or "Search" opens the dialog but leaves the popover open on top of it (`more-panel.tsx:33,55`; no close). On the phone it covers the shortcut list. "Search songs, clips and actions" overflows the 256 px popover. | 2.4.11; layout at 375 | `practice--shortcuts-overlay--dark--375.png`, `practice--more-panel--dark--375.png` | Close the popover (controlled `open`) before opening the dialog or palette. Let rows wrap or shorten the label to "Search". |
| M8 | Display and reading (phone) | The popover runs from the top bar into the transport. Its last visible row, "Page by page", is cut mid-pill over the count-in and BPM, with no scroll cue. "Floor" wraps onto its own line. | Spec 27 §3.7.4 "It fits a 375 px screen"; layout | `practice--display-popover--dark--375.png` (rendered Light) | Use the Tools sheet pattern (a sheet above the transport) on phones, or cap the height above `--transport-height` with a scroll fade. |
| M9 | Notation, all layouts | There are about 75 px (1440) to 80 px (375) of empty paper above system 1. The space is reserved for a loop badge that sits there only when the loop starts in system 1. | Direction §3 "No blank band above the first system"; music share on phones | `practice--layout-phone--dark--375.png`, `practice--ready--dark--1440.png` | Reserve the badge row only when the first system holds a loop edge, or place the badge in the system's own top margin. |
| M10 | Guitar Notes view (neck) | The next shape is drawn with `--conf-medium` and a 4 / 3 dash (`packages/notation/src/fretboard-diagram.tsx:246-249`). That is the same mark as "probably", so with uncertainty off the neck still looks unsure. | Confidence vocabulary must be unambiguous; 26 §5 | `practice--guitar-notes-uncertain--dark--1440.png` | Draw the next shape as a hollow ink ring at lower weight, or `--faint-foreground` solid, never dashed. |
| M11 | Evidence set | Eleven `--dark--` files render Light: `upgrade--prices-failed--1440`, `portal--past-due--1440`, and at 375 `analysis-failed`, `display-popover`, `load-failed`, `loading`, `more-panel`, `pricing--prices-failed`, `sign-in--missing`, `sign-up--default`, `system-banner--update-ready`. Several stories also captured a different state from their name: `guitar-notes` and `chords-view` show Tab; `piano-staff` shows the roll; `glance-phone` shows Tab; `part-question` at 1440 shows no question; `pass-prompt` shows a row of tooltips; `screen-may-lock` shows no banner; `pedal-before-loop` shows no HUD. | Spec 28 §2 (every state in both themes); the QA can't verify these states | listed files | Pin `appearance` in those phone stories. Capture before the `play` step changes the state, or split the stories. |
| M12 | Getting ready (worker offline) | The queued line says the machine is offline, yet What works now promises "In about 2–4 min" and the spinners keep turning. | Offline is a calm queued state, never a time the app can't keep (25; audit) | `practice--worker-offline--dark--1440.png`; `getting-ready.tsx:405-446` | Pass `waiting` into the unlock rows: show "Waiting" with the queued glyph and stop the spinners. |
| M13 | Getting ready (analysis failed) | A damaged or unsupported file leads with Try again, which can't fix it. "This didn't use an analysis" is in the title. | 27 §5.4 (what you can do) | `practice--analysis-failed--dark--1440.png` | For decode and format reasons, lead with "Choose another file" and move the quota line to the description. |
| M14 | Partial: stems unavailable | No action and no time frame; the jargon "This didn't use an analysis" is unchanged. | 27 §5.4 | `practice--stems-unavailable--dark--1440.png` | Offer "Try again" or "Practise with chords" in plain words. |
| M15 | Fix (99+ spots) | The alphaTab credit shows. Digits run into one another. The panel scrolls "Spot n of N" and ‹ › out of view. | Long-content robustness | `fix--many-spots--dark--1440.png` | Hide the credit. Make the spot header sticky. Use the mostly-unsure bar outline (`alphatab-view.tsx:81`). |
| M16 | Settings: Keyboard & pedal | The list leaves out `1 2 4 8`, Shift + 5…0, Shift for 1 %, `?` and ⌘K, which only the practice overlay lists. | Every action has a key, discoverable | `keyboard-settings.tsx:74`; `settings--keyboard--dark--1440.png` | Add a "More keys" group of rows that can't be learned. |
| M17 | Settings: Keyboard & pedal | "Have a pedal? Set it up" is an h2 that can't be pressed, yet the practice HUD's "Set it up" lands on it. | One clear next step | `keyboard-settings.tsx:25` | Make it a statement, or focus the "Pedal left" Learn button on arrival. |
| M18 | Add song: File | Pressing Start too early at 1440 × 900 scrolls the dialog body, and the File / Link / Record tabs slide out of view. | Spatial stability | `add-song--dropzone--dark--1440.png` | Keep the tab list outside the scrolling body. |
| M19 | Library | Each row's explanation line ("may be damaged …") is cut off even at 1440, with 500 px free beside it. | 27 §3.5 (one line that explains it) | `library--populated--dark--1440.png` | Let the status column flex, or let the line wrap. |
| M20 | Home (768) | In the hero's practice still, the loop pill collapses over the count-in and "Loop · bars 5–8" is lost. | First impression; layouts at every width | `home--signed-out--dark--768.png`; `practice-still.tsx:192,201` | Hide the position block below `lg`, or stack the still's transport. |
| M21 | How it works | The step nav that marks the current step is not sticky, so the mark is never visible. | 27 §3.2 | `how-it-works--current-step--dark--1440.png`; `how-it-works.tsx:50-70` | Make the nav sticky under the bar, or drop the live marking. |
| M22 | Practice keys | Click (metronome) has a transport button but no key. Rest, the speed ladder and mix presets have none either. Spec 27 says every practice action has a key. | 27 §3.7.6; guidelines (every action has a key) | `transport.tsx:459-469`; `model/keymap.ts:17-46` | Add keys for Click (for example `T`) and the ladder, print them, and list them in both shortcut lists. |

### Low

1. **Current-bar wash misaligned at 1180.** The wash spans 35–367 px while bar 1 ends at 276 (`practice--loop-active-1180--dark--1180.png`). It is possibly the known render race; check that the wash re-measures after the panel docks.
2. **Vocal phrase strip.** It still carries a second loop toggle and six controls (`practice--vocal-melody--dark--1440.png`). Fold the loop into the transport's.
3. **Custom mix.** No preset row says "Custom mix" when none matches (`practice-mix--six-stems--dark--1440.png`).
4. **Key caps on touch.** Caps show inside the phone sheets and the editor sheet (L, ⇧←, ⇧→, J / K / Y), against "no key caps at this width" (`practice-loop--phone-sheet--dark--375.png`). Add `pointer-coarse:hidden` as the transport does.
5. **Phone sheet space.** The "Close tools" footer takes about 110 px while the scroll area shows one stem row (`practice-mix--phone-mini-mixer--dark--375.png`). The × already closes the sheet.
6. **Loop tab layout.** "×2" wraps alone at 340 px, and the ladder's rungs sit below the fold at 900 (`practice--ladder-climbing--dark--1440.png`).
7. **Saved clips.** The ink-edged "playing" clip is Chorus riff (bars 5–6) while the loop is bars 3–4 (`practice-loop--docked--dark--1440.png`). Verify the fixture.
8. **Tooltips pile up.** Up to nine tooltips open at once along the transport and cover the key row (`practice--pass-prompt--dark--1440.png`). Allow one tooltip at a time.
9. **Legend popover.** It shows the model version "(v0.4.0)" to the learner (`practice--legend-chip--dark--1440.png`).
10. **dB readouts.** They use a hyphen ("-6 dB"); the spec writes "−6 dB" (`practice-mix--six-stems--dark--1440.png`).
11. **Light fixtures.** Light shots show "Dark" chosen in Appearance: Display popover, Settings Display, Account menu.
12. **Drums strip.** It shows chord names, not "Bar 10 · 2 e &" (spec 27 §3.7.5); hits are still small, with 2 bars across 1440 (`practice--drums--dark--1440.png`).
13. **Back as a bare chevron.** Back shows only a chevron below 1024 px, tablets included (`focus-shell.tsx:49`, `max-lg:sr-only`). Keep "Library" or "Exit" visible from 640 px.
14. **Fix header and card disagree.** "bar 4" sits over a "Bar 3 · chord" card, and the editor says "bar 7–8".
15. **Delete note** in the destructive outline is the loudest control in Fix.
16. **Fix empty state.** No heading, and the key row still shows J / K.
17. **Editor note chips.** Duplicated chips with no grouping by bar or beat.
18. **Full editor confirmations.** No HUD confirmation for J / K / pedal / speed presses (`edit-page.tsx:116-141`).
19. **Loading line.** "Loading your song…" is crossed by a skeleton staff line.
20. **Onboarding (phone).** The sticky bar truncates; there are two "Stitch Up" rows; a bass song is offered for guitar.
21. **Library skeleton.** It has no This week block, chips or group heads.
22. **Library empty (phone).** It shows the `A` cap and "Drop a file anywhere".
23. **Palette field.** The square focus outline touches the text.
24. **Delete account (phone).** The destructive button is stacked above Cancel.
25. **Settings tab line (phone).** It cuts "Ke…" with no edge fade.
26. **Read-only Username.** It is styled like an editable field.
27. **Quiet buttons.** Buttons that start a column are indented by their padding: portal, 404, privacy, plan.
28. **Mock portal.** Cancel Plus is the first action.
29. **Banner grids.** Banners and content use different grids: marketing, bare and practice (`system-banner--offline--dark--1440.png`, `practice--not-saved-offline--dark--1440.png`).
30. **Home hero.** Empty paper above and below the tab, and the "Space" cap overlaps Play's edge.
31. **Unsupported page.** The API names are still in the body text.
32. **Pricing compare table.** It wraps cells at 375.
33. **About disclosure.** The label doesn't change when it opens.
34. **Account menu.** It has no username line.
35. **Settings sections.** Six sections against spec 27's four, and Usage now appears in three places. Reconcile the spec or fold the sections.
36. **Light faint text.** In Light, `--faint-foreground` is 5.3:1 on the page and 4.7:1 on hover (`contrast.test.ts:98-99`): AA, but under the 7:1 floor. It is used for meta lines, the "/ 8" total and the transport detail.

**Counts:** 0 critical, 3 high, 22 medium, 36 low.

## 3. The five practice questions, rebuilt screen

1. **Is the music the hero? Mostly yes on desktop, partly on narrow screens.**
   - **1440 × 900:** the notation runs from y 125 to the key row at 780, about 73 % of the screen. One panel, closed by default. One filled control (Play). Chords sit over the tab (`practice--layout-desktop--dark--1440.png`).
   - **Phone:** the tab is the default view with two bars a system, about 59 % of the height. About 80 px of that is an empty band (M9).
   - **The weak point is legibility, not share:** at 1180 with the panel, at 768 and at 375, rests overprint digits (H2). The tablet keeps four bars a system.
2. **Fewest steps to practise.**
   - **Audio:** 1 action (Space or Play; `#main` is focused on load).
   - **A 4-bar loop at 70 % with count-in, playing:** count-in is on by default.
     - Keyboard: 3 keys (`4`, Shift+7, Space). The audit counted about 10.
     - Mouse: 5 actions (bar, bar, readout, 70 % preset, Play; the preset doesn't close the panel, so one more if the outside press only dismisses it).
     - Phone: 5–6 taps (bar, bar, readout, 70 %, dismiss, Play). The phone map can't loop a section (M5).
   - **The first slowed loop for a new visitor:** 2 actions with the defaults (onboarding).
3. **One key or one pedal press away?** Mostly. Every transport action, loop length, speed preset, the panel, the view, the marks, the Fix queue and accept have a key (`model/keymap.ts`).
   - **Pedal:** "left again, right go" follows the moment: playing, pass question, Fix (`input-mapper.ts:38-46`). The transport shows the meanings from 1536 px. The keys keep working in the non-modal sheets.
   - **No key:** Click, rest, the ladder and mix presets (M22).
   - **Space** loses to a focused button after a mouse click (M3).
   - **Confirmations** are hidden behind the phone sheets (M1).
4. **Hierarchy without colour: yes, with one inversion of meaning.**
   - **What works:** "on" and "current" are an ink edge or ink line everywhere, ≥ 7:1 against every surface (token test). Unsure is a dashed box, a "?" and an ink digit. Probably is dotted. Sounding is inverted. Piano hands carry L / R. Stems carry names. The progress series differ by dash and marker shape.
   - **The exception:** disabled controls get a solid ring and so read as "on" (M2), and the neck reuses the "probably" dash (M10).
5. **Hit targets and contrast.**
   - **Targets:** Play 64; every transport control 48 (asserted in `DockTargets`); loop lengths, M / S and the panel tabs 48; section chips 24 on fine pointers and 44 on coarse.
   - **Contrast** (`contrast.test.ts`):
     - ink on page: 16.8 / 17.8;
     - `--edge`: 3.9 / 3.8;
     - staff on paper: 3.9 / 3.8 (3.2 / 3.4 on the current-bar wash);
     - `--unsure`: 7.7 / 5.9;
     - faint text: 6.7 / 5.3, which is AA but under the 7:1 floor in both themes.
   - **Focus rings** are 2 px ink (seen as double rings in several shots).
   - **Open gaps:** loop handles are invisible at rest (M6); the "?" is 12 px.

## 4. Capabilities check

| Capability | Reachable? | Where |
|---|---|---|
| Import: upload | Yes | Add song dialog (sheet on phones). From the rail's Add song (`A`), ⌘K, a file dropped anywhere, the empty state, and the phone bottom bar. |
| Import: record | Yes | Add song → Record (`R` starts and stops). The recording and review states were checked in code only. |
| Import: URL | Yes | Add song → Link, with Paste and an inline error. The `/import` redirect was not verified. |
| Analysis progress | Yes | Desktop: the top-bar status, the stage list and What works now. Phone: stages in the Tab view, plus a compact status and the part question in the glance. Worker-offline wording is wrong (M12). |
| Library | Yes | Rail Library or wordmark; phone bottom bar; Recent in the rail. |
| Loops | Yes | Tap two bars, `1 2 4 8`, `L`, the Loop tab steppers and lengths, ⇧← / ⇧→. Section chips on desktop only (M5). Map handles are hidden at rest (M6). |
| Speed | Partly | − / + (`,` / `.`), `S` typed field, Shift+5…0, presets, ladder in the Loop tab. **50–100 % only** (H1). |
| Count-in | Yes | Transport `I` on every layout, and the Loop tab (Off / 1 bar / 2 bars). |
| Stem mixer | Yes | Tools → Mix (`X`) docked, drawer or sheet; `M` mutes your part. Volume is in the transport (desktop and tablet) and in Mix (phone). The phone mini-mixer was not captured. |
| Notation and tab | Yes | View switch (`V`): Tab / Notes / Chords for guitar and bass; Chart / Notes / Staff plus Hands for piano; Grid / Staff / Chords for drums; Melody / Chords for vocals. The Chords view, piano Staff and the phone glance were not captured (M11). |
| Confidence | Yes | Legend chip with the count and the switch; `U`; Display → Show uncertainty; Fix tab (`J` / `K` / `E` / `Y`); full editor from ⋯ or Fix (desktop, signed in). |
| Progress | Yes | Tools → Progress on every layout. It was unreachable on phone and tablet before. |
| Pedal and keyboard | Yes | Pedal: PageUp / PageDown out of the box; learn per action in Settings → Keyboard & pedal (also from the account menu, ⋯, and the HUD's "Set it up"). Shortcuts overlay: `?` on desktop, ⋯ on every layout. |
| Settings | Yes | Rail, account menu and phone bottom bar. Six sections: Account, Usage, Plan, Display & practice, Keyboard & pedal, About. Display and reading is also in practice (`Aa`). |
| Usage and plan | Yes | Rail Usage popover; phone top-bar gauge; Settings → Usage / Plan; See Plus → upgrade sheet → mock checkout / portal. |
| Auth | Yes | Marketing bar Sign in (phone Menu); Create an account on sign-in; sign out in the account menu and Settings → Account. |

Two things could not be found on the phone:
- a way to loop a section from the map;
- the worker state outside the library's queued line.

Nothing else is missing.

## 5. Both themes

Parity is good: one role set, with ink selection that holds in both. No screen is clearly broken in one theme. The weaker theme by screen:
- **Practice notation, Light.**
  - The current-bar wash is nearly invisible. It relies on the 2 px underline, which is allowed but quieter than Dark.
  - Faint text is 5.3:1 in Light against 6.7:1 in Dark (the transport detail, "/ 8").
- **Dialog scrims, Dark.** The scrim barely dims the rail, so Add song and Delete feel less separated than in Light.
- **Phone evidence, Dark is missing.** No Dark phone shot exists for:
  - loading, load-failed and analysis-failed;
  - the Display popover and ⋯;
  - pricing prices-failed;
  - sign-in missing and sign-up;
  - update-ready.

  Those files are Light renders (M11), so Dark parity on those phone states is unverified.

## 6. What I could not judge

- **Real devices.** Safari and iOS behaviour, real touch, the iOS 16 px zoom (verified in code only), sheet swipe physics, and Samsung Internet.
- **Distance.** Music-stand legibility at 0.5–1.5 m (the G5 test). H2 suggests the tablet at the stand is the risk.
- **Motion and timing.** The playhead, count-in animation, reduced motion, spinner delays, and HUD timing (≤ 100 ms). No count-in or HUD shot exists.
- **Audio.** Pitch-preserved slow-down quality, the count-in tempo at the seam, and solo / mute audibility.
- **Focus in use.** Focus order and focus return beyond the story assertions. Focus rings appear only incidentally in shots.
- **Accessibility settings.** 200 % zoom, forced colours, and screen-reader runs.
- **States with no correct shot.** These were judged from code where possible:
  - glance view; piano Staff; Chords view; the phone mini-mixer;
  - desktop part question; chords-only banner; screen-lock banner;
  - toasts; iOS install hint;
  - recording and review; cap reached; duplicate;
  - narrow full editor.
- **Section chips.** No practice story with sections was captured, so the chip row was not seen in place.
