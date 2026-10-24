---
title: Open questions and risks
workstream: product
last_researched: 2026-10-20
confidence: medium
---

# Open questions and risks

This doc consolidates the open questions from every doc in `docs/` (deduplicated), a risk register, the claims that rest on a single source or are unverified, the known research gaps, and the contradictions found between docs together with their resolutions. It also folds in the working research plan. This is a synthesis; no new web research was done. Questions point to the doc that owns the detail.

## TL;DR
- **P0 questions (block an MVP decision or launch).** There are four kinds:
  - Counsel: embed paywall vs YouTube III.F.3.a; fair use of paid per-user processing; § 512(c) scope; amber-weights sign-off; privacy law, which was not researched.
  - Prototypes 1–4 and 7: separation quality, transcription on stems, fret DP, cost per song, slow-down quality.
  - User tests: will learners supply audio files, and what will they pay?
  - Vendor terms: caching, retention and billing.
- **Top risks.** Guitar and piano quality on real audio; unclear legality of paid per-user processing; learners without files; unit economics, where vendor separation and licensed-data cost pull in opposite directions; retention.
- **Most decision-relevant unverified numbers:**
  - the assumed L4 RTF of 0.1, which underlies every self-hosting cost;
  - Music.AI's per-stem vs per-job billing;
  - Songsterr's price conflict ($2.99 vs $9.99);
  - Fender's "90% quit" figure (no methodology);
  - Macnamara's 21% figure (secondary sources only);
  - all community evidence, which comes from BassBuzz and store reviews because Reddit was unreachable.
- **Resolved contradictions.**
  - Pipeline input is user files or recordings, never a YouTube stream; the embed is a visual reference only.
  - All outputs are stored per user, with no cross-user cache until counsel approves.

## Findings

### 1. How to read this doc
- **Priority.**
  - **P0:** blocks an MVP decision or launch.
  - **P1:** blocks a v1 feature.
  - **P2:** later, or monitoring only.
- **Method.**
  - **Experiment:** offline measurement.
  - **Prototype:** build and test with users.
  - **User research:** interviews, fake-door tests, analytics.
  - **Expert:** domain specialist or model authors.
  - **Counsel:** qualified lawyer.
  - **Desk:** re-check sources.
- **Decisions.** "D#" refers to the decisions in `research/product/recommendations-and-decisions.md`.

### 2. Open questions by workstream

#### Legal and platform (owner: counsel unless noted)
| # | Question | How to find out | Priority | Owning doc |
|---|---|---|---|---|
| QL1 | Does a subscription that unlocks practice tools beside a free YouTube embed breach Developer Policy III.F.3.a ("must not charge users to watch content")? | Counsel; ask YouTube API Services support for written guidance | P0 (D1, D10) | `research/legal/youtube-copyright-and-platform-policy.md` |
| QL2 | Is paid per-user separation and transcription of user-supplied commercial recordings fair use after *Warhol*? Does on-device processing change direct liability? | Counsel (US); EU/UK counsel before launching there | P0 | same |
| QL3 | Does § 512(c) cover stems and tabs that Splitune derives itself? Which retention policy minimises exposure? | Counsel | P0 (D7) | same |
| QL4 | Can amber weights ship? These are weights trained on NC data such as MAESTRO, MUSDB18-HQ or AudioSet, or weights with no stated licence. Is a fair-use or TDM argument acceptable in the launch markets? | Counsel; author grants (QM9) | P0 for MVP components (Basic Pitch, chord model, tagger); P1 others | `research/ml/datasets-metrics-and-licensing.md` |
| QL5 | Do vendor contracts (AudioShake, Music.AI, LALAL.AI) allow per-user stem retention, prohibit training on uploads, and state retention periods? | Contract review during trials | P0 (D2) | `research/ml/source-separation-model-comparison.md` |
| QL6 | Privacy and data protection: GDPR, children's and teen data (persona P5), retention, consent for training opt-in. **Not researched anywhere in `docs/`** | Counsel; privacy specialist | P0 before collecting user data | (gap) |
| QL7 | Which rights (print, display, lyric) are needed for privately displayed auto-transcriptions vs shared ones? What do HFA or publisher deals cost a startup? Is Chordify licensed? | Counsel; publisher business development | P1 (export, sharing) | `research/legal/youtube-copyright-and-platform-policy.md` |
| QL8 | Copyleft obligations in closed and app-store distribution: alphaTab (MPL-2.0), Verovio (LGPL), PESTO (LGPL-3.0, static linking on iOS). Does the Rubber Band £590 tier cover app stores? | Counsel; ask Breakfast Quay | P1 | `research/ml/playback-time-stretch-pitch-shift.md`, `research/ux/music-display-ui.md` |
| QL9 | EU/UK: DSM art. 4 opt-outs, art. 17 (if any sharing), private-copy rules. UK s.29A excludes commercial use | EU/UK counsel | P1 (before EU/UK launch) | `research/legal/youtube-copyright-and-platform-policy.md` |
| QL10 | Design F′ (ambient mic listen mode): does analysing mic audio of a playing YouTube video implicate ToS or III.I.7? What is the status of transient buffers? | Counsel | P2 | same |
| QL11 | Is there any compliant path to analysing performer video frames (for example a creator partnership)? | Counsel | P2 | `research/ml/video-and-audio-visual-analysis.md` |
| QL12 | Is there an authorization path for YouTube Premium, Apple Music or Spotify content? (Current reading: no) | Counsel | P2 | `research/legal/youtube-copyright-and-platform-policy.md` |
| QL13 | Monitor § 1201 cases: Yout v. RIAA (2d Cir. 22-2760), the Suno § 1201(a) amendment (D. Mass.), a possible BGH appeal in Uberspace. Also: post-Oct-2025 Suno/Udio status, Bartz settlement amount, GEMA suits | Counsel monitoring; desk | P2 | same |
| QL14 | Which YouTube ToS version governs? The effective dates differ by locale | Counsel | P2 | same |
| QL15 | Can Meta's SAM Audio licence be used in a consumer app? | Counsel | P2 | `research/ml/source-separation-model-comparison.md` |

#### ML / AI (owner: ML lead)
| # | Question | How to find out | Priority | Owning doc |
|---|---|---|---|---|
| QM1 | Vendor per-instrument separation quality on real, lossy, mastered user audio, especially guitar and piano | Prototype 1: blind listening test, 20 clips, learners and teachers | P0 (D2, D11) | `research/ml/pipeline-overview.md`, `research/ml/source-separation.md` |
| QM2 | Does separation help or hurt each specialist (Basic Pitch, Transkun) compared with the mixture? | Prototype 2 on an in-house labelled set | P0 guitar/bass; P1 piano | `research/ml/transcription-general.md`, `research/ml/transcription-piano.md` |
| QM3 | How does Basic Pitch perform on distorted electric guitar stems? | 30-song internal set with hand-made tabs | P0 | `research/ml/transcription-guitar-and-bass-tabs.md` |
| QM4 | Does the fret-assignment DP reach ≥0.90 string/fret agreement with good playability? | Prototype 3 on GuitarSet | P0 | same |
| QM5 | Real L4/A10 RTF and cold start per model; full-chain GPU seconds per song-minute | Prototype 4 | P0 (D6, D10) | `research/ml/deployment-and-inference.md` |
| QM6 | Signalsmith quality at 0.5×/0.75×, and its CPU cost on mid-range Android and in Safari AudioWorklet | Prototype 7 plus device benchmark | P0 (D5, D9) | `research/ml/playback-time-stretch-pitch-shift.md` |
| QM7 | Chord accuracy on target genres: mixture vs no-drums vs no-vocals input | Prototype 6, 30 hand-annotated songs | P0 | `research/ml/chords-beats-key-structure.md` |
| QM8 | Music.AI per-stem vs per-job billing; AudioShake API/SDK pricing | Vendor quotes | P0 | `research/ml/pipeline-overview.md` |
| QM9 | Weights licences and data provenance for Transkun, hFT, Basic Pitch, RMVPE, ROSVOT, SwiftF0, PESTO, CREPE, consonance-ACE, BTC, All-In-One, SongFormer, EfficientAT/PaSST, TART, Fretting-Transformer, MIDI-to-Tab, V2N, GuiFiR, and community checkpoints (BS-Roformer SW, viperx, Kimberley Jensen) | Email authors; record in the register | P0 for MVP components; P1 others | each ML topic doc |
| QM10 | Dataset licence conflicts and unknowns: GuitarSet (CC-BY-4.0 vs MIT), Groove MIDI (CC-BY-4.0 vs CC-BY-SA-4.0), EGDB, ENST-Drums, Isophonics, MagnaTagATune, STAR Drums, and whether Slakh's CC-BY grant covers audio rendered with commercial sample libraries | Read LICENSE files; email maintainers | P1 | `research/ml/datasets-metrics-and-licensing.md` |
| QM11 | Can Splitune license multitracks for training (MUSDB18/MoisesDB holders, stem libraries, label deals)? At what cost? | Business development | P1 (gates self-hosting, D2) | `research/ml/datasets-metrics-and-licensing.md` |
| QM12 | Is grid-snap quantization good enough on rubato covers? How does Beat This! do on rubato solo performances? | Prototype plus user test | P1 | `research/ml/transcription-general.md`, `research/ml/chords-beats-key-structure.md` |
| QM13 | Frame-level accuracy of instrument activity (stem energy plus tagger) on mastered pop and rock | 50–100 song annotated set; segment F1 | P1 | `research/ml/instrument-recognition.md` |
| QM14 | Piano accuracy on solo covers and band-mix stems | Own recordings on a MIDI-capable piano | P1 | `research/ml/transcription-piano.md` |
| QM15 | Domain gap for E-GMD-trained drum models on real songs; usable velocity and ghost notes from stems | MIDI-pad drummer playing along to songs | P1 | `research/ml/transcription-drums.md` |
| QM16 | Live mic latency and RPA on phones (SwiftF0, PESTO). Can one tracker serve all instruments, given SwiftF0's 46.9 Hz floor? | Prototype 5 | P1 (D12) | `research/ml/transcription-vocals-melody.md` |
| QM17 | Codec loss: SDR penalty of 128 kb/s AAC/Opus vs lossless; does Apollo-style restoration help? | Experiment | P2 | `research/ml/source-separation.md` |
| QM18 | Capo and tuning auto-detection (pitch histogram plus lowest-note heuristic) | Prototype | P2 | `research/ml/transcription-guitar-and-bass-tabs.md` |
| QM19 | A permissive key detector with a benchmark | In-house evaluation | P2 | `research/ml/chords-beats-key-structure.md` |
| QM20 | Word-alignment accuracy on sung vocals (WhisperX) | Evaluate on Jam-ALT or MUSDB-ALT | P2 | `research/ml/transcription-vocals-melody.md` |
| QM21 | On-device separation and Transkun: timings and battery on iPhone 15-class and mid-range Android phones | Prototype (Core ML / ExecuTorch) | P2 | `research/ml/deployment-and-inference.md` |
| QM22 | MediaPipe landmark accuracy on fretting and piano hands (user-recorded video only) | Annotate about 200 frames | P2 | `research/ml/video-and-audio-visual-analysis.md` |
| QM23 | Do neural MusicXML simplifications (Ramoneda 2025) make pedagogically sound pop scores? | Teacher review | P2 | `research/ml/transcription-piano.md` |
| QM24 | Is there an official 2025/26 MSS challenge? Watch Harmonica, N2N and SongFormer for code releases | Desk | P2 | `research/ml/source-separation.md`, `research/ml/transcription-general.md` |
| QM25 | Does Moises separate in the cloud? | Desk (privacy policy, help centre) | P2 | `research/ml/deployment-and-inference.md` |

#### Market (owner: PM)
| # | Question | How to find out | Priority | Owning doc |
|---|---|---|---|---|
| QK1 | Do learners prefer caps, credits or flat plans, and at what price? | Fake-door pricing test | P0 (D10) | `research/market/pricing-and-business-models.md` |
| QK2 | Store fees and web payment-processing fees (the 30% figure is a placeholder) | Desk | P1 | same |
| QK3 | How accurate are Songsterr AI and Klangio on typical learner songs? | Fixed-song bake-off | P1 | `research/market/competitor-landscape.md` |
| QK4 | Current market size per instrument (no current NAMM data found) | Buy or obtain a report | P1 | `research/users/personas.md` |
| QK5 | Verified prices: Chordify, Yousician, Moises (web), Skoove, Fender Play, Songsterr ($2.99 vs $9.99), free-tier caps | Normal or logged-in browser check | P2 | `research/market/pricing-and-business-models.md`, `research/market/competitors/songsterr.md` |
| QK6 | Is any vendor shipping video-based fingering? | Quarterly release-note checks | P2 | `research/market/competitor-landscape.md` |
| QK7 | Fender Songs and Yamaha NoteStar shutdown notices (blocked) | Re-fetch | P2 | same |
| QK8 | Android and web coverage of several apps; Moises "synced guitar tabs" meaning; RipX accuracy; Anytune ReFrame method; Capo iOS isolation | Hands-on trials | P2 | `research/market/feature-matrix.md`, `market/competitors/` |
| QK9 | Economics of Chordify's publisher partnerships and Ultimate Guitar's Official-tab royalties | Desk; business development | P2 | `research/market/competitors/chordify.md`, `research/market/competitors/ultimate-guitar.md` |

#### Users (owner: PM / design lead)
| # | Question | How to find out | Priority | Owning doc |
|---|---|---|---|---|
| QU1 | Will learners who start from a video supply an audio file they own? | Prototype funnel: file-step drop-off | P0 (D1) | `research/users/user-journeys-and-flows.md` |
| QU2 | Validate P1 and P3 needs and price anchors (monthly vs annual vs credits) | 8–10 interviews per persona | P0 | `research/users/personas.md` |
| QU3 | Reddit and 403-blocked forums (TalkBass, JustinGuitar Community, Jazz Guitar Forum) were never sampled | Manual or API-based pass | P1 | `research/users/voice-of-customer-pain-points.md` |
| QU4 | Evidence for P2, P4 and P6 (drummer, singer) | Interviews | P1 | `research/users/personas.md` |
| QU5 | Which sub-job drives paid conversion (separation, notes, chords, scoring)? | Fake-door test | P1 | `research/users/jobs-to-be-done.md` |
| QU6 | How accurate must output be before users stop cross-checking? How do users respond to amber confidence warnings? | Usability test with seeded errors | P1 | `research/users/jobs-to-be-done.md`, `research/users/user-journeys-and-flows.md` |
| QU7 | Do learners prefer easiest or as-played fingerings? Do they want fingering at all? | User study | P1 | `research/ml/transcription-guitar-and-bass-tabs.md`, `research/ml/video-and-audio-visual-analysis.md` |
| QU8 | Drop-off curve vs processing wait time | Prototype analytics | P1 | `research/users/user-journeys-and-flows.md` |
| QU9 | Do users need stem audio offline, or is notation and loop metadata enough? | Interviews | P2 | same |
| QU10 | Do shared loop clips drive acquisition? Is band use (J8) a distinct segment? | Pilot; interviews | P2 | same; `research/users/jobs-to-be-done.md` |
| QU11 | Use of YouTube speed controls vs dedicated tools; do YouTube-first learners have worse rhythm (Rush 2023 coaches' hypothesis)? | Diary study; controlled study | P2 | `research/users/jobs-to-be-done.md`, `research/users/personas.md` |
| QU12 | Verify the Fender "90%" and 2018/2021 figures against primary releases | Ask Fender; re-fetch the newsroom | P2 | `research/users/personas.md` |
| QU13 | Collect Play/App Store reviews at scale and code themes quantitatively | Scrape and code | P2 | `research/users/voice-of-customer-pain-points.md` |

#### UX and learning science (owner: design lead)
| # | Question | How to find out | Priority | Owning doc |
|---|---|---|---|---|
| QX1 | Phone-mic note-level accuracy for acoustic guitar chords and piano | 50 learners × 3 phones vs MIDI/DI ground truth, F at 50 ms | P1 (D12) | `research/ux/practice-tool-patterns.md` |
| QX2 | Does iOS Safari receive pedal key events reliably (focus, PWA)? Which keys does each pedal mode send? | Device test with AirTurn and PageFlip | P1 (D9) | `research/ux/hands-busy-and-device-context.md` |
| QX3 | Legibility of notation at 1 m and 2 m on phones; a primary reading-distance standard | Legibility test; engraver or music librarian | P1 | same |
| QX4 | Do ±50 ms tolerances feel fair at 60% tempo? Bluetooth latency profiles on iOS vs Android | User test; device measurement | P1 | `research/ux/practice-tool-patterns.md` |
| QX5 | Does the P.I.A.N.O. aligned-roll advantage hold with a phone beside a real keyboard? | Pilot | P1 (piano v1) | `research/ux/music-display-ui.md` |
| QX6 | A reliable drum-notation reference for limb and instrument placement | Engraving reference (e.g. Gould) | P1 (drums v1) | same |
| QX7 | Time to first successful play-along and retention curves | Instrument the prototype | P1 | `research/ux/onboarding-retention-motivation.md` |
| QX8 | Accessibility: braille vs text for blind musicians; whether WCAG 2.2.2 applies to auto-scroll; left-handed diagram conventions; haptic API support; YouTube iframe accessibility | User tests; specialists | P1/P2 | `research/ux/accessibility.md` |
| QX9 | Auto vs manual speed trainer; 5%-per-3-clean-passes ramp vs a user-chosen ramp | A/B test | P2 | `research/ux/practice-tool-patterns.md`, `research/ux/learning-science-principles.md` |
| QX10 | Feedback frequency for beginners under imperfect detection; live vs terminal feedback; rest bar between loops | A/B test | P2 | `research/ux/learning-science-principles.md` |
| QX11 | Daily streaks vs forgiving weekly goals (D30 retention); reminder timing; self-assessment instrument (ABRSM/RCM descriptors) | A/B test; music-education researcher | P2 | `research/ux/onboarding-retention-motivation.md` |
| QX12 | Peer-reviewed tab-vs-notation comparison; music-specific evidence on slow practice, chunk size and session length; Duke et al. 2009 full text; Hallam | ERIC/RILM search; music-education expert | P2 | `research/ux/music-display-ui.md`, `research/ux/learning-science-principles.md` |
| QX13 | Voice commands while playing; page-flip vs scroll for moving tab; vocal pitch-shift artefacts beyond ±3 semitones; demand for slowdown below 50% | Measurements and user tests | P2 | `research/ux/hands-busy-and-device-context.md`, `research/ux/music-display-ui.md`, `research/ux/practice-tool-patterns.md`, `research/ml/playback-time-stretch-pitch-shift.md` |

#### Product, platform and business (owner: founder/PM)
| # | Question | How to find out | Priority | Owning doc |
|---|---|---|---|---|
| QP1 | Is web-first viable for practice on phones and tablets (DSP CPU, mic latency, pedals)? | QM6, QM16, QX2 run in mobile browsers | P0 (D9) | `research/product/recommendations-and-decisions.md` |
| QP2 | How many songs per user per month, and what is the real cost per paying user? | Prototype analytics plus Prototype 4 | P0 (D6, D10) | same |
| QP3 | Rights-clean example songs for onboarding (Splitune-owned recordings): who records them, and at what cost? | Production plan | P0 (roadmap M13) | `research/product/feature-roadmap-beginner-to-intermediate.md` |
| QP4 | Cross-platform framework choice for native v1 (not researched) | Engineering spike | P1 | (gap) |
| QP5 | Teacher / B2B segment size and needs | Interviews | P2 | `research/ux/onboarding-retention-motivation.md` |

### 3. Risk register
Likelihood and impact are judgements from the evidence in the owning doc.

| # | Risk | Likelihood | Impact | Early signal | Mitigation | Owning doc |
|---|---|---|---|---|---|---|
| R1 | Guitar/piano isolation not good enough to practise with (open `htdemucs_6s` 3.07/1.60 dB; vendor quality unverified) | Med–High | High | Prototype 1 medians below the gate | Mix-minus instead of solo; "rough" label; bass as the notation hero; vendor switch; in-house model on licensed data | `research/ml/source-separation.md` |
| R2 | Transcription errors compound across separation → notes → fret/hand assignment; no end-to-end benchmark | Med–High | High | Prototype 2 onset F1 <0.70 (guitar) or <0.80 (piano); high correction rate | Global fallback to chords, piano roll or f0 curve; confidence shading; edits; level toggle | `research/ml/pipeline-overview.md` |
| R3 | Learners will not supply audio files (most YouTube-first learners lack the file) | Med–High | High | File-step drop-off in the prototype funnel | Bundled example songs; record-yourself or teacher flows (Design E); honest embed-only mode; pull licensed catalog (C/D) forward | `research/legal/youtube-copyright-and-platform-policy.md`, `research/users/user-journeys-and-flows.md` |
| R4 | Paid per-user separation/transcription judged not fair use; § 512(c) may not cover derived outputs | Med (unknown) | High | Counsel opinion; takedown volume | Designs A/B/E only; private per-user storage; DMCA operations; no sharing; on-device later; licensing as a hedge | `research/legal/youtube-copyright-and-platform-policy.md` |
| R5 | Paywall next to the embed breaches III.F.3.a, risking API access | Med | Med–High | Counsel or YouTube guidance | Keep the embed free to watch; monetise analysis of the user's file; ship M12 only after sign-off | same |
| R6 | Amber weights cannot be cleared, forcing rework | Med | Med | Author replies; counsel position | Green alternatives (Spleeter, own CC-BY-trained models); retrain on own data; provider interfaces | `research/ml/datasets-metrics-and-licensing.md` |
| R7 | Unit economics: vendor separation at scale exceeds revenue; self-hosting needs licensed multitracks of unknown cost | High (at scale) | High | Cost per paying user above the D10 margin; vendor bill growth | One stem per song; published caps; web billing; start licensing early; migrate stage by stage | `research/ml/deployment-and-inference.md`, `research/market/pricing-and-business-models.md` |
| R8 | Vendor dependency: price or terms change; Music.AI is Moises' business arm, so a competitor | Med | Med–High | Term sheet; price changes | Two vendors behind the `separate()` interface; in-house migration path | `research/ml/source-separation-model-comparison.md` |
| R9 | Competitors converge (Songsterr AI plus a curriculum; Muse Group with Hal Leonard; Moises adding tabs) | Med | Med–High | Release notes | Differentiate on level fit, practice loop and trust; ship fast | `research/market/competitor-landscape.md` |
| R10 | Learners stagnate and quit (≈1 in 4 stagnate; nearly half cite time) | High | High | Week-4 retention; sessions per week | Song-driven goals; 10–15 min sessions; tempo-reached progress; forgiving goals; own library never removed | `research/ux/onboarding-retention-motivation.md` |
| R11 | Mic scoring false negatives destroy trust (v1) | High (if unconstrained) | Med | Override rate | Constraints, calibration and override (D12); never block progress | `research/ux/practice-tool-patterns.md` |
| R12 | Slow-down artefacts at 0.5× | Med | Med | Prototype 7 | Rubber Band commercial licence or offline pre-render | `research/ml/playback-time-stretch-pitch-shift.md` |
| R13 | Web app underperforms on phones (AudioWorklet CPU, latency, pedal events) | Med | Med | QM6/QX2 device tests | Native v1 sooner; tablet-first practice layout | `research/product/recommendations-and-decisions.md` |
| R14 | Billing and trust complaints (the industry's top complaint) | Med | Med–High | Refund and complaint rate | Billing hygiene (roadmap M16) | `research/users/voice-of-customer-pain-points.md` |
| R15 | Privacy and minors' data (teen persona) unresearched | Med | High | Counsel review | Research before launch (QL6); minimise data; no training without opt-in | (gap) |
| R16 | Legal landscape shifts (§ 1201 rulings, AI cases, EU rules) | Med | Med | Case dockets | Counsel monitoring (QL13); designs never touch YouTube audio | `research/legal/youtube-copyright-and-platform-policy.md` |
| R17 | User evidence is biased (BassBuzz plus review sites; Reddit missing), so personas may be mis-prioritised | High | Med | Interview findings diverge | QU2–QU4 interviews before roadmap lock | `research/users/voice-of-customer-pain-points.md` |
| R18 | Model churn: Demucs upstream frozen; community checkpoints churn | Med | Low–Med | Repo activity | Pin by file hash; model registry; provider interfaces | `research/ml/deployment-and-inference.md` |

### 4. Claims resting on one source or unverified (most decision-relevant)
| # | Claim | Where used | Status | Why it matters | How to verify |
|---|---|---|---|---|---|
| 1 | Self-hosted cost of $0.0013–0.0044 per song-minute on an L4 | `research/ml/deployment-and-inference.md`, D6, D10 | **Assumption:** RTF 0.1 on L4. The only measurement is RTF 0.037 on an RTX 4090 including Demucs. L4 price corroborated by Modal and AWS/Vantage | Every self-hosting and margin figure | Prototype 4 |
| 2 | Music.AI bills each stem as a separate $0.07/min line item | `research/ml/pipeline-overview.md`, D6 | Not stated on the pricing page | 4-stem cost of ~$0.28 vs ~$1.12 per song | Vendor quote (QM8) |
| 3 | Moises does not accept YouTube links | `research/market/competitors/moises.md`, `research/market/feature-matrix.md` | The market docs relied on a help article they could not open (HTTP 403; search snippet). The legal doc opened a *different* Moises help article that refuses streaming-service URLs on copyright and DRM grounds. Streaming refusal is corroborated; the YouTube-specific wording rests on a snippet | Competitive gap claim | Re-fetch the help article |
| 4 | Songsterr Plus price | `research/market/competitors/songsterr.md`, `research/market/pricing-and-business-models.md` | Conflict: $2.99 (web Plus page) vs $9.99 (App Store); unresolved | Price-band anchor | QK5 |
| 5 | Deliberate practice explains ~21% of variance in music (88 studies) | `research/ux/learning-science-principles.md` | Bibliographic record plus APS press summary; the full Macnamara 2014 paper was not opened. The 2019 replication is tier 1 | Design rule "quality over quantity" | Read the paper |
| 6 | Duke et al. 2009: strategy, not practice time, predicted next-day ranking | `research/ux/learning-science-principles.md`, `research/ux/practice-tool-patterns.md` | Abstract via search excerpt plus a secondary summary (journal page 403) | Loop-centred design rationale | Read the full text |
| 7 | "90% of beginners quit within a year" | `research/users/personas.md`, `research/market/competitor-landscape.md` | Fender CEO statement (Fortune 2017); no methodology; Fender newsroom 403 | Retention framing only; do not use as a rate | QU12 |
| 8 | Fender 2018 figures (61% want songs; 33% not growing fast enough) | `research/users/personas.md`, `research/users/jobs-to-be-done.md` | 12fret reprint of a company release; no sample size or dates | Persona goals | QU12 |
| 9 | FLVTO/2conv $82.9M default judgment | `research/legal/youtube-copyright-and-platform-policy.md` | Single press source (TorrentFreak) | Illustrates ripping exposure; decision unchanged either way | Court docket |
| 10 | Chordify has publisher licensing deals | `research/market/competitors/chordify.md` | Techleap profile only; the legal doc marks it unverified | Precedent for chord-display licensing | QK9 |
| 11 | Piano transcription drops 5–15 onset-F1 points on real recordings | `research/ml/transcription-piano.md`, `research/ml/pipeline-overview.md` | Inference from robustness studies, not measured | Piano timing (D11) | QM14 |
| 12 | Vendor separation quality (Music.AI "+15.8% SDR", AudioShake instrument models; MVSep leaderboard) | `research/ml/source-separation.md` | Vendor self-claims or self-reported private sets | Vendor choice | Prototype 1 |
| 13 | Community pain points and their frequency | `research/users/voice-of-customer-pain-points.md` | **Reddit inaccessible.** Evidence is BassBuzz (one community) plus Trustpilot and App Store samples (skewed; e.g. Moises 1.7 Trustpilot vs 4.7 App Store) | Persona priority; roadmap | QU2–QU4 |
| 14 | Fender Songs and Yamaha NoteStar shutdowns; Jammit failure | `research/market/competitor-landscape.md` | Search snippets (403) and one forum post | "Licensed-content fragility" lesson | QK7 |
| 15 | Yousician mic troubleshooting guidance | `research/ux/practice-tool-patterns.md` | Search excerpts; support pages 403 | Mic-scoring design | Re-fetch |
| 16 | Duolingo: 7-day streak users 3.6× more likely to finish a course | `research/ux/onboarding-retention-motivation.md` | Company blog; association only | Streak experiment design | Literature check |
| 17 | 30% store fee | `research/market/pricing-and-business-models.md`, D10 | Placeholder; not researched | Margin math; D9 | QK2 |
| 18 | Rubber Band £590 tier permits App Store distribution | `research/ml/playback-time-stretch-pitch-shift.md` | Not stated on the licence page | DSP fallback cost | QL8 |
| 19 | Licence conflicts: GuitarSet, Groove MIDI, YourMT3 (GPL-3.0 vs Apache-2.0 on HF), Essentia models (NC-SA vs NC-ND), a GPL mention in the Basic Pitch README | ML topic docs | Sources disagree | Register tiers | QM9, QM10 |
| 20 | Other conflicts: SwiftF0 parameter count (14,386 vs 95,842); Fender "67% watch weekly" wording; Riffstation acquisition date; Chordify free cap (2 vs 3 songs/day); YouTube ToS effective date by locale | various | Unresolved conflicts | Minor | Desk |

### 5. Known research gaps
- **Search budget exhausted** before these were checked:
  - a 2024–26 frame-level instrument-activity benchmark;
  - post-Oct-2025 status of the Suno/Udio claims, the Bartz settlement amount and GEMA suits;
  - YouTube enforcement against third-party clients.
- **Blocked or unreadable sources:**
  - Reddit (all target subreddits).
  - Fender newsroom and Fender Play site (403).
  - Yousician support (403) and plans page (JavaScript-rendered).
  - Moises help article (403) and pricing (login-gated).
  - Chordify site (403); Melodics pricing (404); Ultimate Guitar's own pages; Skoove pricing.
  - JustinGuitar Community, TalkBass, The Fretboard and Jazz Guitar Forum (403).
  - Apple HIG (JavaScript-rendered); SAGE journal page for Duke 2009 (403); ENST-Drums licence page; some App Store IDs (404).
- **Not researched at all:**
  - privacy and data protection (GDPR, COPPA, teens);
  - tax and VAT;
  - accessibility law beyond WCAG;
  - store and payment fees;
  - cross-platform app frameworks;
  - browser audio and mic latency;
  - current market size;
  - B2B and teacher markets;
  - copyright outside US/EU/UK;
  - AudioShake and élastique pricing.
- **Not measured** (prototypes needed):
  - phone timings and battery;
  - phone-mic scoring accuracy;
  - L4 RTF;
  - transcription on separated stems;
  - Signalsmith at 0.5×;
  - end-to-end chain quality.
- **Thin evidence types:**
  - controlled tab-vs-notation studies;
  - music-specific chunking, slow-practice and session-length studies;
  - retention mechanics in music apps;
  - drummer and singer user evidence.

### 6. Contradictions found between docs, and their resolutions
These were found during synthesis; the corrective passes applied the resolutions to the topic docs (completed 2026-10-20). **If any doc still carries the older wording, the resolution here governs.**

| # | Contradiction | Resolution |
|---|---|---|
| C1 | **Input source.** Some ML, user and UX wording treated YouTube-sourced audio as pipeline input. Examples: "paste a link" import, "real YouTube-style inputs", source IDs as cache keys. The legal doc rules out fetching or capturing YouTube audio (III.E.1, III.I.7, § 1201 exposure) | Input is **user-provided audio/video files or the user's own recordings** (Designs A, E). The YouTube IFrame embed is a **visual reference only**, with no audio access; sync comes from user syncpoints (Design B). "YouTube-style" in test plans means matching the *characteristics* (lossy ~128 kb/s, loud masters, live rooms) with lawfully obtained audio. A pasted YouTube link opens the embed and prompts for the user's file; it is not an import |
| C2 | **Caching.** ML deployment and separation docs proposed dedupe/cache keys per source video or audio hash without user scope. The pricing doc proposed "cache and share results per recording" across users. The legal doc says a shared cache looks like Splitune's own distribution | **Per-user storage; cache keys include `user_id`**: `hash(user_id, audio_hash, stage, model_id@version, params)`. **No cross-user cache until counsel approves.** After sign-off, share only non-protectable metadata (tempo, key, section times). Unit economics in D6/D10 assume no sharing |
| C3 | **On-device vs server.** Legal Design A prefers on-device processing; ML recommends server separation for v1 | Design A explicitly allows server-side processing with private per-user storage. On-device separation is revisited after a phone benchmark (RTF ≲1), or if counsel requires audio never to leave the device |
| C4 | **Self-hosted cost ranges.** `research/ml/deployment-and-inference.md` TL;DR gives $0.0002–0.002 per song-minute; `research/ml/pipeline-overview.md` gives $0.0013–0.0044 | Not a real conflict: different GPUs and utilisation (RTX 4090 community pricing vs L4 at 100–30% utilisation). Plan with the L4 range |
| C5 | **Moises import.** Market and legal docs cite different Moises help articles | See §4 row 3 |

Residual pre-resolution wording found at synthesis time was **resolved on 2026-10-20** in `research/ml/deployment-and-inference.md` (dedupe key now includes `user_id`; cost figures assume no cross-user cache), `research/ml/source-separation-model-comparison.md` (clips with YouTube-like characteristics, lawfully obtained), `research/market/pricing-and-business-models.md` (shared-results lever blocked pending counsel; TL;DR ceiling aligned to the ~$0.28 break-even used in D10), `research/market/feature-matrix.md` (Splitune "link import" = embed as reference plus user-supplied audio), `research/users/jobs-to-be-done.md`, `research/users/user-journeys-and-flows.md` and `research/ux/onboarding-retention-motivation.md` (link steps are embed/reference only; audio is the user's file or recording).

If any other passage still reads otherwise, C1/C2 govern.

### 7. Research-plan coverage (folded from the working plan)
The working plan defined wave 1 (topic docs), wave 2 (pipeline overview, glossary, sources) and wave 3 (product docs, this doc, README). Status of its key questions:

| Workstream | Key question from the plan | Status | Where answered / what remains |
|---|---|---|---|
| ML | Separation leaders, stems, speed, licences; 6-stem quality | Answered (vendor quality open) | `research/ml/source-separation.md`, `research/ml/source-separation-model-comparison.md`; QM1 |
| ML | Instrument detection state | Partially answered (low confidence; frame-level gap) | `research/ml/instrument-recognition.md`; QM13 |
| ML | Production-ready transcription per instrument, with licences | Answered, with licence unknowns | Transcription docs; QM9 |
| ML | Chords/beats/key/structure models and licences | Answered (key detector gap) | `research/ml/chords-beats-key-structure.md`; QM19 |
| ML | Do visual cues help? | Answered: research-grade; piano only in constrained setups | `research/ml/video-and-audio-visual-analysis.md` |
| ML | Time-stretch engines | Answered (0.5× quality open) | `research/ml/playback-time-stretch-pitch-shift.md`; QM6 |
| ML | On-device vs server, cost per song-minute | Answered with an assumption (L4 RTF) | `research/ml/deployment-and-inference.md`; QM5 |
| ML | Reference pipeline, alternatives, prototype list | Answered | `research/ml/pipeline-overview.md` |
| Legal | YouTube ToS, API, IFrame rules; copyright/DMCA; rulings; app stores; competitor handling; ≥2 compliant designs | Answered (counsel review required) | `research/legal/youtube-copyright-and-platform-policy.md`; QL1–QL15 |
| Market | ≥10 apps across categories; failures; matrix; gap | Answered (22 products) | `research/market/` |
| Users | Drop-off data; adult-learner studies; subreddit themes; review themes; personas, JTBD, journeys | Partially answered: **subreddit themes not obtained** | `research/users/`; QU3 |
| UX | Learning science; practice patterns; display; hands-busy; onboarding; WCAG; colour-blind and left-handed; prioritised feature set | Answered (several low-confidence areas) | `research/ux/`; `research/product/feature-roadmap-beginner-to-intermediate.md` |

## Implications for Splitune
- **Run P0 items before writing production code.** The four counsel questions, vendor terms, Prototypes 1–4 and 7, and the file-step and pricing tests all decide MVP scope (see the plan in `executive-summary.md`).
- **Treat the single-source list as a to-do list,** not background. Rows 1, 2, 4 and 17 directly change the margin math in D10.
- **Re-baseline after the first cohort.** Several decisions are explicitly tied to signals here, such as file-step drop-off, override rate and correction rate.

## Open questions
- Should this register become a living tracker (issue tracker or database) once the team exists? Recommended; keep this doc as the snapshot dated 2026-10-20.

## Sources
Cross-linked docs only; primary citations live in each: `research/product/recommendations-and-decisions.md`, `research/product/feature-roadmap-beginner-to-intermediate.md`, `executive-summary.md`, `research/legal/youtube-copyright-and-platform-policy.md`, `research/ml/pipeline-overview.md`, `research/ml/source-separation.md`, `research/ml/source-separation-model-comparison.md`, `research/ml/instrument-recognition.md`, `research/ml/transcription-general.md`, `research/ml/transcription-guitar-and-bass-tabs.md`, `research/ml/transcription-piano.md`, `research/ml/transcription-drums.md`, `research/ml/transcription-vocals-melody.md`, `research/ml/chords-beats-key-structure.md`, `research/ml/video-and-audio-visual-analysis.md`, `research/ml/playback-time-stretch-pitch-shift.md`, `research/ml/deployment-and-inference.md`, `research/ml/datasets-metrics-and-licensing.md`, `research/market/competitor-landscape.md`, `research/market/feature-matrix.md`, `research/market/pricing-and-business-models.md`, `research/market/competitors/moises.md`, `research/market/competitors/songsterr.md`, `research/market/competitors/chordify.md`, `research/market/competitors/ultimate-guitar.md`, `research/users/personas.md`, `research/users/jobs-to-be-done.md`, `research/users/user-journeys-and-flows.md`, `research/users/voice-of-customer-pain-points.md`, `research/ux/practice-tool-patterns.md`, `research/ux/learning-science-principles.md`, `research/ux/music-display-ui.md`, `research/ux/hands-busy-and-device-context.md`, `research/ux/onboarding-retention-motivation.md`, `research/ux/accessibility.md`.
