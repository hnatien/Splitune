"""Runs one claimed stage job: validate → stage.started → resolve inputs → cache lookup → run →
artefacts → one transaction that records the result and completes the job.

The final transaction ends with the job's `complete` statement; if the lock was lost meanwhile
(stale re-queue), it rolls back and the result is discarded, so a job's bookkeeping is written
exactly once even when two workers ran it.
"""

from __future__ import annotations

import hashlib
import json
import logging
import shutil
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import psycopg
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool
from pydantic import ValidationError

from . import artefacts, contracts
from . import queue as q
from .backends import Backend, FixtureBackend
from .db import Connection
from .errors import StageError
from .keys import analysis_prefix, cache_key, is_safe_key, user_prefix
from .settings import Settings
from .stage_api import StageDescription, StageJob, StageOutput
from .stages import STAGES, StageSpec
from .storage import Storage

log = logging.getLogger("splitune.executor")

# Upload policy of the API (≤500 MB); decode refuses anything larger.
MAX_SOURCE_BYTES = 500 * 1024 * 1024
MAX_JSON_BYTES = 64 * 1024 * 1024


@dataclass(frozen=True)
class Services:
    settings: Settings
    pool: ConnectionPool[Connection]
    storage: Storage


@dataclass(frozen=True)
class Analysis:
    id: str
    user_id: str
    version: int


@dataclass(frozen=True)
class Prepared:
    audio_id: str  # cache-key audio component
    inputs: dict[str, str]
    audio_hash: str | None = None
    duration_s: float | None = None
    decoded_path: str | None = None


@dataclass(frozen=True)
class Outcome:
    status: str  # stage_runs status: done | fallback
    model_refs: list[contracts.ModelRef]
    written: list[artefacts.Written]
    metrics: dict[str, float]
    facts: dict[str, Any]
    cache_hit: bool


def _now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _event(conn: Connection, analysis: Analysis, event: dict[str, Any]) -> None:
    conn.execute(
        "insert into job_events (analysis_id, user_id, event) values (%s, %s, %s)",
        [analysis.id, analysis.user_id, Jsonb(event)],
    )


# --- validation -----------------------------------------------------------------------------


def parse_request(job: q.Job) -> contracts.StageRequest:
    try:
        request = contracts.StageRequest.model_validate(job.payload)
    except ValidationError as exc:
        raise StageError("invalid_request", retry=False) from exc
    if request.stage != job.kind or request.analysis_id != job.analysis_id:
        raise StageError("invalid_request", retry=False)
    return request


def load_analysis(conn: Connection, analysis_id: str) -> Analysis:
    row = conn.execute(
        "select id, user_id, version from analyses where id = %s", [analysis_id]
    ).fetchone()
    if row is None:
        raise StageError("analysis_missing", retry=False)
    return Analysis(id=str(row["id"]), user_id=str(row["user_id"]), version=int(row["version"]))


def check_request(request: contracts.StageRequest, spec: StageSpec, analysis: Analysis) -> None:
    """The payload must name the analysis' owner, read only inside that user's prefix and write
    only inside the analysis' prefix (same rule as packages/storage `assertOwnedKey`)."""
    if request.user_id != analysis.user_id:
        raise StageError("invalid_request", retry=False)
    if set(request.outputs) != set(spec.outputs):
        raise StageError("invalid_request", retry=False)
    own = user_prefix(analysis.user_id)
    out = analysis_prefix(analysis.user_id, analysis.id)
    if not all(is_safe_key(k) and k.startswith(own) for k in request.inputs.values()):
        raise StageError("invalid_request", retry=False)
    if not all(is_safe_key(k) and k.startswith(out) for k in request.outputs.values()):
        raise StageError("invalid_request", retry=False)
    missing = [
        n
        for n in (*spec.downloads, *(("probe",) if spec.needs_audio else ()))
        if n not in request.inputs
    ]
    if missing:
        raise StageError("invalid_request", retry=False)


# --- inputs ---------------------------------------------------------------------------------


def decoded_path(cache_dir: Path, audio_hash: str) -> Path:
    return cache_dir / "decoded" / f"{audio_hash}.flac"


def read_probe(storage: Storage, key: str) -> contracts.Probe:
    data = storage.get_bytes(key, max_bytes=MAX_JSON_BYTES)
    document = artefacts.validate_artefact("probe", data)
    return contracts.Probe.model_validate(document)


def prepare(
    services: Services,
    backend: Backend,
    request: contracts.StageRequest,
    spec: StageSpec,
    analysis: Analysis,
    workdir: Path,
) -> Prepared:
    if not backend.materializes_inputs:
        probe = cast(FixtureBackend, backend).probe()
        return Prepared(
            audio_id=probe.audio_hash,
            inputs={},
            audio_hash=probe.audio_hash,
            duration_s=probe.duration_s,
        )
    inputs: dict[str, str] = {}
    audio_id = ""
    wanted = [*spec.downloads, *(n for n in spec.optional_downloads if n in request.inputs)]
    for name in wanted:
        dest = workdir / "inputs" / name
        digest = services.storage.download(request.inputs[name], dest, max_bytes=MAX_SOURCE_BYTES)
        inputs[name] = str(dest)
        if name == "source":
            audio_id = digest
    if not spec.needs_audio:
        return Prepared(audio_id=audio_id, inputs=inputs)

    probe = read_probe(services.storage, request.inputs["probe"])
    flac = decoded_path(services.settings.resolved_cache_dir, probe.audio_hash)
    if not flac.is_file():
        rematerialize(services, backend, request, analysis, probe, workdir)
    return Prepared(
        audio_id=probe.audio_hash,
        inputs=inputs,
        audio_hash=probe.audio_hash,
        duration_s=probe.duration_s,
        decoded_path=str(flac),
    )


def rematerialize(
    services: Services,
    backend: Backend,
    request: contracts.StageRequest,
    analysis: Analysis,
    probe: contracts.Probe,
    workdir: Path,
) -> None:
    """The decoded FLAC is a local cache entry; when it's gone, decode `source` again."""
    source_key = request.inputs.get("source")
    if source_key is None:
        raise StageError("decoded_audio_missing", retry=False)
    log.info("re-decoding source", extra={"analysis_id": analysis.id, "stage": request.stage})
    redo = workdir / "redecode"
    source = redo / "inputs" / "source"
    services.storage.download(source_key, source, max_bytes=MAX_SOURCE_BYTES)
    decode = STAGES["decode"]
    out = backend.run(
        decode,
        StageJob(
            stage="decode",
            analysis_id=analysis.id,
            user_id=analysis.user_id,
            artefact_version=analysis.version,
            params=probe.params,
            inputs={"source": str(source)},
            workdir=str(redo),
            cache_dir=str(services.settings.resolved_cache_dir),
        ),
    )
    if out.facts.get("audio_hash") != probe.audio_hash:
        raise StageError("decoded_audio_mismatch", retry=False)


# --- cache ----------------------------------------------------------------------------------


@dataclass(frozen=True)
class Cached:
    analysis_id: str
    status: str
    rows: list[dict[str, Any]]  # artefact rows in output order


def find_cached(
    conn: Connection, key: str, analysis_id: str, kinds: list[str], *, reuse_fallback: bool = True
) -> Cached | None:
    """A stage run with this cache key and its artefact rows, this analysis first. This analysis'
    own row counts while it is being re-run (mark_started keeps its key; `finish` writes the key
    and the artefact rows in one transaction, so a matching key means matching rows)."""
    row = conn.execute(
        """
        select analysis_id, status from stage_runs
        where cache_key = %s and (status in ('done', 'fallback') or analysis_id = %s)
        order by (analysis_id = %s) desc, finished_at desc nulls last
        limit 1
        """,
        [key, analysis_id, analysis_id],
    ).fetchone()
    if row is None:
        return None
    source = str(row["analysis_id"])
    status = str(row["status"])
    if status == "fallback" and not reuse_fallback:
        return None
    rows = conn.execute(
        """
        select kind, version, object_key, sha256, bytes, model_refs from artefacts
        where analysis_id = %s and kind = any(%s)
        order by version desc
        """,
        [source, kinds],
    ).fetchall()
    latest: dict[str, dict[str, Any]] = {}
    for r in rows:
        latest.setdefault(str(r["kind"]), dict(r))
    if set(latest) != set(kinds):
        return None
    return Cached(
        analysis_id=source,
        status=status if status in {"done", "fallback"} else "done",
        rows=[latest[k] for k in kinds],
    )


def reuse_cached(
    services: Services,
    request: contracts.StageRequest,
    spec: StageSpec,
    analysis: Analysis,
    workdir: Path,
    cached: Cached,
) -> list[artefacts.Written] | None:
    """Same analysis: the artefacts are already in place. Another analysis: re-issue them under
    this analysis' keys and header. None when a cached object is gone or no longer matches its
    row (e.g. a later run with other params overwrote it and then failed)."""
    by_kind = {str(r["kind"]): r for r in cached.rows}
    written: list[artefacts.Written] = []
    for name, kind in spec.outputs.items():
        row = by_kind[kind]
        key = str(row["object_key"])
        target = request.outputs[name]
        if services.storage.head(key) is None:
            return None
        data = services.storage.get_bytes(key, max_bytes=MAX_JSON_BYTES)
        if hashlib.sha256(data).hexdigest() != str(row["sha256"]):
            return None
        document = artefacts.validate_artefact(kind, data)
        if not local_files_present(services, kind, document):
            return None
        if not reuse_blobs(services, kind, document, key, target):
            return None
        same = cached.analysis_id == analysis.id and int(row["version"]) == analysis.version
        if same and key == target:
            written.append(
                artefacts.Written(
                    kind=kind,
                    version=analysis.version,
                    key=key,
                    sha256=str(row["sha256"]),
                    bytes=int(row["bytes"]),
                )
            )
            continue
        copy = artefacts.rebrand(
            document,
            analysis_id=analysis.id,
            user_id=analysis.user_id,
            version=analysis.version,
            created_at=_now(),
        )
        path = workdir / "cached" / f"{name}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(copy), encoding="utf-8")
        written.append(artefacts.upload(services.storage, target, path, kind, analysis.version))
    return written


def separated_path(cache_dir: Path, file: str) -> Path:
    """Worker-local raw stems written by `separate` (contracts `SeparatedStem.file`)."""
    return cache_dir / "separated" / file


def local_files_present(services: Services, kind: str, document: dict[str, Any]) -> bool:
    """A cached `separation` is only usable while its raw stems are still on this Mac's disk."""
    if kind != "separation":
        return True
    separation = contracts.Separation.model_validate(document)
    cache_dir = services.settings.resolved_cache_dir
    return all(separated_path(cache_dir, s.file).is_file() for s in separation.stems)


def reuse_blobs(
    services: Services, kind: str, document: dict[str, Any], source_key: str, target_key: str
) -> bool:
    """Files the cached artefact points at must still exist; for another analysis they are
    copied next to its own artefact key first."""
    for relative in artefacts.referenced_files(kind, document):
        source = artefacts.blob_key(source_key, relative)
        if services.storage.head(source) is None:
            return False
        target = artefacts.blob_key(target_key, relative)
        if target != source:
            services.storage.copy(source, target)
    return True


def upload_blobs(
    services: Services, request: contracts.StageRequest, spec: StageSpec, out: StageOutput
) -> None:
    """Stem audio goes up before the JSON that points at it, so a reader that sees stems.json can
    always fetch its files. The set must match the outputs' references exactly."""
    referenced: set[str] = set()
    for name, kind in spec.outputs.items():
        document = cast(
            dict[str, Any], json.loads(Path(out.files[name]).read_text(encoding="utf-8"))
        )
        referenced |= set(artefacts.referenced_files(kind, document))
    if referenced != set(out.blobs):
        raise StageError("stage_output_missing", retry=False)
    anchor = request.outputs[spec.primary]
    for relative, path in sorted(out.blobs.items()):
        key = artefacts.blob_key(anchor, relative)
        content_type = artefacts.BLOB_TYPES[Path(relative).suffix]
        artefacts.put_atomic(services.storage, key, Path(path), content_type)


def cached_facts(
    services: Services, spec: StageSpec, written: list[artefacts.Written]
) -> dict[str, Any]:
    if spec.name != "decode":
        return {}
    probe = read_probe(services.storage, written[0].key)
    return {"audio_hash": probe.audio_hash, "duration_s": probe.duration_s}


# --- bookkeeping ----------------------------------------------------------------------------


def mark_started(
    conn: Connection, job: q.Job, analysis: Analysis, request: contracts.StageRequest
) -> None:
    with conn.transaction():
        conn.execute(
            """
            insert into stage_runs (analysis_id, stage, status, model_refs, cache_key, attempts,
                                    started_at)
            values (%s, %s, 'running', '[]'::jsonb, %s, %s, now())
            on conflict (analysis_id, stage) do update
              set status = 'running', attempts = excluded.attempts, error_code = null,
                  started_at = now(), finished_at = null
            """,
            [analysis.id, request.stage, request.cache_key or "", job.attempts],
        )
        _event(conn, analysis, {"type": "stage.started", "stage": request.stage, "at": _now()})


def finish(
    conn: Connection,
    job: q.Job,
    lock_id: str,
    analysis: Analysis,
    spec: StageSpec,
    key: str,
    outcome: Outcome,
) -> bool:
    """Records the result and completes the job atomically. False = lock lost (rolled back)."""
    try:
        with conn.transaction():
            ids: dict[str, str] = {}
            for w in outcome.written:
                ids[w.kind] = artefacts.record(
                    conn,
                    user_id=analysis.user_id,
                    analysis_id=analysis.id,
                    written=w,
                    model_refs=outcome.model_refs,
                )
            gpu_s = outcome.metrics.get("gpu_s")
            conn.execute(
                """
                update stage_runs
                set status = %s, model_refs = %s, cache_key = %s, error_code = null,
                    gpu_seconds = %s, finished_at = now()
                where analysis_id = %s and stage = %s
                """,
                [
                    outcome.status,
                    Jsonb(
                        [m.model_dump(mode="json", exclude_none=True) for m in outcome.model_refs]
                    ),
                    key,
                    gpu_s,
                    analysis.id,
                    spec.name,
                ],
            )
            if spec.name == "decode":
                update_song(conn, analysis, outcome.facts)
            primary_kind = spec.outputs[spec.primary]
            _event(
                conn,
                analysis,
                {
                    "type": "stage.completed",
                    "stage": spec.name,
                    "artefact": {
                        "id": ids[primary_kind],
                        "kind": primary_kind,
                        "version": analysis.version,
                    },
                    "at": _now(),
                },
            )
            if not q.complete(conn, job.id, lock_id):
                raise _LockLostError
    except _LockLostError:
        return False
    return True


class _LockLostError(Exception):
    pass


def update_song(conn: Connection, analysis: Analysis, facts: dict[str, Any]) -> None:
    """decode fills songs.audio_hash and duration_s. A second song of the same user with the same
    audio and instrument violates songs' unique key: that is the API's duplicate check to act on,
    so the song is left as it is."""
    try:
        with conn.transaction():
            conn.execute(
                """
                update songs set audio_hash = %s, duration_s = %s
                where id = (select song_id from analyses where id = %s)
                """,
                [facts["audio_hash"], round(float(facts["duration_s"]), 3), analysis.id],
            )
    except psycopg.errors.UniqueViolation:
        log.warning(
            "duplicate song audio",
            extra={"analysis_id": analysis.id, "error_code": "duplicate_audio_hash"},
        )


def record_failure(
    conn: Connection,
    job: q.Job,
    lock_id: str,
    analysis: Analysis | None,
    stage: str,
    error: StageError,
) -> str | None:
    """`fail` plus stage_runs/job_events in one transaction. Returns the new job status."""
    try:
        with conn.transaction():
            status = q.fail(conn, job.id, lock_id, error.code, retry=error.retry)
            if status is None:
                raise _LockLostError
            if analysis is not None and stage in STAGES:
                conn.execute(
                    """
                    update stage_runs set status = %s, error_code = %s,
                        finished_at = case when %s = 'failed' then now() end
                    where analysis_id = %s and stage = %s
                    """,
                    [
                        "failed" if status == "failed" else "pending",
                        error.code,
                        status,
                        analysis.id,
                        stage,
                    ],
                )
                if status == "failed":
                    _event(
                        conn,
                        analysis,
                        {
                            "type": "stage.failed",
                            "stage": stage,
                            "error_code": error.code,
                            "at": _now(),
                        },
                    )
            return status
    except _LockLostError:
        return None


# --- entry point ----------------------------------------------------------------------------


def compute_key(
    services: Services,
    request: contracts.StageRequest,
    analysis: Analysis,
    prepared: Prepared,
    description: StageDescription,
) -> str:
    if request.cache_key is not None:
        return request.cache_key
    scope = "global" if services.settings.cache_scope == "global" else analysis.user_id
    return cache_key(
        scope=scope,
        audio_id=prepared.audio_id,
        stage=request.stage,
        model_refs=description.model_refs,
        params=description.params,
    )


def run_stage(
    services: Services,
    backend: Backend,
    request: contracts.StageRequest,
    spec: StageSpec,
    analysis: Analysis,
    workdir: Path,
) -> tuple[str, Outcome]:
    prepared = prepare(services, backend, request, spec, analysis, workdir)
    description = backend.describe(spec, request.params, prepared.inputs)
    key = compute_key(services, request, analysis, prepared, description)
    kinds = list(spec.outputs.values())

    with services.pool.connection() as conn:
        cached = find_cached(conn, key, analysis.id, kinds, reuse_fallback=spec.reuse_fallback)
    if cached is not None:
        written = reuse_cached(services, request, spec, analysis, workdir, cached)
        if written is not None:
            refs = [
                contracts.ModelRef.model_validate(m)
                for m in cast(list[Any], cached.rows[0]["model_refs"])
            ]
            return key, Outcome(
                status=cached.status,
                model_refs=refs,
                written=written,
                metrics={},
                facts=cached_facts(services, spec, written),
                cache_hit=True,
            )

    out: StageOutput = backend.run(
        spec,
        StageJob(
            stage=spec.name,
            analysis_id=analysis.id,
            user_id=analysis.user_id,
            artefact_version=analysis.version,
            params=description.params,
            inputs=prepared.inputs,
            workdir=str(workdir),
            cache_dir=str(services.settings.resolved_cache_dir),
            audio_hash=prepared.audio_hash,
            duration_s=prepared.duration_s,
            decoded_path=prepared.decoded_path,
        ),
    )
    if set(out.files) != set(spec.outputs):
        raise StageError("stage_output_missing", retry=False)
    upload_blobs(services, request, spec, out)
    written = [
        artefacts.upload(
            services.storage, request.outputs[name], Path(out.files[name]), kind, analysis.version
        )
        for name, kind in spec.outputs.items()
    ]
    return key, Outcome(
        status=out.status,
        model_refs=out.model_refs,
        written=written,
        metrics=out.metrics,
        facts=out.facts,
        cache_hit=False,
    )


def execute(services: Services, backend: Backend, job: q.Job, lock_id: str) -> str:
    """Processes one claimed job. Returns the final job status ("done", "queued" for a retry,
    "failed", or "lost" when another worker took the job over)."""
    started = time.monotonic()
    context = {
        "job_id": job.id,
        "stage": job.kind,
        "analysis_id": job.analysis_id,
        "attempt": job.attempts,
    }
    analysis: Analysis | None = None
    workdir = services.settings.resolved_cache_dir / "jobs" / f"{job.id}-{job.attempts}"
    try:
        request = parse_request(job)
        spec = STAGES.get(request.stage)
        if spec is None:
            raise StageError("unsupported_stage", retry=False)
        with services.pool.connection() as conn:
            analysis = load_analysis(conn, request.analysis_id)
            check_request(request, spec, analysis)
            mark_started(conn, job, analysis, request)
        log.info("stage started", extra=context)
        workdir.mkdir(parents=True, exist_ok=True)
        key, outcome = run_stage(services, backend, request, spec, analysis, workdir)
        with services.pool.connection() as conn:
            done = finish(conn, job, lock_id, analysis, spec, key, outcome)
        if not done:
            log.warning("lock lost; result discarded", extra=context)
            return "lost"
        log.info(
            "stage done",
            extra={
                **context,
                "status": outcome.status,
                "cache_hit": outcome.cache_hit,
                "wall_s": round(time.monotonic() - started, 3),
                **outcome.metrics,
            },
        )
        return "done"
    except Exception as exc:
        error = exc if isinstance(exc, StageError) else StageError("internal_error")
        if not isinstance(exc, StageError):
            log.exception("stage crashed", extra=context)
        with services.pool.connection() as conn:
            status = record_failure(conn, job, lock_id, analysis, job.kind, error)
        log.warning(
            "stage failed",
            extra={
                **context,
                "error_code": error.code,
                "job_status": status or "lost",
                "wall_s": round(time.monotonic() - started, 3),
            },
        )
        return status or "lost"
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
