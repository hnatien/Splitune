"""python-audio-separator 0.44.5 behind a small interface (torch island only).

The library is driven with settings that keep its output usable for mix-minus: float WAV in and
out (no 16/24-bit clipping) and peak normalisation only above 0 dBFS (its default rescales every
stem to a 0.9 peak, which breaks `mixture - stem`). Per-model inference settings from the model
map override single keys of the library's `mdxc_params` / `demucs_params`. Its public `separate()`
logs and swallows exceptions, so the per-file method is called to see failures; the version is
pinned.
"""

from __future__ import annotations

import functools
import inspect
import logging
import os
import threading
import time
from collections.abc import Generator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

import torch
import yaml
from audio_separator.separator import Separator  # pyright: ignore[reportMissingTypeStubs]
from splitune_ml_core import contracts, register
from splitune_ml_core.device import empty_cache, peak_memory, torch_device
from splitune_ml_core.errors import StageError

from .config import ModelSpec

log = logging.getLogger("splitune.separate")

_lock = threading.Lock()

# The library's defaults per architecture; the model map overrides single keys.
LIBRARY_PARAMS: dict[str, dict[str, Any]] = {
    arch: dict(inspect.signature(Separator).parameters[f"{arch}_params"].default)
    for arch in ("mdxc", "demucs")
}


def models_dir() -> Path:
    return Path(os.environ.get("ML_MODELS_DIR", "~/.cache/splitune/models")).expanduser()


def model_ref(spec: ModelSpec) -> contracts.ModelRef:
    record = register.model(spec.record)
    return contracts.ModelRef(
        model_id=spec.provider,
        version=record.version,
        weights_sha256=record.weights.sha256,
        provider="self_hosted",
        register_tier=record.tier,
    )


def device() -> str:
    """Accelerator device (cuda | mps | cpu) driven by ML_TORCH_DEVICE."""
    return torch_device()


@dataclass
class _Loaded:
    name: str
    inference: dict[str, Any]
    separator: Any


_warm: _Loaded | None = None


def _ffmpeg_on_path() -> None:
    """The library shells out to a bare `ffmpeg` (version check, pydub)."""
    directory = os.environ.get("FFMPEG_BIN_DIR")
    if directory and directory not in os.environ.get("PATH", "").split(os.pathsep):
        os.environ["PATH"] = os.pathsep.join([directory, os.environ.get("PATH", "")])


@contextmanager
def _mask_estimator_width(config: Path) -> Generator[None]:
    """audio-separator (0.44-0.47) builds Mel-Band RoFormer mask estimators with the default MLP
    width and ignores the config's `mlp_expansion_factor`, so checkpoints trained with another
    width don't load. While loading, its MelBandRoformer gets mask estimators of the right width."""
    from audio_separator.separator.uvr_lib_v5.roformer import (  # pyright: ignore[reportMissingTypeStubs]
        mel_band_roformer,
    )

    # FullLoader: these configs carry !!python/tuple (no arbitrary objects).
    model = cast(
        dict[str, Any], yaml.load(config.read_text(encoding="utf-8"), Loader=yaml.FullLoader)
    )
    factor = int(cast(dict[str, Any], model.get("model", {})).get("mlp_expansion_factor", 4))
    original: Any = mel_band_roformer.MaskEstimator
    if factor != 4:
        mel_band_roformer.MaskEstimator = functools.partial(original, mlp_expansion_factor=factor)
    try:
        yield
    finally:
        mel_band_roformer.MaskEstimator = original


def _separator(name: str, spec: ModelSpec, output_dir: Path) -> Any:
    """One model stays loaded per island (they are 50-900 MB); switching models frees the last."""
    global _warm
    if _warm is not None and _warm.name == name and _warm.inference == spec.inference:
        # The loaded model instance copied output_dir at load time; both must move.
        _warm.separator.output_dir = str(output_dir)
        _warm.separator.model_instance.output_dir = str(output_dir)
        return _warm.separator
    release()
    register.verify(register.model(spec.record), models_dir() / "audio-separator")
    _ffmpeg_on_path()
    params = {**LIBRARY_PARAMS[spec.arch], **spec.inference}
    separator: Any = Separator(
        log_level=logging.ERROR,
        model_file_dir=str(models_dir() / "audio-separator"),
        output_dir=str(output_dir),
        output_format="WAV",
        normalization_threshold=1.0,
        amplification_threshold=0.0,
        sample_rate=44100,
        use_soundfile=True,
        mdxc_params=params if spec.arch == "mdxc" else LIBRARY_PARAMS["mdxc"],
        demucs_params=params if spec.arch == "demucs" else LIBRARY_PARAMS["demucs"],
    )
    # The library has no torch_device_cuda attribute (it builds its CUDA device inline).
    separator.torch_device = torch.device(device())
    if spec.config is not None:
        # Not in the library's catalogue: point its lookup at the files fetch_models.py placed.
        directory = models_dir() / "audio-separator"
        config = directory / spec.config

        def local_files(filename: str) -> tuple[str, str, str, str, str]:
            return filename, "MDXC", spec.provider, str(directory / filename), str(config)

        separator.download_model_files = local_files
        with _mask_estimator_width(config):
            separator.load_model(model_filename=spec.filename)  # pyright: ignore[reportUnknownMemberType]
    else:
        separator.load_model(model_filename=spec.filename)  # pyright: ignore[reportUnknownMemberType]
    _warm = _Loaded(name, dict(spec.inference), separator)
    return separator


def release() -> None:
    global _warm
    _warm = None
    empty_cache()


mps_peak = peak_memory


@dataclass(frozen=True)
class Result:
    files: dict[str, Path]  # model stem name -> float WAV (absent = the library wrote nothing)
    seconds: float
    peak_mb: float


def separate(name: str, spec: ModelSpec, audio: Path, output_dir: Path) -> Result:
    """Runs one model on a float WAV; StageError on any failure (the chain moves on)."""
    output_dir.mkdir(parents=True, exist_ok=True)
    names = {stem: stem for stem in spec.outputs}
    with _lock:
        try:
            separator = _separator(name, spec, output_dir)
            started = time.monotonic()
            with mps_peak() as peak:
                written = cast(
                    list[str],
                    separator._separate_file(str(audio), names),  # pyright: ignore[reportPrivateUsage]
                )
            seconds = time.monotonic() - started
        except StageError:
            raise
        except Exception as exc:
            release()  # don't keep a model whose last run broke
            text = str(exc).lower()
            if isinstance(exc, MemoryError) or "out of memory" in text:
                raise StageError("separation_oom") from exc
            raise StageError("separation_failed") from exc
    files: dict[str, Path] = {}
    for item in written:
        path = (Path(item) if Path(item).is_absolute() else output_dir / item).resolve()
        if path.parent != output_dir.resolve():
            raise StageError("separation_output_invalid")
        if path.stem in names and path.is_file():
            files[path.stem] = path
    if not files:  # the library skips only near-silent stems, never all of them
        raise StageError("separation_output_invalid")
    return Result(files=files, seconds=seconds, peak_mb=peak[0])
