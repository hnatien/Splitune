---
title: Design system and visual language
workstream: engineering
last_researched: 2026-11-17
confidence: medium
---

# Design system and visual language

The visual direction for Splitune, **OpenAI's interface language applied to a practice tool**, and the system that implements it: theme model, tokens, colour, confidence encoding, typography and reading sizes, layout, targets, shape, motion, icons and the component inventory. Screens, flows and copy are in `27-screens-flows-and-content.md`; the quality workflow (Storybook, token tests, design QA) is in `28-ui-quality-and-design-review.md`. Practice behaviour is in `12-practice-screen-and-notation.md`.

This doc was rewritten in place twice. Step s31a (2026-11-08) replaced the "Music Stand" system (paper score, indigo accent, Inter) with "Night Rehearsal" (warm graphite, one amber accent, Instrument Sans). Step s46 (2026-11-17) replaced Night Rehearsal with the black-and-white system described here. Both earlier versions are in git (`git show 8d6a3f6:docs/specs/26-design-system.md` for Music Stand; the s31a version is the last commit of this file before s46). Neither is a source any more. Section numbers are unchanged, so code comments that cite "26 §4.7" or "26 §12.1" still point at the same topic.

**Sources and precedence.** The binding implementation is code: `packages/ui-tokens` (tokens and their tests) and the components in `apps/web/app/ui`, shown in Storybook. This doc describes what that code does. The tables of contrast ratios are the values `contrast.test.ts` checks to ±0.1 (§4.6, §4.8); where this doc and the code disagree, the code is right and this doc is out of date. `redesign/` (the s31a research, the 25 mockups and `splitune.css`) is historical: it explains earlier decisions, but it is no longer the visual source (§4.9).

> **Personal mode (`25-personal-mode.md`):** no paid design tooling. The design source of truth is code (`packages/ui-tokens` plus Storybook), not a Figma file. Fonts and icons are open-licence and self-hosted.

## TL;DR
- **Direction: black and white, after OpenAI's interface language** (owner's decision, 2026-11-17, step s46). Pure black and white grounds with achromatic greys between them. **No accent colour at all:** the primary action and "now" (playhead, loop edges, current beat) are the ink itself, a white pill on black and a black pill on white. Colour appears only where it carries meaning: status (unsure blue, success green, destructive red), the six stem colours and the two piano hands (§1, §4).
- **Two themes from one set of semantic roles:** *Dark* (default) and *Light*. The stored ids stay `system | light | dark | stage` because a contract enum uses them: `dark` = Dark, `light` = Light, `system` = follow the device, `stage` = Dark with at least the music-stand reading sizes (§2). Increased contrast is a second axis in both themes.
- **Tokens in three tiers** (OKLCH primitives → semantic roles keeping the shadcn names plus Splitune roles → a few component tokens), static CSS in `packages/ui-tokens`, mapped to Tailwind v4 with `@theme inline` (§3). Every text and graphic pair is contrast-tested in every theme × contrast context (§4.6); stems pass a colour-vision-deficiency separation test (§4.4); every surface, text and line role is tested to be achromatic (§4.1).
- **Confidence is never shown by colour alone:** *Probably* = dashed outline; *Unsure* = dashed outline + "?" + the unsure blue; uncertainty is put in words as a frequency ("about 1 in 3"). *Edited by you* = underline; *Sounding now* = an ink box with the digit in the page colour (§5).
- **Type:** Figtree for words (the closest open-licence match to OpenAI Sans, §6.1), Figtree with tabular figures for every number that changes, JetBrains Mono only for tab digits, keycaps, shortcut hints and ids, Bravura for standard notation, Atkinson Hyperlegible Next as the opt-in reading font. Two weights carry the interface: 400 for text, 500 for anything that leads. Reading sizes come from distance presets, Desk / Music stand / Floor, and never drop below the 18 px tab-digit floor, 16′ digit height or 0.4° chord capitals (§6.3).
- **Shape is bimodal:** controls are pills (buttons, chips, segmented controls, badges, switches) and icon buttons are circles; fields and cards have 12 px corners; media 8 px; dialogs and sheets 22–24 px (§9).
- **Targets (CSS px, the control's own box):** the **main practice controls** (Play/Pause, restart / back a bar, next bar, speed −/+, loop, count-in, Felt clean / Not yet) are **64** in every layout, phones and Fix mode included; secondary practice controls 48; everything else 44; Stand view's pedal buttons 88. Nothing is below the 24 px AA floor, and only the desktop song-map section chips use it (§8).
- **Owner decisions.** G1 (2026-11-08, pre-approved in chat): **D2** three theme cards, with `stage` a valid stored id but not a card; **D3** the speed ladder steps up after **3** clean passes by default (a setting); **D4** Stand view is the default practice layout on tablets; **D5** the brighter lines and borders and the re-tuned stem palette (§4.9 V1, V2, V6). s46 (2026-11-17): a fully monochrome interface with no accent colour; the ink as primary action and "now"; colour only for status, stems and hands; the themes named Dark and Light; Home images are abstract colour art the owner generates from `docs/home-art.md` (§11).
- **Motion follows only the music:** 100 / 200 / 300 ms, 200 ms for most interface changes, playhead on its own layer driven by the audio clock, page turns and stepped playhead under reduced motion, no flashing over 3 a second (§10).

## 1. Design direction
### 1.1 Candidates considered
In s31a three directions were mocked on the same screens (`redesign/mockups/Dir-A/B/C.dc.html`): A "Night Rehearsal" (warm graphite, one amber accent, Instrument Sans), B "Annotated Score" (paper, red pencil, serif display) and C "Pedalboard" (light hardware panel, orange). A was built in s32–s38. On 2026-11-17 the owner asked for the whole app to be redone after OpenAI's interface language, with the font closest to OpenAI Sans and no amber anywhere. Step s46 builds that; this section records what was taken from it and what was not.

**What was measured** (openai.com and chatgpt.com, computed styles, for the s46 brief):

| Element | OpenAI | Splitune (s46) |
|---|---|---|
| Grounds | Pure black (`#000`) and white (`#fff`); light-theme text `#0d0d0d` | The same: Dark page `#000` with `#fff` text, Light page `#fff` with `#0d0d0d` text |
| Neutrals | Steps of the ink at alpha (translucent greys) | Opaque achromatic greys. The token tests composite a translucent background over white, so a background must be opaque to be contrast-tested (§4.3); only the ink wash `--primary-soft`, its hairline `--primary-line` and the scrim are translucent |
| Accent | None; the primary button is the ink | None; the primary action and "now" are the ink (§4.2) |
| Weights | 400 and 500 | 400 for text, 500 for headings, labels, buttons and navigation; 600 only for the wordmark and a few numbers (§6.2) |
| Body | 17 / 28 on marketing pages | `text-lead` 17 / 28 for marketing and long-form body; app body stays 15 / 22 (`text-base`) |
| Buttons | Pills, 36–44 px tall | Pills painted at 32 / 40 / 48 / 56 inside a 44 px (48 in practice) target box (§8, §12.1) |
| Corners | 6 px on media; 24 px on the composer | 8 px on media (the nearest step of the unchanged radius scale); 24 px only on phone sheets' top corners (§9). Splitune has no composer |
| Motion | About 200 ms | `--duration-base` 200 ms with `--ease-standard` for most interface changes (§10) |
| Font | OpenAI Sans (not licensable) | Figtree, chosen by its metrics (§6.1) |

### 1.2 Principles (use them to settle design arguments)
1. **The music is the brightest thing on screen.** Chrome is black, white and quiet greys; ink is reserved for notation, chords and numbers; colour is spent on meaning.
2. **The ink means "act" and "now".** One filled ink pill per view is the primary action. The playhead, the sounding note, the current beat, the loop's edges and the on-states of controls are the ink too, told apart from text by shape (a fill, a 2 px line, a wash with an edge). Colour never decorates.
3. **Readable from the stand.** Size for the reading distance (§6.3). If it can't be read at 0.75 m, it doesn't belong in practice.
4. **Honest, not authoritative.** Machine output looks like a draft where it is unsure, says how unsure in plain numbers, and is one tap from being fixed.
5. **Hands are busy.** Big targets at a consistent edge, every action on a key or pedal, visible confirmation within 100 ms.
6. **Calm coach.** Competence evidence (the clean tempo, the first clean pass next session); no streaks, no guilt, no confetti.

### 1.3 Character
| Element | Expression |
|---|---|
| Surfaces | Dark: black page, near-black card `#121212`, greys rising in lightness for popovers, fills and hover. Light: white page and white cards told apart by a 1 px hairline, `#f5f5f5` and `#ececec` for fills and hover |
| Accent | None. The primary action and "now" are the ink: white on Dark, `#0d0d0d` on Light |
| Lines | Hairlines and whitespace over boxes and shadows; shadows only on floating layers (menus, popovers, dialogs, sheets, toasts) |
| Shape | Pills for controls, circles for icon buttons, 12 px fields and cards, 8 px media, 22 px dialogs, 24 px phone sheets |
| Type | Figtree at 400 and 500, sentence case, no uppercase labels or letter-spaced eyebrows; tabular Figtree figures for every number that changes; JetBrains Mono only for tab digits, keycaps and ids |
| Imagery | No stock photos or people. In the app, the product, the waveform and the notation are the imagery. Home adds abstract colour art (§11) |
| Brand | Lowercase wordmark "splitune" beside an ink disc crossed by a wave in the page colour (§11) |

## 2. Appearance (theme) model
| Stored id | Name in the UI | Colours | Reading sizes | Notes |
|---|---|---|---|---|
| `dark` | **Dark** | Dark roles (§4) | The chosen distance preset | **Default** for every new device (`DEFAULT_DISPLAY.appearance`) |
| `light` | **Light** | Light roles | The chosen distance preset | Same semantic roles, white ground |
| `system` | **Follow my device** | Dark if `prefers-color-scheme: dark`, else Light | The chosen distance preset | |
| `stage` | — (a valid id, not a card) | Dark roles | The chosen preset, never smaller than **Music stand**, then × 1.25 (`--read-scale`) | Kept because the contract enum `DisplaySettings.appearance` uses it; see below |

- **Choices shown (owner decision D2, G1).** Settings → Display & practice, the practice Display popover, the account menu and ⌘K offer exactly three choices: Dark (`dark`), Light (`light`), Follow my device (`system`). `stage` stays a valid stored and contract value but has no card. A device that has `stage` stored keeps its effect (Dark colours, sizes no smaller than Music stand, × 1.25); its controls show Dark and the resolved distance, and the next change to either control stores `dark` (plus the distance shown).
- **No score surface.** The notation sits on the page in both themes (`--paper` = `--background`). The Music Stand "Score: Paper / Match appearance" setting and the `data-score` attribute are retired (`tokens.test.ts` checks `themes.css` never mentions `data-score`); the analytics field `DisplaySettings.score_surface` (contract, unchanged) always reports `match`.
- **Increased contrast** (`data-contrast="more"`, or `prefers-contrast: more` with no stored choice; Settings "Increase contrast: Follow system / On / Off"): muted and faint text, borders, field boundaries, staff lines and unplayed waveform bars move one step further from the ground (values in §4.1 and §4.7), the focus outline is 3 px, and the 1 px ring `--glow` is dropped. The segmented track gains a border.
- **Forced colours** (Windows High Contrast): semantic tokens yield to system colours (`Canvas`, `CanvasText`, `Highlight`, `HighlightText`); every surface and wash becomes `Canvas`, the scrim transparent; focus uses `outline`; confidence marks keep their dashes and "?"; canvas layers (waveform, rolls, grids) read the system colours through `forced-color-adjust: none` only where they draw their own accessible colours. Components that tint a selected surface behind ordinary text drop the tint there (`forced-colors:bg-card`); the edge still marks the state.
- **Implementation.** `<html data-appearance="dark|light|stage" data-contrast="normal|more" class="dark?">`. `.dark` is set for `dark` and `stage` so shadcn's `dark:` variants keep working; token selection uses `data-appearance`. Dark is the `:root` default, so without JavaScript (and before the head script runs) the page is Dark; an OS dark-mode preference changes nothing before the script runs. The inline head script resolves the stored choice and `matchMedia` before first paint, writes both attributes and `color-scheme` (`dark` or `light`), and resolves `stage` by raising `data-distance` to `stand` when the chosen or automatic distance is `desk`. The choice is per device: `apps/web/app/lib/display-store.ts` persists it (Zustand + `localStorage`) and `apps/web/app/ui/display.ts` (`DEFAULT_DISPLAY`, `applyDisplay`, inlined into the head script) applies it.
- **Subtree theming.** Every theme block also applies to any element carrying `data-appearance`, so a subtree can show the other theme: the theme preview cards in Settings, the Foundations story and Storybook's side-by-side mode. Components therefore never use shadcn's `dark:` variants for colour (an ancestor's `.dark` would leak into a Light subtree); colour comes from tokens only. Previews never paint raw colours; the app renders a miniature inside `data-appearance="dark"` or `"light"`.
- **Floor-safe CSS:** `oklch()` and `color-mix()` only. No `light-dark()`, relative colour syntax (`oklch(from …)`), `@scope` or native CSS nesting in shipped CSS: `apps/web/scripts/css-floor.mjs` (run on the build output) fails on them (Safari 16.4 floor, `24-browser-compatibility.md`).
- No ambient-light switching (`AmbientLightSensor` is not Baseline).

## 3. Token architecture
```
packages/ui-tokens/
  src/primitives.css     # OKLCH steps: black, white and the greys between, ink washes, unsure, ok, bad, stems (never used by components)
  src/themes.css         # semantic roles per [data-appearance] × [data-contrast], Dark as the :root default
  src/theme.tailwind.css # @theme (static scales) + @theme inline (semantic → Tailwind names)
  src/fonts.css          # @font-face for the self-hosted families and their metric-matched fallbacks
  src/index.ts           # typed token names, STEMS, CONFIDENCE, CONTRAST_PAIRS, readToken()/readColor(), BACKGROUND_HEX
  src/*.test.ts          # contrast, gamut, CVD separation, neutrality and naming tests (28 §3)
```
- **Tier 1, primitives.** Static OKLCH literals: L and C to three decimals, H in whole degrees (`tokens.test.ts` checks the format). Neutrals are named by lightness × 1000 (`--gray-182` is `oklch(0.182 0 0)`), plus `--black` and `--white`. There is no runtime colour maths. Primitives are not exposed to Tailwind (`--color-*: initial` clears the palette), so components can't write `bg-gray-182`; only semantic roles read them.
- **Gamut rule.** Every primitive is inside sRGB as written (`colorjs.io` `inGamut('srgb')`); saturated values are clamped in the source by lowering chroma at the same L and H.
- **Tier 2, semantic roles.** shadcn's names stay (`--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--chart-1…5`, `--sidebar-*`, each `-foreground` where it applies), so components keep their class names and props. Splitune roles: `--faint-foreground`, `--border-strong`, `--primary-hover`, `--primary-ink`, `--primary-soft`, `--primary-line`, `--signal`, `--unsure`, `--unsure-surface`, `--success`, `--success-surface`, `--destructive-surface`, `--destructive-foreground`, `--warning`, `--warning-surface`, `--info`, `--info-surface`, `--edited`, `--surface-raised`, `--surface-sunken`, `--paper`, `--ink`, `--conf-medium`, `--conf-medium-edge`, `--conf-low`, `--stem-{guitar,bass,drums,vocals,keys,other,mix}`, the increased-contrast values as their own roles (`--muted-foreground-more`, `--faint-foreground-more`, `--border-more`, `--border-strong-more`, `--input-more`), `--elevation-1…3`, `--elevation-capsule`, `--elevation-play`, `--glow`, `--read-scale`. **Naming trap:** shadcn's `--accent` is the hover/selected *well* (a grey), not an accent colour. There is no accent hue; emphasis is `--primary`, which is the ink.
- **Tier 3, component tokens** (only where a component needs one; §4.7): loop, playhead, current bar, staff, waveform, beat pulse, piano keys, instrument marks on notation, stem-tile icons, the segmented capsule, HUD, scrim.
- **Static scales** in `@theme`: spacing (`--spacing: 0.25rem`), radius (§9), font families, type steps (§6.2), reading sizes (§6.3), durations and easings (§10), target sizes (§8), z-index layers, content widths (§7).
- **JS consumers** (waveform canvas, rolls, drum grid, alphaTab `display.resources`, meters) call `readToken()` / `readColor()` and re-read on appearance or contrast change; they never hard-code colours.
- **Rule:** no raw colour literals (`#…`, `rgb(`, `oklch(` …), Tailwind palette classes, one-off durations or easings outside `packages/ui-tokens`, enforced by `scripts/check-ui-tokens.mjs` in `pnpm lint`. `tokens.test.ts` allows only the roles listed in `index.ts`, so the Music Stand and Night Rehearsal roles can't come back unnoticed.

## 4. Colour
Values are OKLCH as written in `primitives.css` and `themes.css`, with sRGB hex in parentheses for reference. *D* = Dark (also `stage`), *L* = Light; "more" = increased contrast.

### 4.1 Neutrals and surfaces
Every role in this table, and the ink washes, the playhead, loop and staff tokens and the scrim, has chroma 0 in every context (`tokens.test.ts`, "neutral interface").

| Role | D | L | D more | L more | Use |
|---|---|---|---|---|---|
| `--background` (= `--paper`, `--surface-sunken`) | `oklch(0 0 0)` (`#000`) | `oklch(1 0 0)` (`#fff`) | same | same | The page, the notation's ground, wells inside cards (fields, steppers) |
| `--card` (= `--surface-raised`, `--sidebar`) | `oklch(0.182 0 0)` (`#121212`) | `oklch(1 0 0)` (`#fff`) | same | same | Cards and panels. In Light a card is the page colour and is told apart by its 1 px `--border` |
| `--popover` | `oklch(0.218 0 0)` (`#1a1a1a`) | `oklch(1 0 0)` (`#fff`) | same | same | Menus, popovers, tooltips, dialogs, sheets |
| `--muted` (= `--secondary`) | `oklch(0.239 0 0)` (`#1f1f1f`) | `oklch(0.97 0 0)` (`#f5f5f5`) | same | same | The secondary button's fill, quiet panels, the segmented track, the current nav link, row hover |
| `--accent` (hover/selected well) | `oklch(0.285 0 0)` (`#2a2a2a`) | `oklch(0.943 0 0)` (`#ececec`) | same | same | Hover on secondary buttons, focused menu items, the segmented capsule in Dark (`--capsule`), toasts, the HUD |
| `--foreground` (= `--ink`, every `*-foreground` on a neutral) | `oklch(1 0 0)` (`#fff`) | `oklch(0.159 0 0)` (`#0d0d0d`) | same | same | Text, notation, chord names, the song-map now-line |
| `--muted-foreground` | `oklch(0.715 0 0)` (`#a3a3a3`) | `oklch(0.42 0 0)` (`#4d4d4d`) | `oklch(0.845 0 0)` (`#ccc`) | `oklch(0.321 0 0)` (`#333`) | Secondary text, unselected tabs and segments, icon buttons at rest |
| `--faint-foreground` | `oklch(0.67 0 0)` (`#959595`) | `oklch(0.52 0 0)` (`#696969`) | `oklch(0.77 0 0)` (`#b4b4b4`) | `oklch(0.42 0 0)` (`#4d4d4d`) | Meta lines, captions, placeholders, units, bar numbers, played tab digits, "Probably" outlines |
| `--border` (hairline dividers) | `oklch(0.269 0 0)` (`#262626`) | `oklch(0.922 0 0)` (`#e5e5e5`) | `oklch(0.36 0 0)` (`#3d3d3d`) | `oklch(0.77 0 0)` (`#b4b4b4`) | Card and panel edges, list rules, region dividers (no contrast minimum: decorative) |
| `--border-strong` | `oklch(0.36 0 0)` (`#3d3d3d`) | `oklch(0.845 0 0)` (`#ccc`) | `oklch(0.478 0 0)` (`#5d5d5d`) | `oklch(0.65 0 0)` (`#8f8f8f`) | The ring of outline and quiet buttons, chips, badges, kbd, toasts; ruler ticks; drop-zone dashes |
| `--input` (identifying boundary, ≥ 3:1) | `oklch(0.545 0 0)` (`#707070`) | `oklch(0.625 0 0)` (`#878787`) | `oklch(0.65 0 0)` (`#8f8f8f`) | `oklch(0.51 0 0)` (`#666`) | Text fields, selects, steppers, checkboxes, switches, slider tracks, the upcoming-beat outline |

Elevation in Dark is lightness: background 0 → card 0.182 → popover 0.218 → muted 0.239 → accent 0.285. In Light the page, cards and popovers are all white; cards are told apart by hairlines and floating layers by their shadow (`--elevation-2`/`-3`, §4.7).

### 4.2 The ink as accent and interaction
| Role | D | L | Use | Paired with |
|---|---|---|---|---|
| `--primary` | `oklch(1 0 0)` (`#fff`) | `oklch(0.159 0 0)` (`#0d0d0d`) | Fills: the primary button, Play, the sounding tab digit, a switch that is on, the done rungs of the speed ladder, a checked radio card's indicator, a pressed chip (`Toggle` sizes `sm`/`md`, such as the Library's instrument chips), Resume practice on Library | `--primary-foreground` text and icons |
| `--primary-foreground` | `oklch(0 0 0)` (`#000`) | `oklch(1 0 0)` (`#fff`) | Text and icons on the ink: the page colour | |
| `--primary-hover` | `oklch(0.885 0 0)` (`#d9d9d9`) | `oklch(0.321 0 0)` (`#333`) | The ink fill on hover: the primary button and Play | `--primary-foreground` (14.9 / 12.6) |
| `--primary-ink` | = `--foreground` | = `--foreground` | Text and icons of on-states (chip on, `on` button, active loop pill, current ladder rung, primary badge), link buttons, the check in a select | |
| `--primary-soft` | `oklch(1 0 0 / 0.12)` | `oklch(0.159 0 0 / 0.08)` | The ink wash: practice-size toggle and icon-button on-states (they sit beside Play, so they stay quieter than a filled chip), the active loop pill, a checked radio card or mix preset, the current ladder rung, the primary badge, the running stage's dot | `--primary-ink` or `--foreground` text |
| `--primary-line` | `oklch(1 0 0 / 0.5)` | `oklch(0.159 0 0 / 0.5)` | The ≥ 3:1 hairline around an ink wash (chip on, `on` buttons, the active loop pill) | |
| `--signal` | = `--foreground` | = `--foreground` | The ink as a **mark**: playhead, loop edges, selected-tab underline, current beat, checkbox and slider fills, progress fill, the This week day dots, the active clip's dot, the edge of an on-switch track and of the ladder's rungs | |
| `--ring` | = `--foreground` | = `--foreground` | Focus outline | |

- **One ink for every job.** The ink is 21:1 on the Dark page and 19.4:1 on the Light page, so one value serves as fill, mark, text and focus in both themes. Night Rehearsal's Daylight split (a darker amber for marks and focus) is gone; `tokens.test.ts` checks that `--primary-ink`, `--signal`, `--ring` and `--ink` all point at `--foreground`.
- **Telling "now" and "on" from text.** Because the ink is also the text colour, a state is carried by shape: a filled pill or box (primary, Play, the sounding digit, a done rung), a 2 px line (the playhead, loop edges, the selected tab), or a wash with a hairline edge (chips, the loop pill). Per component in §12.3.
- **Glow.** `--glow` is `0 0 0 1px var(--primary-line)` in both themes: a 1 px ring of the ink at half strength, dropped under increased contrast and forced colours. No component uses it today: the playhead and the sounding digit drew it in Night Rehearsal and no longer do.
- **Browser-drawn parts** carry the palette too: text selection is the ink at 24 % (`color-mix`), the caret is `--foreground`, scrollbars are `--border-strong` on transparent.

### 4.3 Status
| Role | D | L | Surface (D / L) | Always paired with |
|---|---|---|---|---|
| `--success` (= `--edited`) | `oklch(0.752 0.134 149)` | `oklch(0.48 0.125 148)` | `--success-surface` `oklch(0.262 0.045 150)` / `oklch(0.955 0.025 155)` | Check icon + text ("Ready", "Done"); the edited mark's underline |
| `--destructive` | `oklch(0.705 0.186 24)` (`#ff6765`) | `oklch(0.545 0.205 26)` (`#cd2027`) | `--destructive-surface` `oklch(0.262 0.06 28)` / `oklch(0.955 0.022 28)` | Verb label ("Delete song"), alert icon |
| `--destructive-foreground` | `oklch(0 0 0)` | `oklch(1 0 0)` | — | Text on a solid destructive fill (the confirm button in a delete dialog) |
| `--unsure` | `oklch(0.72 0.137 255)` | `oklch(0.5 0.16 259)` | `--unsure-surface` `oklch(0.255 0.045 258)` / `oklch(0.955 0.02 252)` | Dashed outline + "?" (§5); never alone |
| `--warning` (= `--muted-foreground`) | — | — | `--warning-surface` = `--accent` | Triangle icon + text |
| `--info` (= `--muted-foreground`) | — | — | `--info-surface` = `--card` | Info icon + text |

- The interface has no accent hue and red means error, so **warnings and info are neutral** (a grey badge or banner with an icon and words). Component props `variant="warning" | "info"` stay.
- Status surfaces are **opaque literals** (the `--*-surface-dark|light` primitives). Reason: the token tests' `contrast()` helper composites a translucent *background* over white, so every token used as a background in `CONTRAST_PAIRS` must be opaque; `contrast.test.ts` checks it in every context. The same rule makes `--bar-current`, `--loop-fill` and `--score-loop-fill` opaque (§4.7). Only `--primary-soft`, `--primary-line` and `--scrim` are translucent (also checked); the wash is tested by explicit compositing (§4.6).
- Status colours appear as text, icon, a 1 px border or a status surface, never as a large saturated fill, except the solid destructive button in a confirm dialog.

### 4.4 Categorical: stems, strings, hands
Stems are the one place the app uses hue for identity. Their hue families come from s31a (guitar teal, bass violet, drums sky, vocals pink, keys lime, other warm grey); the values are unchanged in s46. Each was set so that every pair stays ≥ 12 ΔE2000 apart under normal vision and simulated protanopia, deuteranopia and tritanopia in both themes and contrast levels (`palette.test.ts`, `28` §3), each stays ≥ 3:1 on `--background`, `--card` and `--muted`, and its tile letters reach 4.5:1.

| Token | Instrument | **D** | **L** | Second cue |
|---|---|---|---|---|
| `--stem-guitar` | Guitar | `oklch(0.605 0.103 193)` | `oklch(0.51 0.087 195)` | Label "Guitar", tile icon |
| `--stem-bass` | Bass | `oklch(0.756 0.145 307)` | `oklch(0.546 0.181 303)` | Label, tile icon |
| `--stem-drums` | Drums | `oklch(0.85 0.077 216)` | `oklch(0.364 0.052 223)` | Label, tile icon |
| `--stem-vocals` | Vocals | `oklch(0.712 0.186 350)` | `oklch(0.583 0.205 354)` | Label, tile icon |
| `--stem-keys` | Piano / keys | `oklch(0.835 0.13 125)` | `oklch(0.546 0.126 128)` | Label, tile icon |
| `--stem-other` | Other | `oklch(0.677 0.027 87)` | `oklch(0.528 0.028 87)` | Label, tile icon |
| `--stem-mix` | The band (mix-minus) | = `--foreground` | = `--foreground` | Label "Band" |

Measured (s46, Machado 2009 severity 1.0, the `palette.test.ts` method): worst pair D 12.4 (deuteranopia, bass/drums), L 12.4 (protanopia, bass/vocals), the same at increased contrast. Lowest stem contrast on `--background`, `--card` and `--muted`: 4.5:1 in Dark and 4.3:1 in Light (mix included). The closest stem to a status colour is keys against `--success`: 13.7 ΔE2000 in Dark, 12.9 in Light (normal vision); keys and success never share a meaning because a stem always carries its label. Tile letters use `--tile-foreground` (§4.7): `--primary-foreground` (black) in Dark (≥ 5.7:1) and `oklch(0.99 0 0)` in Light (≥ 4.6:1).

- **"Your part" is never a colour:** a "Your part" badge, listed first, and its name.
- **Strings** in chord shapes and the fretboard differ by position and name, never colour.
- **Hands** (piano): left and right have their own tier-3 tokens (§4.7), differ by more than hue (left square-cornered, right rounded; L/R letters on keys and notes; "Left hand"/"Right hand" in names), and "Show hands: Left/Right" dims the other hand to 45 %.
- `--chart-1…5` map to guitar, bass, drums, vocals, keys so charts inherit the same meaning. Progress charts use `--signal` for the main series and a dashed `--muted-foreground` for the comparison series (§12.2).

### 4.5 Usage rules
- **The ink marks "now", the loop, the primary action and on-states**, always with a shape cue:
  - *Now:* the playhead (2 px line, or a block); the sounding note (ink box); the current beat (filled dot); the current-bar wash (`--bar-current`, a grey); the count-in number.
  - *The loop:* the song-map band (grey) and its 2 px ink edges, the notation bracket and wash, the active loop pill (ink wash + hairline), the active clip's dot.
  - *The one primary action of a view* (one filled ink pill per view; a view is a page, a dialog, a sheet or the practice inspector tab), plus Play.
  - *On, selected and progress states of controls:* the selected tab's underline, pressed chips (a filled ink pill; practice-size toggles a wash + line + ink text), a selected radio card (2 px ink edge + wash + check), a switch that is on, a checked checkbox or radio, M/S that are on (filled), an on icon button, slider and progress fills, the `Spinner` arc, done and current step dots, the speed ladder's done and current rungs, the This week day dots, the chord-shape finger dots, and primary badges.
- **Colour only for meaning:** red for errors, destructive actions and the recording indicator; blue for uncertainty; green for success and edited marks; the six stem colours for stems; the two hand colours for piano hands. A stem's hue never carries one of the status meanings: stems always carry a label. No gradients, glows, coloured shadows or glass anywhere in the interface. Home's abstract art is imagery, not interface colour (§11).
- **States are never shown by hue or lightness alone.** A pressed, selected, on or current state has a shape or text cue (underline, raised capsule, check, filled vs outlined, knob position, "On"/"Muted" text) and, where the indicator is a fill or a line, a ≥ 3:1 change against its rest state in both themes. Per component in §12.3.
- Surfaces nest at most three levels (background → card → muted well). Prefer hairlines and whitespace to a card inside a section.
- No transparency or blur over the waveform or notation. **Opaque washes** (`--bar-current`, `--loop-fill`, `--score-loop-fill`, `--unsure-surface`, the status surfaces) are only ever painted **beneath** content: bar-cell and band backgrounds under the digits, staff, waveform bars and playhead. A wash that has to sit over content, or on a ground other than the one it was set for (chips, badges, pills), uses the translucent `--primary-soft`. Translucent washes are never a background that a `CONTRAST_PAIRS` entry is measured on (§4.3, §4.6).

### 4.6 Verified contrast (WCAG 2.2, `colorjs.io` 0.7.1, the values in §4.1–§4.7)
Format: normal (increased contrast) where they differ. `stage` has the Dark values. Minimums are the WCAG floors and never move: 7 for body text on the page and ink on the notation, 4.5 for text, 3 for graphics and UI boundaries.

**Baseline** (the rows `contrast.test.ts` checks to ±0.1 in its "§4.6 baseline values" block, for `dark`, `light` and `stage`):

| Pair | D (`dark`, `stage`) | L (`light`) | Min |
|---|---|---|---|
| `--foreground` / `--background` | 21.0 | 19.4 | 7 |
| `--muted-foreground` / `--card` | 7.4 | 8.5 | 4.5 |
| `--primary-foreground` / `--primary` | 21.0 | 19.4 | 4.5 |
| `--ring` / `--background` | 21.0 | 19.4 | 3 |
| `--input` / `--card` | 3.8 | 3.6 | 3 |
| `--ink` / `--paper` | 21.0 | 19.4 | 7 |
| `--conf-medium` / `--paper` | 21.0 | 19.4 | 4.5 |
| `--conf-low` / `--paper` | 8.5 | 6.1 | 4.5 |
| `--score-loop-edge` / `--paper` | 21.0 | 19.4 | 3 |
| `--score-playhead` / `--paper` | 21.0 | 19.4 | 3 |
| `--staff` / `--paper` | 4.4 | 3.9 | 3 |
| `--staff` / `--score-loop-fill` | 3.9 | 3.6 | 3 |

**Every `CONTRAST_PAIRS` entry** (all pass in all six contexts; measured with the package's `testing/cascade.ts` helper):

| Pair | D | L | Min |
|---|---|---|---|
| `--foreground` / `--card` · `--muted` · `--accent` | 18.7 · 16.5 · 14.4 | 19.4 · 17.8 · 16.4 | 7 · 4.5 · 4.5 |
| `--card-`, `--popover-`, `--secondary-`, `--accent-`, `--sidebar-`, `--sidebar-accent-foreground` on their surfaces | ≥ 14.4 | ≥ 16.4 | 4.5 |
| `--sidebar-primary-foreground` / `--sidebar-primary` | 21.0 | 19.4 | 4.5 |
| `--primary-foreground` / `--primary-hover` | 14.9 | 12.6 | 4.5 |
| `--muted-foreground` / `--background` · `--muted` | 8.3 · 6.5 (13.1 · 10.3) | 8.5 · 7.8 (12.6 · 11.6) | 4.5 |
| `--faint-foreground` / `--background` · `--card` · `--muted` · `--accent` | 7.0 · 6.3 · 5.5 · 4.8 (10.1 · 9.0 · 8.0 · 6.9) | 5.5 · 5.5 · 5.1 · 4.7 (8.5 · 8.5 · 7.8 · 7.2) | 4.5 |
| `--primary-ink` / `--background` · `--card` · `--accent` · `--surface-raised` | 21.0 · 18.7 · 14.4 · 18.7 | 19.4 · 19.4 · 16.4 · 19.4 | 4.5 |
| `--ring` / `--card` · `--muted` | 18.7 · 16.5 | 19.4 · 17.8 | 3 |
| `--signal` / `--background` · `--card` · `--muted` · `--accent` · `--bar-current` · `--score-loop-fill` | 21.0 · 18.7 · 16.5 · 14.4 · 16.5 · 18.4 | 19.4 · 19.4 · 17.8 · 16.4 · 16.4 · 17.8 | 3 |
| `--primary-line` / `--background` · `--card` | 5.3 · 5.3 | 3.6 · 3.6 | 3 |
| `--input` / `--background` · `--muted` · `--surface-raised` · `--surface-sunken` | 4.2 · 3.3 · 3.8 · 4.2 (6.5 · 5.1 · 5.8 · 6.5) | 3.6 · 3.3 · 3.6 · 3.6 (5.7 · 5.3 · 5.7 · 5.7) | 3 |
| `--staff` / `--card` · `--bar-current` · `--unsure-surface` · `--key-white` | 3.9 · 3.5 · 3.3 · 4.1 (5.1 · 4.5 · 4.3 · 3.1) | 3.9 · 3.3 · 3.5 · 3.8 (6.0 · 5.1 · 5.3 · 5.8) | 3 |
| `--ink` / `--score-loop-fill` · `--bar-current` | 18.4 · 16.5 | 17.8 · 16.4 | 7 |
| `--conf-medium` / `--score-loop-fill` | 18.4 | 17.8 | 4.5 |
| `--conf-medium-edge` / `--paper` | 7.0 (10.1) | 5.5 (8.5) | 3 |
| `--conf-low` / `--score-loop-fill` · `--bar-current` · `--unsure-surface` | 7.4 · 6.6 · 6.4 | 5.6 · 5.2 · 5.4 | 4.5 |
| `--edited` / `--paper` | 10.0 | 6.2 | 4.5 |
| `--destructive` / `--background` · `--card` | 7.4 · 6.6 | 5.5 · 5.5 | 4.5 |
| `--destructive-foreground` / `--destructive` | 7.4 | 5.5 | 4.5 |
| `--success` · `--warning` · `--info` / `--card` | 8.9 · 7.4 · 7.4 | 6.2 · 8.5 · 8.5 | 4.5 |
| `--unsure` / `--card` | 7.5 | 6.1 | 4.5 |
| `--stem-*` / `--card` (lowest) · `--stem-mix` | 5.1 (guitar) · 18.7 | 4.7 (vocals, keys) · 19.4 | 3 |
| `--fret-guitar` · `--fret-bass` · `--melody-vocals` / `--paper` | 5.7 · 9.1 · 7.5 | 5.5 · 5.4 · 4.7 | 3 |
| `--fret-guitar` · `--fret-bass` · `--melody-vocals` / `--score-loop-fill` | 5.0 · 8.0 · 6.6 | 5.0 · 4.9 · 4.3 | 3 |
| `--tile-foreground` / lowest stem | 5.7 (guitar) | 4.6 (vocals, keys) | 4.5 |
| `--loop-edge` · `--playhead` / `--card` | 18.7 · 18.7 | 19.4 · 19.4 | 3 |
| `--playhead` / `--loop-fill` | 16.5 | 16.4 | 3 |
| `--foreground` / `--loop-fill` | 16.5 | 16.4 | 4.5 |
| `--waveform-peak` / `--background` · `--card` | 4.0 · 3.5 (6.5 · 5.8) | 3.5 · 3.5 (4.9 · 4.9) | 3 |
| `--waveform-rms` / `--card` | 7.4 (11.7) | 8.5 (12.6) | 3 |
| `--key-black` / `--key-white` | 16.7 | 17.2 | 3 |
| `--key-left` · `--key-right` / `--key-white` | 3.5 · 3.4 | 3.9 · 3.8 | 3 |
| `--key-left` · `--key-right` / `--key-black` | 4.8 · 4.9 | 4.4 · 4.5 | 3 |
| `--key-left-fg` / `--key-left` · `--key-right-fg` / `--key-right` | 4.6 · 4.7 | 4.6 · 4.7 | 4.5 |
| `--hud-fg` / `--hud-bg` | 14.4 | 16.4 | 4.5 |
| `--foreground` / `--capsule` | 14.4 | 19.4 | 4.5 |
| `--foreground` / `--unsure-surface` | 15.8 | 17.1 | 4.5 |
| Surfaces and status surfaces | §4.8 | §4.8 | |

**Where each wash is tested.**
- Opaque washes appear in `CONTRAST_PAIRS` as backgrounds, paired with what is painted on them: ink and digits (`--ink`, `--conf-low`), the staff, the playhead, and the in-loop waveform bars (`--waveform-loop` = `--signal`, so `--signal` / `--bar-current` and `--playhead` / `--loop-fill` cover them).
- The helper's composite-over-white path is never hit by a background. Translucent *foregrounds* (`--primary-line`) are composited over the pair's own background, which is correct.
- The translucent `--primary-soft` is tested only in the explicit block below.

**Translucent washes** (not in `CONTRAST_PAIRS`; the "translucent washes" block in `contrast.test.ts` composites each over every surface it can sit on with `over()`, and checks these values to ±0.1, the note-head row as a lower bound):

| Pair | D | L | Min |
|---|---|---|---|
| `--primary-ink` on `--primary-soft` over `--background` · `--card` · `--muted` | 16.6 · 13.5 · 11.4 | 16.4 · 16.4 · 15.1 | 4.5 |
| `--foreground` on `--primary-soft` over `--card` | 13.5 | 16.4 | 4.5 |
| `--ink` on a Notes head (`--fret-*`/`--melody-vocals` at 30 % over `--paper`) | ≥ 12.6 | ≥ 12.4 | 4.5 |

The same block checks PedalHud text on `--hud-bg` over `--paper`, `--background` and `--card` (14.4 in Dark, 16.4 in Light; the HUD is opaque).

### 4.7 Component tokens (tier 3) and the remaining roles
| Token | D | L | Notes |
|---|---|---|---|
| `--bar-current` (the bar being played) | `oklch(0.239 0 0)` | `oklch(0.943 0 0)` | Opaque grey. A bar-cell background **beneath** the staff, digits and playhead; never an overlay |
| `--loop-fill` (song-map loop band) | = `--bar-current` | = `--bar-current` | Painted **beneath** the waveform bars (bars inside the loop are `--waveform-loop`), with the 2 px `--loop-edge` edges, the unsure hatch and the now-line drawn over the bars (V17) |
| `--score-loop-fill` (bars in the loop on the notation) | `oklch(0.191 0 0)` | `oklch(0.97 0 0)` | Opaque; a bar-cell background beneath the content, like `--bar-current` |
| `--loop-edge`, `--playhead`, `--score-loop-edge`, `--score-playhead` | = `--signal` | = `--signal` | 2 px; the ink. No glow |
| `--now-line` (song map) | = `--foreground` | = `--foreground` | 2 px |
| `--staff` (tab and staff lines, bar lines, chord-shape grid) | `oklch(0.555 0 0)`; more `oklch(0.62 0 0)` | `oklch(0.6 0 0)`; more `oklch(0.5 0 0)` | ≥ 3:1 on the paper and every wash it crosses (§4.9 V1) |
| `--waveform-peak` (unplayed bars) | `oklch(0.53 0 0)`; more `oklch(0.65 0 0)` | `oklch(0.63 0 0)`; more `oklch(0.55 0 0)` | Opaque (V7) |
| `--waveform-rms`, `--waveform-played` | = `--muted-foreground` | = `--muted-foreground` | Played bars |
| `--waveform-loop` (bars inside the loop) | = `--signal` | = `--signal` | |
| `--hatch` (unsure bars on the song map) | = `--unsure` | = `--unsure` | 135° stripes, 2 px on 2 px off; a pattern, not a colour |
| `--beat-now`, `--beat-done`, `--beat-slot` (beat pulse) | `--signal` · `--faint-foreground` · outline `--input` | same roles | Downbeat is a square, others round (§10) |
| `--key-white`, `--key-black` | `oklch(0.95 0 0)` · `oklch(0.165 0 0)` | `oklch(0.99 0 0)` · `oklch(0.21 0 0)` | A keyboard looks like a keyboard in both themes (V8) |
| `--key-left`, `--key-right` | `oklch(0.59 0.11 230)` · `oklch(0.59 0.13 128)` | same | Hand fills on keys and falling notes (V8) |
| `--key-left-fg`, `--key-right-fg` | `oklch(0.19 0 0)` | same | L/R letters on lit keys and notes |
| `--fret-guitar`, `--fret-bass`, `--melody-vocals` | = the stem | = the stem | Instrument marks on the notation |
| `--tile-foreground` | = `--primary-foreground` | `oklch(0.99 0 0)` | Icons on stem tiles |
| `--capsule` | = `--accent` | = `--card` | The segmented control's pressed capsule (`bg-capsule`), with `--foreground` text (14.4 / 19.4); forced colours `Canvas` |
| `--hud-bg`, `--hud-bg-more`, `--hud-fg` | = `--accent` · = `--accent` · = `--foreground` | same | PedalHud pill; opaque in both contrast levels |
| `--scrim` | `oklch(0 0 0 / 0.7)` | `oklch(0 0 0 / 0.5)` | Behind dialogs and sheets; translucent black (`tokens.test.ts`) |
| `--elevation-1` | `0 0 0 0 transparent` | same | Cards are bordered, not lifted |
| `--elevation-2` | `0 2px 6px oklch(0 0 0 / 0.3), 0 16px 40px oklch(0 0 0 / 0.5)` | `0 2px 6px oklch(0 0 0 / 0.04), 0 12px 32px oklch(0 0 0 / 0.1)` | Menus, popovers, tooltips, toasts, the pass prompt |
| `--elevation-3` | `0 2px 6px oklch(0 0 0 / 0.3), 0 24px 64px oklch(0 0 0 / 0.6)` | `0 2px 6px oklch(0 0 0 / 0.05), 0 24px 64px oklch(0 0 0 / 0.14)` | Dialogs and sheets. Both levels are a close shadow under a wide one, in black only (`tokens.test.ts`) |
| `--elevation-capsule` | `0 1px 2px oklch(0 0 0 / 0.12)` | same | The segmented control's raised capsule |
| `--elevation-play` | `0 0 0 0 transparent` | same | Play has no shadow (Night Rehearsal's haze is gone); kept as a token so `shadow-play` still resolves |
| `--glow` | `0 0 0 1px var(--primary-line)`; more: none | same | §4.2 |
| `--muted-foreground-more`, `--faint-foreground-more`, `--border-more`, `--border-strong-more`, `--input-more` | the "more" columns of §4.1 | same | The increased-contrast values as their own roles |
| `--focus-width` | `2px`; more `3px` | same | |
| `--read-scale` | `1`; `stage` `1.25` | `1` | §6.3 |
| `--stem-mix` | = `--foreground` | same | |
| `--chart-1…5` | guitar, bass, drums, vocals, keys stems | same | |
| `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring` | = `--card`, `--card-foreground`, `--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`, `--border`, `--ring` | same | |

"No shadow" is a transparent zero shadow, not the keyword `none`: Tailwind composes `shadow-*` and `ring-*` into one `box-shadow` list, and a `none` in that list would void the whole declaration. Component tokens point at a semantic role or carry their own tuned literal, never a primitive step (`tokens.test.ts`). Every role listed in `index.ts` (`SEMANTIC_ROLES`, `ALIAS_ROLES`, `COMPONENT_TOKENS`) has a value in this section or §4.1–§4.4, in every context.

### 4.8 Surfaces and status tints
- **Raised** = `--card` (= `--surface-raised`); **sunken** = `--background` (= `--surface-sunken`). Inside a card, a sunken well (field, select, stepper, search box) is the page colour, in both themes. In Light the card and the well are both white, so the well is told apart by its `--input` edge.
- **Status surfaces** are opaque literals (§4.3); `--warning-surface` = `--accent`, `--info-surface` = `--card`.
- A status surface always carries an icon and text (§4.3, §13).
- **Verified contrast** (the rows `contrast.test.ts` checks to ±0.1 in its "§4.8 surface and status-surface values" block; normal contrast, and increased contrast for the muted rows; `stage` has the Dark values):

| Pair | D (`dark`, `stage`) | L (`light`) | Min |
|---|---|---|---|
| `--foreground` / `--surface-raised` · `--surface-sunken` | 18.7 · 21.0 | 19.4 · 19.4 | 4.5 |
| `--muted-foreground` / `--surface-raised` · `--surface-sunken` | 7.4 · 8.3 | 8.5 · 8.5 | 4.5 |
| (increased contrast) `--muted-foreground` / `--surface-raised` · `--surface-sunken` | 11.7 · 13.1 | 12.6 · 12.6 | 4.5 |
| `--foreground` / `--success-surface` · `--warning-surface` · `--info-surface` · `--destructive-surface` | 15.2 · 14.4 · 18.7 · 15.8 | 17.2 · 16.4 · 19.4 · 16.9 | 4.5 |
| `--success` / `--success-surface` | 7.3 | 5.5 | 4.5 |
| `--warning` / `--warning-surface` | 5.7 (8.9) | 7.2 (10.7) | 4.5 |
| `--info` / `--info-surface` | 7.4 (11.7) | 8.5 (12.6) | 4.5 |
| `--destructive` / `--destructive-surface` | 5.5 | 4.8 | 4.5 |
| `--unsure` / `--unsure-surface` | 6.4 | 5.4 | 4.5 |

### 4.9 Deviation register (history: where s31a departed from the mockups)
The mockups in `redesign/mockups/` and `splitune.css` are **historical**. They were the visual source for s32–s38 (Night Rehearsal) and are no longer a source from s46: no step compares a screen against them, and design QA measures against the code, this doc and Storybook (`28` §5). This register is kept because several of its corrections became rules that still bind; the rows that only corrected the amber accent are retired. V1, V2 and V6 were owner decision D5 (G1, 2026-11-08); the other rows were accepted under the owner's blanket pre-approval of the gates. V11 and V15 restore existing repo rules (64 px practice targets, today's reading sizes).

| # | What | Mockup | Rule today | Why / status |
|---|---|---|---|---|
| V1 | Tab/staff lines, bar lines, chord-shape grid | `--line` (1.7:1 N, 1.5:1 D) | `--staff` (≥ 3.3:1) | **Binding.** Lines carry the string and bar a digit belongs to (WCAG 1.4.11) |
| V2 | Text-field, stepper, checkbox, slider-track boundaries; upcoming beat outline | `--line` | `--input` (≥ 3.3:1) | **Binding.** WCAG 1.4.11 |
| V3 | Daylight amber marks | `--acc` (1.8:1) | — | **Retired** (s46): marks are the ink, ≥ 14:1 everywhere |
| V4 | Daylight focus ring | `--acc` | — | **Retired** (s46): `--ring` is the ink in both themes |
| V5 | Daylight `--primary-line` | α 0.60 | `oklch(0.159 0 0 / 0.5)` (3.6:1) | **Retired** as a correction; the ink hairline still has to reach 3:1 (`CONTRAST_PAIRS`) |
| V6 | Stem colours, both themes | s31a mockup values | §4.4 values | **Binding.** CVD separation test; unchanged in s46 |
| V7 | Waveform unplayed bars | `--tx3` α 0.55 | `--waveform-peak` opaque | **Binding.** 3:1 for the overview graphic |
| V8 | Piano keyboard and hand colours | white keys `--tx` (inverted in Daylight), hands from stem colours | §4.7 key tokens | **Binding.** Keys stay white and black in both themes; hands ≥ 3:1 on white keys |
| V9 | Text on the solid danger button | `oklch(0.99 0 0)` | `--destructive-foreground`: black in Dark (7.4:1), white in Light (5.5:1) | **Binding.** 1.4.3 |
| V10 | Text below 11 px (song-map ruler, ladder rung labels, shape labels) | 10 px | 11 px (`text-2xs`) | **Binding.** Floor for any text; the superscript "?" stays 10 px as a glyph |
| V11 | Main practice controls (§8) | Painted 40–52 in the mockups | **64** painted and hit, every layout | **Binding.** The repo rule since step 10a |
| V12 | Secondary and browse controls painted under their target | `.btn` 40, `.btn.sm` 32, `.chip` 30, `.seg` items 34, `.ms` 32, `.stepper` halves 36 × 40 | Painted size kept; the control's box grows to 48 (practice) or 44 (elsewhere) with transparent padding around the painted shape | **Binding.** Target rule (§8) |
| V13 | Song-map section chips | 22 tall | Box 24 tall (min width 24) on fine pointers; 48 on coarse pointers | **Binding.** The only use of the 24 px floor (§8) |
| V14 | Inspector width | 360–400 by tab | 380 at every tab | **Binding.** A docked panel that changes width per tab moves the notation |
| V15 | Reading sizes (§6.3) | Smaller than today's | §6.3 values | **Binding.** Never below today's sizes, 16′ digits and 0.4° chord capitals |
| V16 | Switch on-track and speed-ladder done rungs | Amber fill alone | Ink fill with a 1 px `--signal` edge | **Retired** as a correction (s46): the ink fill alone is ≥ 14:1 against the track and an upcoming rung; the components keep the edge, which now matches the fill |
| V17 | Washes and status tints | Translucent, painted over whatever ground they sit on | Opaque literals painted beneath content; the song-map band sits under the waveform bars | **Binding.** The token tests can only contrast-test an opaque background |

## 5. Confidence encoding (one rule for every surface)
Ordinal, from `05-analysis-schema.md` bands. **Marks show for every stage that produces bands today, and keep showing** until calibration check **C1** says otherwise for a stage. *C1* (a research check from `redesign/report.md` "Research and testing gates", where it is called G2; not an owner gate) asks, per stage and model (beats, chords, notes per instrument), whether the bands mean what they say. A stage counts as **calibrated** when its model has an `isotonic` `CalibrationTable` in `services/ml/config/calibration/` fitted on a named test set (`fitted_on`), and on that set the observed error rate of each band is within ±5 percentage points of the frequency the UI states for it (reliability diagram from the eval harness, `08`), with at least 200 items per band. A stage whose table is `identity`, or which fails the ±5 point check, is reported to the owner; **the owner decides** whether its marks change; if they are hidden, the legend line says that this part's confidence isn't checked, so no note reads as sure by default. No step hides marks without that decision. Cues, strongest first: **outline → glyph → colour → words on focus.** No blur, no opacity on ink (digits must stay ≥ 4.5:1).

| Level (name in the UI) | Ink | Outline | Glyph | Example |
|---|---|---|---|---|
| High — *Sure* | `--ink` | none | none | `5` |
| Medium — *Probably* | `--ink` | 1.5 px **dashed**, `--conf-medium-edge` (= `--faint-foreground`), 1 px offset | none | dashed box around `5`; chord chip with a dashed border |
| Low — *Unsure* | `--conf-low` (= `--unsure`) | 1.5 px dashed `--unsure` | superscript **"?"** (10 px, 700) | unsure digit, chord name or chip "Am ?" |
| Edited by you | `--edited` | 2 px underline, 3 px offset | none | the accessible name adds "edited by you" |
| Sounding now | `--primary-foreground` on `--primary` (the page colour on an ink box) | none | none | the beat's tab digits as filled boxes |
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
| UI, chord names, headings, display sizes, and **every number that changes** (transport position and time, the speed readout, NumberField values, meters, speed-ladder labels, song-map bar numbers, stage ETAs, library stats, the record timer, the reading-size value) | **Figtree** 2.002 Variable (`wght` 400–700, roman) | SIL OFL 1.1 | The only preloaded font. `--font-display` is the same family: there is no separate display cut. Numbers use `tabular-nums` (Figtree keeps `tnum`, `case` and `ss01`), so they keep their width as digits change. The practice readouts use the reading family (`font-reading`), which is Figtree unless Hyperlegible is on |
| **Tab digits** and their fret-digit samples (`font-reading-mono`: the alphaTab overlay, the confidence legend, the notation pane and Fix-mode keys, the onboarding reading sample); keycaps and menu shortcut hints (`Kbd`, `DropdownMenu`); the build commit on About and error ids | **JetBrains Mono** 2.304 Variable (`wght` 400–700) | SIL OFL 1.1 | Monospaced, so its digits are tabular without a `tnum` feature. Not preloaded; `font-display: swap` with a metric-matched fallback |
| Standard notation glyphs | **Bravura** (alphaTab's SMuFL font) | SIL OFL 1.1 | Self-hosted per `12` §3 |
| Hyperlegible reading option | **Atkinson Hyperlegible Next** (`wght` 200–800, roman) | SIL OFL 1.1 | Settings "Hyperlegible font" swaps the reading tokens' family (tab digits, chord names, practice readouts), not chrome. Loads on first use |
| Fallback stacks | UI and display `"Figtree", "Figtree Fallback", ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif`; mono `"JetBrains Mono", "JetBrains Mono Fallback", ui-monospace, "Cascadia Mono", Consolas, monospace` | — | Fallback faces in `fonts.css` (`scripts/fonts/fallback-metrics.py`): "Figtree Fallback" is Arial / Helvetica / Liberation Sans at `size-adjust` 101.19 %, ascent 93.88 %, descent 24.71 %, line gap 0; "JetBrains Mono Fallback" is Courier New / Liberation Mono at 99.98 %, 102.02 %, 30 %, 0 |

- **Why Figtree.** OpenAI Sans is not available under an open licence. For s46 its glyph metrics were measured at weight 500 and 91 open-licence families were ranked against them. Figtree has the same x-height (0.50 em), cap height (0.70 em), ascender and descender, the same stem width, and average advance widths within 2.5 %. It replaces Instrument Sans everywhere.
- **Weights in use.** Chrome uses 400 and 500 (§6.2); 600 for the wordmark, `text-2xs` and a few numbers; the reading tokens keep 600–700 (§6.3). Never 700 in chrome.
- **Subsetting** (`scripts/fonts/subset.sh`): pinned upstream files with SHA-256 (Figtree from `google/fonts` at a pinned commit, JetBrains Mono from its v2.304 release, Atkinson Hyperlegible Next from `google/fonts`), `varLib.instancer` to `wght` 400–700 for Figtree and JetBrains Mono (Atkinson keeps its whole axis), `pyftsubset --layout-features='*'` (keeps `tnum`, `zero`, `case`, `ss*`, `cv*`), Basic Latin, Latin-1, common Latin extras, general punctuation, € − ← ↑ → ↓ ↵ ⇧ ⌘ ⌥ ♭ ♮ ♯ (where a family has them). Neither Figtree nor JetBrains Mono maps U+202F (narrow no-break space); the script maps it to the font's own no-break space glyph. Shipped sizes: `Figtree.woff2` 19,580 bytes (preload budget 80 KB), `JetBrainsMono.woff2` 35,704, `AtkinsonHyperlegibleNext.woff2` 33,696. OFL texts ship beside the fonts.
- **Font test** (`scripts/fonts/fonts.test.mjs`): exactly these three files, each with its licence and declared once in `fonts.css`; only Figtree preloaded and within 80 KB; every §6.1 code point present apart from known upstream gaps (Figtree lacks only U+00AD, the soft hyphen, which is never drawn); `tnum` (or fixed pitch) kept; the layout features above kept; a `wght` axis only, at the weights above.
- **Glyphs.** Every family must cover − · × ÷ → ← ↑ ↓ ‹ › – — and U+202F. Where a family lacks ♯/♭, `ChordSymbol` draws them from the fallback, lifted 0.16 em. Chord quality ° ø △ come from Bravura's SMuFL `csym` range.
- **Legibility check:** JetBrains Mono tab digits against Figtree's tabular digits on the confusable pairs 1/7, 3/8, 6/0 at the three distances (the Foundations/Fonts › Legibility story). If a family fails (glyphs, `tnum`, misreadings), the owner picks a replacement and this section records it.
- alphaTab's `display.resources.tablatureFont`, `barNumberFont` and `fretboardNumberFont` use the active reading family at the reading-token size.

### 6.2 Browse scale (rem; root 16 px, so browser zoom and 200 % text work)
Values from `theme.tailwind.css` (`tokens.test.ts` checks size, line height, weight and tracking). A step without a weight inherits 400. Tracking tightens as the size grows and never passes −0.03em.

| Token | Size / line height (px) | Weight · tracking | Use |
|---|---|---|---|
| `text-2xs` | 11 / 14 | 600 | Section chips, song-map ruler numbers, ladder rung labels (tabular figures) |
| `text-xs` | 12 / 16 | 500 | Badges, `Kbd` (mono), bottom-nav labels |
| `text-sm` | 13 / 18 | 400 (labels add 500) | Captions and meta lines, field labels, chips, small buttons |
| `text-md` | 14 / 20 | 500 | Buttons, tabs, segments, nav links, menu items |
| `text-button-lg` | 16 / 22 | 500 | Large buttons (`lg`, `xl`) |
| `text-base` | 15 / 22 | 400 · −0.01em | App body, fields |
| `text-lead` | 17 / 28 (line height 1.65) | 400 · −0.01em | Marketing and long-form body, the wordmark's size |
| `text-lg` | 17 / 24 | 500 · −0.01em | Card and row titles, `h3` |
| `text-xl` | 22 / 28 | 500 · −0.01em | Section headings (`h2`) |
| `text-2xl` | 32 / 38 | 500 · −0.02em | Page titles (`h1`) |
| `text-3xl` | 44 / 48 | 500 · −0.03em | Large headings: How it works step sections, Home's closing panel and onboarding step titles from `sm`, the Fix card's chord guess |
| `text-4xl` | 48 / 52 | 500 · −0.03em | Legal page titles, prices on Pricing, phone-size Pricing and How it works titles, the recording timer |
| `text-5xl` | 56 / 60 | 500 · −0.03em | The largest page titles: Pricing and How it works |
| `text-display` | `clamp(2.5rem, 5.6vw, 4rem)` (40–64) / 1.1 | 500 · −0.03em | Home headline, with `text-balance` |

- Headings take their weight and tracking from the token; components don't add `font-*` or `tracking-*` to them. Buttons: `sm` 13/500, `md` 14/500, `lg` and `xl` 16/500 (`text-button-lg`), `practice` 17/500 (`text-lg`).
- Secondary text is `text-muted-foreground`; meta lines and captions `text-sm text-faint-foreground`. A meta line reads like "Guitar · 3:34".
- Sentence case everywhere. **No uppercase labels and no letter-spaced eyebrows** above headings; no section numbers as decoration. Nothing below 11 px except the "?" glyph (§4.9 V10).
- Numbers that change are Figtree with `tabular-nums`; `font-mono` (JetBrains Mono) only for tab digits, keycaps and shortcut hints, the build commit and error ids.

### 6.3 Practice reading scale (distance presets)
Sizes are CSS px at 100 % Reading size, then × the Reading size calibration (80–140 % in 10 % steps, "Can you read the fret numbers from where you play?") and × `--read-scale`. **Floors** (binding): every value is at least the pre-redesign size (`packages/ui-tokens/src/theme.tailwind.css` and the assertions in `tokens.test.ts`: Stand tab 36, Desk current chord 32, Floor current chord 88), tab digits are never below 18 px (`score-theme.ts`, `--read-tab` `max(1.125rem, …)`), and at 100 % each preset meets the visual-angle rationale below. Where the s31a mockups drew smaller, the deviation is V15 (§4.9). s46 did not change these sizes or weights.

**Rationale (conversion used for every number):** 0.19 mm per CSS px (the report's iPad figure, "7.1 mm ≈ 37 CSS px"; laptops are 0.19–0.22 mm/px, so desk values err large); digit and cap height 0.7 em. Tab digits need a digit height of at least **16′** of arc (target 22′; ISO 9241-303 as reported); chord names read while playing need cap heights of at least **0.4°** (report: "capitals of chord names 0.4–0.6°"). At 0.5 / 0.75 / 1.5 m that is a tab font of ≥ 17.5 / 26 / 53 px (22′: 24 / 36 / 72) and a chord font of ≥ 27 / 40 / 79 px.

| Token | Use | **Desk** 0.5 m | **Music stand** 0.75 m | **Floor** 1.5 m | Before the redesign (D / S / F) |
|---|---|---|---|---|---|
| `--read-tab` | Tab digits (JetBrains Mono 600) | 24 (22′) | 36 (22′) | 54 (16′) | 24 / 36 / 36 |
| `--read-chord` | Chord names over the notation, "Then" chips, chord chips (700) | 27 | 40 | 79 | 22 / 32 / 56 |
| `--read-chord-sheet` | Chord sheet and piano chart names (650) | 30 | 44 | 88 | — |
| `--read-chord-current` | The current chord (600; Now column, glance, Stand view) | 112 | 150 | 200 | 32 / 48 / 88 |
| `--read-chord-next` | The next chord (650) | 56 | 64 | 100 | (chips: 22 / 32 / 56) |
| `--read-bar-number` | Bar numbers, bar.beat in the glance view (reading family, tabular) | 14 | 20 | 40 | 14 / 20 / 40 |
| `--read-readout` | Position, speed %, loop counter (reading family 600, tabular) | 22 | 28 | 40 | 20 / 28 / 40 |
| `--read-label` | Practice labels ("Now · bar 26 · beat 3") | 14 | 20 | 24 | 14 / 20 / 24 |

- Tab string spacing follows the digit (`ceil(0.92 × --read-tab)`, as built in step 17c, never less than the digit + 4 px).
- **Automatic** (the default) resolves as before: fine pointer → Desk; coarse pointer → Music stand; coarse phone → Floor.
- **Stand view** (tablet layout, `27` §3.7.2) uses the resolved preset for every token except `--read-chord-current` and `--read-chord-next`, which it draws one step larger (Music stand → 200 / 100; Floor stays Floor).
- **Phone glance** (at Floor by default) uses the Floor tokens; the current chord is clamped to 43 % of the glance column's width (150 px at 390) and the next chord to `clamp(56px, 16.5cqi, var(--read-chord-next))` (64 at 390); neither drops below 88 / 56.
- **`stage`** resolves to at least Music stand, then × 1.25 (`--read-scale`; §2).
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
- **Grid:** 4 px base (`--spacing: 0.25rem`). Page gutters `px-4 sm:px-6 lg:px-8` (16 / 24 / 32); the app bar pads 16 on phones and 20 from `sm`.
- **Breakpoints:** Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536). Content widths: Library 1260 px, Settings 1180 px, Pricing 1040 px, marketing sections 1240 px, onboarding 1120 px, forms 400 px, reading 72 ch (`--container-library`, `-settings`, `-pricing`, `-marketing`, `-onboarding`, `-form`, `-reading`); `--container-page` 1200 and `--container-bare` 480 serve the older page and bare shells.
- **Generous and calm.** Marketing sections are separated by whitespace (Home: 96 px between sections, 120 from `sm`), not by alternating background bands or border rules. A section header is an `h2` at `text-xl` on the left with an optional text link on the right, then the content. Lists before card grids; a settings group is a heading plus rows divided by hairlines, not a card per setting. Short hero copy is centred; everything that is read is left-aligned.
- **App bar:** 64 px (library, settings, marketing), with no rule under it; practice top bar 60 px; phone bars 56 px; phone bottom navigation 76 px + safe area, with a hairline above it.
- **Practice regions (desktop):** top bar 60; song map (section chips 24 + map 40 + ruler 14); Now column 264; notation canvas flexible; inspector 380 (§4.9 V14); transport dock 96 (Fix mode 80), holding 64 px controls (§8). Below 1280 px the dock's mix pill shows only its icon and the volume slider moves into a popover, so the 64 px controls never wrap. Region behaviour by width in `27` §3.7.
- **Layout selection** on the practice route uses viewport size, `(pointer: coarse)` and orientation (feature queries, no UA sniffing): desktop, tablet Stand view (the tablet default), tablet full layout, phone portrait (glance), phone landscape (`27` §3.7.2).
- **Safe areas:** fixed bars pad with `env(safe-area-inset-*)`; sticky bars set `scroll-padding` so a focused element is never hidden (WCAG 2.4.11).
- **Density:** *browse* (library, settings, Add song: 44 px targets, browse type) and *practice* (64 px main controls, 48 px secondary, reading scale). A data attribute on the shell (`data-density`), so shared components pick practice sizes automatically through `--control-size`.

## 8. Targets and hit areas (CSS px)
A target is **the interactive element's own border box**: what `getBoundingClientRect()` returns and what the `28` §3 size probe measures. Where a control paints a smaller shape (a 40 px pill, a 30 px chip), the element keeps the target size with a transparent border or padding and the painted shape is an inner layer; no `::after` extensions, so the probe measures what the pointer hits. Neighbouring targets never overlap.

| Token | Size | Use |
|---|---|---|
| `--target-practice` | **64 × 64**, painted at 64 | **Main practice controls, in every layout (desktop, tablet full layout, phone, Fix mode):** Play/Pause (phone 72), restart loop / back a bar, previous and next bar, speed − and + (and the speed readout beside them), the loop toggle or loop pill (64 tall), count-in, **Felt clean** and **Not yet**, "Loop this bar" in the glance view |
| `--target-stand` | 88 tall, ¼ of the dock wide | Stand view's four pedal-mirroring buttons (Restart loop, Play/Pause, Felt clean, Not yet) |
| `--target-practice-2` | 48 × 48 | **Secondary practice controls:** click/metronome, the mix pill, volume, M/S, the view switch items, inspector tabs, Level / Capo rows, chord chips that open Fix, the legend chip, practice top-bar icon buttons, Tools sheet tiles and its M buttons, Fix-mode "Listen to" items, section chips on coarse pointers |
| `--target` | 44 × 44 | **Everything else** interactive, every pointer type (WCAG 2.5.5 level, the internal rule) |
| `--target-min` | 24 × 24 | WCAG 2.5.8 AA floor. **One exception uses it:** the song-map section chips on fine pointers (box 24 tall, min width 24, 2 px apart; every section is also reachable with Tab/arrow keys on the chip row, from ⌘K and from the Loop tab's section badge). Nothing else may be under 44 |

- `--target-sm` (32) is still defined (`tokens.test.ts` checks it) but no size rule uses it: the Button `sm` size is a 32 px painted face inside a 44 box.
- Primary practice targets cluster at the bottom edge; actions fire on pointer-up and cancel if the pointer slides off; destructive actions are undoable rather than confirm-gated, except delete song and delete account.
- **No drag required (WCAG 2.5.7):** loop handles have From/To steppers; faders accept a single click on the track and the dB readout opens a stepper; speed has −/+ and presets; inspector and drawer edges have a toggle button.

## 9. Shape, borders and elevation
- **Radius scale** (`--radius` 10 px base; unchanged in s46, checked by `tokens.test.ts`). What changed is which step each component uses:

| Utility | px | Use |
|---|---|---|
| `rounded-xs` | 4 | Tab-digit and sounding-digit boxes, `Kbd`, checkbox boxes, the shaky-bar outline |
| `rounded-sm` | 6 | Small inline marks |
| `rounded-md` | 8 | **Media and thumbnails:** Home's art, stem tiles on song cards, link focus wrappers |
| `rounded-lg` | 10 | Menu and select items, tooltips, bottom-nav items |
| `rounded-xl` | 12 | **Fields and cards:** text fields, selects, the stepper well, cards, radio cards, song cards, mix presets, panels, Home's closing panel |
| `rounded-2xl` | 14 | Select and dropdown popups, toasts |
| `rounded-3xl` | 16 | Popovers, the vertical segmented track |
| `rounded-4xl` | 22 | Dialogs, side drawers |
| `rounded-5xl` | 24 | Phone bottom sheets' top corners |
| `rounded-full` | — | **Every control:** buttons, icon buttons and transport buttons (circles, pills once a label widens them), chips, the segmented track and its capsule, badges, switches, slider tracks and thumbs, progress bars, beat dots, avatar |

  Nothing but a pill is rounder than `rounded-5xl`.
- **Borders:** 1 px `--border` for cards, panels and list rules; a 1 px `--border-strong` inset ring for outline, quiet and box buttons, chips, outline badges and toasts; `--input` where the border is the only boundary of a control (fields turn to the ink on hover and focus); dashed `--border-strong` for drop zones; 2 px `--signal` for the selected tab and loop edges. The secondary button has no edge.
- **Elevation:** cards none (bordered); menus, popovers, tooltips and toasts `--elevation-2`; dialogs and sheets `--elevation-3`. Under increased contrast and forced colours every component keeps its 1 px border (a shadow is not a boundary).
- **Focus:** 2 px solid `outline` in `--ring` (the ink), 2 px offset (3 px wide under increased contrast); fields use a -1 px offset, so the ring covers their 1 px edge and reads as one line instead of a double ring; buttons and chips set the offset so it sits 2 px off the painted face, not the padded box. Never `outline: none` without a replacement (lint-enforced).

## 10. Motion
| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 100 ms | Toggles, chips, switches, transport presses |
| `--duration-base` | 200 ms | Buttons, fields, cards, popovers, tooltips, toasts, tab switch, the song-map loop band |
| `--duration-slow` | 300 ms | Drawer, sheet, dialog, page turn |
| `--duration-slower` | 400 ms | Route cross-fade, library grid ↔ list morph, the segmented capsule's slide |
| `--stagger` | 40 ms | Between siblings in `stagger-children` (cap 8) |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default (also Tailwind's default timing function) |
| `--ease-enter` / `--ease-exit` | `cubic-bezier(0, 0, 0, 1)` / `cubic-bezier(0.3, 0, 1, 1)` | Appearing / leaving |
| `--ease-spring` | `cubic-bezier(0.34, 1.3, 0.64, 1)` | Small confirmations only (a pass check, transport presses) |
| `--ease-smooth`, `--ease-snappy` | `linear()` springs sampled over 400 ms | Layout morphs; the segmented capsule |

- The tokens are unchanged in s46. Interface changes are fades and small translations at 200 ms with `--ease-standard`, as on openai.com; a pressed button scales to 0.97.
- **UI transitions stay within 150–250 ms** for sheets, selection and docking; 300 ms only for full sheets and dialogs.
- **The music drives the only continuous motion.** The playhead, the sounding-note highlight and rolls sit on their own compositor layer and move with `transform`; position is a pure function of the audio clock read once per frame (`AudioContext.getOutputTimestamp()` in `requestAnimationFrame`, `currentTime` fallback where the output timestamp is unreliable; `12` §3). Nothing eases the time → position mapping; no extrapolation.
- **Follow modes** (`12` §3): Page (default), Scroll, Off. Pausing playback stops any scrolling (WCAG 2.2.2).
- **Reduced motion** (`prefers-reduced-motion: reduce`, or Settings "Reduce motion: Follow system / On / Off"): durations become 0; notation turns page by page (Page is the only follow mode); the playhead moves in steps by beat; rolls hold a bar at a time; fades are dropped; the beat pulse becomes a static "beat n of 4" readout; view transitions are off. The playhead itself never stops: it is information.
- **Flash safety (WCAG 2.3.1):** nothing flashes more than 3 times a second at any tempo. The beat pulse changes a 14–26 px dot (shape and fill, no large-area luminance change), never full screen, never red. When beats come faster than 3 a second (> 180 BPM, or subdivisions), the pulse marks only the downbeat. Vibration (`navigator.vibrate`, where supported) follows the same schedule and is off by default.
- **Confirmation within 100 ms:** every key, pedal and tap shows its pressed state or PedalHud within 100 ms (`28` §3 timing check).
- **No decorative motion:** no parallax, no looping decoration, no celebration, no flashing on the beat unless the beat pulse is on. `animate-shimmer` and `animate-progress-indeterminate` are loading states and stop under reduced motion. Do not write the bare word `shimmer` in app source (Tailwind would emit shadcn's `.shimmer`, which uses relative colour syntax).
- **View transitions** only as progressive enhancement (`document.startViewTransition`), disabled under reduced motion.

## 11. Iconography and brand marks
- **Icons:** `lucide-react` 1.x (ISC, named imports): 24 px grid, **1.8 px stroke** (`strokeWidth={1.8}`), round caps and joins, `currentColor`. Sizes: 16 (inline, small buttons, chips), 20 (default), 24 (practice controls), 28 (Play). Filled glyphs only for Play/Pause.
- **Transport set:** Play, Pause, restart (bar-to-start), next bar, minus/plus (speed), repeat (loop), metronome, count-in (stopwatch), sliders (mix), volume, mic, keyboard, pedal (custom), search, more.
- **Custom icons** (same grid and stroke, `apps/web/app/ui/icons/`): pedal, two pedals (wizard illustration), capo, tab staff, chord box, count-in, minus-one, "your part", distance illustrations (desk, stand, floor), the bass guitar. Instrument drawings (guitar, bass, piano, drums, mic-vocal, music note for Something else) mark the part on stem tiles and Add song's part chips.
- Icons are `aria-hidden`; buttons carry visible text or an `aria-label` that matches the visible label (WCAG 2.5.3). Icon-only buttons are allowed for the transport set, close, more, and the top-bar Display and Keyboard & pedal buttons, always with a tooltip that names the action and its key.
- **Wordmark and mark** (`apps/web/app/ui/brand.tsx`): "splitune" in lowercase, Figtree 600 at `text-lead` (17 px), −0.02em, `--foreground`, 10 px after the mark. The mark is a 28 px `--primary` disc (radius 13 in a 28 × 28 box) crossed by a 2.4 px `--primary-foreground` wave: a white disc with a black wave on Dark, a black disc with a white wave on Light. The `mono` tone draws the disc's outline (2 px) and the wave in the current text colour (the marketing footer uses it). The product name in copy stays "Splitune".
- **App icons** (`apps/web/public/`): `favicon.svg` is the mark with a `#0d0d0d` disc and white wave, swapped to a white disc and `#0d0d0d` wave under `prefers-color-scheme: dark`; `icons/icon.svg` is the white mark on a black 512 px square with 112 px corners; `icons/icon-maskable.svg` is the white mark on full-bleed black, scaled to fit the 80 % safe zone; `icons/icon-mono.svg` is the outline mark for monochrome contexts; PNG exports at 192, 512, maskable 512 and the Apple touch icon. The manifest's `background_color` and `theme_color` are `#000`; `<meta name="theme-color">` uses `BACKGROUND_HEX` (`light` `#fff`, `dark` `#000`; `tokens.test.ts` checks them against `--background`).
- **Imagery on Home.** Home (`apps/web/app/features/marketing/home.tsx`) shows eight pieces of abstract colour art from `apps/web/public/art/*.webp`: one 16:9 lead image, two squares and five thumbnails. They are the one place colour appears without a meaning; each sits beside the words that carry its point, so every image is decorative (`alt=""`). The owner generates them from the prompts in `docs/home-art.md` (palette teal, violet, sky, magenta-pink and lime with white light; no orange, amber, yellow or red; no objects, text or interface). The files in the repo are the owner's generated images (2026-11-17), with the generator's corner mark painted out. The two squares crop to 4:3 on phones. The art is drawn with 8 px corners on a `--muted` placeholder fill.

## 12. Components
Every component lives in `apps/web/app/ui/` (or `packages/notation` for notation), takes every user-facing string as a prop, has a story per state in both themes (`28` §2), and keeps its existing props when restyled. Feature code composes these; it never paints its own colours, sizes or one-off components.

### 12.1 Base (shadcn/ui CLI v4 on Base UI, rewritten to tokens)
| Component (file) | Variants and notes |
|---|---|
| Button (`button.tsx`) | **Every button is a pill**, weight 500. `primary` (the ink fill with `--primary-foreground` text; hover `--primary-hover`), `secondary` (the default: `--muted` fill, no edge; hover `--accent`), `quiet` and `outline` (transparent with a 1 px `--border-strong` inset ring; hover `--muted`), `ghost` (`--muted-foreground` text; hover `--muted` fill and `--foreground` text), `box` (`--card` fill, `--border-strong` ring), `on` (`--primary-soft` + `--primary-line` + `--primary-ink`; the state is also in the accessible name), `destructive` (red text and ring; hover `--destructive-surface`), `destructiveSolid` (the red fill with `--destructive-foreground`, for the confirm in delete dialogs), `link` (`--primary-ink`, underlined). Painted faces `sm` 32, `md` 40, `lg` 48, `xl` 56, `practice-2` 48, `practice` 64; icon sizes `icon-sm` 32, `icon` 40, `icon-practice-2` 52, `icon-practice` 64, all circles. A face under its target sits inside a box padded to the target with a transparent border (§8: 44 browse, 48 practice density). Transitions over `--duration-base` with `--ease-standard`; a press scales to 0.97. Disabled: `--muted` face, `--faint-foreground` text, `--input` ring, never an opacity fade, and "Unavailable" in the accessible name. Loading keeps width and shows `Spinner` after 300 ms |
| Toggle (`toggle.tsx`) | The chip: a pill painted 30 px inside the target box (44 browse, 48 practice), `text-sm` 500. `outline` (default, `--border-strong` ring) and `default` (no ring). Pressed = a filled ink pill (`--primary` with `--primary-foreground`, hover `--primary-hover`); the fill is the non-colour cue. The `practice-2` and `practice` sizes paint their whole box and sit beside Play, so pressed there is the quieter `--primary-soft` wash with a `--primary-line` edge (≥ 3:1) and `--primary-ink`. Segmented-control items use the `--capsule` instead (below) |
| ToggleGroup (`toggle-group.tsx`) | The segmented control: a borderless `--muted` pill track painted 40 px tall with 3 px side padding, items with 34 px faces in target-size boxes. The pressed item is a raised pill capsule (`--capsule`: `--accent` in Dark, `--card` in Light, with `--elevation-capsule`; no `dark:` variant, so a themed subtree gets its own colour) and `--foreground` text; the capsule is the non-colour cue and slides to the pressed item over `--duration-slower` on `--ease-snappy`. Under increased contrast and forced colours the track gets a border. Vertical groups use a `rounded-3xl` track |
| Tabs (`tabs.tsx`) | A `--border` rule under tabs whose boxes are the target (44 browse, 48 in the practice inspector); the selected tab is `--foreground` with a 2 px `--signal` underline (shape cue), the others `--muted-foreground`; optional count badge (`Fix 6`) |
| Switch (`switch.tsx`) | A 40 × 24 pill track in a 48 × 44 box (in a label row the whole row is the target). The 16 px knob is the page colour (`--background`) in both states. Off: an `--input` track with an `--input` ring. On: a `--primary` (ink) track with a `--signal` ring. The knob's position carries the state; disabled is a `--muted` track with a faint knob |
| Checkbox, RadioGroup (`checkbox.tsx`, `radio-group.tsx`) | An 18 px box (4 px corners) or circle on `--background` with an `--input` ring, in the middle of a 44 px box. Checked: `--signal` fill with a `--primary-foreground` check or dot |
| Slider (`slider.tsx`) | Base UI Slider; a 6 px `--accent` pill track with an `--input` ring, `--signal` fill, and a 20 px `--signal` knob in a target-size thumb box (stem faders fill in the stem colour); horizontal, vertical, range; click-to-set; always paired with steppers or a readout that opens them |
| NumberField / Stepper (`number-field.tsx`) | A 40 px `--background` well with 12 px corners and an `--input` ring; step halves are target-size boxes (44 browse, 48 practice) painting 36 × 38 faces inside the well (V12); the value in Figtree with tabular figures; units outside the value ("70 %") and announced through `aria-describedby` |
| Field, Input, Label (`field.tsx`, `input.tsx`, `label.tsx`) | 44 tall (48 in practice density), 12 px corners, `--background`, 1 px `--input` border that turns to the ink on hover and focus (hover adds a 1 px inset ink ring so the corners stay solid), 16 px side padding, `text-base`, `--faint-foreground` placeholder, focus outline at -1 px offset (over the border); label `text-sm` 500 in `--muted-foreground`; invalid fields take a `--destructive` border and the error text below carries an icon, linked by `aria-describedby`; disabled `--muted` with faint text |
| Select (`select.tsx`) | The trigger matches Input (12 px corners, `--input` border, `--background`). The popup is `--popover`, 1 px `--border`, `rounded-2xl`, `--elevation-2`; items are 44 tall, `rounded-lg`, `text-md`, `--accent` on focus, with a `--primary-ink` check on the chosen one |
| DropdownMenu, Popover, Tooltip (`dropdown-menu.tsx`, `popover*.tsx`, `tooltip*.tsx`) | All on `--popover` with a 1 px `--border` and `--elevation-2`. Menus `rounded-2xl` with `rounded-lg` items (`--accent` on focus; destructive items red on `--destructive-surface`); popovers `rounded-3xl`, 320 px wide; tooltips `rounded-lg`, `text-sm` 500, showing the shortcut in a `Kbd` |
| Dialog, AlertDialog (`dialog.tsx`, `alert-dialog.tsx`) | `--popover`, 1 px `--border`, `rounded-4xl` (22), `--elevation-3`, over `--scrim`; title `text-xl`; at most one at a time; AlertDialog only for delete song and delete account. Add song is a Dialog on desktop and a full-screen Drawer on phones |
| Drawer (`drawer.tsx`) | Base UI Drawer on `--popover` with `--elevation-3`; bottom sheets with a grabber and 24 px top corners (`rounded-t-5xl`); side drawers with 22 px corners on their open side, for the inspector below its docking width |
| Toast (`toast.tsx`) | `--accent` fill, 1 px `--border-strong` edge, `rounded-2xl`, `--elevation-2`; confirmations and Undo only; with an action it doesn't auto-dismiss; errors `role="alert"` with a `--destructive` edge |
| Badge (`badge.tsx`) | A 24 px pill, `text-xs` 12/500, always text, optionally an icon or a 12 px `Spinner`. `neutral` (`--muted` + `--muted-foreground`), `outline` (transparent, `--border-strong` ring), `primary` (`--primary-soft` + `--primary-ink` + `--border-strong` ring), `success`, `destructive`, `unsure` (status colour on its surface), `warning` (`--accent` + muted text), `info` (`--card` + muted text + `--border` ring) |
| Kbd (`kbd.tsx`) | JetBrains Mono 12 (with the menu shortcut hints, one of the few mono places), 22 tall, 4 px corners, `--muted` fill, a flat 1 px `--border-strong` edge, `--muted-foreground` text |
| Card (`card.tsx`) | `--card`, 1 px `--border`, `rounded-xl` (12), no shadow, 16 px padding and gap; title `text-lg`. `emphasis` is a borderless panel on `--muted` |
| Progress, Meter (`progress.tsx`, `meter.tsx`) | A 6 px pill (4 px in cards), `--accent` track, `--signal` fill; `role="progressbar"` with `aria-valuetext` naming the stage; `value={null}` is an indeterminate sliding bar. The meter's value ("12 of 15 left · resets 22 Nov") is `text-sm` in the sans face with tabular figures, so it reads as a sentence |
| Spinner (`spinner.tsx`) | 16 px (12 in badges), a `--primary-soft` ring with a `--signal` arc; static under reduced motion (a text label always accompanies it) |
| Separator, ScrollArea, Skeleton | `--border`; skeletons `--muted` |

### 12.2 Splitune kit
Restyled components keep their props; the step that built each is in the State column.

| Component | State | Purpose and states |
|---|---|---|
| `TransportButton` (`transport-button.tsx`) | s33, s46 | Practice icon buttons, every one a circle (a pill once a label widens it). Main controls 64 × 64 painted and hit (§8, V11); Play is the filled ink circle with no shadow, 64 (72 phone); secondary transport controls (click, mix pill) 52 painted in a 52 box (≥ 48); `neutral`, `box` (`--card` with a `--border-strong` ring); pressed and active = `--primary-soft` + `--primary-line` + `--primary-ink`; label shown below from `md` and at Stand/Floor distance |
| `SpeedControl`, `SpeedPanel` (`speed-control.tsx`, `speed-panel.tsx`) | s33, ladder s37 | `−` [ "75 %" / "72 BPM · → 100" ] `+`: round boxed −/+ circles at 64 (main practice controls, icons only) around a quiet 64 px tall pill readout (`text-read-readout` in the reading family, tabular figures) that opens the panel (slider 25–110 %, presets 50 · 60 · 70 · 75 · 80 · 90 · 100; phone 50 · 75 · 85 · 100). `,`/`.` keys; Shift 1 % |
| `LoopBadge` → loop pill (`loop-badge.tsx`) | s35 | A 64 px tall pill (main practice control): off "No loop" / "tap two bars, or a section" (quiet, solid edge); armed (dashed edge: A tapped, waiting for B); active = `--primary-soft` + `--primary-line` + `--primary-ink` "Loop · bars 25–28" / "pass 2 · rest 1 beat"; resting adds a pause icon. On notation, the bracket badge "Loop · bars 25–28 · pass 2 of 2 at 75 %" |
| `PassControl` → pass prompt (`pass-control.tsx`) | s35 | Floating sheet at the canvas bottom: "Pass {n} at {speed} — how was it?" + **Felt clean** (the view's primary, check icon, `Kbd` C) + Not yet (`Kbd` N), both 64 tall pills; tablets and phones: the pair inline in the transport with the best clean tempo; Stand view: the dock's hold-pedal buttons |
| `ChordChip`, `ChordSymbol` (`chord-chip.tsx`) | s35 | Chips are music, so they sit on the page with ink. In the strip, upcoming and past chords are plain names; the current chord is at the larger reading size on the current-bar wash with a 2 px loop-edge border. `pill` is the Now column's "Then" chip, a bordered pill at `--read-chord` inside a 48 px box. Unsure dashed `--unsure` + "?"; real ♯/♭, raised quality, slash bass |
| `ConfidenceLegend`, `ConfidenceLegendPanel` | s35 | Dashed chip "? Auto-transcribed · {n} unsure" + popover (§5) |
| `StemRow` (`stem-row.tsx`) | s35, all stems s40b | A 6 × 34 colour rule, the name with "Your part"/"Rough" badges, M/S painted as 32 px circles inside 48 × 48 boxes (on = ink fill, off = `--border-strong` outline), the fader in the stem's colour and its dB readout (`text-sm`, tabular; "muted" while muted) |
| `MixPresetGroup` (`mix-preset-group.tsx`) | s35 | 2 × 2 radio cards (`rounded-xl`, `--card`, `--border`): name + gloss ("Learn it: guitar up, band down"); checked = `--primary-soft` fill + 1 px `--signal` border + 1 px inset `--signal` ring (a 2 px edge) + `--primary-ink` name; `list` stacks them for the phone drawer |
| `WaveformTimeline` → song map (`waveform-timeline.tsx`) | s35, sections s41b | Section chips row (painted 22 inside a 24 px box with min width 24 on fine pointers, 48 on coarse), 40 px canvas: waveform bars (`--waveform-*`), unsure hatch band, the loop band beneath the bars (`--loop-fill`) with 2 px `--loop-edge` handles (≥ 44 px hit area, arrow-key nudging), 2 px now-line; a 14 px ruler of bar numbers (`text-2xs`, tabular figures). The band eases over `--duration-base` |
| `PedalHud` (`pedal-hud.tsx`) | s35 | A pill at the notation's top right: icon + "{source} · {action}"; `--hud-bg` / `--hud-fg`; ≤ 100 ms; `aria-live="polite"`; 1.2 s |
| `StageList` (`stage-list.tsx`) | s34/s35 | The overall bar with "Analysing your song" and the ETA, then each stage: a 22 px status dot (done `--success` + check; running a `Spinner` on `--primary-soft`; waiting an `--input` ring), the name, a detail line naming the artefact, and its status in words |
| `SongCard` / `SongRow` (`song-card.tsx`) | s34, s46 | Card (tablet, desktop): a hairline outline with 12 px corners and no fill; the part's stem tile (40 px, 8 px corners, the instrument icon in `--tile-foreground`), title, meta line, 28 px waveform preview, status badge, progress line while analysing; the whole card opens Practice. Row (phones and the list view): divided by the list's hairlines |
| `AllowanceMeter` (`allowance-meter.tsx`) | s34 | "3 of 5 Lite left · resets 1 Dec" (13 px, faint) over a 4 px bar, at least 150 px wide; in the app bar from `lg` |
| `EmptyState` (`empty-state.tsx`) | s34, s46 | No box, just space: an icon in a quiet circle, an `h2`, one sentence, the primary action and an optional secondary, centred |
| `StatusMessage` / banners (`status-message.tsx`) | s36, s46 | Status icon + what happened + what it means + what you can do. Inline messages sit on a tinted status surface (a hairline border returns under increased contrast); banners are a plain line. Never a saturated fill; `role="status"` (errors that block the goal `role="alert"`) |
| `WorkerStatus` (`worker-status.tsx`) | s34 | Banner "Processing machine offline. Your song is queued and starts automatically." |
| `ChoiceCard` (`choice-card.tsx`) | s36, s46 | Onboarding's tap-to-choose rows: icon, title, one line, a hairline edge that fills on hover; unavailable choices stay focusable on the quiet fill and say why |
| `RadioCard` (`radio-card.tsx`) | s34/s36, s46 | Full / Lite and onboarding's distances: `rounded-xl`, `--background` with a `--border` hairline (hover `--border-strong` and `--muted`); checked = 1 px `--foreground` border + 1 px inset `--foreground` ring (a 2 px ink edge) + `--primary-soft` wash + a check in an ink circle |
| `StepDots` (`step-dots.tsx`) | s36 | 8 px dots, the current one a 22 × 8 pill; done and current the ink (`--foreground`), upcoming `--input`; plus the "Step 3 of 5" text |
| `SpeedLadder` (`speed-ladder.tsx`) | s37 | 70 px rungs rising to the goal: done = the ink fill with a 1 px `--signal` ring and a `--primary-foreground` label; current = `--primary-soft` with a 2 px inset `--signal` ring and `--primary-ink`; upcoming `--accent`. Parameter chips are 30 px pills; 11 px labels with tabular figures; the group's name says done, now and next ("70 percent done, 75 percent now, 80 percent next"); more than nine rungs show the nine around the current one |
| `BeatPulse` (`beat-pulse.tsx`) | s35 (static), s42 (pulse) | One dot per beat (meter-aware): downbeat square, others round; done `--beat-done`, now `--beat-now` (the ink), upcoming `--beat-slot` outline; `aria-label` "Beat 3 of 4" |
| `CoachMark`, `DropZone`, `WaveformPreview`, `SaveStatus`, `Brand` | s33–s36 | On the tokens above; `DropZone` is a dashed `--border-strong` panel on `--muted`; `SaveStatus` shows the "Saved on this device" success badge; `Brand` in §11 |
| `AppBar` (`features/shell/app-shell.tsx`) | s34, s46 | A sticky 64 px bar on `--background` with **no rule under it**: wordmark (→ Library), Library and Settings as ghost pills (current page `--muted` fill), a secondary-pill search button "Search songs, clips and actions" + `Kbd` (an icon button below `lg`), the allowance meter (from `lg`), **Add song** as a secondary pill (the bar is chrome; each page keeps its own one primary), the account avatar (40, circle). Phones: a 56 px header with the page title, search and the avatar |
| `MarketingShell` (`features/shell/marketing-shell.tsx`) | s36, s46 | A sticky 64 px bar on `--background` with **no rule under it**: wordmark, How it works and Pricing as ghost pills in `--foreground`, **Sign in** as a quiet (secondary) pill, **Try an example song** as the one primary pill; signed in, "Library" as an outline pill replaces both. Phones: wordmark + Menu. Footer: a hairline, the mono wordmark and the legal links |
| `BottomNav` (`features/shell/bottom-nav.tsx`) | s34 | Phone: Library · **Add song** (a 48 px primary pill) · Settings, 76 px plus the safe area, a hairline above, labels `text-xs`, the current tab in `--foreground` and the others faint |
| `CommandPalette` | s34 (lazy) | `Dialog` with a 52 px search field (17 px) + `Kbd` Esc; groups Songs / Clips / Actions; rows with tile, matched text bold, context in faint, `Kbd` hints; ↑/↓ + Enter |
| `ContinueCard`, `WeekStrip`, `RevisitList` | s34 (layout) / s39 (data) | Library's "Pick up where you left off": desktop, one quiet `--muted` panel with 12 px corners and no visible label ("Pick up where you left off" is the section's accessible name only), the song as the page's h1, a meta line ending with when it was last practised, badges, the 30-day sparkline (s39) and **Resume practice** as the page's primary ink pill (`lg`); phone, a compact link (accessible name "Pick up where you left off") with a 48 px round ink play mark; "This week" 7 day dots (filled `--signal` when practised, outlined `--input` when not) + three stats, "Worth a revisit" rows |
| `NowColumn` | s35 | Label, current chord (`--read-chord-current`) + `ChordShape` (mirrored for left-handed), `BeatPulse`, next chord + "in n beats" + bar, "Then" chips, Level/Capo rows |
| `InspectorTabs` | s35 | Tabs Loop / Mix / Progress / Fix (+ unsure count badge), panel 380 docked or in a drawer |
| `ClipList` | s35, rename/delete s37 | Rows: dot (the ink = active clip, faint otherwise), name, "bars 25–28 · best 80 %" (faint, tabular), More menu (Rename, Delete) |
| `FixQueue`, `AlternativeRow`, `EditHistory` | s38 | Spot header "Spot 2 of 6 · bar 27–28" + `--unsure` progress + prev/next; chord and note cards; alternatives with frequency text, "Hear over the loop", Use; "Your edits" with Revert |
| `ProgressChart`, `StatCard`, `SessionList` | s39 (lazy) | 30-day chart (best clean pass solid `--signal`, first clean pass "cold" dashed `--muted-foreground`, text alternative), three stat cards (tabular figures), session rows |
| `ToolsSheet` | s43 (lazy) | Phone sheet: Speed (−/+ at 64, a tabular readout, 4 preset chips, ladder card), Count-in / Click / Vibrate tiles (76 tall, pressed = ink wash with its hairline), Mix (preset chips, two channel rows with M painted 44 in a 48 box), Level / Capo buttons; every control has steps, no drag |
| `StandView` | s43 | Header (back, title, loop badge, "Pedal connected" badge, speed readout 28, Display), Now panel 400 (chord 200 + shape, beats 26, next 100), one tab system, "Page 7 of 46 · turns on the downbeat of bar 28", dock of four 88 px buttons with pedal hints |
| `PedalWizard` | s43 | Card with a `--primary-line` edge: "Pedal setup · step n of 3", h2, captured-key badges, Start over / I only have one pedal, the three presets, two-pedal illustration |
| `NotifyButton` | s44 (lazy) | Secondary button with a bell: "Notify me when it's ready"; only where `PushManager` and `Notification` exist; permission asked on click |
| `AlphaTabView` overlay (`packages/notation`) | s35, s46 | Confidence marks (§5), loop wash and bracket, current-bar wash, the sounding note as ink boxes with the digit in `--primary-foreground`, the playhead (2 px line or 12 px block in `--score-playhead`, no glow), bar/note buttons |
| `PianoRoll`, `KeyboardDiagram`, `GuitarRoll`, `FretboardDiagram`, `MelodyRoll`, `DrumGrid`, `ChordDiagram` (`packages/notation`) | s35 | Read the §4.7 tokens through `readColor`; roll on `--card`; behaviour unchanged (§10 motion rules) |

### 12.3 State matrix (every interactive component, both themes, both contrast levels)
`default · hover (fine pointers only) · pressed · focus-visible · selected / on · disabled · loading · error`, each a Storybook story (`28` §2). Disabled controls use muted fills with a ≥ 3:1 boundary and "Unavailable" in the accessible name, never 50 % opacity (`--muted` fill + `--faint-foreground` text + `--input` ring). Because the on-state colour is the ink, which is also the text colour, every state below has a shape cue:

| Component | On/selected cue besides colour |
|---|---|
| Tabs | 2 px underline |
| Segmented | Raised pill capsule (`--capsule`) with shadow |
| Chip | Filled ink pill vs outlined (practice-size toggles: `--primary-line` edge, ≥ 3:1, around the wash) |
| Switch | Knob position, plus the ink track (vs the grey `--input` track) |
| M/S | Filled vs outlined, and "muted"/"solo" in the dB readout and accessible name |
| Radio card | 1 px inset ring + 1 px border (2 px edge) and a check |
| Icon button on | Wash with a hairline edge + accessible name "…, on" |
| Beat dot now | Filled vs outlined |
| Speed-ladder rung | Done: filled; current: 2 px inset ring on the wash; upcoming: plain |
| Sounding digit | Filled box |
| Nav link (current page) | `--muted` pill fill + `aria-current="page"` |

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
- G5 (owner, music-stand test): which theme reads best at 0.5 / 0.75 / 1.5 m; may make Light the default for Practice and Stand view (subtree theming supports it), and may raise the §6.3 sizes (never lower them below the floors).
- Legibility check of JetBrains Mono tab digits next to Figtree at the three distances (Foundations/Fonts › Legibility), now that Figtree replaces Instrument Sans.
- Calibration check C1 (§5): which stages pass; until then every stage keeps its marks.
- The Floor preset has no reference design; its values follow the §6.3 floors and rationale.

## Sources
- s46 brief (2026-11-17): OpenAI's interface language as measured on openai.com and chatgpt.com (§1.1); the Figtree metric comparison against OpenAI Sans at weight 500 (§6.1).
- `packages/ui-tokens` (`primitives.css`, `themes.css`, `theme.tailwind.css`, `fonts.css`, `index.ts`, `tokens.test.ts`, `contrast.test.ts`, `palette.test.ts`), `scripts/fonts/subset.sh` and `fonts.test.mjs`, `apps/web/app/ui/*`, `apps/web/app/features/shell/*`, `apps/web/app/features/marketing/home.tsx`, `docs/home-art.md` — the values in this doc, as of 2026-11-17.
- Contrast, CVD and ΔE values measured in s46 with `colorjs.io` 0.7.1 through the package's `testing/cascade.ts` helper and the Machado, Oliveira & Fernandes 2009 matrices used by `palette.test.ts`.
- History: `redesign/report.md` and `redesign/research/*` (s31a research: reading distances, targets, WCAG 2.2 mapping, practice ergonomics, confidence UX), the mockups `redesign/mockups/*.dc.html` and `splitune.css` (Night Rehearsal; no longer a visual source).
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) (1.4.1, 1.4.3, 1.4.11, 2.1.4, 2.2.2, 2.3.1, 2.4.11, 2.4.13, 2.5.5, 2.5.7, 2.5.8) — tier 1.
- [Paul Tol's palettes](https://tesselle.r-universe.dev/khroma/doc/tol.html), Okabe-Ito ([ggokabeito](https://malcolmbarrett.r-universe.dev/ggokabeito/doc/manual.html)) — tier 2.
- [Figtree](https://github.com/erikdkennedy/figtree), [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono), [Atkinson Hyperlegible Next](https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegiblenext), [SMuFL chord symbols](https://smufl.formats.music/latest/tables/chord-symbols.html), [Lucide](https://lucide.dev) — tier 2.
- [MDN getOutputTimestamp](https://developer.mozilla.org/docs/Web/API/AudioContext/getOutputTimestamp), [alphaTab coloring](https://www.alphatab.net/docs/guides/coloring), [core.includeNoteBounds](https://www.alphatab.net/docs/reference/settings/core/includenotebounds) — tier 1.
- Cross-linked: `research/ux/accessibility.md`, `research/ux/hands-busy-and-device-context.md`, `research/ux/music-display-ui.md`.
