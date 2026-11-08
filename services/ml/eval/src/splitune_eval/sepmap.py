"""The separation model map as the eval tools see it (step 29): the production map
(`config/separation.personal.yaml`, or ML_SEPARATION_CONFIG) plus `eval/separation.eval.yaml`,
whose eval-only candidates and setting variants never reach the stages or the regression suite.

An overlay entry is a full model-map entry, or `base: <map model>` plus the keys it changes; its
`inference` keys are merged over the base's.
"""

from __future__ import annotations

from functools import cache
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

import yaml

if TYPE_CHECKING:
    from stage_separation.config import ModelSpec

OVERLAY = Path(__file__).resolve().parents[2] / "separation.eval.yaml"


def entries(raw: dict[str, Any], base_models: dict[str, ModelSpec]) -> dict[str, ModelSpec]:
    from stage_separation.config import ModelSpec

    out = dict(base_models)
    for name, entry in cast(dict[str, dict[str, Any]], raw.get("models", {})).items():
        if name in out:
            raise ValueError(f"{name}: an eval entry may not replace a map model")
        if "base" in entry:
            base = out[str(entry["base"])].model_dump()
            changed = {k: v for k, v in entry.items() if k not in ("base", "inference")}
            inference = {**base["inference"], **cast(dict[str, Any], entry.get("inference", {}))}
            entry = {**base, **changed, "inference": inference}
        out[name] = ModelSpec.model_validate(entry)
    return out


@cache
def models() -> dict[str, ModelSpec]:
    from stage_separation import config

    raw = cast(dict[str, Any], yaml.safe_load(OVERLAY.read_text(encoding="utf-8")))
    return entries(raw, dict(config.load().models))


def spec(name: str) -> ModelSpec:
    found = models().get(name)
    if found is None:
        raise KeyError(f"{name}: not in the model map or {OVERLAY.name}")
    return found


def outputs(name: str) -> dict[str, str | None]:
    return dict(spec(name).outputs)
