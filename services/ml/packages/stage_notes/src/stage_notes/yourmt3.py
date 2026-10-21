"""YourMT3+ (YPTF.MoE+Multi, PS) behind `NoteTranscriber`: the P2 candidate (torch island, MPS).

The inference code is the HF space's `amt/src` (GPL-3.0) and lives with the checkpoint under
`<ML_MODELS_DIR>/yourmt3/` (`src/` + `logs/ymt3/<exp>/checkpoints/model.ckpt` → `../model.ckpt`),
outside the repository; `scripts/fetch_models.py yourmt3` installs both. The model decodes tokens
autoregressively and reports no per-note score, so every note gets `confidence_raw` 1.0 and the
calibration table (fitted on P2) turns that into the measured precision.
"""

# The space's code is untyped (and not importable until _load puts it on sys.path).
# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false, reportUnknownLambdaType=false, reportMissingImports=false, reportAttributeAccessIssue=false

from __future__ import annotations

import sys
import threading
import types
from typing import Any, cast

import numpy as np
from numpy.typing import NDArray
from scipy.signal import resample_poly  # pyright: ignore[reportMissingTypeStubs]
from splitune_ml_core import contracts, register

from .transcribers import NoteEvent, models_dir, ref_for

RECORD = "yourmt3-moe"
EXPERIMENT = "mc13_256_g4_all_v7_mt3f_sqr_rms_moe_wf4_n8k2_silu_rope_rp_b80_ps2"
# The space's arguments for "YPTF.MoE+Multi (PS)" (app.py), full precision on MPS/CPU.
ARGS = [
    f"{EXPERIMENT}@model.ckpt",
    "-p", "ymt3", "-tk", "mc13_full_plus_256", "-dec", "multi-t5", "-nl", "26",
    "-enc", "perceiver-tf", "-sqr", "1", "-ff", "moe", "-wf", "4", "-nmoe", "8", "-kmoe", "2",
    "-act", "silu", "-epe", "rope", "-rp", "1", "-ac", "spec", "-hop", "300", "-atc", "1",
    "-pr", "32",
]  # fmt: skip
# GM program families per instrument (YourMT3 vocabulary: Guitar 24-31, Bass 32-39, voice 100-101).
PROGRAMS = {"guitar": list(range(24, 32)), "bass": list(range(32, 40)), "vocals": [100, 101]}
YOURMT3_DEFAULTS: dict[str, Any] = {"instrument": None, "batch": 8}


class YourMT3:
    name = "yourmt3"
    record = RECORD
    defaults = YOURMT3_DEFAULTS

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model: Any = None

    def model_ref(self) -> contracts.ModelRef:
        return ref_for(self.record, "yourmt3/yptf_moe_multi_ps")

    def _load(self) -> Any:
        with self._lock:
            if self._model is None:
                import torch

                root = models_dir() / "yourmt3"
                register.verify(register.model(self.record), root)
                sys.path.insert(0, str(root / "src"))
                # The space imports wandb at module level for training logs only.
                stub = types.ModuleType("wandb")
                stub.Table = lambda **_: None
                sys.modules.setdefault("wandb", stub)
                import config.config as cfg
                import model_helper

                cast(dict[str, Any], cfg.shared_cfg)["WANDB"]["save_dir"] = str(root / "logs")
                device = "mps" if torch.backends.mps.is_available() else "cpu"
                self._model = model_helper.load_model_checkpoint(args=ARGS, device="cpu").to(device)
            return self._model

    def transcribe(self, mono: NDArray[np.float32], params: dict[str, Any]) -> list[NoteEvent]:
        import torch

        model = self._load()  # puts the space's code on sys.path
        from utils.audio import slice_padded_array
        from utils.event2note import merge_zipped_note_events_and_ties_to_notes
        from utils.note2event import mix_notes

        rate = int(model.audio_cfg["sample_rate"])
        frames = int(model.audio_cfg["input_frames"])
        audio = np.asarray(resample_poly(mono, rate, 44100), dtype=np.float32)
        segments = slice_padded_array(audio[None, :], frames, frames)
        x = torch.from_numpy(np.asarray(segments, dtype=np.float32)).unsqueeze(1).to(model.device)
        with torch.no_grad():
            tokens, _ = model.inference_file(bsz=int(params["batch"]), audio_segments=x)
        starts = [frames * i / rate for i in range(x.shape[0])]
        channels: list[Any] = []
        for ch in range(int(model.task_manager.num_decoding_channels)):
            zipped, _, _ = model.task_manager.detokenize_list_batches(
                [t[:, ch, :] for t in tokens], starts, return_events=True
            )
            notes, _ = merge_zipped_note_events_and_ties_to_notes(zipped)
            channels.append(notes)
        wanted = set(PROGRAMS[str(params["instrument"])])
        return [
            NoteEvent(
                onset_s=float(n.onset),
                offset_s=float(max(n.offset, n.onset + 0.01)),
                pitch_midi=int(n.pitch),
                velocity=int(np.clip(n.velocity if n.velocity > 1 else 80, 1, 127)),
                confidence_raw=1.0,
            )
            for n in mix_notes(channels)
            if not n.is_drum and int(n.program) in wanted and 21 <= int(n.pitch) <= 108
        ]
