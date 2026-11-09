"""What the step 29 checkpoints are, by their tensors (CPU; no audio).

    uv run python eval/weights_check.py --out results/sep-improve/<date>-weights.md

- X-LANCE's MSS files against BS-Roformer-SW: per X-LANCE's train.py, `key_mss` and `syn_mss` are
  SW's backbone with SW's piano / "other" mask estimator unchanged ("frozenall"), and `syn_mss1`
  a fresh head on a retrained SW backbone; `gtr_mss` has no config upstream. Each file's backbone
  is compared with SW's, and its single head with each of SW's six.
- Our Mega-53 keys slice against the noblebarkrr mirror's single-head files
  (<models>/mega53/mirror/).

A tensor pair counts as equal when bit-identical; otherwise the relative L2 distance is given.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

import torch

SW_HEADS = ["bass", "drums", "other", "vocals", "guitar", "piano"]  # BS-Roformer-SW.yaml order
XLANCE = ["key_mss", "syn_mss", "syn_mss1", "gtr_mss"]
MEGA_HEADS = ["organ", "keys", "synth", "piano", "digital-piano"]  # the slice's order


def models_dir() -> Path:
    return Path(os.environ.get("ML_MODELS_DIR", "~/.cache/splitune/models")).expanduser()


def load(path: Path) -> dict[str, torch.Tensor]:
    state = torch.load(path, map_location="cpu", weights_only=True)
    return dict(state.get("state_dict", state))


def split(
    state: dict[str, torch.Tensor],
) -> tuple[dict[str, torch.Tensor], dict[int, dict[str, torch.Tensor]]]:
    backbone = {k: v for k, v in state.items() if not k.startswith("mask_estimators.")}
    heads: dict[int, dict[str, torch.Tensor]] = {}
    for k, v in state.items():
        if k.startswith("mask_estimators."):
            _, index, rest = k.split(".", 2)
            heads.setdefault(int(index), {})[rest] = v
    return backbone, heads


def distance(a: dict[str, torch.Tensor], b: dict[str, torch.Tensor]) -> str:
    """'identical', or the relative L2 distance over the shared tensors."""
    if a.keys() != b.keys():
        return "different keys"
    if all(torch.equal(a[k].float(), b[k].float()) for k in a):
        return "identical"
    diff = sum(float(torch.sum((a[k].double() - b[k].double()) ** 2)) for k in a)
    norm = sum(float(torch.sum(b[k].double() ** 2)) for k in a)
    return f"rel. L2 {(diff / norm) ** 0.5:.3g}"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--out", required=True)
    args = p.parse_args(argv)
    directory = models_dir() / "audio-separator"
    sw_backbone, sw_heads = split(load(directory / "BS-Roformer-SW.ckpt"))
    lines = [
        f"# Step 29 checkpoint identity ({datetime.now(UTC).date().isoformat()})",
        "",
        "Command: `uv run python eval/weights_check.py " + " ".join(sys.argv[1:]) + "`",
        "",
        "## X-LANCE MSS files vs BS-Roformer-SW",
        "",
        "| file | backbone vs SW | its head vs SW's " + " / ".join(SW_HEADS) + " head |",
        "|---|---|---|",
    ]
    for name in XLANCE:
        backbone, heads = split(load(directory / f"bs_roformer_xlance_{name}.ckpt"))
        (head,) = heads.values()
        versus = [distance(head, sw_heads[i]) for i in range(len(SW_HEADS))]
        lines.append(f"| `{name}.pth` | {distance(backbone, sw_backbone)} | {' / '.join(versus)} |")
    mega_backbone, mega_heads = split(load(directory / "bs_roformer_mega53_keys5.ckpt"))
    lines += [
        "",
        "## Mega-53 keys slice vs the mirror's single-head files",
        "",
        "| head | slice index | backbone | head |",
        "|---|---:|---|---|",
    ]
    for index, head in enumerate(MEGA_HEADS):
        mirror = models_dir() / "mega53" / "mirror" / f"bs_mega_53stem_{head}_mvsep.ckpt"
        backbone, heads = split(load(mirror))
        lines.append(
            f"| {head} | {index} | {distance(mega_backbone, backbone)} | "
            f"{distance(mega_heads[index], heads[0])} |"
        )
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
