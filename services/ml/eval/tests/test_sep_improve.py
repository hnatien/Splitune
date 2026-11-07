"""Step 29 harness: the eval model overlay, virtual models (`sep_matrix.py combine`) and the
limiter-then-codec variants."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

import numpy as np
import pytest
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from splitune_eval import scoring, sepmap, variants

RATE = 44100


def test_the_overlay_adds_candidates_and_settings_without_touching_the_map() -> None:
    from stage_separation import config

    shipped = config.load().models
    merged = sepmap.models()
    for name, spec in shipped.items():
        assert merged[name] == spec
    kim = merged["mel_roformer_kim_vocals@gain-14"]
    assert kim.inference == {"overlap": 11, "gain": {"target_lufs": -14}}  # merged over the base
    assert kim.filename == shipped["mel_roformer_kim_vocals"].filename
    assert merged["bs_roformer_sw@shifts3"].inference == {"shifts": 3}
    assert merged["bs_roformer_leap_xe"].inference["chunk"] % 512 == 0
    with pytest.raises(ValueError, match="may not replace"):
        sepmap.entries({"models": {"htdemucs_6s": {"base": "htdemucs_ft"}}}, dict(shipped))
    with pytest.raises(KeyError):
        sepmap.spec("no_such_model")


def write(path: Path, audio: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), audio.astype(np.float32), RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]


def noise(seed: int, frames: int, level: float) -> np.ndarray:
    return level * np.random.default_rng(seed).standard_normal((frames, 2))


@pytest.fixture
def kept(tmp_path: Path) -> Path:
    """Two clips with vocals + drums references; models a and b kept their vocals output (the
    reference plus independent noise), model s its vocals (silent on clip `quiet`) and model f a
    fallback output."""
    frames = 2 * RATE
    t = np.arange(frames) / RATE
    vocals = np.stack([np.sin(2 * np.pi * 330 * t)] * 2, axis=1) * 0.3
    drums = noise(1, frames, 0.1)
    items: dict[str, Any] = {}
    base = tmp_path / "matrix" / "clean"
    for clip in ("loud", "quiet"):
        items[clip] = {}
        write(tmp_path / clip / "mixture.wav", vocals + drums)
        write(tmp_path / clip / "vocals.wav", vocals)
        write(tmp_path / clip / "drums.wav", drums)
        outputs = {
            "a": vocals + noise(2, frames, 0.05),
            "b": vocals + noise(3, frames, 0.05),
            "s": vocals * (1.0 if clip == "loud" else 0.0),
            "f": vocals + noise(4, frames, 0.02),
        }
        for model, audio in outputs.items():
            write(base / "outputs" / model / clip / "vocals.wav", audio)
            row = {"clip": clip, "model": model, "variant": "clean", "seconds": 2.0, "peak_mb": 100}
            with (base / f"{model}.jsonl").open("a", encoding="utf-8") as f:
                f.write(json.dumps(row) + "\n")
    (tmp_path / "windows.json").write_text(json.dumps({"items": items}), encoding="utf-8")
    return tmp_path


def combine(root: Path, *args: str) -> dict[str, dict[str, Any]]:
    import sep_matrix  # pyright: ignore[reportMissingImports]

    name = args[args.index("--name") + 1]
    assert sep_matrix.main(["--root", str(root), "combine", "--variant", "clean", *args]) == 0
    log = root / "matrix" / "clean" / f"{name}.jsonl"
    rows = [json.loads(line) for line in log.read_text(encoding="utf-8").splitlines()]
    return {r["clip"]: r for r in rows}


def read(path: Path) -> np.ndarray:
    data, _ = sf.read(str(path), dtype="float64", always_2d=True)
    return np.asarray(data, dtype=np.float64)


def test_an_average_is_scored_like_a_model_and_averaging_lowers_independent_noise(
    kept: Path,
) -> None:
    rows = combine(
        kept, "--name", "ab", "--recipe", "avg_wave", "--instrument", "vocals",
        "--part", "a:vocals", "--part", "b:vocals",
    )  # fmt: skip
    out = kept / "matrix" / "clean" / "outputs"
    a, b = (read(out / m / "loud" / "vocals.wav") for m in "ab")
    vocals = read(kept / "loud" / "vocals.wav")
    row = rows["loud"]
    assert row["metrics"]["vocals"]["usdr"] == pytest.approx(
        scoring.usdr(vocals, (a + b) / 2), abs=1e-3
    )
    assert row["metrics"]["vocals"]["usdr"] > scoring.usdr(vocals, a) + 2.5  # ~3 dB less noise
    assert row["seconds"] == 4.0
    assert row["virtual"]["recipe"] == "avg_wave"
    assert set(row) >= {"energy_db", "peak", "metrics", "peak_mb"}
    weighted = combine(
        kept, "--name", "ab31", "--recipe", "avg_wave", "--instrument", "vocals",
        "--part", "a:vocals*3", "--part", "b:vocals",
    )  # fmt: skip
    assert weighted["loud"]["metrics"]["vocals"]["usdr"] == pytest.approx(
        scoring.usdr(vocals, (3 * a + b) / 4), abs=1e-3
    )


def test_avg_fft_matches_avg_wave_up_to_the_stft_round_trip(kept: Path) -> None:
    parts = ["--part", "a:vocals", "--part", "b:vocals", "--instrument", "vocals"]
    wave = combine(kept, "--name", "w", "--recipe", "avg_wave", *parts)
    fft = combine(kept, "--name", "fft", "--recipe", "avg_fft", *parts)
    for clip in ("loud", "quiet"):
        assert fft[clip]["metrics"]["vocals"]["usdr"] == pytest.approx(
            wave[clip]["metrics"]["vocals"]["usdr"], abs=0.01
        )


def test_routing_takes_the_fallback_only_when_the_primary_is_silent(kept: Path) -> None:
    rows = combine(
        kept, "--name", "routed", "--recipe", "route", "--instrument", "vocals",
        "--primary", "s:vocals", "--part", "f:vocals", "--threshold-db", "-40",
    )  # fmt: skip
    assert rows["loud"]["virtual"]["routed"] is False
    assert rows["quiet"]["virtual"]["routed"] is True
    assert rows["loud"]["metrics"]["vocals"]["usdr"] > 60  # the primary is the reference itself
    vocals = read(kept / "quiet" / "vocals.wav")
    fallback = read(kept / "matrix" / "clean" / "outputs" / "f" / "quiet" / "vocals.wav")
    assert rows["quiet"]["metrics"]["vocals"]["usdr"] == pytest.approx(
        scoring.usdr(vocals, fallback), abs=1e-3
    )
    assert rows["loud"]["seconds"] == 2.0  # the fallback ran only where routed
    assert rows["quiet"]["seconds"] == 4.0


def test_a_kept_clip_without_an_output_counts_as_silence(kept: Path) -> None:
    # audio-separator writes no file for an all-zero stem; a clip never kept is still an error.
    outputs = kept / "matrix" / "clean" / "outputs"
    (outputs / "s" / "quiet" / "vocals.wav").unlink()
    rows = combine(
        kept, "--name", "routed", "--recipe", "route", "--instrument", "vocals",
        "--primary", "s:vocals", "--part", "f:vocals", "--threshold-db", "-40",
    )  # fmt: skip
    assert rows["quiet"]["virtual"]["routed"] is True
    shutil.rmtree(outputs / "s" / "quiet")
    with pytest.raises(SystemExit, match="--keep-outputs first"):
        combine(
            kept, "--name", "again", "--recipe", "route", "--instrument", "vocals",
            "--primary", "s:vocals", "--part", "f:vocals",
        )  # fmt: skip


def test_a_limited_master_through_a_codec_keeps_the_limited_references() -> None:
    frames = 3 * RATE
    t = np.arange(frames) / RATE
    refs = {
        "drums": noise(5, frames, 0.2) * (np.sin(2 * np.pi * 2 * t) > 0)[:, None],
        "bass": np.stack([0.4 * np.sin(2 * np.pi * 55 * t)] * 2, axis=1),
    }
    mixture = refs["drums"] + refs["bass"]
    loud = variants.apply("limit-XL", mixture, refs)
    both = variants.apply("limit-XL+aac128", mixture, refs)
    assert "limit-XL+aac128" in variants.OWN_REFERENCES
    for stem in refs:
        np.testing.assert_array_equal(both.references[stem], loud.references[stem])
    assert both.mixture.shape == mixture.shape
    assert both.info["lufs"] == loud.info["lufs"]
    assert both.info["decoded_peak"] == pytest.approx(float(np.abs(both.mixture).max()), abs=1e-4)
    error = both.mixture - loud.mixture
    assert 10 * np.log10(np.sum(loud.mixture**2) / np.sum(error**2)) > 10  # the codec, aligned
