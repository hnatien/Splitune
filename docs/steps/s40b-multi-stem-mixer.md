# Step s40b — Multi-stem mixer UI

Redesign step of the "Night Rehearsal" plan (`redesign/report.md`), fifth in the practice lane (s35 → s37 → s38 → s39 → **s40b** → s41b → s42 → s43). Read `docs/steps/00-shared-context.md` first, including its "Redesign steps" section (frozen decisions, decisions D1–D21, environment, known failures, owner gates); this prompt holds what is specific to s40b.

## Carried over from earlier steps (2026-11-08)
- s40a (keep every stem) may not be merged when you start: its G3 waits for `impl/29-separation-improvements` (D16). Build against the stems fixture and story data (D15), and show only the stems an analysis actually has. Once s40a merges, its refreshed `packages/contracts/fixtures/stems.json` lists every kept stem and leaves empty extras out.
- Isolated stems don't always sum to the song: a two-stem head has no extras, and with impl/29 "other" can hold the learner's keys. Use the mix-minus as the band unless every instrument was kept.

| | |
|---|---|
| Branch | `impl/s40b-mixer` from the latest `dev` |
| Hard deps | s39, s40a (merged, so after G3) |
| Gates | G4 (practice-lane review, batched) |
| Owned globs | practice mixer files, `packages/audio-engine/**` if a channel needs it |
| "Practice mixer files", concretely | `apps/web/app/features/practice/mixer-drawer.tsx`, `model/mixer.ts` (+ test), `model/practice-audio.ts` and `model/audio-source.ts` where channels are loaded, the Mix tab and mix-pill files s35 created, new mixer files under `features/practice/`, the hot practice files, and `en.json` keys in `mixer.*` and the mix rows of `practice.*` (`practice.preset_gloss_*`, `practice.rough_stem` use) |
| Ask the owner first | `apps/web/app/ui/stem-row.tsx`, `mix-preset-group.tsx` and `ui/mixer.stories.tsx` (the "all stems s40b" row of 26 §12.2) |
| Effort | high |

## Before you start
- `docs/steps/00-shared-context.md`, `CLAUDE.md`, `docs/specs/25-personal-mode.md`.
- `docs/specs/12-practice-screen-and-notation.md` **§7** (channels, helpers, presets incl. Rhythm only, the limiter at unity, instant changes, no drag needed, later scope), §8 (`M` mutes your part), §10.
- `docs/specs/11-audio-engine.md` §4 (stems in the engine, gains on the pre-stretch submix bus).
- `docs/specs/27-screens-flows-and-content.md` **§3.7.4 Mix** (2 × 2 preset radio grid, stem rows in mixer order, "Your part" first, "Rough" badge, Helpers: Click and Hear the chords, Reset mix, "Use as default for {part}"), §3.7.1 (dock mix pill "5 stems · click on"; below 1280 the pill is icon-only and volume moves into a popover), §3.7.2 (the phone Tools sheet's Mix rows; you build the mini-mixer, s43 places it), §3.7.5 (Drums: per-drum channels are later scope), §5.2 ("Band", "Stem", "Mix"), §5.7 `mixer.*` rows.
- `docs/specs/26-design-system.md` §4.4 (stem colours, always labelled; "Your part" is never a colour), §12.2 `StemRow`, `MixPresetGroup`, §8 (M/S 48 boxes, faders click-to-set with a stepper), §12.3 (M/S cue: filled vs outlined + "muted"/"solo" in the readout and name).
- `docs/specs/28-ui-quality-and-design-review.md` §3, §5, §5.1; `docs/steps/s40a-all-stems-backend.md` and s40a's report (what `stems.json` now holds).
- Mockups: `Practice-Mix.dc.html` (Mix tab and Chords view), `Phone-Tools.dc.html` (mini-mixer rows).

## What exists (verified at `0c3d5c3`; s35 and s40a will have changed it)
- `features/practice/model/mixer.ts`: `mixChannels` returns exactly two channels, "Your part" (`isolated`, the learner's instrument) and the mix-minus ("backing"); presets `part-loud`, `minus-one`, `original`; the comment notes other isolated stems would double the mix-minus. `mixer-drawer.tsx` (lazy) renders them.
- `packages/audio-engine`: `dsp.ts` `MAX_STEMS = 8`; `mixer.ts` (`MixerChannel`, `resolveGains`, `dbToGain`); `engine.ts` has a click (`metronome`, `clickGain`) and a master gain after the processor. No synth (s38 adds a practice-side synth for audition, which "Hear the chords" reuses).
- After s40a, `stems.json` lists every kept stem (`isolated` with `instrument`, `quality_hint`, `empty`) plus the target's `mix_minus`.

## Goal
The Mix tab and the dock's mix pill offer every real stem with "Your part" first and labelled, presets (Your part loud, Minus-one, Original, Rhythm only), "Rough" tags, Click and "Hear the chords" channels, and a phone mini-mixer, with changes instant, no preset louder than the original, and every control usable without dragging.

## Decisions that bind this step
- **D6:** budget 318.7 of 320 KB gzip; the Mix tab body is lazy; report before/after bytes.
- 26 §4.4 and frozen decision 1: stems are colour-coded but always labelled; "Your part" is a badge and its name, never a colour.
- 12 §7 safety: a limiter at unity; no preset pushes the master above 0 dBFS.

## Deliverables
1. **Channel model:** from `stems.json`, one channel per non-empty stem in mixer order ("Your part" first); when every other stem exists, the band is the sum of isolated stems and the mix-minus isn't played on top (no doubling); when stems are missing (older analyses, a two-stem run), fall back to "Your part" + "Band" (mix-minus) as today. Unit tests for both cases and for stems marked `empty`.
2. **Engine:** stay within `MAX_STEMS`; if a channel (for example the chord synth on the submix bus, or more than 8 sources) needs an engine change, take `packages/audio-engine/**` and add offline audio tests for gains, solo, mute and the limiter at unity.
3. **Presets** (12 §7): Your part loud (+6 / −6 dB), Minus-one, Original (unity), Rhythm only (bass and drums only, shown when both exist); Reset mix; "Use as default for {part}" (per device); a changed mix marks the Mix tab with a dot; the dock pill names the preset and the real stem count.
4. **Rows:** `StemRow` per 26 §12.2 (colour rule, name, "Your part" / "Rough" badges with the reason tooltip `practice.rough_stem`, M/S painted 32 in 48 boxes with filled vs outlined and "muted"/"solo" text, stem-colour fader with click-to-set, dB readout that opens a stepper, −30…+6 dB); `M` key mutes your part; PedalHud for mix keys.
5. **Helpers:** Click (level + switch), **Hear the chords** ("A soft synth plays what we transcribed", using s38's synth, on the same clock and through the same master and limiter).
6. **Phone mini-mixer:** preset chips and two rows ("{part} · your part", "Band") with a stepped fader and an M painted 44 in a 48 box, plus "All {n} stems" opening the full Mix tab as a sheet; used by today's phone layout now and placed in the Tools sheet by s43.
7. **Copy:** `mixer.preset_rhythm` + gloss, Hear the chords keys, the remaining s40b rows of 27 §5.7 (`mixer.*`, preset glosses). The "Every stem has its own fader." and "a mixer for every stem" honesty-gate flips on Home, Pricing and Add song are s45's.
8. **Stories:** 2 stems (fallback), 6 stems, Rough stem, solo, muted, Rhythm only available / unavailable, Hear the chords on, long stem names, phone mini-mixer; both themes and increased contrast (stem colours pass the CVD test, and the labels carry the meaning).

## Out of scope
Per-drum and per-hand channels (later scope), new separation (s40a), section chips (s41b), the Tools sheet itself (s43).

## Acceptance criteria
- Unit tests: channel building (all stems, fallback, empty stems), preset gains, Rhythm only availability, no doubling with the mix-minus; offline audio test that no preset exceeds 0 dBFS master.
- Fidelity: Mix tab against `Practice-Mix` at 1440 and 1180; the mini-mixer against `Phone-Tools` at 390 (`--touch`; D1); both themes; remaining differences in tolerance or 26 §4.9 (V6 stem colours, V12 boxes); at most 6 iterations without improvement.
- No drag needed (2.5.7): every fader has click-to-set and a stepper (E2E without dragging).
- Targets: M/S and faders 48; colour never the only cue (Rough badge, "Your part" badge, muted text).
- Stories for every state in both themes; axe clean in Chromium and WebKit; budget before/after reported, `budget --enforce` green; perf spec shows no regression on the mixer fader step vs the s32 baseline.
- Visual baselines: if your change shows in a story the visual matrix captures (the `practice`, `practice-tab-pending` and `practice-stems-expired` rows of `apps/web/e2e/visual/screens.spec.ts`), regenerate those rows with `pnpm --filter @splitune/web e2e:visual:update -g "practice"` (Docker) and list each intended difference; their PNGs are yours by the plan's rule for visual steps. Don't add rows (s45 owns the full matrix).

- Your area passes s33's extended `check-ui-tokens` rules (28 §3: no arbitrary colour, radius, font-size or shadow values, no style-prop colour literals), run on your paths with `--path`, even though the default scope stays `apps/web/app/ui/**` until s45.
### Commands (prefix each with `cd "<worktree>" &&`)
```bash
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget                  # before, then after
pnpm exec biome check . && node scripts/check-db-access.mjs && node scripts/check-ui-tokens.mjs
node scripts/check-ui-tokens.mjs --path apps/web/app/features/practice   # s33's extended 28 §3 rules (arbitrary colour, radius, font-size, shadow, style-prop colours) on your area
pnpm --filter @splitune/audio-engine typecheck && pnpm --filter @splitune/audio-engine test   # if you changed it
pnpm --filter @splitune/web typecheck && pnpm --filter @splitune/web test
pnpm --filter @splitune/web test:stories
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget --enforce && pnpm --filter @splitune/web css-floor
node scripts/redesign/probe.mjs Practice-Mix --look night --width 1440 --select '<mixer anchors>'
node scripts/redesign/probe.mjs Phone-Tools --look night --touch --select '<mini-mixer anchors>'
cd apps/web && UV_PROJECT_ENVIRONMENT=<shared ML venv> UV_NO_SYNC=1 pnpm exec playwright test e2e/perf-practice.spec.ts --project chromium
cd apps/web && E2E_SMOKE=1 UV_PROJECT_ENVIRONMENT=<shared ML venv> UV_NO_SYNC=1 pnpm exec playwright test
```
Known pre-existing failures: WebKit practice/audio stories timing out at 15 s; first `test:stories` run failing in Vite optimisation (rerun once).

## Stop points (stop, report with 2–3 options and a recommendation, wait)
1. 12 §7, 27 §3.7.4 and the mockup disagree (for example the mockup shows a per-drum channel).
2. The budget would exceed 320 KB.
3. A file outside the owned globs and the OK'd extras (contracts, `services/ml`, the Tools sheet).
4. `stems.json` from s40a lacks something a row needs (a contract change).
5. Sync or the limiter can't be met without an engine change you haven't been given.
6. An existing e2e spec you don't own would break. One owner per existing spec file: `practice.spec.ts` → s35; `onboarding`, `account`, `billing`, `fallbacks`, `a11y` → s36; `journey` → s34; additive `helpers.ts` changes union-merge. A spec owned by an unmerged step becomes yours to change only after its owner has merged: then merge `dev` into your branch first and make the change. Until then don't edit it; record the exact edit you need (file, line, old → new, and the 27 §5.7 or 12 §8 reason) in your progress-log entry. New cases go into your own new spec files.

## Git
- Branch `impl/s40b-mixer`; subject-only Conventional Commits (for example `feat(practice): show every separated stem in the mixer so learners can solo the band part by part`); stage exact paths; gitleaks before each commit.
- Don't push, merge or open a PR unless the owner asks. Append your progress-log entry and update your row in `docs/status.md` (`00-shared-context.md`, "Git and progress").
