---
title: Security
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# Security

Threat model and controls. The assets worth protecting are users' uploaded recordings and derived stems/tabs (copyrighted works held privately per user), account and billing state, vendor/API keys, and Splitune's ability to keep its YouTube API and app-store standing.

> **Personal mode is current (`25-personal-mode.md`).** The deployment is the Railway project `splitune` (public HTTPS domain) plus workers on the owner's Mac that connect outbound to Railway Postgres (TCP proxy, TLS, restricted roles) and the R2 bucket (bucket-scoped token). Keep: per-user scoping and RLS (friends may have accounts), HTTPS everywhere (also required for AudioWorklet/mic/service workers), media sandboxing for ffmpeg and yt-dlp (run them as a low-privilege user with timeouts and size caps), secrets in Railway variables and a local `.env.worker` outside git, CSP; rotate DB role passwords and revoke the Mac's R2 token if the Mac is lost. Drop: vendor/MoR/Inngest third-party sections, external pen test. The CSP `connect-src`/`frame-src` lists use the local origin plus YouTube only for the embed fallback, and `connect-src`/`media-src` add the R2 S3 endpoint (`https://*.r2.cloudflarestorage.com`) for presigned uploads and playback.

## TL;DR
- **Per-user isolation is the top control:** every query scoped by `user_id` in code **and** Postgres RLS; every presigned URL asserts the `u/{user_id}/` prefix; no public buckets; no sharing endpoints.
- **Untrusted media is processed only in sandboxed, resource-limited workers** (ffprobe/ffmpeg on Modal CPU containers with no credentials beyond presigned URLs), with strict size/duration/time limits.
- **Workers and vendors get capabilities, not credentials:** presigned URLs scoped to single objects, short expiry; HMAC-signed callbacks with timestamp + nonce.
- **Web hardening:** strict CSP (YouTube frames allowed, no inline scripts), HttpOnly/Secure/SameSite cookies, CSRF protection for cookie-authenticated mutations, rate limits, no cross-origin isolation headers (by design).
- **Supply chain:** lockfiles, pinned versions, Renovate with review, licence + vulnerability scans, banned packages, reproducible WASM builds, signed releases.

## 1. Threat model (STRIDE summary)
| Threat | Example | Controls |
|---|---|---|
| Spoofing | Session theft; forged ML callback; forged billing webhook | HttpOnly cookies, short-lived sessions, re-auth for sensitive actions; HMAC callbacks (ts ±5 min, single-use nonce); provider signature verification |
| Tampering | Client edits another user's corrections; modifies entitlement | Server derives `user_id` from session only; entitlements computed server-side; ops validated with Zod |
| Repudiation | Disputed takedown or deletion | `audit_log` for deletions, DMCA actions, opt-in changes, admin access |
| Information disclosure | IDOR on `/songs/{id}`; leaked presigned URL; logs with URLs | Ownership checks + RLS; uniform 404; 15-min GET URLs; URL scrubbing in logs/Sentry; no titles/emails in object keys |
| Denial of service | Huge uploads, decompression bombs, analysis spam, SSE connection floods | Size/duration caps, ffprobe pre-check, decode time limits, per-user rate limits and caps, connection limits per user |
| Elevation of privilege | Malicious media exploiting ffmpeg; admin panel misuse | Sandboxed workers without secrets; pinned ffmpeg with security updates; admin via separate role + SSO + audit |

## 2. Authorization
- Repository layer requires `userId` for every user-scoped table (lint rule in `02-repo-tooling-and-ci.md`).
- **Postgres RLS** on user tables: the API sets `app.user_id` per transaction (`SET LOCAL`), policies `using (user_id = current_setting('app.user_id'))`; background jobs use a separate role with explicit `BYPASSRLS` only where needed (sweepers, DMCA), audited.
- Authorization tests: for every endpoint, a generated test asserts user B cannot read/modify user A's resource (404).
- Admin/support tooling: read-only by default, no audio playback of user content without a logged justification (support should never need it).

## 3. Upload and media handling
- Client never uploads through the API; presigned multipart to `u/{user_id}/raw/{upload_id}/…` with content-length limits per part.
- Server-side validation in `decode`: ffprobe with `-probesize`/`-analyzeduration` limits, allowlist of containers/codecs, reject >20 min, enforce decode wall-time (120 s) and output size caps, run as non-root in a container with no network except the presigned URLs and callback.
- Filenames are never used in paths or shell commands; ffmpeg invoked with argument arrays, not shell strings.
- Video streams are discarded; we never extract or store frames.
- Malware scanning is not meaningful for audio decoding (the decoder is the attack surface) — rely on sandboxing and patching; re-evaluate if export or sharing features ever serve user files to others.

## 4. Secrets and keys
- Stored in Railway variables, Modal secrets, Cloudflare secrets and GitHub environments; Infisical/Doppler once sprawl grows.
- Rotation: vendor and payment keys yearly or on staff change; Apple Sign-in client secret ≤6 months (calendar job); callback HMAC secret rotated with dual-key overlap.
- gitleaks pre-commit and CI; no secrets in Inngest payloads (IDs only).

## 5. Web security headers
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  worker-src 'self' blob:;
  connect-src 'self' https://api.splitune.app https://*.r2.cloudflarestorage.com https://*.posthog.com https://*.sentry.io;
  frame-src https://www.youtube-nocookie.com https://www.youtube.com;
  img-src 'self' data: https://i.ytimg.com;
  media-src 'self' blob:;
  style-src 'self' 'unsafe-inline';   # tighten with nonces if feasible
  font-src 'self';
  object-src 'none'; base-uri 'self'; frame-ancestors 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: microphone=(self), camera=(), geolocation=(), midi=(self)
X-Content-Type-Options: nosniff
```
- **No COOP/COEP isolation** — it would break the YouTube embed in Safari/Firefox (`24-browser-compatibility.md`).
- CSRF: cookie-authenticated mutations require a custom header (oRPC client adds it) + `SameSite=Lax`; CORS restricted to app origins.
- Rate limiting at the API (per user and per IP) with a Redis-free token bucket in Postgres or an in-memory limiter per instance plus Cloudflare rules at the edge.

## 6. Third parties
| Party | Data | Controls |
|---|---|---|
| Separation vendors | Decoded audio for one analysis | DPA; presigned GET ≤1 h; call vendor delete after fetch; no training clause |
| Modal | Audio and intermediates during a stage | Ephemeral containers; no persistent user data in Volumes (only weights) |
| Inngest | IDs and step results metadata | No content or URLs in payloads |
| PostHog/Sentry/Axiom | Pseudonymous telemetry | Scrubbing; region per counsel |
| Payments MoR | Billing identity | Webhook verification; no card data touches us |

## 7. Supply chain and build integrity
- Lockfiles committed; `pnpm install --frozen-lockfile`, `uv sync --frozen`.
- Vulnerability scanning: GitHub Dependabot alerts + `pnpm audit`/`pip-audit` in CI (fail on critical with known exploit).
- Banned packages list enforced by `compliance:check` (stream-ripping tools and copyleft libraries not cleared).
- Emscripten and model images built in pinned containers; artefact SHA-256 recorded; GitHub Actions use pinned action SHAs and OIDC to clouds where supported.
- Model weights verified against the licence register hash at load time.

## 8. Incident response
- Severity matrix, on-call rotation, and runbooks in `19-deployment-and-operations.md`.
- Security incidents involving personal data follow counsel's breach-notification procedure (timelines per jurisdiction; QL6).
- Post-incident review within 5 business days; action items tracked.

## 9. Security testing
- Automated: authz matrix tests, dependency scans, CSP report-only in staging before enforcing, ZAP baseline scan against staging nightly.
- Manual: threat-model review before G1; external penetration test before public launch (G2).

## Implementation notes (step 10, 2026-10-22)
- Headers are set by the web server entry (`apps/web/app/server/headers.ts`, unit-tested): per-document CSP nonce (`script-src 'self' 'nonce-…' 'wasm-unsafe-eval'`; TanStack Start's inline scripts and Base UI's pre-hydration scripts get it through `router.options.ssr.nonce` and Base UI's `CSPProvider`), `connect-src`/`media-src` = `'self'` + the S3 endpoint's origin from `S3_ENDPOINT` (`https://*.r2.cloudflarestorage.com` for R2, `http://localhost:8333` locally), `img-src` adds `blob:`, `form-action 'self'`, `frame-ancestors 'none'`. `style-src 'unsafe-inline'` stays (Base UI and Tailwind inline styles). The dev server (`vite dev`) relaxes `script-src` to `'unsafe-inline'` and allows `ws:` for HMR.
- `Permissions-Policy: microphone=(self)` is sent on every document: the app is one document across client-side navigation, so the grant can't be limited to `/import`.
- No PostHog/Sentry in `connect-src` (personal mode has neither). No COOP/COEP (asserted by a test).

## Implementation notes (step 12, 2026-10-22)
- Zod is configured jitless from a head script so the `script-src` without `unsafe-eval` holds (Firefox reported Zod's JIT probe). CSP unchanged in step 12; the YouTube IFrame API would need `script-src https://www.youtube.com` (not added).

## Implementation notes (step 16, 2026-10-23)
- **CSP reporting:** the policy names `report-uri /internal/csp-report`; the API logs each violation as `csp violation` (directive, blocked origin + path or keyword, page path; never query strings), 60/min per IP, 64 KB body cap, always 204. `report-uri` only: next to `report-to` Chromium ignores it, and Chromium's Reporting API uploads were never delivered in testing; Firefox, WebKit and Chromium all deliver `report-uri` (E2E `security.spec.ts`). **Report-only first:** `CSP_REPORT_ONLY=true` sends the same policy as `Content-Security-Policy-Report-Only`; trial a changed policy that way on Railway, watch the logs, then set it back to `false`. The MVP policy was trialled report-only over the smoke suite (no reports) and is enforced.
- **Static files** are served by Nitro before `app/server.ts`; a Nitro route rule adds `x-content-type-options: nosniff` and the referrer policy to them (`BASE_HEADERS`). API responses already carried nosniff, referrer policy, `no-store` and HSTS in production.
- **Authz matrix** (`apps/api/test/authz-matrix.test.ts`) is generated from the routed `v1Contract` and fails if a routed procedure has no case: green. `songs.putYoutube`, `songs.deleteYoutube` and `songs.putSyncPoints` exist in the contract but aren't routed (404 for everyone) — they join the matrix when routed.
- **Media handling:** ffmpeg/ffprobe and yt-dlp already ran with argument arrays, timeouts (decode/encode 120 s, yt-dlp 60/150/80 s, stage 300 s), size caps (500 MB source, yt-dlp `--max-filesize` 500/750 MB, `-t` past 20 min, output frame check), `-protocol_whitelist file`, generic extractor off, and an environment allowlist (no database or bucket secrets reach them). Step 16 pins `-probesize 5000000 -analyzeduration 5000000`. **Not done: a separate low-privilege user.** Per-process `setrlimit`/user switches from the worker aren't safe (it is multithreaded: `preexec_fn` can deadlock), so the boundary has to be the worker's own account: run both workers from a dedicated standard macOS account (no admin, no access to the owner's home) via its own LaunchAgent, or a LaunchDaemon with `UserName` — step 17's launchd setup, owner's decision.
- **Dependency audit** (`pnpm audit:deps`, CI): `pnpm audit --audit-level critical` → 0 critical (5 high, 3 moderate, 1 low, all in dev-only CLIs: Lighthouse CI, the shadcn CLI, drizzle-kit's esbuild). pip-audit over the locked ML workspace and both islands → only `transformers 4.45.1` (43 advisory entries), accepted for that pin in `scripts/audit/findings.mjs`: only the optional YourMT3 evaluation extra imports it; production uses Basic Pitch; the advisories concern loading untrusted checkpoints/tokenizers.

## Implementation notes (step 17, 2026-10-23)
- **Secrets:** Railway variables (set through `--stdin`, never on a command line or in output) and the Mac's `.env.worker` (mode 600, git-ignored); names in `19` step-17 notes. Two R2 tokens, each Item Read + Write on `splitune-media` only (`splitune-app` in Railway, `splitune-mac-workers` on the Mac) so either can be revoked alone. Role passwords for `ml_worker`, `node_worker`, `maintenance` generated on the Mac and set with `pnpm db:roles` as the database owner over the TCP proxy; `app` and `dashboard_reader` stay NOLOGIN.
- **TLS to Railway Postgres:** the public TCP proxy serves a self-signed certificate (`CN=localhost`, issuer `root-ca`, generated in the container), so the Mac's connections are encrypted but not verified (`sslmode=no-verify` in node-postgres, `require` in libpq/psycopg). Accepted for personal mode; a verified connection would need Railway to expose its CA.
- **Worker account:** the owner chose (2026-10-23) to run both workers as LaunchAgents of their own account for now. The step-16 recommendation stands as an open item: a dedicated standard macOS account (own checkout, weights and login session) to contain ffmpeg/yt-dlp.
- **CSP in production:** enforced (`CSP_REPORT_ONLY=false`); `connect-src`/`media-src` include `https://*.r2.cloudflarestorage.com`; `font-src 'self'` with self-hosted fonts (cached `immutable`). No `csp violation` lines during the production smoke test.

## Open questions
- Whether RLS overhead is acceptable with PgBouncer transaction pooling (`SET LOCAL` works per transaction — verify with load test).
- Bug bounty program timing (after launch).

## Sources
Cross-linked: `01-system-architecture.md` (trust boundaries), `03-data-model-and-storage.md`, `04-api-contract.md`, `15-privacy-dmca-and-data-lifecycle.md`, `24-browser-compatibility.md`, `legal/youtube-copyright-and-platform-policy.md` (data handling). Tool versions: `00-tech-stack.md`.
