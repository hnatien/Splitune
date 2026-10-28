"""`NoteTranscriber` (06 TL;DR provider interfaces) and its implementations.

A transcriber turns mono 44.1 kHz audio into note events with a raw confidence; the stage
calibrates, fixes ids and writes the contract. Selected per instrument by
`services/ml/config/notes.personal.yaml`.
"""

from __future__ import annotations

import os
import threading
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any, Protocol

import numpy as np
import onnxruntime as ort  # pyright: ignore[reportMissingTypeStubs]
import yaml
from numpy.typing import NDArray
from pydantic import BaseModel, ConfigDict, Field
from scipy.signal import resample_poly  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]
from splitune_ml_core import contracts, register
from splitune_ml_core.errors import StageError
from splitune_ml_core.paths import ML_ROOT

from . import basic_pitch as bp
from . import bends, tuning

RATE = 44100
CONFIG_PATH = ML_ROOT / "config" / "notes.personal.yaml"


@dataclass(frozen=True)
class NoteEvent:
    onset_s: float
    offset_s: float
    pitch_midi: int
    velocity: int
    confidence_raw: float
    bend_cents: tuple[tuple[float, float], ...] = ()  # (s after the onset, cents above the pitch)


class NoteTranscriber(Protocol):
    name: str
    record: str  # register id; also the calibration table name
    defaults: dict[str, Any]

    def model_ref(self) -> contracts.ModelRef: ...

    def transcribe(self, mono: NDArray[np.float32], params: dict[str, Any]) -> list[NoteEvent]: ...


def models_dir() -> Path:
    return Path(os.environ.get("ML_MODELS_DIR", "~/.cache/splitune/models")).expanduser()


def ref_for(record_id: str, model_id: str) -> contracts.ModelRef:
    record = register.model(record_id)
    return contracts.ModelRef(
        model_id=model_id,
        version=record.version,
        weights_sha256=record.weights.sha256,
        provider="self_hosted",
        register_tier=record.tier,
    )


# basic-pitch's predict() defaults, plus the confidence window and the recording's A4 offset
# compensation (the stage estimates the offset and passes it as `a4_cents`, tuning.py).
BASIC_PITCH_DEFAULTS: dict[str, Any] = {
    "onset_threshold": 0.5,
    "frame_threshold": 0.3,
    "min_note_ms": 127.7,
    "min_freq_hz": None,
    "max_freq_hz": None,
    "melodia_trick": True,
    "infer_onsets": True,
    "energy_tol": bp.ENERGY_TOL,
    "confidence_frames": 3,
    "a4_compensation": False,
    # Open-string tuning suggestion (needs a4_compensation; tuning.suggest_tuning). Thresholds:
    # the most sensitive setting without a false positive on the P2g standard-tuning cases.
    "tuning_suggestion": False,
    "tuning_min_low_notes": 1,
    "tuning_min_confidence": 0.3,
    "tuning_min_duration_s": 0.1,
    # Bends from the pitch contour (bends.py): the smallest bend kept and how long it must glide.
    "bends": False,
    "bend_min_cents": 75.0,
    "bend_min_glide_frames": 3,
    # Per-note string probabilities for the fret DP from the audio (strings.py, the stage adds
    # them to guitar notes).
    "string_cue": False,
}
A4_MIN_CENTS = 5.0  # smaller offsets are within the estimator's error (median 6 cents, step 22)


class BasicPitch:
    """Basic Pitch 0.4.0 on its bundled nmp.onnx (ONNX Runtime CPU, two threads per CPU slot).
    Confidence = mean onset posterior over the note's first 3 frames (06 §4)."""

    name = "basic_pitch"
    record = "basic-pitch"
    defaults = BASIC_PITCH_DEFAULTS

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._session: ort.InferenceSession | None = None

    def model_ref(self) -> contracts.ModelRef:
        return ref_for(self.record, "basic_pitch/icassp_2022")

    def session(self) -> ort.InferenceSession:
        with self._lock:
            if self._session is None:
                (path,) = register.verify(register.model(self.record), models_dir() / "basic-pitch")
                self._session = ort.InferenceSession(
                    str(path),
                    sess_options=bp.session_options(2),
                    providers=["CPUExecutionProvider"],
                )
            return self._session

    def posteriors(self, mono: NDArray[np.float32]) -> bp.Posteriors:
        audio = np.asarray(resample_poly(mono, 1, 2), dtype=np.float32)  # 44.1 → 22.05 kHz
        return bp.infer(self.session(), audio)

    def transcribe(self, mono: NDArray[np.float32], params: dict[str, Any]) -> list[NoteEvent]:
        cents = float(params.get("a4_cents") or 0.0)
        stretch = 1.0
        if abs(cents) >= A4_MIN_CENTS:
            mono, stretch = tuning.retuned(mono, cents)
        posteriors = self.posteriors(mono)
        raw = bp.notes_polyphonic(
            posteriors,
            onset_thresh=float(params["onset_threshold"]),
            frame_thresh=float(params["frame_threshold"]),
            min_note_len=bp.min_note_frames(float(params["min_note_ms"])),
            min_freq=params["min_freq_hz"],
            max_freq=params["max_freq_hz"],
            melodia_trick=bool(params["melodia_trick"]),
            infer_onsets=bool(params["infer_onsets"]),
            energy_tol=int(params["energy_tol"]),
        )
        bent = (
            bends.merged(
                posteriors,
                raw,
                onset_thresh=float(params["onset_threshold"]),
                min_cents=float(params["bend_min_cents"]),
                min_glide_frames=int(params["bend_min_glide_frames"]),
            )
            if params["bends"]
            else [bends.Bent(n, ()) for n in raw]
        )
        times = bp.frame_times(posteriors.contour.shape[0]) / stretch
        frames = int(params["confidence_frames"])
        return [
            NoteEvent(
                onset_s=max(0.0, float(times[n.start])),
                offset_s=max(0.0, float(times[n.end])),
                pitch_midi=n.pitch_midi,
                velocity=int(np.clip(round(127 * n.amplitude), 1, 127)),
                confidence_raw=min(1.0, max(0.0, bp.onset_posterior(posteriors, n, frames))),
                bend_cents=tuple(
                    (round(float(times[n.start + k] - times[n.start]), 3), c) for k, c in b.curve
                ),
            )
            for b in bent
            for n in (b.note,)
        ]


class InstrumentSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    transcriber: str
    params: dict[str, Any] = Field(default_factory=dict[str, Any])


class NotesConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int
    instruments: dict[str, InstrumentSpec]


@cache
def load_config(path: Path | None = None) -> NotesConfig:
    raw = os.environ.get("ML_NOTES_CONFIG")
    target = path or (Path(raw).expanduser() if raw else CONFIG_PATH)
    return NotesConfig.model_validate(yaml.safe_load(target.read_text(encoding="utf-8")))


_instances: dict[str, NoteTranscriber] = {}
_instances_lock = threading.Lock()


def get(name: str) -> NoteTranscriber:
    """One instance per island, so a model loads once."""
    with _instances_lock:
        if name not in _instances:
            if name == "basic_pitch":
                _instances[name] = BasicPitch()
            elif name == "yourmt3":
                from .yourmt3 import YourMT3  # torch island only

                _instances[name] = YourMT3()
            elif name == "transkun":
                from .transkun import Transkun  # torch island only

                _instances[name] = Transkun()
            else:
                raise StageError("invalid_params", retry=False)
        return _instances[name]


def for_instrument(instrument: str) -> tuple[NoteTranscriber, dict[str, Any]]:
    spec = load_config().instruments.get(instrument)
    if spec is None:
        raise StageError("invalid_params", retry=False)
    transcriber = get(spec.transcriber)
    unknown = set(spec.params) - set(transcriber.defaults)
    if unknown:
        raise StageError("invalid_params", retry=False)
    effective = {**transcriber.defaults, **spec.params}
    if "instrument" in transcriber.defaults:  # multi-instrument models filter by instrument
        effective["instrument"] = instrument
    return transcriber, effective
