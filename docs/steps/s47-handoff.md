# Step s47 — handoff (2026-11-24)

For whoever continues step s47 (`docs/steps/s47-full-redesign.md`) on another machine. The redesign is built, reviewed and committed on `impl/47-full-redesign`; what is left is the final verification run and the report. Nothing is merged into `dev` and no PR is open.

## Where things stand
- **Branch:** `impl/47-full-redesign`, from `dev` at `bd2c77e`, pushed to `origin`. The working tree was clean at the push.
- **Done:** phases 1–4 (brief, audit, direction, tokens, components, every screen, docs 12 / 26 / 27 / 28), the after-capture, the independent QA and the fixes that followed it.
- **Not done:** the last full verification on the finished branch (it was started and cut off before it reported), the "Verification" section of the s47 entry in `docs/progress-log.md`, and the final report to the owner.

## Read first
1. `docs/steps/s47-full-redesign.md`: the step and its binding rules.
2. `docs/design/s47-direction.md`: the chosen direction ("Calm workspace").
3. `docs/design/s47-audit.md`: the audit, with "Scores after the redesign" at the end.
4. `docs/design/s47-qa.md`: the independent review; its low findings that were left are still open.
5. The s47 entry at the end of `docs/progress-log.md`: what was built, the lead's decisions, the known gaps.
6. `docs/specs/26`, `27` (§1, §3, §3.7.6) and `12` §8: the system, the screens and the keys as built.

## Set up on a new machine
```bash
git fetch origin && git checkout impl/47-full-redesign
pnpm run setup          # pnpm install, uv sync, .env, hooks
docker compose -f infra/docker-compose.yml up -d   # Postgres + SeaweedFS for integration tests and e2e
```
- `packages/audio-dsp/dist/dsp.wasm` is git-ignored: build it (pinned Emscripten image) or copy it from a machine that has it, and check it against `dsp.wasm.sha256`.
- e2e needs port 3000 free and `services/ml/.venv` synced (the mock ML worker). Never fetch model weights; tests marked `models` are not run.
- The before and after screenshots (`docs/design/s47-before/`, `s47-after/`) are git-ignored and exist only on the machine that took them. The audit and the QA review written from them are committed.

## What is left, in order
1. **Run the checks on HEAD and record exact commands and counts:**
   - `pnpm lint`, `pnpm typecheck`, `pnpm test`
   - `pnpm --filter @splitune/web build` then `pnpm --filter @splitune/web budget --enforce`
   - `pnpm --filter @splitune/web test:stories`
   - `pnpm --filter @splitune/web exec playwright test --project chromium`, then `webkit`, `mobile-chrome`, `mobile-safari`, `tablet-safari`, `tablet-chrome`
2. **Fix what fails** under the step's rules: a test of behaviour that no longer exists is rewritten for the new behaviour, never deleted, skipped or weakened; an app defect gets a minimal fix and a test; a layout or wording decision goes to the owner.
3. **Write the "Verification" section** of the s47 progress-log entry with those commands and results.
4. **Write the final report** (short): the direction and why; what changed by area; before and after scores per screen (in the audit); exact commands and results; what was not done or not verified; open product questions (below).

## Last known results (before the final fixes; re-run, do not quote these as final)
- Lint clean. Typecheck clean except pyright's five known errors in `stage_notes/tests/test_guitab.py`.
- Unit tests green across the TypeScript packages (web 383 at HEAD). pytest: 349 passed, 1 failed (`stage_beats/tests/test_beats_model.py::test_cpu_fallback_uses_the_small_model`, Mac-specific, untouched by this step).
- Stories: 1,832 of 1,832 in Chromium and WebKit on the last full run; the story files changed since then were re-run and pass.
- Practice route: 309.5 KB gzip of the 320 KB budget at HEAD.
- e2e, last full matrix (run before commits `35569a3` and `29ff3e1`): chromium 74 passed / 2 failed, webkit 67 / 1, mobile-chrome 44 / 1, mobile-safari 43 / 0, tablet-safari 48 / 0, tablet-chrome 49 / 1. Two of those failures were app defects that are fixed since (the pass question under Count-in at 1280 px; the stacked transport growing when the tempo arrived). Not yet re-run.

## Open failures to expect
- **mobile-chrome, `account.spec` (account deletion):** "Transition was aborted because of invalid state". TanStack Router's `defaultViewTransition: true` is already on `dev`; whether the test also fails on `dev` was not checked. Do not patch the router without the owner.
- **WebKit, capo redraw:** about 1 s against a 300 ms budget, intermittently; passes in other runs.
- **Chromium, "the cursor follows the audio clock":** failed by 0.02 ms while the Mac's display was asleep (`CVDisplayLinkCreateWithCGDisplay failed`); passes otherwise.
- **`fix.stories` "Beat Fix":** an intermittent alphaTab render race (Half tempo, then Undo). It predates this step.
- **Story runs under load:** the first run after a dependency change can reload mid-run ("Invalid hook call"); rerun once.
- **Not run at all:** Firefox e2e (needs the Linux Playwright image, doc 18) and the visual-regression suite (`e2e:visual`; every baseline differs by design and must be regenerated, never edited to pass).

## Open questions for the owner
1. **Home no longer uses the gear photos** (`apps/web/public/art/home-*.webp`, `docs/home-art.md`): keep the kit-drawn hero and delete the files, or bring the photos back somewhere?
2. **No music strip in song rows.** The direction wanted a song's waveform in its row; the library and example lists carry no peaks or sections. It needs a contract and pipeline change.
3. **Grounds are near-black and off-white** (`#0f0f0f`, `#fbfbfb`), replacing s46's pure black and white.
4. **Phones show one bar of tab a system** at the desk reading size, because two ran the digits together.
5. **Onboarding lost the "Where's your screen?" step**; the distance starts from the device.
6. **The pedal has one rule** (left again, right go) instead of the s43 plan of presets and held pedals.
7. **Reading sizes at weight 500** and the new palette have had no music-stand reading test (G5), and nothing was checked on real devices.

## Rules that still hold
`docs/specs/25-personal-mode.md` (no billable Railway or Cloudflare resource); every capability stays reachable; WCAG 2.2 AA, never colour alone; both themes; feature detection only; no secrets, debug prints or dead code; Conventional Commits, files staged by path; no merge into `dev` and no PR unless the owner asks.
