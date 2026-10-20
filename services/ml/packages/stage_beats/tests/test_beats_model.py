from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from splitune_ml_core import contracts
from splitune_ml_core.errors import StageError
from splitune_ml_core.stage_api import StageJob
from stage_beats import model, stage

ANALYSIS = "0192f6c4-8b00-7a00-8000-0000000000aa"


def job(audio: Path, tmp: Path, params: dict[str, Any]) -> StageJob:
    return StageJob(
        stage="beats",
        analysis_id=ANALYSIS,
        user_id="u1",
        artefact_version=1,
        params=params,
        inputs={},
        workdir=str(tmp),
        cache_dir=str(tmp),
        audio_hash="c" * 64,
        duration_s=16.0,
        decoded_path=str(audio),
    )


@pytest.mark.models
@pytest.mark.parametrize("requested", ["small0", "final0"])
def test_click_track_tempo_and_bars(
    requested: str, click_track: Any, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    if requested == "final0" and not model.mps_available():
        monkeypatch.setenv("ML_TORCH_DEVICE", "cpu")
    audio = click_track(bpm=100, seconds=16, offset_s=0.6)
    description = stage.describe({"model": requested})
    assert description.model_refs[0].model_id == f"beat_this/{requested}"
    out = stage.run(job(audio, tmp_path, description.params))
    beats = contracts.Beats.model_validate_json(Path(out.files["beats"]).read_text())
    assert out.status == "done"
    assert abs(beats.bpm - 100) < 1.5
    assert beats.meter.numerator == 4
    assert not beats.tempo_octave_ambiguous
    # On the 0.6 s grid (the model may add a pickup beat one period before the first click).
    assert all(abs((b.t - 0.6) / 0.6 - round((b.t - 0.6) / 0.6)) * 0.6 < 0.05 for b in beats.beats)
    clicks = [b for b in beats.beats if b.t >= 0.55]
    assert len(clicks) >= 24
    assert abs(clicks[0].t - 0.6) < 0.05
    assert beats.models[0].weights_sha256 == model.weights_sha256(requested)
    assert all(b.bar_index >= -1 and 1 <= b.beat_in_bar <= 4 for b in beats.beats)


def test_cpu_fallback_uses_the_small_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(model, "mps_available", lambda: False)
    monkeypatch.setenv("ML_TORCH_DEVICE", "auto")
    assert model.choose("final0") == model.Choice("small0", "cpu", "beats_cpu_small")
    monkeypatch.setenv("ML_TORCH_DEVICE", "cpu")
    assert model.choose("final0") == model.Choice("final0", "cpu", None)


def test_rejects_unknown_params() -> None:
    with pytest.raises(StageError) as err:
        stage.effective_params({"model": "huge"})
    assert err.value.code == "invalid_params"
    assert stage.effective_params({"unknown": 1}) == stage.DEFAULTS
