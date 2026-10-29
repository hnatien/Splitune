---
title: Guitar and bass transcription — notes, tablature, fingering, techniques
workstream: ml
last_researched: 2026-10-20
confidence: medium
---

# Guitar and bass transcription to tablature

## TL;DR
- **Split the problem in two:** (1) audio → note events (pitch, onset, offset, bends), then (2) notes → string/fret assignment (tab). Stage 1 is close to solved on clean solo guitar. Stage 2 is where learned models now clearly beat Guitar Pro / MuseScore heuristics. End-to-end audio→tab is still weak: TART's end-to-end Tab F1 is 54% ([TART](https://arxiv.org/html/2609.11904v1)).
- **Note stage numbers:**
  - Supervised SOTA on GuitarSet is ~91% onset F1 ([GAPS](https://arxiv.org/html/2408.08653v2)).
  - Basic Pitch reaches 79%. It is Apache-2.0 and on-device capable, and is the pragmatic MVP choice on a separated guitar stem ([Basic Pitch paper](https://arxiv.org/pdf/2203.09893)).
  - MT3 collapses to 32% zero-shot on GuitarSet, so do not use it for guitar.
- **Fingering stage numbers:**
  - Transformer fret assigners lead. MIDI-to-Tab (BART, ISMIR 2024) matches 73.6% of ground-truth fingerings vs 62.3% for Guitar Pro 8, and guitarists rate its playability 6.04/10 vs 4.69 ([MIDI-to-Tab](https://arxiv.org/html/2408.05024v1)).
  - Fretting-Transformer (T5) conditions on capo and tuning ([arXiv](https://arxiv.org/html/2506.14223)).
  - Neither has released code with a usable license (unverified), so plan to build or train a fret assigner in-house.
- **Electric guitar with effects and real-world tones is the hard case.** TabCNN's out-of-domain disambiguation drops from 0.899 to 0.695 TDR ([Guitar-TECHS](https://arxiv.org/html/2501.03720v1)). Distortion is common on YouTube.
- **Bass:** the note stage is easy on separated stems (Slakh bass onset F1 ~93% for YourMT3+/Perceiver-TF, synthetic data). The real pitfalls are **octave errors** and **pitch-tracker range**: SwiftF0's floor is 46.9 Hz, which misses the open low E at 41.2 Hz. No bass-specific tab model was found. Reuse the guitar fret assigner with a 4/5-string config.
- **Techniques and tuning detection** (bends, slides, hammer-ons, capo/tuning) are research-grade. TART reports 95.9% macro-F1 for technique classification on its own label set, but there are no public weights (unverified). Ship "suggested" technique marks only after validation.

## Findings

### 1. Datasets

| dataset | content | size | license | notes |
|---|---|---|---|---|
| GuitarSet | acoustic guitar, hexaphonic pickup; string/fret, pitch contours, chords, beats | 360 excerpts, 6 players × 30 lead sheets × comp/solo ([MT3 paper](https://arxiv.org/pdf/2111.03017)); 8.2 GB | **CC-BY-4.0** ([Zenodo](https://zenodo.org/records/3371780)) | Standard benchmark, 6-fold leave-one-player-out |
| EGDB | electric guitar, 240 tablatures, DI re-amped through several amps | 118 min × 6 timbres | **unverified** (no license page found) | ICASSP 2022 (Chen et al.) |
| Guitar-TECHS | electric guitar: techniques, chords, scales, 12 solo excerpts; multiple mics, DI, egocentric audio | 5 h 12 min | **CC-BY-4.0** ([arXiv](https://arxiv.org/html/2501.03720v1)) | Techniques labelled: alt. picking, palm mute, vibrato, harmonics, pinch harmonics, bends. No slides or hammer-ons |
| GAPS | classical guitar, audio-score aligned, with video | 14 h, 200+ performers ([arXiv](https://arxiv.org/html/2408.08653v2)) | **No dataset license named**. MIDI is free; audio is via YouTube links; authors say rights-holder permission may be needed | ISMIR 2024 |
| SynthTab, DadaGP | synthesized / symbolic tabs used for pre-training ([TART](https://arxiv.org/html/2609.11904v1), [MIDI-to-Tab](https://arxiv.org/html/2408.05024v1)) | DadaGP: ~25–27k tabs | unverified | DadaGP derives from user-made Guitar Pro files, so provenance is a copyright risk (inference) |

### 2. Audio → notes (guitar)

| Model | GuitarSet onset F1 (F50) | Setting |
|---|---|---|
| Basic Pitch | 79.0 | supervised table in GAPS paper ([GAPS](https://arxiv.org/html/2408.08653v2)) |
| MT3 | 90.0 / **32.0 zero-shot** | [GAPS](https://arxiv.org/html/2408.08653v2) |
| Lu et al. (Perceiver-TF) | 91.1 | [GAPS](https://arxiv.org/html/2408.08653v2) |
| GAPS model (Kong-style CRNN, fine-tuned) | 91.2 / 88.1 zero-shot | weights unreleased; authors "carefully considering" release |
| Riley et al. | 89.7 / 87.3 zero-shot | [GAPS](https://arxiv.org/html/2408.08653v2) |
| YourMT3+ | 91.65 | [YourMT3+](https://arxiv.org/html/2407.04822) |

Across four test sets, TART's stage 1 (a Kong-style CRNN fine-tuned on pooled guitar data with noise augmentation) averages 81.35% F50, vs 74.68% for Riley et al. and 42.73% for FretNet. Riley still edges ahead on GuitarSet alone (88.1 vs 87.4) ([TART](https://arxiv.org/html/2609.11904v1)).

### 3. Audio → tablature (joint models)
- **TabCNN** (Wiggins & Kim, ISMIR 2019) is a CNN that outputs 6 softmaxes (one per string, fret 0–19 or silent). On GuitarSet, 6-fold CV, frame-level: multipitch F 0.826; tablature precision 0.809, recall 0.696, **F 0.748**; **TDR 0.899** ([paper](https://archives.ismir.net/ismir2019/paper/000033.pdf)).
  - TDR = the fraction of correctly detected pitches that also get the correct string.
  - The repo targets Python 2.7, has no license file and ships no weights ([repo](https://github.com/andywiggins/tab-cnn)).
- **Guitar-TECHS + TabCNN:** adding the dataset barely changes in-domain results (Tab F 0.748 → 0.747). It improves out-of-domain TDR on EGSet12 from 0.695 to 0.776 ([arXiv](https://arxiv.org/html/2501.03720v1)).
- **FretNet** (Cwitkowitz et al., ICASSP 2023) estimates continuous pitch contours grouped by string/fret, which allows bends and vibrato. The abstract calls its tablature results "competitive with baseline models" ([arXiv](https://arxiv.org/abs/2212.03023)). Code is MIT, with no pretrained weights listed ([repo](https://github.com/cwitkowitz/guitar-transcription-continuous)).
- **TART** (arXiv 2025/2026) is a modular 4-stage pipeline ([TART](https://arxiv.org/html/2609.11904v1)):
  1. CRNN audio→MIDI.
  2. CNN-BiLSTM technique classifier (~160k params; 9 classes: bend, hammer-on/pull-off, harmonics, palm mute, slide, vibrato, picking, plus kick/snare for percussive guitar).
  3. "AudioFret": a T5 string-fret assigner (~15M params) conditioned on MIDI tokens + per-note audio embeddings, with beam search and a 5-fret span limit.
  4. 1/16 quantization with BeatNet tempo, exported to MusicXML + JAMS.

  Zero-shot on GuitarSet/EGDB plus noisy variants: string-fret Tab F1 71.8% avg (vs Fretting-Transformer 63.3%); **end-to-end Tab F1 54.08%**; technique macro-F1 95.9%. No code license was found in the paper text.
- **Noise2Fret** (Simionato & Bigo, ISMIR 2026) is a diffusion audio→tab model with playability losses (hand span, string similarity, circle-of-fifths). It claims to beat baselines on GuitarSet and GOAT, but no numbers or code appear on the abstract page ([arXiv](https://arxiv.org/abs/2608.30854)).

### 4. Notes → string/fret assignment (the "fingering" problem)
A pitch can be played at up to 5–6 positions. The tab must minimise hand movement and stretch while respecting idiom (open strings, chord shapes).
- **Classic approaches.** Cost-minimising search over positions (e.g. A*/dynamic programming with stretch and shift costs) and "lowest fret" heuristics are the baselines used in recent papers. Commercial tools (Guitar Pro, TuxGuitar, MuseScore) use undisclosed heuristics.
- **Fretting-Transformer** (2025) is a T5 trained from scratch on GuitarToday + DadaGP + Leduc jazz. Capo (0–7) and tuning (standard, half-step down, full-step down, drop-D) are input tokens ([arXiv](https://arxiv.org/html/2506.14223)).

  | Tab accuracy (std tuning) | GuitarToday | Leduc | DadaGP |
  |---|---|---|---|
  | Lowest-fret baseline | 98.30 | 58.11 | 79.21 |
  | A* | 89.39 | 62.60 | 78.92 |
  | Guitar Pro 8.1.3 | 97.58 | 56.03 | 76.58 |
  | Fretting-Transformer | **98.41** | **72.19** | **81.58** |

  For simple beginner material (GuitarToday), lowest-fret is already ~98%. Learned models matter for jazz and complex material.
- **MIDI-to-Tab** (Edwards et al., ISMIR 2024) is a BART encoder-decoder with masked string-token prediction ([HTML](https://arxiv.org/html/2408.05024v1)).
  - **Training:** pre-trained on ~25–27k DadaGP tabs, fine-tuned on 281 professional tabs.
  - **Ground-truth agreement:** 73.58%, vs Guitar Pro 8 62.27%, MuseScore 62.51%, TuxGuitar 55.42%.
  - **Playability (15 guitarists, 1–10):** ground truth 7.45, MIDI-to-Tab 6.04, GP8 4.69, MuseScore 4.67.
  - Max chord stretch is still 12 frets vs 6 in the ground truth, so a hard span constraint is still needed (inference).
  - No code release found.
- **Implication:** a beginner-oriented app can bias the assigner toward open position and the first 5 frets. Learned models help most for lead lines and jazz voicings.

### 5. Techniques, tuning, capo
- **Bends/vibrato:** Basic Pitch emits MIDI pitch bends from a 3-bin/semitone contour ([repo](https://github.com/spotify/basic-pitch)). FretNet models continuous contours.
- **Slides/hammer-ons:** only TART's classifier covers these, and its training sets differ from public benchmarks. Treat as research-grade.
- **Tuning/capo detection from audio:** no dedicated published model was found in this pass. Fretting-Transformer only *conditions on* a known capo/tuning.
  - Inference: a global tuning offset (A4 deviation) is easy from pitch histograms.
  - Inference: drop tunings can be inferred when the lowest detected note is < E2 (82.4 Hz).
  - Inference: a capo is fundamentally ambiguous from audio alone, so ask the user or offer "capo suggestions" (see `research/ux/music-display-ui.md`).
- **Chord-level guitar output** (chord symbols + strum patterns) is often more useful to beginners than note-exact tab. See `chords-beats-key-structure.md`.

### 6. Bass
- **Note transcription on the bass stem:**
  - Multi-instrument models do well on synthetic data. Slakh bass onset F1 is 93.20 for YourMT3+ (PS) and 93.0 for Perceiver-TF, vs 71.03 for MT3 (Colab re-eval) ([YourMT3+](https://arxiv.org/html/2407.04822)).
  - YourMT3+ includes the SMT-Bass dataset in training.
  - On real pop (RWC-Pop) the authors report large chroma-level gaps, i.e. octave errors, for pitched instruments other than piano.
- **Monophonic pitch trackers on a separated bass stem.** These suit bass well because lines are mostly monophonic.
  - **CREPE** (MIT): 360 bins × 20 cents, ~32–2006 Hz range derived from the code's cents mapping ([code](https://raw.githubusercontent.com/marl/crepe/master/crepe/core.py), [README](https://raw.githubusercontent.com/marl/crepe/master/README.md)). This covers E1 (41.2 Hz) and almost B0 (30.9 Hz).
  - **SwiftF0** (MIT): range **46.875–2093.75 Hz** ([repo](https://github.com/lars76/swift-f0)), so it **cannot track the open E of a 4-string bass**.
  - **pYIN** (librosa, ISC): fmin is a required argument, so set it to ~30 Hz ([source](https://raw.githubusercontent.com/librosa/librosa/main/librosa/core/pitch.py), [repo](https://github.com/librosa/librosa)).
  - **Basic Pitch:** note range starts at 27.5 Hz ([constants.py](https://raw.githubusercontent.com/spotify/basic-pitch/main/basic_pitch/constants.py)).
  - **PESTO** (LGPL-3.0): see `transcription-vocals-melody.md`.
- **Octave errors:** low-frequency fundamentals are weak in many mixes, so trackers lock onto the 2nd harmonic. Mitigations (inference):
  - Raw chroma accuracy (RCA) vs raw pitch accuracy (RPA) checks in evaluation (`mir_eval.melody`, see `datasets-metrics-and-licensing.md`).
  - Viterbi smoothing.
  - A key/chord-root prior from `chords-beats-key-structure.md`.
- **Bass fret assignment:** the same problem with 4/5 strings and a narrower idiom (root-fifth patterns, position playing). No bass-specific learned assigner was found, so a cost-based DP is a reasonable v1 (inference).
- **Evidence gap:** no peer-reviewed bass-tab transcription benchmark on real recordings was found in this pass.

### 7. Models summary

| model | task | input | reported metric (dataset) | code license | weights license | training-data license | commercial use | production-readiness |
|---|---|---|---|---|---|---|---|---|
| Basic Pitch | guitar/bass notes + bends | separated stem | 79.0 onset F1 GuitarSet ([GAPS](https://arxiv.org/html/2408.08653v2)) | Apache-2.0 | in Apache-2.0 repo | mixed incl. CC-BY-NC-SA (MAESTRO) | likely; legal review | **Production-usable** (Py/TS/ONNX/CoreML) |
| TabCNN (2019) | audio → tab | solo guitar | Tab F 0.748, TDR 0.899 GuitarSet ([paper](https://archives.ismir.net/ismir2019/paper/000033.pdf)) | **none** ([repo](https://github.com/andywiggins/tab-cnn)) | none shipped | GuitarSet CC-BY-4.0 | reimplement only | Baseline; Python 2.7 |
| FretNet (2023) | audio → tab + continuous pitch | solo guitar | "competitive with baseline models" ([arXiv](https://arxiv.org/abs/2212.03023)) | MIT ([repo](https://github.com/cwitkowitz/guitar-transcription-continuous)) | none listed | GuitarSet CC-BY-4.0 | yes if self-trained | Research |
| GAPS model (2024) | guitar notes | solo guitar | 91.2 F1 sup. / 88.1 zero-shot GuitarSet ([arXiv](https://arxiv.org/html/2408.08653v2)) | not released | not released | GAPS (YouTube audio), GuitarSet | no | Not available |
| TART (2025/26) | audio → MIDI → techniques → tab → MusicXML | solo guitar | Tab F1 71.8% (fret stage), 54.08% end-to-end ([arXiv](https://arxiv.org/html/2609.11904v1)) | not found | not found | mixed (GAPS, Guitar-TECHS CC-BY, DadaGP…) | unknown | Research |
| Fretting-Transformer (2025) | MIDI → tab, capo/tuning conditioned | symbolic | 72.19% tab acc. Leduc ([arXiv](https://arxiv.org/html/2506.14223)) | not found | not found | DadaGP, GuitarToday, Leduc (unverified) | unknown | Research |
| MIDI-to-Tab (2024) | MIDI → tab | symbolic | 73.58% GT agreement; playability 6.04/10 ([arXiv](https://arxiv.org/html/2408.05024v1)) | not found | not found | DadaGP + pro tabs | unknown | Research |
| Noise2Fret (2026) | audio → tab, diffusion | solo guitar | claims SOTA on GuitarSet/GOAT ([arXiv](https://arxiv.org/abs/2608.30854)) | no code | no | unverified | n/a | Research |
| YourMT3+ (bass) | multi-instr. incl. bass | mixture | Slakh bass onset F1 93.20 ([HTML](https://arxiv.org/html/2407.04822)) | GPL-3.0 | Apache-2.0 per HF card (conflict) | includes NC data | risky | Research |
| CREPE | mono f0 (bass line) | separated stem | see vocals doc | MIT ([repo](https://github.com/marl/crepe)) | not separately stated | MIR datasets (see vocals doc) | likely | Mature library; TF dependency |
| SwiftF0 | mono f0 | separated stem | see vocals doc | MIT ([repo](https://github.com/lars76/swift-f0)) | not separately stated | unverified | likely | Production-shaped (ONNX), **but floor 46.9 Hz** |

### 8. Measured in Splitune (step 22, P2g, 2026-10-29)
On the P2g set (`specs/08-…` step 22 notes; `services/ml/eval/results/p2g/`), separated guitar from a band with keys:
- **Guitab** ([repo](https://github.com/DanieleMorotti/guitab), MIT code, CC-BY-NC-SA weights; a CQT CNN + transformer predicting fret-or-silence and onset per string, trained on GuitarSet 00–03, GAPS, SynthTab and private data) beats Basic Pitch on every held-out source: onset F1 0.873 vs 0.822 (GuitarSet player 05), 0.566 vs 0.553 (Guitar-TECHS), 0.825 vs 0.798 (IDMT-SMT-Guitar), at 1.5 s per 30 s on CPU.
- **Its string posteriors are the best fingering cue found:** as one DP cost term they lift `as_played` Tab F1 from 0.29 to 0.53 (GuitarSet player 05) and from 0.27 to 0.37 (Guitar-TECHS) over Basic Pitch with the plain DP. A small classifier on per-note spectra over Basic Pitch's notes helped less (0.35 → 0.51 on GuitarSet). This is the TART "AudioFret" idea without a learned assigner: the DP keeps playability, modes and alternatives.
- **Fine-tuning Guitab on separated stems overfits** to the training sources' timbres: small gains on GuitarSet, large losses on Guitar-TECHS and IDMT. More varied electric data (EGDB, DI re-amping) would be needed.
- **Tuning:** the A4 offset estimate (median error 6 cents) fixes off-A440 recordings (0.508 → 0.926 onset F1); open-string tuning from the notes alone is rarely decidable on 20–40 s excerpts (most never sound the low string), so the learner's tuning choice stays.
- **Bends:** Basic Pitch's 3-bins-per-semitone contour finds 30 of 48 labelled bends at precision 0.88–0.91 once fragments on a glide are merged.
- **YourMT3+'s gap is not its instrument filter:** keeping notes it labels as other instruments lowers GuitarSet onset F1 on hard-band stems (0.655 → 0.614) and barely helps Guitar-TECHS (0.372 → 0.391). Its recall on separated stems is simply low (0.64 / 0.30); the paper's 91.65 is on clean GuitarSet, which its training covered.
- **Ceiling by style:** comping and single lines on acoustic/clean guitar reach onset F1 ≈ 0.85 and Tab F1 ≈ 0.53–0.85 depending on how in-sample the player is; amp-miked electric (Guitar-TECHS) stays at onset F1 ≈ 0.57 and Tab F1 ≈ 0.37; vibrato-heavy lines are near zero (the reference marks one note, models emit many or none).

## Implications for Splitune
- **Pipeline:**
  1. Separated guitar/bass stem (`source-separation.md`; guitar stems from 6-stem models are weaker than bass, so check `source-separation-model-comparison.md`).
  2. Note transcription: Basic Pitch for MVP; Guitab (a joint tab model) for guitar since step 22, whose string posteriors also feed the fret DP (§8).
  3. Beat-grid quantization (`chords-beats-key-structure.md`).
  4. **In-house fret assigner:** cost-based DP for v1 with a beginner bias (open position, ≤4-fret span); a learned model later.
  5. Render with alphaTab, which reads/writes Guitar Pro and alphaTex and renders tab natively (`research/ux/music-display-ui.md`).
- **Offer multiple fingerings.** Fingering is a choice, not a fact. Let learners toggle "easiest" vs "as played" positions. Video-based fingering (`video-and-audio-visual-analysis.md`) could disambiguate "as played".
- **For beginners, chords + strumming may beat note-exact tab.** Prioritise chord detection for rhythm-guitar songs and note-level tab for riffs and solos.
- **Bass:** use a tracker with a floor ≤ 30 Hz (CREPE, pYIN with fmin = 30, Basic Pitch). Add an octave-correction pass using the separated stem's spectral energy and the chord root.
- **Electric/distorted guitar** is the main accuracy risk. Budget for an evaluation set with real YouTube-style tones.

## Open questions
- **Licenses:** what are the code/weights licenses for TART, Fretting-Transformer and MIDI-to-Tab? Contact the authors. Also, what license does EGDB carry?
- **Distortion:** how does Basic Pitch perform on distorted electric guitar stems after separation? Build a 30-song internal test set with hand-made tabs.
- **Tuning/capo:** can they be detected well enough to default automatically? Prototype a pitch-histogram + lowest-note heuristic and measure.
- **Bass tab:** are there bass-specific tab datasets (e.g. SMT-Bass licensing) usable for training a bass fret assigner? Unverified.
- **User preference:** do learners prefer learned "idiomatic" fingerings or simplified open-position ones? Run a user study (see `research/users/jobs-to-be-done.md`).

## Sources
- [GuitarSet on Zenodo](https://zenodo.org/records/3371780) — tier 1, accessed 2026-10-20
- [Wiggins & Kim, Guitar Tablature Estimation with a CNN (ISMIR 2019)](https://archives.ismir.net/ismir2019/paper/000033.pdf) — tier 1, accessed 2026-10-20
- [andywiggins/tab-cnn (GitHub)](https://github.com/andywiggins/tab-cnn) — tier 1, accessed 2026-10-20
- [Cwitkowitz et al., FretNet (arXiv)](https://arxiv.org/abs/2212.03023) — tier 1, accessed 2026-10-20
- [cwitkowitz/guitar-transcription-continuous (GitHub)](https://github.com/cwitkowitz/guitar-transcription-continuous) — tier 1, accessed 2026-10-20
- [Guitar-TECHS (arXiv HTML)](https://arxiv.org/html/2501.03720v1) — tier 1, accessed 2026-10-20
- [GAPS (arXiv HTML)](https://arxiv.org/html/2408.08653v2) — tier 1, accessed 2026-10-20
- [TART (arXiv HTML)](https://arxiv.org/html/2609.11904v1) — tier 1, accessed 2026-10-20
- [Noise2Fret / Playability-Aware Audio-to-Tablature via Diffusion (arXiv)](https://arxiv.org/abs/2608.30854) — tier 1, accessed 2026-10-20
- [Fretting-Transformer (arXiv HTML)](https://arxiv.org/html/2506.14223) — tier 1, accessed 2026-10-20
- [MIDI-to-Tab (arXiv HTML)](https://arxiv.org/html/2408.05024v1) — tier 1, accessed 2026-10-20
- [Gardner et al., MT3 (arXiv PDF)](https://arxiv.org/pdf/2111.03017) — tier 1, accessed 2026-10-20
- [Bittner et al., Basic Pitch paper (arXiv PDF)](https://arxiv.org/pdf/2203.09893) — tier 1, accessed 2026-10-20
- [spotify/basic-pitch (GitHub)](https://github.com/spotify/basic-pitch) — tier 1, accessed 2026-10-20
- [Basic Pitch constants.py](https://raw.githubusercontent.com/spotify/basic-pitch/main/basic_pitch/constants.py) — tier 1, accessed 2026-10-20
- [Chang et al., YourMT3+ (arXiv HTML)](https://arxiv.org/html/2407.04822) — tier 1, accessed 2026-10-20
- [marl/crepe (GitHub)](https://github.com/marl/crepe) — tier 1, accessed 2026-10-20
- [CREPE README](https://raw.githubusercontent.com/marl/crepe/master/README.md) — tier 1, accessed 2026-10-20
- [CREPE core.py](https://raw.githubusercontent.com/marl/crepe/master/crepe/core.py) — tier 1, accessed 2026-10-20
- [lars76/swift-f0 (GitHub)](https://github.com/lars76/swift-f0) — tier 1, accessed 2026-10-20
- [librosa/librosa (GitHub)](https://github.com/librosa/librosa) — tier 1, accessed 2026-10-20
- [librosa pitch.py (pyin source)](https://raw.githubusercontent.com/librosa/librosa/main/librosa/core/pitch.py) — tier 1, accessed 2026-10-20
