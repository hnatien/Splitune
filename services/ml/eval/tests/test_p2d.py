from __future__ import annotations

import p2d  # pyright: ignore[reportMissingImports, reportUnknownVariableType]
import pytest

# The script module is untyped from the tests' point of view.
# pyright: reportUnknownMemberType=false, reportUnknownArgumentType=false, reportUnknownVariableType=false


def test_swing_share_tells_swung_eighths_from_straight_sixteenths() -> None:
    bpm = 120.0  # beat = 0.5 s
    straight16 = [(b * 0.5 + q * 0.125, 42, 80) for b in range(16) for q in range(4)]
    swung8 = [(b * 0.5 + p, 42, 80) for b in range(16) for p in (0.0, 0.333)]
    assert p2d.swing_share(straight16, bpm) == 0.0
    assert p2d.swing_share(swung8, bpm) == 1.0


def test_machine_hits_snap_to_sixteenths_at_flat_velocity_and_drop_doubles() -> None:
    hits = [(0.01, 36, 90), (0.13, 42, 40), (0.124, 42, 70), (0.49, 38, 110)]
    assert p2d.machine_hits(hits, 120.0) == [(0.0, 36, 100), (0.125, 42, 100), (0.5, 38, 100)]


def test_busiest_window_starts_where_most_hits_are() -> None:
    hits = [(float(t), 36) for t in range(40, 70)] + [(5.0, 38)]
    assert p2d.busiest_window(hits, 100.0) == 40.0
    assert p2d.busiest_window(hits, 20.0) == 0.0


def test_onset_scores_match_within_each_class_and_sum_over_classes() -> None:
    ref = [(1.0, 36), (2.0, 38), (3.0, 42)]
    est = [(1.02, 36), (2.0, 42), (3.04, 46)]  # a snare heard as hi-hat; open for closed is fine
    s = p2d.onset_scores(ref, est, p2d.drum_kit.CLASSES, 0.05)
    assert s["counts"]["kick"] == (1, 1, 1)
    assert s["counts"]["snare"] == (0, 1, 0)
    assert s["counts"]["hihat"] == (1, 1, 2)
    assert s["f1"] == pytest.approx(2 * 2 / 6)
    tight = p2d.onset_scores(ref, est, p2d.drum_kit.CLASSES, 0.03)
    assert tight["counts"]["hihat"] == (0, 1, 2)


def test_three_class_items_ignore_toms_and_cymbals() -> None:
    s = p2d.onset_scores([(1.0, 36)], [(1.0, 36), (2.0, 49), (3.0, 47)], p2d.CLASS3, 0.05)
    assert s["f1"] == 1.0


def test_kit_piece_scores_compare_pieces_of_class_matched_hits() -> None:
    ref = [(1.0, 46), (2.0, 42), (3.0, 49), (4.0, 53), (5.0, 43)]
    est = [
        {"onset_s": 1.0, "gm_note": 42, "class5": "hihat"},  # closed for open: wrong
        {"onset_s": 2.0, "gm_note": 42, "class5": "hihat"},
        {"onset_s": 3.0, "gm_note": 51, "class5": "cymbals"},  # ride for crash: wrong
        {"onset_s": 4.0, "gm_note": 51, "class5": "cymbals"},  # ride for bell: right
        {"onset_s": 5.0, "gm_note": 47, "class5": "toms"},  # mid for floor: wrong
    ]
    assert p2d.kit_piece_scores(ref, est) == {"hihat": (1, 2), "cymbals": (1, 2), "toms": (0, 1)}
