"""Cold vs warm wall time of decode and beats in real island processes (on the Mac).

    uv run python scripts/bench_stages.py SONG [--runs 4]

Cold = the first call in a fresh island process (imports, model load, MPS warm-up included);
warm = the following calls in the same process. Every decode starts from an empty cache, so it
always includes the FLAC encode. Beats runs final0 on MPS and final0/small0 on CPU. Uses the
island venvs (`uv sync --project islands/<name>` first).
"""

from __future__ import annotations

import argparse
import statistics
import tempfile
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

from splitune_ml_core.islands import IslandProcess, island_env, island_python
from splitune_ml_core.stage_api import StageJob

ANALYSIS = "00000000-0000-0000-0000-000000000000"
TIMEOUT_S = 900


def job(
    stage: str, work: Path, cache: Path, params: dict[str, Any], **extra: Any
) -> dict[str, Any]:
    return StageJob(
        stage=stage,
        analysis_id=ANALYSIS,
        user_id="bench",
        artefact_version=1,
        params=params,
        workdir=str(work),
        cache_dir=str(cache),
        **extra,
    ).model_dump(mode="json")


def describe(
    island: str, stage: str, params: dict[str, Any], env: dict[str, str]
) -> dict[str, Any]:
    """Effective params from a throwaway process, so the measured process starts cold."""
    process = IslandProcess(island, island_python(island), island_env(island, env))
    try:
        return process.call("describe", {"stage": stage, "params": params}, TIMEOUT_S)
    finally:
        process.close()


def measure(
    island: str, env: dict[str, str], runs: int, make_job: Callable[[int], dict[str, Any]]
) -> tuple[list[float], dict[str, Any]]:
    process = IslandProcess(island, island_python(island), island_env(island, env))
    times: list[float] = []
    result: dict[str, Any] = {}
    try:
        for i in range(runs):
            started = time.perf_counter()
            result = process.call("run", {"job": make_job(i)}, TIMEOUT_S)
            times.append(time.perf_counter() - started)
    finally:
        process.close()
    return times, result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("song", type=Path)
    parser.add_argument("--runs", type=int, default=4)
    args = parser.parse_args()
    source = args.song.resolve()
    rows: list[tuple[str, list[float]]] = []
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        decode_params = describe("onnx-cpu", "decode", {}, {})["params"]
        times, decoded = measure(
            "onnx-cpu",
            {},
            args.runs,
            lambda i: job(
                "decode", work, work / f"cache-{i}", decode_params, inputs={"source": str(source)}
            ),
        )
        rows.append(("decode (ffprobe, f32le + sha256, loudness, FLAC)", times))
        facts = decoded["facts"]

        for label, device, model in [
            ("beats final0, MPS", "auto", "final0"),
            ("beats final0, CPU", "cpu", "final0"),
            ("beats small0, CPU", "cpu", "small0"),
        ]:
            env = {"ML_TORCH_DEVICE": device}
            params = describe("torch", "beats", {"model": model}, env)["params"]
            times, result = measure(
                "torch",
                env,
                args.runs,
                lambda _i, params=params: job(
                    "beats",
                    work,
                    work,
                    params,
                    inputs={},
                    audio_hash=facts["audio_hash"],
                    duration_s=facts["duration_s"],
                    decoded_path=facts["decoded_path"],
                ),
            )
            rows.append((f"{label} ({result['status']})", times))

    print(f"audio: {facts['duration_s']:.1f} s ({args.song.name}), {args.runs} runs per row")
    print("| Stage | Cold (s) | Warm median (s) | Warm runs (s) |")
    print("|---|---|---|---|")
    for label, times in rows:
        warm = times[1:]
        print(
            f"| {label} | {times[0]:.2f} | {statistics.median(warm):.2f} | "
            f"{', '.join(f'{t:.2f}' for t in warm)} |"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
