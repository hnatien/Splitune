"""`chords` stage end to end on synthetic triads, with drums/bass stems for fusion (real models)."""

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
from stage_chords import stage

RATE = 44100
AUDIO_HASH = "cd" * 32
RUN = "c0" * 8
BAR_S = 2.0
# C - Am - F - G, two bars each: (root pc, triad intervals)
PROGRESSION = [(0, (0, 4, 7)), (9, (0, 3, 7)), (5, (0, 4, 7)), (7, (0, 4, 7))] * 2
EXPECTED = ["C:maj", "A:min", "F:maj", "G:maj"]


def tone(hz: float, seconds: float) -> NDArray[np.float64]:
    t = np.arange(int(seconds * RATE)) / RATE
    return np.asarray(
        sum(np.sin(2 * np.pi * hz * h * t) / h for h in range(1, 5)) * np.exp(-1.5 * t)
    )


def render() -> tuple[NDArray[np.float32], NDArray[np.float32], NDArray[np.float32]]:
    n = int(len(PROGRESSION) * BAR_S * RATE)
    harmony, bass, drums = np.zeros(n), np.zeros(n), np.zeros(n)
    rng = np.random.default_rng(3)
    for k, (root, triad) in enumerate(PROGRESSION):
        start = int(k * BAR_S * RATE)
        for interval in triad:
            hz = 261.63 * 2 ** ((root + interval) / 12)
            seg = tone(hz, BAR_S)
            harmony[start : start + len(seg)] += seg
        b = tone(65.41 * 2 ** (root / 12), BAR_S)
        bass[start : start + len(b)] += b
        for beat in range(4):
            hit = int(start + beat * BAR_S / 4 * RATE)
            noise = rng.standard_normal(2000) * np.exp(-np.arange(2000) / 300)
            drums[hit : hit + 2000] += noise
    peak = max(np.abs(harmony).max(), np.abs(bass).max(), np.abs(drums).max())
    return (
        (0.2 * harmony / peak).astype(np.float32),
        (0.2 * bass / peak).astype(np.float32),
        (0.2 * drums / peak).astype(np.float32),
    )


def stereo(path: Path, mono: NDArray[np.float32]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), np.stack([mono, mono], axis=1), RATE, subtype="PCM_24")  # pyright: ignore[reportUnknownMemberType]
    return path


def header(artefact: str, duration: float) -> dict[str, Any]:
    return {
        "schema_version": contracts.SCHEMA_VERSION,
        "artefact": artefact,
        "artefact_version": 1,
        "analysis_id": str(uuid.uuid4()),
        "user_id": "u1",
        "audio_hash": AUDIO_HASH,
        "sample_rate": 44100,
        "duration_s": duration,
        "models": [],
        "params": {},
        "created_at": "2026-10-21T00:00:00Z",
    }


def inputs(tmp: Path, bass: NDArray[np.float32], drums: NDArray[np.float32]) -> dict[str, str]:
    duration = len(bass) / RATE
    beat_s = BAR_S / 4
    times = np.arange(0, duration - 1e-6, beat_s)
    beats = {
        **header("beats", duration),
        "beats": [
            {
                "id": f"b{i:04d}",
                "t": round(float(t), 3),
                "activation": 0.9,
                "is_downbeat": i % 4 == 0,
                "bar_index": i // 4,
                "beat_in_bar": i % 4 + 1,
            }
            for i, t in enumerate(times)
        ],
        "bpm": 60 / beat_s,
        "meter": {"numerator": 4, "denominator": 4},
        "tempo_octave_ambiguous": False,
        "first_downbeat_t": 0.0,
    }
    stems: list[dict[str, Any]] = []
    for name, audio in (("drums", drums), ("bass", bass)):
        path = stereo(tmp / "cache" / "separated" / RUN / f"{name}.flac", audio)
        stems.append(
            {
                "name": name,
                "instrument": name,
                "role": "extra",
                "file": f"{RUN}/{name}.flac",
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "frames": len(audio),
            }
        )
    separation = {
        **header("separation", duration),
        "target": "guitar",
        "provider": "htdemucs_6s",
        "mix_minus": "subtract",
        "device": "cpu",
        "stems": stems,
        "failed_attempts": [],
    }
    out: dict[str, str] = {}
    for name, doc in (("beats", beats), ("separation", separation)):
        path = tmp / "inputs" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(doc), encoding="utf-8")
        out[name] = str(path)
    return out


def run(tmp: Path, params: dict[str, Any]) -> contracts.Chords:
    harmony, bass, drums = render()
    decoded = stereo(tmp / "decoded.flac", harmony + bass + drums)
    ins = inputs(tmp, bass, drums)
    description = stage.describe(params, ins)
    out = stage.run(
        StageJob(
            stage="chords",
            analysis_id=str(uuid.uuid4()),
            user_id="u1",
            artefact_version=1,
            params=description.params,
            inputs=ins,
            workdir=str(tmp),
            cache_dir=str(tmp / "cache"),
            audio_hash=AUDIO_HASH,
            duration_s=len(harmony) / RATE,
            decoded_path=str(decoded),
        )
    )
    return contracts.Chords.model_validate_json(Path(out.files["chords"]).read_text())


def majority_label(chords: contracts.Chords, t0: float, t1: float) -> str:
    overlap: dict[str, float] = {}
    for s in chords.segments:
        d = min(s.t1, t1) - max(s.t0, t0)
        if d > 0:
            triad = s.label.split(":")[0] + (":min" if "min" in s.label else ":maj")
            overlap[triad] = overlap.get(triad, 0.0) + d
    return max(overlap, key=lambda k: overlap[k])


@pytest.mark.models
@pytest.mark.parametrize(
    ("recognizer", "vocabulary"),
    [("consonance_ace", "sevenths"), ("btc", "sevenths"), ("madmom_cnn", "majmin")],
)
def test_recognizes_a_progression_with_fusion(
    tmp_path: Path, recognizer: str, vocabulary: str
) -> None:
    chords = run(
        tmp_path,
        {
            "recognizer": recognizer,
            "vocabulary": vocabulary,
            "inputs": ["mixture", "no_drums"],
            "key": "music_core",
        },
    )
    assert chords.vocabulary == vocabulary
    assert chords.inputs_fused == ["mixture", "no_drums", "bass_root"]
    assert all(s.beat_aligned for s in chords.segments)
    assert chords.segments[0].t0 == 0.0
    assert chords.segments[-1].t1 == pytest.approx(len(PROGRESSION) * BAR_S, abs=0.01)
    found = [majority_label(chords, k * BAR_S + 0.3, (k + 1) * BAR_S - 0.3) for k in range(4)]
    assert sum(f == e for f, e in zip(found, EXPECTED, strict=True)) >= 3, found
    assert all(1 <= len(s.top_k) <= 5 and 0 <= s.confidence <= 1 for s in chords.segments)
    assert (chords.key.tonic, chords.key.mode) in {("C", "major"), ("A", "minor")}


@pytest.mark.models
def test_madmom_key_and_mixture_only(tmp_path: Path) -> None:
    chords = run(
        tmp_path,
        {"recognizer": "btc", "inputs": ["mixture"], "bass_root_weight": 0, "key": "madmom_cnn"},
    )
    assert chords.inputs_fused == ["mixture"]
    assert [m.model_id for m in chords.models] == ["btc/large_voca", "madmom/key_cnn"]
    assert chords.key.mode in {"major", "minor"}


def test_rejects_unsupported_combinations() -> None:
    with pytest.raises(StageError):
        stage.effective_params({"recognizer": "madmom_cnn", "vocabulary": "sevenths"})
    with pytest.raises(StageError):
        stage.effective_params({"recognizer": "nope"})
