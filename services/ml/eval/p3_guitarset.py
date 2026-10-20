"""Prototype 3: music-core fret DP on GuitarSet ground-truth notes.

    uv run python eval/p3_guitarset.py --guitarset ~/datasets/guitarset/annotation \
        --report eval/results/p3/2026-10-20.md

Gate (08-evaluation-harness-and-prototypes.md §3): string/fret agreement >= 0.90 and 100% span
compliance with maxSpan = 4. GuitarSet (CC-BY-4.0) is read from a local download and never
committed.
"""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

from splitune_eval.tab_metrics import (
    Assignment,
    Chord,
    GtNote,
    Score,
    gt_span_violations,
    guitarset_chords,
    guitarset_notes,
    load_jams,
    lowest_fret_baseline,
    run_music_core_fret,
    score,
)

REPO = Path(__file__).resolve().parents[3]
CLI = REPO / "packages" / "music-core" / "src" / "cli.ts"
GATE_AGREEMENT = 0.90
GATE_SPAN = 1.0
MAX_SPAN = 4


@dataclass(frozen=True)
class Excerpt:
    name: str
    player: str
    style: str  # "comp" | "solo"
    notes: list[GtNote]
    chords: list[Chord]


@dataclass(frozen=True)
class Row:
    excerpt: Excerpt
    score: Score


def load_excerpts(root: Path, chord_source: str, players: set[str] | None) -> list[Excerpt]:
    excerpts: list[Excerpt] = []
    for path in sorted(root.glob("*.jams")):
        player = path.stem.split("_")[0]
        if players is not None and player not in players:
            continue
        jams = load_jams(path)
        chords = [] if chord_source == "none" else guitarset_chords(jams, chord_source)
        excerpts.append(
            Excerpt(
                name=path.stem,
                player=player,
                style="solo" if path.stem.endswith("_solo") else "comp",
                notes=guitarset_notes(jams),
                chords=chords,
            )
        )
    return excerpts


def evaluate(excerpts: list[Excerpt], config: dict[str, Any], jobs: int) -> list[Row]:
    def one(excerpt: Excerpt) -> Row:
        assignments = run_music_core_fret(CLI, excerpt.notes, excerpt.chords, config)
        return Row(excerpt, score(excerpt.notes, assignments, MAX_SPAN))

    with ThreadPoolExecutor(max_workers=jobs) as pool:
        return list(pool.map(one, excerpts))


def baseline(excerpts: list[Excerpt]) -> list[Row]:
    rows: list[Row] = []
    for excerpt in excerpts:
        assignments: list[Assignment] = lowest_fret_baseline(excerpt.notes)
        rows.append(Row(excerpt, score(excerpt.notes, assignments, MAX_SPAN)))
    return rows


def total(rows: list[Row], style: str | None = None) -> Score:
    chosen = [r.score for r in rows if style is None or r.excerpt.style == style]
    return Score(
        notes=sum(s.notes for s in chosen),
        agreed=sum(s.agreed for s in chosen),
        steps=sum(s.steps for s in chosen),
        steps_within_span=sum(s.steps_within_span for s in chosen),
        unplaced=sum(s.unplaced for s in chosen),
    )


def git_sha() -> str:
    result = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"],
        cwd=REPO,
        capture_output=True,
        text=True,
        check=False,
    )
    dirty = subprocess.run(
        ["git", "status", "--porcelain", "--", "packages/music-core"],
        cwd=REPO,
        capture_output=True,
        text=True,
        check=False,
    )
    return result.stdout.strip() + ("+dirty" if dirty.stdout.strip() else "")


def fmt(s: Score) -> str:
    return (
        f"{s.agreement:.4f} | {s.span_compliance * 100:.2f}% ({s.steps_within_span}/{s.steps}) | "
        f"{s.unplaced} | {s.notes}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--guitarset", type=Path, required=True, help="unzipped annotation/ dir")
    parser.add_argument("--mode", action="append", choices=["easiest", "as_played"])
    parser.add_argument(
        "--chords", choices=["instructed", "performed", "none"], default="instructed"
    )
    parser.add_argument("--weights", type=json.loads, default={}, help="JSON FretWeights overrides")
    parser.add_argument("--players", help="comma-separated player ids, e.g. 00,01,02")
    parser.add_argument(
        "--report", type=Path, help="write a Markdown report (and a .csv next to it)"
    )
    parser.add_argument("--jobs", type=int, default=8)
    args = parser.parse_args()

    players = set(cast(str, args.players).split(",")) if args.players else None
    excerpts = load_excerpts(cast(Path, args.guitarset).expanduser(), args.chords, players)
    if not excerpts:
        print("no JAMS files found", file=sys.stderr)
        return 2
    modes = cast(list[str], args.mode or ["easiest", "as_played"])
    weights = cast(dict[str, float], args.weights)
    results = {
        mode: evaluate(
            excerpts,
            {
                "mode": mode,
                "max_span": MAX_SPAN,
                "weights": weights,
            },
            args.jobs,
        )
        for mode in modes
    }
    base = baseline(excerpts)
    all_notes = [n for e in excerpts for n in e.notes]
    gt_violations = sum(gt_span_violations(e.notes, MAX_SPAN) for e in excerpts)

    lines = [
        f"# P3 — fret DP on GuitarSet ground truth ({datetime.now(UTC).date().isoformat()})",
        "",
        f"- music-core: `{git_sha()}` via `node packages/music-core/src/cli.ts fret`",
        f"- Dataset: GuitarSet annotations (Zenodo 3371780, CC-BY-4.0), {len(excerpts)} excerpts, "
        f"{len(all_notes)} notes; chords: {args.chords}",
        f"- Config: standard tuning, capo 0, maxSpan {MAX_SPAN}, weights overrides "
        f"`{json.dumps(weights)}`",
        "- Agreement: share of ground-truth notes placed on exactly the annotated string and fret "
        "(unplaced notes count as wrong). Span compliance: onset groups (30 ms) with >= 2 fretted "
        f"notes whose fretted span is <= {MAX_SPAN}.",
        f"- Gate: agreement >= {GATE_AGREEMENT:.2f} and span compliance 100%.",
        f"- Ground truth itself exceeds a {MAX_SPAN}-fret span in {gt_violations} onset groups.",
        "",
        "| System | Subset | Agreement | Span compliance | Unplaced | Notes |",
        "|---|---|---|---|---|---|",
    ]
    for mode, rows in results.items():
        for subset in (None, "comp", "solo"):
            lines.append(f"| DP `{mode}` | {subset or 'all'} | {fmt(total(rows, subset))} |")
    for subset in (None, "comp", "solo"):
        lines.append(f"| lowest-fret baseline | {subset or 'all'} | {fmt(total(base, subset))} |")
    lines.append("")
    for mode, rows in results.items():
        s = total(rows)
        passed = s.agreement >= GATE_AGREEMENT and s.span_compliance >= GATE_SPAN
        lines.append(f"- `{mode}`: gate {'PASS' if passed else 'FAIL'}")
    report = "\n".join(lines) + "\n"
    print(report)

    if args.report:
        path = cast(Path, args.report)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(report, encoding="utf-8")
        with path.with_suffix(".csv").open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(
                ["system", "excerpt", "player", "style", "notes", "agreed", "steps", "within_span"]
            )
            for system, rows in [
                *((f"dp_{m}", r) for m, r in results.items()),
                ("lowest_fret", base),
            ]:
                for row in rows:
                    s = row.score
                    writer.writerow(
                        [
                            system,
                            row.excerpt.name,
                            row.excerpt.player,
                            row.excerpt.style,
                            s.notes,
                            s.agreed,
                            s.steps,
                            s.steps_within_span,
                        ]
                    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
