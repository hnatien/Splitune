"""Separation metrics ported from Music-Source-Separation-Training (MSST, ZFTurbo),
`utils/metrics.py` at commit 84b1eac0887756b4f1a9d7a1ff49105939749ed2 (2026-09-26), MIT licence
(https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/LICENSE,
Copyright (c) 2024 Roman Solovyev (ZFTurbo)).

The port is numpy-only and keeps MSST's exact formulae, including their quirks, so numbers compare
with MVSep's leaderboards: `si_sdr` adds its epsilon per sample inside the sums and rescales the
reference (not the estimate); `bleed_full` measures the dB difference of 512-band mel magnitude
spectrograms (Hann STFT 4096/1024, zero-padded, centred; librosa's Slaney mel filterbank applied
to magnitudes; torchaudio `AmplitudeToDB` with an 80 dB floor below the loudest bin of all
channels). Every metric covers the whole signal. Arrays here are [frames, channels] (Splitune's
layout) and are transposed to MSST's [channels, frames] internally.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

Array = NDArray[np.float64]

MSST_COMMIT = "84b1eac"


def _cs(audio: Array) -> Array:
    """[frames, channels] → [channels, frames] (a mono 1-D array becomes one channel)."""
    data = np.asarray(audio, dtype=np.float64)
    return data[None, :] if data.ndim == 1 else data.T


def sdr(reference: Array, estimate: Array) -> float:
    """MSST `sdr`: 10·log10((Σref² + ε) / (Σ(ref - est)² + ε)) over channels and samples,
    ε = 1e-8."""
    ref, est = _cs(reference), _cs(estimate)
    eps = 1e-8
    num = float(np.sum(np.square(ref))) + eps
    den = float(np.sum(np.square(ref - est))) + eps
    return 10.0 * float(np.log10(num / den))


def si_sdr(reference: Array, estimate: Array) -> float:
    """MSST `si_sdr` verbatim: the reference is scaled by Σ(est·ref + ε) / Σ(ref² + ε)."""
    ref, est = _cs(reference), _cs(estimate)
    eps = 1e-8
    scale = np.sum(est * ref + eps) / np.sum(ref**2 + eps)
    ref = ref * scale
    ratio = np.sum(ref**2) / (np.sum((ref - est) ** 2) + eps) + eps
    return float(10.0 * np.log10(ratio))


def _hz_to_mel(hz: Array) -> Array:
    """librosa `hz_to_mel(htk=False)` (Slaney): linear below 1 kHz, logarithmic above."""
    f_sp = 200.0 / 3
    mels = hz / f_sp
    min_log_hz = 1000.0
    min_log_mel = min_log_hz / f_sp
    logstep = np.log(6.4) / 27.0
    above = hz >= min_log_hz
    mels[above] = min_log_mel + np.log(hz[above] / min_log_hz) / logstep
    return mels


def _mel_to_hz(mels: Array) -> Array:
    f_sp = 200.0 / 3
    hz = f_sp * mels
    min_log_hz = 1000.0
    min_log_mel = min_log_hz / f_sp
    logstep = np.log(6.4) / 27.0
    above = mels >= min_log_mel
    hz[above] = min_log_hz * np.exp(logstep * (mels[above] - min_log_mel))
    return hz


def mel_filterbank(sr: int, n_fft: int, n_mels: int) -> Array:
    """librosa `filters.mel(sr=sr, n_fft=n_fft, n_mels=n_mels)` defaults: fmin 0, fmax sr/2,
    Slaney mel scale, Slaney area normalisation; returned in librosa's float32 precision."""
    fftfreqs = np.fft.rfftfreq(n=n_fft, d=1.0 / sr)
    edges = _hz_to_mel(np.array([0.0, sr / 2.0]))
    mel_f = _mel_to_hz(np.linspace(float(edges[0]), float(edges[1]), n_mels + 2))
    fdiff = np.diff(mel_f)
    ramps = np.subtract.outer(mel_f, fftfreqs)
    lower = -ramps[:n_mels] / fdiff[:n_mels, None]
    upper = ramps[2 : n_mels + 2] / fdiff[1 : n_mels + 1, None]
    weights = np.maximum(0.0, np.minimum(lower, upper))
    weights *= (2.0 / (mel_f[2 : n_mels + 2] - mel_f[:n_mels]))[:, None]
    return weights.astype(np.float32).astype(np.float64)


def _stft_magnitude(audio: Array, n_fft: int, hop: int) -> Array:
    """torch.stft(window=hann_window(n_fft), center=True, pad_mode="constant") magnitudes,
    [channels, bins, frames]."""
    window = 0.5 - 0.5 * np.cos(2.0 * np.pi * np.arange(n_fft) / n_fft)  # periodic Hann
    padded = np.pad(audio, ((0, 0), (n_fft // 2, n_fft // 2)))
    count = 1 + (padded.shape[1] - n_fft) // hop
    starts = hop * np.arange(int(count))
    index = np.arange(n_fft)[None, :] + starts[:, None]
    frames = padded[:, index] * window  # [channels, frames, n_fft]
    return np.abs(np.fft.rfft(frames, axis=-1)).transpose(0, 2, 1)


def _amplitude_to_db(magnitude: Array, top_db: float = 80.0) -> Array:
    db = 20.0 * np.log10(np.maximum(magnitude, 1e-10))
    return np.maximum(db, db.max() - top_db)


def bleed_full(
    reference: Array,
    estimate: Array,
    sr: int = 44100,
    n_fft: int = 4096,
    hop_length: int = 1024,
    n_mels: int = 512,
) -> tuple[float, float]:
    """MSST `bleed_full` → (bleedless, fullness), both 0-100, higher is better. Bleedless falls
    with energy the estimate has above the reference (bleed), fullness with energy it misses."""
    ref = _cs(reference).astype(np.float32).astype(np.float64)
    est = _cs(estimate).astype(np.float32).astype(np.float64)
    mel = mel_filterbank(sr, n_fft, n_mels)
    s1 = _amplitude_to_db(np.matmul(mel, _stft_magnitude(ref, n_fft, hop_length)))
    s2 = _amplitude_to_db(np.matmul(mel, _stft_magnitude(est, n_fft, hop_length)))
    diff = s2 - s1
    positive = diff[diff > 0]
    negative = diff[diff < 0]
    average_positive = float(positive.mean()) if positive.size else 0.0
    average_negative = float(negative.mean()) if negative.size else 0.0
    return 100.0 / (average_positive + 1.0), 100.0 / (-average_negative + 1.0)
