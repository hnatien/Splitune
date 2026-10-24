---
title: Web app architecture
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# Web app architecture

Structure of `apps/web`: routing and rendering modes, state, data fetching, workers, PWA/offline, design system, i18n and performance. Audio is in `11-audio-engine.md`; the practice screen in `12-practice-screen-and-notation.md`; import/onboarding in `13-import-onboarding-and-youtube-embed.md`.

> **Personal mode is current (`25-personal-mode.md`).** Hosting uses the TanStack Start/Nitro **node** preset as the Railway service `app` (with the Hono API mounted under `/v1`) instead of Cloudflare Workers; everything else in this doc applies. The practice route adds the local-video sync controller for URL imports (`13` §6a).

## TL;DR
- **TanStack Start 1.x on Vite 8 with React 19.3 + React Compiler,** deployed to Cloudflare Workers. Per-route rendering: marketing and song-agnostic pages SSR; library/dashboard `data-only` SSR; **practice route `ssr: false`** (client-only audio app).
- **State split:** server state in TanStack Query (wrapping the oRPC client); player state in an XState v5 actor; ephemeral UI state in Zustand; URL search params (typed) for shareable view state (instrument, view, loop bars, speed).
- **Heavy work off the main thread:** decode Worker, `music-core` Worker, alphaTab Worker, AudioWorklet, (v1) pitch-tracking Worker. Communication via Comlink-style typed messaging.
- **Not cross-origin isolated** (COEP would break the YouTube embed in Safari/Firefox), so no `SharedArrayBuffer`; ONNX Runtime Web runs single-threaded WASM SIMD or WebGPU.
- **PWA with Serwist:** app-shell precache, runtime caching for fonts/WASM; OPFS for offline stems (v1); IndexedDB for metadata, sync queue and pre-signup progress.
- **Design system:** the "Music Stand" system in `26-design-system.md` — shadcn/ui CLI v4 on Base UI primitives + Tailwind v4 tokens (Light/Dark/Stage appearances, paper score surface, one indigo accent), Okabe-Ito stem palette, practice targets 64/48 CSS px, reading sizes by distance preset. Screens and copy: `27-screens-flows-and-content.md`; UI quality workflow: `28-ui-quality-and-design-review.md`.

## 1. Routes
| Route | Render mode | Content |
|---|---|---|
| `/` , `/pricing`, `/how-it-works`, `/legal/*` | SSR + static cache | Marketing, pricing (fake-door in Phase 0), legal pages, DMCA form |
| `/start` | SSR shell, client onboarding | Instrument + level picker, example song entry |
| `/library` | `data-only` SSR | Songs list, usage meter |
| `/import` | client | File picker, record yourself, YouTube link entry |
| `/songs/$songId/practice` | `ssr: false` | Practice screen |
| `/songs/$songId/edit` | `ssr: false` | Desktop-first editor view of the same song |
| `/settings/*` | `data-only` SSR | Profile, input mapping, billing, privacy (export/delete), opt-ins |
| `/auth/*` | SSR | Better Auth flows (magic link landing, OAuth callbacks) |

Typed search params on the practice route: `?view=tab|chords&loop=17-20&speed=70&mix=minus-one` — so a learner can bookmark a practice setup (no sharing of content; URLs only work for the owner).

## 2. Directory layout
```
apps/web/
  app/routes/…            # file-based routes (TanStack Router)
  app/features/
    onboarding/  import/  library/  practice/  editor/  billing/  settings/
  app/lib/
    api.ts                # oRPC client + TanStack Query utils
    auth.ts               # Better Auth client
    analytics.ts          # PostHog wrapper with typed event taxonomy (16-…)
    flags.ts              # PostHog feature flags
    sync/                 # offline queue (IndexedDB) for corrections/attempts
    workers/              # worker entrypoints (decode, music-core, pitch)
  app/ui/                 # shadcn/Base UI components, Splitune kit, icons (26-design-system.md §12)
  .storybook/             # Storybook 10 workbench (28-ui-quality-and-design-review.md §2)
  public/ (fonts, icons)
packages/  (shared, see 02-repo-tooling-and-ci.md)
  contracts  music-core  audio-engine  audio-dsp  notation  ui-tokens
```

## 3. State management
| State | Tool | Persistence |
|---|---|---|
| Server data (songs, analyses, artefact metadata, usage) | TanStack Query v5 + oRPC | Query cache; artefact JSON also cached in IndexedDB keyed by `(artefact_id, version)` |
| SSE progress | custom hook → updates Query cache | — |
| Player (transport, loop, count-in, assessment) | XState v5 actor (`12-practice-screen-and-notation.md` §6) | `songs.player_state` (debounced PATCH) |
| Effective artefacts (model output ⊕ corrections) | derived in the `music-core` Worker; memoised by `(artefact_version, corrections_rev, options)` | — |
| UI ephemeral (drawers, editor selection) | Zustand | — |
| Input mapping, display offset, notation scale | Zustand + localStorage | per device |
| Pre-signup progress | IndexedDB | merged on signup |

## 4. Data flow on the practice route
1. Route loader (client) fetches `GET /v1/songs/{id}` → artefact index + `player_state`.
2. In parallel: request signed URLs for stems (codec variant from capability check), `beats`, `chords`, `tab.*`, `summary`; load from IndexedDB cache if versions match.
3. Decode Worker decodes stems → audio engine `loadStems()`.
4. `music-core` Worker applies corrections and recomputes tab if options differ from the server default.
5. alphaTab Worker renders; engine clock drives cursor.
6. Edits → optimistic local apply → sync queue → `POST corrections`.

## 5. Capability detection (at startup, cached)
- WebCodecs `AudioDecoder` (Safari/iOS 26+, Chrome 94+, Firefox desktop 130+; not Firefox Android) → else `decodeAudioData`.
- Codec support for stems via `MediaCapabilities.decodingInfo` / test decode → choose `opus_webm` or `aac_mp4`.
- `AudioContext.outputLatency` (Safari/iOS 18.4+) → clock strategy.
- WebGPU (Chrome 113+, Chrome Android 121+, Safari/iOS 26+, limited Firefox) → ORT execution provider (v1 mic).
- Screen Wake Lock, Media Session, Web MIDI (absent on Safari/iOS).
- Results sent once as PostHog person properties (no fingerprinting beyond what is needed).

## 6. PWA and offline
- **Serwist 9.x** via its Vite integration: precache app shell, runtime cache WASM/fonts (stale-while-revalidate), network-first for API.
- **Offline (MVP):** app opens; library shows cached songs; practice works for songs whose stems and artefacts are still in memory/IndexedDB cache from this session; edits queue.
- **Offline (v1, V10):** explicit "Make available offline" stores stems in **OPFS** and artefacts in IndexedDB; handle `QuotaExceededError`; request `navigator.storage.persist()` (granted heuristically, e.g., Home Screen install on iOS); purge on server-side deletion at next sync.
- Background Fetch is Chromium-only; use resumable fetch into OPFS instead.

## 7. Design system and accessibility
Specified in full in **`26-design-system.md`** (direction, appearance model, tokens with values, confidence encoding, type and reading sizes, targets, motion, icons, component inventory); built in prompt step 10a. In short:
- Tokens in `packages/ui-tokens` (hand-authored CSS variables in three tiers, mapped to Tailwind v4 with `@theme inline`): Light/Dark/Stage appearances plus increased contrast, Okabe-Ito categorical set for stems/strings/hands, spacing, **practice targets** (primary 64 CSS px, secondary 48 CSS px), reading sizes per distance preset (Desk / Stand / Floor). Contrast, gamut and colour-vision tests run in CI (`28-ui-quality-and-design-review.md` §3).
- Components from shadcn/ui CLI v4 with **Base UI** primitives (default since Jul 2026); Radix only if a component is missing. Splitune kit components live in `app/ui/` with Storybook stories per state.
- Accessibility baked in: 2 px focus outlines, `prefers-reduced-motion`, `prefers-contrast`, forced colours, 200% text resize, aria labels; automated axe checks in Storybook and Playwright (`18-testing-strategy.md`).

## 8. i18n
- English at launch; **Paraglide JS 2** (`@inlang/paraglide-js`, compiled and tree-shaken) so adding locales later is cheap. Avoid the unscoped `paraglide-js` npm name (security placeholder).
- All user-facing strings, including pipeline `reasons` codes, map to message keys; the copy and key names are the catalogue in `27-screens-flows-and-content.md` §5.6.

## 9. Performance budgets
| Metric | Budget (proposal) |
|---|---|
| Landing LCP (4G, mid-range phone) | ≤2.5 s |
| Practice route JS (excl. alphaTab, WASM) | ≤300 KB gzip |
| alphaTab + fonts + `dsp.wasm` | lazy, cached by SW after first load |
| Time from practice route open to playable (cached song) | ≤1.5 s |
| Main-thread long tasks during playback | none >50 ms |

## 10. Security headers (web)
CSP with `frame-src https://www.youtube-nocookie.com https://www.youtube.com`, `worker-src 'self' blob:`, `script-src 'self' 'wasm-unsafe-eval'`, `connect-src` API + R2 + PostHog + Sentry; no COEP/COOP isolation; `Permissions-Policy` allowing `microphone=(self)` only on routes that need it. Details in `17-security.md`.

## Implementation notes (step 10, 2026-10-22)
- **Layout as built:** `apps/web/app/` with `routes/` (pathless layouts `_marketing`, `_app` (signed in), `_focus`, `_bare` = the four shells of 27 §1), `features/*`, `lib/*`, `server/*` (API singleton, security headers, auth options server function), `server.ts` (server entry) and `router.tsx`. Generated and git-ignored: `app/paraglide/` and `app/routeTree.gen.ts` (`pnpm --filter @splitune/web generate`, run by `typecheck`, `test`, `test:stories`, `storybook:build`; Vite regenerates both in dev/build).
- **Render modes:** marketing, legal, auth, `/start`, 404 SSR; `/library` and `/settings/*` `data-only` (the first library page is prefetched on the server and dehydrated); `/import`, `/songs/$songId/practice`, `/songs/$songId/edit`, `/unsupported` `ssr: false`.
- **One server:** `vite build` (Nitro `node` preset) → `apps/web/.output/` (self-contained, ~9 MB; `node .output/server/index.mjs`, `PORT`). Nitro hands the entry srvx requests, which undici can't clone, so `server.ts` rebuilds them before Start and Hono. Static assets ship pre-compressed (br/gzip/zstd).
- **Data:** the oRPC client (`lib/api.ts`) decodes the API's `ErrorEnvelope` into typed `ORPCError`s; `lib/api-fetch.ts` lets the server entry register the in-process route so client modules never import server code (Storybook renders screens with the same modules). The session query (`lib/session.ts`) is a bare fetch of `/v1/me` so the landing page doesn't load the oRPC client or the contract schemas.
- **SSE:** `useAnalysisEvents` (native `EventSource`, resumes with `Last-Event-ID`) refetches the analysis on every stage event and refreshes song + library on `analysis.done`. The library polls instead (cards of songs in progress every 5 s, the list every 10 s) to stay within HTTP/1.1's six connections per origin.
- **Capability probe** (`lib/capabilities.ts`): AudioWorklet, WASM SIMD (wasm-feature-detect's module), WebCodecs audio, MediaRecorder, getUserMedia, Wake Lock, Media Session, Web MIDI, OPFS; cached per page. The practice route redirects to `/unsupported` when a hard requirement is missing; import and the library stay available. Results are not sent anywhere yet (analytics is step 15).
- **Display store** (`lib/display-store.ts`): Zustand persisted under `splitune.display` as the bare preferences object (the inline head script reads it) and `splitune.practice` (speed, count-in bars, rest between repeats). New `score: paper|match` preference writes `data-score`; its CSS (Dark with the Stage score) belongs to step 12, where the score exists.
- **Performance (measured 2026-10-22, Home, Lighthouse mobile):** with applied throttling (DevTools 4G + 4× CPU) LCP 1.5 s = FCP; Lantern's *simulated* LCP is 4.1 s because it counts the module scripts requested before the paint as LCP dependencies (observed LCP 181 ms). `lighthouserc.json` uses `throttlingMethod: devtools`. Entry chunk 103 KB brotli. **Practice route JS today: 258 KB gzip of the 300 KB budget** (`pnpm --filter @splitune/web budget`; reported in CI, `--enforce` from step 12) — the provisional page already carries the oRPC client and the contract schemas, so step 12 has ~40 KB of room unless it trims them.
- PWA/Serwist not set up (step 13).

## Implementation notes (step 12, 2026-10-22)
- Routes `/songs/$songId/practice` (search: `bar`, `loop`) and `/songs/$songId/edit` (desktop editor), `/settings/keyboard`. Feature code in `app/features/practice` (`model/` holds the pure parts: grid, loops, mixer, keymap, player machine, corrections/outbox, practice sync, player-state PATCH, view model).
- Route budget: practice route JS **≤ 300 KB gzip enforced** in CI (`pnpm --filter @splitune/web budget -- --enforce`); 296.8 KB at the end of step 12. Kept under by loading on demand: the alphaTab view (`@splitune/notation/view`), the chord sheet, every popover body, tooltip popups, the speed panel, the audio-engine module, the waveform canvas, glance and video views, editor contents. Anything new on this route needs the same treatment.
- Zod runs jitless (`globalThis.__zod_globalConfig = { jitless: true }` in a head script in `__root.tsx`), because the CSP has no `unsafe-eval` and Zod's JIT probe produced CSP reports in Firefox.
- Offline corrections and practice data: IndexedDB `splitune-practice` (stores `corrections`, `sessions`, `attempts`), UUIDv7 client ids, flushed on `online`/visibility and after each write; effective ops = server ops (by rev) + pending local ops. Undo/redo are new ops (`revert`), never deletions.

## Implementation notes (step 13, 2026-10-22)
- **PWA as built:** `app/sw.ts` (Serwist) — precache: the client build's JS/CSS/SVG/PNG/manifest except workers and files over 600 KB (≈ 192 entries, 1.9 MB; alphaTab's 1.16 MB render chunk is the one left out); runtime: pages network-first (4 s), `GET /v1/*` network-first (6 s; not auth, SSE or events), hashed `/assets/` and `/fonts/` cache-first (WASM, workers, alphaTab, Bravura), example media cache-first keyed **without the signature query** (each build has its own prefix), images stale-while-revalidate. `skipWaiting: false` + `clientsClaim`.
- The page side (`lib/pwa.ts`, loaded after first render) registers `/sw.js` in production builds, raises "A new version is ready" (`SystemBanners`, held while `usePlaybackActive`), asks `navigator.storage.persist()` on `appinstalled` or when standalone, and posts `CACHE_PAGE` for `/start`, `/library` and practice pages reached by client-side navigation (they never pass the SW as navigations); the page the first SW takes over is kept too. Manifest `public/manifest.webmanifest` (colours = `BACKGROUND_HEX.light` from `@splitune/ui-tokens`, tested), PNG icons rendered from step 10a's SVGs by `pnpm --filter @splitune/web icons` (committed), `apple-touch-icon`, `theme-color` per colour scheme. iOS hint: app shell only, when `navigator.standalone === false`.
- **Offline (verified, Playwright):** after one online visit, `/start` and an example song's practice screen reload offline and play in Chromium and WebKit. The Claude desktop app's embedded browser refuses SW registration ("unknown error when fetching the script"), so it never works offline there.
- **Local procedures:** `lib/api.ts`'s link asks a registered `LocalProcedures` first, so a visitor's example song is answered on the device (onboarding's guest link) through the same client and Query keys; `answeredLocally()` lets SSE and the keepalive resume PATCH skip it.
- **Route budget:** 299.2 KB of 300. Onboarding sharing modules with the practice route split them into micro-chunks (+5 KB); recovered by running visitors' example practice **in the practice route** (`?guide=true`, guide lazy), lazy practice banners, the SW registration and claim off the static path, merging tiny state modules, and `"sideEffects": false` on `@splitune/contracts` (pure schemas; the registry only matters to the Node schema build).

## Implementation notes (step 14, 2026-10-22)
- Practice route budget after step 14: **299.7 KB** of 300 KB. What it took (and what to keep doing): billing has its own oRPC client (`clientFor(billingContract)`), contract modules that every screen imports must not share a module with page-specific schemas (`plan.ts` vs `billing.ts`), route `loader`s and non-component route options sit in the entry chunk (pricing's loader imports the billing client dynamically; validators are tiny functions), and a `useQuery` in shell code merges the API client's chunk into the entry — the app shell keeps reading `me` from route context and callers refresh it with `reloadMe()` + `router.invalidate()`.

## Implementation notes (step 15, 2026-10-22)
- **Practice route budget: 320 KB** gzip (was 300, then 302 from 2026-10-22 for step 15's practice events); the owner raised it to 310 KB on 2026-10-24 during step 18b, with the route at 309,162 B of the old 309,248 B, and to 320 KB later that day during step 18c: `dev` was already at 314.5 KB (over 310 KB) before the vocal Melody view, which adds 1.3 KB (315.8 KB). Step 15 measured 300.9 KB. Events go through a static queue (`lib/track.ts`, 0.3 KB); the sender loads with the service worker after the first render (`lib/after-render.ts`), so no new lazy-import site (Vite's preload helper alone costs 0.8 KB). Privacy procedures use their own client (`privacyContract`).
## Implementation notes (step 16, 2026-10-23)
- **Dates on server-rendered pages** (the app shell's allowance meter, the mock portal) are formatted in UTC on the server and during hydration, then in the learner's time zone (`useHydrated()` + `formatDate(…, timeZone)`): the server's zone (UTC on Railway) made React throw hydration error #418 whenever the two disagreed on the day. Client-only and data-only routes format locally as before.
- **Static files** get `nosniff` and the referrer policy from a Nitro route rule (`BASE_HEADERS` in `app/server/headers.ts`); Nitro serves them before the server entry.

## Open questions
- TanStack Start 1.0 is new (stable 2026-10-13); if blocking issues appear, fall back to React Router v8 framework mode (routes and features port 1:1; only the routing/data-loader layer changes).
- Whether practice from a phone browser is acceptable to target users (D9) — measured in Phase 0 interviews.

## Sources
- [TanStack Start 1.0 announcement](https://tanstack.com/blog/tanstack-start-1-0) and [selective SSR guide](https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr) — tier 2, accessed 2026-10-20
- [shadcn/ui changelog (Base UI default)](https://ui.shadcn.com/docs/changelog) — tier 2, accessed 2026-10-20
- [MDN COEP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy), [MDN iframe credentialless](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe), [ORT Web env flags](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html) — tier 2, accessed 2026-10-20
- [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) — tier 2, accessed 2026-10-20
- Browser support facts from MDN browser-compat-data 8.1.6 (2026-10-15).
- Cross-linked: `ux/hands-busy-and-device-context.md`, `ux/accessibility.md`, `product/recommendations-and-decisions.md` D9, D13.
