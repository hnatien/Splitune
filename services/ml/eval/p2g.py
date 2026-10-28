"""Prototype 2g: guitar accuracy end to end on real recordings (08 §3 P2g, step 22).

    uv run python eval/p2g.py bands                 # hard-band MUSDB windows (keys, no guitar)
    uv run python eval/p2g.py build                 # excerpts + references + band mixtures
    uv run python eval/p2g.py separate [--model M]  # separated stems per item and band
    uv run python eval/p2g.py beats                 # shipped beats stage on the clean guitar
    uv run python eval/p2g.py predict --variant V   # shipped notes.guitar stage per condition
    uv run python eval/p2g.py tab --variant V       # shipped buildTab (music-core CLI) per run
    uv run python eval/p2g.py report [--variant V ...]  # → eval/results/p2g/<date>.md + .csv

Material (local only, under ~/datasets/p2g, never committed; manifest `eval/sets/p2g-guitar.yaml`):
real guitar recordings with note and string/fret references, mixed into two band conditions:
`easy` = drums + bass + vocals of a MUSDB18-HQ test window (the P2 condition, kept for
continuity) and `hard` = the same plus keys and synths: the window's "other" stem with its guitar
removed by htdemucs_6s, on windows where the keys are audible and guitar is not all of "other"
(`bands`; MUSDB's "other" is mostly guitar, so a guitar-free "other" barely exists, and what the
removal leaves of its guitar stays as interference). The guitar sits 3 LU below the band.
Harmony and tempo don't match the guitar, so the band measures interference, not musical context.
Derived excerpts have exact ground truth: re-pitched recordings (off-A440, half/full step down,
capo), drop D (GuitarSet hexaphonic strings with string 6 shifted down a whole step) and two
guitars (a comp and a solo on the same GuitarSet lead sheet, beat-aligned, panned apart).
Basic Pitch and YourMT3+ were trained on GuitarSet: every GuitarSet-derived number is in-sample
for them and is reported as its own tier.

Conditions: `clean` (the guitar alone: a ceiling), `stem.<band>` (separated: the production
path), `mix.<band>`. Beats for the tab come from the shipped beats stage on the clean guitar, so
the tab numbers measure notes and frets, not beat tracking on a tempo-mismatched band.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
import time
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from fractions import Fraction
from pathlib import Path
from typing import Any, cast

import numpy as np
import pyloudnorm  # pyright: ignore[reportMissingTypeStubs]
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
import yaml
from numpy.typing import NDArray
from scipy.signal import resample_poly  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]
from splitune_eval import formats, scoring
from splitune_eval.guitar_refs import (
    STANDARD,
    EstNote,
    GuitarRef,
    RefNote,
    TabCounts,
    bend_counts,
    dropped,
    from_guitarset,
    merged,
    repitch_ratio,
    repitched,
    shifted,
    tab_counts,
    trimmed,
)
from splitune_eval.local import LocalRun, write_json
from splitune_eval.report import git_sha
from splitune_eval.tab_metrics import load_jams

DATASETS = Path(os.environ.get("SPLITUNE_DATASETS_DIR", "~/datasets")).expanduser()
ROOT = DATASETS / "p2g"
GUITARSET = DATASETS / "guitarset"
GUITARSET_HEX_URL = "https://zenodo.org/records/3371780/files/audio_hex-pickup_debleeded.zip"
MUSDB = DATASETS / "musdb18hq-p1"
ML_ROOT = Path(__file__).resolve().parents[1]
REPO = ML_ROOT.parents[1]
CLI = REPO / "packages" / "music-core" / "src" / "cli.ts"
RESULTS = Path(__file__).resolve().parent / "results" / "p2g"
SET_FILE = Path(__file__).resolve().parent / "sets" / "p2g-guitar.yaml"
RATE = 44100
GUITAR_BELOW_BAND_LU = 3.0
MAX_EXCERPT_S = 40.0
BANDS = ("easy", "hard")
BAND_SEPARATOR = "htdemucs_6s"  # builds the hard band's keys; not a candidate under test
HARD_BAND_MAX_GUITAR_SHARE = 0.8  # of the "other" stem's energy
HARD_BAND_MIN_KEYS_LU = -30.0  # the keys (piano + other outputs), integrated loudness
TWO_GUITAR_PAN = 0.6

Audio = NDArray[np.float32]  # (frames, 2) unless noted


# --- audio -----------------------------------------------------------------------------------


def read(path: Path) -> Audio:
    data, sr = sf.read(str(path), dtype="float32", always_2d=True)
    audio = np.asarray(data, dtype=np.float32)
    if audio.shape[1] == 1:
        audio = np.repeat(audio, 2, axis=1)
    if sr != RATE:
        audio = np.asarray(resample_poly(audio, RATE, int(sr), axis=0), dtype=np.float32)
    return audio[:, :2]


def write(path: Path, audio: Audio) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), audio, RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]


def loudness(audio: Audio) -> float:
    meter = pyloudnorm.Meter(RATE)  # pyright: ignore[reportUnknownMemberType]
    return float(meter.integrated_loudness(audio.astype(np.float64)))  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]


def fit_length(audio: Audio, frames: int) -> Audio:
    reps = int(np.ceil(frames / max(len(audio), 1)))
    return np.tile(audio, (reps, 1))[:frames]


def panned(mono: NDArray[np.float32], pan: float) -> Audio:
    """Constant-power pan, -1 = left, +1 = right."""
    angle = (pan + 1) * np.pi / 4
    return np.stack([mono * np.cos(angle), mono * np.sin(angle)], axis=1).astype(np.float32)


def resampled_by(audio: Audio, cents: float) -> Audio:
    """Played back `cents` higher and faster (tape-speed re-pitch)."""
    ratio = Fraction(1 / repitch_ratio(cents)).limit_denominator(2000)
    return np.asarray(
        resample_poly(audio, ratio.numerator, ratio.denominator, axis=0), dtype=np.float32
    )


# --- bands -----------------------------------------------------------------------------------


def musdb_windows() -> list[Path]:
    """Complete windows only (`p1_musdb.py windows` writes one stem file at a time)."""
    stems = ("drums", "bass", "vocals", "other")
    return sorted(p for p in MUSDB.iterdir() if all((p / f"{s}.wav").is_file() for s in stems))


def cmd_bands(_: argparse.Namespace) -> int:
    """The hard band's keys: each window's "other" stem split by htdemucs_6s (not the separator
    under test), keeping its piano + other outputs (the guitar removed) where the keys are
    audible and guitar is not nearly all of the stem."""
    from stage_separation import config, models

    spec = config.load().models[BAND_SEPARATOR]
    rows: list[dict[str, Any]] = []
    for window in musdb_windows():
        out = ROOT / "bands" / window.name
        if not (out / "keys.wav").is_file():
            models.separate(BAND_SEPARATOR, spec, window / "other.wav", out)
            write(out / "keys.wav", read(out / "piano.wav") + read(out / "other.wav"))
        parts = {s: read(out / f"{s}.wav") for s in ("guitar", "piano", "other", "vocals")}
        energy = {s: float(np.sum(a.astype(np.float64) ** 2)) for s, a in parts.items()}
        keys_lu = loudness(read(out / "keys.wav"))
        rows.append(
            {
                "window": window.name,
                "guitar_share": round(energy["guitar"] / (sum(energy.values()) or 1.0), 3),
                "keys_lu": round(keys_lu, 1) if np.isfinite(keys_lu) else -99.0,
            }
        )
        rows[-1]["hard"] = (
            rows[-1]["guitar_share"] <= HARD_BAND_MAX_GUITAR_SHARE
            and rows[-1]["keys_lu"] >= HARD_BAND_MIN_KEYS_LU
        )
        print(rows[-1], flush=True)
    write_json(ROOT / "bands.json", rows)
    print(f"hard-band windows: {sum(r['hard'] for r in rows)} of {len(rows)}")
    return 0


def band(kind: str, k: int, name: str | None = None) -> tuple[str, Audio]:
    """The k-th item's accompaniment (or the window `name`, kept from an earlier build): windows
    come from `bands.json` only, so the set doesn't change when more MUSDB windows arrive."""
    if name is None:
        rows = cast(list[dict[str, Any]], json.loads((ROOT / "bands.json").read_text()))
        names = sorted(str(r["window"]) for r in rows if kind == "easy" or r["hard"])
        name = names[k % len(names)]
    parts = [MUSDB / name / f"{s}.wav" for s in ("drums", "bass", "vocals")]
    if kind == "hard":
        parts.append(ROOT / "bands" / name / "keys.wav")
    return name, cast(Audio, sum(read(p) for p in parts))


def mix(guitar: Audio, accompaniment: Audio) -> tuple[Audio, Audio]:
    """(mixture, guitar) at the band level, scaled together below 0.9 peak."""
    accompaniment = fit_length(accompaniment, len(guitar))
    gain_db = loudness(guitar) - loudness(accompaniment) + GUITAR_BELOW_BAND_LU
    mixture = guitar + accompaniment * np.float32(10 ** (gain_db / 20))
    scale = np.float32(min(1.0, 0.9 / float(np.max(np.abs(mixture)))))
    return (mixture * scale).astype(np.float32), (guitar * scale).astype(np.float32)


# --- items -----------------------------------------------------------------------------------


@dataclass
class Item:
    id: str
    source: str  # dataset the audio comes from
    tags: dict[str, str]
    in_sample: list[str] = field(default_factory=list[str])  # transcribers trained on the source
    bands: dict[str, str] = field(default_factory=dict[str, str])  # band → MUSDB window

    @property
    def dir(self) -> Path:
        return ROOT / "items" / self.id

    def ref(self) -> GuitarRef:
        return GuitarRef.load(self.dir / "ref.json")


def load_items() -> list[Item]:
    raw = cast(list[dict[str, Any]], json.loads((ROOT / "manifest.json").read_text()))
    return [Item(**r) for r in raw]


def save_items(items: list[Item]) -> None:
    write_json(ROOT / "manifest.json", [vars(i) for i in items])
    document = {
        "id": "p2g-guitar",
        "description": "P2g: real guitar recordings with note and string/fret references, in an "
        "easy band (drums, bass, vocals) and a hard band (plus keys/synths)",
        "licence": "per source: GuitarSet CC-BY-4.0; band windows MUSDB18-HQ research use",
        "provenance": "built by eval/p2g.py build from the sources named per item; references "
        "derived as described in eval/p2g.py",
        "root": "~/datasets/p2g",
        "split": "test",
        "tasks": ["notes", "tab", "sep"],
        "tags": {"genre": "mixed", "live": "studio", "codec": "wav"},
        "items": [
            {
                "id": i.id,
                "audio": f"items/{i.id}/mixture.hard.wav",
                "annotations": {
                    "notes": f"items/{i.id}/ref.json",
                    "tab": f"items/{i.id}/ref.json",
                    "sep": f"items/{i.id}/guitar.wav",
                },
                "tags": {**i.tags, "source": i.source},
            }
            for i in items
        ],
    }
    SET_FILE.write_text(
        "# Generated by eval/p2g.py build; audio stays under root (never committed).\n"
        + yaml.safe_dump(document, sort_keys=False, width=100),
        encoding="utf-8",
    )


def store(item: Item, guitar: Audio, ref: GuitarRef, k: int, windows: dict[str, str]) -> Item:
    """Writes the item; `windows` (band → MUSDB window) from an earlier build are kept, so a
    rebuild leaves existing mixtures, stems and runs valid."""
    seconds = min(len(guitar) / RATE, MAX_EXCERPT_S)
    guitar = guitar[: int(seconds * RATE)]
    ref = trimmed(ref, seconds)
    ref.dump(item.dir / "ref.json")
    for kind in BANDS:
        window, accompaniment = band(kind, k, windows.get(kind))
        mixture, level = mix(guitar, accompaniment)
        write(item.dir / f"mixture.{kind}.wav", mixture)
        if kind == "easy":
            write(item.dir / "guitar.wav", level)
        item.bands[kind] = window
    print(f"built {item.id} ({seconds:.0f} s, {len(ref.notes)} notes)", flush=True)
    return item


GS_STYLES = ("BN", "Funk", "Jazz", "Rock", "SS")
GS_MODE_TAG = {"comp": "comping", "solo": "single-line"}
# (player, style, progression, mode, cents, tuning tag)
GS_REPITCHED = [
    ("05", "BN", 3, "comp", 20.0, "off_a440"),
    ("05", "Funk", 3, "solo", -35.0, "off_a440"),
    ("05", "Jazz", 3, "comp", 45.0, "off_a440"),
    ("05", "SS", 3, "solo", -45.0, "off_a440"),
    ("05", "Rock", 3, "comp", -100.0, "half_step_down"),
    ("05", "SS", 3, "comp", -100.0, "half_step_down"),
    ("05", "Rock", 3, "solo", -200.0, "full_step_down"),
    ("05", "Funk", 3, "comp", -200.0, "full_step_down"),
    ("05", "BN", 3, "solo", 200.0, "capo"),
    ("05", "Jazz", 3, "solo", 300.0, "capo"),
]
GS_DROP_D = [("05", "Rock", 2, "comp"), ("05", "Funk", 2, "comp"), ("05", "SS", 2, "comp")]
GS_TWO_GUITARS = [
    ("00", "01", "BN", 1),
    ("01", "02", "Funk", 1),
    ("02", "03", "Rock", 1),
    ("03", "04", "Jazz", 1),
]


def gs_name(player: str, style: str, progression: int, mode: str, take: int = 0) -> str:
    """GuitarSet recording name: each progression has two lead sheets (tempo, key), `take` picks
    one in sorted order; every player played the same lead sheets."""
    pattern = re.compile(rf"^{player}_{style}{progression}-\d+-[A-G][b#]?_{mode}$")
    names = sorted(
        p.stem for p in (GUITARSET / "annotation").glob("*.jams") if pattern.match(p.stem)
    )
    if len(names) != 2:
        raise FileNotFoundError(f"GuitarSet {player} {style}{progression} {mode}: {names}")
    return names[take]


def gs_audio(name: str) -> Audio:
    mono = read(GUITARSET / "audio_mono-mic" / f"{name}_mic.wav").mean(axis=1)
    return np.repeat(mono[:, None], 2, axis=1)


def gs_ref(name: str) -> GuitarRef:
    return from_guitarset(load_jams(GUITARSET / "annotation" / f"{name}.jams"))


def gs_tags(genre: str, mode: str, **extra: str) -> dict[str, str]:
    return {
        "style": GS_MODE_TAG[mode],
        "genre": genre,
        "timbre": "acoustic",
        "tuning": "standard",
        "guitars": "1",
        **extra,
    }


def build_guitarset() -> Iterable[tuple[Item, Audio, GuitarRef]]:
    for take, player in enumerate(("03", "04")):
        for style in GS_STYLES:
            for mode in ("comp", "solo"):
                name = gs_name(player, style, 2, mode, take)
                item = Item(
                    f"gs-{name}", "guitarset", gs_tags(style, mode), ["basic_pitch", "yourmt3"]
                )
                yield item, gs_audio(name), gs_ref(name)
    for player, style, progression, mode, cents, tuning in GS_REPITCHED:
        name = gs_name(player, style, progression, mode)
        tag = f"{'+' if cents > 0 else ''}{cents:.0f}c"
        item = Item(
            f"gs-{name}-{tag}",
            "guitarset",
            gs_tags(style, mode, tuning=tuning),
            ["basic_pitch", "yourmt3"],
        )
        yield item, resampled_by(gs_audio(name), cents), repitched(gs_ref(name), cents)
    for player, style, progression, mode in GS_DROP_D:
        name = gs_name(player, style, progression, mode)
        item = Item(
            f"gs-{name}-dropD",
            "guitarset-hex",
            gs_tags(style, mode, tuning="drop_d", timbre="acoustic_pickup"),
            ["basic_pitch", "yourmt3"],
        )
        yield item, drop_d_audio(name), dropped(gs_ref(name))
    for comp_player, solo_player, style, progression in GS_TWO_GUITARS:
        comp = gs_name(comp_player, style, progression, "comp")
        solo = gs_name(solo_player, style, progression, "solo")
        audio, ref = two_guitars(comp, solo)
        item = Item(
            f"gs2-{comp}+{solo_player}",
            "guitarset",
            gs_tags(style, "comp", style="two_guitars", guitars="2"),
            ["basic_pitch", "yourmt3"],
        )
        yield item, audio, ref


def drop_d_audio(name: str) -> Audio:
    """The hexaphonic (debleeded) strings summed, string 6 (channel 0 = low E) a whole step
    down at the same speed (phase-vocoder pitch shift of that string only)."""
    import torch
    from torchaudio.functional import pitch_shift  # pyright: ignore[reportMissingTypeStubs]

    path = GUITARSET / "audio_hex-pickup_debleeded" / f"{name}_hex_cln.wav"
    if not path.is_file():
        fetch_member(GUITARSET_HEX_URL, path.name, path)
    data, sr = sf.read(str(path), dtype="float32", always_2d=True)
    strings = np.asarray(data, dtype=np.float32)
    low = torch.tensor(strings[:, 0])[None]
    shifted_low = pitch_shift(low, int(sr), n_steps=-2)[0].numpy()  # pyright: ignore[reportUnknownMemberType]
    strings[:, 0] = shifted_low[: len(strings)]
    mono = strings.sum(axis=1)
    mono = np.asarray(resample_poly(mono, RATE, int(sr)), dtype=np.float32) if sr != RATE else mono
    mono *= np.float32(0.5 / max(float(np.max(np.abs(mono))), 1e-6))
    return np.repeat(mono[:, None], 2, axis=1)


def fetch_member(url: str, member: str, dest: Path) -> None:
    """One member of a remote zip through HTTP range requests (the archive is not downloaded)."""
    import shutil
    import zipfile

    from p1_musdb import HttpRangeFile  # pyright: ignore[reportMissingImports, reportUnknownVariableType]

    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(".part")
    with (
        zipfile.ZipFile(HttpRangeFile(url)) as archive,  # pyright: ignore[reportUnknownArgumentType]
        archive.open(member) as src,
        part.open("wb") as out,
    ):
        shutil.copyfileobj(src, out)
    part.replace(dest)


def two_guitars(comp: str, solo: str) -> tuple[Audio, GuitarRef]:
    """Comp (rhythm, left) and solo (lead, right) on the same lead sheet, the solo moved so its
    first annotated beat lands on the comp's."""
    comp_ref, solo_ref = gs_ref(comp), gs_ref(solo)
    offset = comp_ref.beats[0] - solo_ref.beats[0]
    comp_mono = gs_audio(comp).mean(axis=1)
    solo_mono = gs_audio(solo).mean(axis=1)
    shift = round(offset * RATE)
    solo_mono = (
        np.pad(solo_mono, (shift, 0))[: len(comp_mono)] if shift >= 0 else solo_mono[-shift:]
    )
    frames = min(len(comp_mono), len(solo_mono))
    comp_mono, solo_mono = comp_mono[:frames], solo_mono[:frames]
    solo_mono *= np.float32(
        10 ** ((loudness(panned(comp_mono, 0)) - loudness(panned(solo_mono, 0))) / 20)
    )
    audio = panned(comp_mono, -TWO_GUITAR_PAN) + panned(solo_mono, TWO_GUITAR_PAN)
    ref = merged(
        shifted(comp_ref, 0.0, "rhythm"),
        trimmed(shifted(solo_ref, offset, "lead"), frames / RATE),
    )
    return audio, trimmed(ref, frames / RATE)


TECHS_STRINGS = {"e": 1, "B": 2, "G": 3, "D": 4, "A": 5, "E": 6}  # MIDI track name → string
TECHS_LEAD_IN_S = 0.5
MAX_FRET = 24
CHORDAL_SHARE = 0.3  # share of notes sharing an onset (30 ms) above which a part is "comping"


def techs_ref(midi: Path, t0: float, t1: float, vibrato: bool) -> GuitarRef:
    """Guitar-TECHS MIDI: one track per string (named e B G D A E), standard tuning. Its Bendings
    recordings are not used: the MIDI pickup writes a bend as a run of stepped notes, so neither
    their notes nor a bend mark can be scored. The Vibrato recordings are bend negatives."""
    import mido  # pyright: ignore[reportMissingTypeStubs]

    song = mido.MidiFile(str(midi))  # pyright: ignore[reportUnknownVariableType]
    strings: dict[int, int] = {}  # MIDI channel → string, from the track holding the channel
    for track in cast(list[Any], song.tracks):  # pyright: ignore[reportUnknownMemberType]
        string = TECHS_STRINGS.get(str(track.name))
        channels = {int(m.channel) for m in track if hasattr(m, "channel")}
        if string is not None and len(channels) == 1:
            strings[channels.pop()] = string
    notes: list[RefNote] = []
    now = 0.0
    active: dict[tuple[int, int], float] = {}
    for msg in cast(Iterable[Any], song):  # merged tracks, msg.time in seconds
        now += float(msg.time)
        if msg.type not in ("note_on", "note_off") or msg.channel not in strings:
            continue
        key = (int(msg.channel), int(msg.note))
        if msg.type == "note_on" and msg.velocity > 0:
            active[key] = now
            continue
        start = active.pop(key, None)
        if start is None or not t0 <= start < t1:
            continue
        string = strings[key[0]]
        fret = key[1] - STANDARD[string - 1]
        playable = 0 <= fret <= MAX_FRET  # else a pickup glitch: the note, no string/fret
        notes.append(
            RefNote(
                onset_s=start - t0,
                offset_s=min(now, t1) - t0,
                pitch_midi=key[1],
                string=string if playable else None,
                fret=fret if playable else None,
            )
        )
    notes.sort(key=lambda n: (n.onset_s, -n.pitch_midi))
    return GuitarRef(notes=tuple(notes), has_bends=vibrato)


def first_onset(midi: Path) -> float:
    ref = techs_ref(midi, 0.0, float("inf"), vibrato=False)
    return ref.notes[0].onset_s if ref.notes else 0.0


def chordal(ref: GuitarRef) -> bool:
    onsets = sorted(n.onset_s for n in ref.notes)
    shared = sum(
        1
        for i, t in enumerate(onsets)
        if (i > 0 and t - onsets[i - 1] < 0.03)
        or (i + 1 < len(onsets) and onsets[i + 1] - t < 0.03)
    )
    return shared > CHORDAL_SHARE * max(len(onsets), 1)


def build_techs() -> Iterable[tuple[Item, Audio, GuitarRef]]:
    """Guitar-TECHS (CC-BY-4.0, Zenodo 14963133): the amp-miked electric (`micamp`), one window
    from the first note of each music excerpt, and the Vibrato recordings of both players (the
    bend detector's negatives)."""
    root = DATASETS / "guitar-techs"
    sources: list[tuple[str, Path, Path, str]] = []
    for midi in sorted((root / "P3_music" / "midi").glob("midi_*.mid")):
        number = midi.stem.removeprefix("midi_")
        audio = root / "P3_music" / "audio" / "micamp" / f"micamp_{number}.wav"
        if audio.is_file():
            sources.append((f"techs-music{number}", midi, audio, ""))
    for player in ("P1", "P2"):
        for technique in ("Vibrato",):
            base = root / f"{player}_techniques"
            sources.append(
                (
                    f"techs-{player}-{technique.lower()}",
                    base / "midi" / f"midi_{technique}.mid",
                    base / "audio" / "micamp" / f"micamp_{technique}.wav",
                    technique,
                )
            )
    for item_id, midi, audio_path, technique in sources:
        t0 = max(0.0, first_onset(midi) - TECHS_LEAD_IN_S)
        ref = techs_ref(midi, t0, t0 + MAX_EXCERPT_S, vibrato=technique == "Vibrato")
        audio = read(audio_path)[int(t0 * RATE) : int((t0 + MAX_EXCERPT_S) * RATE)]
        mono = audio.mean(axis=1)
        style = "vibrato" if technique else ("comping" if chordal(ref) else "single-line")
        tags = {
            "style": style,
            "genre": "mixed",
            "timbre": "electric_amp",
            "tuning": "standard",
            "guitars": "1",
        }
        yield Item(item_id, "guitar-techs", tags), np.repeat(mono[:, None], 2, axis=1), ref


IDMT = DATASETS / "idmt-smt-guitar" / "IDMT-SMT-GUITAR_V2" / "dataset2"
IDMT_GAP_S = 0.5
# excerpt → (audio, annotation) licks joined in this order: the bends set carries 16 bends per
# guitar; the plain set is the no-bend control (normal picking only). Lick 11's annotation names
# `<guitar>_Lick11_FNVSBHD.wav`, which ships as `<guitar>_Lick11_FN.wav` (same length).
IDMT_EXCERPTS = {
    "bends": (
        ("Lick11_FN", "Lick11_FNVSBHD"),
        ("Lick5_FBVDN", "Lick5_FBVDN"),
        ("Lick4_FBSH", "Lick4_FBSH"),
        ("Lick6_FHBV", "Lick6_FHBV"),
    ),
    "plain": (("Lick1_FN", "Lick1_FN"), ("Lick2_FN", "Lick2_FN"), ("Lick7_FN", "Lick7_FN")),
}


def idmt_events(path: Path, offset_s: float) -> list[RefNote]:
    """IDMT-SMT-Guitar annotation XML: string 1 = low E (Splitune: 6), expression BE = bend (the
    amount is not annotated: marked 100 cents)."""
    import xml.etree.ElementTree as ET

    notes: list[RefNote] = []
    for event in ET.parse(path).getroot().iter("event"):

        def field_of(name: str, event: ET.Element = event) -> str:
            return (event.findtext(name) or "").strip()

        pitch, string, fret = (
            int(field_of("pitch")),
            7 - int(field_of("stringNumber")),
            int(field_of("fretNumber")),
        )
        consistent = STANDARD[string - 1] + fret == pitch  # a few annotations disagree
        notes.append(
            RefNote(
                onset_s=float(field_of("onsetSec")) + offset_s,
                offset_s=float(field_of("offsetSec")) + offset_s,
                pitch_midi=pitch,
                string=string if consistent else None,
                fret=fret if consistent else None,
                bend_cents=100.0 if field_of("expressionStyle") == "BE" else 0.0,
            )
        )
    return notes


def build_idmt() -> Iterable[tuple[Item, Audio, GuitarRef]]:
    """IDMT-SMT-Guitar V2 dataset 2 (Zenodo 7544110): electric licks on three guitars, joined
    with short gaps into one bends excerpt and one plain excerpt per guitar."""
    for guitar in ("AR", "FS", "LP"):
        for name, licks in IDMT_EXCERPTS.items():
            parts: list[NDArray[np.float32]] = []
            notes: list[RefNote] = []
            t = 0.0
            for audio_name, annotation in licks:
                mono = read(IDMT / "audio" / f"{guitar}_{audio_name}.wav").mean(axis=1)
                notes += idmt_events(IDMT / "annotation" / f"{guitar}_{annotation}.xml", t)
                parts += [mono, np.zeros(int(IDMT_GAP_S * RATE), dtype=np.float32)]
                t += len(mono) / RATE + IDMT_GAP_S
            mono = np.concatenate(parts)
            ref = GuitarRef(
                notes=tuple(sorted(notes, key=lambda n: (n.onset_s, -n.pitch_midi))), has_bends=True
            )
            tags = {
                "style": "solo_bends" if name == "bends" else "single-line",
                "genre": "licks",
                "timbre": "electric_clean",
                "tuning": "standard",
                "guitars": "1",
            }
            yield (
                Item(f"idmt-{guitar}-{name}", "idmt-smt-guitar", tags),
                np.repeat(mono[:, None], 2, axis=1),
                ref,
            )


# builder → (items, the `source` values its items carry)
BUILDERS: dict[str, tuple[Callable[[], Iterable[tuple[Item, Audio, GuitarRef]]], set[str]]] = {
    "guitarset": (build_guitarset, {"guitarset", "guitarset-hex"}),
    "techs": (build_techs, {"guitar-techs"}),
    "idmt": (build_idmt, {"idmt-smt-guitar"}),
}


def cmd_build(args: argparse.Namespace) -> int:
    existing = {i.id: i for i in load_items()} if (ROOT / "manifest.json").is_file() else {}
    rebuilt = set[str]().union(*(BUILDERS[b][1] for b in args.source))
    items: list[Item] = [i for i in existing.values() if i.source not in rebuilt]
    for builder in args.source:
        for item, audio, ref in BUILDERS[builder][0]():
            previous = existing.get(item.id)
            items.append(store(item, audio, ref, len(items), previous.bands if previous else {}))
    save_items(items)
    print(f"{len(items)} items")
    return 0


# --- separation, beats, notes ----------------------------------------------------------------

SEPARATORS = ("bs_roformer_sw", "htdemucs_6s", "mel_roformer_guitar_becruily")
# Combinations of model outputs (step 22 Phase 1): the mean of two guitar stems, and the guitar
# model run on what BS-Roformer-SW leaves after removing vocals, drums and bass.
COMBINED = {
    "ens_sw_becruily": ("bs_roformer_sw", "mel_roformer_guitar_becruily"),
    "chain_sw_becruily": ("bs_roformer_sw", "mel_roformer_guitar_becruily"),
}


def stem_path(item: Item, separator: str, kind: str) -> Path:
    return item.dir / "sep" / separator / kind / "guitar.wav"


def cmd_separate(args: argparse.Namespace) -> int:
    from stage_separation import config, models

    timing_path = ROOT / "sep-timing.json"
    timing = (
        cast(dict[str, Any], json.loads(timing_path.read_text())) if timing_path.is_file() else {}
    )
    first, second = COMBINED.get(args.model, (args.model, args.model))
    for item in load_items():
        for kind in BANDS:
            out = stem_path(item, args.model, kind).parent
            if (out / "guitar.wav").is_file():
                continue
            mixture = item.dir / f"mixture.{kind}.wav"
            started = time.perf_counter()
            if args.model == "ens_sw_becruily":
                stems = [read(stem_path(item, m, kind)) for m in (first, second)]
                frames = min(len(a) for a in stems)
                write(
                    out / "guitar.wav",
                    ((stems[0][:frames] + stems[1][:frames]) / 2).astype(np.float32),
                )
            elif args.model == "chain_sw_becruily":
                sw = stem_path(item, first, kind).parent
                residual = sum(read(sw / f"{s}.wav") for s in ("guitar", "piano", "other"))
                write(out / "residual.wav", cast(Audio, residual))
                spec = config.load().models[second]
                models.separate(second, spec, out / "residual.wav", out)
            else:
                spec = config.load().models[args.model]
                models.separate(args.model, spec, mixture, out)
            timing.setdefault(args.model, {})[f"{item.id}.{kind}"] = {
                "seconds": time.perf_counter() - started,
                "audio_s": len(read(mixture)) / RATE,
            }
            write_json(timing_path, timing)
            print(f"{args.model} {item.id} {kind}", flush=True)
    return 0


def cmd_beats(_: argparse.Namespace) -> int:
    """Shipped beats and chords stages on the clean guitar: the band's harmony doesn't match the
    guitar, so these stand in for a band playing the guitar's changes. `buildTab` gets both, as
    finalize does (the chords are the fret DP's shape prior)."""
    with tempfile.TemporaryDirectory() as tmp:
        local = LocalRun(Path(tmp))
        for item in load_items():
            beats, chords = item.dir / "beats.json", item.dir / "chords.json"
            if beats.is_file() and chords.is_file():
                continue
            decoded = local.decode(item.dir / "guitar.wav")
            if not beats.is_file():
                local.keep(local.run("beats", {}, decoded), "beats", beats)
            local.keep(local.run("chords", {"beats": str(beats)}, decoded), "chords", chords)
            print(f"beats + chords {item.id}", flush=True)
    return 0


@dataclass(frozen=True)
class Variant:
    """One candidate production chain: separator + notes.guitar transcriber/params."""

    separator: str = "bs_roformer_sw"
    transcriber: str | None = None  # None = notes.personal.yaml's
    overrides: dict[str, Any] = field(default_factory=dict[str, Any])  # on top of its params
    note: str = ""
    notes_from: str | None = None  # reuse another variant's notes (tab-only variants)
    string_cue: float = 0.0  # fret DP weight of the audio string cue (0 = off)
    cue_model: str = "clean"  # p2g_strings.py model: trained on clean and/or stem features


VARIANTS: dict[str, Variant] = {
    "baseline": Variant(
        overrides={"a4_compensation": False, "tuning_suggestion": False},
        note="production on 2026-10-24: BS-Roformer-SW → Basic Pitch (P2 thresholds)",
    ),
    "a4comp": Variant(
        overrides={"a4_compensation": True, "tuning_suggestion": False},
        note="baseline + A4 compensation",
    ),
    "tuning": Variant(
        overrides={"a4_compensation": True, "tuning_suggestion": True},
        note="a4comp + open-string tuning suggestion (applied by buildTab)",
    ),
    **{
        f"sep_{name}": Variant(
            separator=name,
            overrides={"a4_compensation": True, "tuning_suggestion": True},
            note=f"tuning with separator {name}",
        )
        for name in ("htdemucs_6s", "mel_roformer_guitar_becruily", *COMBINED)
    },
    "bends": Variant(
        overrides={"a4_compensation": True, "tuning_suggestion": True, "bends": True},
        note="tuning + bends from the pitch contour (fragments of a bent note merged)",
    ),
    "decode": Variant(
        overrides={
            "a4_compensation": True,
            "tuning_suggestion": True,
            "onset_threshold": 0.7,
            "energy_tol": 16,
        },
        note="tuning + decoding from the sweep (onset threshold 0.7, energy_tol 16)",
    ),
    **{
        f"cue{w:g}": Variant(
            overrides={"a4_compensation": True, "tuning_suggestion": True},
            notes_from="tuning",
            string_cue=w,
            note=f"tuning + audio string cue (classifier on clean audio), DP weight {w:g}",
        )
        for w in (0.25, 0.5, 1.0, 2.0)
    },
    **{
        f"cuestem{w:g}": Variant(
            overrides={"a4_compensation": True, "tuning_suggestion": True},
            notes_from="tuning",
            string_cue=w,
            cue_model="clean+stem",
            note=f"tuning + audio string cue (classifier on clean and stem audio), DP weight {w:g}",
        )
        for w in (0.25, 0.5, 1.0, 2.0)
    },
}
# Off-A440 (note accuracy only) and whole semitones down (half/full step down: also tabbed).
DETUNE_CENTS = (20.0, -20.0, 35.0, -35.0, 50.0, -50.0, -100.0, -200.0)


def notes_config(variant: Variant, path: Path) -> None:
    base = cast(
        dict[str, Any], yaml.safe_load((ML_ROOT / "config" / "notes.personal.yaml").read_text())
    )
    guitar = base["instruments"]["guitar"]
    if variant.transcriber is not None and variant.transcriber != guitar["transcriber"]:
        guitar["transcriber"] = variant.transcriber
        guitar["params"] = {}
    guitar["params"] = {**guitar.get("params", {}), **variant.overrides}
    path.write_text(yaml.safe_dump(base), encoding="utf-8")


def conditions() -> list[str]:
    return ["clean", *(f"{c}.{b}" for b in BANDS for c in ("stem", "mix"))]


def detune_conditions() -> list[str]:
    """The hard-band stem re-pitched (tape speed) by each of DETUNE_CENTS."""
    return [f"detune{c:+.0f}" for c in DETUNE_CENTS]


def detune_cents(condition: str) -> float | None:
    return float(condition.removeprefix("detune")) if condition.startswith("detune") else None


def detuned_stem(item: Item, separator: str, cents: float) -> Path:
    path = ROOT / "detune" / separator / f"{item.id}{cents:+.0f}.wav"
    if not path.is_file():
        write(path, resampled_by(read(stem_path(item, separator, "hard")), cents))
    return path


def run_dir(variant: str) -> Path:
    return ROOT / "runs" / variant


def cmd_predict(args: argparse.Namespace) -> int:
    variant = VARIANTS[args.variant]
    if variant.notes_from is not None:
        for source in sorted(run_dir(variant.notes_from).glob("*/*.notes.json")):
            dest = run_dir(args.variant) / source.parent.name / source.name
            if not dest.is_file():
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, dest)
        return 0
    timing_path = run_dir(args.variant) / "timing.json"
    timing = (
        cast(dict[str, float], json.loads(timing_path.read_text())) if timing_path.is_file() else {}
    )
    with tempfile.TemporaryDirectory() as tmp:
        config = Path(tmp) / "notes.yaml"
        notes_config(variant, config)
        os.environ["ML_NOTES_CONFIG"] = str(config)
        local = LocalRun(Path(tmp) / "work")
        for item in load_items():
            for condition in args.condition or conditions():
                dest = run_dir(args.variant) / item.id / f"{condition}.notes.json"
                if dest.is_file():
                    continue
                kind = condition.partition(".")[2]
                cents = detune_cents(condition)
                if cents is not None:
                    source = detuned_stem(item, variant.separator, cents)
                else:
                    source = item.dir / (
                        "guitar.wav" if condition == "clean" else f"mixture.{kind}.wav"
                    )
                decoded = local.decode(source)
                inputs: dict[str, str] = {}
                if condition.startswith("stem.") or cents is not None:
                    stem = source if cents is not None else stem_path(item, variant.separator, kind)
                    if not stem.is_file():
                        continue
                    inputs["separation"] = str(
                        local.separation(
                            decoded,
                            {"guitar": stem},
                            "guitar",
                            variant.separator,
                            Path(tmp) / "separation.json",
                        )
                    )
                started = time.perf_counter()
                out = local.run("notes.guitar", inputs, decoded)
                timing[f"{item.id}.{condition}"] = time.perf_counter() - started
                local.keep(out, "notes", dest)
                write_json(timing_path, timing)
                print(f"{args.variant} {condition} {item.id}", flush=True)
    return 0


# --- tab -------------------------------------------------------------------------------------

FINGERING = ("easiest", "as_played")


TAB_TUNINGS = ("standard", "reference", "suggested")


def item_ref(item: Item, condition: str) -> GuitarRef:
    cents = detune_cents(condition)
    return item.ref() if cents is None else repitched(item.ref(), cents)


def tab_options(item: Item, condition: str, fingering: str, tuning: str) -> dict[str, Any]:
    """`standard`: standard tuning, no capo (production before step 22); `reference`: the
    excerpt's true tuning and capo; `suggested`: no tuning option, so buildTab applies the notes
    artefact's tuning suggestion as finalize and the practice screen do."""
    options: dict[str, Any] = {"fingering_mode": fingering}
    if tuning == "standard":
        options["tuning_midi"] = list(STANDARD)
    elif tuning == "reference":
        ref = item_ref(item, condition)
        options |= {"tuning_midi": list(ref.tuning_midi), "capo": ref.capo}
    return options


def build_tab(notes: Path, item: Item, options: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "notes": json.loads(notes.read_text(encoding="utf-8")),
        "beats": json.loads((item.dir / "beats.json").read_text(encoding="utf-8")),
        "chords": json.loads((item.dir / "chords.json").read_text(encoding="utf-8")),
        "options": options,
    }
    result = subprocess.run(
        ["node", str(CLI), "build-tab"],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"music-core build-tab failed: {result.stderr.strip()}")
    return cast(dict[str, Any], json.loads(result.stdout)["tab"])


def condition_audio(item: Item, condition: str, separator: str) -> Path:
    cents = detune_cents(condition)
    if cents is not None:
        return detuned_stem(item, separator, cents)
    if condition == "clean":
        return item.dir / "guitar.wav"
    kind = condition.partition(".")[2]
    return (
        stem_path(item, separator, kind)
        if condition.startswith("stem.")
        else item.dir / f"mixture.{kind}.wav"
    )


def with_string_cue(notes: Path, item: Item, condition: str, variant: Variant) -> Path:
    """The notes with `string_probs` from the string classifier on the condition's audio (what the
    notes stage would add), cached next to them."""
    from p2g_strings import OUT, string_probs

    dest = notes.with_name(f"{condition}.cue.{variant.cue_model}.notes-json")
    if not dest.is_file():
        document = json.loads(notes.read_text(encoding="utf-8"))
        mono = read(condition_audio(item, condition, variant.separator)).mean(axis=1)
        model = OUT / f"model.{variant.cue_model}.npz"
        probs = string_probs(mono, document["notes"], model)
        for note, p in zip(document["notes"], probs, strict=True):
            note["string_probs"] = p
        write_json(dest, document)
    return dest


def cmd_tab(args: argparse.Namespace) -> int:
    variant = VARIANTS[args.variant]
    for item in load_items():
        for notes in sorted((run_dir(args.variant) / item.id).glob("*.notes.json")):
            condition = notes.name.removesuffix(".notes.json")
            cents = detune_cents(condition)
            if cents is not None and cents % 100:
                continue  # off-A440 detunes: note accuracy only
            source = notes
            if variant.string_cue:
                source = with_string_cue(notes, item, condition, variant)
            for fingering in FINGERING:
                for tuning in args.tuning:
                    dest = notes.parent / f"{condition}.tab.{fingering}.{tuning}.json"
                    if dest.is_file():
                        continue
                    options = tab_options(item, condition, fingering, tuning)
                    if variant.string_cue:
                        options["weights"] = {"stringCue": variant.string_cue}
                    write_json(dest, build_tab(source, item, options))
        print(f"tab {args.variant} {item.id}", flush=True)
    return 0


# --- scoring ---------------------------------------------------------------------------------


def estimates(notes_path: Path, tab: dict[str, Any] | None) -> list[EstNote]:
    document = json.loads(notes_path.read_text(encoding="utf-8"))
    events = {e["note_id"]: e for e in tab["events"]} if tab else {}
    out: list[EstNote] = []
    for n in document["notes"]:
        e = events.get(n["id"], {})
        bend = max((abs(c) for _, c in n.get("bend_cents", [])), default=0.0)
        out.append(
            EstNote(
                n["onset_s"],
                n["offset_s"],
                int(n["pitch_midi"]),
                e.get("string"),
                e.get("fret"),
                bend,
            )
        )
    return out


TUNING_NAMES: dict[tuple[int, ...], str] = {
    (64, 59, 55, 50, 45, 40): "standard",
    (63, 58, 54, 49, 44, 39): "half_step_down",
    (62, 57, 53, 48, 43, 38): "full_step_down",
    (64, 59, 55, 50, 45, 38): "drop_d",
    (63, 58, 54, 49, 44, 37): "drop_c_sharp",
    (62, 57, 53, 48, 43, 36): "drop_c",
}


def applied_tuning(notes_path: Path) -> str:
    """The tuning buildTab uses with no tuning option: the suggestion at or above music-core's
    TUNING_SUGGESTION_MIN_CONFIDENCE (read from its tab output), else standard."""
    tab_path = notes_path.with_name(
        notes_path.name.replace(".notes.json", ".tab.easiest.suggested.json")
    )
    if not tab_path.is_file():
        return "standard"
    tab = json.loads(tab_path.read_text(encoding="utf-8"))
    return TUNING_NAMES.get(tuple(tab["tuning_midi"]), "other")


def note_events(notes: list[RefNote] | list[EstNote]) -> formats.NoteEvents:
    intervals = np.array([[n.onset_s, max(n.offset_s, n.onset_s + 1e-3)] for n in notes]).reshape(
        -1, 2
    )
    return formats.NoteEvents(intervals, np.array([float(n.pitch_midi) for n in notes]))


def fold(events: formats.NoteEvents) -> formats.NoteEvents:
    return formats.NoteEvents(events.intervals, events.pitches_midi % 12 + 60)


def quantize_stats(
    tab: dict[str, Any], beats_path: Path, ref: list[RefNote], est: list[EstNote], notes_path: Path
) -> dict[str, float]:
    """Residual-flag share (|onset - grid| > 60 ms, music-core's flag) and the median error of
    the quantized onset against the reference onset over matched notes."""
    from splitune_eval.guitar_refs import match

    events = tab["events"]
    if not events:
        return {"residual_flag_share": float("nan"), "quantized_onset_err_ms": float("nan")}
    flagged = sum(1 for e in events if abs(e["quantize_residual_ms"]) > 60) / len(events)
    document = json.loads(notes_path.read_text(encoding="utf-8"))
    by_id = {e["note_id"]: e for e in events}
    ids = [n["id"] for n in document["notes"]]
    errors = [
        abs(by_id[ids[j]]["quantize_residual_ms"] + 1000 * (est[j].onset_s - ref[i].onset_s))
        for i, j in match(ref, est)
        if ids[j] in by_id
    ]
    return {
        "residual_flag_share": flagged,
        "quantized_onset_err_ms": statistics.median(errors) if errors else float("nan"),
    }


def score_rows(variant: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in load_items():
        ref = item.ref()
        for notes_path in sorted((run_dir(variant) / item.id).glob("*.notes.json")):
            condition = notes_path.name.removesuffix(".notes.json")
            cents = detune_cents(condition)
            ref_notes = list((ref if cents is None else repitched(ref, cents)).notes)
            est = estimates(notes_path, None)
            metrics, _ = scoring.notes(note_events(ref_notes), note_events(est))
            folded, _ = scoring.notes(fold(note_events(ref_notes)), fold(note_events(est)))
            row: dict[str, Any] = {
                "variant": variant,
                "item": item.id,
                "source": item.source,
                "condition": condition,
                "in_sample": ",".join(item.in_sample),
                **item.tags,
                "onset_f1": metrics["onset_f1"],
                "onset_precision": metrics["onset_precision"],
                "onset_recall": metrics["onset_recall"],
                "onset_offset_f1": metrics["onset_offset_f1"],
                "pitch_class_f1": folded["onset_f1"],
                "true_tuning": TUNING_NAMES.get(
                    tuple(item_ref(item, condition).tuning_midi), "other"
                ),
                "tab_tuning": applied_tuning(notes_path),
            }
            if ref.has_bends:
                bends = bend_counts(ref_notes, est)
                row |= {"bend_ref": bends.ref, "bend_est": bends.est, "bend_hit": bends.hit}
            for tab_path in sorted(notes_path.parent.glob(f"{condition}.tab.*.json")):
                _, _, fingering, tuning, _ = tab_path.name.rsplit(".", 4)
                tab = cast(dict[str, Any], json.loads(tab_path.read_text(encoding="utf-8")))
                counts = tab_counts(ref_notes, estimates(notes_path, tab)) if ref.has_tab else None
                key = f"{fingering}.{tuning}"
                if counts is not None:
                    row |= {
                        f"tab_f1.{key}": counts.f1,
                        f"tdr.{key}": counts.tdr,
                        f"tab_counts.{key}": [
                            counts.ref,
                            counts.est,
                            counts.matched,
                            counts.tab_correct,
                        ],
                    }
                unplayable = sum(1 for e in tab["events"] if e.get("unplayable"))
                row[f"unplayable_share.{key}"] = unplayable / max(len(tab["events"]), 1)
                if key == "easiest.standard":
                    row |= quantize_stats(tab, item.dir / "beats.json", ref_notes, est, notes_path)
            rows.append(row)
    return rows


def pooled(rows: list[dict[str, Any]], key: str) -> TabCounts | None:
    counts = [r[f"tab_counts.{key}"] for r in rows if f"tab_counts.{key}" in r]
    if not counts:
        return None
    a = np.sum(np.array(counts), axis=0)
    return TabCounts(int(a[0]), int(a[1]), int(a[2]), int(a[3]))


def mean(rows: list[dict[str, Any]], key: str) -> float:
    values = [float(r[key]) for r in rows if key in r and r[key] == r[key]]
    return statistics.fmean(values) if values else float("nan")


def fmt(value: float) -> str:
    return "-" if value != value else f"{value:.3f}"


def select(rows: list[dict[str, Any]], **match: str) -> list[dict[str, Any]]:
    return [r for r in rows if all(r.get(k) == v for k, v in match.items())]


def tiers(rows: list[dict[str, Any]]) -> list[tuple[str, list[dict[str, Any]]]]:
    """Report tiers: in-sample (GuitarSet-derived) material is never pooled with the rest."""
    gs = [r for r in rows if r["source"].startswith("guitarset")]
    other = [r for r in rows if not r["source"].startswith("guitarset")]
    return [
        (name, sel)
        for name, sel in (
            ("GuitarSet-derived (in-sample for Basic Pitch, YourMT3+)", gs),
            ("other sources", other),
        )
        if sel
    ]


def timing_rows(variant: str) -> dict[str, float]:
    """Median seconds per 30 s of audio: separation (the variant's model) and notes.guitar.
    Timing keys are `<item id>.<condition>` (item ids have no dots)."""
    durations = {
        i.id: float(sf.info(str(i.dir / "guitar.wav")).duration)  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]
        for i in load_items()
    }
    out: dict[str, float] = {}
    separator = VARIANTS[variant].separator
    sep_path = ROOT / "sep-timing.json"
    if sep_path.is_file():
        sep = cast(dict[str, dict[str, dict[str, float]]], json.loads(sep_path.read_text()))
        if sep.get(separator):
            out[f"separation ({separator})"] = statistics.median(
                30 * t["seconds"] / t["audio_s"] for t in sep[separator].values()
            )
    notes_path = run_dir(variant) / "timing.json"
    if notes_path.is_file():
        notes = cast(dict[str, float], json.loads(notes_path.read_text()))
        per = [
            30 * s / durations[k.split(".")[0]]
            for k, s in notes.items()
            if k.split(".")[0] in durations
        ]
        if per:
            out["notes.guitar"] = statistics.median(per)
    return out


def sdr_rows(separator: str) -> list[dict[str, Any]]:
    """uSDR of the separated guitar against the clean guitar at the mixture's level."""
    cache_path = ROOT / f"sdr.{separator}.json"
    cache = (
        cast(dict[str, float], json.loads(cache_path.read_text())) if cache_path.is_file() else {}
    )
    rows: list[dict[str, Any]] = []
    for item in load_items():
        for kind in BANDS:
            stem = stem_path(item, separator, kind)
            if not stem.is_file():
                continue
            key = f"{item.id}.{kind}"
            if key not in cache:
                ref = read(item.dir / "guitar.wav").astype(np.float64)
                cache[key] = scoring.usdr(ref, read(stem).astype(np.float64))
                write_json(cache_path, cache)
            rows.append(
                {
                    "item": item.id,
                    "band": kind,
                    "source": item.source,
                    **item.tags,
                    "usdr": cache[key],
                }
            )
    return rows


TRANSCRIBER_RECORDS = {
    "basic_pitch": "basic-pitch",
    "yourmt3": "yourmt3-moe",
    "transkun": "transkun-v2",
}


def versions(variants: Iterable[str]) -> str:
    from splitune_ml_core import register

    sep = cast(
        dict[str, Any],
        yaml.safe_load((ML_ROOT / "config" / "separation.personal.yaml").read_text()),
    )
    notes = cast(
        dict[str, Any], yaml.safe_load((ML_ROOT / "config" / "notes.personal.yaml").read_text())
    )
    records: set[str] = set()
    for v in variants:
        variant = VARIANTS[v]
        records.add(sep["models"][variant.separator]["record"])
        transcriber = variant.transcriber or notes["instruments"]["guitar"]["transcriber"]
        records.add(TRANSCRIBER_RECORDS[transcriber])
    return ", ".join(f"{r} {register.model(r).version}" for r in sorted(records))


STD_KEYS = ("easiest.standard", "as_played.standard")


def tab_cells(sel: list[dict[str, Any]]) -> list[str]:
    cells: list[str] = []
    for key in STD_KEYS:
        counts = pooled(sel, key)
        cells += [fmt(counts.f1) if counts else "-", fmt(counts.tdr) if counts else "-"]
    return cells


SWEEP_GRID: dict[str, tuple[Any, ...]] = {
    "infer_onsets": (True, False),
    "melodia_trick": (True, False),
    "onset_threshold": (0.5, 0.6, 0.7, 0.8),
    "frame_threshold": (0.4, 0.5, 0.6, 0.7),
    "min_note_ms": (58.0, 90.0, 127.7),
    "energy_tol": (6, 11, 16),
}


def is_fit(item: Item) -> bool:
    """Sweep/calibration fit split: about a third of each source; the rest is held out."""
    return item.id.startswith(("gs-03_", "gs2-", "idmt-AR-")) or (
        item.id.startswith("techs-music") and int(item.id[-2:]) % 3 == 0
    )


def cmd_sweep(args: argparse.Namespace) -> int:
    """Basic Pitch decoding options on the hard-band stems (production separator, with the
    variant's A4 compensation): posteriors once per item, the shipped `notes_polyphonic` for every
    combination of SWEEP_GRID; chosen on the fit split by mean onset F1, reported on both."""
    import itertools

    from stage_notes import basic_pitch as bp
    from stage_notes import transcribers
    from stage_notes import tuning as tuning_mod

    variant = VARIANTS[args.variant]
    model = cast(transcribers.BasicPitch, transcribers.get("basic_pitch"))
    base = {
        **transcribers.BASIC_PITCH_DEFAULTS,
        **cast(
            dict[str, Any],
            yaml.safe_load((ML_ROOT / "config" / "notes.personal.yaml").read_text())["instruments"][
                "guitar"
            ]["params"],
        ),
        **variant.overrides,
    }
    combos = [
        dict(zip(SWEEP_GRID, v, strict=True)) for v in itertools.product(*SWEEP_GRID.values())
    ]
    scores: dict[str, list[list[float]]] = {"fit": [], "held-out": []}
    for item in load_items():
        mono = read(stem_path(item, variant.separator, "hard")).mean(axis=1)
        stretch = 1.0
        if base["a4_compensation"]:
            cents = tuning_mod.a4_offset(mono).cents
            if abs(cents) >= transcribers.A4_MIN_CENTS:
                mono, stretch = tuning_mod.retuned(mono, cents)
        posteriors = model.posteriors(mono)
        times = bp.frame_times(posteriors.contour.shape[0]) / stretch
        ref = note_events(list(item.ref().notes))
        row: list[float] = []
        for combo in combos:
            params = {**base, **combo}
            raw = bp.notes_polyphonic(
                posteriors,
                onset_thresh=float(params["onset_threshold"]),
                frame_thresh=float(params["frame_threshold"]),
                min_note_len=bp.min_note_frames(float(params["min_note_ms"])),
                min_freq=params["min_freq_hz"],
                max_freq=params["max_freq_hz"],
                infer_onsets=bool(params["infer_onsets"]),
                melodia_trick=bool(params["melodia_trick"]),
                energy_tol=int(params["energy_tol"]),
            )
            est = [EstNote(float(times[n.start]), float(times[n.end]), n.pitch_midi) for n in raw]
            row.append(scoring.notes(ref, note_events(est))[0]["onset_f1"])
        scores["fit" if is_fit(item) else "held-out"].append(row)
        print(f"sweep {item.id}", flush=True)
    fit = np.mean(np.array(scores["fit"]), axis=0)
    held = np.mean(np.array(scores["held-out"]), axis=0)
    current = combos.index({k: base[k] for k in SWEEP_GRID})
    ranked = [int(k) for k in np.argsort(-fit)[:8]]
    lines = [
        f"## Basic Pitch decoding, hard-band stems, `{args.variant}` "
        f"({len(scores['fit'])} fit / {len(scores['held-out'])} held-out items; onset F1)",
        "",
        "| " + " | ".join(SWEEP_GRID) + " | fit | held-out |",
        "|" + "---|" * (len(SWEEP_GRID) + 2),
    ]
    for k in [*ranked, *([current] if current not in ranked else [])]:
        mark = " (current)" if k == current else ""
        cells = [str(combos[k][name]) for name in SWEEP_GRID]
        lines.append(f"| {' | '.join(cells)}{mark} | {fit[k]:.3f} | {held[k]:.3f} |")
    for name, values in SWEEP_GRID.items():  # each option alone, the rest at the current values
        alone = [
            f"{v}: {held[combos.index({**{n: base[n] for n in SWEEP_GRID}, name: v})]:.3f}"
            for v in values
        ]
        lines.append(f"\n- {name} alone (held-out): " + ", ".join(alone))
    text = "\n".join(lines) + "\n"
    (ROOT / f"sweep-{args.variant}.md").write_text(text, encoding="utf-8")
    print(text)
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    rows = [r for v in args.variant for r in score_rows(v)]
    RESULTS.mkdir(parents=True, exist_ok=True)
    date = datetime.now(UTC).strftime("%Y-%m-%d")
    name = f"{date}-{args.name}" if args.name else date
    csv_path = RESULTS / f"{name}.csv"
    keys = sorted({k for r in rows for k in r})
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(
            {k: json.dumps(v) if isinstance(v, list) else v for k, v in r.items()} for r in rows
        )
    empty = formats.NoteEvents(np.zeros((0, 2)), np.zeros(0))
    _, metric = scoring.notes(empty, empty)
    tab_head = "Tab F1 easiest | TDR easiest | Tab F1 as_played | TDR as_played"
    out = [
        f"# Prototype 2g — guitar accuracy end to end ({date})",
        "",
        f"git `{git_sha()}` · models: {versions(args.variant)} · notes: {metric}; pitch-class F1 = "
        "onset F1 with octaves folded · tab: notes matched as for onset F1, then **TDR** = share "
        "of "
        "matched notes on the reference string and fret, **Tab F1** = notes with the right onset, "
        "pitch, string and fret (precision over all estimated notes, recall over all reference "
        "notes), pooled over items · tab through the shipped `buildTab` (`music-core` CLI, level "
        "`as_transcribed`), standard tuning unless a column says otherwise · beats: shipped beats "
        "stage on the clean guitar",
        "",
        "Variants: " + "; ".join(f"`{v}` = {VARIANTS[v].note}" for v in args.variant),
        "",
    ]
    for tier, sel_tier in tiers(rows):
        out += [
            f"## {tier}",
            "",
            "| variant · condition | items | onset F1 | onset P | onset R | onset+offset F1 "
            f"| pitch-class F1 | {tab_head} |",
            "|---|---|---|---|---|---|---|---|---|---|---|",
        ]
        for v in args.variant:
            for c in conditions():
                sel = select(sel_tier, variant=v, condition=c)
                if sel:
                    notes_cells = [
                        fmt(mean(sel, k))
                        for k in (
                            "onset_f1",
                            "onset_precision",
                            "onset_recall",
                            "onset_offset_f1",
                            "pitch_class_f1",
                        )
                    ]
                    out.append(
                        f"| {v} · {c} | {len(sel)} | "
                        + " | ".join(notes_cells + tab_cells(sel))
                        + " |"
                    )
        out.append("")
    focus = args.focus
    out += [
        f"## By style ({focus}; the sources column says which tier)",
        "",
        f"| variant | style | sources | items | onset F1 | onset P | onset R | {tab_head} |",
        "|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for v in args.variant:
        sel_v = select(rows, variant=v, condition=focus)
        for style in sorted({r["style"] for r in sel_v}):
            sel = select(sel_v, style=style)
            cells = [fmt(mean(sel, k)) for k in ("onset_f1", "onset_precision", "onset_recall")]
            sources = ",".join(sorted({r["source"] for r in sel}))
            out.append(
                f"| {v} | {style} | {sources} | {len(sel)} | "
                + " | ".join(cells + tab_cells(sel))
                + " |"
            )
    out += [
        "",
        f"## By tuning ({focus}, `easiest`): standard-tuning tab vs the reference tuning and capo",
        "",
        "| variant | tuning | items | onset F1 | Tab F1 std | Tab F1 ref tuning | unplayable std "
        "| unplayable ref tuning |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for v in args.variant:
        sel_v = select(rows, variant=v, condition=focus)
        for tuning in sorted({r["tuning"] for r in sel_v}):
            sel = select(sel_v, tuning=tuning)
            std, ref = pooled(sel, "easiest.standard"), pooled(sel, "easiest.reference")
            out.append(
                f"| {v} | {tuning} | {len(sel)} | {fmt(mean(sel, 'onset_f1'))} | "
                f"{fmt(std.f1) if std else '-'} | {fmt(ref.f1) if ref else '-'} | "
                f"{fmt(mean(sel, 'unplayable_share.easiest.standard'))} | "
                f"{fmt(mean(sel, 'unplayable_share.easiest.reference'))} |"
            )
    out += [
        "",
        "## Tuning in the tab (`easiest`): standard vs the applied suggestion vs the truth",
        "",
        "Semitone-detuned stems are the hard-band stems played back 100/200 cents lower: their "
        "true tuning is half/full step down (drop D items become drop C#/C). Applied right = "
        "the suggestion buildTab used equals the true tuning; applied wrong on standard = a "
        "non-standard tuning used on a standard-tuned excerpt.",
        "",
        "| variant | condition | true tuning | items | Tab F1 std | Tab F1 suggested | Tab F1 true "
        "| unplayable std | unplayable suggested | applied right | applied wrong on standard |",
        "|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for v in args.variant:
        for c in ("stem.hard", "detune-100", "detune-200"):
            sel_c = select(rows, variant=v, condition=c)
            for truth in sorted({r["true_tuning"] for r in sel_c}):
                sel = select(sel_c, true_tuning=truth)
                cells: list[str] = []
                for key in ("easiest.standard", "easiest.suggested", "easiest.reference"):
                    counts = pooled(sel, key)
                    cells.append(fmt(counts.f1) if counts else "-")
                cells += [
                    fmt(mean(sel, "unplayable_share.easiest.standard")),
                    fmt(mean(sel, "unplayable_share.easiest.suggested")),
                    str(sum(r["tab_tuning"] == truth != "standard" for r in sel)),
                    str(sum(truth == "standard" != r["tab_tuning"] for r in sel)),
                ]
                out.append(f"| {v} | {c} | {truth} | {len(sel)} | " + " | ".join(cells) + " |")
    detuned = [r for r in rows if detune_cents(r["condition"]) is not None]
    if detuned:
        shifts = ["stem.hard", *detune_conditions()]
        out += [
            "",
            "## Detuned stems (hard-band stem re-pitched by tape speed; onset F1, all items)",
            "",
            "| variant | " + " | ".join(shifts) + " |",
            "|---|" + "---|" * len(shifts),
        ]
        for v in args.variant:
            cells = [fmt(mean(select(rows, variant=v, condition=c), "onset_f1")) for c in shifts]
            out.append(f"| {v} | " + " | ".join(cells) + " |")
    out += [
        "",
        f"## Quantization ({focus}, `easiest`, standard tuning)",
        "",
        "Residual-flagged = share of tab events whose onset is > 60 ms from the grid (1/16, or "
        "swung 1/8); error = median |quantized onset - reference onset| over matched notes.",
        "",
        "| variant | style | residual-flagged | quantized onset error ms |",
        "|---|---|---|---|",
    ]
    for v in args.variant:
        sel_v = select(rows, variant=v, condition=focus)
        for style in sorted({r["style"] for r in sel_v}):
            sel = select(sel_v, style=style)
            out.append(
                f"| {v} | {style} | {fmt(mean(sel, 'residual_flag_share'))} | "
                f"{mean(sel, 'quantized_onset_err_ms'):.1f} |"
            )
    bent = [r for r in rows if "bend_ref" in r and r["condition"] == focus]
    if bent:
        out += [
            "",
            f"## Bends ({focus}, ≥ 50 cents, matched notes)",
            "",
            "| variant | reference bends | detected | hits | precision | recall |",
            "|---|---|---|---|---|---|",
        ]
        for v in args.variant:
            sel = select(bent, variant=v)
            ref_n, est_n, hit = (
                sum(int(r[k]) for r in sel) for k in ("bend_ref", "bend_est", "bend_hit")
            )
            precision = hit / est_n if est_n else float("nan")
            recall = hit / ref_n if ref_n else float("nan")
            out.append(f"| {v} | {ref_n} | {est_n} | {hit} | {fmt(precision)} | {fmt(recall)} |")
    out += [
        "",
        "## Separation (uSDR of the guitar stem vs the clean guitar, dB)",
        "",
        "| separator | band | source | items | median uSDR |",
        "|---|---|---|---|---|",
    ]
    for separator in sorted({VARIANTS[v].separator for v in args.variant}):
        sdr = sdr_rows(separator)
        for kind in BANDS:
            for source in sorted({r["source"] for r in sdr}):
                values = [r["usdr"] for r in sdr if r["band"] == kind and r["source"] == source]
                if values:
                    out.append(
                        f"| {separator} | {kind} | {source} | {len(values)} | "
                        f"{statistics.median(values):.2f} |"
                    )
    out += ["", "## Time per 30 s of audio (this machine, median)", ""]
    for v in args.variant:
        for stage, seconds in timing_rows(v).items():
            out.append(f"- `{v}` {stage}: {seconds:.1f} s")
    out += ["", f"Per-item rows: `{csv_path.name}`. Command: `{' '.join(sys.argv)}`", ""]
    text = "\n".join(out)
    (RESULTS / f"{name}.md").write_text(text, encoding="utf-8")
    print(text)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n", 1)[0])
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("bands").set_defaults(fn=cmd_bands)
    p = sub.add_parser("build")
    p.add_argument("--source", nargs="+", choices=list(BUILDERS), default=list(BUILDERS))
    p.set_defaults(fn=cmd_build)
    p = sub.add_parser("separate")
    p.add_argument("--model", choices=[*SEPARATORS, *COMBINED], default=SEPARATORS[0])
    p.set_defaults(fn=cmd_separate)
    sub.add_parser("beats").set_defaults(fn=cmd_beats)
    p = sub.add_parser("predict")
    p.add_argument("--variant", choices=list(VARIANTS), required=True)
    p.add_argument("--condition", nargs="+", choices=conditions() + detune_conditions())
    p.set_defaults(fn=cmd_predict)
    p = sub.add_parser("tab")
    p.add_argument("--variant", choices=list(VARIANTS), required=True)
    p.add_argument("--tuning", nargs="+", choices=TAB_TUNINGS, default=list(TAB_TUNINGS))
    p.set_defaults(fn=cmd_tab)
    p = sub.add_parser("sweep")
    p.add_argument("--variant", choices=list(VARIANTS), default="a4comp")
    p.set_defaults(fn=cmd_sweep)
    p = sub.add_parser("report")
    p.add_argument("--variant", nargs="+", choices=list(VARIANTS), default=["baseline"])
    p.add_argument("--focus", choices=conditions(), default="stem.hard")
    p.add_argument("--name", help="report file suffix (default: the date only)")
    p.set_defaults(fn=cmd_report)
    args = parser.parse_args()
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
