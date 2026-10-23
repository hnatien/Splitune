"""Transkun V2 behind `NoteTranscriber`: piano transcription (torch island, MPS).

The model code is the `transkun` package; the weights and model config are its
`pretrained/2.0.pt` + `2.0.conf`, extracted into `<ML_MODELS_DIR>/transkun/` and verified against
the register by `scripts/fetch_models.py transkun`. The semi-CRF decoder reports no per-note
score, so every note gets `confidence_raw` 1.0 and the calibration table (fitted on P2) turns that
into the measured precision. Pedal events (negative pitches) are dropped.
"""

# The package is untyped.
# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false, reportMissingTypeStubs=false

from __future__ import annotations

import json
import threading
from typing import Any

import numpy as np
from numpy.typing import NDArray
from splitune_ml_core import contracts, register

from .transcribers import NoteEvent, models_dir, ref_for

RECORD = "transkun-v2"
# Segment and hop of the model config (16 s windows, 8 s hop); overridable per instrument.
TRANSKUN_DEFAULTS: dict[str, Any] = {"segment_s": 16.0, "hop_s": 8.0}


class Transkun:
    name = "transkun"
    record = RECORD
    defaults = TRANSKUN_DEFAULTS

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model: Any = None

    def model_ref(self) -> contracts.ModelRef:
        return ref_for(self.record, "transkun/2.0")

    def _load(self) -> Any:
        with self._lock:
            if self._model is None:
                import torch
                from transkun import ModelTransformer

                weights, conf_path = register.verify(
                    register.model(self.record), models_dir() / "transkun"
                )
                conf = ModelTransformer.Config()
                conf.__dict__.update(json.loads(conf_path.read_text())["Model"]["config"])
                model = ModelTransformer.TransKun(conf=conf)
                checkpoint = torch.load(str(weights), map_location="cpu")
                model.load_state_dict(checkpoint["state_dict"])
                from splitune_ml_core.device import torch_device

                device = torch_device()
                self._model = model.to(device).eval()
            return self._model

    def transcribe(self, mono: NDArray[np.float32], params: dict[str, Any]) -> list[NoteEvent]:
        import torch

        model = self._load()
        device = next(model.parameters()).device
        x = torch.from_numpy(np.ascontiguousarray(mono[:, None])).to(device)  # 44.1 kHz = model.fs
        with torch.no_grad():
            notes = model.transcribe(
                x,
                stepInSecond=float(params["hop_s"]),
                segmentSizeInSecond=float(params["segment_s"]),
            )
        return [
            NoteEvent(
                onset_s=float(n.start),
                offset_s=float(max(n.end, n.start + 0.01)),
                pitch_midi=int(n.pitch),
                velocity=int(np.clip(round(float(n.velocity)), 1, 127)),
                confidence_raw=1.0,
            )
            for n in notes
            if 21 <= int(n.pitch) <= 108
        ]
