"""`separate` stage: the model map's fallback chain, what is kept, and real separation models."""

from __future__ import annotations

import hashlib
import json
import os
import uuid
from collections.abc import Generator
from pathlib import Path
from types import SimpleNamespace
from typing import Any, ClassVar

import numpy as np
import pytest
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
import yaml
from numpy.typing import NDArray
from pydantic import ValidationError
from splitune_ml_core import contracts, register
from splitune_ml_core.errors import StageError
from splitune_ml_core.keys import cache_key, canonical_json
from splitune_ml_core.stage_api import StageJob
from stage_separation import config, dsp, models, separate
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


def with_inference(name: str, inference: dict[str, Any]) -> ModelSpec:
    spec = config.load().models[name]
    return ModelSpec.model_validate({**spec.model_dump(), "inference": inference})


def test_inference_settings_reject_unknown_and_foreign_keys() -> None:
    assert with_inference("bs_roformer_sw", {"overlap": 4}).inference == {"overlap": 4}
    assert with_inference("htdemucs_ft", {"shifts": 1}).inference == {"shifts": 1}
    wrapper = {"chunk": 588800, "shifts": 3, "autocast": True, "gain": {"target_lufs": -14}}
    assert with_inference("bs_roformer_sw", wrapper).inference == wrapper
    bad_settings: tuple[tuple[str, dict[str, Any]], ...] = (
        ("bs_roformer_sw", {"overlapp": 4}),
        ("bs_roformer_sw", {"segment_size": 10}),  # library keys only through map keys
        ("bs_roformer_sw", {"shifts": 0}),
        ("bs_roformer_sw", {"overlap": 0}),
        ("bs_roformer_sw", {"gain": {}}),
        ("bs_roformer_sw", {"gain": {"db": -6, "target_lufs": -14}}),
        ("bs_roformer_sw", {"gain": {"db": -6, "min_input_lufs": -10}}),
        ("bs_roformer_sw", {"sample_rate": 22050}),
        ("htdemucs_ft", {"overlap": 1.5}),  # Demucs overlap is a fraction
        ("htdemucs_ft", {"segment_size": 10}),
        ("htdemucs_ft", {"chunk": 4096}),  # an MDXC key on a Demucs model
    )
    for name, bad in bad_settings:
        with pytest.raises(ValidationError):
            with_inference(name, bad)


def test_the_shipped_map_uses_wrapper_settings_only_where_step_29_measured_them() -> None:
    """Step 29 ships the chunk of piano's fallback model and SW's 13.35 s chunk; the other models'
    plans, cache keys and library parameters are what they were, and wrapper settings never
    reach the library."""
    cfg = config.load()
    wrapped = {
        name: keys
        for name, spec in cfg.models.items()
        if (keys := set(spec.inference) & models.WRAPPER_KEYS[spec.arch])
    }
    assert wrapped == {"mega53_keys": {"chunk"}, "bs_roformer_sw": {"chunk"}}
    for name, spec in cfg.models.items():
        library = {k: v for k, v in spec.inference.items() if k not in wrapped.get(name, set())}
        assert models.library_params(spec) == {**models.LIBRARY_PARAMS[spec.arch], **library}
    assert cfg.models["bs_roformer_sw"].inference == {"chunk": 588800, "overlap": 11.5}
    assert cfg.models["mel_roformer_kim_vocals"].inference == {"overlap": 11}
    plan = separate.plan(cfg, {"instrument": "vocals"}, None)
    assert plan["inference"]["mel_roformer_kim_vocals"] == {"overlap": 11}


def describe_key(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, inference: dict[str, Any]
) -> tuple[str, dict[str, Any]]:
    document = yaml.safe_load(config.DEFAULT_PATH.read_text(encoding="utf-8"))
    document["models"]["htdemucs_ft"]["inference"] = inference
    path = tmp_path / f"separation-{len(list(tmp_path.iterdir()))}.yaml"
    path.write_text(yaml.safe_dump(document), encoding="utf-8")
    monkeypatch.setenv("ML_SEPARATION_CONFIG", str(path))
    config.load.cache_clear()
    try:
        described = separate.describe({"instrument": "bass"})
    finally:
        config.load.cache_clear()
    key = cache_key(
        scope="global",
        audio_id=AUDIO_HASH,
        stage="separate",
        model_refs=described.model_refs,
        params=described.params,
    )
    return key, described.params


def test_inference_settings_are_part_of_the_cache_key(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """htdemucs_ft is bass's fallback: its settings change the key although it is not first."""
    one, params = describe_key(tmp_path, monkeypatch, {"shifts": 1})
    two, _ = describe_key(tmp_path, monkeypatch, {"shifts": 2})
    same, _ = describe_key(tmp_path, monkeypatch, {"shifts": 1})
    gained, gained_params = describe_key(tmp_path, monkeypatch, {"shifts": 1, "gain": {"db": -6}})
    assert params["inference"]["htdemucs_ft"] == {"shifts": 1}
    assert gained_params["inference"]["htdemucs_ft"] == {"shifts": 1, "gain": {"db": -6}}
    assert one != two
    assert one == same
    assert gained != one
    job = make_job(tmp_path, params)
    ref = models.model_ref(config.load().models["htdemucs_ft"])
    kept: dict[str, separate.Role] = {"bass": "target"}
    assert separate.run_id(
        job, "htdemucs_ft", with_inference("htdemucs_ft", {"shifts": 1}), ref, kept
    ) != separate.run_id(job, "htdemucs_ft", with_inference("htdemucs_ft", {}), ref, kept)


class FakeSeparator:
    """Records how audio-separator would be constructed."""

    built: ClassVar[list[dict[str, Any]]] = []

    def __init__(self, **kwargs: Any) -> None:
        FakeSeparator.built.append(kwargs)
        self.model_instance = self

    def load_model(self, model_filename: str) -> None:
        self.model_filename = model_filename


@pytest.fixture
def fake_separator(monkeypatch: pytest.MonkeyPatch) -> Generator[list[dict[str, Any]]]:
    FakeSeparator.built = []
    monkeypatch.setattr(models, "Separator", FakeSeparator)
    monkeypatch.setattr(register, "verify", lambda *_: None)  # pyright: ignore[reportUnknownLambdaType, reportUnknownArgumentType]
    models.release()
    yield FakeSeparator.built
    models.release()


def test_inference_settings_reach_the_separator_over_library_defaults(
    tmp_path: Path, fake_separator: list[dict[str, Any]]
) -> None:
    models._separator("bs_roformer_sw", with_inference("bs_roformer_sw", {"overlap": 4}), tmp_path)  # pyright: ignore[reportPrivateUsage]
    models._separator("htdemucs_ft", with_inference("htdemucs_ft", {"shifts": 1}), tmp_path)  # pyright: ignore[reportPrivateUsage]
    mdxc, demucs = fake_separator
    assert mdxc["mdxc_params"] == {**models.LIBRARY_PARAMS["mdxc"], "overlap": 4}
    assert mdxc["mdxc_params"]["segment_size"] == 256  # other library defaults kept
    assert mdxc["demucs_params"] == models.LIBRARY_PARAMS["demucs"]
    assert demucs["demucs_params"] == {**models.LIBRARY_PARAMS["demucs"], "shifts": 1}
    assert demucs["demucs_params"]["overlap"] == 0.25


def test_the_warm_model_reloads_when_its_settings_change(
    tmp_path: Path, fake_separator: list[dict[str, Any]]
) -> None:
    four = with_inference("bs_roformer_sw", {"overlap": 4})
    first = models._separator("bs_roformer_sw", four, tmp_path / "a")  # pyright: ignore[reportPrivateUsage]
    assert models._separator("bs_roformer_sw", four, tmp_path / "b") is first  # pyright: ignore[reportPrivateUsage]
    eight = with_inference("bs_roformer_sw", {"overlap": 8})
    assert models._separator("bs_roformer_sw", eight, tmp_path / "c") is not first  # pyright: ignore[reportPrivateUsage]
    assert [b["mdxc_params"]["overlap"] for b in fake_separator] == [4, 8]


class FunctionSeparator:
    """audio-separator stand-in for the wrapper passes: output `a` is tanh of the input (level
    matters), `b` the input weighted by the sample's position in the file (time shifts matter).
    Like the library, it switches its MDXC instance to the 256 segment for input under 10 s."""

    built: ClassVar[list[dict[str, Any]]] = []
    instances: ClassVar[list[FunctionSeparator]] = []

    def __init__(self, **kwargs: Any) -> None:
        FunctionSeparator.built.append(kwargs)
        FunctionSeparator.instances.append(self)
        self.rate = int(kwargs["sample_rate"])
        cfg = SimpleNamespace(model=SimpleNamespace(stft_hop_length=512), audio=SimpleNamespace())
        self.model_instance = SimpleNamespace(
            model_data_cfgdict=cfg,
            is_roformer=True,
            override_model_segment_size=kwargs["mdxc_params"]["override_model_segment_size"],
            segment_size=kwargs["mdxc_params"]["segment_size"],
            output_dir="",
        )
        self.segments: list[tuple[bool, int]] = []
        self.lengths: list[int] = []

    def load_model(self, model_filename: str) -> None:
        self.model_filename = model_filename

    def _separate_file(self, audio: str, names: dict[str, str]) -> list[str]:
        instance = self.model_instance
        data, rate = sf.read(audio, dtype="float64", always_2d=True)
        assert rate == self.rate
        self.lengths.append(len(data))
        if len(data) < 10 * rate:
            instance.override_model_segment_size = True
        self.segments.append((instance.override_model_segment_size, instance.segment_size))
        weight = (np.arange(len(data)) % 1000 / 1000.0)[:, None]
        out = Path(instance.output_dir)
        out.mkdir(parents=True, exist_ok=True)
        for name, audio_out in (("a", np.tanh(data)), ("b", data * weight)):
            sf.write(
                str(out / f"{names[name]}.wav"), audio_out.astype(np.float32), rate, subtype="FLOAT"
            )  # pyright: ignore[reportUnknownMemberType]
        return [f"{names[n]}.wav" for n in ("a", "b")]


def two_outputs(inference: dict[str, Any]) -> ModelSpec:
    return ModelSpec.model_validate(
        {
            "record": "bs-roformer-sw",
            "filename": "fake.ckpt",
            "provider": "bs_roformer:fake",
            "arch": "mdxc",
            "outputs": {"a": "guitar", "b": None},
            "inference": inference,
        }
    )


@pytest.fixture
def function_separator(monkeypatch: pytest.MonkeyPatch) -> Generator[list[dict[str, Any]]]:
    FunctionSeparator.built = []
    FunctionSeparator.instances = []
    monkeypatch.setattr(models, "Separator", FunctionSeparator)
    monkeypatch.setattr(register, "verify", lambda *_: None)  # pyright: ignore[reportUnknownLambdaType, reportUnknownArgumentType]
    models.release()
    yield FunctionSeparator.built
    models.release()


def loud_input(path: Path, seconds: float = 3.0) -> NDArray[np.float64]:
    t = np.arange(int(seconds * RATE)) / RATE
    audio = 0.9 * np.sin(2 * np.pi * 110 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.7 * t))
    stereo = np.stack([audio, 0.8 * audio], axis=1)
    sf.write(str(path), stereo.astype(np.float32), RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    data, _ = sf.read(str(path), dtype="float64", always_2d=True)
    return np.asarray(data, dtype=np.float64)


def outputs_of(result: models.Result) -> dict[str, NDArray[np.float64]]:
    out: dict[str, NDArray[np.float64]] = {}
    for stem, path in result.files.items():
        data, rate = sf.read(str(path), dtype="float64", always_2d=True)
        assert rate == RATE
        out[stem] = np.asarray(data, dtype=np.float64)
    return out


def test_gain_scales_the_model_input_and_undoes_it_on_every_output(
    tmp_path: Path, function_separator: list[dict[str, Any]]
) -> None:
    x = loud_input(tmp_path / "in.wav")
    plain = outputs_of(models.separate("f", two_outputs({}), tmp_path / "in.wav", tmp_path / "p"))
    gained = models.separate(
        "f", two_outputs({"gain": {"db": -6}}), tmp_path / "in.wav", tmp_path / "g"
    )
    scale = 10 ** (-6 / 20)
    out = outputs_of(gained)
    assert gained.gain_db == -6
    np.testing.assert_allclose(out["a"], np.tanh(x * scale) / scale, atol=1e-6)
    np.testing.assert_allclose(out["b"], plain["b"], atol=1e-6)  # linear in level: unchanged
    assert np.max(np.abs(out["a"] - plain["a"])) > 0.05  # tanh is not: the level mattered


def test_a_loudness_target_applies_only_above_the_input_floor(
    tmp_path: Path, function_separator: list[dict[str, Any]]
) -> None:
    x = loud_input(tmp_path / "in.wav")
    lufs = dsp.loudness_lufs(x.astype(np.float32))
    assert lufs is not None
    target = models.separate(
        "f", two_outputs({"gain": {"target_lufs": -20}}), tmp_path / "in.wav", tmp_path / "t"
    )
    assert target.gain_db == pytest.approx(-20 - lufs)
    floor = {"gain": {"target_lufs": -20, "min_input_lufs": lufs + 1}}
    skipped = models.separate("f", two_outputs(floor), tmp_path / "in.wav", tmp_path / "s")
    plain = models.separate("f", two_outputs({}), tmp_path / "in.wav", tmp_path / "p")
    assert skipped.gain_db == 0.0
    np.testing.assert_array_equal(outputs_of(skipped)["a"], outputs_of(plain)["a"])


def test_shifts_roll_the_input_roll_the_outputs_back_and_average_them(
    tmp_path: Path, function_separator: list[dict[str, Any]]
) -> None:
    x = loud_input(tmp_path / "in.wav")
    n = len(x)
    out = outputs_of(
        models.separate("f", two_outputs({"shifts": 3}), tmp_path / "in.wav", tmp_path / "s")
    )
    # Output a is pointwise: rolling and rolling back changes nothing.
    np.testing.assert_allclose(out["a"], np.tanh(x), atol=1e-6)
    # Output b weights by position: pass k sees x rolled by k * (n // 3), so sample i was at
    # position (i + k * (n // 3)) % n.
    positions = (np.arange(n)[None, :] + (np.arange(3) * (n // 3))[:, None]) % n
    weight = (positions % 1000 / 1000.0).mean(axis=0)[:, None]
    np.testing.assert_allclose(out["b"], x * weight, atol=1e-6)
    again = outputs_of(
        models.separate("f", two_outputs({"shifts": 3}), tmp_path / "in.wav", tmp_path / "r")
    )
    np.testing.assert_array_equal(again["b"], out["b"])
    assert not (tmp_path / "s" / ".passes").exists()


def test_a_48_khz_model_gets_48_khz_input_and_returns_44_1_khz(
    tmp_path: Path, function_separator: list[dict[str, Any]]
) -> None:
    x = loud_input(tmp_path / "in.wav")
    result = models.separate(
        "f", two_outputs({"sample_rate": 48000}), tmp_path / "in.wav", tmp_path / "r"
    )
    assert function_separator[0]["sample_rate"] == 48000
    out = outputs_of(result)
    assert out["a"].shape == x.shape
    error = out["a"][1000:-1000] - np.tanh(x)[1000:-1000]
    assert 10 * np.log10(np.sum(np.tanh(x) ** 2) / np.sum(error**2)) > 60


def test_the_chunk_sets_the_segment_and_a_short_input_does_not_stick(
    tmp_path: Path, function_separator: list[dict[str, Any]]
) -> None:
    short = tmp_path / "short.wav"
    long = tmp_path / "long.wav"
    loud_input(short, seconds=2.0)
    loud_input(long, seconds=11.0)
    spec = two_outputs({"chunk": 588800})
    for audio in (short, long, short, long):
        models.separate("f", spec, audio, tmp_path / audio.stem)
    default = two_outputs({})
    for audio in (short, long):
        models.separate("f", default, audio, tmp_path / f"d-{audio.stem}")
    chunked, plain = (s.segments for s in FunctionSeparator.instances)
    assert chunked == [(True, 1151)] * 4
    # The library's own switch for short input applies to that run only.
    assert plain == [(True, 256), (False, 256)]
    with pytest.raises(StageError) as err:
        models.separate("f", two_outputs({"chunk": 588801}), long, tmp_path / "bad")
    assert err.value.code == "separation_config_invalid"


def test_input_shorter_than_the_chunk_is_padded_for_the_model_and_trimmed_back(
    tmp_path: Path, function_separator: list[dict[str, Any]]
) -> None:
    """audio-separator 0.44.5 fails on input shorter than its chunk."""
    x = loud_input(tmp_path / "in.wav", seconds=3.0)
    out = outputs_of(
        models.separate("f", two_outputs({"chunk": 588800}), tmp_path / "in.wav", tmp_path / "c")
    )
    assert FunctionSeparator.instances[0].lengths == [588800]
    np.testing.assert_allclose(out["a"], np.tanh(x), atol=1e-6)
    long = tmp_path / "long.wav"
    loud_input(long, seconds=14.0)
    models.separate("f", two_outputs({"chunk": 588800}), long, tmp_path / "l")
    assert FunctionSeparator.instances[0].lengths[-1] == 14 * RATE  # long enough: untouched


class FakeModels:
    """Stands in for audio-separator: fails the models in `broken`, else writes each output as
    a scaled copy of the input."""

    def __init__(self, broken: dict[str, str], silent: tuple[str, ...] = ()) -> None:
        self.broken = broken
        self.silent = silent  # outputs written as silence (a solo instrument has no drums)
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
            level = 0.0 if stem in self.silent else 1 / len(spec.outputs)
            sf.write(str(path), data * level, RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
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
    """A models dir that holds only these register entries (links to the real weights), plus
    the library's model list, which it would otherwise download on every load."""
    source = models.models_dir() / "audio-separator"
    target = tmp_path / "models" / "audio-separator"
    target.mkdir(parents=True)
    for name in ["download_checks.json"] + [
        entry.name for record_id in record_ids for entry in register.model(record_id).weights.files
    ]:
        try:
            os.symlink(source / name, target / name)
        except OSError:
            # Windows creates symlinks only in Developer Mode; a hard link needs no privilege.
            os.link(source / name, target / name)
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


def test_solo_bypass_measures_the_rhythm_outputs_against_the_mixture(tmp_path: Path) -> None:
    from stage_separation.separate import solo_bypass

    frames = 44100
    rng = np.random.default_rng(0)
    mixture = rng.standard_normal((frames, 2)).astype(np.float32)
    quiet = (1e-3 * mixture).astype(np.float32)  # -60 dB
    files: dict[str, Path] = {}
    for name, audio in (("drums", quiet), ("bass", quiet), ("piano", mixture)):
        files[name] = tmp_path / f"{name}.wav"
        sf.write(str(files[name]), audio, 44100, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    spec = config.load().models["bs_roformer_sw"]
    energy = float(np.sum(np.square(mixture, dtype=np.float64)))
    solo = solo_bypass(spec, files, "piano", frames, energy, -20.0)
    assert solo["applied"]
    assert solo["rhythm_db"] < -50
    files["drums"] = files["piano"]  # a loud drum output: a band
    band = solo_bypass(spec, files, "piano", frames, energy, -20.0)
    assert not band["applied"]
    assert band["rhythm_db"] > -1


@pytest.mark.parametrize(
    ("silent", "calls", "provider", "applied"),
    [
        (("drums", "bass", "vocals"), ["htdemucs_6s"], "htdemucs_6s", True),
        ((), ["htdemucs_6s", "bs_roformer_sw"], "bs_roformer:BS-Roformer-SW", False),
    ],
)
def test_the_solo_check_runs_first_and_skips_the_chain_for_a_solo_piano(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    silent: tuple[str, ...],
    calls: list[str],
    provider: str,
    applied: bool,
) -> None:
    fake = FakeModels({}, silent)
    monkeypatch.setattr(models, "separate", fake.separate)
    params = separate.plan(config.load(), {"instrument": "piano"}, None)
    assert params["solo_check"]["model"] == "htdemucs_6s"
    out = separate.run(make_job(tmp_path, params))
    assert fake.calls == calls
    doc = contracts.Separation.model_validate(json.loads(Path(out.files["separation"]).read_text()))
    assert doc.provider == provider
    assert doc.solo_bypass is not None
    assert doc.solo_bypass.applied is applied
    assert out.metrics["gpu_s" if doc.device != "cpu" else "cpu_s"] == 0.5 * len(calls)


def test_the_fallback_model_must_have_the_instrument() -> None:
    raw = yaml.safe_load(config.DEFAULT_PATH.read_text(encoding="utf-8"))
    raw["instruments"]["piano"]["fallback_when_silent"]["model"] = "bs_roformer_viperx_1297"
    with pytest.raises(ValidationError, match="fallback model"):
        config.SeparationConfig.model_validate(raw)


def test_only_the_instrument_with_a_fallback_plans_one_and_the_tagger_decides() -> None:
    cfg = config.load()
    for instrument in ("guitar", "bass", "drums", "vocals"):  # their cache keys are unchanged
        assert "fallback_when_silent" not in separate.plan(cfg, {"instrument": instrument}, None)
    rule = cfg.instruments["piano"].fallback_when_silent
    assert rule is not None
    for probs, fallback, tagged in [
        ({"piano": 0.65}, None, True),
        ({"piano": rule.min_present_prob}, None, True),
        ({"piano": 0.01}, None, False),
        ({"guitar": 0.9}, None, False),
        ({"piano": 0.65}, "tagger_failed", False),  # never without usable tags
    ]:
        planned = separate.plan(cfg, {"instrument": "piano"}, tags(probs, fallback))
        assert planned["fallback_when_silent"]["tagged"] is tagged
        assert planned["fallback_when_silent"]["inference"] == cfg.models[rule.model].inference
    assert (
        separate.plan(cfg, {"instrument": "piano"}, None)["fallback_when_silent"]["tagged"] is False
    )


def with_tags(job: StageJob, tmp_path: Path, document: contracts.Tags) -> StageJob:
    path = tmp_path / "tags.json"
    path.write_text(contracts.dump_json(document), encoding="utf-8")
    job.inputs["tags"] = str(path)
    return job


@pytest.mark.parametrize(
    ("silent", "prob", "applied"),
    [
        (("piano",), 0.65, True),  # SW hears no piano, the tagger hears keys
        (("piano",), 0.01, False),  # no keys: SW's silence stays
        ((), 0.65, False),  # SW has the piano
    ],
)
def test_a_silent_target_the_tagger_hears_is_replaced_by_the_fallback_outputs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    silent: tuple[str, ...],
    prob: float,
    applied: bool,
) -> None:
    fake = FakeModels({}, silent)
    monkeypatch.setattr(models, "separate", fake.separate)
    cfg = config.load()
    rule = cfg.instruments["piano"].fallback_when_silent
    assert rule is not None
    document = tags({"piano": prob})
    params = separate.plan(cfg, {"instrument": "piano"}, document)
    job = with_tags(make_job(tmp_path, params), tmp_path, document)
    out = separate.run(job)
    chain = ["htdemucs_6s", "bs_roformer_sw"]  # the solo check, then the chain's head
    assert fake.calls == [*chain, rule.model] if applied else chain
    doc = contracts.Separation.model_validate(json.loads(Path(out.files["separation"]).read_text()))
    check = doc.fallback_when_silent
    assert check is not None
    assert check.applied is applied
    assert check.present_prob == prob
    assert (check.target_db < rule.threshold_db) is bool(silent)
    target = next(s for s in doc.stems if s.role == "target")
    audio, _ = sf.read(str(Path(job.cache_dir) / "separated" / target.file), always_2d=True)
    mix, _ = sf.read(job.decoded_path or "", always_2d=True)
    fallback = cfg.models[rule.model]
    if applied:
        assert check.provider == fallback.provider
        assert [m.model_id for m in doc.models] == [
            models.model_ref(cfg.models["bs_roformer_sw"]).model_id,
            models.model_ref(fallback).model_id,
        ]
        # FakeModels writes each output as mixture / len(outputs); keys + synth are summed.
        mapped = sum(1 for i in fallback.outputs.values() if i == "piano")
        assert mapped == 2
        np.testing.assert_allclose(audio, mix * mapped / len(fallback.outputs), atol=1e-6)
    else:
        assert check.provider is None
        assert len(doc.models) == 1
    assert doc.provider == cfg.models["bs_roformer_sw"].provider  # the extras are still SW's


def test_a_failing_fallback_keeps_the_chain_stem(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake = FakeModels({"mega53_keys": "weights_missing"}, ("piano",))
    monkeypatch.setattr(models, "separate", fake.separate)
    document = tags({"piano": 0.65})
    params = separate.plan(config.load(), {"instrument": "piano"}, document)
    out = separate.run(with_tags(make_job(tmp_path, params), tmp_path, document))
    doc = contracts.Separation.model_validate(json.loads(Path(out.files["separation"]).read_text()))
    assert fake.calls[-1] == "mega53_keys"
    assert doc.fallback_when_silent is not None
    assert doc.fallback_when_silent.applied is False
    assert out.status == "done"


def test_the_fallback_gets_its_own_cache_directory(tmp_path: Path) -> None:
    cfg = config.load()
    job = make_job(tmp_path, {})
    sw, keys = cfg.models["bs_roformer_sw"], cfg.models["mega53_keys"]
    sw_ref, keys_ref = models.model_ref(sw), models.model_ref(keys)
    kept: dict[str, separate.Role] = {"piano": "target", "drums": "extra"}
    plain = separate.run_id(job, "bs_roformer_sw", sw, sw_ref, kept)
    result = models.Result(files={}, seconds=0.0, peak_mb=0.0)
    replaced = separate.run_id(
        job, "bs_roformer_sw", sw, sw_ref, kept, ("mega53_keys", keys, keys_ref, result)
    )
    assert plain != replaced
    # Without a fallback the directory is what it was before step 29 (stored stems stay valid).
    key = [AUDIO_HASH, "bs_roformer_sw", sw_ref.weights_sha256, sw.inference, sorted(kept.items())]
    assert plain == hashlib.sha256(canonical_json(key).encode()).hexdigest()[:32]


def test_a_stem_within_full_scale_is_cached_as_flac_and_a_louder_one_as_float_wav(
    tmp_path: Path,
) -> None:
    """Step 28: on a loud master a stem peaks above full scale while the mixture doesn't; the
    cache must keep it exactly, or `mixture - stem` breaks."""
    t = np.arange(RATE) / RATE
    quiet = np.repeat((0.5 * np.sin(2 * np.pi * 110 * t))[:, None], 2, axis=1).astype(np.float32)
    loud = quiet * np.float32(3.2)
    path, _ = separate.store(quiet, tmp_path / "run" / "bass")
    assert path.name == "bass.flac"
    path, sha = separate.store(loud, tmp_path / "run" / "drums")
    assert path.name == "drums.wav"
    back, _ = sf.read(str(path), dtype="float32", always_2d=True)  # pyright: ignore[reportUnknownMemberType]
    assert np.array_equal(back, loud)  # nothing clipped or rescaled
    assert hashlib.sha256(path.read_bytes()).hexdigest() == sha
    contracts.SeparatedStem.model_validate(
        {
            "name": "drums",
            "role": "target",
            "file": f"{'ab' * 8}/drums.wav",
            "sha256": sha,
            "frames": RATE,
        }
    )


def test_the_stem_store_is_part_of_the_cache_key() -> None:
    params = separate.plan(config.load(), {"instrument": "guitar"}, None)
    assert params["stem_store"] == separate.STEM_STORE


def test_the_library_peak_normalisation_is_off(
    tmp_path: Path, fake_separator: list[dict[str, Any]]
) -> None:
    import math

    spec = with_inference("bs_roformer_sw", {})  # a set chunk would read the fake's model config
    separator = models._separator("bs_roformer_sw", spec, tmp_path)  # pyright: ignore[reportPrivateUsage]
    assert fake_separator[0]["normalization_threshold"] == 1.0  # the most its constructor takes
    assert separator.normalization_threshold == math.inf


class LoudModels:
    """audio-separator stand-in whose drums output peaks at +10 dBFS and whose bass cancels it."""

    def separate(self, name: str, spec: ModelSpec, audio: Path, output_dir: Path) -> models.Result:
        output_dir.mkdir(parents=True, exist_ok=True)
        data, _ = sf.read(str(audio), dtype="float32", always_2d=True)  # pyright: ignore[reportUnknownMemberType]
        files: dict[str, Path] = {}
        for stem in spec.outputs:
            level = {"drums": 10.0, "bass": -9.0}.get(stem, 0.0)
            path = output_dir / f"{stem}.wav"
            sf.write(str(path), data * level, RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
            files[stem] = path
        return models.Result(files=files, seconds=0.1, peak_mb=0.0)


def test_a_loud_stem_reaches_the_cache_unchanged(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(models, "separate", LoudModels().separate)
    params = separate.plan(config.load(), {"instrument": "drums"}, None)
    job = make_job(tmp_path, params)
    out = separate.run(job)
    doc = contracts.Separation.model_validate(json.loads(Path(out.files["separation"]).read_text()))
    stems = {s.name: s for s in doc.stems}
    drums = Path(job.cache_dir) / "separated" / stems["drums"].file
    assert drums.suffix == ".wav"
    mixture, _ = sf.read(str(job.decoded_path), dtype="float32", always_2d=True)  # pyright: ignore[reportUnknownMemberType]
    stored, _ = sf.read(str(drums), dtype="float32", always_2d=True)  # pyright: ignore[reportUnknownMemberType]
    assert float(np.abs(stored).max()) > 1.0
    assert np.allclose(stored, 10.0 * mixture, atol=1e-5)  # mixture - stem stays exact


def loud_fixture() -> Path:
    base = os.environ.get("SPLITUNE_DATASETS_DIR", str(Path("~/datasets").expanduser()))
    return Path(base) / "musdb18hq-p1" / "loud-master" / "fixtures" / "xl-punkdisco-oral-hygiene"


@pytest.mark.models
def test_a_hot_master_separates_without_rescaling_or_clipping(tmp_path: Path) -> None:
    """A limit-XL MUSDB window (eval/loud_master.py fixture): mixture at -1 dBTP, drums and bass
    stems above full scale. Before step 28 BS-Roformer-SW's drums came back rescaled to 1.0 and
    mixture - Σ outputs was only 16 dB below the mixture."""
    fixture = loud_fixture()
    if not (fixture / "mixture.wav").is_file():
        pytest.skip(f"loud fixture not built ({fixture}; eval/loud_master.py run)")
    try:
        register.verify(register.model("bs-roformer-sw"), models.models_dir() / "audio-separator")
    except StageError:
        pytest.skip("BS-Roformer-SW weights not installed")
    mixture, _ = sf.read(str(fixture / "mixture.wav"), dtype="float32", always_2d=True)  # pyright: ignore[reportUnknownMemberType]
    job = make_job(tmp_path, separate.plan(config.load(), {"instrument": "drums"}, None), 30.0)
    sf.write(str(job.decoded_path), mixture, RATE, format="FLAC", subtype="PCM_24")  # pyright: ignore[reportUnknownMemberType]
    models.release()
    out = separate.run(job)
    doc = contracts.Separation.model_validate(json.loads(Path(out.files["separation"]).read_text()))
    raw_dir = Path(job.workdir) / "separated" / "bs_roformer_sw"
    outputs = {
        p.stem: sf.read(str(p), dtype="float32", always_2d=True)[0] for p in raw_dir.glob("*.wav")
    }  # pyright: ignore[reportUnknownMemberType]
    for stem in doc.stems:
        stored, _ = sf.read(
            str(Path(job.cache_dir) / "separated" / stem.file), dtype="float32", always_2d=True
        )  # pyright: ignore[reportUnknownMemberType]
        assert np.allclose(stored, outputs[stem.name][: len(stored)], atol=2**-22)
    assert float(np.abs(outputs["drums"]).max()) > 1.0  # not rescaled to full scale
    fed, _ = sf.read(str(job.decoded_path), dtype="float32", always_2d=True)  # pyright: ignore[reportUnknownMemberType]
    total = np.sum([a[: len(fed)] for a in outputs.values()], axis=0)
    residual = 10 * np.log10(np.sum((fed - total) ** 2) / np.sum(fed**2))
    assert residual < -25  # -31.5 dB measured; -16.5 dB with the library's rescaling
    models.release()


@pytest.mark.models
def test_a_synth_keys_window_sw_misses_gets_the_fallback(tmp_path: Path) -> None:
    """MoisesDB window 765d5131-piano (eval/p1_moisesdb.py): synth keys that BS-Roformer-SW
    outputs as silence; the tagger scores piano 0.0615 there. Step 29 measured the fallback's
    keys + synth at 4.46 dB uSDR against the piano + other_keys reference."""
    base = os.environ.get("SPLITUNE_DATASETS_DIR", str(Path("~/datasets").expanduser()))
    window = Path(base) / "moisesdb-p1" / "765d5131-piano"
    if not (window / "mixture.wav").is_file():
        pytest.skip(f"MoisesDB window absent ({window}; eval/p1_moisesdb.py)")
    try:
        for record in ("htdemucs-6s", "bs-roformer-sw", "bs-roformer-mega53-keys5"):
            register.verify(register.model(record), models.models_dir() / "audio-separator")
    except StageError:
        pytest.skip("separation weights not installed (scripts/fetch_models.py)")
    mixture, _ = sf.read(str(window / "mixture.wav"), dtype="float32", always_2d=True)  # pyright: ignore[reportUnknownMemberType]
    document = tags({"piano": 0.0615})
    params = separate.plan(config.load(), {"instrument": "piano"}, document)
    job = with_tags(make_job(tmp_path, params, 30.0), tmp_path, document)
    sf.write(str(job.decoded_path), mixture, RATE, format="FLAC", subtype="PCM_24")  # pyright: ignore[reportUnknownMemberType]
    models.release()
    out = separate.run(job)
    models.release()
    doc = contracts.Separation.model_validate(json.loads(Path(out.files["separation"]).read_text()))
    check = doc.fallback_when_silent
    assert check is not None
    assert check.applied
    assert check.target_db < -40
    assert check.provider == "bs_roformer:mega53-keys"
    target = next(s for s in doc.stems if s.role == "target")
    stem, _ = sf.read(str(Path(job.cache_dir) / "separated" / target.file), always_2d=True)  # pyright: ignore[reportUnknownMemberType]
    reference, _ = sf.read(str(window / "piano.wav"), always_2d=True)  # pyright: ignore[reportUnknownMemberType]
    n = min(len(stem), len(reference))
    usdr = 10 * np.log10(np.sum(reference[:n] ** 2) / np.sum((reference[:n] - stem[:n]) ** 2))
    assert usdr > 3  # 4.46 dB in the step 29 matrix (the stage's 24-bit decode feeds it here)


def band_mix(path: Path, seconds: float) -> Path:
    """A deterministic little band: bass line, pulsed noise drums and a chord pad."""
    rng = np.random.default_rng(29)
    n = int(seconds * RATE)
    t = np.arange(n) / RATE
    bass = 0.3 * np.sin(2 * np.pi * 55 * t) * (np.sin(2 * np.pi * 2 * t) > 0)
    drums = 0.4 * rng.standard_normal(n) * np.exp(-((t * 4) % 1) * 30)
    pad = 0.1 * sum(np.sin(2 * np.pi * f * t) for f in (261.6, 329.6, 392.0))
    mix = bass + drums + pad
    sf.write(
        str(path), np.stack([mix, 0.9 * mix], axis=1).astype(np.float32), RATE, subtype="FLOAT"
    )  # pyright: ignore[reportUnknownMemberType]
    return path


@pytest.mark.models
def test_wrapper_settings_change_a_real_roformer_and_stay_deterministic(tmp_path: Path) -> None:
    """BS-Roformer-SW on 15 s: a run is bit-identical to a repeat; `chunk`, `shifts` and (CUDA)
    `autocast` change the output and repeat bit-identically; a short input in between leaves the
    next long run as it was (the library's under-10 s switch no longer sticks to the warm
    model)."""
    try:
        register.verify(register.model("bs-roformer-sw"), models.models_dir() / "audio-separator")
    except StageError:
        pytest.skip("BS-Roformer-SW weights not installed")
    long = band_mix(tmp_path / "long.wav", 15.0)
    short = band_mix(tmp_path / "short.wav", 5.0)
    spec = with_inference("bs_roformer_sw", {})  # the library's defaults, not the map's

    def bass(run: str, model: ModelSpec, audio: Path = long) -> NDArray[np.float64]:
        result = models.separate("bs_roformer_sw", model, audio, tmp_path / run)
        data, _ = sf.read(str(result.files["bass"]), dtype="float64", always_2d=True)
        return np.asarray(data, dtype=np.float64)

    models.release()
    first = bass("first", spec)
    bass("short", spec, short)
    np.testing.assert_array_equal(bass("after-short", spec), first)
    chunked = bass("chunk", with_inference("bs_roformer_sw", {"chunk": 588800}))
    shifted = bass("shifts", with_inference("bs_roformer_sw", {"shifts": 2}))
    np.testing.assert_array_equal(
        bass("shifts-again", with_inference("bs_roformer_sw", {"shifts": 2})), shifted
    )
    others = [chunked, shifted]
    if models.device() == "cuda":  # fp16 autocast; measured -52 to -75 dB from fp32
        autocast = with_inference("bs_roformer_sw", {"autocast": True})
        others.append(bass("autocast", autocast))
        np.testing.assert_array_equal(bass("autocast-again", autocast), others[-1])
    for other in others:
        difference = 10 * np.log10(np.sum((other - first) ** 2) / np.sum(first**2))
        assert -90 < difference < -10  # a different run of the same separation
    models.release()
