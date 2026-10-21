"""Chord vocabularies, beat sync, bass prior and Viterbi smoothing (no models)."""

from __future__ import annotations

import numpy as np
import pytest
from stage_chords import fusion
from stage_chords.recognizers import MadmomCNN


def test_vocabularies_and_mapping() -> None:
    assert len(fusion.labels("majmin")) == 25
    assert len(fusion.labels("sevenths")) == 61
    names = fusion.labels("sevenths")
    assert names[fusion.index_of("sevenths", 9, "min7")] == "A:min7"
    assert names[fusion.index_of("sevenths", 7, "hdim7")] == "G:min7"
    majmin = fusion.labels("majmin")
    assert majmin[fusion.index_of("majmin", 7, "7")] == "G:maj"
    assert majmin[fusion.index_of("majmin", 2, "dim")] == "D:min"
    t = fusion.templates("sevenths")
    assert sorted(np.where(t[fusion.index_of("sevenths", 0, "7")])[0].tolist()) == [0, 4, 7, 10]
    assert not t[0].any()
    assert fusion.roots("majmin")[fusion.index_of("majmin", 5, "maj")] == 5


def test_beat_sync_averages_frames_and_covers_the_edges() -> None:
    times = np.arange(0, 4, 0.1)
    probs = np.full((len(times), 25), 0.01)
    probs[times < 2, 1] = 0.9  # C:maj for the first two seconds
    probs[times >= 2, fusion.index_of("majmin", 9, "min")] = 0.9
    spans = fusion.intervals(np.array([0.5, 1.0, 1.5, 2.0, 2.5]), 4.0)
    assert spans[0].tolist() == [0.0, 0.5]
    assert spans[-1].tolist() == [2.5, 4.0]
    logp = fusion.beat_sync(fusion.FrameProbs(times, probs), spans)
    np.testing.assert_allclose(np.exp(logp).sum(axis=1), 1.0)
    best = [fusion.labels("majmin")[int(i)] for i in logp.argmax(axis=1).tolist()]
    assert best == ["C:maj"] * 4 + ["A:min"] * 2


def test_viterbi_change_penalty_suppresses_flicker() -> None:
    logp = np.log(np.array([[0.9, 0.1], [0.4, 0.6], [0.9, 0.1], [0.1, 0.9], [0.1, 0.9]]))
    assert fusion.viterbi(logp, 0.0).tolist() == [0, 1, 0, 1, 1]
    assert fusion.viterbi(logp, 2.0).tolist() == [0, 0, 0, 1, 1]
    # No change affordable: the label with the best total log-probability (-5.33 vs -5.73).
    assert fusion.viterbi(logp, 100.0).tolist() == [1, 1, 1, 1, 1]


def test_bass_prior_favours_the_played_root_and_ignores_silence() -> None:
    chroma = np.zeros((2, 12))
    chroma[0, 9] = 1.0  # A in the bass
    prior = fusion.bass_prior(chroma, "majmin", weight=1.0)
    a_min = fusion.index_of("majmin", 9, "min")
    c_maj = fusion.index_of("majmin", 0, "maj")
    assert prior[0, a_min] > 0 > prior[0, c_maj]
    assert prior[0, 0] == pytest.approx(0.0)
    np.testing.assert_allclose(prior[1], 0.0, atol=1e-12)  # silent span: neutral


def test_segments_merge_beats_and_report_top_k() -> None:
    spans = fusion.intervals(np.array([1.0, 2.0, 3.0]), 4.0)
    posterior = np.full((4, 25), 0.01)
    posterior[:2, 1] = 0.76
    posterior[2:, 2] = 0.76
    segs = fusion.segments(spans, posterior, np.array([1, 1, 2, 2]), "majmin", k=2)
    assert [(s.t0, s.t1, s.label) for s in segs] == [(0.0, 2.0, "C:maj"), (2.0, 4.0, "C:min")]
    assert segs[0].confidence == pytest.approx(0.76)
    assert segs[0].top_k[0] == ("C:maj", pytest.approx(0.76))
    assert len(segs[0].top_k) == 2


def test_crf_marginals_are_normalised_and_follow_the_evidence() -> None:
    class Crf:
        pi = np.log(np.array([0.5, 0.5]))
        tau = np.zeros(2)
        c = np.zeros(2)
        A = np.log(np.array([[0.9, 0.1], [0.1, 0.9]]))
        W = np.log(np.array([[0.9, 0.1], [0.1, 0.9]]))

    obs = np.array([[1, 0], [1, 0], [0, 1], [0, 1], [0, 1]], dtype=np.float64)
    m = MadmomCNN.marginals(Crf(), obs)
    np.testing.assert_allclose(m.sum(axis=1), 1.0)
    assert m[0, 0] > 0.5
    assert m[-1, 1] > 0.5
