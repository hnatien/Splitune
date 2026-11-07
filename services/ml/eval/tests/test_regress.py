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
