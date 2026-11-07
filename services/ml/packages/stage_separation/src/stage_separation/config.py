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


class Gain(BaseModel):
    """Pre-separation gain (step 29): the mixture is scaled in float before the model and every
    output by the inverse, so only the level the model sees changes. Either a fixed `db`, or a
    `target_lufs` for the mixture's integrated loudness (BS.1770), applied only when the mixture is
    at least `min_input_lufs` loud (when set)."""

    model_config = ConfigDict(extra="forbid")
    db: float | None = None
    target_lufs: float | None = None
    min_input_lufs: float | None = None

    @model_validator(mode="after")
    def _one_kind(self) -> Self:
        if (self.db is None) == (self.target_lufs is None):
            raise ValueError("gain: set exactly one of db and target_lufs")
        if self.min_input_lufs is not None and self.target_lufs is None:
            raise ValueError("gain: min_input_lufs needs target_lufs")
        return self


class WrapperInference(BaseModel):
    """Settings `models` applies around audio-separator (any architecture); unset = not applied."""

    model_config = ConfigDict(extra="forbid")
    gain: Gain | None = None
    autocast: bool | None = None  # torch autocast around the model (fp16 on CUDA)
    # The model's own rate when it isn't 44.1 kHz: its input is resampled to it and its outputs
    # back to 44.1 kHz.
    sample_rate: Literal[48000] | None = None


class MdxcInference(WrapperInference):
    """audio-separator `mdxc_params`; unset keys keep the library default."""

    # RoFormers: the window step in seconds, capped at the model's chunk length (default 8).
    overlap: float | None = Field(default=None, gt=0)
    # The window length in samples, a multiple of the model's STFT hop (default: the model YAML's
    # inference.dim_t, chunk = hop * (dim_t - 1)).
    chunk: int | None = Field(default=None, gt=0)
    # Deterministic circular time shifts averaged (MSST --bigshifts): pass k rolls the mixture by
    # k * (length // shifts) samples, its outputs are rolled back, and the passes are averaged.
    shifts: int | None = Field(default=None, ge=1)


class DemucsInference(WrapperInference):
    """audio-separator `demucs_params`; unset keys keep the library default."""

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


class SoloCheck(BaseModel):
    # A fast model run before the chain: when its drums, bass and vocals outputs together stay
    # below `threshold_db` of the mixture, the song is the instrument alone, its run is the
    # separation and the chain is skipped (notes then use the mixture).
    model: str
    threshold_db: float


class InstrumentSpec(BaseModel):
    chain: list[str] = Field(min_length=1)
    mix_minus: Literal["subtract", "complement"]
    quality: Literal["good", "rough"]
    solo_check: SoloCheck | None = None


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
            check = spec.solo_check
            if check is not None and (
                check.model not in self.models
                or name not in self.models[check.model].outputs.values()
            ):
                raise ValueError(f"{name}: solo check model {check.model} has no {name} output")
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
