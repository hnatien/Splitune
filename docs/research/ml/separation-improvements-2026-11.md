---
title: Separation improvements per instrument (2026-11)
workstream: ml
last_researched: 2026-11-07
confidence: medium
---

# Separation improvements per instrument (2026-11)

This builds on `research/ml/source-separation.md` and `research/ml/source-separation-model-comparison.md` (2026-10-20). Those docs cover the architecture papers, SDX'23, SAM Audio, Banquet and Moises-Light, and this doc does not repeat them. Our own measurements are in `services/ml/eval/results/p1/2026-11-07-{rescored,fullsong}.md` and `services/ml/eval/results/sep-robust/2026-11-07-{moisesdb,loud-master}.md`. The harness is in `specs/08-evaluation-harness-and-prototypes.md` (step 28 notes).

**How to read the numbers**
- **Datasets** are never compared with each other:
  - **Multisong:** MVSep's hidden multisong set (vocals, drums, bass, other).
  - **MVSep-Guitar:** 30 tracks of about 1 min, acoustic and electric guitar together.
  - **MVSep-Piano:** 50 tracks of about 1 min, acoustic and electric piano ([dataset descriptions](https://mvsep.com/quality_checker/custom_leaderboards)).
  - **drumsep5:** MVSep's 150-track drum-kit set.
  - **MUSDB18-HQ:** the test split.
  - **MoisesDB-p1:** our 40 windows.
  - **MSR:** the ICASSP 2026 Music Source Restoration test set, scored in Multi-Mel-SNR, which is not SDR.
- **Metrics:** "SDR" on MVSep is the MSST whole-track SDR, the same formula as our uSDR. Bleedless and fullness are the MSST mel-magnitude metrics (0–100), which we use too.
- **Tiers** follow `research/README.md`:
  - 1: papers, author repos, configs and model cards.
  - 2: MVSep pages and entries, vendor docs and blogs, maintainer READMEs.
  - 3: press.
  - 4: community (Discord, the deton24 guide, GitHub comments, mirror notes).

  The brief's "tier 3 community" is tier 4 here. MVSep numbers are computed by MVSep on outputs that submitters upload, with settings the submitters describe.
- Every source was accessed on 2026-11-07. "Δ" values marked *(computed)* are our arithmetic on two numbers from the same dataset and metric.

## TL;DR
- **No downloadable model beats BS-Roformer-SW on drums, bass, guitar or piano on MVSep's sets as of 2026-11-07.** Every entry above SW is one of:
  - an MVSep-internal ensemble or service model;
  - a closed submission (MLSLABS WCJ);
  - SW itself run with heavier inference.

  The gains left for those four instruments are inference settings (+0.03 to +0.17 dB on MVSep's sets), keys routing, and robustness. New checkpoints are not among them.
- **Vocals is the one instrument with a better open checkpoint.**
  - unwa's **BS-RoFormer Leap Xe** scores 11.79 SDR / 38.07 bleedless / 18.14 fullness on Multisong vocals. Our current head, Mel-RoFormer Kim, scores 11.01 / 36.51 / 16.66, and SW scores 11.30 / 37.27 / 16.51.
  - Its weights carry no licence. anvuew's BS-RoFormer ft1 (GPL-3.0) scores 11.54.
- **The keys "silence" is fixable by routing, not by a better piano model.**
  - `key_mss.pth` (X-LANCE) is probably SW's own piano head *(inference)*: MVSep-Piano 7.7772 against 7.7770 for an SW run at overlap 2 (the overlap of the `key_mss` run is not stated). It is still worth one cheap run on the silent windows.
  - The candidates that actually target synth and organ are:
    - X-LANCE's synth models (`syn_mss.pth` → `syn_mss1.pth`);
    - the Mega-53 organ, keys and synth heads (organ 10.37 SDR on an unnamed MVSep set).

  Run them only when SW's piano output is silent and the tag stage hears keys.
- **The biggest remaining measured loss is on loud masters.** SW on `limit-XL`, median paired uSDR, after the step-28 rescaling fix:

  | Set | Vocals | Drums | Bass |
  |---|---|---|---|
  | MoisesDB-p1 | −2.68 | −1.76 | −0.76 |
  | MUSDB v2 | −1.30 | −1.78 | −0.30 |

  - No 2025–26 RoFormer work addresses it. MSST still has no limiter augmentation.
  - Jeon & Lee 2022 (Demucs v3, per `source-separation.md`) found that loudness-normalised input shrank most of the musdb-XL drop. A pre-separation gain test is the cheapest experiment in this doc. It is untested on RoFormers, and one of our research briefs expects nothing from it.
- **Two corrections to our baseline:**
  - **SW's provenance.** It is probably Apple's Logic Pro 11.2 Stem Splitter model, extracted from Core ML. That is a tier 4 claim, consistent with tier 2 scores that agree within 0.015 dB on guitar and piano.
  - **Chunk length.** Our pinned audio-separator 0.44.5 runs SW at a 9.29 s chunk. SW's YAML says 13.35 s, and MVSep's reference SW run used 20 s (882,000 samples). That run scored +0.06 to +0.07 dB on Multisong drums and bass over a 13.35 s run, but the 13.35 s run also differed in fp16 and overlap, so this is not a clean chunk ablation.
- **Not worth it on our hardware:**
  - SAM Audio: mono output, 5–8 dB below discriminative models on MUSDB18-HQ, and its small model peaks at 10,972 MiB on a 15 s clip.
  - Diffusion refinement: about 15× runtime for +0.5 dB.
  - Query-conditioned separators: still far behind on piano.
  - Ensembles for guitar or piano: no ensemble beats SW on MVSep-Guitar or MVSep-Piano.

## Findings

### 0. Corrections to the baseline and to the 2026-10-20 docs

**The baseline table's guitar and piano numbers are not Multisong.** Multisong has no guitar or piano stem.
- SW's "9.01" is MVSep-Guitar ([entry 9245](https://mvsep.com/quality_checker/entry/9245): 9.0120 / bleedless 30.67 / fullness 16.39).
- SW's "7.80" is MVSep-Piano ([entry 9578](https://mvsep.com/quality_checker/entry/9578): 7.8031).
- MVSep's SW page mixes Multisong with those leaderboards ([algorithms/77](https://mvsep.com/algorithms/77)).
- The "best piano 7.89" is MLSLABS WCJ V2 ([10972](https://mvsep.com/quality_checker/entry/10972), 2026-10-26), which has no public weights.

**SW's provenance (corrects `source-separation-model-comparison.md` row 6, "no canonical repo").** Two facts point to Apple:
- **Community account (tier 4).** The [deton24 guide](https://docs.google.com/document/d/17fjNvJzj8ZGSer7c7OFe_CNfUKbAxEh_OBv94ZdRG5c) says the Logic Pro 11.2 model was "reversed/cracked" from Core ML (.MIL → .PT) and shared, and that "SW" means "shared weights". In [MSST issue #248](https://github.com/ZFTurbo/Music-Source-Separation-Training/issues/248), one commenter said on 2026-10-31 that the developer "is Apple".
- **Scores (tier 2).** Logic Pro 11.2 and SW score within 0.015 dB of each other on SDR on both sets:

  | Set | Logic Pro 11.2 | SW |
  |---|---|---|
  | MVSep-Guitar | 9.0020 ([8354](https://mvsep.com/quality_checker/entry/8354)) | 9.0120 |
  | MVSep-Piano | 7.7889 ([8340](https://mvsep.com/quality_checker/entry/8340)) | 7.8031 |

  - Guitar bleedless differs (Logic Pro 31.54 vs SW 30.67).
  - The closest match is entry "BS 6stems guitar" ([10918](https://mvsep.com/quality_checker/entry/10918)), which matches Logic Pro to 4 decimals on SI-SDR, log-WMSE and bleedless.
  - On Multisong, a "Logic Pro BS-RoFormer" entry ([8362](https://mvsep.com/quality_checker/entry/8362)) scores vocals 11.3585 against SW's 11.3019, a gap that run settings could explain.
  - The files `bs_6stem.ckpt`, `bs_6stem_fixed.ckpt` and `bs_logic_6stem.ckpt` all score the same on Multisong, drums 14.0343 and bass 14.5526 ([leaderboard p2](https://mvsep.com/quality_checker/multisong_leaderboard?sort=drums&page=2)).
- **Hosting.** The original uploader's Hugging Face and GitHub accounts now return 404. Mirrors state "license: unknown" and "no provenance information" ([FractalSurfer mirror](https://huggingface.co/FractalSurfer/BS-RoFormer-SW-6stem), [elicwhite ONNX](https://huggingface.co/elicwhite/bs-roformer-sw-6stem-onnx), [enerjazzer](https://huggingface.co/enerjazzer/BS-ROFO-SW-Fixed)).
- **What it means.** Every SW-initialised model inherits this: X-LANCE, CP-JKU, gilliaan's drums model, and any fine-tune of our own. Personal mode tolerates it as a recorded risk. Nothing built on SW is a path to a hosted or commercial mode. No primary source confirms the extraction, and we did not compare weight hashes.

**audio-separator's RoFormer overlap changed after our pin.**
- 0.47.0 makes RoFormer `overlap` "the number of overlapping prediction windows (step = chunk size / overlap), taken from the model YAML's `num_overlap` by default. Earlier releases used a fixed ~8 s step" ([README](https://github.com/nomadkaraoke/python-audio-separator)).
- PyPI lists 0.48.0 as current ([history](https://pypi.org/project/audio-separator/#history)). The 0.47.0 date of 2026-08-27 was read from a summary, so treat it as medium confidence.
- We pin 0.44.5 (`services/ml/packages/stage_separation/pyproject.toml`). Our overlap results (`p1/2026-10-21-overlap.md`, step 28) and SW's 6.2× realtime figure therefore describe the old semantics.
- Our map's "library default" for SW (the step-28 seam fix) is the *pre-0.47* fixed 8 s step, so it would not survive an upgrade unchanged.
- An upgrade changes both speed and output unless the map pins `overlap` explicitly. Releases since our pin also add opt-in native fp16 (0.46), mirror-first SHA-256 downloads (0.48) and refusal of untrusted pickle globals (0.47.2) ([releases](https://github.com/nomadkaraoke/python-audio-separator/releases)).

**SW's chunk is shorter in our wrapper than anywhere it was benchmarked.**
- audio-separator 0.44.5 sets the RoFormer chunk as `hop × (dim_t − 1)` ([mdxc_separator.py @v0.44.5](https://github.com/nomadkaraoke/python-audio-separator/blob/v0.44.5/audio_separator/separator/architectures/mdxc_separator.py)). Our map comment records 9.29 s (409,600 samples) for SW.
- Benchmarked chunk lengths elsewhere:

  | Where | Chunk |
  |---|---|
  | Our wrapper (audio-separator 0.44.5) | 9.29 s (409,600) |
  | Community SW YAML | 13.35 s (`chunk_size: 588800 #882000`) |
  | MVSep's reference SW run | 20 s (882,000) |

- The community reports 882,000 "was tested to have the biggest SDR in that model" (tier 4, deton24).
- Multisong evidence (tier 2, computed Δ):

  | SW run | Drums | Bass |
  |---|---|---|
  | 882,000 chunk ([8374](https://mvsep.com/quality_checker/entry/8374)) | 14.1129 | 14.6235 |
  | 588,800 chunk, fp16, overlap 2 ([10847](https://mvsep.com/quality_checker/entry/10847)) | 14.0422 | 14.5643 |
  | Δ | +0.07 | +0.06 |

- The two runs also differ in fp16 and overlap, so the Δ is not a controlled chunk ablation. A shorter chunk than both is untested anywhere.

**Bass fullness: Multisong disagrees with our measurement.**
- We measured SW as the least full of three bass models on MUSDB v2 AAC (10.2 against htdemucs_ft 11.4).
- On Multisong, SW's bass fullness is 19.95, mid-pack among the entries listed in §3 ([8374](https://mvsep.com/quality_checker/entry/8374)). No Multisong fullness was found for htdemucs_ft.
- The two are different datasets, and listening is still what decides.

**Vocals ranking differs by dataset.** Our MUSDB windows rank viperx > SW > Kim. MoisesDB and Multisong both rank SW above Kim and viperx:

| Model | Multisong vocals SDR | Source |
|---|---|---|
| SW | 11.30 | [8374](https://mvsep.com/quality_checker/entry/8374) |
| Kim | 11.01 | [algorithms/49](https://mvsep.com/algorithms/49?lang=en) |
| viperx | 10.87 | [MSST pretrained list](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/pretrained_models.md) |

### 1. Vocals

**Checkpoints released since 2025-06.** Multisong vocals, tier 2 scores. Weights are tier 1 author repos.

| Model (file) | SDR | Bleedless | Fullness | Date / entry | Weights licence | In audio-separator |
|---|---|---|---|---|---|---|
| unwa BS-RoFormer **Leap Xe** (`Xe/bs_leap_xe_voc.ckpt`, [pcunwa/BS-Roformer-Leap](https://huggingface.co/pcunwa/BS-Roformer-Leap)) | **11.79** | 38.07 | 18.14 | 2026-10-07, [10846](https://mvsep.com/quality_checker/entry/10846) (overlap 2, fp32) | none ([discussion #4](https://huggingface.co/pcunwa/BS-Roformer-Leap/discussions/4) asks, no reply) | no |
| unwa **Leap** v1 (`bs_roformer_leap_voc.ckpt`) | 11.72 | **38.90** | 17.07 | 2026-06-13, [10146](https://mvsep.com/quality_checker/entry/10146) | none | no |
| anvuew **BS-RoFormer ft1** (`bs_roformer_ft1_anvuew_sdr_12.55.ckpt`, [anvuew/BS-RoFormer](https://huggingface.co/anvuew/BS-RoFormer)) | 11.54 | 35.20 | 19.85 | 2026-10-07, [10845](https://mvsep.com/quality_checker/entry/10845) | **GPL-3.0** | no |
| unwa HyperACE v2 voc ([card](https://huggingface.co/pcunwa/BS-Roformer-HyperACE)) | 11.39 | 34.12 | 19.07 | [algorithms/34](https://mvsep.com/algorithms/34?lang=en) | not stated; needs custom model code | no |
| becruily Mel-RoFormer **deux** ([card](https://huggingface.co/becruily/mel-band-roformer-deux)) | 11.35 | 29.78 | 22.81 | [algorithms/49](https://mvsep.com/algorithms/49?lang=en) | CC-BY-NC-4.0 | no |
| *Shipped:* SW / Kim / viperx | 11.30 / 11.01 / 10.87 | 37.27 / 36.51 / – | 16.51 / 16.66 / – | as above | unknown / MIT tag / not stated | yes |
| MVSep BS-RoFormer 124-band (service) | 12.33 | 39.18 | 18.11 | [algorithms/34](https://mvsep.com/algorithms/34?lang=en) | not distributed | n/a |

- **Leap Xe in detail.**
  - It is a dim-256, depth-16 BS-RoFormer (268 MB), and its config uses only standard MSST `BSRoformer` keys (tier 1 config check).
  - Leap v1 favours bleedless and Xe favours fullness, a natural pair to blend.
  - A tester reports Xe "is not catching some BVs" (backing vocals; tier 4).
  - No published speed or VRAM figures exist for Leap, Xe or ft1. They are dim 256, half of viperx's dim 512, so we infer they run no slower than viperx (3.9× realtime on our card).
  - **Loading.** Our map already loads an out-of-catalogue checkpoint from its own `config` (`mel_roformer_guitar_becruily`), so loading these is probably a map entry, not new code. That is unverified for Leap and ft1 (ft1's config has a custom `audio.min_mean_abs` key). audio-separator 0.48's checksum manifest would need a local entry for any unlisted file.
- **Ensembles: small gains, at a cost.**
  - A seven-model open ensemble (Leap Xe, Leap, two Resurrections, ft1, deux, Kim FT2) scores 11.97 / 38.17 / 18.62 ([11098](https://mvsep.com/quality_checker/entry/11098), 2026-11-05). That is +0.18 over Xe alone (computed) for about 7× compute.
  - MVSep's own 2025.06 four-model ensemble scored 11.93, against 11.82 to 11.89 for MVSep's best single models of that period (+0.04 to +0.11 *(computed)*). Its bleedless (36.29) was below the 2025.07 single model's 38.24 ([algorithms/10](https://mvsep.com/algorithms/10?lang=en)).
  - becruily's two-model ensemble (12.26) scored *below* its better component (12.33) ([10283](https://mvsep.com/quality_checker/entry/10283)).
  - The MSST paper states "+0.01 to +0.2 dB" from ensembling top models ([Solovyev et al., arXiv:2607.23395](https://arxiv.org/abs/2607.23395), 2026-07-25). Its own vocals table shows +0.37, on an unnamed dataset.
- **Lead vs backing vocals.**
  - Best open lead-vocal model: `bs_roformer_karaoke_anvuew.ckpt` (GPL-3.0, in audio-separator), lead SDR 10.17, bleedless 29.20 ([9180](https://mvsep.com/quality_checker/entry/9180), 2025-10-17).
  - Runner-up: frazer & becruily BS karaoke, 10.06 ([9013](https://mvsep.com/quality_checker/entry/9013)).
  - Service only: MVSep's 124-band karaoke, 10.77.
  - Running a karaoke model on already-extracted vocals scored *lower* than on the mixture: Mel gabox 9.67 → 9.36 ([algorithms/76](https://mvsep.com/algorithms/76?lang=en)). MVSep doesn't name its karaoke dataset.
  - **Inference:** a "lead line only" practice option is a separate pass on the mixture, not a post-process on the vocal stem.
- **Post-processing.**
  - **De-reverb.** This is a different job: reverb belongs to the vocal a learner imitates. The best open model is anvuew DeReverb stereo (BS-RoFormer) at 8.80 / 32.84 / 16.50 on MVSep's 27-track de-reverb set ([MVSep news](https://mvsep.com/en/news), 2026-10). Which audio-separator file that name maps to is unverified.
  - **Apollo vocal restoration.** `baicai1145/Apollo-vocal-msst` is CC-BY-NC-SA-4.0 and has no metrics ([card](https://huggingface.co/baicai1145/Apollo-vocal-msst)). Community models were trained on MP3 artefacts only, not AAC or Opus (tier 4).
  - **Phase fix.** It keeps one model's magnitude and blends phase from another ([phase_fixer.py](https://huggingface.co/spaces/ASesYusuf1/SESA_Audio_Separation/blob/main/phase_fixer.py)). It was designed for instrumentals, and no vocal-stem measurement exists. Bleedless and fullness are magnitude-only, so they cannot see it.
- **Inference settings (vocals).**
  - Test-time augmentation (TTA: channel swap plus polarity) gives +0.03 (BS-RoFormer) and +0.06 (Mel-RoFormer) SDR in MSST paper Table 3 (unnamed dataset), at 3× time ([settings.py](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/utils/settings.py): "roughly triples runtime").
  - Overlap from 50 % to 87 % gives +0.06 on MVSep's 124-band model ([algorithms/34](https://mvsep.com/algorithms/34?lang=en)).
  - Both are smaller than the paired differences we can resolve on 19–31 clips per instrument (v2 and moisesdb) *(inference)*.

### 2. Drums

- **Checkpoints.** Nothing downloadable beats SW (Multisong drums 14.11, [8374](https://mvsep.com/quality_checker/entry/8374)).
  - **Ensemble, not available to us.** MVSep's drums ensemble (MelBand + SCNet XL + SW) scores 14.35 ([8376](https://mvsep.com/quality_checker/entry/8376); [algorithms/43](https://mvsep.com/algorithms/43)). No public weights were found for its MelBand (12.76) or SCNet XL (13.42) partners (unverified).
  - **Best downloadable 4-stem.** ZFTurbo's SCNet XL IHF (`model_scnet_ep_36_sdr_10.0891.ckpt`) scores 11.58 on Multisong ([MSST pretrained list](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/pretrained_models.md)).
  - **X-LANCE drums.** The mirrored X-LANCE drums model scores 14.0343, identical to SW's file ([10741](https://mvsep.com/quality_checker/entry/10741)), although the paper says its drums model was newly trained. Either the mirror maps the wrong file or the fine-tune changed nothing measurable. Every single-stem dim-256/depth-12 file has the same byte size, so size cannot identify a mirror file: check hashes against the upstream repo.
  - **gilliaan drums v1.** An SW fine-tune "focused on fullness … not so much on accuracy" (tier 4). It is CC-BY-NC-SA-4.0 and has no metrics ([card](https://huggingface.co/gilliaan/Stem-Separation-Models)).
- **Inference on SW (Multisong, tier 2):**

  | SW setting | Drums | Bleedless | Fullness | Entry |
  |---|---|---|---|---|
  | 588,800 chunk, fp16, overlap 2 | 14.04 | – | – | [10847](https://mvsep.com/quality_checker/entry/10847) |
  | 882,000 chunk | 14.11 | 43.71 | 14.79 | [8374](https://mvsep.com/quality_checker/entry/8374) |
  | MLX, 13.35 s chunk, 75 % overlap, 3-pass TTA | 14.20 | 45.38 | 14.21 | [10674](https://mvsep.com/quality_checker/entry/10674) |
  | BigShifts = 5 (average of 5 time-shifted passes) | 14.28 | 44.45 | 14.88 | [8377](https://mvsep.com/quality_checker/entry/8377) |

  - **fp16 costs nothing measurable:** "undefined-f16" ([8371](https://mvsep.com/quality_checker/entry/8371)) scores 14.0486 against 14.0413 for "undefined" (entry 8369, [drums leaderboard](https://mvsep.com/quality_checker/multisong_leaderboard?sort=drums)).
  - **TTA depends on the model.** In MSST Table 3 (unnamed dataset) it adds +0.00 to SCNet XL drums.
- **Drum sub-stems (drumsep5, SDR for kick / snare / toms / hi-hat / cymbals, tier 2):**

  | Model | Kick | Snare | Toms | Hi-hat | Cymbals | Weights |
  |---|---|---|---|---|---|---|
  | Our eval candidate: MDX23C 6-stem (aufr33 + jarredou) ([8195](https://mvsep.com/quality_checker/leaderboard/drumsep5/?sort=kick)) | 14.55 | 9.79 | 10.64 | 3.20 | 6.08 | in audio-separator |
  | MDX23C **5-stem** (jarredou) ([10713](https://mvsep.com/quality_checker/entry/10713)) | 16.66 | 11.53 | 12.32 | 4.05 | 6.36 | MSST only (no ride/crash split) |
  | jarredou BS-RoFormer DrumSep small, 2026-10 ([10825](https://mvsep.com/quality_checker/entry/10825)) | 18.16 | 12.81 | 13.52 | 4.67 | 6.66 | no download found |
  | MVSep Mel-RoFormer v2, 4 stems ([8249](https://mvsep.com/quality_checker/entry/8249)) | 18.67 | 13.56 | 13.61 | 8.77 (hi-hat + cymbals combined) | | service only |

  - The 5-stem beats the 6-stem by +2.11 / +1.74 / +1.68 / +0.85 / +0.28 dB *(computed)*.
  - The 5-stem's original host is deleted and its licence is undocumented. A mirror (`mdx23c_drumsep_5stem_aufr33_jarredou.ckpt`, [noblebarkrr](https://huggingface.co/noblebarkrr/mvsepless_resources/tree/main/mdx23c)) scores the same. openmirlab says it found no intact original ([mdxnet-infer](https://github.com/openmirlab/mdxnet-infer)), so verify the hash.
  - Commercial references on drumsep5: iZotope Photon kick 17.19, Logic Pro 13 kick 16.65. Logic Pro 13.0 (2026-11-06) added kit-piece splitting ([Apple release notes](https://support.apple.com/en-us/109503)).
  - Kit-piece separation helps transcription: the 6-stem MDX23C front end raised 8-class drum transcription F from 0.72 to 0.84 (MDB) and 0.65 to 0.76 (ENST), but RBMA fell from 0.58 to 0.56 ([Riley & Dixon, arXiv:2509.24853](https://arxiv.org/abs/2509.24853), 2025-09).
- **Loud masters.**
  - No 2025–26 musdb-XL or LimitAug result exists for RoFormer or SCNet.
  - Two de-limiters exist, with no separation-after-de-limiting numbers for either:
    - becruily BS-RoFormer delimit: CC-BY-NC-4.0, no metrics ([card](https://huggingface.co/becruily/bs-roformer-delimit)).
    - Jeon's De-limiter: MIT, 24.0 dB SI-SDR reconstructing musdb-HQ from musdb-XL ([arXiv:2308.01187](https://arxiv.org/abs/2308.01187); [repo](https://github.com/jeonchangbin49/De-limiter)).

### 3. Bass

- **Checkpoints.** Nothing downloadable beats SW (Multisong bass 14.62 / bleedless 39.70 / fullness 19.95).
  - The best listed entry is the SCNet XL + SW weighted ensemble at 14.87 / 36.52 / 21.01 ([8375](https://mvsep.com/quality_checker/entry/8375)). MSST Table 4 gives its weights as 11 : 24. Its SCNet XL partner is MVSep-internal.
  - X-LANCE `bass_mss.pth` is probably SW's bass head *(inference)*: the paper takes bass from frozen SW ([arXiv:2602.09042](https://arxiv.org/abs/2602.09042)), and its mirror scores the same as SW's file.
- **What does not work (tier 2, computed):**
  - **Vocals first, then SW on the instrumental:** 14.55 against 14.56 for SW on the mixture ([10988](https://mvsep.com/quality_checker/entry/10988) vs [8905](https://mvsep.com/quality_checker/entry/8905)). The runs differ in overlap and fp16, and 8905's settings are unstated, so read this as "no evidence of a gain".
  - **Averaging SW 50/50 with htdemucs_ft** (both on the vocals-removed instrumental, against SW alone on that instrumental): −0.40 SDR, +0.56 fullness, −4.9 bleedless ([10989](https://mvsep.com/quality_checker/entry/10989) vs 10988).
  - **Inference:** our fallback chain should stay a fallback, not become an average.
- **Fullness versus bleedless.** Every entry that raises SW's bass fullness lowers its bleedless (Multisong):

  | Entry | SDR | Bleedless | Fullness |
  |---|---|---|---|
  | SW | 14.62 | 39.70 | 19.95 |
  | BigShifts 5 ([8377](https://mvsep.com/quality_checker/entry/8377)) | 14.79 | 36.67 | 20.77 |
  | SCNet XL + SW | 14.87 | 36.52 | 21.01 |
  | MVSep ensemble ([8504](https://mvsep.com/quality_checker/entry/8504)) | 14.85 | 35.90 | 20.97 |
  | Superoformer rev2, closed ([10791](https://mvsep.com/quality_checker/entry/10791)) | 14.62 | 43.56 | 18.14 |

  - **Inference:** "SW bass sounds thin" is a listening question. If it is confirmed, shift averaging is the downloadable lever. It costs about 3 bleedless points.
- **Seams.** No source discusses chunk seams for bass specifically. Our seam fix went back to the library default, which in 0.44.5 is a fixed 8 s step over a 9.29 s chunk. 0.47.0 replaced that default with chunk/`num_overlap` (§0), so the fix must be re-checked on any upgrade.
- **SDR and listening agree poorly for bass.** On the Jaffe & Burgoyne MUSHRA data, SDR's rank correlation with ratings is 0.43 for bass and 0.31 for drums. MERT and FAD embedding metrics reach ≥ 0.61, and bass stems got the lowest ratings ([Bereuter & Sontacchi, arXiv:2604.20270](https://arxiv.org/abs/2604.20270), 2026-04). Gaps of 0.1–0.3 dB need a listening check before a switch.

### 4. Guitar

**MVSep-Guitar, 2026-11-07** (tier 2; [leaderboard](https://mvsep.com/quality_checker/leaderboard/guitar/?sort=guitar)):

| Entry | SDR | Bleedless | Fullness | Added | Weights |
|---|---|---|---|---|---|
| SW, max overlap ([9245](https://mvsep.com/quality_checker/entry/9245)) | **9.01** | 30.67 | 16.39 | 2025-11-03 | in use |
| Logic Pro 11.2 ([8354](https://mvsep.com/quality_checker/entry/8354)) | 9.00 | 31.54 | 15.95 | 2025-06-03 | proprietary |
| SW, overlap 2 ([9576](https://mvsep.com/quality_checker/entry/9576)) | 8.97 | – | – | 2026-01-22 | in use |
| MLSLABS WCJ ([10188](https://mvsep.com/quality_checker/entry/10188)) | 8.89 | 30.93 | 16.25 | 2026-07-07 | closed |
| X-LANCE `gtr_mss.pth` (mirror `bs_gtr_xlancer`, [10658](https://mvsep.com/quality_checker/entry/10658)) | 8.60 | 29.67 | 15.82 | 2026-09-10 | MIT tag ([HF](https://huggingface.co/chenxie95/xlance-msr-ckpt)) |
| Mega-53 guitar head ([10661](https://mvsep.com/quality_checker/entry/10661)) | 8.25 | 27.30 | 14.64 | 2026-09-10 | not stated |
| MVSep BS+Mel ensemble, 2024 ([7149](https://mvsep.com/quality_checker/entry/7149)) | 7.51 | – | – | 2024-09-14 | service |
| Moises Guitar 2025 ([9243](https://mvsep.com/quality_checker/entry/9243)) | 6.94 | 29.29 | 13.46 | 2025-11-03 | proprietary |
| Cubase 16 Pro ([11087](https://mvsep.com/quality_checker/entry/11087)) | 5.91 | 22.23 | 13.93 | 2026-11-04 | proprietary |
| becruily Mel-RoFormer, from the instrumental / from the mixture ([8309](https://mvsep.com/quality_checker/entry/8309), [8308](https://mvsep.com/quality_checker/entry/8308)) | 5.63 / 5.29 | 21.01 / 20.88 | 15.70 / 14.37 | 2025-05-20 | non-commercial per the owner |

- **The two benchmarks agree.**
  - The gaps from SW to htdemucs_6s and to becruily are +3.8 and +3.7 dB on MVSep-Guitar *(computed)*. On our MoisesDB-p1 the paired median gaps are 4.1–4.7 dB (htdemucs_6s) and 4.5–5.3 dB (becruily). The two sets agree on the ranking; the gap sizes are not comparable across datasets.
  - **Contamination warning.** chenCFD's Mel-RoFormer guitar, trained on MoisesDB, reports 7.98 on its own validation set but scores 2.19 on MVSep-Guitar ([10663](https://mvsep.com/quality_checker/entry/10663); [MSST issue #1](https://github.com/ZFTurbo/Music-Source-Separation-Training/issues/1)). X-LANCE also trained on MoisesDB. **MoisesDB-p1 will flatter any MoisesDB-trained candidate**, so it cannot decide alone.
- **What `gtr_mss.pth` is, is unclear.** The X-LANCE paper takes its guitar output from frozen SW, and only its synth, drums, percussion and orchestral models were newly trained from SW's weights ([arXiv:2602.09042](https://arxiv.org/abs/2602.09042)). Yet the mirrored `gtr_mss` scores 0.38 dB below an SW run at overlap 2 and 0.42 below SW at max overlap *(computed)*, and the `gtr_mss` run's overlap is not stated. The mirror-to-file mapping rests on byte size, which every single-stem file of this shape shares (see §2). Its training is unverified; check hashes before drawing conclusions.
- **Ensembles.**
  - No SW + dedicated-guitar ensemble has been measured anywhere.
  - The only guitar ensemble on record is MVSep's 2024 BS + Mel at 7.51, against 7.16 for its best single model (+0.35, [algorithms/17](https://mvsep.com/algorithms/17)). Both components were older, weaker models.
  - Weak partners hurt (§3).
  - **Inference:** becruily, 3.7 dB below SW, would hurt in an average. Our one large loss (`3c557409-guitar`, becruily 12.74 vs SW 5.00) is a routing case, not an ensemble case.
- **Acoustic vs electric.**
  - **Open weights.** The Mega-53 heads `bs_mega_53stem_{acoustic,electric}-guitar_mvsep.ckpt` (77.6 MB each, [mirror](https://huggingface.co/noblebarkrr/BS-Roformer-MVSep-Mega-53-stems); full model in [MSST release v1.0.21](https://github.com/ZFTurbo/Music-Source-Separation-Training/releases/tag/v1.0.21), needs ≥ 16 GB) score acoustic 5.00 and electric 8.15 on an unnamed MVSep set ([algorithms/135](https://mvsep.com/algorithms/135)).
  - **Hosted only.** MVSep's Acoustic and Electric Guitar models have an "extract from guitar part" mode, and no metrics.
  - **LALAL.AI moved the other way.** It *merged* acoustic and electric into one "Guitars" stem, claiming about 20 % fewer failures ([LALAL.AI blog](https://www.lalal.ai/blog/andromeda-supports-guitars-updates-piano/amp/), 2026-08-27).
  - **Research.** RawStems/MSR found acoustic- and electric-specific models beat a general guitar model on restoration SI-SDR (−1.14 / −1.68 against −2.40 dB, [arXiv:2505.21827](https://arxiv.org/abs/2505.21827)).
  - **Inference:** extract all guitar with SW first, then split inside the guitar stem.
- **Lead vs rhythm.**
  - Only MVSep's hosted model has numbers: two-stage 9.21, one-stage 9.02, on an undisclosed dataset ([MVSep algorithms JSON](https://mvsep.com/api/app/algorithms)).
  - The one open model, `mbr_lead_rhythm_guitar_listra92.ckpt` (mirror), has no metrics and no clear origin.
  - Yousician found rhythm-guitar strum detection worked *better* on htdemucs's "other" stem than on htdemucs_6s guitar (F1 96.9 vs 95.4, [arXiv:2510.05756](https://arxiv.org/abs/2510.05756)).
  - **Inference:** for tab, lead vs rhythm is closer to a transcription problem than a separation problem.
- **Quiet or buried guitar.** No evidence-based fix was found.
  - Vocals-first pre-passes are tier 4 advice. becruily's own scores (5.63 from the instrumental vs 5.29 from the mixture) are the only measured hint, and that is for a weaker model.
  - SW's documented tendency to put "voice-like" lines (lead synth, sax, guitar lines) into vocals is tier 4 (deton24).
- **Fine-tuning.** Measured gains are small:
  - A community htdemucs_6s fine-tune reports +0.31 dB on its own MoisesDB split ([adityalakhani/htdemucs-6s-guitar-ft](https://huggingface.co/adityalakhani/htdemucs-6s-guitar-ft)).
  - ACMID got +1.16 dB on average over 7 stems by adding about 26 h of cleaned web-crawled guitar audio. On guitar itself the gains were acoustic +0.56 and electric +1.44 *(computed)*, on the MoisesDB + MedleyDB test set. The dataset itself is unreleased ([arXiv:2510.07840](https://arxiv.org/abs/2510.07840)).
  - Slakh-only training gave acoustic 1.61 and electric 0.52 dB on real music (ACMID Table 4). That is evidence against synthetic-only data.

### 5. Piano and keys

**MVSep-Piano, 2026-11-07** (tier 2; [leaderboard](https://mvsep.com/quality_checker/leaderboard/piano/?sort=piano)):

| Entry | SDR | Bleedless | Fullness | Weights |
|---|---|---|---|---|
| MLSLABS WCJ V2 ([10972](https://mvsep.com/quality_checker/entry/10972)) | 7.89 | 31.92 | 14.30 | closed |
| SW, max overlap ([9578](https://mvsep.com/quality_checker/entry/9578)) | 7.80 | 31.95 | 14.39 | in use |
| Logic Pro 11.2 ([8340](https://mvsep.com/quality_checker/entry/8340)) | 7.79 | 31.96 | 14.42 | proprietary |
| SW, overlap 2 ([9576](https://mvsep.com/quality_checker/entry/9576)) | 7.7770 | – | – | in use |
| X-LANCE `key_mss.pth` (mirror `bs_keys_xlancer`, [10666](https://mvsep.com/quality_checker/entry/10666)) | 7.7772 | 32.06 | 14.37 | MIT tag |
| Mega-53 piano / keys heads ([10669](https://mvsep.com/quality_checker/entry/10669), [10668](https://mvsep.com/quality_checker/entry/10668)) | 6.85 / 6.36 | 27.37 / 24.54 | 12.85 / 14.10 | not stated |
| MVSep SCNet + Mel ensemble | 6.21 | – | – | service |
| LALAL.AI piano (attribution unverified, [10071](https://mvsep.com/quality_checker/entry/10071)) | 5.05 | 28.28 | 11.67 | proprietary |
| htdemucs_6s | 2.23 | – | – | in use |

- **`key_mss.pth` is unlikely to fix the silence.**
  - Its mirror scores 7.7772, within 0.0002 dB of an SW run at overlap 2. The `key_mss` run's overlap is not stated.
  - The X-LANCE paper takes piano from frozen SW, so it is probably SW's piano head *(inference)*.
  - Against that: the MSR "Keyboards" class includes organ, and X-LANCE placed first on it (6.71 MMSNR). It costs one cheap run, so experiment 4 includes it.
- **The silent windows are synth and organ.** On our 3 silent windows the MoisesDB target is mostly `other_keys`. MoisesDB's taxonomy puts organ, electric organ, synth lead and synth pad there ([MoisesDB](https://arxiv.org/abs/2307.15913)). SW has no output for those sounds.
- **Models that do target them:**
  - **X-LANCE synth chain** (`syn_mss.pth` → `syn_mss1.pth`, [ans.py](https://github.com/ModistAndrew/xlance-msr/blob/main/ans.py)).
    - Newly trained from SW's weights on MoisesDB + RawStems.
    - First on MSR synthesizers at 2.26 dB Multi-Mel-SNR (field average 1.21; [MSR summary, arXiv:2601.04343](https://arxiv.org/abs/2601.04343)). That metric is not SDR.
    - Code MIT; weights tagged MIT, but the training data is NC (MoisesDB) or has rights retained (RawStems).
  - **Mega-53 heads** `bs_mega_53stem_{organ,synth,keys,digital-piano}_mvsep.ckpt` (77.6 MB each).
    - Organ 10.37, keys 9.30, synth 2.05, digital piano 7.96 SDR on MVSep's unnamed validation set ([algorithms/135](https://mvsep.com/algorithms/135)). MVSep's "Keys" covers organ, harpsichord, pianos, mellotron, rhodes, wurlitzer and more ([algorithms/96](https://mvsep.com/algorithms/96)).
    - MVSep's own design runs Mega-53 first to *detect* which instruments are present, then runs specialised models ([news](https://mvsep.com/en/news), 2026-10-15).
  - **CP-JKU's 8-stem SW fine-tune** reaches synth 3.10 MMSNR, above X-LANCE's 2.24 in CP-JKU's own table ([arXiv:2610.08284](https://arxiv.org/abs/2610.08284), 2026-10). Its model licence is unverified.
  - **Expect a partial fix for synth.** Synth is hard everywhere (2.05 SDR, 2.26 MMSNR). Organ looks tractable.
- **Conditioned separation is still well behind.**
  - Piano median SNR on MoisesDB 10 s clips: QSCNet 3.4 against Banquet 2.5. QSCNet has no code ([arXiv:2512.15532](https://arxiv.org/abs/2512.15532), CMMR 2025).
  - Banquet's long-tail stems (organ, synth) never exceeded 5 dB ([arXiv:2406.18747](https://arxiv.org/abs/2406.18747)).
  - MuS3D (stem discovery on SAM-Audio-large, about 2.2B parameters) reports no keys numbers, and its code is "upon acceptance" ([arXiv:2609.30912](https://arxiv.org/abs/2609.30912)).
  - Score-informed work covers orchestral and classical-guitar material only ([arXiv:2503.07352](https://arxiv.org/abs/2503.07352), [arXiv:2507.01172](https://arxiv.org/abs/2507.01172)).
- **The answer to "can a tag guide separation?"** Yes, as a *router* that picks a specialised model. There is no evidence that it works as a *condition* inside a model at SW's quality.
- **Fine-tuning data.**
  - Slakh2100 is CC BY 4.0 and has organ and synth classes, but all of its audio is mono ([Zenodo](https://zenodo.org/records/4599666)). ACMID's Table 4 shows synthetic-only training transfers poorly to real music.
  - MSST supports LoRA fine-tuning (`--train_lora_peft` / `--train_lora_loralib`; some notes cite `--train_lora`, so check the current flag in [LoRA.md](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/LoRA.md)). No published LoRA gains exist.

### 6. Cross-cutting levers

**6.1 Inference-time settings** (all small; ranked by expected value for us)

| Lever | Evidence | Cost on the 3060 | Notes |
|---|---|---|---|
| Chunk length (SW at 9.29 s today) | 20 s chunk +0.06/+0.07 bass/drums vs 13.35 s (Multisong, §0) | Fewer windows, more VRAM per window (unmeasured) | Untested at our 9.29 s; may need a wrapper option (see "Harness gaps") |
| fp16 / autocast | No SDR loss: SW fp16 vs fp32 drums 14.0486 vs 14.0413 (Multisong). MSST inference uses autocast by default ([model_utils.py](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/utils/model_utils.py)) | Speed gain unmeasured; Ampere has fp16 tensor cores | audio-separator defaults to fp32; native fp16 arrived in 0.46, newer than our pin |
| Time-shift averaging (BigShifts) | 5 shifts: drums +0.17, bass +0.16 SDR, bass fullness +0.82, bleedless −3.0 (Multisong, [8377](https://mvsep.com/quality_checker/entry/8377)) | ≈ 5× SW time | Not in audio-separator; MSST `--bigshifts` |
| TTA (L/R swap + polarity) | +0.00 to +0.06 SDR; keys bleedless −3.95 ([MSST Table 3](https://arxiv.org/abs/2607.23395)) | 3× | Not offered for MDXC in audio-separator |
| Overlap ↑ | +0.02 to +0.06 (MVSep); our P1: ≤ 0.13 dB on 30 s clips | 2–4× | Pin it explicitly before any library upgrade |
| torch.compile | Training step 1.38 → 0.68 s on a 10-stem BS-RoFormer (tier 4 quote); inference undocumented | Cold-start compile 1–4 min | Only useful for a long-running worker |

**6.2 Ensembles.**
- avg_wave is still best for SDR ("always better or equal", [MSST ensemble.md](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/ensemble.md)).
- Measured gains, Multisong unless stated:

  | Stem | Gain | Partner available to us? |
  |---|---|---|
  | Bass | +0.25 | no (MVSep-internal) |
  | Drums | +0.24 | no (MVSep-internal) |
  | Vocals | +0.18 (seven open models) | yes, at about 7× compute |
  | Guitar (MVSep-Guitar) | none beats SW | – |
  | Piano (MVSep-Piano) | none beats SW | – |

- Ensembles that raise SDR usually cost 2–5 bleedless points and gain fullness. min_fft and max_fft are the bleedless and fullness levers, with no primary measurement for either.
- audio-separator ensembles natively (`--extra_models`, `--ensemble_algorithm`).

**6.3 Post-processing and restoration.**
- **Diffusion or consistency refinement** on a MUSDB-only BS-RoFormer: 9.84 → 10.34 average SDR (diffusion variant: bass +0.87, drums +0.53; consistency-distilled T=2: bass +0.99, drums +0.60) on MUSDB18-HQ, museval 1 s-chunk median. It costs about 15× runtime and 180M parameters, works one stem at a time, and was trained on MUSDB only ([arXiv:2412.06965](https://arxiv.org/abs/2412.06965), rev. 2026-04).
- **MSR challenge systems** (X-LANCE, CUP, DTT-BSR) restore degraded stems, a different task. The winner scored 4.46 Multi-Mel-SNR.
- **Apollo-family models** are trained on MP3 artefacts and carry NC or no licences.
- **Inference:** restoration is lower value for practice stems than separation, and none of it is measured on bleed.

**6.4 Robustness.**
- **Loud masters.**
  - The newest primary statement is still Jeon & Lee 2022: loudness normalisation at test time "greatly alleviated" the loss, though "there still exists the performance degradation due to the signal distortion caused by a limiter" ([arXiv:2208.14355](https://arxiv.org/abs/2208.14355)). `source-separation.md` (2026-11-06) records Demucs v3 drums 11.7 → 9.2 dB on musdb-XL, shrinking to about 0.2 dB with loudness-normalised input. Nothing like this has been run on a RoFormer.
  - Our own loud-master report found that most of SW's earlier loss was audio-separator's output rescaling, which step 28 fixed (`sep-robust/2026-11-07-loud-master.md`). The losses quoted in this doc are after that fix.
  - **Decode clipping is still unfixed.** Lossy decodes of a −6 LUFS master peak at 1.05–1.53 and are clipped in the decode cache (same report). A pre-separation gain stage must act before that clip (a float decode cache, or gain at decode), or it cannot recover those samples.
  - MSST's augmentations still have no limiter ([augmentations.md](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/augmentations.md)).
  - SW's config has `normalize: false` (tier 4 artefact).
- **Live and phone recordings.**
  - SCNet trained on clean data scores vocals 1.46 dB on noisy, reverberant MUSDB18-HQ. Training with crowd-noise and room-impulse augmentation lifts that to 3.15, but costs about 1 dB on clean input (10.05 → 9.07) ([CrowdioSet/PaRIRset, arXiv:2607.27828](https://arxiv.org/abs/2607.27828), ISMIR 2026).
  - Listeners preferred the noise-trained model on real concert clips (105 of 130 votes).
  - **Inference:** route by input type (the "own recording" mode) rather than replacing the head.
- **Codecs.**
  - No RoFormer study on codec-robust training was found.
  - MSST's MP3 augmentation (default probability 0.01) is the available tool.
  - Our codec cost is ≤ 1.1 dB uSDR but 10–14 bleedless points.

**6.5 Conditioned and generative separation.**
- **SAM Audio** now has objective music numbers. Text-prompted, MUSDB18-HQ:

  | Source | Vocals | Drums | Bass | Other |
  |---|---|---|---|---|
  | SAM Audio Large, CrowdioSet paper | 3.72 | 5.63 | 5.14 | −1.74 |
  | SAM Audio, FLOMSS paper ([arXiv:2610.17821](https://arxiv.org/abs/2610.17821)) | 2.75 | 5.68 | 4.92 | – |
  | SCNet, same FLOMSS table | 10.9 | 11.2 | 9.42 | – |

  - The output is mono 48 kHz and watermarked.
  - Peak VRAM on a 15 s clip (official Python, RTX 5090) is 10,972 MiB for small, 13,414 MiB for base and 20,568 MiB for large. A 180 s input ran out of memory on 32 GB (tier 4, [SAM-Audio-GGUF](https://huggingface.co/audio-cpp/SAM-Audio-GGUF)).
  - **Not viable** on the 3060.
- **FLOMSS** (Sony, flow matching) averages 4.34 SDR against SCNet's 9.69, but its MUSHRA score (59.1) is close to HTDemucs (58.7). No weights are linked.
- **Score-, MIDI- and transcription-informed separation** has no pop guitar, bass or piano work with a RoFormer-class model (§5).

**6.6 Fine-tuning on 12 GB.**
- **MSST's memory levers:** configs assume an A6000 48 GB. To fit less, use:
  - `use_amp` (on by default);
  - `use_torch_checkpoint: true` (gradient checkpointing, "not fully tested");
  - `gradient_accumulation_steps`;
  - a shorter `chunk_size`;
  - LoRA on Q/V (see LoRA.md for the current flag).
- **Memory data points:** MSST's batch table gives dim 256 / depth 12 at a 131,584-sample chunk as batch 1 on 16 GB ([bs_roformer_info.md](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/bs_roformer_info.md)). 12 GB is not listed.
- **Community practice (tier 4):** "All unwa models were trained on 3060 Ti" (8 GB). A percussion fine-tune on a 4070 took about 5 days.
- **Inference:** an SW-sized fine-tune on our card needs LoRA, AMP, checkpointing, about 3 s chunks and batch 1 with accumulation. Check it with `msst check --mode full`, which reports `peak_allocated_gib`. Expect +0.3 dB-class gains unless new data is added, plus two costs:
  - Fine-tuning on MoisesDB makes MoisesDB-p1 unusable for evaluation.
  - The result inherits SW's provenance.
- **Datasets:**

  | Dataset | Licence | Note |
  |---|---|---|
  | MoisesDB | CC BY-NC-SA 4.0 | |
  | MUSDB18-HQ | academic only | |
  | MedleyDB | CC BY-NC-SA | |
  | Slakh2100 | CC BY 4.0 | mono, synthetic |
  | RawStems | annotations Apache-2.0; audio rights retained by creators | 578 songs, 354 h ([HF](https://huggingface.co/datasets/yongyizang/RawStems)) |
  | CrowdioSet ambiences | about 92 % commercially usable | |

**6.7 Efficiency.**
- **Mac.** [mlx-audio-separator](https://pypi.org/project/mlx-audio-separator/) (MIT, 0.1.20, 2026-10-02) is an MLX port of audio-separator.
  - It reports 2.16× on viperx 1297 and 1.40× on htdemucs_ft against upstream on an M4 mini.
  - Its SW profile is "bit-identical" and 6–17 % faster.
  - It publishes relative-L2 parity, not SDR. An MLX SW run on Multisong (entry 10674) matches or beats PyTorch SW, which is indirect parity evidence.
  - [demucs-mlx](https://pypi.org/project/demucs-mlx/) runs htdemucs at 114× realtime against 42× on MPS (M4 Max).
- **Quantisation.** [BSRoformer.cpp](https://github.com/chenmozhijin/BSRoformer.cpp) (GGML, MIT) offers Q8_0 down to Q4. No source reports SDR for any int8 or q8 RoFormer, so do not ship it unmeasured.
- **Light models.** Moises-Light still has no official code or weights. An unofficial implementation has none either ([moises-light on PyPI](https://pypi.org/project/moises-light/)).

### 7. Vendors

| Vendor | Method disclosure | Independent per-instrument evidence |
|---|---|---|
| Apple Logic Pro | None official. 11.2 added guitar and piano, and 13.0 (2026-11-06) adds kit pieces ([release notes](https://support.apple.com/en-us/109503)). Community: a Core ML BS-RoFormer (§0) | MVSep-Guitar 9.00, MVSep-Piano 7.79 (tied with SW); drumsep5 kick 16.65 |
| LALAL.AI | Rocknet → Cassiopeia → Phoenix → Orion → Perseus → Andromeda. Andromeda is "transformer technology" with about 4× Perseus's data and "up to 10 %" better SDR on unnamed data ([blog](https://www.lalal.ai/blog/andromeda-audio-transformer-neural-network/)). Acoustic and electric guitar merged into one "Guitars" stem (2026-08) | An MVSep-Piano entry at 5.05 and an MVSep-Guitar entry at 4.86, both attributed to LALAL.AI by name only (unverified) |
| Moises / Music.AI | Proprietary models trained on "licensed music and tracks created by our own musicians" ([Apple developer story](https://developer.apple.com/articles/moises/), 2025-06). Its benchmark claim is +15.8 % average SDR on 47 MUSDB18-HQ tracks plus 90 proprietary songs, with per-vendor numbers only in images ([blog](https://music.ai/blog/research/source-separation-benchmarks/), 2024-09) | MVSep-Guitar 6.94 (2025-11) |
| AudioShake | "A completely new architecture" (2024), with no detail. The [compare page](https://www.audioshake.ai/compare) is undated and names no dataset (vocals 13.5, drums 12.1, bass 11.9) | No MVSep entries found |
| Fadr | Nothing technical found | None |
| Steinberg Cubase 16 Pro | – | MVSep-Guitar 5.91, MVSep-Piano 5.04 (2026-11-04) |

MVSep is still the only cross-vendor per-instrument benchmark. Its vendor rows are self-submitted outputs on hidden references. No 2025–26 academic or press comparison of vendors with SDR was found.

## Ranked candidates per instrument

Notes for all the tables:
- **Ranking** is by expected gain per unit of effort on the RTX 3060.
- **Compute** is relative to the shipped chain-head time: SW 6.2× realtime, 1.5 GB peak; Kim 8.5×, 2.0 GB.
- **Effort:**
  - S: a map entry plus a matrix run.
  - M: a wrapper or harness option, or several runs.
  - L: training or a new subsystem.
- **Test sets:**
  - "v2": `musdb18hq-p1-v2`.
  - "moisesdb": `moisesdb-p1` (`--root` its folder).
  - Every `sep_matrix.py run` uses `--variant clean`, `aac128` and `limit-XL` unless stated, followed by a report.
- **Shipping rule** (the regression suite's tolerances): a change ships only if `pnpm eval:regression` shows no breach, i.e. no worse than:
  - uSDR or SI-SDR −0.5 dB;
  - bleedless or fullness −2;
  - time ×1.25, unless the change is explicitly a cost trade.

  A listening check (`p1.py export`) follows for any change under 0.5 dB.
- **Licence column:** code / weights / training data. Personal mode records licences and doesn't gate on them.

### Vocals
| # | Change | Type | Evidence and expected gain | Extra compute | VRAM | Licence | Effort | How to test / ship if |
|---|---|---|---|---|---|---|---|---|
| 1 | Leap Xe as head (Leap v1 next) | checkpoint | Multisong vocals +0.78 SDR, +1.6 bleedless, +1.5 fullness vs Kim; +0.49 vs SW *(computed)*. Expected on our sets: +0.3 to +0.8 dB *(inference)* | Unmeasured; dim 256 suggests ≤ viperx's 2.2× Kim time | Unmeasured (expect ≈ 2 GB) | MIT (MSST) / **none** / undisclosed | S | Eval map entry with `config`; matrix on v2 and moisesdb. Ship if paired median uSDR ≥ +0.3 dB vs Kim on both sets at aac128, bleedless ≥ Kim − 2 on both, then listening |
| 2 | Re-order the existing chain (SW or viperx head) | checkpoint (existing) | Already measured: +0.2 to +0.4 dB over Kim on 19–27 of 30 MoisesDB clips; Multisong agrees for SW | SW 1.4× Kim time | 1.5 GB | as shipped | S | Listening session only (data exists). Ship if raters prefer it or are neutral |
| 3 | anvuew BS-RoFormer ft1 | checkpoint | Multisong +0.53 SDR vs Kim, −1.3 bleedless, +3.2 fullness *(computed)* | Unmeasured (dim 256, depth 12) | Unmeasured | – / **GPL-3.0** / bascurtiz dataset (undisclosed) | S | As #1. It is the alternative with a stated weights licence (GPL-3.0; training data still undisclosed) if Leap's missing licence is a problem |
| 4 | Leap v1 + Xe, avg_fft (or avg_wave) | ensemble | Open seven-model ensemble +0.18 over Xe; two-model expected ≤ +0.1 to 0.2 *(inference)* | 2× head | Same as #1 | as #1 | M | `sep_matrix --keep` both, combine offline. Ship if ≥ +0.15 dB paired over the better single model with no bleedless loss |
| 5 | Pre-separation gain on hot masters | inference / robustness | Jeon & Lee 2022 (Demucs v3): loudness-normalised input shrank most of the musdb-XL drop. Our vocals cost on `limit-XL`: −2.68 dB (MoisesDB-p1), −1.30 (v2) | ≈ 0 | 0 | – | S | See first-five #2 |
| 6 | Lead-vocal option: `bs_roformer_karaoke_anvuew` on the mixture | checkpoint (feature) | Karaoke lead 10.17 SDR, bleedless 29.20 (MVSep karaoke set, 2025-10) | +1 pass when chosen | – | – / GPL-3.0 / undisclosed | M | No lead-vocal reference in our sets. Needs MoisesDB vocal sub-stems (lead vs background) as references (unverified availability) |
| 7 | LimitAug-style fine-tune of the head (limiter + AAC/Opus on the mixture) | fine-tune | LimitAug reduced the musdb-XL gap (ISMIR 2022); no RoFormer result | Training, days | 12 GB with LoRA + AMP + checkpointing *(inference)* | inherits head / MoisesDB NC | L | Only if #5 fails. Ship if `limit-XL` gains ≥ +1 dB with clean ≥ −0.2 dB |
| – | TTA, higher overlap, Apollo, phase fix, de-reverb | inference / post | ≤ +0.06 dB, or unmeasured / different task | 3–4× | – | – | – | Not recommended now |

### Drums
| # | Change | Type | Evidence and expected gain | Extra compute | VRAM | Licence | Effort | How to test / ship if |
|---|---|---|---|---|---|---|---|---|
| 1 | SW chunk 13.35 s or 20 s instead of 9.29 s | inference | Multisong drums +0.07 at 20 s vs 13.35 s; 9.29 s untested | Fewer windows; ≈ same time | ↑ per window (unmeasured) | as SW | S–M | First-five #3 |
| 2 | Pre-separation gain on hot masters | robustness | Drums on `limit-XL`: −1.76 dB (MoisesDB-p1), −1.78 (v2); see vocals #5 | ≈ 0 | 0 | – | S | First-five #2 |
| 3 | Shift averaging (BigShifts 3–5) | inference | Multisong drums +0.17 at 5 shifts, bleedless +0.7 | 3–5× SW | same | – | M | First-five #5 |
| 4 | fp16 / autocast | inference (speed) | No SDR change on Multisong; speed unmeasured | < 1× (faster) | ↓ | – | S–M (needs audio-separator ≥ 0.46 or `use_autocast` in 0.44.5, unverified) | Regression suite; ship if no breach and time ≤ 0.8× |
| 5 | Kit pieces: MDX23C DrumSep 5-stem instead of 6-stem | checkpoint (feature) | drumsep5 +0.28 to +2.11 dB per piece; loses ride/crash | Same as 6-stem | Same | MIT / undocumented / undisclosed | M (MSST loading, hash check) | No kit references in our sets (P2d data gone). Needs a drumsep5-style set or ADT F1 (P2d) |
| 6 | De-limiter front end (Jeon De-limiter, MIT) | pre-process | No separation-after-de-limit numbers anywhere | +1 small pass | Small | MIT / MIT / musdb-XL derived | M | Only if #2 leaves > 1 dB on `limit-XL` |
| – | Ensembles | ensemble | +0.24 needs MVSep-internal partners | – | – | – | – | Not available |

### Bass
| # | Change | Type | Evidence and expected gain | Extra compute | VRAM | Licence | Effort | How to test / ship if |
|---|---|---|---|---|---|---|---|---|
| 1 | SW chunk 13.35 s or 20 s | inference | Multisong bass +0.06 at 20 s vs 13.35 s | ≈ same | ↑ | as SW | S–M | First-five #3; also the `fullsong` seam ratio |
| 2 | Shift averaging | inference | Multisong +0.16 SDR, +0.82 fullness, −3.0 bleedless | 3–5× | same | – | M | First-five #5, judged by listening for "thin" bass |
| 3 | Listening check of "SW bass is thin" | evaluation | Multisong puts SW bass fullness mid-pack; our MUSDB AAC puts it lowest | 0 | 0 | – | S | `p1.py export` bass items with SW and htdemucs_ft. If SW is not judged thinner, close the issue |
| – | Average SW with htdemucs_ft | ensemble | Multisong −0.40 SDR, −4.9 bleedless | 2× | – | – | – | Rejected |
| – | Vocals-first cascade | cascade | Multisong −0.01 | +1 pass | – | – | – | Rejected |

### Guitar
| # | Change | Type | Evidence and expected gain | Extra compute | VRAM | Licence | Effort | How to test / ship if |
|---|---|---|---|---|---|---|---|---|
| 1 | SW chunk length | inference | Overlap 2 → max gave +0.04 on MVSep-Guitar; chunk untested for guitar | ≈ same | ↑ | as SW | S–M | First-five #3 on the moisesdb guitar windows |
| 2 | SW + X-LANCE `gtr_mss` weighted average (e.g. 3 : 1) | ensemble | `gtr_mss` is −0.42 vs SW at max overlap on MVSep-Guitar; no measured SW + guitar ensemble exists. Expected −0.1 to +0.2 *(inference)* | +0.5× (one more single-stem pass) | ≤ SW | MIT / MIT tag / MoisesDB NC + RawStems | M | `--keep`, combine offline. Ship only if paired ≥ +0.2 dB on moisesdb **and** confirmed on a non-MoisesDB check (an MVSep-Guitar upload or own clips), because `gtr_mss` trained on MoisesDB |
| 3 | Acoustic/electric split inside the SW guitar stem (Mega-53 heads) | checkpoint (feature) | Unnamed MVSep set: acoustic 5.00, electric 8.15 | +2 small passes | Small (77.6 MB heads; full model needs ≥ 16 GB) | MIT / not stated / undisclosed | M | moisesdb guitar windows with MoisesDB guitar sub-labels as references (unverified that the windows' sub-stems separate cleanly). Ship as a feature if each part is ≥ 3 dB uSDR on ≥ 70 % of windows that have both |
| 4 | Route to becruily when SW's guitar is far below its usual level (the `3c557409` case) | routing | One clip: 12.74 vs 5.00; becruily −3.7 on MVSep-Guitar | +1 pass when routed | 1.2 GB | – / non-commercial / undisclosed | M | Needs a reference-free trigger. Ship only if the trigger fires on ≤ 10 % of windows and paired median doesn't drop |
| 5 | LoRA fine-tune for quiet or buried guitar | fine-tune | Community +0.31 dB (own MoisesDB split); ACMID guitar +0.56 / +1.44 (acoustic / electric) with new data | Training, days | 12 GB *(inference)* | inherits SW | L | Needs a non-MoisesDB eval set first (contamination) |
| – | Lead/rhythm split | feature | Hosted MVSep only; open model unmeasured | – | – | – | – | Research |

### Piano and keys
| # | Change | Type | Evidence and expected gain | Extra compute | VRAM | Licence | Effort | How to test / ship if |
|---|---|---|---|---|---|---|---|---|
| 1 | Keys fallback: when SW's piano output is < −40 dB vs the mixture and the tagger hears keys, run the Mega-53 organ and keys heads and the X-LANCE synth chain (and `key_mss` once, to rule it out) | routing + checkpoints | Targets the 3 of 25 windows that output silence today. Mega-53 organ 10.37 and synth 2.05 (unnamed MVSep set); X-LANCE synth 2.26 MMSNR | +1–3 small passes on flagged songs only | Small heads (≤ 204 MB) | MIT / not stated and MIT tag / NC data | M | First-five #4 |
| 2 | SW chunk length | inference | As drums and bass; piano untested | ≈ same | ↑ | as SW | S–M | First-five #3 |
| 3 | Electric piano: Mega-53 digital-piano head as a partner | checkpoint | 7.96 on the unnamed MVSep set, but 1.44 on MVSep-Piano. (The tier 4 "much better for electric piano" remark is about MVSep's hosted Digital Piano model, not this head) | +1 pass | Small | as #1 | M | Only on moisesdb windows whose piano is electric |
| – | `key_mss.pth`, ensembles, Banquet, QSCNet, SAM Audio | – | `key_mss` ≈ SW; the best ensemble 6.21 < SW 7.80; conditioned models ≤ 3.4 dB SNR | – | – | – | – | Not recommended |
| – | LoRA fine-tune on MoisesDB `other_keys` plus Slakh | fine-tune | No published gain; Slakh is mono and synthetic | days | 12 GB *(inference)* | inherits SW / NC + CC BY | L | Only after #1, on a non-MoisesDB eval |

### Cross-cutting
| # | Change | Type | Evidence | Effort | How to test / ship if |
|---|---|---|---|---|---|
| 1 | Pin `overlap` (and chunk) explicitly for every RoFormer in the map before any audio-separator upgrade | config hygiene | 0.47.0 changed the default semantics | S | Regression suite before and after the upgrade: no breach |
| 2 | Pin our own hashed copies of SW and DrumSep (the original hosts are gone) | supply chain | jarredou's accounts return 404; the register already records hashes | S | `compliance/register` hashes match the mirror files |
| 3 | mlx-audio-separator on the Mac worker | efficiency | About 2× on RoFormers; SW profile "bit-identical" | M | Regression suite on the Mac. Ship if no breach and time ≤ 0.7× |
| 4 | Noise/reverb-robust model for "own recording" inputs | robustness / fine-tune | CrowdioSet: vocals 1.46 → 3.15 dB on noisy-reverberant input, −1 dB on clean | L | Needs a recorded test set first (`source-separation.md` open question) |

## First five experiments

Ordered by expected gain per effort. Each has a falsifiable criterion on our harness. "Paired median" is the median over clips of (candidate − baseline) uSDR.

1. **Leap Xe as the vocals head.**
   - **Run:** add `bs_roformer_leap_xe` to the map as an eval-only entry with its `config`, like becruily. Then `sep_matrix.py run --model bs_roformer_leap_xe --variant {clean,aac128,limit-XL}` on both v2 and moisesdb.
   - **Success:**
     - paired median uSDR **≥ +0.3 dB vs `mel_roformer_kim_vocals`** at `aac128` on both v2 and moisesdb;
     - median bleedless no more than 2 points below Kim on either set;
     - time ≤ 2.5× Kim, recorded (the doc's estimate is up to 2.2×; SW, today's alternative head, is 1.4×).
   - **Falsified if:** the paired median is < +0.1 dB on either set, which would mean Multisong's ranking doesn't transfer.
   - **If it passes:** a listening comparison of Xe, SW and Kim decides the head.
2. **Pre-separation gain on hot masters** (vocals and drums).
   - **Run:** scale the mixture to a fixed integrated loudness (for example −14 LUFS, or simply −6 dB below its level), separate, then apply the inverse gain to the stems. Apply the gain in float before any clipping: the decode cache currently clips lossy decodes of hot masters (`sep-robust/2026-11-07-loud-master.md`). Run on `limit-XL` for v2 and moisesdb, and `musdb-xl` for v2 only (it exists only for MUSDB), with the shipped heads.
   - **Success:** paired median uSDR **≥ +0.5 dB on `limit-XL`** for vocals or drums, with `clean` within ±0.1 dB. That also gives a rule: apply only above a loudness threshold, if `clean` moves.
   - **Falsified if:** the change is < +0.2 dB, meaning the RoFormers' limiter loss is distortion, not level. That is a real possibility: Jeon & Lee's result is for Demucs v3, and one research brief expected no gain. Then LimitAug fine-tuning (vocals #7) is the remaining lever.
   - **Needs:** a gain option in the wrapper or a variant in `splitune_eval.variants`.
3. **SW chunk length** (9.29 s today vs 13.35 s and 20 s).
   - **Run:** one matrix run per chunk, all five SW outputs, `clean` and `aac128`, on v2 and moisesdb, plus `p1_fullsong.py` for seams and time.
   - **Success:** paired median **≥ +0.1 dB on at least 3 of the 5 SW instruments** with none below −0.1, seam ratio not above the current 1.0 dB (bass), time ≤ 1.25×, and peak VRAM recorded.
   - **Falsified if:** every instrument is within ±0.05 dB. The Multisong evidence for this is confounded by fp16 and overlap, so a null result here is plausible.
   - **Needs:** confirming that 0.44.5 honours a chunk override for MDXC RoFormers. `mdxc_params.segment_size` and `override_model_segment_size` exist, but whether they map to the RoFormer chunk is unverified.
4. **Keys fallback for synth and organ.**
   - **Run:** on the 25 moisesdb piano windows, run the Mega-53 `organ`, `keys` and `synth` heads, the X-LANCE `syn_mss` → `syn_mss1` chain and X-LANCE `key_mss`, keeping stems. Check each file's hash against its upstream repo first: the mirrors' names are not reliable. Build the routed output offline: SW piano unless SW's piano is < −40 dB vs the mixture, else the sum of the fallback outputs. Score against the `piano + other_keys` reference.
   - **Success:**
     - the 3 silent windows (`664cc931`, `737356b2`, `765d5131`) reach **median ≥ +3 dB uSDR** (from about 0 dB);
     - routing triggers on no window where SW scores ≥ 3 dB;
     - the median over all 25 windows rises.
   - **Then:** repeat on 3–5 non-MoisesDB synth/organ-heavy clips, because X-LANCE trained on MoisesDB. Use Slakh2100 test organ/synth mixes (mono) or owner audio with a stem.
   - **Falsified if:** the silent windows stay < 1 dB.
5. **Shift averaging for drums and bass.**
   - **Run:** BigShifts 3 and 5 on SW (time-shifted passes averaged; an MSST `--bigshifts` equivalent in our wrapper). Matrix on v2 and moisesdb, `clean` and `aac128`.
   - **Success:** paired median **≥ +0.15 dB** on drums or bass, fullness up, bleedless no more than 2 points lower. Accepted as a cost trade of about 3× (BigShifts 3) to 5× (BigShifts 5); prefer 3 if it gets within 0.05 dB of 5.
   - **Bass:** also export bass items for listening, against the "thin" concern.
   - **Falsified if:** < +0.05 dB, meaning Multisong's +0.16/+0.17 doesn't transfer.

**Harness gaps these experiments expose** (to scope in the step that runs them, not here):
- **Ensembles and routing.** `sep_matrix.py` scores one model per run. Ensembles and routing need a "virtual model" that combines kept stems (`--keep`) and is scored like a model. The alternative is an offline combiner that writes the same JSONL.
- **Inference options.** Chunk, gain, shift averaging and fp16 have no map keys today (`stage_separation.config` has only `overlap` and `shifts`).
- **Checkpoints outside audio-separator's catalogue.** Mega-53 heads, the X-LANCE models and DrumSep 5-stem need either the existing `config` path (if they load as MDXC) or MSST inference. audio-separator ≥ 0.48 also needs local checksum-manifest entries.
- **References.** There is no lead-vocal, kit-piece or acoustic/electric reference in our sets yet.

## Implications for Splitune
- **Vocals.** This is the only instrument where a checkpoint swap is likely to pay off now (experiment 1). Kim's head position was already doubtful on our own data.
- **Drums, bass, guitar and piano.** Stop looking for a better downloadable checkpoint until something beats SW on MVSep. Spend effort on:
  - SW's inference settings (chunk; shifts for bass and drums);
  - loud-master robustness;
  - the keys fallback.
- **Piano UI.** The keys fallback changes what "piano" means. The piano stem would sometimes be "keys/synth". The stem label and quality hint should say which model produced it (doc 06 quality hints).
- **Provenance.**
  - Record SW's probable Apple origin in `compliance/register/models/bs-roformer-sw.yaml`, and the same for SW-initialised models (X-LANCE, CP-JKU, gilliaan).
  - Leap and Leap Xe have no licence; anvuew ft1 is GPL-3.0.
  - None of this blocks personal mode. It confirms that a later hosted mode needs its own trained models on licensed data (`source-separation-model-comparison.md` recommendation), and that fine-tuning SW does not get there.
- **Evaluation.** MoisesDB-p1 is contaminated for any MoisesDB-trained candidate (X-LANCE, chenCFD, possibly Mega-53). Uploading outputs to MVSep's quality checker is the cheapest independent check for guitar and piano. It needs an account, which this research did not create.
- **Upgrades.** Pin RoFormer `overlap` and chunk explicitly before upgrading audio-separator past 0.44.5.

## Open questions
- Is SW really Logic Pro's model? A weight-hash or architecture comparison with a Logic Pro Core ML file would settle it. That is a legal question as much as a technical one, so ask the owner before trying.
- Do Leap Xe and ft1 load through our wrapper's `config` path unchanged? What are their real speed and VRAM on the 3060?
- Does audio-separator 0.44.5 let the map set the RoFormer chunk? If not, is an upgrade to 0.48 with `overlap` pinned the cleaner route?
- What training produced X-LANCE `gtr_mss.pth`, which is not an SW slice but scores below SW?
- Which MoisesDB windows have lead-vs-background vocal and acoustic-vs-electric guitar sub-stems usable as references?
- Is a licence-clean drum kit-piece model available? Every downloadable DrumSep is undocumented.
- How large is fp16's speed-up on the 3060, and does it change any output beyond the regression tolerances?

## Sources
- [MVSep quality checker: custom leaderboard dataset descriptions](https://mvsep.com/quality_checker/custom_leaderboards) — tier 2, accessed 2026-11-07
- [MVSep Multisong leaderboard (vocals)](https://mvsep.com/quality_checker/multisong_leaderboard?sort=vocals) — tier 2, accessed 2026-11-07
- [MVSep Multisong leaderboard (drums, p2)](https://mvsep.com/quality_checker/multisong_leaderboard?sort=drums&page=2) — tier 2, accessed 2026-11-07
- [MVSep Guitar leaderboard](https://mvsep.com/quality_checker/leaderboard/guitar/?sort=guitar) — tier 2, accessed 2026-11-07
- [MVSep Piano leaderboard](https://mvsep.com/quality_checker/leaderboard/piano/?sort=piano) — tier 2, accessed 2026-11-07
- [MVSep drumsep5 leaderboard](https://mvsep.com/quality_checker/leaderboard/drumsep5/?sort=kick) — tier 2, accessed 2026-11-07
- [MVSep entry 8374 (BS Roformer SW, Multisong)](https://mvsep.com/quality_checker/entry/8374) — tier 2, accessed 2026-11-07
- [MVSep entry 8375 (SCNet XL + SW bass ensemble)](https://mvsep.com/quality_checker/entry/8375) — tier 2, accessed 2026-11-07
- [MVSep entry 8376 (MVSep drums ensemble)](https://mvsep.com/quality_checker/entry/8376) — tier 2, accessed 2026-11-07
- [MVSep entry 8377 (SW + BigShifts)](https://mvsep.com/quality_checker/entry/8377) — tier 2, accessed 2026-11-07
- [MVSep entry 8371 (SW fp16)](https://mvsep.com/quality_checker/entry/8371) — tier 2, accessed 2026-11-07
- [MVSep entry 8504 (MVSep Ensemble 2025.06.30)](https://mvsep.com/quality_checker/entry/8504) — tier 2, accessed 2026-11-07
- [MVSep entry 8905 (SW with UVR)](https://mvsep.com/quality_checker/entry/8905) — tier 2, accessed 2026-11-07
- [MVSep entry 10847 (SW, chunk 588800, fp16)](https://mvsep.com/quality_checker/entry/10847) — tier 2, accessed 2026-11-07
- [MVSep entry 10674 (SW MLX + TTA)](https://mvsep.com/quality_checker/entry/10674) — tier 2, accessed 2026-11-07
- [MVSep entry 10741 (X-LANCE drums mirror)](https://mvsep.com/quality_checker/entry/10741) — tier 2, accessed 2026-11-07
- [MVSep entry 10791 (Superoformer rev2)](https://mvsep.com/quality_checker/entry/10791) — tier 2, accessed 2026-11-07
- [MVSep entry 10988 (SW on instrumental, bass)](https://mvsep.com/quality_checker/entry/10988) — tier 2, accessed 2026-11-07
- [MVSep entry 10989 (SW + htdemucs_ft average, bass)](https://mvsep.com/quality_checker/entry/10989) — tier 2, accessed 2026-11-07
- [MVSep entry 10846 (Leap Xe vocals)](https://mvsep.com/quality_checker/entry/10846) — tier 2, accessed 2026-11-07
- [MVSep entry 10146 (Leap vocals)](https://mvsep.com/quality_checker/entry/10146) — tier 2, accessed 2026-11-07
- [MVSep entry 10845 (anvuew BS-RoFormer ft1)](https://mvsep.com/quality_checker/entry/10845) — tier 2, accessed 2026-11-07
- [MVSep entry 11098 (seven-model open vocal ensemble)](https://mvsep.com/quality_checker/entry/11098) — tier 2, accessed 2026-11-07
- [MVSep entry 10283 (becruily two-model ensemble)](https://mvsep.com/quality_checker/entry/10283) — tier 2, accessed 2026-11-07
- [MVSep entry 9180 (anvuew karaoke)](https://mvsep.com/quality_checker/entry/9180) — tier 2, accessed 2026-11-07
- [MVSep entry 9013 (frazer & becruily karaoke)](https://mvsep.com/quality_checker/entry/9013) — tier 2, accessed 2026-11-07
- [MVSep entry 9245 (SW, Guitar)](https://mvsep.com/quality_checker/entry/9245) — tier 2, accessed 2026-11-07
- [MVSep entry 9576 (SW, overlap 2)](https://mvsep.com/quality_checker/entry/9576) — tier 2, accessed 2026-11-07
- [MVSep entry 9578 (SW, Piano)](https://mvsep.com/quality_checker/entry/9578) — tier 2, accessed 2026-11-07
- [MVSep entry 8354 (Logic Pro 11.2, Guitar)](https://mvsep.com/quality_checker/entry/8354) — tier 2, accessed 2026-11-07
- [MVSep entry 8340 (Logic Pro 11.2, Piano)](https://mvsep.com/quality_checker/entry/8340) — tier 2, accessed 2026-11-07
- [MVSep entry 10188 (MLSLABS WCJ, Guitar)](https://mvsep.com/quality_checker/entry/10188) — tier 2, accessed 2026-11-07
- [MVSep entry 10972 (MLSLABS WCJ V2, Piano)](https://mvsep.com/quality_checker/entry/10972) — tier 2, accessed 2026-11-07
- [MVSep entry 10658 (X-LANCE guitar mirror)](https://mvsep.com/quality_checker/entry/10658) — tier 2, accessed 2026-11-07
- [MVSep entry 10661 (Mega-53 guitar head)](https://mvsep.com/quality_checker/entry/10661) — tier 2, accessed 2026-11-07
- [MVSep entry 10663 (chenCFD guitar)](https://mvsep.com/quality_checker/entry/10663) — tier 2, accessed 2026-11-07
- [MVSep entry 10666 (X-LANCE keys mirror)](https://mvsep.com/quality_checker/entry/10666) — tier 2, accessed 2026-11-07
- [MVSep entry 10668 (Mega-53 keys head)](https://mvsep.com/quality_checker/entry/10668) — tier 2, accessed 2026-11-07
- [MVSep entry 10669 (Mega-53 piano head)](https://mvsep.com/quality_checker/entry/10669) — tier 2, accessed 2026-11-07
- [MVSep entry 10071 (LALAL.AI piano, attribution unverified)](https://mvsep.com/quality_checker/entry/10071) — tier 2, accessed 2026-11-07
- [MVSep entry 7149 (MVSep guitar ensemble 2024)](https://mvsep.com/quality_checker/entry/7149) — tier 2, accessed 2026-11-07
- [MVSep entry 9243 (Moises Guitar 2025)](https://mvsep.com/quality_checker/entry/9243) — tier 2, accessed 2026-11-07
- [MVSep entry 11087 (Cubase 16 Pro, Guitar)](https://mvsep.com/quality_checker/entry/11087) — tier 2, accessed 2026-11-07
- [MVSep entry 8308 (becruily guitar, from mixture)](https://mvsep.com/quality_checker/entry/8308) — tier 2, accessed 2026-11-07
- [MVSep entry 8309 (becruily guitar, from instrumental)](https://mvsep.com/quality_checker/entry/8309) — tier 2, accessed 2026-11-07
- [MVSep entry 10713 (MDX23C DrumSep 5-stem mirror)](https://mvsep.com/quality_checker/entry/10713) — tier 2, accessed 2026-11-07
- [MVSep entry 10825 (jarredou BS-RoFormer DrumSep)](https://mvsep.com/quality_checker/entry/10825) — tier 2, accessed 2026-11-07
- [MVSep entry 8249 (MVSep DrumSep Mel-RoFormer v2)](https://mvsep.com/quality_checker/entry/8249) — tier 2, accessed 2026-11-07
- [MVSep algorithms: SW (77)](https://mvsep.com/algorithms/77) — tier 2, accessed 2026-11-07
- [MVSep algorithms: BS-RoFormer (34)](https://mvsep.com/algorithms/34?lang=en) — tier 2, accessed 2026-11-07
- [MVSep algorithms: Mel-RoFormer (49)](https://mvsep.com/algorithms/49?lang=en) — tier 2, accessed 2026-11-07
- [MVSep algorithms: vocal ensemble (10)](https://mvsep.com/algorithms/10?lang=en) — tier 2, accessed 2026-11-07
- [MVSep algorithms: karaoke (76)](https://mvsep.com/algorithms/76?lang=en) — tier 2, accessed 2026-11-07
- [MVSep algorithms: drums (43)](https://mvsep.com/algorithms/43) — tier 2, accessed 2026-11-07
- [MVSep algorithms: guitar (17)](https://mvsep.com/algorithms/17) — tier 2, accessed 2026-11-07
- [MVSep algorithms: keys (96)](https://mvsep.com/algorithms/96) — tier 2, accessed 2026-11-07
- [MVSep algorithms: Mega-53 (135)](https://mvsep.com/algorithms/135) — tier 2, accessed 2026-11-07
- [MVSep algorithms API JSON](https://mvsep.com/api/app/algorithms) — tier 2, accessed 2026-11-07
- [MVSep news](https://mvsep.com/en/news) — tier 2, accessed 2026-11-07
- [MSST: A Unified Framework (Solovyev et al., arXiv:2607.23395)](https://arxiv.org/abs/2607.23395) — tier 1, accessed 2026-11-07
- [MSST pretrained models list, re-checked](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/pretrained_models.md) — tier 2, accessed 2026-11-07
- [MVSep entry 10918 ("BS 6stems guitar")](https://mvsep.com/quality_checker/entry/10918) — tier 2, accessed 2026-11-07
- [MVSep entry 8362 (Logic Pro BS-RoFormer, Multisong)](https://mvsep.com/quality_checker/entry/8362) — tier 2, accessed 2026-11-07
- [MVSep Multisong leaderboard (drums)](https://mvsep.com/quality_checker/multisong_leaderboard?sort=drums) — tier 2, accessed 2026-11-07
- [MVSep algorithms: BS PolarFormer (128)](https://mvsep.com/algorithms/128) — tier 2, accessed 2026-11-07
- [MSST utils/settings.py](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/utils/settings.py) — tier 1, accessed 2026-11-07
- [MSST docs: ensemble.md](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/ensemble.md) — tier 1, accessed 2026-11-07
- [MSST docs: augmentations.md](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/augmentations.md) — tier 1, accessed 2026-11-07
- [MSST docs: LoRA.md](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/LoRA.md) — tier 1, accessed 2026-11-07
- [MSST docs: bs_roformer_info.md](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/bs_roformer_info.md) — tier 1, accessed 2026-11-07
- [MSST utils/model_utils.py](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/utils/model_utils.py) — tier 1, accessed 2026-11-07
- [MSST release v1.0.21 (Mega-53)](https://github.com/ZFTurbo/Music-Source-Separation-Training/releases/tag/v1.0.21) — tier 1, accessed 2026-11-07
- [MSST issue #1 (chenCFD guitar post)](https://github.com/ZFTurbo/Music-Source-Separation-Training/issues/1) — tier 4, accessed 2026-11-07
- [MSST issue #248 (BS-Roformer-SW provenance), re-checked](https://github.com/ZFTurbo/Music-Source-Separation-Training/issues/248) — tier 4, accessed 2026-11-07
- [python-audio-separator README](https://github.com/nomadkaraoke/python-audio-separator) — tier 2, accessed 2026-11-07
- [python-audio-separator releases](https://github.com/nomadkaraoke/python-audio-separator/releases) — tier 2, accessed 2026-11-07
- [python-audio-separator mdxc_separator.py @v0.44.5](https://github.com/nomadkaraoke/python-audio-separator/blob/v0.44.5/audio_separator/separator/architectures/mdxc_separator.py) — tier 1, accessed 2026-11-07
- [audio-separator release history (PyPI)](https://pypi.org/project/audio-separator/#history) — tier 2, accessed 2026-11-07
- [pcunwa/BS-Roformer-Leap (Hugging Face)](https://huggingface.co/pcunwa/BS-Roformer-Leap) — tier 1, accessed 2026-11-07
- [pcunwa/BS-Roformer-Leap discussion #4 (licence)](https://huggingface.co/pcunwa/BS-Roformer-Leap/discussions/4) — tier 4, accessed 2026-11-07
- [pcunwa/BS-Roformer-HyperACE (Hugging Face)](https://huggingface.co/pcunwa/BS-Roformer-HyperACE) — tier 1, accessed 2026-11-07
- [anvuew/BS-RoFormer (Hugging Face)](https://huggingface.co/anvuew/BS-RoFormer) — tier 1, accessed 2026-11-07
- [becruily/mel-band-roformer-deux (Hugging Face)](https://huggingface.co/becruily/mel-band-roformer-deux) — tier 1, accessed 2026-11-07
- [becruily/bs-roformer-delimit (Hugging Face)](https://huggingface.co/becruily/bs-roformer-delimit) — tier 1, accessed 2026-11-07
- [baicai1145/Apollo-vocal-msst (Hugging Face)](https://huggingface.co/baicai1145/Apollo-vocal-msst) — tier 1, accessed 2026-11-07
- [gilliaan/Stem-Separation-Models (Hugging Face)](https://huggingface.co/gilliaan/Stem-Separation-Models) — tier 1, accessed 2026-11-07
- [chenxie95/xlance-msr-ckpt (Hugging Face)](https://huggingface.co/chenxie95/xlance-msr-ckpt) — tier 1, accessed 2026-11-07
- [ModistAndrew/xlance-msr (GitHub)](https://github.com/ModistAndrew/xlance-msr) — tier 1, accessed 2026-11-07
- [xlance-msr ans.py](https://github.com/ModistAndrew/xlance-msr/blob/main/ans.py) — tier 1, accessed 2026-11-07
- [The SJTU X-LANCE Lab System for MSR Challenge 2025 (arXiv:2602.09042)](https://arxiv.org/abs/2602.09042) — tier 1, accessed 2026-11-07
- [Music Source Restoration challenge summary (arXiv:2601.04343), re-checked](https://arxiv.org/abs/2601.04343) — tier 1, accessed 2026-11-07
- [RawStems / Music Source Restoration (arXiv:2505.21827)](https://arxiv.org/abs/2505.21827) — tier 1, accessed 2026-11-07
- [RawStems dataset (Hugging Face)](https://huggingface.co/datasets/yongyizang/RawStems) — tier 1, accessed 2026-11-07
- [CP-JKU restoration system (arXiv:2610.08284)](https://arxiv.org/abs/2610.08284) — tier 1, accessed 2026-11-07
- [noblebarkrr/BS-Roformer-MVSep-Mega-53-stems (mirror)](https://huggingface.co/noblebarkrr/BS-Roformer-MVSep-Mega-53-stems) — tier 4, accessed 2026-11-07
- [noblebarkrr/mvsepless_resources mdx23c (mirror)](https://huggingface.co/noblebarkrr/mvsepless_resources/tree/main/mdx23c) — tier 4, accessed 2026-11-07
- [FractalSurfer/BS-RoFormer-SW-6stem (mirror)](https://huggingface.co/FractalSurfer/BS-RoFormer-SW-6stem) — tier 4, accessed 2026-11-07
- [elicwhite/bs-roformer-sw-6stem-onnx (mirror)](https://huggingface.co/elicwhite/bs-roformer-sw-6stem-onnx) — tier 4, accessed 2026-11-07
- [enerjazzer/BS-ROFO-SW-Fixed (mirror)](https://huggingface.co/enerjazzer/BS-ROFO-SW-Fixed) — tier 4, accessed 2026-11-07
- [openmirlab/mdxnet-infer](https://github.com/openmirlab/mdxnet-infer) — tier 4, accessed 2026-11-07
- [deton24, Instrumental and vocal & stems separation guide (Google Doc)](https://docs.google.com/document/d/17fjNvJzj8ZGSer7c7OFe_CNfUKbAxEh_OBv94ZdRG5c) — tier 4, accessed 2026-11-07
- [adityalakhani/htdemucs-6s-guitar-ft (Hugging Face)](https://huggingface.co/adityalakhani/htdemucs-6s-guitar-ft) — tier 4, accessed 2026-11-07
- [ACMID (arXiv:2510.07840)](https://arxiv.org/abs/2510.07840) — tier 1, accessed 2026-11-07
- [Rhythm-guitar strum transcription, Yousician (arXiv:2510.05756)](https://arxiv.org/abs/2510.05756) — tier 1, accessed 2026-11-07
- [GuitarDuets (arXiv:2507.01172)](https://arxiv.org/abs/2507.01172) — tier 1, accessed 2026-11-07
- [Banquet (arXiv:2406.18747), re-checked](https://arxiv.org/abs/2406.18747) — tier 1, accessed 2026-11-07
- [QSCNet: A Conditioned UNet for MSS (arXiv:2512.15532)](https://arxiv.org/abs/2512.15532) — tier 1, accessed 2026-11-07
- [MuS3D stem discovery (arXiv:2609.30912)](https://arxiv.org/abs/2609.30912) — tier 1, accessed 2026-11-07
- [Score-informed MSS, Tunturi et al. (arXiv:2503.07352)](https://arxiv.org/abs/2503.07352) — tier 1, accessed 2026-11-07
- [MoisesDB paper (arXiv:2307.15913), re-checked](https://arxiv.org/abs/2307.15913) — tier 1, accessed 2026-11-07
- [Slakh2100 (Zenodo 4599666)](https://zenodo.org/records/4599666) — tier 1, accessed 2026-11-07
- [Enhanced ADT via drum stem separation, Riley & Dixon (arXiv:2509.24853)](https://arxiv.org/abs/2509.24853) — tier 1, accessed 2026-11-07
- [De-limiter (arXiv:2308.01187)](https://arxiv.org/abs/2308.01187) — tier 1, accessed 2026-11-07
- [jeonchangbin49/De-limiter](https://github.com/jeonchangbin49/De-limiter) — tier 1, accessed 2026-11-07
- [Towards robust MSS on loud commercial music (arXiv:2208.14355), re-checked](https://arxiv.org/abs/2208.14355) — tier 1, accessed 2026-11-07
- [Bereuter & Sontacchi, embedding metrics (arXiv:2604.20270), re-checked](https://arxiv.org/abs/2604.20270) — tier 1, accessed 2026-11-07
- [Diffusion and consistency refinement for MSS (arXiv:2412.06965)](https://arxiv.org/abs/2412.06965) — tier 1, accessed 2026-11-07
- [CrowdioSet and PaRIRset (arXiv:2607.27828)](https://arxiv.org/abs/2607.27828) — tier 1, accessed 2026-11-07
- [FLOMSS, Sony (arXiv:2610.17821)](https://arxiv.org/abs/2610.17821) — tier 1, accessed 2026-11-07
- [audio-cpp/SAM-Audio-GGUF (VRAM measurements)](https://huggingface.co/audio-cpp/SAM-Audio-GGUF) — tier 4, accessed 2026-11-07
- [phase_fixer.py (SESA Space)](https://huggingface.co/spaces/ASesYusuf1/SESA_Audio_Separation/blob/main/phase_fixer.py) — tier 4, accessed 2026-11-07
- [mlx-audio-separator (PyPI)](https://pypi.org/project/mlx-audio-separator/) — tier 2, accessed 2026-11-07
- [demucs-mlx (PyPI)](https://pypi.org/project/demucs-mlx/) — tier 2, accessed 2026-11-07
- [chenmozhijin/BSRoformer.cpp](https://github.com/chenmozhijin/BSRoformer.cpp) — tier 2, accessed 2026-11-07
- [moises-light (unofficial, PyPI)](https://pypi.org/project/moises-light/) — tier 4, accessed 2026-11-07
- [Apple Logic Pro release notes](https://support.apple.com/en-us/109503) — tier 2, accessed 2026-11-07
- [LALAL.AI: Andromeda](https://www.lalal.ai/blog/andromeda-audio-transformer-neural-network/) — tier 2, accessed 2026-11-07
- [LALAL.AI: Andromeda supports guitars, updates piano](https://www.lalal.ai/blog/andromeda-supports-guitars-updates-piano/amp/) — tier 2, accessed 2026-11-07
- [Music.AI: source separation benchmarks](https://music.ai/blog/research/source-separation-benchmarks/) — tier 2, accessed 2026-11-07
- [Apple developer story: Moises](https://developer.apple.com/articles/moises/) — tier 2, accessed 2026-11-07
- [AudioShake compare page](https://www.audioshake.ai/compare) — tier 2, accessed 2026-11-07
