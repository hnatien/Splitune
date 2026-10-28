from pathlib import Path

import numpy as np
import pytest
from stage_notes.strings import FEATURES, RATE, StringModel, note_features

from .synth import pluck


def test_string_model_gives_a_distribution_over_the_strings_that_reach_the_pitch(
    tmp_path: Path,
) -> None:
    rng = np.random.default_rng(0)
    path = tmp_path / "model.npz"
    np.savez(
        path,
        w0=rng.normal(size=(8, FEATURES)).astype(np.float32),
        b0=np.zeros(8, dtype=np.float32),
        w1=rng.normal(size=(6, 8)).astype(np.float32),
        b1=np.zeros(6, dtype=np.float32),
    )
    model = StringModel.load(path)
    mono = pluck(55, 1.0, RATE).astype(np.float32)
    probs = model.probs(mono, [(0.1, 40), (0.1, 55), (0.1, 76)])
    assert probs.shape == (3, 6)
    assert probs.sum(axis=1) == pytest.approx(np.ones(3), abs=1e-5)
    assert probs[0].tolist() == pytest.approx([0, 0, 0, 0, 0, 1])  # low E: only string 6
    assert probs[2, 5] == 0.0  # E5 is out of string 6's reach
    assert model.probs(mono, []).shape == (0, 6)


def test_note_features_are_zero_past_the_end_of_the_audio() -> None:
    mono = pluck(55, 0.5, RATE).astype(np.float32)
    assert np.count_nonzero(note_features(mono, 0.5 - 1000 / RATE, 55)[:-1]) == 0
