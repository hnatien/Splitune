# Step s33 — Base components restyled for Night Rehearsal

Redesign step of the "Night Rehearsal" plan (`redesign/orchestrator/prompt.md` §5). The orchestrator wraps this prompt in its worker brief (prompt.md §6), which gives your worktree, setup, the heavy-lock path, the generic rules and the frozen decisions. This prompt holds what is specific to s33.

| | |
|---|---|
| Branch | `impl/s33-base-components` from the current `impl/redesign` tip (not `dev`); the orchestrator merges it |
| Hard deps | s32 |
| Gates | **G2** follows this step: the owner approves the foundations look from your Storybook screenshots of every base component in both themes beside the s31c mockup renders. s34–s36 wait for G2 |
| Owned globs (plan table) | `apps/web/app/ui/**`, `apps/web/e2e/visual/**` |
| Also yours (orchestrator decisions) | `scripts/check-ui-tokens.mjs` (Deliverable 8) and `apps/web/app/features/story-fixtures.ts` (shared story fixtures; after you it is assigned per file at dispatch) |
| Needs the orchestrator's OK first | `apps/web/public/icons/**`, `apps/web/public/favicon.svg` and `apps/web/scripts/render-icons.mjs` if you change the brand mark's PWA icons and favicon (26 §11); otherwise leave them to s45 and say so |
| Effort | xhigh |
| Runs in parallel with | backend steps s40a, s41a; no shared files |

## Before you start
- `docs/steps/00-shared-context.md`, `CLAUDE.md`, `docs/specs/25-personal-mode.md`.
- `docs/specs/26-design-system.md` §2 (subtree theming: components never use shadcn `dark:` variants for colour; `DEFAULT_DISPLAY` and the `stage` distance floor), §4.5 (amber use list), §8 (targets: a target is the element's own border box; painted shape inside transparent padding; no `::after` extensions), §9 (radius scale and the Music Stand → new mapping), §10 (motion), §11 (icons: lucide 1.x, 1.8 px stroke, sizes 16/20/24/28; custom icons; brand), **§12.1** (every base component), **§12.2** rows marked "restyle s33" (TransportButton, SpeedControl/SpeedPanel, CoachMark, DropZone, WaveformPreview, SaveStatus, Brand), **§12.3** (state matrix and the non-colour cue per state), §13 (feedback patterns), §4.9 V9, V10, V12, V16 (corrections you apply).
- `docs/specs/28-ui-quality-and-design-review.md` §2 (story conventions: one story per 26 §12.3 state, both themes, `play` functions for keyboard paths, realistic content), 28 §3 (target-size probe; the existing `transport.stories.tsx` 64/48 assertions stay), 28 §4 (visual regression), 28 §5 checklist, 28 §5.1 (fidelity procedure).
- `redesign/mockups/splitune.css` (component classes `.btn`, `.ib`, `.seg`, `.chip`, `.tabs`, `.toggle`, `.check`, `.range`, `.stepper`, `.field`, `.sheet`, `.overlay`, `.toast`, `.badge`, `.kbd`, `.card`, `.bar`, `.spin`, `.hr`, `.vr`, `.play`) and `redesign/mockups/System.dc.html` (Foundations board).
- `scripts/redesign/README.md`.

## What exists (verified on `impl/redesign` at `0c3d5c3`; s32 will have changed the tokens)
- `apps/web/app/ui/` holds the shadcn/Base UI components and the Splitune kit (one file each: `button.tsx`, `toggle.tsx`, `toggle-group.tsx`, `tabs.tsx`, `switch.tsx`, `checkbox.tsx`, `radio-group.tsx`, `slider.tsx`, `number-field.tsx`, `field.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `dropdown-menu.tsx`, `popover*.tsx`, `tooltip*.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `drawer.tsx`, `toast.tsx`, `badge.tsx`, `kbd.tsx`, `card.tsx`, `progress.tsx`, `meter.tsx`, `spinner.tsx`, `separator.tsx`, `scroll-area.tsx`, `skeleton.tsx`, and the kit files `transport-button.tsx`, `speed-control.tsx`, `speed-panel.tsx` (lazy), `loop-badge.tsx`, `pass-control.tsx`, `chord-chip.tsx`, `confidence-legend*.tsx`, `stem-row.tsx`, `mix-preset-group.tsx`, `waveform-timeline.tsx`, `waveform-preview.tsx`, `pedal-hud.tsx`, `stage-list.tsx`, `song-card.tsx`, `allowance-meter.tsx`, `empty-state.tsx`, `status-message.tsx`, `worker-status.tsx`, `choice-card.tsx`, `radio-card.tsx`, `step-dots.tsx`, `coach-mark.tsx`, `drop-zone.tsx`, `save-status.tsx`, `brand.tsx`) plus `display.ts` (`DEFAULT_DISPLAY.appearance` is `'system'`, `applyDisplay`), `icons/` (`bass.tsx`, `check-draw.tsx`, `index.tsx`) and story files (`button`, `dialog`, `drawer`, `feedback`, `form`, `foundations`, `import`, `library`, `mixer`, `music`, `notation`, `number-field`, `onboarding`, `overlays`, `save-status`, `slider`, `toast`, `toggle`, `transport`, `waveform-timeline`, `brand`, `display`).
- `button.tsx` sizes: `sm` (`min-h-target-sm`, 32), `md`, `lg`, `practice-2`, `practice`, `icon-sm`, `icon`, `icon-practice-2`, `icon-practice`. `transport.stories.tsx` (around line 186) asserts practice targets ≥ 64 × 64 and practice-2 ≥ 48.
- `apps/web/e2e/visual/screens.spec.ts` captures only `Screens/*` stories: 10 rows (home, library, import-file, practice, practice-tab-pending, practice-stems-expired, mock-checkout, settings-display, settings-privacy, account-deleted) → 36 PNGs per engine, 72 committed baselines in `__screenshots__/{chromium,webkit}/`, named `<row>--<viewport>--<appearance>.png`. There is no component row. `focus.spec.ts` checks the sticky bar never hides focus. All 72 baselines are invalidated by the redesign (28 §4).

## Goal
Every component in `apps/web/app/ui/` looks like the `splitune.css` component classes and the Foundations board in Night Rehearsal and Daylight, at normal and increased contrast, with every 26 §12.3 state storied and its non-colour cue in place, its target box per 26 §8, and its props unchanged, so the screen steps compose a finished kit.

## Decisions that bind this step
- **D5:** doc 26's corrections of mockup values that fail existing minimums are accepted; minimums are never lowered (V9 danger text, V10 11 px floor, V12 painted-under-target boxes, V16 switch edge).
- **D6:** budget 318.7 of 320 KB gzip (about 1.3 KB headroom); report before/after bytes; raising it needs the owner.
- **D1:** mockup 390 px renders of desktop-only boards (Main, Practice-*) are not phone references (manifest `overflowX`).
- **D2:** the appearance picker shows 3 theme cards; `stage` stays a valid id, not a card.

## Deliverables
1. **Restyle in place** every 26 §12.1 base component and the 26 §12.2 rows marked "restyle s33", to tokens only, with **props stable** (additive variants and sizes that 26 §12.1 names, such as Button `xl` 56 and `destructiveSolid`, IconButton `box`/`on`, are allowed; renaming or removing a prop is a Stop point). Every other existing `ui/` file moves to the new radius scale (26 §9: old `xl` 14 / `2xl` 18 / `3xl` 24 uses mapped to the new table) and reads only doc 26 roles; their *layout* changes that §12.2 gives to s34–s43 (loop pill, SongMap, pass prompt, stage list, song card…) stay with those steps.
2. **Targets (26 §8, V12):** Button `sm` keeps its painted 32 inside a 44 box (`--target-sm` retired; s45 deletes it), `.btn` 40 in 44, `.ib` 40 in 44, chips and segments painted at their mockup size inside 44 (48 in practice density via the shell's density attribute, 26 §7), steppers 44/48 with 40-tall wells, Tabs 44 browse / 48 practice, Switch row 44, main practice controls 64 painted and hit, Play 64 / 72 phone / 84 `xl`. A story `play` probe measures each control's border box (28 §3 target-size row).
3. **States (26 §12.3):** a story per state (`Default`, `Hover`, `Focus`, `Pressed`, `On`/`Selected`, `Disabled`, `Loading`, `Error`, plus domain states) in both themes (Side by side global, or a `Daylight` story), with its non-colour cue; disabled = `--muted` fill + `--faint-foreground` text + ≥ 3:1 boundary + "Unavailable" in the accessible name, never 50 % opacity; focus 2 px `--ring` outline, 2 px offset (fields 1 px), 3 px under increased contrast; forced-colours fallbacks kept.
4. **Display defaults (26 §2):** `DEFAULT_DISPLAY.appearance` `system` → `dark`; `applyDisplay` raises `data-distance` to `stand` when `stage` resolves at `desk`; `.dark` set for `dark` and `stage`; `color-scheme` written. Update `display.test.ts` expectations that encode the old default (expected-value change by design; list each).
5. **Icons (26 §11):** lucide at `strokeWidth={1.8}` with the §11 sizes; the custom set in `ui/icons/` (pedal, two pedals, capo, tab staff, chord box, count-in, minus-one, your part, desk/stand/floor distance illustrations; `bass` exists) on the same grid. `Brand`: lowercase wordmark + 28 px amber disc crossed by a graphite wave.
6. **Visual baselines:** add a component row set to `apps/web/e2e/visual/` (a new spec file beside `screens.spec.ts`, or rows in it) for the restyled base components in Night Rehearsal and Daylight at one viewport, generate them with `e2e:visual:update`, and list what each shows. Leave the 72 screen baselines stale (each screen step regenerates its own); say so in the report.
7. **G2 evidence:** Storybook screenshots of every base component in both themes next to the matching crops of `System` and the boards that use them, saved to your report folder (`<run>/reports/s33/`), with a one-page index (component → story id → mockup crop).
8. **`check-ui-tokens` rules (28 §3 "Raw values"):** add to `scripts/check-ui-tokens.mjs` the rules 28 §3 requires — arbitrary colour, radius, font-size and shadow values (Tailwind `[…]` arbitrary values and CSS literals), and style-prop colour literals — **scoped to `apps/web/app/ui/**`** (screens are restyled later; s45 widens the scope to all of `apps/web/app`). Add a repeatable `--path <dir>` option that runs the extended rules on the given paths, so every screen step can check its own area (`node scripts/check-ui-tokens.mjs --path apps/web/app/features/library`); document it in the script header. Unit-test each rule with a passing and a failing sample. Keep the existing rules and their scope unchanged.

## Out of scope
Feature screens and their stories (s34–s43); new kit components (each later step adds its own); deleting Music Stand tokens (s45); regenerating screen baselines.

## Acceptance criteria
- Every `ui/` component has stories for each 26 §12.3 state in both themes; axe (`test: 'error'`, WCAG 2.2 tags) passes in Chromium and WebKit; the target-size probe passes for every control; `transport.stories.tsx` assertions unchanged and green.
- Fidelity (28 §5.1): for each 26 §12.1 component, probe anchors in the Storybook story vs the `System` board (1440, `--look fixed`) and one board that uses it in both looks at 1440 and 1180 (for example `Main` for transport, `AddSong` for fields and radio cards, `Settings-Display` for switches and steppers): font family/size/weight/line height exact, colours ΔE2000 ≤ 2 (or the 26 §4.9 value), padding/gap/box ± 2 px, radius/borders ± 1 px. Report the mismatch count per component per iteration; at most 6 iterations without improvement.
- One filled amber control per view in every story (26 §4.5); no `dark:` colour variants in `ui/`.
- `display.ts` default is `dark`; a story or test proves `stage` at desk resolves to stand sizes.
- `pnpm lint` JS checks clean, including the extended `check-ui-tokens` rules on `apps/web/app/ui/**` (Deliverable 8), with tests for the new rules; no rule suppressed.
- Budget before/after reported; no growth beyond the headroom; `css-floor` clean.

### Commands (prefix each with `cd "<worktree>" &&`)
```bash
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget          # before, then after
pnpm exec biome check . && node scripts/check-db-access.mjs && node scripts/check-ui-tokens.mjs
node scripts/check-ui-tokens.mjs --path apps/web/app/ui   # s33's extended 28 §3 rules (arbitrary colour, radius, font-size, shadow, style-prop colours) on your area
pnpm --filter @splitune/web typecheck && pnpm --filter @splitune/web test
pnpm --filter @splitune/web test:stories                                          # heavy lock; rerun once on Vite optimisation failure
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget --enforce && pnpm --filter @splitune/web css-floor
pnpm --filter @splitune/web storybook                                             # heavy lock, port 6006, for the probes
node scripts/redesign/render-mockups.mjs --file System --file Main --file AddSong --file Settings-Display
node scripts/redesign/probe.mjs 'http://localhost:6006/iframe.html?id=<story-id>&viewMode=story' --look night --width 1440 --select '#storybook-root <anchor>'
node scripts/redesign/probe.mjs System --look fixed --select '<anchor>'
pnpm --filter @splitune/web e2e:visual:update -g "<your component rows>"          # heavy lock, Docker image mcr.microsoft.com/playwright:v1.64.1-noble
pnpm --filter @splitune/web e2e:visual -g "<your component rows>"
```
Known pre-existing failures: WebKit practice/audio stories timing out at 15 s; first `test:stories` run in a fresh worktree failing in Vite dependency optimisation (rerun once). Screen baselines (`screens.spec.ts`) fail after this step by design until their screen step regenerates them; don't regenerate them here.

## Stop points (stop, report with 2–3 options and a recommendation, wait)
1. A component can't match the mockup without a prop change, or doc 26 and `splitune.css` disagree beyond §4.9.
2. A feature story or feature component (outside `ui/`) breaks because of a restyle: that file isn't yours.
3. A restyle needs a token that s32 didn't ship (`packages/ui-tokens` is s32's).
4. The budget would exceed 320 KB.
5. Any check would only pass by editing a test assertion that isn't an expected value changed by design.

## Git
- Branch `impl/s33-base-components`; subject-only Conventional Commits (for example `feat(ui): restyle base components on night rehearsal tokens so screens compose a finished kit`); stage exact paths; gitleaks before each commit; commit baselines in the same commit as the change they show.
- Never push, merge, rebase onto `dev` or open a PR. No edits to `docs/status.md`, `docs/progress-log.md`, `docs/steps/README.md`; progress-log entry in your report.
