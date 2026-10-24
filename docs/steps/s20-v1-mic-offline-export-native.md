# Step 20 — v1 mic scoring + tuner, offline, export, lyrics, native sideload

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/specs/21-v1-features.md` V7, V10, V11 (+ callout)
- `docs/specs/22-native-apps.md` (personal-mode callout: PWA + free sideload only)
- `docs/specs/08-evaluation-harness-and-prototypes.md` P5 (mic latency/accuracy gate)
- `docs/specs/24-browser-compatibility.md` §4 (iOS mic crackle bug and mitigations)
- `docs/specs/23-plans-free-and-paid.md` §3 (tuner Free; mic scoring, offline, export Plus)
- Research: `docs/research/ux/practice-tool-patterns.md` Pattern 9, `docs/research/ml/transcription-vocals-melody.md`
- `docs/specs/26-design-system.md`, `specs/27-screens-flows-and-content.md` §5, `specs/28-ui-quality-and-design-review.md` §5 — tuner, scoring feedback (verdicts always overridable, no red/green-only cues), offline and export UI: compose from the kit, add stories for new states, use catalogue copy (add keys), pass the design QA checklist

Prerequisites: MVP (steps 01–17); prompt 18 recommended. Branch `impl/20-…` from the current `dev`; split into sub-tasks/branches if large — each sub-task is independently shippable behind a flag. Read `docs/progress-log.md` 17c–18a first: piano now has a roll, a grand staff (alphaTex, two staves, hands) and chord voicings, so exports and offline must cover piano too. **The owner doesn't play an instrument:** measurements that need playing (P5 accuracy, scoring) use recorded reference audio (GuitarSet, public vocal/bass datasets, recorded scales) played through a speaker into each device's mic, plus the owner's voice only if they agree.

## Goal
Close the v1 roadmap: hear-and-check feedback through the microphone (constrained, with override), a tuner, offline practice, exports, lyrics, and optional native builds on the owner's own devices.

## Deliverables
1. **P5 first:** SwiftF0 (ONNX, ORT Web single-threaded WASM SIMD or WebGPU) and a low-floor tracker for bass (CREPE-tiny or pYIN-style, floor ≤30 Hz) measured on the owner's iPhone/iPad and Mac browsers: mic-to-display latency, RPA on sung scales/guitar/bass open strings, CPU. Report; continue only if latency <50 ms and RPA ≥90% (else ship tuner + record-and-compare only and say so).
2. **Tuner (Free):** chromatic, bass-capable floor, cents display with non-colour cues (needle + numeric cents + "in tune" text), readable at the Stand preset.
3. **Mic scoring (Plus, V7):** calibration step (tap/clap latency), headphones prompt, Bluetooth warning, single-note scoring and chord-level scoring for strums, tolerance ±50 ms scaled at slower tempos, "I played it right" override logged, never blocks progress, verdicts shown as calm informational feedback (no red/green-only marks, no scores as rewards — doc 27 §5.5); `practice_attempts.score` filled. iOS mitigations for WebKit bug 326286 (48 kHz context recreated after `getUserMedia`, echo cancellation off).
4. **Offline (Plus, V10):** "Make available offline" (song overflow menu + practice ⋯ menu; badge "Saved offline"; add `offline.*` catalogue keys for saving, quota exceeded and removal) stores stems in OPFS + artefacts in IndexedDB, quota handling, `persist()`, purge on server deletion at next sync, offline edits queued.
5. **Export (Plus, V11):** MusicXML from music-core (effective view: guitar/bass tab, piano two staves with hands, drums percussion if step 19 shipped them), Guitar Pro via alphaTab exporter if available in 1.8.x, PDF via print layout; footer "auto-transcribed, for personal practice"; every export logged (analytics event).
6. **Lyrics (optional):** Whisper on the vocal stem (faster-whisper CPU or an MLX port) → word timings → lyrics lane under the f0/notes, editable.
7. **Native sideload (optional):** Capacitor 8/9 project `apps/native` consuming the web build; plugins `MicPitch` (AVAudioEngine + SwiftF0 via ONNX Runtime/Core ML), `Midi` (CoreMIDI), `AudioSession`; install on the owner's iPhone/iPad with free Xcode provisioning (7-day re-sign) and an Android APK. No store submission, no IAP.

## Acceptance criteria
- P5 report with numbers per device; mic features gated on its result.
- Override rate tracked; scoring E2E with recorded audio fixtures (fake mic stream in Playwright/Chromium).
- Offline: airplane-mode practice of a downloaded song works in Chrome and Safari (state what was tested).
- Exports open in MuseScore/Guitar Pro (manual check noted); drum MusicXML percussion round-trips with the GM mapping if drums exist.
- Practice route budget passes (`pnpm --filter @splitune/web budget --enforce`, before/after bytes); mic, tuner, offline and export code loads on demand.
- Flags default off, then on after verification; each feature names its success metric (doc 16; V7 override rate <5% before widening); `docs/progress-log.md` updated.

## Verification to run and report
P5 report, relevant test suites, the budget check, offline manual test notes, export validation, native build/install notes if done.
