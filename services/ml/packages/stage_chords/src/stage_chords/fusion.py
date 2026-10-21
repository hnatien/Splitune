"""Chord vocabularies, beat-synchronous fusion and smoothing (06 §4 chords).

Every recognizer reports per-frame probabilities over one of two shared vocabularies:
`majmin` (N + 12 maj + 12 min) or `sevenths` (N + 12 x maj, min, 7, maj7, min7). Per beat the
frame log-probabilities are averaged, the inputs (mixture, no-drums stem) are averaged in the log
domain, a bass-root prior from the bass stem's low-register chroma is added, and a Viterbi pass
with a chord-change penalty picks one label per beat. Consecutive beats with the same label form a
segment whose confidence is the mean fused posterior of that label.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
from numpy.typing import NDArray

Vocabulary = Literal["majmin", "sevenths"]
PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
QUALITIES: dict[Vocabulary, list[str]] = {
    "majmin": ["maj", "min"],
    "sevenths": ["maj", "min", "7", "maj7", "min7"],
}
INTERVALS = {
    "maj": (0, 4, 7),
    "min": (0, 3, 7),
    "7": (0, 4, 7, 10),
    "maj7": (0, 4, 7, 11),
    "min7": (0, 3, 7, 10),
}
# Native qualities of the recognizers → the closest sevenths quality (N for "unknown").
TO_SEVENTHS = {
    "maj": "maj",
    "min": "min",
    "dim": "min",
    "aug": "maj",
    "min6": "min",
    "maj6": "maj",
    "min7": "min7",
    "minmaj7": "min",
    "maj7": "maj7",
    "7": "7",
    "dim7": "min",
    "hdim7": "min7",
    "sus2": "maj",
    "sus4": "maj",
}
TO_MAJMIN = {"maj": "maj", "min": "min", "7": "maj", "maj7": "maj", "min7": "min"}
EPS = 1e-9

Float = NDArray[np.float64]


def labels(vocabulary: Vocabulary) -> list[str]:
    """Index 0 = N, then root-major order: C:maj, C:min, (C:7, C:maj7, C:min7), C#:maj, …"""
    return ["N"] + [f"{r}:{q}" for r in PITCH_CLASSES for q in QUALITIES[vocabulary]]


def index_of(vocabulary: Vocabulary, root: int, quality: str) -> int:
    q = TO_SEVENTHS[quality]
    if vocabulary == "majmin":
        q = TO_MAJMIN[q]
    return 1 + root * len(QUALITIES[vocabulary]) + QUALITIES[vocabulary].index(q)


def roots(vocabulary: Vocabulary) -> NDArray[np.int64]:
    """Root pitch class per vocabulary entry (-1 for N)."""
    per_root = len(QUALITIES[vocabulary])
    return np.array([-1] + [r for r in range(12) for _ in range(per_root)], dtype=np.int64)


def templates(vocabulary: Vocabulary) -> NDArray[np.bool_]:
    """(entries, 12) chord-tone membership; N has none."""
    out = np.zeros((len(labels(vocabulary)), 12), dtype=np.bool_)
    for r in range(12):
        for q in QUALITIES[vocabulary]:
            for interval in INTERVALS[q]:
                out[index_of(vocabulary, r, q), (r + interval) % 12] = True
    return out


def log_normalize(logp: Float) -> Float:
    m = np.max(logp, axis=-1, keepdims=True)
    return logp - (m + np.log(np.sum(np.exp(logp - m), axis=-1, keepdims=True)))


@dataclass(frozen=True)
class FrameProbs:
    times: Float  # frame centres in seconds on the decoded-PCM timeline
    probs: Float  # (frames, entries) over the vocabulary


def intervals(beat_times: Float, duration: float) -> Float:
    """[t0, t1) per beat, plus the stretch before the first and after the last beat."""
    edges = np.unique(np.clip(np.concatenate([[0.0], beat_times, [duration]]), 0.0, duration))
    return np.stack([edges[:-1], edges[1:]], axis=1)


def beat_sync(frames: FrameProbs, spans: Float) -> Float:
    """Mean frame log-probability per span (the nearest frame when a span holds none)."""
    logp = np.log(frames.probs + EPS)
    out = np.empty((len(spans), logp.shape[1]))
    for i, (t0, t1) in enumerate(spans):
        inside = (frames.times >= t0) & (frames.times < t1)
        if inside.any():
            out[i] = logp[inside].mean(axis=0)
        else:
            out[i] = logp[int(np.argmin(np.abs(frames.times - (t0 + t1) / 2)))]
    return log_normalize(out)


def bass_prior(chroma: Float, vocabulary: Vocabulary, weight: float, floor: float = 0.05) -> Float:
    """(spans, entries) log prior from the bass stem's per-span pitch-class distribution: chords
    whose root the bass plays are favoured; N and silent spans stay neutral."""
    root_of = roots(vocabulary)
    total = chroma.sum(axis=1, keepdims=True)
    dist = np.where(total > 0, chroma / np.maximum(total, EPS), 1.0 / 12)
    dist = (1 - floor) * dist + floor / 12
    prior = np.empty((len(chroma), len(root_of)))
    prior[:, 0] = np.log(1.0 / 12)
    prior[:, 1:] = np.log(dist[:, root_of[1:]])
    return weight * (prior - np.log(1.0 / 12))


def viterbi(logp: Float, change_penalty: float) -> NDArray[np.int64]:
    """Best label per span with a constant log-penalty for every chord change."""
    n, k = logp.shape
    score: Float = logp[0].astype(np.float64)
    back = np.zeros((n, k), dtype=np.int64)
    for t in range(1, n):
        best = int(np.argmax(score))
        switch = float(score[best]) - change_penalty
        stay: NDArray[np.bool_] = score >= switch
        back[t] = np.where(stay, np.arange(k, dtype=np.int64), best)
        score = np.where(stay, score, switch).astype(np.float64) + logp[t]
    path = np.empty(n, dtype=np.int64)
    path[-1] = int(np.argmax(score))
    for t in range(n - 1, 0, -1):
        path[t - 1] = back[t, path[t]]
    return path


@dataclass(frozen=True)
class Segment:
    t0: float
    t1: float
    label: str
    confidence: float  # mean fused posterior of the label over the segment's spans
    top_k: list[tuple[str, float]]


def segments(
    spans: Float, posterior: Float, path: NDArray[np.int64], vocabulary: Vocabulary, k: int = 5
) -> list[Segment]:
    names = labels(vocabulary)
    out: list[Segment] = []
    start = 0
    for i in range(1, len(path) + 1):
        if i < len(path) and path[i] == path[start]:
            continue
        mean = posterior[start:i].mean(axis=0)
        order = np.argsort(-mean)[:k]
        out.append(
            Segment(
                t0=float(spans[start, 0]),
                t1=float(spans[i - 1, 1]),
                label=names[int(path[start])],
                confidence=float(mean[int(path[start])]),
                top_k=[(names[int(j)], float(mean[int(j)])) for j in order],
            )
        )
        start = i
    return out
