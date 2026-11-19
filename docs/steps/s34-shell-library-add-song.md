# Step s34 — App shell, ⌘K palette, Library and Add song

Redesign step of the "Night Rehearsal" plan (`redesign/report.md`). Read `docs/steps/00-shared-context.md` first, including its "Redesign steps" section (frozen decisions, decisions D1–D21, environment, known failures, owner gates); this prompt holds what is specific to s34.

| | |
|---|---|
| Branch | `impl/s34-shell-library` from the latest `dev` |
| Hard deps | G2 |
| Gates | G2 approved before you start. **G4** (owner, on devices, batched after the screens lane) reviews these screens and places "Works best with" (27 §3.6) |
| Owned globs | `apps/web/app/features/{shell,library,import}/**`, `apps/web/app/routes/_app.tsx`, `routes/_app/{library,import}.tsx`, their `en.json` keys |
| Also yours | `en.json` keys in the groups `import.*`, `library.*`, `nav.*`, `upload.*`, `record.*`, `delete.song_*`, `plan.allowance` and `analysis.queued_offline` / `analysis.eta_inline`, added inside their group (alphabetical position), never at the end of the file; the `copy-keys.test.ts` `CATALOGUE` entries for `import.live`, `analysis.queued_offline`, `plan.allowance`, `library.empty`, `library.empty_body`, `delete.song_confirm`, `delete.song_confirm_body` (27 §5.6 changed/new); the visual baselines `library--*` and `import-file--*` |
| Ask the owner first | Existing `apps/web/app/ui/` files whose layout 26 §12.2 gives to s34: `song-card.tsx`, `allowance-meter.tsx`, `empty-state.tsx`, `worker-status.tsx`, `drop-zone.tsx`, `waveform-preview.tsx`, `ui/library.stories.tsx`, `ui/import.stories.tsx`; new `ui/` files `command-palette.tsx`, `bottom-nav.tsx`, `continue-card.tsx`, `week-strip.tsx`, `revisit-list.tsx` (or the same components under `features/library`, composed from `ui/`, if they have no new visual primitive); `apps/web/app/copy-keys.test.ts` (entries above); additive changes to `apps/web/e2e/helpers.ts` (union-merged); `routes/_focus.tsx` if the focus shell needs a route change |
| E2E specs | You own `apps/web/e2e/journey.spec.ts` (selector and copy lines your renames break). Other specs: Stop point 6 |
| Effort | high |

## Before you start
- `docs/steps/00-shared-context.md`, `CLAUDE.md`, `docs/specs/25-personal-mode.md`, `docs/specs/23-plans-free-and-paid.md` §5 (locks and limits at the point of action), `docs/specs/13-import-onboarding-and-youtube-embed.md` (import mechanics).
- `docs/specs/27-screens-flows-and-content.md`: §1 (shells, account menu, route map: `/import` → `/library?add=…`, `?add=file|link|record`), §2 (Come back, Add a file, Add a link, Record flows), **§3.5** (Library, phone library, "Before s39" rule), **§3.6** (Add song dialog and phone sheet, every state), **§3.12** (command palette), §4 rows Library, Library filters, Add song, Command palette, §5.2–§5.4 (terms: "Add song", never "Import" in buttons), §5.6 and §5.7 rows marked s34.
- `docs/specs/26-design-system.md` §7 (app bar 64, phone bars 56 / bottom bar 76, container widths), §8 (44 px browse targets), §12.2 rows `AppBar`, `CommandPalette`, `ContinueCard`/`WeekStrip`/`RevisitList`, `BottomNav`, `SongCard`/`SongRow`, `AllowanceMeter`, `EmptyState`, `WorkerStatus`, `StageList` (library uses only the progress line), §13 (long jobs, reversible changes, irreversible changes).
- `docs/specs/28-ui-quality-and-design-review.md` §2 (Screens stories), §3, §4, §5, §5.1.
- Mockups: `Library.dc.html`, `AddSong.dc.html`, `Phone-Library.dc.html`, `Phone-Add.dc.html`, `States.dc.html` (empty library, command palette).
- `redesign/research/product_inventory.md` §2 "Shells", "Routes", §4 (import and start flow), §5 (library).

## What exists (verified at `0c3d5c3`)
- **Shell** `apps/web/app/features/shell/`: `app-shell.tsx`, `marketing-shell.tsx`, `focus-shell.tsx`, `bare-shell.tsx`, `account-menu.tsx`, `usage-meter.tsx`, `skip-link.tsx`, `shell.stories.tsx` (`Screens/Shell`). The marketing, focus and bare shells are in your glob: the marketing bar (27 §1) is yours; s36 builds the pages inside it.
- **Library** `features/library/`: `library-page.tsx`, `song-entry.tsx`, `song-dialogs.tsx` (rename, delete), `song-status.ts` (+ test), `library-skeleton.tsx`, `queries.ts`, `library.stories.tsx` (`Screens/Library`: `Populated`, `ViewSwitch`, `PopulatedList`, `PopulatedDark`, `PopulatedStage`, `WorkerOffline`, `Empty`, `NoResults`, `Loading`, `LoadError`). The songs list contract already has `last_opened_at` and `best_clean` (`packages/contracts/src/api/songs.ts` lines 49, 67–87), enough for the pre-s39 Continue card.
- **Import** `features/import/`: `import-page.tsx` (the `/import` page), `analysis-choice.tsx`, `file-row.tsx`, `link-panel.tsx`, `record-panel.tsx`, `upload-pill.tsx`, `upload-manager.ts` (uploads continue in the background), `preflight.ts` (warning checks), `local-audio.ts`, `recorder.ts`, `import.stories.tsx` (`Screens/Import`).
- **Routes:** `routes/_app.tsx`, `routes/_app/library.tsx`, `routes/_app/import.tsx`.
- **Visual rows** in `apps/web/e2e/visual/screens.spec.ts`: `library` (`screens-library--populated`, light+dark, phone/tablet/desktop) and `import-file` (`screens-import--file-selected`, same matrix).
- No command palette, no bottom navigation, no drop-anywhere overlay, no Continue card exist.

## Goal
The app shell (64 px bar with ⌘K, allowance and a global Add song; phone header plus bottom bar), the command palette, the Library (Pick up / This week / Worth a revisit / grid, every state) and Add song as a dialog on desktop and a full-screen sheet on phones replace today's shell, library and `/import` page, matching the mockups, with Practice opening straight after a pick.

## Decisions that bind this step
- **D1:** 390 px renders of desktop-only boards are not phone references; phone QA compares against `Phone-Library` and `Phone-Add`.
- **D2:** the appearance choices in the account menu and ⌘K are exactly Night Rehearsal / Daylight / Follow my device; `stage` is a valid id, not a choice.
- **D6:** budget 318.7 of 320 KB gzip; the command palette is lazy; report before/after bytes.
- Frozen decision 3: top-bar shell with ⌘K and a global "Add song"; Add song is a dialog (desktop) or a full-screen sheet (phone).
- **Contract with s35 (record it in your progress-log entry):** the palette exposes one registration hook in `features/shell` (for example `usePaletteActions(group, actions)`), which s35 calls from Practice for "Loop bars a–b", view switches and "Display and reading". Record the name in your progress-log entry so s35 uses it.

## Deliverables
1. **App shell** (27 §1, 26 §12.2 `AppBar`): wordmark → Library, Library · Settings nav links, search button "Search songs, clips and actions" + `Kbd` (`Ctrl K` / `⌘ K`; an icon below `lg`), `AllowanceMeter` from `lg`, **Add song** (the one primary), account avatar menu (username · Settings · Keyboard & pedal · Appearance with the three choices · Help · Sign out). Sticky bar; `scroll-padding` so focus is never hidden (2.4.11). Phone: 56 px header + 76 px `BottomNav` (Library · Add song · Settings) with safe-area padding. Files dropped anywhere in the app shell show a "Drop to add" overlay and open Add song with the file. Restyle the marketing, focus and bare shells' bars on the new tokens (27 §1 table).
2. **Command palette** (27 §3.12, lazy): `Dialog` with the 52 px field, groups Songs / Clips / Actions, bold matched text, ↑/↓ + Enter with the `Kbd` on the selected row, "loop 17-20" parsing, the actions list of §3.12 that exist outside Practice (Add song, appearance choices, Set up a pedal → `/settings/keyboard`, Display and reading, Settings sections, Sign out), the registration hook for Practice, ⌘K / Ctrl K in the app and focus shells, a button on touch screens. No global chord for Add song. Empty "No matches. Try a song title or "loop 17-20"."; offline: songs from the cache only.
3. **Library** (27 §3.5): Continue card ("Pick up where you left off", Resume practice primary 56; before s39 only the most recent song with its clip and best clean tempo, no sparkline, no first-pass badge), This week and Worth a revisit **hidden until s39** (build their layout components with fixture stories only), Songs toolbar (filter, instrument chips, sort/status menu, Grid/List), `SongCard` grid and phone rows with every status badge and meta line of §3.5, 24 per page + Show more, filters in the URL. Phone layout per `Phone-Library`. States of 27 §4 (empty, filters empty, loading skeleton, partial, load error with cached cards, offline "Needs connection").
4. **Add song** (27 §3.6): dialog (max 940, `rounded-4xl`) over the library; phone full-screen sheet with a 56 px header and 48 px tabs; tabs File · Link · Record (last used remembered); file card, local waveform preview, non-blocking warning badges, blocking errors, duplicate notice (Open it / Add anyway), Title and Artist (optional); Link tab; Record tab per `Phone-Add`; Your part radio cards with stem swatches and the Hand button; Analysis radio cards Full / Lite with the Welcome and allowance badges (the "mixer for every stem" phrase stays out until s40b, 27 §3.1 honesty gates); footer "It opens right away…" + Cancel + **Start practising** (or "Use this recording" / "Add and analyse"); cap-reached, Welcome, offline, too long states; upload continues after the dialog closes (library card + practice status). Opens from Add song, ⌘K, `?add=`, `/import` (redirect, query kept) or a dropped file. Practice opens with local playback right after a pick (27 §2 "Add a file": playable ≤ 5 s).
5. **Copy:** every s34 row of 27 §5.7 (retire `nav.import` and `library.import_song`, add `nav.add_song`, the new `import.*` and `library.*` keys, `analysis.eta_inline`), the §5.6 changed/new keys above, and the `CATALOGUE` entries updated in `copy-keys.test.ts` (expected-value changes by design; list each with its old and new copy).
6. **Stories:** `Screens/Library` and `Screens/Import` (keep the story ids the visual matrix uses: `screens-library--populated`, `screens-import--file-selected`; add the rest beside them) for every state above, in both themes, at phone and desktop, plus the palette (open, results, empty, offline) and the shell (desktop, phone, drop overlay, account menu open).
7. **Visual baselines:** regenerate the `library` and `import-file` rows after the fidelity check and list the intended differences per image. Don't add new rows (s45 owns the full matrix).

## Out of scope
Progress data in the library (s39: This week, Worth a revisit, sparkline, first-pass badge), the Notify button (s44), marketing pages, auth and settings content (s36), Practice (s35), any API or contract change.

## Acceptance criteria
- Fidelity (28 §5.1, measured with `scripts/redesign/probe.mjs`): `Library` and `AddSong` at 1440 and 1180 (fine pointer), `Phone-Library` and `Phone-Add` at 390 × 844 (`--touch`), the palette and empty library against `States` at 1440, in Night Rehearsal and Daylight; anchors: app bar, nav links, search button, Add song, Continue card, song card parts, toolbar, dialog, tabs, file card, radio cards, footer buttons. Report the mismatch count per board, width and look, with every remaining difference inside tolerance or in 26 §4.9; at most 6 iterations without improvement.
- Structure: `toMatchAriaSnapshot` (or an equivalent probe `aria` comparison) per screen against 27 §3.5/§3.6/§3.12.
- Targets 44 everywhere (28 §3 probe), keyboard-only path through shell → palette → Add song → Start practising, focus never hidden by the bar or the sheet, 200 % text and 320 px reflow on Library and Add song (28 §5).
- One primary action per view (26 §4.5): Add song in the bar is the view's primary; inside the dialog, Start practising is.
- Stories for every state in both themes; axe clean in Chromium and WebKit; copy-keys test green with the changed entries listed.
- `/import` and `/import?tab=record` redirect to `/library?add=file` / `?add=record`; `?add=` opens the dialog; dropping a file opens it with the file.
- Budget before/after reported (palette lazy, outside the practice route); `css-floor` clean.
- E2E smoke green for the specs you own; renamed selectors listed against their 27 §5.7 rows; any needed edit in a spec you don't own recorded in your progress-log entry (Stop point 6).

- Your area passes s33's extended `check-ui-tokens` rules (28 §3: no arbitrary colour, radius, font-size or shadow values, no style-prop colour literals), run on your paths with `--path`, even though the default scope stays `apps/web/app/ui/**` until s45.
### Commands (prefix each with `cd "<worktree>" &&`)
```bash
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget                 # before, then after
pnpm exec biome check . && node scripts/check-db-access.mjs && node scripts/check-ui-tokens.mjs
node scripts/check-ui-tokens.mjs --path apps/web/app/features/shell --path apps/web/app/features/library --path apps/web/app/features/import   # s33's extended 28 §3 rules (arbitrary colour, radius, font-size, shadow, style-prop colours) on your area
pnpm --filter @splitune/web typecheck && pnpm --filter @splitune/web test               # includes copy-keys.test.ts
pnpm --filter @splitune/web test:stories
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget --enforce && pnpm --filter @splitune/web css-floor
node scripts/redesign/render-mockups.mjs --file Library --file AddSong --file Phone-Library --file Phone-Add --file States
node scripts/redesign/probe.mjs Library --look night --width 1440 --select '<anchor>'   # and the story URL with the same anchors
pnpm --filter @splitune/web e2e:visual:update -g "library @|import-file @"               # Docker
cd apps/web && E2E_SMOKE=1 UV_PROJECT_ENVIRONMENT=<shared ML venv> UV_NO_SYNC=1 pnpm exec playwright test   # .env copied
```
Known pre-existing failures: WebKit practice/audio stories timing out at 15 s; first `test:stories` run failing in Vite optimisation (rerun once); api `pipeline.test.ts` ×2 (intermittent) if you run api tests.

## Stop points (stop, report with 2–3 options and a recommendation, wait)
1. 27 §3.5/§3.6, a mockup and the code disagree (for example a state the mockup shows and the spec doesn't name, or "Pick another" needing an API the spec doesn't give).
2. The budget would exceed 320 KB, or the palette can't be lazy.
3. You need a file outside the owned globs and the OK'd extras (a `ui/` file another step owns, `features/practice/**`, `features/settings/**`, `lib/**`, `features/story-fixtures.ts` beyond additive fixtures for your own stories).
4. A contract, API or DB change (none is in scope).
5. An existing e2e or story assertion fails for a reason other than copy or structure that doc 27 changed.
6. An existing e2e spec you don't own would break. One owner per existing spec file: `practice.spec.ts` → s35; `onboarding`, `account`, `billing`, `fallbacks`, `a11y` → s36; `journey` → s34; additive `helpers.ts` changes union-merge. A spec owned by an unmerged step becomes yours to change only after its owner has merged: then merge `dev` into your branch first and make the change. Until then don't edit it; record the exact edit you need (file, line, old → new, and the 27 §5.7 or 12 §8 reason) in your progress-log entry. New cases go into your own new spec files.

## Git
- Branch `impl/s34-shell-library`; subject-only Conventional Commits (for example `feat(web): open add song as a dialog over the library so a pick goes straight to practice`); stage exact paths; gitleaks before each commit.
- Don't push, merge or open a PR unless the owner asks. Append your progress-log entry and update your row in `docs/status.md` (`00-shared-context.md`, "Git and progress").
