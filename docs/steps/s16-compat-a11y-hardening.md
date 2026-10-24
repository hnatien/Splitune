# Step 16 — Browser compatibility, accessibility and test hardening (MVP gate)

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/specs/24-browser-compatibility.md` (primary: support tiers, floor, fallbacks, known issues, test matrix, release gate)
- `docs/specs/18-testing-strategy.md` (layers, release gates)
- `docs/specs/17-security.md` (headers, authz, sandboxing — security pass)
- `docs/specs/28-ui-quality-and-design-review.md` §3–§5 (automated design checks, visual regression, design QA checklist — keep them green while fixing)
- Research: `docs/research/ux/accessibility.md`

Prerequisites: Steps 10–15 and 15a (this is the MVP quality gate).

## Goal
Prove the MVP works across every Tier 1 browser with documented fallbacks, meets WCAG 2.2 AA on the core flows, and has the regression safety net later steps rely on.

## Deliverables
1. **Fallback audit:** for every row of doc 24 §3, a test or a documented manual check that the primary and fallback paths both work (force fallbacks via flags/mocks: no WebCodecs, Opus decode failing, no `outputLatency`, no Wake Lock, no Web MIDI). Fix gaps.
2. **Playwright matrix:** projects `chromium`, `firefox`, `webkit` × desktop + mobile/tablet viewports; full E2E suite (onboarding, import file/URL with mocks, practice loop at 70% with count-in, edit + persistence, billing mock flow, delete song, account deletion) runs nightly; a smoke subset on every PR.
3. **Real-device checklist** (owner's devices): iOS Safari (iPhone/iPad), macOS Safari + Chrome, Android Chrome (+ Samsung Internet if available), Firefox desktop — loop seam, 0.5× quality, count-in timing, Bluetooth offset slider, interruptions (call/Siri), pedal keys if a page turner is available, PWA install. Record results in `docs/progress-log.md` with device/OS/browser versions.
4. **Floor check:** run the smoke suite against the oldest engines available to you (or document the gap); the unsupported-browser page renders on a browser without AudioWorklet; tokens and appearances render correctly at the CSS floor (Safari 16.4: `oklch()`/`color-mix()` only, no `light-dark()` or relative colour syntax — doc 26 §3).
5. **Accessibility pass:** axe in Storybook and Playwright (fail on serious/critical) in Light, Dark and Stage, increased contrast and Windows forced-colours emulation, keyboard/pedal-only E2E for the practice loop, reduced-motion behaviour, 200% text zoom on library/practice, VoiceOver spot check on iOS/macOS; fix findings.
6. **Security pass:** CSP enforced (report-only first, then enforce), headers verified, authz matrix green for every procedure, ffmpeg/yt-dlp run with timeouts and size caps under a low-privilege user, dependency audit (`pnpm audit`, `pip-audit`) with critical issues fixed.
7. **Performance:** practice route bundle budget enforced; music-core timing measured in a mobile browser; no long tasks >50 ms during playback on desktop Chrome (trace).

## Acceptance criteria
- All Tier 1 automated suites green; real-device checklist complete for the devices available, with any failures either fixed or logged as known issues with severity.
- No serious/critical axe violations on the core flows.
- Token tests, Storybook story tests and the visual-regression suite from step 15a still green after the fixes (update baselines only for intended changes).
- Release gate from doc 24 §6 / doc 18 §7 satisfied (minus items that need devices you don't own — list them).

## Verification to run and report
Full Playwright matrix summary, device table, axe summary, CSP/headers check output, audit outputs, performance trace notes.
