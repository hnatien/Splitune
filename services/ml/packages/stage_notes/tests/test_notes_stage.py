"""`notes.<instrument>` stage: source selection, calibration, contract output."""

from __future__ import annotations

import hashlib
import json
import uuid
from pathlib import Path
from typing import Any

import numpy as np
import pytest
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from splitune_ml_core import calibration, contracts, register
from splitune_ml_core.stage_api import StageJob
from splitune_ml_core.stages import STAGES
from stage_notes import bass, guitar, piano, transcribers

from .synth import PHRASE, phrase

RATE = 44100
AUDIO_HASH = "ab" * 32


@pytest.fixture(autouse=True)
def _weights() -> None:
    try:
        register.verify(register.model("basic-pitch"), transcribers.models_dir() / "basic-pitch")
    except Exception:
        pytest.skip("nmp.onnx not installed (scripts/fetch_models.py basic-pitch)")


def write_stereo(path: Path, mono: np.ndarray[Any, Any]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), np.stack([mono, mono], axis=1), RATE, subtype="PCM_24")  # pyright: ignore[reportUnknownMemberType]
    return path


def separation(
    tmp: Path,
    cache: Path,
    instrument: str,
    mono: np.ndarray[Any, Any],
    solo_bypass: dict[str, Any] | None = None,
) -> Path:
    raw = write_stereo(cache / "separated" / ("a1" * 8) / f"{instrument}.flac", mono)
    doc: dict[str, Any] = {
        "schema_version": contracts.SCHEMA_VERSION,
        "artefact": "separation",
        "artefact_version": 1,
        "analysis_id": str(uuid.uuid4()),
        "user_id": "u1",
        "audio_hash": AUDIO_HASH,
        "sample_rate": 44100,
        "duration_s": len(mono) / RATE,
        "models": [],
        "params": {},
        "created_at": "2026-10-21T00:00:00Z",
        "target": instrument,
        "provider": "htdemucs_6s",
        "mix_minus": "subtract",
        "device": "cpu",
        "stems": [
            {
                "name": instrument,
                "instrument": instrument,
                "role": "target",
                "file": f"{'a1' * 8}/{instrument}.flac",
                "sha256": hashlib.sha256(raw.read_bytes()).hexdigest(),
                "frames": len(mono),
            }
        ],
        "failed_attempts": [],
    }
    if solo_bypass is not None:
        doc["solo_bypass"] = solo_bypass
    path = tmp / "inputs" / "separation"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc), encoding="utf-8")
    return path


def job(tmp: Path, module: Any, inputs: dict[str, str], decoded: Path, frames: int) -> StageJob:
    description = module.describe({}, inputs)
    return StageJob(
        stage="notes.x",
        analysis_id=str(uuid.uuid4()),
        user_id="u1",
        artefact_version=1,
        params=description.params,
        inputs=inputs,
        workdir=str(tmp),
        cache_dir=str(tmp / "cache"),
        audio_hash=AUDIO_HASH,
        duration_s=frames / RATE,
        decoded_path=str(decoded),
    )


def test_guitar_notes_from_the_isolated_stem(tmp_path: Path) -> None:
    stem = phrase(RATE)
    noise = 0.05 * np.random.default_rng(0).standard_normal(len(stem)).astype(np.float32)
    decoded = write_stereo(tmp_path / "decoded.flac", stem + noise)
    inputs = {"separation": str(separation(tmp_path, tmp_path / "cache", "guitar", stem))}
    out = guitar.run(job(tmp_path, guitar, inputs, decoded, len(stem)))
    assert out.status == "done"
    notes = contracts.Notes.model_validate_json(Path(out.files["notes"]).read_text())
    assert notes.artefact == "notes.guitar"
    assert notes.models[0].model_id == "basic_pitch/icassp_2022"
    pitches = {n.pitch_midi for n in notes.notes}
    assert {45, 52, 57, 60, 64} <= pitches
    assert all(n.stem_id == "guitar" for n in notes.notes)
    assert all(n.low_band_energy is None for n in notes.notes)
    assert [n.id for n in notes.notes] == sorted(n.id for n in notes.notes)
    assert all(0 <= n.confidence <= 1 and n.confidence_raw is not None for n in notes.notes)
    # Identity calibration until P2 fits a table; the bands are recorded for finalize.
    assert notes.params["calibration"]["bands"] == {"high": 0.7, "medium": 0.4}
    assert notes.params["source"] != "mixture"


def test_mixture_fallback_and_bass_low_band_energy(tmp_path: Path) -> None:
    audio = phrase(RATE)
    decoded = write_stereo(tmp_path / "decoded.flac", audio)
    out = bass.run(job(tmp_path, bass, {}, decoded, len(audio)))
    assert (out.status, out.fallback_reason) == ("fallback", "notes_on_mixture")
    notes = contracts.Notes.model_validate_json(Path(out.files["notes"]).read_text())
    assert notes.notes
    assert all(n.stem_id == "mixture" for n in notes.notes)
    assert all(n.low_band_energy is not None for n in notes.notes)
    assert all(n.pitch_midi <= 79 for n in notes.notes)  # 600 Hz ceiling for bass


@pytest.mark.models
def test_piano_notes_from_the_isolated_stem_with_transkun(tmp_path: Path) -> None:
    try:
        register.verify(register.model("transkun-v2"), transcribers.models_dir() / "transkun")
    except Exception:
        pytest.skip("Transkun weights not installed (scripts/fetch_models.py transkun)")
    stem = phrase(RATE)
    decoded = write_stereo(tmp_path / "decoded.flac", stem)
    inputs = {"separation": str(separation(tmp_path, tmp_path / "cache", "piano", stem))}
    out = piano.run(job(tmp_path, piano, inputs, decoded, len(stem)))
    assert out.status == "done"
    notes = contracts.Notes.model_validate_json(Path(out.files["notes"]).read_text())
    assert notes.artefact == "notes.piano"
    assert notes.models[0].model_id == "transkun/2.0"
    # Synthetic plucks, not a piano: most of the phrase is found (accuracy is P2's job, 08).
    assert len({n.pitch_midi for n in notes.notes} & {p for _, _, p in PHRASE}) >= 4
    assert all(21 <= n.pitch_midi <= 108 and n.stem_id == "piano" for n in notes.notes)
    # Per-note scores (onset marginal + velocity peak) through the P2p table, and PM2S hands.
    assert len({n.confidence_raw for n in notes.notes}) > 1
    assert all(0.0 <= (n.confidence_raw or 0.0) <= 1.0 for n in notes.notes)
    assert all(0.0 <= n.confidence <= 1.0 for n in notes.notes)
    assert {n.hand for n in notes.notes} <= {"left", "right"}
    assert None not in {n.hand for n in notes.notes}
    assert notes.sustain is not None
    assert [m.model_id for m in notes.models] == ["transkun/2.0", "pm2s/hand_part"]


def test_calibration_table_is_applied(tmp_path: Path) -> None:
    table = contracts.CalibrationTable(
        model_id="basic-pitch",
        version="0.4.0",
        method="isotonic",
        knots=[(0.0, 0.1), (1.0, 0.3)],
        bands=contracts.Bands(high=0.8, medium=0.5),
    )
    root = tmp_path / "calibration"
    root.mkdir()
    (root / "basic-pitch@0.4.0.guitar.json").write_text(contracts.dump_json(table))
    loaded = calibration.load("basic-pitch", "0.4.0", "guitar", root)
    assert loaded.method == "isotonic"
    assert calibration.calibrate(0.5, loaded) == pytest.approx(0.2)
    assert calibration.calibrate(-1, loaded) == pytest.approx(0.1)
    assert calibration.calibrate(2, loaded) == pytest.approx(0.3)
    # Instrument-specific table wins; other instruments fall back to the shared one or identity.
    assert calibration.load("basic-pitch", "0.4.0", "bass", root).method == "identity"


def test_specs_follow_the_notes_config() -> None:
    for instrument in ("guitar", "bass", "piano", "vocals"):
        spec = STAGES[f"notes.{instrument}"]
        assert spec.module == f"stage_notes.{instrument}"
        # Basic Pitch runs in the CPU slot, Transkun (piano) in the GPU slot.
        placement = ("torch", "gpu") if instrument == "piano" else ("onnx-cpu", "cpu")
        assert (spec.island, spec.slot) == placement
        assert spec.outputs == {"notes": f"notes.{instrument}"}
        assert spec.optional_downloads == ("separation", "stems")


def notes_config(tmp: Path, piano: dict[str, Any]) -> Path:
    base = transcribers.load_config(transcribers.CONFIG_PATH).model_dump()
    base["instruments"]["piano"] = piano
    path = tmp / "notes.yaml"
    path.write_text(json.dumps(base), encoding="utf-8")
    return path


def test_the_mixture_gets_its_own_transcriber_in_the_same_island(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from splitune_ml_core.stages import notes_placement

    config = notes_config(
        tmp_path, {"transcriber": "transkun", "mixture": {"transcriber": "yourmt3"}}
    )
    monkeypatch.setenv("ML_NOTES_CONFIG", str(config))
    transcribers.load_config.cache_clear()
    try:
        assert transcribers.for_instrument("piano")[0].name == "transkun"
        assert transcribers.for_instrument("piano", "mixture")[0].name == "yourmt3"
        assert notes_placement("piano") == ("torch", "gpu")
        config.write_text(
            json.dumps(
                {
                    **json.loads(config.read_text()),
                    "instruments": {
                        "piano": {
                            "transcriber": "transkun",
                            "mixture": {"transcriber": "basic_pitch"},
                        }
                    },
                }
            )
        )
        with pytest.raises(ValueError, match="another island"):
            notes_placement("piano")
    finally:
        transcribers.load_config.cache_clear()


@pytest.mark.models
def test_solo_bypass_transcribes_the_mixture_without_a_fallback(tmp_path: Path) -> None:
    try:
        register.verify(register.model("transkun-v2"), transcribers.models_dir() / "transkun")
    except Exception:
        pytest.skip("Transkun weights not installed (scripts/fetch_models.py transkun)")
    audio = phrase(RATE)
    decoded = write_stereo(tmp_path / "decoded.flac", audio)
    silent = np.zeros_like(audio)  # a stem that lost everything: the bypass must ignore it
    inputs = {
        "separation": str(
            separation(
                tmp_path,
                tmp_path / "cache",
                "piano",
                silent,
                {"rhythm_db": -60.0, "applied": True},
            )
        )
    }
    description = piano.describe({}, inputs)
    assert description.params["source"] == "mixture"
    assert description.params["transcriber"] == "transkun"
    out = piano.run(job(tmp_path, piano, inputs, decoded, len(audio)))
    assert (out.status, out.fallback_reason) == ("done", None)
    notes = contracts.Notes.model_validate_json(Path(out.files["notes"]).read_text())
    assert notes.notes
    assert all(n.stem_id == "mixture" for n in notes.notes)
    assert notes.sustain is not None
