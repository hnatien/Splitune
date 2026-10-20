"""Scoring per task over a registered test set. Estimates live in a predictions directory as
`<item id>.<suffix>` (see ESTIMATES); `tab` needs none: it runs the shipped music-core fret DP on
the reference notes."""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, cast

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]

from . import formats, scoring, tab_metrics
from .registry import Item, TestSet

ESTIMATES: dict[str, tuple[str, ...]] = {
    "beats": (".beats.json", ".beats.txt"),
    "notes": (".notes.json", ".notes.csv"),
    "chords": (".chords.json", ".chords.lab"),
    "melody": (".f0.csv",),
}
MUSIC_CORE_CLI = Path(__file__).resolve().parents[5] / "packages" / "music-core" / "src" / "cli.ts"


@dataclass
class ItemResult:
    item: Item
    metrics: dict[str, float]


@dataclass
class TaskResult:
    task: str
    variant: str
    items: list[ItemResult]
    model_refs: list[dict[str, Any]] = field(default_factory=list[dict[str, Any]])
    pooled: dict[str, float] = field(default_factory=dict[str, float])


def _estimate(pred_dir: Path, item: Item, task: str) -> Path:
    for suffix in ESTIMATES[task]:
        path = pred_dir / f"{item.id}{suffix}"
        if path.is_file():
            return path
    raise FileNotFoundError(f"no {task} estimate for {item.id} in {pred_dir}")


def _models(path: Path) -> list[dict[str, Any]]:
    if path.suffix != ".json":
        return []
    return cast(
        list[dict[str, Any]], json.loads(path.read_text(encoding="utf-8")).get("models", [])
    )


Scorer = Callable[[Path, Path], tuple[dict[str, float], str]]

SCORERS: dict[str, Scorer] = {
    "beats": lambda ref, est: scoring.beats(formats.beats(ref), formats.beats(est)),
    "notes": lambda ref, est: scoring.notes(formats.notes(ref), formats.notes(est)),
    "chords": lambda ref, est: scoring.chords(formats.chords(ref), formats.chords(est)),
    "melody": lambda ref, est: scoring.melody(formats.melody(ref), formats.melody(est)),
}


def _read(path: Path) -> tuple[np.ndarray[Any, np.dtype[np.float64]], int]:
    data, rate = sf.read(str(path), dtype="float64", always_2d=True)  # pyright: ignore[reportUnknownMemberType]
    return np.asarray(data, dtype=np.float64), int(rate)


def score_sep(tset: TestSet, items: list[Item], pred_dir: Path, chunked: bool) -> TaskResult:
    """`annotations.sep` is a directory of reference stems `<stem>.wav`; estimates are
    `<pred>/<item id>/<stem>.wav`."""
    results: list[ItemResult] = []
    for item in items:
        metrics: dict[str, float] = {}
        for ref_path in sorted(tset.path(item.annotations["sep"]).glob("*.wav")):
            ref, rate = _read(ref_path)
            est, _ = _read(pred_dir / item.id / ref_path.name)
            metrics[f"{ref_path.stem}_usdr"] = scoring.usdr(ref, est)
            if chunked:
                metrics[f"{ref_path.stem}_csdr"] = scoring.csdr(ref, est, rate)
        results.append(ItemResult(item, metrics))
    variant = "uSDR (MDX/MSST: whole-track energy ratio, dB)"
    if chunked:
        variant += f"; cSDR (mir_eval {scoring.MIR_EVAL} BSS Eval v3 images, 1 s windows, median)"
    return TaskResult("sep", variant, results)


def score_tab(tset: TestSet, items: list[Item], mode: str, max_span: int) -> TaskResult:
    config: dict[str, Any] = {"mode": mode, "max_span": max_span, "weights": {}}
    results: list[ItemResult] = []
    totals = np.zeros(5)
    for item in items:
        jams = tab_metrics.load_jams(tset.path(item.annotations["tab"]))
        notes = tab_metrics.guitarset_notes(jams)
        chords = tab_metrics.guitarset_chords(jams)
        assignments = tab_metrics.run_music_core_fret(MUSIC_CORE_CLI, notes, chords, config)
        s = tab_metrics.score(notes, assignments, max_span)
        totals += [s.notes, s.agreed, s.steps, s.steps_within_span, s.unplaced]
        results.append(
            ItemResult(
                item,
                {
                    "agreement": s.agreement,
                    "span_compliance": s.span_compliance,
                    "unplaced": float(s.unplaced),
                    "notes": float(s.notes),
                },
            )
        )
    notes_n, agreed, steps, within, unplaced = totals.tolist()
    pooled = {
        "agreement": agreed / notes_n if notes_n else 0.0,
        "span_compliance": within / steps if steps else 1.0,
        "unplaced": unplaced,
        "notes": notes_n,
    }
    variant = (
        f"string/fret agreement on reference notes (music-core fret DP via `node "
        f"packages/music-core/src/cli.ts fret`, mode {mode}); span compliance = onset groups "
        f"(30 ms) with >= 2 fretted notes spanning <= {max_span} frets"
    )
    return TaskResult("tab", variant, results, pooled=pooled)


def score(
    task: str,
    tset: TestSet,
    pred_dir: Path | None,
    *,
    chunked_sdr: bool = False,
    tab_mode: str = "as_played",
    max_span: int = 4,
) -> TaskResult:
    if task not in tset.tasks:
        raise ValueError(f"set {tset.id} has no {task} annotations")
    items = [i for i in tset.resolved_items() if task in i.annotations]
    if not items:
        raise ValueError(f"set {tset.id}: no items with {task} annotations")
    if task == "tab":
        return score_tab(tset, items, tab_mode, max_span)
    if pred_dir is None:
        raise ValueError(f"--pred is required for {task}")
    if task == "sep":
        return score_sep(tset, items, pred_dir, chunked_sdr)
    results: list[ItemResult] = []
    variant = ""
    refs: list[dict[str, Any]] = []
    for item in items:
        est = _estimate(pred_dir, item, task)
        metrics, variant = SCORERS[task](tset.path(item.annotations[task]), est)
        refs = refs or _models(est)
        results.append(ItemResult(item, metrics))
    return TaskResult(task, variant, results, model_refs=refs)
