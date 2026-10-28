# Progress log

One entry per piece of work, oldest first; append new entries at the end. Headings up to step 17 use step numbers (`docs/steps/sNN-…`). Later headings such as "Step 18", "18a"–"18c" are ad-hoc numbers that do not match the steps: `docs/status.md` "Ad-hoc work" maps them. Current state of every step: `docs/status.md`.

## 2026-10-20 — Step 01: Repository scaffold, tooling and CI
Branch `impl/01-repo-scaffold`, commit `f743409` (first commit in the repo), fast-forwarded into `dev`.

**Built**
- Workspace root: `package.json` (pnpm 12.5.1, Node 24), `pnpm-workspace.yaml`, `turbo.json` (build, dev, lint, typecheck, test, e2e), `.nvmrc`, `.gitignore`, `.editorconfig`, `biome.json`, strict `tsconfig.base.json`, `.browserslistrc` (doc 24 §2).
- TS packages per doc 02 §1: `apps/{web,api,listening}`, `packages/{contracts,music-core,audio-engine,notation,ui-tokens,analytics,config}` — each with `package.json` (exports `./src/index.ts`), `tsconfig.json`, `src/index.ts` (`VERSION`) and one Vitest test. `packages/audio-dsp` is a README placeholder for step 11. `compliance/register/` and `infra/railway/` are empty (`.gitkeep`).
- `services/ml`: uv workspace (Python 3.12, `required-version` uv 0.13), ruff 0.17.1, pyright 1.1.414 (strict), pytest 9.1.1; `splitune_ml_core` (with a test) plus empty `stage_{decode,beats,tagger,separation,chords,notes,sections,lyrics}` (doc 06 §1). A small `services/ml/package.json` bridges it into Turborepo, so `pnpm lint/typecheck/test` run `uv run ruff check` + `ruff format --check`, `uv run pyright`, `uv run pytest`.
- `infra/docker-compose.yml`: Postgres 18.6 (healthcheck, named volume at `/var/lib/postgresql` per the PG 18 image layout), SeaweedFS 4.48 `weed server -s3` with identities from `infra/seaweedfs/s3.json`, a one-shot `amazon/aws-cli:2.38.2` job that creates `splitune-media` if missing, Mailpit v1.31.6. All ports bound to 127.0.0.1.
- Scripts: `pnpm run setup` (`scripts/setup.mjs`: pnpm install, uv sync, `.env` from `.env.example` if missing, `git config core.hooksPath .githooks`, warns if gitleaks/docker missing), `pnpm dev`, `pnpm lint`, `pnpm format`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`, `pnpm secrets:scan`. `.env.example` covers runtime, DB (+ `DATABASE_PUBLIC_URL`), S3, Better Auth (+ optional Google), SMTP→Mailpit, `BILLING_PROVIDER=mock` + mock webhook HMAC secret, `CACHE_SCOPE=global`, `ML_MODE=mock`, `SPLITUNE_CALLBACK_SECRET`.
- CI `.github/workflows/ci.yml`: PRs + pushes to `dev`; checkout/pnpm/setup-node/setup-uv pinned by commit SHA; pnpm store and uv caches; `pnpm install --frozen-lockfile`, `uv sync --locked`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- `.githooks/pre-commit` runs `gitleaks git --pre-commit --staged --redact` (blocks if gitleaks is missing).
- `CLAUDE.md` = `AGENTS.md` (38 lines).

**Deviations and decisions**
- `pnpm setup` is a pnpm built-in (it edits the shell profile), so the script is run as **`pnpm run setup`**. Updated docs 02 (TL;DR, §3) and 25 (§6, also added `gitleaks` to the brew line). Prompts still say `pnpm setup`.
- CI triggers on `dev`, not `main`, per the updated shared context (no `main` branch).
- CI runs the Python checks through `pnpm lint/typecheck/test` (Turborepo invokes the exact `uv run ruff check` / `uv run pyright` / `uv run pytest` commands) rather than as duplicate steps.
- Biome runs once from the root (`biome check .`) instead of a per-package `lint` script; the Turborepo `lint` task currently only has the ml package.
- Packages are consumed as TS source (no build step yet), so `build` is defined in Turborepo but no package implements it.
- `@typescript/typescript6` not installed: no tool needs the TS API yet. Add it when one does.
- Bucket creation uses the AWS CLI (`head-bucket || create-bucket`) instead of `weed shell` for reliable exit codes and idempotency.
- Installed `gitleaks` 8.30.1 via Homebrew on the dev Mac to verify the hook.
- Container runtime on the dev Mac: Colima + Docker CLI 29.5.2 + Compose 5.6.0 via Homebrew (`colima start --cpu 4 --memory 6 --disk 40`). The leftover Docker Desktop `~/.docker/config.json` was backed up to `config.json.desktop-backup`; `credsStore: desktop` removed and `cliPluginsExtraDirs` set to `/opt/homebrew/lib/docker/cli-plugins`.

**Verification**
- `pnpm run setup` → exit 0 (created `.env`, set hooksPath, warned Docker missing).
- `pnpm lint` → Biome: 47 files, no errors; ruff: all checks passed, formatted.
- `pnpm typecheck` → 11/11 tasks (tsc 7.0.2 per package, pyright 0 errors). Confirmed tsc fails on an injected type error.
- `pnpm test` → 11/11 tasks (10 Vitest suites, 1 pytest).
- `cd services/ml && uv run ruff check && uv run pyright && uv run pytest` → pass.
- Fresh clone of the branch → `pnpm run setup`, lint, typecheck, test, uv commands all pass; working tree clean afterwards.
- CI workflow: `check-jsonschema --builtin-schema vendor.github-workflows` ok; `actionlint` clean. `act` not installed, so not executed locally.
- Compose file validates against the compose-spec JSON Schema.
- gitleaks: `gitleaks dir .` finds nothing in the scaffold (one generic-api-key hit inside untracked `docs/`); pre-commit hook ran on the commit: no leaks.
- `docker compose -f infra/docker-compose.yml up -d` → postgres, seaweedfs, mailpit `healthy`; `seaweedfs-init` exited 0 after creating `splitune-media`.
- Postgres: host port 5432 open; `select version()` → PostgreSQL 18.6; password auth over TCP with the `.env.example` URL works.
- SeaweedFS S3 from the host (curl SigV4 with the `.env.example` keys): ListBuckets shows `splitune-media`; PUT 200 / GET 200 / DELETE 204 round trip; anonymous GET 403. `aws s3 ls` (aws-cli container on the compose network) lists the bucket.
- Mailpit: UI `http://localhost:8025` → 200; a message sent to SMTP `localhost:1025` appears via the API.
- `down` + `up -d`: bucket persists in the named volume and the init job exits 0 without recreating it.
- Re-verified on Docker Desktop (engine 29.9.1, context `desktop-linux`) after switching from Colima (now stopped): all services healthy, bucket created, same Postgres/S3/Mailpit checks pass.

**Known gaps**
- No `dev` scripts exist yet, so `pnpm dev` only starts compose; turbo reports 0 tasks.
- Python resolves to the locally available 3.12.0; uv will download a managed 3.12 elsewhere.

**For the next step**
- Add new TS packages under `apps/*` or `packages/*` with `typecheck` + `test` scripts; new Python stage code goes in the existing `services/ml/packages/stage_*` (add deps there; the root `splitune-ml` project depends on all members).
- `.env.example` names are the source of truth for env vars; extend it rather than inventing new names.
- Docs/prompts remain untracked; reference them, don't commit them.

## 2026-10-20 — Step 02: Contracts package (analysis schema + API types + codegen)
Branch `impl/02-contracts`, commit `c5134e1`, fast-forwarded into `dev` (not pushed).

**Built**
- `packages/contracts/src/analysis/`: `common.ts` (`SCHEMA_VERSION = "1.0.0"`, `assertCompatible`, `SchemaVersion`, `Sha256Hex`, `MachineCode`, `ModelRef`, `Confidence`, `ArtefactHeader`, `StageStatus`, `Instrument`, `ConfidenceBand`, `SourceKind`, `ArtefactKind`), `manifest.ts`, `beats.ts`, `presence.ts`, `stems.ts` (`mix_gain_db`, `gain_to_unity_db`, AAC/MP4 + Opus/WebM file variants), `sections.ts`, `chords.ts`, `notes.ts` (`Notes`, `DrumHit`, `DrumNotes`), `tab.ts`, `summary.ts`, `corrections.ts` (`CorrectionOp` discriminated union, one named schema per op), `stage.ts` (`StageName`, `StageRequest` with object keys + optional `presigned`/`callback`, `StageResult`, `ArtefactWritten`, `StageMetrics`).
- `packages/contracts/src/api/`: error codes/statuses + `ErrorEnvelope`, songs (incl. `PlayerState`, import-url, YouTube/sync points), uploads, analyses (`type: full|lite`), artefacts, corrections batch, loops (incl. V1 `SpeedTrainer`), practice sync + progress, billing (mock plans/checkout/portal, wire `BillingEvent`, dev clock), me (usage per analysis type, entitlement keys), SSE `JobEvent` union, and `contract` — the oRPC router definition (`@orpc/contract`) with typed errors and an event-iterator output for `/v1/analyses/{id}/events`.
- Codegen: `pnpm --filter contracts build` (`scripts/build-schema.ts`) → `schema/contracts.json` (all registered types under `$defs`) + `schema/<Type>.json` per top-level document. `services/ml/scripts/gen_contracts.py` → `splitune_ml_core/contracts/_generated.py` (datamodel-code-generator 0.86.0, Pydantic 2.14.1), formatted/linted through ruff with the project config. `splitune_ml_core.contracts` adds `SCHEMA_VERSION`, `assert_compatible`, `dump_json`. Root `pnpm contracts:gen` runs both; `pnpm contracts:check` regenerates into a temp dir and fails on any diff (new "Contracts drift" CI step).
- Fixtures `packages/contracts/fixtures/`: 8 bars of a 4/4 quarter-note guitar arpeggio (Am–F–C–G) at 100 BPM, with drums as an extra instrument: manifest, beats, presence, stems, sections, chords, notes.guitar (two low-confidence notes, one bend), notes.drums, tab.guitar (standard tuning, alt fingerings), summary, corrections (every op type), stage request (personal + commercial variant), stage result, job events. `fixtures/invalid/` holds 6 single-fault documents. `fixtures/index.json` maps each file to its type and is read by both test suites.
- Tests: Vitest (42) — fixtures valid/invalid (exactly one issue each), op coverage, tab→notes FKs, unknown-field stripping, versioning, bundle invariants (no `additionalProperties: false`, no required nullable fields), oRPC routes unique and path params declared. pytest (48) — fixtures valid/invalid, Python dump round-trips to the identical document, `assert_compatible`, version parity.

**Deviations and decisions** (documented in doc 05 "Implementation notes", plus 04, 14, 02, 00)
- Python parity over convenience: strict scalar types, date-times/UUIDs/URLs kept as strings validated with Zod's exact regexes (UTC `Z` only), tagged unions via an injected `discriminator` annotation. Result: each invalid fixture fails on the same field in both languages.
- No float literals (Python `Literal` can't express them): `tempo_octave.factor` is `"double" | "half"`; `f0.hop_s` is a positive number instead of literal 0.01.
- JSON Schema emitted in Zod input mode so it never forbids unknown fields (S8). Python-facing types use optional (never required-nullable) fields so `dump_json(exclude_none=True)` is lossless; a test enforces it. `AnalysisCapDetails` (API-only, has a nullable) is not in the bundle.
- Tightened types: hex sha256, machine-code pattern for `error_code`/`fallback_reason` (rejects raw exception text), `ArtefactKind` pattern on headers, non-negative times, [0,1] bounds on confidence means, `ViewReason` enum, `SectionLabel` for `set_section`, `SchemaVersion` on tab/summary.
- Added `DrumNotes` wrapper and `StageName` enum (catalogue of doc 06 incl. `url_import`, `lyrics`, `notes.other`); `StageResult` carries `analysis_id` and `stage`.
- Indexing convention (docs were silent): `bar_index`/`tab.bar`/loop bars 0-based (pickup −1); beats 1-based; ticks 0…959.
- API: `POST /v1/songs` accepts only `upload|recording`; import-url takes `type` and returns `{song_id, analysis_id, status}`; `url_unsupported` → 422, `url_download_failed` → 502; upload warranty fields optional (personal mode); `GET /v1/me` usage is per type (`welcome_available`, `full`, `lite`); wire `BillingEvent` is snake_case with `amount_minor`. Legal/DMCA routes left out (dormant in personal mode). API request/response shapes are not in the Python bundle; other languages get them from oRPC's OpenAPI export later.
- Generated files (`schema/*.json`, `_generated.py`) are committed on purpose: the drift check compares against them. Biome ignores `packages/contracts/schema`; ruff ignores E501 in `_generated.py` only.
- `contracts-drift` is a step in the existing `checks` job rather than its own job (needs the same pnpm + uv setup).
- `.gitleaks.toml` (default rules + one allowlist): sha256 `cache_key` lines under `packages/contracts/fixtures/` tripped `generic-api-key`. Condition `AND`, so a real-looking key in fixtures is still caught (checked with a planted key).
- Paths: the prompt's `splitune_ml_core/contracts/_generated.py` and `pnpm --filter contracts build` replace doc 05's `services/ml/splitune_ml/...` and `pnpm contracts:build`; doc 05 updated.

**Verification**
- `pnpm contracts:gen` → exit 0; second run then `git diff --exit-code` → 0 (deterministic).
- `pnpm contracts:check` → "Generated contracts are up to date"; fails as expected after a hand edit to `_generated.py` and after a Zod change without regenerating (lists the stale files).
- `pnpm --filter contracts test` → 4 files, 42 tests passed.
- `cd services/ml && uv run pytest -k contracts` → 48 passed.
- `pnpm typecheck` → 11/11 (tsc incl. `scripts/`, pyright strict 0 errors incl. `_generated.py` and `scripts/`).
- `pnpm lint` (Biome + ruff check/format) → pass; `pnpm test` → 11/11.
- Fresh clone of the branch: `pnpm install --frozen-lockfile`, `uv sync --locked`, `pnpm contracts:check`, lint, typecheck, test → all pass, tree clean.
- Pre-commit gitleaks on the commit → no leaks.

**Known gaps**
- OpenAPI generation from the oRPC contract (`@orpc/openapi` + Zod converter) isn't wired yet; the oRPC error ↔ `ErrorEnvelope` mapping and query-string coercion for GET inputs (`limit`, `after_rev`) belong to the API step (oRPC smart coercion or `z.coerce`).
- Union variants like `JobEvent` reject unknown `type`s; readers that must tolerate future event types will need a fallback when one is added.
- CI drift step not executed on GitHub yet (no push); verified locally only.

**For the next step**
- Import from `@splitune/contracts` (TS) and `splitune_ml_core.contracts` (Python). After changing any Zod schema: `pnpm contracts:gen`, commit the regenerated files with the change.
- Register a schema in `contracts` (`.register(contracts, { id })`) only if Python needs it; keep such types free of required-nullable fields and float literals.
- Python writers serialise with `contracts.dump_json(model)`; check versions with `assert_compatible` before parsing artefacts.
- `ML_MODE=mock` can serve `packages/contracts/fixtures/*` (doc 02); `fixtures/index.json` lists them with their types.

## 2026-10-20 — Step 03: Database schema, migrations, RLS and storage adapter
Branch `impl/03-database-and-storage`, commit `d41ea31` (not merged into `dev`, not pushed).

**Built**
- `packages/db` (`@splitune/db`): Drizzle 0.45.4 schema (`src/schema/`) for all doc 03 tables (users without Better Auth's own columns, songs, uploads, youtube_refs, sync_points, analyses, stage_runs, artefacts, correction_ops, loop_clips, practice_sessions, practice_attempts, subscriptions, usage_ledger, jobs, job_events, dmca_notices/actions/strikes, audit_log) plus worker_heartbeats, analytics_events, feature_flags. node-postgres 8.23.1 driver. `users.id` is text.
- Migrations (`migrations/`): `0000_extensions` (citext), `0001_schema` (generated), `0002_roles_and_rls` (hand-written): roles `app`, `ml_worker`, `node_worker` (NOLOGIN) and `maintenance` (NOLOGIN, BYPASSRLS), explicit grants, `app_user_id()` helper, RLS on 17 tables.
- `withUser(db, userId, fn)`: transaction + `set_config('app.user_id', …, true)` + `SET LOCAL ROLE app`; rejects malformed ids.
- Repositories (`src/repo/`, `createRepositories(db)`): users, songs, uploads, analyses (`createOrGet` idempotent), artefacts (read-only), corrections (consecutive revs under an advisory lock, client_op_id replay-safe), loops, practice (offline sync, idempotent), usage (record/totals/refund). All take `userId` first and filter on it inside `withUser`.
- Job queue (`src/jobs/queue.ts`, exported as `queue`): `enqueue` (+ `pg_notify('jobs_<runner>', id)`), `claim` (`FOR UPDATE SKIP LOCKED`, dependency check, optional `kinds` filter), `heartbeat`, `complete`, `fail` (backoff 15 s·2^(n-1) capped at 900 s, `retry: false` for permanent errors), `requeueStale` (120 s), transitive cancel of dependents of permanently failed jobs. SQL documented statement by statement in `packages/db/README.md` for the Python consumer.
- `packages/storage` (`@splitune/storage`): AWS SDK v3 3.1153.0 client from `S3_*` env (`requestChecksumCalculation: WHEN_REQUIRED`), `presignGet` (15 min), `presignPut` (1 h, signed content-type and optional content-length), multipart create / presign part (optional signed content-length) / complete / abort, `listKeys`, `deletePrefix` (only `u/{user_id}/…/` prefixes), key builders + `assertOwnedKey`/`assertSafeKey`.
- Scripts: `pnpm db:migrate`, `pnpm db:roles` (login passwords from `DB_APP_PASSWORD`, `DB_ML_WORKER_PASSWORD`, `DB_NODE_WORKER_PASSWORD`, `DB_MAINTENANCE_PASSWORD`; added to `.env.example` and appended to the local `.env`), `pnpm db:check` (schema drift, generates into a temp dir), `pnpm db:studio`, `pnpm seed` (users `system` and `test-user`).
- `scripts/check-db-access.mjs` in `pnpm lint`: fails on `select/insert/update/delete/execute/$count(` or `.query.` on any `*db`/`*tx` identifier (also across lines) outside `packages/db/src/{repo,jobs}/`, `client.ts`, `scripts/`, `test/`.
- CI: "Migrations drift" step (`pnpm db:check`) and "Start Postgres and SeaweedFS" (`docker compose up -d --wait postgres seaweedfs` + `run --rm seaweedfs-init`) before tests.

**Deviations and decisions** (recorded in doc 03 "Implementation notes"; doc 02 layout, lint rule and commands updated)
- Identity columns instead of `bigserial`; enum checks generated from the contracts' Zod enums (new checks on `songs.instrument`, `analyses.requested_instrument`, `stage_runs.stage/status`; `subscriptions.status` includes `expired` like the contract).
- `uploads.rights_warranty_at` nullable (personal mode).
- Raw upload key is `u/{user_id}/raw/{upload_id}/source.{ext}` (doc 03 said `{original_filename}`; doc 17 §3 and doc 03 itself forbid names/titles in keys).
- `withUser` also does `SET LOCAL ROLE app`, so the API can use Railway's owner `DATABASE_URL` and still get RLS. Roles are NOLOGIN in the migration; passwords never live in migrations.
- RLS `WITH CHECK` additionally requires the parent row to be visible (FK checks bypass RLS). `sync_points`, `stage_runs`, `jobs` are scoped via parents. `analytics_events` insert-only for `app`. App may insert jobs only for its own analyses.
- Worker grants follow the prompt plus `songs` reads of source/instrument/duration/audio_hash and updates of `duration_s`/`audio_hash` (decode needs them). No `uploads` grant: object keys travel in job payloads.
- Dependency semantics: deps must be `done`; permanent failure cancels queued dependents (`dependency_failed`). Partial-result finalize is left to the pipeline steps.
- Migrations are forward-only; the drizzle migrator applies all pending ones in one transaction (`packages/db/README.md`).
- Queue API takes the executor first (`enqueue(db, kind, runner, payload, opts)`), so it can join an API transaction; extra options `analysisId`, `maxAttempts`, `runAfter`.
- `pnpm-workspace.yaml`: `allowBuilds: esbuild: false` (pnpm 12 blocks build scripts; esbuild's postinstall is only a binary check, drizzle-kit works without it).
- `packages/db` depends on `zod` (same 4.6.7) for `z.infer` on jsonb column types.

**Verification**
- Fresh DB: `drop database splitune` / `create database splitune`, then `pnpm db:migrate` → "Migrations applied." (23 tables); rerun → no-op. `pnpm db:roles` → ml_worker/node_worker/maintenance login enabled; `psql -U ml_worker` can count `jobs`, gets `permission denied for table users`. `pnpm seed` twice → 2 then 0 new users.
- `pnpm --filter db test` → 3 files, 61 tests passed (fresh `splitune_test_*` database per run, dropped afterwards; none left behind). Covers: RLS hides cross-user rows in all 16 user tables and shows nothing without `app.user_id`; RLS/maintenance coverage introspection; cross-user insert/attach/update/delete blocked; scope reset on pooled connections and on throw; ml_worker/node_worker denied users, correction_ops, uploads, loop_clips, subscriptions and song titles; 10 concurrent claimers over 40 jobs → each claimed exactly once; priority/kinds/run_after ordering; dependency ordering; NOTIFY payload; backoff and max_attempts; transitive cancel; stale requeue (and lost-lock heartbeat/complete); claim under ml_worker; repository behaviour.
- Mutation checks: `USING (true)` on `songs_owner` → 9 RLS tests fail; removing `FOR UPDATE … SKIP LOCKED` → concurrency test fails 3/3 runs; a planted schema column → `pnpm db:check` fails; planted raw queries → `check-db-access` fails (single- and multi-line), `set.delete()` not flagged. All reverted.
- `pnpm --filter storage test` → 2 files, 37 tests passed against SeaweedFS: presigned PUT/GET round trip, wrong content-type/length → 403, unsigned and expired GET → 403, 12 MiB multipart in 3 presigned parts (5+5+2 MiB, byte-identical download), abort, `deletePrefix` removes 5 objects and keeps a sibling, foreign/unsafe prefixes and keys rejected.
- `pnpm typecheck` → 13/13 tasks. `pnpm lint` → Biome 156 files clean, check-db-access clean, ruff ok. `pnpm test` → 14/14 tasks. `pnpm contracts:check` → up to date. `pnpm install --frozen-lockfile` ok. CI YAML validates (`check-jsonschema` github-workflows); the CI run itself not executed (no push). Pre-commit gitleaks: no leaks.

**Known gaps**
- `pnpm db:studio` wired but not opened.
- Doc 02's `-- allow-destructive` marker for destructive migrations is not enforced yet.
- Railway Bucket not exercised (only SeaweedFS); browser multipart needs bucket CORS that exposes `ETag` (not configured anywhere yet). Railway Postgres not touched; `0002` needs a superuser there (Railway's `postgres` user should be one — unverified).
- No `LISTEN` helper in TS yet (node worker step); no worker-presence helpers for `worker_heartbeats` (table and grants exist).
- Better Auth columns/tables on `users` arrive with step 04.

**For the next step**
- Import `createDb`, `createRepositories`, `withUser`, `queue` and tables from `@splitune/db`; `@splitune/db/schema` exports only tables (for Better Auth's Drizzle adapter). Add new user-scoped queries as repository functions; raw queries elsewhere fail `pnpm lint`.
- Schema change: edit `src/schema/`, `pnpm --filter @splitune/db generate`, review SQL, add grants/RLS for new tables in the same or a custom migration, commit; CI runs `pnpm db:check`.
- Step 04 (Better Auth): map its user model onto `users` (text ids, `email` citext) and add its columns via a migration; its own tables need no RLS but must not be granted to worker roles.
- Step 06 (Python consumer): follow `packages/db/README.md` "Job queue protocol" exactly; connect as `ml_worker` via `DATABASE_PUBLIC_URL` after `pnpm db:roles`.

## 2026-10-20 — Step 04: API skeleton and authentication
Branch `impl/04-api-and-auth`, created from `impl/03-database-and-storage`, commits `9bdcfdf` (contracts), `cafbd2a` (db), `dbe9d51` (api). On the owner's request, steps 03 and 04 were fast-forwarded into `dev` with subject-only messages (bodies and co-author trailers removed; trees unchanged; step 03 is now `b2d40a9`). Not pushed.

**Built**
- `apps/api` (`@splitune/api`): `createApi({ db, storage, config })` → Hono app; `src/server.ts` standalone (`pnpm --filter @splitune/api dev`, PORT 3000). oRPC 1.15.7 `OpenAPIHandler` bound to a `v1Contract` subset of `@splitune/contracts` (`me.get/update`, songs create/list/get/update/delete, uploads create/refreshParts/complete/abort) with smart query coercion; OpenAPI 3.1 at `/v1/openapi.json`; `/internal/health`, `/internal/ready` (DB ping).
- Auth (`src/auth.ts`, Better Auth 1.7.11): Drizzle adapter on the same Postgres, magic link (5 min, single use, hashed tokens) via nodemailer SMTP → Mailpit, Google only when both env vars are set (account linking), cookie `splitune.session_token` HttpOnly/SameSite=Lax/Secure in production, 30-day rolling sessions, base path `/v1/auth`. `resolveSession` feeds `authed` middleware (`userId` in context, every repo call goes through `withUser`). `requireRecentAuth` re-auth helper (10 min).
- Endpoints: `GET/PATCH /v1/me` (plan/entitlements/usage from `src/entitlements.ts`, flags, audited `training_opt_in`), songs CRUD (keyset cursor; GET bumps `last_opened_at`), uploads (multipart init with presigned parts carrying signed Content-Length, duplicate by `file_sha256`, refresh, complete → `uploaded` without starting analysis, abort), `DELETE /v1/songs/{id}` (cascade + `delete_prefix` job in the same transaction).
- Cross-cutting: uniform ErrorEnvelope (`src/errors.ts`; oRPC errors mapped by status, validation issues as `details.issues`), 404 for not-owned resources, Postgres fixed-window rate limits (auth 10/min/IP, uploads 20/h/user, `Retry-After`), CSRF header `X-Splitune-CSRF` on cookie-authenticated mutations, CORS from `CORS_ORIGINS` (default `APP_URL`), 1 MiB body limit, nosniff/no-store/HSTS(prod), pino JSON logs with request id, path without query, salted `user_hash`.
- DB: migrations `0003_auth_and_uploads` (generated) and `0004_auth_grants_and_cleanup_jobs` (owner-only auth/limiter tables, maintenance grants, `jobs_owner_cleanup` RLS policy); repo additions listed in doc 03 "Implementation notes (step 04)"; `hitRateLimit`, `ping`.
- Tests (`apps/api/test`, own throwaway DB per run): magic-link E2E through Mailpit, me/songs/cross-cutting, uploads against SeaweedFS (real presigned part PUTs), generated authz matrix, RLS bypass test, OpenAPI validation; unit tests for errors, entitlements, config. `scripts/openapi.ts` (`openapi:check`). CI starts Mailpit with Postgres and SeaweedFS.

**Deviations and decisions** (docs 00, 02, 03, 04, 14 updated with "Implementation notes (step 04)")
- New error code `internal_error` (500) in contracts (envelope had no code for unexpected failures); regenerated schema + Pydantic.
- Better Auth mounted at `/v1/auth/*` (not `/api/auth`) so the whole API lives under one `/v1` mount. Better Auth's own rate limiter disabled; the API's Postgres limiter covers auth (one place, survives Railway sleep).
- Users keep Splitune's `display_name`; Better Auth's `name` is a separate column used as fallback in `/v1/me`.
- `delete_prefix` enqueued by `app` under a new narrow RLS policy instead of as the owner, so the song delete and its cleanup commit atomically.
- Upload policy (proposals): ≤500 MB, 8 MiB parts, media-type allowlist, raw `expires_at` = now + 7 days, all part URLs returned at creation. Duplicate detection only counts completed uploads still attached to a song (the new empty song stays; the client may delete it).
- `PATCH /v1/songs/{id}` replaces `player_state` as a whole; `GET /v1/songs/{id}` updates `last_opened_at`.
- Free usage period = UTC calendar month (no user time zone stored yet); caps are constants until step 14.
- `generateOpenApi` returns the JSON-normalised document: oRPC leaves `allowEmptyValue: undefined` keys in memory that made the validator fail although the served JSON is valid.
- `apps/api` has no direct `drizzle-orm` dependency: better-auth's kysely peer makes pnpm resolve a second drizzle-orm copy whose types don't mix with `@splitune/db`'s. The RLS test therefore uses unfiltered queries only.
- New env vars in `.env.example`: `PORT`, `CORS_ORIGINS`, `TRUST_PROXY` (appended to the local `.env` too). `BETTER_AUTH_SECRET` must be ≥32 chars.

**Verification**
- `pnpm --filter @splitune/api test` → 9 files, 63 tests passed (compose Postgres + SeaweedFS + Mailpit).
- Scripted magic-link flow: Vitest `test/auth.test.ts` (Mailpit API), plus a curl run against the standalone dev server as `test@splitune.localhost`: sign-in 200 → Mailpit link → verify 302 + cookie → `/v1/me` 200 → create/list song → openapi 200; request logs contain no query strings or tokens.
- `pnpm --filter @splitune/api openapi:check` → "OpenAPI 3.1.1: valid (7 paths)".
- `pnpm --filter @splitune/db test` → 3 files, 83 tests (new: pagination, open, delete + cleanup job and rollback, cleanup-policy refusals, auth tables closed to app/workers, uploads transition/dedupe, rate limiter concurrency/window, audit).
- Mutation checks: CSRF check removed → 1 API test fails; auth middleware bypassed → 9 fail. Restored.
- `pnpm lint` (Biome 187 files clean, check-db-access, ruff), `pnpm typecheck` 13/13, `pnpm test --force` 14/14, `pnpm db:check`, `pnpm contracts:check`, `pnpm install --frozen-lockfile` → all pass. `pnpm db:migrate` + `pnpm seed` on the local dev DB ok. No leftover test databases. gitleaks pre-commit: no leaks.

**Known gaps**
- Google OAuth only checked up to the redirect to accounts.google.com (no real client); Apple and passkeys not started.
- `TRUST_PROXY` uses the last `X-Forwarded-For` hop; that this is the client address on Railway is assumed, not verified.
- Abort racing a successful complete can leave an orphan raw object (upload marked deleted); the raw-prefix sweeper (later step) must handle it. A failed multipart abort after a failed insert is only logged.
- `Idempotency-Key` handling not implemented (no mutating endpoint here needs it yet; analyses/corrections will).
- Railway not touched; CI with Mailpit not executed on GitHub (no push). Bucket CORS exposing `ETag` for browser uploads still unconfigured.
- `requireRecentAuth` has no caller yet (DELETE /v1/me is a later step).

**For the next step**
- Add procedures by extending `v1Contract` in `apps/api/src/procedures.ts`, implementing them with `authed.<group>.<proc>` in `src/routes/`, and adding a case to `CASES` in `test/authz-matrix.test.ts` (the test fails until you do). Throw `apiError(code, …)` for contract errors.
- Web (step 10): mount the app returned by `createApi` for `/v1/*` and `/internal/*`; the oRPC client must send `X-Splitune-CSRF: 1` and credentials; set `TRUST_PROXY=true` and `CORS_ORIGINS` on Railway.
- Node worker: consume `delete_prefix` jobs (payload `{ user_id, prefixes }`), call `storage.deletePrefix` per prefix.

## 2026-10-20 — Step 05: music-core
Branch `impl/05-music-core` from `dev` (`dbe9d51`), commits `b59f9e3` (contracts), `a1498c2` (music-core), `824257e` (eval harness), `f92c6a9` (P3 result). On the owner's request, fast-forwarded into `dev` with subject-only messages (bodies and co-author trailers removed; trees unchanged). Not pushed.

**Built**
- `packages/music-core` (`@splitune/music-core` 0.1.0), pure and deterministic, runs in Node and a Worker: `corrections/apply` (notes/chords/beats/sections, skipped-op reporting, fret pins), `grid/beatgrid` (labels from downbeats, `timeToTick`/`tickToTime` with extrapolation, `snapToBar` with pickup, `tempoOctave`, `shiftDownbeat`, `nudgeBeat`), `quantize` (1/16 grid, per-bar swing, 30 ms chord collapse, drum flams, signed residuals flagged > 60 ms), `bass/octave` (Viterbi), `harmony/key` (Krumhansl–Kessler, softmax-margin confidence), `harmony/chordtools` (Harte parse/format/transpose/triads, `chordDisplayName` display formatter, open + barre shape library, difficulty), `fret/config` + `fret/dp` (K-best candidates, (candidate, hand position) DP, alternatives, octave-shifted and unplaceable notes flagged), `level/simplify`, `transpose` (keep-shapes capo, capo suggestion), `export/alphatex` (+ `noteMap`), `calibration/lookup`.
- `buildTab(notes, beats, corrections, options)` → `{ tab, alphaTex, noteMap, … }`.
- CLI `pnpm --silent --filter @splitune/music-core cli <fret|quantize|build-tab>` (or `node packages/music-core/src/cli.ts …`): JSON stdin/stdout, contract validation, exit 2 + ErrorEnvelope on stderr. 9 golden files in `packages/music-core/golden/` (incl. a pickup bar), `golden:update` script.
- Contracts (schema 1.1.0): `TabEvent.unplayable`, `Tab.swing_bars`, `CalibrationTable` document; Pydantic regenerated.
- P3 harness `services/ml/eval/` (`tab_metrics.py`, `p3_guitarset.py`, `p3_tune.py`, tests); report `services/ml/eval/results/p3/2026-10-20.md` + CSV. GuitarSet annotations (Zenodo 3371780, CC-BY-4.0, md5 verified) live in `~/datasets/guitarset/annotation`, not in the repo.

**Deviations and decisions** (docs 05, 07 and D3 updated with step-05 notes)
- Owner's UI/UX adjustments (docs 26–28), applied mid-step:
  1. Residual-flagged notes are a dotted underline; unplayable is "8va/8vb" (octave-shifted) or "!" (no position) — never "dashed" (reserved for medium/low confidence). Contract comment on `TabEvent.unplayable` and doc 07 (residual, edge cases) updated.
  2. alphaTex has no custom per-note property, so `buildTab` returns `noteMap`: every rendered alphaTab note (bar, voice, beat index, note index) → `note_id`, for NoteStyle + boundsLookup overlay in step 12. Doc 07 §8 and module map updated. (`buildTab` also returns `effective`, `displayChords`, `skippedCorrections`, `residualFlagged`, `warnings`.)
  3. Pickup bars (bar −1) are written with `\ac`; golden `build-tab.pickup.json` covers it.
  4. `chordDisplayName` (Harte → "Cmaj7", "F#m", "Bb", "Am7/G") is separate from `formatChord` (canonical Harte); alphaTex chord names are opt-in (`chordNames`, default off).
- Fret DP state is (candidate, hand position) rather than candidate alone; new weights `stretch` and the hand-position shift. Guitar weights tuned in P3; bass weights untuned (doc values + stretch 1).
- Bass octave chord term reinterpreted as a register prior (the doc's circular pitch-class distance is constant across octave candidates); per-change hysteresis instead of a global margin; `low_band_energy` penalises both p and p−12. Root–fifth prior: the fifth is two frets up on the next string, not one.
- `TabEvent.fret` absolute (from the nut); alphaTex frets relative to the capo. `quantize_residual_ms` signed. Bass `roots` note ids are `root:{segment_id}@{bar}`.
- alphaTex 1.8 differences recorded in doc 07: no `.` separators, `\tempo`/`\ts` bar-level, multi-arg metadata in parentheses, frets relative to capo.
- `tempo_octave` keeps the meter's beats per bar; Biome now ignores `packages/music-core/golden` (generated JSON, like `packages/contracts/schema`).
- Vitest 5 benchmarks use the test-context `bench` API (`vitest bench --run --reporter=verbose`).
- Dev dependencies only: `fast-check` 4.10.2, `@coderline/alphatab` 1.8.4 (tests load every alphaTex output), `zod` (types). Runtime: `@splitune/contracts` only — but it brings Zod into the Worker bundle (`SCHEMA_VERSION` import).

**Verification**
- `pnpm --filter music-core test` → 9 files, 109 tests passed (fast-check: quantize idempotent ×1000, fretted pitch = input and span ≤ max ×300, empty corrections = identity, transpose round trip; alphaTab 1.8.4 loads every output with zero diagnostics and exact bar durations, incl. 150 random parts).
- `pnpm --filter music-core bench` → `buildTab` on the synthetic dense 4-min part (3,960 notes): mean 17.1 ms, p99 25.0 ms (as_transcribed); 6.5 ms simplified. Budget 150 ms. (Vitest warns that module-runner getters add overhead; plain Node timing was ~16–20 ms.)
- P3 (`uv run python eval/p3_guitarset.py --guitarset ~/datasets/guitarset/annotation`, 360 excerpts, 62,476 notes): span compliance **100% (pass)**; agreement `as_played` **0.789** (comp 0.846, solo 0.636; held-out players 03–05: 0.747), `easiest` 0.596; lowest-fret baseline 0.454. **Gate ≥ 0.90: FAIL.** Not lowered; next steps in the report.
- `pnpm lint` (Biome 216 files, check-db-access, ruff), `pnpm typecheck` 13/13 (incl. pyright strict on `eval/`), `pnpm test --force` 14/14 (ml 56 incl. 7 eval tests), `pnpm contracts:check` up to date, `pnpm install --frozen-lockfile` ok, gitleaks pre-commit: no leaks.

**Known gaps**
- P3 gate not met (above). Basic Pitch → DP on GuitarSet audio not run (needs step 08's basic-pitch and the audio download); guitarist playability rating vs Guitar Pro 8 not done (needs people).
- Bass octave weights and bass fret weights untuned (no P2 bass set yet). Key estimation unbenchmarked (P6). Swing heuristic unvalidated.
- No CI regression gate on the bench (doc 07 asks for "fail if >20% slower than baseline"); machine-dependent, left for step 16.
- `chords_only` alphaTex shows rests with (optional) chord names, not strum slashes. MusicXML export not built (V11). Tempo changes are not written to alphaTex (external-media sync drives timing).
- Browser/Worker timing is step 12's to verify.

**For the next step**
- Step 06 (eval harness): absorb `services/ml/eval/tab_metrics.py` into the `splitune-eval` `tab` task; it already shells out to `node packages/music-core/src/cli.ts fret` (use `pnpm --silent` if going through pnpm — without it pnpm's banner corrupts stdout).
- Step 08 (finalize worker): call `buildTab(notes, beats, { notes, beats, chords, beatsRev }, { chords, level, fingeringMode, capo, tuningMidi })`; write `result.tab` and `result.alphaTex`. Calibration tables follow the `CalibrationTable` contract.
- Step 12: style notes via `noteMap` + `boundsLookup`; `tab.events[].unplayable` with/without string → "8va/8vb"/"!"; `residualFlagged` → dotted underline; chord strip uses `displayChords` + `chordDisplayName`.

## 2026-10-20 — Step 06: ML worker foundation, decode + beats, evaluation harness
Branch `impl/06-ml-worker` from `dev` (`f92c6a9`), commits `906f3ff` (contracts) and `dcc64ac` (worker + harness). On the owner's request, fast-forwarded into `dev` with subject-only messages (bodies and co-author trailers removed; trees unchanged). Not pushed.

**Built**
- `splitune_ml_core`: `settings` (pydantic-settings; `.env` + `.env.worker`, empty = unset), `db` (psycopg 3.3 pool as `ml_worker`), `queue` (README protocol verbatim + `enqueue` for scripts/tests), `worker` (1 MPS + 2 CPU slots, LISTEN + 5 s poll, 15 s job heartbeats, 30 s `worker_heartbeats` + `requeue_stale`, SIGTERM drains), `executor` (validation, cache, run, artefacts, one completing transaction), `artefacts` (contract validation, temp→copy, upsert), `keys`, `storage` (boto3), `island`/`islands` (JSON-lines RPC, warm subprocesses, allow-listed env), `backends` (islands; fixtures for `ML_MODE=mock`), `logs` (JSON, URL redaction), `devtools` (seed/request helpers for scripts and tests).
- `stage_decode` (ffprobe, f32le hash, pyloudnorm, 24-bit FLAC cache, `probe.json`) and `stage_beats` (beat_this 1.1.0, grid post-processing).
- Islands `services/ml/islands/{torch,onnx-cpu}` (own uv projects/locks/venvs). `legacy` not created.
- `services/ml/eval` → package `splitune-eval` (registry, codec simulator, predict, score for 6 tasks, reports); set `guitarset-mic-beats`; result `eval/results/beats/2026-10-20-guitarset-mic-beats.md`.
- `services/ml/deploy/com.splitune.ml-worker.plist`, `scripts/run_chain.py`, `scripts/bench_stages.py`. `.env.example`: `ML_DATABASE_URL`, `FFMPEG_BIN_DIR`, `ML_CACHE_DIR`, `ML_WORKER_ID`, `ML_MPS_SLOTS`, `ML_CPU_SLOTS`, `ML_TORCH_DEVICE` (appended to the local `.env`, with `FFMPEG_BIN_DIR=/opt/homebrew/opt/ffmpeg@8/bin`). CI: apt ffmpeg + island lock checks. `pnpm run setup` syncs the islands.
- Contracts 1.2.0: `Probe` artefact, `probe` kind, optional `StageRequest.cache_key`; music-core goldens restamped; storage accepts `probe.json`.
- Installed on the Mac (owner approved): Homebrew `ffmpeg@8` 8.1.3; beat_this final0/small0 checkpoints (torch hub cache); GuitarSet `audio_mono-mic.zip` (656 MB, md5 `275966d6…` matches Zenodo) unzipped to `~/datasets/guitarset/audio_mono-mic`.

**Deviations and decisions** (docs 00, 03, 05, 06, 08, 25 got step-06 notes; `packages/db/README.md` points at the Python queue)
- The worker computes cache keys (enqueuer can't know `audio_hash`); decode keys on the source file's sha256. Cross-analysis cache hits re-issue artefacts with a rewritten header instead of recomputing.
- `probe.json` is a new artefact kind (needed somewhere to persist ffprobe/loudness/audio_hash).
- Decoded FLAC stays on local disk (doc 25 §5); stages needing audio re-decode `inputs.source` when the cache entry is gone.
- Duplicate `(user, audio_hash, instrument)` on decode leaves the song unchanged and logs `duplicate_audio_hash` (step 09 decides what the API does).
- Island RPC models are Python-only (`stage_api.py`), not Zod contracts.
- Beats fallback: `params.model` = requested, `models[]` = what ran; status `fallback` with `beats_cpu_small` / `beats_mps_failed`. Octave ambiguity = mid-beat activation ≥ 0.5× on-beat, or BPM outside [75, 150).
- SDR: uSDR in numpy + optional cSDR from mir_eval BSS Eval v3 (deprecated in mir_eval 0.8); museval not added.
- After completing a job a slot wakes the others: dependents otherwise waited up to the 5 s poll (seen in the first chain run: 3–5 s gap).

**Verification**
- `cd services/ml && uv run ruff check` → all passed; `uv run ruff format --check` → 65 files formatted; `uv run pyright` → 0 errors (strict); `uv run pytest` → 115 passed (queue ×7, islands ×6, worker ×6 incl. real islands, recovery ×3, units, decode, beats grid/model incl. small0 and final0, eval ×16, contracts).
- `pnpm lint`, `pnpm typecheck` (13/13), `pnpm test --force` (14/14, run 3× green after fixes), `pnpm contracts:check`, `pnpm db:check`, `pnpm install --frozen-lockfile`, `uv sync --locked`, `uv lock --check` for both islands, `plutil -lint` on the plist. gitleaks pre-commit: no leaks.
- **Chain script** (`uv run python scripts/run_chain.py song-4min.m4a --runs 2` against `ML_MODE=local uv run splitune-ml-worker`, real island venvs, compose Postgres as `ml_worker` + SeaweedFS): run 1 8.5 s end to end — decode done (1.5 s, probe.json 812 B), beats done (final0, gpu_seconds 2.05, beats.json 48 KB), 4 job_events, objects in SeaweedFS; run 2 (same analysis) decode 0.06 s, beats 0.03 s, artefact rows unchanged (same sha256 and created_at) = cache hit.
- **Crash/requeue (manual, real worker):** SIGKILL of worker + islands while beats was running → job left `running`/attempt 1; restarted worker swept it 132 s after its last heartbeat (`stale jobs swept requeued [6]`), attempt 2 done, one `beats` and one `probe` row, events started/started/completed. Also automated in `test_recovery.py` (subprocess worker, killpg, 10 s stale threshold) plus lost-lock discard and SIGTERM-drains tests. Worker logs: 0 lines matching URL/secret patterns.
- **Harness** (`uv run splitune-eval predict --task beats --set guitarset-mic-beats --out $PRED/final0-mps`, then `score --task beats ...`): metric variant "mir_eval 0.8.2 beat.evaluate, F-measure ±70 ms, beats before 5 s trimmed". F-measure final0/MPS **0.775** (comp 0.944, solo 0.606), downbeat F 0.616; small0/CPU 0.732; final0 after AAC-128 round-trip 0.779. beat_this trained on GuitarSet comping tracks → comp in-sample; solo is the fair number. No gate.
- **Timing on the Mac (M4, 16 GB), 4-min AAC 256k song, island processes** (`scripts/bench_stages.py --runs 4`): decode 1.32 s cold / 0.76 s warm; beats final0 MPS 2.93 / 1.45 s; final0 CPU 3.30 / 2.61 s; small0 CPU 2.33 / 1.83 s.

**Known gaps**
- One `pnpm test` run failed `test_killed_worker_job_is_requeued_and_completes_once` under parallel turbo load; the failure output was lost. Suspected: 3 s stale threshold vs 0.5 s heartbeats under load. Widened to 10 s; 3/3 green under parallel db/api tests and 3 full suites green since. Root cause not confirmed.
- launchd agent not installed/loaded on the Mac (template linted and rendered only). CI not run on GitHub (no push); its apt ffmpeg is older than 8.1 and the model tests download checkpoints in CI.
- Not built: `manifest.json` updates, analysis status/progress, SSE NOTIFY for job_events (step 09); local cache eviction; sweeper for orphaned `.tmp/` objects; `legacy` island; listening-test app; regression suite; museval cSDR.
- Railway Postgres/Bucket not exercised (compose only).

**For the next step**
- Enqueue stage jobs with `jobs.kind` = stage name, `runner = 'python'`, payload = `StageRequest` without `cache_key`: decode `inputs {source: raw key}`, `outputs {probe: u/{u}/a/{a}/v{n}/probe.json}`; beats `inputs {source, probe}`, `outputs {beats: …/beats.json}`; beats `depends_on` decode. `devtools.stage_request` shows the shapes. Output keys must be under the analysis prefix and match the stage's output names exactly.
- New stages: add a `StageSpec` in `splitune_ml_core/stages.py`, a `stage_<x>.stage` module with `describe(params)`/`run(job)` working on local files, the package to the right island's pyproject, and the artefact kind to `artefacts.SCHEMAS` if it's new.
- Run the worker: `cd services/ml && ML_MODE=local uv run splitune-ml-worker` (or the launchd plist). Tests/CI use `ML_ISLAND_PYTHON` instead of the island venvs.
- Eval: `uv run splitune-eval sets|codec|predict|score`; register sets in `eval/sets/*.yaml` with licence + provenance.

## 2026-10-21 — Step 07: Separation stage, stem post-processing and Prototype 1 (partial: P1 ratings pending)
Branch `impl/07-separation` from `dev` (`dcc64ac`): `651c507` (contracts), `f71e23f` (stages), `2bf7ef8` (listening app), `66f978c` (P1 tooling). On the owner's request, fast-forwarded into `dev` with subject-only messages (no bodies or co-author trailers). Not pushed.

**Built**
- Contracts 1.3.0: `Tags` (`tags.json`) and `Separation` (`separation.json`) artefacts, named `InstrumentSubtype`; storage accepts both keys; music-core goldens restamped.
- `tag` (onnx-cpu): PANNs Cnn14 → ONNX (`scripts/export_tagger.py`), 10 s windows, top-quarter mean; missing weights → `fallback`/`tagger_unavailable`.
- `separate` (torch/MPS): python-audio-separator 0.44.5 wrapper (`stage_separation.models`), per-instrument fallback chain from `services/ml/config/separation.personal.yaml`, weights verified against `compliance/register/models/*.yaml` (new register: 5 separation models, PANNs, MUSDB18-HQ dataset record). Raw stems to `<ML_CACHE_DIR>/separated/`. Total failure → `stems_unavailable` (permanent).
- `stem_post` (onnx-cpu): alignment, mix-minus (subtract | complement per instrument), activity/presence with tagger veto, loudness gains, AAC encode (AudioToolbox `afconvert`, ffmpeg fallback) + optional Opus, server-side length/offset verification, `stems.json` + `presence.json` + stem blobs.
- Worker: `StageOutput.blobs` (uploaded before JSON, copied on cross-analysis cache hits), `describe(params, inputs)`, `StageSpec.reuse_fallback`, `ML_MODELS_DIR` / `ML_SEPARATION_CONFIG` settings, devtools/run_chain support for the separation graph.
- Browser decode check `services/ml/browser/decode-check.spec.ts` (`pnpm --filter @splitune/ml e2e`; Playwright 1.64.0, Chromium + WebKit; `DECODE_CHECK_DIR` + `scripts/fetch_stems.py` for real analyses).
- `apps/listening`: blind, resumable rating app (Hono, plain page, Postgres schema `listening`, byte-range media for Safari).
- P1 tooling: `eval/p1_musdb.py` (MUSDB18-HQ windows by HTTP range reads from Zenodo), `eval/p1.py` (codec/separate/energies/select/export/sdr/report), set `eval/sets/musdb18hq-p1.yaml` (20 clips: guitar 8, piano/keys 4, vocals 3, bass 3, drums 2), `scripts/bench_separation.py`.
- Installed on the Mac (owner approved): separation weights 2.5 GB + PANNs 312 MB under `~/.cache/splitune/models`; MUSDB18-HQ test windows (50 × 30 s, all stems) + one full song under `~/datasets/musdb18hq-p1`; Playwright WebKit 2370.

**Deviations and decisions** (notes added to docs 00, 05, 06, 08)
- SCNet XL and MSST 53-stem: not in audio-separator (any version); skipped (owner agreed). EfficientAT replaced by PANNs (no packaged model code). MoisesDB not used (sign-up).
- audio-separator 0.44.5 needs librosa 0.11 (pinned) and audioread; default 0.9 peak normalisation disabled; `_separate_file` used because `separate()` swallows exceptions.
- PANNs scores on mixes are low/uncalibrated → tagger is a veto only (`keep_min_prob` 0.01).
- AAC via AudioToolbox: only encoder whose files decode sample-exact in both Chromium and WebKit; ffmpeg AAC exact in Chromium only. Opus off by default (Chromium 22 samples early).
- Listening data in a separate `listening` Postgres schema created by the app, not a product migration.
- Bug found during P1 and fixed (regression test added): a warm audio-separator model kept the first run's output directory, so later jobs in the same island would have produced silent stems.

**Verification**
- `pnpm lint`, `pnpm typecheck` (13/13), `pnpm test --force` (14/14; ml 148 passed incl. model tests: fallback to htdemucs_6s, warm-model regression, real-island chain decode → tag → separate → stem_post with stems in SeaweedFS, total failure → `stems_unavailable` + `stem_post` cancelled), listening 10/10, contracts 45/45, storage 37/37.
- `pnpm --filter @splitune/ml e2e` → 12 passed (AAC exact length + offset 0 in Chromium and WebKit; Opus ±1 in WebKit; Chromium Opus marked expected failure).
- `pnpm contracts:check`, `pnpm db:check`, `uv lock --check` (root + both islands), `pnpm install --frozen-lockfile`, gitleaks: clean.
- `uv run pytest -k "separate or stem_post or tag"`: covered by the runs above (not run separately).
- Bench, 4-min song (244.5 s, MPS, M4 16 GB): htdemucs_6s 51 s warm (4.8× RT, 3.5 GB MPS); htdemucs_ft 179 s; BS-Roformer-SW 187 s (1.3× RT); BS-RoFormer viperx 575 s; Mel-RoFormer Kim 402 s. Per 30 s clip: SW ~25 s, 6s 7 s, ft 29 s, viperx 46 s, Kim 25 s.

**Known gaps**
- **P1 not finished:** session `p1-2026-10-21` exported (122 ratings + 56 pairs) but not rated; no report in `eval/results/p1/`, model map is provisional (not chosen by listening), `sdr`/`report` commands untested against real data.
- **Time budget:** RoFormers run with audio-separator's default `overlap=8`; viperx (575 s) is near the 600 s per-model budget, Kim + fallback can exceed the 1500 s stage timeout, SW alone uses the 3-min full-analysis target. Proposed fix (not done): per-model overlap in the map, sweep 2/4/8 on the 20 clips by SDR + time, then re-export the listening session — rate only after that.
- Real-song end-to-end run with `run_chain.py --separation` + browser check of its stems not done (only synthetic audio in the automated chain test).
- Local `separated/` cache grows without eviction; raw stems gone → `stem_post` fails `separated_audio_missing` until `separate` re-runs. Railway not exercised.

**For the next step**
- Enqueue `tag` (inputs source, probe), `separate` (params `{instrument}`, inputs source, probe, tags) and `stem_post` (inputs source, probe, separation, tags); see `devtools.stage_request`. Stem files are `stems/<stem_id>.m4a` next to `stems.json`.
- Notes/chords consume isolated stems (`kind: isolated`) and the `drums`/`bass` extras; `stems_unavailable` means run on the mixture (step 09 partial-failure rules).

## 2026-10-21 — Step 07b: Separation inference settings and time budget
Branch `impl/07b-separation-overlap` from `dev` (`66f978c`): `af218f7` (offline chain test), `041ecdc` (settings mechanism + P1 sweep tooling), `f1c7742` (chosen settings + report). On the owner's request, fast-forwarded into `dev` with subject-only messages (no bodies or co-author trailers). Not pushed.

**Built**
- Model map: each model has `arch` (`mdxc` | `demucs`) and optional `inference` (validated per arch, unknown keys rejected) overriding single keys of audio-separator's `mdxc_params` / `demucs_params`; library defaults read from `Separator`'s signature for the rest.
- `stage_separation.models`: settings passed to `Separator`; the warm model reloads when its settings differ.
- `separate`: the chain's settings are in the effective params (`plan`/`describe` → cache key) and in the raw-stem `run_id`.
- `eval/p1.py`: `separate --tag T [--inference KEY=VALUE]` writes to `runs-<T>/`; `sdr --tag T` scores it (`results/p1/sdr-<T>.csv`) and prints s/clip.
- Chosen settings (P1, cheapest within 0.3 dB median uSDR of the default): htdemucs_6s/ft `shifts: 1`, Kim `overlap: 11`, SW `overlap: 9.3`, viperx default. Report: `services/ml/eval/results/p1/2026-10-21-overlap.md`.

**Deviations and decisions**
- The premise that MDXC `overlap=8` was the cost driver was wrong: for RoFormers it is the window step in seconds, capped at the chunk length (`mdxc_separator.py`, `demix`). 8 is already near-cheapest; 4 and 2 cost 2× / 4×. Swept 8 (default), step = chunk (SW 9.3, Kim 11) and 4 as a quality reference; skipped 2 (4× cost, can never be chosen). Demucs `shifts` 1 vs 2 as asked.
- Step 07's 575 s for viperx did not reproduce: 269 s and 313 s today at the same settings; run-to-run variance on the Mac is about ±15% (Step 07 numbers were likely taken under other load). Defaults were re-run today so the sweep's times compare like with like.
- Listening session re-exported as **`p1-2026-10-21b`** (new settings), not over `p1-2026-10-21`: the owner had already rated 34 of 122 items in the old session (Postgres `listening.ratings`, last 2026-10-21 00:02 UTC); those ratings are untouched. `~/datasets/musdb18hq-p1/runs/` now holds the chosen settings' runs (APFS clones of the sweep dirs); the Step 07 runs are kept in `runs-step07/`.
- Fixed a flaky test from step 07: `test_real_chain_skips_missing_weights_and_runs_htdemucs_6s` built a models dir without `download_checks.json`, so audio-separator downloaded it from GitHub on every run and the test failed (`separation_failed`) without network. Reproduced with an unreachable proxy; it now links the file and passes offline.
- Incident: while checking the listening app I hit `EADDRINUSE` on :4100 (the owner's running listening server) and my cleanup killed that server. No data lost (ratings persist per answer; 34 still present). It needs restarting by the owner.

**Verification**
- `cd services/ml && uv run ruff check && uv run ruff format --check && uv run pyright && uv run pytest` → all clean; pytest 152 passed (incl. `models`-marked tests; new: settings passed to the Separator over library defaults, cache key + run id change with settings, warm model reloads on a settings change, validator rejects unknown / foreign / out-of-range keys).
- `pnpm lint` (1/1), `pnpm typecheck` (13/13), `pnpm --filter @splitune/ml e2e` → 12 passed.
- Sweep on the 20 P1 clips and full-song bench: see the report. Full song, new settings, warm: 6s 33 s, ft 97 s, SW 181 s, viperx 313 s, Kim 136 s. Every model ≤ 600 s; worst chain + fallback (vocals, cold) 468 s ≤ 1500 s stage timeout. SW's expected −13% on songs is within run-to-run noise (default 204 s warm / 160 s cold in the same session) and not confirmed.
- Listening app on `p1-2026-10-21b` (port 4101): page 200, media byte-range 206 `audio/mp4`.

**Known gaps**
- **3-min full analysis (25 §5) is not met** when BS-Roformer-SW heads the chain (guitar, piano, bass, drums): separation alone ≈ 180 s. Inference settings can't close it. Options for the owner: relax the target for full-quality separation, use htdemucs_6s (33 s; −2 to −4 dB uSDR) as a fast first pass with SW as a background upgrade, or let P1 listening decide whether 6s is good enough for some instruments.
- P1 ratings still pending: rate `p1-2026-10-21b`, then `eval/p1.py report --session p1-2026-10-21b`.
- Demucs `shifts: 1` keeps a random offset, so its stems are not bit-identical across runs (same as the default `shifts: 2`).

**For the next step**
- Step 08 should run P2 ("stems vs mixture") only after this branch is in `dev`, so stems use the new settings.

## 2026-10-21 — Step 09b: Object storage moves to Cloudflare R2 (repo + docs; Cloudflare setup by the owner)
Branch `impl/09b-r2-storage` from `dev` (`705ab08`), in the worktree `../Splitune-r2` so step 09's uncommitted work stays put. Commit `2514196` (subject only, on the owner's request), fast-forwarded into `dev`. Not pushed.

**What was built**
- Owner approved amending "no new paid services" to allow the Cloudflare R2 free tier. The Railway `production` environment was still empty (no bucket), so nothing had to be migrated.
- `infra/r2/cors.json`: GET/HEAD/PUT from the app origin only (`<app>` placeholder until the Railway domain exists), `content-type` and `range` request headers, exposes `ETag` (browser returns part ETags to `uploads.complete`) and `Content-Length`/`Content-Range`/`Accept-Ranges`, preflight cache 1 h.
- Comments and examples only, no behaviour change: `.env.example` (R2 production values), `packages/storage` (`s3.ts` header, `package.json` description), `splitune_ml_core/storage.py` (docstring, checksum comment), `infra/docker-compose.yml` (SeaweedFS stands in for R2), `CLAUDE.md` (topology and "ask before billable Railway or Cloudflare resources").
- Docs: `25` (front matter, intro, TL;DR, §1 storage row, §5 diagram and worker trust with two bucket-scoped tokens, §6 R2 setup with `cf` commands and `S3_*` values, §7, open questions, sources), `README` rule 1 and doc index, banners in `00`, `01`, `02` (repo tree adds `infra/r2/`), `17` (token revocation, CSP adds `*.r2.cloudflarestorage.com` to `connect-src`/`media-src`), `19`, `20`, and a personal-mode note on R2 lifecycle in `03`.

**Deviations and decisions**
- Lifecycle: no rules added. R2's default 7-day abort of incomplete multipart uploads stays; the sweeper keeps doing all expiry (raw uploads and `video.mp4` are kept, stem expiry needs `last_opened_at`).
- One bucket and two R2 API tokens (one for `app`, one for the Mac) instead of a shared key, so a lost Mac's token can be revoked alone.
- `cf` 1.0.0-beta.20 commands in `25` §6 were checked with `--dry-run` only (`cf r2 buckets create --name … --location-hint …`, `cf r2 buckets cors update … --rules @infra/r2/cors.json`).

**Verification**
- `biome check` on `infra/r2/cors.json`, `packages/storage/src/s3.ts`, `packages/storage/package.json` → clean; `ruff check` + `ruff format --check` on `storage.py` → clean; `gitleaks dir` on the worktree → no leaks; `docker compose -f infra/docker-compose.yml config -q` → ok.
- Not run: typecheck and test suites (the change is comments and a new JSON file; the worktree has no `node_modules`). Nothing has run against R2 yet.

**Cloudflare setup (done by Claude on the owner's request, 2026-10-21)**
- R2 was already enabled; an empty private bucket `splitune` (APAC) existed. Created `splitune-media` (`--location-hint apac`, Standard, r2.dev off, only the default 7-day multipart abort) to match the committed config; `splitune` left untouched.
- Token `splitune-mac-workers`: account token with Workers R2 Storage Bucket Item Read + Write on `splitune-media` only; S3 credentials (key ID = token id, secret = SHA-256 of the token value) written to `.env.r2` (gitignored, mode 600). Nothing loads it yet — `.env.worker` would redirect local-dev workers to R2.
- `S3_*` from `.env.r2` + `pnpm --filter @splitune/storage test` → 38 passed, 1 failed: `denies a GET without a signature…` expects 403, R2 returns `400 InvalidArgument` ("Authorization"). A direct probe showed the expired presigned GET is `403 ExpiredRequest` (the test never reached it). Signed content-type/content-length mismatches → 403, multipart 5+5+2 MiB and `deletePrefix` pass. Test not changed. Bucket empty afterwards.

**Known gaps**
- Railway `app` doesn't exist yet, so no `app` token and no CORS rules (they need the app domain); browser preflight not checked.
- The SeaweedFS-specific 403 assertion above (owner's call whether the test should accept 400 or 403).
- Local SeaweedFS still has no CORS, so browser uploads in local dev will need the same `ETag` exposure once the web app exists (`infra/seaweedfs`).

## 2026-10-21 — Step 09: Analysis orchestration, SSE progress and URL import
Branch `impl/09-orchestration-url-import` from `dev` (`705ab08`), rebased onto `2514196` (R2 storage) and, on the owner's request, fast-forwarded into `dev` with subject-only messages (no bodies or co-author trailers): `d983c86` (contracts), `32f986d` (db), `5a4f3e9` (node worker), `691b4a2` (ml), `025bfed` (api), then `7328508` (fix: job event ids in commit order, migration `0007`) and `ab0a6cc` (test: recovery test race). Not pushed. (Step 08 has no entry of its own in this log.)

**Built**
- **Graph** (`apps/api/src/pipeline.ts`): full `decode → {beats, tag} → separate → stem_post → {chords, notes.<i>} → finalize`, lite `decode → beats → chords (mixture) → finalize`, URL imports prepend `url_import`; enqueued with the analysis row in one transaction (`analyses.create` / `createWithSong`). Notes stage only for guitar/bass/vocals (others: chords-only finalize); tab/render outputs for guitar/bass.
- **Partial failure:** new `jobs.soft_depends_on` (finished, not necessarily succeeded; no cancellation cascade) in the TS and Python queues + README protocol. Soft: tag → separate/stem_post, stem_post → chords/notes, everything → finalize. Optional inputs count only when an artefact row records them (Python executor + finalize). `stage.failed.fallback` from `StageSpec.failure_fallback`. Finalize always runs last and decides `done`/`partial`/`failed` (no recorded beats → analysis `failed`, finalize `skipped`).
- **Endpoints:** `POST /v1/analyses` (idempotent per source/instrument/type/pipeline; 409 `source_not_ready`), `GET /v1/analyses/{id}` (stages from stage runs + jobs), `POST /v1/analyses/{id}/rerun` (next version, `Idempotency-Key`), `GET /v1/analyses/{id}/events` (SSE), `GET /v1/artefacts/{id}/url` (+ `stem_id`/`variant`), `POST /v1/songs/import-url`, `GET /v1/system/worker-status`. Rate limit `analyses` 30/h. `admitAnalysis()`/`entitlements()` hook (plan as /v1/me computes it → Free today; Plus priority 50 vs 100; Free full = `welcome`).
- **Lite → Full upgrade:** a new analysis reuses decode + beats of the song's latest finished analysis (`analyses.base_analysis_id`; `stage.completed` events for them written at creation; their artefacts listed in the new analysis) and enqueues only the missing stages. Reruns never reuse (the worker's cache keys decide what recomputes).
- **SSE:** oRPC event iterator, ids = `job_events.id`, `Last-Event-ID` replay, 15 s keep-alive, ends on `analysis.done`; `job_events` insert trigger → `NOTIFY job_events`; `EventHub` holds one LISTEN connection only while streams exist; 5 s poll fallback.
- **Worker presence:** `analysis.waiting { reason: queued_waiting_for_worker, runner }` at creation and from open streams (one per stall); `/v1/system/worker-status`.
- **URL import** (`services/ml/packages/stage_url_import`, onnx-cpu island): yt-dlp 2026.8.19 + yt-dlp-ejs 0.8.0 pinned, Deno (`brew install deno`, owner approved), one metadata extraction then audio (≤500 MB) and optional video-only ≤720p H.264 MP4 (≤750 MB) to `u/{user}/raw/{import_id}/source.bin|video.mp4`; ≤20 min; site extractors only; URL read from `songs.source_url`; title (and artist when present) stored on the song; song `importing → analysing`.
- **Deletion:** song delete cascades its jobs and enqueues `delete_prefix` now and again after 30 min; node worker implements `delete_prefix`.
- Python executor also sets `analyses.status = running`, writes `progress` events, and NOTIFYs the runners of queued dependants when a job finishes (finalize no longer waits for the node worker's 5 s poll: chords→finalize gap went from 3–4 s to <1 s).
- Contracts: `AnalysisWaitingEvent`, `StageFailedEvent.fallback: MachineCode`, `WorkerStatus`, `ArtefactUrlInput.stem_id`; JSON Schema + Pydantic regenerated. Storage: `rawVideoKey`. Migrations `0005` (generated) and `0006` (trigger, policies, `app_owns_analysis()`, worker `UPDATE (title, artist)`).

**Deviations and decisions** (step-09 notes added to docs 00, 01, 03, 04, 06, 25)
- Idempotency key uses the upload id (or URL import id) instead of `audio_hash` (unknown before decode), and includes the analysis type. A repeated POST after a failure returns the failed run; retry is `rerun`.
- `url_import` doesn't enqueue the analysis itself: the whole graph is enqueued behind it at import time (decode hard-depends on it), so the graph lives in one place (TS) and the client sees every stage from the start.
- `invalid_input` issues are `{ path, code }` (was `{ path, message }`): error details carry codes only. `ErrorEnvelope.message` remains the contract's English log text (doc 27: never rendered); the codes-only test exempts that one field.
- Workers got write-only `UPDATE (title, artist)` on songs (still no SELECT on titles).
- `tsconfig.base.json` `erasableSyntaxOnly: true`: the step-08 node worker crashed at start under plain Node (TypeScript parameter properties aren't strippable); its `NodeWorker` and `StageError` (and my new `EventHub`) now use plain fields. Its tests passed only because Vitest transpiles.
- The main checkout's torch island venv was never synced after step 08 (step 08 ran in `../Splitune-08`), so the first real runs failed chords with `ModuleNotFoundError: stage_chords`; fixed with `uv sync --locked --project islands/torch` (run `pnpm run setup` after switching checkouts).
- The test URL is a CC-BY video chosen by me at the owner's request: `https://www.youtube.com/watch?v=h_N0-H49R6I` ("Indie Rock - Breathe In Breathe Out", BLULIGHT GALLERY; YouTube metadata `license`: Creative Commons Attribution).

**Machine codes for step 10** (UI maps them to `analysis.reason.{code}` / `import.*`; unknown → `analysis.failed`). "Charged" is the rule step 14 must implement (23 §2/F5: failed or fallback-only runs never count); nothing is charged yet.

| Code | Where | When | Charged |
|---|---|---|---|
| `queued_waiting_for_worker` | `analysis.waiting.reason` | runnable jobs, no heartbeat < 2 min for their runner | — |
| `source_not_ready` | 409 `conflict` `details.reason` | POST /v1/analyses before the upload completed | no run |
| `done` / `partial` / `failed` | `analysis.done.status` | finalize's verdict | done: yes · partial: yes unless the run lost what was paid for (full + `stems_unavailable`; lite + `chords_unavailable`) · failed: no |
| `tagger_unavailable` | `stage.failed.fallback` (tag) or `tags.fallback_reason` | tagger failed / weights missing; stems assume every instrument present | yes |
| `stems_unavailable` | `stage.failed` error_code + fallback (separate, stem_post) | every model in the chain failed / stem post-processing failed; chords and notes run on the mixture | no (full) |
| `chords_unavailable` | `stage.failed.fallback` (chords) | chords failed; tab without chord strip | full: yes · lite: no |
| `notes_unavailable` | `stage.failed.fallback` (notes.*) | transcription failed; chords-only view | yes |
| `notes_on_mixture` | notes `fallback_reason` | no stem for the instrument; mixture transcribed | yes |
| `beats_cpu_small`, `beats_mps_failed` | beats `fallback_reason` | CPU small model used | yes |
| `separation_fallback_model` | separation `fallback_reason` | a later model in the chain separated | yes |
| `video_unavailable` | url_import `fallback_reason` (stage status `fallback`) | no ≤720p MP4 video; audio imported | — |
| `url_unsupported` | 422 on import-url; `stage.failed` (url_import) | IP/local host; no site extractor; live stream | no |
| `url_download_failed` | `stage.failed` (url_import) | private/removed/region-locked (permanent) or network/timeout after 3 attempts | no |
| `too_long` | `stage.failed` (url_import, decode) | > 20 min | no |
| `file_too_large` | `stage.failed` (url_import) | download over the size cap | no |
| `unsupported_media`, `audio_empty`, `decode_failed`, `decode_timeout`, `input_too_large`, `input_missing` | `stage.failed` (decode) | ffprobe/ffmpeg refused the file, silent, too big, raw object gone | no |
| `beats_not_found` | `stage.failed` (beats) | fewer than 2 beats | no (analysis fails) |
| `dependency_failed` | job/stage `error_code`, stage `skipped` | cancelled because a hard dependency failed | — |
| `lock_expired` | job `error_code` | worker stopped heartbeating; re-queued or failed | — |
| `internal_error`, `stage_timeout`, `island_crashed` | `stage.failed` after 3 attempts | unexpected crash / timeout | no |
| `invalid_request`, `analysis_missing`, `unsupported_stage`, `stage_output_missing`, `island_missing`, `invalid_params`, `decoded_audio_missing`, `decoded_audio_mismatch`, `separated_audio_missing`, `separation_config_missing`, `register_record_missing`, `register_record_invalid`, `encode_failed`, `encode_verification_failed`, `key_estimation_failed`, `node_missing`, `ffmpeg_missing`, `beats_missing`, `artefact_invalid`, `artefact_incompatible` | `stage.failed` | operator/setup problems; UI shows `analysis.failed` (or the stage's fallback banner) | no |
| `weights_missing`, `weights_mismatch`, `separation_oom`, `separation_failed`, `separation_output_invalid` | `separation.failed_attempts[]` only | one model of the chain failed (the next one ran) | — |
| `invalid_input` issue codes: Zod issue codes, `invalid_cursor`, `part_out_of_range`, `parts_incomplete`, `parts_mismatch`, `variant_needs_stem_id`, `not_a_stems_artefact` | error `details.issues[].code` | field problems | — |

**Verification**
- `pnpm lint` → exit 0 (Biome 261 files, no infos; check-db-access; ruff). `pnpm typecheck --force` → 14/14 (with `erasableSyntaxOnly`). `pnpm contracts:check` → up to date. `pnpm db:check` → match. `uv lock --check` (root, onnx-cpu, torch) → ok.
- `pnpm --filter @splitune/api test` → 11 files, **95 passed**, incl. `test/pipeline.test.ts` (acceptance, `ML_MODE=mock`, real worker processes: upload via presigned parts → POST /v1/analyses with the Mac offline → SSE `analysis.waiting` → workers started → every stage in dependency order → `analysis.done` → every artefact URL downloads JSON valid against its contract, every stem URL downloads MP4 audio → song `ready` → DELETE removes all objects via the node worker's `delete_prefix`; URL import → `Mock import` title), `test/analyses.test.ts` (graphs and edges, idempotency, Lite, piano, upgrade reuse, rerun versions + Idempotency-Key, import-url incl. refused local hosts and re-download, worker status, SSE replay/resume/NOTIFY < 2 s/waiting/deletion end, artefact + stem URLs, deletion of queued jobs + two cleanup passes, **codes-only test over every job event and over error envelopes**), extended authz matrix and OpenAPI.
- `pnpm --filter @splitune/node-worker test` → **24 passed** (delete_prefix incl. refusals, Lite profile, no-beats → failed analysis, song status).
- `pnpm --filter @splitune/db test` → **97 passed** (soft dependencies, analyses repo, base-analysis RLS).
- `cd services/ml && uv run pytest -k url_import` → **11 passed, 1 skipped** (the opt-in live test, `SPLITUNE_LIVE_URL_IMPORT=<url>`; not run separately — the real-mode run below covers a live download). Whole ML suite: 190 passed, 1 skipped, **1 failed**: `test_local_chain_transcribes_and_recognizes_chords` — pre-existing on `dev` (reproduced unchanged in `../Splitune-08` at `705ab08`): the synthetic click track's bass is too quiet for the tagger, so the bass extra is vetoed and notes.bass runs on the mixture. Not fixed (out of scope). `test_recovery.py::test_killed_worker_job_is_requeued_and_completes_once` failed once in one of two parallel full runs (the step-06 flake), 9/9 alone.
- **Real mode on the Mac (M4, 16 GB)**, standalone API + `ML_MODE=local` ML worker (MPS) + node worker, compose Postgres/SeaweedFS, driven through the HTTP API (magic-link sign-in, presigned upload, SSE). Wall-clock per stage = stage run `started_at → finished_at`; total = POST → `analysis.done` on the stream.

| Stage | 4-min song (MUSDB "Mallory", 244.5 s, AAC 256k upload) | YouTube URL (281.8 s) |
|---|---|---|
| url_import (metadata + audio 4.6 MB + video 71 MB) | — | 15.8 s |
| decode | 2.1 s | 1.0 s |
| beats (final0, MPS) | 3.8 s | 2.1 s |
| tag | 6.3 s | 6.5 s |
| separate (BS-Roformer-SW, MPS) | 139.5 s | 161.8 s |
| stem_post | 10.2 s | 10.7 s |
| notes.guitar | 3.2 s | 4.3 s |
| chords | failed ×3 (`ModuleNotFoundError`, unsynced torch island) → partial | same → partial |
| finalize | 0.1 s | 0.1 s |
| **total** | **210.4 s** (incl. ~48 s of chords retries/backoff) | **250.4 s** |

  After syncing the island, reruns of both (cache hits for every unchanged stage) finished `done`: chords 9.7 s / 6.2 s, totals 15.2 s / 10.1 s; with the dependant NOTIFY, 8.2 s (finalize starts the second chords completes). Estimated fresh full run of the 4-min song with working chords ≈ 158 s + ~10 s ≈ **170 s** (estimate, not measured end to end): separation dominates and the 3-min target only just holds (see 07b).
- Worker offline: covered by the acceptance test (queued, SSE waiting, resumed on start). Cancelling via deletion: covered by the acceptance and analyses tests.

- **Found while merging:** under parallel test load the acceptance test lost a `stage.completed:beats` event. Concurrent worker transactions committed job event ids out of order (N committed after N+1 had been streamed), so SSE paging by id skipped N. Migration `0007` takes the analysis row lock (held to commit) before assigning the id; a db test pins it (and fails with the lock removed). After it, 3/3 parallel full runs green apart from the pre-existing chords-chain test.
- `test_recovery.py::test_killed_worker_job_is_requeued_and_completes_once` (the step-06 flake) killed the worker when the beats job read `running` — true from the claim on, before `stage.started` commits; it now waits for the `stage.started` event. 3/3 parallel runs green.

**Known gaps**
- No end-to-end fresh real-mode run with chords succeeding (global stage cache makes a second run of the same audio a cache hit).
- Video URL for the practice screen: there is no endpoint yet; the video key is `outputs.video` of the song's done `url_import` job (step 10/12 should add one, e.g. on the song detail). The raw sweeper (step 15) must keep `video.mp4`.
- Allowances/charging (step 14), sweepers (step 15). `Idempotency-Key` is used by rerun only; import-url creates a new song per call.
- A job failed by `requeueStale` (crash loop) writes no `stage.failed` event (pre-existing); finalize still runs because it soft-depends on it.
- Railway not exercised (local compose only).

**For the next step**
- Client: POST /v1/analyses or import-url → open `GET /v1/analyses/{id}/events` (EventSource resumes with Last-Event-ID) → on each `stage.completed` with an artefact, `GET /v1/artefacts/{id}/url` (stems: `?stem_id=<id>&variant=aac_mp4`) → `analysis.done`. Show `analysis.queued_offline` on `analysis.waiting`, the stage list from `GET /v1/analyses/{id}`.stages, and map `stage.failed.fallback` / `error_code` with the table above.
- Before real runs in any checkout: `pnpm run setup` (or `uv sync --locked --project islands/torch|onnx-cpu`) and `pnpm db:migrate`.

## 2026-10-21 — Step 10a: Design system, UI kit and Storybook

Branch `impl/10a-design-system` (from `dev` at `4dd448d`).

**Built**
- **`packages/ui-tokens`** (hand-authored CSS + typed metadata): `primitives.css` (12-step OKLCH `--gray`/`--indigo` ramps for Light, Dark and Stage, paper/ink, status and stem bases), `themes.css` (`[data-appearance=light|dark|stage]`, `:root[data-contrast=more]`, `prefers-color-scheme` / `prefers-contrast` fallbacks for no-JS, forced-colours mapping), `theme.tailwind.css` (`--color-*: initial` and the other default scales cleared; type steps with weights; `--read-*` per distance preset with Stage ×1.25 and calibration; `--target-*` incl. `control` that follows `data-density`; durations/easings; z-layers; `@theme inline` semantic mapping; `dark`/`practice`/`stage`/`contrast-more` variants; base focus outline 2 px / 3 px; unlayered reduced-motion reset), `fonts.css` (Inter roman/italic, Atkinson Hyperlegible Next, metric-matched `Inter Fallback`), `index.ts` (token name lists, `CONTRAST_PAIRS`, `STEMS`, `CONFIDENCE`, `readToken()`, `readColor()` → rgba for canvas/alphaTab).
- **Token tests** (`pnpm --filter @splitune/ui-tokens test`, 648): `contrast.test.ts` (every `CONTRAST_PAIRS` entry in Light/Dark/Stage × normal/more, PedalHud text over its translucent backdrop, sRGB gamut of every colour role, and the §4.6 table ±0.1), `palette.test.ts` (stems ≥12 ΔE2000 for normal vision and Machado-2009 protan/deutan/tritan, every context), `tokens.test.ts` (every role in every appearance and nothing else, ramps complete, semantic → primitive, component tokens never → primitive, the no-JS dark block identical to the Dark block, fallbacks resolve like the attributes, increased contrast changes what it should, reading sizes). They evaluate the real CSS with a small cascade model (`src/testing/cascade.ts`) that throws on any selector/at-rule it doesn't model.
- **Fonts**: `scripts/fonts/subset.sh` (pinned SHA-256 inputs, fonttools 4.67.0 via `uvx`, `--layout-features='*'`, `SOURCE_DATE_EPOCH` so output is byte-identical between runs) → `apps/web/public/fonts/` with both OFL licences. **Font binaries are committed as third-party assets** (not build output). Sizes: InterVariable.woff2 **76,408 B** (preloaded; ≤80 KB), InterVariable-Italic.woff2 82,992 B, AtkinsonHyperlegibleNext.woff2 33,696 B.
- **`apps/web` UI scaffold** (no routes): Vite 8 + React 19.3 + Tailwind v4 (`app/styles.css` imports tailwind, tw-animate-css, `shadcn/tailwind.css` for the Base UI `data-*` variants, then the tokens), `@/` → `app/`, `components.json` (`base-nova`, Base UI, aliases into `app/ui`), `app/ui/display.ts` (`DisplayPreferences`, `DISPLAY_STORAGE_KEY = 'splitune.display'`, `applyDisplay()` and the inline `DISPLAY_SCRIPT` built from it).
- **Base components** in `app/ui/` (CLI-generated, then rewritten to tokens/targets): Button (primary/secondary/outline/ghost/destructive/link; sm/md/practice/practice-2 + icon sizes; loading after 300 ms keeping width and name), Toggle, ToggleGroup, Slider (horizontal/vertical/range, thumb labels, control-size hit area, largeStep 10), NumberField (new, Base UI), Dialog, AlertDialog, Drawer (also covers Sheet), Popover, Tooltip (+ shortcut keys, `WithTooltip`), DropdownMenu, Select, Tabs, Switch, Checkbox, RadioGroup, Field/Input/Label, Progress, Meter (new, Base UI), Badge, Card, Skeleton, Toast (actions never auto-dismiss), Separator, ScrollArea, Kbd, Spinner.
- **Kit**: TransportButton, SpeedControl, LoopBadge, PassControl, ChordChip, ConfidenceLegend, StemRow (+ skeleton), MixPresetGroup, PedalHud, StageList, SongCard/SongRow, AllowanceMeter, EmptyState, InlineError, Banner, WorkerStatus; custom icons (pedal, capo, tab staff, chord box, count-in, minus-one, your part) via `createLucideIcon`; `BrandMark`/`Wordmark`; static `public/icons/icon.svg`, `icon-maskable.svg` (mark inside the 80 % safe zone), `icon-mono.svg`, `public/favicon.svg` (split line, dark-scheme variant). All user-facing strings are props (ready for Paraglide in step 10).
- **Storybook 10.6.3** (`apps/web/.storybook`): toolbars for appearance, contrast, density, distance, motion, reading font (decorator calls the same `applyDisplay`); head gets the inline display script and the Inter preload; loader waits for fonts; `a11y: { test: 'error', context: body minus Base UI focus guards }`; `@storybook/addon-vitest` project `storybook` in Chromium + WebKit. 153 stories (Base, Kit, Brand, Foundations: colour roles with live contrast ratios, type scale + Inter feature checks, reading sizes, targets, motion, icons, appearance switch), each with Dark/Stage/increased-contrast variants.
- **Lint guard** `scripts/check-ui-tokens.mjs` in `pnpm lint` (raw colours, Tailwind palette classes, `outline-none` without a `focus-visible:outline-*` replacement, CSS `outline: none`).
- **CI**: Playwright Chromium + WebKit (cache keyed on the Playwright version), `pnpm --filter @splitune/web test:stories` after `pnpm test` (which includes the ui-tokens tests); job timeout 20 → 30 min.
- `CLAUDE.md` and `AGENTS.md`: one UI rule line. Docs 26 (§4.4, §4.6, new §4.7, §6.1, §12.1) and 00 (versions) updated.

**Deviations and decisions**
- **Stem colours changed** (doc 26 §4.4 updated): doc 26's palette failed doc 28's CVD rule (min ΔE2000 5.0–10.5; orange/vermillion 5.1 for deuteranopes, bass/other ~5–6 in every appearance). Each colour moved the smallest summed ΔE2000 that passes in every appearance × contrast context; Dark guitar/bass/drums stay Okabe-Ito (rounded 1/255 into gamut). Lowest stem/card is now 3.2 (Light guitar). Threshold kept at 12.
- **Values doc 26 didn't specify** (now in §4.7): `--conf-medium`/`--conf-low` (from `specs/assets/design/reference.html`, matching §4.6), `--bar-current`, `--waveform-*`, `--hud-*` (Stage HUD dark, not the reference's bright box), increased-contrast steps, elevation tokens.
- **Tier rule interpretation**: component tokens point at a semantic role or carry their own literal, never a ramp step (the §4 table gives them values no semantic role has).
- **Inter wght limited to 400–700** in the subset (full axis = 107 KB > 80 KB budget); opsz and every layout feature kept. AHN roman only.
- **Base UI focus guards** are excluded from axe: Base UI deliberately gives them `role="button"` without a name in WebKit so VoiceOver can't escape popups (comment in `preview.tsx`, WCAG 4.1.2 false positive).
- **Disabled** controls use muted fills with a ≥3:1 boundary; shadcn's 50 % opacity left primary buttons at 2.6:1.
- shadcn init pulled in Geist, shadcn's `cn` npm package and `shadcn` as a runtime dependency; removed. `cn()` keeps `tailwind-merge`, extended with the token utilities (`text-read-*` vs `text-foreground` would otherwise collide). `shadcn` is a pinned devDependency (its CSS is needed at build time).
- `lucide-react` 1.60.0 and `vite` 8.3.4 instead of the newest (published today, inside pnpm's minimum-release-age policy); `pnpm-workspace.yaml` left untouched.
- `@splitune/contracts` exports `./fixtures/*` so stories use the 8-bar Am–F–C–G example; `@splitune/music-core` (bands, chord parsing) is a web devDependency for story fixtures.
- Lint guard scans source files only (`.ts/.tsx/.js/.mjs/.css`) in apps/ and packages/; static SVG brand files in `public/` need literal colours (Light primitives). Link fragments (`href="#add"`) are not hex colours.
- No React Compiler yet (step 10 sets up the app build); no Sheet component (Drawer covers it).
- **Bugs the story tests caught and fixed**: loading Button hid plain-text labels incompletely and then lost its accessible name; checkbox/radio/switch hit areas were 42 px (inset measured inside the border); the allowance meter had no accessible name.

**Verification**
- `pnpm --filter @splitune/ui-tokens test` → 3 files, **648 passed**. Mutation: Light `--muted-foreground` → `var(--gray-7)` → **5 failed** (muted text on card/background/muted, §4.6 baseline, one CVD pair); reverted → 648 passed.
- `pnpm --filter web test` → 7 passed (display script, incl. executing `DISPLAY_SCRIPT` with stored/corrupt/blocked storage). `pnpm --filter @splitune/contracts test` → 45 passed.
- `pnpm --filter web test:stories` → 34 files, **306 passed** (153 stories × Chromium + WebKit), zero axe violations of any impact (a11y `test: 'error'`); also green from a cold Vite cache. Includes: practice Button/TransportButton ≥64×64, practice-2 ≥48, browse ≥44, steppers ≥44, control hit areas ≥44; tnum (ten tabular 1s = ten tabular digits, proportional narrower), `frac` and `cv05/cv08/ss02` change set width (features survived subsetting); Stand `--read-tab` 36 px, Stage+Stand 45 px; reduced motion → 0 ms; appearance switch changes tokens without reload and every pair still passes.
- `pnpm --filter web storybook:build` → success (built CSS: no `light-dark()`, no relative colour syntax apart from Tailwind's own `@supports` probe).
- `pnpm lint` → exit 0 (Biome 346 files; check-db-access; check-ui-tokens 258 files; ruff). Planted `#ff0000` in `apps/web/app/ui/planted.ts` → `pnpm lint` fails with `raw colour #ff0000`; removed → exit 0.
- `pnpm typecheck` → 14/14.
- No flash / no-JS (Playwright script against a plain-CSS page and the built Storybook, Chromium + WebKit): JS disabled → OS light gives Light, OS dark gives Dark (`--background` `oklch(0.2 0.008 75)`), dark + `prefers-contrast: more` gives the stronger muted text (`oklch(0.82 0.008 85)`); JS on with stored `{"appearance":"stage"}` → `data-appearance="stage"` already set at DOMContentLoaded, before the story renders.
- Screenshots of Foundations (Light/Dark/Stage) and kit stories reviewed by eye; fixed mixer column alignment and legend/status widths.

**Known gaps**
- Not run on real devices or Firefox (stories run in Chromium + WebKit per doc 28); forced-colours only mapped, not spot-checked in emulation.
- Visual-regression baselines are step 15a. `WaveformTimeline` and the alphaTab overlay are step 12.
- Distance presets and the CVD threshold still need the in-situ checks listed in docs 26/28 open questions.
- CI changes not exercised on GitHub (nothing pushed).

**For the next step (10)**
- Import `app/styles.css` in the root route; put `DISPLAY_SCRIPT` inline in `<head>` before styles plus `<link rel="preload" href="/fonts/InterVariable.woff2" as="font" type="font/woff2" crossorigin>`; persist `DisplayPreferences` under `splitune.display` and call `applyDisplay()` on change and on `matchMedia` changes for System choices. Set `data-density` on each shell.
- Wrap the app in `TooltipProvider` and `Toaster` (pass `closeLabel` from Paraglide). Kit/base components take every user-facing string as a prop — feed them catalogue messages; stories currently use `app/ui/fixtures.ts` copy.
- Add TanStack Start to `vite.config.ts`; Storybook reads the same config, so check `pnpm --filter web storybook:build` still works (filter the Start plugin in `.storybook/main.ts` `viteFinal` if it interferes).

## 2026-10-21 — Step 08: Notes and chords stages, Node finalize worker, Prototypes 2 and 6
Branch `impl/08-notes-chords-finalize` (worktree `../Splitune-08`) from `dev` (`f1c7742`). On the owner's request, fast-forwarded into `dev` with subject-only messages (no bodies or co-author trailers), in two parts: code `61dc5bc` (contracts), `fb230ed` (storage), `1dfea98` (db), `084f57e` (music-core key CLI), `dbeb3a9` (ml notes + chords), `3dd1d84` (node worker), `705ab08` (eval tooling) — before step 09 branched — then, rebased onto step 09's `dev` (`4dd448d`): `3718a28` (fix: isotonic ties), `8d1bba3` (fix: BabySlakh octave references, report sections), `ea3a97c` (defaults + calibration tables), `82a544e` (P2/P6 reports). Not pushed.

**Built**
- **`notes.guitar|bass|vocals`** (onnx-cpu island): Basic Pitch 0.4.0 `nmp.onnx` on ONNX Runtime with its post-processing ported to numpy/scipy (package not installed: TensorFlow pin), parity-tested; confidence = mean onset posterior over the first 3 frames, calibrated per `config/calibration/<record>@<version>[.<instrument>].json`; bass 30–600 Hz + `low_band_energy`. `NoteTranscriber` with `basic_pitch` and `yourmt3` (YourMT3+ MoE, torch island), selected per instrument in `config/notes.personal.yaml`.
- **`chords`** (torch island): `ChordRecognizer` with consonance-ACE, BTC and madmom CNN+CRF; beat-synchronous log-domain fusion of mixture / no-drums, bass-root chroma prior, Viterbi; majmin and sevenths with top-k; key by madmom's key CNN or music-core (`cli.ts key`). `config/chords.personal.yaml`.
- **`apps/node-worker`**: claims `finalize` (runner `node`), builds `tab.<i>.json` + `render/<i>.alphatex` via music-core, `summary.json` per the `recommended_view` rule (`services/ml/config/views.yaml`), stage + analysis status and events in one transaction (`packages/db` `jobs/stages.ts`).
- Contracts 1.4.0 (`Note.low_band_energy`, `ViewReason` `quality_gate_failed` / `stems_unavailable`); storage `getBytes`/`putBytes`; `scripts/fetch_models.py`; register records for all six models.
- **P2 / P6 tooling** (`eval/p2.py`, `eval/p6.py`, `splitune_eval.local|calibration`) and reports `services/ml/eval/results/p2|p6/2026-10-21.md` (+ CSV).

**Prototype results and chosen defaults** (details: doc 08 step-08 notes)
- **P2** (GuitarSet + MUSDB band, 120 excerpts; BabySlakh 19 tracks; BS-Roformer-SW stems; onset F1 ±50 ms/50 cents): Basic Pitch **guitar stem 0.797 vs mixture 0.516 → PASS**, **bass stem 0.807 vs 0.323 → PASS**; YourMT3+ FAIL for both (guitar stem 0.655 < its mixture 0.797; bass stem 0.804 < mixture 0.973, in-sample). Defaults: Basic Pitch, swept thresholds (guitar onset 0.6 / frame 0.5 / 58 ms: held-out 0.758 vs 0.715 untuned; bass 0.7 / 0.5 / 127.7 ms: held-out 0.860); `views.yaml` gates guitar/bass `pass`. All numbers are in-sample (both models trained on GuitarSet and Slakh).
- **Calibration** (isotonic, fit players 00–02 / tracks 1–10, ECE on held-out): Basic Pitch guitar **0.091 → 0.038**, bass **0.163 → 0.067**; YourMT3+ (constant score) one knot each, guitar 0.396 → 0.011, bass 0.154 → 0.053. Reliability tables in the P2 report.
- **P6** (60 GuitarSet comping excerpts + MUSDB drums; WCSR vs lead-sheet chords): best madmom majmin no-drums **0.787 → PASS**; BTC sevenths no-drums 0.770 (difference 0.018, SE 0.016); consonance-ACE ≤ 0.585. No-drums beat fusion for every model. Key: music-core over BTC/madmom chords 0.86–0.90 vs madmom key CNN 0.715. Defaults: **BTC, sevenths, inputs `[no_drums]`, key `music_core`**, bass_root_weight 0.5 / change_penalty 3.0 (not evaluated).

**Deviations and decisions**
- No owned or Label Studio annotated set exists, so P2/P6 ran on GuitarSet, MUSDB18-HQ and BabySlakh (CC-BY / research). The P2 gate threshold for bass (0.70) is the guitar one (doc 08 names none).
- **BabySlakh octave references fixed mid-run:** most Slakh bass patches sound an octave below their MIDI; the first detector caught 7 of 19 tracks and made YourMT3+ look broken (0.28) and Basic Pitch look right. The detector now uses the energy at odd multiples of f0/2; refs, sweep, calibration and reports were redone.
- **Isotonic fit bug fixed:** tied raw scores weren't pooled (YourMT3+'s constant 1.0 gave an 18-knot vertical table and a worse ECE). Pooled now, with a test.
- consonance-ACE scores far below BTC/madmom here; the port was checked against upstream (features, network, upstream decoding on the same activations scores no better), so it's the model on this material.
- YourMT3+ is ≈ 8 s per 20–30 s excerpt on MPS (doc 06 said ≈ 1.75× real time; corrected), but its ≈ 14 GB peak rules it out beside separation on 16 GB.
- Generated calibration tables are excluded from Biome like the contracts schema and goldens.
- `test_local_chain_transcribes_and_recognizes_chords` (new in step 08; failing on `dev` after step 09) passes after step 09's plucked-bass click track and the BTC default (models subset links BTC; chords fuse `no_drums` only).

**Verification** (in `../Splitune-08` at `82a544e`)
- `cd services/ml && uv run pytest -k "notes or chords"` → **30 passed** (incl. `models`: Basic Pitch parity, notes stage, three recognizers on a synthetic progression, madmom key, the real local chain). Full: `uv run ruff check && uv run ruff format --check && uv run pyright && uv run pytest` → clean, **192 passed, 1 skipped** (step 09's opt-in live URL test).
- `pnpm --filter @splitune/node-worker test` → **24 passed** (alphaTex parsed by alphaTab 1.8.4 in Node + a negative case; every `recommended_view` branch).
- `pnpm lint` → exit 0; `pnpm typecheck` → 14/14; `pnpm contracts:check` → up to date; `pnpm db:check` → match; `pnpm turbo run test --filter='!@splitune/ml'` → 14/14 packages (db 98, api 95, music-core 110, contracts 45, storage 39, node-worker 24, …).

**Known gaps**
- P2/P6 are in-sample and on synthetic-ish material; re-run both on owned annotated songs (Label Studio) before trusting the gates, and add piano (Transkun) and vocals to P2.
- No chord confidence calibration (identity); bass-root prior and change penalty unevaluated.
- Basic Pitch on BabySlakh guitar stems is weak (0.368): Slakh's distorted/synth guitars separate badly.
- After switching checkouts, sync the islands (`pnpm run setup`): the models and weights for step 08 live in `~/.cache/splitune/models` (`uv run python scripts/fetch_models.py`).

## 2026-10-22 — Step 10: Web app shell, auth UI, import flows and library
Branch `impl/10-web-shell-import-library` from `dev` (`bd01f46`). On the owner's request, fast-forwarded into `dev` with subject-only messages (no bodies or co-author trailers; trees unchanged): `520f6c0` (contracts), `b62e539` (db + node worker), `ff92606` (api), `8771894` (local bucket CORS), `50fff62` (UI kit), `5ab28f2` (web app), `3627d48` (CI). Not pushed.

**Built**
- **Contracts:** `GET /v1/songs` takes `q`, `instrument`, `status` (`ready|partial|analysing|failed`), `sort` (`last_practised|added|title`) and returns `LibrarySong` (`latest_analysis` with `stages_done/total` and `recommended_view`, `stems: available|expired|none`, `best_clean` with its bars); `GET /v1/uploads/lookup?file_sha256=`; `allow_duplicate` on `POST /v1/uploads`; `GET /v1/system/stats` (median stage times). No generated-file drift (API types aren't in the Python bundle).
- **DB / node worker / API** (built by a forked agent, reviewed): migration `0008_analysis_recommended_view` (+ `node_worker` column grant), finalize writes the requested instrument's `recommended_view`; `repos.songs.library()` (filters, per-sort keyset cursors, batched derived fields), `queue.stageTimings()`; handlers for the new/extended endpoints, authz matrix cases, `test/library.test.ts` in db and api. Standalone API script renamed `dev:standalone` (it and `vite dev` both use :3000).
- **Local bucket CORS:** `infra/seaweedfs/cors.json` (R2 rules for `http://localhost:3000` / `127.0.0.1:3000`), applied by `seaweedfs-init` (`put-bucket-cors`, every run). SeaweedFS 4.48 honours it: preflight 200 with the allowed origin, 403 from another origin, PUT exposes `ETag`. Uppy sends no headers beyond `content-type`, so `infra/r2/cors.json` is unchanged.
- **`apps/web`:** TanStack Start 1.169 on Vite 8 + Nitro 3 (`node` preset, precompressed assets) with the React Compiler; `app/server.ts` mounts `createApi()` for `/v1/*` and `/internal/*` in the same process and sets the security headers (per-document CSP nonce); SSR loaders call the API in-process with the visitor's cookie. Paraglide 2 (English; 371 messages in `messages/en.json`), TanStack Query over the oRPC client (ErrorEnvelope → typed errors), Zustand display + practice-default stores.
- **Routes and shells** (27 §1): marketing (`/`, `/how-it-works`, `/pricing` stub, `/legal/terms|privacy`), bare (`/auth/sign-in` with "Check your email", `/auth/verify`, `/unsupported`, 404, error boundary with copyable id), app (`/library` data-only, `/import` client, `/settings/*` data-only: Profile and Display & practice working with per-field "Saved"; Keyboard & pedal, Plan & billing, Privacy placeholders), focus (`/start` placeholder until step 13, `/songs/$songId/practice` provisional progress page, `/songs/$songId/edit` placeholder). Account menu with the Appearance switch, offline and in-app-browser banners, capability probe → `/unsupported` for the practice route.
- **Library:** search (debounced, in the URL), instrument/status filters, sort, grid/list (phones always list), every status (Ready · Partial · Analysing n/m · Queued · Downloading · Chords only · Stems expired · Failed · Upload not finished), last practised, best clean tempo with bars, compact stage line with ETA, overflow menu (Rename dialog, Analyse again / Upgrade to Full, Delete with the `delete.song_confirm` AlertDialog), failed and stems-expired actions, worker-offline banner, allowance meter, empty / no results / loading / error states.
- **Import:** File · Link · Record tabs (last one remembered), "Your part", Full/Lite radio cards with allowance and cap locks, whole-page drop target, SHA-256 in a Worker (`hash-wasm`), local decode with waveform (Mediabunny → `decodeAudioData` → "Preview after upload"), pre-flight chips, duplicate notice (Open it · Import anyway), resumable multipart upload (Uppy core + own uploader plugin, resume record in IndexedDB), record yourself (MediaRecorder first supported MIME, level meter, count-in + click, review), link import, offline queueing. "Start practising" opens the practice page at once while the upload continues (status-bar pill).
- **Progress:** SSE hook (`EventSource`, Last-Event-ID resume) keeping the Query cache current; `StageList` with an ETA from `/v1/system/stats` medians (none when a stage has no recent timing); every step-09 machine code mapped to catalogue copy (`lib/reasons.ts`; unknown → `analysis.failed`); polite live-region announcements per stage change; fallback banners; retry.
- **Kit additions (stories first):** `WaveformPreview`, `DropZone`, `RadioCard`, `SaveStatus`; `SongCard`/`SongRow` `actions`/`progress`/`renderLink`; container tokens `max-w-page|reading|bare`; `buttonVariants()` merges classes.
- **Stories:** 218 stories (kit + new **Screens/** stories for every screen state) with a router + seeded Query cache harness (`.storybook/app.tsx`).
- **Tests and tooling:** unit tests (format, next-path, preflight, recorder MIME, song status, security headers, copy keys); Playwright E2E (`e2e/`, own throwaway DB, built server on :3000, mock-mode Mac workers; Chromium, Firefox, WebKit, Pixel 7, iPhone 15); `lighthouserc.json` (`pnpm --filter @splitune/web lighthouse`); `scripts/bundle-budget.mjs` (`budget`). CI: build, budget report, E2E, Lighthouse; Firefox added to the Playwright install; job timeout 45 min.

**Deviations and decisions** (step-10 implementation notes added to docs 00, 03, 04, 10, 13, 17, 24, 25, 26, 27, 28)
- **Uppy's AWS S3 plugin not used:** Uppy 6's plugin has the browser create and complete the multipart upload itself through `signRequest`, which would bypass the API's server-side part check. Uppy core + a small uploader plugin that PUTs the API's presigned parts instead. No Golden Retriever: our own IndexedDB record (ids, acknowledged parts with ETags, the File when storable).
- **Resume in browsers that can't store a File in IndexedDB** (Safari private browsing; Playwright's ephemeral WebKit: "Error preparing Blob/File data to be stored in object store"): the record is kept without the file and the practice page asks for the same file again (matched by size + SHA-256); only the missing parts are uploaded.
- **Magic-link states:** Better Auth reports expired, used and unknown links all as `INVALID_TOKEN`, so they share `auth.link_expired`; an already signed-in visitor continues to `next`. "Check your email" is component state on `/auth/sign-in` so the address never lands in a URL.
- **"Last practised" = `last_opened_at`** (opening practice bumps it) until step 12 syncs practice sessions. Library progress is polled (cards in progress 5 s, list 10 s); SSE is used on the practice page (HTTP/1.1's six connections per origin).
- **Pre-flight:** duration/size block; quiet, clipping and mostly-silence warn. Speech and live-recording detection not implemented (keys exist).
- **Score surface** `paper|match` is stored and written as `data-score`; its colours come with the score in step 12.
- **Lighthouse method:** `throttlingMethod: devtools` (applied throttling, measured). Lantern's simulated LCP is 4.1 s although the observed LCP is 181 ms: it counts the module scripts requested before the paint as LCP dependencies. Both numbers are recorded below.
- **Bundle fixes made for LCP/budget:** route `pendingComponent`s aren't code-split, so skeletons got their own modules; the session query is a bare `fetch` (no oRPC/contract on marketing pages); the uploader loads on demand. Entry chunk 166 → 103 KB brotli.
- Pinned `@inlang/plugin-message-format` 4.5.4 (4.5.5 was inside pnpm's minimum-release-age window); `pnpm-workspace.yaml` untouched.
- Found and fixed along the way: srvx requests can't be cloned by undici (`plainRequest` in the server entry; Hono's body limit crashed on it); Base UI's Slider pre-hydration script lacked the CSP nonce (Base UI `CSPProvider`); heading order on the library (hidden "Songs" h2); `buttonVariants()` class conflicts (outline links without a border, the skip link stretching the phone viewport by 8 px).

**Verification**
- `pnpm lint` → exit 0 (Biome, check-db-access, check-ui-tokens, ruff). `pnpm typecheck` → 14/14. `pnpm test --force` → 14/14 tasks: web 28, api 104, db 104, node-worker 24, storage 39, ui-tokens 648, contracts 45, music-core 110, listening 10, ml 192 passed + 1 skipped (opt-in live URL test). `pnpm contracts:check` up to date, `pnpm db:check` match, `pnpm install --frozen-lockfile` ok. CI YAML validates (`check-jsonschema` github-workflows); not run on GitHub (no push).
- `pnpm --filter web test` → 8 files, 28 passed (incl. the copy-key test; mutation: a planted `<p>Page not found</p>` in a screen fails it, removed → passes).
- `pnpm --filter web test:stories` → 52 files, **436 passed** (218 stories × Chromium + WebKit, axe `test: 'error'`).
- `pnpm --filter web e2e` → **28 passed** on Chromium, WebKit, Pixel 7 and iPhone 15 (sign in via Mailpit link → upload 3 s WAV → stages → Ready in the library; URL import → Downloading → finished; 21 MB upload with parts 2–3 held, reload after part 1 → resumed: part 1 not re-sent, parts 2–3 sent once, analysis finished (WebKit via the re-pick prompt); delete; axe serious/critical = 0 on landing, library, import; no horizontal scroll; **no console errors (no CORS errors)**). **Firefox: 7 not run** — Playwright's Firefox does not launch on this Mac (macOS 27.0.1, "Could not find profile folder", also when started directly); it runs in CI.
- **Lighthouse** (`pnpm --filter web lighthouse`, Home, mobile, 3 runs, DevTools throttling): LCP **1.5 s median** (runs 2.7 / 1.5 / 1.5 s; the first is a cold server), FCP = LCP, TBT ≤ 10 ms, CLS 0, accessibility 1.0, performance 0.92–1.0 → assertions pass. Simulated (Lantern) LCP 4.1 s for the record.
- **Practice route JS budget** (`pnpm --filter web budget`): 258.4 KB gzip of 300 KB (reported; enforced from step 12).
- `pnpm --filter web build` → `.output/` self-contained (~9 MB): copied to a directory without `node_modules`, `node server/index.mjs` served `/` 200, `/internal/ready` ok, fonts 200. HTML responses carry the nonce CSP; every inline script has the nonce.
- Browser multipart against local SeaweedFS with its CORS rules: covered by E2E (preflight passes, part ETags read, `uploads.complete` succeeds), plus the fork's curl probes above.
- Manual: magic-link sign-in in the in-app browser against `vite dev` (empty library, import screen).

**Design QA checklist (doc 28 §5)** — landing, sign-in, library, import × Light/Dark × phone 390, tablet 1180, desktop 1440 (24 screenshots reviewed; stories cover Stage):
- Visual quality: pass after fixes (stills moved chrome controls off the paper surface — in Dark the speed readout had vanished; hero stem row collapsed at desktop width; phone headers overflowed; outline links had no border). Tokens/kit only; one primary per region; 4 px grid; long titles clamp (2 lines card, 1 line row).
- Practice at a distance: n/a this step (no practice screen); calibration sample on Display settings only.
- Accessibility: axe clean (pages + stories); keyboard path through header, toolbar, menus, dialogs exercised by stories/E2E; 320–390 px reflow without horizontal scroll (E2E check); colour never the only cue (badges carry icon + text); reduced motion and increased contrast via the display store. **Not done:** 200 % text zoom pass, Windows forced-colours spot check, screen-reader pass with VoiceOver.
- States and copy: empty/loading/partial/error/offline states implemented and storied for library, import, practice progress, settings, auth and system pages; copy from the catalogue (copy-key test); locks only at the point of action.
- Performance feel: skeletons match layouts; CLS 0 on Home.

**Known gaps**
- Firefox E2E not run locally (above). No real-device runs (iPad/phone/Safari/Samsung).
- The **ML worker deadlocks** on almost every analysis in E2E (`mark_started`: `stage_runs` insert takes a key-share lock on the `analyses` row via the FK, then the status update and the job-event trigger want the row lock; two stages starting together deadlock). The job retries after 15 s and succeeds, so analyses are slower, not wrong. Pre-existing (step 09); proposed as a separate fix.
- Not built here: local playback on import and the practice screen (11–12), onboarding/examples and the service worker (13), real allowances/billing UI (14), privacy settings and telemetry for the capability probe (15). Speech/live pre-flight checks; `data-score` colours.
- Practice route JS is already at 258/300 KB gzip.
- Railway not touched (step 17).

**For the next step (17, deploy)**
- Build: `pnpm install --frozen-lockfile && pnpm --filter @splitune/web build`. Start: `pnpm --filter @splitune/web start` (`node apps/web/.output/server/index.mjs`, listens on `PORT`). Health/readiness: `/internal/health`, `/internal/ready`. Env: `NODE_ENV=production`, `DATABASE_URL`, `APP_URL` = `BETTER_AUTH_URL` = the Railway origin, `BETTER_AUTH_SECRET`, `S3_*` (R2, `S3_FORCE_PATH_STYLE=false` → CSP allows `https://*.r2.cloudflarestorage.com`), `SMTP_*`, `EMAIL_FROM`, `TRUST_PROXY=true`. R2 CORS: fill `<app>` in `infra/r2/cors.json`.
- Step 12 replaces `features/practice/progress-page.tsx` behind the same route; `useAnalysisEvents`, `stageRows`/`remainingSeconds`, the upload store/pill and `lib/reasons.ts` are meant to be reused.

## 2026-10-22 — Fix: stage-start deadlock in the job-event trigger (follow-up to step 09)

Merged into `dev` as 28e2cf7 (cherry-picked from 03b9631 on `impl/09-fix-stage-start-deadlock`); not pushed.

- Cause: the `stage_runs` / `artefacts` insert takes a key-share lock on the `analyses` row via the FK; the migration-0007 trigger on `job_events` then needs `FOR UPDATE` on that row. Two concurrent stage transactions of one analysis each held the share lock and waited on the other. Affected `mark_started` and `finish` (Python) and `markStageStarted` / `finishStage` / `finishAnalysisFailed` (Node).
- Fix: every worker transaction that writes stage runs, artefacts or events starts with `select … from analyses where id = $1 for update` (`lock_analysis` in `executor.py`, `lockAnalysis` in `packages/db/src/jobs/stages.ts`; also in `record_failure` / `recordStageFailure` for one lock order). `packages/db/README.md` queue protocol documents the rule. Migration 0007 unchanged.
- Tests: `services/ml/.../tests/test_executor.py` (two `mark_started` at once; `finish` while another stage starts) and a `markStageStarted` case in `packages/db/test/stages.test.ts`. A third transaction holds the row `FOR NO KEY UPDATE` until both writers wait on it, so the interleaving is deterministic; all three failed with `DeadlockDetected` / 40P01 before the fix.

**Verification**
- `cd services/ml && uv run ruff check && uv run ruff format --check && uv run pyright` → clean; `uv run pytest` → 194 passed, 1 skipped.
- `pnpm --filter @splitune/db test` → 105 passed; `pnpm --filter @splitune/node-worker test` → 24 passed; both `typecheck` → ok; `biome check packages/db apps/node-worker` → clean.
- `pnpm --filter @splitune/web build && pnpm --filter @splitune/web e2e --project=chromium` → 7 passed; worker stderr has no `DeadlockDetected` and no `stage failed` (only the expected `duplicate_audio_hash` warnings). Other browser projects not run.

## 2026-10-22 — Step 11: Audio engine (AudioWorklet + Signalsmith WASM)
Branch `impl/11-audio-engine` from `dev` (`28e2cf7`). On the owner's request, fast-forwarded into `dev` with subject-only messages (no bodies or co-author trailers; trees unchanged): `2ec0f61` (audio-dsp), `11ce608` (audio-engine), `e32ad05` (CI + setup). Not pushed.

**Built**
- **`packages/audio-dsp`:** C++17 engine + C ABI (`include/splitune/dsp.h`: `dsp_create`, `dsp_stem_alloc`, `dsp_set_gain/rate/transpose/loop/beats/metronome/click_gain/quality`, `dsp_play/pause/seek`, `dsp_process`, `dsp_events`, `dsp_heard`, `dsp_latency`, …). Mixes up to 8 Int16 stereo stems at a source read position (fractional carry), 10 ms one-pole gains, input-domain loop wrap with an 8 ms equal-power crossfade, one Signalsmith Stretch instance (default or cheaper+split preset, transpose with tonality limit), count-in and metronome clicks after the stretch, heard-position tracking (processing time `outputLatency` frames ago + segments for wraps/seeks), aligned starts via `outputSeek()`, one-block fades for pause/seek/preset change. Signalsmith Stretch 1.4.0 + Linear 0.6.4 fetched by commit with SHA-256 (CMake FetchContent). Emscripten 6.0.10 (image pinned by digest in `emsdk-version`), standalone `dsp.wasm` ~106 KB (`-O3 -msimd128 -ffast-math -fno-finite-math-only`, no pthreads, one import). `scripts/build.mjs` = Docker build + SHA-256 gate against `dsp.wasm.sha256` (`--update` to record). Native CMake: `splitune_dsp` static lib + `dsp_smoke`; Apple Clang 16.0.0 builds without `-ffast-math`.
- **`packages/audio-engine`:** `createEngine()` (48 kHz interactive AudioContext created in the gesture, `navigator.audioSession` playback, module compiled once via `loadDspModule()` and passed in `processorOptions`), `Engine` API (stems, mixer mute/solo → gains, rate 0.5–1.5, transpose, loop, beat grid, metronome, count-in, seek, `position()`, `timeOf(frame)`, display offset ±150 ms, Media Session, Screen Wake Lock while playing, interruption → pause + `interrupted`, CPU tiers with `audio_underrun`, raw `processor` events, `send`/`flush`), `SplituneProcessor` shell around `ProcessorCore` (Node-testable; scheduled commands by frame; position reports every 20 ms and on transport changes; load reports per second), typed protocol, `PositionClock` + `heardContextTime`, `decodeStem` (Mediabunny/WebCodecs Worker + polyphase resampler, `decodeAudioData` fallback, timeline trim, iTunes gapless priming, min/max peaks per 512), `UnderrunMonitor`/`initialTier`, `resolveGains`. README with API and a step-12 usage example.
- **Demo page** (`pnpm --filter @splitune/audio-engine demo`, :5175): two stem files (+ optional stems.json) or synthetic 120 BPM stems; play/pause/seek, count-in, metronome, speed 50–100 % + presets, transpose, loop by bars with pass counter, mute/solo, tier + adaptive toggle, keyboard (Space/L/M), **Measure** (P7: fixed tier, 2 stems, 0.5×, load/underruns/latencies as JSON).
- **Tests:** shared scenarios (`test/scenarios.ts`) run in Node through `ProcessorCore` + `dsp.wasm` and in Chromium/Firefox/WebKit through the real AudioWorklet in an `OfflineAudioContext` (`test/browser`, Vite harness): duration at 0.5/0.75/1×, pitch at 0.5×, +2 st transpose, loop seam ×5 at 0.75×, clock accuracy at 3 rates, count-in at 0.7×, mute ramp. Decode alignment spec (AAC from FFmpeg and AudioToolbox, Opus; both paths). Unit tests: clock, mixer, tiers, PCM/resampler, gapless, transport behaviour.
- **CI:** step "Audio engine offline render (Chromium, Firefox, WebKit)"; `pnpm test` builds `dsp.wasm` via turbo `^build` (Docker) with the hash gate. `pnpm run setup` pulls the Emscripten image.

**Deviations and decisions** (step-11 notes added to docs 00, 02, 11, 18, 24)
- `dsp.wasm` is **not committed** (generated artefact); its SHA-256 is, and every build is checked against it. Consequence for step 17: the Railway build has no Docker — either build the app image from a Dockerfile, commit the wasm after all, or fetch it from a CI artefact (decide there).
- Most of doc 11 §2 lives in C++ (mixer, seam, clicks, clock bookkeeping), so native apps reuse it; the worklet is a thin shell.
- `outputSeek()` instead of `seek()` for starts/seeks; no `seek()` at the loop seam (the crossfade keeps the stretcher's input continuous).
- Clock: heard = processing time `outputLatency` frames ago (continuous across rate changes; equals the §3 formula in steady state). Device latency: `getOutputTimestamp()` includes it in Chromium but not WebKit (measured), so the clock subtracts the part of `outputLatency + baseLatency` the timestamp doesn't include.
- AudioToolbox AAC (what the Mac worker ships) has only `iTunSMPB`; Mediabunny and Firefox's `decodeAudioData` ignore it (2112 frames late) → the engine applies it in both decode paths.
- Rate clamped 0.5–1.5 in the API; DSP accepts 0.25–2. Initial tier `mid` only for Chromium-reported ≤ 4 GB and ≤ 4 cores.
- Firefox audio suite runs locally against a Playwright server in `mcr.microsoft.com/playwright:v1.64.1-noble` (`PW_FIREFOX_WS_ENDPOINT`); natively in CI.

**Verification**
- `pnpm --filter @splitune/audio-dsp build` → `dsp.wasm sha256 6e2861c317c15776a8ac4ea6c0ddfdd05814ed863e51b0aa96ab8302798087a4 (matches dsp.wasm.sha256)`. Clean `--no-cache` Docker builds on linux/arm64 and linux/amd64 → the same hash.
- Native (g++ in the emsdk image): `cmake --build` with 0 warnings; `dsp_smoke` → `finite=1 energy=34022.2 started=1 countIn=4 wraps=2`, exit 0.
- `pnpm turbo run test --filter=@splitune/audio-engine --force` → audio-dsp build (hash matches) + 7 files, **51 passed**.
- `PW_FIREFOX_WS_ENDPOINT=ws://127.0.0.1:3333/ pnpm --filter @splitune/audio-engine test:browser` → **51 passed** (11 scenarios × 3 engines + 6 decode cases × 3 engines; Chromium Opus/`decodeAudioData` is a declared expected failure). Measured: clock error ≤ 0.33 ms (0.5×), seam curvature 0.93× music, dip −1.98 dB, pitch 0.00 cents at 0.5×, transpose +2.08 cents, mute 90→10 % in 23 ms, count-in downbeat within 1 frame and first click 0.81 ms after it.
- `pnpm lint` → exit 0; `pnpm typecheck` → 14/14; `pnpm install --frozen-lockfile` ok; CI YAML validates (`check-jsonschema` github-workflows). Not run on GitHub (no push).
- Manual: demo in the in-app browser (Chromium 152): test stems, 1-bar count-in, playback and position display; no console errors.

**Device table (P7 engine side, 2 stems, 0.5×, 60 s, adaptive off)**

| Device / browser | Tier | Worklet load avg / max | Underruns | outputLatency + baseLatency | Notes |
|---|---|---|---|---|---|
| MacBook Air M4, macOS 27.0.1, Chrome 152 (headed, speakers) | high | 3.0 % / 4.6 % | 0 | 24 + 5.3 ms | timestamp lag 29.3 ms (includes latency) |
| same, Chrome 152 | mid | 2.5 % / 5.2 % | 0 | 24 + 5.3 ms | |
| same, Playwright WebKit 2370 (headed; not Safari) | high | 3.3 % / 7.2 % | 0 | 12.8 + 2.7 ms | timestamp lag 0.1 ms (excludes latency) |
| same, Playwright WebKit | mid | 2.3 % / 11.2 % | 0 | 12.8 + 2.7 ms | |
| Mac Safari 27, iPhone, iPad, Android, Firefox (real audio) | — | not run | — | — | needs the owner: demo **Measure** + manual checklist |

Load = processing time ÷ audio time on the audio thread (one core). Budgets (§6: ≤ 35 % mid-range Android, ≤ 25 % iPhone 15-class) can't be judged from the Mac alone.

**Known gaps**
- Manual device checklist (doc 18 §2 / doc 24 §6) not run on real Safari, iPhone/iPad, Android or Firefox: AudioWorklet needs a click to start there and phones need HTTPS (Tailscale serve or Caddy + mkcert in front of the demo). Loop-seam audibility, 0.5× quality, Bluetooth offset and interruptions are judged by ear/hand on those devices.
- P7 listening comparison against Rubber Band R3 not done (optional).
- Mac speakers only; no acoustic loopback measurement of the true device latency (the clock trusts what the browser reports, plus the display offset).
- v1 multi-stem streaming (ring buffer) not built (MVP loads whole stems; doc 11 §4).
- Native static library verified with g++ on Linux only (no CMake on the Mac).

**For the next steps**
- Step 12: `createEngine()` from the first gesture, `decodeStem(bytes, { sampleRate: engine.sampleRate, durationSeconds: stems.duration_s })` → `loadStem`, `setBeatGrid`, `setMixer` (`soloGain: dbToGain(gain_to_unity_db)`), `position()` per frame for alphaTab, events for the visual metronome/pass counter, `interrupted` → "Tap to resume", `audio_underrun` → telemetry (step 15). Import from `@splitune/audio-engine`; Vite resolves `dsp.wasm?url` and the worklet `?worker&url`. The web app will need `@splitune/audio-engine` as a dependency, so its build then depends on `dsp.wasm` (Docker) — see the step-17 note above.
- Step 17: decide how the Railway build gets `dsp.wasm` (above).

## 2026-10-22 — Step 12: Practice screen and notation
Branch `impl/12-practice-screen` from `dev`. Commits: `402461a` contracts, `281abe1` db, `f3f6826` api, `e17c5a7` audio-engine, `b3eb881` api test, `47475fe` notation, `eecdc7a` ui kit, `843e190` web practice, `96f0d71` E2E + CI, plus the design-QA commit below. Not pushed, not merged.

**Built**
- **`/songs/$songId/practice`:** transport (play/pause, restart, loop, speed ± with presets, count-in, metronome; loop rests and assess pauses from the player machine), chord strip, notation pane (alphaTab tab with confidence ink, outlines and "?" glyphs, legend + "Show uncertainty"; chord sheet when chords-only or no tab), level toggle (chords only / simplified / as played) with capo/transpose, WaveformTimeline (lanes per stem, bar ruler, loop band, unsure-bar hatching), mixer drawer (2 stems, presets), editor sheet (chord top-k as "about 1 in N", note edit, "report wrong"), pass counter (felt clean / not yet), loop badge + loop panel (save/rename/delete clips), display popover, ⋯ panel, `?` shortcuts overlay, pedal HUD, progressive states as artefacts land (no layout shift), fallback banners incl. chords_only "Show tab anyway", "Is this your guitar?" audition + Wrong instrument, Wake Lock while playing, evening Stage hint, VideoPane (URL import video, muted, slaved to the clock), phone portrait glance view.
- **`/songs/$songId/edit`** (desktop editor) and **Settings → Keyboard & pedal** (learn keys; stored locally).
- **Model:** XState player machine, beat grid + bar-snapped loops, mixer presets, keymap (pedals PageUp/PageDown + learned keys), music-core `buildTab` in a Worker, corrections overlay with IndexedDB outbox (UUIDv7 `client_op_id`, flush on online/visibility), undo/redo as ops, practice sessions/attempts sync, debounced `player_state` PATCH.
- **`packages/notation`:** `AlphaTabView` (external media, per-frame `updatePosition`, sync points from the beat grid, own cursor/bar wash/loop layers from `boundsLookup`, page or scroll follow, roving-tabindex bar targets, note targets in edit mode, token fonts/colours incl. Bravura), `ChordDiagram` (mirrored for left-handed).
- **API/db/contracts:** `songs.mediaUrl` (new), corrections/loops/practice/progress routes implemented, `best_clean_tempo_pct`, `S3.exists`. **Audio engine:** `setStopAt` + `stopReached`.
- **UI kit:** WaveformTimeline, on-demand popover/tooltip/speed-panel parts; Dark "Score: Match appearance" tokens; LoopBadge truncation; Banner wraps actions on phones.

**Deviations and decisions** (step-12 notes in docs 00, 04, 10, 11, 12, 13, 17, 18, 26, 27)
- Mixer is 2 stems (part + mix-minus-part) until multi-stem output exists.
- alphaTab's external-media handler is a no-op transport (it paused playback on score reloads); cursor and bar wash are our own layers.
- Contract addition `GET /v1/songs/{id}/media` for the song's own audio/video.
- YouTube IFrame fallback not built: needs `script-src https://www.youtube.com` (owner decision) and no UI sets `youtube` refs yet.
- Learned pedal keys are per browser (localStorage), not synced to the profile.
- Zod jitless via a head script (CSP without `unsafe-eval`).
- Route budget is tight (see verification); further practice features must load on demand.
- alphaTab's "rendered by alphaTab" footer stays (no setting).

**Verification**
- `pnpm lint` exit 0 (2 infos); `pnpm typecheck` 14/14 tasks; `pnpm --filter @splitune/ui-tokens test` 856 passed; web unit tests 89 passed; `pnpm --filter notation test` 9 passed.
- `pnpm --filter web test:stories` 480 passed, 3 runs in a row after the Chords story waited for the lazy chord sheet.
- `pnpm --filter @splitune/web budget -- --enforce`: practice route 296.8 KB gzip of 300 KB (CI enforces it).
- `pnpm --filter web e2e -- --grep practice`: pnpm forwards `--`, so Playwright reads `--grep` as a file filter and runs the whole suite on all 5 projects: 65 passed, 15 skipped (phones skip the cursor measurement, desktop controls, editor and desktop layout; desktop skips the phone layout), 0 failed. Firefox ran in the `pw-firefox` Linux container with a PulseAudio null sink.
- Desktop practice only (`pnpm exec playwright test --grep practice --project chromium --project firefox --project webkit`): 24 passed, 3 skipped.
  - Cursor vs clock, p95 / worst in ms of audio (one frame at 0.7× = 11.67): Chromium 1.19 / 1.48, WebKit 0.50 / 2.30, Firefox (container) 11.68 / 12.17.
  - Capo redraw: Chromium 19 ms, WebKit 22 ms, Firefox 60 ms.
  - Stored ops on every engine: set_chord, set_note, report_wrong.
- axe reports no violations on every project that runs these checks: the practice screen on desktop engines; the desktop editor; the phone practice screen after "Show tab", which runs on phones only (the glance view itself is checked in Storybook); and the landing, library and import pages.
- Design QA (doc 28 §5) on the Ready story in Light, Dark, Dark + Score match and Stage, each on a 1180×820 touch tablet, a 390×844 touch phone and a 1440×900 desktop: no page errors and no horizontal overflow. Fixes are in b6d313b.

**Known gaps**
- Manual check on a real touch device not done (only emulated touch in Playwright: Pixel 7, iPhone 15, 1180×820 tablet screenshots). Pedal hardware not tested (key events only).
- Firefox cursor accuracy measured only in the Linux container with software rendering (~1 frame jitter); not asserted.
- Design QA from Storybook screenshots, not from a device; Stage at real stand distance not judged.

## 2026-10-22 — Step 13: First-session onboarding, example songs and PWA
Branch `impl/13-onboarding-examples-pwa` from `dev`, merged into `dev` 2026-10-22 (with `impl/12b-chord-strip-overflow`, `cffae8f`; merge `16ecd69`; messages reduced to subject lines). Commits on `dev`: `2cac5cc` music-core fix, `54c83c0` audio-engine fix, `9aeb12a` contracts + analytics, `4e70aa3` db/storage, `edaf4ef` api + examples:build, `e8b6ee0` web (onboarding + PWA), `286d2e8` E2E. Not pushed.

**Built**
- **Example songs:** `pnpm examples:build [--out] [--id --title --artist --instrument --part --loop a-b] <files…>` (apps/api/scripts/examples): full analysis as the system user with the real workers, copies beats/chords/stems (+audio)/notes/tab/summary to `assets/examples/{id}/{build}/`, suggests a 2–4-bar loop, writes `apps/api/examples.json` (committed; no audio). Owner's choice: MUSDB18-HQ windows — riff "Ill Fate" (Hollow Ground), rhythm "Stitch Up" (Bobby Nobody), bass line "Stitch Up".
- **API/contracts/db:** `GET /v1/examples`, `GET /v1/examples/{id}/url` (public, per-IP limits), `POST /v1/examples/{id}/claim`, `POST /v1/events`; `examples.claim` repo (song + finished analysis + shared artefact rows + loops by device id), migration 0009 (app may insert artefacts only under `assets/examples/`, restrictive RLS), analytics repo, example key builders.
- **Onboarding `/start`:** instrument → level → "Where's your screen?" (live distance preset, skippable) → the example's practice screen with the song card ("Play your part" starts audio) → loop at 70/80 % with the part loud, coach marks (max 2, above the timeline) → "Save your progress?" after a completed pass with playback stopped → magic link → `/start/saved` → "Next: a song you want to learn" (Import / Record / Keep practising). Signed-in learners claim the example and practise it as their own song.
- **Pre-signup progress:** guest link behind the oRPC client (`LocalProcedures`), IndexedDB `splitune-guest`; claimed on `/start/saved` and on the first app-shell page after sign-in; idempotent.
- **Defaults by instrument/level:** level toggle, mix preset, starting speed (also the device default), example part; `?level=` on the practice route.
- **PWA:** Serwist (`@serwist/vite` 9.5.13), manifest + PNG icons (`pnpm --filter @splitune/web icons`), precache, runtime caching, `CACHE_PAGE` for client-side navigations, update banner held while playing, iOS install hint, `storage.persist()` after install.
- **Analytics:** `@splitune/analytics` `createTracker()`, events `onboarding_step_viewed`, `example_song_opened`, `first_isolated_playback`, `first_loop_reduced_speed` → `analytics_events`.
- **Fixes found on the way:** music-core quantizer step across bar lines (alphaTex threw at the simplified level on a real song, so no chords/tab); audio-engine `play()` rejection when closed mid-resume; analysis panel asked `/v1/system/stats` for finished analyses.

**Deviations and decisions** (notes in docs 00, 03, 04, 07, 10, 11, 13, 16, 18, 25, 27)
- Event taxonomy lives in `@splitune/contracts` (process boundary), not `packages/analytics/src/events.ts`.
- One bucket in personal mode: `assets/examples/{id}/{build}/` in `splitune-media` (doc 03's separate assets bucket is the dormant design); the build stamp keeps cached files immutable.
- Visitors practise examples **in the practice route** (`?guide=true`), not inside `/start`: sharing modules between the two routes split them into micro-chunks and broke the 300 KB budget. Also for the budget: lazy practice banners, lazy SW registration, `"sideEffects": false` on contracts. Practice route: **299.2 KB** of 300.
- Lighthouse 12 has no PWA category: installability is Chromium's `Page.getInstallabilityErrors` in `pwa.spec.ts`.
- Bass windows: six of nine MUSDB bass windows fell back to chords only (few, unsure bass notes); "Stitch Up" was the usable one.
- E2E specs using `page.route` block service workers; axe skips Base UI's WebKit focus guards.

**Verification**
- `pnpm examples:build` (real pipeline, MPS): 9 candidates 24–44 s each (one failed: Resurrection, no stems → the script now reports and continues); 6 bass candidates 24–44 s; final 3 → `Wrote apps/api/examples.json: 3 example(s)` (2 s each from the stage cache): ill-fate 97 BPM loop bars 6–9 view tab; stitch-up 125 BPM bars 7–10 tab; stitch-up-bass 125 BPM bars 3–6 tab. Every example computes chords + tab at every level.
- `PW_FIREFOX_WS_ENDPOINT=ws://127.0.0.1:3333/ pnpm exec playwright test` (all specs, 5 projects; Firefox in the `pw-firefox` container with a PulseAudio null sink): **79 passed, 21 skipped, 0 failed**. Onboarding (5 scripted steps, phone viewport on Firefox) time to first slowed loop: Chromium 19.0 s, Firefox 21.5 s, WebKit 19.5 s, Pixel 7 19.0 s, iPhone 15 19.3 s (count-in + one pass at 70 % ≈ 17 s of that). Sign-in from the save sheet keeps the loop (best clean 70 %) and the pass; profile gets guitar/just started. (`pnpm --filter web e2e -- --grep onboarding` would run everything, as noted in step 12, so the spec was run by file.)
- PWA (`pwa.spec.ts`, Chromium + WebKit): installability errors `[]`, manifest errors `[]`, ~192 precached entries (1.9 MB); after one online visit the example practice screen reloads **offline** and plays, and `/start` opens offline, in both. Safari itself and iOS not tested (Playwright WebKit only). The Claude desktop app's embedded browser rejects service worker registration.
- `pnpm lint` exit 0 (2 pre-existing infos); `pnpm typecheck` 14/14; `pnpm test`: all packages green except one `@splitune/api` global-setup failure (`roles.ts`) in the parallel full run, not reproduced (API alone 147 passed; db+api in parallel 2/2 green) — a setup race to watch; ML 194 passed, 1 skipped; music-core 111, db 109, ui-tokens 858, web 95, contracts 45, storage 47, analytics 4.
- `pnpm --filter @splitune/web test:stories`: 522 passed (60 files). `pnpm --filter @splitune/web budget -- --enforce`: 299.2 KB. `pnpm contracts:check`, `pnpm db:check`, `openapi:check` (26 paths), `pnpm secrets:scan`: clean.
- Design QA (28 §5) on every `/start` step, the song card, the loop and the save sheet, 390×844 touch and 1180×820 touch, Light and Dark: no overflow, no page errors; axe clean. Fixed: coach marks over the chord strip (tablet) and "Show tab" (phone).
- Manual: full flow in the in-app browser (analytics rows checked: time to first loop 46 s by hand).

**Known gaps**
- Production examples not built: run `pnpm examples:build` with production's DB + R2 env (step 17); the committed manifest points at local SeaweedFS builds.
- No real-device check: iOS Safari install hint and Home Screen, real Safari offline, Android install.
- Step 12's chord strip: with many chords the chips run over the confidence legend at 1180 px.
- Music Worker failures are silent (no chords/tab, no message) — how this bug hid; worth a visible state.
- A visitor's last session `ended_at` can be lost if the page closes before the outbox syncs it to the guest store.
- Local leftovers: candidate example builds under `assets/examples/` in SeaweedFS (storage `deletePrefix` only allows user prefixes) and 15 system-user songs in the local DB. Two mock-mode workers from an earlier E2E run (PIDs 9827/9828, a dropped `splitune_e2e_*` DB) were already running and left alone.
- The owner's `pnpm --filter @splitune/web start` on :3000 was stopped (with permission) for the E2E run; not restarted.

**For the next steps**
- Step 14/15: `track()` is ready; add the rest of the taxonomy to `AnalyticsEvent`. Step 15's sweeper must skip artefacts under `assets/examples/` (claimed rows have `expires_at` null).
- Step 17: build the examples against production; the service worker is `/sw.js` from `.output/public` (no cache headers needed beyond Nitro's defaults).
- Anything new on the practice route must load on demand: 0.8 KB of budget left.

## 2026-10-22 — Step 14: Mock billing, Free/Plus entitlements and paywall UX
Branch `impl/14-mock-billing-and-plans` from `dev`, merged into `dev` 2026-10-22 (merge `37128dd`; messages reduced to subject lines). Commits on `dev`: `30b6813` contracts, `5567a90` db, `f02f539` api, `3dc577c` contracts refactor (billing contract + plan module), `5cae612` api (allowances in the plans list), `debc937` web, `b13877e` E2E. Not pushed.

**Built**
- **DB:** `billing_events` (idempotency by provider event id, RLS), `subscriptions.renewal_reminder_for`, allowance reservation inside the analysis transaction under a per-user advisory lock (`UsageCharge`, `AllowanceExhaustedError`), trigger releasing the reservation when a run ends failed/cancelled or without its headline output (stems for Full/Welcome, chords for Lite), billing/flags repos, `dueSubscriptions`.
- **API:** pure `entitlements()` + `admit()` (Welcome auto-applied to a Free user's first Full, Lite→Full = one Full, Plus priority 50 vs 100, re-runs after a pipeline change free, limits from remote flags); `MockBillingProvider` (signed sessions, checkout/portal events through the real `/internal/billing/webhook`, HMAC + timestamp, idempotent); renewals/expiry/7-day yearly reminder settled on the billing clock (timer, dev clock, per user before `/v1/me` and admission); emails (renewal reminder, payment failed, cancellation) to SMTP/Mailpit; `POST /internal/dev/clock` behind `ENABLE_DEV_CLOCK`; billing routes in their own contract.
- **Web:** `/pricing` (matrix from 23 §3, monthly/yearly as equal choice cards, demo banner, no badges/countdowns), upgrade sheet from locks (Import caps, "Analyse with stems + tab" on Lite songs, Settings), Welcome prompt on Import, `/billing/mock-checkout` + `/billing/mock-portal` (one `$view` route), Settings → Plan & billing (allowances, renewal date, one-tap cancel/resume, Manage), header meter shows Plus' full allowance, `me` refreshed after analyses and plan changes; stories for every state.

**Deviations and decisions** (notes in docs 03, 04, 10, 14, 25, 27)
- Pricing interval is choice cards (same component as the upgrade sheet), not a toggle: both prices visible, monthly chosen, yearly not emphasised.
- Refund (`refund.issued`) is recorded only; it doesn't end Plus. Switch monthly↔yearly keeps the current period and applies at renewal. A past-due period that ends expires (no retries in the mock).
- Dev clock is an in-memory offset per API process; it requires a signed-in caller + CSRF header besides the env flag.
- "Fallback-only" = headline output missing (Full/Welcome without stems, Lite without chords); a fallback separation model still counts.
- `extra_instrument` not classified (no multi-instrument requests yet); deleting a song mid-run keeps its unit.
- Practice-route budget forced structure: billing contract/client separate, `PaidPlan`/`Plan` in `plan.ts`, both mock pages on one route, the shell reads `me` from route context (see doc 10 note). `ServerAnalyticsEvent` dropped (server events are recorded directly).
- New copy keys incl. `plan.cap_full_plus`; `library.upgrade_full` reworded to "Analyse with stems + tab". Owner-facing E2E change: specs collect console errors after sign-in; journey's link import now finishes as a Lite chord sheet (the upload used the Welcome analysis).

**Verification**
- `pnpm --filter @splitune/api test` → 16 files, **188 passed** (incl. `test/billing.test.ts` 17: caps, 10-parallel race, refunds, Lite→Full, re-run after pipeline change, checkout declined/success/idempotent/409, session binding and forgery, one-tap cancel → Plus to period end → dev clock → Free, monthly renewal resets the allowance, yearly reminder once in Mailpit, switch/payment failure/refund, webhook signature/stale/wrong key/replay/unknown user, dev clock gating, remote limit flags). `pnpm --filter @splitune/api test -- billing` runs the whole package (pnpm forwards `--` as a filter), so it was also run by file: 17 passed.
- Entitlement table tests (`src/entitlements.test.ts`): every plan × allowance edge (Free fresh/Welcome used/Lite 4 & 5 of 5, Plus period-only counting with extra instruments, 15 of 15, past due, ended Plus → Free, fair use 200, flags) — 32 unit tests in the file set, all passing.
- `pnpm --filter @splitune/db test` → **123 passed** (incl. `test/billing.test.ts`: reservations, lifetime Welcome, parallel race 10 → 5, release trigger table, event idempotency/lifecycle, reminder once, RLS on billing_events).
- `pnpm exec playwright test e2e/billing.spec.ts --project chromium --project webkit --project mobile-chrome --project mobile-safari --trace on` → **32 passed**; Firefox (Linux `mcr.microsoft.com/playwright:v1.64.1-noble` run-server, `PW_FIREFOX_WS_ENDPOINT`) billing + journey → **15 passed**. Full suite on the four local projects → **94 passed, 18 skipped, 0 failed**. `pnpm --filter web e2e -- --grep billing` forwards `--` as a file filter and runs everything, hence the explicit commands. Traces: `apps/web/test-results/` (local, git-ignored).
- **Card-input scan** (every billing page, every project): `/pricing` 2 form controls (plan radios), upgrade sheet 2 (radios), `/billing/mock-checkout` 0, `/billing/mock-portal` 0, `/settings/billing` 0 — no text, select, textarea or card-named input anywhere; axe clean and no horizontal scroll on each.
- `pnpm --filter @splitune/web test:stories` → 562 passed (one run had the unrelated onboarding "Examples Failed" story fail under load; 3/3 alone and the next full run green). Web unit 96 passed (+ `price.test.ts`). `pnpm lint` exit 0; `pnpm typecheck` 14/14; `pnpm contracts:check`, `pnpm db:check` clean.
- `pnpm --filter @splitune/web budget -- --enforce` → **299.7 KB** of 300 KB.
- Design QA (28 §5): 91 Storybook screenshots (13 billing stories × 390×844 touch, 1180×820 touch, 1440×900, Light/Dark, plus 320 px): no page errors, no overflow from billing content; fixed pricing card footers, header meter width, phone matrix columns. Copy from the catalogue; locks only at points of action; prices and limits never hard-coded in the client.

**Known gaps**
- No real-device check (emulated phones only); forced-colours and 200 % zoom not spot-checked on billing pages.
- Settle timer doesn't run while Railway sleeps (first request per user settles that user).
- 320 px: the app shell story wrapper overflows by 31 px (account button + story padding) — pre-existing, every app-shell story.
- The owner's `pnpm dev:all` vite server on :3000 was stopped (with permission) for E2E and not restarted.

**For the next steps**
- Step 15: billing events are in `billing_events` and `analytics_events` (`checkout_completed`, `subscription_cancelled`, `paywall_viewed`, `upgrade_clicked`) for the funnel/refund dashboards; account deletion should cancel the subscription (mock: nothing to call) — rows cascade.
- Step 17: set `BILLING_WEBHOOK_SECRET` on Railway; never `ENABLE_DEV_CLOCK`.
- Practice route has ~0.3 KB left: keep page-specific contracts and clients out of shared modules (doc 10 note).

## 2026-10-22 — Step 15: Data lifecycle, privacy self-service, analytics and observability
Branch `impl/15-lifecycle-analytics-observability`, created from the unmerged step-14 tip (the step-14 commits on it were rewritten to subject-only messages with the same trees while this step ran; the base is now `b13877e`). On the owner's request, fast-forwarded into `dev` (on top of the step-14 merge `37128dd`) with subject-only messages (no bodies or co-author trailers; trees unchanged): `24fc620` contracts, `ca44ee5` storage, `af604a1` analytics, `3e3b0c6` db, `b8ad31b` node worker, `35c65b0` api, `42bc87f` web, `fcad882` infra. Not pushed. Step 15a was **not** started (owner: stop after step 15).

**Built**
- **Lifecycle (node worker, maintenance login):** scheduler with `schedule_runs` compare-and-set claims (once per due time across workers/restarts; catches up after sleep); `sweep-stems` (180 days unused, files under `…/stems/` only, `artefacts.purged_at`, audited), `expire-exports` (24 h), `expire-raw-uploads` (off by default), `refresh-youtube-data` (titles > 30 days nulled), `pg-dump` (custom format, rotation 14, skips schemas the role can't use), `daily-digest` (SMTP). Privacy jobs `export_user_data` (bundle `DataExport`, links to own uploads) and `delete_account` (objects → rows → objects again + verify empty → payload scrubbed; follow-up pass if a stage was running). Analysis product events after finalize.
- **DB:** migrations 0012–0014 (`data_exports`, `schedule_runs`, `purged_at`, `analytics_events.user_hash` replacing `user_id`, `jobs_owner_account`, `dashboard_reader`, 13 `dashboards.*` views); `privacy` repo, `revokeSessions`, `jobs/lifecycle.ts`, `jobs/telemetry.ts`; `seed:dashboards` (synthetic week).
- **API:** `POST/GET /v1/me/export`, `DELETE /v1/me` (re-auth ≤ 10 min, all sessions end, deleted users resolve to signed out), `ANALYTICS_SALT` required, hashed events, `analysis_requested`, typed flags (`createFlags`, 30 s cache; `/v1/me` flags evaluated; gates on link import, examples, speed trainer), free "Re-create stems" rerun, request spans when tracing is on.
- **Web:** Settings → Privacy (training opt-in, Download my data with all states, Delete my account with confirm + magic-link re-auth), `/account-deleted`, practice stems-expired banner + "Re-create stems" (plays the song's own audio), events: speed, loops (tap/numeric/clip), passes, level, view, mix preset, corrections/reports, underruns, uploads, link import, display settings, capability probe, in-app banner. Stories for every new state.
- **Infra/observability:** compose profile `observability` (`grafana/otel-lgtm:0.35.0`, Grafana :3001 with five provisioned dashboards over the views, OTLP :4317/:4318); `@splitune/analytics/tracing` (env-gated OTLP/HTTP spans in API and node worker with `analysis_id`); `.env.example` for every new variable (appended to the local `.env`).

**Deviations and decisions** (step-15 notes in docs 03, 04, 10, 15, 16, 25, 27)
- **Practice route budget raised to 302 KB** gzip (owner, 2026-10-22): practice events cost ~1 KB; measured 300.9 KB. Events queue in a 0.3 KB static tracker; the sender loads after the first render with the service worker (any new lazy-import site costs Vite's 0.8 KB preload helper). Privacy and event procedures moved to `privacyContract` / `eventsContract` so the shared client stays small.
- `analytics_events.user_id` dropped for a salted `user_hash` (old rows keep no key). `browser` in events is read from the user agent **for reporting only** (doc 24's rule is about behaviour).
- `delete_account` cancels nothing at a provider (mock subscription rows are deleted); the Python ML worker is not traced (JSON logs with `analysis_id` already); GlitchTip skipped; worker "offline periods" in the digest = heartbeat age + `analysis.waiting` events.
- Pipeline dashboard uses tables: Grafana's time-series panels stayed blank for those two queries although the data returned (not diagnosed further).
- gitleaks flagged a `{ key: '…' }` test literal as a generic API key; the test builds rows through a helper instead of an allow-list.

**Verification**
- `pnpm --filter @splitune/node-worker test` → **33 passed** (scheduler once per due time; sweeper only eligible stems + idempotent; export bundle valid against `z.toJSONSchema(DataExport)` with Ajv 2020 + upload link downloads; account deletion: no objects under `u/{user}/`, no rows but `audit_log`; **pg_dump as maintenance restored into a scratch DB with `pg_restore --exit-on-error`**, rotation keeps 2 of 3; failing dump → `pg_dump_failed`, no partial file; digest text + sent to Mailpit; finalize events with declared props only).
- `pnpm --filter @splitune/api test` → **200 passed** incl. `test/privacy.test.ts` 7 (real node worker process: export pending → ready, 24 h link, bundle parses; stale session → 403 `reauth_required`; delete ends both devices' sessions, worker removes rows/objects/events/jobs; events stored under the hash with undeclared `email`/`title` dropped and no id anywhere in the row; `analysis_requested` once per new run; flags). `pnpm --filter api test -- privacy` would run the whole package (pnpm forwards `--`), so the file was also run alone: 7 passed. `openapi:check` → valid (33 paths).
- `pnpm --filter @splitune/db test` → **145 passed** incl. `dashboards.test.ts` (every view returns the expected numbers for a seeded synthetic week; `dashboard_reader` can read only views; no title/email/key/id columns) and `lifecycle.test.ts`.
- contracts 45, storage 50, analytics 12, music-core 111, ui-tokens 858, audio-engine 53, notation 9, listening 10, config 1 — all passed. Web unit **103 passed**. ML suite not re-run (no Python changes).
- `pnpm --filter @splitune/web test:stories` → **584 passed, 2 failed**: `Screens/Practice/Analysing` (Chromium + WebKit, axe `scrollable-region-focusable`) — **pre-existing**: fails the same with this step's changes stashed. Not fixed.
- `pnpm lint` exit 0 (2 pre-existing infos); `pnpm typecheck` 14/14; `pnpm contracts:check`, `pnpm db:check` clean; `pnpm --filter @splitune/web build` ok; `pnpm --filter @splitune/web budget -- --enforce` → 300.9 KB of 302 KB.
- Dashboards: local dev DB migrated, `pnpm db:roles`, synthetic week seeded, `--profile observability up -d otel-lgtm`; Grafana datasource query as `dashboard_reader` returns rows; screenshots of Activation, Pipeline and Trust reviewed (in the session scratchpad, not committed).
- **Design QA (28 §5)** on Privacy (default, export pending/ready, delete re-auth) and `/account-deleted`: 390×844 touch, 1180×820 touch, 1440×900 × Light/Dark/Stage, plus 320 px — no page errors, no overflow except the known 31 px app-shell story overflow at 320 px; fixed the re-auth action's emphasis. Not done: real device, 200 % zoom, forced colours, screen reader.

**Known gaps**
- Pre-existing failing story `Screens/Practice/Analysing` (above).
- OTel traces not checked end to end in Grafana/Tempo (env-gated code tested only with tracing off).
- Local leftovers: the `otel-lgtm` container is running; the local dev DB holds a synthetic week (users `synthetic-*`); 7 older `splitune_*test*` databases exist (origin not verified; not removed).
- Railway/R2 not touched: step 17 must set `ANALYTICS_SALT` on `app` and the Mac, `NODE_WORKER_MAINTENANCE_DATABASE_URL`, `PG_DUMP_DIR` (external disk), `DIGEST_EMAIL_TO`, and run `pnpm db:roles` there.

**For the next step (15a)**
- New screens to include in the audit and visual matrix: Settings → Privacy states, `/account-deleted`, the practice stems-expired state. Practice budget headroom is ~1.1 KB of 302.

## 2026-10-22 — Step 15a: UI polish, visual regression and design QA (partial: usability round and real-device checks pending the owner)
Branch `impl/15a-ui-polish-and-design-qa` from `dev` (`fcad882`: the owner rewrote step 15 to subject-only messages and moved `dev` onto it while this step ran; same tree as `1b2ca18`). On the owner's request (2026-10-23), fast-forwarded into `dev` with subject-only messages (no bodies or co-author trailers; trees unchanged): `6deb325` ui-tokens radius, `08519a2` motion tokens + lint, `1bb3d04` practice polish, `f873d43` targets/focus/stem rows, `595f820` stories, `e2b292c` copy test, `c4f9609` visual suite + CI, `94f1c39` exact region names in E2E, `67721ac` WebKit cancelled-fetch filter. Not pushed.

**Built**
- **Visual regression** (28 §4): `pnpm --filter @splitune/web e2e:visual` / `e2e:visual:update` (`scripts/visual.mjs`): builds Storybook, starts a Playwright 1.64.1 server in `mcr.microsoft.com/playwright:v1.64.1-noble` **as linux/amd64**, serves `storybook-static` on 127.0.0.1:6106 (`scripts/serve-static.mjs`) and runs `playwright.visual.config.ts` (Chromium + WebKit, browsers reach the host through `exposeNetwork: '<loopback>'`; the config refuses to run without the container). Matrix in `e2e/visual/screens.spec.ts`: Home, Library (populated), Import (file selected) × Light/Dark × phone 390×844 / tablet 1180×820 / desktop 1440×900; Practice (tab ready, loop on bars 5–6, unsure notes) × Light/Dark/Stage × 3; practice "stems ready, tab pending" and "stems expired" (tablet); mock checkout, Settings → Display and Privacy (phone, desktop); account deleted (phone) — **36 images per engine, 72 baselines committed** in `e2e/visual/__screenshots__/` (5.7 MB). Fixed clock 2026-10-22 10:00 UTC, `en-GB`; `volatile.css` hides the score cursor, PedalHud and count-in. Plus `e2e/visual/focus.spec.ts` (focus clears the sticky bar). CI step after the story tests, diffs uploaded on failure (`actions/upload-artifact` pinned to v7.0.2's SHA).
- **Copy:** the copy-key test checks each doc 27 §5.6 copy, not only the key (mutation: "couldn't" → "could not" in `analysis.failed` fails it). No hard-coded strings found in screens or `app/ui` (sweeps of JSX text, string props, sentence-like literals). New keys: `practice.loading`, `practice.hud_no_stems`.
- **Motion:** Drawer/Toast on `--duration-*`/`--ease-standard`; popups `--ease-enter`/`--ease-exit`; practice layer fade-ins on `--duration-base` + `--ease-enter`; `check-ui-tokens.mjs` fails one-off durations/delays/easings (verified: the old drawer/toast classes give 11 violations).
- **Tokens:** `--radius-sm/md/lg/xl` derived from `--radius` (were literals — `--radius` was dead; found by the token check).
- **Focus:** `scroll-padding-top` for the sticky bars (measured both engines: focused control 15 px below the bar, 27 px under it without).
- **Screens and states** (fixes from the audit below), new stories: Import FileSelected; Practice Loading, StemsUnavailable, NotSavedOffline, LoopActive, PedalBeforeLoop, DisplayPopover, LoopOptions, SpeedPanel, MorePanel, ShortcutsOverlay, Edit; Auth LinkExpired/LinkInvalid; Marketing HowItWorksPage/Terms/Privacy/PrivacyDark; System Offline/InAppBrowser. Settings and billing-settings stories render the real section list (`features/settings/settings-layout.tsx`, shared with the route); How it works, Legal (`legal-content.ts` + `legal-page.tsx`) and the magic-link landing (`link-landing.tsx`) moved into `features/` for stories. `EditPage` takes an optional `fetchAudio` like `PracticePage`.

**Screen audit** (doc 27 §3 routes/overlays × §4 states × 28 §5 checklist). Method: every `Screens/*` story at phone 390×844 (touch), tablet portrait 820×1180 (touch), tablet landscape 1180×820 (touch), desktop 1440×900 and 320×640 (touch) × Light/Dark/Stage, automated checks (horizontal overflow, text < 12 px, targets < 24 px / < 44 px on touch in browse density, clipped text, page/console errors, failed requests) + screenshots reviewed by eye (contact sheets); the visual baselines reviewed image by image. Before: 924 renders (78 stories × 4 viewports × 3 appearances): no horizontal overflow and no text < 12 px once the story margin was fixed; the target, state and visual findings below. After: **1,350 renders** (90 stories × 5 viewports incl. 320 px × 3 appearances): **0 horizontal overflow, 0 text < 12 px, 0 page errors**; the remaining target hits are the false positives listed below (a 9-render re-check after the last link-width fixes: clean).

| Screen (27 §) | Gaps found | Status | Sev |
|---|---|---|---|
| Story harness (all screens) | Screens rendered inside the components' 24 px story margin → the "31 px overflow at 320 px" of steps 14–15 | Fixed: screens edge to edge | 3 |
| Home §3.1 | Phone: stem row truncated "Guitar" to "Gui…"; footer links 20 px tall; wordmark link 38 px | Fixed (StemRow name on its own row < `sm`; footer/wordmark links 44 px) | 2 |
| How it works, Legal §3.2 | No stories | Stories added; layout OK | 3 |
| Pricing §3.2 | — (matrix, choice cards, demo banner OK in all appearances) | — | — |
| Onboarding §3.3 | — (steps, coach marks, save sheet OK). Some play functions assume one viewport (story test only, not UI) | — | — |
| Auth §3.4 | Landing (expired/invalid) had no stories; bare-shell wordmark 38 px | Stories added; 44 px | 3 |
| Library §3.5, §4 | Offline state "others dimmed with Needs connection" not implemented | **Logged** → step 20 (needs per-song offline cache state, the v1 offline work) | 2 |
| Import §3.6 | No full-page "file selected" story; inline "choose a file" 24 px tall on touch | Story added; 44 px hit area | 2 |
| Practice §3.7.1–3 | Phone status bar truncated the loop badge to "L…" beside the title; glance view "Bar 0.4" before the first downbeat; loading skeleton didn't match the regions and had no "Loading your song…"; offline with uncached audio showed the generic audio error; analysing placeholder failed axe `scrollable-region-focusable` (pre-existing since step 15); no failed-stage / offline / loop-active stories | Fixed: title SR-only on phones (doc 27 updated); "Pickup"; region skeleton + text after 1 s; `practice.not_offline`; placeholder is a focusable region named by its text; stories | 1 (badge, a distance-reading element) / 2 |
| Practice overlays §3.7.4 | Speed panel and ⋯ panel were dialogs without an accessible name (axe `aria-dialog-name`); display/loop/speed/⋯/shortcuts and the editor page had no stories | Fixed (named); stories added | 2 |
| Practice keys §8 / PedalHud | C / N / L with no loop and M before stems did nothing visible | HUD answers "No loop — tap two bars" / "Stems aren't ready yet" | 2 |
| Practice Stage | "Try Stage" hint visible in Stage stories | Story artefact (toolbar sets the attribute, not the display store); app hides it in Stage | — |
| Edit §3.8 | No story | Story added | 3 |
| Settings §3.9 | Stories without the section list; "Learn this pedal" 32 px (`sm`, desktop-only size) on touch; **About section not built**; field skeletons n/a (data-only SSR) | List in stories; 44 px; **About logged** (no versions/licences page yet; suggest with step 17's build id) | 2 / 3 |
| Billing §3.10 | — | — | — |
| System §3.11 | Offline and in-app-browser banners had no stories | Stories added | 3 |
| Motion (26 §10) | Drawer, toast and popups used non-token easings/durations | Fixed + lint rule | 2 |
| Shape (26 §9) | `--radius` didn't drive the radius scale | Fixed | 2 |
| Focus (26 §7) | Sticky bars could cover the focused element (no `scroll-padding`) | Fixed + test | 1 |

False positives checked and dismissed: slider/switch/song-card/drop-zone targets measured by their visible box but with ≥ 44 px `::after` hit areas; hidden Base UI inputs; screen-reader-only spans reported as "clipped".

**Design QA checklist (28 §5)** — MVP screens (home, how it works, legal, pricing, onboarding, auth, library, import, practice + overlays, edit, settings, billing, system):
- Visual quality: **pass** (tokens/kit only — lint; one primary per region; 4 px grid; long titles clamp; Light/Dark/Stage reviewed; score stays paper in Dark).
- Practice at a distance: **not verified** — needs a real tablet at 0.75 m and a phone at 1.5 m (reading sizes per preset are the tested tokens; Stand story reviewed on screen only). Knuckle test not done.
- Accessibility: keyboard paths via story play functions; focus visible and **not obscured** (tested); axe clean on all 600+ story renders; colour never the only cue (confidence outline + "?" on notation and chips, badges with icon + text); reduced motion → 0 ms (tokens) and increased contrast via the display store (story toolbar). **Not done:** 200 % text zoom pass, Windows forced-colours spot check, VoiceOver pass. 320 px reflow: no horizontal scroll on any screen story (320×640, all appearances).
- States and copy: **pass** after the fixes above; logged gaps: Library offline dimming, Settings → About.
- Performance feel: no layout shift when layers arrive (transport anchored; skeleton regions); long tasks during playback (Chromium, `Screens/Practice/LoopActive`, 12 s incl. loop wraps, tablet touch / desktop / phone, 5 runs): **none during steady playback**; one 105–142 ms task ~50 ms after the first Play press (engine start-up, pre-existing — not introduced by UI; worth a look in step 16).

**Review rubric (28 §7)** — 1–3 per item (Focus · Restraint · Rhythm · Typography · Consistency · Honesty · Calm):

| Screen | F | Re | Rh | T | C | H | Ca | Note |
|---|---|---|---|---|---|---|---|---|
| Home | 3 | 3 | 3 | 3 | 3 | 3 | 3 | |
| How it works / Legal | 3 | 3 | 3 | 3 | 3 | 3 | 3 | |
| Pricing | 3 | 3 | 2 | 3 | 3 | 3 | 3 | Matrix rows dense on phone |
| Onboarding | 3 | 3 | 3 | 3 | 3 | 3 | 3 | |
| Auth | 3 | 3 | 3 | 3 | 3 | 3 | 3 | |
| Library | 2 | 3 | 3 | 3 | 3 | 3 | 3 | Phone: filters take most of the first screen before songs |
| Import | 3 | 3 | 3 | 3 | 3 | 3 | 3 | |
| Practice (tablet/desktop) | 2 | 3 | 3 | 3 | 3 | 3 | 2 | Audition + evening Stage banners can stack above the score on first open |
| Practice (phone glance) | 3 | 3 | 3 | 3 | 3 | 3 | 3 | |
| Edit | 3 | 3 | 2 | 3 | 3 | 3 | 3 | |
| Settings | 3 | 3 | 3 | 3 | 3 | 3 | 3 | |
| Billing (checkout/portal/settings) | 3 | 3 | 3 | 3 | 3 | 3 | 3 | |
| System pages | 3 | 3 | 3 | 3 | 3 | 3 | 3 | |
Nothing below 2.

**Usability round (28 §6): not run.** It needs the owner and friends with instruments, the iPad on a stand and a phone, bright and dim rooms; I can't run it. Acceptance (owner + ≥ 1 participant complete task 1 in ≤ 5 min) is **open**. Log template for the owner:

| # | Participant (level, age band) | Room | Task 1 time / help? | Task 2 time | Task 3 (taps; can say what "?" means) | "Read me bar 6" | "What does Splitune think it got wrong?" | Findings (severity 1–3) |
|---|---|---|---|---|---|---|---|---|
| 1 | Owner | bright | | | | | | |
| 2 | | dim | | | | | | |

**Devices used:** MacBook (Apple Silicon), macOS 27; Playwright Chromium 1.64.1 on the host (audit sweep, emulated touch viewports); Playwright Chromium + WebKit 1.64.1 in the Linux image (visual suite, amd64 under Rosetta); Vitest browser Chromium + WebKit (stories). **No real tablet or phone; no Safari, Firefox or Android.**

**Before/after** (the three most-changed screens, Light, Chromium): `docs/specs/assets/15a/practice-phone-before-after.png` (badge whole, "Pickup"), `home-phone-before-after.png` (stem row, footer targets), `settings-keyboard-before-after.png` (section list, 44 px pedal buttons). The radius-change diff (453 px on Library desktop) was viewed in `apps/web/test-results/` and not kept.

**Deviations** (docs updated in this change: 26, 27, 28 implementation notes; 27 §5.6 quote style; 28 §3 table and §4 tolerance)
- Visual suite renders **Storybook Screens/ stories**, not the running app (deterministic fixtures, no backend in Docker).
- Tolerance `maxDiffPixels: 20` instead of `maxDiffPixelRatio: 0.002` (the ratio let a 10 → 16 px `--radius` change pass on 69 of 72 images; zero tolerance flaked on a 3×2 px canvas wobble). Container pinned to **linux/amd64** (arm64 renders differ on 36 of 72 images).
- Phone practice status bar hides the song title visually (badge priority).

**Verification**
- `pnpm --filter @splitune/web e2e:visual` → **74 passed** (72 screenshots + focus test × 2 engines), twice in a row on the final code (2 workers, ~4–5 min under emulation). Token check: `--radius` 0.625rem → 1rem → **72 of 72 screenshots failed** (e.g. Library desktop 453 px); reverted → green. Before the radius-scale fix the same change produced no diff at all.
- `pnpm --filter @splitune/web test:stories` → 64 files, **626 passed** (313 stories × Chromium + WebKit, axe `test: 'error'`), incl. step 15's failing `Screens/Practice/Analysing`.
- `pnpm --filter @splitune/web test` → **103 passed** (copy-key test incl. catalogue copy; mutation fails it). `pnpm --filter @splitune/ui-tokens test` → 858 passed.
- `pnpm lint` → exit 0 (Biome 730 files, check-db-access, check-ui-tokens 613 files incl. the motion rule — planted old drawer/toast classes → 11 violations; ruff). `pnpm typecheck` → 14/14.
- `pnpm --filter @splitune/web build` ok; `pnpm --filter @splitune/web budget --enforce` → **301.3 KB of 302 KB** (step 15: 300.9).
- CI YAML validates (`check-jsonschema` github-workflows); not run on GitHub (nothing pushed).
- Functional E2E (2026-10-23, owner's `vite dev` on :3000 stopped with permission; `pnpm exec playwright test --project chromium --project webkit --project mobile-chrome --project mobile-safari`): first run **4 failed** — `journey: a short file uploads, analyses and shows as ready` on every project, caused by this step: the analysing placeholder is now a region named "Tab will appear here…", and Playwright's substring name match took it for the tab region, so the journey's "finished" check passed at once. Fixed in the specs (`exact: true`, `875221c`). Second run: **92 passed, 18 skipped, 2 failed** — WebKit `billing: no console errors` and `practice: no console errors`, both WebKit's "… due to access control checks" for same-origin fetches cancelled when the test leaves the practice screen (`/v1/analyses/{id}/events`, `/v1/songs/{id}`). **Pre-existing:** on the step-15 base (`fcad882`) the WebKit billing check fails 5 of 6 runs; on this branch 1 of 6 (practice: 0 of 2 on the base, 1 of 3 here). Firefox not run (needs the Linux container).

**Known gaps**
- Usability round, real-device reading-distance and knuckle checks, 200 % zoom, forced colours, VoiceOver (above).
- Library offline dimming (step 20) and Settings → About (not built).
- WebKit console checks (owner's go-ahead, 2026-10-23): `collectErrors` (`e2e/helpers.ts`) now drops WebKit's "/localhost:3000/v1/… due to access control checks" — console errors **and** page errors (unhandled rejections carry the same text) — for the app's own host and `/v1` path only; billing's two-endpoint allow-list is gone (`ea9ae3a`). Checked against sample messages: bucket (:8333) and R2 failures, CORS rejections and same-origin non-API messages still count. Runs after the change: `--project webkit` 4 × **27 passed**, billing WebKit alone 5 × 8 passed, `--project mobile-safari` 2 × **20 passed, 8 skipped**. One earlier full WebKit run (before page errors were filtered) also logged `TypeError: Importing a module script failed.` with a "screen error" from the error boundary in the billing journey; it did not recur in the 11 WebKit runs since and is still counted as an error (probably a lazy chunk cancelled by `page.goto`, not verified).
- The first E2E attempt (2026-10-22 22:07) was stopped after ~1 min because the owner's `vite dev` held :3000; its server, workers and throwaway DB were removed, and the owner's dev DB had no new users or songs. For the second run the owner's `vite dev` was stopped with permission and **not restarted**; their Mac workers kept running.
- `Screens/Practice/ManyChords` failed once on WebKit in a partial run and passed in every full run (watch for flakiness).
- Practice route budget: 301.3 of 302 KB. A new message used by the route's pending component made Rolldown split five shell modules out of the entry (+1.6 KB), so the skeleton gets its text from the page. Anything new on the practice route should load on demand.

**For the next step (16)**
- `pnpm --filter @splitune/web e2e:visual` (~4–5 min on Apple Silicon, Docker amd64) after any UI change; `e2e:visual:update` only for intended changes, looking at each diff in `apps/web/test-results/`.
- Re-check 16's a11y items on the polished UI: 200 % zoom, forced colours, VoiceOver/TalkBack, real devices.

## 2026-10-23 — Step 16: Browser compatibility, accessibility and test hardening (MVP gate; partial: real devices pending the owner)
Branch `impl/16-compat-a11y-hardening` from `dev` (`67721ac`). On the owner's request (2026-10-23), fast-forwarded into `dev` with subject-only messages (no bodies or co-author trailers; trees unchanged): `e83dede` import decode fallback, `1684c45` sound delay + keep-screen-on tip, `c14c6e2` fallback E2E, `60e7177` forced colours + 320 px reflow, `747205a` CSP reports + report-only + static headers, `75c542a` ML probe limits, `7d223f9` dependency audit, `abc62a3` matrix/a11y/security/perf/floor specs + CI, `b548682` capo timing test, `64692fc` hydration-safe dates, `74bd10d` magic-link 429 in E2E, `6034f80` two E2E races. Not pushed.

**Built / fixed**
- **Fallback audit (doc 24 §3)** — `e2e/fallbacks.spec.ts`; per row:

| Capability | Primary path | Fallback | How checked |
|---|---|---|---|
| WebCodecs `AudioDecoder` | Mediabunny + decode Worker | `decodeAudioData` | E2E: Worker seen when present; removed → no Worker, loop plays (5 projects) |
| Import local decode | Mediabunny/WebCodecs | `decodeAudioData`, then "Preview after upload" | E2E AAC `.m4a` without WebCodecs → waveform; no decoder → "Preview after upload"; unit tests (`local-audio.test.ts`). **Bug fixed:** the fallback never ran when Mediabunny read the container but couldn't decode (all AAC/MP3 on Firefox Android) |
| Opus stems | AAC-LC for everyone | — | E2E: Opus playback removed, no stem request names Opus. The startup Opus test isn't built, so Opus is never used |
| `outputLatency` | precise compensation | `getOutputTimestamp()` + **Sound delay** setting (new, ±150 ms) | E2E: removed → loop wraps on time; real Bluetooth offset = device checklist |
| `setSinkId` | — (no output picker built) | OS output | E2E: removed, nothing breaks |
| Screen Wake Lock | lock while practising | **"Keep screen on" tip (new)**, once per device from the first play | E2E + story `ScreenMayLock` |
| Media Session / `audioSession` | lock-screen controls / playback session | none needed | E2E: removed, plays |
| Web MIDI | (v1 wait mode) | — | E2E: removed, nothing breaks |
| MediaRecorder | record yourself | Record tab explains, offers File/Link | E2E |
| AudioWorklet / WASM SIMD (hard) | — | `/unsupported` naming the feature; library opens | E2E, all projects |
| OPFS, Background Fetch, vibrate, Share Target, WebGPU | v1 features, not built | — | n/a in MVP |

- **Playwright matrix:** + `tablet-safari` (iPad Pro 11 landscape), `tablet-chrome` (Galaxy Tab S4). `e2e:smoke` (`E2E_SMOKE=1`: journey, practice, onboarding, account on chromium/firefox/webkit) on every PR; full suite nightly (cron 02:00 UTC + manual dispatch) in the same CI workflow. New: account deletion E2E (was missing).
- **Accessibility:** `e2e/a11y.spec.ts` — axe on `/`, `/pricing`, `/library`, `/import`, `/settings/{display,privacy,billing}` and the practice screen in Light, Dark, Stage, each with OS "more contrast", plus forced colours (Chromium); 320 px reflow on every core page; keyboard/pedal-only onboarding → loop → felt clean/not yet → speed → mute → own loop by keyboard → mixer; reduced motion (tokens 0, no running animations while playing with the mixer open); 200 % text on library and practice. **Fixed:** forced colours CanvasText-on-Highlight (1.85:1) on selected/pressed `bg-accent` surfaces and the current nav item; Home's product stills 171 px wider than a real phone (Floor reading sizes); app bar 19 px too wide at 320 px.
- **Security:** CSP `report-uri /internal/csp-report` + API endpoint logging `csp violation` (per-IP limit, 64 KB, no query strings); `CSP_REPORT_ONLY` switch; nosniff/referrer policy on static files (Nitro route rule); `e2e/security.spec.ts`; pinned ffprobe/ffmpeg probe bounds; `pnpm audit:deps` (CI).
- **Floor:** `pnpm --filter @splitune/web css-floor` (CI) on the built CSS; `e2e:floor` runs Chromium 111 / WebKit 16.4 / Firefox 128 in old Playwright images.
- **Performance:** `e2e/perf.spec.ts` (Long Animation Frames during playback; capo redraw at 4× CPU).
- **Hydration across time zones (found by the matrix):** the app shell's allowance meter and the mock portal's renewal line are server-rendered; when the server's day (UTC on Railway) differed from the learner's (e.g. midnight–07:00 in UTC+7) React threw error #418. Formatted in UTC until hydration, then locally (`useHydrated`). Mutation-checked: reverting it brings #418 back on Firefox (UTC).
- **E2E harness fix:** the E2E node worker inherited the local `.env`'s maintenance login, so its lifecycle scheduler and privacy jobs ran against the **dev** database during every E2E run since step 15; it now uses the throwaway one (no dumps, no digest).

**Deviations and decisions** (step-16 notes in docs 10, 11, 17, 18, 24, 27, 28)
- CSP reports use `report-uri` only (Chromium ignores it next to `report-to`, and never delivered Reporting API uploads in testing).
- Smoke vs nightly is file-based (`E2E_SMOKE`), not `@smoke` tags: tagging single tests in serial specs would break their dependencies.
- Keep-screen-on tip: shown from the first play (iOS Auto-Lock defaults to 30 s, shorter than any session) instead of "on the first long session".
- Home's product stills keep Desk reading sizes on every device (they are pictures) and crop at 320 px.
- The first Play press is one ~111 ms frame: `new AudioContext()` in `createEngine` (the browser opening the audio device), which iOS requires in the gesture — recorded, not changed. Nothing ≥ 50 ms during playback.
- **Low-privilege user for ffmpeg/yt-dlp not done** (owner's decision, step 17): the worker is multithreaded, so per-process `setrlimit`/user switching via `preexec_fn` can deadlock; run both workers from a dedicated standard macOS account (own LaunchAgent, or a LaunchDaemon with `UserName`). Everything else in doc 17 §3 holds (timeouts, size caps, file-only protocols, env allowlist, pinned probe bounds).
- `transformers 4.45.1` accepted in `scripts/audit/findings.mjs` (only the optional YourMT3 eval extra imports it).

**Verification**
- `pnpm lint` exit 0 (2 pre-existing infos); `pnpm typecheck` 14/14; `pnpm secrets:scan` (120 commits) no leaks.
- `pnpm test` (turbo, 16 tasks, all green): web 111 (incl. `local-audio.test.ts`, format time zones, headers), api 205 (incl. `csp-report.test.ts`, `/internal/csp-report`; authz matrix 63 alone), db 145, node-worker 33, storage 50, ui-tokens 858, music-core 111, audio-engine 53, contracts 45, analytics 12, notation 9, listening 10, config 1, ML 198 passed + 1 skipped; `vitest run --dir scripts` 33 (incl. audit findings).
- `pnpm --filter @splitune/web test:stories` → **628 passed** (run in two halves, `app/ui`+packages 384 and `app/features` 244: the single full run lost its browser twice while the Mac had ~2 GB of disk free; the earlier full run today was 627/628 with the WebKit "Examples Failed" flake, fixed with a 10 s find).
- `pnpm --filter @splitune/web e2e:visual` → **74 passed** (12 phone baselines updated for the tighter app bar, each diff viewed: header only).
- **Full Playwright matrix** (every spec × chromium, firefox (Linux container + PulseAudio null sink), webkit, Pixel 7, iPhone 15, iPad Pro 11, Galaxy Tab): run 1 **333 passed, 2 failed**, run 2 **336 passed, 2 failed** (92 skipped by design: desktop-only/phone-only/touch-only cases, Chromium-only perf, floor without `E2E_FLOOR`; 4–7 "did not run" after a serial failure). The four failures were all fixed and re-run on their projects: Firefox billing hydration #418 (real bug, above), tablet-safari magic link 429 (helper), WebKit journey finalize race and tablet-safari alphaTab cancellation (tests) — billing Firefox + tablet-safari 16/16; journey + practice on webkit + tablet-safari ×2 60/60.
- Fallbacks (`fallbacks.spec.ts`): 7/7 on each of the 5 phone/desktop projects (35 passed); mutation: without the import fix the AAC test fails.
- Accessibility (`a11y.spec.ts`): axe — no serious/critical on 7 core pages + practice in Light, Dark, Stage, ×more contrast, + forced colours (Chromium) on every project; 320 px reflow 0 px everywhere; keyboard/pedal-only 5/5 repeats on Chromium, WebKit (Option-Tab) green; reduced motion; 200 % text.
- Security (`security.spec.ts`, Chromium/Firefox/WebKit 9/9): nonce CSP, every inline script carries the nonce, no COOP/COEP, nosniff + referrer policy on documents, JS assets, `/sw.js`, manifest and the API; a blocked `img-src` is reported and logged (`csp violation`) in all three engines. **Report-only first:** `CSP_REPORT_ONLY=true pnpm --filter @splitune/web e2e:smoke` → 54 passed, 3 skipped, **0 `csp violation` lines**; enforced since.
- `pnpm audit:deps`: npm 0 critical (5 high, 3 moderate, 1 low — dev-only CLIs: @lhci/cli, shadcn, drizzle-kit/esbuild); pip-audit: workspace 125 packages / torch island 103 / onnx-cpu island 36 → 0 open (transformers 4.45.1 ×43 accepted).
- ML: `uv run pytest packages/stage_decode` 6 passed (probe bounds); ruff, pyright clean.
- Floor (`E2E_FLOOR=1 … e2e:floor`): Chromium 111.0.5563.19 ✓ (tokens in Light/Dark/Stage, AudioWorklet + SIMD, `/unsupported`; no AAC in Playwright's open-source build → "We couldn't load the audio", as designed), WebKit 16.4 ✓ (loop pass 1, no errors), Firefox 128.0 ✓ (loop pass 1, no errors). `css-floor` clean; mutation with `light-dark()`, relative colour, nesting and `@scope` → 4 problems.
- Performance: no Long Animation Frame ≥ 50 ms in 12 s of playback (desktop Chromium); first Play 111 ms (AudioContext construction); capo redraw at 4× CPU on Galaxy Tab median **36 ms** (43/39/34/35/36); `buildTab` (Node, dense 4-min part) 7.6 / 17.7 ms mean; practice route JS **301.5 KB of 302 KB** (`budget --enforce`).
- CI YAML validates (`check-jsonschema` github-workflows); not run on GitHub (nothing pushed).

**Release gate (24 §6 / 18 §7)** — automated parts green on Playwright's three engines + 4 device emulations: import → analysis → practice (loop at 70 %, count-in, mixer, tab cursor sync), billing checkout, account deletion; PR checks; nightly matrix (as run here); accessibility checks; no open critical security findings. **Open, need devices or the owner:** real-device audio checklist (below), real Safari macOS/iOS sign-off (Playwright's WebKit is not Safari), Samsung Internet, VoiceOver/TalkBack pass, Bluetooth offset, page-turner hardware, PWA install on iOS/Android, ML regression on the pinned pipeline (not run this step), usability round (15a), low-privilege worker account (step 17).


**Real-device checklist (deliverable 3): not run — needs the owner's devices.** I have only this Mac (macOS 27, Apple Silicon) and Playwright's engines; no iPhone/iPad, Android, real Safari or Firefox desktop session with audio, page turner or Bluetooth headphones. Serve over HTTPS for phones (Tailscale serve or Caddy + mkcert, doc 25), open `/start` (example song) and a song of your own, and fill in:

| # | Device · OS · browser (versions) | Loop seam (100 % / 70 %) | 0.5× quality | Count-in on the downbeat | Sound delay (Bluetooth: cursor vs sound, value that lines up) | Interruption (call / Siri) → "Tap to resume" | Pedal keys (page turner) | PWA install / Home Screen | Keep-screen-on tip or screen stays on | VoiceOver (iOS/macOS) / TalkBack | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | iPhone · iOS … · Safari … | | | | | | | | | | |
| 2 | iPad · iPadOS … · Safari … | | | | | | | | | | |
| 3 | Mac · macOS 27 · Safari 27 | | | | | n/a | | | | | |
| 4 | Mac · macOS 27 · Chrome … | | | | | n/a | | | | | |
| 5 | Android · … · Chrome … | | | | | | | | | | |
| 6 | Android · … · Samsung Internet … (if available) | | | | | | | | | | |
| 7 | Firefox desktop … | | | | | n/a | | n/a | | | |

Severity for failures: 1 blocks the release gate (24 §6), 2 fix before step 18, 3 log.

**Known gaps**
- Everything in the device table above; no real Safari, iOS, Android, Samsung Internet, Firefox-with-audio on hardware, VoiceOver, TalkBack.
- Chrome 111 playback unverified (Playwright's Chromium 111 has no AAC; Chrome for Testing starts at 113).
- The three unrouted `songs.*` contract procedures (`putYoutube`, `deleteYoutube`, `putSyncPoints`) are outside the authz matrix until routed.
- Dev-only npm advisories (high) not fixed: they live in @lhci/cli, the shadcn CLI and drizzle-kit's esbuild, none in the shipped app.
- The Mac had 0.7–5 GB of free disk during this step; I removed the two floor images I pulled (~5.4 GB) and stopped the `pw-firefox` container I started. Other Docker images/build cache (~16 GB reclaimable) are the owner's.
- Local leftovers: `splitune_e2e_*` databases are dropped by global teardown; the dev database's lifecycle runs (from before the E2E fix) did nothing (0 stems swept, 0 exports expired, no dumps).

**For the next steps**
- Step 17: set `CSP_REPORT_ONLY=false` (or trial a changed policy with `true`), decide the workers' macOS account, run `pnpm --filter @splitune/web e2e:floor` monthly (pulls ~5.4 GB of images), CI's nightly needs nothing extra.
- Steps 18–20: anything new on the practice route must load on demand (0.5 KB left); new server-rendered dates go through `useHydrated` + `formatDate(…, 'UTC')`.

## 2026-10-23 — Step 17: Deploy — Railway (`app`, Postgres) + Cloudflare R2 wiring + Mac workers (partial: signed-in device smoke test and real sleep/wake pending the owner)
Branch `impl/17-deploy-railway-and-mac` from `dev` (`6034f80`); fast-forwarded into `dev` and pushed to `origin/dev` as each piece deployed (owner chose GitHub autodeploy on `dev`, which needs the pushes): `d03e591` image + IaC, `7605514` immutable fonts/icons, `a2293b5` worker keepalive, `2846924` worker env isolation + launchd, `ee0bea1` pg_dump TLS, `7b0a024` storage test on R2, `4703bc8` CORS + IaC drift, `03c184b` production examples, `27eff50` stylesheet fix, `5824555` model-ref contract fix. (`03c184b` was committed on `dev` by mistake, then the branch was rebased onto it; history is linear.)

**Approved plan (owner "yes", 2026-10-23):** Railway Postgres + service `app` + generated domain in Singapore, ≈ $2–4.5/month extra; free R2 token `splitune-app` + CORS; source GitHub `dev`; workers as the owner's own account (LaunchAgents); backups to `~/Splitune-backups` for now. Rollback: `railway service delete` (app, Postgres), `cf accounts tokens delete` (splitune-app), `cf r2 buckets cors delete`, `pnpm workers uninstall`.

**Built / done**
- **Railway** (`infra/railway/railway.ts`, TypeScript IaC — `railway.json` is deprecated for new services): `Postgres` (`postgres-ssl:18`, PostgreSQL 18.6, volume 5 GB cap) and `app` (Dockerfile build from `hnatien/Splitune@dev`, watch paths, pre-deploy `node packages/db/scripts/migrate.ts`, health check `/internal/ready`, serverless sleep), both `asia-southeast1-eqsg3a`. Domain **https://app-production-d679.up.railway.app**. Postgres TCP proxy `interchange.proxy.rlwy.net:42309` (created with `railway api tcpProxyCreate`: the IaC `postgres()` helper makes none). `railway config plan` → "already up to date".
- **`infra/railway/Dockerfile`:** `dsp.wasm` built in the pinned Emscripten stage and checked against `dsp.wasm.sha256` (passes on Railway's amd64 builders), filtered pnpm install, Nitro build, runtime = `.output` + `@splitune/db` prod deps for the migration; non-root; ~94 MB. Fails if the server links a stylesheet the client build didn't emit.
- **Variables:** literals in IaC; secrets piped with `--stdin` (`BETTER_AUTH_SECRET`, `BILLING_WEBHOOK_SECRET`, `ANALYTICS_SALT`, R2 `S3_*`); SMTP set by the owner (Gmail). Names in `19` step-17 notes. `CACHE_SCOPE`/`SPLITUNE_CALLBACK_SECRET` not on `app` (the API reads neither; `CACHE_SCOPE` is in `.env.worker`).
- **R2:** token `splitune-app` (Item Read + Write, `splitune-media` only) piped into Railway; CORS committed + applied; `.env.r2` → `.env.worker`, then deleted. Exactly two Splitune tokens. Doc 25 §6 "State" updated.
- **DB roles:** `pnpm db:roles` as owner over the TCP proxy → `ml_worker`, `node_worker`, `maintenance` can log in (passwords generated into `.env.worker`, never printed); `app`, `dashboard_reader` NOLOGIN.
- **Mac workers:** `.env.worker.example`; `pnpm workers install|restart|status|uninstall` (launchd agents `com.splitune.node-worker`, `com.splitune.ml-worker`: RunAtLoad, KeepAlive, logs `~/Library/Logs/Splitune/`). **Only the agents read `.env.worker`** (node `--env-file`, ML `SPLITUNE_ENV_FILE`); `.env`-only for dev/E2E (before, every worker read both, so a production `.env.worker` would have pointed local and E2E workers at production). TCP keepalive (30 s idle) on worker DB connections; libpq keepalives in `ML_DATABASE_URL`. Deno 2.9.7, yt-dlp 2026.08.19, ffmpeg 8 present.
- **Fonts/icons** `/fonts/**`, `/icons/**`: `cache-control: public, max-age=31536000, immutable` (Nitro route rules; fixed names → a changed file needs a new name). `font-src 'self'`; Storybook not deployed.
- **Backups:** nightly `pg_dump` (node worker, 03:30 local) as `maintenance` to `PG_DUMP_DIR=~/Splitune-backups/pg_dump`, keep 14. Restore documented in `19`.
- **Production examples:** `pnpm examples:build` with the Mac workers serving production (real MPS pipeline, ~50 s each; same audio hashes, tempi and loops as before); manifest committed.

**Bugs found and fixed on the way**
- Stylesheet 404 on every page in the image (Tailwind scanned the client `.output` during the SSR build because the image lacked `.gitignore`; pages were unstyled until JS). Fixed + build guard; mutation-checked.
- Nightly `pg_dump` failed over the TCP proxy (`invalid sslmode value: "no-verify"`): libpq spelling now passed. Test added.
- Analytics events were never recorded for real analyses (model-ref pattern rejected `bs_roformer:BS-Roformer-SW`, `panns/cnn14@mAP=0.431`, `…@0.17.dev0@27f032e`, long YourMT3 version). Pattern widened, still rejects free text; mutation-checked. The three example analyses built before the fix have no events (system user; not backfilled).
- Storage suite on R2: unsigned GET is `400 InvalidArgument` there (403 on SeaweedFS); the test accepts either denial.

**Deviations**
- Health check `/internal/ready` (the prompt's `/v1/ready` doesn't exist). Pre-deploy runs `node packages/db/scripts/migrate.ts` (what `pnpm db:migrate` runs; no pnpm in the image).
- Railway created the database in US West despite the IaC region; moved (empty) to Singapore right after creation (`--confirm-destructive`, volume migration of an empty database).
- TLS to Railway Postgres is encrypted but unverified (self-signed `CN=localhost` / `root-ca`).
- Workers run as the owner's account (owner's choice); dedicated low-privilege account still open (17).

**Verification**
- Approved plan: above. `railway status --json`: `app` SUCCESS (`5824555`), `Postgres` SUCCESS, both `asia-southeast1-eqsg3a`, volume READY. **Deployment `098bab6f` (`5824555`) status `SUCCESS`** (earlier: `37dfacde` first healthy deploy after SMTP, `ee2ea6ce` `03c184b`, `03ae3d2e` `27eff50` — all SUCCESS). First deploys `10d667a7`/`3c825bea`/`ee35d737` FAILED: superseded / health 500 until SMTP existed.
- `curl` production: `/internal/ready` 200, `/` 200, `/v1/me` 401, HSTS, nonce CSP with `https://*.r2.cloudflarestorage.com` in `connect-src` + `media-src`, nosniff, referrer policy, fonts `immutable`, `styles-BFKcyqJB.css` 200 `text/css`.
- `cf r2 buckets cors get splitune-media`: the rule above. Preflight `OPTIONS` (PUT, `content-type`) on a presigned PUT: **204** with `Access-Control-Allow-Origin: https://app-production-d679.up.railway.app`; other origin **403**. Ranged GET with Origin: 206 + ACAO + exposed headers.
- `pnpm --filter @splitune/storage test` against R2: 50/50 (and 50/50 on SeaweedFS).
- Browser (desktop, built-in browser pane, Chromium): `/start` → instrument → level → screen → example practice screen (Stitch Up, loop bars 7–10 at 70 %), playback ran (pass 1), stems fetched from R2 cross-origin (200, 609 KB). Console: only the stylesheet 404 before its fix; production logs 0 `csp violation`, no warn/error.
- **Mac offline → queued → online:** workers stopped 3 min (heartbeats 193 s old > 120 s offline threshold; 8 jobs queued), restarted → the queued Full analysis (real MPS) completed ~70 s later; `analysis_done` + 8 stage events recorded.
- Simulated network faults (local, TCP proxy): 60 s outage → both workers recovered in ~6 s, no crash; silent black-hole of open sockets → heartbeats continued (pool reconnects), LISTEN went silent (polling fallback) — keepalive added for that case.
- Backup: production dump 133 KB; restore drill into a scratch local database (15 migrations, 30 tables).
- Local image vs local stack: migrations + server from the image, `/internal/ready` 200, `dsp.wasm` served = recorded hash.
- `pnpm lint` 0; `pnpm typecheck` 14/14; `pnpm test` 16/16 tasks green on the second run (first run: api global setup's `roles.ts` failed while suites ran in parallel — passes alone 205/205; pre-existing race, see gaps); `vitest run --dir scripts` 36; ML 201 passed + 1 skipped; `pnpm secrets:scan` 130 commits, no leaks.
- `e2e/security.spec.ts` (new immutable-cache test) **not run**: the owner's `pnpm dev:all` held :3000, so Playwright hit the dev server; the same headers were checked with curl against the image and production.
- **Usage:** before deploy, workspace $5.557 (estimate $6.993), no limit. After deploy (~1.5 h): project `splitune` $0.0035 (Postgres $0.0026, app $0.0008); workspace $5.567 (estimate $6.981). R2: 76 objects, 45 MB (examples 6.8 MB) of 10 GB-month free. **Recommended (not set):** `railway usage limit set --workspace bf36cb87-3d4c-4cc6-9832-2ef12ef3bf28 --target workspace --soft 10` (email alert only).

**Not done / needs the owner**
- **Signed-in smoke test on a phone/iPad over cellular** (sign in, browser multipart upload, Full analysis, practice, Light/Dark/Stage, Stand size at the music stand): I may not sign in or create accounts on the production site, so the browser upload path from the Railway origin is verified only up to the preflight + presigned PUT/GET level. The acceptance criterion "from a phone/tablet on cellular" is open.
- **Real Mac sleep/wake and network change** (I can't sleep the Mac without suspending this session): simulated only. Test: close the lid 5+ min, wake on another network, check `pnpm workers status` and that a queued analysis completes.
- Usage check after a few days. Serverless sleep confirmed: deployment `098bab6f` showed `SLEEPING` ~13 min after the last request.
- Test data left in production: system-user song/analysis "smoke-offline" and `assets/examples/smoke-offline/…` (~2 MB) in R2; not in the shipped manifest.

**Known gaps**
- `roles.ts` in parallel test setups (`ALTER ROLE` is cluster-wide) can race when turbo runs db/api/node-worker suites at once: one failure in two full runs today.
- Backups go to the internal disk until an external disk is set in `PG_DUMP_DIR`.
- Dedicated low-privilege macOS account for the workers.
- Local development's onboarding now reads the production examples manifest; set `EXAMPLES_MANIFEST` to a local build for local `/start`.

**For the next steps**
- Deploys: push to `dev` (watch paths) and confirm `SUCCESS` with `railway deployment list --service app --json`; infrastructure changes go through `infra/railway/railway.ts` (`plan` must be clean).
- New server env vars: add to `railway.ts` (literal or `preserve()`), `.env.example`, and `19` (names).
- Worker code changes reach production with `git pull` + `pnpm workers restart` on the Mac.

## 2026-10-23 — Step 17c: Practice screen redesign (guitar) — tab first, one transport (partial: visual baselines and e2e not run)
Branch `impl/17c-practice-redesign` from `dev` (`ad52581`); not committed yet (owner to decide). Research: a competitor review of Songsterr, Soundslice, Ultimate Guitar, Guitar Pro 8, Moises, Chordify, Fender Play, Yousician, Rocksmith+, Transcribe!, Capo (Reddit unreadable to the tools; player opinion from BassBuzz forums, App Store reviews, editorial reviews). Mockup canvas approved by the owner ("Looks good, build it"), then the owner asked for the loop, display and mixer panels to be fixed too.

**Why it looked messy:** a whole-song loop (bars 1–95) drew the loop fill plus a 2 px rule above and below every bar; tab line spacing stayed at Bravura's default while the digits were at reading size, so stacked digits overlapped; the video took 40 % of the width; a full-width audition banner, boxed chord chips with a long legend chip, and three tray styles in the transport competed.

**Built** (details and the owner-approved deviations in `27` and `26` "Implementation notes (step 17c)")
- Notation (`packages/notation`): tab line spacing follows the digit size (`tabLineSpacing`, test); tempo and dynamics hidden; chord names over the bars in the reading font (`music-core` `chordNames`, "?" on low-confidence chords, test); loop = fill + rail + A/B flags; view isolated under floating layers.
- Practice screen: status bar (title + part · BPM, dashed legend chip, Tab/Chords switch, video toggle, ⚙, ⋯); chord strip on the paper (current chord + shape, next six names, level/capo popover); song overview replacing the timeline; transport (round play, joined loop toggle + badge, speed capsule, helpers, pass pair pinned right with "How was pass N?", two rows on phones); floating video player (closed by default); notices in one slim stack; glance view shows the chord shape.
- Panels: hairline-separated sections; content-sized segmented controls; loop options as rows with nudges at 44 px; display reading-size value on its label row; mixer drawer 352 px with a vertical preset list and stem cards laid out by container query.
- Stories: Screens/Practice LoopActive (rail/flags asserted), ChordsView, WithVideo, LegendChip, LevelAndCapo; kit transport and chord stories updated to the new bar and chips.

**Verification**
- `pnpm lint` exit 0; `pnpm --filter @splitune/web typecheck` exit 0.
- Unit: web 113/113, music-core 112/112, notation 10/10.
- `pnpm --filter @splitune/web test:stories`: 828/828 (Chromium + WebKit). One WebKit flake fixed (the chord-strip story looked for the list before the chord layer loaded).
- Practice route JS: **301.2 KB gzip** of 302 KB (dev was 305.1 KB, already over); the status bar's chip/switch/toggle and the chord shape load on demand.
- Visual check in Storybook (Stage, Dark, Light; 1440 × 900, 1180 × 820, 375 × 812) and headless Playwright (video player).

**Not done / needs the owner**
- **Visual regression baselines** (`e2e/visual`, practice screens change by design): Docker wasn't running. Run `pnpm --filter @splitune/web e2e:visual:update` with Docker up and review the diffs.
- **E2E** not run (needs the local stack); `e2e/practice.spec.ts` phone step updated to the Tab/Chords switch. `pnpm --filter @splitune/web e2e` with the stack up.
- Real devices not checked. The phone-portrait layout was seen with touch emulation (375 × 812); the tablet layouts (coarse pointer) were not — 1180 × 820 was checked as the desktop layout only.

## 2026-10-23 — Step 17d: Piano practice redesign — chord chart, keyboard voicings, key spelling (done; not committed)
Branch `impl/17d-piano-chart` from `dev` (`fe72c67`). The owner's own commit `e5fa503 feat: improve CLI design` (dev CLI + bar-number removal) landed on this branch while the step ran; this step's work is uncommitted on top of it. Owner asked: "Redesign the whole piano practice page … what pianists prefer to read while playing". Piano songs get beats, chords, key and stems today (no `notes.piano` stage: `NOTES_INSTRUMENTS` = guitar, bass, vocals), so the page showed a grid of chord cards spelled by the model (D#maj7 in E♭ major). Mockup canvas approved: "Looks good, build the chord-chart redesign. Piano note transcription can come later as its own step."

**Research** (subagent; Reddit and Piano World unreadable to the tools, so forum opinion is thin): pop/singer-songwriter adults read lead sheets and chord charts; falling notes help novices but encourage memorising (P.I.A.N.O., ITS 2014; Synthesia reviews). Chart conventions: 4 bars per line, beat slashes, N.C., real ♭/♯ with raised extensions, key-correct spelling (Synthesia labels, MobileSheets forum). Voicing help: iReal Pro two-hand keyboard with inversions; Soundslice keyboard with hand colours and LH/RH toggle. Eye–hand span ≈1 s regardless of skill (Furneaux & Land 1999; Sloboda; Rosemann et al. 2016 via Lim et al. 2019). Stand at 50–100 cm.

**Built**
- `music-core`: `keyNoteNames(key)` (scale letters, minor leading tone, key's accidental style; unreadable tonic → common spellings); `chordDisplayName(label, bass, names)` respells root and bass; `buildTab` spells tab chord names by the effective key moved with the playback transposition; `pianoVoicing` / `voiceChords` (LH bass C2–B2, RH close position E3–C5, smooth = least movement from the previous chord, root = stacked from root or third). Tests: spelling, voicing, tab names.
- `ui-tokens`: `--key-*` tokens in every appearance + forced colours, contrast pairs, Tailwind colours. `notation`: `KeyboardDiagram` (SVG, intrinsic size, L/R marks, middle C, cross-fading keys).
- Web: piano chord chart, piano strip, Piano options (chord level Simple/As played via the Worker; voicing and hands as practice defaults), glance keyboard, status-bar key, `ChordSymbol` for every chord name, piano levels (`simplified`, `as_transcribed`), note names from the Worker (`MusicOutput.noteNames`). Docs 26 and 27 "Implementation notes (step 17d)".
- Stories: Screens/Practice `Piano`, `PianoLoop`, `PianoOptions`, `PianoDark`, `PianoStage`, `PianoGlance`; Kit `Symbols`, Notation `Keyboards`.

**Verification**
- `pnpm lint` exit 0 (2 pre-existing infos); `pnpm typecheck` 14/14.
- Unit: music-core 126/126, notation 10/10, ui-tokens 1174/1174, web 121/121 (`chart.test.ts` new, view-model spelling + simplified level).
- `pnpm --filter @splitune/web test:stories`: **844/844** (Chromium + WebKit). An earlier full run had a WebKit out-of-memory crash, an existing "Legend Button" failure that passed on rerun, and a race in the Piano story (fixed: it now waits for the strip's first frame).
- **Route budget** (`budget --enforce`, exit 0): **302.0 KB of 302 KB** (base `fe72c67` built in a temporary worktree: 300.9 KB). On the way: a computed `m[...]` message lookup pulled the whole catalogue in (+30 KB, fixed with static calls); key spelling moved into the Worker; `ChordSymbol` merged into `chord-chip.tsx` with `'use no memo'`; the piano chart served from the chord-sheet chunk. **Under 0.1 KB left: the next practice-route change needs to free space first.**
- Storybook by eye: 1440 × 900 Light (playing, loop), Stage, 820 × 1180, 390 × 844 glance.

**Not done / needs the owner**
- Not seen in the real app with your Strawberry Guy analysis (the built-in browser isn't signed in to your local app). Open it on :3000 (HMR has the changes).
- E2E and visual baselines not run (needs the stack free on :3000 and Docker for `e2e:visual:update`); guitar practice baselines change too (♭/♯ glyphs, raised qualities, key in the status bar).
- Piano notes (grand staff / falling notes) are the follow-up step: a `notes.piano` stage (YourMT3 programs 0–7 or a piano model), hand split, rendering; accuracy on separated piano stems is unmeasured.

## 2026-10-23 — Step 18: Piano notes — Transkun stage, hand split, falling-notes roll (done; not committed)
Branch `impl/18-piano-notes` from `dev` (`3c383cc`); uncommitted. Started from the step-17d session. Owner chose the **falling-notes roll** over the grand staff (2026-10-23, asked after the music-core work, before any UI). Personal mode: no counsel gate.

**Measured first (P2 piano, `services/ml/eval/results/p2/2026-10-23.md`)** — onset F1 (±50 ms), shipped `notes.piano` stage in-process, BS-Roformer-SW stems:

| transcriber | MAESTRO test + MUSDB band (16): clean / **stem** / mixture | BabySlakh (17): clean / **stem** / mixture |
|---|---|---|
| Transkun V2 | 0.974 / **0.946** / 0.828 | 0.927 / **0.732** / 0.489 |
| YourMT3+ | 0.907 / **0.900** / 0.839 | 0.978 / **0.750** / 0.914 |
| Basic Pitch | 0.687 / **0.645** / 0.328 | 0.759 / **0.631** / 0.316 |

BabySlakh stems by patch: acoustic piano only Transkun 0.835 / YourMT3+ 0.887 (n = 6); with electric piano, clavinet or harpsichord 0.676 / 0.675 (n = 11). Gate (≥ 0.80 in a band, stem ≥ mixture): **PASS** for Transkun and YourMT3+. Chosen: **Transkun** (best on real acoustic piano, out-of-sample on Slakh, 56 MB vs 759 MB, ~6 s per 30 s on CPU or MPS). Caveats: Transkun and YourMT3+ trained on MAESTRO's training split (same pianos/rooms as the test excerpts), YourMT3+ on Slakh; electric pianos fall below the gate and nothing tells them apart yet. Calibration: one knot at held-out precision 0.869 → every note 0.918 (ECE 0.131 → 0.049).

**Built**
- **ML:** `stage_notes.transkun` (`NoteTranscriber`; weights `2.0.pt`/`2.0.conf` from the PyPI wheel via `scripts/fetch_models.py transkun`, verified against the new register record `transkun-v2`, amber), `notes.piano` stage module, `TRANSCRIBER_ISLANDS` transkun → torch/MPS, `stage-notes[transkun]` extra (training-only requirements trimmed with `[[tool.uv.dependency-metadata]]` in the workspace and torch island), YourMT3 `PROGRAMS` piano 0–7, `notes.personal.yaml` piano → transkun, `views.yaml` piano notation supported + `quality_gate: pass`, calibration table. Eval: `p2.py build-piano` (MAESTRO via HTTP range requests; register `maestro-v3`, eval only), BabySlakh piano references, `predict --instrument`, piano in calibrate/report, patch breakdown.
- **API:** `NOTES_INSTRUMENTS` + piano (finalize writes the summary only; no `tab.piano`). `view_changed` analytics accepts `notes`.
- **music-core:** `splitHands` (Viterbi hand split over onset groups: reach, crowding, split movement, pull to middle C) and `buildPianoScore` (corrections → quantize → one sounding note per key → hands). 32 ms for a dense 4-minute part (3,360 notes).
- **notation:** `PianoRoll` (canvas, clock-driven, reduced-motion paging), `keyboardKeys` (geometry shared with `KeyboardDiagram`), `rollRange`, `rollWindow`, `soundingNotes`; `KeyboardDiagram` `height`.
- **Web:** music Worker returns `piano.notes`; notes load for piano with the summary; `layers.roll`; status bar **Chart / Notes**; Notes default when the gate passes, chart + "Show notes anyway" banner below it; `piano-notes.tsx` (roll + full-width keyboard lighting the sounding keys, accessible "Sounding now: …" spelled in the song's key; tap the roll to loop bars) loaded through the chord-sheet chunk; piano strip hides its voicing keyboards over the notes. Docs 21, 08, 26, 27 "Implementation notes (step 18)".
- **Stories:** Screens/Practice `PianoNotes`, `PianoNotesBelowGate`, `PianoNotesLoop`, `PianoNotesDark`, `PianoNotesStage` (synthetic two-hand part with a low and a medium half bar).

**End to end (owner's Mac, local stack, this branch's workers):** "Strawberry Guy – Mrs Magic (Strings Version)" (3:42, from the local library) Full analysis **done in 64 s** (`notes.piano` ≈ 22 s on MPS): 1,211 notes from the piano stem (A♯1–D♯6), summary `recommended_view: roll`. Viewed in this branch's app (:3010, a local test account `e2e-piano-18@splitune.test` with its own copy of the song): Notes by default, notes fall onto the keys, sounding keys light by hand, the chord strip stays in step on the same clock, two taps on the roll set a loop. Sync was checked against the shared audio clock (roll, keyboard and strip agree), not by ear.

**Verification**
- `pnpm lint` exit 0 (2 pre-existing infos); `pnpm typecheck` 14/14; `pnpm contracts:check` up to date.
- Unit: music-core 135/135 (9 new), notation 16/16 (6 new), ui-tokens 1182/1182, web 122/122, contracts 45, node-worker 34, api 207/207 (planner test new; `analyses.test.ts` keeps its request count — an extra HTTP analysis tripped the 30/h user limit in a later test), db 147/147 (api and db failed once in the parallel `pnpm test` on the known `roles.ts` race, then passed run alone). ML: `uv run pytest` 202 passed + 1 skipped (Transkun stage test runs the real weights), ruff clean, pyright 0 errors.
- `pnpm --filter @splitune/web test:stories`: **853/854**. The one failure, `Chords View` on WebKit (Tab region not yet visible after switching back), fails the same way on a clean `3c383cc` checkout: pre-existing. A first full run had 39 failures from Vite optimising a new dependency mid-run (cold cache in this worktree); the rerun is the one counted.
- Route budget (`budget --enforce`, exit 0): **301.9 KB**, 309,109 B vs base 309,006 B built the same way: **+103 B, 139 B left**. Roll chunk 4.4 KB gzip, loaded only in Notes.
- Visual: Storybook Light/Dark/Stage at 1440 × 900, tablet portrait 820 × 1180, playing with a loop; the real song in the app.

**Not done / needs the owner**
- **Production Mac workers** still run the old code: after merging, `git pull`, `uv sync --project services/ml/islands/torch`, `pnpm workers restart` (Transkun weights are already in the shared `~/.cache/splitune/models/transkun`).
- Grand staff (alphaTex, two staves) not built; PM2S hand model not used; solo-piano detection not built.
- Electric piano / clavinet songs score below the gate; consider a per-song gate (tagger or timbre) or an owned pop-piano P2 set.
- Not checked: real devices, the 60 fps / one-frame acceptance on a mid-range tablet, forced colours, reduced motion in the browser (unit-tested paging only), phone landscape with touch (at 844 × 390 with a fine pointer the existing layout leaves no paper — the chord chart story looks the same).
- E2E and visual baselines not run (practice baselines change for piano songs with notes).

**Local leftovers:** local DB has the analysis `ccb8bd52-…` on the owner's song and a test account with one song copy (`376b59cd-…`, raw audio copied in local SeaweedFS). Docker was started for the run and stopped again; SeaweedFS CORS was widened to :3010 during the run and restored.

## 2026-10-24 — Step 18a: Piano grand staff (done; not committed)
Branch `impl/18a-piano-staff` from `impl/18-piano-notes` (`1253141`); uncommitted, in worktree `pensive-chaplygin-f6627e`. Started from the step-18 session. 21 V4 / ux/music-display-ui "upgrade path to staff notation": a third piano view next to the roll.

**Built**
- **music-core:** `toPianoAlphaTex` (`export/alphatex-piano.ts`): one track and two `\staff {score}` staves with the right hand on treble and the left on bass. It sets `\instrument acousticgrandpiano`, without which alphaTab writes the staves an octave up like a guitar. Notes are spelled for the key (`keyNoteNames`: E♭ not D#, B#3/Fx4 octaves right) under `\ks` on both staves. Ties use `{t}`; durations, ties across bars, dots, swing triplets and pickups are shared with the tab writer (`export/alphatex-bars.ts`, moved out of `alphatex.ts` unchanged, and the tab goldens are unchanged). Up to two voices per hand: a chord that rings ≥ an eighth past the hand's next onset moves to the second voice, and a held part in the hand's lower half (a bass note under a moving line) takes the lower voice. A shorter legato overlap ends at the next onset. With both voices busy, the earlier one is cut. Each bar picks its clef with hysteresis: a bass staff turns treble when the bar's middle note is ≥ E4, a treble staff turns bass below A♭3. `noteMap` carries the staff. `buildPianoScore` returns `alphaTex` / `alphaTexFirstBar` / `noteMap`, and there is a new CLI command `build-piano` with goldens `build-piano.two-hands` (E♭ from a D# key, held voices, tie over the bar line) and `build-piano.pickup` (A minor, G#).
- **notation:** `NoteRef.staff` (string now optional); `noteOf` reads that staff. `cursorAt` takes beats from every staff and voice, one per tick, so the cursor lands on a left-hand note while the right holds. `AlphaTabView`'s default `markers` is now one constant: the default `[]` re-ran the overlay effect every render, an infinite update loop for any caller that passes no markers, the first being the staff.
- **Web:** the Worker returns `piano.staff`, and the status bar is now **Chart / Notes / Staff** (`view: 'staff'` in practice-store, session-only like Chart/Notes). `piano-staff.tsx` is lazy through the chord-sheet chunk, with alphaTab lazy inside it, and reuses `AlphaTabView`, so the cursor, current bar, loop band and rail, bar taps (A/B) and the confidence outlines all work as on the tab. Bars are named "Bar 3: A♭maj7, B♭7; notes A♭2, …" in the song's spelling. The `view_changed` analytics event accepts `staff`.
- **Stories:** `PianoStaff` (switch order, pressed state, bar names, 4 low + 4 medium marks, cursor on bar 2's notes after → →, back to Notes), `PianoStaffLoop`, `PianoStaffBelowGate`, `PianoStaffDark`, `PianoStaffStage`; `PianoNotes` expects the third button. `ChordsView` waits for the Tab layer's fade-in (it failed 2 of 3 runs in Chromium here: the known flake from step 18).

**End to end:** this branch's production build on :3010 (local stack, test account `e2e-piano-18@splitune.test`, song `376b59cd-…`, the "Mrs Magic" copy). Staff renders 95 bars, 1,211 notes all mapped, 34 confidence outlines, E♭ signature on both staves, left-hand voices and ties. Playing: after the clip's count-in the cursor crosses bar 19 and wraps at the loop end; with the loop off it moved through bars 19 → 20 → 21 and the page flipped to the next system. buildPianoScore including the staff: 12–16 ms for this song in Node; the alphaTab layout is 46 ms in Node.

**Verification**
- Biome clean (2 pre-existing infos); tsc: contracts, music-core, notation, web (+ sw), api.
- Unit: music-core 147/147 (12 new incl. a 150-run property test through alphaTab's importer: no diagnostics, every voice fills its bar, every note mapped once at pitch, every other note a tie), notation 18/18 (2 new), web 122/122, contracts 45/45, api 207/207.
- Stories: full storybook suite 864/864 (both browsers) before the last two exporter fixes; practice + ui stories 628/628 after them. A first full run had 32 failures from Vite optimising dependencies mid-run (cold cache); the rerun is the one counted.
- Route budget (`budget --enforce`, exit 0): **309,187 B of 309,248 B: +78 B over step 18, 61 B left** (mostly the "Staff" message). The staff chunk and alphaTab load only when Staff is chosen.

**Not done / follow-ups**
- Staff choice isn't remembered across visits (session-only like Chart/Notes; a persisted default would cost route bytes).
- No 8va for very high right-hand passages (this song's intro sits 3–4 ledger lines up); staff size doesn't follow the distance preset (alphaTab `display.scale`); odd intro meters (1/4, 2/4, 5/4) come from the beat grid, not the writer.
- Not checked: real devices, forced colours, phone layouts, screen readers by ear, E2E and visual baselines.

**Local leftovers:** Docker was started for the run and its services stopped again; SeaweedFS CORS was widened to :3010 during the run and restored to `infra/seaweedfs/cors.json`. `packages/audio-dsp/dist/dsp.wasm` was copied from the step-18 worktree (ignored, sha256 matches) so the web build works here.

## 2026-10-24 — Step 18b: Guitar and bass Notes view — Phase 1 design
Branch `impl/18b-guitar-notes` from `dev` (`6b15c01`). **Owner's choice, 2026-10-24:** direction A (tab lanes into the neck) — "use what you recommends and would work the best."

**Research** (subagent, `docs/specs/assets/18b/research.md`): Yousician uses direction A (horizontal lanes in tab order, notes right → left onto a now line); Rocksmith's 3D Noteway draws complaints about perspective spacing hiding timing and its mirrored string order, and Ubisoft ships a 2D tab view as an accessibility alternative; Soundslice's fretboard greys the current bar's positions and highlights the sounding notes (support for ghost previews). No controlled study compares orientations; no stand-distance data.

**Mockups** (`docs/specs/assets/18b/`, private artifact https://claude.ai/artifact/DRmFJJh8xxNFT6BBtGDgD3): one canvas page on the real tokens and real data — the owner's "Risk It All" guitar (798 notes, 70 bars, frets 0–13, 140 medium / 73 low, 26 unplayable; tab built locally with music-core and swing quantization off, see below) and the "Stitch Up" bass example (4 strings). A (tab lanes into a neck window), B (chord-box fall: strings as columns onto a chord-diagram neck — B's best case, since frets-on-x leaves strings without an axis), C (3D). 18 matrix PNGs (3 directions × Light/Dark/Stage × 1180 × 820 / 844 × 390) + 8 state PNGs. Recommendation: **A**. B stacks strummed 16ths into overlapping towers on the short axis and leaves about 50 px for the box on a phone; in C, digits fall below the 18 px floor 0.67 bar ahead.

**Found on the way (out of scope, not fixed):** `buildTab` throws `alphaTex: cannot express 160 ticks at 1440 (swing=true)` (`export/alphatex-bars.ts` `split`) on the owner's "Risk It All" guitar notes, so finalize failed 3× (`internal_error`) and the analysis `ad3e94b9-…` is `failed`. The practice Worker would hit the same throw. Needs its own fix with a regression test from these notes.

**Phone landscape:** the current chrome leaves no paper at 844 × 390 (confirmed in Storybook, as step 18 noted). The mockup folds the chord strip into the status bar on phone landscape, which gives A six 30 px lanes; Phase 2 needs that layout change.

## 2026-10-24 — Step 09c: Workers on a Windows PC with an NVIDIA GPU (CUDA)
Branch `impl/09c-cuda-worker-wsl` from `dev`. Enables NVIDIA GPU acceleration (CUDA) alongside macOS MPS for ML workers and development on Windows/WSL2.

**Built**
- **Contracts:** Added `'cuda'` to `Separation.device` in `packages/contracts/src/analysis/separation.ts`; bumped `SCHEMA_VERSION` to `1.5.0` in `common.ts` and updated tests (`common.test.ts`, `test_contracts.py`). Regenerated schemas (`pnpm contracts:gen`) and verified drift check (`pnpm contracts:check`).
- **Device abstraction:** Created `services/ml/packages/splitune_ml_core/src/splitune_ml_core/device.py` (`torch_device()` with `ML_TORCH_DEVICE=auto|cuda|mps|cpu`, `synchronize()`, `empty_cache()`, `peak_memory()`). Unit tested with mocked torch in `test_device.py`.
- **Stages & Worker:** Replaced hardcoded `"mps"` in `stage_separation` (`models.py`, `separate.py`), `stage_beats` (`model.py`, `stage.py`), `stage_chords` (`recognizers.py`), `stage_notes` (`yourmt3.py`, `transkun.py`), and `splitune_eval.local`. Updated slot concurrency from `mps` to `gpu` in `stages.py` and `worker.py` (`gpu_slots`, alias `ML_GPU_SLOTS` and `ML_MPS_SLOTS`). Added `CUDA_VISIBLE_DEVICES` to island passthrough and resolved `Scripts/python.exe` on Windows.
- **Packaging (uv):** Replaced Linux CPU-only lock with mutually exclusive `cpu` and `cuda` extras (`[tool.uv] conflicts`), routing to `pytorch-cu126` wheels for Linux and Windows. Locked `services/ml` and `services/ml/islands/torch`. Verified PyTorch 2.14.1+cu126 detects NVIDIA GeForce RTX 3060.
- **Dev Runner & Supervision:** Updated `scripts/dev.mjs` for Windows process tree signaling, added `--no-sync` in `services/ml/package.json` to prevent unwanted venv de-synchronization, and added systemd unit templates (`splitune-ml-worker.service`, `splitune-node-worker.service`) and Task Scheduler keepalive script (`register-wsl-task.ps1`).

## 2026-10-24 — Fix: production sign-in hangs (Railway blocks SMTP)
Branch `impl/fix-prod-mail` from `dev`. **Symptom:** "Sign in or create an account" spins forever on `app-production-d679.up.railway.app`; `/internal/ready` and `/v1/auth/ok` answer 200 in < 0.5 s. **Cause:** Railway Hobby blocks outbound SMTP (25/465/587/2525), so nodemailer's connection to Gmail hangs for its default two-minute timeout. **Owner's choice, 2026-10-24:** "Just use Mailpit."

- `infra/railway/railway.ts`: new always-on `mailpit` service (`axllent/mailpit:v1.31.6`, same as compose; SMTP/UI bound dual stack, `PORT=8025` for the public domain, `MP_UI_AUTH` preserved secret, healthcheck `/readyz`). `app` now gets `SMTP_HOST=${{mailpit.RAILWAY_PRIVATE_DOMAIN}}`, port 1025, no TLS, empty `SMTP_USER`/`SMTP_PASSWORD` (Gmail app password removed).
- `apps/api/src/mailer.ts`: connection/greeting 10 s, socket 20 s, so an unreachable SMTP server fails the request (the form shows the generic error) instead of hanging.
- Owner to apply: `railway variable set MP_UI_AUTH --service mailpit --stdin` (`user:password`), `railway config plan/apply --file infra/railway/railway.ts`, `railway domain --service mailpit`.

## 2026-10-24 — Step 18b: Guitar and bass Notes view — Phase 2 build (done; merged into `dev`)
Built in the worktree `.claude/worktrees/guitar-notes-18b` on `impl/18b-guitar-notes-view` (the main checkout held other work on `impl/18b-guitar-notes`), rebased onto `dev` after the owner tracked `docs/` and `prompts/` and merged the landing redesign and the piano notes-hold fix. Direction A, as chosen in Phase 1. The owner raised the practice route budget to 310 KB during the build ("raise the budget to 310kb").

**Built**
- **music-core:** `tickOfPosition` (bar/beat/tick → global tick, `positionOfTick`'s inverse, tests for pickups, extrapolated bars and bars that change length).
- **notation:** `fretboard.ts` (`FretNote`, compressed equal-tempered spacing `fretUnit`, `fretKeys`/`fretWindowAt` — a 5–9 fret window per bar that moves only for notes leaving it, 0.5 s early, already on the loop start's window at a loop's end — `noteGroups`/`groupAfter` for strums and the next shape, `stringRows`/`fitReadPx`/`labelPx` shared by lanes and neck); `GuitarRoll` (canvas: lanes in tab order, heads with fret digits, tails, strum rules, chord names over bar numbers, dashed draft heads for uncertain notes, 8va/8vb, "!"; `rollStretches` draws a loop's next pass past its end; lanes cached on an offscreen canvas; nothing allocated per frame); `FretboardDiagram` (SVG neck: sounding dots, ghosted next shape, shift cue, nut or capo, inlays, mirrored for left-handers, CSS-transition re-framing, instant after a seek, landing ring).
- **ui-tokens:** `--fret-guitar`, `--fret-bass` (tier 3, every appearance + Dark score-match + forced colours), 4 contrast pairs, a tint contrast test.
- **Web:** `guitar-notes.tsx` (lazy through the chord-sheet chunk): quantized note times from the tab (`model/fret-notes.ts`, tests), state from the clock once a frame, the neck's accessible description throttled to 1 s while playing, taps loop bars, reduced motion from the resolved `data-motion`; status bar **Tab / Notes / Chords** for guitar and bass (`view: 'notes'`); phone landscape folds the chord strip into the view; `practice.fret_position`, `practice.fret_shift`, `practice.notes_now`; `view_changed: notes`.
- **Stories:** Screens/Practice `GuitarNotes` (switch order and pressed state, aligned rows, a scripted clock bar by bar against the neck's description, a loop by two taps, back to Tab), `GuitarNotesLoop`, `GuitarNotesChords` (Fmaj7 strum: four dots), `GuitarNotesShift` (cue "Fret N →", the neck moved on the bar), `GuitarNotesUncertain` (5 medium / 6 low, cleared by "Show uncertainty"), `GuitarNotesLeftHanded`, `GuitarNotesDark`, `GuitarNotesStage`, `GuitarNotesReducedMotion` (no landing ring), `BassNotes` (G D A E), `GuitarNotesCapo` (capo 2 recomputed in the Worker); Kit/Notation `Fretboards` (open, 7th position + cue, mirrored, capo, 5-string bass). E2E: a guitar Notes case in `e2e/practice.spec.ts`.
- **Docs:** implementation notes (step 18b) in 26, 27 and 12; sourced Phase 1 findings in `docs/research/ux/music-display-ui.md`; budget 310 KB in doc 10.

**Verification**
- `pnpm lint`: exit 1 on 18 errors in `docs/specs/assets/design/reference.html` (tracked by the owner's "chore: track docs and prompts"; `dev` fails the same way) and 2 pre-existing infos; this step's files are clean.
- `pnpm typecheck`: 14/14 (tsc + pyright 0 errors).
- Unit: notation 31/31 (21 new: fret geometry, window keys, strums, rows, fit, lane stretches), music-core 149/149 (2 new), ui-tokens 1238/1238 (contrast pairs + tint test), web 126/126 (4 new: `fret-notes`).
- `pnpm --filter @splitune/web test:stories`: **892/892** (66 files, Chromium + WebKit). An earlier run hit the known mid-run Vite dependency optimisation (`hash-wasm` from `dev`) and one story raced the Tab fade-in (fixed with `waitFor`).
- `pnpm --filter @splitune/web budget --enforce`: exit 0, **310,392 B of 317,440 B** (310 KB); `dev` built in the same worktree path: 310,057 B, so **+335 B**. `dev` alone is over its own script's old 302 KB limit (309,248 B): the raise lives in this branch's `bundle-budget.mjs`. Notes chunk 7.96 KB gzip, loaded only when Notes is chosen.
- `pnpm --filter @splitune/web e2e:visual:update` (Docker): 74 passed; 34 baselines regenerated (home: landing redesign; practice: the new switch and steps 17c–18), committed separately.
- `pnpm --filter @splitune/web e2e -- --grep practice`: **not run** (see below).

**Real song, local app** (this branch's production build on :3010, test account `e2e-piano-18@splitune.test`, a copy of the "Borderline" clip imported and analysed by the local workers: 30 s, 15 bars, 179 placed notes): stepping the paused player through every bar, the neck's description matched an independent expectation (music-core's tab, placed with plain beat-list arithmetic) at every bar line — 0 mismatches. Playing a two-bar loop through two wraps: frame interval p50/p95 16.7/16.7 ms (one 100 ms gap at the press of play, none at the wraps), animation-frame script p50 0.3 ms / p95 0.5 ms / max 1.3 ms; drawn lane pixels never dropped across the wraps (min 13,141 vs median 13,161: no blank frame). Dense part (the owner's "Risk It All", 775 placed notes, up to 26 a bar, in a temporary benchmark story): 900 frames at 60 fps, script p95 0.4–0.5 ms at DPR 1 and 2 (headless Chromium; GPU raster not included). Screenshots: `18b/app-{light,dark,stage}-{tablet,phone,desktop}.png`, `specs/assets/18b/app-reduced-tablet.png`.

**Found and fixed on the way:** phone landscape at the Floor distance drew 50 px labels over 13 px lanes (digits now fit the paper: `fitReadPx`); bar numbers under the lanes read as fret numbers (moved over the lanes, as on the tab); Dark's paper with the bright stem orange failed 3:1 (new tokens); the neck's name was empty for one render (axe `svg-img-alt` in WebKit); the landing ring never fired (a `NaN` start, and SMIL inserted late starts at the document's time zero) — now Web Animations on the strum that just landed, asserted in the stories.

**Not done / needs the owner**
- **E2E not run:** `global-setup` starts its own server on :3000, where the owner's dev server runs. Run `pnpm --filter @splitune/web e2e -- --grep practice` with :3000 free.
- **`pnpm lint` fails on `dev` itself:** 18 Biome errors in `docs/specs/assets/design/reference.html`, tracked since "chore: track docs and prompts" (not from this step; this step's files are clean).
- Local guest examples don't load (their files 404 in local SeaweedFS: the examples manifest points at an R2 build) — environment, not this step.
- Not checked: real tablet/phone devices, a screen reader by ear, forced colours emulated in the browser (tokens map to `Highlight`/`CanvasText`, the canvas reads them through `readColor`).
- "Risk It All" still fails finalize on `dev` until `impl/fix-alphatex-swing` (5558177) is merged and finalize re-run.
- No "low string on top" option; no tuning option in the Worker, so 5-string bass / 7-string guitar exist only in stories.

**Local leftovers:** the test account has a new song "Borderline (18b test)" (`220102de-…`); SeaweedFS CORS was widened to :3010 during the run and restored from `infra/seaweedfs/cors.json`; the worktree's `.env` was removed.

## 2026-10-24 — Production workers on the Windows PC (`pnpm workers:prod`)
Branch `impl/prod-workers-windows` from `dev`. **Symptom:** "Processing machine offline" while the Windows PC ran workers: `pnpm dev:all` reads only `.env`, so its workers heartbeat into local Postgres; production only ever saw `ml-mac`/`node-mac`, which stopped at 04:00 UTC.

- `scripts/dev.mjs --prod-workers` (`pnpm workers:prod`): the `dev:all` dashboard with only node-worker (`run start`) and ml-worker (`SPLITUNE_ENV_FILE=.env.worker`, `ML_MODE=local`); `.env` is not loaded, since inherited variables win over the env file in both workers. Header reads "PRODUCTION workers".
- One machine's ML worker at a time (owner's choice, 2026-10-24: "i will decide myself by turning on which one"). Decoded audio and raw separated stems are worker-local and `audio_hash` follows the FFmpeg build (the PC has 9.0.1, the Mac 8.1), so a stage handed across machines fails: started by hand next to the Mac, `ml-windows` failed "Risk It All" (analysis `9790850e…`) `stem_post`, `chords` and `notes.guitar` with `decoded_audio_mismatch`; it finished `partial` ("Analyse again" re-runs it). Sharing those intermediates through R2 (~70–100 MB per song) or pinning an analysis to its machine were considered and not built.
- The PC's `.env.worker` (git-ignored): `ml-windows`/`node-windows`, Windows `FFMPEG_BIN_DIR`, `ML_GPU_SLOTS=1`, `ML_TORCH_DEVICE=cuda`, `PG_DUMP_DIR` empty (the Mac keeps the backup).

**Verification**
- `npx biome check scripts package.json`: clean. `npx vitest run --dir scripts`: 45/45 (1 new: header names production workers).
- `pnpm workers:prod` in a terminal (with the FFmpeg preflight that was later dropped): header "PRODUCTION workers"; node-worker started and production's `worker_heartbeats` showed `node-windows` 5 s old; Ctrl-C left no worker processes. The ML worker's launch without the preflight was not re-run here (the owner's hand-started `ml-windows` was live); it is the same command and environment the owner ran by hand, which heartbeat as `ml-windows`. 

## 2026-10-24 — Step 18c: Vocal Melody view (done; not merged)
Branch `impl/18c-vocal-melody` from `dev`. **Owner, 2026-10-24:** asked whether vocals were supported (they fell through to the generic chord grid), asked for "a mockup of a melody piano-roll from notes/vocals.json plus lyrics-free phrase markers, before building", then "Looks good. Build the vocal Melody view from this design … including stories for its states." Mockup and screenshots in `docs/specs/assets/18c/` (synthetic data shaped like `notes.vocals`: reading the production song needed TLS verification turned off against the production database, which was refused).

**Built**
- **music-core:** `buildMelody` (`melody/build-melody.ts`): corrections, sung timing kept (no quantization), phrases (a rest of ¾ beat, 0.6 s at least, ends one; over four bars splits at the largest gap), bars per phrase, first sure note, repeat letters by pitch class (≤ 1 note different, so octave slips still match), range as the 5th–95th percentile of sure notes. `keyScale` (key → seven pitch classes).
- **notation:** `MelodyRoll` (canvas, 26 §implementation notes 18c) and `melody.ts` (`followWindow`, `wholeWindow`, `phraseIndexAt`, `degreeName`); `chordParts`/`PART_STYLES` exported from the guitar roll and shared.
- **ui-tokens:** `--melody-vocals` (tier 3, every appearance + Dark score-match + forced colours), 2 contrast pairs, added to the tint test.
- **Web:** vocals' notes load with the summary; the Worker returns `melody` (notes, phrases, range, scale). New layer `melody`; status bar **Melody / Chords**; `vocal-melody.tsx` (roll, accessible name per phrase/bar/sung note, ≤ 1/s while playing) and `phrase-strip.tsx` (phrase now, starts on + degree + **First note** cue, next phrase with beats, range, phrase loop, **Guide vocal** On / Quiet −12 dB / Off on the part's mixer level, **Melody options**: labels names/degrees/none, pitch window follow/whole). `PracticeAudio.cue` (sine over the stems). Context `stepPhrase` / `loopPhrase` / `cueNote`; keys `[` `]` `P`, and `L` with no loop loops the phrase being sung. `model/phrases.ts` (entry a beat before the first note, phrase loop = its bars), mixer `guideLevel`/`withGuide`, `spelledNote`. Chords-only banner for vocals (`practice.chords_only_vocals`).
- **Stories:** Screens/Practice `VocalMelody` (switch, strip before/inside phrases, sung G4 by keyboard, `]` `L` `P` `[`, Chords and back), `VocalMelodyRepeat` (A′), `VocalMelodyLoop`, `VocalMelodyGuide`, `VocalMelodyOptions`, `VocalMelodyUncertain`, `VocalMelodyBelowGate`, `VocalMelodyDark`, `VocalMelodyStage`, `VocalMelodyReducedMotion`.
- **Docs:** implementation notes (step 18c) in 26, 27 and 12.

**Deviations from the mockup:** phrase loops are bar-snapped like every loop (not beat-snapped with one beat of pre-roll); the guide vocal sits in the strip, not the transport; no f0 curve (needs `f0.vocals`); analytics reuse `loop_created: tap` and `view_changed: notes` (no contract change).

**Verification**
- `pnpm typecheck` (web) exit 0; `tsc` notation, music-core, ui-tokens: 0 errors.
- Unit: music-core 154/160 — the 6 failures are the golden files (`schema_version` 1.4.0 vs 1.5.0 since step 09c), failing on `dev` too; 9 new melody + 1 keyScale tests pass. notation 37/37 (6 new), ui-tokens 1262/1262, web 136/136 (new: phrases, melody in the Worker, keymap, guide vocal, `L` on a sung song).
- `npx vitest run --project storybook` (Chromium): 457/458 on a warm cache; the one failure was this step's story reading a device default an earlier story had changed (fixed, practice file then 68/69 with Piano Notes' known fade-in flake, which passed on two reruns). The first cold run had 48 failures across unrelated files after Vite re-optimised `hash-wasm` mid-run (as in step 18b). **WebKit not run:** Playwright's WebKit isn't installed on this PC.
- `pnpm lint`: Biome clean (2 pre-existing infos); `check-ui-tokens` fails on `packages/notation/src/fretboard-diagram.tsx:64` (`ease-out`), untouched here and failing on `dev`.
- **Budget:** practice route 315.8 KB gzip vs 314.5 KB for `dev` built in the same checkout (+1.3 KB); **`dev` is already over the 310 KB budget.** The melody (6.5 KB gzip) and phrase strip (3.7 KB) load only for vocal songs.

**Budget raised:** the owner raised the practice route budget to 320 KB ("Raise the practice route budget to 320 KB in bundle-budget.mjs and doc 10, noting dev was already at 314.5 KB"); `bundle-budget.mjs --enforce` passes at 315.8 KB.

**Not done / needs the owner**
- Not checked: a real vocal song end to end, phone landscape (the compact strip has no story), WebKit, a screen reader by ear.

## 2026-10-25 — Step 24: Piano accuracy — Phases 0–1 (test set, harness, baseline; in progress)
Branch `impl/24-piano-accuracy` from `dev` (`0eea044`), in worktree `.claude/worktrees/s24-piano` (another session was switching branches in the main checkout). Its own CUDA venv is `D:/venvs/s24-ml`; the shared `services/ml/.venv` is untouched.

**Owner decisions:**
- 2026-10-24: approved the Phase 0 plan and test set.
- Chose to stream the 104 GB Slakh2100 redux archive, keeping only its test split (7.5 GB). It was streamed from the Hugging Face mirror `projectlosangeles/Slakh2100` (same 104,322,767,708-byte file) because Zenodo gave ~1 MB/s per connection.
- No owner songs supplied yet.
- Timing machine not chosen; timings here are this PC (RTX 3060, CUDA).

**Phase 0** (`docs/research/ml/transcription-piano.md` §"2026-10 re-check"):
- The pip `2.0.pt` is Transkun V2 NoExt (the KeyOff fine-tune). Its offsets are key releases, so gap 6's premise was wrong.
- Aria-AMT (447 MB, MAPS 90.6, needs its own Python 3.11 / torchaudio ≤ 2.5 env) and the Edwards et al. robust Kong (MAPS 88.4) are the transcriber candidates. No 2025–26 piano model has released weights.
- BS-Roformer-SW already tops MVSep's piano leaderboard. The only other open piano separator scores 4.90 dB.
- PM2S / MIDI2ScoreTransformer for hands. PIG is offline, so ASAP staves are the reference.

**Phase 1, built:**
- `eval/p2p.py` (plan / build / separate / predict --chain / hands / report) and `eval/sets/p2p.yaml`, a registered set of 48 excerpts in four tiers plus P2's items as `legacy`. Definition in specs/08 "Implementation notes (step 24)".
- Rendering uses sfizz 1.2.3 (`--use-eot`) and FluidSynth 2.6.1 with sample libraries from sfzinstruments and GeneralUser GS. Tools and datasets live under `D:\datasets` (`~/datasets` junction), with `_tools/` holding the downloaders (`pdl.py` parallel ranges, `resume_stream.py`).
- `eval/tests/test_p2p.py` covers pedal extension, windows, top line, key shift and pickup beats.
- music-core CLI `build-piano` now returns `residual_flagged` per note; the two `build-piano` goldens were refreshed.

**Baseline** (`services/ml/eval/results/p2p/2026-10-24-baseline.md`): BS-Roformer-SW → Transkun mono, pedal dropped, constant confidence.

Onset F1 on the chosen input:
| tier | chosen | clean | mixture |
|---|---|---|---|
| real-solo | 0.923 | 0.923 | — |
| real-band | 0.960 | — | — |
| pop-solo | 0.847 | 0.924 | — |
| pop-band | 0.876 | 0.947 | 0.661 |
| legacy | 0.833 | — | — |

Legacy reproduces P2 on this PC (0.836 item-weighted).

- On real pianos, onset+offset F1 is 0.62 against key-release references vs 0.38 against pedal-extended ones.
- Separation hurts harpsichord, clavinet, phone and roomy recordings; electric pianos are fine.
- Calibration: one band, 0.917 held-out precision.
- Hands: 0.881 on ASAP staves.
- Time: about 17 s per 30 s (separation about 12 s).

**Verification**
- `services/ml`: `ruff check` clean; `ruff format --check` 126 files formatted; `pyright` (with `--pythonpath D:/venvs/s24-ml/Scripts/python.exe`) 0 errors; `pytest eval/tests` 26 passed. The full suite: 214 passed, 1 skipped, 6 failed. All 6 are in packages this branch doesn't change (`git diff dev -- services/ml/packages` is empty), so they come from this Windows/CUDA PC or from step 09c, not this work:
  - `test_recovery` ×2: worker kill / SIGTERM;
  - `test_cpu_fallback_uses_the_small_model`;
  - `test_specs_follow_the_notes_config`: expects the `mps` slot that step 09c renamed `gpu`;
  - `test_stem_post` ×2: mix-minus level −13.1 dB vs < −15.
- `packages/music-core` `pnpm test`: the `build-piano` goldens pass. 6 `build-tab` golden tests fail because they still expect `schema_version` 1.4.0 while `dev` emits 1.5.0 since step 09c; they fail on `dev` too and were left alone.
- `npx biome check packages/music-core/src/cli.ts` clean.

**Next:** the owner's OK on the Phase 2–6 plan and hours (stop point 2); the owner's songs for the unreferenced tier. Re-run with `uv run python eval/p2p.py build|separate|predict|report` (datasets under `~/datasets`).

## 2026-10-25 — Step 24: Piano accuracy — Phases 2–6 (shipped; owner checks pending)
Same branch and worktree as Phases 0–1. **Owner, 2026-10-24:** "Approved: run Phases 2-6 as planned. Time on this PC (RTX 3060) counts for the ~30 % budget." Mid-run the GPU was shared with two other step sessions and the production worker; CUDA "illegal memory access" crashes were retried automatically (`D:\datasets\_tools\retry.sh`). Quiet-GPU timings are the final report's.

**Measured (eval/results/p2p/2026-10-24-phases.md, every candidate; 2026-10-24-final.md, baseline vs shipped):**
- **Gap 3, mixture fallback:** YourMT3+ beats Transkun on band mixtures, 0.727 vs 0.684 (POP909 0.823 vs 0.703; Slakh 0.734 vs 0.620). It loses on Disklavier piano in a band (0.624 vs 0.729). Shipped.
- **Gap 7, stereo:** onsets even; onset+offset +0.011 (better on 32 items, worse on 17). Shipped.
- **Gap 5, bleed:** a 45 dB silence gate lifts held-out onset F1 0.855 → 0.873 and precision 0.880 → 0.919. The gain is on legacy BabySlakh, where the piano rests. Velocity, duration and confidence floors add nothing. Shipped.
  - Found during verification: the gate dropped onsets placed a few ms before an attack that follows silence. It now also accepts the next frame.
  - Segment joins add no errors (0.218 vs 0.221 errors per note).
- **Gap 4, confidence:** the mean of the semi-CRF onset marginal and the velocity peak scores AUROC 0.885 held-out. Agreement with YourMT3+ (0.878) needs a second model pass. Calibration: 26 knots, ECE 0.361 → 0.009; bands high 0.953 / medium 0.638 / low 0.552 precision. No confidence floor. Shipped.
- **Gap 2, input:**
  - PANNs alone would wrongly bypass about 5 of 57 band songs.
  - htdemucs_6s drums + bass + vocals below −15 dB catches 24/24 solos with 0/57 wrong bypasses, in about 3 s per 30 s. Shipped as `solo_check`; the chain is skipped when it fires.
  - Separators: BS-Roformer-SW keeps the best stem (12.5 dB uSDR; Transkun 0.869 on its stems). Vocals-first 12.4 dB / 0.873, but its only gain is on solos, which the bypass covers. The SW + htdemucs_6s average 8.9 / 0.864. htdemucs_6s 5.0 / 0.676.
- **Gap 8, transcribers** (stems):

  | model | onset F1 |
  |---|---|
  | Transkun V2 NoExt (kept) | 0.869 |
  | V2 Aug | 0.869 (key offsets 0.485 vs 0.570) |
  | robust Kong | 0.837 |
  | Aria-AMT | 0.822 |
  | V2 | 0.812 |

  The wheel's checkpoint is the KeyOff fine-tune. Agreement ensembles lower F1 (0.881 → 0.824–0.870). No fine-tuning.
- **Gap 6, pedal:** offsets are already key releases (0.62 against key-release references vs 0.38 pedal-extended on real pianos). The pedal is kept as `Notes.sustain` and drawn as `\spd`/`\spu` marks under the bass staff. The roll keeps played length.
- **Gap 9:**
  - Electric pianos render-transcribe at 0.93–0.98 (P2's 0.68 was Slakh patches). Harpsichord/clavinet improve to 0.94 via the bypass.
  - Hands: PM2S 0.927 vs `splitHands` 0.885 on 21 unseen ASAP pieces (0.912 vs 0.881 on all 231). Shipped as `Note.hand`.
  - Off-grid share: 0.14–0.16 on real pianos, 0.02–0.04 on rendered pop. `quantize/` is untouched.
- **End to end, chosen input onset F1:**

  | tier | baseline | shipped |
  |---|---|---|
  | real-solo | 0.923 | 0.928 |
  | real-band | 0.960 | 0.960 |
  | pop-solo | 0.847 | 0.920 |
  | pop-band | 0.876 | 0.877 |
  | legacy | 0.833 | 0.869 |

  Onset+offset improves under both conventions on every tier. Time per 30 s:
  - solo 18.6 → 5.5 (real) and 17.9 → 6.3 (pop);
  - band 17.3 → 17.3 (real) and 16.4 → 20.1 (pop, +23 %, within the 30 % budget);
  - legacy 32.5 → 31.7.

**Built**
- Contracts 1.6.0: `Separation.solo_bypass`, `Notes.sustain`, `Note.hand`. Generated files and the `build-tab` goldens' schema version were refreshed.
- `stage_separation`: `solo_check` config and run.
- `stage_notes`:
  - per-source transcriber (`mixture:`), with an island guard in `notes_placement`;
  - Transkun `stereo` / `confidence` / `gate_db` / floors, plus semi-CRF scores and pedal (`transcribe_detailed`, `transcribe_with_pedal`);
  - `pm2s_hands` (vendored MIT model code, register `pm2s-hand-part`, `fetch_models.py pm2s`).
- Calibration tables `transkun-v2@2.0.1.piano.json` (26 knots) and `yourmt3-moe@….piano.json` (0.747).
- Configs: `notes.personal.yaml` piano; `separation.personal.yaml` piano; `views.yaml` `changes` entry (gate unchanged).
- music-core: `buildPianoScore` uses `Note.hand` when complete, snaps `sustain` to the 16th grid, and the alphaTex grand staff gets pedal marks. The CLI `build-piano` reports `residual_flagged`.
- Web story fixture: piano sustain.
- Eval:
  - `p2p.py`: `detail`, `compare`, `sweep`, `confidence`, `calibrate`, `tags`, `aria`, `kong`, separator composites, chains `yourmt3` / `final`, PM2S in `hands`;
  - `eval/aria_amt.py`, which runs Aria-AMT in-process on Windows from its own venv `D:/venvs/aria`.
- Docs: specs 05, 06, 08, 21 and the research doc.

**Cache keys invalidated:** every piano `separate` (solo-check params) and every `notes.piano` (new transcriber params, hands, mixture choice, calibration tables).

**Verification**
- `services/ml`:
  - `ruff check` / `ruff format --check`: clean.
  - `pyright` (worktree venv): 0 errors.
  - `pytest`: 198 passed, 1 skipped, 4 failed, 26 errors. Since then, the Transkun stage test was updated and passes (`packages/stage_notes` 14/14, plus 4 clean-up tests).
  - The 26 errors need Postgres, which was down (Docker not running) at the time.
  - The 3 remaining failures are the pre-existing ones: `test_cpu_fallback_uses_the_small_model` and `test_stem_post` ×2. The earlier `test_specs_follow_the_notes_config` (`mps` → `gpu`) is fixed.
- `pnpm contracts:check`: up to date.
- `pnpm typecheck`: 13/13 turbo tasks; the ML package was checked directly because turbo doesn't pass `UV_PROJECT_ENVIRONMENT` (pyright 0, `tsc` ok).
- `pnpm lint`: Biome clean, but the UI-token check fails on `packages/notation/src/fretboard-diagram.tsx:64` (`ease-out`). That file is from step 18b on `dev` and untouched here.
- Unit tests:
  - music-core 163/163;
  - notation 37/37;
  - contracts 45/45;
  - audio-engine 53/53;
  - analytics 19/19;
  - ui-tokens 1262/1262;
  - web unit 136/136.
  - listening, storage, node-worker and db suites need Postgres/S3 (not running); `views.yaml` was parsed through `views.ts` by hand.
- Stories (`practice.stories.tsx`, Piano*): Chromium 17/17 (one flake on the first run). WebKit times out at 15 s on every practice story on this PC, untouched ones included (WebKit 2370 freshly installed on Windows); not checked on the Mac.

**Not done / needs the owner**
- **The owner's songs:** no excerpts were supplied, so no real songs from the library have been re-analysed end to end, and there are no Notes/Staff screenshots of them. P2p has no owner tier.
- **Electric-piano/keys gate (stop point 4), proposed:** piano → Chart when the song's mean calibrated confidence is < 0.80. On P2p this gates 4 songs with mean onset F1 0.516 and none above 0.9. At 0.85 it gates 8, including one at 0.894. Not built.
- **Production workers after merging:**
  - `git pull`;
  - `uv sync` for the torch island;
  - `scripts/fetch_models.py pm2s`;
  - `pnpm workers restart`.
- Not run: the dedicated small piano separator (MVSep 4.90 dB), MIDI2ScoreTransformer / Cluster-and-Separate hands, fine-tuning.

## 2026-10-25 — Step 24: piano mean-confidence gate (owner's choice)
**Owner, 2026-10-25:** "Yes, add the piano gate: mean calibrated confidence below 0.80 sends the song to Chart."

**Built**
- `views.yaml` `min_confidence_mean: {piano: 0.80}` and a `changes` entry.
- `apps/node-worker/src/views.ts`: the config field (a per-instrument partial record, default empty) and rule 4b. When `note_confidence_mean` is below the instrument's floor, the view is `chords_only` with the existing reason `low_confidence`, so the app's banner and "Show notes anyway" apply unchanged.
- Docs: spec 05 rule list, 08, 21, the P2p phase report, status.

**Verification**
- `npx tsc -p apps/node-worker`: clean. Biome clean.
- `test/views.test.ts` + `test/finalize.test.ts`: 18/18. They were run with a Vitest config without the suite's Postgres global setup, since Postgres isn't running here.
- New case 5b covers below/at the floor and instruments without one. The repo-config test checks the piano floor.

**Effect on P2p:** 4 of 81 songs gated (two roomy/phone uprights, a doubled band part, one BabySlakh electric piano), mean onset F1 0.516; no song with onset F1 ≥ 0.9.


## 2026-10-28 — Step 25: Drums (in progress)
Branch `impl/25-drums` from `dev` (`9306fc9`), in worktree `.claude/worktrees/s25-drums`. Its own CUDA venv is `D:/venvs/s25-ml`; the shared `services/ml/.venv` is untouched.

**Owner decisions**
- 2026-10-28: approved the Phase 0 plan as proposed: the required downloads (~29 GB), no Slakh, a ~30 % analysis-time cap. The owner will fetch the RBMA13 Bandcamp album.
- `D:\datasets` (the `~/datasets` junction target) had been removed before this step started. Every set was downloaded again; step 24's P2p data and `_tools` are gone, so P2p can't be re-run until it is rebuilt.

**Phase 0** (`docs/research/ml/transcription-drums.md` §"2026-10 re-check")
- ADTOF-pytorch stays the baseline. It ships one checkpoint (`Frame_RNN_adtofAll_0`, no separate RGW/YT models), and its front end has 84 bands, not 168.
- ADT_STR (2026) is the only new transcriber with weights. STAR Drums and N2N have no released model.
- The 6-stem MDX23C DrumSep is the only public kit separator that splits crash from ride.

**Phase 1, built**
- `eval/p2d.py` (plan / build / separate / predict --chain / report) and `eval/sets/p2d.yaml`: 48 items in six tiers. The definition and baseline are in specs/08 "Implementation notes (step 25)".
- Downloads, under `~/datasets` with downloaders in `_tools/`:
  - `pdl.py`: parallel ranges;
  - `rzip.py`: extracts only matching zip members over HTTP, used for MUSDB18-HQ's test split, 11 GB of 22.7.
- Renderers: sfizz 1.2.3 and FluidSynth 2.6.1 with GeneralUser GS. Kits come from sfzinstruments: DRSKit, Muldjord, Big Rusty, Unruly sticks and brushes, RetroDrums.
- **`notes.drums` stage**, built ahead of Phase 2 so the harness runs the shipped code:
  - `stage_notes/drums.py`;
  - `drum_kit.py`: the one GM mapping and the 5-class defaults (hi-hat closed, toms on 47, cymbals crash on a downbeat after a 1 s gap, else ride; all flagged `approximate`);
  - `adtof.py` + `adtof_net.py`: the Frame_RNN network and front end re-implemented from ADTOF-pytorch `85c192e`; the weights are fetched by `fetch_models.py adtof` and loaded with `weights_only=True`. The port reproduces the repo's reference MIDI hit for hit.
  - YourMT3+ gained `transcribe_drums`.
  - Registered in `stages.py` (torch island, GPU slot, optional `beats` input for the crash rule) and in `notes.personal.yaml`. It is **not scheduled**: `apps/api/src/pipeline.ts` is unchanged until `v1.drums` exists (Phase 2).
  - Register record `adtof-frame-rnn`.
  - No existing cache key changes (`yourmt3.py` was refactored without changing its params).
- music-core CLI `quantize-drums` (the shipped `quantizeDrumHits`) with a golden file.

**Baseline** (`services/ml/eval/results/p2d/2026-10-28-baseline.md`; BS-Roformer-SW stem → ADTOF, published thresholds), onset F1 ±50 ms on the chosen input:

| tier | ADTOF | YourMT3+ |
|---|---|---|
| real-mdb | 0.848 | 0.769 |
| real-enst | 0.709 | 0.882 (in-sample) |
| solo-drums | 0.976 | 0.980 |
| rendered-band | 0.777 | 0.745 |
| drum-machine | 0.735 | 0.788 |
| item mean, 42 items | 0.793 | 0.802 |

- ±30 ms costs ADTOF about 0.02.
- Weakest labels: brushes 0.52, swing 0.54, phone 0.50. Toms and cymbals are weak in every tier.
- ADTOF misses ENST's soft kicks: 0 of 33 on one take. +12 dB of input gain recovers only part of it (+0.02 to +0.10 F1 on 3 items), so input level is a Phase 3 candidate, not the cause.
- Exact bar patterns 0.11–0.25 (Jaccard 0.61–0.73).
- Raw ADTOF peaks are under-confident: ECE 0.226.
- Time: notes.drums 0.12 s per 30 s on the RTX 3060 (YourMT3+ 1.3 s). Separation is 5 s per 30 s, but in an analysis the drum stem is already there (a kept extra, or the target when the part is drums), so the baseline adds about 0.1 s per 30 s to a full analysis.

**Verification**
- `services/ml`:
  - `ruff check`: clean.
  - `pyright eval/p2d.py packages/stage_notes packages/splitune_ml_core scripts`: 0 errors.
  - `pytest packages/stage_notes packages/splitune_ml_core eval/tests -m "not models"`: 146 passed, 21 errors. Every error is a Postgres connection timeout (Docker isn't running on this PC).
  - `pytest packages/stage_notes/tests/test_drums.py`, including the `models` test: 7 passed.
  - `pytest eval/tests/test_p2d.py`: 6 passed.
- `packages/music-core`: `vitest run test/golden.test.ts` 17/17. Biome is clean on `cli.ts`.

**Known gaps**
- RBMA13 audio is missing (6 items skipped).
- No owner songs yet.
- The Mac (MPS) timings need the owner.
- The SFZ kits' key maps were checked for sound per GM key, not for which piece each key plays.
- `D:\models-s25` (a 3.6 MB scratch copy of the ADTOF weights) is left for the owner to delete; a safety check blocked its removal.

- 2026-10-28: the owner approved the Phase 2–6 plan (stop point 2).

**Phase 2: orchestration**
- Flag `v1.drums` (contracts `FLAGS`, default off).
- `planAnalysis` plans `notes.drums` for a drums analysis only while the flag is on. The flag is read by `POST /v1/analyses` and URL import.
  - The stage gets `beats` as an input and a soft dependency.
  - Soft edges to stages that have no job (reused decode and beats) are dropped. A reused beats artefact would otherwise make the plan throw.
- Finalize reads `notes.drums` as `DrumNotes` and scores the hits like notes for the view rule. It writes no render: the web builds the drum score from hits + beats (music-core), as for the piano roll, so levels and corrections stay in the browser.
- `views.yaml` lists drums in `notation_supported`. Without the flag no `notes.drums` exists, so drums stay `chords_only` / `notes_unavailable`. There is no quality gate yet (Phase 6).
- Doc 06 has the step 25 notes.
- Caches: none invalidated (new stage, new flag).
- Tests:
  - `apps/api` `vitest run src/pipeline.test.ts`: 4 passed.
  - `apps/node-worker` finalize + views: 20 passed.
  - contracts: 45 passed.
  - `turbo typecheck` (TS packages): clean. Biome: clean.
  - The full `apps/api` / `apps/node-worker` suites have 6 failures that can't run on this Windows PC: they spawn `uv` and the Node worker, use `SIGSTOP`, or need `pg_dump` on PATH. None touch the changed code.

**Phase 3: accuracy** (`eval/p2d_tune.py`; `eval/results/p2d/2026-10-28-phases.md` lists every candidate, `2026-10-28-phase3.md` is the before/after report)
- **Shipped** (`notes.personal.yaml` drums params, `adtof.py` options `input_rms_db` and `confidence`):
  - The drum stem is brought to −17 dBFS RMS before ADTOF. The gain was chosen by 2-fold CV with per-class thresholds.
  - Thresholds `[0.08, 0.08, 0.42, 0.18, 0.32]`, tuned on all items afterwards.
  - Confidence is the margin over the class threshold, with isotonic table `config/calibration/adtof-frame-rnn@adtofAll_0-pt-85c192e.drums.json` (fit split).
- **Results:**
  - Chosen input, all 42 items: 0.838 vs baseline 0.793 (CV estimate 0.826). Held-out: 0.810 vs 0.773.
  - Per tier: ENST 0.790 vs 0.709 (the soft kicks), drum machines 0.896 vs 0.735, rendered bands 0.813 vs 0.777, MDB 0.855 vs 0.848, solo 0.956 vs 0.976 (a small loss).
  - Mixture fallback: 0.798 vs 0.772.
  - Calibration: held-out ECE 0.295 → 0.021, AUROC 0.789.
- **Not shipped:**
  - htdemucs_ft and htdemucs_6s drum stems;
  - a shared threshold offset;
  - YourMT3+ union, agreement and "rescue" ensembles. Rescue is +0.009 held-out, mostly in-sample ENST, and YourMT3+ costs ~8 s per 30 s and ~14 GB on the Mac.
  - a per-class logistic confidence;
  - a solo bypass, which gives identical hits on solo kits.
- **Blocked:** `mdx23c-drumsep` (DrumSep 6-stem kit separator) is downloaded and registered, and `p2d_tune.py kitsep`/`kit` are written. This PC's safety rule refused to load the new checkpoint ("code from external"), so the kit split waits for the owner. ADT_STR is not run for the same reason (it needs its own model code).
- **No velocity:** ADTOF has none, so `DrumHit.velocity` stays empty.
- **Caches:** `notes.drums` params and calibration changed. No production cache existed (the stage is unscheduled).
- **Bugs found and fixed in the analysis script:**
  - It first indexed ADTOF's outputs in `drum_kit.CLASSES` order (toms ↔ hi-hat); every table above was computed after the fix.
  - An empty `services/ml/.venv`, made by a `pnpm typecheck` run without the step venv, made pyright miss every import. It was moved to `D:\venvs\s25-stray-empty-venv*` (two empty 151 KB shells, safe to delete).
- **Verification:**
  - `ruff check eval packages`: clean.
  - `pyright eval/p2d_tune.py eval/p2d.py packages/stage_notes packages/splitune_ml_core scripts`: 0 errors.
  - `pytest packages/stage_notes/tests/test_drums.py eval/tests/test_p2d.py`: 15 passed, including the models test.
  - `pytest packages/stage_notes packages/splitune_ml_core eval/tests -m "not models"`: 169 passed. Postgres is up now, so the 21 earlier errors are gone.

**Phase 4: music-core drum score, export, levels** (doc 07 "Implementation notes (step 25)")
- `buildDrumScore` (`drums/build-drums.ts`): quantized hits with flams, hands/feet voices, level, alphaTex and hit map.
  - Only beat corrections apply. The editor gets no drum editing in this step, so there are no drum `CorrectionOp`s.
- Drum staff alphaTex (`export/alphatex-drums.ts`): alphaTab 1.8 standard articulations matched to GM by MIDI output, probed with the 1.8.4 importer.
  - Every GM kit key round-trips except 40 (written as snare 38) and 59 (ride 2, written as ride 51).
  - Flams are grace notes. Pickups and swing bars use the tab writer's bar and duration rules.
- Levels (`level/drums.ts`):
  - `as_transcribed`;
  - `core_groove`: kick, snare and hi-hat/ride; a fill bar is the main pattern instead;
  - `simplified`: hi-hat in eighths. Ghost-note dropping waits for velocity.
  - A first fill rule (Jaccard against the main pattern) flagged busy 16th hi-hat bars as fills. The rule is now "holds less than half of the main pattern".
- CLI `build-drums`. Goldens: `build-drums.as-transcribed|core-groove|simplified.json` on one song (pickup, swing bars 4–6, a flam, fills in bars 3 and 7). The Phase 1 `quantize-drums` golden moved into `update-golden.ts`, unchanged.
- MusicXML percussion round-trip waits for step 20's export.
- Verification (`packages/music-core`): `tsc -p .` clean, Biome clean, `vitest run` 176 passed (14 files, 9 new drum tests).

**Phase 5: drum views** (doc 12 "Implementation notes (step 25)")
- Grid / Staff / Chords for drums:
  - the Grid is `@splitune/notation` `DrumGrid` (a canvas; lanes cymbals → kick, unsure and guessed hits hollow and dashed, "?" on low, flam grace block, piece letters with a key);
  - the Staff is music-core's drum staff in `AlphaTabView`;
  - both load lazily through the chord-sheet chunk.
- Levels: Main groove / Simplified / As played in the level popover (no capo for drums). `core_groove` was added to the analytics `PracticeLevel` and the route's `?level=` (`contracts:gen`: no generated change).
- Data:
  - `notes.drums` is read as `DrumNotes`, and the screen holds until the hits are in the music.
  - The Worker's `computeMusic` builds drums with `buildDrumScore`.
  - There are no drum editor ops.
- The mixer is unchanged: the drum stem plus its mix-minus already give "Minus one" without the drums.
- Onboarding keeps Drums as "Coming soon", like piano: its song step needs a drum example song, which doesn't exist. Adding one with `pnpm examples:build` is the owner's call.
- Song pickup and swing bars are covered by the music-core goldens. The web stories use the fixture's 8-bar grid with no pickup, with a swing variant on bars 5–6.
- Copy: 11 new `practice.*` keys.
- Route budget (`pnpm budget`, production build): 317.0 KB before, 317.1 KB after, of 320 KB.
- Verification:
  - `apps/web`: `tsc` clean, Biome clean, unit tests 145 passed (34 files; 1 new drums test).
  - Stories (Chromium): `practice.stories.tsx` + `app/ui` 350/352 passed, including all 13 new drum stories.
    - The 2 failures are "Screen May Lock*": after 20:00 the evening Stage hint adds a second "Close" button. They depend on the time of day and are unrelated.
    - WebKit stories time out on this Windows PC for existing piano stories too, so WebKit wasn't counted.
  - `packages/notation` 41 passed (4 new).
- Environment notes:
  - The worktree had no built `packages/audio-dsp/dist/dsp.wasm` (ignored build output). It was copied from the main checkout after checking it against the committed `dsp.wasm.sha256`.
  - `pnpm contracts:gen` without `UV_PROJECT_ENVIRONMENT` creates an empty `services/ml/.venv`. A third such shell was moved to `D:\venvs\s25-stray-empty-venv-3`.

**Phase 6: gate proposal (stop point 4; nothing switched on yet)**
- Proposed `quality_gate.drums: pass`. Rule: P2d item-mean onset F1 (±50 ms) on the chosen input ≥ 0.80, the same bar as piano.
  - Shipped chain: 0.838 over all items (2-fold CV estimate 0.826, held-out split 0.810).
  - Per tier: MDB 0.855, ENST 0.790, rendered bands 0.813, drum machines 0.896, solo 0.956. RBMA13 is not built.
- Per-song mean calibrated confidence vs onset F1 (shipped, 42 items): rank correlation 0.70.
  - A `min_confidence_mean.drums` floor of 0.75 would send 4 songs to chords only: three bad (F1 0.551–0.610) and one fine drum-machine song (0.789).
  - It would miss one bad rendered song (0.537 at 0.859).
  - The table was fitted on the fit split, but this check uses all items.
  - The low-band share of hits is ≤ 0.03 on every song, so the existing `low_confidence` rules never fire for drums.
- Analysis time: `notes.drums` is 0.1–0.3 s per 30 s on the RTX 3060, and the drum stem already exists in a drums analysis. That is under 1 % of a full analysis on this PC. The Mac isn't measured.
- **Waiting for the owner:**
  - the gate rule and threshold;
  - whether to add the 0.75 confidence floor;
  - turning `v1.drums` on;
  - drum excerpts for the end-to-end run;
  - whether to allow loading the DrumSep checkpoint;
  - fine-tuning (not recommended now);
  - a drum example song for onboarding.
- 2026-10-29: the owner approved the gate at 0.80 with the 0.75 confidence floor, and `v1.drums` on after the end-to-end run.

**Phase 6: gate and end to end**
- `views.yaml`: `quality_gate.drums: pass`, `min_confidence_mean.drums: 0.75`, and a `changes` entry with the model versions. `apps/node-worker` views test updated.
- `v1.drums` stays off in code. It is turned on with a `feature_flags` row.
- **Local end to end** (this PC: Docker Postgres + SeaweedFS, `pnpm dev` web/API, `apps/node-worker`, ML worker from `D:\venvs\s25-ml` on the RTX 3060 with `ML_ISLAND_PYTHON` for every island):
  - Setup: a local test account; `v1.drums` on in the local database only.
  - Input: a 45 s excerpt of MUSDB18-HQ test "Louis Cressy Band – Good Time" (30–75 s), uploaded through the app's upload API as a drums Full analysis.
  - The plan held `notes.drums` with the beats as input. Every stage was done.
  - `notes.drums`: 206 hits (55 kick, 36 snare, 109 hi-hat, 2 toms, 4 cymbals; 115 `approximate`).
    - It read the separated drum stem at −17 dBFS with margin confidence and the downbeats.
    - Finalize read it as `DrumNotes`: mean confidence 0.935, `recommended_view: drum_grid`.
  - Time, cold models included:
    - analysis 51.2 s;
    - `notes.drums` 0.6 s (1.2 % of the analysis);
    - separate 16.1 s, decode 14.2 s, beats 12.3 s.
  - The first attempt failed in `decode` with `island_missing`, because the worktree has no per-island venvs. `ML_ISLAND_PYTHON` fixed it, and the re-run (`/v1/analyses/{id}/rerun`) was done.
- **Not done yet:**
  - the owner's drum excerpts on the Mac worker;
  - `v1.drums` in production, which needs this branch merged and deployed first.
- **Viewed in the local app** (2026-10-29, 800 px browser pane):
  - Grid at As played, Main groove and Simplified: lanes line up with their names; guesses are hollow and dashed, kick and snare solid; it scrolls past the playhead after a seek.
  - Main groove drops the toms and the crash. On this excerpt the hi-hat is already in eighths, so Simplified looks like As played.
  - Staff: hands up, feet down, × heads for hi-hats, dashed marks on guesses, current bar shaded.
- **Fix from viewing:** the staff wrote a hit until the voice's next hit (kicks on 1 and 3 came out as halves). A hit now ends at its beat with rests after, as drum parts are read. Only the three `build-drums` goldens changed; music-core 176 passed.
- **Seen, not drum-specific:** at 800 px the practice top bar (title, transcription chip, view switch, settings) is wider than the window, so the page scrolls sideways.
