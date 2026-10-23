"""The provenance register parses, its aggregate hashes are consistent, and every model the
separation map or the tagger loads has a record (09: weights are refused without one)."""

from __future__ import annotations

from pathlib import Path

import yaml
from splitune_ml_core import register


def test_every_model_record_is_valid() -> None:
    records = sorted((register.REGISTER_DIR / "models").glob("*.yaml"))
    assert records
    for path in records:
        record = register.model(path.stem)
        assert record.weights.sha256 == register.aggregate_sha256(record.weights.files)


def test_dataset_records_say_how_they_may_be_used() -> None:
    for path in sorted((register.REGISTER_DIR / "datasets").glob("*.yaml")):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        assert record["kind"] == "dataset"
        assert record["id"] == path.stem
        assert record["licence"]
        assert set(record["use"]) <= {"eval_only", "training_ok"}


def test_models_in_use_have_records() -> None:
    from splitune_ml_core.paths import ML_ROOT

    config = yaml.safe_load((ML_ROOT / "config" / "separation.personal.yaml").read_text())
    for spec in config["models"].values():
        assert register.model(spec["record"]).kind == "model"
    assert register.model("panns-cnn14").used_in == ["tag"]


def test_every_model_in_use_has_a_weights_dir() -> None:
    from splitune_ml_core.paths import ML_ROOT

    config = yaml.safe_load((ML_ROOT / "config" / "separation.personal.yaml").read_text())
    for spec in config["models"].values():
        assert spec["record"] in register.WEIGHTS_DIRS
    assert "panns-cnn14" in register.WEIGHTS_DIRS


def test_missing_reports_absent_and_truncated_weights(tmp_path: Path) -> None:
    assert set(register.missing(tmp_path)) == set(register.WEIGHTS_DIRS)
    (entry,) = register.model("basic-pitch").weights.files
    path = tmp_path / "basic-pitch" / entry.name
    path.parent.mkdir()
    path.write_bytes(b"\0" * (entry.bytes - 1))
    assert "basic-pitch" in register.missing(tmp_path)
    path.write_bytes(b"\0" * entry.bytes)
    assert "basic-pitch" not in register.missing(tmp_path)
