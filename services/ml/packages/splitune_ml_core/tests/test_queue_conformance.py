"""The shared queue corpus (packages/db/test/conformance/queue.json) against the Python adapter:
the same scenarios packages/db/test/queue-conformance.test.ts runs against the TypeScript one.
Jobs are enqueued as the owner (production enqueues from the API); the rest runs as ml_worker."""

from __future__ import annotations

import json
from typing import Any

import pytest
from psycopg import sql
from splitune_ml_core import queue as q
from splitune_ml_core.db import Connection
from splitune_ml_core.paths import REPO_ROOT

CORPUS: dict[str, Any] = json.loads(
    (REPO_ROOT / "packages/db/test/conformance/queue.json").read_text()
)
SCENARIOS: list[dict[str, Any]] = CORPUS["scenarios"]
# No job has a negative id: stands in for a dependency that does not exist.
MISSING_ID = -1
AGEABLE = {"heartbeat_at", "run_after"}


def test_constants_match_the_corpus() -> None:
    assert CORPUS["constants"] == {
        "backoff_base_s": q.BACKOFF_BASE_S,
        "backoff_max_s": q.BACKOFF_MAX_S,
        "stale_after_s": q.STALE_AFTER_S,
    }


@pytest.mark.parametrize("scenario", SCENARIOS, ids=[s["id"] for s in SCENARIOS])
def test_scenario(scenario: dict[str, Any], owner: Connection, worker_conn: Connection) -> None:
    ids: dict[str, int] = {}

    def label_of(job_id: int) -> str:
        return next((k for k, v in ids.items() if v == job_id), f"#{job_id}")

    for step in scenario["steps"]:
        op = step["op"]
        if op == "enqueue":
            options: dict[str, Any] = {
                k: step[k] for k in ("priority", "max_attempts") if k in step
            }
            job = q.enqueue(
                owner,
                step["kind"],
                step["runner"],
                {},
                depends_on=[ids[d] for d in step.get("depends_on", [])],
                soft_depends_on=[ids[d] for d in step.get("soft_depends_on", [])],
                **options,
            )
            ids[step["as"]] = job.id
        elif op == "enqueue_error":
            depends_on = [ids[d] for d in step.get("depends_on", [])]
            soft_depends_on = [ids[d] for d in step.get("soft_depends_on", [])]
            (depends_on if step["unknown_in"] == "depends_on" else soft_depends_on).append(
                MISSING_ID
            )
            with pytest.raises(ValueError, match="unknown dependency"):
                q.enqueue(
                    owner,
                    step["kind"],
                    step["runner"],
                    {},
                    depends_on=depends_on,
                    soft_depends_on=soft_depends_on,
                )
        elif op == "claim":
            claimed = q.claim(worker_conn, step["runner"], step["worker"], kinds=step.get("kinds"))
            assert (None if claimed is None else label_of(claimed.id)) == step["expect"], step
        elif op == "heartbeat":
            assert q.heartbeat(worker_conn, ids[step["job"]], step["worker"]) == step["expect"], (
                step
            )
        elif op == "complete":
            assert q.complete(worker_conn, ids[step["job"]], step["worker"]) == step["expect"], step
        elif op == "fail":
            # As the executor does: fail and its bookkeeping share one transaction.
            with worker_conn.transaction():
                status = q.fail(
                    worker_conn,
                    ids[step["job"]],
                    step["worker"],
                    step["code"],
                    retry=step.get("retry", True),
                )
            assert status == step["expect"], step
        elif op == "requeue_stale":
            requeued, failed = q.requeue_stale(
                worker_conn, step.get("stale_after_s", q.STALE_AFTER_S)
            )
            assert {
                "requeued": sorted(map(label_of, requeued)),
                "failed": sorted(map(label_of, failed)),
            } == {k: sorted(v) for k, v in step["expect"].items()}, step
        elif op == "age":
            column = step["column"]
            assert column in AGEABLE, f"cannot age column {column}"
            owner.execute(
                sql.SQL(
                    "update jobs set {} = now() - make_interval(secs => %s::float8) where id = %s"
                ).format(sql.Identifier(column)),
                [step["seconds_ago"], ids[step["job"]]],
            )
        elif op == "make_due":
            owner.execute("update jobs set run_after = now() where id = %s", [ids[step["job"]]])
        elif op == "expect_rows":
            for label, want in step["rows"].items():
                row = owner.execute(
                    """
                    select status, attempts, error_code, locked_by,
                           extract(epoch from run_after - now())::float8 as run_after_in_s
                    from jobs where id = %s
                    """,
                    [ids[label]],
                ).fetchone()
                assert row is not None, label
                columns = {k: v for k, v in want.items() if k != "run_after_in_s"}
                assert {k: row[k] for k in columns} == columns, label
                if "run_after_in_s" in want:
                    low, high = want["run_after_in_s"]
                    assert low <= row["run_after_in_s"] <= high, (label, row["run_after_in_s"])
        else:
            raise AssertionError(f"unknown step {op}")
