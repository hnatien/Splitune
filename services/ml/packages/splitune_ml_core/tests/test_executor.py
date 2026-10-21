"""Executor bookkeeping transactions of one analysis running concurrently, as ml_worker (two
worker slots start or finish stages of the same analysis at the same moment)."""

from __future__ import annotations

import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor

from psycopg_pool import ConnectionPool
from splitune_ml_core import artefacts, contracts, devtools
from splitune_ml_core import queue as q
from splitune_ml_core.db import Connection, connect
from splitune_ml_core.executor import Analysis, Outcome, finish, mark_started
from splitune_ml_core.stages import STAGES

from .conftest import ScratchDatabase
from .test_worker import events, stage_runs

Write = Callable[[Connection], object]


def wait_for_lock_waiters(owner: Connection, count: int, timeout_s: float = 10) -> None:
    deadline = time.monotonic() + timeout_s
    while True:
        row = owner.execute(
            """
            select count(*) as n from pg_stat_activity
            where datname = current_database() and wait_event_type = 'Lock'
            """
        ).fetchone()
        if row is not None and row["n"] >= count:
            return
        if time.monotonic() > deadline:
            raise AssertionError(f"expected {count} transactions waiting for a lock")
        time.sleep(0.02)


def run_together(
    owner: Connection,
    database: ScratchDatabase,
    pool: ConnectionPool[Connection],
    analysis_id: str,
    writes: list[Write],
) -> None:
    """Holds the analysis row until every write is waiting on it, then lets them go at once: the
    interleaving two worker slots otherwise hit by chance. Raises what a write raised."""

    def run(write: Write) -> None:
        with pool.connection() as conn:
            write(conn)

    executor = ThreadPoolExecutor(max_workers=len(writes))
    try:
        with connect(database.owner_url) as blocker, blocker.transaction():
            blocker.execute("select 1 from analyses where id = %s for no key update", [analysis_id])
            futures = [executor.submit(run, write) for write in writes]
            wait_for_lock_waiters(owner, len(writes))
        for future in futures:
            future.result(timeout=30)
    finally:
        executor.shutdown()


def stage_job(
    owner: Connection, analysis: Analysis, stage: str
) -> tuple[q.Job, contracts.StageRequest]:
    payload = devtools.stage_request(
        stage,
        user_id=analysis.user_id,
        analysis_id=analysis.id,
        source_key=f"u/{analysis.user_id}/raw/upload/source.wav",
    )
    job = q.enqueue(owner, stage, "python", payload, analysis_id=analysis.id)
    return job, contracts.StageRequest.model_validate(payload)


def test_stages_starting_together_do_not_deadlock(
    owner: Connection, pool: ConnectionPool[Connection], database: ScratchDatabase, user_id: str
) -> None:
    _, analysis_id = devtools.seed_analysis(owner, user_id)
    analysis = Analysis(id=analysis_id, user_id=user_id, version=1)
    starts = [stage_job(owner, analysis, stage) for stage in ("beats", "tag")]

    run_together(
        owner,
        database,
        pool,
        analysis_id,
        [
            lambda conn, job=job, request=request: mark_started(conn, job, analysis, request)
            for job, request in starts
        ],
    )

    runs = stage_runs(owner, analysis_id)
    assert {stage: run["status"] for stage, run in runs.items()} == {
        "beats": "running",
        "tag": "running",
    }
    assert sorted(e["stage"] for e in events(owner, analysis_id)) == ["beats", "tag"]
    status = owner.execute("select status from analyses where id = %s", [analysis_id]).fetchone()
    assert status is not None
    assert status["status"] == "running"


def test_a_stage_finishing_while_another_starts_does_not_deadlock(
    owner: Connection,
    pool: ConnectionPool[Connection],
    worker_conn: Connection,
    database: ScratchDatabase,
    user_id: str,
) -> None:
    _, analysis_id = devtools.seed_analysis(owner, user_id)
    analysis = Analysis(id=analysis_id, user_id=user_id, version=1)
    beats_job, beats_request = stage_job(owner, analysis, "beats")
    tag_job, tag_request = stage_job(owner, analysis, "tag")
    claimed = q.claim(worker_conn, "python", "w", kinds=["beats"])
    assert claimed is not None
    assert claimed.id == beats_job.id
    mark_started(worker_conn, claimed, analysis, beats_request)
    outcome = Outcome(
        status="done",
        model_refs=[],
        written=[
            artefacts.Written(
                kind="beats",
                version=1,
                key=beats_request.outputs["beats"],
                sha256="b" * 64,
                bytes=42,
            )
        ],
        metrics={},
        facts={},
        cache_hit=False,
    )
    finished: list[bool] = []

    run_together(
        owner,
        database,
        pool,
        analysis_id,
        [
            lambda conn: finished.append(
                finish(conn, claimed, "w", analysis, STAGES["beats"], "key", outcome)
            ),
            lambda conn: mark_started(conn, tag_job, analysis, tag_request),
        ],
    )

    assert finished == [True]
    runs = stage_runs(owner, analysis_id)
    assert runs["beats"]["status"] == "done"
    assert runs["tag"]["status"] == "running"
    assert [e["type"] for e in events(owner, analysis_id) if e.get("stage") == "beats"] == [
        "stage.started",
        "stage.completed",
    ]
