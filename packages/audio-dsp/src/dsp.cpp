#include "splitune/dsp.h"

#include <cstdlib>
#include <new>

#include "engine.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define DSP_API EMSCRIPTEN_KEEPALIVE
#else
#define DSP_API
#endif

struct SplituneDsp {
  SplituneDsp(double sampleRate, uint32_t seed) : engine(sampleRate, seed) {}
  splitune::Engine engine;
};

extern "C" {

DSP_API SplituneDsp *dsp_create(double sample_rate, uint32_t seed) {
  if (!(sample_rate >= 8000 && sample_rate <= 384000)) return nullptr;
  return new (std::nothrow) SplituneDsp(sample_rate, seed);
}

DSP_API void dsp_destroy(SplituneDsp *dsp) { delete dsp; }

DSP_API void *dsp_alloc(int32_t bytes) {
  return bytes > 0 ? std::malloc(static_cast<size_t>(bytes)) : nullptr;
}

DSP_API void dsp_free(void *ptr) { std::free(ptr); }

DSP_API int16_t *dsp_stem_alloc(SplituneDsp *dsp, int32_t stem, int32_t frames) {
  return dsp->engine.allocStem(stem, frames);
}

DSP_API void dsp_stem_clear(SplituneDsp *dsp, int32_t stem) { dsp->engine.clearStem(stem); }

DSP_API int32_t dsp_duration(const SplituneDsp *dsp) { return dsp->engine.duration(); }

DSP_API void dsp_set_gain(SplituneDsp *dsp, int32_t stem, float gain) {
  dsp->engine.setGain(stem, gain);
}

DSP_API void dsp_set_rate(SplituneDsp *dsp, double rate) { dsp->engine.setRate(rate); }

DSP_API void dsp_set_transpose(SplituneDsp *dsp, float semitones, float tonality_limit_hz) {
  dsp->engine.setTranspose(semitones, tonality_limit_hz);
}

DSP_API void dsp_set_loop(SplituneDsp *dsp, int32_t enabled, int32_t start, int32_t end) {
  dsp->engine.setLoop(enabled != 0, start, end);
}

DSP_API void dsp_set_beats(SplituneDsp *dsp, const double *frames, const uint8_t *downbeats,
                           int32_t count) {
  dsp->engine.setBeats(frames, downbeats, count);
}

DSP_API void dsp_set_metronome(SplituneDsp *dsp, int32_t enabled) {
  dsp->engine.setMetronome(enabled != 0);
}

DSP_API void dsp_set_click_gain(SplituneDsp *dsp, float gain) { dsp->engine.setClickGain(gain); }

DSP_API void dsp_set_quality(SplituneDsp *dsp, int32_t quality) { dsp->engine.setQuality(quality); }

DSP_API void dsp_play(SplituneDsp *dsp, int32_t count_in_bars) { dsp->engine.play(count_in_bars); }

DSP_API void dsp_pause(SplituneDsp *dsp) { dsp->engine.pause(); }

DSP_API void dsp_seek(SplituneDsp *dsp, int32_t frame) { dsp->engine.seek(frame); }

DSP_API void dsp_process(SplituneDsp *dsp, int32_t frames) { dsp->engine.process(frames); }

DSP_API float *dsp_output(SplituneDsp *dsp, int32_t channel) {
  return dsp->engine.output(channel == 0 ? 0 : 1);
}

DSP_API int32_t dsp_event_count(const SplituneDsp *dsp) {
  return static_cast<int32_t>(dsp->engine.events().size());
}

DSP_API const SplituneDspEvent *dsp_events(const SplituneDsp *dsp) {
  return dsp->engine.events().data();
}

DSP_API double dsp_heard(const SplituneDsp *dsp, int32_t offset) { return dsp->engine.heard(offset); }

DSP_API int32_t dsp_transport(const SplituneDsp *dsp) { return dsp->engine.transport(); }

DSP_API double dsp_rate(const SplituneDsp *dsp) { return dsp->engine.rate(); }

DSP_API double dsp_latency(const SplituneDsp *dsp) { return dsp->engine.latency(); }

DSP_API int32_t dsp_input_latency(const SplituneDsp *dsp) { return dsp->engine.inputLatency(); }

DSP_API int32_t dsp_output_latency(const SplituneDsp *dsp) { return dsp->engine.outputLatency(); }

} // extern "C"
