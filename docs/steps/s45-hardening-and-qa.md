# Step s45 — Hardening and QA: WCAG 2.2 gates, perf gate, full visual matrix, Music Stand removal, docs

Redesign step of the "Night Rehearsal" plan (`redesign/orchestrator/prompt.md` §5), the last one. The orchestrator's worker brief (prompt.md §6) gives your worktree, setup, heavy-lock path, generic rules and the frozen decisions; this prompt holds what is specific to s45. It runs alone: nothing else is in flight.

| | |
|---|---|
| Branch | `impl/s45-hardening-qa` from the current `impl/redesign` tip (not `dev`); the orchestrator merges it |
| Hard deps | all above (s32–s44 merged, G3 passed for s40a and s41a) |
| Gates | **G4** (owner, screen-wave reviews on devices; the full visual baselines are regenerated only after it), **G5** (owner, human-only checks before the final merge), then **G6** (the final merge into `dev`, only on the owner's explicit "go") |
| Owned globs (plan table) | cross-cutting, assigned file by file at dispatch |
| Proposed assignment (the orchestrator confirms or edits it at dispatch; anything else needs its OK) | **Tokens:** `packages/ui-tokens/src/*` (delete the Music Stand roles and primitives doc 26 no longer lists, `--target-sm`, the paper surface; add the 28 §3 "Music Stand role still defined" check to `tokens.test.ts`). **Components:** `apps/web/app/ui/**` (remove variants and code paths that only served Music Stand, for example `data-score`). **Storybook:** `apps/web/.storybook/preview.tsx` (a11y `runOnly` tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`, 28 §2). **E2E:** `apps/web/e2e/a11y.spec.ts` and `e2e/helpers.ts` updates, new specs for keyboard-only journeys, focus not obscured, target sizes on every screen, reduced motion, feedback timing, token membership and colour-vision screenshots; `apps/web/e2e/perf-practice.spec.ts` (gate assertions against the committed baseline, which never changes). **Visual:** `apps/web/e2e/visual/**` (the full 28 §4 matrix and every baseline). **Copy:** `apps/web/messages/en.json` and `apps/web/app/copy-keys.test.ts` for the 27 §3.1 honesty-gate flips (Home, Pricing, Add song's "a mixer for every stem") and retiring unused keys. **Lint:** `scripts/check-ui-tokens.mjs` (widen s33's extended 28 §3 rules from `apps/web/app/ui/**` to all of `apps/web/app` once every screen is restyled). **Fixtures:** `apps/web/app/features/story-fixtures.ts` if the matrix needs fixtures. **Brand:** `apps/web/public/icons/**`, `apps/web/public/favicon.svg`, `apps/web/scripts/render-icons.mjs` if s33 didn't do them. **Mounts left by earlier steps** (for example s44's Notify button). **Docs:** implementation-note sections in `docs/specs/{12,21,26,27,28}-*.md` (and 26 §6.1's font record after the owner's legibility check) |
| Effort | xhigh |
| Runs in parallel with | nothing |

## Before you start
- `docs/steps/00-shared-context.md`, `CLAUDE.md`, `docs/specs/25-personal-mode.md`.
- `docs/specs/28-ui-quality-and-design-review.md` in full: §2 (a11y config), **§3** (every automated check, including the ones that start in s45: token membership, every-screen target probe, Music Stand role check), **§3.1** (perf gate), **§4** (visual matrix), **§5** (design QA checklist on every screen), **§5.1** (fidelity procedure), §6 (G5 music-stand test and device checks), §7 (rubric).
- `docs/specs/26-design-system.md` §3 (Music Stand roles deleted in s45), §4.5, §4.9, §8, §10, §12.3; `docs/specs/27-screens-flows-and-content.md` §3.1 honesty gates, §4, §5.6–§5.7; `docs/specs/12-practice-screen-and-notation.md` §9–§10.
- **`redesign/report.md` "Acceptance criteria"** (the table below), "Research and testing gates", "Risks".
- Every step report in the run folder (`<run>/reports/s32.md` … `s44.md`) and their review files: open items, G4 placements, deferred mounts, "Notes for docs".
- `scripts/redesign/README.md`.

## What exists (to verify at dispatch; on `impl/redesign` after s44)
- Each screen step regenerated only its own visual rows; rows for new screens (Add song dialog, Stand view, Tools sheet, Fix mode, Getting ready, command palette, Sign in, Pricing, system states) don't exist yet in `apps/web/e2e/visual/screens.spec.ts`.
- `apps/web/e2e/perf-practice.spec.ts` records measurements and `apps/web/e2e/perf-baseline.json` holds the s32 baseline of the pre-redesign screen (verify both paths; s32's report names them).
- Music Stand roles still defined in `packages/ui-tokens` (doc 26 §3 allowed them until now); `--target-sm` retired but present.
- Today (`0c3d5c3`) `apps/web/e2e/a11y.spec.ts` uses `@axe-core/playwright`; the Storybook a11y config is in `apps/web/.storybook/preview.tsx`.

## Goal
Every acceptance criterion of the redesign is met and shown: automated ones by gates that run in the repo's test commands, human ones written into the owner's queue with exact steps; no Music Stand token, variant or screen is left; the full visual matrix is the new baseline; the docs describe what was built.

## Decisions that bind this step
- D1 (phone QA against `Phone-*`, tablet against `Stand`), D5 (corrections accepted; minimums never lowered), D6 (budget 320 KB gzip; raising it needs the owner), D7 (token literal changes are listed, floors never go down).
- Never edit a baseline or the perf baseline to pass; the only regenerated expectations are the visual baselines after G4, each with its intended difference listed.

## Deliverables
1. **Acceptance table** (`redesign/report.md`, with how each is checked):

| Criterion | Threshold | Check | Where |
|---|---|---|---|
| Colour never the only signal (1.4.1), non-text contrast (1.4.11) | Confidence, loop, clean / not yet, Rough, downbeat have a shape or text; ≥ 3:1 | `contrast.test.ts`, `palette.test.ts`; colour-vision screenshots (Chromium `Emulation.setEmulatedVisionDeficiency`) of every screen for review | Automated + human review (G4) |
| Text contrast (1.4.3) | ≥ 4.5:1 in Night, Daylight and increased contrast, incl. tab digits and notation strokes | Token tests; axe in stories and E2E | Automated |
| Single-character shortcuts (2.1.4) | Can be turned off; then inert | E2E | Automated |
| Pause, stop, hide (2.2.2) | Pausing stops scrolling | E2E (Scroll follow mode, Stand view, phone strip) | Automated |
| Flashing (2.3.1) | ≤ 3 per second at any tempo; small area | s42's schedule unit test; visual check | Automated + human (G4) |
| Focus not obscured (2.4.11) | Dock, Tools sheet, drawers, pass prompt never fully cover focus | Keyboard E2E with each open (`elementFromPoint` at several points) | Automated |
| Dragging (2.5.7) | Loop handles, faders, tempo, dividers have steps or a field | E2E without drag | Automated |
| Target size | ≥ 24 AA; 44 internal; 64 main practice controls in every layout; 48 secondary; 88 Stand view | Border-box probe on every screen and layout | Automated |
| Reduced motion | Page turns, stepped playhead, no fades, static beat readout | Stories + E2E with `reducedMotion: 'reduce'` | Automated |
| Feedback | Every key and pedal confirmed ≤ 100 ms | E2E timing | Automated |
| Play-along latency | Tap-along exists; range covers Bluetooth (−150…+500 ms); offset ≤ 25 ms after calibration | Unit tests (range, estimate) | Automated (range) + **G5** (by ear, wired and Bluetooth) |
| Loop efficiency | Loop in ≤ 2 actions, < 3 s; app open to first audible pass < 10 s | E2E counts actions and times both on the dev stack | Automated (proxy) + human task round (28 §6, G4/G5) |
| Pedals | A pair in < 30 s with AirTurn modes 2, 3, 5 and the three iRig modes, on iPadOS Safari, Android Chrome and desktop | Scripted key-sequence E2E per mode's keys | Automated (keys) + **G5** (hardware matrix) |
| Wake lock | Screen doesn't dim for 15 min in a tab and the installed PWA | — | **G5** |
| Perf (28 §3.1) | No LoAF from playhead, song-map or roll code; no forced layout from app scripts in steady playback; p75 action latency ≤ 100 ms; ≤ 10 % worse than the s32 baseline | `perf-practice.spec.ts` gate vs `perf-baseline.json` | Automated |
| Bundle | Practice route ≤ 320 KB gzip | `budget --enforce` | Automated |
| Music-stand reading test, rubric (28 §6, §7) | Decision rule for the Practice default theme; ≥ 2 on every rubric item | — | **G5** / G4 |

2. **Gates in code:** the a11y `runOnly` tags in Storybook and E2E; new E2E specs for keyboard-only journeys (sign in → library → Add song → practice loop → Felt clean; settings; Fix), focus not obscured, target sizes on every screen and layout (desktop, tablet Stand and full, phone glance and landscape, Fix mode), reduced motion, feedback timing, token membership (computed colours are resolved tokens of the active context, 28 §3); the perf spec asserts the §3.1 gate against the committed baseline.
3. **Design QA** (28 §5, §5.1) on every screen at the §5.1 widths in both themes (and increased contrast for Practice Tab): a fidelity report per board with mismatch counts and every remaining difference in tolerance or 26 §4.9, the checklist pass/fail per screen for the rows an agent can check (the human-only rows — readable from 0.75 m / 1.5 m without leaning in, hit reliably with a knuckle while holding a pick in 10 tries with ≥ 9 hits — go to G4/G5 in Deliverable 8, never self-assessed), and a rubric draft for G4 (screenshots to `<run>/reports/s45/`).
4. **Music Stand removal:** delete the old roles and primitives, `--target-sm`, the score-surface code paths and any variant only Music Stand used; the token test proves none is defined; `DisplaySettings.score_surface` keeps reporting `match` (contract unchanged, 26 §2).
5. **Honesty gates and copy** (27 §3.1): flip every claim whose step shipped (s37 ladder, s40b "Every stem has its own fader." and Add song's "a mixer for every stem", s42 beat lights, s43 Stand view); retire keys no code uses; copy-keys test green.
6. **Full visual matrix** (28 §4): every row of the matrix (Home, Library with progress, Add song with a file, Settings → Display & practice at 390 / 1180 / 1440 in both themes; Practice Tab with loop and ladder, Chords + Mix, Fix mode, Getting ready at 1180 / 1440; phone glance and Tools sheet at 390; Stand view at 1180 touch; Practice Tab increased contrast; system states, Sign in, Pricing), Chromium and WebKit, regenerated **after G4** with every diff image shown and the intended differences listed.
7. **Docs:** implementation notes (redesign) in docs 12, 21, 26, 27 and 28 from the step reports (what was built, where it deviated and why); 26 §6.1 records the font outcome once the owner's legibility check is in; nothing in `docs/status.md`, `docs/progress-log.md` or `docs/steps/README.md` (the orchestrator's).
8. **Human queue:** G4 and G5 items with exact steps, expected results, branch and SHA (for `human-queue.md` via your report): the device review of every screen in both themes at desk and stand distance; the music-stand reading test (28 §6) and its decision rule; pedals (AirTurn 2/3/5, iRig BlueTurn) through the wizard; iPad Safari and the installed PWA (wake lock 15 min, Web Push); audio sync by ear with wired and Bluetooth headphones; the task round; the knuckle-with-a-pick target test (28 §5); **research items for the owner** that no step runs: calibration check C1 per stage (26 §5: which stages are calibrated; the owner decides on marks) and the PAIR trust probes for Fix (report Phase 3 exit gate).

## Out of scope
New features; changing any spec decision; raising the budget; editing `perf-baseline.json` or lowering any threshold; the final merge (G6, the orchestrator's on the owner's "go").

## Acceptance criteria
- Every "Automated" row above runs in the repo's commands and passes; every "G4"/"G5" row is in the human queue with exact steps.
- No Music Stand role, primitive or variant remains (token test); `check-ui-tokens` clean with the extended rules over all of `apps/web/app`; no `dark:` colour variants in `ui/`.
- Full visual matrix regenerated after G4 with the intended differences listed; `e2e:visual` green.
- Full gates on the branch tip: JS lint, every package typecheck and test, `test:stories`, build + budget + css-floor, the full E2E matrix (all projects), `contracts:check`, `db:check`; known failures named.

### Commands (prefix each with `cd "<worktree>" &&`)
```bash
pnpm exec biome check . && node scripts/check-db-access.mjs && node scripts/check-ui-tokens.mjs
pnpm typecheck && pnpm test                                     # turbo; ML tasks need a venv (see your brief) or run the JS packages one by one
UV_PROJECT_ENVIRONMENT=<shared ML venv from your brief> UV_NO_SYNC=1 pnpm contracts:check && pnpm db:check
pnpm --filter @splitune/web test:stories                        # heavy lock
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget --enforce && pnpm --filter @splitune/web css-floor
cd apps/web && UV_PROJECT_ENVIRONMENT=<shared ML venv from your brief> UV_NO_SYNC=1 pnpm exec playwright test                      # full matrix, heavy lock
cd apps/web && UV_PROJECT_ENVIRONMENT=<shared ML venv from your brief> UV_NO_SYNC=1 pnpm exec playwright test e2e/perf-practice.spec.ts --project chromium
node scripts/redesign/render-mockups.mjs && node scripts/redesign/probe.mjs <board> --look <night|daylight> --width <w> --select '<anchor>'
pnpm --filter @splitune/web e2e:visual:update                    # after G4 only; heavy lock, Docker
pnpm --filter @splitune/web e2e:visual
```
Known pre-existing failures: db `lifecycle.test.ts` "claims a run once per due time, across callers"; node-worker pg-dump (no `pg_dump` binary); ML `test_recovery.py` ×2, `test_beats_model::test_cpu_fallback_uses_the_small_model`, `test_stem_post` ×2; api `pipeline.test.ts` ×2 (intermittent); WebKit practice/audio stories timing out at 15 s; the first `test:stories` run in a fresh worktree failing in Vite optimisation (rerun once).

## Stop points (stop, report with 2–3 options and a recommendation, wait)
1. A criterion fails and the fix belongs to a screen or feature (a defect in another step's work): report it with the file and the evidence; the orchestrator decides who fixes it.
2. The perf gate or the budget fails.
3. A file outside the assignment the orchestrator confirmed.
4. Deleting a Music Stand role breaks a component that still reads it (that component's step missed it).
5. Any spec, mockup or test conflict.

## Git
- Branch `impl/s45-hardening-qa`; subject-only Conventional Commits, one logical change each (for example `test(web): gate every screen on 44 px targets so no control regresses below the internal rule`, `refactor(ui-tokens): delete the music stand roles now that nothing reads them`); stage exact paths; gitleaks before each commit; baselines committed with the change they show.
- Never push, merge, rebase onto `dev` or open a PR. Progress-log entry in your report.
