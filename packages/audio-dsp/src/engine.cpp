#include "engine.hpp"

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <limits>

namespace splitune {

namespace {

constexpr double kPi = 3.14159265358979323846;
constexpr double kMinRate = 0.25;
constexpr double kMaxRate = 2.0;
constexpr double kGainTimeConstant = 0.010; // one-pole gain smoothing (§2)
constexpr double kLoopCrossfade = 0.008;    // equal-power seam crossfade (§2)
constexpr double kClickLength = 0.020;      // count-in and metronome clicks (§2)
constexpr double kBeatTolerance = 0.010;    // a loop start this close after a beat starts on it
constexpr double kFallbackBeatPeriod = 0.5; // 120 BPM in 4/4 when there is no beat grid
constexpr int kFallbackBeatsPerBar = 4;
constexpr int kEndFade = 64;
constexpr size_t kMaxVoices = 256;

// A 20 ms sine click: 0.5 ms raised-cosine attack, 5 ms exponential decay, 2 ms tail fade.
std::vector<float> makeClick(double sampleRate, double frequency, double amplitude) {
  const int length = static_cast<int>(std::lround(kClickLength * sampleRate));
  const double attack = 0.0005 * sampleRate;
  const double tail = 0.002 * sampleRate;
  std::vector<float> click(static_cast<size_t>(length));
  for (int i = 0; i < length; ++i) {
    double envelope = std::exp(-i / (0.005 * sampleRate));
    if (i < attack) envelope *= 0.5 - 0.5 * std::cos(kPi * i / attack);
    if (i > length - tail) envelope *= 0.5 - 0.5 * std::cos(kPi * (length - i) / tail);
    click[static_cast<size_t>(i)] =
        static_cast<float>(amplitude * envelope * std::sin(2 * kPi * frequency * i / sampleRate));
  }
  return click;
}

} // namespace

Engine::Engine(double sampleRate, uint32_t seed)
    : sampleRate_(sampleRate), stretch_(static_cast<long>(seed)),
      gainCoeff_(static_cast<float>(1 - std::exp(-1 / (kGainTimeConstant * sampleRate)))) {
  clickAccent_ = makeClick(sampleRate, 1760, 1.0);
  clickNormal_ = makeClick(sampleRate, 1320, 0.7);
  voices_.reserve(kMaxVoices);
  events_.reserve(kMaxVoices);
  pending_.reserve(8);
  for (auto &channel : output_) channel.assign(SPLITUNE_DSP_MAX_BLOCK, 0);
  configure();
}

void Engine::configure() {
  if (quality_ == DSP_QUALITY_CHEAPER) {
    stretch_.presetCheaper(2, static_cast<float>(sampleRate_), true);
  } else {
    stretch_.presetDefault(2, static_cast<float>(sampleRate_), false);
  }
  // Room for an aligned start at the fastest rate and for one block at the fastest rate.
  const size_t capacity = static_cast<size_t>(
      stretch_.inputLatency() + kMaxRate * stretch_.outputLatency() +
      kMaxRate * SPLITUNE_DSP_MAX_BLOCK + 4);
  for (auto &channel : input_) channel.assign(capacity, 0);
}

Engine::~Engine() {
  for (auto &stem : stems_) std::free(stem.pcm);
}

int16_t *Engine::allocStem(int stem, int32_t frames) {
  if (stem < 0 || stem >= SPLITUNE_DSP_MAX_STEMS || frames <= 0) return nullptr;
  clearStem(stem);
  auto &slot = stems_[static_cast<size_t>(stem)];
  slot.pcm = static_cast<int16_t *>(std::calloc(static_cast<size_t>(frames) * 2, sizeof(int16_t)));
  if (slot.pcm == nullptr) return nullptr;
  slot.frames = frames;
  duration_ = std::max<int64_t>(duration_, frames);
  return slot.pcm;
}

void Engine::clearStem(int stem) {
  if (stem < 0 || stem >= SPLITUNE_DSP_MAX_STEMS) return;
  auto &slot = stems_[static_cast<size_t>(stem)];
  std::free(slot.pcm);
  slot.pcm = nullptr;
  slot.frames = 0;
  duration_ = 0;
  for (const auto &s : stems_) duration_ = std::max(duration_, s.frames);
}

void Engine::setGain(int stem, float gain) {
  if (stem < 0 || stem >= SPLITUNE_DSP_MAX_STEMS || !std::isfinite(gain)) return;
  stems_[static_cast<size_t>(stem)].target = std::max(0.0f, gain);
}

void Engine::setRate(double rate) {
  if (!std::isfinite(rate)) return;
  rate_ = std::clamp(rate, kMinRate, kMaxRate);
}

void Engine::setTranspose(float semitones, float tonalityLimitHz) {
  if (!std::isfinite(semitones)) return;
  if (semitones == 0) {
    stretch_.setTransposeFactor(1);
  } else {
    const float limit = tonalityLimitHz > 0 ? tonalityLimitHz / static_cast<float>(sampleRate_) : 0;
    stretch_.setTransposeSemitones(semitones, limit);
  }
}

void Engine::setLoop(bool enabled, int64_t start, int64_t end) {
  if (!enabled || start < 0 || end <= start) {
    loop_ = false;
    return;
  }
  loop_ = true;
  loopStart_ = start;
  loopEnd_ = end;
  crossfade_ = std::max<int64_t>(
      1, std::min<int64_t>(std::llround(kLoopCrossfade * sampleRate_), (end - start) / 4));
}

void Engine::setBeats(const double *frames, const uint8_t *downbeats, int count) {
  beats_.clear();
  downbeats_.clear();
  if (count <= 0 || frames == nullptr) return;
  beats_.assign(frames, frames + count);
  if (downbeats != nullptr) {
    downbeats_.assign(downbeats, downbeats + count);
  } else {
    downbeats_.assign(static_cast<size_t>(count), 0);
  }
}

void Engine::setQuality(int quality) {
  const int next = quality == DSP_QUALITY_CHEAPER ? DSP_QUALITY_CHEAPER : DSP_QUALITY_DEFAULT;
  if (next == quality_) return;
  quality_ = next;
  if (transport_ == DSP_PLAYING) {
    action_ = Action::Reconfigure;
  } else {
    configure();
  }
}

void Engine::play(int countInBars) {
  if (transport_ != DSP_STOPPED || duration_ == 0) return;
  if (countInBars <= 0) {
    alignedStart(startPosition_, outputFrame_);
    transport_ = DSP_PLAYING;
    pending_.push_back({DSP_EVENT_STARTED, 0, 0, 0, static_cast<double>(startPosition_)});
    return;
  }
  double period;
  int beatsPerBar;
  upcomingTempo(startPosition_, period, beatsPerBar);
  const double outputPeriod = period / rate_;
  const int clicks = std::min<int>(countInBars * beatsPerBar, static_cast<int>(kMaxVoices / 2));
  for (int k = 0; k < clicks; ++k) {
    voices_.push_back({outputFrame_ + std::llround(k * outputPeriod), k % beatsPerBar == 0, k});
  }
  downbeatFrame_ = outputFrame_ + std::llround(clicks * outputPeriod);
  transport_ = DSP_COUNT_IN;
}

void Engine::pause() {
  if (transport_ == DSP_COUNT_IN) {
    clearCountIn();
    transport_ = DSP_STOPPED;
    pending_.push_back({DSP_EVENT_STOPPED, 0, 0, 0, static_cast<double>(startPosition_)});
  } else if (transport_ == DSP_PLAYING) {
    action_ = Action::Pause;
  }
}

void Engine::seek(int64_t frame) {
  frame = std::clamp<int64_t>(frame, 0, duration_);
  if (transport_ == DSP_PLAYING) {
    action_ = Action::Seek;
    actionTarget_ = frame;
  } else {
    startPosition_ = frame;
  }
}

void Engine::clearCountIn() {
  voices_.erase(std::remove_if(voices_.begin(), voices_.end(),
                               [](const Voice &v) { return v.countIn >= 0; }),
                voices_.end());
}

double Engine::latency() const {
  return stretch_.inputLatency() + stretch_.outputLatency() * rate_;
}

// Resets the stretcher with outputSeek() so that the first output frame at `frame` is exactly
// `position`, with the library's reflected pre-roll instead of a start-up transient.
void Engine::alignedStart(int64_t position, int64_t frame) {
  const int length = stretch_.outputSeekLength(static_cast<float>(rate_));
  readPosition_ = position;
  inputCounter_ = 0;
  carry_ = 0;
  segmentCount_ = 0;
  pushSegment(0, static_cast<double>(position), false);
  for (auto &stem : stems_) stem.gain = stem.target;
  read(length);
  stretch_.outputSeek(input_, length);
  inputCounter_ = length;
  markCount_ = 0;
  const double processing = length - stretch_.inputLatency();
  pushMark(frame - stretch_.outputLatency(), processing - stretch_.outputLatency() * rate_);
  pushMark(frame, processing);
  playingFrom_ = frame;
}

void Engine::mixAt(int64_t position, float gainScale, float &left, float &right) const {
  if (position < 0) return;
  for (const auto &stem : stems_) {
    if (position >= stem.frames) continue;
    const float gain = stem.gain * gainScale * (1.0f / 32768.0f);
    const size_t index = static_cast<size_t>(position) * 2;
    left += stem.pcm[index] * gain;
    right += stem.pcm[index + 1] * gain;
  }
}

// Reads `frames` mixed input frames into input_, wrapping at the loop end. The last crossfade_
// frames before the loop end fade into the frames just before the loop start, so the frame
// after the wrap continues the faded-in audio and the stretcher sees one continuous signal.
void Engine::read(int frames) {
  for (int i = 0; i < frames; ++i) {
    if (loop_ && readPosition_ == loopEnd_) {
      readPosition_ = loopStart_;
      pushSegment(static_cast<double>(inputCounter_ + i), static_cast<double>(loopStart_), true);
    }
    for (auto &stem : stems_) stem.gain += (stem.target - stem.gain) * gainCoeff_;
    float left = 0, right = 0;
    const int64_t fadeStart = loopEnd_ - crossfade_;
    if (loop_ && readPosition_ >= fadeStart && readPosition_ < loopEnd_ &&
        readPosition_ >= loopStart_) {
      const double t = (static_cast<double>(readPosition_ - fadeStart) + 0.5) / crossfade_;
      mixAt(readPosition_, static_cast<float>(std::cos(t * kPi / 2)), left, right);
      mixAt(readPosition_ - (loopEnd_ - loopStart_), static_cast<float>(std::sin(t * kPi / 2)),
            left, right);
    } else {
      mixAt(readPosition_, 1.0f, left, right);
    }
    input_[0][static_cast<size_t>(i)] = left;
    input_[1][static_cast<size_t>(i)] = right;
    ++readPosition_;
  }
}

void Engine::process(int frames) {
  frames = std::clamp(frames, 0, SPLITUNE_DSP_MAX_BLOCK);
  events_.assign(pending_.begin(), pending_.end());
  pending_.clear();
  for (auto &channel : output_) std::fill(channel.begin(), channel.begin() + frames, 0.0f);
  blockStart_ = outputFrame_;

  int done = 0;
  if (transport_ == DSP_COUNT_IN) {
    const int64_t untilDownbeat = downbeatFrame_ - outputFrame_;
    if (untilDownbeat < frames) {
      done = static_cast<int>(std::max<int64_t>(0, untilDownbeat));
      alignedStart(startPosition_, outputFrame_ + done);
      transport_ = DSP_PLAYING;
      emit(DSP_EVENT_STARTED, done, true, static_cast<double>(startPosition_));
    } else {
      done = frames;
    }
  }
  if (transport_ == DSP_PLAYING && done < frames) renderPlaying(done, frames - done);
  renderClicks(frames);
  outputFrame_ += frames;
}

void Engine::renderPlaying(int offset, int frames) {
  const int64_t from = blockStart_ + offset;
  const Action action = action_;
  action_ = Action::None;

  const double wanted = rate_ * frames + carry_;
  const int inputFrames = static_cast<int>(wanted);
  carry_ = wanted - inputFrames;
  read(inputFrames);

  struct Channels {
    std::array<std::vector<float>, 2> &buffers;
    int offset;
    float *operator[](int c) { return buffers[static_cast<size_t>(c)].data() + offset; }
  } out{output_, offset};
  stretch_.process(input_, inputFrames, out, frames);
  inputCounter_ += inputFrames;
  pushMark(from + frames, static_cast<double>(inputCounter_ - stretch_.inputLatency()));

  const double fromCounter = processingAt(from - stretch_.outputLatency());
  const double toCounter = processingAt(from + frames - stretch_.outputLatency());
  scanHeard(offset, frames, fromCounter, toCounter);
  if (transport_ != DSP_PLAYING) return; // ended inside this block

  if (action == Action::None) return;
  // A pause, seek or preset change fades this block out (raised cosine) before it takes effect.
  for (int i = 0; i < frames; ++i) {
    const float fade = static_cast<float>(0.5 + 0.5 * std::cos(kPi * (i + 1) / frames));
    output_[0][static_cast<size_t>(offset + i)] *= fade;
    output_[1][static_cast<size_t>(offset + i)] *= fade;
  }
  const int64_t heardEnd = std::clamp<int64_t>(std::llround(sourceAt(toCounter)), 0, duration_);
  if (action == Action::Pause) {
    startPosition_ = heardEnd;
    transport_ = DSP_STOPPED;
    emit(DSP_EVENT_STOPPED, offset + frames - 1, false, static_cast<double>(heardEnd));
  } else {
    if (action == Action::Reconfigure) configure();
    startPosition_ = action == Action::Seek ? actionTarget_ : heardEnd;
    alignedStart(startPosition_, from + frames);
    pending_.push_back({DSP_EVENT_STARTED, 0, 0, 0, static_cast<double>(startPosition_)});
  }
}

// Emits the events heard in this block: loop wraps, beats (plus metronome clicks) and the end.
void Engine::scanHeard(int offset, int frames, double fromCounter, double toCounter) {
  if (toCounter <= fromCounter) return;
  const double span = toCounter - fromCounter;
  auto offsetOf = [&](double counter) {
    const int i = static_cast<int>(std::floor((counter - fromCounter) / span * frames));
    return offset + std::clamp(i, 0, frames - 1);
  };
  const bool loopHoldsEnd = loop_ && loopStart_ < duration_ && duration_ <= loopEnd_;

  for (int k = 0; k < segmentCount_; ++k) {
    const Segment &segment = segments_[static_cast<size_t>(k)];
    const double segmentStart = k == 0 ? std::numeric_limits<double>::lowest() : segment.counter;
    const double segmentEnd = k + 1 < segmentCount_ ? segments_[static_cast<size_t>(k + 1)].counter
                                                    : std::numeric_limits<double>::max();
    const double lo = std::max(fromCounter, segmentStart);
    const double hi = std::min(toCounter, segmentEnd);
    if (lo >= hi) continue;

    if (segment.wrap && segment.counter >= fromCounter) {
      ++heardPasses_;
      emit(DSP_EVENT_LOOP_WRAP, offsetOf(segment.counter), true, static_cast<double>(heardPasses_));
    }
    const double sourceLo = segment.source + (lo - segment.counter);
    const double sourceHi = segment.source + (hi - segment.counter);
    auto beat = std::lower_bound(beats_.begin(), beats_.end(), sourceLo);
    for (; beat != beats_.end() && *beat < sourceHi; ++beat) {
      const size_t index = static_cast<size_t>(beat - beats_.begin());
      const bool accent = downbeats_[index] != 0;
      const int at = offsetOf(segment.counter + (*beat - segment.source));
      emit(DSP_EVENT_BEAT, at, accent, static_cast<double>(index));
      if (metronome_ && voices_.size() < kMaxVoices) voices_.push_back({blockStart_ + at, accent, -1});
    }
    const double end = static_cast<double>(duration_);
    if (!loopHoldsEnd && sourceLo <= end && end < sourceHi) {
      const int at = offsetOf(segment.counter + (end - segment.source));
      for (int i = at; i < offset + frames; ++i) {
        const float fade = i - at < kEndFade ? 1.0f - static_cast<float>(i - at) / kEndFade : 0.0f;
        output_[0][static_cast<size_t>(i)] *= fade;
        output_[1][static_cast<size_t>(i)] *= fade;
      }
      startPosition_ = duration_;
      transport_ = DSP_STOPPED;
      action_ = Action::None;
      emit(DSP_EVENT_ENDED, at, false, end);
      return;
    }
  }
}

void Engine::renderClicks(int frames) {
  const auto length = static_cast<int64_t>(clickAccent_.size());
  for (auto &voice : voices_) {
    const int64_t start = voice.start - blockStart_;
    if (start >= frames) continue;
    if (voice.countIn >= 0 && start >= 0) {
      emit(DSP_EVENT_COUNT_IN_BEAT, static_cast<int>(start), voice.accent, voice.countIn);
    }
    const auto &click = voice.accent ? clickAccent_ : clickNormal_;
    const int64_t first = std::max<int64_t>(0, start);
    const int64_t last = std::min<int64_t>(frames, start + length);
    for (int64_t i = first; i < last; ++i) {
      const float sample = click[static_cast<size_t>(i - start)] * clickGain_;
      output_[0][static_cast<size_t>(i)] += sample;
      output_[1][static_cast<size_t>(i)] += sample;
    }
  }
  voices_.erase(std::remove_if(voices_.begin(), voices_.end(),
                               [&](const Voice &v) { return v.start + length <= blockStart_ + frames; }),
                voices_.end());
}

void Engine::emit(int type, int offset, bool accent, double value) {
  events_.push_back({type, offset, accent ? 1 : 0, 0, value});
}

void Engine::pushSegment(double counter, double source, bool wrap) {
  if (segmentCount_ == static_cast<int>(segments_.size())) {
    std::move(segments_.begin() + 1, segments_.end(), segments_.begin());
    --segmentCount_;
  }
  segments_[static_cast<size_t>(segmentCount_++)] = {counter, source, wrap};
}

void Engine::pushMark(int64_t frame, double processing) {
  marks_[static_cast<size_t>(markHead_)] = {frame, processing};
  markHead_ = (markHead_ + 1) % static_cast<int>(marks_.size());
  markCount_ = std::min(markCount_ + 1, static_cast<int>(marks_.size()));
}

// Processing time at an output frame: interpolated between marks, extrapolated at the current
// rate past either end.
double Engine::processingAt(int64_t frame) const {
  const int size = static_cast<int>(marks_.size());
  auto mark = [&](int age) -> const Mark & {
    return marks_[static_cast<size_t>((markHead_ - 1 - age + size) % size)];
  };
  if (markCount_ == 0) return 0;
  const Mark &newest = mark(0);
  if (frame >= newest.frame) return newest.processing + (frame - newest.frame) * rate_;
  for (int age = 1; age < markCount_; ++age) {
    const Mark &older = mark(age);
    if (older.frame <= frame) {
      const Mark &newer = mark(age - 1);
      const double t = static_cast<double>(frame - older.frame) / (newer.frame - older.frame);
      return older.processing + t * (newer.processing - older.processing);
    }
  }
  const Mark &oldest = mark(markCount_ - 1);
  return oldest.processing - (oldest.frame - frame) * rate_;
}

double Engine::sourceAt(double counter) const {
  for (int k = segmentCount_ - 1; k >= 0; --k) {
    const Segment &segment = segments_[static_cast<size_t>(k)];
    if (segment.counter <= counter || k == 0) return segment.source + (counter - segment.counter);
  }
  return static_cast<double>(startPosition_);
}

double Engine::heard(int offset) const {
  const int64_t frame = blockStart_ + offset;
  if (transport_ != DSP_PLAYING || frame < playingFrom_) return static_cast<double>(startPosition_);
  return sourceAt(processingAt(frame - stretch_.outputLatency()));
}

// Beat period and bar length at a position, from the next few beats of the grid.
void Engine::upcomingTempo(int64_t position, double &period, int &beatsPerBar) const {
  period = kFallbackBeatPeriod * sampleRate_;
  beatsPerBar = kFallbackBeatsPerBar;
  const size_t count = beats_.size();
  if (count < 2) return;
  const double from = static_cast<double>(position) - kBeatTolerance * sampleRate_;
  size_t first = static_cast<size_t>(std::lower_bound(beats_.begin(), beats_.end(), from) - beats_.begin());
  first = std::min(first, count - 2);
  const size_t last = std::min(first + 4, count - 1);
  period = (beats_[last] - beats_[first]) / static_cast<double>(last - first);

  // The bar holding the start: its downbeat (at or before `first`, else the next one) and the
  // following downbeat.
  size_t bar = count;
  for (size_t i = first + 1; i-- > 0;) {
    if (downbeats_[i] != 0) {
      bar = i;
      break;
    }
  }
  if (bar == count) {
    for (size_t i = first; i < count; ++i) {
      if (downbeats_[i] != 0) {
        bar = i;
        break;
      }
    }
  }
  for (size_t i = bar + 1; i < count; ++i) {
    if (downbeats_[i] != 0) {
      beatsPerBar = std::clamp(static_cast<int>(i - bar), 1, 16);
      return;
    }
  }
}

} // namespace splitune
