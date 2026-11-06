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


def test_extend_offsets_lets_a_fading_note_ring_on_up_to_the_next_note() -> None:
    tab, onset = posteriors([(2, 5, 10, 40), (2, 7, 50, 60)])
    tab[25:40, 2, 0] = 0.5  # the first note fades: activity 0.5 from frame 25
    tab[25:40, 2, 6] = 0.5
    tab[40:50, 2, 0] = 0.6  # and rings on faintly until the next note
    tab[40:50, 2, 6] = 0.4
    notes = extract(tab, onset, GUITAB_DEFAULTS)
    assert [(n.start, n.end) for n in notes] == [(10, 25), (50, 60)]
    guitab.extend_offsets(notes, tab, 0.3)
    assert [(n.start, n.end) for n in notes] == [(10, 50), (50, 60)]


def test_low_shift_needs_sustained_confident_notes_below_e2() -> None:
    def note(pitch: int, seconds: float = 0.5, confidence: float = 0.8) -> NoteEvent:
        return NoteEvent(1.0, 1.0 + seconds, pitch, 80, confidence)

    params = dict(GUITAB_DEFAULTS)
    assert guitab.low_shift([note(39)] * 2 + [note(50)] * 5, params) == 0  # too few low notes
    assert guitab.low_shift([note(39)] * 4, params) == 1  # half step down
    assert guitab.low_shift([note(38)] * 3 + [note(39)] * 3, params) == 2  # full step down
    assert guitab.low_shift([note(35)] * 4, params) == 2  # capped at downtune_max
    assert guitab.low_shift([note(38, seconds=0.05)] * 4, params) == 0  # too short
    assert guitab.low_shift([note(38, confidence=0.2)] * 4, params) == 0  # not confident


def test_open_shift_needs_clear_open_string_evidence_at_one_shift() -> None:
    params = dict(GUITAB_DEFAULTS)
    assert guitab.open_shift([0.004, 0.12, 0.01], params)[0] == 1  # half step down
    assert guitab.open_shift([0.0, 0.01, 0.09], params)[0] == 2  # full step down
    assert guitab.open_shift([0.06, 0.12, 0.0], params) == (0, 0.0)  # open strings ring unshifted
    assert guitab.open_shift([0.0, 0.05, 0.0], params) == (0, 0.0)  # too little evidence


def test_excerpt_keeps_a_short_recording_and_bounds_a_long_one() -> None:
    short = np.zeros(guitab.RATE * 30, dtype=np.float32)
    assert guitab.excerpt(short, 60.0) is short
    long = np.arange(guitab.RATE * 300, dtype=np.float32)
    cut = guitab.excerpt(long, 60.0)
    assert len(cut) == guitab.RATE * 60
    piece = guitab.RATE * 20
    assert cut[0] == 0
    assert cut[piece] == (len(long) - piece) // 2
    assert cut[-1] == long[-1]


def test_the_down_tuning_check_and_the_transcription_share_their_passes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[int] = []

    def fake_predict(_: object, feat: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        calls.append(len(feat))
        return posteriors([(0, 3, 10, 30)])

    monkeypatch.setattr(guitab, "predict", fake_predict)

    def no_features(audio: np.ndarray) -> np.ndarray:
        return np.zeros((FRAMES, guitab.N_BINS), dtype=np.float32)

    def no_bends(mono: np.ndarray, params: dict[str, object]) -> list[NoteEvent]:
        return []

    monkeypatch.setattr(guitab, "features", no_features)
    model = guitab.Guitab()
    monkeypatch.setattr(model, "session", lambda: None)
    params = {**GUITAB_DEFAULTS, "downtune": True, "bends": False}
    monkeypatch.setattr(model, "bend_pass", no_bends)
    mono = np.zeros(guitab.RATE * 10, dtype=np.float32)
    assert model.tuning_shift(mono, params) == (0, 0.0)
    assert len(calls) == 3  # standard, a semitone up, two semitones up
    notes = model.transcribe(mono, params)
    assert len(calls) == 3
    assert [n.pitch_midi for n in notes] == [OPEN_PITCH[0] + 3]
    model.transcribe(mono, params)
    assert len(calls) == 4  # transcribe drops the passes when it is done
