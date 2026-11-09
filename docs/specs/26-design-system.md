---
title: Design system and visual language
workstream: engineering
last_researched: 2026-11-08
confidence: medium
---

# Design system and visual language

The visual direction for Splitune, **"Night Rehearsal"**, and the system that implements it: theme model, tokens, colour, confidence encoding, typography and reading sizes, layout, targets, shape, motion, icons and the component inventory. Screens, flows and copy are in `27-screens-flows-and-content.md`; the quality workflow (Storybook, token tests, mockup fidelity, design QA) is in `28-ui-quality-and-design-review.md`. Practice behaviour is in `12-practice-screen-and-notation.md`.

This doc was rewritten in place for the redesign (step s31a, 2026-11-08). It replaces the "Music Stand" system (paper score, indigo accent, Inter); that version is in git (`git show 8d6a3f6:docs/specs/26-design-system.md`) and `docs/specs/assets/design/reference.html` shows it. Neither is a source any more.

**Sources and precedence.** `redesign/` holds the research (`redesign/report.md`), the 25 mockups (`redesign/mockups/*.dc.html`) and `redesign/mockups/splitune.css`, the visual source of truth for the mockups. This doc carries their values into binding tokens. Where a mockup value breaks a WCAG minimum or a token test, this doc gives the corrected value and says so; those corrections are listed in the **deviation register** (§4.9), and design QA (`28` §5) measures against the mockup *or* the register value. Once step s32 lands, `packages/ui-tokens` is the binding implementation of these tables.

> **Personal mode (`25-personal-mode.md`):** no paid design tooling. The design source of truth is code (`packages/ui-tokens` plus Storybook) and the mockups in `redesign/mockups`, not a Figma file. Fonts and icons are open-licence and self-hosted.

## TL;DR
- **Direction: "Night Rehearsal"** (Direction A, owner's choice 2026-11-08). Warm graphite surfaces, notation in light ink on the dark page, and **one amber accent** reserved for *now*: the playhead, the sounding note, the loop, the single primary action per view and the on/progress states of controls (the full list is §4.5). Stems are colour-coded but always labelled. Chosen over "Annotated Score" (paper) and "Pedalboard" (hardware panel) (§1).
- **Two themes from one set of semantic roles:** *Night Rehearsal* (default) and *Daylight* (light). The appearance ids stay `system | light | dark | stage` because a contract enum uses them: `dark` = Night Rehearsal, `light` = Daylight, `system` = follow the device, `stage` = Night Rehearsal with at least the music-stand reading sizes (§2). Increased contrast is a second axis in both themes.
- **Tokens in three tiers** (OKLCH primitives → semantic roles keeping the shadcn names plus Splitune roles → a few component tokens), static CSS in `packages/ui-tokens`, mapped to Tailwind v4 with `@theme inline` (§3). Every text and graphic pair is contrast-tested in every theme × contrast context (§4.6); stems pass a colour-vision-deficiency separation test (§4.4).
- **Confidence is never shown by colour alone:** *Probably* = dashed outline; *Unsure* = dashed outline + "?" + the unsure blue; uncertainty is put in words as a frequency ("about 1 in 3"). *Edited by you* = underline; *Sounding now* = amber fill (§5).
- **Type:** Instrument Sans for words, JetBrains Mono for numbers and tab digits (tabular figures), Bravura for standard notation, Atkinson Hyperlegible Next as the opt-in reading font. Inter 4 is the fallback if the s32 legibility check fails (§6.1). Reading sizes come from distance presets, Desk / Music stand / Floor, and never drop below today's sizes, the 18 px tab-digit floor, 16′ digit height or 0.4° chord capitals (§6.3).
- **Targets (CSS px, the control's own box):** the **main practice controls** (Play/Pause, restart / back a bar, next bar, speed −/+, loop, count-in, Felt clean / Not yet) are **64** in every layout, phones and Fix mode included; secondary practice controls 48; everything else 44; Stand view's pedal buttons 88. Nothing is below the 24 px AA floor, and only the desktop song-map section chips use it (§8).
- **Owner decisions (G1, 2026-11-08):** the owner pre-approved every gate in chat. The specific calls taken under that pre-approval are **D2** three theme cards, with `stage` a valid stored id but not a card; **D3** the speed ladder steps up after **3** clean passes by default (a setting); **D4** Stand view is the default practice layout on tablets; **D5** the brighter lines and borders and the re-tuned stem palette (§4.9 V1, V2, V6). The rest of the deviation register (§4.9) is accepted under the blanket pre-approval and listed for the owner to revisit; it is not individually approved.
- **Motion follows only the music:** 100 / 200 / 300 ms, playhead on its own layer driven by the audio clock, page turns and stepped playhead under reduced motion, no flashing over 3 a second (§10).

## 1. Design direction
### 1.1 Candidates considered
Three directions were mocked on the same screens (`redesign/mockups/Dir-A.dc.html`, `Dir-B.dc.html`, `Dir-C.dc.html`; every mockup has a *Look* switch that renders it in each direction). Evidence and argument: `redesign/report.md`, "Night Rehearsal wins on identity".

| | A "Night Rehearsal" | B "Annotated Score" | C "Pedalboard" |
|---|---|---|---|
| Surface | Warm dark graphite; light ink notation on the dark page | Warm paper, black ink | Light hardware panel, big modules |
| Accent | One amber "signal" for now, playhead, loop, primary action | Red pencil | Orange |
| Type | Instrument Sans + JetBrains Mono | Serif display | Space Grotesk |
| For | All seven Okabe-Ito hues reach 3:1 on the dark page; one accent avoids a "wall of orange"; dark mode is a top request among tab users; a clean break from Music Stand | Reads best in daylight; close to how learners read sheet music | Glanceable from a distance; suits pedals |
| Against | Light-on-dark notation is "less traditional"; daylight glare on tablets; can look like any DAW | Four of seven Okabe-Ito hues fail 3:1 on paper; close to Music Stand; red reads as error | Tiring over long sessions; low density on desktop |
| Role | **Brand default**, Daylight one tap away | Comparison variant in the music-stand test | Ideas borrowed for Stand view |

**Decision: A.** Because Daylight is generated from the same roles, the default theme is reversible: the owner's music-stand reading test (gate G5 in `docs/steps/00-shared-context.md` ("Redesign steps"); procedure in `28` §6) decides the *default for Practice and Stand view*, not the identity. Both themes are built and tested regardless.

### 1.2 Principles (use them to settle design arguments)
1. **The music is the brightest thing on screen.** Chrome is quiet graphite; ink is reserved for notation, chords and numbers; colour is spent on meaning.
2. **Amber means "now".** It marks the playhead, the sounding note, the current beat, the loop and the one primary action of a view. Never decoration, never headings, never a second primary.
3. **Readable from the stand.** Size for the reading distance (§6.3). If it can't be read at 0.75 m, it doesn't belong in practice.
4. **Honest, not authoritative.** Machine output looks like a draft where it is unsure, says how unsure in plain numbers, and is one tap from being fixed.
5. **Hands are busy.** Big targets at a consistent edge, every action on a key or pedal, visible confirmation within 100 ms.
6. **Calm coach.** Competence evidence (the clean tempo, the first clean pass next session); no streaks, no guilt, no confetti.

### 1.3 Character
| Element | Expression |
|---|---|
| Surfaces | Warm graphite (hue 60, chroma ≤ 0.010) in four steps; Daylight a warm off-white (hue 85) in the same four steps |
| Accent | Amber `oklch(0.80 0.150 72)` (`#f8ac3d`) with graphite text on it, in both themes |
| Lines | Hairlines over shadows; shadows only for floating layers (sheets, dialogs, toasts) |
| Shape | 10 px base radius; 16 px cards; 22 px sheets and dialogs; full rounding for Play, chips, toggles and badges |
| Type | Instrument Sans for words, JetBrains Mono for every number that changes |
| Imagery | No stock photos or people; the product, the waveform and the notation are the imagery |
| Brand | Lowercase wordmark "splitune" with an amber disc mark crossed by a graphite wave (§11) |

## 2. Appearance (theme) model
| Stored id | Name in the UI | Colours | Reading sizes | Notes |
|---|---|---|---|---|
| `dark` | **Night Rehearsal** | Night roles (§4) | The chosen distance preset | **Default** for every new device (was `system`) |
| `light` | **Daylight** | Daylight roles | The chosen distance preset | Same semantic roles, light ground |
| `system` | **Follow my device** | Night if `prefers-color-scheme: dark`, else Daylight | The chosen distance preset | |
| `stage` | — (a valid id, not a card) | Night roles | The chosen preset, never smaller than **Music stand**, then × 1.25 (`--read-scale`, as before the redesign) | Kept because the contract enum `DisplaySettings.appearance` uses it; see below |

- **Choices shown (owner decision D2, G1).** Settings → Display & practice, the practice Display popover, the account menu and ⌘K offer exactly three choices: Night Rehearsal (`dark`), Daylight (`light`), Follow my device (`system`) (`redesign/mockups/Settings-Display.dc.html`). `stage` stays a valid stored and contract value but has no card. A device that has `stage` stored keeps its effect (Night colours, sizes no smaller than Music stand, × 1.25); its controls show Night Rehearsal and the resolved distance, and the next change to either control stores `dark` (plus the distance shown). The evening "Practising in the dark? Try Stage." hint is retired: Night is already the default.
- **No score surface.** The notation sits on the page in both themes (`--paper` = `--background`). The Music Stand "Score: Paper / Match appearance" setting and the `data-score` attribute are retired; the analytics field `DisplaySettings.score_surface` (contract, unchanged) always reports `match`.
- **Increased contrast** (`data-contrast="more"`, or `prefers-contrast: more` with no stored choice; Settings "Increase contrast: Follow system / On / Off"): muted and faint text, borders, field boundaries and staff lines move one step further from the ground (values in §4.1 and §4.7), translucent fills behind text become opaque, the focus outline is 3 px, and the amber glow is dropped.
- **Forced colours** (Windows High Contrast): semantic tokens yield to system colours; focus uses `outline` (box-shadow is dropped); confidence marks keep their dashes and "?"; canvas layers (waveform, rolls, grids) read `CanvasText`, `Canvas` and `Highlight` through `forced-color-adjust: none` only where they draw their own accessible colours.
- **Implementation.** `<html data-appearance="dark|light|stage" data-contrast="normal|more" class="dark?">`. `.dark` is set for `dark` and `stage` so shadcn's `dark:` variants keep working; token selection uses `data-appearance`. Night is the `:root` default, so without JavaScript (and before the head script runs) the page is Night Rehearsal. The inline head script resolves the stored choice and `matchMedia` before first paint, writes both attributes and `color-scheme` (`dark` or `light`), and resolves `stage` by raising `data-distance` to `stand` when the chosen or automatic distance is `desk`. The choice is per device: `apps/web/app/lib/display-store.ts` persists it (Zustand + `localStorage`) and `apps/web/app/ui/display.ts` (`DEFAULT_DISPLAY`, `applyDisplay`, inlined into the head script) applies it. s33 changes `DEFAULT_DISPLAY.appearance` from `system` to `dark` and adds the `stage` distance floor to `applyDisplay`; s36 builds the three cards and the `stage` → `dark` rewrite (the s35 Display popover uses the same rule).
- **Subtree theming.** Every theme block also applies to any element carrying `data-appearance`, so a subtree can show the other theme: the theme preview cards in Settings, the Foundations story, Storybook's side-by-side mode, and (if the G5 music-stand test decides it) a Practice-only default. Components therefore never use shadcn's `dark:` variants for colour (an ancestor's `.dark` would leak into a Daylight subtree); colour comes from tokens only. Previews never paint raw colours (the mockup's preview swatches use literal OKLCH; the app renders a miniature inside `data-appearance="dark"` or `"light"`).
- **Floor-safe CSS:** `oklch()` and `color-mix()` only. No `light-dark()`, relative colour syntax (`oklch(from …)`), `@scope` or native CSS nesting in shipped CSS: `apps/web/scripts/css-floor.mjs` (run on the build output) fails on them (Safari 16.4 floor, `24-browser-compatibility.md`).
- No ambient-light switching (`AmbientLightSensor` is not Baseline).

## 3. Token architecture
```
packages/ui-tokens/
  src/primitives.css     # OKLCH steps: graphite and daylight neutrals, amber, unsure, ok, bad, stems (never used by components)
  src/themes.css         # semantic roles per [data-appearance] × [data-contrast], Night as the :root default
  src/theme.tailwind.css # @theme (static scales) + @theme inline (semantic → Tailwind names)
  src/fonts.css          # @font-face for the self-hosted families (files in apps/web/public/fonts)
  src/index.ts           # typed token names, STEMS, CONFIDENCE, CONTRAST_PAIRS, readToken()/readColor(), BACKGROUND_HEX
  src/*.test.ts          # contrast, gamut, CVD separation and naming tests (28 §3)
```
- **Tier 1, primitives.** Static OKLCH literals, rounded to three decimals for L and C and whole degrees for H. They may be produced by a small generator from four parameters (graphite hue/chroma, amber, contrast, warmth), but the checked-in literals are what ships and what tests read; no runtime colour maths. Primitives are not exposed to Tailwind (`--color-*: initial` clears the palette), so components can't write `bg-graphite-3`.
- **Gamut rule.** Every primitive is inside sRGB at the tests' tolerance (`colorjs.io` `inGamut('srgb')`, default epsilon). Saturated values are clamped *in the source* by lowering chroma at the same L and H; two mockup values needed it: Daylight amber ink `oklch(0.50 0.120 58)` → `oklch(0.50 0.119 58)`, and Daylight guitar `oklch(0.55 0.100 180)` (since retuned, §4.4). The amber fill `oklch(0.80 0.150 72)` is in gamut as written.
- **Tier 2, semantic roles.** shadcn's names stay (`--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--chart-1…5`, `--sidebar-*`, each `-foreground` where it applies), so restyled components keep their class names and props. Splitune roles: `--faint-foreground`, `--border-strong`, `--primary-ink`, `--primary-soft`, `--primary-line`, `--signal`, `--unsure`, `--unsure-surface`, `--success`, `--success-surface`, `--destructive-surface`, `--destructive-foreground`, `--warning`, `--warning-surface`, `--info`, `--info-surface`, `--edited`, `--surface-raised`, `--surface-sunken`, `--paper`, `--ink`, `--conf-medium`, `--conf-medium-edge`, `--conf-low`, `--stem-{guitar,bass,drums,vocals,keys,other,mix}`, `--elevation-1…3`, `--glow`. **Naming trap:** shadcn's `--accent` is the hover/selected *well* (graphite step 3), not the amber; amber is `--primary` and its family.
- **Tier 3, component tokens** (only where a component needs one; §4.7): loop, playhead, current bar, staff, waveform, beat pulse, piano keys, instrument marks on notation, HUD, scrim.
- **Static scales** in `@theme`: spacing (`--spacing: 0.25rem`), radius (§9), font families, type steps (§6.2), reading sizes (§6.3), durations and easings (§10), target sizes (§8), z-index layers, content widths (§7).
- **Mockup names → roles.** `splitune.css` uses short names; the app never does. Mapping: `--bg` → `--background` = `--paper` = `--surface-sunken`; `--s1` → `--card` = `--popover` = `--surface-raised` = `--sidebar`; `--s2` → `--muted` = `--secondary`; `--s3` → `--accent`; `--line` → `--border-strong` (and, at corrected values, `--input` and `--staff`); `--line-soft` → `--border`; `--tx` → `--foreground` = `--ink`; `--tx2` → `--muted-foreground`; `--tx3` → `--faint-foreground`; `--acc` → `--primary` (fills) and `--signal` (marks); `--acc-ink` → `--primary-ink`; `--on-acc` → `--primary-foreground`; `--acc-soft` → `--primary-soft`; `--acc-line` → `--primary-line`; `--unsure`, `--unsure-soft` → `--unsure`, `--unsure-surface`; `--ok`, `--ok-soft` → `--success`, `--success-surface`; `--bad`, `--bad-soft` → `--destructive`, `--destructive-surface`; `--st-gtr|bass|drm|voc|keys|oth` → `--stem-guitar|bass|drums|vocals|keys|other`; `--paper` → `--paper`; `--glow`, `--shadow` → `--glow`, `--elevation-2`/`-3`; `--r1…r4` → radius scale (§9); `--f-ui`, `--f-display`, `--f-mono` → `--font-sans`, `--font-display`, `--font-mono`.
- **JS consumers** (waveform canvas, rolls, drum grid, alphaTab `display.resources`, meters) call `readToken()` / `readColor()` and re-read on appearance or contrast change; they never hard-code colours.
- **Rule:** no raw colour literals (`#…`, `rgb(`, `oklch(` …), Tailwind palette classes, one-off durations or easings outside `packages/ui-tokens`, enforced by `scripts/check-ui-tokens.mjs` in `pnpm lint`. Step s45 deletes the Music Stand roles and primitives; until then they may exist but no component may read them.

## 4. Colour
Values are OKLCH as written in `primitives.css` (hex in parentheses for reference). *N* = Night Rehearsal (also `stage`), *D* = Daylight; "more" = increased contrast.

### 4.1 Neutrals and surfaces
| Role | N | D | N more | D more | Use |
|---|---|---|---|---|---|
| `--background` (= `--paper`, `--surface-sunken`) | `oklch(0.165 0.008 60)` (`#110e0b`) | `oklch(0.972 0.007 85)` (`#f8f5f1`) | same | same | The page, the notation's ground, wells inside cards (fields, steppers) |
| `--card` (= `--popover`, `--surface-raised`, `--sidebar`) | `oklch(0.205 0.008 60)` | `oklch(0.993 0.003 85)` | same | same | Cards, panels (inspector, Now column ground), transport dock, sheets, dialogs |
| `--muted` (= `--secondary`) | `oklch(0.245 0.009 60)` | `oklch(0.950 0.008 85)` | same | same | Default button fill, row hover, section chips, emphasised cards |
| `--accent` (hover/selected well) | `oklch(0.295 0.010 60)` | `oklch(0.915 0.010 85)` | same | same | Button hover, the pressed segment, badges, toasts, the HUD |
| `--foreground` (= `--ink`, every `*-foreground` on a neutral) | `oklch(0.955 0.008 80)` (`#f3f0ea`) | `oklch(0.21 0.012 60)` (`#1d1713`) | same | same | Text, notation, chord names, the song-map now-line |
| `--muted-foreground` | `oklch(0.81 0.010 75)` | `oklch(0.40 0.012 60)` | `oklch(0.87 0.010 75)` | `oklch(0.33 0.012 60)` | Secondary text, unselected tabs and segments, icon buttons at rest |
| `--faint-foreground` | `oklch(0.69 0.010 70)` | `oklch(0.49 0.012 60)` | `oklch(0.78 0.010 70)` | `oklch(0.42 0.012 60)` | Meta lines, eyebrows, units, bar numbers, played tab digits, "Probably" outlines |
| `--border` (hairline dividers) | `oklch(0.27 0.009 60)` | `oklch(0.90 0.010 80)` | `oklch(0.36 0.009 60)` | `oklch(0.80 0.010 80)` | Card and panel edges, `hr`/`vr`, region dividers (no contrast minimum: decorative) |
| `--border-strong` | `oklch(0.345 0.010 60)` | `oklch(0.84 0.012 80)` | `oklch(0.45 0.010 60)` | `oklch(0.72 0.012 80)` | Outlines of controls identified by their text (buttons, chips, kbd), ruler ticks, drop-zone dashes |
| `--input` (identifying boundary, ≥ 3:1) | `oklch(0.530 0.010 60)` | `oklch(0.625 0.012 80)` | `oklch(0.62 0.010 60)` | `oklch(0.52 0.012 80)` | Text fields, steppers, checkboxes, slider tracks, the upcoming-beat outline |

Elevation in Night is lightness (background → card → muted → accent rise ≈ 0.04 L each); floating layers add `--elevation-2`/`-3` (§9).

### 4.2 Amber (accent) and interaction
| Role | N | D | Use | Paired with |
|---|---|---|---|---|
| `--primary` | `oklch(0.80 0.150 72)` (`#f8ac3d`) | same | Fills: the primary button, Play, the sounding tab digit, a switch that is on, M/S that are on, the done rungs of the speed ladder | `--primary-foreground` text and icons |
| `--primary-foreground` | `oklch(0.19 0.020 60)` | same | Text and icons on amber (graphite, never white: white on amber is 1.9:1) | |
| `--primary-ink` | `oklch(0.83 0.140 76)` | `oklch(0.50 0.119 58)` (clamped) | Amber *text and icons* on neutral or soft surfaces: chip/badge on-state text, the count-in number, the step numbers on Home | |
| `--primary-soft` | `oklch(0.80 0.150 72 / 0.14)` | `oklch(0.80 0.150 72 / 0.20)` | Washes: chip and segment on-state, current-bar wash, song-map loop band, the "Soon" badge | `--primary-ink` or `--foreground` text |
| `--primary-line` | `oklch(0.80 0.150 72 / 0.50)` | `oklch(0.610 0.140 62)` (opaque; mockup 60 % alpha) | Hairline around an amber wash (chip on, active loop pill, selected radio card) | |
| `--signal` | `oklch(0.80 0.150 72)` | `oklch(0.610 0.140 62)` | Amber as a **mark** that must reach 3:1: playhead, loop edges and bracket, selected-tab underline, current beat dot, chord-shape dots, progress and slider fills, the edge of an on-switch track and of a done ladder rung | |
| `--ring` | = `--signal` | `oklch(0.50 0.119 58)` (= `--primary-ink`) | Focus outline | |

- **Why Daylight differs.** The amber fill is 1.8:1 on the Daylight page, so it can't carry meaning as a line or a dot there (WCAG 1.4.11). Daylight keeps the amber *fill* (with graphite text, 9.7:1) and draws amber *marks* in `--signal` (3.6:1) and focus in `--ring` (5.8:1). Night uses the one amber for all three.
- **Glow.** `--glow`: N `0 0 0 1px var(--primary-line), 0 0 24px oklch(0.80 0.150 72 / 0.30)`; D `0 0 0 1px var(--primary-line), 0 0 18px oklch(0.80 0.150 72 / 0.35)`. Only on the sounding digit, the playhead and the current beat. Dropped under increased contrast and forced colours.

### 4.3 Status
| Role | N | D | Surface (N / D) | Always paired with |
|---|---|---|---|---|
| `--success` (= `--edited`) | `oklch(0.79 0.130 155)` | `oklch(0.50 0.120 155)` | `--success-surface` `oklch(0.298 0.025 145)` / `oklch(0.933 0.017 157)` | Check icon + text ("Ready", "Done"); the edited mark's underline |
| `--destructive` | `oklch(0.72 0.160 28)` | `oklch(0.52 0.170 28)` | `--destructive-surface` `oklch(0.285 0.034 32)` / `oklch(0.943 0.016 30)` | Verb label ("Delete song"), alert icon |
| `--destructive-foreground` | `oklch(0.19 0.020 60)` | `oklch(0.99 0 0)` | — | Text on a solid destructive fill (the confirm button in a delete dialog) |
| `--unsure` | `oklch(0.78 0.105 255)` | `oklch(0.50 0.140 260)` | `--unsure-surface` `oklch(0.280 0.016 259)` / `oklch(0.926 0.006 256)` | Dashed outline + "?" (§5); never alone |
| `--warning` (= `--muted-foreground`) | — | — | `--warning-surface` = `--accent` | Triangle icon + text |
| `--info` (= `--muted-foreground`) | — | — | `--info-surface` = `--card` | Info icon + text |

- Amber is reserved (§4.5) and red means error, so **warnings and info are neutral** (graphite badge or banner with an icon and words), as in the mockups' warning badges and banners (`AddSong.dc.html`, `States.dc.html`). Component props `variant="warning" | "info"` stay; their look changes.
- Status surfaces are **opaque literals**: the mockup's status colour at α 0.14 / 0.12 (success), 0.14 / 0.10 (destructive) and 0.16 / 0.10 (unsure) composited over `--card` (unsure over `--background`, where it washes bars). Reason: the token tests' `contrast()` helper composites a translucent *background* over white, so every token used as a background in `CONTRAST_PAIRS` must be opaque (the same rule makes `--bar-current`, `--loop-fill` and `--score-loop-fill` opaque, §4.7). Only `--primary-soft` stays translucent; it is tested by explicit compositing (§4.6).
- Status colours appear as text, icon, a 1 px border or a status surface, never as a large saturated fill, except the solid destructive button in a confirm dialog.

### 4.4 Categorical: stems, strings, hands
Stems keep the mockups' hue families (guitar teal, bass violet, drums sky, vocals pink, keys lime, other warm grey) and stay out of the amber range (hue 40–105 at chroma > 0.03). The mockup values all sit at similar lightness and fail the CVD separation test (`28` §3: every pair, including the mix colour, ≥ 12 ΔE2000 under simulated protanopia, deuteranopia and tritanopia; worst mockup pair 1.9). Each stem was moved the smallest summed ΔE2000 from its mockup value that passes in both themes and both contrast levels, stays ≥ 3:1 on `--background`, `--card` and `--muted`, carries its tile letters at ≥ 4.5:1, and stays ≥ 15 ΔE2000 from `--unsure`, `--destructive`, `--success` and `--signal`. The search script and its result are recorded in the s31a report; s32 re-runs `palette.test.ts` on these values.

| Token | Instrument | Mockup N | **N** | Mockup D | **D** | Second cue |
|---|---|---|---|---|---|---|
| `--stem-guitar` | Guitar | `oklch(0.79 0.100 180)` | `oklch(0.605 0.103 193)` | `oklch(0.55 0.100 180)` (out of gamut) | `oklch(0.510 0.087 195)` | Label "Guitar", tile "Gt" |
| `--stem-bass` | Bass | `oklch(0.75 0.120 305)` | `oklch(0.756 0.145 307)` | `oklch(0.52 0.150 305)` | `oklch(0.546 0.181 303)` | Label, tile "Bs" |
| `--stem-drums` | Drums | `oklch(0.80 0.090 225)` | `oklch(0.850 0.077 216)` | `oklch(0.55 0.110 235)` | `oklch(0.364 0.052 223)` | Label, tile "Dr" |
| `--stem-vocals` | Vocals | `oklch(0.77 0.110 5)` | `oklch(0.712 0.186 350)` | `oklch(0.58 0.150 5)` | `oklch(0.583 0.205 354)` | Label, tile "Vo" |
| `--stem-keys` | Piano / keys | `oklch(0.82 0.120 128)` | `oklch(0.835 0.130 125)` | `oklch(0.56 0.130 130)` | `oklch(0.546 0.126 128)` | Label, tile "Pn" |
| `--stem-other` | Other | `oklch(0.72 0.012 70)` | `oklch(0.677 0.027 87)` | `oklch(0.55 0.012 70)` | `oklch(0.528 0.028 87)` | Label |
| `--stem-mix` | The band (mix-minus) | — | = `--muted-foreground` | — | = `--muted-foreground` | Label "Band" |

Measured (s31a, Machado 2009 severity 1.0): worst pair N 12.4 (protan guitar/other, deutan bass/drums, tritan other/mix), D 12.4 (protan drums/mix, deutan guitar/vocals); every stem ≥ 4.0:1 on `--background`, `--card` and `--muted` (mix as `--muted-foreground`, normal and increased contrast). Tile letters use `--primary-foreground` in Night (≥ 5.0:1) and `oklch(0.99 0 0)` in Daylight (≥ 4.6:1): the tile foreground is a component token, `--tile-foreground`.

- **"Your part" is never a colour:** a "Your part" badge, listed first, and its name.
- **Strings** in chord shapes and the fretboard differ by position and name, never colour.
- **Hands** (piano): left and right have their own tier-3 tokens (§4.7), differ by more than hue (left square-cornered, right rounded; L/R letters on keys and notes; "Left hand"/"Right hand" in names), and "Show hands: Left/Right" dims the other hand to 45 %.
- `--chart-1…5` map to guitar, bass, drums, vocals, keys so charts inherit the same meaning. Progress charts use `--signal` for the main series and a dashed `--muted-foreground` for the comparison series (§12.2).

### 4.5 Usage rules
- **Amber means "now", and it marks exactly these** (every one comes from `splitune.css` and the owner-approved mockups; design QA treats anything else in amber as a defect):
  - *Now:* the playhead; the sounding note; the current beat dot; the current-bar wash; the current section chip; the count-in number.
  - *The loop:* the song-map band and edges, the notation bracket and wash, the loop pill, the active clip's dot.
  - *The one primary action of a view* (one filled amber button per view; a view is a page, a dialog, a sheet or the practice inspector tab), plus Play.
  - *On, selected and progress states of controls:* the selected tab's underline, chip and segment on-states (wash + line + ink), a selected radio card, a switch that is on, a checked checkbox or radio, M/S that are on, an on icon button, slider and progress fills, the `Spinner` arc, done and current step dots, the speed ladder's done and current rungs, the This week day dots, the chord-shape finger dots, and primary badges ("Analysing 5/8", "Soon", "Ladder at 75 % → 100 %", "Your part").
  - *Brand:* the wordmark's disc and the step numbers on Home.
  Amber is never used for headings, body text, icons at rest, illustrations or a second primary button.
- **Red only for** errors, destructive actions and the recording indicator. **Blue only for** uncertainty. **Green only for** success and edited marks. A stem's hue never carries one of these meanings: stems always carry a label.
- **States are never shown by hue alone.** A pressed, selected, on or current state has a shape or text cue (underline, raised capsule, check, filled vs outlined, knob position, "On"/"Muted" text, weight) and, where the indicator is a fill or a line, a ≥ 3:1 change against its rest state in both themes. Per component in §12.3.
- Surfaces nest at most three levels (background → card → muted well).
- No transparency or blur over the waveform or notation. **Opaque washes** (`--bar-current`, `--loop-fill`, `--score-loop-fill`, `--unsure-surface`, the status surfaces) are only ever painted **beneath** content: bar-cell and band backgrounds under the digits, staff, waveform bars and playhead. A wash that has to sit over content, or on a ground other than the one it was composited over (chips, badges, pills, the Fix pill on the top bar), uses the translucent `--primary-soft`. Translucent washes are never a background that a `CONTRAST_PAIRS` entry is measured on (§4.3, §4.6).

### 4.6 Verified contrast (WCAG 2.2, computed 2026-11-08 from the values in §4.1–§4.7 with `colorjs.io` 0.7.1)
Format: normal (increased contrast). `stage` has the Night values. Minimums are the WCAG floors and never move: 7 for body text on the page and ink on the notation, 4.5 for text, 3 for graphics and UI boundaries.

**Baseline** (the rows `contrast.test.ts` checks to ±0.1 in its "§4.6 baseline values" block, for `dark`, `light` and `stage`):

| Pair | N (`dark`, `stage`) | D (`light`) | Min |
|---|---|---|---|
| `--foreground` / `--background` | 16.9 | 16.4 | 7 |
| `--muted-foreground` / `--card` | 9.9 | 9.1 | 4.5 |
| `--primary-foreground` / `--primary` | 9.7 | 9.7 | 4.5 |
| `--ring` / `--background` | 10.1 | 5.8 | 3 |
| `--input` / `--card` | 3.4 | 3.5 | 3 |
| `--ink` / `--paper` | 16.9 | 16.4 | 7 |
| `--conf-medium` / `--paper` | 16.9 | 16.4 | 4.5 |
| `--conf-low` / `--paper` | 9.6 | 5.6 | 4.5 |
| `--score-loop-edge` / `--paper` | 10.1 | 3.6 | 3 |
| `--score-playhead` / `--paper` | 10.1 | 3.6 | 3 |
| `--staff` / `--paper` | 4.0 | 3.6 | 3 |
| `--staff` / `--score-loop-fill` | 3.7 | 3.5 | 3 |

**Every `CONTRAST_PAIRS` entry** (all pass in all six contexts):

| Pair | N | D | Min |
|---|---|---|---|
| `--foreground` / `--card` · `--muted` · `--accent` | 15.7 · 14.2 · 12.2 | 17.4 · 15.3 · 13.8 | 7 · 4.5 · 4.5 |
| `--card-`, `--popover-`, `--secondary-`, `--accent-`, `--sidebar-`, `--sidebar-accent-foreground` on their surfaces | ≥ 12.2 | ≥ 13.8 | 4.5 |
| `--sidebar-primary-foreground` / `--sidebar-primary` | 9.7 | 9.7 | 4.5 |
| `--muted-foreground` / `--background` · `--muted` | 10.7 · 9.0 (13.0 · 11.0) | 8.5 · 8.0 (11.3 · 10.6) | 4.5 |
| `--faint-foreground` / `--background` · `--card` · `--muted` · `--accent` | 6.9 · 6.5 · 5.9 · 5.0 (9.6 · 8.9 · 8.1 · 6.9) | 5.8 · 6.2 · 5.4 · 4.9 (7.8 · 8.3 · 7.3 · 6.6) | 4.5 |
| `--primary-ink` / `--background` · `--card` · `--accent` · `--surface-raised` | 11.2 · 10.4 · 8.1 · 10.4 | 5.8 · 6.1 · 4.8 · 6.1 | 4.5 |
| `--ring` / `--card` · `--muted` | 9.4 · 8.5 | 6.1 · 5.4 | 3 |
| `--signal` / `--background` · `--card` · `--muted` · `--accent` · `--bar-current` · `--score-loop-fill` | 10.1 · 9.4 · 8.5 · 7.3 · 7.9 · 9.2 | 3.6 · 3.9 · 3.4 · 3.1 · 3.2 · 3.5 | 3 |
| `--primary-line` / `--background` · `--card` | 3.3 · 3.3 | 3.6 · 3.9 | 3 |
| `--input` / `--background` · `--muted` · `--surface-raised` · `--surface-sunken` | 3.6 · 3.1 · 3.4 · 3.6 (5.3 · 4.5 · 4.9 · 5.3) | 3.3 · 3.1 · 3.5 · 3.3 (5.1 · 4.8 · 5.4 · 5.1) | 3 |
| `--staff` / `--card` · `--bar-current` · `--unsure-surface` · `--key-white` | 3.8 · 3.2 · 3.1 · 4.1 (4.9 · 4.1 · 4.0 · 3.2) | 3.8 · 3.2 · 3.1 · 3.8 (5.9 · 4.9 · 4.8 · 5.8) | 3 |
| `--ink` / `--score-loop-fill` · `--bar-current` | 15.5 · 13.2 | 15.8 · 14.6 | 7 |
| `--conf-medium` / `--score-loop-fill` | 15.5 | 15.8 | 4.5 |
| `--conf-medium-edge` / `--paper` | 6.9 (9.6) | 5.8 (7.8) | 3 |
| `--conf-low` / `--score-loop-fill` · `--bar-current` · `--unsure-surface` | 8.8 · 7.5 · 7.3 | 5.4 · 5.0 · 4.9 | 4.5 |
| `--edited` / `--paper` | 10.5 | 5.2 | 4.5 |
| `--destructive` / `--background` · `--card` | 7.3 · 6.8 | 5.5 · 5.9 | 4.5 |
| `--destructive-foreground` / `--destructive` | 7.0 | 5.8 | 4.5 |
| `--success` · `--warning` · `--info` / `--card` | 9.8 · 9.9 · 9.9 | 5.5 · 9.1 · 9.1 | 4.5 |
| `--unsure` / `--card` | 9.0 | 6.0 | 4.5 |
| `--stem-*` / `--card` (lowest) · `--stem-mix` | 4.9 (guitar) · 9.9 | 4.6 (vocals) · 9.1 | 3 |
| `--fret-guitar` · `--fret-bass` · `--melody-vocals` / `--paper` | 5.2 · 8.4 · 6.9 | 5.1 · 5.0 · 4.4 | 3 |
| `--fret-guitar` · `--fret-bass` · `--melody-vocals` / `--score-loop-fill` | 4.8 · 7.7 · 6.3 | 4.9 · 4.8 · 4.2 | 3 |
| `--tile-foreground` / lowest stem | 5.0 (guitar) | 4.6 (vocals, keys) | 4.5 |
| `--loop-edge` · `--playhead` / `--card` | 9.4 · 9.4 | 3.9 · 3.9 | 3 |
| `--playhead` / `--loop-fill` | 7.9 | 3.2 | 3 |
| `--foreground` / `--loop-fill` | 13.2 | 14.6 | 4.5 |
| `--waveform-peak` / `--background` · `--card` | 3.6 · 3.4 (5.3 · 4.9) | 3.2 · 3.4 (4.5 · 4.8) | 3 |
| `--waveform-rms` / `--card` | 9.9 (12.1) | 9.1 (12.0) | 3 |
| `--key-black` / `--key-white` | 16.7 | 17.2 | 3 |
| `--key-left` · `--key-right` / `--key-white` | 3.5 · 3.4 | 3.9 · 3.8 | 3 |
| `--key-left` · `--key-right` / `--key-black` | 4.8 · 4.9 | 4.4 · 4.5 | 3 |
| `--key-left-fg` / `--key-left` · `--key-right-fg` / `--key-right` | 4.6 · 4.7 | 4.6 · 4.7 | 4.5 |
| `--hud-fg` / `--hud-bg` | 12.2 | 13.8 | 4.5 |
| `--foreground` / `--unsure-surface` | 12.8 | 14.3 | 4.5 |
| Surfaces and status surfaces | §4.8 | §4.8 | |

**Where each wash is tested.**
- Opaque washes appear in `CONTRAST_PAIRS` as backgrounds, paired with what is painted on them: ink and digits (`--ink`, `--conf-low`), the staff, the playhead, and the in-loop waveform bars (`--waveform-loop` = `--signal`, so `--signal` / `--bar-current` and `--playhead` / `--loop-fill` cover them).
- The helper's composite-over-white path is never hit by a background. Translucent *foregrounds* (`--primary-line`) are composited over the pair's own background, which is correct.
- The translucent `--primary-soft` is tested only in the explicit block below.

**Translucent washes** (not in `CONTRAST_PAIRS`; a new block in `contrast.test.ts` composites each over every surface it can sit on with `over()`):

| Pair | N | D | Min |
|---|---|---|---|
| `--primary-ink` on `--primary-soft` over `--background` · `--card` · `--muted` | 8.8 · 7.9 · 7.1 | 5.1 · 5.4 · 4.9 | 4.5 |
| `--foreground` on `--primary-soft` over `--card` | 12.0 | 15.4 | 4.5 |
| `--ink` on a Notes head (`--fret-*`/`--melody-vocals` at 30 % over `--paper`) | ≥ 9.5 | ≥ 10.6 | 4.5 |

**How the Music Stand pairs map** (s32 rewrites `CONTRAST_PAIRS` this way; no pair is dropped, no minimum changes):
- `--primary` as text: `['--primary', '--background' | '--card' | '--accent' | '--surface-raised', 4.5]` → the same pairs with **`--primary-ink`** (amber text is `--primary-ink`; `--primary` is now a fill with graphite text, checked by `--primary-foreground` / `--primary`).
- `--warning` / `--card`, `--info` / `--card`, `--warning` / `--warning-surface`, `--info` / `--info-surface`: unchanged names; `--warning` and `--info` resolve to `--muted-foreground`, their surfaces to `--accent` and `--card`.
- `--key-left-fg`, `--key-right-fg`, `--hud-bg`, `--hud-bg-more`, `--hud-fg`, `--waveform-rms`, `--conf-medium`: names kept, values in §4.7 (no renames).
- Every other pair keeps its names; only the values change.

### 4.7 Component tokens (tier 3) and the remaining roles
| Token | N | D | Notes |
|---|---|---|---|
| `--bar-current` (the bar being played) | `oklch(0.271 0.036 73)` | `oklch(0.934 0.039 78)` | Opaque: the mockup's `--acc-soft` (α 0.14 / 0.20) over `--background` (§4.3). A bar-cell background **beneath** the staff, digits and playhead, as in the mockup's `.bar-cell.cur`; never an overlay |
| `--loop-fill` (song-map loop band) | = `--bar-current` | = `--bar-current` | Painted **beneath** the waveform bars (bars inside the loop are `--waveform-loop`), with the 2 px `--loop-edge` edges, the unsure hatch and the now-line drawn over the bars. The mockup draws `.loopband` as a translucent overlay after `.wave`; V17 |
| `--score-loop-fill` (bars in the loop on the notation) | `oklch(0.212 0.021 71)` | `oklch(0.961 0.017 80)` | Opaque: amber α 0.06 over `--background` (mockup `.bar-cell.inloop`); a bar-cell background beneath the content, like `--bar-current` |
| `--loop-edge`, `--playhead`, `--score-loop-edge`, `--score-playhead` | = `--signal` | = `--signal` | 2 px; the playhead adds `--glow` in Night |
| `--now-line` (song map) | = `--foreground` | = `--foreground` | 2 px |
| `--staff` (tab and staff lines, bar lines, chord-shape grid) | `oklch(0.555 0.010 60)`; more `oklch(0.62 0.010 60)` | `oklch(0.605 0.012 80)`; more `oklch(0.50 0.012 80)` | Mockup `--line` (1.7:1) corrected to ≥ 3:1 (§4.9 V1) |
| `--waveform-peak` (unplayed bars) | `oklch(0.53 0.010 70)`; more `oklch(0.62 0.010 70)` | `oklch(0.63 0.012 70)`; more `oklch(0.55 0.012 70)` | Opaque; mockup `--tx3` at 55 % (2.9:1) corrected (V7) |
| `--waveform-rms`, `--waveform-played` | = `--muted-foreground` | = `--muted-foreground` | Played bars (mockup `.wave > i.past`, opaque here) |
| `--waveform-loop` (bars inside the loop) | = `--signal` | = `--signal` | |
| `--hatch` (unsure bars on the song map) | = `--unsure` | = `--unsure` | 135° stripes, 2 px on 2 px off; a pattern, not a colour |
| `--beat-now`, `--beat-done`, `--beat-slot` (beat pulse) | `--signal` · `--faint-foreground` · outline `--input` | same roles | Downbeat is a square, others round (§10) |
| `--key-white`, `--key-black` | `oklch(0.95 0.008 80)` · `oklch(0.165 0.008 60)` | `oklch(0.99 0.003 85)` · `oklch(0.21 0.012 60)` | A keyboard looks like a keyboard in both themes (V8) |
| `--key-left`, `--key-right` | `oklch(0.59 0.110 230)` · `oklch(0.59 0.130 128)` | same | Hand fills on keys and falling notes (V8) |
| `--key-left-fg`, `--key-right-fg` | `oklch(0.19 0.020 60)` | same | L/R letters on lit keys and notes |
| `--fret-guitar`, `--fret-bass`, `--melody-vocals` | = the stem | = the stem | Instrument marks on the notation |
| `--tile-foreground` (new) | = `--primary-foreground` | `oklch(0.99 0 0)` | Letters on stem tiles |
| `--hud-bg`, `--hud-bg-more`, `--hud-fg` | = `--accent` · = `--accent` · = `--foreground` | same | PedalHud chip (mockup `.toast`); opaque in both contrast levels |
| `--scrim` | `oklch(0.10 0.010 60 / 0.62)` | same | Behind dialogs and sheets (mockup `.overlay`) |
| `--elevation-1` | `none` | `none` | Cards are bordered, not lifted |
| `--elevation-2`, `--elevation-3` | `0 1px 0 oklch(1 0 0 / 0.04) inset, 0 12px 32px oklch(0 0 0 / 0.38)` | `0 1px 2px oklch(0.3 0.02 60 / 0.06), 0 10px 28px oklch(0.3 0.02 60 / 0.10)` | Sheets, dialogs, popovers, toasts, the pass prompt (mockup `--shadow`) |
| `--muted-foreground-more`, `--border-more`, `--input-more` | the "more" columns of §4.1 | same | The increased-contrast values as their own roles, as today |
| `--focus-width` | `2px`; more `3px` | same | |
| `--read-scale` | `1`; `stage` `1.25` | `1` | §6.3 |
| `--stem-mix` | = `--muted-foreground` | same | |
| `--chart-1…5` | guitar, bass, drums, vocals, keys stems | same | |
| `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring` | = `--card`, `--foreground`, `--primary`, `--primary-foreground`, `--accent`, `--foreground`, `--border`, `--ring` | same | |

Component tokens point at a semantic role or carry their own tuned literal, never a primitive step (`tokens.test.ts`). Every role listed in `index.ts` (`SEMANTIC_ROLES`, `ALIAS_ROLES`, `COMPONENT_TOKENS`) has a value in this section or §4.1–§4.4, in every context.

### 4.8 Surfaces and status tints
- **Raised** = `--card` (= `--surface-raised`); **sunken** = `--background` (= `--surface-sunken`). Inside a card, a sunken well (field, stepper, segmented track, search box) is the page colour, in both themes (the mockup's `.field` and `.stepper` use `--bg`; `.seg` tracks use `--s1` on the page).
- **Status surfaces** are opaque literals (§4.3); `--warning-surface` = `--accent`, `--info-surface` = `--card`.
- A status surface always carries an icon and text (§4.3, §13).
- **Verified contrast** (the rows `contrast.test.ts` checks to ±0.1 in its "§4.8 surface and status-surface values" block; normal contrast, and increased contrast for the muted rows; `stage` has the Night values):

| Pair | N (`dark`, `stage`) | D (`light`) | Min |
|---|---|---|---|
| `--foreground` / `--surface-raised` · `--surface-sunken` | 15.7 · 16.9 | 17.4 · 16.4 | 4.5 |
| `--muted-foreground` / `--surface-raised` · `--surface-sunken` | 9.9 · 10.7 | 9.1 · 8.5 | 4.5 |
| (increased contrast) `--muted-foreground` / `--surface-raised` · `--surface-sunken` | 12.1 · 13.0 | 12.0 · 11.3 | 4.5 |
| `--foreground` / `--success-surface` · `--warning-surface` · `--info-surface` · `--destructive-surface` | 11.9 · 12.2 · 15.7 · 12.7 | 14.7 · 13.8 · 17.4 · 14.9 | 4.5 |
| `--success` / `--success-surface` | 7.4 | 4.7 | 4.5 |
| `--warning` / `--warning-surface` | 7.7 (9.4) | 7.2 (9.5) | 4.5 |
| `--info` / `--info-surface` | 9.9 (12.1) | 9.1 (12.0) | 4.5 |
| `--destructive` / `--destructive-surface` | 5.5 | 5.1 | 4.5 |
| `--unsure` / `--unsure-surface` | 7.3 | 4.9 | 4.5 |

### 4.9 Deviation register (where this doc departs from `splitune.css` or a mockup)
Design QA (`28` §5) treats these values as the reference instead of the mockup's. V1, V2 and V6 are owner decision D5 (G1, 2026-11-08). The other rows are accepted under the owner's blanket pre-approval of the gates and are listed here for the owner to revisit; they are not individually approved. V11 and V15 restore existing repo rules (64 px practice targets, today's reading sizes).

| # | What | Mockup | Here | Why |
|---|---|---|---|---|
| V1 | Tab/staff lines, bar lines, chord-shape grid | `--line` (1.7:1 N, 1.5:1 D) | `--staff` (≥ 3.1:1) | Lines carry the string and bar a digit belongs to (WCAG 1.4.11; existing `--staff` minimum) |
| V2 | Text-field, stepper, checkbox, slider-track boundaries; upcoming beat outline | `--line` | `--input` (≥ 3.1:1) | WCAG 1.4.11; existing `--input` minimum |
| V3 | Daylight amber marks (playhead, loop edges, tab underline, beat dot, shape dots, progress/slider fill, switch and rung edges) | `--acc` (1.8:1) | `--signal` `oklch(0.610 0.140 62)` | 1.4.11 |
| V4 | Daylight focus ring | `--acc` | `--primary-ink` | 2.4.11/2.4.13 (existing `--ring` ≥ 3 minimum) |
| V5 | Daylight `--primary-line` | α 0.60 | opaque `--signal` | On-state chips need a 3:1 edge (1.4.1/1.4.11) |
| V6 | Stem colours, both themes | §4.4 "Mockup" columns | §4.4 values | CVD separation test; Daylight guitar out of gamut |
| V7 | Waveform unplayed bars | `--tx3` α 0.55 | `--waveform-peak` opaque | 3:1 for the overview graphic |
| V8 | Piano keyboard and hand colours | white keys `--tx` (inverted in Daylight), hands `--st-drm`/`--st-keys` | §4.7 key tokens | Daylight inversion; hands ≥ 3:1 on white keys |
| V9 | White text on the danger button in Night | `oklch(0.99 0 0)` (2.6:1) | `--destructive-foreground` graphite (7.0:1) | 1.4.3 |
| V10 | Text below 11 px (song-map ruler, ladder rung labels, shape labels) | 10 px | 11 px (`text-2xs`) | Floor for any text; the superscript "?" stays 10 px as a glyph |
| V11 | Main practice controls (§8) | Desktop dock: restart, next bar, speed −/+, loop pill, count-in 52; desktop pass prompt 40; phone: speed −/+ 44, loop button 44, restart/next 52, pass buttons 48; Tools sheet speed −/+ 52; Fix-mode Play 52, speed −/+ 40 | **64** painted and hit, every layout | Mockup draws N px; spec keeps 64 px (`redesign/report.md` "64 px for the main controls while practising", acceptance table; the repo rule since step 10a) |
| V12 | Secondary and browse controls painted under their target | `.btn` 40, `.btn.sm` 32, `.chip` 30, `.seg` items 34, `.ms` 32, `.stepper` halves 36 × 40, `.ib` 40 | Painted size kept; the control's box grows to 48 (practice) or 44 (elsewhere) with transparent padding around the painted shape | Target rule (§8) |
| V13 | Song-map section chips | 22 tall | Box 24 tall (min width 24) on fine pointers; 48 on coarse pointers (secondary practice control, §8) | The only use of the 24 px floor (§8) |
| V14 | Inspector width | 360 (Loop, Drums), 380 (Mix, Progress), 400 (Fix) | 380 at every tab | A docked panel that changes width per tab moves the notation |
| V15 | Reading sizes (§6.3) | Desk tab 15, chords over the tab 17, bar numbers 11, eyebrows 12; Stand view tab 26, chords 28, bar numbers 15, eyebrows 14; phone glance eyebrow 12, speed 18 | §6.3 values (Desk tab 24, chords 27, bar numbers 14, labels 14; Stand view tab 36, chords 40; phone glance at Floor: bar.beat 40, labels 24) | Never below today's sizes (`tokens.test.ts`, `score-theme.ts` 18 px floor), 16′ digits and 0.4° chord capitals |
| V16 | Daylight switch on-track and speed-ladder done rungs | Amber fill alone (1.9:1 against the card, ~1.4:1 against an upcoming rung) | Plus a 1 px `--signal` edge | 1.4.1/1.4.11 on-state cue (§12.3) |
| V17 | Washes and status tints | Translucent, painted over whatever ground they sit on: `--acc-soft` α 0.14 / 0.20, `.bar-cell.inloop` α 0.06, status `-soft` α 0.10–0.16; `.loopband` drawn over `.wave` | Opaque literals painted beneath content. Composited over `--background`: `--bar-current`, `--loop-fill`, `--score-loop-fill`, `--unsure-surface`. Composited over `--card`: success, destructive. The song-map band sits under the waveform bars | The token tests composite a translucent background over white, so a translucent background can't be contrast-tested. On another ground (a status tint on the page or on `--muted`) the literal differs from the mockup's translucent tint by up to ΔE2000 2.6, beyond the `28` §5.1 tolerance of 2, so fidelity compares against these literals there |

## 5. Confidence encoding (one rule for every surface)
Ordinal, from `05-analysis-schema.md` bands. **Marks show for every stage that produces bands today, and keep showing** until calibration check **C1** says otherwise for a stage. *C1* (a research check from `redesign/report.md` "Research and testing gates", where it is called G2; not an owner gate) asks, per stage and model (beats, chords, notes per instrument), whether the bands mean what they say. A stage counts as **calibrated** when its model has an `isotonic` `CalibrationTable` in `services/ml/config/calibration/` fitted on a named test set (`fitted_on`), and on that set the observed error rate of each band is within ±5 percentage points of the frequency the UI states for it (reliability diagram from the eval harness, `08`), with at least 200 items per band. A stage whose table is `identity`, or which fails the ±5 point check, is reported to the owner; **the owner decides** whether its marks change; if they are hidden, the legend line says that this part's confidence isn't checked, so no note reads as sure by default. No step in s32–s45 hides marks. Cues, strongest first: **outline → glyph → colour → words on focus.** No blur, no opacity on ink (digits must stay ≥ 4.5:1).

| Level (name in the UI) | Ink | Outline | Glyph | Example |
|---|---|---|---|---|
| High — *Sure* | `--ink` | none | none | `5` |
| Medium — *Probably* | `--ink` | 1.5 px **dashed**, `--conf-medium-edge` (= `--faint-foreground`), 1 px offset | none | dashed box around `5`; chord chip with a dashed border |
| Low — *Unsure* | `--conf-low` (= `--unsure`) | 1.5 px dashed `--unsure` | superscript **"?"** (10 px, 700) | `.fn.u`, `.chord-sym.u`, chip "Am ?" |
| Edited by you | `--edited` | 2 px underline, 3 px offset | none | `.fn.fix`; the accessible name adds "edited by you" |
| Sounding now | `--primary-foreground` on `--primary` | `--glow` (Night) | none | `.fn.now` |
| Timing flagged (quantize residual) | unchanged | 1.5 px **dotted** underline | none | Notes only |
| Unplayable, moved by octaves | unchanged | none | superscript "8va"/"8vb" + tooltip "Played an octave higher/lower than recorded" | Tab only |
| Unplayable, no position | — | — | "!" on the beat; opens Fix on that note | Tab only |

| Surface | Encoding |
|---|---|
| Tab / staff (alphaTab) | Ink via `NoteStyle` (`NoteSubElement.GuitarTabFretNumber`, noteheads); outlines, glyphs, underlines and the sounding fill drawn in an **overlay layer** positioned from `boundsLookup` (`core.includeNoteBounds = true`), never by styling alphaTab's SVG |
| Chord names over the notation | Unsure: `--unsure` text + 1.5 px dashed underline + "?"; probably: dashed underline in `--conf-medium-edge` |
| Chord chips and chord sheet | Border solid (sure) / dashed (probably, unsure); unsure adds `--unsure` text and "?" |
| Song map | Unsure bars get the `--hatch` stripe band above the waveform |
| Notes rolls and drum grid | Unsure notes and hits hollow with a dashed `--unsure` outline; low adds "?"; drum kit-piece guesses and ghost notes hollow (ghost solid outline, guess dashed) |
| Mixer | Rough stem: "Rough" badge + tooltip with the reason (`practice.rough_stem`) |
| Library and song header | Words: "Ready", "Partial", "Chords only" — never a dot alone |
| Legend chip (practice top bar) | Dashed chip "? Auto-transcribed · {n} unsure"; its popover holds "Auto-transcribed — may contain errors (v{model})", the key (Sure / Probably / Unsure / Edited by you), the frequency line ("About 1 in 8 notes in this song are marked unsure") and the "Show uncertainty" switch |

- **Frequency wording, never percentages:** "about 1 in 3", "we'd guess wrong about 1 time in 3", "Second guess · about 1 in 3". Bands map to the nearest of 1 in 2 / 3 / 4 / 5 / 10 / 20 (`27` §5.3).
- **Shaky bar:** when most notes of a bar are unsure, the bar gets one unsure outline around the whole bar (dashed `--unsure`, radius `xs`) and one "?" instead of a mark per note.
- **Show uncertainty off** removes outlines, glyphs and the unsure colour (unsure ink falls back to `--ink`), keeps the hatch band on the song map and the legend chip.
- **Ranking** for the Fix queue (`12` §4): by consequence (wrong pitch or string/fret, octave error, wrong chord root or quality), then by probability.

## 6. Typography and reading sizes
### 6.1 Families
| Use | Family | Licence | Notes |
|---|---|---|---|
| UI, chord names, headings | **Instrument Sans** Variable (`wght` 400–700, `wdth` 100) | SIL OFL 1.1 | Weights the scale uses: 400, 500, 550, 600, 650, 700 (mockup 750/800 render at 700). Roman only (no italics in the design). Preloaded |
| Every number that changes (time, bar.beat, %, BPM, dB, counts) and **tab digits**, kbd | **JetBrains Mono** Variable (`wght` 400–700) | SIL OFL 1.1 | `font-variant-numeric: tabular-nums`, letter-spacing −0.01em (mockup `.num`). Not preloaded; `font-display: swap` with a metric-matched fallback so the transport can't reflow |
| Standard notation glyphs | **Bravura** (alphaTab's SMuFL font) | SIL OFL 1.1 | Self-hosted per `12` §3; heavier strokes than Leland, better as light ink on dark |
| Hyperlegible reading option | **Atkinson Hyperlegible Next** (`wght` 200–800, roman) | SIL OFL 1.1 | Settings "Hyperlegible font" swaps the reading tokens' family (tab digits, chord names, practice readouts), not chrome. Lazy-loaded |
| Fallback stacks | UI `"Instrument Sans", ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif`; mono `"JetBrains Mono", ui-monospace, "Cascadia Mono", Consolas, monospace` | — | `size-adjust`/`ascent-override` fallbacks generated in s32 |

- **Subsetting** (`scripts/fonts/subset.sh`): pinned upstream files with sha256, `pyftsubset --layout-features='*'` (keeps `tnum`, `zero`, `ss*`, `cv*`), Latin + Latin-1 + punctuation + ♯ ♭ ♮ − (U+2212) · × ÷ → ← ↑ ↓ ‹ › – — U+202F; `varLib.instancer` to the weights above; Instrument Sans roman ≤ 80 KB (the preload budget). A test proves `tnum` survives in the shipped WOFF2 and that readouts keep their width as digits change. OFL texts ship beside the fonts.
- **Glyph check (s32 gate):** Instrument Sans and JetBrains Mono must cover ♯ ♭ − · and U+202F; where a family lacks ♯/♭, `ChordSymbol` keeps drawing them from the fallback, lifted 0.16 em, as today. Chord quality ° ø △ come from Bravura's SMuFL `csym` range.
- **Legibility check (s32 gate):** JetBrains Mono tab digits against Instrument Sans and Inter 4 tabular digits on the confusable pairs 1/7, 3/8, 6/0 at the three distances. If JetBrains Mono or Instrument Sans fails (glyphs, `tnum`, misreadings), **Inter 4** replaces the failing family (Display cuts for display sizes, tabular figures for numbers) and s32 records it here.
- alphaTab's `display.resources.tablatureFont`, `barNumberFont` and `fretboardNumberFont` use the active reading family at the reading-token size.

### 6.2 Browse scale (rem; root 16 px, so browser zoom and 200 % text work)
| Token | Size / line height | Weight · tracking | Mockup class · use |
|---|---|---|---|
| `text-2xs` | 11 / 14 | 650 | `.sec` section chips, ruler and bar numbers (mono), ladder rung labels |
| `text-xs` | 12 / 16 | 650 | `.badge`, `.kbd` (mono 12), `.eyebrow` (uppercase, +0.08em, `--faint-foreground`) |
| `text-sm` | 13 / 18 | 400–600 | `.small`, `.label` (600, `--muted-foreground`), chips (550) |
| `text-md` | 14 / 20 | 600 | Buttons, tabs, segments, nav links, menu items, row titles |
| `text-base` | 15 / 22 | 400 | Body, fields (`.app` 15 px / 1.45) |
| `text-lg` | 17 / 22 | 650 | `.h3` |
| `text-xl` | 22 / 26 | 650 · −0.01em | `.h2` |
| `text-2xl` | 32 / 37 | 650 · −0.02em | `.h1` (page titles) |
| `text-3xl` | 44 / 46 | 600 · −0.02em, display family | Section headings on Home ("Made for the music stand"), the sign-in showcase |
| `text-4xl` | 48 / 50 | 600 · −0.02em, display family | Onboarding step titles ("Where's your screen?") |
| `text-5xl` | 56 / 59 | 600 · −0.02em, display family | Pricing title |
| `text-display` | `clamp(2.75rem, 6vw, 4.75rem)` / 1.05 | 600 · −0.02em, `text-wrap: balance` | Home headline (mockup `clamp(44px, 6vw, 76px)`) |

- Buttons: default 14/600, `lg` 16/600, `sm` 13/600. Body copy on marketing pages 18–19 px (`text-lead` 1.1875rem / 1.45).
- Sentence case everywhere; uppercase only for `.eyebrow` labels. Nothing below 11 px except the "?" glyph (§4.9 V10).

### 6.3 Practice reading scale (distance presets)
Sizes are CSS px at 100 % Reading size, then × the Reading size calibration (80–140 % in 10 % steps, "Can you read the fret numbers from where you play?") and × `--read-scale`. **Floors** (binding; s32 must not go under them): every value is at least today's (`packages/ui-tokens/src/theme.tailwind.css` and the assertions in `tokens.test.ts`: Stand tab 36, Desk current chord 32, Floor current chord 88), tab digits are never below 18 px (`score-theme.ts`, `--read-tab` `max(1.125rem, …)`), and at 100 % each preset meets the visual-angle rationale below. Where the mockups draw smaller, the deviation is V15 (§4.9).

**Rationale (conversion used for every number):** 0.19 mm per CSS px (the report's iPad figure, "7.1 mm ≈ 37 CSS px"; laptops are 0.19–0.22 mm/px, so desk values err large); digit and cap height 0.7 em. Tab digits need a digit height of at least **16′** of arc (target 22′; ISO 9241-303 as reported); chord names read while playing need cap heights of at least **0.4°** (report: "capitals of chord names 0.4–0.6°"). At 0.5 / 0.75 / 1.5 m that is a tab font of ≥ 17.5 / 26 / 53 px (22′: 24 / 36 / 72) and a chord font of ≥ 27 / 40 / 79 px.

| Token | Use | **Desk** 0.5 m | **Music stand** 0.75 m | **Floor** 1.5 m | Today (D / S / F) |
|---|---|---|---|---|---|
| `--read-tab` | Tab digits (JetBrains Mono 600) | 24 (22′) | 36 (22′) | 54 (16′) | 24 / 36 / 36 |
| `--read-chord` | Chord names over the notation, "Then" chips, chord chips (700) | 27 | 40 | 79 | 22 / 32 / 56 |
| `--read-chord-sheet` (new) | Chord sheet and piano chart names (650) | 30 | 44 | 88 | — |
| `--read-chord-current` | The current chord (display 600; Now column, glance, Stand view) | 112 | 150 | 200 | 32 / 48 / 88 |
| `--read-chord-next` (new) | The next chord (650) | 56 | 64 | 100 | (chips: 22 / 32 / 56) |
| `--read-bar-number` | Bar numbers, bar.beat in the glance view (mono) | 14 | 20 | 40 | 14 / 20 / 40 |
| `--read-readout` | Position, speed %, loop counter (mono 600) | 22 | 28 | 40 | 20 / 28 / 40 |
| `--read-label` | Practice eyebrows ("Now · bar 26 · beat 3") | 14 | 20 | 24 | 14 / 20 / 24 |

- Tab string spacing follows the digit (`ceil(0.92 × --read-tab)`, as built in step 17c, never less than the digit + 4 px).
- **Automatic** (the default) resolves as today: fine pointer → Desk; coarse tablet → Music stand; coarse phone → Floor.
- **Stand view** (tablet layout, `27` §3.7.2) uses the resolved preset for every token except `--read-chord-current` and `--read-chord-next`, which it draws one step larger (Music stand → 200 / 100, as in `Stand.dc.html`; Floor stays Floor).
- **Phone glance** (`Phone-Practice.dc.html`, at Floor by default) uses the Floor tokens; the current chord is clamped to 43 % of the glance column's width (150 px at 390, as in the mockup) and the next chord to `clamp(56px, 16.5cqi, var(--read-chord-next))` (64 at 390); neither drops below today's 88 / 56.
- **`stage`** resolves to at least Music stand, then × 1.25 (`--read-scale`, unchanged from today; §2).
- **Fit rule:** the current and next chord shrink to fit their box when a long name ("F♯m7♭5") would overflow, never below `--read-chord-sheet` (on phones, the glance clamps above apply instead).
- **Phone fit rule** (coarse pointer with a viewport side ≤ 640; built and tested in s43). Phones resolve to Floor, whose tab and chord sizes don't fit a phone, so on phones:
  - **Tab** (the phone-landscape strip and the glance's Tab view): digit size *d* = `min(--read-tab, fit)`, where *fit* is the largest *d* at which one six-string system fits the notation box's height. The system is string spacing `ceil(0.92 d)` × 5, a chord row of `1.1 d` above and rhythm stems of `0.75 d` below. **Never below 18 px** (the `score-theme.ts` floor). Chord names over the tab use `min(--read-chord, 1.1 d)`; bar numbers use `min(--read-bar-number, 0.6 d)`, never below 11. If 18 px still doesn't fit (a very short viewport), the notation box scrolls vertically inside itself instead of shrinking further.
  - **Scrolling by bar:** bars keep their natural width for *d*, and the strip scrolls horizontally only when the playhead's next bar would leave the view. It then snaps so the playhead's bar starts at the left edge: smooth, or a jump under reduced motion. It doesn't scroll while paused (WCAG 2.2.2).
  - **"Then" chips** (glance) stay at `--read-chord` (79 at Floor), never shrunk. The row shows as many whole chips as fit its width (at least 1, at most 5) and drops the rest. It sits on its own row under the next chord when it can't share that row.
  - **Test (s43):** coarse pointer, Floor preset, 100 % Reading size, at 844 × 390 and 667 × 375 (landscape) and 390 × 844 (portrait, Tab view):
    - the tab system's box lies inside the notation box;
    - the computed digit `font-size` is ≥ 18 px and ≤ `--read-tab`;
    - after the playhead enters a bar that was out of view, the strip's `scrollLeft` equals that bar's start;
    - no "Then" chip's box overflows its row, and each chip's `font-size` equals `--read-chord`.
- Labels on rolls and lanes are 0.6 × the digit size, never below 11 px (`labelPx`).

## 7. Layout and spacing
- **Grid:** 4 px base (`--spacing: 0.25rem`); common steps 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 72 (the mockups' gaps and paddings). Page gutters 16 (phone) / 24 (tablet, desktop pages) / 20 (app bars).
- **Breakpoints:** Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536). Content widths: Library 1260 px, Settings 1180 px, Pricing 1040 px, Home sections 1240 px, onboarding 1120 px, forms 400 px, reading 72 ch (`--container-library`, `-settings`, `-pricing`, `-marketing`, `-onboarding`, `-form`, `-reading`).
- **App bar:** 64 px (library, settings, marketing); practice top bar 60 px; phone bars 56 px; phone bottom navigation 76 px + safe area.
- **Practice regions (desktop, `Main.dc.html`):** top bar 60; song map (padding 10/16/6: section chips 24 + map 40 + ruler 14); Now column 264 (padding 20); notation canvas flexible (padding 92 top, 28 right, 20 left; systems 92 apart); inspector 380 (§4.9 V14); transport dock 96 (Fix mode 80), holding 64 px controls (§8). Below 1280 px the dock's mix pill shows only its icon and the volume slider moves into a popover, so the 64 px controls never wrap. Region behaviour by width in `27` §3.7.
- **Layout selection** on the practice route uses viewport size, `(pointer: coarse)` and orientation (feature queries, no UA sniffing): desktop, tablet Stand view (the tablet default), tablet full layout, phone portrait (glance), phone landscape (`27` §3.7.2).
- **Safe areas:** fixed bars pad with `env(safe-area-inset-*)`; sticky bars set `scroll-padding` so a focused element is never hidden (WCAG 2.4.11).
- **Density:** *browse* (library, settings, Add song: 44 px targets, browse type) and *practice* (64 px main controls, 48 px secondary, reading scale). A data attribute on the shell, so shared components pick practice sizes automatically.

## 8. Targets and hit areas (CSS px)
A target is **the interactive element's own border box**: what `getBoundingClientRect()` returns and what the `28` §3 size probe measures. Where a mockup paints a smaller shape, the element keeps the target size with transparent padding and the painted shape is an inner layer; no `::after` extensions, so the probe measures what the pointer hits. Neighbouring targets never overlap.

| Token | Size | Use |
|---|---|---|
| `--target-practice` | **64 × 64**, painted at 64 | **Main practice controls, in every layout (desktop, tablet full layout, phone, Fix mode):** Play/Pause (phone 72), restart loop / back a bar, previous and next bar, speed − and + (and the speed readout beside them), the loop toggle or loop pill (64 tall), count-in, **Felt clean** and **Not yet**, "Loop this bar" in the glance view |
| `--target-stand` (new) | 88 tall, ¼ of the dock wide | Stand view's four pedal-mirroring buttons (Restart loop, Play/Pause, Felt clean, Not yet) |
| `--target-practice-2` | 48 × 48 | **Secondary practice controls:** click/metronome, the mix pill, volume, M/S, the view switch items, inspector tabs, Level / Capo rows, chord chips that open Fix, the legend chip, practice top-bar icon buttons, Tools sheet tiles and its M buttons, Fix-mode "Listen to" items, section chips on coarse pointers (44 painted is not enough there: their box is 48) |
| `--target` | 44 × 44 | **Everything else** interactive, every pointer type (WCAG 2.5.5 level, the internal rule) |
| `--target-min` | 24 × 24 | WCAG 2.5.8 AA floor. **One exception uses it:** the song-map section chips on fine pointers (box 24 tall, min width 24, 2 px apart; every section is also reachable with Tab/arrow keys on the chip row, from ⌘K and from the Loop tab's section badge). Nothing else may be under 44 |

- The old `--target-sm` (32) is retired (s45 deletes it): the Button `sm` size is a painted size with a 44 box. `--target-practice-2` stays at 48 and `--target-practice` at 64, as today.
- Primary practice targets cluster at the bottom edge; actions fire on pointer-up and cancel if the pointer slides off; destructive actions are undoable rather than confirm-gated, except delete song and delete account.
- **No drag required (WCAG 2.5.7):** loop handles have From/To steppers; faders accept a single click on the track and the dB readout opens a stepper; speed has −/+ and presets; inspector and drawer edges have a toggle button.

## 9. Shape, borders and elevation
- **Radius scale** (`--radius` 10 px base; mockup `--r1…r4` = 6 / 10 / 16 / 22):

| Utility | px | Mockup · use |
|---|---|---|
| `rounded-xs` | 4 | Tab-digit background, kbd (5), section chips (5), swatches (3), ladder rungs |
| `rounded-sm` | 6 | `--r1`: small inline chips, onboarding mini-cards |
| `rounded-md` | 8 | `.btn.sm`, `.ms` |
| `rounded-lg` | 10 | `--r2`: buttons, icon buttons, fields, steppers, rows, nav links, tiles, inner cards |
| `rounded-xl` | 12 | `.btn.lg`, segmented tracks (items 9 = track − padding), the piano roll's top corners |
| `rounded-2xl` | 14 | `.ib.lg`, transport pills, toasts, phone mini-cards |
| `rounded-3xl` | 16 | `--r3`: cards, panels' inner cards |
| `rounded-4xl` | 22 | `--r4`: sheets, dialogs (phone sheets 24 top corners) |
| `rounded-full` | — | Play, chips, badges, toggles, beat dots, avatar |

  The Music Stand scale had `xl` 14, `2xl` 18, `3xl` 24: s33 moves their uses to the table above.
- **Borders:** 1 px `--border` for cards, panels and dividers; 1 px `--border-strong` for text-identified controls; `--input` where the border is the only boundary of a control; 2 px dashed `--border-strong` for drop zones; 2 px `--signal` for the selected tab and loop edges.
- **Elevation:** cards none (bordered); sheets, dialogs, popovers, menus, toasts and the pass prompt `--elevation-2`/`-3`. Under increased contrast and forced colours every component keeps its 1 px border (a shadow is not a boundary).
- **Focus:** 2 px solid `outline` in `--ring`, 2 px offset (3 px under increased contrast); fields use 1 px offset (mockup `.field:focus`). Never `outline: none` without a replacement (lint-enforced).

## 10. Motion
| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 100 ms | Hover, press, toggle, confirmation appear |
| `--duration-base` | 200 ms | Popover, tooltip, toast, tab switch, chip state |
| `--duration-slow` | 300 ms | Drawer, sheet, dialog, page turn |
| `--duration-slower` | 400 ms | Route cross-fade, library grid ↔ list morph |
| `--stagger` | 40 ms | Between siblings in `stagger-children` (cap 8) |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default |
| `--ease-enter` / `--ease-exit` | `cubic-bezier(0, 0, 0, 1)` / `cubic-bezier(0.3, 0, 1, 1)` | Appearing / leaving |
| `--ease-spring` | `cubic-bezier(0.34, 1.3, 0.64, 1)` | Small confirmations only (a pass check) |
| `--ease-smooth`, `--ease-snappy` | `linear()` springs over 400 ms (as built in step 15a) | Layout morphs; the segmented capsule |

- **UI transitions stay within 150–250 ms** for sheets, selection and docking (report); 300 ms only for full sheets and dialogs.
- **The music drives the only continuous motion.** The playhead, the sounding-note highlight and rolls sit on their own compositor layer and move with `transform`; position is a pure function of the audio clock read once per frame (`AudioContext.getOutputTimestamp()` in `requestAnimationFrame`, `currentTime` fallback where the output timestamp is unreliable; `12` §3). Nothing eases the time → position mapping; no extrapolation.
- **Follow modes** (`12` §3): Page (default), Scroll, Off. Pausing playback stops any scrolling (WCAG 2.2.2).
- **Reduced motion** (`prefers-reduced-motion: reduce`, or Settings "Reduce motion: Follow system / On / Off"): durations become 0; notation turns page by page (Page is the only follow mode); the playhead moves in steps by beat; rolls hold a bar at a time; fades are dropped; the beat pulse becomes a static "beat n of 4" readout; view transitions are off. The playhead itself never stops: it is information.
- **Flash safety (WCAG 2.3.1):** nothing flashes more than 3 times a second at any tempo. The beat pulse changes a 14–26 px dot (shape and fill, no large-area luminance change), never full screen, never red. When beats come faster than 3 a second (> 180 BPM, or subdivisions), the pulse marks only the downbeat. Vibration (`navigator.vibrate`, where supported) follows the same schedule and is off by default.
- **Confirmation within 100 ms:** every key, pedal and tap shows its pressed state or PedalHud within 100 ms (`28` §3 timing check).
- **No decorative motion:** no parallax, no looping decoration, no celebration, no flashing on the beat unless the beat pulse is on. `animate-shimmer` and `animate-progress-indeterminate` are loading states and stop under reduced motion. Do not write the bare word `shimmer` in app source (Tailwind would emit shadcn's `.shimmer`, which uses relative colour syntax).
- **View transitions** only as progressive enhancement (`document.startViewTransition`), disabled under reduced motion.

## 11. Iconography and brand marks
- **Icons:** `lucide-react` 1.x (ISC, named imports) drawn as the mockups' inline icons: 24 px grid, **1.8 px stroke** (`strokeWidth={1.8}`), round caps and joins, `currentColor`. Sizes: 16 (`.i.s`, inline), 20 (`.i`, default), 24 (`.i.l`, transport secondary), 28 (`.i.xl`, Play). Filled glyphs only for Play/Pause (`.i.fill`).
- **Transport set:** Play, Pause, restart (bar-to-start), next bar, minus/plus (speed), repeat (loop), metronome, count-in (stopwatch), sliders (mix), volume, mic, keyboard, pedal (custom), search, more.
- **Custom icons** (same grid and stroke, `apps/web/app/ui/icons/`): pedal, two pedals (wizard illustration), capo, tab staff, chord box, count-in, minus-one, "your part", distance illustrations (desk, stand, floor), the bass guitar (exists).
- Icons are `aria-hidden`; buttons carry visible text or an `aria-label` that matches the visible label (WCAG 2.5.3). Icon-only buttons are allowed for the transport set, close, more, and the top-bar Display and Keyboard & pedal buttons, always with a tooltip that names the action and its key.
- **Wordmark and mark** (`apps/web/app/ui/brand.tsx`): "splitune" in lowercase, Instrument Sans 700, 19–20 px, −0.02em, `--foreground`; the mark is a 28 px `--primary` disc crossed by a 2.4 px `--primary-foreground` wave (mockup header SVG). Variants: full colour, mono, maskable PWA icon (safe zone 80 %), favicon 32/16. The product name in copy stays "Splitune". The manifest and `theme-color` use `BACKGROUND_HEX` (Night `#110e0b`, Daylight `#f8f5f1`; s32).

## 12. Components
Every component lives in `apps/web/app/ui/` (or `packages/notation` for notation), takes every user-facing string as a prop, has a story per state in both themes (`28` §2), and keeps its existing props when restyled (s33). Feature code composes these; it never paints its own colours, sizes or one-off components.

### 12.1 Base (shadcn/ui CLI v4 on Base UI, rewritten to tokens)
| Component (file) | Mockup class | Variants and notes |
|---|---|---|
| Button (`button.tsx`) | `.btn` | `primary` (amber fill, graphite text: `.btn.pri`), `secondary` (default; `--muted` fill, `--border-strong` edge), `ghost` (`.btn.ghost`), `quiet` (`.btn.quiet`, transparent with edge), `destructive` (`.btn.danger`: outlined in `--destructive`; `destructiveSolid` for the confirm in delete dialogs), `link`. Painted sizes `sm` 32, `md` 40, `lg` 48, `xl` 56 (Home and Library hero), `practice` 64; `block`. A painted size under its target sits inside a box padded to the target (§8: 44 browse, 48 secondary practice). Loading keeps width and shows `Spinner` after 300 ms. Hover: `--accent` fill; primary hover `brightness(1.06)` expressed as a token (`--primary-hover`, computed literal) |
| IconButton (in `button.tsx`, `size="icon"`) | `.ib`, `.ib.box`, `.ib.lg`, `.ib.on` | 40 (`.ib`, in a 44 box), 52 (`.ib.lg`, secondary practice), 64 (`practice`, main practice controls), `box` (bordered on `--card`), `on` (amber wash + `--primary-line` + `--primary-ink`; state also in the accessible name) |
| Toggle, ToggleGroup (`toggle.tsx`, `toggle-group.tsx`) | `.seg`, `.chip` | Segmented: `--card` track, `--border` edge, 3 px padding; the pressed item is a raised `--accent` capsule with a 1 px shadow and `--foreground` text (the capsule is the non-colour cue); the capsule slides on `--ease-snappy`. Chip toggles: `.chip.on` = `--primary-soft` + `--primary-line` + `--primary-ink` |
| Tabs (`tabs.tsx`) | `.tabs` | Each tab's box is 44 tall in browse screens (the mockup's 42 grows by 2) and 48 in the practice inspector (secondary practice control, §8), 14/600, selected = `--foreground` + 2 px `--signal` underline (shape cue); optional count badge (`Fix 6`) |
| Switch (`switch.tsx`) | `.toggle` | 40 × 24; off `--accent` track + `--input` edge + `--muted-foreground` knob; on `--primary` track with a 1 px `--signal` edge + `--primary-foreground` knob (state = knob position; the edge gives Daylight a ≥ 3:1 indicator, V16). The whole row (label + hint + switch) is the 44 px target |
| Checkbox, RadioGroup (`checkbox.tsx`, `radio-group.tsx`) | `.check` | 18 px, `--input` edge, checked `--signal` fill with `--primary-foreground` check |
| Slider (`slider.tsx`) | `.range` | Base UI Slider; track `--accent`, fill and thumb `--signal` (stem faders use the stem colour for the fill and a `--foreground` thumb); horizontal, vertical, range; click-to-set; always paired with steppers or a readout that opens them |
| NumberField / Stepper (`number-field.tsx`) | `.stepper` | Box 44 tall with 44 × 44 step halves in browse screens and 48 / 48 × 48 in practice (Loop tab, Fix tab, Display settings steppers); the painted well stays 40 tall with 36 px halves inside the box (V12); `--background` well, `--input` edge, mono value; units outside the value ("70 %") |
| Field, Input, Label (`field.tsx`, `input.tsx`, `label.tsx`) | `.field`, `.label` | 44 tall, `--background`, `--input` edge, focus `--ring` 2 px / 1 px offset; label 13/600 `--muted-foreground`; error text `--destructive` with an icon, linked by `aria-describedby` |
| Select, DropdownMenu, Popover, Tooltip (`select.tsx`, `dropdown-menu.tsx`, `popover*.tsx`, `tooltip*.tsx`) | `.sheet` | `--card`, `--border`, `rounded-3xl` (menus `rounded-2xl`), `--elevation-2`; tooltips show the shortcut in a `Kbd` |
| Dialog, AlertDialog (`dialog.tsx`, `alert-dialog.tsx`) | `.sheet` + `.overlay` | `rounded-4xl`, `--elevation-3`, `--scrim`; max one at a time; AlertDialog only for delete song and delete account. Add song is a Dialog on desktop and a full-screen Drawer on phones |
| Drawer (`drawer.tsx`) | `.sheet` (phone sheets) | Base UI Drawer; bottom sheets with a 40 × 5 grabber and 24 px top corners (Tools sheet 690 px of 844); side drawer for the inspector below its docking width |
| Toast (`toast.tsx`) | `.toast` | `--accent` fill, `--border-strong` edge, 14 px, `rounded-2xl`, `--elevation-2`; confirmations and Undo only; with an action it doesn't auto-dismiss; errors `role="alert"` with a `--destructive` edge |
| Badge (`badge.tsx`) | `.badge` | 22 tall, 12/650, pill; `neutral` (`--accent` + `--muted-foreground`), `primary` (`--primary-soft` + `--primary-ink`), `success`, `destructive`, `unsure` (status colour on its surface); always text, optionally an icon or `Spinner` |
| Kbd (`kbd.tsx`) | `.kbd` | Mono 12, 22 tall, `--muted` fill, `--border-strong` edge with a 2 px bottom edge |
| Card (`card.tsx`) | `.card` | `--card`, 1 px `--border`, `rounded-3xl`, no shadow; `emphasis` variant `--muted` |
| Progress, Meter (`progress.tsx`, `meter.tsx`) | `.bar` | 6 px (4 px in cards), `--accent` track, `--signal` fill; `role="progressbar"` with `aria-valuetext` naming the stage |
| Spinner (`spinner.tsx`) | `.spin` | 16 px (12 in badges), `--primary-soft` ring with a `--signal` arc; static under reduced motion (a text label always accompanies it) |
| Separator, ScrollArea, Skeleton | `.hr`, `.vr` | `--border`; skeletons `--muted` |

### 12.2 Splitune kit
Existing components are restyled with stable props (s33 unless noted); new ones are named here with the step that builds them.

| Component | State | Purpose and states (mockup) |
|---|---|---|
| `TransportButton` (`transport-button.tsx`) | restyle s33 | Main practice controls at 64 × 64 painted and hit (§8; the mockup's `.ib.lg` 52 grows to 64, V11), Play `.play` 64 (72 phone, 84 `xl`); secondary transport controls (click, mix pill) 52 painted in a 52 box (≥ 48); pressed, disabled, on (`.ib.on`); label shown in Stand view |
| `SpeedControl`, `SpeedPanel` (`speed-control.tsx`, `speed-panel.tsx`) | restyle s33, ladder s37 | `−` [ "75 %" / "72 BPM · → 100" ] `+`: boxed −/+ at 64 (main practice controls; mockup 52, V11), a quiet 64 px tall readout (mono 22) that opens the panel (slider 25–110 %, presets 50 · 60 · 70 · 75 · 80 · 90 · 100; phone 50 · 75 · 85 · 100). `,`/`.` keys; Shift 1 % |
| `LoopBadge` → loop pill (`loop-badge.tsx`) | restyle s35 | 64 px tall pill (main practice control; mockup 52, V11): off "No loop" / "tap two bars, or a section"; armed; active `--primary-soft` + `--primary-line` "Loop · bars 25–28" / "pass 2 · rest 1 beat"; on notation, the bracket badge "Loop · bars 25–28 · pass 2 of 2 at 75 %" |
| `PassControl` → pass prompt (`pass-control.tsx`) | restyle s35 | Floating `.sheet` at the canvas bottom: "Pass {n} at {speed} — how was it?" + **Felt clean** (primary, check icon, `Kbd` C) + Not yet (`Kbd` N), both 64 tall (mockup 40, V11); phone: a card above the transport with two 64 px buttons (mockup 48, V11); Stand view: the dock's hold-pedal buttons |
| `ChordChip`, `ChordSymbol` (`chord-chip.tsx`) | restyle s35 | `.chip` (30, pill) for "Then" chords and alternatives; unsure dashed `--unsure` + "?"; real ♯/♭, raised quality, slash bass (as built) |
| `ConfidenceLegend`, `ConfidenceLegendPanel` | restyle s35 | Dashed chip "? Auto-transcribed · {n} unsure" + popover (§5) |
| `StemRow` (`stem-row.tsx`) | restyle s35, all stems s40b | Grid: 6 × 34 colour rule, name, "Your part"/"Rough" badges, M/S (`.ms` painted 32 inside a 48 × 48 box, on = amber fill + filled vs outlined), fader (stem-colour fill) and dB readout (mono 13); muted reads "muted" |
| `MixPresetGroup` (`mix-preset-group.tsx`) | restyle s35 | 2 × 2 radio cards: name (14/650) + gloss ("Learn it: guitar up, band down"); checked = `--primary-soft` + 1 px inset `--signal` + `--primary-ink` name; phone: chips |
| `WaveformTimeline` → `SongMap` (`waveform-timeline.tsx`) | restyle s35, sections s41b | Section chips row (`.sec` painted 22 inside a 24 px box with min width 24 on fine pointers, 48 on coarse; flex-grow by bar count; on = amber wash), 40 px map: waveform bars (`--waveform-*`), unsure hatch band, loop band with 2 px `--loop-edge` handles (keyboard-nudgeable, ≥ 44 px hit area), now-line; 14 px mono ruler |
| `PedalHud` (`pedal-hud.tsx`) | restyle s35 | Toast-style chip at the notation's top right: icon + "{source} · {action}" ("Left pedal · From the top of the loop"); `--hud-bg` / `--hud-fg`; ≤ 100 ms; `aria-live="polite"`; 1.2 s |
| `StageList` (`stage-list.tsx`) | restyle s34/s35 | Ordered list: 22 px status dot (done `--success` + check, running `Spinner` on `--primary-soft`, waiting `--input` ring), name (600), detail line (artefact), status ("Done", "62 % · ~2 min", "Waiting"); overall `Progress` with ETA |
| `SongCard` / `SongRow` (`song-card.tsx`) | restyle s34 | Card: stem tile (40, `rounded-lg`, letters `--tile-foreground`), title (16/650), meta line, 28 px waveform preview, status badge + meta, progress line while analysing; row (phone): tile, title, meta, badge, 60 px min height |
| `AllowanceMeter` (`allowance-meter.tsx`) | restyle s34 | 150 px: "3 of 5 Lite left · resets 1 Dec" (13, faint) over a 4 px bar; in the app bar from `lg` |
| `EmptyState` (`empty-state.tsx`) | restyle s34 | Dashed drop-style panel: icon, h3, one sentence, primary + secondary |
| `StatusMessage` / banners (`status-message.tsx`) | restyle s36 | Card-style banner: icon + text + optional action (`btn sm`); `role="status"`; dismissible only if non-blocking |
| `WorkerStatus` (`worker-status.tsx`) | restyle s34 | Banner "Processing machine offline. Your song is queued and starts automatically." |
| `ChoiceCard`, `RadioCard` (`choice-card.tsx`, `radio-card.tsx`) | restyle s34/s36 | `.card` radio: checked = `--signal` 1 px border + inset 1 px `--signal` (+ `--primary-soft` fill where the mockup has it); appearance cards hold a themed miniature |
| `StepDots` (`step-dots.tsx`) | restyle s36 | 8 px dots, current a 22 × 8 pill; done and current `--signal`, upcoming `--input`; "Step 3 of 5" text |
| `CoachMark`, `DropZone`, `WaveformPreview`, `SaveStatus`, `Brand` | restyle s33–s36 | As before, on the new tokens; `SaveStatus` shows the "Saved on this device" success badge |
| `AppBar` (`features/shell`) | new s34 | 64 px: brand, Library/Settings nav links (`.navlink`, current `--muted` fill), search button "Search songs, clips and actions" + `Kbd` "Ctrl K"/"⌘ K", allowance, **Add song** (primary), account avatar (40, circle) |
| `CommandPalette` | new s34 (lazy) | `Dialog` (`.sheet` styling, `rounded-4xl`) with a 52 px search field (17 px) + `Kbd` Esc; groups Songs / Clips / Actions; rows with tile, matched text bold, context in faint, `Kbd` hints; ↑/↓ + Enter |
| `ContinueCard`, `WeekStrip`, `RevisitList` | new s34 (layout) / s39 (data) | Library's "Pick up where you left off" card (gradient `--muted` → `--card`, 30-day sparkline, primary `xl` Resume), "This week" 7 day dots (filled `--signal`, opacity by minutes ≥ 0.45; outlined `--input` for none) + three stats, "Worth a revisit" rows |
| `BottomNav` | new s34 | Phone: Library · **Add song** (48 px primary pill) · Settings, 76 px |
| `NowColumn` | new s35 | Eyebrow, current chord (`--read-chord-current`) + `ChordShape` (84 × 110; mirrored for left-handed), `BeatPulse`, next chord + "in n beats" + bar, "Then" chips, Level/Capo rows |
| `BeatPulse` | new s35 (static), s42 (pulse) | 4 dots (meter-aware): downbeat square, others round; done `--beat-done`, now `--beat-now` + glow, upcoming `--beat-slot` outline; sizes 14 / 20 / 22 / 26; `aria-label` "Beat 3 of 4" |
| `InspectorTabs` | new s35 | Tabs Loop / Mix / Progress / Fix (+ unsure count badge), panel 380 docked or in a drawer |
| `SpeedLadder` | new s37 | `.ladder`: 70 px rungs (flex, heights rising to the goal), done = amber fill with a 1 px `--signal` edge + graphite label (the edge separates done from upcoming by ≥ 3:1 in Daylight, V16), current = `--primary-soft` + 2 px inset `--signal`, upcoming `--accent`; summary line; parameter chips; `aria-label` "70 and 75 percent done, 80 percent next" |
| `ClipList` | restyle s35, rename/delete s37 | Rows: dot (amber = active clip), name, "bars 25–28 · best 80 %" (mono faint), More menu (Rename, Delete) |
| `FixQueue`, `AlternativeRow`, `EditHistory` | new s38 | Spot header "Spot 2 of 6 · bar 27–28" + `--unsure` progress + prev/next; chord and note cards; alternatives with frequency text, "Hear over the loop", Use; "Your edits" with Revert |
| `ProgressChart`, `StatCard`, `SessionList` | new s39 (lazy) | 30-day chart (best clean pass solid `--signal`, first clean pass "cold" dashed `--muted-foreground`, text alternative), three stat cards (mono 20), session rows |
| `ToolsSheet` | new s43 (lazy) | Phone sheet: Speed (−/+ at 64, mockup 52; mono 30 readout, 4 preset chips, ladder card), Count-in / Click / Vibrate tiles (76 tall, pressed = amber wash), Mix (preset chips, two channel rows with M painted 44 in a 48 box), Level / Capo buttons; every control has steps, no drag |
| `StandView` | new s43 | Header (back, title, loop badge, "Pedal connected" badge, speed readout 28, Display), Now panel 400 (chord 200 + shape, beats 26, next 100), one tab system, "Page 7 of 46 · turns on the downbeat of bar 28", dock of four 88 px buttons with pedal hints |
| `PedalWizard` | new s43 | Card with `--primary-line` edge: "Pedal setup · step n of 3", h2, captured-key badges ("Left · ↑", spinner "Right · waiting"), Start over / I only have one pedal, the three presets, two-pedal illustration |
| `NotifyButton` | new s44 (lazy) | Secondary button with a bell: "Notify me when it's ready"; only where `PushManager` and `Notification` exist; permission asked on click |
| `AlphaTabView` overlay (`packages/notation`) | restyle s35 | Confidence marks (§5), loop wash and bracket, current-bar wash, sounding-note fill, playhead layer, bar/note buttons |
| `PianoRoll`, `KeyboardDiagram`, `GuitarRoll`, `FretboardDiagram`, `MelodyRoll`, `DrumGrid`, `ChordDiagram` (`packages/notation`) | restyle s35 | Read the §4.7 tokens through `readColor`; roll on `--card` with `rounded-xl` top; behaviour unchanged (§10 motion rules) |

### 12.3 State matrix (every interactive component, both themes, both contrast levels)
`default · hover (fine pointers only) · pressed · focus-visible · selected / on · disabled · loading · error`, each a Storybook story (`28` §2). Disabled controls use muted fills with a ≥ 3:1 boundary and "Unavailable" in the accessible name, never 50 % opacity (the mockups' 0.55–0.6 opacity on disabled buttons becomes `--muted` fill + `--faint-foreground` text). Non-colour cue per state:

| Component | On/selected cue besides colour |
|---|---|
| Tabs | 2 px underline |
| Segmented | Raised capsule with shadow |
| Chip | `--primary-line` edge (≥ 3:1) |
| Switch | Knob position, plus the track's `--signal` edge |
| M/S | Filled vs outlined, and "muted"/"solo" in the dB readout and accessible name |
| Radio card | 1 px inset ring + 1 px border (2 px edge) |
| Icon button on | Bordered wash + accessible name "…, on" |
| Beat dot now | Filled vs outlined, plus glow |
| Speed-ladder rung | Done: filled with a `--signal` edge; current: 2 px inset ring; upcoming: plain |
| Sounding digit | Filled box |

## 13. Feedback patterns
| Situation | Pattern |
|---|---|
| Content with a known layout loading | Skeleton matching the final layout; no spinner |
| Short action (< 2 s) | Button loading state (spinner after 300 ms) |
| Long job (upload, analysis) | Determinate progress + named stages with their artefacts + a padded range ETA ("about 3–5 min") that changes only when a stage finishes and never sits at 99 %; a polite live region already in the DOM announces stage milestones only |
| Validation | Inline under the field, `aria-describedby`, on blur/submit |
| Load failure | In place, with Retry; cached content stays |
| Reversible change (rename, loop edit, fix) | Optimistic, Undo toast ("Edit saved · bar 31, string 3 → fret 2"); on server refusal roll back with the error toast |
| Irreversible change | AlertDialog naming the object ("Delete “Night Market”?") |
| Key or pedal action in practice | PedalHud within 100 ms; focus stays on the practice focus sink; pedal keys never scroll or activate the focused control |
| Background completion | Toast if on the page, tab-title update and app badge; Web Push only if the learner asked ("Notify me when it's ready", s44) |
| Blocking failure | `role="alert"` only for errors that block the goal |

## Open questions
- G5 (owner, music-stand test): which theme reads best at 0.5 / 0.75 / 1.5 m; may make Daylight the default for Practice and Stand view (subtree theming supports it), and may raise the §6.3 sizes (never lower them below the floors).
- s32 gate: Instrument Sans / JetBrains Mono glyph coverage, `tnum` and the 1/7, 3/8, 6/0 legibility check; Inter 4 is the fallback.
- Calibration check C1 (§5): which stages pass; until then every stage keeps its marks.
- The Floor preset has no mockup; its values follow the §6.3 floors and rationale.

## Sources
- `redesign/report.md` (direction, OKLCH roles from four parameters, type, motion, targets, WCAG 2.2 mapping), `redesign/research/visual_direction.md`, `redesign/research/practice_science_ergonomics.md`, `redesign/research/ai_confidence_processing_ux.md`, `redesign/research/design_system_migration.md`; mockups `redesign/mockups/System.dc.html` (Foundations), `Dir-A/B/C.dc.html` and `splitune.css` — 2026-11-08.
- Contrast, gamut and CVD values computed in step s31a with `colorjs.io` 0.7.1 (the token tests' library) and the Machado, Oliveira & Fernandes 2009 matrices used by `palette.test.ts`.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) (1.4.1, 1.4.3, 1.4.11, 2.1.4, 2.2.2, 2.3.1, 2.4.11, 2.4.13, 2.5.5, 2.5.7, 2.5.8) — tier 1.
- [Radix Colors scale roles](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale), [Paul Tol's palettes](https://tesselle.r-universe.dev/khroma/doc/tol.html), Okabe-Ito ([ggokabeito](https://malcolmbarrett.r-universe.dev/ggokabeito/doc/manual.html)) — tier 2.
- [Instrument Sans](https://github.com/Instrument/instrument-sans), [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono), [Atkinson Hyperlegible Next](https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegiblenext), [SMuFL chord symbols](https://smufl.formats.music/latest/tables/chord-symbols.html), [Lucide](https://lucide.dev) — tier 2.
- [MDN getOutputTimestamp](https://developer.mozilla.org/docs/Web/API/AudioContext/getOutputTimestamp), [alphaTab coloring](https://www.alphatab.net/docs/guides/coloring), [core.includeNoteBounds](https://www.alphatab.net/docs/reference/settings/core/includenotebounds) — tier 1.
- Cross-linked: `research/ux/accessibility.md`, `research/ux/hands-busy-and-device-context.md`, `research/ux/music-display-ui.md`.
