import numpy as np
import pytest
from numpy.typing import NDArray
from stage_notes.tuning import (
    RATE,
    NoteLike,
    TuningSuggestion,
    a4_offset,
    retuned,
    suggest_tuning,
)


def tones(midi: list[int], cents: float, seconds: float = 1.0) -> NDArray[np.float32]:
    """Harmonic tones (4 partials) in sequence, every pitch `cents` off equal temperament."""
    t = np.arange(int(seconds * RATE)) / RATE
    parts: list[NDArray[np.float64]] = []
    for m in midi:
        f0 = 440.0 * 2 ** ((m - 69 + cents / 100) / 12)
        parts.append(np.sum([np.sin(2 * np.pi * k * f0 * t) / k for k in range(1, 5)], axis=0))
    return (np.concatenate(parts) * 0.2).astype(np.float32)


@pytest.mark.parametrize("cents", [0.0, 20.0, -35.0, 45.0])
def test_a4_offset_finds_the_detuning(cents: float) -> None:
    est = a4_offset(tones([45, 52, 57, 60, 64, 67], cents))
    assert est.cents == pytest.approx(cents, abs=3.0)
    assert est.strength > 0.8


def test_a4_offset_of_silence_is_zero() -> None:
    est = a4_offset(np.zeros(RATE, dtype=np.float32))
    assert (est.cents, est.strength) == (0.0, 0.0)


def test_retuned_lowers_the_pitch_and_reports_the_stretch() -> None:
    audio, stretch = retuned(tones([57], 30.0), 30.0)
    assert stretch == pytest.approx(2 ** (30 / 1200), rel=1e-3)
    assert len(audio) == pytest.approx(RATE * stretch, abs=2)
    assert a4_offset(audio).cents == pytest.approx(0.0, abs=3.0)


def notes(pitches: list[int], duration: float = 0.5, confidence: float = 0.8) -> list[NoteLike]:
    return [NoteLike(p, duration, confidence) for p in pitches]


def suggest(notes: list[NoteLike], instrument: str = "guitar") -> TuningSuggestion:
    return suggest_tuning(
        notes, instrument, min_low_notes=1, min_confidence=0.3, min_duration_s=0.1
    )


def test_standard_without_notes_below_low_e() -> None:
    s = suggest(notes([40, 45, 52, 55, 59, 64]))
    assert (s.name, s.tuning_midi) == ("standard", (64, 59, 55, 50, 45, 40))


def test_weak_or_short_low_notes_are_ignored() -> None:
    low = notes([38], confidence=0.1) + notes([38], duration=0.05)
    assert suggest(low + notes([45, 50])).name == "standard"


def test_open_strings_decide_between_down_tunings() -> None:
    drop_d = notes([38, 38, 45, 50, 55, 59, 64, 50])  # standard strings above a low D
    assert suggest(drop_d).name == "drop_d"
    full = notes([38, 43, 48, 53, 57, 62, 43])  # every string a whole step down
    assert suggest(full).name == "full_step_down"
    half = notes([39, 44, 49, 54, 58, 63])
    suggestion = suggest(half)
    assert suggestion.name == "half_step_down"
    assert 0 < suggestion.confidence <= 1


def test_bass_tunings() -> None:
    s = suggest(notes([26, 33, 38, 43, 26]), "bass")
    assert (s.name, s.tuning_midi) == ("drop_d", (43, 38, 33, 26))
