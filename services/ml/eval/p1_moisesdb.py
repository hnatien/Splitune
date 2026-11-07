"""MoisesDB windows with real guitar and piano references (step 28 Phase 6; set `moisesdb-p1`).

    uv run python eval/p1_moisesdb.py windows [--source ~/datasets/moisesdb] [--per 20]
    uv run python eval/p1_moisesdb.py windows --url        # stream the zip (MOISESDB_URL in .env)

MUSDB18-HQ has no guitar or piano stems, so P1 can only score those instruments by listening or
downstream. MoisesDB (Pereira et al., ISMIR 2023; CC BY-NC-SA 4.0; https://music.ai/research/,
download after a sign-up, so the owner fetches it) has per-instrument stems. Layout, from the
`moisesdb` package: <source>/moisesdb_v0.1/<track uuid>/data.json (artist, song, genre, stems:
[{stemName, tracks: [{id, extension, trackType}]}]) and <stemName>/<track id>.<extension>.

The full download is 88.8 GB (`moisesdb.zip`). `--url` reads it in place instead: the signed link
from the download page (in the git-ignored `.env` as MOISESDB_URL; it expires after 7 days) serves
byte ranges, so each member is streamed out of the zip and nothing but the chosen windows (~3 GB)
reaches the disk. Pass 1 scans every track (one line per track in <out>/scan.jsonl, so a rerun
resumes); pass 2 re-reads only the chosen tracks.

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
import http.client
import io
import json
import os
import struct
import sys
import time
import urllib.request
import zipfile
import zlib
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Protocol, cast

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


class Source(Protocol):
    def tracks(self) -> list[str]: ...
    def meta(self, track: str) -> dict[str, Any]: ...
    def audio(self, track: str, relative: str) -> np.ndarray: ...


def decode(data: bytes | Path) -> np.ndarray:
    """Float32 [frames, 2] at 44.1 kHz (mono duplicated, other rates resampled)."""
    raw = io.BytesIO(data) if isinstance(data, bytes) else str(data)
    samples, rate = sf.read(raw, dtype="float32", always_2d=True)  # pyright: ignore[reportUnknownMemberType]
    audio = np.asarray(samples, dtype=np.float32)
    if audio.shape[1] == 1:
        audio = np.repeat(audio, 2, axis=1)
    if int(rate) != RATE:
        audio = np.asarray(resample_poly(audio, RATE, int(rate), axis=0), dtype=np.float32)  # pyright: ignore[reportUnknownArgumentType]
    return audio[:, :2]


class LocalSource:
    """An unzipped download: <root>/<provider>/<uuid>/data.json."""

    def __init__(self, root: Path) -> None:
        self.folders = {p.parent.name: p.parent for p in root.glob("*/*/data.json")}

    def tracks(self) -> list[str]:
        return sorted(self.folders)

    def meta(self, track: str) -> dict[str, Any]:
        text = (self.folders[track] / "data.json").read_text(encoding="utf-8")
        return cast(dict[str, Any], json.loads(text))

    def audio(self, track: str, relative: str) -> np.ndarray:
        return decode(self.folders[track] / relative)


class ZipSource:
    """`moisesdb.zip` read in place over HTTP byte ranges. Only the central directory goes through
    `zipfile`; each member is then fetched as exactly its compressed bytes in one range request,
    inflated in memory and checked against its CRC (`zipfile` over a buffered HTTP stream
    re-fetched data several times over when tracks were read in parallel)."""

    def __init__(self, url: str) -> None:
        from p1_musdb import HttpRangeFile

        self.url = url
        size = int(str(self.fetch_headers(0, 0)["Content-Range"]).rsplit("/", 1)[1])
        directory = zipfile.ZipFile(io.BufferedReader(HttpRangeFile(url, 0, size)))
        self.members = {
            i.filename: i
            for i in directory.infolist()
            if not i.is_dir() and i.filename.count("/") >= 3
        }
        self.prefix = {m.split("/")[2]: "/".join(m.split("/")[:3]) for m in self.members}

    def fetch_headers(self, first: int, last: int) -> Any:
        request = urllib.request.Request(self.url, headers={"Range": f"bytes={first}-{last}"})
        with urllib.request.urlopen(request, timeout=120) as response:  # signed GET: no HEAD
            return response.headers

    def fetch(self, first: int, count: int) -> bytes:
        """`count` bytes from `first`, retried until complete (never a whole-file 200 reply)."""
        for attempt in range(8):
            request = urllib.request.Request(
                self.url, headers={"Range": f"bytes={first}-{first + count - 1}"}
            )
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    if response.status != 206:
                        raise OSError(f"range request answered {response.status}, not 206")
                    data = response.read()
                if len(data) == count:
                    return data
            except (OSError, http.client.HTTPException):
                if attempt == 7:
                    raise
            time.sleep(2 * (attempt + 1))
        raise OSError(f"incomplete range at {first}")

    def tracks(self) -> list[str]:
        return sorted(t for t, p in self.prefix.items() if f"{p}/data.json" in self.members)

    def read(self, track: str, relative: str) -> bytes:
        info = self.members[f"{self.prefix[track]}/{relative}"]
        header = self.fetch(info.header_offset, 30)
        name_len, extra_len = struct.unpack("<HH", header[26:30])
        start = info.header_offset + 30 + name_len + extra_len
        raw = self.fetch(start, info.compress_size) if info.compress_size else b""
        if info.compress_type == zipfile.ZIP_DEFLATED:
            data = zlib.decompressobj(-zlib.MAX_WBITS).decompress(raw)
        elif info.compress_type == zipfile.ZIP_STORED:
            data = raw
        else:
            raise OSError(f"unsupported compression {info.compress_type} for {info.filename}")
        if zlib.crc32(data) != info.CRC:
            raise OSError(f"CRC mismatch for {info.filename}")
        return data

    def meta(self, track: str) -> dict[str, Any]:
        return cast(dict[str, Any], json.loads(self.read(track, "data.json")))

    def audio(self, track: str, relative: str) -> np.ndarray:
        return decode(self.read(track, relative))


def stem_files(meta: dict[str, Any]) -> Iterator[tuple[str, str]]:
    """(stemName, path relative to the track folder) of every recorded track."""
    for stem in meta["stems"]:
        name = str(stem["stemName"])
        for track in stem["tracks"]:
            yield name, f"{name}/{track['id']}.{track['extension']}"


def add(total: np.ndarray | None, audio: np.ndarray) -> np.ndarray:
    if total is None:
        return audio.copy()
    n = max(len(total), len(audio))
    out = np.pad(total, ((0, n - len(total)), (0, 0)))
    out[: len(audio)] += audio
    return out


def grouped(source: Source, track: str, meta: dict[str, Any]) -> dict[str, np.ndarray]:
    """The P1 stems of one track: vocals, drums, bass, guitar, piano and other (the rest)."""
    sums: dict[str, np.ndarray | None] = {k: None for k in (*NAMED, "other")}
    for name, relative in stem_files(meta):
        group = next((g for g, names in NAMED.items() if name in names), "other")
        sums[group] = add(sums[group], source.audio(track, relative))
    frames = max(len(a) for a in sums.values() if a is not None)
    return {
        k: np.pad(a, ((0, frames - len(a)), (0, 0))) if a is not None else np.zeros((frames, 2))
        for k, a in sums.items()
    }


def best_window(target: np.ndarray, mixture: np.ndarray) -> tuple[int, float] | None:
    """(start frame, level dB vs the mixture) of the loudest-target 30 s window."""
    size, hop = int(SECONDS * RATE), int(HOP_S * RATE)
    if len(mixture) < size:
        return None
    t = np.concatenate([[0.0], np.cumsum(np.sum(np.square(target, dtype=np.float64), axis=1))])
    m = np.concatenate([[0.0], np.cumsum(np.sum(np.square(mixture, dtype=np.float64), axis=1))])
    best: tuple[int, float] | None = None
    for start in range(0, len(mixture) - size + 1, hop):
        mix = m[start + size] - m[start]
        if mix <= 0:
            continue
        level = 10 * float(np.log10(max(t[start + size] - t[start], 1e-30) / mix))
        if best is None or level > best[1]:
            best = (start, level)
    return best


def scan(source: Source, track: str) -> dict[str, Any]:
    """Pass 1 for one track: each target's best window, keeping only running sums in memory."""
    meta = source.meta(track)
    mixture: np.ndarray | None = None
    targets: dict[str, np.ndarray | None] = {t: None for t in TARGETS}
    for name, relative in stem_files(meta):
        audio = source.audio(track, relative)
        mixture = add(mixture, audio)
        for target in TARGETS:
            if name in NAMED[target]:
                targets[target] = add(targets[target], audio)
    row: dict[str, Any] = {"track": track}
    for target in TARGETS:
        part = targets[target]
        found = best_window(part, cast(np.ndarray, mixture)) if part is not None else None
        row[target] = [found[0], round(found[1], 3)] if found is not None else None
    return row


def cmd_windows(args: argparse.Namespace) -> int:
    out = Path(args.out).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    source: Source
    if args.url:
        from dotenv import dotenv_values

        env = Path(__file__).resolve().parents[3] / ".env"
        url = os.environ.get("MOISESDB_URL") or dotenv_values(env).get("MOISESDB_URL")
        if not url:
            sys.exit("MOISESDB_URL is not set (the signed link from the MoisesDB download page)")
        source = ZipSource(url)
        origin = "moisesdb.zip (streamed)"
    else:
        source = LocalSource(Path(args.source).expanduser())
        origin = str(Path(args.source).expanduser())
    tracks = source.tracks()
    if not tracks:
        sys.exit("no MoisesDB tracks found (expected <provider>/<uuid>/data.json)")
    log = out / "scan.jsonl"
    rows = (
        {
            json.loads(line)["track"]: json.loads(line)
            for line in log.read_text("utf-8").splitlines()
        }
        if log.is_file()
        else {}
    )
    todo = [t for t in tracks if t not in rows]
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        futures = {pool.submit(scan, source, t): t for t in todo}
        for future in as_completed(futures):
            row = future.result()
            rows[row["track"]] = row
            with log.open("a", encoding="utf-8", newline="\n") as f:
                f.write(json.dumps(row) + "\n")
            print(f"{len(rows)}/{len(tracks)} {row['track']}: scanned", flush=True)
    index: dict[str, Any] = {"source": origin, "seconds": SECONDS, "items": {}}
    (out / "clips").mkdir(parents=True, exist_ok=True)
    size = int(SECONDS * RATE)
    for target in TARGETS:
        candidates = [
            (r[target][1], t, r[target][0])
            for t, r in rows.items()
            if r[target] is not None and r[target][1] >= MIN_LEVEL_DB
        ]
        for level, track, start in sorted(candidates, key=lambda c: (-c[0], c[1]))[: args.per]:
            clip = f"{track[:8]}-{target}"
            meta = source.meta(track)
            folder = out / clip
            if not (folder / "mixture.wav").is_file():
                stems = grouped(source, track, meta)
                mixture = np.sum(list(stems.values()), axis=0)
                folder.mkdir(parents=True, exist_ok=True)
                for name, audio in {**stems, "mixture": mixture}.items():  # mixture last: done
                    window = audio[start : start + size].astype(np.float32)
                    sf.write(str(folder / f"{name}.wav"), window, RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
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


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    sub = p.add_subparsers(dest="command", required=True)
    w = sub.add_parser("windows", help="guitar/piano windows with real references")
    w.add_argument("--source", default="~/datasets/moisesdb", help="an unzipped download")
    w.add_argument("--url", action="store_true", help="stream moisesdb.zip from MOISESDB_URL")
    w.add_argument("--out", default="~/datasets/moisesdb-p1")
    w.add_argument("--per", type=int, default=20, help="windows per target")
    w.add_argument("--jobs", type=int, default=4, help="tracks scanned in parallel")
    w.set_defaults(fn=cmd_windows)
    args = p.parse_args(argv)
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
