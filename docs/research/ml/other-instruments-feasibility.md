---
title: Other instruments — separation and transcription feasibility
workstream: ml
last_researched: 2026-11-07
confidence: medium
---

# Other instruments: separation and transcription feasibility

This doc is the per-instrument ML evidence behind the scored matrix in `research/product/additional-instruments.md`. It replaces the short "Other instruments (feasibility only)" section of `transcription-general.md`. Separation improvements for the instruments we already ship are in `separation-improvements-2026-11.md`, researched the same day: the keys fallback, DrumSep variants, karaoke models and Mega-53 per-stem heads. This doc cites it rather than repeating it. Confidence differs by family:
- **Medium:** drum-kit pieces, lead/backing vocals, violin, saxophone and keys. Tier-1 or credible tier-2 numbers exist.
- **Low:** ukulele, banjo, mandolin, harmonica and hand percussion. No public annotated audio exists for them, so most statements are inference.

## TL;DR
- **Separation is the bottleneck for every new family; transcription mostly is not.**
  - BS-Roformer-SW (our separator) has no stem for strings, winds, keys other than piano, or "other plucked". In our own MoisesDB run it put synths and organs in `other` and output nothing in `piano` on 3 of 25 piano windows (`services/ml/eval/results/sep-robust/2026-11-07-moisesdb.md`).
  - The best open per-family models are tier-2 only. Two of them run on MVSep's public sets:
    - Bowed strings: `gilliaan` BS-RoFormer v2, 4.69 dB, CC BY-NC-SA.
    - Wind: Mega 53-stem, 8.63 dB.
  - Peer-reviewed real-mix numbers are low: ACMID SCNet scores strings 5.93 dB and wind/brass 4.24 dB on MoisesDB+MedleyDB test songs ([arXiv:2510.07840](https://arxiv.org/html/2510.07840v1)).
- **Most of the wanted variants can be measured on data we already hold.** We hold MoisesDB, so we can count the songs per variant from its stem charts ([arXiv:2307.15913](https://arxiv.org/pdf/2307.15913)).
  - Plenty to test on: synths and organs ("other keys") appear in 110 songs, the same as piano, and background vocals in 127.
  - Fine labels: drums have per-piece tracks (kick and snare 202 songs, hi-hat 115). Guitars split into acoustic 122, distorted 113 and clean 98.
  - Thin: bowed strings 45 songs (37 of them sections), wind 26, and banjo, mandolin, ukulele and harp together only 7.
- **Two variants of instruments we already support are close to ready:**
  - **Drum-kit pieces:** a drum-only separator (DrumSep) runs on our drums stem. The best entry scores kick 18.67, snare 13.56 and toms 13.61 dB, but hi-hat with cymbals only 8.77 dB, on MVSep's 150-track set ([leaderboard](https://de.mvsep.com/quality_checker/leaderboard/drumsep5/?sort=kick)).
  - **Lead vs backing vocals:** an open karaoke model run on our vocals stem scores lead 8.88 / backing 4.73 dB on MVSep's 48-track set ([leaderboard p.2](https://de.mvsep.com/quality_checker/leaderboard/lead_back_vocals/?sort=back&page=2)).
- **A new open 53-stem model exists, but its own numbers can't be trusted:**
  - MVSep's Mega 53-stem BS-RoFormer shipped in MSST v1.0.21 on 2026-04-20. It is 1.37 GB, and its author recommends "at least 16 GB of VRAM", more than our 12 GB card ([release](https://api.github.com/repos/ZFTurbo/Music-Source-Separation-Training/releases/tags/v1.0.21)).
  - A community mirror splits it into per-stem heads of 77.6 MB each, which may sidestep the VRAM limit (`separation-improvements-2026-11.md` §4–5). The heads named there are guitar, keys and organ; whether wind or strings heads run alone is unverified.
  - Its per-stem table is on an unnamed set. Its bowed-strings stem scores 12.45 dB there but 0.20 dB on MVSep's public strings set (rank 32 of 34) ([algorithm 135](https://de.mvsep.com/algorithms/135), [strings p.2](https://de.mvsep.com/quality_checker/leaderboard/strings/?sort=strings&page=2)). Treat it as a ranking hint and measure it ourselves.
- **Transcription:**
  - **Violin** has real specialists:
    - MUSC (AGPL-3.0) scores URMP violin F1 84.6 with offsets and 93.0 onset-only. A Kong-style CRNN trained on MOSA scores 84.5 / 93.1 ([arXiv:2508.13516](https://arxiv.org/html/2508.13516v2)).
    - On Bach10 the best setup is 71.5 / 80.2.
  - **Monophonic winds and double bass:** pitch tracking plus note segmentation beats Basic Pitch. CREPE Notes reports 90% onset-only F on FiloSax saxophone and is 7 points above Basic Pitch on Irish flute and 10 points above on FiloBass ([PyPI](https://pypi.org/pypi/crepe-notes/json)). It is GPL-3.0 with a non-commercial madmom dependency, so reimplement the method rather than ship it.
  - **Ukulele, banjo, mandolin, harmonica, cajón, congas:** there is no public annotated audio for any of them.
- **Licences, in personal mode a record, not a gate:**
  - **Same tier as today's chains:** red, because weights licences are unstated and training data is undisclosed (`compliance/register/models/`). This covers SW, DrumSep, Mega and becruily.
  - **Worse:** violin needs AGPL code (MUSC) or weights trained on restricted data (VioPTT, MOSA), plus a CC BY-NC-SA strings separator.
  - **Clean data:** ChoraleBricks (13 wind instruments, CC-BY-4.0) and Dagstuhl ChoirSet (CC-BY-4.0) are the only commercially clean new evaluation sets found.

## Findings

### 1. How to read this doc
- **Separation scores (S, 1–5):**
  - 5 = a shipped stem already isolates it.
  - 4 = an open checkpoint with credible public numbers that runs on 12 GB, or an existing stem covers it.
  - 3 = an open or service model with weak or unverified numbers; needs our own measurement.
  - 2 = only a family-level stem or a vendor service; no usable per-instrument numbers.
  - 1 = nothing.
- **Transcription scores (T):**
  - 5 = shipped.
  - 4 = a specialist model or proven method with tier-1 numbers on real audio.
  - 3 = plausible reuse, with only synthetic or adjacent numbers.
  - 2 = no dataset or model; heuristics only.
  - 1 = nothing plausible.
- **Licence scores (L):**
  - 5 = code, weights and data all permissive.
  - 4 = permissive code and weights, mixed data.
  - 3 = red-tier weights (unstated licence or undisclosed data), the same tier as the chains we already run.
  - 2 = the path needs non-commercial weights or data, or (A)GPL code.
  - 1 = no usable artefact.
- **Metric families are not comparable across sources:**
  - MVSep leaderboards use whole-clip SDR on private sets of about 1 minute per track. This is the same family as our uSDR (`source-separation.md`, "2026-11 evaluation practice").
  - Banquet reports median full-track SNR, and LarsNet reports nSDR.
  - MVSep entries carry version labels but no dates.
- **Mix-minus** means building the stem from SW's existing outputs (`vocals, drums, bass, guitar, piano, other`). Every mix-minus statement here is inference unless it carries a number.

### 2. Cross-cutting evidence

#### 2.1 MoisesDB: songs containing each stem (tier 1)
Counts were decoded from the bar charts (Figures 4 and 7) of the MoisesDB paper PDF; 240 songs in total ([arXiv:2307.15913](https://arxiv.org/pdf/2307.15913)). Two pairs of fine labels were merged in the PDF text layer and assigned by tick order, so treat the fine counts as ±1 label swap. The top-level counts are unambiguous.

| Top-level stem | Songs | Fine tracks (songs containing) |
|---|---|---|
| Vocals | 239 | lead male 176, background vocals 127, lead female 69 |
| Drums | 238 | kick 202, snare 202, toms 136, hi-hat 115, overheads 108, cymbals 90, drum machine 38 |
| Bass | 236 | bass guitar 210, bass synth 39, contrabass 9 |
| Guitar | 222 | acoustic 122, distorted electric 113, clean electric 98 |
| Other keys | 110 | synth pad 51, organ 44, synth lead 41 |
| Piano | 110 | grand 94, electric piano 35 |
| Percussion | 99 | a-tonal 87, pitched 18 |
| Bowed strings | 45 | string section 37, other strings 6, cello 2, viola 1 |
| Wind | 26 | brass 13, reeds 9, other wind 5, flutes 2 |
| Other plucked | 7 | banjo/mandolin/ukulele/harp (one label) |

- **Inference:** MoisesDB is enough to evaluate the separation of keys, backing vocals, drum pieces and the acoustic/electric split.
  - It cannot evaluate ukulele, banjo, mandolin, harmonica, hand-percussion types, lead vs rhythm guitar or extended-range instruments.
  - Data for solo violin as distinct from a string section is too thin (1–2 songs).
- The MoisesDB authors expect "other plucked" tracks to "still be difficult to distinguish from 'guitar' tracks" ([arXiv HTML](https://arxiv.org/html/2307.15913)).
- MoisesDB is CC BY-NC-SA 4.0 ("non-commercial research use only").

#### 2.2 MVSep public leaderboards (tier 2)
The datasets are described on [MVSep custom leaderboards](https://de.mvsep.com/quality_checker/custom_leaderboards). Track sources are not stated.

| Set | Size | Best entry (SDR) | Best open checkpoint we could run |
|---|---|---|---|
| Strings ("only bowed strings") | 30 × ~1 min | MVSEP Strings BSRoformer (2025.09) 5.42 | `gilliaan_bsroformer_bowedstrings_v2` 4.69 (rank 6; 303 MB; CC BY-NC-SA 4.0) ([leaderboard](https://de.mvsep.com/quality_checker/leaderboard/strings/?sort=strings), [HF](https://huggingface.co/gilliaan/Stem-Separation-Models)) |
| Wind (brass + woodwind) | 35 × ~1 min | MVSep Wind BS Roformer (2025.08) 9.82 | `bs_mega_53stem_wind_mvsep.ckpt` 8.63 (rank 2) ([leaderboard](https://de.mvsep.com/quality_checker/leaderboard/wind/?sort=wind)) |
| Lead/Back vocals | 48 × 40 s | "Mel-RoFormer (Karaoke / Duet)" 11.08 lead / 7.14 back (availability unverified) | becruily MelBand Karaoke (extract from vocals) 8.88 / 4.73 (no licence stated) ([p.2](https://de.mvsep.com/quality_checker/leaderboard/lead_back_vocals/?sort=back&page=2)) |
| Drums, 5 stems | 150 drum-only tracks | DrumSep Mel Band Roformer v2 (4 stems): kick 18.67, snare 13.56, toms 13.61, hh+cymbals 8.77 (download unverified) | MDX23C 5-stem: kick 16.66, snare 11.53, toms 12.32, hh 4.05, cymbals 6.36 (original host deleted, mirror only). The 6-stem MDX23C (aufr33 + jarredou) in our register: 14.55 / 9.79 / 10.64 / 3.20 / 6.08 ([leaderboard](https://de.mvsep.com/quality_checker/leaderboard/drumsep5/?sort=kick); `separation-improvements-2026-11.md` §2) |
| Guitar | 30 × ~1 min | — | SW 9.01; Mega 8.25 ([leaderboard](https://de.mvsep.com/quality_checker/leaderboard/guitar/?sort=guitar)) |
| Piano (acoustic + electric) | 50 × ~1 min | — | SW 7.80; `bs_keys_xlancer` 7.78 (availability unverified) ([leaderboard](https://de.mvsep.com/quality_checker/leaderboard/piano/?sort=piano)) |

MVSep also sells service-only models with no published SDR (tier 2, [news](https://de.mvsep.com/news), [algorithms](https://mvsep.com/en/algorithms)):
- Plucked Strings (ukulele, banjo, mandolin, dobro, harp, sitar), from 2026-03-21.
- Lead/Rhythm Guitar, from 2026-03-21.
- Acoustic Guitar (2025-09-15) and Electric Guitar (2025-11-19).
- Keys, Synth and Percussion. Percussion lists congas and bongos but not cajón.
- Organ, with SDR 5.08 on an unnamed set.

#### 2.3 Real-mix 7-stem numbers (tier 1 preprint)
ACMID (arXiv, 2025-10) trains SCNet and tests it on real MoisesDB+MedleyDB multitracks. Its Table 3 reports SDR for the following stems ([arXiv:2510.07840](https://arxiv.org/html/2510.07840v1)):

| Training data | Acoustic gtr | Electric gtr | Strings | Wind & brass |
|---|---|---|---|---|
| MoisesDB + MedleyDB | 4.93 | 4.28 | 3.72 | 2.18 |
| + ACMID crawled solo audio | 5.49 | 5.72 | 5.93 | 4.24 |

ACMID's training audio was crawled from YouTube; its licence and audio release are not stated.

#### 2.4 Classical and orchestral separation (tier 1)
- **SynthSOD** (2024): a model trained on SynthSOD scores, on real URMP recordings, violin 1.09, viola 1.23, cello 4.51 and double bass 0.21 dB SDR. The authors write that "none of the models were able to achieve[d] strong separation results even in URMP" ([arXiv:2409.10995](https://arxiv.org/html/2409.10995v1)). This is our column reading of a flattened table: we took violin and cello from the "trained on SynthSOD" column.
- **Small classical ensembles** (WASSPA 2025): 6.2–6.9 dB on synthesised validation sets, but 0.3–0.4 dB on real Bach10/URMP ([arXiv:2505.17823](https://arxiv.org/abs/2505.17823)).
- **Inference:** isolating one bowed or wind instrument inside an ensemble is unsolved. Splitune can only target "the strings" or "the horns" in a band mix.

#### 2.5 Query-based separators (update to `source-separation.md`)
- **Banquet:** reports median full-track SNR, not SDR.
  - Coarse level: guitar 2.2–3.3 and piano 0.8–2.5 dB across configurations, vs htdemucs_6s 2.4 / 1.7.
  - Fine level: acoustic guitar 1.8, clean electric 0.7, distorted electric 2.4 and electric piano 0.6 dB.
  - Long-tail stems (organ, synths, string section, brass, reeds) "are all still very weak" ([arXiv:2406.18747](https://arxiv.org/html/2406.18747)).
  - It is trained on MoisesDB.
- **MuS3D** (arXiv 2026-09-25): a 2.2B DiT-Sep built on SAM-Audio Large. On MoisesDB VDBGP it scores SNR 6.5 dB vs HTDemucs 9.7. It reports no per-stem numbers, and its code will be released "upon acceptance" ([arXiv:2609.30912](https://arxiv.org/html/2609.30912)).
- **SAM Audio:** its README gives subjective scores only (Large: Instr(wild) 3.66, Instr(pro) 4.49) ([repo](https://github.com/facebookresearch/sam-audio)). The SAM License has no non-commercial clause but adds trade-control and no-reverse-engineering terms ([LICENSE](https://github.com/facebookresearch/sam-audio/blob/main/LICENSE)).
- **Inference:** no query-based model has beaten family-specific checkpoints on band mixes yet.

#### 2.6 Monophonic f0 trackers and note segmentation
- **Trackers on instrument data:**
  - On MDB-stem-synth: CREPE RPA 96.7 and PESTO 94.6–95.5 (as reported in the PESTO paper, 2023) ([arXiv:2309.02265](https://arxiv.org/html/2309.02265v3)).
  - SwiftF0's training set includes NSynth and MDB-stem-synth, so instrument audio is in its distribution. Its range is 46.875–2093.75 Hz ([arXiv:2508.18440](https://arxiv.org/html/2508.18440)).
  - The author-run pitch-benchmark (tier 2) gives F1@50c: SwiftF0 0.781, RMVPE 0.768, FCPE 0.728, CREPE 0.689, PESTO 0.680, Basic Pitch 0.557 ([repo](https://github.com/lars76/pitch-benchmark)).
- **Range floors:**
  - SwiftF0 misses double-bass E1 (41.2 Hz) and 5-string-bass B0 (30.9 Hz).
  - Basic Pitch's grid starts at A0 = 27.5 Hz ([constants.py](https://raw.githubusercontent.com/spotify/basic-pitch/main/basic_pitch/constants.py)), and our bass config floor is 30 Hz (`services/ml/config/notes.personal.yaml`).
- **Note segmentation:**
  - **CREPE Notes** (Riley & Dixon, SMC 2023) segments on the pitch-contour gradient times inverse confidence, with madmom onsets for repeated notes. F-measure with no offsets: FiloSax 90%, ITM GT Flute 99 74% (+7 over Basic Pitch), FiloBass 72% (+10). It is GPL-3.0, and its README says madmom's licence "restricts commercial use" ([PyPI](https://pypi.org/pypi/crepe-notes/json)).
  - **FiloBass** confirms these numbers on Demucs-separated double-bass stems, onset-only ±50 ms: Melodyne 78.95, CREPE Notes 72.89, and Basic Pitch 62.73 with precision 51.40 ([arXiv:2311.02023](https://arxiv.org/html/2311.02023)).
- **What we ship:** `notes.vocals` uses Basic Pitch (`services/ml/config/notes.personal.yaml`). No f0 tracker is integrated; RMVPE and SwiftF0 are only researched (`transcription-vocals-melody.md`). The wind path therefore needs a tracker integrated: SwiftF0 is MIT and ONNX, which fits the `onnx-cpu` island. It also needs our own segmentation, reimplementing the CREPE Notes idea without GPL or madmom code.
- **Monophonic trackers fail on chords:** they output one f0 per frame. Violin double stops and harmonica chords need a polyphonic head (Basic Pitch, MUSC/VioPTT), with the f0 curve used only for expression (inference).

#### 2.7 Multi-instrument models (second opinion only)
- **YourMT3+ (YPTF.MoE+M, with pitch shift):**
  - URMP: agnostic onset F1 81.79, multi-instrument F1 67.98.
  - Slakh (synthetic) per-class onset F1: organ 73.48, synth lead 84.19, synth pad 45.57, brass 74.96, reed 82.22, pipe 74.72, strings+ensemble 75.44 ([arXiv:2407.04822](https://arxiv.org/html/2407.04822)).
  - On RWC-Pop, non-main instruments score under 10%.
- **MT3:** URMP 0.770 onset F1, 0.578 with offsets (mixture-trained model). The MT3 authors rate URMP label timing "Fair" and MusicNet's "Poor", so these numbers understate the models ([ar5iv](https://ar5iv.labs.arxiv.org/html/2111.03017)).
- **2025 AMT Challenge:** the test audio is synthetic (FluidR3) for 8 orchestral instruments. MIROS scores 0.5998 and YourMT3-MoE-M 0.5938 multi-instrument onset F1, with no per-instrument breakdown ([arXiv:2603.27528](https://arxiv.org/html/2603.27528)).

#### 2.8 Articulation and expression
| Need | Best evidence | Status |
|---|---|---|
| Vibrato, glissando (strings, winds) | f0 curve; Filosax ships per-note vibrato labels ([site](https://dave-foster.github.io/filosax)) | DSP on the f0 curve (inference) |
| Violin technique | VioPTT: macro accuracy 77.22% on RWC (détaché, spiccato, pizzicato, flageolet) ([arXiv:2509.23759](https://arxiv.org/html/2509.23759v3)) | Research |
| Bow direction | `bowdet` (MIT, single author, no paper) detects bow *changes* (F1 0.635 @100 ms on 6 viola players), not up vs down ([PyPI](https://pypi.org/pypi/bowdet/json), tier 4) | Unsolved |
| Bends (harmonica, sax) | no dataset; our guitar bend detector works on a pitch contour | Reuse (inference) |
| Mandolin tremolo, banjo rolls | no research found | Symbolic post-processing (inference) |
| Breath, tonguing | none found | Out of scope |

### 3. Per-instrument findings
Each entry gives the best separation route, the best transcription route, the datasets, and the S / T / L scores used in the product matrix.

#### 3.1 Ukulele (S 2, T 3, L 3)
- **Separation:**
  - No dedicated public model. Mega 53 reports `ukulele` 6.79 dB, but only on its unnamed set (see §TL;DR caution). MVSep Plucked Strings is service-only with no SDR.
  - **Mix-minus (inference):** with no guitar in the song, ukulele most likely lands in SW `guitar`, so the guitar chain *is* the ukulele stem. With a guitar present the two merge.
  - Test this on the 7 MoisesDB other-plucked songs plus rendered ukulele clips mixed under accompaniment. If it holds, S rises to 3.
- **Transcription:**
  - No model or dataset exists; searches return only guitar sets.
  - Pitch is easy: C4–A5 on soprano and concert. Re-entrant tuning (G4 C4 E4 A4) affects fret assignment, not pitch.
  - Unisons (open G4 vs E-string 3rd fret) collapse to one note, so the fret DP decides by playability.
  - Route: Basic Pitch with our guitar thresholds, or Guitab's pitch output. Guitab's per-string head is 6-string, frets 0–19 ([repo](https://github.com/DanieleMorotti/guitab)), so its string cue cannot be used.
- **Datasets:** none. A rendered set is required: published tabs through sampled ukulele instruments, mixed under real accompaniment. The owner doesn't play, so owner recordings are ruled out (`docs/steps/00-shared-context.md`).

#### 3.2 Acoustic vs electric guitar (S 3, T 4, L 3)
- **Separation:**
  - Real-mix numbers: ACMID acoustic 5.49 / electric 5.72 dB; Banquet fine-level SNR 1.8 / 0.7 / 2.4 (acoustic / clean / distorted).
  - Open: Mega 53 `acoustic-guitar` 5.00 and `electric-guitar` 8.15 dB, on its own set. The per-stem heads are 77.6 MB each on a community mirror (`separation-improvements-2026-11.md` §4).
  - Commercial: Moises shipped it on 2024-04-24 with no metrics ([blog](https://moises.ai/blog/moises-news/new-guitar-separation-models/)), and MVSep offers it hosted. LALAL.AI went the other way and merged acoustic and electric into one "Guitars" stem in 2026-08, claiming fewer failures (same doc, §4).
  - Inference: a two-stage route is best, SW guitar first (our median 11.75 dB) and then a splitter on the guitar stem only, but no one has published it.
  - MoisesDB has the labels to measure it (122 / 113 / 98 songs).
- **Transcription:** the shipped Guitab chain.
  - Held-out onset F1 (`transcription-guitar-and-bass-tabs.md`): about 0.87 on GuitarSet (acoustic) and 0.566 on Guitar-TECHS (amp-miked electric).
  - **GOAT** (ISMIR 2025, research-only on request) adds 29.5 h of amp-rendered electric guitar. It is the evidence-backed fix for electric timbres: the AMP-trained model scores note F1 0.800 on amp audio ([arXiv:2509.22655](https://arxiv.org/html/2509.22655v1)).

#### 3.3 Lead vs rhythm guitar (S 2, T 4, L 2)
- **Separation:**
  - Vendors only: Moises (2024-04-24), Music.AI "Guitar Parts", MVSep Lead/Rhythm (2026-03-21) ([Moises](https://moises.ai/blog/moises-news/new-guitar-separation-models/), [MVSep news 67](https://mvsep.com/news/67?lang=en)).
  - Only MVSep's hosted model reports numbers: two-stage 9.21 and one-stage 9.02 on an undisclosed dataset (`separation-improvements-2026-11.md` §4).
  - No peer-reviewed separation work, no role labels in MoisesDB, and no open checkpoint.
  - Heuristics (inference, genre-dependent):
    - the acoustic/electric or clean/distorted split as a proxy for role;
    - stereo position (panned double-tracked rhythm vs a centred lead), using the MSST phantom-centre model on the guitar stem ([pretrained list](https://raw.githubusercontent.com/ZFTurbo/Music-Source-Separation-Training/main/docs/pretrained_models.md)).
- **Transcription:** the shipped guitar path. A strummed rhythm part is mostly a chords problem, which already exists.

#### 3.4 Extended range: 5/6-string bass (S 4, T 4, L 3); 7/8-string guitar (S 4, T 3, L 3)
- **Separation (own config inspection):**
  - SW uses `n_fft` 2048 at 44.1 kHz (21.5 Hz bins), and its lowest bands are about 43 Hz wide, so it masks down to DC. Low B on bass (30.9 Hz) and F#1 on 8-string guitar (46.2 Hz) are inside its first bands.
  - No evaluation of extended-range instruments exists, and SW's training data is undisclosed.
  - The risk is drop-tuned guitar being routed to bass in the 40–120 Hz overlap (inference). Test it on a few metal tracks.
- **Transcription:**
  - **Bass:** B0 is above our 30 Hz `min_freq_hz` and Basic Pitch's 27.5 Hz floor. Sensitivity at 31–46 Hz on separated stems is untested.
  - **Guitar:** Guitab's string head is 6-string ("standard tuning only", `services/ml/packages/stage_notes/src/stage_notes/guitab.py`), so 7/8-string falls back to Basic Pitch notes plus the fret DP.
  - **Data:** IDMT-SMT-Bass exists (licence unverified, search snippet only). There is no 7/8-string set.

#### 3.5 Banjo (S 2, T 2, L 3) and mandolin (S 2, T 2, L 3)
- **Separation:**
  - MVSep Plucked Strings is service-only with no SDR. Mega 53 reports `banjo` 3.16 and `mandolin` 4.43 dB on its own set.
  - In bluegrass, banjo, mandolin, guitar and dobro all play together, so SW `guitar` would hold every plucked part (inference).
- **Transcription:**
  - No dataset, model or paper for either.
  - **Banjo:** rolls are fast 8-note cycles with ringing strings. Onsets are plausible with Basic Pitch; offsets are meaningless. The short 5th string needs a fret-DP special case.
  - **Mandolin:** tremolo picking produces 10–20 onsets per second on one pitch. That needs a merge rule (fast same-pitch onsets → one tremolo note); one J-STAGE acoustics paper models tremolo irregularity (search snippet only).

#### 3.6 Keys: synth, organ, electric piano (S 3, T 3, L 3)
- **Separation:**
  - Own evidence: on 3 MoisesDB windows whose "piano" target is mostly `other_keys`, SW outputs −76 to −91 dB in piano and routes the keys to `other` (`services/ml/eval/results/sep-robust/2026-11-07-moisesdb.md`).
  - Mega 53 reports `keys` 9.30, `organ` 10.37 and `synth` 2.05 dB on its own set; MVSep Organ is service-only (5.08 dB).
  - Peer-reviewed: Banquet electric piano 0.6 dB SNR; organ and synth are "very weak".
  - Mix-minus: SW `other` (or `piano` + `other`) as the keys stem when there are no strings, winds or FX. MoisesDB can measure this directly (110 + 35 songs).
  - Routing fix: `separation-improvements-2026-11.md` §5 proposes running the Mega-53 organ/keys heads and the X-LANCE synth chain when SW's piano output is silent and the tagger hears keys. A keys instrument would reuse that route.
- **Transcription:**
  - Synthetic numbers only: YourMT3+ on Slakh gives organ 73.48, synth lead 84.19 and synth pad 45.57.
  - No evaluation of MAESTRO-trained piano models (Transkun) on Rhodes, organ or synths was found.
  - Inference:
    - **Organ:** no hammer transient and no decay, so expect missed onsets and fragmented notes from piano models. Use Basic Pitch or YourMT3+.
    - **Electric piano:** a struck, decaying envelope, so Transkun is plausible there; A/B it.
    - **Mono synth leads:** the f0 path.

#### 3.7 Violin and fiddle (S 2, T 4, L 2)
- **Separation:**
  - MVSep Strings 5.42 dB (service only). The open `gilliaan` v2 scores 4.69 dB (CC BY-NC-SA 4.0, training data not stated). ACMID strings: 5.93 dB.
  - No model or label separates solo violin from a section, and real URMP separation is about 1 dB (§2.4).
  - Mix-minus: SW `other` ≈ the violin when it is the only instrument beyond guitar, bass, drums and vocals (folk/pop fiddle; inference).
- **Transcription** (violin tracks; F1 with offsets / onset-only), from [arXiv:2508.13516](https://arxiv.org/html/2508.13516v2):

  | Model | URMP | Bach10 |
  |---|---|---|
  | MUSC (ISMIR 2023; AGPL-3.0 code; weights not mentioned) ([repo](https://github.com/MTG/violin-transcription)) | 84.6 / 93.0 | 64.8 / 77.0 |
  | Kong CRNN from scratch on MOSA, with augmentation | 84.5 / 93.1 | 69.9 / 79.5 |
  | MAESTRO-pretrained, fine-tuned on MOSA, no augmentation | — | 71.5 / 80.2 |

  - VioPTT (arXiv, v3 2026-02) reports the same Bach10 row and adds a technique head (77.22% macro accuracy) ([arXiv:2509.23759](https://arxiv.org/html/2509.23759v3)). The paper states no licence; the GitHub repo is Apache-2.0. Whether its `checkpoints/` folder holds weights is unverified, and any weights would be trained on MOSA (restricted) ([repo](https://github.com/y10ab1/VioPTT)).
  - No published numbers for Basic Pitch or MT3 on these sets. Double stops are untested; both heads output 88 pitches per frame.
- **Datasets:**
  - MOSA: restricted access on request (search snippet only).
  - Violin Etudes: restricted, "non-profit and academic research purposes" ([Zenodo](https://zenodo.org/records/6564408)).
  - URMP: Google-form download, no licence on the page ([site](https://labsites.rochester.edu/air/projects/URMP.html)).

#### 3.8 Viola, cello, double bass (S 2, T 3, L 2)
- **Separation:**
  - As for violin. Mega 53 reports `cello` 5.04 and `double-bass` 14.17 dB on its own set, which conflicts with its strings stems scoring about 0 dB on the public set.
  - Jazz double bass most likely already lands in SW `bass` (inference). MoisesDB has 9 contrabass songs.
- **Transcription:**
  - No viola or cello specialist; violin models need range and timbre transfer.
  - Double bass is best evidenced: on FiloBass, f0 plus segmentation is about 10 points ahead of Basic Pitch (§2.6). FiloBass's Zenodo record is CC-BY-4.0 but holds only the paper; the backing tracks must be bought ([Zenodo](https://zenodo.org/records/10265335)).
  - PHENICX-Anechoic (CC-BY-NC-SA-4.0) has cello notes ([mirdata](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html)).

#### 3.9 Saxophone (S 3, T 4, L 3)
- **Separation:**
  - Family stem: MVSep Wind 9.82 dB (service); the open Mega wind stem scores 8.63 dB on the same public set.
  - Per instrument: Mega 53 `saxophone` 8.89 dB on its own set; the MVSep saxophone service model reports 9.77 on an unnamed set.
  - MoisesDB has 9 reed songs, too few to evaluate on.
  - Mix-minus: SW `other` when a sax or horn section is the only extra instrument (soul, funk, jazz-pop; inference).
  - **VRAM:** the full Mega needs ≥16 GB recommended. A per-stem wind or saxophone head (if mirrored like the guitar and keys heads; unverified) would avoid that.
- **Transcription:**
  - CREPE Notes: 90% onset-only F on FiloSax (solo, unseparated).
  - YourMT3+ on Slakh "reed" (synthetic): 82.22.
- **Datasets:**
  - Filosax: 24 h, 5 tenor players. NC research only, no redistribution; backing tracks must be bought ([site](https://dave-foster.github.io/filosax)).
  - Weimar Jazz Database: 456 monophonic solos, with the audio as commercial recordings linked externally ([content](https://jazzomat.hfm-weimar.de/dbformat/dbcontent.html)). Its ODbL licence comes from a third-party page (search snippet only).
  - **ChoraleBricks** (TISMIR 2025): 13 wind instruments, 193 tracks, 2 h 10 min, with corrected f0 and note events; CC-BY-4.0 ([TISMIR](https://transactions.ismir.net/articles/10.5334/tismir.252)). It is the clean evaluation set for the whole wind family.

#### 3.10 Flute, trumpet, clarinet, trombone (S 2, T 3, L 3)
- **Separation:** Mega 53 on its own set: flute 6.21, trumpet 4.97, clarinet 5.05 and trombone 2.69 dB. On real URMP (SynthSOD-trained), all are ≤1 dB.
- **Transcription:** monophonic, so the f0 path fits.
  - CREPE Notes scores 74% on Irish flute.
  - YourMT3+ on Slakh gives brass 74.96 and pipe 74.72 (synthetic).
  - No benchmark on real brass audio was found.
  - ClarinetNet (Leiden thesis) reports single-instrument F1 0.60–0.67 (search snippet only).

#### 3.11 Harmonica (S 2, T 2, L 3)
- **Separation:**
  - Harmonica is listed inside the MVSep Wind service. Mega 53 reports `harmonica` 10.93 dB on its own set (unverified given the strings contradiction).
  - It has no MoisesDB label.
  - Where SW puts it is unknown. `vocals` is plausible for a reedy, voice-like timbre, and `other` in a blues trio (inference; test it).
- **Transcription:**
  - One paper: Lins, Johann, Benetos & Schramm, ICASSP 2019, PLCA with harmonica layout constraints on its own small solo dataset (search snippet only) ([QMUL record](https://qmro.qmul.ac.uk/xmlui/handle/123456789/56489)).
  - No deep-learning model. Chords need a polyphonic head; bends come from the contour.
  - The hole/blow/draw mapping is deterministic for a Richter harp in a known key (inference).

#### 3.12 Hand percussion: cajón, congas (S 2, T 2 / 1, L 3)
- **Separation:**
  - MVSep Percussion (service) lists congas and bongos but not cajón; Mega 53 reports `congas` 9.17 dB on its own set.
  - Inference: a cajón acts as a kick/snare substitute and probably lands in SW `drums`, so in a cajón-plus-guitar track the drum stem is the cajón.
- **Transcription:**
  - No public cajón or conga stroke dataset.
  - Cajón bass and slap strokes may map to ADTOF's BD/SD (untested).
  - Conga open/slap/mute/bass strokes per drum have no model. A NIME 2015 contact-mic stroke classifier exists (search snippet only).
  - Few-shot drum transcription is the method family to try.

#### 3.13 Lead vs backing (harmony) vocals (S 3, T 2, L 3)
- **Separation:**
  - Best: 11.08 lead / 7.14 back (§2.2).
  - The open becruily checkpoint, run on our vocals stem, scores 8.88 / 4.73. Its Hugging Face repo has no licence and no model card ([HF API](https://huggingface.co/api/models/becruily/mel-band-roformer-karaoke)).
  - Mix-minus fits naturally: lead from a karaoke model, then backing = vocals − lead using the existing `subtract` mode. One MVSep comparison found a karaoke model scored *lower* run on extracted vocals than on the mixture (9.67 → 9.36), so test both inputs (`separation-improvements-2026-11.md` §1).
  - MoisesDB background vocals (127 songs) make this measurable.
  - Backing at about 4.7 dB is rough; lead at about 8.9 dB is good.
- **Transcription:**
  - Only a cappella results exist. Cuesta & Gómez (TISMIR 2022) report multi-pitch F 0.85 before voice assignment and 0.75–0.77 after. Per-voice F with D-VoasCNN is S 0.73, A 0.56, T 0.56, B 0.71 ([TISMIR](https://transactions.ismir.net/articles/121)).
  - Nothing evaluates harmony transcription under a lead vocal and a band.
  - Dagstuhl ChoirSet is CC-BY-4.0 ([Zenodo](https://zenodo.org/record/4608395)).

#### 3.14 Drum-kit pieces (S 4, T 3, L 3)
- **Separation:**
  - Route: SW `drums` → DrumSep. "All models work only with the drum track" ([MVSep algorithm 29](https://de.mvsep.com/algorithms/29)).
  - Numbers are in §2.2. Hi-hat alone is 3.6–4.7 dB on the 5-stem models.
  - **LarsNet** (StemGMD Eval, nSDR): kick 27.19, snare 21.77, toms 9.10, hi-hat 6.43, cymbals 4.09. Its weights are CC BY-NC 4.0; StemGMD is CC-BY-4.0 and 1.13 TB ([arXiv:2312.09663](https://arxiv.org/html/2312.09663v1), [repo](https://github.com/polimi-ispl/larsnet)).
  - Our register already holds `mdx23c-drumsep`, the 6-stem aufr33 + jarredou model (red tier). Step 25 could not load it because of the PC's rule on code from external sources (`services/ml/eval/results/p2d/2026-10-28-phases.md`).
  - `separation-improvements-2026-11.md` §2 ranks the 5-stem MDX23C (+0.3 to +2.1 dB per piece, but it loses the ride/crash split) as the better candidate.
  - Mix-minus: `drums − piece` gives "drums minus snare" practice tracks directly.
- **Transcription:**
  - The shipped ADTOF (5 classes) already gives per-piece hits.
  - Riley & Dixon reach 7 classes via DrumSep: global F 0.84 on MDB vs 0.72 for an 8-class baseline ([arXiv:2509.24853](https://arxiv.org/html/2509.24853)).
  - STAR Drums at 18 classes: 0.67 / 0.66 / 0.50 on MDB / ENST / RBMA, with no weights released ([TISMIR](https://transactions.ismir.net/articles/10.5334/tismir.244)).

#### 3.15 Regional instruments (not scored)
No separation or transcription work for guzheng, erhu, sitar or đàn bầu was looked for in depth, because the demand evidence is too thin (`research/product/additional-instruments.md` §2.6). One related fact: MVSep's Plucked Strings service lists sitar.

### 4. New datasets and licences (add to `datasets-metrics-and-licensing.md` when it is next revised)
| Dataset | Content | Licence (as stated) | Commercial use |
|---|---|---|---|
| ChoraleBricks | 13 winds, 193 tracks, 2 h 10 min, f0 + notes | CC-BY-4.0 ([TISMIR](https://transactions.ismir.net/articles/10.5334/tismir.252)) | Yes |
| Dagstuhl ChoirSet | choir multitracks, f0 | CC-BY-4.0 ([Zenodo](https://zenodo.org/record/4608395)) | Yes |
| FiloBass | 48 jazz double-bass tracks, notes | Zenodo record CC-BY-4.0 (paper only); "freely available to researchers"; backing audio must be bought | Unclear |
| Filosax | 24 h tenor sax, notes, vibrato | NC research, no redistribution ([site](https://dave-foster.github.io/filosax)) | No |
| Violin Etudes | 27.8 h, automatic f0 labels | restricted, non-profit/academic ([Zenodo](https://zenodo.org/records/6564408)) | No |
| MOSA | >30 h violin and piano with mocap | restricted (search snippet only) | No |
| URMP | 44 chamber pieces, notes | none on the page; form download ([site](https://labsites.rochester.edu/air/projects/URMP.html)) | Unclear |
| MDB-stem-synth | 230 resynthesised stems | CC-BY-NC-4.0 ([mirdata](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html)) | No |
| StemGMD | 1.13 TB drum stems | CC-BY-4.0 ([Zenodo](https://zenodo.org/records/7860223)) | Yes |
| GOAT | 35 h electric guitar, DI + amp renders | research only, on request ([arXiv](https://arxiv.org/html/2509.22655v1)) | No |

### 5. Corrections to the 2026-10-20 docs
1. **`transcription-general.md` §7 (replaced by this doc):**
   - The claim that MT3/YourMT3+ cover violin and winds is out of date: violin specialists exist (§3.7).
   - MT3's URMP figure of 0.58 with offsets is a mixture-model, all-instrument figure on labels whose timing the MT3 authors themselves rate as "Fair".
   - "Ukulele: no dedicated model or dataset" still holds.
2. **`source-separation.md`:**
   - **Banquet:** it reports SNR, and it only beats htdemucs_6s in some configurations (§2.5).
   - **Oracle IRM is not an upper bound for learned models:** htdemucs_6s beats it on bass (11.93 vs 7.92) and drums (11.02 vs 9.19) in the same MoisesDB table.
   - **SW's guitar 9.05 / piano 7.83** come from MVSep's separate Guitar (30 tracks) and Piano (50 tracks) sets, not Multisong. On those sets "Logic Pro 11.2 Stem Splitter" scores almost the same (9.0020 / 7.7889). This fits the provenance dispute in MSST issue #248 but does not prove it.
   - **New since the previous pass:** an open checkpoint now exists for strings, wind and plucked instruments (Mega 53, MSST v1.0.21), alongside MVSep service models.
3. **DrumSep numbers in `source-separation-model-comparison.md`:** "kick 16.66 / snare 11.53" belongs to the 5-stem MDX23C model on MVSep's leaderboard. Mel-RoFormer and BS-RoFormer DrumSep models now lead (§2.2).
4. **`transcription-vocals-melody.md`:**
   - SwiftF0's training set includes instrument audio (NSynth, MDB-stem-synth).
   - Its 46.9 Hz floor excludes double-bass E1 and 5-string-bass B0.

## Implications for Splitune
- **New instruments are mostly a separation problem.**
  - Before building any new family, measure SW's existing stems as mix-minus proxies on MoisesDB:
    - `other` for keys;
    - `guitar` for the 7 other-plucked songs;
    - `drums` → DrumSep for drum pieces;
    - vocals → karaoke for backing vocals.
  - Each measurement is cheap, and it decides whether a family needs a new model at all.
- **Cheapest additions with evidence:** drum-kit pieces (DrumSep on the drums stem plus ADTOF classes), lead/backing vocal stems, and 5/6-string bass (config only).
- **Winds need a new transcription path.** The proven route is an f0 tracker plus our own segmentation. That means integrating SwiftF0 (MIT, ONNX) and writing a CREPE-Notes-style segmenter. Evaluate it on ChoraleBricks (CC-BY) mixed under accompaniment and on separated stems.
- **Strings depend on the strings-stem gate.** Violin transcription is good enough, but on band mixes the best open strings stem is about 4.7 dB on a family stem. Gate violin on measuring the strings stem first.
- **Folk plucked instruments, harmonica and hand percussion have no public data.** Any work there starts with a labelled set built from published tabs or scores and rendered audio, since the owner doesn't play.
- **VRAM:** the full Mega 53 exceeds the recommended VRAM of our card. Prefer its 77.6 MB per-stem heads (community mirror) or family-specific checkpoints (gilliaan strings, 303 MB), and confirm each runs on the RTX 3060.

## Open questions
- **Ukulele and banjo stems:** does ukulele- or banjo-only material land cleanly in SW `guitar`? Test on the 7 MoisesDB other-plucked songs plus 10 rendered clips.
- **Keys proxy:** what uSDR does SW `other` reach as a keys stem on the 110 MoisesDB other-keys songs? Does Transkun transfer to electric piano?
- **Mega 53 heads:** do its per-stem heads for wind, strings and keys exist and run alone on the RTX 3060, and how do they score on MoisesDB windows?
- **Lead/backing chain:** what lead/backing uSDR does karaoke-on-our-vocals-stem reach on the 127 MoisesDB background-vocal songs?
- **VioPTT weights:** does the repo actually ship weights, and under what licence?
- **Bass floor:** how sensitive is Basic Pitch at 31–46 Hz (5-string low B) on separated stems?
- **Harmonica routing:** where does SW route harmonica: `vocals`, `other` or `guitar`?

## Sources
- [MoisesDB paper PDF (arXiv:2307.15913)](https://arxiv.org/pdf/2307.15913) — tier 1, accessed 2026-11-07
- [MoisesDB paper HTML (arXiv:2307.15913)](https://arxiv.org/html/2307.15913) — tier 1, accessed 2026-11-07
- [Banquet paper HTML (arXiv:2406.18747)](https://arxiv.org/html/2406.18747) — tier 1, accessed 2026-11-07
- [MSST release v1.0.21 (GitHub API)](https://api.github.com/repos/ZFTurbo/Music-Source-Separation-Training/releases/tags/v1.0.21) — tier 1, accessed 2026-11-07
- [MSST pretrained_models.md (raw)](https://raw.githubusercontent.com/ZFTurbo/Music-Source-Separation-Training/main/docs/pretrained_models.md) — tier 2, accessed 2026-11-07
- [MVSep Mega 53-stem model (algorithm 135)](https://de.mvsep.com/algorithms/135) — tier 2, accessed 2026-11-07
- [MVSep DrumSep (algorithm 29)](https://de.mvsep.com/algorithms/29) — tier 2, accessed 2026-11-07
- [MVSep algorithms list](https://mvsep.com/en/algorithms) — tier 2, accessed 2026-11-07
- [MVSep news index](https://de.mvsep.com/news) — tier 2, accessed 2026-11-07
- [MVSep news 67 (2026-03-21)](https://mvsep.com/news/67?lang=en) — tier 2, accessed 2026-11-07
- [MVSep custom leaderboards (dataset descriptions)](https://de.mvsep.com/quality_checker/custom_leaderboards) — tier 2, accessed 2026-11-07
- [MVSep Strings leaderboard](https://de.mvsep.com/quality_checker/leaderboard/strings/?sort=strings) — tier 2, accessed 2026-11-07
- [MVSep Strings leaderboard p.2](https://de.mvsep.com/quality_checker/leaderboard/strings/?sort=strings&page=2) — tier 2, accessed 2026-11-07
- [MVSep Wind leaderboard](https://de.mvsep.com/quality_checker/leaderboard/wind/?sort=wind) — tier 2, accessed 2026-11-07
- [MVSep Guitar leaderboard](https://de.mvsep.com/quality_checker/leaderboard/guitar/?sort=guitar) — tier 2, accessed 2026-11-07
- [MVSep Piano leaderboard](https://de.mvsep.com/quality_checker/leaderboard/piano/?sort=piano) — tier 2, accessed 2026-11-07
- [MVSep Lead/Back Vocals leaderboard p.2](https://de.mvsep.com/quality_checker/leaderboard/lead_back_vocals/?sort=back&page=2) — tier 2, accessed 2026-11-07
- [MVSep DrumSep 5-stem leaderboard](https://de.mvsep.com/quality_checker/leaderboard/drumsep5/?sort=kick) — tier 2, accessed 2026-11-07
- [gilliaan/Stem-Separation-Models (Hugging Face)](https://huggingface.co/gilliaan/Stem-Separation-Models) — tier 2, accessed 2026-11-07
- [becruily/mel-band-roformer-karaoke (Hugging Face API)](https://huggingface.co/api/models/becruily/mel-band-roformer-karaoke) — tier 2, accessed 2026-11-07
- [ACMID (arXiv:2510.07840)](https://arxiv.org/html/2510.07840v1) — tier 1, accessed 2026-11-07
- [SynthSOD (arXiv:2409.10995)](https://arxiv.org/html/2409.10995v1) — tier 1, accessed 2026-11-07
- [Source Separation of Small Classical Ensembles (arXiv:2505.17823)](https://arxiv.org/abs/2505.17823) — tier 1, accessed 2026-11-07
- [MuS3D (arXiv:2609.30912)](https://arxiv.org/html/2609.30912) — tier 1, accessed 2026-11-07
- [SAM Audio repo README](https://github.com/facebookresearch/sam-audio) — tier 1, accessed 2026-11-07
- [SAM License](https://github.com/facebookresearch/sam-audio/blob/main/LICENSE) — tier 1, accessed 2026-11-07
- [Moises blog: new guitar separation models (2024-04-24)](https://moises.ai/blog/moises-news/new-guitar-separation-models/) — tier 2, accessed 2026-11-07
- [LarsNet / Toward Deep Drum Source Separation (arXiv:2312.09663)](https://arxiv.org/html/2312.09663v1) — tier 1, accessed 2026-11-07
- [polimi-ispl/larsnet](https://github.com/polimi-ispl/larsnet) — tier 1, accessed 2026-11-07
- [StemGMD (Zenodo 7860223)](https://zenodo.org/records/7860223) — tier 1, accessed 2026-11-07
- [Riley & Dixon, ADT via drum stem separation (arXiv:2509.24853)](https://arxiv.org/html/2509.24853) — tier 1, accessed 2026-11-07
- [STAR Drums (TISMIR 2025)](https://transactions.ismir.net/articles/10.5334/tismir.244) — tier 1, accessed 2026-11-07
- [Chang et al., YourMT3+ (arXiv HTML)](https://arxiv.org/html/2407.04822) — tier 1, accessed 2026-11-07
- [Results from the 2025 AMT Challenge (arXiv HTML)](https://arxiv.org/html/2603.27528) — tier 1, accessed 2026-11-07
- [Gardner et al., MT3 (ar5iv HTML)](https://ar5iv.labs.arxiv.org/html/2111.03017) — tier 1, accessed 2026-11-07
- [PESTO (arXiv HTML v3)](https://arxiv.org/html/2309.02265v3) — tier 1, accessed 2026-11-07
- [SwiftF0 (arXiv HTML)](https://arxiv.org/html/2508.18440) — tier 1, accessed 2026-11-07
- [lars76/pitch-benchmark](https://github.com/lars76/pitch-benchmark) — tier 2, accessed 2026-11-07
- [Basic Pitch constants.py](https://raw.githubusercontent.com/spotify/basic-pitch/main/basic_pitch/constants.py) — tier 1, accessed 2026-11-07
- [crepe-notes (PyPI JSON)](https://pypi.org/pypi/crepe-notes/json) — tier 2, accessed 2026-11-07
- [FiloBass (arXiv HTML)](https://arxiv.org/html/2311.02023) — tier 1, accessed 2026-11-07
- [FiloBass (Zenodo 10265335)](https://zenodo.org/records/10265335) — tier 1, accessed 2026-11-07
- [Filosax project site](https://dave-foster.github.io/filosax) — tier 1, accessed 2026-11-07
- [Weimar Jazz Database content](https://jazzomat.hfm-weimar.de/dbformat/dbcontent.html) — tier 1, accessed 2026-11-07
- [ChoraleBricks (TISMIR)](https://transactions.ismir.net/articles/10.5334/tismir.252) — tier 1, accessed 2026-11-07
- [Is Transfer Learning Necessary for Violin Transcription? (arXiv:2508.13516v2)](https://arxiv.org/html/2508.13516v2) — tier 1, accessed 2026-11-07
- [MTG/violin-transcription (MUSC)](https://github.com/MTG/violin-transcription) — tier 1, accessed 2026-11-07
- [VioPTT (arXiv:2509.23759v3)](https://arxiv.org/html/2509.23759v3) — tier 1, accessed 2026-11-07
- [y10ab1/VioPTT](https://github.com/y10ab1/VioPTT) — tier 1, accessed 2026-11-07
- [Violin Etudes (Zenodo 6564408)](https://zenodo.org/records/6564408) — tier 1, accessed 2026-11-07
- [URMP project page](https://labsites.rochester.edu/air/projects/URMP.html) — tier 1, accessed 2026-11-07
- [mirdata quick reference (licences)](https://mirdata.readthedocs.io/en/stable/source/quick_reference.html) — tier 2, accessed 2026-11-07
- [Cuesta & Gómez, Voice Assignment in Vocal Quartets (TISMIR 2022)](https://transactions.ismir.net/articles/121) — tier 1, accessed 2026-11-07
- [Dagstuhl ChoirSet (Zenodo 4608395)](https://zenodo.org/record/4608395) — tier 1, accessed 2026-11-07
- [GOAT (arXiv:2509.22655)](https://arxiv.org/html/2509.22655v1) — tier 1, accessed 2026-11-07
- [DanieleMorotti/guitab](https://github.com/DanieleMorotti/guitab) — tier 1, accessed 2026-11-07
- [bowdet (PyPI JSON)](https://pypi.org/pypi/bowdet/json) — tier 4, accessed 2026-11-07
- [Lins et al., Automatic Transcription of Diatonic Harmonica Recordings (QMUL record; not opened, search snippet only)](https://qmro.qmul.ac.uk/xmlui/handle/123456789/56489) — tier 1, accessed 2026-11-07
- Own: `services/ml/eval/results/sep-robust/2026-11-07-moisesdb.md`, `services/ml/eval/results/p2d/2026-10-28-phases.md`, `services/ml/config/*.personal.yaml`, `compliance/register/models/` — own measurement and config, accessed 2026-11-07
