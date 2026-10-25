"""Aria-AMT on a list of audio files, one process, no multiprocessing (step 24 Phase 5).

    D:/venvs/aria/Scripts/python.exe eval/aria_amt.py CHECKPOINT JOBS.json

Aria-AMT's own batch driver asserts a POSIX OS; this runs its `transcribe_file` with a stand-in
task queue whose `put` decodes the segment at once (`process_segments`, batch 1), then saves the
token sequence as MIDI the way its `process_file` does. Runs in its own venv (Python 3.11,
torch 2.5 + CUDA, `pip install -e` of github.com/EleutherAI/aria-amt): the ML workspace can't
install it (`torchaudio<=2.5`). Audio is read with soundfile instead of torchaudio's FFmpeg
StreamReader (which needs FFmpeg 4-6 shared libraries), cut into the same strided 30 s chunks.
JOBS.json is a list of [audio path, MIDI path].
"""

# The aria-amt package is untyped and only installed in its own venv.
# pyright: reportMissingImports=false, reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false, reportUnknownParameterType=false, reportMissingParameterType=false

from __future__ import annotations

import json
import logging
import sys
import time
from pathlib import Path
from typing import Any

import soundfile as sf
import torch
import torchaudio
from amt.audio import AudioTransform
from amt.config import load_config, load_model_config
from amt.inference import transcribe as aria
from amt.inference.model import AmtEncoderDecoder, ModelConfig
from amt.tokenizer import AmtTokenizer
from amt.utils import _load_weight


def wav_segments(
    audio_path: str,
    stride_factor: int | None = None,
    pad_last: bool = False,
    segment: Any = None,
) -> Any:
    """amt.data.get_wav_segments for a whole file, from memory: mono, 16 kHz, chunk_len windows
    every chunk_len / stride_factor, the last one zero-padded."""
    config = load_config()
    rate = config["audio"]["sample_rate"]
    chunk = int(rate * config["audio"]["chunk_len"])
    stride = chunk // (stride_factor or config["data"]["stride_factor"])
    data, orig = sf.read(audio_path, dtype="float32", always_2d=True)
    wav = torchaudio.functional.resample(torch.from_numpy(data.mean(axis=1)), orig, rate)
    # A file of one chunk or less would be a single segment, and transcribe_file keeps only the
    # part before the next chunk's overlap (~20 s): trailing silence sends every file through
    # the strided path a full song takes.
    wav = torch.nn.functional.pad(wav, (0, chunk))
    if len(wav) <= chunk:
        yield torch.nn.functional.pad(wav, (0, chunk - len(wav))) if pad_last else wav
        return
    buffer = torch.tensor([], dtype=torch.float32)
    for start in range(0, len(wav), stride):
        piece = torch.nn.functional.pad(
            wav[start : start + stride], (0, max(0, stride - len(wav[start : start + stride])))
        )
        buffer = torch.cat((buffer if len(buffer) < chunk else buffer[stride:], piece))
        if len(buffer) == chunk:
            yield buffer
    if pad_last and len(buffer) > stride:
        yield torch.nn.functional.pad(buffer[stride:], (0, chunk - len(buffer[stride:])))


class InlineQueue:
    """`put` runs the GPU step immediately and leaves the result where transcribe_file looks."""

    def __init__(self, model: Any, transform: Any, tokenizer: Any, results: dict[int, Any]):
        self.model, self.transform, self.tokenizer, self.results = (
            model,
            transform,
            tokenizer,
            results,
        )
        self.log = logging.getLogger("aria")

    def put(self, task: Any) -> None:
        (result,) = aria.process_segments(
            tasks=[task],
            model=self.model,
            audio_transform=self.transform,
            tokenizer=self.tokenizer,
            logger=self.log,
        )
        self.results[task[1]] = result


def load(checkpoint: str) -> Any:
    tokenizer = AmtTokenizer()
    config = ModelConfig(**load_model_config("medium-double"))
    config.set_vocab_size(tokenizer.vocab_size)
    model = AmtEncoderDecoder(config)
    state = _load_weight(ckpt_path=checkpoint)
    model.load_state_dict({k.removeprefix("_orig_mod."): v for k, v in state.items()})
    model.decoder.setup_cache(
        batch_size=1,
        max_seq_len=aria.MAX_BLOCK_LEN,
        dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float,
    )
    return model.cuda().eval()


def main() -> int:
    checkpoint, jobs_path = sys.argv[1], sys.argv[2]
    aria.get_wav_segments = wav_segments
    jobs = json.loads(Path(jobs_path).read_text(encoding="utf-8"))
    model = load(checkpoint)
    tokenizer = AmtTokenizer()
    results: dict[int, Any] = {}
    queue = InlineQueue(model, AudioTransform().cuda(), tokenizer, results)
    for audio, midi in jobs:
        if Path(midi).is_file():
            continue
        started = time.monotonic()
        seq = aria.transcribe_file(
            file_path=audio, gpu_task_queue=queue, results_dict=results, pid=0
        )
        onsets = [tok[1] for tok in seq if isinstance(tok, tuple) and tok[0] == "onset"]
        Path(midi).parent.mkdir(parents=True, exist_ok=True)
        if onsets:
            mid = tokenizer.detokenize(tokenized_seq=seq, len_ms=max(1, max(onsets)))
            mid.remove_redundant_pedals()
            mid.to_midi().save(midi)
        else:
            Path(midi).with_suffix(".empty").write_text("", encoding="utf-8")
        seconds = time.monotonic() - started
        Path(midi).with_suffix(".json").write_text(json.dumps({"seconds": seconds}))
        print(f"aria {audio}: {seconds:.1f}s", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
