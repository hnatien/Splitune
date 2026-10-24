# Step 02 — Contracts package (analysis schema + API types + codegen)

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/specs/05-analysis-schema.md` (primary spec — implement it faithfully)
- `docs/specs/04-api-contract.md` (request/response shapes, error codes, SSE events)
- `docs/specs/23-plans-free-and-paid.md` §6 (analysis types)
- `docs/specs/25-personal-mode.md` (source kinds incl. `url`, providers)

Prerequisites: Step 01 merged or available on your base branch.

## Goal
`packages/contracts` is the single source of truth for every structure that crosses a boundary (worker ↔ DB ↔ API ↔ client), with generated JSON Schema and Pydantic models and golden fixtures validated in both languages.

## Deliverables
1. **Zod 4 schemas** in `packages/contracts/src/analysis/`: `common.ts` (ModelRef, Confidence, ArtefactHeader, StageStatus, Instrument, ConfidenceBand), `manifest.ts`, `beats.ts`, `presence.ts`, `stems.ts` (incl. `mix_gain_db`, `gain_to_unity_db`, codec variants), `sections.ts`, `chords.ts`, `notes.ts` (pitched + drums), `tab.ts`, `summary.ts`, `corrections.ts` (`CorrectionOp` discriminated union), `stage.ts` (StageRequest/StageResult as used by the job queue in personal mode: no presigned URLs required — use object keys plus an optional URL map so the commercial path still fits).
2. **API schemas** in `src/api/`: error envelope + codes, songs, uploads, analyses (`type: full|lite`), artefacts, corrections batch, loops, practice sync, billing (mock), me, `import-url`, SSE `JobEvent` union. Export the oRPC contract (router definition without handlers) so `apps/api` and `apps/web` share it.
3. **Codegen pipeline:** `pnpm --filter contracts build` → `schema/*.json` via `z.toJSONSchema()`; `services/ml` script (uv) runs `datamodel-codegen` → `splitune_ml_core/contracts/_generated.py` (Pydantic v2). A root script `pnpm contracts:gen` runs both.
4. **Drift check:** `pnpm contracts:check` regenerates into a temp dir and fails on any diff; add it to CI.
5. **Golden fixtures** `packages/contracts/fixtures/` — one realistic JSON per artefact for a short synthetic example (e.g., 8 bars of a 4/4 guitar riff at 100 BPM with chords and tab, a couple of low-confidence notes, one correction op list). Validate them in a Vitest suite and in a pytest suite.
6. **Versioning:** `SCHEMA_VERSION = "1.0.0"`; a helper `assertCompatible(version)` (reject different major) in TS and Python.

## Out of scope
DB schema, API handlers, music-core logic (fixtures may contain hand-written tab values).

## Acceptance criteria
- Every type listed in doc 05 exists with the documented fields; deviations are justified in doc 05 itself (update it) and in `docs/progress-log.md`.
- `pnpm contracts:gen` is deterministic (running twice yields no diff); `pnpm contracts:check` passes in CI.
- Fixtures validate in TS and Python; an intentionally broken fixture fails both (test this with a negative test).
- Generated Python imports cleanly under pyright strict-ish settings used in step 01.

## Verification to run and report
`pnpm contracts:gen`, `git diff --exit-code` after a second run, `pnpm --filter contracts test`, `cd services/ml && uv run pytest -k contracts`, `pnpm typecheck`.
