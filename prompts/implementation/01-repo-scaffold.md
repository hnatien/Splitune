# Step 01 — Repository scaffold, tooling and CI

## Before you start
Read `prompts/implementation/00-shared-context.md`, then:
- `docs/implementation/02-repo-tooling-and-ci.md` (primary spec)
- `docs/implementation/25-personal-mode.md` §1, §6
- `docs/implementation/00-tech-stack.md` (versions)
- `docs/implementation/24-browser-compatibility.md` §2 (browserslist / build targets)

Prerequisites: none. The repo has no commits yet; its default branch `dev` is unborn and `docs/`/`prompts/` are untracked by design. Create `impl/01-repo-scaffold` with `git switch -c impl/01-repo-scaffold` (it starts as an empty branch) — your commit becomes the repository's first commit; the owner then points `dev` at it.

## Goal
A working monorepo skeleton that every later step builds on: install, lint, type-check, test and run local services with one command each, plus CI on GitHub Actions.

## Deliverables
1. **Workspace root:** `package.json` (`packageManager` pnpm 12, `engines` Node 24), `pnpm-workspace.yaml`, `turbo.json` (tasks: `build`, `dev`, `lint`, `typecheck`, `test`, `e2e`), `.nvmrc`, `.gitignore`, `.editorconfig`, `biome.json`, `tsconfig.base.json` (strict), `.browserslistrc` from doc 24.
2. **Empty-but-wired packages/apps** exactly as laid out in doc 02 §1: `apps/web`, `apps/api`, `apps/listening`, `packages/{contracts,music-core,audio-dsp,audio-engine,notation,ui-tokens,analytics,config}`, `services/ml`, `compliance/register`, `infra/{docker-compose.yml,railway}`. Each TS package has `package.json`, `tsconfig.json`, `src/index.ts` exporting nothing yet but a version constant, and one passing Vitest test so the pipeline is proven end to end.
3. **Python workspace** in `services/ml`: uv workspace root `pyproject.toml` (Python 3.12, ruff, pyright, pytest configured), packages `splitune_ml_core` (with one passing test) and empty stage packages per doc 06 §1. `.python-version`.
4. **Local services:** `infra/docker-compose.yml` with Postgres 18 (healthcheck, named volume), SeaweedFS with its S3 gateway (create a `splitune-media` bucket on start via an init container or script), Mailpit. Do **not** use MinIO (Community images were withdrawn).
5. **Scripts:** `pnpm setup` (install, `uv sync`, copy `.env.example` → `.env` if missing), `pnpm dev` (compose up + turbo dev), `pnpm lint`, `pnpm typecheck`, `pnpm test`. `.env.example` with every variable later steps will need (DB URL, S3 endpoint/keys/bucket, Better Auth secret, SMTP to Mailpit, `BILLING_PROVIDER=mock`, `CACHE_SCOPE=global`, `ML_MODE=mock`), all with fake values and comments.
6. **CI** `.github/workflows/ci.yml`: on PR and push to `dev` — pnpm + uv caches, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `uv run ruff check`, `uv run pyright`, `uv run pytest`. Pin third-party actions by commit SHA.
7. **Agent memory:** a root `CLAUDE.md` (and identical `AGENTS.md`) of at most ~60 lines: what Splitune is, current personal mode pointer (`docs/implementation/25-personal-mode.md`), where docs and prompts live (and that they are local-only and untracked, so never add them), that `dev` is the integration branch, the commands from item 5, and the engineering rules from the shared context in condensed form. No duplication of the docs.
8. `gitleaks` pre-commit hook config (or a documented `pnpm` script) and a `docs/implementation/PROGRESS.md` with your entry.

## Out of scope
Any real feature code, database schema, auth, Railway resources, Emscripten build (only the empty `packages/audio-dsp` folder with a README placeholder describing step 11).

## Acceptance criteria
- Fresh clone → `pnpm setup && docker compose -f infra/docker-compose.yml up -d` succeeds; Postgres, SeaweedFS S3 (bucket exists) and Mailpit UI are reachable.
- `pnpm lint && pnpm typecheck && pnpm test` pass; `cd services/ml && uv run ruff check && uv run pyright && uv run pytest` pass.
- CI workflow is valid YAML and runs the same commands (verify with `act` if available, otherwise by inspection and state that).
- No secrets committed; `.env` is git-ignored.

## Verification to run and report
`pnpm setup`, `docker compose -f infra/docker-compose.yml ps`, an `aws s3 ls`/`curl` equivalent against SeaweedFS showing the bucket, `pnpm lint`, `pnpm typecheck`, `pnpm test`, the uv commands above, `git status` before committing.
