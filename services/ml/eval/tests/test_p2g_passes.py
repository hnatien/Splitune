import numpy as np
import p2g
import p2g_finetune
import pytest
from splitune_eval.guitar_refs import RefNote


def note(onset: float, offset: float, pitch: int, confidence: float) -> dict[str, float]:
    return {"onset_s": onset, "offset_s": offset, "pitch_midi": pitch, "confidence": confidence}


def test_leak_pass_drops_only_weak_notes_another_stem_also_has() -> None:
    notes = [note(1.0, 1.5, 40, 0.2), note(2.0, 2.5, 40, 0.9), note(3.0, 3.5, 45, 0.2)]
    bass = [(1.02, 40), (2.0, 40), (3.0, 33)]
    kept = p2g.leak_pass(notes, bass, max_conf=0.5, octaves=False)
    assert [n["onset_s"] for n in kept] == [2.0, 3.0]
    assert p2g.leak_pass(notes, bass, max_conf=0.5, octaves=True) == [notes[1]]


def test_fragment_pass_joins_a_weak_restart_of_the_same_pitch() -> None:
    notes = [note(1.0, 1.5, 50, 0.9), note(1.51, 2.0, 50, 0.3), note(2.5, 3.0, 50, 0.3)]
    kept = p2g.fragment_pass(notes, gap_s=0.02, max_conf=0.5)
    assert [(n["onset_s"], n["offset_s"]) for n in kept] == [(1.0, 2.0), (2.5, 3.0)]
    assert notes[0]["offset_s"] == 1.5  # the input is left alone


def test_snap_pass_moves_near_onsets_onto_the_sixteenth_grid() -> None:
    beats = [0.0, 0.5, 1.0]  # 120 bpm: sixteenths every 0.125 s
    kept = p2g.snap_pass([note(0.135, 0.3, 60, 1.0), note(0.19, 0.3, 60, 1.0)], beats, 0.02)
    assert kept[0]["onset_s"] == pytest.approx(0.125)
    assert kept[1]["onset_s"] == 0.19


def test_grid_residuals_measure_the_distance_to_the_nearest_point() -> None:
    (position,) = p2g.beat_positions([0.6], [0.0, 0.5, 1.0])
    assert position == pytest.approx((0.2, 0.5))
    assert p2g.grid_residual_ms(0.2, 0.5, p2g.GRIDS["1/16"]) == pytest.approx(25.0)
    assert p2g.grid_residual_ms(1 / 6, 0.5, p2g.GRIDS["1/16 + 1/16 triplets"]) == pytest.approx(0.0)


def test_finetune_frame_labels_put_frets_on_model_columns_and_mask_unknown_strings() -> None:
    fps = p2g_finetune.guitab.FPS
    notes = [
        RefNote(0.0, 0.5, 45, string=5, fret=0),  # open A: column 1, class 1
        RefNote(0.0, 0.5, 64, string=1, fret=0),  # open high E: column 5
        RefNote(1.0, 1.5, 60),  # no string known
    ]
    tab, onset = p2g_finetune.frame_labels(notes, int(2 * fps))
    assert tab[0, 1] == 1
    assert tab[0, 5] == 1
    assert onset[0, 1] == 1
    assert tab[0, 0] == 0
    unknown = round(1.0 * fps)
    assert np.all(tab[unknown + 1, :] == -100)
    assert np.all(onset[unknown, :] == -1)
