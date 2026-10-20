"""The Mac ML worker: `uv run splitune-ml-worker`.

Slots claim jobs from Postgres (`runner = 'python'`) and run them through a backend: one MPS slot
for torch-island stages and up to two CPU slots (25-personal-mode.md §5). Idle slots sleep until
`NOTIFY jobs_python` or the 5 s poll. Each running job heartbeats every 15 s; the worker writes its
`worker_heartbeats` row every 30 s and re-queues stale jobs of crashed workers.
"""

from __future__ import annotations

import logging
import os
import signal
import socket
import threading
from collections.abc import Callable
from dataclasses import dataclass, field
from types import FrameType

import psycopg
from psycopg import sql

from . import __version__
from . import queue as q
from .backends import Backend, FixtureBackend, IslandBackend
from .db import connect, create_pool
from .executor import Services, execute
from .logs import configure_logging
from .settings import Settings, load_settings
from .stages import Slot, kinds_for
from .storage import Storage

log = logging.getLogger("splitune.worker")


class Wakeup:
    """Wakes idle slots on NOTIFY. The generation counter means a notification that arrives while
    a slot is busy claiming is not lost."""

    def __init__(self) -> None:
        self._cond = threading.Condition()
        self._generation = 0

    @property
    def generation(self) -> int:
        with self._cond:
            return self._generation

    def notify(self) -> None:
        with self._cond:
            self._generation += 1
            self._cond.notify_all()

    def wait(self, seen: int, timeout_s: float) -> None:
        with self._cond:
            if self._generation == seen:
                self._cond.wait(timeout_s)


@dataclass
class SlotState:
    name: str
    kinds: list[str]
    current_job: int | None = None
    processed: int = 0
    results: dict[str, int] = field(default_factory=dict[str, int])


class Worker:
    def __init__(
        self,
        settings: Settings,
        backend_factory: Callable[[], Backend] | None = None,
    ) -> None:
        self.settings = settings
        url = settings.database_url.get_secret_value()
        self._url = url
        slots = settings.mps_slots + settings.cpu_slots
        self.pool = create_pool(url, max_size=slots + 2)
        self.services = Services(settings, self.pool, Storage.from_settings(settings))
        if backend_factory is None:
            mock = settings.ml_mode == "mock"
            backend_factory = (
                (lambda: FixtureBackend(settings.fixtures_dir))
                if mock
                else (lambda: IslandBackend(settings))
            )
        self._backend_factory = backend_factory
        self.stop = threading.Event()
        self.wakeup = Wakeup()
        self.slots: list[SlotState] = []
        for kind, count in (("mps", settings.mps_slots), ("cpu", settings.cpu_slots)):
            slot_kind: Slot = "mps" if kind == "mps" else "cpu"
            for i in range(count):
                self.slots.append(SlotState(f"{kind}{i}", kinds_for(slot_kind)))
        self._threads: list[threading.Thread] = []

    def lock_id(self, slot: SlotState) -> str:
        return f"{self.settings.worker_id}:{slot.name}"

    # --- slots ------------------------------------------------------------------------------

    def _job_heartbeat(self, job_id: int, lock_id: str, done: threading.Event) -> None:
        while not done.wait(self.settings.job_heartbeat_s):
            try:
                with self.pool.connection() as conn:
                    if not q.heartbeat(conn, job_id, lock_id):
                        log.warning("job lock lost", extra={"job_id": job_id})
                        return
            except psycopg.Error:
                log.warning("job heartbeat failed", extra={"job_id": job_id})

    def run_slot(self, slot: SlotState) -> None:
        backend = self._backend_factory()
        lock_id = self.lock_id(slot)
        try:
            while not self.stop.is_set():
                seen = self.wakeup.generation
                try:
                    with self.pool.connection() as conn:
                        job = q.claim(conn, "python", lock_id, slot.kinds)
                except psycopg.Error:
                    log.warning("claim failed; retrying", extra={"slot": slot.name})
                    self.stop.wait(self.settings.poll_interval_s)
                    continue
                if job is None:
                    self.wakeup.wait(seen, self.settings.poll_interval_s)
                    continue
                slot.current_job = job.id
                done = threading.Event()
                beat = threading.Thread(
                    target=self._job_heartbeat, args=(job.id, lock_id, done), daemon=True
                )
                beat.start()
                try:
                    status = execute(self.services, backend, job, lock_id)
                except psycopg.Error:
                    # The database is unreachable: the job goes stale and is re-queued.
                    log.exception("lost database while finishing job", extra={"job_id": job.id})
                    status = "lost"
                finally:
                    done.set()
                    beat.join()
                    slot.current_job = None
                slot.processed += 1
                slot.results[status] = slot.results.get(status, 0) + 1
                if status == "done":
                    # Jobs that depended on this one may be runnable now; nothing NOTIFYs for that.
                    self.wakeup.notify()
        finally:
            backend.close()

    # --- background loops -------------------------------------------------------------------

    def listen(self) -> None:
        """LISTEN jobs_python on a dedicated connection; reconnects with backoff. The slots' 5 s
        poll covers notifications missed while disconnected."""
        delay = 1.0
        while not self.stop.is_set():
            try:
                with connect(self._url) as conn:
                    conn.execute(
                        sql.SQL("listen {}").format(sql.Identifier(q.channel_for("python")))
                    )
                    delay = 1.0
                    while not self.stop.is_set():
                        for _ in conn.notifies(timeout=1.0):
                            self.wakeup.notify()
            except psycopg.Error:
                log.warning("listen connection lost", extra={"retry_in_s": delay})
                self.stop.wait(delay)
                delay = min(delay * 2, 30.0)

    def write_presence(self, first: bool) -> None:
        with self.pool.connection() as conn:
            conn.execute(
                """
                insert into worker_heartbeats (worker_id, runner, hostname, version, started_at,
                                               heartbeat_at)
                values (%s, 'python', %s, %s, now(), now())
                on conflict (worker_id) do update
                  set hostname = excluded.hostname, version = excluded.version,
                      heartbeat_at = now(),
                      started_at = case when %s then now() else worker_heartbeats.started_at end
                """,
                [self.settings.worker_id, socket.gethostname(), __version__, first],
            )

    def housekeeping(self) -> None:
        first = True
        while not self.stop.is_set():
            try:
                self.write_presence(first)
                first = False
                with self.pool.connection() as conn:
                    requeued, failed = q.requeue_stale(conn, self.settings.stale_after_s)
                if requeued or failed:
                    log.info("stale jobs swept", extra={"requeued": requeued, "failed": failed})
                    self.wakeup.notify()
            except psycopg.Error:
                log.warning("housekeeping failed")
            self.stop.wait(self.settings.worker_heartbeat_s)

    # --- lifecycle --------------------------------------------------------------------------

    def start(self) -> None:
        targets: list[tuple[str, Callable[[], None]]] = [
            ("listen", self.listen),
            ("housekeeping", self.housekeeping),
        ]
        targets += [(f"slot-{s.name}", lambda s=s: self.run_slot(s)) for s in self.slots]
        for name, target in targets:
            thread = threading.Thread(target=target, name=name, daemon=True)
            thread.start()
            self._threads.append(thread)
        log.info(
            "worker started",
            extra={
                "worker_id": self.settings.worker_id,
                "mode": self.settings.ml_mode,
                "slots": {s.name: s.kinds for s in self.slots},
                "cache_scope": self.settings.cache_scope,
            },
        )

    def shutdown(self, timeout_s: float | None = None) -> None:
        """Stops claiming and waits for running jobs to finish."""
        self.stop.set()
        self.wakeup.notify()
        for thread in self._threads:
            thread.join(timeout_s)
        self.pool.close()


def main() -> None:
    settings = load_settings()
    configure_logging(settings.log_level)
    worker = Worker(settings)
    stopping = threading.Event()

    def on_signal(signum: int, _frame: FrameType | None) -> None:
        if stopping.is_set():
            log.warning("second signal; exiting now")
            os._exit(1)
        log.info("shutting down; finishing running jobs", extra={"signal": signum})
        stopping.set()

    signal.signal(signal.SIGTERM, on_signal)
    signal.signal(signal.SIGINT, on_signal)
    worker.start()
    while not stopping.wait(1.0):
        pass
    worker.shutdown()
    log.info("worker stopped")
