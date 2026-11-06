"""Item-level bootstrap intervals (step 27): resample the items of a tier with replacement and
recompute the tier's figure, either a mean of per-item values or a figure pooled from per-item
counts. Paired: two variants scored on the same items share every resample, so the interval of
their difference reflects item-to-item variation once, not twice."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

RESAMPLES = 2000
SEED = 27


@dataclass(frozen=True)
class Interval:
    value: float  # the figure on the items as they are
    low: float  # 2.5th percentile of the resampled figures
    high: float  # 97.5th percentile

    def excludes_zero(self) -> bool:
        return self.low > 0 or self.high < 0

    def text(self, signed: bool = False) -> str:
        if self.value != self.value:
            return "-"
        sign = "+" if signed else ""
        return f"{self.value:{sign}.3f} [{self.low:{sign}.3f}, {self.high:{sign}.3f}]"


Figure = Callable[[NDArray[np.float64]], float]  # per-item data (items by k) → the tier's figure


def mean_of(column: int = 0) -> Figure:
    return lambda data: float(np.mean(data[:, column]))


def pooled_f1(data: NDArray[np.float64]) -> float:
    """Tab F1 from per-item [ref, est, matched, tab_correct] counts summed over items."""
    ref, est, _, correct = data.sum(axis=0)
    return float(2 * correct / (ref + est)) if ref + est else float("nan")


def pooled_tdr(data: NDArray[np.float64]) -> float:
    _, _, matched, correct = data.sum(axis=0)
    return float(correct / matched) if matched else float("nan")


def interval(
    data: Sequence[Sequence[float]], figure: Figure, resamples: int = RESAMPLES
) -> Interval:
    array = np.asarray(data, dtype=np.float64)
    if array.ndim == 1:
        array = array[:, None]
    if len(array) == 0:
        return Interval(float("nan"), float("nan"), float("nan"))
    rng = np.random.default_rng(SEED)
    picks = rng.integers(0, len(array), size=(resamples, len(array)))
    values = np.array([figure(array[p]) for p in picks])
    low, high = np.nanpercentile(values, [2.5, 97.5])
    return Interval(figure(array), float(low), float(high))


def paired_difference(
    new: Sequence[Sequence[float]],
    old: Sequence[Sequence[float]],
    figure: Figure,
    resamples: int = RESAMPLES,
) -> Interval:
    """figure(new) - figure(old) over the same items (row i of both is item i)."""
    a = np.asarray(new, dtype=np.float64)
    b = np.asarray(old, dtype=np.float64)
    if a.ndim == 1:
        a, b = a[:, None], b[:, None]
    if len(a) != len(b):
        raise ValueError(f"paired bootstrap needs the same items: {len(a)} vs {len(b)}")
    if len(a) == 0:
        return Interval(float("nan"), float("nan"), float("nan"))
    rng = np.random.default_rng(SEED)
    picks = rng.integers(0, len(a), size=(resamples, len(a)))
    values = np.array([figure(a[p]) - figure(b[p]) for p in picks])
    low, high = np.nanpercentile(values, [2.5, 97.5])
    return Interval(figure(a) - figure(b), float(low), float(high))
