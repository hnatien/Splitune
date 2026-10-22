// Native smoke test of the C ABI: plays a 440 Hz stem at 0.5× with a count-in, a loop and the
// metronome, and checks the output is finite and audible and the transport events arrive.
#include <cmath>
#include <cstdio>

#include "splitune/dsp.h"

int main() {
  const double rate = 48000;
  const int frames = 4 * 48000;
  SplituneDsp *dsp = dsp_create(rate, 1);
  int16_t *pcm = dsp_stem_alloc(dsp, 0, frames);
  for (int i = 0; i < frames; ++i) {
    const auto sample = static_cast<int16_t>(8000 * std::sin(2 * 3.14159265358979 * 440 * i / rate));
    pcm[2 * i] = pcm[2 * i + 1] = sample;
  }
  double beats[8];
  uint8_t downbeats[8];
  for (int i = 0; i < 8; ++i) {
    beats[i] = i * 24000.0;
    downbeats[i] = i % 4 == 0;
  }
  dsp_set_beats(dsp, beats, downbeats, 8);
  dsp_set_metronome(dsp, 1);
  dsp_set_rate(dsp, 0.5);
  dsp_set_loop(dsp, 1, 0, 96000);
  dsp_play(dsp, 1);

  int started = 0, wraps = 0, countIn = 0;
  double energy = 0;
  bool finite = true;
  for (int block = 0; block < 6000; ++block) {
    dsp_process(dsp, 128);
    for (int c = 0; c < 2; ++c) {
      const float *out = dsp_output(dsp, c);
      for (int i = 0; i < 128; ++i) {
        finite = finite && std::isfinite(out[i]);
        energy += out[i] * out[i];
      }
    }
    const SplituneDspEvent *events = dsp_events(dsp);
    for (int e = 0; e < dsp_event_count(dsp); ++e) {
      started += events[e].type == DSP_EVENT_STARTED;
      wraps += events[e].type == DSP_EVENT_LOOP_WRAP;
      countIn += events[e].type == DSP_EVENT_COUNT_IN_BEAT;
    }
  }
  dsp_destroy(dsp);
  std::printf("finite=%d energy=%.1f started=%d countIn=%d wraps=%d\n", finite, energy, started,
              countIn, wraps);
  return finite && energy > 1000 && started == 1 && countIn == 4 && wraps >= 1 ? 0 : 1;
}
