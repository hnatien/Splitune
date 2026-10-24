# Step 23 — Vocal accuracy: a real pitch curve, monophonic notes, measured and calibrated

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/progress-log.md` entries for steps **06** (eval harness), **07 / 07b** (separation, P1 and the overlap sweep), **08** (notes, calibration, finalize, P2/P6), **18** (piano: how a transcriber was chosen, calibrated and shipped end to end — follow that pattern) and **18c** (vocal Melody view: `buildMelody`, phrases, `MelodyRoll`).
- `docs/specs/05-analysis-schema.md` (`notes.*`, the optional `f0` track, `recommended_view` with vocals → `f0`), `specs/06-ml-pipeline-service.md` (stage graph, islands, cache keys; the planned `f0.vocals` / `rmvpe` row), `specs/08-evaluation-harness-and-prototypes.md` (P1, P2 definitions and gates), `specs/12-practice-screen-and-notation.md`, docs `26`–`28` (UI rules), `specs/25-personal-mode.md` (any model or dataset is allowed; licences are a provenance record, not a gate).
- Research: `docs/research/ml/transcription-vocals-melody.md` (RMVPE, SwiftF0, PESTO, CREPE, pYIN, ROSVOT, VOCANO, YourMT3+; MIR-1K, MIR-ST500, Molina, M4Singer; "show singers a curve, not just notes"), `docs/research/ml/source-separation.md`, `docs/research/ml/source-separation-model-comparison.md`, `docs/research/ml/datasets-metrics-and-licensing.md`. These are from 2026-10-20: re-check for newer trackers, note segmenters and released weights before choosing.
- Current results: `services/ml/eval/results/p1/2026-10-21-overlap.md` (Kim Mel-Band RoFormer 11.70 dB median vocal uSDR at `overlap: 11`, viperx 12.23, BS-Roformer-SW 12.04; Kim 136 s per full song), `p2/2026-10-21.md` and `p2/2026-10-23.md` (**vocals never evaluated**: `basic_pitch {min_freq_hz: 65, max_freq_hz: 1400}`, `quality_gate: none`).
- Code: `services/ml/config/{separation,notes}.personal.yaml`, `views.yaml`, `config/calibration/` (no vocals table: confidence is identity-calibrated); `services/ml/packages/stage_separation` (`separate.py`, `models.py`, `stem_post.py`, `dsp.py`); `services/ml/packages/stage_notes` (`stage.py`, `transcribers.py`, `basic_pitch.py`, `vocals.py`); `services/ml/eval/` (`p1.py`, `p2.py`, `splitune_eval`); `scripts/fetch_models.py`; `compliance/register/models/*.yaml`; `packages/contracts/src/analysis/notes.ts` (`F0Track` exists, **nothing writes or reads it yet**); `packages/music-core/src/melody/build-melody.ts`; `packages/notation/src/{melody.ts,melody-roll.tsx}`; `apps/web/app/features/practice/{vocal-melody.tsx,phrase-strip.tsx}`; `apps/node-worker/src/finalize.ts`.

Prerequisites: MVP (steps 01–17) and the vocal Melody view (18c) on `dev`. Branch `impl/23-vocal-accuracy` from the current `dev`. This is an ML step: **every production change is decided by numbers on the test set**, never by a paper's claim.

## Why this step exists (review of 2026-10-24)
Separation is good enough; transcription is the weak link:
1. `notes.vocals` runs Basic Pitch's **polyphonic** decoder with `melodia_trick: True` on a single voice. Expect octave ghosts from harmonics, notes from reverb tails, backing-vocal harmonies, and vibrato/slides broken into flickering semitone notes.
2. Nothing enforces monophony: `buildMelody` passes overlapping notes through, and phrase letters (`sameMelody`: exact pitch-class match, one miss) rarely match on noisy notes.
3. No vocal eval, no calibration table, `quality_gate: none`. Confidence bands (which drive the pitch range, each phrase's first note and how notes are drawn) are raw onset posteriors, low for soft sung onsets.
4. The spec'd vocal view is an **f0 curve** (doc 05, `views.yaml` `vocals: f0`, doc 06 RMVPE row); only a note roll was built.
5. Separation side issues: `overlap: 11` equals Kim's chunk, so each 11 s window is separated independently with a hard join (audio-separator divides out its Hamming window, so there is no crossfade); Kim is 2-stem, so vocal analyses never get the `keep` drums/bass extras (chords run mixture-only, no bass-root prior; the mixer shows vocals + backing only), unless the chain falls back to SW; backing vocals and reverb stay in the vocal stem.

## Goal
A singer sees the song's real pitch curve (vibrato, scoops, glides) with clean, monophonic, confidence-calibrated target notes on it, phrases that repeat get the same letter, and every number behind that is measured on a vocal test set within the worker's time budget.

## Phase 0 — Research and plan (stop for the owner)
1. Re-check the research doc against what exists **today**: released weights and licences for RMVPE (and community RMVPE checkpoints used by RVC/so-vits), SwiftF0, PESTO v2, FCPE, CREPE/torchcrepe, pYIN; note segmenters (ROSVOT, VOCANO, YourMT3+ vocals, any 2025–26 singing-transcription model); lead/backing vocal separation models in audio-separator / MSST (karaoke Mel-RoFormers) and any newer vocal separator that beats Kim. Record each with source, licence, weights hash availability, input (mixture or stem), runtime and island (torch vs onnx-cpu).
2. Pick the test set sources (below) and estimate time per full song for each candidate chain on the worker.
3. Write the result as `docs/research/ml/transcription-vocals-melody.md` §"2026-10 re-check" and a short plan (candidates per phase, test set, expected time cost). **Post the plan in chat and wait for the owner's OK** on the test set and the time budget before Phase 1. The owner doesn't sing or play: no reference may depend on owner recordings or owner transcriptions.

## Phase 1 — Vocal test set and baseline
1. References, labelled by tier in every report (never merged into one figure without saying so):
   - **f0 references:** MIR-1K, MDB-melody-synth / MedleyDB melody annotations (vocal tracks), iKala if obtainable; mix clean vocals with real accompaniment (MUSDB18-HQ / MoisesDB other stems) at several SNRs to get band-mix conditions.
   - **Note references:** MIR-ST500 test songs (401–500, audio via yt-dlp, research evaluation only), Molina, any public set with sung-note labels found in Phase 0.
   - **Separation:** MUSDB18-HQ / MoisesDB vocal stems (uSDR as in P1), plus songs with prominent backing vocals and reverb.
   - **The owner's kind of songs:** 10–20 excerpts from the owner's library with no reference, scored only by listening checks and agreement between trackers; label them "unreferenced".
2. Target ~30–50 excerpts of 20–40 s tagged by style: solo lead, lead + backing vocals, heavy reverb/delay, wide vibrato/melisma, rap/spoken, falsetto/high, low male, dense mix vs sparse. Manifests go in `services/ml/eval/sets/`; audio stays out of git.
3. Extend the harness (`eval/p2.py` or a new `eval/p2v.py` in the same style) so one command reports, per tag and overall: **f0** (RPA, RCA, OA, voicing recall / false alarm, at 10 ms), **notes** (COnPOff / onset F1, onset+offset F1, pitch-class F1, raw overlap rate = share of frames with >1 active note), **phrases** (share of repeated phrases given the same letter, where references allow), and **time per 30 s** on the worker. Results go to `services/ml/eval/results/p2v/<date>.md` + `.csv` with git SHA and model versions.
4. Run today's production chain (Kim → Basic Pitch with current params → `buildMelody`) as the **baseline row**.

## Phase 2 — Quick wins (ship each one only if it wins)
- `notes.vocals` without `melodia_trick`, with thresholds swept on held-out data.
- A monophony pass in the notes stage (or in `buildMelody`, whichever owns it — explain the choice): one note at a time, keep the most confident, trim overlaps; merge same-pitch fragments separated by tiny gaps.
- Kim `overlap: 10` (≈1 s crossfade, ~+10% time) vs `11`: uSDR, a listening check at the window joins of a soloed vocal, and downstream note F1. Changing the map changes cache keys; say so.
- Fit `config/calibration/basic-pitch@0.4.0.vocals.json` so the baseline's bands mean something even if Phase 3 replaces it.

## Phase 3 — Pitch curve (f0)
1. Candidates: RMVPE (on the mixture and on the Kim stem), SwiftF0 and PESTO on the stem, CREPE/torchcrepe, FCPE, pYIN as a floor, plus any newer tracker from Phase 0. Measure RPA/RCA/OA and voicing on the test set, and time.
2. Ship the winner as a stage (new `f0.vocals` stage per doc 06, or inside `notes.vocals` — pick the smaller change and explain cache-key and island consequences). Write `F0Track` (`hop_s`, `hz`, `voicing_prob`) into `notes.vocals`; respect doc 05's open question on size: if the JSON exceeds ~1 MB for a long song, measure and propose the binary option instead of silently changing the contract. Any contract change goes through `packages/contracts` and `pnpm contracts:gen`.
3. Octave-consistency smoothing and voicing hysteresis as switchable, measured passes.
4. Register record, `fetch_models.py` entry and weights hash for every shipped model; island dependency changes documented in `specs/00-tech-stack.md`.

## Phase 4 — Notes from the curve
1. Candidates: (a) segmentation of the shipped f0 (median filter, voicing gate, pitch-stability + onset-strength boundaries, a minimum note length, vibrato held as one note at its centre pitch); (b) a learned segmenter (ROSVOT, VOCANO or a newer one) on the stem; (c) YourMT3+ vocals; (d) the Phase 2 Basic Pitch best. All must output monophonic notes.
2. Confidence from the tracker's voicing and pitch stability over the note (or the model's own score), calibrated per `config/calibration/`; refit bands so `buildMelody`'s range and phrase starts use real confidence.
3. Re-run phrase lettering on the winner and tune `sameMelody` tolerance (e.g. allow small timing/length slack) only if it measurably helps.
4. Update `notes.personal.yaml`, register, `views.yaml` (`quality_gate` and a `changes` entry) for the winner, as step 18 did for piano.

## Phase 5 — Separation for vocals (only what the numbers support)
- Lead vs backing: try a karaoke / lead-vocal model on the Kim stem (or as the head) on the lead+backing tag; ship if it improves note F1 and f0 OA on that tag without hurting the rest.
- Extras for vocal analyses: decide with numbers whether chords and the mixer need drums/bass for vocals (e.g. run a cheap `htdemucs_ft` or reuse a cached SW run for the extras) and what it costs in time; ask the owner before adding more than ~30 % to a vocal analysis.
- Re-check whether a newer vocal separator beats Kim on uSDR **and** downstream f0/notes within time.

## Phase 6 — Show the curve in the Melody view
- Draw the f0 curve in `MelodyRoll` behind the notes, voiced frames only, line weight or style by voicing confidence (never colour alone), with notes as targets on top; follows `prefers-reduced-motion` like the roll does today. Keep the existing roll as the fallback when `f0` is absent (old analyses).
- Data stays off the main thread like the rest of `buildMelody` (web Worker); the view still loads on demand outside the practice route's JS budget — report before/after bytes for the route and the lazy chunk.
- Semantic tokens and `apps/web/app/ui` components only; stories for every state (with curve, without curve, low voicing, reduced motion, light/dark) and `pnpm --filter web test:stories`. If the visual design needs a choice, make a mockup in `docs/specs/assets/18c/` style and ask the owner before building.

## Constraints
- No change to production defaults without a win on the test set; report every candidate, including losers.
- Time budget: report full vocal-analysis time on the worker before and after; ask the owner before shipping anything that adds more than ~30 % to a vocal analysis.
- Personal mode: any model or dataset is allowed, but every shipped model gets a register record with its source and hash; weights come from `fetch_models.py`, never git. Datasets and audio stay out of git.
- Times are seconds on the decoded-PCM timeline; vocal notes stay unquantized (phrasing is the point), quantization remains separate.
- Don't re-litigate guitar, bass, piano or drums paths.

## Out of scope
Live mic pitch and scoring (step 20), lyrics transcription/alignment, harmony-part transcription (backing vocals as separate parts), key/transposition features beyond what `buildMelody` already does.

## Acceptance criteria
- Owner approved the Phase 0 plan; test set manifests exist (no owner-sung material); baseline row recorded.
- One report table per phase (overall and per tag): baseline vs every candidate vs shipped, with time per 30 s.
- Shipped chain beats the baseline on the test set: f0 metrics (new), note F1 and onset+offset F1, overlap rate ≈ 0, calibrated confidence (reliability plot or ECE in the report); margins and stability across tags stated.
- `notes.vocals` carries a contract-valid `f0` track; real songs from the owner's library re-analysed end to end on the worker; the Melody view shows the curve with notes; viewed in the local app with screenshots.
- Docs updated: `05` (f0 decision incl. size), `06` (stage/config/islands), `08` (P2v definition and results), `docs/research/ml/transcription-vocals-melody.md` (what was measured), `12` if the view changed; an honest note on the remaining ceiling per tag; PROGRESS entry.

## Verification to run and report
`cd services/ml && uv run ruff check && uv run pyright && uv run pytest`, the P2v report commands, `pnpm contracts:check`, `pnpm lint`, `pnpm typecheck`, `pnpm --filter @splitune/music-core test`, `pnpm --filter @splitune/notation test`, `pnpm --filter web test:stories`, node-worker/api tests if touched, the practice route bundle report, end-to-end vocal analysis timings on the worker, and the production-worker update steps the owner must run after merging (`git pull`, `uv sync` for the affected island, `fetch_models.py`, `pnpm workers restart`).
