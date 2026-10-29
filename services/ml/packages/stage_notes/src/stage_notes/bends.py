"""Bends from Basic Pitch's pitch contour (07 §6.1, step 22 Phase 5).

Basic Pitch decodes a bent note as a run of fragments a semitone apart (62, 63, 64 for a whole-step
bend of D). Its contour head (3 bins per semitone, interpolated here) follows the bend: a bend
glides through the pitches between the fragments for several frames, while a hammer-on, a slide
between frets or a new pick jumps. A note whose contour glides up by at least `min_cents` becomes
one note at the picked pitch with the curve as `bend_cents`; the fragments on its glide are
absorbed. On a fast bend Basic Pitch often misses the picked pitch altogether and starts the note
on the first fragment: such a note is first tried from the pick below it (an onset with no note of
its own), kept if the whole note then glides. Vibrato swings less than a bend (around 30-50 cents
on guitar) and is left alone.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import cast

import numpy as np
from numpy.typing import NDArray
from scipy.ndimage import median_filter  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]

from . import basic_pitch as bp

BINS_PER_SEMITONE = 3
MAX_SEMITONES = 3  # the widest bend followed (a step and a half)
CONTOUR_FLOOR = 0.3  # contour activation below this is unvoiced
LOOKBACK_FRAMES = 10  # how far before a note a pick gliding into it is looked for (116 ms)
GAP_FRAMES = 3  # a fragment may start this long after the note's (absorbed) end
ON_PITCH_CENTS = 50.0  # the glide is this close to a fragment's pitch when the fragment starts
PLATEAU_FRAMES = 6  # a semitone held this long on the way up is a fretted note (70 ms)
POINT_STEP_CENTS = 20.0  # bend_cents keeps a point each time the curve moves this far


@dataclass(frozen=True)
class Bent:
    note: bp.RawNote  # the merged note: the picked pitch, ending where its last fragment ends
    curve: tuple[tuple[int, float], ...]  # (frames after the note's start, cents), () = not bent


def smoothed(values: NDArray[np.float64]) -> NDArray[np.float64]:
    """3-frame median: one stray frame of the contour neither starts nor ends a glide."""
    return cast(NDArray[np.float64], median_filter(values, size=3, mode="nearest"))


def track(contour: bp.Float, start: int, end: int, pitch: int) -> NDArray[np.float64]:
    """Cents above `pitch` per frame of [start, end), NaN where unvoiced: the strongest contour
    bin from a third of a semitone below the pitch to MAX_SEMITONES above it."""
    centre = BINS_PER_SEMITONE * (pitch - bp.MIDI_OFFSET) + 1  # a semitone's middle bin
    lo = max(centre - 1, 1)
    hi = min(centre + BINS_PER_SEMITONE * MAX_SEMITONES + 1, contour.shape[1] - 1)
    out = np.full(end - start, np.nan)
    for i, frame in enumerate(range(start, min(end, contour.shape[0]))):
        row = contour[frame]
        k = lo + int(np.argmax(row[lo:hi]))
        if row[k] < CONTOUR_FLOOR:
            continue
        a, b, c = float(row[k - 1]), float(row[k]), float(row[k + 1])
        curvature = a - 2 * b + c
        delta = 0.5 * (a - c) / curvature if abs(curvature) > 1e-9 else 0.0
        out[i] = (k + float(np.clip(delta, -0.5, 0.5)) - centre) * 100 / BINS_PER_SEMITONE
    return out


def glided(cents: NDArray[np.float64], min_cents: float, min_glide_frames: int) -> float:
    """The bend's height in cents if `cents` (one note's track) rises by at least `min_cents`
    through at least `min_glide_frames` frames strictly between the start and the top, voiced all
    the way and without a plateau, else 0."""
    frames = np.flatnonzero(np.isfinite(cents))
    if frames.size < min_glide_frames + 2:
        return 0.0
    smooth = smoothed(cents[frames])
    peak = int(np.argmax(smooth))
    top = float(smooth[peak])
    lowest = int(np.argmin(smooth[: max(2, peak)]))
    base = float(smooth[lowest])
    if top - base < min_cents:
        return 0.0
    between = (smooth > base + 25.0) & (smooth < top - 25.0)
    if int(np.sum(between)) < min_glide_frames or plateaued(smooth, base, top):
        return 0.0
    if frames[peak] - frames[lowest] != peak - lowest:
        return 0.0  # an unvoiced gap on the way up is a new pick, not a bend
    return top - base


def plateaued(smooth: NDArray[np.float64], base: float, top: float) -> bool:
    """Whether the rise holds a semitone between `base` and `top` for PLATEAU_FRAMES: a chromatic
    legato run (or a slide that stops on a fret) climbs in held steps, a bend does not."""
    rise = smooth[: int(np.argmax(smooth)) + 1]
    for step in range(1, MAX_SEMITONES + 1):
        level = 100.0 * step
        if not base + 50.0 < level < top - 50.0:
            continue
        held = np.abs(rise - level) <= 30.0
        run = 0
        for on in held.tolist():
            run = run + 1 if on else 0
            if run >= PLATEAU_FRAMES:
                return True
    return False


def merged(
    posteriors: bp.Posteriors,
    notes: list[bp.RawNote],
    *,
    onset_thresh: float,
    min_cents: float,
    min_glide_frames: int,
) -> list[Bent]:
    """`notes` with bent notes merged with their fragments (see the module docstring)."""
    ordered = sorted(notes, key=lambda n: (n.start, n.pitch_midi))
    absorbed: set[int] = set()
    out: list[Bent] = []
    for i, picked in enumerate(ordered):
        if i in absorbed:
            continue
        bent = Bent(picked, ())
        for head in dict.fromkeys((glided_in(posteriors, picked, ordered, onset_thresh), picked)):
            fragments = fragments_of(posteriors.contour, head, ordered, i, absorbed)
            end = max([head.end, *(ordered[j].end for j in fragments)])
            cents = track(posteriors.contour, head.start, end, head.pitch_midi)
            if glided(cents, min_cents, min_glide_frames) > 0.0:
                absorbed.update(fragments)
                whole = bp.RawNote(head.start, end, head.pitch_midi, head.amplitude)
                bent = Bent(whole, points(cents))
                break
        out.append(bent)
    return out


def fragments_of(
    contour: bp.Float, head: bp.RawNote, ordered: list[bp.RawNote], i: int, absorbed: set[int]
) -> list[int]:
    """Indices of the notes after `ordered[i]` that sit on `head`'s contour: up to MAX_SEMITONES
    above it, starting before its (growing) end, where the contour is at their pitch."""
    end = head.end
    fragments: list[int] = []
    grew = True
    while grew:
        grew = False
        cents = track(contour, head.start, end + GAP_FRAMES + 2, head.pitch_midi)
        for j in range(i + 1, len(ordered)):
            other = ordered[j]
            if other.start > end + GAP_FRAMES:
                break
            step = other.pitch_midi - head.pitch_midi
            if j in absorbed or j in fragments or not 1 <= step <= MAX_SEMITONES:
                continue
            at = cents[other.start - head.start : other.start - head.start + 3]
            if np.any(np.abs(at - 100 * step) <= ON_PITCH_CENTS):
                fragments.append(j)
                end = max(end, other.end)
                grew = True
    return fragments


def glided_in(
    posteriors: bp.Posteriors, note: bp.RawNote, notes: list[bp.RawNote], onset_thresh: float
) -> bp.RawNote:
    """`note` moved back to a pick that may glide into it: the strongest onset peak of at least
    `onset_thresh` up to MAX_SEMITONES below it in the LOOKBACK_FRAMES before it, with no note of
    its own (the decoder clears a note's neighbouring semitones, so the fragment above eats the
    picked note). Whether it glides is `merged`'s call. Otherwise `note` itself."""
    first = max(0, note.start - LOOKBACK_FRAMES)
    best: bp.RawNote = note
    strongest = onset_thresh
    for step in range(1, MAX_SEMITONES + 1):
        pitch = note.pitch_midi - step
        onsets = posteriors.onset[first : note.start, pitch - bp.MIDI_OFFSET]
        if onsets.size == 0 or float(np.max(onsets)) < strongest:
            continue
        start = first + int(np.argmax(onsets))
        if any(o.pitch_midi == pitch and abs(o.start - start) <= GAP_FRAMES for o in notes):
            continue
        strongest = float(np.max(onsets))
        best = bp.RawNote(start, note.end, pitch, note.amplitude)
    return best


def points(cents: NDArray[np.float64]) -> tuple[tuple[int, float], ...]:
    """The smoothed curve thinned to the frames where it has moved POINT_STEP_CENTS since the
    last kept point, plus its top and its last frame."""
    frames = np.flatnonzero(np.isfinite(cents))
    smooth = smoothed(cents[frames])
    top = int(np.argmax(smooth))
    kept = [0]
    for k in range(1, len(frames)):
        if k == top or abs(smooth[k] - smooth[kept[-1]]) >= POINT_STEP_CENTS:
            kept.append(k)
    if kept[-1] != len(frames) - 1:
        kept.append(len(frames) - 1)
    return tuple((int(frames[k]), round(float(smooth[k]), 1)) for k in kept)
