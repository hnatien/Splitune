"""Prototype 2: note transcription on stems vs mixture (08 §3 P2, personal-mode candidates).

    uv run python eval/p2.py build-guitar        # GuitarSet excerpts + MUSDB18-HQ band → mixtures
    uv run python eval/p2.py build-bass          # BabySlakh windows (mix, bass/guitar/piano, MIDI)
    uv run python eval/p2.py build-piano         # MAESTRO test excerpts + MUSDB18-HQ band
    uv run python eval/p2.py separate            # BS-Roformer-SW (the map's first choice)
    uv run python eval/p2.py predict --transcriber basic_pitch|yourmt3|transkun [--set ...]
    uv run python eval/p2.py sweep --instrument guitar|bass  # Basic Pitch thresholds on stems
    uv run python eval/p2.py calibrate           # isotonic fit, reliability diagram, ECE
    uv run python eval/p2.py report              # metrics + gates → eval/results/p2/<date>.md

Conditions per item and instrument: `clean` (the isolated reference track: a ceiling), `stem`
(separated from the mixture: the production path) and `mixture`. Every prediction runs the shipped
`notes.<instrument>` stage in-process (`splitune_eval.local`), so the evaluated code is the shipped
code; the transcriber is switched with a temporary notes config.

Material (local only, never committed): GuitarSet mono-mic excerpts (CC-BY-4.0) mixed with the
drums, bass and vocals of a MUSDB18-HQ test window (the guitar 3 LU below the band; harmony and
tempo don't match, so this measures interference, not musical context), MAESTRO v3 test-split
excerpts (CC-BY-NC-SA-4.0, read from the dataset zip with HTTP range requests; Disklavier MIDI
ground truth) mixed the same way, and BabySlakh (CC-BY-4.0, 20 Slakh2100 tracks rendered at
16 kHz, MIDI ground truth). Both Basic Pitch and YourMT3+ were trained on GuitarSet and Slakh, and
YourMT3+ and Transkun on MAESTRO's training split, so absolute scores are optimistic (in-sample).
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import statistics
import sys
import tempfile
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import mir_eval  # pyright: ignore[reportMissingTypeStubs]
import numpy as np
import pyloudnorm  # pyright: ignore[reportMissingTypeStubs]
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
import yaml
from numpy.typing import NDArray
from scipy.signal import resample_poly  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]
from splitune_eval import formats, scoring
from splitune_eval.calibration import fit_isotonic, reliability
from splitune_eval.local import LocalRun, write_json
from splitune_eval.report import git_sha

ROOT = Path("~/datasets/p2").expanduser()
GUITARSET = Path("~/datasets/guitarset").expanduser()
MUSDB = Path("~/datasets/musdb18hq-p1").expanduser()
BABYSLAKH = Path("~/datasets/babyslakh/babyslakh_16k").expanduser()
MAESTRO_URL = (
    "https://storage.googleapis.com/magentadata/datasets/maestro/v3.0.0/maestro-v3.0.0.zip"
)
RESULTS = Path(__file__).resolve().parent / "results" / "p2"
ML_ROOT = Path(__file__).resolve().parents[1]
CALIBRATION_DIR = ML_ROOT / "config" / "calibration"
RATE = 44100
GUITAR_BELOW_BAND_LU = 3.0  # also used for piano
SEPARATOR = "bs_roformer_sw"
CONDITIONS = ("clean", "stem", "mixture")
# → register record
TRANSCRIBERS = {"basic_pitch": "basic-pitch", "yourmt3": "yourmt3-moe", "transkun": "transkun-v2"}
# P2 gate (08 §3): stem >= mixture and onset F1 >= 0.70 for guitar, >= 0.80 for piano in a band.
# The doc names no bass threshold; the guitar one is applied (proposal).
GATE_F1 = {"guitar": 0.70, "bass": 0.70, "piano": 0.80}
INSTRUMENTS = ("guitar", "bass", "piano")
SETS = ("guitar", "slakh", "piano")
FIT_PLAYERS = {"00", "01", "02"}  # calibration fit split; players 03-05 are held out
SLAKH_WINDOW_S = 30.0
MAESTRO_WINDOW_S = (20.0, 50.0)  # past the opening, as the Slakh windows start after the first note
ODD_HALF_SHARE = 0.3  # rendered_octave

Audio = NDArray[np.float32]


# --- audio helpers ---------------------------------------------------------------------------


def read(path: Path, rate: int = RATE) -> Audio:
    data, sr = sf.read(str(path), dtype="float32", always_2d=True)
    audio = np.asarray(data, dtype=np.float32).mean(axis=1)
    if sr != rate:
        audio = np.asarray(resample_poly(audio, rate, int(sr)), dtype=np.float32)
    return audio


def loudness(audio: Audio) -> float:
    meter = pyloudnorm.Meter(RATE)  # pyright: ignore[reportUnknownMemberType]
    return float(meter.integrated_loudness(audio.astype(np.float64)))  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]


def write(path: Path, audio: Audio) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), audio, RATE, subtype="FLOAT")  # pyright: ignore[reportUnknownMemberType]


def fit_length(audio: Audio, frames: int) -> Audio:
    reps = int(np.ceil(frames / max(len(audio), 1)))
    return np.tile(audio, reps)[:frames]


# --- material --------------------------------------------------------------------------------


def manifest_path(name: str) -> Path:
    return ROOT / f"{name}.json"


def load_manifest(name: str) -> list[dict[str, Any]]:
    return cast(list[dict[str, Any]], json.loads(manifest_path(name).read_text(encoding="utf-8")))


def cmd_build_guitar(_: argparse.Namespace) -> int:
    windows = sorted(p for p in MUSDB.iterdir() if (p / "drums.wav").is_file())
    # Progression 1 of each style, every player and mode (as the guitarset-mic-beats set).
    jams = sorted(
        p
        for p in (GUITARSET / "annotation").glob("*.jams")
        if re.match(r"^0[0-5]_[A-Za-z]+1-", p.stem)
    )
    items: list[dict[str, Any]] = []
    for k, path in enumerate(jams):
        stem = path.stem
        guitar = read(GUITARSET / "audio_mono-mic" / f"{stem}_mic.wav")
        band = sum(
            read(windows[k % len(windows)] / f"{s}.wav") for s in ("drums", "bass", "vocals")
        )
        band = fit_length(np.asarray(band, dtype=np.float32), len(guitar))
        gain_db = loudness(guitar) - loudness(band) + GUITAR_BELOW_BAND_LU
        mixture = (guitar + band * np.float32(10 ** (gain_db / 20))).astype(np.float32)
        peak = float(np.max(np.abs(mixture)))
        scale = np.float32(min(1.0, 0.9 / peak))
        out = ROOT / "guitar" / stem
        write(out / "mixture.wav", mixture * scale)
        write(out / "guitar.wav", guitar * scale)
        player, rest = stem.split("_", 1)
        items.append(
            {
                "id": stem,
                "dir": str(out),
                "instruments": {"guitar": str(path)},
                "tags": {
                    "player": player,
                    "mode": rest.rsplit("_", 1)[1],
                    "style": rest.split("-")[0][:-1],
                },
                "band": windows[k % len(windows)].name,
            }
        )
        print(f"guitar {stem}", flush=True)
    write_json(manifest_path("guitar"), items)
    return 0


def midi_notes(path: Path, t0: float, t1: float) -> list[tuple[float, float, int]]:
    """(onset, offset, pitch) of the MIDI file's notes starting inside [t0, t1), shifted to t0."""
    import mido  # pyright: ignore[reportMissingTypeStubs]

    now = 0.0
    active: dict[tuple[int, int], float] = {}
    notes: list[tuple[float, float, int]] = []
    for msg in mido.MidiFile(str(path)):  # pyright: ignore[reportUnknownVariableType]
        now += float(msg.time)  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]
        if msg.type == "note_on" and msg.velocity > 0:  # pyright: ignore[reportUnknownMemberType]
            active[(int(msg.channel), int(msg.note))] = now  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]
        elif msg.type in ("note_off", "note_on"):  # pyright: ignore[reportUnknownMemberType]
            start = active.pop((int(msg.channel), int(msg.note)), None)  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]
            if start is not None and t0 <= start < t1:
                notes.append((start - t0, min(now, t1) - t0, int(msg.note)))  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]
    return sorted(notes)


def band_energy(power: NDArray[np.float64], freqs: NDArray[np.float64], f: float) -> float:
    return float(power[(freqs > f / 1.02) & (freqs < f * 1.02)].sum())


def rendered_octave(audio: Audio, notes: list[tuple[float, float, int]]) -> int:
    """-12 when a Slakh stem sounds an octave below its MIDI (some rendering patches transpose),
    else 0. A tone at the MIDI pitch f0 has partials only at multiples of f0; one sounding at
    f0/2 also has them at odd multiples of f0/2. Per note (first 0.5 s), the share of the energy
    at f0/2, 3f0/2, 5f0/2 among those bands and f0, 2f0, 3f0; the stem is shifted when the median
    share reaches ODD_HALF_SHARE. On BabySlakh, correctly pitched guitars stay below 0.26 (chord
    fifths land on 3f0/2) and every bass stem is above 0.33. The fundamental alone is not enough:
    bass patches often carry little energy at f0/2. An upward transposition can't be told from a
    strong 2nd harmonic, so it is never inferred."""
    shares: list[float] = []
    for t0, t1, pitch in notes:
        seg = audio[int(t0 * RATE) : int(min(t1, t0 + 0.5) * RATE)].astype(np.float64)
        if len(seg) < 4096:
            continue
        power = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), n=1 << 17)) ** 2
        freqs = np.fft.rfftfreq(1 << 17, 1 / RATE)
        f0 = 440.0 * 2 ** ((pitch - 69) / 12)
        odd = sum(band_energy(power, freqs, f0 * k / 2) for k in (1, 3, 5))
        even = sum(band_energy(power, freqs, f0 * k) for k in (1, 2, 3))
        shares.append(odd / (odd + even + 1e-12))
    return -12 if shares and float(np.median(shares)) >= ODD_HALF_SHARE else 0


def write_ref(path: Path, notes: list[tuple[float, float, int]]) -> None:
    buf = io.StringIO()
    csv.writer(buf).writerows((f"{a:.4f}", f"{b:.4f}", p) for a, b, p in notes)
    path.write_text(buf.getvalue(), encoding="utf-8")


def cmd_build_bass(_: argparse.Namespace) -> int:
    items: list[dict[str, Any]] = []
    for track in sorted(BABYSLAKH.glob("Track*")):
        meta = cast(
            dict[str, Any], yaml.safe_load((track / "metadata.yaml").read_text(encoding="utf-8"))
        )
        stems = cast(dict[str, dict[str, Any]], meta["stems"])
        parts = {
            inst: [
                s
                for s, info in stems.items()
                if info.get("inst_class") == cls
                and (track / "stems" / f"{s}.wav").is_file()
                and (track / "MIDI" / f"{s}.mid").is_file()
            ]
            for inst, cls in (("bass", "Bass"), ("guitar", "Guitar"), ("piano", "Piano"))
        }
        if not parts["bass"]:
            continue
        first = min(
            n[0] for s in parts["bass"] for n in midi_notes(track / "MIDI" / f"{s}.mid", 0, 1e9)
        )
        t0 = max(0.0, first + 5.0)
        t1 = t0 + SLAKH_WINDOW_S
        out = ROOT / "slakh" / track.name
        window = slice(int(t0 * RATE), int(t1 * RATE))
        write(out / "mixture.wav", read(track / "mix.wav")[window])
        instruments: dict[str, str] = {}
        shifts: dict[str, int] = {}
        for inst, names in parts.items():
            if not names:
                continue
            stem_audio = {s: read(track / "stems" / f"{s}.wav")[window] for s in names}
            refs: list[tuple[float, float, int]] = []
            for s in names:
                notes = midi_notes(track / "MIDI" / f"{s}.mid", t0, t1)
                shift = rendered_octave(stem_audio[s], notes)
                if shift:
                    shifts[f"{inst}:{s}"] = shift
                refs += [(a, b, p + shift) for a, b, p in notes]
            if len(refs) < 10:
                continue
            write(out / f"{inst}.wav", np.asarray(sum(stem_audio.values()), dtype=np.float32))
            write_ref(out / f"{inst}.ref.csv", sorted(refs))
            instruments[inst] = str(out / f"{inst}.ref.csv")
        items.append(
            {
                "id": track.name,
                "dir": str(out),
                "instruments": instruments,
                "tags": {
                    "track": track.name,
                    "window_s": [round(t0, 2), round(t1, 2)],
                    "ref_octave_shift": shifts,
                    "piano_programs": sorted(
                        {int(stems[s]["program_num"]) for s in parts["piano"]}
                    ),
                },
            }
        )
        print(f"slakh {track.name}: {sorted(instruments)}", flush=True)
    write_json(manifest_path("slakh"), items)
    return 0


def cmd_build_piano(_: argparse.Namespace) -> int:
    """One MAESTRO v3 test performance per composer (16; the first by title), window
    MAESTRO_WINDOW_S, mixed under the drums, bass and vocals of a MUSDB18-HQ window like the
    guitar set. References: the performance MIDI's note on/off (no pedal extension)."""
    import zipfile

    from p1_musdb import HttpRangeFile, WavStream

    archive = zipfile.ZipFile(io.BufferedReader(HttpRangeFile(MAESTRO_URL), buffer_size=4 << 20))
    folder = "maestro-v3.0.0/"
    rows = list(
        csv.DictReader(io.TextIOWrapper(archive.open(f"{folder}maestro-v3.0.0.csv"), "utf-8"))
    )
    picked: dict[str, dict[str, str]] = {}
    for row in sorted(
        (r for r in rows if r["split"] == "test"),
        key=lambda r: (r["canonical_composer"], r["canonical_title"], r["audio_filename"]),
    ):
        picked.setdefault(row["canonical_composer"], row)
    windows = sorted(p for p in MUSDB.iterdir() if (p / "drums.wav").is_file())
    t0, t1 = MAESTRO_WINDOW_S
    items: list[dict[str, Any]] = []
    for k, row in enumerate(picked.values()):
        item_id = f"maestro{k:02d}"
        out = ROOT / "piano" / item_id
        out.mkdir(parents=True, exist_ok=True)
        with archive.open(folder + row["audio_filename"]) as member:
            wav = WavStream(member)
            start = int(t0 * wav.samplerate)
            frames = int((t1 - t0) * wav.samplerate)
            data = wav.read(start, frames).mean(axis=1)
            rate = wav.samplerate
        piano = np.asarray(resample_poly(data, RATE, rate) if rate != RATE else data, np.float32)
        midi = out / "performance.midi"
        midi.write_bytes(archive.read(folder + row["midi_filename"]))
        band = sum(
            read(windows[k % len(windows)] / f"{s}.wav") for s in ("drums", "bass", "vocals")
        )
        band = fit_length(np.asarray(band, dtype=np.float32), len(piano))
        gain_db = loudness(piano) - loudness(band) + GUITAR_BELOW_BAND_LU
        mixture = (piano + band * np.float32(10 ** (gain_db / 20))).astype(np.float32)
        scale = np.float32(min(1.0, 0.9 / float(np.max(np.abs(mixture)))))
        write(out / "mixture.wav", mixture * scale)
        write(out / "piano.wav", piano * scale)
        write_ref(out / "piano.ref.csv", midi_notes(midi, t0, t1))
        items.append(
            {
                "id": item_id,
                "dir": str(out),
                "instruments": {"piano": str(out / "piano.ref.csv")},
                "tags": {
                    "composer": row["canonical_composer"],
                    "title": row["canonical_title"],
                    "audio": row["audio_filename"],
                    "window_s": [t0, t1],
                },
                "band": windows[k % len(windows)].name,
            }
        )
        print(f"piano {item_id} {row['canonical_composer']}", flush=True)
    write_json(manifest_path("piano"), items)
    return 0


# --- separation and predictions ----------------------------------------------------------------


def all_items(sets: Iterable[str]) -> list[dict[str, Any]]:
    return [{**i, "set": s} for s in sets for i in load_manifest(s)]


def cmd_separate(args: argparse.Namespace) -> int:
    from stage_separation import config, models  # torch + audio-separator: only here

    spec = config.load().models[SEPARATOR]
    for item in all_items(args.set):
        out = Path(item["dir"]) / "sep"
        if (out / "bass.wav").is_file():
            continue
        result = models.separate(SEPARATOR, spec, Path(item["dir"]) / "mixture.wav", out)
        print(f"{SEPARATOR} {item['id']}: {result.seconds:.1f}s", flush=True)
    return 0


def notes_config(transcriber: str, path: Path) -> None:
    base = cast(
        dict[str, Any], yaml.safe_load((ML_ROOT / "config" / "notes.personal.yaml").read_text())
    )
    for spec in base["instruments"].values():
        if spec["transcriber"] != transcriber:
            spec["transcriber"] = transcriber
            spec["params"] = {}
    path.write_text(yaml.safe_dump(base), encoding="utf-8")


def run_dir(transcriber: str, condition: str) -> Path:
    return ROOT / "runs" / transcriber / condition


def cmd_predict(args: argparse.Namespace) -> int:
    with tempfile.TemporaryDirectory() as tmp:
        config = Path(tmp) / "notes.yaml"
        notes_config(args.transcriber, config)
        os.environ["ML_NOTES_CONFIG"] = str(config)
        local = LocalRun(Path(tmp) / "work")
        for item in all_items(args.set):
            if (
                args.players
                and item["set"] == "guitar"
                and item["tags"]["player"] not in args.players
            ):
                continue
            base = Path(item["dir"])
            for instrument in item["instruments"]:
                if instrument not in args.instrument:
                    continue
                for condition in args.condition:
                    dest = run_dir(args.transcriber, condition) / f"{item['id']}.{instrument}.json"
                    if dest.is_file():
                        continue
                    source = base / (f"{instrument}.wav" if condition == "clean" else "mixture.wav")
                    decoded = local.decode(source)
                    inputs: dict[str, str] = {}
                    if condition == "stem":
                        if not (base / "sep" / f"{instrument}.wav").is_file():
                            continue  # not separated yet
                        sep = {
                            i: base / "sep" / f"{i}.wav"
                            for i in ("guitar", "bass", "piano", "drums")
                            if (base / "sep" / f"{i}.wav").is_file()
                        }
                        inputs["separation"] = str(
                            local.separation(
                                decoded, sep, instrument, SEPARATOR, Path(tmp) / "separation.json"
                            )
                        )
                    out = local.run(f"notes.{instrument}", inputs, decoded)
                    local.keep(out, "notes", dest)
                    print(f"{args.transcriber} {condition} {item['id']} {instrument}", flush=True)
    return 0


# --- scoring ---------------------------------------------------------------------------------


def reference(path: str) -> formats.NoteEvents:
    return formats.notes(Path(path))


def fold(notes: formats.NoteEvents) -> formats.NoteEvents:
    """Octave-folded copy (every pitch into one octave): octave errors don't count."""
    return formats.NoteEvents(notes.intervals, notes.pitches_midi % 12 + 60)


def scores(transcriber: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in all_items(SETS):
        for instrument, ref_path in item["instruments"].items():
            ref = reference(ref_path)
            for condition in CONDITIONS:
                est_path = run_dir(transcriber, condition) / f"{item['id']}.{instrument}.json"
                if not est_path.is_file():
                    continue
                est = formats.notes(est_path)
                metrics, _ = scoring.notes(ref, est)
                folded, _ = scoring.notes(fold(ref), fold(est))
                metrics["onset_f1_pitch_class"] = folded["onset_f1"]
                rows.append(
                    {
                        "transcriber": transcriber,
                        "set": item["set"],
                        "item": item["id"],
                        "instrument": instrument,
                        "condition": condition,
                        **item["tags"],
                        **metrics,
                    }
                )
    return rows


def matched_labels(ref: formats.NoteEvents, est_path: Path) -> tuple[list[float], list[int]]:
    """(confidence_raw, correct) per estimated note, onset-only matching (±50 ms, ±50 cents)."""
    from splitune_ml_core import contracts

    notes = contracts.Notes.model_validate_json(est_path.read_text(encoding="utf-8")).notes
    if not notes:
        return [], []
    est = formats.notes(est_path)
    matching = mir_eval.transcription.match_notes(  # pyright: ignore[reportUnknownVariableType, reportUnknownMemberType]
        ref.intervals,
        hz(ref.pitches_midi),
        est.intervals,
        hz(est.pitches_midi),
        onset_tolerance=0.05,
        pitch_tolerance=50.0,
        offset_ratio=None,  # pyright: ignore[reportArgumentType]
    )
    hit = {int(j) for _, j in cast(list[tuple[int, int]], matching)}
    # formats.notes sorts by (onset, offset, pitch); align the confidences the same way.
    ordered = sorted(notes, key=lambda n: (n.onset_s, n.offset_s, n.pitch_midi))
    return [float(n.confidence_raw or 0.0) for n in ordered], [
        int(j in hit) for j in range(len(ordered))
    ]


def hz(midi: NDArray[np.float64]) -> NDArray[np.float64]:
    return 440.0 * 2.0 ** ((midi - 69.0) / 12.0)


def is_fit(item: dict[str, Any]) -> bool:
    if item["set"] == "guitar":
        return item["tags"]["player"] in FIT_PLAYERS
    if item["set"] == "piano":
        return int(item["id"].removeprefix("maestro")) % 2 == 0
    return int(item["id"].removeprefix("Track")) <= 10


def calibration_data(transcriber: str, instrument: str) -> dict[str, tuple[list[float], list[int]]]:
    split: dict[str, tuple[list[float], list[int]]] = {"fit": ([], []), "test": ([], [])}
    for item in all_items(SETS):
        if instrument not in item["instruments"]:
            continue
        est_path = run_dir(transcriber, "stem") / f"{item['id']}.{instrument}.json"
        if not est_path.is_file():
            continue
        conf, ok = matched_labels(reference(item["instruments"][instrument]), est_path)
        bucket = split["fit" if is_fit(item) else "test"]
        bucket[0].extend(conf)
        bucket[1].extend(ok)
    return split


def cmd_calibrate(args: argparse.Namespace) -> int:
    from splitune_ml_core import calibration, contracts, register

    lines: list[str] = []
    for transcriber in args.transcriber:
        record = register.model(TRANSCRIBERS[transcriber])
        for instrument in INSTRUMENTS:
            data = calibration_data(transcriber, instrument)
            (fx, fy), (tx, ty) = data["fit"], data["test"]
            if not fx or not tx:
                continue
            knots = fit_isotonic(fx, fy)
            fitted_on = {
                "guitar": "guitarset-players-00-02",
                "bass": "babyslakh-01-10",
                "piano": "maestro-even-babyslakh-01-10",
            }[instrument]
            table = contracts.CalibrationTable(
                model_id=record.id,
                version=record.version,
                method="isotonic",
                knots=knots,
                bands=contracts.Bands(high=0.7, medium=0.4),
                fitted_on=f"p2-{fitted_on}-stems",
            )
            raw_rel = reliability(tx, ty)
            cal_rel = reliability([calibration.calibrate(x, table) for x in tx], ty)
            path = CALIBRATION_DIR / f"{table.model_id}@{table.version}.{instrument}.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(contracts.dump_json(table) + "\n", encoding="utf-8")
            lines.append(f"## {transcriber} / {instrument}\n")
            lines.append(
                f"fit on {len(fx)} notes, tested on {len(ty)} held-out notes "
                f"(precision {np.mean(ty):.3f}); table `{path.relative_to(ML_ROOT)}`, "
                f"{len(knots)} knots\n"
            )
            lines.append(
                f"ECE raw **{raw_rel.ece:.3f}** → calibrated **{cal_rel.ece:.3f}** "
                "(10 equal-width bins, held-out notes)\n"
            )
            lines.append(cal_rel.table(raw_rel))
            lines.append("")
    text = "\n".join(lines)
    print(text)
    (ROOT / "calibration.md").write_text(text, encoding="utf-8")
    return 0


def mean(rows: list[dict[str, Any]], key: str) -> float:
    return statistics.fmean(r[key] for r in rows) if rows else float("nan")


SWEEP = {
    "onset_threshold": (0.4, 0.5, 0.6, 0.7),
    "frame_threshold": (0.3, 0.4, 0.5),
    "min_note_ms": (58.0, 127.7, 200.0),
}


def cmd_sweep(args: argparse.Namespace) -> int:
    """Basic Pitch decoding thresholds on the separated stems: chosen on the fit split by mean
    onset F1, reported on the held-out split. Posteriors are computed once per item and decoded
    with the shipped `notes_polyphonic` for every combination."""
    import itertools

    from stage_notes import basic_pitch as bp
    from stage_notes import transcribers

    model = cast(transcribers.BasicPitch, transcribers.get("basic_pitch"))
    base = transcribers.for_instrument(args.instrument)[1]
    combos = [dict(zip(SWEEP, v, strict=True)) for v in itertools.product(*SWEEP.values())]
    results: dict[str, dict[int, list[float]]] = {"fit": {}, "test": {}}
    for item in all_items(SETS):
        if args.instrument not in item["instruments"]:
            continue
        stem = Path(item["dir"]) / "sep" / f"{args.instrument}.wav"
        if not stem.is_file():
            continue
        posteriors = model.posteriors(read(stem))
        times = bp.frame_times(posteriors.contour.shape[0])
        ref = reference(item["instruments"][args.instrument])
        split = results["fit" if is_fit(item) else "test"]
        for k, combo in enumerate(combos):
            params = {**base, **combo}
            raw = bp.notes_polyphonic(
                posteriors,
                onset_thresh=float(params["onset_threshold"]),
                frame_thresh=float(params["frame_threshold"]),
                min_note_len=bp.min_note_frames(float(params["min_note_ms"])),
                min_freq=params["min_freq_hz"],
                max_freq=params["max_freq_hz"],
            )
            rows = sorted(
                (float(times[n.start]), float(times[n.end]), float(n.pitch_midi)) for n in raw
            )
            est = formats.NoteEvents(
                np.array([[a, b] for a, b, _ in rows]).reshape(-1, 2),
                np.array([p for *_, p in rows], dtype=np.float64),
            )
            split.setdefault(k, []).append(scoring.notes(ref, est)[0]["onset_f1"])
        print(f"sweep {args.instrument} {item['id']}", flush=True)
    ranked = sorted(range(len(combos)), key=lambda k: -statistics.fmean(results["fit"][k]))
    lines = [
        f"## Basic Pitch thresholds, {args.instrument} stems ({len(results['fit'][0])} fit / "
        f"{len(results['test'][0])} held-out items; onset F1)",
        "",
        "| onset | frame | min note ms | fit | held-out |",
        "|---|---|---|---|---|",
    ]
    default = (
        combos.index({k: base[k] for k in SWEEP}) if {k: base[k] for k in SWEEP} in combos else None
    )
    for k in ranked[:5] + ([default] if default is not None and default not in ranked[:5] else []):
        c = combos[k]
        mark = " (current)" if k == default else ""
        fit, held = (statistics.fmean(results[s][k]) for s in ("fit", "test"))
        lines.append(
            f"| {c['onset_threshold']} | {c['frame_threshold']} | {c['min_note_ms']}{mark} | "
            f"{fit:.3f} | {held:.3f} |"
        )
    text = "\n".join(lines) + "\n"
    (ROOT / f"sweep-{args.instrument}.md").write_text(text, encoding="utf-8")
    print(text)
    return 0


# (instrument, set, label): the gate uses the first group of each instrument.
GROUPS = [
    ("guitar", "guitar", "GuitarSet + MUSDB band"),
    ("guitar", "slakh", "BabySlakh"),
    ("bass", "slakh", "BabySlakh"),
    ("piano", "piano", "MAESTRO + MUSDB band"),
    ("piano", "slakh", "BabySlakh"),
]
COLUMNS = ("onset_f1", "onset_precision", "onset_recall", "onset_offset_f1", "onset_f1_pitch_class")


def select(rows: list[dict[str, Any]], **match: str) -> list[dict[str, Any]]:
    return [r for r in rows if all(r[k] == v for k, v in match.items())]


def gate(
    rows: list[dict[str, Any]], transcriber: str, instrument: str
) -> tuple[float, float, bool]:
    group = next(g for g in GROUPS if g[0] == instrument)
    base = {"transcriber": transcriber, "instrument": instrument, "set": group[1]}
    stem = mean(select(rows, **base, condition="stem"), "onset_f1")
    mix = mean(select(rows, **base, condition="mixture"), "onset_f1")
    return stem, mix, stem >= mix and stem >= GATE_F1[instrument]


def paired(rows: list[dict[str, Any]], transcribers: list[str]) -> list[str]:
    """Transcribers compared on the (item, instrument, condition) cells every one of them ran."""
    cells: list[set[tuple[str, str, str]]] = [
        {(r["item"], r["instrument"], r["condition"]) for r in rows if r["transcriber"] == t}
        for t in transcribers
    ]
    common = cells[0].intersection(*cells[1:])
    out = [
        "",
        "## Paired comparison (cells every transcriber ran)",
        "",
        "| instrument | material | condition | items | "
        + " | ".join(f"{t} onset F1" for t in transcribers)
        + " |",
        "|---|---|---|---|" + "---|" * len(transcribers),
    ]
    for inst, set_id, label in GROUPS:
        for cond in CONDITIONS:
            sel = [
                r
                for r in select(rows, instrument=inst, set=set_id, condition=cond)
                if (r["item"], r["instrument"], r["condition"]) in common
            ]
            if not sel:
                continue
            means = " | ".join(
                f"{mean(select(sel, transcriber=t), 'onset_f1'):.3f}" for t in transcribers
            )
            out.append(f"| {inst} | {label} | {cond} | {len(sel) // len(transcribers)} | {means} |")
    return out


def cmd_report(args: argparse.Namespace) -> int:
    rows = [r for t in args.transcriber for r in scores(t)]
    RESULTS.mkdir(parents=True, exist_ok=True)
    date = datetime.now(UTC).strftime("%Y-%m-%d")
    csv_path = RESULTS / f"{date}.csv"
    keys = sorted({k for r in rows for k in r})
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(
            {k: json.dumps(v) if isinstance(v, dict | list) else v for k, v in r.items()}
            for r in rows
        )
    empty = formats.NoteEvents(np.zeros((0, 2)), np.zeros(0))
    _, variant = scoring.notes(empty, empty)
    out = [
        f"# Prototype 2 — note transcription on stems vs mixture ({date})",
        "",
        f"git `{git_sha()}` · metric: {variant}; pitch-class F1 = onset F1 with octaves folded · "
        f"separation `{SEPARATOR}` (map first choice, step-07b settings) · conditions: clean "
        "reference track (ceiling), separated stem (production path), mixture",
        "",
        "| transcriber | instrument | material | condition | items | onset F1 | onset P | onset R "
        "| onset+offset F1 | pitch-class F1 |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for t in args.transcriber:
        for inst, set_id, label in GROUPS:
            for cond in CONDITIONS:
                sel = select(rows, transcriber=t, instrument=inst, set=set_id, condition=cond)
                if sel:
                    cells = " | ".join(f"{mean(sel, k):.3f}" for k in COLUMNS)
                    out.append(f"| {t} | {inst} | {label} | {cond} | {len(sel)} | {cells} |")
    out += [
        "",
        "## Gate (08 §3 P2: stem ≥ mixture, onset F1 ≥ 0.70 on stems; piano ≥ 0.80 in a band)",
        "",
    ]
    for inst in INSTRUMENTS:
        for t in args.transcriber:
            stem, mix, ok = gate(rows, t, inst)
            if stem != stem:  # NaN: this transcriber has no stem runs for the instrument
                continue
            out.append(
                f"- {inst} / {t}: stem {stem:.3f} vs mixture {mix:.3f}, "
                f"threshold {GATE_F1[inst]:.2f} → **{'PASS' if ok else 'FAIL'}**"
            )
    out += [
        "",
        "Caveats: Basic Pitch and YourMT3+ were trained on GuitarSet and Slakh (BabySlakh's tracks "
        "are Slakh2100 training tracks), so every number is in-sample, YourMT3+'s mixture scores "
        "most of all. The gate averages all items, including the sweep's fit split (the sweep "
        "tables give held-out scores). BabySlakh references are octave-corrected per stem "
        "(`rendered_octave`): most bass patches sound an octave below their MIDI. YourMT3+ and "
        "Transkun were trained on MAESTRO's training split: the piano excerpts come from its test "
        "split (unseen performances, but the same Disklavier pianos and rooms), so MAESTRO scores "
        "are optimistic for pop piano; BabySlakh's piano class includes electric pianos, "
        "clavinet and harpsichord (General MIDI programs 0-7).",
        "",
        "## GuitarSet by mode (stem condition)",
        "",
        "| transcriber | mode | items | onset F1 |",
    ]
    out.append("|---|---|---|---|")
    for t in args.transcriber:
        for mode in ("comp", "solo"):
            sel = select(rows, transcriber=t, set="guitar", condition="stem", mode=mode)
            if sel:
                out.append(f"| {t} | {mode} | {len(sel)} | {mean(sel, 'onset_f1'):.3f} |")
    out += [
        "",
        "## BabySlakh piano by patch (stem condition)",
        "",
        "Acoustic: every piano part in the track is a General MIDI acoustic piano (programs 0-3); "
        "electric: the track also has an electric piano, harpsichord or clavinet (4-7).",
        "",
        "| transcriber | patches | items | onset F1 |",
        "|---|---|---|---|",
    ]
    for t in args.transcriber:
        sel = select(rows, transcriber=t, instrument="piano", set="slakh", condition="stem")
        for name, acoustic in (("acoustic", True), ("electric", False)):
            group = [r for r in sel if all(p <= 3 for p in r["piano_programs"]) == acoustic]
            if group:
                out.append(f"| {t} | {name} | {len(group)} | {mean(group, 'onset_f1'):.3f} |")
    if len(args.transcriber) > 1:
        out += paired(rows, args.transcriber)
    notes = cast(
        dict[str, Any], yaml.safe_load((ML_ROOT / "config" / "notes.personal.yaml").read_text())
    )
    views = cast(dict[str, Any], yaml.safe_load((ML_ROOT / "config" / "views.yaml").read_text()))
    out += ["", "## Defaults", ""]
    for inst, spec in notes["instruments"].items():
        gate_value = views["quality_gate"].get(inst, "none")
        out.append(
            f"- {inst}: `{spec['transcriber']}` {spec.get('params', {})} · views.yaml quality_gate "
            f"`{gate_value}`"
        )
    for name in ("sweep-guitar.md", "sweep-bass.md", "calibration.md"):
        if (ROOT / name).is_file():
            text = (ROOT / name).read_text(encoding="utf-8")
            out += ["", re.sub(r"(?m)^## ", "### ", text).strip()]
    out += ["", f"Per-item rows: `{csv_path.name}`. Command: `{' '.join(sys.argv)}`", ""]
    (RESULTS / f"{date}.md").write_text("\n".join(out), encoding="utf-8")
    print("\n".join(out))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n", 1)[0])
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("build-guitar").set_defaults(fn=cmd_build_guitar)
    sub.add_parser("build-bass").set_defaults(fn=cmd_build_bass)
    sub.add_parser("build-piano").set_defaults(fn=cmd_build_piano)
    for name, fn in (("separate", cmd_separate), ("predict", cmd_predict)):
        p = sub.add_parser(name)
        p.add_argument("--set", nargs="+", choices=SETS, default=list(SETS))
        if name == "predict":
            p.add_argument("--transcriber", choices=list(TRANSCRIBERS), required=True)
            p.add_argument("--condition", nargs="+", choices=CONDITIONS, default=list(CONDITIONS))
            p.add_argument(
                "--instrument", nargs="+", choices=INSTRUMENTS, default=list(INSTRUMENTS)
            )
            p.add_argument(
                "--players", nargs="+", help="GuitarSet players to include (default all)"
            )
        p.set_defaults(fn=fn)
    p = sub.add_parser("sweep")
    p.add_argument("--instrument", choices=["guitar", "bass"], required=True)
    p.set_defaults(fn=cmd_sweep)
    for name, fn in (("calibrate", cmd_calibrate), ("report", cmd_report)):
        p = sub.add_parser(name)
        p.add_argument(
            "--transcriber", nargs="+", choices=list(TRANSCRIBERS), default=list(TRANSCRIBERS)
        )
        p.set_defaults(fn=fn)
    args = parser.parse_args()
    return int(args.fn(args))


if __name__ == "__main__":
    sys.exit(main())
