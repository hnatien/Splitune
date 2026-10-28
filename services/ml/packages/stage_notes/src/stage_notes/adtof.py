"""ADTOF Frame_RNN (5-class drum transcription) behind `DrumTranscriber` (torch island).

The network and its front end follow ADTOF-pytorch (github.com/xavriley/ADTOF-pytorch, a port of
Zehren et al.'s `Frame_RNN_adtofAll_0`): 44.1 kHz mono, 2048-sample frames at 100 fps, a 12 bands
per octave log filterbank over 20 Hz-20 kHz, two conv blocks and three bidirectional GRUs with a
sigmoid per class (BD, SD, TT, HH, CY+RD). Onsets come from madmom-style peak picking with a
threshold per class. The weights file comes from `scripts/fetch_models.py adtof`; it is loaded
with `weights_only=True`. Raw confidence is the activation peak height or its margin over the
class threshold. The front end is level-dependent, so the input can be brought to a set RMS first
(step 25 P2d: quiet recordings lose soft kicks otherwise).
"""

# torch.from_numpy is partially typed.
# pyright: reportUnknownMemberType=false

from __future__ import annotations

import threading
from functools import cache
from typing import Any

import numpy as np
from numpy.typing import NDArray
from splitune_ml_core import contracts, register
from splitune_ml_core.errors import StageError

from .drum_kit import TOM_MID
from .transcribers import DrumEvent, NoteEvent, models_dir, ref_for

RECORD = "adtof-frame-rnn"
RATE = 44100
FPS = 100
FRAME = 2048
# Output order of the network and the GM line of each class (toms on one line, cymbals on ride
# until drum_kit decides).
LABELS = (36, 38, TOM_MID, 42, 51)
ADTOF_DEFAULTS: dict[str, Any] = {
    # Frame_RNN peakThreshold per class (ADTOF hyperparameters.py): BD, SD, TT, HH, CY+RD.
    "thresholds": [0.22, 0.24, 0.32, 0.22, 0.30],
    # madmom NotePeakPickingProcessor windows (s), as ADTOF uses them.
    "pre_avg": 0.1,
    "post_avg": 0.01,
    "pre_max": 0.02,
    "post_max": 0.01,
    "combine": 0.02,
    # A cymbal this long after the previous one, on a bar's first beat, is a crash (drum_kit).
    "crash_gap_s": 1.0,
    # Input RMS in dBFS before the front end; None keeps the input's level.
    "input_rms_db": None,
    # confidence_raw: "height" (the activation peak) or "margin" (its margin over the class
    # threshold, scaled to [0, 1]).
    "confidence": "height",
}


def at_rms(mono: NDArray[np.float32], db: float) -> NDArray[np.float32]:
    rms = float(np.sqrt(np.mean(np.square(mono, dtype=np.float64)))) if len(mono) else 0.0
    if rms <= 1e-9:  # silence stays silence
        return mono
    return (mono * np.float32(10 ** (db / 20) / rms)).astype(np.float32)


def raw_confidence(height: float, threshold: float, kind: str) -> float:
    if kind == "margin":
        return max(0.0, (height - threshold) / (1.0 - threshold))
    return height


@cache
def filterbank() -> NDArray[np.float32]:
    """madmom's LogarithmicFilterbank (12 bands/octave, 20 Hz-20 kHz, unique bins, normalized
    triangles) over the positive half of a 2048-point FFT."""
    freqs: list[float] = []
    f = 20.0
    while f <= 20000.0 * (1 + 1e-12):
        freqs.append(f)
        f *= 2 ** (1 / 12)
    fft_freqs = np.fft.fftfreq(FRAME, 1 / RATE)[: FRAME // 2]
    bins: list[int] = []
    for target in freqs:
        b = int(np.argmin(np.abs(fft_freqs - target)))
        if not bins or b > bins[-1]:
            bins.append(b)
    bank = np.zeros((len(bins) - 2, len(fft_freqs)), dtype=np.float32)
    for i in range(len(bins) - 2):
        left, center, right = bins[i], bins[i + 1], bins[i + 2]
        if right - left < 2:
            bank[i, left] = 1.0
            continue
        for b in range(left, center):
            bank[i, b] = (b - left) / (center - left)
        bank[i, center] = 1.0
        for b in range(center + 1, min(right, len(fft_freqs))):
            bank[i, b] = (right - b) / (right - center)
    sums = bank.sum(axis=1, keepdims=True)
    sums[sums == 0] = 1
    return bank / sums


def features(mono: NDArray[np.float32]) -> NDArray[np.float32]:
    """[frames, bins] log-filtered magnitude spectrogram (centered frames, zero padding)."""
    hop = RATE // FPS
    padded = np.pad(mono.astype(np.float32), FRAME // 2)
    count = 1 + (len(padded) - FRAME) // hop
    window = np.hanning(FRAME).astype(np.float32)
    frames = np.lib.stride_tricks.as_strided(
        padded, shape=(count, FRAME), strides=(padded.strides[0] * hop, padded.strides[0])
    )
    spectrum = np.abs(np.fft.rfft(frames * window, axis=1))[:, : FRAME // 2].astype(np.float32)
    return np.log10(1.0 + spectrum @ filterbank().T).astype(np.float32)


def peaks(activation: NDArray[np.float32], threshold: float, params: dict[str, Any]) -> list[int]:
    """madmom NotePeakPickingProcessor: activation minus its moving average, local maxima over
    the max window above the threshold, peaks within `combine` merged into the strongest."""

    def frames(seconds: Any) -> int:
        return round(float(seconds) * FPS)

    act = activation.astype(np.float32)
    pre, post = frames(params["pre_avg"]), frames(params["post_avg"])
    padded = np.pad(act, (pre, post), mode="edge")
    average = np.convolve(padded, np.ones(pre + post + 1) / (pre + post + 1), mode="valid")
    proc = np.maximum(0.0, act - average)
    pre, post = frames(params["pre_max"]), frames(params["post_max"])
    padded = np.pad(proc, (pre, post), mode="edge")
    local = np.max([padded[k : k + len(proc)] for k in range(pre + post + 1)], axis=0)
    found = np.flatnonzero((proc >= local) & (proc >= threshold)).tolist()
    combine = max(1, frames(params["combine"]))
    kept: list[int] = []
    group: list[int] = []
    for i in found:
        if group and i - group[-1] > combine:
            kept.append(max(group, key=lambda j: proc[j]))
            group = []
        group.append(i)
    if group:
        kept.append(max(group, key=lambda j: proc[j]))
    return kept


class Adtof:
    name = "adtof"
    record = RECORD
    defaults = ADTOF_DEFAULTS

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model: Any = None

    def model_ref(self) -> contracts.ModelRef:
        return ref_for(self.record, "adtof/frame_rnn_adtof_all")

    def _load(self) -> Any:
        with self._lock:
            if self._model is None:
                import torch
                from splitune_ml_core.device import torch_device

                from .adtof_net import FrameRNN

                (path,) = register.verify(register.model(self.record), models_dir() / "adtof")
                state = torch.load(str(path), map_location="cpu", weights_only=True)
                model = FrameRNN(filterbank().shape[0])
                model.load_state_dict(state.get("model_weights", state))
                self._model = model.eval().to(torch_device())
            return self._model

    def activations(self, mono: NDArray[np.float32]) -> NDArray[np.float32]:
        """[frames, 5] class activations at 100 fps."""
        import torch

        model = self._load()
        x = torch.from_numpy(features(mono))[None, :, :, None].to(next(model.parameters()).device)
        with torch.no_grad():
            return model(x)[0].float().cpu().numpy()

    def transcribe(self, mono: NDArray[np.float32], params: dict[str, Any]) -> list[NoteEvent]:
        raise StageError("invalid_params", retry=False)  # a drum model has no pitched notes

    def transcribe_drums(
        self, mono: NDArray[np.float32], params: dict[str, Any]
    ) -> list[DrumEvent]:
        level = params["input_rms_db"]
        act = self.activations(mono if level is None else at_rms(mono, float(level)))
        events: list[DrumEvent] = []
        for c, (gm, threshold) in enumerate(zip(LABELS, params["thresholds"], strict=True)):
            for frame in peaks(act[:, c], float(threshold), params):
                height = float(act[frame, c])
                events.append(
                    DrumEvent(
                        onset_s=frame / FPS,
                        gm_note=gm,
                        named=False,
                        confidence_raw=raw_confidence(
                            height, float(threshold), str(params["confidence"])
                        ),
                    )
                )
        return events
