---
title: Testing strategy
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# Testing strategy

What is tested, where, and what blocks a merge or a release. Audio timing and ML quality are the two areas where ordinary tests miss real failures, so they get dedicated layers.

> **Personal mode is current (`25-personal-mode.md`).** Real-device testing uses your own devices (no device cloud); ML regression and load tests run locally; billing tests use `MockBillingProvider`; test data may include any audio and public datasets (the owned/CC-BY-only rule is dormant).

## TL;DR
- **Pyramid:** unit (Vitest 5, pytest 9) → contract tests (golden fixtures validated in TS and Python) → integration (API + Postgres + SeaweedFS + Postgres job queue + ML mocks) → E2E (Playwright 1.64 on Chromium/Firefox/WebKit) → real-device and listening checks per release.
- **Audio has offline-render tests** (duration, seams, clock accuracy within 5 ms) and a manual device checklist.
- **ML has a regression suite** from the Phase 0 prototypes with frozen datasets, metrics and tolerances (`08-evaluation-harness-and-prototypes.md` §4).
- **Authorization matrix tests** guarantee no cross-user access on every endpoint.
- **Accessibility** (axe in Storybook + Playwright, keyboard/pedal-only E2E) and **browser compatibility** (`24-browser-compatibility.md`) are release gates.

## 1. Layers
| Layer | Tooling | Scope | Runs |
|---|---|---|---|
| Unit — TS | Vitest 5 (+ fast-check) | music-core, contracts, entitlements, reducers, XState machines, utils | Every PR |
| Unit — Python | pytest 9 | Stage functions with tiny owned fixtures; vendor adapters with recorded responses | Every PR |
| Contract | Vitest + pytest | Golden artefacts from the example song validate against Zod and Pydantic; OpenAPI snapshot diff | Every PR |
| Component | Vitest browser mode + Storybook 10 interaction tests | Practice components (chord strip, mixer, loop UI, editor), confidence styles, reduced motion | Every PR |
| Integration | Vitest against `docker compose` stack | API routes with real Postgres (RLS on), SeaweedFS presign flows, job-queue stage graph with ML mocks, SSE replay, mock-billing webhooks and dev clock | Every PR |
| E2E | Playwright 1.64 (chromium, firefox, webkit; desktop + mobile viewports) | Onboarding → example song → loop at 70%; import → analysis (mocks) → practice; edit + reload persistence; cap reached; checkout (provider test mode); delete song cascade | PR smoke subset; full nightly |
| Audio offline | Playwright + `OfflineAudioContext` in all three engines | Engine render correctness (§2) | Every PR touching audio packages; nightly |
| ML regression | `services/ml/eval` on GPU | Frozen datasets/metrics per stage | Nightly + PRs touching `services/ml` or model refs |
| Performance | Vitest bench, Lighthouse CI, custom practice-route trace | music-core speed, bundle budgets, LCP, long tasks | PR (bench, bundle), nightly (Lighthouse) |
| Load | k6 against staging | 10× expected peak: uploads presign, analysis admission, SSE connections, practice sync | Before G1/G2 and quarterly |
| Security | authz matrix, ZAP baseline, dependency scans | See `17-security.md` | PR + nightly |
| Real devices | Device cloud + device shelf | Tier 1 browsers, audio checklist | Each release candidate |
| Visual regression | Playwright `toHaveScreenshot` in a pinned Docker image (`28-ui-quality-and-design-review.md` §4) | Key screens × Light/Dark/Stage × phone/tablet/desktop | PR (Chromium + WebKit) |
| Usability | Moderated sessions (8–10 per round; personal mode: owner + 3–5 friends, `28-…` §6) | First-session aha, practice flows, legibility at the stand | Phase 0, pre-beta, each major UX change |

## 2. Audio tests
| Test | Method | Pass criterion |
|---|---|---|
| Duration at rate | Render 10 s source at 0.5/0.75/1.0 | Output length = 10/rate s ± 1 quantum |
| Pitch preservation | Render a 440 Hz tone at 0.5× | Detected f0 within ±5 cents |
| Transpose | +2 semitones | f0 ratio 2^(2/12) ± 5 cents |
| Loop seam | Loop a 4-bar region 5×; measure spectral flux and sample discontinuity at seams | No discontinuity above threshold; no clicks (peak detector) |
| Clock accuracy | Click track with known beat times; detect output clicks; compare with engine's reported heard-time | ≤5 ms error offline |
| Count-in | Count-in at 70% speed | First downbeat lands within 1 ms of the scheduled frame |
| Gain changes | Mute/solo during playback | No zipper noise (10 ms ramp verified) |
| Stem alignment | Decode AAC and Opus stems; compare with PCM reference | Length and offset exact after priming trim |
| CPU (device lab) | 2 stems, 0.5×, 10 min | No underruns on Tier 1 devices; CPU within budget (`11-audio-engine.md` §6) |

## 3. ML and music-core tests
- **music-core:** golden tab/alphaTex for the example song; property tests (quantize idempotent, fretted pitch = input pitch, span ≤ max, corrections identity, transpose round-trip); Prototype 3 GuitarSet agreement ≥0.90 as a CI test on a cached subset.
- **Pipeline:** each stage with a 5–10 s owned fixture; contract validation of outputs; determinism check (same input → same artefact hash with fixed seeds where models allow).
- **Regression suite:** onset F1 (guitar/bass), WCSR majmin (chords), beat F-measure, stem quality proxies (SDR on owned multitracks) with tolerances; a failure blocks promotion of a `pipeline_version` to production.
- **Calibration check:** reliability diagram / expected calibration error on the held-out labelled set after any model or calibration change.

## 4. Authorization matrix
Generated from the oRPC router: for each procedure with a resource id, create resources as user A, call as user B and as anonymous → expect 404/401. Includes presign endpoints (B cannot get URLs for A's keys) and SSE streams.

## 5. Accessibility tests
- axe-core in Storybook (all stories) and in Playwright on key pages; fail on serious/critical.
- Keyboard-only E2E: complete onboarding, create a loop, mark clean/not yet, change speed, open mixer, using only keys mapped to pedals.
- Reduced-motion snapshot tests (page-flip mode, no flashing).
- Contrast tokens validated in `ui-tokens` unit tests (4.5:1 text, 3:1 UI) for Light, Dark and Stage × normal/increased contrast, plus gamut and colour-vision separation tests (`28-ui-quality-and-design-review.md` §3).
- Visual regression: Playwright screenshot matrix of key screens × appearances × viewports in the pinned Playwright Docker image (`28-…` §4).
- Manual screen-reader pass (VoiceOver iOS/macOS, TalkBack, NVDA) before G1.

## 6. Test data
- Only owned or CC-BY audio in the repo/test buckets (example songs, owned multitracks, GuitarSet subsets); no commercial recordings anywhere in CI.
- Synthetic users and seeds via `pnpm seed`; billing in provider test mode; vendors mocked with recorded fixtures, plus a weekly staging canary using a real vendor call on an owned clip.

## 7. Release gates (summary)
A release candidate ships only if: all PR checks green; nightly full E2E green on three engines; ML regression green for the pinned `pipeline_version`; Tier 1 real-device audio checklist signed off; no open critical security findings; licence gate green; accessibility checks green.

## Implementation notes (step 11, 2026-10-22)
- Audio scenarios live in `packages/audio-engine/test/scenarios.ts` and run twice: in Node through `ProcessorCore` + `dsp.wasm` (`pnpm --filter @splitune/audio-engine test`) and through the real AudioWorklet in an `OfflineAudioContext` in Chromium, Firefox and WebKit (`test:browser`, a CI step).
- Thresholds as implemented: duration and last audible frame within 128 frames of `10/rate` s after the start, level within 1 dB; pitch ±5 cents (measured 0.00 at 0.5×, +2.08 at +2 st); loop seam (4 bars at 160 BPM, five passes at 0.75×): max curvature at seams ≤ 1.5× the music's and level dip ≥ −3 dB; clock ≤ 5 ms per click at 0.5/0.75/1×; count-in at 0.7×: clicks one beat apart at the slowed tempo (±1 frame), downbeat on the scheduled frame (±1), first click ≤ 1 ms from it; mute: 90→10 % in 5–80 ms (measured 23 ms) and curvature ≤ 2× steady (the stretcher's own reaction to a level change reaches 1.5×; a stepped gain would be ~70×).
- Stem alignment: AAC from FFmpeg and AudioToolbox and Opus, encoded in the test with the separation stage's settings, through both decode paths: exact length, offset 0 (lag search ±4096 frames). Chromium + Opus + `decodeAudioData` is an expected failure (24 frames early).
- Transport behaviour (pause fade and resume point, seek, end, beats and accents, scheduled commands, count-in cancel, preset change) is covered in Node (`test/transport.test.ts`).

## Implementation notes (step 12, 2026-10-22)
- `apps/web/e2e/practice.spec.ts` (9 tests) runs on chromium, firefox, webkit, mobile-chrome and mobile-safari: progressive states without layout shift, cursor-vs-clock error, loops/count-in/assess, edit chord + note and "report wrong" persisted (stored ops `set_chord`, `report_wrong`, `set_note`), capo redraw time, offline queue, keyboard/pedal, axe. By design, the cursor measurement, desktop controls, the editor and the desktop-layout cases skip on the phone projects, and the phone-layout case skips on desktop projects.
- Firefox locally: Linux Playwright server (`PW_FIREFOX_WS_ENDPOINT`, `exposeNetwork: '<loopback>'`) with a **PulseAudio null sink** (no AudioContext output device otherwise); CI installs PulseAudio with a null sink before the E2E step.
- Stories: every practice state has a story (`Screens/Practice`, `Kit/Notation`, `Kit/WaveformTimeline`); lazy parts need explicit `find*` timeouts (the 1 s default flakes in WebKit).

## Implementation notes (step 13, 2026-10-22)
- E2E global setup now builds an example song through the real `examples:build` script with the mock-mode workers and serves its manifest (`EXAMPLES_MANIFEST`). New specs: `onboarding.spec.ts` (all 5 projects; Firefox at a 390×844 viewport, the only "mobile" it can do; time to first slowed loop attached) and `pwa.spec.ts` (desktop Chromium and WebKit: installability via CDP, offline example practice and app shell).
- Specs that rewrite requests with `page.route` (`journey`, `practice`) create their contexts with `serviceWorkers: 'block'`: Playwright never sees what a service worker fetches.
- `expectAccessible` excludes `[data-base-ui-focus-guard]`: in WebKit Base UI gives these hidden focus guards `role="button"` (no name) on purpose, for VoiceOver.

## Implementation notes (step 16, 2026-10-23)
- **PR vs nightly:** `pnpm --filter @splitune/web e2e:smoke` (`E2E_SMOKE=1`: journey, practice, onboarding, account on chromium/firefox/webkit) on every PR and push; the full suite (every spec × chromium, firefox, webkit, Pixel 7, iPhone 15, iPad Pro 11 landscape, Galaxy Tab S4) nightly at 02:00 UTC and on manual dispatch, same workflow. `e2e:floor` (Docker, old engines) is opt-in, for the monthly floor check.
- **New specs:** `account` (delete account → `/account-deleted`, signed out, rows gone), `fallbacks` (24 §3), `a11y` (axe in Light/Dark/Stage × normal/more contrast + forced colours on 7 core pages and the practice screen; 320 px reflow; keyboard/pedal-only onboarding → loop → passes → speed → mute → own loop → mixer; reduced motion; 200 % text), `security` (headers, nonce, CSP report delivery), `perf` (Long Animation Frames during playback; capo redraw at 4× CPU), `floor`.
- The sign-in helper waits out a 429 on the magic link too (the per-IP limit counts link opens; seven projects sign in many times a night).
- E2E global setup gives the node worker the throwaway database's maintenance login: it had inherited the local `.env` one, so its scheduler and privacy jobs ran against the dev database during E2E.

## Open questions
- Device cloud vendor choice and budget.
- Whether Vitest browser mode can host AudioWorklet tests reliably in WebKit (fallback: Playwright-only audio tests).

## Sources
Tool versions: `00-tech-stack.md`. Cross-linked: `08-evaluation-harness-and-prototypes.md`, `11-audio-engine.md`, `12-practice-screen-and-notation.md`, `17-security.md`, `24-browser-compatibility.md`, `research/ux/accessibility.md`.
