---
title: Audio engine (web)
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# Audio engine (web)

The client audio engine plays stems sample-locked, mixes them, time-stretches and pitch-shifts the submix with **one** Signalsmith Stretch instance (architecture Option C, D5), loops sample-accurately, synthesises count-in and metronome, and publishes the master clock that every display follows. Implements M2, M5, M6 (audio), M7 and the audio side of M4.

## TL;DR
- **Custom AudioWorklet + Signalsmith C++ compiled to WASM** (`packages/audio-dsp`). The official `signalsmith-stretch` npm node (1.3.2) can only slow down audio given to it as buffers; with a live upstream mixer connected, its `rate`/loop parameters are ignored. So we mix inside our own worklet and call the MIT C++ library directly — same algorithm, and the same C++ core is reused by native apps (`22-native-apps.md`).
- **Input-domain playhead.** The worklet keeps a read position in source samples, advances it by `rate × 128` per render quantum, mixes the stems at that position, and feeds the stretcher. Loops jump the read position with the library's `seek()` plus a short crossfade.
- **Master clock = heard source time,** computed from the worklet's read position minus stretcher latency (scaled by rate) minus output latency, extrapolated on the main thread with `getOutputTimestamp()`.
- **No cross-origin isolation** (it breaks the YouTube embed on Safari/Firefox), so no `SharedArrayBuffer`: PCM is transferred to the worklet with `postMessage(…, [buffer])`, control messages go over `port`.
- **Memory:** MVP needs only two stems (isolated part + mix-minus; full mix = their sum), held as Int16 PCM ≈ 85 MB for a 4-min song. v1 multi-stem songs stream decoded chunks into a ring buffer.

## 1. Graph
```mermaid
flowchart LR
  subgraph Main thread
    DEC[Decode Worker<br/>Mediabunny / decodeAudioData<br/>→ Int16 PCM at context rate]
    CTRL[Engine API<br/>play, pause, seek, setRate,<br/>setLoop, setGain, setTranspose]
    CLK[Clock extrapolator<br/>getOutputTimestamp]
  end
  subgraph AudioWorkletGlobalScope
    W[SplituneProcessor<br/>stem readers → gains → submix<br/>→ Signalsmith (WASM) → click mixer]
  end
  DEC -- transfer PCM --> W
  CTRL -- port messages --> W
  W -- position reports ~20 ms --> CLK
  W --> OUT[(destination)]
```
- One `AudioContext({ latencyHint: "interactive", sampleRate: 48000 })` per tab, created on the first user gesture (iOS unlock). 48 kHz is the iOS mitigation for mic-related crackling (WebKit bug 326286) and avoids a resample on most hardware.
- Stems are resampled to the context rate once, at decode (`decodeAudioData` resamples natively; WebCodecs output is resampled in the decode Worker).
- `navigator.audioSession.type = "playback"` where available (Safari 16.4+, experimental) so the ringer switch doesn't mute practice audio on iOS.

## 2. Processor (per 128-frame quantum)
```text
inNeeded  = rate * 128 + carry            // fractional accumulator
nIn       = floor(inNeeded); carry = inNeeded - nIn
for each stem s: read nIn frames at pos (Int16 → float), apply gain_s (smoothed), sum → submix[nIn]
if pos + nIn crosses loopEnd: split the read; crossfade 8 ms tail→head; stretch.seek(...) to loopStart region
stretch.process(submix, nIn, out, 128)     // ratio defined by nIn/128
mix count-in / metronome clicks into out (post-stretch, so clicks are never smeared)
pos += nIn
every ~20 ms: port.postMessage({ ctxFrame: currentFrame, pos, rate })
```
- **Rate** range 0.5–1.5 (UI exposes 50–100% in MVP, fine steps of 1%, default presets 50/60/70/75/80/90/100). Rate changes take effect at the next quantum; the stretcher handles continuity.
- **Transpose** (`setTransposeSemitones(semi, tonalityLimit)`) on the same instance (V2).
- **Gains** are smoothed with a 10 ms one-pole ramp to avoid zipper noise; mute/solo resolve to gains on the main thread.
- **Seek** (user tap): set `pos`, call `stretch.seek(input @ pos, rate)` to pre-roll the analysis window, then resume — avoids the stretcher's start-up transient.
- **Loop seam:** the read position wraps in the input domain with an 8 ms equal-power crossfade between loop end and loop start; the stretcher sees continuous input, so the output seam is click-free. Seam inaudibility is an acceptance test (§8).
- **Count-in:** while counting in, `pos` does not advance; clicks are generated at the *upcoming* tempo × rate for N bars, then playback starts exactly on the downbeat (scheduled to the output frame).
- **Metronome:** for each beat in the effective beat grid (`07-music-algorithms.md` §1), compute the output frame at which that source time will be heard (inverse of the clock formula in §3) and synthesise a 20 ms click (accent on downbeats); visual pulse events are posted to the main thread with the same frame stamp.

## 3. Master clock and latency compensation
```text
heard_source_time(ctxFrame) =
  ( pos_at(ctxFrame)
    − stretch.inputLatency()
    − stretch.outputLatency() * rate )          // source samples still inside the stretcher
  / sampleRate
  − (ctx.outputLatency + ctx.baseLatency) * rate // device output path, converted to source time
```
- The worklet reports `(ctxFrame, pos, rate)`; the main thread maps `ctxFrame` → `performance.now()` via `ctx.getOutputTimestamp()` and extrapolates per animation frame. `outputLatency` exists in Safari/iOS 18.4+, Chrome 102+, Firefox 70+; when missing, use `getOutputTimestamp()` alone plus a user-adjustable offset.
- A **"display offset" slider** (±150 ms) in settings covers Bluetooth headphones and odd devices (Soundslice has the same setting).
- Consumers: alphaTab `updatePosition(ms)` (`12-practice-screen-and-notation.md`), chord strip, timeline, YouTube drift correction, loop UI, pass counter.

## 4. Decoding and memory
| Case | Strategy | Memory (4-min song) |
|---|---|---|
| MVP song: isolated stem + mix-minus | Decode both fully to Int16 interleaved stereo; transfer to worklet | 2 × 42 MB ≈ 85 MB |
| Local file before stems exist (M2) | Decode full mix only | ≈ 42 MB |
| v1 multi-stem (4–6 stems) | Decode Worker produces 10 s chunks ahead of the playhead into a per-stem ring in the worklet; loop region pinned in cache | ≈ 4–6 × 4 MB working set |
- Stem files: **AAC-LC in MP4 is the guaranteed format**; Opus in WebM is an optional smaller variant chosen only after a startup decode test proves `decodeAudioData` handles it with correct length/offset (Safari 26/27 Opus decode support is unverified). After decoding, the engine trims encoder priming using the duration in `stems.json` so all stems start at sample 0.
- Waveform peaks are computed in the decode Worker (min/max per 512 samples) and cached in IndexedDB; the timeline (wavesurfer.js 8 or a custom canvas) never decodes audio itself.

## 5. Platform integration
- **Media Session:** title/artist, play/pause/seek handlers (lock-screen and headset buttons as extra hands-free controls).
- **Screen Wake Lock** during practice (Safari/iOS 18.4+, Chrome 84+, Firefox 126+); re-acquire on `visibilitychange`.
- **Interruptions:** handle `AudioContext.onstatechange` (`interrupted`/`suspended` on iOS calls, Siri, route changes) → pause the state machine and show "Tap to resume".
- **Background:** practice audio stops when the tab is hidden on iOS; this is expected for a web app and listed as a native-app trigger.

## 6. CPU budget and degradation
| Tier | Detection | Stretch preset | Notes |
|---|---|---|---|
| High | desktop, recent iPad/iPhone | default | |
| Mid | mid-range Android | cheaper preset (larger interval) + split computation | |
| Low | repeated worklet underruns (`processorerror` or dropout counter from timing jitter) | cheaper preset; disable pitch shift; suggest pre-rendered speeds (if P7 fails, Option B) | telemetry event `audio_underrun` |
Budget (proposal, validated in P7): worklet ≤35% of one core on a mid-range Android at 0.5× with 2 stems; ≤25% on iPhone 15-class.

## 7. Package layout (`packages/audio-dsp`, `packages/audio-engine`)
- `audio-dsp`: C++17 wrapper around `signalsmith-stretch` (pinned git tag, MIT) and a tiny mixer/click synth, exposing a C ABI (`dsp_create`, `dsp_process`, `dsp_seek`, `dsp_set_transpose`, `dsp_latency`). Built with Emscripten (`-O3 -msimd128`, no pthreads) to `dsp.wasm`; CMake target for native builds. Watch the documented Apple Clang `-ffast-math` SIMD bug when building natively.
- `audio-engine` (TS): `createEngine()`, loads `dsp.wasm` as a compiled `WebAssembly.Module` on the main thread and passes it to the worklet via `processorOptions` (the worklet scope has no `fetch`), the processor class, decode Worker, clock extrapolator, and a typed command/event protocol shared with tests.

## 8. Testing
- **Offline render tests** (`OfflineAudioContext` in Playwright/Chromium): render 10 s at 0.5×, 0.75×, 1.0× and assert duration, no NaNs, peak/RMS within tolerance, and loop seam energy discontinuity below threshold.
- **Clock accuracy:** render a click track with known beat times through the engine; detect click onsets in the output and compare with reported heard-time (error ≤5 ms offline).
- **Device lab** (manual + scripted): iPhone (iOS 27), iPad, mid-range Android, desktop Chrome/Safari/Firefox — CPU, underruns, interruptions, Bluetooth offset (`18-testing-strategy.md`).
- **Listening sign-off:** P7 results gate the default preset.

## Implementation notes (step 11, 2026-10-22)
- **Packages:** `packages/audio-dsp` (C++17 engine + C ABI, CMake; Docker build of `dsp.wasm` in `emscripten/emsdk:6.0.10` pinned by digest, Signalsmith Stretch 1.4.0 + Linear 0.6.4 fetched by commit with SHA-256) and `packages/audio-engine` (`createEngine`, `SplituneProcessor` around a Node-testable `ProcessorCore`, decode, clock, tiers, platform, demo). Both READMEs document the API.
- **More of §2 lives in C++ than the sketch implies:** the mixer, gain smoothing, loop seam, count-in, metronome and the heard-position bookkeeping are in `audio-dsp` (one core for web and native); the worklet only moves messages and buffers.
- **Starts and seeks use Signalsmith's `outputSeek()`** (reset + reflected pre-roll, first output frame = the position) instead of `seek()`: no start-up transient and sample-exact downbeats after a count-in. A seek or pause while playing fades one 128-frame block out first. The loop seam does not call `seek()`: the input-domain crossfade keeps the stretcher's input continuous (§2 bullet), which measured click-free (seam curvature 0.93× the music's, worst level dip −2 dB).
- **§3 formula, refined:** heard = the stretcher's processing time (`input fed − inputLatency()`) as it was `outputLatency()` output frames ago, tracked per block. Steady state equals `pos − inputLatency − outputLatency × rate`; unlike the formula it stays continuous when the rate changes. Loop wraps and seeks are tracked as segments so heard positions, beats and loop-wrap events are exact across seams. Clock error offline: ≤ 0.33 ms at 0.5×, 0.09 ms at 0.75×, 0 at 1× (all three engines).
- **Device latency:** `getOutputTimestamp()` differs by engine. Chromium's context time trails `currentTime` by `outputLatency + baseLatency` (Chrome 152, MacBook Air speakers: 29.3 ms vs 24 + 5.3 ms); WebKit's by almost nothing (0.1–2.7 ms vs 12.8 + 2.7 ms). The clock uses the timestamp for a smooth mapping and subtracts the part of the reported latency it doesn't include (smoothed `currentTime − contextTime`); without a timestamp, `currentTime − outputLatency − baseLatency`. Real Safari and Firefox not measured yet.
- **WebAssembly.Module via `processorOptions`** works in Chromium, Firefox and WebKit (Playwright builds); the module is standalone (no Emscripten JS glue, one import).
- **Decoding (§4):** WebCodecs path = Mediabunny in a Worker + own polyphase Kaiser-windowed sinc resampler (44.1 → 48 kHz); `decodeAudioData` fallback. AAC priming: FFmpeg encodes carry an edit list (Mediabunny applies it); AudioToolbox encodes (what the Mac worker ships) carry only `iTunSMPB`, which Mediabunny ignores (stem 2112 frames late) and Firefox's `decodeAudioData` ignores too, so the engine applies the record in both paths. Chromium's `decodeAudioData` starts Opus 24 frames early at 48 kHz (as at 44.1 kHz): Opus stays off by default.
- **CPU tiers (§6):** `high` default preset; `mid` cheaper preset + split computation; `low` also no pitch shift. Initial `mid` only where Chromium reports ≤ 4 GB and ≤ 4 cores. Step down when the worklet's own processing time exceeds 75 % of audio time for two 1 s windows, or the context clock falls 20 ms behind wall time; each step emits `audio_underrun`.
- **Rate** clamped to 0.5–1.5 in the engine API (the DSP accepts 0.25–2 for QX13 experiments). Transpose uses an 8 kHz tonality limit.
- **P7 engine side (CPU, 2 stems, 0.5×, 60 s, MacBook Air M4):** worklet load avg 3.0 % / max 4.6 % (Chrome, high), 2.5 % / 5.2 % (Chrome, mid), 3.3 % / 7.2 % (Playwright WebKit, high), 2.3 % / 11.2 % (WebKit, mid); no underruns. Load = processing time ÷ audio time on the audio thread, one core. Safari, iPhone/iPad, Android, Firefox: not yet run (owner devices; demo page **Measure**). Listening comparison against Rubber Band R3 not done.

## Implementation notes (step 12, 2026-10-22)
- Added `Engine.setStopAt(seconds | null)` (protocol `{ type: 'stopAt' }`, event `stopReached`): a one-shot pause when the heard position reaches a time. The practice screen uses it for loop rests and "assess" pauses at the loop end without timers on the main thread.
- Loop-end handling at the seam is still the DSP's (crossfade); `stopAt` only pauses.

## Implementation notes (step 13, 2026-10-22)
- `Engine.play()` returns quietly when the context was closed while `resume()` was pending (dispose right after the tap, e.g. leaving the page); it used to reject with nobody handling it.

## Implementation notes (step 16, 2026-10-23)
- The display offset (§3) is set from Settings → Display & practice → **Sound delay** (`soundDelayMs`, per device, ±150 ms in 10 ms steps); `PracticeAudio.setDisplayOffset` mirrors it into the engine, positive = the cursor follows later (Bluetooth).
- `ScreenWakeLock.acquire()` failing (unsupported or refused) shows the practice screen's once-per-device "keep screen on" tip from the first play.

## Open questions
- P7 outcome at 0.5× (D5); fallback is Rubber Band commercial licence or offline pre-render.
- Whether to support slow-down below 50% (QX13).
- Exact CPU numbers per device class after P7.

## Sources
- [Signalsmith Stretch repository](https://github.com/Signalsmith-Audio/signalsmith-stretch) and the `signalsmith-stretch` 1.3.2 npm README (web build modes; live-input mode ignores rate/loop) — tier 1, accessed 2026-10-20
- [MDN: AudioContext.outputLatency, getOutputTimestamp, Screen Wake Lock, Media Session, Audio Session](https://developer.mozilla.org/) via MDN browser-compat-data 8.1.6 — tier 2, accessed 2026-10-20
- [WebKit bug 326286](https://bugs.webkit.org/show_bug.cgi?id=326286) (iOS crackling with mic open) — tier 2, accessed 2026-10-20
- [web.dev: COOP/COEP](https://web.dev/articles/coop-coep) — tier 2, accessed 2026-10-20
- Cross-linked research: `ml/playback-time-stretch-pitch-shift.md` (Option C, latency, listening test), `ux/practice-tool-patterns.md` (loop, count-in, metronome specs), `product/recommendations-and-decisions.md` D5, D9.
