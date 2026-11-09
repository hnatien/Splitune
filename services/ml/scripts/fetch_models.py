"""Fetch the model files into ML_MODELS_DIR and verify them against the register.

    uv run python scripts/fetch_models.py [NAME ...]

No argument fetches all of them (`pnpm run setup` does); files already in place are kept. Each
file comes from the URL its register record names (pinned commits / the PyPI wheel) and must
match the record's sha256. `yourmt3` also installs the HF space's inference code (GPL-3.0, kept
out of this repository) as `<models>/yourmt3/src` and links the checkpoint into the space's
`logs/` layout. `transkun` extracts the weights and model config
from the package's PyPI wheel. The separation models are downloaded by audio-separator itself,
by the filename the separation map gives them, except `mega53-keys` (piano's fallback, step 29):
its config comes from eval/model-configs/ and its checkpoint is cut from the upstream 53-stem
one (1.4 GB, kept under <models>/mega53/). madmom's models arrive with its git install, and the
tagger's ONNX file is exported locally (`scripts/export_tagger.py`).

    uv run python scripts/fetch_models.py --eval [NAME ...]

`--eval` fetches the evaluation-only separation candidates instead (step 29,
eval/separation.eval.yaml), which setup never downloads and workers never expect: files with a
URL are downloaded and configs we derived come from eval/model-configs/.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path
from typing import Any

from audio_separator.separator import Separator  # pyright: ignore[reportMissingTypeStubs]
from splitune_ml_core import register
from splitune_ml_core.paths import ML_ROOT
from stage_separation import config as separation_config

YOURMT3_SPACE = "https://huggingface.co/spaces/mimbres/YourMT3"
YOURMT3_COMMIT = "5e66c1ea173a8186e0d20432b841d3180cc015b5"
YOURMT3_EXPERIMENT = "mc13_256_g4_all_v7_mt3f_sqr_rms_moe_wf4_n8k2_silu_rope_rp_b80_ps2"
BASIC_PITCH_MEMBER = "basic_pitch/saved_models/icassp_2022/nmp.onnx"
BASIC_PITCH_WHEEL_SHA256 = "738adb503aae7fdfc7d1e1511aa0ce35052315f260a19531ef4c356708425db0"
TRANSKUN_WHEEL_SHA256 = "7d7f5bf88b0d21f7da0415b089cff3bcbcbdda04e1a3c9719964947942c859fe"

# name → register record (its directory under the models dir is register.WEIGHTS_DIRS)
TARGETS = {
    "basic-pitch": "basic-pitch",
    "consonance-ace": "consonance-ace",
    "btc": "btc-large-voca",
    "yourmt3": "yourmt3-moe",
    "transkun": "transkun-v2",
    "transkun-pop": "transkun-v2-pop",
    "adtof": "adtof-frame-rnn",
    "pm2s": "pm2s-hand-part",
    "bs-roformer-sw": "bs-roformer-sw",
    "bs-roformer-viperx-1297": "bs-roformer-viperx-1297",
    "htdemucs-6s": "htdemucs-6s",
    "htdemucs-ft": "htdemucs-ft",
    "mel-roformer-kim-vocals": "mel-roformer-kim-vocals",
    "mel-roformer-guitar-becruily": "mel-roformer-guitar-becruily",
    "guitab": "guitab-e25",
    "mega53-keys": "bs-roformer-mega53-keys5",
}
SEPARATION = {spec.record: spec.filename for spec in separation_config.load().models.values()}

# Evaluation-only separation candidates (step 29): name → register record. All live in the
# audio-separator directory; they are not in register.WEIGHTS_DIRS, so workers don't expect them.
EVAL_TARGETS = {
    "leap-xe": "bs-roformer-leap-xe",
    "leap-v1": "bs-roformer-leap-v1",
    "ft1-anvuew": "bs-roformer-ft1-anvuew",
    "xlance-syn-mss": "xlance-syn-mss",
    "xlance-syn-mss1": "xlance-syn-mss1",
    "xlance-key-mss": "xlance-key-mss",
    "xlance-gtr-mss": "xlance-gtr-mss",
    "drumsep5": "mdx23c-drumsep5",
}
EVAL_CONFIGS = ML_ROOT / "eval" / "model-configs"
MEGA53_RECORD = "bs-roformer-mega53-keys5"
MEGA53_URL = "https://github.com/ZFTurbo/Music-Source-Separation-Training/releases/download/v1.0.21"
MEGA53_CKPT = "mvsep_mega_model_bs_roformer_53_stems_v1.ckpt"
MEGA53_SHA256 = "c62820893bbf86d4e734f966bd142d9157cfc8bb8e79e9d8f9ea553f3ff3519f"
# organ, keys, synth, piano, digital-piano in the 53-stem order
MEGA53_HEADS = (31, 25, 38, 33, 12)


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


def fetch_separation(directory: Path, record: register.ModelRecord) -> None:
    separator: Any = Separator(log_level=logging.ERROR, model_file_dir=str(directory))
    separator.download_model_files(SEPARATION[record.id])


def slice_mega53(dest: Path) -> None:
    """The Mega-53 backbone with five of its 53 mask estimators, renumbered 0-4 (the per-head
    files on the noblebarkrr mirror are the same backbone with one head each). Saved through a
    buffer: torch.save names the archive inside the file after the path it writes to, a buffer's
    is always "archive", so every cut has the same bytes and the register's sha256."""
    import torch

    source = models_dir() / "mega53" / MEGA53_CKPT
    download(f"{MEGA53_URL}/{MEGA53_CKPT}", source, MEGA53_SHA256)
    state = torch.load(source, map_location="cpu", weights_only=True)
    cut = {k: v for k, v in state.items() if not k.startswith("mask_estimators.")}
    for new, old in enumerate(MEGA53_HEADS):
        prefix = f"mask_estimators.{old}."
        cut |= {
            f"mask_estimators.{new}.{k[len(prefix) :]}": v
            for k, v in state.items()
            if k.startswith(prefix)
        }
    buffer = io.BytesIO()
    torch.save(cut, buffer)
    temp = dest.with_name(f".{dest.name}.part")
    temp.write_bytes(buffer.getvalue())
    temp.replace(dest)
    print(f"sliced   {dest}")


def fetch_derived(directory: Path, record: register.ModelRecord) -> None:
    """A separation model outside audio-separator's catalogue: files with a URL are downloaded,
    configs we derived are copied from eval/model-configs/, and the Mega-53 slice is cut."""
    for entry in record.weights.files:
        dest = directory / entry.name
        if entry.url:
            download(entry.url, dest, entry.sha256)
        elif (EVAL_CONFIGS / entry.name).is_file():
            shutil.copyfile(EVAL_CONFIGS / entry.name, dest)
        elif record.id == MEGA53_RECORD and not (
            dest.is_file() and register.file_sha256(dest) == entry.sha256
        ):
            slice_mega53(dest)


def fetch_eval(names: list[str]) -> None:
    directory = models_dir() / "audio-separator"
    for name in names:
        record = register.model(EVAL_TARGETS[name])
        fetch_derived(directory, record)
        register.verify(record, directory)
        print(f"verified {record.id}")


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
    if not link.is_symlink() and not link.exists():
        try:
            link.symlink_to(Path("../../../../model.ckpt"))
        except OSError:
            # Windows creates symlinks only in Developer Mode; a hard link needs no privilege.
            link.hardlink_to(directory / "model.ckpt")
    print(f"code     {src}")


def main() -> None:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n", 1)[0])
    parser.add_argument("names", nargs="*", metavar="|".join([*TARGETS, *EVAL_TARGETS]))
    parser.add_argument("--eval", action="store_true", help="the evaluation-only candidates")
    args = parser.parse_args()
    targets = EVAL_TARGETS if args.eval else TARGETS
    names: list[str] = args.names or list(targets)
    unknown = sorted(set(names) - set(targets))
    if unknown:
        parser.error(f"unknown model(s): {', '.join(unknown)}")
    if args.eval:
        fetch_eval(names)
        return
    for name in names:
        record_id = TARGETS[name]
        record = register.model(record_id)
        directory = models_dir() / register.WEIGHTS_DIRS[record_id]
        if name == "basic-pitch":
            fetch_basic_pitch(directory, record)
        elif name == "transkun":
            fetch_transkun(directory, record)
        elif record_id == MEGA53_RECORD:
            fetch_derived(directory, record)
        elif all(entry.url for entry in record.weights.files):
            for entry in record.weights.files:
                download(str(entry.url), directory / entry.name, entry.sha256)
        elif record_id in SEPARATION:
            fetch_separation(directory, record)
        else:
            (entry,) = record.weights.files
            download(record.weights.url, directory / entry.name, entry.sha256)
        if name == "yourmt3":
            fetch_yourmt3_code(directory)
        register.verify(record, directory)
        print(f"verified {record_id}")


if __name__ == "__main__":
    sys.exit(main())
