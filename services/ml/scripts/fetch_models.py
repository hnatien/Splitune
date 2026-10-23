"""Fetch the step-08 model files into ML_MODELS_DIR and verify them against the register.

    uv run python scripts/fetch_models.py [basic-pitch] [consonance-ace] [btc] [yourmt3] [transkun]

No argument fetches all of them. Each file comes from the URL its register record names (pinned
commits / the PyPI wheel) and must match the record's sha256. `yourmt3` also installs the HF
space's inference code (GPL-3.0, kept out of this repository) as `<models>/yourmt3/src` and links
the checkpoint into the space's `logs/` layout. `transkun` extracts the weights and model config
from the package's PyPI wheel. madmom's models arrive with its git install.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

from splitune_ml_core import register

YOURMT3_SPACE = "https://huggingface.co/spaces/mimbres/YourMT3"
YOURMT3_COMMIT = "5e66c1ea173a8186e0d20432b841d3180cc015b5"
YOURMT3_EXPERIMENT = "mc13_256_g4_all_v7_mt3f_sqr_rms_moe_wf4_n8k2_silu_rope_rp_b80_ps2"
BASIC_PITCH_MEMBER = "basic_pitch/saved_models/icassp_2022/nmp.onnx"
BASIC_PITCH_WHEEL_SHA256 = "738adb503aae7fdfc7d1e1511aa0ce35052315f260a19531ef4c356708425db0"
TRANSKUN_WHEEL_SHA256 = "7d7f5bf88b0d21f7da0415b089cff3bcbcbdda04e1a3c9719964947942c859fe"

# name → (register record, directory under the models dir)
TARGETS = {
    "basic-pitch": ("basic-pitch", "basic-pitch"),
    "consonance-ace": ("consonance-ace", "consonance-ace"),
    "btc": ("btc-large-voca", "btc"),
    "yourmt3": ("yourmt3-moe", "yourmt3"),
    "transkun": ("transkun-v2", "transkun"),
}


def models_dir() -> Path:
    return Path(os.environ.get("ML_MODELS_DIR", "~/.cache/splitune/models")).expanduser()


def download(url: str, dest: Path, sha256: str) -> None:
    if dest.is_file() and register.file_sha256(dest) == sha256:
        print(f"ok       {dest}")
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    digest = hashlib.sha256()
    with urllib.request.urlopen(url, timeout=60) as response, tmp.open("wb") as out:
        while chunk := response.read(1 << 20):
            digest.update(chunk)
            out.write(chunk)
    if digest.hexdigest() != sha256:
        tmp.unlink()
        raise SystemExit(f"sha256 mismatch for {url}")
    tmp.rename(dest)
    print(f"fetched  {dest}")


def fetch_basic_pitch(directory: Path, record: register.ModelRecord) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        wheel = Path(tmp) / "basic_pitch.whl"
        download(record.weights.url, wheel, BASIC_PITCH_WHEEL_SHA256)
        with zipfile.ZipFile(wheel) as archive:
            directory.mkdir(parents=True, exist_ok=True)
            (directory / "nmp.onnx").write_bytes(archive.read(BASIC_PITCH_MEMBER))


def fetch_transkun(directory: Path, record: register.ModelRecord) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        wheel = Path(tmp) / "transkun.whl"
        download(record.weights.url, wheel, TRANSKUN_WHEEL_SHA256)
        with zipfile.ZipFile(wheel) as archive:
            directory.mkdir(parents=True, exist_ok=True)
            for entry in record.weights.files:
                (directory / entry.name).write_bytes(
                    archive.read(f"transkun/pretrained/{entry.name}")
                )


def fetch_yourmt3_code(directory: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        checkout = Path(tmp) / "space"
        # The space's LFS files (example audio, other checkpoints) are not needed.
        lfs_off = [
            *("-c", "filter.lfs.smudge="),
            *("-c", "filter.lfs.process="),
            *("-c", "filter.lfs.required=false"),
        ]
        git = ["git", *lfs_off]
        subprocess.run(
            [*git, "clone", "-q", "--no-checkout", YOURMT3_SPACE, str(checkout)], check=True
        )
        subprocess.run([*git, "-C", str(checkout), "checkout", "-q", YOURMT3_COMMIT], check=True)
        src = directory / "src"
        shutil.rmtree(src, ignore_errors=True)
        shutil.copytree(checkout / "amt" / "src", src)
        shutil.copy2(checkout / "model_helper.py", src / "model_helper.py")
    link = directory / "logs" / "ymt3" / YOURMT3_EXPERIMENT / "checkpoints" / "model.ckpt"
    link.parent.mkdir(parents=True, exist_ok=True)
    if not link.is_symlink():
        link.symlink_to(Path("../../../../model.ckpt"))
    print(f"code     {src}")


def main() -> None:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n", 1)[0])
    parser.add_argument("names", nargs="*", metavar="|".join(TARGETS))
    names: list[str] = parser.parse_args().names or list(TARGETS)
    unknown = sorted(set(names) - set(TARGETS))
    if unknown:
        parser.error(f"unknown model(s): {', '.join(unknown)}")
    for name in names:
        record_id, subdir = TARGETS[name]
        record = register.model(record_id)
        directory = models_dir() / subdir
        if name == "basic-pitch":
            fetch_basic_pitch(directory, record)
        elif name == "transkun":
            fetch_transkun(directory, record)
        else:
            (entry,) = record.weights.files
            download(record.weights.url, directory / entry.name, entry.sha256)
        if name == "yourmt3":
            fetch_yourmt3_code(directory)
        register.verify(record, directory)
        print(f"verified {record_id}")


if __name__ == "__main__":
    sys.exit(main())
