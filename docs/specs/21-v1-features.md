---
title: v1 feature implementation notes (V1–V13)
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# v1 feature implementation notes

Technical notes for the v1 tier in `research/product/feature-roadmap-beginner-to-intermediate.md` (V1–V13). Native apps (V14) are in `22-native-apps.md`. Each entry lists the start gate, the components it touches and the acceptance check. Sequencing is in `20-delivery-plan.md` Phase 3.

**Redesign (step s31a, 2026-11-08).** The "Night Rehearsal" redesign (`redesign/report.md`, steps s32–s45 in `docs/steps/`) builds V1, V3 and V9 and gives V5, V10, V11 and V12 their place in the new screens. Each entry below has a **UI (redesign)** line naming the screen (`27-screens-flows-and-content.md`), the components (`26-design-system.md` §12.2) and the step. New scope that is not a V-feature is listed at the end.

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
- **UI (redesign, s37):** the **Speed ladder** card in the Loop tab (`27` §3.7.4, `redesign/mockups/Main.dc.html`): switch, rungs from start to goal (done / current / upcoming), the summary line "Up 5 % after 3 clean passes…" (3 is the default, owner decision D3, G1; a setting), chips Start, Goal, Step, clean passes and More (back down after n misses, count-in before each pass, at the goal keep looping or stop); the dock's speed readout shows the goal ("72 BPM · → 100"); the loop badge "pass 2 of 3 at 75 %"; Settings → Display & practice holds the default for new loops; the phone Tools sheet has the switch. Defaults per `12` §5 (report: an adjustable default, not science). The backend exists behind flag `v1.speed_trainer` (contract `SpeedTrainer` on the loop clip, `loop_clips.trainer`); s37 turns the flag on, reinterprets `plays_per_step` as clean passes per step after confirming no stored clip has a trainer (the flag has been off), and extends the contract with the miss rule and the end action (`drop_after_misses`, `on_goal`; `12` §5). Clip rename (PATCH) and delete (DELETE) ship with it.

## V2. Transpose and capo suggestions
- **Audio:** Signalsmith `setTransposeSemitones` on the single stretch node (Option C), with a tonality limit for vocals; ±12 semitones UI range with a warning beyond ±3 on vocal stems (artefacts; QX13).
- **Display:** `music-core/transpose` for chord labels and note pitches; "playback key" vs "shapes key/capo" as separate controls (Pattern 4); capo suggestion algorithm in `07-music-algorithms.md` §7.
- **Accept:** chords and tab stay consistent with what is heard; "sounds like original key" confirmation when only the capo changes.

## V3. Section navigation
- **Gate:** counsel sign-off on `allin1` (MIT code, unstated weights, Harmonix training) or a green substitute.
- **Pipeline:** `sections` stage on demixed stems (already in the stage graph; enabled by config). Fallback: novelty-based segmentation from chord/beat self-similarity in `music-core` (unsupervised, green) labelled "Part A/B/C".
- **UI:** section chips above the timeline; tap → loop preset; labels editable (`set_section` op).
- **Accept:** boundaries snap to downbeats; edits persist.
- **State (2026-11-08):** section contracts exist (`set_section` op, section labels), but the ML stage `stage_sections` is an empty stub and isn't scheduled, so no song has sections yet.
- **UI (redesign):** s41a builds `stage_sections` (the s18 plan: allin1 in a legacy island plus a `music-core` novelty fallback named "Part A/B/C") and schedules it (owner gate G3); s41b adds the **section chips** in the song map (`27` §3.7.1): flex-grown by bar count, tap loops exactly that section, the current one in the amber wash, rename through `set_section`; the Loop tab's heading badge names the section; ⌘K "Loop the next chorus". No chips are drawn until a song has sections; while analysing, "Sections appear when the chords are ready" shows only when the stage is scheduled.

## V4. Piano notes, hand split, falling-notes roll
- **Gate:** Transkun sign-off (MAESTRO NC data; weights licence unstated) **and** P2 piano onset F1 ≥0.80 in band mixes, or ship solo-piano path only.
- **Pipeline:** solo-piano detection (tagger: piano present, others absent) → skip separation; else piano stem. Transkun V2 → `notes.piano`; PM2S (MIT) for hand/staff → `tab.piano.hand`.
- **Client:** custom canvas/WebGL roll with adjacent keyboard strip (P.I.A.N.O. evidence: keep the roll aligned to the keys); optional staff view via alphaTab standard notation from MusicXML export.
- **Accept:** roll stays within one frame of the master clock at 60 fps on a mid-range tablet; hands colour-coded **and** labelled L/R.

## V5. Piano wait mode via MIDI/USB
- **Input:** Web MIDI works in Chromium and Firefox desktop but **not in Safari or any iOS browser** (MDN BCD, Oct 2026). iPad pianists therefore need the native app (CoreMIDI via a Capacitor plugin, `22-native-apps.md`); the web build offers wait mode only on desktop/Android Chrome.
- **Logic:** pause the transport at each chord/note event until the expected pitch set is held (allow octave-insensitive mode for beginners); hands-separate practice mutes the other hand's notes.
- **Accept:** zero false advances in a 100-event scripted MIDI test; latency from key press to advance <30 ms.
- **UI (redesign, later than s45):** a **Wait for me** button with a "MIDI keyboard" badge in the piano transport dock (`redesign/mockups/Practice-Piano.dc.html`), shown only where Web MIDI exists (feature detection). Not in steps s32–s45; the slot is reserved.

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
- **UI (redesign, s42):** `BeatPulse` in the Now column, phone glance, Stand view and drum grid header (`26` §10, §12.2): one dot per beat of the bar, the downbeat square and the others round, the current beat filled amber with a glow, done beats faint, upcoming outlined; dot sizes 14 / 20 / 22 / 26 px; the dot changes shape and fill in a small area instead of flashing; above 3 beats a second (> 180 BPM, or subdivisions) only the downbeat is marked; reduced motion shows a static "Beat 3 of 4". **Vibrate on beat** is a tile in the phone Tools sheet, off by default, on the same schedule. A unit test checks the pulse schedule at high tempos (`28` §3). s42 also ships the **sound delay** calibration ("Tap along with 8 clicks…", a range wide enough for Bluetooth: −150 to +500 ms) and a wireless-output warning from `AudioContext.outputLatency` where available.

## V10. Offline practice
- **Gate:** counsel on retention/portable copies (D7).
- Service worker + OPFS store per song: stems (Opus/AAC), artefacts, alphaTex; encrypted-at-rest not required by law but keys stay per user; expiry when the server copy expires or the user deletes the song (delete cascade must also clear local caches on next sync).
- Practice logs and corrections queue offline and sync with idempotency keys.
- **UI (redesign):** "Save offline" in the practice ⋯ menu and the song card menu; a "Saved offline" badge; the library's offline state dims songs that aren't saved with "Needs connection" (`27` §4). Not in steps s32–s45 beyond the banners and states that exist today.

## V11. Export (MusicXML, Guitar Pro, PDF)
- **Gate:** counsel (export is "moderate exposure").
- `music-core/export/musicxml.ts` on the effective view; Guitar Pro via alphaTab exporter if available in the pinned version; PDF via alphaTab print layout in a headless browser job or client print.
- Every export carries an "auto-transcribed, for personal practice" footer and is logged.
- **UI (redesign):** "Export" in the practice ⋯ menu once built; Pricing lists "Export and offline downloads: Coming soon" for both plans until then.

## V12. Alternative fingerings, tuning and capo input
- UI exposes `alt_fingerings[]` per note (tap → cycle), global "easiest / as played" switch, tuning presets (standard, half-step down, drop-D, full-step down; bass 4/5-string) and capo.
- All recompute client-side in the `music-core` Worker.
- **UI (redesign):** the Fix tab's note card shows the alternatives as "or play it as string 3, fret 7" chips (`27` §3.7.4, s38); Add song's **Tuning** button and a tuning row in the Now column's Level/Capo card appear with the tuning presets (not in s32–s45).

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

## Implementation notes (step 24, piano accuracy, 2026-10-25)
- **The piano pipeline is now measured on pop material** (P2p, `specs/08`): real Disklavier pianos and rendered pop piano, solo and in Slakh2100 bands.
- **Solo piano** skips BS-Roformer-SW: a 3 s htdemucs_6s check finds no drums, bass or vocals, and notes come from the mixture. This lifts harpsichord, clavinet and roomy or phone recordings (pop-solo 0.847 → 0.920) and cuts a solo analysis's separation time by about two thirds.
- **Songs without a piano stem** are transcribed by YourMT3+.
- **Notes now carry:**
  - calibrated per-note confidence, so the staff's confidence outlines mean something (high band 0.95 precision, medium 0.63);
  - a hand from PM2S (0.927 vs 0.885 against score staves).
- **The grand staff draws the sustain pedal** under the bass staff. Durations stay key releases (the model's offsets), so the roll still shows played length.
- **Electric pianos** (Rhodes, Wurlitzer, CP80) transcribe well when rendered. P2's 0.68 came from Slakh's patches. The Notes view stays the piano default.
- **Per-song gate (owner, 2026-10-25):** a song whose mean calibrated note confidence is below 0.80 opens on the Chart, with the existing low-confidence banner and "Show notes anyway".

## Redesign scope that is not a V-feature
| Feature | Step | Backend state (2026-11-08) | UI |
|---|---|---|---|
| Multi-stem mixer | s40a (backend, owner gate G3), s40b (UI) | Separation keeps only the target (plus drums/bass) and a mix-minus, although the model outputs six stems; keeping all six changes the cache key and needs `eval:regression` | Mix tab: every stem, presets incl. Rhythm only, Click and Hear the chords channels, Rough tags, phone mini-mixer (`27` §3.7.4) |
| Progress | s39 | `GET /v1/progress` (per-clip attempts with time, tempo, outcome) exists; the web never calls it | Progress tab, Library's Continue card, This week, Worth a revisit; "first clean pass next session"; no streaks |
| Fix tab | s38 | Correction ops exist (`set_chord`, `split_chord`, `set_note`, `add_note`, `delete_note`, `shift_downbeat`, `tempo_octave`, `nudge_beat`, `set_section`, `mark_correct`, `report_wrong`) | Fix mode: queue by consequence, alternatives with frequency wording, audition over the loop, It's right, Your edits with Revert |
| "Notify me when it's ready" | s44 | Web Push doesn't exist anywhere | Button in the Getting ready card where Web Push exists; SW `push`/`notificationclick`, subscription contract and route, table + migration, sender on `analysis.done`; permission asked only on click; on iOS only when installed |
| Stand view, phone Tools sheet, pedal wizard | s43 | — | `27` §3.7.2, §3.9 |

## Open questions
- Web MIDI availability on iOS Safari (affects V5 on iPad before native).
- Whether V8 should move into MVP as a mic-free stand-in for scoring (roadmap open question).
- Drum training compute budget and whether owned e-kit recordings are enough to close the E-GMD domain gap (QM15).

## Sources
Cross-linked research: `research/product/feature-roadmap-beginner-to-intermediate.md` (V1–V14), `research/ux/practice-tool-patterns.md` (Patterns 2, 4, 8, 9), `research/ml/transcription-piano.md`, `research/ml/transcription-drums.md`, `research/ml/transcription-vocals-melody.md`, `research/ml/chords-beats-key-structure.md`, `research/ux/music-display-ui.md`, `research/ux/accessibility.md`, `research/product/recommendations-and-decisions.md` (D3, D4, D7, D12).
