"""Out-of-sample keys windows from Slakh2100 (step 29 Phase 5; set `slakh-keys-p1`).

    uv run python eval/p1_slakh.py windows [--source DIR] [--root DIR]

X-LANCE trained on MoisesDB and Mega-53's data is undisclosed, so the keys fallback is checked
on synth- and organ-heavy windows of Slakh2100 (CC BY 4.0) test tracks: the tracks already on
disk from step 24 (`--source`, default ~/datasets/slakh2100/slakh2100_flac_redux/test), nothing
downloaded. Slakh renders every stem in mono at 44.1 kHz, so each stem is copied to both
channels and the mixture is the sum of all rendered stems.

References, by each stem's MIDI program (General MIDI):
- `piano` (the keys reference, as MoisesDB's `piano` + `other_keys`): pianos and electric pianos
  (0-7), drawbar, percussive, rock and church organ (16-19), synth lead (80-87) and pad (88-95);
- `bass`, `drums`, `guitar` by Slakh's class; `other` = everything else (chromatic percussion,
  accordion, harmonica, strings, brass, ...).

Selection (pre-registered in the step 29 plan, references only): per track, the 30 s window on
a 1 s grid with the most organ + synth energy; kept when the keys reference is -15 to -1 dB vs
the mixture and its organ + synth part is at least 6 dB above its piano part; the 5 tracks with
the highest organ + synth share of the mixture are written to <root>/<track>-keys/.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, cast

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
import yaml

RATE = 44100
WINDOW_S = 30
COUNT = 5
SOURCE = Path("~/datasets/slakh2100/slakh2100_flac_redux/test")
ROOT = Path("~/datasets/slakh-keys-p1")
PIANO = range(0, 8)
ORGAN = range(16, 20)
SYNTH = range(80, 96)


def part_of(stem: dict[str, Any]) -> str:
    """Which reference a Slakh stem belongs to (`organ_synth` and `keys_piano` make `piano`)."""
    program = int(stem.get("program_num", -1))
    if stem.get("is_drum"):
        return "drums"
    if program in ORGAN or program in SYNTH:
        return "organ_synth"
    if program in PIANO:
        return "keys_piano"
    return {"Bass": "bass", "Guitar": "guitar"}.get(str(stem.get("inst_class")), "other")


def load_track(folder: Path) -> dict[str, np.ndarray]:
    """part -> mono sum of the track's rendered stems in that part."""
    meta = cast(
        dict[str, Any], yaml.safe_load((folder / "metadata.yaml").read_text(encoding="utf-8"))
    )
    parts: dict[str, np.ndarray] = {}
    for name, stem in cast(dict[str, dict[str, Any]], meta["stems"]).items():
        path = folder / "stems" / f"{name}.flac"
        if not path.is_file():
            continue
        audio, rate = sf.read(str(path), dtype="float64")
        if int(rate) != RATE:
            raise ValueError(f"{path}: {rate} Hz")
        audio = np.asarray(audio, dtype=np.float64).reshape(len(audio), -1).mean(axis=1)
        part = part_of(stem)
        if part in parts:
            n = max(len(parts[part]), len(audio))
            parts[part] = np.pad(parts[part], (0, n - len(parts[part]))) + np.pad(
                audio, (0, n - len(audio))
            )
        else:
            parts[part] = audio
    n = max(len(a) for a in parts.values())
    return {k: np.pad(a, (0, n - len(a))) for k, a in parts.items()}


def windowed_energy(signal: np.ndarray, starts: np.ndarray, length: int) -> np.ndarray:
    cumulative = np.concatenate([[0.0], np.cumsum(signal**2)])
    return cumulative[starts + length] - cumulative[starts]


def db(ratio: np.ndarray | float) -> np.ndarray:
    return 10 * np.log10(np.maximum(ratio, 1e-30))


def best_window(parts: dict[str, np.ndarray]) -> dict[str, Any] | None:
    """The track's qualifying window with the most organ + synth energy, or None."""
    length = WINDOW_S * RATE
    mixture = np.sum(list(parts.values()), axis=0)
    if len(mixture) < length or "organ_synth" not in parts:
        return None
    starts = np.arange(0, len(mixture) - length + 1, RATE)
    zero = np.zeros_like(mixture)
    mix_e = windowed_energy(mixture, starts, length)
    organ_synth = windowed_energy(parts["organ_synth"], starts, length)
    piano = windowed_energy(parts.get("keys_piano", zero), starts, length)
    keys = windowed_energy(parts["organ_synth"] + parts.get("keys_piano", zero), starts, length)
    keys_db = db(keys / np.maximum(mix_e, 1e-30))
    ok = (keys_db >= -15) & (keys_db <= -1) & (db(organ_synth / np.maximum(piano, 1e-30)) >= 6)
    if not ok.any():
        return None
    best = int(np.argmax(np.where(ok, organ_synth, -1.0)))
    return {
        "start_s": int(starts[best] // RATE),
        "keys_db": round(float(keys_db[best]), 2),
        "organ_synth_db": round(float(db(organ_synth[best] / mix_e[best])), 2),
        "piano_part_db": round(float(db(piano[best] / mix_e[best])), 2),
    }


def stereo(mono: np.ndarray) -> np.ndarray:
    return np.repeat(mono[:, None], 2, axis=1).astype(np.float32)


def cmd_windows(args: argparse.Namespace) -> int:
    source = Path(args.source).expanduser()
    root = Path(args.root).expanduser()
    candidates: list[tuple[str, dict[str, Any], dict[str, np.ndarray]]] = []
    for folder in sorted(p for p in source.iterdir() if (p / "metadata.yaml").is_file()):
        parts = load_track(folder)
        window = best_window(parts)
        print(f"{folder.name}: {window}", flush=True)
        if window is not None:
            candidates.append((folder.name, window, parts))
    candidates.sort(key=lambda c: (-c[1]["organ_synth_db"], c[0]))
    items: dict[str, Any] = {}
    for track, window, parts in candidates[:COUNT]:
        clip = f"{track}-keys"
        start = window["start_s"] * RATE
        cut = {k: a[start : start + WINDOW_S * RATE] for k, a in parts.items()}
        refs = {
            "piano": cut.get("organ_synth", 0) + cut.get("keys_piano", 0),
            **{k: cut[k] for k in ("bass", "drums", "guitar", "other") if k in cut},
        }
        folder = root / clip
        folder.mkdir(parents=True, exist_ok=True)
        sf.write(
            str(folder / "mixture.wav"),
            stereo(np.sum(list(cut.values()), axis=0)),
            RATE,
            subtype="FLOAT",
        )  # pyright: ignore[reportUnknownMemberType]
        for name, audio in refs.items():
            sf.write(str(folder / f"{name}.wav"), stereo(np.asarray(audio)), RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
        (root / "clips").mkdir(exist_ok=True)
        (root / "clips" / f"{clip}.json").write_text(
            json.dumps({"track": track, **window}) + "\n", encoding="utf-8"
        )
        items[clip] = {"track": track, **window}
        print(f"-> {clip} {window}", flush=True)
    (root / "windows.json").write_text(
        json.dumps({"items": items}, indent=2) + "\n", encoding="utf-8"
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    sub = p.add_subparsers(dest="command", required=True)
    w = sub.add_parser("windows", help="pick and cut the windows")
    w.add_argument("--source", default=str(SOURCE))
    w.add_argument("--root", default=str(ROOT))
    w.set_defaults(fn=cmd_windows)
    args = p.parse_args(argv)
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
