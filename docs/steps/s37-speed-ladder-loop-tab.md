# Step s37 — Speed ladder (V1) and the finished Loop tab

Redesign step of the "Night Rehearsal" plan (`redesign/orchestrator/prompt.md` §5), second in the strictly sequential practice lane (s35 → **s37** → s38 → s39 → s40b → s41b → s42 → s43). The orchestrator's worker brief (prompt.md §6) gives your worktree, setup, heavy-lock path, generic rules and the frozen decisions; this prompt holds what is specific to s37.

| | |
|---|---|
| Branch | `impl/s37-speed-ladder` from the current `impl/redesign` tip (not `dev`); the orchestrator merges it |
| Hard deps | s35 (plan table); orchestrator decision: also **s36 merged** before you start (you add a row to its Display & practice section) |
| Gates | G4 (practice-lane review, batched) |
| Owned globs (plan table) | practice loop files, `packages/contracts/src/api/{loops,flags}.ts`, `apps/api/src/routes/loops.ts`, `packages/db/src/repo/loops.ts` |
| "Practice loop files", concretely | `apps/web/app/features/practice/loop-panel.tsx`, `model/loops.ts` (+ test), `model/transport.ts` and `model/player-machine.ts` (+ tests) for ladder state and seam behaviour, the Loop tab and loop-pill files s35 created, new ladder files under `features/practice/`, the hot practice files (`practice-context.tsx`, `practice.stories.tsx`, `practice-story-data.ts`), and `en.json` keys in `ladder.*` (a new group at its alphabetical position) and the loop/clip keys in `practice.*` |
| Needs the orchestrator's OK first | `apps/web/app/ui/speed-control.tsx`, `speed-panel.tsx` (the "→ 100" goal readout) and a new `ui/speed-ladder.tsx` (+ stories); the Speed ladder default row in `apps/web/app/features/settings/display-settings.tsx` (s36's, merged before you start) and its stored default in `apps/web/app/lib/display-store.ts` (s35's, then assigned per file at dispatch to the practice-lane step in flight); `packages/audio-engine/**` only if the seam rule below can't be met from practice code |
| Contracts | This step changes `packages/contracts/**`: only one in-flight step at a time may (prompt.md §5 lanes). Check with the orchestrator before you start that s39, s40a and s44 aren't changing contracts at the same time |
| Effort | high |
| Runs in parallel with | s34 (if still in flight) and backend steps; not s36 (you wait for it to merge); never another practice-lane step |

## Before you start
- `docs/steps/00-shared-context.md`, `CLAUDE.md`, `docs/specs/25-personal-mode.md`.
- `docs/specs/21-v1-features.md` **V1** (model, engine, accept criteria and the "UI (redesign, s37)" paragraph), `docs/specs/12-practice-screen-and-notation.md` **§5** (ladder rules, the contract reinterpretation and its data check, saved clips, pass tracking), §6 (player machine: `LoopRest`, `Assess`, `CountIn`), §8 (keys), `docs/specs/11-audio-engine.md` (loop scheduling, rate changes).
- `docs/specs/27-screens-flows-and-content.md` **§3.7.4 Loop** (ladder card, chips, summary line, Between repeats, Saved clips with Rename and Delete), §3.7.1 (dock speed readout "72 BPM · → 100", loop badge "pass 2 of 3 at 75 %"), §3.9 Practice defaults (ladder row), §5.3 (speed as % first, goal as "→ 100"), §5.7 ladder and loop rows.
- `docs/specs/26-design-system.md` §12.2 `SpeedLadder`, `SpeedControl`, `ClipList`, §12.3 (rung cues), §4.9 V16, §8.
- `docs/specs/28-ui-quality-and-design-review.md` §3, §5, §5.1.
- Mockups: `Main.dc.html` (Loop tab with the ladder), `Settings-Display.dc.html` (Practice defaults), `Home.dc.html` and `SignIn.dc.html` show ladder stills (s36/s45's).

## What exists (verified on `impl/redesign` at `0c3d5c3`; s35 will have rebuilt the Loop tab around it)
- **Contract** `packages/contracts/src/api/loops.ts`: `SpeedTrainer = { start_pct 25–200, end_pct 25–200, step_pct 1–50, plays_per_step 1–20, count_in_each_pass }`, `LoopClip.trainer: SpeedTrainer.nullable()`, `best_clean_tempo_pct`, `CreateLoopInput` / `UpdateLoopInput` (name, bars, rest, count-in, trainer) / `DeleteLoopInput`. `SpeedTrainer` is not registered for JSON Schema, so Pydantic doesn't change; `packages/contracts/src/api/privacy.ts` line 102 reuses it in the data export.
- **Flag** `packages/contracts/src/api/flags.ts`: `'v1.speed_trainer': { default: false }`; flags reach the web as `me.flags` (`packages/contracts/src/api/me.ts` line 59), which no web code reads today.
- **API** `apps/api/src/routes/loops.ts`: `checkTrainer` rejects a non-null trainer with `feature_disabled` while the flag is off, so no clip can have been saved with one through the API; list / create / update (PATCH, including `name`) / delete exist. **Repo** `packages/db/src/repo/loops.ts` has `update` and `delete`. **DB** `loop_clips.trainer` is `jsonb` typed from the contract (`packages/db/src/schema/practice.ts` line 50): a contract change needs no migration.
- **Web:** nothing reads or writes `trainer`; clips have no rename or delete UI. `packages/audio-engine/src/engine.ts` has `setRate` and `setStopAt` (one-shot pause at a position), no scheduled rate change.

## Goal
A learner turns on the speed ladder for a loop, sees its rungs from start to goal, and Splitune steps the speed up after 3 clean passes (and back down after 2 misses), changing tempo exactly at the loop seam with the count-in at the upcoming tempo; the Loop tab is complete with saved clips that can be renamed and deleted; `v1.speed_trainer` is on.

## Decisions that bind this step
- **D3:** the speed ladder steps up after 3 clean passes by default (a setting).
- **D6:** budget 318.7 of 320 KB gzip; the ladder card and its chip steppers load lazily with the Loop tab; report before/after bytes.
- 12 §5: `plays_per_step` is reinterpreted as *clean passes per step* (same field, same 1–20 range) only after confirming no stored clip has a trainer; the contract gains `drop_after_misses` (0 = off, 1–5) and `on_goal` (`'keep' | 'stop'`). Defaults: Start = best clean tempo else 70 %, Goal 100 %, Step 5 %, 3 clean passes, back down after 2 misses, count-in before each pass on, at the goal keep looping. The ladder is an adjustable default, never presented as science.

## Deliverables
1. **Data check first:** run `SELECT count(*) FROM loop_clips WHERE trainer IS NOT NULL;` against the local compose database and report it; write the same query as an owner action for production. If any row exists anywhere you can see, stop (Stop point 5).
2. **Contract:** `SpeedTrainer` gains `drop_after_misses` and `on_goal`; the comment states that `plays_per_step` means clean passes per step. `v1.speed_trainer` default `true` after verification (and the description updated). API and repo follow; API tests cover create/update with the new fields, the range limits, and rename/delete ownership. `pnpm contracts:check` stays clean.
3. **Ladder logic** (practice model + machine): rung, clean count and miss count in machine context; on Felt clean at the current rung's nth clean pass → next rung; on the nth consecutive Not yet → one rung down (Off allowed); at the goal keep looping or stop; ladder state and position survive reload (saved on the clip). **Seam rule** (V1 accept): the tempo changes exactly at the loop seam and the count-in plays at the upcoming tempo; with a rest, count-in or "Ask how each pass went" the change happens while paused; for a seamless wrap, prove the change lands on the seam (offline audio test or engine-clock assertion). If that needs an engine change, ask for `packages/audio-engine/**` first.
4. **UI:** the Speed ladder card in the Loop tab (`Main.dc.html`): icon, title, switch; rungs (done = amber fill + 1 px `--signal` edge + graphite label, current = `--primary-soft` + 2 px inset `--signal`, upcoming `--accent`; rung labels 11 px, V10); summary line ("Up 5 % after 3 clean passes. Clean pass 2 of 3 at 75 % moves you to 80 %."); chips Start, Goal, Step, {n} clean passes, More (back down after n misses, count-in before each pass, at the goal), each opening a 48 px stepper; `aria-label` "70 and 75 percent done, 80 percent next". Dock speed readout "72 BPM · → 100"; loop pill and notation bracket "pass 2 of 3 at 75 %"; PedalHud on each step ("Speed 80 % · ladder"). Only shown when the flag is on.
5. **Saved clips** (27 §3.7.4): rows with the amber dot for the active clip, name, "bars 25–28 · best 80 %", More menu Rename (inline field, optimistic, Undo toast) and Delete (undoable toast, no confirm dialog, 26 §8 rule); "Save this loop" with a name field.
6. **Settings default** (pending the OK): Display & practice → Practice defaults "Speed ladder: +5 % after {n} clean passes · Up to 100 %, on for new loops" (default 3).
7. **Copy:** `ladder.*` keys and the clip/loop keys of 27 §3.7.4 and §5.7 ("s35–s43" rows that name the ladder).
8. **Stories:** ladder off, on at each rung, climbing (`LadderClimbing`), dropping back, at the goal (keep / stop), long values (Goal 110 %, Step 1 %), Daylight (V16 edge), increased contrast, reduced motion, rename in progress, delete with Undo, flag off (card absent).

## Out of scope
The Tools sheet ladder card (s43), Progress (s39), Fix (s38), any change to how passes are recorded (`/v1/practice/sync`), the home/pricing honesty-gate flip for the ladder (s45).

## Acceptance criteria
- Data check reported (local count, production query as owner action).
- Unit tests: rung transitions (up after n clean, down after m misses, Off, at goal keep/stop), Start from best clean tempo, persistence round-trip; offline/engine test that the rate change lands on the seam and the count-in uses the upcoming tempo.
- API tests green for the new fields and rename/delete; `pnpm contracts:check` clean; `pnpm db:check` clean (no migration expected).
- Fidelity: the Loop tab and ladder against `Main` at 1440 and 1180 in both themes (rung boxes, chip sizes, summary type); remaining differences in tolerance or 26 §4.9 (V16); at most 6 iterations without improvement.
- Targets: chips and steppers 48 (secondary practice); the speed −/+ stay 64.
- Stories for every state in both themes; axe clean in Chromium and WebKit.
- Budget before/after reported; `budget --enforce` green.
- E2E: loop at 70 % with the ladder on, three Felt clean passes step it to 75 % (keys only).
- Visual baselines: if your change shows in a story the visual matrix captures (the `practice`, `practice-tab-pending` and `practice-stems-expired` rows of `apps/web/e2e/visual/screens.spec.ts`), regenerate those rows with `pnpm --filter @splitune/web e2e:visual:update -g "practice"` (heavy lock, Docker) and list each intended difference; their PNGs are yours by the plan's rule for visual steps. Don't add rows (s45 owns the full matrix).

- Your area passes s33's extended `check-ui-tokens` rules (28 §3: no arbitrary colour, radius, font-size or shadow values, no style-prop colour literals), run on your paths with `--path`, even though the default scope stays `apps/web/app/ui/**` until s45.
### Commands (prefix each with `cd "<worktree>" &&`)
```bash
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget                  # before, then after
pnpm exec biome check . && node scripts/check-db-access.mjs && node scripts/check-ui-tokens.mjs
node scripts/check-ui-tokens.mjs --path apps/web/app/features/practice   # s33's extended 28 §3 rules (arbitrary colour, radius, font-size, shadow, style-prop colours) on your area
pnpm --filter @splitune/contracts typecheck && pnpm --filter @splitune/contracts test
UV_PROJECT_ENVIRONMENT=<shared ML venv from your brief> UV_NO_SYNC=1 pnpm contracts:check
pnpm --filter @splitune/api typecheck && pnpm --filter @splitune/api test                 # compose Postgres + SeaweedFS running
pnpm --filter @splitune/api openapi:check
pnpm --filter @splitune/db typecheck && pnpm --filter @splitune/db test && pnpm db:check
pnpm --filter @splitune/web typecheck && pnpm --filter @splitune/web test
pnpm --filter @splitune/web test:stories                                                  # heavy lock
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget --enforce && pnpm --filter @splitune/web css-floor
node scripts/redesign/probe.mjs Main --look night --width 1440 --select '<ladder anchors>'
cd apps/web && E2E_SMOKE=1 UV_PROJECT_ENVIRONMENT=<shared ML venv from your brief> UV_NO_SYNC=1 pnpm exec playwright test        # heavy lock
```
Known pre-existing failures: db `lifecycle.test.ts` "claims a run once per due time, across callers"; api `pipeline.test.ts` ×2 (intermittent); WebKit practice/audio stories timing out at 15 s; first `test:stories` run failing in Vite optimisation (rerun once).

## Stop points (stop, report with 2–3 options and a recommendation, wait)
1. 21 V1, 12 §5, 27 §3.7.4 and the mockup disagree (for example the rung count or the summary wording).
2. The budget would exceed 320 KB.
3. A file outside the owned globs and the OK'd extras (another contract, a migration, `packages/audio-engine`).
4. The seam rule can't be met without an engine change.
5. Any stored clip already has a trainer (the reinterpretation would change its meaning).
6. Another in-flight step is changing `packages/contracts/**`.
7. An existing e2e spec you don't own would break. One owner per existing spec file: `practice.spec.ts` → s35; `onboarding`, `account`, `billing`, `fallbacks`, `a11y` → s36; `journey` → s34; additive `helpers.ts` changes union-merge. A spec owned by an in-flight step becomes yours to change only after its owner has merged: then merge `impl/redesign` into your branch first and make the change. Until then don't edit it; record the exact edit you need (file, line, old → new, and the 27 §5.7 or 12 §8 reason) in your report. New cases go into your own new spec files.

## Git
- Branch `impl/s37-speed-ladder`; subject-only Conventional Commits (for example `feat(practice): add the speed ladder so loops climb after clean passes instead of by hand`); stage exact paths; gitleaks before each commit.
- Never push, merge, rebase onto `dev` or open a PR. No edits to `docs/status.md`, `docs/progress-log.md`, `docs/steps/README.md`; progress-log entry in your report.
- **Owner actions to list:** the production data check query; turning on `v1.speed_trainer` in production if a `feature_flags` row overrides the new default.
