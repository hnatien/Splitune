# Step 03 — Database schema, migrations, RLS and storage adapter

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/specs/03-data-model-and-storage.md` (primary spec, incl. `jobs` and `job_events`)
- `docs/specs/17-security.md` §2 (authorization, RLS)
- `docs/specs/25-personal-mode.md` §1, §5 (Railway Bucket vs local SeaweedFS, worker DB roles, cache scope)
- `docs/specs/23-plans-free-and-paid.md` §6 (`usage_ledger` kinds)

Prerequisites: Steps 01–02.

## Goal
A typed persistence layer the API and both workers can use safely: Drizzle schema + migrations for every table in doc 03, Postgres roles and RLS, repository helpers that force user scoping, and an S3 storage adapter that works against SeaweedFS locally and a Railway Bucket in production.

## Deliverables
1. `packages/db` (new package; add it to doc 02's layout): Drizzle schema for all tables in doc 03 (users-related columns that Better Auth doesn't own, songs, uploads, analyses, stage_runs, artefacts, correction_ops, loop_clips, practice_sessions, practice_attempts, youtube_refs, sync_points, subscriptions, usage_ledger, jobs, job_events, analytics_events, feature_flags, worker_heartbeats, audit_log; DMCA tables may be created but stay unused). `drizzle-kit` config and the first migration. Leave Better Auth's own tables to step 04 but reserve the `users.id` type it uses (text).
2. **Roles & RLS migration:** roles `app` (RLS enforced), `ml_worker` and `node_worker` (grants limited to jobs, job_events, stage_runs, artefacts, analyses status columns, worker_heartbeats, songs status), and a `maintenance` role for sweepers. RLS policies on user tables using `current_setting('app.user_id', true)`. A helper `withUser(userId, fn)` that opens a transaction and runs `SET LOCAL app.user_id`.
3. **Repositories** in `packages/db/src/repo/`: functions that all take `userId` first (songs, uploads, analyses, artefacts, corrections, loops, practice, usage). Add a Biome/lint rule or a custom script that fails if `db.select/insert/update/delete` is used outside `repo/` and `jobs/`.
4. **Job queue API** `packages/db/src/jobs/` (TS side): `enqueue(kind, runner, payload, {dependsOn, priority})`, `claim(runner, workerId)` using `FOR UPDATE SKIP LOCKED` with dependency check, `heartbeat`, `complete`, `fail` (retry with backoff up to `max_attempts`), `requeueStale`, `NOTIFY jobs_<runner>` on enqueue. Document the SQL so step 06 can implement the identical Python consumer.
5. **Storage adapter** `packages/storage`: S3 client (AWS SDK v3) configured by env; `presignGet(key, ttl)`, `presignPut`, multipart create/presign-part/complete/abort, `deletePrefix(prefix)`, key builders enforcing `u/{userId}/…` (throws otherwise). Works against SeaweedFS locally; note in code comments that Railway Buckets have no lifecycle rules (sweeper handles expiry).
6. `pnpm db:migrate`, `pnpm db:studio` (optional), `pnpm seed` (system user + one test user).

## Out of scope
HTTP endpoints, Better Auth setup, Python consumer.

## Acceptance criteria
- Migrations apply cleanly to an empty Postgres 18 and are reversible or forward-fixable as documented.
- Integration tests (Vitest against the compose Postgres): RLS blocks cross-user reads for every user table when using role `app`; `ml_worker` cannot read `users` or `correction_ops`; job claim is exclusive under concurrency (spawn 10 claimers, each job claimed once); stale-lock requeue works; dependency ordering works.
- Storage tests against SeaweedFS: presigned PUT/GET round-trip, multipart upload of a 12 MB file in 3 parts via presigned part URLs, `deletePrefix` removes everything; key builder rejects foreign prefixes.

## Verification to run and report
`pnpm db:migrate` on a fresh DB, `pnpm --filter db test`, `pnpm --filter storage test`, `pnpm typecheck`, `pnpm lint`.
