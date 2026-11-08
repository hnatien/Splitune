# Step s42 — Beat pulse (V9) and sound-delay calibration

Redesign step of the "Night Rehearsal" plan (`redesign/report.md`), seventh in the practice lane (s35 → s37 → s38 → s39 → s40b → s41b → **s42** → s43). Read `docs/steps/00-shared-context.md` first, including its "Redesign steps" section (frozen decisions, decisions D1–D21, environment, known failures, owner gates); this prompt holds what is specific to s42.

| | |
|---|---|
| Branch | `impl/s42-beat-pulse` from the current `dev` |
| Hard deps | s41b, s36 |
| Gates | G4 (practice-lane review); **G5** (owner, before the final merge) checks audio sync by ear with wired and Bluetooth headphones after calibration (offset ≤ 25 ms, 28 §6) |
| Owned globs | practice beat-pulse files, `features/settings/**` sound-delay parts, `packages/audio-engine/**` if needed |
| Concretely | the `BeatPulse` host code in `apps/web/app/features/practice/` (Now column, glance header, drum-grid header), a new pulse-schedule module with its unit test, the vibrate scheduler, the hot practice files, the sound-delay card in `apps/web/app/features/settings/display-settings.tsx` and a new tap-along component under `features/settings/`, and `en.json` keys `settings.sound_delay_hint`, `settings.tap_along`, `settings.sound_delay_now` and any new beat-pulse keys in `practice.*` |
| Ask the owner first | `apps/web/app/ui/beat-pulse.tsx` (+ stories; s35 created it); `apps/web/app/lib/display-store.ts` (s35's; yours for this change: `MAX_SOUND_DELAY_MS = 150` is a symmetric limit; the new range is −150 to +500 ms, and the vibrate setting needs a stored field). The engine clamp change below is inside your `packages/audio-engine/**` glob |
| Effort | high |

## Before you start
- `docs/steps/00-shared-context.md`, `CLAUDE.md`, `docs/specs/25-personal-mode.md`.
- `docs/specs/21-v1-features.md` **V9** (flash limits, downbeat by shape, haptics, the UI (redesign, s42) paragraph with the −150 to +500 ms range and the wireless warning), `docs/specs/11-audio-engine.md` (output latency, the click), `docs/specs/12-practice-screen-and-notation.md` §3 (one clock; sound delay shifts what is drawn and heard), §9, §10.
- `docs/specs/26-design-system.md` **§10** (flash safety: ≤ 3 changes a second, a 14–26 px dot, shape and fill, never full screen, never red; above 3 beats a second only the downbeat; vibration on the same schedule, off by default; reduced motion: static "beat n of 4"), §12.2 `BeatPulse` (4 dots meter-aware, downbeat square, sizes 14 / 20 / 22 / 26, `aria-label` "Beat 3 of 4"), §4.7 `--beat-now` / `--beat-done` / `--beat-slot`.
- `docs/specs/27-screens-flows-and-content.md` §3.7.1 (Now column), §3.7.2 (glance beats 20, Stand view beats 26), §3.7.5 (drums: beats 22), **§3.9 Sound delay card** ("Tap along with 8 clicks…", badge "Now +180 ms · measured with Bluetooth headphones", **Tap along to measure** primary 48, manual stepper −150 to +500 ms in 10 ms steps under "Set it by hand", the wireless warning), §5.7 `settings.sound_delay_hint` row.
- `docs/specs/28-ui-quality-and-design-review.md` §3 (Flashing row: a unit test of the pulse schedule; Motion row), §5, §5.1, §6 (device checks).
- Mockups: `Main.dc.html` (Now column beats), `Settings-Display.dc.html` (Sound delay card), `Stand.dc.html` and `Phone-Practice.dc.html` (beat sizes; s43 builds those layouts).

## What exists (verified at `0c3d5c3`; s35 and s36 will have changed it)
- `apps/web/app/lib/display-store.ts`: `soundDelayMs` (default 0) and `MAX_SOUND_DELAY_MS = 150` (line 40), used symmetrically by the Display & practice stepper (`features/settings/display-settings.tsx` lines ~174–192) and read by `features/practice/practice-context.tsx`.
- `packages/audio-engine/src/engine.ts`: `MAX_DISPLAY_OFFSET = 0.15` (line 27) and `setDisplayOffset` clamps the offset to ±0.15 s (line ~304), so today nothing beyond ±150 ms reaches the playhead; the `lib/display-store.ts` comment (line 39) says the store follows that clamp. The click (`metronome`, `clickGain`) runs on the beat grid; `clock.ts` reads `getOutputTimestamp()`; nothing reads `AudioContext.outputLatency` for a warning.
- After s35: a static `BeatPulse` in the Now column (no animation). No vibration code exists.

## Goal
The beat pulse shows the beat in a small dot (downbeat by shape) without ever flashing more than 3 times a second at any tempo or subdivision, with optional vibration on the same schedule; and a tap-along calibration with a range wide enough for Bluetooth headphones lines up the beat lights, playhead and sound, warning when the output looks wireless.

## Decisions that bind this step
- **D6:** budget 318.7 of 320 KB gzip: the pulse runs on the practice route, so keep it tiny (no new dependency) and keep the tap-along card lazy; report before/after bytes.
- WCAG 2.3.1 and 26 §10 are hard limits: never more than 3 changes a second, never red, never a large area.

## Deliverables
1. **Pulse schedule** (pure function + unit test, 28 §3 "Flashing"): from the beat grid, meter, tempo, speed and subdivision, return the dot changes to draw; at > 3 beats a second (> 180 BPM at the played speed, or subdivisions) mark only the downbeat; prove ≤ 3 changes in every 1 s window at tempos 40–300 BPM, speeds 25–110 %, meters 2/4–7/8 and every subdivision.
2. **`BeatPulse`:** done / now / upcoming per 26 §12.2 with `--beat-*` tokens, the now dot with glow (Night; no glow under increased contrast), downbeat square, sizes per host (14 Now column default, 20 glance, 22 drum header, 26 Stand view), moved by the audio clock in rAF without layout reads; `aria-hidden` dots with a polite "Beat 3 of 4" only on request (no live announcements every beat); reduced motion: a static "Beat n of 4" readout.
3. **Vibrate on beat:** `navigator.vibrate` where supported (feature-detected), off by default, on the same schedule (downbeat only above 3 a second), stored per device; the Tools-sheet tile is s43's.
4. **Sound delay** (27 §3.9): the card with the hint, the badge "Now {ms} · measured with {output}", **Tap along to measure** (8 clicks, taps by Space, pointer or a pedal key; median offset, outliers dropped; re-run and Cancel), the manual stepper −150 to +500 ms in 10 ms steps under "Set it by hand"; the wireless warning when `AudioContext.outputLatency` (where available) suggests Bluetooth, worded per 27 §3.9; the delay applies to the beat lights, the playhead and the click (one offset on the one clock). **Engine:** replace the symmetric ±0.15 s clamp in `packages/audio-engine/src/engine.ts` (`MAX_DISPLAY_OFFSET`, line 27; `setDisplayOffset`, line ~304) with the asymmetric −0.15…+0.5 s range (named min/max constants), and update the store limits to match; any engine test that encodes ±0.15 changes its expected value by design (list it).
5. **Copy:** the s42 rows of 27 §5.7 and new beat-pulse keys.
6. **Stories:** pulse at 60, 120, 200 BPM and with subdivisions (downbeat only), 3/4 and 7/8, reduced motion, increased contrast, both themes; tap-along idle, measuring, result, wireless warning, manual stepper at both limits.

## Out of scope
Stand view, glance and Tools-sheet layouts (s43; they host the pulse), mic-based latency measurement, MIDI.

## Acceptance criteria
- Pulse-schedule unit test green across the full grid above; story `play` checks that the downbeat differs by shape, the dot stays ≤ 26 px and reduced motion shows the static readout.
- Calibration: unit tests for the tap-offset estimate (outliers, too few taps), the −150 / +500 limits and 10 ms steps; the offset reaches the playhead and click (test); an `audio-engine` unit test that `setDisplayOffset` keeps −0.15 and +0.5 s and clamps −0.2 and +0.6 s to them.
- Fidelity: Now column beats against `Main`, the Sound delay card against `Settings-Display`, at 1440 and 1180, both themes; remaining differences in tolerance or 26 §4.9; at most 6 iterations without improvement.
- Perf: no LoAF from the pulse in steady playback (perf spec vs the s32 baseline).
- Stories for every state in both themes; axe clean in Chromium and WebKit; budget before/after reported, `budget --enforce` green.
- G5 owner action written: wired and Bluetooth headphones, tap along, then check sync by ear (offset ≤ 25 ms).
- Visual baselines: if your change shows in a story the visual matrix captures (the `practice`, `practice-tab-pending` and `practice-stems-expired` rows of `apps/web/e2e/visual/screens.spec.ts`), regenerate those rows with `pnpm --filter @splitune/web e2e:visual:update -g "practice"` (Docker) and list each intended difference; their PNGs are yours by the plan's rule for visual steps. Don't add rows (s45 owns the full matrix).

- Your area passes s33's extended `check-ui-tokens` rules (28 §3: no arbitrary colour, radius, font-size or shadow values, no style-prop colour literals), run on your paths with `--path`, even though the default scope stays `apps/web/app/ui/**` until s45.
### Commands (prefix each with `cd "<worktree>" &&`)
```bash
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget                  # before, then after
pnpm exec biome check . && node scripts/check-db-access.mjs && node scripts/check-ui-tokens.mjs
node scripts/check-ui-tokens.mjs --path apps/web/app/features/practice --path apps/web/app/features/settings   # s33's extended 28 §3 rules (arbitrary colour, radius, font-size, shadow, style-prop colours) on your area
pnpm --filter @splitune/audio-engine typecheck && pnpm --filter @splitune/audio-engine test   # if you changed it
pnpm --filter @splitune/web typecheck && pnpm --filter @splitune/web test
pnpm --filter @splitune/web test:stories
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget --enforce && pnpm --filter @splitune/web css-floor
node scripts/redesign/probe.mjs Settings-Display --look night --width 1440 --select '<sound delay anchors>'
cd apps/web && UV_PROJECT_ENVIRONMENT=<shared ML venv> UV_NO_SYNC=1 pnpm exec playwright test e2e/perf-practice.spec.ts --project chromium
```
Known pre-existing failures: WebKit practice/audio stories timing out at 15 s; first `test:stories` run failing in Vite optimisation (rerun once).

## Stop points (stop, report with 2–3 options and a recommendation, wait)
1. 21 V9, 26 §10, 27 §3.9 and the mockups disagree (for example a mockup pulse that changes a large area).
2. The budget would exceed 320 KB.
3. A file outside the owned globs and the OK'd extras.
4. Any schedule that can't stay ≤ 3 changes a second while still showing the beat: show less, never more.
5. An existing e2e spec you don't own would break. One owner per existing spec file: `practice.spec.ts` → s35; `onboarding`, `account`, `billing`, `fallbacks`, `a11y` → s36; `journey` → s34; additive `helpers.ts` changes union-merge. A spec owned by an unmerged step becomes yours to change only after its owner has merged: then merge `dev` into your branch first and make the change. Until then don't edit it; record the exact edit you need (file, line, old → new, and the 27 §5.7 or 12 §8 reason) in your progress-log entry. New cases go into your own new spec files.

## Git
- Branch `impl/s42-beat-pulse`; subject-only Conventional Commits (for example `feat(practice): pulse the beat in a small dot capped at three changes a second so it is safe at any tempo`); stage exact paths; gitleaks before each commit.
- Don't push, merge or open a PR unless the owner asks. Append your progress-log entry and update your row in `docs/status.md` (`00-shared-context.md`, "Git and progress").
