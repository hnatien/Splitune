"""The Python queue against a real database, as ml_worker: same behaviour as the TS tests in
packages/db/test/jobs.test.ts."""

from __future__ import annotations

import threading
import time
from concurrent.futures import ThreadPoolExecutor

from psycopg_pool import ConnectionPool
from splitune_ml_core import queue as q
from splitune_ml_core.db import Connection, connect

from .conftest import ScratchDatabase


def test_claim_order_kinds_and_dependencies(owner: Connection, worker_conn: Connection) -> None:
    low = q.enqueue(owner, "decode", "python", {}, priority=200)
    high = q.enqueue(owner, "decode", "python", {}, priority=50)
    blocked = q.enqueue(owner, "beats", "python", {}, depends_on=[low.id], priority=1)
    q.enqueue(owner, "finalize", "node", {})

    assert q.claim(worker_conn, "python", "w", kinds=["beats"]) is None  # waits on `low`
    first = q.claim(worker_conn, "python", "w")
    assert first is not None
    assert first.id == high.id
    assert first.attempts == 1
    second = q.claim(worker_conn, "python", "w", kinds=["decode"])
    assert second is not None
    assert second.id == low.id
    assert q.claim(worker_conn, "python", "w") is None
    assert q.complete(worker_conn, low.id, "w")
    third = q.claim(worker_conn, "python", "w", kinds=["beats"])
    assert third is not None
    assert third.id == blocked.id
    assert q.claim(worker_conn, "python", "w", kinds=[]) is None


def test_soft_dependencies_wait_for_any_outcome(owner: Connection, worker_conn: Connection) -> None:
    decode = q.enqueue(owner, "decode", "python", {})
    separate = q.enqueue(owner, "separate", "python", {}, depends_on=[decode.id])
    notes = q.enqueue(
        owner, "notes.guitar", "python", {}, depends_on=[decode.id], soft_depends_on=[separate.id]
    )
    assert notes.soft_depends_on == [separate.id]
    assert q.claim(worker_conn, "python", "w") is not None
    assert q.complete(worker_conn, decode.id, "w")
    assert q.claim(worker_conn, "python", "w", kinds=["notes.guitar"]) is None
    claimed = q.claim(worker_conn, "python", "w")
    assert claimed is not None
    assert claimed.id == separate.id
    with worker_conn.transaction():
        assert q.fail(worker_conn, separate.id, "w", "stems_unavailable", retry=False) == "failed"
    # Nothing was cancelled: the soft dependant runs now.
    after = q.claim(worker_conn, "python", "w")
    assert after is not None
    assert after.id == notes.id


def test_heartbeat_and_complete_need_the_lock(owner: Connection, worker_conn: Connection) -> None:
    job = q.enqueue(owner, "decode", "python", {})
    assert q.claim(worker_conn, "python", "a") is not None
    assert not q.heartbeat(worker_conn, job.id, "b")
    assert q.heartbeat(worker_conn, job.id, "a")
    assert not q.complete(worker_conn, job.id, "b")
    assert q.complete(worker_conn, job.id, "a")
    assert not q.complete(worker_conn, job.id, "a")  # already done


def test_fail_backs_off_then_fails_and_cancels_dependents(
    owner: Connection, worker_conn: Connection
) -> None:
    job = q.enqueue(owner, "decode", "python", {}, max_attempts=2)
    child = q.enqueue(owner, "beats", "python", {}, depends_on=[job.id])
    grandchild = q.enqueue(owner, "finalize", "node", {}, depends_on=[child.id])

    assert q.claim(worker_conn, "python", "w") is not None
    with worker_conn.transaction():
        assert q.fail(worker_conn, job.id, "w", "model_oom") == "queued"
    row = owner.execute(
        "select status, error_code, extract(epoch from run_after - now()) as wait from jobs "
        "where id = %s",
        [job.id],
    ).fetchone()
    assert row is not None
    assert row["status"] == "queued"
    assert row["error_code"] == "model_oom"
    assert 13 <= float(row["wait"]) <= 15  # 15 s * 2^0
    assert q.claim(worker_conn, "python", "w") is None  # backing off

    owner.execute("update jobs set run_after = now() where id = %s", [job.id])
    assert q.claim(worker_conn, "python", "w") is not None
    with worker_conn.transaction():
        assert q.fail(worker_conn, job.id, "w", "model_oom") == "failed"
    statuses = {
        int(r["id"]): (r["status"], r["error_code"])
        for r in owner.execute(
            "select id, status, error_code from jobs where id = any(%s)",
            [[child.id, grandchild.id]],
        ).fetchall()
    }
    assert statuses == {
        child.id: ("cancelled", "dependency_failed"),
        grandchild.id: ("cancelled", "dependency_failed"),
    }


def test_permanent_failure_skips_retries(owner: Connection, worker_conn: Connection) -> None:
    job = q.enqueue(owner, "decode", "python", {})
    assert q.claim(worker_conn, "python", "w") is not None
    with worker_conn.transaction():
        assert q.fail(worker_conn, job.id, "w", "unsupported_media", retry=False) == "failed"
    with worker_conn.transaction():
        assert q.fail(worker_conn, job.id, "w", "unsupported_media") is None  # lock gone


def test_requeue_stale(owner: Connection, worker_conn: Connection) -> None:
    alive = q.enqueue(owner, "decode", "python", {})
    stale = q.enqueue(owner, "decode", "python", {})
    exhausted = q.enqueue(owner, "decode", "python", {}, max_attempts=1)
    child = q.enqueue(owner, "beats", "python", {}, depends_on=[exhausted.id])
    for _ in range(3):
        assert q.claim(worker_conn, "python", "w", kinds=["decode"]) is not None
    owner.execute(
        "update jobs set heartbeat_at = now() - interval '10 minutes' where id = any(%s)",
        [[stale.id, exhausted.id]],
    )
    requeued, failed = q.requeue_stale(worker_conn)
    assert requeued == [stale.id]
    assert failed == [exhausted.id]
    rows = {
        int(r["id"]): (r["status"], r["error_code"], r["locked_by"])
        for r in owner.execute("select id, status, error_code, locked_by from jobs").fetchall()
    }
    assert rows[alive.id] == ("running", None, "w")
    assert rows[stale.id] == ("queued", "lock_expired", None)
    assert rows[exhausted.id] == ("failed", "lock_expired", None)
    assert rows[child.id] == ("cancelled", "dependency_failed", None)
    assert not q.heartbeat(worker_conn, stale.id, "w")


def test_concurrent_claims_hand_out_each_job_once(
    owner: Connection, pool: ConnectionPool[Connection]
) -> None:
    ids = {q.enqueue(owner, "decode", "python", {}).id for _ in range(40)}

    def drain(worker: int) -> list[int]:
        got: list[int] = []
        while True:
            with pool.connection() as conn:
                job = q.claim(conn, "python", f"w{worker}")
            if job is None:
                return got
            got.append(job.id)

    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(drain, range(10)))
    claimed = [job_id for result in results for job_id in result]
    assert sorted(claimed) == sorted(ids)


def test_enqueue_notifies_listeners(owner: Connection, database: ScratchDatabase) -> None:
    received: list[str] = []
    ready = threading.Event()

    def listen() -> None:
        with connect(database.worker_url) as conn:
            conn.execute("listen jobs_python")
            ready.set()
            for note in conn.notifies(timeout=5, stop_after=1):
                received.append(note.payload)

    thread = threading.Thread(target=listen)
    thread.start()
    ready.wait(5)
    time.sleep(0.1)
    job = q.enqueue(owner, "decode", "python", {})
    thread.join(10)
    assert received == [str(job.id)]


def test_finishing_a_job_wakes_the_runners_of_its_dependants(
    owner: Connection, database: ScratchDatabase
) -> None:
    stage = q.enqueue(owner, "chords", "python", {})
    q.enqueue(owner, "finalize", "node", {}, soft_depends_on=[stage.id])
    received: list[str] = []
    ready = threading.Event()

    def listen() -> None:
        with connect(database.worker_url) as conn:
            conn.execute("listen jobs_node")
            ready.set()
            for note in conn.notifies(timeout=5, stop_after=1):
                received.append(note.payload)

    thread = threading.Thread(target=listen)
    thread.start()
    ready.wait(5)
    time.sleep(0.1)
    with owner.transaction():
        q.notify_dependents(owner, stage.id)
    thread.join(10)
    assert received == [str(stage.id)]
