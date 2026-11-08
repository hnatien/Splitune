"""`separate` stage (torch island): decoded mixture + tags.json → separation.json, with the raw
stems written to the worker's local cache (25 §5: separated audio stays on the Mac's disk).

Runs the learner instrument's fallback chain from the model map: the first model whose weights
verify against the register and whose run succeeds wins. A later model than the first gives
status `fallback` (`separation_fallback_model`); no model gives `stems_unavailable`, a permanent
failure after which the analysis continues without stems (06 §6).

An instrument with `fallback_when_silent` (piano, step 29) gets a second model when the chain's
target stem is near silent while the tagger hears the instrument: SW outputs no piano for synth-
and organ-heavy keys. That model's outputs mapped to the instrument, summed, replace the stem;
`separation.json` records the check and the provider, and `stem_post` marks the stem rough.

Only what the analysis needs is kept (06 §4 "request one target"): the learner's stem, the
complement parts when mix-minus is `complement`, and the `keep` extras (drums, bass) when the same
run produced them and the tagger hears them.

Raw stems are cached as 24-bit FLAC, or as float32 WAV when they peak above full scale (a loud
master's stems do, though its mixture doesn't), so `mixture - stem` stays exact (step 28).
"""

from __future__ import annotations

import hashlib
import logging
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from numpy.typing import NDArray
from splitune_ml_core import contracts
from splitune_ml_core.errors import StageError
from splitune_ml_core.keys import canonical_json
from splitune_ml_core.stage_api import StageDescription, StageJob, StageOutput

from . import config, models
from .config import ModelSpec, SeparationConfig

log = logging.getLogger("splitune.separate")

Role = Literal["target", "complement", "extra"]
# One model run: its name, map entry, register ref and output files.
type SeparationRun = tuple[str, ModelSpec, contracts.ModelRef, models.Result]
# A model may pad or trim a few samples at the end; anything bigger means a broken run.
MAX_LENGTH_DRIFT = 0.01


def read_tags(inputs: dict[str, str] | None) -> contracts.Tags | None:
    if not inputs or "tags" not in inputs:
        return None
    return contracts.Tags.model_validate_json(Path(inputs["tags"]).read_text(encoding="utf-8"))


def heard(tags: contracts.Tags | None, instrument: str, min_prob: float) -> bool:
    """Without usable tags every instrument counts as present (06 §2 tag fallback)."""
    if tags is None or tags.fallback_reason is not None:
        return True
    probs: dict[str, float] = {t.instrument: t.present_prob for t in tags.instruments}
    return probs.get(instrument, 1.0) >= min_prob


def present_prob(tags: contracts.Tags | None, instrument: str) -> float | None:
    """The tagger's `present_prob` for `instrument`; None without usable tags."""
    if tags is None or tags.fallback_reason is not None:
        return None
    return next((t.present_prob for t in tags.instruments if t.instrument == instrument), 0.0)


def plan(
    cfg: SeparationConfig, params: dict[str, Any], tags: contracts.Tags | None
) -> dict[str, Any]:
    instrument = params.get("instrument")
    if instrument not in cfg.instruments:
        raise StageError("invalid_params", retry=False)
    spec = cfg.instruments[instrument]
    keep = [i for i in cfg.keep if i != instrument and heard(tags, i, cfg.keep_min_prob)]
    planned: dict[str, Any] = {
        "instrument": instrument,
        "chain": spec.chain,
        # Part of the cache key: other inference settings never reuse old stems.
        "inference": {name: cfg.models[name].inference for name in spec.chain},
        "mix_minus": spec.mix_minus,
        "keep": keep,
        "solo_check": None
        if spec.solo_check is None
        else {
            **spec.solo_check.model_dump(),
            "inference": cfg.models[spec.solo_check.model].inference,
        },
        "config_version": cfg.version,
        "stem_store": STEM_STORE,
    }
    fallback = spec.fallback_when_silent
    if fallback is not None:  # only where configured: other instruments keep their cache keys
        prob = present_prob(tags, instrument)
        planned["fallback_when_silent"] = {
            **fallback.model_dump(),
            "inference": cfg.models[fallback.model].inference,
            "tagged": prob is not None and prob >= fallback.min_present_prob,
        }
    return planned


def describe(params: dict[str, Any], inputs: dict[str, str] | None = None) -> StageDescription:
    """`model_refs` name the chain's first model: the cache key follows the configured map."""
    cfg = config.load()
    effective = plan(cfg, params, read_tags(inputs))
    return StageDescription(
        model_refs=[models.model_ref(cfg.models[effective["chain"][0]])], params=effective
    )


def roles(spec: ModelSpec, params: dict[str, Any]) -> dict[str, Role]:
    """Model outputs to keep and why."""
    out: dict[str, Role] = {}
    for name, instrument in spec.outputs.items():
        if instrument == params["instrument"]:
            out[name] = "target"
        elif instrument is not None and instrument in params["keep"]:
            out[name] = "extra"
        elif params["mix_minus"] == "complement":
            out[name] = "complement"
    return out


RHYTHM = ("drums", "bass", "vocals")
# How raw stems are cached; part of the cache key, so stems an older version stored (24-bit FLAC
# clipped at full scale, after the library's rescaling) are separated again.
STEM_STORE = "flac24-or-wav-f32"
FULL_SCALE = 1.0 - 2.0**-23  # the largest 24-bit sample


def solo_bypass(
    spec: ModelSpec,
    files: dict[str, Path],
    target: str,
    frames: int,
    mixture_energy: float,
    threshold_db: float,
) -> dict[str, Any]:
    """Energy of the model's drums, bass and vocals outputs (whichever it has, never the target)
    relative to the mixture; below `threshold_db` the song is the target instrument alone."""
    rhythm = [
        load_stem(files.get(stem), frames)
        for stem, instrument in spec.outputs.items()
        if instrument in RHYTHM and instrument != target
    ]
    if not rhythm:
        return {"rhythm_db": 0.0, "applied": False}
    level = level_db(np.sum(rhythm, axis=0), mixture_energy)
    return {"rhythm_db": round(level, 1), "applied": level < threshold_db}


def level_db(audio: NDArray[np.float32], mixture_energy: float) -> float:
    """Energy of `audio` relative to the mixture's, in dB."""
    energy = float(np.sum(np.square(audio, dtype=np.float64)))
    return float(10.0 * np.log10((energy + 1e-12) / (mixture_energy + 1e-12)))


def summed_outputs(
    spec: ModelSpec, files: dict[str, Path], instrument: str, frames: int
) -> NDArray[np.float32]:
    """The sum of a model's outputs mapped to `instrument`."""
    parts = [load_stem(files.get(s), frames) for s, i in spec.outputs.items() if i == instrument]
    return np.sum(parts, axis=0, dtype=np.float32)


def load_stem(path: Path | None, frames: int) -> NDArray[np.float32]:
    """A model output as [frames, 2]; a stem the library skipped as silent is zeros."""
    if path is None:
        return np.zeros((frames, 2), dtype=np.float32)
    data, rate = sf.read(str(path), dtype="float32", always_2d=True)
    audio = np.asarray(data, dtype=np.float32)
    if int(rate) != 44100 or audio.shape[1] != 2 or not np.isfinite(audio).all():
        raise StageError("separation_output_invalid")
    if abs(len(audio) - frames) > MAX_LENGTH_DRIFT * frames:
        raise StageError("separation_output_invalid")
    if len(audio) >= frames:
        return audio[:frames]
    return np.pad(audio, ((0, frames - len(audio)), (0, 0)))


def run_id(
    job: StageJob,
    name: str,
    spec: ModelSpec,
    ref: contracts.ModelRef,
    kept: dict[str, Role],
    fallback: SeparationRun | None = None,
) -> str:
    """Cache directory of one separation: same audio, weights, inference settings and kept
    outputs (and the fallback model that replaced the target, if any) → same files."""
    parts: list[Any] = [job.audio_hash, name, ref.weights_sha256, spec.inference]
    parts.append(sorted(kept.items()))
    if fallback is not None:
        parts += [fallback[0], fallback[2].weights_sha256, fallback[1].inference]
    return hashlib.sha256(canonical_json(parts).encode()).hexdigest()[:32]


def store(audio: NDArray[np.float32], base: Path) -> tuple[Path, str]:
    """`base`.flac (24-bit, like decode's cache) or, when the stem peaks above full scale,
    `base`.wav (float32, nothing clipped); atomic rename. Returns (path, sha256)."""
    loud = float(np.max(np.abs(audio), initial=0.0)) > FULL_SCALE
    dest = base.with_name(f"{base.name}.{'wav' if loud else 'flac'}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    temp = dest.with_name(f".{dest.name}.{os.getpid()}.tmp")
    if loud:
        sf.write(str(temp), audio, 44100, format="WAV", subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    else:
        sf.write(str(temp), audio, 44100, format="FLAC", subtype="PCM_24")  # pyright: ignore[reportUnknownMemberType]
    temp.replace(dest)
    return dest, hashlib.sha256(dest.read_bytes()).hexdigest()


def run(job: StageJob) -> StageOutput:
    if job.decoded_path is None or job.audio_hash is None or job.duration_s is None:
        raise StageError("decoded_audio_missing", retry=False)
    cfg = config.load()
    params = job.params
    workdir = Path(job.workdir)
    data, _ = sf.read(job.decoded_path, dtype="float32", always_2d=True)
    frames = len(data)
    mixture_energy = float(np.sum(np.square(data, dtype=np.float64)))
    mixture = workdir / "mixture.wav"
    sf.write(str(mixture), data, 44100, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    del data

    def attempt(name: str) -> SeparationRun:
        spec = cfg.models[name]
        ref = models.model_ref(spec)
        return name, spec, ref, models.separate(name, spec, mixture, workdir / "separated" / name)

    chosen: SeparationRun | None = None
    bypass: dict[str, Any] | None = None
    seconds = 0.0
    check = params.get("solo_check")
    if check is not None:
        try:
            checked = attempt(str(check["model"]))
            seconds += checked[3].seconds
            bypass = solo_bypass(
                checked[1],
                checked[3].files,
                params["instrument"],
                frames,
                mixture_energy,
                float(check["threshold_db"]),
            )
            if bypass["applied"]:
                chosen = checked
        except StageError as exc:
            log.warning(
                "solo check failed", extra={"model": check["model"], "error_code": exc.code}
            )
    attempts: list[dict[str, str]] = []
    if chosen is None:
        for candidate in params["chain"]:
            try:
                chosen = attempt(candidate)
                seconds += chosen[3].seconds
                break
            except StageError as exc:
                log.warning(
                    "separation model failed", extra={"model": candidate, "error_code": exc.code}
                )
                attempts.append({"model": candidate, "error_code": exc.code})
        else:
            raise StageError("stems_unavailable", retry=False)
    name, spec, ref, result = chosen
    kept = roles(spec, params)
    stems = {stem: load_stem(result.files.get(stem), frames) for stem in kept}

    refs = [ref]
    peak_mb = result.peak_mb
    replaced: SeparationRun | None = None
    silence: dict[str, Any] | None = None
    rule = params.get("fallback_when_silent")
    if rule is not None and not (bypass is not None and bypass["applied"]):
        target = next(stem for stem, role in kept.items() if role == "target")
        level = level_db(stems[target], mixture_energy)
        silence = {"target_db": round(level, 1), "applied": False}
        prob = present_prob(read_tags(job.inputs), params["instrument"])
        if prob is not None:
            silence["present_prob"] = prob
        if level < float(rule["threshold_db"]) and rule["tagged"]:
            try:
                replaced = attempt(str(rule["model"]))
            except StageError as exc:  # the chain's stem stays
                log.warning(
                    "separation fallback failed",
                    extra={"model": rule["model"], "error_code": exc.code},
                )
            else:
                seconds += replaced[3].seconds
                peak_mb = max(peak_mb, replaced[3].peak_mb)
                stems[target] = summed_outputs(
                    replaced[1], replaced[3].files, params["instrument"], frames
                )
                silence |= {"applied": True, "provider": replaced[1].provider}
                refs.append(replaced[2])

    directory = run_id(job, name, spec, ref, kept, replaced)
    cache = Path(job.cache_dir) / "separated"
    entries: list[dict[str, Any]] = []
    for stem, audio in stems.items():
        path, sha = store(audio, cache / directory / stem)
        entry: dict[str, Any] = {
            "name": stem,
            "role": kept[stem],
            "file": f"{directory}/{path.name}",
            "sha256": sha,
            "frames": frames,
        }
        if spec.outputs[stem] is not None:
            entry["instrument"] = spec.outputs[stem]
        entries.append(entry)

    device = models.device()
    extra: dict[str, Any] = {} if bypass is None else {"solo_bypass": bypass}
    if silence is not None:
        extra["fallback_when_silent"] = silence
    document = contracts.Separation.model_validate(
        {
            "schema_version": contracts.SCHEMA_VERSION,
            "artefact": "separation",
            "artefact_version": job.artefact_version,
            "analysis_id": job.analysis_id,
            "user_id": job.user_id,
            "audio_hash": job.audio_hash,
            "sample_rate": 44100,
            "duration_s": job.duration_s,
            "models": [r.model_dump(mode="json") for r in refs],
            "params": params,
            "created_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "target": params["instrument"],
            "provider": spec.provider,
            "mix_minus": params["mix_minus"],
            "device": device,
            "stems": entries,
            "failed_attempts": attempts,
            **extra,
        }
    )
    out = workdir / "separation.json"
    out.write_text(contracts.dump_json(document), encoding="utf-8")
    fallback = "separation_fallback_model" if attempts else None
    metric = "gpu_s" if device != "cpu" else "cpu_s"
    return StageOutput(
        status="fallback" if fallback else "done",
        files={"separation": str(out)},
        model_refs=refs,
        metrics={
            metric: seconds,
            "peak_vram_mb": peak_mb,
            "audio_s": float(job.duration_s),
        },
        fallback_reason=fallback,
    )
