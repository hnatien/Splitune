"""`tag` stage: decoded mixture → tags.json (clip-level instrument presence, PANNs Cnn14 ONNX).

The song is cut into 10 s windows (the tagger's training clip length); an instrument's song-level
probability is the mean over its most confident quarter of windows, so a part that plays in only
some sections still counts as present. When the model can't be loaded the stage still succeeds
with an empty instrument list and `fallback_reason` (06 §2: "assume requested instrument present").
"""

from __future__ import annotations

import logging
import math
import os
import threading
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import numpy as np
import onnxruntime as ort  # pyright: ignore[reportMissingTypeStubs]
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from numpy.typing import NDArray
from scipy.signal import resample_poly  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]
from splitune_ml_core import contracts, register
from splitune_ml_core.errors import StageError
from splitune_ml_core.stage_api import StageDescription, StageJob, StageOutput

from .labels import CLASSES, SUBTYPES

log = logging.getLogger("splitune.tag")

RECORD = "panns-cnn14"
MODEL_ID = "panns/cnn14"
MODEL_RATE = 32000
BATCH = 4
DEFAULTS: dict[str, Any] = {"window_s": 10, "top_fraction": 0.25, "min_last_window_s": 2}

_lock = threading.Lock()
_sessions: dict[str, ort.InferenceSession] = {}


def models_dir() -> Path:
    return Path(os.environ.get("ML_MODELS_DIR", "~/.cache/splitune/models")).expanduser()


def model_ref() -> contracts.ModelRef:
    record = register.model(RECORD)
    return contracts.ModelRef(
        model_id=MODEL_ID,
        version=record.version,
        weights_sha256=record.weights.sha256,
        provider="self_hosted",
        register_tier=record.tier,
    )


def session() -> ort.InferenceSession:
    """Verified against the register on first use, then kept for the island's lifetime."""
    with _lock:
        if RECORD not in _sessions:
            (path,) = register.verify(register.model(RECORD), models_dir() / "panns")
            options = ort.SessionOptions()  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]
            options.intra_op_num_threads = 2  # one of two CPU slots (25 §5)
            _sessions[RECORD] = ort.InferenceSession(
                str(path),
                sess_options=options,  # pyright: ignore[reportUnknownArgumentType]
                providers=["CPUExecutionProvider"],
            )
        return _sessions[RECORD]


def effective_params(params: dict[str, Any]) -> dict[str, Any]:
    merged = {**DEFAULTS, **{k: v for k, v in params.items() if k in DEFAULTS}}
    if not 0 < float(merged["top_fraction"]) <= 1 or float(merged["window_s"]) <= 0:
        raise StageError("invalid_params", retry=False)
    return merged


def describe(params: dict[str, Any], inputs: dict[str, str] | None = None) -> StageDescription:
    return StageDescription(model_refs=[model_ref()], params=effective_params(params))


def windows(
    mono32k: NDArray[np.float32], window_s: float, min_last_s: float
) -> NDArray[np.float32]:
    size = int(window_s * MODEL_RATE)
    count = max(1, math.ceil(len(mono32k) / size))
    if count > 1 and len(mono32k) - (count - 1) * size < min_last_s * MODEL_RATE:
        count -= 1  # a short tail would be mostly padding
    padded = np.zeros(count * size, dtype=np.float32)
    used = min(len(mono32k), count * size)
    padded[:used] = mono32k[:used]
    return padded.reshape(count, size)


def infer(batch: NDArray[np.float32]) -> NDArray[np.float32]:
    sess = session()
    outputs = [
        cast(
            list[NDArray[np.float32]],
            sess.run(None, {"waveform": batch[i : i + BATCH]}),  # pyright: ignore[reportUnknownMemberType]
        )[0]
        for i in range(0, len(batch), BATCH)
    ]
    return np.concatenate(outputs, axis=0)


def top_mean(values: NDArray[np.float32], fraction: float) -> float:
    k = max(1, math.ceil(len(values) * fraction))
    return float(np.sort(values)[-k:].mean())


def summarise(clipwise: NDArray[np.float32], fraction: float) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for instrument, classes in CLASSES.items():
        per_window = clipwise[:, list(classes)].max(axis=1)
        entry: dict[str, Any] = {
            "instrument": instrument,
            "present_prob": round(min(1.0, max(0.0, top_mean(per_window, fraction))), 4),
        }
        if instrument in SUBTYPES:
            scores = {
                name: top_mean(clipwise[:, list(idx)].max(axis=1), fraction)
                for name, idx in SUBTYPES[instrument].items()
            }
            entry["subtype"] = max(scores, key=lambda name: scores[name])
        out.append(entry)
    return out


def run(job: StageJob) -> StageOutput:
    if job.decoded_path is None or job.audio_hash is None or job.duration_s is None:
        raise StageError("decoded_audio_missing", retry=False)
    params = job.params
    started = time.process_time()
    data, rate = sf.read(job.decoded_path, dtype="float32", always_2d=True)
    mono = np.asarray(data, dtype=np.float32).mean(axis=1)
    resampled = np.asarray(resample_poly(mono, MODEL_RATE, int(rate)), dtype=np.float32)
    batch = windows(resampled, float(params["window_s"]), float(params["min_last_window_s"]))
    fallback: str | None = None
    instruments: list[dict[str, Any]] = []
    refs = [model_ref()]
    try:
        instruments = summarise(infer(batch), float(params["top_fraction"]))
    except StageError as exc:
        # Missing or tampered weights: presence falls back to energy gating alone.
        log.warning("tagger unavailable", extra={"error_code": exc.code})
        fallback = "tagger_unavailable"
    document = contracts.Tags.model_validate(
        {
            "schema_version": contracts.SCHEMA_VERSION,
            "artefact": "tags",
            "artefact_version": job.artefact_version,
            "analysis_id": job.analysis_id,
            "user_id": job.user_id,
            "audio_hash": job.audio_hash,
            "sample_rate": 44100,
            "duration_s": job.duration_s,
            "models": [] if fallback else [r.model_dump(mode="json") for r in refs],
            "params": params,
            "created_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "window_s": params["window_s"],
            "windows": len(batch),
            "instruments": instruments,
            "fallback_reason": fallback,
        }
    )
    out = Path(job.workdir) / "tags.json"
    out.write_text(contracts.dump_json(document), encoding="utf-8")
    return StageOutput(
        status="fallback" if fallback else "done",
        files={"tags": str(out)},
        model_refs=[] if fallback else refs,
        metrics={"cpu_s": time.process_time() - started, "audio_s": float(job.duration_s)},
        fallback_reason=fallback,
    )
