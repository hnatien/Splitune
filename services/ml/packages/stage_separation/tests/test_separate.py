"""`separate` stage: the model map's fallback chain, what is kept, and real separation models."""

from __future__ import annotations

import hashlib
import json
import os
import uuid
from pathlib import Path
from typing import Any

import numpy as np
import pytest
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from splitune_ml_core import contracts, register
from splitune_ml_core.errors import StageError
from splitune_ml_core.stage_api import StageJob
from stage_separation import config, models, separate
from stage_separation.config import ModelSpec

AUDIO_HASH = "cd" * 32
RATE = 44100


def mixture(path: Path, seconds: float = 3.0) -> Path:
    t = np.arange(int(seconds * RATE)) / RATE
    audio = 0.2 * np.sin(2 * np.pi * 220 * t) + 0.1 * np.sin(2 * np.pi * 55 * t)
    sf.write(str(path), np.stack([audio, audio], axis=1).astype(np.float32), RATE, subtype="PCM_24")  # pyright: ignore[reportUnknownMemberType]
    return path


def make_job(tmp_path: Path, params: dict[str, Any], seconds: float = 3.0) -> StageJob:
    decoded = mixture(tmp_path / "decoded.flac", seconds)
    work = tmp_path / "work"
    work.mkdir(exist_ok=True)
    return StageJob(
        stage="separate",
        analysis_id=str(uuid.uuid4()),
        user_id="pytest-separate",
        artefact_version=1,
        params=params,
        inputs={},
        workdir=str(work),
        cache_dir=str(tmp_path / "cache"),
        audio_hash=AUDIO_HASH,
        duration_s=seconds,
        decoded_path=str(decoded),
    )


def tags(probs: dict[str, float], fallback: str | None = None) -> contracts.Tags:
    document: dict[str, Any] = {
        "schema_version": contracts.SCHEMA_VERSION,
        "artefact": "tags",
        "artefact_version": 1,
        "analysis_id": str(uuid.uuid4()),
        "user_id": "pytest-separate",
        "audio_hash": AUDIO_HASH,
        "sample_rate": 44100,
        "duration_s": 3.0,
        "models": [],
        "params": {},
        "created_at": "2026-10-21T00:00:00Z",
        "window_s": 10,
        "windows": 1,
        "instruments": [{"instrument": k, "present_prob": v} for k, v in probs.items()],
    }
    if fallback:
        document["fallback_reason"] = fallback
    return contracts.Tags.model_validate(document)


def test_plan_keeps_extras_unless_the_tagger_is_sure_they_are_absent() -> None:
    cfg = config.load()
    params = separate.plan(cfg, {"instrument": "guitar"}, tags({"drums": 0.005, "bass": 0.02}))
    assert params["chain"] == cfg.instruments["guitar"].chain
    assert params["keep"] == ["bass"]  # drums below keep_min_prob
    assert separate.plan(cfg, {"instrument": "guitar"}, None)["keep"] == ["drums", "bass"]
    unusable = tags({"drums": 0.0}, fallback="tagger_unavailable")
    assert separate.plan(cfg, {"instrument": "guitar"}, unusable)["keep"] == ["drums", "bass"]
    with pytest.raises(StageError) as err:
        separate.plan(cfg, {"instrument": "kazoo"}, None)
    assert err.value.code == "invalid_params"


def test_roles_follow_the_mix_minus_mode() -> None:
    six = config.load().models["bs_roformer_sw"]
    subtract = separate.roles(
        six, {"instrument": "guitar", "keep": ["drums"], "mix_minus": "subtract"}
    )
    assert subtract == {"guitar": "target", "drums": "extra"}
    complement = separate.roles(
        six, {"instrument": "guitar", "keep": ["drums"], "mix_minus": "complement"}
    )
    assert complement == {
        "bass": "complement",
        "drums": "extra",
        "guitar": "target",
        "other": "complement",
        "piano": "complement",
        "vocals": "complement",
    }
    two = config.load().models["mel_roformer_kim_vocals"]
    vocals = separate.roles(two, {"instrument": "vocals", "keep": [], "mix_minus": "complement"})
    assert vocals == {"vocals": "target", "other": "complement"}


class FakeModels:
    """Stands in for audio-separator: fails the models in `broken`, else writes each output as
    a scaled copy of the input."""

    def __init__(self, broken: dict[str, str]) -> None:
        self.broken = broken
        self.calls: list[str] = []

    def separate(self, name: str, spec: ModelSpec, audio: Path, output_dir: Path) -> models.Result:
        self.calls.append(name)
        if name in self.broken:
            raise StageError(self.broken[name])
        output_dir.mkdir(parents=True, exist_ok=True)
        data, _ = sf.read(str(audio), dtype="float32", always_2d=True)
        files: dict[str, Path] = {}
        for stem in spec.outputs:
            path = output_dir / f"{stem}.wav"
            sf.write(str(path), data / len(spec.outputs), RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
            files[stem] = path
        return models.Result(files=files, seconds=0.5, peak_mb=0.0)


def run_with(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, broken: dict[str, str]
) -> tuple[FakeModels, StageJob]:
    fake = FakeModels(broken)
    monkeypatch.setattr(models, "separate", fake.separate)
    params = separate.plan(config.load(), {"instrument": "guitar"}, None)
    return fake, make_job(tmp_path, params)


def test_first_model_failing_falls_back_to_the_next(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake, job = run_with(tmp_path, monkeypatch, {"bs_roformer_sw": "separation_oom"})
    out = separate.run(job)
    assert fake.calls == ["bs_roformer_sw", "htdemucs_6s"]
    assert (out.status, out.fallback_reason) == ("fallback", "separation_fallback_model")
    doc = contracts.Separation.model_validate(json.loads(Path(out.files["separation"]).read_text()))
    assert doc.provider == "htdemucs_6s"
    assert [m.model_id for m in doc.models] == ["htdemucs_6s"]
    assert [(a.model, a.error_code) for a in doc.failed_attempts] == [
        ("bs_roformer_sw", "separation_oom")
    ]
    assert {(s.name, s.role) for s in doc.stems} == {
        ("guitar", "target"),
        ("drums", "extra"),
        ("bass", "extra"),
    }
    for stem in doc.stems:
        path = Path(job.cache_dir) / "separated" / stem.file
        assert hashlib.sha256(path.read_bytes()).hexdigest() == stem.sha256
        assert sf.info(str(path)).frames == stem.frames == 3 * RATE  # pyright: ignore[reportUnknownMemberType]


def test_every_model_failing_means_stems_unavailable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    broken = {"bs_roformer_sw": "weights_missing", "htdemucs_6s": "separation_failed"}
    fake, job = run_with(tmp_path, monkeypatch, broken)
    with pytest.raises(StageError) as err:
        separate.run(job)
    assert (err.value.code, err.value.retry) == ("stems_unavailable", False)
    assert fake.calls == ["bs_roformer_sw", "htdemucs_6s"]


def test_a_skipped_silent_output_becomes_zeros_and_a_short_one_is_padded(tmp_path: Path) -> None:
    short = tmp_path / "short.wav"
    sf.write(str(short), np.ones((RATE - 10, 2), dtype=np.float32) * 0.1, RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    padded = separate.load_stem(short, RATE)
    assert padded.shape == (RATE, 2)
    assert float(np.abs(padded[-10:]).max()) == 0.0
    assert float(np.abs(separate.load_stem(None, RATE)).max()) == 0.0
    with pytest.raises(StageError):
        separate.load_stem(short, 2 * RATE)  # 50% short: a broken run


def test_tampered_weights_are_refused(tmp_path: Path) -> None:
    record = register.model("htdemucs-6s")
    for entry in record.weights.files:
        (tmp_path / entry.name).write_bytes(b"not the weights")
    with pytest.raises(StageError) as err:
        register.verify(record, tmp_path)
    assert err.value.code == "weights_mismatch"
    with pytest.raises(StageError) as err:
        register.verify(record, tmp_path / "empty")
    assert err.value.code == "weights_missing"


def models_dir_with(tmp_path: Path, record_ids: list[str]) -> Path:
    """A models dir that holds only these register entries (symlinks to the real weights), plus
    the library's model list, which it would otherwise download on every load."""
    source = models.models_dir() / "audio-separator"
    target = tmp_path / "models" / "audio-separator"
    target.mkdir(parents=True)
    os.symlink(source / "download_checks.json", target / "download_checks.json")
    for record_id in record_ids:
        for entry in register.model(record_id).weights.files:
            os.symlink(source / entry.name, target / entry.name)
    return target.parent


@pytest.mark.models
def test_real_chain_skips_missing_weights_and_runs_htdemucs_6s(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ML_MODELS_DIR", str(models_dir_with(tmp_path, ["htdemucs-6s"])))
    models.release()
    params = separate.plan(config.load(), {"instrument": "guitar"}, None)
    out = separate.run(make_job(tmp_path, params, seconds=6.0))
    doc = contracts.Separation.model_validate(json.loads(Path(out.files["separation"]).read_text()))
    assert (out.status, doc.provider) == ("fallback", "htdemucs_6s")
    assert [(a.model, a.error_code) for a in doc.failed_attempts] == [
        ("bs_roformer_sw", "weights_missing")
    ]
    assert doc.device == models.device()
    assert {s.name for s in doc.stems} == {"guitar", "drums", "bass"}
    assert all(s.frames == 6 * RATE for s in doc.stems)
    models.release()


@pytest.mark.models
def test_a_warm_model_writes_each_run_into_its_own_directory(tmp_path: Path) -> None:
    """Regression: the loaded model kept the first run's output directory, so a second job in a
    warm island wrote its stems into the previous (deleted) workdir."""
    models.release()
    spec = config.load().models["htdemucs_6s"]
    audio = mixture(tmp_path / "mix.wav", seconds=4.0)
    first = models.separate("htdemucs_6s", spec, audio, tmp_path / "first")
    second = models.separate("htdemucs_6s", spec, audio, tmp_path / "second")
    assert {p.parent.name for p in first.files.values()} == {"first"}
    assert {p.parent.name for p in second.files.values()} == {"second"}
    assert set(second.files) == set(first.files)
    models.release()
