"""Loud-master correctness of the shipped separation path (step 28 Phase 3).

    uv run python eval/loud_master.py run --config shipped
    uv run python eval/loud_master.py run --config ideal

On a hot master a separated stem can peak above 0 dBFS while the mixture does not (stems cancel
in the sum). Two places could then break `mixture - stem` (stem_post's `subtract` mix-minus):
audio-separator rescales any output peaking above `normalization_threshold` (1.0 in
`stage_separation.models`), and `separate.store` clips to ±1 when it writes the 24-bit FLAC cache.

Fixtures (under <root>/loud-master/, never committed):
- `xl-<clip>`: the P1 windows whose limit-XL stems peak highest (`splitune_eval.variants`);
- `mxl-<clip>`: the same windows under the official musdb-XL ratio (mixture clipped like a file);
- `synthetic`: a decaying 55 Hz bass note per beat with a shorter antiphase 55 Hz kick and hats:
  the stems peak at +5.3 and +0.7 dBFS while their sum stays at -0.5 dBFS.

`run` takes each fixture through the shipped `decode` and `separate` stages (`splitune_eval.local`)
with the drums chain, and records: every library rescale (peak before, threshold), clipped
samples per stored FLAC stem, the energy of mixture - Σ(model outputs) relative to the mixture,
and stem_post's subtract mix-minus (mixture - aligned target) against the true accompaniment
(uSDR) next to the target's own uSDR. `--config ideal` is the measurement reference: library
rescaling off and every stem cached as float, i.e. what a fix could at best recover. Since the
step 28 fix, `shipped` is the fixed code; the pre-fix run is kept as `shipped-before-fix.json`.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any, cast

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from splitune_eval import scoring, variants
from splitune_eval.local import LocalRun

ROOT = Path(os.environ.get("P1_ROOT", "~/datasets/musdb18hq-p1")).expanduser()
RESULTS = Path(__file__).resolve().parent / "results" / "sep-robust"
TARGET = "drums"
STEMS = ("vocals", "drums", "bass", "other")
FULL_SCALE = 1.0 - 2.0**-23  # the largest 24-bit sample


def read(path: Path) -> np.ndarray:
    data, _ = sf.read(str(path), dtype="float64", always_2d=True)
    return np.asarray(data, dtype=np.float64)


def write(path: Path, audio: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), audio.astype(np.float32), 44100, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]


def synthetic() -> tuple[np.ndarray, dict[str, np.ndarray]]:
    """A 55 Hz bass note on every beat with a shorter antiphase 55 Hz kick under it, plus hats:
    the kick cancels the bass attack, so after scaling the mixture to -0.5 dBFS the bass stem
    peaks at +5.3 dBFS and the drums stem at +0.7 dBFS."""
    rate, seconds = 44100, 20
    t = np.arange(rate * seconds) / rate
    beat = (t % 0.5) / 0.5
    tone = np.sin(2 * np.pi * 55 * t)
    bass = np.exp(-beat * 2) * tone
    rng = np.random.default_rng(28)
    hats = 0.03 * rng.normal(size=t.size) * np.exp(-((t + 0.25) % 0.5) * 40)
    drums = -0.6 * np.exp(-beat * 5) * tone + hats
    other = 0.05 * np.sin(2 * np.pi * 440 * t) * (beat < 0.3)
    stereo = {k: np.stack([v, v], axis=1) for k, v in {"bass": bass, "drums": drums}.items()}
    stereo["other"] = np.stack([other, 0.8 * other], axis=1)
    stereo["vocals"] = np.zeros_like(stereo["bass"])
    mixture = np.sum(list(stereo.values()), axis=0)
    scale = 0.944 / float(np.abs(mixture).max())
    return mixture * scale, {k: v * scale for k, v in stereo.items()}


def fixtures(root: Path, count: int) -> dict[str, tuple[np.ndarray, dict[str, np.ndarray]]]:
    """Fixture name → (mixture, references), built once under <root>/loud-master/fixtures/."""
    base = root / "loud-master" / "fixtures"
    if not (base / "index.json").is_file():
        index = json.loads((root / "windows.json").read_text(encoding="utf-8"))["items"]
        peaks: list[tuple[float, str]] = []
        for clip in sorted(index):
            refs = {s: read(root / clip / f"{s}.wav") for s in STEMS}
            v = variants.apply("limit-XL", read(root / clip / "mixture.wav"), refs)
            peaks.append((max(float(np.abs(a).max()) for a in v.references.values()), clip))
        chosen = [c for _, c in sorted(peaks, reverse=True)[:count]]
        out: dict[str, Any] = {}
        for clip in chosen:
            refs = {s: read(root / clip / f"{s}.wav") for s in STEMS}
            mixture = read(root / clip / "mixture.wav")
            ratio = root / clip / "xl_ratio.npy"
            for prefix, name in (("xl", "limit-XL"), ("mxl", "musdb-xl")):
                v = variants.apply(
                    name, mixture, refs, xl_ratio=lambda r=ratio: np.load(r).astype(np.float64)
                )
                folder = base / f"{prefix}-{clip}"
                write(folder / "mixture.wav", v.mixture)
                for stem, audio in v.references.items():
                    write(folder / f"{stem}.wav", audio)
                out[folder.name] = v.info
        mixture, refs = synthetic()
        write(base / "synthetic" / "mixture.wav", mixture)
        for stem, audio in refs.items():
            write(base / "synthetic" / f"{stem}.wav", audio)
        out["synthetic"] = {}
        (base / "index.json").write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    names = json.loads((base / "index.json").read_text(encoding="utf-8"))
    return {
        n: (read(base / n / "mixture.wav"), {s: read(base / n / f"{s}.wav") for s in STEMS})
        for n in names
    }


class Rescales:
    """Records audio-separator's `normalize` calls that actually rescale (peak > max_peak)."""

    def __init__(self, ideal: bool) -> None:
        from audio_separator.separator.uvr_lib_v5 import spec_utils  # pyright: ignore[reportMissingTypeStubs]

        self.events: list[dict[str, float]] = []
        original = cast(Callable[..., Any], spec_utils.normalize)  # pyright: ignore[reportUnknownMemberType]

        def normalize(wave: Any, max_peak: float = 1.0, min_peak: float | None = None) -> Any:
            peak = float(np.abs(wave).max())
            if peak > max_peak:
                self.events.append({"peak": round(peak, 4), "threshold": max_peak})
                if ideal:
                    return wave
            return original(wave, max_peak=max_peak, min_peak=min_peak)

        spec_utils.normalize = normalize


def store_float(audio: np.ndarray, base: Path) -> tuple[Path, str]:
    """`separate.store` for the ideal config: every stem as float32 WAV (nothing clipped)."""
    import hashlib

    dest = base.with_name(f"{base.name}.wav")
    dest.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(dest), audio, 44100, format="WAV", subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]
    return dest, hashlib.sha256(dest.read_bytes()).hexdigest()


def measure(
    run: LocalRun, name: str, mixture: np.ndarray, refs: dict[str, np.ndarray], rescales: Rescales
) -> dict[str, Any]:
    from splitune_ml_core import contracts
    from stage_separation import dsp

    source = run.work / "inputs" / f"{name}.wav"
    write(source, mixture)
    decoded = run.decode(source)
    before = len(rescales.events)
    out = run.run("separate", {"source": str(source)}, decoded, {"instrument": TARGET})
    separation = contracts.Separation.model_validate_json(
        Path(out.files["separation"]).read_text(encoding="utf-8")
    )
    fed = read(Path(decoded.path))
    stored = {s.name: read(run.cache / "separated" / s.file) for s in separation.stems}
    clipped = {k: int(np.sum(np.abs(v) >= FULL_SCALE)) for k, v in stored.items()}
    # The library's own outputs (after its rescaling, before the FLAC cache), every stem.
    raw_dirs = [p for p in (run.work / "jobs" / "separate" / "separated").iterdir() if p.is_dir()]
    outputs = [read(p) for d in raw_dirs for p in sorted(d.glob("*.wav"))]
    frames = len(fed)
    total = np.zeros_like(fed)
    for audio in outputs:
        total[: min(frames, len(audio))] += audio[:frames]
    target = stored[next(s.name for s in separation.stems if s.role == "target")]
    lag = dsp.alignment_lag(fed.astype(np.float32), target.astype(np.float32))
    mix_minus = fed - dsp.shift(target.astype(np.float32), lag).astype(np.float64)
    accompaniment = np.sum([v for k, v in refs.items() if k != TARGET], axis=0)
    return {
        "fixture": name,
        "model": separation.provider,
        "mixture_peak": round(float(np.abs(mixture).max()), 4),
        "mixture_clipped_by_decode": int(np.sum(np.abs(fed) >= FULL_SCALE)),
        "reference_peaks": {k: round(float(np.abs(v).max()), 3) for k, v in refs.items()},
        "rescales": rescales.events[before:],
        "stored_peaks": {k: round(float(np.abs(v).max()), 4) for k, v in stored.items()},
        "clipped_samples": clipped,
        "sum_residual_db": round(scoring.leakage_db(fed - total, fed), 2),
        "target_usdr": round(scoring.usdr(refs[TARGET], target), 2),
        "mix_minus_usdr": round(scoring.usdr(accompaniment[:frames], mix_minus), 2),
    }


def cmd_run(args: argparse.Namespace) -> int:
    from stage_separation import separate

    root = Path(args.root).expanduser()
    ideal = args.config == "ideal"
    rescales = Rescales(ideal)
    if ideal:
        separate.store = store_float
    run = LocalRun(root / "loud-master" / "work" / args.config)
    rows = [
        measure(run, name, mixture, refs, rescales)
        for name, (mixture, refs) in fixtures(root, args.count).items()
    ]
    out = root / "loud-master" / f"{args.config}.json"
    out.write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
    for r in rows:
        print(json.dumps(r), flush=True)
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--root", default=str(ROOT))
    sub = p.add_subparsers(dest="command", required=True)
    r = sub.add_parser("run")
    r.add_argument("--config", choices=("shipped", "ideal"), default="shipped")
    r.add_argument("--count", type=int, default=3, help="limited MUSDB windows")
    r.set_defaults(fn=cmd_run)
    args = p.parse_args(argv)
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
