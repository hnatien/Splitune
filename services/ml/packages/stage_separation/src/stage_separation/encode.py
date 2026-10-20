"""Browser-safe stem encodes and their verification against the PCM (05 `stems`, 06 §4 step 6).

AAC-LC 160 kb/s in MP4 is the default every browser decodes. On the Mac worker it is encoded by
AudioToolbox (`afconvert`): its files carry the iTunes gapless record (`iTunSMPB`: priming, padding,
original length), which both Chromium and WebKit honour in `decodeAudioData`, so the decoded
length is the PCM's exactly. ffmpeg's encoder is the fallback where `afconvert` is missing (Linux
CI): its sample-exact edit list is honoured by Chromium, but WebKit then keeps up to 1023 padding
samples at the end. Opus 96 kb/s in WebM is optional: WebKit decodes it exactly, Chromium 22
samples early at 44.1 kHz (measured; `services/ml/browser/decode-check.spec.ts`).

ffmpeg's own decoder trims AAC priming but not the end padding, so verification checks the length
the file declares (iTunSMPB or edit list) equals the PCM, the decode starts at offset 0, and the
decoded tail is only padding.
"""

from __future__ import annotations

import shutil
import struct
from pathlib import Path
from typing import Literal

import numpy as np
from numpy.typing import NDArray
from splitune_ml_core import ffmpeg
from splitune_ml_core.errors import StageError

from .dsp import RATE, Audio

AAC_KBPS = 160
OPUS_KBPS = 96
ENCODE_TIMEOUT_S = 120.0
AAC_FRAME = 1024
Encoder = Literal["audiotoolbox", "ffmpeg"]


def aac_encoder() -> Encoder:
    return "audiotoolbox" if shutil.which("afconvert") else "ffmpeg"


def encode_aac(wav: Path, out: Path) -> Encoder:
    encoder = aac_encoder()
    if encoder == "audiotoolbox":
        args = ["afconvert", "-f", "m4af", "-d", "aac", "-b", str(AAC_KBPS * 1000), "-s", "0"]
        args += [str(wav), str(out)]
    else:
        args = [ffmpeg.binary("ffmpeg"), "-nostdin", "-v", "error", "-y", "-i", str(wav)]
        args += ["-c:a", "aac", "-b:a", f"{AAC_KBPS}k", "-movie_timescale", str(RATE), str(out)]
    ffmpeg.run(args, ENCODE_TIMEOUT_S, "encode_failed", "encode_timeout")
    return encoder


def encode_opus(wav: Path, out: Path) -> None:
    args = [ffmpeg.binary("ffmpeg"), "-nostdin", "-v", "error", "-y", "-i", str(wav)]
    args += ["-c:a", "libopus", "-b:a", f"{OPUS_KBPS}k", "-f", "webm", str(out)]
    ffmpeg.run(args, ENCODE_TIMEOUT_S, "encode_failed", "encode_timeout")


def decode(path: Path) -> NDArray[np.float32]:
    args = [ffmpeg.binary("ffmpeg"), "-nostdin", "-v", "error", "-i", str(path)]
    args += ["-f", "f32le", "-ac", "2", "-ar", str(RATE), "-"]
    raw = ffmpeg.run(args, ENCODE_TIMEOUT_S, "encode_verification_failed", "encode_timeout")
    return np.frombuffer(raw.stdout, dtype="<f4").reshape(-1, 2)


def _boxes(data: bytes, start: int, end: int) -> dict[bytes, tuple[int, int]]:
    out: dict[bytes, tuple[int, int]] = {}
    pos = start
    while pos + 8 <= end:
        size, kind = struct.unpack(">I4s", data[pos : pos + 8])
        header = 8
        if size == 1:
            size, header = struct.unpack(">Q", data[pos + 8 : pos + 16])[0], 16
        if size < header:
            break
        out.setdefault(kind, (pos + header, pos + size))
        pos += size
    return out


def declared_frames(path: Path) -> int | None:
    """The original length an MP4 declares: iTunSMPB's, else the edit list's when the movie
    timescale is the sample rate. None when it declares neither."""
    data = path.read_bytes()
    marker = data.find(b"iTunSMPB")
    if marker >= 0:
        payload = data[marker + 8 : marker + 8 + 200]
        text = payload[payload.find(b" ") :].split(b"\0")[0].decode("ascii", "replace").split()
        if len(text) >= 4:
            return int(text[3], 16)
    moov = _boxes(data, 0, len(data)).get(b"moov")
    if moov is None:
        return None
    top = _boxes(data, *moov)
    mvhd, trak = top.get(b"mvhd"), top.get(b"trak")
    if mvhd is None or trak is None or data[mvhd[0]] != 0:
        return None
    timescale = struct.unpack(">I", data[mvhd[0] + 12 : mvhd[0] + 16])[0]
    edts = _boxes(data, *trak).get(b"edts")
    elst = _boxes(data, *edts).get(b"elst") if edts else None
    if timescale != RATE or elst is None or data[elst[0]] != 0:
        return None
    entries = struct.unpack(">I", data[elst[0] + 4 : elst[0] + 8])[0]
    if entries != 1:
        return None
    return int(struct.unpack(">I", data[elst[0] + 8 : elst[0] + 12])[0])


def start_lag(decoded: NDArray[np.float32], reference: Audio, *, search: int = 64) -> int:
    """Offset of the decode against the reference, over the loudest second of the reference."""
    ref = reference.astype(np.float64).mean(axis=1)
    dec = decoded.astype(np.float64).mean(axis=1)
    if len(ref) <= RATE + 2 * search:
        window = (search, len(ref) - search)
    else:
        blocks = (ref[: len(ref) // RATE * RATE].reshape(-1, RATE) ** 2).sum(axis=1)
        first = min(max(int(np.argmax(blocks)) * RATE, search), len(ref) - RATE - search)
        window = (first, first + RATE)
    a, b = window
    segment = ref[a:b]
    if float(np.dot(segment, segment)) < 1e-9:
        return 0  # silent stem: nothing to align, the length check still applies
    scores = [
        float(np.dot(dec[a + k : b + k], segment)) if a + k >= 0 and b + k <= len(dec) else -np.inf
        for k in range(-search, search + 1)
    ]
    return int(np.argmax(scores)) - search


def verify_aac(path: Path, reference: Audio) -> None:
    decoded = decode(path)
    padding = len(decoded) - len(reference)
    if declared_frames(path) != len(reference) or not 0 <= padding < 2 * AAC_FRAME:
        raise StageError("encode_verification_failed")
    if start_lag(decoded, reference) != 0:
        raise StageError("encode_verification_failed")


def verify_opus(path: Path, reference: Audio) -> None:
    """Opus runs at 48 kHz; the 44.1 kHz decode may round by one sample."""
    decoded = decode(path)
    if abs(len(decoded) - len(reference)) > 1 or start_lag(decoded, reference) != 0:
        raise StageError("encode_verification_failed")
