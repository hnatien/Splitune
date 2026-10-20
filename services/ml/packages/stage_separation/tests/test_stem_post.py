"""`stem_post`: alignment, activity, encodes verified against the PCM, and the stage output."""

from __future__ import annotations

import hashlib
import json
import uuid
from pathlib import Path
from typing import Any

import numpy as np
import pytest
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from numpy.typing import NDArray
from splitune_ml_core import contracts
from splitune_ml_core.errors import StageError
from splitune_ml_core.stage_api import StageJob
from stage_separation import dsp, encode, stem_post

RATE = 44100
AUDIO_HASH = "ef" * 32


def tone(seconds: float, hz: float, level: float, *, seed: int = 0) -> NDArray[np.float32]:
    rng = np.random.default_rng(seed)
    t = np.arange(int(seconds * RATE)) / RATE
    wave = level * (np.sin(2 * np.pi * hz * t) + 0.3 * rng.standard_normal(t.size))
    return np.stack([wave, 0.8 * wave], axis=1).astype(np.float32)


def test_alignment_recovers_a_shift() -> None:
    mixture = tone(8, 330, 0.2)
    late = dsp.shift(mixture, 137)  # the stem arrives 137 samples late
    assert dsp.alignment_lag(mixture, late) == -137
    assert dsp.alignment_lag(mixture, dsp.shift(mixture, -50)) == 50
    assert dsp.alignment_lag(mixture, np.zeros_like(mixture)) == 0
    np.testing.assert_array_equal(dsp.shift(dsp.shift(mixture, 137), -137)[:-137], mixture[:-137])


def test_activity_finds_the_section_where_a_stem_plays() -> None:
    bed = tone(12, 110, 0.2, seed=1)
    part = np.zeros_like(bed)
    part[4 * RATE : 8 * RATE] = tone(4, 660, 0.2, seed=2)
    act = dsp.activity(part, bed + part)
    assert len(act.spans) == 1
    t0, t1, ratio = act.spans[0]
    assert 3.4 <= t0 <= 4.1
    assert 7.9 <= t1 <= 8.6
    assert 0.3 < ratio < 0.7
    assert dsp.activity(np.zeros_like(bed), bed).spans == []
    assert dsp.loudness_lufs(np.zeros_like(bed)) is None
    loud = dsp.loudness_lufs(bed)
    assert loud is not None
    assert -30 < loud < -5


@pytest.mark.parametrize("frames", [3 * RATE + 1, 2 * RATE, 1024 * 77])
def test_aac_encode_declares_and_decodes_the_exact_length(tmp_path: Path, frames: int) -> None:
    audio = tone(4, 440, 0.2)[:frames]
    wav = tmp_path / "in.wav"
    sf.write(str(wav), audio, RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    out = tmp_path / "out.m4a"
    encode.encode_aac(wav, out)
    assert encode.declared_frames(out) == frames
    encode.verify_aac(out, audio)
    decoded = encode.decode(out)
    assert 0 <= len(decoded) - frames < 2048  # ffmpeg keeps the end padding; browsers trim it
    assert encode.start_lag(decoded, audio) == 0


def test_verification_rejects_a_shifted_or_short_encode(tmp_path: Path) -> None:
    audio = tone(4, 440, 0.2)
    wav = tmp_path / "in.wav"
    sf.write(str(wav), dsp.shift(audio, 300), RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    encode.encode_aac(wav, tmp_path / "shifted.m4a")
    with pytest.raises(StageError) as err:
        encode.verify_aac(tmp_path / "shifted.m4a", audio)
    assert err.value.code == "encode_verification_failed"
    sf.write(str(wav), audio[:-RATE], RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    encode.encode_aac(wav, tmp_path / "short.m4a")
    with pytest.raises(StageError):
        encode.verify_aac(tmp_path / "short.m4a", audio)


def test_opus_encode_is_within_one_sample(tmp_path: Path) -> None:
    audio = tone(3, 440, 0.2)[: 3 * RATE - 7]
    wav = tmp_path / "in.wav"
    sf.write(str(wav), audio, RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    encode.encode_opus(wav, tmp_path / "out.webm")
    encode.verify_opus(tmp_path / "out.webm", audio)


def write_raw(cache: Path, run: str, name: str, audio: NDArray[np.float32]) -> dict[str, Any]:
    path = cache / "separated" / run / f"{name}.flac"
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), audio, RATE, format="FLAC", subtype="PCM_24")  # pyright: ignore[reportUnknownMemberType]
    return {
        "name": name,
        "file": f"{run}/{name}.flac",
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "frames": len(audio),
    }


def header(kind: str, seconds: float) -> dict[str, Any]:
    return {
        "schema_version": contracts.SCHEMA_VERSION,
        "artefact": kind,
        "artefact_version": 1,
        "analysis_id": str(uuid.uuid4()),
        "user_id": "pytest-stem-post",
        "audio_hash": AUDIO_HASH,
        "sample_rate": 44100,
        "duration_s": seconds,
        "models": [
            {
                "model_id": "htdemucs_6s",
                "version": "4.0.1",
                "weights_sha256": "5a" * 32,
                "provider": "self_hosted",
                "register_tier": "amber",
            }
        ],
        "params": {},
        "created_at": "2026-10-21T00:00:00Z",
    }


def scenario(
    tmp_path: Path, *, mix_minus: str, guitar_lag: int = 0, tag_guitar: float = 0.6
) -> tuple[StageJob, NDArray[np.float32], NDArray[np.float32]]:
    """Guitar plays 2-8 s over drums; the model's guitar comes back `guitar_lag` samples early
    and its drums are silent-bleed-free; bass is silent."""
    seconds = 10.0
    drums = tone(seconds, 90, 0.15, seed=3)
    guitar = np.zeros_like(drums)
    guitar[2 * RATE : 8 * RATE] = tone(6, 523, 0.15, seed=4)
    mixture = drums + guitar
    cache = tmp_path / "cache"
    run = "0123456789abcdef0123456789abcdef"
    returned = dsp.shift(guitar, -guitar_lag)
    stems = [
        {**write_raw(cache, run, "guitar", returned), "instrument": "guitar", "role": "target"},
        {**write_raw(cache, run, "drums", drums), "instrument": "drums", "role": "extra"},
        {
            **write_raw(cache, run, "bass", np.zeros_like(drums)),
            "instrument": "bass",
            "role": "extra",
        },
    ]
    if mix_minus == "complement":
        stems.append({**write_raw(cache, run, "other", np.zeros_like(drums)), "role": "complement"})
    separation = {
        **header("separation", seconds),
        "target": "guitar",
        "provider": "htdemucs_6s",
        "mix_minus": mix_minus,
        "device": "cpu",
        "stems": stems,
        "failed_attempts": [],
    }
    tags = {
        **header("tags", seconds),
        "models": [],
        "window_s": 10,
        "windows": 1,
        "instruments": [
            {"instrument": "guitar", "present_prob": tag_guitar, "subtype": "electric_guitar"},
            {"instrument": "drums", "present_prob": 0.4},
            {"instrument": "bass", "present_prob": 0.05},
            {"instrument": "vocals", "present_prob": 0.02},
        ],
    }
    inputs = {"separation": tmp_path / "separation.json", "tags": tmp_path / "tags.json"}
    inputs["separation"].write_text(json.dumps(separation))
    inputs["tags"].write_text(json.dumps(tags))
    decoded = tmp_path / "decoded.flac"
    sf.write(str(decoded), mixture, RATE, format="FLAC", subtype="PCM_24")  # pyright: ignore[reportUnknownMemberType]
    named = {k: str(v) for k, v in inputs.items()}
    work = tmp_path / "work"
    work.mkdir()
    job = StageJob(
        stage="stem_post",
        analysis_id=str(uuid.uuid4()),
        user_id="pytest-stem-post",
        artefact_version=1,
        params=stem_post.describe({}, named).params,
        inputs=named,
        workdir=str(work),
        cache_dir=str(cache),
        audio_hash=AUDIO_HASH,
        duration_s=seconds,
        decoded_path=str(decoded),
    )
    return job, mixture, drums


def load(out_path: str) -> dict[str, Any]:
    return json.loads(Path(out_path).read_text())


def test_stem_post_aligns_derives_mix_minus_and_writes_presence(tmp_path: Path) -> None:
    job, mixture, drums = scenario(tmp_path, mix_minus="subtract", guitar_lag=64)
    out = stem_post.run(job)
    stems = contracts.Stems.model_validate(load(out.files["stems"]))
    presence = contracts.Presence.model_validate(load(out.files["presence"]))
    assert stems.alignment_offset_samples == 64
    by_id = {s.stem_id: s for s in stems.stems}
    assert set(by_id) == {"guitar", "drums", "bass", "mix_minus_guitar"}
    assert by_id["mix_minus_guitar"].kind == "mix_minus"
    assert by_id["bass"].empty
    assert by_id["bass"].quality_hint == "rough"
    assert by_id["bass"].gain_to_unity_db == 0.0
    assert by_id["bass"].loudness_lufs == dsp.SILENCE_LUFS
    assert not by_id["guitar"].empty
    assert by_id["guitar"].quality_hint == "good"
    mix_loudness = dsp.loudness_lufs(mixture)
    assert mix_loudness is not None
    assert stems.mix_gain_db == pytest.approx(dsp.TARGET_LUFS - mix_loudness, abs=0.05)
    assert set(out.blobs) == {f.path for s in stems.stems for f in s.files}
    assert all(f.codec == "aac" for s in stems.stems for f in s.files)  # opus is off by default

    # mixture - aligned guitar is the drums (exactly, up to the 24-bit raw stems and the AAC)
    decoded = encode.decode(Path(out.blobs["stems/mix_minus_guitar.m4a"]))[: len(drums)]
    residual = 10 * np.log10(((decoded - drums) ** 2).sum() / (drums**2).sum())
    assert residual < -15

    p = {i.instrument: i for i in presence.instruments}
    assert p["guitar"].subtype == "electric_guitar"
    (t0, t1) = (p["guitar"].activity[0].t0, p["guitar"].activity[0].t1)
    assert 1.4 <= t0 <= 2.1
    assert 7.9 <= t1 <= 8.6
    assert not p["guitar"].bleed_suspected
    assert p["bass"].present_prob <= 0.1
    assert p["vocals"].activity == []  # tagger-only entry
    assert p["vocals"].present_prob == pytest.approx(0.02)


def test_complement_mix_minus_sums_the_other_outputs(tmp_path: Path) -> None:
    job, _, drums = scenario(tmp_path, mix_minus="complement")
    out = stem_post.run(job)
    decoded = encode.decode(Path(out.blobs["stems/mix_minus_guitar.m4a"]))[: len(drums)]
    residual = 10 * np.log10(((decoded - drums) ** 2).sum() / (drums**2).sum())
    assert residual < -15


def test_energy_the_tagger_cannot_hear_is_bleed(tmp_path: Path) -> None:
    job, _, _ = scenario(tmp_path, mix_minus="subtract", tag_guitar=0.005)
    out = stem_post.run(job)
    stems = {s["stem_id"]: s for s in load(out.files["stems"])["stems"]}
    presence = {p["instrument"]: p for p in load(out.files["presence"])["instruments"]}
    assert presence["guitar"]["bleed_suspected"]
    assert presence["guitar"]["present_prob"] <= 0.5
    assert stems["guitar"]["quality_hint"] == "rough"


def test_missing_or_changed_raw_stems_fail_permanently(tmp_path: Path) -> None:
    job, _, _ = scenario(tmp_path, mix_minus="subtract")
    raw = next((Path(job.cache_dir) / "separated").glob("*/drums.flac"))
    raw.write_bytes(raw.read_bytes()[:-100])
    with pytest.raises(StageError) as err:
        stem_post.run(job)
    assert (err.value.code, err.value.retry) == ("separated_audio_missing", False)


def test_cache_key_follows_the_raw_stems(tmp_path: Path) -> None:
    job, _, _ = scenario(tmp_path, mix_minus="subtract")
    first = stem_post.describe({}, job.inputs).params["separation"]
    separation = load(job.inputs["separation"])
    separation["stems"][0]["sha256"] = "0" * 64
    Path(job.inputs["separation"]).write_text(json.dumps(separation))
    assert stem_post.describe({}, job.inputs).params["separation"] != first
