# Step 18b Phase 1 — guitar/bass moving-notes research (2026-10-24)

Subagent desk research; all sources accessed 2026-10-24. Tiers: T1 peer-reviewed/standards, T2 vendor docs, T3 editorial reviews, T4 forums/app reviews. Reddit and the App Store were not checked (unreadable to the tools). To merge into `docs/research/ux/music-display-ui.md` in Phase 2 (sourced findings only).

## Conventions by product
| Product | Layout | String order | Fret on note | Chords | Neck / next position | Left-handed | Colour |
|---|---|---|---|---|---|---|---|
| Rocksmith / Rocksmith+ Noteway | 3D, neck from behind, notes approach | Low E on top by default (mirror of tab), invert option | Numbers on notes | Chord frames + names; optional next-chord countdown | ~4-fret lit band for hand position (players' description only) | Yes | Colour per string, adjustable, colourblind presets |
| Rocksmith+ RS Tab | 2D scrolling tab, playback line | Tab order | Numbers | Stacked numbers | — | — | Mostly numbers |
| Yousician | Horizontal lanes, mild perspective, notes right→left onto a now line at the left | High e on top (tab order) | Number on a pill; pill length = duration | Strum blocks with ▲/▼ + chord diagram on top | Bouncing ball for timing; no fretboard strip | Yes (highway flip unconfirmed) | Colour = suggested finger |
| Soundslice fretboard | Fixed horizontal neck under the score | Tab order | Pitch name | Dots | Grey = notes in the current bar, orange = sounding now; whole loop shown while looping | Yes (2019) | Colour = note state |
| Guitar Pro 8 fretboard | Fixed horizontal neck | Unconfirmed | — | Dots | Current beat / + bar / + next beat | Yes | — |
| Fender Play | Static tab under lesson video, red cursor | Tab order | Tab | Tab or names | None | — | — |
| Songsterr / UG Pro | Static tab, moving cursor | Tab order | Tab | Tab | None found | — | — |
| GuitarTuna Play / Chordify / Riffstation | Chord sheet / timeline | n/a | n/a | Name + diagram; current + next | n/a | — | — |

Sources (T2): Ubisoft accessibility spotlight 2022-09-22 https://news.ubisoft.com/en-us/article/5XfINjoRmVJgBKR8fGt4EM/rocksmith-accessibility-spotlight · Ubisoft RS Tab 2024-07-25 https://www.ubisoft.com/en-us/game/rocksmith/plus/news-updates/tvCTcmuykl9CiSrz9raAG/whats-so-awesome-about-rocksmith-sheet-music · Yousician tablature help (undated) https://support.yousician.com/hc/en-us/articles/206932099-How-to-read-guitar-tablature · Soundslice visual fretboard (undated) https://www.soundslice.com/help/en/player/advanced/21/visual-fretboard/ · Soundslice left-handed 2019-03-21 https://www.soundslice.com/blog/106/new-left-handed-fretboard-visualization · Guitar Pro 8 instrument views (undated) https://www.guitar-pro.com/docs/gp8/display-options/instrument-views · Fender Play Practice Mode (undated) https://lausd-instructor.fender.com/hc/en-us/articles/360043847032-Practice-Mode. T4: Rocksmith anchor band, Steam 2014 https://steamcommunity.com/app/221680/discussions/0/648816743265124046

## What learners and reviewers say
- Rocksmith's mirrored string order confuses tab readers: MusicRadar 2023-02-23 (T3) https://www.musicradar.com/reviews/ubisoft-rocksmith-review; Guitar World 2023-02-22 (T3) https://www.guitarworld.com/reviews/ubisoft-rocksmith-review (natural for beginners, confusing from tab); Steam 2013 (T4) recommends inverting to match online tab https://steamcommunity.com/app/221680/discussions/0/666827315586937116.
- 3D readability (CustomsForge, Jan–Feb 2023, T4) https://customsforge.com/topic/67566-struggling-to-get-used-to-rocksmith-tabs/: zooming neck and venue lights distract; perspective spacing makes timing hard to judge; an open string lighting the whole string confuses; some players keep the screen mostly out of view.
- Chasing notes vs learning (CustomsForge, Sept–Dec 2022, T4) https://customsforge.com/topic/67234-rocksmith-sight-reading/: playing along alone doesn't build memory; looping and slowing down do; doesn't teach tab or chord charts. One bassist: works on bass, not for guitar sight-reading. Bass is easier on the Noteway (fewer strings and chords).
- Screen size: TapSmart Yousician review (~2015, T3) found iPhone notes hard to make out, iPad "markedly superior" — the only size/distance evidence found. https://www.tapsmart.com/apps/review-yousician-guitar-gamifies-learning-chords-and-riffs/
- Guitar World Yousician review 2022-04-27 (T3): bouncing-ball timing cue effective, not to everyone's taste. https://www.guitarworld.com/reviews/yousician-review
- Research (small): Keebler et al. 2014, Frontiers in Psychology (T1) — lights on the neck (Fretlight) cut early errors; retention result rests on n = 6, one scale https://pmc.ncbi.nlm.nih.gov/articles/PMC4034341 · Ly, University of Sydney master's thesis (4 participants, 60 days; Rocksmith taught some technique, tab-reading transfer inconclusive; page 403, from the search snippet) https://ses.library.usyd.edu.au/handle/2123/26621 · Heyen & Sedlmair, AR guitar visualisation (case studies) https://arxiv.org/abs/2603.23639

## Evidence gaps
No controlled or peer-reviewed comparison of highway orientation or string order for guitar. No data on readability at a stand distance, and no Rocksmith-specific eye-strain or motion-sickness reports found. Rocksmith's lit band is documented only by players. Guitar Pro's string order and Yousician's left-handed highway are unconfirmed.

## Mockups
`guitar-notes-directions.html` (this folder; also published privately at https://claude.ai/artifact/DRmFJJh8xxNFT6BBtGDgD3) and the PNGs: `{A,B,C}-{light,dark,stage}-{tablet,phone}.png` at bar 46 of "Risk It All" (dense strummed Dmaj7), plus A states: loop wrap (Dark), shift cue, left-handed, reduced motion, bass (tablet, phone), uncertain bar 21, low string on top.
