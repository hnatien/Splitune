---
title: Tech stack (decisions and versions)
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# Tech stack

The chosen stack for Splitune, with versions verified on **2026-10-20** against npm, PyPI, GitHub releases, official docs and pricing pages, and MDN browser-compat-data 8.1.6. "Cutting-edge" here means the newest **stable** line of each tool; release candidates are named only as upgrade paths. Pin exact versions in lockfiles and re-verify anything older than ~6 months before relying on it.

> **Personal mode is current (`25-personal-mode.md`).** Hosted and paid rows below are the dormant commercial target. Current substitutes: Cloudflare + Railway API → **one Railway service `app`** (web + API); Railway Postgres stays (single instance); R2 stays (one bucket within the free tier instead of per-environment buckets; local dev uses SeaweedFS; MinIO Community images were withdrawn in 2026); Inngest → Postgres job queue; Modal → native Python worker on the owner's Mac (PyTorch MPS, ONNX CoreML) connecting to Railway over the TCP proxy; vendors → `python-audio-separator` 0.44.x with Demucs/RoFormer checkpoints; Stripe/Paddle → `MockBillingProvider`; Sentry/PostHog/Axiom/Resend → logs, `analytics_events` table, optional `grafana/otel-lgtm`, Mailpit; Capacitor store builds → PWA (+ free sideload). New tools: `yt-dlp` with Deno + `yt-dlp-ejs` (URL import); Caddy + `mkcert` or Tailscale only for local-network testing (production HTTPS comes from the Railway domain). Library choices (TanStack Start, React, alphaTab, Signalsmith, Hono/oRPC, Drizzle, Better Auth, PyTorch, Beat This!, Basic Pitch…) are unchanged.

## TL;DR
| Layer | Choice | Why in one line |
|---|---|---|
| Web app | **TanStack Start 1.x** (Vite 8, React 19.3 + React Compiler 1.0) on Cloudflare Workers | Per-route SSR control: SEO pages SSR, practice route client-only; Vite handles WASM/worklets cleanly |
| UI | **Tailwind CSS v4 + shadcn/ui CLI v4 on Base UI**; XState v5, Zustand 5, TanStack Query 5, TanStack Form, Paraglide JS 2 | Current defaults of each ecosystem; state machine fits the player |
| Audio | **Custom AudioWorklet + Signalsmith Stretch C++ → WASM** (Emscripten, SIMD, no threads); Mediabunny + WebCodecs decode | The npm Signalsmith node can't stretch a live mixed bus; one C++ core also serves native apps |
| Notation | **alphaTab 1.8** (`@coderline/alphatab`, MPL-2.0) in `PlayerMode.EnabledExternalMedia` | Tab + notation + drums, worker rendering, external clock sync |
| API | **TypeScript: Hono 4 + oRPC 1 + Zod 4** on Node 24 LTS, hosted on **Railway** | Typed end to end; OpenAPI for native clients; long SSE streams |
| DB | **PostgreSQL 18 on Railway** (HA, PITR, PgBouncer) + **Drizzle ORM 0.45** + drizzle-kit migrations | Same private network as the API; Drizzle v1 when GA |
| Auth | **Better Auth 1.7** (magic link, Google, Apple; passkeys later) | Self-hosted, user tables in our DB → simple cascade deletion |
| Storage | **Cloudflare R2** (lifecycle rules, zero egress, presigned multipart via Uppy 6) | Raw-upload expiry backstop; cheap stem delivery |
| Orchestration | **Inngest** (TS SDK 4) → Modal functions via `waitForEvent`; Hatchet as fallback | Durable steps, fan-out, retries without running our own queue |
| ML runtime | **Python 3.12, uv 0.13, PyTorch 2.14.1 (CUDA 13.0), ONNX Runtime 1.31, FFmpeg 8.1** on **Modal** (L4 default) | Per-second serverless GPU; three image "islands" for dependency conflicts |
| Separation (v1) | **Vendor API behind an adapter:** AudioShake (webhooks, guitar/piano stems) vs Music.AI (polling), chosen by Prototype 1; LALAL.AI third | D2; vendor terms decide retention/caching |
| Realtime | **SSE** from the API (Postgres `job_events` + LISTEN/NOTIFY) | Fits Railway limits; no extra vendor |
| Payments | **Merchant of record:** Stripe Billing + Managed Payments if eligible, else Paddle; RevenueCat when native IAP arrives | Global VAT handled for a small team |
| Observability | **Sentry, PostHog (analytics, flags, experiments), OpenTelemetry → Axiom**; Resend + React Email | Free tiers cover beta; PostHog runs fake-door pricing |
| Tooling | **pnpm 12 + Turborepo 2** monorepo, **uv** workspace for Python, **Biome 2.5**, TypeScript 7 (+TS 6 side-by-side for tools), Vitest 5, Playwright 1.64, Storybook 10, GitHub Actions, OpenTofu 1.13 | Fast, current, minimal config |
| Native (v1) | **Capacitor 8** wrapping the same web app + native plugins (mic capture, CoreMIDI, audio session, IAP) | ~100% reuse of Web Audio + WASM + alphaTab |

## 1. Web client
| Package | Version (date) | Notes |
|---|---|---|
| `@tanstack/react-start` | 1.169.x (1.0 stable 2026-10-13) | Selective SSR per route (`ssr: true \| 'data-only' \| false`). **Risk:** 1.0 is one week old (RC since Sep 2025). **Fallback:** React Router 8.5 framework mode (routes port 1:1) |
| `vite` | 8.3.x | |
| `react`, `react-dom` | 19.3.1 | React Compiler (`babel-plugin-react-compiler` 1.0.0, stable). Keep audio hot paths outside React |
| `typescript` | 7.0.2 (2026-07-08) for `tsc`; `@typescript/typescript6` beside it | TS 7 ships no programmatic API yet (expected in 7.1); tools needing it use TS 6 |
| `tailwindcss` | 4.3.x | Documents support for Safari 16.4+, Chrome 111+, Firefox 128+. Installed 4.3.3 + `@tailwindcss/vite` 4.3.3 and `tw-animate-css` 1.4.0 (step 10a) |
| `shadcn` (CLI) / `@base-ui/react` | 4.22.x / 1.9.x | Base UI is shadcn's default since Jul 2026. Installed `shadcn` 4.22.1 (dev; its `tailwind.css` supplies the `data-*` variants) and `@base-ui/react` 1.9.0; `class-variance-authority` 0.7.1, `clsx` 2.1.1, `tailwind-merge` 3.7.0 (step 10a) |
| `xstate` / `@xstate/react` | 5.33.x / 6.1.x | Player state machine |
| `zustand` | 5.0.x | UI state |
| `@tanstack/react-query` | 5.104.x | Server state over oRPC client |
| `@tanstack/react-form` | 1.33.x | Forms |
| `lucide-react` | 1.60.x (ISC) | Icons; v1 (Jun 2026) dropped brand icons; tree-shaken named imports (`26-design-system.md` §11). Installed 1.60.0 (1.61.0 was inside pnpm's minimum-release-age window) (step 10a) |
| Inter / Atkinson Hyperlegible Next / Bravura | Inter 4.1 Variable, AHN 2.001, Bravura (all SIL OFL) | Self-hosted WOFF2 subsets made with `pyftsubset --layout-features='*'` (Fontsource subsets strip `ss*`/`cv*`) (`26` §6). Step 10a: `scripts/fonts/subset.sh` (fonttools 4.67.0 via `uvx`, pinned SHA-256 inputs: Inter 4.1 release zip, AHN from google/fonts@95f4904) → `apps/web/public/fonts/`: InterVariable 76.4 KB (wght 400–700, preloaded), Italic 83.0 KB, AHN 33.7 KB |
| `storybook` + `@storybook/addon-a11y` + `@storybook/addon-vitest` | 10.6.x | Component workbench, axe (`test: 'error'`), stories as Vitest browser tests (`28-ui-quality-and-design-review.md` §2). Installed 10.6.3 with `@storybook/react-vite` 10.6.3, `@vitest/browser-playwright` 5.0.5, `playwright` 1.64.1, `vite` 8.3.4, `@vitejs/plugin-react` 6.1.2 (step 10a) |
| `colorjs.io` | 0.7.x (dev) | Token contrast/gamut/CVD tests in `ui-tokens`; live ratios on the Storybook Foundations page. Installed 0.7.1 (step 10a) |
| `@inlang/paraglide-js` | 2.29.x | i18n (avoid the unscoped `paraglide-js` placeholder package) |
| `@coderline/alphatab` | 1.8.4 (2026-07-05) | External-media sync since 1.6; worker rendering on all platforms since 1.8.2; 1.9 in alpha |
| `mediabunny` | 1.61.x (MPL-2.0) | Demux/decode via WebCodecs; `decodeAudioData` fallback |
| `signalsmith-stretch` (C++ repo, MIT) | pinned git tag | Built by us to WASM; the npm web build 1.3.2 is used only for reference/tests |
| `onnxruntime-web` | 1.30.0 | v1 mic models; single-threaded WASM SIMD or WebGPU |
| `wavesurfer.js` | 8.0.x | Timeline waveform (or custom canvas) |
| `@serwist/vite` (Serwist) | 9.5.x | PWA service worker |
| `@uppy/core` + AWS S3 plugin | 6.3.x | Resumable multipart to R2 |

Rejected: **Next.js 16** (Turbopack + worklet/WASM URL handling unverified, RSC adds little to a client-heavy app, Capacitor needs static export); **plain Vite SPA** (needs a separate SEO site); **ffmpeg.wasm** (no release since 2025-01); **cross-origin isolation** (breaks the YouTube embed on Safari/Firefox).

## 2. Backend
| Component | Version / price (2026-10-20) | Notes |
|---|---|---|
| Node.js | 24 LTS | Move to 26 LTS after it enters LTS |
| `hono` | 4.13.x (5.0 RC on `next`) | Stay on 4.x until 5 is GA. Installed 4.13.13 + `@hono/node-server` 2.1.5 (step 04) |
| `@orpc/contract` / `@orpc/server` / `@orpc/openapi` | 1.15.x (2.0 beta) | Typed RPC + OpenAPI 3.1 generation; `@orpc/contract` (router without handlers) lives in `packages/contracts`. Installed 1.15.7 incl. `@orpc/zod` (`/zod4` converter) and `@orpc/json-schema` (query coercion) (step 04) |
| `zod` | 4.6.x | Native `z.toJSONSchema()` for the contracts pipeline |
| PostgreSQL | 18.6 (EOL 2030-11-14); 19 in RC | Railway Postgres: HA (Patroni), backups, PITR, PgBouncer |
| `drizzle-orm` / `drizzle-kit` | 0.45.x (v1 still RC) | Pin; migrate to v1 at GA. Avoid Prisma's npm `latest` tag confusion (CLI `latest` = 8.0 RC) |
| `better-auth` | 1.7.x (1.8 beta has breaking changes) | Joined Vercel (2026-07); remains OSS. Apple client-secret JWT ≤6 months. Installed 1.7.11 with `nodemailer` 10.1.7 (SMTP) and `pino` 10.4.0 (logs) (step 04) |
| Cloudflare R2 | $0.015/GB-mo; Class A $4.50/M; Class B $0.36/M; egress free | Lifecycle expiration by prefix; abort incomplete multipart; presigned URLs ≤7 days; **presigned `UploadPart` to be tested early** |
| `inngest` (TS) | 4.25.x | Free 50k executions/mo; Pro $99 for 1M. ~15 executions per analysis |
| Railway | Pro $20 incl. usage; $20/vCPU-mo, $10/GB-mo, egress $0.05/GB | HTTP streams ≤15 min with data, closed after 5 min idle; uploads must finish in 5 min (so never proxy uploads); **no GPUs**; Buckets lack lifecycle rules (hence R2) |
| Resend / React Email | Free 3k/mo; Pro $20 for 50k | Magic links, receipts, reminders |
| Sentry | Team $29/mo (50k errors); `@sentry/node` 11.x, `sentry-sdk` 2.7x | |
| PostHog | Generous free tier (verify current limits) | Analytics, flags, experiments, session replay (masked) |
| Axiom | Free 500 GB/mo ingest; $25/mo paid | OTel traces/logs |
| OpenTofu | 1.13.x | Cloudflare (R2, DNS, Workers), Modal/Railway via CLI in CI |

Rejected or deferred: FastAPI as the main API (Python only where models run), NestJS (ceremony), Trigger.dev (no GPU story), Temporal (ops weight), Supabase (lock-in for Auth/Realtime we don't need), Crunchy Bridge (acquired), Fly.io (GPUs deprecated 2026-07-31), Railway Buckets (no lifecycle rules, public network only).

## 3. ML
| Component | Version (date) | Notes |
|---|---|---|
| Python | 3.12 default; CI also 3.13 | 3.14 blocked by WhisperX and coremltools wheels |
| uv / ruff / pyright / pytest | 0.13.3 / 0.17.1 / 1.1.414 / 9.1.1 | `ty` 0.0.89 is beta — optional |
| `pydantic` / `datamodel-code-generator` | 2.14.1 / 0.86.0 | Models generated from `packages/contracts/schema/contracts.json` (`pnpm contracts:gen`) |
| PyTorch | 2.14.1 (2026-09-30), CUDA 13.0 (12.6 for older GPUs) | torchaudio 2.11 only for transforms (I/O removed in 2.9) |
| TorchCodec / soundfile | 0.17.0 / 0.14.0 | In-process decode; FFmpeg CLI for normalisation |
| FFmpeg | 8.1.3 (also 9.0.2 available) | Static binary pinned in images; on the Mac Homebrew `ffmpeg@8` (keg-only, `FFMPEG_BIN_DIR=/opt/homebrew/opt/ffmpeg@8/bin`) because Homebrew `ffmpeg` is 9.0.2; CI uses Ubuntu's apt ffmpeg (audio_hash values differ, no test pins them) |
| ONNX Runtime | 1.31.0 | Basic Pitch `nmp.onnx`, taggers, SwiftF0 |
| `beat_this` | 1.1.0 (2026-04-14), MIT code + weights | No madmom DBN |
| `basic-pitch` | 0.4.0 (2024-08-16), Apache-2.0 | Install **without TensorFlow** (pins `tensorflow<2.15.1`, unsatisfiable on 3.12); use bundled ONNX |
| `transkun` | 2.0.1 | Dormant; vendor and pin (v1 piano) |
| consonance-ACE | git (2026-07), MIT code | Checkpoint in repo; tested on 3.11; amber (training audio provenance) |
| `allin1` | 1.1.0 (2023) | Fragile (NATTEN, madmom); legacy image or replace |
| SwiftF0 | 0.3.0 (2026-09-25), MIT | ~14k params; ORT Web demo exists |
| `faster-whisper` | 1.2.1 | Instead of WhisperX (pins torch 2.8) — lyrics are rights-gated anyway |
| `mir_eval` / `museval` / MSST | 0.8.2 / 0.4.1 / v1.0.22 | Evaluation harness (step 06 uses mir_eval only; uSDR in numpy, museval not installed) |
| ML worker (step 06) | psycopg 3.3.6 + psycopg-pool 3.3.3, boto3 1.43.115, pydantic-settings 2.16.1, pyloudnorm 0.2.0, numpy 2.5.4, beat_this 1.1.0 with torch 2.14.1 + torchaudio 2.11.0 (works for beat_this's MelSpectrogram), PyYAML 6.0.3 | Linux/CI resolves torch/torchaudio from the PyTorch CPU index; macOS from PyPI (MPS) |
| Separation + tagger (step 07) | python-audio-separator 0.44.5 (0.47.1 exists; 0.44.x kept as pinned) + `audio-separator[cpu]` onnxruntime 1.31.0, **librosa 0.11.0** (0.44.5 breaks on librosa 1.0), audioread 3.1.0; PANNs Cnn14 exported to ONNX (opset 17, export-only deps `panns-inference` 0.1.1 + `torchlibrosa` 0.1.0 via `uv run --with`); scipy 1.18.1 | AAC encodes via macOS AudioToolbox `afconvert` (exact gapless decode in Chromium + WebKit), ffmpeg `aac` fallback; Playwright **1.64.0** (`@playwright/test`, Chromium + WebKit) for the browser decode check in `services/ml` |
| Notes + chords (step 08) | **Basic Pitch 0.4.0 not installed**: its inference and note decoding are ported to numpy/scipy in `stage_notes.basic_pitch` (parity-tested against the package) and `nmp.onnx` is extracted from the PyPI wheel (`scripts/fetch_models.py`) — the package pins TensorFlow on 3.12 and `resampy<0.4.3`. Chords: consonance-ACE @ `d17633a` and BTC-ISMIR19 @ `2682317` model code ported (MIT, no lightning/gin), checkpoints from the pinned commits; **madmom from git** @ `27f032e` (main builds on Python 3.12 + NumPy 2; PyPI 0.16.1 doesn't), models via its submodule. YourMT3+ (P2 candidate) runs the HF space's GPL code @ `5e66c1e` from `ML_MODELS_DIR/yourmt3/src` with `stage-notes[yourmt3]`: **transformers 4.45.1** (the space's pin), lightning 2.6.6, einops 0.8.2, deprecated 3.0.0, mido 1.3.3; wandb stubbed (training-only import) | Node worker: js-yaml 5.5.0 (already in the lockfile) for `services/ml/config/views.yaml`; alphaTab 1.8.4 dev dependency for the alphaTex parse test |
| Modal | SDK 1.6.x; L4 $0.000222/s, A10 $1.10/h, L40S $0.000542/s, H100 $0.001097/s | Base GPU price is preemptible (non-preemptible 3×); CPU memory snapshots 3–10× faster start; GPU snapshots alpha |
| MLflow or Trackio / DVC / Label Studio | 3.17.x / 3.67 / 1.23.x | Tiny-team MLOps |
| CycloneDX | spec 1.7.2, `cyclonedx-bom` 7.5 | ML-BOM from the licence register |

**Vendors (separation):**
| Vendor | Stems | Price | Integration |
|---|---|---|---|
| AudioShake | vocals, drums, bass, guitar (electric/acoustic), piano, keys, strings, wind, other, other-x-guitar | 1 credit per minute per target (credit price not public) | Webhooks; assets expire 72 h, output links 1 h; says models are trained on licensed data; on-device SDK exists |
| Music.AI | vocals, drums, bass, piano, keys, guitars (incl. rhythm/solo), strings, wind | $0.07/min per stem, guitar $0.10, drum parts $0.15 | Polling; `DELETE /job/:id`; Enterprise SLAs only |
| LALAL.AI | vocals, drums, piano, bass, guitar (electric/acoustic), synth, strings, wind | No API price list; top-ups $50/750 min | Polling; `/delete/` |
Contract must cover: per-user retention allowed, no training on uploads, deletion on request, region, volume price, billing unit (QL5, QM8).

## 4. Native (v1)
| Option | Version | Verdict |
|---|---|---|
| **Capacitor** | 8.5.x (Capacitor 9 expected late Nov 2026) | **Chosen.** Same SPA in WKWebView/Chrome WebView; native plugins for mic capture + SwiftF0, CoreMIDI, audio session, IAP (RevenueCat); shared C++ DSP can become a native library |
| Expo / React Native | SDK 58 (RN 0.88, New Architecture only) | UI rewrite; alphaTab only via DOM components; react-native-audio-api pre-1.0 |
| Tauri 2 mobile | 2.12 | Mobile maturity unverified |
Details: `22-native-apps.md`.

## 5. Upgrade watchlist
| Item | Trigger to act |
|---|---|
| Drizzle v1 GA | Migrate when GA + Better Auth adapter supports it |
| Hono 5 GA, oRPC 2 GA | Upgrade in a dedicated PR with contract tests |
| TypeScript 7.1 (API) | Drop TS 6 side-by-side once Biome/tooling no longer need it |
| alphaTab 1.9 | Evaluate when stable (rendering/sync fixes) |
| Capacitor 9 | Before native build starts |
| PyTorch 2.15 | Raises min Python to 3.11 — no impact |
| Signalsmith Stretch C++ releases | Re-run P7 listening + CPU tests before bumping |

## Implementation notes (step 09, 2026-10-21)
- URL import pins: `yt-dlp==2026.8.19` (latest stable on PyPI, 2026-08-19) and `yt-dlp-ejs==0.8.0`, in `stage-url-import` (onnx-cpu island); Deno from Homebrew on the Mac.
- `erasableSyntaxOnly: true` in `tsconfig.base.json` (Node runs the TS sources by type stripping).

## Implementation notes (step 10, 2026-10-22)
- Web app installed: `@tanstack/react-start` 1.169.3 + `@tanstack/react-router` 1.170.45 (+ `router-cli` 1.167.45 to generate the route tree outside Vite, `react-router-ssr-query` 1.167.3), `nitro` 3.0.260903-beta (node preset, `compressPublicAssets`), `@tanstack/react-query` 5.104.5, `@orpc/client` / `openapi-client` / `tanstack-query` / `contract` 1.15.7 (same line as the API), `better-auth` 1.7.11 (client), `zustand` 5.0.15, `@inlang/paraglide-js` 2.29.1 with `@inlang/plugin-message-format` (local module path, no CDN at compile time), `mediabunny` 1.62.0, `hash-wasm` 4.12.0 (streaming SHA-256 of up to 500 MB in a Worker; WebCrypto needs the whole file in memory), `@uppy/core` 6.3.0, React Compiler via `babel-plugin-react-compiler` 1.0.0 + `@rolldown/plugin-babel` 0.2.4 + `@babel/core` 8.0.7 (`reactCompilerPreset` of `@vitejs/plugin-react`), `@playwright/test` 1.64.1, `@axe-core/playwright` 4.14.0, `@lhci/cli` 0.15.1, `zod` 4.6.7 (route search params).
- **Uppy's AWS S3 plugin is not used.** Uppy 6's `@uppy/aws-s3` has the browser sign and send CreateMultipartUpload / CompleteMultipartUpload itself (`signRequest`), which would move the API's server-side part check (signed Content-Length per part, part list validated on complete) out of the API. The web app uses `@uppy/core` with its own uploader plugin (`apps/web/app/features/import/splitune-uploader.ts`) that PUTs the API's presigned parts and records each part's ETag in IndexedDB. `@uppy/golden-retriever` is not used either: the resume record (ids + acknowledged parts + the File when the browser can store it) is a small IndexedDB store of our own.

## Implementation notes (step 13, 2026-10-22)
- Serwist installed: `@serwist/vite` 9.5.13 + `serwist` 9.5.13 (dev dependencies of `apps/web`; the plugin bundles `app/sw.ts` into Nitro's `.output/public/sw.js` with the precache list). `app/sw.ts` has its own `tsconfig.sw.json` (WebWorker lib; Serwist's types don't satisfy `exactOptionalPropertyTypes`).
- Lighthouse is 12.6.1, which has **no PWA category** any more; installability is checked with Chromium's own `Page.getInstallabilityErrors` in `apps/web/e2e/pwa.spec.ts`.

## Implementation notes (step 17, 2026-10-23)
- **Railway config as code:** `railway.json`/`railway.toml` are deprecated for new services (read until 2026-12-01), so the project is described with Railway's TypeScript IaC in `infra/railway/railway.ts` (root devDependency `railway` 3.16.0, the SDK the CLI needs to evaluate it; Railway CLI 5.70.0). `railway config plan --file infra/railway/railway.ts` / `apply`.
- **`app` image:** `infra/railway/Dockerfile` (Node 24.22.1 bookworm-slim, pinned by digest; `dsp.wasm` from the pinned `emscripten/emsdk:6.0.10` stage, checked against `dsp.wasm.sha256`). Railway Postgres image `ghcr.io/railwayapp-templates/postgres-ssl:18` (18.6), matching local 18.6 and `pg_dump` 18.6 on the Mac.

## Open questions
- Stripe Managed Payments eligibility (depends on company jurisdiction).
- R2 presigned `UploadPart` behaviour (test in week 1).
- Beat This! CPU latency for the ≤10 s target (decides warm GPU vs CPU).
- Vendor choice and pricing (P1, quotes).


## Implementation notes (step 11, 2026-10-22)
- Audio: Emscripten **6.0.10** (`emscripten/emsdk` image pinned by digest in `packages/audio-dsp/emsdk-version`), Signalsmith Stretch **1.4.0** (C++, MIT; 2026-09-25) with Signalsmith Linear **0.6.4**, CMake ≥ 3.24 for native builds. `@splitune/audio-engine` uses `mediabunny` 1.62.0 (same as the web app), `vite` 8.3.4 (demo + test harness) and `@playwright/test` 1.64.1. The npm `signalsmith-stretch` web build is not used.

## Implementation notes (step 12, 2026-10-22)
- Practice: `xstate` **5.33.3** + `@xstate/react` **6.1.0** (player machine), `@coderline/alphatab` **1.8.4** with `@coderline/alphatab-vite` **1.8.4** (`assetOutputDir: false`, `audioWorklets: false`: alphaTab's own synth is never used; worker rendering only). Bravura comes from the alphaTab package (`font/Bravura.woff2?url`).

## Sources
All accessed 2026-10-20.
- npm registry and PyPI JSON metadata for every package version listed (`https://www.npmjs.com/package/<name>`, `https://pypi.org/project/<name>/`).
- [TanStack Start 1.0](https://tanstack.com/blog/tanstack-start-1-0); [React Router v8](https://remix.run/blog/react-router-v8); [TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/); [shadcn changelog](https://ui.shadcn.com/docs/changelog); [Tailwind compatibility](https://tailwindcss.com/docs/compatibility); [alphaTab releases](https://github.com/CoderLine/alphaTab/releases) and [audio/video sync guide](https://alphatab.net/docs/guides/audio-video-sync); [Signalsmith Stretch](https://github.com/Signalsmith-Audio/signalsmith-stretch); [Mediabunny](https://mediabunny.dev/guide/introduction); [ONNX Runtime releases](https://github.com/microsoft/onnxruntime/releases); [Serwist](https://serwist.pages.dev/); [Capacitor blog](https://ionic.io/blog/tag/capacitor); [Expo SDK 58](https://expo.dev/changelog/sdk-58); [Vitest 5](https://vitest.dev/blog/vitest-5); [Biome blog](https://biomejs.dev/blog/).
- [PostgreSQL versioning](https://www.postgresql.org/support/versioning/); [Railway Postgres](https://docs.railway.com/databases/postgresql), [Railway limits](https://docs.railway.com/networking/public-networking/specs-and-limits), [Railway pricing](https://docs.railway.com/pricing/plans), [Railway buckets](https://docs.railway.com/storage-buckets); [Drizzle releases](https://github.com/drizzle-team/drizzle-orm/releases); [Better Auth releases](https://github.com/better-auth/better-auth/releases); [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/), [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/); [Inngest pricing](https://www.inngest.com/pricing); [Hatchet pricing](https://hatchet.run/pricing); [Modal pricing](https://modal.com/pricing), [memory snapshots](https://modal.com/docs/guide/memory-snapshot); [Fly.io GPU deprecation](https://community.fly.io/t/gpu-migration-fly-io-gpus-will-be-deprecated-as-of-july-31-2026/27110); [Stripe Managed Payments](https://docs.stripe.com/payments/managed-payments); [Paddle pricing](https://www.paddle.com/pricing); [Sentry pricing](https://sentry.io/pricing/); [Axiom pricing](https://axiom.co/pricing); [Resend pricing](https://resend.com/pricing); [OpenTofu releases](https://github.com/opentofu/opentofu/releases).
- [PyTorch release matrix](https://github.com/pytorch/pytorch/blob/main/RELEASE.md); [torchaudio README](https://github.com/pytorch/audio); [TorchCodec](https://pypi.org/project/torchcodec/); [FFmpeg download](https://ffmpeg.org/download.html); [beat_this releases](https://github.com/CPJKU/beat_this/releases); [basic-pitch](https://github.com/spotify/basic-pitch); [all-in-one issues](https://github.com/mir-aidj/all-in-one/issues); [swift-f0](https://github.com/lars76/swift-f0); [whisperX pyproject](https://github.com/m-bain/whisperX/blob/main/pyproject.toml); [AudioShake models](https://developer.audioshake.ai/models.md), [billing](https://developer.audioshake.ai/billing.md); [Music.AI pricing](https://music.ai/pricing/), [API reference](https://music.ai/docs/api/reference/); [LALAL.AI OpenAPI](https://www.lalal.ai/api/v1/openapi.json); [CycloneDX](https://cyclonedx.org/).
- MDN browser-compat-data 8.1.6 (2026-10-15) for browser support.
