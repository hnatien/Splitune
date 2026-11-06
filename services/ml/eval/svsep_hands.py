"""Cluster and Separate (Foscarin et al., ISMIR 2024; github.com/CPJKU/piano_svsep) staff
prediction on ASAP scores, for `p2p.py hands` (step 26).

    D:/venvs/svsep/Scripts/python.exe eval/svsep_hands.py REPO ASAP OUT.json

Runs in its own venv (torch 2.8 + torch_geometric + torch-scatter + partitura 1.8, `pip install
-e REPO`). The model needs a quantized score, not performance MIDI, so it reads each piece's
`xml_score.musicxml` the way the repo's `launch_scripts/predict.py` prepares it (ties across bar
lines split, beams, rests and grace notes removed; staff is not an input feature) and is scored
against that score's own staves: staff 1 = treble = right hand, as in `p2p.py hands`.
OUT.json: one row per piece (piece, notes, correct).
"""

# piano_svsep and partitura are untyped and only installed in their own venv.
# pyright: reportMissingImports=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import torch
import torch_geometric as pyg


def main() -> int:
    repo, asap, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    sys.path.insert(0, str(repo / "launch_scripts"))
    from piano_svsep.models.pl_models import PLPianoSVSep
    from predict import prepare_score

    model = PLPianoSVSep.load_from_checkpoint(
        str(repo / "pretrained_models" / "model.ckpt"),
        map_location="cpu",
        strict=False,
        weights_only=False,
    )
    model.module.eval()
    rows: list[dict[str, object]] = []
    for score in sorted(asap.rglob("xml_score.musicxml")):
        piece = score.parent.relative_to(asap).as_posix()
        try:
            graph, parsed, _ = prepare_score(str(score))
        except Exception as e:
            print(f"svsep {piece}: skipped ({type(e).__name__})", flush=True)
            continue
        truth = np.asarray(parsed[0].note_array(include_staff=True)["staff"])
        batch = pyg.data.Batch.from_data_list([graph])
        with torch.no_grad():
            _, staff, _ = model.predict_step(batch, return_graph=True)
        predicted = np.asarray(staff.cpu().numpy()).reshape(-1) + 1
        correct = int(np.sum(predicted == truth))
        rows.append({"piece": piece, "notes": len(truth), "correct": correct})
        print(f"svsep {piece}: {correct / max(1, len(truth)):.3f}", flush=True)
    out.write_text(json.dumps(rows, indent=1), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
