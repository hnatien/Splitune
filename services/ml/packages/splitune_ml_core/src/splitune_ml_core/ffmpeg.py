"""FFmpeg CLI helpers (FFmpeg 8.1 is pinned: audio_hash depends on its decoder and resampler)."""

from __future__ import annotations

import os
import re
import shutil
import subprocess
from functools import cache
from pathlib import Path

from .errors import StageError


def binary(name: str) -> str:
    """Absolute path of `ffmpeg`/`ffprobe` from FFMPEG_BIN_DIR, else PATH."""
    directory = os.environ.get("FFMPEG_BIN_DIR")
    if directory:
        candidate = Path(directory).expanduser() / name
        if candidate.is_file():
            return str(candidate)
        if candidate.with_suffix(".exe").is_file():
            return str(candidate.with_suffix(".exe"))
        raise StageError("ffmpeg_missing", retry=False)
    found = shutil.which(name)
    if found is None:
        raise StageError("ffmpeg_missing", retry=False)
    return found


@cache
def version() -> str:
    """e.g. "8.1.3" (part of every decode cache key)."""
    out = subprocess.run(
        [binary("ffmpeg"), "-hide_banner", "-version"],
        capture_output=True,
        text=True,
        check=True,
        timeout=10,
    ).stdout
    match = re.search(r"ffmpeg version n?(\S+)", out)
    return match.group(1) if match else "unknown"


def run(
    args: list[str], timeout_s: float, error_code: str, timeout_code: str
) -> subprocess.CompletedProcess[bytes]:
    """Runs ffmpeg/ffprobe without a shell; stderr is captured but never logged verbatim."""
    try:
        result = subprocess.run(args, capture_output=True, timeout=timeout_s, check=False)
    except subprocess.TimeoutExpired as exc:
        raise StageError(timeout_code, retry=False) from exc
    if result.returncode != 0:
        raise StageError(error_code, retry=False)
    return result
