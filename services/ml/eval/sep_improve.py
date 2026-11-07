"""Step 29 reports: each phase's paired comparisons and its pre-registered criterion, from the
records of `sep_matrix.py` (and `p1_fullsong.py`), written to results/sep-improve/<date>-<phase>.md
and .csv.

    uv run python eval/sep_improve.py vocals --out results/sep-improve/D-vocals.md [--jobs FILE]
    (phases: vocals, loud, chunk, autocast, keys, shifts)

Sets: `v2` = musdb18hq-p1-v2 (20 windows), `moisesdb` = moisesdb-p1 (40), `slakh` =
slakh-keys-p1 (5). A paired delta is candidate - baseline per clip, on the clips where both
scored the instrument (silent references are excluded; scoring.SEPARATION_VARIANT); "paired
median" is its median. "Pooled" medians take the clips of every set that has the reference.
Criteria and their readings are the step 29 plan's (approved 2026-11-07); a result between the
pass and falsified thresholds is INCONCLUSIVE. `--jobs` lists the exact commands that made the
records (the job files the runs were driven from).
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import shlex
import statistics
import subprocess
import sys
from datetime import UTC, datetime
from importlib import metadata
from pathlib import Path
from typing import Any

import numpy as np
from splitune_eval import scoring, sepmap
from splitune_eval.registry import load_set

SET_IDS = {"v2": "musdb18hq-p1-v2", "moisesdb": "moisesdb-p1", "slakh": "slakh-keys-p1"}
FULLSONG = Path("~/datasets/musdb18hq-full")
Rows = dict[str, dict[str, Any]]


def resolve(name: str) -> tuple[Path, list[str]]:
    tset = load_set(SET_IDS[name])
    return tset.root_path, [i.id for i in tset.resolved_items()]


def records(root: Path, variant: str, model: str) -> Rows:
    log = root / "matrix" / variant / f"{model}.jsonl"
    if not log.is_file():
        return {}
    rows = [json.loads(line) for line in log.read_text(encoding="utf-8").splitlines() if line]
    return {r["clip"]: r for r in rows}


def scored(rows: Rows, clips: list[str], instrument: str, metric: str) -> dict[str, float]:
    out: dict[str, float] = {}
    for clip in clips:
        m = rows.get(clip, {}).get("metrics", {}).get(instrument)
        if m is not None and not m["silent"] and metric in m:
            out[clip] = float(m[metric])
    return out


def paired(a: dict[str, float], b: dict[str, float]) -> list[float]:
    return [a[c] - b[c] for c in sorted(a) if c in b]


def med(values: list[float]) -> float:
    return statistics.median(values) if values else float("nan")


def fmt(value: float, digits: int = 2) -> str:
    return "-" if not np.isfinite(value) else f"{value:.{digits}f}"


def signed(value: float) -> str:
    return "-" if not np.isfinite(value) else f"{value:+.2f}"


class Report:
    def __init__(self, title: str) -> None:
        self.title = title
        self.lines: list[str] = []
        self.table: list[dict[str, Any]] = []

    def compare(
        self, set_name: str, variant: str, model: str, base: str, instrument: str, keep: bool = True
    ) -> dict[str, Any]:
        """One comparison row (kept for the CSV unless `keep` is off); its per-clip paired deltas
        in `deltas` (uSDR), `bleed_deltas` and `full_deltas`."""
        root, clips = resolve(set_name)
        cand_rows, base_rows = records(root, variant, model), records(root, variant, base)
        cand = scored(cand_rows, clips, instrument, "usdr")
        ref = scored(base_rows, clips, instrument, "usdr")
        dist = scoring.distribution(sorted(cand.items()))
        delta = paired(cand, ref)
        bleed = paired(*(scored(r, clips, instrument, "bleedless") for r in (cand_rows, base_rows)))
        full = paired(*(scored(r, clips, instrument, "fullness") for r in (cand_rows, base_rows)))
        seconds = [r["seconds"] for c, r in cand_rows.items() if c in clips]
        row = {
            "set": set_name,
            "variant": variant,
            "model": model,
            "baseline": base,
            "instrument": instrument,
            "n": dist["n"],
            "median": dist["median"],
            "mean": dist["mean"],
            "p10": dist["p10"],
            "worst": "; ".join(f"{c} {v:.2f}" for c, v in dist["worst"]),
            "baseline_median": med(list(ref.values())),
            "paired_n": len(delta),
            "delta_usdr": med(delta),
            "delta_bleedless": med(bleed),
            "delta_fullness": med(full),
            "bleedless": med(list(scored(cand_rows, clips, instrument, "bleedless").values())),
            "baseline_bleedless": med(
                list(scored(base_rows, clips, instrument, "bleedless").values())
            ),
            "fullness": med(list(scored(cand_rows, clips, instrument, "fullness").values())),
            "seconds": med(seconds),
            "peak_mb": max((r["peak_mb"] for c, r in cand_rows.items() if c in clips), default=0),
        }
        if keep:
            self.table.append(row)
        return {**row, "deltas": delta, "bleed_deltas": bleed, "full_deltas": full}

    def rows_table(self, rows: list[dict[str, Any]]) -> None:
        self.lines += [
            "| set | variant | model | vs | instrument | n | median | mean | p10 | worst 3 | "
            "vs median | paired Δ uSDR (n) | Δ bleedless | Δ fullness | s/clip | peak MB |",
            "|---|---|---|---|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|",
        ]
        for r in rows:
            self.lines.append(
                f"| {r['set']} | {r['variant']} | {r['model']} | {r['baseline']} | "
                f"{r['instrument']} | {r['n']} | {fmt(r['median'])} | {fmt(r['mean'])} | "
                f"{fmt(r['p10'])} | {r['worst']} | {fmt(r['baseline_median'])} | "
                f"{signed(r['delta_usdr'])} ({r['paired_n']}) | {signed(r['delta_bleedless'])} | "
                f"{signed(r['delta_fullness'])} | {fmt(r['seconds'], 1)} | {r['peak_mb']} |"
            )
        self.lines.append("")

    def write(self, out: Path, models: list[str], jobs: list[str]) -> None:
        head = [
            f"# {self.title} ({datetime.now(UTC).date().isoformat()})",
            "",
            *environment(models),
            "",
            "Commands (`uv run --no-sync` from services/ml; each run resumes per clip):",
            "",
            "```bash",
            *jobs,
            f"python eval/sep_improve.py {shlex.join(sys.argv[1:])}",
            "```",
            "",
            f"Scoring: {scoring.SEPARATION_VARIANT}.",
            "",
        ]
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text("\n".join(head + self.lines) + "\n", encoding="utf-8", newline="\n")
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=list(self.table[0]) if self.table else ["set"])
        writer.writeheader()
        writer.writerows(self.table)
        out.with_suffix(".csv").write_text(buffer.getvalue(), encoding="utf-8", newline="\n")
        print(f"-> {out}")


def environment(models: list[str]) -> list[str]:
    from splitune_ml_core import register

    sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True)
    dirty = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
    gpu = subprocess.run(
        ["nvidia-smi", "--query-gpu=name,power.limit", "--format=csv,noheader"],
        capture_output=True,
        text=True,
    )
    versions = ", ".join(f"{p} {metadata.version(p)}" for p in ("audio-separator", "torch"))
    lines = [
        f"git `{sha.stdout.strip()}{'+dirty' if dirty.stdout.strip() else ''}` · {versions} · "
        f"GPU {gpu.stdout.strip() or 'n/a'} (the 129 W cap of step 28 was not applied)",
        "",
        "Model files (compliance/register):",
        "",
    ]
    seen: set[str] = set()
    for model in models:
        record = sepmap.spec(model).record
        if record in seen:
            continue
        seen.add(record)
        files = ", ".join(
            f"`{f.name}` {f.sha256[:12]}" for f in register.model(record).weights.files
        )
        lines.append(f"- `{record}`: {files}")
    return lines


def verdict(passed: bool, falsified: bool) -> str:
    return "**PASS**" if passed else "**FALSIFIED**" if falsified else "**INCONCLUSIVE**"


# --- Phase 2: vocals head ------------------------------------------------------------------------

VOCALS = ["bs_roformer_leap_xe", "bs_roformer_leap_v1", "bs_roformer_ft1_anvuew"]
ENSEMBLES = ["leap_v1_xe_avg_wave", "leap_v1_xe_avg_fft"]
KIM = "mel_roformer_kim_vocals"


def phase_vocals(report: Report) -> list[str]:
    rows = [
        report.compare(s, v, m, KIM, "vocals")
        for m in [*VOCALS, "bs_roformer_sw", "bs_roformer_viperx_1297"]
        for s in ("v2", "moisesdb")
        for v in ("clean", "aac128", "limit-XL")
    ]
    report.lines += ["## Every head vs Kim (vocals uSDR, dB)", ""]
    report.rows_table(rows)
    _, v2 = resolve("v2")
    kim_s = [
        r["seconds"]
        for s in ("v2", "moisesdb")
        for r in records(resolve(s)[0], "aac128", f"{KIM}@s29").values()
        if s == "moisesdb" or r["clip"] in v2
    ]
    report.lines += [
        "## Criterion (research experiment 1)",
        "",
        "Pass: paired median uSDR ≥ +0.3 dB vs Kim at `aac128` on both sets, median bleedless "
        "no more than 2 points below Kim's on either set (`aac128`), time ≤ 2.5x Kim's "
        f"(median s per clip at `aac128`, Kim re-timed this session: {med(kim_s):.1f} s). "
        "Falsified: paired median < +0.1 dB on either set.",
        "",
        "| candidate | Δ v2 | Δ moisesdb | bleedless vs Kim (v2 / moisesdb) | time x Kim | "
        "verdict |",
        "|---|---:|---:|---|---:|---|",
    ]
    outcome: dict[str, dict[str, Any]] = {}
    for m in VOCALS:
        cells = {
            s: next(
                r for r in rows if r["model"] == m and r["set"] == s and r["variant"] == "aac128"
            )
            for s in ("v2", "moisesdb")
        }
        deltas = [cells[s]["delta_usdr"] for s in cells]
        bleed = [cells[s]["bleedless"] - cells[s]["baseline_bleedless"] for s in cells]
        seconds = [
            r["seconds"]
            for s in ("v2", "moisesdb")
            for r in records(resolve(s)[0], "aac128", m).values()
            if s == "moisesdb" or r["clip"] in v2
        ]
        time = med(seconds) / med(kim_s)
        quality = min(deltas) >= 0.3 and min(bleed) >= -2
        passed = quality and time <= 2.5
        falsified = min(deltas) < 0.1
        label = verdict(passed, falsified)
        if quality and not passed:
            label = "**PASS on quality, FAIL on time**"
        outcome[m] = {"deltas": deltas, "time": time, "quality": quality, "passed": passed}
        report.lines.append(
            f"| {m} | {signed(deltas[0])} | {signed(deltas[1])} | "
            f"{bleed[0]:+.2f} / {bleed[1]:+.2f} "
            f"| {time:.2f} | {label} |"
        )
    report.lines.append("")
    singles = [m for m in ("bs_roformer_leap_v1", "bs_roformer_leap_xe")]
    best = max(singles, key=lambda m: min(outcome[m]["deltas"]))
    ens = [
        report.compare(s, "aac128", e, best, "vocals")
        for e in ENSEMBLES
        for s in ("v2", "moisesdb")
    ]
    if any(r["paired_n"] for r in ens):
        report.lines += [
            f"## Leap v1 + Xe ensembles vs the better single model ({best}), `aac128`",
            "",
            "Ships instead of the single model only with ≥ +0.15 dB paired on both sets and no "
            "bleedless loss (median Δ bleedless ≥ 0).",
            "",
        ]
        report.rows_table(ens)
        for e in ENSEMBLES:
            cells = [r for r in ens if r["model"] == e]
            ok = all(r["delta_usdr"] >= 0.15 and r["delta_bleedless"] >= 0 for r in cells)
            report.lines.append(f"- `{e}`: {'**PASS**' if ok else '**FAIL**'}")
        report.lines.append("")
    return [*VOCALS, KIM, "bs_roformer_sw", "bs_roformer_viperx_1297"]


# --- Phase 3: loud masters -----------------------------------------------------------------------

GAINS = ["gain-14", "gain-18", "gain-6db"]
STEMS = {KIM: ["vocals"], "bs_roformer_sw": ["vocals", "drums", "bass"]}


def phase_loud(report: Report) -> list[str]:
    rows: list[dict[str, Any]] = []
    for g in GAINS:
        for m, stems in STEMS.items():
            for i in stems:
                for s, v in (
                    ("v2", "limit-XL"),
                    ("moisesdb", "limit-XL"),
                    ("v2", "musdb-xl"),
                    ("v2", "clean"),
                    ("moisesdb", "clean"),
                ):
                    rows.append(report.compare(s, v, f"{m}@{g}", m, i))
    report.lines += ["## Pre-separation gain vs the same model without it (uSDR, dB)", ""]
    report.rows_table(rows)
    report.lines += [
        "## Criterion (research experiment 2)",
        "",
        "Pass: paired median ≥ +0.5 dB on `limit-XL` on both sets for Kim's vocals or SW's "
        "drums, with `clean` within ±0.1 dB on both sets. Falsified: < +0.2 dB.",
        "",
        "| setting | stem | Δ limit-XL v2 | Δ limit-XL moisesdb | Δ musdb-xl v2 | Δ clean v2 | "
        "Δ clean moisesdb | verdict |",
        "|---|---|---:|---:|---:|---:|---:|---|",
    ]
    for g in GAINS:
        for m, i in (
            (KIM, "vocals"),
            ("bs_roformer_sw", "drums"),
            ("bs_roformer_sw", "vocals"),
            ("bs_roformer_sw", "bass"),
        ):

            def d(s: str, v: str, g: str = g, m: str = m, i: str = i) -> float:
                return next(
                    r["delta_usdr"]
                    for r in rows
                    if r["model"] == f"{m}@{g}"
                    and r["instrument"] == i
                    and r["set"] == s
                    and r["variant"] == v
                )

            loud = [d("v2", "limit-XL"), d("moisesdb", "limit-XL")]
            clean = [d("v2", "clean"), d("moisesdb", "clean")]
            passed = min(loud) >= 0.5 and max(abs(c) for c in clean) <= 0.1
            label = verdict(passed, max(loud) < 0.2)
            if min(loud) >= 0.5 and not passed:
                label = "**PASS on limit-XL, clean moved**"
            report.lines.append(
                f"| {g} | {m} {i} | {signed(loud[0])} | {signed(loud[1])} | "
                f"{signed(d('v2', 'musdb-xl'))} | {signed(clean[0])} | {signed(clean[1])} | "
                f"{label} |"
            )
    report.lines.append("")
    clip_rows = [
        report.compare(s, v, f"{m}@noclip", m, i)
        for v in ("limit-XL+aac128", "limit-XL+opus128")
        for m, stems in STEMS.items()
        for i in stems
        for s in ("v2", "moisesdb")
    ]
    report.lines += [
        "## Decode clipping: the same lossy hot master unclipped vs clipped at ±1 (uSDR, dB)",
        "",
        "The decode cache (24-bit FLAC) clips decoded samples above full scale. Fix when the "
        "paired median effect is ≥ 0.2 dB on any stem.",
        "",
    ]
    report.rows_table(clip_rows)
    worst = max(clip_rows, key=lambda r: r["delta_usdr"] if np.isfinite(r["delta_usdr"]) else -99)
    fix = worst["delta_usdr"] >= 0.2
    report.lines += [
        "Largest effect: "
        f"{signed(worst['delta_usdr'])} dB ({worst['model']} {worst['instrument']}, "
        f"{worst['set']} {worst['variant']}): "
        f"{'**FIX** (≥ 0.2 dB)' if fix else '**NO FIX** (< 0.2 dB)'}.",
        "",
    ]
    return [KIM, "bs_roformer_sw"]


# --- Phase 4: SW chunk length --------------------------------------------------------------------

CHUNKS = ["bs_roformer_sw@chunk13", "bs_roformer_sw@chunk20"]
SW_INSTRUMENTS = {
    "vocals": ("v2", "moisesdb"),
    "drums": ("v2", "moisesdb"),
    "bass": ("v2", "moisesdb"),
    "guitar": ("moisesdb",),
    "piano": ("moisesdb",),
}


def fullsong(model: str) -> list[dict[str, Any]]:
    path = FULLSONG.expanduser() / "records.jsonl"
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]
    return [
        r for r in rows if r["kind"] == "run" and r["model"] == model and r["setting"] == "shipped"
    ]


def pooled(
    report: Report,
    model: str,
    base: str,
    instrument: str,
    variant: str,
    sets: tuple[str, ...],
    key: str = "deltas",
) -> tuple[float, int]:
    """Median of the per-clip paired deltas over every set's clips."""
    deltas: list[float] = []
    for s in sets:
        deltas += report.compare(s, variant, model, base, instrument, keep=False)[key]
    return med(deltas), len(deltas)


def phase_chunk(report: Report) -> list[str]:
    rows = [
        report.compare(s, v, m, "bs_roformer_sw", i)
        for m in CHUNKS
        for i, sets in SW_INSTRUMENTS.items()
        for s in sets
        for v in ("clean", "aac128")
    ]
    report.lines += ["## SW at longer chunks vs today's 9.29 s (uSDR, dB)", ""]
    report.rows_table(rows)
    base = fullsong("bs_roformer_sw@s29")
    base_s = sum(r["seconds"] for r in base)
    report.lines += [
        "## Criterion (research experiment 3)",
        "",
        "Pass: pooled paired median ≥ +0.1 dB on ≥ 3 of the 5 SW instruments with none below "
        "-0.1 (both `clean` and `aac128`), bass seam ratio not above 1.0 dB (median over the 5 "
        "full songs), full-song time ≤ 1.25x today's (re-timed this session), peak VRAM ≤ 9 GB. "
        "Falsified: every instrument within ±0.05 dB.",
        "",
        "| chunk | "
        + " | ".join(f"Δ {i} clean / aac128 (n)" for i in SW_INSTRUMENTS)
        + " | bass seam (dB) | time x today | peak MB | verdict |",
        "|---|" + "---:|" * len(SW_INSTRUMENTS) + "---:|---:|---:|---|",
    ]
    for m in ["bs_roformer_sw@s29", *CHUNKS]:
        songs = fullsong(m)
        seam = med(
            [
                r["metrics"]["bass"]["seam_db"]
                for r in songs
                if "seam_db" in r["metrics"].get("bass", {})
            ]
        )
        time = sum(r["seconds"] for r in songs) / base_s if songs and base_s else float("nan")
        peak = max((r["peak_mb"] for r in songs), default=0)
        if m == "bs_roformer_sw@s29":
            report.lines.append(
                "| today (9.29 s) | "
                + " | ".join("-" for _ in SW_INSTRUMENTS)
                + f" | {fmt(seam)} | 1.00 | {peak} | baseline |"
            )
            continue
        cells: list[str] = []
        gains = drops = flat = 0
        for i, sets in SW_INSTRUMENTS.items():
            dc, n = pooled(report, m, "bs_roformer_sw", i, "clean", sets)
            da, _ = pooled(report, m, "bs_roformer_sw", i, "aac128", sets)
            cells.append(f"{signed(dc)} / {signed(da)} ({n})")
            gains += min(dc, da) >= 0.1
            drops += min(dc, da) < -0.1
            flat += max(abs(dc), abs(da)) <= 0.05
        passed = gains >= 3 and drops == 0 and seam <= 1.0 and time <= 1.25 and peak <= 9000
        report.lines.append(
            f"| {m} | " + " | ".join(cells) + f" | {fmt(seam)} | {time:.2f} | {peak} | "
            f"{verdict(passed, flat == len(SW_INSTRUMENTS))} |"
        )
    report.lines.append("")
    return ["bs_roformer_sw"]


# --- Phase 4: autocast ---------------------------------------------------------------------------

ROFORMERS = [
    "bs_roformer_sw",
    "mel_roformer_kim_vocals",
    "bs_roformer_viperx_1297",
    "mel_roformer_guitar_becruily",
]


def phase_autocast(report: Report, regression: Path | None) -> list[str]:
    report.lines += [
        "## Full songs: autocast (fp16 on CUDA) vs fp32, same session",
        "",
        "| model | songs | fp32 s | autocast s | time ratio | median Δ full-song uSDR (dB) | "
        "peak MB fp32 / autocast |",
        "|---|---:|---:|---:|---:|---:|---|",
    ]
    ratios: list[float] = []
    for m in ROFORMERS:
        a, b = fullsong(f"{m}@s29"), fullsong(f"{m}@autocast")
        songs = {r["song"] for r in a} & {r["song"] for r in b}
        if not songs:
            continue
        sa = sum(r["seconds"] for r in a if r["song"] in songs)
        sb = sum(r["seconds"] for r in b if r["song"] in songs)
        by = {
            (r["song"], i): v["usdr"]
            for r in a
            for i, v in r["metrics"].items()
            if not v.get("silent")
        }
        delta = [
            v["usdr"] - by[(r["song"], i)]
            for r in b
            for i, v in r["metrics"].items()
            if (r["song"], i) in by
        ]
        ratios.append(sb / sa)
        peaks = f"{max(r['peak_mb'] for r in a)} / {max(r['peak_mb'] for r in b)}"
        report.lines.append(
            f"| {m} | {len(songs)} | {sa:.1f} | {sb:.1f} | {sb / sa:.2f} | "
            f"{signed(med(delta))} | {peaks} |"
        )
    report.lines.append("")
    path = FULLSONG.expanduser() / "records.jsonl"
    det = [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if '"determinism"' in line
    ]
    report.lines += [
        "## Determinism of autocast runs (same song twice)",
        "",
        "| model | instrument | identical | repeat SDR (dB) |",
        "|---|---|---|---:|",
    ]
    for r in det:
        if r["model"].endswith("@autocast"):
            for i, v in r["metrics"].items():
                report.lines.append(
                    f"| {r['model']} | {i} | {v['identical']} | {v['repeat_sdr_db']} |"
                )
    report.lines.append("")
    breach = None
    if regression is not None and regression.is_file():
        text = regression.read_text(encoding="utf-8")
        breach = "FAIL" in text.split("\n", 6)[-1][:400] or "**FAIL**" in text
        report.lines += [
            f"Regression suite with autocast on every map RoFormer (`{regression.name}`): "
            f"{'breach' if breach else 'no breach'}.",
            "",
        ]
    passed = breach is False and ratios and max(ratios) <= 0.8
    report.lines += [
        "## Criterion",
        "",
        "Ship if the regression suite shows no breach and time ≤ 0.8x on the PC (every RoFormer). "
        "The Mac (MPS autocast) is not measured here.",
        "",
        f"Verdict: {verdict(bool(passed), False)}",
        "",
    ]
    return ROFORMERS


# --- Phase 5: keys fallback ----------------------------------------------------------------------

SILENT = ["664cc931-piano", "737356b2-piano", "765d5131-piano"]


def phase_keys(report: Report, tags: dict[str, dict[str, Any]], recipes: list[str]) -> list[str]:
    root, clips = resolve("moisesdb")
    sw = records(root, "clean", "bs_roformer_sw")
    sw_piano = scored(sw, clips, "piano", "usdr")
    singles = ["mega53_keys5", "xlance_syn_mss", "xlance_syn_chain", "xlance_key_mss"]
    rows = [
        report.compare("moisesdb", "clean", m, "bs_roformer_sw", "piano") for m in singles + recipes
    ]
    report.lines += [
        "## Candidates and routed models vs SW on the moisesdb piano windows "
        "(piano + other_keys reference, uSDR)",
        "",
    ]
    report.rows_table(rows)
    report.lines += [
        "## Per window",
        "",
        "| window | SW piano energy (dB vs mix) | SW uSDR | tagger piano prob / subtype | "
        + " | ".join(recipes)
        + " |",
        "|---|---:|---:|---|" + "---:|" * len(recipes),
    ]
    recipe_rows = {r: records(root, "clean", r) for r in recipes}
    for clip in sorted(sw_piano, key=lambda c: sw_piano[c]):
        t = tags.get(clip, {})
        cells: list[str] = []
        for r in recipes:
            row = recipe_rows[r].get(clip)
            value = scored({clip: row}, [clip], "piano", "usdr").get(clip) if row else None
            routed = row and row.get("virtual", {}).get("routed")
            cells.append("-" if value is None else f"{value:.2f}{' (routed)' if routed else ''}")
        report.lines.append(
            f"| {clip} | {sw[clip]['energy_db']['piano']:.1f} | {sw_piano[clip]:.2f} | "
            f"{t.get('present_prob', '-')} / {t.get('subtype', '-')} | " + " | ".join(cells) + " |"
        )
    report.lines.append("")
    report.lines += [
        "## Criterion (research experiment 4)",
        "",
        "Pass: the 3 silent windows reach median ≥ +3 dB uSDR; the router never triggers on a "
        "window where SW scores ≥ 3 dB; the median over all 25 doesn't fall and the mean rises "
        "(the plan's reading: those windows sit below the median, so it can't rise); and the "
        "fallback reaches ≥ +2 dB median uSDR out of sample (Slakh). Falsified: silent windows "
        "stay < 1 dB.",
        "",
        "| routed model | silent windows (median) | triggers where SW ≥ 3 dB | "
        "median 25 (SW → routed) | mean 25 (SW → routed) | verdict |",
        "|---|---:|---:|---|---|---|",
    ]
    outcome: dict[str, bool] = {}
    for r in recipes:
        rows_r = recipe_rows[r]
        routed = scored(rows_r, clips, "piano", "usdr")
        silent = med([routed[c] for c in SILENT if c in routed])
        bad = sum(
            1
            for c, row in rows_r.items()
            if row.get("virtual", {}).get("routed") and sw_piano.get(c, -99) >= 3
        )
        shared = [c for c in sw_piano if c in routed]
        m0, m1 = med([sw_piano[c] for c in shared]), med([routed[c] for c in shared])
        a0, a1 = (
            statistics.mean(sw_piano[c] for c in shared),
            statistics.mean(routed[c] for c in shared),
        )
        passed = silent >= 3 and bad == 0 and m1 >= m0 and a1 > a0
        outcome[r] = passed
        report.lines.append(
            f"| {r} | {silent:.2f} | {bad} | {m0:.2f} → {m1:.2f} | {a0:.2f} → {a1:.2f} | "
            f"{verdict(passed, silent < 1)} (MoisesDB part) |"
        )
    report.lines.append("")
    return ["bs_roformer_sw", *singles]


# --- Phase 6: shift averaging --------------------------------------------------------------------

SHIFTS = ["bs_roformer_sw@shifts3", "bs_roformer_sw@shifts5"]


def phase_shifts(report: Report) -> list[str]:
    rows = [
        report.compare(s, v, m, "bs_roformer_sw", i)
        for m in SHIFTS
        for i in ("drums", "bass", "vocals")
        for s in ("v2", "moisesdb")
        for v in ("clean", "aac128")
    ]
    report.lines += ["## SW with shift averaging vs SW (uSDR, dB)", ""]
    report.rows_table(rows)
    report.lines += [
        "## Criterion (research experiment 5)",
        "",
        "Pass: pooled paired median ≥ +0.15 dB on drums or bass (both `clean` and `aac128`), "
        "fullness up, bleedless no more than 2 points lower. Prefer 3 shifts if within 0.05 dB "
        "of 5. Falsified: < +0.05 dB.",
        "",
        "| model | stem | Δ uSDR clean / aac128 (n) | Δ fullness clean / aac128 | "
        "Δ bleedless clean / aac128 | time x SW | verdict |",
        "|---|---|---|---|---|---:|---|",
    ]
    sw_s = [
        x["seconds"]
        for st in ("v2", "moisesdb")
        for x in records(resolve(st)[0], "aac128", "bs_roformer_sw").values()
    ]
    both = ("v2", "moisesdb")
    for m in SHIFTS:
        seconds = [r["seconds"] for r in rows if r["model"] == m and r["variant"] == "aac128"]
        time = med(seconds) / med(sw_s)
        for i in ("drums", "bass"):
            du = {v: pooled(report, m, "bs_roformer_sw", i, v, both) for v in ("clean", "aac128")}
            df = {v: pooled(report, m, "bs_roformer_sw", i, v, both, "full_deltas")[0] for v in du}
            dbl = {
                v: pooled(report, m, "bs_roformer_sw", i, v, both, "bleed_deltas")[0] for v in du
            }
            gain = min(d for d, _ in du.values())
            passed = gain >= 0.15 and min(df.values()) > 0 and min(dbl.values()) >= -2
            report.lines.append(
                f"| {m} | {i} | "
                f"{signed(du['clean'][0])} / {signed(du['aac128'][0])} ({du['clean'][1]}) | "
                f"{signed(df['clean'])} / {signed(df['aac128'])} | "
                f"{signed(dbl['clean'])} / {signed(dbl['aac128'])} | "
                f"{time:.2f} | {verdict(passed, max(d for d, _ in du.values()) < 0.05)} |"
            )
    report.lines.append("")
    return ["bs_roformer_sw"]


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("phase", choices=("vocals", "loud", "chunk", "autocast", "keys", "shifts"))
    p.add_argument("--out", required=True)
    p.add_argument(
        "--jobs", action="append", default=[], help="job files whose commands made the records"
    )
    p.add_argument(
        "--grep", action="append", default=[], help="only job lines containing one of these"
    )
    p.add_argument("--regression", help="autocast: the regression report of the autocast map")
    p.add_argument("--tags", help="keys: eval/keys_tags.py output for moisesdb-p1")
    p.add_argument("--recipe", action="append", default=[], help="keys: routed virtual models")
    args = p.parse_args(argv)
    titles = {
        "vocals": "Step 29 Phase 2: vocals head",
        "loud": "Step 29 Phase 3: loud masters (pre-separation gain, decode clipping)",
        "chunk": "Step 29 Phase 4: BS-Roformer-SW chunk length",
        "autocast": "Step 29 Phase 4: autocast",
        "keys": "Step 29 Phase 5: keys fallback for synth and organ",
        "shifts": "Step 29 Phase 6: shift averaging for drums and bass",
    }
    report = Report(titles[args.phase])
    if args.phase == "vocals":
        models = phase_vocals(report)
    elif args.phase == "loud":
        models = phase_loud(report)
    elif args.phase == "chunk":
        models = phase_chunk(report)
    elif args.phase == "autocast":
        models = phase_autocast(report, Path(args.regression) if args.regression else None)
    elif args.phase == "keys":
        tags: dict[str, dict[str, Any]] = (
            json.loads(Path(args.tags).read_text(encoding="utf-8")) if args.tags else {}
        )
        models = phase_keys(report, tags, args.recipe)
    else:
        models = phase_shifts(report)
    jobs = [
        line
        for path in args.jobs
        for line in Path(path).read_text(encoding="utf-8").splitlines()
        if line
        and not line.startswith("#")
        and (not args.grep or any(g in line for g in args.grep))
    ]
    report.write(Path(args.out), models, jobs)
    return 0


if __name__ == "__main__":
    sys.exit(main())
