"""Hand per piano note: the PM2S hand-part model (torch island).

Model definition from PM2S (github.com/cheriell/PM2S, MIT, Copyright (c) 2022 Lele Liu): note
features (pitch one-hot, onset shift in 10 ms steps up to 4 s, duration, velocity) → convolutions
→ a bidirectional GRU → P(left hand) per note. Weights `RNNHandPartModel.pth` (Zenodo 10520196,
CC-BY-4.0) live in `<ML_MODELS_DIR>/pm2s/`, verified against the register record `pm2s-hand-part`.
Step 24 P2p: 0.927 per-note agreement with ASAP score staves on pieces PM2S never trained on, vs
0.885 for music-core's splitHands.
"""

# torch is untyped here.
# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false, reportMissingTypeStubs=false

from __future__ import annotations

import threading
from typing import Any, Literal

import numpy as np
from splitune_ml_core import contracts, register

from .transcribers import models_dir, ref_for

RECORD = "pm2s-hand-part"
RESOLUTION = 0.01  # onset shift step (s)
MAX_SHIFT = 4.0
HIDDEN = 512
Hand = Literal["left", "right"]

_lock = threading.Lock()
_model: Any = None


def model_ref() -> contracts.ModelRef:
    return ref_for(RECORD, "pm2s/hand_part")


def _network() -> Any:
    from torch import nn

    shifts = int(MAX_SHIFT / RESOLUTION) + 1
    features = 128 + shifts + 2

    def conv(cin: int, cout: int, width: int) -> list[Any]:
        return [
            nn.Conv2d(cin, cout, kernel_size=(9, width), padding=(4, 0)),
            nn.BatchNorm2d(cout),
            nn.ELU(),
            nn.Dropout(p=0.15),
        ]

    class Convs(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.conv = nn.Sequential(
                *conv(1, HIDDEN // 4, features),
                *conv(HIDDEN // 4, HIDDEN // 2, 1),
                *conv(HIDDEN // 2, HIDDEN, 1),
            )

        def forward(self, x: Any) -> Any:
            return self.conv(x.unsqueeze(1)).squeeze(3).transpose(1, 2)

    class Gru(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.grus_beat = nn.GRU(
                HIDDEN, HIDDEN, num_layers=2, batch_first=True, dropout=0.15, bidirectional=True
            )
            self.linear = nn.Linear(HIDDEN * 2, HIDDEN)

        def forward(self, x: Any) -> Any:
            return self.linear(self.grus_beat(x)[0])

    class Out(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.linear = nn.Linear(HIDDEN, 1)

        def forward(self, x: Any) -> Any:
            return self.linear(x).sigmoid()

    class HandPart(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.convs, self.gru, self.out = Convs(), Gru(), Out()

        def forward(self, x: Any) -> Any:
            return self.out(self.gru(self.convs(x))).squeeze(-1)

    return HandPart()


def _load() -> Any:
    global _model
    with _lock:
        if _model is None:
            import torch
            from splitune_ml_core.device import torch_device

            (weights,) = register.verify(register.model(RECORD), models_dir() / "pm2s")
            net = _network()
            net.load_state_dict(torch.load(str(weights), map_location="cpu"))
            _model = net.to(torch_device()).eval()
        return _model


def encode(seq: Any) -> Any:
    """PM2S's encode_note_sequence: (1, n, 4) pitch, onset, duration, velocity → features."""
    import torch
    from torch.nn import functional

    shift = seq[:, 1:, 1] - seq[:, :-1, 1]
    shift = torch.cat([torch.zeros_like(shift[:, :1]), shift], dim=1).clamp(0, MAX_SHIFT)
    classes = int(MAX_SHIFT / RESOLUTION) + 1
    return torch.cat(
        [
            functional.one_hot(seq[:, :, 0].long(), 128).float(),
            functional.one_hot(torch.round(shift / RESOLUTION).long(), classes).float(),
            seq[:, :, 2:3].float(),
            seq[:, :, 3:4].float() / 127.0,
        ],
        dim=2,
    )


def hands(
    onsets: list[float], offsets: list[float], pitches: list[int], velocities: list[int]
) -> list[Hand]:
    """The hand of each note (same order as the inputs)."""
    if not onsets:
        return []
    import torch

    model = _load()
    order = np.argsort(np.asarray(onsets), kind="stable")
    seq = np.array(
        [[pitches[i], onsets[i], offsets[i] - onsets[i], velocities[i]] for i in order],
        dtype=np.float32,
    )
    device = next(model.parameters()).device
    with torch.no_grad():
        left = model(encode(torch.from_numpy(seq)[None].to(device)))[0].cpu().numpy() > 0.5
    out: list[Hand] = ["right"] * len(onsets)
    for k, i in enumerate(order):
        out[int(i)] = "left" if left[k] else "right"
    return out
