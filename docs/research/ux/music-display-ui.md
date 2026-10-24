---
title: Music display UI (notation, tab, chords, piano roll, fretboard, drums)
workstream: ux
last_researched: 2026-10-20
confidence: low
---

# Music display UI

Confidence is **low** because controlled research on tab vs notation vs piano-roll is sparse; the only strong direct experiment I could open is one piano study with novices. Most guidance below is design reasoning built on that study, cognitive-load theory, and library capabilities.

## TL;DR
- **Default displays (recommendations):** guitar and bass -> scrolling tab with rhythm stems; piano/keys -> falling-notes (piano-roll) with a keyboard strip, upgrade path to staff notation; drums -> drum-staff grid; vocals -> lyrics with pitch contour; any instrument -> a chord strip. One primary representation at a time; others on demand.
- The only direct evidence I found: novices learning piano did better with a piano-roll aligned to the keys than with falling notes on a separate screen or with sheet music over 15 minutes and one week (small samples, university students, no transfer test). See `learning-science-principles.md` (P8).
- No controlled study on guitar tab vs standard notation turned up in my searches (educator essays only). Do not claim research support for "tab is better"; claim it is the *dominant practice convention* and cheaper to read for beginners (inference).
- Because transcription is imperfect, the UI must expose **confidence**, allow **edits**, and offer **"report wrong note"**.
- Library choice: alphaTab (MPL-2.0) is the only one of the five libraries I checked that natively reads Guitar Pro files, renders tab, drums, and notation, has a cursor, and has synthesised playback. VexFlow (MIT) and OSMD (BSD-3-Clause) are lower level; Verovio is LGPL; abcjs is MIT.

## Findings

### Display types and who they suit

| Display | Best for | Level | Strengths | Weaknesses / risks |
|---|---|---|---|---|
| Staff notation | Piano, voice, classical, anyone aiming at reading skill | Intermediate+ (beginners need reading skill first) | Shows rhythm and pitch relations compactly; universal | High reading burden for novices; in the piano lab study it was outperformed by the aligned piano-roll (below) |
| Guitar/bass tab | Guitar, bass | Beginner to advanced | Direct string and fret mapping; dominant convention for popular music | Rhythm often missing or ambiguous in plain tab; hides harmonic relations; one claim in practitioner sources that tab "obscures musical relationships" is opinion, not measured |
| Tab + rhythm notation (combined) | Guitar, bass, drums | Beginner to intermediate | Adds durations to string/fret | Heavier display, more load |
| Chord chart / lead sheet | Strummers, singer-songwriters, rhythm guitar, keys comping | Beginner | Few symbols; fast to read; matches how people play songs from video | No melody, rhythm detail, or voicing; sensitive to chord-recognition errors (see `research/ml/chords-beats-key-structure.md`) |
| Chord diagrams / fretboard diagram | Guitar, ukulele | Beginner | Immediate shape mapping | Static; must be mirrored for left-handed players |
| Piano roll / falling notes | Piano/keys, also drums, bass | Beginner | No sight-reading needed; time axis is visual | Easy to "chase" notes without understanding; weak for dynamics/articulation unless extended; screen/keyboard attention split |
| Keyboard strip with highlighted keys | Piano | Beginner | Direct mapping to keys | Needs room; needs finger numbers for technique |
| Drum staff / grid | Drums | All | Fixed staff positions per limb/instrument (see conventions below) | Requires learning the kit mapping |
| Lyrics with chords | Vocals, guitar | Beginner | Anchors timing to words | Lyrics licensing and alignment errors |
| Pitch contour / karaoke bar | Vocals | Beginner | Immediate pitch feedback | Mic accuracy; octave errors |

### What the evidence says

- **Piano-roll for novices.** P.I.A.N.O. projected an enhanced piano-roll aligned to the piano keys. In study 1 (n=56 novices, within-subjects, 15 min per system) it produced significantly more correct notes than Synthesia (falling notes on a monitor) and Finale (staff notation), and lower intrinsic and extrinsic cognitive load; in study 2 (n=18, one week) it showed a steeper learning curve. The authors attribute part of the gain to removing the split between the display and the keyboard. Stated limits: right-hand parts only, students, one week ([Rogers et al., ITS 2014](https://www.uni-ulm.de/fileadmin/website_uni_ulm/iui.inst.100/1-hci/hci-paper/2014/2014-gugenheimer-piano.pdf)). Participants' average sight-reading score was 6.98 of 15 in study 1. The authors also note that some learners worried about dependence on the system and the absence of sheet music. **Takeaway:** falling notes are a reasonable beginner default for piano, and the "separate screen" penalty is real but unavoidable on phones; mitigate by keeping the keyboard strip adjacent to the notes.
- **Tab vs notation.** No controlled comparison found. Educator-oriented pieces (not opened by me) argue tab is quicker to start with but conveys less rhythm and harmony; treat the pros/cons table above as expert opinion.
- **Colour coding to reduce search.** Colour-coding referents reduced load in a diagram-plus-text experiment ([Kalyuga et al. 1999](https://tecfa.unige.ch/tecfa/teaching/methodo/Kalyuga99.pdf)); use consistent string, finger, or voice colours across all views (accessible palette in `accessibility.md`).
- **Page turning and size.** In a digital-music-stand study, scrolling techniques did not work as well as page-replacement methods, and some reduction in displayed music size was possible without significantly harming reading accuracy ([Bell, Church, McPherson & Bainbridge 2005](https://researchcommons.waikato.ac.nz/entities/publication/921242c4-41c4-4cbc-a130-989da1517138); abstract only, sizes tested not listed). This concerns reading sheet music from a screen while sight-reading, a related but not identical task to following a moving tab.

### Synchronised highlighting and scrolling
Recommendations (the Bell et al. result is the only empirical anchor):
- **Two modes:** (a) *Page-flip by bar group* (notation and chord charts): highlight the current bar, flip to the next block when the cursor reaches the last bar, keeping the next 1-2 bars visible ("look ahead") so the reader never meets a blank page. (b) *Continuous horizontal scroll with fixed now-line* (tab, falling notes) for rhythm-driven learning. Let the user choose; default (a) for notation, (b) for tab and roll.
- **Cursor:** beat-accurate cursor with click-to-seek is a documented alphaTab feature ([alphaTab repo](https://github.com/CoderLine/alphaTab)). Allow tapping a bar to start playback there.
- **Look-ahead:** show at least one bar ahead of the now-line on screen; at 100 BPM in 4/4 a bar is 2.4 s, so a one-bar look-ahead gives about 2 seconds (arithmetic).
- **Reduced motion:** page-flip is the reduced-motion default; continuous scrolling needs a pause control (`accessibility.md`).
- **Display never owns the clock** (see `practice-tool-patterns.md`, Pattern 7).

### Handling low-confidence transcription in the UI
All recommendations (no published UI study found). The underlying accuracy limits are in `research/ml/transcription-general.md`, `research/ml/transcription-guitar-and-bass-tabs.md`, and `research/ml/chords-beats-key-structure.md`.
- **Confidence shading:** per-note and per-chord confidence mapped to opacity or outline style (solid = confident, dashed outline = uncertain), never colour alone (WCAG 1.4.1: colour not the only visual means). Provide a legend and a toggle to hide shading for a cleaner view.
- **Editable:** tap a note or chord to open an editor (fret/string, pitch, duration, chord quality), and a "play this bar from the original" button so the learner can listen and decide by ear.
- **"Report wrong note":** one-tap flag stores song id, bar, beat, stem, and the model version; optionally submits a correction. The same correction can retrain scoring tolerances.
- **Alternatives:** where the model has two close candidates (voicing A vs B; chord F vs F/A), show the top candidate and offer "other likely options".
- **Global fallback:** if overall confidence is low, default to chord strip + audio and hide note-level tab, with an explanatory banner. Avoid showing precise-looking tab that may mislead.
- **Provenance label:** "Auto-transcribed - may contain errors", with a version stamp, not hidden in settings.

### Rendering libraries and formats

| Library | License (SPDX) | What it does (from repo page) | Notes for Splitune |
|---|---|---|---|
| [alphaTab](https://github.com/CoderLine/alphaTab) | MPL-2.0 (bundled Bravura/Petaluma/Noto fonts under SIL OFL; bundled SONiVOX SoundFont under Apache-2.0) | Reads Guitar Pro 3-8 (.gp3, .gp4, .gp5, .gpx, .gp), MusicXML (.xml, .musicxml, .mxl), Capella, alphaTex; shows standard notation, tab, drum tabs, slash, numbered notation; SoundFont synth; sync to audio/video backing track; cursor, click-to-seek, range selection, looping; browsers, Node.js, .NET, Android (Kotlin, API 26+) | Closest fit for tab-centred learning; MPL-2.0 is file-level copyleft (changes to alphaTab files must be shared; app code need not) |
| [VexFlow](https://github.com/0xfe/vexflow) / [vexflow/vexflow](https://github.com/vexflow/vexflow) | MIT | TypeScript library rendering notation and guitar tablature to Canvas and SVG; a low-level engraving API (you lay out notes yourself) | Quick-start in the repos loads 4.2.2 and 5.0.0 respectively; I could not confirm the latest release |
| [OpenSheetMusicDisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay) | BSD-3-Clause | Renders MusicXML to SVG/PNG using VexFlow; parses most MusicXML tags; can show guitar tab from MusicXML | Good for MusicXML pipelines; cursor feature not confirmed on repo page |
| [Verovio](https://github.com/rism-digital/verovio) | LGPL (repo lists LGPL-3.0, GPL-3.0 files found; states "available under the LGPL license") | Engraves MEI to SVG; converters for MusicXML, Humdrum, Plaine and Easie, MuseData, EsAC, ABC; JavaScript bindings (emscripten folder) | Strong engraving quality for notation; LGPL has linking/relinking implications for apps; get a legal read before app-store distribution |
| [abcjs](https://github.com/paulrosen/abcjs) | MIT (LICENSE.md: Paul Rosen and Gregory Dyke) | Renders ABC notation in browsers; audio synth; string tablature option | Fits simple lead sheets and folk tunes; not a Guitar Pro reader |
| [MuseScore](https://github.com/musescore/MuseScore) | GPL-3.0 ("licensed under GPL version 3.0") | Desktop notation editor; import/export MusicXML, MIDI, MEI | Useful as an offline conversion/engraving tool, but a GPL desktop app is not an embeddable web library |

Formats:
- **MusicXML 4.0** — open exchange format published by the W3C Music Notation Community Group (not a W3C Standard); spec under the W3C Community Final Specification Agreement; tutorials cover chord symbols and diagrams, tablature, and percussion; compressed `.mxl` variant ([MusicXML 4.0](https://www.w3.org/2021/06/musicxml40/)).
- **MEI** — XML schema plus guidelines for semantically rich encoding, geared to scholarly use; distributed under the Educational Community License 2.0 ([MEI](https://music-encoding.org/about/)).
- **MIDI** — universal but loses engraving and string/fret info; good as the intermediate representation for ML output (see `research/ml/transcription-general.md`).
- **Guitar Pro (.gp3/.gp4/.gp5, .gpx, .gp)** — proprietary; per search-engine excerpts, .gpx came with Guitar Pro 6 and .gp (a zip containing XML) with version 7, and no official specification was found. alphaTab reads them (above). Treat this as unverified beyond alphaTab's own list.
- **alphaTex** — a text format for writing notation in alphaTab: backslash metadata (`\title`, `\tempo`), `|` bar separators, `:8` durations, fret.string style notes, effects in braces ([alphaTex introduction](https://alphatab.net/docs/alphatex/introduction)). Attractive as a *generation target* for ML output: it is human-readable and diffable, and it supports the learner-edit flow (the editor edits text/AST, alphaTab re-renders). Verify the fret.string reading against the language reference before relying on it.

Recommended internal model (inference): store transcription as MIDI-like note events with extra fields (string, fret, finger, confidence, stem id, model version) and export to alphaTex/MusicXML for rendering and interchange.

### Drum notation conventions
- MusicXML encodes drums with `<unpitched>` notes positioned by display-step/display-octave (percussion clef treated like treble clef for placement), instrument ids per note, notehead shapes such as x and diamond so different instruments can share a line, and General MIDI channel 10 with `<midi-unpitched>` for playback ([MusicXML 4.0 percussion tutorial](https://www.w3.org/2021/06/musicxml40/tutorial/percussion/)).
- Common practice (general convention, **not verified from the sources I opened**): bass drum in the bottom space with stems down, snare in the third space, hi-hat as x-noteheads above the top line, ride/crash as x or diamond-style heads on or above the top line, toms between. The MuseScore handbook page I opened only says the software configures noteheads and placement per kit and gives no mapping. Confirm against a drum-notation reference (for example Gould, Behind Bars) before shipping.
- For learners, add a **limb/instrument legend**, a kit diagram with highlighted pad, and optional sticking marks (R/L). Falling-notes drum lanes with named lanes are the beginner alternative.

### Left-handed mirroring
Fretboard and chord diagrams must be mirrorable (nut on the right); tab text itself normally does not change because it names string and fret, not hand. This is a convention I am stating from design reasoning rather than a source I opened; validate with left-handed players. Keyboards are not mirrored in common practice. Details and WCAG implications in `accessibility.md`.

### Moving guitar and bass notes (step 18b, 2026-10-24)
Desk research for the guitar Notes view; details and the per-product table in `specs/assets/18b/research.md`. No controlled or peer-reviewed comparison of highway orientation (horizontal, vertical, 3D) or string order exists that I could find; everything below is product convention and player opinion.
- **Horizontal lanes in tab order are the established 2D form.** Yousician's main guitar view runs notes right to left onto a now line at the left, high string on top as in tab, the fret number on each note and its length as duration ([Yousician help](https://support.yousician.com/hc/en-us/articles/206932099-How-to-read-guitar-tablature)). No 2D product found that drops guitar notes vertically onto a fretboard; that layout is piano's.
- **Rocksmith's 3D highway confuses tab readers and hides timing.** Its default string order is the mirror of tab (low E on top), which reviewers found confusing coming from tab ([MusicRadar 2023](https://www.musicradar.com/reviews/ubisoft-rocksmith-review), [Guitar World 2023](https://www.guitarworld.com/reviews/ubisoft-rocksmith-review)); players report that perspective spacing makes timing hard to judge and the scene distracts ([CustomsForge forum 2023](https://customsforge.com/topic/67566-struggling-to-get-used-to-rocksmith-tabs/), tier 4). Ubisoft ships a 2D tab view as an accessibility option ([Ubisoft 2022](https://news.ubisoft.com/en-us/article/5XfINjoRmVJgBKR8fGt4EM/rocksmith-accessibility-spotlight)). Rocksmith tells strings apart by colour, with colourblind presets; Splitune uses position and string names instead (`specs/26-design-system.md` §4.4).
- **Showing where the hand will be helps.** Soundslice's fretboard greys the current bar's positions and highlights the sounding ones ([Soundslice help](https://www.soundslice.com/help/en/player/advanced/21/visual-fretboard/)); Guitar Pro 8 can show the next beat ([docs](https://www.guitar-pro.com/docs/gp8/display-options/instrument-views)). Lights on the neck itself reduced early errors in a small study (n = 6 for retention; [Keebler et al. 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4034341)).
- **Chasing notes isn't learning the song.** Players credit looping and slowing down, not playing along, for memory ([CustomsForge forum 2022](https://customsforge.com/topic/67234-rocksmith-sight-reading/), tier 4), which supports keeping loops, speed and the tab one tap away from the moving view.
- **Size matters on phones.** The only distance/size evidence found is a review calling Yousician's notes hard to make out on an iPhone and the iPad markedly better ([TapSmart ~2015](https://www.tapsmart.com/apps/review-yousician-guitar-gamifies-learning-chords-and-riffs/), tier 3).

## Implications for Splitune
- Pick **alphaTab** as the first rendering engine for guitar/bass/drums if the project accepts MPL-2.0 (file-level copyleft). It saves building cursor, loop, and playback synchronisation. For piano/keys and lead sheets, either alphaTab with a standard-notation staff or a custom canvas piano roll.
- Build a **view model** independent of renderer so the same transcription can be shown as tab, notation, chord strip, or roll. This also makes it cheap to A/B displays.
- Treat **confidence as first-class data** from the ML layer to the pixel; add it to the interface contract with `research/ml/pipeline-overview.md`.
- For piano, **prototype the keyboard strip adjacent to a roll**; measure time-to-first-correct-notes against staff notation in a small pilot.
- Learners of different personas (see `research/users/personas.md`) get different defaults at onboarding (see `onboarding-retention-motivation.md`); displays are a user setting, not a fixed product decision.

## Open questions
- Is there any peer-reviewed comparison of tab vs staff notation for beginner guitarists (reading speed, errors, retention)? My searches returned educator writing only; a targeted ERIC/RILM search or an expert in music education would settle it.
- Does the P.I.A.N.O. advantage hold for a phone screen next to a real keyboard (separate display) over several weeks? Needs a pilot.
- Page-flip versus scrolling for moving tab at different tempos: Bell et al. studied sheet-music reading; replicate for tab.
- License review for LGPL (Verovio) and MPL-2.0 (alphaTab) in a closed-source app store distribution. Needs legal advice.
- Reliable drum-notation reference to confirm limb/instrument placement and legend wording.

## Sources
- [Rogers et al., P.I.A.N.O. (ITS 2014)](https://www.uni-ulm.de/fileadmin/website_uni_ulm/iui.inst.100/1-hci/hci-paper/2014/2014-gugenheimer-piano.pdf) — tier 1, accessed 2026-10-20
- [Kalyuga, Chandler & Sweller 1999](https://tecfa.unige.ch/tecfa/teaching/methodo/Kalyuga99.pdf) — tier 1, accessed 2026-10-20
- [Bell et al. 2005, page turning and image size in a digital music stand](https://researchcommons.waikato.ac.nz/entities/publication/921242c4-41c4-4cbc-a130-989da1517138) — tier 1, accessed 2026-10-20
- [alphaTab repository](https://github.com/CoderLine/alphaTab) — tier 2, accessed 2026-10-20
- [VexFlow (0xfe) repository](https://github.com/0xfe/vexflow) — tier 2, accessed 2026-10-20
- [VexFlow (vexflow org) repository](https://github.com/vexflow/vexflow) — tier 2, accessed 2026-10-20
- [OpenSheetMusicDisplay repository](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay) — tier 2, accessed 2026-10-20
- [Verovio repository](https://github.com/rism-digital/verovio) — tier 2, accessed 2026-10-20
- [abcjs repository](https://github.com/paulrosen/abcjs) — tier 2, accessed 2026-10-20
- [abcjs LICENSE.md (MIT)](https://raw.githubusercontent.com/paulrosen/abcjs/main/LICENSE.md) — tier 2, accessed 2026-10-20
- [MuseScore repository](https://github.com/musescore/MuseScore) — tier 2, accessed 2026-10-20
- [MusicXML 4.0 (W3C Music Notation Community Group)](https://www.w3.org/2021/06/musicxml40/) — tier 2, accessed 2026-10-20
- [MusicXML 4.0 percussion tutorial](https://www.w3.org/2021/06/musicxml40/tutorial/percussion/) — tier 2, accessed 2026-10-20
- [Music Encoding Initiative: about](https://music-encoding.org/about/) — tier 2, accessed 2026-10-20
- [alphaTex introduction](https://alphatab.net/docs/alphatex/introduction) — tier 2, accessed 2026-10-20
- [MuseScore handbook: inputting percussion notation](https://handbook.musescore.org/idiomatic-notation/percussion/inputting-percussion-notation) — tier 2, accessed 2026-10-20
- [Yousician: how to read guitar tablature](https://support.yousician.com/hc/en-us/articles/206932099-How-to-read-guitar-tablature) — tier 2, accessed 2026-10-24
- [Ubisoft: Rocksmith+ accessibility spotlight (2022-09-22)](https://news.ubisoft.com/en-us/article/5XfINjoRmVJgBKR8fGt4EM/rocksmith-accessibility-spotlight) — tier 2, accessed 2026-10-24
- [Soundslice help: visual fretboard](https://www.soundslice.com/help/en/player/advanced/21/visual-fretboard/) — tier 2, accessed 2026-10-24
- [Guitar Pro 8 docs: instrument views](https://www.guitar-pro.com/docs/gp8/display-options/instrument-views) — tier 2, accessed 2026-10-24
- [MusicRadar: Rocksmith+ review (2023-02-23)](https://www.musicradar.com/reviews/ubisoft-rocksmith-review) — tier 3, accessed 2026-10-24
- [Guitar World: Rocksmith+ review (2023-02-22)](https://www.guitarworld.com/reviews/ubisoft-rocksmith-review) — tier 3, accessed 2026-10-24
- [TapSmart: Yousician review (about 2015)](https://www.tapsmart.com/apps/review-yousician-guitar-gamifies-learning-chords-and-riffs/) — tier 3, accessed 2026-10-24
- [CustomsForge forum: struggling to get used to Rocksmith tabs (2023)](https://customsforge.com/topic/67566-struggling-to-get-used-to-rocksmith-tabs/) — tier 4, accessed 2026-10-24
- [CustomsForge forum: Rocksmith and sight-reading (2022)](https://customsforge.com/topic/67234-rocksmith-sight-reading/) — tier 4, accessed 2026-10-24
- [Keebler et al. 2014, Frontiers in Psychology (Fretlight)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4034341) — tier 1, accessed 2026-10-24
