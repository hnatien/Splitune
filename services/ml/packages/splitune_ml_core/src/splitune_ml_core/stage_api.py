"""What a stage implementation receives and returns.

Stage modules (e.g. `stage_beats.stage`) expose `describe(params) -> StageDescription` and
`run(job) -> StageOutput`. They work on local files only: the worker downloads inputs, uploads
outputs and does all bookkeeping, so stages never see database or bucket credentials. These models
travel over the island JSON-lines RPC (Python on both ends).
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from .contracts import ModelRef


class StageDescription(BaseModel):
    """Models a run would use and the effective params (defaults filled in): both go into the cache
    key and the artefact header."""

    model_refs: list[ModelRef]
    params: dict[str, Any]


class StageJob(BaseModel):
    stage: str
    analysis_id: str
    user_id: str
    artefact_version: int = Field(ge=1)
    params: dict[str, Any]
    inputs: dict[str, str]  # logical input name -> local path
    workdir: str  # write outputs here
    cache_dir: str  # shared on-disk cache (decoded FLAC intermediates)
    audio_hash: str | None = None
    duration_s: float | None = None
    decoded_path: str | None = None


class StageOutput(BaseModel):
    status: Literal["done", "fallback"]
    files: dict[str, str]  # output name -> local path
    model_refs: list[ModelRef]
    metrics: dict[str, float] = Field(default_factory=dict[str, float])
    fallback_reason: str | None = None
    # Values the worker records outside the artefacts, e.g. decode's audio_hash and duration_s.
    facts: dict[str, Any] = Field(default_factory=dict[str, Any])
