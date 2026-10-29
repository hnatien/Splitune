"""Step 22 Phase 2.4: fine-tune Guitab E25 for the production domain (separated guitar stems).

    uv run python eval/p2g_finetune.py data    # CQT + frame labels of the training audio
    uv run python eval/p2g_finetune.py train [--steps N --lr LR]  # from E25 → runs/<name>/best.pt
    uv run python eval/p2g_finetune.py export --name N --out F.onnx  # as Guitab's web export

Training audio = the string classifier's (p2g_strings.training_sources: GuitarSet players 00-02,
Guitar-TECHS single notes, scales and chords, IDMT-SMT-Guitar dataset 1), each both as recorded and
as the production separator's stem of a band mix (`p2g_strings.py augment` writes those). None is a
P2g test item; Guitar-TECHS shares players and rig with the test set's Guitar-TECHS music items
(flagged in the report). Every 10th file (by order) is held out: the best checkpoint is chosen on
its loss, never on P2g. The model is Guitab's TabModel "small" (E25's size), copied below from
Guitab 1.1.1 `guitab/model.py` (MIT, Daniele Morotti), with its loss (`scripts/train.py`) and CQT
augmentation; weights start from the published `guitab_e25.safetensors`.

Step 22 result: both runs gained on GuitarSet and lost on Guitar-TECHS and IDMT-SMT-Guitar
(eval/results/p2g/2026-10-28-finetune.md), so production keeps E25; the tool stays for a retry
with more varied data.
"""

# torch and the safetensors loader are partly untyped.
# pyright: reportUnknownMemberType=false, reportUnknownArgumentType=false, reportUnknownVariableType=false

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import sys
import urllib.request
from pathlib import Path
from typing import Any, cast

import numpy as np
from numpy.typing import NDArray

sys.path.insert(0, str(Path(__file__).resolve().parent))
import p2g
import p2g_strings
from stage_notes import guitab

OUT = p2g.ROOT / "finetune"
E25_URL = (
    "https://huggingface.co/danmor/guitab/resolve/4b006492127a66b81b9658924ffe41aedd07f17a/"
    "guitab_e25.safetensors"
)
HOLDOUT_EVERY = 10
LENGTH = guitab.WINDOW


# --- data ------------------------------------------------------------------------------------


def frame_labels(notes: list[Any], frames: int) -> tuple[NDArray[np.int8], NDArray[np.int8]]:
    """tab [T, 6] (0 silent, 1 + fret, -100 ignore) and onset [T, 6] (-1 ignore), model columns
    (string 6 first). A note without a string (or out of the fret range) masks every string that
    is otherwise silent while it sounds, as Guitab does for GAPS notes of unknown string."""
    tab = np.zeros((frames, 6), dtype=np.int8)
    onset = np.zeros((frames, 6), dtype=np.int8)
    unknown: list[tuple[int, int]] = []
    for n in sorted(notes, key=lambda n: n.onset_s):
        a = round(n.onset_s * guitab.FPS)
        b = max(a + 1, round(n.offset_s * guitab.FPS))
        if a >= frames:
            continue
        col = None if n.string is None else 6 - int(n.string)
        fret = None if col is None else n.pitch_midi - guitab.OPEN_PITCH[col]
        if col is None or fret is None or not 0 <= fret < guitab.N_FRETS:
            unknown.append((a, b))
            continue
        tab[a:b, col] = fret + 1
        onset[a, col] = 1
    for a, b in unknown:
        seg = tab[a:b]
        seg[seg == 0] = -100
        win = onset[max(a - 1, 0) : a + 2]
        win[win == 0] = -1
    return tab, onset


def cmd_data(_: argparse.Namespace) -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    index: list[dict[str, Any]] = []
    for k, (source, audio, notes) in enumerate(p2g_strings.training_sources()):
        stem = p2g_strings.OUT / "augment" / f"{k:04d}" / "sep" / "guitar.wav"
        for kind, path in (("clean", audio), ("stem", stem)):
            dest = OUT / "data" / f"{k:04d}.{kind}.npz"
            if not dest.is_file():
                if not path.is_file():
                    continue
                mono = p2g.read(path)[: int(p2g_strings.AUGMENT_MAX_S * p2g.RATE)].mean(axis=1)
                feat = guitab.features(mono.astype(np.float32)).astype(np.float16)
                tab, onset = frame_labels(notes, len(feat))
                dest.parent.mkdir(parents=True, exist_ok=True)
                np.savez(dest, feat=feat, tab=tab, onset=onset)
            index.append(
                {
                    "k": k,
                    "source": source,
                    "kind": kind,
                    "path": str(dest),
                    "val": k % HOLDOUT_EVERY == 0,
                }
            )
        print(f"data {k} {source} {audio.name}", flush=True)
    p2g.write_json(OUT / "index.json", index)
    return 0


# --- model (Guitab 1.1.1 guitab/model.py, MIT) -----------------------------------------------


def tab_model() -> Any:
    import torch
    from torch import nn
    from torch.nn import functional

    base_bin, n_pitch_bins = 36, 144
    harmonics = [0.5, 1, 2, 3, 4, 5]

    def conv_block(cin: int, cout: int) -> nn.Module:
        return nn.Sequential(nn.Conv2d(cin, cout, 3, padding=1), nn.BatchNorm2d(cout), nn.GELU())

    class TabModel(nn.Module):
        """Guitab's "small" TabModel: harmonic stack → 2D CNN → 4-layer transformer → heads."""

        def __init__(self, dropout: float = 0.1, max_len: int = 4096) -> None:
            super().__init__()
            c1, c2, c3, d = 64, 128, 256, 256
            self.shifts = [round(36 * math.log2(h)) for h in harmonics]
            self.cnn = nn.Sequential(
                *(conv_block(len(harmonics), c1), conv_block(c1, c1), nn.MaxPool2d((1, 3))),
                *(conv_block(c1, c2), conv_block(c2, c2), nn.MaxPool2d((1, 2))),
                *(conv_block(c2, c3), conv_block(c3, c3), nn.MaxPool2d((1, 2))),
                nn.Dropout(dropout),
            )
            self.proj = nn.Linear(c3 * 12, d)
            self.pos = nn.Parameter(torch.zeros(1, max_len, d))
            layer = nn.TransformerEncoderLayer(
                d, 4, 4 * d, dropout, activation="gelu", batch_first=True, norm_first=True
            )
            self.encoder = nn.TransformerEncoder(layer, 4)
            self.norm = nn.LayerNorm(d)
            self.tab_head = nn.Linear(d, 6 * (guitab.N_FRETS + 1))
            self.onset_head = nn.Linear(d, 6)
            self.pitch_head = nn.Linear(d, n_pitch_bins // 3)

        def forward(self, x: Any) -> dict[str, Any]:
            b, t, _ = x.shape
            pad = functional.pad(x, (0, max(self.shifts) + base_bin + n_pitch_bins - x.shape[-1]))
            stack = torch.stack(
                [pad[..., base_bin + s : base_bin + s + n_pitch_bins] for s in self.shifts], dim=1
            )
            h = self.cnn(stack).permute(0, 2, 1, 3).reshape(b, t, -1)
            h = self.norm(self.encoder(self.proj(h) + self.pos[:, :t]))
            return {
                "tab": self.tab_head(h).view(b, t, 6, guitab.N_FRETS + 1),
                "onset": self.onset_head(h),
                "pitch": self.pitch_head(h),
            }

    return TabModel()


def pitch_targets(tab: Any) -> Any:
    import torch

    opens = torch.tensor(guitab.OPEN_PITCH, device=tab.device)
    active = tab > 0
    pitch = (opens + tab.long() - 1 - 40).clamp(0, 47)
    out = torch.zeros(*tab.shape[:2], 48, device=tab.device)
    out.scatter_add_(2, pitch * active, active.float())
    return (out > 0).float()


def loss_fn(out: dict[str, Any], tab: Any, onset: Any) -> Any:
    """Guitab's label loss: per-string fret CE, onset BCE with ±1-frame soft targets, pitch BCE."""
    import torch
    from torch.nn import functional

    classes = guitab.N_FRETS + 1
    ce = functional.cross_entropy(
        out["tab"].reshape(-1, classes).float(), tab.reshape(-1), ignore_index=-100
    )
    mask = (onset >= 0).float()
    pos = onset.clamp(min=0).float()
    neighbours = (
        functional.pad(pos, (0, 0, 1, 0))[:, :-1] + functional.pad(pos, (0, 0, 0, 1))[:, 1:]
    )
    soft = torch.maximum(pos, 0.5 * neighbours.clamp(max=1))
    bce = functional.binary_cross_entropy_with_logits(
        out["onset"].float(),
        soft,
        pos_weight=torch.tensor(5.0, device=soft.device),
        reduction="none",
    )
    on_loss = (bce * mask).sum() / mask.sum().clamp(min=1.0)
    pitch_loss = functional.binary_cross_entropy_with_logits(
        out["pitch"].float(), pitch_targets(tab.clamp(min=0))
    )
    return ce + on_loss + 0.5 * pitch_loss


def augment(x: NDArray[np.float32], rng: random.Random) -> NDArray[np.float32]:
    """Guitab's CQT augmentation without the pitch roll (the stems already vary): level, spectral
    tilt, a noise floor, short time masks."""
    tilt = np.linspace(-1, 1, x.shape[1], dtype=np.float32)
    x = (
        x + np.float32(rng.uniform(-0.15, 0.05)) + np.float32(rng.uniform(-0.1, 0.1)) * tilt
    ).astype(np.float32)
    if rng.random() < 0.5:
        noise = np.random.randn(*x.shape).astype(np.float32)
        x = np.maximum(x, np.float32(rng.uniform(0.05, 0.35)) + np.float32(0.03) * noise)
    for _ in range(rng.randint(0, 2)):
        w = rng.randint(2, 12)
        t0 = rng.randint(0, len(x) - w)
        x[t0 : t0 + w] = 0.0
    return np.clip(x, 0.0, 1.0).astype(np.float32)


def load_split(val: bool, kinds: set[str]) -> list[dict[str, NDArray[Any]]]:
    index = cast(list[dict[str, Any]], json.loads((OUT / "index.json").read_text()))
    tracks: list[dict[str, NDArray[Any]]] = []
    for row in index:
        if row["val"] == val and row["kind"] in kinds:
            with np.load(row["path"]) as data:
                tracks.append({k: data[k] for k in data.files})
    return tracks


def crop(track: dict[str, NDArray[Any]], start: int) -> tuple[NDArray[Any], ...]:
    def fit(a: NDArray[Any], fill: float) -> NDArray[Any]:
        part = a[start : start + LENGTH]
        pad = LENGTH - len(part)
        return (
            np.pad(part, ((0, pad), *[(0, 0)] * (a.ndim - 1)), constant_values=fill)
            if pad
            else part
        )

    return (
        fit(track["feat"], 0.0).astype(np.float32),
        fit(track["tab"], 0).astype(np.int64),
        fit(track["onset"], 0).astype(np.int64),
    )


def e25_weights() -> Path:
    path = Path.home() / ".cache" / "splitune" / "models" / "guitab" / "guitab_e25.safetensors"
    if not path.is_file():
        path.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(E25_URL, path)
    return path


def cmd_train(args: argparse.Namespace) -> int:
    import torch
    from safetensors.torch import load_file  # pyright: ignore[reportMissingTypeStubs]

    device = "cuda" if torch.cuda.is_available() else "cpu"
    rng = random.Random(0)
    torch.manual_seed(0)  # pyright: ignore[reportUnknownMemberType]
    kinds = set(args.kinds)
    train = load_split(False, kinds)
    val = load_split(True, {"stem"})
    model = tab_model()
    model.load_state_dict(load_file(str(e25_weights())))
    model.to(device)
    optim = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-2)
    weights = [len(t["feat"]) for t in train]
    run = OUT / "runs" / args.name
    run.mkdir(parents=True, exist_ok=True)
    log: list[dict[str, float]] = []

    def val_loss() -> float:
        model.eval()
        total, count = 0.0, 0
        with torch.no_grad():
            for track in val:
                for start in range(0, len(track["feat"]), LENGTH):
                    x, tab, onset = crop(track, start)
                    out = model(torch.from_numpy(x)[None].to(device))
                    total += float(
                        loss_fn(
                            out,
                            torch.from_numpy(tab)[None].to(device),
                            torch.from_numpy(onset)[None].to(device),
                        )
                    )
                    count += 1
        model.train()
        return total / max(count, 1)

    best = val_loss()
    log.append({"step": 0, "val": best})
    print(f"step 0 val {best:.4f} ({len(train)} train, {len(val)} val tracks)", flush=True)
    torch.save(model.state_dict(), run / "best.pt")
    model.train()
    for step in range(1, args.steps + 1):
        lr = args.lr * min(1.0, step / 200) * 0.5 * (1 + math.cos(math.pi * step / args.steps))
        for group in optim.param_groups:
            group["lr"] = lr
        xs, tabs, onsets = [], [], []
        for _ in range(args.batch):
            track = train[rng.choices(range(len(train)), weights)[0]]
            x, tab, onset = crop(track, rng.randint(0, max(len(track["feat"]) - LENGTH, 0)))
            xs.append(augment(x, rng))
            tabs.append(tab)
            onsets.append(onset)
        out = model(torch.from_numpy(np.stack(xs)).to(device))
        loss = loss_fn(
            out,
            torch.from_numpy(np.stack(tabs)).to(device),
            torch.from_numpy(np.stack(onsets)).to(device),
        )
        optim.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optim.step()
        if step % args.eval_every == 0:
            v = val_loss()
            log.append({"step": step, "val": v, "train": float(loss)})
            print(f"step {step} train {float(loss):.4f} val {v:.4f}", flush=True)
            if v < best:
                best = v
                torch.save(model.state_dict(), run / "best.pt")
            p2g.write_json(run / "log.json", log)
    return 0


def cmd_export(args: argparse.Namespace) -> int:
    """best.pt → ONNX with Guitab's export wrapper (softmax/sigmoid inside, fixed 432-frame window)
    at `--out`, with its sha256."""
    import torch

    model = tab_model()
    model.load_state_dict(
        torch.load(OUT / "runs" / args.name / "best.pt", map_location="cpu", weights_only=True)
    )
    model.eval()

    class TabProbs(torch.nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.model = model

        def forward(self, x: Any) -> tuple[Any, Any]:
            out = self.model(x)
            return torch.softmax(out["tab"].float(), -1), torch.sigmoid(out["onset"].float())

    dest = Path(args.out).expanduser()
    dest.parent.mkdir(parents=True, exist_ok=True)
    example = torch.zeros(1, LENGTH, guitab.N_BINS)
    torch.onnx.export(  # pyright: ignore[reportUnknownMemberType]
        TabProbs(), (example,), str(dest), input_names=["x"], output_names=["tab", "onset"],
        opset_version=17, dynamo=False,
    )  # fmt: skip
    digest = hashlib.sha256(dest.read_bytes()).hexdigest()
    print(f"{dest} {dest.stat().st_size} bytes sha256 {digest}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n", 1)[0])
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("data").set_defaults(fn=cmd_data)
    p = sub.add_parser("train")
    p.add_argument("--name", default="ft")
    p.add_argument("--steps", type=int, default=3000)
    p.add_argument("--lr", type=float, default=5e-5)
    p.add_argument("--batch", type=int, default=12)
    p.add_argument("--eval-every", type=int, default=250)
    p.add_argument("--kinds", nargs="+", choices=["clean", "stem"], default=["clean", "stem"])
    p.set_defaults(fn=cmd_train)
    p = sub.add_parser("export")
    p.add_argument("--name", default="ft")
    p.add_argument("--out", required=True)
    p.set_defaults(fn=cmd_export)
    args = parser.parse_args()
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
