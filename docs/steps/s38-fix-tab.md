# Step s38 — Fix tab: the unsure-spot queue, alternatives in frequencies, audition over the loop

Redesign step of the "Night Rehearsal" plan (`redesign/report.md`), third in the practice lane (s35 → s37 → **s38** → s39 → s40b → s41b → s42 → s43). Read `docs/steps/00-shared-context.md` first, including its "Redesign steps" section (frozen decisions, decisions D1–D21, environment, known failures, owner gates); this prompt holds what is specific to s38.

| | |
|---|---|
| Branch | `impl/s38-fix-tab` from the current `dev` |
| Hard deps | s37 |
| Gates | G4 (practice-lane review, batched; places "Replace all in this song" and "Show original", which have no mockup) |
| Owned globs | practice editor/fix files |
| "Practice editor/fix files", concretely | `apps/web/app/features/practice/{editor-sheet,editor-content,edit-page,score-tools}.tsx`, `model/{corrections,edits,chord-input,fret-notes}.ts` (+ tests), the Fix tab and Fix-mode files s35 created, new Fix files under `features/practice/` (queue, ranking, frequency wording, the audition synth), `apps/web/app/routes/_focus/songs/$songId.edit.tsx`, the hot practice files (`practice-context.tsx`, `practice.stories.tsx`, `practice-story-data.ts`), and `en.json` keys in `fix.*` (a new group at its alphabetical position), `edit.*`, `editor.*`, `history.*` and the Fix rows of `practice.*` |
| Also yours | the `copy-keys.test.ts` `CATALOGUE` entry for `practice.fix_saved_note` (new) |
| Ask the owner first | `apps/web/app/copy-keys.test.ts` (that entry); new `apps/web/app/ui/` files `fix-queue.tsx`, `alternative-row.tsx`, `edit-history.tsx` if they carry a new visual pattern (otherwise keep them in `features/practice`); `packages/audio-engine/**` only if the audition synth can't share the engine's `AudioContext` from practice code (see Deliverable 4) |
| Effort | high |

## Before you start
- `docs/steps/00-shared-context.md`, `CLAUDE.md`, `docs/specs/25-personal-mode.md`.
- `docs/specs/12-practice-screen-and-notation.md` **§4** (Fix tab: queue by consequence then probability, shaky bar, J/K, Listen to, chord / note / beat cards, Your edits, Show original, optimistic ops, offline queue, "never implies the model learns"), §6 (`Audition` state), §8 (J / K / E, undo/redo), §10 (re-render ≤ 150 ms, re-quantize ≤ 300 ms).
- `docs/specs/05-analysis-schema.md` (confidence bands, `CorrectionOp`), `docs/specs/07-music-algorithms.md` (quantize, alt fingerings), `docs/specs/21-v1-features.md` "Redesign scope that is not a V-feature" (Fix row: the correction ops that exist).
- `docs/specs/27-screens-flows-and-content.md` **§3.7.4 Fix** (Fix mode top bar pill, song map, notation washes, key line, Spot header, chord card, note card, beat fixes, Your edits, the Fix dock 80 with Play 64 and speed −/+ 64, Listen to segmented 48, toast), **§3.8** (the desktop editor), §2 "Fix an unsure spot", §4 rows Practice inspector (Fix empty "Nothing marked unsure in this song.") and Edit, §5.3 (frequency wording, rounding to 1 in 2 / 3 / 4 / 5 / 10 / 20), §5.6 `practice.fix_saved_note`, §5.7 `fix.*` row.
- `docs/specs/26-design-system.md` **§5** (encoding, ranking), §12.2 `FixQueue` / `AlternativeRow` / `EditHistory`, §13 (Undo toast), §8 (Fix-mode targets: Play and speed 64, V11).
- `docs/specs/28-ui-quality-and-design-review.md` §3, §5, §5.1; `redesign/research/ai_confidence_processing_ux.md`.
- Mockup: `Practice-Fix.dc.html`.

## What exists (verified at `0c3d5c3`; s35 will have moved the editor into the Fix tab)
- **Editor** `features/practice/`: `editor-sheet.tsx` (lazy from `practice-page.tsx`), `editor-content.tsx`, `edit-page.tsx` (the `/songs/$id/edit` desktop editor; route `routes/_focus/songs/$songId.edit.tsx`; touch devices redirect to practice), `model/corrections.ts`, `model/edits.ts`, `model/chord-input.ts` (Harte-validated typed chords), `model/fret-notes.ts`, with tests. `en.json` has `edit.*` (9 keys, "Your edits", "Revert"), `editor.*` (35) and `history.*` (11, one per op: "Changed a chord", …).
- **Ops** (`packages/contracts/src/analysis/corrections.ts`): `set_chord`, `split_chord`, `set_note`, `add_note`, `delete_note`, `shift_downbeat`, `tempo_octave`, `nudge_beat`, `set_section`, `mark_correct`, `report_wrong`; persisted by `POST /artefacts/{id}/corrections`, applied by `music-core` `applyCorrections`.
- **Alternatives data:** chords carry `top_k: [{ label, prob }]` (≤ 5, `packages/contracts/src/analysis/chords.ts`); tab notes carry `alt_fingerings` (≤ 3, `tab.ts` line 24); every artefact carries confidence bands.
- **No synth exists** anywhere (`packages/audio-engine` or the web); `packages/audio-engine/src/engine.ts` accepts an existing `AudioContext` through `options.context` (line ~93), so a practice-side synth can share the engine's context and clock.
- No unsure-spot queue, ranking, frequency wording or Fix mode exists.

## Goal
Choosing Fix (the tab, `E`, or a "?") enters Fix mode: the learner steps through every unsure spot ranked by consequence with J / K, hears an alternative over the loop, and takes it with Use (or "It's right"), in at most two taps, with every change saved, undoable and listed in Your edits; the desktop editor shares the same components.

## Decisions that bind this step
- Frozen decision 4: confidence is never shown by colour alone: dashed outline plus "?", frequency wording such as "about 1 in 3"; never a percentage or a probability.
- **D6:** budget 318.7 of 320 KB gzip; the Fix tab and Fix mode are lazy and stay outside the route budget; report before/after bytes.
- **D1:** compare `Practice-Fix` at 1440 and 1180 only.
- 26 §5 (C1): no step in s32–s45 hides marks; Fix shows every stage that produces bands.

## Deliverables
1. **Queue and ranking** (12 §4, 26 §5): every unsure spot from the effective artefacts (chords and notes of the current part), a mostly-unsure bar as one "shaky bar" spot, ranked by consequence (wrong pitch or string/fret, octave error, wrong chord root or quality) then by probability; pure functions with unit tests, including order stability and 99+ spots.
2. **Frequency wording:** one helper that maps a band or a candidate probability to "about 1 in n" (n ∈ {2, 3, 4, 5, 10, 20}, nearest) and "we'd guess wrong about 1 time in n"; unit tests at every boundary.
3. **Fix mode** (27 §3.7.4): the top-bar `--unsure-surface` pill "Fixing · every change saves as you go" + Undo + **Done**; the song map shows the overview, hatch and selection band; the notation washes the selected bars and rings the selected note; the key line; the Fix dock 80 with Play (64) "Play bars 27 to 28", Listen to: Original · Your part · Tab synth · Both (48), speed − / + (64); J / K / E and the arrows in the tab; Esc or Done leaves.
4. **Audition:** "Hear {chord} over the loop" plays the alternative's voicing over the looped bars, and Listen to "Tab synth" plays the transcribed part. Build a small Web Audio synth in practice code that uses the engine's `AudioContext` and schedules against the audio clock (the player machine's `Audition` state, 12 §6); s40b reuses it for "Hear the chords". If it can't stay in sync without an engine change, stop and ask for `packages/audio-engine/**`.
5. **Cards:** Spot header "Spot 2 of 6 · bar 27–28" with an `--unsure` progress and previous/next; chord card (the guess at 40, dashed unsure, "Our first guess. Wrong about 1 time in 3 for bars like this.", "Other likely chords" rows "Am7 · about 1 in 3" with Hear and **Use**, "Type a chord, e.g. Am7", "Split at beat 3"); note card ("D4 · string 2, fret 3 ?", "or play it as" chips from `alt_fingerings`, String and Fret steppers, **It's right** = `mark_correct`, Delete note, Report wrong); beat fixes (Half tempo · Double tempo · Move downbeat, then "Re-barred {n} bars" with Undo, re-quantized in the browser ≤ 300 ms); Your edits with Revert per op and edited marks underlined.
6. **Persistence:** optimistic ops with `client_op_id`, Undo toast ("Edit saved · bar 31, string 3 → fret 2"), rollback with the error toast on refusal, offline queue ("Saved on this device"); copy "Your fixes are saved for this song." (`practice.fix_saved_note`) and nothing that implies the model learns.
7. **Desktop editor** (27 §3.8): `/songs/$id/edit` restyled from the same components (wide notation, inspector with the cards, undo/redo, Hear original); touch devices still redirect to Practice in Fix mode.
8. **"Replace all in this song" and "Show original"** (no mockup): implement both (12 §4) and place them where 27 §3.7.4 suggests; list the placement as a G4 item for the owner.
9. **Stories** (`FixMode` and friends): empty ("Nothing marked unsure in this song."), first spot, chord spot, note spot, shaky bar, beat fix with the consequence line, after Use (edited mark), Revert, offline queued, 99+ spots, long chord names (F♯m7♭5), both themes and increased contrast; the desktop editor.

## Out of scope
Model retraining or any ML change, new correction ops or contract changes, the mixer's "Hear the chords" channel (s40b), Progress (s39).

## Acceptance criteria
- Unit tests: ranking, shaky-bar grouping, frequency wording, synth scheduling against the clock, optimistic apply and rollback.
- ≤ 2 taps from a "?" to an alternative playing (E2E or story `play`), keys only (J/K/Enter) path works, edits survive reload, an offline edit queues and syncs.
- Fidelity: `Practice-Fix` at 1440 and 1180, Night Rehearsal and Daylight (pill, spot header, cards, alternative rows, Fix dock); remaining differences in tolerance or 26 §4.9 (V11 64 px Play and speed); at most 6 iterations without improvement.
- Targets: Fix dock Play and speed −/+ 64, Listen to items 48, nothing under 44; focus never hidden by the Fix dock or toasts.
- Perf (12 §10): re-render after an edit ≤ 150 ms, re-quantize ≤ 300 ms (measured, reported).
- Stories for every state in both themes; axe clean in Chromium and WebKit; copy-keys test green.
- Budget before/after reported; Fix lazy; `budget --enforce` green.
- Visual baselines: if your change shows in a story the visual matrix captures (the `practice`, `practice-tab-pending` and `practice-stems-expired` rows of `apps/web/e2e/visual/screens.spec.ts`), regenerate those rows with `pnpm --filter @splitune/web e2e:visual:update -g "practice"` (Docker) and list each intended difference; their PNGs are yours by the plan's rule for visual steps. Don't add rows (s45 owns the full matrix).

- Your area passes s33's extended `check-ui-tokens` rules (28 §3: no arbitrary colour, radius, font-size or shadow values, no style-prop colour literals), run on your paths with `--path`, even though the default scope stays `apps/web/app/ui/**` until s45.
### Commands (prefix each with `cd "<worktree>" &&`)
```bash
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget                  # before, then after
pnpm exec biome check . && node scripts/check-db-access.mjs && node scripts/check-ui-tokens.mjs
node scripts/check-ui-tokens.mjs --path apps/web/app/features/practice   # s33's extended 28 §3 rules (arbitrary colour, radius, font-size, shadow, style-prop colours) on your area
pnpm --filter @splitune/web typecheck && pnpm --filter @splitune/web test
pnpm --filter @splitune/web test:stories
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget --enforce && pnpm --filter @splitune/web css-floor
node scripts/redesign/render-mockups.mjs --file Practice-Fix
node scripts/redesign/probe.mjs Practice-Fix --look night --width 1440 --select '<anchor>'
cd apps/web && E2E_SMOKE=1 UV_PROJECT_ENVIRONMENT=<shared ML venv> UV_NO_SYNC=1 pnpm exec playwright test
```
Known pre-existing failures: WebKit practice/audio stories timing out at 15 s; first `test:stories` run failing in Vite optimisation (rerun once).

## Stop points (stop, report with 2–3 options and a recommendation, wait)
1. 12 §4, 27 §3.7.4, 26 §5 and the mockup disagree (for example the mockup ranks by bar order).
2. The budget would exceed 320 KB with Fix lazy.
3. A file outside the owned globs and the OK'd extras (a contract, `packages/music-core`, `packages/audio-engine`).
4. The data can't support a card the spec shows (for example no per-note alternative pitch) without a contract change.
5. The synth can't stay in sync from practice code.
6. An existing e2e spec you don't own would break. One owner per existing spec file: `practice.spec.ts` → s35; `onboarding`, `account`, `billing`, `fallbacks`, `a11y` → s36; `journey` → s34; additive `helpers.ts` changes union-merge. A spec owned by an unmerged step becomes yours to change only after its owner has merged: then merge `dev` into your branch first and make the change. Until then don't edit it; record the exact edit you need (file, line, old → new, and the 27 §5.7 or 12 §8 reason) in your progress-log entry. New cases go into your own new spec files.

## Git
- Branch `impl/s38-fix-tab`; subject-only Conventional Commits (for example `feat(practice): queue unsure spots by consequence so the learner fixes what matters first`); stage exact paths; gitleaks before each commit.
- Don't push, merge or open a PR unless the owner asks. Append your progress-log entry and update your row in `docs/status.md` (`00-shared-context.md`, "Git and progress").
