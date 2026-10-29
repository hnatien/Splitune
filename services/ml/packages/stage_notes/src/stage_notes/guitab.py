"""Guitab (Morotti 2026, https://github.com/DanieleMorotti/guitab) behind `NoteTranscriber`: a
CQT → CNN + transformer tab model that predicts, per frame and string, the fret (or silence) and an
onset probability; step 22 P2g candidate for guitar.

Runs the published ONNX export (probabilities out, a fixed 432-frame window) on ONNX Runtime CPU,
so it lives in the onnx-cpu island. The feature and the note extraction follow Guitab 1.1.1's
`audio.compute_cqt` and `inference.predict` / `extract_notes` (MIT): log-magnitude CQT from E1,
36 bins per octave, 288 bins, 22.05 kHz, hop 256; overlapping windows blended with a Hann taper;
a note per onset peak per string, ended by silence, the next onset or a held fret change (legato),
the same pitch on two strings within `dedup` frames kept once, and a split ringing note merged
back. Confidence = the onset (or activity) probability at the note's start. The fret posteriors
also give each note a probability per string (`NoteEvent.string_probs`), the audio string cue the
fret DP takes. The model knows standard tuning only: the stage's A4 compensation retunes the input
as for Basic Pitch, and a detuned song's notes keep their string (the fret is the DP's job).
"""

from __future__ import annotations

import threading
from dataclasses import replace
from typing import Any, cast

import numpy as np
import onnxruntime as ort  # pyright: ignore[reportMissingTypeStubs]
from numpy.typing import NDArray
from scipy.signal import resample_poly  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]
from splitune_ml_core import contracts, register

from . import basic_pitch as bp
from . import tuning
from .transcribers import A4_MIN_CENTS, BASIC_PITCH_DEFAULTS, NoteEvent, get, models_dir, ref_for

SR = 22050
HOP = 256
FPS = SR / HOP
N_BINS = 288
BINS_PER_OCTAVE = 36
FMIN_HZ = 41.2034  # E1
WINDOW = 432  # frames per model call (the export's fixed shape)
WINDOW_HOP = 288
OPEN_PITCH = (40, 45, 50, 55, 59, 64)  # model columns: string 6 (low E) … string 1
N_FRETS = 20  # classes 1…20 = frets 0…19, class 0 = silent

GUITAB_DEFAULTS: dict[str, Any] = {
    # Guitab's DEFAULT_PARAMS (tuned on GuitarSet player 04) with E25's own onset threshold.
    "onset_threshold": 0.45,
    "frame_threshold": 0.6,
    "min_frames": 3,
    "legato_frames": 8,
    "orphan": False,
    "fret_frames": 3,
    "dedup_frames": 4,
    "reattack": 0.75,
    "a4_compensation": False,
    "tuning_suggestion": False,
    "tuning_min_low_notes": 1,
    "tuning_min_confidence": 0.3,
    "tuning_min_duration_s": 0.1,
    "string_cue": True,  # notes carry the model's per-string probabilities
    # Bends from Basic Pitch's pitch contour (with_bends): the smallest bend kept and its glide.
    "bends": False,
    "bend_min_cents": 75.0,
    "bend_min_glide_frames": 3,
}
# Basic Pitch for the bend pass: the guitar thresholds from the P2 sweep (notes.personal.yaml).
BEND_PASS: dict[str, Any] = {
    "min_freq_hz": 70,
    "onset_threshold": 0.6,
    "frame_threshold": 0.5,
    "min_note_ms": 58,
}
BEND_MATCH_S = 0.05  # a bent note and Guitab's note at its pitch start this close together


def features(mono: NDArray[np.float32]) -> NDArray[np.float32]:
    """[T, N_BINS] log-magnitude CQT of 44.1 kHz audio in [0, 1] (0 = 80 dB below its peak)."""
    import librosa  # pyright: ignore[reportMissingTypeStubs]

    audio = np.asarray(resample_poly(mono, 1, 2), dtype=np.float32)
    magnitude = np.abs(
        librosa.cqt(  # pyright: ignore[reportUnknownMemberType]
            audio,
            sr=SR,
            hop_length=HOP,
            fmin=FMIN_HZ,
            n_bins=N_BINS,
            bins_per_octave=BINS_PER_OCTAVE,
        )
    )
    db = librosa.amplitude_to_db(magnitude, ref=float(np.max(magnitude)) + 1e-9, top_db=80.0)  # pyright: ignore[reportUnknownMemberType]
    return ((np.asarray(db) + 80.0) / 80.0).T.astype(np.float32)


def predict(
    session: ort.InferenceSession, feat: NDArray[np.float32]
) -> tuple[NDArray[np.float32], NDArray[np.float32]]:
    """(tab [T, 6, 21], onset [T, 6]) from overlapping windows blended with a Hann taper; a short
    input is padded with silence (0) to one window."""
    total = len(feat)
    padded = np.pad(feat, ((0, max(0, WINDOW - total)), (0, 0)))
    length = len(padded)
    starts = list(range(0, length - WINDOW + 1, WINDOW_HOP))
    if starts[-1] + WINDOW < length:
        starts.append(length - WINDOW)
    taper = (np.hanning(WINDOW + 2)[1:-1] + 1e-3).astype(np.float32)
    tab = np.zeros((length, 6, N_FRETS + 1), dtype=np.float32)
    onset = np.zeros((length, 6), dtype=np.float32)
    weight = np.zeros(length, dtype=np.float32)
    for s in starts:
        tab_w, onset_w = cast(
            list[NDArray[np.float32]],
            session.run(  # pyright: ignore[reportUnknownMemberType]
                ["tab", "onset"], {"x": padded[None, s : s + WINDOW]}
            ),
        )
        tab[s : s + WINDOW] += tab_w[0] * taper[:, None, None]
        onset[s : s + WINDOW] += onset_w[0] * taper[:, None]
        weight[s : s + WINDOW] += taper
    return (tab / weight[:, None, None])[:total], (onset / weight[:, None])[:total]


class RawNote:
    __slots__ = ("col", "end", "fret", "fret_conf", "score", "start")

    def __init__(
        self, col: int, start: int, end: int, fret: int, score: float, fret_conf: float
    ) -> None:
        self.col, self.start, self.end, self.fret = col, start, end, fret
        self.score, self.fret_conf = score, fret_conf

    @property
    def pitch(self) -> int:
        return OPEN_PITCH[self.col] + self.fret


def extract(
    tab: NDArray[np.float32], onset: NDArray[np.float32], p: dict[str, Any]
) -> list[RawNote]:
    on_thr, frame_thr = float(p["onset_threshold"]), float(p["frame_threshold"])
    min_frames, fret_frames = int(p["min_frames"]), int(p["fret_frames"])
    legato, orphan = int(p["legato_frames"]), bool(p["orphan"])
    total = len(tab)
    notes: list[RawNote] = []
    for col in range(6):
        active = 1.0 - tab[:, col, 0]
        frets = tab[:, col, 1:].argmax(axis=-1)
        o = onset[:, col]
        peaks: set[int] = {
            t
            for t in range(total)
            if o[t] >= on_thr and o[t] >= o[max(t - 1, 0)] and o[t] > o[min(t + 1, total - 1)]
        }
        t = 0
        while t < total:
            start: int | None = None
            if t in peaks:
                start = t
            elif orphan and active[t] > frame_thr and (t == 0 or active[t - 1] <= frame_thr):
                run = active[t : t + min_frames]
                if len(run) == min_frames and bool((run > frame_thr).all()):
                    start = t
            if start is None:
                t += 1
                continue
            fret = int(tab[start : start + fret_frames, col, 1:].mean(axis=0).argmax())
            end: int = start + 1
            changed = 0
            while end < total:
                if end in peaks or active[end] <= frame_thr:
                    break
                changed = changed + 1 if int(frets[end]) != fret else 0
                if changed >= legato:
                    end -= changed - 1
                    break
                end += 1
            if end - start >= 2 or start in peaks:
                notes.append(
                    RawNote(
                        col,
                        start,
                        end,
                        fret,
                        float(max(o[start], active[start])),
                        float(tab[start : max(end, start + 1), col, fret + 1].mean()),
                    )
                )
            # A held fret change starts the next note without an onset (hammer-on, slide).
            if end < total and end not in peaks and active[end] > frame_thr:
                peaks.add(end)
            t = max(end, start + 1)
    notes.sort(key=lambda n: (n.start, n.col))
    if p["dedup_frames"]:
        notes = drop_duplicates(notes, int(p["dedup_frames"]))
    if p["reattack"]:
        notes = merge_reattacks(notes, onset, float(p["reattack"]))
    return notes


def drop_duplicates(notes: list[RawNote], window: int) -> list[RawNote]:
    """The same pitch starting on two strings within `window` frames: the more certain fret wins."""
    keep = [True] * len(notes)
    for i, a in enumerate(notes):
        for j in range(i + 1, len(notes)):
            b = notes[j]
            if b.start - a.start > window:
                break
            if keep[i] and keep[j] and a.pitch == b.pitch and a.col != b.col:
                if a.fret_conf >= b.fret_conf:
                    keep[j] = False
                else:
                    keep[i] = False
    return [n for n, k in zip(notes, keep, strict=True) if k]


def merge_reattacks(
    notes: list[RawNote], onset: NDArray[np.float32], threshold: float
) -> list[RawNote]:
    """A note starting where the previous one on its string and fret ends, with a weak onset, is
    the same ringing note split by the onset head: merged back."""
    out: list[RawNote] = []
    last: dict[int, RawNote] = {}
    for n in sorted(notes, key=lambda n: n.start):
        prev = last.get(n.col)
        if (
            prev is not None
            and prev.fret == n.fret
            and abs(prev.end - n.start) <= 1
            and onset[n.start, n.col] < threshold
        ):
            prev.end = n.end
            continue
        out.append(n)
        last[n.col] = n
    return sorted(out, key=lambda n: (n.start, n.col))


def string_probs(tab: NDArray[np.float32], note: RawNote, frames: int) -> tuple[float, ...]:
    """P(string) for the note's pitch, string 1 first: each string's posterior for the fret that
    plays the pitch, over the note's first frames, normalised (0 where no fret reaches)."""
    head = tab[note.start : note.start + frames].mean(axis=0)  # [6, 21]
    scores = np.zeros(6)
    for col, open_pitch in enumerate(OPEN_PITCH):
        fret = note.pitch - open_pitch
        if 0 <= fret < N_FRETS:
            scores[5 - col] = head[col, fret + 1]
    total = float(scores.sum())
    return tuple(round(float(s / total), 4) for s in scores) if total > 0 else (0.0,) * 6


def with_bends(notes: list[NoteEvent], bent: list[NoteEvent]) -> list[NoteEvent]:
    """Guitab's notes with Basic Pitch's bent notes (bends.py; Guitab has no pitch contour): the
    note at a bent note's pitch starting within BEND_MATCH_S of it takes its curve and lasts to its
    end, and the notes on the glide (a higher pitch up to the bend's top, starting while it sounds)
    are dropped. A bent note Guitab missed is added without string probabilities."""
    out = list(notes)
    for b in bent:
        top = b.pitch_midi + round(max(c for _, c in b.bend_cents) / 100)
        match = next(
            (
                i
                for i, n in enumerate(out)
                if n.pitch_midi == b.pitch_midi and abs(n.onset_s - b.onset_s) <= BEND_MATCH_S
            ),
            None,
        )
        if match is None:
            out.append(b)
        else:
            n = out[match]
            out[match] = replace(n, offset_s=max(n.offset_s, b.offset_s), bend_cents=b.bend_cents)
        out = [
            n
            for n in out
            if not (
                b.pitch_midi < n.pitch_midi <= top
                and b.onset_s - BEND_MATCH_S <= n.onset_s < b.offset_s
            )
        ]
    return sorted(out, key=lambda n: (n.onset_s, n.pitch_midi))


class Guitab:
    name = "guitab"
    record = "guitab-e25"
    defaults = GUITAB_DEFAULTS

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._session: ort.InferenceSession | None = None

    def model_ref(self) -> contracts.ModelRef:
        return ref_for(self.record, "guitab/e25")

    def session(self) -> ort.InferenceSession:
        with self._lock:
            if self._session is None:
                record = register.model(self.record)
                directory = models_dir() / register.WEIGHTS_DIRS[self.record]
                (path,) = register.verify(record, directory)
                self._session = ort.InferenceSession(
                    str(path),
                    sess_options=bp.session_options(2),
                    providers=["CPUExecutionProvider"],
                )
            return self._session

    def transcribe(self, mono: NDArray[np.float32], params: dict[str, Any]) -> list[NoteEvent]:
        cents = float(params.get("a4_cents") or 0.0)
        stretch = 1.0
        audio = mono
        if abs(cents) >= A4_MIN_CENTS:
            audio, stretch = tuning.retuned(mono, cents)
        tab, onset = predict(self.session(), features(audio))
        frames = int(params["fret_frames"])
        notes = [
            NoteEvent(
                onset_s=n.start / FPS / stretch,
                offset_s=n.end / FPS / stretch,
                pitch_midi=n.pitch,
                velocity=int(np.clip(round(127 * n.score), 1, 127)),
                confidence_raw=min(1.0, max(0.0, n.score)),
                string_probs=string_probs(tab, n, frames) if params["string_cue"] else None,
            )
            for n in extract(tab, onset, params)
        ]
        if not params["bends"]:
            return notes
        bent = get("basic_pitch").transcribe(
            mono,
            {
                **BASIC_PITCH_DEFAULTS,
                **BEND_PASS,
                "a4_cents": cents,
                "bends": True,
                "bend_min_cents": params["bend_min_cents"],
                "bend_min_glide_frames": params["bend_min_glide_frames"],
            },
        )
        return with_bends(notes, [e for e in bent if e.bend_cents])
