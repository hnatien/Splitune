"""`stem_post` stage (onnx-cpu island): raw stems from `separate` → stems.json + presence.json and
the browser encodes (06 §4 stem_post).

1. Align every stem to the mixture by cross-correlation (one lag for the run, from the target).
2. Mix-minus: mixture - target (`subtract`) or the sum of the model's other outputs
   (`complement`), as the model map says for the instrument.
3. Presence: frame-energy activity of each isolated stem, combined with the tagger. PANNs scores on
   full mixes are low and uncalibrated (bass never above ~0.15 on MUSDB), so the tagger only
   vetoes: a stem with energy whose instrument the tagger can't hear is `bleed_suspected`.
4. Loudness: one shared `mix_gain_db` brings the mixture to -14 LUFS; `gain_to_unity_db` brings a
   soloed stem to -14 LUFS (it replaces the shared gain while soloing).
5. Encode AAC (always) and Opus (optional), verify each against the PCM, write the JSON.
"""

from __future__ import annotations

import hashlib
import logging
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from splitune_ml_core import contracts
from splitune_ml_core.errors import StageError
from splitune_ml_core.stage_api import StageDescription, StageJob, StageOutput

from . import config, dsp, encode
from .dsp import Audio

log = logging.getLogger("splitune.stem_post")

DEFAULTS: dict[str, Any] = {
    "opus": False,  # Chromium decodes it 22 samples early at 44.1 kHz (encode.py)
    "align_max_lag": 2048,
    "activity_rel_db": -20.0,
    "activity_abs_db": -50.0,
    "empty_active_fraction": 0.02,
    "empty_energy_ratio": 0.001,
    "tag_absent_below": 0.01,  # tagger veto (see step 3 above)
    "tag_present_above": 0.3,  # a stem this confident tagger expects but got empty is rough
    "max_unity_gain_db": 20.0,
}


def read_separation(inputs: dict[str, str] | None) -> contracts.Separation:
    if not inputs or "separation" not in inputs:
        raise StageError("invalid_request", retry=False)
    text = Path(inputs["separation"]).read_text(encoding="utf-8")
    return contracts.Separation.model_validate_json(text)


def read_tags(inputs: dict[str, str] | None) -> contracts.Tags | None:
    if not inputs or "tags" not in inputs:
        return None
    tags = contracts.Tags.model_validate_json(Path(inputs["tags"]).read_text(encoding="utf-8"))
    return None if tags.fallback_reason is not None else tags


def describe(params: dict[str, Any], inputs: dict[str, str] | None = None) -> StageDescription:
    """The key follows the raw stems' content (and the tagger's verdict), so a different model,
    or a re-run of the same one, gives a different stems.json."""
    separation = read_separation(inputs)
    tags = read_tags(inputs)
    effective = {**DEFAULTS, **{k: v for k, v in params.items() if k in DEFAULTS}}
    stems = sorted(f"{s.name}:{s.sha256}" for s in separation.stems)
    effective["separation"] = hashlib.sha256("\n".join(stems).encode()).hexdigest()
    if tags is not None:
        effective["tags"] = {t.instrument: t.present_prob for t in tags.instruments}
    return StageDescription(model_refs=separation.models, params=effective)


def load_raw(cache_dir: Path, stem: contracts.SeparatedStem, frames: int) -> Audio:
    path = cache_dir / "separated" / stem.file
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != stem.sha256:
        raise StageError("separated_audio_missing", retry=False)
    data, rate = sf.read(str(path), dtype="float32", always_2d=True)
    audio = np.asarray(data, dtype=np.float32)
    if int(rate) != dsp.RATE or len(audio) != frames or stem.frames != frames:
        raise StageError("separated_audio_missing", retry=False)
    return audio


def encode_stem(
    stem_id: str, audio: Audio, workdir: Path, opus: bool
) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """Encodes and verifies one stem; returns its `files` entries and blobs. A failed Opus check
    drops only the optional variant; a failed AAC check fails the stage."""
    pcm = workdir / "pcm" / f"{stem_id}.wav"
    pcm.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(pcm), audio, dsp.RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    files: list[dict[str, Any]] = []
    blobs: dict[str, str] = {}
    aac = workdir / "stems" / f"{stem_id}.m4a"
    aac.parent.mkdir(parents=True, exist_ok=True)
    encode.encode_aac(pcm, aac)
    encode.verify_aac(aac, audio)
    files.append(
        {"codec": "aac", "container": "mp4", "path": f"stems/{aac.name}", "bitrate_kbps": 160}
    )
    blobs[f"stems/{aac.name}"] = str(aac)
    if opus:
        webm = workdir / "stems" / f"{stem_id}.webm"
        encode.encode_opus(pcm, webm)
        try:
            encode.verify_opus(webm, audio)
        except StageError:
            log.warning("opus variant dropped", extra={"error_code": "opus_verification_failed"})
        else:
            files.append(
                {
                    "codec": "opus",
                    "container": "webm",
                    "path": f"stems/{webm.name}",
                    "bitrate_kbps": 96,
                }
            )
            blobs[f"stems/{webm.name}"] = str(webm)
    pcm.unlink()
    return files, blobs


def run(job: StageJob) -> StageOutput:
    if job.decoded_path is None or job.audio_hash is None or job.duration_s is None:
        raise StageError("decoded_audio_missing", retry=False)
    started = time.process_time()
    params = job.params
    separation = read_separation(job.inputs)
    tags = read_tags(job.inputs)
    tag_probs: dict[str, float] = (
        {t.instrument: t.present_prob for t in tags.instruments} if tags else {}
    )
    cfg = config.load()
    workdir = Path(job.workdir)
    data, _ = sf.read(job.decoded_path, dtype="float32", always_2d=True)
    mixture = np.asarray(data, dtype=np.float32)
    frames = len(mixture)
    raw = {s.name: load_raw(Path(job.cache_dir), s, frames) for s in separation.stems}
    target = next(s for s in separation.stems if s.role == "target")
    lag = dsp.alignment_lag(mixture, raw[target.name], max_lag=int(params["align_max_lag"]))
    aligned = {name: dsp.shift(audio, lag) for name, audio in raw.items()}

    if separation.mix_minus == "subtract":
        mix_minus = mixture - aligned[target.name]
    else:
        parts = [aligned[s.name] for s in separation.stems if s.role != "target"]
        if not parts:
            raise StageError("separation_output_invalid", retry=False)
        mix_minus = np.sum(parts, axis=0, dtype=np.float32)

    mix_energy = dsp.energy(mixture)
    mix_loudness = dsp.loudness_lufs(mixture)
    mix_gain_db = round(dsp.TARGET_LUFS - mix_loudness, 2) if mix_loudness is not None else 0.0
    instrument_quality = {name: spec.quality for name, spec in cfg.instruments.items()}

    outputs: list[tuple[str, str, str | None, Audio, str]] = []  # id, kind, instrument, audio, base
    for s in separation.stems:
        if s.role == "complement" or s.instrument is None:
            continue
        outputs.append(
            (
                s.instrument,
                "isolated",
                s.instrument,
                aligned[s.name],
                instrument_quality.get(s.instrument, "good"),
            )
        )
    outputs.append(
        (
            f"mix_minus_{separation.target}",
            "mix_minus",
            None,
            mix_minus.astype(np.float32),
            instrument_quality.get(separation.target, "good"),
        )
    )

    stems: list[dict[str, Any]] = []
    presence: list[dict[str, Any]] = []
    blobs: dict[str, str] = {}
    for stem_id, kind, instrument, audio, base_quality in outputs:
        ratio = dsp.energy(audio) / mix_energy if mix_energy > 0 else 0.0
        act = dsp.activity(
            audio,
            mixture,
            rel_db=float(params["activity_rel_db"]),
            abs_db=float(params["activity_abs_db"]),
        )
        empty = act.active_fraction < float(params["empty_active_fraction"]) or ratio < float(
            params["empty_energy_ratio"]
        )
        loudness = dsp.loudness_lufs(audio)
        rough = base_quality == "rough" or (kind == "isolated" and empty)
        if instrument is not None:
            heard = tag_probs.get(instrument)
            energy_prob = float(np.clip(act.active_fraction / 0.25, 0.0, 1.0))
            bleed = heard is not None and heard < float(params["tag_absent_below"]) and not empty
            missed = heard is not None and heard >= float(params["tag_present_above"]) and empty
            rough = rough or bleed or missed
            present = energy_prob if not empty else min(energy_prob, 0.1)
            if bleed:
                present = min(present, 0.5)
            entry: dict[str, Any] = {
                "instrument": instrument,
                "present_prob": round(present, 3),
                "activity": [{"t0": t0, "t1": t1, "energy_ratio": r} for t0, t1, r in act.spans],
                "bleed_suspected": bleed,
            }
            subtype = next(
                (
                    t.subtype
                    for t in (tags.instruments if tags else [])
                    if t.instrument == instrument
                ),
                None,
            )
            if subtype is not None:
                entry["subtype"] = subtype
            presence.append(entry)
        files, stem_blobs = encode_stem(stem_id, audio, workdir, bool(params["opus"]))
        blobs.update(stem_blobs)
        gain = 0.0
        if not empty and loudness is not None:
            limit = float(params["max_unity_gain_db"])
            gain = float(np.clip(dsp.TARGET_LUFS - loudness, -limit, limit))
        stem: dict[str, Any] = {
            "stem_id": stem_id,
            "kind": kind,
            "provider": separation.provider,
            "files": files,
            "loudness_lufs": round(loudness if loudness is not None else dsp.SILENCE_LUFS, 2),
            "gain_to_unity_db": round(gain, 2),
            "energy_ratio_to_mix": round(ratio, 4),
            "quality_hint": "rough" if rough else "good",
            "empty": empty,
        }
        if instrument is not None:
            stem["instrument"] = instrument
        stems.append(stem)

    seen = {p["instrument"] for p in presence}
    for t in tags.instruments if tags else []:
        if t.instrument not in seen:  # heard by the tagger, not separated
            entry = {
                "instrument": t.instrument,
                "present_prob": t.present_prob,
                "activity": [],
                "bleed_suspected": False,
            }
            if t.subtype is not None:
                entry["subtype"] = t.subtype
            presence.append(entry)

    header: dict[str, Any] = {
        "schema_version": contracts.SCHEMA_VERSION,
        "artefact_version": job.artefact_version,
        "analysis_id": job.analysis_id,
        "user_id": job.user_id,
        "audio_hash": job.audio_hash,
        "sample_rate": 44100,
        "duration_s": job.duration_s,
        "models": [m.model_dump(mode="json") for m in separation.models],
        "params": params,
        "created_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    stems_doc = contracts.Stems.model_validate(
        {
            **header,
            "artefact": "stems",
            "stems": stems,
            "alignment_offset_samples": lag,
            "mix_gain_db": mix_gain_db,
        }
    )
    presence_doc = contracts.Presence.model_validate(
        {**header, "artefact": "presence", "instruments": presence}
    )
    stems_path, presence_path = workdir / "stems.json", workdir / "presence.json"
    stems_path.write_text(contracts.dump_json(stems_doc), encoding="utf-8")
    presence_path.write_text(contracts.dump_json(presence_doc), encoding="utf-8")
    return StageOutput(
        status="done",
        files={"stems": str(stems_path), "presence": str(presence_path)},
        blobs=blobs,
        model_refs=separation.models,
        metrics={"cpu_s": time.process_time() - started, "audio_s": float(job.duration_s)},
    )
