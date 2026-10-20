"""Export the PANNs Cnn14 AudioSet tagger to ONNX for the `tag` stage (onnx-cpu island).

    uv run --project islands/torch --with panns-inference==0.1.1 --with torchlibrosa==0.1.0 \
        python scripts/export_tagger.py ~/.cache/splitune/models/panns

Reads `Cnn14_mAP=0.431.pth` (Zenodo record 3987831) from the directory and writes `cnn14.onnx`
next to it: input `waveform` float32 [batch, samples] mono at 32 kHz, output `clipwise` float32
[batch, 527] AudioSet probabilities. The log-mel front end (torchlibrosa, conv-based STFT) is part
of the graph, so the island needs only ONNX Runtime. Prints the sha256 values to record in
`compliance/register/models/panns-cnn14.yaml`.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib
import importlib.util
import sys
import types
from pathlib import Path

import torch

CHECKPOINT = "Cnn14_mAP=0.431.pth"
SAMPLE_RATE = 32000
WINDOW_S = 10


def load_cnn14() -> type[torch.nn.Module]:
    """`panns_inference/__init__` downloads label files with wget at import time; only the model
    definitions are needed, so the package is registered without running its `__init__`."""
    spec = importlib.util.find_spec("panns_inference")
    if spec is None or spec.submodule_search_locations is None:
        raise SystemExit("panns-inference is not installed (see the usage line)")
    package = types.ModuleType("panns_inference")
    package.__path__ = list(spec.submodule_search_locations)
    sys.modules["panns_inference"] = package
    return importlib.import_module("panns_inference.models").Cnn14


class Clipwise(torch.nn.Module):
    def __init__(self, model: torch.nn.Module) -> None:
        super().__init__()
        self.model = model

    def forward(self, waveform: torch.Tensor) -> torch.Tensor:
        return self.model(waveform)["clipwise_output"]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory")
    args = parser.parse_args()
    directory = Path(args.directory).expanduser()
    checkpoint = directory / CHECKPOINT
    model = load_cnn14()(
        sample_rate=SAMPLE_RATE,
        window_size=1024,
        hop_size=320,
        mel_bins=64,
        fmin=50,
        fmax=14000,
        classes_num=527,
    )
    state = torch.load(checkpoint, map_location="cpu", weights_only=False)
    model.load_state_dict(state["model"])
    model.eval()
    out = directory / "cnn14.onnx"
    example = torch.zeros(1, SAMPLE_RATE * WINDOW_S)
    torch.onnx.export(  # pyright: ignore[reportUnknownMemberType]
        Clipwise(model),
        (example,),
        str(out),
        input_names=["waveform"],
        output_names=["clipwise"],
        dynamic_axes={"waveform": {0: "batch", 1: "samples"}, "clipwise": {0: "batch"}},
        opset_version=17,
        dynamo=False,
    )
    print(f"{checkpoint.name} sha256 {sha256(checkpoint)}")
    print(f"{out.name} sha256 {sha256(out)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
