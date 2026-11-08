# Handoff: continue the Night Rehearsal redesign on the owner's PC

> **Superseded on 2026-11-08.** The owner switched the redesign to one agent per step (D21). Run the remaining steps with `docs/steps/00-redesign-brief.md` and the step prompts in `docs/steps/`; this file is kept for history.

This prompt is for a new Claude Code orchestrator session on the owner's Windows PC (`D:\Projects\Splitune`). It picks up the run that started on the owner's Mac on 2026-11-08 and was paused there the same day. Read this file first, then `redesign/orchestrator/prompt.md`, and carry out prompt.md from the state below. Where this file and prompt.md disagree, this file wins: it records the owner's later instructions and what has already happened.

## How to start

Open a session in `D:\Projects\Splitune` as `redesign/orchestrator/README.md` describes (Opus, effort high or xhigh, Auto mode, the deny rules, Docker running). Then send:

> Read `git -C D:/Projects/Splitune show origin/dev:redesign/orchestrator/handoff.md` and carry it out.

## Where the run stands (2026-11-08)

`dev` now contains the merge of `impl/redesign`, which holds steps s31a, s31b and s31c, verified, reviewed and recorded in `docs/status.md` and `docs/progress-log.md`. G1 is closed.

| Step | State | Where |
|---|---|---|
| s31a Redesign specs | Merged | docs 26–28 rewritten, 12 and 21 updated, the UI rule in `CLAUDE.md`, `AGENTS.md` and `00-shared-context.md` replaced |
| s31b Step prompts | Merged | `docs/steps/s32-…` to `s45-…`, rows and a "Redesign steps" section in `docs/steps/README.md` |
| s31c Mockup harness | Merged | `scripts/redesign/` (render, probe, self-check; renders go to the ignored `redesign/.renders/`) |
| s32 Tokens, fonts, perf baseline | **Parked, barely started** | `origin/impl/s32-tokens-fonts` at `cb8fcd3`. The only work is an unrun draft of `apps/web/e2e/perf-practice.spec.ts`. No baseline was recorded and no token changed. Re-dispatch s32 from this branch after merging the current `impl/redesign` into it, or start fresh and reuse the draft |
| s40a All stems, backend | **Parked, unfinished, untested** | `origin/impl/s40a-all-stems` at `ac460c6`, a WIP commit of edits to `separation.personal.yaml`, `separate.py`, `stem_post.py` and their tests, plus `eval/all_stems.py`, `eval/tests/test_all_stems.py` and a results note. Nothing in it has been run. Review it, finish the step, then G3 |
| s41a Sections, backend | Not started | ML; run it on the PC |
| s44 Notify me when ready (Web Push) | Deferred | Backend and infra, not UI. Ask the owner before starting it |
| s33–s39, s40b, s41b, s42, s43, s45 | Not started | Follow the lanes in prompt.md §5 and the step prompts |

The Mac run folder (ledger, reviews, worker reports) isn't in git. Every finished step's outcome is in `docs/progress-log.md` ("Step s31a/s31b/s31c" entries). Start a fresh run folder and ledger as prompt.md §4 says, seeded with the states above.

## The owner's instructions since prompt.md was written

1. **ML is tested on the PC.** s40a and s41a run there, including G3: the owner approves the separation-config and cache-key change, `pnpm eval:regression` runs on the GPU, and the owner listens to the stems. Their UI halves (s40b mixer, s41b section chips) don't wait for them. They're built against fixture and story data and the existing contracts, and they show only the stems and sections an analysis actually has.
2. **s44 is deferred** until the owner asks for it.
3. **Approvals.** In the Mac session the owner pre-approved G1–G4, the final merge into `dev` and its push. G1 is used up. Don't treat this file as approval for anything else: ask the owner in your own session, unless they restate it there.

## Decisions register (carry these into every brief that needs them)

- **D1:** the 390 px renders of the desktop-only boards (Main, Practice-*) aren't phone references; the manifest's `overflowX` flag marks them. Phone QA compares against the Phone-* boards, tablet QA against Stand.
- **D2:** the appearance picker shows 3 cards (System, Night Rehearsal, Daylight). `stage` stays a valid id but isn't a card.
- **D3:** by default the speed ladder steps up after 3 clean passes. This is a setting.
- **D4:** Stand view is the default practice layout on tablets.
- **D5:** where a mockup value fails an existing minimum (lines, borders, amber marks, focus ring, piano keys, Night danger text, stem palette), doc 26's correction stands. Minimums are never lowered.
- **D6:** the practice-route budget measured at `8d6a3f6` is **318.7 KB gzip of 320.0 KB, about 1.3 KB of headroom** (not 3 KB). Every new panel loads lazily, and every UI step reports bytes before and after.
- **D7:** raised reading-size literals (doc 26 §6.3, e.g. `--read-chord-current` Desk 32 → 112 px) are value changes by design. s32 updates those `tokens.test.ts` expectations and lists each one.
- **D8:** after s33, files in `apps/web/app/ui/` are owned one by one, as each step prompt's "Needs the orchestrator's OK first" row lists them. Grant them at dispatch, never to two parallel steps.
- **D9:** s32 also owns `apps/web/e2e/perf-practice.spec.ts`, `apps/web/e2e/perf-baseline.json` and the expected values in `apps/web/app/manifest.test.ts` that follow `BACKGROUND_HEX`.
- **D10:** the orchestrator union-merges `en.json`, the `copy-keys.test.ts` CATALOGUE entries and additive changes to `apps/web/e2e/helpers.ts`. Steps put new e2e cases in their own spec files.
- **D11:** s44 (when it runs) also owns the api router and config wiring, one new db repo file, and `pnpm-lock.yaml` if a dependency is justified.
- **D12:** s37 waits for s36 to merge. s40a and s41a keep to their own stage directories and config files. s33 leaves the PWA icons and favicon to s45.
- **D13:**
  - s35 owns `apps/web/app/lib/display-store.ts`, including the `stage` → `dark` rewrite. s36 builds its options from what the store exports.
  - Existing e2e specs have one owner each: practice → s35; onboarding, account, billing, fallbacks and a11y → s36; journey → s34.
  - A file owned by an in-flight step becomes available to another step only after its owner merges.
  - `features/practice/banners.tsx` belongs to s35.
- **D14:**
  - s33 owns `scripts/check-ui-tokens.mjs` and adds the 28 §3 rules scoped to `ui/**`; s45 widens them to `apps/web/app`.
  - s42 changes the ±0.15 s offset clamp in `packages/audio-engine`.
  - s41a may use node-worker `finalize.ts`, and s41a and s44 are never in flight together.
  - `story-fixtures.ts` belongs to s33.
  - s32's perf baseline also records a 1180×820 tablet context.
- **D15:** the owner's instructions above (ML on the PC, UI only otherwise, s44 deferred).

## Lessons from the Mac run

- **Reviews catch real weakening.** The first s31a draft cut the main practice targets to 52 px and halved the reading sizes. Only the independent review caught it. Keep a fresh read-only reviewer on every step and hold workers to the "never weaken" rules.
- **Measured baseline at `8d6a3f6`, on the Mac.**
  - Lint, the web typecheck, the build and css-floor pass.
  - Web unit tests: 214 passed.
  - `test:stories`: 988 passed. The first run in a fresh worktree failed while Vite re-optimised its dependencies (131 failures), and the rerun was green.
  - Nothing under `apps/`, `packages/` or `services/` has changed on `dev` since.
- **Probe URL mode.** `scripts/redesign/probe.mjs` sets Storybook's `appearance` global or the app's `splitune.display`, reports the `data-appearance` in effect and exits 1 on page errors. Don't wait for network idle on app pages, because the EventSource keeps the network busy.
- **Mockup renders need network fonts** (Google Fonts). Regenerate them in each worktree with `node scripts/redesign/render-mockups.mjs` (about 30 s).
- **Pending merge.** `impl/29-separation-improvements` (on the PC, with the owner's uncommitted work) still has to be merged into `dev`. Expect conflicts in `CLAUDE.md`, `AGENTS.md` (keep both rule sets), the separation code and the generated contracts (`pnpm contracts:gen`). Merge it before finishing s40a, as prompt.md §5 intends, or reconcile s40a's WIP with it.

## Owner queue carried over

1. Revisit the design calls made under the G1 pre-approval: D2–D5 and doc 26 §4.9's deviation register (V1–V17).
2. The s32 legibility check (Instrument Sans vs JetBrains Mono vs Inter at three distances) decides the font fallback.
3. G3 for s40a and s41a on the PC: approve the cache-key change, run `pnpm eval:regression`, listen to the stems.
4. G4: real devices at desk and music-stand distance in both themes, after the screens lane and after the practice lane.
5. G5: the music-stand legibility test (0.5, 0.75 and 1.5 m), pedal hardware (AirTurn modes 2/3/5, iRig BlueTurn), iPad Safari and the installed PWA (wake lock), and audio latency by ear on wired and Bluetooth headphones.
6. s44: decide whether to build Web Push. If it's built, generate the VAPID keys into the local `.env` and the production secrets, and never commit them.

## Next actions

1. Run prompt.md §4 setup, with the integration worktree on `impl/redesign` from `origin/impl/redesign` (it equals what was merged into `dev`). Record a fresh baseline on the PC.
2. Re-dispatch **s32** from `impl/s32-tokens-fonts`.
3. In parallel, review the s40a WIP and continue **s40a**, after deciding with the owner how it relates to `impl/29-separation-improvements`. Then run **s41a**. Both follow the contracts one-at-a-time rule.
4. Then s33 → G2 → the screens lane (s34, s36) alongside the practice lane (s35 → s37 → s38 → s39 → s40b → s41b → s42 → s43), then s45. Merge each step into `impl/redesign` one at a time, and merge into `dev` only with the owner's go.
