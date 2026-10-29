"""Deterministic test audio: plucked harmonic tones (no file I/O, no randomness)."""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

# (onset s, duration s, MIDI pitch)
PHRASE: list[tuple[float, float, int]] = [
    (0.25, 0.7, 45),
    (1.0, 0.9, 52),
    (1.0, 0.9, 57),
    (2.0, 0.5, 60),
    (2.5, 0.5, 64),
    (3.1, 0.8, 40),
]


def pluck(pitch: int, duration: float, rate: int, cents: float = 0.0) -> NDArray[np.float64]:
    t = np.arange(int(duration * rate)) / rate
    f0 = 440.0 * 2 ** ((pitch - 69 + cents / 100) / 12)
    tone = sum(np.sin(2 * np.pi * f0 * h * t) / h for h in range(1, 6) if f0 * h < rate / 2)
    return np.asarray(tone * np.exp(-3.0 * t), dtype=np.float64)


def phrase(rate: int, length_s: float = 4.2, cents: float = 0.0) -> NDArray[np.float32]:
    """PHRASE with every pitch `cents` off A440 tuning."""
    out = np.zeros(int(length_s * rate))
    for onset, duration, pitch in PHRASE:
        start = int(onset * rate)
        tone = pluck(pitch, duration, rate, cents)
        out[start : start + len(tone)] += tone
    return (0.3 * out / np.max(np.abs(out))).astype(np.float32)
