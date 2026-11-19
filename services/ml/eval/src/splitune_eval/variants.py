"""Real-upload conditions for separation tests (step 28; 08 implementation notes).

Each variant turns a clean mixture and its reference stems into (mixture, references):
- gain-like transforms (`limit-L`, `limit-XL`, `musdb-xl`, `mono`) are applied to the mixture and
  identically to every stem, so the references stay the true sources of the new mixture;
- lossy codecs (`aac128`, `opus128`, `opus160`, `mp3-128`) change only the mixture; the decoded
  audio is re-aligned to the clean mixture (measured lag) so the clean references stay valid;
- `sr48` resamples the mixture to 48 kHz and brings it back through the shipped decode stage
  (`stage_decode.decode`: ffmpeg to 44.1 kHz f32, then the 24-bit FLAC cache copy);
- composites `<gain-like>+<codec>` (step 29: `limit-XL+aac128`, `limit-XL+opus128`) apply the
  gain-like transform to the mixture and the stems, then the codec to the mixture only: a lossy
  upload of a hot master, whose decode peaks above full scale (`info` records the peak).

Arrays are float64 [frames, channels] at 44.1 kHz.

The limiter: a linked-stereo look-ahead true-peak limiter in numpy, after the musdb-XL recipe
(Jeon & Lee, ISMIR 2022): one sample-wise gain computed from the mixture is applied to the
mixture and every stem. Peaks are measured on a 4x oversampled signal; the gain needed to keep
each sample under the ceiling is spread backwards over the look-ahead (sliding minimum), recovers
with a one-pole release, and is smoothed by a moving average as long as the look-ahead, so it
never exceeds what any sample needs. A make-up gain is searched so the result reaches the target
integrated loudness. A per-channel soft clipper (linear up to 3 dB below the ceiling, tanh knee
above) runs first, as on loud commercial masters; its sample-wise ratio goes to the stems like the
limiter's gain (musdb-XL's ratio is per channel too). Checked against the official musdb-XL ratios
on every 5th P1 window at the same loudness (median -7.6 LUFS): clean-vs-limited stem SI-SDR
drums/vocals/bass/other 22.2/24.7/28.1/25.9 dB vs musdb-XL 20.2/23.1/26.0/24.2 dB. A limiter
without the clipper needs ~7 dB of gain reduction for that loudness at -1 dBTP and distorts far
more (10.8-11.5 dB); musdb-XL itself gets there by exceeding 0 dBFS (median true peak +3.8 dBTP)
and clipping when written. `musdb-xl` mixtures are therefore clipped to +-1 like a file would be.
"""

from __future__ import annotations

import subprocess
import tempfile
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pyloudnorm  # pyright: ignore[reportMissingTypeStubs]
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from numpy.typing import NDArray
from scipy.ndimage import minimum_filter1d  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]
from scipy.signal import correlate, resample_poly  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]
from splitune_ml_core import ffmpeg

Array = NDArray[np.float64]
RATE = 44100

LOOKAHEAD_S = 0.005
RELEASE_S = 0.1
OVERSAMPLE = 4
CEILING_DBTP = -1.0
CLIP_KNEE_DB = -3.0  # the clipper is linear below ceiling + this
# target LUFS, soft clipper before the limiter
LIMIT_TARGETS: dict[str, tuple[float, bool]] = {"limit-L": (-8.0, True), "limit-XL": (-6.0, True)}
CODECS = {
    "aac128": ("aac", "128k", ".m4a"),
    "opus128": ("libopus", "128k", ".opus"),
    "opus160": ("libopus", "160k", ".opus"),
    "mp3-128": ("libmp3lame", "128k", ".mp3"),
}
GAIN_LIKE = ("limit-L", "limit-XL", "musdb-xl", "mono")
COMPOSITES = ("limit-XL+aac128", "limit-XL+opus128")
VARIANTS = ("clean", *CODECS, "mono", "sr48", *LIMIT_TARGETS, "musdb-xl", *COMPOSITES)
# Variants whose references differ from the clean stems (gain-like transforms and composites).
OWN_REFERENCES = (*GAIN_LIKE, *COMPOSITES)
MAX_ALIGN_LAG = 4096


@dataclass
class Variant:
    mixture: Array
    references: dict[str, Array]
    info: dict[str, float] = field(default_factory=dict[str, float])


def loudness(audio: Array) -> float:
    meter = pyloudnorm.Meter(RATE)  # pyright: ignore[reportUnknownMemberType]
    return float(meter.integrated_loudness(audio))  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]


def true_peak_envelope(audio: Array) -> Array:
    """Per-sample absolute peak over channels of the 4x oversampled signal (a true-peak meter
    approximation, as BS.1770 does)."""
    up = np.asarray(resample_poly(audio, OVERSAMPLE, 1, axis=0), dtype=np.float64)  # pyright: ignore[reportUnknownArgumentType]
    peaks = np.abs(up).max(axis=1)[: len(audio) * OVERSAMPLE]
    peaks = np.pad(peaks, (0, len(audio) * OVERSAMPLE - len(peaks)))
    return np.maximum(peaks.reshape(len(audio), OVERSAMPLE).max(axis=1), np.abs(audio).max(axis=1))


def _release(required: Array, coefficient: float, block: int = 16) -> Array:
    """One-pole recovery towards 1 while never rising above `required` (control rate: blocks
    of `block` samples, taking each block's minimum)."""
    n = len(required)
    pad = (-n) % block
    blocks = np.pad(required, (0, pad), constant_values=1.0).reshape(-1, block).min(axis=1)
    out = np.empty_like(blocks)
    alpha = coefficient**block
    level = 1.0
    for i, value in enumerate(blocks.tolist()):
        level = value if value < level else value + alpha * (level - value)
        out[i] = level
    return np.repeat(out, block)[:n]


def limiter_gain(mixture: Array, ceiling_dbtp: float = CEILING_DBTP) -> Array:
    """Sample-wise linear gain (≤ 1) that keeps `mixture` under the true-peak ceiling."""
    look = max(1, round(LOOKAHEAD_S * RATE))
    ceiling = 10 ** (ceiling_dbtp / 20)
    peaks = true_peak_envelope(mixture)
    required = np.minimum(1.0, ceiling / np.maximum(peaks, 1e-12))
    # Forward-looking minimum over [n, n + look]: the gain is down before the peak arrives.
    ahead = np.asarray(
        minimum_filter1d(required, size=look + 1, origin=-(look // 2), mode="nearest"),  # pyright: ignore[reportUnknownArgumentType]
        dtype=np.float64,
    )
    released = _release(ahead, float(np.exp(-1.0 / (RELEASE_S * RATE))))
    # Moving average over [n, n + look] of the forward minimum stays ≤ required[n].
    cumsum = np.concatenate([[0.0], np.cumsum(np.pad(released, (0, look), mode="edge"))])
    smoothed = (cumsum[look + 1 :] - cumsum[: -look - 1])[: len(mixture)] / (look + 1)
    return np.minimum(smoothed, ahead)


def soft_clip(audio: Array, ceiling_dbtp: float = CEILING_DBTP) -> Array:
    """Per-channel clipper: identity below the knee, tanh towards the ceiling above it."""
    ceiling = 10 ** (ceiling_dbtp / 20)
    knee = ceiling * 10 ** (CLIP_KNEE_DB / 20)
    magnitude = np.abs(audio)
    over = magnitude > knee
    out = audio.copy()
    out[over] = np.sign(audio[over]) * (
        knee + (ceiling - knee) * np.tanh((magnitude[over] - knee) / (ceiling - knee))
    )
    return out


def _master(boosted: Array, clip: bool, ceiling_dbtp: float) -> Array:
    """Per-sample, per-channel gain of the (clipper →) limiter chain on an already boosted mix."""
    gain = np.ones_like(boosted)
    if clip:
        clipped = soft_clip(boosted, ceiling_dbtp)
        nonzero = boosted != 0
        gain[nonzero] = clipped[nonzero] / boosted[nonzero]
        boosted = clipped
    return gain * limiter_gain(boosted, ceiling_dbtp)[:, None]


def limit(
    mixture: Array, target_lufs: float, clip: bool = False, ceiling_dbtp: float = CEILING_DBTP
) -> tuple[Array, dict[str, float]]:
    """(total gain [frames, channels] to apply to the mixture and every stem, statistics). The
    make-up gain is bisected (to 0.05 LU) towards `target_lufs`; when the chain can't get that
    loud the loudest result within +40 dB is used and `lufs` says what was reached."""
    lo, hi = -20.0, 40.0
    best: tuple[Array, float] | None = None
    for _ in range(24):
        makeup_db = (lo + hi) / 2
        makeup = 10 ** (makeup_db / 20)
        gain = _master(mixture * makeup, clip, ceiling_dbtp)
        level = loudness(mixture * makeup * gain)
        if best is None or abs(level - target_lufs) < abs(best[1] - target_lufs):
            best = (gain * makeup, level)
        if abs(level - target_lufs) < 0.05:
            break
        lo, hi = (makeup_db, hi) if level < target_lufs else (lo, makeup_db)
    assert best is not None
    total, level = best
    reduction_db = 20 * np.log10(np.maximum(total / total.max(), 1e-12))
    stats = {
        "lufs": round(level, 2),
        "makeup_db": round(float(20 * np.log10(total.max())), 2),
        "gr_mean_db": round(float(-reduction_db.mean()), 2),
        "gr_p95_db": round(float(-np.percentile(reduction_db, 5)), 2),
        "true_peak_dbtp": round(float(20 * np.log10(true_peak_envelope(mixture * total).max())), 2),
    }
    return total, stats


def align(reference: Array, shifted: Array, max_lag: int = MAX_ALIGN_LAG) -> tuple[Array, int]:
    """`shifted` moved so it lines up with `reference` (cross-correlation of the mono sums over
    the loudest 10 s), trimmed/padded to the reference's length; returns (aligned, lag)."""
    ref_mono, est_mono = reference.mean(axis=1), shifted.mean(axis=1)
    span = min(len(ref_mono), 10 * RATE)
    power = np.concatenate([[0.0], np.cumsum(ref_mono**2)])
    energy = (power[RATE:] - power[:-RATE])[:: RATE // 10]  # 1 s energies every 0.1 s
    start = int(np.argmax(energy)) * (RATE // 10) if len(ref_mono) > span else 0
    start = min(start, max(0, len(ref_mono) - span))
    segment = ref_mono[start : start + span]
    # Zero-padded on both sides, so every lag in ±max_lag is searched wherever the segment lies.
    padded = np.pad(est_mono, (max_lag, max_lag))
    window = padded[start : start + span + 2 * max_lag]
    scores: Array = np.asarray(
        correlate(window, segment, mode="valid", method="fft"),  # pyright: ignore[reportUnknownArgumentType]
        dtype=np.float64,
    )
    lag = int(np.argmax(scores)) - max_lag  # est[n + lag] ≈ ref[n]
    out = shifted[lag:] if lag >= 0 else np.pad(shifted, ((-lag, 0), (0, 0)))
    n = len(reference)
    out = out[:n] if len(out) >= n else np.pad(out, ((0, n - len(out)), (0, 0)))
    return out, lag


def _ffmpeg(args: list[str]) -> None:
    subprocess.run(
        [ffmpeg.binary("ffmpeg"), "-nostdin", "-v", "error", "-y", *args], check=True, timeout=600
    )


def codec_roundtrip(mixture: Array, name: str) -> tuple[Array, int]:
    """Encode → decode at 44.1 kHz stereo float, aligned to the input; returns (audio, lag)."""
    encoder, bitrate, suffix = CODECS[name]
    with tempfile.TemporaryDirectory() as tmp:
        source = Path(tmp) / "in.wav"
        sf.write(str(source), mixture.astype(np.float32), RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
        encoded = Path(tmp) / f"enc{suffix}"
        _ffmpeg(["-i", str(source), "-c:a", encoder, "-b:a", bitrate, str(encoded)])
        decoded = Path(tmp) / "dec.wav"
        _ffmpeg(
            ["-i", str(encoded), "-ac", "2", "-ar", str(RATE), "-c:a", "pcm_f32le", str(decoded)]
        )
        data, _ = sf.read(str(decoded), dtype="float64", always_2d=True)  # pyright: ignore[reportUnknownMemberType]
    return align(mixture, np.asarray(data, dtype=np.float64))


def shipped_decode(source: Path) -> Array:
    """The `decode` stage's path: ffmpeg → 44.1 kHz stereo f32 → 24-bit FLAC cache → read back."""
    from stage_decode import decode

    with tempfile.TemporaryDirectory() as tmp:
        pcm = Path(tmp) / "pcm.f32"
        frames = decode.decode_pcm(source, pcm, max_duration_s=3600, timeout_s=600)
        flac = Path(tmp) / "decoded.flac"
        decode.encode_flac(pcm, flac, timeout_s=600)
        data, rate = sf.read(str(flac), dtype="float64", always_2d=True)  # pyright: ignore[reportUnknownMemberType]
    audio = np.asarray(data, dtype=np.float64)
    if int(rate) != RATE or len(audio) != frames:
        raise ValueError("decode stage output has an unexpected rate or length")
    return audio


def sr48(mixture: Array) -> tuple[Array, int]:
    """48 kHz float WAV of the mixture through the shipped decode, aligned to the input."""
    with tempfile.TemporaryDirectory() as tmp:
        source = Path(tmp) / "in.wav"
        sf.write(str(source), mixture.astype(np.float32), RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
        resampled = Path(tmp) / "in48.wav"
        _ffmpeg(["-i", str(source), "-ar", "48000", "-c:a", "pcm_f32le", str(resampled)])
        decoded = shipped_decode(resampled)
    return align(mixture, decoded)


def fold_mono(audio: Array) -> Array:
    return np.repeat(audio.mean(axis=1, keepdims=True), audio.shape[1], axis=1)


def apply(
    name: str,
    mixture: Array,
    references: dict[str, Array],
    xl_ratio: Callable[[], Array] | None = None,
) -> Variant:
    """One variant of (mixture, references). `xl_ratio` supplies the official musdb-XL
    sample-wise ratio [frames, channels] for this audio (needed only by `musdb-xl`)."""
    if name in COMPOSITES:
        first, codec = name.split("+")
        loud = apply(first, mixture, references, xl_ratio)
        audio, lag = codec_roundtrip(loud.mixture, codec)
        peak = float(np.abs(audio).max())
        info = {**loud.info, "lag": float(lag), "decoded_peak": round(peak, 4)}
        info["over_full_scale"] = round(float(np.mean(np.abs(audio) > 1.0)), 7)
        return Variant(audio, loud.references, info)
    if name == "clean":
        return Variant(mixture, references)
    if name in CODECS:
        audio, lag = codec_roundtrip(mixture, name)
        return Variant(audio, references, {"lag": float(lag)})
    if name == "sr48":
        audio, lag = sr48(mixture)
        return Variant(audio, references, {"lag": float(lag)})
    if name == "mono":
        return Variant(fold_mono(mixture), {k: fold_mono(v) for k, v in references.items()})
    if name in LIMIT_TARGETS:
        target, clip = LIMIT_TARGETS[name]
        gain, stats = limit(mixture, target, clip)
        return Variant(mixture * gain, {k: v * gain for k, v in references.items()}, stats)
    if name == "musdb-xl":
        if xl_ratio is None:
            raise ValueError("musdb-xl needs the official gain ratio")
        ratio = xl_ratio()[: len(mixture)]
        loud = mixture * ratio
        return Variant(
            np.clip(loud, -1.0, 1.0),
            {k: v * ratio for k, v in references.items()},
            {
                "lufs": round(loudness(loud), 2),
                "clipped_fraction": round(float(np.mean(np.abs(loud) > 1.0)), 5),
            },
        )
    raise ValueError(f"unknown variant {name!r}")
