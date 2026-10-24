"""Guitar references for P2g (08 §3 P2g): notes with string/fret, the recording's tuning, capo and
A4 offset, plus the variants derived from them (re-pitched, drop D, two guitars) and tab scoring.

Strings follow the Splitune convention (1 = highest-pitched). Frets are absolute, counted from the
nut as in music-core (with a capo at 2, an open-sounding string is fret 2).
"""

from __future__ import annotations

import json
import math
from collections.abc import Sequence
from dataclasses import asdict, dataclass, field, replace
from pathlib import Path
from typing import Any, cast

import mir_eval  # pyright: ignore[reportMissingTypeStubs]
import numpy as np
from numpy.typing import NDArray

from .tab_metrics import guitarset_notes

STANDARD = (64, 59, 55, 50, 45, 40)  # string 1 → 6


@dataclass(frozen=True)
class RefNote:
    onset_s: float
    offset_s: float
    pitch_midi: int
    string: int | None = None
    fret: int | None = None
    bend_cents: float = 0.0  # largest bend within the note (0 = none marked)
    part: str = "main"  # "rhythm" / "lead" on two-guitar items


@dataclass(frozen=True)
class GuitarRef:
    notes: tuple[RefNote, ...]
    tuning_midi: tuple[int, ...] = STANDARD
    capo: int = 0
    a4_cents: float = 0.0  # the recording's offset from A440
    beats: tuple[float, ...] = ()
    has_tab: bool = True  # string/fret are ground truth
    has_bends: bool = False  # bend marks are ground truth
    meta: dict[str, Any] = field(default_factory=dict[str, Any])

    def dump(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(asdict(self), indent=1) + "\n", encoding="utf-8")

    @staticmethod
    def load(path: Path) -> GuitarRef:
        raw = cast(dict[str, Any], json.loads(path.read_text(encoding="utf-8")))
        notes = tuple(RefNote(**n) for n in cast(list[dict[str, Any]], raw.pop("notes")))
        return GuitarRef(
            notes=notes,
            tuning_midi=tuple(cast(list[int], raw.pop("tuning_midi"))),
            beats=tuple(cast(list[float], raw.pop("beats"))),
            **raw,
        )


def from_guitarset(jams: dict[str, Any]) -> GuitarRef:
    beats: list[float] = []
    for annotation in cast(list[dict[str, Any]], jams["annotations"]):
        if annotation["namespace"] == "beat_position":
            data = cast(dict[str, list[float]] | list[dict[str, float]], annotation["data"])
            times = data["time"] if isinstance(data, dict) else [o["time"] for o in data]
            beats = [float(t) for t in times]
    notes = tuple(
        RefNote(n.onset_s, n.offset_s, n.pitch_midi, n.string, n.fret)
        for n in guitarset_notes(jams)
    )
    return GuitarRef(notes=notes, beats=tuple(beats))


def repitch_ratio(cents: float) -> float:
    return 2.0 ** (cents / 1200.0)


def repitched(ref: GuitarRef, cents: float) -> GuitarRef:
    """The reference of the audio played back `cents` higher (and faster by the same ratio).

    Whole semitones down become a lower tuning (same frets: a half-step-down song); whole
    semitones up become a capo (same shapes, absolute frets + capo); the remainder is the A4
    offset of the recording."""
    ratio = repitch_ratio(cents)
    semis = round(cents / 100.0)
    rest = cents - 100.0 * semis
    capo = ref.capo + max(semis, 0)
    tuning = tuple(p + min(semis, 0) for p in ref.tuning_midi)
    notes = tuple(
        replace(
            n,
            onset_s=n.onset_s / ratio,
            offset_s=n.offset_s / ratio,
            pitch_midi=n.pitch_midi + semis,
            fret=None if n.fret is None else n.fret + max(semis, 0),
        )
        for n in ref.notes
    )
    return replace(
        ref,
        notes=notes,
        tuning_midi=tuning,
        capo=capo,
        a4_cents=ref.a4_cents + rest,
        beats=tuple(b / ratio for b in ref.beats),
    )


def dropped(ref: GuitarRef, string: int = 6, semitones: int = 2) -> GuitarRef:
    """The reference after re-tuning one string down (drop D: string 6 down a whole step) while
    the player keeps the same frets."""
    tuning = list(ref.tuning_midi)
    tuning[string - 1] -= semitones
    notes = tuple(
        replace(n, pitch_midi=n.pitch_midi - semitones) if n.string == string else n
        for n in ref.notes
    )
    return replace(ref, notes=notes, tuning_midi=tuple(tuning))


def shifted(ref: GuitarRef, seconds: float, part: str) -> GuitarRef:
    """Every note and beat `seconds` later (negative: earlier, dropping what falls before 0)."""
    notes = tuple(
        replace(n, onset_s=n.onset_s + seconds, offset_s=n.offset_s + seconds, part=part)
        for n in ref.notes
        if n.onset_s + seconds >= 0
    )
    return replace(
        ref, notes=notes, beats=tuple(b + seconds for b in ref.beats if b + seconds >= 0)
    )


def trimmed(ref: GuitarRef, t1: float) -> GuitarRef:
    notes = tuple(replace(n, offset_s=min(n.offset_s, t1)) for n in ref.notes if n.onset_s < t1)
    return replace(ref, notes=notes, beats=tuple(b for b in ref.beats if b < t1))


def merged(a: GuitarRef, b: GuitarRef) -> GuitarRef:
    notes = tuple(sorted(a.notes + b.notes, key=lambda n: (n.onset_s, -n.pitch_midi)))
    return replace(a, notes=notes, meta={**a.meta, "guitars": 2})


# --- scoring ---------------------------------------------------------------------------------


@dataclass(frozen=True)
class EstNote:
    onset_s: float
    offset_s: float
    pitch_midi: int
    string: int | None = None
    fret: int | None = None
    bend_cents: float = 0.0


@dataclass(frozen=True)
class TabCounts:
    ref: int
    est: int
    matched: int  # onset ±50 ms, pitch ±50 cents (mir_eval matching, one-to-one)
    tab_correct: int  # matched with the reference string and fret

    @property
    def tdr(self) -> float:
        return self.tab_correct / self.matched if self.matched else float("nan")

    @property
    def precision(self) -> float:
        return self.tab_correct / self.est if self.est else float("nan")

    @property
    def recall(self) -> float:
        return self.tab_correct / self.ref if self.ref else float("nan")

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / (p + r) if p + r > 0 else 0.0


def _hz(midi: NDArray[np.float64]) -> NDArray[np.float64]:
    return 440.0 * 2.0 ** ((midi - 69.0) / 12.0)


def _arrays(
    notes: Sequence[RefNote] | Sequence[EstNote],
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    intervals = np.array([[n.onset_s, max(n.offset_s, n.onset_s + 1e-3)] for n in notes])
    return intervals.reshape(-1, 2), np.array([float(n.pitch_midi) for n in notes])


def match(ref: Sequence[RefNote], est: Sequence[EstNote]) -> list[tuple[int, int]]:
    """One-to-one (ref index, est index) pairs, onset ±50 ms and pitch ±50 cents."""
    if not ref or not est:
        return []
    ri, rp = _arrays(ref)
    ei, ep = _arrays(est)
    pairs = mir_eval.transcription.match_notes(  # pyright: ignore[reportUnknownVariableType, reportUnknownMemberType]
        ri,
        _hz(rp),
        ei,
        _hz(ep),
        onset_tolerance=0.05,
        pitch_tolerance=50.0,
        offset_ratio=None,  # pyright: ignore[reportArgumentType]
    )
    return [(int(i), int(j)) for i, j in cast(list[tuple[int, int]], pairs)]


def tab_counts(ref: Sequence[RefNote], est: Sequence[EstNote]) -> TabCounts:
    """Reference notes without a string/fret (and the estimates matched to them) are left out."""
    pairs = match(ref, est)
    untabbed = {j for i, j in pairs if ref[i].string is None}
    tabbed = [(i, j) for i, j in pairs if ref[i].string is not None]
    correct = sum(
        1 for i, j in tabbed if (ref[i].string, ref[i].fret) == (est[j].string, est[j].fret)
    )
    return TabCounts(
        ref=sum(1 for n in ref if n.string is not None),
        est=len(est) - len(untabbed),
        matched=len(tabbed),
        tab_correct=correct,
    )


@dataclass(frozen=True)
class BendCounts:
    ref: int  # reference notes bent by at least the threshold
    est: int  # estimated notes bent by at least the threshold
    hit: int  # matched pairs where both are bent

    @property
    def precision(self) -> float:
        return self.hit / self.est if self.est else float("nan")

    @property
    def recall(self) -> float:
        return self.hit / self.ref if self.ref else float("nan")


def bend_counts(
    ref: Sequence[RefNote], est: Sequence[EstNote], threshold_cents: float = 50.0
) -> BendCounts:
    """Bend detection on matched notes (a bend's start pitch is the matched pitch)."""
    pairs = match(ref, est)
    bent_ref = {i for i, n in enumerate(ref) if abs(n.bend_cents) >= threshold_cents}
    bent_est = {j for j, n in enumerate(est) if abs(n.bend_cents) >= threshold_cents}
    hit = sum(1 for i, j in pairs if i in bent_ref and j in bent_est)
    return BendCounts(ref=len(bent_ref), est=len(bent_est), hit=hit)


def cents_error(a: float, b: float) -> float:
    """Signed difference a - b in cents, wrapped into [-50, 50) (a semitone apart is 0)."""
    return float((a - b + 50.0) % 100.0 - 50.0) if math.isfinite(a - b) else float("nan")
