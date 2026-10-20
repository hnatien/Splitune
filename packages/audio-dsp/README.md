# audio-dsp

Placeholder. Implementation step 11 (audio engine) adds the C++ wrapper around Signalsmith Stretch here and compiles it to `dsp.wasm` with Emscripten (SIMD, no threads), with the SDK version pinned in `emsdk-version` and the build running inside a Docker image so CI and laptops produce identical output. A CMake build for native targets lives alongside it.
