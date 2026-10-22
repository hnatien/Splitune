# check=skip=InvalidDefaultArgInFrom
# Reproducible dsp.wasm build (docs/implementation/02-repo-tooling-and-ci.md §2). The Emscripten
# image is pinned by digest in emsdk-version; scripts/build.mjs passes it in and exports
# /dsp.wasm to dist/.
ARG EMSDK_IMAGE
FROM ${EMSDK_IMAGE} AS build
WORKDIR /src
COPY CMakeLists.txt ./
COPY include ./include
COPY src ./src
RUN emcmake cmake -S . -B /build -DCMAKE_BUILD_TYPE=Release \
  && cmake --build /build --target dsp_wasm

FROM scratch
COPY --from=build /build/dsp.wasm /dsp.wasm
