from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pytest
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
import yaml
from pydantic import ValidationError
from splitune_eval import cli, formats, scoring
from splitune_eval.codec import simulate
from splitune_eval.registry import TestSet, all_sets, load_set
from splitune_eval.tasks import score


def test_registered_sets_declare_licence_and_provenance() -> None:
    sets = all_sets()
    assert sets
    for tset in sets:
        assert tset.licence
        assert tset.provenance


def test_set_without_provenance_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "bad.yaml"
    path.write_text(
        yaml.safe_dump(
            {
                "id": "bad",
                "description": "x",
                "licence": "CC-BY-4.0",
                "root": str(tmp_path),
                "tasks": ["beats"],
                "items": [{"id": "a"}],
            }
        )
    )
    with pytest.raises(ValidationError, match="provenance"):
        load_set(str(path))


def write_set(tmp_path: Path, tasks: list[str], items: list[dict[str, Any]]) -> TestSet:
    path = tmp_path / "set.yaml"
    path.write_text(
        yaml.safe_dump(
            {
                "id": "tiny",
                "description": "synthetic",
                "licence": "owned",
                "provenance": "generated",
                "root": str(tmp_path),
                "tasks": tasks,
                "items": items,
            }
        )
    )
    return load_set(str(path))


def test_item_template_expands_glob_and_regex(tmp_path: Path) -> None:
    (tmp_path / "annotation").mkdir()
    for stem in ("00_Rock1-90_comp", "00_Rock2-90_comp", "01_Rock1-90_solo"):
        (tmp_path / "annotation" / f"{stem}.jams").write_text("{}")
    path = tmp_path / "t.yaml"
    path.write_text(
        yaml.safe_dump(
            {
                "id": "t",
                "description": "x",
                "licence": "l",
                "provenance": "p",
                "root": str(tmp_path),
                "tasks": ["beats"],
                "item_template": {
                    "glob": "annotation/*.jams",
                    "match": "^0[0-1]_[A-Za-z]+1-",
                    "audio": "a/{stem}.wav",
                    "annotations": {"beats": "annotation/{stem}.jams"},
                    "tags": {"style": "{suffix}"},
                },
            }
        )
    )
    items = load_set(str(path)).resolved_items()
    assert [(i.id, i.audio, i.tags["style"]) for i in items] == [
        ("00_Rock1-90_comp", "a/00_Rock1-90_comp.wav", "comp"),
        ("01_Rock1-90_solo", "a/01_Rock1-90_solo.wav", "solo"),
    ]


def test_beats_scoring_end_to_end(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    ref = [6.0 + 0.5 * i for i in range(40)]
    (tmp_path / "a.txt").write_text("\n".join(f"{t} {i % 4 + 1}" for i, t in enumerate(ref)))
    tset = write_set(
        tmp_path, ["beats"], [{"id": "a", "annotations": {"beats": "a.txt"}, "tags": {"k": "v"}}]
    )
    pred = tmp_path / "pred"
    pred.mkdir()
    beats_fixture = json.loads(
        (Path(__file__).resolve().parents[4] / "packages/contracts/fixtures/beats.json").read_text()
    )
    beats_fixture["beats"] = [
        {
            "id": f"b{i:04d}",
            "t": t + 0.02,
            "activation": 1.0,
            "is_downbeat": i % 4 == 0,
            "bar_index": i // 4,
            "beat_in_bar": i % 4 + 1,
        }
        for i, t in enumerate(ref[:30])
    ]
    (pred / "a.beats.json").write_text(json.dumps(beats_fixture))
    result = score("beats", tset, pred)
    metrics = result.items[0].metrics
    assert metrics["F-measure"] == pytest.approx(2 * 30 / 70)
    assert metrics["Downbeat F-measure"] == pytest.approx(2 * 8 / 18)
    assert "±70 ms" in result.variant
    assert result.model_refs[0]["model_id"] == "beat_this/final0"

    report = tmp_path / "out" / "r.md"
    assert (
        cli.main(
            [
                "score",
                "--task",
                "beats",
                "--set",
                str(tmp_path / "set.yaml"),
                "--pred",
                str(pred),
                "--report",
                str(report),
            ]
        )
        == 0
    )
    text = report.read_text()
    assert "Metric variant: mir_eval" in text
    assert "beat_this/final0@1.1.0" in text
    assert "| k=v |" in text
    assert "Git: `" in text
    assert report.with_suffix(".csv").read_text().startswith("item,k,")
    assert "F-measure" in capsys.readouterr().out


def test_notes_chords_melody_metrics(tmp_path: Path) -> None:
    ref = formats.NoteEvents(
        np.array([[0.0, 0.5], [0.5, 1.0], [1.0, 2.0]]), np.array([60.0, 62.0, 64.0])
    )
    est = formats.NoteEvents(
        np.array([[0.02, 0.5], [0.5, 0.6], [1.5, 2.0]]), np.array([60.0, 62.0, 64.0])
    )
    notes, variant = scoring.notes(ref, est)
    assert notes["onset_f1"] == pytest.approx(2 / 3)
    assert notes["onset_offset_f1"] == pytest.approx(1 / 3)
    assert "±50 ms" in variant

    (tmp_path / "ref.lab").write_text("0 2 C:maj\n2 4 A:min\n")
    (tmp_path / "est.lab").write_text("0 2 C:maj\n2 4 A:min7\n")
    chords, _ = scoring.chords(
        formats.chords(tmp_path / "ref.lab"), formats.chords(tmp_path / "est.lab")
    )
    assert chords["majmin"] == pytest.approx(1.0)
    assert chords["sevenths"] == pytest.approx(0.5)

    t = np.arange(0, 2, 0.01)
    hz = np.where(t < 1, 220.0, 0.0)
    (tmp_path / "ref.csv").write_text("\n".join(f"{a},{b}" for a, b in zip(t, hz, strict=True)))
    melody, _ = scoring.melody(
        formats.melody(tmp_path / "ref.csv"), formats.melody(tmp_path / "ref.csv")
    )
    assert melody["Raw Pitch Accuracy"] == pytest.approx(1.0)


def test_sdr(tmp_path: Path) -> None:
    rng = np.random.default_rng(0)
    ref = rng.normal(0, 1, (44100 * 3, 2))
    est = ref + rng.normal(0, 0.1, ref.shape)
    assert scoring.usdr(ref, est) == pytest.approx(20.0, abs=0.3)
    stems = tmp_path / "refs" / "a"
    stems.mkdir(parents=True)
    sf.write(str(stems / "guitar.wav"), ref, 44100, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    (tmp_path / "pred" / "a").mkdir(parents=True)
    sf.write(str(tmp_path / "pred" / "a" / "guitar.wav"), est, 44100, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    tset = write_set(tmp_path, ["sep"], [{"id": "a", "annotations": {"sep": "refs/a"}}])
    result = score("sep", tset, tmp_path / "pred", chunked_sdr=True)
    assert result.items[0].metrics["guitar_usdr"] == pytest.approx(20.0, abs=0.3)
    assert result.items[0].metrics["guitar_csdr"] == pytest.approx(20.0, abs=1.0)
    assert "uSDR" in result.variant
    assert "cSDR" in result.variant


@pytest.mark.parametrize("codec", ["aac", "opus"])
def test_codec_round_trip_is_normalised(codec: str, click_track: Any, tmp_path: Path) -> None:
    import pyloudnorm  # pyright: ignore[reportMissingTypeStubs]

    out = simulate(click_track(seconds=6), tmp_path / f"out-{codec}.wav", codec)  # pyright: ignore[reportArgumentType]
    audio, rate = sf.read(str(out), always_2d=True)  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]
    assert rate == 44100
    assert audio.shape[1] == 2
    loudness = pyloudnorm.Meter(44100).integrated_loudness(audio)  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType, reportUnknownVariableType]
    assert loudness == pytest.approx(-14.0, abs=0.2)
    assert abs(len(audio) / 44100 - 6) < 0.1  # pyright: ignore[reportUnknownArgumentType]
