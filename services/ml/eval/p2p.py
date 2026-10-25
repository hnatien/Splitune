"""Prototype 2p: piano transcription on the owner's kind of songs (step 24; 08 §3 P2p).

    uv run python eval/p2p.py plan             # pick excerpts → eval/sets/p2p.yaml (committed)
    uv run python eval/p2p.py build            # render / cut every excerpt → ~/datasets/p2p
    uv run python eval/p2p.py separate         # piano stems for the mixtures (timed)
    uv run python eval/p2p.py predict --chain baseline [--condition ...] [--tier ...]
    uv run python eval/p2p.py hands            # splitHands vs ASAP score staves (music-core CLI)
    uv run python eval/p2p.py report --chain baseline [...]  → eval/results/p2p/<date>.md + .csv

Tiers (reported apart, never merged without saying so):
- `real-solo`: MAPS ENSTDkCl/ENSTDkAm and SMD v2 (Disklavier audio and MIDI with pedal, outside
  MAESTRO's pianos and rooms).
- `real-band`: other MAPS/SMD excerpts under the non-piano stems of a Slakh2100 test track
  (tempo and key don't match: interference, not musical context).
- `pop-solo`: POP909 MELODY + PIANO ("a solo cover") rendered through sampled acoustic and
  electric pianos, harpsichord or a GM clavinet, with room, phone-chain or detune augmentation;
  ballads get a synthetic sustain pedal (down after each downbeat, lifted before the next).
- `pop-band`: the POP909 PIANO track warped onto a Slakh2100 test track's beats and transposed to
  its key, mixed under its non-piano stems (some with the piano's top line doubled by a guitar or
  synth), plus Slakh2100 test tracks' own piano parts (programs 0-7) in their own mixes.
- `legacy`: the P2 piano items (MAESTRO test + MUSDB band, BabySlakh) from `eval/p2.py`.

References: `ref.keyoff.csv` (onset, key-release offset, pitch, velocity) and `ref.pedoff.csv`
(offsets extended while the sustain pedal is down, cut at the next onset of the same key), and
`pedal.csv` (sustain down intervals). Every prediction runs the shipped stages in-process
(`splitune_eval.local`); hands and quantization run the shipped `buildPianoScore` through the
music-core CLI. Conditions: `clean` (the piano alone: a ceiling), `stem` (separated), `mixture`
and `chosen` (the input the chain picks: today always the stem when the mixture has a band).
Datasets live under ~/datasets (licences in docs/research/ml/transcription-piano.md); nothing here
is committed but the manifest.
"""

from __future__ import annotations

import argparse
import csv
import io
import itertools
import json
import os
import statistics
import subprocess
import sys
import tempfile
import time
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import mir_eval  # pyright: ignore[reportMissingTypeStubs]
import numpy as np
import pretty_midi  # pyright: ignore[reportMissingTypeStubs]
import pyloudnorm  # pyright: ignore[reportMissingTypeStubs]
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
import yaml
from numpy.typing import NDArray
from scipy.signal import butter, fftconvolve, resample, resample_poly, sosfilt  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]
from splitune_eval import formats, scoring
from splitune_eval.calibration import reliability
from splitune_eval.local import LocalRun, write_json
from splitune_eval.report import git_sha

# pretty_midi warns about tempo events on non-zero tracks of type-1 files; the times are right.
# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false

# MAPS files use a fine tick resolution that trips pretty_midi's corrupt-file guard.
pretty_midi.pretty_midi.MAX_TICK = 10**8

DATA = Path("~/datasets").expanduser()
ROOT = DATA / "p2p"
MAPS = DATA / "maps"
SMD = DATA / "smd"
POP909 = DATA / "pop909" / "POP909"
SLAKH = DATA / "slakh2100" / "slakh2100_flac_redux" / "test"
ASAP = DATA / "asap"
SOUNDS = DATA / "sounds"
SFIZZ = DATA / "_tools" / "sfizz" / "bin" / "Release" / "sfizz_render.exe"
FLUIDSYNTH = (
    DATA / "_tools" / "fluidsynth" / "fluidsynth-v2.6.1-win10-x64-cpp11" / "bin" / "fluidsynth.exe"
)
GM_SF2 = SOUNDS / "GeneralUser-GS.sf2"
LEGACY = DATA / "p2"
EVAL = Path(__file__).resolve().parent
ML_ROOT = EVAL.parent
REPO = ML_ROOT.parents[1]
MANIFEST = EVAL / "sets" / "p2p.yaml"
RESULTS = EVAL / "results" / "p2p"
RATE = 44100
WINDOW_S = 30.0
SEED = 24
TIERS = ("real-solo", "real-band", "pop-solo", "pop-band", "legacy")
CONDITIONS = ("clean", "stem", "mixture", "chosen")
PIANO_PROGRAMS = range(
    8
)  # General MIDI piano family: 0-3 acoustic, 4-5 electric, 6-7 harpsichord/clav
# Renderers: sfz = sfizz_render through a sample library, gm = FluidSynth through GeneralUser GS.
RENDERERS: dict[str, dict[str, Any]] = {
    "salamander": {"sfz": "SalamanderGrandPiano/Salamander Grand Piano V3.sfz", "kind": "acoustic"},
    "splendid": {"sfz": "SplendidGrandPiano/Splendid Grand Piano.sfz", "kind": "acoustic"},
    "headroom": {"sfz": "BengtNilsson.HeadroomPiano/Headroom Piano.sfz", "kind": "acoustic"},
    "upright": {"sfz": "karoryfer.scarypiano/Programs/Scarypiano.sfz", "kind": "acoustic"},
    "rhodes": {
        "sfz": "jlearman.jRhodes3c/jRhodes3c-looped-flac-sfz/_jRhodes-stereo-looped.sfz",
        "kind": "electric",
    },
    "wurlitzer": {
        "sfz": "GregSullivan.E-Pianos/Wurlitzer EP200/Wurlitzer EP200.sfz",
        "kind": "electric",
    },
    "cp80": {"sfz": "GregSullivan.E-Pianos/CP80/CP80.sfz", "kind": "electric"},
    "harpsichord": {"sfz": "Clavecin/Clavecin.sfz", "kind": "keys"},
    "clavinet": {"gm": 7, "kind": "keys"},
}
DOUBLINGS = {"guitar": 25, "synth": 81}  # GM steel-string guitar, saw lead
NATIVE_MIN_NOTES = 60
BAND_LEVEL_LU = {"featured": 2.0, "buried": 6.0}  # piano this far below the band's loudness

Audio = NDArray[np.float32]
Note = tuple[float, float, int, int]  # onset, offset, pitch, velocity


# --- audio ---------------------------------------------------------------------------------------


def read_stereo(path: Path, t0: float = 0.0, seconds: float | None = None) -> Audio:
    info = sf.info(str(path))
    start = int(t0 * info.samplerate)
    frames = -1 if seconds is None else int(seconds * info.samplerate)
    data, sr = sf.read(str(path), start=start, frames=frames, dtype="float32", always_2d=True)
    audio = np.asarray(data, dtype=np.float32)
    if audio.shape[1] == 1:
        audio = np.repeat(audio, 2, axis=1)
    audio = audio[:, :2]
    if sr != RATE:
        audio = np.asarray(resample_poly(audio, RATE, int(sr), axis=0), dtype=np.float32)
    return audio


def write(path: Path, audio: Audio) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), audio, RATE, subtype="FLOAT")


def fit(audio: Audio, frames: int) -> Audio:
    out = np.zeros((frames, 2), dtype=np.float32)
    n = min(frames, len(audio))
    out[:n] = audio[:n]
    return out


def loudness(audio: Audio) -> float:
    meter = pyloudnorm.Meter(RATE)
    return float(meter.integrated_loudness(audio.astype(np.float64)))


def room(audio: Audio, rng: np.random.Generator, rt60: float = 0.8, wet: float = 0.35) -> Audio:
    """A synthetic stereo room: decaying noise as impulse response, mixed under the dry sound."""
    t = np.arange(int(rt60 * RATE)) / RATE
    ir = rng.standard_normal((len(t), 2)) * np.exp(-6.9 * t / rt60)[:, None]
    ir /= np.sqrt(np.sum(ir**2, axis=0, keepdims=True))
    tail = np.stack([fftconvolve(audio[:, c], ir[:, c])[: len(audio)] for c in range(2)], axis=1)
    return np.asarray((1 - wet) * audio + wet * tail, dtype=np.float32)


def phone(audio: Audio) -> Audio:
    """Phone-recording chain: 200 Hz-6 kHz band, soft compression, MP3 128 kbit/s round trip."""
    sos = butter(4, [200, 6000], btype="bandpass", fs=RATE, output="sos")
    x = np.asarray(sosfilt(sos, audio, axis=0), dtype=np.float64)
    peak = float(np.max(np.abs(x))) or 1.0
    x = np.tanh(3.0 * x / peak) / np.tanh(3.0) * 0.8
    with tempfile.TemporaryDirectory() as tmp:
        src, mp3, back = (Path(tmp) / n for n in ("in.wav", "x.mp3", "out.wav"))
        write(src, np.asarray(x, dtype=np.float32))
        for args in (["-i", str(src), "-b:a", "128k", str(mp3)], ["-i", str(mp3), str(back)]):
            subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)
        out = read_stereo(back)
    return fit(out, len(audio))


def detune(audio: Audio, cents: float) -> tuple[Audio, float]:
    """Plays the audio `cents` sharp (faster); returns it and the time factor for the references."""
    factor = 2 ** (cents / 1200)
    n = round(len(audio) / factor)
    return np.asarray(resample(audio, n, axis=0), dtype=np.float32), 1 / factor


# --- MIDI and references -------------------------------------------------------------------------


def midi_notes(midi: Any, programs: Iterable[int] | None = None) -> list[Note]:
    keep = None if programs is None else set(programs)
    return sorted(
        (float(n.start), float(n.end), int(n.pitch), int(n.velocity))
        for inst in midi.instruments
        if not inst.is_drum and (keep is None or inst.program in keep)
        for n in inst.notes
    )


def midi_pedal(midi: Any) -> list[tuple[float, float]]:
    """Sustain-pedal (CC64 ≥ 64) down intervals over every instrument."""
    events = sorted(
        (float(c.time), c.value >= 64)
        for inst in midi.instruments
        for c in inst.control_changes
        if c.number == 64
    )
    out: list[tuple[float, float]] = []
    start: float | None = None
    for t, down in events:
        if down and start is None:
            start = t
        elif not down and start is not None:
            out.append((start, t))
            start = None
    if start is not None:
        out.append((start, float(midi.get_end_time())))
    return out


def pedal_extend(notes: list[Note], pedal: list[tuple[float, float]]) -> list[Note]:
    """Offsets held by the sustain pedal (key released while it is down → its release), then cut
    at the next onset of the same key: the convention of MAESTRO's and MAPS's sounding offsets."""
    out: list[Note] = []
    for on, off, p, v in notes:
        for a, b in pedal:
            if a <= off < b:
                off = b
                break
        out.append((on, off, p, v))
    by_key: dict[int, list[int]] = {}
    for i, (_, _, p, _) in enumerate(out):
        by_key.setdefault(p, []).append(i)
    for idx in by_key.values():
        for i, j in itertools.pairwise(idx):
            on, off, p, v = out[i]
            nxt = out[j][0]
            if off > nxt > on:
                out[i] = (on, nxt, p, v)
    return out


def window_notes(notes: list[Note], t0: float, t1: float) -> list[Note]:
    return [
        (on - t0, min(off, t1) - t0, p, v) for on, off, p, v in notes if t0 <= on < t1 and off > on
    ]


def window_pedal(
    pedal: list[tuple[float, float]], t0: float, t1: float
) -> list[tuple[float, float]]:
    return [(max(a, t0) - t0, min(b, t1) - t0) for a, b in pedal if b > t0 and a < t1]


def write_refs(
    out: Path, keyoff: list[Note], pedoff: list[Note], pedal: list[tuple[float, float]]
) -> None:
    for name, notes in (("ref.keyoff.csv", keyoff), ("ref.pedoff.csv", pedoff)):
        buf = io.StringIO()
        csv.writer(buf, lineterminator="\n").writerows(
            (f"{a:.4f}", f"{b:.4f}", p, v) for a, b, p, v in sorted(notes)
        )
        (out / name).write_text(buf.getvalue(), encoding="utf-8", newline="\n")
    (out / "pedal.csv").write_text(
        "".join(f"{a:.4f},{b:.4f}\n" for a, b in pedal), encoding="utf-8"
    )


def to_midi(
    notes: list[Note], pedal: list[tuple[float, float]], program: int = 0, end_s: float = 0.0
) -> Any:
    """One instrument; a no-op controller at `end_s` keeps the file (and sfizz's render, which
    stops at the end of track) running past the last note-off so release tails survive."""
    midi = pretty_midi.PrettyMIDI(initial_tempo=120.0)
    inst = pretty_midi.Instrument(program=program)
    inst.notes = [pretty_midi.Note(velocity=v, pitch=p, start=a, end=b) for a, b, p, v in notes]
    inst.control_changes.append(pretty_midi.ControlChange(7, 127, end_s))
    for a, b in pedal:
        inst.control_changes += [
            pretty_midi.ControlChange(64, 127, a),
            pretty_midi.ControlChange(64, 0, b),
        ]
    midi.instruments.append(inst)
    return midi


def render(
    notes: list[Note], pedal: list[tuple[float, float]], renderer: str, seconds: float
) -> Audio:
    spec = RENDERERS.get(renderer) or {"gm": DOUBLINGS[renderer]}
    with tempfile.TemporaryDirectory() as tmp:
        mid, wav = Path(tmp) / "in.mid", Path(tmp) / "out.wav"
        to_midi(notes, pedal, int(spec.get("gm", 0)), seconds + 1.0).write(str(mid))
        if "sfz" in spec:
            cmd = [str(SFIZZ), "--sfz", str(SOUNDS / spec["sfz"]), "--midi", str(mid)]
            cmd += ["--wav", str(wav), "-s", str(RATE), "--use-eot"]
        else:
            cmd = [str(FLUIDSYNTH), "-ni", "-q", "-g", "0.6", "-r", str(RATE), "-F", str(wav)]
            cmd += [str(GM_SF2), str(mid)]
        subprocess.run(cmd, check=True, capture_output=True)
        audio = read_stereo(wav)
    return fit(audio, int(seconds * RATE))


# --- sources -------------------------------------------------------------------------------------


def maps_pieces(kind: str) -> list[Path]:
    return sorted((MAPS / kind / "MUS").glob("*.mid"))


def smd_pieces() -> list[Path]:
    return sorted(p for p in (SMD / "midi").glob("*.mid") if smd_audio(p).is_file())


def smd_audio(midi: Path) -> Path:
    return SMD / "wav_44100_stereo" / f"{midi.stem}.wav"


def slakh_meta(track: Path) -> dict[str, Any]:
    return cast(
        dict[str, Any], yaml.safe_load((track / "metadata.yaml").read_text(encoding="utf-8"))
    )


def slakh_tracks() -> list[Path]:
    return sorted(
        t for t in SLAKH.iterdir() if (t / "mix.flac").is_file() and (t / "metadata.yaml").is_file()
    )


def slakh_stems(track: Path) -> dict[str, dict[str, Any]]:
    """Rendered stems with audio on disk."""
    return {
        k: v
        for k, v in slakh_meta(track)["stems"].items()
        if v.get("audio_rendered", True) and (track / "stems" / f"{k}.flac").is_file()
    }


def is_piano(stem: dict[str, Any]) -> bool:
    return not stem.get("is_drum") and int(stem.get("program_num", -1)) in PIANO_PROGRAMS


def slakh_band(track: Path, t0: float, density: str) -> Audio:
    """The track's non-piano stems in the window: `sparse` = drums + bass, `dense` = all."""
    stems = slakh_stems(track)
    keep = [
        k
        for k, s in stems.items()
        if not is_piano(s)
        and (density == "dense" or s.get("is_drum") or s.get("inst_class") == "Bass")
    ]
    frames = int(WINDOW_S * RATE)
    band = np.zeros((frames, 2), dtype=np.float32)
    for k in keep:
        band += fit(read_stereo(track / "stems" / f"{k}.flac", t0, WINDOW_S), frames)
    return band


def piano_window(track: Path) -> tuple[float, int]:
    """Start (a multiple of 10 s) and note count of the 30 s window with most piano-part notes."""
    onsets = sorted(
        on
        for k, s in slakh_stems(track).items()
        if is_piano(s) and (track / "MIDI" / f"{k}.mid").is_file()
        for on, *_ in midi_notes(pretty_midi.PrettyMIDI(str(track / "MIDI" / f"{k}.mid")))
    )
    end = onsets[-1] if onsets else 0.0
    starts = [10.0 * k for k in range(max(1, int((end - WINDOW_S) // 10) + 1))]
    counts = [sum(1 for t in onsets if a <= t < a + WINDOW_S) for a in starts]
    best = int(np.argmax(counts))
    return starts[best], counts[best]


def slakh_midi(track: Path) -> Any:
    return pretty_midi.PrettyMIDI(str(track / "all_src.mid"))


def slakh_pitch_classes(track: Path, t0: float) -> NDArray[np.float64]:
    stems = slakh_stems(track)
    hist = np.zeros(12)
    for k, s in stems.items():
        if s.get("is_drum") or is_piano(s) or not (track / "MIDI" / f"{k}.mid").is_file():
            continue
        for on, off, p, _ in midi_notes(pretty_midi.PrettyMIDI(str(track / "MIDI" / f"{k}.mid"))):
            if t0 <= on < t0 + WINDOW_S:
                hist[p % 12] += off - on
    return hist


def pop909_song(song: str) -> tuple[Any, NDArray[np.float64], NDArray[np.bool_]]:
    """POP909 MIDI with its beat times and downbeat flags (beat_midi.txt: time, downbeat, -)."""
    folder = POP909 / song
    midi = pretty_midi.PrettyMIDI(str(folder / f"{song}.mid"))
    rows = np.loadtxt(folder / "beat_midi.txt", ndmin=2)
    return midi, rows[:, 0], rows[:, 1] > 0.5


def pop909_tracks(midi: Any, names: Iterable[str]) -> list[Note]:
    keep = {n.upper() for n in names}
    return sorted(
        (float(n.start), float(n.end), int(n.pitch), int(n.velocity))
        for inst in midi.instruments
        if inst.name.upper() in keep
        for n in inst.notes
    )


def bar_pedal(
    beats: NDArray[np.float64], downbeats: NDArray[np.bool_], t0: float, t1: float
) -> list[tuple[float, float]]:
    """Synthetic sustain pedal: down 50 ms after each downbeat, lifted 30 ms before the next."""
    bars = beats[downbeats]
    return [(float(a) + 0.05, float(b) - 0.03) for a, b in itertools.pairwise(bars) if t0 <= a < t1]


def tempo(beats: NDArray[np.float64]) -> float:
    return 60.0 / float(np.median(np.diff(beats)))


def first_downbeat(beats: NDArray[np.float64], downbeats: NDArray[np.bool_], after: float) -> int:
    return int(
        next(i for i, (t, d) in enumerate(zip(beats, downbeats, strict=True)) if d and t >= after)
    )


# --- plan ----------------------------------------------------------------------------------------


def cmd_plan(_: argparse.Namespace) -> int:
    """Deterministic excerpt choice (seed 24); every piece, song and Slakh track at most once per
    tier, fit/test alternating within each tier so no performance is in both splits."""
    rng = np.random.default_rng(SEED)
    items: list[dict[str, Any]] = []

    def add(tier: str, item: dict[str, Any]) -> None:
        n = sum(1 for i in items if i["tier"] == tier)
        items.append(
            {
                "id": f"{tier}-{n:02d}",
                "tier": tier,
                "split": "fit" if n % 2 == 0 else "test",
                **item,
            }
        )

    # Real pianos: MAPS ENSTDkCl/Am 6 pieces each, SMD 8 (solo 4+4+4, band 2+2+4).
    real: list[tuple[str, Path]] = []
    for kind in ("ENSTDkCl", "ENSTDkAm"):
        pieces = maps_pieces(kind)
        real += [(kind, pieces[i]) for i in rng.choice(len(pieces), 6, replace=False)]
    smd = smd_pieces()
    real += [("SMD", smd[i]) for i in rng.choice(len(smd), 8, replace=False)]
    tracks = slakh_tracks()
    # Every Slakh2100 test track has a piano-class part: bands are the other stems, and the
    # native piano items come from tracks no band uses.
    band_tracks = tracks
    order = rng.permutation(len(band_tracks)).tolist()
    for n, (kind, midi) in enumerate(real):
        src = {
            "kind": "maps" if kind != "SMD" else "smd",
            "midi": midi.relative_to(DATA).as_posix(),
        }
        solo = n % 6 < 4 if kind != "SMD" else n % 8 < 4
        tags = ["acoustic", "solo" if solo else "band", kind]
        if solo:
            add("real-solo", {"source": src, "window": [15.0, 15.0 + WINDOW_S], "tags": tags})
        else:
            density = "sparse" if n % 2 else "dense"
            band = band_tracks[order.pop()]
            add(
                "real-band",
                {
                    "source": src,
                    "window": [15.0, 15.0 + WINDOW_S],
                    "band": {
                        "track": band.name,
                        "t0": 30.0,
                        "density": density,
                        "level": "featured",
                    },
                    "tags": [*tags, density],
                },
            )

    # POP909: 4 ballads (slowest songs) + 8 more as solo covers, 8 more over Slakh bands.
    songs = sorted(p.name for p in POP909.iterdir() if (p / "beat_midi.txt").is_file())
    tempos = {s: tempo(np.loadtxt(POP909 / s / "beat_midi.txt", ndmin=2)[:, 0]) for s in songs}
    slow = [s for s in songs if tempos[s] < 76]
    ballads = [slow[i] for i in rng.choice(len(slow), 4, replace=False)]
    rest = [s for s in songs if s not in ballads]
    picked = [rest[i] for i in rng.choice(len(rest), 16, replace=False)]
    solo_renderers = [
        "salamander",
        "splendid",
        "headroom",
        "upright",
        "rhodes",
        "wurlitzer",
        "salamander",
        "cp80",
        "harpsichord",
        "clavinet",
        "splendid",
        "upright",
    ]
    augments: list[dict[str, Any]] = [
        {},
        {"room": True},
        {},
        {"phone": True},
        {},
        {"room": True},
        {"detune_cents": 30},
        {},
        {},
        {"phone": True},
        {"detune_cents": -25},
        {"room": True},
    ]
    for n, song in enumerate([*ballads, *picked[:8]]):
        renderer = solo_renderers[n]
        aug = augments[n]
        tags = [RENDERERS[renderer]["kind"], "solo", renderer]
        tags += ["heavy-pedal"] if song in ballads else []
        tags += ["phone"] if aug.get("phone") else []
        tags += ["off-a440"] if aug.get("detune_cents") else []
        tags += ["room"] if aug.get("room") else []
        add(
            "pop-solo",
            {
                "source": {"kind": "pop909", "song": song, "tracks": ["MELODY", "PIANO"]},
                "start_after_s": 20.0,
                "render": renderer,
                "pedal": "bars" if song in ballads else None,
                "augment": aug,
                "tags": tags,
            },
        )
    band_renderers = [
        "salamander",
        "headroom",
        "rhodes",
        "splendid",
        "upright",
        "wurlitzer",
        "salamander",
        "splendid",
    ]
    doublings = [None, "guitar", None, None, "synth", None, "guitar", None]
    for n, song in enumerate(picked[8:]):
        density = "dense" if n % 2 == 0 else "sparse"
        level = "buried" if n % 4 == 3 else "featured"
        renderer = band_renderers[n]
        tags = [RENDERERS[renderer]["kind"], "band", renderer, density, level]
        tags += ["doubled"] if doublings[n] else []
        add(
            "pop-band",
            {
                "source": {"kind": "pop909", "song": song, "tracks": ["PIANO"]},
                "render": renderer,
                "band": {
                    "track": band_tracks[order.pop()].name,
                    "t0": 20.0,
                    "density": density,
                    "level": level,
                },
                "double": doublings[n],
                "tags": tags,
            },
        )
    # Slakh2100 test tracks' own piano parts in their own mixes: 5 acoustic, 3 electric/keys,
    # each in its densest 30 s piano window, tracks with fewer than NATIVE_MIN_NOTES left out.
    used = {i.get("band", {}).get("track") for i in items}
    windows = {t.name: piano_window(t) for t in tracks if t.name not in used}
    piano_tracks = [
        t for t in tracks if t.name in windows and windows[t.name][1] >= NATIVE_MIN_NOTES
    ]
    acoustic = [
        t
        for t in piano_tracks
        if all(int(s["program_num"]) <= 3 for s in slakh_stems(t).values() if is_piano(s))
    ]
    electric = [t for t in piano_tracks if t not in acoustic]
    for group, count, kind in ((acoustic, 5, "acoustic"), (electric, 3, "electric")):
        for i in rng.choice(len(group), count, replace=False):
            track = group[int(i)]
            others = [
                s for s in slakh_stems(track).values() if not is_piano(s) and not s.get("is_drum")
            ]
            density = "sparse" if len(others) <= 3 else "dense"
            add(
                "pop-band",
                {
                    "source": {"kind": "slakh", "track": track.name},
                    "window": [windows[track.name][0], windows[track.name][0] + WINDOW_S],
                    "tags": [kind, "band", "slakh-native", density],
                },
            )
    registered = [
        {
            "id": i["id"],
            "audio": f"{i['id']}/mixture.wav",
            "annotations": {"notes": f"{i['id']}/ref.keyoff.csv"},
            "tags": {"tier": i["tier"], "split": i["split"], "labels": " ".join(i["tags"])},
            "p2p": {k: v for k, v in i.items() if k not in ("id", "tier", "split", "tags")},
        }
        for i in items
    ]
    document = {
        "id": "p2p",
        "description": "Step 24 P2p: piano transcription on real pianos and rendered pop piano, "
        "solo and in Slakh2100 bands (eval/p2p.py plan, seed 24)",
        "licence": "MAPS CC-BY-NC-SA-2.0-FR, SMD CC-BY-NC-SA-3.0, POP909 MIT, Slakh2100 CC-BY-4.0, "
        "sample libraries under their own licences (research use)",
        "provenance": "Zenodo 18160555 (MAPS), 13753319 (SMD v2), 4599666 (Slakh2100 redux test "
        "split), github.com/music-x-lab/POP909-Dataset; rendered and mixed by eval/p2p.py build",
        "root": "~/datasets/p2p",
        "split": "test",
        "tasks": ["notes", "sep"],
        "items": registered,
    }
    MANIFEST.write_text(
        "# Built locally by `eval/p2p.py build`; only this list is committed. `p2p` holds the\n"
        "# recipe of each excerpt (source, window, renderer, band, augmentation).\n"
        + yaml.safe_dump(document, sort_keys=False, width=100, allow_unicode=True),
        encoding="utf-8",
    )
    print(f"{len(items)} items → {MANIFEST.relative_to(REPO)}")
    return 0


def load_items(tiers: Iterable[str] = TIERS) -> list[dict[str, Any]]:
    wanted = set(tiers)
    document = (
        cast(dict[str, Any], yaml.safe_load(MANIFEST.read_text(encoding="utf-8")))
        if MANIFEST.is_file()
        else {"items": []}
    )
    out = [
        {
            "id": i["id"],
            "tier": i["tags"]["tier"],
            "split": i["tags"]["split"],
            "tags": i["tags"]["labels"].split(),
            "dir": str(ROOT / i["id"]),
            **i["p2p"],
        }
        for i in cast(list[dict[str, Any]], document["items"])
        if i["tags"]["tier"] in wanted
    ]
    if "legacy" in wanted:
        out += legacy_items()
    return out


def legacy_items() -> list[dict[str, Any]]:
    """P2's piano items (eval/p2.py build-piano / build-bass), keyoff references only."""
    out: list[dict[str, Any]] = []
    for name, label in (("piano", "maestro"), ("slakh", "babyslakh")):
        path = LEGACY / f"{name}.json"
        if not path.is_file():
            continue
        for item in cast(list[dict[str, Any]], json.loads(path.read_text(encoding="utf-8"))):
            if "piano" not in item["instruments"]:
                continue
            out.append(
                {
                    "id": f"legacy-{item['id']}",
                    "tier": "legacy",
                    "split": "fit" if len(out) % 2 == 0 else "test",
                    "dir": item["dir"],
                    "legacy_ref": item["instruments"]["piano"],
                    "tags": [
                        "acoustic"
                        if label == "maestro"
                        or all(p <= 3 for p in item["tags"].get("piano_programs", [0]))
                        else "electric",
                        "band",
                        label,
                    ],
                }
            )
    return out


# --- build ---------------------------------------------------------------------------------------


def mix(piano: Audio, band: Audio, level: str) -> tuple[Audio, Audio]:
    gain_db = loudness(band) - loudness(piano) - BAND_LEVEL_LU[level]
    piano = piano * np.float32(10 ** (gain_db / 20))
    mixture = piano + band
    scale = np.float32(min(1.0, 0.9 / float(np.max(np.abs(mixture)))))
    return piano * scale, mixture * scale


def normalize(audio: Audio) -> Audio:
    return audio * np.float32(0.9 / max(float(np.max(np.abs(audio))), 1e-6))


def build_real(item: dict[str, Any], out: Path) -> None:
    src = item["source"]
    midi_path = DATA / src["midi"]
    audio_path = midi_path.with_suffix(".wav") if src["kind"] == "maps" else smd_audio(midi_path)
    t0, t1 = item["window"]
    midi = pretty_midi.PrettyMIDI(str(midi_path))
    notes, pedal = midi_notes(midi), midi_pedal(midi)
    keyoff = window_notes(notes, t0, t1)
    pedoff = window_notes(pedal_extend(notes, pedal), t0, t1)
    piano = fit(read_stereo(audio_path, t0, WINDOW_S), int(WINDOW_S * RATE))
    write_refs(out, keyoff, pedoff, window_pedal(pedal, t0, t1))
    if "band" in item:
        b = item["band"]
        band = slakh_band(SLAKH / b["track"], b["t0"], b["density"])
        piano, mixture = mix(piano, band, b["level"])
        write(out / "mixture.wav", mixture)
    else:
        piano = normalize(piano)
        write(out / "mixture.wav", piano)
    write(out / "piano.wav", piano)


def warp(
    notes: list[Note], src: NDArray[np.float64], dst: NDArray[np.float64], shift: int
) -> list[Note]:
    """Maps note times from beats `src` onto beats `dst` (piecewise linear) and transposes."""
    n = min(len(src), len(dst))

    def at(t: float) -> float:
        return float(np.interp(t, src[:n], dst[:n], left=np.nan, right=np.nan))

    out = [(at(a), at(b), p + shift, v) for a, b, p, v in notes]
    return [
        (a, b, p, v) for a, b, p, v in out if np.isfinite(a) and np.isfinite(b) and 21 <= p <= 108
    ]


def best_shift(notes: list[Note], target: NDArray[np.float64]) -> int:
    hist = np.zeros(12)
    for a, b, p, _ in notes:
        hist[p % 12] += b - a
    scores = {k: float(np.dot(np.roll(hist, k), target)) for k in range(-5, 7)}
    return max(scores, key=lambda k: scores[k])


def top_line(notes: list[Note]) -> list[Note]:
    """The highest note of each onset group (within 30 ms): what a doubling instrument plays."""
    out: list[Note] = []
    for note in sorted(notes):
        if out and note[0] - out[-1][0] < 0.03:
            if note[2] > out[-1][2]:
                out[-1] = note
        else:
            out.append(note)
    return out


def build_pop909(item: dict[str, Any], out: Path) -> None:
    rng = np.random.default_rng(SEED + int(item["id"][-2:]))
    src = item["source"]
    midi, beats, downbeats = pop909_song(src["song"])
    notes = pop909_tracks(midi, src["tracks"])
    if "band" in item:
        b = item["band"]
        track = SLAKH / b["track"]
        smidi = slakh_midi(track)
        sbeats = np.asarray(smidi.get_beats(), dtype=np.float64)
        sdown = np.isin(sbeats, np.asarray(smidi.get_downbeats()))
        j = first_downbeat(sbeats, sdown, b["t0"])
        i = first_downbeat(beats, downbeats, 20.0)
        shift = best_shift(notes, slakh_pitch_classes(track, float(sbeats[j])))
        t0 = float(sbeats[j])
        warped = warp(notes, beats[i:], sbeats[j:] - t0, shift)
        keyoff = window_notes(warped, 0.0, WINDOW_S)
        pedal: list[tuple[float, float]] = []
        piano = render(keyoff, pedal, item["render"], WINDOW_S)
        band = slakh_band(track, t0, b["density"])
        if item.get("double"):
            band += render(top_line(keyoff), [], item["double"], WINDOW_S) * np.float32(0.5)
        piano, mixture = mix(piano, band, b["level"])
        write(out / "mixture.wav", mixture)
        write(out / "piano.wav", piano)
        write_refs(out, keyoff, keyoff, pedal)
        return
    i = first_downbeat(beats, downbeats, float(item["start_after_s"]))
    t0 = float(beats[i])
    t1 = t0 + WINDOW_S
    pedal_full = bar_pedal(beats, downbeats, t0, t1) if item.get("pedal") == "bars" else []
    keyoff = window_notes(notes, t0, t1)
    pedal = window_pedal(pedal_full, t0, t1)
    pedoff = window_notes(pedal_extend(notes, pedal_full), t0, t1)
    piano = render(keyoff, pedal, item["render"], WINDOW_S)
    aug = item.get("augment") or {}
    if aug.get("room"):
        piano = room(piano, rng)
    if aug.get("detune_cents"):
        piano, factor = detune(piano, float(aug["detune_cents"]))
        piano = fit(piano, int(WINDOW_S * RATE))
        keyoff = [(a * factor, b * factor, p, v) for a, b, p, v in keyoff]
        pedoff = [(a * factor, b * factor, p, v) for a, b, p, v in pedoff]
        pedal = [(a * factor, b * factor) for a, b in pedal]
    piano = normalize(piano)
    if aug.get("phone"):
        piano = phone(piano)
    write(out / "piano.wav", piano)
    write(out / "mixture.wav", piano)
    write_refs(out, keyoff, pedoff, pedal)


def build_slakh(item: dict[str, Any], out: Path) -> None:
    track = SLAKH / item["source"]["track"]
    t0, t1 = item["window"]
    stems = slakh_stems(track)
    frames = int(WINDOW_S * RATE)
    piano = np.zeros((frames, 2), dtype=np.float32)
    notes: list[Note] = []
    pedal: list[tuple[float, float]] = []
    for k, s in stems.items():
        if not is_piano(s):
            continue
        piano += fit(read_stereo(track / "stems" / f"{k}.flac", t0, WINDOW_S), frames)
        midi = pretty_midi.PrettyMIDI(str(track / "MIDI" / f"{k}.mid"))
        notes += midi_notes(midi)
        pedal += midi_pedal(midi)
    mixture = fit(read_stereo(track / "mix.flac", t0, WINDOW_S), frames)
    scale = np.float32(min(1.0, 0.9 / float(np.max(np.abs(mixture)))))
    write(out / "piano.wav", piano * scale)
    write(out / "mixture.wav", mixture * scale)
    keyoff = window_notes(sorted(notes), t0, t1)
    pedoff = window_notes(pedal_extend(sorted(notes), sorted(pedal)), t0, t1)
    write_refs(out, keyoff, pedoff, window_pedal(sorted(pedal), t0, t1))


def cmd_build(args: argparse.Namespace) -> int:
    builders = {"maps": build_real, "smd": build_real, "pop909": build_pop909, "slakh": build_slakh}
    for item in load_items([t for t in args.tier if t != "legacy"]):
        out = Path(item["dir"])
        if (out / "ref.keyoff.csv").is_file() and not args.force:
            continue
        out.mkdir(parents=True, exist_ok=True)
        builders[item["source"]["kind"]](item, out)
        n = len((out / "ref.keyoff.csv").read_text(encoding="utf-8").splitlines())
        print(f"{item['id']} {' '.join(item['tags'])}: {n} notes", flush=True)
    return 0


# --- chains, separation and predictions -----------------------------------------------------------

# A chain is one way of producing notes.piano: the separator, the notes config overrides and how
# `chosen` picks its input. Phases 2-6 add chains; `baseline` is production on 2026-10-24.
CHAINS: dict[str, dict[str, Any]] = {
    "baseline": {"separator": "bs_roformer_sw", "notes": {}},
    "yourmt3": {"separator": "bs_roformer_sw", "notes": {"transcriber": "yourmt3"}},
    # Step 24's shipped chain: config/notes.personal.yaml and separation.personal.yaml as they are.
    "final": {
        "separator": "bs_roformer_sw",
        "notes": None,
        "solo_check": {"model": "htdemucs_6s", "threshold_db": -15.0},
    },
}


def stem_dir(item: dict[str, Any], separator: str) -> Path:
    base = Path(item["dir"])
    return (
        base / "sep"
        if item["tier"] == "legacy" and separator == "bs_roformer_sw"
        else base / f"sep-{separator}"
    )


def has_band(item: dict[str, Any]) -> bool:
    return "band" in item["tags"]


# Composite separators (Phase 4): an average of two models' stems, and vocals removed by the
# vocal model before BS-Roformer-SW runs on the remainder.
COMPOSITES = {
    "ens_sw_6s": ("bs_roformer_sw", "htdemucs_6s"),
    "vocals_then_sw": ("mel_roformer_kim_vocals", "bs_roformer_sw"),
}
SEPARATORS = ("bs_roformer_sw", "htdemucs_6s", *COMPOSITES)


def separate_one(name: str, mixture: Path, out: Path) -> float:
    """Runs one configured model (or a composite) into `out`; returns its GPU seconds."""
    from stage_separation import config, models  # torch + audio-separator: only here

    cfg = config.load()
    if name not in COMPOSITES:
        result = models.separate(name, cfg.models[name], mixture, out)
        return result.seconds
    first, second = COMPOSITES[name]
    if name == "ens_sw_6s":
        seconds = 0.0
        folders = [
            out.parent
            / ("sep" if m == "bs_roformer_sw" and (out.parent / "sep").is_dir() else f"sep-{m}")
            for m in (first, second)
        ]
        for model, folder in zip((first, second), folders, strict=True):
            if not (folder / "timing.json").is_file():
                write_json(
                    folder / "timing.json",
                    {"seconds": separate_one(model, mixture, folder), "audio_s": WINDOW_S},
                )
            seconds += float(json.loads((folder / "timing.json").read_text())["seconds"])
        a, b = folders
        out.mkdir(parents=True, exist_ok=True)
        for stem in ("piano", "guitar", "bass", "drums", "vocals", "other"):
            if (a / f"{stem}.wav").is_file() and (b / f"{stem}.wav").is_file():
                x, y = read_stereo(a / f"{stem}.wav"), read_stereo(b / f"{stem}.wav")
                n = min(len(x), len(y))
                write(out / f"{stem}.wav", (x[:n] + y[:n]) * np.float32(0.5))
        return seconds
    vocal = models.separate(first, cfg.models[first], mixture, out / "stage1")
    rest = models.separate(second, cfg.models[second], vocal.files["other"], out)
    if "vocals" in vocal.files:
        write(out / "vocals.wav", read_stereo(vocal.files["vocals"]))
    return vocal.seconds + rest.seconds


def cmd_separate(args: argparse.Namespace) -> int:
    for item in load_items(args.tier):
        out = stem_dir(item, args.separator)
        if (out / "piano.wav").is_file():
            continue
        seconds = separate_one(args.separator, Path(item["dir"]) / "mixture.wav", out)
        write_json(out / "timing.json", {"seconds": seconds, "audio_s": WINDOW_S})
        print(f"{args.separator} {item['id']}: {seconds:.1f}s", flush=True)
    return 0


def notes_config(chain: dict[str, Any], path: Path) -> None:
    base = cast(
        dict[str, Any], yaml.safe_load((ML_ROOT / "config" / "notes.personal.yaml").read_text())
    )
    if chain["notes"] is not None:
        base["instruments"]["piano"] = {"transcriber": "transkun", **chain["notes"]}
    path.write_text(yaml.safe_dump(base), encoding="utf-8")


def run_path(chain: str, condition: str, item: dict[str, Any]) -> Path:
    return ROOT / "runs" / chain / condition / f"{item['id']}.json"


def chosen_source(chain: dict[str, Any], item: dict[str, Any]) -> str:
    """What `chosen` feeds notes.piano: always the separation, which (with a bypass threshold)
    may tell the stage to use the mixture."""
    return "stem"


def bypass_decision(chain: dict[str, Any], item: dict[str, Any]) -> dict[str, Any] | None:
    """The `separate` stage's solo check (`solo_bypass`) on the item's stored stems of the check
    model."""
    check = chain.get("solo_check")
    if check is None:
        return None
    from stage_separation import config
    from stage_separation.separate import solo_bypass

    spec = config.load().models[check["model"]]
    folder = stem_dir(item, check["model"])
    files = {
        name: folder / f"{name}.wav" for name in spec.outputs if (folder / f"{name}.wav").is_file()
    }
    mixture = read_stereo(Path(item["dir"]) / "mixture.wav")
    energy = float(np.sum(np.square(mixture, dtype=np.float64)))
    return solo_bypass(spec, files, "piano", len(mixture), energy, float(check["threshold_db"]))


def separation_seconds(chain: dict[str, Any], item: dict[str, Any], chosen: bool) -> float:
    """GPU seconds the chain's separate stage spends on the item: the solo check, then the chain's
    separator unless the check fired."""

    def timed(separator: str) -> float:
        path = stem_dir(item, separator) / "timing.json"
        return (
            float(json.loads(path.read_text(encoding="utf-8"))["seconds"])
            if path.is_file()
            else 0.0
        )

    decision = bypass_decision(chain, item) if chosen else None
    check = timed(chain["solo_check"]["model"]) if decision is not None else 0.0
    return check + (
        0.0 if decision is not None and decision["applied"] else timed(chain["separator"])
    )


def cmd_predict(args: argparse.Namespace) -> int:
    chain = CHAINS[args.chain]
    with tempfile.TemporaryDirectory() as tmp:
        config = Path(tmp) / "notes.yaml"
        notes_config(chain, config)
        os.environ["ML_NOTES_CONFIG"] = str(config)
        local = LocalRun(Path(tmp) / "work")
        for item in load_items(args.tier):
            base = Path(item["dir"])
            if not (base / "beats.json").is_file():
                decoded = local.decode(base / "mixture.wav")
                local.keep(local.run("beats", {}, decoded), "beats", base / "beats.json")
            for condition in args.condition:
                dest = run_path(args.chain, condition, item)
                if dest.is_file():
                    continue
                source = chosen_source(chain, item) if condition == "chosen" else condition
                if source == "clean" and item["tier"] == "legacy":
                    audio = base / "piano.wav"
                else:
                    audio = base / ("piano.wav" if source == "clean" else "mixture.wav")
                decoded = local.decode(audio)
                inputs: dict[str, str] = {}
                if source == "stem":
                    sep_dir = stem_dir(item, chain["separator"])
                    if not (sep_dir / "piano.wav").is_file():
                        continue
                    stems = {
                        i: sep_dir / f"{i}.wav"
                        for i in ("piano", "guitar", "bass", "drums")
                        if (sep_dir / f"{i}.wav").is_file()
                    }
                    decision = bypass_decision(chain, item) if condition == "chosen" else None
                    inputs["separation"] = str(
                        local.separation(
                            decoded,
                            stems,
                            "piano",
                            chain["separator"],
                            Path(tmp) / "separation.json",
                            {"solo_bypass": decision} if decision else None,
                        )
                    )
                started = time.monotonic()
                out = local.run("notes.piano", inputs, decoded)
                seconds = time.monotonic() - started
                local.keep(out, "notes", dest)
                write_json(
                    dest.with_suffix(".timing.json"),
                    {"seconds": seconds, "audio_s": decoded.duration_s},
                )
                print(f"{args.chain} {condition} {item['id']}: {seconds:.1f}s", flush=True)
    return 0


def cmd_tags(args: argparse.Namespace) -> int:
    """The shipped `tag` stage (PANNs) on every mixture → <item>/tags.json, timed."""
    with tempfile.TemporaryDirectory() as tmp:
        local = LocalRun(Path(tmp) / "work")
        for item in load_items(args.tier):
            dest = Path(item["dir"]) / "tags.json"
            if dest.is_file():
                continue
            decoded = local.decode(Path(item["dir"]) / "mixture.wav")
            started = time.monotonic()
            local.keep(local.run("tag", {}, decoded), "tags", dest)
            seconds = time.monotonic() - started
            write_json(
                dest.with_suffix(".timing.json"),
                {"seconds": seconds, "audio_s": decoded.duration_s},
            )
            print(f"tags {item['id']}: {seconds:.1f}s", flush=True)
    return 0


# --- hands ----------------------------------------------------------------------------------------


def music_core(command: str, payload: dict[str, Any]) -> dict[str, Any]:
    proc = subprocess.run(
        ["node", "src/cli.ts", command],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=REPO / "packages" / "music-core",
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"music-core {command}: {proc.stderr[:2000]}")
    return cast(dict[str, Any], json.loads(proc.stdout))


def artefact(kind: str, duration: float, body: dict[str, Any]) -> dict[str, Any]:
    from splitune_ml_core import contracts

    return {
        "schema_version": contracts.SCHEMA_VERSION,
        "artefact_version": 1,
        "analysis_id": "00000000-0000-0000-0000-000000000000",
        "user_id": "eval",
        "audio_hash": "0" * 64,
        "sample_rate": RATE,
        "models": [],
        "params": {},
        "created_at": "2026-10-25T00:00:00Z",
        "artefact": kind,
        "duration_s": duration,
        **body,
    }


def beats_artefact(times: list[float], downbeat: list[bool], duration: float) -> dict[str, Any]:
    """A beats artefact from beat times and downbeat flags; beats before the first downbeat are a
    pickup (bar -1, counted back from the bar's last beat), as the beats stage writes them."""
    first = downbeat.index(True) if True in downbeat else 0
    numerator = next((j - first for j in range(first + 1, len(downbeat)) if downbeat[j]), 4)
    beats: list[dict[str, Any]] = []
    bar, k = -1, numerator - first
    for i, (t, d) in enumerate(zip(times, downbeat, strict=True)):
        if i >= first and (d or i == first):
            bar, k = bar + 1, 0
        k += 1
        beats.append(
            {
                "id": f"b{i:04d}",
                "t": round(t, 4),
                "activation": 1.0,
                "is_downbeat": i >= first and k == 1,
                "bar_index": bar,
                "beat_in_bar": k,
            }
        )
    body = {
        "bpm": round(60.0 / float(np.median(np.diff(times))), 3) if len(times) > 1 else 120.0,
        "meter": {"numerator": numerator, "denominator": 4},
        "tempo_octave_ambiguous": False,
        "first_downbeat_t": round(times[first], 4),
        "beats": beats,
    }
    return artefact("beats", duration, body)


def piano_score(
    notes: list[tuple[float, float, int, float]], beats: dict[str, Any], duration: float
) -> list[dict[str, Any]]:
    body = {
        "instrument": "piano",
        "notes": [
            {
                "id": f"n{i:06d}",
                "onset_s": round(a, 4),
                "offset_s": round(b, 4),
                "pitch_midi": p,
                "confidence": round(c, 4),
                "stem_id": "piano",
            }
            for i, (a, b, p, c) in enumerate(notes)
        ],
    }
    result = music_core(
        "build-piano", {"notes": artefact("notes.piano", duration, body), "beats": beats}
    )
    return cast(list[dict[str, Any]], result["notes"])


def asap_annotations(path: Path) -> tuple[list[float], list[bool]]:
    times: list[float] = []
    down: list[bool] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) >= 3:
            times.append(float(parts[0]))
            down.append(parts[2].split(",")[0] == "db")
    return times, down


PM2S = DATA / "_models" / "pm2s" / "src"  # a checkout of github.com/cheriell/PM2S (its split)


def pm2s_valid_pieces() -> set[str]:
    """ASAP folders PM2S never trained on: every performance in its validation split."""
    rows = list(csv.DictReader((PM2S / "dev" / "metadata" / "metadata.csv").open(encoding="utf-8")))
    folders: dict[str, set[str]] = {}
    for r in rows:
        if r["source"] == "ASAP":
            folder = str(Path(r["performance_MIDI_external"].removeprefix("{ASAP}/")).parent)
            folders.setdefault(folder.replace("\\", "/"), set()).add(r["split"])
    return {f for f, splits in folders.items() if splits == {"valid"}}


def cmd_hands(_: argparse.Namespace) -> int:
    """Hands on ASAP score MIDI (track 0 = treble staff = right hand, track 1 = bass staff):
    splitHands through buildPianoScore and the shipped PM2S hands (stage_notes.pm2s_hands),
    per-note agreement per piece.
    PM2S trained on ASAP's other pieces; `pm2s_valid` marks the ones it never saw."""
    from stage_notes import pm2s_hands

    valid = pm2s_valid_pieces()
    rows: list[dict[str, Any]] = []
    for score in sorted(ASAP.rglob("midi_score.mid")):
        midi = pretty_midi.PrettyMIDI(str(score))
        if len(midi.instruments) != 2:
            continue
        labelled = sorted(
            (float(n.start), float(n.end), int(n.pitch), staff, int(n.velocity))
            for staff, inst in enumerate(midi.instruments)
            for n in inst.notes
            if 21 <= n.pitch <= 108
        )
        times, down = asap_annotations(score.with_name("midi_score_annotations.txt"))
        duration = float(midi.get_end_time()) + 1.0
        built = piano_score(
            [(a, b, p, 0.9) for a, b, p, _, _ in labelled],
            beats_artefact(times, down, duration),
            duration,
        )
        hand = {n["note_id"]: n["hand"] for n in built}
        right = [staff == 0 for *_, staff, _ in labelled]
        split_ok = sum(
            hand.get(f"n{i:06d}") == ("right" if r else "left") for i, r in enumerate(right)
        )
        predicted = pm2s_hands.hands(
            [a for a, *_ in labelled],
            [b for _, b, *_ in labelled],
            [p for _, _, p, _, _ in labelled],
            [v for *_, v in labelled],
        )
        piece = score.parent.relative_to(ASAP).as_posix()
        rows.append(
            {
                "piece": piece,
                "notes": len(labelled),
                "correct": split_ok,
                # PM2S part 0 is the right hand (checked against the staves).
                "pm2s_correct": sum(
                    (h == "right") == r for h, r in zip(predicted, right, strict=True)
                ),
                "pm2s_valid": piece in valid,
            }
        )
        print(
            f"hands {piece}: {split_ok / len(labelled):.3f} "
            f"pm2s {rows[-1]['pm2s_correct'] / len(labelled):.3f}",
            flush=True,
        )
    write_json(ROOT / "hands.json", rows)
    return 0


# --- scoring -------------------------------------------------------------------------------------


def ref_notes(
    item: dict[str, Any], convention: str
) -> tuple[formats.NoteEvents, NDArray[np.float64]]:
    if item["tier"] == "legacy":
        path = Path(item["legacy_ref"])
    else:
        path = Path(item["dir"]) / f"ref.{convention}.csv"
    rows = [r for r in csv.reader(path.read_text(encoding="utf-8").splitlines()) if r]
    data = np.array([[float(x) for x in r[:3]] for r in rows]).reshape(-1, 3)
    vel = np.array([float(r[3]) if len(r) > 3 else np.nan for r in rows])
    order = np.lexsort((data[:, 2], data[:, 1], data[:, 0])) if len(data) else np.zeros(0, int)
    return formats.NoteEvents(data[order, :2], data[order, 2]), vel[order]


def est_notes(path: Path) -> tuple[formats.NoteEvents, NDArray[np.float64], list[Any]]:
    from splitune_ml_core import contracts

    notes = sorted(
        contracts.Notes.model_validate_json(path.read_text(encoding="utf-8")).notes,
        key=lambda n: (n.onset_s, n.offset_s, n.pitch_midi),
    )
    intervals = np.array([[n.onset_s, n.offset_s] for n in notes]).reshape(-1, 2)
    pitches = np.array([float(n.pitch_midi) for n in notes])
    vel = np.array([float(n.velocity or 0) for n in notes])
    return formats.NoteEvents(intervals, pitches), vel, notes


def hz(midi: NDArray[np.float64]) -> NDArray[np.float64]:
    return 440.0 * 2.0 ** ((midi - 69.0) / 12.0)


def fold(notes: formats.NoteEvents) -> formats.NoteEvents:
    return formats.NoteEvents(notes.intervals, notes.pitches_midi % 12 + 60)


def offset_f1(ref: formats.NoteEvents, est: formats.NoteEvents) -> float:
    return float(scoring.notes(ref, est)[0]["onset_offset_f1"])


def velocity_f1(
    ref: formats.NoteEvents,
    ref_vel: NDArray[np.float64],
    est: formats.NoteEvents,
    est_vel: NDArray[np.float64],
) -> float:
    if not len(ref.intervals) or not len(est.intervals) or np.isnan(ref_vel).any():
        return float("nan")
    _, _, f, _ = mir_eval.transcription_velocity.precision_recall_f1_overlap(
        ref.intervals,
        hz(ref.pitches_midi),
        ref_vel,
        est.intervals,
        hz(est.pitches_midi),
        est_vel,
        onset_tolerance=0.05,
        pitch_tolerance=50.0,
        offset_ratio=0.2,
        offset_min_tolerance=0.05,
    )
    return float(f)


def matched(ref: formats.NoteEvents, est: formats.NoteEvents) -> set[int]:
    if not len(ref.intervals) or not len(est.intervals):
        return set()
    pairs = mir_eval.transcription.match_notes(
        ref.intervals,
        hz(ref.pitches_midi),
        est.intervals,
        hz(est.pitches_midi),
        onset_tolerance=0.05,
        pitch_tolerance=50.0,
        offset_ratio=None,  # pyright: ignore[reportArgumentType] (None = onset only)
    )
    return {int(j) for _, j in pairs}


def stem_sdr(item: dict[str, Any], separator: str) -> float:
    stem = stem_dir(item, separator) / "piano.wav"
    clean = Path(item["dir"]) / "piano.wav"
    if not stem.is_file() or not has_band(item):
        return float("nan")
    ref = read_stereo(clean).astype(np.float64)
    est = read_stereo(stem).astype(np.float64)
    return scoring.usdr(ref, est)


def residual_share(item: dict[str, Any], notes: list[Any]) -> float:
    """Share of notes buildPianoScore flags as far from the beat grid (> 60 ms, 07 §2)."""
    path = Path(item["dir"]) / "beats.json"
    if not notes or not path.is_file():
        return float("nan")
    beats = cast(dict[str, Any], json.loads(path.read_text(encoding="utf-8")))
    built = piano_score(
        [(n.onset_s, n.offset_s, n.pitch_midi, float(n.confidence or 0.0)) for n in notes],
        beats,
        float(beats["duration_s"]),
    )
    return statistics.fmean(1.0 if n["residual_flagged"] else 0.0 for n in built)


def scores(
    chain_name: str, items: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], list[tuple[float, int, str]]]:
    """Per (item, condition) metrics, plus (calibrated confidence, correct, split) per stem note."""
    chain = CHAINS[chain_name]
    rows: list[dict[str, Any]] = []
    confidence: list[tuple[float, int, str]] = []
    for item in items:
        keyoff, kvel = ref_notes(item, "keyoff")
        pedoff, _ = ref_notes(item, "pedoff") if item["tier"] != "legacy" else (keyoff, kvel)
        sdr = stem_sdr(item, chain["separator"])
        for condition in CONDITIONS:
            path = run_path(chain_name, condition, item)
            if not path.is_file():
                continue
            est, evel, notes = est_notes(path)
            m, _ = scoring.notes(keyoff, est)
            hit = matched(keyoff, est)
            timing = json.loads(path.with_suffix(".timing.json").read_text(encoding="utf-8"))
            source = chosen_source(chain, item) if condition == "chosen" else condition
            sep_seconds = (
                separation_seconds(chain, item, condition == "chosen") if source == "stem" else 0.0
            )
            rows.append(
                {
                    "chain": chain_name,
                    "tier": item["tier"],
                    "split": item["split"],
                    "item": item["id"],
                    "tags": " ".join(item["tags"]),
                    "condition": condition,
                    "ref_notes": len(keyoff.intervals),
                    "est_notes": len(est.intervals),
                    "onset_f1": m["onset_f1"],
                    "onset_precision": m["onset_precision"],
                    "onset_recall": m["onset_recall"],
                    "onoff_keyoff_f1": m["onset_offset_f1"],
                    "onoff_pedoff_f1": offset_f1(pedoff, est),
                    "onoff_vel_f1": velocity_f1(keyoff, kvel, est, evel),
                    "pitch_class_f1": scoring.notes(fold(keyoff), fold(est))[0]["onset_f1"],
                    "stem_usdr": sdr if source == "stem" else float("nan"),
                    "seconds_per_30s": (float(timing["seconds"]) + sep_seconds)
                    * 30.0
                    / float(timing["audio_s"]),
                }
            )
            rows[-1]["residual_flag_share"] = float("nan")
            if condition == "chosen":
                rows[-1]["residual_flag_share"] = residual_share(item, notes)
                confidence += [
                    (float(n.confidence or 0.0), int(j in hit), item["split"])
                    for j, n in enumerate(notes)
                ]
    return rows, confidence


# --- Transkun detail runs, clean-up sweep and confidence ---------------------------------------

DETAIL = ROOT / "detail"
INPUTS = ("clean", "stem", "mixture")
SWEEP_GRID: dict[str, tuple[Any, ...]] = {
    "min_velocity": (0, 15, 25, 35),
    "min_duration_s": (0.0, 0.03, 0.06, 0.1),
    "gate_db": (None, 25.0, 35.0, 45.0),
}
FLOORS = {
    "onset": (0.5, 0.8, 0.9),
    "interval": (0.1, 0.2, 0.3),
    "velocity": (0.1, 0.15),
    "onset_velocity": (0.4, 0.5, 0.55),
}


def input_audio(item: dict[str, Any], condition: str, separator: str = "bs_roformer_sw") -> Path:
    base = Path(item["dir"])
    if condition == "stem":
        return stem_dir(item, separator) / "piano.wav"
    return base / ("piano.wav" if condition == "clean" else "mixture.wav")


def load_transkun(weights: str | None) -> Any:
    """The shipped Transkun wrapper, optionally with another checkpoint (eval only)."""
    from stage_notes.transkun import Transkun

    model = Transkun()
    if weights:
        import torch
        from splitune_ml_core.device import torch_device
        from transkun import ModelTransformer  # pyright: ignore[reportMissingTypeStubs]

        folder = Path(weights)
        conf = ModelTransformer.Config()
        conf.__dict__.update(json.loads((folder / "model.conf").read_text())["Model"]["config"])
        net = ModelTransformer.TransKun(conf=conf)
        checkpoint = torch.load(str(folder / "checkpoint.pt"), map_location="cpu")
        net.load_state_dict(checkpoint.get("best_state_dict", checkpoint.get("state_dict")))
        model._model = net.to(torch_device()).eval()  # pyright: ignore[reportPrivateUsage]
    return model


def cmd_detail(args: argparse.Namespace) -> int:
    """Shipped Transkun.transcribe_detailed per item and input: every note with its three scores
    and the sustain pedal, so clean-up params and confidence can be studied offline."""
    from stage_notes.transkun import TRANSKUN_DEFAULTS

    model = load_transkun(args.weights)
    params = {**TRANSKUN_DEFAULTS, "segment_s": args.segment, "hop_s": args.hop}
    for item in load_items(args.tier):
        for condition in args.condition:
            dest = DETAIL / args.name / condition / f"{item['id']}.json"
            source = input_audio(item, condition, args.separator)
            if dest.is_file() or not source.is_file():
                continue
            audio = read_stereo(source)
            started = time.monotonic()
            detailed = model.transcribe_detailed(
                audio if args.stereo else audio.mean(axis=1), params
            )
            seconds = time.monotonic() - started
            write_json(
                dest,
                {
                    "notes": [
                        [
                            n.onset_s,
                            n.offset_s,
                            n.pitch_midi,
                            n.velocity,
                            n.onset,
                            n.interval,
                            n.velocity_peak,
                        ]
                        for n in detailed.notes
                    ],
                    "pedal": detailed.pedal,
                    "seconds": seconds,
                    "audio_s": len(audio) / RATE,
                },
            )
            print(
                f"{args.name} {condition} {item['id']}: {len(detailed.notes)} notes {seconds:.1f}s",
                flush=True,
            )
    return 0


ARIA_PYTHON = Path("D:/venvs/aria/Scripts/python.exe")
ARIA_CHECKPOINT = DATA / "_models" / "aria" / "piano-medium-double-1.0.safetensors"


def cmd_aria(args: argparse.Namespace) -> int:
    """Aria-AMT (eval/aria_amt.py in its own venv) on every input, then its MIDI as a detail run
    (`DETAIL/aria/...`): notes with velocity, scores 1.0 (it reports none), sustain from CC64."""
    jobs: list[tuple[str, str]] = []
    targets: list[tuple[Path, Path]] = []
    for item in load_items(args.tier):
        for condition in args.condition:
            source = input_audio(item, condition)
            dest = DETAIL / "aria" / condition / f"{item['id']}.json"
            midi = ROOT / "aria-midi" / condition / f"{item['id']}.mid"
            if dest.is_file() or not source.is_file():
                continue
            jobs.append((str(source), str(midi)))
            targets.append((midi, dest))
    job_file = ROOT / "aria-jobs.json"
    write_json(job_file, jobs)
    env = {**os.environ, "TQDM_DISABLE": "1"}
    subprocess.run(
        [str(ARIA_PYTHON), "-I", str(EVAL / "aria_amt.py"), str(ARIA_CHECKPOINT), str(job_file)],
        check=True,
        env=env,
    )
    for midi, dest in targets:
        timing = json.loads(midi.with_suffix(".json").read_text(encoding="utf-8"))
        notes: list[list[float]] = []
        pedal: list[tuple[float, float]] = []
        if midi.is_file():
            data = pretty_midi.PrettyMIDI(str(midi))
            notes = [
                [a, b, p, v, 1.0, 1.0, 1.0] for a, b, p, v in midi_notes(data) if 21 <= p <= 108
            ]
            pedal = midi_pedal(data)
        write_json(
            dest,
            {"notes": notes, "pedal": pedal, "seconds": timing["seconds"], "audio_s": WINDOW_S},
        )
    return 0


KONG_CHECKPOINT = DATA / "_models" / "kong" / "high_resolution_MAESTRO_augmentations.pth"


def kong_model() -> Any:
    """Kong et al.'s note model with Edwards et al.'s augmentation-trained weights (Zenodo
    10610212, CC-BY-4.0; note only, no pedal head), in piano_transcription_inference's own
    transcriber. Built directly: its constructor re-downloads checkpoints under 160 MB and loads
    weights non-strictly."""
    import torch
    from piano_transcription_inference import (  # pyright: ignore[reportMissingTypeStubs]
        PianoTranscription,
        config,
    )
    from piano_transcription_inference.models import (  # pyright: ignore[reportMissingTypeStubs]
        Regress_onset_offset_frame_velocity_CRNN,
    )

    model = PianoTranscription.__new__(PianoTranscription)
    model.segment_samples = 16000 * 10
    model.frames_per_second = config.frames_per_second
    model.classes_num = config.classes_num
    model.onset_threshold, model.offset_threshod, model.frame_threshold = 0.3, 0.3, 0.1
    model.pedal_offset_threshold = 0.2
    net = Regress_onset_offset_frame_velocity_CRNN(
        frames_per_second=config.frames_per_second, classes_num=config.classes_num
    )
    checkpoint = torch.load(str(KONG_CHECKPOINT), map_location="cpu", weights_only=False)
    net.load_state_dict(checkpoint["model"], strict=True)
    model.model = net.cuda().eval()
    return model


def cmd_kong(args: argparse.Namespace) -> int:
    """The robust Kong model on every input → detail run `kong` (scores 1.0: it reports none)."""
    model = kong_model()
    for item in load_items(args.tier):
        for condition in args.condition:
            source = input_audio(item, condition)
            dest = DETAIL / "kong" / condition / f"{item['id']}.json"
            if dest.is_file() or not source.is_file():
                continue
            mono = read_stereo(source).mean(axis=1)
            audio = np.asarray(resample_poly(mono, 16000, RATE), dtype=np.float32)
            started = time.monotonic()
            out = model.transcribe(audio, None)
            seconds = time.monotonic() - started
            notes = [
                [
                    float(e["onset_time"]),
                    float(e["offset_time"]),
                    int(e["midi_note"]),
                    int(e["velocity"]),
                    1.0,
                    1.0,
                    1.0,
                ]
                for e in out["est_note_events"]
                if 21 <= int(e["midi_note"]) <= 108
            ]
            write_json(dest, {"notes": notes, "pedal": [], "seconds": seconds, "audio_s": WINDOW_S})
            print(f"kong {condition} {item['id']}: {len(notes)} notes {seconds:.1f}s", flush=True)
    return 0


def load_detail(name: str, condition: str, item: dict[str, Any]) -> list[Any] | None:
    from stage_notes.transkun import TranskunNote

    path = DETAIL / name / condition / f"{item['id']}.json"
    if not path.is_file():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    return [TranskunNote(a, b, int(p), int(v), o, i, w) for a, b, p, v, o, i, w in data["notes"]]


def events(notes: list[Any]) -> formats.NoteEvents:
    rows = sorted((n.onset_s, n.offset_s, float(n.pitch_midi)) for n in notes)
    return formats.NoteEvents(
        np.array([[a, b] for a, b, _ in rows]).reshape(-1, 2), np.array([p for *_, p in rows])
    )


def detail_scores(
    name: str, condition: str, items: list[dict[str, Any]], params: dict[str, Any] | None = None
) -> list[dict[str, Any]]:
    """Onset and onset+offset F1 per item for a detail run, after clean_up with `params`."""
    from stage_notes.transkun import TRANSKUN_DEFAULTS, clean_up

    rows: list[dict[str, Any]] = []
    for item in items:
        notes = load_detail(name, condition, item)
        if notes is None:
            continue
        if params:
            mono = (
                read_stereo(input_audio(item, condition)).mean(axis=1)
                if params.get("gate_db")
                else np.zeros(1, np.float32)
            )
            notes = clean_up(notes, mono, {**TRANSKUN_DEFAULTS, **params})
        keyoff, _ = ref_notes(item, "keyoff")
        pedoff = ref_notes(item, "pedoff")[0] if item["tier"] != "legacy" else keyoff
        est = events(notes)
        m, _ = scoring.notes(keyoff, est)
        rows.append(
            {
                "item": item["id"],
                "tier": item["tier"],
                "split": item["split"],
                "tags": " ".join(item["tags"]),
                "onset_f1": m["onset_f1"],
                "onset_precision": m["onset_precision"],
                "onset_recall": m["onset_recall"],
                "onoff_keyoff_f1": m["onset_offset_f1"],
                "onoff_pedoff_f1": offset_f1(pedoff, est),
            }
        )
    return rows


def tier_means(rows: list[dict[str, Any]], key: str = "onset_f1") -> str:
    return " | ".join(cell(mean([r for r in rows if r["tier"] == t], key)) for t in TIERS)


def cmd_compare(args: argparse.Namespace) -> int:
    """Detail runs side by side (raw, no clean-up): onset F1 per tier for one input."""
    items = load_items(args.tier)
    out = [
        f"| run ({args.condition}) | "
        + " | ".join(TIERS)
        + " | all | on+off key | on+off pedal | s / 30 s |",
        "|---|" + "---|" * (len(TIERS) + 4),
    ]
    for name in args.name:
        rows = detail_scores(name, args.condition, items)
        folder = DETAIL / name / args.condition
        timings = [
            json.loads((folder / f"{i['id']}.json").read_text(encoding="utf-8"))
            for i in items
            if (folder / f"{i['id']}.json").is_file()
        ]
        per30 = (
            statistics.fmean(t["seconds"] * 30 / t["audio_s"] for t in timings)
            if timings
            else float("nan")
        )
        out.append(
            f"| {name} | {tier_means(rows)} | {cell(mean(rows, 'onset_f1'))} | "
            f"{cell(mean(rows, 'onoff_keyoff_f1'))} | {cell(mean(rows, 'onoff_pedoff_f1'))} | "
            f"{cell(per30)} |"
        )
    text = "\n".join(out)
    print(text)
    if args.out:
        Path(args.out).write_text(text + "\n", encoding="utf-8")
    return 0


def fit_mean(rows: list[dict[str, Any]]) -> float:
    return mean([r for r in rows if r["split"] == "fit"], "onset_f1")


def cmd_sweep(args: argparse.Namespace) -> int:
    """Clean-up params on one detail run's stem notes: chosen on the fit split by mean onset F1
    over all tiers, reported on the held-out split (per tier)."""
    import itertools

    items = load_items(args.tier)
    combos: list[dict[str, Any]] = [
        dict(zip(SWEEP_GRID, v, strict=True)) for v in itertools.product(*SWEEP_GRID.values())
    ]
    combos += [{"confidence": k, "min_confidence": f} for k, fs in FLOORS.items() for f in fs]
    results: list[tuple[dict[str, Any], list[dict[str, Any]]]] = []
    for combo in [{}, *combos]:
        results.append((combo, detail_scores(args.name, "stem", items, combo)))
        print(f"sweep {combo}", flush=True)
    ranked = sorted(results, key=lambda r: -fit_mean(r[1]))
    out = [
        f"## Clean-up sweep on `{args.name}` stems (fit → held-out onset F1)",
        "",
        "| params | fit | held-out | held-out P | held-out R | "
        + " | ".join(f"held-out {t}" for t in TIERS)
        + " |",
        "|---|---|---|---|---|" + "---|" * len(TIERS),
    ]
    for combo, rows in [results[0], *ranked[:8]]:
        test = [r for r in rows if r["split"] == "test"]
        label = ", ".join(f"{k}={v}" for k, v in combo.items()) or "none (raw)"
        out.append(
            f"| {label} | {cell(fit_mean(rows))} | {cell(mean(test, 'onset_f1'))} | "
            f"{cell(mean(test, 'onset_precision'))} | {cell(mean(test, 'onset_recall'))} | "
            f"{tier_means(test)} |"
        )
    text = "\n".join(out) + "\n"
    (ROOT / f"sweep-{args.name}.md").write_text(text, encoding="utf-8")
    print(text)
    return 0


def auroc(values: list[float], labels: list[int]) -> float:
    """Probability that a correct note scores above a wrong one (ties count half)."""
    x = np.asarray(values, dtype=np.float64)
    y = np.asarray(labels, dtype=bool)
    pos, neg = int(y.sum()), int((~y).sum())
    if not pos or not neg:
        return float("nan")
    order = np.argsort(x, kind="stable")
    ranks = np.empty(len(x))
    ranks[order] = np.arange(1, len(x) + 1)
    for v in np.unique(x):
        tie = x == v
        ranks[tie] = ranks[tie].mean()
    return float((ranks[y].sum() - pos * (pos + 1) / 2) / (pos * neg))


def cmd_confidence(args: argparse.Namespace) -> int:
    """How well each per-note score separates correct from wrong stem notes (AUROC on held-out
    notes), and what an isotonic fit on the fit split does to the bands."""
    from splitune_eval.calibration import fit_isotonic
    from splitune_ml_core import calibration as cal
    from splitune_ml_core import contracts as ct

    items = load_items(args.tier)
    data: dict[str, dict[str, tuple[list[float], list[int]]]] = {}
    for item in items:
        notes = load_detail(args.name, "stem", item)
        if notes is None:
            continue
        keyoff, _ = ref_notes(item, "keyoff")
        notes = sorted(notes, key=lambda n: (n.onset_s, n.offset_s, n.pitch_midi))
        hit = matched(keyoff, events(notes))
        other = run_path("yourmt3", "stem", item)
        agree = matched(est_notes(other)[0], events(notes)) if other.is_file() else None
        candidates: dict[str, list[float]] = {
            "onset": [n.onset for n in notes],
            "interval": [n.interval for n in notes],
            "velocity": [n.velocity_peak for n in notes],
            "onset*interval": [n.onset * n.interval for n in notes],
            "onset_velocity": [n.score("onset_velocity") for n in notes],
        }
        if agree is not None:
            candidates["yourmt3 agrees"] = [float(j in agree) for j in range(len(notes))]
            candidates["interval + agree"] = [
                0.5 * n.interval + 0.5 * (j in agree) for j, n in enumerate(notes)
            ]
        for kind, values in candidates.items():
            bucket = data.setdefault(kind, {"fit": ([], []), "test": ([], [])})[item["split"]]
            bucket[0].extend(values)
            bucket[1].extend(int(j in hit) for j in range(len(notes)))
    out = [
        f"## Per-note confidence candidates (`{args.name}` stems)",
        "",
        "| score | held-out notes | AUROC fit | AUROC held-out | ECE after isotonic | "
        "high: share / precision | medium | low |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for kind, split in data.items():
        (fx, fy), (tx, ty) = split["fit"], split["test"]
        table = ct.CalibrationTable(
            model_id="p2p",
            version="p2p",
            method="isotonic",
            knots=fit_isotonic(fx, fy),
            bands=ct.Bands(high=0.7, medium=0.4),
            fitted_on="p2p",
        )
        calibrated = [cal.calibrate(x, table) for x in tx]
        rel = reliability(calibrated, ty)
        bands: list[str] = []
        for lo, hi in ((0.7, 1.01), (0.4, 0.7), (-1.0, 0.4)):
            ys = [y for c, y in zip(calibrated, ty, strict=True) if lo <= c < hi]
            share = len(ys) / len(ty)
            bands.append(f"{share:.2f} / {cell(float(np.mean(ys)) if ys else float('nan'))}")
        out.append(
            f"| {kind} | {len(ty)} | {cell(auroc(fx, fy))} | {cell(auroc(tx, ty))} | "
            f"{rel.ece:.3f} | " + " | ".join(bands) + " |"
        )
    text = "\n".join(out) + "\n"
    (ROOT / f"confidence-{args.name}.md").write_text(text, encoding="utf-8")
    print(text)
    return 0


CALIBRATION_DIR = ML_ROOT / "config" / "calibration"
TRANSCRIBER_RECORDS = {"transkun": "transkun-v2", "yourmt3": "yourmt3-moe"}


def raw_labels(
    chain: str, condition: str, items: list[dict[str, Any]], split: str
) -> tuple[list[float], list[int]]:
    """(confidence_raw, correct onset) of every predicted note of one split."""
    xs: list[float] = []
    ys: list[int] = []
    for item in items:
        if item["split"] != split:
            continue
        path = run_path(chain, condition, item)
        if not path.is_file():
            continue
        est, _, notes = est_notes(path)
        hit = matched(ref_notes(item, "keyoff")[0], est)
        xs += [float(n.confidence_raw or 0.0) for n in notes]
        ys += [int(j in hit) for j in range(len(notes))]
    return xs, ys


def cmd_calibrate(args: argparse.Namespace) -> int:
    """Isotonic table for one transcriber's piano notes, fitted on the fit split of a chain's
    `condition` notes and checked on the held-out split
    → config/calibration/<record>@<version>.piano.json."""
    from splitune_eval.calibration import fit_isotonic
    from splitune_ml_core import calibration, contracts, register

    items = load_items(args.tier)
    fx, fy = raw_labels(args.chain, args.condition, items, "fit")
    tx, ty = raw_labels(args.chain, args.condition, items, "test")
    record = register.model(TRANSCRIBER_RECORDS[args.transcriber])
    table = contracts.CalibrationTable(
        model_id=record.id,
        version=record.version,
        method="isotonic",
        knots=fit_isotonic(fx, fy),
        bands=contracts.Bands(high=0.7, medium=0.4),
        fitted_on=f"p2p-{args.chain}-{args.condition}-fit",
    )
    path = CALIBRATION_DIR / f"{record.id}@{record.version}.piano.json"
    path.write_text(contracts.dump_json(table) + "\n", encoding="utf-8")
    raw = reliability(tx, ty)
    cal = reliability([calibration.calibrate(x, table) for x in tx], ty)
    text = (
        f"## {args.transcriber} / piano ({args.chain}, {args.condition})\n\n"
        f"fit on {len(fx)} notes, tested on {len(tx)} held-out notes (precision "
        f"{np.mean(ty):.3f}); table `{path.relative_to(ML_ROOT)}`, {len(table.knots)} knots\n\n"
        f"ECE raw **{raw.ece:.3f}** → calibrated **{cal.ece:.3f}** (10 equal-width bins)\n\n"
        + cal.table(raw)
    )
    (ROOT / f"calibration-{args.transcriber}.md").write_text(text, encoding="utf-8")
    print(text)
    return 0


# --- report --------------------------------------------------------------------------------------

COLUMNS = (
    ("onset_f1", "onset F1"),
    ("onset_precision", "P"),
    ("onset_recall", "R"),
    ("onoff_keyoff_f1", "on+off F1 (key)"),
    ("onoff_pedoff_f1", "on+off F1 (pedal)"),
    ("onoff_vel_f1", "on+off+vel F1"),
    ("pitch_class_f1", "pitch-class F1"),
    ("stem_usdr", "stem uSDR dB"),
    ("residual_flag_share", "off-grid share"),
    ("seconds_per_30s", "s / 30 s"),
)
TAGS = (
    "acoustic",
    "electric",
    "keys",
    "solo",
    "band",
    "sparse",
    "dense",
    "featured",
    "buried",
    "doubled",
    "heavy-pedal",
    "phone",
    "room",
    "off-a440",
    "slakh-native",
)


def mean(rows: list[dict[str, Any]], key: str) -> float:
    values = [float(r[key]) for r in rows if r[key] == r[key]]
    return statistics.fmean(values) if values else float("nan")


def cell(value: float) -> str:
    return "—" if value != value else f"{value:.3f}"


def table(
    rows: list[dict[str, Any]], label: str, groups: list[tuple[str, list[dict[str, Any]]]]
) -> list[str]:
    out = [
        f"| {label} | items | " + " | ".join(name for _, name in COLUMNS) + " |",
        "|---|---|" + "---|" * len(COLUMNS),
    ]
    for name, sel in groups:
        if sel:
            out.append(
                f"| {name} | {len(sel)} | "
                + " | ".join(cell(mean(sel, k)) for k, _ in COLUMNS)
                + " |"
            )
    return out


def cmd_report(args: argparse.Namespace) -> int:
    items = load_items(args.tier)
    rows: list[dict[str, Any]] = []
    confidences: dict[str, list[tuple[float, int, str]]] = {}
    for chain in args.chain:
        r, c = scores(chain, items)
        rows += r
        confidences[chain] = c
    RESULTS.mkdir(parents=True, exist_ok=True)
    date = datetime.now(UTC).strftime("%Y-%m-%d")
    stem = f"{date}-{args.name}" if args.name else date
    csv_path = RESULTS / f"{stem}.csv"
    keys = list(rows[0]) if rows else []
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(rows)
    from splitune_ml_core import register

    out = [
        f"# Prototype 2p — piano on pop material ({date}{', ' + args.name if args.name else ''})",
        "",
        f"git `{git_sha()}` · Transkun `{register.model('transkun-v2').version}` · separator per "
        "chain · mir_eval 0.8.2: onset ±50 ms / ±50 cents; offsets ±max(50 ms, 20 % of duration) "
        "against key-release (`key`) and sustain-pedal-extended (`pedal`) references; velocity "
        "per mir_eval transcription_velocity; pitch-class = octaves folded · stem uSDR = piano "
        "stem vs the clean piano (band items) · s / 30 s = wall time of separation (stem inputs) "
        "+ notes.piano on this PC (RTX 3060, CUDA), per 30 s of audio.",
        "",
        "Tiers are reported apart; `legacy` is P2's MAESTRO + MUSDB band and BabySlakh items "
        "(key-release references only). `clean` and `mixture` inputs reach notes.piano without a "
        "stem, so a chain with a mixture transcriber (`final`: YourMT3+) transcribes them with it; "
        "`chosen` is what an analysis does.",
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
        chosen = [r for r in sel if r["condition"] == "chosen" and r["tier"] != "legacy"]
        out += ["", f"## {chain}: chosen input by tag (all new tiers)", ""]
        out += table(
            chosen, "tag", [(t, [r for r in chosen if t in r["tags"].split()]) for t in TAGS]
        )
        conf = [(c, y) for c, y, s in confidences[chain] if s == "test"]
        if conf:
            rel = reliability([c for c, _ in conf], [y for _, y in conf])
            bands = [
                ("high ≥ 0.7", 0.7, 1.01),
                ("medium 0.4-0.7", 0.4, 0.7),
                ("low < 0.4", -1.0, 0.4),
            ]
            out += [
                "",
                f"## {chain}: calibration (chosen input, held-out notes)",
                "",
                f"ECE **{rel.ece:.3f}** over {len(conf)} notes "
                f"(precision {np.mean([y for _, y in conf]):.3f})",
                "",
                "| band | notes | share | precision |",
                "|---|---|---|---|",
            ]
            for name, lo, hi in bands:
                ys = [y for c, y in conf if lo <= c < hi]
                out.append(
                    f"| {name} | {len(ys)} | {len(ys) / len(conf):.3f} | "
                    f"{cell(float(np.mean(ys)) if ys else float('nan'))} |"
                )
            out += ["", rel.table()]
        out += ["", f"## {chain}: input choice", ""]
        solo = [i for i in items if "solo" in i["tags"]]
        if CHAINS[chain].get("solo_check") is None:
            out.append(
                f"No solo-piano bypass: every mixture is separated (bypass recall 0 of "
                f"{len(solo)} solo items)."
            )
        else:
            fired = {
                i["id"]
                for i in items
                if (d := bypass_decision(CHAINS[chain], i)) is not None and d["applied"]
            }
            hits = sum(1 for i in solo if i["id"] in fired)
            wrong = sorted(i["id"] for i in items if "solo" not in i["tags"] and i["id"] in fired)
            out.append(
                f"Solo check {CHAINS[chain]['solo_check']} (drums + bass + vocals outputs vs "
                f"mixture): recall {hits} of {len(solo)} solo items; wrong bypasses on band items "
                f"{len(wrong)} of {len(items) - len(solo)}"
                + (f" ({', '.join(wrong)})" if wrong else "")
                + ". Missed solos: "
                + (", ".join(sorted(i["id"] for i in solo if i["id"] not in fired)) or "none")
                + "."
            )
    hands = ROOT / "hands.json"
    if hands.is_file():
        data = cast(list[dict[str, Any]], json.loads(hands.read_text(encoding="utf-8")))
        out += [
            "",
            "## Hands (vs ASAP score staves; staff, not physical hand)",
            "",
            "| pieces | notes | splitHands | PM2S hand-part |",
            "|---|---|---|---|",
        ]
        for label, sel in (
            ("all", data),
            (
                "PM2S never trained on (its validation split)",
                [r for r in data if r.get("pm2s_valid")],
            ),
        ):
            notes = sum(r["notes"] for r in sel)
            if notes:
                out.append(
                    f"| {label}: {len(sel)} | {notes} | "
                    f"{sum(r['correct'] for r in sel) / notes:.3f} | "
                    f"{sum(r.get('pm2s_correct', 0) for r in sel) / notes:.3f} |"
                )
    out += ["", f"Per-item rows: `{csv_path.name}`. Command: `{' '.join(sys.argv)}`", ""]
    (RESULTS / f"{stem}.md").write_text("\n".join(out), encoding="utf-8")
    print("\n".join(out))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n", 1)[0])
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("plan").set_defaults(fn=cmd_plan)
    p = sub.add_parser("build")
    p.add_argument("--tier", nargs="+", choices=TIERS, default=list(TIERS))
    p.add_argument("--force", action="store_true")
    p.set_defaults(fn=cmd_build)
    p = sub.add_parser("separate")
    p.add_argument("--separator", choices=SEPARATORS, default="bs_roformer_sw")
    p.add_argument("--tier", nargs="+", choices=TIERS, default=list(TIERS))
    p.set_defaults(fn=cmd_separate)
    p = sub.add_parser("predict")
    p.add_argument("--chain", choices=list(CHAINS), default="baseline")
    p.add_argument("--tier", nargs="+", choices=TIERS, default=list(TIERS))
    p.add_argument("--condition", nargs="+", choices=CONDITIONS, default=list(CONDITIONS))
    p.set_defaults(fn=cmd_predict)
    sub.add_parser("hands").set_defaults(fn=cmd_hands)
    p = sub.add_parser("tags")
    p.add_argument("--tier", nargs="+", choices=TIERS, default=list(TIERS))
    p.set_defaults(fn=cmd_tags)
    p = sub.add_parser("detail")
    p.add_argument("--name", required=True)
    p.add_argument("--tier", nargs="+", choices=TIERS, default=list(TIERS))
    p.add_argument("--condition", nargs="+", choices=INPUTS, default=list(INPUTS))
    p.add_argument("--stereo", action="store_true")
    p.add_argument("--separator", choices=SEPARATORS, default="bs_roformer_sw")
    p.add_argument("--weights", help="folder with checkpoint.pt + model.conf (eval only)")
    p.add_argument("--segment", type=float, default=16.0)
    p.add_argument("--hop", type=float, default=8.0)
    p.set_defaults(fn=cmd_detail)
    p = sub.add_parser("aria")
    p.add_argument("--tier", nargs="+", choices=TIERS, default=list(TIERS))
    p.add_argument("--condition", nargs="+", choices=INPUTS, default=["stem", "clean"])
    p.set_defaults(fn=cmd_aria)
    p = sub.add_parser("calibrate")
    p.add_argument("--chain", choices=list(CHAINS), required=True)
    p.add_argument("--transcriber", choices=list(TRANSCRIBER_RECORDS), default="transkun")
    p.add_argument("--condition", choices=CONDITIONS, default="chosen")
    p.add_argument("--tier", nargs="+", choices=TIERS, default=list(TIERS))
    p.set_defaults(fn=cmd_calibrate)
    p = sub.add_parser("kong")
    p.add_argument("--tier", nargs="+", choices=TIERS, default=list(TIERS))
    p.add_argument("--condition", nargs="+", choices=INPUTS, default=["stem", "clean"])
    p.set_defaults(fn=cmd_kong)
    p = sub.add_parser("compare")
    p.add_argument("--name", nargs="+", required=True)
    p.add_argument("--condition", choices=INPUTS, default="stem")
    p.add_argument("--tier", nargs="+", choices=TIERS, default=list(TIERS))
    p.add_argument("--out")
    p.set_defaults(fn=cmd_compare)
    for name, fn in (("sweep", cmd_sweep), ("confidence", cmd_confidence)):
        p = sub.add_parser(name)
        p.add_argument("--name", required=True)
        p.add_argument("--tier", nargs="+", choices=TIERS, default=list(TIERS))
        p.set_defaults(fn=fn)
    p = sub.add_parser("report")
    p.add_argument("--chain", nargs="+", choices=list(CHAINS), default=["baseline"])
    p.add_argument("--tier", nargs="+", choices=TIERS, default=list(TIERS))
    p.add_argument("--name", help="suffix for the result files (e.g. phase2)")
    p.set_defaults(fn=cmd_report)
    args = parser.parse_args()
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
