# @splitune/db

Postgres schema (Drizzle), migrations, roles and RLS, user-scoped repositories and the job queue.
Spec: `docs/implementation/03-data-model-and-storage.md` (local docs), security model: `17-security.md` §2.

```bash
pnpm db:migrate                    # apply migrations to DATABASE_URL (run as the database owner)
pnpm db:roles                      # give ml_worker / node_worker / maintenance a login password from DB_*_PASSWORD
pnpm seed                          # system user + test user (idempotent)
pnpm db:check                      # fail if the schema changed without a migration (CI)
pnpm db:studio                     # Drizzle Studio
pnpm --filter @splitune/db generate  # write a migration for schema changes in src/schema/
pnpm --filter db test              # integration tests: fresh throwaway database on the compose Postgres
```

## Migrations

- `migrations/0000_extensions.sql` (citext), `0001_schema.sql` (generated from `src/schema/`), `0002_roles_and_rls.sql` (hand-written roles, grants, policies), `0003_auth_and_uploads.sql` (generated: Better Auth tables and columns, upload multipart columns, `rate_limits`), `0004_auth_grants_and_cleanup_jobs.sql` (hand-written: maintenance grants, `jobs_owner_cleanup` policy). Custom SQL migrations are created with `drizzle-kit generate --custom --name <name>` so the journal stays consistent.
- `db:migrate` applies every pending migration in **one transaction**: a failure leaves the database unchanged.
- **Forward-only.** There are no down migrations. To undo a change, write a new migration that reverses it (expand → migrate → contract, `19-deployment-and-operations.md`); never edit or delete a migration that has been applied anywhere.
- A migration that adds a table must grant it explicitly (see the header of `0002`) and, if it holds user data, enable RLS with a policy. The RLS tests fail on any table with a `user_id` column the API can reach without RLS, and on any table `maintenance` cannot modify.
- The migrating role must be a superuser (local compose user, Railway's `postgres`): `0002` creates the `maintenance` role with `BYPASSRLS`.

## Roles and RLS

| Role | Used by | Access |
|---|---|---|
| `app` | API, via `withUser(db, userId, fn)` (`SET LOCAL ROLE app` + `app.user_id`) | User tables, RLS-scoped to `app.user_id`; inserts must also reference a parent row the user can see. Read-only: artefacts, stage runs, job events, flags, worker heartbeats. Insert-only: analytics events, audit log. |
| `ml_worker`, `node_worker` | Mac workers (log in with `DB_*_PASSWORD`) | jobs, job_events, stage_runs, artefacts, worker_heartbeats; read analyses and update their status columns; read songs' id/user/source/instrument/duration/audio_hash/status and update status, duration, audio_hash. No users, uploads, corrections, practice or billing data. |
| `maintenance` | sweepers, deletion cascade | `BYPASSRLS`, full DML on every table. |

The table owner (migrations, seeds, Better Auth, the rate limiter) is not subject to RLS. Better Auth's tables (`auth_sessions`, `auth_accounts`, `auth_verifications`) and `rate_limits` are owner-only.

**Object cleanup jobs.** `songs.delete(userId, songId, objectPrefixes)` deletes the rows and, in the same transaction, enqueues a `delete_prefix` job (`runner = 'node'`, no analysis) with payload `{ "user_id": "<id>", "prefixes": ["u/<id>/raw/<upload_id>/", "u/<id>/a/<analysis_id>/"] }`. Policy `jobs_owner_cleanup` only admits prefixes under the caller's `u/<user_id>/` ending in `/` without `.`/`..` segments; the node worker still re-checks each one (`deletePrefix` does).

Raw Drizzle queries are only allowed in `src/repo/`, `src/jobs/`, `src/client.ts`, `src/rate-limit.ts`, `scripts/` and `test/`; `pnpm lint` runs `scripts/check-db-access.mjs` to enforce it.

## Job queue protocol

`src/jobs/queue.ts` is the TypeScript side; the Python consumer (`services/ml/packages/splitune_ml_core/src/splitune_ml_core/queue.py`) issues the same statements. All times are database time (`now()`), never the worker's clock.

**Columns that matter:** `runner` (`python` | `node`), `status` (`queued` → `running` → `done` | `failed` | `cancelled`), `priority` (lower first), `attempts` (incremented on claim), `max_attempts`, `run_after`, `locked_by` (worker id), `heartbeat_at`, `depends_on bigint[]` (must be `done`), `soft_depends_on bigint[]` (must have finished — `done`, `failed` or `cancelled` — but need not have succeeded: a dependant with a fallback for a missing input; a failure there cancels nothing), `error_code` (machine code, e.g. `model_oom`).

**Enqueue** (one transaction; NOTIFY is delivered on commit):
```sql
-- every id in depends_on and soft_depends_on must exist (checked first)
INSERT INTO jobs (kind, runner, analysis_id, payload, depends_on, soft_depends_on, priority, max_attempts, run_after)
VALUES ($kind, $runner, $analysis_id, $payload, $depends_on, $soft_depends_on, $priority, $max_attempts, $run_after)
RETURNING *;
SELECT pg_notify('jobs_' || $runner, $id::text);
```

**Wake-up:** `LISTEN jobs_python` (or `jobs_node`); on a notification, or every 5 s as a fallback (the TCP proxy may drop idle connections), claim until nothing is returned.

**Claim** (autocommit; `$kinds` filter optional, used for MPS/CPU slots):
```sql
WITH next AS (
  SELECT j.id FROM jobs j
  WHERE j.runner = $runner AND j.status = 'queued' AND j.run_after <= now()
    AND j.kind IN ($kinds...)                       -- omit for "any kind"
    AND NOT EXISTS (SELECT 1 FROM jobs d WHERE d.id = any(j.depends_on) AND d.status <> 'done')
    AND NOT EXISTS (SELECT 1 FROM jobs d WHERE d.id = any(j.soft_depends_on)
                    AND d.status IN ('queued', 'running'))
  ORDER BY j.priority, j.id
  LIMIT 1
  FOR UPDATE OF j SKIP LOCKED
)
UPDATE jobs SET status = 'running', attempts = jobs.attempts + 1, locked_by = $worker_id,
                locked_at = now(), heartbeat_at = now(), error_code = NULL
FROM next WHERE jobs.id = next.id
RETURNING jobs.*;
```

**Heartbeat** every ≤30 s while running, and **complete**. Both report whether one row changed; 0 rows means the lock was lost (the job was re-queued as stale) and the worker must stop and discard its result:
```sql
UPDATE jobs SET heartbeat_at = now()
WHERE id = $id AND locked_by = $worker_id AND status = 'running';

UPDATE jobs SET status = 'done', heartbeat_at = now()
WHERE id = $id AND locked_by = $worker_id AND status = 'running';
```

**Fail** (one transaction). `$retry = false` for permanent errors (invalid input). Backoff after attempt *n* is `min(15 s · 2^(n-1), 900 s)`:
```sql
UPDATE jobs
SET status = CASE WHEN $retry AND attempts < max_attempts THEN 'queued' ELSE 'failed' END,
    run_after = CASE WHEN $retry AND attempts < max_attempts
      THEN now() + make_interval(secs => least(15 * power(2, attempts - 1), 900))
      ELSE run_after END,
    locked_by = NULL, locked_at = NULL, heartbeat_at = NULL, error_code = $error_code
WHERE id = $id AND locked_by = $worker_id AND status = 'running'
RETURNING status;
-- if the new status is 'failed': cancel dependents (below) with $failed_ids = {$id}
```

**Cancel dependents** of permanently failed jobs (same transaction; only `depends_on` edges cascade):
```sql
WITH RECURSIVE dependents AS (
  SELECT j.id FROM jobs j WHERE j.depends_on && $failed_ids::bigint[] AND j.status = 'queued'
  UNION
  SELECT j.id FROM jobs j JOIN dependents d ON j.depends_on @> array[d.id] WHERE j.status = 'queued'
)
UPDATE jobs SET status = 'cancelled', error_code = 'dependency_failed'
WHERE id IN (SELECT id FROM dependents);
```

**Requeue stale** (one transaction; run periodically by the node worker; stale = no heartbeat for 120 s):
```sql
WITH stale AS (
  SELECT id FROM jobs
  WHERE status = 'running' AND heartbeat_at < now() - make_interval(secs => 120)
  FOR UPDATE SKIP LOCKED
)
UPDATE jobs
SET status = CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'failed' END,
    run_after = now(), locked_by = NULL, locked_at = NULL, heartbeat_at = NULL,
    error_code = 'lock_expired'
FROM stale WHERE jobs.id = stale.id
RETURNING jobs.id, jobs.status;
-- then cancel dependents of the rows that became 'failed'
```

A `done` job keeps `locked_by` as a record of the worker that ran it.

**Dependants' wake-up:** after completing (or permanently failing) a job, the Python executor sends `NOTIFY jobs_<runner>` for every runner that has a queued job depending on it (hard or soft), so the node worker claims finalize at once instead of on its next poll.

**SSE wake-up:** a trigger on `job_events` sends `NOTIFY job_events, '<analysis_id>'` for every inserted event (whoever writes it); the API's SSE streams `LISTEN job_events` and poll every 5 s as a fallback. Event ids follow commit order within an analysis (migration `0007`): a `BEFORE INSERT` trigger locks the event's `analyses` row until commit before taking the id, so a stream that pages by id (`Last-Event-ID`) never passes over an event that commits late.

**Analysis graphs** (step 09, `apps/api/src/pipeline.ts`): full = `decode → {beats, tag} → separate → stem_post → {chords, notes.<instrument>} → finalize`, lite = `decode → beats → chords → finalize`, URL imports prepend `url_import`. Hard edges where a stage cannot run without its input (decode, beats for chords, tag → separate → stem_post); soft edges where it has a fallback (chords and notes after stem_post run on the mixture); finalize soft-depends on every other job, so it always runs once the rest has finished and decides `done` / `partial` / `failed`.
