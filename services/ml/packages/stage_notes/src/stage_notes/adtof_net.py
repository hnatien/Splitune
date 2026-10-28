"""The ADTOF Frame_RNN network (ADTOF-pytorch's `ADTOFFrameRNN` with the Frame_RNN settings);
parameter names match its state dict. Imported only in the torch island."""

from __future__ import annotations

import torch
from torch import nn


class SamePool(nn.Module):
    """Max pool of 3 over frequency with TensorFlow 'same' padding."""

    def __init__(self) -> None:
        super().__init__()
        self.pool = nn.MaxPool2d(kernel_size=(1, 3), stride=(1, 3))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        width = x.shape[-1]
        pad = max(0, ((width + 2) // 3 - 1) * 3 + 3 - width)
        if pad:
            x = nn.functional.pad(x, (pad // 2, pad - pad // 2, 0, 0))
        return self.pool(x)


def conv_block(channels_in: int, channels: int) -> nn.Sequential:
    return nn.Sequential(
        nn.Conv2d(channels_in, channels, kernel_size=3, padding=1),
        nn.ReLU(),
        nn.BatchNorm2d(channels, eps=1e-3),
        nn.Conv2d(channels, channels, kernel_size=3, padding=1),
        nn.ReLU(),
        nn.BatchNorm2d(channels, eps=1e-3),
        SamePool(),
        nn.Dropout2d(0.3),
    )


class FrameRNN(nn.Module):
    """[batch, frames, bins, 1] spectrogram → [batch, frames, 5] onset activations. With a
    context of 9 frames the conv blocks cover the whole context, so there is no context layer."""

    def __init__(self, bins: int) -> None:
        super().__init__()
        self.cnn_blocks = nn.ModuleList([conv_block(1, 32), conv_block(32, 64)])
        width = bins
        for _ in self.cnn_blocks:
            width = (width + 2) // 3
        self.gru_layers = nn.ModuleList(
            [
                nn.GRU(64 * width if i == 0 else 120, 60, batch_first=True, bidirectional=True)
                for i in range(3)
            ]
        )
        self.output_layer = nn.Linear(120, 5)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        batch, frames = x.shape[0], x.shape[1]
        x = x.permute(0, 3, 1, 2)
        for block in self.cnn_blocks:
            x = block(x)
        x = x.permute(0, 2, 3, 1).reshape(batch, frames, -1)
        for gru in self.gru_layers:
            x, _ = gru(x)
        return torch.sigmoid(self.output_layer(x))
