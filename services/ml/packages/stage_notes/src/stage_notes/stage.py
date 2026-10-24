"""`notes.<instrument>` stages: the instrument's isolated stem (or the mixture) → notes.json.

Source audio: the raw separated stem for the instrument from `separation.json` (target or kept
extra, aligned by `stems.json`'s offset), so transcription never sees the AAC encode. Without a
separation (stems_unavailable) or without a stem for this instrument the decoded mixture is used
and the stage reports `fallback` / `notes_on_mixture`. Confidence = the transcriber's raw
confidence through `config/calibration/<record>@<version>[.<instrument>].json`. Bass notes also
carry `low_band_energy` for music-core's octave correction (07 §3).
"""

from __future__ import annotations

import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from numpy.typing import NDArray
from splitune_ml_core import calibration, contracts
from splitune_ml_core.errors import StageError
from splitune_ml_core.stage_api import StageDescription, StageJob, StageOutput
from stage_separation import dsp
from stage_separation.stem_post import load_raw

from . import transcribers
from .lowband import low_band_energy

MIXTURE = "mixture"


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


def solo(separation: contracts.Separation | None, instrument: str) -> bool:
    """The separation found the song to be this instrument alone (solo bypass): its notes come
    from the mixture with the stem transcriber, and that is not a fallback."""
    return (
        separation is not None
        and separation.target == instrument
        and separation.solo_bypass is not None
        and separation.solo_bypass.applied
    )


def bind(
    instrument: str,
) -> tuple[Callable[..., StageDescription], Callable[[StageJob], StageOutput]]:
    """describe/run for one instrument (the `notes.<instrument>` stage modules)."""

    def describe(params: dict[str, Any], inputs: dict[str, str] | None = None) -> StageDescription:
        separation = read_separation(inputs)
        stem = None if solo(separation, instrument) else source_stem(separation, instrument)
        transcriber, effective = transcribers.for_instrument(
            instrument, "stem" if stem is not None or solo(separation, instrument) else MIXTURE
        )
        ref = transcriber.model_ref()
        table = calibration.load(transcriber.record, ref.version, instrument)
        hands = transcribers.hands_model(instrument)
        refs = [ref]
        if hands == "pm2s":
            from . import pm2s_hands

            refs.append(pm2s_hands.model_ref())
        return StageDescription(
            model_refs=refs,
            params={
                "instrument": instrument,
                "transcriber": transcriber.name,
                **effective,
                "calibration": calibration.describe(table),
                # The key follows the audio actually transcribed.
                "source": stem.sha256 if stem is not None else MIXTURE,
                "alignment_offset_samples": read_offset(inputs),
                "hands": hands,
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
    separation = read_separation(job.inputs)
    stem = source_stem(separation, instrument)
    if stem is None or solo(separation, instrument):
        return MIXTURE, mixture
    raw = load_raw(Path(job.cache_dir), stem, len(mixture))
    return instrument, dsp.shift(raw, int(job.params["alignment_offset_samples"]))


def transcribe(job: StageJob, instrument: str) -> StageOutput:
    if job.audio_hash is None or job.duration_s is None:
        raise StageError("decoded_audio_missing", retry=False)
    started = time.process_time()
    params = job.params
    stem_id, audio = load_source(job, instrument)
    bypass = solo(read_separation(job.inputs), instrument)
    transcriber, _ = transcribers.for_instrument(
        instrument, MIXTURE if stem_id == MIXTURE and not bypass else "stem"
    )
    ref = transcriber.model_ref()
    table = calibration.load(transcriber.record, ref.version, instrument)
    mono = audio.mean(axis=1).astype(np.float32)
    # Transcribers with a `stereo` param take the channels and decide themselves (Transkun).
    source = audio.astype(np.float32) if "stereo" in params else mono
    sustain: list[tuple[float, float]] | None = None
    if isinstance(transcriber, transcribers.PedalTranscriber):
        found, sustain = transcriber.transcribe_with_pedal(source, params)
    else:
        found = transcriber.transcribe(source, params)
    events = sorted(found, key=lambda e: (e.onset_s, e.pitch_midi))
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
        if instrument == "bass":
            note["low_band_energy"] = round(
                low_band_energy(mono, e.onset_s, e.offset_s, e.pitch_midi), 4
            )
        notes.append(note)
    refs = [ref]
    if params.get("hands") == "pm2s" and notes:
        from . import pm2s_hands

        refs.append(pm2s_hands.model_ref())
        for note, hand in zip(
            notes,
            pm2s_hands.hands(
                [n["onset_s"] for n in notes],
                [n["offset_s"] for n in notes],
                [n["pitch_midi"] for n in notes],
                [n["velocity"] for n in notes],
            ),
            strict=True,
        ):
            note["hand"] = hand
    fallback = "notes_on_mixture" if stem_id == MIXTURE and not bypass else None
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
            "models": [r.model_dump(mode="json") for r in refs],
            "params": params,
            "created_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "instrument": instrument,
            "notes": notes,
            **(
                {
                    "sustain": [
                        {"on_s": round(a, 4), "off_s": round(b, 4)} for a, b in sustain if b > a
                    ]
                }
                if sustain is not None
                else {}
            ),
        }
    )
    out = Path(job.workdir) / f"notes.{instrument}.json"
    out.write_text(contracts.dump_json(document), encoding="utf-8")
    return StageOutput(
        status="fallback" if fallback else "done",
        files={"notes": str(out)},
        model_refs=refs,
        metrics={"cpu_s": time.process_time() - started, "audio_s": float(job.duration_s)},
        fallback_reason=fallback,
    )
