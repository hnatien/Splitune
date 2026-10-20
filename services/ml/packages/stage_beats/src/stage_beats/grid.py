"""Beat-grid post-processing on beat_this output: pure functions, no torch.

- Bar labels follow music-core `labelBeats` (packages/music-core/src/grid/beatgrid.ts): beats
  before the first downbeat form a pickup bar (-1); with a full bar or more of them, earlier
  downbeats are inferred every `beats_per_bar` beats.
- BPM = 60 / median inter-beat interval (06 §4).
- `tempo_octave_ambiguous`: double tempo is plausible when the activation half-way between beats
  is within `margin` of the activation on the beats; half or double tempo is also flagged when
  the tracked tempo sits outside `bpm_range`, where octave errors are most common.
"""

from __future__ import annotations

import itertools
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

FPS = 50  # beat_this frame rate


@dataclass(frozen=True)
class Labels:
    bars: list[int]
    beat_in_bar: list[int]
    is_downbeat: list[bool]


def modal_bar_length(is_downbeat: Sequence[bool], fallback: int = 4) -> int:
    """Most common number of beats between consecutive downbeats (smallest on ties)."""
    counts: Counter[int] = Counter()
    last = -1
    for i, down in enumerate(is_downbeat):
        if not down:
            continue
        if last >= 0:
            counts[i - last] += 1
        last = i
    if not counts:
        return fallback
    best = max(counts.values())
    return min(length for length, n in counts.items() if n == best)


def label_beats(is_downbeat: Sequence[bool], beats_per_bar: int) -> Labels:
    flags = list(is_downbeat)
    n = len(flags)
    first = flags.index(True) if True in flags else -1
    if first < 0:
        for i in range(0, n, beats_per_bar):
            flags[i] = True
        first = 0
    while first >= beats_per_bar:
        first -= beats_per_bar
        flags[first] = True
    bars: list[int] = []
    beat_in_bar: list[int] = []
    for i in range(first):
        bars.append(-1)
        beat_in_bar.append(beats_per_bar - first + i + 1)
    bar, beat = -1, 0
    for i in range(first, n):
        if flags[i]:
            bar += 1
            beat = 1
        else:
            beat += 1
        bars.append(bar)
        beat_in_bar.append(beat)
    return Labels(bars=bars, beat_in_bar=beat_in_bar, is_downbeat=flags)


def median_bpm(times: Sequence[float]) -> float:
    intervals = np.diff(np.asarray(times, dtype=np.float64))
    return float(60.0 / np.median(intervals))


def octave_ambiguous(
    activation: NDArray[np.float32],
    beat_frames: Sequence[int],
    bpm: float,
    *,
    margin: float,
    bpm_range: tuple[float, float],
) -> bool:
    if not bpm_range[0] <= bpm < bpm_range[1]:
        return True
    on: list[float] = []
    mid: list[float] = []
    for a, b in itertools.pairwise(beat_frames):
        lo, hi = a + int(0.35 * (b - a)), a + int(np.ceil(0.65 * (b - a)))
        if hi <= lo:
            continue
        on.append(float(activation[a]))
        mid.append(float(activation[lo:hi].max()))
    if not on:
        return False
    return float(np.median(mid)) >= margin * float(np.median(on))


def bpm_curve(
    times: Sequence[float], labels: Labels, spread: float
) -> list[tuple[float, float]] | None:
    """(downbeat time, bar BPM) per bar, only when the bar tempo drifts by more than `spread`
    (relative p10-p90 range), e.g. live takes without a click."""
    t = np.asarray(times, dtype=np.float64)
    curve: list[tuple[float, float]] = []
    starts = [i for i, down in enumerate(labels.is_downbeat) if down]
    for s, e in zip(starts, [*starts[1:], len(t) - 1], strict=False):
        if e - s < 1:
            continue
        curve.append(
            (round(float(t[s]), 4), round(float(60.0 / np.median(np.diff(t[s : e + 1]))), 2))
        )
    if len(curve) < 4:
        return None
    tempos = np.array([b for _, b in curve])
    p10, p50, p90 = np.percentile(tempos, [10, 50, 90])
    return curve if (p90 - p10) / p50 > spread else None
