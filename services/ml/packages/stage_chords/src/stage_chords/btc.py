# Ported from jayg996/BTC-ISMIR19 @ 2682317 (btc_model.py, utils/transformer_modules.py,
# utils/mir_eval_modules.py): Copyright (c) 2019 Jonggwon Park, MIT License. Changes: inference
# only (no loss, attention maps or dropout), typed; submodule names kept so the released
# state_dicts load unchanged (including the unused LSTM and the ReLU after the last feed-forward
# layer of the original).
"""BTC (Bi-directional Transformer for Chord recognition, ISMIR 2019), 170-class vocabulary."""

from __future__ import annotations

import math
from typing import Any, cast

import numpy as np
import torch
from numpy.typing import NDArray
from torch import nn

SAMPLE_RATE = 22050
HOP = 2048
N_BINS = 144
BINS_PER_OCTAVE = 24
TIMESTEP = 108  # frames per model window
INST_LEN_S = 10.0  # CQT computed in 10 s chunks, as in training
FRAME_S = INST_LEN_S / TIMESTEP  # the original's time unit (≈ HOP / SAMPLE_RATE)

ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
QUALITIES = [
    "min", "maj", "dim", "aug", "min6", "maj6", "min7", "minmaj7", "maj7", "7", "dim7", "hdim7",
    "sus2", "sus4",
]  # fmt: skip


def label(index: int) -> str:
    """Class index → Harte label (168 = X: unknown chord, 169 = N)."""
    if index == 169:
        return "N"
    if index == 168:
        return "X"
    return f"{ROOTS[index // 14]}:{QUALITIES[index % 14]}"


def _bias_mask(length: int) -> torch.Tensor:
    mask = np.triu(np.full([length, length], -np.inf), 1)
    return torch.from_numpy(mask).float().unsqueeze(0).unsqueeze(1)  # pyright: ignore[reportUnknownMemberType]


def _timing_signal(length: int, channels: int) -> torch.Tensor:
    position = np.arange(length)
    timescales = channels // 2
    increment = math.log(1.0e4) / (float(timescales) - 1)
    inv = np.exp(np.arange(timescales).astype(np.float64) * -increment)
    scaled = np.expand_dims(position, 1) * np.expand_dims(inv, 0)
    signal = np.concatenate([np.sin(scaled), np.cos(scaled)], axis=1)
    signal = np.pad(signal, [[0, 0], [0, channels % 2]])
    return torch.from_numpy(signal.reshape([1, length, channels])).float()  # pyright: ignore[reportUnknownMemberType]


class LayerNorm(nn.Module):
    def __init__(self, features: int, eps: float = 1e-6) -> None:
        super().__init__()
        self.gamma = nn.Parameter(torch.ones(features))
        self.beta = nn.Parameter(torch.zeros(features))
        self.eps = eps

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        mean = x.mean(-1, keepdim=True)
        std = x.std(-1, keepdim=True)
        return self.gamma * (x - mean) / (std + self.eps) + self.beta


class MultiHeadAttention(nn.Module):
    def __init__(
        self, depth: int, key_depth: int, value_depth: int, heads: int, mask: torch.Tensor
    ) -> None:
        super().__init__()
        self.num_heads = heads
        self.query_scale = (key_depth // heads) ** -0.5
        self.bias_mask = mask
        self.query_linear = nn.Linear(depth, key_depth, bias=False)
        self.key_linear = nn.Linear(depth, key_depth, bias=False)
        self.value_linear = nn.Linear(depth, value_depth, bias=False)
        self.output_linear = nn.Linear(value_depth, depth, bias=False)

    def _split(self, x: torch.Tensor) -> torch.Tensor:
        b, t, d = x.shape
        return x.view(b, t, self.num_heads, d // self.num_heads).permute(0, 2, 1, 3)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        q = self._split(self.query_linear(x)) * self.query_scale
        k = self._split(self.key_linear(x))
        v = self._split(self.value_linear(x))
        logits = torch.matmul(q, k.permute(0, 1, 3, 2))
        logits = logits + self.bias_mask[:, :, : logits.shape[-2], : logits.shape[-1]].to(logits)
        contexts = torch.matmul(torch.softmax(logits, dim=-1), v)
        b, h, t, d = contexts.shape
        return self.output_linear(contexts.permute(0, 2, 1, 3).contiguous().view(b, t, h * d))


class Conv(nn.Module):
    def __init__(self, size_in: int, size_out: int) -> None:
        super().__init__()
        self.pad = nn.ConstantPad1d((1, 1), 0)
        self.conv = nn.Conv1d(size_in, size_out, kernel_size=3, padding=0)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.conv(self.pad(x.permute(0, 2, 1))).permute(0, 2, 1)


class PositionwiseFeedForward(nn.Module):
    def __init__(self, depth: int, filter_size: int) -> None:
        super().__init__()
        self.layers = nn.ModuleList([Conv(depth, filter_size), Conv(filter_size, depth)])

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        for layer in self.layers:
            x = torch.relu(layer(x))
        return x


class SelfAttentionBlock(nn.Module):
    def __init__(self, cfg: dict[str, Any], mask: torch.Tensor) -> None:
        super().__init__()
        hidden = int(cfg["hidden_size"])
        self.multi_head_attention = MultiHeadAttention(
            hidden,
            int(cfg["total_key_depth"]),
            int(cfg["total_value_depth"]),
            int(cfg["num_heads"]),
            mask,
        )
        self.positionwise_convolution = PositionwiseFeedForward(hidden, int(cfg["filter_size"]))
        self.layer_norm_mha = LayerNorm(hidden)
        self.layer_norm_ffn = LayerNorm(hidden)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.multi_head_attention(self.layer_norm_mha(x))
        return x + self.positionwise_convolution(self.layer_norm_ffn(x))


class BiDirectionalSelfAttention(nn.Module):
    def __init__(self, cfg: dict[str, Any]) -> None:
        super().__init__()
        mask = _bias_mask(TIMESTEP)
        self.attn_block = SelfAttentionBlock(cfg, mask)
        self.backward_attn_block = SelfAttentionBlock(cfg, torch.transpose(mask, dim0=2, dim1=3))
        self.linear = nn.Linear(int(cfg["hidden_size"]) * 2, int(cfg["hidden_size"]))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.linear(torch.cat((self.attn_block(x), self.backward_attn_block(x)), dim=2))


class BiDirectionalSelfAttentionLayers(nn.Module):
    def __init__(self, cfg: dict[str, Any]) -> None:
        super().__init__()
        hidden = int(cfg["hidden_size"])
        self.timing_signal = _timing_signal(TIMESTEP, hidden)
        self.embedding_proj = nn.Linear(int(cfg["feature_size"]), hidden, bias=False)
        self.self_attn_layers = nn.Sequential(
            *[BiDirectionalSelfAttention(cfg) for _ in range(int(cfg["num_layers"]))]
        )
        self.layer_norm = LayerNorm(hidden)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        y = self.embedding_proj(x) + self.timing_signal[:, : x.shape[1], :].to(x)
        return self.layer_norm(self.self_attn_layers(y))


class OutputLayer(nn.Module):
    def __init__(self, hidden: int, classes: int) -> None:
        super().__init__()
        self.output_projection = nn.Linear(hidden, classes)
        self.lstm = nn.LSTM(
            input_size=hidden, hidden_size=hidden // 2, batch_first=True, bidirectional=True
        )


class BTC(nn.Module):
    def __init__(self, cfg: dict[str, Any]) -> None:
        super().__init__()
        self.self_attn_layers = BiDirectionalSelfAttentionLayers(cfg)
        self.output_layer = OutputLayer(int(cfg["hidden_size"]), int(cfg["num_chords"]))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """(batch, TIMESTEP, 144) normalised log-CQT → logits (batch, TIMESTEP, classes)."""
        return self.output_layer.output_projection(self.self_attn_layers(x))


# run_config.yaml of the release, large vocabulary.
CONFIG: dict[str, Any] = {
    "feature_size": 144,
    "timestep": TIMESTEP,
    "num_chords": 170,
    "num_layers": 8,
    "num_heads": 4,
    "hidden_size": 128,
    "total_key_depth": 128,
    "total_value_depth": 128,
    "filter_size": 128,
}


def load(path: str, device: torch.device) -> tuple[BTC, float, float]:
    checkpoint = cast(dict[str, Any], torch.load(path, map_location="cpu", weights_only=False))
    model = BTC(CONFIG)
    model.load_state_dict(checkpoint["model"])
    model.eval().to(device)
    return model, float(checkpoint["mean"]), float(checkpoint["std"])


def features(audio22k: NDArray[np.float32]) -> NDArray[np.float32]:
    """log |CQT| in 10 s chunks, (frames, 144), as the original computed it."""
    import librosa  # pyright: ignore[reportMissingTypeStubs]

    chunk = int(SAMPLE_RATE * INST_LEN_S)
    parts: list[NDArray[np.float32]] = []
    for start in range(0, max(len(audio22k), 1), chunk):
        piece = audio22k[start : start + chunk]
        if len(piece) == 0:
            break
        cqt = cast(
            NDArray[np.complex64],
            librosa.cqt(  # pyright: ignore[reportUnknownMemberType]
                piece,
                sr=SAMPLE_RATE,
                n_bins=N_BINS,
                bins_per_octave=BINS_PER_OCTAVE,
                hop_length=HOP,
            ),
        )
        parts.append(np.abs(cqt).astype(np.float32))
    return np.log(np.concatenate(parts, axis=1) + 1e-6).T.astype(np.float32)


@torch.no_grad()
def frame_probs(
    model: BTC, mean: float, std: float, audio22k: NDArray[np.float32], device: torch.device
) -> NDArray[np.float32]:
    """(frames, 170) softmax probabilities at FRAME_S per frame."""
    feat = (features(audio22k) - mean) / std
    frames = len(feat)
    pad = (-frames) % TIMESTEP
    feat = np.pad(feat, ((0, pad), (0, 0)))
    x = torch.from_numpy(feat).float().view(-1, TIMESTEP, N_BINS).to(device)  # pyright: ignore[reportUnknownMemberType]
    probs = torch.softmax(model(x), dim=-1).reshape(-1, CONFIG["num_chords"])
    return probs.cpu().numpy()[:frames].astype(np.float32)
