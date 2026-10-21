"""`chords` stage (torch island): mixture (+ no-drums stem, + bass-root prior) → chords.json.

The recognizer, vocabulary, key estimator and fusion weights come from
`services/ml/config/chords.personal.yaml` (P6 chooses). Stems are the raw separated files of
`separation.json` (drums and bass extras), aligned by `stems.json`'s offset; missing ones are
simply not fused (`inputs_fused` says what was). Confidence is the mean fused beat posterior of a
segment's label (identity calibration until a chord table is fitted).
"""

from __future__ import annotations

import hashlib
import os
import time
from datetime import UTC, datetime
from functools import cache
from pathlib import Path
from typing import Any, Literal

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
import yaml
from numpy.typing import NDArray
from pydantic import BaseModel, ConfigDict, Field
from splitune_ml_core import calibration, contracts
from splitune_ml_core.errors import StageError
from splitune_ml_core.paths import ML_ROOT
from splitune_ml_core.stage_api import StageDescription, StageJob, StageOutput

from . import fusion, key, recognizers
from .fusion import Vocabulary

CONFIG_PATH = ML_ROOT / "config" / "chords.personal.yaml"
RATE = 44100


class ChordsConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int
    recognizer: Literal["consonance_ace", "btc", "madmom_cnn"]
    vocabulary: Literal["majmin", "sevenths"]
    key: Literal["madmom_cnn", "music_core"]
    inputs: list[Literal["mixture", "no_drums"]] = Field(min_length=1)
    bass_root_weight: float = Field(ge=0)
    change_penalty: float = Field(ge=0)


@cache
def load_config() -> ChordsConfig:
    raw = os.environ.get("ML_CHORDS_CONFIG")
    path = Path(raw).expanduser() if raw else CONFIG_PATH
    return ChordsConfig.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))


def effective_params(params: dict[str, Any]) -> dict[str, Any]:
    """Config values, overridable per request (the eval harness runs every combination)."""
    merged = {**load_config().model_dump(), **params}
    merged.pop("version", None)
    try:
        cfg = ChordsConfig.model_validate({**merged, "version": load_config().version})
    except ValueError as exc:
        raise StageError("invalid_params", retry=False) from exc
    if cfg.vocabulary not in recognizers.FACTORIES[cfg.recognizer].vocabularies:
        raise StageError("invalid_params", retry=False)
    return {k: v for k, v in cfg.model_dump().items() if k != "version"}


def read_json(inputs: dict[str, str] | None, name: str) -> str | None:
    if not inputs or name not in inputs:
        return None
    return Path(inputs[name]).read_text(encoding="utf-8")


def stem_of(
    separation: contracts.Separation | None, instrument: str
) -> contracts.SeparatedStem | None:
    if separation is None:
        return None
    return next((s for s in separation.stems if s.instrument == instrument), None)


def describe(params: dict[str, Any], inputs: dict[str, str] | None = None) -> StageDescription:
    effective = effective_params(params)
    beats = read_json(inputs, "beats")
    if beats is None:
        raise StageError("invalid_request", retry=False)
    sep_text = read_json(inputs, "separation")
    separation = contracts.Separation.model_validate_json(sep_text) if sep_text else None
    stems_text = read_json(inputs, "stems")
    recognizer = recognizers.get(str(effective["recognizer"]))
    refs = [recognizer.model_ref()]
    if effective["key"] == "madmom_cnn":
        refs.append(key.madmom_ref())
    drums = stem_of(separation, "drums")
    bass = stem_of(separation, "bass")
    return StageDescription(
        model_refs=refs,
        params={
            **effective,
            "calibration": calibration.describe(
                calibration.load(recognizer.record, recognizer.model_ref().version)
            ),
            # The key follows the beat grid and the stems actually fused.
            "beats": hashlib.sha256(beats.encode()).hexdigest(),
            "drums": drums.sha256 if drums else None,
            "bass": bass.sha256 if bass else None,
            "alignment_offset_samples": (
                contracts.Stems.model_validate_json(stems_text).alignment_offset_samples
                if stems_text
                else 0
            ),
        },
    )


def load_stem(job: StageJob, stem: contracts.SeparatedStem, frames: int) -> NDArray[np.float32]:
    from stage_separation import dsp
    from stage_separation.stem_post import load_raw

    raw = load_raw(Path(job.cache_dir), stem, frames)
    return (
        dsp.shift(raw, int(job.params["alignment_offset_samples"])).mean(axis=1).astype(np.float32)
    )


def bass_chroma(bass: NDArray[np.float32], spans: NDArray[np.float64]) -> NDArray[np.float64]:
    """Per-span pitch-class energy of the bass stem's E1-E4 range."""
    import librosa  # pyright: ignore[reportMissingTypeStubs]

    audio = np.asarray(recognizers.to_22k(bass))
    cqt: NDArray[np.float64] = np.abs(
        librosa.cqt(  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]
            audio, sr=22050, hop_length=512, fmin=41.2034, n_bins=36, bins_per_octave=12
        )
    )
    pcs = (4 + np.arange(36)) % 12  # bin 0 = E
    folded = np.zeros((12, cqt.shape[1]))
    for b, pc in enumerate(pcs):
        folded[pc] += cqt[b] ** 2
    times = np.arange(cqt.shape[1], dtype=np.float64) * 512 / 22050
    out = np.zeros((len(spans), 12))
    for i, (t0, t1) in enumerate(spans):
        inside = (times >= t0) & (times < t1)
        if inside.any():
            out[i] = folded[:, inside].sum(axis=1)
    # Spans far quieter than the stem's typical level count as silent (neutral prior).
    level = out.sum(axis=1)
    if (level > 0).any():
        out[level < 0.01 * float(np.median(level[level > 0]))] = 0
    return out


def run(job: StageJob) -> StageOutput:
    if job.decoded_path is None or job.audio_hash is None or job.duration_s is None:
        raise StageError("decoded_audio_missing", retry=False)
    started = time.process_time()
    params = job.params
    vocabulary: Vocabulary = params["vocabulary"]
    beats = contracts.Beats.model_validate_json(read_json(job.inputs, "beats") or "")
    sep_text = read_json(job.inputs, "separation")
    separation = contracts.Separation.model_validate_json(sep_text) if sep_text else None
    data, _ = sf.read(job.decoded_path, dtype="float32", always_2d=True)
    mixture = np.asarray(data, dtype=np.float32)
    mono = mixture.mean(axis=1).astype(np.float32)
    spans = fusion.intervals(np.array([b.t for b in beats.beats]), float(job.duration_s))
    recognizer = recognizers.get(str(params["recognizer"]))

    sources: list[tuple[str, NDArray[np.float32]]] = []
    if "mixture" in params["inputs"]:
        sources.append(("mixture", mono))
    drums = stem_of(separation, "drums")
    if "no_drums" in params["inputs"] and drums is not None:
        sources.append(("no_drums", mono - load_stem(job, drums, len(mixture))))
    if not sources:
        sources.append(("mixture", mono))
    beat_logp = [
        fusion.beat_sync(recognizer.frame_probs(audio, vocabulary), spans) for _, audio in sources
    ]
    logp = fusion.log_normalize(np.mean(beat_logp, axis=0))
    fused = [name for name, _ in sources]
    bass = stem_of(separation, "bass")
    if bass is not None and float(params["bass_root_weight"]) > 0:
        chroma = bass_chroma(load_stem(job, bass, len(mixture)), spans)
        if chroma.any():
            logp = fusion.log_normalize(
                logp + fusion.bass_prior(chroma, vocabulary, float(params["bass_root_weight"]))
            )
            fused.append("bass_root")
    posterior = np.exp(logp)
    path = fusion.viterbi(logp, float(params["change_penalty"]))
    found = fusion.segments(spans, posterior, path, vocabulary)
    table = calibration.load(recognizer.record, recognizer.model_ref().version)
    segments = [
        {
            "id": f"c{i:04d}",
            "t0": round(s.t0, 4),
            "t1": round(s.t1, 4),
            "label": s.label,
            "confidence": round(calibration.calibrate(s.confidence, table), 4),
            "confidence_raw": round(s.confidence, 4),
            "top_k": [{"label": name, "prob": round(p, 4)} for name, p in s.top_k],
            "beat_aligned": True,
        }
        for i, s in enumerate(found)
    ]
    estimated = (
        key.madmom_key(mono) if params["key"] == "madmom_cnn" else key.music_core_key(segments)
    )
    refs = [recognizer.model_ref(), *([key.madmom_ref()] if params["key"] == "madmom_cnn" else [])]
    document = contracts.Chords.model_validate(
        {
            "schema_version": contracts.SCHEMA_VERSION,
            "artefact": "chords",
            "artefact_version": job.artefact_version,
            "analysis_id": job.analysis_id,
            "user_id": job.user_id,
            "audio_hash": job.audio_hash,
            "sample_rate": 44100,
            "duration_s": job.duration_s,
            "models": [r.model_dump(mode="json") for r in refs],
            "params": params,
            "created_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "vocabulary": vocabulary,
            "segments": segments,
            "key": estimated,
            "inputs_fused": fused,
        }
    )
    out = Path(job.workdir) / "chords.json"
    out.write_text(contracts.dump_json(document), encoding="utf-8")
    return StageOutput(
        status="done",
        files={"chords": str(out)},
        model_refs=refs,
        metrics={"cpu_s": time.process_time() - started, "audio_s": float(job.duration_s)},
    )
