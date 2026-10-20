"""Enqueue a decode → beats chain (or, with --separation, decode → {beats, tag} → separate →
stem_post) for a local audio file and report what the worker did.

    uv run splitune-ml-worker                                   # in another terminal
    uv run python scripts/run_chain.py SONG [--runs 2] [--user test-user] [--separation guitar]

Seeds a song and an analysis as the table owner (DATABASE_URL), uploads SONG to the user's raw
prefix, enqueues the two jobs (beats depends on decode) and waits for them. Every run after the
first re-enqueues the same analysis, so it must be served from the stage cache. Prints the jobs,
stage_runs, artefacts and job_events rows of each run.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

from splitune_ml_core import artefacts, devtools
from splitune_ml_core import queue as q
from splitune_ml_core.db import Connection, connect
from splitune_ml_core.settings import find_env_files, load_settings
from splitune_ml_core.storage import Storage


def owner_url() -> str:
    from dotenv import dotenv_values

    for path in find_env_files():
        url = dotenv_values(path).get("DATABASE_URL")
        if url:
            return url
    sys.exit("DATABASE_URL (table owner) not found in .env")


def wait(conn: Connection, ids: list[int], timeout_s: float) -> list[dict[str, Any]]:
    deadline = time.monotonic() + timeout_s
    while True:
        rows = conn.execute(
            "select id, kind, status, attempts, error_code, locked_by from jobs "
            "where id = any(%s) order by id",
            [ids],
        ).fetchall()
        if all(r["status"] in {"done", "failed", "cancelled"} for r in rows):
            return [dict(r) for r in rows]
        if time.monotonic() > deadline:
            sys.exit(f"timed out; is the worker running? {[dict(r) for r in rows]}")
        time.sleep(0.2)


def show(title: str, rows: list[dict[str, Any]]) -> None:
    print(f"\n{title}")
    for row in rows:
        print("  " + json.dumps(row, default=str))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("song", type=Path)
    parser.add_argument("--runs", type=int, default=2)
    parser.add_argument("--user", default="test-user")
    parser.add_argument("--timeout", type=float, default=600)
    parser.add_argument("--separation", metavar="INSTRUMENT", help="also tag/separate/stem_post")
    args = parser.parse_args()
    # The step-09 graph edges for these stages.
    graph: dict[str, list[str]] = {"decode": [], "beats": ["decode"]}
    if args.separation:
        graph |= {"tag": ["decode"], "separate": ["tag"], "stem_post": ["separate"]}

    storage = Storage.from_settings(load_settings())
    with connect(owner_url()) as conn:
        _, analysis_id = devtools.seed_analysis(conn, args.user)
        source_key = devtools.upload_source(storage, args.user, args.song)
        print(f"analysis {analysis_id}, source {source_key}")
        for run in range(1, args.runs + 1):
            started = time.monotonic()
            by_stage: dict[str, int] = {}
            for stage, deps in graph.items():
                payload = devtools.stage_request(
                    stage,
                    user_id=args.user,
                    analysis_id=analysis_id,
                    source_key=source_key,
                    params={"instrument": args.separation} if stage == "separate" else None,
                )
                job = q.enqueue(
                    conn,
                    stage,
                    "python",
                    payload,
                    analysis_id=analysis_id,
                    depends_on=[by_stage[d] for d in deps],
                )
                by_stage[stage] = job.id
            jobs = wait(conn, list(by_stage.values()), args.timeout)
            print(f"\n=== run {run}: {time.monotonic() - started:.2f} s end to end ===")
            show("jobs", jobs)
            show(
                "stage_runs",
                [
                    dict(r)
                    for r in conn.execute(
                        "select stage, status, attempts, left(cache_key, 16) as cache_key, "
                        "error_code, gpu_seconds, finished_at - started_at as took, model_refs "
                        "from stage_runs where analysis_id = %s order by started_at",
                        [analysis_id],
                    ).fetchall()
                ],
            )
            show(
                "artefacts",
                [
                    dict(r)
                    for r in conn.execute(
                        "select kind, version, object_key, bytes, left(sha256, 16) as sha256, "
                        "created_at from artefacts where analysis_id = %s order by kind",
                        [analysis_id],
                    ).fetchall()
                ],
            )
            show(
                "job_events",
                [
                    r["event"]
                    for r in conn.execute(
                        "select event from job_events where analysis_id = %s order by id",
                        [analysis_id],
                    ).fetchall()
                ],
            )
            for row in conn.execute(
                "select kind, object_key from artefacts where analysis_id = %s", [analysis_id]
            ).fetchall():
                key = str(row["object_key"])
                info = storage.head(key)
                print(f"  s3 {key}: {info.bytes if info else 'MISSING'} bytes")
                if row["kind"] == "stems":
                    stems = json.loads(storage.get_bytes(key, max_bytes=1 << 24))
                    for path in artefacts.referenced_files("stems", stems):
                        blob = storage.head(artefacts.blob_key(key, path))
                        print(f"    {path}: {blob.bytes if blob else 'MISSING'} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
