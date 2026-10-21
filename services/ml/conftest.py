"""Shared pytest fixtures: environment from the repo's .env (or .env.example) and owned,
synthetic test audio (no recordings are committed)."""

from __future__ import annotations

import os
from collections.abc import Callable
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from dotenv import dotenv_values

REPO = Path(__file__).resolve().parents[2]


def _load_env() -> dict[str, str]:
    for name in (".env", ".env.example"):
        path = REPO / name
        if path.is_file():
            values = {k: v for k, v in dotenv_values(path).items() if v is not None}
            return {**values, **os.environ}
    return dict(os.environ)


ENV = _load_env()
# In-process stage tests resolve ffmpeg the way islands do.
if ENV.get("FFMPEG_BIN_DIR"):
    os.environ.setdefault("FFMPEG_BIN_DIR", ENV["FFMPEG_BIN_DIR"])

ClickTrack = Callable[..., Path]


def render_click_track(
    path: Path,
    *,
    bpm: float = 120.0,
    seconds: float = 12.0,
    beats_per_bar: int = 4,
    sample_rate: int = 44100,
    offset_s: float = 0.5,
    seed: int = 0,
    plucked_bass: bool = False,
) -> list[float]:
    """A drum-like pattern (kick on downbeats, snare on backbeats, hats on eighths) plus a bass
    tone; returns the beat times. Deterministic for a given seed. The default bass is a quiet
    110 Hz sine that PANNs doesn't hear as bass; `plucked_bass` plays a plucked A2 string on every
    beat instead, which it does (≈ 0.06, above separation's keep_min_prob, drums still ≈ 0.3)."""
    rng = np.random.default_rng(seed)
    n = int(seconds * sample_rate)
    audio = np.zeros(n, dtype=np.float64)
    t = np.arange(int(0.25 * sample_rate)) / sample_rate

    def hit(at: float, kind: str) -> None:
        start = int(at * sample_rate)
        if start >= n:
            return
        if kind == "kick":
            tone = np.sin(2 * np.pi * (55 + 90 * np.exp(-t * 30)) * t) * np.exp(-t * 12)
        elif kind == "snare":
            tone = rng.normal(0, 0.6, t.size) * np.exp(-t * 25) + 0.3 * np.sin(
                2 * np.pi * 190 * t
            ) * np.exp(-t * 20)
        else:
            tone = rng.normal(0, 0.15, t.size) * np.exp(-t * 80)
        end = min(n, start + tone.size)
        audio[start:end] += tone[: end - start]

    period = 60.0 / bpm
    beats: list[float] = []
    k = 0
    while (at := offset_s + k * period) < seconds - 0.3:
        beats.append(round(at, 6))
        hit(at, "kick" if k % beats_per_bar == 0 else "snare" if k % 2 else "hat")
        hit(at + period / 2, "hat")
        k += 1
    if plucked_bass:
        # Karplus-Strong: a noise burst one period long, recirculated through a damped average.
        note, wave = int(period * sample_rate), round(sample_rate / 110)
        for at in beats:
            string = np.zeros(1 + note)  # string[0] = 0 seeds the first average
            string[1 : 1 + wave] = rng.uniform(-1, 1, wave)
            for i in range(1 + wave, string.size, wave):
                m = min(wave, string.size - i)
                string[i : i + m] = 0.498 * (
                    string[i - wave : i - wave + m] + string[i - wave - 1 : i - wave - 1 + m]
                )
            start = int(at * sample_rate)
            end = min(n, start + note)
            audio[start:end] += 0.15 * string[1 : 1 + end - start]
    else:
        whole = np.arange(n) / sample_rate
        audio += 0.08 * np.sin(2 * np.pi * 110 * whole)
    audio = 0.5 * audio / max(1e-9, float(np.max(np.abs(audio))))
    stereo = np.stack([audio, audio * 0.9], axis=1).astype(np.float32)
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), stereo, sample_rate)  # pyright: ignore[reportUnknownMemberType]
    return beats


@pytest.fixture
def click_track(tmp_path: Path) -> ClickTrack:
    def make(name: str = "click.wav", **kwargs: float) -> Path:
        path = tmp_path / name
        render_click_track(path, **kwargs)  # pyright: ignore[reportArgumentType]
        return path

    return make
