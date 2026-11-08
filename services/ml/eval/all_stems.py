"""All stems (step s40a): what keeping every separated stem costs and gives, through the shipped
stages, and the G3 listening session.

    uv run --no-sync python eval/all_stems.py run --tag 2026-11-08 [--before OLD.yaml] [--item ID]
    uv run --no-sync python eval/all_stems.py export --tag 2026-11-08 --session all-stems-2026-11-08

`run` takes each item (a MUSDB18-HQ P1 window, or the whole song, under --root; ITEMS) through
the shipped decode -> tag -> separate -> stem_post in-process (`LocalRun`), under the model map in
force (ML_SEPARATION_CONFIG or the shipped one), and keeps separation.json, stems.json,
presence.json and the browser stems (stems/*.m4a) under <root>/all-stems/<tag>/<item>/. With
`--before`, separate and stem_post run again under an older map (for s40a the map at
impl/redesign, `keep: [drums, bass]`): the report then compares the stems, their encoded bytes
and stem_post's time, and checks that the learner's raw stem is byte-identical (the target can't
move). The report goes to eval/results/all-stems/<tag>.md; audio never goes into git.

`export` writes a new apps/listening session from a run: per item, one clip per stem the app can
name (guitar, bass, piano, drums, vocals) with that stem to rate, plus the learner's mix-minus in
the learner's clip; "other" stems (no listening target) are copied to other/ beside it. The items
are the shipped AAC files, unchanged and at their own level. A session is never overwritten.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import secrets
import shutil
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from splitune_eval.local import Decoded, LocalRun
from splitune_ml_core import contracts

ROOT = Path("~/datasets/musdb18hq-p1").expanduser()
RESULTS = Path(__file__).resolve().parent / "results" / "all-stems"
# id -> (learner instrument, mixture under --root): one 30 s window per learner instrument
# (musdb18hq-p1-v2 picks) and the whole 4:04 song of the bass window, for per-song numbers.
ITEMS: dict[str, tuple[str, str]] = {
    "hollow-ground-ill-fate": ("guitar", "hollow-ground-ill-fate/mixture.wav"),
    "speak-softly-like-horses": ("piano", "speak-softly-like-horses/mixture.wav"),
    "the-mountaineering-club-mallory": ("bass", "the-mountaineering-club-mallory/mixture.wav"),
    "pr-happy-daze": ("drums", "pr-happy-daze/mixture.wav"),
    "nerve-9-pray-for-the-rain": ("vocals", "nerve-9-pray-for-the-rain/mixture.wav"),
    "mallory-full-song": ("guitar", "full/the-mountaineering-club-mallory.wav"),
}
LISTENING_TARGETS = ("guitar", "bass", "piano", "drums", "vocals")  # apps/listening clip targets
QUESTION = "Could I practise with this stem in the mixer?"


@dataclass
class Pass:
    """One separate + stem_post pass of an item under one model map."""

    separation: contracts.Separation
    stems: contracts.Stems
    presence: contracts.Presence
    separate_s: float
    stem_post_s: float
    encoded_bytes: int


def timed(run: LocalRun, stage: str, inputs: dict[str, str], d: Decoded, **params: Any) -> Any:
    started = time.monotonic()
    out = run.run(stage, inputs, d, params or None)
    return out, time.monotonic() - started


def separate_pass(run: LocalRun, d: Decoded, tags: str, instrument: str, keep: Path) -> Pass:
    """separate and stem_post as the worker runs them; the outputs are copied to `keep`."""
    import torch
    from stage_separation import config

    config.load.cache_clear()
    random.seed(0)  # Demucs (the piano solo check) draws its time shift from random and torch
    torch.manual_seed(0)  # pyright: ignore[reportUnknownMemberType]
    sep, sep_s = timed(run, "separate", {"tags": tags}, d, instrument=instrument)
    separation = run.keep(sep, "separation", keep / "separation.json")
    post, post_s = timed(run, "stem_post", {"separation": str(separation), "tags": tags}, d)
    stems_json = run.keep(post, "stems", keep / "stems.json")
    presence_json = run.keep(post, "presence", keep / "presence.json")
    shutil.rmtree(keep / "stems", ignore_errors=True)
    for relative, path in post.blobs.items():
        (keep / relative).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, keep / relative)
    return Pass(
        separation=contracts.Separation.model_validate_json(separation.read_text()),
        stems=contracts.Stems.model_validate_json(stems_json.read_text()),
        presence=contracts.Presence.model_validate_json(presence_json.read_text()),
        separate_s=sep_s,
        stem_post_s=post_s,
        encoded_bytes=sum(Path(p).stat().st_size for p in post.blobs.values()),
    )


def with_map(path: Path | None) -> None:
    from stage_separation import config

    if path is None:
        os.environ.pop("ML_SEPARATION_CONFIG", None)
    else:
        os.environ["ML_SEPARATION_CONFIG"] = str(path)
    config.load.cache_clear()


def target_sha(p: Pass) -> str:
    return next(s.sha256 for s in p.separation.stems if s.role == "target")


def cmd_run(args: argparse.Namespace) -> int:
    root = Path(args.root).expanduser()
    out_dir = root / "all-stems" / args.tag
    before_map = Path(args.before).expanduser().resolve() if args.before else None
    shipped_map = os.environ.get("ML_SEPARATION_CONFIG")
    rows: list[dict[str, Any]] = []
    for item in args.item or list(ITEMS):
        instrument, relative = ITEMS[item]
        source = root / relative
        if not source.is_file():
            sys.exit(f"missing {source} (eval/p1_musdb.py windows / full)")
        keep = out_dir / item
        work = LocalRun(keep / "work")
        decoded = work.decode(source)
        tag_out, tag_s = timed(work, "tag", {"source": str(source)}, decoded)
        tags = str(work.keep(tag_out, "tags", keep / "tags.json"))
        with_map(Path(shipped_map) if shipped_map else None)
        after = separate_pass(work, decoded, tags, instrument, keep)
        row: dict[str, Any] = {
            "item": item,
            "instrument": instrument,
            "seconds": decoded.duration_s,
            "tag_s": tag_s,
            "after": after,
        }
        if before_map is not None:
            with_map(before_map)
            old = LocalRun(keep / "before" / "work")
            row["before"] = separate_pass(old, decoded, tags, instrument, keep / "before")
            with_map(Path(shipped_map) if shipped_map else None)
            shutil.rmtree(keep / "before" / "work", ignore_errors=True)
        (keep / "item.json").write_text(
            json.dumps({"item": item, "instrument": instrument, "source": str(source)}, indent=2)
            + "\n",
            encoding="utf-8",
        )
        shutil.rmtree(keep / "work", ignore_errors=True)
        rows.append(row)
        print(
            f"{item}: {len(after.stems.stems)} stems, {after.encoded_bytes / 1e6:.1f} MB",
            flush=True,
        )
    RESULTS.mkdir(parents=True, exist_ok=True)
    report = RESULTS / f"{args.tag}.md"
    report.write_text(render(rows, args), encoding="utf-8")
    print(f"report → {report}")
    return 0


def stem_list(p: Pass) -> str:
    return ", ".join(s.stem_id for s in p.stems.stems)


def left_out(p: Pass) -> str:
    """Instruments with a raw stem but no entry in stems.json: empty extras (s40a)."""
    listed = {s.instrument for s in p.stems.stems}
    raw = {s.instrument for s in p.separation.stems if s.role == "extra"}
    return ", ".join(sorted(i for i in raw - listed if i is not None)) or "-"


def render(rows: list[dict[str, Any]], args: argparse.Namespace) -> str:
    from stage_separation import config, models

    lines = [
        f"# All stems (step s40a): {args.tag}",
        "",
        f"Command: `uv run --no-sync python eval/all_stems.py run --tag {args.tag}"
        + (f" --before {args.before}" if args.before else "")
        + "`; device "
        + f"`{models.device()}`; model map keep = `{config.load().keep}`.",
        "Times are wall-clock per stage in-process (warm models after the first item; the first "
        "item's separate includes loading). `before` = the same stages under the older map.",
        "",
        "| item | learner | s | provider | stems before -> after | encoded MB before -> after"
        " | stem_post s before -> after | separate s | target identical | empty extras left out |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for row in rows:
        after: Pass = row["after"]
        before: Pass | None = row.get("before")
        lines.append(
            "| "
            + " | ".join(
                [
                    row["item"],
                    row["instrument"],
                    f"{row['seconds']:.1f}",
                    after.separation.provider,
                    f"{len(before.stems.stems) if before else '-'} -> {len(after.stems.stems)}",
                    f"{before.encoded_bytes / 1e6:.2f} -> {after.encoded_bytes / 1e6:.2f}"
                    if before
                    else f"- -> {after.encoded_bytes / 1e6:.2f}",
                    f"{before.stem_post_s:.1f} -> {after.stem_post_s:.1f}"
                    if before
                    else f"- -> {after.stem_post_s:.1f}",
                    f"{after.separate_s:.1f}",
                    ("yes" if target_sha(before) == target_sha(after) else "NO") if before else "-",
                    left_out(after),
                ]
            )
            + " |"
        )
    lines += ["", "## Stems per item (after)", ""]
    for row in rows:
        after = row["after"]
        presence = {p.instrument: p for p in after.presence.instruments}
        lines += [
            f"### {row['item']} ({row['instrument']}): {stem_list(after)}",
            "",
            "| stem | kind | empty | quality | energy ratio | LUFS | present_prob | bleed |",
            "|---|---|---|---|---|---|---|---|",
        ]
        for s in after.stems.stems:
            p = presence.get(s.instrument) if s.instrument else None
            lines.append(
                f"| {s.stem_id} | {s.kind} | {s.empty} | {s.quality_hint} | "
                f"{s.energy_ratio_to_mix:.4f} | {s.loudness_lufs:.1f} | "
                f"{p.present_prob if p else '-'} | {p.bleed_suspected if p else '-'} |"
            )
        lines.append("")
    return "\n".join(lines)


def token() -> str:
    return secrets.token_hex(8)


def cmd_export(args: argparse.Namespace) -> int:
    from stage_separation import encode

    root = Path(args.root).expanduser()
    runs = root / "all-stems" / args.tag
    session = root / "listening" / args.session
    if session.exists():
        sys.exit(f"{session} exists: listening sessions are never overwritten; pick a new id")
    media, other = session / "media", session / "other"
    media.mkdir(parents=True)
    clips: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []
    for folder in sorted(p for p in runs.iterdir() if (p / "item.json").is_file()):
        meta = json.loads((folder / "item.json").read_text(encoding="utf-8"))
        name, learner = str(meta["item"]), str(meta["instrument"])
        stems = contracts.Stems.model_validate_json((folder / "stems.json").read_text())
        audio, rate = sf.read(str(meta["source"]), dtype="float32", always_2d=True)
        wav = media / f"{name}.mixture.wav"
        sf.write(str(wav), audio, rate, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
        encode.encode_aac(wav, media / f"{name}.mixture.m4a")
        wav.unlink()
        mixture = {"token": token(), "file": f"{name}.mixture.m4a"}
        ordered = sorted(stems.stems, key=lambda s: s.kind == "mix_minus")
        for s in ordered:
            source = folder / next(f.path for f in s.files if f.codec == "aac")
            file = f"{name}.{s.stem_id}.m4a"
            instrument = learner if s.kind == "mix_minus" else s.instrument
            if instrument not in LISTENING_TARGETS:
                other.mkdir(exist_ok=True)
                shutil.copyfile(source, other / file)
                continue
            clip = f"{name}.{instrument}"
            if s.kind == "isolated":
                clips.append({"clip": clip, "target": instrument, "mixture": mixture})
            shutil.copyfile(source, media / file)
            role = "target" if instrument == learner and s.kind == "isolated" else "extra"
            system = f"{s.provider}:{role}" if s.kind == "isolated" else f"{s.provider}:mix_minus"
            items.append(
                {"item": token(), "clip": clip, "kind": s.kind, "system": system, "file": file}
            )
    manifest = {
        "id": args.session,
        "question": QUESTION,
        "clips": clips,
        "items": items,
        "pairs": [],
    }
    (session / "session.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    extra = sorted(p.name for p in other.iterdir()) if other.is_dir() else []
    print(f"{len(items)} items in {len(clips)} clips → {session}")
    if extra:
        print(f"by ear only (no listening target), in {other}: {', '.join(extra)}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--root", default=str(ROOT))
    sub = p.add_subparsers(dest="command", required=True)
    r = sub.add_parser("run", help="separate the items and write the report")
    r.add_argument(
        "--tag", required=True, help="run name: <root>/all-stems/<tag>, results/<tag>.md"
    )
    r.add_argument("--before", help="an older model map to compare against (separate + stem_post)")
    r.add_argument("--item", action="append", choices=sorted(ITEMS))
    r.set_defaults(fn=cmd_run)
    x = sub.add_parser("export", help="write a new listening session from a run")
    x.add_argument("--tag", required=True)
    x.add_argument("--session", required=True)
    x.set_defaults(fn=cmd_export)
    args = p.parse_args(argv)
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
