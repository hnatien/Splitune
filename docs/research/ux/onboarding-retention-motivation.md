---
title: Onboarding, retention, and motivation
workstream: ux
last_researched: 2026-10-20
confidence: low
---

# Onboarding, retention, and motivation

Confidence is **low**: robust peer-reviewed evidence on instrument-app onboarding and retention mechanics is scarce. Competitor churn numbers I found were from unverifiable blogs and are left out. The doc separates what sources say from what is a design hypothesis.

## TL;DR
- Splitune's natural "aha" is **hearing the learner's part isolated from a song they chose, then playing along at a slowed tempo**. No source gives a benchmark for time-to-first-aha in music apps; set an internal target (recommendation: isolated part audible within 60 seconds of choosing a song; first loop attempt within 5 minutes) and measure it.
- Motivation research (SDT) supports autonomy, informational feedback, and caution with extrinsic rewards. Gamification reviews are positive-but-conditional, with novelty effects and loss-aversion side effects.
- Streaks: Duolingo reports a 7-day streak is associated with being 3.6 times more likely to complete a course (company blog, association only, no methodology) allowing two Streak Freezes to be equipped at once produced a small (+0.38%) lift in daily active learners, and streak-milestone animations raised 7-day retention of new learners by +1.7%. A habit-formation study found a single missed day had little effect on later automaticity while many missed days cumulatively lowered it. Design **forgiving** streaks or weekly goals instead of brittle daily ones.
- Why learners quit: adult lapsed players cite competing priorities and life stage, and research on dropout in instrumental learning is long-standing (Hallam 1998, cited by Evans). I found no peer-reviewed data specific to self-taught app learners.
- Difficulty adaptation for beginners: simplify (easier voicings, capo shapes, slower tempo, fewer parts) before adding complexity; measure skill with **tempo reached at clean-pass criterion**, not time spent.
- Cross-links: `research/users/personas.md`, `research/users/user-journeys-and-flows.md`, `practice-tool-patterns.md` (prioritised feature candidates table), `learning-science-principles.md`.

## Findings

### First-session design
**What sources support**
- Early experiences of success matter for motivation. SDT identifies competence as a basic need ([Ryan & Deci 2000](https://selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf)); Evans (2015) frames persistence and dropout in music learning around need satisfaction and internalised motivation ([Evans 2015](https://selfdeterminationtheory.org/wp-content/uploads/2021/05/2015_Evans_SDT_MusicEdu.pdf)). The P.I.A.N.O. authors explicitly target early success experiences and prolonged motivation for novice pianists, and in their study novices produced more correct notes in 15 minutes with an aligned piano-roll than with sheet music ([Rogers et al. 2014](https://www.uni-ulm.de/fileadmin/website_uni_ulm/iui.inst.100/1-hci/hci-paper/2014/2014-gugenheimer-piano.pdf)).
- Competitor onboarding structures (marketing-level evidence only): Yousician describes a step-by-step learning path, custom daily exercises, a tuner, and progress tracking with streak timeline and badges ([Yousician guitar page](https://yousician.com/guitar)). Moises leads with stem isolation, speed and key change ([Moises features](https://moises.ai/features/)).

**Recommended first-session flow (hypothesis to test)**
```mermaid
flowchart LR
    A[Pick instrument + level self-rating] --> B[Choose or paste a song]
    B --> C[Part isolated and playing: aha 1]
    C --> D[Pick a 2-4 bar phrase, slowed]
    D --> E[Play along with count-in: aha 2]
    E --> F[Set a goal: this song / this week]
    F --> G[Save and schedule a return]
```
- **Step A:** two questions only: instrument(s) and a three-option level ("never played / can play a few songs / comfortable with chords and scales"). Ask for deeper detail later. Skippable. (Recommendation; no source on the optimal number of onboarding questions.)
- **Step B:** autonomy first: the learner picks the song. Offer 3-5 examples for users without a song in mind, and a "paste a reference link" box that embeds the video and then asks for the user's own audio (file or recording). Legal/URL handling is covered in `research/legal/youtube-copyright-and-platform-policy.md`.
- **Step C (aha 1):** show the isolated stem within seconds while analysis finishes; show a progress state for the rest. Processing time constraints are in `research/ml/deployment-and-inference.md`; if analysis takes minutes, offer a precomputed demo song so the first experience does not depend on queue time.
- **Step D (aha 2):** auto-select the first learnable phrase (e.g., the first riff or the chorus chords), set tempo to 70% (recommendation), and start the count-in.
- **Step G:** a return trigger the user chooses (day/time reminder or "no reminders"), see below.
- **Metrics to track (recommendations):** time to isolated audio, time to first loop pass, percentage completing a phrase at slowed tempo in session 1, D1/D7 return.

### Skill self-assessment and goal setting
- **Self-assessment.** Use a three-level self-rating plus a **behavioural probe** after the first loop (how many passes to a clean one, at what tempo) to calibrate difficulty. Self-ratings are unreliable in general; I have no music-specific source, so this is a design inference.
- **Goals.** SDT favours self-set goals (autonomy). Offer goal templates: "learn this song's chorus this week", "play the whole song at 80%", "3 sessions this week". Offer a default of two to three short sessions per week (recommendation) rather than a daily target, in line with the spacing literature in `learning-science-principles.md` (P5).
- **Implementation prompts.** Ask "when will you practise?" at the end of session 1 and set a calendar-style reminder only with explicit consent. I did not open a primary source on implementation intentions; this is a pointer for later research, not a cited claim.

### Progression from beginner to intermediate
How difficulty can be adapted (all recommendations, except where a competitor is cited):
- **Simplified arrangements:** reduce the part (melody-only, root notes only for bass, 2-note power chords for guitar), then add layers. The transcription quality limits on this are in `research/ml/transcription-guitar-and-bass-tabs.md` and `research/ml/transcription-general.md`.
- **Easier chord voicings and capo shapes:** Moises Capo Mode finds capo positions and chord shapes that simplify fingering ([Moises](https://moises.ai/features/)); build this in as a "make it easier" action. Chord detection errors are discussed in `research/ml/chords-beats-key-structure.md`.
- **Tempo ramps:** speed trainer from a comfortable tempo to full (`practice-tool-patterns.md`).
- **Part isolation:** hand separation (flowkey offers per-hand practice) and "my part louder" mixes.
- **Skill measurement (recommendation):** per song-section record `max tempo at clean pass` (clean = ≥90% of expected notes within tolerance, or self-assessed), `passes to first clean`, and `retention after 7 days`. Roll up to an instrument "level" using the number of sections cleared at ≥90% tempo across difficulty bands (difficulty from chord complexity, tempo, technique tags; to be defined with ML outputs). This is a proposal; there is no validated music-app skill model in the sources I opened.
- **Intermediate transition:** introduce reading rhythm/notation and theory *as helpers* ("why does this chord work here") when the learner starts looping most of the song; offer ear-training of the learner's own songs (key, scale degrees) via `research/ml/chords-beats-key-structure.md`.

### Retention mechanics and their evidence

| Mechanic | What sources say | Pitfalls | Recommendation |
|---|---|---|---|
| Points / badges / leaderboards | Most common gamification elements across hundreds of studies; results lean positive but mixed ([Koivisto & Hamari 2019](https://webpages.tuni.fi/gamification/2019/06/24/the-rise-of-motivational-information-systems-a-review-of-gamification-research/)); early review: only two studies found all tests positive, effects depend on context and user ([Hamari et al. 2014](https://www.lescahiersdelinnovation.com/wp-content/uploads/2019/06/2014-hamari_et_al-does_gamification_work.pdf)) | Novelty effect; removing it can hurt engaged users (loss aversion); rewards can undermine intrinsic motivation in music learning ([Evans 2015](https://selfdeterminationtheory.org/wp-content/uploads/2021/05/2015_Evans_SDT_MusicEdu.pdf)) | Use sparingly, informational ("first clean pass at 90% tempo"), not for every action; optional |
| Daily streak | Duolingo: 7-day streak users 3.6x more likely to complete the course (association, company data, no methodology); allowing two Streak Freezes to be equipped at once gave +0.38% daily active learners; streak-milestone animations gave +1.7% 7-day retention of new learners; loss aversion as later driver ([Duolingo blog, Jan 2022](https://blog.duolingo.com/how-duolingo-streak-builds-habit/)) | Association is not cause; small effects; the author acknowledges loss of streak can demotivate | Prefer a forgiving "weekly rhythm" (e.g., 3 of 7 days) or streak with built-in freezes; never shame |
| Habit formation | In a study of 96 undergraduates, average time to maximum automaticity was 66 days (range 18 to a predicted 254), about half had not reached habit-level automaticity after 84 days; a single missed day had little effect but many missed repetitions lowered the plateau; automaticity was self-reported ([BPS Research Digest on Lally et al. 2010](https://bps.org.uk/research-digest/how-form-habit)) | Behaviour was simple (health-related), not an effortful skill like an instrument; not music-specific | Anchor sessions to a cue (same time/place); allow misses without punishment |
| Reminders / notifications | No primary evidence opened | Annoyance, opt-out, permission fatigue | Ask after the first success, not before; user-chosen time; easy off switch |
| Progress visualisation | SDT competence need supports visible progress ([Ryan & Deci 2000](https://selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf)); P.I.A.N.O. gave learners detailed performance feedback after practice | Raw scores of an imperfect detector can mislead | Show "tempo reached" per section and a before/after clip; allow self-assessment override |
| Social / sharing | No evidence I could open; leaderboards depend on user type per Hamari et al. | Comparison anxiety, privacy | Optional; share a clip with a teacher/friend rather than public rankings |
| Teacher/coach connection | SDT relatedness; adult lapsed-player research highlights social context ([Pitts, Robinson & Goh 2015](https://eprints.whiterose.ac.uk/id/eprint/92600/)) | Cost to serve | Later; export a practice log for teachers |

### Why learners quit
- **Adult lapsed participants.** A UK study of adults who sought out playing opportunities and then withdrew (participant observation, focus groups, questionnaires, interviews with two amateur ensembles) found five profiles: enthusiastic returner, reluctant retiree, stressed withdrawer, tired outsider, and contented reminiscer; the abstract notes that only a small share of adults who learned at school keep playing ([Pitts, Robinson & Goh 2015](https://eprints.whiterose.ac.uk/id/eprint/92600/)). The abstract does not map reasons to profiles, and it is about ensemble players, not self-taught app users.
- **Motivation theory.** Evans (2015) reviews SDT and notes persistence and dropout have been long-standing topics in music-education research (citing Hallam 1998); need-thwarting by controlling teaching or external rewards undermines internalised motivation.
- **Community evidence (tier 4, not opened by me).** Search excerpts from teacher and vendor blogs name time, discipline, unrealistic expectations, boredom, and not knowing what to practise next as common reasons; one blog cites a vendor claim that more than 90% of beginners quit within a year, which I could not verify. See `research/users/voice-of-customer-pain-points.md` for sourced user voices and `research/users/personas.md` for how motives vary by persona.
- **Implications (inference).** Quitting drivers map to features: *plateau/boredom* -> song choice and quick wins; *no time* -> 10-minute sessions, resume where you left off; *not knowing what next* -> auto-suggest the next phrase and speed step; *frustration with detection errors* -> overrides and self-assessment; *unrealistic expectations* -> show a realistic "time to learn this song" estimate.

### Pitfalls to avoid
- **Over-reliance.** Some P.I.A.N.O. participants worried about being dependent on the system and lacking notation ("Without the system I would not be able to play the song" in the paper). Plan a path to independence (fade guidance; see P7 in `learning-science-principles.md`).
- **Brittle loss aversion.** Duolingo's own article presents loss aversion as the later-stage motivator; this is effective for engagement but conflicts with SDT's autonomy emphasis. Choose consciously.
- **Reward overjustification.** Avoid gold-star-like rewards for the act of practising; reward mastery milestones.

## Implications for Splitune
- Build onboarding around **one song, one phrase, one slowed pass** within minutes; the isolation feature is the differentiator, so lead with it.
- Avoid a heavy curriculum in v1; use **song-driven goals** and an automatic "next phrase" suggestion.
- Treat streaks as an **experiment arm**: compare forgiving weekly goals against daily streaks on D30 retention and self-reported enjoyment.
- Track and report **skill progress by section tempo** rather than minutes or points.
- Keep all external rewards informational and optional; do not make progress depend on a mic verdict (see `practice-tool-patterns.md`).

## Open questions
- What is the typical time to first successful play-along for learners in existing apps, and what do retention curves look like? Experiment: instrument Splitune prototype; competitor figures not available from reliable sources.
- Do daily streaks help or hurt long-term adherence for an effortful skill like an instrument? Needs an A/B test and ideally a literature check beyond Duolingo's blog.
- Is there peer-reviewed evidence on reminder timing and instrument practice persistence? Not found.
- What is the right self-assessment instrument and mapping to difficulty? Consult a music-education researcher; consider ABRSM/RCM-style grade descriptors as an external anchor (not researched here).
- Are the five "lapsed adult" profiles relevant to online self-taught learners? Interview study.

## Sources
- [Ryan & Deci 2000, Self-Determination Theory](https://selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf) — tier 1, accessed 2026-10-20
- [Evans 2015, SDT in music education](https://selfdeterminationtheory.org/wp-content/uploads/2021/05/2015_Evans_SDT_MusicEdu.pdf) — tier 1, accessed 2026-10-20
- [Rogers et al., P.I.A.N.O. (ITS 2014)](https://www.uni-ulm.de/fileadmin/website_uni_ulm/iui.inst.100/1-hci/hci-paper/2014/2014-gugenheimer-piano.pdf) — tier 1, accessed 2026-10-20
- [Hamari, Koivisto & Sarsa 2014](https://www.lescahiersdelinnovation.com/wp-content/uploads/2019/06/2014-hamari_et_al-does_gamification_work.pdf) — tier 1, accessed 2026-10-20
- [Koivisto & Hamari 2019 (summary page)](https://webpages.tuni.fi/gamification/2019/06/24/the-rise-of-motivational-information-systems-a-review-of-gamification-research/) — tier 3, accessed 2026-10-20
- [Duolingo blog: how the streak builds habit](https://blog.duolingo.com/how-duolingo-streak-builds-habit/) — tier 2, accessed 2026-10-20
- [BPS Research Digest: how to form a habit (Lally et al. 2010)](https://bps.org.uk/research-digest/how-form-habit) — tier 3, accessed 2026-10-20
- [Pitts, Robinson & Goh 2015, lapsed amateur musicians](https://eprints.whiterose.ac.uk/id/eprint/92600/) — tier 1, accessed 2026-10-20
- [Yousician guitar page](https://yousician.com/guitar) — tier 2, accessed 2026-10-20
- [Moises features](https://moises.ai/features/) — tier 2, accessed 2026-10-20
