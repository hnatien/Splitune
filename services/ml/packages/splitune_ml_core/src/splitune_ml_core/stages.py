"""Stage registry: where each job kind runs and what it reads and writes (06 §0, §2)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Island = Literal["torch", "onnx-cpu", "legacy"]
Slot = Literal["mps", "cpu"]


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
    # Resolves the decoded FLAC (and audio_hash) from the `probe` input, re-decoding `source`
    # when the local cache no longer has it.
    needs_audio: bool = False


STAGES: dict[str, StageSpec] = {
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
        slot="mps",
        timeout_s=120,  # 60 s budget (06 §2) + cold model load
        outputs={"beats": "beats"},
        primary="beats",
        needs_audio=True,
    ),
}

DESCRIBE_TIMEOUT_S = 600.0  # first describe may download model weights


def kinds_for(slot: Slot) -> list[str]:
    return sorted(name for name, spec in STAGES.items() if spec.slot == slot)
