# Rebuilding Splitune around a practice loop

The redesign should start from practice behaviour, not from a colour palette. The strongest evidence on practice shows that strong practisers differ from weak ones in strategy (finding exactly the bar where the error is, repeating until it is stable, changing tempo deliberately), not in hours. So every Splitune screen has to shorten a single loop: jump to the bar, loop, change tempo, self-rate the pass, without the hands leaving the instrument. Moises, Capo, Soundslice and Songsterr have converged on dark mode, large chord text and "notation as a timeline", so that is only the floor. The real gap lies in two places nobody does well yet: the wait of several minutes while processing, and correcting AI output. Visually, the report proposes direction A "Night Rehearsal" (warm graphite, light ink notation on a dark background, a single amber colour for "now") as the brand default, with a "Daylight" theme generated from the same token set. To be blunt: the visual research notes lean towards a light paper background for reading on a music stand in daylight, and that direction is close to the current "Music Stand" that you want to move away from. So a reading test on a real music stand (A, Daylight and B at 0.5 / 0.75 / 1.5 m) is a mandatory gate before writing code. Structurally, the app moves to a top-bar shell with ⌘K and a global "Add song" button. A song opens straight into Practice and then fills in stage by stage. The Practice screen consists of the song map, the "Now" column, the notation canvas, a four-tab inspector (Loop / Mix / Progress / Fix) and the transport dock. The eight-phase plan (0–7) separates the pure re-skin (tokens, type, components, layout) from the new product scope, where most of the risk is concentrated: speed ladder (V1), sections (V3), visual metronome (V9), a multi-stem mixer, the Fix and Progress tabs, Web Push notifications, and a Stand view that turns pages with the audio. The success metric should be the tempo of the first clean pass in the next session, not minutes or streaks.

## Strong practisers win on strategy, so the interface must shorten exactly one loop

The first design question is not what Splitune should look like but what the learner needs to do faster, and here the evidence is fairly consistent. A meta-analysis of 88 studies found that **deliberate practice explains about 21 % of the variance in music performance** (r ≈ 0.46), compared with 4 % in education and under 1 % in professions ([Macnamara, Hambrick & Oswald 2014](https://stafforini.com/works/macnamara-2014-deliberate-practice-and/)). A music-only meta-analysis arrived at a corrected coefficient of rc = 0.61, so the true share is still debated, somewhere between a fifth and a third ([Platz et al. 2014](https://www.frontiersin.org/articles/10.3389/fpsyg.2014.00646/pdf)). What decides the outcome is how you practise. Duke, Simmons & Cash had 17 piano students practise a three-bar Shostakovich passage, tested them the next day, and found that **strategy, not time spent, predicted the result** ([JRME 2009](https://journals.sagepub.com/doi/10.1177/0022429408328851)). The best group did not make fewer errors at the start but handled errors differently: they slowed down just before the spot where they had gone wrong, without stopping, then repeated the target passage until the error disappeared and stayed stable over later passes. This group averaged only **3 incorrect trials, compared with 13.56** in the weakest group ([unofficial copy, to be checked against the journal](https://www.scribd.com/document/494219936/DukeEtAl2)). Miksza's observation of 60 student wind players points the same way: repeating passages, whole-part-whole, playing slowly and jumping straight to (or just before) the hard passage were the behaviours that correlated with achievement ([Miksza, JRME](https://www.sciencegate.app/document/10.1177/0022429408317513)).

Taken together, the well-evidenced behaviours all come down to one action: **jump to exactly the right bar and loop it at an adjustable tempo, with close to zero setup cost.** "Jumping straight to the hard passage" is really a requirement on navigation speed, so the redesign needs a hard metric: from the playing state, a loop around the current bar can be created in at most two actions (tap, key or pedal), with a median under 3 seconds and no dragging.

The weak evidence matters just as much, because it tells you what must not be hard-coded. Henley's experiment with 60 students found that **the way tempo is increased (gradually, held constant or alternating) had no significant effect**, whereas hearing a model did ([Henley 2001](https://journals.sagepub.com/doi/10.2307/3345799)). Practising with a metronome at 60 BPM was no better than other strategies ([Hanberry 2004](https://repository.lsu.edu/gradschool_dissertations/1187/)); by contrast, it is muting the metronome for a few beats that exposes the player's internal timing stability ([Owens & Cunningham](https://wrexham.repository.guildhe.ac.uk/id/eprint/17318/1/More%20Cowbell_Variations_inc%20c%20sheet.pdf)). Among 50 trumpet students, only the condition combining imagery, singing and playing improved expressiveness ([Steenstrup et al. 2021](https://www.frontiersin.org/articles/10.3389/fpsyg.2021.757052/full)). According to a secondary report, playing along with a good-quality backing mainly helps players connect emotionally with the music ([Music Teacher](https://musicteachermagazine.co.uk/content/feature/backing-tracks-good-or-bad)). The consequence for the design is that the speed ladder must be an adjustable default, not advertised as "science": start from the best clean tempo (or 70 % if there is none), go up 5 % after 3 clean passes, go down 5 % after 2 failed passes. The other three are measured options, not rules: a "gap click" that mutes the click for a few bars; a "listen first" pass that plays only the isolated part before you play; and a suggestion to switch from "Your part loud" to "Minus-one" once the loop is clean at 90 % of the original tempo or above.

The point that carries the most weight for product metrics comes from long-term memory. In Carter & Grahn's study of 10 clarinettists, **scores on the technical exercise practised in blocks dropped from day 1 to day 2**. Interleaved practice gave a higher mean score but did not reach statistical significance, and participants were split: six found interleaving more helpful, six still preferred blocked practice ([Carter & Grahn 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC4989027/)). Simmons's experiment with 29 musicians learning a key sequence suggests that sleep consolidates accuracy ([Simmons 2011](https://www.bohrium.com/paper-details/distributed-practice-and-procedural-memory-consolidation-in-musicians-skill-learning/813362932149649409-5172)). So **fluency within a session is a misleading measure.** The honest measure is the tempo of the first clean pass in the next session. Splitune already stores the best clean tempo for each clip; the redesign should promote "first clean pass next session" to the main retention metric, and open the first session after a night's sleep with the suggestion "Warm up with yesterday's hard bars".

### Automatic logs and competence feedback instead of streaks

Self-reports of practice are unreliable: group differences in self-reports repeatedly contradicted the observed behaviour ([Holmes-Davis 2015](https://open.bu.edu/items/6a4e02ef-3c43-4cdc-b1a3-d446f5491900)). So the log must record automatically which loop, at what tempo, and which passes were rated "Felt clean", while self-reflection costs only one tap. Streaks build regularity but cause frustration when the streak is lost ([study on Duolingo, n = 7](https://eprints.umpo.ac.id/21371/)). Self-determination theory holds that external rewards erode intrinsic motivation ([Evans 2015](https://selfdeterminationtheory.org/wp-content/uploads/2021/05/2015_Evans_SDT_MusicEdu.pdf)), and a review of gamification found that its effects depend on context and may be no more than a novelty effect ([Hamari et al. 2014](https://www.lescahiersdelinnovation.com/wp-content/uploads/2019/06/2014-hamari_et_al-does_gamification_work.pdf)). The user side supports this direction too. Fender's CEO says **90 % of new guitar players give up within 12 months**; this figure comes from the company's customer surveys, not from published research ([Guitar World](https://www.guitarworld.com/news/90-percent-of-new-guitarists-abandon-the-instrument-within-a-year-according-to-fender)). Adult amateurs measure success by enjoyment ([AYO](https://ayo.com.au/why-am-i-doing-this-an-insight-into-the-experiences-of-adult-learners-of-musical-instruments/)). For this time-poor group, the biggest lever is the time from opening the app to the first audible pass. A reasonable target is under 10 seconds, through a "Continue: <song>, bars 17–20 at 75 %" card. Lightweight tracking has a precedent: Soundslice shows seven circles for the last seven days of each piece, with no XP and no quests ([Soundslice practice tracking](https://www.soundslice.com/help/en/player/notebook/283/practice-tracking/)). Short-term goals should be generated from data ("bars 17–20 clean at 80 %") rather than "practise for 20 minutes", because skilled players organise their practice around small, concrete goals ([MTNA 2024](https://certification.mtna.org/downloads/Informed/EJ/AOY/2024_E-Journal_AOY.pdf)).

### An AirTurn pedal fresh out of the box will change tempo instead of playing

Bluetooth page-turner pedals act as HID keyboards, the keys they send depend on the hardware mode, and **the default mode of the AirTurn BT200S (Mode 2) sends the Up/Down arrow keys** ([AirTurn BT200S manual](https://manualslib.com/manual/1986862/Airturn-Bt200s-Series.html?page=13)). AirTurn's developer documentation numbers the other modes differently, but also lists Mode 2 as Up/Down ([AirDirect FAQ](https://dev.airturn.com/sdk/docs/main/airdirect-faq.html)). The iRig BlueTurn also has an Arrow Up/Down mode, selected at power-on ([product page](https://www.musicjunction.com.au/products/irig-blueturn-bluetooth-page-turner)). Splitune's current key map assigns ↓/↑ to slower/faster by 5 %. As a result, **anyone who connects an AirTurn left in its factory mode will change tempo while thinking they are playing or repeating**: a behavioural bug that is cheap to fix but expensive to ignore. On the web a pedal cannot be told apart from a keyboard, so the solution is a two-step wizard, "Press your left pedal… now your right", that captures whatever key the device sends. By default the left pedal is Restart loop and the right pedal is Play/pause, and until the pedal is configured ↑/↓ must not silently change tempo. Musicians used to forScore expect a single mapping table for keys, pedals and MIDI ([forScore](https://forscore.co/?p=1641)). But **Safari does not support Web MIDI in any version** ([caniuse](https://caniuse.com/midi)), so on iPad the keyboard path alone must be enough for every action. Users report facial gestures firing by mistake while performing ([Delcamp](https://www.classicalguitardelcamp.com/viewtopic.php?p=1687299)), so voice and face control stay off the main path. Every key or pedal action must be confirmed on screen within about 0.1 seconds, the threshold for feeling instantaneous ([NN/g](https://www.nngroup.com/articles/response-times-3-important-limits/)).

How the device is set up during practice adds three constraints. The first is distance. The guidelines of the orchestra librarians' association (known only through a quotation on a forum) consider an 8.5 mm staff the most readable for parts, with the music about 3 ft from the eyes ([Musica Sacra](https://forum.musicasacra.com/forum/discussion/comment/179594)). Dorico calls 7 mm the common size and notes that players who sit far from the stand prefer larger staves ([Steinberg Dorico](https://steinberg.help/dorico_first_steps/v5/en/dorico_first_steps/topics/first_steps_layout_formatting/first_steps_staff_size_changing_t.html)). Converted to a visual angle of ≈ 0.54°, the staff needs to be about **4.7 mm tall at 0.5 m, 7.1 mm at 0.75 m and 14.1 mm at 1.5 m**. This is an estimate that needs testing, but it is enough to conclude that tab and chord sizes must be defined by visual angle, not by px. The second constraint is the screen: Screen Wake Lock has existed since Safari 16.4 but at one point did not work in web apps installed to the Home Screen ([WebKit bug 254545](https://bugs.webkit.org/show_bug.cgi?id=254545)). So the wake lock must be requested again on every `visibilitychange`, with a gentle notice when it cannot be held. The third constraint is sound. An online hand-clapping experiment found that **latency above about 25 ms makes the tempo gradually slow down** ([Chafe & Gurevich 2004](https://ccrma.stanford.edu/~cc/vox/aesFinal.pdf)), while Yamaha says ordinary Bluetooth headphones have about 200 ms of latency ([Yamaha](https://usa.yamaha.com/products/musical_instruments/guitars_basses/amps_accessories/yh-wl500/index.html)). The current "Sound delay" setting only adjusts from −150 to +150 ms, **which is not enough to compensate for typical Bluetooth headphones.** The redesign needs a "tap along with the click" calibration step, a wider compensation range, and a warning when the output appears to be wireless. Long sessions on headphones also bring in the WHO-ITU H.870 safe listening standard (for adults, a reference level equivalent to 80 dBA for 40 hours per week) ([WHO](https://www.who.int/publications/i/item/9789241515276)). So the "Your part loud" preset must not push the master above unity without a limiter.

### WCAG 2.2 becomes a rule for every control

The practice screen runs directly into many WCAG 2.2 criteria. Targets must be at least 24×24 CSS px at level AA ([2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)) and 44×44 at level AAA ([2.5.5](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)). Splitune should adopt 44 px as an internal rule and 64 px for the main controls while practising. The transport dock pinned to the bottom and bottom sheets must not completely cover the focused element ([2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)). Every drag interaction (loop handles, faders, tempo slider, dividers) must be possible with a single pointer without dragging ([2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)). Single-character shortcuts such as C, N, L, M must be able to be turned off or remapped, or be active only when the practice area has focus ([2.1.4](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html)). Auto-scrolling content must be pausable, and pausing playback must stop the scrolling ([2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)). The visual metronome is the easiest place to break a rule: **at 180 BPM, flashing on every beat is exactly three times per second, right at the limit of [2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html).** So the pulse must be confined to a small area and shown by a change of shape or by motion instead of flashing a large area. The downbeat is distinguished by shape, not by colour ([1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html), [1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)). For screen reader users, the useful unit is the bar. There is no "talking score" for tab yet, so a group of students had to build their own MusicXML-to-text converter ([UW Talking Guitar Tabs](https://courses.cs.washington.edu/courses/cse493e/24au/projects/guitar/index.html)), while OSMD already has a braille plugin that works with NVDA and JAWS ([OSMD Braille](https://www.netidee.at/sites/default/files/2026-07/OSMD_Braille_User_Guide.pdf)). Splitune already has per-bar descriptions for screen readers. The principle worth keeping is to read out only when the user asks, not to announce every note live during playback. For processing progress, a `polite` live region that is already present in the DOM announces only stage milestones, not every percentage point ([MDN aria-live](https://developer.mozilla.org/docs/Web/Accessibility/ARIA/Attributes/aria-live)), because dense updates in a live region are a barrier in themselves ([TMU](https://pressbooks.library.torontomu.ca/wafd/chapter/live-regions/)).

## Competitors have converged on layout; waiting and correcting are still open

### Notation is a timeline, and how it scrolls is the user's choice

Soundslice is the best-documented reference. It has two layouts, Scrollable and Paged. In Paged, "each staff is guaranteed to fit entirely on screen, with no scrolling", and the player shows two pages when the notation area is 1500 px wide or more ([Soundslice: Paged layout](https://www.soundslice.com/blog/241/introducing-our-new-paged-layout/); [Scrollable vs paged](https://www.soundslice.com/help/en/player/advanced/241/scrollable-vs-paged-layout/)). How the screen follows the playhead is a policy the user picks: keep the playhead at the top, keep it in the middle, scroll only when needed, pin it to the left, or turn following off entirely while editing ([Playhead scrolling](https://www.soundslice.com/help/en/player/advanced/116/playhead-scrolling-options/)). The playhead shape can be chosen too: the default is an orange line, there is a small block for anyone who finds the line too glaring, and there is an option to shade the background of the bar being played ([Playhead style](https://www.soundslice.com/help/en/player/advanced/292/playhead-style-color/)). Focus mode re-renders the looped section as a standalone piece that fills the screen, which suits phones very well ([Focus mode](https://www.soundslice.com/help/en/player/basic/277/focus-mode/)). Users favour Songsterr because **durations are drawn with note stems right below the tab staff** ([GuitarChalk 2026](https://www.guitarchalk.com/full-songsterr-review/)). The anti-patterns are clear as well. Ultimate Guitar's autoscroll "either lurches ahead or stands still", and its MIDI playback is criticised as stiff ([UG App Store](https://apps.apple.com/us/app/ultimate-guitar-chords-tabs/id357828853)). The cursor of alphaTab, the very library that Splitune's alphaTex pipeline targets, used to "jump too far and then snap back" with linear interpolation ([alphaTab #318](https://github.com/CoderLine/alphaTab/issues/318)). The design lesson has four parts. Follow mode (Page / Scroll / Off) is a setting that is visible on screen and remembered. The cursor follows a beat–time map taken from the audio clock, without extrapolation. Tab always has rhythm stems. The background of the current bar is a position cue that does not depend on colour. One more detail matters for the visual direction: Soundslice **deliberately keeps light-background notation as the default** even when the UI is dark, because light notes on a dark background are "less traditional" and should be something the user actively chooses ([Soundslice theme](https://www.soundslice.com/help/en/player/advanced/301/theme/)).

### Loops, tempo, mixer and chords: the best patterns are already documented

Capo has the most detailed transport model. A new region covers exactly the current bar and snaps to beats by default. Once a region is selected, the Play button switches to looping, with no separate loop toggle. Count-in is measured in **bars (Off / 1 / 2 / 4)** and plays before the loop starts ([Capo: advanced playback](https://supermegaultragroovy.com/products/capo/help/ios/4.5/advanced-audio-playback/)). The speed slider shows the percentage together with the corresponding tempo, over a 25–150 % range, with 1 % step buttons at both ends. Key (transposing by semitones, with the chords following) is separate from Pitch (±100 cents, for recordings that are off standard pitch). A single Control Strip switches between sets of controls, and the icon of a set lights up when that set is altering playback; for example the Mixer icon lights up when any channel is below 100 % ([Capo: control strip](https://supermegaultragroovy.com/products/capo/help/ios/4.5/control-strip/)). Capo's mixer treats the song, the synth chords and the metronome all as channels ([Capo](https://supermegaultragroovy.com/products/capo/help/ios/4.5/advanced-audio-playback/)). Chordify separates "chord volume" from "song volume" ([GuitarChalk](https://www.guitarchalk.com/chordify-review/)), and BandLab uses M/S letters on each stem ([BandLab](https://help.bandlab.com/hc/en-us/articles/16560236938777-What-is-Splitter)). Speed trainers already have a model parameter set: Soundslice lets you set the start tempo, end tempo, increment and passes per step (for example 50→100 %, 10 % steps, 4 passes per step, 24 passes in total). Soundslice itself says its trainer cannot decrease the tempo and cannot save presets ([Soundslice speed training](https://www.soundslice.com/help/en/player/basic/286/speed-training/)), two places where Splitune can do better. Music Speed Changer's button that "shifts the loop by exactly its own length" pairs naturally with a "×2 length" button ([Music Speed Changer](https://help.musicspeedchanger.com/article/fb34fxvon7-a-b-practice-loop-points)).

For chords, Capo's Chord Chooser lists alternatives ranked by likelihood, lets you audition the voicings and offers "Replace all" ([Capo: analysis](https://supermegaultragroovy.com/products/capo/help/ios/4.5/automatic-music-analysis/)). Capo's Grid-Aligned layout keeps a fixed cell width ([Capo: project view](https://supermegaultragroovy.com/products/capo/help/ios/4.5/project-view/)), the exact opposite of a complaint about Chord AI: "sometimes 1 beat per cell, sometimes 2 beats per cell" ([Chord AI App Store](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109)). Chordify remembers capo, transpose and simplify separately for each song ([APKMirror](https://www.apkmirror.com/apk/chordify-b-v/chordify/chordify-1755-release/)). What not to do is documented too: Capo does not save edits unless the user subscribes ([Capo App Store](https://apps.apple.com/dk/app/capo/id696977615)), and Moises limits the free count-in to 4 clicks at the start of the song ([Moises help](https://help.moises.ai/hc/en-us/articles/6580752102044-How-do-I-set-up-the-count-in)). Splitune never locks loops, count-in, tempo or saving edits behind a paywall.

### No competitor has published a decent waiting state

No product in the survey publicly describes an information-rich screen for the processing wait. The observed pattern is a spinner, followed by the complete result. Songsterr AI takes **5–15 minutes and sends an email when it is done**, with a free 20-second preview ([Songsterr help](https://www.songsterr.com/help)). LALAL.AI lets you listen to a preview before clicking "Split in Full" ([LALAL.AI FAQ](https://lalal.ai/guides/faq)), and Moises lets you change the stem separation type without uploading again ([Moises web player](https://moises.ai/newsroom/product-announcements/new-moises-web-player)).

The research on waiting is clear. Waits longer than 10 seconds need a percentage indicator with the reason and a rough, padded time estimate. People shown a moving progress bar **are willing to wait about 3 times longer**, and a progress bar that stalls near 100 % causes frustration ([NN/g](https://www.nngroup.com/articles/progress-indicators/)). Bars that start slow and speed up towards the end are preferred ([Harrison et al.](https://www.chrisharrison.net/index.php/Research/ProgressBars)). Buell & Norton showed that users sometimes prefer to wait longer if they can see the work being done ([labor illusion](https://academicnewsletter.sufe.edu.cn/info/394153)). Bray notes that real transparency also exposes dead time ([Bray](https://www.kellogg.northwestern.edu/faculty/bray/doc/transparency/transparency.pdf)), and for Splitune the dead time is precisely the "Processing machine offline" state when the owner's Mac is asleep.

Splitune's multi-stage pipeline is a rare opportunity: every stage that finishes has a real artefact to show the user, and the user can practise on the original audio before stem separation is done. Songsterr already has AI tab, so **Splitune's differentiation has to come from the experience of practising on the user's own audio** (real stems, loops on the recording, clearly shown confidence, pedal control), not from converting audio into tab ([BassBuzz](https://forum.bassbuzz.com/t/new-songsterr-ai-is-impressive/70519)). A notification when processing finishes is feasible but conditional: on iOS, Web Push only works for web apps installed to the Home Screen, and permission may only be requested right after a direct user action ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).

### Flag what the learner needs to fix, and speak in frequencies

Industry guidance agrees on two points. Show confidence only when it is calibrated and changes what the user does, and use a few semantic buckets or a list of alternatives instead of numbers ([Google PAIR](https://pair.withgoogle.com/chapter/explainability-trust/)). Apple says it plainly: if you are not sure that confidence corresponds to the quality of the result, do not display it ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/machine-learning)). The most directly transferable evidence comes from a preregistered study with 30 programmers: **highlighting the lowest-probability tokens did not help**, while highlighting the tokens predicted to be edited led users to make more edits and find the highlighting more useful ([Vasconcelos et al.](https://arxiv.org/abs/2302.07248v3)). Showing confidence helps users trust the system to the right degree, but does not by itself raise overall accuracy ([Zhang, Liao & Bellamy](https://arxiv.org/abs/2001.02114v1)). To raise accuracy, users must bring knowledge that complements the machine, and for music learners that is their ears. So the "?" mark should invite them to listen to that passage again at a slow tempo. People grasp uncertainty more intuitively when it is expressed as a frequency ("1 in 10") instead of a percentage ([Padilla, Kay & Hullman, via lecture slides](https://faculty.cs.niu.edu/~dakoop/cs628-2021fa/lectures/lecture15.pdf)), which matches the existing copy "Second guess · about 1 in 3".

Professional tools provide ready-made correction models. Melodyne separates "correcting the analysis result" (the sound does not change, and rejected alternatives appear as hollow outlines) from "editing the music" ([Celemony](https://helpcenter.celemony.com/M5/doc/melodyneEditor5/en/M5tour_NA_Mode_1?env=live)). Logic lets the user place a few hints about the beat and the first bar and then recomputes the rest ([Logic Smart Tempo](https://help.apple.com/logicpro/mac/10.4/en.lproj/lgcp9281e70c.html)). Klangio's Retranscribe lets you correct the input and then reruns the later steps ([Klangio](https://klang.io/?p=10950)). In Microsoft's validation study of 18 guidelines for human–AI interaction, "make clear how well the system can do" (G2) and "make clear why the system did what it did" (G11) belong to the group that is relevant but that few products implement ([Amershi et al. 2019](https://www.microsoft.com/en-us/research/uploads/prod/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf)).

Splitune's current three-level system (faded ink, dashed outline, "?" mark) is already headed in the right direction. Four things need to be added:

- calibrate confidence separately for each stage before displaying it;
- rank flags by how likely they are to need a fix and by their musical consequence;
- when nearly a whole bar is uncertain, merge the flags into a single "shaky bar" flag;
- write fallback banners in the style of "About 1 in 4 notes may be off".

The table below gathers these patterns into the floor and the points of difference.

| Topic | Market floor (references above) | Splitune today | Redesign |
|---|---|---|---|
| Loop | Region equal to the current bar, snapped to beats, Play turns into looping (Capo); drag directly on the notation (Soundslice) | Tap two bars, number-entry popover, drag handles on the timeline | Keep all three; add shift loop by its length, ×2/÷2, ±1 bar, section chips |
| Tempo | % with BPM, 1 % steps, presets (Capo, Fender) | 50–100 %, 5 % steps, presets 50/70/85/100 | Speed ladder V1, wider range, Shift for 1 % steps |
| Count-in | Measured in bars, before the loop (Capo) | 0–2 bars, on the beat grid | Keep; add a count-in before each ladder pass |
| Mixer | M/S on every stem, plus master, click and chord synth (Capo, Chordify) | Two channels: your part and "Backing" | Every stem, plus click and chord synth, presets named after goals |
| Chords | Fixed-width cells, simplify by level, remembers capo and transpose (Capo, Chord AI, Chordify) | Chord strip, chord sheet, Level & capo | Now column, fixed grid, remembered per song |
| Confidence | No consumer product seen yet shows per-item confidence | Three levels, not relying on colour alone | Add ranking by consequence, Fix tab, wording as frequencies |
| Processing wait | Spinner then result; email when done (Songsterr) | Opens Practice immediately, fills in progressively, median-based ETA | Stage timeline with artefacts, "Notify me when ready" |
| Corrections | Choose among alternatives ranked by likelihood (Capo); beat hints (Logic) | Editor sheet, Edit page on desktop | Fix tab: queue, audition on the loop, re-quantize with preview |

## Night Rehearsal wins on identity, but the daytime music stand is the real judge

The market suggests three things. First, the major DAWs still default to a dark, flat interface, with low-colour chrome so that colour is reserved for content, but they now treat the interface as a set of parameters. Live 12 has High-Contrast, Tone (Cool / Neutral / Warm) and Dark/Light, and can follow the operating system's light/dark mode ([CDM](https://cdm.link/ableton-live-12-everything-new/); [Audiofanzine](https://en.audiofanzine.com/general-sequencer/ableton/live-12-suite/editorial/reviews/ableton-live-12-1-review.html)). FL Studio has two sliders, Saturation and Contrast ([Image-Line](https://www.image-line.com/fl-studio-learning-content/fl-studio-online-manual/html/envsettings_themes.htm)). Linear generates the whole theme in LCH space from three inputs (base colour, accent, contrast) instead of 98 variables ([Linear](https://linear.app/now/how-we-redesigned-the-linear-ui)). Second, spreading one accent everywhere ruins wayfinding: users complain that FL Studio 2025 turned the file browser into "a wall of orange" ([Image-Line forum](https://forum.image-line.com/viewtopic.php?p=2039807)). Third, transparent surfaces are a real risk for anything that has to be read from a music stand: Apple's Liquid Glass was criticised as hard to read and Apple had to partly back down ([9to5Mac](https://9to5mac.com/2025/09/15/ios-26-officially-launches-today-but-some-developers-arent-sure-it-should/); [Infinum](https://infinum.com/blog/apples-ios-26-liquid-glass-sleek-shiny-and-questionably-accessible/)). There is also a lesson about rollout: long-time users criticised Kontakt 8 for a half-finished interface transition, with old and new parts sitting side by side ([NI community](https://community.native-instruments.com/discussion/37014/ui-ux-feedback-your-thoughts)).

| | A "Night Rehearsal" | B "Annotated Score" | C "Pedalboard" |
|---|---|---|---|
| Surface | Warm dark graphite; light ink notation on a dark background | Warm paper, black ink | Light hardware panel, large modules |
| Accent | A single "signal" amber, used only for now, playhead, loop and primary action | Red pencil | Orange |
| Type | Instrument Sans for UI, JetBrains Mono for numbers and tab digits | Serif for large headings | Space Grotesk |
| Evidence for | Every Okabe-Ito colour reaches 3:1 on the dark background; a single accent avoids the "wall of orange"; dark mode is among the most requested features (Guitar Pro); a clean break from Music Stand | Reads best under room lighting and in daylight (inferred); close to how learners already read sheet music | Best for glancing at from a distance; suits pedals; lots of personality |
| Evidence against | Light notes on a dark background are "less traditional" (Soundslice); tablets suffer glare in daylight; can easily look like every DAW and Moises | Four of the seven Okabe-Ito colours fail 3:1 on the paper background; close to the current Music Stand; red is easily read as "error" | Tiring over long practice; hard to fit enough information on desktop; easily seen as imitating Teenage Engineering |
| Role in the plan | Brand default, with Daylight turned on in one tap | Comparison variant in the music stand test | Ideas borrowed for Stand view |

The balance of evidence has to be stated plainly. The visual research notes recommend B as the brand direction, arguing that notation, chords and tab are the core of the product, and that the scenario of a tablet on a music stand in daylight favours a paper background. Those notes also work out the WCAG 2 contrast ratios of the Okabe-Ito palette themselves ([colour list](https://malcolmbarrett.r-universe.dev/ggokabeito/doc/manual.html)). On the #F5F1E8 paper background, orange reaches only 2.00, sky blue 2.05, yellow 1.17 and reddish purple 2.72, meaning that four of the seven colours fall below the 3:1 threshold. On #121212, all seven pass, the lowest being blue at 3.61. Candidate B, and to a lesser degree Daylight, are both close to Music Stand's image of "a page in a graphite frame", the thing you want to move away from. The need to read in bright rooms is real: someone already sells a high-brightness theme pack for Live 12, made specifically for brightly lit rooms ([Isotonik](https://isotonikstudios.com/product/infra-light-theme-by-deafman-skws/)). And no empirical study has compared a light UI with a dark UI for reading tab from a distance, so both sides are currently reasoning by inference.

The report still proposes A, for four reasons. The first is your own goal: an identity clearly different from Music Stand. Second, the demand for a dark interface has been confirmed many times: Songsterr added dark mode as early as version 10.0.1 ([App Store](https://apps.apple.com/us/app/songsterr-tabs-chords/id399211291)), Guitar Pro calls dark mode one of its most requested features ([Guitar Pro](https://www.guitar-pro.com/blog/p/48507-namm-show-2025-the-prototype-of-the-new-guitar-pro-mobile-app-unveiled)), and Bitwig users ask for a dark background so that multicoloured notes and automation are easier to read ([KVR](https://www.kvraudio.com/forum/viewtopic.php?p=7431998)). Third, the contrast calculation above favours a dark background when stems are colour-coded. Fourth, a single amber accent for "now" matches an existing convention, since Soundslice's default playhead is also orange ([Soundslice](https://www.soundslice.com/help/en/player/advanced/292/playhead-style-color/)). Most importantly, when both themes are generated from the same set of parameters, choosing the default is a reversible decision. Daylight is not a second design but the same token set with a different lightness parameter. Even so, A is only locked in after the music stand test described below.

### OKLCH tokens generated from four parameters

The token set should use the roles of a Radix-style 12-step scale, namely:

- steps 1–2 for backgrounds;
- steps 3–5 for component backgrounds (normal, hover, selected);
- steps 6–8 for borders;
- steps 9–10 for solid colour fills;
- steps 11–12 for text.

According to Radix, steps 11 and 12 are guaranteed to reach APCA Lc 60 and Lc 90 on step 2 ([Radix Colors](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)). Everything is generated in OKLCH from four parameters: base colour (warm graphite), accent (amber), contrast and warmth. Those four parameters produce Night, Daylight and a "More contrast" variant. The current "Stage" mode becomes a value of the contrast parameter instead of a separate theme.

The pass/fail gate remains WCAG 2.2 (4.5:1 for text, 3:1 for non-text components). The April 2026 WCAG 3 draft states plainly that the contrast algorithm is "still to be determined", and APCA was removed from the draft in 2023 ([Adrian Roselli](https://adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html)). So APCA should only be a supporting tool for thin text in dense panels.

There are two technical consequences that are easy to miss. First, Radix notes that at step 9 Amber needs dark text, so the amber primary button must use graphite text, not white text. Second, because amber is reserved for "now", no stem may sit in the orange–yellow hue range. Okabe-Ito's orange #E69F00 and yellow #F0E442 must be dropped or shifted in hue. The stem palette takes the rest of Okabe-Ito plus Paul Tol's "bright" set, which is colour-blind safe ([Paul Tol](https://tesselle.r-universe.dev/khroma/doc/tol.html)), with separate lightness for each mode. Blue must be lightened on the dark background because it only just clears the threshold. Stems always carry a text label. Errors and warnings are shown through shape and text, so that a red-toned stem is not read as an error.

The existing infrastructure can be reused almost as it is. `packages/ui-tokens/src/primitives.css` is already written in OKLCH. `themes.css` already separates the semantic role layer from the component token layer, with `data-appearance` and `data-contrast`. `contrast.test.ts` and `palette.test.ts` already check contrast. The `scripts/check-ui-tokens.mjs` lint already blocks raw colours, Tailwind palette classes and motion that does not come from tokens. The work is replacing values and extending the tests (adding colour-blindness simulation for stems in both themes), not changing the architecture. Base UI is at version 1.9.0 and is still the main direction of the ecosystem ([InfoQ](https://infoq.com/news/2026/02/baseui-v1-accessible/)), so the redesign is a matter of tokens and styles, not of switching libraries.

### Type: Instrument Sans and JetBrains Mono are an identity choice, not yet backed by evidence

No source in the research notes specifically supports the Instrument Sans + JetBrains Mono pairing, and the report does not pretend otherwise. Inter 4, currently in use, already has tabular figures, a slashed zero and an optical size axis with Display cuts ([rsms/inter](https://github.com/rsms/inter/releases)). The visual research notes even argue that a sans font with tabular figures is usually enough for timecodes and reads better from a distance than a mono font. Switching to Instrument Sans is a brand decision to break away from Music Stand, so it has to pass three checks in phase 1: a licence for web use, character coverage (♯ ♭ − ·, narrow no-break space) and tabular figures. JetBrains Mono for tab digits has the advantage of even widths and digit shapes that are easy to tell apart, but the drawback of making tab wider. The font must be tested on the easily confused digit pairs 1/7, 3/8, 6/0 at all three distances. Every number that changes during playback (time, bar.beat, %, BPM, dB) uses `font-variant-numeric: tabular-nums` so the text does not jump. Chord names use the real ♯ ♭ characters, not "#" or "b". The chord quality is set smaller and raised, using the ° ø △ glyphs from SMuFL's `csym` range ([SMuFL chord symbols](https://smufl.formats.music/latest/tables/chord-symbols.html)). When light notation sits on a dark background, thin strokes such as stems and ledger lines need a music font with heavier strokes. Bravura is the most complete SMuFL font, with nearly 3,000 glyphs ([SMuFL fonts](https://www.smufl.org/fonts/)), and according to the notation notes its strokes are heavier than Leland's. Atkinson Hyperlegible Next, a font that is already available, remains the "Hyperlegible font" option.

### Motion follows only the music

The playhead and the highlight on the notes being played should sit on their own compositor layer and move with `transform`. Position is computed from `AudioContext.getOutputTimestamp()` inside `requestAnimationFrame` ([MDN](https://developer.mozilla.org/docs/Web/API/AudioContext/getOutputTimestamp)), with a fallback to `currentTime` because Safari has been reported to return a wrong `contextTime` ([Apple Developer Forums](https://developer.apple.com/forums/thread/696356)). When `prefers-reduced-motion` is on, the notation turns page by page, the playhead moves in steps and all fade effects are dropped. UI transitions (sheets, selection, docking panels) stay within 150–250 ms, with durations taken from tokens. No transparent layers or glass effects over the waveform or the notation. No decorative flashing on the beat, unless the user turns on the visual metronome.

### Phase 0 gate: a reading test on a real music stand

This test decides the default theme, not the identity, because the token set can generate both. It should be run with the owner and a few musician friends, on a static prototype of Practice that uses the same song and the same layout.

| Aspect | Test design |
|---|---|
| Variants | A "Night Rehearsal", Daylight (A in light mode), B "Annotated Score"; same type size, same content |
| Distances and devices | 0.5 m: laptop on a desk; 0.75 m: iPad on a music stand, in both portrait and landscape; 1.5 m: tablet or phone placed on the floor or a chair (the drums and upright bass case) |
| Starting sizes (estimated from visual angle) | Tab or staff system ≈ 0.54°, i.e. about 4.7 / 7.1 / 14.1 mm; capitals of chord names 0.4–0.6°, i.e. about 3.5–5.2 / 5.2–7.9 / 10.5–15.7 mm; on iPad, 7.1 mm is about 37 CSS px |
| Lighting | Daylight next to a window (with glare), room lighting in the evening, a nearly dark room |
| Tasks | Read the current chord and the next chord while playing; read a sequence of tab fret numbers containing 1/7, 3/8, 6/0; find the bar being played again after looking away; recognise the "?" mark and the dashed outline |
| Measures | Misreading rate, time to find the position again, number of times leaning in closer, eye strain and self-reported preference after 20 minutes |
| Decision rule | If A equals or beats Daylight in every condition: A is the default everywhere. If Daylight wins only in daylight: A stays the default, Daylight sits one tap away in the top bar and in Stand view, with a one-time suggestion on tablets. If Daylight or B clearly wins in most conditions: Daylight is the default for Practice and Stand view, and A keeps the brand role for marketing, Library and dark rooms |

## A top-bar shell, and songs open straight into Practice

The current shell has a top bar with the wordmark, Library, the primary **Import** button, Settings, an upload progress pill and the account menu. On phones there is also a bottom tab bar (Library / Import / Settings). The allowance meter appears only in Library on narrow screens, even though the old spec put it in the shell. The new shell keeps the top bar but gives its items new roles:

- **Library** also holds a Progress strip;
- **Settings** stays as it is;
- **⌘K / Ctrl K** opens the command palette;
- a global **"Add song"** button, plus the ability to drop a file anywhere in the app;
- the allowance meter shows right on the bar on wide screens.

On phones, the three items Library / Add song / Settings move down to the bottom bar to stay within thumb reach. The command palette is an inference: the notes found no source on palette conventions. It is still worth building because it is cheap (client side only) and fits the principle that "every action works from the keyboard". The commands include opening a song, "Loop bars 17–20", switching views, switching themes and opening the pedal mapping. On touch screens the palette can be opened with a button. The Progress strip answers exactly the question the home screen has to answer, namely "where do I pick up my practice". It consists of the Continue card, seven dots for seven days, and the first clean pass of the most recent sessions. No streaks, no badges.

"Add song" replaces the `/import` page with a modal on desktop and a full-screen sheet on phones, with three tabs: File / Link / Record. Beside them are two choices, "Your part" and Analysis (Full / Lite). Every working feature is kept: duplicate detection ("You already have this song." with "Open it"), non-blocking warnings (file too quiet, distorted, almost silent), the recording flow with Input level and count-in, the allowance locks, and the offline queue. What is added is a short "Works best with / Has trouble with" block, which applies G1 and G2 (make clear what the system can do and how well it can do it) ([Amershi et al.](https://www.microsoft.com/en-us/research/uploads/prod/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf)) together with Songscription's advice that the recording environment affects accuracy more than any other variable ([Songscription](https://www.songscription.ai/blog/accurate-ai-music-transcriptions)). An optional Title field, prefilled from the file name, closes a current gap: there is nowhere to name the song at import, and the artist field exists in the data but has no UI yet. After the primary button is pressed, the song opens straight into Practice with the local audio, as in the current flow, while the upload runs in the background.

Practice then fills in stage by stage. The general principle: every finished stage must leave a real artefact on screen, not a fake animation.

| Stage (label the user sees) | Artefact shown immediately | Unlocks in Practice |
|---|---|---|
| Local upload, or "Downloading" (link) | Waveform of the original file, right on the device | Play, tempo, loops in seconds |
| "Reading the audio" | Server-side waveform, duration | — |
| "Finding the beat" | BPM, beat grid moving with the music, bar ruler | Bar-based loops, count-in, metronome, beat pulse, section chips if available |
| "Listening for instruments" | "Heard: guitar, bass, keys" (data that already exists but has never been shown) together with the question "Is this your guitar?" | Change the part before stem separation |
| "Isolating your part", "Preparing the stems" | Waveform of each stem | Mix tab and presets |
| "Working out the chords" | Chord strip, Now column | Chords view, Level & capo |
| "Transcribing your part", "Building the tab" | Tab or Notes | Tab/Notes view, Fix tab |

The table above also applies to piano and drums, which currently unlock everything at once. For these two instruments, beats, stems and chords still fill in progressively, and only the notes arrive last. The stage timeline sits in the song map and in the notation area while it is still empty. It has an overall percentage progress bar, weighted by the typical duration of each stage (stem separation takes the largest share), together with a padded range ETA such as "about 3–5 min", which updates only when a stage finishes and never sits at 99 % ([NN/g](https://www.nngroup.com/articles/progress-indicators/)). Each artefact that arrives is announced quietly, for example "Tab is ready — Show", and never re-lays out the notation right under the playhead (HAX G14). The "Notify me when ready" button asks for Web Push permission only at the moment the user presses it. On iOS, this button only appears once the app has been installed to the Home Screen ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). Everywhere else there are still in-app toasts, tab title updates and a badge. Email is not part of personal mode. "Processing machine offline — your song is queued and will start automatically." appears only once, with the next step, and does not turn into a progress bar that stands still ([Bray](https://www.kellogg.northwestern.edu/faculty/bray/doc/transparency/transparency.pdf)). Failures in stages with soft dependencies are treated as usable partial results: the song still opens with what is available, with the reason in plain words and two choices, Retry / "Practise with chords". Every stage can be cancelled. For accessibility: `role="progressbar"` comes with an `aria-valuetext` carrying the stage name, and `role="alert"` is used only for errors that block the user's goal.

| Current | After the redesign |
|---|---|
| `/library` with a header and filter toolbar | `/library` adds the Continue card and Progress strip; keeps the toolbar and URL state |
| `/import` is a separate page | "Add song" becomes a modal/sheet that opens from anywhere; `/import` and `?tab=record` open the modal directly |
| `/songs/$id/practice` with an editor sheet | Keep the route; five-region layout; the Fix tab replaces the editor sheet |
| `/songs/$id/edit` (desktop) | Kept as "Open full editor" in Fix, sharing the same components |
| Settings with 5 sections | 6 sections, adding About; Keyboard & pedal gets the pedal wizard |
| Phone bottom tab bar: Library / Import / Settings | Library / Add song / Settings |

## The Practice screen: five regions serving one loop

On desktop, the Practice screen is divided into five regions, each answering one of the player's questions. Song map: where am I in the song? Now column: what do I play right now? Canvas: which notes? Inspector: how do I practise? Transport dock: control this pass.

```text
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ ←  Riff in A minor   Guitar · A minor · 96 BPM   [Tab|Notes|Chords]  ⋯? Unsure  Display  Keyboard & pedal  ⋯ │
├───────────────────────────────────────────────────────────────────────────────────────┤
│ [Intro][Verse 1][Chorus][Verse 2][Chorus][Outro]                                      │
│ ▁▂▅▇▅▂▁▂▅▇▇▅▂▁  waveform   ░░░ loop band 17–20 ░░░   ╱╱ unsure ╱╱   │ now-line        │
│ 1     5     9     13    17    21    25    29   …  bar ruler                           │
├──────────────┬──────────────────────────────────────────────────┬─────────────────────┤
│ NOW · bar 18 │  Am              F               C          G?    │ Loop  Mix  Progress  Fix │
│              │ ┌──────────────┐                                 │                     │
│   Am         │ │ bar 18 wash  │  tab + rhythm stems             │  (active tab)       │
│  [shape]     │ │   │playhead  │  unsure notes: dashed + "?"     │                     │
│  ● ○ ○ ○     │ └──────────────┘                                 │                     │
│ Next  F      │  ⌐ loop bracket 17–20 ────────────────────¬      │                     │
│ in 3 beats   │                                                  │                     │
│ then C · G   │                                                  │                     │
│ Level · Capo │                                                  │                     │
├──────────────┴──────────────────────────────────────────────────┴─────────────────────┤
│ ⟲  ▶  ⏭   18.2 / 64   Loop 17–20 · pass 2   −  75 % · 72 BPM  +   Count-in  Click  Your part loud  Vol │
│ Pass 2 at 75 % — how was it?      [ Felt clean  C ]   [ Not yet  N ]                    │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

### Top bar and song map: knowing where you are in the song

The top bar keeps exactly what the player needs when standing at the music stand:

- the back button;
- the song title, with the part line ("Guitar · A minor · 96 BPM", with the key spelled as the song's own key);
- the instrument-specific view switch (Tab / Notes / Chords for guitar and bass; Chart / Notes / Staff for piano; Grid / Staff / Chords for drums; Melody / Chords for vocals);
- the confidence legend chip;
- Display;
- Keyboard & pedal;
- the ⋯ menu.

The legend chip opens a popover: "Auto-transcribed — may contain errors (v0.4.0)", a key to the three levels of marks, a frequency sentence ("About 1 in 8 notes in this song are marked unsure"), and a "Show uncertainty" switch. Display groups these options:

- theme (System / Night Rehearsal / Daylight) and contrast;
- "Where is your screen?" and Reading size;
- Hyperlegible font;
- Follow (Page / Scroll / Off);
- playhead style (line, block, subtle, on the Soundslice model);
- Reduce motion.

The song map is the existing 48 px tall overview strip, upgraded. At the top are section chips (V3): tapping a chip loops exactly that section, the labels are editable, and when there is no data the fallback names "Part A/B/C" are used, following the downbeat-aligned Sections of Moises ([Moises](https://moises.ai/newsroom/product-announcements/new-song-sections-feature)). Below the chips are the waveform, the bar ruler, the loop band with handles, hatching on unsure bars, and the now-line. Section data already exists in the data model but has never been shown in the UI, so phase 3 must check whether the pipeline actually produces sections before promising chips. The timeline already supports zoom, but it is turned off. Turning zoom on in the song map needs precomputed peaks at several resolutions, which is a side item.

### The Now column and canvas: readable from 75 cm

The Now column on the left is the glanceable region and contains, from top to bottom:

- the current chord at a very large size with its shape diagram (mirrored for left-handed players);
- the beat pulse, i.e. the V9 visual metronome: four dots, with a differently shaped dot for the downbeat, pulsing by changing size within a small area instead of flashing, and switching automatically to marking only the downbeat when the tempo is high enough to reach the 2.3.1 threshold;
- the next chord with "in 3 beats";
- the two chords after that;
- the Level & capo button.

To be clear: the notes found no product with a large "current chord / next chord" card and a countdown. The closest is the grid mode of Moises, where chords "take over the screen in large type" ([Moises](https://moises.ai/blog/moises-news/apple-design-awards-nomination)). Splitune already has "Next · in N beats" on the piano strip, so the Now column is an extension with an internal basis, not yet a pattern the market has validated.

The canvas in the middle draws tab with rhythm stems, chord names above the bars, the shaded background of the bar being played, the amber playhead, the loop bracket, and unsure notes with a dashed outline plus a "?" mark. No state is shown by colour alone. Follow mode has three values, Page / Scroll / Off. Page is the default, and the only mode when Reduce motion is on. Off is for editing.

### Inspector: four tabs, four questions

The inspector on the right takes its cue from the Track Inspector of LUNA 2 ([bonedo, via a search summary](https://www.bonedo.de/?p=2638133)) and the stacked panels of Live 12 ([CDM](https://cdm.link/ableton-live-12-everything-new/)). On wide screens it is docked; on narrower screens it collapses into a drawer.

**Loop** answers the question "which passage to loop, and how". This tab has:

- two fields, From bar / To bar, with stepper buttons, keeping the ‹ › buttons that nudge an edge by one sixteenth note as today, plus ±1 bar, "Shift loop" (moves by exactly the loop's length, i.e. on to the next phrase) and ×2 / ÷2;
- speed ladder V1 with the parameters Start, Target, Step, clean passes per step, drop one step after N failed passes, the action at the end, and a count-in before each pass. This is the Soundslice parameter set, plus the two things Soundslice still lacks: decreasing the tempo and saving presets;
- Rest between repeats, Count-in, and an "Ask how each pass went before the next" switch;
- the Saved clips list, which finally gets Rename and Delete. The API for deleting clips already exists; renaming needs to be checked.

**Mix** answers the question "what to hear". This tab has:

- every stem, with your part at the top and labelled "Your part";
- for each stem, M/S letters, a fader, a dB field, Quieter/Louder buttons in place of dragging, and a "Rough" label when the separation is poor;
- a Click channel, a Chord synth channel and Master;
- three presets: "Your part loud", "Minus-one" and "Original";
- a "changed" dot on the entry point to Mix, on the Capo model;
- a limiter at unity.

The MVP currently has only two channels (the part and Backing), while the home page promises "separate faders for guitar, bass, drums, vocals and keys". The multi-stem mixer is therefore new scope that needs the pipeline to export and store multiple stems, not a re-skin.

**Progress** answers the question "am I getting better". This tab has the automatic log, the clip's best clean tempo over 30 days (the per-clip pass history endpoint already exists but is not used yet), this session's "First clean pass" compared with the previous session's, seven dots for seven days, and the "Warm up with yesterday's hard bars" button. No streaks.

**Fix** answers the question "what might be wrong". This tab has:

- a queue of unsure spots, ranked by consequence (wrong pitch or wrong string/fret, octave error, wrong chord root or quality) instead of by raw probability;
- ranked alternatives, with the copy "Second guess · about 1 in 3";
- a "Hear it over the loop" button to audition an alternative over the loop, close to the synth overlay of Soundslice ([Soundslice](https://www.soundslice.com/help/en/player/advanced/313/synth-overlay/));
- "Replace all in this song";
- an "edited" mark that does not rely on colour, Revert for each item and a "Show original" switch;
- beat corrections: "This is beat 1", Half tempo, Double tempo, Move downbeat. Once a correction is made, re-quantize runs right in the browser with `music-core`, with a line stating the consequence, such as "Re-barred 84 bars — Undo".

The copy must say "Your fixes are saved for this song", without implying that the model learns from them.

### The transport dock and the question after each pass

The transport dock contains, from left to right:

- Restart (which becomes "Restart loop" while looping);
- Play at 64 px;
- Next bar;
- position, which you tap to switch between bar.beat and time, on the Capo model;
- the loop pill "Loop 17–20 · pass 2";
- the − / + tempo group with "75 % · 72 BPM"; Shift for 1 % steps; tapping the readout opens the slider and the presets 50/60/70/75/80/90/100;
- Count-in;
- Click;
- Mix preset;
- volume.

The tempo range in Practice is currently locked to 50–100 %, while Settings allows 25 % and the URL up to 200 %. The redesign should settle on one wider range, including passes faster than the original at 105–110 %, as the practice science notes suggest. The lowest setting must be checked for time-stretch quality, because users have reported distorted sound at very slow tempos ([ASD App Store](https://apps.apple.com/us/app/amazing-slow-downer/id308998718)). After each pass, the question line "Pass 2 at 75 % — how was it?" appears right on the dock with two buttons, "Felt clean (C)" and "Not yet (N)". The question contains the tempo so that every answer is a complete data point for Progress. The dock and every sheet must pass the 2.4.11 check: the focused element is never completely covered.

### The new key and pedal map

| Action | Current | Proposed | Reason |
|---|---|---|---|
| Play / pause | Space, Enter | Keep; right pedal after running the wizard | The two pedals must go to the most important pair of actions |
| Restart loop / back one bar | ←, PageUp | Keep; left pedal after running the wizard | "Repeat until stable" |
| Next bar | →, PageDown | Keep | AirTurn Mode 3 sends PageUp/PageDown |
| Slower / faster 5 % | ↓ / ↑ | `,` / `.` (hold Shift for 1 % steps). Until a pedal is configured, ↑/↓ shows the PedalHud "Pedal detected? Set it up" | AirTurn Mode 2 sends Up/Down by default |
| Felt clean / Not yet | C / N | Keep; assignable to a third and a fourth pedal | Rate the pass without using your hands |
| Loop on/off, Mute your part | L, M | Keep | — |
| Next unsure | — | New key, assignable to a pedal | Go through the flags without scanning by eye |
| Command palette | — | ⌘/Ctrl K | Navigation and less-used commands |
| Single-character shortcuts | Always on | A switch: On / Off / only when the practice area has focus | WCAG 2.1.4 |

Every action still shows an on-screen confirmation as it does today ("Speed 75 %", "Loop · bars 5–6"), but the new threshold is 100 ms. Pedal keys never scroll the page or activate the focused control. On the widest screens, all five regions are shown together. On narrower screens, the inspector collapses into a drawer toggled by a button, and the Now column shrinks into a horizontal strip above the canvas. It is at these layout breakpoints that Stand view and the phone layout split off into surfaces of their own.

## The remaining surfaces: one role per device

### Piano and drums

For piano, the "Notes" view (notes falling onto the keyboard, lit keys with L/R for each hand) is a supporting tool, not the main view. There is experimental evidence that separating the note display from the keyboard creates a split-attention effect: projecting a piano roll directly onto the keys works better than Synthesia-style falling notes on a separate screen ([Rogers et al. 2014](https://www.uni-ulm.de/fileadmin/website_uni_ulm/iui.inst.100/1-hci/hci-paper/2014/2014-gugenheimer-piano.pdf)). Learners also complain that horizontally scrolling notes make the move to reading real sheet music harder ([r/pianolearning](https://libreddit.winscloud.net/r/pianolearning/comments/1b8slc5/how_do_you_think_about_learning_piano_online/)). So Chart and Staff stay in front, and the keyboard sits at the bottom of the notation area. Muting a single hand, so that the other hand keeps playing while you play this one, needs audio separated by hand. Splitune currently has only per-instrument stems, so this is later scope; for now a synth can play the other hand.

Drums get a five-lane grid (Cymbals, Hi-hat, Toms, Snare, Kick), a legend in the style of the Soundslice "percussion legend", because percussion notation is not standardised ([Soundslice](https://www.soundslice.com/help/en/player/advanced/329/percussion-legends/)), and a mixer per drum ("Kick only", "Drums minus snare") that is already planned in step s30. Drummers have both feet busy, so the experience must not depend on pedals. Instead there are self-repeating loops with a count-in, a "continue after N passes" option, the Far distance preset as the default, and the option to assign a pad of an electronic kit via Web MIDI in browsers that support it.

### Stand view on tablets

Stand view is where the ideas of direction C are used, without becoming the shared visual language. It consists of:

- the current and next chords at a large size;
- the counter "Bar 18 of 64 · Loop 17–20 · pass 2" in tabular figures;
- one large tab system, guaranteed to fit entirely on screen, as the Paged mode of Soundslice promises;
- pedal hints along the bottom edge ("Left pedal: Restart loop · Right pedal: Play");
- page turns driven by the audio clock.

Newzik has to listen through the microphone to turn pages ([Newzik](https://en.blog.newzik.com/blog/audiomatching-tourne-page-cest-quoi)); Splitune knows the exact playback position, so it can do this without a microphone. With the tablet in portrait, two tab systems are stacked. When the playhead moves to the lower system, the upper system is replaced by the next one (a half-page turn), so the eye can always see the next bar. With the tablet in landscape, a slice of the next bar shows at the right edge. Pressing a pedal to turn the page by hand always wins over the automatic turn. The wake lock is held throughout the session.

### Phones: glance first, Tools when needed

Practice on a phone in portrait defaults to the glance view: the current chord at a large size with its shape diagram, the next chord with "in N beats", the bar.beat position, the loop pill and a "Loop this bar" button. The transport is within thumb reach. This is also where the biggest current gap gets closed: **on phones there is no button at all to open the mixer, count-in, metronome, volume, level, capo or piano options.** The "Tools" sheet follows the Capo Control Strip model: a row of control sets (Speed / Mix / Count-in & click / Level & capo / Volume), each with a "changed" dot ([Capo](https://supermegaultragroovy.com/products/capo/help/ios/4.5/control-strip/)). Every control has step buttons in place of dragging (2.5.7). When the phone is turned to landscape, the view switches to a horizontally scrolling tab strip in the "only scroll when necessary" style, with a compact bar ruler.

### Library

Library on desktop opens with the Continue card and the Progress strip. Below them is a grid or list of songs, keeping search, the instrument and status filters, sorting and URL state. Each song card has an instrument tile, the song title, a status badge, "Practised 3 days ago" and "Best 85 % on bars 17–20". Songs that are processing show the stage name and a range ETA. Failed songs show the reason, "This didn't use an analysis." and Try again. Songs whose stems have expired show "Re-create stems". On phones there is only the list view, Add song sits in the bottom bar, and secondary actions sit in an overflow menu, with no swipe gestures. The "Needs connection" offline state, which dims songs that have not been saved for offline use, belongs to V10 and should ship with this phase.

### Marketing, sign-in, onboarding and pricing

The home page must stop promising what the app does not do yet. The line "separate faders for each instrument" may only stay once the multi-stem mixer exists. The "How accurate is it?" block uses frequency wording and the "Works best with / Has trouble with" list. The screenshots are of the real Practice screen in the default theme. Sign-in keeps username and password, the "Continue with Google" button only appears when it is configured, and there is no email. Onboarding turns the "Where's your screen?" step into a real reading-distance test: users put the device exactly where they will play, look at the sample chords Am and F with the tab "0 2 2 1 0" at the chosen preset, then choose "I can read it" or "Bigger". The result becomes the Reading size. Piano and drums only lose "Coming soon" once there are sample songs for them. Pricing keeps the "Demo mode" banner, never has a card entry field, and keeps an honest feature matrix, in line with spec 25 on personal mode.

### Settings and the pedal wizard

Settings has six sections: Profile, Display & reading, Keyboard & pedal, Plan & billing, Privacy and About. About is new and holds the app version, the transcription model version and the font licences. Display & reading groups theme, contrast, reading distance, Reading size, Hyperlegible font, Reduce motion, Show uncertainty and Follow mode. This section also has a Practice defaults subsection: starting tempo, count-in, rest between passes, and "Sound delay" replaced by a "tap along" calibration step with a compensation range wide enough for Bluetooth headphones.

Keyboard & pedal opens with the question "Have a pedal? Set it up", which leads into the pedal wizard:

1. "Press your left pedal", capturing whatever key the device sends, whether that is Up/Down from Mode 2, PageUp/PageDown from Mode 3 or Space/Enter.
2. "Press your right pedal".
3. Show the resulting mapping (left pedal = Restart loop, right = Play), with the option to swap the two pedals and to assign more pedals.
4. Automatically unassign conflicting default keys.
5. Finish with a test area.

PedalHud also opens this wizard when the user presses ↑/↓ for the first time before anything has been configured. The existing per-action "Learn this pedal" table is kept for advanced users, along with the switch for single-character shortcuts.

### System states

Every existing state is redesigned as a whole, leaving no screen in the old style:

- the unsupported browser page, which names exactly what is missing ("AudioWorklet, which plays your stems in sync");
- the offline banner;
- "A new version is ready", never shown during playback;
- the in-app browser banner;
- the tip shown when the screen cannot be kept awake;
- "Playback paused by another app or a call." with a "Tap to resume" button;
- the 404 page and the error page with an error code;
- the dialogs for renaming, deleting a song and deleting the account (with a step that re-confirms identity);
- the toasts "Edit saved" with Undo, "Renamed.", "Song deleted.";
- "Processing machine offline".

The voice keeps the current standard: a calm coach, short sentences, real numbers, no emoji, and errors that always follow the structure "what happened, what it means, what you can do".

## Eight phases, each replacing a whole screen

The Kontakt 8 lesson decides how this is rolled out: each delivery replaces a whole screen, never leaving new and old parts on the same screen. Tokens go first so that every new component stands on the same foundation. Every component and every screen has a story for each state, run with axe on Chromium and WebKit (`pnpm --filter web test:stories`). A new screen stays behind a feature flag until it reaches feature parity with the old one, and then the old one is removed entirely. Phase 0 has one more task that is procedural but mandatory. `CLAUDE.md` and `AGENTS.md` currently state that the UI must follow the "Music Stand" system (docs 26–28), so a new spec replacing 26–28 must be written and that rule changed before any code. Spec 25 on personal mode remains binding: mock billing, and no billable Railway or Cloudflare resources enabled without asking.

| Phase | Deliverables | Repo area | Size | Exit gate |
|---|---|---|---|---|
| 0. Choose the direction and test the music stand | Static Practice prototype in three token sets; music stand test; ADR choosing the default; new spec replacing docs 26–28; change the UI rule in `CLAUDE.md`/`AGENTS.md` | `docs/specs`, an experimental route behind a flag in `apps/web` | S–M | The test's decision rule produces a result backed by data |
| 1. Foundations | OKLCH primitives (warm graphite, amber, 6–8 stem hues per mode); Night / Daylight / More contrast generator; fonts (Instrument Sans, JetBrains Mono, Bravura, keep Atkinson); icon set; re-skin of the base components (button, toggle, tabs, slider, number-field, dialog, drawer, popover, toast, badge, kbd) | `packages/ui-tokens/src/*` (primitives, themes, theme.tailwind, fonts, tests), `scripts/fonts`, `apps/web/app/ui/*` and `icons`, story files | L | Contrast and palette tests green in every theme; colour-blindness simulation for stems; axe passes; `check-ui-tokens` passes |
| 2. Practice core, keyboard and pedal | Five-region layout; top bar; song map (no sections yet); canvas (rhythm stems, bar background, playhead layer driven by the audio clock, Follow Page/Scroll/Off); transport dock and the question after each pass; inspector with Loop and two-channel Mix; new keymap; single-character key switch; pedal wizard; PedalHud | `apps/web/app/features/practice/*` (`layout.ts`, `model/keymap.ts`, status bar, transport, timeline), `packages/notation`, `packages/audio-engine` | L | Keyboard-only E2E; confirmation ≤ 100 ms; 2.4.11; a loop created in ≤ 2 actions, under 3 s |
| 3. Practice depth | Speed ladder V1; sections V3; multi-stem mixer with click and chord synth; Fix tab (queue, audition, re-quantize with preview); Progress tab (30 days, first clean pass of the session); visual metronome V9; Now column; rename and delete clips; latency calibration; piano and drum views | `features/practice`, `packages/contracts` (trainer, sections, Progress metrics), `packages/music-core`, `packages/audio-engine`, `services/ml` and `apps/node-worker` (stem export), `apps/api`, `packages/analytics` | L | 2.3.1 checked at high tempos; retention metric recorded; PAIR trust probes for Fix; confidence calibrated per stage before it is shown |
| 4. Library, Add song, progressive processing | Top-bar shell, ⌘K, drop files anywhere, allowance meter; Add song modal/sheet; stage timeline with artefacts; "Is this your instrument?"; Notify me when ready (service worker, push subscription endpoint); Continue card and Progress strip | `features/shell`, `features/library`, `features/import`, `ui/stage-list.tsx`, `apps/api/src/events.ts`, `apps/api` (push subscriptions), `packages/contracts`, `packages/db` | M–L | App open to first audible pass < 10 s; the ETA never stalls; the live region announces only milestones; push permission requested only when the user presses the button |
| 5. Phone and Stand view | Glanceable Practice on phones with the Tools sheet; landscape layout; Stand view with half-page turns driven by the audio; pedal hints | `features/practice/layout.ts` and the per-device views, `packages/notation` | M–L | Tested on real devices (iPad Safari, Android Chrome); 15-minute wake lock; never turns the page in the middle of a system |
| 6. Marketing, auth, onboarding, settings, billing, system states | Home, How it works, Pricing (mock), Sign in and Create account, onboarding with the reading-distance test, the six Settings sections and About, system pages, toasts, dialogs | `features/marketing`, `auth`, `onboarding`, `settings`, `billing`, `system`, `apps/web/messages/en.json` | M | Copy test finds no hard-coded strings; axe passes; every state has a story |
| 7. QA and release | Playwright E2E on the Tier 1 browsers; visual regression; playhead performance; rerun the music stand test on the real build; remove the old screens and the flags; update `docs/status.md`, `docs/progress-log.md` | All of `apps/web`, `docs` | M | Every acceptance criterion met; no old-style screens left |

### Acceptance criteria

| Criterion | Threshold | How to check |
|---|---|---|
| Colour is never the only signal (1.4.1) and non-text contrast (1.4.11) | Confidence, loop, clean/not yet, "Rough" stems and the downbeat all have a shape or text; ≥ 3:1 | Stories with colour-blindness simulation; `contrast.test.ts` |
| Text contrast (1.4.3) | ≥ 4.5:1 in Night, Daylight and More contrast, including tab digits and the thin strokes of notation | Token tests; axe |
| Single-character shortcuts (2.1.4) | Can be turned off or remapped, or are active only with focus | E2E |
| Pause, Stop, Hide (2.2.2) | Pausing playback stops the scrolling | E2E |
| Flashing (2.3.1) | No more than 3 flashes per second at any tempo; the pulse stays within a small area | Unit test of the pulse schedule at high tempos; visual check |
| Focus not obscured (2.4.11) | The dock, the Tools sheet and the drawer never completely cover the focused element | Keyboard E2E with the dock and sheets open |
| Dragging movements (2.5.7) | Loop handles, faders, tempo and dividers all have step buttons or a number field | E2E without dragging |
| Target size | ≥ 24 px for AA (2.5.8); internal rule ≥ 44 px; main practice controls 64 px | Lint or stories that measure size |
| Reduced motion | Page-by-page turns, playhead moves in steps, no fades | Stories with an emulated media query |
| Feedback | Every key and pedal press confirmed in ≤ 100 ms | Automated timing in E2E |
| Play-along latency | A tap-along calibration step; a compensation range wide enough for Bluetooth; offset ≤ 25 ms after calibration | Device testing, wired and wireless |
| Loop efficiency | A loop created in ≤ 2 actions, < 3 s; app open to first audible pass < 10 s | Moderated test |
| Pedals | A pair can be set up in < 30 s with AirTurn Mode 2, 3, 5 and the three iRig modes, on iPadOS Safari, Android Chrome and desktop | Device matrix |
| Wake lock | The screen does not dim for 15 minutes, both in a browser tab and in the installed PWA | Device testing |

### Research and testing gates

| Gate | Question | Method | Decision that depends on it |
|---|---|---|---|
| G0 (phase 0) | Which theme reads best at 0.5 / 0.75 / 1.5 m? | The music stand test above | Default theme for Practice and Stand view |
| G1 (phase 1) | Does JetBrains Mono make tab digits easier to tell apart than Instrument Sans or Inter with tabular figures? | Reading digit sequences at three distances | Font for tab digits |
| G2 (phase 3) | Is the confidence of each stage (beats, chords, notes) calibrated? | Reliability diagrams on the eval set | Which stages show unsure marks |
| G3 (phase 3) | Does the Fix queue help users trust the output to the right degree? | PAIR trust probes, task completion time on fixtures | Flag threshold and density |
| G4 (phase 2) | Can the wizard pair every pedal mode? | AirTurn and iRig matrix across three browsers | Default keymap |
| G5 (after phase 3) | Do the ladder's step size and clean passes per step affect the clean pass in the next session? | In-app A/B test, measuring the first clean pass of the next session | Ladder defaults |
| G6 (phase 5) | Can the Tools sheet on phones be used while holding the instrument? | Moderated test with the instrument in hand | Order of the control sets |
| G7 (phase 2) | Is `getOutputTimestamp` on Safari reliable? | Measure the playhead offset against the audio | Whether the `currentTime` fallback is needed |

### Risks

| Risk | Early sign | Mitigation |
|---|---|---|
| Dark notation is hard to read in daylight | G0 leans towards Daylight or B | Decision rule fixed in advance; Daylight one tap away |
| Instrument Sans or JetBrains Mono does not pass | Missing glyphs, no tabular figures, misreadings in G1 | Fall back to Inter 4 with Display cuts and tabular figures |
| Amber clashes with stem or warning colours | Colour-blindness simulation cannot tell them apart | Remove the orange–yellow hue range from stems; warnings use shape |
| The multi-stem mixer costs compute and storage | Separation time on the Mac rises sharply; R2 free-tier storage | Estimate first; ask the owner before expanding billable resources |
| Web Push on iOS only works with an installed PWA | iOS users do not see the button | In-app toasts, badge and tab title updates as the main path |
| Half-finished interface transition | A screen that is part new, part old | Per-screen flags; remove the old version in phase 7 |
| New scope disguised as a re-skin | Phase 3 drags on | The scope classification table below; V1, V3, V9 planned as features |
| Too many unsure flags make users ignore them | Users turn off "Show uncertainty" | Merge into "shaky bar"; rank by consequence; run G3 |
| The cursor jitters like alphaTab bug #318 | The playhead overshoots and then snaps back | Beat–time map, no extrapolation |

### New scope or just a re-skin

| Item | Type | Backend dependency | Size |
|---|---|---|---|
| Tokens, type, icons, base components, layout of every page | Re-skin and restructuring | None | L in total |
| Top-bar shell, Add song as a modal, route map | Restructuring | None | M |
| Allowance meter in the shell, Follow "Off", post-pass question with the tempo, ⌘K, About, single-character key switch | UI on existing data | None | S each |
| Tools sheet on phones | UI on existing controls | None | M |
| Rename and delete clips | UI on an existing API (delete exists; rename needs checking) | May need additions | S |
| Progress tab with 30-day history | UI on an endpoint not yet used | Add the first-clean-pass-of-the-session metric | M |
| Artefacts in the stage timeline, "Heard: …" | UI on data not yet shown | None or little | S–M |
| Speed ladder V1 | New scope | Trainer contract already exists | M |
| Sections V3 | New scope | Need to check whether the pipeline produces sections | M–L |
| Visual metronome V9 | New scope | None | S–M |
| Multi-stem mixer, chord synth channel | New scope | Pipeline, storage, audio engine | L |
| Fix tab: queue ranked by consequence, re-quantize with preview, Replace all | New scope, partly built on the existing editor | Ranking needs eval data | L |
| "Is this your instrument?" and changing the part without re-uploading | New scope | Rerun the downstream stages | M |
| Notify me when ready (Web Push) | New scope | Service worker, endpoint, subscription table | M |
| Stand view with page turns driven by the audio | New scope | None | M |
| Pedal wizard, latency calibration | New scope | None | S–M each |
| Per-drum mixer (s30), per-hand mute for piano | New scope, later | Deeper stem separation | L |

This table shows that the pure re-skin, although large in volume, carries low risk. The parts that decide the experience (ladder, sections, multi-stem mixer, Fix, Progress, notifications) are new features, and they should be estimated, reviewed and gated as features, not as an interface change.

## Conclusion

The changes with the biggest impact in this plan are also the cheapest, and none of them is visual. Taking ↑/↓ off tempo so that an AirTurn left in its factory mode does not wreck a practice session, widening the latency compensation range for Bluetooth headphones, and measuring the first clean pass of the next session instead of minutes: these three changes fix problems that no re-skin, however beautiful, can hide. Conversely, the most contested question, dark background or paper background, turns out to be reversible, because when Night and Daylight are generated from the same four parameters, the music stand test only picks the default value, not the identity. That makes it possible to pursue A with confidence without betting the product's readability on it.

Competitively, now that Songsterr already turns audio into tab within minutes, Splitune's lasting advantage lies not in the transcription but in two moments that competitors leave empty. The first is the wait, when users can already practise on their own audio while the stems are still being separated. The second is the moment of doubt, when a "?" mark leads straight to a slow audition over the loop instead of a probability figure. If the redesign makes those two moments shorter and more honest, the rest of the interface only needs to stay out of the way.
