"""The tagger's keys verdict on separation windows (step 29 Phase 5: the keys fallback's tagger
condition).

    uv run python eval/keys_tags.py --root DIR [--clips SET] --out FILE.json

Runs the shipped tag stage's model the way the stage does (`stage_tagger.stage`: mono, 32 kHz,
10 s windows, top-quarter mean) on each window's mixture and records what `tags.json` carries for
piano (`present_prob`, the winning `subtype`) plus the three subtype scores behind that choice
(piano, synth_keys, organ), which the contract does not carry.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf  # pyright: ignore[reportMissingTypeStubs]
from scipy.signal import resample_poly  # pyright: ignore[reportMissingTypeStubs, reportUnknownVariableType]
from splitune_eval.registry import load_set


def verdict(mixture: Path) -> dict[str, Any]:
    from stage_tagger import labels, stage

    params = stage.DEFAULTS
    data, rate = sf.read(str(mixture), dtype="float32", always_2d=True)
    mono = np.asarray(data, dtype=np.float32).mean(axis=1)
    resampled = np.asarray(resample_poly(mono, stage.MODEL_RATE, int(rate)), dtype=np.float32)  # pyright: ignore[reportUnknownArgumentType]
    batch = stage.windows(resampled, float(params["window_s"]), float(params["min_last_window_s"]))
    clipwise = stage.infer(batch)
    fraction = float(params["top_fraction"])
    piano = next(e for e in stage.summarise(clipwise, fraction) if e["instrument"] == "piano")
    scores = {
        name: round(stage.top_mean(clipwise[:, list(idx)].max(axis=1), fraction), 4)
        for name, idx in labels.SUBTYPES["piano"].items()
    }
    return {"present_prob": piano["present_prob"], "subtype": piano["subtype"], "scores": scores}


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--root", required=True)
    p.add_argument("--clips", help="only this set's clips (default: every window)")
    p.add_argument("--out", required=True)
    args = p.parse_args(argv)
    root = Path(args.root).expanduser()
    if args.clips:
        clips = [i.id for i in load_set(args.clips).resolved_items()]
    else:
        clips = sorted(json.loads((root / "windows.json").read_text(encoding="utf-8"))["items"])
    out = {clip: verdict(root / clip / "mixture.wav") for clip in clips}
    Path(args.out).write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8", newline="\n")
    for clip, v in out.items():
        print(clip, v, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
