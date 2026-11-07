from __future__ import annotations

import json

import pytest
from splitune_eval import regress


@pytest.mark.models
def test_the_regression_suite_smoke_run_passes_against_its_baseline() -> None:
    """`splitune-eval regress --smoke`: one short clip through htdemucs_6s on the CPU, compared
    with the stored smoke baseline (skipped without the weights or the P1 windows)."""
    from splitune_ml_core import register
    from splitune_ml_core.errors import StageError
    from stage_separation import models

    suite = regress.load_suite()
    clip = regress.root_of(suite["p1"]["root"]) / suite["smoke"]["clips"][0]
    if not (clip / "mixture.wav").is_file():
        pytest.skip(f"P1 windows not present ({clip}; eval/p1_musdb.py windows)")
    try:
        register.verify(register.model("htdemucs-6s"), models.models_dir() / "audio-separator")
    except StageError:
        pytest.skip("htdemucs_6s weights not installed")
    assert "smoke" in json.loads(regress.BASELINE.read_text(encoding="utf-8"))
    assert regress.run(update_baseline=False, smoke=True, out=None) == 0


def test_a_part_without_its_data_is_left_out_of_the_comparison() -> None:
    suite = regress.load_suite()
    base = {
        "values": {"p1/m/bass/clean/usdr": 10.0, "moisesdb-head/guitar/clean/usdr": 9.0},
        "seconds": {"p1/m": 10.0, "moisesdb/m": 5.0},
    }
    now = regress.Measured({"p1/m/bass/clean/usdr": 9.9}, {"p1/m": 10.0}, ("moisesdb",))
    rows = regress.compare(suite, base, now)
    assert [r["key"] for r in rows] == ["p1/m/bass/clean/usdr", "time/p1/m"]
    assert not any(r["breach"] for r in rows)
    missing = regress.compare(suite, base, regress.Measured(now.values, now.seconds))
    assert {r["key"] for r in missing if r["breach"]} == {
        "moisesdb-head/guitar/clean/usdr",
        "time/moisesdb/m",
    }
