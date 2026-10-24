---
title: Piano transcription — models, benchmarks, domain gap, hands and simplification
workstream: ml
last_researched: 2026-10-20
confidence: medium
---

# Piano transcription

## TL;DR
- **Piano is the most mature AMT task.** Note-onset F1 on MAESTRO v3 has saturated at ~97–98%: Transkun V2 98.3, Aria-AMT 97.6, Kong et al. 96.8, MT3 95.7 ([Rubato Table 5](https://arxiv.org/html/2605.24291)). Offsets are the weak part: 37–82% for key-release offsets, ~85–93% when offsets are extended by the sustain pedal.
- **Best usable candidate: Transkun.** It is MIT code, `pip install transkun`, and ships a default checkpoint. It also reports out-of-domain results (MAPS 0.92, SMD 0.99 onset F1 for V2 Aug) ([repo](https://github.com/Yujia-Yan/Transkun)). The weights license is not stated, and the training data is MAESTRO (CC-BY-NC-SA-4.0), so legal review is required before commercial use.
- **Benchmark ≠ YouTube.**
  - MAESTRO is Disklavier audio from one competition, recorded in similar conditions ([MAESTRO](https://magenta.tensorflow.org/datasets/maestro)).
  - Models "severely overfit to acoustic properties of the training data" ([Edwards et al. 2024](https://arxiv.org/abs/2402.01424)).
  - Kong and Onsets and Frames lose ~5% relative F1 at 12 dB SNR and ~10% at 9 dB ([noise study](https://arxiv.org/html/2410.14122)).
  - Expect noticeably worse results on phone-recorded covers, digital pianos and pop mixes.
- **Piano extracted from a full band mix is a different problem** from solo piano. Separated piano stems carry bleed and artifacts (`source-separation.md`). No study measuring piano transcription on separated stems was found, so this must be tested in-house.
- **Readable sheet music needs more than notes.** It needs hand/staff assignment, voice separation, rhythm quantization and optionally simplification. These exist as research code: PM2S (MIT), the GNN "Cluster and Separate" (ISMIR 2024), and a difficulty-controlled simplification transformer (Nov 2025 preprint). None is production-ready.

## Findings

### 1. Datasets

| dataset | content | size | license | notes |
|---|---|---|---|---|
| MAESTRO v3.0.0 | Disklavier performances, Piano-e-Competition; ~3 ms audio–MIDI alignment; pedals | ~198.7 h | **CC-BY-NC-SA-4.0** ([MAESTRO](https://magenta.tensorflow.org/datasets/maestro)) | De-facto training set; classical only |
| MAPS | Disklavier + synthesized pianos; isolated notes, chords, pieces; 9 settings | ~31 GB | **CC-BY-NC-SA-2.0-FR** ([Telecom Paris](https://adasp.telecom-paris.fr/resources/2010-07-08-maps-database/)) | Annotation offsets are known to be off; Transkun uses "ad hoc align" |
| SMD (Saarland Music Data) | Disklavier MIDI–audio pairs | small | "freely available for research purposes", cite on use; no formal license named ([AudioLabs](https://www.audiolabs-erlangen.de/resources/MIR/SMD)) | Out-of-domain test |
| ATEPP (subset) | YouTube piano recordings incl. historical | 1,495 recordings / 106 scores used in Rubato ([Rubato](https://arxiv.org/html/2605.24291)) | unverified | Closest to "in the wild" |

### 2. Models and reported results
- **Onsets and Frames** (Magenta, 2018) is a CNN+RNN, ~18M params ([Basic Pitch paper](https://arxiv.org/pdf/2203.09893)). Note F1 = onset only; w/offset = onset + offset; w/vel = onset + offset + velocity ([MAESTRO paper](https://ar5iv.labs.arxiv.org/html/1810.12247)):

  | Test set | Frame F1 | Note F1 | Note w/ offset F1 | Note w/ offset & velocity F1 |
  |---|---|---|---|---|
  | MAESTRO test | 90.15 | 95.32 | 80.50 | 77.54 |
  | MAPS (trained with augmentation) | 84.91 | 86.44 | 67.43 | 51.77 |

  The magenta repo (Apache-2.0) was **archived on 2026-01-06** ([repo](https://github.com/magenta/magenta)). The O&F README now points users to MT3 ([README](https://github.com/magenta/magenta/blob/main/magenta/models/onsets_frames_transcription/README.md)). Checkpoints still exist. A browser demo ("Piano Scribe") existed.
- **High-resolution piano transcription with pedals** (Kong et al., ByteDance, TASLP 2021) regresses precise onset/offset times. MAESTRO **onset F1 96.72%** and **sustain-pedal onset F1 91.86%**. The authors claim robustness to misaligned labels ([arXiv](https://arxiv.org/abs/2010.01815)).
  - The training repo states Apache-2.0 and was archived 2025-12-08 ([repo](https://github.com/bytedance/piano_transcription)).
  - The pip inference package `piano_transcription_inference` has **no license file** ([repo](https://github.com/qiuqiangkong/piano_transcription_inference)). It downloads a checkpoint from Zenodo licensed **CC-BY-4.0** ([Zenodo](https://zenodo.org/record/4034264)).
- **hFT-Transformer** (Sony, ISMIR 2023) uses a hierarchical frequency-time transformer. It claims SOTA at the time on MAPS and MAESTRO across all F1 metrics ([arXiv](https://arxiv.org/abs/2307.04305)). Code is MIT and a checkpoint is released; no weights license is stated ([repo](https://github.com/sony/hFT-Transformer)).
- **Transkun / Transkun V2** (Yan & Duan: semi-CRF, NeurIPS 2021; non-hierarchical transformer interval scoring, ISMIR 2024). Code is MIT; the pip package bundles the "Transkun V2 No Ext" checkpoint ([repo](https://github.com/Yujia-Yan/Transkun)). Model-card F1 values:

  | Checkpoint / dataset | Note onset F1 | Onset+offset F1 | Onset+offset+vel F1 | Pedal onset F1 |
  |---|---|---|---|---|
  | V2 / MAESTRO v3 | 0.983 | 0.935 | 0.930 | 0.864 |
  | V2 Aug / MAPS (ad hoc align) | 0.922 | 0.698 | 0.550 | 0.734 |
  | V2 Aug / SMD | 0.988 | 0.921 | 0.890 | 0.838 |

- **Aria-AMT** (EleutherAI) is a seq2seq piano transcriber that its authors describe as "efficient and robust". Code is Apache-2.0; "preliminary" weights are on Hugging Face with no weights license stated ([repo](https://github.com/EleutherAI/aria-amt)).
- **Head-to-head on MAESTRO test (177 files, mir_eval F1 %, Rubato paper, May 2026)** ([HTML](https://arxiv.org/html/2605.24291)). Its convention:
  - **KeyOff:** offsets must match key release.
  - **PedOff:** offsets are extended by the sustain pedal, which is the historical convention.

  | Model | Note | Note+Vel | Note+KeyOff | Note+PedOff | Note+PedOff+Vel |
  |---|---|---|---|---|---|
  | Transkun (KeyOff fine-tune) | 98.3 | 97.9 | 81.9 | 91.8 | 91.4 |
  | Transkun V2 (published) | 98.3 | 97.7 | 42.6 | 93.4 | 92.9 |
  | Aria-AMT | 97.6 | 96.4 | 41.6 | 89.8 | 88.8 |
  | Kong et al. (ByteDance) | 96.8 | 95.0 | 37.7 | 85.2 | 83.7 |
  | Rubato (AMT dialect) | 97.0 | 94.0 | 73.0 | 85.5 | 82.8 |
  | MT3 | 95.7 | n/a | 38.5 | 82.1 | n/a |

- **Other 2026 work.** An optimal-transport training approach (Wei et al., accepted to ICASSP 2026) claims "state-of-the-art" onset detection on MAESTRO; the abstract gives no numbers ([arXiv 2605.17405](https://arxiv.org/abs/2605.17405)). A secondary search snippet quoted 98.36% onset F1, which is unverified.
- **Multi-instrument models on piano:** YourMT3+ reaches 96.98 onset F1 on MAESTRO and 87.88 on unseen MAPS ([YourMT3+](https://arxiv.org/html/2407.04822)). Basic Pitch is far behind on piano: Fno 0.71, and F with offset 0.11 ([paper](https://arxiv.org/pdf/2203.09893)).

### 3. Domain gap: benchmark vs real recordings
- **Evidence:**
  - Edwards et al. re-recorded MAESTRO through a Disklavier in a studio. Training on original + re-recorded audio + augmentation reached **88.4 onset F1 on MAPS without MAPS training**, and models trained without this "severely overfit" to training acoustics ([arXiv](https://arxiv.org/abs/2402.01424)).
  - A noise-injection study finds Kong (clean 96.7) and O&F (clean 94.5) each drop ~5% relative at 12 dB SNR and ~10% at 9 dB ([arXiv](https://arxiv.org/html/2410.14122)).
  - **Mobile-AMT** (Yamaha, EUSIPCO 2024) augments for four shifts: timbre, room acoustics, background noise and recording setup. Augmentation adds **+14.3 note-F1 points** on realistic recordings. The online model cuts compute by 82.9% vs the Kong et al. baseline, runs at real-time factor < 1 on one mobile CPU core, and has ~174 ms latency ([PDF](https://eurasip.org/Proceedings/Eusipco/Eusipco2024/pdfs/0000036.pdf)). This is direct evidence that on-device, real-world piano transcription is feasible. No public code or weights were found.
- **Inference.** YouTube piano content differs from MAESTRO in several ways:
  - Digital pianos and VST pianos.
  - Close-miked or phone audio, compressed codecs.
  - Pop voicings with heavy pedal.
  - Piano inside band mixes.

  Plan on 5–15 points lower onset F1 and much worse offsets. This is a rough estimate from the studies above, not a measured number. Pedal-heavy pop makes "key-off" offsets nearly meaningless, so display durations quantized to the beat grid instead.

### 4. Hand separation, voicing and staff assignment
- **PM2S** (ISMIR 2022, MIT) predicts hand part per note alongside beats, quantized onsets, key and time signature from performance MIDI ([poster](https://ismir2022program.ismir.net/poster_335.html), [repo](https://github.com/cheriell/PM2S)).
- **Cluster and Separate** (Foscarin et al., ISMIR 2024) is a GNN that jointly predicts voices and staves for quantized piano MIDI, including chords and cross-staff voices. It reports "clear and consistent improvements" over prior work, with code and models announced ([JKU](https://research.jku.at/en/publications/cluster-and-separate-a-gnn-approach-to-voice-and-staff-prediction/)). License unverified.
- **Beyer & Dai** (ISMIR 2024) predict staff assignment end-to-end from performance MIDI ([arXiv](https://arxiv.org/abs/2410.00210)), but the repo has no license.
- **Video-based hand assignment** (MediaPipe hands over keyboard video) is covered in `video-and-audio-visual-analysis.md`. PianoVAM (ISMIR 2025) provides top-view video, Disklavier audio + MIDI, hand landmarks and semi-automatic fingering labels from amateur practice sessions. The paper's introduction states the dataset is released under CC-BY-NC-4.0, i.e. non-commercial ([arXiv HTML](https://arxiv.org/html/2509.08800v1); [arXiv](https://arxiv.org/abs/2509.08800)).

### 5. Difficulty reduction / simplification for beginners
- **Classic statistical work:** Nakamura & Yoshii's piano reduction controls performance difficulty while maximising fidelity (APSIPA Trans.; [arXiv 1808.05006](https://arxiv.org/abs/1808.05006)).
- **Neural:** Ramoneda et al. (arXiv Nov 2025) build a transformer that rewrites **MusicXML** piano scores to a target difficulty, trained on synthetic paired arrangements. The authors say code, data and models are released ([arXiv](https://arxiv.org/abs/2511.16228v1)). The paper is CC-BY-NC-ND; the code license is unverified.
- **Simple rule-based levels are feasible today (inference):**
  - Melody-only right hand.
  - Root-note or block-chord left hand from chord detection (`chords-beats-key-structure.md`).
  - Remove ornaments; restrict range.
  - Transpose to an easier key.

### 6. Models summary

| model | task | input | reported metric (dataset) | code license | weights license | training-data license | commercial use | production-readiness |
|---|---|---|---|---|---|---|---|---|
| Transkun V2 | notes + velocity + pedal | piano audio 44.1 kHz | onset F1 on MAESTRO v3: 0.9832 (V2), 0.9833 ("Transkun V2 No Ext", pip default); 0.988 SMD ([repo](https://github.com/Yujia-Yan/Transkun)) | MIT | not stated | MAESTRO CC-BY-NC-SA-4.0 | needs legal review (NC data) | **Best candidate**: pip, CPU/GPU |
| Kong et al. high-res (ByteDance) | notes + velocity + pedal | piano audio | onset F1 96.72, pedal 91.86 MAESTRO ([arXiv](https://arxiv.org/abs/2010.01815)) | Apache-2.0 (training repo, archived); inference pkg **no license** | CC-BY-4.0 (Zenodo checkpoint) | MAESTRO NC-SA | possible for weights; inference code needs rewrite or permission | Mature, widely used; unmaintained |
| hFT-Transformer (Sony) | notes + velocity | piano audio | SOTA claim 2023 on MAPS/MAESTRO ([arXiv](https://arxiv.org/abs/2307.04305)) | MIT ([repo](https://github.com/sony/hFT-Transformer)) | not stated | MAESTRO NC-SA | review | Research code |
| Aria-AMT (EleutherAI) | seq2seq notes | piano audio | 97.6 note F1 MAESTRO ([Rubato](https://arxiv.org/html/2605.24291)) | Apache-2.0 ([repo](https://github.com/EleutherAI/aria-amt)) | not stated ("preliminary") | unverified | review | Early; CLI, int8 on BF16 GPUs |
| Onsets and Frames (Magenta) | notes + velocity | piano audio | Note F1 95.32 MAESTRO ([paper](https://ar5iv.labs.arxiv.org/html/1810.12247)) | Apache-2.0, **archived** ([repo](https://github.com/magenta/magenta)) | not stated | MAESTRO NC-SA | review | Legacy (TF1) |
| YourMT3+ | multi-instr. incl. piano | mixture | 96.98 MAESTRO; 87.88 MAPS ([HTML](https://arxiv.org/html/2407.04822)) | GPL-3.0 | Apache-2.0 per HF (conflict) | NC data | risky | Research |
| Basic Pitch | agnostic | stem | Fno 0.71 MAESTRO ([paper](https://arxiv.org/pdf/2203.09893)) | Apache-2.0 | in repo | mixed | likely | Production-usable but weak on piano |
| PM2S | perf. MIDI → hands, beats, quantized score | MIDI | MV2H > commercial ([poster](https://ismir2022program.ismir.net/poster_335.html)) | MIT | in repo | ASAP/piano | likely | Research, usable |
| Ramoneda et al. 2025 | MusicXML difficulty reduction | MusicXML | qualitative + quantitative ([arXiv](https://arxiv.org/abs/2511.16228v1)) | unverified | unverified | synthetic pairs | unknown | Research |

## Implications for Splitune
- **Default piano path:**
  1. Piano stem (or the original audio, if the video is solo piano).
  2. Transkun (or Kong) for notes + pedal.
  3. Beat grid + quantization.
  4. Hand/staff split (PM2S, or a simple pitch-split heuristic as a fallback).
  5. MusicXML.
  6. Verovio/OSMD rendering, plus a falling-notes "piano roll" view (`research/ux/music-display-ui.md`). The piano roll is more tolerant of transcription errors than engraved notation.
- **Detect "solo piano" vs "piano in band"** (`instrument-recognition.md`). Skip separation for solo piano, because separation can only add artifacts.
- **Licensing:** the strongest piano weights are all trained on MAESTRO (NC-SA). Splitune either gets legal clearance or retrains on licensed audio (e.g. our own Disklavier/digital-piano recordings).
- **Beginner value is in simplification and hand-split, not in 98% F1.** Build rule-based difficulty levels first. Evaluate neural simplification later.

## Open questions
- **Real-world accuracy:** how accurate are Transkun/Kong on (a) YouTube solo-piano covers and (b) separated piano from pop mixes? Build an internal test set by recording our own performances on a MIDI-capable piano.
- **Weights licenses:** what are the licenses for Transkun and hFT weights? Contact the authors.
- **Simplification at scale:** does neural MusicXML simplification (Ramoneda 2025) produce pedagogically sound scores for pop songs? Run a teacher review.
- **On-device feasibility:** what are Transkun's on-device size and latency? See `deployment-and-inference.md`.

## Sources
- [MAESTRO dataset page](https://magenta.tensorflow.org/datasets/maestro) — tier 1, accessed 2026-10-20
- [Hawthorne et al., Enabling Factorized Piano Music Modeling… (MAESTRO paper, ar5iv)](https://ar5iv.labs.arxiv.org/html/1810.12247) — tier 1, accessed 2026-10-20
- [MAPS database (Telecom Paris)](https://adasp.telecom-paris.fr/resources/2010-07-08-maps-database/) — tier 1, accessed 2026-10-20
- [Saarland Music Data (AudioLabs)](https://www.audiolabs-erlangen.de/resources/MIR/SMD) — tier 1, accessed 2026-10-20
- [magenta/magenta (GitHub)](https://github.com/magenta/magenta) — tier 1, accessed 2026-10-20
- [Onsets and Frames README](https://github.com/magenta/magenta/blob/main/magenta/models/onsets_frames_transcription/README.md) — tier 1, accessed 2026-10-20
- [Kong et al., High-resolution Piano Transcription with Pedals (arXiv)](https://arxiv.org/abs/2010.01815) — tier 1, accessed 2026-10-20
- [bytedance/piano_transcription (GitHub)](https://github.com/bytedance/piano_transcription) — tier 1, accessed 2026-10-20
- [qiuqiangkong/piano_transcription_inference (GitHub)](https://github.com/qiuqiangkong/piano_transcription_inference) — tier 1, accessed 2026-10-20
- [Kong checkpoint on Zenodo](https://zenodo.org/record/4034264) — tier 1, accessed 2026-10-20
- [hFT-Transformer (arXiv)](https://arxiv.org/abs/2307.04305) — tier 1, accessed 2026-10-20
- [sony/hFT-Transformer (GitHub)](https://github.com/sony/hFT-Transformer) — tier 1, accessed 2026-10-20
- [Yujia-Yan/Transkun (GitHub)](https://github.com/Yujia-Yan/Transkun) — tier 1, accessed 2026-10-20
- [EleutherAI/aria-amt (GitHub)](https://github.com/EleutherAI/aria-amt) — tier 1, accessed 2026-10-20
- [Rubato: Transcribing Piano Music with Timestamps (arXiv HTML)](https://arxiv.org/html/2605.24291) — tier 1, accessed 2026-10-20
- [A Distribution Matching Approach to Neural Piano Transcription with Optimal Transport (arXiv)](https://arxiv.org/abs/2605.17405) — tier 1, accessed 2026-10-20
- [Chang et al., YourMT3+ (arXiv HTML)](https://arxiv.org/html/2407.04822) — tier 1, accessed 2026-10-20
- [Bittner et al., Basic Pitch paper (arXiv PDF)](https://arxiv.org/pdf/2203.09893) — tier 1, accessed 2026-10-20
- [Edwards et al., A Data-Driven Analysis of Robust Automatic Piano Transcription (arXiv)](https://arxiv.org/abs/2402.01424) — tier 1, accessed 2026-10-20
- [Towards Robust Transcription: Noise Injection (arXiv HTML)](https://arxiv.org/html/2410.14122) — tier 1, accessed 2026-10-20
- [Mobile-AMT (EUSIPCO 2024)](https://eurasip.org/Proceedings/Eusipco/Eusipco2024/pdfs/0000036.pdf) — tier 1, accessed 2026-10-20
- [PianoVAM (arXiv)](https://arxiv.org/abs/2509.08800) — tier 1, accessed 2026-10-20
- [PianoVAM (arXiv HTML, licence statement in Introduction)](https://arxiv.org/html/2509.08800v1) — tier 1, accessed 2026-10-20
- [Liu et al., PM2S (ISMIR 2022 poster)](https://ismir2022program.ismir.net/poster_335.html) — tier 1, accessed 2026-10-20
- [cheriell/PM2S (GitHub)](https://github.com/cheriell/PM2S) — tier 1, accessed 2026-10-20
- [Foscarin et al., Cluster and Separate (JKU)](https://research.jku.at/en/publications/cluster-and-separate-a-gnn-approach-to-voice-and-staff-prediction/) — tier 1, accessed 2026-10-20
- [Beyer & Dai, Performance-MIDI to Score (arXiv)](https://arxiv.org/abs/2410.00210) — tier 1, accessed 2026-10-20
- [Nakamura & Yoshii, Statistical Piano Reduction Controlling Performance Difficulty (arXiv)](https://arxiv.org/abs/1808.05006) — tier 1, accessed 2026-10-20
- [Ramoneda et al., Difficulty-Controlled Simplification of Piano Scores (arXiv)](https://arxiv.org/abs/2511.16228v1) — tier 1, accessed 2026-10-20
