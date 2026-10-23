---
title: Vocal melody extraction, singing transcription and lyrics alignment
workstream: ml
last_researched: 2026-10-20
confidence: medium
---

# Vocals: pitch tracking, note transcription, lyrics alignment

## TL;DR
- **Show singers a continuous pitch curve (f0), not just notes.** Frame-level pitch tracking is mature: RPA ≥ 95% on clean vocals for CREPE/RMVPE ([RMVPE](https://arxiv.org/html/2306.15412v1)). Note segmentation is much weaker: best note F1 including offsets is ~47–77% depending on the dataset ([ROSVOT](https://arxiv.org/html/2405.09940v2)). Vibrato, scoops and glides are what singers need to see, and notes flatten them.
- **Pitch tracker picks (all permissive code):**
  - **RMVPE** (Apache-2.0 code) works directly on the mixture and beats separation + CREPE (MIR-1K RPA 95.42 vs 91.05).
  - **SwiftF0** (MIT, ~100k params or fewer, ONNX, ~42× faster than CREPE on CPU) leads a 9-tracker benchmark under noise ([SwiftF0 paper](https://arxiv.org/html/2508.18440)).
  - **PESTO** (LGPL-3.0, <10 ms latency, streaming) suits **live mic feedback** ([PESTO v2](https://arxiv.org/abs/2508.01488)).
  - **CREPE** (MIT) is the robust reference but slow (~22M params).
- **Singing → notes:**
  - ROSVOT (ACL 2024, MIT code) handles accompanied/noisy singing, at COnPOff 77.0 noisy on its own test set. Out of domain on MIR-ST500 it falls to 47.4.
  - YourMT3+ gets 71–72 onset F1 on MIR-ST500 (GPL code).
  - Expect a draft that needs smoothing and beat quantization.
- **Lyrics:**
  - Whisper (MIT code **and** weights) on a separated vocal stem is the open-source baseline. Separation lowers word error rate and gives SOTA open-source results on Jam-ALT ([Syed et al. 2025](https://arxiv.org/abs/2506.15514)).
  - Word timing needs forced alignment (WhisperX, BSD-2-Clause). It is designed for speech, so singing accuracy is unverified.
  - **Displaying lyrics is a copyright/licensing issue first** (see `legal/youtube-copyright-and-platform-policy.md`).
- **Range and key for transposition suggestions** are easy wins. Vocal range comes from robust f0 percentiles on the vocal stem. Key comes from `ml/chords-beats-key-structure.md`. Pitch-shift playback is covered in `ml/playback-time-stretch-pitch-shift.md`.

## Findings

### 1. Metrics
- **Melody (frame-level), `mir_eval.melody`** ([docs](https://mir-eval.readthedocs.io/latest/api/melody.html)):
  - **Voicing recall (VR):** fraction of voiced reference frames estimated as voiced.
  - **Voicing false alarm (VFA):** fraction of unvoiced reference frames wrongly estimated as voiced.
  - **Raw pitch accuracy (RPA):** fraction of voiced frames within **50 cents**.
  - **Raw chroma accuracy (RCA):** RPA with octave errors ignored. The RCA − RPA gap measures octave errors.
  - **Overall accuracy (OA):** includes correct unvoiced frames.
- **Singing note transcription:** COn / COnP / COnPOff = correct onset / + pitch / + offset. These correspond to `mir_eval.transcription` onset-only, note, and note-with-offset scoring: ±50 ms onset, ±50 cents ([mir_eval transcription](https://mir-eval.readthedocs.io/latest/api/transcription.html)).
- Full definitions: `ml/datasets-metrics-and-licensing.md`.

### 2. Frame-level pitch trackers

**On polyphonic music (vocals + accompaniment), RPA / RCA / OA %** ([RMVPE, Interspeech 2023](https://arxiv.org/html/2306.15412v1)). pYIN/CREPE/HarmoF0 were run on **Spleeter-separated** vocals; RMVPE ran on the **mixture**.

| Method | MIR-1K RPA | MIR-1K RCA | MIR-ST500 RPA | MIR-ST500 OA | Cmedia RPA |
|---|---|---|---|---|---|
| pYIN | 77.29 | 77.86 | 63.85 | 65.27 | 59.69 |
| CREPE | 91.05 | 92.16 | 81.61 | 76.59 | 74.61 |
| HarmoF0 | 88.63 | 88.97 | 83.00 | 81.80 | 79.08 |
| RMVPE | **95.42** | **95.84** | **89.32** | **84.54** | **83.57** |

On clean vocals (MIR-1K), CREPE reaches 95.66 RPA vs 97.27 for RMVPE.

**Noise-robust tracker benchmark** ([SwiftF0 paper, Aug 2025](https://arxiv.org/html/2508.18440)):
- **Setup:** averaged over Bach10-mf0-synth, Vocadito and a SpeechSynth set, with CHiME-Home noise at 10 dB SNR.
- **Coverage gap:** RMVPE, PESTO and SPICE were not in this comparison.

| Method | RPA (10 dB) | RCA (10 dB) | OA (10 dB) | CPU time for 5 s audio |
|---|---|---|---|---|
| SwiftF0 | 89.90 | 90.17 | 93.52 | 132.6 ms |
| pYIN | 86.97 | 87.77 | 66.83 | 1,420.6 ms |
| CREPE | 72.27 | 72.43 | 91.66 | 5,508.3 ms |
| Basic Pitch | 22.87 | 24.00 | 31.57 | 280.3 ms |

Basic Pitch is a poor **f0 tracker**. Its contour output is a byproduct, so use it for notes, not curves.

**Tracker notes:**
- **CREPE** ([repo](https://github.com/marl/crepe), MIT):
  - Takes 16 kHz input, 10 ms hop, 360 bins × 20 cents ([README](https://raw.githubusercontent.com/marl/crepe/master/README.md)).
  - Five capacities from tiny to full; ~22M params for full, per the SwiftF0 paper.
  - Optional Viterbi smoothing.
- **pYIN** (Mauch & Dixon 2014): part of librosa (ISC). `fmin`/`fmax` are required arguments ([source](https://raw.githubusercontent.com/librosa/librosa/main/librosa/core/pitch.py), [repo](https://github.com/librosa/librosa)). No model weights, so no weights-licensing issue.
- **SPICE** (Google): self-supervised, 16 kHz mono, outputs pitch + uncertainty. The TF tutorial code is Apache-2.0, but **no model license is stated** on the tutorial ([TF tutorial](https://www.tensorflow.org/hub/tutorials/spice)). The tutorial's note quantization is a naive grid search that writes every note as a half note. It illustrates why note segmentation is needed.
- **PESTO** ([repo](https://github.com/SonyCSLParis/pesto), LGPL-3.0):
  - v1: ISMIR 2023 Best Paper, <30k params ([arXiv](https://arxiv.org/abs/2309.02265)).
  - v2: TISMIR 2025, ~130k params, <10 ms latency ([arXiv](https://arxiv.org/abs/2508.01488)).
  - Self-supervised; streaming mode; ONNX export.
  - LGPL is fine server-side or dynamically linked; check obligations for mobile static linking (legal).
- **RMVPE** ([repo](https://github.com/Dream-High/RMVPE), Apache-2.0): a U-Net+GRU that extracts vocal pitch directly from mixtures. The repo lists no weights download.
- **SwiftF0** ([repo](https://github.com/lars76/swift-f0), MIT):
  - Range 46.875–2093.75 Hz (fine for voice).
  - The README says 14,386 params, but the paper says 95,842. The sources **conflict**, possibly due to different versions.
  - ~180× real time on one CPU core; streaming needs 176 ms lookahead; ONNX Runtime (incl. web).

### 3. Note-level singing transcription
- **Datasets:**
  - **MIR-ST500** (Wang & Jang, ICASSP 2021): 500 pop songs with vocal note labels; songs 1–400 train, 401–500 test. Audio is **only YouTube URLs**, downloaded via yt-dlp, and the repo has **no license** ([repo](https://github.com/york135/singing_transcription_ICASSP2021)). Fine for research evaluation; not a commercial training source.
  - **M4Singer:** used by ROSVOT; license unverified.
- **VOCANO** (ISMIR 2021, MIT): pitch extraction (Patch-CNN) + note segmentation (PyramidNet). Trained on monophonic data, so it **recommends Demucs separation first** ([repo](https://github.com/B05901022/VOCANO)). It beats Basic Pitch on Molina vocals ([Basic Pitch paper](https://arxiv.org/pdf/2203.09893)).
- **ROSVOT** (ACL 2024, MIT code, weights in a zip with no license stated) ([repo](https://github.com/RickyL-2000/ROSVOT), [arXiv](https://arxiv.org/abs/2405.09940)):
  - Multi-scale segmentation + attention pitch decoder.
  - Handles accompanied singing.
  - Shipped checkpoints are trained only on M4Singer.
  - Results ([HTML](https://arxiv.org/html/2405.09940v2)):

  | Method (M4Singer+D1 test, clean / noisy) | COn F1 | COnP F1 | COnPOff F1 |
  |---|---|---|---|
  | VOCANO | 75.8 / 64.7 | 58.0 / 49.4 | 50.2 / 43.4 |
  | Yong et al. 2023 | 92.0 / 88.5 | 72.7 / 67.9 | 65.8 / 62.1 |
  | ROSVOT | 94.0 / 93.8 | 80.3 / 83.8 | 77.4 / 77.0 |
  | **Out-of-domain MIR-ST500:** Gu et al. 2023 | 78.1 | 70.0 | 52.8 |
  | **Out-of-domain MIR-ST500:** ROSVOT | 72.1 | 65.9 | 47.4 |

- **YourMT3+** ([HTML](https://arxiv.org/html/2407.04822)):
  - MIR-ST500 onset F1: 71.60 / 72.05 with separated input, 70.59 / 71.07 without.
  - 81.14 / 82.08 with a 100 ms tolerance.
  - The strongest baseline (no separation) scores 78.50.
  - MT3 essentially cannot do vocals: 3.62.
  - The authors note singing onsets lag the Perceiver-TF baseline.
- **Basic Pitch on vocals (Molina):** Fno 0.52, F 0.35 ([paper](https://arxiv.org/pdf/2203.09893)). Usable as a fallback; emits pitch bends.
- **omnizart** (MIT) has "vocal" (note) and "vocal-contour" (f0) modes ([repo](https://github.com/Music-and-Culture-Technology-Lab/omnizart)).

### 4. Vibrato, glides, and what to show
- **Inference from the evidence above.** Note F1 drops ~15–30 points once pitch and offset must match (COn → COnPOff). Much of that comes from the model deciding where a scooped or vibrato note "is".
- **Recommended display:** a smoothed f0 curve over a piano-roll of target notes, karaoke-style. Use target notes only where confidence is high, and quantize note boundaries to the beat grid.
- **Vibrato:** compute rate and extent from the f0 curve with simple DSP, rather than from a model. This gives singers feedback ("vibrato 5.5 Hz, ±40 cents"). It is an inference, not a tested product feature.

### 5. Lyrics transcription and alignment
- **Whisper:** "code and model weights are released under the MIT License" ([repo](https://github.com/openai/whisper)).
- **Syed et al. 2025** (ICME 2025 workshop) ([arXiv](https://arxiv.org/abs/2506.15514)):
  - Separated vocals reduce Whisper's lyrics WER.
  - Using separation as vocal-activity detection for long-form segmentation reaches SOTA among open-source systems on **Jam-ALT**, without fine-tuning.
  - They release MUSDB-ALT.
  - Exact WERs are not in the abstract.
- **WhisperX** (BSD-2-Clause) adds wav2vec2 forced alignment for word timestamps plus VAD. It is designed for speech, and its alignment models carry their own per-language licenses ([repo](https://github.com/m-bain/whisperX)).
- **stable-ts** (MIT), another Whisper timestamp tool, is **archived** ([repo](https://github.com/jianfch/stable-ts)).
- **Inference:** forced alignment on sung vowels with melisma is harder than on speech, so expect line-level timing to be reliable before word-level. If licensed lyrics text is available, alignment (text known) is far more accurate than transcription (text unknown).

### 6. Range and key for transposition
- **Vocal range** = 5th–95th percentile of confident f0 on the vocal stem. This is simple, robust, and needs no model (inference).
- **User's range:** have the user sing a short sweep and measure it with the same tracker.
- **Suggest transposition** so the song range sits inside the user's range. Key detection and chord transposition are in `ml/chords-beats-key-structure.md`; pitch-shifted playback is in `ml/playback-time-stretch-pitch-shift.md`.
- **Octave errors** (RCA − RPA gap; ~0.5 points for RMVPE, ~1 point for CREPE on MIR-1K) can corrupt range estimates. Use the percentile approach and octave-consistency smoothing.

### 7. Models summary

| model | task | input | reported metric (dataset) | code license | weights license | training-data license | commercial use | production-readiness |
|---|---|---|---|---|---|---|---|---|
| RMVPE | vocal f0 | mixture or vocals | RPA 95.42 MIR-1K poly ([arXiv](https://arxiv.org/html/2306.15412v1)) | Apache-2.0 ([repo](https://github.com/Dream-High/RMVPE)) | not stated; no download listed | MIR-1K etc. (unverified) | code yes; weights unclear | Widely reused; research code |
| SwiftF0 | f0 | stem / mic | RPA 89.90 @10 dB ([arXiv](https://arxiv.org/html/2508.18440)) | MIT ([repo](https://github.com/lars76/swift-f0)) | not separately stated | unverified | likely | **Production-shaped** (ONNX, web, streaming) |
| PESTO v2 | f0, streaming | stem / mic | "competitive with supervised" ([arXiv](https://arxiv.org/abs/2508.01488)) | LGPL-3.0 ([repo](https://github.com/SonyCSLParis/pesto)) | not stated | MIR-1K (unverified license) | LGPL obligations | **Production-shaped** (<10 ms, ONNX) |
| CREPE | f0 | stem | RPA 95.66 MIR-1K vocals ([RMVPE paper](https://arxiv.org/html/2306.15412v1)) | MIT ([repo](https://github.com/marl/crepe)) | not separately stated | unverified | likely | Mature, slow (TF) |
| pYIN (librosa) | f0 (DSP) | stem / mic | RPA 77.29 MIR-1K poly ([RMVPE paper](https://arxiv.org/html/2306.15412v1)) | ISC ([repo](https://github.com/librosa/librosa)) | n/a | n/a | yes | Mature; no ML |
| SPICE | f0, self-supervised | 16 kHz mono | not in sources opened | tutorial Apache-2.0 ([TF](https://www.tensorflow.org/hub/tutorials/spice)) | not stated | unverified | unclear | TF Hub model |
| ROSVOT | singing → notes | accompanied or clean vocals | COnPOff 77.0 noisy (M4Singer+D1); 47.4 MIR-ST500 ([arXiv](https://arxiv.org/html/2405.09940v2)) | MIT ([repo](https://github.com/RickyL-2000/ROSVOT)) | not stated | M4Singer (unverified) | unclear | Research |
| VOCANO | singing → notes | separated vocals | beats Basic Pitch on Molina ([Basic Pitch paper](https://arxiv.org/pdf/2203.09893)) | MIT ([repo](https://github.com/B05901022/VOCANO)) | not stated | unverified | unclear | Research (2021) |
| YourMT3+ | vocals within multi-instr. | mixture | MIR-ST500 onset F1 72.05 ([HTML](https://arxiv.org/html/2407.04822)) | GPL-3.0 | Apache-2.0 per HF (conflict) | MIR-ST500 (YouTube audio), NC data | risky | Research |
| Basic Pitch | notes + bends | vocal stem | Fno 0.52 Molina ([paper](https://arxiv.org/pdf/2203.09893)) | Apache-2.0 | in repo | mixed | likely | Production-usable |
| Whisper | lyrics ASR | vocal stem | SOTA open-source on Jam-ALT with separation ([arXiv](https://arxiv.org/abs/2506.15514)) | MIT ([repo](https://github.com/openai/whisper)) | **MIT** | undisclosed web data | yes (code/weights) | Production-grade |
| WhisperX | word alignment | audio + transcript | not reported for singing | BSD-2-Clause ([repo](https://github.com/m-bain/whisperX)) | per-language wav2vec2 licenses | varies | check per model | Production-grade for speech; singing untested |

## Implications for Splitune
- **Vocal practice view:** a real-time mic f0 curve (SwiftF0 or PESTO, on-device) overlaid on the song's vocal f0 (RMVPE on the server) and on target notes (ROSVOT/Basic Pitch, quantized). Comparing two curves avoids depending on fragile note segmentation.
- **Run separation once and reuse it.** The vocal stem feeds pitch tracking, lyrics ASR (lower WER), and range estimation.
- **Lyrics:** prefer licensed lyrics text + alignment over ASR, both for legal reasons and accuracy. Use ASR only for timing or as a fallback. Legal review is required.
- **Transposition helper:** cheap to build and high value for singers. The pieces are range from f0 percentiles, key from the chords pipeline, and pitch-shift playback.

## Open questions
- **Alignment on singing:** how accurate is WhisperX/wav2vec2 word alignment on sung vocals (word onset error in ms)? Evaluate on Jam-ALT or MUSDB-ALT.
- **Licenses:** what are the weights and training-data licenses for RMVPE, ROSVOT, SwiftF0 and PESTO? Ask the authors and check the datasets (MIR-1K, M4Singer).
- **Tracker floor for male low voices:** SwiftF0's 46.9 Hz floor is fine for voice but not bass (see `ml/transcription-guitar-and-bass-tabs.md`). Should one tracker serve all instruments?
- **On-device budget:** on-device latency for a live mic feedback loop (<50 ms target, inference) on mid-range Android. See `ml/deployment-and-inference.md`.

## Sources
- [RMVPE (arXiv HTML)](https://arxiv.org/html/2306.15412v1) — tier 1, accessed 2026-10-20
- [Dream-High/RMVPE (GitHub)](https://github.com/Dream-High/RMVPE) — tier 1, accessed 2026-10-20
- [SwiftF0 paper (arXiv HTML)](https://arxiv.org/html/2508.18440) — tier 1, accessed 2026-10-20
- [lars76/swift-f0 (GitHub)](https://github.com/lars76/swift-f0) — tier 1, accessed 2026-10-20
- [PESTO (arXiv, ISMIR 2023)](https://arxiv.org/abs/2309.02265) — tier 1, accessed 2026-10-20
- [PESTO v2 (arXiv, TISMIR 2025)](https://arxiv.org/abs/2508.01488) — tier 1, accessed 2026-10-20
- [SonyCSLParis/pesto (GitHub)](https://github.com/SonyCSLParis/pesto) — tier 1, accessed 2026-10-20
- [marl/crepe (GitHub)](https://github.com/marl/crepe) — tier 1, accessed 2026-10-20
- [CREPE README](https://raw.githubusercontent.com/marl/crepe/master/README.md) — tier 1, accessed 2026-10-20
- [librosa/librosa (GitHub)](https://github.com/librosa/librosa) — tier 1, accessed 2026-10-20
- [librosa pitch.py (pyin source)](https://raw.githubusercontent.com/librosa/librosa/main/librosa/core/pitch.py) — tier 1, accessed 2026-10-20
- [SPICE TensorFlow Hub tutorial](https://www.tensorflow.org/hub/tutorials/spice) — tier 2, accessed 2026-10-20
- [mir_eval.melody docs](https://mir-eval.readthedocs.io/latest/api/melody.html) — tier 1, accessed 2026-10-20
- [mir_eval.transcription docs](https://mir-eval.readthedocs.io/latest/api/transcription.html) — tier 1, accessed 2026-10-20
- [york135/singing_transcription_ICASSP2021 (MIR-ST500, GitHub)](https://github.com/york135/singing_transcription_ICASSP2021) — tier 1, accessed 2026-10-20
- [B05901022/VOCANO (GitHub)](https://github.com/B05901022/VOCANO) — tier 1, accessed 2026-10-20
- [RickyL-2000/ROSVOT (GitHub)](https://github.com/RickyL-2000/ROSVOT) — tier 1, accessed 2026-10-20
- [ROSVOT (arXiv abs)](https://arxiv.org/abs/2405.09940) — tier 1, accessed 2026-10-20
- [ROSVOT (arXiv HTML v2)](https://arxiv.org/html/2405.09940v2) — tier 1, accessed 2026-10-20
- [Chang et al., YourMT3+ (arXiv HTML)](https://arxiv.org/html/2407.04822) — tier 1, accessed 2026-10-20
- [Bittner et al., Basic Pitch paper (arXiv PDF)](https://arxiv.org/pdf/2203.09893) — tier 1, accessed 2026-10-20
- [omnizart (GitHub)](https://github.com/Music-and-Culture-Technology-Lab/omnizart) — tier 1, accessed 2026-10-20
- [openai/whisper (GitHub)](https://github.com/openai/whisper) — tier 1, accessed 2026-10-20
- [Syed et al., Exploiting Music Source Separation for ALT with Whisper (arXiv)](https://arxiv.org/abs/2506.15514) — tier 1, accessed 2026-10-20
- [m-bain/whisperX (GitHub)](https://github.com/m-bain/whisperX) — tier 1, accessed 2026-10-20
- [jianfch/stable-ts (GitHub)](https://github.com/jianfch/stable-ts) — tier 1, accessed 2026-10-20
