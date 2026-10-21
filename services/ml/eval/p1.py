"""Prototype 1: separation candidates on MUSDB18-HQ windows (08 §3 P1, personal-mode callout).

    uv run python eval/p1.py codec                       # mixture.aac128.wav per window
    uv run python eval/p1.py separate --model bs_roformer_sw [--clip ID ...]
    uv run python eval/p1.py separate --model htdemucs_ft --set --tag shifts1 --inference shifts=1
    uv run python eval/p1.py energies --model bs_roformer_sw   # stem/mixture energy per window
    uv run python eval/p1.py select                      # 20 clips → eval/sets/musdb18hq-p1.yaml
    uv run python eval/p1.py export --session p1-2026-10-21   # blinded listening session
    uv run python eval/p1.py sdr [--tag shifts1]          # uSDR where MUSDB has references
    uv run python eval/p1.py report --session p1-2026-10-21   # ratings (Postgres) → results/p1

Windows come from `eval/p1_musdb.py` (default root ~/datasets/musdb18hq-p1). Candidates run on the
"YouTube-style" AAC 128 kb/s round-trip of each mixture, without loudness normalisation so the
reference stems keep their scale for SDR. Separation uses the shipped wrapper
(`stage_separation.models`), and the listening items are encoded by the shipped stem encoder, so
the raters hear what `separate` + `stem_post` would produce. A `--tag` keeps a sweep point's runs
(model-map inference settings overridden with `--inference`) apart from the default `runs/`.
"""

from __future__ import annotations

import argparse
import csv
import io
import itertools
import json
import secrets
import shlex
import statistics
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
import yaml
from splitune_eval import scoring
from splitune_eval.codec import simulate
from splitune_eval.registry import SETS_DIR, load_set

ROOT = Path("~/datasets/musdb18hq-p1").expanduser()
CODEC_MIX = "mixture.aac128.wav"
SET_ID = "musdb18hq-p1"
RESULTS = Path(__file__).resolve().parent / "results" / "p1"
QUESTION = "Could I practise with this?"
LISTENING_LUFS = -16.0  # every item played at the same loudness, so louder never sounds better

# Candidates per learner instrument (only six-stem models output guitar and piano).
CANDIDATES: dict[str, list[str]] = {
    "guitar": ["bs_roformer_sw", "htdemucs_6s"],
    "piano": ["bs_roformer_sw", "htdemucs_6s"],
    "bass": ["bs_roformer_sw", "htdemucs_ft", "htdemucs_6s"],
    "drums": ["bs_roformer_sw", "htdemucs_ft", "htdemucs_6s"],
    "vocals": [
        "mel_roformer_kim_vocals",
        "bs_roformer_viperx_1297",
        "bs_roformer_sw",
        "htdemucs_ft",
    ],
}
# How many clips each instrument gets, picked in this order (scarcest material first).
QUOTA = {"piano": 4, "guitar": 8, "vocals": 3, "bass": 3, "drums": 2}
REFERENCED = ("vocals", "drums", "bass")  # MUSDB stems that are one instrument
PAIRS_PER_CLIP = 3
SILENT_DB = -120.0  # a stem audio-separator skipped as near-silent


def windows(root: Path) -> dict[str, dict[str, Any]]:
    index = json.loads((root / "windows.json").read_text(encoding="utf-8"))
    return cast(dict[str, dict[str, Any]], index["items"])


def read(path: Path) -> np.ndarray:
    data, _ = sf.read(str(path), dtype="float32", always_2d=True)
    return np.asarray(data, dtype=np.float32)


def outputs_of(model: str) -> dict[str, str | None]:
    from stage_separation import config

    return dict(config.load().models[model].outputs)


def runs_dir(root: Path, tag: str | None) -> Path:
    return root / "runs" if tag is None else root / f"runs-{tag}"


def stem_file(runs: Path, model: str, clip: str, instrument: str) -> Path:
    name = next(k for k, v in outputs_of(model).items() if v == instrument)
    return runs / model / clip / f"{name}.wav"


def load_stem(runs: Path, model: str, clip: str, name: str, frames: int) -> np.ndarray:
    """A run's output; audio-separator skips writing a near-silent stem, which reads as zeros."""
    path = runs / model / clip / f"{name}.wav"
    return read(path)[:frames] if path.is_file() else np.zeros((frames, 2), dtype=np.float32)


def db_ratio(part: np.ndarray, whole: np.ndarray) -> float:
    num = float((part.astype(np.float64) ** 2).sum())
    den = float((whole.astype(np.float64) ** 2).sum()) + 1e-12
    return round(10 * float(np.log10(num / den + 1e-12)), 1)


def cmd_codec(args: argparse.Namespace) -> int:
    root = Path(args.root).expanduser()
    for clip in sorted(windows(root)):
        dest = root / clip / CODEC_MIX
        if not dest.is_file():
            simulate(root / clip / "mixture.wav", dest, "aac", "128k", target_lufs=None)
    return 0


def cmd_separate(args: argparse.Namespace) -> int:
    from stage_separation import config, models  # torch + audio-separator: only here

    if args.inference and not args.tag:
        sys.exit("--inference needs --tag (the default runs/ follow the model map)")
    root = Path(args.root).expanduser()
    spec = config.load().models[args.model]
    if args.inference:
        override = {k: yaml.safe_load(v) for k, v in (i.split("=", 1) for i in args.inference)}
        spec = config.ModelSpec.model_validate(
            {**spec.model_dump(), "inference": {**spec.inference, **override}}
        )
    out = runs_dir(root, args.tag) / args.model
    timing_path = out / "timing.json"
    timing: dict[str, Any] = (
        json.loads(timing_path.read_text(encoding="utf-8")) if timing_path.is_file() else {}
    )
    clips = args.clip or ([i.id for i in load_set(SET_ID).items] if args.set else windows(root))
    for clip in sorted(clips):
        if clip in timing:
            continue
        result = models.separate(args.model, spec, root / clip / CODEC_MIX, out / clip)
        timing[clip] = {"seconds": round(result.seconds, 3), "peak_mb": round(result.peak_mb)}
        out.mkdir(parents=True, exist_ok=True)
        timing_path.write_text(json.dumps(timing, indent=2) + "\n", encoding="utf-8")
        print(f"{args.model} {clip}: {result.seconds:.1f}s, {result.peak_mb:.0f} MB", flush=True)
    print(f"{args.model} inference {spec.inference or 'library defaults'} → {out}")
    return 0


def cmd_energies(args: argparse.Namespace) -> int:
    """dB of each separated stem relative to the mixture (selection aid for guitar/piano clips,
    which MUSDB has no references for)."""
    root = Path(args.root).expanduser()
    runs = root / "runs" / args.model
    table: dict[str, dict[str, float]] = {}
    for clip in sorted(windows(root)):
        if not (runs / clip).is_dir():
            continue
        mix = read(root / clip / CODEC_MIX)
        table[clip] = {s.stem: db_ratio(read(s), mix) for s in sorted((runs / clip).glob("*.wav"))}
    (runs / "energies.json").write_text(json.dumps(table, indent=2) + "\n", encoding="utf-8")
    for clip, row in table.items():
        print(f"{clip[:40]:40} " + " ".join(f"{k}={v:6.1f}" for k, v in row.items()))
    return 0


def tagger_scores(root: Path, clip: str) -> dict[str, float]:
    from scipy.signal import resample_poly  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]
    from stage_tagger import stage

    mono = read(root / clip / CODEC_MIX).mean(axis=1)
    resampled = np.asarray(resample_poly(mono, stage.MODEL_RATE, 44100), dtype=np.float32)
    batch = stage.windows(resampled, 10, 2)
    return {
        str(i["instrument"]): float(i["present_prob"])
        for i in stage.summarise(stage.infer(batch), 0.25)
    }


def cmd_select(args: argparse.Namespace) -> int:
    """Picks QUOTA clips per instrument, each song once: the window where BS-Roformer-SW's stem of
    that instrument carries the most energy (MUSDB has no guitar/piano references), among windows
    where the tagger hears the instrument at all."""
    root = Path(args.root).expanduser()
    energies = cast(
        dict[str, dict[str, float]],
        json.loads((root / "runs" / "bs_roformer_sw" / "energies.json").read_text()),
    )
    index = windows(root)
    tags = {clip: tagger_scores(root, clip) for clip in sorted(energies)}
    floor = {"piano": 0.005, "guitar": 0.1, "vocals": 0.05, "bass": 0.0, "drums": 0.0}
    chosen: dict[str, str] = {}
    for instrument, count in QUOTA.items():
        ranked = sorted(
            (c for c in energies if c not in chosen and tags[c][instrument] >= floor[instrument]),
            key=lambda c: energies[c].get(instrument, SILENT_DB),
            reverse=True,
        )
        for clip in ranked[:count]:
            chosen[clip] = instrument
    items = [
        {
            "id": clip,
            "audio": f"{clip}/{CODEC_MIX}",
            "annotations": {"sep": clip},
            "tags": {
                "target": target,
                "track": index[clip]["track"],
                "start_s": str(index[clip]["start_s"]),
                "sw_db": str(energies[clip].get(target, SILENT_DB)),
                "tagger": f"{tags[clip][target]:.3f}",
            },
        }
        for clip, target in chosen.items()
    ]
    document = {
        "id": SET_ID,
        "description": "Prototype 1: 20 x 30 s MUSDB18-HQ test windows (AAC 128 kb/s), one target "
        "instrument each",
        "licence": "MUSDB18-HQ research use (tracks under their own licences)",
        "provenance": "Zenodo record 3338373, test split; windows cut by eval/p1_musdb.py at 30% "
        "of each track; chosen by eval/p1.py select (most BS-Roformer-SW stem energy of the "
        "target among windows where PANNs hears it; quota piano 4, guitar 8, vocals 3, bass 3, "
        "drums 2; each song once)",
        "root": str(root).replace(str(Path.home()), "~"),
        "split": "test",
        "tasks": ["sep"],
        "tags": {"genre": "mixed", "live": "studio", "codec": "aac128"},
        "items": items,
    }
    path = SETS_DIR / f"{SET_ID}.yaml"
    path.write_text(yaml.safe_dump(document, sort_keys=False, width=100), encoding="utf-8")
    for clip, target in chosen.items():
        print(f"{target:7} {clip}")
    print(f"→ {path}")
    return 0


def normalise(audio: np.ndarray) -> np.ndarray:
    import pyloudnorm  # pyright: ignore[reportMissingTypeStubs]

    meter = pyloudnorm.Meter(44100)  # pyright: ignore[reportUnknownMemberType]
    loudness = float(meter.integrated_loudness(audio.astype(np.float64)))  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]
    if not np.isfinite(loudness):
        return audio
    out = audio * 10 ** ((LISTENING_LUFS - loudness) / 20)
    peak = float(np.abs(out).max())
    return out / peak * 0.99 if peak > 0.99 else out


def encode_item(audio: np.ndarray, media: Path, name: str) -> str:
    from stage_separation import encode

    wav = media / f"{name}.wav"
    sf.write(str(wav), normalise(audio).astype(np.float32), 44100, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    encode.encode_aac(wav, media / f"{name}.m4a")
    wav.unlink()
    return f"{name}.m4a"


def token() -> str:
    return secrets.token_hex(8)


def cmd_export(args: argparse.Namespace) -> int:
    """Per clip: each candidate's isolated stem and mixture-minus-stem, the head candidate's
    complement mix-minus, isolated A/B pairs (all pairs, or a rotating three when there are
    more) and subtract-vs-complement for the head candidate."""
    root = Path(args.root).expanduser()
    runs = runs_dir(root, None)
    session = root / "listening" / args.session
    media = session / "media"
    media.mkdir(parents=True, exist_ok=True)
    clips: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []
    pairs: list[dict[str, Any]] = []
    for n, item in enumerate(load_set(SET_ID).items):
        clip, target = item.id, item.tags["target"]
        mixture = read(root / clip / CODEC_MIX)
        frames = len(mixture)
        clips.append(
            {
                "clip": clip,
                "target": target,
                "mixture": {
                    "token": token(),
                    "file": encode_item(mixture, media, f"{clip}.mixture"),
                },
            }
        )
        isolated: dict[str, str] = {}
        subtract: dict[str, str] = {}
        for model in CANDIDATES[target]:
            stem = load_stem(runs, model, clip, stem_file(runs, model, clip, target).stem, frames)
            for kind, system, audio, bucket in (
                ("isolated", model, stem, isolated),
                ("mix_minus", f"{model}:subtract", mixture - stem, subtract),
            ):
                name = f"{clip}.{system.replace(':', '.')}.{kind}"
                bucket[model] = token()
                items.append(
                    {
                        "item": bucket[model],
                        "clip": clip,
                        "kind": kind,
                        "system": system,
                        "file": encode_item(audio, media, name),
                    }
                )
        head = CANDIDATES[target][0]
        others = [k for k, v in outputs_of(head).items() if v != target]
        complement = np.sum([load_stem(runs, head, clip, o, frames) for o in others], axis=0)
        complement_item = token()
        items.append(
            {
                "item": complement_item,
                "clip": clip,
                "kind": "mix_minus",
                "system": f"{head}:complement",
                "file": encode_item(complement, media, f"{clip}.{head}.complement.mix_minus"),
            }
        )
        all_pairs = list(itertools.combinations(CANDIDATES[target], 2))
        if len(all_pairs) > PAIRS_PER_CLIP:
            start = n * PAIRS_PER_CLIP
            all_pairs = [all_pairs[(start + j) % len(all_pairs)] for j in range(PAIRS_PER_CLIP)]
        for a, b in all_pairs:
            pairs.append({"pair": token(), "clip": clip, "a": isolated[a], "b": isolated[b]})
        pairs.append({"pair": token(), "clip": clip, "a": subtract[head], "b": complement_item})
        print(f"{clip}: {len(CANDIDATES[target])} candidates", flush=True)
    manifest = {
        "id": args.session,
        "question": QUESTION,
        "clips": clips,
        "items": items,
        "pairs": pairs,
    }
    (session / "session.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"{len(items)} ratings + {len(pairs)} pairs → {session}")
    return 0


def sdr_rows(root: Path, tag: str | None = None) -> list[dict[str, Any]]:
    runs = runs_dir(root, tag)
    rows: list[dict[str, Any]] = []
    for item in load_set(SET_ID).items:
        clip = item.id
        refs = {i: read(root / clip / f"{i}.wav").astype(np.float64) for i in REFERENCED}
        for model in sorted({m for c in CANDIDATES.values() for m in c}):
            if not (runs / model / clip).is_dir():
                continue
            for instrument in REFERENCED:
                if instrument not in outputs_of(model).values():
                    continue
                est = load_stem(
                    runs,
                    model,
                    clip,
                    stem_file(runs, model, clip, instrument).stem,
                    len(refs[instrument]),
                ).astype(np.float64)
                rows.append(
                    {
                        "clip": clip,
                        "model": model,
                        "instrument": instrument,
                        "usdr": round(scoring.usdr(refs[instrument], est), 2),
                    }
                )
    return rows


def seconds_per_clip(runs: Path, model: str) -> float:
    """Median separation time of the set's clips (`separate` timing.json)."""
    timing = json.loads((runs / model / "timing.json").read_text(encoding="utf-8"))
    clips = {i.id for i in load_set(SET_ID).items}
    return statistics.median(t["seconds"] for c, t in timing.items() if c in clips)


def cmd_sdr(args: argparse.Namespace) -> int:
    root = Path(args.root).expanduser()
    rows = sdr_rows(root, args.tag)
    out = RESULTS / ("sdr.csv" if args.tag is None else f"sdr-{args.tag}.csv")
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["clip", "model", "instrument", "usdr"])
        writer.writeheader()
        writer.writerows(rows)
    for (model, instrument), group in itertools.groupby(
        sorted(rows, key=lambda r: (r["model"], r["instrument"])),
        key=lambda r: (r["model"], r["instrument"]),
    ):
        values = [r["usdr"] for r in group]
        print(
            f"{model:26} {instrument:7} median {statistics.median(values):6.2f} dB "
            f"(n={len(values)}), {seconds_per_clip(runs_dir(root, args.tag), model):.1f} s/clip"
        )
    return 0


def owner_url() -> str:
    from dotenv import dotenv_values
    from splitune_ml_core.settings import find_env_files

    for path in find_env_files():
        url = dotenv_values(path).get("DATABASE_URL")
        if url:
            return url
    sys.exit("DATABASE_URL (table owner) not found in .env")


def fetch_answers(
    session: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    from splitune_ml_core.db import connect

    with connect(owner_url()) as conn:
        ratings = conn.execute(
            "select rater_id::text, item, score from listening.ratings where session_id = %s",
            [session],
        ).fetchall()
        prefs = conn.execute(
            "select rater_id::text, pair, preferred from listening.preferences "
            "where session_id = %s",
            [session],
        ).fetchall()
        raters = conn.execute(
            "select id::text, name, instrument, experience from listening.raters where id in "
            "(select rater_id from listening.ratings where session_id = %s)",
            [session],
        ).fetchall()
    return [dict(r) for r in ratings], [dict(r) for r in prefs], [dict(r) for r in raters]


def git_sha() -> str:
    out = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True)
    return out.stdout.strip() or "unknown"


def cmd_report(args: argparse.Namespace) -> int:
    root = Path(args.root).expanduser()
    manifest = json.loads((root / "listening" / args.session / "session.json").read_text())
    by_item = {i["item"]: i for i in manifest["items"]}
    target_of = {c["clip"]: c["target"] for c in manifest["clips"]}
    ratings, prefs, raters = fetch_answers(args.session)
    lines: list[str] = []
    csv_rows: list[dict[str, Any]] = []

    # Ratings: per instrument, kind and system.
    scores: dict[tuple[str, str, str], list[int]] = {}
    per_clip: dict[tuple[str, str, str], dict[str, list[int]]] = {}
    for r in ratings:
        item = by_item[r["item"]]
        key = (target_of[item["clip"]], item["kind"], item["system"])
        scores.setdefault(key, []).append(int(r["score"]))
        per_clip.setdefault(key, {}).setdefault(item["clip"], []).append(int(r["score"]))
    lines += [
        '## Ratings: "Could I practise with this?" (1-5)',
        "",
        "| Instrument | Stem | System | n | Median | Mean | Clips with median ≥ 4 |",
        "|---|---|---|---:|---:|---:|---:|",
    ]
    for (instrument, kind, system), values in sorted(scores.items()):
        clips = per_clip[(instrument, kind, system)]
        good = sum(1 for v in clips.values() if statistics.median(v) >= 4)
        share = f"{good}/{len(clips)} ({100 * good / len(clips):.0f}%)"
        lines.append(
            f"| {instrument} | {kind} | {system} | {len(values)} | {statistics.median(values):g} "
            f"| {statistics.mean(values):.2f} | {share} |"
        )
        csv_rows.append(
            {
                "section": "rating",
                "instrument": instrument,
                "kind": kind,
                "system": system,
                "n": len(values),
                "median": statistics.median(values),
                "mean": round(statistics.mean(values), 3),
                "clips_median_ge4": good,
                "clips": len(clips),
            }
        )

    # Pairwise preferences.
    pair_of = {p["pair"]: p for p in manifest["pairs"]}
    wins: dict[tuple[str, str, str], list[int]] = {}  # (instrument, x, y) -> [x wins, y wins, ties]
    for p in prefs:
        pair = pair_of[p["pair"]]
        a, b = by_item[pair["a"]], by_item[pair["b"]]
        x, y = sorted([a["system"], b["system"]])
        key = (target_of[pair["clip"]], x, y)
        tally = wins.setdefault(key, [0, 0, 0])
        preferred = by_item[p["preferred"]]["system"] if p["preferred"] else None
        tally[0 if preferred == x else 1 if preferred == y else 2] += 1
    lines += [
        "",
        "## Pairwise preference (blind A/B, sides shuffled per rater)",
        "",
        "| Instrument | System X | System Y | X preferred | Y preferred | No preference |",
        "|---|---|---|---:|---:|---:|",
    ]
    for (instrument, x, y), (wx, wy, tie) in sorted(wins.items()):
        lines.append(f"| {instrument} | {x} | {y} | {wx} | {wy} | {tie} |")
        csv_rows.append(
            {
                "section": "pair",
                "instrument": instrument,
                "kind": f"{x} vs {y}",
                "system": x,
                "n": wx + wy + tie,
                "median": wx,
                "mean": wy,
                "clips_median_ge4": tie,
                "clips": "",
            }
        )

    # SDR (secondary).
    sdr = sdr_rows(root)
    lines += [
        "",
        "## uSDR on the same clips (secondary; MUSDB references exist for vocals, drums, bass)",
        "",
        "| System | Instrument | Median uSDR (dB) | n |",
        "|---|---|---:|---:|",
    ]
    for (model, instrument), group in itertools.groupby(
        sorted(sdr, key=lambda r: (r["model"], r["instrument"])),
        key=lambda r: (r["model"], r["instrument"]),
    ):
        values = [r["usdr"] for r in group]
        lines.append(
            f"| {model} | {instrument} | {statistics.median(values):.2f} | {len(values)} |"
        )

    header = [
        f"# Prototype 1: separation listening test ({datetime.now(UTC).date().isoformat()})",
        "",
        f"- Session `{args.session}`; git `{git_sha()}`; set `{SET_ID}` "
        f"({len(manifest['clips'])} clips, AAC 128 kb/s input); items loudness-matched to "
        f"{LISTENING_LUFS:g} LUFS and encoded with the shipped stem encoder.",
        f"- Raters: {len(raters)} ("
        + ", ".join(f"{r['name']} — {r['instrument']}, {r['experience']}" for r in raters)
        + f"); {len(ratings)} ratings, {len(prefs)} preferences.",
        f"- Command: `uv run python eval/p1.py {shlex.join(sys.argv[1:])}`",
        "",
    ]
    text = "\n".join(header + lines) + "\n"
    RESULTS.mkdir(parents=True, exist_ok=True)
    out = (
        Path(args.out) if args.out else RESULTS / f"{datetime.now(UTC).date().isoformat()}.data.md"
    )
    out.write_text(text, encoding="utf-8")
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(csv_rows[0]) if csv_rows else ["section"])
    writer.writeheader()
    writer.writerows(csv_rows)
    out.with_suffix(".csv").write_text(buffer.getvalue(), encoding="utf-8")
    print(text)
    print(f"→ {out}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--root", default=str(ROOT))
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("codec", help="AAC 128 kb/s round-trip of every window").set_defaults(
        fn=cmd_codec
    )
    s = sub.add_parser("separate", help="run one candidate on the codec mixtures")
    s.add_argument("--model", required=True)
    s.add_argument("--clip", action="append")
    s.add_argument("--set", action="store_true", help=f"only the clips of {SET_ID}")
    s.add_argument("--tag", help="write to runs-<tag>/ instead of runs/")
    s.add_argument(
        "--inference", action="append", metavar="KEY=VALUE", help="override (needs --tag)"
    )
    s.set_defaults(fn=cmd_separate)
    e = sub.add_parser("energies", help="separated stem energy per window")
    e.add_argument("--model", required=True)
    e.set_defaults(fn=cmd_energies)
    sub.add_parser("select", help=f"choose the clips → eval/sets/{SET_ID}.yaml").set_defaults(
        fn=cmd_select
    )
    x = sub.add_parser("export", help="write a blinded listening session")
    x.add_argument("--session", required=True)
    x.set_defaults(fn=cmd_export)
    d = sub.add_parser("sdr", help="uSDR against MUSDB references")
    d.add_argument("--tag", help="score runs-<tag>/ instead of runs/")
    d.set_defaults(fn=cmd_sdr)
    r = sub.add_parser("report", help="ratings from Postgres → report tables")
    r.add_argument("--session", required=True)
    r.add_argument("--out")
    r.set_defaults(fn=cmd_report)
    args = p.parse_args(argv)
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
