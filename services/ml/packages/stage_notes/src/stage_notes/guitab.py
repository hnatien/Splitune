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

import hashlib
import threading
from collections.abc import Callable
from dataclasses import replace
from typing import Any, cast

import numpy as np
import onnxruntime as ort  # pyright: ignore[reportMissingTypeStubs]
from numpy.typing import NDArray
from scipy.signal import resample_poly  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]
from splitune_ml_core import contracts, register

from . import basic_pitch as bp
from . import tuning
from .transcribers import (
    A4_MIN_CENTS,
    BASIC_PITCH_DEFAULTS,
    RATE,
    NoteEvent,
    get,
    models_dir,
    ref_for,
)

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
    "extend_threshold": None,  # notes ring on while their string's activity stays above this
    # Down-tuning (tuning_shift; the notes stage asks for it with `downtune` and passes the result
    # back as `tuning_shift`): open-string evidence first, sustained notes below E2 second.
    "downtune": False,
    "tuning_shift": 0,  # semitones the recording sits below standard tuning (set by the stage)
    "downtune_max": 2,  # semitones
    "downtune_max_s": 60.0,  # audio the check reads at most (excerpt): its cost stays bounded
    "downtune_open_min": 0.08,  # open-string share of note time at the chosen shift, at least
    "downtune_open_margin": 0.05,  # above the unshifted share by this much
    "downtune_open_ratio": 10.0,  # and this many times the unshifted share
    "downtune_min_notes": 3,  # sustained low Basic Pitch notes needed
    "downtune_min_confidence": 0.5,
    "downtune_min_duration_s": 0.15,
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


def low_shift(bent: list[NoteEvent], p: dict[str, Any]) -> int:
    """Semitones a down-tuned recording sits below standard: at least `downtune_min_notes`
    sustained, confident Basic Pitch notes below E2 (which standard tuning cannot play), the
    shift reaching the robust lowest of them (10th percentile), at most `downtune_max`."""
    low = sorted(
        e.pitch_midi
        for e in bent
        if e.pitch_midi < OPEN_PITCH[0]
        and e.offset_s - e.onset_s >= float(p["downtune_min_duration_s"])
        and e.confidence_raw >= float(p["downtune_min_confidence"])
    )
    if len(low) < int(p["downtune_min_notes"]):
        return 0
    return min(int(p["downtune_max"]), OPEN_PITCH[0] - low[len(low) // 10])


def excerpt(mono: NDArray[np.float32], seconds: float) -> NDArray[np.float32]:
    """`mono`, or for a longer recording `seconds` of it: three equal pieces from its start,
    middle and end, joined."""
    size = int(seconds * RATE / 3)
    if len(mono) <= 3 * size:
        return mono
    starts = [i * (len(mono) - size) // 2 for i in range(3)]
    return np.concatenate([mono[a : a + size] for a in starts])


def open_share(notes: list[RawNote]) -> float:
    """Share of note time on open strings."""
    total = sum(n.end - n.start for n in notes)
    return sum(n.end - n.start for n in notes if n.fret == 0) / total if total else 0.0


def open_shift(shares: list[float], p: dict[str, Any]) -> tuple[int, float]:
    """(semitones, confidence) from the open-string share of Guitab's notes on the input raised by
    0, 1, … semitones: a guitar tuned k semitones down rings its open strings only once raised by k
    (P2g fit split: 5 % of note time at the true shift, under 1 % elsewhere). Fires only on clear
    evidence (a wrong tuning moves every fret), else (0, 0)."""
    k = max(range(1, len(shares)), key=lambda i: shares[i])
    unshifted, best = shares[0], shares[k]
    if (
        best >= float(p["downtune_open_min"])
        and best - unshifted >= float(p["downtune_open_margin"])
        and best >= float(p["downtune_open_ratio"]) * unshifted
    ):
        return k, round(best / (sum(shares) or 1.0), 3)
    return 0, 0.0


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


def extend_offsets(notes: list[RawNote], tab: NDArray[np.float32], threshold: float) -> None:
    """Each note's end moved on while its string's activity stays above `threshold`, up to the next
    note on that string: the frame threshold that ends a note for segmentation cuts a ringing
    note short (step 27: onset+offset F1), and starts stay as they were."""
    total = len(tab)
    for col in range(6):
        on_string = sorted((n for n in notes if n.col == col), key=lambda n: n.start)
        for i, n in enumerate(on_string):
            limit = on_string[i + 1].start if i + 1 < len(on_string) else total
            while n.end < limit and 1.0 - float(tab[n.end, col, 0]) > threshold:
                n.end += 1


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
        # Passes of the recording being transcribed: the down-tuning check (tuning_shift) and
        # transcribe share the unshifted E25 pass and the bend pass; transcribe drops them.
        self._memo: dict[tuple[Any, ...], Any] = {}

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

    def remembered[T](
        self, mono: NDArray[np.float32], key: tuple[Any, ...], compute: Callable[[], T]
    ) -> T:
        """compute() for `mono`, kept until transcribe is done or another recording comes."""
        digest = hashlib.blake2b(mono.tobytes(), digest_size=16).digest()
        with self._lock:
            if (digest, *key) in self._memo:
                return cast(T, self._memo[(digest, *key)])
        value = compute()
        with self._lock:
            if any(k[0] != digest for k in self._memo):
                self._memo.clear()
            self._memo[(digest, *key)] = value
        return value

    def posteriors(
        self, mono: NDArray[np.float32], retune: float
    ) -> tuple[NDArray[np.float32], NDArray[np.float32], float]:
        """(tab, onset, stretch) of E25 on `mono` retuned by `retune` cents (tape speed; offsets
        under A4_MIN_CENTS are left alone)."""

        def compute() -> tuple[NDArray[np.float32], NDArray[np.float32], float]:
            audio, stretch = mono, 1.0
            if abs(retune) >= A4_MIN_CENTS:
                audio, stretch = tuning.retuned(mono, retune)
            tab, onset = predict(self.session(), features(audio))
            return tab, onset, stretch

        return self.remembered(mono, ("pass", round(retune, 3)), compute)

    @staticmethod
    def raw_notes(
        tab: NDArray[np.float32], onset: NDArray[np.float32], params: dict[str, Any]
    ) -> list[RawNote]:
        notes = extract(tab, onset, params)
        if params.get("extend_threshold") is not None:
            extend_offsets(notes, tab, float(params["extend_threshold"]))
        return notes

    def bend_pass(self, mono: NDArray[np.float32], params: dict[str, Any]) -> list[NoteEvent]:
        """Basic Pitch's notes with their bend curves (Guitab has no pitch contour)."""
        bend = {
            "a4_cents": float(params.get("a4_cents") or 0.0),
            "bends": True,
            "bend_min_cents": params["bend_min_cents"],
            "bend_min_glide_frames": params["bend_min_glide_frames"],
        }
        return self.remembered(
            mono,
            ("bends", *bend.values()),
            lambda: get("basic_pitch").transcribe(
                mono, {**BASIC_PITCH_DEFAULTS, **BEND_PASS, **bend}
            ),
        )

    def tuning_shift(self, mono: NDArray[np.float32], params: dict[str, Any]) -> tuple[int, float]:
        """(semitones below standard, confidence) of the recording: the open-string cue
        (open_shift) or, failing that, sustained notes below E2 (low_shift, confidence 0.5)."""
        cents = float(params.get("a4_cents") or 0.0)
        heard = excerpt(mono, float(params["downtune_max_s"]))
        shares: list[float] = []
        for k in range(int(params["downtune_max"]) + 1):
            tab, onset, _ = self.posteriors(heard, cents - 100.0 * k)
            shares.append(open_share(extract(tab, onset, params)))
        shift, confidence = open_shift(shares, params)
        if shift == 0:
            low = low_shift(self.bend_pass(mono, params), params)
            if low:
                return low, 0.5
        return shift, confidence

    def transcribe(self, mono: NDArray[np.float32], params: dict[str, Any]) -> list[NoteEvent]:
        cents = float(params.get("a4_cents") or 0.0)
        # A recording tuned `shift` semitones down is raised by as much, so its open strings
        # land on Guitab's standard ones; the notes come back down by as much (strings unchanged).
        shift = int(params.get("tuning_shift") or 0)
        tab, onset, stretch = self.posteriors(mono, cents - 100.0 * shift)
        frames = int(params["fret_frames"])
        notes = [
            NoteEvent(
                onset_s=n.start / FPS / stretch,
                offset_s=n.end / FPS / stretch,
                pitch_midi=n.pitch - shift,
                velocity=int(np.clip(round(127 * n.score), 1, 127)),
                confidence_raw=min(1.0, max(0.0, n.score)),
                string_probs=string_probs(tab, n, frames) if params["string_cue"] else None,
            )
            for n in self.raw_notes(tab, onset, params)
        ]
        if params["bends"]:
            notes = with_bends(notes, [e for e in self.bend_pass(mono, params) if e.bend_cents])
        with self._lock:
            self._memo.clear()
        return notes
