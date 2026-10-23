from __future__ import annotations

import json
import logging
import signal
from pathlib import Path
from typing import Any

import pytest
from splitune_ml_core import artefacts, contracts
from splitune_ml_core.errors import StageError
from splitune_ml_core.keys import cache_key, is_safe_key
from splitune_ml_core.logs import JsonFormatter, redact
from splitune_ml_core.paths import CONTRACT_FIXTURES_DIR
from splitune_ml_core.settings import find_env_files
from splitune_ml_core.worker import ShutdownSignals

REF = contracts.ModelRef(
    model_id="beat_this/final0",
    version="1.1.0",
    weights_sha256="a" * 64,
    provider="self_hosted",
    register_tier="green",
)


@pytest.mark.parametrize(
    ("key", "ok"),
    [
        ("u/usr_1/a/0192f6c4-8b00-7a00-8000-0000000000aa/v1/beats.json", True),
        ("u/usr_1/raw/x/source.m4a", True),
        ("u/usr_1/../usr_2/raw/x", False),
        ("u/usr_1/./x", False),
        ("/u/usr_1/x", False),
        ("u/usr_1//x", False),
        ("u/usr_1/x/", False),
        ("u/usr_1/naïve.wav", False),
        ("", False),
    ],
)
def test_safe_keys(key: str, ok: bool) -> None:
    assert is_safe_key(key) is ok


def test_cache_key_is_canonical_and_scoped() -> None:
    def key(
        params: dict[str, Any], scope: str = "global", refs: list[contracts.ModelRef] | None = None
    ) -> str:
        return cache_key(
            scope=scope, audio_id="f" * 64, stage="beats", model_refs=refs or [REF], params=params
        )

    a = key({"model": "final0", "dbn": False})
    assert a == key({"dbn": False, "model": "final0"})
    assert a != key({"model": "final0", "dbn": False}, scope="user-1")
    assert a != key({"model": "small0", "dbn": False})
    other = REF.model_copy(update={"weights_sha256": "b" * 64})
    assert a != key({"model": "final0", "dbn": False}, refs=[other])


def test_logs_redact_urls_and_keep_fields() -> None:
    assert redact("GET https://bucket/x?X-Amz-Signature=abc failed") == "GET [url] failed"
    record = logging.makeLogRecord(
        {
            "msg": "upload to %s",
            "args": ("http://s3/k?sig=1",),
            "levelname": "INFO",
            "job_id": 7,
            "detail": {"url": "postgres://u:p@h/db"},
        }
    )
    entry = json.loads(JsonFormatter().format(record))
    assert entry["msg"] == "upload to [url]"
    assert entry["job_id"] == 7
    assert entry["detail"] == {"url": "[url]"}


def test_validate_artefact_checks_contract_kind_and_major() -> None:
    beats = (CONTRACT_FIXTURES_DIR / "beats.json").read_bytes()
    assert artefacts.validate_artefact("beats", beats)["artefact"] == "beats"
    document = json.loads(beats)
    for bad, kind in [
        ({**document, "schema_version": "2.0.0"}, "beats"),
        ({**document, "bpm": "120"}, "beats"),
        (document, "chords"),
    ]:
        with pytest.raises(StageError) as err:
            artefacts.validate_artefact(kind, json.dumps(bad).encode())
        assert err.value.code == "artefact_invalid"
        assert not err.value.retry


def test_stage_errors_need_machine_codes() -> None:
    with pytest.raises(ValueError, match="not a machine code"):
        StageError("Traceback: boom")


class _Clock:
    def __init__(self) -> None:
        self.now = 100.0

    def __call__(self) -> float:
        return self.now


def test_forwarded_duplicate_signal_does_not_force_exit() -> None:
    clock, forced = _Clock(), list[bool]()
    signals = ShutdownSignals(clock=clock, force_exit=lambda: forced.append(True))
    signals(signal.SIGINT, None)
    assert signals.stopping.is_set()
    clock.now += 0.2  # uv run forwarding the Ctrl-C it also received
    signals(signal.SIGINT, None)
    assert forced == []


def test_deliberate_second_signal_forces_exit() -> None:
    clock, forced = _Clock(), list[bool]()
    signals = ShutdownSignals(clock=clock, force_exit=lambda: forced.append(True))
    signals(signal.SIGINT, None)
    clock.now += 0.2
    signals(signal.SIGINT, None)
    clock.now += 1.5
    signals(signal.SIGINT, None)
    assert forced == [True]


def test_different_second_signal_forces_exit_at_once() -> None:
    clock, forced = _Clock(), list[bool]()
    signals = ShutdownSignals(clock=clock, force_exit=lambda: forced.append(True))
    signals(signal.SIGTERM, None)
    clock.now += 0.1
    signals(signal.SIGINT, None)
    assert forced == [True]


def test_env_files_default_to_the_nearest_dot_env_only(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("SPLITUNE_ENV_FILE", raising=False)
    (tmp_path / ".env").write_text("S3_BUCKET=local\n")
    (tmp_path / ".env.worker").write_text("S3_BUCKET=production\n")
    nested = tmp_path / "services" / "ml"
    nested.mkdir(parents=True)
    assert find_env_files(nested) == (tmp_path / ".env",)


def test_env_files_named_by_splitune_env_file_replace_dot_env(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / ".env").write_text("S3_BUCKET=local\n")
    worker = tmp_path / ".env.worker"
    worker.write_text("S3_BUCKET=production\n")
    monkeypatch.setenv("SPLITUNE_ENV_FILE", str(worker))
    assert find_env_files(tmp_path) == (worker,)


def test_a_missing_splitune_env_file_fails_instead_of_falling_back(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / ".env").write_text("S3_BUCKET=local\n")
    monkeypatch.setenv("SPLITUNE_ENV_FILE", str(tmp_path / ".env.worker"))
    with pytest.raises(FileNotFoundError):
        find_env_files(tmp_path)
