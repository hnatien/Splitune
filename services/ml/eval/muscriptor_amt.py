"""MuScriptor (Kyutai, arXiv 2607.08168) on a list of audio files, piano family only (step 26).

    D:/venvs/muscriptor/Scripts/python.exe eval/muscriptor_amt.py WEIGHTS_DIR JOBS.json

Runs in its own venv (`pip install git+https://github.com/muscriptor/muscriptor.git` + CUDA torch):
it isn't on PyPI and pins its own torch. WEIGHTS_DIR holds `model.safetensors` + `config.json`
(the gated `MuScriptor/muscriptor-<size>` files, or the byte-identical ungated mirror
`AEmotionStudio/muscriptor-models`). The model decodes every instrument it hears (no constraint:
telling it "piano only" makes it write the band as piano); the notes of GM programs 0-7 are kept.
It predicts no velocity, so every note keeps the writer's default. JOBS.json is a list of
[audio path, MIDI path]; each MIDI gets a `.json` with the wall time.
"""

# muscriptor is untyped and only installed in its own venv.
# pyright: reportMissingImports=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false

from __future__ import annotations

import io
import json
import sys
import time
from pathlib import Path

import pretty_midi
from muscriptor.transcription_model import TranscriptionModel

PIANO_PROGRAMS = range(8)


def main() -> int:
    weights = Path(sys.argv[1]) / "model.safetensors"
    jobs = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    model = TranscriptionModel.load_model(weights)
    for audio, midi in jobs:
        started = time.monotonic()
        data, _grid = model.transcribe_and_postprocess(audio)
        seconds = time.monotonic() - started
        out = pretty_midi.PrettyMIDI(io.BytesIO(data))
        out.instruments = [
            i for i in out.instruments if not i.is_drum and i.program in PIANO_PROGRAMS
        ]
        Path(midi).parent.mkdir(parents=True, exist_ok=True)
        out.write(midi)
        Path(midi).with_suffix(".json").write_text(json.dumps({"seconds": seconds}))
        notes = sum(len(i.notes) for i in out.instruments)
        print(f"muscriptor {Path(audio).parent.name}: {notes} notes {seconds:.1f}s", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
