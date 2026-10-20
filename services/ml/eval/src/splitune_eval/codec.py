"""Codec simulator: "YouTube-style" AAC or Opus 128 kb/s round-trips of owned audio, loudness
normalised with pyloudnorm (08 §1). Output is 44.1 kHz stereo WAV."""

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path
from typing import Literal

import numpy as np
import pyloudnorm  # pyright: ignore[reportMissingTypeStubs]
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from splitune_ml_core import ffmpeg

Codec = Literal["aac", "opus"]
CODECS: dict[Codec, tuple[str, str]] = {"aac": ("aac", ".m4a"), "opus": ("libopus", ".opus")}
TARGET_LUFS = -14.0


def simulate(
    source: Path,
    dest: Path,
    codec: Codec,
    bitrate: str = "128k",
    target_lufs: float | None = TARGET_LUFS,
) -> Path:
    encoder, suffix = CODECS[codec]
    with tempfile.TemporaryDirectory() as tmp:
        encoded = Path(tmp) / f"encoded{suffix}"
        subprocess.run(
            [
                ffmpeg.binary("ffmpeg"),
                "-nostdin",
                "-v",
                "error",
                "-y",
                "-i",
                str(source),
                "-vn",
                "-c:a",
                encoder,
                "-b:a",
                bitrate,
                str(encoded),
            ],
            check=True,
            timeout=300,
        )
        decoded = Path(tmp) / "decoded.wav"
        subprocess.run(
            [
                ffmpeg.binary("ffmpeg"),
                "-nostdin",
                "-v",
                "error",
                "-y",
                "-i",
                str(encoded),
                "-ac",
                "2",
                "-ar",
                "44100",
                "-c:a",
                "pcm_f32le",
                str(decoded),
            ],
            check=True,
            timeout=300,
        )
        audio, rate = sf.read(str(decoded), dtype="float64", always_2d=True)  # pyright: ignore[reportUnknownMemberType]
    samples = np.asarray(audio, dtype=np.float64)
    if target_lufs is not None:
        meter = pyloudnorm.Meter(int(rate))  # pyright: ignore[reportUnknownMemberType]
        loudness = float(meter.integrated_loudness(samples))  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]
        if np.isfinite(loudness):
            samples = samples * 10 ** ((target_lufs - loudness) / 20)
    dest.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(dest), samples.astype(np.float32), int(rate), subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    return dest
