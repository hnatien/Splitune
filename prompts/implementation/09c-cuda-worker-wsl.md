# Step 09c — Workers on a Windows PC via WSL2 with an NVIDIA GPU (CUDA)

## Before you start
Read `prompts/implementation/00-shared-context.md`, then:
- `docs/implementation/25-personal-mode.md` §1, §5–§7 (topology, worker trust, running it, Cloudflare R2 state)
- `docs/implementation/06-ml-pipeline-service.md` §0 (islands), §2 (Node worker) and the stage device notes
- `docs/implementation/05-analysis-schema.md` (versioning rules for the `Separation` artefact)
- `docs/implementation/PROGRESS.md` entries for steps 06, 07, 07b, 08 and 09 (islands, slots, model settings, the step 07b full-song bench numbers)
- In code: `services/ml/packages/splitune_ml_core/src/splitune_ml_core/{settings,stages,worker,island}.py`, `stage_separation/{models,separate}.py`, `stage_beats/{model,stage}.py`, `stage_chords/recognizers.py`, `stage_notes/yourmt3.py`, `services/ml/eval/src/splitune_eval/local.py`, `packages/contracts/src/analysis/separation.ts`, `services/ml/pyproject.toml`, `services/ml/islands/torch/pyproject.toml`, `scripts/setup.mjs`, `.github/workflows/ci.yml`, `services/ml/deploy/`
- External references: [uv — Using uv with PyTorch](https://docs.astral.sh/uv/guides/integration/pytorch/) (accelerator extras with `[tool.uv] conflicts`), [NVIDIA — CUDA on WSL User Guide](https://docs.nvidia.com/cuda/wsl-user-guide)

Prerequisites: Step 09 merged into `dev` (it edits the same files: contracts, `stages.py`, `worker.py`, `settings.py`). The owner has a Windows PC with an NVIDIA GPU (≥8 GB VRAM recommended; the MSST 53-stem checkpoint wants ~16 GB) and does the one-time PC setup below.

**Where this runs:** the code changes and the Mac/CI verification happen in the primary checkout on the Mac. The PC verification happens in a second session inside WSL on the PC. `docs/` and `prompts/` are untracked and exist only on the Mac, so copy this prompt (and doc 25) to the PC for that session, and append both sessions' results to the Mac's `PROGRESS.md`.

## Goal
The ML worker and the Node worker run supervised on the owner's Windows PC inside WSL2 (Ubuntu), using the NVIDIA GPU through CUDA, with the same queue protocol, contracts and outputs as the Mac. The Mac keeps working unchanged (MPS), and both machines can process the same queue at the same time.

## Owner setup on the PC (one time; document it, don't automate the Windows side)
- **Windows NVIDIA driver only.** Never install a Linux NVIDIA driver inside WSL: the Windows driver is exposed to WSL as `libcuda.so`, and a Linux driver overwrites it. If a CUDA toolkit is ever needed, use the WSL-Ubuntu installer.
- `wsl --install -d Ubuntu-24.04`; `/etc/wsl.conf` with `[boot] systemd=true`.
- `%UserProfile%\.wslconfig`: `memory=` large enough for the models (WSL defaults to 50% of host RAM) and `vmIdleTimeout=-1`.
- Repo, caches and model weights on WSL's ext4 filesystem (`~/`), never under `/mnt/c` (slow I/O).
- Tools inside WSL: uv 0.13, Node 24, pnpm 12, Deno, a static **FFmpeg 8.1** build (Ubuntu's apt FFmpeg is older) with `FFMPEG_BIN_DIR` pointing at it.

## Deliverables
1. **One device module.** New `splitune_ml_core/device.py` (imports torch lazily, so the queue worker itself stays torch-free):
   - `torch_device()` → `"cuda" | "mps" | "cpu"`, driven by `ML_TORCH_DEVICE`, which now accepts `auto | cuda | mps | cpu`. `auto` = CUDA, else MPS, else CPU. An explicit device that isn't available raises a clear error instead of silently falling back.
   - Helpers: `empty_cache()`, `synchronize()`, and a peak-memory context manager (CUDA: `reset_peak_memory_stats` / `max_memory_allocated`; MPS: the existing driver-allocation sampler).
   - `splitune_ml_core` is already a dependency of the `torch` island, so the stages can import it.
2. **Replace every hard-coded `"mps"` device check:**
   - `stage_separation/models.py`: `device()`, `release()`, `mps_peak` (→ the generic peak helper). `separate.py`: metric is `gpu_s` whenever the device isn't CPU.
   - `stage_beats/model.py` and `stage.py`: `choose()` keeps the requested model on any accelerator (CUDA or MPS) and falls back to the small model only on CPU; `torch.mps.synchronize()` → `synchronize()`.
   - `stage_chords/recognizers.py`: use the shared `torch_device()`.
   - `stage_notes/yourmt3.py`: currently ignores `ML_TORCH_DEVICE`; use the shared helper.
   - `services/ml/eval/src/splitune_eval/local.py`: drop the hard-coded `"device": "mps"`, so benchmarks run on the PC. Leave historical result CSVs alone.
3. **Worker slots: `mps` → `gpu`.**
   - `Slot = Literal["mps", "cpu"]` becomes `["gpu", "cpu"]` in `stages.py` (including `TRANSCRIBER_ISLANDS`) and `worker.py`. Slots are worker-internal: jobs are claimed by stage name, so the database doesn't change.
   - `settings.py`: `mps_slots` → `gpu_slots` with env `ML_GPU_SLOTS`; `torch_device` accepts `"cuda"`.
   - Update `.env.example`, and tell the owner in your summary to rename `ML_MPS_SLOTS` to `ML_GPU_SLOTS` in their `.env` (`pnpm run setup` doesn't overwrite an existing `.env`).
4. **Island environment.** Add `CUDA_VISIBLE_DEVICES` to the island env allow-list, and confirm `ML_TORCH_DEVICE` is already passed through.
5. **Contract.**
   - `Separation.device` in `packages/contracts/src/analysis/separation.ts` gains `'cuda'`.
   - Bump the minor of `SCHEMA_VERSION` (from whatever `dev` has).
   - Run `pnpm contracts:gen` (JSON Schema + the generated Pydantic `_generated.py`; never hand-edit it), then `pnpm contracts:check`.
   - Restamp goldens and fixtures the way steps 06–08 did.
6. **uv: CUDA PyTorch builds on Linux.**
   - Today both `services/ml/pyproject.toml` and `islands/torch/pyproject.toml` route `torch`/`torchaudio` to `pytorch-cpu` for every Linux, which includes WSL.
   - Replace this with two mutually exclusive extras, `cpu` and `cuda`, per the uv PyTorch guide: `[tool.uv] conflicts`, sources routed by extra and limited to Linux. The `cuda` extra points at the `cu1xx` index that PyTorch publishes for 2.14.1 and that the PC's driver supports; check the published variants and record the choice.
   - macOS stays on PyPI (MPS). The `onnx-cpu` island doesn't change.
   - Re-lock both projects.
   - CI: `uv sync --locked --extra cpu`, plus the island torch equivalent.
   - `scripts/setup.mjs`: choose the extra from `SPLITUNE_TORCH` (`cuda` on the PC; default `cpu` on Linux, none on macOS).
   - Keep `audio-separator[cpu]`: only torch architectures are used (Demucs and MDXC/RoFormer), so the GPU comes from torch, and the `[gpu]` extra pulls `onnxruntime-gpu`, which clashes with `onnxruntime`. Verify the library actually runs on CUDA (deliverable 9).
7. **Supervision on WSL** (templates under `services/ml/deploy/`, next to the launchd plist):
   - systemd units `splitune-ml-worker.service` and `splitune-node-worker.service`: `Restart=always`, `KillSignal=SIGTERM`, `TimeoutStopSec` longer than the longest stage timeout (1500 s) so a running job drains; logs via `journalctl`.
   - Keeping WSL alive: systemd alone doesn't stop WSL from shutting down when no session is attached. Add a PowerShell script that registers a Task Scheduler task at system startup running `wsl.exe -d Ubuntu-24.04 --exec sleep infinity` hidden, "run whether user is logged on or not", no time limit, restart on failure.
   - Document the Windows power settings (no sleep while plugged in, or accept the worker-offline state) and that Windows Update reboots bring the workers back through that task.
8. **Docs** (untracked, update in place):
   - `25-personal-mode.md`: the worker host can be the Mac or a Windows PC/WSL2; topology diagram and §1 table; one more R2 token row (deliverable 10).
   - `06-ml-pipeline-service.md`: the `cuda` device and `gpu` slot.
   - `19-deployment-and-operations.md`: a PC worker runbook.
   - `00-tech-stack.md`: CUDA wheels note.
   - `prompts/implementation/17-deploy-railway-and-mac.md`: systemd + Task Scheduler as a supervision option next to launchd.
   - `PROGRESS.md` entry.
9. **PC verification session** (inside WSL, after the owner setup):
   - `nvidia-smi` (WSL's version has a limited feature set; that is expected), then in the torch island venv: `python -c "import torch; print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name())"`.
   - `SPLITUNE_TORCH=cuda pnpm run setup`, `uv run pytest -m models`.
   - A full local stack on the PC (Docker Desktop with WSL integration): `pnpm dev`, `ML_MODE=local`, both workers under systemd. Run one song through the whole chain from decode to finalize.
   - Bench against the step 07b Mac numbers: 6s 33 s, ft 97 s, SW 181 s, viperx 313 s, Kim 136 s. Record VRAM peaks.
   - Quality: `eval/p1.py separate --tag cuda` + `sdr --tag cuda` on the 20 P1 clips.
10. **Production wiring (only if step 17 is done):** a third bucket-scoped R2 token `splitune-pc-workers` (recipe in doc 25 §6; list it in a plan message and wait for the owner's yes, even though it's free) plus the worker DB role URL in the PC's `.env.worker`. Never print token values. Otherwise note it as the next step.

## Out of scope
Running ONNX stages (Basic Pitch, tagger) on CUDA — they stay on `CPUExecutionProvider`. Native Windows (non-WSL) support. Hosted/cloud GPU workers. Any change to the queue protocol or cache keys (the device isn't part of the cache key; Mac and PC results are interchangeable by design).

## Acceptance criteria
- On the Mac: behaviour unchanged. `pytest -m models` passes on MPS, `separation.json` says `device: "mps"`, and step 07b timings are within run-to-run variance (about ±15%).
- On the PC: `torch.cuda.is_available()` is true in the torch island. Model tests pass. `separation.json` says `device: "cuda"`, and beats keeps the full model. The full chain completes with `gpu_s` metrics.
- P1 SDR on the CUDA run is within 0.1 dB median of the MPS run for each model, or the difference is explained in `PROGRESS.md`.
- An explicit `ML_TORCH_DEVICE=cuda` on a machine without CUDA fails with a clear error; `auto` picks CUDA → MPS → CPU (unit-tested with mocked torch).
- Resilience on the PC:
  - kill -9 of either worker → systemd restarts it;
  - all terminals closed → workers still running after 10 minutes;
  - Windows reboot → workers back online without logging in;
  - sleep/wake → workers reconnect (LISTEN re-established, polling meanwhile).
- Mac and PC workers on the same database: no job processed twice; both heartbeats visible.
- CI green with `--extra cpu`; both lockfiles pass `uv lock --check`.

## Verification to run and report
On the Mac:
```bash
pnpm contracts:check
pnpm lint
pnpm typecheck
pnpm test
cd services/ml && uv run ruff check && uv run ruff format --check && uv run pyright && uv run pytest
uv lock --check
uv lock --check --project islands/torch
uv run pytest -m models
```

On the PC (WSL): `nvidia-smi`, the torch CUDA check, `uv run pytest -m models`, the full-chain run with stage timings, the P1 bench and SDR tables, VRAM peaks, `systemctl status` of both units, and the outcome of each resilience test.

Report the chosen CUDA wheel variant and the PC's GPU and driver version.
