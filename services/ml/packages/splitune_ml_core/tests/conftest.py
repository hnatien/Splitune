"""Integration fixtures: a throwaway database on the compose Postgres (migrated with the real
`packages/db` scripts) and the compose SeaweedFS bucket under a per-session user prefix."""

from __future__ import annotations

import os
import subprocess
import uuid
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import boto3
import psycopg
import pytest
from dotenv import dotenv_values
from psycopg import sql
from psycopg_pool import ConnectionPool
from splitune_ml_core.db import Connection, connect, create_pool
from splitune_ml_core.paths import REPO_ROOT
from splitune_ml_core.settings import Settings
from splitune_ml_core.storage import Storage


def _env() -> dict[str, str]:
    for name in (".env", ".env.example"):
        path = REPO_ROOT / name
        if path.is_file():
            values = {k: v for k, v in dotenv_values(path).items() if v is not None}
            return {**values, **os.environ}
    return dict(os.environ)


ENV = _env()


def _with(
    url: str, *, database: str | None = None, user: str | None = None, password: str = ""
) -> str:
    parts = urlsplit(url)
    netloc = parts.netloc
    if user is not None:
        netloc = f"{user}:{password}@{netloc.rsplit('@', 1)[-1]}"
    return urlunsplit(
        parts._replace(netloc=netloc, path=f"/{database}" if database else parts.path)
    )


@dataclass(frozen=True)
class ScratchDatabase:
    owner_url: str
    worker_url: str


@pytest.fixture(scope="session")
def database() -> Iterator[ScratchDatabase]:
    admin_url = ENV["DATABASE_URL"]
    name = f"splitune_test_{uuid.uuid4().hex[:12]}"
    with psycopg.connect(admin_url, autocommit=True) as admin:
        admin.execute(sql.SQL("create database {}").format(sql.Identifier(name)))
    url = _with(admin_url, database=name)
    try:
        env = {**ENV, "DATABASE_URL": url}
        for script in ("migrate.ts", "roles.ts"):
            subprocess.run(
                ["node", f"packages/db/scripts/{script}"],
                cwd=REPO_ROOT,
                env=env,
                check=True,
                capture_output=True,
            )
        worker_url = _with(url, user="ml_worker", password=ENV["DB_ML_WORKER_PASSWORD"])
        yield ScratchDatabase(owner_url=url, worker_url=worker_url)
    finally:
        with psycopg.connect(admin_url, autocommit=True) as admin:
            admin.execute(
                sql.SQL("drop database if exists {} with (force)").format(sql.Identifier(name))
            )


@pytest.fixture(scope="session")
def owner(database: ScratchDatabase) -> Iterator[Connection]:
    with connect(database.owner_url) as conn:
        yield conn


@pytest.fixture(scope="session")
def pool(database: ScratchDatabase) -> Iterator[ConnectionPool[Connection]]:
    p = create_pool(database.worker_url, max_size=12)
    yield p
    p.close()


@pytest.fixture
def worker_conn(pool: ConnectionPool[Connection]) -> Iterator[Connection]:
    with pool.connection() as conn:
        yield conn


@pytest.fixture(autouse=True)
def _clean_jobs(request: pytest.FixtureRequest) -> None:
    """Queue tests claim "any job": start each DB test from an empty queue."""
    if "owner" in request.fixturenames:
        conn: Connection = request.getfixturevalue("owner")
        conn.execute("delete from jobs")


SettingsFactory = Callable[..., Settings]


@pytest.fixture
def make_settings(database: ScratchDatabase, tmp_path: Path) -> SettingsFactory:
    def make(**overrides: Any) -> Settings:
        values: dict[str, Any] = {
            "ML_DATABASE_URL": database.worker_url,
            "S3_ENDPOINT": ENV["S3_ENDPOINT"],
            "S3_REGION": ENV.get("S3_REGION", "us-east-1"),
            "S3_BUCKET": ENV["S3_BUCKET"],
            "S3_ACCESS_KEY_ID": ENV["S3_ACCESS_KEY_ID"],
            "S3_SECRET_ACCESS_KEY": ENV["S3_SECRET_ACCESS_KEY"],
            "S3_FORCE_PATH_STYLE": ENV.get("S3_FORCE_PATH_STYLE", "true"),
            "ML_MODE": "mock",
            "ML_WORKER_ID": f"test-{uuid.uuid4().hex[:6]}",
            "ML_CACHE_DIR": str(tmp_path / "cache"),
            "ML_POLL_INTERVAL_S": 0.2,
            "ML_JOB_HEARTBEAT_S": 0.5,
            "ML_WORKER_HEARTBEAT_S": 0.5,
        }
        if ENV.get("FFMPEG_BIN_DIR"):
            values["FFMPEG_BIN_DIR"] = ENV["FFMPEG_BIN_DIR"]
        values.update(overrides)
        return Settings(_env_file=None, **values)  # pyright: ignore[reportCallIssue]

    return make


TEST_PREFIX = "u/pytest-"


@pytest.fixture(scope="session")
def storage() -> Iterator[Storage]:
    """The compose bucket; every object a test writes lives under u/pytest-*/ and is removed."""
    values = {
        "ML_DATABASE_URL": "postgres://unused",
        "S3_ENDPOINT": ENV["S3_ENDPOINT"],
        "S3_BUCKET": ENV["S3_BUCKET"],
        "S3_ACCESS_KEY_ID": ENV["S3_ACCESS_KEY_ID"],
        "S3_SECRET_ACCESS_KEY": ENV["S3_SECRET_ACCESS_KEY"],
        "S3_FORCE_PATH_STYLE": ENV.get("S3_FORCE_PATH_STYLE", "true"),
    }
    settings = Settings(_env_file=None, **values)  # pyright: ignore[reportCallIssue]
    yield Storage.from_settings(settings)
    client = boto3.client(  # pyright: ignore[reportUnknownMemberType]
        "s3",
        endpoint_url=settings.s3_endpoint,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key_id.get_secret_value(),
        aws_secret_access_key=settings.s3_secret_access_key.get_secret_value(),
    )
    for page in client.get_paginator("list_objects_v2").paginate(
        Bucket=settings.s3_bucket, Prefix=TEST_PREFIX
    ):
        for obj in page.get("Contents", []):
            client.delete_object(Bucket=settings.s3_bucket, Key=obj["Key"])  # pyright: ignore[reportTypedDictNotRequiredAccess]


@pytest.fixture
def user_id() -> str:
    return f"pytest-{uuid.uuid4().hex[:10]}"
