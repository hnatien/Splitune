# Step s36 — Everything outside the app: home, auth, onboarding, pricing, settings IA, system states

Redesign step of the "Night Rehearsal" plan (`redesign/orchestrator/prompt.md` §5). The orchestrator's worker brief (prompt.md §6) gives your worktree, setup, heavy-lock path, generic rules and the frozen decisions; this prompt holds what is specific to s36.

| | |
|---|---|
| Branch | `impl/s36-outside-app` from the current `impl/redesign` tip (not `dev`); the orchestrator merges it |
| Hard deps | G2 |
| Gates | G2 approved before you start. **G4** (owner, on devices, batched after the screens lane) reviews these screens |
| Owned globs (plan table) | `apps/web/app/features/{marketing,auth,onboarding,billing,settings,system,common}/**`, `routes/{_marketing,_auth,_bare}/**`, `routes/_app/settings*`, their `en.json` keys |
| Also yours by the plan's rules | `en.json` keys in `home.*`, `how.*`, `pricing.*`, `legal.*`, `auth.*`, `start.*`, `billing.*`, `plan.*` (except `plan.allowance`, s34's), `privacy.*`, `settings.*`, `appearance.*`, `system.*`, `error.*`, `footer.*`, `delete.account_*`, and `shortcuts.single_keys` / `shortcuts.single_keys_hint` (inside their groups, never at the end); the `copy-keys.test.ts` `CATALOGUE` entries for `billing.demo`, `system.offline`, `system.unsupported` (changed) and `shortcuts.single_keys_hint` (new); the visual baselines `home--*`, `mock-checkout--*`, `settings-display--*`, `settings-privacy--*`, `account-deleted--*` |
| Needs the orchestrator's OK first | `apps/web/app/lib/appearance.ts` (labels; it reads the retired `appearance.stage`) and `apps/web/app/lib/display-store.ts` (the `stage` → `dark` rewrite on the next change, 26 §2); existing `apps/web/app/ui/` files whose layout §12.2 gives to s36: `status-message.tsx`, `step-dots.tsx`, `coach-mark.tsx`, `save-status.tsx` (+ `ui/save-status.stories.tsx`, `ui/onboarding.stories.tsx`); `apps/web/app/copy-keys.test.ts` (entries above); selector/copy lines in `apps/web/e2e/{onboarding,account,billing,fallbacks,a11y}.spec.ts` and `e2e/helpers.ts` (`signIn`, `openExample`) that the changed copy breaks |
| Effort | high |
| Runs in parallel with | s34 and s35 (screens lane), backend steps |

## Before you start
- `docs/steps/00-shared-context.md`, `CLAUDE.md`, `docs/specs/25-personal-mode.md` (§1 username + password sign-in, §2 mock billing: never a card field), `docs/specs/23-plans-free-and-paid.md` §5.
- `docs/specs/27-screens-flows-and-content.md`: §1 (marketing, auth and bare shells; route map: `/settings` → `/settings/account`, `/settings/{profile,billing,privacy}` → `/settings/account#profile|#plan|#privacy` with the query kept, new `/settings/about`), §2 (First session, Upgrade), **§3.1** (Home, honesty gates), **§3.2** (How it works, Pricing, Legal), **§3.3** (onboarding with the reading-distance step), **§3.4** (Auth), **§3.9** (Settings: Account, Display & practice, Keyboard & pedal without the wizard, About; sound delay stays as built until s42), **§3.10** (Billing), **§3.11** (system pages, banners, dialogs, toasts), §4 row Settings, §5.1–§5.5, §5.6 and every §5.7 row marked s36.
- `docs/specs/26-design-system.md` §2 (three appearance cards, D2; previews render a miniature inside `data-appearance`, never raw colours), §6.2 (display sizes: `text-3xl`…`text-display`, `text-lead`), §6.3 (Desk / Music stand / Floor presets for the onboarding sample), §7 (content widths), §11 (brand), §12.2 rows `StatusMessage`, `ChoiceCard`/`RadioCard`, `StepDots`, `CoachMark`, `SaveStatus`, `Brand`, §13.
- `docs/specs/28-ui-quality-and-design-review.md` §2, §3, §4, §5 (incl. 200 % text and 320 px reflow), §5.1.
- Mockups: `Home.dc.html`, `SignIn.dc.html`, `Onboarding.dc.html`, `Pricing.dc.html`, `Settings-Account.dc.html`, `Settings-Display.dc.html`, `Settings-Pedal.dc.html` (the Keys part; the wizard card is s43), `States.dc.html`.
- `redesign/research/product_inventory.md` §2 (Home, How it works, Pricing, Legal, Sign in, Onboarding, Mock checkout/portal, System pages), §6 (settings, billing, privacy).

## What exists (verified on `impl/redesign` at `0c3d5c3`)
- **Marketing** `features/marketing/`: `home.tsx`, `product-still.tsx`, `how-it-works.tsx`, `how-scenes.tsx`, `legal-page.tsx`, `legal-content.ts`, stories (`Screens/Home`, `pages.stories.tsx`, `how-scenes.stories.tsx`). Routes `routes/_marketing/{index,how-it-works,pricing,legal.$page}.tsx`. The marketing bar itself is `features/shell/marketing-shell.tsx` (s34's).
- **Auth** `features/auth/{auth-shell,sign-in}.tsx` (username + password, `CredentialsForm`), routes `routes/_auth/auth/{sign-in,sign-up}.tsx`.
- **Onboarding** `features/onboarding/`: `onboarding-page.tsx` (lazy `FirstSong`), `guide.tsx` (lazy `SaveSheet`), `save-sheet.tsx`, `saved-page.tsx`, `song-parts.tsx`, `defaults.ts`, guest storage and claim files.
- **Billing** `features/billing/`: `pricing-page.tsx`, `plans.tsx`, `upgrade-sheet.tsx`, `mock-checkout.tsx`, `mock-portal.tsx`, `billing-settings.tsx`, `price.ts`; route `routes/_bare/billing/$view.tsx`.
- **Settings** `features/settings/`: `settings-layout.tsx`, `profile-settings.tsx`, `privacy-settings.tsx`, `display-settings.tsx` (appearance, score surface, reading, sound delay stepper ±`MAX_SOUND_DELAY_MS` = 150 from `lib/display-store.ts`), `keyboard-settings.tsx`, `setting-row.tsx`, `use-save-state.ts`, `settings.stories.tsx` (`Screens/Settings`). Routes `routes/_app/settings.tsx` + `settings/{index,profile,billing,privacy,display,keyboard}.tsx`; no `account` or `about` route.
- **System** `features/system/`: `unsupported.tsx`, `account-deleted.tsx`, `error-page.tsx` (`NotFoundPage`, `ErrorPage`, wired in `routes/__root.tsx` lines 67–68), `system-banners.tsx`, `display-sync.tsx`. Routes `routes/_bare/{unsupported,account-deleted}.tsx`.
- **Common** `features/common/{option-segments,option-select,panel-section}.tsx`.
- `lib/appearance.ts` maps `light`/`dark`/`stage`/`system` to `appearance.*` labels, including the retired `appearance.stage`.
- **About data:** `packages/contracts/src/api/system.ts` exposes no model list; model ids live on each analysis.
- **Visual rows:** `home`, `mock-checkout`, `settings-display`, `settings-privacy`, `account-deleted` (`screens.spec.ts`).

## Goal
Home, How it works, Pricing, Legal, Sign in / Create an account, onboarding (with "Where's your screen?"), mock billing, the four-section Settings (Account · Display & practice · Keyboard & pedal · About) and every system page, banner, dialog and toast match their mockups and doc 27, in both themes, with the copy of 27 §5.6–§5.7 and nothing promised that isn't built.

## Decisions that bind this step
- **D2:** the appearance picker shows 3 theme cards (System, Night Rehearsal, Daylight); `stage` stays a valid id, not a card. A device with `stage` stored shows Night Rehearsal and its resolved distance; the next change stores `dark`.
- **D3:** the ladder default (3 clean passes) is a setting in Display & practice, built by s37, not here.
- **D6:** budget 318.7 of 320 KB gzip; these screens are outside the practice route, but report before/after bytes anyway (the entry chunk counts).
- **D1:** compare desktop boards at 1440 and 1180 only (28 §5.1); none of these boards has a phone version, so phone layouts are checked against 27 and 28 §5 (reflow, 200 %), not a mockup.
- **Wave contract with s35:** the Keys section's "Single-key shortcuts" switch binds to `singleKeys` in `features/practice/keys-store.ts`, which s35 adds. If s35 hasn't merged when you reach it, ask the orchestrator to merge `impl/redesign` into your branch after s35, or stop.

## Deliverables
1. **Home** (27 §3.1): hero with the primary badge, display headline, lead, **Try an example song** + Sign in (56), note; the inert practice still built from the real kit components with fixture data (`role="img"` and its label); What it does; Made for the music stand; How a session goes; closing CTA. **Honesty gates:** use the current wording for every claim whose step hasn't merged (s37 ladder, s40b "Every stem has its own fader.", s42 beat lights, s43 Stand view); s45 flips them. LCP stays the headline.
2. **How it works, Pricing, Legal** (27 §3.2): restyled How it works (frequency wording in the accuracy note); Pricing banner `billing.demo`, "Every practice tool is free", Free and Plus cards (Monthly/Yearly segmented with neither emphasised, price from the API, Get Plus primary), Compare table, no countdowns or "most popular", never a card field; Legal 72 ch with a table of contents.
3. **Onboarding** (27 §3.3): header Back · `StepDots` + "Step n of 5" · Skip; instrument and level cards; **Where's your screen?** with three radio cards and line drawings (Desk / Music stand / Floor), the live sample (chords at `--read-chord-sheet` × 1.6, tab at `--read-tab`) and the Reading size slider 80–140 %, applying the preset live; first song; loop coach marks that never cover the transport; the save sheet only after the first completed pass.
4. **Auth** (27 §3.4): Sign in and Create an account forms (errors under the field with an icon, Google only when configured), the showcase panel from `lg` with its inert sheet (chord, loop badge, four-rung ladder drawn from kit components), `?next=` same-origin only.
5. **Billing** (27 §3.10): upgrade sheet, mock checkout (Simulate successful payment / Simulate declined card / Cancel), mock portal and return states on the Pricing card style.
6. **Settings IA** (27 §3.9): left nav (220; a list on phones) Account · Display & practice · Keyboard & pedal · About; routes `/settings/account` (with `#profile`, `#plan`, `#privacy`) and `/settings/about`, redirects from `/settings`, `/settings/profile`, `/settings/billing`, `/settings/privacy` keeping `?checkout=` and `?confirm=`; per-field save with "Saving…" / "Saved" / "Couldn't save. Try again.".
   - **Account:** Profile (Name, Username read-only, Main instrument segmented, "How long have you played?"), Plan (Demo billing badge, allowance meter, See Plus / Plus states, checkout return messages), Privacy ("Help improve transcriptions" switch, data export states as built, Delete my account card → AlertDialog → "Confirm it's you"), Sign out.
   - **Display & practice:** three appearance cards with themed miniatures (subtree `data-appearance`), Increase contrast, Where is your screen? + Reading size card with its live sample, Hyperlegible font, Show uncertainty, Left-handed switch, Notation follows the music, Reduce motion, Practice defaults (Starting speed, Count-in, Rest between repeats; the ladder row is s37's), and today's sound-delay stepper restyled (the tap-along card is s42's). Retire the Score setting.
   - **Keyboard & pedal:** intro, a "Have a pedal? Set it up" card placeholder for the s43 wizard (no wizard logic), **Keys**: "Single-key shortcuts" switch with its hint, the action table (Action · Keys · Pedal · Learn key, rows in 12 §8 order), the dashed test area, Reset to the defaults.
   - **About:** version and build date, the transcription models and versions, font licences (Instrument Sans, JetBrains Mono, Bravura, Atkinson Hyperlegible Next, with the OFL texts), the provenance register link, the personal-mode line. Use data the web already has (a build-time list or the analyses' model ids); if neither works without an API or contract change, stop (Stop point 4).
7. **System states** (27 §3.11): unsupported (the missing feature in plain words), analysis-failed card content and keys, worker offline, offline, update ready ("It waits until you stop playing", never during playback), rough-part banner, in-app browser, iOS install hint, screen tip, playback interrupted, 404 (mono "404"), error boundary with a copyable id, delete-account dialog, toasts copy. (The song confirm and rename dialogs live in `features/library`, s34's.)
8. **Copy:** every s36 row of 27 §5.7 (appearance names and hints, retire `appearance.stage`, `settings.score*`, the handedness radio pair, `settings.profile|billing|privacy` nav keys → section headings, new `settings.account` / `settings.about`, `settings.level*`, `privacy.training_hint`, `privacy.delete_body`, `auth.showcase_*`, `home.*`, `pricing.*`, `start.*`, `billing.demo`, `system.offline`, `system.unsupported`, `system.update_ready`), with the `copy-keys.test.ts` entries updated (list each with old and new copy).
9. **Stories** for every screen and state above in both themes (keep the ids the visual matrix uses: `screens-home--signed-out`, `screens-billing--checkout`, `screens-settings--display`, `screens-settings--privacy`, `screens-system--account-was-deleted`; the privacy story may render inside Account but keeps its id), with phone and desktop variants.
10. **Visual baselines:** regenerate the `home`, `mock-checkout`, `settings-display`, `settings-privacy` and `account-deleted` rows after the fidelity check and list the intended differences.

## Out of scope
The app shell, account menu and marketing bar (s34), Practice and its Display popover (s35), the ladder default row (s37), sound-delay calibration (s42), the pedal wizard and the `shortcuts.*` copy rows of s43, flipping the honesty gates (s45), any API, contract or DB change.

## Acceptance criteria
- Fidelity (28 §5.1): `Home`, `SignIn`, `Onboarding`, `Pricing`, `Settings-Account`, `Settings-Display`, `Settings-Pedal` (Keys part) and `States` (system pages, dialogs, toasts) at 1440 and 1180, Night Rehearsal and Daylight; mismatch count per board/width/look; remaining differences inside tolerance or in 26 §4.9; at most 6 iterations without improvement.
- Structure per screen against 27 (aria snapshot); one primary per view; amber only per 26 §4.5.
- Browse targets 44; keyboard-only paths through sign-in, onboarding, settings and checkout; 200 % text and 320 px reflow on every screen; no horizontal scroll at 390.
- Redirects: `/settings/profile?checkout=success` lands on `/settings/account#plan` with the query kept (test); `/settings/about` exists.
- A stored `stage` shows Night Rehearsal selected and becomes `dark` on the next change (unit test).
- Stories for every state in both themes; axe clean in Chromium and WebKit; copy-keys test green.
- Budget before/after reported; `css-floor` clean. E2E smoke green with every renamed selector listed (pending the OK above).

### Commands (prefix each with `cd "<worktree>" &&`)
```bash
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget                  # before, then after
pnpm exec biome check . && node scripts/check-db-access.mjs && node scripts/check-ui-tokens.mjs
pnpm --filter @splitune/web typecheck && pnpm --filter @splitune/web test
pnpm --filter @splitune/web test:stories                                                  # heavy lock
pnpm --filter @splitune/web build && pnpm --filter @splitune/web budget --enforce && pnpm --filter @splitune/web css-floor
node scripts/redesign/render-mockups.mjs --file Home --file SignIn --file Onboarding --file Pricing --file Settings-Account --file Settings-Display --file Settings-Pedal --file States
node scripts/redesign/probe.mjs Settings-Display --look daylight --width 1180 --select '<anchor>'
pnpm --filter @splitune/web e2e:visual:update -g "home @|mock-checkout @|settings-display @|settings-privacy @|account-deleted @"   # heavy lock, Docker
cd apps/web && E2E_SMOKE=1 UV_PROJECT_ENVIRONMENT=<shared ML venv from your brief> UV_NO_SYNC=1 pnpm exec playwright test         # heavy lock
```
Known pre-existing failures: WebKit practice/audio stories timing out at 15 s (the onboarding `Guide` stories play audio); first `test:stories` run failing in Vite optimisation (rerun once).

## Stop points (stop, report with 2–3 options and a recommendation, wait)
1. 27 §3.x, a mockup and the code disagree (for example a mockup control with no behaviour in the specs).
2. The budget would exceed 320 KB.
3. You need a file outside the owned globs and the OK'd extras (the shell, `features/practice`, `features/library`, another step's `ui/` file).
4. An API, contract or DB change (About's model list, a new settings field on the account).
5. Any copy that 27 doesn't give, or a claim that would promise an unbuilt feature.

## Git
- Branch `impl/s36-outside-app`; subject-only Conventional Commits (for example `feat(settings): group settings into account, display, keyboard and about so each answers one question`); stage exact paths; gitleaks before each commit.
- Never push, merge, rebase onto `dev` or open a PR. No edits to `docs/status.md`, `docs/progress-log.md`, `docs/steps/README.md`; progress-log entry in your report.
