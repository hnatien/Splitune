"""`tag` stage: windowing and aggregation, the missing-weights fallback, and the real ONNX model."""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

import numpy as np
import pytest
from splitune_ml_core import contracts
from splitune_ml_core.stage_api import StageJob
from stage_tagger import stage
from stage_tagger.labels import CLASSES

AUDIO_HASH = "ab" * 32


def job(tmp_path: Path, decoded: Path, duration_s: float) -> StageJob:
    return StageJob(
        stage="tag",
        analysis_id=str(uuid.uuid4()),
        user_id="pytest-tagger",
        artefact_version=1,
        params=stage.effective_params({}),
        inputs={},
        workdir=str(tmp_path),
        cache_dir=str(tmp_path / "cache"),
        audio_hash=AUDIO_HASH,
        duration_s=duration_s,
        decoded_path=str(decoded),
    )


def test_windows_pad_the_last_window_and_drop_a_short_tail() -> None:
    rate = stage.MODEL_RATE
    assert stage.windows(np.ones(25 * rate, dtype=np.float32), 10, 2).shape == (3, 10 * rate)
    # 21 s: the last second would be 90% padding, so it is dropped
    assert stage.windows(np.ones(21 * rate, dtype=np.float32), 10, 2).shape == (2, 10 * rate)
    assert stage.windows(np.ones(rate, dtype=np.float32), 10, 2).shape == (1, 10 * rate)


def test_summary_takes_the_best_class_and_the_most_confident_windows() -> None:
    clipwise = np.zeros((4, 527), dtype=np.float32)
    clipwise[:, 141] = [0.9, 0.1, 0.1, 0.1]  # electric guitar in one window of four
    clipwise[:, 143] = [0.2, 0.2, 0.2, 0.2]  # acoustic guitar weaker throughout
    clipwise[:, 153] = 0.05
    by = {i["instrument"]: i for i in stage.summarise(clipwise, 0.25)}
    assert set(by) == set(CLASSES)
    assert by["guitar"]["present_prob"] == pytest.approx(0.9)
    assert by["guitar"]["subtype"] == "electric_guitar"
    assert by["piano"]["present_prob"] == pytest.approx(0.05)
    assert "subtype" not in by["drums"]


def test_missing_weights_fall_back_to_an_empty_tag_list(
    tmp_path: Path, click_track: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ML_MODELS_DIR", str(tmp_path / "no-models"))
    stage._sessions.clear()  # pyright: ignore[reportPrivateUsage]
    decoded = click_track(seconds=4)
    out = stage.run(job(tmp_path, decoded, 4.0))
    assert (out.status, out.fallback_reason, out.model_refs) == (
        "fallback",
        "tagger_unavailable",
        [],
    )
    tags = contracts.Tags.model_validate(json.loads(Path(out.files["tags"]).read_text()))
    assert tags.instruments == []
    assert tags.models == []
    assert tags.fallback_reason == "tagger_unavailable"


@pytest.mark.models
def test_real_tagger_hears_drums_in_a_click_track(tmp_path: Path, click_track: Any) -> None:
    stage._sessions.clear()  # pyright: ignore[reportPrivateUsage]
    decoded = click_track(seconds=21)
    out = stage.run(job(tmp_path, decoded, 21.0))
    assert out.status == "done"
    tags = contracts.Tags.model_validate(json.loads(Path(out.files["tags"]).read_text()))
    assert tags.windows == 2
    assert [m.model_id for m in tags.models] == ["panns/cnn14"]
    probs = {t.instrument: t.present_prob for t in tags.instruments}
    assert probs["drums"] > max(probs["vocals"], probs["piano"])
