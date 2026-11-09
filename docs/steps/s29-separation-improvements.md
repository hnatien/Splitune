# Step 29: Separation improvements

Covers the vocals head, loud masters, SW inference settings, a keys fallback for synth and organ, shift averaging and kit pieces. Each one is measured, then shipped only if it clears its criterion.

## Before you start
Read `docs/steps/00-shared-context.md`, then the following.

**The research this step implements.** Read it fully first: `docs/research/ml/separation-improvements-2026-11.md`. Use these sections:
- "Ranked candidates per instrument";
- "First five experiments", whose pass/fail criteria are binding here;
- "Harness gaps".

If it is not on `dev`, commit it together with this step's docs. `.git/info/exclude` hides untracked files under `docs/` in the owner's checkout, so use `git add -f` for new files there.

**Earlier work:**
- `docs/progress-log.md` entries for steps **07 / 07b**, **24**, **25** and **28**.
- `docs/specs/08-evaluation-harness-and-prototypes.md`: §4 and the step 28 implementation notes.
- `docs/specs/06-ml-pipeline-service.md`: §0 (model map), §2 and §4 (separation, `stem_post`, quality hints).
- `docs/specs/25-personal-mode.md`.

**Background research:** `docs/research/ml/source-separation.md` (§"2026-11 evaluation practice").

**Stage code:** `services/ml/packages/stage_separation/src/stage_separation/{separate,models,stem_post,dsp,config}.py` and their tests, plus `services/ml/config/separation.personal.yaml`. The decode stage (`services/ml/packages/stage_decode`, or wherever `decode` writes its cache) matters too.

**Harness:**
- `services/ml/eval/sep_matrix.py`, `eval/p1.py`, `eval/p1_moisesdb.py`, `eval/p1_fullsong.py`, `eval/loud_master.py`;
- `services/ml/eval/src/splitune_eval/{scoring,variants,regress,msst,seams}.py`;
- `eval/regression.yaml` and `eval/regression.baseline.json`;
- the sets `eval/sets/{musdb18hq-p1-v2,moisesdb-p1}.yaml`;
- the reports in `eval/results/{p1,sep-robust}/2026-11-07*.md`.

**Records:** `compliance/register/models/*.yaml`.

**Prerequisites:**
- Step 28 is on `dev`.
- Branch `impl/29-separation-improvements` from the current `dev`.
- MUSDB18-HQ P1 windows are at `~/datasets/musdb18hq-p1`. MoisesDB-p1 windows are at `D:/datasets/moisesdb-p1` on the PC. The full songs from step 28 are available.
- The RTX 3060 PC is the main GPU host; the Mac is the second worker.

**The owner doesn't play an instrument.** No deliverable may depend on owner-played audio. Owner listening and owner-supplied clips are owner actions: build the tooling for them and list them at the end.

**This is a measure-then-ship step.** Every production change is decided by the criteria below, on the step 28 harness.

The following need the owner's OK (Stop point 2), because they change stage cache keys:
- changes to `separation.personal.yaml`;
- changes to contracts;
- changes to the decode or stem cache format.

## Goal
Each candidate the research ranked as worth doing gets tested on our harness with a pre-registered, falsifiable criterion. The winners ship; the losers are recorded with their numbers. The candidates:
- a better vocals head;
- recovering the loss on loud masters;
- SW's chunk length;
- a fallback for synth and organ keys, which SW currently outputs as silence;
- shift averaging for drums and bass;
- a better drum kit-piece model.

The regression baseline is updated to whatever ships.

## Out of scope
These were judged not worth it in the research; don't do them:
- TTA, higher overlap, Apollo restoration, phase fix, de-reverb;
- SAM Audio, diffusion refinement, query-conditioned separators (Banquet, QSCNet);
- ensembles with becruily or htdemucs_ft;
- the vocals-first cascade for bass;
- any training or fine-tuning, including LimitAug and LoRA;
- lead/rhythm and acoustic/electric guitar splits;
- a lead-vocal (karaoke) option;
- int8/GGUF quantisation;
- commercial vendor trials;
- uploading to MVSep or creating any account;
- anything billable on Railway or Cloudflare.

If an experiment's result makes one of these look worth doing, say so in the summary as a proposed follow-up. Don't start it.

## Phase 0: Plan (Stop point 1)
1. **Re-verify, briefly, what the research depends on.** Note anything that has changed since 2026-11-07.
   - The files and hashes of each new checkpoint (list below).
   - Whether audio-separator 0.44.5 can do the following, and how:
     - load each new checkpoint through the map's existing `config` path, as `mel_roformer_guitar_becruily` does;
     - change a RoFormer's chunk. Options: `mdxc_params.segment_size` / `override_model_segment_size`, or a local copy of the model YAML with a different `inference.dim_t` / `audio.chunk_size` loaded through `config`;
     - run with autocast (`use_autocast`).

     If 0.44.5 cannot do one of these, say so, and choose between a wrapper change and an upgrade. Any upgrade to 0.47+ must pin `overlap` explicitly for every RoFormer, because 0.47.0 changed its meaning.
2. **List the downloads** with source URL, size and SHA-256. Prefer upstream author repos over mirrors.

   | Candidate | Files | Source |
   |---|---|---|
   | Leap Xe | `Xe/bs_leap_xe_voc.ckpt` + `Xe/leap_xe_config_voc.yaml` | https://huggingface.co/pcunwa/BS-Roformer-Leap |
   | Leap v1 | `bs_roformer_leap_voc.ckpt` + `bs_leap_voc_conf.yaml` | same repo |
   | anvuew ft1 | `bs_roformer_ft1_anvuew_sdr_12.55.ckpt` + `config.yaml` | https://huggingface.co/anvuew/BS-RoFormer |
   | X-LANCE | `syn_mss.pth`, `syn_mss1.pth`, `key_mss.pth`, `gtr_mss.pth` | https://huggingface.co/chenxie95/xlance-msr-ckpt |
   | Mega-53 | `mvsep_mega_model_bs_roformer_53_stems_v1.ckpt` (about 1.37 GB) | MSST release v1.0.21: https://github.com/ZFTurbo/Music-Source-Separation-Training/releases/tag/v1.0.21 |
   | DrumSep 5-stem | `drumsep_5stems_mdx23c_jarredou.ckpt` (MSST docs name) | The original host is deleted. The mirror `mdx23c_drumsep_5stem_aufr33_jarredou.ckpt` is at https://huggingface.co/noblebarkrr/mvsepless_resources/tree/main/mdx23c |

   - **X-LANCE:** the repo has no model configs. Derive them from https://github.com/ModistAndrew/xlance-msr (`ans.py` and the model code), and confirm that each loads as a standard BS-RoFormer.
   - **Mega-53:** slice the organ, keys, synth, piano and digital-piano heads **yourself** from the upstream file. The full model needs ≥ 16 GB of VRAM. Compare your slices against the mirror's `bs_mega_53stem_*_mvsep.ckpt` (https://huggingface.co/noblebarkrr/BS-Roformer-MVSep-Mega-53-stems) only as a cross-check.
   - **DrumSep 5-stem:** openmirlab reports no intact original exists, so record the hash and treat the file's identity as unverified.
   - **drumsep5 evaluation set:** https://huggingface.co/datasets/MusicDemixingBenchmarks/drumsep5, only if Phase 7 runs. Give its size.
3. **Write the plan.** It should cover:
   - the phases below, with the run matrix of each;
   - GPU-hour estimates on the RTX 3060;
   - the harness changes;
   - which results would trigger Stop point 2.
4. **Post the plan in chat and wait for the owner's OK.**

## Phase 1: Harness extensions (eval only; no production change)
1. **Virtual models in `sep_matrix.py`.**
   - Add `combine` (or a sibling script that writes the same JSONL) to score a model built from **kept** stems of other models, under a new model name.
   - Supported recipes:
     - weighted `avg_wave`;
     - `avg_fft`;
     - **routing:** take model A's target unless its energy relative to the mixture is below a threshold, else the sum of models B…N's targets.
   - Records must be indistinguishable from a real model's in `report` and `regress`.
   - Unit tests on synthetic stems.
2. **Inference options as map keys**, eval-only until a phase ships them, with defaults that reproduce today bit-for-bit:
   - **RoFormer chunk:** seconds or samples.
   - **Pre-separation gain:** `gain: {target_lufs, min_input_lufs}`. Measure integrated loudness, scale the mixture in float, separate, and apply the inverse gain to every stem.
   - **Shift averaging:** `shifts: N` for RoFormers, with MSST `--bigshifts` semantics. That means N deterministic circular time shifts, unshifted back and averaged. Keep the outputs bit-deterministic.
   - **Autocast.**

   Each key is part of the stage cache key only when set. Test each one: the default is unchanged, the option changes the output, and determinism holds.
3. **Sets:** if any phase needs a non-MoisesDB check (Phase 5), add that set to the registry with "skip if absent" behaviour, like `moisesdb-p1`.
4. **Register:** add a `compliance/register/models/<id>.yaml` record for each new checkpoint. Include:
   - URL, files, SHA-256;
   - code, weights and training-data licences, where known;
   - `musdb18_test_in_training` / MoisesDB training: X-LANCE models and chenCFD trained on MoisesDB, so they are in-sample for `moisesdb-p1`;
   - `tier`;
   - `used_in: [eval]`.

   Update `bs-roformer-sw.yaml` notes with the provenance finding: probably Apple Logic Pro 11.2's model extracted from Core ML. This is a tier 4 claim with near-identical MVSep scores, recorded as a provenance fact, not a gate. Also record that the original host is deleted.

## Phase 2: Vocals head
1. **Matrix.** Run `sep_matrix.py run` for Leap Xe, Leap v1 and anvuew ft1 on `musdb18hq-p1-v2` and `moisesdb-p1` × {`clean`, `aac128`, `limit-XL`}. Record time and peak VRAM.
2. **Ensemble.** Combine Leap v1 + Xe as `avg_fft` and as `avg_wave` (Phase 1 virtual model), using `--keep` stems.
3. **Criterion for a new head,** per the research's experiment 1:
   - paired median uSDR **≥ +0.3 dB vs `mel_roformer_kim_vocals`** at `aac128` on **both** sets;
   - median bleedless no more than 2 points below Kim on either set;
   - time ≤ 2.5× Kim.

   **Falsified** (record it, and the head stays) if the paired median is < +0.1 dB on either set.

   The ensemble ships instead of the best single model only if it adds ≥ +0.15 dB paired with no bleedless loss.
4. **If a candidate passes,** export a new listening session (`p1.py export`, new session id, free port; never touch the owner's running server or sessions). It should hold the winning candidate, SW and Kim on the vocals items. The owner's ratings decide the head order. Until then, propose the map change (Stop point 2) with the numbers, and don't apply it.

## Phase 3: Loud masters (research experiment 2)
1. **Eval first.** Run the Phase 1 gain option on:
   - `limit-XL` for both sets;
   - `musdb-xl` for v2 only;
   - `clean` for both sets, to check for harm.

   Use the shipped heads: Kim and SW for vocals, SW for drums and bass. Sweep `target_lufs` over {−14, −18} and a fixed −6 dB.
2. **Criterion:** paired median uSDR **≥ +0.5 dB on `limit-XL`** for vocals or drums, with `clean` within ±0.1 dB. If `clean` moves, use the `min_input_lufs` rule and re-test.

   **Falsified** if < +0.2 dB: then the RoFormers' limiter loss is distortion, not level. Record it and propose LimitAug fine-tuning as a follow-up only.
3. **Decode clipping.** It is still unfixed: lossy decodes of hot masters peak at 1.05–1.53 and are clipped in the decode cache (`sep-robust/2026-11-07-loud-master.md`).
   - **Measure** how much of the `limit-XL` × codec loss comes from that clip. Use `aac128` and `opus128` applied after `limit-XL`; add that variant if `splitune_eval.variants` lacks it.
   - **Fix it if the effect is ≥ 0.2 dB on any stem,** with the smallest change. The precedent is step 28's stem store: keep samples beyond full scale in a float cache, with no clipping.
   - **This is a cache-format change, so Stop point 2 applies.**
   - **Tests:** a synthetic test (no weights), plus a `models` test that runs a hot AAC master through `decode` → `separate`.
4. **Ship the gain stage** in `separate` only if step 2 passes and the owner OKs it.

## Phase 4: SW chunk length and autocast (research experiment 3)
1. **Chunk matrix.** Run SW at today's 9.29 s, 13.35 s (588,800 samples) and 20 s (882,000 samples). For each:
   - all five SW outputs on both sets × {`clean`, `aac128`};
   - `p1_fullsong.py` on the five full songs, for seam ratio, time and peak VRAM.
2. **Chunk criterion:** paired median **≥ +0.1 dB on ≥ 3 of the 5 SW instruments**, with none below −0.1. In addition:
   - the bass seam ratio is not above today's 1.0 dB;
   - time ≤ 1.25×;
   - peak VRAM fits comfortably in 12 GB, measured.

   **Falsified** if every instrument is within ±0.05 dB. Record it; a null result is plausible here because the Multisong evidence is confounded.
3. **Autocast** on every RoFormer in the map:
   - **Ship** if the regression suite shows no breach and time ≤ 0.8× on the PC. Report the Mac separately: MPS autocast behaviour differs.
   - **Determinism:** fp16 may break bit-identical repeat runs. Measure repeat SDR and state the tolerance.

## Phase 5: Keys fallback for synth and organ (research experiment 4)
1. **Eval, on the 25 `moisesdb-p1` piano windows.**
   - Run, keeping stems:
     - the Mega-53 `organ`, `keys`, `synth`, `piano` and `digital-piano` heads;
     - the X-LANCE `syn_mss` → `syn_mss1` chain, run as `ans.py` does (`syn_mss1` takes `syn_mss`'s output);
     - X-LANCE `key_mss`.
   - Score each against the `piano + other_keys` reference.
   - Then build routed virtual models: SW piano, unless SW's piano is < −40 dB vs the mixture, in which case use one of these fallback sums:
     - organ + synth;
     - keys + synth;
     - organ + X-LANCE synth;
     - and so on.
2. **Criterion:**
   - the 3 silent windows (`664cc931-piano`, `737356b2-piano`, `765d5131-piano`) reach a **median ≥ +3 dB uSDR**;
   - the router never triggers on a window where SW scores ≥ 3 dB;
   - the median over all 25 windows rises.

   **Falsified** if the silent windows stay < 1 dB.
3. **Out-of-sample check.** X-LANCE trained on MoisesDB, and Mega-53's data is undisclosed, so validate on 3–5 non-MoisesDB synth- or organ-heavy items.
   - Use Slakh2100 test mixes with organ or synth parts (CC BY 4.0, mono: fold the reference the same way). Download only those tracks if the full set is too big, and give the size in the plan.
   - Owner-supplied clips with stems are welcome. Make them an owner action, not a dependency.
   - Report the out-of-sample uSDR; the fallback ships only if it is ≥ +2 dB there too.
4. **Production design** (Stop point 2: a map change, and possibly a contract change). If it passes:
   - add a `fallback_when_silent` block to the `piano` instrument, modelled on `solo_check`:
     - the silence threshold;
     - a tagger condition, using the existing `tag` stage's keys/organ/synth scores. Measure the tag scores on the 25 windows and choose the condition so it fires on the 3 silent windows and on no window where SW works;
     - the fallback models and how they combine.
   - Record which model produced the stem, so the UI can label it "keys/synth" and set its quality hint (spec 06 quality hints). If that needs a contract field, go through `packages/contracts` + `pnpm contracts:gen`.
   - Write tests: routing on synthetic stems, plus a `models` test on one silent window when the weights and data are present.

## Phase 6: Shift averaging for drums and bass (research experiment 5)
1. **Matrix.** Run SW with `shifts` 3 and 5 on both sets × {`clean`, `aac128`}.
2. **Criterion:**
   - paired median **≥ +0.15 dB on drums or bass**;
   - fullness up;
   - bleedless no more than 2 points lower.

   The cost is about 3× for shifts 3 and 5× for shifts 5. Prefer 3 if it gets within 0.05 dB of 5.

   **Falsified** if < +0.05 dB.
3. **Bass "thin" question.** Add bass items to the listening export for SW, SW with shifts and htdemucs_ft. The ratings decide whether the extra time is worth it for bass. Until then, propose with numbers; don't apply.

## Phase 7: Drum kit pieces (optional; only if Phase 0 found the files loadable)
1. **Candidates:** the MDX23C DrumSep 5-stem against today's 6-stem candidate, on drumsep5 (kick, snare, toms, hi-hat, cymbals), run on the drum stem of each item as the pipeline would. MVSep reports gains of +0.3 to +2.1 dB per piece; reproduce them on our scoring.
2. **Swap rule:** if the 5-stem wins on ≥ 4 of 5 pieces, update the register and `eval/p2d_tune.py kitsep` to use it. Record that it has no ride/crash split. P2d's data is gone, so there is no ADT F1 re-check: say so.

## Phase 8: Ship, regress and document
1. **Apply each change the owner OK'd** in the map or stage, one per commit:
   - with an explicit `overlap` for every RoFormer;
   - with a note of which cache keys it invalidates.

   Then run `pnpm eval:regression --update-baseline`. Also run the suite once with a deliberately degraded setting, to show it still fails.
2. **Reports:** `eval/results/sep-improve/<date>-<phase>.md` + `.csv` per phase, each with:
   - exact commands;
   - git sha, library versions, model files and hashes;
   - n, median, mean, p10 and the worst 3 per cell;
   - paired deltas;
   - time and VRAM;
   - the criterion and its verdict, **PASS** or **FALSIFIED**. An inconclusive result between the two thresholds says so.
3. **Docs:**
   - doc 08 implementation notes (step 29): harness extensions, results summary, what shipped;
   - `docs/research/ml/separation-improvements-2026-11.md`: a "Results (step 29)" section that marks which recommendations held on our harness and which didn't;
   - `docs/status.md` row s29, a `docs/progress-log.md` entry and a `docs/steps/README.md` row;
   - `CLAUDE.md` Commands, if a new command appears.

## Deliverables and checks
- Code and tests as above. Long GPU jobs run in the background with per-clip resume, because the RTX 3060 has crashed under sustained load before.
- **Verify and report exact commands and results:**
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`;
  - `cd services/ml && uv run --no-sync ruff check && uv run --no-sync pyright && uv run --no-sync pytest`, plus the `models`-marked separation tests with weights present;
  - `pnpm eval:regression` against the final baseline.
- **Commits:**
  - Conventional Commits on `impl/29-separation-improvements`, explaining why;
  - files staged explicitly (`git add -f` for new files under `docs/`);
  - no weights, audio or datasets in git;
  - no push, PR or merge unless asked.
- **End with the owner actions list:**
  1. rate the new listening session (vocals head, bass shifts);
  2. OK or reject each proposed map, contract or cache change, each listed with its numbers and the cache keys it invalidates;
  3. optionally supply 3–5 synth- or organ-heavy clips with a keys stem for the out-of-sample check.
