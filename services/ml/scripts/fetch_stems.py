"""Downloads an analysis's stem encodes for the browser decode check.

    uv run python scripts/fetch_stems.py ANALYSIS_ID OUT_DIR [--user test-user] [--version 1]
    DECODE_CHECK_DIR=OUT_DIR pnpm --filter @splitune/ml e2e

Writes every file stems.json references, plus `expected.json` in the format of
scripts/decode_fixtures.py: the expected length is the analysis' decoded PCM length
(`probe.decoded_frames`), and the offset reference is ffmpeg's decode of the AAC file, whose start
`stem_post` already verified against the PCM.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from splitune_ml_core import artefacts, contracts
from splitune_ml_core.keys import analysis_prefix
from splitune_ml_core.settings import load_settings
from splitune_ml_core.storage import Storage
from stage_separation import encode


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("analysis")
    parser.add_argument("out")
    parser.add_argument("--user", default="test-user")
    parser.add_argument("--version", type=int, default=1)
    args = parser.parse_args()
    storage = Storage.from_settings(load_settings())
    base = f"{analysis_prefix(args.user, args.analysis)}v{args.version}/"
    probe = contracts.Probe.model_validate_json(
        storage.get_bytes(f"{base}probe.json", max_bytes=1 << 20)
    )
    stems_key = f"{base}stems.json"
    stems = json.loads(storage.get_bytes(stems_key, max_bytes=1 << 24))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    files: list[dict[str, object]] = []
    for relative in artefacts.referenced_files("stems", stems):
        dest = out / Path(relative).name
        storage.download(artefacts.blob_key(stems_key, relative), dest)
        if dest.suffix == ".m4a":
            pcm = out / f"{dest.stem}.f32"
            np.ascontiguousarray(encode.decode(dest)[: probe.decoded_frames]).tofile(pcm)
    for relative in artefacts.referenced_files("stems", stems):
        name = Path(relative).name
        files.append(
            {
                "file": name,
                "codec": "aac" if name.endswith(".m4a") else "opus",
                "frames": probe.decoded_frames,
                "pcm": f"{Path(name).stem}.f32",
            }
        )
    expected = {"aac_encoder": encode.aac_encoder(), "files": files}
    (out / "expected.json").write_text(json.dumps(expected, indent=2) + "\n", encoding="utf-8")
    print(f"{len(files)} files, {probe.decoded_frames} frames → {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
