# Step 15a — UI polish, visual regression and design QA

## Before you start
Read `prompts/implementation/00-shared-context.md`, then:
- `docs/implementation/28-ui-quality-and-design-review.md` (primary: visual regression matrix, design QA checklist, usability rounds, review rubric)
- `docs/implementation/27-screens-flows-and-content.md` (every screen spec, states catalogue, message catalogue)
- `docs/implementation/26-design-system.md` (tokens, confidence encoding, reading sizes, motion)
- `docs/implementation/12-practice-screen-and-notation.md` §1, §9 (practice layouts and a11y checklist)
- `docs/implementation/PROGRESS.md` entries for steps 10–15 (known gaps)

Prerequisites: Steps 10a, 10–15. Runs **before step 16** (the MVP gate), which re-checks a11y and compatibility on the polished UI.

## Goal
Every MVP screen matches docs 26–27 in all appearances and devices, has all its states, uses the catalogue copy, and is protected by visual-regression baselines — and real people can reach a slowed loop at a music stand without help.

## Deliverables
1. **Screen audit:** walk every route and overlay in doc 27 §3 (incl. system pages and banners) on phone, tablet (portrait + landscape) and desktop × Light/Dark/Stage. For each, record gaps against the spec, the states catalogue (§4) and the design QA checklist (doc 28 §5) in a table in `PROGRESS.md`, then fix them. Missing stories for states get added.
2. **Copy pass:** every user-facing string is a Paraglide message matching doc 27 §5.6 and the style rules (§5.3); keep the copy-key test from step 10 (doc 28 §3) green and extend it to every screen added since; remove any leftover ad-hoc strings.
3. **Practice polish:** confirm bottom transport + reading sizes per distance preset on a real tablet at 0.75 m; glance view on a phone at 1.5 m; `PedalHud` for every mapped action; progressive states (doc 27 §3.7.3) render without layout shift; confidence overlay matches doc 26 §5 on notation, chord strip, timeline and mixer.
4. **Visual regression:** Playwright `toHaveScreenshot` matrix from doc 28 §4 in the pinned Playwright Docker image (`pnpm --filter web e2e:visual`, `e2e:visual:update`); commit the baselines; add the job to CI (Chromium + WebKit).
5. **Motion and polish details:** durations/easings from tokens only; reduced-motion paths; skeletons matching final layouts; focus never obscured by sticky bars (`scroll-padding`); no long tasks >50 ms during playback introduced by UI.
6. **Usability round** (doc 28 §6): run the three tasks with the owner and as many friends as available (state the number); bright and dim room; log findings with severity; fix severity-1 issues; record time-to-first-loop.
7. **Rubric review** (doc 28 §7): score each MVP screen; anything below 2 on an item is fixed or logged with a reason.
8. **Docs:** where implementation deliberately differs from docs 26–27 (a size, a layout, a message), update the doc in the same change and list it in `PROGRESS.md`.

## Out of scope
New features; browser-matrix and security hardening (step 16); v1 screens (steps 18–20 apply the checklist themselves).

## Acceptance criteria
- Screen audit table complete with every gap fixed or logged (severity, reason).
- Visual regression suite green in Docker for Chromium and WebKit; changing a token (e.g., `--radius`) produces a diff (show it, then revert).
- Copy-key test green; no hard-coded user-facing strings.
- Design QA checklist passed for every MVP screen; rubric ≥2 everywhere (or logged).
- Usability: at least the owner + 1 other participant completed task 1 in ≤5 min; results logged.

## Verification to run and report
`pnpm --filter web e2e:visual`, `pnpm --filter web test:stories`, `pnpm --filter web test`, `pnpm lint`, the audit and usability tables, devices used (model, OS, browser), before/after screenshots of the three most-changed screens.
