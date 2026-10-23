"""`beats` stage: decoded FLAC → beats.json (Beat This! final0 on MPS, small0 on CPU fallback)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from splitune_ml_core import contracts
from splitune_ml_core.errors import StageError
from splitune_ml_core.stage_api import StageDescription, StageJob, StageOutput

from . import grid, model

log = logging.getLogger("splitune.beats")

DEFAULTS: dict[str, Any] = {
    "model": model.FULL,
    "dbn": False,  # madmom's DBN is not used (06 §4)
    "octave_margin": 0.5,
    "octave_bpm_range": [75, 150],
    "bpm_curve_spread": 0.04,
}


def effective_params(params: dict[str, Any]) -> dict[str, Any]:
    merged = {**DEFAULTS, **{k: v for k, v in params.items() if k in DEFAULTS}}
    if merged["model"] not in {model.FULL, model.SMALL} or merged["dbn"] is not False:
        raise StageError("invalid_params", retry=False)
    return merged


def describe(params: dict[str, Any], inputs: dict[str, str] | None = None) -> StageDescription:
    """`params.model` is the requested model; `model_refs` name the one this island will run
    (small0 on the CPU fallback), so the cache key changes with it."""
    effective = effective_params(params)
    used = model.choose(str(effective["model"])).model
    return StageDescription(model_refs=[model.model_ref(used)], params=effective)


def build(
    job: StageJob,
    inference: model.Inference,
    params: dict[str, Any],
    refs: list[contracts.ModelRef],
) -> contracts.Beats:
    times = [round(float(t), 4) for t in inference.beats]
    if len(times) < 2:
        raise StageError("beats_not_found", retry=False)
    downbeat_set = {round(float(t), 4) for t in inference.downbeats}
    flags = [t in downbeat_set for t in times]
    per_bar = grid.modal_bar_length(flags)
    labels = grid.label_beats(flags, per_bar)
    frames = [min(round(t * grid.FPS), len(inference.activation) - 1) for t in times]
    bpm = grid.median_bpm(times)
    lo, hi = params["octave_bpm_range"]
    ambiguous = grid.octave_ambiguous(
        inference.activation,
        frames,
        bpm,
        margin=float(params["octave_margin"]),
        bpm_range=(float(lo), float(hi)),
    )
    first_downbeat = next(t for t, b in zip(times, labels.bars, strict=True) if b == 0)
    curve = grid.bpm_curve(times, labels, float(params["bpm_curve_spread"]))
    return contracts.Beats.model_validate(
        {
            "schema_version": contracts.SCHEMA_VERSION,
            "artefact": "beats",
            "artefact_version": job.artefact_version,
            "analysis_id": job.analysis_id,
            "user_id": job.user_id,
            "audio_hash": job.audio_hash,
            "sample_rate": 44100,
            "duration_s": job.duration_s,
            "models": [r.model_dump(mode="json") for r in refs],
            "params": params,
            "created_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "beats": [
                {
                    "id": f"b{i:04d}",
                    "t": t,
                    "activation": round(float(np.clip(inference.activation[f], 0, 1)), 4),
                    "is_downbeat": down,
                    "bar_index": bar,
                    "beat_in_bar": beat,
                }
                for i, (t, f, down, bar, beat) in enumerate(
                    zip(
                        times,
                        frames,
                        labels.is_downbeat,
                        labels.bars,
                        labels.beat_in_bar,
                        strict=True,
                    )
                )
            ],
            "bpm": round(bpm, 3),
            "bpm_curve": curve,
            "meter": {"numerator": per_bar, "denominator": 4},
            "tempo_octave_ambiguous": ambiguous,
            "first_downbeat_t": first_downbeat,
        }
    )


def run(job: StageJob) -> StageOutput:
    if job.decoded_path is None or job.audio_hash is None or job.duration_s is None:
        raise StageError("decoded_audio_missing", retry=False)
    params = job.params
    choice = model.choose(str(params["model"]))
    data, sample_rate = sf.read(job.decoded_path, dtype="float32", always_2d=True)
    signal = np.asarray(data, dtype=np.float32)
    fallback = choice.fallback_reason
    try:
        inference = model.infer(signal, int(sample_rate), choice.model, choice.device)
    except RuntimeError:
        if choice.device == "cpu":
            raise
        # Accelerator kernels can fail on new OS/torch; small CPU model still gives a grid.
        log.exception(
            f"{choice.device.upper()} inference failed; falling back to CPU",
            extra={"model": choice.model},
        )
        choice = model.Choice(model.SMALL, "cpu", f"beats_{choice.device}_failed")
        fallback = choice.fallback_reason
        inference = model.infer(signal, int(sample_rate), choice.model, choice.device)
    refs = [model.model_ref(choice.model)]
    document = build(job, inference, params, refs)
    out = Path(job.workdir) / "beats.json"
    out.write_text(contracts.dump_json(document), encoding="utf-8")
    metric = "gpu_s" if choice.device != "cpu" else "cpu_s"
    return StageOutput(
        status="fallback" if fallback else "done",
        files={"beats": str(out)},
        model_refs=refs,
        metrics={metric: inference.seconds, "audio_s": float(job.duration_s)},
        fallback_reason=fallback,
    )
