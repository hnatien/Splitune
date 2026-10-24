# Step 10 — Web app shell, auth UI, import flows and library

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/specs/10-web-app-architecture.md` (primary: routes, render modes, state, layout, PWA groundwork, security headers)
- `docs/specs/13-import-onboarding-and-youtube-embed.md` §2–§5, §6a, §7 (onboarding itself is step 13)
- `docs/specs/24-browser-compatibility.md` §3 (capability probe and fallbacks)
- `docs/specs/12-practice-screen-and-notation.md` §1 (layouts — only to reserve the route; the screen is step 12)
- `docs/specs/27-screens-flows-and-content.md` §1 (shells, navigation), §3.1–§3.6, §3.9 (layout only), §3.11, §4, §5 (screens, states, copy for everything this step builds)
- `docs/specs/26-design-system.md` §2, §7, §12 and `specs/28-ui-quality-and-design-review.md` §5 (appearance model, layout, kit, QA checklist)

Prerequisites: Steps 04, 10a, (09). Can start in parallel with step 09 using `ML_MODE=mock`.

## Goal
`apps/web`: a TanStack Start app that serves the marketing/legal pages, sign-in, library and import flows (file, record yourself, URL), shows progressive analysis status via SSE, and mounts the Hono API under `/v1` in the same Node server (one Railway service `app`).

## Deliverables
1. **App setup:** TanStack Start 1.x (Nitro `node` preset), React 19.3 + React Compiler, the design system from step 10a (tokens, fonts, `app/ui` kit, Storybook) — compose screens from it and add new shared patterns to `app/ui` with stories first, Paraglide JS 2 (English only for now), TanStack Query over the oRPC client, Zustand for UI state. Mount `createApi()` from `apps/api` under `/v1` in the server entry.
2. **Routes** per doc 10 §1 with render modes (`ssr: true` marketing/legal, `data-only` library/settings, `ssr: false` practice/edit placeholders).
3. **Auth UI** per doc 27 §3.4: one form for sign-in and sign-up, "Check your email" screen (resend after 30 s, use a different email, Mailpit link in dev only), magic-link landing with expired/used/invalid states, Google button when configured, sign-out, session-aware layout. **Marketing pages** per doc 27 §3.1–§3.2: Home (copy from §3.1, "Try an example song" → `/start`), How it works, Legal; Pricing is a stub until step 14.
4. **Capability probe** (doc 10 §5 / doc 24 §3) run once and cached; in-app-browser banner; unsupported-browser page for missing AudioWorklet/WASM SIMD.
5. **Import page** per doc 27 §3.6 (tabs File · Link · Record, "Your part" select, Full/Lite radio cards, pre-flight result chips, duplicate notice, whole-page drop target): file picker + drag-and-drop with SHA-256 of bytes in a Worker → duplicate check; local decode for an instant waveform preview (Mediabunny/WebCodecs, fallback `decodeAudioData`; video files without decoder support show "preview after upload"); resumable multipart upload with Uppy 6 (S3 plugin signing parts through the API, resume token in IndexedDB); record-yourself with MediaRecorder (first supported MIME); URL import form; part/instrument choice; Full vs Lite choice (show both; allowances arrive in step 14).
6. **Library** per doc 27 §3.5 — `GET /v1/songs` from step 04 only pages (`PageInput`); extend the contract with `q`, `instrument`, `status`, `sort` (last practised · added · title) and a list item carrying what the card shows (best clean tempo + its clip bars, `recommended_view` for "Chords only", analysis progress n/m, stems available), regenerate contracts, add repository queries and an authz test: `SongCard` grid/list, search, filter chips (instrument, status), sort, statuses (Ready · Partial · Analysing n/m · Queued · Chords only · Stems expired · Failed), last practised and best clean tempo, overflow menu (rename, analyse again, delete with the `delete.song_confirm` AlertDialog), `AllowanceMeter` slot (data in step 14), `WorkerStatus` banner, empty/loading/error/offline states.
7. **Analysis progress:** SSE hook updating the Query cache; `StageList` with honest ETA from recent median stage times (`GET /v1/system/stats` — add a tiny endpoint) shown compact on the library card and full on a provisional `/songs/$songId/practice` page (step 12 replaces it with the progressive practice screen; after import, "Start practising" lands there). Map every code from step 09's list to its catalogue message (doc 27 §5.6; unknown → `analysis.failed`).
8. **Shells and states:** marketing / app / focus / bare shells per doc 27 §1; every screen's empty, loading, partial, error and offline states (doc 27 §4) storied and implemented; system pages and banners from doc 27 §3.11 (404, error boundary with copyable error id, offline, worker offline, unsupported browser, in-app browser); copy from the message catalogue (doc 27 §5.6) via Paraglide, plus the **copy-key test** from doc 28 §3 (no hard-coded user-facing strings, every catalogue key present).
9. **Display preferences and Settings shell:** a per-device display store (Zustand + `localStorage`: appearance, score surface, distance preset + calibration, Hyperlegible font, reduced motion override, increased contrast) driving the `data-*` attributes from step 10a; account menu with the Appearance switch; `/settings` shell per doc 27 §3.9 with **Profile** and **Display & practice** sections implemented (per-field save with inline "Saved"); Keyboard & pedal, Plan & billing and Privacy sections are placeholders filled by steps 12, 14 and 15.
10. **Security headers** per doc 17 §5 (no COOP/COEP), CSP allowing YouTube frames for the embed fallback and the S3 endpoint in `connect-src` and `media-src`, taken from config: the local SeaweedFS origin in dev, `https://*.r2.cloudflarestorage.com` in production (storage is Cloudflare R2 since 2026-10-21, `specs/25-personal-mode.md` §1, §6).
11. **Bucket CORS for browser uploads:** Uppy's presigned part PUTs are cross-origin and the client must read each part's `ETag`, so the bucket must allow the app origin and expose `ETag`. Production rules already exist in `infra/r2/cors.json` (GET/HEAD/PUT, request headers `content-type` and `range`, exposes `ETag`, `Content-Length`, `Content-Range`, `Accept-Ranges`; the `<app>` origin placeholder is filled and applied in step 17 — don't apply it here). Local SeaweedFS has no CORS yet: add the same rules for the local app origin to the compose setup (`infra/seaweedfs`, e.g. a `put-bucket-cors` call in the `seaweedfs-init` job; check that SeaweedFS 4.48 honours it). If Uppy sends request headers beyond `content-type`/`range`, add them to both files.

## Hand-off to step 17
The owner chose (2026-10-21) to deploy to Railway as soon as this step's combined server builds, so step 17 runs right after this one. Make `pnpm build` produce a server Railway can start with one command on `PORT`, and record the build and start commands in `docs/progress-log.md`. Creating Railway resources, the R2 `app` token and the production CORS rules is step 17's job, not this one's.

## Out of scope
Practice screen and audio engine (steps 11–12; local playback on import arrives with them), onboarding/example songs (13), billing UI (14), privacy settings (15).

## Acceptance criteria
- Playwright (Chromium, Firefox, WebKit; desktop + mobile viewports) with `ML_MODE=mock`: sign in via Mailpit link → upload a short audio file → see stages progress → song appears as ready in the library; URL import form submits and shows progress; delete works.
- Upload survives a page reload mid-transfer (resumes, doesn't restart).
- Browser multipart upload works against local SeaweedFS with its CORS rules (preflight passes, part `ETag`s readable); no CORS errors in the console.
- Lighthouse on `/` (mobile): LCP ≤2.5 s locally; practice route JS budget check wired in CI (budget enforced from step 12).
- axe: no serious/critical violations on landing, library, import.
- Design QA checklist (doc 28 §5) passed for landing, sign-in, library and import in Light and Dark on phone, tablet and desktop; results listed in `docs/progress-log.md`.

## Verification to run and report
`pnpm --filter web test`, `pnpm --filter web e2e`, Lighthouse CI result, axe summary, `pnpm build` (production build of the combined server).
