---
title: v1 feature implementation notes (V1–V13)
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# v1 feature implementation notes

Technical notes for the v1 tier in `product/feature-roadmap-beginner-to-intermediate.md` (V1–V13). Native apps (V14) are in `22-native-apps.md`. Each entry lists the start gate, the components it touches and the acceptance check. Sequencing is in `20-delivery-plan.md` Phase 3.

> **Personal mode is current (`25-personal-mode.md`).** Gates tied to counsel or licences disappear: V3 sections, V4 piano (Transkun or Aria-AMT), V10 offline and V11 export start whenever the code is ready. **V6 drums uses pretrained ADTOF** instead of training an in-house CRNN. V7 mic scoring still waits for P5 (it's a quality gate, not a legal one). V14 native = PWA plus optional free sideloaded Capacitor builds (`22-native-apps.md`).

## TL;DR
- **No new architecture is needed for v1.** Everything plugs into the MVP's contracts (`05-analysis-schema.md`), `music-core` (`07-music-algorithms.md`), the audio engine (`11-audio-engine.md`) and the pipeline stage graph (`06-ml-pipeline-service.md`).
- **Three features are gated by counsel or measurement, not code:** sections (All-In-One amber), piano (Transkun amber + P2 piano result), mic scoring (P5 + a 50-learner, 3-phone accuracy study).
- **Drums need a training project:** a 5-class CRNN trained only on CC-BY data (E-GMD, Groove MIDI, Slakh) plus owned recordings, because ADTOF is red.
- **Every v1 feature ships behind a flag** with its own metric (`16-observability-analytics-experiments.md`).

## V1. Speed trainer (manual)
- **Model:** `{start_pct, end_pct, step_pct, plays_per_step, count_in_each_pass}` stored on the loop clip (`loop_clips.trainer` JSON, `03-data-model-and-storage.md`).
- **Engine:** the loop scheduler (`11-audio-engine.md`) emits `loopWrapped(passIndex)`; the trainer advances tempo at pass boundaries and re-schedules the count-in at the *upcoming* tempo (Soundslice behaviour).
- **UI:** shows % and BPM; BPM entry; progress "pass 3/4 at 70%".
- **Accept:** tempo changes exactly at the loop seam; no audible glitch; trainer state survives reload.

## V2. Transpose and capo suggestions
- **Audio:** Signalsmith `setTransposeSemitones` on the single stretch node (Option C), with a tonality limit for vocals; ±12 semitones UI range with a warning beyond ±3 on vocal stems (artefacts; QX13).
- **Display:** `music-core/transpose` for chord labels and note pitches; "playback key" vs "shapes key/capo" as separate controls (Pattern 4); capo suggestion algorithm in `07-music-algorithms.md` §7.
- **Accept:** chords and tab stay consistent with what is heard; "sounds like original key" confirmation when only the capo changes.

## V3. Section navigation
- **Gate:** counsel sign-off on `allin1` (MIT code, unstated weights, Harmonix training) or a green substitute.
- **Pipeline:** `sections` stage on demixed stems (already in the stage graph; enabled by config). Fallback: novelty-based segmentation from chord/beat self-similarity in `music-core` (unsupervised, green) labelled "Part A/B/C".
- **UI:** section chips above the timeline; tap → loop preset; labels editable (`set_section` op).
- **Accept:** boundaries snap to downbeats; edits persist.

## V4. Piano notes, hand split, falling-notes roll
- **Gate:** Transkun sign-off (MAESTRO NC data; weights licence unstated) **and** P2 piano onset F1 ≥0.80 in band mixes, or ship solo-piano path only.
- **Pipeline:** solo-piano detection (tagger: piano present, others absent) → skip separation; else piano stem. Transkun V2 → `notes.piano`; PM2S (MIT) for hand/staff → `tab.piano.hand`.
- **Client:** custom canvas/WebGL roll with adjacent keyboard strip (P.I.A.N.O. evidence: keep the roll aligned to the keys); optional staff view via alphaTab standard notation from MusicXML export.
- **Accept:** roll stays within one frame of the master clock at 60 fps on a mid-range tablet; hands colour-coded **and** labelled L/R.

## V5. Piano wait mode via MIDI/USB
- **Input:** Web MIDI works in Chromium and Firefox desktop but **not in Safari or any iOS browser** (MDN BCD, Oct 2026). iPad pianists therefore need the native app (CoreMIDI via a Capacitor plugin, `22-native-apps.md`); the web build offers wait mode only on desktop/Android Chrome.
- **Logic:** pause the transport at each chord/note event until the expected pitch set is held (allow octave-insensitive mode for beginners); hands-separate practice mutes the other hand's notes.
- **Accept:** zero false advances in a 100-event scripted MIDI test; latency from key press to advance <30 ms.

## V6. Drums: 5-class transcription and drum grid
- **Model project (owned by ML):**
  1. Data: E-GMD (CC-BY-4.0), Groove MIDI (CC-BY-4.0; SA conflict noted), Slakh (CC-BY-4.0) + owned e-kit-MIDI recordings; augmentation by mixing with separated non-drum stems.
  2. Architecture: CRNN on log-mel of the separated drum stem, 5 outputs (kick/snare/hi-hat/toms/cymbals), peak picking; train with PyTorch, export to ONNX.
  3. Gate: owned real-music test set F-measure ≥0.75 (MDB/ENST are NC → evaluation only).
  4. Register entry `inhouse-drums-crnn` tier green only if every training source is commercial-OK.
- **Display:** drum grid with lane names and kit legend; cymbal/hi-hat choices dashed as "approximate".
- **Accept:** GM mapping round-trips to MusicXML percussion and alphaTab drum tab.

## V7. Constrained mic listen-and-score + tuner
- **Gate:** P5 pass (latency <50 ms, RPA ≥90% voice/guitar, bass E1 tracked) and QX1 study shows acceptable false-negative rate.
- **Client pipeline:** `getUserMedia` (echoCancellation/noiseSuppression/autoGainControl **off**) → AudioWorklet ring buffer → Worker running SwiftF0 (MIT) via ONNX Runtime Web **single-threaded WASM SIMD or WebGPU** (the practice page is not cross-origin isolated, so no WASM threads; see `10-web-app-architecture.md`) for voice/guitar; CREPE-tiny or pYIN-style tracker with floor ≤30 Hz for bass.
- **iOS caveat:** WebKit bug 326286 reports crackling playback on iOS 26.2–27 while a mic stream with echo cancellation is open. Mitigation: run the AudioContext at 48 kHz, recreate it after the first `getUserMedia`, keep echo cancellation off, and plan native capture via a Capacitor plugin for the iOS app (`22-native-apps.md`).
- **Scoring:** single-note lines note-by-note; strummed guitar at chord level (root + quality from chroma); tolerance ±50 ms at 100% tempo, scaled by beat length at slower tempos; latency offset from a calibration tap/clap test, re-run on audio route change.
- **UX rules (D12):** calibration step; headphones prompt; Bluetooth warning; "I played it right" override logs a detector error; never block progress; self-assessment stays available.
- **Accept:** override rate <5% in the flagged cohort before widening scope.

## V8. Record-and-compare
- MediaRecorder (Opus) of the learner's take during a loop pass, aligned by the recorded output latency; playback alternates "reference stem" / "my take" or plays both panned L/R.
- Takes stay on-device by default; uploading is opt-in (they are the user's own performance, Design E).

## V9. Visual and haptic metronome
- Visual pulse on the beat with flash limits (WCAG 2.3.1: ≤3 flashes/s); downbeat accent by shape, not colour only.
- Haptics: `navigator.vibrate` where supported (not iOS Safari); native haptics in v1 apps.

## V10. Offline practice
- **Gate:** counsel on retention/portable copies (D7).
- Service worker + OPFS store per song: stems (Opus/AAC), artefacts, alphaTex; encrypted-at-rest not required by law but keys stay per user; expiry when the server copy expires or the user deletes the song (delete cascade must also clear local caches on next sync).
- Practice logs and corrections queue offline and sync with idempotency keys.

## V11. Export (MusicXML, Guitar Pro, PDF)
- **Gate:** counsel (export is "moderate exposure").
- `music-core/export/musicxml.ts` on the effective view; Guitar Pro via alphaTab exporter if available in the pinned version; PDF via alphaTab print layout in a headless browser job or client print.
- Every export carries an "auto-transcribed, for personal practice" footer and is logged.

## V12. Alternative fingerings, tuning and capo input
- UI exposes `alt_fingerings[]` per note (tap → cycle), global "easiest / as played" switch, tuning presets (standard, half-step down, drop-D, full-step down; bass 4/5-string) and capo.
- All recompute client-side in the `music-core` Worker.

## V13. Richer level adaptation
- Piano: right-hand melody only; left-hand block chords from chord labels; rhythm simplified to quarter/half notes.
- Drums: "core groove" = kick + snare + hi-hat on the main pattern, fills removed (detect fills as bars whose pattern differs from the bar-pattern mode).
- Rules live in `music-core/level/` with golden tests per level.

## Implementation notes (step 18, piano notes, 2026-10-23)
- **Transcriber:** `notes.piano` = **Transkun V2** (`transkun` 2.0.1 package code, weights `pretrained/2.0.pt` + `2.0.conf` extracted from its PyPI wheel by `scripts/fetch_models.py transkun`, register `transkun-v2`, tier amber) on the BS-Roformer-SW piano stem, torch island on MPS. Chosen by P2 (`08` step-18 notes): stem onset F1 0.946 on MAESTRO test excerpts in a band vs YourMT3+ 0.900 and Basic Pitch 0.645. No per-note score: every note gets the calibrated precision (0.918). YourMT3+ knows piano now (`PROGRAMS` 0–7) but is not the default. Solo-piano detection (skip separation) was not built: separation always runs.
- **Gate:** `views.yaml` `notation_supported` + `quality_gate: piano: pass`; default view `roll`. Caveat: tracks with electric piano, clavinet or harpsichord score ~0.68 (both models), below the 0.80 line; nothing in the pipeline tells them apart yet, so the Chart stays one switch away.
- **Hand split (music-core `splitHands`):** Viterbi over onset groups and every split pitch, trading each hand's reach (span beyond an octave, more than five notes), split movement (cheaper with time between groups) and a mild pull to middle C. Heuristic stand-in for PM2S; 32 ms with quantization for a dense 4-minute part (3,360 notes). `buildPianoScore` = corrections → quantize (the shared 1/16 / swing grid) → one sounding note per key → hands; runs in the music Worker. No `tab.piano` artefact is written: the client derives everything from `notes.piano`.
- **Client:** the falling-notes roll was built first (owner's choice over the grand staff, 2026-10-23); see `26`/`27` step-18 notes. It reads `audio.position()` every frame (one clock, 12 §3). The grand staff (alphaTex, two staves from the same hands and ticks) is not built.
- **Not verified:** "within one frame at 60 fps on a mid-range tablet" (checked on the Mac in Chromium only).

## Open questions
- Web MIDI availability on iOS Safari (affects V5 on iPad before native).
- Whether V8 should move into MVP as a mic-free stand-in for scoring (roadmap open question).
- Drum training compute budget and whether owned e-kit recordings are enough to close the E-GMD domain gap (QM15).

## Sources
Cross-linked research: `product/feature-roadmap-beginner-to-intermediate.md` (V1–V14), `ux/practice-tool-patterns.md` (Patterns 2, 4, 8, 9), `ml/transcription-piano.md`, `ml/transcription-drums.md`, `ml/transcription-vocals-melody.md`, `ml/chords-beats-key-structure.md`, `ux/music-display-ui.md`, `ux/accessibility.md`, `product/recommendations-and-decisions.md` (D3, D4, D7, D12).
