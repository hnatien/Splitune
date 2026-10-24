# Step 22 — Guitar accuracy: measure on real songs, then push separation, notes, tuning and frets to their ceiling

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/progress-log.md` entries for steps **06** (eval harness), **07 / 07b** (separation, P1), **08** (notes, chords, finalize, P2/P6), **18** (piano P2: how a transcriber was chosen, calibrated and shipped end to end — follow that pattern).
- `docs/specs/08-evaluation-harness-and-prototypes.md` (P1, P2, P3 definitions and gates), `specs/06-ml-pipeline-service.md` (stage graph, islands, cache keys), `specs/07-music-algorithms.md` §5–§6 (quantize, fret DP, alt fingerings), `specs/05-analysis-schema.md` (`notes.*`, `tab.*`, confidence), `specs/25-personal-mode.md` (any model or dataset is allowed; licences are a provenance record, not a gate).
- Research: `docs/research/ml/transcription-guitar-and-bass-tabs.md` (candidates: GAPS, Riley et al., Perceiver-TF, YourMT3+, TART/AudioFret, Fretting-Transformer, MIDI-to-Tab, FretNet, Noise2Fret; datasets GuitarSet, GAPS, Guitar-TECHS, EGDB, DadaGP; §5 techniques, tuning, capo), `docs/research/ml/source-separation.md`, `docs/research/ml/source-separation-model-comparison.md`, `docs/research/ml/transcription-general.md`, `docs/research/ml/chords-beats-key-structure.md`. These are from 2026-10-20: re-check for newer models and released weights before choosing.
- Current results: `services/ml/eval/results/p1/`, `p2/2026-10-23.md` (guitar: Basic Pitch stem onset F1 0.797 on GuitarSet + band but **0.368 on BabySlakh**; strumming 0.735 vs solo 0.859; YourMT3+ 0.655 on stems vs 0.797 on mixture), `p3/2026-10-20.md` (fret assignment: `as_played` 0.789, `easiest` 0.596, gate 0.90 failed; its "Proposed next steps").
- Code: `services/ml/eval/p1.py`, `p2.py`, `p3_guitarset.py`, `p3_tune.py`, `p6.py`, `eval/sets/`, `eval/src/splitune_eval/tab_metrics.py`; `services/ml/config/{separation,notes}.personal.yaml`, `views.yaml`, `config/calibration/`; `services/ml/packages/stage_separation`, `stage_notes` (`transcribers.py`, `basic_pitch.py`, `stage.py`), `islands/{onnx-cpu,torch}`; `scripts/fetch_models.py`; `compliance/register/models/*.yaml`; `packages/music-core` (`build-tab.ts`, `quantize/`, `level/simplify.ts`, `fret/{config,dp}.ts`, `export/alphatex.ts`, corrections); `packages/contracts/src/analysis/{notes,tab}.ts`; `apps/node-worker/src/finalize.ts`.

Prerequisites: MVP (steps 01–17) and the piano work on `dev` (PROGRESS steps 17c–18a). Branch `impl/22-guitar-accuracy` from the current `dev`. This is an ML step: **every production change is decided by numbers on the real-song test set**, never by a paper's claim. Bass benefits from the same work; include it where it costs little (same harness, 4/5-string tab), but guitar comes first.

## Known gaps (code review, 2026-10-24)
Each needs a measurement and a fix or an explicit "measured, not worth it" in the report:
1. **The evaluation flatters the pipeline.** Basic Pitch was trained on GuitarSet, so treat every GuitarSet number as in-sample unless you can confirm which players its training held out. P2's "band" is only MUSDB drums + bass + vocals (`eval/p2.py` docstring, `build-guitar`): no keys, no second guitar, nothing competing in the guitar's register, which is why stem ≈ clean there. Guitar separation quality was never measured (the P1 SDR CSVs have no guitar rows; MUSDB has no guitar stem). Audio → tab end to end was never measured (P3 next step 4).
2. **Transcriber ceiling.** Basic Pitch ≈ 79 onset F1 on GuitarSet; supervised SOTA ≈ 89–91, and Riley et al. keeps 87.3 zero-shot (research doc table). YourMT3+'s mixture result beats Basic Pitch's stem result on BabySlakh but is in-sample, and it reports no per-note confidence (constant 1.0 → one-knot calibration).
3. **Decoding options never swept.** The P2 sweep covered onset/frame thresholds and min note length only; `melodia_trick` (adds notes without a detected onset) is on, and `infer_onsets` is hard-wired to `True` in `bp.notes_polyphonic` (not a transcriber param).
4. **No tuning handling.** Nothing estimates the recording's A4 offset, so a recording 30–50 cents off flips notes between semitones. `finalize.ts` never passes `tuningMidi` to `buildTab`, so every tab is standard tuning: a half-step-down song shows the wrong frets, drop-D lows become octave-shifted `unplayable` notes. `min_freq_hz: 70` keeps nothing below C♯2 (MIDI 37), which cuts drop C and 7-string lows.
5. **Bends are discarded.** Basic Pitch's 3-bins-per-semitone contour is computed and unused; `Notes.bend_cents` (`contracts/src/analysis/notes.ts`) is never filled; `TabEvent` has no bend field and `export/alphatex.ts` renders none. A bend becomes extra wrong notes.
6. **Several guitars share one stem.** Rhythm + lead (or two rhythm guitars) are transcribed into one part; the DP then drops notes beyond the strings or span, producing voicings nobody played.
7. **Fingering.** The DP has no audio string cue; the shipped default is `easiest` (`finalize.ts`, `practice-context.tsx`), which agrees with players 0.596 vs 0.789 for `as_played` — a deliberate beginner bias (D3), but untested against real tabs. P3's product fallback ("rhythm parts default to chord diagrams") was never applied: `views.yaml` defaults guitar to `tab`.
8. **Quantizer grid.** 1/16 straight plus swung 1/8 only; fast runs, 1/32 and 1/16 triplets snap wrongly. Unmeasured.

## Goal
Find the real accuracy ceiling for guitar on the owner's kind of songs and reach it: the best separated guitar stem, the most accurate note transcription on that stem (including tuning compensation and bends), musically informed clean-up, the right tuning in the tab, and the best string/fret choice — each stage measured on its own and end to end, shipped only when it wins, within the Mac's time budget.

## Phase 0 — A real-song test set (start here; the owner picks songs, doesn't play)
Nothing else in this step means much until this exists. **The owner does not play guitar**: no reference can depend on the owner recording or transcribing anything.
1. Write a short plan for the owner and **ask them in chat** before building it: which of their songs to use, which tabs they can get, and the time budget for this step and per analysis. Reference sources, best first:
   - Official/pro Guitar Pro or MusicXML tabs (publisher editions, Songsterr/Ultimate Guitar "official" tabs) of songs the owner has, aligned to the audio with the beat grid (DTW on onsets where needed). Check the alignment and spot-check the notes against the isolated stem by listening to a sample of bars, and drop excerpts where the tab clearly differs from the recording (live versions, simplified arrangements). These tabs also give tuning, capo, bends and string/fret ground truth.
   - Public real-recording sets with note/tab references: GuitarSet held-out players (flag in-sample for Basic Pitch, see gap 1), EGDB, Guitar-TECHS, GAPS test split, IDMT-SMT-Guitar. Mix the solo-guitar ones into **full band conditions that include competing harmonic instruments** — MoisesDB/MedleyDB accompaniment with its own guitars removed but keys, synths and "other" kept — not only drums + bass + vocals. Keep the current P2 band condition as a labelled "easy band" row for continuity.
   - Multitrack sets with an isolated real guitar track (MoisesDB, MedleyDB) for separation quality (SDR of the guitar stem), even where no note references exist.
   Label each tier clearly in the reports; never mix their numbers into one figure without saying so.
2. Target 20–40 excerpts of 20–40 s covering: distorted electric riffs, clean electric, acoustic strumming, fingerpicking, solos with bends, **two-guitar arrangements (rhythm + lead)**, **drop/alt tunings, half-step-down and capo**, **recordings off A440**, fast runs, dense band mixes vs sparse ones. Each excerpt records its source, tuning, capo, A4 offset where known, guitar count and style tags in `eval/sets/` (audio stays out of git like the other sets; only manifests and references are tracked where allowed).
3. Extend the harness (new task `p2g`, reusing `splitune_eval` scoring and `tab_metrics.py`) so one command reports, per style tag and overall: **separation** (SDR/uSDR of the guitar stem where a clean guitar track exists), **notes** (onset F1, onset+offset F1, pitch-class F1 on stem and on mixture), **tuning** (detected vs reference tuning and A4 offset), **bends** (detection precision/recall against tab bend marks), **tab** (TDR = string/fret accuracy on correctly detected notes, and end-to-end Tab F1, run through the shipped `buildTab` via the music-core CLI so the evaluated code is the shipped code), **quantization** (share of residual-flagged notes, onset error against tab positions), **chords** where useful, plus **time per 30 s** on the Mac. Results go to `services/ml/eval/results/p2g/<date>.md` + `.csv` in the existing report style, with git SHA and model versions.
4. Re-run today's production chain (BS-Roformer-SW → Basic Pitch with the current thresholds → `buildTab` `easiest` and `as_played`, standard tuning) as the **baseline row**. Every later phase compares against it. **Stop and show the owner the baseline and the phase plan with time estimates before Phase 1.**

## Phase 1 — Separation (biggest loss on band mixes)
1. Candidates: the current `bs_roformer_sw`, dedicated guitar models from the MSST collection and audio-separator (BS/Mel-Roformer guitar models, e.g. 2-stem "guitar vs rest"), `htdemucs_6s`, and ensembles (average or max-magnitude of two models; vocal/drum/bass removal first, then a guitar model on the remainder). Re-verify which weights exist now.
2. Measure stem quality **and** what it does to downstream note F1 — the second is what matters. Watch time per 30 s; a chain that is much slower needs the owner's OK (state the numbers).
3. **Multiple guitars** (gap 6), on the two-guitar tag: measure how often one stem holds two parts and what it costs in note and tab F1. Try, cheapest first: stereo-position split of the guitar stem (rhythm/lead are usually panned apart), any released lead/rhythm-guitar separation models, register/role-based voice splitting of the notes in music-core. Ship only what wins; the output is one primary guitar part per `notes.guitar` (the other part kept as a second part only if the contracts gain it through `packages/contracts` + `pnpm contracts:gen`, and only if the win justifies it — otherwise drop it and say what was lost).
4. Ship the winner by adding records to `compliance/register/models/`, entries to `separation.personal.yaml` and `fetch_models.py`, following step 07's pattern. Changing the map changes cache keys; say so.

## Phase 2 — Note transcription
1. **Cheap wins on the current model first** (each measured alone, then combined):
   - Expose `infer_onsets` as a Basic Pitch param and sweep it with `melodia_trick`, `onset_threshold`, `frame_threshold`, `min_note_ms` and `ENERGY_TOL` on held-out stems (gap 3).
   - **Tuning-offset compensation** (gap 4): estimate the global A4 offset (pitch histogram of the Basic Pitch contour, or a dedicated estimator), then compensate before decoding — resample the input by the offset ratio before inference, or shift the contour/note posteriors — and record the offset in `notes.guitar` (contract field, via `packages/contracts`). Measure on the off-A440 tag and on test excerpts re-pitched by ±20/±35/±50 cents; it must not hurt in-tune audio.
   - Lower `min_freq_hz` only together with tuning detection (Phase 3b), so drop C and 7-string lows survive without inviting sub-E2 junk on standard-tuned songs.
2. **Explain YourMT3+'s gap:** its paper reports 91.65 onset F1 on GuitarSet but it scored 0.655 on stems here. Check program mapping, input sample rate/loudness, model variant, and whether the stem's level or band-limiting hurts it. Fix the setup before judging the model.
3. **Stronger released models:** Riley et al. (and any newer guitar model with released weights) on stems and mixture, through the `NoteTranscriber` interface, in the island that fits (onnx-cpu or torch).
4. **Fine-tune for the production domain:** train a Kong-style CRNN (or fine-tune the best released checkpoint) on GuitarSet + GAPS + Guitar-TECHS + EGDB + synthetic guitar renders (DadaGP/Slakh-style MIDI through varied amp/effect chains, with bends and detuning augmentation), **with inputs passed through the Phase 1 separator** so training matches what runs in production. Hold out players/songs properly; never train on any song, player or excerpt that is in the test set (public sets: use their held-out splits for testing only). Train on the Mac (MPS) or the CUDA worker host from step 09c if the owner has it running; report hardware, hours and data sizes. Export to ONNX or run in the torch island. Any model without a per-note score needs a real confidence (posterior-based, or agreement with a second model) — a constant score makes the confidence ink meaningless.
5. **Bends** (gap 5): from the winning model's pitch contour (Basic Pitch contour or the new model's equivalent), fill `bend_cents` per note, and merge the extra notes a bend currently produces into the bent note. Measure against tab bend marks; ship only with a precision the owner would trust (state it).
6. **Ensembles:** per-note fusion of the best two or three transcribers (stem and mixture inputs), keeping notes the models agree on and weighting by calibrated confidence; measure precision/recall trade-offs, not just F1.
7. Re-sweep thresholds on held-out data, refit calibration (`config/calibration/`), and update `notes.personal.yaml`, the register and `views.yaml` (`quality_gate` and `changes` entry) for the winner, as step 18 did for piano.

## Phase 3 — Musically informed clean-up, tuning and quantization
### 3a. Clean-up (in `music-core` or the notes stage, whichever owns the information)
Each rule is a separate, switchable pass with its own measured gain; drop any that doesn't help on the real-song test set:
- Octave and wrong-semitone correction against the chord and key at that time.
- Onset snapping to the beat grid within a tolerance (quantization stays a separate, re-runnable stage — don't destroy the unquantized times).
- Leakage removal: drop weak notes that duplicate the bass or keys stem's notes at the same time.
- Fragment merging (one held note split into several) and minimum-duration cleanup.
- Strum handling: detect strums, emit them as chord shapes with a strum rhythm (the existing chords/level paths), and measure whether this beats note-by-note output on the strumming tag. Use the result to decide P3's fallback (gap 7): if chord diagrams beat note tab on strummed parts, make `views.yaml`/`recommendView` pick them for strummed parts, with the `changes` entry.

### 3b. Tuning in the tab (gap 4)
- Infer the likely tuning per song — standard, half-step down, full-step down, drop D (and drop C / 7-string if the test set has them) — from the A4 offset, the lowest sustained notes, open-string resonance and the pitch histogram; record the suggestion and its confidence in the analysis (contract change through `packages/contracts`).
- `finalize.ts` passes the suggested `tuningMidi` to `buildTab` only above a confidence threshold chosen on the test set; otherwise standard. Measure Tab F1 and `unplayable` rate with and without it.
- Capo stays the learner's choice (ambiguous from audio, research doc §5) unless the tab references show a cue that is right almost always; report what you find.
- **The tuning picker UI belongs to step 18** (tuning presets, V12). Here: the detection, the artefact field and finalize. If step 18 is already on `dev`, make its picker default to the suggestion; if not, leave a note for it in PROGRESS.

### 3c. Quantization (gap 8)
Measure the residual-flag rate and position errors per tag against tab references. Add finer grids (1/32, 1/16 triplets) to `quantize.ts` only if they reduce position errors without making simple parts harder to read; keep quantization idempotent and re-runnable.

## Phase 4 — Strings and frets (tab accuracy)
1. Measure the current fret DP's TDR and Tab F1 on the real-song test set, in both modes (P3 numbers are on GuitarSet only).
2. **Audio string cues** (P3 next step 1): a per-note string-likelihood term from the stem (TabCNN-style string posteriors or per-note timbre embeddings), added to the DP as one more local cost. Cheapest to ship if it wins.
3. **Learned fret assigner** (Fretting-Transformer / MIDI-to-Tab style, conditioned on tuning and capo) trained on DadaGP and other tab corpora, optionally with audio embeddings (TART "AudioFret" idea), with the DP kept as the hard playability filter. It must keep `alt_fingerings`, the `easiest` / `as_played` modes, span limits and `unplayable` marking that the contracts and UI rely on.
4. Larger voicing library for the chord-shape prior (jazz shells, drop-2/drop-3, 9ths/13ths) if the comping tag shows shape misses.
5. **Default fingering mode:** report `easiest` vs `as_played` (and the winner of 2–3) against real tabs per tag. Changing the shipped default is a product decision (D3): **ask the owner** with the numbers; don't change it on your own.
6. **Bends in the tab:** carry `bend_cents` into `TabEvent` (contract change) and render bends in `export/alphatex.ts`; add or refresh a notation story showing a bent note (CLAUDE.md: every UI change gets stories).
7. Ship the fret change only if it beats the DP on the real-song test set; it can run in the Node finalize (ONNX) or as a Python stage feeding `tab.guitar` — pick the smaller change and explain. Contract changes go through `packages/contracts` and `pnpm contracts:gen`.

## Constraints
- No change to production defaults without a win on the real-song test set; report every candidate, including losers.
- Time budget: report full-analysis time on the Mac before and after; ask the owner before shipping anything that adds more than ~30 % to a guitar analysis.
- Personal mode: any model or dataset is allowed, but every shipped model gets a register record with its source and hash, and weights are fetched by `fetch_models.py`, never committed. Datasets and audio stay out of git.
- Contracts first: every new field (A4 offset, tuning suggestion, bends in tab, extra guitar part) is a Zod change in `packages/contracts` with regenerated Pydantic models and updated fixtures; never hand-edit generated files.
- Every new stage param or config value is part of the stage cache key; say which caches the change invalidates.
- Don't re-litigate the piano or drums paths.

## Stop points (ask the owner in chat, wait for the answer)
1. Phase 0 plan: song list, tab sources, time budget.
2. After the baseline row: the phase plan with estimated hours.
3. Any chain that adds more than ~30 % analysis time.
4. Changing the default fingering mode or the guitar default view (`views.yaml` `defaults`).

## Out of scope
New practice-screen UI (the guitar Notes view is step 21; tuning/capo pickers and the fingering switch are step 18), mic scoring, technique detection beyond bends (slides, hammer-ons, palm mutes stay research-grade), drums.

## Acceptance criteria
- Real-song test set exists with the owner's approval of the song list and a manifest (no owner-played material), including two-guitar, alt-tuning and off-A440 excerpts and a full-band condition with competing harmonic instruments; baseline row recorded.
- One report table per phase on the real-song test set (overall and per style tag): baseline vs every candidate vs shipped, with time per 30 s.
- Each of the eight known gaps is either fixed with a measured gain or reported as "measured, not worth it" with the numbers.
- Shipped changes beat the baseline end to end (Tab F1 and onset F1) on the real-song test set; state the margin and how stable it is across tags, within the time budget the owner agreed.
- Real songs from the owner's library re-analysed end to end on the Mac with the new chain; contract-valid `notes.guitar` / `tab.guitar` (with tuning and bends where detected); viewed in the local app.
- Docs updated: `08` (P2g definition and results), `06` (stage/config changes), `05` (new artefact fields), `07` (tuning, clean-up passes, fret assigner, quantization), `docs/research/ml/transcription-guitar-and-bass-tabs.md` with what was measured; an honest note on the remaining ceiling per style. PROGRESS entry appended.

## Verification to run and report
`cd services/ml && uv run ruff check && uv run pyright && uv run pytest`, the new P2g report commands, `pnpm contracts:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm --filter @splitune/music-core test`, node-worker/api tests if touched, `pnpm --filter web test:stories` if tab rendering changed, end-to-end analysis timings on the Mac, and the production-worker update steps the owner must run after merging (`git pull`, `uv sync` for the affected island, `fetch_models.py`, `pnpm workers restart`).
