---
title: Splitune research knowledge base (index)
workstream: product
last_researched: 2026-10-20
confidence: medium
---

# Splitune research knowledge base

## Purpose
`docs/` is the research foundation for Splitune, a planned app that helps a learner learn their instrument's part of a song they choose. It isolates the part, works out what is played, and wraps the result in practice tools that take a beginner toward intermediate skill.

The docs record what the evidence says as of **2026-10-20**:
- ML models and licences;
- legal and platform constraints;
- competitors and pricing;
- users;
- practice UX;
- the product decisions that follow from all of the above.

They were written as primary context for the engineering and design work that followed, before anything was built; the choices they left open are now made in `docs/specs/`, and what has been built is in `docs/status.md`. Research facts are not updated as the build moves on. **Nothing here is legal advice.** Every content-rights point needs qualified counsel.

## How to use this knowledge base
- **Start from the decisions.** `research/product/recommendations-and-decisions.md` holds D1–D13, each with its evidence, confidence and what would change it. Follow its cross-links to the topic doc that holds the primary citations.
- **Two resolutions are binding for all work, whatever older wording a doc may contain:**
  1. **Input is the user's own audio/video files or recordings, never a YouTube stream.** A YouTube video can appear only as an embedded visual reference with no audio access (legal Designs A, B and E).
  2. **All stems, transcriptions and edits are stored per user.** There is no cross-user cache until counsel approves.

  Details are in `open-questions-and-risks.md` §6.
- **Before coding a pipeline stage,** read its row in `research/ml/pipeline-overview.md` and check the model's licence tier in `research/ml/datasets-metrics-and-licensing.md`. Red never ships; amber needs recorded counsel sign-off (D8).
- **Before relying on a number,** check whether it appears in the single-source or unverified list in `open-questions-and-risks.md` §4.
- **Evidence vs inference.** Inline links mark evidence. "Inference" and "recommendation" mark analysis. Targets labelled "proposed" are not measurements.
- **Terms** are defined in `glossary.md`. All URLs, with tier and use, are in `sources.md`.

## Reading order
**Engineer starting the ML prototype**
1. `executive-summary.md`
2. `research/ml/pipeline-overview.md`: stage table, the seven prototypes with pass/fail gates, and the confidence contract
3. `research/ml/datasets-metrics-and-licensing.md`: licence tiers and metric definitions
4. `research/ml/source-separation.md`, then `research/ml/source-separation-model-comparison.md` (Prototype 1)
5. `research/ml/transcription-general.md`, then `research/ml/transcription-guitar-and-bass-tabs.md` (Prototypes 2 and 3)
6. `research/ml/deployment-and-inference.md` (Prototype 4) and `research/ml/playback-time-stretch-pitch-shift.md` (Prototype 7)
7. `research/legal/youtube-copyright-and-platform-policy.md`: the TL;DR and the "Data handling" section
8. Decisions D2–D8 in `research/product/recommendations-and-decisions.md`

**Designer**
1. `executive-summary.md`
2. `research/users/personas.md`, `research/users/jobs-to-be-done.md`, `research/users/user-journeys-and-flows.md`
3. `research/ux/practice-tool-patterns.md`: patterns plus the prioritised feature table
4. `research/ux/learning-science-principles.md`, `research/ux/music-display-ui.md`, `research/ux/hands-busy-and-device-context.md`, `research/ux/accessibility.md`, `research/ux/onboarding-retention-motivation.md`
5. `research/product/feature-roadmap-beginner-to-intermediate.md`
6. `research/legal/youtube-copyright-and-platform-policy.md` §2 (embed rules: no overlays, ≥200×200 px)

**Founder / PM**
1. `executive-summary.md`
2. `research/product/recommendations-and-decisions.md`
3. `open-questions-and-risks.md`
4. `research/market/competitor-landscape.md`, `research/market/pricing-and-business-models.md`, `research/market/feature-matrix.md`
5. `research/legal/youtube-copyright-and-platform-policy.md`
6. `research/users/voice-of-customer-pain-points.md`
7. `research/product/feature-roadmap-beginner-to-intermediate.md`

## Specs (formerly "implementation docs")
`docs/specs/` turns this research into a build plan: verified tech stack, architecture, data model, API and analysis contracts, ML pipeline, music algorithms, client audio engine, practice screen, billing (free vs paid), privacy/DMCA, security, testing, operations, browser compatibility and a phased delivery plan (Phase 0 prototypes → MVP → beta → v1). It currently targets a **personal mode** (Railway Hobby for app + Postgres, Cloudflare R2 for files, ML on the owner's Mac or Windows PC) with mock payments and no copyright gating (`specs/25-personal-mode.md`); the commercial design is kept as a dormant path. Start at `specs/README.md`.

## Index
Confidence is taken from each doc's frontmatter.

### Top level and product
| Doc | Summary | Confidence |
|---|---|---|
| `README.md` | This index: purpose, reading order, top findings, conventions | medium |
| `executive-summary.md` | One-page synthesis of all workstreams: thesis, pipeline, top three risks, next 4–6 weeks | medium |
| `research/product/recommendations-and-decisions.md` | ADR log D1–D13: input sources, separation, transcription, beat/chord stack, DSP, cost model, data handling, licensing, platform, pricing, launch instruments, mic scoring, rendering | medium |
| `research/product/feature-roadmap-beginner-to-intermediate.md` | MVP / v1 / later feature tables tied to needs, evidence and dependencies; "not in MVP" list; proposed measurement plan | medium |
| `open-questions-and-risks.md` | Deduplicated open questions with method and priority; risk register; single-source claims; research gaps; resolved contradictions | medium |
| `glossary.md` | Definitions of music, MIR/ML, evaluation, licensing/legal and UX terms, each pointing to its owning doc | high |
| `sources.md` | Master bibliography of every cited URL, with tier, access date and the docs that use it | high |

### ML / AI
| Doc | Summary | Confidence |
|---|---|---|
| `research/ml/pipeline-overview.md` | Reference pipeline (v1 placement), stage-by-stage component/licence/readiness table, three alternative pipelines, ordered prototypes with gates, confidence contract | medium |
| `research/ml/source-separation.md` | Separation architectures and benchmarks; guitar/piano weakness (`htdemucs_6s` 3.07/1.60 dB); failure modes; vendor landscape | medium |
| `research/ml/source-separation-model-comparison.md` | 17-row model and vendor table: quality, size, code/weights/data licences, commercial verdict | medium |
| `research/ml/instrument-recognition.md` | Instrument presence and activity: taggers (EfficientAT, PANNs), stem-energy gating, sub-type needs; frame-level benchmarks missing | low |
| `research/ml/transcription-general.md` | Transcription landscape (Basic Pitch, MT3, YourMT3+), metrics, stems vs mixture, path from MIDI to notation, renderers | medium |
| `research/ml/transcription-guitar-and-bass-tabs.md` | Guitar/bass notes and tablature, fret assignment (lowest-fret, Fretting-Transformer, MIDI-to-Tab), techniques, bass tracker floors | medium |
| `research/ml/transcription-piano.md` | Piano models (Transkun, Kong, hFT), domain gap, hands/staff, simplification | medium |
| `research/ml/transcription-drums.md` | Drum transcription classes, datasets, ADTOF licence problem, CC-BY training route, GM mapping | medium |
| `research/ml/transcription-vocals-melody.md` | f0 trackers (RMVPE, SwiftF0, PESTO, CREPE), singing notes, Whisper lyrics, range and transposition | medium |
| `research/ml/chords-beats-key-structure.md` | Beat This! (MIT), All-In-One sections, chord-recognition accuracy ceiling, key detection gap, madmom exclusion | medium |
| `research/ml/video-and-audio-visual-analysis.md` | AV separation and video fingering are research-grade; MediaPipe hands; YouTube frames off-limits | medium |
| `research/ml/playback-time-stretch-pitch-shift.md` | Signalsmith Stretch vs Rubber Band vs platform APIs; mix-then-stretch architecture; listening-test design | medium |
| `research/ml/deployment-and-inference.md` | On-device vs server, runtimes, GPU prices and cost per song-minute, async job architecture | medium |
| `research/ml/datasets-metrics-and-licensing.md` | Code/weights/data licence framework, green/amber/red tiers, dataset catalogue, metric definitions | medium |

### Legal
| Doc | Summary | Confidence |
|---|---|---|
| `research/legal/youtube-copyright-and-platform-policy.md` | YouTube ToS and API policies, embed rules, copyright/DMCA, AI fair-use cases, app-store policy, competitor postures, compliant designs A–F′, UGC and data handling (not legal advice) | medium |

### Market
| Doc | Summary | Confidence |
|---|---|---|
| `research/market/competitor-landscape.md` | Four competitor clusters, failures and shutdowns, the differentiation gap | medium |
| `research/market/feature-matrix.md` | 22 products × 16 capabilities with verification markers | medium |
| `research/market/pricing-and-business-models.md` | Price table, business-model types, licensing as a cost, server-cost anchors, unit-economics sketch | medium |
| `research/market/competitors/anytune.md` | Apple-platform slow-downer; benchmark for playback quality at slow speeds | medium |
| `research/market/competitors/capo.md` | On-device chords/beats/key for own files; local-first precedent | medium |
| `research/market/competitors/chord-ai.md` | Mobile YouTube/stems/chords/MIDI bundle at $69.99/yr | medium |
| `research/market/competitors/chordify.md` | Link to synced chord diagrams; publisher-partnership claim | medium |
| `research/market/competitors/fender-play.md` | Brand-led video curriculum with MatchMySound feedback | medium |
| `research/market/competitors/flowkey.md` | Piano video plus Wait Mode; mic-detection complaints; Classic vs Premium licensing tiers | medium |
| `research/market/competitors/guitar-pro.md` | De facto tab editor and file format; export target | medium |
| `research/market/competitors/justinguitar.md` | Trusted beginner-course app; benchmark for beginner guidance | low |
| `research/market/competitors/klangio.md` | Instrument-specific AI transcription from links and files; ticket pricing backlash | medium |
| `research/market/competitors/lalal-ai.md` | Per-minute stem separation; commodity price anchor | medium |
| `research/market/competitors/melodics.md` | Drum lessons with mic/e-kit feedback at $179.99/yr | low |
| `research/market/competitors/moises.md` | Category leader for stems plus practice tools; no tab or curriculum | medium |
| `research/market/competitors/musora-drumeo-pianote.md` | Premium human-taught platform at about $279/yr | medium |
| `research/market/competitors/ripx-daw.md` | Desktop AI DAW with note-level extraction | medium |
| `research/market/competitors/rocksmith-plus.md` | Licensed-catalog real-instrument game; licensing pain; poor Steam reception | medium |
| `research/market/competitors/simply-piano-guitar.md` | Largest beginner mic-feedback apps; billing and detection complaints | medium |
| `research/market/competitors/skoove.md` | Piano lessons with AI feedback; limited verified data | low |
| `research/market/competitors/songsterr.md` | UGC tab library plus AI link-to-tab; closest shipped link-to-notation competitor | medium |
| `research/market/competitors/soundslice.md` | Synced notation player, teacher tools, auto stems; UI benchmark and possible partner | medium |
| `research/market/competitors/transcribe.md` | Desktop manual-transcription assistant; baseline for correction tools | medium |
| `research/market/competitors/ultimate-guitar.md` | Largest tab community; licensed Official tabs; content moat | low |
| `research/market/competitors/yousician.md` | Multi-instrument gamified curriculum with listening feedback | medium |

### Users
| Doc | Summary | Confidence |
|---|---|---|
| `research/users/personas.md` | Six evidence-graded personas (guitar and bass strongest; drummer medium-low; singer provisional); provenance of the "90% quit" claim | medium |
| `research/users/jobs-to-be-done.md` | Core job plus eight sub-jobs, workarounds and failures; trust is the main unmet outcome | medium |
| `research/users/user-journeys-and-flows.md` | End-to-end journey with friction and mitigations; alternate flows (import fails, low confidence, offline); first-session flow | medium |
| `research/users/voice-of-customer-pain-points.md` | Eight pain themes from Trustpilot, App Store and BassBuzz with frequency/severity estimates; Reddit gap | medium |

### UX
| Doc | Summary | Confidence |
|---|---|---|
| `research/ux/practice-tool-patterns.md` | Loop, speed trainer, count-in, stems, sync, wait mode, mic scoring; prioritised feature candidates (P0–P3) | medium |
| `research/ux/learning-science-principles.md` | Ten principles (P1–P10) with evidence strength: deliberate practice, segmenting, tempo, spacing, feedback, cognitive load, SDT, gamification | medium |
| `research/ux/music-display-ui.md` | Display types by instrument, confidence UI, rendering libraries (alphaTab etc.), formats, drum notation | low |
| `research/ux/hands-busy-and-device-context.md` | Target sizes, pedals as keyboards, voice limits, reading distance, phone vs tablet vs desktop | medium |
| `research/ux/onboarding-retention-motivation.md` | First-session aha, goals, progression, retention mechanics and their evidence, why learners quit | low |
| `research/ux/accessibility.md` | WCAG 2.2 AA criteria applied, Okabe-Ito palette, screen readers, left-handed mirroring, visual metronome, reduced motion | medium |

## Top 10 findings
1. **Guitar and piano are the hardest stems, and they are core instruments.** The open model `htdemucs_6s` scores 3.07 dB (guitar) and 1.60 dB (piano) on MoisesDB. Vendors publish no per-instrument numbers, and SDR does not predict what listeners prefer. A blind listening test must pick the vendor (`research/ml/source-separation.md`).
2. **Licensing, not accuracy, is the binding ML constraint.** Code is mostly MIT or Apache-2.0, but strong weights are trained on NC data or carry no stated licence. Beat This! (MIT code and weights) and Whisper are rare clean cases (`research/ml/datasets-metrics-and-licensing.md`).
3. **Specialist models on stems beat multi-instrument models.**
   - MT3 scores 32 zero-shot on GuitarSet; Basic Pitch scores 79.
   - Simple-material tabs are already about 98% accurate with lowest-fret assignment, so an in-house fret DP is enough for v1.
   - Sources: `research/ml/transcription-general.md`, `research/ml/transcription-guitar-and-bass-tabs.md`.
4. **Chords are an editable draft.** Accuracy is about 78–84% majmin, roughly one bar in six wrong. Confidence display and one-tap correction are core UX, not polish (`research/ml/chords-beats-key-structure.md`, `research/ux/music-display-ui.md`).
5. **Fetching YouTube audio is out.**
   - The Developer Policies ban caching and audio separation (III.E.1, III.I.7). Apple 5.2.3 bans downloading. Stream-ripping is being litigated under § 1201.
   - The embed may be used only as a visual reference, and Splitune must not charge users to watch it.
   - Source: `research/legal/youtube-copyright-and-platform-policy.md`.
6. **Keep stems and tabs private per user.** A stem implicates the sound recording and a tab the musical work. Shared caches and public tab libraries need licences. Uploads need a DMCA program ($6 agent registration) (`research/legal/youtube-copyright-and-platform-policy.md`).
7. **The market gap is real but narrow.** Link-to-tab (Songsterr AI, Klangio), stems (Moises) and curricula (Yousician, Simply) all exist. No product adapts a user-chosen song to the learner's level and wraps it in a practice loop (`research/market/competitor-landscape.md`, `research/market/feature-matrix.md`).
8. **Trust and billing dominate user pain.**
   - Wrong tabs and chords, muddy bass stems, trial-to-annual billing surprises and paywalled basics.
   - The evidence is BassBuzz plus review sites. Reddit was unreachable.
   - Sources: `research/users/voice-of-customer-pain-points.md`, `research/users/jobs-to-be-done.md`.
9. **Build practice around a bounded loop of a phrase,** with clean passes and tempo reached as the progress metrics. Phone-mic scoring has no published accuracy and is the riskiest feature, so ship self-assessment first (`research/ux/learning-science-principles.md`, `research/ux/practice-tool-patterns.md`).
10. **Economics favour self-hosting; licensing favours vendors.**
    - Self-hosted GPU costs about $0.0013–0.0044 per song-minute, but that assumes RTF 0.1.
    - Vendor separation costs about $0.24–0.28 per 4-minute song for one stem.
    - The break-even point at an $8 plan with 20 songs/month is about $0.28 per song.
    - Sources: `research/ml/deployment-and-inference.md`, `research/market/pricing-and-business-models.md`, D6/D10.

## Top decisions and risks
**Top decisions** (from `research/product/recommendations-and-decisions.md`; all proposed):
- **D1:** launch with Designs A + B + E. F is excluded; F′ is research only.
- **D2:** vendor separation in v1, chosen by Prototype 1. Migrate to an in-house SCNet or RoFormer model trained on licensed multitracks.
- **D7/D8:** per-user storage with user-scoped cache keys and a DMCA program. A green/amber/red licence register is a CI gate, and no NC-trained weights ship without a grant.
- **D9:** responsive web app first, native apps in v1. Confidence is low–medium.
- **D10:** subscription in the $8–12/month band with a published analysis cap and a free first song. No tickets.
- **D11:** guitar and bass notation at launch; the practice player covers any instrument; piano and drums in v1.
- **D12:** mic listen-and-score deferred to v1, with constraints.

**Top risks** (from `open-questions-and-risks.md` §3):
- **R1/R2:** guitar and piano isolation and transcription not good enough. Mitigation: mix-minus, chords-first, fallbacks.
- **R3:** learners will not supply files. Mitigation: example songs, own-recording flows, licensed catalog later.
- **R4/R5:** paid per-user processing and the embed paywall are legally unsettled. Mitigation: counsel before launch.
- **R7:** unit economics at scale. Mitigation: one stem per song, caps, early licensing of training data.
- **R10:** learners stagnate and quit. Mitigation: song-driven goals, short sessions, tempo-based progress.

## Conventions
- **Frontmatter.** Every doc starts with YAML: `title`, `workstream` (`ml` | `legal` | `market` | `users` | `ux` | `product` | `engineering` for `docs/specs/`), `last_researched` (ISO date) and `confidence` (`high` | `medium` | `low`).
- **Skeleton.** Topic and synthesis docs use `## TL;DR`, `## Findings`, `## Implications for Splitune`, `## Open questions` and `## Sources`. This README is an approved deviation.
- **Source tiers.**
  - 1: peer-reviewed papers, official benchmarks, model-author repos.
  - 2: official company pages, docs, terms of service, store listings.
  - 3: reputable industry reports and press.
  - 4: community sources (anecdotal).

  Every non-obvious claim carries an inline link to a URL that was actually opened. Unverified items say so.
- **Licences.** Use SPDX identifiers where they exist, and state the code, weights and training-data licences separately (`research/ml/datasets-metrics-and-licensing.md`).
- **Dates.** `last_researched` and every source's access date are 2026-10-20 for this research pass. Prices, rankings, policies and case statuses are time-sensitive; re-verify anything older than about six months before relying on it.
- **Updating a doc.**
  1. Edit in place, keeping the skeleton.
  2. Set `last_researched` to the new date and adjust `confidence`.
  3. Add new URLs to the doc's `## Sources` as `- [Title](URL) — tier N, accessed YYYY-MM-DD`.
  4. Add the same rows to `sources.md` (`| # | Title | URL | Accessed | Used in |` under the right tier) and update its tier counts.
  5. If a change affects a decision, update the matching D# entry and the risk or question rows in `open-questions-and-risks.md`.
- **Cross-links.** Use backticked paths relative to `docs/`, such as `research/ml/pipeline-overview.md`. Link to the owning doc rather than repeating its content.
