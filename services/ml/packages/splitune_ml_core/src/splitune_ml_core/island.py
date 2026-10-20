"""Island server: `python -m splitune_ml_core.island`, one long-lived process per environment.

Speaks JSON lines on stdin/stdout so models load once and stay warm (06 §0). Requests are
`{"id", "method", "params"}` with method `ping` | `describe` | `run`; replies are
`{"id", "result"}` or `{"id", "error": {"code", "retry"}}`. Anything a library prints goes to
stderr: fd 1 is redirected there and the RPC uses a private duplicate of the original stdout.
"""

from __future__ import annotations

import importlib
import json
import logging
import os
import sys
from types import ModuleType
from typing import Any, Protocol, TextIO, cast

from .errors import StageError
from .logs import configure_logging
from .stage_api import StageDescription, StageJob, StageOutput
from .stages import STAGES

log = logging.getLogger("splitune.island")


class StageModule(Protocol):
    def describe(
        self, params: dict[str, Any], inputs: dict[str, str] | None = None
    ) -> StageDescription: ...

    def run(self, job: StageJob) -> StageOutput: ...


_modules: dict[str, ModuleType] = {}


def _stage(name: str) -> StageModule:
    spec = STAGES.get(name)
    if spec is None:
        raise StageError("unsupported_stage", retry=False)
    if spec.module not in _modules:
        _modules[spec.module] = importlib.import_module(spec.module)
    return cast(StageModule, _modules[spec.module])


def _is_oom(exc: BaseException) -> bool:
    return isinstance(exc, MemoryError) or "out of memory" in str(exc).lower()


def handle(method: str, params: dict[str, Any]) -> dict[str, Any]:
    if method == "ping":
        return {"pid": os.getpid()}
    if method == "describe":
        stage = _stage(str(params["stage"]))
        inputs = cast(dict[str, str], params.get("inputs") or {})
        return stage.describe(cast(dict[str, Any], params["params"]), inputs).model_dump(
            mode="json"
        )
    if method == "run":
        job = StageJob.model_validate(params["job"])
        return _stage(job.stage).run(job).model_dump(mode="json")
    raise StageError("unknown_method", retry=False)


def serve(requests: TextIO, replies: TextIO) -> None:
    for line in requests:
        if not line.strip():
            continue
        message = cast(dict[str, Any], json.loads(line))
        reply: dict[str, Any] = {"id": message.get("id")}
        try:
            reply["result"] = handle(str(message["method"]), message.get("params") or {})
        except StageError as exc:
            reply["error"] = {"code": exc.code, "retry": exc.retry}
        except Exception as exc:
            oom = _is_oom(exc)
            log.exception("stage raised", extra={"method": message.get("method")})
            reply["error"] = {"code": "model_oom" if oom else "internal_error", "retry": True}
        replies.write(json.dumps(reply) + "\n")
        replies.flush()


def main() -> None:
    configure_logging(os.environ.get("LOG_LEVEL", "info"))
    replies = os.fdopen(os.dup(sys.stdout.fileno()), "w", encoding="utf-8")
    os.dup2(sys.stderr.fileno(), sys.stdout.fileno())
    log.info("island started", extra={"island": os.environ.get("SPLITUNE_ISLAND", "?")})
    serve(sys.stdin, replies)


if __name__ == "__main__":
    main()
