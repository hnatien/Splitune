---
title: Additional instruments — scored matrix, ranking and recommended next additions
workstream: product
last_researched: 2026-11-07
confidence: medium
---

# Additional instruments: what to add next

The question is which instruments, or variants of instruments we already support, Splitune should add after guitar, bass, piano, drums and vocals, and in what order. This doc scores 18 candidates on 7 criteria, ranks them and gives a minimum viable path (MVP) for the top three. The ML evidence behind the separation, transcription and licence scores is in `research/ml/other-instruments-feasibility.md`. Confidence is medium overall. It is low for the demand numbers of niche instruments, where the evidence is community size rather than learner surveys.

## TL;DR
- **Recommended order:**
  1. **Ukulele**, with 5/6-string bass and 7-string guitar added in the same step.
  2. **Drum-kit pieces** (practise one piece: kick, snare, toms, cymbals).
  3. **Saxophone** as the first wind instrument.
  4. **Acoustic/electric guitar split**, gated on a measurement.
  5. **Violin/fiddle**, gated on a strings-stem measurement.
- **Why that order:**
  - Ukulele scores highest (3.45 of 5). It is the only new learner group in the top three, and it mostly reuses the guitar route.
  - Drum-kit pieces (3.35) extend a shipped instrument with a separator that runs on our drums stem. A downloadable one scores 11.5–16.7 dB on kick, snare and toms; the best leaderboard entry reaches 18.7.
  - 5/6-string bass (3.25) is config-level work that shares ukulele's stringed-instrument changes.
  - Saxophone ties with bass (3.25) and builds the staff-notation and transposition pieces every later wind and string instrument needs.
- **Feasibility weighted twice** (separation, transcription and reuse doubled): the top five become 5/6-string bass, drum-kit pieces, ukulele, saxophone and the acoustic/electric split. The recommendation holds. Violin drops from 6th to 9th because separation and reuse are its weak points.
- **Recommend against for now:**
  - hand percussion (lowest score under both weightings; no data, small demand);
  - harmonica (the largest gap, but no separation evidence, no data and a custom tab view);
  - lead/rhythm guitar separation (Songsterr AI ships it; no open model or labels);
  - banjo and mandolin (no data; they merge into the guitar stem);
  - 8-string guitar (contract caps; tiny demand);
  - regional instruments (demand evidence too thin to score).
- **The competitive picture has moved.** "Bring any song → my part → notation" now exists for strings, winds, keys, extended-range guitar and bass, and lead/rhythm guitar:
  - Songsterr AI writes tabs from any song for lead/rhythm guitar, keys/synth, strings and winds ([help](https://www.songsterr.com/help)).
  - Klangio Violin2Notes and Wind2Notes take YouTube links ([violin](https://klang.io/violin2notes/), [wind](https://klang.io/wind2notes/)).
  - Songscription, a competitor not yet in our docs, extracts one instrument from a full mix ([site](https://www.songscription.ai/)).

  For those instruments Splitune competes on practice integration, not on capability. The truly empty cells are melody/tab from any song for ukulele, banjo, mandolin and harmonica, and harmony lines as notes.
- **The scores are close.** Totals span 2.25–3.45, and differences under about 0.15 are within scoring noise. The order rests as much on shared work and measurement gates as on the totals.

## Findings

### 1. Method
- **Criteria (each scored 1–5, higher = better for Splitune):**

  | Code | Criterion | 5 means | 1 means |
  |---|---|---|---|
  | D | Learner demand | top-3 learner instrument in surveys | no evidence of a learner base |
  | G | Competitive gap | no product isolates and transcribes it from any song | a competitor ships the full flow |
  | S | Separation feasibility | a shipped stem already isolates it | nothing exists |
  | T | Transcription feasibility | shipped | nothing plausible |
  | N | Notation and pedagogy fit | learners read views we already render | no standard notation |
  | R | Pipeline reuse and effort | config only (S) | needs new research |
  | L | Licences (recorded, not gating in personal mode) | code, weights and data all permissive | no usable artefact |

- **Intermediate anchors:**
  - D: 4 = top-10 in two independent datasets or a very large, growing base. 3 = sizeable in one dataset or a large community. 2 = a niche but dedicated community (about 25–100K online members).
  - G: 4 = only chords or stems exist. 3 = transcription from any song exists but no practice integration. 2 = isolate + transcribe exist with some practice tools.
  - N: 4 = alphaTab renders it but we need a new export or view. 3 = needs a custom convention.
  - R: 4 = no new model, new code in existing modules. 3 = one new model or one new notation module. 2 = new separator + new transcriber + new export.
  - S, T and L anchors are in `research/ml/other-instruments-feasibility.md` §1.
- **Weights:** D 25%, G 15%, S 15%, T 15%, N 10%, R 15%, L 5%.
  - Demand leads because the product owner asked which instruments are *worth* adding.
  - L is low because personal mode does not gate on licences (`specs/25-personal-mode.md`).
  - The sensitivity run doubles S, T and R (feasibility) and renormalises.
- **Evidence vs inference:** each score in §3 points to its evidence; "inference" marks judgement. Demand scores for niche instruments rest on tier-4 community counts and are the least certain numbers in this doc.
- **Process:** four parallel research briefs covered demand and market, separation, transcription, and notation and pedagogy. Their key numbers were spot-checked against the primary pages on 2026-11-07. One corrected claim: Moises' kick/snare stems are on the Pro plan, not Premium.

### 2. Evidence by criterion

#### 2.1 Learner demand
- **UK children, ABRSM Making Music 2014** (5–17 years, base 1,470, Fig 28): keyboard 30%, piano 28%, recorder 28%, classical guitar 20%, drum kit 14%, electric guitar 13%, violin 12%, flute 7%, percussion 6%, bass guitar 5% ([PDF](https://www.youthmusic.org.uk/sites/default/files/2014_Making_Music_web_version_0.pdf)). The chart labels for electric guitar and violin are adjacent in the text layer; the report says "as many young learners now play electric guitar as play the violin".
- **ABRSM 2025 follow-up (as reported):** flute rose to 15% of children, "up from just 7 per cent in 2014", and electric guitar to 17% ([Independent via AOL, 2025-04-29](https://www.aol.com/fewer-children-ever-learning-recorder-232418356.html)). We could not open the report itself.
- **German public music schools, 2021** (VdM via MIZ): piano about 160,000 pupils, guitar about 117,500, violin 64,000, flute about 34,250, mandolin 584 ([MIZ](https://miz.org/en/statistics/pupils-enrolled-at-public-music-schools-by-subject)).
- **The two national datasets agree:**
  - Violin is the third melodic instrument after keyboard/piano and guitar.
  - Flute is the largest wind instrument.
  - Ukulele, harmonica, banjo and saxophone are absent from both learner lists (ABRSM's top ten; the MIZ instruments quoted). ABRSM's list of instruments taught by teachers includes saxophone at 14%.
- **US guitar:** about 16 million Americans started guitar in the two years to 2021, per Fender with YouGov ([Guitar.com](https://guitar.com/news/industry-news/fender-16-million-americans-picked-up-guitar-over-the-last-two-years/)). Sources disagree on the age band, and Fender's newsroom was not reachable. No Fender ukulele share was found.
- **Ukulele sales:**
  - US imports were 632,119 units in the first nine months of 2011, 19% of guitar imports by units ([Fretboard Journal](https://www.fretboardjournal.com/columns/just-how-many-ukuleles/index.php)).
  - "More than 1.7 million" units were sold in 2021, per Statista citing Music Trades. We saw this only in a search snippet; the page itself is paywalled ([Statista](https://www.statista.com/statistics/448450/number-of-ukuleles-sold-in-the-us/)).
  - MMR (2022) names online videos and cover songs as the main drivers ([MMR](https://mmrmagazine.com/big-sales-come-in-small-packages-the-ukulele-market-stays-strong-in-2022)).
- **Online communities** (GummySearch, about 2026-11-05; tier 4; community size, not learner counts) ([example](https://gummysearch.com/r/ukulele/)):

  | Community | Members | Community | Members |
  |---|---|---|---|
  | r/Guitar | 3.5M | r/trumpet | 58K |
  | r/singing | 1.4M | r/harmonica | 50K |
  | r/piano | 1.3M | r/Cello | 42K |
  | r/synthesizers | 488K | r/Clarinet | 36K |
  | r/drums | 329K | r/Flute | 33K |
  | r/violinist | 109K | r/Trombone | 32K |
  | r/ukulele | 104K | r/mandolin | 28K |
  | r/banjo | 69K | r/doublebass | 21K |
  | r/saxophone | 62K | r/cajon, r/Erhu | about 2K each |

- **App-store signals (US):**
  - Ukulele by Yousician: 12K ratings ([App Store](https://apps.apple.com/us/app/id1585618286)).
  - Trala (violin): 4.9K ratings at $119.99 a year ([App Store](https://apps.apple.com/us/app/id1143205265)).
  - Tonestro's saxophone app: 1.1K ratings ([App Store](https://apps.apple.com/us/app/-/id1447013289)).
  - Tunefox (banjo/mandolin): 859 ratings ([App Store](https://apps.apple.com/us/app/tunefox/id1128824483)).

#### 2.2 How these learners learn (does "play along with the recording" fit?)
- **Pop and rock:** "by far the overriding learning practice for popular musicians … is to copy recordings by ear" ([Green 2010](https://seer.unirio.br/simpom/article/download/2657/1990/13063)). This applies to guitar, bass, keys, drums, ukulele and band vocals.
- **Celtic and bluegrass:** adult learners "most valued learning 'by ear'", and one banjo learner's method was a slow-down tool plus phrase chopping ([Waldron 2009, MERI](https://usf.edu/arts/music/documents/meri-archives/979-meri-03pp57-71.pdf)). That is Splitune's loop and slow-down workflow.
- **Jazz sax and trumpet:** solo transcription by ear follows the same steps: sing it, one phrase at a time, slow it down, loop it ([LearnJazzStandards, tier 4](https://www.learnjazzstandards.com/blog/learning-jazz/how-to-learn/)).
- **Suzuki strings:** daily listening to reference recordings ([SAA](https://suzukiassociation.org/journalarticle/creating-the-suzuki-environment/)).
- **Formal channels dominate strings and winds:** ABRSM 2014 lesson-taking is 91% for child string players, 85% brass and 81% woodwind ([PDF](https://www.youthmusic.org.uk/sites/default/files/2014_Making_Music_web_version_0.pdf), Fig 30). Inference: the "bring any song" fit for violin and winds is strongest in the fiddle, jazz and pop segments, not in the school-band majority.
- **Harmonica:** tab conventions leave rhythm "not written", which assumes the learner already knows the song from the recording ([Harmonica.com](https://harmonica.com/how-to-read-harmonica-tabs)). Inference: tab plus recording plus loop fits unusually well.

#### 2.3 Competitive coverage
| Candidate | Isolates the stem from any song | Transcribes it from any song | Gap |
|---|---|---|---|
| Ukulele | none found (MVSep Plucked Strings is a separation service) | chords: Chordify, Chord ai, Capo; **no tab or melody** | 3 |
| Acoustic/electric split | Moises, MVSep (LALAL.AI merged them back into one "Guitars" stem in 2026-08) | not split | 2 |
| Lead/rhythm guitar | Moises, Music.AI, MVSep | **Songsterr AI** (separate rhythm and lead tracks, opt-in) | 1 |
| 5/6-string bass, 7/8-string guitar | n/a (within the bass and guitar stems) | **Songsterr AI** (6/7/8-string guitar, 4/5/6-string bass, custom tunings) | 1 |
| Banjo, mandolin | MVSep Plucked Strings (service) | chords only (Chord ai, Capo) | 4 |
| Keys (synth, organ, EP) | Moises "Piano and Keys", LALAL.AI synth | Songsterr AI keys/synth | 2 |
| Violin | strings section stems (Moises, LALAL.AI) | Klangio Violin2Notes ("even when other instruments are playing"), Songscription, Songsterr AI strings | 3 |
| Viola, cello, double bass | as violin | Violin2Notes covers all four | 3 |
| Saxophone and other winds | a single "wind" family stem (Moises, LALAL.AI) | Klangio Wind2Notes (10 winds), Songscription (flute, trumpet, sax), Songsterr AI winds | 3 |
| Harmonica | none | none (one hobby project, AutoTabber, search snippet only) | 5 |
| Hand percussion | MVSep Percussion (service; no cajón) | none | 4 |
| Backing/harmony vocals | Moises, LALAL.AI lead/back | **no harmony-as-notes** from any song | 4 |
| Drum-kit pieces | Moises Pro (kick, snare, toms, hi-hats, cymbals) | Songsterr AI drums, Klangio Drum2Notes, Songscription | 2 |

Sources:
- [Songsterr help](https://www.songsterr.com/help)
- [Moises features by plan](https://moises.ai/blog/latest/moises-features/), dated 2022-05-10: strings, wind, background vocals and the guitar splits are Premium; drum parts are Pro.
- [LALAL.AI](https://www.lalal.ai/)
- [Klangio Violin2Notes](https://klang.io/violin2notes/) and [Wind2Notes](https://klang.io/wind2notes/)
- [Songscription](https://www.songscription.ai/)
- [Chord ai](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109)
- `research/market/feature-matrix.md`

Klangio and Songscription transcribe but offer no bar-snapped loop, count-in, stem mixer or confidence-aware notation.

#### 2.4 Notation and pedagogy fit
- **Renderer support (alphaTab, pinned 1.8.4):**
  - `\tuning (…)` sets any number of strings in any order, so re-entrant ukulele works. The built-in presets cover 4–7 strings, and 8-string support is unverified ([staff metadata](https://alphatab.net/docs/alphatex/staff-metadata), [Tuning.ts](https://raw.githubusercontent.com/CoderLine/alphaTab/main/packages/alphatab/src/model/Tuning.ts)).
  - Clefs include alto and tenor; `\displayTranspose` changes display only. There is also a Jianpu (`numbered`) staff ([bar metadata](https://alphatab.net/docs/alphatex/bar-metadata)).
  - Pick strokes `su`/`sd` draw the up-bow/down-bow glyphs ([PickStrokeGlyph.ts](https://raw.githubusercontent.com/CoderLine/alphaTab/main/packages/alphatab/src/rendering/glyphs/PickStrokeGlyph.ts)), and tremolo picking (`tp`) exists ([beat properties](https://alphatab.net/docs/alphatex/beat-properties)).
- **Gaps:**
  - No breath mark and no harmonica tab.
  - No per-string fret offset for the banjo's short 5th string. A TablEdit importer PR lists the single-string capo as unrepresentable ([PR #3013](https://github.com/CoderLine/alphaTab/pull/3013)); LilyPond needs a banjo-specific fret format for the same reason ([LilyPond](https://lilypond.org/doc/v2.24/Documentation/notation/banjo)).
  - No cajón articulation; congas exist in the GM set.
- **What learners read:**
  - **Ukulele:** chord diagrams and lyric/chord sheets first, 4-line tab for melodies ([Got A Ukulele, tier 4](https://www.gotaukulele.com/2011/03/ukulele-beginners-what-is-re-entrant.html?m=1)).
  - **Banjo:** tab first; the 5th string is written as absolute neck frets 0, 6, 7 … ([Deering](https://blog.deeringbanjos.com/what-is-banjo-tab)).
  - **Strings:** standard notation. ABRSM adds viola treble clef and cello/double-bass tenor and treble clefs in late grades ([ABRSM cello syllabus](https://www.abrsm.org/sites/default/files/2023-10/Practical%20syllabus%20Bowed%20Strings%202024%20(3%20Cello)%2020230901.pdf); grade placement is our reading of the table).
  - **Saxophone, trumpet, clarinet:** written (transposed) pitch. Alto is written a major sixth above concert pitch, tenor a major ninth, and B♭ instruments a major second ([IntMus](https://intmus.github.io/inttheory/12-reading-scores/a2-insttransandrange.html)).
  - **Harmonica:** hole numbers, `-` for draw, apostrophes for bends; conventions vary ([Harmonica.com](https://harmonica.com/how-to-read-harmonica-tabs), [Wikibooks](https://en.wikibooks.org/wiki/Harmonica/Tablature)).
- **Practice tools learners ask for:** intonation (cents) feedback is the better-grounded tool for strings. Drones are popular, but a 58-student string study found no significant gain in pitch accuracy from a tonic drone ([Morgan 2022](https://egrove.olemiss.edu/etd/2448)).

#### 2.5 Pipeline reuse: what is in the repo today
- **Already generic:**
  - The fret DP computes `fret = pitch − open` for each string with no ordering assumption (`packages/music-core/src/fret/dp.ts`), so re-entrant and arbitrary tunings work as they are.
  - `toAlphaTex` writes `\tuning` with any string count (`export/alphatex.ts`).
  - `ChordDiagram`, `FretboardDiagram` and `GuitarRoll` take any number of strings (`packages/notation/src`).
- **Blockers that one "stringed-instrument generalisation" step removes:**
  - `StringedInstrument = 'guitar' | 'bass'` and guitar/bass-only weights (`fret/config.ts`).
  - `tabTuning()` hard-codes 4 or 6 strings (`build-tab.ts`).
  - `tuningOffset()` only accepts 6-string uniform shifts, which switches off chord shapes and capo suggestions (`harmony/chordtools.ts`).
  - `MAX_STRINGS = 7`, with `.max(7)` caps in `contracts/src/analysis/{tab,notes,corrections}.ts`.
  - The closed `Instrument` enum (`contracts/src/analysis/common.ts`) and the per-instrument profiles (`contracts/src/instruments.ts`).
- **Missing for strings and winds:**
  - A single-staff pitched score export. Vocals use the canvas `MelodyRoll`, and piano has a grand-staff export (`alphatex-piano.ts`).
  - A written-pitch (transposition) layer.
  - An integrated f0 tracker: `notes.vocals` runs Basic Pitch (`services/ml/config/notes.personal.yaml`).
- **Shared enablers (do each once):**
  - **E1, stringed-instrument generalisation:** unlocks ukulele, extended-range guitar and bass, then banjo and mandolin.
  - **E2, staff export with a written-pitch layer:** unlocks every wind and bowed string.
  - **E3, f0 tracker + note segmentation:** unlocks monophonic winds and double bass; vocals could reuse it too.

#### 2.6 Regional instruments (not scored)
- **Guzheng:** a claim of "around 100 million people" (China Today, 2021, no source given) conflicts with a figure of about 12.3 million learners (a NetEase brand article, 2026-08, citing an unnamed white paper). The figures differ about 8× and neither is verifiable ([China Today](https://www.chinastory.cn/PCywdbk/v2/detail/20211027/1012700000042741635312246245672016_1.html), [NetEase, tier 4](https://www.163.com/dy/article/L3J7CGSQ0556M2PJ.html)).
- **Exam data:** we found no grading-exam volumes by instrument.
- **Erhu, sitar, đàn bầu:** no learner counts; communities are tiny (r/Erhu about 2K, r/Sitar about 4K).
- **Competitors:** Chinese guzheng apps with AI play-along exist (search snippets only).
- **Verdict:** the demand evidence is too thin to score. alphaTab's Jianpu staff means notation would not be the blocker if that changes.

### 3. Scored matrix
Scores are 1–5; totals are weighted means (§1). "Base" uses D25 G15 S15 T15 N10 R15 L5, and "Feas ×2" doubles S, T and R.

| # | Candidate | D | G | S | T | N | R | L | Base | Feas ×2 (rank) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Ukulele | 4 | 3 | 2 | 3 | 5 | 4 | 3 | **3.45** | 3.31 (3) |
| 2 | Drum-kit pieces | 3 | 2 | 4 | 3 | 5 | 4 | 3 | **3.35** | 3.45 (2) |
| 3 | 5/6-string bass | 2 | 1 | 4 | 4 | 5 | 5 | 3 | **3.25** | 3.59 (1) |
| 4 | Saxophone | 3 | 3 | 3 | 4 | 4 | 3 | 3 | **3.25** | 3.28 (4) |
| 5 | Acoustic/electric guitar split | 3 | 2 | 3 | 4 | 5 | 3 | 3 | 3.20 | 3.24 (5) |
| 6 | Violin / fiddle | 4 | 3 | 2 | 4 | 4 | 2 | 2 | 3.15 | 3.00 (9) |
| 7 | Backing/harmony vocals | 3 | 4 | 3 | 2 | 3 | 4 | 3 | 3.15 | 3.10 (8) |
| 8 | Keys (synth, organ, EP) | 3 | 2 | 3 | 3 | 4 | 4 | 3 | 3.10 | 3.17 (7) |
| 9 | 7/8-string guitar | 2 | 1 | 4 | 3 | 5 | 4 | 3 | 2.95 | 3.17 (6) |
| 10 | Flute | 3 | 3 | 2 | 3 | 4 | 3 | 3 | 2.95 | 2.86 (10) |
| 11 | Trumpet | 3 | 3 | 2 | 3 | 4 | 3 | 3 | 2.95 | 2.86 (11) |
| 12 | Lead/rhythm guitar split | 3 | 1 | 2 | 4 | 5 | 2 | 2 | 2.70 | 2.69 (12) |
| 13 | Banjo (5-string) | 2 | 4 | 2 | 2 | 4 | 3 | 3 | 2.70 | 2.59 (15) |
| 14 | Mandolin | 2 | 4 | 2 | 2 | 4 | 3 | 3 | 2.70 | 2.59 (16) |
| 15 | Clarinet, trombone | 2 | 3 | 2 | 3 | 4 | 3 | 3 | 2.70 | 2.69 (13) |
| 16 | Harmonica (diatonic) | 2 | 5 | 2 | 2 | 4 | 2 | 3 | 2.70 | 2.48 (17) |
| 17 | Viola, cello, double bass | 2 | 3 | 2 | 3 | 4 | 3 | 2 | 2.65 | 2.66 (14) |
| 18 | Hand percussion (cajón, congas) | 1 | 4 | 2 | 2 | 2 | 3 | 3 | 2.25 | 2.28 (18) |

**Score rationale per row** (ML references are to sections of `research/ml/other-instruments-feasibility.md`; "inf." = inference):
1. **Ukulele:**
   - D4: large and growing beginner base (US sales; 104K community; a dedicated Yousician app with 12K ratings), but absent from school surveys.
   - G3: chords from any song are commoditised; tab or melody from any song is not offered anywhere.
   - S2: no model; it probably lands in SW `guitar` (inf., ML §3.1).
   - T3: pitch is easy; no dataset.
   - N5: tab and chord diagrams, all rendered today.
   - R4: E1 plus a chord-shape library; no new model.
   - L3: same chain as guitar.
2. **Drum-kit pieces:**
   - D3: extends the existing drummer segment (r/drums 329K; drum kit 14% of UK children).
   - G2: Moises Pro and Songsterr AI cover it.
   - S4: the downloadable 5-stem MDX23C reaches kick 16.66 and snare 11.53 dB; hi-hat is weak (ML §2.2, §3.14).
   - T3: ADTOF's 5 classes are already shipped; finer classes are research.
   - N5: the drum views exist.
   - R4: one separator stage plus lane focus.
   - L3: red-tier DrumSep checkpoint.
3. **5/6-string bass:**
   - D2: niche, no data.
   - G1: Songsterr AI covers it.
   - S4: SW covers down to DC (inf. from its config).
   - T4: B0 is above our 30 Hz floor.
   - N5.
   - R5: config, a tuning picker and `tabTuning`.
   - L3.
4. **Saxophone:**
   - D3: teacher share 14% in the UK; 62K community; a jazz by-ear culture.
   - G3: Wind2Notes and Songscription transcribe it; no practice integration.
   - S3: open Mega wind stem 8.63 dB, but the full model exceeds our VRAM; SW `other` as a proxy (ML §3.9).
   - T4: 90% onset F on FiloSax with f0 + segmentation.
   - N4: standard notation with transposition; needs E2.
   - R3: needs E2 and E3.
   - L3.
5. **Acoustic/electric guitar split:**
   - D3: the existing guitar base; it matters only in songs with both types.
   - G2: Moises and MVSep separate it.
   - S3: ACMID 5.49 / 5.72 dB real-mix; open only via the Mega-53 heads (ML §3.2).
   - T4: shipped Guitab.
   - N5.
   - R3: a new splitter model.
   - L3.
6. **Violin/fiddle:**
   - D4: third melodic instrument in both national datasets; 109K community.
   - G3: Violin2Notes and Songscription.
   - S2: open strings stem 4.69 dB family-level; nothing separates solo from section (ML §3.7).
   - T4: 93.0 onset F1 on URMP violin.
   - N4: needs E2; bowing via `su`/`sd`.
   - R2: new separator, new transcriber and E2.
   - L2: AGPL code or restricted-data weights, and a CC BY-NC-SA separator.
7. **Backing/harmony vocals:**
   - D3: a large singing population, but choirs are served by learning tracks.
   - G4: no harmony-as-notes from any song.
   - S3: backing 4.73 dB open (ML §3.13).
   - T2: a cappella results only.
   - N3: multi-part melody roll.
   - R4: the `subtract` mode exists.
   - L3: the karaoke checkpoint has no licence.
8. **Keys:**
   - D3: keyboard is the top UK children's instrument, but "keys parts in a band" is narrower.
   - G2: Songsterr AI and Moises.
   - S3: SW routes keys to `other`, measured (ML §3.6).
   - T3: synthetic numbers only.
   - N4: reuses the piano views.
   - R4: a new route and profile, no new model.
   - L3.
9. **7/8-string guitar:**
   - D2. G1: Songsterr AI.
   - S4.
   - T3: Guitab's string head is 6-string.
   - N5.
   - R4: 8 strings also needs the contract caps raised.
   - L3.
10. **Flute:**
    - D3: the fastest-growing UK children's instrument (7% → 15%), but a method-book culture.
    - G3.
    - S2: Mega's own-set flute number only.
    - T3: 74% on Irish flute.
    - N4: concert pitch.
    - R3: needs E2 and E3.
    - L3.
11. **Trumpet:** as flute, but D3 rests on its UK teacher share (7%) and community (58K), and it needs transposition.
12. **Lead/rhythm guitar split:**
    - D3. G1: Songsterr AI ships it.
    - S2: vendors only, no labels.
    - T4. N5.
    - R2: we would have to train our own model.
    - L2: no open artefact.
13. **Banjo:**
    - D2: 69K community, no surveys.
    - G4: no audio-to-banjo-tab product.
    - S2. T2: no data.
    - N4: tab, but the short 5th string needs a tabs-only staff.
    - R3: a per-string start fret in the DP.
    - L3.
14. **Mandolin:**
    - D2: 28K community; 584 German school pupils.
    - G4. S2.
    - T2: tremolo needs a merge rule.
    - N4. R3. L3.
15. **Clarinet, trombone:**
    - D2: school band only (UK teacher share 15% / 4%).
    - G3. S2. T3. N4. R3. L3.
16. **Harmonica:**
    - D2: 50K community; absent from surveys.
    - G5: nobody isolates or transcribes it.
    - S2: not a stem class anywhere except inside MVSep Wind.
    - T2: one 2019 paper.
    - N4: hole tab is well defined but needs a custom view.
    - R2: a new assigner plus a new view.
    - L3.
17. **Viola, cello, double bass:**
    - D2: small and lesson-driven, though viola and double bass grew more than 20% in German schools from 2014 to 2020 ([MIZ](https://miz.org/en/statistics/pupils-enrolled-at-public-music-schools-by-subject)).
    - G3. S2. T3. N4.
    - R3: double bass reuses the bass stem and tuning.
    - L2.
18. **Hand percussion:**
    - D1: about 2K-member communities, no surveys.
    - G4.
    - S2: the cajón probably sits in SW `drums` (inf.).
    - T2: no stroke dataset.
    - N2: no standard notation.
    - R3. L3.

### 4. Ranking and sensitivity
- **Base weights:** ukulele 3.45 > drum-kit pieces 3.35 > 5/6-string bass 3.25 = saxophone 3.25 > acoustic/electric split 3.20 > violin 3.15 = backing vocals 3.15 > keys 3.10. The rest score 2.95 or below.
- **Feasibility ×2:** 5/6-string bass 3.59 > drum-kit pieces 3.45 > ukulele 3.31 > saxophone 3.28 > acoustic/electric split 3.24 > 7/8-string guitar 3.17 = keys 3.17 > backing vocals 3.10 > violin 3.00.
- **What moves:**
  - The config-level fretted variants rise; violin falls three places.
  - The top five are the same set of candidates under both weightings, so the recommendation does not depend on the weights.
- **Pending measurements that would move a score** (all cheap, on MoisesDB data we already hold; ML doc, Open questions):
  - **Keys:** if SW `other` reaches piano-like uSDR (about 6 dB) on the 110 other-keys songs, keys S rises 3 → 4 and keys moves to about 3.25 base.
  - **Ukulele:** if ukulele-only material lands cleanly in SW `guitar`, ukulele S rises 2 → 3 (3.60 base).
  - **Violin:** if the strings stem stays near 4–5 dB, violin stays behind the winds.

### 5. Recommended order (next 3–5 additions)
1. **Ukulele, plus 5/6-string bass and 7-string guitar.** Highest base score and the only new learner group in the top three. All three share enabler E1, and none needs a new model. Its default view is chords (§6.1), so separation weakness costs it little.
2. **Drum-kit pieces.** The highest feasibility of any variant (S4, R4): one separator stage on the existing drums stem, plus per-lane focus in views we already ship. "Drums minus snare" and "kick only" are the practice moves drummers make (inf.).
3. **Saxophone.** The best-evidenced wind (T4), with a by-ear jazz culture and a clean CC-BY evaluation set (ChoraleBricks). It builds E2 and E3, which flute, trumpet, clarinet, violin and double bass all reuse. Its separation risk is the main reason it is third, not higher.
4. **Acoustic/electric guitar split** (measurement-gated). It improves our largest segment in multi-guitar songs, and MoisesDB has the labels to measure it. Start only once the Mega-53 acoustic/electric heads (77.6 MB each), run inside the SW guitar stem, give usable splits on the MoisesDB acoustic/electric windows. This is candidate 3 in the guitar list of `research/ml/separation-improvements-2026-11.md`.
5. **Violin/fiddle** (measurement-gated). The highest demand of any family not yet started, and the transcription is ready. It reuses E2 from saxophone. Gate it on a strings stem reaching usable quality on fiddle-over-band material.

**Cheap side additions, not counted as instruments:**
- A lead/backing vocal stem in the mixer (karaoke on our vocals stem plus `subtract`), with no harmony notes.
- The keys measurement (SW `other` on MoisesDB other-keys windows), which decides whether keys jumps into the top five.

### 6. Minimum viable paths for the top three

#### 6.1 Ukulele (with 5/6-string bass and 7-string guitar)
- **Scope:** soprano, concert and tenor in GCEA (re-entrant, `[69,64,60,67]`), low-G (`[69,64,60,55]`) and baritone DGBE (`[64,59,55,50]`). Default level `chords_only` (ukulele chord diagrams plus strum); `as_transcribed` gives 4-line tab.
- **Separation route:** no new model; the SW `guitar` stem is the ukulele stem (`mix_minus: subtract`, as guitar).
  - When the tagger or stem energy suggests guitar is also present, mark the stem quality "rough" and keep the chords default.
  - Chords come from the existing BTC route on the no-drums stem, which separation does not affect (`services/ml/config/chords.personal.yaml`).
- **Transcription model:** `notes.ukulele` runs Basic Pitch with guitar-like thresholds. A/B it against Guitab's pitch output; Guitab's 6-string string cue is unusable, so fret assignment relies on the DP alone.
- **Notation view:** the existing tab view via `toAlphaTex` with explicit `\tuning (A4 E4 C4 G4)`. Do not use alphaTab's ukulele preset, which is two octaves low. Also `ChordDiagram` with 4 strings and `GuitarRoll` with 4 string names.
- **Reused:** fret DP, `buildTab`, levels, BTC chords, `toAlphaTex`, `ChordDiagram`, `GuitarRoll`, the stem mixer and the practice screen.
- **New:**
  - E1: `StringedInstrument` gains ukulele with weights starting from the guitar `easiest` set; `TUNINGS` entries; `tabTuning` per instrument; and `tuningOffset` generalised, or a ukulele shape library. GCEA shapes are guitar strings 1–4 moved up a perfect fourth, and baritone uses guitar strings 1–4 unchanged.
  - The `Instrument` enum, profile and generated schemas (`pnpm contracts:gen`), plus the `notes.ukulele` stage registration.
  - Stories for the new chord-diagram and tab states.
  - The bass/7-string rider adds `bass6_standard`, a 7-string tuning, `tabTuning` accepting 5–7 strings, and a tuning picker in the UI.
- **Eval set** (no public ukulele data exists; the owner doesn't play, so nothing may depend on owner recordings, `docs/steps/00-shared-context.md`):
  - 20 rendered clips of 30 s each (10 strummed accompaniments, 10 melody/fingerstyle) from published ukulele tabs. Each is rendered through at least two sampled ukulele instruments with varied room and mic, and mixed under real accompaniment from MUSDB18-HQ/MoisesDB stems. The tab is the exact reference.
  - 15 ukulele-led songs from the owner's library with published chord charts as chord references, plus a listening check of the stem.
  - The 7 MoisesDB other-plucked songs, to check where plucked instruments are routed.
  - For the rider: 10 rendered 5-string bass clips with low-B passages and 5 rendered 7-string guitar clips, from published tabs through sampled instruments, mixed as above.
- **Success criteria (proposed):**
  - Chords: majmin WCSR on the ukulele songs at least 0.74 (the shipped P6 level of 0.770, minus 0.03).
  - Onsets: F1 at least 0.80 on clean clips and at least 0.70 under backing.
  - Tab: F1 at least 0.70 against the reference tabs, with every note on a playable position.
  - Separation: the ukulele lands in SW `guitar` (owner rating "usable" or better) in at least 8 of 10 ukulele-only songs.
  - Rider: low-B recall at least 0.8.
- **Main risk:** the evaluation set is rendered and small, so real ukulele timbres and playing are under-represented. Songs with both ukulele and guitar merge in one stem, and no open model splits them. The chords default is the mitigation.
- **Effort:** M.

#### 6.2 Drum-kit pieces
- **Scope:** practise one piece of the kit. Solo or mute kick, snare, toms and cymbals (hi-hat with cymbals) in the mixer, with the drum view focused on one lane.
- **Separation route:** SW `drums` → DrumSep, since these models only work on a drum track ([MVSep](https://de.mvsep.com/algorithms/29)).
  - Start with the 5-stem MDX23C (kick 16.66, snare 11.53, toms 12.32 dB on MVSep's 150-track drum set; mirror only, licence undocumented). The alternative is the 6-stem `mdx23c-drumsep` already in the register (14.55 / 9.79 / 10.64), which keeps ride and crash apart. This is candidate 5 in `research/ml/separation-improvements-2026-11.md`.
  - Upgrade to the DrumSep Mel-RoFormer v2 class (kick 18.67, snare 13.56, toms 13.61 dB) if its weights are obtainable (unverified).
  - Ship hi-hat inside a combined "cymbals" stem: hi-hat alone is 3.6–4.7 dB.
  - `drums − piece` gives the "drums minus X" track.
- **Transcription model:** unchanged. The shipped ADTOF 5-class stage (BD, SD, TT, HH, CY) already provides per-piece hits. The 7-class expansion (Riley & Dixon, MDB 0.84) is a later option.
- **Notation view:** the existing drum grid and alphaTex drum staff, plus a new lane focus. It filters `GridHit` lanes and alphaTex notes by articulation and is tied to the mixer's solo/mute, so the focused piece is both heard and highlighted.
- **Reused:** the `drums` profile, ADTOF, levels (`core_groove`/`simplified`/`as_transcribed`), `DrumGrid`, `alphatex-drums.ts` and the count-in and loop tools.
- **New:**
  - A DrumSep step after `separate`, in `stem_post`, with per-piece stem keys and mixer channels.
  - Lane focus UI and stories.
  - The register record. The owner must also clear the PC's rule on external code that blocked loading the checkpoint in step 25 (`services/ml/eval/results/p2d/2026-10-28-phases.md`).
- **Eval set:**
  - 40 MoisesDB 30 s windows chosen like P1 (`eval/p1_moisesdb.py`) from songs with per-piece drum tracks (kick and snare 202 songs, toms 136, hi-hat 115, cymbals 90), scored on SW-separated drums, not oracle drums.
  - The P2d items, to check that per-class onset F1 is unchanged.
  - Optionally a small StemGMD subset (CC-BY-4.0) for drum-only checks.
- **Success criteria (proposed):**
  - Separation: median uSDR at least 10 dB for kick and snare, at least 8 dB for toms, and at least 4 dB for cymbals (labelled "rough").
  - Transcription: no ADTOF per-class F1 regression beyond 0.01.
  - Listening: the owner rates "drums minus snare" and "kick only" usable on at least 8 of 10 songs.
- **Main risk:** the hi-hat is the piece beginners most often want alone, and it is the weakest stem. The MVP relies on lane highlighting from ADTOF hits rather than a clean hi-hat track. Electronic kits (38 MoisesDB songs) may separate worse.
- **Effort:** S–M.

#### 6.3 Saxophone (first wind instrument)
- **Scope:** alto, tenor, soprano and baritone sax, monophonic lines. Notation in written pitch with a concert-pitch toggle; loop, slow-down and count-in as today.
- **Separation route:**
  - MVP: SW `other` as the sax stem when the tagger finds sax and no other "other" family (strings, keys); otherwise mark the stem "rough".
  - Candidate upgrade: the open Mega 53 `saxophone`/`wind` stem (wind 8.63 dB on MVSep's 35-track set). The full model is 1.37 GB with at least 16 GB of VRAM recommended. Look first for a per-stem head, as mirrored for guitar and keys (77.6 MB each; a wind head is unverified).
- **Transcription model:**
  - Baseline: Basic Pitch on the stem, already shipped.
  - Candidate: SwiftF0 (MIT, ONNX, `onnx-cpu` island) plus our own CREPE-Notes-style segmenter: the pitch-gradient × inverse-confidence boundaries, plus an onset detector for repeated notes. The method scores 90% on FiloSax and beats Basic Pitch by 7–10 points on other monophonic sets.
  - Keep the f0 curve for vibrato and scoop display.
- **Notation view:** the new single-staff alphaTex export (E2), derived from `alphatex-piano.ts` with one staff and a clef from the profile.
  - The written-pitch layer adds +9 semitones for alto, +14 tenor, +21 baritone and +2 soprano, and writes the key signature in the written key.
  - Write written pitches directly rather than rely on `\displayTranspose`; whether it respells key signatures is unverified.
  - `MelodyRoll` stays available as a no-reading view. Phrase gaps from `build-melody.ts` become breath-point hints.
- **Reused:** `MelodyRoll`, `build-melody.ts`, `alphatex-bars.ts`, key spelling, `transpose/`, the tagger (PANNs) and the practice screen.
- **New:**
  - The `Instrument` enum and profile (`score: 'staff'`), the f0 tracker integration and the segmenter (E3).
  - The staff export and written-pitch layer (E2), with stories.
  - A fingering chart later.
- **Eval set:**
  - ChoraleBricks (CC-BY-4.0): its alto and baritone sax tracks, mixed under the other ChoraleBricks parts and under a band backing, about 30 clips. This tests transcription with and without our separation.
  - The 9 MoisesDB reed songs (non-commercial) for separation.
  - 10 sax-featuring commercial songs from the owner's library for listening.
  - Filosax only if access is granted (non-commercial).
- **Success criteria (proposed):**
  - Onset F1 at least 0.80 on ChoraleBricks sax under accompaniment through the full route. The f0 path replaces Basic Pitch only if it wins by at least 0.05.
  - Octave errors at most 5%.
  - Written-pitch spelling correct on all ChoraleBricks keys.
  - The owner rates the stem usable on at least 7 of 10 songs where sax is the only extra instrument.
- **Main risk:** separation. Sax shares `other` with keys, strings and FX, no open per-instrument sax checkpoint has been verified on a public set, and Mega exceeds our VRAM recommendation. If neither route clears the listening bar, ship sax with notation from the mixture-level f0 only on "sax-forward" songs, or defer it behind violin.
- **Effort:** M–L. E2 and E3 make flute, trumpet and clarinet S–M afterwards.

### 7. Recommended against (for now) and why
| Candidate | Verdict | Why | What would change it |
|---|---|---|---|
| Hand percussion (cajón, congas) | Against | Lowest score under both weightings (2.25 / 2.28): about 2K-member communities, no stroke dataset, no standard notation | A cheap test showing cajón lands in SW `drums` and maps to ADTOF kick/snare; then it is a drums *view*, not an instrument |
| Harmonica | Defer | Largest gap (G5), but S2, T2, R2. Not a stem class anywhere except inside MVSep Wind; one 2019 paper; needs a hole/bend assigner and a custom tab view | An SW routing test showing harmonica lands cleanly in one stem in blues-trio material, plus a labelled set built from published harmonica tabs and rendered or licensed audio |
| Lead/rhythm guitar separation | Against as a model | Songsterr AI ships lead and rhythm tabs (G1); no open model, labels or published numbers (S2) | An open checkpoint with published numbers; meanwhile, level presets (rhythm → `chords_only`) and stereo or acoustic/electric heuristics |
| Banjo, mandolin | Defer | No public data (T2); plucked instruments merge in SW `guitar`; the banjo's 5th string needs a tabs-only staff | After E1 ships for ukulele, the marginal cost is a tuning, a 5th-string start fret or a tremolo merge, plus a rendered evaluation set |
| 8-string guitar | Against | Tiny demand, Songsterr AI covers it, and it needs the 7-string caps lifted in contracts and `MAX_STRINGS` | Real usage requests |
| Viola, cello, double bass | After violin | They reuse violin's E2 work; double bass may come almost free through the bass stem | Violin shipping |
| Clarinet, trombone (and flute, trumpet) | After saxophone | They share the sax path (E2 + E3). Flute is the strongest of them on demand (UK 7% → 15%) | Saxophone shipping |
| Regional instruments (guzheng, erhu, sitar, đàn bầu) | Not scored | Demand figures conflict about 8× and are unverifiable; no separation or transcription work found | A verifiable learner count (exam-board volumes) and an explicit market decision |

## Implications for Splitune
- **Build the shared enablers, not one-offs.** E1 (stringed-instrument generalisation) covers ukulele, extended-range instruments, banjo and mandolin. E2 (staff export with a written-pitch layer) and E3 (f0 tracker + segmentation) cover all winds and bowed strings. Sequencing ukulele and then saxophone builds two of the three early.
- **Measure before building separation.** Each new family's first step is a MoisesDB measurement of an existing SW stem used as a mix-minus proxy: `guitar` for plucked instruments, `other` for keys and winds, `drums` → DrumSep, and vocals → karaoke. It costs hours and decides whether a new model is needed.
- **Differentiate on practice, not capability.** For violin, winds and keys, competitors already transcribe any song. Splitune's advantage is the practice loop around the notes: bar-snapped loops, count-in, the stem mixer, confidence display and pedals.
- **Decision record.** If the owner adopts this order, D11 in `research/product/recommendations-and-decisions.md` (launch instruments) needs an addendum. Personal mode needs no licence sign-off, but each new checkpoint needs a `compliance/register` record.

## Open questions
- **Measurement gates:**
  - Does SW `other` work as a keys stem, and as a sax stem in horn-only songs?
  - Does ukulele-only audio land cleanly in SW `guitar`?
  - Method and data are in the ML doc's open questions.
- **Owner's own priorities:** which instruments does the owner want Splitune to cover for the songs they choose? In personal mode that may outweigh the market scores; the ranking assumes a typical learner.
- **Demand data:** the ABRSM 2025 report itself, Music Trades unit sales by instrument (paywalled), and Fender's newsroom (unreachable) would firm up the ukulele, flute and saxophone demand scores.
- **Competitor quality:** how good are Songsterr AI's strings/winds tracks and Klangio's Violin2Notes on band mixes? Blind trials would set the bar Splitune's notation must clear.

## Sources
- [ABRSM Making Music 2014 (PDF, Youth Music mirror)](https://www.youthmusic.org.uk/sites/default/files/2014_Making_Music_web_version_0.pdf) — tier 3, accessed 2026-11-07
- [Independent via AOL: fewer children than ever learning the recorder (2025-04-29)](https://www.aol.com/fewer-children-ever-learning-recorder-232418356.html) — tier 3, accessed 2026-11-07
- [MIZ: pupils enrolled at public music schools by subject (VdM 2021)](https://miz.org/en/statistics/pupils-enrolled-at-public-music-schools-by-subject) — tier 2, accessed 2026-11-07
- [Guitar.com: Fender, 16 million Americans picked up guitar](https://guitar.com/news/industry-news/fender-16-million-americans-picked-up-guitar-over-the-last-two-years/) — tier 3, accessed 2026-11-07
- [Fretboard Journal: Just how many ukuleles? (2011)](https://www.fretboardjournal.com/columns/just-how-many-ukuleles/index.php) — tier 3, accessed 2026-11-07
- [Statista: ukuleles sold in the US (values paywalled; figure from search snippet only)](https://www.statista.com/statistics/448450/number-of-ukuleles-sold-in-the-us/) — tier 3, accessed 2026-11-07
- [MMR: ukulele market 2022](https://mmrmagazine.com/big-sales-come-in-small-packages-the-ukulele-market-stays-strong-in-2022) — tier 3, accessed 2026-11-07
- [GummySearch subreddit pages (e.g. r/ukulele)](https://gummysearch.com/r/ukulele/) — tier 4, accessed 2026-11-07
- [Ukulele by Yousician (US App Store)](https://apps.apple.com/us/app/id1585618286) — tier 2, accessed 2026-11-07
- [Trala: Learn Violin (US App Store)](https://apps.apple.com/us/app/id1143205265) — tier 2, accessed 2026-11-07
- [Learn Saxophone – tonestro (US App Store)](https://apps.apple.com/us/app/-/id1447013289) — tier 2, accessed 2026-11-07
- [Tunefox (US App Store)](https://apps.apple.com/us/app/tunefox/id1128824483) — tier 2, accessed 2026-11-07
- [Green (2010), informal popular music learning practices (SIMPOM PDF)](https://seer.unirio.br/simpom/article/download/2657/1990/13063) — tier 1, accessed 2026-11-07
- [Waldron (2009), how adult learners learn Celtic traditional music (MERI PDF)](https://usf.edu/arts/music/documents/meri-archives/979-meri-03pp57-71.pdf) — tier 1, accessed 2026-11-07
- [LearnJazzStandards: how to learn a jazz solo by ear](https://www.learnjazzstandards.com/blog/learning-jazz/how-to-learn/) — tier 4, accessed 2026-11-07
- [Suzuki Association of the Americas: Creating the Suzuki environment](https://suzukiassociation.org/journalarticle/creating-the-suzuki-environment/) — tier 2, accessed 2026-11-07
- [Harmonica.com: how to read harmonica tabs](https://harmonica.com/how-to-read-harmonica-tabs) — tier 2, accessed 2026-11-07
- [Wikibooks: Harmonica/Tablature](https://en.wikibooks.org/wiki/Harmonica/Tablature) — tier 4, accessed 2026-11-07
- [Songsterr help (AI tabs)](https://www.songsterr.com/help) — tier 2, accessed 2026-11-07
- [Moises blog: features by plan (2022-05-10)](https://moises.ai/blog/latest/moises-features/) — tier 2, accessed 2026-11-07
- [LALAL.AI](https://www.lalal.ai/) — tier 2, accessed 2026-11-07
- [Klangio Violin2Notes](https://klang.io/violin2notes/) — tier 2, accessed 2026-11-07
- [Klangio Wind2Notes](https://klang.io/wind2notes/) — tier 2, accessed 2026-11-07
- [Songscription](https://www.songscription.ai/) — tier 2, accessed 2026-11-07
- [Chord ai (US App Store)](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109) — tier 2, accessed 2026-11-07
- [alphaTex staff metadata](https://alphatab.net/docs/alphatex/staff-metadata) — tier 2, accessed 2026-11-07
- [alphaTex bar metadata](https://alphatab.net/docs/alphatex/bar-metadata) — tier 2, accessed 2026-11-07
- [alphaTex beat properties](https://alphatab.net/docs/alphatex/beat-properties) — tier 2, accessed 2026-11-07
- [alphaTab source: Tuning.ts presets](https://raw.githubusercontent.com/CoderLine/alphaTab/main/packages/alphatab/src/model/Tuning.ts) — tier 1, accessed 2026-11-07
- [alphaTab source: PickStrokeGlyph.ts](https://raw.githubusercontent.com/CoderLine/alphaTab/main/packages/alphatab/src/rendering/glyphs/PickStrokeGlyph.ts) — tier 1, accessed 2026-11-07
- [alphaTab PR #3013: TablEdit importer](https://github.com/CoderLine/alphaTab/pull/3013) — tier 1, accessed 2026-11-07
- [LilyPond notation reference: banjo](https://lilypond.org/doc/v2.24/Documentation/notation/banjo) — tier 2, accessed 2026-11-07
- [Got A Ukulele: what is re-entrant?](https://www.gotaukulele.com/2011/03/ukulele-beginners-what-is-re-entrant.html?m=1) — tier 4, accessed 2026-11-07
- [Deering Banjos: what is banjo tab?](https://blog.deeringbanjos.com/what-is-banjo-tab) — tier 2, accessed 2026-11-07
- [ABRSM Bowed Strings syllabus from 2024 (cello, PDF)](https://www.abrsm.org/sites/default/files/2023-10/Practical%20syllabus%20Bowed%20Strings%202024%20(3%20Cello)%2020230901.pdf) — tier 2, accessed 2026-11-07
- [IntMus: instrumental transpositions and ranges](https://intmus.github.io/inttheory/12-reading-scores/a2-insttransandrange.html) — tier 3, accessed 2026-11-07
- [Morgan (2022), tonic drone and pitch accuracy of string players (dissertation)](https://egrove.olemiss.edu/etd/2448) — tier 2, accessed 2026-11-07
- [China Today: guzheng (2021)](https://www.chinastory.cn/PCywdbk/v2/detail/20211027/1012700000042741635312246245672016_1.html) — tier 3, accessed 2026-11-07
- [NetEase: guzheng learner figures (2026-08-05)](https://www.163.com/dy/article/L3J7CGSQ0556M2PJ.html) — tier 4, accessed 2026-11-07
- [MVSep DrumSep (algorithm 29)](https://de.mvsep.com/algorithms/29) — tier 2, accessed 2026-11-07
- ML evidence for S, T and L: `research/ml/other-instruments-feasibility.md` (its own source list)
