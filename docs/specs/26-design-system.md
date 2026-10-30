---
title: Design system and visual language
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# Design system and visual language

The single visual direction for Splitune and the system that implements it: theme model, tokens, colour, confidence encoding, typography and reading sizes, layout, targets, shape, motion, icons and the component inventory. It replaces the one-paragraph design-system note in `10-web-app-architecture.md` §7. Screens, flows and copy are in `27-screens-flows-and-content.md`; the quality workflow (Storybook, visual regression, design QA) is in `28-ui-quality-and-design-review.md`. A static visual reference built from these tokens lives at `docs/specs/assets/design/reference.html` (illustrative; the tokens in `packages/ui-tokens` are binding).

> **Personal mode (`25-personal-mode.md`):** no paid design tooling. The design source of truth is code — `packages/ui-tokens` plus Storybook — not a Figma file. Fonts and icons are open-licence and self-hosted.

## TL;DR
- **Direction: "Music Stand".** Notation sits on a **paper surface** (dark ink on warm off-white) inside **quiet graphite chrome**, with **one accent — indigo ink** — reserved for interaction, focus and the loop. It borrows DAW conventions (loop band in the ruler, stem rows with M/S) and drops edtech gamification. Chosen over "studio dark", "gamified bright" and "dark media" (§1).
- **Four appearances:** *System* (default; follows `prefers-color-scheme`), *Light*, *Dark* and *Stage* (dim rooms). The score stays paper in Light and Dark (positive polarity reads small detail better); only Stage inverts it, and Stage also enlarges reading sizes one step.
- **Tokens in three tiers** (OKLCH primitives → semantic roles using shadcn names + Splitune roles → a few component tokens), hand-authored CSS in `packages/ui-tokens`, mapped to Tailwind v4 with `@theme inline`. Every text/UI pair is contrast-tested in every theme (every checked pair passes, §4.6).
- **Confidence is never hue:** three ordinal levels encoded by ink value + dashed outline + "?" glyph, identical on notation, chord chips, timeline and badges, always ≥4.5:1 (§5). This fixes doc 12's opacity rule, which dropped low-confidence digits below 3:1.
- **Type:** Inter 4.1 Variable (self-hosted, own subset so `tnum`/`cv`/`ss` features survive) for everything; Atkinson Hyperlegible Next as an opt-in "Hyperlegible" reading font; Bravura for standard notation. **Reading sizes are set by distance presets** (Desk 0.5 m / Stand 0.75 m / Floor 1.5 m) derived from 16–22 arcminute character-height guidance, plus a user calibration (§6).
- **Targets in CSS px** (doc 10/12 said "pt"): practice primary 64, practice secondary 48, elsewhere 44, never below 24 (§8).
- **Motion is quiet:** 100/200/300 ms, one standard easing; reduced motion swaps movement for fades and scroll for page-flip; flashes hard-capped at 3/s (§10).
- **Icons:** `lucide-react` 1.x, 2 px stroke; a handful of custom music icons drawn on the same grid (§11).

## 1. Design direction
### 1.1 Candidates considered
Four directions came out of the competitor audit (Soundslice, Songsterr, Guitar Pro, Moises, LALAL.AI, Ultimate Guitar, Yousician, Simply Piano, Melodics, flowkey, Fender Play, Capo, Transcribe!, Logic for iPad, Ableton). Scored 1–5 against Splitune's needs (higher is better):

| Criterion (weight) | A. Studio dark (Moises, LALAL, Logic) | B. Gamified bright (Yousician, Simply Piano) | C. **Music Stand**: paper score + quiet chrome (Soundslice, Songsterr, forScore-style dim) | D. Dark media (flowkey, Spotify) |
|---|---|---|---|---|
| Legibility of small notation at 0.5–1.5 m (×3) | 2 — negative polarity loses on small detail, worst at night | 3 | **5** — positive polarity, largest advantage for small text | 2 |
| Honest confidence display (×2) | 3 | 1 — scores/stars read as verdicts | **5** — ink value + dashes read naturally on paper | 3 |
| Calm, adult, non-manipulative (×2) | 4 | 1 — reviewers call it childish over time | **5** | 4 |
| Data density: loops, mixer, waveform (×2) | **5** | 2 | 4 — DAW conventions on graphite chrome | 2 |
| Dim-room comfort (×1) | **5** | 2 | 4 — via the Stage appearance | **5** |
| Familiar to tab/notation users (×1) | 2 | 2 | **5** — every notation-first app defaults to light | 2 |
| **Weighted total (max 55)** | 37 | 20 | **52** | 31 |

**Decision: C, "Music Stand".** Evidence: positive-polarity advantage for acuity and proofreading in younger and older adults, growing as text gets smaller (Piepenbrock et al. 2013); night lighting made small text much harder to read in dark mode (Dobres et al. 2017, via NN/g); notation-first apps keep the score light and make dark opt-in (Soundslice); reviewers punish gamified edtech and upsell clutter. Stage covers A's and D's one real advantage, the dim room.

### 1.2 Principles (use them to settle design arguments)
1. **The music is the brightest thing on screen.** Chrome is quiet graphite; the score is paper; colour is spent on meaning (stems, interaction), never decoration.
2. **Readable from the stand.** Size for the reading distance, not the designer's monitor (§6). If it can't be read at 0.75 m, it doesn't belong in practice mode.
3. **Honest, not authoritative.** Machine output always looks like a draft where it is uncertain, and is one tap from being fixed.
4. **Hands are busy.** Big targets at a consistent edge, every action on a key, visible feedback for pedal presses.
5. **Calm coach.** Show competence evidence (tempo reached at a clean pass); no streak pressure, no guilt, no confetti.
6. **One accent, one job.** Indigo ink means "you can act here" (primary actions, focus, selection, the loop). Nothing else is indigo.

### 1.3 Character
| Element | Expression |
|---|---|
| Surfaces | Warm paper (`#fdfcf7`) for music; warm graphite neutrals (hue 75–88, chroma ≤0.012) for chrome |
| Accent | Indigo ink — light `#4943c1`, dark `#98a2fc`; hue 278 is clear of every Okabe-Ito stem hue |
| Lines | Hairline borders (1 px) over shadows; shadows only for floating layers |
| Shape | Medium rounding (10 px base), pill shapes only for chips and toggles |
| Type | One family (Inter), tight but not cramped; tabular figures for anything live |
| Imagery | No stock photos or illustrations of people; product screenshots and the waveform itself are the imagery |

## 2. Appearance (theme) model
| Appearance | When | Chrome | Score surface | Reading sizes |
|---|---|---|---|---|
| **System** (default) | Follows `prefers-color-scheme` | Light or Dark | Paper | Preset |
| **Light** | User choice | Light graphite | Paper | Preset |
| **Dark** | User choice | Graphite `#181612` (never pure black) | **Paper (dimmed `#eae8e2`)** — a lit sheet on a dark stand | Preset |
| **Stage** | User choice for dim rooms and gigs; offered on the first practice session after 20:00 local time ("Practising in the dark? Try Stage") | Near-black `#0d0b08` | Dark score, off-white ink (`#e2ddd5`, not `#fff`) | Preset **+1 step** (×1.25) |

- **Score surface override:** Settings → Display → "Score: paper / match appearance". Default paper; "match appearance" in Dark uses the Stage score colours without the size step.
- **Contrast:** `prefers-contrast: more` or Settings → "Increase contrast" sets `data-contrast="more"`: muted text and borders darken/lighten one step, translucent fills become opaque, focus outline 3 px.
- **Forced colours** (Windows High Contrast): semantic tokens yield to system colours; focus uses `outline` (box-shadow is dropped in forced-colours mode); canvas layers (waveform, meters) use `CanvasText`/`Highlight` via `forced-color-adjust: none` only where they draw their own accessible colours.
- **Implementation:** `<html data-appearance="light|dark|stage" class="dark?" data-contrast="more?">`. `.dark` is set for Dark and Stage so shadcn's `dark:` utilities keep working; token selection uses `data-appearance`. A tiny inline `<head>` script resolves the stored choice + `matchMedia` before first paint (no flash) and sets `color-scheme`; without JS the `prefers-color-scheme` media block applies. The choice is per device (Zustand + `localStorage`, like other display prefs in doc 10 §3).
- No ambient-light auto-switching: `AmbientLightSensor` is not Baseline and absent in WebKit.

## 3. Token architecture
```
packages/ui-tokens/
  src/primitives.css     # OKLCH ramps: --gray-1…12, --indigo-1…12, status and stem bases (never used by components)
  src/themes.css         # semantic roles per [data-appearance] / [data-contrast] / @media fallbacks
  src/theme.tailwind.css # @theme (static scales) + @theme inline (semantic → Tailwind colour names)
  src/fonts.css          # @font-face for the self-hosted families (files in apps/web/public/fonts)
  src/index.ts           # typed token names, categorical/confidence metadata, readToken() for canvas/alphaTab
  src/*.test.ts          # contrast, gamut, CVD separation and naming tests (28 §3)
```
- **Tier 1 — primitives:** 12-step OKLCH ramps (Radix-style roles: 1–2 backgrounds, 3–5 fills, 6–8 borders, 9–10 solids, 11–12 text). Not exposed to Tailwind (`--color-*: initial` clears the default palette), so a component can never write `bg-gray-4`.
- **Tier 2 — semantic roles:** shadcn's names (`--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--chart-1…5`, `--sidebar-*`, each with `-foreground` where it applies) plus Splitune roles: `--success`, `--warning`, `--info`, `--paper`, `--ink`, `--conf-medium`, `--conf-low`, `--stem-{guitar,bass,drums,vocals,keys,other,mix}`.
- **Tier 3 — component tokens (only where a component needs one):** chrome/timeline `--loop-fill`, `--loop-edge`, `--playhead`; score-surface `--score-loop-fill`, `--score-loop-edge`, `--score-playhead`, `--staff` (separate because the score stays paper in Dark); `--waveform-peak`, `--waveform-rms`, `--waveform-played`, `--bar-current`, `--hud-bg`, `--hud-fg`.
- **Static scales** in `@theme`: spacing (`--spacing: 0.25rem`), radius, font families, type steps, durations, easings, target sizes, z-index layers.
- **JS consumers** (waveform canvas, alphaTab `display.resources`, meters) call `readToken('--stem-bass')` (reads computed style) and re-read on appearance change; they never hard-code colours.
- **Rule:** no raw colour literals (`#…`, `rgb(`, `oklch(`) outside `packages/ui-tokens` — enforced by `scripts/check-ui-tokens.mjs` in `pnpm lint`, the same pattern as `check-db-access.mjs`.
- **Floor-safe CSS only:** `oklch()` and `color-mix()` (Safari 16.2+, Chrome 111+, Firefox 113+). No `light-dark()` (Safari 17.5) or relative colour syntax (full support Safari 18) — both are above the Safari 16.4 floor (`24-browser-compatibility.md`).

## 4. Colour
### 4.1 Neutrals and surfaces
| Role | Light | Dark | Stage |
|---|---|---|---|
| `--background` (app canvas) | `oklch(0.972 0.005 85)` `#f7f6f2` | `oklch(0.2 0.008 75)` `#181612` | `oklch(0.15 0.006 75)` `#0d0b08` |
| `--card` / `--popover` | `oklch(0.995 0.003 85)` `#fefdfb` | `oklch(0.235 0.008 75)` `#201e1a` | `oklch(0.175 0.006 75)` `#12100e` |
| `--muted` (wells, inactive fills) | `oklch(0.94 0.006 85)` `#edebe7` | `oklch(0.27 0.008 75)` `#292622` | `oklch(0.2 0.006 75)` `#181613` |
| `--border` (decorative hairlines) | `oklch(0.885 0.008 85)` `#dbd9d3` | `oklch(0.33 0.008 75)` `#383531` | `oklch(0.29 0.006 75)` `#2d2b28` |
| `--input` (field/control boundaries, 3:1) | `oklch(0.62 0.01 80)` `#898680` | `oklch(0.56 0.01 80)` `#78746e` | `oklch(0.52 0.008 80)` `#6b6864` |
| `--foreground` | `oklch(0.2 0.012 75)` `#191510` | `oklch(0.94 0.006 85)` `#edebe7` | `oklch(0.9 0.012 80)` `#e2ddd5` |
| `--muted-foreground` | `oklch(0.47 0.012 75)` `#5f5a54` | `oklch(0.72 0.01 85)` `#a7a49e` | `oklch(0.74 0.01 80)` `#aeaaa4` |
| `--paper` (score surface) | `oklch(0.99 0.006 88)` `#fdfcf7` | `oklch(0.93 0.008 88)` `#eae8e2` | `oklch(0.165 0.006 75)` `#100e0b` |
| `--ink` (notation) | `oklch(0.18 0.01 75)` `#14110d` | same as Light | `oklch(0.9 0.012 80)` `#e2ddd5` |

Dark elevation is expressed by lightness (background → card → muted rise ≈0.035 L each), not shadows.

### 4.2 Accent and interaction
| Role | Light | Dark | Stage |
|---|---|---|---|
| `--primary` / `--ring` / `--loop-edge` | `oklch(0.47 0.19 278)` `#4943c1` | `oklch(0.74 0.13 278)` `#98a2fc` | `oklch(0.72 0.1 278)` `#969ee3` |
| `--primary-foreground` | `#f9fafe` | `#0e0f23` | `#080a18` |
| `--accent` (selected rows, hover wells) | `oklch(0.94 0.025 278)` `#e7eafc` | `oklch(0.3 0.06 278)` `#272a4b` | `oklch(0.26 0.05 278)` `#1e213c` |
| `--accent-foreground` | `#302b89` | `#c7cef9` | `#c1c7f2` |
| `--loop-fill` (timeline, chrome) | `#dee3fd` | `#272a4b` | `#21243f` |
| `--playhead` (timeline now-line) | `oklch(0.55 0.2 27)` `#cc2827` (5.3:1 on card) | `#f27166` (5.8:1) | `oklch(0.68 0.14 27)` `#e27368` |
| `--score-loop-fill` (on the score) | `oklch(0.92 0.036 278)` `#dee3fd` | `#c9cff2` (score is paper) | `#21243f` |
| `--score-loop-edge` | `#4943c1` | `#4943c1` | `#969ee3` |
| `--score-playhead` | `#cc2827` | `#cc2827` | `#e27368` |
| `--staff` (staff and tab lines; graphics needed to read the tab, so ≥3:1 on paper and on the loop band, WCAG 1.4.11) | `#83807a` (3.8 / 3.1) | `#78746e` (3.8 / 3.0) | `#77746f` (4.1 / 3.3) |

`--secondary` = `--muted` with `--foreground` text (shadcn's quiet button). In Dark the score stays paper, so the `--score-*` tokens keep Light values while the timeline (on `--card`) uses the Dark chrome values. Digits over a loop band knock out the staff line with `--score-loop-fill`, not `--paper`.

### 4.3 Status
| Role | Light | Dark | Stage | Always paired with |
|---|---|---|---|---|
| `--destructive` | `#be2323` | `#f27166` | `#dd766c` | Verb label ("Delete song"), icon |
| `--success` | `#0b7643` | `#5ec386` | `#6fb789` | Check icon + text |
| `--warning` | `#985b0b` | `#ebb25f` | `#ddae6c` | Triangle icon + text |
| `--info` | `#0e6a9b` | `#6db3e4` | `#75acd2` | Info icon + text |

Status colours appear as text, icon and a 1 px border or a `--muted`-tinted well; never as large saturated fills.

### 4.4 Categorical: stems, strings, hands
Okabe-Ito hues, fixed per instrument everywhere (mixer row, waveform lane, legend, chart). Light uses darkened tones so every mark reaches 3:1 on `--card`; Dark uses the original Okabe-Ito values for guitar, bass and drums; Stage desaturates for glare.

**Step 10a change:** the first palette failed the CVD test (`28` §3: every pair ≥12 ΔE2000 under simulated protanopia, deuteranopia and tritanopia) — orange/vermillion fell to 5.1 for deuteranopes and bass/other to 5.0–5.9 in every appearance. Each colour was moved the smallest distance (summed ΔE2000 from the original) that passes in every appearance × contrast context, keeping the Okabe-Ito hue families; "other" also had to clear the stronger `--muted-foreground` used by `--stem-mix` under increased contrast. Values below are the OKLCH primitives in `packages/ui-tokens/src/primitives.css` (hex for reference).

| Token | Instrument | Light | Dark | Stage | Second cue |
|---|---|---|---|---|---|
| `--stem-guitar` | Guitar | `oklch(0.656 0.135 68)` `#c67f1d` | `#e69f03` (Okabe `#e69f00`, gamut-rounded) | `oklch(0.763 0.117 69)` `#e2a45a` | Label + guitar icon |
| `--stem-bass` | Bass | `oklch(0.489 0.162 256)` `#085db9` | `#56b4e9` | `oklch(0.719 0.102 235)` `#5eaedb` | Label + icon |
| `--stem-drums` | Drums | `oklch(0.539 0.167 40)` `#ba4004` | `#d55e01` (Okabe `#d55e00`) | `oklch(0.627 0.143 42)` `#ce663c` | Label + icon |
| `--stem-vocals` | Vocals | `oklch(0.556 0.119 348)` `#a5547f` | `oklch(0.661 0.112 343)` `#c276a5` | `oklch(0.658 0.094 344)` `#ba7aa0` | Label + mic icon |
| `--stem-keys` | Piano/keys | `oklch(0.554 0.085 140)` `#577f4f` | `oklch(0.607 0.128 164)` `#079a6d` | `oklch(0.621 0.084 158)` `#589673` | Label + piano icon |
| `--stem-other` | Other | `oklch(0.587 0.113 229)` `#0e88b2` | `oklch(0.86 0.04 235)` `#b9d6e8` | `oklch(0.84 0.05 225)` `#a8d2e3` | Label |
| `--stem-mix` | Full mix / backing | `--muted-foreground` | same | same | Label |

- "My part" is never a colour: it gets a **"Your part"** tag, a 2 px left rule and is listed first.
- Hands (V4): left = `--stem-bass` hue + "L", right = `--stem-guitar` hue + "R". Strings in fretboard diagrams use string numbers, not colour.
- `--chart-1…5` map to guitar, bass, drums, vocals, keys so shadcn charts inherit the same meaning.
- Okabe-Ito yellow is not used (1.3:1 on white).

### 4.5 Usage rules
- Indigo only for: primary buttons, links, selected state, focus ring, slider/active track, loop band and handles. Not for headings, icons at rest or illustrations.
- Red only for destructive actions, errors and the playhead (a thin line whose meaning is position, not alarm).
- At most one primary (filled indigo) button per view region.
- Surfaces nest at most three levels (background → card → muted well).

### 4.6 Verified contrast (WCAG 2.2, computed 2026-10-20 from the OKLCH values, after sRGB gamut check)
| Pair | Light | Dark | Stage | Min |
|---|---|---|---|---|
| foreground / background | 16.7 | 15.2 | 14.6 | 7 (target AAA for body text) |
| muted-foreground / card | 6.7 | 6.7 | 8.2 | 4.5 |
| primary-foreground / primary | 7.0 | 8.0 | 7.8 | 4.5 |
| ring / background | 6.8 | 7.7 | 7.8 | 3 |
| input / card | 3.6 | 3.6 | 3.4 | 3 |
| destructive · success · warning · info / card | 6.0 · 5.6 · 5.4 · 5.8 | 5.8 · 7.6 · 8.8 · 7.3 | 6.2 · 8.0 · 9.4 · 7.7 | 4.5 |
| ink / paper | 18.3 | 15.3 | 14.3 | 7 |
| conf-medium · conf-low / paper | 10.6 · 6.9 | 8.9 · 6.1 | 9.6 · 7.2 | 4.5 |
| loop-edge · playhead / paper | 7.1 · 5.2 | 6.0 · 4.4 | 7.6 · 6.3 | 3 |
| staff / paper · staff / score-loop-fill | 3.8 · 3.1 | 3.8 · 3.0 | 4.1 · 3.3 | 3 |
| lowest stem / card | 3.2 (guitar) | 4.3 (drums) | 5.1 (drums) | 3 |

These numbers are the acceptance baseline for the token tests (`28` §3); APCA is logged as information only (WCAG 3 is a Working Draft; APCA is not a requirement). `packages/ui-tokens/src/contrast.test.ts` checks this table (±0.1) plus every pair in `CONTRAST_PAIRS` (each `*-foreground` on its surface, digits on the loop band and current bar, timeline marks) in all six appearance × contrast contexts.

### 4.7 Values added in step 10a (not specified above)
| Token | Light | Dark | Stage | Notes |
|---|---|---|---|---|
| `--conf-medium` | `oklch(0.36 0.01 74)` `#403c37` | same (paper) | `oklch(0.78 0.011 82)` `#bbb7b0` | From `specs/assets/design/reference.html`; matches §4.6 ratios |
| `--conf-low` | `oklch(0.46 0.012 73)` `#5c5751` | `oklch(0.45 0.012 73)` `#59544e` | `oklch(0.7 0.01 78)` `#a29e98` | " |
| `--bar-current` (score wash) | `oklch(0.955 0.03 90)` `#f8f0da` | `oklch(0.895 0.03 90)` `#e4dcc6` | `oklch(0.215 0.02 80)` `#1e180f` | Ink ≥7, conf-low ≥4.5, staff ≥3 on it |
| `--waveform-peak` / `-rms` / `-played` | `--input` / `--muted-foreground` / `--foreground` | same | same | Neutral lane; stem lanes use `--stem-*` |
| `--hud-bg` / `--hud-fg` | `--foreground` at 82 % / `--background` | `--foreground` at 90 % / `--background` | `--border` at 94 % / `--foreground` | Stage HUD stays dark (no bright flash in a dim room); opaque under increased contrast |
| `--elevation-1…3` | the §9 shadows | black drop shadow + 1 px top highlight (§9) | same, highlight at 4 % | Mapped to `shadow-1…3` |

- **Increased contrast** (`data-contrast="more"` or `prefers-contrast: more` without a stored choice): `--muted-foreground` / `--border` / `--input` move one ramp step (Light `#443f39` / `#c0bdb7` / `#6c6862`; Dark `#c6c4be` / `#504d48` / `#8f8c85`; Stage `#c8c3bc` / `#44423e` / `#83807a`), `--hud-bg` becomes opaque, `--focus-width` 2 → 3 px.
- **Primitives:** 12-step `--gray-*`, `--gray-dark-*`, `--gray-stage-*`, `--indigo-*`, `--indigo-dark-*`, `--indigo-stage-*` ramps, plus paper/ink, status and stem bases. Semantic roles point at primitives; component tokens point at a semantic role or carry their own tuned literal (never a ramp step, so retuning a ramp can't move a contrast-checked score colour) — enforced by `tokens.test.ts`.
- **No-JS fallback:** the Dark block is repeated inside `@media (prefers-color-scheme: dark) { :root:not([data-appearance]) }` (kept identical by a test); `:root:not([data-contrast])` does the same for `prefers-contrast`. The appearance script always writes both attributes, so a stored choice beats the OS.

### 4.8 Surfaces and status tints (added with the "Music Stand, amplified" refresh)
Additive roles built from existing ramp steps and 12 literal tint primitives; no existing primitive or role was re-valued, so every §4.6 baseline still holds. All are defined in Light, Dark (and its `prefers-color-scheme` copy) and Stage, listed in `SEMANTIC_ROLES`, and map to utilities as `bg-surface-raised` and so on.

| Role | Light | Dark | Stage | Use |
|---|---|---|---|---|
| `--surface-raised` | `--gray-1` | `--gray-dark-3` | `--gray-stage-3` | Cards and panels above `--background`; inputs |
| `--surface-sunken` | `--gray-3` | `--gray-dark-2` | `--gray-stage-2` | Wells: transport tray, speed capsule, filter bar, segmented-control track |
| `--success-surface` · `--warning-surface` · `--info-surface` · `--destructive-surface` | `--{green,amber,blue,red}-tint-light` | `…-tint-dark` | `…-tint-stage` | Status messages and chips |

Dark has no ramp step darker than `--background`, so Dark and Stage "sunken" is a fill that reads as a well inside raised panels (as in iOS segmented tracks), not a recess below the page. The tints are literal OKLCH primitives at each status hue: Light `oklch(L 0.03 H)` with L 0.94 (red, blue), 0.95 (amber), 0.96 (green); Dark `oklch(0.3 0.05 H)`; Stage `oklch(0.24 0.04 H)`. The Light L values are the highest that stay inside sRGB at that chroma.

`--scrim` is a component token (a translucent literal, like `--hud-bg`): Light `oklch(0.2 0.01 75 / 0.4)`, Dark and Stage `oklch(0 0 0 / 0.6)`. Forced colours map every surface and status surface to `Canvas` and the scrim to `transparent`; the component keeps its border there.

Verified contrast (computed by `contrast.test.ts` from `CONTRAST_PAIRS`; the same in every appearance except muted text, which is shown normal / increased contrast):

| Pair | Light | Dark | Stage | Min |
|---|---|---|---|---|
| foreground / raised · sunken | 17.9 · 15.2 | 12.6 · 14.0 | 13.4 · 14.1 | 4.5 |
| muted-foreground / raised | 6.7 / 10.3 | 6.1 / 8.6 | 7.8 / 10.4 | 4.5 |
| muted-foreground / sunken | 5.7 / 8.8 | 6.7 / 9.6 | 8.2 / 10.9 | 4.5 |
| foreground / success · warning · info · destructive surface | 16.3 · 15.6 · 15.3 · 15.0 | 11.2 · 11.5 · 11.4 · 11.7 | 12.0 · 12.3 · 12.1 · 12.3 | 4.5 |
| success · warning · info · destructive / own surface | 5.1 · 4.7 · 5.0 · 5.0 | 6.1 · 7.2 · 6.0 · 4.9 | 6.8 · 8.2 · 6.7 · 5.5 | 4.5 |

Status colour is never the only cue: a status surface always carries an icon and text (§4.3, §13).

## 5. Confidence encoding (one rule for every surface)
Ordinal, three levels plus a timing flag, from `05-analysis-schema.md` bands. Redundant cues, strongest-first: **ink value → outline → glyph → text on focus.** No hue, saturation or blur (blur destroys digit legibility; hue and saturation rated poorly for uncertainty, MacEachren et al. 2012; dashing preferred over sketchiness, Boukhelifa et al. 2012).

| Level | Ink | Outline | Glyph | Where it applies |
|---|---|---|---|---|
| High | `--ink` | none | none | Fret numbers, noteheads, chord chips |
| Medium | `--conf-medium` (≥8.8:1) | 1.5 px **dashed** box around the digit/chip, `--conf-medium` | none | " |
| Low | `--conf-low` (≥6.1:1) | 1.5 px dashed box | superscript **"?"** | " |
| Timing flagged (quantize residual) | unchanged | 1.5 px **dotted underline** | none | Notes only |
| Unplayable — out of range, moved by octaves (`TabEvent.unplayable` with string/fret) | unchanged (confidence level still applies) | none | small superscript **"8va"/"8vb"** + tooltip "Played an octave higher/lower than recorded" | Tab only |
| Unplayable — no position within the span (no string/fret) | — | — | **"!"** marker on the beat in the overlay; tap opens the editor with the note's pitch and placement options | Tab only |

Unplayable is a placement fact, not uncertainty, so it never uses the dashed outline.

| Surface | Encoding |
|---|---|
| Tab / notation (alphaTab) | Ink via `NoteStyle` colours (`NoteSubElement.GuitarTabFretNumber`, noteheads); outlines and "?" drawn in an **overlay layer** positioned from `boundsLookup` with `core.includeNoteBounds = true` — alphaTab documents that CSS styling of its output isn't reliable, so we don't style its SVG directly |
| Chord strip | Same ink; chip border solid (high) / dashed (medium, low); "?" after the label (low) |
| Timeline ruler | Bars whose mean confidence is low get a 45° hatched band (pattern, not colour) labelled in the legend "Unsure bars" |
| Mixer | Rough stem: warning triangle + "Rough" text + tooltip with the reason |
| Library / song header | Badge text: "Chords only", "Rough tab", "Ready" — never a coloured dot alone |
| Legend | Always-visible chip "Auto-transcribed — may contain errors (v{model})" with a toggle "Show uncertainty"; turning it off removes outlines/glyphs but keeps ink |

On focus or tap, the editor sheet frames uncertainty as frequency: "Second guess: Am7 (about 1 in 3)" from the top-k alternatives.

## 6. Typography and reading sizes
### 6.1 Families
| Use | Family | Licence | Notes |
|---|---|---|---|
| All UI and tab digits | **Inter 4.1 Variable** (`wght` 400–700 in our subset, `opsz` 14–32) | SIL OFL 1.1 | Self-host the upstream `InterVariable.woff2` subset with `pyftsubset --layout-features='*'` (Latin + Latin-1 + punctuation); Fontsource subsets strip `zero`/`ss*`/`cv*`. `font-display: swap`, preload the roman file only. Step 10a: the full 100–900 axis subsets to 107 KB, over the 80 KB preload budget, so `scripts/fonts/subset.sh` limits `wght` to 400–700 (every weight the scale uses) with `fonttools varLib.instancer`: roman 76.4 KB, italic 83.0 KB |
| Hyperlegible reading option | **Atkinson Hyperlegible Next** (`wght` 200–800, roman only) | SIL OFL 1.1 | Settings → Display → "Hyperlegible font" swaps notation digits, chord chips and practice readouts (not chrome). Lazy-loaded (33.7 KB) |
| Standard notation glyphs | **Bravura** (alphaTab default SMuFL font) | SIL OFL 1.1 | Self-hosted per `12` §3 |
| Fallback stack | `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | — | Metric override (`size-adjust`) on the fallback to limit layout shift |

No monospace family: Inter's tabular figures (`font-variant-numeric: tabular-nums`) align timecodes, BPM and fret numbers. alphaTab's `display.resources.tablatureFont`, `barNumberFont` and `fretboardNumberFont` are set to the active reading family.

### 6.2 Browse scale (rem steps; root 16 px; respects browser zoom and 200% text)
| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `text-xs` | 12/16 | 500 | Badges, timestamps (never body text) |
| `text-sm` | 14/20 | 400–500 | Secondary text, table cells, labels |
| `text-base` | 16/24 | 400 | Body |
| `text-lg` | 18/28 | 500 | Card titles, song titles in lists |
| `text-xl` | 20/28 | 600 | Section headings |
| `text-2xl` | 24/32 | 600 | Subsection headings |
| `text-3xl` | 30/36 | 650, tracking −0.02em | Page titles (app) |
| `text-4xl` | 36/40 | 650, `opsz` 32, tracking −0.02em | Marketing headings |
| `text-5xl` | 48/1.05 | 700, tracking −0.03em | Hero and showcase headings |
| `text-display` | `clamp(2.25rem, 1.6rem + 2.6vw, 3.75rem)` / 1.05 | 700, tracking −0.035em | Marketing home headline |

Sentence case everywhere; no all-caps except 12 px overlines with +0.06em tracking.

### 6.3 Practice reading scale (distance presets)
Character height for comfortable reading is commonly given as 16′ minimum and 20–22′ preferred (ISO 9241-303 as reported; standards are paywalled, so figures are secondary). Sizes below were computed for an 11" iPad (≈5.2 CSS px/mm) with digit height ≈0.7 em, then rounded; smaller devices pack more CSS px per mm, so the per-device **calibration** slider (−20% … +40%, 10% steps, "Can you read the fret numbers from where you play?") closes the gap. Stage adds ×1.25.

| Token | Desk 0.5 m (laptop/desktop) | **Stand 0.75 m** (tablet default) | Floor 1.5 m (phone default → glance view) |
|---|---|---|---|
| `--read-tab` (fret digits, 600 weight) | 24 px | **36 px** (22′) | — (tab hidden) |
| `--read-chord-current` | 32 px | **48 px** (30′, glance) | 88 px |
| `--read-chord` (other chips) | 22 px | **32 px** | 56 px (next chord) |
| `--read-bar-number` | 14 px | **20 px** | 40 px (bar.beat) |
| `--read-readout` (speed %, loop bars, pass count) | 20 px | **28 px** | 40 px |
| `--read-label` (secondary practice text) | 14 px | **20 px** (≥16′) | 24 px |

- Desk is the default for fine pointers; Stand for coarse-pointer tablets; Floor for phones held >1 m away (chosen in onboarding or Settings → Display → "Where is your screen?").
- **Glance view** (Floor, and phone portrait default): current chord, next chord, bar.beat, loop state and speed at the sizes above; no tab.
- Fret digits: Inter semibold, tabular, two-digit frets get reserved width; minimum `--read-tab` 18 px even at Desk.

## 7. Layout and spacing
- **Grid:** 4 px base (`--spacing: 0.25rem`); common steps 4, 8, 12, 16, 24, 32, 48, 64. Component internal padding 12–16; between groups 24; page gutters 16 (phone) / 24 (tablet) / 32 (desktop).
- **Breakpoints (Tailwind defaults):** `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536. Content max widths: reading/marketing 72 ch; app pages 1200 px; practice is full-bleed.
- **Layout selection on the practice route** uses viewport size + `(pointer: coarse)` + orientation (feature queries, no UA sniffing), giving phone portrait / phone landscape / tablet portrait / tablet landscape / desktop (`27` §3.7).
- **Safe areas:** fixed bars pad with `env(safe-area-inset-*)`; sticky bars set `scroll-padding` so focused elements are never hidden (WCAG 2.4.11).
- **Density modes:** *browse* (library, settings, import: 44 px targets, `text-sm/base`) and *practice* (64/48 px targets, reading scale). The mode is a data attribute on the shell, so shared components (Button, Slider) pick practice sizes automatically.

## 8. Targets and hit areas (CSS px)
| Token | Size | Use |
|---|---|---|
| `--target-practice` | 64 × 64 (≈12 mm on an 11" iPad) | Play/pause, loop toggle, restart loop, speed −/+, Felt clean / Not yet |
| `--target-practice-2` | 48 × 48 | Count-in, metronome, mixer M/S, view toggles, chord chips |
| `--target` | 44 × 44 | All other interactive elements in browse mode |
| `--target-min` | 24 × 24 | Absolute floor (WCAG 2.5.8 AA) for dense desktop-only editor controls, with 24 px spacing circle |
- Primary practice targets cluster at **one consistent edge (bottom)** with ≥12 px gaps; actions fire on pointer-up and cancel if the pointer slides off; destructive actions are undoable instead of confirm-gated.
- Every drag has a non-drag alternative (WCAG 2.5.7): tap bars for loops, steppers/number fields for faders and speed.

## 9. Shape, borders and elevation
- **Radius:** `--radius: 0.625rem` (10 px); `sm` 6, `md` 8, `lg` 10, `xl` 14, `2xl` 18 (`base + 8 px`), `3xl` 24 (`base + 14 px`), `full` for chips and toggles. Usage: inputs, buttons and controls `lg`; chips, badges, pills and segmented items `full`; cards, panels and dialogs `2xl`; popovers and menus `xl`; bottom sheets `rounded-t-3xl`; hero and showcase panels `3xl`. Music surfaces (paper, timeline) use `lg`; never round the score's inner edge to the bars.
- **Borders:** 1 px `--border` for separation; `--input` (3:1) where the border is the only boundary of a control.
- **Elevation:** two layers per level in every appearance. `shadow-1` (cards at rest; `shadow-2` on hover only where the card is a link), `shadow-2` (popovers, menus), `shadow-3` (dialogs, sheets). Cards sit on `--surface-raised` (§4.8), so the surface step and the shadow agree.

| Level | Light | Dark | Stage |
|---|---|---|---|
| `--elevation-1` | `0 1px 2px oklch(0.2 0.01 75 / 0.06), 0 1px 3px oklch(0.2 0.01 75 / 0.04)` | `inset 0 1px 0 0 oklch(1 0 0 / 0.05), 0 1px 2px oklch(0 0 0 / 0.4)` | as Dark, highlight alpha 0.04 |
| `--elevation-2` | `0 2px 4px oklch(0.2 0.01 75 / 0.04), 0 8px 24px -4px oklch(0.2 0.01 75 / 0.12)` | `inset 0 1px 0 0 oklch(1 0 0 / 0.05), 0 8px 24px -8px oklch(0 0 0 / 0.55)` | as Dark, highlight alpha 0.04 |
| `--elevation-3` | `0 4px 8px oklch(0.2 0.01 75 / 0.06), 0 20px 48px -8px oklch(0.2 0.01 75 / 0.2)` | `inset 0 1px 0 0 oklch(1 0 0 / 0.06), 0 24px 48px -12px oklch(0 0 0 / 0.65)` | as Dark, highlight alpha 0.04 |

  Dark and Stage use a black drop shadow plus a 1 px top highlight instead of a lightness step with a border. Under increased contrast and forced colours components keep their 1 px border (a shadow is not a boundary).
- **Focus:** 2 px solid `outline` in `--ring`, 2 px offset (3 px under increased contrast), on every focusable element; meets 2.4.13 (AAA) sizing. Never `outline: none` without a replacement.

## 10. Motion
| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 100 ms | Hover, press, toggle state |
| `--duration-base` | 200 ms | Popover, tooltip, chip enlarge, toast |
| `--duration-slow` | 300 ms | Drawer, sheet, dialog, page-flip |
| `--duration-slower` | 400 ms | Route (view) transitions, large reveals |
| `--stagger` | 40 ms | Delay step between siblings in `stagger-children` |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default |
| `--ease-enter` | `cubic-bezier(0, 0, 0, 1)` | Elements appearing |
| `--ease-exit` | `cubic-bezier(0.3, 0, 1, 1)` | Elements leaving |
| `--ease-spring` | `cubic-bezier(0.34, 1.3, 0.64, 1)` | Small confirmations only: press release, a chip becoming current, a pass check |
| `--ease-smooth` | `linear()` spring, SwiftUI `.smooth` (duration 0.35 s, bounce 0) sampled over 400 ms | Layout morphs: library cards ↔ rows; always with `--duration-slower` |
| `--ease-snappy` | `linear()` spring, SwiftUI `.snappy` (duration 0.3 s, bounce 0.15) sampled over 400 ms | A selection moving between segments (the segmented-control capsule); always with `--duration-slower` |

The two springs are curves of the whole 400 ms window, so they only pair with `--duration-slower`. `linear()` needs Safari 17.2 / Chrome 113 / Firefox 112; older Tier 2 engines treat them as invalid and fall back to `ease`.

`--duration-slower` and `--stagger` are `0ms` under both reduced-motion conditions, like the other durations, so staggered items never wait while invisible.

**Keyframes** (in `theme.tailwind.css`, exposed as `animate-*` utilities; all end at their resting state, so a zero duration shows the final frame):

| Utility | Effect | Timing |
|---|---|---|
| `animate-rise-in` | opacity 0 → 1, translateY 8 px → 0 | `--duration-slow`, `--ease-enter` |
| `animate-pop-in` | opacity 0 → 1, scale 0.96 → 1 | `--duration-base`, `--ease-spring` |
| `animate-check-draw` | `stroke-dashoffset` 1 → 0; for an SVG path with `pathLength="1"` and `stroke-dasharray: 1` | `--duration-slow`, `--ease-enter` |
| `animate-shimmer` | `background-position` sweep for skeletons (the gradient is the component's) | 1.6 s linear, infinite |
| `animate-progress-indeterminate` | translateX −100 % → 250 % for a bar about 40 % of the track wide | 1.4 s `--ease-standard`, infinite |

`shimmer` and `progress-indeterminate` are loading states: low contrast, far below 3 flashes/s. Under reduced motion the global rule (duration 0, one iteration) leaves them static. Do not write the bare word `shimmer` in app source: Tailwind would emit shadcn's own `.shimmer` utility, which uses relative colour syntax below the CSS floor.

**Stagger:** `stagger-children` gives each direct child `animation-delay: calc(min(var(--i, 0), 8) * var(--stagger))`; components set `style={{ '--i': index }}` and an entrance animation. The cap means the ninth item and later enter together with the eighth.

**View transitions:** the root cross-fades over `--duration-slower` with `--ease-standard` (`::view-transition-old(root)` and `::view-transition-new(root)`, each in its own rule). Library reorders (27 §3.5) name each entry: its frame moves on `--ease-smooth` while the old and new images keep their natural size, pinned top-left and clipped to the frame, the old fading out over `--duration-base` and the new fading in over `--duration-slow` after `--duration-fast`, so a card morphs into its row without stretching. The grid/list control is named too and shown live only, so its sliding capsule leaves no ghost. Under both reduced-motion conditions `::view-transition-group(*)`, `-old(*)` and `-new(*)` get `animation: none !important`, so navigation swaps instantly.
- **Functional motion only:** the playhead, cursor, page-flip and current-chip enlarge carry information; everything else is a state transition or a short acknowledgement (rise, pop, check). No parallax, no looping decoration, no celebratory animation (confetti, streaks).
- **Reduced motion** (`prefers-reduced-motion: reduce` or Settings): transitions become 0 ms or opacity fades; notation uses page-flip by bar group; auto-scroll lists jump; the visual metronome becomes a static beat counter.
- **Flash safety:** any flashing element is ≤ 20 mm, changes luminance < 10%, and is hard-capped at 3 flashes/s regardless of tempo or subdivision (beat flashes would exceed 3/s above 180 BPM, eighths above 90 BPM). Never full-screen, never red.
- **View Transitions** only as progressive enhancement behind `document.startViewTransition` (absent on Safari < 18 and Firefox < 144) and disabled under reduced motion.

## 11. Iconography and brand marks
- **Library:** `lucide-react` 1.x (ISC; tree-shaken named imports). 24 px grid, 2 px stroke, round caps. Sizes: 16 (inline text), 20 (browse controls), 24 (practice secondary), 28–32 (practice primary).
- **Transport set:** `Play`, `Pause`, `Repeat` (loop), `SkipBack` (restart loop), `Minus`/`Plus` (speed), `Gauge` (speed menu), `Metronome`, `TimerReset` (count-in), `SlidersVertical` (mixer), `AudioWaveform`, `Mic`, `Headphones`, `Guitar`, `Piano`, `Drum`, `Keyboard` (shortcuts). The pedal has a custom icon.
- **Custom icons** (same grid/stroke, SVG components in `apps/web/app/ui/icons/`): pedal, capo, tab staff, chord box, count-in "1-2-3-4", minus-one (stem with slash), "your part".
- Icons are `aria-hidden`; their buttons carry visible text or `aria-label`. Icon-only buttons are allowed only for the universally known transport set and always have a tooltip with the shortcut.
- **Wordmark and app icon:** "Splitune" set in Inter 700, tracking −0.02em, `--foreground`; the mark is a single waveform stroke that splits into two lines (indigo + ink). Variants: full-colour, mono, maskable PWA icon (safe zone 80%), favicon 32/16 simplified to the split line. Drawn in step 10a; no third-party logo assets.

## 12. Components
### 12.1 Base (shadcn/ui CLI v4 on Base UI; `components.json` style `base-nova`, `baseColor: neutral` then replaced by our tokens)
| Component | Variants / notes |
|---|---|
| Button | `primary` (filled indigo), `secondary` (muted), `outline`, `ghost`, `destructive`, `link`; sizes `sm` (32, desktop only), `md` (44), `practice` (64), `practice-2` (48); `loading` state keeps width and shows a spinner after 300 ms |
| Toggle, ToggleGroup | Pressed state = `--accent` fill + indigo text + check/filled icon (not colour alone); used for view (Tab/Chords), mix presets, count-in. In a ToggleGroup the raised, indigo-edged surface is one capsule that slides and resizes to the pressed item on `--ease-snappy` (§10) and takes its corner radius; pressed items stay bold. With no single pressed item, items show their own pressed style. `capsuleClassName` recolours it (the phrase strip's paper/ink guide toggle) |
| Slider | Base UI Slider; horizontal and vertical (faders); range variant for loop A/B; always paired with a NumberField or steppers; `largeStep` 10 |
| NumberField | Steppers ≥44 px; tabular figures; units outside the input ("70 %") |
| Dialog, AlertDialog | Max one at a time; AlertDialog only for irreversible, non-undoable actions (delete account, delete song) |
| Drawer / Sheet | Base UI Drawer (swipe area on touch): mixer (right on tablet/desktop, bottom on phone), editor sheet (bottom on touch, side panel on desktop) |
| Popover, Tooltip, Menu, Select, Combobox, Tabs, Switch, Checkbox, Radio, Field/Input, Progress, Meter, Avatar, Separator, Scroll Area, Skeleton, Badge, Card | Stock behaviour, Splitune tokens; Tooltip shows the keyboard shortcut |
| Toast | Base UI Toast; for confirmations and Undo only; toasts with actions don't auto-dismiss (enforced by `toast.add`); never the only place an error appears |

Step 10a notes: the components were generated with the shadcn CLI (4.22, `base-nova`) and rewritten to tokens and sizes; focus uses the global 2 px outline instead of shadcn's rings; disabled controls use muted fills with a ≥3:1 boundary instead of 50 % opacity (which dropped primary buttons to 2.6:1). Button's default variant is `secondary` (one primary per region is a deliberate choice). The registry has no NumberField or Meter, so both are written on Base UI directly. Drawer (Base UI, swipe) also covers the side-sheet use; there is no separate Sheet. `cn()` uses `tailwind-merge` extended with the token utilities (shadcn's new `cn` package would merge `text-read-tab` and `text-foreground` as one group). Kit components take every user-facing string as a prop so step 10 can pass Paraglide messages.

### 12.2 Splitune kit (`apps/web/app/ui/` unless noted)
| Component | Purpose and states |
|---|---|
| `TransportButton` | Practice-size icon button with label below in Stand/Floor; pressed, disabled, active-loop states |
| `SpeedControl` | −/+ steppers (5%; 1% with Shift), tap-to-open slider 50–100% (25–200% advanced), preset chips 50/70/85/100, readout "70 % · 84 BPM" |
| `LoopBadge` | "Loop · bars 17–20 · pass 3" in the top bar; off / armed (A tapped) / active / resting states |
| `PassControl` | "Felt clean" / "Not yet" pair (practice size), best clean tempo readout |
| `ChordChip` | Current (enlarged), upcoming, past; confidence levels per §5; selected-for-edit |
| `ConfidenceLegend` | Always-visible legend chip + "Show uncertainty" toggle |
| `StemRow` | Instrument label + icon + colour rule, M / S toggles, fader + dB field, "Your part" tag, rough-stem warning, loading skeleton |
| `MixPresetGroup` | "Your part loud", "Minus-one", "Original" |
| `WaveformTimeline` (canvas) | Peak (outer) + RMS (inner) per lane, bar ruler, loop band (fill + edges + handles ≥44 px), unsure-bar hatching, section chips (v1), now-line |
| `PedalHud` | Large transient label for key/pedal actions ("Loop on", "Speed 75 %") at `--read-readout` size for 1.2 s + `aria-live="polite"` |
| `StageList` | Analysis stages with status icon + text (queued, running with honest ETA, done, fallback, failed), determinate overall bar |
| `SongCard` / `SongRow` | Title, instrument, status badge, last practised, best tempo; grid on tablet/desktop, list on phone |
| `AllowanceMeter` | "4 of 5 Lite analyses left · resets 1 Dec" (text first; bar second) |
| `EmptyState` | Icon, one-sentence explanation, one primary action, optional example |
| `InlineError` / `Banner` | Status icon + what happened + what to do + action; banners are dismissible only if non-blocking |
| `WorkerStatus` | "Processing machine offline — your song is queued" (personal mode §5) |
| `AlphaTabView` overlay (`packages/notation`) | Confidence outlines/glyphs, loop shading over bars, current-bar highlight (2 px ink rule + `--bar-current` wash) |

### 12.3 State matrix (every interactive component, every theme)
`default · hover (fine pointers only) · pressed · focus-visible · selected/pressed-on · disabled (≥3:1 for the shape; text may drop to 3:1 with "Unavailable" in the accessible name) · loading · error`. Each is a Storybook story (`28` §2).

## 13. Feedback patterns
| Situation | Pattern |
|---|---|
| Content with a known layout loading (library, settings) | Skeleton matching the final layout; no spinner |
| Short action (<2 s) | Button loading state (spinner appears after 300 ms) |
| Long job (upload, analysis) | Determinate progress + named stages + honest ETA; announced via polite live region at stage changes only |
| Validation | Inline under the field, linked by `aria-describedby`, shown on blur/submit |
| Load failure | In place, with Retry; keep any cached content visible |
| Reversible change (rename, loop edit, correction) | Optimistic (`useOptimistic`), Undo toast; on server failure roll back with an inline notice |
| Irreversible change | AlertDialog naming the object ("Delete 'Song title' and its stems?") |
| Pedal/keyboard action in practice | `PedalHud` + focus stays on the practice focus sink |
| Background completion | Toast if on the page; opt-in notification otherwise |

## Implementation notes (step 10, 2026-10-22)
- **Content widths as tokens** (§7): `--container-page` 1200 px, `--container-reading` 72 ch, `--container-bare` 480 px in `theme.tailwind.css` (`max-w-page`, `max-w-reading`, `max-w-bare`).
- **New kit pieces** (with stories): `WaveformPreview` (static peaks in `--waveform-peak`), `DropZone`, `RadioCard`/`RadioCardGroup` (Full/Lite), `SaveStatus` (per-field "Saved"); `SongCard`/`SongRow` gained `actions` (overflow menu), `progress` (compact analysis line) and `renderLink` (router links).
- `buttonVariants()` now merges its classes with `tailwind-merge`: links styled as buttons kept the base `border-transparent` next to the outline variant's `border-input`, so outline links had no visible boundary (and extra classes like `absolute` lost to the base `relative`).
- Display preferences gained `score: paper|match` (`data-score`); the "match appearance" colours are applied in step 12 with the score.

## Implementation notes (step 12, 2026-10-22)
- `WaveformTimeline` added to the kit (lanes per stem, bar or seconds ruler, loop band with ≥ 44 px handles nudged by arrow keys, unsure-bar hatching, compact ruler).
- Score "Match appearance" in Dark: `[data-appearance="dark"][data-score="match"]` takes Stage's score colours (paper, ink, conf-medium/low, staff, current bar, loop fill/edge, playhead) without Stage's size step. Contrast tests cover `dark+match/normal` and `dark+match/more`. Storybook has a Score toolbar global.
- `LoopBadge` truncates its text (`min-w-0`), so ⚙ and ⋯ stay on screen in narrow status bars; `Banner` text has a 16 rem basis so actions wrap below it on phones.

## Implementation notes (step 15a, 2026-10-22)
- **Radius scale follows `--radius`** (§9): `sm/md/lg/xl` = `--radius` − 4 px / − 2 px / ± 0 / + 4 px (still 6/8/10/14). They were literals, so changing `--radius` changed nothing — found by the visual-regression token check.
- **Motion from tokens only** (§10): Drawer and Toast used shadcn's own curves and 150–500 ms; they now use `--duration-*` and `--ease-standard`, and animated popups use `--ease-enter` / `--ease-exit` (tw-animate-css defaults to `ease`). Practice layers fade in with `--duration-base` + `--ease-enter` (27 §3.7.3). `check-ui-tokens.mjs` now fails one-off durations, delays and easings.
- **Focus never hidden** (§7): `html { scroll-padding-top: 72px + safe area }` (the 56 px sticky bar plus room for the outline). Without it a focused control landed 27 px under the bar (Chromium and WebKit, measured); with it, 15 px below. A Playwright check runs in the visual suite.
- **Touch targets** (§8): the wordmark links in every shell, the marketing footer links, "Learn this pedal" (was `sm`, 32 px) and the drop zone's inline "choose a file" (44 px hit area via `::after`) now reach 44 px; `StemRow` puts the name on its own row below `sm` so "Guitar" no longer truncates on phones.

## Implementation notes (step 17c, practice redesign, 2026-10-23)
- **Legend chip (§5):** always visible as a dashed chip "Auto-transcribed · v{model}" in the practice status bar; the full "Auto-transcribed — may contain errors (v{model})" text, the marks key and the "Show uncertainty" switch are in its popover (owner-approved).
- **ChordChip (§12.2):** upcoming/past chips are plain names; the dashed outline appears only for medium/low confidence. The current chip is set at `--read-chord-current` (no scale transform) with the 2 px loop-edge border on `--bar-current`.
- **Loop on the score:** loop fill only, plus a 3 px `--score-loop-edge` rail on the looped bars with A/B flags at the ends (no 2 px rule above and below every bar: a whole-song loop drew a cage over the score). The alphaTab view is `isolate`d so its overlay layers stay below the floating video.
- **Tab engraving:** tab line spacing follows the digit size (`ceil(0.92 × --read-tab)`, never below Bravura's default), so stacked digits no longer overlap; tempo marks and dynamics are hidden; chord names over the bars use the reading family, bold, at 0.75 × the digit size.
- **TransportButton:** `showLabel` true (from `md`), `'wide'` (from `xl`) or false (the universally known transport icons, §11). `SpeedControl` is its own sunken capsule; `SpeedControl`/`PassControl` take `compact` for phones. `NumberField` takes `fill`; `MixPresetGroup` takes `orientation`; `WaveformTimeline` takes `overview`.

## Implementation notes (step 17d, piano chord chart, 2026-10-23)
- **Keyboard tokens (tier 3):** `--key-white`, `--key-black`, `--key-left`, `--key-left-fg`, `--key-right`, `--key-right-fg` for `KeyboardDiagram` (`packages/notation`). Literal values, the same in Light and Dark (the keyboard is an object on the paper, like the score); Stage dims the white keys to `oklch(0.9 0.006 85)` and darkens the left hand to `oklch(0.6 0.12 55)` with `oklch(0.14 0.01 75)` letters. Left (orange) and right (indigo) hands differ in lightness and carry L/R on the key; both reach ≥3:1 on white and black keys, their letters ≥4.5:1 (pairs in `CONTRAST_PAIRS`). Forced colours: Canvas/CanvasText keys, Highlight hands.
- **ChordSymbol (§12.2, in `ui/chord-chip.tsx`):** chord names everywhere are set with real ♭/♯ (the reading fonts have none, so the fallback glyph is lifted 0.16 em), the quality raised at 0.68 em, minor's "m" kept on the line, a slash bass at 0.88 em. ChordChip renders through it, so guitar's strip shows "F♯m⁷" too. `'use no memo'`: the compiler's memo cost more than the render (route budget).

## Implementation notes (step 18, falling notes, 2026-10-23)
- **PianoRoll (`packages/notation`, canvas):** notes fall onto a KeyboardDiagram with the same `from`/`to` (shared `keyboardKeys` geometry, so lanes match keys exactly; whole octaves from C, at least C3–C6). Hands: `--key-left`/`--key-right` fills, which do **not** reach 3:1 on `--paper` (Dark) or `--score-loop-fill` (several appearances), so the outline carries the contrast and the hands differ by more than colour: left = square corners, 2 px `--ink` outline; right = rounded, 1 px `--staff` outline; L/R letters in `--key-*-fg` once a note is tall enough. Uncertain notes: dashed `--conf-medium`/`--conf-low` outline, "?" above low ones (Transkun's constant confidence means none show on real songs). Bar lines `--staff` with 1-based numbers in `--conf-medium` (new pair: `--conf-medium` on `--score-loop-fill` ≥ 4.5), beat lines and octave guides at 35 %, loop fill + 2 px edges, `--score-playhead` now line. "Right only" draws the left hand at 30 %.
- **KeyboardDiagram:** `height` (white key length in key units, default 48) so a full-width keyboard can be squat; the Notes view sizes it to 9 % of its width (56–112 px), at most 40 % of the paper's height.
- Not checked: forced colours (the canvas reads the tokens through `readColor`, so it should follow, but it wasn't emulated).

## Implementation notes (step 18b, guitar and bass Notes, 2026-10-24)
- **Direction A** (owner's choice): string lanes in tab order (string 1 on top) moving right to left onto a neck at the left whose strings continue the lanes; B (notes falling onto a chord-box neck) and a 3D highway were mocked and rejected (mockups and reasons in `18b/`).
- **Tokens (tier 3):** `--fret-guitar`, `--fret-bass` — the instrument's mark on the score (sustain tails, finger-dot rings, the 30 % tint of a sure note). `--stem-*` couldn't be used: Dark keeps a light paper but switches the stems to bright Okabe-Ito values made for dark chrome (orange on the paper < 3:1). Light `oklch(0.6 0.13 64)` / `--stem-bass`; Dark `oklch(0.53 0.12 62)` / `oklch(0.5 0.14 252)`; Stage and Dark + score "match" the stage stems; forced colours `Highlight`. Pairs: each on `--paper` and `--score-loop-fill` ≥ 3:1; a contrast test checks `--ink` ≥ 4.5:1 on the tinted head over both.
- **Notes (`GuitarRoll`, canvas):** a rounded head with the fret digit at `--read-tab`, `--ink` 1.5 px outline (the contrast carrier), tinted with the mark at 30 %; uncertain notes stay untinted (paper, like a draft) with the dashed `--conf-medium`/`--conf-low` outline, ink and a "?" on low ones (§5); 8va/8vb over moved notes, "!" over the bar for notes with no place. A strum (onsets within 35 ms) is one stack with a 2 px ink rule at 60 %; a head is narrowed so it never runs into the next note on its string. Chord names (ChordSymbol's parts: lifted ♭/♯, raised quality) over bar numbers over the lanes, as on the tab; beat lines at 35 %.
- **Neck (`FretboardDiagram`, SVG):** strings at the lanes' rows (`stringRows`), thicker toward the low strings, named in the song's spelling (e over E); wires spaced `0.55 n + 0.45 × equal-tempered` (frets shrink like a neck, the 12th still ¾ of the 1st); a window of 5–9 frets keyed per bar (split into half bars only when a bar needs more than nine), moving only when a note leaves it, from that note, 0.5 s early; nut, or an 8 px rounded capo bar (frets counted from the capo); inlays at 3, 5, 7, 9 and a double 12 by the real fret; a break mark when the window is up the neck. Sounding: ink dot with its fret in `--paper`, 3 px ring in the mark; open strings an ink ring "0" left of the nut; next shape: dashed `--conf-medium` dots; a chip "Fret 12 →" when the next note leaves the window. Left-handed (Profile): the neck mirrored, numbers not.
- **Sizes:** digits at `--read-tab`, unless the paper is too short for lanes 1.3 × their height (`fitReadPx`: a phone in landscape, whose Floor sizes belong to the glance view); labels 0.6 of the digits, never below 11 px (`labelPx`).
- **Motion (§10):** positions are a pure function of the audio clock read once a frame; nothing eases the time → position mapping. The window glides with `--duration-slow` / `--ease-standard` (a CSS transform transition, so no React state per frame), at once after a seek. Landing acknowledgement: one 240 ms ring around the strum that just landed (scale 1 → 1.6 from r + 4, opacity 0.55 → 0, the mark's colour; Web Animations on mount), at most 3 a second, off with reduced motion. Reduced motion: the lanes hold a bar, only the playhead moves; the neck jumps.
- Measured (step 18b): 60 fps, frame script time p95 ≤ 0.6 ms on desktop Chrome for the densest part tested (26 notes in a bar).


## Implementation notes (step 18c, vocal Melody, 2026-10-24)
- **Direction** (mockup `18c/`, owner's go-ahead): a horizontal melody roll (time left to right like the guitar lanes and the waveform, pitch up) with lyrics-free phrase markers, instead of lyrics with a pitch contour (no lyrics source) or a staff.
- **Token (tier 3):** `--melody-vocals`, the vocal hue on the score: the 30 % tint of a sure note and the ring on the rail's sung pitch. Light `--stem-vocals`; Dark `oklch(0.5 0.12 346)` (Dark keeps a light paper, and `--purple-dark` is made for dark chrome); Dark + score "match" `--stem-vocals`; Stage `--purple-stage`; forced colours `Highlight`. Pairs: on `--paper` and `--score-loop-fill` ≥ 3:1; the contrast test checks `--ink` ≥ 4.5:1 on the tinted note over both.
- **Roll (`MelodyRoll`, canvas):** now line at 20 % of the width (what was just sung stays in view), two bars ahead. Rail at the left with the key's pitches (names with octave, or degrees), the tonic bold and ruled across the roll, out-of-key rows `--ink` at 4.5 % (texture only, no contrast role); the pitch being sung ringed in `--melody-vocals` and bold. Notes: rounded bars a row high, `--ink` 1.5 px outline (3 px while sung), tinted at 30 %; sung-and-gone notes lose the tint and take `--conf-medium`; uncertain notes stay untinted with the dashed outline, low ones "?" for a name (§5). Consecutive notes of a phrase are joined by a 1.5 px `--staff` line (the melody's shape); a breath mark ’ after each phrase. Phrase markers along the top: rounded bands with "n · letter  bars a–b", the current one `--bar-current` with a 2 px ink edge, a looped one in the loop's fill and edge. Chord names (ChordSymbol's parts) after the bar number under the markers.
- **Sizes:** note and rail labels at `--read-tab`, smaller only when rows are short (0.62 of the row, never below 11 px); short rows (< 14 px) name every other degree. The pitch window follows the notes on screen (2 semitones over and under, an octave at least) or, as an option, holds the whole song.
- **Motion (§10):** positions are a pure function of the audio clock read once a frame; the pitch window eases (120 ms exponential) and jumps after a seek. Reduced motion: the roll holds a page (a bar), only the playhead moves, and the window jumps.

## Open questions
- Validate the distance presets in situ (tablet at 0.75 m in bright and dim rooms; include one or two players over 45) before freezing `--read-*` values.
- Whether Inter's digits or Atkinson Hyperlegible Next read better for fret numbers at the stand; test both and consider making Hyperlegible the default for tab only.
- Whether Dark users prefer the paper score (default) or "match appearance"; log the setting (no PII) and revisit.
- alphaTab overlay performance with `includeNoteBounds` on long songs (measure in step 12; fall back to bar-level confidence boxes if it costs >2 ms per frame).

## Sources
- Polarity and ambient light: Piepenbrock, Mayr, Mund & Buchner, *Ergonomics* 56(7) 2013 and *Human Factors* 2013 ([record](https://madoc.bib.uni-mannheim.de/26118/)); Dobres et al., *Applied Ergonomics* 60 (2017) and summary in [NN/g, Dark mode vs light mode (2020)](https://www.nngroup.com/articles/dark-mode/) — tier 1/2, accessed 2026-10-20.
- [Soundslice: introducing dark mode](https://www.soundslice.com/blog/239/introducing-our-players-dark-mode), [theme help](https://www.soundslice.com/help/en/player/advanced/301/theme/); [forScore reflow/dimming](https://forscore.co/reflow/) — tier 2, accessed 2026-10-20.
- Uncertainty visualisation: [MacEachren et al. 2012, TVCG](https://geography.wisc.edu/cartography/projects/publications/MacEachrenEtAl_2012_TVCG.pdf); [Boukhelifa et al. 2012](https://tobias.isenberg.cc/p/Boukhelifa2012ESV); Kay et al. CHI 2016 ([project](https://mucollective.northwestern.edu/project/when-ish-is-my-bus)) — tier 1, accessed 2026-10-20.
- Character height: ISO 9241-303 figures as reported in [W3C WAI-IG thread](https://lists.w3.org/Archives/Public/w3c-wai-ig/2023OctDec/0054.html) and [MIL-PRF-87268 summary](https://activu.com/uploads/Optimal-Font-Size.pdf) — tier 3 (secondary), accessed 2026-10-20; arithmetic ours.
- [Apple HIG: Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Sliders](https://developer.apple.com/design/human-interface-guidelines/sliders) — tier 2, accessed 2026-10-20.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [Understanding 2.4.13 Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html), [2.5.8 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [WCAG 3 draft status (2026-03-03)](https://www.w3.org/WAI/news/2026-03-03/wcag3) — tier 1, accessed 2026-10-20.
- [shadcn/ui theming](https://ui.shadcn.com/docs/theming), [changelog: Base UI default (2026-07)](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default), [Base UI releases](https://base-ui.com/react/overview/releases), [Tailwind dark mode](https://tailwindcss.com/docs/dark-mode), [Tailwind compatibility](https://tailwindcss.com/docs/compatibility) — tier 2, accessed 2026-10-20.
- [caniuse: color-mix](https://caniuse.com/mdn-css_types_color_color-mix), [light-dark()](https://caniuse.com/mdn-css_types_color_light-dark), [relative colours](https://caniuse.com/css-relative-colors); [View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions) — tier 2, accessed 2026-10-20.
- [Inter](https://rsms.me/inter/), [Atkinson Hyperlegible Next (google/fonts)](https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegiblenext), [Lucide metronome icon](https://lucide.dev/icons/metronome), [Lucide v1 (InfoQ, 2026-06)](https://www.infoq.com/news/2026/06/lucide-v1-icons/) — tier 2, accessed 2026-10-20.
- [alphaTab RenderingResources](https://www.alphatab.net/docs/reference/types/json/renderingresourcesjson), [display.resources](https://www.alphatab.net/docs/reference/types/displaysettings), [coloring guide (NoteStyle)](https://www.alphatab.net/docs/guides/coloring), [core.includeNoteBounds](https://www.alphatab.net/docs/reference/settings/core/includenotebounds) — tier 1, accessed 2026-10-20.
- Motion references: [Carbon motion](https://carbondesignsystem.com/elements/motion/overview/), Material 3 motion tokens (material-web `_md-sys-motion.scss`) — tier 2, accessed 2026-10-20. Flash thresholds: WCAG 2.3.1 ([NYU summary](https://digitalaccessibility.nyu.edu/testing/sc231.html)).
- Okabe-Ito palette ([NYU](https://siegal.bio.nyu.edu/color-palette/)); contrast values computed by us from the token values.
- Cross-linked: `research/ux/accessibility.md`, `research/ux/hands-busy-and-device-context.md`, `research/ux/music-display-ui.md`, `research/ux/practice-tool-patterns.md`, `research/ux/learning-science-principles.md` (P8 split attention, P9 motivation).
