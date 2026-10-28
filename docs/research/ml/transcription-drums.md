---
title: Automatic drum transcription (ADT) — models, datasets, classes, notation
workstream: ml
last_researched: 2026-10-28
confidence: medium
---

# Automatic drum transcription (ADT)

## TL;DR
- **Five classes work well; more classes do not yet.** Kick / snare / hi-hat / toms / cymbals reach ~0.75–0.89 F-measure on real-recording benchmarks (MDB, ENST), but only ~0.60 on electronic/produced music (RBMA13). At 18 classes the best model drops to 0.50–0.67 ([STAR Drums, TISMIR 2025](https://transactions.ismir.net/articles/10.5334/tismir.244)).
- **Separation helps drums specifically.**
  - Transcribe a separated drum stem (Demucs) rather than the mix.
  - Then optionally run a drum-kit separator (MDX23C DrumSep) to split crash vs ride and open vs closed hi-hat.
  - Riley & Dixon got 7 classes out of a 5-class model this way and beat an 8-class baseline on MDB (0.84 vs 0.72) and ENST (0.76 vs 0.65) ([arXiv 2509.24853](https://arxiv.org/html/2509.24853)).
- **Licensing is poor across the board.**
  - ADTOF (the de-facto real-music model) is CC-BY-NC-SA-4.0 ([repo](https://github.com/MZehren/ADTOF)).
  - madmom's model files are CC-BY-NC-SA-4.0 ([repo](https://github.com/CPJKU/madmom)).
  - MDB Drums is CC-BY-NC-SA-4.0 ([repo](https://github.com/CarlSouthall/MDBDrums)).
  - The cleanest commercial route is training on **E-GMD / Groove MIDI (CC-BY-4.0)** and Slakh (CC-BY-4.0) plus our own data. Caveat: E-GMD-only models generalize poorly to real mixes (ADTOF F1 is 86.9 on MDB, whereas E-GMD-trained Onsets & Frames scores 75.2) ([N2N](https://arxiv.org/html/2509.21739)).
- **Velocity (dynamics, ghost notes) is available only from E-GMD-trained models:** OaF-Drums, hFT, and N2N (ICASSP 2026). These are weaker on real music. Ghost notes and accents matter for intermediate drummers; treat them as v2.
- **MVP recommendation:** run a drum stem through a 5-class CRNN, then quantize to the beat grid and render drum notation. Get commercial clearance or retrain (see Implications). Map to General MIDI percussion numbers internally so rendering and playback reuse standard tooling.

## Findings

### 1. Task variants and metrics
- **DTD vs DTP vs DTM:**
  - **DTD:** drum-only audio.
  - **DTP:** drums plus percussion.
  - **DTM:** drums in a full mixture. Harder, because bass, guitars and vocals mask kick/snare/cymbals.
  - YourMT3+ on ENST-Drums: DTP 88.79 onset F1, DTM 85.92 (no pitch-shift) ([YourMT3+](https://arxiv.org/html/2407.04822)).
- **Metric:** onset-only F-measure with a ±50 ms tolerance, per class, then summed ("global") or averaged across classes. Computed with `mir_eval` ([Riley & Dixon](https://arxiv.org/html/2509.24853)). Offsets are meaningless for most drum hits. Velocity F1 is used only on E-GMD. Definitions: `datasets-metrics-and-licensing.md`.
- **Class vocabularies are inconsistent across papers.** Common ones:
  - **3-class:** kick, snare, hi-hat (IDMT, ADTLib).
  - **5-class:** kick, snare, hi-hat, toms, cymbals (ADTOF).
  - **7/8-class:** splits hi-hat open/closed and crash/ride (adds cowbell).
  - **18-class:** STAR Drums.

### 2. Datasets

| dataset | content | size | license | notes |
|---|---|---|---|---|
| E-GMD | human performances on Roland TD-17, re-rendered through 43 kits; velocity | 444.5 h, 45,537 sequences | **CC-BY-4.0** ([Magenta](https://magenta.tensorflow.org/datasets/e-gmd)) | Electronic kit; aligned within 2 ms |
| Groove MIDI (GMD) | 10 drummers on Roland TD-11, MIDI + synthesized audio | 13.6 h, 1,150 MIDI files | **CC-BY-4.0** ([Magenta](https://magenta.tensorflow.org/datasets/groove)) | Roland pitch map ≠ General MIDI; remap needed |
| MDB Drums | 23 MedleyDB tracks: drum stem + mix; 7,994 onsets, 6 classes / 21 sub-classes | small | **CC-BY-NC-SA-4.0** ([GitHub](https://github.com/CarlSouthall/MDBDrums)) | Real recordings |
| ADTOF (RGW, YT) | crowdsourced rhythm-game charts aligned to real commercial songs | large (exact hours unverified) | Repo CC-BY-NC-SA-4.0; data "available upon request on Zenodo" ([repo](https://github.com/MZehren/ADTOF)) | Copyrighted audio, so not redistributable for commercial training (inference) |
| STAR Drums | re-synthesized drums (20 kits) + real non-drum stems from MUSDB18, ISMIR04, MTG-Jamendo | 124.5 h | Per Zenodo release; built from redistributable audio ([TISMIR](https://transactions.ismir.net/articles/10.5334/tismir.244)) | 18 classes, mappings to 8/5/3. Exact license unverified |
| Slakh2100 drums | rendered from Lakh MIDI | 145 h of mixes | **CC-BY-4.0** ([Zenodo](https://zenodo.org/records/4599666)) | Synthetic |
| ENST-Drums | drum performances with/without accompaniment (details unverified) | — | **unverified** (license page not reachable) | Classic benchmark (DTP/DTM splits used by YourMT3+) |
| RBMA13, IDMT-SMT-Drums | electronic music / 3-class drum loops | — | unverified | Test sets |

### 3. Models and reported results

**Global F-measure, ±50 ms, from STAR Drums (TISMIR 2025).** Same CRNN trained on each dataset ([TISMIR](https://transactions.ismir.net/articles/10.5334/tismir.244)):

| Training data | Classes | MDB | ENST | RBMA13 |
|---|---|---|---|---|
| TMIDT (synthetic) | 5 | 0.65 | 0.69 | 0.55 |
| Slakh | 5 | 0.68 | 0.72 | 0.48 |
| ADTOF-RGW | 5 | 0.78 | 0.75 | 0.60 |
| ADTOF-YT | 5 | 0.79 | 0.76 | 0.59 |
| STAR Drums | 5 | 0.79 | 0.77 | 0.62 |
| STAR Drums | 18 | 0.67 | 0.66 | 0.50 |

**Noise-to-Notes (N2N, Sony, ICASSP 2026), F1 %** ([HTML](https://arxiv.org/html/2509.21739)):
- **Approach:** a diffusion transformer that generates onsets + velocities, conditioned on audio and music-foundation-model features.
- **Training data:** E-GMD.
- **Class sets:** E-GMD 7 classes; MDB mapped to 5; IDMT mapped to 3.

| Model | E-GMD | E-GMD (+vel) | MDB | IDMT |
|---|---|---|---|---|
| OaF-Drums (Magenta) | 83.40 | 61.70 | 75.19 | 85.72 |
| ADTOF (CRNN) | 44.95 | – | 86.87 | 94.67 |
| hFT-Transformer (drums) | 86.31 | 80.16 | 70.81 | 70.61 |
| N2N, 10 steps | 89.68 | 82.80 | 87.86 | 94.90 |

Takeaways from the N2N results:
- Training-data domain dominates. ADTOF (real music) wins on MDB/IDMT, and E-GMD models win on E-GMD.
- N2N closes the gap using foundation-model features.
- No N2N code link was found.

**Separation-assisted expansion** (Riley & Dixon, Sep 2025; preprint) ([HTML](https://arxiv.org/html/2509.24853)):
- **Pipeline:** Demucs v4 isolates drums, ADTOF transcribes 5 classes, an MDX23C DrumSep model splits the kit, and post-processing expands to 7 classes (kick, snare, closed HH, open HH, toms, crash, ride). Velocities are estimated from the stems.
- **5-class results:** 0.89 MDB, 0.85 ENST, 0.63 RBMA (original ADTOF: 0.87 / 0.84 / 0.65).
- **7- vs 8-class baseline:** 0.84 vs 0.72 MDB; 0.76 vs 0.65 ENST; 0.56 vs 0.58 RBMA.

**Multi-instrument models:**
- **YourMT3+:**
  - ENST DTM onset F1 87.27 vs MT3 70.31.
  - Slakh drums onset F1 90.05, vs 83.85 for MT3 (Colab) and 78.5 for Perceiver-TF ([YourMT3+](https://arxiv.org/html/2407.04822)).
  - MT3's own Table 2 treats drums onset-only ([MT3](https://arxiv.org/pdf/2111.03017)).

**Toolkits:**
- **ADTLib** (BSD-2-Clause): 3 classes (kick/snare/hi-hat) plus auto drum tab; older RNN/CNN models ([repo](https://github.com/CarlSouthall/ADTLib)).
- **omnizart** (MIT): has a drum mode. The repo notes drum-model training bugs, though the shipped checkpoints work, and it is not ARM-Mac compatible ([repo](https://github.com/Music-and-Culture-Technology-Lab/omnizart)).
- **madmom** (code BSD, models CC-BY-NC-SA-4.0): an onset/beat library. Its README lists no drum transcription model ([repo](https://github.com/CPJKU/madmom)).
- **Magenta Onsets & Frames drums** (E-GMD checkpoint): the repo was archived 2026-01-06 ([README](https://github.com/magenta/magenta/blob/main/magenta/models/onsets_frames_transcription/README.md)).
- **ADTOF-pytorch:** inference-only PyTorch port, ~−0.2% F-measure vs the original ([ADTOF repo](https://github.com/MZehren/ADTOF)). The port bundles model weights but has no license file ([repo](https://github.com/xavriley/ADTOF-pytorch)). The weights are derived from CC-BY-NC-SA-4.0 ADTOF.

### 4. Mapping to drum notation
- **Internal representation:** General MIDI percussion keys (e.g. 36 kick, 38 snare, 42 closed HH, 46 open HH, 49 crash, 51 ride) plus velocity.
- **Groove MIDI uses Roland TD-11 mappings that differ from GM.** The dataset page warns of the discrepancies and provides a simplified class mapping ([GMD](https://magenta.tensorflow.org/datasets/groove)).
- **Notation:**
  1. Quantize onsets to the beat grid (`chords-beats-key-structure.md`).
  2. Assign staff positions and noteheads (x for cymbals/hi-hats).
  3. Choose voices (hands up, feet down).
  4. Write MusicXML percussion or Guitar Pro drum tracks. alphaTab renders both ([alphaTab](https://github.com/CoderLine/alphaTab)).
  5. Render as covered in `research/ux/music-display-ui.md`.
- **Inference:** 5-class output forces a choice for the "cymbals" and "toms" classes. Default cymbals to crash on downbeats and ride otherwise, and default toms to a single tom line, unless kit separation is run. Flag these as "approximate" in the UI.

### 5. Models summary

| model | task | input | reported metric (dataset) | code license | weights license | training-data license | commercial use | production-readiness |
|---|---|---|---|---|---|---|---|---|
| ADTOF CRNN (Zehren et al.) | 5-class ADT | drum stem or mix | 0.87 MDB / 0.84 ENST ([Riley & Dixon](https://arxiv.org/html/2509.24853)) | **CC-BY-NC-SA-4.0** ([repo](https://github.com/MZehren/ADTOF)) | same (repo) | crowdsourced charts + copyrighted audio | **No** without licence from authors | Research-mature; TF; PyTorch port |
| Riley & Dixon 2025 pipeline | 7-class ADT + velocity | mix → Demucs → DrumSep | 0.84 MDB 8-class-eval ([HTML](https://arxiv.org/html/2509.24853)) | no code found | inherits ADTOF/DrumSep | as above | No (NC) | Research recipe; reproducible |
| N2N (Sony, ICASSP 2026) | ADT + velocity, diffusion | drum audio | 87.86 MDB, 89.68 E-GMD ([HTML](https://arxiv.org/html/2509.21739)) | no code found | n/a | E-GMD CC-BY-4.0 (+ foundation-model features, license unverified) | n/a | Research |
| Onsets & Frames Drums (Magenta) | 7-class + velocity | drum audio | 83.40 E-GMD / 75.19 MDB ([N2N table](https://arxiv.org/html/2509.21739)) | Apache-2.0 (archived) | not stated | E-GMD CC-BY-4.0 | plausible (CC-BY data) | Legacy TF1 |
| hFT-Transformer (drums) | ADT + velocity | drum audio | 86.31 E-GMD / 70.81 MDB ([N2N table](https://arxiv.org/html/2509.21739)) | MIT ([repo](https://github.com/sony/hFT-Transformer)) | not stated | E-GMD CC-BY-4.0 | plausible if self-trained | Research |
| STAR Drums CRNN | 18/8/5/3-class ADT | mix | 0.79 MDB, 5-class ([TISMIR](https://transactions.ismir.net/articles/10.5334/tismir.244)) | dataset tools only; model release not mentioned | n/a | STAR Drums (redistributable sources; exact license unverified) | possible if retrained | Dataset is the asset |
| YourMT3+ | drums within multi-instr. | mix | ENST DTM 87.27 ([HTML](https://arxiv.org/html/2407.04822)) | GPL-3.0 | Apache-2.0 per HF (conflict) | includes NC data | risky | Research |
| ADTLib | 3-class ADT + drum tab | drum audio | not reported | BSD-2-Clause ([repo](https://github.com/CarlSouthall/ADTLib)) | in package | unverified | possible | Old; simple |
| omnizart drum | ADT | audio | not reported | MIT ([repo](https://github.com/Music-and-Culture-Technology-Lab/omnizart)) | not stated | unverified | review | Research toolkit, known bugs |

## 2026-10 re-check (step 25, Phase 0)
Checked on 2026-10-28 against GitHub, Hugging Face and Zenodo file listings. Personal mode (`specs/25`) makes licences a provenance record, so they're noted, not weighed. Paper numbers below are hypotheses for P2d to test, not results.

### Transcribers

| candidate | weights | classes / input | front end | velocity | island | verdict |
|---|---|---|---|---|---|---|
| **ADTOF-pytorch** ([repo](https://github.com/xavriley/ADTOF-pytorch), last commit 2025-11-11) | `adtof_frame_rnn_pytorch_weights.pth`, 3.6 MB, bundled: a conversion of `Frame_RNN_adtofAll_0`, the only checkpoint the TF repo ships (trained on all ADTOF sets combined; no separate RGW or YT model) | 5: BD 35, SD 38, TT 47, HH 42, CY+RD 49; trained on mixtures, also runs on stems | 44.1 kHz mono, 100 fps, 168-bin log filterbank | no | torch + librosa | **Baseline.** MDBDrums++ F 88.51 vs 88.74 for TF. Per-class thresholds `[0.22, 0.24, 0.32, 0.22, 0.30]` (BD, SD, TT, HH, CY), madmom-style peak picking (pre_avg 0.1, post_avg 0.01, pre_max 0.02, post_max 0.01, combine 0.02 s). Its CLI only accepts cuda/cpu, so MPS goes through the Python API |
| ADTOF (TF original, [repo](https://github.com/MZehren/ADTOF)) | `Frame_RNN_adtofAll_0`, 5.4 MB | same | same | no | TF + madmom | Not used; the PyTorch port is within 0.2 F |
| **ADT_STR** ([arXiv 2601.09520](https://arxiv.org/abs/2601.09520), [weights](https://huggingface.co/Pierfrancesco/adt-str)) | 3 × 289 MB safetensors (`setting-tau-0.4/0.6/0.8`), CC-BY-SA-4.0 | 26 GM-merged classes; trained on synthesized Lakh drums, evaluated on drum-only audio, so drum stem only | 24 kHz, 128 mels, 10 ms, autoregressive enc-dec | yes | torch + transformers + torchcodec | **Phase 3 candidate**: the only new model with weights; its kit detail and velocity are worth measuring, its real-music accuracy is unknown |
| **YourMT3+** (already in the torch island) | existing `yourmt3-moe` checkpoint | drums as program 128 with full GM pitches → 5-class mapping possible; mixture at 16 kHz | — | no | torch (shipped) | **Reference row** on mixture and stem. Repo evaluates only kick/snare/hi-hat, so toms and cymbals are unknown. In-sample on ENST and Slakh |
| STAR Drums CRNN | **none released** (dataset only: [Zenodo 15690078](https://doi.org/10.5281/zenodo.15690078), 181 GB, BSD-3) | — | — | — | — | Out |
| N2N (Sony, ICASSP 2026) | **none released** (arXiv v2 2026-03) | — | — | — | — | Out |
| Separate-and-Detect (ISMIR 2026) | 2 × 5.4 GB latent-diffusion checkpoints + MusicLDM VAE | 5-stem diffusion separation + madmom onsets | — | no | own conda env, Python 3.9/3.10 | Out: far too slow for the worker budget |
| Inverse Drum Machine ([arXiv 2505.03337](https://arxiv.org/abs/2505.03337)) | 2.5 MB checkpoint in repo | trained on StemGMD drum loops | 44.1 kHz | yes | torch | Out: drum loops only, no real-music result |
| OaF-Drums, hFT-Transformer, ADTLib, omnizart | unchanged since 2026-10-20 | | | | | Out (E-GMD-only models are 70–75 F on MDB; the toolkits are older or unbenchmarked) |

### Kit separators (drum stem → kit pieces, for the 7-class expansion)

| checkpoint | stems | size | where |
|---|---|---|---|
| `MDX23C-DrumSep-aufr33-jarredou.ckpt` | kick, snare, toms, hh, ride, crash (SDR 14.5 / 9.8 / 10.6 / 3.2 / 6.1 cymbals) | 438 MB | python-audio-separator ≥ 0.47 model list (we pin 0.44.5; the checkpoint and config download from its `model-configs` release either way) |
| `drumsep_5stems_mdx23c_jarredou.ckpt` (2025) | kick, snare, toms, hh, cymbals (16.7 / 11.5 / 12.3 / 4.0 / 6.4) | 438 MB | [HF mirror](https://huggingface.co/xavriley/source_separation_mirror) |
| `model_drumsep.th` (inagoy HDemucs) | kick, snare, cymbals, toms | 167 MB | MSST release v1.0.5 |

The Riley & Dixon pipeline needs ride/crash and open/closed hi-hat separately, so only the 6-stem MDX23C gives crash vs ride; open/closed hi-hat comes from post-processing the hh stem (their code: [adtof_plus_drum_transcription](https://github.com/xavriley/adtof_plus_drum_transcription), needs essentia). jarredou's own GitHub releases now 404; MVSep's better Mel-Roformer/SCNet drumsep models are service-only.

### Drum stem from a mix
Drums SDR (multisong / MUSDB): htdemucs_ft 11.13 / 10.0; BS-Roformer (ZFTurbo) 11.29 / 11.61; **SCNet XL IHF** 11.58 / 11.81 (214 MB, MSST release v1.0.15). BS-Roformer-SW (shipped first in the chain) has no published drums score. Phase 3 compares the shipped chain with SCNet XL IHF by downstream hit F1.

### Datasets for P2d

| dataset | use | download | licence |
|---|---|---|---|
| MDB Drums | real: drum stem + mix, 21 sub-classes (kit-piece subset) | 1.4 GB, GitHub | CC-BY-NC-SA-4.0 |
| ENST-Drums | real: 3 drummers, minus-one accompaniment, brushes/mallets/sticks | 4.2 GB audio, [Zenodo 7432188](https://zenodo.org/records/7432188) | CC-BY-NC-ND-4.0 |
| IDMT-SMT-Drums v2 | real + drum machine loops, 3 classes, solo drums | 0.29 GB, [Zenodo 7544164](https://zenodo.org/records/7544164) | CC-BY-NC-ND-4.0 |
| RBMA13 | electronic/produced music | annotations 160 KB ([TU Wien](https://www.ifs.tuwien.ac.at/~vogl/datasets/)); audio is the free RBMA Bandcamp album, which the owner downloads | annotations research use |
| Groove MIDI (MIDI only) | human performances with exact references (swing, fills, brushes-style jazz, half-time), to render | 3.3 MB | CC-BY-4.0 |
| MUSDB18-HQ | accompaniment (bass, other, vocals) for rendered drums; drums SDR | 22.7 GB, Zenodo 3338373 | research use |
| Slakh2100 test split (optional) | synthetic band drums | stream of the 104 GB archive, 7.5 GB kept (as step 24 did) | CC-BY-4.0 |
| E-GMD, STAR Drums, StemGMD, MoisesDB | not needed for a test set (96 / 181 / 187+ / ~83 GB) | — | — |

In-sample warnings: ADTOF-All's training sets are to be confirmed from the ADTOF paper in Phase 1 (rhythm-game charts on commercial songs; MDB and ENST are its published test sets); YourMT3+ trained on ENST and Slakh; ADT_STR on synthesized Lakh (Slakh's MIDI source). Reports label those rows.

## Implications for Splitune
- **Pipeline:**
  1. Drum stem from separation (`source-separation.md`).
  2. 5-class transcription.
  3. Optional kit separation for 7 classes.
  4. Beat-grid quantization.
  5. Drum notation plus a lane/"highway" view.
- **Licensing path (pick one, decide early):**
  - (a) Negotiate a commercial licence for ADTOF weights.
  - (b) Train our own CRNN on **E-GMD + Groove MIDI + Slakh (all CC-BY-4.0)** plus STAR Drums (if its license permits) and in-house recordings. Use N2N-style foundation-model features or heavy mixing augmentation to close the real-music gap.
  - (c) Use a commercial API (see `research/market/competitor-landscape.md` for vendors).
- **UX:** hi-hat open/closed and crash/ride distinctions are unreliable. Show them as suggestions. Practice value for beginners comes from groove and timing, not exact cymbal identity.

## Open questions
- **Licensing:** will the ADTOF authors license weights commercially? What is the exact license of the STAR Drums Zenodo release? Is the ENST-Drums license clear (page unreachable)?
- **Domain gap:** how large is it between E-GMD-trained models and YouTube drum covers? Build an internal test set by recording a MIDI-pad drummer playing along to songs.
- **Velocity on real music:** can velocity estimated from separated stems (Riley & Dixon) produce usable ghost-note and accent marks?

## Sources
- [STAR Drums (TISMIR 2025)](https://transactions.ismir.net/articles/10.5334/tismir.244) — tier 1, accessed 2026-10-20
- [Riley & Dixon, Enhanced ADT via Drum Stem Source Separation (arXiv HTML)](https://arxiv.org/html/2509.24853) — tier 1, accessed 2026-10-20
- [Yeung et al., Noise-to-Notes (arXiv HTML)](https://arxiv.org/html/2509.21739) — tier 1, accessed 2026-10-20
- [MZehren/ADTOF (GitHub)](https://github.com/MZehren/ADTOF) — tier 1, accessed 2026-10-20
- [xavriley/ADTOF-pytorch (GitHub)](https://github.com/xavriley/ADTOF-pytorch) — tier 1, accessed 2026-10-20
- [CPJKU/madmom (GitHub)](https://github.com/CPJKU/madmom) — tier 1, accessed 2026-10-20
- [CarlSouthall/MDBDrums (GitHub)](https://github.com/CarlSouthall/MDBDrums) — tier 1, accessed 2026-10-20
- [CarlSouthall/ADTLib (GitHub)](https://github.com/CarlSouthall/ADTLib) — tier 1, accessed 2026-10-20
- [omnizart (GitHub)](https://github.com/Music-and-Culture-Technology-Lab/omnizart) — tier 1, accessed 2026-10-20
- [E-GMD dataset page](https://magenta.tensorflow.org/datasets/e-gmd) — tier 1, accessed 2026-10-20
- [Groove MIDI dataset page](https://magenta.tensorflow.org/datasets/groove) — tier 1, accessed 2026-10-20
- [Slakh2100 on Zenodo](https://zenodo.org/records/4599666) — tier 1, accessed 2026-10-20
- [Onsets and Frames README (Magenta)](https://github.com/magenta/magenta/blob/main/magenta/models/onsets_frames_transcription/README.md) — tier 1, accessed 2026-10-20
- [sony/hFT-Transformer (GitHub)](https://github.com/sony/hFT-Transformer) — tier 1, accessed 2026-10-20
- [Chang et al., YourMT3+ (arXiv HTML)](https://arxiv.org/html/2407.04822) — tier 1, accessed 2026-10-20
- [Gardner et al., MT3 (arXiv PDF)](https://arxiv.org/pdf/2111.03017) — tier 1, accessed 2026-10-20
- [CoderLine/alphaTab (GitHub)](https://github.com/CoderLine/alphaTab) — tier 1, accessed 2026-10-20
