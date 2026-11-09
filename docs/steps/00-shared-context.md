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
- The practice route JS budget (`pnpm --filter @splitune/web budget --enforce`, 320 KB gzip: `BUDGET_BYTES` in `apps/web/scripts/bundle-budget.mjs`) is at 318.7 KB of 320 KB, about 1.3 KB left (measured at `8d6a3f6`, before s32): new practice UI loads lazily outside it, frees bytes before adding any, and reports before/after bytes built the same way. Raising it needs the owner.
- UI follows the "Night Rehearsal" design system (`docs/specs/26-design-system.md`), in both of its themes, Night Rehearsal and Daylight: semantic tokens and `apps/web/app/ui` components only (no raw colours, ad-hoc sizes or one-off components); screens, states and copy per `docs/specs/27-screens-flows-and-content.md` (all user-facing strings from its message catalogue); every UI change gets stories for its states in both themes and passes the design QA checklist in `docs/specs/28-ui-quality-and-design-review.md` §5.
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

## Redesign steps (s32–s45, "Night Rehearsal")
The redesign (`redesign/report.md`, specs 26–28) runs like every other step: one step at a time, each on `impl/<id>-<name>` from the current `dev`, merged into `dev` when the owner asks. The order is in `docs/steps/README.md` ("Redesign steps"). s32, s40a and s41a were started earlier: their prompts begin with a "Resume here" section and their progress-log entries (2026-11-08) say what's done.

**Frozen decisions (change only with the owner's OK):**
1. **Direction A, "Night Rehearsal".** Dark warm graphite, notation in light ink on dark, ONE amber accent reserved for now/playhead/loop/the single primary action per view, stems colour-coded but always labelled. Instrument Sans for UI and JetBrains Mono for numbers and tab digits (Inter 4 is the fallback family). OKLCH tokens.
2. **"Daylight"** is a light theme from the same semantic roles. The appearance ids stay `system | light | dark | stage` (a contract enum): `dark` = Night Rehearsal (default), `light` = Daylight, `stage` = Night Rehearsal with the stand reading sizes.
3. **IA:**
   - a top-bar app shell with ⌘K and a global "Add song";
   - Add song is a dialog (desktop) or a full-screen sheet (phone);
   - Practice opens at once and fills in by stage;
   - Practice has a song map, a Now column, notation, an inspector (Loop / Mix / Progress / Fix) and the transport dock;
   - Settings = Account · Display & practice · Keyboard & pedal · About.
4. **Confidence is never shown by colour alone:** dashed outline plus "?", and frequency wording such as "about 1 in 3".
5. **Keymap:**
   - speed is `,` / `.` (Shift = 1 %);
   - ↑/↓ never change speed silently; until a pedal is set up they show "Pedal detected? Set it up";
   - single-key shortcuts can be switched off (WCAG 2.1.4).

**Decisions (the prompts cite them by number):**
- **D1:** the 390 px renders of the desktop-only boards (Main, Practice-*) aren't phone references (the manifest's `overflowX` flag marks them). Phone QA compares against the Phone-* boards, tablet QA against Stand.
- **D2:** the appearance picker shows 3 cards (System, Night Rehearsal, Daylight). `stage` stays a valid id but isn't a card.
- **D3:** the speed ladder steps up after 3 clean passes by default (a setting).
- **D4:** Stand view is the default practice layout on tablets.
- **D5:** where a mockup value fails an existing minimum (lines, borders, amber marks, focus ring, piano keys, Night danger text, stem palette), doc 26's correction stands. Minimums are never lowered.
- **D6:** practice-route budget: 320.0 KB gzip, measured at 318.7 KB. New panels load lazily. Every UI step reports bytes before and after. Raising the budget needs the owner.
- **D7:** raised reading-size literals (doc 26 §6.3) are value changes by design.
- **D8:** after s33, a step changes an existing `apps/web/app/ui/` file only if its prompt lists it (rows "Owned globs" / "Ask the owner first").
- **D9:** s32 owns `apps/web/e2e/perf-practice.spec.ts`, `apps/web/e2e/perf-baseline.json` and the `BACKGROUND_HEX` expected values in `apps/web/app/manifest.test.ts`.
- **D10:** add `en.json` keys inside your area's existing group, never at the end. Additive changes to `copy-keys.test.ts`'s CATALOGUE and `apps/web/e2e/helpers.ts` are fine. New e2e cases go in the step's own spec file.
- **D11:** s44 (deferred) would also own the api router and config wiring, one new db repo file, and `pnpm-lock.yaml` if a dependency is justified.
- **D12:** s37 starts after s36 has merged. s40a and s41a keep to their own stage directories and config files. s33 leaves the PWA icons and favicon to s45.
- **D13:**
  - s35 owns `apps/web/app/lib/display-store.ts` (including the `stage` → `dark` rewrite); s36 builds its options from what the store exports.
  - The existing e2e specs belong to one step each: practice → s35; onboarding, account, billing, fallbacks, a11y → s36; journey → s34.
  - `features/practice/banners.tsx` is s35's.
- **D14:**
  - s33 owns `scripts/check-ui-tokens.mjs` (the 28 §3 rules for `ui/**`); s45 widens them to `apps/web/app`.
  - s42 changes the ±0.15 s offset clamp in `packages/audio-engine`.
  - `features/story-fixtures.ts` is s33's.
  - s32's perf baseline includes a 1180×820 tablet context.
- **D15:** ML (s40a, s41a and their gate G3) is tested on the owner's PC. Their UI halves (s40b mixer, s41b section chips) don't wait for them: build against fixtures and story data, and show only the stems and sections an analysis has.
- **D16:** s40a set `impl/29-separation-improvements` aside. Its PC re-measurement, G3 and merge wait until the owner has merged impl/29 into `dev`.
- **D17:** gate approvals:
  - G2–G4 are approved once their checks are green, but still show the owner the evidence;
  - the physical checks (G3's full `eval:regression` on the GPU, listening by ear, G4/G5 on devices) are the owner's.
- **D18:** s41a owns `services/ml/config/sections.personal.yaml` and the `stages.py` registration; s40a owns `services/ml/config/separation.personal.yaml` and `stage_separation/**`.
- **D19 (sections):**
  - allin1 comes from the fork `openmirlab/all-in-one-infer` at `566f96c`, fed the decoded mixture through its own htdemucs;
  - `sections` is hard on decode and beats, soft on `stem_post`, and runs in the GPU slot;
  - Lite runs no allin1 job: finalize writes the "Part A/B/C" fallback whenever sections failed or didn't run;
  - no contract change: fallback segments are `label: "unknown"` with ids `part-<letter><n>`;
  - no Isophonics eval.
- **D20 (fonts):**
  - U+202F maps to each font's no-break space;
  - Instrument Sans' 12 missing Latin-1 glyphs (¤ ¦ ¬ soft hyphen ± ² ³ µ ¹ ¼ ½ ¾) fall back per glyph, pinned by the font test.
- **D21:** the redesign steps run one at a time, like every other step.
- **s44 (Web Push) is deferred** until the owner asks for it.

**Owner gates:**
- **G2:** after s33, the owner approves the foundations look from Storybook screenshots in both themes beside the mockup renders.
- **G3:** for s40a and s41a; it blocks only their merges. The owner approves the config/cache change, runs `pnpm eval:regression` on the GPU and listens by ear.
- **G4:** after the screens (s34, s36) and again after the practice steps: real devices at desk and music-stand distance, in both themes.
- **G5:** before the redesign is called done:
  - the music-stand legibility test (0.5 / 0.75 / 1.5 m), which decides the default theme for Practice;
  - pedal hardware (AirTurn modes 2/3/5, iRig BlueTurn);
  - iPad Safari and the installed PWA (wake lock);
  - audio latency by ear on wired and Bluetooth headphones.

**On the owner's Windows PC:**
- **The main checkout `D:/Projects/Splitune` holds the owner's uncommitted step-29 work.** Work in a worktree under `D:/Projects/Splitune/.claude/worktrees/`. In the main checkout, never check out, switch, stash, reset, clean, add or commit.
- **Worktree setup:**
  ```bash
  git -C D:/Projects/Splitune worktree add -b impl/<id>-<name> D:/Projects/Splitune/.claude/worktrees/<id>-<name> dev
  cd D:/Projects/Splitune/.claude/worktrees/<id>-<name> && pnpm install --frozen-lockfile
  mkdir -p packages/audio-dsp/dist && cp D:/Projects/Splitune/packages/audio-dsp/dist/dsp.wasm packages/audio-dsp/dist/   # check it against dsp.wasm.sha256
  cp D:/Projects/Splitune/.env .env      # only for a dev server or e2e; never stage it
  pnpm --filter @splitune/web generate
  cd services/ml && uv sync --extra cpu   # Python-changing steps: the worktree's own venv
  ```
- **The shared ML venv** `D:/Projects/Splitune/services/ml/.venv` holds CUDA torch: never `uv sync` it. Contracts commands and e2e's mock ML worker use it read-only through `UV_PROJECT_ENVIRONMENT=D:/Projects/Splitune/services/ml/.venv UV_NO_SYNC=1` (the prompts write `<shared ML venv>`).
- **Shells:** package scripts run under cmd.exe, so set env vars in Git Bash before `pnpm exec`, e.g. `cd apps/web && E2E_SMOKE=1 pnpm exec playwright test`.
- **Weights and data:** never fetch model weights (the owner does) and never connect to a production database or bucket.
- **Commits:** subject only (no body, no trailers).
- **Ports are fixed** (vite/e2e 3000, Storybook 6006, visual 6106/3334), so run one browser test run at a time.

**Known failures on `dev` at `9b5bf01` (PC):**
- **`test:stories`: 80 failures, all in WebKit:**
  - 77 `practice.stories.tsx` timeouts;
  - `import.stories.tsx > Record Tab`;
  - `onboarding.stories.tsx > Guide` and `Guide Dark`, after a WebKit page crash.
- **After 20:00,** "Screen May Lock" and "Screen May Lock No Storage" also fail in both browsers. The evening "Try Stage" hint adds a second Close button; s35 fixes it.
- **The first `test:stories` run in a fresh worktree** can fail while Vite optimises dependencies; rerun once.
- **Elsewhere:**
  - db `lifecycle.test.ts` "claims a run once per due time";
  - node-worker pg-dump (no `pg_dump`);
  - ML `test_recovery.py` ×2 and `test_stem_post` ×2;
  - api `pipeline.test.ts` ×2 (intermittent);
  - pyright's 5 errors in `stage_notes/tests/test_guitab.py`.
- **Passing:** lint, web typecheck, web unit tests (214), build + `budget --enforce` + `css-floor`.
