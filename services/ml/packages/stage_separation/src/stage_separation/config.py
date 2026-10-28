"""The separation model map (`services/ml/config/separation.personal.yaml`; ML_SEPARATION_CONFIG
overrides the path)."""

from __future__ import annotations

import os
from functools import cache
from pathlib import Path
from typing import Any, Literal, Self

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator
from splitune_ml_core.errors import StageError
from splitune_ml_core.paths import ML_ROOT

DEFAULT_PATH = ML_ROOT / "config" / "separation.personal.yaml"

Instrument = Literal["guitar", "bass", "piano", "drums", "vocals", "other"]


class MdxcInference(BaseModel):
    """audio-separator `mdxc_params`; unset keys keep the library default."""

    model_config = ConfigDict(extra="forbid")
    # RoFormers: the window step in seconds, capped at the model's chunk length (default 8).
    overlap: float | None = Field(default=None, gt=0)


class DemucsInference(BaseModel):
    """audio-separator `demucs_params`; unset keys keep the library default."""

    model_config = ConfigDict(extra="forbid")
    shifts: int | None = Field(default=None, ge=0)  # random-shift passes averaged (default 2)
    overlap: float | None = Field(default=None, ge=0, lt=1)  # fraction of a segment (0.25)


INFERENCE: dict[str, type[BaseModel]] = {"mdxc": MdxcInference, "demucs": DemucsInference}


class ModelSpec(BaseModel):
    record: str  # compliance/register/models/<id>.yaml
    filename: str  # audio-separator model filename
    provider: str  # contracts Stem.provider
    outputs: dict[str, Instrument | None]  # model stem name -> instrument; None = complement
    arch: Literal["mdxc", "demucs"]  # audio-separator architecture
    inference: dict[str, Any] = Field(default_factory=dict)
    # Models outside audio-separator's catalogue: their YAML next to the weights (MDXC only).
    config: str | None = None

    @model_validator(mode="after")
    def _inference_is_known(self) -> Self:
        self.inference = (
            INFERENCE[self.arch].model_validate(self.inference).model_dump(exclude_none=True)
        )
        return self


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
