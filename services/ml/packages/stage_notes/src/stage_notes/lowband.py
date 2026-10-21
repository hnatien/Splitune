"""Per-note low-band energy for bass octave correction (07 §3, music-core `correctBassOctaves`).

Share of the spectral energy at the f0 of `pitch - 12` among the energies at the f0s of `pitch` and
`pitch - 12`, over the note's first second: near 1 means the stem has a strong fundamental an
octave below the transcribed pitch (the tracker locked onto the 2nd harmonic), near 0 the opposite.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

RATE = 44100
MAX_SPAN_S = 1.0
FFT_SIZE = 1 << 16  # ~0.67 Hz bins: E0 (20.6 Hz) and E1 (41.2 Hz) are well apart
BAND_SEMITONES = 0.5


def midi_hz(pitch: float) -> float:
    return 440.0 * 2 ** ((pitch - 69) / 12)


def band_energy(power: NDArray[np.float64], hz: float) -> float:
    ratio = 2 ** (BAND_SEMITONES / 12)
    lo = int(np.floor(hz / ratio * FFT_SIZE / RATE))
    hi = int(np.ceil(hz * ratio * FFT_SIZE / RATE)) + 1
    return float(power[max(lo, 0) : hi].sum())


def low_band_energy(
    mono: NDArray[np.float32], onset_s: float, offset_s: float, pitch: int
) -> float:
    start = int(onset_s * RATE)
    end = min(len(mono), int(min(offset_s, onset_s + MAX_SPAN_S) * RATE))
    segment = mono[start:end].astype(np.float64)
    if len(segment) < 64:
        return 0.0
    spectrum = np.fft.rfft(segment * np.hanning(len(segment)), n=FFT_SIZE)
    power = np.abs(spectrum) ** 2
    below = band_energy(power, midi_hz(pitch - 12))
    at = band_energy(power, midi_hz(pitch))
    total = below + at
    return below / total if total > 0 else 0.0
