from __future__ import annotations

import numpy as np
import pytest
from splitune_eval.calibration import fit_isotonic, reliability
from splitune_ml_core import calibration, contracts


def test_isotonic_fit_is_monotone_and_pools_violators() -> None:
    knots = fit_isotonic([0.1, 0.2, 0.3, 0.4], [1, 0, 0, 1])
    assert knots == [(0.2, pytest.approx(1 / 3)), (0.4, 1.0)]
    ys = [y for _, y in fit_isotonic(np.random.default_rng(0).random(500).tolist(), [1, 0] * 250)]
    assert ys == sorted(ys)


def test_isotonic_fit_pools_equal_raw_values() -> None:
    assert fit_isotonic([1.0] * 4, [1, 0, 1, 1]) == [(1.0, 0.75)]
    assert fit_isotonic([0.2, 0.5, 0.5, 0.5, 0.9], [0, 1, 0, 0, 1]) == [
        (0.2, 0.0),
        (0.5, pytest.approx(1 / 3)),
        (0.9, 1.0),
    ]


def test_fitted_table_recovers_a_known_curve() -> None:
    rng = np.random.default_rng(1)
    raw = rng.random(20_000)
    correct = (rng.random(20_000) < raw**2).astype(int)  # P(correct | raw) = raw²
    table = contracts.CalibrationTable(
        model_id="m",
        version="1",
        method="isotonic",
        knots=fit_isotonic(raw.tolist(), correct.tolist()),
        bands=contracts.Bands(high=0.7, medium=0.4),
    )
    for x in (0.2, 0.5, 0.8):
        assert calibration.calibrate(x, table) == pytest.approx(x**2, abs=0.05)
    before = reliability(raw.tolist(), correct.tolist())
    after = reliability([calibration.calibrate(x, table) for x in raw], correct.tolist())
    assert after.ece < 0.02 < before.ece


def test_reliability_bins_and_table() -> None:
    rel = reliability([0.05, 0.95, 0.95], [0, 1, 0])
    assert rel.counts[0] == 1
    assert rel.counts[9] == 2
    assert rel.accuracy[9] == pytest.approx(0.5)
    assert rel.ece == pytest.approx((1 * 0.05 + 2 * 0.45) / 3)
    assert "| 0.9-1.0 | 2 |" in rel.table()
