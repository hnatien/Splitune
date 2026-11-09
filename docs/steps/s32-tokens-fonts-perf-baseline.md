# Step s32 — Night Rehearsal tokens, fonts and the practice perf baseline

Redesign step of the "Night Rehearsal" plan (`redesign/report.md`). Read `docs/steps/00-shared-context.md` first, including its "Redesign steps" section (frozen decisions, decisions D1–D21, environment, known failures, owner gates). This prompt holds what is specific to s32.

## State (2026-11-09)
Done on `impl/s32-tokens-fonts` (not merged into `dev`). The progress-log entry "Step s32: Night Rehearsal tokens, fonts and the practice perf baseline" lists what was built and measured, and every changed expected value. Owner action left: the legibility check in the "Foundations/Fonts › Legibility" story (`pnpm --filter @splitune/web storybook`, then `http://localhost:6006/?path=/story/foundations-fonts--legibility`).

| | |
|---|---|
| Branch | `impl/s32-tokens-fonts` from the latest `dev` |
| Hard deps | G1 |
| Gates | G1 must be approved before you start. The Instrument Sans / JetBrains Mono / Inter legibility check is a human check: you add it to the owner's queue (Owner actions) and implement the primary choice. G2 (after s33) reviews the look |
| Owned globs | `packages/ui-tokens/**`, `scripts/fonts/**`, `apps/web/public/fonts/**`, `apps/web/public/manifest.webmanifest`, `apps/web/app/styles.css`, `apps/web/.storybook/**`, font-preload/theme-color lines in `apps/web/app/routes/__root.tsx`, `pnpm-lock.yaml` |
| Also yours (D9) | `apps/web/e2e/perf-practice.spec.ts` and `apps/web/e2e/perf-baseline.json` (new: the perf baseline below); the expected values in `apps/web/app/manifest.test.ts` lines 32–33 (they follow `BACKGROUND_HEX`, see Deliverable 4) |
| Effort | xhigh |

## Before you start
Read, in this order:
- `docs/steps/00-shared-context.md`, `CLAUDE.md`, `docs/specs/25-personal-mode.md`.
- `docs/specs/26-design-system.md` in full: §2 (appearance model), §3 (token architecture, gamut rule, mockup-name → role mapping), §4.1–§4.9 (every value you write, the verified contrast tables, the deviation register), §6.1–§6.3 (families, subsetting, glyph and legibility checks, browse scale, reading scale and floors), §7–§10 (spacing, targets, radius, motion tokens), §11 (`BACKGROUND_HEX`, brand).
- `docs/specs/28-ui-quality-and-design-review.md` §2 (Storybook toolbar: Appearance Night Rehearsal / Daylight / Stage / Side by side, Contrast, Density, Distance, Reduced motion, Pointer; the Score global is removed), §3 (the token, gamut, CVD, naming and font checks), §3.1 (perf baseline).
- `docs/specs/12-practice-screen-and-notation.md` §10 (performance budgets).
- `redesign/mockups/splitune.css` (the `:root` and `[data-theme]` blocks are the source values; doc 26 is the binding version where they differ) and `redesign/mockups/System.dc.html` (Foundations board).
- `scripts/redesign/README.md` (render and probe commands) and `redesign/report.md` "Type: Instrument Sans and JetBrains Mono…" and "Motion follows only the music".

## What exists (verified at `0c3d5c3`)
- **Tokens:** `packages/ui-tokens/src/{primitives.css,themes.css,theme.tailwind.css,fonts.css,index.ts}` hold the Music Stand system; tests `contrast.test.ts`, `palette.test.ts`, `tokens.test.ts` and the helper `testing/cascade.ts` (CSS cascade per context). `index.ts` exports `SEMANTIC_ROLES` (line 19), `COMPONENT_TOKENS` (86), `CONTRAST_PAIRS` (152), `STEMS` (248), `readToken`/`readColor` (280/291) and `BACKGROUND_HEX = { light: '#f7f6f2', dark: '#181612' }` (318).
- **Reading sizes:** `theme.tailwind.css` sets `--read-*-base` per `data-distance` (Desk tab 1.5rem, current chord 2rem; Stand tab 2.25rem, current chord 3rem; Floor current chord 5.5rem) and `--read-scale` 1.25 for `stage`; the "reading sizes" block of `tokens.test.ts` (around lines 279–290, titled after 26 §6.3) asserts Stand tab `2.25rem`, Desk current chord `2rem`, Floor current chord `5.5rem`, `stage` `--read-scale` `1.25`.
- **`BACKGROUND_HEX` consumers:** `apps/web/app/routes/__root.tsx` lines 41–43 (two `theme-color` metas, light and `prefers-color-scheme: dark`), `apps/web/app/manifest.test.ts` lines 32–33 (`background_color` and `theme_color` = `BACKGROUND_HEX.light`), `tokens.test.ts` "BACKGROUND_HEX" block (line 293). `apps/web/public/manifest.webmanifest` has `#f7f6f2` for both.
- **Fonts:** `apps/web/public/fonts/` holds `InterVariable.woff2`, `InterVariable-Italic.woff2`, `AtkinsonHyperlegibleNext.woff2` and their OFL texts; `__root.tsx` line ~52 preloads `/fonts/InterVariable.woff2`. `scripts/fonts/subset.sh` pins Inter 4.1 (release zip) and Atkinson Hyperlegible Next (google/fonts commit) by SHA-256, runs `fonttools[woff]==4.67.0` with `SOURCE_DATE_EPOCH` for reproducible output and limits Inter's `wght` to 400–700. No Instrument Sans or JetBrains Mono file exists anywhere in the repo. There is no font test.
- **Storybook:** `apps/web/.storybook/preview.tsx` globals `appearance` (default `light`), `contrast`, `density`, `distance` (`desk`), `motion` (`full`), `readingFont`, `score` (default `paper`); the decorator writes the same `data-*` attributes as the app.
- **Perf:** `apps/web/e2e/perf.spec.ts` (step 16) checks two things only: no Long Animation Frame ≥ 50 ms in 12 s of steady playback (Chromium, LoAF scripts attached) and a capo redraw ≤ 300 ms median on `tablet-chrome` with CDP CPU throttling 4×. Nothing records forced layout or Event Timing latency, and no baseline is stored.
- **Budget:** practice route 318.7 KB gzip of 320 KB (D6). `apps/web/scripts/css-floor.mjs` rejects `light-dark()`, relative colour syntax, `@scope` and native nesting in the built CSS.

## Goal
`packages/ui-tokens` implements doc 26's Night Rehearsal and Daylight roles (normal and increased contrast, plus `stage`) as static OKLCH literals that pass every contrast, gamut, CVD and naming test; Instrument Sans and JetBrains Mono ship self-hosted, subset reproducibly with `tnum` proven; `BACKGROUND_HEX`, the manifest, `theme-color` and Storybook follow; and a committed perf baseline of the **current, not yet restyled** practice screen exists for s35 and s45 to compare against.

## Decisions that bind this step
- **D5:** doc 26's corrections of mockup values that fail existing minimums are accepted; minimums are never lowered.
- **D6:** measured practice-route budget at dev 8d6a3f6 is 318.7 KB gzip of 320.0 KB (about 1.3 KB headroom). Every UI step reports before/after bytes; raising the budget needs the owner.
- **D7:** raised reading-size token literals (doc 26 §6.3) are design value changes that s32 applies to `tokens.test.ts` expectations, listing each; floors never go down.
- **D2:** the appearance picker shows 3 theme cards (System, Night Rehearsal, Daylight); `stage` stays a valid id, not a card. (Your Storybook toolbar still offers Stage, per 28 §2.)
- Frozen decisions 1 and 2: Night Rehearsal is the default and `:root`; ids stay `system | light | dark | stage`.

## Deliverables
1. **Perf baseline first, before you change any token** (28 §3.1 step 1, 12 §10). On the current practice screen in Chromium with CDP `Emulation.setCPUThrottlingRate` 4×:
   - Long Animation Frames over 20 s of looped playback with count-in (`PerformanceObserver({ type: 'long-animation-frame' })`, with script attribution);
   - forced style/layout during steady playback (LoAF `forcedStyleAndLayoutDuration` per script, or a CDP trace; say which);
   - p75 latency (Event Timing, N ≥ 10 each) for play/pause, loop nudge, speed step and a mixer fader key step.
   Drive every action by role and accessible name or by a key that keeps its meaning after s35 (speed: the on-screen −/+ buttons, because ↑/↓ stop changing speed in s35). Put every selector in one table at the top of the spec so a later step can update a renamed control in one place.
   Deliver it as `apps/web/e2e/perf-practice.spec.ts` (Chromium project only, using `openExample` from `e2e/helpers.ts` like `perf.spec.ts`; it records and writes JSON, it asserts no thresholds yet) and the committed result `apps/web/e2e/perf-baseline.json` (git sha, machine, browser version, throttling, every measure with n, p50, p75 and max). Copy the result into `redesign/.renders/<id>/` (ignored) too. Record two contexts: desktop Chromium (1440 × 900, fine pointer) and a **tablet** context (1180 × 820, `hasTouch`/`isMobile`, Chromium, the same 4× throttling) so s43 has a tablet baseline; the JSON keys each measure by context. Run each 3 times and keep the median run; report the spread.
2. **Tokens** (`primitives.css`, `themes.css`, `theme.tailwind.css`, `index.ts`): every value in 26 §4.1–§4.8 for `dark` (= `:root`), `light`, `stage`, each × `data-contrast="more"`; the Splitune roles of 26 §3 tier 2 and the component tokens of §4.7 (including the new `--tile-foreground`, `--read-chord-sheet`, `--read-chord-next`, `--target-stand`); static scales of 26 §6.2 (browse type), §6.3 (reading sizes per preset, phone clamps are s43's), §8 (targets), §9 (radius: `xs` 4 … `4xl` 22), §10 (durations, easings, stagger). Literals are rounded per 26 §3; saturated values are clamped in the source (26 §3 gamut rule). Subtree theming per 26 §2: every theme block also matches `[data-appearance]` on any element. Keep the Music Stand roles that doc 26 no longer lists defined until s45 deletes them, but nothing new may read them. Remove the `data-score` paper surface (26 §2: `--paper` = `--background`).
3. **Token tests** rewritten to doc 26: `CONTRAST_PAIRS` per 26 §4.6 "How the Music Stand pairs map" (no pair dropped, no minimum changed; `--primary` as text becomes `--primary-ink`), the "§4.6 baseline values" and "§4.8 surface and status-surface values" blocks checked to ±0.1, a new translucent-wash block using `over()` (26 §4.6 "Translucent washes"), gamut and CVD (`palette.test.ts`, ≥ 12 ΔE2000) on the §4.4 stems. Every changed expected value is listed in your progress-log entry with its reason (D7), including each reading-size literal (for example Desk `--read-chord-current-base` 2rem → 7rem) and the scrim values. Floors stay: Stand tab ≥ 36 px, Desk current chord ≥ 32, Floor current chord ≥ 88, tab digits ≥ 18.
4. **`BACKGROUND_HEX`** = Night `#110e0b`, Daylight `#f8f5f1` (26 §11), still keyed `light`/`dark`. `manifest.webmanifest` `background_color` and `theme_color` use the Night value (Night is the default and the no-JS paint). The two `theme-color` metas in `__root.tsx`: Night for no media query and `prefers-color-scheme: dark`, Daylight for `prefers-color-scheme: light` (the head script still resolves the stored choice). `manifest.test.ts` asserts `BACKGROUND_HEX.light` today; changing it to `.dark` is an expected-value change by design (D9).
5. **Fonts** (`scripts/fonts/subset.sh`, `apps/web/public/fonts/`, `packages/ui-tokens/src/fonts.css`): Instrument Sans Variable (roman, `wght` 400–700, `wdth` 100) and JetBrains Mono Variable (`wght` 400–700) from pinned upstream files with SHA-256, `pyftsubset --layout-features='*'`, the 26 §6.1 code points (add ♯ ♭ ♮ U+266D–266F, · × ÷, ‹ › U+2039/203A, U+202F; keep the existing ranges), `varLib.instancer` to the weights the scale uses; Instrument Sans roman ≤ 80 KB (the preload budget); OFL texts beside the files; `font-display: swap` with metric-matched fallbacks (`size-adjust`, `ascent-override`, …) so the dock can't reflow. Preload Instrument Sans only. Atkinson Hyperlegible Next stays (opt-in reading font). Inter: remove its files, `@font-face` and preload (its pinned recipe stays in git history; the owner's legibility check may bring it back as the fallback).
6. **Font tests:** a test under `scripts/fonts/` (runs with `pnpm exec vitest run --dir scripts`, like `scripts/redesign`) that fails if a shipped WOFF2 lacks `tnum` or any 26 §6.1 code point, or the preloaded file exceeds 80 KB; and a browser check that JetBrains Mono readouts keep their width as digits change (a story `play` function or the font test in Playwright; say which).
7. **Glyph check (26 §6.1, automated part of the s32 gate):** report which of ♯ ♭ − · U+202F each family covers. A missing ♯/♭ is expected and handled by `ChordSymbol`'s fallback; anything else missing is a Stop point.
8. **Tailwind mapping and app CSS:** `theme.tailwind.css` maps the semantic roles with `@theme inline`; `apps/web/app/styles.css` imports and base styles follow (font families, `color-scheme`, body ground). Nothing outside `packages/ui-tokens` gains a raw value.
9. **Storybook** (`apps/web/.storybook/**`): fonts loaded as in the app; toolbar per 28 §2 (Appearance Night Rehearsal / Daylight / Stage / Side by side, default Night Rehearsal; Contrast; Density; Distance; Reduced motion; Pointer); the Score global removed. Keep the global names the s31c probe sets (`appearance`, `distance`, `motion`; `scripts/redesign/README.md` "Probe").
10. **Foundations story** updated to show the new primitives, roles, type and reading scales in both themes (the existing `apps/web/app/ui/foundations.stories.tsx` is s33's file: if it breaks on removed tokens, stop and ask rather than editing it; otherwise leave it to s33).

## Out of scope
Restyling components (s33), any feature screen (s34–s43), deleting Music Stand roles (s45), the phone fit rule (s43), new visual baselines (none of the 72 is regenerated here; they are all invalidated by the redesign, 28 §4), the human legibility and music-stand tests (G5).

## Acceptance criteria
- `perf-baseline.json` committed **from a run on the unchanged practice screen**, with the commit that recorded it named; the spread over 3 runs reported.
- All token tests pass in every context (`dark`, `light`, `stage` × normal, more): contrast minimums, the ±0.1 baseline and surface blocks, translucent washes, gamut, CVD ≥ 12 ΔE2000, naming (`BACKGROUND_HEX` agrees with `--background`; component tokens never reference a primitive).
- Every changed expected value listed with its reason; no minimum, tolerance or floor lowered.
- Fonts reproducible (two runs of `subset.sh` give identical bytes), `tnum` and the code points proven by the test, preload ≤ 80 KB.
- Storybook builds and every existing story still passes axe in Chromium and WebKit; the Foundations story shows Night Rehearsal and Daylight side by side.
- Fidelity smoke: probe `System` (`--look fixed`, 1440) against the Foundations story at 1440 in both themes for the swatches, type samples and radii; report mismatches that aren't in 26 §4.9.
- Budget before/after reported (fonts and CSS can move the entry chunk); `css-floor` clean.

### Commands (bash on macOS or Git Bash on Windows; prefix each with `cd "<worktree>" &&`)
```bash
# before changing anything: budget and the perf baseline (needs .env and the e2e stack)
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget
cd apps/web && UV_PROJECT_ENVIRONMENT=<shared ML venv> UV_NO_SYNC=1 pnpm exec playwright test e2e/perf-practice.spec.ts --project chromium
# after
pnpm exec biome check . && node scripts/check-db-access.mjs && node scripts/check-ui-tokens.mjs
pnpm --filter @splitune/ui-tokens typecheck && pnpm --filter @splitune/ui-tokens test
pnpm exec vitest run --dir scripts
bash scripts/fonts/subset.sh && git status --short apps/web/public/fonts   # second run: no change
pnpm --filter @splitune/web typecheck && pnpm --filter @splitune/web test
pnpm --filter @splitune/web test:stories                                      # rerun once if Vite optimisation fails
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget --enforce && pnpm --filter @splitune/web css-floor
node scripts/redesign/probe.mjs System --look fixed --select '<anchor>' --out <report dir>/system.json
```
Known pre-existing failures (report as pre-existing, never skip): WebKit practice/audio stories timing out at 15 s; the first `test:stories` run in a fresh worktree failing during Vite dependency optimisation (rerun once).

## Stop points (stop, report the conflict with 2–3 options and a recommendation, wait)
1. A doc 26 value that fails a test minimum, the gamut rule or the CVD test as written (doc 26 says they all pass; a failure means a transcription error or a spec error, not a reason to move a minimum).
2. Doc 26, `splitune.css` and the existing tests disagree in a way 26 §4.9 doesn't cover.
3. A font family misses a glyph other than ♯/♭, lacks `tnum`, or Instrument Sans roman can't get under 80 KB at the 26 §6.1 weights.
4. The budget would exceed 320 KB.
5. You need a file outside the owned globs and the OK'd extras (for example a component in `apps/web/app/ui/` that breaks on a removed role, or `scripts/check-ui-tokens.mjs`, which is s33's).
6. The perf spec can't drive an action on today's screen without changing app code.

## Git
- Branch `impl/s32-tokens-fonts`; subject-only Conventional Commits, lowercase imperative, explaining why (for example `feat(ui-tokens): replace music stand values with night rehearsal and daylight roles so every screen restyles from one source`); stage exact paths; `gitleaks git --pre-commit --staged --redact --verbose` before each commit. Commit the perf baseline in its own commit before the token commits, so its parent is the unchanged screen.
- Don't push, merge or open a PR unless the owner asks. Append your progress-log entry and update your row in `docs/status.md` (`00-shared-context.md`, "Git and progress").
- **Owner actions to list:** the legibility check of 26 §6.1 (JetBrains Mono tab digits vs Instrument Sans and Inter 4 tabular digits on 1/7, 3/8, 6/0 at 0.5 / 0.75 / 1.5 m, with a story or page you prepare for it and its exact URL); the outcome decides whether Inter 4 replaces a family in a later step.
