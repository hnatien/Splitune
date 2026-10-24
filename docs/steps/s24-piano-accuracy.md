# Step 24 — Piano accuracy: measure on pop piano, then push separation, Transkun, confidence and clean-up to their ceiling

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/progress-log.md` entries for steps **06** (eval harness), **07 / 07b** (separation, P1), **08** (notes, calibration, P2), **17d**, **18** (piano P2, Transkun stage, hand split, roll) and **18a** (grand staff). Step 18 is the pattern for choosing, calibrating and shipping a transcriber; this step improves what it shipped.
- `docs/specs/21-v1-features.md` V4 and its step-18 implementation notes, `specs/08-evaluation-harness-and-prototypes.md` (P1, P2 definitions and gates), `specs/06-ml-pipeline-service.md` (stage graph, islands, cache keys, `notes.piano` row), `specs/05-analysis-schema.md` (`notes.*`, confidence), `specs/07-music-algorithms.md` (quantize), `specs/25-personal-mode.md` (any model or dataset is allowed; licences are a provenance record, not a gate).
- Research: `docs/research/ml/transcription-piano.md` (Transkun V2 / V2 Aug / KeyOff fine-tune, Aria-AMT, Kong, hFT-Transformer, YourMT3+; MAESTRO, MAPS, SMD, ATEPP; domain gap; PM2S and other hand/staff models), `docs/research/ml/source-separation.md`, `docs/research/ml/source-separation-model-comparison.md`, `docs/research/ml/instrument-recognition.md`. These are from 2026-10-20: re-check for newer piano models and released weights before choosing.
- Current results: `services/ml/eval/results/p2/2026-10-23.md` (Transkun stem onset F1 **0.946** on MAESTRO + band but **0.732** on BabySlakh; acoustic 0.835 vs electric 0.676; mixture 0.489 vs YourMT3+ 0.914; one-knot calibration), `services/ml/eval/results/p1/` (no piano references: piano separation quality was never measured).
- Code: `services/ml/packages/stage_notes/src/stage_notes/` (`stage.py`, `transcribers.py`, `transkun.py`, `yourmt3.py`, `piano.py`); the Transkun package in the torch island (`ModelTransformer.transcribe`, `transcribeFrames`, `CRF/NeuralSemiCRFInterval.py`); `services/ml/config/{separation,notes}.personal.yaml`, `views.yaml`, `config/calibration/transkun-v2@2.0.1.piano.json`; `services/ml/packages/stage_separation` (`stem_post.py`), `stage_tagger`; `services/ml/eval/p2.py` (`build-piano`, `predict`, `calibrate`, `report`), `eval/sets/`; `scripts/fetch_models.py`; `compliance/register/models/*.yaml`; `packages/music-core/src/piano/{build-piano,hands}.ts`, `export/alphatex-piano.ts`, `quantize/`; `packages/contracts/src/analysis/notes.ts`.

Prerequisites: MVP (steps 01–17) and the piano work on `dev` (progress-log steps 17d–18a). Branch `impl/24-piano-accuracy` from the current `dev`. This is an ML step: **every production change is decided by numbers on the test set**, never by a paper's claim. This step owns the piano pipeline items that step 19 used to list (solo-piano path, Aria-AMT, electric-piano gate, PM2S); step 19 keeps wait mode, piano levels and drums.

## Known gaps (code review, 2026-10-24)
Each needs a measurement and a fix or an explicit "measured, not worth it" in the report:
1. **The evaluation flatters the pipeline.** P2 piano is 16 MAESTRO test excerpts + MUSDB band and 17 BabySlakh items. Transkun and YourMT3+ trained on MAESTRO's training split (same Disklavier pianos and rooms), the material is classical, and YourMT3+ trained on Slakh. Nothing resembles pop piano in a band, and the separated piano stem's quality was never measured.
2. **Separation is the biggest loss and always runs.** BabySlakh drops from 0.927 (clean) to 0.732 (stem). Solo-piano detection (21 V4: tagger says piano present, others absent → skip separation) is not built; on MAESTRO, skipping separation is worth about +3 points (0.946 → 0.974 clean). Only `bs_roformer_sw` → `htdemucs_6s` were tried for piano.
3. **Mixture fallback uses the weakest model on mixtures.** With `stems_unavailable` or no piano stem, `notes.piano` runs Transkun on the mixture (0.489 BabySlakh, 0.828 MAESTRO + band); YourMT3+ scores 0.914 / 0.839 there (in-sample on Slakh). `stage.py` uses one transcriber whatever the source.
4. **Confidence is constant.** `transkun.py` sets `confidence_raw=1.0`; the calibration maps it to 0.918, above the 0.7 "high" band, so confidence-aware notation does nothing for piano and there is no lever for filtering doubtful notes. The semi-CRF exposes `forward_backward` / `computeLogZ` (interval marginals), and the interval score, velocity distribution and `refinedOFPredictor` presence logits are all available per note.
5. **Bleed becomes notes (hypothesis).** Stem precision falls to 0.721 on BabySlakh (0.962 clean). Transkun normalizes each 16 s segment to unit variance (`processFramesBatch`), so a segment where the piano is silent has its bleed amplified. No silence gate, no post-filter (velocity, duration, isolated-note), and `notes.personal.yaml` exposes no Transkun params to sweep.
6. **Pedal dropped, offsets mis-scored.** Pedal events (negative pitches) are discarded. Transkun V2's offsets are pedal-extended (research doc: 42.6 KeyOff vs 93.4 PedOff), but P2's references are key-release offsets (`p2.py` "no pedal extension"), so its onset+offset F1 (0.772 clean vs the model card's 0.935) understates the model. The staff draws pedal-held notes as long notes with no pedal marks.
7. **Mono downmix before the model.** `stage.py` averages the stem's channels into one waveform; Transkun's own CLI feeds stereo and the model averages channel power spectra (`MelSpectrum(toMono=True)`). Probably small (training used random channel mixes), but unmeasured.
8. **Candidates never run.** Spec 25 says "Transkun V2 vs Aria-AMT"; Aria-AMT was never evaluated. Transkun V2 Aug (augmentation-trained, MAPS 0.922) and the KeyOff fine-tune (81.9 KeyOff F1) were not tried; confirm which checkpoint the pip wheel's `2.0.pt` is.
9. **Electric pianos and hands are unmeasured downstream.** Electric piano / clavinet / harpsichord score ~0.68 and nothing tells them apart, so they get the Notes view. `splitHands` is a heuristic stand-in for PM2S with no measurement against reference hands.

## Goal
Find the real accuracy ceiling for piano on the owner's kind of songs (pop/singer-songwriter piano, solo and in a band) and reach it: the right input (solo-piano bypass or the best separated stem), the most accurate transcriber for that input, calibrated per-note confidence, bleed clean-up, pedal-aware durations and hands that match a player — each stage measured on its own and end to end, shipped only when it wins, within the worker's time budget.

## Phase 0 — Research re-check and test set plan (stop for the owner)
1. Re-check the research doc against what exists **today**: Transkun checkpoints (V2, V2 Aug, KeyOff), Aria-AMT weights, Kong et al., hFT-Transformer, any 2025–26 piano transcriber with released weights and out-of-domain or pop results; dedicated piano/keys separation models in MSST and audio-separator; PM2S and other hand/staff models (Cluster and Separate, Beyer & Dai). Record source, weights availability, input, runtime and island.
2. Test set sources, best first. **The owner doesn't play**: no reference may depend on owner recordings or owner transcriptions.
   - **Real piano, out of Transkun's training domain:** MAPS ENSTDkCl/ENSTDkAm (real Disklavier), SMD, Vienna 4x22 — solo, and mixed into bands.
   - **Pop-style piano with exact references:** POP909 (or other pop piano MIDI) rendered through several sampled pianos and electric pianos with varied rooms, mics and compression, mixed with real accompaniment from MoisesDB / MedleyDB / MUSDB18-HQ (drums, bass, vocals **and** guitars/keys competing in the piano's register) at several levels. Slakh2100's **test** split (not BabySlakh's training tracks) for programs 0–7.
   - **Separation quality:** MoisesDB / MedleyDB songs with an isolated real piano or keys track (SDR/uSDR of the piano stem); their clean piano tracks transcribed by the best model give pseudo-references, labelled as such.
   - **Hands:** a set with hand labels (PIG, ASAP/ACPAS score staves, or whatever Phase 0 finds); say so if none is usable.
   - **The owner's songs:** 10–20 excerpts from the owner's library with piano (solo covers, ballads, band songs, electric piano), unreferenced: scored by listening checks and agreement between models only.
   Label each tier clearly in every report; never merge their numbers into one figure without saying so. Keep the current P2 piano rows as a labelled "legacy" condition for continuity.
3. Target 30–50 excerpts of 20–40 s tagged: solo acoustic, acoustic in band, sparse vs dense band, heavy pedal ballad, electric piano / Rhodes / Wurlitzer, clavinet/harpsichord/organ-like, piano doubled by guitar or synth, phone-quality/compressed, off-A440. Manifests go in `services/ml/eval/sets/`; audio stays out of git.
4. Write the result as `docs/research/ml/transcription-piano.md` §"2026-10 re-check" and a short plan (candidates per phase, test set, estimated time cost). **Post the plan in chat and wait for the owner's OK** on the test set and the time budget before Phase 1.

## Phase 1 — Harness and baseline
1. Extend the harness (`eval/p2.py` or a new `eval/p2p.py` in the same style, reusing `splitune_eval`) so one command reports, per tag and overall: **separation** (piano stem SDR/uSDR where a clean track exists), **notes** (onset F1/P/R, onset+offset F1 against **both** key-release and pedal-extended references, onset+offset+velocity F1, pitch-class F1, on clean / stem / mixture / the input the pipeline actually chose), **solo-piano detection** (precision/recall of the bypass decision), **electric-piano detection**, **calibration** (ECE and a reliability table), **hands** (per-note hand accuracy where labels exist), **quantization** (residual-flag share) and **time per 30 s** on the worker. Run the shipped stage code in-process and the shipped `buildPianoScore` via the music-core CLI, so the evaluated code is the shipped code. Results go to `services/ml/eval/results/p2p/<date>.md` + `.csv` with git SHA and model versions.
2. Re-run today's production chain (BS-Roformer-SW → Transkun V2 mono, pedal dropped, constant confidence → `buildPianoScore`) as the **baseline row**. Every later phase compares against it. **Stop and show the owner the baseline and the phase plan with time estimates before Phase 2.**

## Phase 2 — Cheap wins on the current model (each measured alone, then combined)
- **Mixture fallback** (gap 3): route `notes_on_mixture` to the best mixture transcriber (YourMT3+ unless the test set says otherwise), keeping `fallback` / `notes_on_mixture`. The transcriber choice per source becomes config in `notes.personal.yaml` and part of the cache key; calibrate each path separately.
- **Stereo input** (gap 7): feed the aligned stereo stem to Transkun as its CLI does; ship only if it wins.
- **Silence gate and post-filter** (gap 5): gate stem regions far below the stem's own loudness before inference (or drop notes whose onset falls there), then sweep minimum velocity, minimum duration and isolated-note filters on held-out data. Expose the kept params in `TRANSKUN_DEFAULTS` so they live in config and the cache key.
- **Segment and hop**: sweep `segment_s` / `hop_s` (and `discardSecondHalf`) only if the join regions show errors.
- **Checkpoints** (gap 8): Transkun V2 Aug and the KeyOff fine-tune, if released, through the same harness.

## Phase 3 — Per-note confidence (gap 4)
1. Candidates: semi-CRF interval marginals (from `forward_backward`/`computeLogZ`), the decoded interval's score margin over the noise score, velocity distribution peak, and agreement with a second transcriber (YourMT3+ on the same input). Measure how well each separates correct from wrong notes (AUROC, precision at the band thresholds).
2. Ship the best as `confidence_raw`, refit `config/calibration/transkun-v2@<version>.piano.json` with real knots on held-out notes, and check that the bands now mean something (share of notes per band, precision per band, ECE).
3. Use it: a confidence floor for dropping notes only if it beats Phase 2's post-filter; otherwise the notes stay and the UI's existing confidence encoding shows them.

## Phase 4 — Input choice and separation (gap 2)
1. **Solo-piano bypass:** use the tagger (`stage_tagger`, piano present and the other instruments below their absent thresholds), and if PANNs is too weak, add a cheap check (e.g. energy left in the non-piano stems of a fast separator). Measure the decision's precision/recall and what it does to note F1 on solo and band material; a wrong bypass on a band song is the costly error, so pick the threshold for that. Record the decision in the analysis (contract change through `packages/contracts` if a field is needed) and skip separation when it fires.
2. **Separation candidates for band material:** current `bs_roformer_sw`, dedicated piano/keys models from MSST/audio-separator, `htdemucs_6s`, and ensembles (average of two models; vocal/drum/bass removal first, then a piano model on the remainder). Measure piano stem SDR **and** downstream note F1 — the second decides. State time per 30 s; a chain that is much slower needs the owner's OK.
3. Ship the winner via register records, `separation.personal.yaml` and `fetch_models.py`, following step 07's pattern. Changing the map changes cache keys; say so.

## Phase 5 — Transcriber choice and ensembles (gap 8)
1. Aria-AMT, Kong et al., hFT-Transformer and any newer model from Phase 0, through the `NoteTranscriber` interface in the island that fits, on the Phase 4 input. Fix each model's setup (sample rate, channels, loudness, windowing) before judging it.
2. Ensembles: per-note fusion of the best two (e.g. Transkun + YourMT3+ or Aria-AMT), keeping agreed notes and weighting by calibrated confidence; report precision/recall trade-offs, not just F1, and the time cost.
3. Fine-tuning is allowed if released models plateau: fine-tune the best checkpoint on rendered pop piano with separation in the loop (inputs passed through the Phase 4 separator) and room/mic/codec augmentation. Never train on any excerpt, song or performance in the test set; report hardware, hours and data sizes (the CUDA worker host from step 09c may be used if the owner has it running).
4. Update `notes.personal.yaml`, the register, calibration and `views.yaml` (`quality_gate` and a `changes` entry) for the winner, as step 18 did.

## Phase 6 — Pedal, durations, electric pianos and hands
1. **Pedal** (gap 6): keep Transkun's sustain-pedal events in `notes.piano` (contract change: a pedal track with on/off times, through `packages/contracts` and `pnpm contracts:gen`). In music-core, derive key-release-like durations for the staff when the pedal is down (and decide with the test set whether the roll should show sounding or played length), and add pedal marks to `export/alphatex-piano.ts` if alphaTab supports them. Measure onset+offset F1 against both reference conventions before and after; refresh the piano staff/roll stories for the changed rendering.
2. **Electric-piano gate** (gap 9): a per-song signal (tagger piano/e-piano/organ classes, a timbre check on the stem, or the Phase 3 confidence distribution) that lowers the gate result to Chart for songs the transcriber handles badly; measure on the electric-piano tag and make sure acoustic songs keep the Notes view.
3. **Hands** (gap 9): try PM2S (and any better released hand/staff model); replace `splitHands` only if it agrees better with reference hands, within the music Worker's budget (or as an ML stage writing hands into `notes.piano`, if that is the smaller change — explain). Report `splitHands` accuracy either way.
4. **Quantization:** report residual-flag rates per tag; touch `quantize/` only if piano parts snap measurably worse than guitar parts, and keep it idempotent and re-runnable.

## Constraints
- No change to production defaults without a win on the test set; report every candidate, including losers.
- Time budget: report full piano-analysis time on the worker before and after; ask the owner before shipping anything that adds more than ~30 % to a piano analysis (the solo-piano bypass should cut time; report how much).
- Personal mode: any model or dataset is allowed, but every shipped model gets a register record with its source and hash; weights come from `fetch_models.py`, never git. Datasets and audio stay out of git.
- Contracts first: every new field (pedal track, bypass decision, hands if moved to ML) is a Zod change in `packages/contracts` with regenerated Pydantic models and updated fixtures; never hand-edit generated files.
- Every new stage param or config value is part of the stage cache key; say which caches the change invalidates.
- Times are seconds on the decoded-PCM timeline; quantization stays a separate, re-runnable stage.
- Don't re-litigate the guitar, bass, vocal or drums paths.

## Stop points (ask the owner in chat, wait for the answer)
1. Phase 0 plan: test set sources, the owner's songs, time budget.
2. After the baseline row: the phase plan with estimated hours.
3. Any chain that adds more than ~30 % piano-analysis time.
4. Changing the piano default view or the gate behaviour for electric pianos (`views.yaml` `defaults` / `quality_gate`).

## Out of scope
Wait mode and piano levels (step 19), new piano views or practice-screen layout, MIDI export (step 20), mic scoring, fingering numbers.

## Acceptance criteria
- Owner approved the Phase 0 plan; test set manifests exist (no owner-played material), including solo, band, electric-piano and heavy-pedal excerpts and a band condition with instruments competing in the piano's register; baseline row recorded.
- One report table per phase (overall and per tag): baseline vs every candidate vs shipped, with time per 30 s.
- Each of the nine known gaps is either fixed with a measured gain or reported as "measured, not worth it" with the numbers.
- Shipped chain beats the baseline end to end (onset F1 and onset+offset F1 under both offset conventions) on the test set, with calibrated per-note confidence (ECE and per-band precision in the report); margins and stability across tags stated.
- Real songs from the owner's library re-analysed end to end on the worker; contract-valid `notes.piano` (with pedal and real confidence); Notes and Staff viewed in the local app with screenshots.
- Docs updated: `08` (P2p definition and results), `06` (stage/config/islands), `05` (new artefact fields), `21` V4 notes, `docs/research/ml/transcription-piano.md` with what was measured; an honest note on the remaining ceiling per tag. Progress-log entry appended, `docs/status.md` updated.

## Verification to run and report
`cd services/ml && uv run ruff check && uv run pyright && uv run pytest`, the P2p report commands, `pnpm contracts:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm --filter @splitune/music-core test`, `pnpm --filter web test:stories` if piano rendering changed, node-worker/api tests if touched, end-to-end piano analysis timings on the worker, and the production-worker update steps the owner must run after merging (`git pull`, `uv sync` for the affected island, `fetch_models.py`, `pnpm workers restart`).
