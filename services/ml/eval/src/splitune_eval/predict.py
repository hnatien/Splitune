"""Runs the production stage code on a test set (08 §1: "we test what we ship"). Beats only for
now: decode → beats, exactly as the worker's islands do, optionally on codec-simulated audio."""

from __future__ import annotations

import json
import shutil
import tempfile
import time
from pathlib import Path
from typing import Any

from splitune_ml_core.stage_api import StageJob
from stage_beats import model as beats_model
from stage_beats import stage as beats_stage
from stage_decode import stage as decode_stage

from .codec import Codec, simulate
from .registry import TestSet

ANALYSIS = "00000000-0000-0000-0000-000000000000"


def predict_beats(
    tset: TestSet, out_dir: Path, *, model: str, codec: Codec | None, limit: int | None
) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    items = [i for i in tset.resolved_items() if i.audio and "beats" in i.annotations]
    items = items[:limit] if limit else items
    description = beats_stage.describe({"model": model})
    choice = beats_model.choose(model)
    timings: list[dict[str, Any]] = []
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        for item in items:
            assert item.audio is not None
            source = tset.path(item.audio)
            if codec is not None:
                source = simulate(source, work / f"{item.id}.{codec}.wav", codec)
            started = time.perf_counter()
            decoded = decode_stage.run(
                StageJob(
                    stage="decode",
                    analysis_id=ANALYSIS,
                    user_id="eval",
                    artefact_version=1,
                    params=decode_stage.describe({}).params,
                    inputs={"source": str(source)},
                    workdir=str(work),
                    cache_dir=str(work / "cache"),
                )
            )
            decode_s = time.perf_counter() - started
            out = beats_stage.run(
                StageJob(
                    stage="beats",
                    analysis_id=ANALYSIS,
                    user_id="eval",
                    artefact_version=1,
                    params=description.params,
                    inputs={},
                    workdir=str(work),
                    cache_dir=str(work / "cache"),
                    audio_hash=decoded.facts["audio_hash"],
                    duration_s=decoded.facts["duration_s"],
                    decoded_path=decoded.facts["decoded_path"],
                )
            )
            shutil.copyfile(out.files["beats"], out_dir / f"{item.id}.beats.json")
            timings.append(
                {
                    "item": item.id,
                    "decode_s": round(decode_s, 4),
                    "status": out.status,
                    **{k: round(v, 4) for k, v in out.metrics.items()},
                }
            )
    run = {
        "set": tset.id,
        "task": "beats",
        "codec": codec,
        "model": choice.model,
        "device": choice.device,
        "model_refs": [r.model_dump(mode="json") for r in description.model_refs],
        "items": timings,
    }
    (out_dir / "predict.json").write_text(json.dumps(run, indent=2), encoding="utf-8")
    return run
