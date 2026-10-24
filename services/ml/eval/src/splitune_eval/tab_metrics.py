"""Tab metrics for Prototype 3 (docs/specs/08-evaluation-harness-and-prototypes.md).

Reads GuitarSet JAMS annotations and scores string/fret assignments produced by
`packages/music-core` (through its Node CLI, so the evaluated code is the shipped code).
"""

from __future__ import annotations

import json
import subprocess
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

# GuitarSet: standard tuning, no capo; note_midi annotations are per string, data_source 0 = low E.
GUITARSET_OPEN_LOW_TO_HIGH = (40, 45, 50, 55, 59, 64)
STRINGS = len(GUITARSET_OPEN_LOW_TO_HIGH)


@dataclass(frozen=True)
class GtNote:
    id: str
    onset_s: float
    offset_s: float
    pitch_midi: int
    string: int  # 1 = highest-pitched string (Splitune convention)
    fret: int


@dataclass(frozen=True)
class Chord:
    t0: float
    t1: float
    label: str


@dataclass(frozen=True)
class Assignment:
    note_id: str
    string: int | None
    fret: int | None
    unplayable: bool


@dataclass(frozen=True)
class Score:
    notes: int
    agreed: int
    steps: int  # onset groups with at least two fretted notes
    steps_within_span: int
    unplaced: int

    @property
    def agreement(self) -> float:
        return self.agreed / self.notes if self.notes else 0.0

    @property
    def span_compliance(self) -> float:
        return self.steps_within_span / self.steps if self.steps else 1.0


def _observations(annotation: dict[str, Any]) -> list[dict[str, Any]]:
    data = annotation["data"]
    if isinstance(data, list):
        return cast(list[dict[str, Any]], data)
    columns = cast(dict[str, list[Any]], data)
    keys = list(columns)
    return [dict(zip(keys, row, strict=True)) for row in zip(*columns.values(), strict=True)]


def load_jams(path: Path) -> dict[str, Any]:
    return cast(dict[str, Any], json.loads(path.read_text(encoding="utf-8")))


def guitarset_notes(jams: dict[str, Any]) -> list[GtNote]:
    """Ground-truth notes; fret = rounded MIDI pitch minus the open string."""
    notes: list[GtNote] = []
    for annotation in cast(list[dict[str, Any]], jams["annotations"]):
        if annotation["namespace"] != "note_midi":
            continue
        source = int(annotation["annotation_metadata"]["data_source"])
        open_pitch = GUITARSET_OPEN_LOW_TO_HIGH[source]
        for obs in _observations(annotation):
            pitch = round(float(obs["value"]))
            onset = float(obs["time"])
            notes.append(
                GtNote(
                    id=f"s{source}n{len(notes):05d}",
                    onset_s=onset,
                    offset_s=onset + float(obs["duration"]),
                    pitch_midi=pitch,
                    string=STRINGS - source,
                    fret=pitch - open_pitch,
                )
            )
    notes.sort(key=lambda n: (n.onset_s, -n.pitch_midi))
    return notes


def guitarset_chords(jams: dict[str, Any], which: str = "instructed") -> list[Chord]:
    """Chord annotations: GuitarSet has the lead-sheet ("instructed") and a performed one."""
    chord_annotations = [
        a for a in cast(list[dict[str, Any]], jams["annotations"]) if a["namespace"] == "chord"
    ]
    performed = [a for a in chord_annotations if a["annotation_metadata"].get("data_source")]
    instructed = [a for a in chord_annotations if not a["annotation_metadata"].get("data_source")]
    chosen = (instructed if which == "instructed" else performed) or chord_annotations
    if not chosen:
        return []
    return [
        Chord(
            t0=float(o["time"]),
            t1=float(o["time"]) + float(o["duration"]),
            label=str(o["value"]),
        )
        for o in _observations(chosen[0])
    ]


def onset_groups(notes: Sequence[GtNote], window_s: float = 0.03) -> list[list[GtNote]]:
    """Same grouping rule as music-core `groupIntoSteps` (first onset of a group + window)."""
    groups: list[list[GtNote]] = []
    anchor = float("-inf")
    for note in sorted(notes, key=lambda n: n.onset_s):
        if note.onset_s - anchor > window_s + 1e-9:
            anchor = note.onset_s
            groups.append([])
        groups[-1].append(note)
    return groups


def fretted_span(frets: Iterable[int]) -> int:
    fretted = [f for f in frets if f > 0]
    return max(fretted) - min(fretted) if fretted else 0


def score(
    notes: Sequence[GtNote],
    assignments: Sequence[Assignment],
    max_span: int,
    window_s: float = 0.03,
) -> Score:
    by_id = {a.note_id: a for a in assignments}
    agreed = sum(
        1
        for n in notes
        if (a := by_id.get(n.id)) is not None and (a.string, a.fret) == (n.string, n.fret)
    )
    steps = 0
    within = 0
    for group in onset_groups(notes, window_s):
        frets = [
            a.fret
            for n in group
            if (a := by_id.get(n.id)) is not None and a.fret is not None and a.fret > 0
        ]
        if len(frets) < 2:
            continue
        steps += 1
        within += fretted_span(frets) <= max_span
    unplaced = sum(1 for a in assignments if a.string is None)
    return Score(
        notes=len(notes), agreed=agreed, steps=steps, steps_within_span=within, unplaced=unplaced
    )


def gt_span_violations(notes: Sequence[GtNote], max_span: int, window_s: float = 0.03) -> int:
    """Onset groups whose ground-truth fingering itself exceeds `max_span`."""
    return sum(
        1
        for group in onset_groups(notes, window_s)
        if len([n for n in group if n.fret > 0]) >= 2
        and fretted_span(n.fret for n in group) > max_span
    )


def lowest_fret_baseline(notes: Sequence[GtNote]) -> list[Assignment]:
    """Reference baseline: every note at its lowest fret (string clashes ignored)."""
    out: list[Assignment] = []
    for n in notes:
        options = [
            (n.pitch_midi - open_pitch, STRINGS - source)
            for source, open_pitch in enumerate(GUITARSET_OPEN_LOW_TO_HIGH)
            if 0 <= n.pitch_midi - open_pitch <= 20
        ]
        fret, string = min(options) if options else (None, None)
        out.append(Assignment(note_id=n.id, string=string, fret=fret, unplayable=not options))
    return out


def run_music_core_fret(
    cli: Path,
    notes: Sequence[GtNote],
    chords: Sequence[Chord],
    config: dict[str, Any],
) -> list[Assignment]:
    """Calls `node packages/music-core/src/cli.ts fret` (JSON stdin → JSON stdout)."""
    payload = {
        "notes": [
            {"id": n.id, "onset_s": n.onset_s, "offset_s": n.offset_s, "pitch_midi": n.pitch_midi}
            for n in notes
        ],
        "chords": [{"t0": c.t0, "t1": c.t1, "label": c.label} for c in chords],
        "config": config,
    }
    result = subprocess.run(
        ["node", str(cli), "fret"],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"music-core fret failed ({result.returncode}): {result.stderr.strip()}")
    rows = cast(list[dict[str, Any]], json.loads(result.stdout)["assignments"])
    return [
        Assignment(
            note_id=str(r["note_id"]),
            string=cast(int | None, r.get("string")),
            fret=cast(int | None, r.get("fret")),
            unplayable=bool(r["unplayable"]),
        )
        for r in rows
    ]
