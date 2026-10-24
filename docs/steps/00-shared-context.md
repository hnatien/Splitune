# Splitune — shared context for every implementation agent

> Every implementation prompt in this folder starts by telling you to read this file. Read it fully before doing anything else.

## What Splitune is
A web-first practice app for people learning an instrument. A learner brings a song (file upload, own recording, or a URL), Splitune isolates their instrument's part, works out what is played (beat grid, chords, guitar/bass tab; piano and drums in v1), and wraps it in practice tools: bar-snapped loops, slow-down without pitch change, count-in, stem mixer, confidence-aware notation, level simplification and hands-free pedal control.

## Current mode: personal (binding)
Source: `docs/specs/25-personal-mode.md`. It **overrides** any conflicting guidance in `docs/specs/00–24` and in the research docs.
- **Infrastructure:** Railway project `splitune` (Hobby workspace; project id `b54dcab4-7140-43f7-a8a4-67398ebe70b7`, environment `production` id `44e23f0b-d4b3-4397-9748-54683296894a`) hosts one `app` service (web + API) and Postgres. Audio and artefacts live in a **Cloudflare R2** bucket `splitune-media` (free tier; Cloudflare account `00423f5f54075f03f785f8c7675a0a6f`). Heavy work runs on the owner's **Mac (Apple Silicon)**: a Python ML worker (PyTorch MPS) and a Node worker, connected to Railway Postgres via its TCP proxy. Local development uses Docker Compose (Postgres 18, SeaweedFS standing in for R2, Mailpit).
- **Money:** no new paid services beyond Railway Hobby and the R2 free tier. **Never create, scale or enable billable Railway or Cloudflare resources** (databases, buckets, services, replicas, volumes, containers) without asking the user first in chat. Read-only Railway and `cf` commands are fine. Use the `cf` CLI for Cloudflare (no Wrangler config in the repo). Never print API tokens or S3 secrets.
- **Payments are mocked** (`MockBillingProvider`). Never render or collect card fields, even fake ones.
- **Copyright and licensing are out of scope.** Any model or dataset may be used; URL import via `yt-dlp` is allowed; the licence register is a provenance record, not a gate.
- **Free vs Plus features are real** (`docs/specs/23-plans-free-and-paid.md`); only the purchase is simulated.

## Current state (2026-10-24)
The MVP (steps s01–s17) is built and deployed; v1 work has started (piano notes and grand staff, the guitar/bass Notes view, the vocal Melody view). Before you start, read `docs/status.md` and the **latest entries of `docs/progress-log.md`**: several pieces of work were done without a step prompt, and their progress-log headings use their own numbers (log "Step 18" is piano work for s19, not s18; `docs/README.md` "Numbers and names" explains).

## The owner
The owner doesn't play an instrument. Never plan work that needs the owner to play, record a performance or transcribe by ear; use datasets, published tabs/scores, virtual MIDI, recorded reference audio through a speaker, and scripted tests instead. The owner can choose songs, look at screens and run things on their devices.

## Where the truth lives (read in this order when relevant)
1. `docs/specs/25-personal-mode.md` — current mode
2. `docs/specs/README.md` — index and binding rules
3. The spec(s) in `docs/specs/` named in your prompt
4. Research docs in `docs/research/` (evidence and rationale) — cross-linked from the specs

If two docs disagree, the order above wins. If your work forces a decision to change, update the relevant doc in the same change and say so in your summary.

## Stack (pinned lines; re-verify exact versions with `npm view <pkg> version` / PyPI before installing)
- **TS:** Node 24 LTS, pnpm 12, Turborepo 2, TypeScript 7 (`tsc`) + `@typescript/typescript6` for tools needing the TS API, Biome 2.5, Vitest 5, Playwright 1.64.
- **Web:** TanStack Start 1.x (Vite 8), React 19.3 + React Compiler, Tailwind v4, shadcn/ui CLI v4 on Base UI, XState 5, Zustand 5, TanStack Query 5, alphaTab 1.8 (`@coderline/alphatab`), Mediabunny, Serwist, Uppy 6.
- **API:** Hono 4 + oRPC 1 + Zod 4, Better Auth 1.7, Drizzle ORM 0.45 + drizzle-kit, PostgreSQL 18.
- **Audio:** custom AudioWorklet + Signalsmith Stretch C++ compiled to WASM (Emscripten, SIMD, no threads). No cross-origin isolation (it breaks the YouTube embed in Safari/Firefox).
- **ML:** Python 3.12, uv 0.13 workspace, ruff, pyright, pytest 9, PyTorch 2.14.1 (MPS on the Mac), ONNX Runtime 1.31, FFmpeg 8.1, beat_this 1.1.0, basic-pitch 0.4.0 (run its bundled ONNX; install **without** TensorFlow), python-audio-separator 0.44.x, yt-dlp + Deno + yt-dlp-ejs.

If a pinned line has moved (new major, or a package is broken), choose the latest stable that fits, note it in your summary, and update `docs/specs/00-tech-stack.md`.

## Engineering rules
- Read the surrounding code before changing it; match its conventions. Make the smallest change that fully solves your step; don't refactor unrelated code.
- Contracts first: anything crossing a process boundary uses the Zod schemas in `packages/contracts` (Pydantic models are generated from them; never hand-edit generated files).
- Every user-scoped query goes through repository helpers that require `userId`; Postgres RLS is defence in depth.
- Times are seconds on the decoded-PCM timeline; quantization is a separate, re-runnable stage; corrections are overlays (`docs/specs/05-analysis-schema.md`).
- Confidence is never shown by colour alone; every practice action must be keyboard/pedal operable; WCAG 2.2 AA.
- The practice route JS budget (`pnpm --filter @splitune/web budget --enforce`, 302 KB gzip) is almost used up (61 B left after step 18a): new practice UI loads lazily outside it, frees bytes before adding any, and reports before/after bytes built the same way.
- UI follows the "Music Stand" design system (`docs/specs/26-design-system.md`): semantic tokens and `apps/web/app/ui` components only (no raw colours, ad-hoc sizes or one-off components); screens, states and copy per `docs/specs/27-screens-flows-and-content.md` (all user-facing strings from its message catalogue); every UI change gets stories for its states and passes the design QA checklist in `docs/specs/28-ui-quality-and-design-review.md` §5.
- Must work in all Tier 1 browsers (`docs/specs/24-browser-compatibility.md`): feature-detect, never UA-sniff (except the in-app-browser banner).
- No secrets in git. Use `.env` files listed in `.gitignore` and `.env.example` templates with fake values.
- No debug prints, dead code, commented-out blocks or stray TODOs in delivered work.

## Verification (required)
- Run the tests, type-checks, linters and builds relevant to your step, and any verification commands listed in your prompt. Report the exact commands and results.
- Never claim something works if you didn't run it. If something can't be verified (e.g., needs a real device or a GPU you don't have), say so plainly.
- Don't weaken or skip tests to get a green run; fix the cause.

## Git and progress
- **`docs/` is tracked.** Commit spec, step-prompt, `docs/status.md` and `docs/progress-log.md` changes together with the step they describe. If git ignores a new file under `docs/` (an old `.git/info/exclude` rule on the owner's machine), add it with `git add -f`.
- The integration branch is **`dev`** (there is no `main`). Work on a branch named `impl/<NN>-<short-name>` created from the current `dev`. Commit when verification passes, using Conventional Commits that explain *why*. Don't push, open PRs or merge unless the user asks.
- Stage files explicitly (no blind `git add -A`); never commit generated artefacts, model weights, audio files or secrets.
- Append an entry to the end of `docs/progress-log.md` with: date, step number and name, what was built, deviations from the docs and why, verification commands and results, known gaps, and what the next step needs to know. Then update the step's row in `docs/status.md`.

## When you are blocked
Ask the user only for decisions that are genuinely theirs: spending money, creating Railway or Cloudflare resources, choosing between product options the docs leave open. Otherwise pick the most reasonable default, record it in `docs/progress-log.md`, and continue.
