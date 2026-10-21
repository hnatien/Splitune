"""url_import against a fake yt-dlp (unit) and, opt-in, a real page (SPLITUNE_LIVE_URL_IMPORT)."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest
from splitune_ml_core.errors import StageError
from splitune_ml_core.stage_api import StageJob
from stage_decode import decode
from stage_url_import import stage

FAKE = Path(__file__).with_name("fake_yt_dlp.py")


@pytest.fixture
def calls(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    log = tmp_path / "calls.jsonl"
    monkeypatch.setenv("FAKE_YT_DLP_LOG", str(log))
    monkeypatch.setattr(stage, "YT_DLP", [sys.executable, str(FAKE)])
    return log


def job(tmp_path: Path, scenario: str, *, video: bool = True) -> StageJob:
    params = stage.describe(
        {"url": f"https://www.youtube.com/watch/{scenario}", "download_video": video}
    ).params
    return StageJob(
        stage="url_import",
        analysis_id="0192f6c4-8b00-7a00-8000-0000000000aa",
        user_id="u1",
        artefact_version=1,
        params=params,
        inputs={},
        workdir=str(tmp_path / "work"),
        cache_dir=str(tmp_path / "cache"),
    )


def failure(tmp_path: Path, scenario: str) -> StageError:
    with pytest.raises(StageError) as raised:
        stage.run(job(tmp_path, scenario))
    return raised.value


def test_url_import_downloads_audio_and_video_with_metadata(tmp_path: Path, calls: Path) -> None:
    out = stage.run(job(tmp_path, "ok"))
    assert out.status == "done"
    assert Path(out.files["source"]).name == "source.m4a"
    assert Path(out.files["video"]).name == "video.mp4"
    assert out.facts == {
        "title": "Song title",
        "artist": "Some Artist",
        "duration_s": 241.5,
        "extractor": "Youtube",
    }
    lines = [json.loads(line) for line in calls.read_text(encoding="utf-8").splitlines()]
    extract, audio, video = lines
    # One extraction; the downloads reuse its info JSON instead of fetching the page again.
    assert "--dump-single-json" in extract
    assert "--load-info-json" in audio
    assert "--load-info-json" in video
    for args in lines:
        assert args[args.index("--use-extractors") + 1] == "default,-generic"
        assert "--ignore-config" in args
    # The URL is only ever a positional argument after "--".
    assert extract[-2:] == ["--", "https://www.youtube.com/watch/ok"]
    assert audio[audio.index("-f") + 1] == stage.AUDIO_FORMAT
    assert video[video.index("-f") + 1] == stage.VIDEO_FORMAT


def test_url_import_skips_the_video_unless_asked(tmp_path: Path, calls: Path) -> None:
    out = stage.run(job(tmp_path, "ok", video=False))
    assert set(out.files) == {"source"}
    assert len(calls.read_text(encoding="utf-8").splitlines()) == 2


def test_url_import_keeps_the_audio_when_no_video_is_available(tmp_path: Path, calls: Path) -> None:
    out = stage.run(job(tmp_path, "novideo"))
    assert out.status == "fallback"
    assert out.fallback_reason == "video_unavailable"
    assert set(out.files) == {"source"}


@pytest.mark.parametrize(
    ("scenario", "code", "retry"),
    [
        ("unsupported", "url_unsupported", False),
        ("live", "url_unsupported", False),
        ("private", "url_download_failed", False),
        ("flaky", "url_download_failed", True),
        ("long", "too_long", False),
        ("big", "file_too_large", False),
    ],
)
def test_url_import_maps_failures_to_codes(
    tmp_path: Path, calls: Path, scenario: str, code: str, retry: bool
) -> None:
    error = failure(tmp_path, scenario)
    assert (error.code, error.retry) == (code, retry)


def test_url_import_times_out_as_a_retryable_failure(
    tmp_path: Path, calls: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(stage, "METADATA_TIMEOUT_S", 0.5)
    error = failure(tmp_path, "slow")
    assert (error.code, error.retry) == ("url_download_failed", True)


def test_url_import_records_the_pinned_yt_dlp_in_params() -> None:
    params = stage.describe({"url": "https://example.com/v"}).params
    assert params["download_video"] is False
    assert params["yt_dlp"] == "2026.8.19"


@pytest.mark.skipif(
    not os.environ.get("SPLITUNE_LIVE_URL_IMPORT"),
    reason="opt-in network test: set SPLITUNE_LIVE_URL_IMPORT to a page URL",
)
def test_url_import_live_download(tmp_path: Path) -> None:
    url = os.environ["SPLITUNE_LIVE_URL_IMPORT"]
    out = stage.run(
        StageJob(
            stage="url_import",
            analysis_id="0192f6c4-8b00-7a00-8000-0000000000aa",
            user_id="u1",
            artefact_version=1,
            params=stage.describe({"url": url, "download_video": True}).params,
            inputs={},
            workdir=str(tmp_path / "work"),
            cache_dir=str(tmp_path / "cache"),
        )
    )
    probed = decode.probe(Path(out.files["source"]), 60)
    assert probed.duration_s is not None
    assert probed.duration_s > 1
    if "video" in out.files:
        assert Path(out.files["video"]).stat().st_size > 0
