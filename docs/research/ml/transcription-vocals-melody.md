---
title: Vocal melody extraction, singing transcription and lyrics alignment
workstream: ml
last_researched: 2026-10-24
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
  - **Displaying lyrics is a copyright/licensing issue first** (see `research/legal/youtube-copyright-and-platform-policy.md`).
- **Range and key for transposition suggestions** are easy wins. Vocal range comes from robust f0 percentiles on the vocal stem. Key comes from `chords-beats-key-structure.md`. Pitch-shift playback is covered in `playback-time-stretch-pitch-shift.md`.

## Findings

### 1. Metrics
- **Melody (frame-level), `mir_eval.melody`** ([docs](https://mir-eval.readthedocs.io/latest/api/melody.html)):
  - **Voicing recall (VR):** fraction of voiced reference frames estimated as voiced.
  - **Voicing false alarm (VFA):** fraction of unvoiced reference frames wrongly estimated as voiced.
  - **Raw pitch accuracy (RPA):** fraction of voiced frames within **50 cents**.
  - **Raw chroma accuracy (RCA):** RPA with octave errors ignored. The RCA − RPA gap measures octave errors.
  - **Overall accuracy (OA):** includes correct unvoiced frames.
- **Singing note transcription:** COn / COnP / COnPOff = correct onset / + pitch / + offset. These correspond to `mir_eval.transcription` onset-only, note, and note-with-offset scoring: ±50 ms onset, ±50 cents ([mir_eval transcription](https://mir-eval.readthedocs.io/latest/api/transcription.html)).
- Full definitions: `datasets-metrics-and-licensing.md`.

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
- **Suggest transposition** so the song range sits inside the user's range. Key detection and chord transposition are in `chords-beats-key-structure.md`; pitch-shifted playback is in `playback-time-stretch-pitch-shift.md`.
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
- **Tracker floor for male low voices:** SwiftF0's 46.9 Hz floor is fine for voice but not bass (see `transcription-guitar-and-bass-tabs.md`). Should one tracker serve all instruments?
- **On-device budget:** on-device latency for a live mic feedback loop (<50 ms target, inference) on mid-range Android. See `deployment-and-inference.md`.

## 2026-10 re-check (step 23, 2026-10-24)
Checked on GitHub, PyPI, Hugging Face (LFS sha256), Zenodo, arXiv and MVSep on 2026-10-24. Package versions, the lj1995 RMVPE hashes and the GAME releases were re-read directly. Personal mode applies (25): licences are recorded as provenance, not used as a gate. Benchmark F1 and ×RT figures come from lars76/pitch-benchmark v2.1 (monophonic audio with noise and reverb, one CPU core). They are a guide only; step 23 decides on its own test set.

### f0 trackers
| Tracker | Weights today (sha256 where shown) | Licence | Input | Runtime / island | Notes |
|---|---|---|---|---|---|
| **RMVPE** | HF `lj1995/VoiceConversionWebUI`: `rmvpe.pt` 181 MB `6d62215f…c193`, `rmvpe.onnx` 362 MB `5370e71a…60fd`. yxlllc/RMVPE `230917` hybrid (MIR-1K + PTDB + M4Singer-synth; used by SOME/DiffSinger; no licence) | code Apache-2.0 (Dream-High, no weights), HF repo MIT | mixture or stem, 16 kHz, 10 ms | ~45 M params; torch (CUDA) or ONNX; 13.6× RT on one CPU core; pip `rmvpe-onnx` 0.2.3 (MIT) | Still the only released tracker built for accompanied singing |
| **SwiftF0** | `swift-f0` 0.3.0 (2026-09-25), ONNX bundled (135 KB), 14,386 params (the 14k vs 96k conflict is settled: 0.2.0 shipped the small model) | MIT; training code public | 16 kHz, 16 ms frames, 46.9–2093.75 Hz | onnx-cpu, ~180× RT | Benchmark F1 0.781 (RMVPE 0.768, tied). Tracks "any pitched sound", so it needs a stem. 0.3.0 adds `segment_notes` |
| **FCPE** | `torchfcpe` 0.0.4 bundles `fcpe_c_v001.pt` (MIT). Paper model DDSP-200K on HF `ChiTu/FCPE` is CC-BY-NC-SA-4.0 | MIT / NC | 16 kHz, hop 160 | torch, very fast (RTF 0.006 on a 4090) | Paper: RPA 96.79 on MIR-1K. Benchmark F1 0.728 |
| **CREPE** | `torchcrepe` 0.0.24, full + tiny bundled | MIT | 16 kHz, monophonic | torch; slow on CPU (0.4× RT) | Robust reference |
| **PESTO v2** | `pesto-pitch` 2.0.1; only a MIR-1K-trained checkpoint is released | LGPL-3.0 | stem | tiny, ONNX export since 2025-10 | Benchmark F1 0.680. Built for live mic (step 20) |
| **pYIN** | librosa 1.0.0 (2026-08; `win_length` removed from `pyin`) | ISC | stem | CPU, slow | Floor only (benchmark F1 0.506) |

Newer trackers: nothing released since 2025 is shown to beat RMVPE on accompanied singing. DJCM (joint separation + pitch, 2024) lists no weights. SpectMamba has no code.

### Singing → notes
- **openvpi/GAME** (successor to SOME, MIT, active 2026-10): v1.0.3 ONNX zips small 12.7 M (45.7 MB) / medium 49.9 M / large 99 M, digests on the release page.
  - Input is mel only (44.1 kHz, 10 ms); no f0 needed.
  - Trained on ~32 h of private data with accompaniment and noise augmentation; "works on dirty or separated voice".
  - Only internal metrics are published (RPA 0.949, QER 0.123). **No MIR-ST500 numbers.**
- **ROSVOT** (MIT code): weights are a Google Drive zip (no hash), trained on M4Singer. It runs its own RMVPE inside, 24 kHz. MIR-ST500 out of domain: 72.1 / 65.9 / 47.4 (COn / COnP / COnPOff).
- **STARS** (ACL Findings 2025, MIT code; HF `verstar/STARS`, no licence tag, 601 MB): RMVPE f0 + mel, built for Chinese/English singing-voice-synthesis annotation. COnPOff 71.0 vs ROSVOT 70.2 on GTSinger + private data.
- **VocalParse** (Apache-2.0): a 1.7 B audio LLM (Qwen3-ASR). Too heavy per song.
- **VOCANO:** effectively dead (no checkpoints in the tree, CUDA 10.1 + apex).
- **YourMT3+:** MIR-ST500 onset F1 70.6 on the mixture, 71.6 on a Spleeter stem (paper). We already ship it for other instruments (≈ 14 GB peak on MPS).
- **SwiftF0 `segment_notes`:** a cheap curve → notes baseline.

### Datasets for a vocal test set
| Set | Access today | Labels | Use in step 23 |
|---|---|---|---|
| **Vocadito** (Zenodo 5578807, CC-BY-4.0, 58 MB) | open | f0 + notes, 40 solo excerpts | f0 + notes after mixing with MUSDB18-HQ test accompaniment at several SNRs |
| **MDB-melody-synth** (Zenodo 1481168, CC-BY-NC-4.0, 2.2 GB) | open | exact f0 of a resynthesised melody inside a resynthesised mix | f0 on real arrangements (vocal-melody tracks only) |
| **MIR-ST500** test 401–500 | labels in york135's repo; audio via yt-dlp | notes on real pop mixes | main note set |
| MUSDB18-HQ test | open (Zenodo range reads, existing `p1_musdb.py`) | stems | separation uSDR + accompaniment for mixing |
| MIR-1K | Zenodo restricted, mirlab URL 404, only unofficial Kaggle mirrors | f0 | not used |
| MedleyDB melody, iKala | restricted (access request) | f0 | not used |
| Molina | original page gone; mirror unverified | notes (a cappella) | not used |
| GTSinger, M4Singer, Opencpop | a cappella, mostly Mandarin, NC | notes | not used (wrong domain) |

No new public set (2024–26) has note labels on accompanied pop. MIR-ST500 is still the only one.

### Separation for vocals (audio-separator 0.47.1, 2026-10-19)
- **Lead vs backing (karaoke):**
  - Lead SDRs on MVSep algorithm 76 (set size not stated): `bs_roformer_karaoke_anvuew` 10.22 (GPL-3.0) and `bs_roformer_karaoke_frazer_becruily` 10.10 (HF repo has no licence file).
  - Also listed: `mel_band_roformer_karaoke_gabox` 9.67, `…_becruily` 9.61 and `…_aufr33_viperx` 9.45, plus `UVR-BVE-4B_SN-44100-2` (backing-vocal extractor).
- **Vocal separators that beat Kim** (MVSep Multisong vocals SDR; Kim ≈ 11.08):

  | Model | Vocals SDR | In audio-separator |
  |---|---:|---|
  | unwa BS-Roformer Leap Xe | 11.79 | no; HF `pcunwa/BS-Roformer-Leap`, no licence tag; needs our own MSST config |
  | anvuew BS-RoFormer ft1 | 11.54 | no; GPL-3.0 |
  | `bs_roformer_vocals_resurrection_unwa` | 11.34 | yes |
  | BS-Roformer-SW | 11.30 | yes; already in the map |

- **Dereverb:** `dereverb_mel_band_roformer_mono_anvuew` (assumes mono single-singer vocals), Sucial De-Reverb-Echo, `UVR-De-Reverb-aufr33-jarredou`.

### What it means for step 23
- **f0 candidates:**
  - RMVPE (lj1995 `.pt` on CUDA, on the stem and on the mixture)
  - SwiftF0 0.3.0 (onnx-cpu, on the stem)
  - torchfcpe (MIT weight)
  - torchcrepe full
  - pYIN as the floor
  - PESTO only as a reference: MIR-1K-only checkpoint, and its home is step 20.
- **Note candidates:**
  - our own segmentation of the shipped f0
  - GAME small/medium (ONNX, mel only)
  - SwiftF0 `segment_notes`
  - Basic Pitch at its Phase 2 best
  - YourMT3+ vocals
  - ROSVOT is optional (Drive-only weights, weak out of domain).
- **Separation candidates:**
  - karaoke BS-RoFormers on the Kim stem, for the lead+backing tag
  - Resurrection / Leap Xe in place of Kim, only if they also win downstream within time.

### Step 23 plan (2026-10-24, waiting for the owner's OK)
**Worker and baseline time.** Production runs on the Windows PC (RTX 3060 12 GB, CUDA). Today's vocal analysis of a 222 s song in the local stack took **55 s after import**:
- decode 2 s
- tag + beats 6 s
- `separate` (Kim) 31 s
- `stem_post` 12 s
- `notes.vocals` + chords 4 s
- finalize under 1 s

A 30 % ceiling is therefore about **+17 s** per song.

**Test set** (manifests in `services/ml/eval/sets/`; audio under `~/datasets/p2v`; nothing owner-sung):

| Tier | Source | Items | Labels |
|---|---|---|---|
| f0 | Vocadito × MUSDB18-HQ test accompaniment at +12 / +6 / 0 dB vocal-to-band | 40 × 3 conditions | f0 + notes |
| f0 | MDB-melody-synth, vocal-melody tracks | ~10 × 30 s | f0 |
| notes | MIR-ST500 test 401–500, one 30 s excerpt per song that still downloads | ≤ 100: 401–450 tune / 451–500 report | notes |
| separation | MUSDB18-HQ test windows (P1 tooling) | 50 × 30 s | stems |
| unreferenced | 10–20 excerpts from the owner's library chosen by the owner (rap, falsetto, heavy reverb, backing vocals) | 10–20 | none (tracker agreement + owner looking at the view) |

- **Tags come from proxies:**
  - low / high: median reference pitch
  - vibrato: extent in the reference f0
  - dense / sparse: band-to-vocal ratio
  - lead + backing: energy in the karaoke model's backing output
  - heavy reverb: energy after reference offsets

  The reports label them as proxies.
- **Downloads:** Vocadito 58 MB, MDB-melody-synth 2.2 GB, MIR-ST500 audio ≈ 0.5 GB, MUSDB windows ≈ 1 GB, candidate weights ≈ 3–5 GB.

**Candidates and expected time per 222 s song on the PC** (estimates; measured in each phase):

| Phase | Candidate | Expected added time |
|---|---|---|
| 2 | Basic Pitch without melodia + thresholds, monophony pass, vocals calibration | ≈ 0 |
| 2 | Kim `overlap: 10` | +3 s |
| 3 | RMVPE `.pt` on CUDA (stem or mixture) | +2–5 s |
| 3 | SwiftF0 (onnx-cpu) | +1–2 s |
| 3 | torchfcpe | +1 s |
| 3 | torchcrepe full | +5–10 s |
| 3 | pYIN (eval only) | 20–40 s CPU |
| 4 | f0 segmentation | ≈ 0 |
| 4 | GAME small / medium ONNX on CPU | +5–15 s (unknown) |
| 4 | YourMT3+ vocals | +30–60 s; over budget, measured for the record |
| 5 | karaoke BS-RoFormer on the Kim stem | ≈ +30 s, about +55 %: needs the owner's yes |
| 5 | `htdemucs_ft` extras for chords / mixer | ≈ +20 s, about +40 %: needs the owner's yes |
| 5 | Leap Xe / Resurrection instead of Kim | +5–10 s |

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
- 2026-10 re-check (accessed 2026-10-24, tier 1 unless noted): [HF lj1995/VoiceConversionWebUI](https://huggingface.co/lj1995/VoiceConversionWebUI), [yxlllc/RMVPE](https://github.com/yxlllc/RMVPE), [rmvpe-onnx (PyPI)](https://pypi.org/project/rmvpe-onnx/), [swift-f0 (PyPI)](https://pypi.org/project/swift-f0/), [lars76/pitch-benchmark](https://github.com/lars76/pitch-benchmark), [pesto-pitch (PyPI)](https://pypi.org/project/pesto-pitch/), [CNChTu/FCPE](https://github.com/CNChTu/FCPE), [FCPE paper](https://arxiv.org/abs/2509.15140), [torchcrepe (PyPI)](https://pypi.org/project/torchcrepe/), [librosa (PyPI)](https://pypi.org/project/librosa/), [openvpi/GAME](https://github.com/openvpi/GAME), [openvpi/SOME](https://github.com/openvpi/SOME), [gwx314/STARS](https://github.com/gwx314/STARS), [pymaster17/VocalParse](https://github.com/pymaster17/VocalParse), [Vocadito (Zenodo)](https://zenodo.org/records/5578807), [MDB-melody-synth (Zenodo)](https://zenodo.org/records/1481168), [python-audio-separator](https://github.com/nomadkaraoke/python-audio-separator), [MVSep karaoke algorithm](https://mvsep.com/algorithms/76) (tier 2), [MVSep Multisong leaderboard](https://mvsep.com/quality_checker/multisong_leaderboard) (tier 2), [pcunwa/BS-Roformer-Leap](https://huggingface.co/pcunwa/BS-Roformer-Leap), [anvuew/BS-RoFormer](https://huggingface.co/anvuew/BS-RoFormer)
