---
title: Feature roadmap, beginner to intermediate (MVP / v1 / later)
workstream: product
last_researched: 2026-10-20
confidence: medium
---

# Feature roadmap: beginner to intermediate

This roadmap is a synthesis of other docs; this doc adds no new web research. Each feature is tied to:
- a user need, from the personas P1–P6 in `users/personas.md` and the jobs J1–J8 in `users/jobs-to-be-done.md`;
- evidence, as a doc cross-link plus the named key source (URLs live in the linked doc);
- a dependency: an ML stage in `ml/pipeline-overview.md` or a legal design (A–F) in `legal/youtube-copyright-and-platform-policy.md`.

Practice-tool candidates (#1–#16) and their P0–P3 priorities come from the table in `ux/practice-tool-patterns.md`. Tier rationale and the decisions behind it (D1–D13) are in `product/recommendations-and-decisions.md`. All targets and metrics below are **proposed**.

## TL;DR
- **MVP goal.** Prove one job end to end for guitar and bass learners (P1, P3): bring a song file, hear your part isolated, see chords or tab with honest confidence, then loop and slow the hard bit. The aha is a loop at reduced speed within 5 minutes, using a bundled example song.
- **MVP excludes:**
  - mic scoring;
  - piano and drum notation;
  - YouTube audio import of any kind;
  - public sharing;
  - lyrics;
  - native apps.

  Each exclusion has a reason below.
- **v1** adds the next instruments (piano, drums), constrained mic scoring with a tuner, a speed trainer, transpose/capo, sections, offline practice, export and native apps.
- **Later** covers retention experiments, licensed catalog, vocals and lyrics, on-device separation, and video fingering research.
- **Measure** time-to-first-isolated-playback, loop completions and clean passes, correction rate, cost per song and week-4 retention. Targets are proposals, to be re-baselined after the first cohort.

## Findings

### MVP (prove the core job for guitar and bass)

| # | Feature | User need (persona / JTBD) | Supporting evidence | Dependency (ML stage / legal design) | Why MVP |
|---|---|---|---|---|---|
| M1 | Import own audio/video file (device, cloud picker) or record yourself | "Get the audio in" supporting job; P3 rehearsal deadline | `legal/youtube-copyright-and-platform-policy.md` §6 (Moises, Capo and Anytune accept only user files) | Ingest/decode; **Design A/E**; upload ToS warranty | The only lawful input path (D1); nothing else works without it |
| M2 | Instant local full-mix playback with loop and slow-down while the job runs | J4, J5; processing-wait friction (journeys stage 4) | `users/user-journeys-and-flows.md`; `ml/deployment-and-inference.md` (progressive results) | Client decode + Signalsmith Stretch; optional Beat This! small | Turns the processing wait into practice time |
| M3 | Async analysis job with progressive results (beat grid → stems → notes) | J1–J3; outcome "time to first playable result" | `ml/pipeline-overview.md` §1 and Prototype 4 (beat grid ≤10 s, full ≤90 s p50) | All server stages; per-user storage (D7) | Architectural backbone; hard to retrofit |
| M4 | Stem mixer: mute/solo/volume, "minus-one" and "my part loud" presets, hide empty stems | J2, J8; P3, P4 | `ux/practice-tool-patterns.md` #3 (P0); BassBuzz "muddy bass" threads in `users/voice-of-customer-pain-points.md` | Vendor separation (one stem; mix-minus = mixture − stem); instrument tagger gate | The core promise; table stakes vs Moises |
| M5 | Slow-down without pitch change, 50–100% in fine steps, remembered per song | J4; P1, P5 | #2 (P0); Duke et al. 2009 via `ux/learning-science-principles.md`; Chordify paywalls it (pain) | Signalsmith (D5); Prototype 7 | Expected parity feature and a paywall pain point; keep it free |
| M6 | Bar-snapped A–B loop with pass counter, saved clips, tap-to-set (non-drag) | J5; all personas | #1 (P0); Duke et al. 2009; WCAG 2.5.7 via `ux/accessibility.md` | Beat This! downbeats | The practice unit everything else hangs on |
| M7 | Count-in and metronome on the detected beat grid, half/double-tempo fix | J5, J8 | #4 (P0); Palese & Duke 2022; Rush 2023 timing gap (`users/personas.md`) | Beat This! (MIT/MIT) | Playing in time is the gap left by riff-only learning |
| M8 | Chord strip (beat-synchronous majmin), editable, with confidence | J3; P1 rhythm guitar; fallback for every instrument | `ml/chords-beats-key-structure.md`: majmin 77.8, about 1 bar in 6 wrong | Chord model (amber, needs sign-off) + bass root | Most useful beginner output; universal fallback |
| M9 | Guitar and bass tab, easiest-position default | J3; P1, P3 | `ml/transcription-guitar-and-bass-tabs.md`: Basic Pitch 79 onset F1 (GuitarSet); lowest-fret 98.30% on simple material; Songsterr AI as competitor (`market/competitors/songsterr.md`) | Separation → Basic Pitch → fret DP → alphaTab; Prototypes 2 and 3 gate it | The "what does my instrument play" step that utilities lack |
| M10 | Confidence shading, tap-to-edit, "report wrong note", "Auto-transcribed" label, global fallback to chords | J3 trust; VoC theme "tabs are wrong" (High/High) | #6 (P0); `ux/music-display-ui.md`; Chordify App Store complaint in `users/voice-of-customer-pain-points.md` | Confidence contract (`ml/pipeline-overview.md` §5); calibration | Trust is the most evidenced unmet outcome |
| M11 | Minimal level toggle for the chosen song. Guitar: chords only / simplified shapes / as transcribed. Bass: roots / full line | P1 level mismatch; differentiation-gap step 4 | `market/competitor-landscape.md` (no AI tool adapts a user-chosen song); `ux/onboarding-retention-motivation.md` (simplify first) | Chord strip + root track; rule-based | Splitune's differentiator per the gap analysis; cheap |
| M12 | YouTube embed as visual reference beside the analysis, with manual syncpoints | Core job "learn it from the video"; J1 | Legal **Design B**; Soundslice syncpoint precedent (`market/competitors/soundslice.md`) | IFrame API (`setPlaybackRate`, `seekTo`) only; counsel question 1 (paywall vs III.F.3.a) | Keeps the video in the learning loop lawfully. **Ship only after counsel sign-off**; otherwise move to v1 |
| M13 | First-session flow with a bundled example song (Splitune-owned recording): instrument + level → isolated part → phrase looped at 70% | J7; first aha | `ux/onboarding-retention-motivation.md`; `users/user-journeys-and-flows.md` Journey 2 | Precomputed results; Design E/C (own recordings) | Avoids queue time and the file-import hurdle on the first run |
| M14 | Personal library: resume where left off; per-song speed, mix and loops; never removed by Splitune | J7; content-removal pain | flowkey and Drumeo removal complaints in `users/voice-of-customer-pain-points.md` §4 | Per-user storage (D7) | Cheap retention lever that counters catalog churn |
| M15 | Practice-mode layout: primary controls ≥64 pt, keyboard and pedal mapping with "learn this pedal", reduced motion, colour plus a second cue | Hands busy (P1, P4); accessibility | `ux/hands-busy-and-device-context.md`; WCAG 2.2 AA in `ux/accessibility.md` | None (web `keydown`) | Cheap on web; differentiator for hands-busy use |
| M16 | Transparent billing: first song free including the aha; caps by volume; renewal reminders; one-tap cancel | VoC billing theme (High/High) | `users/voice-of-customer-pain-points.md` §3; `market/pricing-and-business-models.md` | Billing provider (D10) | The most frequent complaint, and cheap to get right |
| M17 | Data controls and DMCA operations: delete-song cascade, takedown intake, upload warranty | Legal launch gate | `legal/youtube-copyright-and-platform-policy.md` "UGC policy requirements" | D7; DMCA agent ($6, 3-year renewal) | Required before accepting uploads |

### v1 (next instruments, feedback and depth)

| # | Feature | User need | Supporting evidence | Dependency | Why v1, not MVP |
|---|---|---|---|---|---|
| V1 | Speed trainer, manual steps (start/end/step/plays per step) | J4; reach full tempo | #7 (P1); Soundslice and Guitar Pro precedent | Signalsmith; loop model | Builds on M5/M6; not needed for the first aha |
| V2 | Transpose plus capo/easier-shape suggestion; separate "playback key" and "shapes key" | P1 fingering, P6 vocal range | #9 (P1); Moises Capo Mode (`ux/practice-tool-patterns.md`) | Pitch shift (Signalsmith); chords | Needs reliable chords first (M8) |
| V3 | Section navigation (verse/chorus loop presets) | J1, J5 | #10 (P1); `ml/chords-beats-key-structure.md` (All-In-One HR.5F .660) | All-In-One (amber) | Licence sign-off; pop-only training |
| V4 | Piano: notes (Transkun) + hand split (PM2S) + falling-notes roll beside a keyboard strip; solo-piano path skips separation | P2 job "see the actual notes" | `ml/transcription-piano.md` (0.983 MAESTRO; band mixes unmeasured); P.I.A.N.O. study in `ux/music-display-ui.md` | Transkun (amber, MAESTRO NC data); Prototype 2 | Licence plus unmeasured quality on band mixes (D11) |
| V5 | Piano wait mode via MIDI/USB | P2; self-paced note learning | #11 (P1); flowkey Wait Mode; users say MIDI is far more accurate than mic | Web MIDI or native MIDI | Follows V4 |
| V6 | Drums: 5-class transcription + drum grid, cymbal/hi-hat marked "approximate" | P4 job "readable pattern at slow tempo" | `ml/transcription-drums.md` (ADTOF red; E-GMD models generalise worse) | In-house CRNN on CC-BY data | Needs training and a test set |
| V7 | Constrained mic listen-and-score + tuner (single-note lines, chord-level for strumming, calibration, override, headphones prompt) | J6 "check my playing" | #12 (P2, promoted with constraints per D12); `ux/practice-tool-patterns.md` Pattern 9 | SwiftF0/PESTO on-device (bass tuner needs a floor ≤30 Hz); Prototype 5 | Phone-mic accuracy unpublished; incumbents' top complaint |
| V8 | Record-and-compare (my take vs reference stem) | J6, thinking time (P4 in learning science) | #13 (P2); Palese & Duke 2022 | Mic capture only, no ML | Cheap. Promoted from P2 because it needs no ML |
| V9 | Visual and haptic metronome | Accessibility; hands busy | #16 (P1); `ux/accessibility.md` (WCAG 2.3.1 flash cap) | Beat grid | Small add-on to M7 |
| V10 | Offline practice of processed songs (download stems + notation) | Alternate flow C, no internet | `users/user-journeys-and-flows.md` | Counsel on retention (D7); platform storage | Retention policy and platform decisions first |
| V11 | Export to the user (MusicXML, Guitar Pro, PDF) | Interoperability; teacher use | `market/competitors/guitar-pro.md` (de facto format); legal "export: moderate exposure" | Notation stage; counsel | Counsel review of portable copies |
| V12 | Alternative fingerings ("easiest" vs "as played"); capo and tuning input | P1/P3 playable fingering | `ml/transcription-guitar-and-bass-tabs.md` (MIDI-to-Tab playability 6.04 vs GP8 4.69) | Fret DP `alt_fingerings[]` | Refines M9 after real usage data |
| V13 | Richer level adaptation: piano melody-only right hand / block-chord left hand; simplified drum groove | P2, P4 "your song at your level" | `ml/transcription-piano.md` §5 (rule-based levels feasible) | V4, V6 | Depends on v1 instruments |
| V14 | Native iOS app, then Android | Phone/tablet practice; store discovery | D9 rationale | Shared WASM/C++ DSP and ONNX models | Web first while product–market fit is unknown |

### Later

| # | Feature | User need | Supporting evidence | Dependency | Why later |
|---|---|---|---|---|---|
| L1 | Auto speed trainer driven by clean passes | Remove tempo bookkeeping | #8 (P2) | V7 scoring | Needs trustworthy scoring |
| L2 | Spaced review queue of learned sections | Retain songs over weeks | #14 (P2); Donovan & Radosevich 1999; Cepeda et al. 2006 (shape only) | Practice history | Needs weeks of usage data |
| L3 | Mixed (interleaved) practice mode | Possible retention boost | #15 (P3); Carter & Grahn 2016 (weak) | Loop model | Weak evidence; run as an experiment |
| L4 | Vocal practice view: song f0 vs live mic; range-based transposition | P6 (low evidence) | `ml/transcription-vocals-melody.md` | RMVPE (amber), SwiftF0/PESTO | Persona evidence low; needs interviews |
| L5 | Lyrics display (licensed text + alignment) | P6, singalong | `ml/transcription-vocals-melody.md`; legal "lyrics are protectable" | Lyrics licence; WhisperX alignment | Rights first |
| L6 | Licensed catalog / licensed stems | Songs without files; shareable pages | Legal **Design C/D**; Rocksmith+ licensing pain (`market/competitors/rocksmith-plus.md`) | Label/publisher deals | Business-development dependent |
| L7 | Share a clip of my own playing; teacher practice-log export | Relatedness (SDT) | `ux/onboarding-retention-motivation.md` | Own-performance content only (Design E) | Shared derived content needs counsel |
| L8 | Voice commands (closed vocabulary, push-to-talk) | Hands busy | `ux/hands-busy-and-device-context.md` (P3 priority) | Speech APIs | Unreliable while playing |
| L9 | On-device separation | Privacy, zero marginal cost | `ml/deployment-and-inference.md` (no phone timings) | SCNet-class model on licensed data, or vendor SDK | Only after a phone benchmark of RTF ≲1 |
| L10 | Fingering from video (piano top-down R&D; guitar not promised) | "As played" fingering | `ml/video-and-audio-visual-analysis.md` (research-grade; YouTube frames off-limits) | User-recorded video only | Research track |
| L11 | Ambient "listen mode" (Design F′) | Chords for anything audible | Legal F′ exposure medium/unclear | Counsel opinion | Research spike gated on counsel |
| L12 | Ukulele; violin/winds monophonic | Secondary instruments | `ml/transcription-general.md` §7 | Fret DP (re-entrant tuning); monophonic tracker | Feasibility only |

### Not in MVP, and why
- **Any import of YouTube (or Spotify/Apple Music) audio.** Prohibited by the YouTube Developer Policies (III.E.1, III.I.7), App Store 5.2.3 and the Spotify Developer Terms. It is also the subject of active § 1201 litigation. This is not deferred: it is never on the roadmap (D1).
- **Mic listen-and-score.** No published phone-mic accuracy, and false negatives destroy trust (D12). MVP uses self-assessed clean passes.
- **Piano and drum notation.** Piano weights are amber and quality on band mixes is unmeasured. Drums need an in-house model because ADTOF is red (D3, D11). The practice player still serves these instruments.
- **Public sharing, a community tab library or crowd-corrected shared tabs.** These need publisher licensing; the 2006 MPA/NMPA takedowns are the precedent. Shared corrections would also be a cross-user cache (D7).
- **Lyrics.** Displaying lyrics is a rights question first.
- **Cross-user caching of stems or tabs**, even as a cost optimisation. Excluded until counsel approves (D7).
- **Streaks, points and badges.** Evidence is mixed, with novelty and loss-aversion side effects (`ux/learning-science-principles.md` P10). Ship progress as "tempo reached per section" and treat streaks as a later experiment.
- **Native apps, offline mode and export.** Platform sequencing (D9) and pending counsel review on retention and portable copies.
- **Learned fret assigner and 7-class drum kit separation.** No usable code or licence (`ml/transcription-guitar-and-bass-tabs.md`, `ml/transcription-drums.md`).
- **Fingering from video.** Research-grade, and YouTube frames are legally off-limits.

### Measurement plan (proposed)
All targets are **proposed** and should be re-baselined after the first 100 users. Event names are suggestions.

| Metric | Definition | Proposed target | Features it validates |
|---|---|---|---|
| Time-to-first-isolated-playback | From file selected to first audible separated stem | p50 ≤60 s (`ux/onboarding-retention-motivation.md` recommendation); full results ≤90 s p50 (Prototype 4 gate) | M3, M4 |
| Time-to-first-loop at reduced speed (session 1) | From install to first completed loop pass below 100% speed on the example song | p50 ≤5 min; ≥60% of new users reach it in session 1 | M2, M5, M6, M13 |
| Loop completions per session | Completed loop passes per practice session | Baseline first; growth across weeks 1–4 | M6, M7 |
| Clean passes and tempo reached | Per section: max tempo at a clean pass (self-assessed in MVP); passes to first clean | Median tempo reached rises week over week for retained users | M6, M11, V1 |
| Correction rate | Edits plus "wrong note" reports per 100 displayed notes or chords, per instrument and model version | Track vs Prototype 2 F1; investigate if >15/100 (proposal) | M8, M9, M10 |
| Fallback rate | Share of songs where `recommended_view` = chords-only, per instrument | Guitar ≤40%, bass ≤20% (proposal; set after Prototype 2) | M9, M10, D11 |
| Stem quality signal | Share of stems flagged "rough"; share of sessions using minus-one vs solo | Baseline; compare against Prototype 1 ratings | M4 |
| Import success and file-step drop-off | Share of import attempts ending in a processed song; drop-off at "upload a file you own" after pasting a video link | Import success ≥95%; file-step drop-off measured as the key D1 risk | M1, M12 |
| Job reliability and cost | p50/p95 latency; failure rate; vendor plus GPU cost per song-minute and per paying user | Cost per analysed song ≤$0.28 (D10 break-even); failure rate ≤2% | M3, D6 |
| Retention | D1, D7 and **week-4 retention** (share of a signup cohort active in week 4); sessions per week | Week-4 retention: baseline, then beat the prior cohort; 2–3 sessions/week median | M13, M14, overall |
| Monetisation and trust | Free→paid conversion; refund requests; cancellation-complaint rate | Zero "surprise charge" complaints is the design goal | M16 |
| Hands-busy use | Share of practice actions triggered by keyboard or pedal | Baseline; informs native-app priority | M15 |
| Mic scoring (v1) | Override rate ("I played it right") per 100 scored notes; scored sessions per user | Override rate <5% before widening scope (proposal) | V7 |

## Implications for Splitune
- **Tier boundaries move with the prototypes:**
  - Prototype 1 failure moves guitar tab behind chords.
  - Prototype 2 success on band-mix piano pulls V4 forward.
  - Counsel blocking M12 moves the embed to v1.
- **Shared data model from day one.** Every MVP feature writes the shared practice data model (section, tempo, passes, last attempt), so v1 scoring and L1–L2 plug in without migration.
- **Confidence data first.** The MVP must ship the confidence and versioning contract, even if the UI only shows it as shading, because corrections and fallback metrics depend on it.

## Open questions
- Will learners supply a file after pasting a video link? This is the M12/M1 funnel; measure it in the first prototype.
- Is a self-assessed clean pass a reliable enough progress signal? Compare it with expert ratings on a sample.
- Which minimal level toggle (M11) do beginners actually use? Run a usability test with 8–10 P1 learners.
- Should V8 (record-and-compare) move into MVP as a mic-free stand-in for scoring? Decide after the first usability round.

## Sources
Cross-linked docs only; the primary citations for every evidence cell are in those docs: `product/recommendations-and-decisions.md`, `ux/practice-tool-patterns.md`, `ux/learning-science-principles.md`, `ux/onboarding-retention-motivation.md`, `ux/music-display-ui.md`, `ux/hands-busy-and-device-context.md`, `ux/accessibility.md`, `users/personas.md`, `users/jobs-to-be-done.md`, `users/user-journeys-and-flows.md`, `users/voice-of-customer-pain-points.md`, `market/competitor-landscape.md`, `market/feature-matrix.md`, `market/pricing-and-business-models.md`, `market/competitors/songsterr.md`, `market/competitors/soundslice.md`, `market/competitors/guitar-pro.md`, `market/competitors/rocksmith-plus.md`, `ml/pipeline-overview.md`, `ml/deployment-and-inference.md`, `ml/chords-beats-key-structure.md`, `ml/transcription-guitar-and-bass-tabs.md`, `ml/transcription-piano.md`, `ml/transcription-drums.md`, `ml/transcription-vocals-melody.md`, `ml/transcription-general.md`, `ml/video-and-audio-visual-analysis.md`, `legal/youtube-copyright-and-platform-policy.md`.
