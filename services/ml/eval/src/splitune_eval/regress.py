"""Separation regression suite (08 §4; step 28): `splitune-eval regress`.

The suite is frozen in `eval/regression.yaml`; its baseline values (with the git sha, model weights
and library versions they came from) live next to it in `eval/regression.baseline.json`, written by
`--update-baseline`. Three parts, all through shipped code:
- **p1**: a few P1 windows under `clean`, `limit-XL` and `opus128` (`splitune_eval.variants`),
  separated by every model in the map that outputs a MUSDB-referenced stem (vocals, drums, bass),
  scored with `scoring.separation`: the median over clips per model, instrument and variant, and
  the same for each instrument's chain head (so a change of head shows up even when every model
  is unchanged);
- **p2g**: held-out P2g hard-band items through the shipped `decode` → `separate` (the guitar
  chain) → `notes.guitar` stages: mean onset F1 (mir_eval, ±50 ms);
- **fullsong**: one whole song through the guitar chain's head: the seam ratio of its referenced
  stems (`splitune_eval.seams`) and the time.

A run breaches when a value is worse than its baseline by more than the suite's tolerance (higher
is better for every metric except the seam ratio and time). `--smoke` runs a cheap CPU version
(one clip's first seconds, one model, clean only) against its own baseline, to check the suite
runs; its time is not compared.
"""

from __future__ import annotations

import json
import os
import random
import shutil
import statistics
import subprocess
import tempfile
from dataclasses import dataclass
from datetime import UTC, datetime
from importlib import metadata
from pathlib import Path
from typing import Any, cast

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
import yaml
from numpy.typing import NDArray

from . import formats, scoring, seams, variants
from .guitar_refs import GuitarRef

EVAL_DIR = Path(__file__).resolve().parents[2]
SUITE = EVAL_DIR / "regression.yaml"
BASELINE = EVAL_DIR / "regression.baseline.json"
RESULTS = EVAL_DIR / "results" / "regression"
RATE = 44100
STEMS = ("vocals", "drums", "bass", "other")
REFERENCED = ("vocals", "drums", "bass")
LOWER_IS_BETTER = ("seam_db",)

Array = NDArray[np.float64]


def read(path: Path) -> Array:
    data, _ = sf.read(str(path), dtype="float64", always_2d=True)
    return np.asarray(data, dtype=np.float64)


def write(path: Path, audio: Array) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), audio.astype(np.float32), RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]


def load_suite(path: Path = SUITE) -> dict[str, Any]:
    return cast(dict[str, Any], yaml.safe_load(path.read_text(encoding="utf-8")))


def root_of(value: str) -> Path:
    """A suite root; `~/datasets` follows SPLITUNE_DATASETS_DIR like the set registry."""
    base = os.environ.get("SPLITUNE_DATASETS_DIR")
    if base and value.startswith("~/datasets"):
        value = base + value.removeprefix("~/datasets")
    return Path(value).expanduser()


@dataclass
class Measured:
    values: dict[str, float]
    seconds: dict[str, float]


def separated(model: str, mixture: Array, work: Path) -> tuple[dict[str, Array], float]:
    """instrument → estimate of one shipped-wrapper run (files removed), and its seconds. Demucs
    draws its time shift from `random` (and torch), so both are seeded: a rerun reproduces it."""
    import torch
    from stage_separation import config, models

    random.seed(0)
    torch.manual_seed(0)  # pyright: ignore[reportUnknownMemberType]
    spec = config.load().models[model]
    feed = work / "input.wav"
    write(feed, np.clip(mixture, -1.0, 1.0))
    out = work / "stems"
    shutil.rmtree(out, ignore_errors=True)
    result = models.separate(model, spec, feed, out)
    estimates: dict[str, Array] = {}
    for name, instrument in spec.outputs.items():
        if instrument in REFERENCED:
            path = result.files.get(name)
            audio = read(path) if path is not None else np.zeros_like(mixture)
            audio = np.pad(audio, ((0, max(0, len(mixture) - len(audio))), (0, 0)))
            estimates[instrument] = audio[: len(mixture)]
    shutil.rmtree(out, ignore_errors=True)
    return estimates, result.seconds


def referenced_models() -> list[str]:
    from stage_separation import config

    cfg = config.load()
    return sorted(n for n, m in cfg.models.items() if set(m.outputs.values()) & set(REFERENCED))


def heads() -> dict[str, str]:
    from stage_separation import config

    cfg = config.load()
    return {i: cfg.instruments[i].chain[0] for i in REFERENCED}


def p1_part(part: dict[str, Any], work: Path, models: list[str], seconds: float | None) -> Measured:
    root = root_of(part["root"])
    per_key: dict[str, list[float]] = {}
    times: dict[str, float] = {}
    for clip in part["clips"]:
        mixture = read(root / clip / "mixture.wav")
        refs = {s: read(root / clip / f"{s}.wav") for s in STEMS}
        if seconds is not None:
            frames = int(seconds * RATE)
            mixture, refs = mixture[:frames], {k: v[:frames] for k, v in refs.items()}
        for variant in part["variants"]:
            ratio = root / clip / "xl_ratio.npy"
            v = variants.apply(
                variant, mixture, refs, xl_ratio=lambda r=ratio: np.load(r).astype(np.float64)
            )
            for model in models:
                estimates, took = separated(model, v.mixture, work)
                times[model] = times.get(model, 0.0) + took
                for instrument, est in estimates.items():
                    others = [v.references[s] for s in STEMS if s != instrument]
                    m = scoring.separation(v.references[instrument], est, v.mixture, others=others)
                    if m["silent"]:
                        continue
                    for metric in part["metrics"]:
                        key = f"p1/{model}/{instrument}/{variant}/{metric}"
                        per_key.setdefault(key, []).append(float(m[metric]))
    per_model = {k: statistics.median(v) for k, v in per_key.items()}
    values = dict(per_model)
    for instrument, head in heads().items():
        for key, value in per_model.items():
            _, model, inst, variant, metric = key.split("/")
            if model == head and inst == instrument:
                values[f"p1-head/{instrument}/{variant}/{metric}"] = value
    return Measured(values, times)


def onset_f1(ref: GuitarRef, notes_json: Path) -> float:
    document = json.loads(notes_json.read_text(encoding="utf-8"))
    est = [(n["onset_s"], n["offset_s"], int(n["pitch_midi"])) for n in document["notes"]]

    def events(notes: list[tuple[float, float, int]]) -> formats.NoteEvents:
        intervals = np.array([[a, max(b, a + 1e-3)] for a, b, _ in notes]).reshape(-1, 2)
        return formats.NoteEvents(intervals, np.array([float(p) for _, _, p in notes]))

    reference = [(n.onset_s, n.offset_s, n.pitch_midi) for n in ref.notes]
    metrics, _ = scoring.notes(events(reference), events(est))
    return float(metrics["onset_f1"])


def p2g_part(part: dict[str, Any], work: Path) -> Measured:
    from .local import LocalRun

    root = root_of(part["root"])
    run = LocalRun(work / "p2g")
    scores: list[float] = []
    seconds = 0.0
    for item in part["items"]:
        folder = root / "items" / item
        decoded = run.decode(folder / "mixture.hard.wav")
        sep = run.run(
            "separate",
            {"source": str(folder / "mixture.hard.wav")},
            decoded,
            {"instrument": "guitar"},
        )
        seconds += float(sep.metrics.get("gpu_s", sep.metrics.get("cpu_s", 0.0)))
        notes = run.run("notes.guitar", {"separation": sep.files["separation"]}, decoded)
        scores.append(onset_f1(GuitarRef.load(folder / "ref.json"), Path(notes.files["notes"])))
    return Measured({"p2g/onset_f1": statistics.fmean(scores)}, {"p2g/separate": seconds})


def fullsong_part(part: dict[str, Any], work: Path) -> Measured:
    from stage_separation import config

    model = config.load().instruments[part["instrument"]].chain[0]
    folder = root_of(part["root"]) / part["song"]
    mixture = read(folder / "mixture.wav")
    estimates, took = separated(model, mixture, work)
    window = seams.roformer_window()
    values: dict[str, float] = {}
    if window is not None:
        edges = seams.boundaries(len(mixture), *window)
        ratios = [
            seams.seam_ratio_db(read(folder / f"{i}.wav"), est, edges)
            for i, est in estimates.items()
        ]
        values["fullsong/seam_db"] = statistics.median(ratios)
    return Measured(values, {f"fullsong/{model}": took})


def environment() -> dict[str, Any]:
    from stage_separation import config, models

    cfg = config.load()
    sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True)
    dirty = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
    return {
        "git": (sha.stdout.strip() or "unknown") + ("+dirty" if dirty.stdout.strip() else ""),
        "created": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "device": models.device(),
        "libraries": {
            name: metadata.version(name) for name in ("audio-separator", "torch", "numpy")
        },
        "models": {
            name: {
                "weights_sha256": models.model_ref(spec).weights_sha256,
                "inference": spec.inference,
            }
            for name, spec in sorted(cfg.models.items())
        },
        "heads": heads(),
    }


def measure(suite: dict[str, Any], smoke: bool) -> Measured:
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        if smoke:
            part = {**suite["p1"], **suite["smoke"]}
            return p1_part(part, work, [suite["smoke"]["model"]], float(suite["smoke"]["seconds"]))
        out = p1_part(suite["p1"], work, referenced_models(), None)
        for extra in (p2g_part(suite["p2g"], work), fullsong_part(suite["fullsong"], work)):
            out.values |= extra.values
            out.seconds |= extra.seconds
        return out


def tolerance(suite: dict[str, Any], key: str) -> float:
    return float(suite["tolerances"][key.rsplit("/", 1)[-1]])


def compare(
    suite: dict[str, Any], base: dict[str, Any], now: Measured, times: bool = True
) -> list[dict[str, Any]]:
    """One row per value (and per time unless `times` is off): baseline, now, allowed and
    whether it breaches."""
    rows: list[dict[str, Any]] = []
    for key, old in sorted(base["values"].items()):
        new = now.values.get(key)
        tol = tolerance(suite, key)
        if new is None:
            rows.append({"key": key, "base": old, "now": None, "limit": None, "breach": True})
            continue
        lower = key.rsplit("/", 1)[-1] in LOWER_IS_BETTER
        limit = old + tol if lower else old - tol
        breach = new > limit if lower else new < limit
        rows.append({"key": key, "base": old, "now": new, "limit": limit, "breach": breach})
    ratio = float(suite["tolerances"]["time_ratio"])
    for key, old in sorted(base["seconds"].items() if times else []):
        new = now.seconds.get(key)
        breach = new is None or new > old * ratio
        rows.append(
            {"key": f"time/{key}", "base": old, "now": new, "limit": old * ratio, "breach": breach}
        )
    return rows


def report(rows: list[dict[str, Any]], env: dict[str, Any], base: dict[str, Any]) -> str:
    def fmt(value: float | None) -> str:
        return "missing" if value is None else f"{value:.3f}"

    breaches = [r for r in rows if r["breach"]]
    lines = [
        f"# Separation regression suite ({datetime.now(UTC).date().isoformat()})",
        "",
        f"**{'FAIL' if breaches else 'PASS'}**: {len(breaches)} of {len(rows)} values outside "
        "tolerance.",
        "",
        f"- Now: git `{env['git']}`, device `{env['device']}`, "
        + ", ".join(f"{k} {v}" for k, v in env["libraries"].items())
        + f"; chain heads {env['heads']}",
        f"- Baseline: git `{base['env']['git']}` ({base['env']['created']}), device "
        f"`{base['env']['device']}`; chain heads {base['env']['heads']}",
        f"- Metrics: {scoring.SEPARATION_VARIANT}",
        "",
        "| value | baseline | now | limit | |",
        "|---|---:|---:|---:|---|",
    ]
    for r in sorted(rows, key=lambda r: (not r["breach"], r["key"])):
        mark = "**breach**" if r["breach"] else "ok"
        lines.append(
            f"| {r['key']} | {fmt(r['base'])} | {fmt(r['now'])} | {fmt(r['limit'])} | {mark} |"
        )
    return "\n".join(lines) + "\n"


def run(update_baseline: bool, smoke: bool, out: Path | None) -> int:
    """Measure, then write the baseline (`update_baseline`) or compare against it; 1 on a breach."""
    if smoke:
        os.environ["ML_TORCH_DEVICE"] = "cpu"
    suite = load_suite()
    measured = measure(suite, smoke)
    env = environment()
    stored = cast(
        dict[str, dict[str, Any]],
        json.loads(BASELINE.read_text(encoding="utf-8")) if BASELINE.is_file() else {},
    )
    section = "smoke" if smoke else "full"
    if update_baseline:
        stored[section] = {"env": env, "values": measured.values, "seconds": measured.seconds}
        text = json.dumps(stored, indent=2, sort_keys=True) + "\n"
        BASELINE.write_text(text, encoding="utf-8", newline="\n")  # LF on Windows too (Biome)
        print(f"baseline ({section}, {len(measured.values)} values) → {BASELINE}")
        return 0
    if section not in stored:
        print(f"no {section} baseline: run with --update-baseline first")
        return 1
    # CPU time in the smoke run depends on whatever else the test run is doing.
    rows = compare(suite, stored[section], measured, times=not smoke)
    text = report(rows, env, stored[section])
    if not smoke:
        dest = out or RESULTS / f"{datetime.now(UTC).date().isoformat()}.md"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(text, encoding="utf-8")
        print(f"→ {dest}")
    breaches = [r for r in rows if r["breach"]]
    for r in breaches:
        print(f"breach: {r['key']} {r['base']} → {r['now']} (limit {r['limit']})")
    print("PASS" if not breaches else f"FAIL ({len(breaches)} breaches)")
    return 1 if breaches else 0
