# s47 guidelines brief

This brief gathers the rules that bear on Splitune's monochrome redesign (black and white, pills and hairlines, Figtree at 400/500, Dark and Light themes). It draws on the local research report and its four note files, specs 24–28 (26 and 27 re-read at HEAD bd2c77e), Vercel's Web Interface Guidelines and Geist, Linear's 2024 and 2026 redesign posts, Radix Colors, IBM Carbon, Uber Base Web, the six WCAG 2.2 Understanding documents, and Soundslice's and Moises's public help pages. Most sources agree on four things: hierarchy comes from tonal steps, size and weight rather than hue; selected states use inversion or a shape cue; hairlines are decorative unless they are a control's only boundary, in which case they need 3:1; and motion is short and follows the content. Three things need fixing or a decision:
- **Weights.** Specs 26 and 27 still use weights 600, 650 and 700 (wordmark, `text-2xs`, the song-card title, the reading tokens, the "?" glyph), which goes beyond 400/500.
- **Selected states that fail 1.4.11.** In both themes, the selected segmented-control capsule and the current-page nav pill sit at about 1.1–1.3:1 against what is next to them.
- **Colour.** Spec 26 keeps semantic colour (status, the "unsure" blue, stems, hands). That is compatible with "no accent colour" but not with "no colour".

All contrast figures below are WCAG 2.x ratios that I computed from the spec's hex values unless a source is named.

## Sources

### Local research: `reports/Best UI UX websites to study.md` and `research_notes/Best UI UX websites to study/` (4 files)
Path: `/Users/hnt/Projects/personal/Splitune/reports/…`, `/Users/hnt/Projects/personal/Splitune/research_notes/Best UI UX websites to study/{monochrome_minimal,product_apps,award_winners,galleries_libraries}.md`
1. Monochrome systems give each step of a neutral ramp a role and use at most one accent. In 2025–26 that accent is disappearing: Linear removed coloured team icons, and Uber made black its primary colour (report §Monochrome).
2. Selected pills should use **inversion**: a solid black-on-white or white-on-black pill plus `aria-pressed`/`aria-selected`. The luminance difference is far above 3:1 (report).
3. A hairline that is a component's **only** edge (outlined pill, input) must reach 3:1 under 1.4.11. Linear-style 5–10% alpha lines are acceptable only for decorative separators (report; monochrome_minimal Q3).
4. Confidence is shown by form, not colour: dashed vs solid hairline, outline vs filled pill, or a label (report).
5. 2.4.13 Focus Appearance is **AAA**, not AA. Some vendor tables list it wrongly (monochrome_minimal Q3).
6. Smashing (Apr 2025): avoid pure black (for example #121212); light text halates for readers with astigmatism; interactive elements should be over 4.5:1; offer a toggle, respect `prefers-color-scheme` and persist the choice (monochrome_minimal Q4, cited only through the note).
7. Flipping a grey ramp for dark mode keeps contrast but breaks hierarchy (engineered.at, through the note).
8. Are.na's Areal typeface has a dark-mode axis because light text on dark looks heavier. Figtree has no grade axis, so check 400 on dark for halation (monochrome_minimal Q4).
9. The blog's 100/65/40% white text tiers recompute to 21 / 8.6 / 3.7:1, so the 40% tier fails body text (report; I confirmed: #A6A6A6 = 8.63, #666 = 3.66).
10. daisyUI's monochrome guidance: every hover, focus, selected, disabled, loading, empty, error and success state must read without hue; hierarchy comes from size and weight, never coloured text (monochrome_minimal Q2).
11. For player and library UX, the Webby Best UX winners (Spotify Web Player 2024, Dropbox Brand 2025, Pentagram Archive 2026) are better study targets than the Awwwards Site of the Year winners, which are WebGL showpieces (award_winners).
12. Raycast's Action Bar and Superhuman's ⌘K teach shortcuts by showing each one next to its action. Superhuman's target is that everything happens in ≤100 ms (product_apps).
13. Gaps the notes admit: no primary sources for how ChatGPT, Claude, Apple or Mercury build their monochrome interfaces, and no authoritative essay on pill-and-hairline styling.

### Spec 26, Design system (`docs/specs/26-design-system.md`, HEAD bd2c77e)
1. No accent colour. The ink (white on Dark, `#0d0d0d` on Light) is the primary action and "now". Colour is used only for status, the six stems and the two piano hands (TL;DR, §4.5).
2. Grounds: Dark page `#000`, card `#121212`, popover `#1a1a1a`, muted `#1f1f1f`, accent well `#2a2a2a`. Light page and cards `#fff`, muted `#f5f5f5`, accent well `#ececec`. In Light, cards are told apart by a 1 px hairline; in Dark, elevation is lightness (§4.1).
3. Lines: `--border` `#262626`/`#e5e5e5` is decorative with no minimum. `--border-strong` `#3d3d3d`/`#ccc` is the ring of outline and quiet buttons, chips, badges and kbd. `--input` `#707070`/`#878787` is a control's identifying boundary and must be ≥ 3:1 (measured 3.8 / 3.6 on cards) (§4.1, §9).
4. Contrast floors: 7:1 for body text on the page and ink on notation, 4.5:1 for text, 3:1 for graphics and boundaries. `contrast.test.ts` checks them in six contexts (dark, light, stage × normal, more) to ±0.1 (§4.6).
5. A state is never shown by hue or lightness alone. It has a shape cue (fill, 2 px line, wash plus hairline, knob position, check) and, where it is a fill or line, a ≥ 3:1 change from rest (§4.5, §12.3).
6. One filled ink pill per view (page, dialog, sheet or inspector tab), plus Play (§1.2, §4.5).
7. Type: Figtree 400 for text and 500 for anything that leads, but 600 for the wordmark, `text-2xs` and "a few numbers", and 600–700 in the reading tokens. Never 700 in chrome. Scale (px): 11/14, 12/16, 13/18, 14/20, 15/22 body, 17/28 lead, 17/24, 22/28, 32/38, 44/48, 48/52, 56/60, display clamp 40–64. Tracking 0 down to −0.03em. Nothing below 11 px. Sentence case, no uppercase eyebrows. Tabular figures for every number that changes (§6.1–6.2).
8. Shape: every control is `rounded-full` (pill or circle). Fields and cards 12 px, media 8 px, menus 14 px, popovers 16 px, dialogs 22 px, phone sheets 24 px (§9).
9. Targets: main practice controls 64, Stand view 88, secondary practice 48, everything else 44. 24 only for the song-map section chips on fine pointers. The target is the element's own border box (§8).
10. Focus: a 2 px solid ink `outline` with 2 px offset (3 px under increased contrast); fields use −1 px offset. `outline:none` without a replacement is lint-enforced (§9).
11. Motion: 100 / 200 / 300 / 400 ms, `--ease-standard` cubic-bezier(0.2,0,0,1), press scale 0.97. UI transitions stay within 150–250 ms. The playhead runs on the audio clock with `transform`. Reduced motion: durations 0, page turns, a stepped playhead. No flashing more than 3 times a second (§10).
12. Disabled: `--muted` fill, faint text, `--input` ring (≥ 3:1), "Unavailable" in the accessible name, never an opacity fade (§12.1, §12.3).
13. Confidence: Probably = 1.5 px dashed `--faint-foreground`; Unsure = dashed `--unsure` blue plus a superscript "?" (10 px, **700**); Edited = 2 px underline; Sounding = an ink box (§5).
14. Feedback: skeletons for known layouts; a spinner after 300 ms; an ETA as a padded range that never sits at 99 %; optimistic edits with an Undo toast; AlertDialog only for deleting a song or the account (§13).
15. Changes at HEAD: the progress chart's best series uses round markers and the cold series square markers ("so never colour alone"); StemRow's readout says "solo"/"muted"; StemToggle paints at 44 in a 48 box on phones (§12.2).

### Spec 27, Screens, flows and content (`docs/specs/27-screens-flows-and-content.md`, HEAD bd2c77e)
1. App bar: 64 px, no rule under it. Library and Settings are ghost pills; **the current page is shown by a `--muted` fill** plus `aria-current`. Add song is a quiet pill so each page keeps its own primary (§1).
2. Auth and system pages: one centred column (≤ 400 px for auth, ≤ 480 px for bare pages), no card. Banners are one quiet line with a hairline below, no tinted bar (§3.4, §3.11).
3. Settings: a heading over rows divided by hairlines, no card per setting. Each field saves on its own ("Saving…" / "Saved" / "Couldn't save. Try again.") (§3.9).
4. Song card title is set at **16/650**, and the practice top-bar title also at 16/650. Both break the 400/500 rule (§3.5, §3.7.1).
5. Practice regions: top bar 60, song map (chips 22–24 + map 40 + ruler 14), Now column 264, inspector 380, dock 96 with 64 px controls (§3.7.1).
6. Loops: tap two bars, a section chip or "Loop this bar"; From/To steppers; sixteenth-note nudges; a speed ladder (default step up after 3 clean passes); rest and count-in between repeats (§3.7.4).
7. Progressive states: Practice opens at once; each finished stage unlocks something and is never faked; arrivals never re-lay out the notation under the playhead (§3.7.3).
8. States catalogue: empty, loading, partial, error and offline for every screen. Library loading is a skeleton Continue card plus 6 skeleton cards; "Loading your song…" appears after 1 s (§4).
9. Voice: sentence case; buttons are verbs naming the outcome; numerals with a non-breaking space before units ("70 %"); uncertainty as a frequency ("about 1 in 3"); no exclamation marks except success the user caused; no emoji (§5.3).
10. At HEAD: This week is hidden when no day was practised ("never a row of empty dots"); a changed mix puts a dot on the Mix tab, announced as "Mix changed" (§3.5, §3.7.4).

### Spec 28, UI quality (`docs/specs/28-ui-quality-and-design-review.md`)
1. Storybook stories for every state, under toolbars for Appearance (Dark / Light / Stage / Side by side) × Contrast × Density × Distance × Reduced motion × Pointer. axe runs with `test:'error'` and the WCAG 2.2 tags, in Chromium and WebKit (§2).
2. Token-membership E2E: every computed colour must be a resolved token. Lint fails on raw colour, radius, font-size or shadow values (§3).
3. A focus-not-obscured probe uses `elementFromPoint` at several points with the dock, sheets and drawers open (§3).
4. Target probe: 64 / 88 / 48 / 44 / 24, as in spec 26 §8 (§3).
5. Performance: p75 practice-action latency ≤ 100 ms; no LoAF from playhead or roll code; no `backdrop-filter` or animated shadow over the notation or waveform (§3.1).
6. Design QA: one primary per view; 200 % text and 320 px reflow; a forced-colours spot check; a CVD simulator in both themes (§5).
7. Rubric item "Typography": "few sizes, clear weights, mono numbers that never jump; nothing below 11 px" (§7).
8. G5 music-stand test decides between Dark and Light by misreadings and eye strain at 0.5 / 0.75 / 1.5 m (§6).

### Spec 24, Browsers (`docs/specs/24-browser-compatibility.md`)
1. Feature-detect, never UA-sniff (except the in-app-browser banner).
2. Floor: Chrome/Edge 111, Safari/iOS 16.4, Firefox 128, Samsung Internet 23. The binding constraint is Safari 16.4 (WASM SIMD).
3. The CSS floor follows Tailwind v4: cascade layers, `@property`, `color-mix()`. Spec 26 adds: no `light-dark()`, relative colour syntax, `@scope` or native nesting, checked by `css-floor.mjs`.
4. Tier 1 is the last two majors of Chrome, Edge, Firefox, Safari macOS/iOS, Chrome Android and Samsung Internet. Playwright's WebKit is not Safari: sign-off needs real Safari.
5. WebKit on macOS moves focus between fields only by default, so keyboard tests press Option-Tab.

### Spec 25, Personal mode (context only)
1. Mock billing never renders card fields. Pricing shows "Demo mode — no real charges."
2. The Mac worker can be offline. The UI must show "Processing machine offline…" as a calm queued state, never a stalled bar.
3. No paid design tooling: the source of truth is code plus Storybook, with no Figma.

### Vercel Web Interface Guidelines (https://vercel.com/design/guidelines)
1. Every flow is keyboard-operable and follows WAI-ARIA patterns. Use `:focus-visible`; sticky headers, footers and overlays never cover the focused element.
2. Hit target ≥ 24 px; expand it when the visual is smaller; 44 px on mobile. The visual target should match the hit target.
3. Mobile `<input>` font ≥ 16 px (prevents iOS auto-zoom). Never disable zoom or block paste.
4. Loading: keep the label and add an indicator. Show spinners and skeletons after a **150–300 ms delay**, with a **300–500 ms minimum visible time**.
5. Keep state in the URL (filters, tabs, pagination, expanded panels). Use optimistic updates with rollback or Undo.
6. Animation: honour `prefers-reduced-motion`; animate only `transform`/`opacity`; never `transition: all`; animations must be interruptible; anything moving for more than 5 s needs pause, stop or hide.
7. Skeletons mirror the final content. Design empty, sparse, dense and error states. Every screen offers a next step.
8. Use `tabular-nums` for numbers people compare. Status is never colour alone. Use `…`, curly quotes, and `&nbsp;` in "10 MB" and "⌘ K".
9. Forms: keep submit enabled until the request starts; errors sit beside their fields and focus moves to the first error; checkbox, radio and label share one hit target; placeholders end with `…`.
10. Design: shadows use ≥ 2 layers; child radius ≤ parent radius, with concentric curves; hover, active and focus have **more contrast than rest**; set `color-scheme: dark` and `theme-color` to the page background; the guidelines prefer APCA to WCAG 2.
11. Mutations (POST/PATCH/DELETE) complete in < 500 ms. Virtualise large lists.
12. Copywriting is marked as Vercel brand preference: Title Case for headings and buttons, numerals, specific labels ("Save API Key", not "Continue").

### Vercel Geist (https://vercel.com/geist/{introduction,colors,typography,grid,materials,button})
1. Grey steps: 100/200/300 are default, hover and active backgrounds; 400/500/600 are default, hover and active borders; 700/800 are high-contrast backgrounds and their hover; 900 is secondary text and icons; 1000 is primary text and icons.
2. Use solid grey by default. Use grey-alpha only where the background should show through (shadows, overlays). Draw each border once and keep dividers inside it, so alpha borders never overlap. Material shadows stay translucent.
3. Background 1 is the default surface; Background 2 is used sparingly for subtle differentiation. On Background 1, Color 1 is hover and Color 2 is active. Badges use Color 2 or 3.
4. Type is split by role: Heading 72→14, Label 20→12 (single line), Copy 24→13 (multi-line), Button 16/14/12. Emphasis comes from a Strong or Subtle variant via nested `<strong>`, not from colour. Label 14 and Copy 14 are the most-used styles; Label 13 uses tabular figures. **The page publishes no sizes, line heights or weights**, so the numbers are class names only.
5. Materials: base and small have 6 px radius, medium and large 12 px, menu and modal 12 px, fullscreen 16 px. Tooltips are the only floating element with a stem.
6. Grid guides are decorative (`aria-hidden`), but "custom borders should meet the 3:1 minimum" and guide contrast should be checked in both themes. Don't nest grids more than one level.
7. Button: use `loading` rather than a custom spinner, so the button stays focusable and announces busy. Disable only when the action is impossible right now, with a tooltip saying why. Icon-only buttons need an `aria-label` naming the action and its target. Never add `aria-label` over visible text.

### Linear, "How we redesigned the Linear UI (part II)", 28 Mar 2024 (https://linear.app/now/how-we-redesigned-the-linear-ui)
1. Themes moved from HSL to **LCH** (perceptually uniform). Each theme is defined by **3 inputs (base, accent, contrast) instead of 98 variables**.
2. Light, dark and custom themes share one generator, which derives surfaces per elevation (background, panel, dialog, modal).
3. Blue "chrome" was limited for a "more neutral and timeless" look.
4. Text and neutral icons are darker in Light and lighter in Dark for content contrast.
5. A contrast input allows very high-contrast themes; contrast settings of 30 and 100 were tested.
6. Early explorations used only black and white opacities for elevation and hierarchy.
7. Inter Display for headings, Inter for body. Labels, icons and buttons were re-aligned to reduce noise and raise density.
8. Shipped behind a feature flag with a dev-toolbar toggle, in five milestones, in about 6 weeks.

### Linear, "A calmer interface for a product in motion", 12 Mar 2026 (https://linear.app/now/behind-the-latest-design-refresh)
1. "Don't compete for attention you haven't earned": task elements stay prominent; navigation recedes.
2. "Structure should be felt not seen": fewer separators, with rounded ends and softened contrast.
3. The sidebar is "a few notches dimmer" so content dominates.
4. Fewer and smaller icons; coloured team-icon backgrounds removed.
5. Greys moved from cool blue to a less saturated **warmer grey**; "too warm" looks muddy.
6. Compact rounded tabs that don't span full width, with smaller text and icon-only tabs.
7. Header actions (share, copy link, open PR) moved to predictable positions.
8. No numeric contrast values are published. Tokens are tuned with a hue/chroma/lightness picker and synced to Figma as JSON.

### Radix Colors (https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale, …/composing-a-palette)
1. Steps 1–2: app and subtle backgrounds.
2. Step 3: component at rest (or hover, if the component is transparent at rest). Step 4: hover. Step 5: pressed or **selected**.
3. Step 6: subtle borders on non-interactive elements (cards, headers, separators). Step 7: interactive component borders. Step 8: stronger interactive borders and **focus rings**.
4. Steps 9–10: solid fill and its hover.
5. Steps 11 and 12: low- and high-contrast text, guaranteed **APCA Lc 60 / Lc 90** on step 2 of the same scale. No WCAG ratios are given.
6. `gray` is the pure neutral and pairs with anything; tinted greys (mauve, slate, sage, olive, sand) suit a matching accent. Saturated greys clash in dark mode. Use grey text for apps. Scales are not meant to be customised.

### IBM Carbon (https://carbondesignsystem.com/elements/themes/overview/, …/elements/color/tokens/)
1. Four themes: White, Gray 10, Gray 90, Gray 100. They share role tokens, which is a precedent for one role set across two lights and two darks.
2. Role tokens: `$text-primary` is Gray 100 on White and Gray 10 on Gray 100; `$text-secondary` is Gray 70 / Gray 30; `$border-strong` is Gray 50 / Gray 60; `$field-01` is Gray 10 / Gray 90.
3. White-theme values: background `#fff`; layer-01 `#f4f4f4`; layer-hover `#e8e8e8`; layer-selected `#e0e0e0`; border-subtle `#c6c6c6`; border-strong `#8d8d8d`; text-secondary `#525252`; helper `#6f6f6f`; placeholder Gray 100 at 40 %; disabled Gray 100 at 25 %; skeleton background `#e8e8e8` with element `#c6c6c6`; overlay black at 60 %.
4. Layering: layer-01 sits on the background, layer-02 on layer-01, and so on. Fields follow the layer they sit on; each layer has hover, active and selected tokens.
5. **Not monochrome:** `interactive`, `focus` and `border-interactive` are Blue 60 `#0f62fe`.

### Uber Base Web (source: github.com/uber/baseweb `src/themes/*`; the official docs could not be fetched)
1. Foundation: `primaryA` = black, `primaryB` = white, `primary` `#000000`. The neutral ramp is `#F6F6F6 #EEEEEE #E2E2E2 #CBCBCB #AFAFAF #6B6B6B #545454 #333333`. The accent is blue600 and is used only for accent and info roles.
2. Selection = full ink: `borderSelected` = primaryA (black in Light, white in Dark). `backgroundInversePrimary` = black.
3. Content tiers: primary (black), secondary gray800, tertiary gray700. Disabled content gray400.
4. Borders are 1 px alpha black at 4 / 8 / 12 / 16 / 20 / 24 % (decorative). `borderOpaque` = gray50 (about 1.07:1 on white, decorative only).
5. Type pairs at each size: 400 for paragraphs (12/20, 14/20, 16/24, 18/28) and **500 for labels with a tighter line height** (12/16, 14/16, 16/20, 18/24). Headings use **700** (20/28, 24/32, 28/36…).
6. Radii 2 / 4 / 8 / 12 / 16. Buttons and inputs 8 px, cards 0 px.
7. Timings run 100 / 150 / 200 / 250 / 300 / 400 / 500 ms and up. Decelerate (0.22,1,0.36,1) for entering, accelerate (0.64,0,0.78,0) for exiting, linear for opacity and colour. Overlay is black at 50 %.
8. The report's claim that black has been primary since v9 "for accessibility" comes from a secondary source (Motiff); the theme code confirms black is primary.

### WCAG 2.2 Understanding documents (source: github.com/w3c/wcag `understanding/*.html`, because w3.org returned 403)
- **1.4.1 Use of Color (A):** Colour must not be the only visual means. A lightness difference of **≥ 3:1** counts as an additional visual distinction, and **inverting foreground and background passes** (given enough contrast). Any meaning that needs a particular hue to be identified (for example green = valid, red = invalid) needs another cue whatever the contrast. Colour-only visited links are not the author's responsibility.
- **1.4.3 Contrast (Minimum) (AA):** 4.5:1 for text; 3:1 for large text, which is 18 pt (≈ 24 px) or 14 pt bold (≈ 18.5 px). Thresholds are **not rounded** (4.499 fails). The rule covers placeholder text and text shown on hover or focus. Thin or unusual fonts can render fainter than their CSS colour because of anti-aliasing, so exceed the minimum. Logos are exempt; brand guidelines are not. Text characters used as symbols (×, >) fall under 1.4.11.
- **1.4.11 Non-text Contrast (AA):** 3:1 against adjacent colours for any visual information needed to identify a control and its **state** (selected, focused, checked), and for graphical objects needed for understanding. 2.999 fails. **A boundary is not required** if the control has visible text or an icon, or if context identifies it (a toolbar). If the boundary is the only cue, it must reach 3:1. A state change between two states that are not side by side need not be 3:1, and hover effects are supplementary. The check in a checkbox and a slider thumb must contrast with what is next to them. A focus indicator must contrast with whatever it sits against. Disabled (inactive) components are exempt. Thin lines can render fainter than specified.
- **2.4.7 Focus Visible (AA):** a visible focus indicator in at least one mode of operation, never time-limited. The indicator is also subject to 1.4.11. 2.4.13 (AAA) sets size and shape guidance.
- **2.4.11 Focus Not Obscured (Minimum) (AA):** the focused **component** must not be **entirely** hidden by author content such as sticky headers or footers, non-modal dialogs or cookie banners; scroll padding is the named fix. Semi-transparent or blurred overlays may pass this criterion and still fail 1.4.11. Correctly built modals always pass. Persistent user-opened panels must reflow, displace, trap focus, or be dismissible with a key. Full visibility is 2.4.12 (AAA).
- **2.5.8 Target Size (Minimum) (AA):** **24 × 24 CSS px**, or an undersized target whose 24 px circle, centred on its bounding box, intersects no other target or circle. Exceptions: an equivalent control elsewhere, inline text, user-agent controls, essential layouts. Zoom does not help meet it. 2.5.5 (AAA) is 44 × 44.

### Soundslice help (https://www.soundslice.com/help/en/player/…)
1. Looping: on desktop, click and drag on the notation. The selection **snaps to notes, rests and barlines**, and notation outside the loop fades. Drag either edge to adjust; click elsewhere to clear. On mobile, a Loop button loops the current bar.
2. The loop menu appears near the bottom of the music and hides during playback: Focus, Save as clip, Play with count-in, Play loop only once. Audio-only loops are sample-accurate.
3. Speed: 25–200 % for recordings, set with −/+ in **10 % steps**; tap the number to type an exact value (78 %); pitch is preserved; synthetic playback shows BPM.
4. Speed training: initial, final and step speed plus repeats per speed (example 50→100 %, +10 %, ×4 = 24 passes) and an optional count-in before each loop. An arrow on the speed control shows it is active; decreasing speed is not supported.
5. Keys: Space play/pause; Enter or Home go to the start; `<`/`>` slower/faster; ←/→ previous/next note (or ±5 s while playing); Ctrl+←/→ previous/next barline; PageUp/PageDown move a page; Ctrl+/− zoom.
6. Playhead scrolling: keep the playhead at the top (Scroll default), in the middle, only scroll when necessary (Horizontal default), at the left, or off.
7. Playhead style: line (default), small rectangle, wide rectangle, or hidden. Colour themes are Orange (default), Subtle, Blue and Yellow, applied to the playhead, the current notes and the current-bar background. Each highlight can be turned off.
8. Stems: one volume slider per stem, all at 100 % by default. Clicking a name solos it, and the others are **de-emphasised**. There is no separate mute button. Metronome: every beat or downbeats only, with its own volume. Count-in: 1, 2 or 3 bars, at the start only or before each loop.

### Moises (moises.ai feature pages, App Store listing; the help centre returned 403)
1. Sections are detected automatically and named A/B/C by default, renamed from a list (Intro, Verse, Chorus). **Tapping a section loops it**; on mobile several sections can be looped, on web one at a time (help article snippet via search).
2. Speed changer: −/+ buttons and Reset. The free plan is limited to ±10 BPM (one page) or a 20 % change (help snippet); the sources disagree.
3. Smart Metronome: a generated click that follows the beat, with 0.5× / 1× / 2× subdivisions. Count-in up to 16 clicks (paid) or 4 (free).
4. Chords are synced to bars and beats at three levels (Easy, Medium, Advanced), with fingering diagrams, and transpose with the pitch changer.
5. Stem volume defaults to 75 % (search summary of the App Store listing, unverified). No public documentation of the mixer layout, mute/solo or how selection is drawn was found.

## Merged checklist

### Hierarchy without colour
- [ ] Each view has exactly one filled ink pill (plus Play). Every other action is secondary, quiet, ghost or link. [26 §1.2, 28 §5; Uber Base]
- [ ] Navigation and chrome recede (muted text, no fills at rest) so the music or the task leads. [Linear 2026; 26 §1.2]
- [ ] Hierarchy comes from size, weight (400 vs 500), position and spacing. No text is coloured for emphasis. [Geist type; daisyUI via notes; 26 §6.2]
- [ ] Surfaces nest at most three levels (page → card → well). In Light, cards are separated by a hairline, not a fill. [26 §4.5; Carbon layering]
- [ ] Every surface, text and line token has chroma 0. Colour appears only for status, stems, hands and Home art, each with a second cue. [26 §4.1, §4.5]

### Type scale with two weights
- [ ] Chrome uses only weights 400 and 500. No 600, 650 or 700 outside the notation reading tokens (see Conflicts). [brief; 26 §6.1]
- [ ] Each size has a text role (400, looser line height) and a label role (500, tighter line height), as in Base's paired fonts. [Uber Base; Geist Label vs Copy]
- [ ] No text below 11 px. Body is 15/22; long-form is 17/28. [26 §6.2, V10]
- [ ] Every number that changes uses `tabular-nums` and never changes width. [26 §6.2; Vercel]
- [ ] Sentence case; no uppercase or letter-spaced eyebrows. [26 §6.2; 27 §5.3]
- [ ] Figtree 400 at ≤ 13 px on `#000` is checked for halation at G5. If it fails, move the text to `--card` or to 500. [Smashing via notes; Areal; 1.4.3 thin-font note]
- [ ] Mobile inputs are ≥ 16 px. [Vercel] The app body is 15 px, so fields need 16 px on coarse pointers.

### Spacing and density
- [ ] Everything sits on the 4 px grid; gutters are 16 / 24 / 32. [26 §7]
- [ ] Browse density uses 44 px targets; practice density uses 64 / 48. Density is switched by `data-density`, not by per-component props. [26 §7–8]
- [ ] Prefer lists with hairline rows to card grids; settings are rows, not cards. [26 §7; 27 §3.9]
- [ ] Layouts work with short, average and very long content (80-character titles, F♯m7♭5, 99+ unsure spots). [Vercel; 28 §5]
- [ ] Nested radii are concentric (child ≤ parent). [Vercel]

### Borders and hairlines
- [ ] Decorative dividers (`--border`, 1.26:1 Light, 1.39:1 Dark) are used only where text or position already identifies the region. [1.4.11; Linear 2026; Base]
- [ ] Any hairline that is a control's only boundary (input, stepper, checkbox, switch track, slider track, upcoming beat) is `--input`, ≥ 3:1, not rounded. [1.4.11; 26 V2]
- [ ] `--border-strong` (1.6:1 Light, 1.9:1 Dark) rings only controls that also carry a visible label or icon. Never use it as the sole cue for a control or state. [1.4.11; computed]
- [ ] Each border is drawn once; adjacent alpha borders never overlap; dividers sit inside the container's border. [Geist]
- [ ] Fewer separators: whitespace before rules. [Linear 2026; 26 §7]
- [ ] Shadows (floating layers only) have ≥ 2 layers, are black-only and translucent. A shadow is never a boundary under increased contrast or forced colours. [Vercel; Geist; 26 §9]

### Pills and selection states
- [ ] A selected chip or toggle is an **inverted** (filled ink) pill, ≥ 14:1, plus `aria-pressed`/`aria-selected`. [report; 1.4.1 inversion clause; 26 §12.1]
- [ ] Every selected or current state has a non-colour cue reaching ≥ 3:1 against what is next to it: fill, 2 px ink line, ink-edged wash (`--primary-line` ≥ 3:1), check, or knob position. [1.4.11; 26 §4.5]
- [ ] **Fix:** the segmented capsule (`--capsule` on `--muted` = 1.09:1 Light, 1.15:1 Dark; text 2.3–2.5:1 change) needs an ink edge, an inversion or an underline. [1.4.11; computed]
- [ ] **Fix:** the current nav pill (`--muted` fill, 1.09:1 Light, 1.27:1 Dark) needs a ≥ 3:1 cue, such as an ink underline or `--foreground` text plus a fill change. [1.4.11; computed]
- [ ] Hover steps one grey up (Radix 3→4, Geist Color 1→2). Hover is supplementary and must not reduce any other indicator's contrast. [Radix; Geist; 1.4.11]
- [ ] Hover, active and focus are more contrasted than rest. [Vercel]
- [ ] Disabled uses a muted fill, a ≥ 3:1 `--input` ring and "Unavailable" in the name, never opacity. A tooltip or a line says why. [26 §12.3; Geist Button]
- [ ] Every control is `rounded-full`; icon buttons are circles; nothing but a pill is rounder than 24 px. [26 §9]

### Focus and keyboard
- [ ] Focus is a 2 px solid ink outline at 2 px offset (3 px under more contrast), ≥ 3:1 against every ground it can sit on. [26 §9; 2.4.7; 1.4.11]
- [ ] `:focus-visible` only; `outline:none` always has a replacement (lint). [Vercel; 28 §3]
- [ ] Sticky bars set `scroll-padding`; the dock, sheets, drawers, toasts and the pass prompt never fully hide the focused component (probe). [2.4.11; Vercel; 28 §3]
- [ ] Modals trap focus and return it on close. Persistent panels reflow or are dismissible with Esc. [2.4.11; Vercel]
- [ ] Every action has a key. Shortcuts are shown beside actions (tooltips, menus, ⌘K). Single-key shortcuts can be switched off. [Raycast and Superhuman via notes; 27; 2.1.4]
- [ ] Navigation uses real `<a>` links; state lives in the URL. [Vercel; 27 §1]

### Motion
- [ ] Interface transitions are 100–250 ms; dialogs and sheets 300 ms. Only `transform`/`opacity` animate; never `transition: all`. [26 §10; Vercel]
- [ ] Entering eases decelerate; exiting eases accelerate. Animations are interruptible. [Base; Vercel]
- [ ] Spinner or skeleton appears after 150–300 ms and stays at least 300–500 ms once shown. [Vercel; 26 §12.1 (300 ms)]
- [ ] Under reduced motion: durations 0, page turns, a stepped playhead, a static beat readout. The playhead never stops. [26 §10]
- [ ] Nothing flashes more than 3 times a second; the beat pulse changes only a 14–26 px dot. [26 §10; 2.3.1]
- [ ] Every key, tap or pedal shows feedback within 100 ms. [26 §10; Superhuman]

### Dark/light parity
- [ ] One semantic role set; Dark and Light differ only in values. Components never use `dark:` variants for colour. [26 §2; Carbon; Linear 2024]
- [ ] The Light ramp is not a mirror of the Dark one: each theme is tuned for hierarchy and checked in `contrast.test.ts`. [engineered.at via notes; 26 §4.6]
- [ ] Every story renders in both themes and both contrast levels. Visual baselines exist for Dark and Light. [28 §2, §4]
- [ ] `color-scheme` and `theme-color` follow the theme. The choice is persisted per device and resolved before first paint. [Vercel; 26 §2]
- [ ] Text and icons are darker in Light and lighter in Dark than a straight mapping would give (content contrast). [Linear 2024]

### Contrast numbers (1.4.1, 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.5.8)
- [ ] 1.4.3: text ≥ 4.5:1, large text (≥ 24 px, or ≥ 18.5 px bold, which with Figtree 400/500 means ≥ 24 px) ≥ 3:1. The project floor is 7:1 for body text and notation ink. Placeholders and hover/focus text count. No rounding.
- [ ] 1.4.11: control boundaries that are the only cue, state indicators and needed graphics are ≥ 3:1 against adjacent colours. 2.999 fails.
- [ ] 1.4.1: no information by hue alone. A ≥ 3:1 lightness difference or inversion counts; status, unsure, stems and hands also carry an icon, glyph, dash or label.
- [ ] 2.4.7 and 1.4.11: the focus indicator is visible and ≥ 3:1. 2.4.13 (AAA) is a stretch goal only.
- [ ] 2.4.11: the focused component is never entirely hidden.
- [ ] 2.5.8: ≥ 24 × 24 or spacing. The project floor is 44 (browse) and 64/48 (practice); 24 is used only for the song-map chips.
- [ ] APCA (Radix Lc 60/90, Vercel's preference) is at most an extra check, never a replacement for the ratios.

### Forms
- [ ] Fields are 44 px (52 on auth), with a 1 px `--input` border that turns to ink on hover and focus and a focus outline at −1 px offset. [26 §12.1; 27 §3.4]
- [ ] Every control has a `<label>` that focuses it on click. Checkbox and radio share one hit target with their label. [Vercel]
- [ ] Errors sit inline under the field with an icon and `aria-describedby`; focus moves to the first error on submit; validation runs on blur or submit. [Vercel; 26 §13]
- [ ] Submit is not pre-disabled. It disables only while the request runs, keeps its label and shows a spinner. [Vercel; Geist Button]
- [ ] Never block paste; set `autocomplete`, `type` and `inputmode`; spellcheck is off for usernames. [Vercel]
- [ ] Settings save per field with a "Saving…" / "Saved" / error line. [27 §3.9]

### Loading and empty states
- [ ] Use skeletons for known layouts (matching the final layout, no shift). Use button spinners for short actions. Use determinate progress plus named stages and a padded ETA range for long jobs. [26 §13; Vercel]
- [ ] Empty states have no box: an icon, an h2, one sentence and the primary action. Never a row of empty progress dots. [26 §12.2; 27 §3.5 (HEAD)]
- [ ] Every screen has empty, loading, partial, error and offline states, storied in both themes. [27 §4; 28 §5]
- [ ] Errors follow "what happened, what it means, what you can do". No raw codes. [27 §5.4]
- [ ] A worker-offline state is a calm queued line, not a stalled bar. [25; 27]

### Media and player UI
- [ ] Loops can be made by tapping two bars, a section chip or "Loop this bar" (≤ 2 actions). Edges snap to bars, with sixteenth-note nudges and steppers. Never drag-only. [27 §3.7.4; Soundslice snapping; 2.5.7]
- [ ] Loop context (pass count, rest, count-in) stays visible; notation outside the loop may be de-emphasised by a wash, never by colour alone. [Soundslice; 26 §4.7]
- [ ] Speed uses −/+ (5 %, Shift 1 %), presets, and a readout that opens a typed or stepper value. Pitch is preserved. % comes first, then BPM. [27; Soundslice (10 %, typed value); Moises]
- [ ] Speed ladder/training: start, goal, step and passes per step, plus an optional count-in before each pass. Its active state is visible on the speed control. [Soundslice speed training; 27 §3.7.4]
- [ ] Count-in: 1–2 bars, at the start or before each repeat, taking the upcoming tempo. [Soundslice; 27]
- [ ] Mixer: one row per stem with a name, solo/mute as filled vs outlined, and "solo"/"muted" in the readout and accessible name. Soloing de-emphasises the others by more than hue. [26 §12.2 (HEAD); Soundslice]
- [ ] The playhead is a 2 px ink line, a block or a bar highlight (user choice). The current bar is an opaque wash beneath content. Follow modes are Page / Scroll / Off; pausing stops scrolling. [26 §4.7; Soundslice playhead options; 2.2.2]
- [ ] Sections are labelled chips; tapping one loops it; unnamed sections are "Part A/B/C". [27; Moises]
- [ ] Media controls are keyboard-operable; Space plays and pauses where it doesn't conflict with focus. [Vercel; Soundslice; Moises]

## Conflicts

1. **Weights 600/650/700 vs Figtree 400/500.** Spec 26 §6.1–6.2 (wordmark 600, `text-2xs` 600, "a few numbers" 600, reading tokens 600–700, the "?" glyph 700) and spec 27 (song-card and top-bar titles 16/650) against the brief's two weights. Uber Base uses 700 headings and Geist adds a "Strong" variant.
   - **Winner:** 400/500 for all chrome and browse text. Reset the song title to `text-lg` 500 and `text-2xs` to 500 (or raise it to 12 px), and set the wordmark to 500 or treat it as a logotype.
   - **Exception:** keep the notation reading tokens (tab digits, chord names, readouts) and the "?" glyph as a documented exception scoped to `font-reading*`. Reason: their 16′ / 0.4° distance floors and 1.4.3's thin-font note make weight a legibility requirement there, and G5 can test 500.
2. **"No accent colour" vs semantic colour.** Spec 26 keeps red, green, the "unsure" blue, stems and hands, and the brief says monochrome. Carbon and Base keep a blue interactive accent.
   - **Winner:** spec 26. No accent hue for interaction or focus (reject Carbon's and Base's blue), but meaning colours stay, each paired with a non-colour cue (1.4.1 allows colour that is complemented).
3. **Soft hairlines vs 3:1 borders.** Linear's softened dividers, Base's `borderOpaque` (about 1.07:1) and spec 26's decorative `--border` stand against Geist Grid ("custom borders should meet 3:1").
   - **Winner:** WCAG 1.4.11. Decorative or text-identified edges need no minimum; only-boundary edges and state indicators need 3:1. Geist's blanket 3:1 is stricter than needed and would make the pill-and-hairline look heavy.
4. **Selection treatment.** Inversion (report, Base `borderSelected` = ink), Radix's step-5 grey fill, spec 26's mix of capsule, wash, underline and `--muted` nav fill.
   - **Winner:** inversion or an ink edge/line. Grey-fill-only selection (Radix step 5, the spec's capsule and nav pill at 1.09–1.27:1) fails 1.4.11 for a state indicator. Keep wash plus ink line where a full fill would compete with Play.
5. **Pure black ground.** Smashing (avoid `#000`, halation) against spec 26 (`#000` page, the owner's s46 decision).
   - **Winner:** spec 26 for now, pending G5. Reading-heavy text sits on `#121212` cards, and Figtree 400 at small sizes on `#000` is a G5 measure.
6. **APCA vs WCAG 2 ratios.** Vercel prefers APCA and Radix guarantees APCA Lc; spec 26 and `contrast.test.ts` use WCAG 2.
   - **Winner:** WCAG 2 ratios, because conformance is WCAG 2.2 AA. APCA is optional advice.
7. **Case of copy.** Vercel and Geist use Title Case for buttons and headings; spec 27 uses sentence case. **Winner:** spec 27. Vercel marks its rule as brand preference.
8. **Target sizes.** Vercel (24, 44 on mobile) and WCAG 2.5.8 (24) against spec 26 (44 / 48 / 64 / 88). **Winner:** spec 26, which is stricter and suits hands-busy practice.
9. **Disabled contrast.** WCAG exempts inactive controls; spec 26 requires a ≥ 3:1 ring plus "Unavailable". **Winner:** spec 26, which is stricter. Add Geist's "say why" tooltip or line.
10. **Duration range.** Spec 26 says interface transitions stay within 150–250 ms (300 ms only for full sheets and dialogs), yet defines `--duration-fast` at 100 ms and `--duration-slower` at 400 ms for the route cross-fade and capsule slide. Base offers 100–1000 ms.
    - **Winner:** spec 26's tokens. The §10 prose should change to "100–250 ms, 300 ms dialogs and sheets, 400 ms only for layout morphs, and 0 under reduced motion".
11. **Loading delay.** Spec 26 shows the spinner after 300 ms; Vercel says 150–300 ms delay plus a 300–500 ms minimum visible time. **Winner:** keep 300 ms and add Vercel's minimum visible time to stop flicker.
12. **Speed step.** Soundslice uses 10 % with 25–200 %; spec 27 uses 5 % (Shift 1 %) with 25–110 %; Moises limits free users by BPM. **Winner:** spec 27, because finer steps suit a speed ladder.

## Not fetched
- **w3.org WCAG 2.2 Understanding pages** (1.4.1, 1.4.3, 1.4.11; the others were not tried there): HTTP 403. All six documents were read instead from the W3C's own source in github.com/w3c/wcag `understanding/20|21|22/*.html` (main branch). That text may differ slightly from the published version.
- **Uber Design "design platform" page** (us and bd locales): HTTP 404. **base.uber.com**: SSO-gated or empty. **baseweb.design theming guide**: rendered empty. Base facts come from the MIT-licensed baseweb GitHub source. The "black primary since v9 for accessibility" rationale is secondary (Motiff, via the local notes), unverified.
- **Geist typography values:** the page and its `.md` version publish no sizes, line heights or weights, only class names. Geist component pages other than Button (toggle, switch, input, tabs) were not fetched.
- **Carbon Gray 100 token values** were not in the fetched page text (only White). Carbon's focus and layering token pages for dark themes were not fetched.
- **Radix gray hex values and alpha scales** were not fetched (role pages only).
- **Linear 2026 changelog page** was not fetched separately; the blog post was.
- **Moises help centre** (help.moises.ai): HTTP 403. Facts come from moises.ai feature pages, the newsroom post, the App Store listing and search snippets. The "75 % default stem volume" and "20 % free speed limit" figures are search summaries, unverified. No public description of the Moises mixer, mute/solo or how selection is drawn was found.
- **Soundslice** volume-control, navigating-playback and focus-mode pages were not fetched.
- **Smashing "Inclusive Dark Mode", engineered.at, Blake Crosley, daisyUI and Are.na** were not re-fetched. They are cited only through the local research notes.
