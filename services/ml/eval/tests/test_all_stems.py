from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import all_stems  # pyright: ignore[reportMissingImports, reportUnknownVariableType]
import numpy as np
import pytest
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from splitune_ml_core import contracts

# The script module is untyped from the tests' point of view.
# pyright: reportUnknownMemberType=false, reportUnknownArgumentType=false, reportUnknownVariableType=false

HEADER: dict[str, Any] = {
    "schema_version": contracts.SCHEMA_VERSION,
    "artefact_version": 1,
    "analysis_id": "00000000-0000-0000-0000-000000000000",
    "user_id": "eval",
    "audio_hash": "ab" * 32,
    "sample_rate": 44100,
    "duration_s": 1.0,
    "models": [],
    "params": {},
    "created_at": "2026-11-08T00:00:00Z",
}


def stem(stem_id: str, kind: str, instrument: str | None) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "stem_id": stem_id,
        "kind": kind,
        "provider": "bs_roformer:BS-Roformer-SW",
        "files": [
            {
                "codec": "aac",
                "container": "mp4",
                "path": f"stems/{stem_id}.m4a",
                "bitrate_kbps": 160,
            }
        ],
        "loudness_lufs": -20.0,
        "gain_to_unity_db": 6.0,
        "energy_ratio_to_mix": 0.2,
        "quality_hint": "good",
        "empty": False,
    }
    if instrument is not None:
        entry["instrument"] = instrument
    return entry


def fake_run(root: Path, tag: str) -> Path:
    """One run item as `all_stems.py run` leaves it: item.json, stems.json and the AAC files
    (their bytes are only copied, so any bytes do)."""
    folder = root / "all-stems" / tag / "window"
    (folder / "stems").mkdir(parents=True)
    source = root / "mixture.wav"
    t = np.arange(44100) / 44100
    tone = np.repeat((0.2 * np.sin(2 * np.pi * 220 * t))[:, None], 2, axis=1).astype(np.float32)
    sf.write(str(source), tone, 44100, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    stems = [
        stem("guitar", "isolated", "guitar"),
        stem("drums", "isolated", "drums"),
        stem("other", "isolated", "other"),
        stem("mix_minus_guitar", "mix_minus", None),
    ]
    document = {
        **HEADER,
        "artefact": "stems",
        "stems": stems,
        "alignment_offset_samples": 0,
        "mix_gain_db": 0.0,
    }
    (folder / "stems.json").write_text(
        json.dumps(contracts.Stems.model_validate(document).model_dump(mode="json"))
    )
    for s in stems:
        (folder / "stems" / f"{s['stem_id']}.m4a").write_bytes(s["stem_id"].encode())
    meta = {"item": "window", "instrument": "guitar", "source": str(source)}
    (folder / "item.json").write_text(json.dumps(meta))
    return folder


def test_export_writes_a_session_the_listening_app_reads(tmp_path: Path) -> None:
    fake_run(tmp_path, "t")
    assert all_stems.main(["--root", str(tmp_path), "export", "--tag", "t", "--session", "s1"]) == 0
    session = tmp_path / "listening" / "s1"
    manifest = json.loads((session / "session.json").read_text())
    # apps/listening/src/session.ts Manifest: ids, targets and file names
    assert re.fullmatch(r"[a-z0-9-]{1,64}", manifest["id"])
    assert [(c["clip"], c["target"]) for c in manifest["clips"]] == [
        ("window.guitar", "guitar"),
        ("window.drums", "drums"),
    ]
    items = [(i["clip"], i["kind"], i["system"], i["file"]) for i in manifest["items"]]
    assert items == [
        ("window.guitar", "isolated", "bs_roformer:BS-Roformer-SW:target", "window.guitar.m4a"),
        ("window.drums", "isolated", "bs_roformer:BS-Roformer-SW:extra", "window.drums.m4a"),
        (
            "window.guitar",
            "mix_minus",
            "bs_roformer:BS-Roformer-SW:mix_minus",
            "window.mix_minus_guitar.m4a",
        ),
    ]
    tokens = [i["item"] for i in manifest["items"]] + [
        c["mixture"]["token"] for c in manifest["clips"]
    ]
    assert all(re.fullmatch(r"[a-z0-9]{12,32}", t) for t in tokens)
    for name in [i["file"] for i in manifest["items"]] + [
        c["mixture"]["file"] for c in manifest["clips"]
    ]:
        assert re.fullmatch(r"[a-z0-9][a-z0-9_.-]*\.m4a", name)
        assert (session / "media" / name).is_file()
    assert (session / "media" / "window.guitar.m4a").read_bytes() == b"guitar"  # unchanged copy
    assert manifest["pairs"] == []
    assert sorted(p.name for p in (session / "other").iterdir()) == ["window.other.m4a"]


def test_overlap_names_the_extra_that_replays_the_learners_part(tmp_path: Path) -> None:
    """A fallback target from another model: the run's "other" still holds the learner's keys."""
    from stage_separation import encode

    rng = np.random.default_rng(0)
    seconds = 2
    t = np.arange(seconds * 44100) / 44100
    chord = sum(0.1 * np.sin(2 * np.pi * hz * t) for hz in (262, 330, 392))
    keys = np.repeat(np.asarray(chord)[:, None], 2, axis=1).astype(np.float32)
    parts = {
        "piano": keys,
        "drums": (0.2 * rng.standard_normal(keys.shape)).astype(np.float32),
        "other": (0.8 * keys + 0.05 * rng.standard_normal(keys.shape)).astype(np.float32),
    }
    (tmp_path / "stems").mkdir()
    for name, audio in parts.items():
        wav = tmp_path / f"{name}.wav"
        sf.write(str(wav), audio, 44100, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
        encode.encode_aac(wav, tmp_path / "stems" / f"{name}.m4a")
    stems = contracts.Stems.model_validate(
        {
            **HEADER,
            "artefact": "stems",
            "stems": [
                stem("piano", "isolated", "piano"),
                stem("drums", "isolated", "drums"),
                stem("other", "isolated", "other"),
                stem("mix_minus_piano", "mix_minus", None),
            ],
            "alignment_offset_samples": 0,
            "mix_gain_db": 0.0,
        }
    )
    separation = contracts.Separation.model_validate(
        {
            **HEADER,
            "artefact": "separation",
            "target": "piano",
            "provider": "bs_roformer:BS-Roformer-SW",
            "mix_minus": "subtract",
            "device": "cpu",
            "stems": [
                {
                    "name": name,
                    "instrument": name,
                    "role": "target" if name == "piano" else "extra",
                    "file": f"{'ab' * 16}/{name}.flac",
                    "sha256": "0" * 64,
                    "frames": seconds * 44100,
                }
                for name in parts
            ],
            "failed_attempts": [],
        }
    )
    presence = contracts.Presence.model_validate(
        {**HEADER, "artefact": "presence", "instruments": []}
    )
    run = all_stems.Pass(separation, stems, presence, 1.0, 1.0, 0)
    name, score = all_stems.overlap(run, tmp_path).split()
    assert name == "other"
    assert float(score) > 0.9
    assert abs(all_stems.correlation(parts["piano"], parts["drums"])) < 0.05
    assert all_stems.correlation(parts["piano"], np.zeros_like(keys)) == 0.0


def test_export_never_overwrites_a_session(tmp_path: Path) -> None:
    fake_run(tmp_path, "t")
    (tmp_path / "listening" / "s1").mkdir(parents=True)
    with pytest.raises(SystemExit):
        all_stems.main(["--root", str(tmp_path), "export", "--tag", "t", "--session", "s1"])
