from pathlib import Path

import pytest
from splitune_eval.guitar_refs import (
    STANDARD,
    EstNote,
    GuitarRef,
    RefNote,
    bend_counts,
    cents_error,
    dropped,
    merged,
    repitched,
    shifted,
    tab_counts,
    trimmed,
)

REF = GuitarRef(
    notes=(
        RefNote(0.0, 0.5, 40, string=6, fret=0),  # open low E
        RefNote(1.0, 1.5, 67, string=1, fret=3),  # G4 on the high E
    ),
    beats=(0.0, 0.5, 1.0),
)


def test_roundtrip(tmp_path: Path) -> None:
    path = tmp_path / "ref.json"
    REF.dump(path)
    assert GuitarRef.load(path) == REF


def test_repitched_down_is_a_lower_tuning_with_the_same_frets() -> None:
    down = repitched(REF, -100.0)
    assert down.tuning_midi == tuple(p - 1 for p in STANDARD)
    assert [(n.pitch_midi, n.string, n.fret) for n in down.notes] == [(39, 6, 0), (66, 1, 3)]
    assert down.capo == 0
    assert down.a4_cents == pytest.approx(0.0)
    # Played back faster by the same ratio.
    assert down.notes[1].onset_s == pytest.approx(1.0 / 2 ** (-100 / 1200))


def test_repitched_up_is_a_capo_with_absolute_frets() -> None:
    up = repitched(REF, 200.0)
    assert up.tuning_midi == STANDARD
    assert up.capo == 2
    assert [(n.pitch_midi, n.fret) for n in up.notes] == [(42, 2), (69, 5)]


def test_repitched_fraction_is_the_a4_offset() -> None:
    off = repitched(REF, -35.0)
    assert off.a4_cents == pytest.approx(-35.0)
    assert [n.pitch_midi for n in off.notes] == [40, 67]
    assert repitched(REF, 135.0).a4_cents == pytest.approx(35.0)


def test_dropped_moves_only_the_dropped_string() -> None:
    drop = dropped(REF)
    assert drop.tuning_midi == (64, 59, 55, 50, 45, 38)
    assert [(n.pitch_midi, n.fret) for n in drop.notes] == [(38, 0), (67, 3)]


def test_shift_trim_merge() -> None:
    lead = shifted(REF, -0.25, "lead")
    assert [n.onset_s for n in lead.notes] == [0.75]
    assert lead.notes[0].part == "lead"
    assert trimmed(REF, 1.2).notes[-1].offset_s == pytest.approx(1.2)
    both = merged(shifted(REF, 0.0, "rhythm"), lead)
    assert [n.part for n in both.notes] == ["rhythm", "lead", "rhythm"]
    assert both.meta["guitars"] == 2


def test_tab_counts() -> None:
    est = [
        EstNote(0.01, 0.5, 40, string=6, fret=0),  # right
        EstNote(1.02, 1.5, 67, string=2, fret=8),  # right pitch, wrong string
        EstNote(2.0, 2.5, 50),  # extra
    ]
    counts = tab_counts(list(REF.notes), est)
    assert (counts.ref, counts.est, counts.matched, counts.tab_correct) == (2, 3, 2, 1)
    assert counts.tdr == pytest.approx(0.5)
    assert counts.precision == pytest.approx(1 / 3)
    assert counts.recall == pytest.approx(0.5)
    assert counts.f1 == pytest.approx(0.4)


def test_tab_counts_leave_out_untabbed_reference_notes() -> None:
    ref = [RefNote(0.0, 0.5, 40, string=6, fret=0), RefNote(1.0, 1.5, 67)]  # 2nd: no tab
    est = [EstNote(0.0, 0.5, 40, string=6, fret=0), EstNote(1.0, 1.5, 67, string=1, fret=3)]
    counts = tab_counts(ref, est)
    assert (counts.ref, counts.est, counts.matched, counts.tab_correct) == (1, 1, 1, 1)


def test_bend_counts() -> None:
    ref = [RefNote(0.0, 0.5, 60, bend_cents=200.0), RefNote(1.0, 1.5, 62)]
    est = [EstNote(0.0, 0.5, 60, bend_cents=180.0), EstNote(1.0, 1.5, 62, bend_cents=60.0)]
    counts = bend_counts(ref, est)
    assert (counts.ref, counts.est, counts.hit) == (1, 2, 1)
    assert counts.precision == pytest.approx(0.5)
    assert counts.recall == pytest.approx(1.0)


def test_cents_error_wraps_semitones() -> None:
    assert cents_error(-35.0, 0.0) == pytest.approx(-35.0)
    assert cents_error(65.0, 0.0) == pytest.approx(-35.0)
    assert cents_error(100.0, 0.0) == pytest.approx(0.0)
