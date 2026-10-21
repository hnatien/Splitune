"""Island client: spawns and talks to `splitune_ml_core.island` processes."""

from __future__ import annotations

import contextlib
import itertools
import json
import logging
import os
import queue
import subprocess
import sys
import threading
from collections.abc import Sequence
from pathlib import Path
from typing import IO, Any, cast

from .errors import StageError
from .paths import ISLANDS_DIR

log = logging.getLogger("splitune.islands")

# Only what a stage needs; database URLs and bucket credentials never reach an island.
_PASSTHROUGH = (
    "PATH",
    "HOME",
    "TMPDIR",
    "LANG",
    "LC_ALL",
    "LOG_LEVEL",
    "FFMPEG_BIN_DIR",
    "ML_TORCH_DEVICE",
    "ML_MODELS_DIR",
    "ML_SEPARATION_CONFIG",
    # Read both by stages.py (notes island placement) in the worker and by the stages in the
    # island, so an override must reach both as the same process environment.
    "ML_NOTES_CONFIG",
    "ML_CHORDS_CONFIG",
    "NODE_BIN",  # music-core key estimator (chords, key: music_core)
    "TORCH_HOME",
    "XDG_CACHE_HOME",
    "PYTORCH_ENABLE_MPS_FALLBACK",
)


def island_python(name: str, islands_dir: Path | None = None) -> Path:
    """The interpreter of `services/ml/islands/<name>/.venv`."""
    return (islands_dir or ISLANDS_DIR) / name / ".venv" / "bin" / "python"


def island_env(name: str, extra: dict[str, str] | None = None) -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if k in _PASSTHROUGH}
    env["SPLITUNE_ISLAND"] = name
    env["PYTHONUNBUFFERED"] = "1"
    env.update(extra or {})
    return env


class IslandProcess:
    """One island subprocess, used by one worker slot at a time (calls are sequential)."""

    def __init__(
        self,
        name: str,
        python: Path | str,
        env: dict[str, str],
        args: Sequence[str] = ("-m", "splitune_ml_core.island"),
    ) -> None:
        self.name = name
        self._python = str(python)
        self._env = env
        self._args = list(args)
        self._ids = itertools.count(1)
        self._proc: subprocess.Popen[str] | None = None
        self._replies: queue.Queue[str | None] = queue.Queue()

    @property
    def pid(self) -> int | None:
        return None if self._proc is None else self._proc.pid

    @property
    def running(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    def _start(self) -> subprocess.Popen[str]:
        if not Path(self._python).exists():
            raise StageError("island_missing", retry=False)
        proc = subprocess.Popen(
            [self._python, *self._args],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=sys.stderr,
            env=self._env,
            text=True,
            bufsize=1,
        )
        self._replies = queue.Queue()
        threading.Thread(target=self._read, args=(proc.stdout, self._replies), daemon=True).start()
        log.info("island spawned", extra={"island": self.name, "pid": proc.pid})
        return proc

    @staticmethod
    def _read(stream: IO[str], replies: queue.Queue[str | None]) -> None:
        for line in stream:
            replies.put(line)
        replies.put(None)  # EOF: the process exited

    def call(self, method: str, params: dict[str, Any], timeout_s: float) -> dict[str, Any]:
        if not self.running:
            self._proc = self._start()
        proc = self._proc
        assert proc is not None
        assert proc.stdin is not None
        request_id = next(self._ids)
        try:
            proc.stdin.write(json.dumps({"id": request_id, "method": method, "params": params}))
            proc.stdin.write("\n")
            proc.stdin.flush()
        except BrokenPipeError as exc:
            self.kill()
            raise StageError("island_crashed") from exc
        while True:
            try:
                line = self._replies.get(timeout=timeout_s)
            except queue.Empty as exc:
                # A stuck model can't be interrupted from outside: kill it, the next call respawns.
                log.warning("island timed out", extra={"island": self.name, "method": method})
                self.kill()
                raise StageError("stage_timeout") from exc
            if line is None:
                self.kill()
                raise StageError("island_crashed")
            reply = cast(dict[str, Any], json.loads(line))
            if reply.get("id") == request_id:
                break
        if "error" in reply:
            error = cast(dict[str, Any], reply["error"])
            raise StageError(str(error["code"]), retry=bool(error.get("retry", True)))
        return cast(dict[str, Any], reply["result"])

    def kill(self) -> None:
        if self._proc is not None and self._proc.poll() is None:
            self._proc.kill()
            self._proc.wait(timeout=10)
        self._proc = None

    def close(self, timeout_s: float = 10) -> None:
        """Closes stdin (the island exits on EOF), then kills it if it doesn't."""
        proc = self._proc
        if proc is None:
            return
        if proc.stdin is not None:
            with contextlib.suppress(BrokenPipeError):
                proc.stdin.close()
        try:
            proc.wait(timeout=timeout_s)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=10)
        self._proc = None
