---
title: ML datasets, evaluation metrics, and the licensing framework
workstream: ml
last_researched: 2026-10-20
confidence: medium
---

# ML datasets, evaluation metrics, and the licensing framework

## TL;DR
- **Licensing has three separate layers: code, weights and training data.** An MIT repo says nothing about its checkpoints, and a permissive weights tag says nothing about the data's rights. Record all three for every model Splitune touches (template below).
- **Most canonical MIR training sets are non-commercial:** MUSDB18/HQ, MoisesDB, MedleyDB, MAESTRO, MDB Drums, MTG-Jamendo, RWC (research-only, paid) and most CompMusic sets. **Commercially friendly sets** include Slakh2100, GuitarSet, Groove MIDI, E-GMD, NSynth and OpenMIC-2018 (all CC-BY-4.0), plus Billboard and SALAMI annotations (CC0-1.0). Several of these carry only annotations or synthesised audio.
- **Default rule:** treat weights trained on NC data as not commercially usable unless the rights holder grants otherwise. Creative Commons itself says licence conditions bind only where copyright permission is needed, and NC turns on "primarily intended for commercial advantage". Whether training is such a use, and whether weights are an adaptation, is legally unsettled.
- **Separation metrics come in families that are not comparable:**
  - cSDR: museval, median of 1-s chunks, then median over tracks. Used in papers on MUSDB18.
  - uSDR or global SDR: full-signal ratio averaged over songs. Used in MDX'21 and SDX'23.
  - SI-SDR: scale-invariant variant.
  - Rough ladder: about 6.5 dB 4-stem average (Spleeter, 2019) to about 9–10 dB (current state of the art). Under about 0.3 dB is within noise, and SDR correlates poorly with listener preference.
- **Transcription, chord and beat metrics come from `mir_eval` with fixed defaults:**
  - Notes: 50 ms onset, 50 cents pitch; offset tolerance is max(20% of note duration, 50 ms); velocity tolerance 0.1 after linear rescaling.
  - Beats: ±70 ms F-measure, ignoring the first 5 s.
  - Chords: duration-weighted chord symbol recall under named vocabularies (root, majmin, sevenths, …).
  - Always report which variant you used.

## Findings

### 1. Licensing framework (referenced by all ML docs)

**Three layers:**
| Layer | Question | Typical values | Where to check |
|---|---|---|---|
| Code | Can we run, modify and ship the inference or training code? | MIT, Apache-2.0, BSD-3-Clause; occasionally GPL-3.0 or AGPL-3.0 (e.g. Essentia library: AGPL-3.0 with a commercial licence on request ([Essentia](https://essentia.upf.edu/licensing_information.html))) | LICENSE file in repo |
| Weights | Can we use the trained parameters in a product? | Often unstated (not open by default); explicit: MIT (Spleeter ([JOSS](https://joss.theoj.org/papers/10.21105/joss.02154.pdf))), CC-BY-4.0 (PANNs ([Zenodo](https://zenodo.org/records/3987831))), CC-BY-NC-4.0 (MERT ([HF](https://huggingface.co/m-a-p/MERT-v1-330M))), CC-BY-NC-SA-4.0 (Open-Unmix `umxl` ([README](https://github.com/sigsep/open-unmix-pytorch))), custom (Meta SAM License ([LICENSE](https://github.com/facebookresearch/sam-audio/blob/main/LICENSE))) | Model card, release notes, Zenodo/HF metadata |
| Training data | Were the inputs licensed for this use, and does that restrict outputs? | CC-BY-4.0, CC-BY-NC-SA-4.0, "research only", undisclosed or private | Dataset page or paper; model paper's data section |

**How NC data affects derived weights (evidence vs inference):**
- *Evidence:* the Creative Commons FAQ says CC licences grant permission only "in any situation that requires permission under copyright". Uses that copyright does not control, such as text and data mining that the FAQ notes is considered fair use in the US, do not need to comply with licence conditions. Whether a use violates NC depends on whether it is "primarily intended for commercial advantage". ShareAlike applies only when an adapted work is shared ([CC FAQ](https://creativecommons.org/faq/)). The FAQ does not say whether a trained model is an "adaptation".
- *Evidence:* dataset owners write their own restrictions on top of CC:
  - MUSDB18-HQ "should not be used for any commercial purpose without the express permission of the copyright holders" and is "provided for educational purposes only" ([Zenodo](https://zenodo.org/records/3338373)).
  - MedleyDB is "free of charge for non-commercial research use only" ([Zenodo](https://zenodo.org/records/1649325)).
  - MTG-Jamendo is "solely for non-commercial research and academic use" ([repo](https://github.com/MTG/mtg-jamendo-dataset)).
  - RWC "may not be used for any purpose other than research" ([RWC](https://staff.aist.go.jp/m.goto/RWC-MDB/)).
  - These are contractual or access terms, not just copyright licences, so a fair-use argument may not override them.
- *Evidence:* model authors sometimes propagate the restriction. Open-Unmix `umxl` weights are "only licensed for non-commercial use (CC BY-NC-SA 4.0)" ([README](https://github.com/sigsep/open-unmix-pytorch)).
- *Inference / recommendation:* classify models into:
  - **Green:** permissive code, explicit permissive weights, and data licensed for commercial use or owned by the grantor. Examples: Spleeter; a model Splitune trains on licensed data.
  - **Amber:** permissive or unstated weights, but NC or undisclosed data. Examples: HT-Demucs, most community RoFormer and SCNet checkpoints, AudioSet-trained taggers. Amber is fine for R&D and benchmarking; production use needs counsel sign-off.
  - **Red:** weights explicitly NC, or a non-commercial library licence. Examples: `umxl`, MERT, Essentia models. Do not ship.
  - Legal context is in `legal/youtube-copyright-and-platform-policy.md`.

**Model provenance record (use for every model):** `name, version, repo_url, code_spdx, weights_licence, weights_url, training_data[] (name, licence, commercial_ok), eval{dataset, metric, value, date}, tier(green|amber|red), reviewer, date`.

### 2. Dataset catalogue
Commercial-use column: **Yes** = licence permits commercial use with attribution; **No** = NC, research-only or explicit prohibition; **Unclear** = no stated licence or conflicting sources.

| Dataset | Task(s) | Size / content | Licence (as stated) | Commercial use | Source |
|---|---|---|---|---|---|
| **MUSDB18 / MUSDB18-HQ** | Separation (V/D/B/O) | 150 tracks (100 train / 50 test), ~10 h, 44.1 kHz stereo. MUSDB18 is AAC 256 kb/s at 16 kHz bandwidth; HQ is WAV | Zenodo "Other (Non-Commercial)": academic/educational use only; commercial use requires permission from the copyright holders (SigSep: tracks "can only be used for academic purposes"). Per-track: 100 from DSD100 (Mixing Secrets terms), 46 from MedleyDB (CC-BY-NC-SA-4.0), 2 CC-BY-NC-SA-3.0, 2 unstated | **No** (without permission) | [SigSep](https://sigsep.github.io/datasets/musdb.html), [Zenodo](https://zenodo.org/records/3338373) |
| **MoisesDB** | Separation beyond 4 stems | 240 songs, 14 h 24 min. 11 top-level stems (incl. guitar, piano, other keys, bowed strings, wind). Unmastered mixes | CC-BY-NC-SA-4.0; "non-commercial research use only". **Conflict:** abstract says 45 artists, body says 47 | **No** | [repo](https://github.com/moises-ai/moises-db), [paper](https://arxiv.org/pdf/2307.15913), [abs](https://arxiv.org/abs/2307.15913) |
| **MedleyDB 1.0/2.0** | Separation, melody f0, instrument activation | 122 + 74 = 196 multitracks; melody for 108; activations for 122 | CC-BY-NC-SA-4.0, non-commercial research only | **No** | [site](https://medleydb.weebly.com/), [Zenodo](https://zenodo.org/records/1649325) |
| **Slakh2100** (redux) | Separation, multi-instrument transcription | 2,100 tracks rendered from Lakh MIDI, 145 h, aligned MIDI | CC-BY-4.0 | **Yes** (synthetic audio; check sample-library terms, unverified) | [Zenodo](https://zenodo.org/records/4599666) |
| **MAESTRO v3.0.0** | Piano transcription | 1,276 performances, ~198.7 h, ~3 ms audio–MIDI alignment | CC-BY-NC-SA-4.0 | **No** | [Magenta](https://magenta.tensorflow.org/datasets/maestro) |
| **GuitarSet** | Guitar transcription (string/fret), chords, beats | Acoustic guitar, hexaphonic pickup, per-string audio and annotations; 8.2 GB | CC-BY-4.0 on Zenodo. **Conflict:** mirdata lists MIT ([mirdata](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html)) | **Yes** (both licences permissive) | [Zenodo](https://zenodo.org/records/3371780) |
| **EGDB** | Electric guitar transcription | 240 tablatures rendered with different tones (DI re-amped; "6 timbres × 118 min" seen only in a search snippet, unverified) | Not stated on arXiv page | **Unclear** | [arXiv](https://arxiv.org/abs/2202.09907) |
| **ENST-Drums** | Drum transcription and separation | 3 drummers, ~75 min each, 8 audio channels + 2 video | Custom user licence (must accept before download); paper: "for a large part, freely distributed for research purposes" | **Unclear / likely No** | [ADASP](http://adasp.telecom-paris.fr/resources/2009-11-25-enst-drums/), [ISMIR 2006](https://archives.ismir.net/ismir2006/paper/000027.pdf) |
| **MDB Drums** | Drum transcription | 23 MedleyDB tracks, 7,994 onsets, 6 classes / 21 subclasses | CC-BY-NC-SA-4.0 | **No** | [repo](https://github.com/CarlSouthall/MDBDrums) |
| **Groove MIDI (GMD)** | Drum generation and transcription | ~13.6 h, 10 drummers, 1,150 MIDI files + synthesised audio | CC-BY-4.0 (Magenta). **Conflict:** mirdata lists CC-BY-SA-4.0 | **Yes** (attribution; possibly SA) | [Magenta](https://magenta.tensorflow.org/datasets/groove) |
| **E-GMD** | Drum transcription | ~444 h audio, 43 kits | CC-BY-4.0 | **Yes** | [Magenta](https://magenta.tensorflow.org/datasets/e-gmd) |
| **Isophonics (Beatles, Queen, Carole King, Zweieck)** | Chords, keys, segments, beats | Annotations only; audio is commercial CDs | No licence stated (mirdata: none) | **Unclear** (annotations); audio **No** | [Isophonics](http://isophonics.net/content/reference-annotations) |
| **Billboard (McGill)** | Chords, sections | Annotations | CC0-1.0 (per mirdata) | **Yes** (annotations only) | [mirdata](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html) |
| **SALAMI** | Structure | Annotations | CC0-1.0 (per mirdata) | **Yes** (annotations only) | [mirdata](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html) |
| **Harmonix Set** | Beats, downbeats, segments | 912 pop tracks; annotations + YouTube URLs + mel-spectrograms (separate licence) | Repo MIT; spectrogram licence separate | **Annotations yes; audio not provided** | [repo](https://github.com/urinieto/harmonixset) |
| **RWC Music Database** | Many (chords, beats, instruments) | 315 pieces + instrument sounds; paid (¥8,000–15,000 per subset) | Research-only; no redistribution; AIST holds copyright | **No** | [RWC](https://staff.aist.go.jp/m.goto/RWC-MDB/) |
| **MagnaTagATune** | Auto-tagging | MP3 clips with game-collected tags | Not stated on host page (unverified) | **Unclear** | [City MIRG](https://mirg.city.ac.uk/codeapps/the-magnatagatune-dataset) |
| **FMA** | Genre, tagging, audio pool | 106,574 tracks (~343 days) | Metadata CC-BY-4.0; audio under each artist's licence; "meant for research purposes" | **Per-track** (filter CC-BY/CC0 only) | [repo](https://github.com/mdeff/fma) |
| **OpenMIC-2018** | Instrument recognition | 20,000 × 10 s FMA clips, 20 classes, partial labels | CC-BY-4.0 | **Yes** (check per-clip FMA audio licences) | [Zenodo](https://zenodo.org/records/1432913), [paper](https://ismir2018.ismir.net/doc/pdfs/248_Paper.pdf) |
| **AudioSet** | Sound and instrument tagging | ~2.09M segments, 527 classes; YouTube IDs + features only | Labels CC-BY-4.0; ontology CC-BY-SA-4.0; audio not distributed | Labels **Yes**; audio rights **Unclear** | [AudioSet](https://research.google.com/audioset/download.html) |
| **NSynth** | Instrument notes | 305,979 notes, 1,006 instruments | CC-BY-4.0 | **Yes** | [Magenta](https://magenta.tensorflow.org/datasets/nsynth) |
| **MTG-Jamendo** | Tagging (genre, 40 instrument tags, mood) | 55,525 tracks | Metadata CC-BY-NC-SA-4.0; audio various CC; NC research only | **No** | [repo](https://github.com/MTG/mtg-jamendo-dataset) |
| **IRMAS** | Predominant instrument | – | CC-BY-NC-SA-3.0 (per mirdata) | **No** | [mirdata](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html) |

Domain-specific details live in the task docs: `ml/transcription-guitar-and-bass-tabs.md`, `ml/transcription-piano.md`, `ml/transcription-drums.md`, `ml/transcription-vocals-melody.md`, `ml/chords-beats-key-structure.md`.

### 3. Metrics

#### 3a. Source separation
- **SDR (BSS Eval v4, `museval`):** the energy ratio of the target to all distortion, after allowing a short distortion filter. Papers on MUSDB18 report the **median over 1-s chunks per track, then the median over tracks**. This is often called **cSDR** ([Mel-RoFormer paper](https://arxiv.org/html/2310.01809)). BSS Eval also yields SIR (interference), SAR (artefacts) and ISR (spatial image), for example Spleeter's full table ([JOSS](https://joss.theoj.org/papers/10.21105/joss.02154.pdf)).
- **Global SDR, also called uSDR or utterance SDR:** `10·log10((Σ‖s‖²+ε)/(Σ‖s−ŝ‖²+ε))` with ε=1e-7 over the whole song. Stems are averaged per song, then songs are averaged. MDX'21 adopted it because it is cheaper and avoids BSS Eval v4's dropping of silent frames, which makes per-source scores interdependent ([MDX'21 paper](https://arxiv.org/html/2108.13559v3)). SDX'23 also ranked on it ([TISMIR](https://transactions.ismir.net/articles/171)).
- **SI-SDR:** a scale-invariant SDR, proposed because classic SDR can be "improperly used and abused", especially for single-channel separation. The authors warn that 0.1 dB differences are not meaningful ([Le Roux et al.](https://arxiv.org/abs/1811.02508)).
- **What "good" looks like:**

  | Level | 4-stem avg (cSDR, MUSDB18-HQ) | Vocals | Example |
  |---|---|---|---|
  | 2019 baseline | ~5–6.5 | 6.3–6.9 | Open-Unmix `umxhq`, Spleeter ([UMX](https://github.com/sigsep/open-unmix-pytorch), [JOSS](https://joss.theoj.org/papers/10.21105/joss.02154.pdf)) |
  | 2021–22 | ~7.7–9.0 | ~8 | HDemucs 7.72, HT-Demucs 9.0 ([Mel-RoFormer T1](https://arxiv.org/html/2310.01809), [Demucs](https://github.com/facebookresearch/demucs)) |
  | 2023–25 SOTA | ~9.7–10.0 | ~10.7–11.6 | BS-/Mel-RoFormer, SCNet-L, Moises-Light ([Moises-Light T4](https://arxiv.org/html/2510.06785v1)) |
  | Guitar / piano (MoisesDB) | – | – | `htdemucs_6s` 3.07 / 1.60 dB; oracle IRM ~5 dB ([MoisesDB T3](https://arxiv.org/pdf/2307.15913)) |

- **Perceptual caveat:** in SDX'23's listening test, professionals saw no clear correlation between SDR differences and their preferences ([TISMIR](https://transactions.ismir.net/articles/171)). Pair SDR with blind A/B tests.

#### 3b. Note-level transcription (`mir_eval.transcription`)
- **Matching:** a reference note matches at most one estimate (maximum bipartite matching). Defaults are onset within **50 ms** and pitch within **50 cents** ([mir_eval transcription](https://mir-eval.readthedocs.io/latest/api/transcription.html)).
- **Onset F1** ("note" F1): `precision_recall_f1_overlap(..., offset_ratio=None)`, which checks onset and pitch. `onset_precision_recall_f1` ignores pitch entirely ([mir_eval](https://mir-eval.readthedocs.io/latest/api/transcription.html)).
- **Onset+offset F1** ("note with offset"): adds offset within max(**0.2 × reference duration**, **50 ms**) ([mir_eval](https://mir-eval.readthedocs.io/latest/api/transcription.html)).
- **Onset+offset+velocity F1:** reference velocities are scaled to 0–1, and estimates are fitted by one global linear regression. A match also needs |Δvelocity| ≤ **0.1**. This follows Onsets & Frames ([mir_eval transcription_velocity](https://mir-eval.readthedocs.io/latest/api/transcription_velocity.html)).
- Frame-level metrics and tablature metrics (string and fret accuracy) are covered in `ml/transcription-general.md` and `ml/transcription-guitar-and-bass-tabs.md`. Typical "good" scores per instrument are in those docs.

#### 3c. Chords (`mir_eval.chord`)
- **Weighted chord symbol recall (WCSR):** per-segment comparison scores, weighted by duration ([mir_eval chord](https://mir-eval.readthedocs.io/latest/api/chord.html)). The vocabulary must be stated:
  - `root`
  - `majmin`: major, minor and no-chord only
  - `mirex`: at least 3 shared pitch classes
  - `thirds`, `triads`
  - `sevenths`: maj, maj7, 7, min, min7, N
  - `tetrads`
  - `_inv` variants also require the bass note
- **Segmentation quality:** `overseg`, `underseg`, `seg` = min of the two ([mir_eval chord](https://mir-eval.readthedocs.io/latest/api/chord.html)). Benchmarks and model numbers are in `ml/chords-beats-key-structure.md`.

#### 3d. Beats and downbeats (`mir_eval.beat`)
- **F-measure:** an estimate is correct within **±70 ms** of a reference beat. Beats before **5 s** are trimmed by convention ([mir_eval beat](https://mir-eval.readthedocs.io/latest/api/beat.html)).
- **Continuity metrics:** CMLc/CMLt (correct metrical level) and AMLc/AMLt (any metrical level, allowing double, half or off-beat tempo). Also Cemgil (Gaussian σ = 40 ms), Goto, P-score and Information Gain ([mir_eval beat](https://mir-eval.readthedocs.io/latest/api/beat.html)). For a practice app, AMLt-type errors (half or double tempo) are less harmful than phase errors. This is an inference; validate it with users.

#### 3e. Instrument recognition
- **mAP over classes,** the standard for OpenMIC-2018 and AudioSet (e.g. DyMN-L 85.5 on OpenMIC ([paper](https://arxiv.org/html/2310.15648))). ROC-AUC and PR-AUC are used on MTG-Jamendo ([MERT](https://arxiv.org/html/2306.00107)). Frame-level detection uses segment-based F1 (see `ml/instrument-recognition.md`).

## Implications for Splitune
- **Training-data strategy:** a Splitune-owned production model needs licensed or owned data. Candidates are Slakh2100, GuitarSet, E-GMD, NSynth and OpenMIC (all CC-BY), plus purchased or licensed multitracks and consented user recordings. NC sets are evaluation-only and should not be used in production training.
- **Evaluation sets:** NC sets such as MUSDB18-HQ, MoisesDB and MAESTRO can still serve for internal benchmarking (research use). Keep evaluation and training pipelines and their artefacts separate, and document it.
- **Model registry:** enforce the green/amber/red classification in CI or release checks. No red model ships, and amber models need recorded sign-off.
- **Reporting:** every ML doc and dashboard states dataset, metric variant (cSDR vs uSDR; onset vs onset+offset F1; WCSR vocabulary), version and date.

## Open questions
- Does Splitune's counsel accept fair-use or TDM arguments for training on NC or YouTube-derived data in its launch markets (US, EU, others)? This decides the amber tier.
- Can MUSDB18 and MoisesDB rights holders (Moises/Music.AI, Mixing Secrets) license commercial training? Ask directly.
- Several licences need resolving from primary text: EGDB, ENST-Drums (custom licence PDF), Isophonics annotations, MagnaTagATune, and the GuitarSet and Groove MIDI conflicts. Read each LICENSE file and email the maintainers.
- Slakh2100 audio is rendered with commercial sample libraries; check whether the CC-BY-4.0 grant covers commercial reuse of the rendered audio.

## Sources
- [Essentia licensing information](https://essentia.upf.edu/licensing_information.html) — tier 1, accessed 2026-10-20
- [Spleeter JOSS paper PDF](https://joss.theoj.org/papers/10.21105/joss.02154.pdf) — tier 1, accessed 2026-10-20
- [PANNs weights on Zenodo](https://zenodo.org/records/3987831) — tier 1, accessed 2026-10-20
- [m-a-p/MERT-v1-330M model card](https://huggingface.co/m-a-p/MERT-v1-330M) — tier 1, accessed 2026-10-20
- [sigsep/open-unmix-pytorch](https://github.com/sigsep/open-unmix-pytorch) — tier 1, accessed 2026-10-20
- [SAM License](https://github.com/facebookresearch/sam-audio/blob/main/LICENSE) — tier 1, accessed 2026-10-20
- [Creative Commons FAQ](https://creativecommons.org/faq/) — tier 2, accessed 2026-10-20
- [MUSDB18-HQ on Zenodo](https://zenodo.org/records/3338373) — tier 1, accessed 2026-10-20
- [MedleyDB audio on Zenodo](https://zenodo.org/records/1649325) — tier 1, accessed 2026-10-20
- [MTG/mtg-jamendo-dataset](https://github.com/MTG/mtg-jamendo-dataset) — tier 1, accessed 2026-10-20
- [RWC Music Database](https://staff.aist.go.jp/m.goto/RWC-MDB/) — tier 1, accessed 2026-10-20
- [SigSep MUSDB18 dataset page](https://sigsep.github.io/datasets/musdb.html) — tier 1, accessed 2026-10-20
- [moises-ai/moises-db repo](https://github.com/moises-ai/moises-db) — tier 1, accessed 2026-10-20
- [MoisesDB paper PDF (arXiv:2307.15913)](https://arxiv.org/pdf/2307.15913) — tier 1, accessed 2026-10-20
- [MoisesDB arXiv abstract](https://arxiv.org/abs/2307.15913) — tier 1, accessed 2026-10-20
- [MedleyDB site](https://medleydb.weebly.com/) — tier 1, accessed 2026-10-20
- [Slakh2100 on Zenodo](https://zenodo.org/records/4599666) — tier 1, accessed 2026-10-20
- [MAESTRO dataset](https://magenta.tensorflow.org/datasets/maestro) — tier 1, accessed 2026-10-20
- [GuitarSet on Zenodo](https://zenodo.org/records/3371780) — tier 1, accessed 2026-10-20
- [mirdata quick reference (dataset licences)](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html) — tier 2, accessed 2026-10-20
- [EGDB paper (arXiv:2202.09907)](https://arxiv.org/abs/2202.09907) — tier 1, accessed 2026-10-20
- [ENST-Drums page (ADASP)](http://adasp.telecom-paris.fr/resources/2009-11-25-enst-drums/) — tier 1, accessed 2026-10-20
- [ENST-Drums ISMIR 2006 paper](https://archives.ismir.net/ismir2006/paper/000027.pdf) — tier 1, accessed 2026-10-20
- [CarlSouthall/MDBDrums](https://github.com/CarlSouthall/MDBDrums) — tier 1, accessed 2026-10-20
- [Groove MIDI Dataset](https://magenta.tensorflow.org/datasets/groove) — tier 1, accessed 2026-10-20
- [E-GMD dataset](https://magenta.tensorflow.org/datasets/e-gmd) — tier 1, accessed 2026-10-20
- [Isophonics reference annotations](http://isophonics.net/content/reference-annotations) — tier 1, accessed 2026-10-20
- [urinieto/harmonixset](https://github.com/urinieto/harmonixset) — tier 1, accessed 2026-10-20
- [MagnaTagATune (City MIRG)](https://mirg.city.ac.uk/codeapps/the-magnatagatune-dataset) — tier 1, accessed 2026-10-20
- [mdeff/fma](https://github.com/mdeff/fma) — tier 1, accessed 2026-10-20
- [OpenMIC-2018 on Zenodo](https://zenodo.org/records/1432913) — tier 1, accessed 2026-10-20
- [OpenMIC-2018 ISMIR paper](https://ismir2018.ismir.net/doc/pdfs/248_Paper.pdf) — tier 1, accessed 2026-10-20
- [AudioSet download page](https://research.google.com/audioset/download.html) — tier 1, accessed 2026-10-20
- [NSynth dataset](https://magenta.tensorflow.org/datasets/nsynth) — tier 1, accessed 2026-10-20
- [Mel-Band RoFormer paper (arXiv:2310.01809)](https://arxiv.org/html/2310.01809) — tier 1, accessed 2026-10-20
- [MDX'21 challenge paper (arXiv:2108.13559v3)](https://arxiv.org/html/2108.13559v3) — tier 1, accessed 2026-10-20
- [SDX'23 Music Demixing Track (TISMIR)](https://transactions.ismir.net/articles/171) — tier 1, accessed 2026-10-20
- [SDR – half-baked or well done? (arXiv:1811.02508)](https://arxiv.org/abs/1811.02508) — tier 1, accessed 2026-10-20
- [facebookresearch/demucs README](https://github.com/facebookresearch/demucs) — tier 1, accessed 2026-10-20
- [Moises-Light paper HTML (arXiv:2510.06785v1)](https://arxiv.org/html/2510.06785v1) — tier 1, accessed 2026-10-20
- [mir_eval transcription](https://mir-eval.readthedocs.io/latest/api/transcription.html) — tier 1, accessed 2026-10-20
- [mir_eval transcription_velocity](https://mir-eval.readthedocs.io/latest/api/transcription_velocity.html) — tier 1, accessed 2026-10-20
- [mir_eval chord](https://mir-eval.readthedocs.io/latest/api/chord.html) — tier 1, accessed 2026-10-20
- [mir_eval beat](https://mir-eval.readthedocs.io/latest/api/beat.html) — tier 1, accessed 2026-10-20
- [Dynamic CNNs as Efficient Pre-trained Audio Models (arXiv:2310.15648)](https://arxiv.org/html/2310.15648) — tier 1, accessed 2026-10-20
- [MERT paper (arXiv:2306.00107)](https://arxiv.org/html/2306.00107) — tier 1, accessed 2026-10-20
