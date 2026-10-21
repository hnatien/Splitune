# Ported from andreamust/consonance-ACE @ d17633a (ACE/models/conformer_decomposed.py,
# ACE/utils.py, ACE/inference.py, ACE/preprocess/transforms.py): Copyright (c) 2025 Andrea
# Poltronieri, Xavier Serra, Martín Rocamora, MIT License. Changes: a plain torch module (no
# lightning, gin or torchmetrics) with the same layer names, hyperparameters from the checkpoint,
# and scores over a chord vocabulary instead of thresholded decoding.
"""consonance-ACE decomposed conformer (ISMIR 2025): per frame, root (12 + N), bass (12 + N) and
12 chord-tone activations."""

from __future__ import annotations

import math
from typing import Any, cast

import numpy as np
import torch
from numpy.typing import NDArray
from torch import nn
from torchaudio.models import Conformer  # pyright: ignore[reportMissingTypeStubs]

SAMPLE_RATE = 22050
HOP = 512
BINS_PER_OCTAVE = 24
N_OCTAVES = 6
FMIN_HZ = 32.70319566257483  # C1
CHUNK_S = 20.0  # training length; the decomposed model is used with 20 s chunks only
FRAME_S = HOP / SAMPLE_RATE


class PositionalEncoding(nn.Module):
    def __init__(self, hidden_size: int, max_len: int = 5000) -> None:
        super().__init__()
        pe = torch.zeros(max_len, hidden_size)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div = torch.exp(
            torch.arange(0, hidden_size, 2).float() * (-math.log(10000.0) / hidden_size)
        )
        pe[:, 0::2] = torch.sin(position * div)
        pe[:, 1::2] = torch.cos(position * div)
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + cast(torch.Tensor, self.pe)[:, : x.size(1)]


class ConformerDecomposed(nn.Module):
    def __init__(self, hp: dict[str, Any]) -> None:
        super().__init__()
        dim = int(hp["conformer_dim"])
        chords, roots, basses = 12, 13, 13
        self.use_positional = bool(hp["positional_encoding"])
        self.positional_encodings = PositionalEncoding(hidden_size=dim)
        self.input_projection = nn.Linear(int(hp["input_dim"]), dim)
        self.conformer = Conformer(
            input_dim=dim,
            num_heads=int(hp["num_heads"]),
            ffn_dim=int(hp["ffn_dim"]),
            num_layers=int(hp["num_layers"]),
            depthwise_conv_kernel_size=int(hp["depthwise_conv_kernel_size"]),
            dropout=float(hp["dropout"]),
            use_group_norm=bool(hp["use_group_norm"]),
            convolution_first=bool(hp["convolution_first"]),
        )
        self.output_chord = nn.Linear(dim, chords)
        self.bass_fusion = nn.Sequential(
            nn.Linear(dim + chords, dim), nn.LayerNorm(dim), nn.GELU(), nn.Dropout(0.1)
        )
        self.output_bass = nn.Linear(dim, basses)
        self.root_fusion = nn.Sequential(
            nn.Linear(dim + chords, dim), nn.LayerNorm(dim), nn.GELU(), nn.Dropout(0.1)
        )
        self.output_root = nn.Linear(dim, roots)

    def forward(self, cqt: torch.Tensor) -> dict[str, torch.Tensor]:
        """(batch, bins, frames) → logits root (13), bass (13), onehot (12) per frame."""
        lengths = torch.full((cqt.shape[0],), cqt.shape[2], dtype=torch.long, device=cqt.device)
        x = self.input_projection(cqt.transpose(1, 2))
        if self.use_positional:
            x = self.positional_encodings(x)
        x, _ = self.conformer(x, lengths=lengths)
        chord = self.output_chord(x)
        fused = torch.cat([x, chord], dim=-1)
        return {
            "root": self.output_root(self.root_fusion(fused)),
            "bass": self.output_bass(self.bass_fusion(fused)),
            "onehot": chord,
        }


def load(path: str, device: torch.device) -> ConformerDecomposed:
    checkpoint = cast(dict[str, Any], torch.load(path, map_location="cpu", weights_only=False))
    model = ConformerDecomposed(cast(dict[str, Any], checkpoint["hyper_parameters"]))
    state = {
        k: v
        for k, v in cast(dict[str, torch.Tensor], checkpoint["state_dict"]).items()
        if not k.startswith("loss.")
    }
    model.load_state_dict(state)
    model.eval().to(device)
    return model


def cqt(chunk: NDArray[np.float32]) -> NDArray[np.float32]:
    import librosa  # pyright: ignore[reportMissingTypeStubs]

    return np.abs(
        cast(
            NDArray[np.complex64],
            librosa.cqt(  # pyright: ignore[reportUnknownMemberType]
                chunk,
                sr=SAMPLE_RATE,
                hop_length=HOP,
                bins_per_octave=BINS_PER_OCTAVE,
                n_bins=BINS_PER_OCTAVE * N_OCTAVES,
                fmin=FMIN_HZ,
            ),
        )
    ).astype(np.float32)


@torch.no_grad()
def activations(
    model: ConformerDecomposed, audio22k: NDArray[np.float32], device: torch.device
) -> dict[str, NDArray[np.float32]]:
    """Per-frame log-softmax root/bass (13) and sigmoid chord tones (12), FRAME_S per frame.
    Each 20 s chunk is peak-normalised and zero-padded, as in the original inference."""
    size = int(SAMPLE_RATE * CHUNK_S)
    total = math.ceil(len(audio22k) * 1.0 / HOP)
    out: dict[str, list[NDArray[np.float32]]] = {"root": [], "bass": [], "tones": []}
    for start in range(0, max(len(audio22k), 1), size):
        chunk = np.zeros(size, dtype=np.float32)
        piece = audio22k[start : start + size]
        chunk[: len(piece)] = piece
        peak = float(np.max(np.abs(chunk)))
        if peak > 0:
            chunk = chunk / peak
        x = torch.from_numpy(cqt(chunk)).unsqueeze(0).to(device)  # pyright: ignore[reportUnknownMemberType]
        y = model(x)
        out["root"].append(torch.log_softmax(y["root"], -1)[0].cpu().numpy())
        out["bass"].append(torch.log_softmax(y["bass"], -1)[0].cpu().numpy())
        out["tones"].append(torch.sigmoid(y["onehot"])[0].cpu().numpy())
    return {k: np.concatenate(v)[:total].astype(np.float32) for k, v in out.items()}
