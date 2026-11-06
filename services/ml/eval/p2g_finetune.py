"""Guitab E25 fine-tune for the production domain (step 22 Phase 2.4, redone in step 27).

    uv run python eval/p2g_finetune.py data    # audio versions, CQT + frame labels per source
    uv run python eval/p2g_finetune.py train [--steps N --lr LR]  # from E25 → runs/<name>/best.pt
    uv run python eval/p2g_finetune.py export --name N --out F.onnx  # as Guitab's web export

Step 22 trained on GuitarSet players 00-02, Guitar-TECHS single notes, scales and chords of both
players and IDMT-SMT-Guitar dataset 1, chose the checkpoint by loss on every 10th training file and
lost out of sample (Guitar-TECHS -0.07, IDMT -0.24/-0.36 onset F1). Step 27 changes three things:

- Training sources share no player, guitar or excerpt with any P2g item that scores it: GuitarSet
  players 00-02 (already in Guitab's training: the anchor), Guitar-TECHS player 1's single notes,
  scales and chords except the drills P2g uses as fit items, and dataset 1's Ibanez guitars (the
  Fender Strat is IDMT's held-out FS guitar). Guitar-TECHS player 2 and the P3 music pieces are
  test material, so they never train.
- Each source is used as recorded, through a random amp chain (`amp_chain`: drive, cabinet, EQ,
  room) and as the production separator's stem of that amp version in a band mix (MUSDB windows
  no P2g band uses; a third of the GuitarSet files).
- The checkpoint is chosen on P2g fit items that share no player or guitar with the training
  data (`SELECT`: GuitarSet player 04, Guitar-TECHS music pieces 03/06/09/12, IDMT's AR guitar),
  by onset F1 and raw Tab F1 on their hard-band stems, each tier weighted equally; the published
  E25 is step 0, so a run that never beats it keeps E25.
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
from collections.abc import Iterable
from pathlib import Path
from typing import Any, cast

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from numpy.typing import NDArray

sys.path.insert(0, str(Path(__file__).resolve().parent))
import p2g
import p2g_strings
from stage_notes import guitab

OUT = p2g.ROOT / "finetune27"
E25_URL = (
    "https://huggingface.co/danmor/guitab/resolve/4b006492127a66b81b9658924ffe41aedd07f17a/"
    "guitab_e25.safetensors"
)
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


TRAIN_PLAYERS = ("00", "01", "02")
IDMT1_GUITARS = ("Ibanez Power Strat",)  # dataset 1's Fender Strat is IDMT's test guitar FS
IDMT1_CHUNK_S = 60.0  # dataset 1's single-note files are joined into chunks this long
SOURCE_MAX_S = 60.0
AMP_SEED = 27


def techs_fit_drills() -> set[str]:
    return {f"{kind}/{pick}" for kind, picks in p2g.TECHS_DRILLS.items() for pick in picks}


def training_sources() -> Iterable[tuple[str, NDArray[np.float32], list[Any]]]:
    """(source, mono 44.1 kHz audio, reference notes) of every training recording (docstring)."""
    for jams in sorted((p2g.GUITARSET / "annotation").glob("*.jams")):
        if jams.stem.split("_")[0] in TRAIN_PLAYERS:
            audio = p2g.read(p2g.GUITARSET / "audio_mono-mic" / f"{jams.stem}_mic.wav")
            yield "guitarset", audio.mean(axis=1), list(p2g.gs_ref(jams.stem).notes)
    techs = p2g.DATASETS / "guitar-techs"
    skip = techs_fit_drills()
    for part in ("singlenotes", "scales", "chords"):
        base = techs / f"P1_{part}"
        for midi in sorted((base / "midi").glob("midi_*.mid")):
            name = midi.stem.removeprefix("midi_")
            audio_path = base / "audio" / "micamp" / f"micamp_{name}.wav"
            if f"{part}/{name}" in skip or not audio_path.is_file():
                continue
            mono = p2g.read(audio_path).mean(axis=1)
            ref = p2g.techs_ref(midi, 0.0, float("inf"), vibrato=False)
            for t0 in np.arange(0.0, len(mono) / p2g.RATE, SOURCE_MAX_S):
                notes = [
                    p2g.RefNote(n.onset_s - t0, n.offset_s - t0, n.pitch_midi, n.string, n.fret)
                    for n in ref.notes
                    if t0 <= n.onset_s < t0 + SOURCE_MAX_S
                ]
                if notes:
                    a, b = int(t0 * p2g.RATE), int((t0 + SOURCE_MAX_S) * p2g.RATE)
                    yield "guitar-techs-p1", mono[a:b], notes
    idmt1 = p2g.IDMT_ROOT / "dataset1"
    for folder in sorted(idmt1.iterdir()):
        if not folder.name.startswith(IDMT1_GUITARS):
            continue
        parts = [
            (folder / "audio" / f"{xml.stem}.wav", xml)
            for xml in sorted((folder / "annotation").glob("*.xml"))
            if (folder / "audio" / f"{xml.stem}.wav").is_file()
        ]
        chunk: list[tuple[Path, Path]] = []
        seconds = 0.0
        for i, (wav, xml) in enumerate(parts):
            chunk.append((wav, xml))
            seconds += float(sf.info(str(wav)).duration) + p2g.IDMT_GAP_S  # pyright: ignore[reportUnknownMemberType]
            if seconds >= IDMT1_CHUNK_S or i == len(parts) - 1:
                audio, ref = p2g.idmt_joined(chunk)
                yield "idmt-dataset1", audio.mean(axis=1), list(ref.notes)
                chunk, seconds = [], 0.0


def amp_chain(mono: NDArray[np.float32], rng: np.random.Generator) -> NDArray[np.float32]:
    """A random electric rig: pre-EQ, drive (clean to high gain, soft or asymmetric clipping),
    a cabinet (band-limited, a low resonance) and a little room, at the input's peak level."""
    from scipy.signal import butter, fftconvolve, sosfilt  # pyright: ignore[reportMissingTypeStubs]

    rate = p2g.RATE

    def filtered(order: int, cutoff: Any, kind: str, x: NDArray[np.float64]) -> NDArray[np.float64]:
        return np.asarray(
            sosfilt(butter(order, cutoff, kind, fs=rate, output="sos"), x), np.float64
        )

    peak = float(np.max(np.abs(mono))) or 1.0
    x = mono.astype(np.float64) / peak
    x = filtered(1, rng.uniform(80, 400), "highpass", x)
    gain = float(np.exp(rng.uniform(np.log(1.0), np.log(60.0))))
    if rng.random() < 0.5:
        x = np.tanh(gain * x)
    else:
        bias = rng.uniform(0.0, 0.3)
        x = np.tanh(gain * (x + bias)) - np.tanh(gain * bias)
    x = filtered(2, rng.uniform(60, 140), "highpass", x)
    x = filtered(4, rng.uniform(2500, 6500), "lowpass", x)
    resonance = filtered(2, (90, 160), "bandpass", x)
    x = x + rng.uniform(0.0, 0.8) * resonance
    if rng.random() < 0.7:
        n = int(rng.uniform(0.15, 0.8) * rate)
        ir = rng.standard_normal(n) * np.exp(-6.9 * np.arange(n) / n)
        wet = fftconvolve(x, ir / np.sqrt(np.sum(ir**2)))[: len(x)]
        x = x + rng.uniform(0.05, 0.3) * wet
    x = x / (float(np.max(np.abs(x))) or 1.0) * peak
    return np.asarray(x, dtype=np.float32)


def band_stem(k: int, mono: NDArray[np.float32], out: Path) -> Path:
    """`mono` in a band mix (a MUSDB window no P2g band uses: drums, bass, vocals and keys)
    separated by the production separator, as the notes stage sees it."""
    from stage_separation import config, models

    stem = out / "sep" / "guitar.wav"
    if not stem.is_file():
        windows = p2g_strings.free_windows()
        window = windows[k % len(windows)]
        guitar = np.repeat(mono[:, None], 2, axis=1)
        short = max(0, int(p2g_strings.AUGMENT_MIN_S * p2g.RATE) - len(guitar))
        guitar = np.pad(guitar, ((0, short), (0, 0)))  # the separator needs a whole chunk
        band = cast(
            NDArray[np.float32],
            sum(p2g.read(p2g.MUSDB / window / f"{s}.wav") for s in ("drums", "bass", "vocals"))
            + p2g_strings.keys_of(window),
        )
        p2g.write(out / "mixture.wav", p2g.mix(guitar, band)[0])
        spec = config.load().models["bs_roformer_sw"]
        models.separate("bs_roformer_sw", spec, out / "mixture.wav", out / "sep")
    return stem


def cmd_data(_: argparse.Namespace) -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    index: list[dict[str, Any]] = []
    rng = np.random.default_rng(AMP_SEED)
    for k, (source, mono, notes) in enumerate(training_sources()):
        amp = amp_chain(mono, rng)  # drawn for every source: reruns get the same chains
        versions: dict[str, NDArray[np.float32] | None] = {"clean": mono, "amp": amp}
        if source != "guitarset" or k % 3 == 0:
            versions["stem"] = None  # the amp version's band stem
        for kind, audio in versions.items():
            dest = OUT / "data" / f"{k:04d}.{kind}.npz"
            if not dest.is_file():
                if audio is None:
                    stem = band_stem(k, amp, OUT / "audio" / f"{k:04d}")
                    audio = p2g.read(stem).mean(axis=1)
                feat = guitab.features(audio.astype(np.float32)).astype(np.float16)
                tab, onset = frame_labels(notes, len(feat))
                dest.parent.mkdir(parents=True, exist_ok=True)
                np.savez(dest, feat=feat, tab=tab, onset=onset)
            index.append({"k": k, "source": source, "kind": kind, "path": str(dest)})
        print(f"data {k} {source}", flush=True)
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


def load_tracks(kinds: set[str]) -> list[dict[str, NDArray[Any]]]:
    index = cast(list[dict[str, Any]], json.loads((OUT / "index.json").read_text()))
    tracks: list[dict[str, NDArray[Any]]] = []
    for row in index:
        if row["kind"] in kinds:
            with np.load(row["path"]) as data:
                tracks.append({k: data[k] for k in data.files})
    return tracks


# Checkpoint selection: P2g fit items sharing no player or guitar with the training sources.
SELECT: dict[str, str] = {
    "GuitarSet player 04": r"^gs-04_",
    "Guitar-TECHS music 03/06/09/12": r"^techs-music(03|06|09|12)(-\d+)?$",
    "IDMT AR guitar": r"^idmt-AR-",
}


def select_set() -> dict[str, list[tuple[p2g.Item, NDArray[np.float32]]]]:
    """Per tier: (item, CQT of its hard-band stem), cached."""
    import re

    out: dict[str, list[tuple[p2g.Item, NDArray[np.float32]]]] = {t: [] for t in SELECT}
    for item in p2g.load_items():
        tier = next((t for t, pattern in SELECT.items() if re.search(pattern, item.id)), None)
        if tier is None:
            continue
        cache = OUT / "select" / f"{item.id}.npy"
        if not cache.is_file():
            mono = p2g.read(p2g.stem_path(item, "bs_roformer_sw", "hard")).mean(axis=1)
            cache.parent.mkdir(parents=True, exist_ok=True)
            np.save(cache, guitab.features(mono.astype(np.float32)))
        out[tier].append((item, np.load(cache)))
    return out


class TorchSession:
    """The training model behind the ONNX session interface guitab.predict uses."""

    def __init__(self, model: Any, device: str) -> None:
        self.model, self.device = model, device

    def run(self, _: list[str], feeds: dict[str, NDArray[np.float32]]) -> list[NDArray[Any]]:
        import torch

        with torch.no_grad():
            out = self.model(torch.from_numpy(feeds["x"]).to(self.device))
            return [
                torch.softmax(out["tab"].float(), -1).cpu().numpy(),
                torch.sigmoid(out["onset"].float()).cpu().numpy(),
            ]


def select_score(
    model: Any, device: str, items: dict[str, list[tuple[p2g.Item, NDArray[np.float32]]]]
) -> tuple[float, dict[str, float]]:
    """Mean over SELECT tiers of (mean onset F1 + pooled Tab F1 of Guitab's own strings) / 2."""
    from splitune_eval import scoring
    from splitune_eval.guitar_refs import EstNote, tab_counts

    model.eval()
    tiers: dict[str, float] = {}
    for tier, rows in items.items():
        onset_f1: list[float] = []
        totals = np.zeros(4)
        for item, feat in rows:
            tab, onset = guitab.predict(cast(Any, TorchSession(model, device)), feat)
            est = [
                EstNote(n.start / guitab.FPS, n.end / guitab.FPS, n.pitch, 6 - n.col, n.fret)
                for n in guitab.extract(tab, onset, guitab.GUITAB_DEFAULTS)
            ]
            ref = list(item.ref().notes)
            scores, _ = scoring.notes(p2g.note_events(ref), p2g.note_events(est))
            onset_f1.append(scores["onset_f1"])
            c = tab_counts(ref, est)
            totals += (c.ref, c.est, c.matched, c.tab_correct)
        tab_f1 = 2 * totals[3] / (totals[0] + totals[1]) if totals[0] + totals[1] else 0.0
        tiers[tier] = round((float(np.mean(onset_f1)) + float(tab_f1)) / 2, 4)
    model.train()
    return float(np.mean(list(tiers.values()))), tiers


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
    train = load_tracks(set(args.kinds))
    chosen = select_set()
    model = tab_model()
    model.load_state_dict(load_file(str(e25_weights())))
    model.to(device)
    optim = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-2)
    weights = [len(t["feat"]) for t in train]
    run = OUT / "runs" / args.name
    run.mkdir(parents=True, exist_ok=True)
    best, tiers = select_score(model, device, chosen)
    log: list[dict[str, Any]] = [{"step": 0, "select": best, "tiers": tiers}]
    print(f"step 0 select {best:.4f} {tiers} ({len(train)} train tracks)", flush=True)
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
            score, tiers = select_score(model, device, chosen)
            log.append({"step": step, "select": score, "tiers": tiers, "train": float(loss)})
            print(f"step {step} train {float(loss):.4f} select {score:.4f} {tiers}", flush=True)
            if score > best:
                best = score
                torch.save(model.state_dict(), run / "best.pt")
            torch.save(model.state_dict(), run / "last.pt")
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
    p.add_argument(
        "--kinds", nargs="+", choices=["clean", "amp", "stem"], default=["clean", "amp", "stem"]
    )
    p.set_defaults(fn=cmd_train)
    p = sub.add_parser("export")
    p.add_argument("--name", default="ft")
    p.add_argument("--out", required=True)
    p.set_defaults(fn=cmd_export)
    args = parser.parse_args()
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
