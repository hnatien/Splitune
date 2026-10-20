"""Coordinate-descent tuning of the music-core fret weights on GuitarSet (Prototype 3).

    uv run python eval/p3_tune.py --guitarset ~/datasets/guitarset/annotation --mode as_played

Tunes on the training players and reports the held-out players with the chosen weights, so the
recorded agreement is not just fitted to the data it was tuned on.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import cast

from p3_guitarset import MAX_SPAN, Excerpt, evaluate, load_excerpts, total

GRID: dict[str, list[float]] = {
    "fretHeight": [0, 0.01, 0.03],
    "openString": [-1, -0.5, -0.2, 0, 0.3],
    "span": [0, 0.2, 0.5, 1],
    "handShift": [0.5, 1, 2, 4],
    "handShiftTimeS": [0.25, 0.5, 1, 2],
    "stringSkip": [0, 0.2, 0.5, 1],
    "chordShape": [0, 0.5, 1, 2, 3],
    "stretch": [0, 0.3, 1],
    "legato": [0, 0.3, 0.6],
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--guitarset", type=Path, required=True)
    parser.add_argument("--mode", choices=["easiest", "as_played"], default="as_played")
    parser.add_argument("--train", default="00,01,02")
    parser.add_argument("--test", default="03,04,05")
    parser.add_argument("--start", type=json.loads, default={}, help="initial weight overrides")
    parser.add_argument("--sweeps", type=int, default=2)
    parser.add_argument("--jobs", type=int, default=8)
    args = parser.parse_args()

    root = cast(Path, args.guitarset).expanduser()
    train = load_excerpts(root, "instructed", set(cast(str, args.train).split(",")))
    test = load_excerpts(root, "instructed", set(cast(str, args.test).split(",")))

    def agreement(weights: dict[str, float], excerpts: list[Excerpt]) -> float:
        config = {"mode": args.mode, "max_span": MAX_SPAN, "weights": weights}
        return total(evaluate(excerpts, config, cast(int, args.jobs))).agreement

    weights = cast(dict[str, float], dict(args.start))
    best = agreement(weights, train)
    print(f"start {json.dumps(weights)} train={best:.4f}", flush=True)
    for sweep in range(args.sweeps):
        for name, values in GRID.items():
            for value in values:
                trial = {**weights, name: value}
                if trial == weights:
                    continue
                score = agreement(trial, train)
                if score > best + 1e-4:
                    best, weights = score, trial
                    print(f"sweep {sweep} {name}={value} train={best:.4f}", flush=True)
    held_out = agreement(weights, test)
    print(json.dumps({"mode": args.mode, "weights": weights, "train": best, "test": held_out}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
