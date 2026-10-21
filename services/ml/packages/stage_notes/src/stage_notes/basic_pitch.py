# Ported from spotify/basic-pitch 0.4.0 (basic_pitch/constants.py, inference.py,
# note_creation.py): Copyright 2022 Spotify AB, Apache License 2.0
# (http://www.apache.org/licenses/LICENSE-2.0). Changes: numpy/scipy only (no librosa, resampy,
# pretty_midi or TensorFlow), ONNX Runtime session passed in, the raw onset posterior kept per note
# for confidence, typed for pyright strict.
"""Basic Pitch (ICASSP 2022) inference on its bundled `nmp.onnx` and note decoding."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, cast

import numpy as np
import onnxruntime as ort  # pyright: ignore[reportMissingTypeStubs]
from numpy.typing import NDArray
from scipy.signal import argrelmax  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]

FFT_HOP = 256
AUDIO_SAMPLE_RATE = 22050
AUDIO_WINDOW_LENGTH = 2  # s
ANNOTATIONS_FPS = AUDIO_SAMPLE_RATE // FFT_HOP  # 86
ANNOT_N_FRAMES = ANNOTATIONS_FPS * AUDIO_WINDOW_LENGTH
AUDIO_N_SAMPLES = AUDIO_SAMPLE_RATE * AUDIO_WINDOW_LENGTH - FFT_HOP
N_OVERLAPPING_FRAMES = 30
OVERLAP_LEN = N_OVERLAPPING_FRAMES * FFT_HOP
HOP_SIZE = AUDIO_N_SAMPLES - OVERLAP_LEN
MIDI_OFFSET = 21
MAX_FREQ_IDX = 87
ENERGY_TOL = 11
BATCH = 16

Float = NDArray[np.float32]


@dataclass(frozen=True)
class Posteriors:
    note: Float  # (n_frames, 88) frame activations
    onset: Float  # (n_frames, 88)
    contour: Float  # (n_frames, 264)


@dataclass(frozen=True)
class RawNote:
    start: int  # frame index
    end: int  # frame index (exclusive)
    pitch_midi: int
    amplitude: float  # mean frame activation over the note


def windows(audio: Float) -> Float:
    """Mono 22.05 kHz audio → (n_windows, AUDIO_N_SAMPLES, 1), half an overlap of zeros first."""
    padded = np.concatenate([np.zeros(OVERLAP_LEN // 2, dtype=np.float32), audio])
    starts = range(0, len(padded), HOP_SIZE)
    out = np.zeros((len(starts), AUDIO_N_SAMPLES, 1), dtype=np.float32)
    for k, i in enumerate(starts):
        chunk = padded[i : i + AUDIO_N_SAMPLES]
        out[k, : len(chunk), 0] = chunk
    return out


def unwrap(output: Float, original_length: int) -> Float:
    """(n_windows, frames, bins) → (n_frames, bins) without the overlaps, trimmed to the audio."""
    half = N_OVERLAPPING_FRAMES // 2
    output = output[:, half:-half, :]
    n_frames = int(np.floor(original_length * (ANNOTATIONS_FPS / AUDIO_SAMPLE_RATE)))
    return output.reshape(-1, output.shape[2])[:n_frames]


def infer(session: ort.InferenceSession, audio: Float) -> Posteriors:
    batches = windows(audio)
    parts: dict[str, list[Float]] = {"note": [], "onset": [], "contour": []}
    for i in range(0, len(batches), BATCH):
        results = cast(
            list[Float],
            session.run(  # pyright: ignore[reportUnknownMemberType]
                [
                    "StatefulPartitionedCall:1",
                    "StatefulPartitionedCall:2",
                    "StatefulPartitionedCall:0",
                ],
                {"serving_default_input_2:0": batches[i : i + BATCH]},
            ),
        )
        for name, value in zip(("note", "onset", "contour"), results, strict=True):
            parts[name].append(value)
    return Posteriors(
        **{k: unwrap(np.concatenate(v), len(audio)).astype(np.float32) for k, v in parts.items()}
    )


def hz_to_midi(hz: float) -> float:
    return 12 * (np.log2(hz) - np.log2(440.0)) + 69


def constrain_frequency(
    onsets: Float, frames: Float, max_freq: float | None, min_freq: float | None
) -> None:
    if max_freq is not None:
        idx = round(hz_to_midi(max_freq) - MIDI_OFFSET)
        onsets[:, idx:] = 0
        frames[:, idx:] = 0
    if min_freq is not None:
        idx = round(hz_to_midi(min_freq) - MIDI_OFFSET)
        onsets[:, :idx] = 0
        frames[:, :idx] = 0


def inferred_onsets(onsets: Float, frames: Float, n_diff: int = 2) -> Float:
    """Adds onsets where frame activations jump (re-attacks the onset head misses)."""
    diffs: list[Float] = []
    for n in range(1, n_diff + 1):
        appended = np.concatenate([np.zeros((n, frames.shape[1]), dtype=np.float32), frames])
        diffs.append(appended[n:, :] - appended[:-n, :])
    frame_diff = np.min(diffs, axis=0)
    frame_diff[frame_diff < 0] = 0
    frame_diff[:n_diff, :] = 0
    peak = float(np.max(frame_diff))
    if peak > 0:
        frame_diff = float(np.max(onsets)) * frame_diff / peak
    return np.max([onsets, frame_diff], axis=0).astype(np.float32)


def _clear(energy: Float, t0: int, t1: int, f: int) -> None:
    energy[t0:t1, f] = 0
    if f < MAX_FREQ_IDX:
        energy[t0:t1, f + 1] = 0
    if f > 0:
        energy[t0:t1, f - 1] = 0


def notes_polyphonic(
    posteriors: Posteriors,
    *,
    onset_thresh: float,
    frame_thresh: float,
    min_note_len: int,
    min_freq: float | None,
    max_freq: float | None,
    infer_onsets: bool = True,
    melodia_trick: bool = True,
) -> list[RawNote]:
    frames = posteriors.note.copy()
    onsets = posteriors.onset.copy()
    n_frames = frames.shape[0]
    constrain_frequency(onsets, frames, max_freq, min_freq)
    if infer_onsets:
        onsets = inferred_onsets(onsets, frames)

    peak_mat = np.zeros(onsets.shape, dtype=np.float32)
    peaks = cast(tuple[NDArray[np.intp], NDArray[np.intp]], argrelmax(onsets, axis=0))
    peak_mat[peaks] = onsets[peaks]
    onset_t, onset_f = np.where(peak_mat >= onset_thresh)
    remaining = frames.copy()
    notes: list[RawNote] = []
    for start, f in zip(onset_t[::-1].tolist(), onset_f[::-1].tolist(), strict=True):
        if start >= n_frames - 1:
            continue
        i, k = start + 1, 0
        while i < n_frames - 1 and k < ENERGY_TOL:
            k = k + 1 if remaining[i, f] < frame_thresh else 0
            i += 1
        i -= k
        if i - start <= min_note_len:
            continue
        _clear(remaining, start, i, f)
        notes.append(RawNote(start, i, f + MIDI_OFFSET, float(np.mean(frames[start:i, f]))))

    if melodia_trick:
        while float(np.max(remaining)) > frame_thresh:
            mid, f = (int(v) for v in np.unravel_index(int(np.argmax(remaining)), remaining.shape))
            remaining[mid, f] = 0
            i, k = mid + 1, 0
            while i < n_frames - 1 and k < ENERGY_TOL:
                k = k + 1 if remaining[i, f] < frame_thresh else 0
                _clear(remaining, i, i + 1, f)
                i += 1
            end = i - 1 - k
            i, k = mid - 1, 0
            while i > 0 and k < ENERGY_TOL:
                k = k + 1 if remaining[i, f] < frame_thresh else 0
                _clear(remaining, i, i + 1, f)
                i -= 1
            begin = i + 1 + k
            if end - begin <= min_note_len:
                continue
            notes.append(RawNote(begin, end, f + MIDI_OFFSET, float(np.mean(frames[begin:end, f]))))
    return notes


def frame_times(n_frames: int) -> NDArray[np.float64]:
    """Frame index → seconds, with Basic Pitch's per-window offset correction."""
    original = np.arange(n_frames) * FFT_HOP / AUDIO_SAMPLE_RATE
    window_numbers = np.floor(np.arange(n_frames) / ANNOT_N_FRAMES)
    offset = (FFT_HOP / AUDIO_SAMPLE_RATE) * (ANNOT_N_FRAMES - AUDIO_N_SAMPLES / FFT_HOP) + 0.0018
    return original - offset * window_numbers


def onset_posterior(posteriors: Posteriors, note: RawNote, frames: int = 3) -> float:
    """Mean model onset posterior over the note's first frames at its pitch (06 §4 confidence)."""
    f = note.pitch_midi - MIDI_OFFSET
    return float(np.mean(posteriors.onset[note.start : note.start + frames, f]))


def min_note_frames(ms: float) -> int:
    return round(ms / 1000 * (AUDIO_SAMPLE_RATE / FFT_HOP))


def session_options(threads: int) -> Any:
    options = ort.SessionOptions()  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]
    options.intra_op_num_threads = threads
    return options  # pyright: ignore[reportUnknownVariableType]
