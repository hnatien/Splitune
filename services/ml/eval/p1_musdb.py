"""Prototype 1 material: 30 s windows of MUSDB18-HQ test songs, read straight out of the Zenodo zip.

    uv run python eval/p1_musdb.py windows --out ~/datasets/musdb18hq-p1 [--stem S] [--track T]
    uv run python eval/p1_musdb.py full --track "Al James - Schoolboy Facination" --out DIR
    uv run python eval/p1_musdb.py full --stems --track T1 --track T2 ... --out DIR
    uv run python eval/p1_musdb.py xl --zip musdb_XL_ratio.zip --out ~/datasets/musdb18hq-p1

`xl` cuts the official musdb-XL gain ratios (Jeon & Lee, ISMIR 2022; Zenodo record 7041331,
CC BY 4.0, `musdb_XL_ratio.zip`, md5 fa70c19c81ad65d778c5f2cf0ca80882) to the same windows as
<out>/<slug>/xl_ratio.npy, float32 [frames, 2]: musdb-XL = ratio x MUSDB18-HQ, for the mixture and
every stem alike.

MUSDB18-HQ (Zenodo record 3338373, open access, 21 GB) is read with HTTP range requests instead of
being downloaded: each member is streamed only up to the end of its window (the WAVs are deflated,
so everything before the window is decompressed and discarded). `windows` writes
<out>/<slug>/<stem>.wav (float32; all of mixture/vocals/drums/bass/other, or `--stem` ones) plus
<out>/windows.json with track, offset and duration; `full` writes one whole mixture (timing runs).
MUSDB18-HQ is licensed for research use (personal mode, 25 §3); nothing here is committed.
"""

from __future__ import annotations

import argparse
import http.client
import io
import json
import re
import struct
import sys
import time
import urllib.error
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import IO, Any, cast

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]

URL = "https://zenodo.org/records/3338373/files/musdb18hq.zip"
STEMS = ("mixture", "vocals", "drums", "bass", "other")
TIMEOUT_S = 120
RETRIES = 8


class HttpRangeFile(io.RawIOBase):
    """Seekable read-only view of `size` bytes of a remote file starting at `offset`; every read
    is one `Range` request."""

    def __init__(self, url: str, offset: int = 0, size: int | None = None) -> None:
        super().__init__()
        self._url = url
        self._offset = offset
        self._pos = 0
        if size is None:
            request = urllib.request.Request(url, method="HEAD")
            with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
                size = int(response.headers["Content-Length"]) - offset
        self._size = size

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self._pos

    def seek(self, offset: int, whence: int = io.SEEK_SET) -> int:
        base = {io.SEEK_SET: 0, io.SEEK_CUR: self._pos, io.SEEK_END: self._size}[whence]
        self._pos = max(0, base + offset)
        return self._pos

    def readinto(self, buffer: Any) -> int:
        view = memoryview(buffer).cast("B")
        count = min(len(view), self._size - self._pos)
        if count <= 0:
            return 0
        first = self._offset + self._pos
        request = urllib.request.Request(
            self._url, headers={"Range": f"bytes={first}-{first + count - 1}"}
        )
        data = b""
        for attempt in range(RETRIES):
            try:
                with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
                    data = response.read()
                break
            except http.client.IncompleteRead as exc:
                # A short read is still a valid `readinto` result; the caller asks for the rest.
                data = exc.partial
                if data:
                    break
            except urllib.error.HTTPError as exc:
                # Zenodo answers 429 when too many requests arrive; wait as told, then retry.
                if exc.code != 429 or attempt == RETRIES - 1:
                    raise
                time.sleep(float(exc.headers.get("Retry-After") or 10 * (attempt + 1)))
            except (TimeoutError, urllib.error.URLError):
                if attempt == RETRIES - 1:
                    raise
        view[: len(data)] = data
        self._pos += len(data)
        return len(data)


def open_archive(url: str = URL) -> zipfile.ZipFile:
    return zipfile.ZipFile(io.BufferedReader(HttpRangeFile(url), buffer_size=4 << 20))


def test_tracks(archive: zipfile.ZipFile) -> list[str]:
    names = {
        n.split("/")[1]
        for n in archive.namelist()
        if n.startswith("test/") and n.endswith("/mixture.wav")
    }
    return sorted(names)


def slug(track: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", track.lower()).strip("-")


class WavStream:
    """Forward-only reader for 16-bit PCM WAV members. libsndfile seeks around a file (including
    towards its end), and every backward seek on a deflated member restarts decompression from
    its first byte, so the RIFF header is parsed here and the data is only ever read forwards."""

    def __init__(self, stream: IO[bytes]) -> None:
        self._stream = stream
        riff, _, wave = struct.unpack("<4sI4s", self._exact(12))
        if riff != b"RIFF" or wave != b"WAVE":
            raise SystemExit("not a RIFF/WAVE file")
        fmt: tuple[int, ...] | None = None
        while True:
            chunk, size = struct.unpack("<4sI", self._exact(8))
            if chunk == b"fmt ":
                fmt = struct.unpack("<HHIIHH", self._exact(size)[:16])
            elif chunk == b"data":
                break
            else:
                self._exact(size + (size & 1))
        if fmt is None or fmt[0] != 1 or fmt[5] != 16:
            raise SystemExit("expected 16-bit PCM")
        self.channels, self.samplerate = fmt[1], fmt[2]
        self.frames = size // (2 * self.channels)
        self._position = 0

    def _exact(self, count: int) -> bytes:
        data = self._stream.read(count)
        if len(data) != count:
            raise SystemExit("truncated WAV member")
        return data

    def read(self, start: int, frames: int) -> np.ndarray:
        """Frames [start, start + frames) as float32 [frames, channels]; start ≥ last read end."""
        if start < self._position:
            raise ValueError("WavStream only reads forwards")
        skip = (start - self._position) * 2 * self.channels
        while skip:
            skip -= len(self._exact(min(skip, 1 << 20)))
        raw = self._exact(frames * 2 * self.channels)
        self._position = start + frames
        pcm = np.frombuffer(raw, dtype="<i2").reshape(frames, self.channels)
        return pcm.astype(np.float32) / 32768.0


def read_window(
    archive: zipfile.ZipFile, track: str, stem: str, start: int, frames: int
) -> tuple[np.ndarray, int]:
    with archive.open(f"test/{track}/{stem}.wav") as member:
        wav = WavStream(member)
        return wav.read(start, min(frames, wav.frames - start)), wav.samplerate


def track_frames(archive: zipfile.ZipFile, track: str) -> tuple[int, int]:
    with archive.open(f"test/{track}/mixture.wav") as member:
        wav = WavStream(member)
        return wav.frames, wav.samplerate


def fetch_window(
    out: Path, track: str, seconds: float, start_frac: float, stems: list[str]
) -> dict[str, Any]:
    archive = open_archive()  # one connection per worker thread
    total, rate = track_frames(archive, track)
    frames = int(seconds * rate)
    start = min(int(total * start_frac), max(0, total - frames))
    folder = out / slug(track)
    folder.mkdir(exist_ok=True)
    for stem in stems:
        if (folder / f"{stem}.wav").is_file():
            continue
        data, _ = read_window(archive, track, stem, start, frames)
        sf.write(str(folder / f"{stem}.wav"), data, rate, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    return {
        "track": track,
        "start_s": round(start / rate, 3),
        "duration_s": round(frames / rate, 3),
        "track_duration_s": round(total / rate, 3),
        "stems": sorted(p.stem for p in folder.glob("*.wav")),
    }


def cmd_windows(args: argparse.Namespace) -> int:
    out = Path(args.out).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    index_path = out / "windows.json"
    index: dict[str, Any] = (
        cast(dict[str, Any], json.loads(index_path.read_text(encoding="utf-8")))
        if index_path.is_file()
        else {"source": URL, "seconds": args.seconds, "start_frac": args.start_frac, "items": {}}
    )
    stems: list[str] = args.stem or list(STEMS)
    tracks = [
        t
        for t in args.track or test_tracks(open_archive())
        if not set(stems) <= set(index["items"].get(slug(t), {}).get("stems", []))
    ]
    # Zenodo throttles each connection (~0.4 MB/s) but not their sum.
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        futures = {
            pool.submit(fetch_window, out, t, args.seconds, args.start_frac, stems): t
            for t in tracks
        }
        failed = 0
        for future in as_completed(futures):
            try:
                entry = future.result()
            except (OSError, http.client.HTTPException) as exc:
                failed += 1
                print(f"{futures[future]}: failed ({exc}); rerun to resume", file=sys.stderr)
                continue
            index["items"][slug(futures[future])] = entry
            index_path.write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
            print(f"{entry['track']}: {entry['start_s']:.1f}s +{entry['duration_s']}s", flush=True)
    return 1 if failed else 0


def fetch_full(out: Path, track: str, stem: str) -> Path:
    archive = open_archive()  # one connection per worker thread
    total, rate = track_frames(archive, track)
    dest = out / slug(track) / f"{stem}.wav"
    if not dest.is_file():
        data, _ = read_window(archive, track, stem, 0, total)
        dest.parent.mkdir(parents=True, exist_ok=True)
        temp = dest.with_suffix(".tmp.wav")
        sf.write(str(temp), data, rate, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
        temp.replace(dest)
    return dest


def cmd_full(args: argparse.Namespace) -> int:
    """One whole mixture as <out>/<slug>.wav, or with --stems every stem of each --track as
    <out>/<slug>/<stem>.wav (resumable: finished files are skipped)."""
    out = Path(args.out).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    if not args.stems:
        archive = open_archive()
        total, rate = track_frames(archive, args.track[0])
        data, _ = read_window(archive, args.track[0], "mixture", 0, total)
        dest = out / f"{slug(args.track[0])}.wav"
        sf.write(str(dest), data, rate, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
        print(f"{dest} ({total / rate:.1f}s)")
        return 0
    jobs = [(t, s) for t in args.track for s in STEMS]
    failed = 0
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        futures = {pool.submit(fetch_full, out, t, s): (t, s) for t, s in jobs}
        for future in as_completed(futures):
            try:
                print(future.result(), flush=True)
            except (OSError, http.client.HTTPException) as exc:
                failed += 1
                print(f"{futures[future]}: failed ({exc}); rerun to resume", file=sys.stderr)
    return 1 if failed else 0


def cmd_xl(args: argparse.Namespace) -> int:
    out = Path(args.out).expanduser()
    index = cast(
        dict[str, dict[str, Any]],
        json.loads((out / "windows.json").read_text(encoding="utf-8"))["items"],
    )
    with zipfile.ZipFile(Path(args.zip).expanduser()) as archive:
        for clip, entry in sorted(index.items()):
            dest = out / clip / "xl_ratio.npy"
            if dest.is_file():
                continue
            with archive.open(f"musdb_XL_ratio/{entry['track']}.npy") as member:
                ratio = np.load(io.BytesIO(member.read()))  # [2, frames] float64
            start = round(float(entry["start_s"]) * 44100)
            frames = round(float(entry["duration_s"]) * 44100)
            window = np.ascontiguousarray(ratio[:, start : start + frames].T, dtype=np.float32)
            np.save(dest, window)
            print(f"{clip}: {window.shape[0]} frames", flush=True)
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    sub = p.add_subparsers(dest="command", required=True)
    w = sub.add_parser("windows", help="30 s windows of every test song (or --track ...)")
    w.add_argument("--out", required=True)
    w.add_argument("--seconds", type=float, default=30.0)
    w.add_argument("--start-frac", type=float, default=0.3, help="window start / track length")
    w.add_argument("--track", action="append", help="test track name (repeatable)")
    w.add_argument("--jobs", type=int, default=6, help="parallel connections")
    w.add_argument("--stem", action="append", choices=STEMS, help="only these files (repeatable)")
    w.set_defaults(fn=cmd_windows)
    f = sub.add_parser("full", help="one whole test mixture (or all stems of several songs)")
    f.add_argument("--track", action="append", required=True, help="repeatable with --stems")
    f.add_argument("--out", required=True)
    f.add_argument("--stems", action="store_true", help="every stem, one folder per track")
    f.add_argument("--jobs", type=int, default=10, help="parallel connections")
    f.set_defaults(fn=cmd_full)
    x = sub.add_parser("xl", help="musdb-XL gain ratios cut to the windows")
    x.add_argument("--zip", required=True, help="local musdb_XL_ratio.zip")
    x.add_argument("--out", required=True, help="the windows' root (has windows.json)")
    x.set_defaults(fn=cmd_xl)
    args = p.parse_args(argv)
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
