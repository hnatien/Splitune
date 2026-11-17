# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Time-poor hobbyists learning an instrument who want to play songs, not finish a curriculum. They practise in 15–30 minute sessions at home, with the instrument in their hands and a phone, tablet or laptop on a stand or desk, so they cannot tap precisely and often read from a distance.

In priority order (`docs/research/users/personas.md`):

1. **Adult beginner guitarist** learning covers. Knows a few open chords, reads tab slowly, cannot hear single parts in a mix.
2. **Self-taught bassist** learning the actual bass line for a band. Cannot hear the bass in the mix and distrusts online tabs.
3. **Returning pianist** (lapsed intermediate) who wants real arrangements of songs they chose, at a tempo their hands can manage.

Drummers, teens and singers are later, lower-evidence audiences.

Today the only user is the owner: the app runs in personal mode (`docs/specs/25-personal-mode.md`). The personas still set the bar for every design decision.

## Product Purpose

Splitune turns any song the learner chooses into a practice-ready lesson for their instrument. The learner adds a song (file, recording or link); Splitune isolates their part, works out what is played (beats, chords, guitar and bass tab, piano, drums) and wraps it in practice tools: bar-snapped loops, slow-down, count-in, a stem mixer, confidence-aware notation and pedal control.

The job: "learn my part of this song, at a pace I can manage", in one place instead of four to six stitched-together tools.

Success is the learner playing their part cleanly at a higher speed than last time. The honest measure is the first clean pass of the next session.

## Positioning

Other products do one step each: stems, auto-tabs, practice players or fixed curricula. Splitune takes a performance the learner chose, isolates their part, gives notation that says how sure it is, and builds the practice loop around it. Trust is the difference: users' strongest complaints about neighbours are wrong tabs, muddy stems and surprise billing, not missing features (`docs/research/users/voice-of-customer-pain-points.md`).

## Operating Context

- **Main surface:** `apps/web`, a TanStack Start PWA. `apps/listening` is a localhost-only rating tool for listening tests, not part of the product.
- **Core flow:** Add song → analysis runs in named stages while the learner can already loop and slow the full mix → Practice (notation, loop, speed, mixer) → Library shows progress.
- **Practice setting:** hands busy; device on a music stand, desk or floor. Every practice action works from the keyboard or a page-turner pedal. Stand view is the tablet layout.
- **Practice unit:** a bounded, bar-snapped loop with self-assessed passes (Felt clean / Not yet) and a speed ladder that steps up after clean passes.
- **Processing:** analysis runs on the owner's own machine. When it is off, new songs wait in a queue and say so; already-analysed songs still work.
- **Docs:** `docs/specs/` 00–28 are the build specs; 25 (personal mode) overrides the rest. `docs/status.md` says what is built.

## Capabilities and Constraints

- **Built:** add by file, recording or URL; stem separation; beats, chords and key; guitar and bass tab and Notes view; piano notes, roll and grand staff; vocal Melody view; practice screen with loops, clips, speed ladder, count-in and mixer; example songs; mock billing with Free and Plus.
- **In progress or not started** (`docs/status.md`): drums end to end, sections, keeping all stems, mic scoring, offline, export, native apps.
- **Personal mode:** Railway Hobby (`app` + Postgres), Cloudflare R2 free tier, workers on the owner's machine, mock billing, no copyright gating. No billable resource is created without the owner's say. URL import exists only in this mode.
- **Billing is simulated.** Prices and caps ($9.99/month, 15 Full analyses, 5 Lite) are untested starting hypotheses. No card fields are ever rendered.
- **Browsers:** tier 1 per `docs/specs/24-browser-compatibility.md`; feature-detect; no cross-origin isolation.
- **Terminology** is fixed in `docs/specs/27-screens-flows-and-content.md` §5.2: Song, Add song, Part, Stem, Band, Mix, Loop, Clip, Section, Pass, clean pass, Speed, Speed ladder, Analysis, Auto-transcribed, Sure / Probably / Unsure, Fix, Stand view, Pedal.
- **Undecided:** whether Splitune ever goes public or commercial (`25` §8 lists what that would re-enable); the default theme for Practice and Stand view, pending the owner's music-stand reading test.

## Brand Commitments

- **Name:** "Splitune" in copy; the wordmark is lowercase "splitune".
- **Identity:** the "Night Rehearsal" design system in two themes, Night Rehearsal and Daylight. Amber means "now". `docs/specs/26`–`28` are the visual authority; tokens come from `@splitune/ui-tokens` and components from `apps/web/app/ui`.
- **Voice:** a calm coach who knows music. Plain words, short sentences, real numbers. Uncertainty is given as a frequency ("about 1 in 3"), never a percentage. No streaks, guilt, hype, emoji or loss-framed messages. Errors say what happened, what it means and what the learner can do.
- **Honest machine output:** notation is "Auto-transcribed", looks like a draft where it is unsure, and is one tap from a fix.
- **Fair plans:** practice basics (loop, slow-down, count-in, mixer, notation) are never paywalled. Caps are published, failed analyses never use them, and nothing given to Free is taken back.
- **Imagery:** no stock photos or people. The product, the waveform and the notation are the imagery.

## Evidence on Hand

- **Research:** `docs/research/` (users, market, UX, ML, legal; 2026-10-20) and `redesign/report.md` with `redesign/research/`.
- **Mockups:** 25 screens in `redesign/mockups/` with `splitune.css`.
- **Model evaluations:** prototype and gate results in `services/ml/eval/results/`.
- **Example songs:** MUSDB18-HQ excerpts listed in `apps/api/examples.json`.
- **Absent, never to be invented:** customers, testimonials, press, user counts, usability-test results (the usability round and real-device checks are still open), validated pricing, and any accuracy claim beyond the measured eval numbers.

## Product Principles

1. **The learner's song, the learner's part.** Everything starts from a song they chose and the instrument they play.
2. **Honest over impressive.** Say how sure the transcription is, in plain numbers, and make fixing it easy.
3. **Hands are busy.** Design for an instrument in hand and a screen at a distance: large targets, keys and pedal for every practice action.
4. **The loop is the centre.** A short, bar-snapped loop practised to a clean pass matters more than any feature around it.
5. **Calm coach.** Show evidence of competence; never pressure, streaks or guilt.

## Accessibility & Inclusion

- WCAG 2.2 AA is the floor, in both themes and at increased contrast.
- Meaning is never carried by colour alone; confidence always has a second cue and words.
- Every practice action is operable by keyboard and pedal; no action requires a drag.
- Main practice controls are 64 px, other controls at least 44 px.
- Reduced motion is respected; nothing flashes more than 3 times a second.
- Reading sizes follow the viewing distance (Desk, Music stand, Floor).
