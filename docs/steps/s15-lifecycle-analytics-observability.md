# Step 15 — Data lifecycle, privacy self-service, analytics and observability

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/specs/15-privacy-dmca-and-data-lifecycle.md` (callout: only §3 lifecycle and §4 privacy self-service are active)
- `docs/specs/16-observability-analytics-experiments.md` (event taxonomy, dashboards, alerts — personal-mode tooling in the callout)
- `docs/specs/25-personal-mode.md` §1, §7 (storage is Cloudflare R2; the bucket has no expiry lifecycle rules on purpose — only the default 7-day multipart abort — so these sweepers own all expiry; backups)
- `docs/specs/03-data-model-and-storage.md` (retention table)
- `docs/specs/27-screens-flows-and-content.md` §3.9 (Settings → Privacy layout), §5.6 `delete.*` copy

Prerequisites: Steps 09, 10, 12.

## Goal
Keep storage tidy and data controllable, and make the product measurable with free, self-hosted tooling.

## Deliverables
1. **Node-worker scheduled jobs** (cron-like scheduler inside `apps/node-worker`): `sweep-stems` (stems of songs not opened for 180 days → delete objects, keep JSON, mark "stems expired" — no such state exists yet in `songs`/`artefacts` or the `Song` contract: add it via a migration + contract change so the library badge and `practice.stems_expired` banner from doc 27 can render, plus the "Re-create stems" action), `delete-song` / `delete-account` cascades (DB + all object prefixes, verify prefix empty, audit log), `expire-raw-uploads` (off by default in personal mode; configurable), `refresh-youtube-data` (null fetched titles older than 30 days for embed-fallback refs), `pg-dump` nightly to a configured local path with rotation (keep 14).
2. **Privacy self-service:** Settings → "Download my data" (JSON export bundle written to the bucket, 24 h signed link) and "Delete my account" (re-auth required); `training_opt_in` toggle stored (no training pipeline exists — just the flag).
3. **Analytics:** `packages/analytics` typed taxonomy from doc 16 §2; `track()` for web (batched POST `/v1/events`, fails closed if blocked) and API/workers (direct insert into `analytics_events`, pseudonymous user hash, no titles/URLs/emails). Instrument the events already emitted by earlier steps and the rest of the MVP list, including `display_settings_changed` (appearance, score surface, distance, calibration, Hyperlegible, reduced motion, contrast — doc 16 §2) which answers the open questions in doc 26.
4. **Dashboards:** SQL views for activation, practice quality, trust (correction and fallback rates per `model_id@version`), pipeline latency, compute time per analysis, funnel (URL/file import success), browser/underrun health; a `docker compose` profile with Grafana provisioned to read them (local), or documented SQL queries if Grafana is skipped.
5. **Observability:** structured JSON logs everywhere (pino / structlog) with `analysis_id` correlation; optional OTel export (env-gated) to a local `grafana/otel-lgtm` container; Railway tracing can be enabled on `app` later. Error grouping: optional GlitchTip — skip unless cheap to self-host.
6. **Feature flags:** `feature_flags` table + typed `flag()` helper (server-evaluated, cached), used to gate v1 features.
7. **Alerts (personal scale):** a daily digest email (Mailpit/SMTP) with failures, queue backlog, disk growth, R2 bucket size against the 10 GB-month free tier (sum of object sizes via the storage adapter, or the Cloudflare API with a read-only token), worker offline periods.

## Acceptance criteria
- Tests: sweeper is idempotent and only touches eligible stems; account deletion leaves no rows (except audit log) and no objects under the user prefix; export bundle validates against a JSON schema.
- Events land in `analytics_events` from web and workers; no PII fields present (test asserts allowed keys only).
- Dashboard queries return data for a seeded week of synthetic events.
- `pg_dump` job produces a restorable dump (restore into a scratch DB in the test).
- Design QA checklist (doc 28 §5) passed for Settings → Privacy, the export-ready state and the delete-account flow (`delete.account_confirm`, re-auth).

## Verification to run and report
`pnpm --filter node-worker test`, `pnpm --filter api test -- privacy`, the restore test, screenshots or query outputs of 2–3 dashboards.
