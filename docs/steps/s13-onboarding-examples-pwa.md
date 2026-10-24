# Step 13 — First-session onboarding, example songs and PWA

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/specs/13-import-onboarding-and-youtube-embed.md` §1, §5 (onboarding, library rules)
- `docs/specs/10-web-app-architecture.md` §6 (PWA/offline)
- `docs/specs/25-personal-mode.md` (example songs may come from the owner's library)
- `docs/specs/27-screens-flows-and-content.md` §3.3 (onboarding screens incl. the "Where's your screen?" distance step), §5 (voice, motivation rules)
- Research: `docs/research/ux/onboarding-retention-motivation.md`, `docs/research/users/user-journeys-and-flows.md` (Journey 2)

Prerequisites: Steps 09, 10a, 12.

## Goal
A new visitor reaches a slowed loop of an isolated part within 5 minutes without signing up, using precomputed example songs; progress made before sign-up is kept; the app installs as a PWA.

## Deliverables
1. **Example songs pipeline:** a script `pnpm examples:build <audio files…>` that runs the full analysis for 3–5 songs chosen by the owner (guitar rhythm, guitar riff, bass line), stores artefacts under `assets/examples/<id>/` in the bucket (system user; R2 `splitune-media` in production, SeaweedFS locally), and writes an `examples.json` manifest (title, instrument, suggested loop bars, starting speed). Commit only the manifest, never audio.
2. **Onboarding flow** `/start` (screens and copy per doc 27 §3.3, including the skippable "Where's your screen?" distance step that sets the display preset; progress dots with "Step n of 5"; coach marks max 2, never blocking the transport; the save sheet appears only after a completed pass, never mid-pass): instrument → level → example song auto-selected → tap to hear the isolated part → suggested 2–4-bar loop at 70% (just started) / 80% (few songs) → optional self-assessment → "Save your progress" sign-in prompt → next: import your own song.
3. **Pre-signup progress** in IndexedDB (loops, attempts, settings), merged into the account on first sign-in (idempotent by client ids).
4. **Defaults by instrument/level:** view, level toggle, mixer preset, starting speed.
5. **PWA:** Serwist via its Vite integration — manifest (theme colours from tokens), icons (the app icon set from step 10a), app-shell precache, runtime caching for fonts/WASM/alphaTab, network-first API; install prompt hint on iOS ("Add to Home Screen"); `navigator.storage.persist()` request after install.
6. **Service-worker update banner** (doc 27 §3.11 "A new version is ready"), deferred while audio is playing.
7. **Analytics events** for the funnel (`onboarding_step_viewed`, `first_isolated_playback`, `first_loop_reduced_speed`) using the typed `track()` from `packages/analytics` (create a minimal version writing to `analytics_events` if step 15 hasn't run yet).

## Acceptance criteria
- Playwright (3 engines, mobile viewport): fresh browser → `/start` → reaches a looping slowed phrase with no sign-in in under 10 scripted steps; time-to-first-loop measured and logged.
- Sign-in after onboarding keeps the loop and attempts.
- Design QA checklist (doc 28 §5) passed for every `/start` step and the save sheet on phone and tablet, Light and Dark.
- Lighthouse PWA checks pass; the app shell loads offline after first visit; cached example song practice works offline in Chrome (state results for Safari if tested).

## Verification to run and report
`pnpm examples:build` output (with the owner's chosen files), `pnpm --filter web e2e -- --grep onboarding`, Lighthouse PWA report, offline test notes.
