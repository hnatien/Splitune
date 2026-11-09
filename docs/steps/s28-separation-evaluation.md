# Step 28 — Separation evaluation on real-song conditions: fix the scoring, add loud/codec/full-length tests, a regression suite, and make loud masters safe

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/progress-log.md` entries for steps **06** (eval harness), **07 / 07b** (separation, P1, listening app, the port-4100 incident), **22 / 27** (P2g: separators judged by downstream guitar accuracy), **24** (P2p tiers, harness that runs the shipped code) and **25** (P2d).
- `docs/specs/08-evaluation-harness-and-prototypes.md` (P1, §4 "From prototypes to CI regression", all implementation notes), `specs/06-ml-pipeline-service.md` §0, §2, §4 (separation, stem_post, quality hint "calibrate against P1 ratings"), `specs/25-personal-mode.md`, `specs/18-testing-strategy.md`.
- Research: `docs/research/ml/source-separation.md`, `docs/research/ml/datasets-metrics-and-licensing.md`.
- Code:
  - Stage: `services/ml/packages/stage_separation/src/stage_separation/{separate,models,stem_post,dsp,encode,config}.py` and its tests; `services/ml/config/separation.personal.yaml`.
  - Harness: `services/ml/eval/src/splitune_eval/{scoring,codec,registry,report,cli,local}.py`, `eval/p1.py`, `eval/p1_musdb.py`, `eval/p2g.py` (bands, `separate --separator`), `eval/sets/musdb18hq-p1.yaml`, `eval/results/p1/`, `eval/results/p2g/2026-10-29-separation.md`; `scripts/bench_separation.py`; `apps/listening`.

Prerequisites: steps 01–27 on `dev`. Branch `impl/28-separation-eval` from the latest `dev`. The owner doesn't play an instrument and has not supplied songs: no deliverable may depend on owner ratings, owner-played audio or owner songs. Build the tooling those need and leave them as clearly listed owner actions.

This is a measurement step first. **Every change to production behaviour is decided by numbers**, and changes to `separation.personal.yaml` (which change stage cache keys) or to contracts need the owner's OK (Stop point 2).

## Why: audit findings (2026-11-06)
All of today's separation numbers come from **linear-sum mixes**: MUSDB18-HQ, and GuitarSet/MAESTRO/Slakh remixed under MUSDB bands with no limiter. Not one comes from a mastered, loud or real-world input. In detail:
1. **No loud/mastered input anywhere.**
   - The best-documented failure of current separators is brickwall-limited input. musdb-L/XL (Jeon & Lee, ISMIR 2022, https://arxiv.org/abs/2208.14355; training gains https://zenodo.org/record/8191153) cost state-of-the-art models significantly.
   - There is also an untested correctness risk in our own code:
     - `models.py` sets `normalization_threshold=1.0`, so audio-separator rescales any stem peaking above 0 dBFS;
     - `separate.store` clips to ±1 when writing 24-bit FLAC (`separate.py:159`);
     - `stem_post` then derives `mixture − stem`.

     On a hot master a stem can lose its level relationship with the mixture, which breaks mix-minus. No test feeds a loud input.
2. **P1 scores silent references.**
   - In 3 of 20 clips the reference stem is silent, yet each cell is scored and counted in the medians:
     - `mu-too-bright` bass (−99 to −110 dB);
     - `skelpolu-resurrection` vocals (−24 to −108 dB);
     - `speak-softly-broken-man` bass (−38 to −75 dB).
   - The cause is that `scoring.usdr` adds the same ε to the top and bottom of its ratio, so on a silent reference it measures leakage against ε, not separation quality. SDX'23 dropped a song for this exact reason.
3. **P1 selection favours the incumbent.** `p1.py select` chose guitar/piano windows by **BS-Roformer-SW's own stem energy**, then compared SW with the other models on those windows.
4. **No regression suite.** `regression.yaml` and `pnpm eval:regression` (doc 08 §4) were never built. A change to a model, to audio-separator or to inference settings gets no quality check. The `models`-marked tests check stem names and lengths only.
5. **Only 30 s windows are evaluated.** Production separates whole songs. Window seams, overlap-add and the `overlap: 9.3` choice were never checked on full-length audio; the P1 report itself says 30 s clips can't show SW's saving.
6. **Thin codec coverage.** P1 has AAC 128k, P2g has WAV, P2p has some MP3. Nothing covers Opus (the URL-import / YouTube path), mono-folded input or 48 kHz sources through the shipped decode.
7. **Possible train/test leakage.** Community checkpoints (BS-Roformer-SW, Kim Mel-RoFormer, viperx, becruily) have undocumented training data and may have seen the MUSDB18-HQ test songs. P1's absolute dB figures may be inflated.
8. **P1 listening is unfinished.**
   - Session `p1-2026-10-21b` is exported but not rated, so the model map rests on uSDR alone.
   - SDX'23's listening round ranked the top systems almost in reverse SDR order (https://arxiv.org/html/2308.06979v4).
   - The stem_post bleed heuristic was meant to be calibrated against these ratings.

Keep what works. Judging separators by downstream transcription (P2g/P2p/P2d: clean vs stem vs mixture) is ahead of the published literature. This step adds to it and replaces none of it.

## Goal
Every separation decision is measured on conditions that look like real uploads (loud masters, lossy codecs, mono, full-length songs), with scoring that can't be fooled by silent stems or by a biased clip selection. A frozen regression suite catches quality drops. Loud masters provably don't break stems or mix-minus.

## Phase 0 — Plan (Stop point 1)
1. **Re-check the evaluation practice summarised above against current sources** (note anything newer than 2026-11), and confirm a few specifics:
   - MSST's metrics: `utils/metrics.py` in https://github.com/ZFTurbo/Music-Source-Separation-Training (sdr, si_sdr, l1_freq, bleedless, fullness); record the licence and commit.
   - musdb-XL's construction: the limiter gain is applied identically to the mixture and the stems, so the references stay valid.
   - Jaffe & Burgoyne 2025 (https://arxiv.org/abs/2507.06917): SDR predicts vocals best, SI-SAR predicts drums/bass best.
   - The training data of each model in `separation.personal.yaml`, from model cards, MVSep and UVR pages and repos. Record "unknown" when you can't find it.
2. **Write the plan:**
   - downloads and their sizes (musdb-XL test set; MoisesDB needs a sign-up by the owner, so list it as an owner action and don't block on it);
   - the robustness matrix and which sets it runs on;
   - the regression subset;
   - estimated GPU hours on the RTX 3060 and the Mac.
3. **Post the plan in chat and wait for the owner's OK.**

## Phase 1 — Scoring fixes (`splitune_eval.scoring`, `eval/p1.py`)
1. **Silent references:**
   - Classify a reference as silent when its energy is below a threshold relative to the mixture (start from −40 dB vs mixture energy, or an absolute floor of about −60 dBFS RMS; choose with the data and document the choice).
   - Exclude silent references from uSDR, SI-SDR and cSDR aggregates and report how many were excluded per cell.
   - Report a separate **leakage** metric for them: estimate energy relative to the mixture, in dB.
2. **More metrics:**
   - Add SI-SDR, plus bleedless and fullness ported from MSST. Port with attribution and the licence noted in the file docstring and `compliance/register` if the register covers code; give identical results on a shared fixture.
   - Replace mir_eval's deprecated BSS Eval v3 cSDR with a self-contained frame-wise SDR. Use 1 s windows with median over frames; skipping silent-reference frames like museval v4 is fine, and so is museval itself if its dependency weight is now acceptable. Say which.
   - Every report states its metric variant.
3. **Distributions, not one number:** per model × instrument × condition, report n, median, mean, p10 and the worst 3 items with their ids.
4. **Unbiased selection.**
   - Rework `p1.py select`:
     - vocals/drums/bass windows by **reference** stem energy;
     - guitar/piano windows by the tagger plus the **maximum** stem energy across *all* candidate models, so no candidate picks its own test.
   - Write a new set version and keep the old manifest for comparison.
5. **Re-run P1 SDR on the corrected scoring:**
   - the old selection, to show the effect of the scoring fix alone;
   - the new selection.

   Report whether any inference-setting choice in `separation.personal.yaml` changes. Don't edit the map yet.
6. **Tests:** unit tests on synthetic signals for each metric, the silent-reference rule, the aggregation, and the selection, which must not depend on candidate order.

## Phase 2 — Robustness matrix (`splitune_eval.codec` → a `variants` module)
1. Variants, each applied **to the mixture and, where the transform is gain-like, identically to the reference stems**:
   - **`limit-L` / `limit-XL`:** a look-ahead true-peak limiter driven to about −8 and −6 LUFS integrated, ceiling −1 dBTP.
     - The limiter's sample-wise gain envelope comes from the mixture and is applied to every stem, as in musdb-XL, so the references stay consistent.
     - Implement it in numpy, or check that the ffmpeg route reproduces the envelope.
     - Validate on the official musdb-XL test set if downloaded: same loudness and gain-reduction statistics within tolerance.
   - **Codecs:** `opus128` and `opus160` (YouTube-like), `aac128`, `mp3-128`. References stay clean and are delay-aligned (measure codec delay; use the existing alignment helper in `stem_post`/`dsp` where it fits).
   - **`mono`:** a folded mixture, with the references folded the same way.
   - **`sr48`:** the mixture resampled to 48 kHz and fed through the **shipped decode stage** back to 44.1 kHz.
2. Run the matrix with the corrected scoring on:
   - the P1 set (both selections), every model in the map;
   - the P2g hard-band subset with the shipped guitar chain, for downstream onset F1 and Tab F1 per variant;
   - P2p `pop-band` and P2d `rendered-band` if time allows.
3. **Report** `eval/results/sep-robust/<date>.md` + `.csv`: the delta against the clean condition per model, instrument and variant, with distributions and the worst items.
   - Call out any variant where the shipped chain head loses to a fallback model, or where a stem's downstream F1 drops more than 0.05.
   - Run long jobs in the background with per-item checkpoints so a crash resumes. The RTX 3060 has crashed with `VIDEO_TDR_FAILURE` under sustained CUDA load (step 22).

## Phase 3 — Loud-master correctness (stage code)
1. **Reproduce first:**
   - Build a fixture with stems whose sum, after limiting, has a mixture near 0 dBFS and individual stems that peak above 0 dBFS. Use stems taken from a limited MUSDB window, plus a synthetic case.
   - Run the shipped `separate` → `stem_post` with real weights (`models` mark) and measure:
     - whether audio-separator rescaled any stem;
     - clipped-sample counts in the stored FLACs;
     - the energy of `mixture − Σ stems` and of the `subtract` mix-minus error against the clean reference.
2. **If there is a defect, fix the smallest thing that removes it.** Options to evaluate:
   - disable or raise the library's normalisation;
   - store raw stems with recorded headroom, i.e. scale down by a known gain stored in `separation.json` and undo it in `stem_post`;
   - store float FLAC/WAV in the cache.

   Any contract field goes through `packages/contracts` + `pnpm contracts:gen`. Any cache-key change is stated explicitly with what it invalidates. **Stop point 2** applies before shipping a contract or cache-key change.
3. **Regression tests:**
   - a fast synthetic test for the store/normalisation path (no weights);
   - a `models` test that a hot mixture separates without rescaling or clipping beyond a stated tolerance and that `mixture − stem` stays consistent;
   - a `separation.json` (or log) clip-count field, if added, asserted in tests.

## Phase 4 — Full-length songs, seams and determinism
1. Run the shipped `separate` on 5 full MUSDB18-HQ test songs, including the longest (> 6 min if one exists, else concatenate two), for every model in the map, at the shipped settings and the library defaults. Compare:
   - full-song uSDR against the 30 s window uSDR on the same songs;
   - a **seam metric**: high-pass residual energy (estimate − reference) in ±50 ms around each model window boundary vs elsewhere. Window boundaries are computable from chunk and step for RoFormers and from segment and overlap for Demucs.
   - wall time and peak memory, which updates the P1 full-song table.
2. **Determinism:**
   - Same input twice must give the same output, bit-identical or within a stated tolerance; Demucs `shifts` is random, so record whether the seed is fixed.
   - Input offset by half a window: aligned outputs agree within a stated dB.
3. Report under `eval/results/p1/<date>-fullsong.md`. If `overlap: 9.3` or `shifts: 1` measurably hurts full songs, report it and propose the change; don't edit the map without the owner.

## Phase 5 — Regression suite (doc 08 §4)
1. `services/ml/eval/regression.yaml` freezes the suite:
   - **Subset:**
     - about 8 P1 clips (new selection) × {clean, limit-XL, opus128} for each map model's referenced stems;
     - about 6 P2g hard-band items for downstream guitar onset F1 through the shipped chain;
     - 1 full-length song for the seam metric.
   - **Metrics and tolerances:** median uSDR −0.5 dB, SI-SDR −0.5 dB, bleedless/fullness −2 points, downstream onset F1 −0.02, seam ratio, and wall time +25 %.
   - **Baseline:** the stored baseline values with git sha, model refs and library versions.
2. **Commands:**
   - `uv run --no-sync splitune-eval regress [--update-baseline]` → exit code 1 on any breach, with a Markdown report to `eval/results/regression/<date>.md`;
   - root `pnpm eval:regression` wired through `scripts/`, like the other root commands;
   - a CPU-only `--smoke` mode (1 clip, htdemucs_6s, short) that checks the suite runs, cheap enough for the normal test run, with the test skipped when weights are missing as today's `models` tests do.
3. Document when to run it: after any change to `stage_separation`, `separation.personal.yaml`, audio-separator or torch pins, or model weights. Add a line to `CLAUDE.md` Commands.

## Phase 6 — Leakage, listening and owner-dependent tooling (build, don't block)
1. **Training-data provenance:** add each separation model's training data (or "unknown") to its `compliance/register/models/*.yaml`. Label P1 numbers "possibly in-sample" where it applies.
2. **MoisesDB tier:** a reader in the style of `p1_musdb.py` that builds guitar/piano/keys windows with **real** guitar and piano references from MoisesDB once the owner has downloaded it. Items are skipped until then. Add it to the registry and to the robustness and regression runs behind an "if present" check.
3. **Listening:**
   - Extend `p1.py export` with:
     - the robustness variants (limit-XL, opus128) as extra rated items;
     - an `--extra-dir` of unreferenced snippets the owner can drop in later;
     - the same blind and shuffle rules.
   - Export a **new** session id. Never overwrite or stop the owner's running listening server or existing sessions (see the step 07 incident: check the port first and use a free one).
   - Add a `report` section that correlates ratings with each metric per stem (Spearman) once ratings exist, so the bleed heuristic and the metric choice can be calibrated later.

## Out of scope
- Changing the model map, chains or defaults without the owner's OK.
- Training or fine-tuning separators.
- Commercial vendor trials.
- Anything billable on Railway or Cloudflare.

## Deliverables and checks
- Code and tests as above.
- **Reports:** `eval/results/p1/` (rescored, reselected, full-song), `eval/results/sep-robust/`, `eval/results/regression/` (baseline).
- **Docs:**
  - doc 08 implementation notes (step 28): scoring rules, variants, regression suite, results summary;
  - `docs/research/ml/source-separation.md` §"2026-11 evaluation practice", with sources;
  - `docs/status.md` row s28;
  - `docs/progress-log.md` entry;
  - `docs/steps/README.md` row.
- **Verify and report exact commands and results:**
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`;
  - `cd services/ml && uv run --no-sync ruff check && uv run --no-sync pyright && uv run --no-sync pytest`, plus the `models`-marked separation tests with weights present;
  - `pnpm eval:regression` against the new baseline, then once with a deliberately degraded setting (e.g. htdemucs_6s as the head) to show it fails.
- **Commits:** Conventional Commits on `impl/28-separation-eval`, files staged explicitly, no audio, weights or datasets in git. No push, PR or merge unless asked.
- **End with the owner actions list:**
  1. rate the new listening session;
  2. sign up for and download MoisesDB;
  3. drop 10–15 commercially mastered snippets into the `--extra-dir`;
  4. decide on any proposed map, contract or cache-key change.
