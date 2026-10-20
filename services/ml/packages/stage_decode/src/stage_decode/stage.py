"""`decode` stage: source file → probe.json artefact + decoded FLAC in the local cache."""

from __future__ import annotations

import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from splitune_ml_core import contracts, ffmpeg
from splitune_ml_core.errors import StageError
from splitune_ml_core.stage_api import StageDescription, StageJob, StageOutput

from . import decode

DEFAULT_MAX_DURATION_S = 20 * 60  # 06 §4: ≤20 min
DECODE_TIMEOUT_S = 120.0  # 06 §2


def describe(params: dict[str, Any], inputs: dict[str, str] | None = None) -> StageDescription:
    max_duration = params.get("max_duration_s", DEFAULT_MAX_DURATION_S)
    if not isinstance(max_duration, int | float) or not 0 < max_duration <= DEFAULT_MAX_DURATION_S:
        max_duration = DEFAULT_MAX_DURATION_S
    return StageDescription(
        model_refs=[],
        params={
            "ffmpeg": ffmpeg.version(),
            "sample_rate": decode.SAMPLE_RATE,
            "channels": decode.CHANNELS,
            "max_duration_s": max_duration,
        },
    )


def _cpu_s() -> float:
    """CPU time of this process plus finished children (ffmpeg/ffprobe)."""
    t = os.times()
    return t.user + t.system + t.children_user + t.children_system


def run(job: StageJob) -> StageOutput:
    started = _cpu_s()
    source = Path(job.inputs["source"])
    workdir = Path(job.workdir)
    max_duration = float(job.params["max_duration_s"])

    probed = decode.probe(source, DECODE_TIMEOUT_S)
    if probed.duration_s is not None and probed.duration_s > max_duration + 1:
        raise StageError("too_long", retry=False)
    pcm = workdir / "decoded.f32"
    frames = decode.decode_pcm(source, pcm, max_duration, DECODE_TIMEOUT_S)
    audio_hash = decode.sha256_file(pcm)
    lufs, peak_db = decode.loudness(pcm)
    flac = Path(job.cache_dir) / "decoded" / f"{audio_hash}.flac"
    if not flac.is_file():
        decode.encode_flac(pcm, flac, DECODE_TIMEOUT_S)
    pcm.unlink()

    duration_s = frames / decode.SAMPLE_RATE
    document = contracts.Probe.model_validate(
        {
            "schema_version": contracts.SCHEMA_VERSION,
            "artefact": "probe",
            "artefact_version": job.artefact_version,
            "analysis_id": job.analysis_id,
            "user_id": job.user_id,
            "audio_hash": audio_hash,
            "sample_rate": decode.SAMPLE_RATE,
            "duration_s": duration_s,
            "models": [],
            "params": job.params,
            "created_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "container": probed.container,
            "source_bytes": source.stat().st_size,
            "source_sha256": decode.sha256_file(source),
            "source_duration_s": probed.duration_s,
            "audio_streams": probed.audio_streams,
            "audio_stream": probed.stream,
            "decoded_frames": frames,
            "loudness_lufs": lufs,
            "peak_dbfs": peak_db,
        }
    )
    out = workdir / "probe.json"
    out.write_text(contracts.dump_json(document), encoding="utf-8")
    return StageOutput(
        status="done",
        files={"probe": str(out)},
        model_refs=[],
        metrics={"cpu_s": _cpu_s() - started, "audio_s": duration_s},
        facts={"audio_hash": audio_hash, "duration_s": duration_s, "decoded_path": str(flac)},
    )
