import numpy as np
import pytest
from stage_notes import guitab
from stage_notes.guitab import GUITAB_DEFAULTS, OPEN_PITCH, extract, string_probs
from stage_notes.transcribers import NoteEvent

FRAMES = 80


def posteriors(
    notes: list[tuple[int, int, int, int]], onset_p: float = 0.9
) -> tuple[np.ndarray, np.ndarray]:
    """tab [T, 6, 21] and onset [T, 6] for (column, fret, start, end) notes: the fret certain while
    the note sounds, silence elsewhere, an onset peak at its start."""
    tab = np.zeros((FRAMES, 6, guitab.N_FRETS + 1), dtype=np.float32)
    tab[:, :, 0] = 1.0
    onset = np.zeros((FRAMES, 6), dtype=np.float32)
    for col, fret, start, end in notes:
        tab[start:end, col, 0] = 0.0
        tab[start:end, col, fret + 1] = 1.0
        onset[start, col] = onset_p
    return tab, onset


def found(tab: np.ndarray, onset: np.ndarray) -> list[tuple[int, int, int, int]]:
    return [(n.col, n.fret, n.start, n.end) for n in extract(tab, onset, GUITAB_DEFAULTS)]


def test_each_onset_peak_starts_a_note_that_ends_at_silence() -> None:
    notes = [(0, 3, 10, 30), (4, 5, 12, 40)]
    assert found(*posteriors(notes)) == notes


def test_a_held_fret_change_starts_the_next_note_without_an_onset() -> None:
    tab, onset = posteriors([(1, 2, 10, 50)])
    tab[30:50, 1, 3] = 0.0
    tab[30:50, 1, 5] = 1.0  # a hammer-on from fret 2 to fret 4 at frame 30
    assert found(tab, onset) == [(1, 2, 10, 30), (1, 4, 30, 50)]


def test_the_same_pitch_on_two_strings_is_kept_once() -> None:
    # E3 (52) as string 5 fret 7 (column 1) and string 4 fret 2 (column 2), the latter less sure.
    tab, onset = posteriors([(1, 7, 10, 30), (2, 2, 11, 30)])
    tab[11:30, 2, 3] = 0.6
    tab[11:30, 2, 0] = 0.4
    assert found(tab, onset) == [(1, 7, 10, 30)]


def test_a_weak_onset_inside_a_ringing_note_does_not_split_it() -> None:
    tab, onset = posteriors([(3, 0, 10, 60)])
    onset[35, 3] = 0.5  # a peak above the threshold but below the re-attack bar
    assert found(tab, onset) == [(3, 0, 10, 60)]


def test_string_probs_follow_the_fret_posteriors_for_the_pitch() -> None:
    tab, onset = posteriors([(1, 7, 10, 30)])  # E3 on string 5
    tab[10:13, 2, 3] = 0.25  # string 4 fret 2 also plays E3
    (note,) = extract(tab, onset, GUITAB_DEFAULTS)
    probs = string_probs(tab, note, 3)
    assert note.pitch == OPEN_PITCH[1] + 7 == 52
    assert probs[4] == pytest.approx(0.8, abs=1e-3)  # string 5 (string 1 first)
    assert probs[3] == pytest.approx(0.2, abs=1e-3)
    assert sum(probs) == pytest.approx(1.0, abs=1e-3)


def test_predict_blends_windows_and_keeps_the_input_length() -> None:
    class Session:
        def run(self, _names: list[str], feeds: dict[str, np.ndarray]) -> list[np.ndarray]:
            frames = feeds["x"].shape[1]
            tab = np.zeros((1, frames, 6, guitab.N_FRETS + 1), dtype=np.float32)
            tab[..., 0] = 1.0
            return [tab, np.full((1, frames, 6), 0.25, dtype=np.float32)]

    for total in (100, guitab.WINDOW, 1000):
        tab, onset = guitab.predict(Session(), np.zeros((total, guitab.N_BINS), np.float32))  # pyright: ignore[reportArgumentType]
        assert tab.shape == (total, 6, guitab.N_FRETS + 1)
        assert np.allclose(onset, 0.25)
        assert np.allclose(tab[..., 0], 1.0)


def test_with_bends_gives_the_curve_to_the_picked_note_and_drops_its_glide() -> None:
    def event(
        onset: float, offset: float, pitch: int, bend: tuple[tuple[float, float], ...] = ()
    ) -> NoteEvent:
        return NoteEvent(onset, offset, pitch, 80, 0.9, bend_cents=bend)

    curve = ((0.0, 0.0), (0.1, 100.0), (0.2, 195.0))
    notes = [event(1.0, 1.1, 62), event(1.1, 1.2, 63), event(1.2, 1.5, 64), event(2.0, 2.5, 64)]
    out = guitab.with_bends(notes, [event(1.01, 1.5, 62, curve)])
    assert [(n.onset_s, n.offset_s, n.pitch_midi, n.bend_cents) for n in out] == [
        (1.0, 1.5, 62, curve),
        (2.0, 2.5, 64, ()),
    ]
    missed = guitab.with_bends([], [event(3.0, 3.4, 60, curve)])
    assert [n.pitch_midi for n in missed] == [60]
