"""Object key checks and the stage cache key (03-data-model-and-storage.md "Keys")."""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Sequence
from typing import Any

from .contracts import ModelRef

# Same rules as packages/storage `assertSafeKey`: ASCII [A-Za-z0-9_.-] segments, none `.`/`..`.
_SAFE_SEGMENT = re.compile(r"^[A-Za-z0-9_.-]+$")


def is_safe_key(key: str) -> bool:
    if not key or len(key) > 1024 or key.startswith("/") or key.endswith("/"):
        return False
    return all(s not in {".", ".."} and _SAFE_SEGMENT.fullmatch(s) for s in key.split("/"))


def user_prefix(user_id: str) -> str:
    return f"u/{user_id}/"


def analysis_prefix(user_id: str, analysis_id: str) -> str:
    return f"u/{user_id}/a/{analysis_id}/"


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def cache_key(
    *,
    scope: str,
    audio_id: str,
    stage: str,
    model_refs: Sequence[ModelRef],
    params: dict[str, Any],
) -> str:
    """sha256(scope ‖ audio ‖ stage ‖ model_id@version ‖ weights_sha256 ‖ canonical_json(params)).

    `scope` is "global" (personal mode) or the user id. `audio_id` is the audio_hash, or for
    decode (which produces it) the sha256 of the source file. Parts are newline-separated so
    adjacent fields can't run into each other.
    """
    models = sorted(f"{m.model_id}@{m.version}:{m.weights_sha256}" for m in model_refs)
    parts = [scope, audio_id, stage, ",".join(models), canonical_json(params)]
    return hashlib.sha256("\n".join(parts).encode()).hexdigest()
