from __future__ import annotations

import p2p  # pyright: ignore[reportMissingImports, reportUnknownVariableType]
import pytest

# The script module is untyped from the tests' point of view.
# pyright: reportUnknownMemberType=false, reportUnknownArgumentType=false, reportUnknownVariableType=false


def test_pedal_extends_offsets_held_by_the_sustain_pedal() -> None:
    notes = [(0.0, 0.5, 60, 80), (0.2, 1.5, 64, 80), (2.0, 2.5, 67, 80)]
    pedal = [(0.4, 1.0)]
    out = p2p.pedal_extend(notes, pedal)
    assert out[0] == (0.0, 1.0, 60, 80)  # key up inside the pedal → pedal release
    assert out[1] == (0.2, 1.5, 64, 80)  # key up after the pedal: unchanged
    assert out[2] == (2.0, 2.5, 67, 80)


def test_pedal_extension_stops_at_the_next_strike_of_the_same_key() -> None:
    notes = [(0.0, 0.3, 60, 80), (0.8, 1.2, 60, 70)]
    out = p2p.pedal_extend(notes, [(0.1, 2.0)])
    assert out[0] == (0.0, 0.8, 60, 80)
    assert out[1] == (0.8, 2.0, 60, 70)


def test_window_keeps_onsets_inside_and_clips_offsets() -> None:
    notes = [(9.0, 11.0, 60, 80), (10.0, 12.0, 62, 80), (39.0, 45.0, 64, 80)]
    assert p2p.window_notes(notes, 10.0, 40.0) == [(0.0, 2.0, 62, 80), (29.0, 30.0, 64, 80)]
    assert p2p.window_pedal([(5.0, 12.0), (41.0, 42.0)], 10.0, 40.0) == [(0.0, 2.0)]


def test_top_line_keeps_the_highest_note_of_each_onset_group() -> None:
    notes = [(0.0, 1.0, 48, 80), (0.01, 1.0, 72, 80), (0.5, 1.0, 60, 80)]
    assert p2p.top_line(notes) == [(0.01, 1.0, 72, 80), (0.5, 1.0, 60, 80)]


def test_best_shift_transposes_onto_the_band_key() -> None:
    c_major = [(0.0, 1.0, p, 80) for p in (60, 64, 67, 62, 65, 69, 71)]
    target = [0.0] * 12
    for pc in (2, 6, 9, 4, 7, 11, 1):  # D major
        target[pc] = 1.0
    assert p2p.best_shift(c_major, p2p.np.array(target)) == 2


def test_beats_artefact_marks_a_pickup_before_the_first_downbeat() -> None:
    doc = p2p.beats_artefact([0.5, 1.0, 1.5, 2.0, 2.5], [False, True, False, False, False], 3.0)
    beats = doc["beats"]
    assert doc["meter"] == {"numerator": 4, "denominator": 4}
    assert doc["first_downbeat_t"] == pytest.approx(1.0)
    assert (beats[0]["bar_index"], beats[0]["beat_in_bar"], beats[0]["is_downbeat"]) == (
        -1,
        4,
        False,
    )
    assert (beats[1]["bar_index"], beats[1]["beat_in_bar"], beats[1]["is_downbeat"]) == (0, 1, True)
    assert beats[4]["beat_in_bar"] == 4
