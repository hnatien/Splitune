"""`separate` stage (torch island): decoded mixture + tags.json → separation.json, with the raw
stems written to the worker's local cache (25 §5: separated audio stays on the Mac's disk).

Runs the learner instrument's fallback chain from the model map: the first model whose weights
verify against the register and whose run succeeds wins. A later model than the first gives
status `fallback` (`separation_fallback_model`); no model gives `stems_unavailable`, a permanent
failure after which the analysis continues without stems (06 §6).

Only what the analysis needs is kept (06 §4 "request one target"): the learner's stem, the
complement parts when mix-minus is `complement`, and the `keep` extras (drums, bass) when the same
run produced them and the tagger hears them.
"""

from __future__ import annotations

import hashlib
import logging
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from numpy.typing import NDArray
from splitune_ml_core import contracts
from splitune_ml_core.errors import StageError
from splitune_ml_core.keys import canonical_json
from splitune_ml_core.stage_api import StageDescription, StageJob, StageOutput

from . import config, models
from .config import ModelSpec, SeparationConfig

log = logging.getLogger("splitune.separate")

Role = Literal["target", "complement", "extra"]
# A model may pad or trim a few samples at the end; anything bigger means a broken run.
MAX_LENGTH_DRIFT = 0.01


def read_tags(inputs: dict[str, str] | None) -> contracts.Tags | None:
    if not inputs or "tags" not in inputs:
        return None
    return contracts.Tags.model_validate_json(Path(inputs["tags"]).read_text(encoding="utf-8"))


def heard(tags: contracts.Tags | None, instrument: str, min_prob: float) -> bool:
    """Without usable tags every instrument counts as present (06 §2 tag fallback)."""
    if tags is None or tags.fallback_reason is not None:
        return True
    probs: dict[str, float] = {t.instrument: t.present_prob for t in tags.instruments}
    return probs.get(instrument, 1.0) >= min_prob


def plan(
    cfg: SeparationConfig, params: dict[str, Any], tags: contracts.Tags | None
) -> dict[str, Any]:
    instrument = params.get("instrument")
    if instrument not in cfg.instruments:
        raise StageError("invalid_params", retry=False)
    spec = cfg.instruments[instrument]
    keep = [i for i in cfg.keep if i != instrument and heard(tags, i, cfg.keep_min_prob)]
    return {
        "instrument": instrument,
        "chain": spec.chain,
        "mix_minus": spec.mix_minus,
        "keep": keep,
        "config_version": cfg.version,
    }


def describe(params: dict[str, Any], inputs: dict[str, str] | None = None) -> StageDescription:
    """`model_refs` name the chain's first model: the cache key follows the configured map."""
    cfg = config.load()
    effective = plan(cfg, params, read_tags(inputs))
    return StageDescription(
        model_refs=[models.model_ref(cfg.models[effective["chain"][0]])], params=effective
    )


def roles(spec: ModelSpec, params: dict[str, Any]) -> dict[str, Role]:
    """Model outputs to keep and why."""
    out: dict[str, Role] = {}
    for name, instrument in spec.outputs.items():
        if instrument == params["instrument"]:
            out[name] = "target"
        elif instrument is not None and instrument in params["keep"]:
            out[name] = "extra"
        elif params["mix_minus"] == "complement":
            out[name] = "complement"
    return out


def load_stem(path: Path | None, frames: int) -> NDArray[np.float32]:
    """A model output as [frames, 2]; a stem the library skipped as silent is zeros."""
    if path is None:
        return np.zeros((frames, 2), dtype=np.float32)
    data, rate = sf.read(str(path), dtype="float32", always_2d=True)
    audio = np.asarray(data, dtype=np.float32)
    if int(rate) != 44100 or audio.shape[1] != 2 or not np.isfinite(audio).all():
        raise StageError("separation_output_invalid")
    if abs(len(audio) - frames) > MAX_LENGTH_DRIFT * frames:
        raise StageError("separation_output_invalid")
    if len(audio) >= frames:
        return audio[:frames]
    return np.pad(audio, ((0, frames - len(audio)), (0, 0)))


def run_id(job: StageJob, name: str, ref: contracts.ModelRef, kept: dict[str, Role]) -> str:
    """Cache directory of one separation: same audio, weights and kept outputs → same files."""
    key = canonical_json([job.audio_hash, name, ref.weights_sha256, sorted(kept.items())])
    return hashlib.sha256(key.encode()).hexdigest()[:32]


def store(audio: NDArray[np.float32], dest: Path) -> str:
    """24-bit FLAC (atomic rename), like decode's cache; returns the file's sha256."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    temp = dest.with_name(f".{dest.name}.{os.getpid()}.tmp")
    sf.write(str(temp), np.clip(audio, -1.0, 1.0), 44100, format="FLAC", subtype="PCM_24")  # pyright: ignore[reportUnknownMemberType]
    temp.replace(dest)
    return hashlib.sha256(dest.read_bytes()).hexdigest()


def run(job: StageJob) -> StageOutput:
    if job.decoded_path is None or job.audio_hash is None or job.duration_s is None:
        raise StageError("decoded_audio_missing", retry=False)
    cfg = config.load()
    params = job.params
    workdir = Path(job.workdir)
    data, _ = sf.read(job.decoded_path, dtype="float32", always_2d=True)
    frames = len(data)
    mixture = workdir / "mixture.wav"
    sf.write(str(mixture), data, 44100, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    del data

    attempts: list[dict[str, str]] = []
    for name in params["chain"]:
        spec = cfg.models[name]
        try:
            ref = models.model_ref(spec)
            result = models.separate(name, spec, mixture, workdir / "separated" / name)
            kept = roles(spec, params)
            stems = {stem: load_stem(result.files.get(stem), frames) for stem in kept}
            break
        except StageError as exc:
            log.warning("separation model failed", extra={"model": name, "error_code": exc.code})
            attempts.append({"model": name, "error_code": exc.code})
    else:
        raise StageError("stems_unavailable", retry=False)

    directory = run_id(job, name, ref, kept)
    cache = Path(job.cache_dir) / "separated"
    entries: list[dict[str, Any]] = []
    for stem, audio in stems.items():
        file = f"{directory}/{stem}.flac"
        entry: dict[str, Any] = {
            "name": stem,
            "role": kept[stem],
            "file": file,
            "sha256": store(audio, cache / file),
            "frames": frames,
        }
        if spec.outputs[stem] is not None:
            entry["instrument"] = spec.outputs[stem]
        entries.append(entry)

    device = models.device()
    document = contracts.Separation.model_validate(
        {
            "schema_version": contracts.SCHEMA_VERSION,
            "artefact": "separation",
            "artefact_version": job.artefact_version,
            "analysis_id": job.analysis_id,
            "user_id": job.user_id,
            "audio_hash": job.audio_hash,
            "sample_rate": 44100,
            "duration_s": job.duration_s,
            "models": [ref.model_dump(mode="json")],
            "params": params,
            "created_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "target": params["instrument"],
            "provider": spec.provider,
            "mix_minus": params["mix_minus"],
            "device": device,
            "stems": entries,
            "failed_attempts": attempts,
        }
    )
    out = workdir / "separation.json"
    out.write_text(contracts.dump_json(document), encoding="utf-8")
    fallback = "separation_fallback_model" if attempts else None
    metric = "gpu_s" if device == "mps" else "cpu_s"
    return StageOutput(
        status="fallback" if fallback else "done",
        files={"separation": str(out)},
        model_refs=[ref],
        metrics={
            metric: result.seconds,
            "peak_vram_mb": result.peak_mb,
            "audio_s": float(job.duration_s),
        },
        fallback_reason=fallback,
    )
