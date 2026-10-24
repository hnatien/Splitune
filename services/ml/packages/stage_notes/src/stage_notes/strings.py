"""Per-note string cue for the fret DP (07 §5, step 22 Phase 4): which string a transcribed note was
played on, from the audio.

The same pitch on different strings differs in its partials: a thicker string, or a shorter
vibrating length (a higher fret), is stiffer, so its upper partials sit further above k·f0
(inharmonicity), and the spectral envelope changes with the string's gauge and winding. Features
per note: for partials k = 1…PARTIALS over the note's first FRAMES STFT frames, the level relative
to the fundamental (dB) and the frequency deviation from k·f0 (cents), plus the pitch. A small
classifier (StringModel) turns them into a probability per string.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

RATE = 44100
FFT_SIZE = 4096
HOP = 512
FRAMES = 8  # ≈ 93 ms after the onset (the attack carries most of the string's character)
SKIP_FRAMES = 1  # the pick transient itself is broadband
PARTIALS = 16
SEARCH_CENTS = 60.0  # a partial is the strongest bin within this of k·f0 (stretched partials)
FEATURES = 2 * PARTIALS + 1


def midi_hz(pitch: float) -> float:
    return 440.0 * 2 ** ((pitch - 69) / 12)


def note_features(mono: NDArray[np.float32], onset_s: float, pitch: int) -> NDArray[np.float32]:
    """(FEATURES,) for one note; zeros where a partial is above Nyquist or the note is cut off."""
    start = int(onset_s * RATE) + SKIP_FRAMES * HOP
    frames: list[NDArray[np.float64]] = []
    window = np.hanning(FFT_SIZE)
    for k in range(FRAMES):
        segment = mono[start + k * HOP : start + k * HOP + FFT_SIZE]
        if len(segment) < FFT_SIZE:
            break
        frames.append(np.abs(np.fft.rfft(segment * window)))
    out = np.zeros(FEATURES, dtype=np.float32)
    out[-1] = (pitch - 60) / 24
    if not frames:
        return out
    mag = np.mean(frames, axis=0)
    f0 = midi_hz(pitch)
    bin_hz = RATE / FFT_SIZE
    levels = np.full(PARTIALS, np.nan)
    devs = np.zeros(PARTIALS)
    for k in range(1, PARTIALS + 1):
        target = k * f0
        lo = int(target * 2 ** (-SEARCH_CENTS / 1200) / bin_hz)
        hi = int(target * 2 ** (SEARCH_CENTS / 1200) / bin_hz) + 1
        if hi >= len(mag) - 1 or lo < 1:
            continue
        peak = lo + int(np.argmax(mag[lo : hi + 1]))
        a, b, c = np.log(mag[peak - 1 : peak + 2] + 1e-12)
        denom = a - 2 * b + c
        delta = 0.5 * (a - c) / denom if abs(denom) > 1e-12 else 0.0
        hz = (peak + float(np.clip(delta, -0.5, 0.5))) * bin_hz
        levels[k - 1] = 20 * b / np.log(10)
        devs[k - 1] = 1200 * np.log2(hz / target)
    if np.isnan(levels[0]):
        return out
    rel = np.nan_to_num(levels - levels[0], nan=-80.0)
    out[:PARTIALS] = np.clip(rel, -80, 20) / 40
    out[PARTIALS : 2 * PARTIALS] = devs / SEARCH_CENTS
    return out
