"""Metric wrappers around mir_eval 0.8.2 (untyped) plus separation metrics. Each function returns
(metrics, variant): the variant string names exactly what was computed (08 §1)."""
# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false, reportMissingTypeStubs=false

from __future__ import annotations

from typing import Any

import mir_eval
import numpy as np
from numpy.typing import NDArray

from . import formats, msst

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
    """Utterance-level SDR as in MDX/MSST: 10·log10(Σref² / Σ(ref-est)²) over the whole track.
    Meaningless on a silent reference (it measures leakage against ε): check `silent_reference`."""
    n = min(len(ref), len(est))
    ref, est = ref[:n], est[:n]
    eps = 1e-8
    num = float(np.sum(ref**2)) + eps
    den = float(np.sum((ref - est) ** 2)) + eps
    return 10.0 * float(np.log10(num / den))


# A reference is silent when it is this far below the mixture's energy or this quiet in absolute
# RMS. On the 50 P1 windows the three silent references are digital zero and the quietest real
# one is -22.7 dB below its mixture (step 28), so -40 dB leaves 17 dB of margin either way.
SILENT_REL_DB = -40.0
SILENT_ABS_DBFS = -60.0
FRAME_S = 1.0


def _energy(audio: NDArray[np.float64]) -> float:
    return float(np.sum(np.square(audio, dtype=np.float64)))


def _db(ratio: float) -> float:
    return 10.0 * float(np.log10(max(ratio, 1e-30)))


def rms_dbfs(audio: NDArray[np.float64]) -> float:
    return _db(_energy(audio) / max(audio.size, 1))


def silent_reference(ref: NDArray[np.float64], mixture: NDArray[np.float64]) -> bool:
    """True when `ref` is < SILENT_REL_DB vs the mixture's energy or < SILENT_ABS_DBFS RMS."""
    n = min(len(ref), len(mixture))
    level = _db(_energy(ref[:n]) / max(_energy(mixture[:n]), 1e-30))
    return level < SILENT_REL_DB or rms_dbfs(ref[:n]) < SILENT_ABS_DBFS


def leakage_db(est: NDArray[np.float64], mixture: NDArray[np.float64]) -> float:
    """Energy of an estimate relative to the mixture (dB): the score for a silent reference,
    where anything the model outputs is bleed. -inf-like values are clamped at -300 dB."""
    n = min(len(est), len(mixture))
    return _db(_energy(est[:n]) / max(_energy(mixture[:n]), 1e-30))


def csdr(ref: NDArray[np.float64], est: NDArray[np.float64], rate: int) -> float:
    """Chunk-level SDR, self-contained: plain SDR (no BSS Eval distortion filters) on
    non-overlapping 1 s frames, median over frames, skipping frames whose reference is below
    SILENT_ABS_DBFS RMS (as museval v4 skips silent-reference frames). NaN if no frame is left."""
    n = min(len(ref), len(est))
    frame = int(rate * FRAME_S)
    values: list[float] = []
    for start in range(0, n - frame + 1, frame):
        r = ref[start : start + frame]
        if rms_dbfs(r) < SILENT_ABS_DBFS:
            continue
        values.append(_db((_energy(r) + 1e-8) / (_energy(r - est[start : start + frame]) + 1e-8)))
    return float(np.median(values)) if values else float("nan")


def si_sar(
    ref: NDArray[np.float64], est: NDArray[np.float64], others: list[NDArray[np.float64]]
) -> float:
    """Scale-invariant SAR (Le Roux et al. 2019): ||e_target||² / ||e_artif||², where e_target is
    the estimate's projection on the reference and e_artif what no reference (target or other
    sources of the same mixture) explains. Channels are flattened together (one scale per
    source)."""
    n = min([len(ref), len(est), *(len(o) for o in others)])
    target = ref[:n].reshape(-1)
    estimate = est[:n].reshape(-1)
    basis = np.stack([target, *(o[:n].reshape(-1) for o in others)])
    e_target = (float(estimate @ target) / max(float(target @ target), 1e-30)) * target
    coef, *_ = np.linalg.lstsq(basis @ basis.T, basis @ estimate, rcond=None)
    e_artif = estimate - coef @ basis
    return _db(float(e_target @ e_target) / max(float(e_artif @ e_artif), 1e-30))


SEPARATION_VARIANT = (
    "uSDR = MSST/MDX whole-clip energy ratio (dB); SI-SDR, bleedless, fullness = MSST "
    f"utils/metrics.py @{msst.MSST_COMMIT} ported to numpy (whole clip; bleedless/fullness on "
    "512-band mel magnitudes, 0-100); cSDR = plain SDR on 1 s frames, median, frames with a "
    f"reference below {SILENT_ABS_DBFS:.0f} dBFS RMS skipped; SI-SAR = Le Roux 2019 with all MUSDB "
    f"references as the interference basis. A reference below {SILENT_REL_DB:.0f} dB vs the "
    f"mixture or {SILENT_ABS_DBFS:.0f} dBFS RMS is silent: excluded from these and scored as "
    "leakage = estimate energy vs mixture (dB)"
)


def separation(
    ref: NDArray[np.float64],
    est: NDArray[np.float64],
    mixture: NDArray[np.float64],
    rate: int = 44100,
    others: list[NDArray[np.float64]] | None = None,
) -> dict[str, float]:
    """Every separation metric for one estimate ([frames, channels] arrays), per
    SEPARATION_VARIANT. A silent reference gets only `silent` = 1 and `leakage_db`."""
    n = min(len(ref), len(est), len(mixture))
    ref, est, mixture = ref[:n], est[:n], mixture[:n]
    if silent_reference(ref, mixture):
        return {"silent": 1.0, "leakage_db": leakage_db(est, mixture)}
    bleedless, fullness = msst.bleed_full(ref, est, sr=rate)
    out = {
        "silent": 0.0,
        "usdr": usdr(ref, est),
        "si_sdr": msst.si_sdr(ref, est),
        "csdr": csdr(ref, est, rate),
        "bleedless": bleedless,
        "fullness": fullness,
    }
    if others:
        out["si_sar"] = si_sar(ref, est, others)
    return out


def distribution(values: list[tuple[str, float]], worst: int = 3) -> dict[str, Any]:
    """n, median, mean, p10 (linear interpolation) and the `worst` lowest (id, value) pairs;
    NaN values are dropped. Ties in the worst list break by id so the order is stable."""
    kept = [(i, v) for i, v in values if np.isfinite(v)]
    if not kept:
        return {
            "n": 0,
            "median": float("nan"),
            "mean": float("nan"),
            "p10": float("nan"),
            "worst": [],
        }
    data = np.array([v for _, v in kept], dtype=np.float64)
    return {
        "n": len(kept),
        "median": float(np.median(data)),
        "mean": float(np.mean(data)),
        "p10": float(np.percentile(data, 10)),
        "worst": sorted(kept, key=lambda iv: (iv[1], iv[0]))[:worst],
    }
