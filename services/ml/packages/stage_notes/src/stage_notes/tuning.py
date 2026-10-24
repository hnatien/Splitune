"""Recording tuning: the A4 offset (how far the whole recording sits from A440) and the guitar's
likely open-string tuning (07 §6.1, step 22 gap 4).

A4 offset: spectral peaks of the stem (80-1000 Hz, where guitar partials are close to harmonic),
each peak's deviation from the nearest equal-tempered semitone of A440 in cents, combined as a
magnitude-weighted circular mean over [-50, 50). The resultant length is the estimate's strength
(1 = every peak agrees). A recording a whole semitone off looks in tune: semitone-level tuning
(half step down, drop D) is `suggest_tuning`'s job.
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from typing import cast

import numpy as np
from numpy.typing import NDArray
from scipy.signal import (  # pyright: ignore[reportMissingTypeStubs]
    resample_poly,  # pyright: ignore[reportUnknownVariableType]
    stft,  # pyright: ignore[reportUnknownVariableType]
)

RATE = 44100
FFT_SIZE = 8192  # 5.4 Hz bins; peaks are refined by parabolic interpolation
HOP = 2048
LOW_HZ = 80.0
HIGH_HZ = 1000.0
PEAK_FLOOR_DB = -40.0  # peaks this far below the frame's strongest are ignored
PEAKS_PER_FRAME = 12


@dataclass(frozen=True)
class A4Offset:
    cents: float  # the recording's offset from A440, in [-50, 50)
    strength: float  # resultant length of the weighted deviations, 0-1


def a4_offset(mono: NDArray[np.float32]) -> A4Offset:
    spec = cast(
        NDArray[np.complex64],
        stft(mono, fs=RATE, nperseg=FFT_SIZE, noverlap=FFT_SIZE - HOP)[2],
    )
    mag = np.abs(spec).astype(np.float64)  # (bins, frames)
    bin_hz = RATE / FFT_SIZE
    lo, hi = int(LOW_HZ / bin_hz), int(HIGH_HZ / bin_hz) + 1
    band: NDArray[np.float64] = np.log(mag[lo - 1 : hi + 1] + 1e-12)  # one guard bin each side
    centre = band[1:-1]
    is_peak = (centre > band[:-2]) & (centre >= band[2:])
    floor = centre.max(axis=0, keepdims=True) + PEAK_FLOOR_DB / 20 * np.log(10)
    is_peak &= centre > floor
    x_sum = y_sum = weight_sum = 0.0
    for frame in range(centre.shape[1]):
        rows = np.flatnonzero(is_peak[:, frame])
        if rows.size == 0:
            continue
        rows = rows[np.argsort(centre[rows, frame])[-PEAKS_PER_FRAME:]]
        a, b, c = band[rows, frame], band[rows + 1, frame], band[rows + 2, frame]
        delta = 0.5 * (a - c) / np.where(np.abs(a - 2 * b + c) > 1e-12, a - 2 * b + c, 1e-12)
        hz = (lo + rows + np.clip(delta, -0.5, 0.5)) * bin_hz
        deviation = 1200 * np.log2(hz / 440.0)  # cents from A4
        angle: NDArray[np.float64] = 2 * np.pi * deviation / 100
        weight: NDArray[np.float64] = np.exp(b)
        x_sum += float(np.sum(weight * np.cos(angle)))
        y_sum += float(np.sum(weight * np.sin(angle)))
        weight_sum += float(np.sum(weight))
    if weight_sum == 0:
        return A4Offset(0.0, 0.0)
    cents = float(np.arctan2(y_sum, x_sum) * 100 / (2 * np.pi))
    strength = float(np.hypot(x_sum, y_sum) / weight_sum)
    return A4Offset(round(cents, 1), round(min(strength, 1.0), 3))


# Open-string tunings, string 1 (highest) first. Bass: 4 strings.
TUNINGS: dict[str, dict[str, tuple[int, ...]]] = {
    "guitar": {
        "standard": (64, 59, 55, 50, 45, 40),
        "half_step_down": (63, 58, 54, 49, 44, 39),
        "full_step_down": (62, 57, 53, 48, 43, 38),
        "drop_d": (64, 59, 55, 50, 45, 38),
        "drop_c_sharp": (63, 58, 54, 49, 44, 37),
        "drop_c": (62, 57, 53, 48, 43, 36),
    },
    "bass": {
        "standard": (43, 38, 33, 28),
        "half_step_down": (42, 37, 32, 27),
        "full_step_down": (41, 36, 31, 26),
        "drop_d": (43, 38, 33, 26),
    },
}


@dataclass(frozen=True)
class NoteLike:
    pitch_midi: int
    duration_s: float
    confidence: float


@dataclass(frozen=True)
class TuningSuggestion:
    name: str
    tuning_midi: tuple[int, ...]
    confidence: float


def suggest_tuning(
    notes: list[NoteLike],
    instrument: str,
    *,
    min_low_notes: int,
    min_confidence: float,
    min_duration_s: float,
) -> TuningSuggestion:
    """The open-string tuning the notes most likely come from. A down-tuned recording sounds like
    an in-tune one in another key, so the evidence is (1) sustained, confident notes below the
    standard tuning's lowest string, which standard tuning cannot play, and (2) which candidate's
    open strings the notes land on (open strings ring and are played often). Standard is the
    answer unless at least `min_low_notes` such low notes exist; confidence is the winner's share
    of the open-string evidence among the candidates that can play the lowest notes."""
    tunings = TUNINGS[instrument]
    standard = tunings["standard"]
    solid = [n for n in notes if n.confidence >= min_confidence and n.duration_s >= min_duration_s]
    low = [n for n in solid if n.pitch_midi < min(standard)]
    if len(low) < min_low_notes:
        return TuningSuggestion("standard", standard, 1.0 - len(low) / max(min_low_notes, 1))
    lowest = sorted(n.pitch_midi for n in low)[len(low) // 10]  # robust to a stray junk note
    scores: dict[str, float] = {}
    for name, tuning in tunings.items():
        if name == "standard" or min(tuning) > lowest:
            continue
        opens = set(tuning)
        scores[name] = sum(n.duration_s for n in solid if n.pitch_midi in opens) + 1e-6
    if not scores:
        return TuningSuggestion("standard", standard, 0.0)
    best = max(scores, key=lambda k: scores[k])
    return TuningSuggestion(best, tunings[best], round(scores[best] / sum(scores.values()), 3))


def retuned(mono: NDArray[np.float32], cents: float) -> tuple[NDArray[np.float32], float]:
    """`mono` lowered by `cents` at the same sample rate (tape-speed resampling, so it is also
    slower), and the stretch factor: a time t in the result is t / stretch in `mono`."""
    ratio = Fraction(2 ** (cents / 1200)).limit_denominator(4000)
    out = resample_poly(mono, ratio.numerator, ratio.denominator)  # pyright: ignore[reportUnknownVariableType]
    return np.asarray(out, dtype=np.float32), ratio.numerator / ratio.denominator
