"""PyTorch device resolution and memory helpers (09c §1).

CUDA (NVIDIA GPU), MPS (Apple Silicon) or CPU. The queue worker itself imports no torch; stages
and island processes import this module lazily.
"""

from __future__ import annotations

import gc
import logging
import os
import threading
from collections.abc import Generator
from contextlib import contextmanager
from typing import Literal

from .errors import StageError

log = logging.getLogger("splitune.device")

DeviceName = Literal["cuda", "mps", "cpu"]


def torch_device() -> DeviceName:
    """The resolved accelerator device for ML stages.

    ML_TORCH_DEVICE=auto:
      cuda when available, else mps when available, else cpu.
    An explicit device that is not available raises StageError('device_unavailable').
    """
    preference = os.environ.get("ML_TORCH_DEVICE", "auto").lower()
    import torch

    if preference == "auto":
        if torch.cuda.is_available():
            return "cuda"
        if torch.backends.mps.is_available():
            return "mps"
        return "cpu"
    if preference == "cuda":
        if not torch.cuda.is_available():
            raise StageError("device_unavailable", retry=False)
        return "cuda"
    if preference == "mps":
        if not torch.backends.mps.is_available():
            raise StageError("device_unavailable", retry=False)
        return "mps"
    if preference == "cpu":
        return "cpu"
    raise StageError("device_invalid", retry=False)


def synchronize() -> None:
    """Blocks until all queued kernels on the active accelerator complete."""
    dev = torch_device()
    import torch

    if dev == "cuda":
        torch.cuda.synchronize()
    elif dev == "mps":
        torch.mps.synchronize()


def empty_cache() -> None:
    """Frees cached, unallocated accelerator memory back to the driver."""
    gc.collect()
    dev = torch_device()
    import torch

    if dev == "cuda":
        torch.cuda.empty_cache()
    elif dev == "mps":
        torch.mps.empty_cache()


@contextmanager
def peak_memory() -> Generator[list[float]]:
    """Measures peak accelerator memory during the block in MB. Yields [peak_mb] (0 on CPU)."""
    dev = torch_device()
    peak = [0.0]
    if dev == "cpu":
        yield peak
        return

    import torch

    if dev == "cuda":
        torch.cuda.reset_peak_memory_stats()
        try:
            yield peak
        finally:
            peak[0] = torch.cuda.max_memory_allocated() / (1024 * 1024)
        return

    stop = threading.Event()

    def sample() -> None:
        while not stop.wait(0.2):
            peak[0] = max(peak[0], torch.mps.driver_allocated_memory() / (1024 * 1024))

    thread = threading.Thread(target=sample, daemon=True)
    thread.start()
    try:
        yield peak
    finally:
        stop.set()
        if thread.is_alive():
            thread.join()
