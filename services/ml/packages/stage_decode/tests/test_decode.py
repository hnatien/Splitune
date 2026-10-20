from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path
from typing import Any

import pytest
from splitune_ml_core import contracts, ffmpeg
from splitune_ml_core.errors import StageError
from splitune_ml_core.stage_api import StageJob
from stage_decode import stage

ANALYSIS = "0192f6c4-8b00-7a00-8000-0000000000aa"


def job(source: Path, tmp: Path, **params: Any) -> StageJob:
    work = tmp / "work"
    work.mkdir(exist_ok=True)
    return StageJob(
        stage="decode",
        analysis_id=ANALYSIS,
        user_id="u1",
        artefact_version=1,
        params=stage.describe(params).params,
        inputs={"source": str(source)},
        workdir=str(work),
        cache_dir=str(tmp / "cache"),
    )


def encode(source: Path, dest: Path, *args: str) -> Path:
    subprocess.run(
        [ffmpeg.binary("ffmpeg"), "-v", "error", "-y", "-i", str(source), *args, str(dest)],
        check=True,
    )
    return dest


def test_decode_writes_probe_hash_and_flac(click_track: Any, tmp_path: Path) -> None:
    source = encode(click_track(seconds=6), tmp_path / "in.m4a", "-c:a", "aac", "-b:a", "128k")
    out = stage.run(job(source, tmp_path))
    probe = contracts.Probe.model_validate_json(Path(out.files["probe"]).read_text())
    assert probe.artefact == "probe"
    assert probe.container.startswith("mov")
    assert probe.audio_stream.codec == "aac"
    assert probe.audio_streams == 1
    assert probe.source_sha256 == hashlib.sha256(source.read_bytes()).hexdigest()
    assert probe.loudness_lufs is not None
    assert -30 < probe.loudness_lufs < 0
    assert probe.peak_dbfs is not None
    assert probe.peak_dbfs <= 0.5
    assert abs(probe.duration_s - 6) < 0.1
    assert probe.decoded_frames == round(probe.duration_s * 44100)

    # audio_hash is the sha256 of ffmpeg's canonical f32le stream.
    raw = subprocess.run(
        [
            ffmpeg.binary("ffmpeg"),
            "-v",
            "error",
            "-i",
            str(source),
            "-map",
            "0:a:0",
            "-ac",
            "2",
            "-ar",
            "44100",
            "-f",
            "f32le",
            "-",
        ],
        check=True,
        capture_output=True,
    ).stdout
    assert probe.audio_hash == hashlib.sha256(raw).hexdigest() == out.facts["audio_hash"]
    flac = Path(out.facts["decoded_path"])
    assert flac == tmp_path / "cache" / "decoded" / f"{probe.audio_hash}.flac"
    assert flac.is_file()
    assert not (Path(job(source, tmp_path).workdir) / "decoded.f32").exists()


def test_same_audio_same_hash_across_containers(click_track: Any, tmp_path: Path) -> None:
    wav = click_track(seconds=3)
    flac = encode(wav, tmp_path / "in.flac", "-c:a", "flac")
    a = stage.run(job(wav, tmp_path)).facts["audio_hash"]
    b = stage.run(job(flac, tmp_path)).facts["audio_hash"]
    assert a == b


def test_limits_and_bad_input(click_track: Any, tmp_path: Path) -> None:
    with pytest.raises(StageError) as err:
        stage.run(job(click_track(seconds=5), tmp_path, max_duration_s=2))
    assert err.value.code == "too_long"
    assert not err.value.retry

    text = tmp_path / "notes.txt"
    text.write_text("not audio")
    with pytest.raises(StageError) as err:
        stage.run(job(text, tmp_path))
    assert err.value.code == "unsupported_media"
    assert not err.value.retry


def test_silence_has_no_loudness(tmp_path: Path) -> None:
    silent = tmp_path / "silence.wav"
    subprocess.run(
        [
            ffmpeg.binary("ffmpeg"),
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=48000:cl=mono",
            "-t",
            "2",
            str(silent),
        ],
        check=True,
    )
    probe = contracts.Probe.model_validate_json(
        Path(stage.run(job(silent, tmp_path)).files["probe"]).read_text()
    )
    assert probe.loudness_lufs is None
    assert probe.peak_dbfs is None
    assert probe.audio_stream.sample_rate == 48000
    assert probe.decoded_frames == 2 * 44100


def test_describe_clamps_the_duration_limit() -> None:
    assert stage.describe({"max_duration_s": 99999}).params["max_duration_s"] == 1200
    assert stage.describe({}).params["ffmpeg"] == ffmpeg.version()
