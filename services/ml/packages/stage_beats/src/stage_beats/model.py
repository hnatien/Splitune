"""beat_this 1.1.0 checkpoints and warm models (kept for the island's lifetime)."""

from __future__ import annotations

import hashlib
import logging
import os
import threading
import time
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any, cast

import numpy as np
import torch
from beat_this.inference import CHECKPOINT_URL, Audio2Frames  # pyright: ignore[reportMissingTypeStubs]
from beat_this.model.postprocessor import Postprocessor  # pyright: ignore[reportMissingTypeStubs]
from numpy.typing import NDArray
from splitune_ml_core.contracts import ModelRef

log = logging.getLogger("splitune.beats")

VERSION = "1.1.0"
FULL = "final0"
SMALL = "small0"  # 8 MB; the CPU fallback (06 §4)

_lock = threading.Lock()


def checkpoint(name: str) -> Path:
    """Local checkpoint file, downloaded once into the torch hub cache."""
    path = Path(torch.hub.get_dir()) / "checkpoints" / f"beat_this-{name}.ckpt"
    if not path.is_file():
        path.parent.mkdir(parents=True, exist_ok=True)
        log.info("downloading checkpoint", extra={"model": name})
        torch.hub.download_url_to_file(f"{CHECKPOINT_URL}/{name}.ckpt", str(path), progress=False)  # pyright: ignore[reportUnknownMemberType]
    return path


@cache
def weights_sha256(name: str) -> str:
    digest = hashlib.sha256()
    with checkpoint(name).open("rb") as f:
        while chunk := f.read(1 << 20):
            digest.update(chunk)
    return digest.hexdigest()


def model_ref(name: str) -> ModelRef:
    return ModelRef(
        model_id=f"beat_this/{name}",
        version=VERSION,
        weights_sha256=weights_sha256(name),
        provider="self_hosted",
        register_tier="green",
    )


def mps_available() -> bool:
    return torch.backends.mps.is_available()


@dataclass(frozen=True)
class Choice:
    model: str
    device: str
    fallback_reason: str | None


def choose(requested_model: str) -> Choice:
    """ML_TORCH_DEVICE=auto → MPS when available, else CPU with the small model (fallback).
    An explicit `cpu` keeps the requested model (benchmarks)."""
    preference = os.environ.get("ML_TORCH_DEVICE", "auto")
    if preference == "cpu":
        return Choice(requested_model, "cpu", None)
    if mps_available():
        return Choice(requested_model, "mps", None)
    return Choice(SMALL, "cpu", "beats_cpu_small" if requested_model != SMALL else None)


@cache
def _frames(name: str, device: str) -> Audio2Frames:
    with _lock:
        return Audio2Frames(checkpoint_path=str(checkpoint(name)), device=device, float16=False)


@dataclass(frozen=True)
class Inference:
    beats: NDArray[np.float64]  # seconds
    downbeats: NDArray[np.float64]  # seconds, a subset of beats
    activation: NDArray[np.float32]  # sigmoid(beat logits) per 20 ms frame
    seconds: float  # model wall time (excluding audio loading)


def infer(signal: NDArray[np.float32], sample_rate: int, name: str, device: str) -> Inference:
    frames = _frames(name, device)
    started = time.perf_counter()
    beat_logits, downbeat_logits = cast(
        tuple[torch.Tensor, torch.Tensor], frames(signal, sample_rate)
    )
    beats, downbeats = cast(
        tuple[Any, Any], Postprocessor(type="minimal")(beat_logits, downbeat_logits)
    )
    activation = torch.sigmoid(beat_logits).cpu().numpy().astype(np.float32)
    if device == "mps":
        torch.mps.synchronize()
    seconds = time.perf_counter() - started
    return Inference(
        beats=np.asarray(beats, dtype=np.float64),
        downbeats=np.asarray(downbeats, dtype=np.float64),
        activation=activation,
        seconds=seconds,
    )
