"""Full-length songs: quality vs 30 s windows, window seams, time, memory and determinism
(step 28 Phase 4).

    uv run python eval/p1_fullsong.py run --model bs_roformer_sw --setting shipped
    uv run python eval/p1_fullsong.py run --model bs_roformer_sw --setting library
    uv run python eval/p1_fullsong.py determinism --model bs_roformer_sw --song georgia-wonder-siren
    uv run python eval/p1_fullsong.py report --out results/p1/<date>-fullsong.md

Songs: whole MUSDB18-HQ test songs with every stem (`p1_musdb.py full --stems`, default root
~/datasets/musdb18hq-full). Each run uses the shipped wrapper (`stage_separation.models`) at the
model map's settings (`shipped`) or audio-separator's defaults (`library`), on the float mixture
clipped to ±1. Records go to <root>/records.jsonl and the stems are deleted after scoring.

Per song and referenced stem (vocals, drums, bass): every `scoring.separation` metric on the whole
song, the same estimate scored on the song's P1 window only, and the **seam ratio**: power of the
1 kHz high-passed residual (estimate - reference) within ±50 ms of each model window boundary over
its power elsewhere, in dB (0 = boundaries invisible). Boundaries follow audio-separator 0.44's
RoFormer demix: chunk C = stft_hop * (dim_t - 1), windows start every step = min(overlap·44100, C)
plus one final window ending at the song's end; with step = C the windows abut without a
crossfade. Demucs averages random time shifts (`shifts`), so its boundaries move between passes
and no seam ratio is computed for it.

`determinism` separates the same song twice (bit-identical or the largest difference in dB) and
once with half a model window of silence prepended (outputs re-aligned, SDR between the runs).
"""

from __future__ import annotations

import argparse
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
from splitune_eval import scoring, seams

ROOT = Path(os.environ.get("FULLSONG_ROOT", "~/datasets/musdb18hq-full")).expanduser()
P1_ROOT = Path(os.environ.get("P1_ROOT", "~/datasets/musdb18hq-p1")).expanduser()
STEMS = ("vocals", "drums", "bass", "other")
REFERENCED = ("vocals", "drums", "bass")
RATE = 44100


def read(path: Path) -> np.ndarray:
    data, _ = sf.read(str(path), dtype="float64", always_2d=True)
    return np.asarray(data, dtype=np.float64)


def write(path: Path, audio: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), audio.astype(np.float32), RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]


def songs(root: Path) -> list[str]:
    return sorted(p.name for p in root.iterdir() if (p / "mixture.wav").is_file())


def spec_for(model: str, setting: str) -> Any:
    from splitune_eval import sepmap
    from stage_separation import config

    spec = sepmap.spec(model)  # the model map plus eval/separation.eval.yaml
    if setting == "library":
        spec = config.ModelSpec.model_validate({**spec.model_dump(), "inference": {}})
    return spec


def separate(
    model: str, setting: str, mixture: np.ndarray, work: Path
) -> tuple[Any, dict[str, np.ndarray]]:
    """(library result, instrument → estimate) for one run; the files are removed."""
    from stage_separation import models

    spec = spec_for(model, setting)
    feed = work / "input.wav"
    write(feed, np.clip(mixture, -1.0, 1.0))
    out = work / "stems"
    shutil.rmtree(out, ignore_errors=True)
    result = models.separate(model, spec, feed, out)
    estimates: dict[str, np.ndarray] = {}
    for name, instrument in spec.outputs.items():
        if instrument in REFERENCED:
            path = result.files.get(name)
            audio = read(path) if path is not None else np.zeros_like(mixture)
            estimates[instrument] = np.pad(audio, ((0, max(0, len(mixture) - len(audio))), (0, 0)))[
                : len(mixture)
            ]
    shutil.rmtree(out, ignore_errors=True)
    feed.unlink()
    return result, estimates


def p1_window(song: str) -> tuple[int, int] | None:
    index = json.loads((P1_ROOT / "windows.json").read_text(encoding="utf-8"))["items"]
    entry = index.get(song)
    if entry is None:
        return None
    start = round(float(entry["start_s"]) * RATE)
    return start, start + round(float(entry["duration_s"]) * RATE)


def window_usdr(model: str, song: str, instrument: str) -> float | None:
    """The same model's uSDR when it separated only the 30 s window (sep_matrix `clean`)."""
    log = P1_ROOT / "matrix" / "clean" / f"{model}.jsonl"
    if not log.is_file():
        return None
    for line in log.read_text(encoding="utf-8").splitlines():
        row = json.loads(line)
        m = row["clip"] == song and row["metrics"].get(instrument)
        if m and not m["silent"]:
            return float(m["usdr"])
    return None


def done(root: Path) -> set[tuple[str, str, str, str]]:
    path = root / "records.jsonl"
    if not path.is_file():
        return set()
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]
    return {(r["kind"], r["model"], r["setting"], r["song"]) for r in rows}


def append(root: Path, row: dict[str, Any]) -> None:
    with (root / "records.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps(row) + "\n")


def cmd_run(args: argparse.Namespace) -> int:
    root = Path(args.root).expanduser()
    finished = done(root)
    for song in args.song or songs(root):
        if ("run", args.model, args.setting, song) in finished:
            continue
        mixture = read(root / song / "mixture.wav")
        refs = {s: read(root / song / f"{s}.wav") for s in STEMS}
        result, estimates = separate(args.model, args.setting, mixture, root / "work")
        window = seams.roformer_window()
        edges = seams.boundaries(len(mixture), *window) if window is not None else None
        window = p1_window(song)
        metrics: dict[str, Any] = {}
        for instrument, est in estimates.items():
            others = [refs[s] for s in STEMS if s != instrument]
            m = scoring.separation(refs[instrument], est, mixture, others=others)
            if edges is not None and not m["silent"]:
                m["seam_db"] = seams.seam_ratio_db(refs[instrument], est, edges)
            if window is not None:
                a, b = window
                cut = scoring.separation(refs[instrument][a:b], est[a:b], mixture[a:b])
                m["window_usdr_from_full"] = cut.get("usdr", float("nan"))
                alone = window_usdr(args.model, song, instrument)
                if alone is not None:
                    m["window_usdr_alone"] = alone
            metrics[instrument] = {k: round(float(v), 3) for k, v in m.items()}
        append(
            root,
            {
                "kind": "run",
                "model": args.model,
                "setting": args.setting,
                "song": song,
                "duration_s": round(len(mixture) / RATE, 1),
                "seconds": round(result.seconds, 2),
                "peak_mb": round(result.peak_mb),
                "boundaries": len(edges) if edges is not None else None,
                "metrics": metrics,
            },
        )
        print(f"{args.model} {args.setting} {song}: {result.seconds:.1f}s", flush=True)
    return 0


def cmd_determinism(args: argparse.Namespace) -> int:
    root = Path(args.root).expanduser()
    if ("determinism", args.model, args.setting, args.song) in done(root):
        return 0
    mixture = read(root / args.song / "mixture.wav")
    _, first = separate(args.model, args.setting, mixture, root / "work")
    window = seams.roformer_window()
    _, second = separate(args.model, args.setting, mixture, root / "work")
    # Half a model window: the RoFormer step, or half of Demucs' 7.8 s segment.
    pad = window[1] // 2 if window is not None else int(3.9 * RATE)
    shifted = np.pad(mixture, ((pad, 0), (0, 0)))
    _, third = separate(args.model, args.setting, shifted, root / "work")
    row: dict[str, Any] = {
        "kind": "determinism",
        "model": args.model,
        "setting": args.setting,
        "song": args.song,
        "offset_s": round(pad / RATE, 3),
        "metrics": {},
    }
    for instrument in first:
        a, b = first[instrument], second[instrument]
        c = third[instrument][pad : pad + len(a)]
        diff = float(np.abs(a - b).max())
        row["metrics"][instrument] = {
            "identical": bool(np.array_equal(a, b)),
            "max_abs_diff_dbfs": round(20 * np.log10(diff), 1) if diff > 0 else None,
            "repeat_sdr_db": round(scoring.usdr(a, b), 2),
            "offset_sdr_db": round(scoring.usdr(a, c), 2),
        }
    append(root, row)
    print(json.dumps(row), flush=True)
    return 0


def git_sha() -> str:
    out = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True)
    dirty = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
    return (out.stdout.strip() or "unknown") + ("+dirty" if dirty.stdout.strip() else "")


def fmt(value: Any) -> str:
    if value is None or (isinstance(value, float) and not np.isfinite(value)):
        return "-"
    return f"{value:.2f}" if isinstance(value, float) else str(value)


def med(values: list[float]) -> float:
    kept = [v for v in values if np.isfinite(v)]
    return statistics.median(kept) if kept else float("nan")


def cmd_report(args: argparse.Namespace) -> int:
    root = Path(args.root).expanduser()
    rows = [
        cast(dict[str, Any], json.loads(line))
        for line in (root / "records.jsonl").read_text(encoding="utf-8").splitlines()
        if line
    ]
    runs = [r for r in rows if r["kind"] == "run"]
    lines = [
        f"# Prototype 1: full-length songs ({datetime.now(UTC).date().isoformat()})",
        "",
        f"git `{git_sha()}` · songs: {', '.join(sorted({r['song'] for r in runs}))} (MUSDB18-HQ "
        f"test, whole, all stems) · RTX 3060 (CUDA, 129 W cap) · metrics: "
        f"{scoring.SEPARATION_VARIANT} · seam ratio: 1 kHz high-passed residual power within "
        f"±{seams.HALF_S * 1000:.0f} ms of the model's window boundaries over elsewhere (dB)",
        "",
        f"Command: `uv run python eval/p1_fullsong.py {shlex.join(sys.argv[1:])}`",
        "",
        "## Quality, medians over songs",
        "",
        "| model | setting | instrument | n | uSDR full song | uSDR on the P1 window, cut from "
        "the full run | uSDR, window separated alone | SI-SDR | cSDR | seam ratio (dB) |",
        "|---|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    keys = sorted({(r["model"], r["setting"], i) for r in runs for i in r["metrics"]})
    for model, setting, instrument in keys:
        cell = [
            r["metrics"][instrument]
            for r in runs
            if r["model"] == model and r["setting"] == setting and instrument in r["metrics"]
        ]
        scored = [m for m in cell if not m["silent"]]

        def col(key: str, sel: list[dict[str, Any]] = scored) -> str:
            return fmt(med([float(m[key]) for m in sel if key in m]))

        lines.append(
            f"| {model} | {setting} | {instrument} | {len(scored)} | {col('usdr')} | "
            f"{col('window_usdr_from_full')} | {col('window_usdr_alone')} | {col('si_sdr')} | "
            f"{col('csdr')} | {col('seam_db')} |"
        )
    lines += [
        "",
        "## Time and memory (per song)",
        "",
        "| model | setting | song | duration (s) | seconds | x realtime | peak MB | boundaries |",
        "|---|---|---|---:|---:|---:|---:|---:|",
    ]
    for r in sorted(runs, key=lambda r: (r["model"], r["setting"], r["song"])):
        lines.append(
            f"| {r['model']} | {r['setting']} | {r['song']} | {r['duration_s']} | {r['seconds']} "
            f"| {r['duration_s'] / max(r['seconds'], 1e-9):.1f} | {r['peak_mb']} | "
            f"{fmt(r['boundaries'])} |"
        )
    det = [r for r in rows if r["kind"] == "determinism"]
    if det:
        lines += [
            "",
            "## Determinism",
            "",
            "| model | setting | song | instrument | identical | max abs diff (dBFS) | repeat SDR "
            "(dB) | offset (s) | offset SDR (dB) |",
            "|---|---|---|---|---|---:|---:|---:|---:|",
        ]
        for r in det:
            for instrument, m in r["metrics"].items():
                lines.append(
                    f"| {r['model']} | {r['setting']} | {r['song']} | {instrument} | "
                    f"{m['identical']} | {fmt(m['max_abs_diff_dbfs'])} | "
                    f"{fmt(m['repeat_sdr_db'])} | {r['offset_s']} | {fmt(m['offset_sdr_db'])} |"
                )
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"→ {out}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--root", default=str(ROOT))
    sub = p.add_subparsers(dest="command", required=True)
    r = sub.add_parser("run")
    r.add_argument("--model", required=True)
    r.add_argument("--setting", choices=("shipped", "library"), default="shipped")
    r.add_argument("--song", action="append")
    r.set_defaults(fn=cmd_run)
    d = sub.add_parser("determinism")
    d.add_argument("--model", required=True)
    d.add_argument("--setting", choices=("shipped", "library"), default="shipped")
    d.add_argument("--song", required=True)
    d.set_defaults(fn=cmd_determinism)
    t = sub.add_parser("report")
    t.add_argument("--out", required=True)
    t.set_defaults(fn=cmd_report)
    args = p.parse_args(argv)
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
