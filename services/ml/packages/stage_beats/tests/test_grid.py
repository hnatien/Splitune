from __future__ import annotations

import numpy as np
from stage_beats import grid


def test_labels_match_music_core() -> None:
    # Same cases as packages/music-core labelBeats: pickup, long pre-roll, no downbeats.
    pickup = grid.label_beats([False, True, False, False, False, True, False], 4)
    assert pickup.bars == [-1, 0, 0, 0, 0, 1, 1]
    assert pickup.beat_in_bar == [4, 1, 2, 3, 4, 1, 2]
    late = grid.label_beats([False] * 5 + [True, False, False], 4)
    assert late.bars == [-1, 0, 0, 0, 0, 1, 1, 1]
    assert late.beat_in_bar == [4, 1, 2, 3, 4, 1, 2, 3]
    assert late.is_downbeat[1]
    none = grid.label_beats([False] * 7, 3)
    assert none.bars == [0, 0, 0, 1, 1, 1, 2]
    assert none.beat_in_bar == [1, 2, 3, 1, 2, 3, 1]


def test_modal_bar_length() -> None:
    flags = [i % 3 == 0 for i in range(12)] + [True, False, False, False]
    assert grid.modal_bar_length(flags) == 3
    assert grid.modal_bar_length([False, False]) == 4
    assert grid.modal_bar_length([True, False, True, False, False, True]) == 2  # tie → smaller


def test_bpm_and_octave_ambiguity() -> None:
    times = [0.5 + i * 0.5 for i in range(20)]
    assert abs(grid.median_bpm(times) - 120) < 1e-9
    frames = [round(t * grid.FPS) for t in times]
    clean = np.zeros(frames[-1] + 30, dtype=np.float32)
    clean[frames] = 0.95
    assert not grid.octave_ambiguous(clean, frames, 120, margin=0.5, bpm_range=(75, 150))
    offbeats = clean.copy()
    offbeats[[f + 12 for f in frames]] = 0.7  # strong activation half-way between beats
    assert grid.octave_ambiguous(offbeats, frames, 120, margin=0.5, bpm_range=(75, 150))
    assert grid.octave_ambiguous(clean, frames, 172, margin=0.5, bpm_range=(75, 150))
    assert grid.octave_ambiguous(clean, frames, 64, margin=0.5, bpm_range=(75, 150))


def test_bpm_curve_only_for_drifting_tempo() -> None:
    steady = [i * 0.5 for i in range(33)]
    labels = grid.label_beats([i % 4 == 0 for i in range(33)], 4)
    assert grid.bpm_curve(steady, labels, 0.04) is None
    drifting: list[float] = [0.0]
    for i in range(32):
        drifting.append(drifting[-1] + 0.5 * (1 + 0.01 * i))
    curve = grid.bpm_curve(drifting, labels, 0.04)
    assert curve is not None
    assert len(curve) == 8
    assert curve[0][1] > curve[-1][1]
