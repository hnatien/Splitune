---
title: Target personas
workstream: users
last_researched: 2026-10-20
confidence: medium
---

# Target personas

## TL;DR
- Six evidence-grounded archetypes, not invented individuals: adult beginner guitarist, returning hobbyist pianist, self-taught bassist learning for a band, drummer learning covers, teen guitarist, and a *provisional* singer. The guitar, bass and teen personas rest on the strongest evidence; the **drummer is medium-low and the singer is low** (thin evidence, flagged below).
- The common thread is a time-poor hobbyist, not a future professional. In Fender's 2021 survey 67% of new guitarists have full-time careers and treat guitar as a hobby, and 53% practise two hours a week or less ([Loudwire](https://loudwire.com/study-who-are-16-million-americans-learned-play-guitar-last-two-years/)). Design for 15-30 minute sessions.
- Most want to **play songs**, not complete a curriculum: 61% of beginner/aspirational players in Fender's 2018 research wanted to learn to play songs for themselves rather than to pursue a music career ([12fret reprint of Fender release](https://archive.12fret.com/?p=90708)).
- Willingness to pay is real but price-anchored low and billing-sensitive: competitors sit at roughly USD 40-60/year for utility tools (Moises, Chordify, Ultimate Guitar) and USD 120-180/year for guided curricula (Simply Piano, Melodics), and billing/cancellation is the most frequent complaint on review sites (see `users/voice-of-customer-pain-points.md`).
- The "90% of beginners quit in year one" figure is a CEO statement with no published methodology; use it as motivation for retention design, not as a measured rate.

## Findings

### The "90% quit" claim: provenance and caveats
- **Where it comes from.** The earliest source I could open is a 2017 Fortune piece (based on Reuters reporting) in which Fender CEO Andy Mooney says 45% of Fender guitars sell to first-time players and that 90% of them abandon the instrument within a year and never become repeat customers ([Fortune, 2017-07-06](https://fortune.com/2017/07/06/guitar-legend-fender-is-getting-into-the-online-learning-business/)). The statement was made while launching Fender Play (USD 19.99/month after a free intro, per the same article).
- **No methodology published.** The article gives no sample, period or definition of "abandon"; Mooney only says the company "gathered the data". I did not find a Fender press release or report that states the figure with a method (Fender's newsroom pages returned HTTP 403 to my fetch tool, so a primary release containing it may exist unseen; see Open questions).
- **Caveats (inference).** (1) It is a vendor executive's claim made to promote a learning product. (2) The wording ties abandonment to *not becoming repeat customers*, which suggests a purchase-behaviour proxy rather than an observed cessation of playing (my reading; unconfirmed). (3) It concerns guitar buyers at one brand. (4) Fender's own later survey measures something different: about one in four new players say they have stagnated ([Loudwire](https://loudwire.com/study-who-are-16-million-americans-learned-play-guitar-last-two-years/)). Neither figure can be reconciled with 90% without the underlying data.
- **Better-grounded attrition evidence.** Fender's 2018 research (U.S. and U.K.; Statista cites over 20,000 guitar players, [Statista](https://statista.com/chart/amp/15830/whos-learning-the-guitar-and-why)) reports that nearly half of beginners quit due to time constraints and 33% of beginners said they were not growing skills as fast as they expected ([12fret reprint](https://archive.12fret.com/?p=90708)); the reprint does not give sample size, dates or the exact "nearly half" figure. Academic work on why people stop is consistent: Evans, McPherson & Davidson found that deciding to stop playing was associated with reduced feelings of **competence, relatedness and autonomy** relative to peak engagement ([Psychology of Music 41(5), 2013](https://selfdeterminationtheory.org/wp-content/uploads/2021/06/2013_EvansMcPhersonDavidson_Roleof.pdf)); that sample is people who began as school-age learners, so transfer to adult YouTube learners is by analogy. A 2024 study of 140 Austrian music-school students (mean age ~13) found autonomous motivation had the strongest link to lower dropout tendency (r = -0.50), though it measured *tendency*, cross-sectionally ([Wieser et al., Frontiers in Psychology](https://pmc.ncbi.nlm.nih.gov/articles/PMC11337299/)).

### Population-level evidence used across personas
| Fact | Value | Source (tier) |
|---|---|---|
| New U.S. guitar learners, last two years (to mid-2021) | ~16M, 7% of U.S. ages 13-64 | Fender/YouGov 2021 via [Digital Music News](https://www.digitalmusicnews.com/?p=195046) (3, company data) |
| Survey size / fieldwork | 10,644 respondents; fieldwork May-June 2021 (per DMN; Loudwire says "over 10,000", dates not stated) | [DMN](https://www.digitalmusicnews.com/?p=195046), [Loudwire](https://loudwire.com/study-who-are-16-million-americans-learned-play-guitar-last-two-years/) |
| Age | 72% of new players are 13-34 | same |
| Pandemic as driver | 62% cite lockdowns as a major motivator; 77% had extra time | same |
| Weekly practice | 53% practise 2 hours or less per week; beginners think ~4 h/week for 1-2 years would make them "good" | [Loudwire](https://loudwire.com/study-who-are-16-million-americans-learned-play-guitar-last-two-years/) |
| Stagnation | ~1 in 4 new players have stagnated | same |
| Prior instrument | Most had tried another instrument first (piano/keys and bass most common) | [DMN](https://www.digitalmusicnews.com/?p=195046) |
| Video content habit | 58% use TikTok weekly or more; 67% watch guitar content at least weekly (19% daily). A Music Inc. report words the 67% as "video platforms like TikTok", which conflicts with Fender's own wording of TikTok at 58% | [DMN](https://www.digitalmusicnews.com/?p=195046), [Music Inc.](https://www.musicincmag.com/news/detail/fender-launches-beginner-hub) |
| Gender | 2018 research: women are 50% of beginner and aspirational players (U.S./U.K.). The 2021 coverage I opened gives no gender breakdown | [Loudwire 2018](https://loudwire.com/fender-study-women-50-percent-beginning-players/) |
| Motivation (2018) | 72% wanted a life skill or self-improvement; 61% wanted to learn songs for themselves rather than to pursue a music career; 42% see guitar as part of identity; 46% want to make music with others | [12fret reprint](https://archive.12fret.com/?p=90708) |
| How Americans learned (U.S. adults, 2022, n=3,000) | Guitar: 36% self-taught, 39% lessons/class, 25% informal. Electric guitar 52%, electric bass 50%, drums 47% self-taught; piano 60% lessons/class | [YouGov](https://yougov.com/en-us/articles/43512-young-americans-increasingly-exposed-music) (3) |
| Latent demand | 69% of Americans (12+) would like to learn an instrument; 85% of non-players wish they had learned (Gallup for NAMM, 2009) | [NAMM](https://www.namm.org/news/press-releases/new-gallup-survey-namm-reflects-majority-americans-agree-many-benefits-playing) (2, dated) |

Gaps: I could not find a current (2024-2026) NAMM Global Report or consumer participation dataset openly; the NAMM/Gallup figures above are 2006-2009. Recent adult-beginner attrition rates by instrument are not available in open sources I could open.

### Persona summary

| # | Persona | Instrument | Level | Primary evidence strength | Core job | WTP signal |
|---|---|---|---|---|---|---|
| P1 | Adult beginner learning covers from YouTube | Guitar | Beginner | Strong (Fender 2018/2021, YouGov, reviews) | Play a recognisable song start-to-finish | Low-mid; ~USD 40-60/yr utility tools; resents surprise billing |
| P2 | Returning hobbyist pianist | Piano/keys | Lapsed-intermediate | Medium (YouGov, app reviews, vendor article) | Get back to playing songs they love | Mid; accepts USD 100-150/yr for guided apps |
| P3 | Self-taught bassist learning for a band | Bass | Beginner-intermediate | Strong for pain points (BassBuzz forum), medium for size | Learn the *actual* bass line by rehearsal date | Mid; already pays for tabs (UG ~USD 25-40/yr) and stem tools |
| P4 | Hobbyist drummer learning covers | Drums | Beginner-intermediate | Medium-low (YouGov, vendor and review pages) | Play along to a song with the drums removed | Mid-high for guided drum apps (USD 180/yr Melodics) |
| P5 | Teen self-improver | Guitar (+ bass/keys) | Beginner | Medium (Fender 2021, ethnography, Wieser) | Learn the riff of a song they just heard | Low personally; payer is often a parent (inferred) |
| P6 | Provisional: singer learning a cover | Vocals | Beginner | **Low** (research on inhibition only; no app-review base) | Sing a cover in tune without embarrassment | Unknown |

---

### P1. Adult beginner guitarist learning covers from YouTube
- **Goals.** Play 3-5 favourite songs recognisably; build a "life skill" and identity as someone who plays. Wants songs, not scales.
- **Skill level.** 0-12 months; knows a handful of open chords; reads tab slowly; cannot hear individual parts in a mix.
- **Motivation.** Self-improvement and songs. 72% of beginner/aspirational players cited a life skill/self-betterment; 61% wanted to play songs for themselves rather than to pursue a music career ([12fret reprint](https://archive.12fret.com/?p=90708)). Intrinsic, autonomy-driven motivation sustains learning ([Wieser et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC11337299/)).
- **Context of practice.** Home, evenings, 15-30 min; phone or tablet on a stand or on the couch; guitar in hands (hands busy, can't tap precisely). 53% practise <=2 h/week ([Loudwire](https://loudwire.com/study-who-are-16-million-americans-learned-play-guitar-last-two-years/)). See `ux/hands-busy-and-device-context.md`.
- **Frustrations with current tools.**
  - Tabs/chords unverified: a reviewer on the Ultimate Guitar App Store page warns you must check each song because chords can be wrong ([App Store, 2024 review](https://apps.apple.com/us/app/ultimate-guitar-tabs-chords/id357828853)); Chordify users report auto-detected chords "often wrong" with no signal it wasn't human-checked ([App Store, 2023 review](https://apps.apple.com/us/app/-/id1073624757)).
  - Paywalled practice features: on Chordify, slow-down and loop are Premium ([App Store listing](https://apps.apple.com/us/app/-/id1073624757)); the free tier also caps daily songs ([GuitarChalk review](https://www.guitarchalk.com/chordify-review/)).
  - Billing surprises: annual charges after trial cancellation are the leading Trustpilot theme for [Yousician](https://www.trustpilot.com/review/yousician.com) and [Ultimate Guitar](https://www.trustpilot.com/review/ultimate-guitar.com) (anecdotal, self-selected).
  - Curriculum apps teach exercises, not songs: a Yousician reviewer found lessons fragmented and could not play a full song ([Trustpilot, Apr 2026](https://www.trustpilot.com/review/yousician.com)).
- **Willingness to pay.** Observed price points: Chordify subscriptions listed at USD 8-9/month and USD 42-54/year ([App Store](https://apps.apple.com/us/app/-/id1073624757)); Ultimate Guitar Pro USD 9.99/month and USD 29.99-59.99/year ([App Store](https://apps.apple.com/us/app/ultimate-guitar-tabs-chords/id357828853)); Moises Premium USD 5.99/month or 39.99/year ([App Store](https://apps.apple.com/app/apple-store/id1515796612)). Inference: ~USD 40-60/year is the accepted anchor for a utility tool; a monthly option is expected. Ratings counts (Moises 28K, Chordify 34K, UG 480K) show reach but not conversion. See `market/pricing-and-business-models.md`.
- **"Learn this song from a video" job.** "When I find a cover or live performance on YouTube that I want to play, I want to see/hear exactly which chords and strumming it uses at a speed I can follow, so I can play it start to finish this week."
- **Evidence.** [Fender 2018 (12fret reprint)](https://archive.12fret.com/?p=90708); [Fender/YouGov 2021 (Loudwire)](https://loudwire.com/study-who-are-16-million-americans-learned-play-guitar-last-two-years/); [YouGov 2022 learning methods](https://yougov.com/en-us/articles/43512-young-americans-increasingly-exposed-music); [Evans et al. 2013](https://selfdeterminationtheory.org/wp-content/uploads/2021/06/2013_EvansMcPhersonDavidson_Roleof.pdf); app-store/Trustpilot links above (tier 4).
- **Confidence.** High on goals/context; medium on WTP.

### P2. Returning hobbyist pianist
- **Goals.** Rebuild childhood skill; play pop/film songs they choose rather than graded pieces; occasionally play for family.
- **Skill level.** Lapsed intermediate: reads notation, rusty hands, can't sight-read fast; wants to jump to real arrangements.
- **Motivation.** Autonomy over repertoire and pacing is the return trigger: a Roland article on lapsed players emphasises choosing songs you love and setting one big goal ([Roland, 2022](https://articles.roland.com/lapsed-player-returning-to-the-piano/); vendor source, no data). Piano is the instrument adults most often learned via formal lessons (60% lessons/class) and was learned by 37% of over-65s ([YouGov 2022](https://yougov.com/en-us/articles/43512-young-americans-increasingly-exposed-music)), which is the pool of "lapsed" learners (inference). Nearly all non-players (85%) wish they had learned ([NAMM/Gallup 2009](https://www.namm.org/news/press-releases/new-gallup-survey-namm-reflects-majority-americans-agree-many-benefits-playing)).
- **Context.** Home piano or digital keyboard, evenings/weekends; tablet on the music stand; hands busy but can use a foot pedal or large-target UI (inferred).
- **Frustrations.**
  - Content removal: Flowkey subscribers report songs expiring or disappearing, including one practised for nearly a year ([Trustpilot, Sep-Oct 2026](https://www.trustpilot.com/review/flowkey.com)).
  - Note detection misses: "App doesnt recognise my piano notes" ([Simply Piano on Trustpilot, May 2026](https://www.trustpilot.com/review/simplypiano.com)); flowkey correct notes sometimes not registered ([Trustpilot](https://www.trustpilot.com/review/flowkey.com)).
  - Level mismatch: apps either too basic ("child's play", [Trustpilot](https://www.trustpilot.com/review/simplypiano.com)) or force slow tempo on a returning player ([flowkey](https://www.trustpilot.com/review/flowkey.com)).
  - Price/trial friction on Simply Piano (USD 119.99-149.99/year tiers per the [App Store listing](https://apps.apple.com/us/app/simply-piano-learn-piano-fast/id1019442026); billing complaints on [Trustpilot](https://www.trustpilot.com/review/simplypiano.com), small unrepresentative sample of 9 reviews).
- **WTP.** Revealed: Simply Piano has ~858K App Store ratings at USD 119.99+/year ([App Store](https://apps.apple.com/us/app/simply-piano-learn-piano-fast/id1019442026)). Pianists accept the highest annual prices in the set (inference from listings). Splitune's angle would be arrangement-from-video, not a curriculum.
- **Job.** "When I hear a piece I love in a YouTube performance, I want to see the actual notes at a tempo my hands can handle, so I can play it without hunting for sheet music."
- **Evidence.** Links above plus `ml/transcription-piano.md` for transcription feasibility. **Confidence: medium** (relies on one vendor article, one survey and review samples).

### P3. Self-taught bassist learning songs for a band
- **Goals.** Play the *actual* bass line (not just roots) for a rehearsal or gig; verify what the original bassist does.
- **Skill level.** Beginner to intermediate; can follow tab; weak at hearing bass in a mix.
- **Motivation.** Social/functional: playing with others; credibility in a band. 46% of Fender 2018 players want to make music with others ([12fret](https://archive.12fret.com/?p=90708)). Half of electric-bass players are self-taught (50%, [YouGov 2022](https://yougov.com/en-us/articles/43512-young-americans-increasingly-exposed-music)); bass is one of the most common prior instruments of new guitarists ([DMN](https://www.digitalmusicnews.com/?p=195046)).
- **Context.** Rehearsal-room or home; laptop/phone; headphones through an audio interface; hands on the bass.
- **Frustrations (strongest evidence base).**
  - Can't hear the bass: a learner needed originals' bass lines for rehearsal, could hear chords and melody but not bass; Moises stems were "pretty blurry", other posters called bass stems often muddy and Moises muddier on live recordings ([BassBuzz, Oct 2025](https://forum.bassbuzz.com/t/how-can-i-make-the-bassline-more-audible/84933)). Another thread notes people are trained to track melody, not bass lines ([BassBuzz, 2020](https://forum.bassbuzz.com/t/learning-a-new-song/5705)).
  - Separation limits: Moises performed poorly on bass lines that go very low; tools also struggle when bass plays melodically in jazz/fusion ([BassBuzz, 2022-2024](https://forum.bassbuzz.com/t/app-to-isolate-bass-tracks-in-songs/30572)).
  - Tabs are unreliable: Songsterr tabs get the main groove but miss fills and use suboptimal fingerings ([BassBuzz, 2025](https://forum.bassbuzz.com/t/tab-sites/71538?page=2)); members call Songsterr good but inaccurate on many songs and a returning bassist (after 34 years) distrusts online tabs ([BassBuzz, 2026](https://forum.bassbuzz.com/t/bass-tab-transcription-service/92595)).
  - Source-audio friction: the same threads discuss downloading tracks as MP3/FLAC (including Spotify-to-MP3 tools) to feed separation software, which has legal implications (see `legal/youtube-copyright-and-platform-policy.md`).
- **WTP.** Already pays for human transcriptions (basslessons.be packs ~EUR 5, UG about USD 25/year per forum posters; Bass Tabs by Jason USD 29.95 one-time) ([BassBuzz 2026](https://forum.bassbuzz.com/t/bass-tab-transcription-service/92595), [BassBuzz 2025](https://forum.bassbuzz.com/t/tab-sites/71538?page=2)). Willingness to pay for accuracy is demonstrated; anecdotal.
- **Job.** "When I have to learn a bass line from a recording, I want to hear the bass clearly and see the notes with an indication of how sure the transcription is, so I can play it correctly at rehearsal."
- **Evidence.** The BassBuzz threads (tier 4, anecdotal, forum of a single instructor's student community, skews to beginners); [YouGov](https://yougov.com/en-us/articles/43512-young-americans-increasingly-exposed-music); [Fender 2018](https://archive.12fret.com/?p=90708). **Confidence: medium-high** on pain points, medium on segment size.

### P4. Hobbyist drummer learning covers
- **Goals.** Drum along to original songs with the drums removed; learn the groove and fills; record covers.
- **Skill level.** Beginner to intermediate; reads some notation or follows videos; no teacher (47% of drummers self-taught, 27% lessons, 24% informal; [YouGov 2022](https://yougov.com/en-us/articles/43512-young-americans-increasingly-exposed-music)).
- **Motivation.** Playing along and sharing (inference from vendor content: Drumeo notes drumless tracks are popular for filming and sharing covers; Drumeo is a Moises partner, so this is commercially linked, [Drumeo](https://www.drumeo.com/beat/moises-drumless-tracks-tutorial/)).
- **Context.** Practice room or garage; acoustic kit is loud (headphones) or e-kit with MIDI; hands and feet fully occupied, so tapping a screen is impractical (inferred; see `ux/hands-busy-and-device-context.md`).
- **Frustrations.**
  - Library churn: a Drumeo reviewer says the library lost more than 4,000 songs in July 2024 and some songs are locked behind extra fees for lifetime members ([Trustpilot, 2025-2026](https://www.trustpilot.com/review/drumeo.com)).
  - Feedback leniency: a Melodics reviewer says the app awards a green score for strikes that would sound sloppy and wants a stricter setting; another wants to save custom phrases from a band set list ([App Store](https://apps.apple.com/us/app/melodics-real-drum-learning/id6504540940)).
  - Drum stems are one lump: a lalal.ai reviewer notes drums are not split into snare/kick ([Trustpilot](https://www.trustpilot.com/review/lalal.ai)). See `ml/transcription-drums.md`.
- **WTP.** Melodics lists USD 34.99/month or 179.99/year ([App Store](https://apps.apple.com/us/app/melodics-real-drum-learning/id6504540940)); the highest price point in the set, so drummers who commit pay for guided content (inference; 630 ratings, small base).
- **Job.** "When I want to play a song's drum part, I want the drums isolated and removable and a readable pattern at a slow tempo, so I can play along and see if I'm in time."
- **Evidence.** Above links. **Confidence: medium-low** (no independent drummer survey or forum evidence found; Reddit r/drums was not accessible, see Open questions).

### P5. Teen self-improver (13-19)
- **Goals.** Learn the riff or chorus of a song they just heard (TikTok/YouTube) fast; impress friends; join a school band.
- **Skill level.** Beginner; learns visually by copying fingers; low theory.
- **Motivation.** Fender 2021 notes that teens (with women and adults 40+) describe themselves as "self-improvers" ([Loudwire](https://loudwire.com/study-who-are-16-million-americans-learned-play-guitar-last-two-years/)); 72% of new players are 13-34 ([DMN](https://www.digitalmusicnews.com/?p=195046)). Guitar is most common among 18-29-year-olds (23%; [YouGov](https://yougov.com/en-us/articles/43512-young-americans-increasingly-exposed-music)).
- **Context.** Bedroom, phone, short bursts; phones used for tabs/video even during group rehearsal. In an ethnographic study at a Dublin rock school (2021), students watched and copied YouTube riff videos, and a coach used a phone tab sheet to teach a riff ([Rush, IASPM Journal 13(3), 2023](https://iaspmjournal.net/index.php/IASPM_Journal/article/download/1269/1975/9547)). Small qualitative study; not generalisable.
- **Frustrations.** Riffs learned in isolation: a student could play a riff exactly but needed prompting to play on the downbeat with the band; coaches linked rising rhythm difficulty to YouTube-style learning (their belief, causal link unproven) ([Rush 2023](https://iaspmjournal.net/index.php/IASPM_Journal/article/download/1269/1975/9547)). Implication: teach parts *with* the isolated part and the full mix.
- **WTP.** Personally low; parent or free tier decides (inference). Parental involvement is the strongest direct predictor of dropout tendency in the Austrian music-school sample ([Wieser et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC11337299/)); keep family/consent flows in mind (privacy and age rules are outside this doc; see `legal/youtube-copyright-and-platform-policy.md` for platform terms only).
- **Job.** "When a song's riff goes viral, I want to see how to play it at half speed in time with the track, so I can play it with my friends tonight."
- **Evidence.** As cited. **Confidence: medium.**

### P6 (provisional). Singer learning a cover
- **Goals.** Learn melody, phrasing and harmonies of a favourite song; sing in tune; perform at open mic or karaoke.
- **Evidence is thin.** I found no singer-specific survey or review base I could open (searches mostly returned vendor pages; Reddit was inaccessible). What is documented: adult non-singers' reluctance is predicted by low self-rated skill, low family engagement, and believing singing is a fixed ability (n=238); a 10-month lesson sub-study (n=20, ages 23-71) reduced sensitivity to social judgment and shifted beliefs towards "improvable" ([Wise & Halpern, Music Perception 41(4), 2024](https://digitalcommons.bucknell.edu/fac_journ/2148)). Implication (inference): private, non-judgmental practice and visible incremental improvement matter as much as accuracy.
- **Context/frustrations/WTP.** Unverified. Treat as hypotheses to test in interviews (see Open questions).
- **Job.** "When I want to sing a song, I want to hear the lead vocal alone and see my pitch against it, so I can learn it without a teacher."
- **Confidence: low.**

## Implications for Splitune
- **Primary launch persona: P1 (guitar), then P3 (bass).** They have the strongest evidence of the exact need (isolate, verify, slow down) and the clearest accuracy-driven willingness to pay. P2 is the best premium candidate; P4/P6 need research before committing roadmap.
- **Short sessions, hands busy.** Design for 15-30 minutes with large controls, loop/slow-down defaults and resume-where-I-left-off (`ux/hands-busy-and-device-context.md`, `ux/practice-tool-patterns.md`).
- **Trust is the product.** Every instrument persona complains about wrong tabs/chords or muddy separation; show confidence and let the user audition the isolated part against the mix (`users/user-journeys-and-flows.md`).
- **Price/billing hygiene is a feature.** Clear trials, renewal reminders, in-app cancellation, no feature removal after purchase (`users/voice-of-customer-pain-points.md`).
- **Retention design** should target competence, autonomy and relatedness (Evans et al.) and the stagnation segment (about 1 in 4); see `ux/onboarding-retention-motivation.md`. Competitors: `market/competitor-landscape.md`.

## Open questions
- Verify the 90% figure and the 2018/2021 Fender numbers against Fender's primary releases (newsroom pages returned 403) or ask Fender for methodology.
- Obtain current NAMM Global Report / consumer participation data (not openly found) and segment sizes per instrument.
- Reddit communities named in the task card (r/guitar, r/guitarlessons, r/learnguitar, r/piano, r/pianolearning, r/drums, r/Bass, r/singing, r/WeAreTheMusicMakers) were not reachable by the research tools; run a manual or API-based sample to validate P2, P4, P6.
- Interview 8-10 users per priority persona; test price anchors (monthly vs annual vs per-song credits).
- Do YouTube-first learners really have worse rhythm (Rush's coaches' hypothesis)? Needs a controlled study.

## Sources
- [Fortune: Fender is getting into online learning](https://fortune.com/2017/07/06/guitar-legend-fender-is-getting-into-the-online-learning-business/) — tier 3, accessed 2026-10-20
- [12fret archive: Fender "Guitar Isn't Dead" research](https://archive.12fret.com/?p=90708) — tier 3 (reprint of company release), accessed 2026-10-20
- [Loudwire: Fender study, women 50% of beginners](https://loudwire.com/fender-study-women-50-percent-beginning-players/) — tier 3, accessed 2026-10-20
- [Statista: Who's learning the guitar and why](https://statista.com/chart/amp/15830/whos-learning-the-guitar-and-why) — tier 3, accessed 2026-10-20
- [Loudwire: 16 million Americans learned guitar](https://loudwire.com/study-who-are-16-million-americans-learned-play-guitar-last-two-years/) — tier 3, accessed 2026-10-20
- [Digital Music News: Fender 2021 survey](https://www.digitalmusicnews.com/?p=195046) — tier 3, accessed 2026-10-20
- [Music Inc.: Fender launches Beginner Hub](https://www.musicincmag.com/news/detail/fender-launches-beginner-hub) — tier 3, accessed 2026-10-20
- [YouGov: Young Americans increasingly exposed to music](https://yougov.com/en-us/articles/43512-young-americans-increasingly-exposed-music) — tier 3, accessed 2026-10-20
- [NAMM: Gallup survey, benefits of playing instruments (2009)](https://www.namm.org/news/press-releases/new-gallup-survey-namm-reflects-majority-americans-agree-many-benefits-playing) — tier 2, accessed 2026-10-20
- [Evans, McPherson & Davidson 2013, Psychology of Music](https://selfdeterminationtheory.org/wp-content/uploads/2021/06/2013_EvansMcPhersonDavidson_Roleof.pdf) — tier 1, accessed 2026-10-20
- [Wieser et al. 2024, Frontiers in Psychology](https://pmc.ncbi.nlm.nih.gov/articles/PMC11337299/) — tier 1, accessed 2026-10-20
- [Rush 2023, IASPM Journal](https://iaspmjournal.net/index.php/IASPM_Journal/article/download/1269/1975/9547) — tier 1, accessed 2026-10-20
- [Wise & Halpern 2024, Music Perception (Bucknell repository)](https://digitalcommons.bucknell.edu/fac_journ/2148) — tier 1, accessed 2026-10-20
- [Roland: Lapsed player, returning to the piano](https://articles.roland.com/lapsed-player-returning-to-the-piano/) — tier 2 (vendor), accessed 2026-10-20
- [Moises App Store listing](https://apps.apple.com/app/apple-store/id1515796612) — tier 2/4, accessed 2026-10-20
- [Chordify App Store listing](https://apps.apple.com/us/app/-/id1073624757) — tier 2/4, accessed 2026-10-20
- [Ultimate Guitar App Store listing](https://apps.apple.com/us/app/ultimate-guitar-tabs-chords/id357828853) — tier 2/4, accessed 2026-10-20
- [Simply Piano App Store listing](https://apps.apple.com/us/app/simply-piano-learn-piano-fast/id1019442026) — tier 2/4, accessed 2026-10-20
- [Melodics App Store listing](https://apps.apple.com/us/app/melodics-real-drum-learning/id6504540940) — tier 2/4, accessed 2026-10-20
- [Trustpilot: Yousician](https://www.trustpilot.com/review/yousician.com) — tier 4, accessed 2026-10-20
- [Trustpilot: Ultimate Guitar](https://www.trustpilot.com/review/ultimate-guitar.com) — tier 4, accessed 2026-10-20
- [Trustpilot: flowkey](https://www.trustpilot.com/review/flowkey.com) — tier 4, accessed 2026-10-20
- [Trustpilot: Simply Piano](https://www.trustpilot.com/review/simplypiano.com) — tier 4, accessed 2026-10-20
- [Trustpilot: Drumeo](https://www.trustpilot.com/review/drumeo.com) — tier 4, accessed 2026-10-20
- [Trustpilot: lalal.ai](https://www.trustpilot.com/review/lalal.ai) — tier 4, accessed 2026-10-20
- [GuitarChalk: Chordify review](https://www.guitarchalk.com/chordify-review/) — tier 4, accessed 2026-10-20
- [Drumeo: Moises drumless tracks tutorial](https://www.drumeo.com/beat/moises-drumless-tracks-tutorial/) — tier 2 (partner/vendor), accessed 2026-10-20
- [BassBuzz: How can I make the bassline more audible?](https://forum.bassbuzz.com/t/how-can-i-make-the-bassline-more-audible/84933) — tier 4, accessed 2026-10-20
- [BassBuzz: App to isolate bass tracks in songs](https://forum.bassbuzz.com/t/app-to-isolate-bass-tracks-in-songs/30572) — tier 4, accessed 2026-10-20
- [BassBuzz: Learning a new song](https://forum.bassbuzz.com/t/learning-a-new-song/5705) — tier 4, accessed 2026-10-20
- [BassBuzz: Tab sites](https://forum.bassbuzz.com/t/tab-sites/71538?page=2) — tier 4, accessed 2026-10-20
- [BassBuzz: Bass Tab Transcription Service](https://forum.bassbuzz.com/t/bass-tab-transcription-service/92595) — tier 4, accessed 2026-10-20
