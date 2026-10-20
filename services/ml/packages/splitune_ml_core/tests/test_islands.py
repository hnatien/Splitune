"""Island RPC: the real server module plus misbehaving stand-ins (hang, crash, stdout noise)."""

from __future__ import annotations

import io
import json
import sys
import time
from pathlib import Path
from typing import Any

import pytest
from splitune_ml_core.errors import StageError
from splitune_ml_core.island import serve
from splitune_ml_core.islands import IslandProcess, island_env


def test_server_dispatch_and_error_mapping() -> None:
    messages: list[dict[str, Any]] = [
        {"id": 1, "method": "ping"},
        {"id": 2, "method": "describe", "params": {"stage": "chords", "params": {}}},
        {"id": 3, "method": "nope"},
        {"id": 4, "method": "describe", "params": {"stage": "decode", "params": {}}},
    ]
    requests = io.StringIO("\n".join(json.dumps(m) for m in messages))
    replies = io.StringIO()
    serve(requests, replies)
    out = [json.loads(line) for line in replies.getvalue().splitlines()]
    assert out[0]["result"]["pid"] > 0
    assert out[1]["error"] == {"code": "unsupported_stage", "retry": False}
    assert out[2]["error"] == {"code": "unknown_method", "retry": False}
    assert out[3]["result"]["params"]["sample_rate"] == 44100


def test_real_island_stays_warm_and_keeps_secrets_out(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_PUBLIC_URL", "postgres://secret@db/x")
    monkeypatch.setenv("S3_SECRET_ACCESS_KEY", "secret")
    env = island_env("onnx-cpu")
    assert "DATABASE_PUBLIC_URL" not in env
    assert "S3_SECRET_ACCESS_KEY" not in env
    island = IslandProcess("onnx-cpu", sys.executable, env)
    try:
        first = island.call("ping", {}, 30)
        second = island.call("ping", {}, 30)
        assert first == second  # same process: models loaded once stay loaded
    finally:
        island.close()
    assert not island.running


def _fake(tmp_path: Path, body: str) -> list[str]:
    script = tmp_path / "fake_island.py"
    script.write_text(
        "import json, sys, time\nfor line in sys.stdin:\n    msg = json.loads(line)\n" + body
    )
    return [str(script)]


def test_timeout_kills_and_next_call_respawns(tmp_path: Path) -> None:
    body = (
        "    if msg['method'] == 'run': time.sleep(60)\n"
        "    print(json.dumps({'id': msg['id'], 'result': {'ok': True}}), flush=True)\n"
    )
    island = IslandProcess("x", sys.executable, island_env("x"), args=_fake(tmp_path, body))
    try:
        island.call("ping", {}, 10)
        pid = island.pid
        started = time.monotonic()
        with pytest.raises(StageError) as err:
            island.call("run", {}, 0.5)
        assert err.value.code == "stage_timeout"
        assert err.value.retry
        assert time.monotonic() - started < 5
        assert not island.running
        assert island.call("ping", {}, 10) == {"ok": True}
        assert island.pid != pid
    finally:
        island.close()


def test_crash_is_retryable(tmp_path: Path) -> None:
    island = IslandProcess(
        "x", sys.executable, island_env("x"), args=_fake(tmp_path, "    sys.exit(3)\n")
    )
    with pytest.raises(StageError) as err:
        island.call("run", {}, 10)
    assert err.value.code == "island_crashed"
    assert err.value.retry


def test_stray_stdout_lines_are_skipped(tmp_path: Path) -> None:
    body = (
        "    print(json.dumps({'id': -1, 'result': 'noise'}), flush=True)\n"
        "    print(json.dumps({'id': msg['id'], 'error': {'code': 'model_oom', 'retry': True}}),"
        " flush=True)\n"
    )
    island = IslandProcess("x", sys.executable, island_env("x"), args=_fake(tmp_path, body))
    try:
        with pytest.raises(StageError) as err:
            island.call("run", {}, 10)
        assert err.value.code == "model_oom"
    finally:
        island.close()


def test_missing_interpreter_is_permanent(tmp_path: Path) -> None:
    island = IslandProcess("x", tmp_path / "nope" / "python", island_env("x"))
    with pytest.raises(StageError) as err:
        island.call("ping", {}, 1)
    assert err.value.code == "island_missing"
    assert not err.value.retry
