"""Worker configuration from the environment (names follow the repo's `.env.example`)."""

from __future__ import annotations

import socket
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


def find_env_files(start: Path | None = None) -> tuple[Path, ...]:
    """`.env` and `.env.worker` from the nearest directory (cwd upwards) that has a `.env`."""
    here = (start or Path.cwd()).resolve()
    for directory in (here, *here.parents):
        if (directory / ".env").is_file():
            return tuple(p for p in (directory / ".env", directory / ".env.worker") if p.is_file())
    return ()


def _default_worker_id() -> str:
    return f"ml-{socket.gethostname().split('.')[0].lower()}"


class Settings(BaseSettings):
    # Empty values in .env mean "unset" (defaults and alias fallbacks apply).
    model_config = SettingsConfigDict(extra="ignore", frozen=True, env_ignore_empty=True)

    # The restricted ml_worker role. Railway: its TCP proxy URL with ml_worker credentials.
    database_url: SecretStr = Field(
        validation_alias=AliasChoices("ML_DATABASE_URL", "DATABASE_PUBLIC_URL")
    )

    s3_endpoint: str = Field(validation_alias="S3_ENDPOINT")
    s3_region: str = Field(default="us-east-1", validation_alias="S3_REGION")
    s3_bucket: str = Field(validation_alias="S3_BUCKET")
    s3_access_key_id: SecretStr = Field(validation_alias="S3_ACCESS_KEY_ID")
    s3_secret_access_key: SecretStr = Field(validation_alias="S3_SECRET_ACCESS_KEY")
    s3_force_path_style: bool = Field(default=False, validation_alias="S3_FORCE_PATH_STYLE")

    cache_scope: Literal["global", "user"] = Field(default="global", validation_alias="CACHE_SCOPE")
    ml_mode: Literal["mock", "local"] = Field(default="mock", validation_alias="ML_MODE")
    log_level: str = Field(default="info", validation_alias="LOG_LEVEL")

    worker_id: str = Field(default_factory=_default_worker_id, validation_alias="ML_WORKER_ID")
    # 25-personal-mode.md §5: one MPS job at a time, at most two CPU jobs.
    mps_slots: int = Field(default=1, ge=0, le=4, validation_alias="ML_MPS_SLOTS")
    cpu_slots: int = Field(default=2, ge=0, le=8, validation_alias="ML_CPU_SLOTS")
    # auto = MPS when available, else CPU (beats then falls back to the small model).
    torch_device: Literal["auto", "mps", "cpu"] = Field(
        default="auto", validation_alias="ML_TORCH_DEVICE"
    )

    # Decoded FLAC intermediates and per-job scratch space stay on the Mac's disk.
    cache_dir: Path = Field(default=Path("~/.cache/splitune/ml"), validation_alias="ML_CACHE_DIR")
    # Directory holding the ffmpeg/ffprobe binaries; empty = look them up on PATH.
    ffmpeg_bin_dir: Path | None = Field(default=None, validation_alias="FFMPEG_BIN_DIR")
    # Island venvs live in <islands_dir>/<name>/.venv (default services/ml/islands).
    # ML_ISLAND_PYTHON runs every island with one interpreter instead (tests, one-venv setups).
    islands_dir: Path | None = Field(default=None, validation_alias="ML_ISLANDS_DIR")
    island_python: Path | None = Field(default=None, validation_alias="ML_ISLAND_PYTHON")
    # Golden fixtures served by ML_MODE=mock.
    fixtures_dir: Path | None = Field(default=None, validation_alias="ML_FIXTURES_DIR")

    poll_interval_s: float = Field(default=5.0, gt=0, validation_alias="ML_POLL_INTERVAL_S")
    job_heartbeat_s: float = Field(default=15.0, gt=0, validation_alias="ML_JOB_HEARTBEAT_S")
    worker_heartbeat_s: float = Field(default=30.0, gt=0, validation_alias="ML_WORKER_HEARTBEAT_S")
    stale_after_s: float = Field(default=120.0, gt=0, validation_alias="ML_STALE_AFTER_S")

    @property
    def resolved_cache_dir(self) -> Path:
        return self.cache_dir.expanduser()


def load_settings() -> Settings:
    files = find_env_files()
    # Real environment variables win over the files (pydantic-settings precedence).
    return Settings(_env_file=files or None)  # pyright: ignore[reportCallIssue]
