"""`notes.<instrument>` stages: the instrument's isolated stem (or the mixture) → notes.json.

Source audio: the raw separated stem for the instrument from `separation.json` (target or kept
extra, aligned by `stems.json`'s offset), so transcription never sees the AAC encode. Without a
separation (stems_unavailable) or without a stem for this instrument the decoded mixture is used
and the stage reports `fallback` / `notes_on_mixture`. Confidence = the transcriber's raw
confidence through `config/calibration/<record>@<version>[.<instrument>].json`. Bass notes also
carry `low_band_energy` for music-core's octave correction (07 §3). With `a4_compensation` the
source's offset from A440 is estimated (tuning.py), the transcriber compensates it and the artefact
records it under `tuning`, with the likely open-string tuning when `tuning_suggestion` is on.
With `string_cue` guitar notes carry `string_probs` from the string classifier (strings.py).
"""

from __future__ import annotations

import time
from collections.abc import Callable
from datetime import UTC, datetime
from functools import cache
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from numpy.typing import NDArray
from splitune_ml_core import calibration, contracts, register
from splitune_ml_core.errors import StageError
from splitune_ml_core.stage_api import StageDescription, StageJob, StageOutput
from stage_separation import dsp
from stage_separation.stem_post import load_raw

from . import strings, transcribers, tuning
from .lowband import low_band_energy

MIXTURE = "mixture"
STRING_CUE_RECORD = "string-cue"


def read_separation(inputs: dict[str, str] | None) -> contracts.Separation | None:
    if not inputs or "separation" not in inputs:
        return None
    return contracts.Separation.model_validate_json(
        Path(inputs["separation"]).read_text(encoding="utf-8")
    )


def read_offset(inputs: dict[str, str] | None) -> int:
    if not inputs or "stems" not in inputs:
        return 0
    stems = contracts.Stems.model_validate_json(Path(inputs["stems"]).read_text(encoding="utf-8"))
    return stems.alignment_offset_samples


def source_stem(
    separation: contracts.Separation | None, instrument: str
) -> contracts.SeparatedStem | None:
    if separation is None:
        return None
    return next(
        (
            s
            for s in separation.stems
            if s.instrument == instrument and s.role in ("target", "extra")
        ),
        None,
    )


def string_cue_ref() -> contracts.ModelRef:
    return transcribers.ref_for(STRING_CUE_RECORD, "splitune/string_cue")


@cache
def string_model() -> strings.StringModel:
    record = register.model(STRING_CUE_RECORD)
    (path,) = register.verify(record, transcribers.models_dir() / "string-cue")
    return strings.StringModel.load(path)


def uses_string_cue(instrument: str, params: dict[str, Any]) -> bool:
    return instrument == "guitar" and bool(params.get("string_cue"))


def bind(
    instrument: str,
) -> tuple[Callable[..., StageDescription], Callable[[StageJob], StageOutput]]:
    """describe/run for one instrument (the `notes.<instrument>` stage modules)."""

    def describe(params: dict[str, Any], inputs: dict[str, str] | None = None) -> StageDescription:
        transcriber, effective = transcribers.for_instrument(instrument)
        ref = transcriber.model_ref()
        table = calibration.load(transcriber.record, ref.version, instrument)
        stem = source_stem(read_separation(inputs), instrument)
        return StageDescription(
            model_refs=[
                ref,
                *([string_cue_ref()] if uses_string_cue(instrument, effective) else []),
            ],
            params={
                "instrument": instrument,
                "transcriber": transcriber.name,
                **effective,
                "calibration": calibration.describe(table),
                # The key follows the audio actually transcribed.
                "source": stem.sha256 if stem is not None else MIXTURE,
                "alignment_offset_samples": read_offset(inputs),
            },
        )

    def run(job: StageJob) -> StageOutput:
        return transcribe(job, instrument)

    return describe, run


def load_source(job: StageJob, instrument: str) -> tuple[str, NDArray[np.float32]]:
    if job.decoded_path is None:
        raise StageError("decoded_audio_missing", retry=False)
    data, _ = sf.read(job.decoded_path, dtype="float32", always_2d=True)
    mixture = np.asarray(data, dtype=np.float32)
    stem = source_stem(read_separation(job.inputs), instrument)
    if stem is None:
        return MIXTURE, mixture
    raw = load_raw(Path(job.cache_dir), stem, len(mixture))
    return instrument, dsp.shift(raw, int(job.params["alignment_offset_samples"]))


def transcribe(job: StageJob, instrument: str) -> StageOutput:
    if job.audio_hash is None or job.duration_s is None:
        raise StageError("decoded_audio_missing", retry=False)
    started = time.process_time()
    params = job.params
    transcriber, _ = transcribers.for_instrument(instrument)
    ref = transcriber.model_ref()
    table = calibration.load(transcriber.record, ref.version, instrument)
    stem_id, audio = load_source(job, instrument)
    mono = audio.mean(axis=1).astype(np.float32)
    recording: dict[str, Any] | None = None
    if params.get("a4_compensation"):
        offset = tuning.a4_offset(mono)
        params = {**params, "a4_cents": offset.cents}
        recording = {"a4_cents": offset.cents, "a4_strength": offset.strength}
    events = sorted(transcriber.transcribe(mono, params), key=lambda e: (e.onset_s, e.pitch_midi))
    if recording is not None and params.get("tuning_suggestion") and instrument in tuning.TUNINGS:
        suggestion = tuning.suggest_tuning(
            [
                tuning.NoteLike(
                    e.pitch_midi,
                    e.offset_s - e.onset_s,
                    calibration.calibrate(e.confidence_raw, table),
                )
                for e in events
            ],
            instrument,
            min_low_notes=int(params["tuning_min_low_notes"]),
            min_confidence=float(params["tuning_min_confidence"]),
            min_duration_s=float(params["tuning_min_duration_s"]),
        )
        recording["suggested"] = {
            "name": suggestion.name,
            "tuning_midi": list(suggestion.tuning_midi),
            "confidence": suggestion.confidence,
        }
    models = [ref]
    probs: list[list[float]] | None = None
    if uses_string_cue(instrument, params):
        models.append(string_cue_ref())
        cue = string_model().probs(mono, [(e.onset_s, e.pitch_midi) for e in events])
        probs = [[round(float(v), 4) for v in row] for row in cue]
    notes: list[dict[str, Any]] = []
    for i, e in enumerate(events):
        if e.offset_s <= e.onset_s:
            continue
        note: dict[str, Any] = {
            "id": f"n{i:06d}",
            "onset_s": round(e.onset_s, 4),
            "offset_s": round(e.offset_s, 4),
            "pitch_midi": e.pitch_midi,
            "velocity": e.velocity,
            "confidence": round(calibration.calibrate(e.confidence_raw, table), 4),
            "confidence_raw": round(e.confidence_raw, 4),
            "stem_id": stem_id,
        }
        if probs is not None:
            note["string_probs"] = probs[i]
        if e.bend_cents:
            note["bend_cents"] = [list(point) for point in e.bend_cents]
        if instrument == "bass":
            note["low_band_energy"] = round(
                low_band_energy(mono, e.onset_s, e.offset_s, e.pitch_midi), 4
            )
        notes.append(note)
    fallback = "notes_on_mixture" if stem_id == MIXTURE else None
    document = contracts.Notes.model_validate(
        {
            "schema_version": contracts.SCHEMA_VERSION,
            "artefact": f"notes.{instrument}",
            "artefact_version": job.artefact_version,
            "analysis_id": job.analysis_id,
            "user_id": job.user_id,
            "audio_hash": job.audio_hash,
            "sample_rate": 44100,
            "duration_s": job.duration_s,
            "models": [m.model_dump(mode="json") for m in models],
            "params": job.params,
            "created_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "instrument": instrument,
            "notes": notes,
            **({} if recording is None else {"tuning": recording}),
        }
    )
    out = Path(job.workdir) / f"notes.{instrument}.json"
    out.write_text(contracts.dump_json(document), encoding="utf-8")
    return StageOutput(
        status="fallback" if fallback else "done",
        files={"notes": str(out)},
        model_refs=models,
        metrics={"cpu_s": time.process_time() - started, "audio_s": float(job.duration_s)},
        fallback_reason=fallback,
    )
