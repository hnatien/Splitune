# Step s44 — "Notify me when it's ready": Web Push end to end

Redesign step of the "Night Rehearsal" plan (`redesign/orchestrator/prompt.md` §5), backend lane. The orchestrator's worker brief (prompt.md §6) gives your worktree, setup, heavy-lock path, generic rules and the frozen decisions; this prompt holds what is specific to s44.

| | |
|---|---|
| Branch | `impl/s44-notify` from the current `impl/redesign` tip (not `dev`); the orchestrator merges it |
| Hard deps | s34, G1 |
| Gates | **G5** (owner, before the final merge): Web Push on iPad Safari as an installed PWA and on desktop Chrome/Firefox. The real VAPID keys are an owner action (below), never committed |
| Owned globs (plan table) | `apps/web/app/sw.ts`, `apps/web/app/lib/pwa.ts`, `packages/contracts/src/api/notifications.ts` + router, `apps/api/src/routes/**` (new file), `packages/db/src/schema/**` + migration, `apps/node-worker/**`, `.env.example` |
| Concretely | `apps/web/app/sw.ts` (`push`, `notificationclick`), `apps/web/app/lib/pwa.ts` (subscribe/unsubscribe, permission on click, app badge and title helpers), `packages/contracts/src/api/notifications.ts` (new) and `packages/contracts/src/api/router.ts` (the `notifications` procedures only), **one new file** `apps/api/src/routes/notifications.ts` (never `routes/loops.ts` or another existing route: s37 owns `loops.ts`), a new `packages/db/src/schema/notifications.ts` + its export in `schema/index.ts`, migration `packages/db/migrations/0016_*.sql` with its Drizzle `meta` snapshot, the sender in `apps/node-worker/src/` (+ tests), `.env.example` placeholders |
| Needs the orchestrator's OK first | `apps/api/src/router.ts` (mount the route), `apps/api/src/config.ts` (read the VAPID public key and subject), `packages/db/src/repo/notifications.ts` + `repo/index.ts` (user-scoped queries must go through repo helpers, `scripts/check-db-access.mjs`), `apps/node-worker/package.json` and `pnpm-lock.yaml` if you add a Web Push library (justify it against implementing VAPID + `aes128gcm` with `node:crypto`), `apps/web/messages/en.json` keys `analysis.notify` and the notification text, `apps/web/app/copy-keys.test.ts` (the `analysis.notify` entry, new in 27 §5.6), a new `apps/web/app/ui/notify-button.tsx` (+ stories, lazy), and the two mount points (the practice Getting ready card and the library processing card): mount them only if no in-flight step owns those files, otherwise leave a one-line mount for s45 and say so |
| Contracts and DB | You change contracts and add a migration: only one in-flight step at a time may (prompt.md §5). Confirm with the orchestrator that s37, s39 and s40a aren't changing contracts, schema or migrations at the same time. The next migration number is **0016** (the last is `0015_username_sign_in.sql`) |
| Effort | high |
| Runs in parallel with | the practice lane (never touching `features/practice/**` without the OK), s36; **never with s41a** (both write `apps/node-worker/**`; s41a's fallback may change `finalize.ts`) |

## Before you start
- `docs/steps/00-shared-context.md`, `CLAUDE.md`, **`docs/specs/25-personal-mode.md`** (no new paid service; Railway variables are the owner's), `docs/specs/24-browser-compatibility.md` (feature-detect; iOS Web Push needs an installed PWA, iOS 16.4+), `docs/specs/10-web-app-architecture.md` §6 (service worker), `docs/specs/03-data-model-and-storage.md` (tables, RLS, roles, deletion cascade), `docs/specs/04-api-contract.md`, `docs/specs/15-privacy-dmca-and-data-lifecycle.md` (data export and account deletion must cover subscriptions), `docs/specs/17-security.md` (secrets).
- `docs/specs/27-screens-flows-and-content.md` §2 "Get notified" (permission on that click only; no Web Push → button hidden; toasts and title updates remain), §3.7.3 (the Getting ready card's secondary button), §5.5 ("Notifications only when asked, and neutral: "Paper Boats is ready to practise.""), §5.6 `analysis.notify`.
- `docs/specs/26-design-system.md` §12.2 `NotifyButton` (secondary, bell icon, only where `PushManager` and `Notification` exist, lazy), §13 (background completion: toast, tab title, app badge; push only if asked).
- `docs/specs/21-v1-features.md` "Redesign scope that is not a V-feature" (Notify row); `redesign/report.md` Risks row "Web Push on iOS only works with an installed PWA".
- Code: `apps/web/app/sw.ts`, `lib/pwa.ts`, `apps/api/src/{router,config,procedures}.ts`, an existing route and repo pair (for example `routes/loops.ts` + `packages/db/src/repo/loops.ts`), `packages/db/migrations/0011_billing_grants_and_refunds.sql` (grant pattern), `apps/node-worker/src/{execute,finalize,worker}.ts` (where an analysis finishes).

## What exists (verified on `impl/redesign` at `0c3d5c3`)
- **Web Push doesn't exist anywhere:** no `push` or `notificationclick` handler in `apps/web/app/sw.ts` (Serwist: precache, network-first pages and API, a waiting update), no `PushManager` use, no subscription contract, route, table or sender, no VAPID entry in `.env.example`.
- `lib/pwa.ts` (74 lines) registers the service worker and asks it to cache pages; no app badge (`setAppBadge`) or tab-title updates exist anywhere in the web app.
- API routes are composed in `apps/api/src/router.ts`; contracts in `packages/contracts/src/api/router.ts`. Migrations `0000`–`0015` in `packages/db/migrations/`, grants written in migrations (for example `GRANT … ON billing_events TO app` / `maintenance`).
- The node worker marks finalize jobs done in `apps/node-worker/src/execute.ts`; `finalize.ts` computes `done` / `partial`.

## Goal
On a device with Web Push, a learner presses "Notify me when it's ready" on a song that is analysing, grants permission at that moment only, and gets one neutral notification ("{title} is ready to practise.") when its analysis finishes, which opens the song; where Web Push isn't available the button never shows and the in-app toast, tab title and app badge carry the news.

## Decisions that bind this step
- Permission is requested **only** in the button's click handler, never on load, never by a timer.
- Secrets: the VAPID private key lives only in the local `.env`, `.env.worker` and production variables; `.env.example` holds obvious placeholders; nothing logs a key or a subscription endpoint (endpoints are capability URLs).
- **D6:** budget 318.7 of 320 KB gzip: the button is lazy and outside the practice route; report before/after bytes.
- 27 §5.5: no other notifications (no reminders, no streaks).

## Deliverables
1. **Contract** `notifications.ts`: subscribe (endpoint, keys `p256dh`/`auth`, the song or analysis to watch), unsubscribe, the VAPID public key read; additive router entries; tests.
2. **DB:** a `push_subscriptions` table (user-scoped, endpoint unique, keys, created/last-used, an optional per-analysis watch row or a separate `push_watches` table), RLS and grants for the app role and the node worker's role, migration `0016_*` generated with `pnpm --filter @splitune/db generate` and checked by `pnpm db:check`; deleted with the account (deletion cascade) and included in the data export if doc 15 requires it (say which, and stop if the export contract must change).
3. **API route** `routes/notifications.ts`: subscribe/unsubscribe/watch for the signed-in user only, through repo helpers; rate-limited like other writes; tests.
4. **Sender** (node worker): on an analysis reaching `done` (or `partial`, worded the same), send one push per watching subscription with a small payload (song id and title only), VAPID-signed, `aes128gcm`; delete subscriptions on 404/410; never retry forever; tests with a fake push service.
5. **Service worker:** `push` shows the notification ("{title} is ready to practise.", the app icon, tag per song so repeats replace), `notificationclick` focuses an open tab or opens `/songs/{id}/practice`; the text comes from the message catalogue (a Paraglide message bundled into the SW, or passed from the page at subscribe time; never a hard-coded string in a screen).
6. **Web:** `NotifyButton` (lazy, secondary, bell icon) shown only where `PushManager` and `Notification` exist and permission isn't `denied`; states idle, asking, on ("We'll let you know"), denied (explains how to allow it in site settings), unsupported (hidden); `lib/pwa.ts` subscribe/unsubscribe; app badge and tab-title helpers for the in-app path. Mount points per the OK above.
7. **`.env.example`:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` with placeholders and a comment naming the generate command.
8. **Stories:** button idle, asking, on, denied, hidden; both themes.

## Out of scope
Any other notification, email, native push, reminders; generating or committing real keys; Railway or Cloudflare changes.

## Acceptance criteria
- Contract, API, repo, DB and node-worker tests green; `pnpm contracts:check` and `pnpm db:check` clean; `check-db-access` clean.
- Permission is requested only from the click (unit test that nothing else calls `Notification.requestPermission` / `pushManager.subscribe`; E2E in Chromium with permission granted via the context).
- E2E in Chromium: subscribe, finish an analysis with the mock workers, receive the push in the SW (through a local fake push endpoint), click opens the song.
- No secret or endpoint in logs (grep the new code paths); gitleaks clean on the staged diff.
- Stories in both themes; axe clean in Chromium and WebKit; budget before/after reported, `budget --enforce` green.
- Owner actions written with exact steps (below).

- Your area passes s33's extended `check-ui-tokens` rules (28 §3: no arbitrary colour, radius, font-size or shadow values, no style-prop colour literals), run on your paths with `--path`, even though the default scope stays `apps/web/app/ui/**` until s45.
### Commands (prefix each with `cd "<worktree>" &&`)
```bash
pnpm exec biome check . && node scripts/check-db-access.mjs && node scripts/check-ui-tokens.mjs
node scripts/check-ui-tokens.mjs --path apps/web/app/lib   # s33's extended 28 §3 rules (arbitrary colour, radius, font-size, shadow, style-prop colours) on your area
pnpm --filter @splitune/contracts typecheck && pnpm --filter @splitune/contracts test
UV_PROJECT_ENVIRONMENT=<shared ML venv from your brief> UV_NO_SYNC=1 pnpm contracts:check
pnpm --filter @splitune/db generate && pnpm db:check && pnpm --filter @splitune/db test      # compose Postgres + SeaweedFS
pnpm --filter @splitune/api typecheck && pnpm --filter @splitune/api test
pnpm --filter @splitune/api openapi:check
pnpm --filter @splitune/node-worker typecheck && pnpm --filter @splitune/node-worker test
pnpm --filter @splitune/web typecheck && pnpm --filter @splitune/web test
pnpm --filter @splitune/web test:stories                                                    # heavy lock
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget --enforce && pnpm --filter @splitune/web css-floor
cd apps/web && UV_PROJECT_ENVIRONMENT=<shared ML venv from your brief> UV_NO_SYNC=1 pnpm exec playwright test e2e/<your push spec> --project chromium   # heavy lock
```
Known pre-existing failures: db `lifecycle.test.ts` "claims a run once per due time, across callers"; node-worker pg-dump (no `pg_dump` binary); api `pipeline.test.ts` ×2 (intermittent); WebKit practice/audio stories timing out at 15 s.

## Stop points (stop, report with 2–3 options and a recommendation, wait)
1. A conflict between 27, 26 and the platform (for example iOS behaviour the specs don't cover).
2. Another in-flight step is changing contracts, schema or migrations, or the next free migration number isn't 0016.
3. A file outside the concrete list and the OK'd extras (an existing API route, `features/practice/**` while the practice lane holds it, `features/library/**` while s39 holds it).
4. The data export or account deletion contract would have to change.
5. Any path that would request permission without a click, or put a key or endpoint in a log.
6. An existing e2e spec you don't own would break. One owner per existing spec file: `practice.spec.ts` → s35; `onboarding`, `account`, `billing`, `fallbacks`, `a11y` → s36; `journey` → s34; additive `helpers.ts` changes union-merge. A spec owned by an in-flight step becomes yours to change only after its owner has merged: then merge `impl/redesign` into your branch first and make the change. Until then don't edit it; record the exact edit you need (file, line, old → new, and the 27 §5.7 or 12 §8 reason) in your report. New cases go into your own new spec files.

## Git
- Branch `impl/s44-notify`; subject-only Conventional Commits (for example `feat(notifications): send one web push when an analysis finishes so learners can leave while it works`); stage exact paths (never `.env`); gitleaks before each commit.
- Never push, merge, rebase onto `dev` or open a PR. No edits to `docs/status.md`, `docs/progress-log.md`, `docs/steps/README.md`; progress-log entry in your report.
- **Owner actions to list:** generate a VAPID key pair (for example `npx web-push generate-vapid-keys`, or the command your sender documents) into the local `.env` and the Mac's `.env.worker`; add the same three variables to the Railway `app` service (an existing service: no new resource); never commit them; apply migration 0016 in production with `pnpm db:migrate`; G5 checks on iPad Safari (installed PWA) and desktop.
