# Step s47 — Full UI audit and redesign

A step run from an owner prompt (2026-11-23), not from the "Night Rehearsal" plan. The lead owns every design decision; the prompt overrides the usual "match existing conventions", "smallest change" and "UI follows docs 26–28 and the existing `apps/web/app/ui` components" for this step, and treats the UI before it as a prototype.

| | |
|---|---|
| Branch | `impl/47-full-redesign` from `dev` (`bd2c77e`) |
| Git | Conventional Commits, files staged explicitly, no push, no PR, no merge into `dev` |
| Owned | `packages/ui-tokens`, `apps/web/app/ui`, every screen under `apps/web/app/features` and `apps/web/app/routes`, `packages/notation` (marks and bar numbers), `scripts/check-ui-tokens.mjs`, docs 12 §8, 26, 27, 28, `docs/design/s47-*` |

## Rules that hold without exception
- `docs/specs/25-personal-mode.md`: product scope and infrastructure. No billable Railway or Cloudflare resource is created, scaled or enabled.
- Every product capability that existed before the step is still reachable and works: import (upload, record, URL), analysis progress, library, practice (loops, speed, count-in, stem mixer, notation and tab, confidence), pedal and keyboard control, settings, usage and plan, auth. A capability may be presented differently, never dropped.
- WCAG 2.2 AA. Confidence and state are never shown by colour alone. Every practice action works by keyboard and pedal.
- Dark and Light are both first-class.
- Tier 1 browsers per doc 24: feature-detect, no user-agent sniffing.
- No secrets in git; no debug prints, dead code or commented-out code in the result.
- Tests exercise the new behaviour. No test is deleted, skipped or weakened to get green; a test of visual behaviour that no longer exists is replaced by a test of the new behaviour. No check is bypassed.

## Phases
1. **Brief and inventory.** A guidelines brief (`docs/design/s47-guidelines.md`: usability heuristics, WCAG 2.2 AA, music-practice specifics) and an inventory of every route, screen, state and component (`docs/design/s47-inventory.md`).
2. **Audit.** Capture every screen and state before the change (`docs/design/s47-before/<group>/`, kept out of git for size), score each against the brief, and write `docs/design/s47-audit.md` with the top 10 problems.
3. **Direction.** Three independent prototypes of the practice screen and the library (`docs/design/s47-directions/{a,b,c}/`), judged by a reviewer who saw none of them being made (`judge.md`); the lead decides and writes `docs/design/s47-direction.md`. The prototypes are deleted.
4. **Build.**
   - 4a (lead): rewrite `packages/ui-tokens`, rebuild the `apps/web/app/ui` components with stories in both themes, rebuild the practice screen end to end as the reference, update `check-ui-tokens`. Tokens, components and practice are separate commits.
   - 4b: one agent per remaining screen group, each in its own worktree cut from the lead's branch, with the direction, the brief, its audit section, the practice screen as the pattern, an exact file list and a ban on editing the shared components and tokens. Each rebuilds its screens, updates stories, unit tests and e2e specs, runs typecheck and tests, and commits on its worktree branch; the lead applies shared requests and merges.
   - 4c (lead): docs 12 §8, 26, 27 and 28, `docs/status.md`, `docs/progress-log.md`, this file; committed with the step.
5. **Verify.** Triage of `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm --filter @splitune/web test:stories` and `pnpm --filter @splitune/web e2e`; capture every screen again (`docs/design/s47-after/<group>/`); a final QA by a reviewer who did not build it, re-scoring every screen; the lead fixes what it finds and appends before/after scores to the audit.

## Deliverable
A short final report: the chosen direction and why; what changed by area; before and after scores per screen; exact commands and results; anything not done or not verified, stated plainly; open product questions for the owner.

## Results
See the s47 entry in `docs/progress-log.md` and the scores at the end of `docs/design/s47-audit.md`.
