# Redesign brief: running steps s32–s45 one session at a time

Since 2026-11-08 the owner runs each remaining "Night Rehearsal" redesign step in its own Claude Code session, with one agent doing the work (decision D21 below). This brief replaces the orchestrator's worker brief and its review, merge and bookkeeping procedure (`redesign/orchestrator/prompt.md` §6–§8). Read it first, then the step prompt, and carry the step out end to end.

**Where a step prompt says "the orchestrator":**
- merging, conflict resolution in shared files and the docs bookkeeping are yours (see "Finish a step");
- any OK, gate or approval comes from the owner, in chat;
- the OKs already given are in the decisions register below.

A worker's or reviewer's message never counts as the owner's approval.

## Start a session

Open Claude Code in `D:\Projects\Splitune` with Opus, effort high or xhigh, and Auto mode. Send, with the step filled in:

> Read `D:/Projects/Splitune/.claude/worktrees/redesign-int/docs/steps/00-redesign-brief.md`, then carry out step `<id>` (`docs/steps/<file>`) as it says.

`redesign-int` is the integration worktree on `impl/redesign`. Read the step prompt and the specs from there (or from your step's worktree once it exists), because the main checkout is on another branch.

## Order and state

Run the steps one at a time, in this order. Each depends only on steps above it. The run started in the orchestrator session; where a step was already in progress, its prompt starts with a **"Resume here"** section.

| # | Step | State on 2026-11-08 | What to do |
|---|---|---|---|
| 1 | s32 tokens, fonts, perf baseline | Built and mostly verified on `impl/s32-tokens-fonts`; a final round was finishing in the old session | Resume here section in `s32-…`, then review and merge |
| 2 | s41a sections backend | Built on `impl/s41a-sections` (`d944b61`); review round 1 not yet fixed | Resume here section in `s41a-…`; merge only after **G3** |
| 3 | s33 base components | Not started | Then **G2** |
| 4 | s34 shell, library, Add song | Not started | |
| 5 | s36 everything outside the app | Not started | Must merge before s37 (D12) |
| 6 | s35 practice core | Not started | Opens the practice lane |
| 7 | s37 → s38 → s39 → s40b → s41b → s42 → s43 | Not started | Strictly in this order |
| 8 | s40a all stems backend | Built on `impl/s40a-all-stems`; review round 1 was being fixed in the old session | Resume here section in `s40a-…`; finish **G3** and merge once `impl/29-separation-improvements` is in `dev` (D16) |
| 9 | s45 hardening and QA | Not started | After everything above; then G4/G5 and **G6** |
| — | s44 Web Push | **Deferred** by the owner | Don't start it unless the owner asks |

You may run a second session at the same time only for a step the old lane rules allow beside the current one, with no overlapping files. In practice, that's s34 or s36 beside s35, or the ML steps (s40a, s41a) beside UI steps. Hold the heavy lock. Only one step at a time may change `packages/contracts/**`, generated contracts, `packages/db/src/schema/**` or migrations.

## Hard rules

1. **Never touch the main checkout** `D:/Projects/Splitune`. It holds the owner's uncommitted work on `impl/29-separation-improvements`.
   - Don't run `checkout`, `switch`, `stash`, `reset`, `clean`, `add` or `commit` there.
   - Read files from it only to copy `packages/audio-dsp/dist/dsp.wasm` and `.env`.
   - Work only in worktrees under `D:/Projects/Splitune/.claude/worktrees/`.
2. **Git:**
   - Each step commits on its own `impl/<id>-<name>` branch, staging exact paths.
   - Merge step branches into `impl/redesign` only, in `redesign-int`, one step at a time.
   - You may push `impl/redesign` to `origin` after a green merge (backup). Never push any other branch, never force-push, never rebase onto `dev`, never open a PR.
   - `impl/redesign` goes into `dev` only at G6. The owner runs the push of `dev`: a deny rule blocks `git push origin dev` for agents.
3. **Commits:** Conventional Commits, subject only (no body, no trailers such as `Co-Authored-By`), lowercase imperative, explaining why.
   - Run `gitleaks git --pre-commit --staged --redact --verbose` before every commit; the repo hook isn't active in these clones.
   - `.git/info/exclude` hides new files under `docs/`: stage them with `git add -f <exact paths>`.
4. **Never weaken checks:**
   - Never edit a test, golden, snapshot, visual baseline, contrast minimum, gamut tolerance, axe or Biome rule, or bundle budget to make a check pass.
   - Never add `.skip`, `.only`, `@ts-ignore`, `biome-ignore`, `# type: ignore` or `noqa`.
   - Allowed changes, each listed with its reason in the report:
     - expected **values** that change by design (token literals, `BACKGROUND_HEX`, copy that doc 27 changed, a stage graph that gains a node);
     - visual baselines regenerated after an intended visual change, listing the intended differences.
   - Anything else goes to the owner.
5. **Personal mode** (`docs/specs/25-personal-mode.md`):
   - Never create, scale or enable billable Railway or Cloudflare resources.
   - Never `uv sync` the shared ML venv `D:/Projects/Splitune/services/ml/.venv`: it holds CUDA torch.
   - Never fetch model weights; the owner does.
   - Never connect to a production database or bucket.
6. **No raw values in UI code.** Tokens come from `@splitune/ui-tokens` only, components from `apps/web/app/ui` only, and every UI change gets stories for its states in both themes. `pnpm lint` (including `scripts/check-ui-tokens.mjs`) must pass; extend the checker rather than suppress it.
7. **Stop and ask the owner** when:
   - the spec, mockups, code or a test disagree;
   - a frozen decision or a shared contract would change;
   - you need a file outside the step's owned globs and the OKs below;
   - a test or budget would have to give;
   - anything is billable.

   Give 2–3 options and a recommendation. Don't guess on design.

## Frozen decisions (owner)
1. **Direction A, "Night Rehearsal".** Dark warm graphite, notation in light ink on dark, ONE amber accent reserved for now/playhead/loop/the single primary action per view, stems colour-coded but always labelled. Instrument Sans for UI and JetBrains Mono for numbers and tab digits (Inter 4 is the fallback family). OKLCH tokens.
2. **"Daylight"** is a light theme generated from the same semantic roles. The appearance ids stay `system | light | dark | stage` (a contract enum):
   - `dark` = Night Rehearsal (the default);
   - `light` = Daylight;
   - `stage` = Night Rehearsal with the stand reading sizes.
3. **IA:**
   - a top-bar app shell with ⌘K and a global "Add song";
   - Add song is a dialog (desktop) or a full-screen sheet (phone);
   - Practice opens at once and fills in by stage;
   - Practice has a song map, a Now column, notation, an inspector with tabs Loop / Mix / Progress / Fix, and the transport dock;
   - Settings = Account · Display & practice · Keyboard & pedal · About.
4. **Confidence is never shown by colour alone:** dashed outline plus "?", and frequency wording such as "about 1 in 3".
5. **Keymap:**
   - speed is `,` / `.` (Shift = 1 %);
   - ↑/↓ never change speed silently; until a pedal is set up they show "Pedal detected? Set it up";
   - single-key shortcuts can be switched off (WCAG 2.1.4).

Design authority: `docs/specs/26`–`28` (rewritten for Night Rehearsal) are binding. Precedence: `docs/specs/25-personal-mode.md` > this brief > `docs/specs/README.md` > the step prompt > `redesign/` > everything else.

## Decisions register
- **D1:** the 390 px renders of the desktop-only boards (Main, Practice-*) aren't phone references; the manifest's `overflowX` flag marks them. Phone QA compares against the Phone-* boards, tablet QA against Stand.
- **D2:** the appearance picker shows 3 cards (System, Night Rehearsal, Daylight). `stage` stays a valid id but isn't a card.
- **D3:** by default the speed ladder steps up after 3 clean passes. This is a setting.
- **D4:** Stand view is the default practice layout on tablets.
- **D5:** where a mockup value fails an existing minimum (lines, borders, amber marks, focus ring, piano keys, Night danger text, stem palette), doc 26's correction stands. Minimums are never lowered.
- **D6:** the practice-route budget is 320.0 KB gzip; measured 318.7 KB (about 1.3 KB headroom). Every new panel loads lazily. Every UI step reports bytes before and after. Raising the budget needs the owner.
- **D7:** raised reading-size literals (doc 26 §6.3) are value changes by design.
- **D8:** after s33, files in `apps/web/app/ui/` are owned one by one, as each step prompt's "Needs the orchestrator's OK first" row lists them. Ask the owner for a file listed there unless an OK below covers it.
- **D9:** s32 also owns `apps/web/e2e/perf-practice.spec.ts`, `apps/web/e2e/perf-baseline.json` and the expected values in `apps/web/app/manifest.test.ts` that follow `BACKGROUND_HEX`.
- **D10:** when merging, union `apps/web/messages/en.json` (keys stay in their area groups; valid JSON), the `copy-keys.test.ts` CATALOGUE entries and additive `apps/web/e2e/helpers.ts` changes. Steps put new e2e cases in their own spec files.
- **D11:** s44 (if it ever runs) also owns the api router and config wiring, one new db repo file, and `pnpm-lock.yaml` if a dependency is justified.
- **D12:** s37 waits for s36 to merge. s40a and s41a keep to their own stage directories and config files. s33 leaves the PWA icons and favicon to s45.
- **D13:**
  - s35 owns `apps/web/app/lib/display-store.ts` (including the `stage` → `dark` rewrite); s36 builds its options from what the store exports.
  - Existing e2e specs have one owner each: practice → s35; onboarding, account, billing, fallbacks and a11y → s36; journey → s34.
  - `features/practice/banners.tsx` belongs to s35 until s35 merges.
- **D14:**
  - s33 owns `scripts/check-ui-tokens.mjs` (adds the 28 §3 rules scoped to `ui/**`); s45 widens them to `apps/web/app`.
  - s42 changes the ±0.15 s offset clamp in `packages/audio-engine`.
  - `story-fixtures.ts` belongs to s33.
  - s32's perf baseline also records a 1180×820 tablet context.
- **D15:** ML (s40a, s41a, G3) is tested on this PC. Their UI halves (s40b mixer, s41b section chips) don't wait for them: they're built against fixture and story data and the existing contracts, and show only the stems and sections an analysis actually has. s44 is deferred.
- **D16:** s40a set `impl/29-separation-improvements` aside: it continues on `impl/redesign`, and conflicts are resolved when impl/29 is merged into `dev` by the owner. s40a's PC measurement re-run, G3 and merge wait until then, so G3 isn't done twice.
- **D17:** gate pre-approvals:
  - G2–G4 and the final merge of `impl/redesign` into `dev` are pre-approved once their checks are green. Still show the owner the evidence at each gate.
  - G3's full `eval:regression` on the GPU, listening by ear, and the G4/G5 device checks need the owner physically.
- **D18:** in shared ML areas:
  - s41a owns `services/ml/config/sections.personal.yaml` and the `stages.py` registration;
  - s40a owns `services/ml/config/separation.personal.yaml` and `stage_separation/**`;
  - neither touches the other's.
- **D19 (s41a, owner):** sections design:
  - allin1 comes from the fork `openmirlab/all-in-one-infer` at `566f96c`, fed the decoded mixture through its own htdemucs;
  - `sections` is hard on decode and beats, soft on `stem_post`, and runs in the GPU slot;
  - Lite runs no allin1 job: finalize's novelty fallback gives "Part A/B/C" (it writes the fallback whenever sections failed or didn't run);
  - no contract change: fallback segments use `label: "unknown"` with ids `part-<letter><n>`, which s41b shows as "Part A";
  - no Isophonics eval.
- **D20 (s32, owner):** fonts:
  - keep U+202F mapped to each font's no-break space;
  - accept Instrument Sans' 12 missing Latin-1 glyphs (¤ ¦ ¬ soft hyphen ± ² ³ µ ¹ ¼ ½ ¾) falling back per glyph, pinned by the font test.
- **D21 (owner):** one agent per step, no orchestrator. One read-only independent review per step is kept.

## Environment (Windows 11 PC, measured 2026-11-08)
- **Shells:** use Git Bash for scripts. Package scripts run under cmd.exe, so set env vars in Git Bash before `pnpm exec`, never inside a pnpm script, e.g. `cd apps/web && E2E_SMOKE=1 pnpm exec playwright test`.
- **Machine:** Ryzen 5 7600, RTX 3060 12 GB, Docker with the compose Postgres and SeaweedFS. The owner's own GPU evaluation and ML workers may be running from the main checkout's venv; leave them alone.
- **Contracts and e2e:** contracts commands and e2e's mock ML worker need `UV_PROJECT_ENVIRONMENT=D:/Projects/Splitune/services/ml/.venv UV_NO_SYNC=1` (read-only use of the shared venv). ML steps create their **own** CPU venv in their worktree: `cd services/ml && uv sync --extra cpu`, then `uv run --no-sync`.
- **Heavy lock** (one heavy browser or CPU run on the machine at a time; ports are fixed: vite/e2e 3000, Storybook 6006, visual 6106/3334). Hold it around every `test:stories`, `e2e*`, `storybook`, dev-server or probe run, and around full `pytest`, api tests and `eval:regression --smoke`:
  ```bash
  L=D:/Projects/Splitune/.claude/worktrees/_redesign-run/heavy.lock
  until mkdir "$L" 2>/dev/null; do sleep 20; done; echo "<id> $(date -Is)" > "$L/owner"
  # … run …
  rm -rf "$L"
  ```
  If a lock is more than 60 min old and its owner is finished, clear it. If you stop a run, check for leftover node, Playwright or ML worker processes it started.
- **Baseline on `impl/redesign` at `9b5bf01` (this PC):**
  - lint, web typecheck, web unit (214/214), build + `budget --enforce` (318.7 KB) and `css-floor` all pass;
  - `test:stories`: 767 passed, 80 failed, all WebKit. The 80 are:
    - 77 `practice.stories.tsx` timeouts;
    - `import.stories.tsx > Record Tab`;
    - `onboarding.stories.tsx > Guide` and `Guide Dark`, after a WebKit page crash.
  - **Clock-dependent:** after 20:00, "Screen May Lock" and "Screen May Lock No Storage" also fail in Chromium and WebKit (the evening "Try Stage" hint adds a second Close button).
  - The full list is in `D:/Projects/Splitune/.claude/worktrees/_redesign-run/reports/baseline/stories-failing.txt` (local). Only failures outside it are regressions. The first `test:stories` run in a fresh worktree may fail while Vite optimises dependencies; rerun once.
- **Other known failures:**
  - db `lifecycle.test.ts` "claims a run once per due time";
  - node-worker pg-dump (no `pg_dump` binary);
  - ML `test_recovery.py` ×2 and `test_stem_post` ×2 (residual −13.11 dB, identical on the base);
  - api `pipeline.test.ts` ×2 (intermittent);
  - pyright's 5 errors in `stage_notes/tests/test_guitab.py`.
- **css-floor** rejects `light-dark()`, relative colour syntax, `@scope` and native CSS nesting. Token tests check sRGB gamut, so clamp saturated OKLCH in the token source.
- **Mockup renders** need network fonts: `node scripts/redesign/render-mockups.mjs` in your worktree (about 30 s). `scripts/redesign/probe.mjs` measures fidelity. Don't wait for network idle on app pages (the EventSource keeps the network busy).
- **Visual regression** needs Docker and `mcr.microsoft.com/playwright:v1.64.1-noble` (you may `docker pull` it once). The 72 existing baselines are all invalidated by the redesign.
- **Run folder** (local, ignored): `D:/Projects/Splitune/.claude/worktrees/_redesign-run/`. It holds `reports/` (worker and review reports), `decisions.md`, `human-queue.md`, `ledger.json`, `log.md` and the heavy lock. Write each step's report to `reports/<id>.md` and its review to `reports/<id>-review.md`.

## Do a step
1. **Worktree.** A new step branches from the current `impl/redesign` tip:
   ```bash
   git -C D:/Projects/Splitune/.claude/worktrees/redesign-int pull --ff-only   # only if impl/redesign moved on origin
   git -C D:/Projects/Splitune/.claude/worktrees/redesign-int branch impl/<id>-<name> impl/redesign
   git -C D:/Projects/Splitune worktree add D:/Projects/Splitune/.claude/worktrees/<id>-<name> impl/<id>-<name>
   ```
   A step with a "Resume here" section uses its existing worktree. If `impl/redesign` moved since its base, merge `impl/redesign` into the step branch first.
2. **Setup** in the worktree (Git Bash). Start every command with `cd "<worktree>" &&`.
   ```bash
   cd "<worktree>" && pnpm install --frozen-lockfile
   mkdir -p packages/audio-dsp/dist && cp D:/Projects/Splitune/packages/audio-dsp/dist/dsp.wasm packages/audio-dsp/dist/
   [ "$(sha256sum packages/audio-dsp/dist/dsp.wasm | cut -d' ' -f1)" = "$(cat packages/audio-dsp/dsp.wasm.sha256)" ] || echo WASM-MISMATCH
   cp D:/Projects/Splitune/.env .env          # only for a dev server or e2e; never stage it
   pnpm --filter @splitune/web generate
   cd services/ml && uv sync --extra cpu       # Python-changing steps only: this worktree's own venv
   ```
3. **Work** within the step's owned globs and the OKs in the decisions register and the step prompt. In `en.json`, add keys only inside your area's existing group.
4. **UI fidelity:** compare against the mockup renders and probes with measurements (aria structure, computed styles, bounding boxes). A pixel diff is a smoke signal only. Stop after 6 iterations without improvement and ask.
5. **Verify.** Run what applies and record exact commands with real counts:
   ```bash
   pnpm exec biome check . && node scripts/check-db-access.mjs && node scripts/check-ui-tokens.mjs
   pnpm --filter <each touched package> typecheck && pnpm --filter <each touched package> test
   pnpm --filter @splitune/web test:stories      # heavy lock; compare with the baseline list
   pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget --enforce && pnpm --filter @splitune/web css-floor
   cd apps/web && E2E_SMOKE=1 UV_PROJECT_ENVIRONMENT=D:/Projects/Splitune/services/ml/.venv UV_NO_SYNC=1 pnpm exec playwright test   # heavy lock, when the step asks
   UV_PROJECT_ENVIRONMENT=D:/Projects/Splitune/services/ml/.venv UV_NO_SYNC=1 pnpm contracts:gen && pnpm contracts:check   # contracts steps (ML steps: their own venv)
   pnpm db:check                                  # db steps
   cd services/ml && uv run --no-sync ruff check && uv run --no-sync pyright && uv run --no-sync pytest <paths>   # own venv
   ```
6. **Report** to `reports/<id>.md` with these sections: Built; Files changed (matching `git diff --stat impl/redesign...HEAD`); Decisions and deviations; Changed expected values (each with its reason); Verification (commands → results); Not done; Owner actions; Progress-log entry (ready to paste).
7. **Independent review.** Spawn one fresh read-only reviewer (Agent tool, `general-purpose`, Opus, effort high). Use the brief below, filled in. Give it the code and the spec, not your conclusions. Triage what it finds: fix correctness, spec, accessibility, design-system and test-integrity findings, at most 2 rounds. Record what you didn't fix, and why, in the report.
8. **Gate.** If the step ends at an owner gate (G2 after s33, G3 for s40a/s41a, G4 after the screens lane and after the practice lane), stop: show the owner the evidence and the exact checks. D17's pre-approvals cover G2–G4 once the checks are green, but the physical checks (listening, devices) are the owner's.

### Reviewer brief (fill in the `<…>`)
```
You are a read-only reviewer: don't edit, write, commit, check out, stash, add worktrees, or run anything that changes files or git state, except your one report file. Read-only checks in the worktree's existing environments are fine (tests without --fix, no golden updates, no uv sync). Don't spawn sub-agents.
Review step <id> of the Splitune "Night Rehearsal" redesign.
- Step prompt: <worktree>/docs/steps/<file>; standing rules and decisions: <worktree>/docs/steps/00-redesign-brief.md
- Worktree: <worktree> (branch impl/<id>-<name>, tip <sha>); diff: git -C <worktree> diff impl/redesign...impl/<id>-<name>
- Owned and granted files: <globs and OKs>
- Relevant specs and mockups: <sections, boards>
- The step's report is <run folder>/reports/<id>.md: use it only to locate claims you verify.
Report only: spec/mockup fidelity gaps, correctness bugs, accessibility defects (WCAG 2.2 AA; never colour alone; keyboard/pedal operable; 44 px targets, 64 px main practice controls), design-system violations, test-integrity problems (weakened, deleted or moved assertions, skips, unjustified expected-value changes, baseline edits) and files outside the owned list. Each finding: file:line, severity, evidence. No style nits.
Write the report to <run folder>/reports/<id>-review.md and reply in at most 10 lines.
```

## Finish a step (merge queue of one)
Merge one reviewed step at a time, in `D:/Projects/Splitune/.claude/worktrees/redesign-int`:
1. `git merge --no-ff --no-commit impl/<id>-<name>`, run gitleaks on the staged tree, then `git commit -m "Merge branch 'impl/<id>-<name>' into impl/redesign"`.
2. **Conflicts:**
   - in the step's own files: abort, merge `impl/redesign` into the step branch in its worktree, resolve there, re-verify;
   - in the shared bookkeeping files: resolve in place (`en.json` and the CATALOGUE per D10; `docs/status.md`, `docs/progress-log.md`, `docs/steps/README.md`);
   - generated files: regenerate, never hand-merge (`pnpm contracts:gen` with the env vars above; `pnpm --filter @splitune/web generate` for `routeTree.gen.ts` and Paraglide).
3. **Re-run the integration gates** on the combined tip:
   - JS lint, web typecheck and unit tests, `test:stories` (heavy lock), build + budget + css-floor;
   - api and db tests when backend changed; Python checks in the step's venv when ML changed.

   If anything is red and not on the known list, undo the merge (`git merge --abort`, or `git revert -m 1 <merge sha>` if it landed) and fix it on the step branch.
4. **Docs bookkeeping** on `impl/redesign`:
   - append the step's progress-log entry to `docs/progress-log.md`;
   - set its row in `docs/status.md`;
   - commit `docs: record step <id> in status and progress log` (`git add -f` the docs paths).
5. **Push** `impl/redesign` to `origin` (backup).
6. **Leak check:** nothing from the step may appear in `git -C D:/Projects/Splitune status --short`. The owner's own impl/29 changes are expected there. If anything of yours shows up, stop and tell the owner.
7. **Clean up:** `git worktree remove <worktree>`, keep the branch. Tell the owner in a line or two what merged and what's next.

## Gates and the owner's queue
- **G2** (after s33): Storybook screenshots of every base component in Night Rehearsal and Daylight, next to the mockup renders. Pre-approved once green (D17); show them anyway.
- **G3** (s40a, s41a; blocks only their merges): approve the config/cache-key change (pre-approved within the stated limits), run `pnpm eval:regression` on the GPU, and listen by ear. The exact owner commands are in each step's report and "Resume here" section.
- **G4** (after the screens lane, and again after the practice lane): real devices at desk and music-stand distance, in both themes.
- **G5** (before the final merge):
  - the music-stand legibility test (0.5 / 0.75 / 1.5 m), which decides the default theme for Practice;
  - pedal hardware (AirTurn modes 2/3/5, iRig BlueTurn);
  - iPad Safari and the installed PWA (wake lock);
  - audio latency by ear on wired and Bluetooth headphones.
- **G6** (only on the owner's "go"):
  1. Merge `impl/redesign` into `dev` in a worktree where `dev` is checked out (`.claude/worktrees/redesign` has `dev`; check it's clean first).
  2. Re-run the full gates there.
  3. Give the owner the push command `git -C <that worktree> push origin dev`.
  4. Warn that `CLAUDE.md`, `AGENTS.md` and the generated contracts will conflict when `impl/29-separation-improvements` is merged. The fix is to keep both rule sets and run `pnpm contracts:gen`.
- **Owner queue carried over:**
  - revisit D2–D5 and doc 26 §4.9's deviation register (V1–V17);
  - the s32 legibility check (story URL in s32's report);
  - two possibly orphaned `splitune-ml-worker.exe` trees from s32's trial perf runs (PIDs 7500/9368/896 and 4816/1940/5524, started 19:08 and 19:12 on 2026-11-08); stop them if they aren't the owner's production worker;
  - s44: decide whether to build Web Push (if built, the owner generates the VAPID keys; never commit them).

The stop condition for the whole redesign:
- every step is merged or deferred by the owner;
- the full gates pass on `impl/redesign`;
- the owner's queue is empty or explicitly carried over.
