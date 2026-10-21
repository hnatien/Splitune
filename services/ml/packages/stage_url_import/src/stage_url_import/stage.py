"""`url_import` stage (onnx-cpu island): page URL → downloaded audio, plus a muted video ≤720p when
asked for, with yt-dlp (25-personal-mode.md §4, 06 §0). The worker uploads the files to the
user's raw/ prefix; the normal analysis graph starts from that audio.

yt-dlp runs as a subprocess of this island's interpreter, so the pinned version is the one that
runs. Its output is never logged: it carries the URL and site messages.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from importlib.metadata import version
from pathlib import Path
from typing import Any, cast

from splitune_ml_core import ffmpeg
from splitune_ml_core.errors import StageError
from splitune_ml_core.stage_api import StageDescription, StageJob, StageOutput

# Same limits as uploads (13 §2, 04 "Implementation notes"): ≤20 minutes, ≤500 MB of audio.
MAX_DURATION_S = 20 * 60
MAX_AUDIO_MB = 500
MAX_VIDEO_MB = 750
METADATA_TIMEOUT_S = 60.0
# The stage has 300 s in all (06 §0): metadata, then audio, then the optional video.
AUDIO_TIMEOUT_S = 150.0
VIDEO_TIMEOUT_S = 80.0

YT_DLP = [sys.executable, "-m", "yt_dlp"]

# Site-specific extractors only: the generic extractor would fetch any URL from the Mac (its LAN
# included), so pages without a dedicated extractor are `url_unsupported`.
COMMON = [
    "--ignore-config",
    "--no-playlist",
    "--use-extractors",
    "default,-generic",
    "--no-progress",
    "--no-warnings",
    "--no-cache-dir",
    "--no-mtime",
    "--socket-timeout",
    "30",
    "--retries",
    "3",
    "--fragment-retries",
    "3",
]
# Audio as the site serves it (decode reads any container). AAC first: the cheapest to decode.
AUDIO_FORMAT = "bestaudio[ext=m4a]/bestaudio/best"
# Video only (it plays muted, slaved to the audio engine), H.264 MP4 where offered: the codec every
# Tier 1 browser plays.
VIDEO_FORMAT = "bv*[height<=720][ext=mp4][vcodec^=avc1]/bv*[height<=720][ext=mp4]"

UNSUPPORTED = ("unsupported url", "is not a valid url", "no suitable extractor")
# Errors that another attempt won't fix (private, removed, region-locked, sign-in walls).
PERMANENT = (
    "private video",
    "video unavailable",
    "this video is unavailable",
    "not available in your country",
    "geo restrict",
    "members-only",
    "confirm your age",
    "has been removed",
    "http error 404",
    "http error 410",
    "copyright",
)


def describe(params: dict[str, Any], inputs: dict[str, str] | None = None) -> StageDescription:
    return StageDescription(
        model_refs=[],
        params={
            "url": params["url"],
            "download_video": bool(params.get("download_video", False)),
            "yt_dlp": version("yt-dlp"),
        },
    )


def _tools() -> list[str]:
    """yt-dlp finds Deno on PATH; launchd's PATH may not have Homebrew, so name both explicitly."""
    args: list[str] = []
    deno = shutil.which("deno") or shutil.which("deno", path="/opt/homebrew/bin")
    if deno is not None:
        args += ["--js-runtimes", f"deno:{deno}"]
    if os.environ.get("FFMPEG_BIN_DIR"):
        args += ["--ffmpeg-location", str(Path(ffmpeg.binary("ffmpeg")).parent)]
    return args


def classify(stderr: str) -> StageError:
    text = stderr.lower()
    if any(marker in text for marker in UNSUPPORTED):
        return StageError("url_unsupported", retry=False)
    if any(marker in text for marker in PERMANENT):
        return StageError("url_download_failed", retry=False)
    if "larger than max-filesize" in text:
        return StageError("file_too_large", retry=False)
    # Network trouble, throttling, a transient extractor error: worth another attempt.
    return StageError("url_download_failed")


def _yt_dlp(args: list[str], timeout_s: float) -> subprocess.CompletedProcess[str]:
    try:
        result = subprocess.run(
            [*YT_DLP, *COMMON, *_tools(), *args],
            capture_output=True,
            text=True,
            timeout=timeout_s,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise StageError("url_download_failed") from exc
    if result.returncode != 0:
        raise classify(result.stderr)
    return result


def metadata(url: str, info_path: Path) -> dict[str, Any]:
    """One extraction; the downloads reuse it (--load-info-json) instead of extracting again."""
    result = _yt_dlp(["--dump-single-json", "--skip-download", "--", url], METADATA_TIMEOUT_S)
    try:
        info = cast(dict[str, Any], json.loads(result.stdout))
    except json.JSONDecodeError as exc:
        raise StageError("url_download_failed") from exc
    if not isinstance(info, dict) or info.get("_type", "video") != "video":  # pyright: ignore[reportUnnecessaryIsInstance]
        raise StageError("url_unsupported", retry=False)
    info_path.write_text(result.stdout, encoding="utf-8")
    return info


def download(info_path: Path, fmt: str, out: Path, max_mb: int, timeout_s: float) -> Path | None:
    """The file yt-dlp wrote for `fmt`, or None when it skipped it (e.g. over the size cap)."""
    result = _yt_dlp(
        [
            "--load-info-json",
            str(info_path),
            "-f",
            fmt,
            "--max-filesize",
            f"{max_mb}M",
            "-o",
            f"{out}.%(ext)s",
        ],
        timeout_s,
    )
    found = sorted(
        p for p in out.parent.glob(f"{out.name}.*") if p.suffix not in {".part", ".ytdl"}
    )
    if found:
        return found[0]
    if "larger than max-filesize" in (result.stdout + result.stderr).lower():
        raise StageError("file_too_large", retry=False)
    return None


def _text(value: object) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    return value.strip()[:200]


def run(job: StageJob) -> StageOutput:
    started = time.monotonic()
    workdir = Path(job.workdir)
    workdir.mkdir(parents=True, exist_ok=True)
    url = str(job.params["url"])
    info_path = workdir / "info.json"

    info = metadata(url, info_path)
    if info.get("is_live") or info.get("live_status") in {"is_live", "is_upcoming"}:
        raise StageError("url_unsupported", retry=False)
    duration = info.get("duration")
    if isinstance(duration, int | float) and duration > MAX_DURATION_S:
        raise StageError("too_long", retry=False)

    audio = download(info_path, AUDIO_FORMAT, workdir / "source", MAX_AUDIO_MB, AUDIO_TIMEOUT_S)
    if audio is None:
        raise StageError("url_download_failed")
    files = {"source": str(audio)}
    fallback_reason: str | None = None
    if job.params.get("download_video"):
        # The video is a convenience: failing to get one leaves the import intact.
        try:
            video = download(
                info_path, VIDEO_FORMAT, workdir / "video", MAX_VIDEO_MB, VIDEO_TIMEOUT_S
            )
        except StageError:
            video = None
        if video is not None and video.suffix == ".mp4":
            files["video"] = str(video)
        else:
            fallback_reason = "video_unavailable"

    return StageOutput(
        status="fallback" if fallback_reason else "done",
        files=files,
        model_refs=[],
        metrics={"wall_s": round(time.monotonic() - started, 3)},
        fallback_reason=fallback_reason,
        facts={
            "title": _text(info.get("track")) or _text(info.get("title")),
            "artist": _text(info.get("artist")) or _text(info.get("creator")),
            "duration_s": float(duration) if isinstance(duration, int | float) else None,
            "extractor": _text(info.get("extractor_key")),
        },
    )
