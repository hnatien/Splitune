---
title: Product recommendations and decisions (ADR log)
workstream: product
last_researched: 2026-10-20
confidence: medium
---

# Product recommendations and decisions

ADR-style log of the decisions the research supports. Status of every decision: **proposed**. Evidence lives in the linked docs, which hold the primary citations. A handful of URLs are re-cited here for the numbers that drive a decision; they are copied from those docs. Everything labelled *Recommendation* or *inference* is analysis, not a sourced fact. Owners are roles, because the team is not yet formed. **Nothing here is legal advice.** Every decision that touches content rights is gated on counsel (`research/legal/youtube-copyright-and-platform-policy.md`).

## TL;DR
- **Input (D1).** Input is the user's own files and recordings only (legal Designs A and E). A YouTube video can appear only as an RMF-compliant embed for visual reference, with sync supplied by the user (Design B). Never fetch, capture or analyse YouTube audio or frames (Design F is excluded).
- **Pipeline (D2–D6).** Separation comes from a vendor API in v1, chosen by a blind listening test. Every other stage uses open models with permissive code. Playback DSP is Signalsmith Stretch (MIT) on the client. Self-hosted separation is the critical path for unit economics, but it is gated on licensed training data.
- **Data and licensing (D7–D8).** Store everything per user. Build no cross-user cache until counsel approves. A green/amber/red model register is a release gate. No weights trained on non-commercial (NC) data ship without a written grant.
- **Launch shape (D9–D13).**
  - Platform: a responsive web app first, with native apps in v1. Confidence is low–medium.
  - Business model: subscription at $8–12/month with a published monthly analysis cap. The first song is free end to end.
  - Notation at launch: guitar and bass. The practice player (stems, loops, slow-down, chords) works for any instrument from day one.
  - Mic listen-and-score is deferred to v1, in a constrained form.

## Findings

### Summary of decisions

| # | Decision | Recommendation (short) | Confidence | Gate / owner of open question |
|---|---|---|---|---|
| D1 | Input sources and the "learn from a video" flow | Designs A + B + E at launch; C/D later; F excluded; F′ research only | High (exclude F); medium (B paywall, file-step adoption) | Counsel (paywall III.F.3.a, fair use); PM (file-step activation) |
| D2 | Separation strategy and migration | Vendor API behind a provider interface, picked by Prototype 1; migrate to an in-house SCNet/RoFormer model trained on licensed multitracks | Medium | ML lead (Prototype 1); founder (data licensing budget) |
| D3 | Transcription per instrument | Specialists on stems: Basic Pitch → in-house fret DP (guitar/bass); Transkun → PM2S (piano); in-house 5-class CRNN (drums); RMVPE f0 curve (vocals) | Medium (guitar/bass); low (piano in band, drums, vocal notes) | ML lead |
| D4 | Beat / chord / structure stack | Beat This! (MIT/MIT); All-In-One sections (amber); chords as an editable majmin draft; key from chords; madmom and Essentia excluded | High (beats); medium (chords, sections) | ML lead; design lead (correction UI) |
| D5 | Playback DSP | Signalsmith Stretch (MIT), mix-then-stretch; Rubber Band R3 commercial licence only if the 0.5× test fails | Medium–high (licence); low (0.5× quality) | Client/audio lead |
| D6 | Server vs on-device split, cost model | Server: separation plus analysis as an async job. Client: decode, DSP, rendering, mic f0. Vendor separation only for one stem per song | Medium | Eng lead (Prototype 4); founder |
| D7 | Data handling | Per-user private storage; user-scoped cache keys; DMCA agent and takedown flow; raw uploads auto-expire; no training on user data without opt-in | High (per-user); medium (retention numbers) | Counsel; eng lead |
| D8 | Licensing policy | Green/amber/red register enforced in CI. Red never ships. Amber needs recorded counsel sign-off. NC-trained weights need a grant | High (policy); medium (tier assignments) | ML lead (register); counsel (amber) |
| D9 | Platform | Responsive web app first (practice layout designed for tablet/phone on a stand); native iOS then Android in v1 | Low–medium | PM; eng lead |
| D10 | Business model and price | Freemium subscription, $9.99/mo or $79.99/yr as the starting hypothesis (band $8–12/mo); monthly analysis cap; no tickets | Medium–low | Founder/PM |
| D11 | Launch instruments | Notation: guitar + bass. Practice player: any instrument. v1: piano, drums. Later: vocals view, ukulele | Medium | PM; ML lead |
| D12 | Mic listen-and-score | Defer to v1; MVP uses self-assessed clean passes | Medium–high | ML lead (Prototype 5); design lead |
| D13 | Display and rendering | alphaTab plus a renderer-agnostic note model; per-instrument defaults; confidence as first-class data | Medium | Design lead; client lead |

### D1. Input sources and the "learn from a video" flow
- **Context.**
  - The core job starts from a video: "learn my part of this song from a video" (`research/users/jobs-to-be-done.md`). Competitors Chordify, Songsterr AI, Klangio and Chord ai accept YouTube links (`research/market/feature-matrix.md`).
  - The YouTube API Developer Policies prohibit caching or storing audiovisual content (III.E.1.a). They also prohibit separating or isolating its audio, including "alternate audio tracks" (III.I.7) ([Developer Policies](https://developers.google.com/youtube/terms/developer-policies)).
  - Stream-ripping is being litigated as § 1201 circumvention: Yout v. RIAA is pending in the 2d Cir., and FLVTO drew an ~$83M default judgment (`research/legal/youtube-copyright-and-platform-policy.md`).
- **Options.** Designs A–F′ from the legal doc:

  | Design | What it is | Exposure (inference, not a legal conclusion) |
  |---|---|---|
  | A | User-provided file, on-device or private server processing | Low–medium |
  | B | Embed as visual reference; analysis from a lawful source | Low–medium |
  | C | Licensed catalog | Low |
  | D | Licensed B2B stems | Low with a rights grant; high without one |
  | E | User's own performance | Low |
  | F | Server fetches the YouTube stream | High |
  | F′ | Ambient mic "listen mode" | Medium / unclear |

- **Evidence.**
  - Moises, Capo and Anytune accept only user files. Moises cites copyright and DRM (`research/legal/youtube-copyright-and-platform-policy.md` §6).
  - Apple 5.2.3 bars saving, converting or downloading media from third-party sources without authorization (`research/legal/youtube-copyright-and-platform-policy.md` §5).
  - Users already resort to rippers to get audio, which is a legal hazard Splitune must not encourage (`research/users/voice-of-customer-pain-points.md` §9).
- **Recommendation.** Launch with **A + B + E**.
  - **Flow.**
    1. The user pastes a YouTube URL.
    2. The app shows an RMF-compliant embed: viewport ≥200×200 px, no overlays, notation beside or below the player ([RMF](https://developers.google.com/youtube/terms/required-minimum-functionality)). Speed and A–B loop use only documented IFrame calls (`setPlaybackRate`, `seekTo`).
    3. The app asks for "a file of this recording you own", or offers "record yourself or your teacher".
    4. Analysis runs on that file. The user aligns file and video with tap syncpoints (the Soundslice model).
  - **Without a file:** offer embed plus speed and loop only, and say plainly why no stems or tab are available.
  - **Video frames:** never analysed (`research/ml/video-and-audio-visual-analysis.md`).
  - **Paywall:** must not gate watching the embed (III.F.3.a). Charge for analysis of the user's file and for practice tools, pending counsel.
  - **Copy:** never say "rip" or "download from YouTube". Inducement is the remaining contributory-liability path after *Cox v. Sony*.
  - **Later options:** add C/D as deals allow. Keep F′ as a research spike gated on counsel. F is excluded.
- **Confidence.** High that F is excluded. Medium on the B paywall structure. Medium that learners accept the "bring a file" step: Moises, Capo and Anytune are precedent, but the legal doc notes most YouTube-first learners will not have the file.
- **What would change it.**
  - A written YouTube authorization.
  - A counsel opinion permitting F′.
  - A decision in Yout v. RIAA.
  - Activation data showing the file step kills conversion. That would pull licensed or own-recorded example content (C/E) forward.
- **Owner.** Counsel (legal-doc questions 1, 2, 5); PM (file-step activation metric).

### D2. Separation strategy for v1 and migration path
- **Context.**
  - Guitar and piano are core instruments and also the weakest stems. On MoisesDB, `htdemucs_6s` scores 3.07 dB on guitar and 1.60 dB on piano, and even the oracle IRM reaches only about 5 dB ([MoisesDB paper](https://arxiv.org/pdf/2307.15913)).
  - Vendors publish no per-instrument numbers.
  - SDR does not predict listener preference: in SDX'23 the #3 system by SDR ranked first with professionals ([TISMIR](https://transactions.ismir.net/articles/171)).
  - Strong open weights were trained on NC data (MUSDB18-HQ, MoisesDB) or on undisclosed data (`research/ml/source-separation-model-comparison.md`).
- **Options.**

  | Option | What it is | Status |
  |---|---|---|
  | (a) | Vendor API: AudioShake, Music.AI or LALAL.AI | Licensed per contract |
  | (b) | Self-hosted open checkpoints | `htdemucs` is amber; community RoFormer checkpoints are unclear |
  | (c) | In-house model on licensed multitracks: BS-RoFormer, Mel-RoFormer or SCNet (MIT code) trained via MSST | Months of work; data-gated |
  | (d) | On-device: SCNet-class model or a vendor SDK | No verified phone timings; WASM RTF 1.3–5.9 |

- **Evidence (prices accessed 2026-10-20).**
  - Music.AI lists stems at $0.07/min per stem line item ([Music.AI pricing](https://music.ai/pricing/)).
  - LALAL.AI top-ups cost about $0.06–0.067 per minute, multiplied by the number of stems ([LALAL.AI pricing](https://www.lalal.ai/pricing/)).
  - Self-hosting on an L4 costs about $0.0013–0.0044 per song-minute, but this assumes RTF 0.1, which has not been measured (`research/ml/deployment-and-inference.md`).
  - Time to MVP: weeks for the vendor path, months for the data-gated path (`research/ml/pipeline-overview.md` §3).
- **Recommendation.**
  - **Vendor API in v1**, behind `separate(audio, stems[]) → stems + model_id + version`.
  - **Choose the vendor with Prototype 1** (blind test; gates in `research/ml/pipeline-overview.md` §4).
  - **Request one stem**: the learner's instrument. Derive "mix minus my part" as mixture minus stem. This is inference from `research/ml/source-separation.md`; check the artefacts in the listening test.
  - **Contract terms** must allow per-user retention of stems for repeat practice and must exclude vendor training on uploads.
  - **In parallel:** set up the MSST benchmark harness, open licensing talks for multitracks, and plan to train SCNet. SCNet's CPU time is 48% of HT-Demucs, so it is also the on-device candidate.
  - **Migrate stage by stage** when any of these holds:
    1. Monthly vendor spend exceeds the fixed cost of self-hosting.
    2. Vendor terms block per-user caching.
    3. The in-house model wins the same blind test.
  - **Failure fallback:** return the analysis without stems. Spleeter (MIT weights, green, about 3 dB behind) is an option, labelled "rough". Do not ship `htdemucs` or community checkpoints without counsel sign-off (D8).
- **Confidence.** Medium. High for "vendor first for time to MVP"; low for which vendor.
- **What would change it.**
  - If Prototype 1 fails, the v1 stem menu is vocals, drums and bass plus "mix minus", and guitar/piano isolation is labelled "rough".
  - Vendor pricing or terms.
  - Cost and availability of licensed multitracks.
- **Owner.** ML lead (Prototype 1); counsel and PM (vendor master agreement); founder (data budget).

### D3. Transcription strategy per instrument
- **Context.**
  - Multi-instrument token models collapse on real audio: MT3 scores 32.0 zero-shot on GuitarSet ([GAPS](https://arxiv.org/html/2408.08653v2)).
  - Errors compound across separation, transcription on a bleeding stem, and fret or hand assignment. No benchmark measures that chain (`research/ml/pipeline-overview.md`).
- **Recommendation (v1 component per instrument).**

| Instrument | v1 chain | Key evidence | Licence tier | Fallback |
|---|---|---|---|---|
| Guitar | Basic Pitch on guitar stem → in-house fret-assignment DP (open-position bias, span ≤4 frets, capo/tuning as user input) → alphaTab | Basic Pitch 79.0 onset F1 GuitarSet vs supervised SOTA ~91 (`research/ml/transcription-guitar-and-bass-tabs.md`). Lowest-fret already 98.30% tab accuracy on simple material, 58.11% on jazz, where Fretting-Transformer reaches 72.19% ([Fretting-Transformer](https://arxiv.org/html/2506.14223)) | Basic Pitch amber (low); DP green | Chords + strum view; "rough" banner. Distorted electric is the main unknown |
| Bass | Basic Pitch or CREPE (floor about 32 Hz) on bass stem → octave correction from chord root → same DP, 4/5-string config | Slakh bass onset F1 about 93 (synthetic). **Not SwiftF0**: its 46.875 Hz floor misses open E (41.2 Hz) (`research/ml/transcription-guitar-and-bass-tabs.md`) | Amber (low) | Root-note line from chords |
| Piano | Transkun V2 → PM2S hand/staff split. Skip separation on solo piano | Onset F1 0.983 MAESTRO, 0.922 MAPS, 0.988 SMD ([Transkun](https://github.com/Yujia-Yan/Transkun)). Band-mix stems never measured. Expect 5–15 points lower on real recordings (inference) (`research/ml/transcription-piano.md`) | Amber (MAESTRO CC-BY-NC-SA-4.0 data; weights licence unstated) | Piano roll + chords |
| Drums | 5-class CRNN trained in-house on E-GMD + Groove MIDI + Slakh (all CC-BY-4.0) → GM map; cymbal/hi-hat sub-classes marked approximate | ADTOF 0.87 MDB / 0.84 ENST but CC-BY-NC-SA-4.0 ([ADTOF](https://github.com/MZehren/ADTOF)). E-GMD-trained OaF reaches only 75.19 on MDB (`research/ml/transcription-drums.md`) | Own weights on CC-BY data → green | Drum-lane view with "approximate" flag |
| Vocals | RMVPE f0 curve (server); notes from ROSVOT/Basic Pitch shown only under the curve; live mic SwiftF0/PESTO | RMVPE RPA 95.42 MIR-1K; ROSVOT COnPOff 47.4 out of domain (`research/ml/transcription-vocals-melody.md`) | RMVPE and ROSVOT weights amber | f0 curve only |
| Other (ukulele, violin, winds) | Basic Pitch or a monophonic tracker on a stem; ukulele via the fret DP with re-entrant tuning | Feasibility only (`research/ml/transcription-general.md` §7) | Amber (low) | Chords |

- **Rules.**
  - Output note events with confidence and keep quantization as a separate, re-runnable stage (`research/ml/pipeline-overview.md` §5).
  - Calibrate confidence before shading.
  - Basic Pitch ([repo](https://github.com/spotify/basic-pitch)) is the generic fallback, never the piano default (Fno 0.71 on MAESTRO).
- **Confidence.** Medium for guitar and bass; low for piano in band mixes, drums on real music, and vocal notes.
- **P3 result (2026-10-20, `services/ml/eval/results/p3/2026-10-20.md`).** Fret DP on GuitarSet ground-truth notes: span compliance 100% (pass); string/fret agreement 0.789 in `as_played` mode (comp 0.846, solo 0.636; held-out players 0.747), 0.596 in the beginner-biased `easiest` mode — **gate (≥0.90) not met**. Lowest-fret baseline 0.454. The doc's fail path (roadmap a learned assigner; default rhythm parts to chord diagrams) awaits the owner's decision.
- **What would change it.**
  - Prototype 2 fails for an instrument: show chords plus a piano roll or f0 curve and hide note-exact notation.
  - Prototype 3 fails: add a learned assigner to the roadmap and default rhythm parts to chord diagrams.
  - Model authors grant weights licences, or the ADTOF authors license their weights.
- **Owner.** ML lead.

### D4. Beat, chord and structure stack
- **Beats.** Beat This! (`beat_this` 1.1.0) has MIT code and MIT weights. It scores GTZAN beat F1 89.1 and downbeat F1 78.3 ([repo](https://github.com/CPJKU/beat_this)). The small model is 8.1 MB, so it can produce an instant grid on the client. Derive BPM from the median inter-beat interval and offer a half/double toggle. It is weak on rubato (RWC Classical 77.1).
- **Sections.** All-In-One runs on stems: Harmonix HR.5F .660; it was trained on pop only. Code is MIT, the weights licence is not stated, so it is **amber**.
- **Chords.** consonance-ACE or BTC (checkpoint licences unstated, so amber).
  - Accuracy: majmin 77.8, sevenths 66.0, majmin_inv 75.6, roughly one bar in six wrong on studio pop.
  - Ship a beat-synchronous majmin chart by default, with sevenths behind a toggle.
  - Fuse three inputs: the mixture, the no-drums stem and the bass root.
  - Present it as an **editable draft** with top-k alternatives (`research/ml/chords-beats-key-structure.md`).
- **Key.** Estimate it in-house from the chord histogram plus pitch-class profile. This is unbenchmarked.
- **Excluded.**
  - madmom pretrained models (CC-BY-NC-SA-4.0, [madmom](https://github.com/CPJKU/madmom)), including its stronger key (74.6–85.1) and majmin (~82.9) models.
  - Essentia (AGPL-3.0 library; NC models) without a commercial licence.
  - Chordino (GPL) in distributed clients.
  - BeatNet (CC-BY-4.0) is held in reserve for real-time beats.
- **Confidence.** High for beats; medium for sections and chords.
- **What would change it.**
  - Prototype 6: if majmin is below 0.75 on the best input, make chord correction central to the UX. Any shared or crowd correction is gated by D7.
  - A commercial licence from JKU for madmom.
  - Weights licences from the authors.
- **Owner.** ML lead; design lead (correction UI).

### D5. Playback DSP: Signalsmith Stretch vs Rubber Band
- **Options.**
  - **Signalsmith Stretch** (MIT): C++ core plus an official Web Audio WASM/AudioWorklet build. The author targets 0.75–1.5× ([repo](https://github.com/Signalsmith-Audio/signalsmith-stretch)).
  - **Rubber Band R3** (GPL-2.0-or-later). The commercial licence is a one-time fee: £590 with attribution, £1,490 without (under 10 staff), £9,320 (10+ staff) ([price list](https://breakfastquay.com/technology/license.html)). GPL builds cannot be distributed through app stores.
  - **Platform built-ins.** `AVAudioUnitTimePitch` spectral mode. Android Sonic and browser WSOLA are speech-oriented.
  - **SoundTouch** (LGPL-2.1).
  - **élastique** (price not public).
- **Recommendation.**
  - Use Signalsmith with architecture Option C: mix the selected stems, then run one stretcher. Build one audio graph per platform.
  - Compensate playhead, loop points and video sync by the reported output latency.
  - Run Prototype 7 at 0.5× and 0.75×. If Signalsmith is meaningfully worse than R3 at 0.5×, budget the £590 Rubber Band tier (first confirm with Breakfast Quay that it covers app stores) or offline pre-rendering at fixed speeds (`research/ml/playback-time-stretch-pitch-shift.md`).
  - Do not rely on `preservesPitch` or Sonic for music.
- **Confidence.** Medium–high on the licence choice; low on 0.5× quality, which is untested.
- **What would change it.**
  - Prototype 7 result.
  - CPU cost on mid-range Android and Safari AudioWorklet (also affects D9).
- **Owner.** Client/audio lead.

### D6. Server vs on-device split for v1, and cost model
- **Split (v1).**
  - **On-device:** decode and content hash; instant full-mix playback with loop and slow-down; Signalsmith DSP; rendering. Optionally Beat This! small. Live mic f0 arrives in v1.
  - **Server (async GPU job):**
    - Analysis stages: tagger → vendor separation → beats, sections and chords → per-stem transcription → quantize → notation.
    - Progressive results: beat grid ≤10 s, full results ≤90 s p50 warm (Prototype 4 gates).
    - If separation fails, still return the analysis (`research/ml/deployment-and-inference.md`).
  - On-device separation is revisited only after a phone benchmark: RTF ≲1 at acceptable quality, or legal review requiring that audio stay on the device.
- **Per-song cost.** 4-minute song, one instrument; arithmetic on prices accessed 2026-10-20.

| Item | Unit price | Per 4-min song |
|---|---|---|
| Vendor separation, 1 stem | Music.AI $0.07/min/stem; LALAL.AI ~$0.06–0.067/min/stem | **$0.24–0.28** |
| Vendor separation, 4 stems | same | $0.96–1.12 (if Music.AI bills per stem; billing not stated) |
| Self-hosted remaining stages, L4 at assumed RTF 0.1 | $0.0013–0.0044 per song-minute ([Modal](https://modal.com/pricing) L4 ~$0.80/h; `research/ml/deployment-and-inference.md`) | $0.005–0.018 |
| Full Music.AI stack (stems + chords + beats + sections) | ≈$0.18/min | ≈$0.72 (not recommended) |

- **Fleet sketch.** Illustrative: 10k MAU × N new songs/month × 4 min. Revenue context: 10% paying at $10 would be about $10k/month gross (illustrative only).

| N (songs/user/month) | Song-minutes | Vendor single-stem separation | Self-hosted (all stages) |
|---|---|---|---|
| 4 (assumption) | 160k | ≈ $9.6–11.2k/month | ≈ $0.2–0.7k/month |
| 20 (sketch in `research/ml/deployment-and-inference.md`) | 800k | ≈ $48–56k/month | ≈ $1.1–3.6k/month |

- **Inference from the sketch.**
  - Vendor separation suits beta and an early capped paid cohort, not scale. Self-hosted separation on licensed data is therefore on the critical path from v1 to scale.
  - These figures exclude storage, egress, engineering, on-call and data licensing.
  - They assume **no cross-user cache** (D7).
- **Confidence.** Medium. Prices are tier-2 listings dated 2026-10-20. The L4 RTF is assumed. Per-stem vs per-job billing is unknown.
- **What would change it.** RTF measured in Prototype 4; vendor volume quotes; counsel allowing cross-user reuse of metadata, which would save little because separation dominates cost.
- **Owner.** Eng lead; founder.

### D7. Data handling
- **Recommendation.**
  - **Per-user private storage** for uploads, stems, transcriptions, edits and loops. **No cross-user shared cache until counsel approves.** Even then, share only non-protectable metadata (tempo, key, section times). A shared cache looks like Splitune's own distribution rather than "storage at the direction of a user", and it moves Splitune toward EU art. 17 status.
  - **Cache and idempotency key:** `hash(user_id, audio_hash, stage, model_id@version, params)`, with `audio_hash` computed over decoded PCM (`research/ml/pipeline-overview.md` §5).
  - **Retention.**
    - Auto-delete raw uploads after processing, or after N days of inactivity (N to be set with counsel).
    - Store stems compressed (Opus/AAC) and let them expire after inactivity; they can be re-derived.
    - User deletion cascades to every derived artefact.
    - Refresh or delete YouTube API data (video IDs, titles) within 30 days (III.E.4.c).
  - **DMCA program.**
    - Register a designated agent: $6, renewed every 3 years ([DMCA Directory FAQ](https://www.copyright.gov/dmca-directory/faq.html)).
    - Publish takedown and repeat-infringer policies. Provide a notice form and an email address.
    - A takedown deletes the upload **and** all derived stems and tabs.
  - **Terms of service.** The user warrants rights to the upload. Splitune gets a narrow processing licence. The ToS names prohibited sources (ripped streams).
  - **No training** on uploads or corrections without an explicit, separate opt-in.
  - **Corrections** are versioned and stored apart from model output.
  - **Export and sharing.** Private export to the user is allowed pending counsel; exposure is moderate. Public sharing or a community tab library requires publisher licensing.
- **Gap.** Privacy law has not been researched: GDPR, and COPPA-style rules for the teen persona (`research/open-questions-and-risks.md`).
- **Confidence.** High on the per-user default; medium on retention values.
- **What would change it.** Counsel on § 512(c) scope and metadata reuse; vendor retention terms.
- **Owner.** Counsel; eng lead.

### D8. Licensing policy (model and library register)
- **Policy.**
  - Every model gets a provenance record (`research/ml/datasets-metrics-and-licensing.md`): `name, version, repo_url, code_spdx, weights_licence, weights_url, training_data[], eval{}, tier, reviewer, date`.
  - CI fails on **red**. **Amber** ships only with recorded counsel sign-off.
  - **No weights trained on NC data in production** without a written grant from the rights holder, or a counsel opinion accepting a fair-use/TDM argument for the launch markets.
  - NC datasets are for internal evaluation only, in pipelines separated from training.
- **Register snapshot.** Proposed tiers; verify each before release.

| Tier | Components |
|---|---|
| Green | Beat This! (MIT/MIT; training-data caveat recorded), Whisper (MIT/MIT), Spleeter (MIT/MIT), BeatNet (CC-BY-4.0), PM2S (MIT), in-house fret DP, key estimator and drum CRNN on CC-BY data. Libraries: Signalsmith Stretch (MIT), alphaTab (MPL-2.0, file-level copyleft), OSMD (BSD-3-Clause), music21 (BSD-3-Clause), partitura (Apache-2.0), ONNX Runtime (MIT) |
| Amber (R&D yes; production needs sign-off) | Basic Pitch (low risk), Transkun, hFT, consonance-ACE, BTC, All-In-One, RMVPE, ROSVOT, CREPE and SwiftF0 (weights not separately licensed), PESTO (LGPL-3.0; static-linking duty on mobile), EfficientAT/PANNs/PaSST (AudioSet provenance), `htdemucs`/`htdemucs_6s`, community RoFormer/SCNet checkpoints, Kong piano (CC-BY-4.0 weights but unlicensed inference package), SAM Audio (custom licence), Verovio (LGPL) |
| Red (do not ship) | madmom models (CC-BY-NC-SA-4.0), ADTOF and ADTOF-pytorch weights (CC-BY-NC-SA-4.0), Open-Unmix `umxl` (CC-BY-NC-SA-4.0), MERT (CC-BY-NC-4.0), Essentia models (NC), MIDI2ScoreTransformer and TabCNN repos (no licence), YourMT3 (GPL-3.0 code + NC data). GPL code in a distributed client: Rubber Band without a commercial licence, Chordino, MuseScore. NC datasets in production training: MUSDB18-HQ, MoisesDB, MAESTRO, MedleyDB, MDB Drums, PianoVAM, PIG |

- **Confidence.** High for the policy; medium for individual tiers, because many weights licences are simply unstated.
- **What would change it.** Answers from the authors. Every amber model's open question is "ask the authors" (`research/open-questions-and-risks.md`).
- **Owner.** ML lead (register); counsel (amber sign-off).

### D9. Platform: mobile-first vs web vs desktop
- **Context.** Platform, stack and team are undecided.
- **Evidence.**
  - **Practice context by persona:**
    - P1: 15–30 minutes at home, device on a stand or couch, hands on the guitar. 53% practise ≤2 h/week ([Loudwire](https://loudwire.com/study-who-are-16-million-americans-learned-play-guitar-last-two-years/)).
    - P2: tablet on the music stand.
    - P3: laptop or phone plus headphones through an audio interface.
    - P4: hands and feet both busy.
    - P5: phone in short bursts.

    Source: `research/users/personas.md`.
  - **Device roles** (inference in `research/ux/hands-busy-and-device-context.md`):
    - A phone shows only 1–2 legible bars at a distance.
    - A tablet is the best practice screen.
    - A desktop is best for importing videos and editing transcriptions.
  - **Design A needs a user file.** Import is easiest where the files live (inference).
  - **Web feasibility of v1 client parts:**
    - Signalsmith ships an official WASM/AudioWorklet build.
    - alphaTab runs in browsers and on Android (Kotlin); iOS is not listed as a native target.
    - Basic Pitch has an npm TypeScript port.
    - SwiftF0 runs on ONNX Runtime, including the web build.
    - ONNX Runtime Web's WebGPU support is uneven.
    - One Web Audio graph keeps stems sample-locked.

    Sources: `research/ml/playback-time-stretch-pitch-shift.md`, `research/ml/transcription-general.md`, `research/ml/deployment-and-inference.md`.
  - **Pedals are keyboards,** so web `keydown` works. Whether iOS Safari receives pedal events reliably is untested (`research/ux/hands-busy-and-device-context.md`).
  - **Mic latency.** Musicians need about 10 ms round trip ([Android audio latency](https://developer.android.com/ndk/guides/audio/audio-latency)). Scoring needs only a calibrated constant offset; monitoring needs low latency. Browser mic latency was not researched.
  - **App stores.**
    - Apple 5.2.2 and 5.2.3 are satisfied by Designs A/B ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)).
    - A native app must embed YouTube in the OS WebView and avoid nested iframes (RMF; III.I.21).
    - The 30% store fee in `research/market/pricing-and-business-models.md` is a placeholder and was not researched.
  - **Competitors.** Moises ships on web, desktop, iOS and Android. Soundslice is web-only. Chord ai is iOS and macOS. Curriculum apps are mobile-native (`research/market/feature-matrix.md`).
  - **Discovery** is through short video and search (`research/users/user-journeys-and-flows.md`), which favours shareable web landing pages (inference).
- **Options.**
  1. Native mobile first (iOS, then Android).
  2. Responsive web app (PWA) first.
  3. Desktop app first.
  4. A cross-platform framework (not researched).
- **Recommendation (inference): option 2.**
  - **What it means.** A responsive web app whose **practice mode is designed first for a tablet or phone on a stand**, with the desktop browser as the best import and editing surface.
  - **Native in v1.** Ship native iOS, then Android, when mic scoring (D12), offline practice and store discovery justify it. Reuse the same C++/WASM DSP and ONNX models.
  - **Why:**
    - Every v1 client component has a browser build.
    - One codebase while product–market fit is unknown.
    - No store review or fee during beta, which also helps D10 margins.
    - File import and the YouTube embed are native to the web.
    - Pedal and keyboard input come free.
- **Uncertainty.**
  - Signalsmith's CPU load in mobile Safari's AudioWorklet is unmeasured.
  - Web mic latency and pedal events on iOS are unverified.
  - Personas say the practice device is a phone or tablet, and teens (P5) and pianists (P2) may expect an app-store app. The web build therefore has to be excellent on tablets, not merely responsive.
- **Confidence.** Low–medium.
- **What would change it.**
  - Prototypes 5 and 7 run in mobile Safari and Chrome Android: if Option C DSP exceeds the CPU budget, or mic latency fails, go native earlier.
  - Interviews show the target users will not practise from a phone browser.
- **Owner.** PM; eng lead.

### D10. Business model and price band
- **Evidence.**
  - **Price bands:** utilities $2–10/month; AI transcription $3–25; curricula $8–25; premium human-taught $23–30 (`research/market/pricing-and-business-models.md`).
  - **Anchors:** Chord ai $69.99/yr, Klangio Pro $99.99/yr, Moises Premium $39.99/yr.
  - **WTP:** P1's anchor is about $40–60/yr for a utility; curricula sell at $100–200/yr (`research/users/personas.md`).
  - **Free tiers** are capped by usage. Billing surprises are the most frequent and most severe complaint (`research/users/voice-of-customer-pain-points.md`).
  - **Break-even:** $8 plan, 30% fee, 20 songs means cost must stay ≤$0.28 per song. Vendor single-stem separation ($0.24–0.28) sits right on that line (D6).
- **Recommendation.** A freemium subscription.

  | Tier | What it includes |
  |---|---|
  | Free | Unlimited practice on bundled example songs (Splitune-owned recordings). The first user file processed end to end (stems, loop, slow-down, tab). Practice tools stay free on songs already processed. New analyses are capped. |
  | Paid | Starting hypothesis $9.99/month or $79.99/year (test $8–12/month, $60–100/year). A **published monthly cap** on full-song analyses (start near 15 single-instrument analyses). Extra stems count against the cap. |

  - **Billing hygiene:** no tickets or credits (Klangio's tickets read as bait-and-switch), no lifetime plans tied to content, renewal reminders, one-tap cancel in app and on the web, no feature removal for existing subscribers.
  - **Bill on the web first** (D9).
  - **Margin at 15 analyses on $9.99:**
    - Vendor cost: $3.60–4.20.
    - Net on the web: about $5.8–6.4 before payment-processing fees, which were not researched.
    - Net through a store at the placeholder 30%: about $2.8–3.4, before infrastructure and support.
  - Teacher and B2B plans come later.
- **Confidence.** Medium–low. There is no first-party WTP data. Songs per user per month is unknown. Prices are store listings.
- **What would change it.** A fake-door pricing test; measured songs per user; vendor volume pricing; self-hosted separation (which cuts unit cost about 15–50×).
- **Owner.** Founder/PM.

### D11. Which instruments to launch with
- **Evidence by instrument.**

| Instrument | Separation quality | Transcription readiness | Persona evidence | Market gap |
|---|---|---|---|---|
| Guitar | Weakest open (3.07 dB `htdemucs_6s`); vendor quality unverified | Basic Pitch 79 + buildable DP; distortion unknown | P1 strong, P5 medium | Most contested link-to-tab (Songsterr AI, Klangio, Chord ai). None adapts level or adds a practice loop |
| Bass | Strong (`htdemucs_6s` bass 11.93 dB MoisesDB; BS-RoFormer 11.43 MUSDB), but forum reports of muddy bass on live recordings | Monophonic; ~93 onset F1 on synthetic Slakh; octave errors manageable | P3 strongest pain evidence (BassBuzz) | Learners pay for human transcriptions; "can't hear the bass" |
| Piano | Weakest (1.60 dB) | Best model (Transkun) but amber; band mixes unmeasured | P2 medium | Crowded curricula with mic feedback (flowkey, Simply, Skoove); gap = user-chosen songs |
| Drums | Strong (11.02 dB) | Needs in-house training; ADTOF red | P4 medium-low | Melodics $179.99/yr; drumless play-along is popular |
| Vocals | Strongest | f0 mature, notes weak, lyrics need rights | P6 low | Unresearched |

Sources: `research/ml/source-separation.md`, `research/ml/pipeline-overview.md`, `research/users/personas.md`, `research/market/competitor-landscape.md`.

- **Recommendation.**
  - **MVP notation for guitar and bass.**
    - Guitar defaults to chords plus rhythm for rhythm parts and tab for riffs, with a global fallback to chords.
    - Bass gets note-level tab. It is the best-supported chain end to end.
  - **The practice player is instrument-agnostic from day one.** Stems, mix-minus, loop, slow-down, chords and count-in work for any instrument: drummers get a drumless track and count-in; singers get a vocal-minus track and chords. The product makes no notation claims for those instruments.
  - **v1:** piano (solo-piano path first; Transkun after licence sign-off) and drums (in-house 5-class model).
  - **Later:** a vocal f0 practice view, ukulele, and monophonic strings and winds (feasibility only).
- **Confidence.** Medium.
- **What would change it.**
  - If Prototype 1 fails on guitar stems, guitar leads with chords plus mix-minus and bass becomes the notation hero.
  - If piano passes on band mixes in Prototype 2, piano moves earlier.
  - Interviews could re-rank the personas.
- **Owner.** PM; ML lead.

### D12. Microphone listen-and-score: MVP or defer
- **Evidence.**
  - No published accuracy exists for polyphonic guitar or piano through a phone mic. Vendors write long troubleshooting pages and steer users to headphones and MIDI. Ubisoft discourages Bluetooth (`research/ux/practice-tool-patterns.md`).
  - Missed notes and lenient scoring are a top complaint category for incumbents (`research/users/voice-of-customer-pain-points.md` §5).
  - On-device SwiftF0/PESTO latency is unmeasured (Prototype 5).
  - In the job map, "check my playing" is phase 2 (`research/users/jobs-to-be-done.md`).
  - Learning science favours diagnostic knowledge-of-performance feedback with an override over a bare score (`research/ux/learning-science-principles.md` P7).
- **Recommendation.** **Defer to v1.**
  - **MVP:** a self-assessed clean-pass counter ("Felt clean / Not yet") drives the loop and progress data model. Nothing depends on the mic.
  - **v1,** after Prototype 5 passes (latency <50 ms, RPA ≥90%), with these constraints:
    - Scoring modes: single-note lines (bass, riffs, vocal pitch); chord-level scoring for strummed guitar; piano via MIDI/USB first (wait mode).
    - A calibration step.
    - ±50 ms tolerance, widened at slower tempos.
    - A one-tap "I played it right" override. Never block progress.
    - A headphones prompt and a Bluetooth warning.
    - A tuner, which for bass needs a tracker floor ≤30 Hz.
- **Confidence.** Medium–high.
- **What would change it.**
  - The 50-learner, 3-phone accuracy study in `research/ux/practice-tool-patterns.md` shows acceptable false-negative rates.
  - The MIDI-piano persona becomes a launch persona.
- **Owner.** ML lead; design lead.

### D13. Display and rendering
- **Recommendation.**
  - **Rendering engine:** alphaTab (MPL-2.0). It reads Guitar Pro and MusicXML, renders tab, drums and notation, and has a cursor, looping and audio sync. It fits a web-first build; iOS-native rendering will need a WebView or another renderer.
  - **Note model:** renderer-agnostic, carrying string, fret, finger, confidence, stem ID and model version. Export to alphaTex and MusicXML.
  - **Default view per instrument:**
    - Guitar and bass: tab with rhythm, plus a chord strip.
    - Piano: falling-notes roll adjacent to a keyboard strip. P.I.A.N.O. is the only direct evidence and its samples are small.
    - Drums: grid.
    - Vocals: f0 contour.
  - **Confidence handling:** shading by outline or dash, never colour alone; "report wrong note"; an "Auto-transcribed" provenance label; a global fallback to chords (`research/ux/music-display-ui.md`, `research/ux/accessibility.md`).
- **Confidence.** Medium. Library facts are solid; evidence on which display type helps learners is thin.
- **Owner.** Design lead; client lead.

## Implications for Splitune
- **Build order.**
  1. Evaluation harness and in-house licensed test set (own multitrack and MIDI-captured recordings).
  2. Prototypes 1–4 and 7.
  3. Web practice screen.
  4. Server job.

  The provider interfaces (`separate`, `transcribe`, `chords`) make D2's migration and D8's licence swaps configuration changes rather than rewrites.
- **Order of counsel engagement.** Four items gate MVP launch: the paywall vs III.F.3.a, fair use of paid per-user separation and transcription, § 512(c) scope for derived outputs, and amber-model sign-off. F′ and export can wait.
- **Unit economics and licensing pull in opposite directions** on separation. Budget the licensed-multitrack question early; it decides when self-hosting is possible.
- The feature tiers that follow from these decisions are in `feature-roadmap-beginner-to-intermediate.md`. Risks and open questions are consolidated in `research/open-questions-and-risks.md`.

## Open questions
The full list with owners and methods is in `research/open-questions-and-risks.md`. These are the questions that would flip a decision:
- **D1, D10:** does a subscription unlocking practice tools beside a free embed breach III.F.3.a?
- **D2, D10:** which vendor wins Prototype 1, and on what volume price and retention terms?
- **D6:** what is the real L4 RTF and cold start (Prototype 4)?
- **D9:** does Signalsmith fit the CPU budget in mobile Safari and on mid-range Android?
- **D10:** what do learners pay, and how many songs per month do they analyse?
- **D11:** do learners accept the "bring a file" step?

## Sources
Cross-linked docs (primary citations live there): `research/ml/pipeline-overview.md`, `research/ml/source-separation.md`, `research/ml/source-separation-model-comparison.md`, `research/ml/transcription-general.md`, `research/ml/transcription-guitar-and-bass-tabs.md`, `research/ml/transcription-piano.md`, `research/ml/transcription-drums.md`, `research/ml/transcription-vocals-melody.md`, `research/ml/chords-beats-key-structure.md`, `research/ml/video-and-audio-visual-analysis.md`, `research/ml/playback-time-stretch-pitch-shift.md`, `research/ml/deployment-and-inference.md`, `research/ml/datasets-metrics-and-licensing.md`, `research/legal/youtube-copyright-and-platform-policy.md`, `research/market/competitor-landscape.md`, `research/market/feature-matrix.md`, `research/market/pricing-and-business-models.md`, `research/users/personas.md`, `research/users/jobs-to-be-done.md`, `research/users/user-journeys-and-flows.md`, `research/users/voice-of-customer-pain-points.md`, `research/ux/practice-tool-patterns.md`, `research/ux/music-display-ui.md`, `research/ux/hands-busy-and-device-context.md`, `research/ux/learning-science-principles.md`, `research/ux/accessibility.md`.

URLs re-cited in this doc:
- [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies) — tier 2, accessed 2026-10-20
- [YouTube API Services: Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality) — tier 2, accessed 2026-10-20
- [MoisesDB paper PDF (arXiv:2307.15913)](https://arxiv.org/pdf/2307.15913) — tier 1, accessed 2026-10-20
- [SDX'23 Music Demixing Track (TISMIR)](https://transactions.ismir.net/articles/171) — tier 1, accessed 2026-10-20
- [Music.AI pricing](https://music.ai/pricing/) — tier 2, accessed 2026-10-20
- [LALAL.AI pricing](https://www.lalal.ai/pricing/) — tier 2, accessed 2026-10-20
- [Modal pricing](https://modal.com/pricing) — tier 2, accessed 2026-10-20
- [GAPS (arXiv HTML)](https://arxiv.org/html/2408.08653v2) — tier 1, accessed 2026-10-20
- [Fretting-Transformer (arXiv HTML)](https://arxiv.org/html/2506.14223) — tier 1, accessed 2026-10-20
- [Yujia-Yan/Transkun (GitHub)](https://github.com/Yujia-Yan/Transkun) — tier 1, accessed 2026-10-20
- [MZehren/ADTOF (GitHub)](https://github.com/MZehren/ADTOF) — tier 1, accessed 2026-10-20
- [spotify/basic-pitch (GitHub)](https://github.com/spotify/basic-pitch) — tier 1, accessed 2026-10-20
- [Beat This! repository (CPJKU/beat_this)](https://github.com/CPJKU/beat_this) — tier 1, accessed 2026-10-20
- [madmom repository](https://github.com/CPJKU/madmom) — tier 1, accessed 2026-10-20
- [Signalsmith Stretch repository](https://github.com/Signalsmith-Audio/signalsmith-stretch) — tier 1, accessed 2026-10-20
- [Breakfast Quay commercial licence price list](https://breakfastquay.com/technology/license.html) — tier 2, accessed 2026-10-20
- [U.S. Copyright Office DMCA Directory FAQ](https://www.copyright.gov/dmca-directory/faq.html) — tier 1, accessed 2026-10-20
- [Loudwire: 16 million Americans learned guitar](https://loudwire.com/study-who-are-16-million-americans-learned-play-guitar-last-two-years/) — tier 3, accessed 2026-10-20
- [Android NDK: Audio latency](https://developer.android.com/ndk/guides/audio/audio-latency) — tier 2, accessed 2026-10-20
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — tier 2, accessed 2026-10-20
