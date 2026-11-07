# Step 30 — Drum-kit pieces: separate kick, snare, toms and cymbals, and practise one piece

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/progress-log.md` entries for:
  - **step 25** (drums): the P2d harness, `notes.drums`, the drum grid and staff, the quality gate, and the blocked DrumSep kit split;
  - **step 28** (separation evaluation on real-song conditions): MoisesDB windows, loud masters, MSST metrics, silent-reference rule;
  - **step 29** (separation improvements): its Phase 0 loadability check and its Phase 7 choice between the 5-stem and 6-stem MDX23C DrumSep;
  - **steps 07 / 07b**: separation, `stem_post`, mix-minus.
- Research (2026-11-07):
  - `docs/research/product/additional-instruments.md` §6.2: the MVP path and the proposed success criteria for this step.
  - `docs/research/ml/other-instruments-feasibility.md`: §2.1 (MoisesDB per-piece drum tracks), §2.2 (drumsep5 leaderboard), §3.14.
  - `docs/research/ml/separation-improvements-2026-11.md`: §2 (drum sub-stems: 5-stem vs 6-stem MDX23C, mirrors, deleted original hosts), "Ranked candidates → Drums" #5 and cross-cutting #2 (pin our own hashed copies).
  - `docs/research/ml/transcription-drums.md`: Riley & Dixon's separation-assisted 7-class route, STAR Drums, LarsNet.

  These are recent. Still re-check for newer drum separators and released weights before choosing.
- Specs:
  - `specs/25-personal-mode.md`: any model or dataset is allowed; licences are a provenance record, not a gate. Never create, scale or enable billable Railway or Cloudflare resources without asking.
  - `specs/05-analysis-schema.md`: stems, `notes.drums`, `drum_grid`.
  - `specs/06-ml-pipeline-service.md` §0, §2, §4: `separate`, `stem_post`, islands, GPU slot, cache keys.
  - `specs/08-evaluation-harness-and-prototypes.md`: P1, P2d and the implementation notes for steps 25, 28 and 29.
  - `specs/11` (audio engine, multi-stem playback) and `specs/12` §7 (mixer).
  - `specs/21-v1-features.md` V6 (drums).
  - `specs/26–28`: design system, screens and copy, UI quality and design QA checklist.
- Code:
  - **ML:**
    - `services/ml/config/separation.personal.yaml`: the drums chain `bs_roformer_sw → htdemucs_ft → htdemucs_6s`, `keep: [drums, bass]`, and the `mix_minus` modes.
    - `services/ml/config/notes.personal.yaml`: the drums params.
    - `services/ml/packages/stage_separation/src/stage_separation/{separate,stem_post,models,config,dsp,encode}.py`.
    - `splitune_ml_core/stages.py`.
    - `stage_notes/{drums,drum_kit,adtof}.py`.
    - Eval: `eval/p2d.py`; `eval/p2d_tune.py`, whose `kitsep` and `kit` subcommands were written in step 25 (step 29 Phase 7 may have updated `kitsep`); `eval/p1_moisesdb.py` (window selection); `eval/sets/p2d.yaml`; any step 29 kit-piece harness.
    - `scripts/fetch_models.py`.
    - `compliance/register/models/mdx23c-drumsep.yaml`, and any DrumSep record step 29 added.
  - **Contracts:** `packages/contracts/src/analysis/{stems,separation,notes,common}.ts`. `Stem.stem_id` is a free string; check the `ArtefactKind` regex in `common.ts`. Also `instruments.ts` (the drums profile, flag `v1.drums`) and `api/flags.ts`.
  - **Orchestration:** `apps/api/src/pipeline.ts`, `apps/node-worker/src/{finalize,views}.ts`.
  - **music-core:** `drums/build-drums.ts`, `level/drums.ts`, `export/alphatex-drums.ts`, `quantize/quantize.ts`.
  - **Web and notation:**
    - `packages/notation/src/drum-grid.tsx`: `DRUM_LANES` is a fixed list.
    - `packages/notation/src/alphatab-view.tsx`.
    - `apps/web/app/features/practice/`: `model/mixer.ts` (its header says the MVP mixer plays two stems, part + mix-minus, and that "multi-stem mixing is v1"), `mixer-drawer.tsx`, `chord-sheet.tsx` (the drum views), `input-mapper.ts` (keyboard and pedal), `practice.stories.tsx`, `practice-story-data.ts`.
    - `packages/audio-engine/src/dsp.ts`: `MAX_STEMS = 8`.
    - `apps/web/messages/en.json`.

**Prerequisites:** step 25's work on `dev` (it is), and step 29 on `dev`, or at least its DrumSep loadability check and Phase 7 verdict. If step 29 hasn't run or skipped Phase 7, this step's Phase 0 and Phase 1 make that comparison. Branch `impl/30-drum-kit-pieces` from the current `dev`. If the step is large, split it into `impl/30a-…` (ML and eval), `30b` (contracts and orchestration) and `30c` (web), each shippable behind the flag.

**The owner doesn't play an instrument.** No deliverable may depend on owner-played recordings or owner transcriptions. Use datasets, rendered MIDI, published scores and scripted tests. The owner can choose songs, listen, look at screens and run things on their devices.

**This is a measurement-first step.** Every production choice (model, chain, which pieces ship, quality thresholds) is decided by numbers on the eval set, never by a leaderboard claim.

## What exists today (don't rebuild)
- **`notes.drums`:** ADTOF Frame_RNN, 5 classes (BD SD TT HH CY), per-class thresholds, margin confidence, a calibration table. It is scheduled behind `v1.drums`.
- **Drum views:** the drum grid and the alphaTab drum staff, with levels `core_groove` / `simplified` / `as_transcribed`, and a quality gate (0.80) with a confidence floor of 0.75.
- **A drum stem from BS-Roformer-SW,** kept for the mixer and for chords' `no_drums` input.
- **5-class kit defaults** in `drum_kit.py`: hi-hat closed, toms on 47, cymbals crash on a downbeat after a 1 s gap and ride otherwise. All are flagged `approximate`.
  - Step 25 measured kit-piece accuracy: hi-hat open/closed 0.77–0.92, crash/ride 0.30 (MDB) to 0.97, tom line 0.00–0.38.
- **`mdx23c-drumsep`:** the 6-stem aufr33 + jarredou model (438 MB) is downloaded and registered.
  - Loading it was blocked in step 25 by this PC's safety rule for code from external sources.
  - `p2d_tune.py kitsep` / `kit` exist; step 29 Phase 7 may have run `kitsep` and swapped in the 5-stem model.
- **P2d's data is gone,** per step 29. Check `~/datasets` before relying on it.

Nothing separates drum pieces in the pipeline, nothing plays them, and the drum views can't focus a lane.

## Goal
A drummer can practise one piece of the kit against their own song:
- hear the kick, snare, toms or cymbals alone, or the song with that piece removed ("drums minus snare");
- see that piece's lane highlighted in the drum grid and staff;
- loop, slow down and count in with the existing tools.

Piece stems that are rough (expected: hi-hat and cymbals) carry honest quality hints. Kit-piece choices (crash/ride, open/closed hi-hat, tom lines) improve from the separated pieces only where the numbers show it. With the flag off, or when piece separation fails, everything behaves exactly as step 25 left it.

## Phase 0 — Re-check, eval plan, owner decisions (stop for the owner)
1. **Start from step 29's verdict.** Record which DrumSep model step 29 found loadable and which won its Phase 7 swap rule. Re-check only what it didn't cover. For each candidate still open, record:
   - source URL and sha256;
   - output stems: does it split hi-hat from cymbals, and crash from ride? Are toms one stem or several?
   - input expectations ("drum track only");
   - size, VRAM peak and time per 30 s on the RTX 3060;
   - loader: audio-separator's MDXC arch vs MSST code;
   - licence (record, don't gate).

   Candidates, at least:
   - the 5-stem MDX23C DrumSep (mirror only; original host deleted; licence undocumented; +0.28 to +2.11 dB per piece over the 6-stem but loses the ride/crash split);
   - the 6-stem MDX23C in our register (drumsep5: kick 14.55, snare 9.79, toms 10.64, hi-hat 3.20, cymbals 6.08);
   - DrumSep Mel-RoFormer v2 (4 stems; kick 18.67, snare 13.56, toms 13.61, hh+cymbals 8.77; are weights downloadable?);
   - jarredou's BS-RoFormer DrumSep small;
   - DrumSep SCNet XL;
   - LarsNet (CC BY-NC weights, 562 MB, nSDR on StemGMD);
   - anything newer in MSST or audio-separator.
2. **The loading constraint.** If step 29 didn't resolve it, explain exactly what step 25's block was. Propose a safe path:
   - load through audio-separator's supported architecture with weights-only or safetensors loading, verified against hashes in `compliance/register`;
   - if any path needs arbitrary code from an external repo, the owner runs or approves it.

   Do not work around the safety rule. Pin our own hashed copies, because the original hosts are gone.
3. **Eval sets.** First check what is on disk under `~/datasets` (the `D:\datasets` junction). List any downloads with their sizes.
   - **Piece separation:**
     - drumsep5 (https://huggingface.co/datasets/MusicDemixingBenchmarks/drumsep5): drum-only tracks with per-piece references. Give its size.
     - MoisesDB songs with per-piece drum tracks: kick and snare 202 songs, toms 136, hi-hat 115, cymbals 90, overheads 108. Overheads carry hi-hat and cymbal bleed: decide how references are built and say so.
     - 40 windows of 30 s, picked from references only as `eval/p1_moisesdb.py` does. Score each on SW-separated drums (the real condition) and on the oracle drum sum (the separator's ceiling).
     - ENST-Drums per-piece mic channels, if present.
     - Optionally a StemGMD subset (CC-BY-4.0; the full set is 1.13 TB, so pick ≤ 20 GB).
     - Exclude silent references from SDR aggregates and score them as leakage (step 28 rule).
   - **Transcription and kit pieces:** the P2d set (48 items, six tiers) for regressions and kit-piece accuracy. If its data is gone, propose rebuilding it from `eval/sets/p2d.yaml` and the step 25 renderers (size and hours), or say which checks Phase 3 must skip without it.
   - **Listening:** 10 songs with drums from the owner's library (acoustic rock/pop, electronic, ballad with brushes, live). The owner listens; nobody performs.
4. **Storage and time budget.**
   - Estimate the extra R2 bytes per song for the piece stems at the stem contract's bitrates, against the free tier in `specs/25`.
   - Estimate analysis-time cost against step 25's cap of about 30%.
5. **Post the plan** (candidates, eval sets, downloads, hours, storage and time estimates) **and wait for the owner's OK** before Phase 1.

## Phase 1 — Harness and baseline
1. **Extend the eval harness.** Reuse step 29's kit-piece scoring if it exists. Otherwise either add `eval/p2k.py` or add a subcommand to `p2d.py`; decide which and say why. It must report per piece and per tag (acoustic rock/pop, electronic/drum machine, brushes, live, and loud master via step 28's limiter conditions):
   - uSDR, SI-SDR, and MSST bleedless/fullness (already used in step 28);
   - leakage on silent references;
   - the mix-minus quality of `drums − piece` against the reference sum of the other pieces;
   - time per 30 s and VRAM peak.

   Run the shipped stage code in-process. Write results to `services/ml/eval/results/p2k/<date>.md` + `.csv` with the git SHA and model versions, and add the definition to specs/08.
2. **Baseline rows:** the model step 29 chose, its runner-up, and any Phase 0 candidate that loads, all on SW-separated drums. **Stop and show the owner the baseline before Phase 2.**

## Phase 2 — The drum-piece separation stage
1. **Placement.** Decide between:
   - (a) a second-stage chain inside `separate`;
   - (b) a step inside `stem_post`;
   - (c) a new job (for example `separate.drum_pieces`) with a hard dependency on `separate` and a soft one for `finalize`.

   Weigh cache keys, failure semantics, the GPU slot and re-runs, and explain the choice. A piece failure must never fail or degrade the analysis: it is a soft dependency.
2. **Config** in `separation.personal.yaml`: a model-map entry, plus a drum-pieces block (chain, pieces, per-piece quality defaults). Say exactly which cache keys change. Existing drum stems and existing analyses must stay valid.
3. **Stem layout.**
   - Store isolated piece stems plus a residual (`drums − Σ pieces`), so the pieces at unity reconstruct the drum stem.
   - Let the mixer build "drums minus X" by muting X, instead of storing one mix-minus per piece, unless the numbers or the engine say otherwise.
   - Report the bytes per song.
4. **Contracts first.**
   - Stem naming (for example `drums.kick`), `kind` (`isolated` / `residual`), and a piece field if `stem_id` alone isn't enough.
   - `quality_hint: rough` by measured threshold; `empty` for pieces with no energy.
   - Change the Zod schemas in `packages/contracts`, run `pnpm contracts:gen`, and update the fixtures. Never hand-edit generated files.
5. **Register and weights:** a `compliance/register/models/<model>.yaml` record with source, licence and sha256 per file. Fetch weights only via `scripts/fetch_models.py`, never from git.
6. **Flag** `v1.drum_pieces`. Schedule the stage only while the flag is on. Decide by measured cost whether it runs for every analysis that keeps drums or only when the requested instrument is drums.

## Phase 3 — Kit-piece choices from the separated pieces (ship only if it wins)
1. Run `p2d_tune.py kitsep` / `kit` with the chosen model: use the piece stems to resolve crash vs ride (only if the model splits them), open vs closed hi-hat (if a model separates hi-hat) and tom lines. Compare against the `drum_kit.py` defaults on P2d's kit references, using Riley & Dixon's 7-class recipe as the reference method.
2. If P2d's kit references are unavailable and the owner declined the rebuild, skip this phase and say so. The defaults stay as they are.
3. ADTOF on the full drum stem stays the source of hits unless the numbers say otherwise. Per-class onset F1 must not regress by more than 0.01 on P2d.
4. Keep `approximate` on every choice that is still a guess. Re-fit per-class calibration if confidence changes.
5. Report losers as well as winners.

## Phase 4 — Practice UI
1. **Mixer.**
   - Piece channels as a collapsible group under Drums, plus presets: "Kick only", "Drums minus snare", and the others.
   - `model/mixer.ts` is two-stem (part + backing). Extend it to the multi-stem case within the engine's `MAX_STEMS = 8`, following `specs/11` and `specs/12` §7. Keep solo-gain and mix-minus semantics consistent.
2. **Lane focus.**
   - The drum grid and staff highlight the focused piece's lane and de-emphasise the others.
   - Focus can be tied to the mixer: focusing "snare" offers "solo snare" and "drums minus snare".
   - Parameterise `DRUM_LANES` only if needed.
3. **Quality hints.** Rough piece stems (expected: hi-hat and cymbals) show a hint. Confidence and quality are never shown by colour alone.
4. **Accessibility and input.** Every new action is keyboard- and pedal-operable through `input-mapper.ts`, to WCAG 2.2 AA.
5. **Design system.** Use semantic tokens and `apps/web/app/ui` components only. Add catalogue copy keys to `en.json`, and pass the doc 28 design QA checklist.
6. **Stories** for every new state, in light and dark (`pnpm --filter web test:stories`):
   - piece channels;
   - rough piece;
   - empty piece;
   - pieces unavailable (fallback to step 25 behaviour);
   - lane focus for each lane.

## Phase 5 — End to end, gate, docs
1. **Local end to end** on the dev stack (`pnpm dev:all`) with 3 songs. Record timings on the RTX 3060; the Mac timings are the owner's to run.
2. **Per-piece gate:** a piece below its measured threshold is hidden or marked rough, and the rule is recorded in config.
3. **Docs**, committed with the step:
   - update the affected specs (05 stems, 06, 08, and 12/21 as needed);
   - add an s30 row to `docs/status.md` and an entry at the end of `docs/progress-log.md`;
   - add a dated note to the research docs wherever your numbers contradict them.

## Acceptance criteria
- **Separation**, on MoisesDB windows from SW-separated drums. These thresholds are the proposals in `additional-instruments.md` §6.2; Phase 0 may revise them with the owner's OK.
  - Median uSDR: kick ≥ 10 dB, snare ≥ 10 dB, toms ≥ 8 dB, cymbals ≥ 4 dB (shipped as rough).
  - Hi-hat ships as its own stem only if it reaches ≥ 4 dB; otherwise it stays inside cymbals.
- **Transcription:** no ADTOF per-class onset F1 regression above 0.01 on P2d. Kit-piece defaults change only where crash/ride or tom-line accuracy beats step 25's baseline.
- **Cost:** analysis time stays within the agreed cap, and the extra storage per song is reported and approved.
- **Listening:** the owner rates "drums minus snare" and "kick only" usable on at least 8 of 10 songs.
- **Safety:** piece separation is a soft dependency; with the flag off the app behaves as step 25; existing analyses are unchanged until re-analysed.
- **Verification**, with exact commands and results reported:
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`;
  - `pnpm --filter web test:stories`;
  - `pnpm contracts:check`, and `pnpm db:check` if the schema changed;
  - in `services/ml`: `uv run --no-sync ruff check`, `uv run --no-sync pyright`, `uv run --no-sync pytest`, including the `models` tests for the new loader;
  - `pnpm eval:regression` if separation config or pins change;
  - `pnpm secrets:scan`.

  Never weaken or skip tests.

## Stop points
1. The Phase 0 plan: candidates, eval sets, downloads (including any P2d rebuild), storage and time.
2. Any loading path that needs code from an external source (the owner decides).
3. The Phase 1 baseline, before building the stage.
4. Before turning `v1.drum_pieces` on in production, or any storage growth that could leave the R2 free tier.

## Out of scope
- Fine-tuning or training a separator.
- A new drum transcriber, or more than 5 ADTOF classes, unless Phase 3 measures a win.
- Hand percussion (cajón, congas) and live mic scoring.

## Git
Work on `impl/30-drum-kit-pieces` (or the `30a`–`30c` sub-branches). Use Conventional Commits that explain why, and stage files explicitly. Never commit weights, audio or secrets. No push, PR or merge unless asked.
