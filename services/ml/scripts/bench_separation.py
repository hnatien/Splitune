"""Time and memory of each separation model on one song, on the Mac (MPS), feeding P4.

    uv run python scripts/bench_separation.py SONG.wav [--model M ...] [--device mps|cpu]

Each model runs in a fresh process of the torch island venv: "cold" = weights verification +
load + first separation (what the first `separate` job after a worker start pays), "warm" = a
second separation in the same process. Memory: peak MPS driver allocation sampled every 0.2 s
and the process's peak resident set (unified memory: the two overlap).
"""

from __future__ import annotations

import argparse
import json
import os
import resource
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from splitune_ml_core.islands import island_python

MODELS = [
    "htdemucs_6s",
    "htdemucs_ft",
    "bs_roformer_sw",
    "bs_roformer_viperx_1297",
    "mel_roformer_kim_vocals",
]


def one(model: str, song: Path) -> dict[str, float]:
    """Runs inside the island interpreter (`--one`)."""
    from stage_separation import config, models

    spec = config.load().models[model]
    with tempfile.TemporaryDirectory() as tmp:
        started = time.monotonic()
        cold = models.separate(model, spec, song, Path(tmp) / "cold")
        cold_s = time.monotonic() - started
        warm = models.separate(model, spec, song, Path(tmp) / "warm")
    rss_mb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 2**20  # bytes on macOS
    return {
        "cold_s": round(cold_s, 2),
        "cold_separate_s": round(cold.seconds, 2),
        "warm_s": round(warm.seconds, 2),
        "peak_mps_mb": round(max(cold.peak_mb, warm.peak_mb)),
        "peak_rss_mb": round(rss_mb),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("song")
    parser.add_argument("--model", action="append", choices=MODELS)
    parser.add_argument("--device", choices=["mps", "cpu"], default="mps")
    parser.add_argument("--one", help=argparse.SUPPRESS)
    args = parser.parse_args()
    song = Path(args.song).expanduser().resolve()
    if args.one:
        print(json.dumps(one(args.one, song)))
        return 0
    import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]

    duration = float(sf.info(str(song)).duration)  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]
    env = {**os.environ, "ML_TORCH_DEVICE": "cpu" if args.device == "cpu" else "auto"}
    print(f"song {song.name}: {duration:.1f} s, device {args.device}")
    print(
        "| Model | Cold (load + run) s | Warm s | x realtime (warm) | Peak MPS MB | Peak RSS MB |"
    )
    print("|---|---:|---:|---:|---:|---:|")
    for model in args.model or MODELS:
        out = subprocess.run(
            [str(island_python("torch")), __file__, str(song), "--one", model],
            env=env,
            capture_output=True,
            text=True,
            check=True,
        )
        r = json.loads(out.stdout.strip().splitlines()[-1])
        print(
            f"| {model} | {r['cold_s']} | {r['warm_s']} | {duration / r['warm_s']:.1f} "
            f"| {r['peak_mps_mb']} | {r['peak_rss_mb']} |",
            flush=True,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
