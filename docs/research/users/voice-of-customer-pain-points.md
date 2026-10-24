---
title: Voice of customer and pain points
workstream: users
last_researched: 2026-10-20
confidence: medium
---

# Voice of customer and pain points

## TL;DR
- Eight pain-point themes recur across Trustpilot, App Store listings and one accessible instrument forum (BassBuzz): separation quality, transcription/chord accuracy, billing and paywalls, catalog and content removal, detection/feedback accuracy, speed and reliability, hands-busy UX, and motivation/progress.
- **Trust in output** (accuracy of tabs/chords, cleanliness of stems) and **billing/cancellation** are the most frequent and most severe themes in the evidence I could open. Processing time and hands-busy UX are plausible but under-evidenced.
- All community evidence here is anecdotal (tier 4) and skewed: Trustpilot over-samples unhappy customers (Moises 1.7/5 from 67 reviews, with about 75% one-star, while its App Store rating is 4.7 from 28K ratings), and BassBuzz is one instructor's student community. Use themes, not rates.
- **Coverage gap.** Reddit (r/guitar, r/guitarlessons, r/learnguitar, r/piano, r/pianolearning, r/drums, r/Bass, r/singing, r/WeAreTheMusicMakers) could not be fetched by the research tools, and several other forums (JustinGuitar Community, TalkBass, The Fretboard, Jazz Guitar Forum) returned HTTP 403. This document therefore does not contain Reddit threads; see Open questions.
- The frequency/severity table at the end is my estimate, not a measurement.

## Findings

### Evidence base and bias
| Source | What I could open | Bias |
|---|---|---|
| Trustpilot (Moises, Yousician, Chordify, Simply Piano, JoyTunes, Ultimate Guitar, Songsterr, flowkey, Drumeo, lalal.ai) | Review excerpts and scores as of Oct 2026 | Self-selected; some profiles "unclaimed" or not inviting reviews; Trustpilot does not verify claims. Chordify 4.8/5 (2,201), flowkey 4.0 (417), Yousician 3.9 (1,322), Ultimate Guitar 3.1 (2,004), Drumeo 2.4 (27), Songsterr 3.4 (13), Simply Piano 2.4 (9), JoyTunes 1.8 (29) |
| App Store listings | Rating, IAP prices, 3-4 visible reviews per app | Visible review sample is tiny and not random |
| BassBuzz forum | 7 threads, 2020-2026 | Bass-only; beginner-heavy; one instructor's community |
| Academic | Ethnography, surveys, SDT studies | School-age or music-school populations; transfers by analogy |

### 1. Quality of separation
- **Muddy or blurry bass, worse on live recordings.** "Pretty blurry" after trying Moises; others say bass stems are often muddy ([BassBuzz, Oct 2025](https://forum.bassbuzz.com/t/how-can-i-make-the-bassline-more-audible/84933)). Quality "varied", bass low/murky ([BassBuzz, Apr 2022](https://forum.bassbuzz.com/t/app-to-isolate-bass-tracks-in-songs/30572)).
- **Hard cases.** Very low bass lines and melodic or jazz/fusion bass were poorly separated by Moises and Fadr ([BassBuzz, Apr 2024](https://forum.bassbuzz.com/t/app-to-isolate-bass-tracks-in-songs/30572)).
- **Artefacts.** Output "overcompressed" and unsuitable for serious production ([Moises Trustpilot, Apr 2024](https://nl.trustpilot.com/review/moises.ai?page=3)); an instrumental with odd filtering and compression, judged worse than Logic's result ([lalal.ai Trustpilot, Oct 2026](https://www.trustpilot.com/review/lalal.ai)); results vary by project ([same](https://www.trustpilot.com/review/lalal.ai)).
- **Granularity.** Drums are not split into snare/kick ([lalal.ai Trustpilot](https://www.trustpilot.com/review/lalal.ai)).
- **Positive counterweight.** App Store reviewers praise bass isolation and loop/slow-down ([Moises App Store](https://apps.apple.com/app/apple-store/id1515796612)); Trustpilot reviewers rate separation "pretty good" while complaining about speed and crashes ([Moises Trustpilot, Sep 2026](https://nl.trustpilot.com/review/moises.ai?page=3)).
- **Tier 1-3 corroboration.** Model-level quality limits are covered in `research/ml/source-separation.md` and `research/ml/source-separation-model-comparison.md`; I did not duplicate them. Vendor material claims one-click results without metrics ([Moises](https://moises.ai/made-for/guitarists/)).

### 2. Transcription and chord accuracy ("tabs are wrong")
- **Community tabs.** Songsterr gets the main groove but misses/garbles fills and groove variations; fingerings often suboptimal ([BassBuzz, Feb-Mar 2025](https://forum.bassbuzz.com/t/tab-sites/71538?page=2)). Disagreement on how wrong is "wrong": some say a tab is only wrong if you can hear the error ([BassBuzz, Aug-Oct 2024](https://forum.bassbuzz.com/t/bassborg-collective-thoughts-on-songsterr/60757?page=2)).
- **Official vs free.** One member found free UG tabs weak and hired a freelancer; others say official transcriptions are generally good ([BassBuzz, Apr 2024](https://forum.bassbuzz.com/t/actual-tabs-vs-bass-covers)). Returning bassist "doesn't trust online tabs" ([BassBuzz, Jan 2026](https://forum.bassbuzz.com/t/bass-tab-transcription-service/92595)).
- **Auto chords.** "Chords are sometimes wrong, but this helps with ear" (Chordify, 2019) and "auto-detected chords were often wrong; not clear they weren't checked by a human" (2023) ([Chordify App Store](https://apps.apple.com/us/app/-/id1073624757)); on Trustpilot, chords "by and large correct" but lyric errors ([Chordify Trustpilot, Sep 2026](https://www.trustpilot.com/review/chordify.net)); chord changes sometimes displaced, easy to fix by ear ([GuitarChalk review](https://www.guitarchalk.com/chordify-review/)).
- **AI backlash.** Songsterr reviewers dislike "AI garbage edits over official tabs" and AI transcription, while another transcriber reports about 85% correct ([Songsterr Trustpilot, 2026](https://www.trustpilot.com/review/songsterr.com)).
- **Key/chord detection errors in Moises.** Key detection and chord roots sometimes inaccurate ([Moises App Store review, Aug 2024](https://apps.apple.com/app/apple-store/id1515796612)).
- **Corroboration.** Model accuracy is covered in `research/ml/transcription-guitar-and-bass-tabs.md` and `research/ml/chords-beats-key-structure.md`.

### 3. Pricing, paywalls and billing
- **Paywall at the door.** Most features locked on the free tier ([Moises Trustpilot, Oct 2024](https://nl.trustpilot.com/review/moises.ai?page=3)); basic features switched to paid without warning ([Moises App Store, Nov 2024](https://apps.apple.com/app/apple-store/id1515796612)); official tabs and auto-scroll behind Pro ([UG App Store reviews, 2019-2022](https://apps.apple.com/us/app/ultimate-guitar-tabs-chords/id357828853)); practice features (slow, loop, transpose) behind Chordify Premium and a daily song limit ([GuitarChalk](https://www.guitarchalk.com/chordify-review/)).
- **Feature downgrades.** Premium stem limit reduced from 10 to 4 pushing users to Pro ([Moises Trustpilot, Feb 2025](https://nl.trustpilot.com/review/moises.ai?page=3)); lifetime members hit extra fees for previously included songs ([Drumeo Trustpilot, Sep 2026](https://www.trustpilot.com/review/drumeo.com)); lifetime access not honoured ([Yousician Trustpilot, Aug 2026](https://www.trustpilot.com/review/yousician.com)).
- **Trial-to-annual surprises.** Annual charges after a same-day trial cancellation, no renewal reminder, USD 148 or EUR 120 unexpected charges ([Yousician](https://www.trustpilot.com/review/yousician.com), [Ultimate Guitar](https://www.trustpilot.com/review/ultimate-guitar.com), [JoyTunes](https://www.trustpilot.com/review/joytunes.com), [Simply Piano](https://www.trustpilot.com/review/simplypiano.com)).
- **Cancellation friction.** No phone line or clear path ([UG](https://www.trustpilot.com/review/ultimate-guitar.com)); cancellation must use the sign-up channel (same); chatbot-only support ([Moises](https://nl.trustpilot.com/review/moises.ai?page=3)).
- **Price sensitivity.** Pro tier "very costly" relative to Premium ([Moises Trustpilot, Feb 2025](https://nl.trustpilot.com/review/moises.ai?page=3)); Simply Piano "expensive but worth it" ([Trustpilot, Sep 2026](https://www.trustpilot.com/review/simplypiano.com)); UG App Store reviewer "wish I could afford Pro" ([App Store 2022](https://apps.apple.com/us/app/ultimate-guitar-tabs-chords/id357828853)). Chordify reviewers say "can't beat the subscription price" ([Trustpilot, Oct 2026](https://www.trustpilot.com/review/chordify.net)).
- **Contrast.** Chordify's Trustpilot score (4.8/5, 2,201 reviews) shows billing disputes are not inevitable; the company replies to most negative reviews (per the page). Trustpilot says some profiles do not invite reviews, so scores are not comparable.
- **Corroboration.** Prices and models in `research/market/pricing-and-business-models.md`.

### 4. Catalog limits and content removal
- Songs expire or are removed from flowkey, including one practised for almost a year ([flowkey Trustpilot](https://www.trustpilot.com/review/flowkey.com)); Drumeo reportedly lost more than 4,000 songs in July 2024 and shows "unavailable due to licensing" ([Drumeo Trustpilot](https://www.trustpilot.com/review/drumeo.com)); Yousician custom content removed after DMCA takedowns ([Yousician Trustpilot, Mar 2026](https://www.trustpilot.com/review/yousician.com)); a JoyTunes reviewer suspects reduced libraries via feature testing (speculation, [Trustpilot](https://www.trustpilot.com/review/joytunes.com)).
- Gaps in genre coverage (worship/gospel; flowkey), songs the user wants not on Songsterr ([BassBuzz](https://forum.bassbuzz.com/t/bassborg-collective-thoughts-on-songsterr/60757?page=2)).
- Chordify's draw is breadth via YouTube integration ([App Store](https://apps.apple.com/us/app/-/id1073624757)).
- **Corroboration.** Licensing drivers: `research/legal/youtube-copyright-and-platform-policy.md`.

### 5. Detection and feedback accuracy
- Notes not recognised ([Simply Piano Trustpilot](https://www.trustpilot.com/review/simplypiano.com); [JoyTunes](https://www.trustpilot.com/review/joytunes.com); [flowkey](https://www.trustpilot.com/review/flowkey.com)); missed notes on the low E string above fret 5 ([Yousician, Apr 2025](https://www.trustpilot.com/review/yousician.com)); MIDI guitar backing tracks sound unmusical ([Yousician, Apr 2026](https://www.trustpilot.com/review/yousician.com)).
- Over-lenient scoring on drums ([Melodics App Store](https://apps.apple.com/us/app/melodics-real-drum-learning/id6504540940)).
- Corroboration: pitch/onset detection limits in `research/ml/pipeline-overview.md`.

### 6. Speed, reliability and tooling
- Moises described as slow and crashy; Mac sign-in problems; freezing after purchase ([Trustpilot, 2024-2026](https://nl.trustpilot.com/review/moises.ai?page=3)); UG outages and hardware incompatibility ([Trustpilot, Sep 2026](https://www.trustpilot.com/review/ultimate-guitar.com)); Chordify login problems resolved via chatbot or email ([Trustpilot](https://www.trustpilot.com/review/chordify.net)).
- Evidence for multi-minute processing waits specifically is weak; the Drumeo tutorial claims under a minute for drum removal (vendor, [Drumeo](https://www.drumeo.com/beat/moises-drumless-tracks-tutorial/)).

### 7. UX when hands are busy
- **Direct evidence is thin.** I found no review or forum thread I could open that is explicitly about hands-busy control. Indirect: auto-scroll that "jumps quickly or doesn't move" ([UG App Store, 2024](https://apps.apple.com/us/app/ultimate-guitar-tabs-chords/id357828853)); Moises sidebar disliked ([Trustpilot, Jan 2025](https://nl.trustpilot.com/review/moises.ai?page=3)); iPad speaker playback complaints ([BassBuzz](https://forum.bassbuzz.com/t/bassborg-collective-thoughts-on-songsterr/60757?page=2)); a Melodics reviewer cannot tell if a MIDI device is connected without playing ([App Store](https://apps.apple.com/us/app/melodics-real-drum-learning/id6504540940)); a Drumeo/Trustpilot reviewer reports a glitchy update and progress not tracked ([Trustpilot, Apr 2026](https://www.trustpilot.com/review/drumeo.com)).
- Inference: instruments occupy hands (and feet for drums); see `research/ux/hands-busy-and-device-context.md`.

### 8. Motivation and progress
- Stagnation and slow progress ([Loudwire](https://loudwire.com/study-who-are-16-million-americans-learned-play-guitar-last-two-years/); [12fret reprint](https://archive.12fret.com/?p=90708)).
- Curriculum app limits: fragmented lessons, no full songs ([Yousician, Apr 2026](https://www.trustpilot.com/review/yousician.com)); "too basic... child's play" ([Simply Piano, Dec 2025](https://www.trustpilot.com/review/simplypiano.com)); tedious exercises that did not motivate (forum summary; I could not open the JustinGuitar thread, so omitted as unverified).
- Hard-to-find progress: unclear which lessons are complete; app does not resume where left off ([flowkey, Oct 2026](https://www.trustpilot.com/review/flowkey.com)).
- Positive pattern: daily practice and streak tracking credited with improvement ([Yousician Trustpilot](https://www.trustpilot.com/review/yousician.com)); step-by-step structure with continuous feedback keeps a learner motivated ([Simply Piano, Sep 2026](https://www.trustpilot.com/review/simplypiano.com)).
- **Tier 1 corroboration.** Dropping out is associated with thwarted competence, relatedness and autonomy ([Evans et al. 2013](https://selfdeterminationtheory.org/wp-content/uploads/2021/06/2013_EvansMcPhersonDavidson_Roleof.pdf)); autonomous motivation relates to lower dropout tendency ([Wieser et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11337299/)); singing inhibition linked to believing singing is fixed ([Wise & Halpern 2024](https://digitalcommons.bucknell.edu/fac_journ/2148)).

### 9. Getting audio in (cross-cutting)
- Users look for ways to convert streaming tracks into files, then feed stem splitters ([BassBuzz, Oct 2025](https://forum.bassbuzz.com/t/how-can-i-make-the-bassline-more-audible/84933)). Splitune must provide a lawful, easy path (`research/legal/youtube-copyright-and-platform-policy.md`).

### Frequency / severity table (estimate, not measured)

Scale: frequency = how often the theme appears across the sources I opened (Low/Med/High); severity = likelihood it causes churn or abandonment (Low/Med/High). Both are my judgement from the evidence above.

| Theme | Frequency | Severity | Why this rating | Confidence |
|---|---|---|---|---|
| Billing, trial surprises, cancellation | High | High | Dominant in Trustpilot for 6 of 10 apps; direct money loss; but Trustpilot skew | Medium |
| Accuracy of tabs/chords | High | High | Repeated in forum and reviews; learners may learn wrong parts | Medium-high |
| Paywalled core practice features | High | Med-High | Slow/loop/transpose/stems gated; drives free-tier abandonment | Medium |
| Separation quality (bass muddy, live recordings) | Med | High for bass/guitar users | Concentrated in separation tool users; central to Splitune value | Medium |
| Content removal / catalog gaps | Med | High for affected users | Progress lost; breaks trust; several apps | Medium |
| Note detection / scoring accuracy | Med | Med-High | Mic-based apps; only for "check my playing" users | Medium |
| App reliability (crashes, login, outages) | Med | Med | Frequent in 1-star reviews | Medium |
| Processing time | Low-Med (unproven) | Unknown | One review; no timing data | Low |
| Hands-busy UX | Low (direct) | Unknown | Only indirect evidence; inference | Low |
| Motivation / stagnation | High (surveys) | High | About 1 in 4 stagnate; competence thwarted -> quitting | Medium |
| Source-audio acquisition friction | Low-Med | Med | Seen in one thread; legal significance high | Low |

## Implications for Splitune
- **Make accuracy visible.** Confidence and correction beat claiming accuracy (see `user-journeys-and-flows.md`, alternate flow B).
- **Do not paywall the "aha".** Keep slow/loop and a first isolated part free; charge for volume, export, advanced stems.
- **Treat billing as UX.** Renewal reminders, one-tap cancel in-app and on web, no feature removal for existing subscribers, and published refund policy. These are cheap and address the most frequent complaint.
- **Own-library design.** Let users keep loops, notes and speeds independent of catalog availability; avoid dependence on a licensed catalog that can shrink.
- **Validate hands-busy and processing-time assumptions** with a prototype before building around them.
- Retention levers: `research/ux/onboarding-retention-motivation.md`; practice tools: `research/ux/practice-tool-patterns.md`; hands-busy: `research/ux/hands-busy-and-device-context.md`; competitors: `research/market/competitor-landscape.md`; processing: `research/ml/deployment-and-inference.md`.

## Open questions
- Reddit and other 403-blocked forums need a manual or API-based pass (r/guitarlessons "slow down", r/Bass "can't hear the bass", r/piano and r/pianolearning for returning adults, r/drums and r/singing for those personas).
- Collect Google Play and recent App Store reviews at scale (the tools here showed 3-4 reviews per app) and code themes quantitatively.
- Pull Yousician's and Fender Play's App Store pages (IDs I tried returned 404).
- Test whether Trustpilot billing complaints correlate with trial design (annual default) rather than inherent price.

## Sources
- [Loudwire: Fender/YouGov 2021 survey](https://loudwire.com/study-who-are-16-million-americans-learned-play-guitar-last-two-years/) — tier 3, accessed 2026-10-20
- [12fret archive: Fender research reprint](https://archive.12fret.com/?p=90708) — tier 3, accessed 2026-10-20
- [Evans, McPherson & Davidson 2013](https://selfdeterminationtheory.org/wp-content/uploads/2021/06/2013_EvansMcPhersonDavidson_Roleof.pdf) — tier 1, accessed 2026-10-20
- [Wieser et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11337299/) — tier 1, accessed 2026-10-20
- [Wise & Halpern 2024](https://digitalcommons.bucknell.edu/fac_journ/2148) — tier 1, accessed 2026-10-20
- [Moises: guitarists](https://moises.ai/made-for/guitarists/) — tier 2 (vendor), accessed 2026-10-20
- [Drumeo: Moises drumless tracks tutorial](https://www.drumeo.com/beat/moises-drumless-tracks-tutorial/) — tier 2 (partner), accessed 2026-10-20
- [Moises App Store listing](https://apps.apple.com/app/apple-store/id1515796612) — tier 2/4, accessed 2026-10-20
- [Chordify App Store listing](https://apps.apple.com/us/app/-/id1073624757) — tier 2/4, accessed 2026-10-20
- [Ultimate Guitar App Store listing](https://apps.apple.com/us/app/ultimate-guitar-tabs-chords/id357828853) — tier 2/4, accessed 2026-10-20
- [Melodics App Store listing](https://apps.apple.com/us/app/melodics-real-drum-learning/id6504540940) — tier 2/4, accessed 2026-10-20
- [GuitarChalk: Chordify review](https://www.guitarchalk.com/chordify-review/) — tier 4, accessed 2026-10-20
- [Trustpilot: Moises](https://nl.trustpilot.com/review/moises.ai?page=3) — tier 4, accessed 2026-10-20
- [Trustpilot: Yousician](https://www.trustpilot.com/review/yousician.com) — tier 4, accessed 2026-10-20
- [Trustpilot: Chordify](https://www.trustpilot.com/review/chordify.net) — tier 4, accessed 2026-10-20
- [Trustpilot: Simply Piano](https://www.trustpilot.com/review/simplypiano.com) — tier 4, accessed 2026-10-20
- [Trustpilot: Ultimate Guitar](https://www.trustpilot.com/review/ultimate-guitar.com) — tier 4, accessed 2026-10-20
- [Trustpilot: Songsterr](https://www.trustpilot.com/review/songsterr.com) — tier 4, accessed 2026-10-20
- [Trustpilot: flowkey](https://www.trustpilot.com/review/flowkey.com) — tier 4, accessed 2026-10-20
- [Trustpilot: Drumeo](https://www.trustpilot.com/review/drumeo.com) — tier 4, accessed 2026-10-20
- [Trustpilot: JoyTunes](https://www.trustpilot.com/review/joytunes.com) — tier 4, accessed 2026-10-20
- [Trustpilot: lalal.ai](https://www.trustpilot.com/review/lalal.ai) — tier 4, accessed 2026-10-20
- [BassBuzz: How can I make the bassline more audible?](https://forum.bassbuzz.com/t/how-can-i-make-the-bassline-more-audible/84933) — tier 4, accessed 2026-10-20
- [BassBuzz: App to isolate bass tracks in songs](https://forum.bassbuzz.com/t/app-to-isolate-bass-tracks-in-songs/30572) — tier 4, accessed 2026-10-20
- [BassBuzz: Tab sites](https://forum.bassbuzz.com/t/tab-sites/71538?page=2) — tier 4, accessed 2026-10-20
- [BassBuzz: Thoughts on Songsterr](https://forum.bassbuzz.com/t/bassborg-collective-thoughts-on-songsterr/60757?page=2) — tier 4, accessed 2026-10-20
- [BassBuzz: Actual Tabs vs. Bass Covers](https://forum.bassbuzz.com/t/actual-tabs-vs-bass-covers) — tier 4, accessed 2026-10-20
- [BassBuzz: Bass Tab Transcription Service](https://forum.bassbuzz.com/t/bass-tab-transcription-service/92595) — tier 4, accessed 2026-10-20
