"""Prototype 2d, Phase 3 (step 25): offline experiments on cached ADTOF activations.

    uv run python eval/p2d_tune.py acts [--tier ...]     # ADTOF activations per input and gain
    uv run python eval/p2d_tune.py sweep [--tune]        # input gain (and thresholds) per source
    uv run python eval/p2d_tune.py cv                    # 2-fold CV of gain + tuned thresholds
    uv run python eval/p2d_tune.py ensemble              # ADTOF combined with YourMT3+ hits
    uv run python eval/p2d_tune.py confidence            # per-hit score candidates
    uv run python eval/p2d_tune.py calibrate             # table from the `shipped` chain's runs
    uv run python eval/p2d_tune.py kitsep | kit          # DrumSep kit split (crash/ride, hi-hat)

`acts` runs the shipped network (`stage_notes.adtof.Adtof.activations`) once per item, input
(clean drums, drum stems of three separators, mixture) and input gain, and caches the [frames, 5]
activations under `~/datasets/p2d/acts/`. The other commands re-run the shipped peak picking
(`stage_notes.adtof.peaks`) on them: thresholds are tuned per class on one split (micro F1 over
its items) and reported on the other as p2d's item-mean onset F1. The chosen settings are then
checked end to end with `p2d.py predict --chain shipped` through the stage.
"""

from __future__ import annotations

import argparse
import itertools
import json
import sys
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

import numpy as np
import p2d  # pyright: ignore[reportMissingImports]
from numpy.typing import NDArray
from p2p import read_stereo  # pyright: ignore[reportMissingImports]
from stage_notes import adtof, drum_kit

# The eval scripts are untyped modules from pyright's point of view.
# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false

ACTS = p2d.ROOT / "acts"
SEPARATOR = "bs_roformer_sw"
# `stem` is the shipped chain's first model; `stem-<model>` the other drum separators.
SOURCES = ("clean", "stem", "mixture", "stem-htdemucs_ft", "stem-htdemucs_6s")
Mono = NDArray[np.float32]


def rms_to(db: float) -> Callable[[Mono], Mono]:
    def scale(mono: Mono) -> Mono:
        rms = float(np.sqrt(np.mean(np.square(mono, dtype=np.float64))))
        return (mono * np.float32(10 ** (db / 20) / max(rms, 1e-9))).astype(np.float32)

    return scale


def peak_to(db: float) -> Callable[[Mono], Mono]:
    def scale(mono: Mono) -> Mono:
        peak = float(np.max(np.abs(mono)))
        return (mono * np.float32(10 ** (db / 20) / max(peak, 1e-9))).astype(np.float32)

    return scale


# Input gain before the front end (log10(1 + |X|) is level-dependent).
GAINS: dict[str, Callable[[Mono], Mono] | None] = {
    "raw": None,
    "peak-1": peak_to(-1.0),
    **{f"rms-{-db}": rms_to(float(db)) for db in (-26, -23, -20, -17, -14, -11)},
}


def source_path(item: dict[str, Any], source: str) -> Path:
    base = Path(item["dir"])
    if source == "clean":
        return base / "drums.wav"
    if source.startswith("stem"):
        separator = source.removeprefix("stem-") if "-" in source else SEPARATOR
        return p2d.stem_dir(item, separator) / "drums.wav"
    return base / "mixture.wav"


def acts_path(item: dict[str, Any], source: str, gain: str) -> Path:
    return ACTS / source / gain / f"{item['id']}.npy"


def cmd_acts(args: argparse.Namespace) -> int:
    model = adtof.Adtof()
    for item in p2d.built(p2d.load_items(args.tier)):
        for source in SOURCES:
            path = source_path(item, source)
            if not path.is_file():
                continue
            mono = read_stereo(path).mean(axis=1).astype(np.float32)
            for gain, scale in GAINS.items():
                dest = acts_path(item, source, gain)
                if dest.is_file():
                    continue
                dest.parent.mkdir(parents=True, exist_ok=True)
                np.save(dest, model.activations(mono if scale is None else scale(mono)))
        print(f"acts {item['id']}", flush=True)
    return 0


def offline_hits(act: NDArray[np.float32], params: dict[str, Any]) -> list[tuple[float, int]]:
    """(onset, GM line) per peak, as `Adtof.transcribe_drums` finds them."""
    return [
        (frame / adtof.FPS, gm)
        for c, (gm, threshold) in enumerate(zip(adtof.LABELS, params["thresholds"], strict=True))
        for frame in adtof.peaks(act[:, c], float(threshold), params)
    ]


def class_counts(
    item: dict[str, Any], act: NDArray[np.float32], params: dict[str, Any]
) -> dict[str, tuple[int, int, int]]:
    ref = p2d.read_ref(Path(item["dir"]) / "ref.csv")
    scored = p2d.onset_scores(ref, offline_hits(act, params), p2d.classes_for(item), 0.05)
    return cast_counts(scored["counts"])


def cast_counts(counts: Any) -> dict[str, tuple[int, int, int]]:
    return {str(k): (int(v[0]), int(v[1]), int(v[2])) for k, v in counts.items()}


def item_f1(counts: dict[str, tuple[int, int, int]]) -> float:
    tp = sum(v[0] for v in counts.values())
    n = sum(v[1] + v[2] for v in counts.values())
    return 2 * tp / n if n else float("nan")


def scored_items(source: str, gain: str, tiers: list[str]) -> list[dict[str, Any]]:
    return [
        i
        for i in p2d.built(p2d.load_items(tiers))
        if acts_path(i, source, gain).is_file() and (Path(i["dir"]) / "ref.csv").is_file()
    ]


def shipped_gain(params: dict[str, Any]) -> str:
    level = params["input_rms_db"]
    return "raw" if level is None else f"rms-{-int(level)}"


def shipped_params() -> dict[str, Any]:
    """The ADTOF params of config/notes.personal.yaml's drums entry."""
    from stage_notes import transcribers

    return transcribers.for_instrument("drums")[1]


def tune_micro(
    items: list[dict[str, Any]], acts: dict[str, NDArray[np.float32]], grid: list[float]
) -> list[float]:
    """Per class, the threshold with the best micro F1 over the fit items (classes are scored
    independently, so they can be tuned one at a time)."""
    chosen = list(adtof.ADTOF_DEFAULTS["thresholds"])
    for c, gm in enumerate(adtof.LABELS):
        cls = drum_kit.class_of(gm)
        best = (-1.0, chosen[c])
        for t in grid:
            params = {**adtof.ADTOF_DEFAULTS, "thresholds": [*chosen[:c], t, *chosen[c + 1 :]]}
            tp = n = 0
            for item in items:
                if cls not in p2d.classes_for(item):
                    continue
                counts = class_counts(item, acts[item["id"]], params)[cls]
                tp, n = tp + counts[0], n + counts[1] + counts[2]
            f1 = 2 * tp / n if n else 0.0
            if f1 > best[0] + 1e-9:
                best = (f1, t)
        chosen[c] = best[1]
    return chosen


def tune_offset(items: list[dict[str, Any]], acts: dict[str, NDArray[np.float32]]) -> list[float]:
    """The published thresholds plus one shared offset, chosen by fit item-mean F1."""
    published = list(adtof.ADTOF_DEFAULTS["thresholds"])
    best = (-1.0, published)
    for delta in np.arange(-0.12, 0.13, 0.02):
        thresholds = [round(t + float(delta), 2) for t in published]
        params = {**adtof.ADTOF_DEFAULTS, "thresholds": thresholds}
        f1 = float(np.mean([item_f1(class_counts(i, acts[i["id"]], params)) for i in items]))
        if f1 > best[0] + 1e-9:
            best = (f1, thresholds)
    return best[1]


def evaluate(
    items: list[dict[str, Any]], acts: dict[str, NDArray[np.float32]], thresholds: list[float]
) -> dict[str, float]:
    params = {**adtof.ADTOF_DEFAULTS, "thresholds": thresholds}
    rows = [(i, item_f1(class_counts(i, acts[i["id"]], params))) for i in items]
    out = {
        "fit": float(np.mean([f for i, f in rows if i["split"] == "fit"])),
        "test": float(np.mean([f for i, f in rows if i["split"] == "test"])),
    }
    for tier in p2d.TIERS:
        sel = [f for i, f in rows if i["split"] == "test" and i["tier"] == tier]
        out[tier] = float(np.mean(sel)) if sel else float("nan")
    return out


def cmd_sweep(args: argparse.Namespace) -> int:
    grid = [round(float(x), 2) for x in np.arange(0.02, 0.62, 0.02)]
    tiers = [t for t in p2d.TIERS if t in args.tier]
    out = [
        "## ADTOF input gain and thresholds (fit, then held-out item-mean onset F1 ±50 ms)",
        "",
        "| input / gain | thresholds (BD SD TT HH CY) | fit | held-out | "
        + " | ".join(f"held-out {t}" for t in tiers)
        + " |",
        "|---|---|---|---|" + "---|" * len(tiers),
    ]
    for source, gain in itertools.product(args.source, GAINS):
        items = scored_items(source, gain, tiers)
        if not items:
            continue
        acts = {i["id"]: np.load(acts_path(i, source, gain)) for i in items}
        published = list(adtof.ADTOF_DEFAULTS["thresholds"])
        fit_items = [i for i in items if i["split"] == "fit"]
        candidates = [("published", published)]
        if args.tune:
            candidates += [
                ("per-class, fit micro F1", tune_micro(fit_items, acts, grid)),
                ("shared offset, fit item mean", tune_offset(fit_items, acts)),
            ]
        for label, thresholds in candidates:
            s = evaluate(items, acts, thresholds)
            out.append(
                f"| {source} / {gain} ({label}) | {' '.join(f'{t:.2f}' for t in thresholds)} | "
                f"{p2d.fmt(s['fit'])} | {p2d.fmt(s['test'])} | "
                + " | ".join(p2d.fmt(s[t]) for t in tiers)
                + " |"
            )
        print("\n".join(out[-len(candidates) :]), flush=True)
    text = "\n".join(out) + "\n"
    (p2d.ROOT / f"sweep-adtof-{args.name}.md").write_text(text, encoding="utf-8")
    return 0


def cmd_cv(args: argparse.Namespace) -> int:
    """Per input gain: thresholds tuned on one split and scored on the other, both ways (2-fold
    cross-validation), then the thresholds tuned on all items for the chosen gain."""
    grid = [round(float(x), 2) for x in np.arange(0.02, 0.62, 0.02)]
    out = [
        f"## Input gain with per-class thresholds, 2-fold cross-validated ({args.source})",
        "",
        "| gain | CV item-mean F1 | fit → held-out | held-out → fit | published, all items | "
        "thresholds tuned on fit | tuned on held-out |",
        "|---|---|---|---|---|---|---|",
    ]
    best = (-1.0, "raw")
    for gain in GAINS:
        items = scored_items(args.source, gain, list(p2d.TIERS))
        if not items:
            continue
        acts = {i["id"]: np.load(acts_path(i, args.source, gain)) for i in items}
        fit = [i for i in items if i["split"] == "fit"]
        test = [i for i in items if i["split"] == "test"]
        on_fit, on_test = tune_micro(fit, acts, grid), tune_micro(test, acts, grid)
        a, b = evaluate(items, acts, on_fit)["test"], evaluate(items, acts, on_test)["fit"]
        published = evaluate(items, acts, list(adtof.ADTOF_DEFAULTS["thresholds"]))
        cv = (a + b) / 2
        if cv > best[0]:
            best = (cv, gain)
        out.append(
            f"| {gain} | {cv:.3f} | {a:.3f} | {b:.3f} | "
            f"{(published['fit'] + published['test']) / 2:.3f} | "
            f"{' '.join(f'{t:.2f}' for t in on_fit)} | {' '.join(f'{t:.2f}' for t in on_test)} |"
        )
        print(out[-1], flush=True)
    items = scored_items(args.source, best[1], list(p2d.TIERS))
    acts = {i["id"]: np.load(acts_path(i, args.source, best[1])) for i in items}
    final = tune_micro(items, acts, grid)
    s = evaluate(items, acts, final)
    out += [
        "",
        f"Best CV gain `{best[1]}`; thresholds tuned on all items (BD SD TT HH CY): "
        f"{' '.join(f'{t:.2f}' for t in final)} (in-sample item mean fit {s['fit']:.3f}, "
        f"held-out {s['test']:.3f}).",
    ]
    text = "\n".join(out) + "\n"
    print(out[-1], flush=True)
    (p2d.ROOT / f"cv-{args.source}.md").write_text(text, encoding="utf-8")
    return 0


def other_hits(chain: str, item: dict[str, Any]) -> list[tuple[float, int]] | None:
    """Another chain's `chosen` hits from `p2d.py predict` (e.g. YourMT3+)."""
    path = p2d.run_path(chain, "chosen", item)
    if not path.is_file():
        return None
    doc = json.loads(path.read_text(encoding="utf-8"))
    return [(float(h["onset_s"]), int(h["gm_note"])) for h in doc["hits"]]


def near(t: float, cls: str, hits: list[tuple[float, int]], tolerance: float) -> bool:
    return any(abs(t - u) <= tolerance and drum_kit.class_of(g) == cls for u, g in hits)


def combine(
    act: NDArray[np.float32], other: list[tuple[float, int]], rule: str, thresholds: list[float]
) -> list[tuple[float, int]]:
    """ADTOF peaks combined with another transcriber's hits, per class within ±30 ms:
    `union` adds the other's hits ADTOF lacks; `agree` keeps ADTOF hits the other confirms;
    `rescue` also keeps ADTOF peaks down to 0.1 below the threshold when the other confirms."""
    params = {**adtof.ADTOF_DEFAULTS, "thresholds": thresholds}
    mine = offline_hits(act, params)
    if rule == "union":
        extra = [
            (t, g)
            for t, g in other
            if (c := drum_kit.class_of(g)) is not None and not near(t, c, mine, 0.03)
        ]
        return mine + extra
    if rule == "agree":
        return [(t, g) for t, g in mine if near(t, drum_kit.class_of(g) or "", other, 0.03)]
    low = offline_hits(act, {**params, "thresholds": [max(0.05, x - 0.1) for x in thresholds]})
    rescued = [
        (t, g)
        for t, g in low
        if not near(t, drum_kit.class_of(g) or "", mine, 0.0)
        and near(t, drum_kit.class_of(g) or "", other, 0.03)
    ]
    return mine + rescued


def split_mean(
    rows: list[tuple[dict[str, Any], float]], split: str, tier: str | None = None
) -> str:
    sel = [f for i, f in rows if i["split"] == split and tier in (None, i["tier"])]
    return p2d.fmt(float(np.mean(sel)) if sel else float("nan"))


def cmd_ensemble(args: argparse.Namespace) -> int:
    """The shipped ADTOF settings alone and combined with another chain's hits."""
    params = shipped_params()
    thresholds = [float(t) for t in params["thresholds"]]
    gain = shipped_gain(params)
    items = [
        i
        for i in scored_items(args.source, gain, list(p2d.TIERS))
        if other_hits(args.other, i) is not None
    ]
    out = [
        f"## ADTOF shipped ({args.source} / {gain}) with {args.other} (item-mean onset F1 ±50 ms)",
        "",
        "| rule | fit | held-out | " + " | ".join(f"held-out {t}" for t in p2d.TIERS) + " |",
        "|---|---|---|" + "---|" * len(p2d.TIERS),
    ]
    for rule in ("adtof", "other", "union", "agree", "rescue"):
        rows: list[tuple[dict[str, Any], float]] = []
        for item in items:
            act = np.load(acts_path(item, args.source, gain))
            other = other_hits(args.other, item) or []
            if rule == "adtof":
                est = offline_hits(act, {**adtof.ADTOF_DEFAULTS, "thresholds": thresholds})
            elif rule == "other":
                est = other
            else:
                est = combine(act, other, rule, thresholds)
            ref = p2d.read_ref(Path(item["dir"]) / "ref.csv")
            scored = p2d.onset_scores(ref, est, p2d.classes_for(item), 0.05)
            rows.append((item, item_f1(cast_counts(scored["counts"]))))

        out.append(
            f"| {rule} | {split_mean(rows, 'fit')} | {split_mean(rows, 'test')} | "
            + " | ".join(split_mean(rows, "test", t) for t in p2d.TIERS)
            + " |"
        )
        print(out[-1], flush=True)
    text = "\n".join(out) + "\n"
    (p2d.ROOT / f"ensemble-{args.other}.md").write_text(text, encoding="utf-8")
    return 0


KIT_RECORD = "mdx23c-drumsep"
KIT_FILE = "MDX23C-DrumSep-aufr33-jarredou.ckpt"
KIT_STEMS = ("kick", "snare", "toms", "hh", "ride", "crash")


def kit_dir(item: dict[str, Any]) -> Path:
    return Path(item["dir"]) / "kit-drumsep"


def cmd_kitsep(args: argparse.Namespace) -> int:
    """DrumSep on the shipped chain's drum stem → kit-drumsep/<piece>.wav per item."""
    import logging

    import torch
    from audio_separator.separator import Separator  # pyright: ignore[reportMissingTypeStubs]
    from splitune_ml_core import register
    from stage_separation import models

    folder = models.models_dir() / "audio-separator"
    register.verify(register.model(KIT_RECORD), folder)
    separator: Any = Separator(
        log_level=logging.ERROR,
        model_file_dir=str(folder),
        output_dir=str(p2d.ROOT),
        output_format="WAV",
        normalization_threshold=1.0,
        amplification_threshold=0.0,
        sample_rate=44100,
        use_soundfile=True,
        mdxc_params=models.LIBRARY_PARAMS["mdxc"],
    )
    separator.torch_device = torch.device(models.device())
    separator.load_model(model_filename=KIT_FILE)
    for item in p2d.built(p2d.load_items(args.tier)):
        out = kit_dir(item)
        stem = source_path(item, "stem")
        if (out / "crash.wav").is_file() or not stem.is_file():
            continue
        out.mkdir(parents=True, exist_ok=True)
        separator.output_dir = str(out)
        separator.model_instance.output_dir = str(out)
        started = time.monotonic()
        separator._separate_file(str(stem), {k: k for k in KIT_STEMS})
        seconds = time.monotonic() - started
        (out / "timing.json").write_text(json.dumps({"seconds": seconds}), encoding="utf-8")
        print(f"kitsep {item['id']}: {seconds:.1f}s", flush=True)
    return 0


def window_rms(mono: Mono, t: float, start: float, stop: float) -> float:
    a, b = max(0, int((t + start) * p2d.RATE)), max(0, int((t + stop) * p2d.RATE))
    part = mono[a:b]
    return float(np.sqrt(np.mean(np.square(part, dtype=np.float64)))) if len(part) else 0.0


def tom_pitch(mono: Mono, t: float) -> float:
    """Strongest frequency in 50-500 Hz over the 100 ms after the onset (Hz)."""
    a = int(t * p2d.RATE)
    part = mono[a : a + int(0.1 * p2d.RATE)]
    if len(part) < 256:
        return float("nan")
    spectrum = np.abs(np.fft.rfft(part * np.hanning(len(part)), n=16384))
    freqs = np.fft.rfftfreq(16384, 1 / p2d.RATE)
    band = (freqs >= 50) & (freqs <= 500)
    return float(freqs[band][int(np.argmax(spectrum[band]))])


def tom_lines(pitches: list[float]) -> list[int]:
    """Tom hits grouped by pitch (a gap of 3+ semitones starts a group, at most 3 groups; low to
    high: one group 47, two 43 and 50, three 43, 47 and 50)."""
    semis = [12 * float(np.log2(p / 55.0)) if p == p and p > 0 else float("nan") for p in pitches]
    valid = sorted({round(v, 1) for v in semis if v == v})
    groups: list[list[float]] = []
    for v in valid:
        if groups and v - groups[-1][-1] < 3.0:
            groups[-1].append(v)
        else:
            groups.append([v])
    while len(groups) > 3:
        gaps = [groups[i + 1][0] - groups[i][-1] for i in range(len(groups) - 1)]
        i = int(np.argmin(gaps))
        groups[i : i + 2] = [groups[i] + groups[i + 1]]
    lines = {1: [drum_kit.TOM_MID], 2: [drum_kit.TOM_FLOOR, drum_kit.TOM_HIGH]}.get(
        len(groups), [drum_kit.TOM_FLOOR, drum_kit.TOM_MID, drum_kit.TOM_HIGH]
    )
    out: list[int] = []
    for v in semis:
        if v != v or not groups:
            out.append(drum_kit.TOM_MID)
            continue
        g = min(range(len(groups)), key=lambda i: min(abs(v - x) for x in groups[i]))
        out.append(lines[g])
    return out


def item_downbeats(item: dict[str, Any]) -> list[float]:
    beats = json.loads((Path(item["dir"]) / "beats.json").read_text(encoding="utf-8"))
    return [float(b["t"]) for b in beats["beats"] if b["is_downbeat"]]


def default_kit(item: dict[str, Any], hits: list[tuple[float, int]]) -> list[dict[str, Any]]:
    pairs: list[tuple[float, drum_kit.Class5]] = [
        (t, c) for t, g in sorted(hits) if (c := drum_kit.class_of(g)) is not None
    ]
    choices = drum_kit.default_choices(pairs, item_downbeats(item), 1.0)
    return [
        {"onset_s": t, "gm_note": d.gm_note, "class5": c}
        for (t, c), d in zip(pairs, choices, strict=True)
    ]


def kit_choices(
    item: dict[str, Any], hits: list[tuple[float, int]], open_ratio: float, crash_margin: float
) -> list[dict[str, Any]]:
    """Kit pieces from DrumSep's stems: crash vs ride by the louder cymbal stem over the first
    80 ms (the default when neither leads by `crash_margin` dB), hi-hat open when its 100-250 ms
    level is above `open_ratio` of its first 50 ms, toms by pitch group."""
    stems = {
        k: read_stereo(kit_dir(item) / f"{k}.wav").mean(axis=1)
        for k in ("hh", "ride", "crash", "toms")
    }
    est = default_kit(item, hits)
    toms = [h for h in est if h["class5"] == "toms"]
    for h, gm in zip(
        toms, tom_lines([tom_pitch(stems["toms"], h["onset_s"]) for h in toms]), strict=True
    ):
        h["gm_note"] = gm
    for h in est:
        t = h["onset_s"]
        if h["class5"] == "cymbals":
            crash = window_rms(stems["crash"], t, 0.0, 0.08)
            ride = window_rms(stems["ride"], t, 0.0, 0.08)
            lead = 20 * float(np.log10(max(crash, 1e-9) / max(ride, 1e-9)))
            if abs(lead) >= crash_margin:
                h["gm_note"] = drum_kit.CRASH if lead > 0 else drum_kit.RIDE
        elif h["class5"] == "hihat":
            early = window_rms(stems["hh"], t, 0.0, 0.05)
            late = window_rms(stems["hh"], t, 0.10, 0.25)
            opened = late > open_ratio * max(early, 1e-9)
            h["gm_note"] = drum_kit.HIHAT_OPEN if opened else drum_kit.HIHAT_CLOSED
    return est


def cmd_kit(args: argparse.Namespace) -> int:
    """Kit-piece accuracy of the 5-class defaults vs DrumSep choices (fit, then held-out)."""
    params = shipped_params()
    gain = shipped_gain(params)
    items = [
        i
        for i in scored_items("stem", gain, list(p2d.TIERS))
        if i["kit_pieces"] and (kit_dir(i) / "crash.wav").is_file()
    ]
    hits = {i["id"]: offline_hits(np.load(acts_path(i, "stem", gain)), params) for i in items}

    def score(rule: str, split: str, open_ratio: float, margin: float) -> dict[str, list[int]]:
        total: dict[str, list[int]] = {k: [0, 0] for k in ("hihat", "cymbals", "toms")}
        for item in items:
            if item["split"] != split:
                continue
            found = hits[item["id"]]
            est = (
                default_kit(item, found)
                if rule == "defaults"
                else kit_choices(item, found, open_ratio, margin)
            )
            ref = p2d.read_ref(Path(item["dir"]) / "ref.csv")
            for kind, (ok, n) in p2d.kit_piece_scores(ref, est).items():
                total[kind][0] += ok
                total[kind][1] += n
        return total

    def share(v: list[int]) -> str:
        return f"{v[0] / v[1]:.3f} ({v[1]})" if v[1] else "—"

    best = (-1.0, 0.3, 0.0)
    for open_ratio in (0.1, 0.15, 0.2, 0.3, 0.4, 0.5):
        for margin in (0.0, 3.0, 6.0):
            fit = score("drumsep", "fit", open_ratio, margin)
            ok, n = sum(v[0] for v in fit.values()), sum(v[1] for v in fit.values())
            print(f"open_ratio {open_ratio} margin {margin}: fit {ok / max(n, 1):.3f}", flush=True)
            if n and ok / n > best[0]:
                best = (ok / n, open_ratio, margin)
    out = [
        "## Kit pieces: 5-class defaults vs DrumSep (share correct among class-matched hits)",
        "",
        f"DrumSep params chosen on fit: open_ratio {best[1]}, crash margin {best[2]} dB.",
        "",
        "| rule | split | hi-hat open/closed | crash/ride | tom line |",
        "|---|---|---|---|---|",
    ]
    for rule in ("defaults", "drumsep"):
        for split in ("fit", "test"):
            s = score(rule, split, best[1], best[2])
            out.append(
                f"| {rule} | {split} | "
                + " | ".join(share(s[k]) for k in ("hihat", "cymbals", "toms"))
                + " |"
            )
    text = "\n".join(out) + "\n"
    print(text, flush=True)
    (p2d.ROOT / "kit-drumsep.md").write_text(text, encoding="utf-8")
    return 0


def auroc(values: list[float], labels: list[int]) -> float:
    """Probability that a correct hit scores above a wrong one (ties count half)."""
    x = np.asarray(values, dtype=np.float64)
    y = np.asarray(labels, dtype=bool)
    pos, neg = int(y.sum()), int((~y).sum())
    if not pos or not neg:
        return float("nan")
    order = np.argsort(x, kind="stable")
    ranks = np.empty(len(x))
    ranks[order] = np.arange(1, len(x) + 1)
    for v in np.unique(x):
        tie = x == v
        ranks[tie] = ranks[tie].mean()
    return float((ranks[y].sum() - pos * (pos + 1) / 2) / (pos * neg))


def scored_hits(
    item: dict[str, Any], act: NDArray[np.float32], params: dict[str, Any]
) -> list[tuple[str, float, float, int]]:
    """(class, peak height, margin over the class threshold scaled to [0, 1], correct at ±50 ms)
    per ADTOF hit of an item's scored classes."""
    ref = p2d.by_class(p2d.read_ref(Path(item["dir"]) / "ref.csv"), p2d.classes_for(item))
    out: list[tuple[str, float, float, int]] = []
    for c, threshold in enumerate(params["thresholds"]):
        cls = drum_kit.class_of(adtof.LABELS[c])
        if cls is None or cls not in ref:
            continue
        frames = adtof.peaks(act[:, c], float(threshold), params)
        times = np.array([f / adtof.FPS for f in frames])
        hit = {j for _, j in p2d.match(ref[cls], times, 0.05)}
        for j, f in enumerate(frames):
            height = float(act[f, c])
            margin = (height - float(threshold)) / (1.0 - float(threshold))
            out.append((cls, height, margin, int(j in hit)))
    return out


def cmd_confidence(args: argparse.Namespace) -> int:
    """How well each per-hit score separates correct from wrong hits (AUROC), and what an
    isotonic table fitted on the fit split does on held-out hits (ECE, bands)."""
    from splitune_eval.calibration import fit_isotonic, reliability
    from splitune_ml_core import calibration, contracts

    params = shipped_params()
    gain = shipped_gain(params)
    data: dict[str, list[tuple[str, float, float, int]]] = {"fit": [], "test": []}
    for item in scored_items(args.source, gain, list(p2d.TIERS)):
        act = np.load(acts_path(item, args.source, gain))
        data[item["split"]] += scored_hits(item, act, params)
    thresholds = " ".join(f"{t:.2f}" for t in params["thresholds"])
    out = [
        f"## Per-hit confidence ({args.source} / {gain}, shipped thresholds {thresholds})",
        "",
        f"Hits: fit {len(data['fit'])} (precision {np.mean([h[3] for h in data['fit']]):.3f}), "
        f"held-out {len(data['test'])} (precision {np.mean([h[3] for h in data['test']]):.3f}).",
        "",
        "| score | AUROC fit | AUROC held-out | ECE raw | ECE isotonic | "
        "high: share / precision | medium | low |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for name, height in (("peak height", True), ("margin over threshold", False)):
        fx = [h[1] if height else h[2] for h in data["fit"]]
        fy = [h[3] for h in data["fit"]]
        tx = [h[1] if height else h[2] for h in data["test"]]
        ty = [h[3] for h in data["test"]]
        table = contracts.CalibrationTable(
            model_id="p2d",
            version="p2d",
            method="isotonic",
            knots=fit_isotonic(fx, fy),
            bands=contracts.Bands(high=0.7, medium=0.4),
            fitted_on="p2d",
        )
        calibrated = [calibration.calibrate(x, table) for x in tx]
        bands: list[str] = []
        for lo, hi in ((0.7, 1.01), (0.4, 0.7), (-1.0, 0.4)):
            ys = [y for c, y in zip(calibrated, ty, strict=True) if lo <= c < hi]
            bands.append(
                f"{len(ys) / len(ty):.2f} / {p2d.fmt(float(np.mean(ys)) if ys else float('nan'))}"
            )
        out.append(
            f"| {name} | {p2d.fmt(auroc(fx, fy))} | {p2d.fmt(auroc(tx, ty))} | "
            f"{reliability(tx, ty).ece:.3f} | {reliability(calibrated, ty).ece:.3f} | "
            + " | ".join(bands)
            + " |"
        )
    out += ["", "AUROC held-out per class (margin over threshold):", ""]
    for cls in drum_kit.CLASSES:
        sel = [h for h in data["test"] if h[0] == cls]
        precision = float(np.mean([h[3] for h in sel])) if sel else float("nan")
        out.append(
            f"- {cls}: {p2d.fmt(auroc([h[2] for h in sel], [h[3] for h in sel]))} "
            f"({len(sel)} hits, precision {p2d.fmt(precision)})"
        )
    text = "\n".join(out) + "\n"
    print(text, flush=True)
    (p2d.ROOT / f"confidence-{args.source}.md").write_text(text, encoding="utf-8")
    return 0


def run_labels(chain: str, split: str) -> tuple[list[float], list[int]]:
    """(confidence_raw, correct at ±50 ms) of every scored hit of a chain's `chosen` runs."""
    xs: list[float] = []
    ys: list[int] = []
    for item in p2d.built(p2d.load_items()):
        path = p2d.run_path(chain, "chosen", item)
        if item["split"] != split or not path.is_file():
            continue
        ref = p2d.by_class(p2d.read_ref(Path(item["dir"]) / "ref.csv"), p2d.classes_for(item))
        hits = json.loads(path.read_text(encoding="utf-8"))["hits"]
        for cls, times in ref.items():
            mine = sorted((h for h in hits if h["class5"] == cls), key=lambda h: h["onset_s"])
            est = np.array([float(h["onset_s"]) for h in mine])
            hit = {j for _, j in p2d.match(times, est, 0.05)}
            xs += [float(h["confidence_raw"]) for h in mine]
            ys += [int(j in hit) for j in range(len(mine))]
    return xs, ys


def cmd_calibrate(args: argparse.Namespace) -> int:
    """Isotonic table for ADTOF drums fitted on a chain's fit-split hits, checked on held-out
    hits → config/calibration/<record>@<version>.drums.json."""
    from splitune_eval.calibration import fit_isotonic, reliability
    from splitune_ml_core import calibration, contracts, register

    fx, fy = run_labels(args.chain, "fit")
    tx, ty = run_labels(args.chain, "test")
    record = register.model(adtof.RECORD)
    table = contracts.CalibrationTable(
        model_id=record.id,
        version=record.version,
        method="isotonic",
        knots=fit_isotonic(fx, fy),
        bands=contracts.Bands(high=0.7, medium=0.4),
        fitted_on=f"p2d-{args.chain}-chosen-fit",
    )
    path = calibration.CALIBRATION_DIR / f"{record.id}@{record.version}.drums.json"
    path.write_text(contracts.dump_json(table) + "\n", encoding="utf-8")
    raw = reliability(tx, ty)
    cal = reliability([calibration.calibrate(x, table) for x in tx], ty)
    text = (
        f"## ADTOF / drums ({args.chain}, chosen)\n\n"
        f"fit on {len(fx)} hits, tested on {len(tx)} held-out hits (precision "
        f"{np.mean(ty):.3f}); table `config/calibration/{path.name}`, {len(table.knots)} knots\n\n"
        f"ECE raw **{raw.ece:.3f}** → calibrated **{cal.ece:.3f}** (10 equal-width bins), "
        f"AUROC held-out {auroc(tx, ty):.3f}\n\n" + cal.table(raw)
    )
    (p2d.ROOT / "calibration-adtof.md").write_text(text, encoding="utf-8")
    print(text, flush=True)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n", 1)[0])
    sub = parser.add_subparsers(required=True)
    p = sub.add_parser("acts")
    p.add_argument("--tier", nargs="+", choices=p2d.TIERS, default=list(p2d.TIERS))
    p.set_defaults(fn=cmd_acts)
    p = sub.add_parser("sweep")
    p.add_argument("--tier", nargs="+", choices=p2d.TIERS, default=list(p2d.TIERS))
    p.add_argument("--source", nargs="+", choices=SOURCES, default=["stem"])
    p.add_argument("--tune", action="store_true", help="also tune thresholds on the fit split")
    p.add_argument("--name", default="gain")
    p.set_defaults(fn=cmd_sweep)
    p = sub.add_parser("cv")
    p.add_argument("--source", choices=SOURCES, default="stem")
    p.set_defaults(fn=cmd_cv)
    p = sub.add_parser("kitsep")
    p.add_argument("--tier", nargs="+", choices=p2d.TIERS, default=list(p2d.TIERS))
    p.set_defaults(fn=cmd_kitsep)
    p = sub.add_parser("kit")
    p.set_defaults(fn=cmd_kit)
    p = sub.add_parser("confidence")
    p.add_argument("--source", choices=SOURCES, default="stem")
    p.set_defaults(fn=cmd_confidence)
    p = sub.add_parser("calibrate")
    p.add_argument("--chain", default="shipped")
    p.set_defaults(fn=cmd_calibrate)
    p = sub.add_parser("ensemble")
    p.add_argument("--other", default="yourmt3")
    p.add_argument("--source", choices=SOURCES, default="stem")
    p.set_defaults(fn=cmd_ensemble)
    args = parser.parse_args()
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
