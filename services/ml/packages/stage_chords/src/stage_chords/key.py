"""Key estimation for chords.json: madmom's CNN key model on the mixture, or music-core's
Krumhansl-Kessler estimator over the chord segments (`node packages/music-core/src/cli.ts key`,
so the shipped TypeScript code is what runs)."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
from pathlib import Path
from typing import Any, Literal, cast

import numpy as np
from numpy.typing import NDArray
from splitune_ml_core import contracts, register
from splitune_ml_core.errors import StageError
from splitune_ml_core.paths import REPO_ROOT

Estimator = Literal["madmom_cnn", "music_core"]
CLI = REPO_ROOT / "packages" / "music-core" / "src" / "cli.ts"
RECORD = "madmom-key-cnn"

_lock = threading.Lock()
_processor: Any = None


def madmom_ref() -> contracts.ModelRef:
    record = register.model(RECORD)
    return contracts.ModelRef(
        model_id="madmom/key_cnn",
        version=record.version,
        weights_sha256=record.weights.sha256,
        provider="self_hosted",
        register_tier=record.tier,
    )


def madmom_key(mono: NDArray[np.float32]) -> dict[str, Any]:
    """Tonic, mode and the model's probability of that key."""
    global _processor
    import madmom  # pyright: ignore[reportMissingTypeStubs]
    from madmom.audio.signal import Signal  # pyright: ignore[reportMissingTypeStubs]
    from madmom.features.key import (  # pyright: ignore[reportMissingTypeStubs]
        CNNKeyRecognitionProcessor,
        key_prediction_to_label,  # pyright: ignore[reportUnknownVariableType]
    )

    with _lock:
        if _processor is None:
            register.verify(register.model(RECORD), Path(madmom.__file__).parent / "models")
            _processor = CNNKeyRecognitionProcessor()  # pyright: ignore[reportUnknownVariableType]
    probs = np.asarray(_processor(Signal(mono, sample_rate=44100, num_channels=1)))
    tonic, mode = str(key_prediction_to_label(probs)).split()  # pyright: ignore[reportUnknownArgumentType]
    return {"tonic": tonic, "mode": mode, "confidence": round(float(np.max(probs)), 4)}


def node_binary() -> str:
    node = os.environ.get("NODE_BIN") or shutil.which("node")
    if node is None:
        raise StageError("node_missing", retry=False)
    return node


def music_core_key(segments: list[dict[str, Any]]) -> dict[str, Any]:
    result = subprocess.run(
        [node_binary(), str(CLI), "key"],
        input=json.dumps({"segments": segments}),
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    if result.returncode != 0:
        raise StageError("key_estimation_failed", retry=False)
    key = cast(dict[str, Any], json.loads(result.stdout))
    return {
        "tonic": key["tonic"],
        "mode": key["mode"],
        "confidence": round(float(key["confidence"]), 4),
    }
