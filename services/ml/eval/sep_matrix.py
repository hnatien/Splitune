"""Separation robustness matrix on the P1 windows (step 28; 08 implementation notes).

    uv run python eval/sep_matrix.py run --variant aac128 --model bs_roformer_sw [--clips SET]
    uv run python eval/sep_matrix.py report --set musdb18hq-p1-v2 --out results/sep-robust/D.md

`run` separates every window (or only a set's clips) under one variant with the shipped wrapper
(`stage_separation.models`, model-map settings), scores each output against the variant's
references as soon as it is written, appends one JSON line per clip to
<root>/matrix/<variant>/<model>.jsonl and deletes the stems (a full matrix would need ~130 GB).
A rerun skips clips already recorded, so a crash resumes. `--keep SET` keeps, for that set's clips,
the model's output for the clip's target and the sum of its other outputs (`target.wav`,
`complement.wav` under <root>/matrix/<variant>/stems/<model>/<clip>/: listening material); a clip
recorded earlier without them is separated again (and not recorded twice). `--library` runs the
model at audio-separator's default inference settings instead of the map's, recorded as
`<model>@library` (the step 07b settings re-checked with the corrected scoring).

Variant audio is built once per clip under <root>/variants/<variant>/ (`splitune_eval.variants`).
The mixture handed to the model is clipped to ±1, as the decode stage's 24-bit FLAC cache would.
Records keep every metric of `scoring.separation` for each single-instrument reference the window
has (MUSDB: vocals, drums, bass; MoisesDB windows also guitar and piano: `--root` their
folder), the raw uSDR even for a silent reference (`usdr_all`, to show what the old scoring
counted), each output's energy relative to the mixture (selection) and its peak.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import shlex
import shutil
import statistics
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from splitune_eval import scoring, variants
from splitune_eval.registry import load_set

ROOT = Path("~/datasets/musdb18hq-p1").expanduser()
RESULTS = Path(__file__).resolve().parent / "results"
# Single-instrument references a window may have (MUSDB: vocals, drums, bass; MoisesDB windows
# from eval/p1_moisesdb.py add guitar and piano); every other file but the mixture is a mix.
REFERENCED = ("vocals", "drums", "bass", "guitar", "piano")


def stem_names(folder: Path) -> list[str]:
    return sorted(p.stem for p in folder.glob("*.wav") if p.stem != "mixture")


METRICS = ("usdr", "si_sdr", "csdr", "bleedless", "fullness", "si_sar")


def windows(root: Path) -> list[str]:
    index = json.loads((root / "windows.json").read_text(encoding="utf-8"))
    return sorted(cast(dict[str, Any], index["items"]))


def read(path: Path) -> np.ndarray:
    data, _ = sf.read(str(path), dtype="float64", always_2d=True)
    return np.asarray(data, dtype=np.float64)


def write(path: Path, audio: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.tmp.wav")
    sf.write(str(temp), audio.astype(np.float32), 44100, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    temp.replace(path)


def prepared(root: Path, variant: str, clip: str) -> Path:
    """The variant's mixture.wav, info.json and (gain-like variants) its own references."""
    folder = root / "variants" / variant / clip
    if (folder / "info.json").is_file():
        return folder
    source = root / clip
    refs = {s: read(source / f"{s}.wav") for s in stem_names(source)}
    ratio = source / "xl_ratio.npy"
    v = variants.apply(
        variant,
        read(source / "mixture.wav"),
        refs,
        xl_ratio=lambda: np.load(ratio).astype(np.float64),
    )
    write(folder / "mixture.wav", v.mixture)
    if variant in variants.GAIN_LIKE:
        for stem, audio in v.references.items():
            write(folder / f"{stem}.wav", audio)
    (folder / "info.json").write_text(json.dumps(v.info) + "\n", encoding="utf-8")
    return folder


def references(root: Path, variant: str, clip: str) -> dict[str, np.ndarray]:
    folder = root / "variants" / variant / clip
    base = folder if variant in variants.GAIN_LIKE else root / clip
    return {s: read(base / f"{s}.wav") for s in stem_names(root / clip)}


def outputs(model: str) -> dict[str, str | None]:
    from stage_separation import config

    return dict(config.load().models[model].outputs)


def score_clip(
    mixture: np.ndarray, refs: dict[str, np.ndarray], files: dict[str, Path], model: str
) -> dict[str, Any]:
    frames = len(mixture)
    out: dict[str, Any] = {"energy_db": {}, "peak": {}, "metrics": {}}
    estimates: dict[str, np.ndarray] = {}
    for name, instrument in outputs(model).items():
        path = files.get(name)
        audio = read(path)[:frames] if path is not None else np.zeros_like(mixture)
        audio = np.pad(audio, ((0, frames - len(audio)), (0, 0)))
        out["energy_db"][name] = round(scoring.leakage_db(audio, mixture), 2)
        out["peak"][name] = round(float(np.abs(audio).max()), 4)
        if instrument is not None:
            estimates[instrument] = audio
    for instrument in (i for i in REFERENCED if i in refs):
        if instrument not in estimates:
            continue
        others = [a for s, a in refs.items() if s != instrument]
        metrics = scoring.separation(
            refs[instrument], estimates[instrument], mixture, others=others
        )
        metrics["usdr_all"] = scoring.usdr(refs[instrument], estimates[instrument])
        metrics["ref_db"] = scoring.leakage_db(refs[instrument], mixture)
        out["metrics"][instrument] = {k: round(float(v), 3) for k, v in metrics.items()}
    return out


def recorded(path: Path) -> dict[str, dict[str, Any]]:
    if not path.is_file():
        return {}
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]
    return {r["clip"]: r for r in rows}


def kept_stems(stems: Path, model: str, target: str) -> None:
    """Prunes a kept run to what the listening export plays: `target.wav` (the model's output for
    the clip's target instrument) and `complement.wav` (the sum of its other outputs)."""
    names = outputs(model)
    files = {p.stem: p for p in stems.glob("*.wav")}
    target_name = next((k for k, v in names.items() if v == target), None)
    if target_name is None:
        shutil.rmtree(stems)
        return
    audio = {k: read(v) for k, v in files.items()}
    frames = max(len(a) for a in audio.values())
    zero = np.zeros((frames, 2))
    rest = [np.pad(a, ((0, frames - len(a)), (0, 0))) for k, a in audio.items() if k != target_name]
    write(stems / "_target.wav", audio.get(target_name, zero))
    write(stems / "_complement.wav", np.sum(rest, axis=0) if rest else zero)
    for path in files.values():
        path.unlink()
    (stems / "_target.wav").replace(stems / "target.wav")
    (stems / "_complement.wav").replace(stems / "complement.wav")


def cmd_run(args: argparse.Namespace) -> int:
    from stage_separation import config, models  # torch + audio-separator: only here

    root = Path(args.root).expanduser()
    spec = config.load().models[args.model]
    name = args.model
    if args.library:  # audio-separator's defaults instead of the map's inference settings
        spec = config.ModelSpec.model_validate({**spec.model_dump(), "inference": {}})
        name = f"{args.model}@library"
    clips = args.clip or (
        [i.id for i in load_set(args.clips).resolved_items()] if args.clips else windows(root)
    )
    keep = (
        {i.id: i.tags["target"] for i in load_set(args.keep).resolved_items()}
        if args.keep
        else dict[str, str]()
    )
    base = root / "matrix" / args.variant
    log = base / f"{name}.jsonl"
    done = recorded(log)
    for clip in clips:
        stems = base / "stems" / name / clip
        # A clip scored before its stems were wanted is separated again, not recorded twice.
        if clip in done and (clip not in keep or (stems / "target.wav").is_file()):
            continue
        folder = prepared(root, args.variant, clip)
        mixture = np.clip(read(folder / "mixture.wav"), -1.0, 1.0)
        feed = base / "input" / f"{clip}.wav"
        write(feed, mixture)
        shutil.rmtree(stems, ignore_errors=True)
        result = models.separate(args.model, spec, feed, stems)
        row = {
            "clip": clip,
            "model": name,
            "variant": args.variant,
            "seconds": round(result.seconds, 3),
            "peak_mb": round(result.peak_mb),
            **score_clip(mixture, references(root, args.variant, clip), result.files, args.model),
        }
        feed.unlink()
        if clip in keep:
            kept_stems(stems, args.model, keep[clip])
        else:
            shutil.rmtree(stems)
        if clip not in done:
            log.parent.mkdir(parents=True, exist_ok=True)
            with log.open("a", encoding="utf-8") as f:
                f.write(json.dumps(row) + "\n")
        print(f"{args.variant} {name} {clip}: {result.seconds:.1f}s", flush=True)
    return 0


def git_sha() -> str:
    out = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True)
    dirty = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
    return (out.stdout.strip() or "unknown") + ("+dirty" if dirty.stdout.strip() else "")


def load_rows(root: Path, clip_ids: set[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for log in sorted((root / "matrix").glob("*/*.jsonl")):
        rows += [r for r in recorded(log).values() if r["clip"] in clip_ids]
    return rows


def fmt(value: float) -> str:
    return "-" if not np.isfinite(value) else f"{value:.2f}"


def summary_rows(rows: list[dict[str, Any]], metric: str) -> list[dict[str, Any]]:
    """Per (variant, model, instrument): the distribution over non-silent clips, the silent count
    and their leakage, and the paired delta to `clean` on the same clips."""
    cells: dict[tuple[str, str, str], dict[str, dict[str, float]]] = {}
    for r in rows:
        for instrument, m in r["metrics"].items():
            cells.setdefault((r["variant"], r["model"], instrument), {})[r["clip"]] = m
    out: list[dict[str, Any]] = []
    for (variant, model, instrument), by_clip in sorted(cells.items()):
        scored = {c: m[metric] for c, m in by_clip.items() if not m["silent"] and metric in m}
        silent = {c: m["leakage_db"] for c, m in by_clip.items() if m["silent"]}
        dist = scoring.distribution(sorted(scored.items()))
        clean = cells.get(("clean", model, instrument), {})
        deltas = [
            v - clean[c][metric]
            for c, v in scored.items()
            if c in clean and not clean[c]["silent"] and metric in clean[c]
        ]
        # The step 07 scoring: uSDR over every clip, silent references included.
        old = [m["usdr_all"] for m in by_clip.values() if "usdr_all" in m]
        out.append(
            {
                "variant": variant,
                "model": model,
                "instrument": instrument,
                "metric": metric,
                "old_median": statistics.median(old) if metric == "usdr" and old else float("nan"),
                "n": dist["n"],
                "silent": len(silent),
                "leakage_db_median": statistics.median(silent.values()) if silent else float("nan"),
                "median": dist["median"],
                "mean": dist["mean"],
                "p10": dist["p10"],
                "delta_clean_median": statistics.median(deltas) if deltas else float("nan"),
                "worst": "; ".join(f"{c} {v:.2f}" for c, v in dist["worst"]),
            }
        )
    return out


def cmd_report(args: argparse.Namespace) -> int:
    root = Path(args.root).expanduser()
    tset = load_set(args.set)
    clip_ids = {i.id for i in tset.resolved_items()}
    rows = load_rows(root, clip_ids)
    if args.variant:
        rows = [r for r in rows if r["variant"] in args.variant]
    lines = [
        f"# {args.title} ({datetime.now(UTC).date().isoformat()})",
        "",
        f"git `{git_sha()}` · set `{args.set}` ({len(clip_ids)} clips) · metrics: "
        f"{scoring.SEPARATION_VARIANT}",
        "",
        f"Command: `uv run python eval/sep_matrix.py {shlex.join(sys.argv[1:])}`",
        "",
    ]
    table: list[dict[str, Any]] = []
    for metric in args.metric:
        summary = summary_rows(rows, metric)
        table += summary
        lines += [
            f"## {metric}",
            "",
            "| variant | model | instrument | n | silent (leak dB) | median | mean | p10 | Δ clean "
            "(median, paired) | step 07 scoring (median, all clips) | worst 3 |",
            "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|",
        ]
        for s in summary:
            leak = f"{s['silent']} ({fmt(s['leakage_db_median'])})" if s["silent"] else "0"
            lines.append(
                f"| {s['variant']} | {s['model']} | {s['instrument']} | {s['n']} | {leak} | "
                f"{fmt(s['median'])} | {fmt(s['mean'])} | {fmt(s['p10'])} | "
                f"{fmt(s['delta_clean_median'])} | {fmt(s['old_median'])} | {s['worst']} |"
            )
        lines.append("")
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(table[0]) if table else ["variant"])
    writer.writeheader()
    writer.writerows(table)
    out.with_suffix(".csv").write_text(buffer.getvalue(), encoding="utf-8")
    print(f"→ {out}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--root", default=os.environ.get("P1_ROOT", str(ROOT)))
    sub = p.add_subparsers(dest="command", required=True)
    r = sub.add_parser("run", help="separate + score one variant with one model")
    r.add_argument("--variant", required=True, choices=variants.VARIANTS)
    r.add_argument("--model", required=True)
    r.add_argument("--clips", help="only this set's clips (default: every window)")
    r.add_argument("--clip", action="append", help="only this clip (repeatable)")
    r.add_argument("--keep", help="keep the stems of this set's clips")
    r.add_argument(
        "--library",
        action="store_true",
        help="audio-separator's default inference settings (records as <model>@library)",
    )
    r.set_defaults(fn=cmd_run)
    t = sub.add_parser("report", help="distribution tables per variant, model and instrument")
    t.add_argument("--set", required=True)
    t.add_argument("--out", required=True)
    t.add_argument("--title", default="Separation robustness matrix")
    t.add_argument("--variant", action="append", help="only these variants (repeatable)")
    t.add_argument("--metric", action="append", choices=METRICS)
    t.set_defaults(fn=cmd_report)
    args = p.parse_args(argv)
    if args.command == "report" and not args.metric:
        args.metric = list(METRICS)
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
