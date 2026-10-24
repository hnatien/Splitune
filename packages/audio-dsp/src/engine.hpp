#pragma once

#include <array>
#include <cstdint>
#include <vector>

#include "signalsmith-stretch/signalsmith-stretch.h"
#include "splitune/dsp.h"

namespace splitune {

// The practice engine behind the C ABI in include/splitune/dsp.h. Reads the stems at a source
// position, mixes them, feeds one Signalsmith Stretch instance and adds clicks after the stretch
// (docs/specs/11-audio-engine.md §2). The heard position follows the stretcher's
// "processing time": input runs inputLatency() frames ahead of it and output leaves
// outputLatency() frames behind it (§3).
class Engine {
public:
  Engine(double sampleRate, uint32_t seed);
  ~Engine();
  Engine(const Engine &) = delete;
  Engine &operator=(const Engine &) = delete;

  int16_t *allocStem(int stem, int32_t frames);
  void clearStem(int stem);
  int32_t duration() const { return static_cast<int32_t>(duration_); }

  void setGain(int stem, float gain);
  void setRate(double rate);
  void setTranspose(float semitones, float tonalityLimitHz);
  void setLoop(bool enabled, int64_t start, int64_t end);
  void setBeats(const double *frames, const uint8_t *downbeats, int count);
  void setMetronome(bool enabled) { metronome_ = enabled; }
  void setClickGain(float gain) { clickGain_ = gain; }
  void setQuality(int quality);

  void play(int countInBars);
  void pause();
  void seek(int64_t frame);

  void process(int frames);
  float *output(int channel) { return output_[channel].data(); }
  const std::vector<SplituneDspEvent> &events() const { return events_; }

  double heard(int offset) const;
  int transport() const { return transport_; }
  double rate() const { return rate_; }
  double latency() const;
  int inputLatency() const { return stretch_.inputLatency(); }
  int outputLatency() const { return stretch_.outputLatency(); }

private:
  // PCM is malloc'd so that running out of memory returns null instead of aborting.
  struct Stem {
    int16_t *pcm = nullptr;
    int64_t frames = 0;
    float gain = 1;
    float target = 1;
  };
  // A run of input frames read contiguously from the source, starting at input index `counter`.
  struct Segment {
    double counter;
    double source;
    bool wrap;
  };
  // The stretcher's processing time (an input index) when output frame `frame` was produced.
  struct Mark {
    int64_t frame;
    double processing;
  };
  struct Voice {
    int64_t start;
    bool accent;
    int countIn; // click index for count-in clicks, -1 for metronome clicks
  };
  enum class Action { None, Pause, Seek, Reconfigure };

  void configure();
  void alignedStart(int64_t position, int64_t frame);
  void read(int frames);
  void mixAt(int64_t position, float gainScale, float &left, float &right) const;
  void renderPlaying(int offset, int frames);
  void scanHeard(int offset, int frames, double fromCounter, double toCounter);
  void renderClicks(int frames);
  void emit(int type, int offset, bool accent, double value);
  void pushSegment(double counter, double source, bool wrap);
  void pushMark(int64_t frame, double processing);
  double processingAt(int64_t frame) const;
  double sourceAt(double counter) const;
  void upcomingTempo(int64_t position, double &period, int &beatsPerBar) const;
  void clearCountIn();

  double sampleRate_;
  signalsmith::stretch::SignalsmithStretch<float> stretch_;
  int quality_ = DSP_QUALITY_DEFAULT;
  std::array<Stem, SPLITUNE_DSP_MAX_STEMS> stems_;
  int64_t duration_ = 0;
  float gainCoeff_;
  double rate_ = 1;
  double carry_ = 0;

  int transport_ = DSP_STOPPED;
  int64_t startPosition_ = 0; // where play() starts; the resume point while stopped
  int64_t readPosition_ = 0;  // next source frame fed to the stretcher
  int64_t inputCounter_ = 0;  // input frames fed since the last aligned start
  int64_t playingFrom_ = 0;   // output frame of the last aligned start
  int64_t downbeatFrame_ = 0;
  Action action_ = Action::None;
  int64_t actionTarget_ = 0;

  bool loop_ = false;
  int64_t loopStart_ = 0;
  int64_t loopEnd_ = 0;
  int64_t crossfade_ = 0;
  int64_t heardPasses_ = 0;

  std::vector<double> beats_;
  std::vector<uint8_t> downbeats_;
  bool metronome_ = false;
  float clickGain_ = 0.5f;
  std::vector<float> clickAccent_;
  std::vector<float> clickNormal_;
  std::vector<Voice> voices_;

  int64_t outputFrame_ = 0; // output frames rendered so far
  int64_t blockStart_ = 0;  // output frame of the last block's first frame
  std::array<Segment, 64> segments_{};
  int segmentCount_ = 0;
  std::array<Mark, 256> marks_{};
  int markCount_ = 0;
  int markHead_ = 0;

  std::array<std::vector<float>, 2> input_;
  std::array<std::vector<float>, 2> output_;
  std::vector<SplituneDspEvent> events_;
  std::vector<SplituneDspEvent> pending_; // from commands, reported with the next block
};

} // namespace splitune
