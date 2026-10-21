"""Confidence calibration from P2 matches: isotonic regression (pool-adjacent-violators) to a
`CalibrationTable` knot list, and the reliability diagram / expected calibration error."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np


def fit_isotonic(raw: Sequence[float], correct: Sequence[int]) -> list[tuple[float, float]]:
    """Non-decreasing step fit of P(correct | raw), as knots (block mean raw, block precision).
    music-core and splitune_ml_core interpolate linearly between knots and clamp outside them."""
    order = np.argsort(np.asarray(raw, dtype=np.float64), kind="stable")
    xs = np.asarray(raw, dtype=np.float64)[order]
    ys = np.asarray(correct, dtype=np.float64)[order]
    blocks: list[list[float]] = []  # [sum_x, sum_y, count]
    for x, y in zip(xs.tolist(), ys.tolist(), strict=True):
        blocks.append([x, y, 1.0])
        while len(blocks) > 1 and blocks[-2][1] / blocks[-2][2] >= blocks[-1][1] / blocks[-1][2]:
            sx, sy, n = blocks.pop()
            blocks[-1][0] += sx
            blocks[-1][1] += sy
            blocks[-1][2] += n
    return [(round(sx / n, 6), round(sy / n, 6)) for sx, sy, n in blocks]


@dataclass(frozen=True)
class Reliability:
    edges: list[float]
    counts: list[int]
    confidence: list[float]  # mean predicted confidence per bin
    accuracy: list[float]  # observed precision per bin
    ece: float

    def table(self, before: Reliability | None = None) -> str:
        head = "| bin | notes | mean confidence | precision |" + (
            " raw: notes / mean / precision |" if before else ""
        )
        rows = [head, "|---|---|---|---|" + ("---|" if before else "")]
        for i, n in enumerate(self.counts):
            cell = (
                f"| {self.edges[i]:.1f}-{self.edges[i + 1]:.1f} | {n} | "
                f"{self.confidence[i]:.3f} | {self.accuracy[i]:.3f} |"
            )
            if before:
                cell += (
                    f" {before.counts[i]} / {before.confidence[i]:.3f} / {before.accuracy[i]:.3f} |"
                )
            rows.append(cell)
        return "\n".join(rows) + "\n"


def reliability(confidence: Sequence[float], correct: Sequence[int], bins: int = 10) -> Reliability:
    c = np.clip(np.asarray(confidence, dtype=np.float64), 0.0, 1.0)
    y = np.asarray(correct, dtype=np.float64)
    edges = np.linspace(0.0, 1.0, bins + 1)
    index = np.minimum((c * bins).astype(np.int64), bins - 1)
    counts: list[int] = []
    conf: list[float] = []
    acc: list[float] = []
    ece = 0.0
    for b in range(bins):
        mask = index == b
        n = int(mask.sum())
        counts.append(n)
        conf.append(float(c[mask].mean()) if n else 0.0)
        acc.append(float(y[mask].mean()) if n else 0.0)
        ece += n / max(len(c), 1) * abs(conf[-1] - acc[-1])
    return Reliability(edges.tolist(), counts, conf, acc, ece)
