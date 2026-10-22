# audio-dsp

The practice DSP behind `@splitune/audio-engine` (docs/implementation/11-audio-engine.md §2, §7): a C++17 engine that mixes up to eight Int16 stereo stems at a source read position, time-stretches and pitch-shifts the submix with one [Signalsmith Stretch](https://github.com/Signalsmith-Audio/signalsmith-stretch) instance, loops in the input domain with an 8 ms equal-power crossfade, adds count-in and metronome clicks after the stretch, and reports the heard position. The same sources build `dsp.wasm` for the web and a static library for native hosts (docs/implementation/22-native-apps.md).

- `include/splitune/dsp.h` — the C ABI (`dsp_create`, `dsp_stem_alloc`, `dsp_set_gain`, `dsp_set_rate`, `dsp_set_transpose`, `dsp_set_loop`, `dsp_set_beats`, `dsp_play`, `dsp_pause`, `dsp_seek`, `dsp_process`, `dsp_heard`, `dsp_latency`, …). Single-threaded; call it from the audio thread.
- `src/engine.{hpp,cpp}` — the engine; `src/dsp.cpp` — the ABI.
- Dependencies (MIT, header-only), fetched by CMake by commit with a SHA-256: Signalsmith Stretch **1.4.0** (`a670068`) and the Signalsmith Linear version it pins, **0.6.4** (`de55e6a`).

## Building `dsp.wasm`

```bash
pnpm --filter @splitune/audio-dsp build
```

Runs `docker build` with the Emscripten image pinned by digest in `emsdk-version` (6.0.10) and writes `dist/dsp.wasm` (~106 KB): a standalone module (no JS glue; one import, `env.emscripten_notify_memory_growth`), `-O3 -msimd128 -ffast-math -fno-finite-math-only`, no pthreads, memory growing up to 1 GB. The build fails unless the file's SHA-256 equals `dsp.wasm.sha256`, so laptops and CI ship the same bytes (clean arm64 and amd64 builds match). After a deliberate change to the sources, flags or image, record the new hash:

```bash
pnpm --filter @splitune/audio-dsp build --update
```

`dist/` is not committed; Turborepo builds it before `@splitune/audio-engine`'s tests.

## Native builds

```bash
cmake -S packages/audio-dsp -B build/dsp && cmake --build build/dsp
./build/dsp/dsp_smoke
```

Produces the `splitune_dsp` static library and `dsp_smoke` (plays a 440 Hz stem at 0.5× with a count-in, a loop and the metronome; checks the output is finite and audible and the events arrive). On Apple platforms Signalsmith Linear uses Accelerate. **Apple Clang 16.0.0 generates wrong ARM SIMD code with `-ffast-math`** (Signalsmith Linear refuses to compile with it); CMake builds without `-ffast-math` on that compiler.

## Timing model

- The engine reads `rate × frames` input frames per block (fractional carry), so the read position is in the source domain; the stretcher's ratio follows from the block sizes.
- Starts, seeks and preset changes use Signalsmith's `outputSeek()`: the first output frame is exactly the start position, with the library's reflected pre-roll instead of a start-up transient. A seek or pause during playback first fades one block out.
- Heard position = the stretcher's *processing time* `outputLatency()` output frames ago, where processing time = input frames fed − `inputLatency()`. In steady state that is the doc's `pos − inputLatency − outputLatency × rate`; it also stays continuous across rate changes. Loop wraps and seeks are tracked as segments, so the heard position and the beat/metronome/loop events are exact across seams.
- Metronome clicks are synthesised at the output frame where their beat is heard; count-in clicks at the upcoming tempo (the next beats of the grid) divided by the rate, and playback starts on the scheduled downbeat frame.
