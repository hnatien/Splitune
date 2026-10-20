"""Reference and estimate loaders. Estimates are Splitune artefacts (contracts JSON) or plain
text; references are JAMS (GuitarSet and friends), MIREX-style .lab/.txt, or CSV."""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

import numpy as np
from numpy.typing import NDArray
from splitune_ml_core import contracts

from .tab_metrics import load_jams


def _observations(annotation: dict[str, Any]) -> list[dict[str, Any]]:
    data = annotation["data"]
    if isinstance(data, list):
        return cast(list[dict[str, Any]], data)
    columns = cast(dict[str, list[Any]], data)
    keys = list(columns)
    return [dict(zip(keys, row, strict=True)) for row in zip(*columns.values(), strict=True)]


def _annotations(path: Path, *namespaces: str) -> list[dict[str, Any]]:
    jams = load_jams(path)
    return [
        a for a in cast(list[dict[str, Any]], jams["annotations"]) if a["namespace"] in namespaces
    ]


def _rows(path: Path) -> list[list[str]]:
    text = path.read_text(encoding="utf-8")
    delimiter = "," if path.suffix == ".csv" else None
    if delimiter:
        return [r for r in csv.reader(text.splitlines()) if r and not r[0].startswith("#")]
    return [line.split() for line in text.splitlines() if line.strip() and not line.startswith("#")]


@dataclass(frozen=True)
class BeatTimes:
    beats: NDArray[np.float64]
    downbeats: NDArray[np.float64] | None


def beats(path: Path) -> BeatTimes:
    if path.suffix == ".jams":
        annotation = _annotations(path, "beat_position", "beat")[0]
        obs = _observations(annotation)
        times = np.array([float(o["time"]) for o in obs])
        if annotation["namespace"] == "beat_position":
            down = np.array([float(o["time"]) for o in obs if o["value"]["position"] == 1])
            return BeatTimes(times, down)
        return BeatTimes(times, None)
    if path.suffix == ".json":
        document = contracts.Beats.model_validate_json(path.read_text(encoding="utf-8"))
        return BeatTimes(
            np.array([b.t for b in document.beats]),
            np.array([b.t for b in document.beats if b.is_downbeat]),
        )
    rows = _rows(path)
    times = np.array([float(r[0]) for r in rows])
    if rows and len(rows[0]) > 1:  # (time, position-in-bar), e.g. beat_this .beats files
        down = np.array([float(r[0]) for r in rows if float(r[1]) == 1])
        return BeatTimes(times, down)
    return BeatTimes(times, None)


@dataclass(frozen=True)
class NoteEvents:
    intervals: NDArray[np.float64]  # (n, 2) onset/offset seconds
    pitches_midi: NDArray[np.float64]


def notes(path: Path) -> NoteEvents:
    rows: list[tuple[float, float, float]]
    if path.suffix == ".jams":
        rows = [
            (float(o["time"]), float(o["time"]) + float(o["duration"]), float(o["value"]))
            for a in _annotations(path, "note_midi")
            for o in _observations(a)
        ]
    elif path.suffix == ".json":
        document = cast(dict[str, Any], json.loads(path.read_text(encoding="utf-8")))
        parsed = contracts.Notes.model_validate(document)
        rows = [(n.onset_s, n.offset_s, float(n.pitch_midi)) for n in parsed.notes]
    else:
        rows = [(float(r[0]), float(r[1]), float(r[2])) for r in _rows(path)]
    rows.sort()
    if not rows:
        return NoteEvents(np.zeros((0, 2)), np.zeros(0))
    data = np.array(rows, dtype=np.float64)
    return NoteEvents(data[:, :2], data[:, 2])


@dataclass(frozen=True)
class ChordLabels:
    intervals: NDArray[np.float64]
    labels: list[str]


def chords(path: Path) -> ChordLabels:
    rows: list[tuple[float, float, str]]
    if path.suffix == ".jams":
        # The first chord annotation is GuitarSet's lead sheet ("instructed") chords.
        obs = _observations(_annotations(path, "chord", "chord_harte")[0])
        rows = [
            (float(o["time"]), float(o["time"]) + float(o["duration"]), str(o["value"]))
            for o in obs
        ]
    elif path.suffix == ".json":
        document = contracts.Chords.model_validate_json(path.read_text(encoding="utf-8"))
        rows = [(s.t0, s.t1, s.label) for s in document.segments]
    else:
        rows = [(float(r[0]), float(r[1]), r[2]) for r in _rows(path)]
    return ChordLabels(
        np.array([[a, b] for a, b, _ in rows], dtype=np.float64), [c for _, _, c in rows]
    )


@dataclass(frozen=True)
class Contour:
    times: NDArray[np.float64]
    hz: NDArray[np.float64]  # 0 = unvoiced


def melody(path: Path) -> Contour:
    if path.suffix == ".jams":
        obs = _observations(_annotations(path, "pitch_contour")[0])
        times = np.array([float(o["time"]) for o in obs])
        hz = np.array(
            [float(o["value"]["frequency"]) if o["value"]["voiced"] else 0.0 for o in obs]
        )
        return Contour(times, np.abs(hz))
    rows = _rows(path)
    return Contour(
        np.array([float(r[0]) for r in rows]), np.array([max(0.0, float(r[1])) for r in rows])
    )
