"""hFT-Transformer (sony/hFT-Transformer, MAESTRO-V3 checkpoint) on a list of audio files (step 26).

    uv run --no-sync python eval/hft_amt.py REPO JOBS.json

REPO is a checkout of github.com/sony/hFT-Transformer with its release `checkpoint.zip` unpacked
(`checkpoint/MAESTRO-V3/model_016_003.pkl`); the checkpoint is a pickled module, so the repo's
`model` package must be importable. Features follow `AMT.wav2feature` (mono, 16 kHz, log-mel 256),
with audio read by soundfile instead of torchaudio's loader; notes come from the 2nd (combination)
output with the repo's evaluation thresholds (0.5), as `evaluation/m_inference.py` does. JOBS.json
is a list of [audio path, MIDI path]; each MIDI gets a `.json` with the wall time.
"""

# The repo is untyped and not a dependency.
# pyright: reportMissingImports=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
import torch
import torchaudio  # pyright: ignore[reportMissingTypeStubs]
from scipy.signal import resample_poly  # pyright: ignore[reportMissingTypeStubs]


def feature(amt: Any, path: str) -> Any:
    data, sr = sf.read(path, dtype="float32", always_2d=True)
    mono = np.asarray(data.mean(axis=1), dtype=np.float32)
    rate = int(amt.config["feature"]["sr"])
    wave = torch.from_numpy(np.asarray(resample_poly(mono, rate, int(sr)), dtype=np.float32))
    f = amt.config["feature"]
    mel = torchaudio.transforms.MelSpectrogram(
        sample_rate=rate,
        n_fft=f["fft_bins"],
        win_length=f["window_length"],
        hop_length=f["hop_sample"],
        pad_mode=f["pad_mode"],
        n_mels=f["mel_bins"],
        norm="slaney",
    )(wave)
    return torch.log(mel + f["log_offset"]).T


def main() -> int:
    repo = Path(sys.argv[1])
    jobs = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    sys.path.insert(0, str(repo))
    from model import amt

    config = json.loads((repo / "corpus" / "config.json").read_text(encoding="utf-8"))
    # What corpus/make_dataset.py adds to the dataset config (default -max_value 0: raw log-mel).
    config["input"]["min_value"] = float(np.log(config["feature"]["log_offset"]))
    config["input"]["max_value"] = 0.0
    config["feature"]["n_bins"] = config["feature"]["mel_bins"]
    model = amt.AMT(config, str(repo / "checkpoint" / "MAESTRO-V3" / "model_016_003.pkl"))
    for audio, midi in jobs:
        started = time.monotonic()
        with torch.no_grad():
            out = model.transcript(feature(model, audio), mode="combination")
        onset, offset, mpe, velocity = out[4:8]
        notes = model.mpe2note(
            a_onset=onset,
            a_offset=offset,
            a_mpe=mpe,
            a_velocity=velocity,
            thred_onset=0.5,
            thred_offset=0.5,
            thred_mpe=0.5,
            mode_velocity="ignore_zero",
            mode_offset="shorter",
        )
        seconds = time.monotonic() - started
        Path(midi).parent.mkdir(parents=True, exist_ok=True)
        model.note2midi(notes, midi)
        Path(midi).with_suffix(".json").write_text(json.dumps({"seconds": seconds}))
        print(f"hft {Path(audio).parent.name}: {len(notes)} notes {seconds:.1f}s", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
