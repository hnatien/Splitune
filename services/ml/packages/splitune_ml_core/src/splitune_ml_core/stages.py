"""Stage registry: where each job kind runs and what it reads and writes (06 §0, §2)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, cast

import yaml

from .paths import ML_ROOT

Island = Literal["torch", "onnx-cpu", "legacy"]
Slot = Literal["gpu", "cpu"]


@dataclass(frozen=True)
class StageSpec:
    name: str
    module: str  # stage module imported inside the island
    island: Island
    slot: Slot
    timeout_s: float  # wall time of one `run` call
    outputs: dict[str, str]  # output name -> artefact kind
    primary: str  # output reported in stage.completed
    downloads: tuple[str, ...] = ()  # inputs fetched to local disk before `run`
    # Fetched when the request names them and an artefact row records the object, i.e. the
    # upstream stage succeeded (no separation when stems_unavailable).
    optional_downloads: tuple[str, ...] = ()
    # Resolves the decoded FLAC (and audio_hash) from the `probe` input, re-decoding `source`
    # when the local cache no longer has it.
    needs_audio: bool = False
    # False: a cached `fallback` result is recomputed instead of reused (the failure that caused
    # it, e.g. an MPS out-of-memory, may be gone by now).
    reuse_fallback: bool = True
    # What the analysis does when this stage fails for good (06 §6), sent as `stage.failed`'s
    # `fallback`. None = critical: nothing downstream can make up for it.
    failure_fallback: str | None = None
    # Outputs are raw objects under the user's raw/ prefix (no artefact rows, no stage cache):
    # url_import's downloaded audio and video.
    raw_outputs: bool = False


STAGES: dict[str, StageSpec] = {
    "url_import": StageSpec(
        name="url_import",
        module="stage_url_import.stage",
        island="onnx-cpu",
        slot="cpu",
        timeout_s=300,  # 06 §0
        outputs={"source": "source", "video": "video"},  # video only when requested
        primary="source",
        raw_outputs=True,
    ),
    "decode": StageSpec(
        name="decode",
        module="stage_decode.stage",
        island="onnx-cpu",
        slot="cpu",
        timeout_s=180,  # download + ffprobe + 120 s decode budget + FLAC encode
        outputs={"probe": "probe"},
        primary="probe",
        downloads=("source",),
    ),
    "beats": StageSpec(
        name="beats",
        module="stage_beats.stage",
        island="torch",
        slot="gpu",
        timeout_s=120,  # 60 s budget (06 §2) + cold model load
        outputs={"beats": "beats"},
        primary="beats",
        needs_audio=True,
    ),
    "tag": StageSpec(
        name="tag",
        module="stage_tagger.stage",
        island="onnx-cpu",
        slot="cpu",
        timeout_s=120,  # 60 s budget (06 §2) + cold model load
        outputs={"tags": "tags"},
        primary="tags",
        needs_audio=True,
        failure_fallback="tagger_unavailable",
    ),
    "separate": StageSpec(
        name="separate",
        module="stage_separation.separate",
        island="torch",
        slot="gpu",
        timeout_s=1500,  # 600 s per model (06 §2) for up to two chain entries + model loads
        outputs={"separation": "separation"},
        primary="separation",
        optional_downloads=("tags",),
        needs_audio=True,
        reuse_fallback=False,
        failure_fallback="stems_unavailable",
    ),
    "stem_post": StageSpec(
        name="stem_post",
        module="stage_separation.stem_post",
        island="onnx-cpu",
        slot="cpu",
        timeout_s=300,  # 180 s budget (06 §2) + encodes of up to ~6 stems
        outputs={"stems": "stems", "presence": "presence"},
        primary="stems",
        downloads=("separation",),
        optional_downloads=("tags",),
        needs_audio=True,
        failure_fallback="stems_unavailable",
    ),
    "chords": StageSpec(
        name="chords",
        module="stage_chords.stage",
        island="torch",
        slot="gpu",
        timeout_s=300,  # 120 s budget (06 §2) for up to two inputs + key + cold model loads
        outputs={"chords": "chords"},
        primary="chords",
        downloads=("beats",),
        optional_downloads=("separation", "stems"),
        needs_audio=True,
        failure_fallback="chords_unavailable",
    ),
}

NOTES_CONFIG = ML_ROOT / "config" / "notes.personal.yaml"
# The transcriber chosen per instrument decides where its notes stage runs.
TRANSCRIBER_ISLANDS: dict[str, tuple[Island, Slot]] = {
    "basic_pitch": ("onnx-cpu", "cpu"),
    "yourmt3": ("torch", "gpu"),
    "transkun": ("torch", "gpu"),
}


def notes_placement(instrument: str) -> tuple[Island, Slot]:
    raw = os.environ.get("ML_NOTES_CONFIG")
    path = Path(raw).expanduser() if raw else NOTES_CONFIG
    config = cast(dict[str, Any], yaml.safe_load(path.read_text(encoding="utf-8")))
    transcriber = str(config["instruments"][instrument]["transcriber"])
    return TRANSCRIBER_ISLANDS[transcriber]


def notes_spec(instrument: str) -> StageSpec:
    island, slot = notes_placement(instrument)
    return StageSpec(
        name=f"notes.{instrument}",
        module=f"stage_notes.{instrument}",
        island=island,
        slot=slot,
        timeout_s=240,  # 180 s budget (06 §2) + cold model load
        outputs={"notes": f"notes.{instrument}"},
        primary="notes",
        optional_downloads=("separation", "stems"),
        needs_audio=True,
        failure_fallback="notes_unavailable",
    )


for _instrument in ("guitar", "bass", "piano", "vocals"):
    STAGES[f"notes.{_instrument}"] = notes_spec(_instrument)

DESCRIBE_TIMEOUT_S = 600.0  # first describe may download model weights


def kinds_for(slot: Slot) -> list[str]:
    return sorted(name for name, spec in STAGES.items() if spec.slot == slot)
