from pathlib import Path
from typing import Any

import pytest
from tab_metrics import (
    Assignment,
    GtNote,
    fretted_span,
    gt_span_violations,
    guitarset_chords,
    guitarset_notes,
    lowest_fret_baseline,
    onset_groups,
    run_music_core_fret,
    score,
)

CLI = Path(__file__).resolve().parents[3] / "packages" / "music-core" / "src" / "cli.ts"


def _note_annotation(source: int, rows: list[tuple[float, float, float]]) -> dict[str, Any]:
    return {
        "namespace": "note_midi",
        "annotation_metadata": {"data_source": str(source)},
        "data": [{"time": t, "duration": d, "value": v, "confidence": None} for t, d, v in rows],
    }


JAMS: dict[str, Any] = {
    "annotations": [
        _note_annotation(0, [(0.0, 0.5, 43.1)]),  # low E string, fret 3 (G2)
        _note_annotation(5, [(0.01, 0.5, 66.9), (1.0, 0.25, 64.0)]),  # high E: fret 3, open
        {
            "namespace": "chord",
            "annotation_metadata": {"data_source": ""},
            "data": {"time": [0.0], "duration": [2.0], "value": ["G:maj"], "confidence": [None]},
        },
        {
            "namespace": "chord",
            "annotation_metadata": {"data_source": "Semi-automatic chord transcription"},
            "data": [{"time": 0.0, "duration": 2.0, "value": "G:maj(9)", "confidence": None}],
        },
    ]
}


def test_guitarset_notes_map_strings_and_frets() -> None:
    notes = guitarset_notes(JAMS)
    assert [(n.pitch_midi, n.string, n.fret) for n in notes] == [(43, 6, 3), (67, 1, 3), (64, 1, 0)]


def test_guitarset_chords_pick_instructed_or_performed() -> None:
    assert [c.label for c in guitarset_chords(JAMS)] == ["G:maj"]
    assert [c.label for c in guitarset_chords(JAMS, "performed")] == ["G:maj(9)"]


def test_onset_groups_use_the_first_onset_window() -> None:
    notes = guitarset_notes(JAMS)
    assert [len(g) for g in onset_groups(notes)] == [2, 1]


def test_score_counts_agreement_and_span() -> None:
    notes = [
        GtNote("a", 0.0, 1.0, 45, 5, 0),
        GtNote("b", 0.0, 1.0, 52, 4, 2),
        GtNote("c", 0.0, 1.0, 57, 3, 2),
    ]
    right = [
        Assignment("a", 5, 0, False),
        Assignment("b", 4, 2, False),
        Assignment("c", 3, 2, False),
    ]
    wrong = [
        Assignment("a", 5, 0, False),
        Assignment("b", 5, 7, False),
        Assignment("c", 4, 7, False),
    ]
    assert score(notes, right, 4).agreement == 1.0
    s = score(notes, wrong, 4)
    assert s.agreement == pytest.approx(1 / 3)
    assert (s.steps, s.steps_within_span) == (1, 1)
    stretched = [Assignment("b", 4, 2, False), Assignment("c", 2, 9, False)]
    assert score(notes, stretched, 4).span_compliance == 0.0


def test_span_helpers() -> None:
    assert fretted_span([0, 3, 5]) == 2
    assert fretted_span([0, 0]) == 0
    wide = [GtNote("a", 0.0, 1.0, 41, 6, 1), GtNote("b", 0.0, 1.0, 74, 1, 10)]
    assert gt_span_violations(wide, 4) == 1


def test_lowest_fret_baseline() -> None:
    [a] = lowest_fret_baseline([GtNote("a", 0.0, 1.0, 64, 2, 5)])
    assert (a.string, a.fret) == (1, 0)


def test_music_core_cli_round_trip() -> None:
    notes = guitarset_notes(JAMS)
    assignments = run_music_core_fret(CLI, notes, guitarset_chords(JAMS), {"mode": "easiest"})
    assert {a.note_id for a in assignments} == {n.id for n in notes}
    for a, n in zip(
        sorted(assignments, key=lambda a: a.note_id), sorted(notes, key=lambda n: n.id), strict=True
    ):
        assert a.string is not None
        assert a.fret is not None
        assert (40, 45, 50, 55, 59, 64)[6 - a.string] + a.fret == n.pitch_midi
