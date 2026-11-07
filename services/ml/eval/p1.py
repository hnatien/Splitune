"""Prototype 1: separation candidates on MUSDB18-HQ windows (08 §3 P1, personal-mode callout).

    uv run python eval/p1.py codec                       # mixture.aac128.wav per window
    uv run python eval/p1.py separate --model bs_roformer_sw [--clip ID ...]
    uv run python eval/p1.py separate --model htdemucs_ft --set --tag shifts1 --inference shifts=1
    uv run python eval/p1.py select                      # 20 clips → eval/sets/musdb18hq-p1-v2.yaml
    uv run python eval/p1.py export --session p1-2026-11-06 [--extra-dir DIR]  # new session
    uv run python eval/p1.py sdr [--tag shifts1]          # uSDR where MUSDB has references
    uv run python eval/p1.py report --session p1-2026-11-06   # ratings (Postgres) → results/p1

Windows come from `eval/p1_musdb.py` (default root ~/datasets/musdb18hq-p1). Candidates run on the
"YouTube-style" AAC 128 kb/s round-trip of each mixture, without loudness normalisation so the
reference stems keep their scale for SDR. Separation uses the shipped wrapper
(`stage_separation.models`), and the listening items are encoded by the shipped stem encoder, so
the raters hear what `separate` + `stem_post` would produce. A `--tag` keeps a sweep point's runs
(model-map inference settings overridden with `--inference`) apart from the default `runs/`.

Set versions: `musdb18hq-p1` (step 07) picked guitar/piano windows by BS-Roformer-SW's own stem
energy, so the incumbent chose its own test; it is kept for comparison. `musdb18hq-p1-v2`
(step 28, `select`) ranks vocals/drums/bass windows by the reference stem's energy and
guitar/piano windows by the loudest stem any candidate model gives (among windows where the
tagger hears the instrument), from the `aac128` records of `eval/sep_matrix.py`.
"""

from __future__ import annotations

import argparse
import csv
import io
import itertools
import json
import re
import secrets
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
import yaml
from splitune_eval import scoring
from splitune_eval.codec import simulate
from splitune_eval.registry import SETS_DIR, load_set

ROOT = Path("~/datasets/musdb18hq-p1").expanduser()
CODEC_MIX = "mixture.aac128.wav"
SET_ID = "musdb18hq-p1-v2"
SET_ID_V1 = "musdb18hq-p1"
RESULTS = Path(__file__).resolve().parent / "results" / "p1"
QUESTION = "Could I practise with this?"
LISTENING_LUFS = -16.0  # every item played at the same loudness, so louder never sounds better

# Candidates per learner instrument (only six-stem models output guitar and piano).
CANDIDATES: dict[str, list[str]] = {
    "guitar": ["bs_roformer_sw", "htdemucs_6s", "mel_roformer_guitar_becruily"],
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


def tagger_scores(mixture: Path) -> dict[str, float]:
    from scipy.signal import resample_poly  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]
    from stage_tagger import stage

    mono = read(mixture).mean(axis=1)
    resampled = np.asarray(resample_poly(mono, stage.MODEL_RATE, 44100), dtype=np.float32)
    batch = stage.windows(resampled, 10, 2)
    return {
        str(i["instrument"]): float(i["present_prob"])
        for i in stage.summarise(stage.infer(batch), 0.25)
    }


# Tagger floors for the unreferenced instruments (PANNs on mixes is low and uncalibrated).
TAG_FLOOR = {"piano": 0.005, "guitar": 0.1}


def select_clips(
    model_energy: dict[str, dict[str, dict[str, float]]],
    ref_energy: dict[str, dict[str, float]],
    tags: dict[str, dict[str, float]],
    quota: dict[str, int] = QUOTA,
) -> dict[str, str]:
    """clip → target, each clip once, instruments filled in `quota` order. Referenced instruments
    rank by the reference's energy vs the mixture; guitar/piano by the loudest output of that
    instrument across every model in `model_energy` (model → clip → instrument → dB), among clips
    whose tagger score reaches TAG_FLOOR. Ties break by clip id, so neither the order of the
    models nor of the clips can change the result."""
    chosen: dict[str, str] = {}
    clips = sorted(ref_energy)
    for instrument, count in quota.items():
        if instrument in REFERENCED:
            score = {c: ref_energy[c].get(instrument, SILENT_DB) for c in clips}
            eligible = [c for c in clips if c not in chosen]
        else:
            score = {
                c: max(
                    (e[c][instrument] for e in model_energy.values() if instrument in e.get(c, {})),
                    default=SILENT_DB,
                )
                for c in clips
            }
            eligible = [
                c
                for c in clips
                if c not in chosen and tags[c].get(instrument, 0.0) >= TAG_FLOOR[instrument]
            ]
        for clip in sorted(eligible, key=lambda c: (-score[c], c))[:count]:
            chosen[clip] = instrument
    return chosen


def matrix_energies(root: Path, variant: str) -> dict[str, dict[str, dict[str, float]]]:
    """model → clip → instrument → output energy (dB vs mixture) from sep_matrix records."""
    out: dict[str, dict[str, dict[str, float]]] = {}
    for log in sorted((root / "matrix" / variant).glob("*.jsonl")):
        if "@" in log.stem:  # library-default sweeps are not candidates
            continue
        model = log.stem
        names = outputs_of(model)
        for line in log.read_text(encoding="utf-8").splitlines():
            row = json.loads(line)
            out.setdefault(model, {})[row["clip"]] = {
                str(names[k]): float(v) for k, v in row["energy_db"].items() if names.get(k)
            }
    return out


def cmd_select(args: argparse.Namespace) -> int:
    root = Path(args.root).expanduser()
    index = windows(root)
    energies = matrix_energies(root, "aac128")
    missing = [m for m in {m for c in CANDIDATES.values() for m in c} if m not in energies]
    if missing or any(len(e) < len(index) for e in energies.values()):
        sys.exit(f"run eval/sep_matrix.py --variant aac128 for every window first ({missing})")
    mixtures = {c: root / "variants" / "aac128" / c / "mixture.wav" for c in index}
    refs = {
        c: {
            i: db_ratio(read(root / c / f"{i}.wav"), read(root / c / "mixture.wav"))
            for i in REFERENCED
        }
        for c in index
    }
    tags = {c: tagger_scores(mixtures[c]) for c in sorted(index)}
    chosen = select_clips(energies, refs, tags)
    items = [
        {
            "id": clip,
            "audio": f"variants/aac128/{clip}/mixture.wav",
            "annotations": {"sep": clip},
            "tags": {
                "target": target,
                "track": index[clip]["track"],
                "start_s": str(index[clip]["start_s"]),
                "ref_db": str(refs[clip].get(target, "")),
                "max_model_db": str(max(e[clip].get(target, SILENT_DB) for e in energies.values())),
                "tagger": f"{tags[clip].get(target, 0.0):.3f}",
            },
        }
        for clip, target in chosen.items()
    ]
    document = {
        "id": SET_ID,
        "description": "Prototype 1, v2 selection: 20 x 30 s MUSDB18-HQ test windows (AAC 128 "
        "kb/s), one target instrument each",
        "licence": "MUSDB18-HQ research use (tracks under their own licences)",
        "provenance": "Zenodo record 3338373, test split; windows cut by eval/p1_musdb.py at 30% "
        "of each track; chosen by eval/p1.py select (step 28): vocals/drums/bass by reference "
        "stem energy vs the mixture, guitar/piano by the loudest stem of any candidate model "
        "among windows where PANNs hears it; quota piano 4, guitar 8, vocals 3, bass 3, drums 2; "
        "each song once. v1 (musdb18hq-p1) is kept for comparison.",
        "root": str(root).replace(str(Path.home()), "~"),
        "split": "test",
        "tasks": ["sep"],
        "tags": {"genre": "mixed", "live": "studio", "codec": "aac128"},
        "items": items,
    }
    path = SETS_DIR / f"{SET_ID}.yaml"
    path.write_text(yaml.safe_dump(document, sort_keys=False, width=100), encoding="utf-8")
    v1 = {i.id: i.tags["target"] for i in load_set(SET_ID_V1).items}
    for clip, target in chosen.items():
        same = "same as v1" if v1.get(clip) == target else ""
        print(f"{target:7} {clip} {same}")
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


EXPORT_VARIANTS = ("limit-XL", "opus128")  # robustness conditions rated as extra items
EXTRA_SECONDS = 30.0


def matrix_stems(root: Path, variant: str, model: str, clip: str) -> tuple[np.ndarray, np.ndarray]:
    """(target, complement) kept by `sep_matrix.py run --keep` for one clip."""
    folder = root / "matrix" / variant / "stems" / model / clip
    if not (folder / "target.wav").is_file():
        sys.exit(
            f"missing {folder}: run eval/sep_matrix.py run --variant {variant} --model {model} "
            f"--clips {SET_ID} --keep {SET_ID}"
        )
    return read(folder / "target.wav"), read(folder / "complement.wav")


def separated_snippet(
    model: str, audio: Path, target: str, work: Path
) -> tuple[np.ndarray, np.ndarray]:
    """(target, complement) of a live run of the shipped wrapper on an unreferenced snippet."""
    from stage_separation import config, models

    spec = config.load().models[model]
    result = models.separate(model, spec, audio, work / model)
    frames = len(read(audio))
    parts: dict[str, np.ndarray] = {}
    for name, path in result.files.items():
        data = read(path)[:frames]
        parts[name] = np.pad(data, ((0, frames - len(data)), (0, 0)))
    zero = np.zeros((frames, 2), dtype=np.float32)
    target_name = next(k for k, v in spec.outputs.items() if v == target)
    rest = [data for k, data in parts.items() if k != target_name]
    return parts.get(target_name, zero), np.sum(rest, axis=0) if rest else zero


def extra_snippets(extra: Path) -> list[tuple[str, str, Path]]:
    """(clip id, target, file) for every audio file under <extra>/<target>/ (the owner's
    unreferenced snippets; the folder name says which instrument to isolate)."""
    out: list[tuple[str, str, Path]] = []
    for folder in sorted(p for p in extra.iterdir() if p.is_dir() and p.name in CANDIDATES):
        for file in sorted(f for f in folder.iterdir() if f.is_file()):
            slug = re.sub(r"[^a-z0-9]+", "-", file.stem.lower()).strip("-")[:40] or "snippet"
            out.append((f"extra-{folder.name}-{slug}", folder.name, file))
    return out


class Session:
    """The manifest being written: clips, rated items and A/B pairs, media encoded as it goes."""

    def __init__(self, media: Path) -> None:
        self.media = media
        self.clips: list[dict[str, Any]] = []
        self.items: list[dict[str, Any]] = []
        self.pairs: list[dict[str, Any]] = []

    def item(self, clip: str, kind: str, system: str, audio: np.ndarray, name: str) -> str:
        tok = token()
        file = encode_item(audio, self.media, name)
        self.items.append({"item": tok, "clip": clip, "kind": kind, "system": system, "file": file})
        return tok

    def clip(
        self,
        clip: str,
        target: str,
        mixture: np.ndarray,
        runs: dict[str, tuple[np.ndarray, np.ndarray]],
        n: int,
    ) -> None:
        """Mixture, each candidate's isolated + subtract items, the head's complement and the
        pairs, as step 07 exported them."""
        mix = {"token": token(), "file": encode_item(mixture, self.media, f"{clip}.mixture")}
        self.clips.append({"clip": clip, "target": target, "mixture": mix})
        isolated: dict[str, str] = {}
        subtract: dict[str, str] = {}
        frames = len(mixture)
        for model in CANDIDATES[target]:
            stem = runs[model][0][:frames]
            isolated[model] = self.item(clip, "isolated", model, stem, f"{clip}.{model}.isolated")
            subtract[model] = self.item(
                clip,
                "mix_minus",
                f"{model}:subtract",
                mixture - stem,
                f"{clip}.{model}.subtract.mix_minus",
            )
        head = CANDIDATES[target][0]
        complement = self.item(
            clip,
            "mix_minus",
            f"{head}:complement",
            runs[head][1][:frames],
            f"{clip}.{head}.complement.mix_minus",
        )
        all_pairs = list(itertools.combinations(CANDIDATES[target], 2))
        if len(all_pairs) > PAIRS_PER_CLIP:
            start = n * PAIRS_PER_CLIP
            all_pairs = [all_pairs[(start + j) % len(all_pairs)] for j in range(PAIRS_PER_CLIP)]
        for a, b in all_pairs:
            self.pairs.append({"pair": token(), "clip": clip, "a": isolated[a], "b": isolated[b]})
        self.pairs.append({"pair": token(), "clip": clip, "a": subtract[head], "b": complement})


def cmd_export(args: argparse.Namespace) -> int:
    """A new blinded session. Per clip: each candidate's isolated stem and mixture-minus-stem,
    the head candidate's complement mix-minus, isolated A/B pairs (all pairs, or a rotating three
    when there are more) and subtract-vs-complement for the head candidate; then each candidate's
    isolated stem under the EXPORT_VARIANTS (rated items only, system `<model>@<variant>`). Clips
    are the v2 set's (stems from `sep_matrix.py --keep`) plus, with `--extra-dir`, the owner's
    unreferenced snippets (first 30 s, through the shipped decode, separated here). The app shows
    tokens only, in a per-rater order. An existing session is never touched."""
    from splitune_eval import variants

    root = Path(args.root).expanduser()
    session = root / "listening" / args.session
    if session.exists():
        sys.exit(f"{session} exists: listening sessions are never overwritten; pick a new id")
    (session / "media").mkdir(parents=True)
    out = Session(session / "media")
    for n, item in enumerate(load_set(SET_ID).items):
        clip, target = item.id, item.tags["target"]
        runs = {m: matrix_stems(root, "aac128", m, clip) for m in CANDIDATES[target]}
        out.clip(clip, target, read(root / str(item.audio)), runs, n)
        for variant in EXPORT_VARIANTS:
            for model in CANDIDATES[target]:
                stem = matrix_stems(root, variant, model, clip)[0]
                name = f"{clip}.{model}.{variant.lower()}.isolated"
                out.item(clip, "isolated", f"{model}@{variant}", stem, name)
        print(f"{clip}: {len(CANDIDATES[target])} candidates", flush=True)
    if args.extra_dir:
        work = session / "work"
        for n, (clip, target, file) in enumerate(extra_snippets(Path(args.extra_dir).expanduser())):
            audio = variants.shipped_decode(file)[: int(EXTRA_SECONDS * 44100)]
            source = work / f"{clip}.wav"
            source.parent.mkdir(parents=True, exist_ok=True)
            sf.write(str(source), audio.astype(np.float32), 44100, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
            runs = {
                m: separated_snippet(m, source, target, work / clip) for m in CANDIDATES[target]
            }
            out.clip(clip, target, audio, runs, n)
            print(f"{clip}: extra snippet", flush=True)
        shutil.rmtree(work, ignore_errors=True)
    manifest = {
        "id": args.session,
        "question": QUESTION,
        "clips": out.clips,
        "items": out.items,
        "pairs": out.pairs,
    }
    (session / "session.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"{len(out.items)} ratings + {len(out.pairs)} pairs → {session}")
    return 0


def sdr_rows(root: Path, tag: str | None = None, set_id: str = SET_ID) -> list[dict[str, Any]]:
    """Every `scoring.separation` metric of a sweep's runs (silent references scored as leakage
    and left out of the SDR columns)."""
    runs = runs_dir(root, tag)
    rows: list[dict[str, Any]] = []
    for item in load_set(set_id).items:
        clip = item.id
        mixture = read(root / clip / CODEC_MIX).astype(np.float64)  # what the runs separated
        refs = {
            i: read(root / clip / f"{i}.wav").astype(np.float64) for i in (*REFERENCED, "other")
        }
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
                others = [r for i, r in refs.items() if i != instrument]
                metrics = scoring.separation(refs[instrument], est, mixture, others=others)
                rows.append(
                    {"clip": clip, "model": model, "instrument": instrument}
                    | {k: round(metrics.get(k, float("nan")), 2) for k in SDR_COLUMNS}
                )
    return rows


SDR_COLUMNS = ("silent", "leakage_db", "usdr", "si_sdr", "csdr", "bleedless", "fullness", "si_sar")


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
        writer = csv.DictWriter(f, fieldnames=["clip", "model", "instrument", *SDR_COLUMNS])
        writer.writeheader()
        writer.writerows(rows)
    for (model, instrument), group in itertools.groupby(
        sorted(rows, key=lambda r: (r["model"], r["instrument"])),
        key=lambda r: (r["model"], r["instrument"]),
    ):
        cell = list(group)
        values = [r["usdr"] for r in cell if not r["silent"]]
        print(
            f"{model:26} {instrument:7} median {statistics.median(values):6.2f} dB "
            f"(n={len(values)}, {len(cell) - len(values)} silent), "
            f"{seconds_per_clip(runs_dir(root, args.tag), model):.1f} s/clip"
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


def matrix_record(
    root: Path, variant: str, model: str, clip: str, instrument: str
) -> dict[str, Any] | None:
    """One clip's metrics for one instrument from eval/sep_matrix.py's records."""
    log = root / "matrix" / variant / f"{model}.jsonl"
    if not log.is_file():
        return None
    for line in log.read_text(encoding="utf-8").splitlines():
        row = json.loads(line)
        if row["clip"] == clip:
            return cast(dict[str, Any] | None, row["metrics"].get(instrument))
    return None


def spearman(x: list[float], y: list[float]) -> tuple[float, float]:
    from scipy.stats import spearmanr  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]

    result = spearmanr(x, y)  # pyright: ignore[reportUnknownVariableType]
    return float(result.statistic), float(result.pvalue)  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType, reportAttributeAccessIssue]


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

    # Separation metrics of the rated isolated items (sep_matrix records), and how well each
    # metric ranks the items as the raters did (Spearman per instrument): the calibration of the
    # metric choice and of stem_post's bleed heuristic (06 §4).
    metrics = ("usdr", "si_sdr", "csdr", "bleedless", "fullness", "si_sar")
    by_token: dict[str, list[int]] = {}
    for r in ratings:
        by_token.setdefault(r["item"], []).append(int(r["score"]))
    medians = {item: float(statistics.median(v)) for item, v in by_token.items()}
    pairs_by: dict[tuple[str, str], list[tuple[float, float]]] = {}
    for token_id, rating in medians.items():
        item = by_item[token_id]
        target = target_of[item["clip"]]
        if item["kind"] != "isolated" or target not in REFERENCED:
            continue
        model, _, variant = str(item["system"]).partition("@")
        record = matrix_record(root, variant or "aac128", model, item["clip"], target)
        if record is None or record["silent"]:
            continue
        for metric in metrics:
            if metric in record:
                pairs_by.setdefault((target, metric), []).append((rating, float(record[metric])))
    lines += [
        "",
        "## Ratings vs separation metrics (isolated items with MUSDB references)",
        "",
        "Spearman rho between each item's median rating and the metric (items pooled over models "
        "and robustness variants); n < 5 is left out.",
        "",
        "| Instrument | Metric | n | Spearman rho | p |",
        "|---|---|---:|---:|---:|",
    ]
    for (instrument, metric), values in sorted(pairs_by.items()):
        if len(values) < 5:
            continue
        rho, pval = spearman([r for r, _ in values], [m for _, m in values])
        lines.append(f"| {instrument} | {metric} | {len(values)} | {rho:.2f} | {pval:.3f} |")
        csv_rows.append(
            {
                "section": "spearman",
                "instrument": instrument,
                "kind": metric,
                "system": "",
                "n": len(values),
                "median": round(rho, 3),
                "mean": round(pval, 4),
                "clips_median_ge4": "",
                "clips": "",
            }
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
    sub.add_parser("select", help=f"choose the clips → eval/sets/{SET_ID}.yaml").set_defaults(
        fn=cmd_select
    )
    x = sub.add_parser("export", help="write a new blinded listening session")
    x.add_argument("--session", required=True)
    x.add_argument("--extra-dir", help="unreferenced snippets in <dir>/<target>/ (owner's songs)")
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
