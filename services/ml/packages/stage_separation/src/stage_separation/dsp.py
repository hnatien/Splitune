"""Signal helpers for `stem_post`: alignment, frame energy and loudness (06 §4 stem_post)."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pyloudnorm  # pyright: ignore[reportMissingTypeStubs]
from numpy.typing import NDArray
from scipy.signal import correlate  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]

RATE = 44100
TARGET_LUFS = -14.0
SILENCE_LUFS = -70.0  # stands in for -inf (an empty stem) where the contract needs a number

Audio = NDArray[np.float32]  # [frames, 2]


def mono(audio: Audio) -> NDArray[np.float64]:
    return audio.astype(np.float64).mean(axis=1)


def first_sound(signal: NDArray[np.float64], threshold_db: float = -50.0, hop: int = 1024) -> int:
    """Start of the first 1024-sample block above `threshold_db` (dBFS RMS); 0 for silence."""
    blocks = len(signal) // hop
    if blocks == 0:
        return 0
    power = (signal[: blocks * hop].reshape(blocks, hop) ** 2).mean(axis=1)
    loud = np.flatnonzero(power > 10 ** (threshold_db / 10))
    return int(loud[0]) * hop if len(loud) else 0


def alignment_lag(
    mixture: Audio, stem: Audio, *, seconds: float = 30.0, max_lag: int = 2048
) -> int:
    """Samples to delay `stem` by so it lines up with the mixture: cross-correlation over the first
    `seconds` of non-silent audio, searched within ±max_lag. 0 when the stem is silent there."""
    mix, part = mono(mixture), mono(stem)
    start = first_sound(mix)
    length = min(int(seconds * RATE), len(part) - start)
    if length <= 0:
        return 0
    segment = part[start : start + length]
    if float(np.dot(segment, segment)) < 1e-9:
        return 0
    lo = start - max_lag
    window = np.pad(
        mix[max(0, lo) : start + length + max_lag],
        (max(0, -lo), max(0, start + length + max_lag - len(mix))),
    )
    scores: NDArray[np.float64] = np.asarray(
        correlate(window, segment, mode="valid", method="fft"),  # pyright: ignore[reportUnknownArgumentType]
        dtype=np.float64,
    )
    return int(np.argmax(scores)) - max_lag


def shift(audio: Audio, lag: int) -> Audio:
    """Delays (lag > 0) or advances (lag < 0) by |lag| samples, keeping the length."""
    if lag == 0:
        return audio
    out = np.zeros_like(audio)
    if lag > 0:
        out[lag:] = audio[:-lag]
    else:
        out[:lag] = audio[-lag:]
    return out


def energy(audio: Audio) -> float:
    return float((audio.astype(np.float64) ** 2).sum())


def loudness_lufs(audio: Audio) -> float | None:
    """Integrated loudness (BS.1770-4); None for silence."""
    meter = pyloudnorm.Meter(RATE)  # pyright: ignore[reportUnknownMemberType]
    value = float(meter.integrated_loudness(audio.astype(np.float64)))  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]
    return value if np.isfinite(value) else None


def frame_power(
    signal: NDArray[np.float64], starts: NDArray[np.int64], frame: int
) -> NDArray[np.float64]:
    """Mean power of signal[start:start + frame] for each start (cumulative sums, O(n))."""
    cumulative = np.concatenate([[0.0], np.cumsum(signal**2)])
    return (cumulative[starts + frame] - cumulative[starts]) / frame


@dataclass(frozen=True)
class Activity:
    spans: list[tuple[float, float, float]]  # (t0, t1, mean stem/mixture power ratio)
    active_fraction: float  # share of frames counted as active


def activity(
    stem: Audio,
    mixture: Audio,
    *,
    frame_s: float = 1.0,
    hop_s: float = 0.5,
    rel_db: float = -20.0,
    abs_db: float = -50.0,
    min_span_s: float = 1.0,
    gap_s: float = 1.0,
) -> Activity:
    """Frames where the stem is at least `rel_db` below the mixture's power and above `abs_db`
    dBFS count as active; active runs closer than `gap_s` merge, runs shorter than `min_span_s`
    are dropped."""
    frame, hop = int(frame_s * RATE), int(hop_s * RATE)
    s, m = mono(stem), mono(mixture)
    count = max(0, (len(s) - frame) // hop + 1)
    if count == 0:
        return Activity([], 0.0)
    starts = np.arange(count) * hop
    stem_power = frame_power(s, starts, frame)
    mix_power = frame_power(m, starts, frame)
    ratio = stem_power / np.maximum(mix_power, 1e-12)
    active = (stem_power > 10 ** (abs_db / 10)) & (ratio >= 10 ** (rel_db / 10))
    runs: list[list[int]] = []
    for i in np.flatnonzero(active):
        if runs and (i - runs[-1][1]) * hop_s <= gap_s:
            runs[-1][1] = int(i)
        else:
            runs.append([int(i), int(i)])
    spans: list[tuple[float, float, float]] = []
    for a, b in runs:
        t0, t1 = a * hop_s, min(b * hop_s + frame_s, len(s) / RATE)
        if t1 - t0 >= min_span_s:
            spans.append((round(t0, 3), round(t1, 3), round(float(ratio[a : b + 1].mean()), 4)))
    return Activity(spans, float(active.mean()))
