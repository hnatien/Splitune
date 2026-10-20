"""Postgres access as the restricted `ml_worker` role (psycopg 3)."""

from __future__ import annotations

import psycopg
from psycopg.rows import DictRow, dict_row
from psycopg_pool import ConnectionPool

Connection = psycopg.Connection[DictRow]


def connect(url: str) -> Connection:
    return psycopg.Connection[DictRow].connect(
        url, autocommit=True, row_factory=dict_row, application_name="splitune-ml"
    )


def _check(conn: Connection) -> None:
    conn.execute("select 1")


def create_pool(url: str, max_size: int) -> ConnectionPool[Connection]:
    """Autocommit connections; statements that belong together use `conn.transaction()`."""
    return ConnectionPool(
        url,
        connection_class=psycopg.Connection[DictRow],
        kwargs={"autocommit": True, "row_factory": dict_row, "application_name": "splitune-ml"},
        min_size=1,
        max_size=max_size,
        # The Railway TCP proxy drops idle connections; check before handing one out.
        check=_check,
        open=True,
    )
