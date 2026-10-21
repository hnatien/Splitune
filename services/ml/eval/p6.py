"""Prototype 6: chords on mixture vs no-drums stem vs fusion, and key (08 §3 P6, personal mode).

    uv run python eval/p6.py build        # GuitarSet comping excerpts + MUSDB18-HQ drums → mixtures
    uv run python eval/p6.py separate     # BS-Roformer-SW drums per mixture (the no-drums input)
    uv run python eval/p6.py predict      # shipped beats + chords stages, every system x input
    uv run python eval/p6.py report       # WCSR majmin / sevenths / majmin_inv, key → results/p6

Systems: consonance-ACE, BTC (large vocabulary) and madmom CNN+CRF, each decoded in the majmin
and (where the model supports it) the sevenths vocabulary. Inputs: `mixture`, `no_drums`
(mixture minus the separated drums) and `fusion` (both, averaged per beat; the bass-root prior
needs a bass stem, which this material doesn't have). Beats come from the shipped beats stage on
the mixture. References: GuitarSet's lead-sheet ("instructed") chords for the gate and its
performed chords as a second view; key from GuitarSet's key_mode, scored with mir_eval's
weighted key score for madmom's CNN and music-core's estimator (over each system's chords).

Material: the 60 GuitarSet comping excerpts of progression 1 (CC-BY-4.0, all six players) with
the drums of a MUSDB18-HQ test window, the guitar 3 LU below the drums. consonance-ACE, BTC and
madmom were trained on Isophonics/Billboard-style pop, not GuitarSet, so this set is out of
sample for all three (it is solo guitar plus drums: easier harmony, harder timbre).
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import statistics
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import mir_eval  # pyright: ignore[reportMissingTypeStubs]
import numpy as np
from p2 import GUITAR_BELOW_BAND_LU, MUSDB, SEPARATOR, fit_length, loudness, read, write
from splitune_eval.local import LocalRun, write_json
from splitune_eval.report import git_sha

ROOT = Path("~/datasets/p6").expanduser()
GUITARSET = Path("~/datasets/guitarset").expanduser()
RESULTS = Path(__file__).resolve().parent / "results" / "p6"
GATE_MAJMIN = 0.75  # 08 §3 P6: majmin >= 0.75 on the best input
SYSTEMS = {
    "consonance_ace": ("majmin", "sevenths"),
    "btc": ("majmin", "sevenths"),
    "madmom_cnn": ("majmin",),
}
INPUTS = {
    "mixture": {"inputs": ["mixture"], "separation": False},
    "no_drums": {"inputs": ["no_drums"], "separation": True},
    "fusion": {"inputs": ["mixture", "no_drums"], "separation": True},
}
METRICS = ("majmin", "sevenths", "majmin_inv")
REPORTED = (
    "instructed_majmin",
    "instructed_sevenths",
    "instructed_majmin_inv",
    "performed_majmin",
    "performed_sevenths",
)
MIR_EVAL = "0.8.2"


def manifest() -> list[dict[str, Any]]:
    return cast(list[dict[str, Any]], json.loads((ROOT / "items.json").read_text(encoding="utf-8")))


def jams_annotation(path: Path, namespace: str, index: int) -> list[dict[str, Any]]:
    document = cast(dict[str, Any], json.loads(path.read_text(encoding="utf-8")))
    matches = [a for a in document["annotations"] if a["namespace"] == namespace]
    return cast(list[dict[str, Any]], matches[index]["data"])


def cmd_build(_: argparse.Namespace) -> int:
    windows = sorted(p for p in MUSDB.iterdir() if (p / "drums.wav").is_file())
    jams = sorted(
        p
        for p in (GUITARSET / "annotation").glob("*_comp.jams")
        if re.match(r"^0[0-5]_[A-Za-z]+1-", p.stem)
    )
    items: list[dict[str, Any]] = []
    for k, path in enumerate(jams):
        guitar = read(GUITARSET / "audio_mono-mic" / f"{path.stem}_mic.wav")
        drums = fit_length(read(windows[k % len(windows)] / "drums.wav"), len(guitar))
        gain_db = loudness(guitar) - loudness(drums) + GUITAR_BELOW_BAND_LU
        mixture = (guitar + drums * np.float32(10 ** (gain_db / 20))).astype(np.float32)
        scale = np.float32(min(1.0, 0.9 / float(np.max(np.abs(mixture)))))
        out = ROOT / "items" / path.stem
        write(out / "mixture.wav", mixture * scale)
        items.append({"id": path.stem, "dir": str(out), "jams": str(path), "player": path.stem[:2]})
        print(f"p6 {path.stem}", flush=True)
    write_json(ROOT / "items.json", items)
    return 0


def cmd_separate(_: argparse.Namespace) -> int:
    from stage_separation import config, models  # torch + audio-separator: only here

    spec = config.load().models[SEPARATOR]
    for item in manifest():
        out = Path(item["dir"]) / "sep"
        if (out / "drums.wav").is_file():
            continue
        result = models.separate(SEPARATOR, spec, Path(item["dir"]) / "mixture.wav", out)
        print(f"{SEPARATOR} {item['id']}: {result.seconds:.1f}s", flush=True)
    return 0


def pred_path(system: str, vocabulary: str, source: str, item: str) -> Path:
    return ROOT / "runs" / f"{system}.{vocabulary}.{source}" / f"{item}.chords.json"


def cmd_predict(args: argparse.Namespace) -> int:
    from stage_chords import key as key_mod

    with tempfile.TemporaryDirectory() as tmp:
        local = LocalRun(Path(tmp))
        keys: dict[str, Any] = {}
        keys_path = ROOT / "runs" / "madmom_key.json"
        if keys_path.is_file():
            keys = cast(dict[str, Any], json.loads(keys_path.read_text(encoding="utf-8")))
        for item in manifest():
            base = Path(item["dir"])
            todo = [
                (system, vocab, source)
                for system, vocabs in SYSTEMS.items()
                if system in args.system
                for vocab in vocabs
                for source in INPUTS
                if not pred_path(system, vocab, source, item["id"]).is_file()
            ]
            if not todo and item["id"] in keys:
                continue
            decoded = local.decode(base / "mixture.wav")
            beats = local.keep(local.run("beats", {}, decoded), "beats", base / "beats.json")
            separation = local.separation(
                decoded,
                {"drums": base / "sep" / "drums.wav"},
                "drums",
                SEPARATOR,
                base / "separation.json",
            )
            if item["id"] not in keys:
                keys[item["id"]] = key_mod.madmom_key(read(base / "mixture.wav"))
                write_json(keys_path, keys)
            for system, vocab, source in todo:
                inputs = {"beats": str(beats)}
                if INPUTS[source]["separation"]:
                    inputs["separation"] = str(separation)
                params = {
                    "recognizer": system,
                    "vocabulary": vocab,
                    "inputs": INPUTS[source]["inputs"],
                    "bass_root_weight": 0.5,
                    "key": "music_core",
                }
                out = local.run("chords", inputs, decoded, params)
                local.keep(out, "chords", pred_path(system, vocab, source, item["id"]))
                print(f"{system} {vocab} {source} {item['id']}", flush=True)
    return 0


def chord_scores(ref: list[dict[str, Any]], est: dict[str, Any]) -> dict[str, float]:
    ri = np.array([[o["time"], o["time"] + o["duration"]] for o in ref])
    rl = [str(o["value"]) for o in ref]
    ei = np.array([[s["t0"], s["t1"]] for s in est["segments"]])
    el = [str(s["label"]) for s in est["segments"]]
    ei, el = mir_eval.util.adjust_intervals(ei, el, float(ri.min()), float(ri.max()), "N", "N")  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]
    scores = cast(dict[str, float], mir_eval.chord.evaluate(ri, rl, ei, el))  # pyright: ignore[reportUnknownMemberType]
    return {m: float(scores[m]) for m in METRICS}


def key_score(ref: str, tonic: str, mode: str) -> float:
    return float(mir_eval.key.weighted_score(ref.replace(":", " "), f"{tonic} {mode}"))  # pyright: ignore[reportUnknownMemberType]


def mean(values: list[float]) -> float:
    return statistics.fmean(values) if values else float("nan")


def cmd_report(_: argparse.Namespace) -> int:
    items = manifest()
    keys = cast(
        dict[str, Any], json.loads((ROOT / "runs" / "madmom_key.json").read_text(encoding="utf-8"))
    )
    rows: list[dict[str, Any]] = []
    for item in items:
        jams = Path(item["jams"])
        refs = {
            "instructed": jams_annotation(jams, "chord", 0),
            "performed": jams_annotation(jams, "chord", 1),
        }
        ref_key = str(jams_annotation(jams, "key_mode", 0)[0]["value"])
        for system, vocabs in SYSTEMS.items():
            for vocab in vocabs:
                for source in INPUTS:
                    path = pred_path(system, vocab, source, item["id"])
                    if not path.is_file():
                        continue
                    est = cast(dict[str, Any], json.loads(path.read_text(encoding="utf-8")))
                    row: dict[str, Any] = {
                        "item": item["id"],
                        "player": item["player"],
                        "system": system,
                        "vocabulary": vocab,
                        "input": source,
                    }
                    for ref_name, ref in refs.items():
                        row |= {f"{ref_name}_{m}": v for m, v in chord_scores(ref, est).items()}
                    row["key_music_core"] = key_score(
                        ref_key, est["key"]["tonic"], est["key"]["mode"]
                    )
                    row["key_madmom"] = key_score(
                        ref_key, keys[item["id"]]["tonic"], keys[item["id"]]["mode"]
                    )
                    rows.append(row)
    keys_by_item = {r["item"]: float(r["key_madmom"]) for r in rows}
    RESULTS.mkdir(parents=True, exist_ok=True)
    date = datetime.now(UTC).strftime("%Y-%m-%d")
    with (RESULTS / f"{date}.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    def cell(sel: list[dict[str, Any]], key: str) -> str:
        return f"{mean([r[key] for r in sel]):.3f}"

    out = [
        f"# Prototype 6 — chords on mixture vs no-drums vs fusion ({date})",
        "",
        f"git `{git_sha()}` · metric: mir_eval {MIR_EVAL} chord.evaluate, duration-weighted "
        "CSR (WCSR), per item then averaged · references: GuitarSet lead-sheet (instructed) and "
        f"performed chords · {len(items)} comping excerpts + MUSDB18-HQ drums · beats: shipped "
        f"beats stage · no-drums: mixture minus `{SEPARATOR}` drums",
        "",
        "| system | vocabulary | input | majmin | sevenths | majmin_inv | performed majmin "
        "| performed sevenths |",
        "|---|---|---|---|---|---|---|---|",
    ]
    best: tuple[float, str] = (-1.0, "")
    for system, vocabs in SYSTEMS.items():
        for vocab in vocabs:
            for source in INPUTS:
                sel = [
                    r
                    for r in rows
                    if r["system"] == system and r["vocabulary"] == vocab and r["input"] == source
                ]
                if not sel:
                    continue
                majmin = mean([r["instructed_majmin"] for r in sel])
                if majmin > best[0]:
                    best = (majmin, f"{system} / {vocab} / {source}")
                cells = " | ".join(cell(sel, k) for k in REPORTED)
                out.append(f"| {system} | {vocab} | {source} | {cells} |")
    out += [
        "",
        f"## Gate (08 §3 P6: majmin ≥ {GATE_MAJMIN:.2f} on the best input)",
        "",
        f"Best: **{best[1]}**, majmin {best[0]:.3f} → "
        f"**{'PASS' if best[0] >= GATE_MAJMIN else 'FAIL'}**",
        "",
        "## Key (mir_eval weighted score, GuitarSet key_mode)",
        "",
        f"- madmom CNN on the mixture: {mean([keys_by_item[i] for i in keys_by_item]):.3f}",
    ]
    for system in SYSTEMS:
        sel = [
            r
            for r in rows
            if r["system"] == system and r["vocabulary"] == "majmin" and r["input"] == "fusion"
        ]
        if sel:
            out.append(
                f"- music-core over {system} majmin fusion chords: {cell(sel, 'key_music_core')}"
            )
    out += ["", f"Per-item rows: `{date}.csv`. Command: `{' '.join(sys.argv)}`", ""]
    (RESULTS / f"{date}.md").write_text("\n".join(out), encoding="utf-8")
    print("\n".join(out))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n", 1)[0])
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("build").set_defaults(fn=cmd_build)
    sub.add_parser("separate").set_defaults(fn=cmd_separate)
    p = sub.add_parser("predict")
    p.add_argument("--system", nargs="+", choices=list(SYSTEMS), default=list(SYSTEMS))
    p.set_defaults(fn=cmd_predict)
    sub.add_parser("report").set_defaults(fn=cmd_report)
    args = parser.parse_args()
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
