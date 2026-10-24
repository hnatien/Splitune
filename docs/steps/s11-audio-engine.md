# Step 11 — Audio engine (AudioWorklet + Signalsmith WASM)

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/specs/11-audio-engine.md` (primary spec — graph, processor loop, clock formula, memory, CPU tiers, tests)
- `docs/specs/24-browser-compatibility.md` §2–§4 (hard requirements, fallbacks, iOS issues)
- `docs/research/ml/playback-time-stretch-pitch-shift.md` (why Signalsmith, Option C, latency)
- `docs/specs/18-testing-strategy.md` §2 (audio tests)

Prerequisites: Step 01. Independent of steps 02–10 — can run in parallel.

## Goal
`packages/audio-dsp` + `packages/audio-engine`: a sample-accurate practice audio engine that mixes stems, time-stretches/pitch-shifts the submix with one Signalsmith instance, loops seamlessly, synthesises count-in and metronome, and publishes a latency-compensated master clock — working in Chrome, Edge, Firefox and Safari (macOS + iOS).

## Deliverables
1. **`audio-dsp`:** C++17 wrapper over `signalsmith-stretch` (pinned git tag, MIT) + mixer + click synth with a C ABI (`dsp_create`, `dsp_process`, `dsp_seek`, `dsp_set_rate`, `dsp_set_transpose`, `dsp_latency`, `dsp_set_gain`, `dsp_set_loop`…). Emscripten build in a pinned Docker image (`-O3 -msimd128`, no pthreads) → `dsp.wasm`; CMake target for native builds later. Note the Apple Clang `-ffast-math` SIMD bug for native builds.
2. **`audio-engine`:** `createEngine()` (AudioContext 48 kHz, created on user gesture), compiled `WebAssembly.Module` passed to the worklet via `processorOptions`, `SplituneProcessor` implementing doc 11 §2 (fractional input accumulator, Int16 stem readers, smoothed gains, loop seam with 8 ms equal-power crossfade + `seek`, count-in with paused input, metronome clicks scheduled in output frames, position reports every ~20 ms), decode Worker (Mediabunny/WebCodecs or `decodeAudioData`, resample to context rate, trim encoder priming using durations from `stems.json`, waveform peaks), clock extrapolator (doc 11 §3 formula; `outputLatency` when available, else `getOutputTimestamp` + user offset), typed command/event protocol, Media Session, Screen Wake Lock (when supported), `navigator.audioSession` on Safari, interruption handling, CPU-tier degradation with an `audio_underrun` event.
3. **Demo page** in the package (Vite) to load two stems, play, loop bars, change speed 50–100% and transpose, toggle count-in/metronome, mute/solo — used for manual device testing.
4. **Tests:** offline-render tests in Playwright for all three engines (duration at rate, pitch preservation at 0.5×, transpose ratio, loop seam discontinuity, clock accuracy ≤5 ms with a click track, count-in alignment, gain ramp), plus unit tests for the protocol and clock math.
5. **Prototype 7 (engine side):** CPU measurements on the owner's devices (Mac Safari/Chrome, iPhone/iPad Safari, any Android) at 0.5× with 2 stems; optional listening comparison vs Rubber Band R3 offline renders (GPL is fine for personal use — do not ship it in the client).

## Out of scope
UI beyond the demo page; mic input (v1).

## Acceptance criteria
- All offline-render tests pass in Chromium, Firefox and WebKit.
- Manual device checklist (doc 18 §2 / doc 24 §6) run on the devices available, results tabulated: no audible loop click, no underruns at 0.5× on Tier 1 devices you have, CPU per tier.
- `dsp.wasm` build is reproducible (same hash from a clean Docker build).
- Engine API documented in the package README with a usage example for step 12.

## Verification to run and report
Docker build of `dsp.wasm` (+ hash), `pnpm --filter audio-engine test`, Playwright audio suite across 3 engines, device table.
