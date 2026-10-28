"""Prototype 2d: drum transcription on the owner's kind of songs (step 25; 08 §3 P2d).

    uv run python eval/p2d.py plan             # pick excerpts → eval/sets/p2d.yaml (committed)
    uv run python eval/p2d.py build            # cut / render / mix every excerpt → ~/datasets/p2d
    uv run python eval/p2d.py separate         # drum stems for every mixture (timed)
    uv run python eval/p2d.py predict --chain baseline [--condition ...] [--tier ...]
    uv run python eval/p2d.py report --chain baseline yourmt3  → eval/results/p2d/<date>.md + .csv

Tiers (reported apart, never merged without saying so):
- `real-mdb`: MDB Drums (MedleyDB): drum stem and full mix, 21 sub-classes.
- `real-enst`: ENST-Drums minus-one takes: wet drum mix + accompaniment (2/3 + 1/3, the DTM
  convention), three drummers, sticks / rods / brushes.
- `real-electronic`: RBMA13 (produced electronic music; kick / snare / hi-hat references only).
  The audio is the RBMA album the owner downloads; items without audio are skipped.
- `solo-drums`: IDMT-SMT-Drums v2 real and drum-machine loops (kick / snare / hi-hat).
- `rendered-band`: Groove MIDI test-split performances (GM-remapped) rendered through sampled
  acoustic kits (sfizz) and GM kits (FluidSynth), with room / compression / phone augmentation,
  mixed at -6 / 0 / +6 LU against MUSDB18-HQ test accompaniment (bass + other + vocals; tempo and
  key don't match: interference, not musical context).
- `drum-machine`: the same performances quantized to 16ths at flat velocity, through 808 /
  electronic kits, under accompaniment.

References: `ref.csv` (onset s, GM key) with every kit piece the source names; `classes` says
which classes an item scores (3 = kick / snare / hi-hat). Every prediction runs the shipped
`notes.drums` stage in-process (`splitune_eval.local`); bars run the shipped `quantizeDrumHits`
through the music-core CLI (`quantize-drums`) on the beats stage's grid for both sides.
Conditions: `clean` (the drums alone: a ceiling), `stem` (separated), `mixture`, `chosen` (what an
analysis feeds the stage: today always the stem). Datasets live under ~/datasets (licences in
docs/research/ml/transcription-drums.md); nothing here is committed but the manifest.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import statistics
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET
import zlib
from collections import Counter
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import mir_eval  # pyright: ignore[reportMissingTypeStubs]
import numpy as np
import pretty_midi  # pyright: ignore[reportMissingTypeStubs]
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
import yaml
from p2p import (
    FLUIDSYNTH,
    GM_SF2,
    SFIZZ,
    Audio,
    artefact,
    fit,
    loudness,
    music_core,
    phone,
    read_stereo,
    room,
    write,
)
from scipy.signal import butter, sosfilt  # pyright: ignore[reportMissingTypeStubs]
from splitune_eval import scoring
from splitune_eval.calibration import reliability
from splitune_eval.local import LocalRun, write_json
from splitune_eval.report import git_sha
from stage_notes import drum_kit

# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false

DATA = Path("~/datasets").expanduser()
ROOT = DATA / "p2d"
MDB = DATA / "mdb" / "MDB Drums"
ENST = DATA / "enst" / "ENST-drums-public"
IDMT = DATA / "idmt"
RBMA = DATA / "rbma13" / "rbma_13"
GROOVE = DATA / "groove" / "groove"
MUSDB = DATA / "musdb18hq" / "test"
KITS_DIR = DATA / "sounds" / "drums"
EVAL = Path(__file__).resolve().parent
ML_ROOT = EVAL.parent
MANIFEST = EVAL / "sets" / "p2d.yaml"
RESULTS = EVAL / "results" / "p2d"
RATE = 44100
WINDOW_S = 30.0
SEED = 25
TIERS = (
    "real-mdb",
    "real-enst",
    "real-electronic",
    "solo-drums",
    "rendered-band",
    "drum-machine",
)
CONDITIONS = ("clean", "stem", "mixture", "chosen")
LABELS = (
    "acoustic",
    "ballad",
    "dense",
    "brushes",
    "electronic",
    "live-room",
    "phone",
    "swing",
    "half-time",
    "cymbal-wash",
    "solo",
)
BAND_LEVEL_LU = {"loud": 6.0, "even": 0.0, "quiet": -6.0}  # drums relative to the band
CLASS3 = ("kick", "snare", "hihat")
TOLERANCES = (0.05, 0.03)

# Kits. `sfz` renders through sfizz, `gm` is a GS drum-kit program in GeneralUser GS (FluidSynth).
KITS: dict[str, dict[str, Any]] = {
    "drs": {"sfz": "DrumGizmo.DRSKit/DrumGizmo/DRSKit/Stereo/DrumGizmo DRSKit.sfz"},
    "muldjord": {
        "sfz": "DrumGizmo.MuldjordKit/DrumGizmo/MuldjordKit/Stereo/DrumGizmo MuldjordKit.sfz"
    },
    "rusty": {"sfz": "karoryfer.big-rusty-drums/Programs/01-full.sfz"},
    "unruly": {"sfz": "karoryfer.unruly-drums/Programs/01-kit-sticks.sfz"},
    "unruly-brushes": {
        "sfz": "karoryfer.unruly-drums/Programs/02-kit-brushes.sfz",
        "brushes": True,
    },
    "gm-standard": {"gm": 0},
    "gm-room": {"gm": 8},
    "gm-power": {"gm": 16},
    "gm-jazz": {"gm": 32},
    "gm-brush": {"gm": 40, "brushes": True},
    "gm-electronic": {"gm": 24, "electronic": True},
    "gm-808": {"gm": 25, "electronic": True},
    "retro": {"sfz": "TicTokMen.RetroDrums1/Tic Tok Men RetroDrums 1.sfz", "electronic": True},
}
ACOUSTIC_KITS = ("drs", "muldjord", "rusty", "unruly", "gm-standard", "gm-room", "gm-power")
JAZZ_KITS = ("unruly-brushes", "gm-brush", "gm-jazz")
MACHINE_KITS = ("gm-808", "gm-electronic", "retro", "gm-808")

# Groove MIDI (Roland TD-11) keys → GM (magenta.tensorflow.org/datasets/groove "Drum Mapping").
GROOVE_GM = {
    22: 42,  # hi-hat closed (edge)
    26: 46,  # hi-hat open (edge)
    58: 43,  # floor tom rim → floor tom
    40: 38,  # snare rim
    59: 51,  # ride edge
}
# MDB Drums sub-classes → GM.
MDB_GM = {
    "KD": 36, "SD": 38, "SDB": 38, "SDD": 38, "SDF": 38, "SDG": 38, "SDNS": 38, "SST": 37,
    "CHH": 42, "OHH": 46, "PHH": 44, "HIT": 50, "MHT": 47, "HFT": 43, "LFT": 41,
    "RDC": 51, "RDB": 53, "CRC": 49, "CHC": 52, "SPC": 55,
}  # fmt: skip
# ENST-Drums labels → GM (ENST documentation: c/cr = crash, rc = ride, ch = China, spl = splash,
# the digit names the cymbal; `c1` is scored as a crash; cowbell dropped).
ENST_GM = {
    "bd": 36, "sd": 38, "sd-": 38, "rs": 37, "cs": 37,
    "chh": 42, "ohh": 46,
    "c1": 49, "cr1": 49, "cr2": 49, "cr5": 49, "spl2": 55, "ch5": 52,
    "rc2": 51, "rc3": 51, "rc4": 51,
    "lt": 43, "lmt": 45, "mt": 47, "mtr": 47, "ltr": 43, "ht": 50, "lft": 41,
}  # fmt: skip
IDMT_GM = {"KD": 36, "SD": 38, "HH": 42}
RBMA_GM = {0: 36, 1: 38, 2: 42}

Hit = tuple[float, int]  # onset s, GM key


# --- references ----------------------------------------------------------------------------------


def write_ref(path: Path, hits: Iterable[Hit]) -> int:
    rows = sorted(h for h in hits if drum_kit.class_of(h[1]) is not None)
    path.write_text("".join(f"{t:.4f},{g}\n" for t, g in rows), encoding="utf-8")
    return len(rows)


def read_ref(path: Path) -> list[Hit]:
    rows = [line.split(",") for line in path.read_text(encoding="utf-8").splitlines() if line]
    return [(float(t), int(g)) for t, g in rows]


def window(hits: Iterable[Hit], t0: float, seconds: float = WINDOW_S) -> list[Hit]:
    return [(t - t0, g) for t, g in hits if t0 <= t < t0 + seconds]


def busiest_window(hits: list[Hit], duration: float) -> float:
    """Start (whole seconds) of the WINDOW_S stretch with the most hits."""
    if duration <= WINDOW_S:
        return 0.0
    starts = np.arange(0.0, duration - WINDOW_S + 1e-9, 1.0)
    counts = [sum(1 for t, _ in hits if s <= t < s + WINDOW_S) for s in starts]
    return float(starts[int(np.argmax(counts))])


def mdb_hits(name: str) -> list[Hit]:
    rows = (MDB / "annotations" / "subclass" / f"{name}_subclass.txt").read_text().split("\n")
    out: list[Hit] = []
    for row in rows:
        parts = row.split()
        if len(parts) == 2 and parts[1] in MDB_GM:
            out.append((float(parts[0]), MDB_GM[parts[1]]))
    return out


def enst_hits(path: Path) -> list[Hit]:
    out: list[Hit] = []
    for row in path.read_text().splitlines():
        parts = row.split()
        if len(parts) >= 2 and parts[1] in ENST_GM:
            out.append((float(parts[0]), ENST_GM[parts[1]]))
    return out


def idmt_hits(mix: str) -> list[Hit]:
    root = ET.parse(IDMT / "annotation_xml" / mix.replace(".wav", ".xml")).getroot()
    return [
        (float(e.findtext("onsetSec") or 0), IDMT_GM[(e.findtext("instrument") or "").strip()])
        for e in root.iter("event")
        if (e.findtext("instrument") or "").strip() in IDMT_GM
    ]


def rbma_hits(track: str) -> list[Hit]:
    rows = (RBMA / "annotations" / "drums" / f"{track}.txt").read_text().splitlines()
    return [(float(r.split()[0]), RBMA_GM[int(r.split()[1])]) for r in rows if r.strip()]


def groove_rows() -> list[dict[str, str]]:
    with (GROOVE / "info.csv").open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def groove_hits(midi_path: str) -> tuple[list[tuple[float, int, int]], float]:
    """(onset, GM key, velocity) and the performance tempo (bpm)."""
    midi = pretty_midi.PrettyMIDI(str(GROOVE / midi_path))
    notes = [
        (float(n.start), GROOVE_GM.get(int(n.pitch), int(n.pitch)), int(n.velocity))
        for inst in midi.instruments
        for n in inst.notes
    ]
    return sorted(notes), float(midi.get_tempo_changes()[1][0])


def swing_share(hits: list[tuple[float, int, int]], bpm: float) -> float:
    """Share of off-beat eighths played late (0.58-0.72 of the beat, swung) rather than near 0.5
    (straight); straight sixteenths at 0.75 fall outside both windows."""
    beat = 60.0 / bpm
    phases = [(t / beat) % 1.0 for t, _, _ in hits]
    straight = sum(1 for p in phases if 0.42 <= p < 0.58)
    swung = sum(1 for p in phases if 0.58 <= p <= 0.72)
    return swung / (straight + swung) if straight + swung else 0.0


# --- plan ----------------------------------------------------------------------------------------

MDB_PICKS = {
    "MusicDelta_80sRock": ["acoustic", "live-room"],
    "MusicDelta_BebopJazz": ["swing", "cymbal-wash", "live-room"],
    "MusicDelta_Britpop": ["acoustic", "live-room"],
    "MusicDelta_FunkJazz": ["acoustic", "dense", "live-room"],
    "MusicDelta_Punk": ["acoustic", "dense", "cymbal-wash", "live-room"],
    "MusicDelta_Reggae": ["acoustic", "half-time", "live-room"],
    "MusicDelta_SpeedMetal": ["dense", "cymbal-wash", "live-room"],
    "MusicDelta_SwingJazz": ["swing", "brushes", "live-room"],
}


def plan_mdb() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for i, (name, labels) in enumerate(MDB_PICKS.items()):
        hits = mdb_hits(name)
        duration = float(sf.info(str(mdb_audio(name, "mix"))).duration)
        items.append(
            {
                "id": f"real-mdb-{i:02d}",
                "labels": labels,
                "classes": 5,
                "kit_pieces": True,
                "source": {"kind": "mdb", "name": name},
                "window": [busiest_window(hits, duration), WINDOW_S],
            }
        )
    return items


def mdb_audio(name: str, which: str) -> Path:
    if which == "mix":
        return MDB / "audio" / "full_mix" / f"{name}_MIX.wav"
    return MDB / "audio" / "drum_only" / f"{name}_Drum.wav"


def enst_takes() -> list[Path]:
    return sorted(ENST.glob("drummer_*/annotation/*minus-one*.txt"))


def enst_style(take: Path) -> tuple[str, str]:
    """(style, stick type) from a take name such as `121_MIDI-minus-one_bigband_brushes`."""
    style, kind = take.stem.split("minus-one_", 1)[1].rsplit("_", 1)
    return style.split("-")[0], kind


def plan_enst(rng: np.random.Generator) -> list[dict[str, Any]]:
    """Eight minus-one takes over the three drummers, every stick type the takes have."""
    takes = enst_takes()
    by_kind: dict[str, list[Path]] = {}
    for take in takes:
        kind = enst_style(take)[1]
        by_kind.setdefault(kind, []).append(take)
    picks: list[Path] = []
    for kind in sorted(by_kind):
        pool = sorted(by_kind[kind])
        picks.append(pool[int(rng.integers(len(pool)))])
    rest = [t for t in takes if t not in picks]
    rng.shuffle(rest)
    picks += rest[: max(0, 8 - len(picks))]
    items: list[dict[str, Any]] = []
    for i, take in enumerate(sorted(picks[:8])):
        style, kind = enst_style(take)
        labels = ["live-room", "brushes" if kind == "brushes" else "acoustic"]
        if style in ("bigband", "blues", "charleston", "musette", "swing"):
            labels.append("swing")
        if style == "bossa":
            labels.append("ballad")
        hits = enst_hits(take)
        duration = max(t for t, _ in hits) + 1.0
        items.append(
            {
                "id": f"real-enst-{i:02d}",
                "labels": labels,
                "classes": 5,
                "kit_pieces": True,
                "source": {
                    "kind": "enst",
                    "drummer": take.parents[1].name,
                    "take": take.stem,
                },
                "window": [busiest_window(hits, duration), WINDOW_S],
            }
        )
    return items


def plan_rbma() -> list[dict[str, Any]]:
    """Six tracks, the busiest window of each (references exist without the audio)."""
    tracks = sorted(p.stem for p in (RBMA / "annotations" / "drums").glob("*.txt"))
    rng = np.random.default_rng(SEED)
    picks = sorted(rng.choice(tracks, size=6, replace=False).tolist())
    items: list[dict[str, Any]] = []
    for i, track in enumerate(picks):
        hits = rbma_hits(track)
        duration = max(t for t, _ in hits) + 1.0
        items.append(
            {
                "id": f"real-electronic-{i:02d}",
                "labels": ["electronic"],
                "classes": 3,
                "kit_pieces": False,
                "source": {"kind": "rbma", "track": track},
                "window": [busiest_window(hits, duration), WINDOW_S],
            }
        )
    return items


def plan_idmt() -> list[dict[str, Any]]:
    mixes = sorted(p.name for p in (IDMT / "audio").glob("*#MIX.wav"))
    real = [m for m in mixes if m.startswith("RealDrum")]
    machine = [m for m in mixes if m.startswith("TechnoDrum")]
    rng = np.random.default_rng(SEED)
    picks = [
        *rng.choice(real, 2, replace=False).tolist(),
        *rng.choice(machine, 2, replace=False).tolist(),
    ]
    return [
        {
            "id": f"solo-drums-{i:02d}",
            "labels": ["solo", "electronic" if m.startswith("Techno") else "acoustic"],
            "classes": 3,
            "kit_pieces": False,
            "source": {"kind": "idmt", "mix": m},
            "window": [0.0, WINDOW_S],
        }
        for i, m in enumerate(sorted(picks))
    ]


def groove_labels(
    hits: list[tuple[float, int, int]], bpm: float, style: str, quantized: bool
) -> list[str]:
    beat = 60.0 / bpm
    beats = max(1.0, (hits[-1][0] - hits[0][0]) / beat) if hits else 1.0
    hihat = sum(1 for _, g, _ in hits if drum_kit.class_of(g) == "hihat") / beats
    cymbals = sum(1 for _, g, _ in hits if drum_kit.class_of(g) == "cymbals") / beats
    labels: list[str] = []
    if bpm >= 140 or hihat >= 3.5:
        labels.append("dense")
    if bpm < 80:
        labels.append("ballad")
    if style.startswith(("hiphop", "reggae")):
        labels.append("half-time")
    if swing_share(hits, bpm) >= 0.5 or (style.startswith("jazz") and not quantized):
        labels.append("swing")
    if cymbals >= 1.5:
        labels.append("cymbal-wash")
    return labels


def plan_groove(rng: np.random.Generator) -> list[dict[str, Any]]:
    rows = [
        r
        for r in groove_rows()
        if r["split"] == "test"
        and r["beat_type"] == "beat"
        and r["time_signature"] == "4-4"
        and float(r["duration"]) >= WINDOW_S
    ]
    rng.shuffle(rows)
    # Every style in the split at least once, then the rest at random.
    by_style: dict[str, dict[str, str]] = {}
    for r in rows:
        by_style.setdefault(r["style"].split("/")[0], r)
    picks = list(by_style.values())
    picks += [r for r in rows if r not in picks][: 22 - len(picks)]
    tracks = sorted(p.name for p in MUSDB.iterdir() if p.is_dir())
    items: list[dict[str, Any]] = []
    levels = list(BAND_LEVEL_LU)
    for i, row in enumerate(picks[:22]):
        hits, bpm = groove_hits(row["midi_filename"])
        style = row["style"]
        machine = i >= 18
        labels = groove_labels(machine_hits(hits, bpm) if machine else hits, bpm, style, machine)
        if machine:
            kit = MACHINE_KITS[i - 18]
        elif "swing" in labels or style.startswith(("jazz", "soul")):
            kit = JAZZ_KITS[i % len(JAZZ_KITS)]
        else:
            kit = ACOUSTIC_KITS[i % len(ACOUSTIC_KITS)]
        spec = KITS[kit]
        labels += ["electronic"] if spec.get("electronic") else ["acoustic"]
        if spec.get("brushes"):
            labels.append("brushes")
        augment = "phone" if i in (3, 11) else ("room" if i % 3 == 0 else "dry")
        if augment == "room":
            labels.append("live-room")
        if augment == "phone":
            labels.append("phone")
        track = tracks[int(rng.integers(len(tracks)))]
        duration = float(row["duration"])
        start = float(np.floor(rng.uniform(0, max(0.0, duration - WINDOW_S))))
        items.append(
            {
                "id": f"drum-machine-{i - 18:02d}" if machine else f"rendered-band-{i:02d}",
                "labels": sorted(set(labels)),
                "classes": 5,
                "kit_pieces": not machine,
                "source": {
                    "kind": "groove",
                    "midi": row["midi_filename"],
                    "style": style,
                    "bpm": round(bpm, 2),
                    "kit": kit,
                    "augment": augment,
                    "machine": machine,
                    "band": track,
                    "band_start": float(np.floor(rng.uniform(20.0, 120.0))),
                    "level": levels[i % len(levels)],
                },
                "window": [start, WINDOW_S],
            }
        )
    return items


def cmd_plan(_: argparse.Namespace) -> int:
    rng = np.random.default_rng(SEED)
    items = [*plan_mdb(), *plan_enst(rng), *plan_rbma(), *plan_idmt(), *plan_groove(rng)]
    for i, item in enumerate(items):
        # Alternate fit / test inside each tier: thresholds and calibration fit on `fit` only.
        item["split"] = "fit" if i % 2 == 0 else "test"
    entries: list[dict[str, Any]] = [
        {
            "id": it["id"],
            "audio": f"{it['id']}/mixture.wav",
            "annotations": {"onsets": f"{it['id']}/ref.csv"},
            "tags": {
                "tier": it["id"].rsplit("-", 1)[0],
                "split": it["split"],
                "labels": " ".join(it["labels"]),
                "classes": str(it["classes"]),
                "kit_pieces": "yes" if it["kit_pieces"] else "no",
            },
            "p2d": {"source": it["source"], "window": it["window"]},
        }
        for it in items
    ]
    document = {
        "id": "p2d",
        "description": "Step 25 P2d: drum transcription on real recordings, solo loops and "
        "rendered Groove MIDI under MUSDB18-HQ bands (eval/p2d.py plan, seed 25)",
        "licence": "MDB Drums CC-BY-NC-SA-4.0, ENST-Drums CC-BY-NC-ND-4.0, IDMT-SMT-Drums "
        "CC-BY-NC-ND-4.0, RBMA13 annotations (research), Groove MIDI CC-BY-4.0, MUSDB18-HQ "
        "(research), sample libraries under their own licences",
        "provenance": "github.com/CarlSouthall/MDBDrums, Zenodo 7432188 (ENST), 7544164 (IDMT), "
        "3338373 (MUSDB18-HQ test), ifs.tuwien.ac.at/~vogl/datasets (RBMA13), magenta "
        "groove-v1.0.0-midionly; rendered and mixed by eval/p2d.py build",
        "root": "~/datasets/p2d",
        "split": "test",
        "tasks": ["notes", "sep"],
        "items": entries,
    }
    MANIFEST.write_text(
        "# Built locally by `eval/p2d.py build`; only this list is committed. `p2d` holds the\n"
        "# recipe of each excerpt (source, window, kit, band, augmentation).\n"
        + yaml.safe_dump(document, sort_keys=False, width=100),
        encoding="utf-8",
    )
    counts = Counter(e["tags"]["tier"] for e in entries)
    labels = Counter(lab for e in entries for lab in e["tags"]["labels"].split())
    print(f"{len(entries)} items: {dict(counts)}\nlabels: {dict(labels)}")
    return 0


def load_items(tiers: Iterable[str] = TIERS) -> list[dict[str, Any]]:
    document = cast(dict[str, Any], yaml.safe_load(MANIFEST.read_text(encoding="utf-8")))
    wanted = set(tiers)
    items: list[dict[str, Any]] = []
    for entry in document["items"]:
        tags = entry["tags"]
        if tags["tier"] not in wanted:
            continue
        items.append(
            {
                "id": entry["id"],
                "tier": tags["tier"],
                "split": tags["split"],
                "labels": str(tags["labels"]).split(),
                "classes": int(tags["classes"]),
                "kit_pieces": tags["kit_pieces"] == "yes",
                "source": entry["p2d"]["source"],
                "window": entry["p2d"]["window"],
                "dir": str(ROOT / entry["id"]),
            }
        )
    return items


# --- build ---------------------------------------------------------------------------------------


def normalize(audio: Audio) -> Audio:
    return audio * np.float32(0.9 / max(float(np.max(np.abs(audio))), 1e-6))


def compress(audio: Audio, threshold_db: float = -18.0, ratio: float = 4.0) -> Audio:
    """A plain feed-forward compressor on a 10 ms envelope (bus glue on rendered kits)."""
    env = np.abs(audio).max(axis=1)
    sos = butter(1, 1 / (0.01 * np.pi), fs=RATE, output="sos")
    smooth = np.maximum(np.asarray(sosfilt(sos, env), dtype=np.float64), 1e-6)
    level = 20 * np.log10(smooth / max(float(smooth.max()), 1e-6))
    gain_db = np.minimum(0.0, (threshold_db - level) * (1 - 1 / ratio))
    return np.asarray(audio * (10 ** (gain_db / 20))[:, None], dtype=np.float32)


def render_kit(hits: list[tuple[float, int, int]], kit: str, seconds: float) -> Audio:
    spec = KITS[kit]
    midi = pretty_midi.PrettyMIDI(initial_tempo=120.0)
    inst = pretty_midi.Instrument(program=int(spec.get("gm", 0)), is_drum=True)
    inst.notes = [pretty_midi.Note(velocity=v, pitch=g, start=t, end=t + 0.1) for t, g, v in hits]
    inst.control_changes.append(pretty_midi.ControlChange(7, 127, seconds + 1.5))
    midi.instruments.append(inst)
    with tempfile.TemporaryDirectory() as tmp:
        mid, wav = Path(tmp) / "in.mid", Path(tmp) / "out.wav"
        midi.write(str(mid))
        if "sfz" in spec:
            cmd = [str(SFIZZ), "--sfz", str(KITS_DIR / spec["sfz"]), "--midi", str(mid)]
            cmd += ["--wav", str(wav), "-s", str(RATE), "--use-eot"]
        else:
            cmd = [str(FLUIDSYNTH), "-ni", "-q", "-g", "0.6", "-r", str(RATE), "-F", str(wav)]
            cmd += [str(GM_SF2), str(mid)]
        subprocess.run(cmd, check=True, capture_output=True)
        audio = read_stereo(wav)
    return fit(audio, int(seconds * RATE))


_KIT_KEYS: dict[str, set[int]] = {}


def kit_keys(kit: str) -> set[int]:
    """The GM drum keys the kit sounds (each key rendered alone; silent ones are dropped from
    renders and references, so a reference never asks for a sound the audio lacks)."""
    if kit not in _KIT_KEYS:
        cache = ROOT / "_kits" / f"{kit}.json"
        if cache.is_file():
            _KIT_KEYS[kit] = set(json.loads(cache.read_text()))
        else:
            keys = sorted(drum_kit.GM_CLASS)
            hits = [(0.5 + 1.0 * i, g, 100) for i, g in enumerate(keys)]
            audio = render_kit(hits, kit, len(keys) + 1.0).mean(axis=1)
            sound = {
                g
                for i, g in enumerate(keys)
                if float(np.max(np.abs(audio[int((0.5 + i) * RATE) : int((1.4 + i) * RATE)])))
                > 1e-3
            }
            write_json(cache, sorted(sound))
            _KIT_KEYS[kit] = sound
    return _KIT_KEYS[kit]


def machine_hits(hits: list[tuple[float, int, int]], bpm: float) -> list[tuple[float, int, int]]:
    """Quantized to 16ths at a flat velocity, as a drum machine plays it."""
    step = 60.0 / bpm / 4
    seen: set[tuple[float, int]] = set()
    out: list[tuple[float, int, int]] = []
    for t, g, _ in hits:
        key = (round(t / step) * step, g)
        if key not in seen:
            seen.add(key)
            out.append((key[0], g, 100))
    return sorted(out)


def band(track: str, start: float) -> Audio:
    folder = MUSDB / track
    parts = [read_stereo(folder / f"{s}.wav", start, WINDOW_S) for s in ("bass", "other", "vocals")]
    return fit(np.sum([fit(p, int(WINDOW_S * RATE)) for p in parts], axis=0), int(WINDOW_S * RATE))


def mix(drums: Audio, accompaniment: Audio, level: str) -> tuple[Audio, Audio]:
    gain_db = loudness(accompaniment) - loudness(drums) + BAND_LEVEL_LU[level]
    drums = drums * np.float32(10 ** (gain_db / 20))
    mixture = drums + accompaniment
    scale = np.float32(min(1.0, 0.9 / float(np.max(np.abs(mixture)))))
    return drums * scale, mixture * scale


def build_groove(item: dict[str, Any], out: Path) -> None:
    src = item["source"]
    t0, seconds = item["window"]
    hits, bpm = groove_hits(src["midi"])
    if src["machine"]:
        hits = machine_hits(hits, bpm)
    keys = kit_keys(src["kit"])
    hits = [(t - t0, g, v) for t, g, v in hits if t0 <= t < t0 + seconds and g in keys]
    rng = np.random.default_rng(zlib.crc32(item["id"].encode()))
    drums = render_kit(hits, src["kit"], seconds)
    if src["augment"] == "room":
        drums = room(drums, rng, rt60=0.9, wet=0.3)
    drums = compress(drums)
    drums, mixture = mix(drums, band(src["band"], src["band_start"]), src["level"])
    if src["augment"] == "phone":
        mixture = phone(mixture)
    write(out / "drums.wav", drums)
    write(out / "mixture.wav", mixture)
    write_ref(out / "ref.csv", [(t, g) for t, g, _ in hits])


def build_mdb(item: dict[str, Any], out: Path) -> None:
    name = item["source"]["name"]
    t0, seconds = item["window"]
    write(
        out / "drums.wav",
        fit(read_stereo(mdb_audio(name, "drums"), t0, seconds), int(seconds * RATE)),
    )
    write(
        out / "mixture.wav",
        fit(read_stereo(mdb_audio(name, "mix"), t0, seconds), int(seconds * RATE)),
    )
    write_ref(out / "ref.csv", window(mdb_hits(name), t0, seconds))


def build_enst(item: dict[str, Any], out: Path) -> None:
    src = item["source"]
    t0, seconds = item["window"]
    folder = ENST / src["drummer"]
    drums = read_stereo(folder / "audio" / "wet_mix" / f"{src['take']}.wav", t0, seconds)
    accompaniment = read_stereo(
        folder / "audio" / "accompaniment" / f"{src['take']}.wav", t0, seconds
    )
    frames = int(seconds * RATE)
    drums = fit(drums, frames) * np.float32(2 / 3)
    accompaniment = fit(accompaniment, frames) * np.float32(1 / 3)
    scale = np.float32(0.9 / max(float(np.max(np.abs(drums + accompaniment))), 1e-6))
    write(out / "drums.wav", np.asarray(drums * scale, dtype=np.float32))
    write(out / "mixture.wav", np.asarray((drums + accompaniment) * scale, dtype=np.float32))
    write_ref(
        out / "ref.csv",
        window(enst_hits(folder / "annotation" / f"{src['take']}.txt"), t0, seconds),
    )


def build_idmt(item: dict[str, Any], out: Path) -> None:
    mix_name = item["source"]["mix"]
    audio = read_stereo(IDMT / "audio" / mix_name)
    seconds = min(WINDOW_S, len(audio) / RATE)
    write(out / "drums.wav", fit(audio, int(seconds * RATE)))
    write(out / "mixture.wav", fit(audio, int(seconds * RATE)))
    write_ref(out / "ref.csv", window(idmt_hits(mix_name), 0.0, seconds))


def rbma_audio(track: str) -> Path | None:
    folder = RBMA / "audio"
    return next(
        (p for p in sorted(folder.glob(f"{track}.*")) if p.suffix in (".wav", ".mp3", ".flac")),
        None,
    )


def build_rbma(item: dict[str, Any], out: Path) -> None:
    track = item["source"]["track"]
    t0, seconds = item["window"]
    audio = rbma_audio(track)
    if audio is None:
        raise FileNotFoundError(track)
    write(out / "mixture.wav", fit(read_stereo(audio, t0, seconds), int(seconds * RATE)))
    write_ref(out / "ref.csv", window(rbma_hits(track), t0, seconds))


def cmd_build(args: argparse.Namespace) -> int:
    builders = {
        "mdb": build_mdb,
        "enst": build_enst,
        "idmt": build_idmt,
        "rbma": build_rbma,
        "groove": build_groove,
    }
    for item in load_items(args.tier):
        out = Path(item["dir"])
        if (out / "ref.csv").is_file() and not args.force:
            continue
        out.mkdir(parents=True, exist_ok=True)
        try:
            builders[item["source"]["kind"]](item, out)
        except FileNotFoundError as missing:
            print(f"{item['id']}: skipped, no audio for {missing}", flush=True)
            continue
        n = len(read_ref(out / "ref.csv"))
        print(f"{item['id']} {' '.join(item['labels'])}: {n} hits", flush=True)
    return 0


# --- separation and predictions ------------------------------------------------------------------

CHAINS: dict[str, dict[str, Any]] = {
    # Step 25's baseline: BS-Roformer-SW drum stem → ADTOF, published thresholds.
    "baseline": {"separator": "bs_roformer_sw", "notes": {"transcriber": "adtof"}},
    # Reference row: YourMT3+ drums (GM keys it names itself).
    "yourmt3": {"separator": "bs_roformer_sw", "notes": {"transcriber": "yourmt3"}},
}


def built(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [i for i in items if (Path(i["dir"]) / "mixture.wav").is_file()]


def stem_dir(item: dict[str, Any], separator: str) -> Path:
    return Path(item["dir"]) / f"sep-{separator}"


def cmd_separate(args: argparse.Namespace) -> int:
    from stage_separation import config, models  # torch + audio-separator: only here

    cfg = config.load()
    for item in built(load_items(args.tier)):
        out = stem_dir(item, args.separator)
        if (out / "drums.wav").is_file():
            continue
        result = models.separate(
            args.separator, cfg.models[args.separator], Path(item["dir"]) / "mixture.wav", out
        )
        write_json(out / "timing.json", {"seconds": result.seconds, "audio_s": WINDOW_S})
        print(f"{args.separator} {item['id']}: {result.seconds:.1f}s", flush=True)
    return 0


def notes_config(chain: dict[str, Any], path: Path) -> None:
    base = cast(
        dict[str, Any], yaml.safe_load((ML_ROOT / "config" / "notes.personal.yaml").read_text())
    )
    if chain["notes"] is not None:
        base["instruments"]["drums"] = chain["notes"]
    path.write_text(yaml.safe_dump(base), encoding="utf-8")


def run_path(chain: str, condition: str, item: dict[str, Any]) -> Path:
    return ROOT / "runs" / chain / condition / f"{item['id']}.json"


def cmd_predict(args: argparse.Namespace) -> int:
    chain = CHAINS[args.chain]
    with tempfile.TemporaryDirectory() as tmp:
        config = Path(tmp) / "notes.yaml"
        notes_config(chain, config)
        os.environ["ML_NOTES_CONFIG"] = str(config)
        local = LocalRun(Path(tmp) / "work")
        for item in built(load_items(args.tier)):
            base = Path(item["dir"])
            decoded_mix = local.decode(base / "mixture.wav")
            if not (base / "beats.json").is_file():
                local.keep(local.run("beats", {}, decoded_mix), "beats", base / "beats.json")
            for condition in args.condition:
                dest = run_path(args.chain, condition, item)
                if dest.is_file():
                    continue
                source = "stem" if condition == "chosen" else condition
                if source == "clean" and not (base / "drums.wav").is_file():
                    continue
                decoded = local.decode(base / ("drums.wav" if source == "clean" else "mixture.wav"))
                inputs: dict[str, str] = {"beats": str(base / "beats.json")}
                if source == "stem":
                    sep = stem_dir(item, chain["separator"])
                    if not (sep / "drums.wav").is_file():
                        continue
                    stems = {
                        i: sep / f"{i}.wav"
                        for i in ("drums", "bass")
                        if (sep / f"{i}.wav").is_file()
                    }
                    inputs["separation"] = str(
                        local.separation(
                            decoded,
                            stems,
                            "drums",
                            chain["separator"],
                            Path(tmp) / "separation.json",
                        )
                    )
                started = time.monotonic()
                out = local.run("notes.drums", inputs, decoded)
                seconds = time.monotonic() - started
                local.keep(out, "notes", dest)
                write_json(
                    dest.with_suffix(".timing.json"),
                    {"seconds": seconds, "audio_s": decoded.duration_s},
                )
                print(f"{args.chain} {condition} {item['id']}: {seconds:.1f}s", flush=True)
    return 0


# --- scoring -------------------------------------------------------------------------------------


def classes_for(item: dict[str, Any]) -> tuple[str, ...]:
    return CLASS3 if item["classes"] == 3 else drum_kit.CLASSES


def by_class(hits: Iterable[Hit], classes: tuple[str, ...]) -> dict[str, np.ndarray]:
    out: dict[str, list[float]] = {c: [] for c in classes}
    for t, g in hits:
        cls = drum_kit.class_of(g)
        if cls in out:
            out[cls].append(t)
    return {c: np.array(sorted(v)) for c, v in out.items()}


def match(ref: np.ndarray, est: np.ndarray, tolerance: float) -> list[tuple[int, int]]:
    if len(ref) == 0 or len(est) == 0:
        return []
    return cast(list[tuple[int, int]], mir_eval.util.match_events(ref, est, tolerance))


def onset_scores(
    ref: list[Hit], est: list[Hit], classes: tuple[str, ...], tolerance: float
) -> dict[str, Any]:
    r, e = by_class(ref, classes), by_class(est, classes)
    per: dict[str, tuple[int, int, int]] = {}
    for c in classes:
        per[c] = (len(match(r[c], e[c], tolerance)), len(r[c]), len(e[c]))
    tp = sum(v[0] for v in per.values())
    nr = sum(v[1] for v in per.values())
    ne = sum(v[2] for v in per.values())
    f1 = {c: (2 * v[0] / (v[1] + v[2]) if v[1] + v[2] else float("nan")) for c, v in per.items()}
    present = [f1[c] for c in classes if per[c][1] > 0]
    return {
        "f1": 2 * tp / (nr + ne) if nr + ne else float("nan"),
        "precision": tp / ne if ne else float("nan"),
        "recall": tp / nr if nr else float("nan"),
        "class_mean_f1": float(np.mean(present)) if present else float("nan"),
        "per_class": f1,
        "counts": per,
    }


def kit_piece_scores(ref: list[Hit], est: list[dict[str, Any]]) -> dict[str, tuple[int, int]]:
    """(correct, matched) kit-piece choices among hits matched within their class at ±50 ms:
    hi-hat open vs closed (pedal ignored), crash vs ride (bell counts as ride), tom line."""

    def group(gm: int) -> str | None:
        piece = drum_kit.KIT_PIECE.get(gm)
        if piece is None:
            return None
        if piece.startswith("hh"):
            return None if piece == "hh_pedal" else "hihat"
        if piece.startswith("tom"):
            return "toms"
        return "cymbals"

    def piece(gm: int) -> str:
        p = drum_kit.KIT_PIECE.get(gm, "")
        return "ride" if p == "ride_bell" else p

    out: dict[str, tuple[int, int]] = {}
    for kind in ("hihat", "cymbals", "toms"):
        r = sorted((t, g) for t, g in ref if group(g) == kind)
        e = sorted((float(h["onset_s"]), int(h["gm_note"])) for h in est if h["class5"] == kind)
        pairs = match(np.array([t for t, _ in r]), np.array([t for t, _ in e]), 0.05)
        correct = sum(1 for i, j in pairs if piece(r[i][1]) == piece(e[j][1]))
        out[kind] = (correct, len(pairs))
    return out


def drum_doc(hits: list[dict[str, Any]], duration: float) -> dict[str, Any]:
    return artefact("notes.drums", duration, {"instrument": "drums", "hits": hits})


def ref_doc(ref: list[Hit], duration: float) -> dict[str, Any]:
    hits = [
        {
            "id": f"r{i:06d}",
            "onset_s": t,
            "class5": drum_kit.class_of(g),
            "gm_note": g,
            "approximate": False,
            "confidence": 1.0,
        }
        for i, (t, g) in enumerate(sorted(ref))
    ]
    return drum_doc(hits, duration)


def bar_patterns(
    result: dict[str, Any], classes: tuple[str, ...]
) -> dict[int, frozenset[tuple[str, int, int]]]:
    bars: dict[int, set[tuple[str, int, int]]] = {}
    for h in result["hits"]:
        if h["class5"] in classes:
            bars.setdefault(int(h["bar"]), set()).add((h["class5"], int(h["beat"]), int(h["tick"])))
    return {b: frozenset(v) for b, v in bars.items()}


def bar_scores(item: dict[str, Any], ref: list[Hit], est: dict[str, Any]) -> dict[str, float]:
    """Both sides quantized by the shipped quantizeDrumHits on the beats stage's grid: share of
    bars whose pattern (class, beat, tick) matches exactly, mean per-bar Jaccard, the estimate's
    residual-flag share and swing-bar share."""
    beats = json.loads((Path(item["dir"]) / "beats.json").read_text(encoding="utf-8"))
    duration = float(est["duration_s"])
    q_est = music_core("quantize-drums", {"drums": est, "beats": beats})
    q_ref = music_core("quantize-drums", {"drums": ref_doc(ref, duration), "beats": beats})
    classes = classes_for(item)
    pe, pr = bar_patterns(q_est, classes), bar_patterns(q_ref, classes)
    bars = sorted(set(pe) | set(pr))
    exact = [pe.get(b, frozenset()) == pr.get(b, frozenset()) for b in bars]
    jaccard = [
        len(pe.get(b, frozenset()) & pr.get(b, frozenset()))
        / max(1, len(pe.get(b, frozenset()) | pr.get(b, frozenset())))
        for b in bars
    ]
    hits = q_est["hits"]
    all_bars = {int(h["bar"]) for h in hits}
    return {
        "bar_exact": float(np.mean(exact)) if bars else float("nan"),
        "bar_jaccard": float(np.mean(jaccard)) if bars else float("nan"),
        "residual_flagged": float(np.mean([h["residual_flagged"] for h in hits]))
        if hits
        else float("nan"),
        "swing_bars": len(set(q_est["swing_bars"]) & all_bars) / max(1, len(all_bars)),
        "ref_swing_bars": len(set(q_ref["swing_bars"]))
        / max(1, len({int(h["bar"]) for h in q_ref["hits"]})),
    }


def stem_usdr(item: dict[str, Any], separator: str) -> float:
    clean = Path(item["dir"]) / "drums.wav"
    stem = stem_dir(item, separator) / "drums.wav"
    if item["tier"] == "solo-drums" or not clean.is_file() or not stem.is_file():
        return float("nan")
    ref, est = read_stereo(clean), read_stereo(stem)
    n = min(len(ref), len(est))
    return scoring.usdr(ref[:n].astype(np.float64), est[:n].astype(np.float64))


def separation_seconds(item: dict[str, Any], separator: str) -> float:
    path = stem_dir(item, separator) / "timing.json"
    return float(json.loads(path.read_text())["seconds"]) if path.is_file() else float("nan")


def scores(
    chain: str, items: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], list[tuple[float, int, str, str]]]:
    """One row per item and condition; (confidence, correct, class, split) per estimated hit of
    the `chosen` runs."""
    rows: list[dict[str, Any]] = []
    confidences: list[tuple[float, int, str, str]] = []
    separator = CHAINS[chain]["separator"]
    for item in items:
        base = Path(item["dir"])
        if not (base / "ref.csv").is_file():
            continue
        ref = read_ref(base / "ref.csv")
        classes = classes_for(item)
        for condition in CONDITIONS:
            path = run_path(chain, condition, item)
            if not path.is_file():
                continue
            doc = json.loads(path.read_text(encoding="utf-8"))
            hits = [h for h in doc["hits"] if h["class5"] in classes]
            est = [(float(h["onset_s"]), int(h["gm_note"])) for h in hits]
            row: dict[str, Any] = {
                "chain": chain,
                "item": item["id"],
                "tier": item["tier"],
                "split": item["split"],
                "labels": " ".join(item["labels"]),
                "condition": condition,
                "ref_hits": len(ref),
                "est_hits": len(est),
            }
            for tol in TOLERANCES:
                s = onset_scores(ref, est, classes, tol)
                ms = round(tol * 1000)
                row[f"f1_{ms}"] = s["f1"]
                row[f"precision_{ms}"] = s["precision"]
                row[f"recall_{ms}"] = s["recall"]
                row[f"class_mean_f1_{ms}"] = s["class_mean_f1"]
                if tol == 0.05:
                    for c in drum_kit.CLASSES:
                        row[f"f1_{c}"] = s["per_class"].get(c, float("nan"))
            row["approximate_share"] = (
                sum(1 for h in hits if h["approximate"]) / len(hits) if hits else float("nan")
            )
            if item["kit_pieces"]:
                for kind, (ok, n) in kit_piece_scores(ref, hits).items():
                    row[f"kit_{kind}_correct"] = ok
                    row[f"kit_{kind}_matched"] = n
            row.update(bar_scores(item, ref, doc))
            timing = json.loads(path.with_suffix(".timing.json").read_text())
            row["notes_s_per_30s"] = float(timing["seconds"]) * 30.0 / float(timing["audio_s"])
            if condition in ("stem", "chosen"):
                row["separation_s_per_30s"] = separation_seconds(item, separator) * 30.0 / WINDOW_S
                row["stem_usdr"] = stem_usdr(item, separator)
            rows.append(row)
            if condition == "chosen":
                r = by_class(ref, classes)
                for c in classes:
                    mine = sorted(
                        (float(h["onset_s"]), float(h["confidence"]))
                        for h in hits
                        if h["class5"] == c
                    )
                    hit = {j for _, j in match(r[c], np.array([t for t, _ in mine]), 0.05)}
                    confidences += [
                        (conf, int(j in hit), c, item["split"]) for j, (_, conf) in enumerate(mine)
                    ]
    return rows, confidences


# --- report --------------------------------------------------------------------------------------


def mean(rows: list[dict[str, Any]], key: str) -> float:
    values = [float(r[key]) for r in rows if key in r and not np.isnan(float(r[key]))]
    return float(np.mean(values)) if values else float("nan")


def fmt(x: float, digits: int = 3) -> str:
    return "—" if np.isnan(x) else f"{x:.{digits}f}"


def table(
    rows: list[dict[str, Any]], head: str, groups: list[tuple[str, list[dict[str, Any]]]]
) -> list[str]:
    lines = [
        f"| {head} | items | F1 ±50 | P | R | F1 ±30 | class-mean F1 | bar exact | bar Jaccard "
        "| approx. share |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for name, sel in groups:
        if not sel:
            continue
        lines.append(
            f"| {name} | {len(sel)} | {fmt(mean(sel, 'f1_50'))} | "
            f"{fmt(mean(sel, 'precision_50'))} | "
            f"{fmt(mean(sel, 'recall_50'))} | {fmt(mean(sel, 'f1_30'))} | "
            f"{fmt(mean(sel, 'class_mean_f1_50'))} | {fmt(mean(sel, 'bar_exact'))} | "
            f"{fmt(mean(sel, 'bar_jaccard'))} | {fmt(mean(sel, 'approximate_share'))} |"
        )
    return lines


def class_table(rows: list[dict[str, Any]]) -> list[str]:
    lines = ["| tier | " + " | ".join(drum_kit.CLASSES) + " |", "|---|" + "---|" * 5]
    for tier in TIERS:
        sel = [r for r in rows if r["tier"] == tier]
        if sel:
            lines.append(
                f"| {tier} | "
                + " | ".join(fmt(mean(sel, f"f1_{c}")) for c in drum_kit.CLASSES)
                + " |"
            )
    return lines


def kit_table(rows: list[dict[str, Any]]) -> list[str]:
    lines = [
        "| tier | hi-hat open/closed | crash/ride | tom line | approx. share |",
        "|---|---|---|---|---|",
    ]
    for tier in TIERS:
        sel = [r for r in rows if r["tier"] == tier]
        if not sel:
            continue
        cells = []
        for kind in ("hihat", "cymbals", "toms"):
            ok = sum(int(r.get(f"kit_{kind}_correct", 0)) for r in sel)
            n = sum(int(r.get(f"kit_{kind}_matched", 0)) for r in sel)
            cells.append(f"{ok / n:.3f} ({n})" if n else "—")
        lines.append(
            f"| {tier} | " + " | ".join(cells) + f" | {fmt(mean(sel, 'approximate_share'))} |"
        )
    return lines


def cmd_report(args: argparse.Namespace) -> int:
    items = load_items(args.tier)
    rows: list[dict[str, Any]] = []
    confidences: dict[str, list[tuple[float, int, str, str]]] = {}
    for chain in args.chain:
        r, c = scores(chain, items)
        rows += r
        confidences[chain] = c
    RESULTS.mkdir(parents=True, exist_ok=True)
    date = datetime.now(UTC).strftime("%Y-%m-%d")
    stem = f"{date}-{args.name}" if args.name else date
    keys: list[str] = []
    for r in rows:
        keys += [k for k in r if k not in keys]
    with (RESULTS / f"{stem}.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(rows)
    from splitune_ml_core import register
    from splitune_ml_core.device import torch_device

    counts = Counter(i["tier"] for i in items if (Path(i["dir"]) / "mixture.wav").is_file())
    out = [
        f"# Prototype 2d — drums ({date}{', ' + args.name if args.name else ''})",
        "",
        f"git `{git_sha()}` · ADTOF `{register.model('adtof-frame-rnn').version}` · YourMT3+ "
        f"`{register.model('yourmt3-moe').version[:24]}…` · separator per chain · device "
        f"`{torch_device()}` (this PC: RTX 3060) · items built: {dict(counts)}.",
        "",
        "Metrics: onset F1 / P / R per item, summed over the item's classes (mir_eval matching per "
        "class at ±50 ms, and ±30 ms), then the item mean per group; class-mean F1 averages the "
        "classes present in the reference. 3-class tiers (`real-electronic`, `solo-drums`) score "
        "kick, snare and hi-hat only. Bars: both sides through the shipped `quantizeDrumHits` "
        "(music-core CLI `quantize-drums`) on the beats stage's grid of the mixture; `bar exact` = "
        "share of bars whose (class, beat, tick) set matches the reference's exactly, `bar "
        "Jaccard` = mean per-bar overlap. Kit pieces: among class-matched hits, share whose kit "
        "piece matches (hi-hat open vs closed, crash vs ride, tom line). Time: wall seconds per "
        "30 s of audio for notes.drums (and separation for stem inputs), cold model loads "
        "included once per run.",
        "",
        "In-sample notes: YourMT3+ trained on ENST-Drums and Slakh (its `real-enst` row is "
        "in-sample); MDB, ENST and RBMA13 are test sets in ADTOF's paper. uSDR is scale-sensitive "
        "and MDB's drum-only track is not at the full mix's gain, so `real-mdb` uSDR is not a "
        "separation score. YourMT3+'s `stem` condition equals `chosen` and is not run twice.",
        "",
    ]
    for chain in args.chain:
        sel = [r for r in rows if r["chain"] == chain]
        out += [f"## {chain}: by tier and condition", ""]
        out += table(
            sel,
            "tier / condition",
            [
                (f"{t} / {c}", [r for r in sel if r["tier"] == t and r["condition"] == c])
                for t in TIERS
                for c in CONDITIONS
            ],
        )
        chosen = [r for r in sel if r["condition"] == "chosen"]
        out += ["", f"## {chain}: chosen input, all tiers and by label", ""]
        out += table(
            chosen,
            "group",
            [("all (tier-mixed, item mean)", chosen)]
            + [
                (f"label: {lab}", [r for r in chosen if lab in r["labels"].split()])
                for lab in LABELS
            ],
        )
        out += ["", f"## {chain}: F1 ±50 per class (chosen)", "", *class_table(chosen)]
        out += ["", f"## {chain}: kit pieces (chosen; tiers with kit-piece references)", ""]
        out += kit_table(chosen)
        out += ["", f"## {chain}: quantized bars (chosen)", ""]
        out += [
            "| tier | bar exact | bar Jaccard | residual-flag share "
            "| swing-bar share (est / ref) |",
            "|---|---|---|---|---|",
        ]
        for tier in TIERS:
            s = [r for r in chosen if r["tier"] == tier]
            if s:
                out.append(
                    f"| {tier} | {fmt(mean(s, 'bar_exact'))} | {fmt(mean(s, 'bar_jaccard'))} | "
                    f"{fmt(mean(s, 'residual_flagged'))} | {fmt(mean(s, 'swing_bars'))} / "
                    f"{fmt(mean(s, 'ref_swing_bars'))} |"
                )
        swing = [r for r in chosen if "swing" in r["labels"].split()]
        straight = [r for r in chosen if "swing" not in r["labels"].split()]
        out.append(
            f"| swing-labelled / straight items | — | — | — | {fmt(mean(swing, 'swing_bars'))} / "
            f"{fmt(mean(straight, 'swing_bars'))} |"
        )
        conf = confidences[chain]
        if conf:
            out += ["", f"## {chain}: calibration (chosen, all splits; raw = stage confidence)", ""]
            out += ["| class | hits | precision | ECE |", "|---|---|---|---|"]
            for c in drum_kit.CLASSES:
                cc = [(x, y) for x, y, k, _ in conf if k == c]
                if cc:
                    rel = reliability([x for x, _ in cc], [y for _, y in cc])
                    out.append(
                        f"| {c} | {len(cc)} | {np.mean([y for _, y in cc]):.3f} | {rel.ece:.3f} |"
                    )
            rel = reliability([x for x, *_ in conf], [y for _, y, *_ in conf])
            out += ["", f"All classes: ECE {rel.ece:.3f}.", "", rel.table()]
        out += ["", f"## {chain}: time and separation", ""]
        out += [
            "| tier | notes.drums s / 30 s (chosen) | separation s / 30 s | drum stem uSDR dB |",
            "|---|---|---|---|",
        ]
        for tier in TIERS:
            s = [r for r in chosen if r["tier"] == tier]
            if s:
                out.append(
                    f"| {tier} | {fmt(statistics.median([r['notes_s_per_30s'] for r in s]), 2)} | "
                    f"{fmt(mean(s, 'separation_s_per_30s'), 1)} | {fmt(mean(s, 'stem_usdr'), 2)} |"
                )
        out.append("")
    (RESULTS / f"{stem}.md").write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"wrote {RESULTS / stem}.md and .csv ({len(rows)} rows)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n", 1)[0])
    sub = parser.add_subparsers(required=True)
    sub.add_parser("plan").set_defaults(fn=cmd_plan)
    p = sub.add_parser("build")
    p.add_argument("--tier", nargs="+", choices=TIERS, default=list(TIERS))
    p.add_argument("--force", action="store_true")
    p.set_defaults(fn=cmd_build)
    p = sub.add_parser("separate")
    p.add_argument("--tier", nargs="+", choices=TIERS, default=list(TIERS))
    p.add_argument("--separator", default="bs_roformer_sw")
    p.set_defaults(fn=cmd_separate)
    p = sub.add_parser("predict")
    p.add_argument("--chain", choices=list(CHAINS), default="baseline")
    p.add_argument("--tier", nargs="+", choices=TIERS, default=list(TIERS))
    p.add_argument("--condition", nargs="+", choices=CONDITIONS, default=list(CONDITIONS))
    p.set_defaults(fn=cmd_predict)
    p = sub.add_parser("report")
    p.add_argument("--chain", nargs="+", choices=list(CHAINS), default=["baseline"])
    p.add_argument("--tier", nargs="+", choices=TIERS, default=list(TIERS))
    p.add_argument("--name", help="suffix for the result files (e.g. phase3)")
    p.set_defaults(fn=cmd_report)
    args = parser.parse_args()
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
