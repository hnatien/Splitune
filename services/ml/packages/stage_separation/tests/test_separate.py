"""`separate` stage: the model map's fallback chain, what is kept, and real separation models."""

from __future__ import annotations

import hashlib
import json
import os
import uuid
from collections.abc import Generator
from pathlib import Path
from typing import Any, ClassVar

import numpy as np
import pytest
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
import yaml
from pydantic import ValidationError
from splitune_ml_core import contracts, register
from splitune_ml_core.errors import StageError
from splitune_ml_core.keys import cache_key
from splitune_ml_core.stage_api import StageJob
from stage_separation import config, models, separate, stem_post
from stage_separation.config import Instrument, ModelSpec

AUDIO_HASH = "cd" * 32
RATE = 44100


@pytest.fixture(autouse=True)
def default_model_map() -> Generator[None]:
    """A test that points ML_SEPARATION_CONFIG elsewhere leaves that map cached in config.load;
    the next test starts from the shipped one (this teardown runs after monkeypatch's)."""
    yield
    config.load.cache_clear()


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
    everything = ["bass", "drums", "piano", "vocals", "other"]  # every instrument but the target
    params = separate.plan(cfg, {"instrument": "guitar"}, tags({"drums": 0.005, "bass": 0.02}))
    assert params["chain"] == cfg.instruments["guitar"].chain
    assert params["keep"] == ["bass", "piano", "vocals", "other"]  # drums below keep_min_prob
    assert separate.plan(cfg, {"instrument": "guitar"}, None)["keep"] == everything
    unusable = tags({"drums": 0.0}, fallback="tagger_unavailable")
    assert separate.plan(cfg, {"instrument": "guitar"}, unusable)["keep"] == everything
    # The tagger has no "other" class: a full tag list never vetoes it.
    sure = tags({"guitar": 0.6, "bass": 0.001, "piano": 0.002, "drums": 0.003, "vocals": 0.004})
    assert separate.plan(cfg, {"instrument": "guitar"}, sure)["keep"] == ["other"]
    with pytest.raises(StageError) as err:
        separate.plan(cfg, {"instrument": "kazoo"}, None)
    assert err.value.code == "invalid_params"


EVERY_HEAD: list[tuple[str, Instrument, dict[str, float] | None, dict[str, str]]] = [
    # six-stem heads and fallbacks (subtract): every other output is an extra
    (
        "bs_roformer_sw",
        "guitar",
        None,
        {
            "bass": "extra",
            "drums": "extra",
            "guitar": "target",
            "piano": "extra",
            "vocals": "extra",
            "other": "extra",
        },
    ),
    (
        "htdemucs_6s",
        "piano",
        None,
        {
            "bass": "extra",
            "drums": "extra",
            "guitar": "extra",
            "piano": "target",
            "vocals": "extra",
            "other": "extra",
        },
    ),
    # the tagger vetoes an absent instrument: no stem
    (
        "bs_roformer_sw",
        "drums",
        {"piano": 0.005},
        {
            "bass": "extra",
            "drums": "target",
            "guitar": "extra",
            "vocals": "extra",
            "other": "extra",
        },
    ),
    # four-stem fallback
    (
        "htdemucs_ft",
        "bass",
        None,
        {"bass": "target", "drums": "extra", "vocals": "extra", "other": "extra"},
    ),
    # two-stem vocals heads (complement): nothing to add, "other" is the mix-minus
    ("mel_roformer_kim_vocals", "vocals", None, {"vocals": "target", "other": "complement"}),
    (
        "bs_roformer_viperx_1297",
        "vocals",
        None,
        {"vocals": "target", "instrumental": "complement"},
    ),
    # a six-stem vocals fallback (complement): extras are stems and in the mix-minus; a vetoed
    # instrument still belongs to the mix-minus
    (
        "bs_roformer_sw",
        "vocals",
        {"piano": 0.005},
        {
            "bass": "extra",
            "drums": "extra",
            "guitar": "extra",
            "piano": "complement",
            "vocals": "target",
            "other": "extra",
        },
    ),
]


@pytest.mark.parametrize(("model", "instrument", "probs", "expected"), EVERY_HEAD)
def test_every_output_of_the_producing_run_is_kept(
    model: str, instrument: Instrument, probs: dict[str, float] | None, expected: dict[str, str]
) -> None:
    cfg = config.load()
    assert model in cfg.instruments[instrument].chain
    params = separate.plan(cfg, {"instrument": instrument}, None if probs is None else tags(probs))
    assert separate.roles(cfg.models[model], params) == expected


def test_a_two_stem_subtract_model_keeps_only_its_target() -> None:
    """Guitar-only models (step 22 candidates) have no other instrument to give."""
    cfg = config.load()
    params = separate.plan(cfg, {"instrument": "guitar"}, None)
    assert separate.roles(cfg.models["mel_roformer_guitar_becruily"], params) == {
        "guitar": "target"
    }


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
    for name, bad in (
        ("bs_roformer_sw", {"overlapp": 4}),
        ("bs_roformer_sw", {"shifts": 1}),  # a Demucs key on an MDXC model
        ("bs_roformer_sw", {"overlap": 0}),
        ("htdemucs_ft", {"overlap": 1.5}),  # Demucs overlap is a fraction
        ("htdemucs_ft", {"segment_size": 10}),
    ):
        with pytest.raises(ValidationError):
            with_inference(name, bad)


def default_document() -> dict[str, Any]:
    return yaml.safe_load(config.DEFAULT_PATH.read_text(encoding="utf-8"))


def describe_key(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, inference: dict[str, Any]
) -> tuple[str, dict[str, Any]]:
    document = default_document()
    document["models"]["htdemucs_ft"]["inference"] = inference
    return described_with(tmp_path, monkeypatch, document, "bass")


def described_with(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, document: dict[str, Any], instrument: str
) -> tuple[str, dict[str, Any]]:
    """`separate`'s cache key and effective params under this model map."""
    path = tmp_path / f"separation-{len(list(tmp_path.iterdir()))}.yaml"
    path.write_text(yaml.safe_dump(document), encoding="utf-8")
    monkeypatch.setenv("ML_SEPARATION_CONFIG", str(path))
    config.load.cache_clear()
    try:
        described = separate.describe({"instrument": instrument})
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
    assert params["inference"]["htdemucs_ft"] == {"shifts": 1}
    assert one != two
    assert one == same
    job = make_job(tmp_path, params)
    ref = models.model_ref(config.load().models["htdemucs_ft"])
    kept: dict[str, separate.Role] = {"bass": "target"}
    assert separate.run_id(
        job, "htdemucs_ft", with_inference("htdemucs_ft", {"shifts": 1}), ref, kept
    ) != separate.run_id(job, "htdemucs_ft", with_inference("htdemucs_ft", {}), ref, kept)


def test_the_kept_instruments_are_part_of_the_cache_key(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """s40a: keeping every stem instead of drums and bass separates again (new key, new raw-stem
    directory), so no analysis reuses a run that stored only some of its outputs."""
    before = default_document()
    before["keep"] = ["drums", "bass"]
    old, old_params = described_with(tmp_path, monkeypatch, before, "guitar")
    new, new_params = described_with(tmp_path, monkeypatch, default_document(), "guitar")
    assert old_params["keep"] == ["drums", "bass"]
    assert new_params["keep"] == ["bass", "drums", "piano", "vocals", "other"]
    assert old != new
    job = make_job(tmp_path, new_params)
    spec = config.load().models["bs_roformer_sw"]
    ref = models.model_ref(spec)
    assert separate.run_id(job, "bs_roformer_sw", spec, ref, separate.roles(spec, old_params)) != (
        separate.run_id(job, "bs_roformer_sw", spec, ref, separate.roles(spec, new_params))
    )


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
        ("bass", "extra"),
        ("drums", "extra"),
        ("piano", "extra"),
        ("vocals", "extra"),
        ("other", "extra"),
    }
    assert {s.name: s.instrument for s in doc.stems}["other"] == "other"
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


def stems_after(job: StageJob, separation: str) -> contracts.Stems:
    """stem_post over a separate run's output, in the same cache."""
    inputs = {"separation": separation}
    work = Path(job.workdir).parent / "stem_post"
    work.mkdir()
    post = StageJob(
        stage="stem_post",
        analysis_id=job.analysis_id,
        user_id=job.user_id,
        artefact_version=1,
        params=stem_post.describe({}, inputs).params,
        inputs=inputs,
        workdir=str(work),
        cache_dir=job.cache_dir,
        audio_hash=job.audio_hash,
        duration_s=job.duration_s,
        decoded_path=job.decoded_path,
    )
    out = stem_post.run(post)
    stems = contracts.Stems.model_validate_json(Path(out.files["stems"]).read_text())
    assert set(out.blobs) == {f.path for s in stems.stems for f in s.files}
    return stems


def test_a_six_stem_run_gives_the_mixer_every_stem(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """separate → stem_post with BS-Roformer-SW's six outputs: one isolated stem per output
    (instrument set, "other" too), then the learner's mix-minus."""
    monkeypatch.setattr(models, "separate", FakeModels({}).separate)
    params = separate.plan(config.load(), {"instrument": "bass"}, None)
    job = make_job(tmp_path, params)
    out = separate.run(job)
    stems = stems_after(job, out.files["separation"])
    assert [(s.stem_id, s.kind, s.instrument) for s in stems.stems] == [
        ("bass", "isolated", "bass"),
        ("drums", "isolated", "drums"),
        ("guitar", "isolated", "guitar"),
        ("piano", "isolated", "piano"),
        ("vocals", "isolated", "vocals"),
        ("other", "isolated", "other"),
        ("mix_minus_bass", "mix_minus", None),
    ]
    assert {s.provider for s in stems.stems} == {"bs_roformer:BS-Roformer-SW"}
    assert all(not s.empty and s.quality_hint == "good" for s in stems.stems)
    assert all([f.path for f in s.files] == [f"stems/{s.stem_id}.m4a"] for s in stems.stems)


def test_a_two_stem_vocals_run_gives_the_vocals_and_their_mix_minus_only(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(models, "separate", FakeModels({}).separate)
    params = separate.plan(config.load(), {"instrument": "vocals"}, None)
    job = make_job(tmp_path, params)
    out = separate.run(job)
    doc = contracts.Separation.model_validate_json(Path(out.files["separation"]).read_text())
    assert doc.provider == "mel_roformer:kim-vocals"
    assert [(s.name, s.role) for s in doc.stems] == [("vocals", "target"), ("other", "complement")]
    stems = stems_after(job, out.files["separation"])
    assert [s.stem_id for s in stems.stems] == ["vocals", "mix_minus_vocals"]


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
    assert {s.name for s in doc.stems} == {"guitar", "bass", "drums", "piano", "vocals", "other"}
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

    spec = config.load().models["bs_roformer_sw"]
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
