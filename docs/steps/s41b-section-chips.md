# Step s41b — Section chips in the song map

Redesign step of the "Night Rehearsal" plan (`redesign/orchestrator/prompt.md` §5), sixth in the practice lane (s35 → s37 → s38 → s39 → s40b → **s41b** → s42 → s43). The orchestrator's worker brief (prompt.md §6) gives your worktree, setup, heavy-lock path, generic rules and the frozen decisions; this prompt holds what is specific to s41b.

| | |
|---|---|
| Branch | `impl/s41b-section-chips` from the current `impl/redesign` tip (not `dev`); the orchestrator merges it |
| Hard deps | s40b, s41a (merged, so after G3) |
| Gates | G4 (practice-lane review, batched) |
| Owned globs (plan table) | practice song-map files |
| "Practice song-map files", concretely | `apps/web/app/features/practice/practice-timeline.tsx`, the `SongMap` files s35 created, `model/data.ts` (loading `sections` with the other artefacts), new section files under `features/practice/` (chip row, section loop presets, rename), the Loop tab heading's section badge, the palette registration s35 wrote for practice actions (to add "Loop the next {section}"), the hot practice files, and `en.json` keys for sections in `practice.*` |
| Needs the orchestrator's OK first | `apps/web/app/ui/waveform-timeline.tsx` and `ui/waveform-timeline.stories.tsx` (the "sections s41b" row of 26 §12.2) |
| Effort | high |
| Runs in parallel with | backend steps (s44) only |

## Before you start
- `docs/steps/00-shared-context.md`, `CLAUDE.md`, `docs/specs/25-personal-mode.md`.
- `docs/specs/21-v1-features.md` **V3** (chips above the timeline, tap → loop preset, editable labels via `set_section`, boundaries on downbeats, the UI (redesign) paragraph), `docs/specs/12-practice-screen-and-notation.md` §5 (a section chip sets the loop exactly to a section; "Part A/B/C" when unnamed), §8 (keys), `docs/specs/05-analysis-schema.md` (sections, `set_section`).
- `docs/specs/27-screens-flows-and-content.md` §3.7.1 (song map: chips, tap loops that section, current section on = amber wash, absent when there are no sections), §3.7.3 ("Sections appear when the chords are ready" only when the stage is scheduled), §3.7.4 Loop (heading badge "Chorus"), §3.12 ("Loop the next {section}"), §5.2 ("Section"; "Part A/B/C").
- `docs/specs/26-design-system.md` §8 and §4.9 **V13** (chips: box 24 tall, min width 24, 2 px apart on fine pointers, the only use of the 24 px floor, every section also reachable by Tab/arrows, ⌘K and the Loop tab badge; 48 on coarse pointers), §12.2 `SongMap` (chips flex-grow by bar count), §4.5 (current section chip is amber).
- `docs/specs/28-ui-quality-and-design-review.md` §3 (target-size exception), §5, §5.1; s41a's report (where the fallback runs and how `set_section` targets it).
- Mockups: `Main.dc.html` (section chips row), `Practice-Mix.dc.html` (chord sheet with section names).

## What exists (verified on `impl/redesign` at `0c3d5c3`; s35 and s41a will have changed it)
- `ArtefactKind` includes `sections` (`packages/contracts/src/analysis/common.ts` line 60); `features/practice/model/data.ts` loads the latest artefact of each kind (for example `latestOf(entries, 'chords')`, line 86) but not `sections`.
- `music-core/src/corrections/apply.ts` applies `set_section`; `en.json` has `history.set_section` "Renamed a section".
- After s41a, analyses schedule `sections` (soft) and produce `sections.json` (allin1 or the novelty fallback, "Part A/B/C"), boundaries on downbeats; s35's song map has no chip row.

## Goal
When a song has sections, the song map shows chips sized by bar count; tapping one loops exactly that section, the current one is in the amber wash, labels can be renamed, and every section is reachable by keyboard, from ⌘K and from the Loop tab, with no chips drawn when a song has none.

## Decisions that bind this step
- **D6:** budget 318.7 of 320 KB gzip (about 1.3 KB headroom): the chip row is on the route's critical path, so free bytes first if it doesn't fit and keep rename lazy; report before/after bytes.
- **D1:** compare `Main` at 1440 and 1180 only.
- 21 V3: no fake chips; "Part A/B/C" only from the fallback's labels.

## Deliverables
1. **Data:** load `sections` with the other artefacts, apply corrections (`set_section`) through `applyCorrections`, map labels to display names ("Verse 1", "Chorus"; numbering repeated labels in order), handle no artefact and stale artefacts.
2. **Chip row** (26 §12.2, V13): chips painted 22 inside a 24 px box (min width 24, 2 px apart) on fine pointers and 48 on coarse; flex-grow by bar count; long names truncate with the full name in the accessible name and a tooltip; the current section in the amber wash; a roving-tabindex row (Tab into the row, arrows move, Enter loops).
3. **Loop presets:** a chip tap (or Enter) sets the loop exactly to the section's bars; the Loop tab heading shows the section badge; ⌘K "Loop the next {section}" through the palette registration; PedalHud "Loop · Chorus · bars 25–32".
4. **Rename:** from the chip's menu or the Loop tab badge: an inline field, optimistic `set_section` with Undo toast and offline queue, history "Renamed a section".
5. **While analysing:** "Sections appear when the chords are ready" in the song map only when the `sections` stage is scheduled for this analysis; quiet arrival that never re-lays out the notation under the playhead.
6. **Stories:** no sections (row absent), allin1 labels, fallback "Part A/B/C", 20+ sections (narrow chips), long names, current section, renaming, coarse pointer (48 px), both themes and increased contrast; story `play` probes for the 24 / 48 boxes and keyboard order.

## Out of scope
The sections stage itself (s41a), section-aware ladder or progress, the chord sheet's section names beyond showing what exists.

## Acceptance criteria
- Unit tests: label mapping and numbering, correction application, loop-from-section bars (pickup-aware), no artefact.
- Targets: chips ≥ 24 × 24 on fine pointers with 2 px gaps and no overlap, ≥ 48 on coarse (28 §3 probe; the only allowed exception to 44).
- Keyboard: every section reachable by Tab/arrows on the chip row, by ⌘K and from the Loop tab (E2E or story `play`).
- Fidelity: the chip row against `Main` at 1440 and 1180, both themes; remaining differences in tolerance or 26 §4.9 (V13); at most 6 iterations without improvement.
- Stories for every state in both themes; axe clean in Chromium and WebKit; perf spec shows no song-map LoAF vs the s32 baseline; budget before/after reported, `budget --enforce` green.
- Visual baselines: if your change shows in a story the visual matrix captures (the `practice`, `practice-tab-pending` and `practice-stems-expired` rows of `apps/web/e2e/visual/screens.spec.ts`), regenerate those rows with `pnpm --filter @splitune/web e2e:visual:update -g "practice"` (heavy lock, Docker) and list each intended difference; their PNGs are yours by the plan's rule for visual steps. Don't add rows (s45 owns the full matrix).

- Your area passes s33's extended `check-ui-tokens` rules (28 §3: no arbitrary colour, radius, font-size or shadow values, no style-prop colour literals), run on your paths with `--path`, even though the default scope stays `apps/web/app/ui/**` until s45.
### Commands (prefix each with `cd "<worktree>" &&`)
```bash
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget                  # before, then after
pnpm exec biome check . && node scripts/check-db-access.mjs && node scripts/check-ui-tokens.mjs
node scripts/check-ui-tokens.mjs --path apps/web/app/features/practice   # s33's extended 28 §3 rules (arbitrary colour, radius, font-size, shadow, style-prop colours) on your area
pnpm --filter @splitune/web typecheck && pnpm --filter @splitune/web test
pnpm --filter @splitune/web test:stories                                                  # heavy lock
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget --enforce && pnpm --filter @splitune/web css-floor
node scripts/redesign/probe.mjs Main --look night --width 1440 --select '<chip anchors>'
cd apps/web && UV_PROJECT_ENVIRONMENT=<shared ML venv from your brief> UV_NO_SYNC=1 pnpm exec playwright test e2e/perf-practice.spec.ts --project chromium   # heavy lock
cd apps/web && E2E_SMOKE=1 UV_PROJECT_ENVIRONMENT=<shared ML venv from your brief> UV_NO_SYNC=1 pnpm exec playwright test        # heavy lock
```
Known pre-existing failures: WebKit practice/audio stories timing out at 15 s; first `test:stories` run failing in Vite optimisation (rerun once).

## Stop points (stop, report with 2–3 options and a recommendation, wait)
1. 21 V3, 27 §3.7.1, 26 V13 and the mockup disagree.
2. The chip row doesn't fit the budget even after freeing bytes.
3. A file outside the owned globs and the OK'd extras (contracts, `music-core`, the shell's palette code).
4. `set_section` can't target the sections the user sees (for example browser-side fallback sections with no artefact) without a contract change.
5. An existing e2e spec you don't own would break. One owner per existing spec file: `practice.spec.ts` → s35; `onboarding`, `account`, `billing`, `fallbacks`, `a11y` → s36; `journey` → s34; additive `helpers.ts` changes union-merge. A spec owned by an in-flight step becomes yours to change only after its owner has merged: then merge `impl/redesign` into your branch first and make the change. Until then don't edit it; record the exact edit you need (file, line, old → new, and the 27 §5.7 or 12 §8 reason) in your report. New cases go into your own new spec files.

## Git
- Branch `impl/s41b-section-chips`; subject-only Conventional Commits (for example `feat(practice): add section chips to the song map so a chorus loops in one tap`); stage exact paths; gitleaks before each commit.
- Never push, merge, rebase onto `dev` or open a PR. No edits to `docs/status.md`, `docs/progress-log.md`, `docs/steps/README.md`; progress-log entry in your report.
