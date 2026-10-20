"""End-to-end: jobs enqueued in Postgres → worker → artefacts in SeaweedFS and rows in
stage_runs / artefacts / job_events (mock fixtures and real islands)."""

from __future__ import annotations

import hashlib
import json
import sys
import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from splitune_ml_core import contracts, devtools
from splitune_ml_core import queue as q
from splitune_ml_core.db import Connection
from splitune_ml_core.storage import Storage
from splitune_ml_core.worker import Worker

from .conftest import SettingsFactory

TERMINAL = {"done", "failed", "cancelled"}


def wait_for(owner: Connection, job_ids: list[int], timeout_s: float = 120) -> dict[int, Any]:
    deadline = time.monotonic() + timeout_s
    while True:
        rows = owner.execute(
            "select id, status, attempts, error_code from jobs where id = any(%s)", [job_ids]
        ).fetchall()
        by_id = {int(r["id"]): r for r in rows}
        if all(r["status"] in TERMINAL for r in rows):
            return by_id
        if time.monotonic() > deadline:
            raise AssertionError(f"jobs not finished: {by_id}")
        time.sleep(0.1)


@pytest.fixture
def running() -> Iterator[list[Worker]]:
    workers: list[Worker] = []
    yield workers
    for worker in workers:
        worker.shutdown(30)


def start(running: list[Worker], worker: Worker) -> Worker:
    worker.start()
    running.append(worker)
    return worker


def enqueue_chain(
    owner: Connection, storage: Storage, user_id: str, analysis_id: str, source: Path
) -> tuple[int, int, str]:
    source_key = devtools.upload_source(storage, user_id, source)
    decode = q.enqueue(
        owner,
        "decode",
        "python",
        devtools.stage_request(
            "decode", user_id=user_id, analysis_id=analysis_id, source_key=source_key
        ),
        analysis_id=analysis_id,
    )
    beats = q.enqueue(
        owner,
        "beats",
        "python",
        devtools.stage_request(
            "beats", user_id=user_id, analysis_id=analysis_id, source_key=source_key
        ),
        analysis_id=analysis_id,
        depends_on=[decode.id],
    )
    return decode.id, beats.id, source_key


def artefact_rows(owner: Connection, analysis_id: str) -> list[dict[str, Any]]:
    return [
        dict(r)
        for r in owner.execute(
            "select id, kind, version, object_key, sha256, bytes from artefacts "
            "where analysis_id = %s order by kind",
            [analysis_id],
        ).fetchall()
    ]


def events(owner: Connection, analysis_id: str) -> list[dict[str, Any]]:
    return [
        r["event"]
        for r in owner.execute(
            "select event from job_events where analysis_id = %s order by id", [analysis_id]
        ).fetchall()
    ]


def stage_runs(owner: Connection, analysis_id: str) -> dict[str, dict[str, Any]]:
    return {
        str(r["stage"]): dict(r)
        for r in owner.execute(
            "select * from stage_runs where analysis_id = %s", [analysis_id]
        ).fetchall()
    }


def check_artefacts(storage: Storage, rows: list[dict[str, Any]]) -> None:
    for row in rows:
        data = storage.get_bytes(row["object_key"], max_bytes=1 << 24)
        assert hashlib.sha256(data).hexdigest() == row["sha256"]
        assert len(data) == row["bytes"]
        document = json.loads(data)
        model = contracts.Probe if row["kind"] == "probe" else contracts.Beats
        model.model_validate(document)


def test_mock_chain_writes_fixtures_and_bookkeeping(
    owner: Connection,
    storage: Storage,
    make_settings: SettingsFactory,
    user_id: str,
    click_track: Any,
    running: list[Worker],
) -> None:
    _, analysis_id = devtools.seed_analysis(owner, user_id)
    decode_id, beats_id, _ = enqueue_chain(owner, storage, user_id, analysis_id, click_track())
    start(running, Worker(make_settings(ML_MODE="mock")))
    jobs = wait_for(owner, [decode_id, beats_id])
    assert [jobs[decode_id]["status"], jobs[beats_id]["status"]] == ["done", "done"]

    rows = artefact_rows(owner, analysis_id)
    assert [r["kind"] for r in rows] == ["beats", "probe"]
    check_artefacts(storage, rows)
    beats = json.loads(storage.get_bytes(rows[0]["object_key"], max_bytes=1 << 24))
    assert beats["analysis_id"] == analysis_id
    assert beats["user_id"] == user_id

    runs = stage_runs(owner, analysis_id)
    assert {s: r["status"] for s, r in runs.items()} == {"decode": "done", "beats": "done"}
    assert all(len(r["cache_key"]) == 64 and r["finished_at"] for r in runs.values())
    kinds = [(e["type"], e.get("stage")) for e in events(owner, analysis_id)]
    assert kinds == [
        ("stage.started", "decode"),
        ("stage.completed", "decode"),
        ("stage.started", "beats"),
        ("stage.completed", "beats"),
    ]
    for event in events(owner, analysis_id):
        contracts.StageStartedEvent.model_validate(event) if event[
            "type"
        ] == "stage.started" else contracts.StageCompletedEvent.model_validate(event)
    completed = [e for e in events(owner, analysis_id) if e["type"] == "stage.completed"]
    assert {e["artefact"]["id"] for e in completed} == {str(r["id"]) for r in rows}
    song = owner.execute(
        "select s.audio_hash, s.duration_s from songs s join analyses a on a.song_id = s.id "
        "where a.id = %s",
        [analysis_id],
    ).fetchone()
    assert song is not None
    assert song["audio_hash"] == beats["audio_hash"]
    heartbeat = owner.execute("select runner from worker_heartbeats").fetchall()
    assert {"runner": "python"} in heartbeat


def test_invalid_requests_fail_permanently(
    owner: Connection, make_settings: SettingsFactory, user_id: str, running: list[Worker]
) -> None:
    _, analysis_id = devtools.seed_analysis(owner, user_id)
    _, other_analysis = devtools.seed_analysis(owner, f"{user_id}-other")
    good = devtools.stage_request(
        "decode",
        user_id=user_id,
        analysis_id=analysis_id,
        source_key=f"u/{user_id}/raw/x/source.wav",
    )
    foreign_output = {
        **good,
        "outputs": {"probe": f"u/{user_id}-other/a/{other_analysis}/v1/probe.json"},
    }
    traversal = {**good, "inputs": {"source": f"u/{user_id}/../{user_id}-other/raw/x/source.wav"}}
    wrong_user = {**good, "user_id": f"{user_id}-other"}
    broken = {"stage": "decode"}
    ids = [
        q.enqueue(owner, "decode", "python", payload, analysis_id=analysis_id).id
        for payload in (foreign_output, traversal, wrong_user, broken)
    ]
    start(running, Worker(make_settings()))
    jobs = wait_for(owner, ids)
    assert {(r["status"], r["attempts"], r["error_code"]) for r in jobs.values()} == {
        ("failed", 1, "invalid_request")
    }
    assert artefact_rows(owner, analysis_id) == []


def test_rerun_hits_the_cache(
    owner: Connection,
    storage: Storage,
    make_settings: SettingsFactory,
    user_id: str,
    click_track: Any,
    running: list[Worker],
) -> None:
    _, analysis_id = devtools.seed_analysis(owner, user_id)
    source = click_track()
    first = enqueue_chain(owner, storage, user_id, analysis_id, source)
    worker = start(running, Worker(make_settings(ML_MODE="mock")))
    wait_for(owner, list(first[:2]))
    before = artefact_rows(owner, analysis_id)

    # Same analysis again: nothing is recomputed or re-uploaded.
    again = enqueue_chain(owner, storage, user_id, analysis_id, source)
    wait_for(owner, list(again[:2]))
    assert artefact_rows(owner, analysis_id) == before

    # Another analysis of the same audio: artefacts are re-issued under its own keys and header.
    _, second = devtools.seed_analysis(owner, user_id)
    other = enqueue_chain(owner, storage, user_id, second, source)
    wait_for(owner, list(other[:2]))
    reissued = artefact_rows(owner, second)
    assert [r["kind"] for r in reissued] == ["beats", "probe"]
    assert all(f"/a/{second}/" in r["object_key"] for r in reissued)
    check_artefacts(storage, reissued)
    keys = {s: r["cache_key"] for s, r in stage_runs(owner, second).items()}
    assert keys == {s: r["cache_key"] for s, r in stage_runs(owner, analysis_id).items()}
    results = {s.name: s.results for s in worker.slots}
    assert sum(sum(r.values()) for r in results.values()) == 6


@pytest.mark.parametrize("scope", ["global", "user"])
def test_cache_scope(
    scope: str,
    owner: Connection,
    storage: Storage,
    make_settings: SettingsFactory,
    user_id: str,
    click_track: Any,
    running: list[Worker],
) -> None:
    source = click_track()
    _, mine = devtools.seed_analysis(owner, user_id)
    _, theirs = devtools.seed_analysis(owner, f"{user_id}-b")
    start(running, Worker(make_settings(CACHE_SCOPE=scope)))
    a = enqueue_chain(owner, storage, user_id, mine, source)
    wait_for(owner, list(a[:2]))
    b = enqueue_chain(owner, storage, f"{user_id}-b", theirs, source)
    wait_for(owner, list(b[:2]))
    same = (
        stage_runs(owner, mine)["beats"]["cache_key"]
        == stage_runs(owner, theirs)["beats"]["cache_key"]
    )
    assert same is (scope == "global")


@pytest.mark.models
def test_local_chain_with_islands(
    owner: Connection,
    storage: Storage,
    make_settings: SettingsFactory,
    user_id: str,
    click_track: Any,
    running: list[Worker],
) -> None:
    """Real decode (ffmpeg) and beats (beat_this) in island processes, then a re-run on a cleared
    local cache: decode's artefact comes from the cache and beats re-decodes the source."""
    _, analysis_id = devtools.seed_analysis(owner, user_id)
    source = click_track(bpm=120, seconds=20)
    settings = make_settings(ML_MODE="local", ML_ISLAND_PYTHON=sys.executable)
    start(running, Worker(settings))
    decode_id, beats_id, _ = enqueue_chain(owner, storage, user_id, analysis_id, source)
    jobs = wait_for(owner, [decode_id, beats_id], timeout_s=600)
    assert [jobs[decode_id]["status"], jobs[beats_id]["status"]] == ["done", "done"]
    rows = artefact_rows(owner, analysis_id)
    check_artefacts(storage, rows)
    beats = json.loads(storage.get_bytes(rows[0]["object_key"], max_bytes=1 << 24))
    probe = json.loads(storage.get_bytes(rows[1]["object_key"], max_bytes=1 << 24))
    assert abs(beats["bpm"] - 120) < 2
    assert beats["audio_hash"] == probe["audio_hash"]
    assert probe["decoded_frames"] == 20 * 44100
    flac = settings.resolved_cache_dir / "decoded" / f"{probe['audio_hash']}.flac"
    assert flac.is_file()

    flac.unlink()
    _, second = devtools.seed_analysis(owner, user_id)
    d2, b2, _ = enqueue_chain(owner, storage, user_id, second, source)
    jobs = wait_for(owner, [d2, b2], timeout_s=600)
    assert jobs[b2]["status"] == "done"
    assert flac.is_file()  # re-materialised from the source by the beats job


def enqueue_separation(
    owner: Connection,
    storage: Storage,
    user_id: str,
    analysis_id: str,
    source: Path,
    instrument: str = "guitar",
) -> dict[str, int]:
    """decode → tag → separate → stem_post, with the step-09 dependency edges."""
    source_key = devtools.upload_source(storage, user_id, source)
    ids: dict[str, int] = {}
    edges = {"decode": [], "tag": ["decode"], "separate": ["tag"], "stem_post": ["separate"]}
    for stage, deps in edges.items():
        params = {"instrument": instrument} if stage == "separate" else {}
        ids[stage] = q.enqueue(
            owner,
            stage,
            "python",
            devtools.stage_request(
                stage,
                user_id=user_id,
                analysis_id=analysis_id,
                source_key=source_key,
                params=params,
            ),
            analysis_id=analysis_id,
            depends_on=[ids[d] for d in deps],
        ).id
    return ids


def stems_document(storage: Storage, owner: Connection, analysis_id: str) -> tuple[str, Any]:
    row = next(r for r in artefact_rows(owner, analysis_id) if r["kind"] == "stems")
    data = storage.get_bytes(row["object_key"], max_bytes=1 << 24)
    return str(row["object_key"]), contracts.Stems.model_validate(json.loads(data))


def test_mock_separation_chain_uploads_stem_audio(
    owner: Connection,
    storage: Storage,
    make_settings: SettingsFactory,
    user_id: str,
    click_track: Any,
    running: list[Worker],
) -> None:
    _, analysis_id = devtools.seed_analysis(owner, user_id)
    source = click_track()
    ids = enqueue_separation(owner, storage, user_id, analysis_id, source)
    start(running, Worker(make_settings(ML_MODE="mock")))
    jobs = wait_for(owner, list(ids.values()))
    assert {s: jobs[i]["status"] for s, i in ids.items()} == dict.fromkeys(ids, "done")
    kinds = sorted(r["kind"] for r in artefact_rows(owner, analysis_id))
    assert kinds == ["presence", "probe", "separation", "stems", "tags"]
    key, stems = stems_document(storage, owner, analysis_id)
    directory = key.rpartition("/")[0]
    for stem in stems.stems:
        for file in stem.files:
            info = storage.head(f"{directory}/{file.path}")
            assert info is not None, file.path
    completed = [e for e in events(owner, analysis_id) if e["type"] == "stage.completed"]
    assert [e["stage"] for e in completed] == ["decode", "tag", "separate", "stem_post"]

    # Another analysis of the same audio reuses stem_post's result: the audio is copied over.
    _, second = devtools.seed_analysis(owner, user_id)
    again = enqueue_separation(owner, storage, user_id, second, source)
    wait_for(owner, list(again.values()))
    key2, stems2 = stems_document(storage, owner, second)
    assert f"/a/{second}/" in key2
    directory2 = key2.rpartition("/")[0]
    assert [s.model_dump() for s in stems2.stems] == [s.model_dump() for s in stems.stems]
    for stem in stems2.stems:
        for file in stem.files:
            assert storage.head(f"{directory2}/{file.path}") is not None


def models_subset(tmp_path: Path, records: list[str]) -> Path:
    """A models dir holding only these register entries (symlinks to the downloaded weights)."""
    from splitune_ml_core import register

    real = Path("~/.cache/splitune/models").expanduser()
    for record_id in records:
        record = register.model(record_id)
        folder = "panns" if record_id == "panns-cnn14" else "audio-separator"
        (tmp_path / "models" / folder).mkdir(parents=True, exist_ok=True)
        for entry in record.weights.files:
            (tmp_path / "models" / folder / entry.name).symlink_to(real / folder / entry.name)
    return tmp_path / "models"


@pytest.mark.models
def test_local_separation_chain_falls_back_then_gives_up(
    owner: Connection,
    storage: Storage,
    make_settings: SettingsFactory,
    user_id: str,
    click_track: Any,
    running: list[Worker],
    tmp_path: Path,
) -> None:
    """Real islands. Without BS-Roformer-SW's weights the guitar chain falls back to htdemucs_6s
    and still yields aligned stems, mix-minus and presence; with no separation weights at all,
    separate fails with stems_unavailable and stem_post is cancelled."""
    source = click_track(bpm=100, seconds=12)
    settings = make_settings(
        ML_MODE="local",
        ML_ISLAND_PYTHON=sys.executable,
        ML_MODELS_DIR=str(models_subset(tmp_path, ["htdemucs-6s", "panns-cnn14"])),
    )
    worker = start(running, Worker(settings))
    _, analysis_id = devtools.seed_analysis(owner, user_id)
    ids = enqueue_separation(owner, storage, user_id, analysis_id, source)
    jobs = wait_for(owner, list(ids.values()), timeout_s=900)
    assert {s: jobs[i]["status"] for s, i in ids.items()} == dict.fromkeys(ids, "done")
    runs = stage_runs(owner, analysis_id)
    assert runs["separate"]["status"] == "fallback"
    assert runs["tag"]["status"] == "done"
    key, stems = stems_document(storage, owner, analysis_id)
    assert {s.stem_id for s in stems.stems} >= {"guitar", "mix_minus_guitar"}
    assert {s.provider for s in stems.stems} == {"htdemucs_6s"}
    directory = key.rpartition("/")[0]
    for stem in stems.stems:
        for file in stem.files:
            assert storage.head(f"{directory}/{file.path}") is not None
    worker.shutdown(60)
    running.remove(worker)

    empty = make_settings(
        ML_MODE="local",
        ML_ISLAND_PYTHON=sys.executable,
        ML_MODELS_DIR=str(models_subset(tmp_path / "none", ["panns-cnn14"])),
    )
    start(running, Worker(empty))
    _, failed = devtools.seed_analysis(owner, user_id)
    ids = enqueue_separation(owner, storage, user_id, failed, click_track("other.wav", seconds=6))
    jobs = wait_for(owner, list(ids.values()), timeout_s=600)
    outcome = {s: (jobs[i]["status"], jobs[i]["error_code"]) for s, i in ids.items()}
    assert outcome == {
        "decode": ("done", None),
        "tag": ("done", None),
        "separate": ("failed", "stems_unavailable"),
        "stem_post": ("cancelled", "dependency_failed"),
    }
    assert stage_runs(owner, failed)["separate"]["error_code"] == "stems_unavailable"
    failures = [e for e in events(owner, failed) if e["type"] == "stage.failed"]
    assert [(e["stage"], e["error_code"]) for e in failures] == [("separate", "stems_unavailable")]
