---
title: Browser compatibility
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# Browser compatibility

Splitune must work in every mainstream browser — Chrome, Edge, Safari (macOS, iPadOS, iOS), Firefox (desktop and Android), Samsung Internet, Opera, Brave — on desktop, tablet and phone. This doc fixes the support policy, the minimum feature baseline, the fallback for every API that isn't universal, and how compatibility is tested. Browser data is from MDN browser-compat-data 8.1.6 (published 2026-10-15) unless noted; **Safari 27 is the current Safari** (shipped 2026-09-14).

> **Personal mode note (`25-personal-mode.md`):** the compatibility policy is unchanged, with two practical differences: real-device testing uses your own devices (no device cloud), and the app must always be served over **HTTPS** because AudioWorklet, `getUserMedia` and service workers require a secure context in every browser — production gets it from the Railway domain; for local-network testing use Caddy + mkcert or Tailscale (plain `http://192.168.x.x` disables the audio engine on iPad/phones).

## TL;DR
- **Feature detection, never UA sniffing.** At startup the app runs a capability probe (`10-web-app-architecture.md` §5) and picks a code path per capability. Only two things are hard requirements: **AudioWorklet** and **WebAssembly with fixed-width SIMD**. Everything else has a fallback.
- **Support floor:** Chrome/Edge/Opera/Brave ≥ 111, Safari/iOS ≥ 16.4, Firefox ≥ 128 (ESR 128 and later), Samsung Internet ≥ 23. Below the floor: a friendly "update your browser" page (library and account still readable).
- **Tier 1 (fully tested every release):** last two majors of Chrome, Edge, Firefox, Safari macOS, Safari iOS/iPadOS, Chrome Android, Samsung Internet. **Tier 2 (smoke-tested, may degrade):** Firefox Android, Opera, Brave, Vivaldi, older versions down to the floor.
- **The design choices that make this possible:** no cross-origin isolation (keeps the YouTube embed working in Safari/Firefox), AAC-LC stems as the universal format (Opus optional), WebCodecs optional (`decodeAudioData` fallback), single-threaded WASM (no `SharedArrayBuffer`), keyboard events for pedals (Web MIDI optional), server decode as the last resort for local playback.
- **In-app browsers** (Instagram, TikTok, Facebook, etc. — where discovery happens) get a detection banner: "Open in your browser for audio and uploads", because their WebViews often restrict file pickers, audio sessions and storage.

## 1. Support policy
| Tier | Browsers | Commitment | Testing |
|---|---|---|---|
| Tier 1 | Chrome (desktop, Android), Edge, Firefox desktop, Safari macOS, Safari iOS/iPadOS (iOS 26, 27), Samsung Internet — last 2 majors | All MVP features; bugs are release blockers | Automated (Playwright Chromium/Firefox/WebKit) + real-device runs every release |
| Tier 2 | Firefox Android, Opera, Brave, Vivaldi, Arc; any supported browser down to the floor (e.g., Safari 16.4–25, iOS 16.4–25) | Core practice works; some enhancements absent (see §3) | Smoke test per release on a device cloud |
| Unsupported | Below the floor; browsers without AudioWorklet or WASM SIMD; IE; in-app WebViews that block audio | Static "update or open in a supported browser" page; account/library pages still render | — |

The floor is reviewed every 6 months against analytics (drop a version when it's <0.5% of practice sessions for 3 months).

## 2. Hard requirements (why the floor is where it is)
| Capability | Chrome/Edge | Safari / iOS | Firefox | Why required |
|---|---|---|---|---|
| AudioWorklet | 66+ | 14.5+ | 76+ | Sample-locked stems, loop, stretch (`11-audio-engine.md`) |
| WebAssembly fixed-width SIMD | 91+ | **16.4+** | 89+ | Signalsmith Stretch real-time CPU budget; ONNX Runtime Web |
| ES2022 modules, top-level await, private fields | 89+ | 15+ | 89+ | Build target |
| `fetch` streaming, `AbortController`, `IndexedDB` | ✓ | ✓ | ✓ | Uploads, caching |
The binding constraint is Safari 16.4 (WASM SIMD); the Chrome 111 / Samsung Internet 23 floors align with the CSS features below.

**CSS baseline:** Tailwind CSS v4 relies on cascade layers, `@property` and `color-mix()`, and documents its browser support as Safari 16.4+, Chrome 111+ and Firefox 128+ ([Tailwind compatibility](https://tailwindcss.com/docs/compatibility)). That matches our JS floor, so Firefox's floor is 128.

**Build targets:** `browserslist`: `chrome >= 111, edge >= 111, safari >= 16.4, ios_saf >= 16.4, firefox >= 128, samsung >= 23, opera >= 97`. Vite `build.target` is derived from the same list.

## 3. Capability fallbacks
| Capability | Support (MDN BCD 8.1.6) | Primary path | Fallback |
|---|---|---|---|
| WebCodecs `AudioDecoder` | Chrome 94+, Safari/iOS 26+, Firefox desktop 130+; **not Firefox Android** | Mediabunny demux + WebCodecs decode of user files (audio and video containers) | `decodeAudioData` for audio files; for video files where neither works, upload first and play the server's fast "preview" decode (AAC) as soon as `decode` finishes (~seconds) |
| Opus decode for stems | Partial/uncertain in Safari; fine in Chromium/Firefox | **AAC-LC in MP4 for everyone by default** | Opus/WebM offered only after a startup decode test passes (length/offset checked) |
| `AudioContext.outputLatency` | Chrome 102+, Safari/iOS 18.4+, Firefox 70+ | Precise clock compensation | `getOutputTimestamp()` + user display-offset slider |
| `setSinkId` (output device pick) | Chromium only | Output picker in settings | Hidden; OS chooses output |
| Screen Wake Lock | Chrome 84+, Safari/iOS 18.4+, Firefox 126+ | Keep screen on during practice | Show "Keep screen on" tip (Auto-Lock setting) on first long session |
| Media Session | Chrome 73+, Safari/iOS 15+, Firefox 82+ | Lock-screen/headset controls | None needed |
| `navigator.audioSession` | Safari 16.4+ (experimental) only | `type = "playback"` so the iOS ringer switch doesn't mute | Tip about the ringer switch on iOS < 16.4 (below floor anyway) |
| WebGPU | Chrome 113+ desktop, Chrome Android 121+, Safari/iOS 26+, Firefox limited | ORT Web WebGPU EP for v1 mic models | ORT single-threaded WASM SIMD (SwiftF0 is tiny) |
| WASM threads / `SharedArrayBuffer` | Needs cross-origin isolation — **not used** | — | Everything is single-threaded WASM + Workers; PCM moves by transfer |
| Web MIDI | Chrome/Edge, Firefox desktop 108+; **not Safari/iOS** | Piano wait mode (V5) | Hidden on Safari/iOS web; available in the native iPad app |
| OPFS (`getDirectory`; sync handles in workers) | Chrome, Safari 15.2+, Firefox | Offline stems (V10) | IndexedDB blobs |
| Background Fetch | Chromium only (experimental) | — | Resumable fetch into OPFS while the app is open |
| `navigator.vibrate` | Chrome Android, Firefox Android; **not iOS** | Haptic metronome (V9) | Visual metronome only |
| Web Share Target | Chrome Android (installed PWA) | "Share audio to Splitune" | File picker |
| `getUserMedia` + MediaRecorder | All Tier 1 (MediaRecorder MIME differs: WebM/Opus in Chromium/Firefox, MP4/AAC in Safari) | Record yourself (Design E), V7/V8 | Pick the first supported MIME via `MediaRecorder.isTypeSupported` |
| `requestVideoFrameCallback` | Chromium, Safari | — (not needed; we never read video frames) | — |
| Pointer Events, `keydown` | All | Taps, pedals (pedals are keyboards) | — |

## 4. Known browser-specific issues and mitigations
| Browser | Issue | Mitigation |
|---|---|---|
| iOS/iPadOS (all browsers are WebKit) | AudioContext must start from a user gesture; suspended on interruptions (calls, Siri) | "Tap to start" on first play; handle `statechange` → paused UI with resume button |
| iOS 26.2–27 | Crackling playback while a mic stream with echo cancellation is open (WebKit bug 326286) | 48 kHz context, recreate after first `getUserMedia`, echo cancellation off; native capture in the iOS app (`22-native-apps.md`) |
| iOS | Background tabs stop audio | Expected for web; Media Session keeps controls; listed as a native-app trigger |
| Safari (all) | Storage eviction: script-writable storage may be cleared after 7 days without user interaction for non-installed sites; quotas with LRU eviction | Server is the source of truth; offline mode requests `persist()` and recommends "Add to Home Screen"; handle `QuotaExceededError` |
| Safari | Stricter autoplay + no `setSinkId` | Covered above |
| Firefox | `latencyHint` ignored | Clock uses `outputLatency`/`getOutputTimestamp` regardless |
| Firefox Android | No WebCodecs | `decodeAudioData` / server preview path |
| Chrome Android (low-end) | Worklet underruns at 0.5× with heavy presets | Cheaper Signalsmith preset, auto-degrade (`11-audio-engine.md` §6) |
| Samsung Internet | Chromium-based but lags releases; aggressive battery saving | Tier 1 device test; same fallbacks as Chrome |
| Brave | Shields may block analytics/Sentry | App must not depend on analytics scripts loading; wrap calls |
| Private/incognito modes | Reduced storage quotas | Don't require IndexedDB for core playback; degrade caching |
| In-app WebViews (Instagram, TikTok, Facebook, Line, …) | File pickers, mic, storage or audio may be restricted | Detect via known UA tokens **only to show a banner** ("Open in browser"), not to block; landing pages still render |

## 5. YouTube embed across browsers
- The IFrame Player API works in all Tier 1 browsers **because we don't set COEP/COOP**. COEP `credentialless` exists only in Chrome 96+ and Firefox 119+, and `<iframe credentialless>` only in Chromium 110+, so cross-origin isolation would break the embed in Safari.
- Use `youtube-nocookie.com` if counsel prefers; test that the playback-rate list from `getAvailablePlaybackRates()` is honoured per browser (rates are not guaranteed).
- On iOS, inline playback needs `playsinline=1`.

## 6. Testing matrix
| Layer | Tooling | Browsers |
|---|---|---|
| Unit/component | Vitest 5 (browser mode with Playwright providers for DOM/audio-adjacent code) | Chromium, Firefox, WebKit |
| E2E (every PR) | Playwright 1.64 projects: `chromium`, `firefox`, `webkit`, plus mobile emulation (Pixel, iPhone, iPad viewports) | Engines, not branded browsers |
| Audio offline-render tests | `OfflineAudioContext` in all three Playwright engines | Chromium, Firefox, WebKit |
| Real devices (every release candidate) | Device cloud (BrowserStack/Sauce or similar) + an in-house shelf: iPhone (iOS 27 and 26), iPad, mid-range Android (Chrome + Samsung Internet), Windows (Chrome, Edge, Firefox), macOS (Safari, Chrome) | Branded browsers |
| Floor check (monthly) | Device cloud: Safari 16.4 on iOS, Chrome 111, Firefox 128 | Floor versions |
| Manual audio checklist | Loop seam, 0.5× quality, count-in timing, Bluetooth offset, interruptions, pedal keys (AirTurn/PageFlip) | Tier 1 real devices |
Note: Playwright's WebKit is not Safari; release sign-off requires real Safari on macOS and iOS.

**Release gate:** a release cannot ship with a Tier 1 failure in: import → analysis → practice (loop at 70%, count-in, mixer, tab cursor sync), billing checkout, account deletion.

## 7. Telemetry
- Capability probe results stored as PostHog person properties (coarse booleans, no fingerprinting).
- Dashboards: practice sessions by browser/version, audio underruns by browser, decode-path usage (WebCodecs vs fallback vs server preview), in-app-browser banner views → conversions.
- Alerts when a browser's error rate or underrun rate doubles week over week (catches new browser releases breaking us).

## Implementation notes (step 10, 2026-10-22)
- Playwright E2E projects: Chromium, Firefox, WebKit (desktop) + Pixel 7 and iPhone 15. On the owner's Mac (macOS 27.0.1) Playwright's Firefox 1555 build does not start ("Could not find profile folder", also when launched directly), so Firefox E2E runs in CI (Ubuntu) only until that is fixed upstream.
- In-app-browser detection (`lib/capabilities.ts`): FBAN/FBAV/FB_IAB, Instagram, TikTok/musical_ly/Bytedance, Line, Snapchat, Twitter, Pinterest, LinkedInApp — banner only.

## Implementation notes (step 11, 2026-10-22)
- Firefox has no `OfflineAudioContext.suspend()`; the offline-render harness configures the engine before `startRendering()` there (Firefox constructs the processor before rendering), and pauses after the first quantum elsewhere.
- `getOutputTimestamp()` includes the output latency in Chromium but not in WebKit (`11-audio-engine.md` step-11 notes); the clock handles both by feature data, not by engine name.
- Playwright's Firefox still doesn't start on macOS 27: run Firefox suites against a Playwright server in `mcr.microsoft.com/playwright:v1.64.1-noble` (`connectOptions` + `exposeNetwork: '<loopback>'`; `packages/audio-engine/README.md`). The audio suite passed in all three engines that way.
- Decode findings for stems: AAC (FFmpeg and AudioToolbox encodes) decodes to the exact timeline at offset 0 on both paths in all three engines once `iTunSMPB` is applied; Opus via `decodeAudioData` is 24 frames early in Chromium at 48 kHz, exact elsewhere and via WebCodecs.

## Implementation notes (step 16, 2026-10-23)
- **Fallback audit** (`apps/web/e2e/fallbacks.spec.ts`, all 5 projects + tablets nightly): before the app loads, an init script removes `AudioDecoder`, `outputLatency`, `setSinkId`, Wake Lock, Media Session, `audioSession`, Web MIDI and Opus playback at once; the example still loops (decode through `decodeAudioData`, no decode Worker; clock on `getOutputTimestamp`/`currentTime`), the "keep screen on" tip appears and no stem request names Opus. Primary path: the WebCodecs decode Worker runs where `AudioDecoder` exists. Import: an AAC file previews through `decodeAudioData` without WebCodecs, "Preview after upload" when no decoder works; no `MediaRecorder` → the Record tab says so. Missing AudioWorklet or WASM SIMD → `/unsupported` naming it, library still opens.
- **Gaps closed:** the import preview never tried `decodeAudioData` when Mediabunny could read the container but had no decoder (every AAC/MP3 file on Firefox Android showed "Preview after upload"); the display-offset slider (§3 `outputLatency` row) had no UI — Settings → Display & practice → **Sound delay** (±150 ms, NumberField, per device); the Wake Lock tip (§3) wasn't built — shown once per device from the first play when the lock is unavailable or refused.
- **Rows with nothing to fall back from in the MVP:** `setSinkId` (no output picker built), Web MIDI (wait mode is v1), OPFS / Background Fetch (offline is v1), `navigator.vibrate` (v1), Web Share Target (not built), WebGPU (v1 mic models). Opus: the client never asks for it (AAC for everyone; the startup decode test that would enable Opus isn't built), so an Opus failure can't reach playback.
- **Floor run** (`pnpm --filter @splitune/web e2e:floor`, Docker; images removed after use, ~5.4 GB): Chromium 111 and WebKit 16.4 from `mcr.microsoft.com/playwright:v1.31.0-focal`, Firefox 128 from `v1.46.0-jammy`, each with its own playwright-core, against the E2E server (ports forwarded so the page stays on `http://localhost`). All three: tokens resolve in Light/Dark/Stage, AudioWorklet + SIMD present, `/unsupported` renders. WebKit 16.4 and Firefox 128 reach a slowed loop of the example (pass 1) with no errors. Playwright's Chromium 111 is an open-source build **without AAC**, so its stems can't decode; the screen reports "We couldn't load the audio" (branded Chrome 111 has AAC — not verified on a real Chrome 111; Chrome for Testing starts at 113). Built CSS is checked by `css-floor` (CI): no `light-dark()`, relative colour syntax, `@scope` or native nesting outside `@supports` conditions.
- **Matrix:** Playwright projects add `tablet-safari` (iPad Pro 11 landscape) and `tablet-chrome` (Galaxy Tab S4 portrait). On touch tablets `/edit` redirects to practice (27 §3.8), so the desktop-editor test asserts that redirect there.
- **WebKit on macOS** tabs between fields only (Safari's default); keyboard tests press Option-Tab there.

## Open questions
- Exact Opus `decodeAudioData` behaviour in Safari 26/27 (unverified) — the startup test makes this safe either way.
- Whether to ship a Safari < 16.4 non-SIMD build (current decision: no).

## Sources
- MDN browser-compat-data 8.1.6 (2026-10-15) for every support row above; [MDN COEP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy); [MDN iframe credentialless](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe) — tier 2, accessed 2026-10-20
- [WebKit storage policy update](https://webkit.org/blog/14403/updates-to-storage-policy/); [WebKit bug 326286](https://bugs.webkit.org/show_bug.cgi?id=326286); [WebKit bug 245428 (WebM)](https://bugs.webkit.org/show_bug.cgi?id=245428) — tier 2, accessed 2026-10-20
- [caniuse Opus data](https://github.com/Fyrd/caniuse/blob/main/features-json/opus.json) — tier 3, accessed 2026-10-20
- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference), [RMF](https://developers.google.com/youtube/terms/required-minimum-functionality) — tier 2 (via `research/legal/youtube-copyright-and-platform-policy.md`)
- Cross-linked: `10-web-app-architecture.md`, `11-audio-engine.md`, `18-testing-strategy.md`, `research/product/recommendations-and-decisions.md` D9.
