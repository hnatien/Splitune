"""Python side of the Postgres job queue.

Issues exactly the statements of `packages/db/src/jobs/queue.ts`, as documented in
`packages/db/README.md` ("Job queue protocol"). All times are database time.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal, cast

from psycopg.types.json import Jsonb

from .db import Connection

BACKOFF_BASE_S = 15
BACKOFF_MAX_S = 900
STALE_AFTER_S = 120

Runner = Literal["python", "node"]


def channel_for(runner: Runner) -> str:
    return f"jobs_{runner}"


@dataclass(frozen=True)
class Job:
    id: int
    kind: str
    runner: str
    analysis_id: str | None
    payload: dict[str, Any]
    status: str
    priority: int
    attempts: int
    max_attempts: int
    run_after: datetime
    locked_by: str | None
    depends_on: list[int]
    error_code: str | None

    @staticmethod
    def from_row(row: dict[str, Any]) -> Job:
        analysis_id = row["analysis_id"]
        return Job(
            id=int(row["id"]),
            kind=str(row["kind"]),
            runner=str(row["runner"]),
            analysis_id=None if analysis_id is None else str(analysis_id),
            payload=cast(dict[str, Any], row["payload"]),
            status=str(row["status"]),
            priority=int(row["priority"]),
            attempts=int(row["attempts"]),
            max_attempts=int(row["max_attempts"]),
            run_after=cast(datetime, row["run_after"]),
            locked_by=cast(str | None, row["locked_by"]),
            depends_on=[int(d) for d in cast(list[int], row["depends_on"])],
            error_code=cast(str | None, row["error_code"]),
        )


def enqueue(
    conn: Connection,
    kind: str,
    runner: Runner,
    payload: dict[str, Any],
    *,
    analysis_id: str | None = None,
    depends_on: Sequence[int] = (),
    priority: int = 100,
    max_attempts: int = 3,
) -> Job:
    """Inserts a queued job and NOTIFYs `jobs_<runner>` (delivered on commit). Production jobs are
    enqueued by the TypeScript side; this is for scripts and tests."""
    with conn.transaction():
        deps = list(depends_on)
        if deps:
            found = conn.execute("select count(*) as n from jobs where id = any(%s)", [deps])
            row = found.fetchone()
            if row is None or int(row["n"]) != len(set(deps)):
                raise ValueError(f"enqueue {kind}: unknown dependency in {deps}")
        created = conn.execute(
            """
            insert into jobs
              (kind, runner, analysis_id, payload, depends_on, priority, max_attempts)
            values (%s, %s, %s, %s, %s, %s, %s)
            returning *
            """,
            [kind, runner, analysis_id, Jsonb(payload), deps, priority, max_attempts],
        ).fetchone()
        assert created is not None
        job = Job.from_row(created)
        conn.execute("select pg_notify(%s, %s)", [channel_for(runner), str(job.id)])
        return job


def claim(
    conn: Connection, runner: Runner, worker_id: str, kinds: Sequence[str] | None = None
) -> Job | None:
    """Locks the next runnable job (queued, due, all dependencies done; lowest priority number,
    then oldest). SKIP LOCKED hands each job to exactly one worker."""
    if kinds is not None and not kinds:
        return None
    row = conn.execute(
        """
        with next as (
          select j.id
          from jobs j
          where j.runner = %(runner)s
            and j.status = 'queued'
            and j.run_after <= now()
            and (%(kinds)s::text[] is null or j.kind = any(%(kinds)s::text[]))
            and not exists (
              select 1 from jobs d where d.id = any(j.depends_on) and d.status <> 'done'
            )
          order by j.priority, j.id
          limit 1
          for update of j skip locked
        )
        update jobs
        set status = 'running',
            attempts = jobs.attempts + 1,
            locked_by = %(worker_id)s,
            locked_at = now(),
            heartbeat_at = now(),
            error_code = null
        from next
        where jobs.id = next.id
        returning jobs.*
        """,
        {"runner": runner, "kinds": None if kinds is None else list(kinds), "worker_id": worker_id},
    ).fetchone()
    return None if row is None else Job.from_row(row)


def heartbeat(conn: Connection, job_id: int, worker_id: str) -> bool:
    """False = the lock was lost (re-queued as stale or cancelled): stop and discard."""
    cur = conn.execute(
        """
        update jobs set heartbeat_at = now()
        where id = %s and locked_by = %s and status = 'running'
        """,
        [job_id, worker_id],
    )
    return cur.rowcount == 1


def complete(conn: Connection, job_id: int, worker_id: str) -> bool:
    """False = the lock was lost; the caller must roll back and discard its result."""
    cur = conn.execute(
        """
        update jobs set status = 'done', heartbeat_at = now()
        where id = %s and locked_by = %s and status = 'running'
        """,
        [job_id, worker_id],
    )
    return cur.rowcount == 1


def cancel_dependents(conn: Connection, failed_ids: Sequence[int]) -> list[int]:
    """Cancels queued jobs that (transitively) wait on a permanently failed job."""
    if not failed_ids:
        return []
    rows = conn.execute(
        """
        with recursive dependents as (
          select j.id from jobs j
          where j.depends_on && %s::bigint[] and j.status = 'queued'
          union
          select j.id from jobs j join dependents d on j.depends_on @> array[d.id]
          where j.status = 'queued'
        )
        update jobs set status = 'cancelled', error_code = 'dependency_failed'
        where id in (select id from dependents)
        returning id
        """,
        [list(failed_ids)],
    ).fetchall()
    return [int(r["id"]) for r in rows]


def fail(
    conn: Connection, job_id: int, worker_id: str, error_code: str, *, retry: bool = True
) -> Literal["queued", "failed"] | None:
    """Records a failed attempt: back off and retry while attempts remain (and `retry`), else fail
    and cancel dependents. None = the lock was lost. Call inside a transaction."""
    row = conn.execute(
        """
        update jobs
        set status = case when %(retry)s::boolean and attempts < max_attempts
                       then 'queued' else 'failed' end,
            run_after = case when %(retry)s::boolean and attempts < max_attempts
              then now() + make_interval(
                secs => least(%(base)s::float8 * power(2, attempts - 1), %(max)s::float8))
              else run_after end,
            locked_by = null,
            locked_at = null,
            heartbeat_at = null,
            error_code = %(code)s
        where id = %(id)s and locked_by = %(worker_id)s and status = 'running'
        returning status
        """,
        {
            "retry": retry,
            "base": BACKOFF_BASE_S,
            "max": BACKOFF_MAX_S,
            "code": error_code,
            "id": job_id,
            "worker_id": worker_id,
        },
    ).fetchone()
    if row is None:
        return None
    status = cast(Literal["queued", "failed"], row["status"])
    if status == "failed":
        cancel_dependents(conn, [job_id])
    return status


def requeue_stale(
    conn: Connection, stale_after_s: float = STALE_AFTER_S
) -> tuple[list[int], list[int]]:
    """Re-queues (or fails, when out of attempts) running jobs whose worker stopped heartbeating.
    Returns (requeued, failed). Safe to run concurrently: rows are taken with SKIP LOCKED."""
    with conn.transaction():
        rows = conn.execute(
            """
            with stale as (
              select id from jobs
              where status = 'running'
                and heartbeat_at < now() - make_interval(secs => %s::float8)
              for update skip locked
            )
            update jobs
            set status = case when attempts < max_attempts then 'queued' else 'failed' end,
                run_after = now(),
                locked_by = null,
                locked_at = null,
                heartbeat_at = null,
                error_code = 'lock_expired'
            from stale
            where jobs.id = stale.id
            returning jobs.id, jobs.status
            """,
            [stale_after_s],
        ).fetchall()
        requeued = [int(r["id"]) for r in rows if r["status"] == "queued"]
        failed = [int(r["id"]) for r in rows if r["status"] == "failed"]
        cancel_dependents(conn, failed)
        return requeued, failed
