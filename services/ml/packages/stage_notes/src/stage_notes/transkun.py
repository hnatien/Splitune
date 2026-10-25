"""Transkun V2 behind `NoteTranscriber`: piano transcription (torch island, MPS/CUDA).

The model code is the `transkun` package; the weights and model config are its
`pretrained/2.0.pt` + `2.0.conf` (V2 NoExt: key-release offsets), extracted into
`<ML_MODELS_DIR>/transkun/` and verified against the register by
`scripts/fetch_models.py transkun`.

Per-note scores come from the model's own semi-CRF (step 24 Phase 3): while decoding each segment
the interval marginals are computed with the CRF's forward-backward pass, so every note gets
- `onset`: the posterior probability that a note of that key starts within one frame of it,
- `interval`: the posterior of exactly the decoded interval (±1 frame at either end),
- `velocity`: the peak of the velocity distribution.
`confidence` picks which one becomes `confidence_raw`: "onset_velocity" (the mean of the first and
third) separates correct from wrong notes best on P2p (AUROC 0.885 held-out); "constant" = 1.0 is
the pre-step-24 value.
Sustain-pedal events (pitch -64) are returned by `transcribe_detailed`; una corda is dropped.

Clean-up params (all off by default): `gate_db` drops notes whose onset falls where the input is
more than that many dB below its own loud level (95th percentile of 46 ms frame RMS; the onset's
frame or the next must reach it), `min_velocity`
and `min_duration_s` drop quiet or short notes, and `min_confidence` drops notes below a raw score.
"""

# The package is untyped.
# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false, reportMissingTypeStubs=false, reportAttributeAccessIssue=false

from __future__ import annotations

import json
import threading
import types
from dataclasses import dataclass
from typing import Any

import numpy as np
from numpy.typing import NDArray
from splitune_ml_core import contracts, register

from .transcribers import NoteEvent, models_dir, ref_for

RECORD = "transkun-v2"
SUSTAIN = -64
# Segment and hop of the model config (16 s windows, 8 s hop); overridable per instrument.
TRANSKUN_DEFAULTS: dict[str, Any] = {
    "segment_s": 16.0,
    "hop_s": 8.0,
    "stereo": False,
    "confidence": "constant",
    "gate_db": None,
    "min_velocity": 0,
    "min_duration_s": 0.0,
    "min_confidence": 0.0,
}
CONFIDENCE = ("constant", "onset", "interval", "velocity", "onset_velocity")
GATE_FRAME = 2048
GATE_PERCENTILE = 95.0


@dataclass(frozen=True)
class TranskunNote:
    onset_s: float
    offset_s: float
    pitch_midi: int
    velocity: int
    onset: float
    interval: float
    velocity_peak: float

    def score(self, kind: str) -> float:
        return {
            "constant": 1.0,
            "onset": self.onset,
            "interval": self.interval,
            "velocity": self.velocity_peak,
            "onset_velocity": (self.onset + self.velocity_peak) / 2,
        }[kind]


@dataclass(frozen=True)
class Detailed:
    notes: list[TranskunNote]
    pedal: list[tuple[float, float]]  # sustain down intervals


def _scored_transcribe_frames(original: Any) -> Any:
    """Wraps TransKun.transcribeFrames: same decoding, plus per-note marginals from the segment's
    semi-CRF and the velocity distribution, attached to the returned Note objects."""
    import torch
    from torch.nn import functional
    from transkun.CRF.NeuralSemiCRFInterval import forward_backward

    def transcribe_frames(self: Any, frames_batch: Any, *args: Any, **kwargs: Any) -> Any:
        captured: dict[str, Any] = {}
        process = self.processFramesBatch

        def keep_crf(frames: Any) -> Any:
            crf, ctx = process(frames)
            captured["crf"] = crf
            return crf, ctx

        def keep_velocity(_module: Any, _inputs: Any, logits: Any) -> None:
            captured["velocity"] = logits

        hook = self.velocityPredictor.register_forward_hook(keep_velocity)
        self.processFramesBatch = keep_crf
        try:
            notes, last = original(frames_batch, *args, **kwargs)
        finally:
            del self.processFramesBatch
            hook.remove()
        segment = notes[0]
        if not segment:
            return notes, last
        crf = captured["crf"]
        frame = self.hopSize / self.fs
        symbols = list(self.targetMIDIPitch)
        # transcribeFrames emits notes symbol by symbol, in time order within a symbol, before
        # sorting them; the velocity predictor saw them in that order.
        emitted = sorted(segment, key=lambda n: (symbols.index(n.pitch), n.start))
        with torch.no_grad():
            _, marginal, _ = forward_backward(crf.score, crf.noiseScore)  # [end, begin, symbol]
            t = marginal.shape[0]
            device = marginal.device
            j = torch.tensor([symbols.index(n.pitch) for n in emitted], device=device)
            a = torch.tensor([round(n.start / frame) for n in emitted], device=device)
            a = a.clamp(0, t - 1)
            b = torch.maximum(
                torch.tensor([round(n.end / frame) for n in emitted], device=device).clamp(
                    0, t - 1
                ),
                a,
            )
            onset_p = marginal.sum(0)  # [begin, symbol]
            near = torch.tensor([-1, 0, 1], device=device)
            begins = (a[:, None] + near).clamp(0, t - 1)  # [note, 3]
            ends = (b[:, None] + near).clamp(0, t - 1)
            p_onset = onset_p[begins, j[:, None]].sum(-1).clamp(max=1.0)
            p_interval = (
                marginal[ends[:, :, None], begins[:, None, :], j[:, None, None]]
                .flatten(1)
                .sum(-1)
                .clamp(max=1.0)
            )
            peak = functional.softmax(captured["velocity"], dim=-1).max(-1).values
            scores = torch.stack([p_onset, p_interval, peak], dim=1).cpu().tolist()
        for n, (onset, interval, velocity) in zip(emitted, scores, strict=True):
            n.p_onset, n.p_interval, n.p_velocity = onset, interval, velocity
        return notes, last

    return transcribe_frames


def gate_mask(mono: NDArray[np.float32], gate_db: float) -> NDArray[np.bool_]:
    """Per GATE_FRAME frame: True where the input is within `gate_db` of its own loud level."""
    n = len(mono) // GATE_FRAME
    if n == 0:
        return np.ones(1, dtype=bool)
    frames = mono[: n * GATE_FRAME].reshape(n, GATE_FRAME).astype(np.float64)
    level = 10 * np.log10(np.mean(frames**2, axis=1) + 1e-12)
    return level >= np.percentile(level, GATE_PERCENTILE) - gate_db


def clean_up(
    notes: list[TranskunNote], mono: NDArray[np.float32], params: dict[str, Any]
) -> list[TranskunNote]:
    kept = [
        n
        for n in notes
        if n.velocity >= int(params["min_velocity"])
        and n.offset_s - n.onset_s >= float(params["min_duration_s"])
        and n.score(str(params["confidence"])) >= float(params["min_confidence"])
    ]
    if params["gate_db"] is None:
        return kept
    mask = gate_mask(mono, float(params["gate_db"]))
    last = len(mask) - 1

    # The onset's frame or the next: an onset placed a few ms before an attack that follows
    # silence still counts.
    def heard(onset_s: float) -> bool:
        frame = min(last, int(onset_s * 44100.0) // GATE_FRAME)
        return bool(mask[frame] or mask[min(last, frame + 1)])

    return [n for n in kept if heard(n.onset_s)]


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

                self._model = model.to(torch_device()).eval()
            return self._model

    def transcribe_detailed(
        self, audio: NDArray[np.float32], params: dict[str, Any], scores: bool = True
    ) -> Detailed:
        """Notes with all three scores (1.0 without `scores`) and the sustain pedal; `audio` is
        mono or (frames, ch)."""
        import torch

        model = self._load()
        device = next(model.parameters()).device
        x = audio if audio.ndim == 2 else audio[:, None]  # 44.1 kHz = model.fs
        tensor = torch.from_numpy(np.ascontiguousarray(x, dtype=np.float32)).to(device)
        if scores:
            model.transcribeFrames = types.MethodType(
                _scored_transcribe_frames(type(model).transcribeFrames.__get__(model)), model
            )
        try:
            with torch.no_grad():
                events = model.transcribe(
                    tensor,
                    stepInSecond=float(params["hop_s"]),
                    segmentSizeInSecond=float(params["segment_s"]),
                )
        finally:
            if scores:
                del model.transcribeFrames
        notes = [
            TranskunNote(
                onset_s=float(n.start),
                offset_s=float(max(n.end, n.start + 0.01)),
                pitch_midi=int(n.pitch),
                velocity=int(np.clip(round(float(n.velocity)), 1, 127)),
                onset=float(getattr(n, "p_onset", 1.0)),
                interval=float(getattr(n, "p_interval", 1.0)),
                velocity_peak=float(getattr(n, "p_velocity", 1.0)),
            )
            for n in events
            if 21 <= int(n.pitch) <= 108
        ]
        pedal = sorted((float(n.start), float(n.end)) for n in events if int(n.pitch) == SUSTAIN)
        return Detailed(sorted(notes, key=lambda n: (n.onset_s, n.pitch_midi)), pedal)

    def transcribe_with_pedal(
        self, mono: NDArray[np.float32], params: dict[str, Any]
    ) -> tuple[list[NoteEvent], list[tuple[float, float]]]:
        """Notes after clean-up, plus the sustain pedal's down intervals. `mono` may be
        (frames, channels): the stage passes the channels to transcribers with a `stereo` param,
        and `stereo: false` downmixes here."""
        audio = mono
        kind = str(params["confidence"])
        if kind not in CONFIDENCE:
            from splitune_ml_core.errors import StageError

            raise StageError("invalid_params", retry=False)
        source = audio if params["stereo"] or audio.ndim == 1 else audio.mean(axis=1)
        detailed = self.transcribe_detailed(
            np.asarray(source, dtype=np.float32),
            params,
            scores=kind != "constant",
        )
        downmix = audio if audio.ndim == 1 else audio.mean(axis=1)
        notes = [
            NoteEvent(
                onset_s=n.onset_s,
                offset_s=n.offset_s,
                pitch_midi=n.pitch_midi,
                velocity=n.velocity,
                confidence_raw=n.score(kind),
            )
            for n in clean_up(detailed.notes, np.asarray(downmix, dtype=np.float32), params)
        ]
        return notes, detailed.pedal

    def transcribe(self, mono: NDArray[np.float32], params: dict[str, Any]) -> list[NoteEvent]:
        return self.transcribe_with_pedal(mono, params)[0]
