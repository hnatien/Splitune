"""ffprobe + canonical decode (06-ml-pipeline-service.md §4, 03 "Keys").

The canonical PCM is 44.1 kHz stereo float32 little-endian straight out of ffmpeg 8.1; its sha256
is `audio_hash`. Downstream stages read a FLAC copy (24-bit) from the local cache instead of the
~10 MB/min raw stream.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

import numpy as np
import pyloudnorm  # pyright: ignore[reportMissingTypeStubs]
from splitune_ml_core import ffmpeg
from splitune_ml_core.errors import StageError

SAMPLE_RATE = 44100
CHANNELS = 2
FRAME_BYTES = CHANNELS * 4
# Inputs only ever come from local files; never let a crafted playlist make ffmpeg fetch URLs.
_INPUT_OPTS = ["-protocol_whitelist", "file"]


@dataclass(frozen=True)
class Probed:
    container: str
    duration_s: float | None
    audio_streams: int
    stream: dict[str, Any]


def _int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _float(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) and number >= 0 else None


def probe(source: Path, timeout_s: float) -> Probed:
    result = ffmpeg.run(
        [
            ffmpeg.binary("ffprobe"),
            "-v",
            "error",
            *_INPUT_OPTS,
            "-show_format",
            "-show_streams",
            "-of",
            "json",
            str(source),
        ],
        timeout_s,
        "unsupported_media",
        "decode_timeout",
    )
    info = cast(dict[str, Any], json.loads(result.stdout or b"{}"))
    streams = [
        s
        for s in cast(list[dict[str, Any]], info.get("streams", []))
        if s.get("codec_type") == "audio"
    ]
    if not streams:
        raise StageError("unsupported_media", retry=False)
    fmt = cast(dict[str, Any], info.get("format", {}))
    first = streams[0]
    stream: dict[str, Any] = {
        "codec": str(first.get("codec_name") or "unknown"),
        "sample_rate": _int(first.get("sample_rate")),
        "channels": _int(first.get("channels")),
        "channel_layout": first.get("channel_layout"),
        "bit_rate": _int(first.get("bit_rate")),
        "duration_s": _float(first.get("duration")),
    }
    return Probed(
        container=str(fmt.get("format_name") or "unknown"),
        duration_s=_float(fmt.get("duration")) or stream["duration_s"],
        audio_streams=len(streams),
        stream={k: v for k, v in stream.items() if v is not None},
    )


def decode_pcm(source: Path, dest: Path, max_duration_s: float, timeout_s: float) -> int:
    """Decodes the first audio stream to f32le; returns the frame count. Output is capped a bit
    past `max_duration_s`, so a container that lies about its length can't fill the disk."""
    ffmpeg.run(
        [
            ffmpeg.binary("ffmpeg"),
            "-nostdin",
            "-hide_banner",
            "-v",
            "error",
            *_INPUT_OPTS,
            "-i",
            str(source),
            "-map",
            "0:a:0",
            "-vn",
            "-sn",
            "-dn",
            "-ac",
            str(CHANNELS),
            "-ar",
            str(SAMPLE_RATE),
            "-t",
            str(max_duration_s + 1),
            "-c:a",
            "pcm_f32le",
            "-f",
            "f32le",
            "-y",
            str(dest),
        ],
        timeout_s,
        "decode_failed",
        "decode_timeout",
    )
    size = dest.stat().st_size
    frames = size // FRAME_BYTES
    if frames == 0:
        raise StageError("audio_empty", retry=False)
    if frames > max_duration_s * SAMPLE_RATE:
        raise StageError("too_long", retry=False)
    return frames


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(1 << 20):
            digest.update(chunk)
    return digest.hexdigest()


def loudness(pcm: Path) -> tuple[float | None, float | None]:
    """(integrated LUFS, sample peak dBFS); None for silence or audio shorter than one block."""
    samples = np.memmap(pcm, dtype="<f4", mode="r").reshape(-1, CHANNELS)
    peak = float(np.max(np.abs(samples)))
    peak_db = 20 * math.log10(peak) if peak > 0 else None
    meter = pyloudnorm.Meter(SAMPLE_RATE)  # pyright: ignore[reportUnknownMemberType]
    try:
        lufs = float(meter.integrated_loudness(np.asarray(samples, dtype=np.float64)))  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]
    except ValueError:
        lufs = float("-inf")
    return (lufs if math.isfinite(lufs) else None), peak_db


def encode_flac(pcm: Path, dest: Path, timeout_s: float) -> None:
    """Writes the canonical PCM as 24-bit FLAC, atomically (temp file + rename)."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    temp = dest.with_name(f".{dest.stem}.{uuid.uuid4().hex}.flac")
    try:
        ffmpeg.run(
            [
                ffmpeg.binary("ffmpeg"),
                "-nostdin",
                "-hide_banner",
                "-v",
                "error",
                "-f",
                "f32le",
                "-ar",
                str(SAMPLE_RATE),
                "-ac",
                str(CHANNELS),
                "-i",
                str(pcm),
                "-c:a",
                "flac",
                "-sample_fmt",
                "s32",
                "-bits_per_raw_sample",
                "24",
                "-y",
                str(temp),
            ],
            timeout_s,
            "encode_failed",
            "decode_timeout",
        )
        os.replace(temp, dest)
    finally:
        temp.unlink(missing_ok=True)
