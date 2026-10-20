"""Markdown + CSV reports with git sha, model refs, dataset id and metric variant (08 §1)."""

from __future__ import annotations

import csv
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np

from .registry import TestSet
from .tasks import TaskResult

REPO = Path(__file__).resolve().parents[5]
RESULTS_DIR = REPO / "services" / "ml" / "eval" / "results"


def git_sha() -> str:
    def git(*args: str) -> str:
        return subprocess.run(
            ["git", *args], cwd=REPO, capture_output=True, text=True, check=False
        ).stdout.strip()

    dirty = git("status", "--porcelain", "--", "services/ml", "packages")
    return git("rev-parse", "--short", "HEAD") + ("+dirty" if dirty else "")


def _models(refs: list[dict[str, Any]]) -> str:
    if not refs:
        return "none recorded"
    return ", ".join(
        f"`{r['model_id']}@{r['version']}` (weights {str(r['weights_sha256'])[:12]})" for r in refs
    )


def summary(result: TaskResult) -> dict[str, dict[str, float]]:
    names = sorted({k for r in result.items for k in r.metrics})
    out: dict[str, dict[str, float]] = {}
    for name in names:
        values = np.array([r.metrics[name] for r in result.items if name in r.metrics])
        finite = values[np.isfinite(values)]
        out[name] = {
            "mean": float(np.mean(finite)) if finite.size else float("nan"),
            "median": float(np.median(finite)) if finite.size else float("nan"),
            "min": float(np.min(finite)) if finite.size else float("nan"),
            "n": float(finite.size),
        }
    return out


def by_tag(result: TaskResult, metric: str) -> dict[str, dict[str, float]]:
    groups: dict[str, list[float]] = {}
    for r in result.items:
        if metric not in r.metrics:
            continue
        for key, value in r.item.tags.items():
            groups.setdefault(f"{key}={value}", []).append(r.metrics[metric])
    return {g: {"mean": float(np.mean(v)), "n": float(len(v))} for g, v in sorted(groups.items())}


def render(
    result: TaskResult, tset: TestSet, *, command: str, headline: str, extra: list[str]
) -> str:
    date = datetime.now(UTC).date().isoformat()
    lines = [
        f"# {result.task} — {tset.id} ({date})",
        "",
        f"- Git: `{git_sha()}`",
        f"- Set: `{tset.id}` ({tset.licence}; {tset.provenance}), split {tset.split}, "
        f"{len(result.items)} items",
        f"- Models: {_models(result.model_refs)}",
        f"- Metric variant: {result.variant}",
        f"- Command: `{command}`",
        *[f"- {line}" for line in extra],
        "",
        "| Metric | Mean | Median | Min | n |",
        "|---|---|---|---|---|",
    ]
    for name, s in summary(result).items():
        lines.append(
            f"| {name} | {s['mean']:.4f} | {s['median']:.4f} | {s['min']:.4f} | {int(s['n'])} |"
        )
    if result.pooled:
        lines += [
            "",
            "Pooled over all items: " + ", ".join(f"{k} {v:.4f}" for k, v in result.pooled.items()),
        ]
    groups = by_tag(result, headline)
    if groups:
        lines += ["", f"`{headline}` by tag:", "", "| Tag | Mean | n |", "|---|---|---|"]
        lines += [f"| {g} | {s['mean']:.4f} | {int(s['n'])} |" for g, s in groups.items()]
    return "\n".join(lines) + "\n"


def write(path: Path, markdown: str, result: TaskResult) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(markdown, encoding="utf-8")
    names = sorted({k for r in result.items for k in r.metrics})
    tags = sorted({k for r in result.items for k in r.item.tags})
    with path.with_suffix(".csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["item", *tags, *names])
        for r in result.items:
            writer.writerow(
                [
                    r.item.id,
                    *(r.item.tags.get(t, "") for t in tags),
                    *(f"{r.metrics[n]:.6f}" if n in r.metrics else "" for n in names),
                ]
            )
