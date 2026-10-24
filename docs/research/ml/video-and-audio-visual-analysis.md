---
title: Video and audio-visual analysis (separation, hand pose, fingering)
workstream: ml
last_researched: 2026-10-20
confidence: medium
---

# Video and audio-visual analysis

## TL;DR
- **Audio-visual (AV) source separation is research-grade, not production-ready.** The best-known benchmark is MUSIC: solo-instrument YouTube clips mixed synthetically. iQuery reports 11.17 dB SDR there, against 4.23 dB for Sound of Pixels ([iQuery](https://ar5iv.labs.arxiv.org/html/2212.03814)). Nothing shows AV models beating audio-only separators on real full-band mixes. Use audio-only separation (see `source-separation.md`).
- **Piano is the one instrument where video demonstrably helps, and only in constrained setups.**
  - With a fixed top-down camera, video-only V2N reaches 94.7 onset F1 on PianoVAM ([V2N page](https://pianovam-v2n.static.hf.space/index.html)). Audio-only Onsets & Frames reaches 93.4–95.8 note F1 on the same data ([PianoVAM](https://arxiv.org/html/2509.08800v1)).
  - On heterogeneous YouTube piano video, video-only onset F1 falls to 0.35–0.68 ([Zivanovic et al.](https://arxiv.org/html/2411.09037v2)).
  - Video as an audio post-filter adds about 0.5 F1 in heavy noise, and barely anything under reverberation ([PianoVAM](https://arxiv.org/html/2509.08800v1)).
- **Fingering is where video adds information audio cannot.** Video can determine which finger plays a note (piano) or which string/fret (guitar).
  - Piano fingering from video has reported F1 97% on a curated set (preprint) ([Moryossef et al.](https://arxiv.org/abs/2303.03745)). PianoVAM's semi-automatic labels reach about 95.6% precision on a spot-checked subset.
  - Guitar finger reading is earlier stage. GuiFiR (IEEE Access 2026) notes that no dedicated dataset existed ([GuiFiR](https://ailab.kookmin.ac.kr/publications/2026-07-15-guifir-weakly-supervised-learning-of-han/)).
- **Hand pose: MediaPipe Hand Landmarker is the practical building block.** It is Apache-2.0 ([repo](https://github.com/google-ai-edge/mediapipe)) and outputs 21 landmarks per hand. On a Pixel 6 it runs in 17.12 ms on CPU and 12.27 ms on GPU ([guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker)). It is generic; it was not trained for fretting hands or occluded piano fingers.
- **Verdict:** ship audio-only for v1. Treat video as (a) a learner-facing visual aid (synchronised YouTube player, mirrored or zoomed hands) and (b) an R&D track for piano fingering suggestions on top-down videos. Do not plan features that depend on extracting guitar fingering from arbitrary YouTube video.
- **Legal.** Processing video frames means fetching and decoding the video stream, not just audio. This raises the same or greater platform-policy exposure; see `research/legal/youtube-copyright-and-platform-policy.md`.

## Findings

### 1. Audio-visual source separation

| System | Year / venue | Idea | Reported result | Code / licence | Production-ready? |
|---|---|---|---|---|---|
| Sound of Pixels (PixelPlayer) | 2018, arXiv 1804.03160 ([abs](https://arxiv.org/abs/1804.03160)) | Mix-and-separate self-supervision; introduced the MUSIC dataset | MUSIC SDR 4.23 dB (as re-reported in [iQuery Table 1](https://ar5iv.labs.arxiv.org/html/2212.03814)) | research code (licence not verified) | No |
| Music Gesture | CVPR 2020 ([abs](https://arxiv.org/abs/2004.09476)) | Body and finger keypoints plus a graph network; separates same-instrument duets | MUSIC-21 SDR 10.12 dB (per [iQuery](https://ar5iv.labs.arxiv.org/html/2212.03814)) | not verified | No |
| iQuery | arXiv Dec 2022 ([abs](https://arxiv.org/abs/2212.03814)) | Instrument queries in a transformer | MUSIC SDR 11.17 / SIR 15.84 / SAR 14.27 dB, vs CCoL 7.74 dB ([ar5iv](https://ar5iv.labs.arxiv.org/html/2212.03814)) | not verified | No |

Evidence:
- MUSIC-style benchmarks mix two or more solo-instrument videos synthetically.
- The visual stream identifies *which* object makes sound. It does not help with dense studio mixes, where the instruments are mostly off-screen or overdubbed.

Inference: for a YouTube cover with one visible performer, the instrument is already known from the user's selection. Audio-only separators trained on MUSDB-style multitrack data (see `source-separation.md`) solve the actual problem. Visual conditioning adds complexity without proven gains. The one plausible niche is same-instrument duets (two guitars), where Music Gesture showed separation is possible. That remains research.

### 2. Hand / finger pose estimation

| Tool | Licence | Output | Performance | Commercial use | Notes |
|---|---|---|---|---|---|
| MediaPipe Hand Landmarker (Google AI Edge) | Apache-2.0 ([repo](https://github.com/google-ai-edge/mediapipe)) | Handedness; 21 landmarks per hand in image and world coordinates; `num_hands` configurable; IMAGE / VIDEO / LIVE_STREAM modes ([guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker)) | Pixel 6 full pipeline: 17.12 ms CPU, 12.27 ms GPU ([guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker)) | Yes | Two-stage palm detector plus landmark model, float16. Trained on about 30K real images plus synthetic hands. Android, iOS, Web, Python |
| GuiFiR (guitar finger reading) | dataset "publicly available"; code licence not stated ([page](https://ailab.kookmin.ac.kr/publications/2026-07-15-guifir-weakly-supervised-learning-of-han/)) | finger → string/fret mapping plus 126-landmark fretboard grid | Reports gains over MediaPipe, OpenPose, WiLoR and HaMeR on guitar video; numbers not on the summary page | Unclear | Weak supervision from audio-derived tabs (customised TabCNN) |

- **No accuracy figure for MediaPipe on fretting hands.** The model-card accuracy and fairness numbers were not retrieved for this doc. That is a gap.
- **Why fretting hands are hard (inference).** Instrument-playing hands are a hard case for generic models: self-occlusion of fingers behind the neck, partial views, motion blur. GuiFiR's authors motivate their work by saying generic hand-pose methods do not jointly model hand and fretboard ([GuiFiR](https://ailab.kookmin.ac.kr/publications/2026-07-15-guifir-weakly-supervised-learning-of-han/)).

### 3. Piano: video, fingering and AV transcription

| Work | Modality | Data | Result | Licence |
|---|---|---|---|---|
| Audeo (NeurIPS 2020) | video only (top view) | Paul Barton YouTube videos, 25 fps; pseudo ground truth from Onsets & Frames | Video2Roll frame F1 56.4; Roll2Midi F1 60.4–61.5 (Table 1). SoundHound recognised the generated audio 73.9% of the time vs 89.2% for real audio ([paper PDF](https://papers.neurips.cc/paper_files/paper/2020/file/227f6afd3b7f89b96c4bb91f95d50f6d-Paper.pdf)) | research |
| Zivanovic et al., "Pay Attention to the Keys" (arXiv, rev. Jul 2025) | video only, ViT | R3 (GoPro) and PianoYT | Onset F 0.85–0.88 on R3. On PianoYT: 0.35–0.40 zero-shot, 0.68 fine-tuned. Needs tight top-down crop; some videos had to be rotated 180° ([arXiv](https://arxiv.org/html/2411.09037v2)) | research |
| PianoVAM (Kim et al., arXiv Sep 2025) | dataset: video + audio + MIDI + hand landmarks + fingering | 106 recordings, about 21 h, 10 amateur pianists, 1080p60 top view; licence CC-BY-NC-4.0 | Audio-only O&F note F1 93.4 (trained on MAESTRO) / 95.8 (trained on PianoVAM). AV onset post-filter at 0 dB noise: F1 88.7 → 89.2. Reverberant: 64.4 → 64.8 ([arXiv](https://arxiv.org/html/2509.08800v1)) | CC-BY-NC-4.0 (non-commercial) |
| V2N (Kim, Sohn, Nam, Lerch; ISMIR 2026) | video only | PianoVAM | Onset F1 94.7; +offset 89.5; +velocity 82.8 at 50 ms ([project page](https://pianovam-v2n.static.hf.space/index.html)) | code/weights licence not stated |
| Moryossef et al., "At Your Fingertips" (arXiv 2023; written 2019) | video → fingering | 90 YouTube videos → about 150K fingered notes | Fingering F1 97% ([abs](https://arxiv.org/abs/2303.03745)) | research |
| PIG dataset (Nakamura et al., Inf. Sci. 2020) | symbolic fingering (no video) | 150 pieces, 309 fingerings | n/a | "Only nonprofit, academic use" ([site](https://beam.kisarazu.ac.jp/research/PianoFingeringDataset/)) |

What video adds over audio (evidence):
- **Note detection.** In clean audio, audio-only piano transcription is already at about 94–96 note F1 on PianoVAM. Video post-filtering changed F1 by +0.5 in heavy noise (significant for precision) and +0.4 under reverb, which was marginal ([PianoVAM Table 5](https://arxiv.org/html/2509.08800v1)).
- **Fingering.** Audio does not encode fingering. Video-derived labels reach about 95.6% precision on a manually checked subset (first 150 notes of 10 pieces). About 20% of notes needed human disambiguation, and errors are mostly adjacent fingers ([PianoVAM](https://arxiv.org/html/2509.08800v1)).
- **Generalisation is the real gap.** The same visual model scores 0.85+ on its own camera setup and 0.35–0.40 on varied YouTube video ([Zivanovic et al.](https://arxiv.org/html/2411.09037v2)).

### 4. Guitar: fingering and tablature from video

| Work | Approach | Reported quantification |
|---|---|---|
| Paleari et al., EURECOM 2008 | Fretboard tracking + hand position + audio fusion | Disambiguates 89% of notes' string/fret "in a deterministic way"; no audio-only baseline given ([EURECOM](https://www.eurecom.fr/en/node/4905240)) |
| TapToTab (arXiv 2409.08618, 2024) | YOLOv8 fretboard detection + FFT notes | No metrics on abstract page ([abs](https://arxiv.org/abs/2409.08618)) |
| GuiFiR (IEEE Access 2026) | Weakly supervised hand-plus-fretboard pose; finger → string/fret | Improvement over generic hand-pose baselines; numbers not verified ([page](https://ailab.kookmin.ac.kr/publications/2026-07-15-guifir-weakly-supervised-learning-of-han/)) |

Evidence is thin. No peer-reviewed study found reports audio-only vs audio-visual tablature accuracy on the same benchmark. The core motivation stands: the same pitch can be played at several string/fret positions ([EURECOM](https://www.eurecom.fr/en/node/4905240)). That is why audio-only tab transcription must guess fingering; see `transcription-guitar-and-bass-tabs.md`.

### 5. Practical obstacles with real YouTube video
- **Camera angle.**
  - Piano models assume a top-down full-keyboard view and are cropped tightly. Even orientation varies (rotated 180°) ([Zivanovic et al.](https://arxiv.org/html/2411.09037v2)).
  - Guitar lessons and covers are shot from the front or side, often with the fretting hand at a steep angle.
  - Recommendations from early guitar-vision work to raise the camera so fingertips stay visible are cited in that literature. The original chapter was not opened, so treat this as unverified.
- **Occlusion and blur.** PianoVAM lists motion blur, shadows, multi-finger preparation and floating hands as error sources, even with a fixed 1080p60 rig ([PianoVAM](https://arxiv.org/html/2509.08800v1)). YouTube re-encodes at variable bitrate and frame rate (often 24–30 fps), which loses fast finger transitions (inference).
- **Multiple people.** Band videos contain several players. Associating hands with the right instrument needs person and instrument detection plus tracking. Music Gesture addresses this with body keypoints, but only in research settings ([abs](https://arxiv.org/abs/2004.09476)).
- **Edits and cuts.** Lesson videos cut between close-ups, wide shots and graphics. Audeo had to remove frames with logos and black screens before processing ([Audeo PDF](https://papers.neurips.cc/paper_files/paper/2020/file/227f6afd3b7f89b96c4bb91f95d50f6d-Paper.pdf)).
- **Compute.** MediaPipe runs at roughly 60–80 fps on a Pixel 6 (inverse of 12–17 ms). Full-video analysis of a 4-minute 30 fps video is about 7,200 frames, which is feasible on-device or on a server CPU (inference).

### 6. Readiness verdict

| Capability | Status | Splitune stance |
|---|---|---|
| AV source separation | Research (synthetic MUSIC mixes) | Do not use |
| Live hand tracking of the *learner* via device camera (MediaPipe) | Production-ready building block | Candidate v2 feature, e.g. a posture or hand-position hint; needs UX validation |
| Piano note transcription from video | Research; strong only in fixed top-down setups | Not needed; audio is better |
| Piano fingering from top-down video | Late research; datasets are non-commercial (PianoVAM CC-BY-NC-4.0, PIG academic-only) | R&D spike; possible "suggested fingering" with human review |
| Guitar finger/fret reading from arbitrary YouTube video | Early research | Do not promise; audio-based tab position heuristics instead |

## Implications for Splitune
- **Architecture.** Keep the v1 pipeline audio-only. Video is a display surface (embedded or synced player, see `research/ux/music-display-ui.md`), not an analysis input.
- **Learner-facing camera features.** A self-view mirror or hand-position overlay is the realistic use of Apache-2.0 MediaPipe. This is the learner's own camera, not YouTube frames, so it avoids third-party content issues. It does raise privacy and on-device processing requirements; see `deployment-and-inference.md`.
- **Fingering.** For piano, the mid-term path is algorithmic or symbolic fingering suggestion from transcribed MIDI, with video-assisted refinement only for top-down videos. For guitar, use fretboard-position heuristics on the audio transcription. Any training on PianoVAM or PIG is non-commercial, so a commercial model needs Splitune-owned data.
- **Legal.** Frame analysis requires the video stream itself. Review `research/legal/youtube-copyright-and-platform-policy.md` before any prototype touches YouTube frames.

## Open questions
- **MediaPipe on instrument hands.** How accurate are MediaPipe landmarks on fretting hands and on piano hands under YouTube compression? Experiment: annotate about 200 frames from 20 cover videos and measure PCK.
- **Licences for V2N and GuiFiR.** What licences cover the V2N code and checkpoint and the GuiFiR data? Ask the authors.
- **Learner demand.** Do learners want fingering at all, or just notes plus a slow-motion video of the performer? See `research/users/jobs-to-be-done.md`.
- **Same-instrument duets.** Would AV conditioning help separate two guitars? Track research; no action now.

## Sources
- [iQuery: Instruments as Queries for Audio-Visual Sound Separation (arXiv abs)](https://arxiv.org/abs/2212.03814) — tier 1, accessed 2026-10-20
- [iQuery (ar5iv full text, Table 1)](https://ar5iv.labs.arxiv.org/html/2212.03814) — tier 1, accessed 2026-10-20
- [The Sound of Pixels (arXiv 1804.03160)](https://arxiv.org/abs/1804.03160) — tier 1, accessed 2026-10-20
- [Music Gesture for Visual Sound Separation (arXiv 2004.09476, CVPR 2020)](https://arxiv.org/abs/2004.09476) — tier 1, accessed 2026-10-20
- [MediaPipe Hand Landmarker guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker) — tier 2, accessed 2026-10-20
- [google-ai-edge/mediapipe repository](https://github.com/google-ai-edge/mediapipe) — tier 1, accessed 2026-10-20
- [PianoVAM: A Multimodal Piano Performance Dataset (arXiv 2509.08800)](https://arxiv.org/html/2509.08800v1) — tier 1, accessed 2026-10-20
- [V2N project page (ISMIR 2026)](https://pianovam-v2n.static.hf.space/index.html) — tier 2, accessed 2026-10-20
- [Pay Attention to the Keys: Visual Piano Transcription Using Transformers (arXiv 2411.09037v2)](https://arxiv.org/html/2411.09037v2) — tier 1, accessed 2026-10-20
- [Audeo: Audio Generation for a Silent Performance Video (NeurIPS 2020 PDF)](https://papers.neurips.cc/paper_files/paper/2020/file/227f6afd3b7f89b96c4bb91f95d50f6d-Paper.pdf) — tier 1, accessed 2026-10-20
- [At Your Fingertips: Extracting Piano Fingering Instructions from Videos (arXiv 2303.03745)](https://arxiv.org/abs/2303.03745) — tier 1 (preprint), accessed 2026-10-20
- [PIG Piano Fingering Dataset site](https://beam.kisarazu.ac.jp/research/PianoFingeringDataset/) — tier 1, accessed 2026-10-20
- [GuiFiR: Weakly-Supervised Learning of Hand Pose Estimation for Guitar Finger Reading](https://ailab.kookmin.ac.kr/publications/2026-07-15-guifir-weakly-supervised-learning-of-han/) — tier 2, accessed 2026-10-20
- [Audio-visual guitar transcription (EURECOM 2008)](https://www.eurecom.fr/en/node/4905240) — tier 1, accessed 2026-10-20
- [TapToTab (arXiv 2409.08618)](https://arxiv.org/abs/2409.08618) — tier 1 (preprint), accessed 2026-10-20
