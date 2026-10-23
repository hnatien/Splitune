# Step 22 — Guitar accuracy: measure on real songs, then push separation, notes and frets to their ceiling

## Before you start
Read `prompts/implementation/00-shared-context.md`, then:
- `docs/implementation/PROGRESS.md` entries for steps **06** (eval harness), **07 / 07b** (separation, P1), **08** (notes, chords, finalize, P2/P6), **18** (piano P2: how a transcriber was chosen, calibrated and shipped end to end — follow that pattern).
- `docs/implementation/08-evaluation-harness-and-prototypes.md` (P1, P2, P3 definitions and gates), `06-ml-pipeline-service.md` (stage graph, islands, cache keys), `07-music-algorithms.md` §5–§6 (quantize, fret DP, alt fingerings), `05-analysis-schema.md` (`notes.*`, `tab.*`, confidence), `25-personal-mode.md` (any model or dataset is allowed; licences are a provenance record, not a gate).
- Research: `docs/ml/transcription-guitar-and-bass-tabs.md` (candidates: GAPS, Riley, Perceiver-TF, YourMT3+, TART/AudioFret, Fretting-Transformer, MIDI-to-Tab, FretNet, Noise2Fret; datasets GuitarSet, GAPS, Guitar-TECHS, EGDB, DadaGP), `docs/ml/source-separation.md`, `docs/ml/source-separation-model-comparison.md`, `docs/ml/transcription-general.md`, `docs/ml/chords-beats-key-structure.md`. These are from 2026-10-20: re-check for newer models and released weights before choosing.
- Current results: `services/ml/eval/results/p1/`, `p2/2026-10-21.md` (guitar: Basic Pitch stem onset F1 0.797 on GuitarSet + band but **0.368 on BabySlakh**; strumming 0.735 vs solo 0.859; YourMT3+ 0.655 on stems vs 0.797 on mixture), `p3/2026-10-20.md` (fret assignment).
- Code: `services/ml/eval/p1.py`, `p2.py`, `p3_guitarset.py`, `p6.py`, `eval/sets/`; `services/ml/config/{separation,notes}.personal.yaml`, `views.yaml`, `config/calibration/`; `services/ml/packages/stage_separation`, `stage_notes` (`NoteTranscriber`, `TRANSCRIBER_ISLANDS`), `islands/{onnx-cpu,torch}`; `scripts/fetch_models.py`; `compliance/register/models/*.yaml`; `packages/music-core` (quantize, `buildTab`, fret DP, corrections); `apps/node-worker/src/finalize.ts`.

Prerequisites: MVP (steps 01–17) and the piano work on `dev` (PROGRESS steps 17c–18a). Branch `impl/22-guitar-accuracy` from the current `dev`. This is an ML step: **every production change is decided by numbers on the real-song test set**, never by a paper's claim. Bass benefits from the same work; include it where it costs little (same harness, 4/5-string tab), but guitar comes first.

## Goal
Find the real accuracy ceiling for guitar on the owner's kind of songs and reach it: the best separated guitar stem, the most accurate note transcription on that stem, musically informed clean-up, and the best string/fret choice — each stage measured on its own and end to end, shipped only when it wins, within the Mac's time budget.

## Phase 0 — A real-song test set (start here; the owner picks songs, doesn't play)
Every current guitar number is in-sample (Basic Pitch trained on GuitarSet) or synthetic (BabySlakh). Nothing else in this step means much until this exists. **The owner does not play guitar**: no reference can depend on the owner recording or transcribing anything.
1. Write a short plan for the owner and **ask them in chat** before building it: which of their songs to use and which tabs they can get. Reference sources, best first:
   - Official/pro Guitar Pro or MusicXML tabs (publisher editions, Songsterr/Ultimate Guitar "official" tabs) of songs the owner has, aligned to the audio with the beat grid (DTW on onsets where needed). Check the alignment and spot-check the notes against the isolated stem by listening to a sample of bars, and drop excerpts where the tab clearly differs from the recording (live versions, simplified arrangements).
   - Public real-recording sets with note/tab references: GuitarSet held-out players, EGDB, Guitar-TECHS, GAPS test split, IDMT-SMT-Guitar. Mix the solo-guitar ones with real band stems (MUSDB18/MoisesDB accompaniment without guitar) to get band-mix conditions.
   - Multitrack sets with an isolated real guitar track (MoisesDB, MedleyDB) for separation quality (SDR of the guitar stem), even where no note references exist.
   Label each tier clearly in the reports; never mix their numbers into one figure without saying so.
2. Target 20–40 excerpts of 20–40 s covering: distorted electric riffs, clean electric, acoustic strumming, fingerpicking, solos with bends, drop/alt tunings and capo, dense band mixes vs sparse ones. Each excerpt records its source, tuning, capo and style tags in `eval/sets/` (audio stays out of git like the other sets; only manifests and references are tracked where allowed).
3. Extend the harness so one command reports, per style tag and overall: **separation** (SDR/uSDR of the guitar stem where a clean guitar track exists), **notes** (onset F1, onset+offset F1, pitch-class F1 on stem and on mixture), **tab** (string/fret accuracy on correctly detected notes = TDR, and end-to-end Tab F1), **chords** where useful, plus **time per 30 s** on the Mac. Results go to `services/ml/eval/results/p2g/<date>.md` + `.csv` in the existing report style, with git SHA and model versions.
4. Re-run today's production chain (BS-Roformer-SW → Basic Pitch with the current thresholds → music-core fret DP) as the **baseline row**. Every later phase compares against it.

## Phase 1 — Separation (biggest loss on band mixes)
- Candidates: the current `bs_roformer_sw`, dedicated guitar models from the MSST collection and audio-separator (BS/Mel-Roformer guitar models, e.g. 2-stem "guitar vs rest"), `htdemucs_6s`, and ensembles (average or max-magnitude of two models; a vocal/drum/bass removal first, then a guitar model on the remainder). Re-verify which weights exist now.
- Measure stem quality **and** what it does to downstream note F1 — the second is what matters. Watch time per 30 s; a chain that is much slower needs the owner's OK (state the numbers).
- Ship the winner by adding records to `compliance/register/models/`, entries to `separation.personal.yaml` and `fetch_models.py`, following step 07's pattern. Changing the map changes cache keys; say so.

## Phase 2 — Note transcription
1. **Explain YourMT3+'s gap first:** its paper reports 91.65 onset F1 on GuitarSet but it scored 0.655 on stems here. Check program mapping, input sample rate/loudness, model variant, and whether the stem's level or band-limiting hurts it. Fix the setup before judging the model.
2. **Fine-tune for the production domain:** train a Kong-style CRNN (or fine-tune YourMT3+ / the best released checkpoint) on GuitarSet + GAPS + Guitar-TECHS + EGDB + synthetic guitar renders (DadaGP/Slakh-style MIDI through varied amp/effect chains), **with inputs passed through the Phase 1 separator** so training matches what runs in production. Hold out players/songs properly; never train on any song, player or excerpt that is in the test set (public sets: use their held-out splits for testing only). Train on the Mac (MPS) or the CUDA worker host from step 09c if the owner has it running; report hardware, hours and data sizes. Export to ONNX or run in the torch island.
3. **Ensembles:** per-note fusion of the best two or three transcribers (stem and mixture inputs), keeping notes the models agree on and weighting by calibrated confidence; measure precision/recall trade-offs, not just F1.
4. Re-sweep thresholds on held-out data, refit calibration (`config/calibration/`), and update `notes.personal.yaml`, the register and `views.yaml` (`quality_gate` and `changes` entry) for the winner, as step 18 did for piano.

## Phase 3 — Musically informed clean-up (in `music-core` or the notes stage, whichever owns the information)
Each rule is a separate, switchable pass with its own measured gain; drop any that doesn't help on the real-song test set:
- Octave and wrong-semitone correction against the chord and key at that time.
- Onset snapping to the beat grid within a tolerance (quantization stays a separate, re-runnable stage — don't destroy the unquantized times).
- Leakage removal: drop weak notes that duplicate the bass or keys stem's notes at the same time.
- Fragment merging (one held note split into several) and minimum-duration cleanup.
- Strum handling: detect strums, emit them as chord shapes with a strum rhythm (the existing chords/level paths), and measure whether this beats note-by-note output on the strumming tag.

## Phase 4 — Strings and frets (tab accuracy)
- Measure the current fret DP's TDR and Tab F1 on the real-song test set (P3 numbers are on GuitarSet only).
- Train a learned fret assigner (Fretting-Transformer / MIDI-to-Tab style, conditioned on tuning and capo) on DadaGP and other tab corpora; optionally add audio-informed string choice (per-note timbre embedding, TART "AudioFret" idea). It must keep `alt_fingerings`, the `easiest` / `as_played` modes, span limits and `unplayable` marking that the contracts and UI rely on.
- Ship it only if it beats the DP on the real-song test set; it can run in the Node finalize (ONNX) or as a Python stage feeding `tab.guitar` — pick the smaller change and explain. Contract changes, if any, go through `packages/contracts` and `pnpm contracts:gen`.

## Constraints
- No change to production defaults without a win on the real-song test set; report every candidate, including losers.
- Time budget: report full-analysis time on the Mac before and after; ask the owner before shipping anything that adds more than ~30 % to a guitar analysis.
- Personal mode: any model or dataset is allowed, but every shipped model gets a register record with its source and hash, and weights are fetched by `fetch_models.py`, never committed. Datasets and audio stay out of git.
- Don't re-litigate the piano or drums paths.

## Out of scope
UI changes (the guitar Notes view is step 21), mic scoring, technique detection beyond what Phase 2 models already output (bends), drums.

## Acceptance criteria
- Real-song test set exists with the owner's approval of the song list and a manifest (no owner-played material); baseline row recorded.
- One report table per phase on the real-song test set (overall and per style tag): baseline vs every candidate vs shipped, with time per 30 s.
- Shipped changes beat the baseline end to end on the real-song test set (state the margin and how stable it is across tags), within the time budget the owner agreed.
- Real songs from the owner's library re-analysed end to end on the Mac with the new chain; contract-valid `notes.guitar` / `tab.guitar`; viewed in the local app.
- Docs updated: `08` (P2g definition and results), `06` (stage/config changes), `07` if the fret assigner changed, `docs/ml/transcription-guitar-and-bass-tabs.md` with what was measured; an honest note on the remaining ceiling per style.

## Verification to run and report
`cd services/ml && uv run ruff check && uv run pyright && uv run pytest`, the new P2g report commands, `pnpm contracts:check`, `pnpm lint`, `pnpm typecheck`, `pnpm --filter @splitune/music-core test` and node-worker/api tests if touched, end-to-end analysis timings on the Mac, and the production-worker update steps the owner must run after merging (`git pull`, `uv sync` for the affected island, `fetch_models.py`, `pnpm workers restart`).
