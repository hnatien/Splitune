"""Encodes test stems with the shipped encoder for the browser decode check.

    uv run python scripts/decode_fixtures.py OUT_DIR

Writes `<name>.m4a` and `<name>.webm` (stage_separation.encode, the code stem_post runs), the PCM
they were made from as interleaved float32 `<name>.f32`, and `expected.json`. Lengths are chosen
off the AAC frame grid on purpose: priming and padding are what the check is about.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from stage_separation import encode

RATE = 44100
LENGTHS = {"odd-3s": 3 * RATE + 1, "mid-5s": 5 * RATE - 517, "grid-2s": 1024 * 86}


def signal(frames: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    t = np.arange(frames) / RATE
    left = 0.2 * np.sin(2 * np.pi * 220 * t) * (1 + np.sin(2 * np.pi * 1.5 * t)) + 0.03 * (
        rng.standard_normal(frames)
    )
    return np.stack([left, 0.7 * np.roll(left, 31)], axis=1).astype(np.float32)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("out")
    out = Path(parser.parse_args().out)
    out.mkdir(parents=True, exist_ok=True)
    expected: dict[str, object] = {"aac_encoder": encode.aac_encoder(), "files": []}
    files: list[dict[str, object]] = []
    for seed, (name, frames) in enumerate(LENGTHS.items()):
        audio = signal(frames, seed)
        wav = out / f"{name}.wav"
        sf.write(str(wav), audio, RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
        audio.tofile(out / f"{name}.f32")
        encode.encode_aac(wav, out / f"{name}.m4a")
        encode.verify_aac(out / f"{name}.m4a", audio)
        encode.encode_opus(wav, out / f"{name}.webm")
        encode.verify_opus(out / f"{name}.webm", audio)
        wav.unlink()
        for codec, ext in (("aac", "m4a"), ("opus", "webm")):
            files.append(
                {"file": f"{name}.{ext}", "codec": codec, "frames": frames, "pcm": f"{name}.f32"}
            )
    expected["files"] = files
    (out / "expected.json").write_text(json.dumps(expected, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
