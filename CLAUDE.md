# Splitune

Web-first practice app for instrument learners: bring a song (upload, recording or URL), Splitune isolates your part, transcribes it (beats, chords, guitar/bass tab; piano and drums in v1) and wraps it in practice tools (bar-snapped loops, slow-down, count-in, stem mixer, confidence-aware notation, pedal control).

## Current mode: personal
`docs/implementation/25-personal-mode.md` is binding and overrides docs 00–24: Railway Hobby (`app` + Postgres), Cloudflare R2 free tier (bucket `splitune-media`), ML and Node workers on the owner's Mac, mock billing, no copyright gating. Never create, scale or enable billable Railway or Cloudflare resources without asking first.

## Where things live
- `docs/` (research + `docs/implementation/` specs) and `prompts/` (one prompt per implementation step) are tracked in git. Progress log: `docs/implementation/PROGRESS.md`.
- Precedence when docs disagree: `25-personal-mode.md` → `docs/implementation/README.md` → the step's implementation doc → research docs.
- `apps/` (web, api, listening), `packages/` (contracts, music-core, audio-dsp, audio-engine, notation, ui-tokens, analytics, config), `services/ml` (uv workspace), `compliance/register`, `infra/` (docker-compose, railway).

## Commands
```bash
pnpm run setup   # pnpm install, uv sync, .env from .env.example, git hooks (plain `pnpm setup` is pnpm's built-in)
pnpm dev         # docker compose up (Postgres 18, SeaweedFS S3, Mailpit) + turbo dev
pnpm lint        # Biome + ruff
pnpm typecheck   # tsc (TS 7) + pyright
pnpm test        # Vitest + pytest
pnpm secrets:scan
```
Python directly: `cd services/ml && uv run ruff check && uv run pyright && uv run pytest`.
Local services: Postgres `localhost:5432`, S3 `http://localhost:8333` (bucket `splitune-media`), Mailpit UI `http://localhost:8025`.

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
- Commit doc and prompt changes (specs, `PROGRESS.md`) together with the step they describe.
