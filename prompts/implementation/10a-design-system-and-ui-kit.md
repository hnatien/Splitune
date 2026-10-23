# Step 10a — Design system, UI kit and Storybook

## Before you start
Read `prompts/implementation/00-shared-context.md`, then:
- `docs/implementation/26-design-system.md` (primary: direction, appearance model, tokens with exact values, confidence encoding, type and reading sizes, targets, motion, icons, component inventory)
- `docs/implementation/28-ui-quality-and-design-review.md` §1–§4 (where UI code lives, Storybook setup, automated design checks)
- `docs/implementation/27-screens-flows-and-content.md` §5 (voice, terminology, style rules — for story content)
- `docs/implementation/10-web-app-architecture.md` §2, §7 (app layout; design-system pointer)
- `docs/implementation/24-browser-compatibility.md` §2 (CSS floor: no `light-dark()`, no relative colour syntax)
- Research for context: `docs/ux/accessibility.md`, `docs/ux/hands-busy-and-device-context.md`

Prerequisites: Step 01. Runs **before step 10** (step 10 builds screens on this kit); can run in parallel with 02–09 and 11.

## Goal
A working "Music Stand" design system: tokens for Light/Dark/Stage with contrast-tested values, self-hosted fonts and icons, the shadcn/Base UI base components themed with those tokens, the Splitune kit components that don't need the audio engine, and Storybook with a11y tests — so every later UI step composes from it instead of inventing styles.

## Deliverables
1. **`packages/ui-tokens`:** `primitives.css`, `themes.css` (`[data-appearance=light|dark|stage]`, `[data-contrast=more]`, `prefers-color-scheme` fallback), `theme.tailwind.css` (`@theme` static scales incl. type steps, `--read-*` reading sizes per distance preset, `--target-*`, durations/easings, z-layers; `@theme inline` semantic mapping; `--color-*: initial`), `fonts.css`, `index.ts` (typed token names, stem/confidence metadata, `readToken()`), and the token tests from doc 28 §3 (contrast with `colorjs.io`, gamut, CVD separation, naming). Use the exact values in doc 26 §4, including the component tokens (`--loop-*`, `--playhead`, `--score-loop-fill`, `--score-loop-edge`, `--score-playhead`, `--staff`, `--hud-*`); if a value must change, update doc 26 §4 and §4.6 in the same change. `docs/implementation/design/reference.html` shows the intended look (illustrative, not binding).
2. **Fonts:** subset upstream Inter 4.1 Variable (roman + italic) and Atkinson Hyperlegible Next with `pyftsubset --layout-features='*'` via a reproducible script (`scripts/fonts/subset.sh`, using the uv tooling already in the repo or `uvx fonttools`); write WOFF2 to `apps/web/public/fonts/` with the OFL licence files; record sizes. Font binaries are third-party assets, not generated build output — commit them with their licences and note it in `PROGRESS.md`.
3. **`apps/web` UI scaffold** (only what the kit needs; step 10 adds routes): Tailwind v4 wired to `@splitune/ui-tokens`, the inline appearance script + `color-scheme`, shadcn CLI v4 init on Base UI (`components.json` style `base-nova`, `baseColor: neutral`, values replaced by our tokens, `.dark` kept for Dark and Stage), `lucide-react` 1.x.
4. **Base components** (doc 26 §12.1) generated with the shadcn CLI into `apps/web/app/ui/` and adjusted to tokens and sizes: Button (all variants + `practice`/`practice-2` sizes + loading), Toggle, ToggleGroup, Slider (horizontal, vertical, range), NumberField, Dialog, AlertDialog, Drawer/Sheet, Popover, Tooltip (with shortcut slot), Menu, Select, Tabs, Switch, Checkbox, Radio, Field/Input, Progress, Meter, Badge, Card, Skeleton, Toast, Separator, Scroll Area.
5. **Splitune kit** (doc 26 §12.2) that is engine-independent, with fixture data: `TransportButton`, `SpeedControl`, `LoopBadge`, `PassControl`, `ChordChip`, `ConfidenceLegend`, `StemRow`, `MixPresetGroup`, `PedalHud`, `StageList`, `SongCard`/`SongRow`, `AllowanceMeter`, `EmptyState`, `InlineError`, `Banner`, `WorkerStatus`, custom icons, wordmark + app icon set (SVG; maskable PWA icon, favicons). `WaveformTimeline` and the alphaTab overlay belong to step 12.
6. **Storybook 10.6** in `apps/web/.storybook/` with decorators for appearance, contrast, density, distance and reduced motion; `@storybook/addon-a11y` with `test: 'error'`; `@storybook/addon-vitest` project `test:stories` running in Chromium + WebKit; one story per state (doc 26 §12.3) for every component above; a "Foundations" section (colour roles with live contrast ratios, type scale, reading sizes, targets, motion, icons).
7. **Lint guard** `scripts/check-ui-tokens.mjs` (raw colour literals outside `ui-tokens`, `outline: none` without replacement) wired into `pnpm lint`, following `scripts/check-db-access.mjs`.
8. **CI and agent rules:** run `test:stories` and the `ui-tokens` tests in `.github/workflows/ci.yml` (install Playwright Chromium + WebKit with cache); add one UI rule line to `CLAUDE.md` (= `AGENTS.md`) mirroring `00-shared-context.md` (tokens and `app/ui` only, docs 26–28).
9. **Docs:** add the installed versions (Storybook, lucide-react, colorjs.io, fonts) to `docs/implementation/00-tech-stack.md`; any deviation recorded in doc 26 and `PROGRESS.md`.

## Out of scope
Routes, data fetching, auth UI (step 10); waveform canvas, alphaTab and practice layouts (step 12); visual-regression baselines of real screens (step 15a).

## Acceptance criteria
- `pnpm --filter @splitune/ui-tokens test`: every pair in doc 26 §4.6 passes in Light, Dark and Stage, normal and increased contrast; gamut and CVD tests pass; a deliberately lowered `--muted-foreground` makes the test fail (show it, then revert).
- `pnpm --filter web test:stories`: all stories render in Chromium and WebKit with zero serious/critical axe violations.
- Switching appearance in Storybook and in a test page changes every component without reload and without a flash on load (verify with JS disabled: the media-query fallback applies).
- Targets: practice-size Button/TransportButton measure ≥64×64 CSS px; browse ≥44; checked by a story test.
- Fonts: Inter features `tnum` and `cv*`/`ss*` work in the subset (story shows `0123456789` tabular alignment); total preloaded font ≤ 80 KB.
- `pnpm lint` fails on a planted `#ff0000` in `apps/web/app` and passes after removal.

## Verification to run and report
`pnpm --filter @splitune/ui-tokens test`, `pnpm --filter web test:stories`, `pnpm --filter web storybook:build`, `pnpm lint`, `pnpm typecheck`, font subset sizes, screenshots of the Foundations page in Light/Dark/Stage, the mutation checks above.
