# Step s43 — Phone and tablet: glance view, Tools sheet, Stand view, pedal setup wizard

Redesign step of the "Night Rehearsal" plan (`redesign/orchestrator/prompt.md` §5), last in the practice lane (s35 → s37 → s38 → s39 → s40b → s41b → s42 → **s43**). The orchestrator's worker brief (prompt.md §6) gives your worktree, setup, heavy-lock path, generic rules and the frozen decisions; this prompt holds what is specific to s43.

| | |
|---|---|
| Branch | `impl/s43-phone-tablet` from the current `impl/redesign` tip (not `dev`); the orchestrator merges it |
| Hard deps | s42 |
| Gates | G4 (owner on real devices after the practice lane: phone, tablet on a stand); **G5** (owner, before the final merge): pedal hardware through the wizard (AirTurn modes 2/3/5, iRig BlueTurn), iPad Safari and the installed PWA (wake lock for 15 minutes) |
| Owned globs (plan table) | practice layout files, `features/settings/**` keyboard parts |
| Concretely | `apps/web/app/features/practice/{layout.ts,glance-view.tsx,practice-page.tsx}`, new Stand view, phone landscape and Tools-sheet files under `features/practice/` (all lazy), `input-mapper.ts`, `key-bindings.tsx`, `keys-store.ts`, `model/keymap.ts` (+ tests) for pedal capture, holds and presets, the hot practice files; `apps/web/app/features/settings/keyboard-settings.tsx` and new wizard files under `features/settings/`; `en.json` keys in `stand.*`, `tools.*`, `pedal.*` (new groups at their alphabetical positions) and the s43 `shortcuts.*` rows |
| Needs the orchestrator's OK first | a new E2E spec for the phone fit rule (for example `apps/web/e2e/phone-fit.spec.ts`; 26 §6.3 says s43 builds and tests it); `apps/web/app/ui/pedal-hud.tsx` if the "Set it up" action needs a prop; the visual baselines `practice--phone--*` and `practice--tablet--*`, `practice-tab-pending--*`, `practice-stems-expired--*` (tablet rows change to Stand view) |
| Effort | xhigh |
| Runs in parallel with | backend steps (s44) only |

## Before you start
- `docs/steps/00-shared-context.md`, `CLAUDE.md`, `docs/specs/25-personal-mode.md`, `docs/specs/24-browser-compatibility.md` (feature-detect, never UA-sniff; Tier 1 browsers).
- `docs/specs/12-practice-screen-and-notation.md` §1 (layouts: Stand view by default on tablets, glance, Tools, phone landscape), §3 (Stand view turns pages on the downbeat from the audio clock, never mid-system; a pedal turn wins; reduced motion), **§8** (pedal wizard: capture left/right, three presets, hold ≥ 0.5 s = second action, one pedal, conflicting defaults unassigned, test area, per device; "Learn key" table), §9, §10.
- `docs/specs/27-screens-flows-and-content.md` **§3.7.2** (Stand view, phone glance, Tools sheet, phone landscape, desktop "All tools" / ⋯ choice), §3.9 Keyboard & pedal (wizard card steps and copy, presets with hints, hold rule), §2 "Set up a pedal" (a pair in < 30 s), §5.7 `shortcuts.*` (s43 rows), `stand.*`, `tools.*`, `pedal.*` rows.
- `docs/specs/26-design-system.md` **§6.3** (Stand view sizes one step larger for the current/next chord; phone glance clamps; **the phone fit rule** and its test), §7 (layout selection), **§8** (64 main controls on phones, Play 72, Stand view 88 dock buttons, Tools sheet tiles 48+), §12.2 `ToolsSheet`, `StandView`, `PedalWizard`, `PedalHud`, §4.9 V11, V15.
- `docs/specs/28-ui-quality-and-design-review.md` §3 (Phone fit row, target sizes incl. 88 Stand view, focus not obscured with the Tools sheet open), §5, §5.1 (Stand at 1180 × 820 coarse, Music stand; Phone-* at 390 × 844 coarse), §6 (the task round items for pedals and the Tools sheet).
- Mockups: `Stand.dc.html`, `Phone-Practice.dc.html`, `Phone-Tools.dc.html`, `Settings-Pedal.dc.html`. Report sections "Stand view on tablets", "Phones: glance first, Tools when needed", "Settings and the pedal wizard", "The new key and pedal map".

## What exists (verified on `impl/redesign` at `0c3d5c3`; s35–s42 will have changed it)
- `features/practice/layout.ts` `usePracticeLayout()` returns `desktop`, `tablet-landscape`, `tablet-portrait`, `phone-landscape`, `phone-portrait` from `(pointer: coarse)`, `(max-width: 640px)`, `(max-height: 640px)` and orientation (feature queries only).
- `glance-view.tsx` (lazy) is today's phone view; there is no Stand view, Tools sheet or wizard. `model/keymap.ts` has per-action learned keys (`LearnedKeys`, `learn()`); "Learn this pedal" exists in `keyboard-settings.tsx`. After s35 ↑/↓ show "Pedal detected? Set it up" and `keys-store` has `singleKeys`; after s36 Keyboard & pedal has a "Have a pedal? Set it up" placeholder card; after s40b the phone mini-mixer exists; after s42 `BeatPulse` animates and the vibrate setting exists.
- `score-theme.ts` keeps tab digits ≥ 18 px.

## Goal
Tablets open Practice in Stand view (one system that fits, page turns on the downbeat, four 88 px pedal-mirroring buttons); phones get the glance view, a landscape tab strip that obeys the phone fit rule, and a Tools sheet with every practice control stepped and no drag; and a pedal is set up from its factory mode in under 30 seconds through the wizard.

## Decisions that bind this step
- **D4:** Stand view is the default practice layout on tablets.
- **D1:** phone QA compares against `Phone-*` boards, tablet against `Stand`; never against 390 px renders of desktop boards.
- **D3:** the Tools sheet's ladder switch reads "+{step} % after {n} clean passes, up to {goal} %" with 3 as the default.
- **D6:** budget 318.7 of 320 KB gzip: Stand view, the Tools sheet and the wizard are lazy (12 §2); report before/after bytes.
- **D5:** V11 (64 px on phones, mockup 44–52) and V15 (reading sizes) are binding corrections.
- Frozen decision 5: ↑/↓ never change speed; after the wizard they act only if it bound them.

## Deliverables
1. **Layout selection:** coarse pointer with shortest side > 640 → Stand view by default, with ⋯ → "All tools" switching to the full layout (inspector in a drawer) and back (remembered per device); desktop can choose Stand view from ⋯; phones portrait → glance, landscape → the strip.
2. **Stand view** (`Stand.dc.html`, 27 §3.7.2): header 64 (back, title 18, loop badge, "Pedal connected" badge when set up, speed readout 28, Display), Now panel 400 (chord one preset larger: 200 at Music stand, shape, beats 26, next 100), one tab system that always fits at the resolved preset (36 / 40 at Music stand), "Page 7 of 46 · turns on the downbeat of bar 28", dock 120 with four 88 px buttons (Restart loop / "Left pedal", **Pause** / "Right pedal", Felt clean / "Hold right pedal", Not yet / "Hold left pedal"; hints follow the learned mapping). Page turns: on the downbeat from the audio clock, never mid-system, a pedal turn wins; portrait stacks two systems and turns half a page; landscape shows a slice of the next bar; reduced motion turns instantly.
3. **Phone glance** (`Phone-Practice.dc.html`): header 56, overview map 30 + Glance · Tab · Chords switch, Now at the Floor sizes with the glance clamps (chord 150 at 390, next `clamp(56px, 16.5cqi, var(--read-chord-next))`, Then chips at `--read-chord`, as many whole chips as fit), pass prompt card with two 64 px buttons, transport (loop button 64, speed −/+ 64, Restart 64, Play 72, Next bar 64, Tools 52).
4. **Phone landscape and the phone fit rule** (26 §6.3): digit size `min(--read-tab, fit)` never below 18 px, chord and bar-number clamps, scroll by bar only when the next bar would leave the view, snap to the bar start (jump under reduced motion), no scroll while paused; the E2E test at 844 × 390, 667 × 375 (landscape) and 390 × 844 (portrait Tab view) with every assertion the rule lists.
5. **Tools sheet** (`Phone-Tools.dc.html`, lazy): grabber, "Tools" + Close 44; Speed (−/+ 64, mono 30 readout, preset chips 50 · 75 · 85 · 100, the ladder card with its switch); tiles Count-in 1 bar · Click on · Vibrate on beat (76 tall, pressed = amber wash, state in the name); Mix (s40b's mini-mixer, "All {n} stems" opening the Mix tab as a sheet); Level / Capo (48). Every control steps; nothing needs a drag; focus never hidden by the sheet.
6. **Pedal wizard** (`Settings-Pedal.dc.html`, 12 §8, lazy): "Pedal setup · step n of 3"; capture left, then right (whatever key the device sends: ↑/↓, PageUp/PageDown, Space/Enter…; "Left pedal: got it. It sends ↑, which most pedals send out of the box, so we won't use it for speed."), captured-key badges, Start over, "I only have one pedal"; step 3 presets Restart loop · Play/pause (recommended), Not yet · Felt clean, Back a bar · Next bar, with the hold rule (≥ 0.5 s = second action, so two pedals cover four); conflicting defaults unassigned automatically; finish in the test area ("Last: PageDown → Next bar"). Saved per device. PedalHud "Pedal detected? Set it up" opens it. The "Learn key" table stays for advanced use.
7. **Copy:** `stand.*`, `tools.*`, `pedal.*` and the s43 `shortcuts.*` rows of 27 §5.7 (`shortcuts.restart`, `shortcuts.learn`, `shortcuts.settings_intro`, `shortcuts.test_hint`, `shortcuts.test_last`).
8. **Stories:** Stand view (landscape, portrait, page turn, pedal connected, reduced motion), glance (Floor, long chord names, 5 Then chips, narrow), landscape strip at each test size, Tools sheet (each control, ladder on, vibrate on), wizard (each step, one pedal, conflict resolved, test area); both themes; coarse pointer; `play` probes for 64 / 72 / 88 targets.
9. **Visual baselines:** regenerate the phone and tablet practice rows (pending the OK) and list the intended differences.

## Out of scope
Native apps, Web MIDI pedals (optional where available, no requirement), new practice features, the desktop layout (s35).

## Acceptance criteria
- Fidelity: `Stand` at 1180 × 820 (`--touch`, Music stand), `Phone-Practice` and `Phone-Tools` at 390 × 844 (`--touch`), `Settings-Pedal` at 1440 and 1180, both themes; remaining differences in tolerance or 26 §4.9 (V11, V15); at most 6 iterations without improvement.
- The phone-fit E2E passes at all three sizes; targets: main controls 64 (Play 72) on phones, Stand dock 88 tall, Tools tiles and M buttons 48, nothing under 44 (28 §3).
- Page turns: unit or E2E test that a turn happens on a downbeat and never mid-system; pausing stops any scroll (2.2.2).
- Wizard: a scripted key sequence sets up a pair in < 30 s; holds trigger the second action at ≥ 0.5 s; ↑/↓ act only when bound; single keys off leaves learned pedal keys working.
- Focus not obscured with the Tools sheet and the Stand dock (28 §3 focus spec); stories for every state in both themes; axe clean in Chromium and WebKit.
- Budget before/after reported; all three new surfaces lazy; `budget --enforce` green; perf spec on the tablet layout shows no regression vs the s32 baseline.
- G4 and G5 owner actions written with exact steps (devices, pedal modes, the 15-minute wake-lock check).

### Commands (prefix each with `cd "<worktree>" &&`)
```bash
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget                  # before, then after
pnpm exec biome check . && node scripts/check-db-access.mjs && node scripts/check-ui-tokens.mjs
pnpm --filter @splitune/web typecheck && pnpm --filter @splitune/web test
pnpm --filter @splitune/web test:stories                                                  # heavy lock
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget --enforce && pnpm --filter @splitune/web css-floor
node scripts/redesign/render-mockups.mjs --file Stand --file Phone-Practice --file Phone-Tools --file Settings-Pedal
node scripts/redesign/probe.mjs Stand --look night --touch --select '<anchor>'
node scripts/redesign/probe.mjs 'http://localhost:6006/iframe.html?id=<story>&viewMode=story&globals=distance:floor' --look night --width 390 --height 844 --touch --select '#storybook-root <anchor>'
cd apps/web && UV_PROJECT_ENVIRONMENT=<shared ML venv from your brief> UV_NO_SYNC=1 pnpm exec playwright test e2e/phone-fit.spec.ts      # heavy lock
cd apps/web && E2E_SMOKE=1 UV_PROJECT_ENVIRONMENT=<shared ML venv from your brief> UV_NO_SYNC=1 pnpm exec playwright test                # heavy lock
pnpm --filter @splitune/web e2e:visual:update -g "practice @ phone|practice @ tablet|practice-tab-pending @|practice-stems-expired @"         # heavy lock, Docker
```
Known pre-existing failures: WebKit practice/audio stories timing out at 15 s; first `test:stories` run failing in Vite optimisation (rerun once).

## Stop points (stop, report with 2–3 options and a recommendation, wait)
1. 27 §3.7.2, 12 §8, 26 §6.3 and the mockups disagree (for example a Stand view size under the §6.3 floors).
2. The budget would exceed 320 KB with every new surface lazy.
3. A file outside the owned globs and the OK'd extras (the desktop regions, `features/shell`, other settings sections).
4. The phone fit rule can't be met at 18 px on a test size (the rule says the box scrolls instead: if that breaks another rule, stop).
5. Any layout choice that would need user-agent sniffing.

## Git
- Branch `impl/s43-phone-tablet`; subject-only Conventional Commits (for example `feat(practice): open tablets in stand view so the music reads from the stand and pedals drive the dock`); stage exact paths; gitleaks before each commit.
- Never push, merge, rebase onto `dev` or open a PR. No edits to `docs/status.md`, `docs/progress-log.md`, `docs/steps/README.md`; progress-log entry in your report.
