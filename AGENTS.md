# Splitune

Web-first practice app for instrument learners: bring a song (upload, recording or URL), Splitune isolates your part, transcribes it (beats, chords, guitar/bass tab; piano and drums in v1) and wraps it in practice tools (bar-snapped loops, slow-down, count-in, stem mixer, confidence-aware notation, pedal control).

## Current mode: personal
`docs/specs/25-personal-mode.md` is binding and overrides docs 00–24: Railway Hobby (`app` + Postgres), Cloudflare R2 free tier (bucket `splitune-media`), ML and Node workers on the owner's Mac, mock billing, no copyright gating. Never create, scale or enable billable Railway or Cloudflare resources without asking first.

## Where things live
- `docs/` is tracked in git; start at `docs/README.md`. `docs/research/` (evidence), `docs/specs/` (specs `00`–`28`; "doc 06 §4" in code means `docs/specs/06-…` §4), `docs/steps/` (one prompt per step, `sNN-…`), `docs/status.md` (what's built), `docs/progress-log.md` (log of every step).
- Precedence when docs disagree: `docs/specs/25-personal-mode.md` → `docs/specs/README.md` → the step's spec → research docs.
- `apps/` (web, api, node-worker, listening), `packages/` (contracts, db, storage, music-core, audio-dsp, audio-engine, notation, ui-tokens, analytics, config), `services/ml` (uv workspace), `compliance/register`, `infra/` (docker-compose, railway, r2), `scripts/` (root tooling behind the `pnpm` scripts).

## Commands
```bash
pnpm run setup   # pnpm install, uv sync, .env from .env.example, git hooks (plain `pnpm setup` is pnpm's built-in)
pnpm dev         # docker compose up (Postgres 18, SeaweedFS S3, Mailpit) + turbo dev
pnpm dev:all     # local stack + migrations, then web, node-worker and ml-worker in one dashboard
pnpm lint        # Biome + check-db-access + check-ui-tokens + ruff
pnpm typecheck   # tsc (TS 7) + pyright
pnpm test        # Vitest + pytest
pnpm secrets:scan
pnpm contracts:gen    # after changing Zod contracts: regenerate JSON Schema + Pydantic (contracts:check = CI drift check)
pnpm db:migrate       # db:check fails if the Drizzle schema changed without a migration (`pnpm --filter @splitune/db generate`)
```
- One package: `pnpm --filter @splitune/<pkg> test` (or `typecheck`). One file / test: `pnpm --filter @splitune/music-core test test/build-tab.test.ts -t "<name>"`.
- Web: `pnpm --filter @splitune/web test` (unit), `test:stories` (Storybook stories with axe in Chromium/WebKit), `e2e` (Playwright). Its typecheck/test first run `generate` (Paraglide messages + `routeTree.gen.ts`).
- music-core golden files (`packages/music-core/golden/`): `pnpm --filter @splitune/music-core golden:update` when an output change is intended.
- Python: `cd services/ml && uv run --no-sync ruff check && uv run --no-sync pyright && uv run --no-sync pytest` (one test: `uv run --no-sync pytest packages/stage_notes -k <name>`). Always `--no-sync`: the workers run from `services/ml/.venv`. Tests marked `models` load real model weights.
- Integration tests in `packages/db`, `packages/storage` and `apps/api` need the compose Postgres, SeaweedFS and Mailpit running.

Local services: Postgres `localhost:5432`, S3 `http://localhost:8333` (bucket `splitune-media`), Mailpit UI `http://localhost:8025`.

## Architecture (personal mode, 01 + 25 §5)
- **App:** `apps/web` (TanStack Start SSR + PWA) mounts `apps/api` (Hono + oRPC + Better Auth) in-process (`apps/web/app/server/api.ts`); `apps/api/src/server.ts` is only a standalone dev server. Web code: `app/routes` (file routes), `app/features/<area>`, `app/ui` (design-system components).
- **Analysis pipeline:** `apps/api/src/pipeline.ts` turns an analysis into a stage graph of jobs on a Postgres queue (`packages/db/src/jobs/`: `jobs` table, `SKIP LOCKED`, `LISTEN/NOTIFY`, retries with backoff, heartbeats; SQL protocol in `packages/db/README.md`). Full graph: `[url_import →] decode → {beats, tag} → separate → stem_post → {chords, notes.<instrument>} → finalize`; hard vs soft dependencies decide what a failure cancels.
- **Workers** (on the owner's machine, restricted DB roles, production reads `.env.worker` only): `services/ml` (Python; `splitune_ml_core/queue.py` implements the same queue protocol, one `packages/stage_*` per stage, heavy model deps isolated in separate uv projects under `islands/`; per-stage config in `config/*.personal.yaml`) and `apps/node-worker` (finalize — runs `@splitune/music-core`, e.g. `buildTab` for tab + alphaTex — plus lifecycle, privacy and backup jobs). Progress reaches the browser by SSE from `job_events` (`apps/api/src/events.ts`).
- **Client side:** `packages/audio-engine` (AudioWorklet + `packages/audio-dsp` WASM, built in a pinned Emscripten image and checked against `dsp.wasm.sha256`), `packages/music-core` (pure music algorithms shared by finalize and in-browser recompute), `packages/notation`.
- **Contracts:** Zod in `packages/contracts/src` → JSON Schema in `packages/contracts/schema` → Pydantic in `services/ml/packages/splitune_ml_core/src/splitune_ml_core/contracts/_generated.py`.
- **Evaluation:** `services/ml/eval` holds the prototype/gate scripts (P1–P7, P2g; doc 08) with results in `eval/results/`; `apps/listening` is a localhost-only rating app for listening sessions exported from it.

## Engineering rules
- Read surrounding code first and match it; smallest change that fully solves the step; no unrelated refactors.
- Contracts first: anything crossing a process boundary uses Zod schemas in `packages/contracts`; Pydantic models are generated — never hand-edit generated files.
- User-scoped queries go through repository helpers that require `userId`; RLS is defence in depth.
- Times are seconds on the decoded-PCM timeline; quantization is a separate re-runnable stage; corrections are overlays.
- Confidence never shown by colour alone; every practice action keyboard/pedal operable; WCAG 2.2 AA.
- UI follows the "Music Stand" design system (docs 26–28): semantic tokens from `@splitune/ui-tokens` and `apps/web/app/ui` components only (no raw colours, ad-hoc sizes or one-off components); every UI change gets stories for its states (`pnpm --filter web test:stories`).
- Tier 1 browsers per doc 24: feature-detect, never UA-sniff (except the in-app-browser banner). No cross-origin isolation.
- No secrets in git (`.env` is ignored; `.env.example` holds fake values). gitleaks runs as the pre-commit hook.
- No debug prints, dead code, commented-out blocks or stray TODOs.
- Verify before claiming done: run the relevant lint/typecheck/tests and report exact commands and results. Never weaken or skip tests.

## Git
- Integration branch is `dev` (no `main`). Work on `impl/<NN>-<short-name>` from `dev`; Conventional Commits explaining why; stage files explicitly; no push/PR/merge unless asked.
- Never commit generated artefacts, model weights, audio files or secrets.
- Commit doc and step-prompt changes (specs, `docs/status.md`, `docs/progress-log.md`) together with the step they describe.
