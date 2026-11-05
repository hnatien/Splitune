"""Step 26: fine-tune Transkun V2 NoExt for the production domain (pop piano, separated stems).

    uv run python eval/p2p_finetune.py data [--songs N --maestro M]  # → ~/datasets/p2p-train
    uv run python eval/p2p_finetune.py train --name N [--steps S --lr LR]  # → _models/transkun-ft/N
    uv run python eval/p2p.py detail --name N --stereo --weights ~/datasets/_models/transkun-ft/N

Training audio is what notes.piano sees in production: the BS-Roformer-SW piano stem of a band mix,
or the clean piano when the solo check skips separation. Sources, none a P2p test item:
- POP909 songs that no P2p item uses (MELODY + PIANO, or PIANO alone under a band), rendered by
  p2p's renderers (every sampled piano, electric piano, harpsichord and the GM clavinet) with p2p's
  room / phone / detune augmentations and bar pedalling on slow songs;
- bands from the MUSDB18-HQ songs no legacy item uses (drums + bass + vocals, a random window: its
  `other` stem often holds keys that would bleed into the stem unlabelled and teach the model to
  drop notes), the piano mixed at p2p's featured or buried level, sometimes doubled by a guitar or
  synth;
- MAESTRO v3 `train` performances (real Disklavier piano with pedal, read from the dataset zip with
  HTTP range requests; P2p's legacy tier uses `test` ones), alone or under a band as above;
- P2p's `fit` split as P2p builds it (stem for band items, clean otherwise).
Every 10th excerpt (by order) is held out: the checkpoint is chosen on its loss, never on P2p.
The loop is transkun/train.py's single-worker step (log-likelihood of the semi-CRF, adaptive
gradient clipping at the 0.8 quantile of recent norms) on random 16 s windows, AdamW from the
shipped `2.0.pt` at a constant low learning rate; notes cut by a window edge keep transkun's
hasOnset / hasOffset flags, and the sustain pedal is a target (pitch -64) as in its training.
"""

# transkun is untyped.
# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false, reportMissingTypeStubs=false

from __future__ import annotations

import argparse
import json
import random
import re
import shutil
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import p2p

TRAIN = p2p.DATA / "p2p-train"
MUSDB = p2p.DATA / "musdb18hq" / "test"
LEGACY_PIANO = p2p.LEGACY / "piano.json"
OUT = p2p.DATA / "_models" / "transkun-ft"
SEED = 26
CHUNK_S = 16.0
PEDAL = -64


# --- data ----------------------------------------------------------------------------------------


def excluded_songs() -> set[str]:
    return {
        str(i["source"]["song"])
        for i in p2p.load_items(("pop-solo", "pop-band"))
        if i["source"]["kind"] == "pop909"
    }


def musdb_songs() -> list[Path]:
    """MUSDB18-HQ test songs (full tracks, "Artist - Title") that no legacy band window uses."""
    used = {i["band"] for i in json.loads(LEGACY_PIANO.read_text(encoding="utf-8"))}
    return sorted(
        p
        for p in MUSDB.iterdir()
        if " - " in p.name
        and (p / "drums.wav").is_file()
        and re.sub("[^a-z0-9]+", "-", p.name.lower()).strip("-") not in used
    )


def musdb_band(song: Path, rng: np.random.Generator) -> p2p.Audio:
    seconds = p2p.sf.info(str(song / "mixture.wav")).duration
    t0 = float(rng.uniform(0, max(0.0, seconds - p2p.WINDOW_S)))
    frames = int(p2p.WINDOW_S * p2p.RATE)
    return sum(
        (
            p2p.fit(p2p.read_stereo(song / f"{s}.wav", t0, p2p.WINDOW_S), frames)
            for s in ("drums", "bass", "vocals")
        ),
        np.zeros((frames, 2), np.float32),
    )


def build_pop(song: str, n: int, out: Path, bands: list[Path], rng: np.random.Generator) -> None:
    midi, beats, downbeats = p2p.pop909_song(song)
    band = n % 2 == 1
    notes = p2p.pop909_tracks(midi, ["PIANO"] if band else ["MELODY", "PIANO"])
    starts = [float(b) for b, d in zip(beats, downbeats, strict=True) if d]
    starts = [s for s in starts if s + p2p.WINDOW_S < float(beats[-1])] or [float(beats[0])]
    t0 = float(rng.choice(starts))
    t1 = t0 + p2p.WINDOW_S
    slow = p2p.tempo(beats) < 76
    pedal_full = p2p.bar_pedal(beats, downbeats, t0, t1) if slow and not band else []
    keyoff = p2p.window_notes(notes, t0, t1)
    pedal = p2p.window_pedal(pedal_full, t0, t1)
    renderer = str(rng.choice(list(p2p.RENDERERS)))
    piano = p2p.render(keyoff, pedal, renderer, p2p.WINDOW_S)
    aug = str(rng.choice(["none", "none", "room", "phone", "detune"]))
    if aug == "room":
        piano = p2p.room(piano, rng)
    if aug == "detune":
        piano, factor = p2p.detune(piano, float(rng.choice([-30.0, -20.0, 20.0, 30.0])))
        piano = p2p.fit(piano, int(p2p.WINDOW_S * p2p.RATE))
        keyoff = [(a * factor, b * factor, p, v) for a, b, p, v in keyoff]
        pedal = [(a * factor, b * factor) for a, b in pedal]
    piano = p2p.normalize(piano)
    if aug == "phone":
        piano = p2p.phone(piano)
    recipe: dict[str, Any] = {"song": song, "renderer": renderer, "augment": aug, "band": None}
    if band:
        accompaniment = musdb_band(bands[int(rng.integers(len(bands)))], rng)
        if rng.random() < 0.3:
            double = str(rng.choice(list(p2p.DOUBLINGS)))
            accompaniment += p2p.render(
                p2p.top_line(keyoff), [], double, p2p.WINDOW_S
            ) * np.float32(0.5)
        level = str(rng.choice(["featured", "featured", "buried"]))
        piano, mixture = p2p.mix(piano, accompaniment, level)
        p2p.write(out / "mixture.wav", mixture)
        recipe["band"] = level
    p2p.write(out / "piano.wav", piano)
    write_notes(out, keyoff, pedal, recipe)


def build_maestro(rows: list[dict[str, str]], bands: list[Path], rng: np.random.Generator) -> None:
    import io
    import zipfile

    from p1_musdb import HttpRangeFile, WavStream
    from p2 import MAESTRO_URL

    archive = zipfile.ZipFile(io.BufferedReader(HttpRangeFile(MAESTRO_URL), buffer_size=4 << 20))
    folder = "maestro-v3.0.0/"
    for n, row in enumerate(rows):
        out = TRAIN / f"maestro-{n:03d}"
        if (out / "notes.json").is_file():
            continue
        out.mkdir(parents=True, exist_ok=True)
        t0 = float(
            rng.uniform(5.0, max(5.0, min(60.0, float(row["duration"]) - p2p.WINDOW_S - 5.0)))
        )
        with archive.open(folder + row["audio_filename"]) as member:
            wav = WavStream(member)
            data = wav.read(int(t0 * wav.samplerate), int(p2p.WINDOW_S * wav.samplerate))
            rate = wav.samplerate
        audio = np.asarray(
            p2p.resample_poly(data, p2p.RATE, rate, axis=0) if rate != p2p.RATE else data,
            dtype=np.float32,
        )
        piano = p2p.normalize(
            p2p.fit(
                audio[:, :2] if audio.shape[1] > 1 else np.repeat(audio, 2, 1),
                int(p2p.WINDOW_S * p2p.RATE),
            )
        )
        midi = p2p.pretty_midi.PrettyMIDI(io.BytesIO(archive.read(folder + row["midi_filename"])))
        notes = p2p.window_notes(sorted(p2p.midi_notes(midi)), t0, t0 + p2p.WINDOW_S)
        pedal = p2p.window_pedal(sorted(p2p.midi_pedal(midi)), t0, t0 + p2p.WINDOW_S)
        recipe: dict[str, Any] = {"maestro": row["midi_filename"], "t0": t0, "band": None}
        if n % 2 == 1:
            level = str(rng.choice(["featured", "featured", "buried"]))
            piano, mixture = p2p.mix(
                piano, musdb_band(bands[int(rng.integers(len(bands)))], rng), level
            )
            p2p.write(out / "mixture.wav", mixture)
            recipe["band"] = level
        p2p.write(out / "piano.wav", piano)
        write_notes(out, notes, pedal, recipe)
        print(f"maestro-{n:03d} {row['canonical_composer']}", flush=True)


def maestro_rows(count: int, rng: np.random.Generator) -> list[dict[str, str]]:
    import csv
    import io
    import zipfile

    from p1_musdb import HttpRangeFile
    from p2 import MAESTRO_URL

    archive = zipfile.ZipFile(io.BufferedReader(HttpRangeFile(MAESTRO_URL), buffer_size=4 << 20))
    with archive.open("maestro-v3.0.0/maestro-v3.0.0.csv") as f:
        rows = [r for r in csv.DictReader(io.TextIOWrapper(f, "utf-8")) if r["split"] == "train"]
    return [rows[i] for i in rng.choice(len(rows), count, replace=False)]


def write_notes(
    out: Path, notes: list[p2p.Note], pedal: list[tuple[float, float]], recipe: dict[str, Any]
) -> None:
    rows = [[a, b, p, v] for a, b, p, v in notes] + [[a, b, PEDAL, 127] for a, b in pedal]
    p2p.write_json(out / "notes.json", {"notes": rows, "recipe": recipe})


def fit_items() -> list[dict[str, Any]]:
    return [i for i in p2p.load_items() if i["split"] == "fit"]


def fit_notes(item: dict[str, Any]) -> tuple[list[p2p.Note], list[tuple[float, float]]]:
    events, velocity = p2p.ref_notes(item, "keyoff")
    notes = [
        (float(a), float(b), round(p), int(v) if np.isfinite(v) else 64)
        for (a, b), p, v in zip(events.intervals, events.pitches_midi, velocity, strict=True)
    ]
    pedal_csv = Path(item["dir"]) / "pedal.csv"
    pedal: list[tuple[float, float]] = []
    if pedal_csv.is_file():
        for line in pedal_csv.read_text(encoding="utf-8").splitlines():
            parts = line.split(",")
            if len(parts) >= 2:
                try:
                    pedal.append((float(parts[0]), float(parts[1])))
                except ValueError:
                    continue
    return notes, pedal


def cmd_data(args: argparse.Namespace) -> int:
    rng = np.random.default_rng(SEED)
    excluded = excluded_songs()
    songs = [
        p.name
        for p in sorted(p2p.POP909.iterdir())
        if (p / "beat_midi.txt").is_file() and p.name not in excluded
    ]
    picked = [songs[i] for i in rng.choice(len(songs), args.songs, replace=False)]
    bands = musdb_songs()
    for n, song in enumerate(picked):
        out = TRAIN / f"pop-{n:03d}"
        if (out / "notes.json").is_file():
            continue
        out.mkdir(parents=True, exist_ok=True)
        build_pop(song, n, out, bands, rng)
        print(f"pop-{n:03d} {song}", flush=True)
    if args.maestro:
        build_maestro(maestro_rows(args.maestro, np.random.default_rng(SEED + 1)), bands, rng)
    for item in fit_items():
        out = TRAIN / f"fit-{item['id']}"
        if (out / "notes.json").is_file():
            continue
        source = p2p.input_audio(item, "stem" if p2p.has_band(item) else "clean")
        if not source.is_file():
            continue
        out.mkdir(parents=True, exist_ok=True)
        p2p.write(out / "input.wav", p2p.read_stereo(source))
        notes, pedal = fit_notes(item)
        write_notes(out, notes, pedal, {"fit": item["id"]})
        print(f"fit {item['id']}", flush=True)
    for folder in sorted(TRAIN.iterdir()):
        if (folder / "input.wav").is_file():
            continue
        if (folder / "mixture.wav").is_file():
            p2p.separate_one("bs_roformer_sw", folder / "mixture.wav", folder / "sep")
            shutil.copyfile(folder / "sep" / "piano.wav", folder / "input.wav")
            # Only the input is trained on; the other stems and the mix would fill the disk.
            shutil.rmtree(folder / "sep")
            (folder / "mixture.wav").unlink()
        else:
            shutil.copyfile(folder / "piano.wav", folder / "input.wav")
        (folder / "piano.wav").unlink()
        print(f"input {folder.name}", flush=True)
    return 0


# --- training ------------------------------------------------------------------------------------


def excerpts() -> tuple[list[Path], list[Path]]:
    folders = sorted(f for f in TRAIN.iterdir() if (f / "input.wav").is_file())
    return [f for i, f in enumerate(folders) if i % 10 != 9], folders[9::10]


def disjoint(notes: list[list[float]]) -> list[list[float]]:
    """Transkun's targets allow one interval per key at a time: a re-struck key ends the previous
    note (as transkun.Data.resolveOverlapping does)."""
    out: list[list[float]] = []
    last: dict[int, list[float]] = {}
    for s, e, p, v in sorted(notes, key=lambda n: (n[2], n[0])):
        prev = last.get(int(p))
        if prev is not None and prev[1] > s:
            prev[1] = s
        note = [s, e, p, v]
        last[int(p)] = note
        out.append(note)
    return sorted((n for n in out if n[1] - n[0] > 1e-3), key=lambda n: n[0])


class Excerpt:
    def __init__(self, folder: Path) -> None:
        self.audio = p2p.read_stereo(folder / "input.wav")
        self.notes = disjoint(
            json.loads((folder / "notes.json").read_text(encoding="utf-8"))["notes"]
        )
        self.seconds = len(self.audio) / p2p.RATE

    def window(self, begin: float) -> tuple[Any, list[Any]]:
        from transkun.Data import Note

        end = begin + CHUNK_S
        a = int(begin * p2p.RATE)
        audio = p2p.fit(self.audio[a : a + int(CHUNK_S * p2p.RATE)], int(CHUNK_S * p2p.RATE))
        notes = [
            Note(max(s, begin) - begin, min(e, end) - begin, int(p), int(v), s >= begin, e < end)
            for s, e, p, v in self.notes
            if s < end and e > begin
        ]
        return audio, notes


def batch_loss(model: Any, batch: list[tuple[Any, list[Any]]], device: Any) -> Any:
    import torch

    audio = torch.from_numpy(np.stack([a for a, _ in batch])).to(device)
    logp = model.log_prob(audio, [n for _, n in batch])
    return -logp.sum(-1).mean()


def cmd_train(args: argparse.Namespace) -> int:
    import torch
    from stage_notes.transcribers import models_dir

    random.seed(SEED)
    torch.manual_seed(SEED)
    train_dirs, val_dirs = excerpts()
    train = [Excerpt(f) for f in train_dirs]
    val = [Excerpt(f) for f in val_dirs]
    print(f"train {len(train)} excerpts, val {len(val)}", flush=True)
    model = p2p.load_transkun(None)._load()  # pyright: ignore[reportPrivateUsage]
    device = next(model.parameters()).device
    conf_src = models_dir() / "transkun" / "2.0.conf"
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    val_windows = [(e, b) for e in val for b in (0.0, e.seconds - CHUNK_S)]

    def validate() -> float:
        model.eval()
        with torch.no_grad():
            losses = [float(batch_loss(model, [e.window(b)], device)) for e, b in val_windows]
        return float(np.mean(losses))

    out = OUT / args.name
    out.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(conf_src, out / "model.conf")
    best = validate()
    print(f"step 0 val {best:.3f}", flush=True)
    torch.save({"state_dict": model.state_dict()}, out / "checkpoint.pt")
    norms: list[float] = [40.0]
    history: list[dict[str, float]] = [{"step": 0, "val": best}]
    started = time.monotonic()
    for step in range(1, args.steps + 1):
        model.train()
        optimizer.zero_grad()
        picks = random.choices(train, weights=[e.seconds for e in train], k=args.batch)
        batch = [e.window(random.uniform(0.0, max(0.0, e.seconds - CHUNK_S))) for e in picks]
        loss = batch_loss(model, batch, device)
        (loss / 50).backward()
        clip = float(np.quantile(norms[-10000:], 0.8))
        norm = float(torch.nn.utils.clip_grad_norm_(model.parameters(), clip))
        norms.append(norm)
        optimizer.step()
        if step % args.every == 0:
            v = validate()
            history.append({"step": step, "val": v, "train": float(loss)})
            mark = ""
            if v < best:
                best = v
                torch.save({"state_dict": model.state_dict()}, out / "checkpoint.pt")
                mark = " *"
            print(
                f"step {step} loss {float(loss):.3f} val {v:.3f}{mark} "
                f"({time.monotonic() - started:.0f}s)",
                flush=True,
            )
    p2p.write_json(
        out / "train.json",
        {
            "steps": args.steps,
            "lr": args.lr,
            "batch": args.batch,
            "train_excerpts": len(train),
            "val_excerpts": len(val),
            "best_val": best,
            "seconds": time.monotonic() - started,
            "history": history,
        },
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(required=True)
    p = sub.add_parser("data")
    p.add_argument("--songs", type=int, default=240)
    p.add_argument("--maestro", type=int, default=48)
    p.set_defaults(fn=cmd_data)
    p = sub.add_parser("train")
    p.add_argument("--name", required=True)
    p.add_argument("--steps", type=int, default=3000)
    p.add_argument("--lr", type=float, default=2e-5)
    p.add_argument("--batch", type=int, default=4)
    p.add_argument("--every", type=int, default=250)
    p.set_defaults(fn=cmd_train)
    args = parser.parse_args()
    return int(args.fn(args))


if __name__ == "__main__":
    raise SystemExit(main())
