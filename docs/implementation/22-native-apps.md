---
title: Native apps (v1, V14)
workstream: engineering
last_researched: 2026-10-20
confidence: low
---

# Native apps (v1, V14)

D9 puts native iOS (then Android) in v1, triggered by mic scoring, offline practice and store discovery. This doc picks the approach and lists the native work. Confidence is **low**: cross-platform frameworks were not part of the original research (QP4), and the comparison below rests on a desk check of current releases.

> **Personal mode is current (`25-personal-mode.md`): no paid developer programs, so no store distribution.** Default = the PWA installed to the Home Screen. Optional: a Capacitor build installed on your own iPhone/iPad with free Xcode provisioning (the app must be re-signed every 7 days) and an Android APK sideloaded — useful mainly for the native mic and CoreMIDI plugins. `Purchases`/RevenueCat and store rules below are dormant; billing stays mocked.

## TL;DR
- **Capacitor 8** (Capacitor 9 expected late Nov 2026 — evaluate before starting) wraps the same TanStack Start SPA in WKWebView / Android WebView: ~100% reuse of the audio engine (AudioWorklet + Signalsmith WASM), alphaTab, music-core and UI.
- **Native plugins only where the WebView is weak:** low-latency mic capture + on-device pitch tracking (SwiftF0 via ONNX Runtime Mobile / Core ML), CoreMIDI/Android MIDI for wait mode, audio session category and interruptions, background audio, in-app purchases (RevenueCat), file import from Files/Share sheet, haptics.
- **Escape hatch for audio:** the C++ DSP core (`packages/audio-dsp`) builds as a static library for AVAudioEngine/Oboe if WebView audio proves insufficient (CPU, background, latency) — the JS engine API stays the same, backed by a native plugin.
- **Store and policy requirements:** YouTube embed in the OS WebView without nested iframes (RMF, III.I.21); Apple 5.2.2/5.2.3 satisfied by Designs A/B/E; Sign in with Apple; IAP for in-app subscriptions.

## 1. Why Capacitor (decision)
| Criterion | Capacitor 8 | Expo SDK 58 / React Native 0.88 | Tauri 2 mobile |
|---|---|---|---|
| Reuse of web audio engine (AudioWorklet + WASM) | Full (same WebView engines as Safari/Chrome) | Partial: react-native-audio-api (pre-1.0, Web-Audio-like; AudioWorklet support unverified) | Full (system WebView) |
| alphaTab | Full | Only via Expo DOM components (WebView, async bridge) | Full |
| UI reuse | Full | Rewrite in RN | Full |
| Native plugin ecosystem | Mature (official + community) | Largest | Smaller; mobile DX lagged desktop per the team |
| Risk | Inherits WebKit audio bugs (e.g., 326286) → mitigated by native plugins | Two UI codebases | Maturity unverified |
Decision: Capacitor. Revisit only if WebView audio fails the device benchmarks below.

## 2. Native plugins (`packages/native-plugins/`)
| Plugin | iOS | Android | Used by |
|---|---|---|---|
| `AudioSession` | AVAudioSession category `.playback` / `.playAndRecord`, interruptions, route changes | AudioFocus, route changes | Engine pause/resume; Bluetooth warning |
| `MicPitch` | AVAudioEngine input tap (low-latency buffer) → SwiftF0 (ONNX Runtime Mobile or Core ML) → pitch frames to JS at 100 Hz | Oboe/AAudio input → same model | V7 scoring + tuner; avoids WebKit mic bugs |
| `Midi` | CoreMIDI | android.media.midi | V5 wait mode (Web MIDI absent on iOS) |
| `NativePlayback` (only if needed) | AVAudioEngine render callback hosting the shared C++ DSP | Oboe callback hosting the same DSP | Fallback if WebView CPU/background audio fails |
| `Purchases` | RevenueCat SDK | RevenueCat SDK | `14-auth-billing-and-entitlements.md` §5 |
| `FileImport` | UIDocumentPicker, Share extension | Storage Access Framework, share intent | M1 |
| `KeepAwake`, `Haptics` | idle timer, Core Haptics | wake lock, vibrator | Practice mode, V9 |

## 3. Platform rules
- **YouTube embed:** load the IFrame API inside the app's WebView page (no nested iframe wrappers), ≥200×200 px, no overlays; never play stems over a muted embed (III.I.7).
- **Apple:** 5.2.2/5.2.3 — no third-party media download; the app only processes user files and recordings. Sign in with Apple offered alongside Google. Subscriptions purchased in-app use IAP; web purchases honoured via RevenueCat entitlements where store rules permit.
- **Android:** Play billing for in-app purchases; foreground service only if background practice audio is enabled.
- **Offline (V10):** stems stored in the app's sandbox (Capacitor Filesystem) with the same expiry/deletion sync rules as web OPFS.

## 4. Build and release
- `apps/native/` Capacitor project consuming the web build (`vite build` static SPA for the app routes; marketing pages excluded).
- CI: Fastlane lanes for TestFlight / Play internal track; app version = web version + build number; OTA web-bundle updates only for non-native changes and within store policy (prefer full releases for anything user-visible at first).
- Device benchmark gate before starting native UI polish: on iPhone 15-class and a mid-range Android, inside the WebView: 2 stems at 0.5× without underruns, cursor jitter ≤1 frame, mic-to-pitch latency <50 ms via `MicPitch`.

## 5. Sequencing
1. iOS first (iPad pianists need MIDI; iOS mic issues are worst in WebKit). Milestones: shell + auth + IAP → AudioSession + FileImport → MicPitch (V7) + Midi (V5) → offline (V10) → store submission.
2. Android once iOS is stable, reusing plugins (Oboe for mic).

## Open questions
- Capacitor 8 vs 9 at start time; minimum iOS/Android versions (unverified for Capacitor 8).
- Whether the WebView engine's AudioWorklet CPU on mid-range Android passes the benchmark (else `NativePlayback`).
- Store fee impact on D10 margins (QK2) and whether web checkout links are permitted in the target storefronts at release time.

## Sources
- [Capacitor blog (Capacitor 8; road to 9)](https://ionic.io/blog/tag/capacitor), [Expo SDK 58](https://expo.dev/changelog/sdk-58), [React Native 0.82 New Architecture](https://reactnative.dev/blog/2025/10/08/react-native-0.82), [react-native-audio-api releases](https://github.com/software-mansion/react-native-audio-api/releases), [Tauri blog](https://v2.tauri.app/blog/) — tier 2, accessed 2026-10-20
- [WebKit bug 326286](https://bugs.webkit.org/show_bug.cgi?id=326286) — tier 2, accessed 2026-10-20
- Cross-linked: `product/recommendations-and-decisions.md` D9, D12; `legal/youtube-copyright-and-platform-policy.md` §2, §5; `ml/playback-time-stretch-pitch-shift.md` (one audio graph per platform); `11-audio-engine.md`.
