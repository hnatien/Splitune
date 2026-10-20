"""AudioSet class indices (class_labels_indices.csv) behind each Splitune instrument."""

from __future__ import annotations

from typing import Literal

Instrument = Literal["guitar", "bass", "piano", "drums", "vocals"]
Subtype = Literal["acoustic_guitar", "electric_guitar", "piano", "synth_keys", "organ"]

# An instrument's probability in a window is the max over its classes.
CLASSES: dict[Instrument, tuple[int, ...]] = {
    # Guitar, Electric guitar, Acoustic guitar, Steel guitar, Tapping, Strum
    "guitar": (140, 141, 143, 144, 145, 146),
    # Bass guitar, Double bass
    "bass": (142, 194),
    # Keyboard (musical), Piano, Electric piano, Organ, Electronic organ, Hammond organ,
    # Synthesizer, Harpsichord: the "piano" part covers keys generally; the subtype narrows it.
    "piano": (152, 153, 154, 155, 156, 157, 158, 160),
    # Drum kit, Drum machine, Drum, Snare drum, Bass drum, Cymbal, Hi-hat
    "drums": (162, 163, 164, 165, 168, 171, 172),
    # Singing, Male/Female singing, Choir, Rapping, Vocal music
    "vocals": (27, 28, 32, 33, 36, 254),
}

SUBTYPES: dict[Instrument, dict[Subtype, tuple[int, ...]]] = {
    "guitar": {"electric_guitar": (141,), "acoustic_guitar": (143, 144)},
    "piano": {"piano": (153, 154, 160), "synth_keys": (158,), "organ": (155, 156, 157)},
}
