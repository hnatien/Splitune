"""Metric wrappers around mir_eval 0.8.2 (untyped) plus SDR. Each function returns
(metrics, variant): the variant string names exactly what was computed (08 §1)."""
# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false, reportMissingTypeStubs=false

from __future__ import annotations

from typing import Any

import mir_eval
import numpy as np
from numpy.typing import NDArray

from . import formats

MIR_EVAL = mir_eval.__version__


def _floats(values: dict[str, Any]) -> dict[str, float]:
    return {k: float(v) for k, v in values.items()}


def beats(ref: formats.BeatTimes, est: formats.BeatTimes) -> tuple[dict[str, float], str]:
    metrics = _floats(mir_eval.beat.evaluate(ref.beats, est.beats))
    variant = (
        f"mir_eval {MIR_EVAL} beat.evaluate: F-measure ±70 ms; beats before 5 s trimmed "
        "(mir_eval default); CMLt/AMLt continuity at 17.5% tolerance"
    )
    if ref.downbeats is not None and est.downbeats is not None:
        metrics["Downbeat F-measure"] = float(
            mir_eval.beat.f_measure(
                mir_eval.beat.trim_beats(ref.downbeats), mir_eval.beat.trim_beats(est.downbeats)
            )
        )
        variant += "; downbeat F-measure ±70 ms, same trimming"
    return metrics, variant


def _hz(midi: NDArray[np.float64]) -> NDArray[np.float64]:
    return 440.0 * 2.0 ** ((midi - 69.0) / 12.0)


def notes(ref: formats.NoteEvents, est: formats.NoteEvents) -> tuple[dict[str, float], str]:
    out: dict[str, float] = {}
    for name, offset_ratio in (("onset", None), ("onset_offset", 0.2)):
        p, r, f, _ = mir_eval.transcription.precision_recall_f1_overlap(
            ref.intervals,
            _hz(ref.pitches_midi),
            est.intervals,
            _hz(est.pitches_midi),
            onset_tolerance=0.05,
            pitch_tolerance=50.0,
            offset_ratio=offset_ratio,  # pyright: ignore[reportArgumentType] (None = onset only)
            offset_min_tolerance=0.05,
        )
        out |= {f"{name}_precision": float(p), f"{name}_recall": float(r), f"{name}_f1": float(f)}
    variant = (
        f"mir_eval {MIR_EVAL} transcription: onset F1 (±50 ms, ±50 cents) and onset+offset F1 "
        "(offset ±max(50 ms, 20% of duration))"
    )
    return out, variant


def chords(ref: formats.ChordLabels, est: formats.ChordLabels) -> tuple[dict[str, float], str]:
    metrics = _floats(mir_eval.chord.evaluate(ref.intervals, ref.labels, est.intervals, est.labels))
    keep = {
        k: metrics[k] for k in ("majmin", "majmin_inv", "sevenths", "root", "mirex") if k in metrics
    }
    return keep, f"mir_eval {MIR_EVAL} chord.evaluate: duration-weighted CSR (WCSR) per vocabulary"


def melody(ref: formats.Contour, est: formats.Contour) -> tuple[dict[str, float], str]:
    metrics = _floats(mir_eval.melody.evaluate(ref.times, ref.hz, est.times, est.hz))
    return metrics, f"mir_eval {MIR_EVAL} melody.evaluate: RPA/RCA ±50 cents, 10 ms resampling"


def usdr(ref: NDArray[np.float64], est: NDArray[np.float64]) -> float:
    """Utterance-level SDR as in MDX/MSST: 10·log10(Σref² / Σ(ref-est)²) over the whole track."""
    n = min(len(ref), len(est))
    ref, est = ref[:n], est[:n]
    eps = 1e-8
    num = float(np.sum(ref**2)) + eps
    den = float(np.sum((ref - est) ** 2)) + eps
    return 10.0 * float(np.log10(num / den))


def csdr(ref: NDArray[np.float64], est: NDArray[np.float64], rate: int) -> float:
    """Chunk-level SDR: BSS Eval v3 images (mir_eval) on 1 s windows, median over windows."""
    n = min(len(ref), len(est))
    sdr, _, _, _, _ = mir_eval.separation.bss_eval_images_framewise(
        ref[None, :n, :], est[None, :n, :], window=rate, hop=rate
    )
    values = np.asarray(sdr, dtype=np.float64)[0]
    finite = values[np.isfinite(values)]
    return float(np.median(finite)) if finite.size else float("nan")
