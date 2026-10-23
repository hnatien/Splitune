"""`ChordRecognizer` (06 TL;DR provider interfaces): consonance-ACE, BTC and madmom CNN+CRF.

Each maps mono 44.1 kHz audio to per-frame probabilities over a shared vocabulary
(`fusion.labels`). Models load once per island process.
"""

from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import Any, Protocol

import numpy as np
import torch
from numpy.typing import NDArray
from scipy.signal import resample_poly  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]
from splitune_ml_core import contracts, register
from splitune_ml_core.device import torch_device as _device_name
from splitune_ml_core.errors import StageError

from . import ace, btc, fusion
from .fusion import FrameProbs, Vocabulary

Mono = NDArray[np.float32]


def models_dir() -> Path:
    return Path(os.environ.get("ML_MODELS_DIR", "~/.cache/splitune/models")).expanduser()


def torch_device() -> torch.device:
    return torch.device(_device_name())


def ref_for(record_id: str, model_id: str) -> contracts.ModelRef:
    record = register.model(record_id)
    return contracts.ModelRef(
        model_id=model_id,
        version=record.version,
        weights_sha256=record.weights.sha256,
        provider="self_hosted",
        register_tier=record.tier,
    )


def to_22k(mono: Mono) -> Mono:
    return np.asarray(resample_poly(mono, 1, 2), dtype=np.float32)


class ChordRecognizer(Protocol):
    name: str
    record: str  # register id; also the calibration table name
    vocabularies: tuple[Vocabulary, ...]

    def model_ref(self) -> contracts.ModelRef: ...

    def frame_probs(self, mono: Mono, vocabulary: Vocabulary) -> FrameProbs: ...


class BTC:
    name = "btc"
    record = "btc-large-voca"
    vocabularies: tuple[Vocabulary, ...] = ("majmin", "sevenths")

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._loaded: tuple[btc.BTC, float, float, torch.device] | None = None

    def model_ref(self) -> contracts.ModelRef:
        return ref_for(self.record, "btc/large_voca")

    def _model(self) -> tuple[btc.BTC, float, float, torch.device]:
        with self._lock:
            if self._loaded is None:
                (path,) = register.verify(register.model(self.record), models_dir() / "btc")
                device = torch_device()
                self._loaded = (*btc.load(str(path), device), device)
            return self._loaded

    def frame_probs(self, mono: Mono, vocabulary: Vocabulary) -> FrameProbs:
        model, mean, std, device = self._model()
        native = btc.frame_probs(model, mean, std, to_22k(mono), device)
        mapping = np.zeros((native.shape[1], len(fusion.labels(vocabulary))))
        for i in range(native.shape[1]):
            name = btc.label(i)
            if name in ("N", "X"):
                mapping[i, 0] = 1
            else:
                root, quality = name.split(":")
                mapping[
                    i, fusion.index_of(vocabulary, fusion.PITCH_CLASSES.index(root), quality)
                ] = 1
        probs = native.astype(np.float64) @ mapping
        return FrameProbs(times=np.arange(len(probs), dtype=np.float64) * btc.FRAME_S, probs=probs)


class ConsonanceACE:
    """Chord-tone decomposition → vocabulary scores: log p(root) + Σ_pc log p(tone state)."""

    name = "consonance_ace"
    record = "consonance-ace"
    vocabularies: tuple[Vocabulary, ...] = ("majmin", "sevenths")

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._loaded: tuple[ace.ConformerDecomposed, torch.device] | None = None

    def model_ref(self) -> contracts.ModelRef:
        return ref_for(self.record, "consonance_ace/conformer_decomposed_smooth")

    def _model(self) -> tuple[ace.ConformerDecomposed, torch.device]:
        with self._lock:
            if self._loaded is None:
                (path,) = register.verify(
                    register.model(self.record), models_dir() / "consonance-ace"
                )
                device = torch_device()
                self._loaded = (ace.load(str(path), device), device)
            return self._loaded

    def frame_probs(self, mono: Mono, vocabulary: Vocabulary) -> FrameProbs:
        model, device = self._model()
        act = ace.activations(model, to_22k(mono), device)
        tones = np.clip(act["tones"].astype(np.float64), 1e-6, 1 - 1e-6)
        on, off = np.log(tones), np.log(1 - tones)
        member = fusion.templates(vocabulary).astype(np.float64)  # (entries, 12)
        tone_score = on @ member.T + off @ (1 - member).T  # (frames, entries)
        root_of = fusion.roots(vocabulary)
        root_score = act["root"].astype(np.float64)[:, np.where(root_of < 0, 12, root_of)]
        logp = fusion.log_normalize(tone_score + root_score)
        return FrameProbs(
            times=np.arange(len(logp), dtype=np.float64) * ace.FRAME_S, probs=np.exp(logp)
        )


class MadmomCNN:
    """CNN chord features + CRF (Korzeniowski & Widmer 2016); posterior marginals of the CRF by
    forward-backward instead of its Viterbi path, so inputs can be fused. majmin only."""

    name = "madmom_cnn"
    record = "madmom-chords-cnn"
    vocabularies: tuple[Vocabulary, ...] = ("majmin",)
    FPS = 10.0

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._loaded: tuple[Any, Any] | None = None

    def model_ref(self) -> contracts.ModelRef:
        return ref_for(self.record, "madmom/chords_cnncrf")

    def _model(self) -> tuple[Any, Any]:
        with self._lock:
            if self._loaded is None:
                import madmom  # pyright: ignore[reportMissingTypeStubs]
                from madmom.features.chords import (  # pyright: ignore[reportMissingTypeStubs]
                    CNNChordFeatureProcessor,
                )
                from madmom.ml.crf import ConditionalRandomField  # pyright: ignore[reportMissingTypeStubs]
                from madmom.models import CHORDS_CFCRF  # pyright: ignore[reportMissingTypeStubs]

                models = Path(madmom.__file__).parent / "models"
                register.verify(register.model(self.record), models)
                self._loaded = (
                    CNNChordFeatureProcessor(),  # pyright: ignore[reportUnknownVariableType]
                    ConditionalRandomField.load(CHORDS_CFCRF[0]),  # pyright: ignore[reportUnknownMemberType]
                )
            return self._loaded

    @staticmethod
    def marginals(crf: Any, observations: NDArray[np.float64]) -> NDArray[np.float64]:
        pi = np.asarray(crf.pi, dtype=np.float64)
        tau = np.asarray(crf.tau, dtype=np.float64)
        a = np.asarray(crf.A, dtype=np.float64)
        emission = np.asarray(crf.c, dtype=np.float64) + observations @ np.asarray(
            crf.W, dtype=np.float64
        )
        n, k = emission.shape

        def lse(x: NDArray[np.float64], axis: int) -> NDArray[np.float64]:
            m = np.max(x, axis=axis, keepdims=True)
            return np.squeeze(m, axis=axis) + np.log(np.sum(np.exp(x - m), axis=axis))

        alpha = np.empty((n, k))
        prev = pi
        for t in range(n):
            alpha[t] = lse(prev[:, None] + a, axis=0) + emission[t]
            prev = alpha[t]
        beta = np.empty((n, k))
        beta[-1] = tau
        for t in range(n - 1, 0, -1):
            beta[t - 1] = lse(a + (emission[t] + beta[t])[None, :], axis=1)
        return np.exp(fusion.log_normalize(alpha + beta))

    def frame_probs(self, mono: Mono, vocabulary: Vocabulary) -> FrameProbs:
        if vocabulary != "majmin":
            raise StageError("invalid_params", retry=False)
        from madmom.audio.signal import Signal  # pyright: ignore[reportMissingTypeStubs]

        features, crf = self._model()
        signal = Signal(mono, sample_rate=44100, num_channels=1)  # pyright: ignore[reportUnknownVariableType]
        native = self.marginals(crf, np.asarray(features(signal), dtype=np.float64))
        # madmom ids: 0-11 major from A, 12-23 minor from A, 24 N.
        mapping = np.zeros((25, len(fusion.labels(vocabulary))))
        mapping[24, 0] = 1
        for i in range(12):
            root = (9 + i) % 12
            mapping[i, fusion.index_of(vocabulary, root, "maj")] = 1
            mapping[12 + i, fusion.index_of(vocabulary, root, "min")] = 1
        return FrameProbs(times=np.arange(len(native)) / self.FPS, probs=native @ mapping)


_instances: dict[str, ChordRecognizer] = {}
_instances_lock = threading.Lock()
FACTORIES: dict[str, type[BTC] | type[ConsonanceACE] | type[MadmomCNN]] = {
    "btc": BTC,
    "consonance_ace": ConsonanceACE,
    "madmom_cnn": MadmomCNN,
}


def get(name: str) -> ChordRecognizer:
    with _instances_lock:
        if name not in _instances:
            if name not in FACTORIES:
                raise StageError("invalid_params", retry=False)
            _instances[name] = FACTORIES[name]()
        return _instances[name]
