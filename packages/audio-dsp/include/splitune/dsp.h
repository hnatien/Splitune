/*
 * C ABI of the Splitune practice DSP (docs/specs/11-audio-engine.md §2, §7).
 *
 * One engine mixes up to SPLITUNE_DSP_MAX_STEMS Int16 stereo stems at a source read position,
 * time-stretches and pitch-shifts the submix with one Signalsmith Stretch instance, loops in the
 * input domain with an equal-power crossfade, and adds count-in and metronome clicks after the
 * stretch. Positions are frames on the decoded-PCM timeline at the engine's sample rate ("source
 * frames"); output offsets are frames within the block passed to dsp_process.
 *
 * Single-threaded: every call must come from the thread that renders audio.
 */
#ifndef SPLITUNE_DSP_H
#define SPLITUNE_DSP_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define SPLITUNE_DSP_MAX_STEMS 8
#define SPLITUNE_DSP_MAX_BLOCK 4096

typedef struct SplituneDsp SplituneDsp;

/* Event types reported by dsp_events after each dsp_process call. */
enum {
  DSP_EVENT_BEAT = 1,          /* a beat of the grid is heard; value = beat index */
  DSP_EVENT_COUNT_IN_BEAT = 2, /* a count-in click; value = click index */
  DSP_EVENT_STARTED = 3,       /* aligned start (play, count-in downbeat, seek); value = source frame */
  DSP_EVENT_LOOP_WRAP = 4,     /* the loop end is heard and playback is back at the start; value = pass */
  DSP_EVENT_ENDED = 5,         /* the end of the stems is heard; transport stops */
  DSP_EVENT_STOPPED = 6        /* pause finished its fade; value = resume position */
};

/* Transport states (dsp_transport). */
enum { DSP_STOPPED = 0, DSP_COUNT_IN = 1, DSP_PLAYING = 2 };

/* Stretch presets (dsp_set_quality); docs/specs/11-audio-engine.md §6. */
enum { DSP_QUALITY_DEFAULT = 0, DSP_QUALITY_CHEAPER = 1 };

typedef struct SplituneDspEvent {
  int32_t type;
  int32_t offset; /* output frame within the last block */
  int32_t accent; /* 1 on downbeats and the first click of a count-in bar */
  int32_t reserved;
  double value;
} SplituneDspEvent;

SplituneDsp *dsp_create(double sample_rate, uint32_t seed);
void dsp_destroy(SplituneDsp *dsp);

void *dsp_alloc(int32_t bytes);
void dsp_free(void *ptr);

/* Interleaved stereo Int16 storage for a stem, to be filled by the caller. Null on failure. */
int16_t *dsp_stem_alloc(SplituneDsp *dsp, int32_t stem, int32_t frames);
void dsp_stem_clear(SplituneDsp *dsp, int32_t stem);
/* Longest loaded stem, in source frames. */
int32_t dsp_duration(const SplituneDsp *dsp);

/* Linear gain; smoothed with a 10 ms one-pole ramp before the stretch. */
void dsp_set_gain(SplituneDsp *dsp, int32_t stem, float gain);
/* Playback rate (source frames per output frame), clamped to 0.25–2. */
void dsp_set_rate(SplituneDsp *dsp, double rate);
/* Pitch shift in semitones; tonality_limit_hz > 0 keeps more timbre above that frequency. */
void dsp_set_transpose(SplituneDsp *dsp, float semitones, float tonality_limit_hz);
void dsp_set_loop(SplituneDsp *dsp, int32_t enabled, int32_t start, int32_t end);
/* Beat grid in source frames (ascending); downbeats[i] != 0 marks bar starts. Copied. */
void dsp_set_beats(SplituneDsp *dsp, const double *frames, const uint8_t *downbeats, int32_t count);
void dsp_set_metronome(SplituneDsp *dsp, int32_t enabled);
void dsp_set_click_gain(SplituneDsp *dsp, float gain);
void dsp_set_quality(SplituneDsp *dsp, int32_t quality);

/* Starts from the current position, after count_in_bars bars of clicks at the upcoming tempo. */
void dsp_play(SplituneDsp *dsp, int32_t count_in_bars);
void dsp_pause(SplituneDsp *dsp);
void dsp_seek(SplituneDsp *dsp, int32_t frame);

/* Renders `frames` (≤ SPLITUNE_DSP_MAX_BLOCK) stereo output frames into dsp_output. */
void dsp_process(SplituneDsp *dsp, int32_t frames);
float *dsp_output(SplituneDsp *dsp, int32_t channel);
int32_t dsp_event_count(const SplituneDsp *dsp);
const SplituneDspEvent *dsp_events(const SplituneDsp *dsp);

/* Source frame heard (leaving the stretcher) at an output offset of the last block. */
double dsp_heard(const SplituneDsp *dsp, int32_t offset);
int32_t dsp_transport(const SplituneDsp *dsp);
double dsp_rate(const SplituneDsp *dsp);
/* Stretcher latency at the current rate, in source frames (input + output × rate). */
double dsp_latency(const SplituneDsp *dsp);
int32_t dsp_input_latency(const SplituneDsp *dsp);
int32_t dsp_output_latency(const SplituneDsp *dsp);

#ifdef __cplusplus
}
#endif

#endif
