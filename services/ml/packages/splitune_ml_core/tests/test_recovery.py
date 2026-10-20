"""Crash recovery: a worker killed mid-job is re-queued after its heartbeat goes stale and the job
completes on restart without duplicate rows; a worker that lost its lock discards its result."""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import pytest
from splitune_ml_core import devtools
from splitune_ml_core import queue as q
from splitune_ml_core.backends import FixtureBackend
from splitune_ml_core.db import Connection
from splitune_ml_core.executor import Services, execute
from splitune_ml_core.settings import Settings
from splitune_ml_core.stage_api import StageJob, StageOutput
from splitune_ml_core.stages import StageSpec
from splitune_ml_core.storage import Storage
from splitune_ml_core.worker import Worker

from .conftest import ScratchDatabase, SettingsFactory
from .test_worker import artefact_rows, enqueue_chain, events, stage_runs, wait_for

WORKER = Path(sys.executable).parent / "splitune-ml-worker"


def worker_env(settings: Settings, database: ScratchDatabase) -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if k in {"PATH", "HOME", "TMPDIR", "LANG"}}
    env.update(
        {
            "ML_DATABASE_URL": database.worker_url,
            "S3_ENDPOINT": settings.s3_endpoint,
            "S3_BUCKET": settings.s3_bucket,
            "S3_REGION": settings.s3_region,
            "S3_ACCESS_KEY_ID": settings.s3_access_key_id.get_secret_value(),
            "S3_SECRET_ACCESS_KEY": settings.s3_secret_access_key.get_secret_value(),
            "S3_FORCE_PATH_STYLE": str(settings.s3_force_path_style).lower(),
            "ML_MODE": "local",
            "ML_ISLAND_PYTHON": sys.executable,
            "ML_WORKER_ID": settings.worker_id,
            "ML_CACHE_DIR": str(settings.resolved_cache_dir),
            "ML_POLL_INTERVAL_S": "0.2",
            "ML_JOB_HEARTBEAT_S": "0.5",
            "ML_WORKER_HEARTBEAT_S": "0.5",
            "ML_STALE_AFTER_S": "10",  # 20 heartbeats of margin, also on a loaded CI box
            "LOG_LEVEL": "warning",
        }
    )
    if settings.ffmpeg_bin_dir is not None:
        env["FFMPEG_BIN_DIR"] = str(settings.ffmpeg_bin_dir)
    return env


def spawn(env: dict[str, str], cwd: Path) -> subprocess.Popen[bytes]:
    # Own process group, so the kill takes the worker and its islands down like a power cut.
    return subprocess.Popen([str(WORKER)], env=env, cwd=cwd, start_new_session=True)


@pytest.mark.models
def test_killed_worker_job_is_requeued_and_completes_once(
    owner: Connection,
    storage: Storage,
    make_settings: SettingsFactory,
    database: ScratchDatabase,
    user_id: str,
    click_track: Any,
    tmp_path: Path,
) -> None:
    _, analysis_id = devtools.seed_analysis(owner, user_id)
    decode_id, beats_id, _ = enqueue_chain(
        owner, storage, user_id, analysis_id, click_track(bpm=96, seconds=180)
    )
    env = worker_env(make_settings(), database)
    first = spawn(env, tmp_path)
    try:
        deadline = time.monotonic() + 300
        while True:
            row = owner.execute("select status from jobs where id = %s", [beats_id]).fetchone()
            if row is not None and row["status"] == "running":
                break
            assert row is not None
            assert row["status"] == "queued", f"beats finished before it could be killed: {row}"
            assert time.monotonic() < deadline
            time.sleep(0.02)
        os.killpg(first.pid, signal.SIGKILL)
    finally:
        first.wait(10)
    killed = owner.execute("select status, attempts from jobs where id = %s", [beats_id]).fetchone()
    assert killed is not None
    assert (killed["status"], killed["attempts"]) == ("running", 1)

    second = spawn(env, tmp_path)
    try:
        jobs = wait_for(owner, [decode_id, beats_id], timeout_s=300)
    finally:
        second.send_signal(signal.SIGTERM)
        second.wait(60)
    assert second.returncode == 0
    assert jobs[beats_id]["status"] == "done"
    assert jobs[beats_id]["attempts"] == 2
    assert jobs[beats_id]["error_code"] is None
    assert [r["kind"] for r in artefact_rows(owner, analysis_id)] == ["beats", "probe"]
    beats_events = [e["type"] for e in events(owner, analysis_id) if e.get("stage") == "beats"]
    assert beats_events == ["stage.started", "stage.started", "stage.completed"]
    run = stage_runs(owner, analysis_id)["beats"]
    assert (run["status"], run["attempts"]) == ("done", 2)


class StealingBackend(FixtureBackend):
    """Runs the stage, but meanwhile the job is re-queued as stale and claimed by someone else."""

    def __init__(self, owner: Connection) -> None:
        super().__init__()
        self._owner = owner

    def run(self, spec: StageSpec, job: StageJob) -> StageOutput:
        self._owner.execute(
            "update jobs set locked_by = 'someone-else' where analysis_id = %s", [job.analysis_id]
        )
        return super().run(spec, job)


def test_lost_lock_discards_the_result(
    owner: Connection,
    storage: Storage,
    make_settings: SettingsFactory,
    user_id: str,
    click_track: Any,
) -> None:
    settings = make_settings()
    worker = Worker(settings)
    try:
        _, analysis_id = devtools.seed_analysis(owner, user_id)
        decode_id, _, _ = enqueue_chain(owner, storage, user_id, analysis_id, click_track())
        with worker.pool.connection() as conn:
            job = q.claim(conn, "python", "me", kinds=["decode"])
        assert job is not None
        assert job.id == decode_id
        services = Services(settings, worker.pool, storage)
        assert execute(services, StealingBackend(owner), job, "me") == "lost"
        assert artefact_rows(owner, analysis_id) == []
        assert stage_runs(owner, analysis_id)["decode"]["status"] == "running"
        assert [e["type"] for e in events(owner, analysis_id)] == ["stage.started"]
    finally:
        worker.pool.close()


@pytest.mark.models
def test_sigterm_finishes_the_running_job_then_exits(
    owner: Connection,
    storage: Storage,
    make_settings: SettingsFactory,
    database: ScratchDatabase,
    user_id: str,
    click_track: Any,
    tmp_path: Path,
) -> None:
    _, analysis_id = devtools.seed_analysis(owner, user_id)
    decode_id, beats_id, _ = enqueue_chain(
        owner, storage, user_id, analysis_id, click_track(bpm=96, seconds=120)
    )
    proc = spawn(worker_env(make_settings(), database), tmp_path)
    try:
        deadline = time.monotonic() + 300
        while True:
            row = owner.execute("select status from jobs where id = %s", [beats_id]).fetchone()
            if row is not None and row["status"] == "running":
                break
            assert time.monotonic() < deadline
            time.sleep(0.02)
        proc.send_signal(signal.SIGTERM)
        assert proc.wait(120) == 0
    finally:
        if proc.poll() is None:
            os.killpg(proc.pid, signal.SIGKILL)
    jobs = wait_for(owner, [decode_id, beats_id], timeout_s=5)
    assert jobs[beats_id]["status"] == "done"
    assert jobs[beats_id]["attempts"] == 1
