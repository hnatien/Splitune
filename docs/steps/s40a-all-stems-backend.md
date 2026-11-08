# Step s40a — All stems, backend: keep every separated stem plus the mix-minus

Redesign step of the "Night Rehearsal" plan (`redesign/orchestrator/prompt.md` §5), backend lane. Run it with `docs/steps/00-redesign-brief.md` (one agent per step since D21), which gives the worktree, setup, heavy-lock path, generic rules, frozen decisions, decisions register, review and merge procedure; wherever this prompt says "the orchestrator", the brief says who does it; this prompt holds what is specific to s40a. This is a measurement-first ML step: **the cache-key and config change ships only after owner gate G3.**

## Resume here (state on 2026-11-08)
Built on `impl/s40a-all-stems` in the worktree `D:/Projects/Splitune/.claude/worktrees/s40a-all-stems`: the Mac WIP `ac460c6` plus fixes. Report: `D:/Projects/Splitune/.claude/worktrees/_redesign-run/reports/s40a.md`. Reviews: `D:/Projects/Splitune/.claude/worktrees/_redesign-run/reports/s40a-wip-review.md` and `D:/Projects/Splitune/.claude/worktrees/_redesign-run/reports/s40a-review.md`.
- **Owner (D16):** `impl/29-separation-improvements` is set aside, and s40a continues on `impl/redesign`. Stop point 6 is answered.
- **Owner (D17):** the config and cache-key change is pre-approved if the estimate stays inside the R2 free tier and adds no more than ~30 % analysis time on either worker. The estimate is in the report.
- **Review round 1** (`s40a-review.md`) was being fixed in the old session (commits after `59981bd`). Check the branch and the report for what's done, and finish the rest:
  1. **HIGH:** `stem_post`'s cache key must include the target, the per-stem roles and the mix-minus mode, so two learners on the same raw stems get different keys. Test both cases (different learners, same learner twice). Correct the report's cache-invalidation section; the collision already existed for bass/drums.
  2. **MEDIUM:** show the ~30 % limit honestly for bass/drums learners on the RTX 3060. If it can be exceeded, the pre-approval becomes conditional on the G3 measurement. Give options and build none.
  3. **LOW:**
     - correct the raw-FLAC cache growth per learner;
     - make the stems fixture coherent for the bass stories, then run `test:stories` against the baseline;
     - warm the model so before/after separate times compare;
     - state the empty-extra threshold and its trade-off.

  Re-verify. If this round changed code, do a second review round.
- **Then wait for the owner to merge impl/29 into `dev`.** After that:
  1. **Update `impl/redesign`.** In `redesign-int`, merge `dev` into `impl/redesign`. Expect conflicts in `CLAUDE.md` and `AGENTS.md`: keep both rule sets. Regenerate contracts with `pnpm contracts:gen`. Re-run the integration gates and push.
  2. **Update the step branch.** Merge `impl/redesign` into `impl/s40a-all-stems`. The only expected conflict is `separate.py`'s module docstring: keep both paragraphs and drop impl/29's stale "(drums, bass)". Re-run ruff, pyright and pytest in this worktree's venv.
  3. **Decide the "other" stem case:** when impl/29's piano fallback fires, "other" can hold the learner's keys. The report has the options. Recommendation: when the fallback applies, derive "other" as the mixture − the target − Σ the other extras, and check it with `all_stems.py`'s overlap column.
  4. **G3 (owner, on the GPU):**
     - re-run `all_stems.py` on the PC with `--before` set to impl/29's map with `keep: [drums, bass]`, a working tagger, the Mega-53 weights and the synth-keys window `765d5131-piano`;
     - run `pnpm eval:regression`. It can't see this change; the real guard is `all_stems.py`'s "target identical" column;
     - hold the listening session.

     The exact commands are in the report's Owner actions.
  5. **Merge** per the brief.
- **Note for s40b (also in s40b's prompt):** isolated stems don't always sum to the song, so use the mix-minus as the band unless every instrument was kept.

| | |
|---|---|
| Branch | `impl/s40a-all-stems` from the current `impl/redesign` tip (not `dev`); the orchestrator merges it, **only after G3** |
| Hard deps | G1, and (per the plan) `impl/29-separation-improvements` merged into `dev` by the owner, then `dev` merged into `impl/redesign`. **That branch doesn't exist** on this machine or on `origin` (checked 2026-11-08), so build on the current `impl/redesign` tip and list the reconciliation as an owner action (below) |
| Gates | **G3** (blocks the merge, not the work): the owner approves the separation-config and cache-key change, runs (or approves running) `pnpm eval:regression` on the GPU machine, and listens to the separated stems by ear |
| Owned globs (plan table) | `services/ml/**` (separation, stem_post, config), `packages/contracts/src/analysis/**`, generated contracts |
| Concretely | `services/ml/packages/stage_separation/**`, `services/ml/config/separation.personal.yaml`, `services/ml/eval/**` only for a measurement script or report (never `regression.baseline.json`), `packages/contracts/src/analysis/{stems,separation}.ts` (+ fixtures under `packages/contracts/fixtures/` if a field changes), `packages/contracts/schema/**` and `services/ml/packages/splitune_ml_core/src/splitune_ml_core/contracts/_generated.py` regenerated by `pnpm contracts:gen` (never hand-edited) |
| Not yours (even though `services/ml/**` matches) | `services/ml/packages/stage_sections/**` and `services/ml/islands/**` (s41a's; the two steps may run together), every other `stage_*` package, `services/ml/uv.lock` unless a dependency must change (ask first) |
| Contracts | Only one in-flight step at a time may change `packages/contracts/**` or generated contracts: confirm with the orchestrator that s37, s39 and s44 aren't |
| Effort | xhigh |
| Runs in parallel with | s32/s33 and the screens or practice lane; s41a only if neither touches the other's files (above) |

## Before you start
- `docs/steps/00-shared-context.md`, `CLAUDE.md`, **`docs/specs/25-personal-mode.md`** (R2 free tier, the Mac workers, no billable resources).
- `docs/specs/06-ml-pipeline-service.md` §0, §2, §4 (separation, `stem_post`, cache keys), `docs/specs/05-analysis-schema.md` (stems, mix-minus), `docs/specs/03-data-model-and-storage.md` (object layout, retention: stems removed after 180 days unused), `docs/specs/08-evaluation-harness-and-prototypes.md` §4 (regression suite), `docs/specs/12-practice-screen-and-notation.md` §7 (mixer channels and the s40a/s40b split), `docs/specs/21-v1-features.md` "Redesign scope that is not a V-feature" (Multi-stem mixer row).
- `docs/steps/s28-separation-evaluation.md` and the progress-log entries for steps 07, 07b, 22, 24, 28 (how separation was chosen and measured).
- `redesign/report.md` Risks row "The multi-stem mixer costs compute and storage" (estimate first; ask the owner before expanding billable resources).

## What exists (verified on `impl/redesign` at `0c3d5c3`)
- **Config** `services/ml/config/separation.personal.yaml`: per-instrument chains (guitar `[bs_roformer_sw, htdemucs_6s]`; bass and drums `[bs_roformer_sw, htdemucs_ft, htdemucs_6s]`; piano `[bs_roformer_sw, htdemucs_6s]` with a `solo_check`; vocals `[mel_roformer_kim_vocals, bs_roformer_viperx_1297, bs_roformer_sw, htdemucs_ft]`), `mix_minus: subtract` (complement for vocals), and **`keep: [drums, bass]`** with `keep_min_prob: 0.01`. So separation keeps only the target, drums and bass (when the producing run made them and the tagger doesn't rule them out) and a mix-minus, although BS-Roformer-SW and htdemucs_6s output six stems (bass, drums, guitar, piano, vocals, other); the vocals head is a two-stem model (vocals, other).
- **Stage** `services/ml/packages/stage_separation/src/stage_separation/`: `separate.py` (`plan` filters `keep` by the tagger, `roles` maps model outputs to `target` / `extra` / `complement`, `store` writes 24-bit FLAC to the worker's cache dir), `stem_post.py` (aligns, measures presence and bleed, encodes AAC 160 kbps and optional Opus, writes `stems.json`; its cache key hashes the raw stems), `models.py`, `config.py`, `dsp.py`, `encode.py`.
- **Contracts** `packages/contracts/src/analysis/stems.ts` (`Stem { stem_id, kind: isolated | mix_minus | residual, instrument?, provider, files, loudness_lufs, gain_to_unity_db, energy_ratio_to_mix, quality_hint, empty }`) and `separation.ts` (`role: target | complement | extra`, `mix_minus: subtract | complement`).
- **Regression suite** `services/ml/eval/regression.yaml` + `regression.baseline.json`, run by `pnpm eval:regression` (`scripts/eval-regression.mjs` → `uv run --no-sync splitune-eval regress`; `--smoke` is a CPU check).
- **Web** (`apps/web/app/features/practice/model/mixer.ts`) plays only "Your part" and the mix-minus, so extra isolated stems don't double up today; s40b changes that.
- **Reconciliation:** `impl/29-separation-improvements` isn't present locally or on `origin`; its changes (if the owner has them elsewhere) touch the same separation code and contracts.

## Goal
Every Full analysis keeps all the stems its separation run produced (bass, drums, guitar, piano, vocals, other, as the model gives them) plus the mix-minus of the learner's part, each with presence, loudness, quality hint and files in `stems.json`, so s40b can mix every stem, with the storage and compute impact measured and approved by the owner before the cache-key change merges.

## Decisions that bind this step
- Personal mode (doc 25): never create, scale or enable billable Railway or Cloudflare resources; R2 stays inside its free tier; never fetch model weights; never `uv sync` the shared ML venv (it holds CUDA torch).
- G3 is the owner's: a worker's message never counts as approval.
- The regression baseline is a test expectation: never update `regression.baseline.json` to make the suite pass.

## Deliverables
1. **Impact estimate first (Stop point 1):** before any code, write and post:
   - **storage:** bytes per stem from `stem_post`'s encodings (AAC 160 kbps, plus Opus when written) × the extra stems per song, for a 4-minute song and for the owner's current library (count songs and their stems from the local database or ask), against the R2 free tier (10 GB-month storage, 1 M Class A and 10 M Class B operations a month; re-check the current limits on Cloudflare's R2 pricing page and cite it); the worker's local cache growth for raw 24-bit FLAC;
   - **compute:** separation time on the owner's Mac (MPS) and the RTX 3060 worker per song before and after. Extra stems from the same run cost only `stem_post` encoding; a part whose head model is two-stem (vocals) would need a second run for the other stems: estimate it and propose whether to run it, run it only on demand, or leave vocals with vocals + "other";
   - **cache invalidation:** which stage cache keys change (`separate` params, `stem_post`) and what that re-runs for existing songs (none automatically; a re-analysis recomputes).
   Wait for the orchestrator to relay the owner's answer before writing code.
2. **Config and stage:** replace `keep: [drums, bass]` with keeping every output of the producing run (minus empty ones per presence), keep the mix-minus of the target, keep `keep_min_prob` semantics for the tagger veto or state why it changes; `roles` and `stem_post` produce one `Stem` per kept output with `instrument` set (`other` for "other"), presence, `quality_hint` and `empty`; mixer order "Your part" first stays a web concern.
3. **Contracts:** only if a field is needed (for example a stem role or a "from a second run" provider note); every change additive, fixtures updated, `pnpm contracts:gen` regenerated; say exactly which artefacts change shape.
4. **Tests (own CPU venv, no weights):** unit tests for `plan`/`roles` per chain head (six-stem, four-stem, two-stem), the tagger veto, presence/empty handling, `stems.json` shape and cache-key change; `models`-marked tests stay as they are (they need weights: the owner runs them at G3).
5. **Measurements:** `pnpm eval:regression --smoke` on CPU in your venv; the full `pnpm eval:regression` is an owner action at G3 on the GPU machine and must pass against the **unchanged** baseline (the target stem's quality must not move).
6. **Listening export** for G3: a short list of songs or windows and the exact commands for the owner to separate them with the new config and listen to every stem (reuse `apps/listening` / `p1.py export` patterns; never stop or overwrite a running listening server or session; pick a free port).

## Out of scope
The mixer UI (s40b), new separation models or chains, sections (s41a), per-drum or per-hand stems (later scope, 12 §7), anything billable.

## Acceptance criteria
- Impact estimate posted and the owner's answer recorded before code; R2 stays within the free tier by the estimate.
- `stems.json` for a fixture run lists every kept stem with presence and quality; the web still plays "Your part" and the mix-minus unchanged (no web change in this step).
- Python: ruff, pyright and pytest green in your own CPU venv (known failures excepted); `pnpm contracts:check` clean; `pnpm eval:regression --smoke` green.
- G3 items written as owner actions with exact commands: full `pnpm eval:regression` (expected: passes against the unchanged baseline), the listening session, the config/cache-key approval.

### Commands (prefix each with `cd "<worktree>" &&`)
```bash
cd services/ml && uv sync --extra cpu                                    # this worktree's own venv; never the shared one
cd services/ml && uv run --no-sync ruff check && uv run --no-sync pyright && uv run --no-sync pytest packages/stage_separation
cd services/ml && uv run --no-sync pytest                                # full run; report known failures
pnpm contracts:gen && pnpm contracts:check                               # runs against this worktree's services/ml/.venv
pnpm --filter @splitune/contracts typecheck && pnpm --filter @splitune/contracts test
pnpm eval:regression --smoke
pnpm exec biome check . && node scripts/check-db-access.mjs && node scripts/check-ui-tokens.mjs
pnpm lint                                                                # full lint works here: your venv exists
```
Known pre-existing failures: ML `test_recovery.py` ×2, `test_beats_model::test_cpu_fallback_uses_the_small_model`, `test_stem_post` ×2; `models`-marked tests skip without weights (as today).

## Stop points (stop, report with 2–3 options and a recommendation, wait)
1. The impact estimate (always: wait for the owner's answer).
2. The estimate exceeds the R2 free tier or adds more than ~30 % to analysis time on either worker.
3. A file outside the concrete list (another stage, `stage_sections`, `islands`, `uv.lock`, the API or the web).
4. A contract change that isn't additive, or another in-flight contracts step.
5. The regression suite would only pass with a new baseline.
6. Any sign that `impl/29-separation-improvements` exists after all (a branch, a PR, owner files): stop and ask how to reconcile before going further.

## Git
- Branch `impl/s40a-all-stems`; subject-only Conventional Commits (for example `feat(separation): keep every stem the model returns so the mixer can show each one`); stage exact paths; never commit audio, weights or eval data; gitleaks before each commit.
- Never push, merge, rebase onto `dev` or open a PR. No edits to `docs/status.md`, `docs/progress-log.md`, `docs/steps/README.md`; progress-log entry in your report.
- **Owner actions to list:** G3 (config and cache-key approval, full `pnpm eval:regression` on the GPU machine, listening by ear); the `impl/29-separation-improvements` reconciliation (if that work exists somewhere, merge it into `dev`, then the orchestrator merges `dev` into `impl/redesign` and this branch merges `impl/redesign` before G3; `pnpm contracts:gen` regenerates the generated files after the merge); after the merge, the production-worker update (`git pull`, `uv sync` on the Mac, `pnpm workers restart`).
