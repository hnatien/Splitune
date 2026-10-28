"""`notes.drums` stage: the drum stem (or the mixture) → `notes/drums.json` (05 `DrumNotes`).

Same source rules as the pitched `notes.<instrument>` stages (stage.py): the raw separated drum
stem, or the decoded mixture with `fallback` / `notes_on_mixture` when there is none. Hits get a
class and a GM kit piece through `drum_kit` (5-class guesses flagged `approximate`); with the
song's beats the crash/ride default looks at downbeats. Confidence = the transcriber's raw score
through `config/calibration/<record>@<version>.drums.json`.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from splitune_ml_core import calibration, contracts
from splitune_ml_core.errors import StageError
from splitune_ml_core.stage_api import StageDescription, StageJob, StageOutput

from . import drum_kit, transcribers
from .stage import MIXTURE, load_source, read_offset, read_separation, solo, source_stem

INSTRUMENT = "drums"


def drum_transcriber(source: str) -> tuple[transcribers.DrumTranscriber, dict[str, Any]]:
    transcriber, effective = transcribers.for_instrument(INSTRUMENT, source)
    if not isinstance(transcriber, transcribers.DrumTranscriber):
        raise StageError("invalid_params", retry=False)
    return transcriber, effective


def read_downbeats(inputs: dict[str, str] | None) -> list[float] | None:
    if not inputs or "beats" not in inputs:
        return None
    beats = contracts.Beats.model_validate_json(Path(inputs["beats"]).read_text(encoding="utf-8"))
    return [b.t for b in beats.beats if b.is_downbeat] or None


def describe(params: dict[str, Any], inputs: dict[str, str] | None = None) -> StageDescription:
    separation = read_separation(inputs)
    stem = None if solo(separation, INSTRUMENT) else source_stem(separation, INSTRUMENT)
    transcriber, effective = drum_transcriber(
        "stem" if stem is not None or solo(separation, INSTRUMENT) else MIXTURE
    )
    ref = transcriber.model_ref()
    table = calibration.load(transcriber.record, ref.version, INSTRUMENT)
    return StageDescription(
        model_refs=[ref],
        params={
            "instrument": INSTRUMENT,
            "transcriber": transcriber.name,
            **effective,
            "calibration": calibration.describe(table),
            "source": stem.sha256 if stem is not None else MIXTURE,
            "alignment_offset_samples": read_offset(inputs),
            # The crash/ride default reads the downbeats, so they are part of the key.
            "downbeats": "beats" in (inputs or {}),
        },
    )


def run(job: StageJob) -> StageOutput:
    if job.audio_hash is None or job.duration_s is None:
        raise StageError("decoded_audio_missing", retry=False)
    started = time.process_time()
    params = job.params
    stem_id, audio = load_source(job, INSTRUMENT)
    bypass = solo(read_separation(job.inputs), INSTRUMENT)
    transcriber, _ = drum_transcriber(MIXTURE if stem_id == MIXTURE and not bypass else "stem")
    ref = transcriber.model_ref()
    table = calibration.load(transcriber.record, ref.version, INSTRUMENT)
    found = transcriber.transcribe_drums(audio.mean(axis=1).astype("float32"), params)
    events = sorted(
        (e for e in found if drum_kit.class_of(e.gm_note) is not None),
        key=lambda e: (e.onset_s, e.gm_note),
    )
    classes: list[drum_kit.Class5] = [
        c for e in events if (c := drum_kit.class_of(e.gm_note)) is not None
    ]
    defaults = drum_kit.default_choices(
        list(zip([e.onset_s for e in events], classes, strict=True)),
        read_downbeats(job.inputs),
        float(params.get("crash_gap_s", 1.0)),
    )
    hits: list[dict[str, Any]] = []
    for i, (e, cls, default) in enumerate(zip(events, classes, defaults, strict=True)):
        hit: dict[str, Any] = {
            "id": f"d{i:06d}",
            "onset_s": round(e.onset_s, 4),
            "class5": cls,
            "gm_note": e.gm_note if e.named else default.gm_note,
            "approximate": False if e.named else default.approximate,
            "confidence": round(calibration.calibrate(e.confidence_raw, table), 4),
            "confidence_raw": round(e.confidence_raw, 4),
        }
        if e.velocity is not None:
            hit["velocity"] = e.velocity
        hits.append(hit)
    fallback = "notes_on_mixture" if stem_id == MIXTURE and not bypass else None
    document = contracts.DrumNotes.model_validate(
        {
            "schema_version": contracts.SCHEMA_VERSION,
            "artefact": "notes.drums",
            "artefact_version": job.artefact_version,
            "analysis_id": job.analysis_id,
            "user_id": job.user_id,
            "audio_hash": job.audio_hash,
            "sample_rate": 44100,
            "duration_s": job.duration_s,
            "models": [ref.model_dump(mode="json")],
            "params": params,
            "created_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "instrument": INSTRUMENT,
            "hits": hits,
        }
    )
    out = Path(job.workdir) / "notes.drums.json"
    out.write_text(contracts.dump_json(document), encoding="utf-8")
    return StageOutput(
        status="fallback" if fallback else "done",
        files={"notes": str(out)},
        model_refs=[ref],
        metrics={"cpu_s": time.process_time() - started, "audio_s": float(job.duration_s)},
        fallback_reason=fallback,
    )
