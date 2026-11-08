# Step s41a — Sections, backend: `stage_sections`, the novelty fallback and pipeline scheduling

Redesign step of the "Night Rehearsal" plan (`redesign/report.md`), backend lane. Read `docs/steps/00-shared-context.md` first, including its "Redesign steps" section (frozen decisions, decisions D1–D21, environment, known failures, owner gates); this prompt holds what is specific to s41a. It carries out the sections part of the s18 plan (`docs/steps/s18-v1-practice-depth.md` Deliverable 4). **The pipeline change ships only after owner gate G3.**

## Resume here (state on 2026-11-08)
Built on `impl/s41a-sections` at `d944b61`, in the clean worktree `D:/Projects/Splitune/.claude/worktrees/s41a-sections`. What it built, measured and leaves for G3 is in the progress-log entry "Step s41a: sections backend (in progress)".
- **Owner answers:** D19.
- **Approved extra files:**
  - finalize writes the fallback (Deliverable 4 option a);
  - `apps/api/test/{analyses,pipeline,library}.test.ts` (expected stage-graph values and the stand-in stage only);
  - `apps/node-worker/src/execute.ts` and new cases in `apps/node-worker/test/{finalize,worker}.test.ts`;
  - `services/ml/uv.lock` (regenerated);
  - the `WEIGHTS_DIRS` line in `register.py`;
  - `packages/music-core/scripts/update-golden.ts`;
  - the `OUTPUT_FILES` line in `devtools.py`;
  - the example stage in `services/ml/packages/splitune_ml_core/tests/test_islands.py:21`;
  - `packages/music-core/src/cli.ts` and `src/index.ts` (additive);
  - the spec notes in 07 (module map), 21 (V3 State), `packages/db/README.md` and the sections paragraphs of 06.
- **An independent review's findings, still to fix:**
  1. **Timeout retries:** the 360 s timeout is retried up to 3 times (queue default `max_attempts` 3). That can delay `analysis.done` by about 18 minutes for a cosmetic, soft stage. Enqueue `sections` with one attempt (`maxAttempts: 1` from `pipeline.ts`; check that the planned job carries it into `enqueue`) or make its timeout permanent, with a test.
  2. **Invalid artefact:** an unreadable or invalid `sections.json` still fails finalize (`apps/node-worker/src/execute.ts:194`). For `sections` only, treat it as absent so the fallback runs, with a test.
  3. **Queue-level test:** add one showing that a failing `sections` job leaves the analysis `done` (or `partial`), never `failed`.
  4. **Sample rate:** the fallback's `sample_rate` comes from `beats` in finalize and from the probe in the stage, not from a literal 44100.
  5. **Downbeats:** the fallback snaps to beat-grid downbeats that `labelBeats` may infer, while allin1 uses only `is_downbeat` beats. Make them the same, or say in the entry why the fallback's are right.
  6. **Spec lines:** fix the older lines in 06 §2 "Profiles" (Lite no longer runs sections) and 21 V3 "Pipeline" ("on demixed stems" → the decoded mixture).
  7. **G3 test:** the `models` test feeds a click track that allin1 may label only `start`/`end`. Use a tonal fixture, or accept `sections_not_found` with a clear message.

  Re-run the step's Commands afterwards.
- **For s41b (in its prompt):**
  - a failed sections job shows "We couldn't analyse this song" on a done analysis;
  - the ETA disappears while sections has no timings;
  - `stages.ts` labels sections "Other".
- **G3 (owner):**
  1. Install the island: `cd services/ml/islands/legacy && uv sync --extra cuda` (Mac: `uv sync`), then `.venv/Scripts/python -c "import allin1_infer, demucs_infer, madmom_infer, torch; print(torch.__version__, torch.cuda.is_available())"`.
  2. Fetch the weights: `cd services/ml && uv run --no-sync python scripts/fetch_models.py allin1`.
  3. Run the real-model test: `ML_MODELS_DIR=<models dir> uv run --no-sync pytest packages/stage_sections -m models -v`.
  4. Time `sections` on both machines from `stage_runs` (Stop point 2: above ~30 % of a full analysis means the one-line fallback-only path, dropping the `add('sections', …)` call in `pipeline.ts`).
  5. Re-analyse 3 songs by ear (clear verse/chorus; intro and bridge; 3/4 or a pickup), plus 1 Lite analysis.
  6. Run the full `pnpm eval:regression`.

  Merge into `dev` only after G3.
- **Also before the merge (approved; it's review finding L1):** add `islands/legacy` to the `uv lock --check` list in `.github/workflows/ci.yml`, to `PROJECTS` in `scripts/audit.mjs` and to the `uv sync` in `scripts/setup.mjs`.
- **After the merge, on the workers:** `git pull`, `uv sync` in `services/ml` and in `islands/legacy`, `fetch_models.py allin1`, then restart the workers.

| | |
|---|---|
| Branch | `impl/s41a-sections` from the current `dev`; it merges only after **G3** |
| Hard deps | G1 |
| Gates | **G3** (blocks the merge, not the work): the owner approves the new stage, its config and cache key and the analysis-time cost, runs (or approves running) `pnpm eval:regression` on the GPU machine (it must still pass: sections must not change separation), and checks section boundaries by ear on a few songs |
| Owned globs | `services/ml/packages/stage_sections/**`, `services/ml/islands/**`, `packages/music-core/src/**` sections, `apps/api/src/pipeline.ts` |
| Concretely | `services/ml/packages/stage_sections/**`; a new `services/ml/islands/legacy/` (its own `pyproject.toml` and `uv.lock`); in `packages/music-core/src/`: a new sections module (novelty segmentation from the beat grid and chords) with its tests and golden files under `packages/music-core/golden/` for it only; `apps/api/src/pipeline.ts` |
| Ask the owner first | `apps/api/src/pipeline.test.ts` (the stage graph gains a node: an expected-value change by design); `services/ml/packages/splitune_ml_core/src/splitune_ml_core/stages.py` (stage registration) and `services/ml/config/sections.personal.yaml` (new; `services/ml/config/` is also s40a's area, so each keeps to its own file, D18); `services/ml/scripts/fetch_models.py` and `compliance/register/models/allin1.yaml` (a register record and a fetch entry; you never run the fetch); `apps/node-worker/src/finalize.ts` for the finalize option of Deliverable 4 (allowed while s44 is deferred, D11) |
| Contracts | `Sections`, `SectionSegment`, `SectionLabel` and the `set_section` op exist; this step should need no contract change. If it does, stop: contracts are one-at-a-time and not in your globs |
| Effort | xhigh |

## Before you start
- `docs/steps/00-shared-context.md`, `CLAUDE.md`, `docs/specs/25-personal-mode.md` (any model may be used; the register is provenance, not a gate).
- `docs/specs/21-v1-features.md` **V3** (pipeline, fallback "Part A/B/C", accept: boundaries snap to downbeats, edits persist; the State and UI (redesign) paragraphs), `docs/specs/06-ml-pipeline-service.md` §0 (islands: `legacy` = allin1 + madmom from git), §2 (the `sections` row: legacy island, decoded + stems input, `sections.json`, 300 s, fallback music-core novelty segmentation), "sections (v1)" (allin1 1.1.0 fragility, NATTEN, madmom on 3.12), `docs/specs/05-analysis-schema.md` (sections artefact, `set_section`), `docs/specs/07-music-algorithms.md` (beat grid, downbeats), `docs/specs/08-evaluation-harness-and-prototypes.md` (how a new stage is measured).
- `docs/steps/s18-v1-practice-depth.md` Deliverable 4, `docs/steps/s25-drums.md` (how a new island model was added and measured), progress-log entries for steps 18, 24, 25.
- Code: `apps/api/src/pipeline.ts` (stage graph, hard vs soft dependencies), `apps/node-worker/src/finalize.ts`, `services/ml/packages/splitune_ml_core/src/splitune_ml_core/{stages,islands,island,artefacts}.py`, an existing stage package (`stage_beats` or `stage_chords`) as the model.

## What exists (verified at `0c3d5c3`)
- `services/ml/packages/stage_sections/` is an **empty stub**: `pyproject.toml`, `src/stage_sections/__init__.py` (one docstring line: "Section analysis (allin1)."), `py.typed`. It is a workspace member (`services/ml/pyproject.toml` `members = ["packages/*", "eval"]`).
- Islands: `services/ml/islands/{onnx-cpu,torch}` only; **no `legacy` island**.
- Contracts: `packages/contracts/src/analysis/sections.ts` (`SectionLabel` intro … unknown, `SectionSegment { id, t0, t1, label, boundary_confidence }`, `Sections`), `StageName` includes `sections`, `splitune_ml_core/artefacts.py` maps `"sections"` to `contracts.Sections`, and `music-core/src/corrections/apply.ts` applies `set_section`.
- **Not scheduled:** `apps/api/src/pipeline.ts` builds `[url_import →] decode → {beats, tag} → separate → stem_post → {chords, notes.<i>} → finalize` (full) and `decode → beats → chords → finalize` (lite), no `sections`; `finalize.ts` doesn't read sections; the web doesn't read them. No song has sections.
- `music-core` has no segmentation module.

## Goal
Full (and, per 06 §2, Lite) analyses produce `sections.json`: allin1 in a `legacy` island on the worker, with a `music-core` novelty segmentation from the beat grid and chords as the fallback named "Part A/B/C", boundaries snapped to downbeats, scheduled as a soft dependency so a sections failure never fails an analysis, with its cost measured and approved at G3.

## Decisions that bind this step
- Personal mode: never fetch model weights (the owner runs `fetch_models.py`); never `uv sync` the shared ML venv; nothing billable.
- G3 is the owner's; a worker's message never counts as approval.
- 21 V3: no fake sections: when neither path produces a result, there are no chips.

## Deliverables
1. **Plan first (Stop point 1):** post a short plan with: allin1's install route on Python 3.12 (madmom from git, NATTEN pinned or the optional-NATTEN fork; re-check the current state of allin1 and its forks and cite them), its weights and their size (a register record and a `fetch_models.py` entry, not fetched), input choice (mixture vs stems, 06 §2 says decoded + stems), the estimated time per song on the Mac (MPS or CPU) and the RTX 3060, and a test set for boundary accuracy that needs no owner playing (Harmonix Set or SALAMI annotations with audio the owner can provide, or none: say what can be measured without weights). Wait for the owner's answer.
2. **`legacy` island and `stage_sections`:** the island project (own `pyproject.toml` + `uv.lock`), the stage on the `splitune_ml_core` stage API like the other stages (params in `config/sections.personal.yaml`, part of the cache key), output contract-valid `sections.json` with labels mapped to `SectionLabel` and boundaries snapped to the nearest downbeat of `beats.json`; a clear failure (soft) when the island or weights are missing.
3. **`music-core` fallback:** novelty segmentation from chord and beat self-similarity (pure TypeScript, deterministic), labels "Part A/B/C" (repeated material reuses a letter), boundaries on downbeats, unit tests and golden files for the fixture songs.
4. **Where the fallback runs:** choose and justify one, and get the owner's OK before writing it: (a) in `finalize` (node-worker) when `sections` failed or wasn't run, so the artefact always exists and `set_section` edits apply to it (needs `apps/node-worker/src/finalize.ts`; allowed while s44 is deferred); or (b) in the browser (s41b) from the same `music-core` function, with no artefact and edits stored against a derived id (needs a decision on how `set_section` targets it). Recommendation: (a), which the owner chose (D19).
5. **Pipeline** (`apps/api/src/pipeline.ts`): `sections` after `beats` (and `stem_post` for stems input), soft for `finalize`, in the full graph and, per 06 §2, the lite graph; the stage-graph tests updated (pending the OK) with the reason; "Sections appear when the chords are ready" in the web depends on the stage being scheduled (s41b reads it).
6. **Tests (own CPU venv, no weights):** stage unit tests with a mocked model (label mapping, downbeat snapping, empty or failed output), the island skip when weights are missing (as other `models`-marked tests), `music-core` tests and goldens, pipeline tests.

## Out of scope
Section chips and rename UI (s41b), any change to separation (s40a), new contracts, training.

## Acceptance criteria
- Plan posted and the owner's answer recorded before code.
- `sections.json` from a mocked run validates against the contract; boundaries land on downbeats (test); the fallback is deterministic and covered by goldens.
- Pipeline tests show `sections` scheduled as a soft dependency in full (and lite) graphs; a failing `sections` job leaves the analysis `done` or `partial` as today, never `failed`.
- Python ruff, pyright and pytest green in your own CPU venv (known failures excepted); `pnpm --filter @splitune/music-core test` and `pnpm --filter @splitune/api test` green; `pnpm eval:regression --smoke` green.
- G3 owner actions written with exact commands: fetch the allin1 weights, run the `models`-marked sections tests, re-analyse 3 songs end to end and check boundaries by ear, run the full `pnpm eval:regression`.

### Commands (prefix each with `cd "<worktree>" &&`)
```bash
cd services/ml && uv sync --extra cpu                                            # this worktree's own venv
cd services/ml && uv run --no-sync ruff check && uv run --no-sync pyright && uv run --no-sync pytest packages/stage_sections
cd services/ml && uv run --no-sync pytest                                        # report known failures
pnpm --filter @splitune/music-core typecheck && pnpm --filter @splitune/music-core test
pnpm --filter @splitune/api typecheck && pnpm --filter @splitune/api test        # compose Postgres + SeaweedFS
pnpm contracts:check
pnpm eval:regression --smoke
pnpm exec biome check . && node scripts/check-db-access.mjs && node scripts/check-ui-tokens.mjs && pnpm lint
```
Known pre-existing failures: ML `test_recovery.py` ×2, `test_beats_model::test_cpu_fallback_uses_the_small_model`, `test_stem_post` ×2; api `pipeline.test.ts` ×2 (intermittent: tell them apart from your changes by running the file on the base commit).

## Stop points (stop, report with 2–3 options and a recommendation, wait)
1. The plan (always).
2. allin1 can't be installed reproducibly on Python 3.12 in an island, or its cost exceeds ~30 % of a full analysis on either worker: propose the fallback-only path.
3. Where the fallback runs (Deliverable 4).
4. A contract change, a migration, or a file outside the concrete list and the OK'd extras.
5. Anything that would change separation outputs or the regression baseline.

## Git
- Branch `impl/s41a-sections`; subject-only Conventional Commits (for example `feat(sections): schedule section analysis with a novelty fallback so every song can loop by section`); stage exact paths; never commit weights, audio or datasets; gitleaks before each commit.
- Don't push, merge or open a PR unless the owner asks. Append your progress-log entry and update your row in `docs/status.md` (`00-shared-context.md`, "Git and progress").
- **Owner actions to list:** G3 (above), and after the merge the production-worker update: `git pull`, `uv sync` in `services/ml/islands/legacy`, `fetch_models.py` for allin1, `pnpm workers restart`.
