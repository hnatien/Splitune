"""Helpers for dev scripts and tests: seed an analysis as the table owner and build stage requests
the way the orchestrator will (step 09 owns the production version, in TypeScript)."""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

from .db import Connection
from .keys import analysis_prefix
from .stages import STAGES
from .storage import Storage

OUTPUT_FILES = {
    "decode": {"probe": "probe.json"},
    "beats": {"beats": "beats.json"},
    "tag": {"tags": "tags.json"},
    "separate": {"separation": "separation.json"},
    "stem_post": {"stems": "stems.json", "presence": "presence.json"},
    "chords": {"chords": "chords.json"},
    **{f"notes.{i}": {"notes": f"notes.{i}.json"} for i in ("guitar", "bass", "vocals")},
}
# Inputs that are upstream artefacts of the same analysis version.
INPUT_FILES = {
    "probe": "probe.json",
    "tags": "tags.json",
    "separation": "separation.json",
    "stems": "stems.json",
    "beats": "beats.json",
}


def seed_analysis(owner: Connection, user_id: str, instrument: str = "guitar") -> tuple[str, str]:
    """Creates (if needed) the user, plus a song and a queued analysis. Returns (song, analysis)."""
    owner.execute(
        "insert into users (id, email) values (%s, %s) on conflict (id) do nothing",
        [user_id, f"{user_id}@test.splitune.localhost"],
    )
    song = owner.execute(
        """
        insert into songs (user_id, title, source_kind, instrument)
        values (%s, 'Test song', 'upload', %s) returning id
        """,
        [user_id, instrument],
    ).fetchone()
    assert song is not None
    analysis = owner.execute(
        """
        insert into analyses (user_id, song_id, version, pipeline_version, config_profile,
                              requested_instrument, analysis_type, status, idempotency_key)
        values (%s, %s, 1, 'dev', 'personal', %s, 'full', 'queued', %s) returning id
        """,
        [user_id, song["id"], instrument, uuid.uuid4().hex],
    ).fetchone()
    assert analysis is not None
    return str(song["id"]), str(analysis["id"])


def upload_source(storage: Storage, user_id: str, path: Path) -> str:
    key = f"u/{user_id}/raw/{uuid.uuid4()}/source{path.suffix.lower() or '.bin'}"
    storage.put_file(key, path, "application/octet-stream")
    return key


def stage_request(
    stage: str,
    *,
    user_id: str,
    analysis_id: str,
    source_key: str,
    version: int = 1,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    base = f"{analysis_prefix(user_id, analysis_id)}v{version}/"
    spec = STAGES[stage]
    inputs = {"source": source_key}
    if spec.needs_audio:
        inputs["probe"] = f"{base}probe.json"
    for name in (*spec.downloads, *spec.optional_downloads):
        if name in INPUT_FILES:
            inputs[name] = base + INPUT_FILES[name]
    return {
        "analysis_id": analysis_id,
        "user_id": user_id,
        "stage": stage,
        "inputs": inputs,
        "outputs": {name: base + file for name, file in OUTPUT_FILES[stage].items()},
        "params": params or {},
    }
