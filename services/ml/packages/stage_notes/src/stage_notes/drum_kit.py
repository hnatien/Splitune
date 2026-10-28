"""Drum classes and kit pieces: the one place that maps transcriber output to General MIDI
percussion numbers (05 `DrumHit`: `class5`, `gm_note`, `approximate`).

A 5-class transcriber (ADTOF) can't tell open from closed hi-hat, crash from ride or one tom from
another, so those choices follow the research defaults (`docs/research/ml/transcription-drums.md`
§4) and are flagged `approximate`: hi-hat → closed, toms → one line, cymbals → crash on a bar's
first beat after a cymbal gap, ride otherwise. A transcriber that names the kit piece itself
(YourMT3+) keeps its GM note.
"""

from __future__ import annotations

import bisect
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

Class5 = Literal["kick", "snare", "hihat", "toms", "cymbals"]
CLASSES: tuple[Class5, ...] = ("kick", "snare", "hihat", "toms", "cymbals")

KICK, SNARE = 36, 38
HIHAT_CLOSED, HIHAT_PEDAL, HIHAT_OPEN = 42, 44, 46
TOM_HIGH, TOM_MID, TOM_LOW, TOM_FLOOR = 50, 47, 45, 43
CRASH, RIDE, RIDE_BELL = 49, 51, 53

# GM percussion keys of a drum kit → class (ADTOF's 5-class merge). Hand percussion (tambourine,
# cowbell, congas, ...) has no class and is dropped.
GM_CLASS: dict[int, Class5] = {
    35: "kick",
    36: "kick",
    37: "snare",  # side stick
    38: "snare",
    39: "snare",  # hand clap: drum machines put it on the snare line
    40: "snare",
    41: "toms",
    43: "toms",
    45: "toms",
    47: "toms",
    48: "toms",
    50: "toms",
    42: "hihat",
    44: "hihat",
    46: "hihat",
    49: "cymbals",
    51: "cymbals",
    52: "cymbals",
    53: "cymbals",
    55: "cymbals",
    57: "cymbals",
    59: "cymbals",
}

# Kit piece per GM key, for scoring kit-piece choices: open/closed/pedal hi-hat, crash/ride and
# high/mid/low/floor tom (China and splash count as crashes, ride 2 as ride).
KIT_PIECE: dict[int, str] = {
    42: "hh_closed",
    44: "hh_pedal",
    46: "hh_open",
    49: "crash",
    52: "crash",
    55: "crash",
    57: "crash",
    51: "ride",
    59: "ride",
    53: "ride_bell",
    48: "tom_high",
    50: "tom_high",
    45: "tom_low",
    47: "tom_mid",
    41: "tom_floor",
    43: "tom_floor",
}

DEFAULT_GM: dict[Class5, int] = {
    "kick": KICK,
    "snare": SNARE,
    "hihat": HIHAT_CLOSED,
    "toms": TOM_MID,
    "cymbals": RIDE,
}


@dataclass(frozen=True)
class KitChoice:
    gm_note: int
    approximate: bool


def class_of(gm_note: int) -> Class5 | None:
    return GM_CLASS.get(gm_note)


def downbeat_near(t: float, downbeats: Sequence[float], tolerance_s: float) -> bool:
    i = bisect.bisect_left(downbeats, t)
    near = [downbeats[j] for j in (i - 1, i) if 0 <= j < len(downbeats)]
    return any(abs(t - d) <= tolerance_s for d in near)


def default_choices(
    hits: Sequence[tuple[float, Class5]],
    downbeats: Sequence[float] | None,
    gap_s: float,
    downbeat_tolerance_s: float = 0.07,
) -> list[KitChoice]:
    """Kit pieces for 5-class hits (onset, class), in input order. A cymbal is a crash when the
    previous cymbal is at least `gap_s` earlier and it falls on a bar's first beat (any time when
    the song has no beats)."""
    choices: list[KitChoice] = []
    last_cymbal: float | None = None
    for onset, cls in hits:
        if cls in ("kick", "snare"):
            choices.append(KitChoice(DEFAULT_GM[cls], approximate=False))
            continue
        if cls != "cymbals":
            choices.append(KitChoice(DEFAULT_GM[cls], approximate=True))
            continue
        after_gap = last_cymbal is None or onset - last_cymbal >= gap_s
        on_downbeat = downbeats is None or downbeat_near(onset, downbeats, downbeat_tolerance_s)
        choices.append(KitChoice(CRASH if after_gap and on_downbeat else RIDE, approximate=True))
        last_cymbal = onset
    return choices
