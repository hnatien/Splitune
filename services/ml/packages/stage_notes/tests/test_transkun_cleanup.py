"""Transkun clean-up params and the silence gate (no weights needed)."""

from __future__ import annotations

import numpy as np
from stage_notes.transkun import TRANSKUN_DEFAULTS, TranskunNote, clean_up, gate_mask

RATE = 44100


def note(onset: float, duration: float, velocity: int, score: float = 1.0) -> TranskunNote:
    return TranskunNote(onset, onset + duration, 60, velocity, score, score, score)


def test_defaults_keep_every_note() -> None:
    notes = [note(0.1, 0.01, 1, 0.0), note(1.0, 0.5, 90)]
    assert clean_up(notes, np.zeros(RATE, np.float32), TRANSKUN_DEFAULTS) == notes


def test_velocity_duration_and_confidence_floors() -> None:
    notes = [note(0.0, 0.5, 10), note(1.0, 0.02, 80), note(2.0, 0.5, 80, 0.3), note(3.0, 0.5, 80)]
    params = {
        **TRANSKUN_DEFAULTS,
        "min_velocity": 15,
        "min_duration_s": 0.03,
        "confidence": "onset",
        "min_confidence": 0.5,
    }
    assert clean_up(notes, np.zeros(RATE, np.float32), params) == [notes[3]]


def test_gate_drops_onsets_in_regions_far_below_the_loud_level() -> None:
    audio = np.zeros(4 * RATE, np.float32)
    audio[: 3 * RATE] = 0.5 * np.sin(2 * np.pi * 220 * np.arange(3 * RATE) / RATE)
    audio[3 * RATE :] = 1e-4 * np.random.default_rng(0).standard_normal(RATE)  # bleed level
    mask = gate_mask(audio, 30.0)
    assert mask[: int(2.9 * RATE) // 2048].all()
    assert not mask[int(3.1 * RATE) // 2048 :].any()
    kept = clean_up(
        [note(1.0, 0.5, 80), note(3.5, 0.3, 80)], audio, {**TRANSKUN_DEFAULTS, "gate_db": 30.0}
    )
    assert [n.onset_s for n in kept] == [1.0]


def test_an_onset_just_before_an_attack_after_silence_is_kept() -> None:
    audio = np.zeros(2 * RATE, np.float32)
    attack = 4096 * 5  # a frame boundary
    t = np.arange(RATE // 2) / RATE
    audio[attack : attack + RATE // 2] = 0.5 * np.sin(2 * np.pi * 330 * t) * np.exp(-4 * t)
    early = note((attack - 300) / RATE, 0.3, 80)  # placed 7 ms before the attack
    assert clean_up([early], audio, {**TRANSKUN_DEFAULTS, "gate_db": 45.0}) == [early]
