---
title: Privacy, DMCA operations and data lifecycle
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# Privacy, DMCA operations and data lifecycle

Implements roadmap M17 and decisions D1/D7 as product surfaces, jobs and runbooks. **Nothing here is legal advice.** Every value marked "counsel" must be set by qualified counsel before launch; privacy law (GDPR, minors) was **not researched** in `docs/` (QL6), so this doc defines the mechanisms and leaves the parameters open.

> **Personal mode is current (`25-personal-mode.md`): copyright and legal processes are out of scope.** §1 (lawful-input guardrails), §2 (DMCA program) and §5 (legal launch checklist) are **dormant** — they apply only if Splitune is ever opened to the public or commercialised. What stays active: §3 data lifecycle jobs as disk hygiene (song/account deletion cascade, stem sweeper with a generous 180-day window, raw uploads kept by default) and §4 privacy self-service (export/delete), which are cheap and keep the codebase ready.

## TL;DR
- **Lawful-input guardrails in product:** upload warranty checkbox (stored per upload), ToS naming prohibited sources (ripped streams), no "rip/download from YouTube" copy anywhere, the YouTube link only opens an embed and prompts for the user's own file (D1).
- **DMCA program:** registered agent ($6, renew every 3 years), public notice form + email, triage queue, takedown = delete upload **and all derivatives**, counter-notice flow, repeat-infringer strikes and termination.
- **Data lifecycle jobs:** raw-upload expiry, stem inactivity sweeper, song and account deletion cascades, YouTube API data 30-day refresh, local-cache purge on sync. All idempotent, logged in `audit_log`.
- **Privacy baseline (pending counsel):** data minimisation, export (DSAR) and deletion self-service, training opt-in default off, processor list (vendors) with DPAs, cookie/analytics consent where required.
- **Counsel gates before launch:** QL1–QL4 and QL6; record memo refs in the licence register and launch checklist.

## 1. Lawful-input guardrails (Designs A, B, E)
| Surface | Requirement | Implementation |
|---|---|---|
| Upload dialog | User confirms they own or are licensed to use the file for private practice | Required checkbox; `uploads.rights_warranty_at`; text versioned (`tos_version` in the event) |
| YouTube link paste | Opens an RMF-compliant embed; prompts "add a file of this recording you own" or "record yourself"; never fetches audio | `13-import-onboarding-and-youtube-embed.md`; server has **no** code path that takes a URL as audio input; a lint rule bans `yt-dlp`/`youtube-dl`/`pytube` and similar packages in all lockfiles (compliance check) |
| Copy and marketing | No "rip", "download from YouTube/Spotify", "convert link to MP3" | Copy review checklist in the release template; marketing site lint for banned phrases |
| Embed paywall | Watching the embed is never gated; paid features are analysis of the user's file and practice tools | Entitlement checks never wrap the embed component (`14-auth-billing-and-entitlements.md`); pending QL1 |
| Sharing | No public sharing of stems, tabs or analyses in MVP/v1 | No share endpoints exist; signed URLs are per-request and expire |

## 2. DMCA program
### Setup (before accepting uploads)
1. Register the designated agent with the U.S. Copyright Office DMCA Directory ($6; renew every 3 years; calendar reminder at 33 months).
2. Publish agent contact details at `/legal/dmca` and in the app's legal menu.
3. ToS (counsel drafts): warranty, narrow processing licence, prohibited sources, repeat-infringer policy (§ 512(i)), counter-notice procedure (§ 512(g)).

### Intake
- Web form at `/legal/dmca/notice` (no account needed) collecting the statutory elements: claimant identity and contact, identification of the work, identification of the material (song title/artist as known; we cannot browse users' private libraries by URL), good-faith and accuracy statements, signature. Also `dmca@` mailbox piped into the same queue.
- Raw notice stored in the restricted compliance bucket; parsed fields in `dmca_notices`.

### Triage and action (runbook)
1. **Validate completeness** (trained operator; template responses for incomplete notices).
2. **Locate material.** Because content is private, matching uses the notice's identifiers plus optional audio fingerprinting of the claimant-supplied sample *against the noticed user's or all users' raw uploads only if counsel approves that search*. Default: action only material the notice identifies precisely enough (counsel to define).
3. **Takedown:** run `takedown(song_ids)` → same cascade as song deletion (DB rows, all objects under the song's prefixes, stems, artefacts, render cache) + tombstone `songs.status='taken_down'` + `dmca_actions` rows + notify user with counter-notice instructions.
4. **Strike:** insert `dmca_strikes`; at the counsel-set threshold (e.g., 3 strikes in 12 months), terminate the account (subscription cancelled, prorated refund policy per counsel).
5. **Counter-notice:** form for the user; forward to claimant; restore only if no court action notice within the statutory window — but stems/artefacts were deleted, so "restore" means re-enabling the song row so the user may re-upload and re-analyse.
6. **SLA targets (proposal):** acknowledge ≤1 business day; action ≤24 h after a valid notice.

### Drill
Quarterly takedown drill in staging with a synthetic user: verify every object key under the song prefixes is gone, artefacts rows gone, client caches purged on next sync, audit entries complete.

## 3. Data lifecycle jobs
All are scheduled workflows in the orchestrator (`06-ml-pipeline-service.md` shares the engine) and are idempotent.

| Job | Schedule | Logic | Metric/alert |
|---|---|---|---|
| `expire-raw-uploads` | hourly | `uploads.expires_at < now()` → delete object → `status='expired'`; object-store lifecycle rule is the backstop | count, failures |
| `sweep-stems` | nightly | artefacts of kind `stems` with song `last_opened_at < now() - M days` → delete objects, keep JSON; mark song "stems expired" | bytes freed |
| `delete-song` | on demand | cascade per `03-data-model-and-storage.md`; enqueue object deletes by prefix; verify by listing prefix = empty | latency, residual objects |
| `delete-account` | on demand | revoke sessions → cancel subscription at provider → delete all user prefixes → hard-delete rows → keep compliance/billing minimum | completion ≤30 days (counsel) |
| `refresh-youtube-data` | nightly | refresh or null `youtube_refs.fetched_title` older than 30 days | rows touched |
| `vendor-deletion-check` | weekly | for vendors that retain inputs, call their deletion API or verify retention window per contract | non-compliant items |

**Vendors as processors:** separation vendors receive user audio. Contract must state retention period, deletion on request, no training on customer content, sub-processors, region (QL5). Where a vendor offers a delete endpoint, call it right after we have stored stems.

## 4. Privacy baseline (mechanisms; parameters pending QL6)
- **Minimisation:** no real names required; email only; no contacts, location or ad identifiers; analytics with pseudonymous ids.
- **Self-service:** Settings → "Download my data" (JSON export of account, songs metadata, loops, practice logs, corrections; links to own uploads while they still exist) and "Delete my account".
- **Consent:** training opt-in (separate, off by default, revocable; revocation removes the user's corrections from future training sets), marketing opt-in, analytics/cookie consent banner where required — choose the most privacy-preserving defaults.
- **Minors:** if counsel requires (teen persona P5), add age gate at signup and parental-consent flow; until decided, launch markets and marketing target adults.
- **Records:** processor list (hosting, storage, DB, auth, payments, analytics, error tracking, email, separation vendors) with DPAs; data map maintained in `compliance/data-map.yaml`.
- **Breach response:** runbook in `19-deployment-and-operations.md` (who decides, timelines per counsel).

## 5. Launch checklist (legal/compliance)
- [ ] Counsel memos for QL1 (embed paywall), QL2 (fair use of paid per-user processing), QL3 (§ 512(c) scope, retention N/M), QL4 (amber models used at launch) — refs recorded.
- [ ] ToS, Privacy Policy, DMCA policy, repeat-infringer policy published; versions recorded.
- [ ] DMCA agent registered and published.
- [ ] Vendor DPAs signed; retention and no-training terms in writing.
- [ ] Takedown drill passed in staging within SLA.
- [ ] Banned-phrases copy review passed.
- [ ] Privacy self-service (export/delete) verified end to end.

## Implementation notes (step 15, 2026-10-22)
- **Where the jobs run:** the Mac's node worker (`apps/node-worker`), logged in a second time as `maintenance` (`NODE_WORKER_MAINTENANCE_DATABASE_URL`; off without it). A cron-like scheduler (`src/scheduler.ts`) claims each run in `schedule_runs` by compare-and-set, so a job runs once per due time across workers and restarts, and a Mac asleep at the due time catches up when it wakes. Nightly (`LIFECYCLE_NIGHTLY_AT`, default 03:30 local): `sweep-stems`, `refresh-youtube-data`, `pg-dump`; hourly: `expire-exports`, `expire-raw-uploads` (only with `LIFECYCLE_EXPIRE_RAW_UPLOADS=true`; personal mode keeps raw uploads); daily at `DIGEST_AT`: `daily-digest`. Every step writes `audit_log` (actor `lifecycle`).
- **Stems expired:** new `artefacts.purged_at` (migration 0012) and `ArtefactIndexEntry.purged_at`. A stems artefact is swept when both its song's `last_opened_at` (or `created_at`, never opened) and the artefact itself are older than 180 days (`LIFECYCLE_STEMS_INACTIVE_DAYS`) — so stems re-created today survive tonight. Only the files under `…/v{n}/stems/` are deleted; `stems.json` stays; examples (`assets/examples/…`) are never swept. Library shows "Stems expired" from `purged_at`; practice plays the song's own audio and shows `practice.stems_expired` with "Re-create stems" = rerun, **free** (like a pipeline-change rerun).
- **Delete my account:** `DELETE /v1/me` needs a sign-in within 10 minutes (else 403 `reauth_required`; the UI emails a magic link back to `/settings/privacy?confirm=delete`), sets `users.deleted_at` (sessions of such a user resolve to signed out) and enqueues `delete_account` in one transaction, then ends every session. The worker deletes `u/{user}/` → hard-deletes rows (users cascade, analytics events by user hash, rate-limit counters, the user's other account jobs) → deletes the prefix again and verifies it is empty → empties its own job payload. If an analysis stage was running, a follow-up pass runs 30 min later. Only `audit_log` keeps the id. The mock subscription is plain rows, so "cancel at provider" is the row deletion.
- **Download my data:** `POST /v1/me/export` (one pending at a time, 5/h), `GET /v1/me/export`; the worker writes `u/{user}/exports/{id}.json` (`DataExport` schema in contracts; tested against its JSON Schema with Ajv 2020) with 24 h links to the user's own uploads, and the API presigns the bundle until `expires_at` (24 h); `expire-exports` deletes it after.
- **Backups:** `pg_dump --format=custom --no-owner` as maintenance, of every schema the role may use (others, e.g. the local listening app's, are skipped and reported), into `PG_DUMP_DIR`, keeping `PG_DUMP_KEEP` (14). Restore into an empty database with `pg_restore --no-owner --dbname=<url> <file>` after `pnpm db:roles` (grants name the roles) — tested by restoring into a scratch database.
- `training_opt_in` is a Switch in Settings → Privacy (stored and audited; nothing trains on it).
## Open questions
- All counsel parameters above (N, M, strike threshold, takedown SLA, account deletion window, minors).
- Whether fingerprint matching of private uploads for takedowns is permitted or advisable.
- EU/UK launch requirements (QL9) and whether to geo-restrict at launch.

## Sources
Cross-linked: `research/legal/youtube-copyright-and-platform-policy.md` (UGC policy requirements, Data handling, Distribution of generated tabs, Designs A–F′), `research/product/recommendations-and-decisions.md` D1, D7, `research/open-questions-and-risks.md` (QL1–QL6, R4, R5, R15), `03-data-model-and-storage.md`.
