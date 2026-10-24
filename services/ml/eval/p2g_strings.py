"""Step 22 Phase 4: a per-note string classifier for the fret DP, trained apart from the P2g set.

    uv run python eval/p2g_strings.py features   # training + P2g test features (~/datasets/p2g)
    uv run python eval/p2g_strings.py augment    # the notes in a band, separated → stem features
    uv run python eval/p2g_strings.py train [--data clean stem]  # MLP → model + report

Training notes (never in the P2g test set): GuitarSet players 00-02 (acoustic, mic), Guitar-TECHS
single notes, scales and chords of both players (amp-miked electric; the test set uses its music
excerpts and vibrato recordings, so same players and rig: flagged), IDMT-SMT-Guitar dataset 1
(isolated notes and chords, four clean electric setups; the test licks are dataset 2 on other
guitars). Test notes: every P2g reference note with a string, on the clean guitar and on the
hard-band stem, at the reference onset and pitch (the classifier's own accuracy; the DP effect is
measured by p2g.py with transcribed notes).
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Iterable
from pathlib import Path
from typing import Any, cast

import numpy as np
from numpy.typing import NDArray

sys.path.insert(0, str(Path(__file__).resolve().parent))
import p2g
from splitune_eval.guitar_refs import STANDARD, RefNote
from splitune_eval.tab_metrics import guitarset_notes, load_jams
from stage_notes import strings

OUT = p2g.ROOT / "strings"
TRAIN_PLAYERS = ("00", "01", "02")
MAX_NOTES_PER_FILE = 400


def valid_strings(
    pitch: int, tuning: tuple[int, ...] = STANDARD, max_fret: int = 20
) -> NDArray[np.bool_]:
    return np.array([0 <= pitch - open_ <= max_fret for open_ in tuning])


def featurize(
    mono: NDArray[np.float32], notes: Iterable[RefNote]
) -> tuple[list[NDArray[np.float32]], list[int], list[int]]:
    feats: list[NDArray[np.float32]] = []
    labels: list[int] = []
    pitches: list[int] = []
    for n in notes:
        if n.string is None:
            continue
        feats.append(strings.note_features(mono, n.onset_s, n.pitch_midi))
        labels.append(n.string - 1)
        pitches.append(n.pitch_midi)
    return feats, labels, pitches


def training_sources() -> Iterable[tuple[str, Path, list[RefNote]]]:
    for jams in sorted((p2g.GUITARSET / "annotation").glob("*.jams")):
        if jams.stem.split("_")[0] in TRAIN_PLAYERS:
            notes = [
                RefNote(n.onset_s, n.offset_s, n.pitch_midi, n.string, n.fret)
                for n in guitarset_notes(load_jams(jams))
            ]
            yield "guitarset", p2g.GUITARSET / "audio_mono-mic" / f"{jams.stem}_mic.wav", notes
    techs = p2g.DATASETS / "guitar-techs"
    for part in ("singlenotes", "scales", "chords"):
        for player in ("P1", "P2"):
            base = techs / f"{player}_{part}"
            for midi in sorted((base / "midi").glob("midi_*.mid")):
                name = midi.stem.removeprefix("midi_")
                audio = base / "audio" / "micamp" / f"micamp_{name}.wav"
                if audio.is_file():
                    ref = p2g.techs_ref(midi, 0.0, float("inf"), vibrato=False)
                    yield "guitar-techs", audio, list(ref.notes)
    idmt1 = p2g.DATASETS / "idmt-smt-guitar" / "IDMT-SMT-GUITAR_V2" / "dataset1"
    for xml in sorted(idmt1.glob("*/annotation/*.xml")):
        audio = xml.parent.parent / "audio" / f"{xml.stem}.wav"
        if audio.is_file():
            yield "idmt-dataset1", audio, p2g.idmt_events(xml, 0.0)


def save(
    path: Path,
    feats: list[NDArray[np.float32]],
    labels: list[int],
    pitches: list[int],
    groups: list[str],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez(
        path,
        x=np.array(feats, dtype=np.float32).reshape(-1, strings.FEATURES),
        y=np.array(labels, dtype=np.int64),
        pitch=np.array(pitches, dtype=np.int64),
        group=np.array(groups),
    )


def cmd_features(_: argparse.Namespace) -> int:
    feats: list[NDArray[np.float32]] = []
    labels: list[int] = []
    pitches: list[int] = []
    groups: list[str] = []
    for source, audio, notes in training_sources():
        mono = p2g.read(audio).mean(axis=1)
        f, y, p = featurize(mono, notes[:MAX_NOTES_PER_FILE])
        feats += f
        labels += y
        pitches += p
        groups += [source] * len(y)
        print(f"train {source} {audio.name}: {len(y)}", flush=True)
    save(OUT / "train.npz", feats, labels, pitches, groups)
    for condition in ("clean", "stem.hard"):
        feats, labels, pitches, groups = [], [], [], []
        for item in p2g.load_items():
            path = (
                item.dir / "guitar.wav"
                if condition == "clean"
                else p2g.stem_path(item, "bs_roformer_sw", "hard")
            )
            f, y, p = featurize(p2g.read(path).mean(axis=1), item.ref().notes)
            feats += f
            labels += y
            pitches += p
            groups += [item.source] * len(y)
        save(OUT / f"test.{condition}.npz", feats, labels, pitches, groups)
        print(f"test {condition}: {len(labels)}", flush=True)
    return 0


AUGMENT_MAX_S = 60.0


def free_windows() -> list[str]:
    """MUSDB windows no P2g band uses: training mixes never share accompaniment with the test."""
    used = {r["window"] for r in json.loads((p2g.ROOT / "bands.json").read_text())}
    return [w.name for w in p2g.musdb_windows() if w.name not in used]


def keys_of(window: str) -> NDArray[np.float32]:
    """The window's "other" stem without its guitar (htdemucs_6s piano + other): the hard band."""
    from stage_separation import config, models

    out = OUT / "bands" / window
    if not (out / "keys.wav").is_file():
        spec = config.load().models[p2g.BAND_SEPARATOR]
        models.separate(p2g.BAND_SEPARATOR, spec, p2g.MUSDB / window / "other.wav", out)
        p2g.write(out / "keys.wav", p2g.read(out / "piano.wav") + p2g.read(out / "other.wav"))
    return p2g.read(out / "keys.wav")


def cmd_augment(_: argparse.Namespace) -> int:
    """Training recordings in a band (drums, bass, vocals, keys of a free window), separated by the
    production separator: features from the stem, as the notes stage sees it."""
    from stage_separation import config, models

    spec = config.load().models["bs_roformer_sw"]
    windows = free_windows()
    feats: list[NDArray[np.float32]] = []
    labels: list[int] = []
    pitches: list[int] = []
    groups: list[str] = []
    for k, (source, audio, notes) in enumerate(training_sources()):
        out = OUT / "augment" / f"{k:04d}"
        stem = out / "sep" / "guitar.wav"
        if not stem.is_file():
            guitar = p2g.read(audio)[: int(AUGMENT_MAX_S * p2g.RATE)]
            guitar = np.repeat(guitar.mean(axis=1)[:, None], 2, axis=1)
            window = windows[k % len(windows)]
            band = cast(
                NDArray[np.float32],
                sum(p2g.read(p2g.MUSDB / window / f"{s}.wav") for s in ("drums", "bass", "vocals"))
                + keys_of(window),
            )
            mixture = p2g.mix(guitar, band)[0]
            p2g.write(out / "mixture.wav", mixture)
            models.separate("bs_roformer_sw", spec, out / "mixture.wav", out / "sep")
        kept = [n for n in notes if n.onset_s < AUGMENT_MAX_S - 0.5][:MAX_NOTES_PER_FILE]
        f, y, p = featurize(p2g.read(stem).mean(axis=1), kept)
        feats += f
        labels += y
        pitches += p
        groups += [source] * len(y)
        print(f"augment {source} {audio.name}: {len(y)}", flush=True)
    save(OUT / "train.stem.npz", feats, labels, pitches, groups)
    return 0


CUE_FRET_RANGE = (-2, 22)  # a down-tuned or capo'd guitar can play a little outside standard


def string_probs(
    mono: NDArray[np.float32], notes: list[dict[str, Any]], model_path: Path
) -> list[list[float]]:
    """Per-note probability per string (string 1 first) from the trained classifier; strings that
    cannot reach the pitch (standard tuning ± a little) get 0."""
    import torch

    model = classifier(HIDDEN)
    model.load_state_dict(torch.load(model_path))
    model.eval()
    x = np.array(
        [strings.note_features(mono, n["onset_s"], n["pitch_midi"]) for n in notes],
        dtype=np.float32,
    )
    lo, hi = CUE_FRET_RANGE
    mask = np.array([[lo <= n["pitch_midi"] - o <= hi for o in STANDARD] for n in notes]).reshape(
        -1, 6
    )
    if not len(x):
        return []
    with torch.no_grad():
        logits = model(torch.tensor(x)).masked_fill(~torch.tensor(mask), -1e9)
        probs = torch.softmax(logits, dim=1).numpy()
    return [[round(float(v), 4) for v in row] for row in probs]


HIDDEN = 128


def classifier(hidden: int) -> Any:
    import torch

    return torch.nn.Sequential(
        torch.nn.Linear(strings.FEATURES, hidden),
        torch.nn.ReLU(),
        torch.nn.Dropout(0.2),
        torch.nn.Linear(hidden, hidden),
        torch.nn.ReLU(),
        torch.nn.Linear(hidden, 6),
    )


def masks(pitch: NDArray[np.int64]) -> NDArray[np.bool_]:
    return np.stack([valid_strings(int(p)) for p in pitch])


def load(path: Path) -> dict[str, Any]:
    data = np.load(path)
    return {k: data[k] for k in data.files}


def cmd_train(args: argparse.Namespace) -> int:
    import torch

    parts = [load(OUT / ("train.npz" if d == "clean" else "train.stem.npz")) for d in args.data]
    train = {k: np.concatenate([part[k] for part in parts]) for k in parts[0]}
    keep = masks(train["pitch"])[np.arange(len(train["y"])), train["y"]]  # label playable
    x = torch.tensor(train["x"][keep])
    y = torch.tensor(train["y"][keep])
    m = torch.tensor(masks(train["pitch"][keep]))
    torch.manual_seed(0)  # pyright: ignore[reportUnknownMemberType]
    model = classifier(HIDDEN)
    optim = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-3)
    for epoch in range(args.epochs):
        model.train()
        order = torch.randperm(len(y))
        total = 0.0
        for i in range(0, len(y), 512):
            idx = order[i : i + 512]
            logits = model(x[idx]).masked_fill(~m[idx], -1e9)
            loss = torch.nn.functional.cross_entropy(logits, y[idx])
            optim.zero_grad()
            loss.backward()  # pyright: ignore[reportUnknownMemberType]
            optim.step()  # pyright: ignore[reportUnknownMemberType]
            total += float(loss) * len(idx)
        if epoch % 10 == 9:
            print(f"epoch {epoch + 1}: loss {total / len(y):.3f}", flush=True)
    model.eval()
    groups = cast(NDArray[np.str_], train["group"][keep])
    report: list[str] = [
        f"# String classifier ({len(y)} training notes: "
        + ", ".join(f"{g} {int((groups == g).sum())}" for g in sorted({str(g) for g in groups}))
        + ")",
        "",
        "| condition | source | notes | accuracy | lowest-fret guess | top-2 |",
        "|---|---|---|---|---|---|",
    ]
    for condition in ("clean", "stem.hard"):
        test = load(OUT / f"test.{condition}.npz")
        mt = masks(test["pitch"])
        ok = mt[np.arange(len(test["y"])), test["y"]]
        with torch.no_grad():
            logits = model(torch.tensor(test["x"])).masked_fill(~torch.tensor(mt), -1e9).numpy()
        pred = logits.argmax(axis=1)
        top2 = np.argsort(-logits, axis=1)[:, :2]
        # Reference guess: the string that gives the lowest fret.
        frets = np.where(mt, test["pitch"][:, None] - np.array(STANDARD)[None, :], 99)
        lowest = frets.argmin(axis=1)
        for source in sorted(set(test["group"])):
            sel = ok & (test["group"] == source)
            report.append(
                f"| {condition} | {source} | {int(sel.sum())} | "
                f"{np.mean(pred[sel] == test['y'][sel]):.3f} | "
                f"{np.mean(lowest[sel] == test['y'][sel]):.3f} | "
                f"{np.mean((top2[sel] == test['y'][sel][:, None]).any(axis=1)):.3f} |"
            )
    text = "\n".join(report) + "\n"
    print(text)
    (OUT / f"report.{'+'.join(args.data)}.md").write_text(text, encoding="utf-8")
    torch.save(model.state_dict(), OUT / f"model.{'+'.join(args.data)}.pt")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n", 1)[0])
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("features").set_defaults(fn=cmd_features)
    sub.add_parser("augment").set_defaults(fn=cmd_augment)
    p = sub.add_parser("train")
    p.add_argument("--epochs", type=int, default=60)
    p.add_argument("--data", nargs="+", choices=["clean", "stem"], default=["clean"])
    p.set_defaults(fn=cmd_train)
    args = parser.parse_args()
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
