# Step 17 — Deploy: Railway (`app`, Postgres) + Cloudflare R2 wiring + Mac workers

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/specs/25-personal-mode.md` §1, §5–§7 (topology, running it, budget guard, backups)
- `docs/specs/19-deployment-and-operations.md` (callout + runbooks)
- `docs/specs/17-security.md` (secrets, roles, CSP)
- `infra/r2/cors.json` and `docs/specs/25-personal-mode.md` §6 "Cloudflare R2" (what already exists, token recipe)
- If available, the Railway agent skill (`use-railway`) for CLI conventions and the `cloudflare:cf-cli` skill (use the `cf` CLI — the repo has no Wrangler config).

Prerequisites: Step 10. The owner chose (2026-10-21) to deploy as soon as step 10's combined server builds instead of waiting for the step 16 MVP gate. Smoke-test what exists at that point and re-run the full smoke test (deliverable 6) after step 16.

## Hard rule for this step
The Railway project `splitune` already exists and is empty (project `b54dcab4-7140-43f7-a8a4-67398ebe70b7`, environment `production` `44e23f0b-d4b3-4397-9748-54683296894a`). The owner's workspace is on Hobby and already above its included usage, so **every resource you add costs real money. Before creating Postgres, the `app` service, volumes or domains, list exactly what you will create and the expected monthly cost, and wait for the owner's explicit "yes" in chat.** Read-only commands (`railway status`, `railway usage …`, `railway logs`) need no approval. Never change workspace spending limits without the owner asking.

**Cloudflare R2 already exists (2026-10-21) — don't create another bucket:** bucket `splitune-media` (APAC, Standard, private, default 7-day multipart abort only) and token `splitune-mac-workers` (bucket-scoped Item Read + Write) whose S3 credentials are in the git-ignored `.env.r2` on the Mac. An empty bucket `splitune` also exists — leave it. The `app` token is free, but list it in the plan anyway. Never print token values or S3 secrets in chat, logs or files other than their destination.

## Goal
The app is reachable over HTTPS from anywhere on a Railway domain, with Postgres on Railway, audio and artefacts in Cloudflare R2, and the ML + Node workers running supervised on the owner's Mac, connected securely and cheaply.

## Deliverables
1. **Plan message to the owner** (before any mutation): resources, settings (serverless sleep on `app`), estimated monthly cost, rollback.
2. **After approval:** add Railway Postgres; add service `app` from the GitHub repo (or `railway up`) with build/start commands for the combined web + API server, pre-deploy migration command (`pnpm db:migrate`), health check `/v1/ready`, serverless sleep enabled; generate a Railway domain; serve self-hosted fonts and icons with long-lived `immutable` caching (CSP `font-src 'self'`; no third-party font hosts); do not deploy the Storybook build; set variables (DB reference, `S3_*` for R2, Better Auth secret and URL, SMTP, `BILLING_PROVIDER=mock`, `CACHE_SCOPE=global`). Prefer Railway config-as-code committed under `infra/railway/` if the CLI supports it for these resources.
3. **R2 for `app`:**
   - Token `splitune-app` via `cf accounts tokens create` with the policy in doc 25 §6 (Item Read + Write on `splitune-media` only). S3 key ID = token `id`, secret = SHA-256 hex of token `value`; pipe them straight into Railway variables without printing. `S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_BUCKET=splitune-media`, `S3_FORCE_PATH_STYLE=false`.
   - CORS: replace the `<app>` placeholder in `infra/r2/cors.json` with the generated Railway domain (commit it), apply with `cf r2 buckets cors update splitune-media --rules @infra/r2/cors.json`, check with `cf r2 buckets cors get splitune-media`.
   - CSP on the deployed app allows `https://*.r2.cloudflarestorage.com` in `connect-src` and `media-src`.
4. **Database roles:** create `ml_worker`, `node_worker`, `maintenance` passwords on Railway Postgres (migration from step 03 defines grants); the owner runs any role-password SQL themselves if the CLI path requires DB superuser actions — show the exact commands.
5. **Mac workers:** `.env.worker` (git-ignored) with `DATABASE_PUBLIC_URL` (TLS required) for the worker roles and the `S3_*` lines moved from `.env.r2` (then delete `.env.r2`; until production Postgres exists these must not be in `.env.worker`, or local-dev workers would write to R2); `launchd` plists (or `pm2` ecosystem) for `node-worker` and `ml-worker` with restart-on-crash, log files, and start at login; Deno + yt-dlp present.
6. **Backups:** nightly `pg_dump` from the Mac to a chosen local/external path pointed at Railway Postgres; document restore. The scheduled job arrives in step 15 — if it isn't built yet, document a manual `pg_dump` command now and point step 15's job at Railway when it lands.
7. **Smoke test in production:** browser multipart upload from the Railway domain (CORS preflight passes, no console errors), sign in, upload a short song, Full analysis completes on the Mac, practice works (once step 12 exists) on an iPad/phone over the Railway domain (check Light/Dark/Stage and the Stand reading size on the iPad at the music stand); Mac offline → UI shows queued state → back online → completes.
8. **Cost check:** `railway usage projects --workspace <id> --project splitune --json` after deploy and again after a few days; record numbers in `docs/progress-log.md`, plus the R2 bucket size against its 10 GB-month free tier. Recommend (don't set) a workspace usage alert.

## Acceptance criteria
- Production URL serves the app over HTTPS; health check green; migrations applied.
- End-to-end smoke test passes from a phone/tablet on cellular (not just home Wi-Fi).
- Worker reconnects after Mac sleep/wake and network changes (test it).
- No secrets in git; Railway variables and `.env.worker` documented in `docs/specs/19-…` (names only).
- Exactly two R2 tokens for Splitune (`splitune-app`, `splitune-mac-workers`), both scoped to `splitune-media`; `.env.r2` removed; doc 25 §6 "State" paragraph updated.

## Verification to run and report
The approved plan message, `railway status --json`, `cf r2 buckets cors get splitune-media`, a CORS preflight against a presigned URL from the production origin, deployment status `SUCCESS` for the `app` deployment (never report success without it), smoke-test results, usage numbers.
