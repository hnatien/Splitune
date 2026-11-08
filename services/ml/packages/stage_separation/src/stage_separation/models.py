"""python-audio-separator 0.44.5 behind a small interface (torch island only).

The library is driven with settings that keep its output usable for mix-minus: float WAV in and
out (no 16/24-bit clipping) and no peak normalisation. Its default rescales every stem peaking
above 0.9, and its constructor refuses thresholds above 1.0, yet on a loud master a stem often
peaks above full scale while the mixture doesn't (stems cancel in the sum): 121 of BS-Roformer-SW's
300 outputs on the limit-XL P1 windows were rescaled, which broke `mixture - stem` (step 28). The
threshold is therefore lifted on the instance before the model loads. Per-model inference settings
from the model map override single keys of the library's `mdxc_params` / `demucs_params`. Its
public `separate()` logs and swallows exceptions, so the per-file method is called to see failures;
the version is pinned.

Step 29 adds settings the wrapper applies itself (`config.WrapperInference`, MDXC `chunk` and
`shifts`); a map entry without them runs exactly as before. `chunk` sets the library's
`segment_size` (chunk = hop * (segment_size - 1)). The library switches a loaded MDXC model to its
256-frame segment for any input under 10 s and never switches back, so every run restores the
configured segment first. Gain, shifts and a 48 kHz model run each pass on a float WAV the wrapper
writes and average or rescale the float outputs.
"""

from __future__ import annotations

import functools
import inspect
import logging
import math
import os
import shutil
import threading
import time
from collections.abc import Generator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
import torch
import yaml
from audio_separator.separator import Separator  # pyright: ignore[reportMissingTypeStubs]
from numpy.typing import NDArray
from scipy.signal import resample_poly  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]
from splitune_ml_core import contracts, register
from splitune_ml_core.device import empty_cache, peak_memory, torch_device
from splitune_ml_core.errors import StageError

from .config import ModelSpec
from .dsp import loudness_lufs

log = logging.getLogger("splitune.separate")

_lock = threading.Lock()

RATE = 44100

# The library's defaults per architecture; the model map overrides single keys.
LIBRARY_PARAMS: dict[str, dict[str, Any]] = {
    arch: dict(inspect.signature(Separator).parameters[f"{arch}_params"].default)
    for arch in ("mdxc", "demucs")
}
# Inference keys the wrapper applies itself; the rest go to the library's `<arch>_params`.
WRAPPER_KEYS: dict[str, frozenset[str]] = {
    "mdxc": frozenset({"gain", "autocast", "sample_rate", "chunk", "shifts"}),
    "demucs": frozenset({"gain", "autocast", "sample_rate"}),
}


def library_params(spec: ModelSpec) -> dict[str, Any]:
    own = {k: v for k, v in spec.inference.items() if k not in WRAPPER_KEYS[spec.arch]}
    return {**LIBRARY_PARAMS[spec.arch], **own}


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
    # (override_model_segment_size, segment_size) restored before every MDXC run.
    segment: tuple[bool, int] | None = None


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


def _output_dir(separator: Any, output_dir: Path) -> None:
    """The loaded model instance copied output_dir at load time; both must move."""
    separator.output_dir = str(output_dir)
    separator.model_instance.output_dir = str(output_dir)


def _stft_hop(instance: Any) -> int:
    """The hop the library builds an MDXC chunk from (RoFormers: the model's STFT hop)."""
    cfg = instance.model_data_cfgdict
    if getattr(instance, "is_roformer", False):
        hop = getattr(cfg.model, "stft_hop_length", None)
        if hop is not None:
            return int(hop)
    return int(cfg.audio.hop_length)


def _segment(spec: ModelSpec, separator: Any) -> tuple[bool, int] | None:
    """The MDXC segment setting to restore before each run: the library default, or the one
    that makes the window `chunk` samples long."""
    if spec.arch != "mdxc":
        return None
    chunk = spec.inference.get("chunk")
    if chunk is None:
        params = LIBRARY_PARAMS["mdxc"]
        return bool(params["override_model_segment_size"]), int(params["segment_size"])
    hop = _stft_hop(separator.model_instance)
    if chunk % hop:
        raise StageError("separation_config_invalid", retry=False)
    return True, chunk // hop + 1


def _separator(name: str, spec: ModelSpec, output_dir: Path) -> Any:
    """One model stays loaded per island (they are 50-900 MB); switching models frees the last."""
    global _warm
    if _warm is not None and _warm.name == name and _warm.inference == spec.inference:
        _output_dir(_warm.separator, output_dir)
        return _warm.separator
    release()
    register.verify(register.model(spec.record), models_dir() / "audio-separator")
    _ffmpeg_on_path()
    params = library_params(spec)
    separator: Any = Separator(
        log_level=logging.ERROR,
        model_file_dir=str(models_dir() / "audio-separator"),
        output_dir=str(output_dir),
        output_format="WAV",
        normalization_threshold=1.0,
        amplification_threshold=0.0,
        sample_rate=int(spec.inference.get("sample_rate", RATE)),
        use_soundfile=True,
        # Measured on CUDA only (08, step 29): MPS and CPU keep fp32 until measured there.
        use_autocast=bool(spec.inference.get("autocast", False)) and device() == "cuda",
        mdxc_params=params if spec.arch == "mdxc" else LIBRARY_PARAMS["mdxc"],
        demucs_params=params if spec.arch == "demucs" else LIBRARY_PARAMS["demucs"],
    )
    # The library has no torch_device_cuda attribute (it builds its CUDA device inline).
    separator.torch_device = torch.device(device())
    # No peak normalisation (module docstring); read by load_model into the model instance.
    separator.normalization_threshold = math.inf
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
    _warm = _Loaded(name, dict(spec.inference), separator, _segment(spec, separator))
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
    gain_db: float = 0.0  # the pre-separation gain applied (`gain`)


def _written(written: list[str], output_dir: Path, names: dict[str, str]) -> dict[str, Path]:
    files: dict[str, Path] = {}
    for item in written:
        path = (Path(item) if Path(item).is_absolute() else output_dir / item).resolve()
        if path.parent != output_dir.resolve():
            raise StageError("separation_output_invalid")
        if path.stem in names and path.is_file():
            files[path.stem] = path
    return files


def _library_run(
    separator: Any, audio: Path, output_dir: Path, names: dict[str, str]
) -> dict[str, Path]:
    _output_dir(separator, output_dir)
    segment = _warm.segment if _warm is not None and _warm.separator is separator else None
    if segment is not None:
        separator.model_instance.override_model_segment_size = segment[0]
        separator.model_instance.segment_size = segment[1]
    written = cast(
        list[str],
        separator._separate_file(str(audio), names),  # pyright: ignore[reportPrivateUsage]
    )
    return _written(written, output_dir, names)


def gain_db(spec: ModelSpec, mixture: NDArray[np.float64]) -> float:
    """The `gain` to apply to this mixture in dB (0 without one, for silence, or below
    `min_input_lufs`)."""
    gain = cast(dict[str, float] | None, spec.inference.get("gain"))
    if gain is None:
        return 0.0
    if gain.get("db") is not None:
        return float(gain["db"])
    lufs = loudness_lufs(mixture.astype(np.float32))
    floor = gain.get("min_input_lufs")
    if lufs is None or (floor is not None and lufs < floor):
        return 0.0
    return float(gain["target_lufs"]) - lufs


def _short(spec: ModelSpec, frames: int) -> bool:
    """audio-separator 0.44.5 can't demix input shorter than its chunk (inputs under 10 s fall back
    to a short segment, so only a configured `chunk` meets this): the wrapper pads such input."""
    chunk = spec.inference.get("chunk")
    rate = int(spec.inference.get("sample_rate", RATE))
    return chunk is not None and frames * rate < int(chunk) * RATE


def _wrapped(spec: ModelSpec, frames: int) -> bool:
    return (
        "gain" in spec.inference
        or "sample_rate" in spec.inference
        or (spec.arch == "mdxc" and int(spec.inference.get("shifts", 1)) > 1)
        or _short(spec, frames)
    )


def _resample(audio: NDArray[np.float64], source: int, target: int) -> NDArray[np.float64]:
    divisor = math.gcd(source, target)
    return np.asarray(
        resample_poly(audio, target // divisor, source // divisor, axis=0),  # pyright: ignore[reportUnknownArgumentType]
        dtype=np.float64,
    )


def _fit(audio: NDArray[np.float64], frames: int) -> NDArray[np.float64]:
    if len(audio) >= frames:
        return audio[:frames]
    return np.pad(audio, ((0, frames - len(audio)), (0, 0)))


def _write(path: Path, audio: NDArray[np.float64], rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), audio.astype(np.float32), rate, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]


def _passes(
    separator: Any, spec: ModelSpec, audio: Path, output_dir: Path, names: dict[str, str]
) -> tuple[dict[str, Path], float]:
    """Gain, shifts, a 48 kHz model and input shorter than `chunk`: the wrapper writes each pass's
    input (scaled, resampled, zero-padded to the chunk, rolled by k * (length // shifts)), rolls
    each pass's outputs back, averages them in float64 and undoes the padding, the resampling and
    the gain. Deterministic for a deterministic model."""
    data, _ = sf.read(str(audio), dtype="float64", always_2d=True)
    mixture = np.asarray(data, dtype=np.float64)
    frames = len(mixture)
    db = gain_db(spec, mixture)
    scale = 10 ** (db / 20)
    rate = int(spec.inference.get("sample_rate", RATE))
    shifts = int(spec.inference.get("shifts", 1)) if spec.arch == "mdxc" else 1
    source = mixture * scale
    if rate != RATE:
        source = _resample(source, RATE, rate)
    length = len(source)
    source = _fit(source, max(length, int(spec.inference.get("chunk", 0))))
    padded = len(source)
    step = padded // shifts
    work = output_dir / ".passes"
    shutil.rmtree(work, ignore_errors=True)
    total: dict[str, NDArray[np.float64]] = {}
    for k in range(shifts):
        shift = k * step
        feed = work / f"input-{k}.wav"
        _write(feed, np.roll(source, shift, axis=0), rate)
        for stem, path in _library_run(separator, feed, work / str(k), names).items():
            out, _ = sf.read(str(path), dtype="float64", always_2d=True)
            back = np.roll(_fit(np.asarray(out, dtype=np.float64), padded), -shift, axis=0)
            total[stem] = total[stem] + back if stem in total else back
    files: dict[str, Path] = {}
    for stem, summed in total.items():
        estimate = summed[:length] / shifts
        if rate != RATE:
            estimate = _fit(_resample(estimate, rate, RATE), frames)
        path = output_dir / f"{stem}.wav"
        _write(path, estimate / scale, RATE)
        files[stem] = path
    shutil.rmtree(work, ignore_errors=True)
    return files, db


def separate(name: str, spec: ModelSpec, audio: Path, output_dir: Path) -> Result:
    """Runs one model on a float WAV; StageError on any failure (the chain moves on)."""
    output_dir.mkdir(parents=True, exist_ok=True)
    names = {stem: stem for stem in spec.outputs}
    with _lock:
        try:
            separator = _separator(name, spec, output_dir)
            frames = int(sf.info(str(audio)).frames)  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]
            started = time.monotonic()
            with mps_peak() as peak:
                if _wrapped(spec, frames):
                    files, db = _passes(separator, spec, audio, output_dir, names)
                else:
                    files, db = _library_run(separator, audio, output_dir, names), 0.0
            seconds = time.monotonic() - started
        except StageError:
            raise
        except Exception as exc:
            release()  # don't keep a model whose last run broke
            text = str(exc).lower()
            if isinstance(exc, MemoryError) or "out of memory" in text:
                raise StageError("separation_oom") from exc
            raise StageError("separation_failed") from exc
    if not files:  # the library skips only near-silent stems, never all of them
        raise StageError("separation_output_invalid")
    return Result(files=files, seconds=seconds, peak_mb=peak[0], gain_db=db)
