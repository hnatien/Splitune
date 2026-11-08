# UX teardown: interactive notation/tab players and instrument-learning apps (input for the Splitune redesign)

Research date: 2026-11-08. Primary sources are vendor help centres and manuals (Soundslice, Songsterr, Guitar Pro, MuseScore, Melodics, forScore). Secondary sources are dated reviews and forums. Anything older than about 2024, or taken from an aggregator, is flagged inline. "BYO song" means the Splitune model: the user brings the audio and the app generates notation.

## 1. Notation display: layout modes, playhead/cursor, auto-follow, zoom, bar numbers, rhythm in tab, chords, lyrics

### Takeaway
Soundslice is the best-documented reference. It offers **Scrollable** (vertical or horizontal) and **Paged** layouts, five explicit playhead-scrolling policies, configurable playhead shape and colour, optional bar highlighting, and a focus mode that re-engraves a selection on its own. Guitar Pro separates "Page" (print-like) modes from "Screen" (work) modes. Songsterr uses line-based tab with rhythm stems under the tab staff. All the tools treat auto-follow as a user-selectable policy, not a fixed behaviour.

### Cited Findings
**Soundslice layouts**
- Two layouts: **Scrollable** (the default; continuous, vertical or horizontal) and **Paged** (one screenful at a time, "as you would in a PDF reader"). "Pages per screen" defaults to Auto and shows 2 pages when the notation width is at least 1500 px. Prev/next buttons are hidden during playback. — [Soundslice help: Scrollable vs paged](https://www.soundslice.com/help/en/player/advanced/241/scrollable-vs-paged-layout/)
- Horizontal Scrollable is recommended for playing or singing along with a recording ("bouncing ball" feel). Clef and key signature stay pinned at the left edge. It also suits multi-instrument editing because each instrument forms one continuous line. — [same](https://www.soundslice.com/help/en/player/advanced/241/scrollable-vs-paged-layout/); persistent clef/key in horizontal layout shipped Feb 2026 — [Soundslice blog listing](https://www.soundslice.com/blog/rendering)
- Paged layout (Mar 2023): page size is computed on the fly from screen size, zoom, stave width and the music. "Each stave of music is guaranteed to fit fully on the screen, with no scrolling whatsoever." The stated rationale: auto-scroll locks you to a tempo and manual scrolling is finicky, so pages are a third option. Navigation is a click or tap on the left or right edge. Holovaty admits the earlier "Paged" layout was misnamed and "should have [been] called Fixed-Width layout". — [Soundslice blog: Introducing our new Paged layout](https://www.soundslice.com/blog/241/introducing-our-new-paged-layout/)
- An older (Apr 2022) "Auto" mode picked Paged on large notation areas and Fluid on small ones, because on big screens a paged view that "honors intentional line breaks" reads better. **Outdated:** these four modes were collapsed into Scrollable/Paged in 2023. — [Soundslice blog: Auto layout](https://www.soundslice.com/blog/218/introducing-auto-layout-mode/)
- Other display features: proportional notation (equal durations take equal space, Dec 2022), an image layout for practising directly on a PDF or photo (Aug 2025), "Respect author's stave breaks", notation width and hiding empty staves. — [Soundslice blog listing](https://www.soundslice.com/blog/rendering); [player help index](https://www.soundslice.com/help/en/player/)

**Soundslice playhead and auto-follow**
- The playhead is an orange vertical line. Scrolling policies:
  - "Keep playhead at top of screen" (default in vertical Scrollable)
  - "Keep playhead in middle"
  - "Only scroll when necessary" (default in horizontal; shows one screenful, then scrolls near the right edge)
  - "Keep playhead at left" (horizontal only; the music scrolls behind a fixed playhead)
  - "Disable automatic scrolling" (useful when editing)
  - Settings are saved per slice for paid users. — [Soundslice help: Playhead scrolling options](https://www.soundslice.com/help/en/player/advanced/116/playhead-scrolling-options/)
- Playhead shapes: Line (default), Small rectangle (for people who find the line "too in-your-face"), Wide rectangle, and Hidden during playback. Colours: Orange (default), Subtle, Blue, Yellow. "Highlight current: Notes" is on by default and some players turn it off so they can read ahead. "Highlight current: Bar" adds a coloured background behind the playing bar. — [Soundslice help: Playhead style/color](https://www.soundslice.com/help/en/player/advanced/292/playhead-style-color/)

**Soundslice focus mode and size**
- Focus mode: from a loop, "Focus" hides everything outside the selected bars. The range is extended to the nearest barlines and re-engraved as a standalone piece with clef, key and time signature, laid out across the full screen (helpful on small screens). A bottom panel shows editable bar numbers. Close turns the focus into a loop. — [Soundslice help: Focus mode](https://www.soundslice.com/help/en/player/basic/277/focus-mode/)
- When notation is too small, the help suggests zooming, unchecking "Respect author's stave breaks", moving the video above the notation, or using Horizontal layout. Dense bars force the engine to shrink the notation. — [Soundslice help: Notation too small](https://www.soundslice.com/help/en/player/troubleshooting/311/notation-too-small/)

**Soundslice learner aids**
- Rhythm counts ("1 e + a") above the notes, omitted for tuplets. — [Soundslice help: Rhythm counts](https://www.soundslice.com/help/en/player/advanced/325/showing-rhythm-counts/)
- Also listed: pitch names (including movable-do), Boomwhackers colours, expanding repeats, chord-chart view, lyrics-only view, lyrics above the staff (Sept 2026). — [player help index](https://www.soundslice.com/help/en/player/); [blog listing](https://www.soundslice.com/blog/rendering)
- Percussion legend: a key at the top of the notation that lists every distinct drum note and its sound, because "percussion notation isn't standardized". In Paged layout it appears only on the first page and it reflects the top-most visible instrument. — [Soundslice help: Percussion legends](https://www.soundslice.com/help/en/player/advanced/329/percussion-legends/)

**Guitar Pro 8**
- Page modes: Vertical (print-like), Horizontal (pages side by side), Grid (pages per row adapt to window width) and Scroll (no page breaks).
- Screen modes: Vertical (bars fill the window, for single-track editing) and Horizontal (tracks stacked side by side, for multitrack).
- A default mode can be forced in preferences. Notation types include tablature, standard, rhythmic and jianpu. — [GP8 docs: Page and Screen modes](https://www.guitar-pro.com/docs/gp8/display-options/page-screen)

**Songsterr**
- Tab is engraved like a score, with time signatures and duration stems beneath the tab staff. One forum user singles out "rhythm notation below the tab staff" as the reason to prefer it. The playback cursor is a green vertical line. — [GuitarChalk review, Apr 2026](https://www.guitarchalk.com/full-songsterr-review/); [BassBuzz forum](https://forum.bassbuzz.com/t/ultimate-guitar-versus-songsterr/64692)
- Shortcuts show a line-based layout: Left/Right moves the cursor and Up/Down moves a line. Double-clicking a beat plays from there. Web has a Tab↔Sheet toggle that the mobile apps lack. Drum notation is Alt+L on web. Chords and lyrics appear only if the transcriber added them, and the help says few do. — [Songsterr help](https://www.songsterr.com/help)

**Ultimate Guitar**
- The chords/lyrics text format offers autoscroll (Pro), transpose, Simplify, chord-variation picker, left-handed mode, adjustable font style/size and dark mode. Official tabs come with backing tracks and synchronized lyrics. — [UG App Store listing](https://apps.apple.com/us/app/ultimate-guitar-chords-tabs/id357828853)
- A UG/Muse patent describes "context-based tab autoscrolling":
  - It parses tab structure (staff lines, chords, lyrics) and re-splits lines to fit the viewport while keeping chords attached to their lyric syllables.
  - It sets a per-segment scroll interval from tempo, bar count, lyric length and chord durations, times a user playback factor of 0.1–1.5.
  - Title and artist stay pinned. It does not detect whether the user is playing. — [US11749238B1](https://patents.google.com/patent/US11749238)

**MuseScore.com player**
- Controls: rewind, play/pause, a bar-range loop, speed 50–200%, a mixer (mute/solo per instrument), zoom and fullscreen.
- A keyboard icon switches the score to a **piano-roll mode** (bars with pitch, duration, keys and bar number; web only). A note icon shows a keyboard at the bottom that highlights the keys being played.
- Transpose is only available in the mobile app and desktop software. — [MuseScore help center](https://intercom.help/musescore/en/articles/8535930)

### Inferences
- For Splitune's tab and notation views, the strongest pattern is the Soundslice one: offer one or two layouts and make the scroll policy a visible, remembered setting. A sensible default is "keep playhead at top" for vertical and "only scroll when necessary" (page-flip style) for horizontal, with "disable auto-scroll" for correction mode.
- Bar highlighting (a background behind the current bar) is a cheap, colour-independent orientation cue. It pairs well with Splitune's bar-snapped loops and gives a natural place to anchor a confidence indicator per bar.
- Focus mode (re-engraving a loop as a standalone mini-score) suits phones and fits Splitune's "practise this section" flow better than zooming a full score.
- Rhythm in tab: Songsterr and Soundslice users value stems under the tab. A "tab without rhythm" view is an anti-pattern for learning from a recording.
- A percussion legend is a direct, low-cost answer to the drum notation readability problem for Splitune's planned drum view.

### Gaps
- I found no documented behaviour for how any player resumes auto-follow after the user scrolls by hand (Soundslice, Songsterr or UG). This needs hands-on testing.
- Section labels, repeat rendering and bar-number placement conventions across products were not documented in the sources I read.
- MuseScore 4 desktop view modes (page, continuous horizontal and vertical, single page) and its auto-pan behaviour: the handbook URL I tried does not exist, so this is unverified.
- Songsterr's exact mobile portrait layout is not described in the official help.

## 2. Sync with real audio vs MIDI playback (Soundslice syncpoints, how the playing bar is shown, video/notation arrangement)

### Takeaway
Soundslice's model is the reference: **syncpoints** map each bar downbeat (plus optional inner-bar "guide notes") to a recording timestamp. You tap T on downbeats, drag to correct, or use auto-align. Bar numbers are "absolute", so repeats get extra syncpoints. Guitar Pro 8's audio track and MuseScore.com's YouTube sources copy this model with bar markers dragged onto a waveform. Songsterr's AI tabs play along with the source audio or YouTube. UG and free Songsterr use MIDI, which users call stiff.

### Cited Findings
**Soundslice syncpoints**
- Workflow:
  - The first syncpoint marks bar 1.
  - "Play the recording and press T at each barline."
  - Syncpoints are numbered from 1. Repeats or jumps produce more syncpoints than barlines.
  - The player's progress bar shows the "absolute" bar number, which matches the syncpoint numbers.
  - Errors are fixed by dragging or deleting a syncpoint.
  - Rubato passages use "guide notes" to sync individual notes.
  - Click-track recordings need fewer syncpoints. — [Soundslice help: Adding syncpoints](https://soundslice.com/help/en/creating/syncing/171/adding-syncpoints)
- Automatic sync (paid): "Sync with notation" aligns a recording to existing notation and can add inner-bar syncpoints. "Detect beats" guesses barlines but needs 3 manual syncpoints first. Implied syncpoints are drawn in light grey between real ones. — [Soundslice help: Automatic syncpoints](https://www.soundslice.com/help/en/creating/syncing/296/automatic-syncpoints/) (via search summary)
- The syncpoint editor was redesigned in Mar 2025, and "auto-align audio with notation" shipped in 2025. — [Soundslice 2025 year in review](https://soundslice.com/blog/302/soundslice-year-in-review-2025/)
- **Synth overlay**: plays the notation's synth sound on top of the real recording, timed by its syncpoints. It still works with speed changes and loops and has a volume slider against the original. The stated use is checking a transcription's pitch and timing ("If the overlay doesn't line up, the transcription's timing may be wrong"). — [Soundslice help: Synth overlay](https://www.soundslice.com/help/en/player/advanced/313/synth-overlay/)

**Soundslice video pane**
- Video sits **above** or **to the left of** the notation, toggled by a button. A draggable divider reflows the notation, and dragging far enough makes the video fullscreen or hides it (a "nib" brings it back).
- Fullscreen video shows a waveform below it for click-to-seek and fine loop dragging. Video can be flipped horizontally (mirror for lessons). YouTube cannot be hidden because of embedding minimums.
- The layout is saved across slices for paid users. — [Soundslice help: Adjusting videos](https://www.soundslice.com/help/en/player/basic/78/adjusting-videos/)
- 2025 additions: double-tap left/right of the video to seek 10 s, drag the video to go fullscreen, and a Bluetooth latency adjustment. — [Soundslice 2025 year in review](https://soundslice.com/blog/302/soundslice-year-in-review-2025/)

**Soundslice loop precision by source**
- Audio-only loops are sample-accurate. Video loops have a slight gap between iterations. Synth loops are nearly perfect. — [Soundslice help: Looping](https://www.soundslice.com/help/en/player/basic/4/looping/)

**Guitar Pro 8 audio track**
- A grid over the waveform follows the score's bar structure. You align the start and end brackets first, then intermediate points bar by bar.
- Double-clicking a beat adds or removes a sync point. Dragging recalculates tempo without disturbing other points. Sync-point tempos override score automations.
- Sync points can be exported to the score as tempo automation. — [GP8 docs: Audio track](https://www.guitar-pro.com/docs/gp8/audio/backing-track); [GP8 what's new](https://www.guitar-pro.com/docs/gp8/basics/intro/whats-new)
- Fixed-tempo playback is unavailable with an audio track because "playback follows the audio's tempo". — [GP8 docs: Speed](https://www.guitar-pro.com/docs/gp8/audio/playback/speed)

**MuseScore.com**
- Uploaders link a YouTube video as an audio source and place measure markers (M places a marker and advances to the next measure). Only YouTube is supported, and users have asked for other sources. — [MuseScore forum](https://musescore.org/en/node/369238); [feature request](https://musescore.org/en/node/320415)

**Songsterr**
- AI-made tabs play along with "your audio file, or the YouTube video while it is available". Original YouTube audio is not available offline. If sound lags the cursor, the help suggests wired headphones. — [Songsterr help](https://www.songsterr.com/help)
- Free playback is MIDI, which "doesn't match the quality of the actual track". — [GuitarChalk review, Apr 2026](https://www.guitarchalk.com/full-songsterr-review/)

**Ultimate Guitar**
- Interactive tab playback is MIDI. Reviewers call it "stiff and rigid" (2019). The original-sound app is the separate Tonebridge. — [UG App Store listing](https://apps.apple.com/us/app/ultimate-guitar-chords-tabs/id357828853)

**Chord apps**
- Chordify: chords run synced to an adjacent YouTube embed, and a black square moves to each chord change. On iPhone the video and controls sit below the chord sheet. A commenter says it "often moves a chord change out of place". — [GuitarChalk Chordify review, Apr 2026](https://www.guitarchalk.com/chordify-review/)
- Moises: detected chords shown in a grid synced to playback, beat detection, a "Smart Metronome" synced to the song's beat, a capo setting that adjusts chord names, chord difficulty tiers, and word-by-word synced lyrics. — [Moises App Store](https://apps.apple.com/us/app/1515796612); [Moises help: Grid Mode](https://help.moises.ai/hc/en-us/articles/9570133423772-How-to-use-the-new-Chords-view-Grid-Mode) (title only; the page returned 403)

### Inferences
- Splitune already has a decoded-PCM beat and downbeat track, which is effectively auto-generated syncpoints. The redesign can show them the way Soundslice does: bar markers on a waveform, implied points in grey, and drag-to-fix. That makes beat-grid correction a first-class editing action and not a hidden setting.
- Real-audio playback is Splitune's differentiator over UG and Songsterr's MIDI. Users explicitly complain about MIDI stiffness, so keep the real stem as the default audio and offer a Soundslice-style **synth overlay** on top of it. This is also the most natural confidence check: hear the transcription against the isolated stem.
- Use absolute bar numbering (counting repeats as played) in the progress bar, because the transcription follows the recording and the recording never jumps back.
- Video/notation split: default to "media above" on portrait and "media left" on landscape and desktop, with a draggable divider and a collapse nib. Splitune's media is usually audio only, so a waveform or progress strip could replace the video pane.

### Gaps
- Soundslice's own player-side indicator of the synced bar (beyond playhead, note highlight and optional bar highlight) is not separately documented.
- Ultimate Guitar Official tabs: whether "backing tracks with synchronized lyrics" means a recording synced to the tab cursor was not confirmed.

## 3. Practice tools inside players (loops, speed trainer, count-in, metronome, mute/solo, wait mode, hands, note names, visual instruments, track picker)

### Takeaway
The table-stakes set is:
- drag-to-loop snapped to notes or bars, with draggable edges
- slow-down without pitch change
- a progressive "speed trainer" (start %, end %, step, reps per step, optional count-in each pass)
- count-in and metronome toggles
- mute/solo per track or stem
- animated fretboard or keyboard
- keyboard shortcuts

Wait mode ("waits until you play the right note") lives in the learning apps (flowkey, Synthesia, Melodics, Yousician), not in the score players.

### Cited Findings
**Soundslice loops**
- Desktop: click-drag across notation. The loop snaps to notes, rests and barlines, and everything outside it fades. Drag the edges to adjust and click anywhere to clear.
- Mobile: a Loop button creates a loop on the current bar, then you drag the handles.
- The loop menu holds Focus, "Save as clip", "Play with count-in" and "Play loop only once". — [Soundslice help: Looping](https://www.soundslice.com/help/en/player/basic/4/looping/)

**Soundslice speed training**
- Parameters: initial speed, final speed, "increase speed by", "each speed plays N times", and an optional count-in before each loop at the upcoming tempo.
- Values are % of the recording, or BPM under synth playback. Example: 50→100% by 10% × 4 = 24 passes.
- A small arrow on the speed control shows training is active. Pausing resumes at the same repetition, and setting speed by hand cancels.
- Limitations: speed can't decrease and presets can't be saved. Without a loop, the whole piece is the loop. — [Soundslice help: Speed training](https://www.soundslice.com/help/en/player/basic/286/speed-training/)

**Soundslice keyboard shortcuts and stems**
- Space play/pause; Enter/Home to start; `<` `>` speed; Ctrl± zoom; arrows for previous/next note (or ±5 s during playback); Ctrl+arrows for previous/next barline; PageUp/PageDown or Alt+arrows to turn pages. — [Soundslice help: Keyboard shortcuts](https://www.soundslice.com/help/en/player/tips/1/keyboard-shortcuts/)
- Multitrack stems: a checkbox in Instruments settings swaps the original recording for stems. Each stem has a volume slider.
- Clicking a stem name **solos** it (several can be soloed) and the other stems are visually de-emphasised. There is no separate mute button documented.
- Stems work with looping, slowdown, speed training, metronome, focus and synth overlay. Automatic stem generation from MP3 is available for your own slices, up to 16 stems (2025). — [Soundslice help: Multitrack stems](https://www.soundslice.com/help/en/player/advanced/319/multitrack-stems/); [2025 review](https://soundslice.com/blog/302/soundslice-year-in-review-2025/)

**Songsterr shortcuts**
- S speed, L loop, Shift+←/→ moves the loop's right edge, Backspace jumps to loop start, C count-in, N metronome, M mute, Alt+M solo, T tracks/mixer, E editor.
- "AI track autoswitch" in the mixer. Pitch shift instead of retuning. — [Songsterr help](https://www.songsterr.com/help)
- Speed, loop, solo, mute, count-in and pitch shift are Plus features (about US$9.99/month, monthly only). — [Songsterr App Store](https://apps.apple.com/us/app/songsterr-tabs-chords/id399211291); [Songsterr help](https://www.songsterr.com/help)

**Guitar Pro 8 speed**
- Relative speed has presets from 25–100% and accepts custom values from 10–300%. Fixed tempo can be set from 10–300 bpm.
- Progressive Speed takes a start and end value (10–300%), a repetition count and an increment. The loop is a mouse selection plus a Loop toggle. — [GP8 docs: Speed](https://www.guitar-pro.com/docs/gp8/audio/playback/speed)
- The GP mobile app lacks the speed trainer according to App Store reviewers. A new mobile app announced at NAMM 2025 promises a Speed Trainer, GP8-equivalent rendering and dark mode. **Its release status was not confirmed.** — [Guitar Pro blog, NAMM 2025](https://www.guitar-pro.com/blog/p/48507-namm-show-2025-the-prototype-of-the-new-guitar-pro-mobile-app-unveiled); [GP App Store](https://apps.apple.com/us/app/id400666114)

**MuseScore.com**
- Bar-range loop, 50–200% speed, mute/solo mixer, highlighted keyboard, piano-roll mode. — [MuseScore help](https://intercom.help/musescore/en/articles/8535930)

**Wait mode and learner aids in learning apps**
- flowkey: Wait Mode listens through the mic or MIDI and advances only on correct notes. It also offers hands separate, slow-down at 50%/75%, and loops. Reviewers call the feedback "too forgiving". — [pianoers flowkey review, Oct 2026](https://pianoers.com/flowkey-review/)
- Synthesia: Melody Practice waits for the correct note. You pick one hand and the app plays the other. Sheet music can show above the falling notes or alone. Labels can show finger numbers, note names, solfège or scale degrees. It also has speed, jump/loop on the timeline and scoring up to 100. — [Synthesia site](https://www.synthesiagame.com/); [pianoers Synthesia review](https://pianoers.com/synthesia-piano-review/)
- Melodics practice mode: loop and slow down, Auto-BPM raises tempo as you improve, Wait pauses until the correct note, and you can replay your last performance. — [Melodics: How it works](https://melodics.com/how-it-works)
- Yousician Practice mode: loop sliders, tempo control, "Play For Me", metronome, Mute Song, Loop Lead-in. Since update 4.14 (2020, possibly outdated) tempo uses 5% step buttons instead of a slider, and Auto tempo sits in the pause menu. — [Yousician 4.14 blog](https://yousician.com/blog/whats-new-in-yousician-update-4-14); [Yousician support (search snippet)](https://support.yousician.com/hc/en-us/articles/201558362-Practice-vs-Play-mode-Guitar-)
- Rocksmith+ Riff Repeater: a loop with speed and difficulty sliders and a "Note by Note" option. A forum reviewer of the original Rocksmith (not Plus) praised its automatic difficulty and speed increase after nailing a passage. — [Ubisoft patch notes, Dec 2023](https://www.ubisoft.com/en-us/game/rocksmith/plus/news-updates/7aZvpnGwD8VUEy6lNz6o8U/learn-to-play-songs-by-coldplay-along-with-hundreds-of-new-songs-on-rocksmith); [Fractal Audio forum (older)](https://forum.fractalaudio.com/threads/rocksmith-for-practicing.93402/)

**Visual instruments**
- Soundslice has an animated fretboard, keyboard, violin, trumpet and trombone, all of which respond to focus mode. — [Soundslice player help index](https://www.soundslice.com/help/en/player/); [Focus mode](https://www.soundslice.com/help/en/player/basic/277/focus-mode/)
- GP mobile has a virtual fretboard and keyboard. — [GP App Store reviews](https://apps.apple.com/us/app/id400666114)

### Inferences
- Splitune should match the Soundslice loop grammar exactly: drag on notation, snap to note or bar, fade outside, edge handles, click-out to clear, plus a mobile "loop this bar" button. A small loop menu (count-in, play once, save, focus) is better than a crowded toolbar.
- The speed-trainer limitations Soundslice admits (no decrease, no saved presets) are easy wins: saved per-loop presets and "drop back a step on request" (pedal) fit Splitune's pedal control.
- Stem solo by clicking the name is fast, but Splitune's "isolate your part" core needs explicit **mute-my-part** (play-along) and **solo-my-part** (listen) states. Songsterr maps these to M and Alt+M.
- True wait mode needs pitch detection on the user's input. For BYO songs it is feasible only on top of a transcription, and its failure mode is "mishears correct playing" (see §8). Treat it as a later, opt-in feature, and prefer "play once and stop at the loop end" (Soundslice) for v1.

### Gaps
- Songsterr's numeric speed range was not confirmed. A search summary of its App Store text said speed "slows tab playback up to 15%", which may be garbled, so verify in-app.
- Hand separation UX in Simply Piano, and how flowkey picks hands in the UI, were not documented in the sources I read.
- How Soundslice's count-in sounds and is configured (bars, accent) was not read in detail; the help page "Metronome and count-in" exists but wasn't fetched.

## 4. Learning apps (Yousician, Melodics, Simply Piano, flowkey, Rocksmith+, Fender Play, JustinGuitar, Musora, Synthesia): session structure, feedback, progress, gamification, and fit for BYO song

### Takeaway
Curriculum apps share a common shape:
- short sessions (a 5-minute daily goal is common)
- a split between Practice mode (loop, slow, unscored) and Play/Perform mode (scored)
- real-time hit/miss feedback with stars
- streaks
- guided paths

Users praise the motivation and immediate feedback. They complain that pitch detection mishears correct notes, that game-style scrolling notes don't transfer to real notation, that timing is rigid, that the content plateaus, and about subscription and billing. For a BYO-song tool, the transferable parts are the Practice/Perform split, a light practice log and streak, and post-take review. Missions, XP and level-ups are not.

### Cited Findings
**Melodics**
- Lessons are split into steps, courses group lessons by concept, and each instrument has a Guided Path. Keys adds repeatable exercises (scales, intervals).
- Practice Mode offers loop, slow-down, Auto-BPM and Wait. After each attempt you get a breakdown, and you can replay your last performance.
- The default Daily Goal is **5 minutes**. Sessions that meet it count toward Trophies, consecutive days build a Streak, and a calendar shows history and best streaks. — [Melodics: How it works](https://melodics.com/how-it-works)
- Scoring: precise timing scores higher, and a "green" note that lands slightly off scores lower. Note streaks reset on a miss. Stars run 1, 2, 3, then Platinum (all green). The score has no ceiling, and lessons with more notes have bigger ranges. — [Melodics support: Lesson scoring](https://support.melodics.com/en/articles/15092017-lesson-scoring)
- Acoustic drums or pads need calibration so the app learns the kit. A review calls the scoring "pretty harsh". — [Melodics support / review search](https://www.melodics.com/support-articles/support-scoring); [promusicianhub review](https://promusicianhub.com/melodics-review)

**Yousician**
- The home screen has Song, Learn and Challenges, which a reviewer found "confusing and overwhelming". Learn contains Missions (skill paths with short videos), and there are Workouts (chords, ear training, scales).
- Songs have a Practice Mode (stop, loop, tempo, skip, unscored) and a scored Perform Mode. Gameplay is a "bouncing ball over a virtual fretboard". Correct notes in a row earn points, which convert to Gold Stars, and there are achievements and levels.
- Praise: "borderline addictive". Criticism: the game format doesn't teach nuance, style or feel, the colours and sounds are distracting, and the content is mostly beginner-level. — [American Songwriter, Feb 2025](https://americansongwriter.com/yousician-review/)
- Guitar notation can be shown as tablature, tab & notes, notes, standard, or standard & tab, with previews before choosing. — [Yousician support/blog (search summary)](https://yousician.com/blog/whats-new-in-yousician-update-4-14)
- An analysis of 1–3-star reviews across music-learning apps found the top complaint (28% of that subset) was pitch detection that mishears correct playing, followed by a plateau past beginner level and auto-renewing subscriptions. **This is an SEO aggregator; weight it low.** — [unstar.app comparison](https://unstar.app/blog/yousician-simply-piano-flowkey-fender-play-music-learning-apps-ranked-2026)

**Simply Piano**
- Notes show on a staff and a keyboard graphic at the same time. A wrong note turns red and the app "patiently waits".
- Structure: Piano Basics, then Essentials I, then a Soloist or Chords path (33+ courses). Each lesson opens with a short video. "5-minute workouts" cover sight-reading, note naming and ear training. Songs unlock halfway through Essentials I.
- Criticism: timing feels rigid and unmusical, it is unclear whether penalties apply to pitch or timing, and it occasionally mishears notes. — [American Songwriter, Mar 2025](https://americansongwriter.com/simply-piano-review)
- A Reddit learner said the sideways-scrolling notes make "the transition to reading real sheet music really difficult". — [r/pianolearning, Mar 2024](https://libreddit.winscloud.net/r/pianolearning/comments/1b8slc5/how_do_you_think_about_learning_piano_online/)

**flowkey**
- Split screen of a real pianist's hands on video above sheet music scrolling in sync. Wait Mode, hands separate, 50%/75% speed and loops.
- Onboarding asks for level and MIDI vs acoustic. Feedback scored 2/5 as "too forgiving" (it advances despite wrong rhythm). Some "beginner" lessons feel intermediate. — [pianoers, Oct 2026](https://pianoers.com/flowkey-review/)

**Rocksmith+**
- Three views: noteway (highway), "RS Tab" with dynamic and static display options, and Sheet Music (added Dec 2023, "first look").
- Dynamic difficulty applies immediately while RS Tab is shown. Known bugs: mastery counted wrongly after pause/resume and when playing one hand. — [Ubisoft patch notes, Dec 2023](https://www.ubisoft.com/en-us/game/rocksmith/plus/news-updates/7aZvpnGwD8VUEy6lNz6o8U/learn-to-play-songs-by-coldplay-along-with-hundreds-of-new-songs-on-rocksmith)
- Reviewers say the noteway confuses tab readers, and some invert the string order to make it closer to tab. — [Steam discussion](https://steamcommunity.com/app/221680/discussions/0/1474222595300338098) (Rocksmith 2014; older)

**Fender Play**
- Practice features: scrolling tablature, chord charts, chord drills, backing and isolated tracks, looping, tuner, metronome, a chord challenge mode and tone presets.
- Reviewers say it targets beginners and early intermediates. Pricing at review time: $19.99/month or $149.99/year. — [Guitar World review 2025](https://guitarworld.com/reviews/fender-play-review); [App Store listing via AppFollow](https://apps.appfollow.io/ios/fender-play-songs-lessons/1226057939?country=us)

**JustinGuitar app (Musopia)**
- Play-along songs with a virtual band, adjustable tempo, a one-minute chord-change exercise and strumming exercises.
- Users complain that the strumming pattern isn't shown at the same time as the chords during song play, and that licences on many songs have been lost. — [JustinGuitar App Store](https://apps.apple.com/app/id1176125504); [JustinGuitar community](https://community.justinguitar.com/t/app-songs-limited-overlap-with-justins-lessons/281505)

**Soundslice "notebook"** (a non-gamified alternative)
- Per piece, seven circles show the last 7 days, and days you practised turn green. You mark practice with a manual "Practiced?" button, and only today can be marked.
- A History tab lists practice marks and private notes. "Performances" records yourself inside the app (2025). — [Soundslice help: Practice tracking](https://www.soundslice.com/help/en/player/notebook/283/practice-tracking/); [2025 review](https://soundslice.com/blog/302/soundslice-year-in-review-2025/)

### Inferences
- **Keep for Splitune (BYO song):**
  - a Practice vs Run-through split per song (an unscored loop-and-slow workspace, and a full play-through at the target tempo)
  - a per-song practice log (Soundslice's 7-day circles is the light-touch model)
  - an optional 5-minute daily goal
  - post-take review (Melodics "replay your last performance" maps onto recording yourself over the stem)
  - auto-tempo progression tied to loops
- **Avoid:** XP, missions, level-ups, mandatory onboarding paths, and score-driven red/green note judgement without robust pitch detection. These are the most-cited sources of frustration ("mishears correct playing", "rigid timing", "patronising" sounds and colours).
- Melodics' timing-precision score is the most musically honest feedback model. If Splitune ever grades takes, grade timing against the song's beat grid (which it already has) before grading pitch.
- Rocksmith+'s evolution (noteway first, then tab, then sheet music) and the Simply Piano complaint both suggest that tab and standard notation should be the primary views, with highways at most an optional aid.

### Gaps
- Yousician's current (2026) practice UI, daily goals and weekly challenges: support pages returned 403, and the 4.14 details are from 2020.
- Musora (Drumeo/Pianote/Guitareo) app: I found no reliable source on whether notation is synced to lesson video in-app. The Drumeo app page wasn't read in detail.
- Fender Play: whether lesson video can be slowed and whether the tab scrolls in sync with the video was not confirmed.
- Melodics on-screen note display (lanes vs notation) was not documented on the pages read.
- I found no rigorous study of "patronising" or gamification sentiment, only anecdotal and aggregator sources.

## 5. Readability: sizing for a music stand, dark mode, contrast, fonts

### Takeaway
Players treat readability as user-adjustable: zoom, stave width, horizontal layout, font size (UG), hiding note highlights. Dark-background notation exists but is deliberately **not** the default in Soundslice, because light-on-dark notation is "less traditional". SMuFL fonts differ in weight and coverage (Bravura is the heaviest and most complete, Leland lighter, Petaluma handwritten-jazz). I found no legibility research for screen or stand distance.

### Cited Findings
- Soundslice themes:
  - "Auto / player light" (default): the UI follows the OS but music stays on white.
  - "Auto": dark music in OS dark mode.
  - "Light" and "Dark".
  - In dark mode, notation is light notes on dark. The light-music default is kept because dark notation is less traditional and should be chosen deliberately. Themes are paid only. — [Soundslice help: Theme](https://www.soundslice.com/help/en/player/advanced/301/theme/)
- Soundslice lets users disable note colours in coloured music (2023). Playhead and note-highlight colours come in four themes, including "Subtle". — [blog listing](https://www.soundslice.com/blog/rendering); [Playhead style](https://www.soundslice.com/help/en/player/advanced/292/playhead-style-color/)
- UG offers adjustable font style and size, plus dark mode. — [UG App Store](https://apps.apple.com/us/app/ultimate-guitar-chords-tabs/id357828853)
- Guitar Pro says dark mode is "one of the most requested features" (NAMM 2025 mobile announcement). — [Guitar Pro blog](https://www.guitar-pro.com/blog/p/48507-namm-show-2025-the-prototype-of-the-new-guitar-pro-mobile-app-unveiled)
- Bravura is the SMuFL reference font with almost 3,000 glyphs. One audit puts Bravura's coverage of the recommended repertoire at 99.86% and Petaluma's at 46.69%. Leland and Petaluma are incomplete, and MuseScore falls back to Bravura for missing glyphs. — [SMuFL fonts](https://www.smufl.org/fonts/); [Steinberg forum audit](https://forums.steinberg.net/t/fully-compatible-smufl-fonts/1041112)
- Leland was released in MuseScore 3.6 and inspired by the SCORE program. It is lighter than Bravura. Some users criticise its glyph spacing, for example a large gap before flats. — [Linux Journal](https://www.linuxjournal.com/content/musescore-created-new-font-memory-original-score-program-creator); [notat.io forum](https://www.notat.io/viewtopic.php?p=14338)
- Soundslice once shipped a font-loading bug on iOS that showed stray emoji on staff lines, and has a troubleshooting page for "Couldn't load the music font". — [blog search summary](https://www.soundslice.com/blog/rendering); [help index](https://www.soundslice.com/help/en/player/)

### Inferences
- For a "Music Stand" design system: default to light notation on a high-contrast paper surface, even when the app chrome is dark, and offer true dark notation as an explicit choice (the Soundslice precedent). Dark notation must still meet contrast for thin glyphs (stems, ledger lines), which argues for a heavier font such as Bravura over Leland.
- Distance reading on a stand: expose one "notation size" control that changes stave size, not page zoom. Use horizontal or focus layouts to keep size large on narrow screens rather than shrinking the notation.
- Avoid colour-only cues (Splitune rule): Soundslice's shape options for the playhead and the bar background are good non-colour signals.

### Gaps
- I found no empirical legibility guidance (minimum stave height for reading at about 60–90 cm on a tablet) from any vendor or study.
- Tab-number fonts (which typeface Songsterr, GP or Soundslice use for fret numbers) were not documented.

## 6. Mobile and tablet: phones (portrait/landscape), iPad on a stand, page turning (pedals, face gestures, audio following)

### Takeaway
On phones, players reduce controls (Songsterr drops the Tab↔Sheet toggle on mobile; Soundslice uses a Loop button and handles instead of drag) and rely on focus or horizontal layouts to keep notation large. On tablets on a stand, the page-turning ecosystem has these mechanisms:
- Bluetooth pedals that send arrow or PageDown keys
- half-page turns
- face gestures (forScore Pro: mouth, wink, head turn) and AirPods head turns
- audio-following page turns (Newzik)

Users report false triggers with face gestures.

### Cited Findings
- Soundslice mobile looping: tap Loop to loop the current bar, then drag the handles. The loop menu hides during playback. — [Soundslice help: Looping](https://www.soundslice.com/help/en/player/basic/4/looping/)
- Soundslice paged navigation by tapping the left or right edge, PageUp/PageDown or Alt+arrows. — [Paged layout blog](https://www.soundslice.com/blog/241/introducing-our-new-paged-layout/); [Shortcuts](https://www.soundslice.com/help/en/player/tips/1/keyboard-shortcuts/)
- Songsterr: the Tab↔Sheet switch is web only. iOS caches playback audio per speed, mute/solo state and instrument for offline use. — [Songsterr help](https://www.songsterr.com/help)
- Chordify on iPhone uses a narrower vertical layout with video and controls under the chord sheet. A reviewer found the letters-only view easier than letters plus diagrams. — [GuitarChalk Chordify review](https://www.guitarchalk.com/chordify-review/)
- forScore:
  - Pedals: AirTurn PED/PEDpro/BT200, iRig BlueBoard, Turn Touch and Bluetooth MIDI connect in-app. Arrow keys, space, return and PageUp/PageDown turn pages.
  - Any action can be bound to a pedal under "Page Turners & Shortcuts", and multiple inputs can map to one action.
  - AirPods head-turn page flips are supported. — [forScore: Page turners & shortcuts](https://forscore.co/?p=1641)
- forScore face gestures (Pro): mouth movements by default, switchable to head turns or winks, with sensitivity, direction and calibration. Sensor data is processed immediately and not stored. — [forScore: Face gestures](https://forscore.co/face-gestures/)
- User reports on face gestures: "in an actual performance I got false triggers". Half-page turns keep music in view but mean "twice as many page turns". — [Delcamp forum](https://www.classicalguitardelcamp.com/viewtopic.php?p=1687299)
- MobileSheets offers half-page turns via vertical scrolling with a half-page option or a half-page display mode, and a pedal action "Scroll Down or Turn Page if at Bottom" with a 50% scroll amount. **Forum answers, not the manual; the exact thread was not pinned down.** — [Zubersoft MobileSheets forum](https://zubersoft.com/mobilesheets/forum/showthread.php?tid=7059)
- Newzik "audiomatching": listens via the tablet mic, locates the player in the score and turns the page. One setup records a play-through first. Newzik advises slowing the media file before syncing for accuracy. **Vendor marketing.** — [Newzik blog](https://en.blog.newzik.com/blog/audiomatching-tourne-page-cest-quoi); [Newzik AI features](https://newzik.com/en/resources-sheet-music-app/best-sheet-music-app-ai-features)
- The UG patent's problem statement: most sheet music doesn't fit a phone screen, so players must stop to scroll or turn pages, and fixed-speed autoscroll fails because tempos and screens vary. — [US11749238B1](https://patents.google.com/patent/US11749238)

### Inferences
- Splitune's playback is always synced to real audio, so it can do what Newzik needs a microphone for: turn pages from the playback position. Paged layout plus auto page turn just before the last system ends (or a half-page turn) is a strong tablet-on-stand mode. Manual pedal turns should override it.
- Pedal mapping should follow forScore's model: bindable actions, multiple inputs per action, and standard keys (arrows, PageUp/PageDown, Space) so generic Bluetooth pedals work with no driver. Typical actions are play/pause, restart loop, next/previous bar, slower/faster and toggle loop.
- On phone portrait, prefer focus/loop-centred views (a few bars large) over full scores. Use landscape for horizontal scroll.

### Gaps
- I found no source describing Songsterr, UG or Soundslice phone portrait vs landscape behaviour in detail.
- forScore half-page-turn specifics come from forum users, not official docs.

## 7. Editing and correction: Songsterr editor, Soundslice editor, Guitar Pro, community corrections, revision history

### Takeaway
Songsterr is both the closest analogue and a direct competitor. It turns a YouTube link or uploaded audio into multi-instrument AI tabs in 5–15 minutes, opens them in its editor (click a note, type a fret digit, autosaved private draft) and keeps a public revision history with before/after views. Users treat AI output as a "ballpark" draft that needs manual cleanup. Soundslice adds correction tools aimed at sync (drag syncpoints, auto-align) and verification (synth overlay).

### Cited Findings
**Songsterr AI tabs**
- Input is a YouTube link or uploaded audio. Tracks include rhythm and lead guitar, bass, drums, vocals, piano, keys/synth, strings and winds.
- Bends, vibrato, slides and palm mutes are notated. Supported tunings: 6, 7 and 8-string guitar and 4, 5 and 6-string bass.
- There is a free 20-second preview, and full length requires Plus. Turnaround is 5–15 minutes with an email when done. Results open in the editor before publishing. — [Songsterr help](https://www.songsterr.com/help)

**Songsterr editor and revisions**
- E toggles the editor. Click a note, type 0–9 and use Backspace to delete. Edits autosave as a private draft (wait for "Saved").
- Revisions: open the player panel, then Revisions, then "Show full tab" for Before or After. "Draft" lets you practise unpublished changes.
- The latest revision can be deleted only within 24 h. Restoring old revisions is web only. — [Songsterr help](https://www.songsterr.com/help)

**User reception of Songsterr AI** (BassBuzz, Feb 2025)
- Users describe it as "ballpark", "pretty darn passable" and "hit and or miss".
- Typical errors: unexplained shifts between open strings and fretted positions, and staying on one string moving up the neck instead of crossing strings. One user notes that horizontal movement can be intentional for pedal tones.
- The consensus workflow is generate, then manually clean up, which still saves time when no tab exists. — [BassBuzz forum](https://forum.bassbuzz.com/t/new-songsterr-ai-is-impressive/70519)
- A German tech site rated the output "fairly accurate". — [heise](https://heise.de/-10356152)
- Some users complain that Songsterr now contains AI-generated tabs, "a lot of them are terrible". — [r/Guitar thread (2024)](https://lr.sudovanilla.org/r/Guitar/comments/1eb516o/ultimate_guitar_is_trash/leq9u7d); [BassBuzz](https://forum.bassbuzz.com/t/ultimate-guitar-versus-songsterr/64692)

**Soundslice correction tools**
- Sync: drag or delete syncpoints, guide notes for rubato, auto-align (2025). — [Adding syncpoints](https://soundslice.com/help/en/creating/syncing/171/adding-syncpoints); [2025 review](https://soundslice.com/blog/302/soundslice-year-in-review-2025/)
- Verification: synth overlay to hear notation against the recording. — [Synth overlay](https://www.soundslice.com/help/en/player/advanced/313/synth-overlay/)
- 2025 editor additions: ASCII tab import, custom percussion maps, "dozens of new editor commands", and a scanner that detects chord diagrams. — [2025 review](https://soundslice.com/blog/302/soundslice-year-in-review-2025/)

**Guitar Pro 8**
- Sync points dragged to waveform peaks recalculate tempo locally. — [GP8 what's new](https://www.guitar-pro.com/docs/gp8/basics/intro/whats-new)

**Ultimate Guitar**
- "Personal" tabs let users edit chords, lyrics or tab for themselves. A 2024 App Store reviewer warns chords "are sometimes wrong". — [UG App Store](https://apps.apple.com/us/app/ultimate-guitar-chords-tabs/id357828853)

**Chordify**
- Users can edit and save chords. A commenter says chord changes are sometimes misplaced but easy to fix by ear. — [GuitarChalk Chordify review](https://www.guitarchalk.com/chordify-review/)

### Inferences
- Splitune's correction model (corrections as overlays; quantization as a separate, re-runnable stage) maps well onto Songsterr's "private draft vs published" split. Show the AI result, the user's overlay edits, and a before/after toggle.
- Songsterr's typical errors (string and position choice, open-string flips) are exactly what Splitune's confidence-aware notation and fingering alternatives should expose. A per-phrase "alternative fingering" picker is likely more valuable than per-note editing for guitar and bass.
- Practising an unpublished draft (Songsterr "Draft") means corrections should take effect in playback immediately, with no "save then reload".
- Songsterr has published AI tabs since about 2024, so Splitune's differentiation must come from practice UX on the user's own audio (real stems, loops on the recording, confidence display, pedal), not from "audio → tab" alone.

### Gaps
- Songsterr's moderation and review workflow for community corrections was not officially documented in the sources found. Third-party claims of peer review are unverified.
- Soundslice notation editor UX (note entry and keyboard model) was not read in detail.
- Guitar Pro 8's error-checking aids (for example, bar-duration warnings) were not researched.

## 8. What users praise or complain about; best-in-class patterns vs anti-patterns

### Takeaway
**Praised:**
- real-recording sync (Soundslice, Songsterr AI play-along)
- rhythm shown in tab (Songsterr)
- clean design (Songsterr vs UG)
- immediate feedback for beginners (Simply Piano, Yousician)
- hands-on-video plus sheet (flowkey)
- auto-tempo-up loops (Rocksmith Riff Repeater, Melodics Auto-BPM)

**Complained about:**
- stiff MIDI playback (UG)
- unreliable autoscroll (UG: "jumps quickly or doesn't move")
- cursor jumps (alphaTab issue)
- paywalled basics (autoscroll, loops, speed)
- pitch detection mishearing correct playing
- game-style displays that don't transfer to real notation
- rigid timing judgement
- forgiving or opaque feedback
- billing and subscription issues
- ads even for paid users (UG)

### Cited Findings
- UG App Store reviews: auto scroll "either jumps quickly or doesn't move" (Jun 2024). MIDI playback "can sound stiff and rigid" (2019, older). Reviewers want autoscroll in the free tier. — [UG App Store](https://apps.apple.com/us/app/ultimate-guitar-chords-tabs/id357828853)
- UG autoscroll breaks in Safari at non-100% page zoom (WebKit bug). A third-party Chrome extension exists only to provide adjustable tab autoscroll. — [WebKit Bugzilla 281786](https://bugs.webkit.org/show_bug.cgi?id=281786); [IndieHackers post](https://www.indiehackers.com/post/autoscroll-extension-v2-chrome-extension-81435c3e4d)
- 2026 store-review summaries criticise UG ads and pop-ups, including "even after buying pro, ads still show up", and a claimed removal of autoscroll on Official tabs (unverified). — [UG Play/App store listing summaries](https://apps.apple.com/app/357828853)
- Songsterr vs UG: forum users say Songsterr's design is far better ("about 500 times better") and UG has more tabs. Accuracy is song-dependent. — [BassBuzz forum](https://forum.bassbuzz.com/t/ultimate-guitar-versus-songsterr/64692); [r/Guitar thread](https://lr.sudovanilla.org/r/Guitar/comments/1eb516o/ultimate_guitar_is_trash/leq9u7d)
- Songsterr Plus is criticised as pricey with no yearly plan (monthly only). — [GuitarChalk Songsterr review](https://www.guitarchalk.com/full-songsterr-review/); [Songsterr help](https://www.songsterr.com/help)
- alphaTab (an open-source tab renderer) issue: the playback cursor "jumps much further than it should, and then snaps back as it hits a new note". An implementation pitfall for interpolated cursors. — [alphaTab issue #318](https://github.com/CoderLine/alphaTab/issues/318)
- Learning-app complaints: pitch detection mishears correct notes, a plateau after beginner level, auto-renewal (aggregator). Yousician home "confusing and overwhelming", colours and sounds distracting. Simply Piano timing rigid and unmusical. flowkey "too forgiving". Simply Piano's scrolling notes hinder the move to real sheet music. — [unstar.app (low weight)](https://unstar.app/blog/yousician-simply-piano-flowkey-fender-play-music-learning-apps-ranked-2026); [American Songwriter Yousician](https://americansongwriter.com/yousician-review/); [American Songwriter Simply Piano](https://americansongwriter.com/simply-piano-review); [pianoers flowkey](https://pianoers.com/flowkey-review/); [r/pianolearning](https://libreddit.winscloud.net/r/pianolearning/comments/1b8slc5/how_do_you_think_about_learning_piano_online/)
- MuseScore.com: YouTube-only audio sources are a barrier. One user said the mixer can only mute parts within the current part. — [MuseScore forum request](https://musescore.org/en/node/320415); [GitHub gist (user)](https://gist.github.com/aronisstav/2bed16d8e5184982e1696da9d13b8e2a)
- Practice-tracking design that avoids gamification: Soundslice's 7-day circles, where the "prize" for the longest streak is becoming a better musician. — [Soundslice help: Practice tracking](https://www.soundslice.com/help/en/player/notebook/283/practice-tracking/)

### Inferences
**Best-in-class patterns to adopt in Splitune**
1. Real audio by default, with synth overlay as a verification layer (Soundslice).
2. Loop by dragging on notation, snapped to notes or bars, with faded surroundings, edge handles, and a menu for count-in, play once, save and focus (Soundslice).
3. A speed trainer with explicit start, end, step and reps, plus a count-in before each pass (Soundslice, GP8). Add saved presets and step-down, which Soundslice lacks.
4. User-chosen auto-follow policy (top, middle, only when needed, left-fixed, off), remembered per song (Soundslice).
5. Bar background highlight and playhead shape options as non-colour position cues (Soundslice).
6. Rhythm stems under tab (Songsterr).
7. Single-key shortcuts for every practice action (Songsterr: S, L, C, N, M, Alt+M; Soundslice: `<` `>`, Ctrl+arrows), which map one-to-one onto pedal bindings.
8. Paged layout with tap-edge turns, plus playback-driven page turns on tablets (Soundslice, forScore, Newzik).
9. Light-touch practice log (Soundslice notebook) instead of XP or missions.
10. Draft vs published corrections with before/after (Songsterr revisions).

**Anti-patterns to avoid**
1. MIDI-only playback for real songs.
2. Fixed-speed autoscroll decoupled from the music's timeline (UG). Splitune should always scroll from the audio clock.
3. A cursor interpolation that overshoots and snaps back (alphaTab #318). Drive the cursor from beat-time mapping, not linear extrapolation.
4. Paywalling the core loop and slow-down tools.
5. Hit/miss judgement from unreliable pitch detection.
6. Game highways as the primary view.
7. Overwhelming home screens and onboarding paths.
8. Hiding the media pane in ways users can't undo (Soundslice keeps a "nib").

### Gaps
- Direct Reddit threads (r/guitar, r/bass, r/drums, r/piano) were mostly reachable only via mirrors or aggregators. Sentiment is therefore anecdotal and not quantified.
- I found no first-party Adrian Holovaty design essays beyond the blog posts cited. His SmashingConf 2016 talk ("Lessons Learned Building an Interactive Sheet Music Engine", [Vimeo](https://vimeo.com/184236034)) was not transcribed.
- Noteflight and the Musora apps (Pianote/Guitareo) were not covered by any source I could read in this pass.
