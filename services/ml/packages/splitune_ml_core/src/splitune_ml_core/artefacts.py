"""Artefact writer: temp key → copy to the final key → `artefacts` row with sha256.

Re-running a stage writes the same final keys and upserts the same (analysis_id, kind, version)
row, so retries and crash recovery never leave duplicate rows.
"""

from __future__ import annotations

import hashlib
import json
import re
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from psycopg.types.json import Jsonb
from pydantic import BaseModel

from . import contracts
from .contracts import ModelRef
from .db import Connection
from .errors import StageError
from .storage import Storage

# JSON artefact kinds and the contract each must satisfy before upload.
SCHEMAS: dict[str, type[BaseModel]] = {
    "manifest": contracts.Manifest,
    "probe": contracts.Probe,
    "beats": contracts.Beats,
    "tags": contracts.Tags,
    "separation": contracts.Separation,
    "presence": contracts.Presence,
    "stems": contracts.Stems,
    "sections": contracts.Sections,
    "chords": contracts.Chords,
    "summary": contracts.Summary,
}


def schema_for(kind: str) -> type[BaseModel] | None:
    if kind in SCHEMAS:
        return SCHEMAS[kind]
    if kind == "notes.drums":
        return contracts.DrumNotes
    if kind.startswith("notes."):
        return contracts.Notes
    if kind.startswith("tab."):
        return contracts.Tab
    return None


def validate_artefact(kind: str, data: bytes) -> dict[str, Any]:
    """Parses a JSON artefact and checks it against its contract (and the schema major)."""
    schema = schema_for(kind)
    if schema is None:
        raise StageError("unknown_artefact_kind", retry=False)
    try:
        document: dict[str, Any] = json.loads(data)
        contracts.assert_compatible(str(document.get("schema_version", "")))
        schema.model_validate(document)
    except (ValueError, contracts.IncompatibleSchemaVersionError) as exc:
        raise StageError("artefact_invalid", retry=False) from exc
    if "artefact" in document and document["artefact"] != kind:
        raise StageError("artefact_invalid", retry=False)
    return document


# Binary objects an artefact points at, relative to its own directory (stems.json → stem audio).
_BLOB = re.compile(r"^stems/[a-z0-9][a-z0-9_.-]{0,63}\.(m4a|webm)$")
BLOB_TYPES = {".m4a": "audio/mp4", ".webm": "audio/webm"}


def referenced_files(kind: str, document: dict[str, Any]) -> list[str]:
    if kind != "stems":
        return []
    stems = contracts.Stems.model_validate(document)
    paths = [f.path for stem in stems.stems for f in stem.files]
    if not all(_BLOB.fullmatch(p) for p in paths) or len(set(paths)) != len(paths):
        raise StageError("artefact_invalid", retry=False)
    return paths


def blob_key(artefact_key: str, relative: str) -> str:
    """Bucket key of a file referenced by the artefact at `artefact_key`."""
    if not _BLOB.fullmatch(relative):
        raise StageError("artefact_invalid", retry=False)
    return f"{artefact_key.rpartition('/')[0]}/{relative}"


def rebrand(
    document: dict[str, Any], *, analysis_id: str, user_id: str, version: int, created_at: str
) -> dict[str, Any]:
    """A cached artefact re-issued for another analysis: same content, new header identity."""
    out = dict(document)
    out["analysis_id"] = analysis_id
    for key, value in (
        ("user_id", user_id),
        ("artefact_version", version),
        ("created_at", created_at),
    ):
        if key in out:
            out[key] = value
    return out


@dataclass(frozen=True)
class Written:
    kind: str
    version: int
    key: str
    sha256: str
    bytes: int


def put_atomic(storage: Storage, key: str, path: Path, content_type: str) -> None:
    """Uploads `path` to a temp key next to `key`, then copies it into place. Readers never see a
    partial object at the final key."""
    directory, _, name = key.rpartition("/")
    temp_key = f"{directory}/.tmp/{uuid.uuid4().hex}-{name}"
    storage.put_file(temp_key, path, content_type)
    try:
        storage.copy(temp_key, key)
    finally:
        storage.delete(temp_key)


def upload(storage: Storage, key: str, path: Path, kind: str, version: int) -> Written:
    data = path.read_bytes()
    validate_artefact(kind, data)
    put_atomic(storage, key, path, "application/json")
    return Written(
        kind=kind,
        version=version,
        key=key,
        sha256=hashlib.sha256(data).hexdigest(),
        bytes=len(data),
    )


def record(
    conn: Connection,
    *,
    user_id: str,
    analysis_id: str,
    written: Written,
    model_refs: list[ModelRef],
) -> str:
    """Inserts or refreshes the artefact row; returns its id."""
    row = conn.execute(
        """
        insert into artefacts (user_id, analysis_id, kind, version, object_key, bytes, sha256,
                               model_refs)
        values (%s, %s, %s, %s, %s, %s, %s, %s)
        on conflict (analysis_id, kind, version) do update
          set object_key = excluded.object_key,
              bytes = excluded.bytes,
              sha256 = excluded.sha256,
              model_refs = excluded.model_refs
        returning id
        """,
        [
            user_id,
            analysis_id,
            written.kind,
            written.version,
            written.key,
            written.bytes,
            written.sha256,
            Jsonb([m.model_dump(mode="json", exclude_none=True) for m in model_refs]),
        ],
    ).fetchone()
    assert row is not None
    return str(row["id"])
