---
title: API contract
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# API contract

The public API used by the web app (and later native apps), plus internal callbacks from Modal, vendors and the payment provider. Defined with **oRPC + Zod 4** in `packages/contracts/src/api/**`, served by Hono, and exported as **OpenAPI 3.1** for native clients and docs.

## TL;DR
- **Procedures are typed end to end** (oRPC client in the web app); the same router is exposed as REST-ish OpenAPI routes under `/v1/*`.
- **Auth:** Better Auth session cookie on web (`SameSite=Lax`, `Secure`, `HttpOnly`); bearer session tokens for native apps later. Every procedure resolves resources through the session's `user_id`.
- **Uploads never pass through the API:** the API issues presigned multipart part URLs; the browser PUTs directly to R2.
- **Long work is async:** `POST /v1/analyses` returns `202` with an `analysis_id`; progress via SSE; artefacts via short-lived signed URLs.
- **Errors use one shape** (`{ code, message, details?, retry_after_s? }`) with stable machine codes; messages are user-safe.

## Conventions
- JSON over HTTPS; `snake_case` fields matching `05-analysis-schema.md`; IDs are UUIDv7 strings (except auth user ids).
- **Idempotency:** mutating procedures accept `Idempotency-Key` (or `client_*_id` fields for batched sync). Repeats within 24 h return the original result.
- **Pagination:** cursor-based (`cursor`, `limit` ≤100).
- **Versioning:** path prefix `/v1`; additive changes only within v1; breaking changes → `/v2` with 6-month overlap for native apps.
- **Rate limits** (per user, sliding window; `17-security.md`): uploads 20/h, analyses 30/h, corrections 600/min, auth 10/min per IP.
- **CORS:** only the web origin(s); credentials allowed; no wildcard.

## Error codes
| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `invalid_input` | Zod validation failed (`details` lists fields) |
| 401 | `unauthenticated` | No/expired session |
| 403 | `forbidden` | Resource not owned by caller, or feature not in plan |
| 404 | `not_found` | Unknown or not yours (same response for both, to avoid enumeration) |
| 409 | `conflict` | Idempotency key reused with different body; upload already completed |
| 402 | `analysis_cap_reached` | Allowance for that analysis type exhausted (`details.type`, `details.resets_at`, `details.upgrade_available`) |
| 413 | `file_too_large` / `too_long` | Limits from `13-import-onboarding-and-youtube-embed.md` |
| 415 | `unsupported_media` | ffprobe rejected container/codec |
| 422 | `rights_warranty_required` | Upload without the warranty flag |
| 429 | `rate_limited` | With `retry_after_s` |
| 451 | `taken_down` | Song removed after a DMCA notice |
| 500 | `internal_error` | Unexpected server failure; the message never carries exception text (added in step 04) |
| 503 | `pipeline_unavailable` | Orchestrator/vendor outage; retry later |
| 422 | `url_unsupported` | URL import: no extractor for this URL (personal mode) |
| 502 | `url_download_failed` | URL import: download failed (personal mode; usually arrives as `stage.failed` on SSE) |

Codes and statuses live in `packages/contracts/src/api/errors.ts` (`ERROR_STATUS`, `ErrorEnvelope`). The oRPC contract declares them as typed errors (`data` = `details`; `analysis_cap_reached` carries `{ type, resets_at, upgrade_available }`, `rate_limited` carries `{ retry_after_s }`); the API maps them onto the envelope above.

## Public procedures (v1)

### Me & settings
| Method & path | Purpose | Notes |
|---|---|---|
| `GET /v1/me` | Profile, plan, usage this period, entitlements, flags | `usage: { welcome_available, full: { used, cap, resets_at }, lite: { used, cap, resets_at } }` (`cap: null` = no cap) |
| `PATCH /v1/me` | instrument, level, handedness, opt-ins | `training_opt_in` changes are audited |
| `POST /v1/me/export` | Start data export (DSAR) | Emails a link when ready |
| `DELETE /v1/me` | Start account deletion | Requires recent re-auth |

### Songs, uploads, recordings
| Method & path | Purpose | Notes |
|---|---|---|
| `POST /v1/songs` | Create song `{ title?, artist?, instrument, source_kind: "upload" \| "recording" }` | Returns `song_id`; URL songs come from import-url, example songs from onboarding |
| `GET /v1/songs` | Library list | Sorted by `last_opened_at` |
| `GET /v1/songs/{id}` | Song detail, latest analysis, artefact index, player_state | |
| `PATCH /v1/songs/{id}` | Title/artist/instrument/player_state | `player_state` patch is debounced client-side |
| `DELETE /v1/songs/{id}` | Delete song + cascade | `15-privacy-dmca-and-data-lifecycle.md` |
| `POST /v1/uploads` | `{ song_id, filename, bytes, mime, file_sha256, rights_warranty?: true, tos_version? }` (warranty dropped in personal mode) → `{ upload_id, part_size, parts: [{n, url}] }` or `{ duplicate_of_song_id }` | Part URLs expire in 1 h; `POST /v1/uploads/{id}/parts` refreshes |
| `POST /v1/uploads/{id}/complete` | `{ parts: [{n, etag}] }` | Triggers server validation |
| `DELETE /v1/uploads/{id}` | Abort | Aborts multipart in R2 |

### Analyses & artefacts
| Method & path | Purpose | Notes |
|---|---|---|
| `POST /v1/analyses` | `{ song_id, instrument, type: "full" \| "lite" }` → `202 { analysis_id, status }` (a Free user's first full request becomes the Welcome analysis) | Entitlement + cap check per `23-plans-free-and-paid.md`; idempotent on `(user, audio_hash, instrument, pipeline_version)` |
| `GET /v1/analyses/{id}` | Status, stages, progress, artefact list | |
| `GET /v1/analyses/{id}/events` | **SSE** stream of `job_events` | `Last-Event-ID` replay; 15 s heartbeats |
| `GET /v1/artefacts/{id}/url?variant=` | Signed GET URL (15 min) | `variant` picks codec for stems (`opus_webm` \| `aac_mp4`) |
| `POST /v1/analyses/{id}/rerun` | Re-analyse with current pipeline (new version) | Counts against cap only if the user asks; failed runs never count |

### Corrections & practice data
| Method & path | Purpose | Notes |
|---|---|---|
| `GET /v1/artefacts/{id}/corrections?after_rev=` | Ops since rev | |
| `POST /v1/artefacts/{id}/corrections` | Batch `{ ops: [{ client_op_id, op }] }` → `{ applied: [{client_op_id, rev}] }` | Ops validated with `CorrectionOp` |
| `GET/POST/PATCH/DELETE /v1/songs/{id}/loops` | Loop clips CRUD | |
| `POST /v1/practice/sync` | Batch `{ sessions[], attempts[] }` with client ids | Offline-safe; server dedupes |
| `GET /v1/progress?song_id=` | Per-clip best clean tempo, attempts over time | |

### URL import (personal mode)
| Method & path | Purpose |
|---|---|
| `POST /v1/songs/import-url` | `{ url, instrument, type: "full" \| "lite", download_video?: boolean }` → `202 { song_id, analysis_id, status }`; creates the song (`source_kind='url'`) + `url_import` job; progress on the analysis SSE stream; errors `url_unsupported`, `url_download_failed` |

### YouTube reference (embed fallback when a URL can't be downloaded)
| Method & path | Purpose |
|---|---|
| `PUT /v1/songs/{id}/youtube` | `{ video_id }` (parsed client-side; no server fetch of media) |
| `PUT /v1/songs/{id}/sync-points` | Replace syncpoints `[{audio_s, video_s}]` |
| `DELETE /v1/songs/{id}/youtube` | Remove reference |

### Billing
| Method & path | Purpose |
|---|---|
| `GET /v1/billing/plans` | Plans + prices for the user's country (from provider) |
| `POST /v1/billing/checkout` | Create checkout session → URL (personal mode: `/billing/mock-checkout?session=…`) |
| `POST /v1/billing/portal` | Portal URL (personal mode: `/billing/mock-portal`) |
| `POST /internal/dev/clock` | Dev/admin only: advance the billing clock to test renewals/expiry (mock mode) |

### Legal (unauthenticated)
| Method & path | Purpose |
|---|---|
| `POST /v1/legal/dmca-notices` | DMCA notice intake (rate-limited, captcha-free but abuse-throttled) |
| `POST /v1/legal/counter-notices` | Counter-notice (authenticated) |

## Internal endpoints (not in public OpenAPI)
In personal mode only `/internal/billing/webhook` (mock events, local HMAC) and the health checks are used; the ML worker uses the Postgres job queue instead of callbacks, and there is no vendor or Inngest.

| Path | Caller | Auth | Purpose |
|---|---|---|---|
| `POST /internal/inngest` | Inngest | Inngest signing key | Serve workflow functions |
| `POST /internal/ml/callback` | Modal | HMAC-SHA256 over body + timestamp, 5-min skew window, nonce single-use | Stage completion/failure with metrics |
| `POST /internal/vendors/{vendor}/webhook` | Separation vendor | Vendor signature scheme | Separation job done |
| `POST /internal/billing/webhook` | Payment provider | Provider signature | Subscription lifecycle |
| `GET /internal/health`, `/internal/ready` | Railway | private | Health checks |

## SSE event shapes
```ts
type JobEvent =
  | { type: "stage.started"; stage: string; at: string }
  | { type: "stage.completed"; stage: string; artefact?: { id: string; kind: string; version: number }; at: string }
  | { type: "stage.failed"; stage: string; error_code: string; fallback?: string; at: string }
  | { type: "progress"; value: number }
  | { type: "analysis.done"; status: "done" | "partial" | "failed"; summary_artefact_id?: string };
```
`stage` is a `StageName` from the stage catalogue (`06-ml-pipeline-service.md`). Schemas: `packages/contracts/src/api/events.ts`; the oRPC contract types `GET /v1/analyses/{id}/events` as an event iterator of `JobEvent`.
The client fetches artefact URLs on `stage.completed` (URLs are not embedded in events so replays never hand out stale signatures).

## Example: create an analysis
```http
POST /v1/analyses
Idempotency-Key: <UUIDv7, generated per request>
Content-Type: application/json

{ "song_id": "0192f6c4-7b10-7f00-8000-000000000001", "instrument": "bass" }
```
```http
HTTP/1.1 202 Accepted
{ "analysis_id": "0192f6c4-8b00-7a00-8000-0000000000aa", "status": "queued" }
```

## Implementation notes (step 04, 2026-10-20)
- `apps/api`: `createApi({ db, storage, config })` returns a Hono app (standalone: `pnpm --filter @splitune/api dev`, `src/server.ts`). Routed now: `GET/PATCH /v1/me`, songs CRUD, the four upload procedures, `/v1/openapi.json`, `/v1/auth/*` (Better Auth), `/internal/health`, `/internal/ready` (DB ping). Only routed procedures appear in the OpenAPI document; later steps add theirs to `v1Contract` in `apps/api/src/procedures.ts`. `pnpm --filter @splitune/api openapi:check` validates it (`@readme/openapi-parser`).
- **Error envelope:** contract errors keep their message; oRPC's own errors are mapped by status (`BAD_REQUEST` → `invalid_input` with `details.issues: [{ path, message }]`, 5xx → `internal_error`). New code `internal_error` (500) in `ERROR_STATUS`. 429 responses also set `Retry-After`.
- **Auth:** Better Auth base path `/v1/auth`; cookie `splitune.session_token` (`__Secure-` prefixed in production), HttpOnly, SameSite=Lax, Secure in production; sessions 30 days rolling. Cookie-authenticated mutations must send `X-Splitune-CSRF: 1` (403 `forbidden`, `details.reason = csrf_header_required`). Re-auth helper `requireRecentAuth` (sign-in within 10 min, else 403 with `details.reason = reauth_required`) is ready for `DELETE /v1/me` and email change.
- **Rate limits:** Postgres fixed window (`rate_limits` table, one atomic upsert): auth 10/min per IP on `POST /v1/auth/*` and magic-link verification; uploads 20/h per user. Client IP = last `X-Forwarded-For` hop when `TRUST_PROXY=true` (Railway), else the socket address. Better Auth's own limiter is disabled.
- **Uploads:** ≤ 500 MB (`file_too_large`), media types `audio/*`, `video/*`, `application/ogg`, `application/octet-stream` (else `unsupported_media`); parts of 8 MiB (more if needed to stay ≤ 10 000), each part URL signs its exact Content-Length; all part URLs are returned at creation. Duplicate = the user's latest *completed* upload with the same `file_sha256` that still belongs to a song. `complete` requires parts 1…n exactly once, sets `uploaded` (409 if already completed/cancelled) and does not start analysis. `DELETE` aborts only pending uploads (idempotent once deleted; 409 after completion). Raw uploads get `expires_at` = now + 7 days (proposal).
- **Songs:** `GET /v1/songs/{id}` also sets `last_opened_at` (library order); `PATCH` replaces `player_state` as a whole; list is keyset-paginated (opaque cursor, default 50). `DELETE` cascades rows and, in the same transaction, enqueues `delete_prefix` (`runner: node`, payload `{ user_id, prefixes }` for the song's raw-upload and analysis prefixes) for the node worker.
- CORS: `CORS_ORIGINS` (default `APP_URL`), credentials, no wildcard. JSON bodies ≤ 1 MiB. Logs: pino JSON with `request_id`, method, path without query, status, duration, salted `user_hash`.

## Implementation notes (step 09, 2026-10-21)
- Routed now: `POST /v1/analyses`, `GET /v1/analyses/{id}`, `GET /v1/analyses/{id}/events` (SSE), `POST /v1/analyses/{id}/rerun`, `GET /v1/artefacts/{id}/url`, `POST /v1/songs/import-url`, and the new `GET /v1/system/worker-status` (`{ online, runners: { python, node: { online, last_heartbeat_at } } }`, online = heartbeat < 2 min). Analyses, reruns and imports share the 30/h per-user limit.
- `POST /v1/analyses` → `409 conflict` with `details.reason = source_not_ready` while the song has no completed upload; a URL song whose download never succeeded gets a new `url_import`. Plus users' jobs get priority 50 (Free 100); a Free user's full run is recorded as `welcome`. `admitAnalysis()` (`apps/api/src/entitlements.ts`) is where step 14 plugs allowances in.
- `GET /v1/analyses/{id}` stages: the stage run when there is one, else the job (`queued` → `pending`, `cancelled` → `skipped` with `dependency_failed`); reused decode/beats come from the base analysis, and their artefacts are listed too.
- **SSE:** oRPC event iterator; each event's `id` is the `job_events.id`; `Last-Event-ID` resumes; keep-alive comment every 15 s; the stream ends after `analysis.done` (or when the analysis is gone or ended without one). A 404 for someone else's analysis is a plain JSON error, not an SSE frame.
- **New event** `analysis.waiting { reason: queued_waiting_for_worker, runner, at }`: written at creation and by open streams (every 15 s check) when runnable jobs wait for a runner with no fresh heartbeat; at most one per stall. `stage.failed.fallback` is a `MachineCode` (e.g. `stems_unavailable`); `progress` events are the share of finished jobs (≤ 0.99 until finalize sets 1).
- `GET /v1/artefacts/{id}/url` gained `stem_id`: with it, a stems artefact signs that stem's file in `variant` (default `aac_mp4`); `variant` without `stem_id` → `invalid_input`.
- **Error details are codes only:** `invalid_input` issues are now `{ path, code }` (Zod's issue code, or ours: `invalid_cursor`, `part_out_of_range`, `parts_incomplete`, `parts_mismatch`, `variant_needs_stem_id`, `not_a_stems_artefact`; numbers in separate fields such as `part_count`), replacing step 04's English `message` per issue. `ErrorEnvelope.message` stays as the contract's log/API-client text and is never rendered (27 §5.6).
- Import URLs naming an IP address, a single-label host or `.local`/`.localhost`/`.internal`/`.lan`/`.home.arpa` → `422 url_unsupported` (the worker also disables yt-dlp's generic extractor).

## Implementation notes (step 10, 2026-10-22)
- `GET /v1/songs` takes `q` (title substring), `instrument`, `status` (`ready|partial|analysing|failed`; `analysing` covers importing and analysing) and `sort` (`last_practised|added|title`) besides `cursor`/`limit`, and returns `LibrarySong` items: `Song` + `latest_analysis { id, type, status, stages_done, stages_total, recommended_view }`, `stems` (`available|expired|none`), `best_clean { tempo_pct, start_bar, end_bar }` (0-based bars). The cursor now carries its sort; one from another sort (or a step-04 cursor) is `invalid_input` / `invalid_cursor`.
- New: `GET /v1/uploads/lookup?file_sha256=` → `{ song_id | null }` (duplicate check right after hashing, before a song exists); `POST /v1/uploads` takes `allow_duplicate` ("Import anyway"); `GET /v1/system/stats` → median stage times for the progress ETA.
- The web server mounts the API in-process: `/v1/*` and `/internal/*` go to `createApi()` (`apps/web/app/server.ts`); server-side loaders call it without a network hop, forwarding the visitor's cookie. The standalone API script is now `pnpm --filter @splitune/api dev:standalone` (both used port 3000).

## Implementation notes (step 12, 2026-10-22)
- New: `GET /v1/songs/{id}/media?kind=source|video` (`songs.mediaUrl`) → signed URL of the song's own audio (upload, recording or URL import) or the URL import's video; `not_found` until it exists. Needed because the song's own audio has no artefact id (chords-only/stems-unavailable fallbacks and VideoPane play it).
- Implemented on the API (contracts unchanged): `POST/GET /v1/artefacts/{id}/corrections` (idempotent on `client_op_id`, `base_rev` → `conflict` with the current rev; 600/min), loops CRUD (`/v1/songs/{id}/loops`), `POST /v1/practice/sync` (sessions + attempts by client id; attempts on another user's or a deleted loop keep `loop_id = null`; clean attempts raise `best_clean_tempo_pct`), `GET /v1/progress`.

## Implementation notes (step 13, 2026-10-22)
- New procedures: `GET /v1/examples` (public; each example as a ready `SongDetail` with its finished analysis), `GET /v1/examples/{id}/url?artefact_id=&stem_id=&variant=` (public, 300/min per IP; signs a document or a stem inside the example's build prefix), `POST /v1/examples/{id}/claim` (session; idempotent; body: the device's loops with their ids, sessions, attempts, corrections by artefact kind, player_state, instrument, level → `{ song_id }`), `POST /v1/events` (public, 120/min per IP; 204; body `{ events: AnalyticsEvent[] }` ≤ 20).
- `artefacts.url` signs stems of a claimed example inside the example's prefix instead of the user's (`signArtefact`). The authorization matrix lists public procedures explicitly and checks they answer anonymous callers.

## Implementation notes (step 14, 2026-10-22)
- **Billing is its own contract** (`billingContract`, `packages/contracts/src/api/billing-router.ts`): `GET /v1/billing/plans` (public; prices from config, `allowances` from limits + flags), `POST /v1/billing/checkout {plan, return_path?}` (409 `already_subscribed` on Plus), `POST /v1/billing/portal` (404 without a subscription), and personal-mode `GET /v1/billing/mock/session?session=`, `POST /v1/billing/mock/checkout {session, outcome}`, `POST /v1/billing/mock/portal {session, action}`. Mock sessions are HMAC-signed, 1 h, bound to the user (anyone else: 404 `billing_session_invalid`). The API routes it with `contract` (`v1Contract.billing`); the web loads its client only on billing pages (practice-route budget). `PaidPlan`/`Plan` live in `plan.ts` for the same reason.
- `BillingEvent` carries `id` (provider event id). `POST /internal/billing/webhook`: header `splitune-signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "webhook.<t>.<body>")>`, ±300 s; 401 bad signature, 400 invalid payload or unknown user, 200 `{received, applied}`; applied once per id.
- `POST /internal/dev/clock {advance_days}`: 404 unless `ENABLE_DEV_CLOCK=true`; needs a session and the CSRF header; moves the process' billing clock and settles renewals/expiry/reminders; `{now}`.
- `analysis_cap_reached` details: `type` = `welcome` (Free, Welcome used; `resets_at` null), `full` (Plus' period allowance), `lite`; `upgrade_available` = Free. Re-runs with a different `pipeline_version` are never charged or refused.

## Implementation notes (step 15, 2026-10-22)
- `POST /v1/me/export` (202, `DataExportState`), `GET /v1/me/export`, `DELETE /v1/me` (202 `{ purge_after }`, re-auth ≤ 10 min) and `POST /v1/events` live in contracts' `privacyContract` / `eventsContract` (like `billingContract`), so the shared client and the practice bundle don't carry their schemas. `ArtefactIndexEntry.purged_at`; rerun of a run whose stems were swept uses no allowance; `url_unsupported` with `details.reason = import_disabled` when the `import.url` flag is off; loop `trainer` refused (`feature_disabled`) while `v1.speed_trainer` is off.
## Open questions
- Whether native apps (v1) need a GraphQL-style aggregate endpoint for the practice screen to reduce round-trips (start with `GET /v1/songs/{id}` returning everything needed).
- Whether to expose WebSocket instead of SSE for native (SSE works in WebViews and native HTTP clients; keep SSE unless measurements say otherwise).

## Sources
Library facts (oRPC OpenAPI generation, Zod 4, Hono, Better Auth, Railway HTTP limits) are cited in `00-tech-stack.md`. Cross-linked: `01-system-architecture.md`, `03-data-model-and-storage.md`, `05-analysis-schema.md`, `ml/deployment-and-inference.md` §6 (`POST /jobs → 202`, progress events).
