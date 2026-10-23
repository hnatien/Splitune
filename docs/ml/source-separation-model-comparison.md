---
title: Source separation model comparison (quality, cost, licensing)
workstream: ml
last_researched: 2026-10-20
confidence: medium
---

# Source separation model comparison (quality, cost, licensing)

## TL;DR
- **No open-weights model is both state of the art and clearly cleared for commercial use.** Code is almost always MIT or Apache-2.0, but strong weights are trained on non-commercial data (MUSDB18-HQ, MoisesDB) or on undisclosed data.
- **Recommended for production v1:** a commercial API (AudioShake, Music.AI/Moises or LALAL.AI) chosen by a blind listening test. **Recommended for scale later:** an MIT-licensed architecture (BS-RoFormer, Mel-RoFormer or SCNet) trained by Splitune on licensed multitracks.
- **Best open checkpoints for internal R&D and benchmarking:** BS-/Mel-RoFormer community checkpoints (best vocals, 10.9–12.3 dB on Multisong), SCNet XL (best 4-stem trained on MUSDB only), and HT-Demucs v4 (best documented, easiest to run).
- **Explicitly permissive weights exist only at lower quality.** Spleeter's code and pretrained models are MIT, trained on Deezer-internal data, but about 3 dB behind the state of the art. SAM Audio's custom licence has no non-commercial clause but is heavy and prompt-driven.
- **Non-commercial flags:** Open-Unmix `umxl` (weights CC-BY-NC-SA-4.0), every checkpoint trained only on MUSDB18-HQ or MoisesDB, and the Essentia and MERT families used elsewhere in the pipeline.

## Findings

How to read the table:
- **Benchmarks:** MUSDB = MUSDB18-HQ test, 50 songs, chunk-median SDR. Multisong = MVSep's private 100-song set. MoisesDB = mean SDR from the MoisesDB paper. The three are not comparable with each other. Metric definitions are in `ml/datasets-metrics-and-licensing.md`.
- **"Commercial use" means using the weights in a paid product.** It is a research judgement, not legal advice.

| # | Model / version | Repo | Stems | Benchmark (dataset, metric) | Size / speed | Code licence | Weights licence | Training data / provenance | Commercial use | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **HT-Demucs v4** (`htdemucs`, `htdemucs_ft`) | [facebookresearch/demucs](https://github.com/facebookresearch/demucs) (archived 2025; fork `adefossez/demucs`) | V/D/B/O | 9.00 dB avg MUSDB HQ (paper); `htdemucs_ft` 9.0 ([README](https://github.com/facebookresearch/demucs)). Multisong avg 9.16 ([MSST](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/pretrained_models.md)). MoisesDB 4-stem overall 9.91 ([MoisesDB](https://arxiv.org/pdf/2307.15913)) | CPU ≈1.5× track length; GPU ≥3 GB (≈7 GB default); `_ft` ≈4× slower ([README](https://github.com/facebookresearch/demucs)); ~81 MB f16 ([demucs.cpp](https://github.com/sevagh/demucs.cpp)) | MIT | Not stated separately. README says Demucs "is released under the MIT license" but does not mention the weights | MUSDB HQ + 800 extra songs of undisclosed licensing ([README](https://github.com/facebookresearch/demucs)). MUSDB terms forbid commercial use ([Zenodo](https://zenodo.org/records/3338373)) | **Unclear.** Permissive code, but weights partly derived from NC data with no explicit weights grant | Alternative (R&D baseline; not for production without legal sign-off) |
| 2 | **HT-Demucs 6-source** (`htdemucs_6s`) | [facebookresearch/demucs](https://github.com/facebookresearch/demucs) | V/D/B/O + guitar + piano | MoisesDB: guitar 3.07, piano 1.60, other 0.28 dB ([MoisesDB T3](https://arxiv.org/pdf/2307.15913)). Multisong piano 2.23 ([MVSep](https://mvsep.com/en/algorithms)). Authors: piano "a lot of bleeding" ([README](https://github.com/facebookresearch/demucs)) | ~53 MB f16 ([demucs.cpp](https://github.com/sevagh/demucs.cpp)) | MIT | Not stated | As row 1 (undisclosed) | **Unclear** (as row 1) | Not recommended (guitar and piano too weak) |
| 3 | **BS-RoFormer** (paper; MSST MUSDB-only checkpoint) | Paper [arXiv:2309.02612](https://arxiv.org/abs/2309.02612); impl. [lucidrains/BS-RoFormer](https://github.com/lucidrains/BS-RoFormer); ckpt [MSST](https://github.com/ZFTurbo/Music-Source-Separation-Training) | V/D/B/O | Paper: 9.80 dB avg MUSDB (no extra data); L=9 10.02 ([Mel-RoFormer T1](https://arxiv.org/html/2310.01809)). MSST MUSDB-only ckpt: 9.65 MUSDB / 9.38 Multisong ([MSST](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/pretrained_models.md)). SDX'23 winner 9.97 global SDR ([TISMIR](https://transactions.ismir.net/articles/171)) | 72–83M params per stem ([Mel-RoFormer T1](https://arxiv.org/html/2310.01809)); heaviest mask model | MIT (lucidrains, MSST) | No official ByteDance weights; MSST checkpoint licence not stated | MSST ckpt: MUSDB18-HQ only (NC). ByteDance SDX model: +500 private songs, unreleased | **No** for the MUSDB-only ckpt (NC data). **Yes for the architecture** if Splitune trains it on licensed data | Recommended architecture to train in-house; checkpoint for R&D only |
| 4 | **BS-RoFormer vocals** (viperx; MVSep 124-band 2026.07) | [MSST list](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/pretrained_models.md); [MVSep](https://mvsep.com/en/algorithms) | vocals / instrumental | viperx: 10.87 dB vocals Multisong. MVSep 124-band: 12.33 / 18.64 Multisong (best listed) | As row 3 | MIT (harness) | Not stated (viperx); MVSep model is service-only | Undisclosed community / commercial data | **Unclear** (viperx); **No** for self-hosting MVSep's model (not distributed) | Alternative (R&D vocals reference) |
| 5 | **Mel-Band RoFormer vocals** (Kimberley Jensen) | [KimberleyJensen/Mel-Band-Roformer-Vocal-Model](https://github.com/KimberleyJensen/Mel-Band-Roformer-Vocal-Model); [HF](https://huggingface.co/KimberleyJSN/melbandroformer) | vocals / other | 10.98 dB vocals Multisong ([MSST](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/pretrained_models.md)). Architecture: 11.21–11.60 vocals MUSDB ([paper](https://arxiv.org/html/2310.01809)) | 84–95M params ([paper](https://arxiv.org/html/2310.01809)) | Not stated on GitHub | HF tag **MIT** ([HF](https://huggingface.co/KimberleyJSN/melbandroformer)) | "Author's dataset", community-contributed, sources undisclosed ([README](https://github.com/KimberleyJensen/Mel-Band-Roformer-Vocal-Model)) | **Unclear.** MIT tag on weights, but the training data's rights are unknown | Alternative (R&D; ask the author about data provenance) |
| 6 | **BS-Roformer SW** (community 6-stem) | Distributed via MVSep and community re-uploads (no canonical repo found) | V/D/B/guitar/piano/O | Multisong: bass 14.62, drums 14.11, vocals 11.30, guitar 9.05, piano 7.83 ([MVSep](https://mvsep.com/en/algorithms)) | RoFormer-class (size not published) | n/a | Unknown | Unknown | **Unclear / assume No** | Alternative (best open guitar/piano reference for R&D only) |
| 7 | **SCNet** (official S/L; MSST XL/XL-IHF) | [starrytong/SCNet](https://github.com/starrytong/SCNet); [MSST](https://github.com/ZFTurbo/Music-Source-Separation-Training) | V/D/B/O | Paper 9.0 dB MUSDB-HQ ([arXiv](https://arxiv.org/abs/2401.13276)). SCNet-L 9.69, SCNet-S 9.00 ([Moises-Light T4](https://arxiv.org/html/2510.06785v1)). MSST SCNet XL IHF 10.08 MUSDB / 9.92 Multisong ([MSST](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/pretrained_models.md)) | 10M (S) / 42M (L); CPU time 48% of HT-Demucs ([arXiv](https://arxiv.org/abs/2401.13276)) | MIT | Not stated | MUSDB (NC) for official and MSST MUSDB-only checkpoints | **No** for these checkpoints; **Yes for the architecture** with own data | Recommended architecture (best quality per compute; on-device candidate) |
| 8 | **MDX23C / TFC-TDF-UNet v3** | [kuielab/sdx23](https://github.com/kuielab/sdx23); [MSST](https://github.com/ZFTurbo/Music-Source-Separation-Training) | V/D/B/O; vocal; DrumSep sub-stems | KUIELab: SDX'23 leaderboard B 1st (6.58 song SDR) ([repo](https://github.com/kuielab/sdx23)). MUSDB 8.34 ([Mel-RoFormer T1](https://arxiv.org/html/2310.01809)). MSST vocal ckpt 10.17 Multisong. DrumSep MDX23C kick 16.66 / snare 11.53 ([MSST](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/pretrained_models.md)) | 70M ([Moises-Light T4](https://arxiv.org/html/2510.06785v1)) | MIT | Not stated | KUIELab: SDX'23 Moises-provided challenge data (challenge-only terms). MSST/DrumSep: undisclosed | **Unclear / No** | Alternative (DrumSep is uniquely useful for drummers, R&D only) |
| 9 | **Open-Unmix** (`umxhq`, `umxl`) | [sigsep/open-unmix-pytorch](https://github.com/sigsep/open-unmix-pytorch) | V/D/B/O | `umxl`: vocals 7.21, bass 6.02, drums 7.15, other 4.89. `umxhq`: vocals 6.25 ([README](https://github.com/sigsep/open-unmix-pytorch)) | Small LSTM model; fast | MIT | **`umxl`: CC-BY-NC-SA-4.0 (explicit).** `umxhq`: not stated | `umxl`: private compressed stems. `umxhq`: MUSDB18-HQ (NC) | **No** | Not recommended |
| 10 | **Spleeter** (2/4/5-stem) | [deezer/spleeter](https://github.com/deezer/spleeter) | 2, 4, or 5 (adds piano) | MUSDB18 (not trained on it): vocals 6.55–6.86, drums 5.93–6.71, bass 5.10–5.51, other 4.24–4.55 ([JOSS](https://joss.theoj.org/papers/10.21105/joss.02154.pdf)). MoisesDB 5-stem piano 1.17 ([MoisesDB](https://arxiv.org/pdf/2307.15913)) | ~100× real time on RTX 2080 ([JOSS](https://joss.theoj.org/papers/10.21105/joss.02154.pdf)); TensorFlow | MIT | **MIT.** The JOSS paper says the code and pre-trained models are distributed under MIT | Deezer-internal datasets (incl. "Bean"), not released ([JOSS](https://joss.theoj.org/papers/10.21105/joss.02154.pdf)) | **Yes (lowest risk)**: explicit permissive grant from the data owner | Alternative (fallback/offline mode only; quality is 2019-era) |
| 11 | **Banquet** (query-bandit) | [kwatcharasupat/query-bandit](https://github.com/kwatcharasupat/query-bandit) | Any instrument by query (guitar, piano, reeds, organ...) | Beats `htdemucs_6s` on guitar and piano on MoisesDB; near it on VDBO ([arXiv](https://arxiv.org/abs/2406.18747)) | 24.9M params + PaSST query encoder | MIT | Not stated (Zenodo) | MoisesDB evaluation; training data presumably MoisesDB (CC-BY-NC-SA-4.0) | **No / unclear** | Alternative (design reference for "isolate my instrument") |
| 12 | **BandIt v2** | [kwatcharasupat/bandit-v2](https://github.com/kwatcharasupat/bandit-v2) | speech / music / effects (cinematic) | MSST BandIt Plus: 11.50 avg on DnR ([MSST](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/pretrained_models.md)) | – | Apache-2.0 | Not stated (Zenodo) | Divide-and-Remaster (cinematic) | Unclear | Not recommended (wrong task: separates music from dialogue, not instruments) |
| 13 | **Meta SAM Audio** (small/base/large, `-tv`) | [facebookresearch/sam-audio](https://github.com/facebookresearch/sam-audio) | Any sound by text, time-span or video prompt | Subjective OVR: MUSDB instruments 4.45 (Large) vs AudioShake 4.28, Demucs 4.26; in-the-wild instruments 4.00 vs MoisesAI 3.12 ([paper](https://arxiv.org/html/2512.18099)). No SDR reported | 0.5B / 1B / 3B; Large ≈7.3 s per 10 s on an A100 ([paper](https://arxiv.org/html/2512.18099)) | SAM License | **SAM License** (custom): royalty-free use, copy, modify and distribute; no NC clause; trade-control and acceptable-use limits; gated download ([LICENSE](https://github.com/facebookresearch/sam-audio/blob/main/LICENSE); [HF card](https://huggingface.co/facebook/sam-audio-small/blob/main/README.md)) | Mostly internal Meta data: ~536 h multitrack music, ~20k h clean music, ~1M h audio-video ([paper](https://arxiv.org/html/2512.18099)) | **Probably yes**, subject to the custom terms and legal review | Alternative (promising for video-click "isolate that guitarist"; too heavy for default path) |
| 14 | **Moises-Light** | Paper only ([arXiv](https://arxiv.org/abs/2510.06785)) | V/D/B/O | 9.96 dB avg MUSDB-HQ, no extra data ([T4](https://arxiv.org/html/2510.06785v1)) | 5M×4 params | Not released (as far as found) | Not released | MUSDB-HQ (+ MoisesDB variant) | n/a | Not recommended (unavailable; signals Moises' efficiency focus) |
| 15 | **AudioShake** (API/SDK) | [audioshake.ai](https://www.audioshake.ai/) | V/D/B, guitar, piano, winds, strings, other, + dialogue/FX | MDX'21 leaderboard B 1st, 8.33 dB ([MDX21](https://arxiv.org/html/2108.13559v3)). SAM paper OVR 4.28 MUSDB / 3.43 wild ([SAM](https://arxiv.org/html/2512.18099)). Instrument models Sept 2025, no SDR ([post](https://www.audioshake.ai/post/audioshake-debuts-new-instrument-separation-models)) | Cloud API; real-time SDK | Proprietary | Proprietary (service) | Undisclosed; label customers (UMG, WMG, Disney…) ([site](https://www.audioshake.ai/)) | **Yes, per contract** (terms not reviewed here) | Recommended (v1 candidate) |
| 16 | **Music.AI / Moises** (API) | [music.ai](https://music.ai/product/) | Vocals, bass, drums, guitar (shown) + chords, sections, lyrics, instrument tags | Self-claimed "+15.8% avg SDR" vs unnamed competitor ([product](https://music.ai/product/)). SAM paper OVR 3.90 music ([SAM](https://arxiv.org/html/2512.18099)). MDX'21 leaderboard A 3rd, 6.88 ([MDX21](https://arxiv.org/html/2108.13559v3)) | Cloud API | Proprietary | Proprietary | Undisclosed ("ethical AI" claim, [music.ai](https://music.ai/)) | **Yes, per contract** | Recommended (v1 candidate; also bundles chords and structure) |
| 17 | **LALAL.AI** (API) | [lalal.ai](https://www.lalal.ai/) | Vocals, drums, bass, acoustic and electric guitar, piano, synth, strings, wind, lead/back vocals | No public benchmark (marketing only) | Cloud API, desktop, VST | Proprietary | Proprietary | Undisclosed | **Yes, per contract** | Alternative (widest instrument menu; quality unverified) |

### Notes behind the commercial-use column
- **MUSDB18/MUSDB18-HQ:** "should not be used for any commercial purpose without the express permission of the copyright holders" ([Zenodo](https://zenodo.org/records/3338373)). The SigSep page says "academic purposes" only ([SigSep](https://sigsep.github.io/datasets/musdb.html)). **MoisesDB** is CC-BY-NC-SA-4.0 ([repo](https://github.com/moises-ai/moises-db)). Whether NC data legally "taints" trained weights is unsettled (see `ml/datasets-metrics-and-licensing.md`). The conservative position used here: treat such weights as **not usable commercially** unless the model owner grants a licence that covers it.
- **Weights with no stated licence** are not open source by default. The ZFTurbo MSST repo is MIT, but its pretrained list carries no weights licence ([MSST](https://github.com/ZFTurbo/Music-Source-Separation-Training)). UVR states no weights licence either ([UVR](https://github.com/Anjok07/ultimatevocalremovergui)).
- **Explicit permissive grants found:** Spleeter (MIT, from the data owner Deezer) ([JOSS](https://joss.theoj.org/papers/10.21105/joss.02154.pdf)); Kimberley Jensen's Mel-RoFormer (HF "mit" tag, but the data is undisclosed); SAM Audio (custom licence without a non-commercial clause).

### Shortlist by Splitune need
| Need | Production path | R&D reference |
|---|---|---|
| Vocals (singers; karaoke-style practice) | Vendor API | BS/Mel-RoFormer vocal checkpoints |
| Drums / bass "minus-one" tracks | Vendor API | HT-Demucs, SCNet XL |
| Guitar, piano | Vendor API with instrument models (AudioShake, LALAL.AI, Music.AI) | BS-Roformer SW, Banquet |
| Drum kit pieces (kick/snare/hats) | None verified commercially | MSST DrumSep (MDX23C, Mel-RoFormer) |
| Click-to-isolate from video | Later: SAM Audio (licence review) | SAM Audio |
| Own model at scale | Train SCNet or BS/Mel-RoFormer (MIT code) on licensed multitracks via MSST | — |

## Implications for Splitune
- Put separation behind a provider interface (`separate(audio, stems[]) → stems + model_id + version`) so vendor and in-house models can be swapped and A/B tested. Cache per user, keyed by (user, audio_hash, model_version); no cross-user shared cache until counsel approves (see `legal/youtube-copyright-and-platform-policy.md`).
- **Do not ship community checkpoints** in a paid product without written clearance; the legal surface is the weights, not the MIT code. Record model provenance in a model registry, with fields for code licence, weights licence and data licence.
- Budget an evaluation harness early: MSST inference, plus a blind A/B listening page with learners on 30–50 lawfully obtained clips with YouTube-like characteristics (lossy ~128 kb/s AAC, loud masters). Use SDR only as a sanity check. Deployment cost per minute is in `ml/deployment-and-inference.md`; vendor pricing is in `market/pricing-and-business-models.md`.

## Open questions
- What are AudioShake, Music.AI and LALAL.AI's per-instrument quality on Splitune's own test set, and do their terms allow caching stems for a user's repeated practice? Needs trials and a contract review.
- Will Meta clarify commercial use of SAM Audio for a consumer app? A legal read of the SAM License is needed.
- Can Splitune license multitrack catalogues (stem libraries, label deals) to train its own model? See `legal/youtube-copyright-and-platform-policy.md`.
- Training-data provenance of BS-Roformer SW, the viperx models and Kimberley Jensen's model: contact the authors.

## Sources
- [facebookresearch/demucs README](https://github.com/facebookresearch/demucs) — tier 1, accessed 2026-10-20
- [MSST pretrained models list](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/pretrained_models.md) — tier 2, accessed 2026-10-20
- [ZFTurbo Music-Source-Separation-Training repo](https://github.com/ZFTurbo/Music-Source-Separation-Training) — tier 2, accessed 2026-10-20
- [MoisesDB paper PDF (arXiv:2307.15913)](https://arxiv.org/pdf/2307.15913) — tier 1, accessed 2026-10-20
- [moises-ai/moises-db repo](https://github.com/moises-ai/moises-db) — tier 1, accessed 2026-10-20
- [sevagh/demucs.cpp](https://github.com/sevagh/demucs.cpp) — tier 2, accessed 2026-10-20
- [MUSDB18-HQ on Zenodo](https://zenodo.org/records/3338373) — tier 1, accessed 2026-10-20
- [SigSep MUSDB18 dataset page](https://sigsep.github.io/datasets/musdb.html) — tier 1, accessed 2026-10-20
- [MVSep algorithms list](https://mvsep.com/en/algorithms) — tier 2, accessed 2026-10-20
- [BS-RoFormer paper (arXiv:2309.02612)](https://arxiv.org/abs/2309.02612) — tier 1, accessed 2026-10-20
- [lucidrains/BS-RoFormer](https://github.com/lucidrains/BS-RoFormer) — tier 2, accessed 2026-10-20
- [Mel-Band RoFormer paper (arXiv:2310.01809)](https://arxiv.org/html/2310.01809) — tier 1, accessed 2026-10-20
- [SDX'23 Music Demixing Track (TISMIR)](https://transactions.ismir.net/articles/171) — tier 1, accessed 2026-10-20
- [KimberleyJensen/Mel-Band-Roformer-Vocal-Model](https://github.com/KimberleyJensen/Mel-Band-Roformer-Vocal-Model) — tier 2, accessed 2026-10-20
- [KimberleyJSN/melbandroformer (Hugging Face)](https://huggingface.co/KimberleyJSN/melbandroformer) — tier 2, accessed 2026-10-20
- [starrytong/SCNet](https://github.com/starrytong/SCNet) — tier 1, accessed 2026-10-20
- [SCNet paper (arXiv:2401.13276)](https://arxiv.org/abs/2401.13276) — tier 1, accessed 2026-10-20
- [Moises-Light paper HTML (arXiv:2510.06785v1)](https://arxiv.org/html/2510.06785v1) — tier 1, accessed 2026-10-20
- [Moises-Light arXiv abstract](https://arxiv.org/abs/2510.06785) — tier 1, accessed 2026-10-20
- [kuielab/sdx23](https://github.com/kuielab/sdx23) — tier 1, accessed 2026-10-20
- [sigsep/open-unmix-pytorch](https://github.com/sigsep/open-unmix-pytorch) — tier 1, accessed 2026-10-20
- [deezer/spleeter](https://github.com/deezer/spleeter) — tier 1, accessed 2026-10-20
- [Spleeter JOSS paper PDF](https://joss.theoj.org/papers/10.21105/joss.02154.pdf) — tier 1, accessed 2026-10-20
- [kwatcharasupat/query-bandit](https://github.com/kwatcharasupat/query-bandit) — tier 1, accessed 2026-10-20
- [Banquet paper (arXiv:2406.18747)](https://arxiv.org/abs/2406.18747) — tier 1, accessed 2026-10-20
- [kwatcharasupat/bandit-v2](https://github.com/kwatcharasupat/bandit-v2) — tier 1, accessed 2026-10-20
- [facebookresearch/sam-audio](https://github.com/facebookresearch/sam-audio) — tier 1, accessed 2026-10-20
- [SAM License](https://github.com/facebookresearch/sam-audio/blob/main/LICENSE) — tier 1, accessed 2026-10-20
- [facebook/sam-audio-small model card](https://huggingface.co/facebook/sam-audio-small/blob/main/README.md) — tier 1, accessed 2026-10-20
- [SAM Audio paper (arXiv:2512.18099)](https://arxiv.org/html/2512.18099) — tier 1, accessed 2026-10-20
- [AudioShake homepage](https://www.audioshake.ai/) — tier 2, accessed 2026-10-20
- [AudioShake: new instrument separation models](https://www.audioshake.ai/post/audioshake-debuts-new-instrument-separation-models) — tier 2, accessed 2026-10-20
- [MDX'21 challenge paper (arXiv:2108.13559v3)](https://arxiv.org/html/2108.13559v3) — tier 1, accessed 2026-10-20
- [Music.AI product page](https://music.ai/product/) — tier 2, accessed 2026-10-20
- [Music.AI homepage](https://music.ai/) — tier 2, accessed 2026-10-20
- [LALAL.AI homepage](https://www.lalal.ai/) — tier 2, accessed 2026-10-20
- [Ultimate Vocal Remover GUI](https://github.com/Anjok07/ultimatevocalremovergui) — tier 2, accessed 2026-10-20
