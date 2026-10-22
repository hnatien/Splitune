cmake_minimum_required(VERSION 3.24)
project(splitune_dsp LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

# Signalsmith Stretch 1.4.0 and the Signalsmith Linear version it pins (0.6.4), both MIT and
# header-only, fetched by commit with a content hash so every build compiles the same source.
include(FetchContent)
FetchContent_Declare(
  signalsmith_stretch
  URL https://github.com/Signalsmith-Audio/signalsmith-stretch/archive/a670068d9aeb64913331d5cc29337b19a457a7df.tar.gz
  URL_HASH SHA256=948b8382bb13f316d13536cdfe06111789a538e8fee7f7a531ee2aec94de1747
  SOURCE_SUBDIR no-cmake
  DOWNLOAD_EXTRACT_TIMESTAMP OFF
)
FetchContent_Declare(
  signalsmith_linear
  URL https://github.com/Signalsmith-Audio/linear/archive/de55e6a50ffcf6f8f43f649692d94691c7025151.tar.gz
  URL_HASH SHA256=cc39693d5c8bc96451b5503819bb82b2d88c1df450183c55595e5d9d4b517012
  SOURCE_SUBDIR no-cmake
  DOWNLOAD_EXTRACT_TIMESTAMP OFF
)
FetchContent_MakeAvailable(signalsmith_stretch signalsmith_linear)

add_library(splitune_dsp_options INTERFACE)
target_include_directories(splitune_dsp_options INTERFACE
  ${CMAKE_CURRENT_SOURCE_DIR}/include
  ${signalsmith_stretch_SOURCE_DIR}/include
  ${signalsmith_linear_SOURCE_DIR}/include)
target_compile_options(splitune_dsp_options INTERFACE -O3 -fno-exceptions -fno-rtti -Wall -Wextra)

# -ffast-math minus finite-math-only: the engine checks for NaN/Inf at its API. Apple Clang
# 16.0.0 generates wrong ARM SIMD with -ffast-math (Signalsmith Linear refuses to compile), so
# native builds with that compiler go without it.
if(CMAKE_CXX_COMPILER_ID STREQUAL "AppleClang" AND CMAKE_CXX_COMPILER_VERSION VERSION_EQUAL 16.0.0)
  message(STATUS "splitune_dsp: Apple Clang 16.0.0, building without -ffast-math")
else()
  target_compile_options(splitune_dsp_options INTERFACE -ffast-math -fno-finite-math-only)
endif()

set(SPLITUNE_DSP_SOURCES src/engine.cpp src/dsp.cpp)

if(EMSCRIPTEN)
  # dsp.wasm: standalone module (no JS glue), single-threaded, WASM SIMD. Loaded by the
  # AudioWorklet from a WebAssembly.Module compiled on the main thread.
  add_executable(dsp_wasm ${SPLITUNE_DSP_SOURCES})
  set_target_properties(dsp_wasm PROPERTIES OUTPUT_NAME dsp SUFFIX .wasm)
  target_link_libraries(dsp_wasm PRIVATE splitune_dsp_options)
  target_compile_options(dsp_wasm PRIVATE -msimd128)
  target_link_options(dsp_wasm PRIVATE
    -O3 -msimd128 --no-entry
    -sSTANDALONE_WASM=1
    -sFILESYSTEM=0
    -sALLOW_MEMORY_GROWTH=1
    -sINITIAL_MEMORY=4MB
    -sMAXIMUM_MEMORY=1GB
    -sSTACK_SIZE=256KB
    -sABORTING_MALLOC=0)
else()
  # Static library for native hosts (docs/implementation/22-native-apps.md) and a smoke test.
  add_library(splitune_dsp STATIC ${SPLITUNE_DSP_SOURCES})
  target_link_libraries(splitune_dsp PUBLIC splitune_dsp_options)
  add_executable(dsp_smoke test/smoke.cpp)
  target_link_libraries(dsp_smoke PRIVATE splitune_dsp)
endif()
