"""Basic Pitch port: parity with the original basic-pitch 0.4.0 and unit behaviour."""

from __future__ import annotations

import numpy as np
import onnxruntime as ort  # pyright: ignore[reportMissingTypeStubs]
import pytest
from splitune_ml_core import register
from stage_notes import basic_pitch as bp
from stage_notes import transcribers
from stage_notes.lowband import low_band_energy

from .synth import phrase, pluck

# basic_pitch.inference.predict(onset 0.5, frame 0.3, min 127.7 ms, melodia on) of the original
# 0.4.0 package (ONNX model) on synth.phrase(22050): (start s, end s, pitch, amplitude).
REFERENCE = [
    (0.24381, 0.94041, 45, 0.79627),
    (0.29025, 0.52245, 73, 0.31915),
    (0.98685, 1.23066, 85, 0.34258),
    (0.99846, 1.90404, 57, 0.73275),
    (0.99846, 1.91565, 52, 0.8528),
    (1.98659, 2.24201, 88, 0.32224),
    (1.9982, 2.50904, 60, 0.77407),
    (2.48582, 2.71802, 92, 0.30845),
    (2.49743, 3.19403, 64, 0.63387),
    (3.07793, 3.94868, 40, 0.76415),
    (3.12437, 3.44945, 68, 0.32306),
]
REFERENCE_ONSET_SUM = 3138.189453125


@pytest.fixture(scope="module")
def session() -> ort.InferenceSession:
    try:
        (path,) = register.verify(
            register.model("basic-pitch"), transcribers.models_dir() / "basic-pitch"
        )
    except Exception:
        pytest.skip("nmp.onnx not installed (scripts/fetch_models.py basic-pitch)")
    return ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])


def test_port_matches_original_package(session: ort.InferenceSession) -> None:
    posteriors = bp.infer(session, phrase(22050))
    assert posteriors.onset.shape == (361, 88)
    assert float(np.sum(posteriors.onset)) == pytest.approx(REFERENCE_ONSET_SUM, rel=1e-5)
    raw = bp.notes_polyphonic(
        posteriors,
        onset_thresh=0.5,
        frame_thresh=0.3,
        min_note_len=bp.min_note_frames(127.7),
        min_freq=None,
        max_freq=None,
    )
    times = bp.frame_times(posteriors.contour.shape[0])
    events = sorted(
        (
            round(float(times[n.start]), 5),
            round(float(times[n.end]), 5),
            n.pitch_midi,
            round(n.amplitude, 5),
        )
        for n in raw
    )
    assert len(events) == len(REFERENCE)
    for got, want in zip(events, REFERENCE, strict=True):
        assert got[:3] == pytest.approx(want[:3], abs=1e-4)
        assert got[3] == pytest.approx(want[3], abs=1e-4)


def test_frequency_limits_and_confidence(session: ort.InferenceSession) -> None:
    posteriors = bp.infer(session, phrase(22050))
    raw = bp.notes_polyphonic(
        posteriors,
        onset_thresh=0.5,
        frame_thresh=0.3,
        min_note_len=bp.min_note_frames(127.7),
        min_freq=100.0,
        max_freq=400.0,
    )
    pitches = {n.pitch_midi for n in raw}
    assert pitches
    assert all(bp.hz_to_midi(100.0) - 0.5 <= p <= bp.hz_to_midi(400.0) + 0.5 for p in pitches)
    for n in raw:
        assert 0.0 <= bp.onset_posterior(posteriors, n) <= 1.0


def test_windows_cover_audio_and_unwrap_trims() -> None:
    audio = np.ones(3 * bp.AUDIO_SAMPLE_RATE, dtype=np.float32)
    w = bp.windows(audio)
    assert w.shape[1:] == (bp.AUDIO_N_SAMPLES, 1)
    assert (len(w) - 1) * bp.HOP_SIZE < len(audio) + bp.OVERLAP_LEN // 2
    frames = np.zeros((len(w), bp.ANNOT_N_FRAMES, 4), dtype=np.float32)
    assert bp.unwrap(frames, len(audio)).shape == (int(3 * bp.ANNOTATIONS_FPS), 4)


def test_low_band_energy_prefers_the_real_fundamental() -> None:
    rate = 44100
    e1 = pluck(28, 1.0, rate).astype(np.float32)  # E1, harmonic h at amplitude 1/h
    # Transcribed an octave too high (E2): fundamental power 1 vs 2nd harmonic 1/4 → 1/1.25.
    assert low_band_energy(e1, 0.0, 1.0, 40) == pytest.approx(0.8, abs=0.03)
    # Transcribed correctly: nothing an octave below E1 → close to 0.
    assert low_band_energy(e1, 0.0, 1.0, 28) < 0.2
    assert low_band_energy(e1, 0.0, 0.0005, 28) == 0.0
