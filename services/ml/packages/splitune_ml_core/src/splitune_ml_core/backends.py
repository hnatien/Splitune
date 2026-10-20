"""Execution backends: real stages in island processes, or golden fixtures (ML_MODE=mock)."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol, cast

from . import contracts, ffmpeg
from .artefacts import rebrand, referenced_files
from .errors import StageError
from .islands import IslandProcess, island_env, island_python
from .paths import CONTRACT_FIXTURES_DIR
from .settings import Settings
from .stage_api import StageDescription, StageJob, StageOutput
from .stages import DESCRIBE_TIMEOUT_S, StageSpec


class Backend(Protocol):
    # False = no inputs are downloaded and no decoded audio is needed (mock mode).
    materializes_inputs: bool

    def describe(
        self, spec: StageSpec, params: dict[str, Any], inputs: dict[str, str]
    ) -> StageDescription: ...

    def run(self, spec: StageSpec, job: StageJob) -> StageOutput: ...

    def close(self) -> None: ...


class IslandBackend:
    """Owned by one worker slot; spawns each island lazily and keeps it warm."""

    materializes_inputs = True

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._islands: dict[str, IslandProcess] = {}

    def island(self, name: str) -> IslandProcess:
        if name not in self._islands:
            python = self._settings.island_python or island_python(name, self._settings.islands_dir)
            extra = {
                "ML_TORCH_DEVICE": self._settings.torch_device,
                "ML_MODELS_DIR": str(self._settings.models_dir.expanduser()),
            }
            if self._settings.ffmpeg_bin_dir is not None:
                extra["FFMPEG_BIN_DIR"] = str(self._settings.ffmpeg_bin_dir.expanduser())
            if self._settings.separation_config is not None:
                extra["ML_SEPARATION_CONFIG"] = str(self._settings.separation_config.expanduser())
            self._islands[name] = IslandProcess(name, python, island_env(name, extra))
        return self._islands[name]

    def describe(
        self, spec: StageSpec, params: dict[str, Any], inputs: dict[str, str]
    ) -> StageDescription:
        result = self.island(spec.island).call(
            "describe",
            {"stage": spec.name, "params": params, "inputs": inputs},
            DESCRIBE_TIMEOUT_S,
        )
        return StageDescription.model_validate(result)

    def run(self, spec: StageSpec, job: StageJob) -> StageOutput:
        result = self.island(spec.island).call(
            "run", {"job": job.model_dump(mode="json")}, spec.timeout_s
        )
        return StageOutput.model_validate(result)

    def close(self) -> None:
        for island in self._islands.values():
            island.close()
        self._islands.clear()


def _now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def tone(path: Path, duration_s: float) -> Path:
    """A quiet 220 Hz tone encoded like a real stem (format from the extension), so mock-mode
    stems.json points at playable audio."""
    codec = ["-c:a", "aac", "-b:a", "160k"] if path.suffix == ".m4a" else ["-c:a", "libopus"]
    path.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg.run(
        [
            ffmpeg.binary("ffmpeg"),
            "-nostdin",
            "-v",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"sine=frequency=220:sample_rate=44100:duration={duration_s}",
            "-af",
            "volume=0.1",
            "-ac",
            "2",
            *codec,
            str(path),
        ],
        timeout_s=60,
        error_code="mock_encode_failed",
        timeout_code="mock_encode_failed",
    )
    return path


class FixtureBackend:
    """ML_MODE=mock: every stage returns the contracts golden fixture for its artefact kinds, with
    the header re-issued for the requesting analysis. Used by API/web tests and CI."""

    materializes_inputs = False

    def __init__(self, fixtures_dir: Path | None = None) -> None:
        self._dir = fixtures_dir or CONTRACT_FIXTURES_DIR

    def fixture(self, kind: str) -> dict[str, Any]:
        candidates = [f"{kind}.json"]
        family = kind.split(".")[0]
        if family in {"notes", "tab"} and kind != "notes.drums":
            candidates.append(f"{family}.guitar.json")
        for name in candidates:
            path = self._dir / name
            if path.is_file():
                document = cast(dict[str, Any], json.loads(path.read_text(encoding="utf-8")))
                if "artefact" in document:
                    document["artefact"] = kind
                if family == "notes" and "instrument" in document:
                    document["instrument"] = kind.split(".")[1]
                return document
        raise StageError("mock_fixture_missing", retry=False)

    def probe(self) -> contracts.Probe:
        return contracts.Probe.model_validate(self.fixture("probe"))

    def describe(
        self, spec: StageSpec, params: dict[str, Any], inputs: dict[str, str] | None = None
    ) -> StageDescription:
        models = self.fixture(spec.outputs[spec.primary]).get("models", [])
        refs = [contracts.ModelRef.model_validate(m) for m in cast(list[Any], models)]
        return StageDescription(model_refs=refs, params=params)

    def run(self, spec: StageSpec, job: StageJob) -> StageOutput:
        files: dict[str, str] = {}
        blobs: dict[str, str] = {}
        for name, kind in spec.outputs.items():
            document = rebrand(
                self.fixture(kind),
                analysis_id=job.analysis_id,
                user_id=job.user_id,
                version=job.artefact_version,
                created_at=_now(),
            )
            path = Path(job.workdir) / f"{name}.json"
            path.write_text(json.dumps(document), encoding="utf-8")
            files[name] = str(path)
            for relative in referenced_files(kind, document):
                blobs[relative] = str(
                    tone(Path(job.workdir) / relative, float(document["duration_s"]))
                )
        probe = self.probe()
        return StageOutput(
            status="done",
            files=files,
            blobs=blobs,
            model_refs=self.describe(spec, job.params).model_refs,
            metrics={"cpu_s": 0.0, "audio_s": probe.duration_s},
            facts={"audio_hash": probe.audio_hash, "duration_s": probe.duration_s},
        )

    def close(self) -> None:
        return None
