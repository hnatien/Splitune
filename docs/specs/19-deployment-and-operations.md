---
title: Deployment and operations
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# Deployment and operations

How code reaches staging and production, how the system is run day to day, and what to do when it breaks. Platforms: Cloudflare (web, R2, DNS), Railway (API, Postgres), Modal (ML), Inngest (workflows) — see `00-tech-stack.md`.

> **Personal mode is current (`25-personal-mode.md` §5–7).** Operations: Railway project `splitune` runs `app` (web + API; deploy via GitHub autodeploy on `dev` or `railway up`; migrations as a pre-deploy command) with Railway Postgres; audio and artefacts are in the R2 bucket `splitune-media` (CORS from `infra/r2/cors.json`); the Mac runs `node-worker` and `ml-worker` under `launchd`/`pm2`. Backups = nightly `pg_dump` from the Mac to an external disk. Watch spend with `railway usage projects` and a workspace usage alert. Runbooks that still matter: Mac offline (jobs wait; UI shows status), job backlog (raise CPU concurrency, check MPS memory), URL-import extractor breakage (bump yt-dlp), disk full (sweeper), restore drill. Cloudflare/Railway/Modal/Inngest/vendor/DMCA sections are the dormant hosted path.

## TL;DR
- **Infrastructure as code:** OpenTofu for Cloudflare (R2 buckets + lifecycle rules, DNS, Workers routes); Railway config-as-code per service; Modal apps deployed with `modal deploy` from CI; Inngest functions are served by the API (deploy = API deploy + sync).
- **Deploy flow:** PR → preview env; merge to `dev` → staging (migrations first); tagged release → manual approval → production. ML `pipeline_version` promotions are separate and gated on the regression suite.
- **SLOs (proposal):** API availability 99.9%; analysis success ≥98%; beat grid p50 ≤10 s; full analysis p50 ≤90 s (warm); practice route load p75 ≤2.5 s.
- **Runbooks** for vendor outage, GPU backlog/cold starts, Inngest outage, R2 errors, DB failover, cost spike, DMCA takedown, account deletion, security incident.
- **Backups:** Railway Postgres PITR + daily logical dumps to a separate R2 bucket (encrypted); R2 user content is not backed up (re-derivable or user-owned; deletion must be real).

## 1. Environments and promotion
| Env | Trigger | Data | ML | Approval |
|---|---|---|---|---|
| Preview | PR | Seeded synthetic | Mocks (GPU on label) | — |
| Staging | merge to `dev` | Synthetic + team accounts | Modal `staging`, real vendor in test/low quota | automatic |
| Production | release tag | Real users | Modal `prod` | manual (eng lead) + checklist |

**Release checklist (production):** CI green; migration plan reviewed (expand → migrate → contract; no destructive change in the same release as code depending on it); licence register snapshot + ML-BOM attached; feature flags for risky features default off; rollback plan noted.

## 2. Deploy mechanics
| Component | How | Rollback |
|---|---|---|
| Web (Cloudflare Workers + assets) | `wrangler deploy` from CI with versioned uploads; gradual rollout (percentage) | Re-activate previous version |
| API (Railway) | Railway deploy from the built image; health check `/internal/ready`; zero-downtime | Redeploy previous image |
| DB migrations | `drizzle-kit migrate` job before API rollout; expand/contract pattern | Forward-fix (contract steps only after code no longer needs old columns) |
| Inngest functions | Served by API; Inngest syncs on deploy; workflow code versioned (step ids stable) | Redeploy previous API; in-flight runs continue with step memoization |
| Modal | `modal deploy modal_app/app.py --env prod` with image tags = git sha | `modal deploy` previous sha |
| ML pipeline version | Config `pipeline.production.yaml` points to stage versions; promotion PR requires green regression + register check | Revert config PR (new analyses use previous models; existing artefacts untouched) |
| R2/DNS/lifecycle | `tofu apply` with plan reviewed in PR | `tofu apply` previous state |

## 3. Capacity and cost controls
- Modal: `min_containers` for `decode`/`beats` during peak hours only (schedule), `max_containers` per function to cap spend; preemptible base tier.
- Vendor: daily spend cap and per-user fair-use enforcement in admission; alert at 80% of monthly budget.
- Railway: API horizontal scaling by CPU; PgBouncer pool sizing; connection limit alerts.
- R2: storage growth dashboard; sweeper health.

## 4. SLOs and on-call
| SLO | Target | Measurement |
|---|---|---|
| API availability | 99.9% monthly | Synthetic checks + 5xx rate |
| Analysis success | ≥98% of analyses end `done`/`partial` with stems when requested | `analyses` table |
| Beat grid latency | p50 ≤10 s, p95 ≤30 s | stage timings |
| Full analysis latency | p50 ≤90 s warm, p95 ≤240 s | stage timings |
| Practice route load | p75 ≤2.5 s | RUM (PostHog web vitals) |
| Deletion SLA | 100% of song deletions object-complete ≤24 h | sweeper audit |
- On-call: one primary per week (small team: business hours + paging only for SEV1); paging via the alerting tool integrated with Axiom/Sentry.
- Severity: SEV1 = practice or login down for many users, data exposure; SEV2 = analyses failing broadly, billing broken; SEV3 = degraded feature.

## 5. Runbooks (abridged)
| Scenario | Detect | Act |
|---|---|---|
| Vendor outage/slowness | vendor error/latency alert | Flip `separation.vendor` flag to secondary; if both down, enable Spleeter fallback flag; post status banner ("stems delayed") |
| GPU backlog / cold-start storm | stage queue time, beat-grid p50 alert | Raise `min_containers`/`buffer_containers`; move beats to CPU small model flag; check Modal status |
| Inngest outage | workflow start failures | Reject new analyses with `pipeline_unavailable`; existing practice unaffected; resume when back (events are durable) |
| R2 errors | presign/upload error rate | Check Cloudflare status; uploads resume client-side; pause sweepers |
| Postgres failover | Railway HA event | Verify PgBouncer reconnect, run smoke tests, check replication lag |
| Cost spike | cost alerts | Identify by vendor/user/instrument; tighten fair-use; temporarily lower Lite/Full allowances via config (never retroactively for paid periods) |
| Abuse (scripted uploads) | rate/abuse alerts | Block user/IP at edge; review account |
| DMCA notice | intake queue | Follow `15-privacy-dmca-and-data-lifecycle.md` §2; verify deletion audit |
| Account deletion stuck | deletion job alert | Re-run idempotent job; verify prefixes empty |
| Security incident | Sentry/alerts/report | Contain (rotate keys, revoke sessions), assess data exposure, involve counsel, notify per law, post-mortem |
| Bad model release | correction/fallback rate spike per `model_id@version` | Revert pipeline config; offer re-analysis to affected users |

## 6. Backups and disaster recovery
- Postgres: Railway PITR (retention per plan) + nightly `pg_dump` to `splitune-backups-{env}` (R2, separate account credentials, 30-day retention, encrypted with a key held outside Railway). Quarterly restore drill into a scratch environment; RPO ≤24 h for dumps, minutes with PITR; RTO ≤4 h.
- R2 user content: not backed up by design (deletion must be effective; artefacts re-derivable; raw uploads expire). Example-song assets and model weights are reproducible from the repo/assets bucket with versioning enabled.
- Config and IaC in git; secrets documented (names, owners) in the private ops vault.

## 7. Status and communication
- Public status page (hosted) with components: web, API, analysis pipeline, billing.
- In-app banner driven by a flag for incidents affecting analyses.
- Post-mortems blameless, published internally within 5 business days for SEV1/SEV2.

## Implementation notes (step 17, 2026-10-23)
**What runs where.** Railway project `splitune` / `production`, region Singapore (`asia-southeast1-eqsg3a`): `Postgres` (image `postgres-ssl:18`, volume `postgres-volume` 5 GB cap, public TCP proxy for the Mac) and `app` (`https://app-production-d679.up.railway.app`). Both declared in `infra/railway/railway.ts`; the TCP proxy and the generated domain are not IaC-managed (the SDK's `postgres()` creates no proxy; generated domains must not be in source) — they were added with `railway api tcpProxyCreate` and `railway domain --service app`. Audio and artefacts: R2 `splitune-media` (CORS `infra/r2/cors.json`). Workers: the owner's Mac, launchd agents `com.splitune.node-worker` / `com.splitune.ml-worker` (`pnpm workers install|restart|status|uninstall`, logs `~/Library/Logs/Splitune/`), run as the owner's own macOS account (owner's choice 2026-10-23; a dedicated low-privilege account is still open, see 17).

**Deploys.** GitHub `hnatien/Splitune` branch `dev` autodeploys `app` when a watched path changes (`apps/web`, `apps/api`, `packages`, `infra/railway`, root manifests/lockfile; worker, ML, CI and docs changes don't redeploy). Build: `infra/railway/Dockerfile` (fails if `dsp.wasm`'s hash differs or the server links a stylesheet the client build didn't emit). Pre-deploy: `node packages/db/scripts/migrate.ts` (= `pnpm db:migrate`; no pnpm in the image). Health check `/internal/ready` (DB ping; the prompt's `/v1/ready` doesn't exist), 120 s. Serverless sleep on; Railway's default restart policy. `pipeline_version` = the deploy's commit (`RAILWAY_GIT_COMMIT_SHA`). Never report a deploy without `railway deployment list --service app --json` showing `SUCCESS` for that commit. Change infrastructure through `infra/railway/railway.ts`: `railway config plan --file infra/railway/railway.ts` must say "already up to date" after any change.

**`app` variables (names only).** Literal in IaC: `NODE_ENV`, `LOG_LEVEL`, `TRUST_PROXY`, `CSP_REPORT_ONLY`, `APP_URL`/`BETTER_AUTH_URL` (`https://${{RAILWAY_PUBLIC_DOMAIN}}`), `BILLING_PROVIDER`, `BILLING_CURRENCY`, `BILLING_PRICE_MONTHLY_MINOR`, `BILLING_PRICE_YEARLY_MINOR`, `S3_REGION`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`; reference `DATABASE_URL` (Postgres, private network). Secrets set with `railway variable set <NAME> --stdin --service app` and kept by `preserve()`: `BETTER_AUTH_SECRET`, `BILLING_WEBHOOK_SECRET`, `ANALYTICS_SALT` (same value in `.env.worker`), `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (R2 token `splitune-app`), `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` (owner's Gmail SMTP). Not set: `ENABLE_DEV_CLOCK`, `GOOGLE_CLIENT_*`, `CORS_ORIGINS`, `PIPELINE_VERSION`, `EXAMPLES_MANIFEST`.

**`.env.worker` on the Mac (names only; git-ignored, mode 600; template `.env.worker.example`).** Read only by the two launchd agents (node: `--env-file`; ML: `SPLITUNE_ENV_FILE`), never by `pnpm dev`, `dev:all` or E2E, which read only `.env`. `LOG_LEVEL`, `CACHE_SCOPE`, `ML_DATABASE_URL` (role `ml_worker`, `sslmode=require` + libpq keepalives), `NODE_WORKER_DATABASE_URL` (`node_worker`, `sslmode=no-verify`), `NODE_WORKER_MAINTENANCE_DATABASE_URL` (`maintenance`), `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` (R2 token `splitune-mac-workers`), `ANALYTICS_SALT`, `FFMPEG_BIN_DIR`, `ML_CACHE_DIR` (`~/.cache/splitune/ml-production`), `ML_MODELS_DIR`, `ML_WORKER_ID`, `ML_MPS_SLOTS`, `ML_CPU_SLOTS`, `ML_TORCH_DEVICE`, `NODE_WORKER_ID`, `LIFECYCLE_*`, `PG_DUMP_DIR` (`~/Splitune-backups/pg_dump` for now; move to an external disk), `PG_DUMP_KEEP`, `PG_DUMP_BIN`, `DIGEST_EMAIL_TO`, `DIGEST_AT`, `SMTP_*`, `EMAIL_FROM`. Railway's Postgres certificate is self-signed (`CN=localhost`, issuer `root-ca`), so the TCP-proxy connections are encrypted but unverified (`no-verify` / `require`); the nightly dump converts `no-verify` to libpq's `require`.

**Runbooks (personal mode).**
- *Mac offline / asleep:* analyses queue; the app shows the offline status after 2 min without a heartbeat; on wake the workers reconnect (pool + LISTEN with keepalive, 5 s polling fallback) and drain the queue. Check: `pnpm workers status`, `tail -f ~/Library/Logs/Splitune/*.log`.
- *Restart / update workers:* `git pull` on the Mac, then `pnpm workers restart` (`install` again after changing a plist template or moving Node).
- *Bad deploy:* `railway deployment list --service app --json` → `railway redeploy` of the previous one in the dashboard, or revert on `dev` and push; migrations are forward-only.
- *Rotate the app's R2 key:* create a new `splitune-app` token (doc 25 §6 recipe) piped into `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`, then `cf accounts tokens delete` the old one. The Mac's token is revoked alone if the Mac is lost.
- *Restore:* `pg_restore --no-owner --exit-on-error --dbname=<owner url> <dump>` into an empty database, then `pnpm db:roles` there (grants name the roles). Drill 2026-10-23: the first production dump restored into a scratch local database (15 migrations, 30 tables).
- *Rollback of the whole step:* `railway service delete` (app, Postgres), `cf accounts tokens delete` (`splitune-app`), `cf r2 buckets cors delete splitune-media`, `pnpm workers uninstall`.
- *Spend:* `railway usage projects --workspace <id> --project splitune --json`; recommended (not set): `railway usage limit set --workspace <id> --target workspace --soft 10` (email alert only; a hard limit can stop every service in the workspace).

## Open questions
- Paging tool choice and on-call compensation for a small team.
- Whether production needs a second region for the API/DB before v1 (start single region near most users; decide from latency data).

## Sources
Platform specifics and prices: `00-tech-stack.md`. Cross-linked: `01-system-architecture.md`, `02-repo-tooling-and-ci.md`, `15-privacy-dmca-and-data-lifecycle.md`, `16-observability-analytics-experiments.md`, `17-security.md`.
