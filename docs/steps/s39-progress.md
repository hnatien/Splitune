# Step s39 — Progress: the Progress tab and the library strips from `GET /v1/progress`

Redesign step of the "Night Rehearsal" plan (`redesign/report.md`), fourth in the practice lane (s35 → s37 → s38 → **s39** → s40b → s41b → s42 → s43). Read `docs/steps/00-shared-context.md` first, including its "Redesign steps" section (frozen decisions, decisions D1–D21, environment, known failures, owner gates); this prompt holds what is specific to s39.

| | |
|---|---|
| Branch | `impl/s39-progress` from the current `dev` |
| Hard deps | s38, s34 |
| Gates | G4 (batched; places "Warm up with yesterday's hard bars", which has no mockup) |
| Owned globs | practice progress files, `apps/web/app/features/library/**` progress parts, `packages/contracts/src/api/practice.ts` if needed |
| Concretely | the Progress tab files s35 created and new progress files under `features/practice/` (chart, stat cards, sessions, metric helpers); in `features/library/`: the Continue card's sparkline and badges, This week, Worth a revisit and their queries and stories (`library-page.tsx` only where those strips mount); `en.json` keys in `progress.*` (a new group at its alphabetical position) and the progress rows of `library.*` (`library.this_week`, `library.week_label`, `library.revisit`, `library.revisit_hint`); the hot practice files |
| Ask the owner first | If the contract needs session data (see Deliverable 1): `packages/db/src/repo/practice.ts` (the `progress` query, line ~116) and `apps/api/src/routes/practice.ts` (line ~33) with their tests; new `apps/web/app/ui/` files `progress-chart.tsx`, `stat-card.tsx`, `sparkline.tsx` (new visual primitives, 28 §1) and the s34 layout components (`continue-card.tsx`, `week-strip.tsx`, `revisit-list.tsx`) if s34 put them in `ui/` |
| Contracts | If you change `packages/contracts/src/api/practice.ts`, you are the contracts step: only one unmerged step at a time may: before you start, check `docs/status.md` and `git branch --list 'impl/s*'` that no other unmerged step changes them |
| Effort | high |

## Before you start
- `docs/steps/00-shared-context.md`, `CLAUDE.md`, `docs/specs/25-personal-mode.md`.
- `docs/specs/12-practice-screen-and-notation.md` §5 "Pass tracking" (every answer is a data point; the retention metric is the tempo of the first clean pass in the next session, not minutes), `docs/specs/16-observability-analytics-experiments.md` (success metrics), `docs/specs/21-v1-features.md` "Redesign scope that is not a V-feature" (Progress row).
- `docs/specs/27-screens-flows-and-content.md` **§3.7.4 Progress** (clip heading, Last 30 days chart with its text alternative, three stat cards, Sessions rows, Warm up chip, Weekly goal switch, no-clip state), **§3.5** (Continue card with sparkline and badges, This week, Worth a revisit, phone This week row; the "Before s39" rule ends here), §4 Practice inspector row (Progress empty), **§5.5** (motivation: no streaks, no missed days, seven day dots), §5.3 (dates, "1 h 20"), §5.7 library and `progress.*` rows.
- `docs/specs/26-design-system.md` §4.4 (`--chart-*`; progress charts use `--signal` solid for the main series and a dashed `--muted-foreground` comparison), §4.5 (This week day dots are amber), §12.2 `ProgressChart` / `StatCard` / `SessionList`, `ContinueCard` / `WeekStrip` / `RevisitList`.
- `docs/specs/28-ui-quality-and-design-review.md` §3, §5, §5.1; `redesign/research/practice_science_ergonomics.md` (why the cold first pass).
- Mockups: `Practice-Piano.dc.html` (Progress tab), `Library.dc.html`, `Phone-Library.dc.html`.

## What exists (verified at `0c3d5c3`)
- **Contract** `packages/contracts/src/api/practice.ts`: `ProgressInput { song_id? }` → `ProgressOutput { clips: [{ loop_clip_id, song_id, best_clean_tempo_pct, attempts: [{ at, tempo_pct, outcome }] }] }`. Attempts carry **no session id and no session times**; sessions (`client_session_id`, `started_at`, `ended_at`, `input_mode`) are stored by `POST /v1/practice/sync` in `practice_sessions` (`packages/db/src/schema/practice.ts` line 61) and attempts reference them (`practice_attempts.session_id`).
- **Route** `GET /v1/progress` (`packages/contracts/src/api/router.ts` lines 192–195; handler `apps/api/src/routes/practice.ts` line 33; query `packages/db/src/repo/practice.ts` line 116: every clip with its attempts in time order). **The web never calls it** (no `practice.progress` call in `apps/web/app`).
- **Library** (after s34): the Continue card shows the most recent song with its clip and best clean tempo from the songs list; This week and Worth a revisit exist as layout components with fixture stories only, hidden in the page.
- **Practice** (after s35): the Progress tab shows only its empty state.

## Goal
The Progress tab shows a clip's last 30 days (best clean pass per session and the cold first clean pass), its stats and sessions; the library's Continue card, This week and Worth a revisit show real data; and the first clean pass of the next session is recorded as the success metric, with no streaks, guilt or missed-day wording anywhere.

## Decisions that bind this step
- **D6:** budget 318.7 of 320 KB gzip; the Progress tab and its chart are lazy (28 §3 bundle row); report before/after bytes.
- 27 §5.5: no streak counters, leaderboards, badges, confetti, loss-framed notifications or red dots; missed days are never mentioned; goals are optional and weekly, off by default.

## Deliverables
1. **Data first:** decide whether "session" metrics (first clean pass of a session, minutes, passes per session, day dots by minutes) can be computed from `ProgressOutput` as it is. They can't without session boundaries and durations, so the expected path is an additive contract change: each attempt gains `client_session_id`, and the output gains the user's sessions (`client_session_id`, `song_id`, `started_at`, `ended_at`) for the window. Post the exact Zod diff to the owner before writing it (it needs the repo and route files above). Never derive sessions from time gaps silently; if the owner refuses the change, stop.
2. **Metrics** (pure, unit-tested): best clean pass per session; first clean pass per session ("cold"); the next-session retention value for a clip; day dots for the last 7 days by minutes (opacity ≥ 0.45 when practised, outlined otherwise); "+10 % on {clip}" this week; Worth a revisit = clips not played for ≥ 5 days with a best clean tempo, up to three; time zone and date-boundary tests.
3. **Progress tab** (`Practice-Piano.dc.html`, lazy): eyebrow "Clip" + clip name + bars line; Last 30 days card with the chart (solid `--signal` best clean pass, dashed `--muted-foreground` "First clean pass, cold: what really stuck") and a text alternative ("Best clean speed rose from 60 to 80 percent over 9 sessions"); stat cards in mono (cold start today, clean passes, minutes today); Sessions rows ("Today · 18 min · 14 passes · best 60 %"); the Warm up chip on the first session after a day away (no mockup: place it and list it for G4); the Weekly goal switch, stored per device unless 27 says otherwise (if it must be on the account, stop: that's a contract change); no-clip state: the song's clips with their best clean tempo; empty state as built.
4. **Library strips** (27 §3.5): Continue card with the 30-day sparkline, "Ladder at 75 % → 100 %" (if a ladder is on), "Best clean 80 %", "Yesterday's first clean pass: 70 %"; This week (seven dots, "Practised on 4 of the last 7 days", day letters, three mono stats); Worth a revisit rows; phone compact versions. All fetched through TanStack Query with offline cache behaviour as the library has.
5. **Success metric:** name it per doc 16 and record where it's computed; if an analytics event is needed, use the existing `packages/analytics` event list only if no contract change is needed (else list it as a follow-up).
6. **Copy:** `progress.*` and the `library.*` progress keys of 27 §5.7.
7. **Stories:** Progress tab with 1 session, 9 sessions, 30 days, no clean pass yet, no clip selected, Warm up chip, Weekly goal on; library with progress (the `screens-library--populated` story gains data: regenerate the `library` visual row and list the intended differences), phone library with This week; both themes, increased contrast.

## Out of scope
Changing how passes are recorded, streaks or reminders, notifications (s44), server-side aggregation beyond what the contract change needs.

## Acceptance criteria
- The contract change (if any) approved by the owner before it was written; `pnpm contracts:check` clean; API and repo tests cover the new fields and user scoping (RLS and `userId` helpers, `scripts/check-db-access.mjs` clean).
- Metric unit tests green, including date boundaries and empty data.
- Fidelity: Progress tab against `Practice-Piano` at 1440 and 1180; the strips against `Library` at 1440 and 1180 and `Phone-Library` at 390 (`--touch`); both themes; remaining differences in tolerance or 26 §4.9; at most 6 iterations without improvement.
- Chart has a text alternative; nothing is shown by colour alone (solid vs dashed series; filled vs outlined dots).
- Copy review: no streak, missed-day or guilt wording (grep the new keys).
- Stories for every state in both themes; axe clean in Chromium and WebKit; budget before/after reported, `budget --enforce` green.

- Your area passes s33's extended `check-ui-tokens` rules (28 §3: no arbitrary colour, radius, font-size or shadow values, no style-prop colour literals), run on your paths with `--path`, even though the default scope stays `apps/web/app/ui/**` until s45.
### Commands (prefix each with `cd "<worktree>" &&`)
```bash
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget                  # before, then after
pnpm exec biome check . && node scripts/check-db-access.mjs && node scripts/check-ui-tokens.mjs
node scripts/check-ui-tokens.mjs --path apps/web/app/features/practice --path apps/web/app/features/library   # s33's extended 28 §3 rules (arbitrary colour, radius, font-size, shadow, style-prop colours) on your area
pnpm --filter @splitune/contracts typecheck && pnpm --filter @splitune/contracts test
UV_PROJECT_ENVIRONMENT=<shared ML venv> UV_NO_SYNC=1 pnpm contracts:check
pnpm --filter @splitune/db test && pnpm --filter @splitune/api test                       # compose Postgres + SeaweedFS
pnpm --filter @splitune/api openapi:check
pnpm --filter @splitune/web typecheck && pnpm --filter @splitune/web test
pnpm --filter @splitune/web test:stories
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget --enforce && pnpm --filter @splitune/web css-floor
node scripts/redesign/probe.mjs Practice-Piano --look night --width 1440 --select '<progress anchors>'
pnpm --filter @splitune/web e2e:visual:update -g "library @"                              # Docker
```
Known pre-existing failures: db `lifecycle.test.ts` "claims a run once per due time, across callers"; api `pipeline.test.ts` ×2 (intermittent); WebKit practice/audio stories timing out at 15 s; first `test:stories` run failing in Vite optimisation (rerun once).

## Stop points (stop, report with 2–3 options and a recommendation, wait)
1. 27 §3.7.4/§3.5, the mockups and the data disagree (for example a stat the data can't give).
2. The budget would exceed 320 KB.
3. A file outside the owned globs and the OK'd extras; any migration.
4. A contract change the owner hasn't approved, or another unmerged contracts step.
5. A setting that would have to live on the account (Weekly goal) without a contract for it.
6. An existing e2e spec you don't own would break. One owner per existing spec file: `practice.spec.ts` → s35; `onboarding`, `account`, `billing`, `fallbacks`, `a11y` → s36; `journey` → s34; additive `helpers.ts` changes union-merge. A spec owned by an unmerged step becomes yours to change only after its owner has merged: then merge `dev` into your branch first and make the change. Until then don't edit it; record the exact edit you need (file, line, old → new, and the 27 §5.7 or 12 §8 reason) in your progress-log entry. New cases go into your own new spec files.

## Git
- Branch `impl/s39-progress`; subject-only Conventional Commits (for example `feat(practice): show the cold first clean pass so progress means what stuck, not minutes`); stage exact paths; gitleaks before each commit.
- Don't push, merge or open a PR unless the owner asks. Append your progress-log entry and update your row in `docs/status.md` (`00-shared-context.md`, "Git and progress").
