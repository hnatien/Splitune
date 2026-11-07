"""MoisesDB windows with real guitar and piano references (step 28 Phase 6; set `moisesdb-p1`).

    uv run python eval/p1_moisesdb.py windows [--source ~/datasets/moisesdb] [--per 20]

MUSDB18-HQ has no guitar or piano stems, so P1 can only score those instruments by listening or
downstream. MoisesDB (Pereira et al., ISMIR 2023; CC BY-NC-SA 4.0; https://music.ai/research/,
download after a sign-up, so the owner fetches it) has per-instrument stems. Layout, from the
`moisesdb` package: <source>/moisesdb_v0.1/<track uuid>/data.json (artist, song, genre, stems:
[{stemName, tracks: [{id, extension, trackType}]}]) and <stemName>/<track id>.<extension>.

For every track and target (guitar; piano = `piano` + `other_keys`, since the models' piano output
takes organs and synth keys too) the 30 s window (5 s hop) where the target's stem is loudest
relative to the mixture is a candidate when that level is at least -15 dB; the `--per` loudest
candidates per target are kept (ties by track id), each track once per target. The selection reads
only references, never a model. Each window is written like a P1 window:
<out>/<uuid8>-<target>/{mixture,vocals,drums,bass,guitar,piano,other}.wav (float, 44.1 kHz
stereo; mixture = sum of every stem; other = everything not named), plus <out>/windows.json and the
marker <out>/clips/<id>.json the set `moisesdb-p1` globs, so the set has no items (and every
consumer skips it) until this has run. `eval/sep_matrix.py --root <out>` runs the robustness matrix
on it with guitar and piano scored against these references.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, cast

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from scipy.signal import resample_poly  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]

RATE = 44100
SECONDS = 30.0
HOP_S = 5.0
MIN_LEVEL_DB = -15.0
NAMED: dict[str, tuple[str, ...]] = {
    "vocals": ("vocals",),
    "drums": ("drums",),
    "bass": ("bass",),
    "guitar": ("guitar",),
    "piano": ("piano", "other_keys"),
}
TARGETS = ("guitar", "piano")


def load(path: Path) -> np.ndarray:
    data, rate = sf.read(str(path), dtype="float64", always_2d=True)
    audio = np.asarray(data, dtype=np.float64)
    if audio.shape[1] == 1:
        audio = np.repeat(audio, 2, axis=1)
    if int(rate) != RATE:
        audio = np.asarray(resample_poly(audio, RATE, int(rate), axis=0), dtype=np.float64)  # pyright: ignore[reportUnknownArgumentType]
    return audio[:, :2]


def track_stems(folder: Path) -> dict[str, np.ndarray]:
    """stemName → the sum of its tracks."""
    meta = cast(dict[str, Any], json.loads((folder / "data.json").read_text(encoding="utf-8")))
    stems: dict[str, np.ndarray] = {}
    for stem in meta["stems"]:
        name = str(stem["stemName"])
        for track in stem["tracks"]:
            audio = load(folder / name / f"{track['id']}.{track['extension']}")
            if name in stems:
                n = max(len(stems[name]), len(audio))
                stems[name] = np.pad(stems[name], ((0, n - len(stems[name])), (0, 0)))
                stems[name][: len(audio)] += audio
            else:
                stems[name] = audio
    return stems


def grouped(stems: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    """The P1 stems: vocals, drums, bass, guitar, piano and other (everything else)."""
    frames = max(len(a) for a in stems.values())
    padded = {k: np.pad(v, ((0, frames - len(v)), (0, 0))) for k, v in stems.items()}
    out = {
        target: np.sum([padded[s] for s in names if s in padded] or [np.zeros((frames, 2))], axis=0)
        for target, names in NAMED.items()
    }
    used = {s for names in NAMED.values() for s in names}
    out["other"] = np.sum(
        [v for k, v in padded.items() if k not in used] or [np.zeros((frames, 2))], axis=0
    )
    return out


def best_window(target: np.ndarray, mixture: np.ndarray) -> tuple[int, float] | None:
    """(start frame, level dB vs the mixture) of the loudest-target 30 s window."""
    size, hop = int(SECONDS * RATE), int(HOP_S * RATE)
    if len(mixture) < size:
        return None
    t = np.concatenate([[0.0], np.cumsum(np.sum(target**2, axis=1))])
    m = np.concatenate([[0.0], np.cumsum(np.sum(mixture**2, axis=1))])
    best: tuple[int, float] | None = None
    for start in range(0, len(mixture) - size + 1, hop):
        mix = m[start + size] - m[start]
        if mix <= 0:
            continue
        level = 10 * float(np.log10(max(t[start + size] - t[start], 1e-30) / mix))
        if best is None or level > best[1]:
            best = (start, level)
    return best


def cmd_windows(args: argparse.Namespace) -> int:
    source = Path(args.source).expanduser()
    out = Path(args.out).expanduser()
    folders = sorted(p.parent for p in source.glob("*/*/data.json"))
    if not folders:
        sys.exit(f"no MoisesDB tracks under {source} (expected */<uuid>/data.json)")
    candidates: dict[str, list[tuple[float, str, int]]] = {t: [] for t in TARGETS}
    for folder in folders:
        stems = grouped(track_stems(folder))
        mixture = np.sum(list(stems.values()), axis=0)
        for target in TARGETS:
            found = best_window(stems[target], mixture)
            if found is not None and found[1] >= MIN_LEVEL_DB:
                candidates[target].append((found[1], folder.name, found[0]))
        print(f"{folder.name}: scanned", flush=True)
    index: dict[str, Any] = {"source": str(source), "seconds": SECONDS, "items": {}}
    (out / "clips").mkdir(parents=True, exist_ok=True)
    for target in TARGETS:
        chosen = sorted(candidates[target], key=lambda c: (-c[0], c[1]))[: args.per]
        for level, track, start in chosen:
            clip = f"{track[:8]}-{target}"
            stems = grouped(track_stems(source_folder(folders, track)))
            mixture = np.sum(list(stems.values()), axis=0)
            size = int(SECONDS * RATE)
            for name, audio in {"mixture": mixture, **stems}.items():
                dest = out / clip / f"{name}.wav"
                dest.parent.mkdir(parents=True, exist_ok=True)
                sf.write(
                    str(dest), audio[start : start + size].astype(np.float32), RATE, subtype="FLOAT"
                )  # pyright: ignore[reportUnknownMemberType]
            meta = json.loads((source_folder(folders, track) / "data.json").read_text("utf-8"))
            entry = {
                "track": f"{meta.get('artist', '')} - {meta.get('song', '')}",
                "uuid": track,
                "genre": meta.get("genre", ""),
                "target": target,
                "start_s": round(start / RATE, 3),
                "duration_s": SECONDS,
                "level_db": round(level, 2),
            }
            index["items"][clip] = entry
            (out / "clips" / f"{clip}.json").write_text(json.dumps(entry) + "\n", "utf-8")
            print(f"{target:6} {clip} {level:.1f} dB", flush=True)
    (out / "windows.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    return 0


def source_folder(folders: list[Path], track: str) -> Path:
    return next(f for f in folders if f.name == track)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    sub = p.add_subparsers(dest="command", required=True)
    w = sub.add_parser("windows", help="guitar/piano windows with real references")
    w.add_argument("--source", default="~/datasets/moisesdb")
    w.add_argument("--out", default="~/datasets/moisesdb-p1")
    w.add_argument("--per", type=int, default=20, help="windows per target")
    w.set_defaults(fn=cmd_windows)
    args = p.parse_args(argv)
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
