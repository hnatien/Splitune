"""Provenance register: `compliance/register/models/<id>.yaml` (doc 09, licence register).

In personal mode the register is a provenance record, not a gate: stages read a model's version,
tier and weights hashes from it and refuse weights whose sha256 differs (09 "Enforcement" §1).
A model made of several files (e.g. the four `htdemucs_ft` bags) lists each file; its
`weights.sha256` is the sha256 of the sorted "<file>:<sha256>" lines (`aggregate_sha256`).
"""

from __future__ import annotations

import hashlib
import os
from functools import cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field

from .errors import StageError
from .paths import REPO_ROOT

REGISTER_DIR = REPO_ROOT / "compliance" / "register"
_SHA256 = r"^[0-9a-f]{64}$"

# Record → directory under ML_MODELS_DIR holding its weights (`scripts/fetch_models.py`). madmom's
# models ship with the package, so they have no entry.
WEIGHTS_DIRS = {
    "basic-pitch": "basic-pitch",
    "btc-large-voca": "btc",
    "consonance-ace": "consonance-ace",
    "transkun-v2": "transkun",
    "pm2s-hand-part": "pm2s",
    "yourmt3-moe": "yourmt3",
    "adtof-frame-rnn": "adtof",
    "panns-cnn14": "panns",
    "bs-roformer-sw": "audio-separator",
    "bs-roformer-viperx-1297": "audio-separator",
    "htdemucs-6s": "audio-separator",
    "htdemucs-ft": "audio-separator",
    "mel-roformer-kim-vocals": "audio-separator",
}


class WeightsFile(BaseModel):
    name: str = Field(min_length=1)
    sha256: str = Field(pattern=_SHA256)
    bytes: int = Field(ge=0)


class Weights(BaseModel):
    licence: str
    url: str
    sha256: str = Field(pattern=_SHA256)
    files: list[WeightsFile] = Field(min_length=1)


class ModelRecord(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]*$")
    kind: Literal["model"]
    name: str
    version: str = Field(min_length=1)
    repo_url: str
    code_spdx: str
    weights: Weights
    tier: Literal["green", "amber", "red"]
    used_in: list[str]


def aggregate_sha256(files: list[WeightsFile]) -> str:
    lines = sorted(f"{f.name}:{f.sha256}" for f in files)
    return hashlib.sha256("\n".join(lines).encode()).hexdigest()


@cache
def model(record_id: str) -> ModelRecord:
    path = REGISTER_DIR / "models" / f"{record_id}.yaml"
    if not path.is_file():
        raise StageError("register_record_missing", retry=False)
    record = ModelRecord.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))
    if record.id != record_id or aggregate_sha256(record.weights.files) != record.weights.sha256:
        raise StageError("register_record_invalid", retry=False)
    return record


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(1 << 20):
            digest.update(chunk)
    return digest.hexdigest()


_verified: dict[tuple[str, int, int], str] = {}


def verify(record: ModelRecord, directory: Path) -> list[Path]:
    """Paths of the record's weight files under `directory`, each checked against its sha256
    (hashes are cached per file size and mtime, so a warm island hashes each file once)."""
    paths: list[Path] = []
    for entry in record.weights.files:
        path = directory / entry.name
        try:
            stat = os.stat(path)
        except FileNotFoundError as exc:
            raise StageError("weights_missing", retry=False) from exc
        key = (str(path), stat.st_size, stat.st_mtime_ns)
        if key not in _verified:
            _verified[key] = file_sha256(path)
        if _verified[key] != entry.sha256:
            raise StageError("weights_mismatch", retry=False)
        paths.append(path)
    return paths


def missing(models_dir: Path) -> list[str]:
    """Records in WEIGHTS_DIRS with a weight file absent or of the wrong size under `models_dir`.
    Sizes only, so it is cheap at worker start; stages still check every sha256 before loading."""
    absent: list[str] = []
    for record_id, subdir in WEIGHTS_DIRS.items():
        for entry in model(record_id).weights.files:
            path = models_dir / subdir / entry.name
            if not path.is_file() or path.stat().st_size != entry.bytes:
                absent.append(record_id)
                break
    return absent
