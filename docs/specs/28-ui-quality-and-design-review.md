---
title: UI quality workflow and design review
workstream: engineering
last_researched: 2026-11-23
confidence: medium
---

# UI quality workflow and design review

How Splitune keeps its UI consistent, accessible, fast and faithful to the design system: Storybook as the component workbench, automated checks (tokens, colour vision, a11y, targets, keys, motion, performance, visual regression), the design QA checklist every UI change passes, the scoring used to audit a screen, and the owner's usability and music-stand rounds. Tokens and components: `26-design-system.md`; screens and copy: `27-screens-flows-and-content.md`; the wider test pyramid: `18-testing-strategy.md`.

Rewritten in place in step s31a (2026-11-08), edited in s46 (2026-11-17) and brought to the s47 system (2026-11-23): the role-numbered ramps, ink selection, 48 / 64 px practice targets, the one-key rule and the screen scoring of `docs/design/s47-audit.md`. Section numbers are unchanged.

> **Personal mode (`25-personal-mode.md`):** everything here is free and local: no Chromatic, no hosted review UI, no device cloud. Usability rounds are the owner plus a few friends.

## TL;DR
- **Storybook 10.6** in `apps/web`: every `app/ui` and `packages/notation` component and every screen has one story per state, rendered under an Appearance (Dark / Light / Stage) × Contrast × Density × Distance × Reduced-motion toolbar; axe runs with `test: 'error'` and the WCAG 2.2 tags; `test:stories` runs them in Chromium and WebKit.
- **Token tests** fail the build if any pair in `26` §4.6 drops below its WCAG minimum in any of the six contexts, leaves sRGB gamut, if two stem colours fall under 12 ΔE2000 under simulated CVD, or if any two surfaces of a ramp reach 3:1 (so a grey fill can never be a state).
- **The token lint** fails on raw colours, palette classes, any name s47 retired, a weight other than 400 or 500, a removed focus outline and one-off motion.
- **The visual source is the code**: screens are reviewed against `26`, the tokens and Storybook in both themes. The `redesign/mockups/` and the s31c fidelity probe (§5.1) are history.
- **Measured acceptance for the practice screen:** the notation gets at least 70 % of 1440×900 and 55 % of 375×812 in the default state; a 4-bar loop at 70 % with a count-in is three keys; nothing overflows or overlaps at 375 px.
- **Accessibility gates:** target-size probe (64 for Play, 48 for every other practice control, 44 everywhere else, 88 in Stage, 24 only for song-map section chips on a fine pointer), focus-not-obscured probe, keyboard-only journeys, single-key shortcuts off, reduced-motion runs, no flash over 3/s, colour-not-alone review.
- **Performance gate:** Long Animation Frames, forced layout and p75 practice-action latency on the practice screen in Chromium with CPU throttling.
- **Visual regression** with Playwright in the pinned Docker image; s47 invalidates every earlier baseline and they are regenerated after the owner's review.

## 1. Where UI code lives
| Path | Contents |
|---|---|
| `packages/ui-tokens` | Primitives, themes, Tailwind mapping, fonts CSS, typed token metadata, token tests |
| `apps/web/app/ui/` | shadcn/Base UI components (owned after generation), the Splitune kit (`26` §12), icons |
| `apps/web/app/features/*/` | Feature components composed from `app/ui`; no new visual primitives here |
| `packages/notation` | `AlphaTabView` and overlay, rolls, grids, keyboard and fretboard diagrams |
| `apps/web/.storybook/` | Storybook config, decorators, test setup |
| `apps/web/e2e/` | Playwright E2E, a11y, focus, target, perf specs; `e2e/visual/` with baselines in `__screenshots__/` |
| `scripts/redesign/` | Mockup harness (s31c): renders `redesign/mockups/*.dc.html` to PNGs (ignored folder) and exposes the probe helper; history from s46 |
| `redesign/mockups/` | The Night Rehearsal mockups and `splitune.css`; historical from s46 (not a visual source) and **read-only** for every step |

Rule: a feature that needs a new visual pattern adds it to `app/ui` with stories first, then uses it.

## 2. Storybook
- **Version and addons:** `storybook` 10.6.x, `@storybook/react-vite`, `@storybook/addon-a11y`, `@storybook/addon-vitest` (Vitest 5 browser mode, Playwright provider).
- **Toolbar globals and decorators:** Appearance (**Dark**, **Light**, Stage, and **Side by side**: the story twice, in `data-appearance="dark"` and `"light"` subtrees), Contrast (normal / more), Density (browse / practice), Distance (Desk / Music stand / Floor), Reduced motion, Pointer (fine / coarse, for target sizes). Decorators set the same `data-*` attributes as the app (`26` §2), so stories prove the real theming path. The Music Stand "Score" global is removed.
- **Story conventions:** `Component.stories.tsx` beside the component; one story per state from `26` §12.3 (`Default`, `Hover`, `Focus`, `Pressed`, `On`, `Disabled`, `Loading`, `Error`, plus domain states like `Unsure`, `EditedByYou`, `Sounding`, `RoughStem`, `LadderClimbing`, `FixMode`); every story renders in both themes (the side-by-side global, or a Light-theme story per screen); interaction tests with `play` functions for keyboard paths; realistic content (fixture songs, 80-character titles, two-digit frets, F♯m7♭5).
- **Screens:** `Screens/*` stories for every screen and state in `27` §3–§4 (Library with and without progress data, Add song per tab and state, Practice per layout, stage and inspector tab, Stand view, phone glance and Tools sheet, Settings sections, system states, command palette), rendered edge to edge with fixture data.
- **Fixtures:** `packages/contracts/fixtures` (the 8-bar Am–F–C–G example) and `apps/web/app/features/story-fixtures.ts`, extended with multi-stem, sections, progress history and unsure-spot fixtures as the steps that use them land.
- **a11y:** `parameters.a11y.test = 'error'` globally with `runOnly` tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice` (so `target-size` runs); a story may downgrade a rule only with a comment naming the WCAG criterion and why.
- **Commands:** `pnpm --filter @splitune/web storybook`, `storybook:build`, `test:stories` (every story in Chromium + WebKit, a11y included).

## 3. Automated design checks
| Check | Where | Fails when |
|---|---|---|
| Contrast table | `packages/ui-tokens/src/contrast.test.ts` (colorjs.io) | Any pair in `26` §4.6 or `CONTRAST_PAIRS` drops below its minimum in any context (`dark`, `light`, `stage` × normal, more), or a §4.6 value moves by more than 0.1 without the doc changing |
| Translucency | same | A role or component token other than `--scrim` is translucent. Every surface, wash and line is the colour it says, so every pair is checked as it is drawn |
| Selection | same | Any two surfaces of a ramp (`--background`, `--panel`, `--raised`, `--hover`, `--wash`, `--pressed`) reach 3:1, or `--selected` is under 7:1 on any of them: a grey fill can never be the state, the ink edge always can (`26` §4.5) |
| Gamut | same | A semantic or component token resolves outside sRGB (the source must clamp, `26` §3) |
| CVD separation | `palette.test.ts` | Any two of `STEMS` (guitar, bass, drums, vocals, keys, other, mix) have ΔE2000 < 12 under normal vision or simulated protanopia, deuteranopia or tritanopia (Machado 2009), per context |
| Token structure | `tokens.test.ts` | A ramp step, role or component token is missing in a context; a ramp-backed role reads a different step in Dark and Light (`ROLE_STEPS`); an increased-contrast role is not one step further; a component token references a primitive; a type role is below 11 px or carries a weight other than 400 or 500; `BACKGROUND_HEX` disagrees with `--background` |
| Fonts | `scripts/fonts` test (s32) | A shipped WOFF2 lacks `tnum` or a glyph from `26` §6.1, or the preloaded file exceeds 80 KB |
| Raw values | `scripts/check-ui-tokens.mjs` (in `pnpm lint`) | `#hex`, `rgb(`, `hsl(`, `oklch(`… literals in `apps/**` or `packages/**` outside `ui-tokens`; Tailwind palette classes; one-off durations, delays and easings. Steps extend it (never suppress it): arbitrary colour, radius, font-size and shadow values, style-prop colour literals |
| Retired names | same script | A utility or token s47 retired (`bg-card`, `bg-muted`, `bg-accent`, `border-input`, `text-sm`, `rounded-lg`, `shadow-2`, `var(--popover)`…), each reported with the name that took over its job; or a weight utility other than `font-normal` and `font-medium` |
| Class merging | `apps/web/app/lib/utils.test.ts` | `cn()` drops a type role when it meets a text colour, or keeps two type roles, radii or shadows |
| Focus | same script | `outline: none`/`outline-none` without a `focus-visible:outline-*` replacement |
| CSS floor | `apps/web/scripts/css-floor.mjs` (after build) | `light-dark()`, relative colour syntax, `@scope` or native CSS nesting in the built CSS |
| Copy keys | `apps/web/app/copy-keys.test.ts` | A user-facing string in a screen is not a Paraglide message, a `27` §5.6 key is missing, or its copy differs from the catalogue (changed copy updates the test in the same step, per `27` §5.7) |
| a11y | Storybook (all stories) + Playwright pages (`@axe-core/playwright`, WCAG 2.2 AA tags) | axe serious/critical violations |
| Target size | Story `play` probe + E2E | An interactive element's border box (`getBoundingClientRect()`) is under: **64 × 64** for Play; **48 × 48** for every other practice control (transport, loop, count-in, speed −/+ and its readout, Tools, Felt clean, Not yet, the stem toggles); **88** tall for Stage's transport; **44 × 44** for anything else. Only exception: song-map section chips on a fine pointer, ≥ 24 × 24. Inline text links are exempt (WCAG) |
| Keys | `model/keymap.test.ts`, `input-mapper.test.ts`, E2E keyboard journey | A default key is bound to two actions; a practice action has no key; a slowed loop takes more than `4`, Shift+7, Space; a digit or Shift+digit acts with single keys off; the pedal's two sides do not follow the moment (play, pass, Fix); a practice key is swallowed inside the tools sheet or the bar editor |
| Music leads | E2E on the practice screen | The notation's box is under 70 % of a 1440×900 viewport or under 55 % of 375×812 in the default state, or any transport control overflows or overlaps another at 375 px |
| Phone fit | E2E (s43), `26` §6.3 phone fit rule | On a coarse-pointer phone at 844 × 390, 667 × 375 and 390 × 844, Floor preset: the tab system leaves its notation box, a digit is under 18 px or over `--read-tab`, the strip doesn't land on the playhead's bar after it scrolls, or a "Then" chip overflows its row or isn't at `--read-chord` |
| Focus not obscured | E2E focus spec | For each Tab stop on key screens, with the transport, sheets and drawers open, the focused element is fully covered (`elementFromPoint` at several points) — WCAG 2.4.11 |
| Token membership | E2E (s45) | A rendered element's computed `color`, `background-color`, `border-color`, `outline-color`, `fill` or `stroke` is not a resolved token value of the active context |
| Motion | Stories and E2E with `reducedMotion: 'reduce'` | A non-essential animation runs (computed `animation-name` / `transition-duration`), or the playhead stops |
| Flashing | Unit test of the beat-pulse schedule (s42) | More than 3 changes a second at any tempo or subdivision, or a pulse wider than the dot |
| Feedback timing | E2E | A key, pedal or tap shows no pressed state or PedalHud within 100 ms |
| Performance | Chromium perf spec (s32 baseline, s45 gate) | §3.1 |
| Bundle | `pnpm --filter @splitune/web budget --enforce` | Practice route JS over **320 KB gzip** (alphaTab and WASM excluded). Lazy-load new panels (Fix, Progress, Tools sheet, command palette, Stand view, Notify). Raising it needs the owner |

### 3.1 Performance gate (practice screen)
1. **Baseline first:** before any restyle, s32 records, on the current practice screen in Chromium with CDP CPU throttling 4×: Long Animation Frames over 20 s of looped playback with count-in (`PerformanceObserver({type: 'long-animation-frame'})`), forced style/layout during steady playback, and p75 latency (Event Timing, N ≥ 10) for play/pause, loop nudge, speed step and a mixer fader key step. Stored with the run's reports.
2. **Gate (s35 onward, enforced in s45):** no LoAF attributed to playhead, song-map or roll code; no forced layout from app scripts during steady playback; p75 practice-action latency ≤ 100 ms; no regression beyond 10 % of the baseline on any measure.
3. Rules that keep it green: the playhead and rolls move by `transform` only; no layout reads in the rAF callback; the waveform is drawn once and only the overlay moves; no `backdrop-filter`, large blur or animated shadow over the notation or waveform; font swap can’t reflow the transport (metric-matched fallbacks).

## 4. Visual regression
- **Tool:** Playwright 1.64 `expect(page).toHaveScreenshot()` over the built Storybook's `Screens/*` stories (fixture data, fixed clock `2026-10-22T10:00Z`, UTC, `en-GB`), `maxDiffPixels: 20`, animations disabled, caret hidden, volatile UI masked.
- **Stable rendering:** `mcr.microsoft.com/playwright:v1.64.1-noble` as `linux/amd64` (`apps/web/scripts/visual.mjs`; `pnpm --filter @splitune/web e2e:visual`, `e2e:visual:update`). The image is pulled once per machine.
- **s47 invalidates every earlier baseline.** They are regenerated, never loosened, after the owner's review of the new screens. A baseline update shows every diff image to the reviewer.
- **Matrix (Chromium and WebKit):**

| Screen (fixture data) | Themes | Viewports |
|---|---|---|
| Home, Library (with progress), Add song (file picked), Settings → Display & practice | Dark, Light | 390 × 844 (touch), 1180 × 820, 1440 × 900 |
| Practice: Tab with loop and ladder, Chords + Mix tab, Fix mode, Getting ready | Dark, Light | 1180 × 820, 1440 × 900 |
| Practice: phone tab, phone glance (the Chords view), the tools sheet | Dark, Light | 390 × 844 (touch) |
| Stand view | Dark, Light | 1180 × 820 (touch) |
| Practice Tab, increased contrast | Dark | 1440 × 900 |
| System states (unsupported, 404, failure card, delete dialog), Sign in, Pricing | Dark | 390 × 844, 1440 × 900 |

- Baselines in `apps/web/e2e/visual/__screenshots__/` are committed test expectations; update only with an intentional UI change, in the same commit.

## 5. Design QA checklist (definition of done for UI changes)
Run on the changed screens (and every screen in s45). Record pass/fail in the step report.

**Fidelity** (to `26` and Storybook; the §5.1 mockup procedure no longer applies from s46)
- [ ] The screen matches `26` in both themes at 390, 1180 and 1440: the colour, type, shape and component rules of `26` §4–§12, and the rules the `26` §4.9 register keeps as binding.
- [ ] Uses only tokens and `app/ui` components; no one-off colours, radii, shadows, font sizes or arbitrary values.
- [ ] One primary (filled ink) action per view; selected, current and "on" are an ink edge, line, check or inversion, never a grey fill (`26` §4.5); colour appears only for status, stems, hands and "unsure", each with a second cue.
- [ ] The music leads: on practice the notation has its share (§3 "Music leads") and nothing floats on it but the count-in and a video; in the library a song shows its music.

**Visual quality**
- [ ] Hierarchy uses the `26` §6.2 scale; numbers that change are Figtree with tabular figures and don't change width; JetBrains Mono only for tab digits, keycaps, shortcut hints and ids.
- [ ] Alignment on the 4 px grid; gutters per `26` §7; no orphaned elements or uneven gaps.
- [ ] Long content: 80-character titles, two-digit frets, F♯m7♭5, 20-minute songs, 99+ unsure spots, empty and one-item lists.
- [ ] Looks right in Dark and Light, at normal and increased contrast.

**Practice at a distance**
- [ ] Tab digits and the current chord are readable from 0.75 m on a tablet at Music stand and from 1.5 m at Floor, without leaning in.
- [ ] Main practice controls hit reliably with a knuckle while holding a pick (10 tries, ≥ 9 hits).
- [ ] Every action has a key and shows it on its control; a slowed loop is three keys; a two-button pedal runs a session (right is go, left is again) without the page scrolling; the HUD confirms within 100 ms; ↑/↓ never change speed.

**Accessibility (WCAG 2.2 AA)**
- [ ] Keyboard-only pass in visual order; focus always visible and never hidden by the transport, sheets or drawers (2.4.11).
- [ ] Targets per `26` §8: 64 for Play, 48 for every other practice control, 44 everywhere else, nothing under 24 (2.5.5, 2.5.8); every drag has a single-pointer alternative (2.5.7).
- [ ] Single-key shortcuts can be switched off and are then inert (2.1.4); pausing playback stops scrolling (2.2.2).
- [ ] Colour never the only cue (confidence, stems, status, selection, the downbeat, "Rough"); checked with a CVD simulator in both themes (1.4.1, 1.4.11).
- [ ] 200 % text zoom and 320 px reflow on browse screens (1.4.4, 1.4.10).
- [ ] Reduced motion: page turns, stepped playhead, no fades, static beat readout; nothing flashes more than 3 times a second (2.3.1).
- [ ] Forced-colours spot check in Chromium emulation.
- [ ] Names for icon buttons with state ("Count-in, 1 bar, on"); polite announcements for stage milestones and pedal actions only; `role="progressbar"` with `aria-valuetext`; notation text alternative present (`12` §9).

**States and copy**
- [ ] Empty, loading, partial, error and offline states from `27` §4 implemented and storied in both themes.
- [ ] Copy from `27` §5.6–§5.7; style rules (sentence case, verbs, numerals, units, 1-based bars, frequency wording).
- [ ] Locks and limits follow `23` §5; claims follow the `27` §3.1 honesty gates.

**Performance feel**
- [ ] No layout shift when artefacts arrive; skeletons match the final layout; the transport never moves.
- [ ] §3.1 gate green; route budget green.

### 5.1 Mockup fidelity procedure
*History (s32–s38). From s46 the mockups are no longer the visual source (`26` §4.9) and this procedure gates no step; it is kept for the record and for reading earlier step reports.*

1. **References.** `scripts/redesign` (s31c) renders each `redesign/mockups/*.dc.html` (with its `renderVals()` defaults) at 1440 × 900, 1180 × 820 and 390 × 844 in the mockups' two looks (`look` = "Night Rehearsal" and "Daylight", the s31a theme names) into an ignored folder. Mockups are never edited.
2. **Pairing.** Compare the app's story or route (same fixture data where possible) with the reference that has the same layout:

| Mockups | Compare at |
|---|---|
| Desktop screens (`Main`, `Practice-*`, `Library`, `AddSong`, `Home`, `SignIn`, `Onboarding`, `Pricing`, `Settings-*`, `States`, `System`) | 1440 and 1180 (fine pointer); 1180 also checks the narrow-region rules of `27` §3.7.1 against the reference's fixed widths only where both show the same regions |
| `Stand.dc.html` | 1180 × 820, coarse pointer, Music stand |
| `Phone-*.dc.html` | 390 × 844, coarse pointer |

3. **Three layers, measured:**
   - *Structure:* the accessibility tree of the app screen (landmarks, headings, controls and their names) against the screen's intended structure (`27` §3; `toMatchAriaSnapshot` per screen). Mockups' ARIA is a hint, not the target.
   - *Styles and boxes:* the s31c probe reads `getComputedStyle` and `getBoundingClientRect` for named anchors (by role and name, or `data-testid`) in both renders and compares font family, size, weight and line height (exact), colours (ΔE2000 ≤ 2 after resolving tokens, or the register value), padding, gap, radius and box size (± 2 px; ± 1 px for radius and borders).
   - *Pixels:* a mockup-vs-app diff with data-driven regions masked (waveform, titles, numbers), reported with a heatmap for the human reviewer. Never a gate: content and fonts differ.
4. **Iteration cap:** a step stops after 6 iterations without the probe's mismatch count going down and reports the remaining differences with screenshots.
5. **After the owner's review** (G2 for components, G4 for screens) the app screenshot becomes the regular baseline (§4) and the mockup comparison is retired for that screen.

## 6. Usability rounds and the music-stand test (personal mode)
- **G5 music-stand reading test (owner, before the final merge):** Dark vs Light on the same static Practice screen and song; laptop on a desk at 0.5 m, iPad on a stand at 0.75 m (portrait and landscape), tablet or phone on the floor at 1.5 m; daylight by a window, evening room light, a nearly dark room. Tasks: read the current and next chord while playing; read a fret sequence with 1/7, 3/8, 6/0; find the bar being played after looking away; recognise "?" and the dashed outline. Measures: misreadings, time to find the place again, leaning in, eye strain and preference after 20 minutes. **Decision rule:** Dark equals or beats Light everywhere → Dark is the default everywhere; Light wins only in daylight → Dark stays default, Light one tap away in the top bar and Stand view with a one-time suggestion on tablets; Light clearly wins most conditions → Light is the default for Practice and Stand view, Dark stays the default for marketing, Library and dark rooms. The result may retune `26` §6.3.
- **Task round** (owner + 3–5 friends who play; include a beginner and, if possible, a player over 45; own instrument, a stand, bright and dim rooms; think-aloud, no help unless stuck for 60 s):

| Task | Success | Target |
|---|---|---|
| From a fresh browser, reach a slowed loop of the example song's guitar part | Loop playing at ≤ 80 % | ≤ 5 min |
| Add a song from a file, loop bars 9–12 at 70 % with count-in, mark a clean pass using only keys or a pedal | All steps done | Loop in ≤ 2 actions; ≤ 4 min after it plays |
| Find and fix a chord marked unsure | Edit saved and visible after reload | ≤ 2 taps to an alternative; can say what "?" means |
| Set up a pedal from its factory mode | Left/right mapped, test area confirms | < 30 s |
| With the phone on a stand, change speed and count-in without the desktop | Done from the transport | No drag needed |
| With hands on the instrument, loop four bars at 70 % and rate three passes | Done with `4`, Shift+7, Space and the pedal | No pointer used |

Also ask: "From where you're sitting, read me bar 6." and "What does Splitune think it got wrong, and how often?" Log findings with severity in the step report; fix severity-1 issues before the next gate.
- **Device checks (G5):** pedals (AirTurn modes 2/3/5, iRig BlueTurn) through the wizard; iPad Safari and the installed PWA (wake lock for 15 minutes, Web Push); audio sync and latency by ear with wired and Bluetooth headphones after the tap-along calibration (offset ≤ 25 ms).

## 7. Review rubric for "beautiful and professional"

### 7.1 Screen score (the s47 audit's scale)
A screen is scored 1–5 against the checklist of `docs/design/s47-guidelines.md` and five questions: is the music the hero; can a learner start practising in the fewest steps; is every practice action one key or one pedal press away; is the hierarchy clear without colour; are hit targets and contrast within the numbers. **5** meets the checklist with only polish left; **4** is sound with minor issues; **3** works but has several medium issues or one serious one; **2** has serious problems in hierarchy, flow or accessibility; **1** is broken. Issues are critical (blocks a task or fails WCAG AA), high, medium or low. `docs/design/s47-audit.md` holds every screen's score before and after s47. A screen ships at 4 or more with no critical issue.

### 7.2 Craft
Each item 1–3; a screen ships at ≥ 2 on every item.
| Item | 3 looks like |
|---|---|
| Focus | The music (or the screen's one task) is unmistakably the main thing |
| Restraint | Black, white and greys; chrome that recedes; the ink marks now, the loop, the selection and the one primary action; colour only for status, stems, hands and "unsure"; no gradients, glows or glass |
| Rhythm | Spacing follows the scale; edges line up across regions |
| Typography | Sizes by role, two weights, numbers that never jump; nothing below 11 px |
| Consistency | Same component, same behaviour, same words everywhere; both themes feel like one product |
| Honesty | Uncertainty in frequencies, limits and failures visible and explained, no promises the app can't keep |
| Calm | Nothing blinks, nags or celebrates without being asked |

## Carried over (as built before the redesign)
- The Storybook screen-story setup (memory router, fixture-seeded Query cache, `vite.base.ts`), the visual suite on built stories in Docker as `linux/amd64` with `maxDiffPixels: 20`, the forced-colours `bg-card` fallbacks for selected surfaces, the 320 px reflow and 200 % text checks, and the no-LoAF-in-steady-playback measurement (steps 10, 15a, 16) stay; their screenshots and token values change with the redesign.

## Open questions
- Whether Vitest browser `toMatchScreenshot` on stories should replace page-level screenshots once every state has a story (fewer, more targeted baselines).
- The CVD threshold (12 ΔE2000) is met with a small margin (12.4); revisit with simulated stem lanes by eye at G2.

## Sources
- `docs/design/s47-guidelines.md`, `s47-audit.md` and `s47-direction.md` (s47, 2026-11-23). `26-design-system.md` §1.1. `redesign/research/design_system_migration.md` (fidelity layers, token membership, WCAG 2.2 gates, LoAF perf spec, font checks), `redesign/report.md` (acceptance criteria, music-stand test), `docs/steps/00-shared-context.md` ("Redesign steps") (budgets, gates) — 2026-11-08.
- [Storybook accessibility testing](https://storybook.js.org/docs/writing-tests/accessibility-testing), [Playwright snapshots](https://playwright.dev/docs/test-snapshots), [Playwright ARIA snapshots](https://playwright.dev/docs/aria-snapshots), [Long Animation Frames](https://developer.chrome.com/docs/web-platform/long-animation-frames) — tier 2.
- Machado, Oliveira & Fernandes, IEEE TVCG 2009 — tier 1. [WCAG 2.2](https://www.w3.org/TR/WCAG22/) (1.4.1, 1.4.4, 1.4.10, 1.4.11, 2.1.4, 2.2.2, 2.3.1, 2.4.7, 2.4.11, 2.5.3, 2.5.7, 2.5.8, 4.1.3) — tier 1.
- Cross-linked: `18-testing-strategy.md` §5, `24-browser-compatibility.md`, `research/ux/accessibility.md`, `research/ux/hands-busy-and-device-context.md`.
