import numpy as np
import pytest
from stage_notes import basic_pitch as bp
from stage_notes.bends import merged

FRAMES = 120


def posteriors(pitch: int, cents: list[float | None], onsets: dict[int, int]) -> bp.Posteriors:
    """A contour that sits `cents[k]` above `pitch` at frame k (None = silent), and onset peaks
    {frame: pitch}."""
    contour = np.zeros((FRAMES, 264), dtype=np.float32)
    bins = np.arange(264)
    for k, c in enumerate(cents):
        if c is not None:
            centre = 3 * (pitch - bp.MIDI_OFFSET) + 1 + 3 * c / 100
            contour[k] = 0.8 * np.exp(-0.5 * ((bins - centre) / 0.7) ** 2)
    onset = np.zeros((FRAMES, 88), dtype=np.float32)
    for k, p in onsets.items():
        onset[k, p - bp.MIDI_OFFSET] = 0.9
    return bp.Posteriors(np.zeros((FRAMES, 88), dtype=np.float32), onset, contour)


def run(post: bp.Posteriors, notes: list[bp.RawNote]) -> list[tuple[int, int, int, float]]:
    out = merged(post, notes, onset_thresh=0.6, min_cents=75.0, min_glide_frames=3)
    return [
        (b.note.start, b.note.end, b.note.pitch_midi, max((c for _, c in b.curve), default=0.0))
        for b in out
    ]


def note(start: int, end: int, pitch: int) -> bp.RawNote:
    return bp.RawNote(start, end, pitch, 0.5)


def bend_up(hold: int, rise: int, cents: float, sustain: int) -> list[float | None]:
    return [0.0] * hold + list(np.linspace(0, cents, rise)) + [cents] * sustain


def test_a_split_whole_step_bend_becomes_one_bent_note() -> None:
    cents = [None] * 10 + bend_up(4, 8, 200.0, 30)
    post = posteriors(62, cents, {10: 62})
    fragments = [note(10, 18, 62), note(17, 21, 63), note(20, 52, 64)]
    ((start, end, pitch, height),) = run(post, fragments)
    assert (start, end, pitch) == (10, 52, 62)
    assert height == pytest.approx(200.0, abs=10.0)


def test_a_bend_whose_pick_the_decoder_lost_moves_back_to_the_pick() -> None:
    cents = [None] * 10 + bend_up(2, 8, 200.0, 30)
    post = posteriors(62, cents, {10: 62})
    ((start, _, pitch, height),) = run(post, [note(16, 20, 63), note(19, 50, 64)])
    assert (start, pitch) == (10, 62)
    assert height == pytest.approx(200.0, abs=10.0)


def test_a_chromatic_legato_run_stays_three_notes() -> None:
    cents = [None] * 10 + [0.0] * 15 + [100.0] * 15 + [200.0] * 15
    post = posteriors(62, cents, {10: 62})
    notes = [note(10, 25, 62), note(25, 40, 63), note(40, 55, 64)]
    assert run(post, notes) == [(10, 25, 62, 0.0), (25, 40, 63, 0.0), (40, 55, 64, 0.0)]


def test_vibrato_is_not_a_bend() -> None:
    cents = [None] * 10 + [40.0 * float(np.sin(k / 3)) for k in range(80)]
    post = posteriors(67, cents, {10: 67})
    assert run(post, [note(10, 90, 67)]) == [(10, 90, 67, 0.0)]
