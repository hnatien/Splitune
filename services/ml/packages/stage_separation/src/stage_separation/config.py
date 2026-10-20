"""The separation model map (`services/ml/config/separation.personal.yaml`; ML_SEPARATION_CONFIG
overrides the path)."""

from __future__ import annotations

import os
from functools import cache
from pathlib import Path
from typing import Literal, Self

import yaml
from pydantic import BaseModel, Field, model_validator
from splitune_ml_core.errors import StageError
from splitune_ml_core.paths import ML_ROOT

DEFAULT_PATH = ML_ROOT / "config" / "separation.personal.yaml"

Instrument = Literal["guitar", "bass", "piano", "drums", "vocals", "other"]


class ModelSpec(BaseModel):
    record: str  # compliance/register/models/<id>.yaml
    filename: str  # audio-separator model filename
    provider: str  # contracts Stem.provider
    outputs: dict[str, Instrument | None]  # model stem name -> instrument; None = complement


class InstrumentSpec(BaseModel):
    chain: list[str] = Field(min_length=1)
    mix_minus: Literal["subtract", "complement"]
    quality: Literal["good", "rough"]


class SeparationConfig(BaseModel):
    version: int
    models: dict[str, ModelSpec]
    instruments: dict[Instrument, InstrumentSpec]
    keep: list[Instrument]
    keep_min_prob: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def _chains_are_usable(self) -> Self:
        for name, spec in self.instruments.items():
            for model in spec.chain:
                if model not in self.models:
                    raise ValueError(f"{name}: unknown model {model}")
                outputs = self.models[model].outputs
                if name not in outputs.values():
                    raise ValueError(f"{name}: {model} has no {name} output")
                if spec.mix_minus == "complement" and len(outputs) < 2:
                    raise ValueError(f"{name}: {model} has no complement")
        return self


def path() -> Path:
    override = os.environ.get("ML_SEPARATION_CONFIG")
    return Path(override).expanduser() if override else DEFAULT_PATH


@cache
def load(source: Path | None = None) -> SeparationConfig:
    file = source or path()
    if not file.is_file():
        raise StageError("separation_config_missing", retry=False)
    return SeparationConfig.model_validate(yaml.safe_load(file.read_text(encoding="utf-8")))
