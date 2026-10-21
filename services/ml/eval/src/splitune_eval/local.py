"""The shipped stages run in-process on local files, the way the worker's islands run them
(08 §1: "we test what we ship"): decode → beats, a `separation.json` over given stem files, then
`notes.<instrument>` / `chords`. Used by the P2 and P6 scripts."""

from __future__ import annotations

import hashlib
import importlib
import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from splitune_ml_core import contracts
from splitune_ml_core.stage_api import StageJob, StageOutput
from splitune_ml_core.stages import STAGES

ANALYSIS = "00000000-0000-0000-0000-000000000000"
USER = "eval"
RATE = 44100


@dataclass(frozen=True)
class Decoded:
    audio_hash: str
    duration_s: float
    path: str
    frames: int


class LocalRun:
    """One work directory with the worker's cache layout (`decoded/`, `separated/`)."""

    def __init__(self, work: Path) -> None:
        self.work = work
        self.cache = work / "cache"
        self.cache.mkdir(parents=True, exist_ok=True)

    def job(
        self, stage: str, params: dict[str, Any], inputs: dict[str, str], d: Decoded | None
    ) -> StageJob:
        workdir = self.work / "jobs" / stage
        shutil.rmtree(workdir, ignore_errors=True)
        workdir.mkdir(parents=True)
        return StageJob(
            stage=stage,
            analysis_id=ANALYSIS,
            user_id=USER,
            artefact_version=1,
            params=params,
            inputs=inputs,
            workdir=str(workdir),
            cache_dir=str(self.cache),
            audio_hash=d.audio_hash if d else None,
            duration_s=d.duration_s if d else None,
            decoded_path=d.path if d else None,
        )

    def run(
        self,
        stage: str,
        inputs: dict[str, str],
        d: Decoded | None,
        params: dict[str, Any] | None = None,
    ) -> StageOutput:
        module = importlib.import_module(STAGES[stage].module)
        description = module.describe(params or {}, inputs)
        return module.run(self.job(stage, description.params, inputs, d))

    def decode(self, source: Path) -> Decoded:
        out = self.run("decode", {"source": str(source)}, None)
        return Decoded(
            audio_hash=str(out.facts["audio_hash"]),
            duration_s=float(out.facts["duration_s"]),
            path=str(out.facts["decoded_path"]),
            frames=int(sf.info(str(out.facts["decoded_path"])).frames),  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]
        )

    def keep(self, out: StageOutput, name: str, dest: Path) -> Path:
        """Copies a stage output out of its (reused) job directory."""
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(out.files[name], dest)
        return dest

    def separation(
        self, d: Decoded, stems: dict[str, Path], target: str, provider: str, dest: Path
    ) -> Path:
        """separation.json over separated stem files (instrument → wav), as `separate` writes it:
        raw stems as 24-bit FLAC under cache/separated/<run>/, the target first."""
        run = hashlib.sha256(f"{d.audio_hash}:{provider}".encode()).hexdigest()[:32]
        entries: list[dict[str, Any]] = []
        for instrument, path in stems.items():
            audio, rate = sf.read(str(path), dtype="float32", always_2d=True)
            if rate != RATE:
                raise ValueError(f"{path} is not {RATE} Hz")
            audio = np.asarray(audio, dtype=np.float32)
            if audio.shape[1] == 1:
                audio = np.repeat(audio, 2, axis=1)
            audio = np.pad(audio, ((0, max(0, d.frames - len(audio))), (0, 0)))[: d.frames]
            flac = self.cache / "separated" / run / f"{instrument}.flac"
            flac.parent.mkdir(parents=True, exist_ok=True)
            sf.write(str(flac), audio, RATE, subtype="PCM_24")  # pyright: ignore[reportUnknownMemberType]
            entries.append(
                {
                    "name": instrument,
                    "instrument": instrument,
                    "role": "target" if instrument == target else "extra",
                    "file": f"{run}/{instrument}.flac",
                    "sha256": hashlib.sha256(flac.read_bytes()).hexdigest(),
                    "frames": d.frames,
                }
            )
        entries.sort(key=lambda e: e["role"] != "target")
        document = contracts.Separation.model_validate(
            {
                "schema_version": contracts.SCHEMA_VERSION,
                "artefact": "separation",
                "artefact_version": 1,
                "analysis_id": ANALYSIS,
                "user_id": USER,
                "audio_hash": d.audio_hash,
                "sample_rate": RATE,
                "duration_s": d.duration_s,
                "models": [],
                "params": {"provider": provider},
                "created_at": "2026-10-21T00:00:00Z",
                "target": target,
                "provider": provider,
                "mix_minus": "subtract",
                "device": "mps",
                "stems": entries,
                "failed_attempts": [],
            }
        )
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(contracts.dump_json(document), encoding="utf-8")
        return dest


def write_json(path: Path, document: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
