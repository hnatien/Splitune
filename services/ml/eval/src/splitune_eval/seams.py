"""Model-window seams on full-length separations (step 28).

audio-separator 0.44's RoFormer demix cuts the song into chunks of C = stft_hop * (dim_t - 1)
samples starting every step = min(overlap * rate, C), plus one last chunk ending at the song's
end, and overlap-adds them with a Hamming weight; with step = C the chunks abut without a
crossfade. Demucs averages randomly shifted passes (`shifts`), so its boundaries move between
passes and have no fixed positions.

The seam ratio: power of the 1 kHz high-passed residual (estimate - reference) within ±50 ms of
each boundary over its power elsewhere, in dB (0 = the boundaries don't show in the error).
"""

from __future__ import annotations

from typing import Any, cast

import numpy as np
from numpy.typing import NDArray
from scipy.signal import butter, sosfiltfilt  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]

RATE = 44100
HALF_S = 0.05
HIGHPASS_HZ = 1000.0


def roformer_window() -> tuple[int, int] | None:
    """(chunk, step) in samples of the warm RoFormer in `stage_separation.models`, as
    audio-separator's demix computes them; None for Demucs (or no warm model)."""
    from stage_separation import models

    warm = models._warm  # pyright: ignore[reportPrivateUsage]
    instance: Any = warm.separator.model_instance if warm is not None else None
    if instance is None or not getattr(instance, "is_roformer", False):
        return None
    cfg = instance.model_data_cfgdict
    hop = getattr(cfg.model, "stft_hop_length", None) or cfg.audio.hop_length
    chunk = int(hop) * (int(cfg.inference.dim_t) - 1)
    desired = int(instance.overlap * cfg.audio.sample_rate)
    return chunk, chunk if desired <= 0 else min(desired, chunk)


def boundaries(frames: int, chunk: int, step: int) -> list[int]:
    """Chunk starts and ends strictly inside a song of `frames` samples."""
    edges: set[int] = set()
    for start in range(0, frames, step):
        if start + chunk > frames:
            edges.add(frames - chunk)
            break
        edges.update((start, start + chunk))
    return sorted(e for e in edges if 0 < e < frames)


def seam_ratio_db(
    ref: NDArray[np.float64], est: NDArray[np.float64], edges: list[int], rate: int = RATE
) -> float:
    sos = cast(NDArray[np.float64], butter(4, HIGHPASS_HZ, btype="highpass", fs=rate, output="sos"))
    residual = np.asarray(sosfiltfilt(sos, est - ref, axis=0), dtype=np.float64)
    power = np.sum(residual**2, axis=1)
    near = np.zeros(len(power), dtype=bool)
    half = int(HALF_S * rate)
    for e in edges:
        near[max(0, e - half) : e + half] = True
    if not near.any() or near.all():
        return float("nan")
    return 10.0 * float(np.log10((power[near].mean() + 1e-20) / (power[~near].mean() + 1e-20)))
