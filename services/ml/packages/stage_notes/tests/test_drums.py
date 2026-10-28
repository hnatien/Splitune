"""`notes.drums`: kit-piece defaults, ADTOF front end and peak picking, the stage's contract."""

from __future__ import annotations

import hashlib
import json
import uuid
from pathlib import Path
from typing import Any

import numpy as np
import pytest
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from splitune_ml_core import contracts, register
from splitune_ml_core.stage_api import StageJob
from splitune_ml_core.stages import STAGES
from stage_notes import adtof, drum_kit, drums, transcribers

RATE = 44100
AUDIO_HASH = "cd" * 32


def test_every_kit_key_has_a_class_and_hand_percussion_has_none() -> None:
    assert drum_kit.class_of(36) == "kick"
    assert drum_kit.class_of(37) == "snare"
    assert drum_kit.class_of(46) == "hihat"
    assert drum_kit.class_of(43) == "toms"
    assert drum_kit.class_of(53) == "cymbals"
    assert drum_kit.class_of(54) is None  # tambourine
    assert drum_kit.class_of(56) is None  # cowbell
    assert set(drum_kit.KIT_PIECE) <= set(drum_kit.GM_CLASS)


def test_five_class_guesses_are_flagged_and_crashes_follow_downbeats_after_a_gap() -> None:
    downbeats = [0.0, 2.0, 4.0]
    hits: list[tuple[float, drum_kit.Class5]] = [
        (0.0, "kick"),
        (0.0, "cymbals"),  # downbeat, first cymbal → crash
        (0.5, "cymbals"),  # 0.5 s later → ride
        (1.0, "snare"),
        (1.0, "hihat"),
        (1.5, "toms"),
        (2.0, "cymbals"),  # downbeat but only 1.5 s after... still ≥ 1 s gap → crash
        (2.5, "cymbals"),  # off the downbeat → ride
        (4.0, "cymbals"),  # downbeat, 1.5 s gap → crash
    ]
    choices = drum_kit.default_choices(hits, downbeats, gap_s=1.0)
    assert [c.gm_note for c in choices] == [36, 49, 51, 38, 42, 47, 49, 51, 49]
    assert [c.approximate for c in choices] == [
        False,
        True,
        True,
        False,
        True,
        True,
        True,
        True,
        True,
    ]


def test_without_beats_a_cymbal_after_a_gap_is_a_crash() -> None:
    hits: list[tuple[float, drum_kit.Class5]] = [
        (0.3, "cymbals"),
        (0.6, "cymbals"),
        (3.1, "cymbals"),
    ]
    choices = drum_kit.default_choices(hits, None, gap_s=1.0)
    assert [c.gm_note for c in choices] == [49, 51, 49]


def test_front_end_has_adtof_shape() -> None:
    # 12 bands/octave over 20 Hz-20 kHz with unique FFT bins: ADTOF's 84 filters.
    assert adtof.filterbank().shape == (84, 1024)
    spec = adtof.features(np.zeros(RATE, dtype=np.float32))
    assert spec.shape == (101, 84)  # centered frames at 100 fps
    assert float(spec.max()) == 0.0


def test_peak_picking_thresholds_and_merges_close_peaks() -> None:
    act = np.zeros(200, dtype=np.float32)
    act[20] = 0.9
    act[22] = 0.7  # within `combine` (20 ms) of the stronger peak → merged
    act[100] = 0.5
    act[150] = 0.1  # below the threshold
    found = adtof.peaks(act, 0.3, adtof.ADTOF_DEFAULTS)
    assert found == [20, 100]


def test_input_level_is_set_by_rms_and_silence_stays_silent() -> None:
    tone = (0.01 * np.sin(np.linspace(0, 200 * np.pi, RATE))).astype(np.float32)
    louder = adtof.at_rms(tone, -17.0)
    assert 20 * np.log10(np.sqrt(np.mean(np.square(louder)))) == pytest.approx(-17.0, abs=0.01)
    silence = np.zeros(RATE, dtype=np.float32)
    assert not adtof.at_rms(silence, -17.0).any()


def test_raw_confidence_is_the_peak_or_its_margin_over_the_threshold() -> None:
    assert adtof.raw_confidence(0.6, 0.2, "height") == 0.6
    assert adtof.raw_confidence(0.6, 0.2, "margin") == pytest.approx(0.5)
    assert adtof.raw_confidence(0.2, 0.2, "margin") == 0.0


def test_drums_stage_spec_runs_in_the_torch_island_and_reads_beats() -> None:
    spec = STAGES["notes.drums"]
    assert spec.module == "stage_notes.drums"
    assert (spec.island, spec.slot) == ("torch", "gpu")
    assert spec.outputs == {"notes": "notes.drums"}
    assert spec.optional_downloads == ("separation", "stems", "beats")


def write_stereo(path: Path, mono: np.ndarray[Any, Any]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), np.stack([mono, mono], axis=1), RATE, subtype="PCM_24")  # pyright: ignore[reportUnknownMemberType]
    return path


def groove(seconds: float = 8.0, bpm: float = 120.0) -> tuple[np.ndarray[Any, Any], list[float]]:
    """Kick on 1 and 3: a decaying 55 Hz thump with a click. Returns audio and kick times."""
    beat = 60.0 / bpm
    audio = np.zeros(int(seconds * RATE), dtype=np.float32)
    t = np.arange(int(0.25 * RATE)) / RATE
    kick = (np.sin(2 * np.pi * 55 * t) * np.exp(-t / 0.08)).astype(np.float32)
    kick[:64] += np.random.default_rng(1).standard_normal(64).astype(np.float32) * 0.5
    times = [0.5 + b * beat for b in range(0, int(seconds / beat) - 1, 2)]
    for onset in times:
        i = int(onset * RATE)
        audio[i : i + len(kick)] += kick[: len(audio) - i]
    return 0.8 * audio, times


def separation_doc(tmp: Path, mono: np.ndarray[Any, Any]) -> Path:
    raw = write_stereo(tmp / "cache" / "separated" / ("b2" * 8) / "drums.flac", mono)
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
        "created_at": "2026-10-28T00:00:00Z",
        "target": "drums",
        "provider": "bs_roformer_sw",
        "mix_minus": "subtract",
        "device": "cpu",
        "stems": [
            {
                "name": "drums",
                "instrument": "drums",
                "role": "target",
                "file": f"{'b2' * 8}/drums.flac",
                "sha256": hashlib.sha256(raw.read_bytes()).hexdigest(),
                "frames": len(mono),
            }
        ],
        "failed_attempts": [],
    }
    path = tmp / "inputs" / "separation"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc), encoding="utf-8")
    return path


def job(tmp: Path, inputs: dict[str, str], decoded: Path, frames: int) -> StageJob:
    return StageJob(
        stage="notes.drums",
        analysis_id=str(uuid.uuid4()),
        user_id="u1",
        artefact_version=1,
        params=drums.describe({}, inputs).params,
        inputs=inputs,
        workdir=str(tmp),
        cache_dir=str(tmp / "cache"),
        audio_hash=AUDIO_HASH,
        duration_s=frames / RATE,
        decoded_path=str(decoded),
    )


@pytest.mark.models
def test_drum_hits_from_the_stem_and_the_mixture_fallback(tmp_path: Path) -> None:
    try:
        register.verify(register.model("adtof-frame-rnn"), transcribers.models_dir() / "adtof")
    except Exception:
        pytest.skip("ADTOF weights not installed (scripts/fetch_models.py adtof)")
    audio, kicks = groove()
    decoded = write_stereo(tmp_path / "decoded.flac", audio)
    inputs = {"separation": str(separation_doc(tmp_path, audio))}
    out = drums.run(job(tmp_path, inputs, decoded, len(audio)))
    assert out.status == "done"
    document = contracts.DrumNotes.model_validate_json(Path(out.files["notes"]).read_text())
    assert document.models[0].model_id == "adtof/frame_rnn_adtof_all"
    found = [h.onset_s for h in document.hits if h.class5 == "kick"]
    assert all(any(abs(f - k) <= 0.03 for f in found) for k in kicks)
    assert all(h.approximate == (h.class5 in ("hihat", "toms", "cymbals")) for h in document.hits)
    assert document.params["source"] != "mixture"
    (tmp_path / "mix").mkdir()
    fallback = drums.run(job(tmp_path / "mix", {}, decoded, len(audio)))
    assert (fallback.status, fallback.fallback_reason) == ("fallback", "notes_on_mixture")
