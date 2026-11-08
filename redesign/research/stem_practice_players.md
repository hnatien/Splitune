# UX teardown: stem-separation and "bring your own song" practice players (input for the Splitune redesign, as of Nov 2026)

Scope note for the report writer: the sources are official help pages and App Store listings where I could reach them, plus third-party reviews and comparison blogs. help.moises.ai returned HTTP 403 to direct fetches, so Moises help-center details come from search-result excerpts of those pages. Reddit could not be fetched (domain blocked for the crawler), so I could not get first-hand Reddit opinion. Several comparison articles are written by competitors (PracticeSession, Songscription, StemConsole) and are marked as such. Version numbers and "last updated" dates are given where the source showed them.

## 1. Import and onboarding: how songs get in, and what happens between import and "ready"

### Takeaway
There are three import models. Cloud separators (Moises, LALAL.AI, BandLab Splitter, Klangio, Songscription) take a file or a URL and process it on a server. Local slow-downers (Anytune, Amazing Slow Downer, AudioStretch, Transcribe!, Capo) open a file from the device library or the Files app and are usable almost at once, because analysis is light or runs on-device. Chord-first apps (Chordify, Chord AI) lean on YouTube/streaming links and a live microphone. Public documentation on the waiting state (progress UI, partial results, notifications) is close to absent for every product, which is itself a finding. The documented patterns are "preview before committing" (LALAL.AI), "change separation later without re-uploading" (Moises) and "generate in the background, notify when done" (one anecdotal report).

### Cited Findings
**Moises**
- Inputs are an uploaded track or a YouTube link, processed in the cloud — [Product Hunt](https://www.producthunt.com/posts/moises). A 2022 user-issues page reports that YouTube URL submission stopped working on Android, which one commenter blamed on Google Play policy (anecdotal, may be outdated) — [JustUseApp](https://justuseapp.com/en/app/1515796612/moises-ai-music-platform/problems).
- The web player lets you "change the separation option of songs you've already processed without re-importing them" (announced 12 Dec 2022) — [Moises newsroom](https://moises.ai/newsroom/product-announcements/new-moises-web-player). The help center adds that each change of separation counts as a new processing against your quota — [Moises help: Track Separation](https://help.moises.ai/hc/en-us/sections/8471545554716-Track-Separation).
- Moises "may impose a limit on the length, file size, and the number of media files you can upload and process, and may change such limits at any time" — [Moises Acceptable Use policy](https://help.moises.ai/hc/articles/5968943445404). A competitor's comparison (Oct 2026, vendor-authored) puts the free tier at 5 songs/month, 5 min each, and says Moises cannot be used offline — [PracticeSession blog](https://www.practicesession.app/blog/best-slow-down-apps-iphone-android/).
- Pro tier allows "up to 180 minutes of separation per upload" — [Moises App Store listing](https://apps.apple.com/us/app/moises-the-musicians-app/id1515796612).
- Moises's own troubleshooting for failed uploads is to log out and in, reinstall, or check the length limit, and Trustpilot and review aggregators report crashes during upload — [Moises help: upload error](https://help.moises.ai/hc/en-us/articles/360014112059-Error-uploading-file-What-should-I-do-); [Trustpilot DE](https://de.trustpilot.com/review/moises.ai).

**Capo (SuperMegaUltraGroovy, iOS/Mac)**
- Capo analyzes "songs in your music collection" and guesses beats, chords and key — [Capo App Store (GB)](https://apps.apple.com/gb/app/capo/id696977615). Key is detected "when you create a new project" — [Capo help 4.5: automatic music analysis](https://supermegaultragroovy.com/products/capo/help/ios/4.5/automatic-music-analysis/). The help pages I read do not describe a progress UI or wait time.
- Stem separation in Capo runs on-device — [PracticeSession blog](https://www.practicesession.app/blog/best-slow-down-apps-iphone-android/) (vendor-authored).

**Anytune**
- Imports from the Files app, Dropbox, WiFi transfer (MOV/M4V too), "Paste from AudioCopy" and Open-In, and plays the Apple Music library, but DRM-protected songs (including Apple Music subscription tracks) cannot play. It extracts audio from video, and you can share audio straight from Voice Memos, Music Memos and GarageBand (v4.5.1) — [Anytune Pro App Store](https://apps.apple.com/us/app/anytune-pro-music-trainer/id427637607).

**Amazing Slow Downer (Roni Music)**
- Plays downloaded Apple Music/iTunes files, with pitch change and EQ unavailable for Apple Music tracks. Spotify support effectively ended with "Spotify changes from September 1, 2022", Deezer 30-second previews were removed in 6.8.9, and video import plus share-from-Voice-Memos were fixed in 6.9.9. The app also checks for unplayable MPEG-DASH files from YouTube converters — [ASD App Store](https://apps.apple.com/us/app/amazing-slow-downer/id308998718).
- One reviewer's workaround for protected iTunes files was to burn the song to CD and re-import it as MP3 — [ASD App Store](https://apps.apple.com/us/app/amazing-slow-downer/id308998718).

**Chord AI**
- Sources are the live microphone (real-time chords), YouTube, SoundCloud and audio files, with Apple Music import mentioned in release notes — [Chord AI App Store](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109). A reviewer reports crashes when loading chords for YouTube videos and in real-time chord finding after an update — [AppFollow / App Store reviews via search](https://apps.appfollow.io/ios/chord-ai-play-any-song/1446177109?country=us).

**Chordify**
- The core flow is YouTube-based: chords play alongside the embedded video. A reader says Premium can analyze uploaded songs (not confirmed by the reviewer) — [GuitarChalk review](https://www.guitarchalk.com/chordify-review/).

**LALAL.AI**
- The flow runs upload → choose stems → preview → "Split in Full". The dashboard shows the processing time required and your remaining minutes, and download links are also sent by email. Free users can preview but not download (sources disagree on preview length: "up to 10 minutes" of audio vs "just over a minute", and one Google Play user wished they "could preview more than a minute before committing my paid credits"). Pro has a "Relaxed Queue" (unlimited minutes) vs "Fast Queue" (250 min/month) — [LALAL.AI FAQ](https://lalal.ai/guides/faq); [StemSplit review](https://stemsplit.io/blog/lalal-ai-review); [GetApp](https://www.getapp.com/all-software/a/lalala-ai/). Treat the exact numbers as unconfirmed, since they come from several third-party summaries.

**BandLab Splitter**
- The free tier splits an imported track into 2 stems (vocals + other) or 4 stems (vocals, bass, drums, other), with up to two splits a day. The paid membership goes up to 7 stems (adds guitar, piano, strings), plus a drum splitter and MIDI conversion. Stems open straight in BandLab Studio — [BandLab blog](https://blog.bandlab.com/best-stem-separation-software-comparison-bandlab/); [BandLab help: What is Splitter](https://help.bandlab.com/hc/en-us/articles/16560236938777-What-is-Splitter).

**Klangio Guitar2Tabs / Songscription**
- Guitar2Tabs inputs: uploaded recordings (MP3), on-device mic recording with metronome and an adjustable countdown (v1.7.0), YouTube link and MP4/MOV video (v1.5.1). Internet is required, and there is "no live note recognition" because processing takes time. Reviewers say the free tier transcribes only the first 20 seconds — [Guitar2Tabs App Store](https://apps.apple.com/app/id1589660528).
- Klangio's own guide says that after "Transcribe" the result is ready "within just a couple seconds" (vendor claim) — [klang.io guide](https://klang.io/?p=16541).
- Songscription accepts MP3/WAV/M4A uploads, YouTube/Instagram/TikTok links and direct recording. You pick an instrument, and it isolates that part and writes notation, MIDI or tab — [Songscription: YouTube to sheet music](https://songscription.ai/youtube-to-sheet-music); [Songscription for performers](https://songscription.ai/for-performers).
- Songscription describes the generic flow across these tools as upload → pick instrument → review → export, with review treated as cleanup because "no AI transcription lands perfect on the first pass" (competitor-authored) — [Songscription blog](https://www.songscription.ai/blog/audio-to-guitar-tabs).

**Background generation with notification (anecdotal)**
- A Reddit thread (r/Bass, surfaced only as a search excerpt and not fetchable) describes a "generate with AI" tab flow that said it was "generating in the background now" and would message the user when complete. The excerpt appears to concern Songsterr's AI tab feature rather than Moises, but the attribution is unclear — [search excerpt of r/Bass thread via mirror](https://lr.eu.psf.lt/r/Bass/comments/1indox5/songsterr_quietly_releases_one_of_the_greatest).

### Inferences
- No leading product documents a rich waiting state. The pattern visible in practice is a blocking spinner or "processing" row followed by a full result. Splitune's staged pipeline (decode → beats/tag → separate → chords/notes → finalize) with SSE progress is a real chance to beat the field: let the user play the original audio with the beat grid and loops as soon as `beats` lands, before separation finishes.
- LALAL.AI's "preview a slice before committing the full job" and Moises's "re-separate without re-uploading" both cut the cost of a wrong choice at import. For Splitune in personal mode (no billing), the equivalent is to let the user change the instrument or part after import without re-uploading, and show what is being re-run.
- Local apps feel instant because they open the file and start playback at once. A cloud app should show the playable original immediately so it never feels slower than ASD or Anytune.
- DRM and streaming changes (Spotify 2022, Apple Music restrictions) repeatedly broke the "library" import path for ASD and Anytune. URL and file import are more durable than streaming-library integration.

### Gaps
- No source gave typical Moises, Capo or Chordify processing times, or described their progress screens, push/email notifications or partial results. help.moises.ai blocked fetches, and its "Welcome… pointers to start (Mobile App)" article could not be read.
- I could not confirm whether Moises, Chord AI or Chordify let you start practicing before analysis completes.
- Recording-as-import flows (Moises, Anytune "record and analyse your performance") are listed but not described in any source I reached.

## 2. Player and transport layout: play/seek/loop/speed/pitch/count-in/metronome placement, ranges, steps, and timeline drawing

### Takeaway
The most detailed public model is Capo. It has a large waveform "Song Area", a heads-up display (HUD) with a position readout that toggles between time and bar:beat, and a single "Control Strip" that swaps between control sets (Regions, Markers, Chords, Playback, Speed, Key, Pitch, Sections, Bars), keeping the screen uncluttered on a phone. Speed ranges vary widely, and most apps let you set the value by slider plus a precise entry or ±1 % buttons. Pitch is usually a semitone transpose plus a separate cents fine-tune for out-of-tune recordings. Desktop tools (Transcribe!) add typed entry and keyboard shortcuts. Beat-grid and bar-number timelines are what separate the practice-oriented apps (Capo, Transcribe!, Moises Sections) from plain slow-downers.

### Cited Findings
**Capo (help docs v4.5)**
- The screen is a Song Area plus a HUD. Playback is controlled from the HUD, and the Control Strip "sits beneath the playback position and groups controls by function" — [Capo help: project view](https://supermegaultragroovy.com/products/capo/help/ios/4.5/project-view/).
- The Position Display shows time or bar/beat. Tapping toggles it, the timeline at the top of the Song Area changes to match, and a long-press seeks to a typed position or jumps to start or end — [Capo help: project view](https://supermegaultragroovy.com/products/capo/help/ios/4.5/project-view/).
- Song Views: **Practice** (the waveform fills most of the window, chords optional below it), **Structure** (define sections, edit the beat grid; iOS 14+) and **Chords** (compact overview organized by sections and bars) — [Capo help: project view](https://supermegaultragroovy.com/products/capo/help/ios/4.5/project-view/).
- Control Strip: tap the selector left of the position display to cycle sets, or press and hold to jump to one. The available sets depend on the current Song View, and buttons highlight when a feature changes playback (e.g. the Mixer icon lights when any volume is below 100 %) — [Capo help: control strip](https://supermegaultragroovy.com/products/capo/help/ios/4.5/control-strip/).
- **Speed:** a slider showing the percentage above the knob while dragging, with the resulting detected tempo shown below. The range is 25 %–150 %, with buttons at each end for 1 % steps — [Capo help: control strip](https://supermegaultragroovy.com/products/capo/help/ios/4.5/control-strip/); [Capo help: advanced audio playback](https://supermegaultragroovy.com/products/capo/help/ios/4.5/advanced-audio-playback/).
- **Key:** a semitone transpose slider, with the detected key "adjusted for your change" shown below and chords updating live. **Pitch:** a separate fine slider of ±100 cents "useful for out-of-tune recordings" — [Capo help: control strip](https://supermegaultragroovy.com/products/capo/help/ios/4.5/control-strip/).
- **Transcription Playhead:** a toggle that pins a return point, so each Play restarts from there. Toggle it off and on to move it forward — [Capo help: advanced audio playback](https://supermegaultragroovy.com/products/capo/help/ios/4.5/advanced-audio-playback/).
- **Metronome** clicks on Capo's detected beat locations (not a fixed BPM) — [Capo help: advanced audio playback](https://supermegaultragroovy.com/products/capo/help/ios/4.5/advanced-audio-playback/).
- The beat grid stores "the location of every one of those pulses" (eighth-note or triplet), allowing "some degree of drift". The speed-slider tempo is an average of those pulses, and Capo guesses the downbeat to mark every bar — [Capo help: automatic music analysis](https://supermegaultragroovy.com/products/capo/help/ios/4.5/automatic-music-analysis/).

**Moises**
- Web player (Dec 2022): space bar plays and pauses; a Master Volume control for "live performances"; real-time chords "paced to your selected speed"; Smart Metronome click generated from the track with 0.5x/1x/2x subdivisions; count-in up to 16 beats — [Moises newsroom: new web player](https://moises.ai/newsroom/product-announcements/new-moises-web-player).
- Count-in: up to 16 clicks. Free users are limited to 4 clicks at the start of the song. On web the control sits in the top right, and on mobile under "Song options". You can select a loop and enable the count-in before it — [Moises help: count-in (search excerpt)](https://help.moises.ai/hc/en-us/articles/6580752102044-How-do-I-set-up-the-count-in).
- Speed is changed through the metronome/BPM control on mobile, with a Reset to original — [Moises help: change tempo (search excerpt)](https://help.moises.ai/hc/en-us/articles/6582847813148-How-do-I-change-the-song-s-tempo). The free limit is described as ±10 BPM on the feature page — [Moises: Audio Speed Changer](https://moises.ai/features/audio-speed-changer) — but as "20 %" in the help center ([search excerpt](https://help.moises.ai/hc/en-us/articles/6582847813148-How-do-I-change-the-song-s-tempo)). The two official pages conflict. A competitor says the free pitch range is ±2 semitones — [PracticeSession blog](https://www.practicesession.app/blog/best-slow-down-apps-iphone-android/).
- Pitch: transposes into all 12 keys with chords transposed accordingly, plus AI key detection — [Moises App Store](https://apps.apple.com/us/app/moises-the-musicians-app/id1515796612).

**Transcribe! (Seventh String, desktop, v8.6x)**
- The main window is a waveform with section, measure and beat markers. A spectrum of the selection appears above a piano keyboard, with "green blobs" for detected notes and a box listing matching chord guesses. There is also a Piano Roll view of note guesses over time aligned to the waveform — [Seventh String screenshots](https://seventhstring.com/xscribe/screenshots.html).
- Speed runs 5 % to 200 % via slider or text box, and "Analog lock" ties speed and pitch together. Original and altered tempo show at the bottom once beat markers are placed. Tuning adjusts in octaves, semitones and cents. "Transposition" changes note *names* only (e.g. a Tenor Sax preset), not playback pitch. There is also a 31-band EQ with presets and a "Clicks" metronome that sounds at placed markers — [Seventh String screenshots](https://seventhstring.com/xscribe/screenshots.html).
- Shortcuts: M, S and B drop measure, section and beat markers during playback; ⌘[ and ⌘] jump between measure markers; ⌘1 = 100 % and ⌘2 = 50 % speed (third-party guide; keys differ by version) — [FaChords guide](https://fachords.com/blog2014/transcribe-software-help-transcribe-recorded-music).

**Anytune**
- Tempo goes down to 0.05x without pitch change, and pitch spans ±24.0 semitones. Tap-In sets tempo by tapping a bar, then starts playback or a count-in. Count-in (v4.8.0+) is visual plus audible, follows the time signature and BPM, has bar-count and sound on/off options, and supports meters like 5/4 (3+2). Lyrics and text TABs scroll with playback. There is an Apple Watch remote add-on — [Anytune Pro App Store](https://apps.apple.com/us/app/anytune-pro-music-trainer/id427637607).

**Amazing Slow Downer**
- Speed is 25 %–200 % on mobile, with pitch and tuning change. There is a "Preserve Fine Tuning" setting (6.7.2), MIDI remote "Set Loop Start/End" (7.1.1) and Bluetooth remote "Play From Loop Start" — [ASD App Store](https://apps.apple.com/us/app/amazing-slow-downer/id308998718). The desktop listing gives 20 %–200 % — [ASD listing via mwm.ai](https://mwm.ai/apps/amazing-slow-downer/308998718).
- Reviewers ask for "+ or - 1" speed buttons and for markers "for points of difficulty that you could just jump to". Others use the << / >> 1-second skip buttons and want 5, 10 or 15 s jumps — [ASD App Store](https://apps.apple.com/us/app/amazing-slow-downer/id308998718).

**AudioStretch**
- Pitch is ±36 semitones with 1-cent resolution, and speed runs from zero to 10x. Holding a finger on the waveform freezes playback at zero speed, and dragging plays the audio "at the same speed as your finger" (LiveScrub). A keyboard/spectrum view aids transcription — [AudioStretch App Store](https://apps.apple.com/us/app/id571863178?l=en-us); [BandLab blog on AudioStretch](https://blog.bandlab.com/what-is-audiostretch-and-how-do-i-use-it/).
- A user reports 1 % speed control by dragging across the SPEED bar and wished for pinch-zoom on the waveform — [AppsHunter reviews](https://appshunter.io/ios/app/571863178/reviews/8). The iPhone version was last updated Oct 2024, and the Android version is now published by BandLab — [PracticeSession blog](https://www.practicesession.app/blog/best-slow-down-apps-iphone-android/).

**Music Speed Changer and others (ranges, per a competitor's Oct 2026 table)**
- Music Speed Changer: 15 %–500 %, ±24 semitones. PracticeSession: 0.2x–4x, ±12 semitones. Capo: 25 %–150 % — [PracticeSession blog](https://www.practicesession.app/blog/best-slow-down-apps-iphone-android/) (vendor-authored).
- Music Speed Changer's player is a mini player you tap or swipe up to open the full editor — [Music Speed Changer help](https://help.musicspeedchanger.com/article/fb34fxvon7-a-b-practice-loop-points).

**Fender Play / Fender Songs**
- Fender Play's Practice Mode shows auto-scrolling TAB with a metronome, and playback can be slowed to 50 % or 75 % (fixed presets) — [Guitar World review 2025](https://guitarworld.com/reviews/fender-play-review). The Fender Songs app scrolls chords in time and slows audio to 50 %, with three modes: Practice, Play-along and Perform — [MusicRadar](https://www.musicradar.com/news/new-fender-songs-app-features-over-750k-songs-to-learn); [Guitar World](https://guitarworld.com/news/fenders-songs-app-promises-to-be-the-easiest-way-to-learn-your-favorite-songs).

### Inferences
- Capo's single context-switching control strip is the strongest small-screen pattern documented: one row of controls, always the same position, with a "something is altered" highlight on each set's icon. It directly addresses the "too many sliders" problem and maps well to a phone portrait layout.
- Splitting **Key** (semitones, chords follow) from **Pitch** (±100 cents fine-tune for detuned recordings) is consistent across Capo, Transcribe! and AudioStretch, and Splitune should copy it, because detuned recordings break chord and tab alignment for learners.
- Showing the *resulting* BPM next to the speed percentage (Capo, Transcribe!) helps learners set goals in BPM ("I can play it at 92"). Splitune has beats, so it can show both.
- The time ↔ bar:beat position toggle and "jump to bar" via long-press are cheap wins for a music-first timeline.
- Fixed 50 %/75 % presets (Fender) are friendlier for beginners than a raw slider, while 1 % buttons are wanted by advanced users (ASD reviewer). The ideal is preset chips plus a fine ± stepper.
- Capo's metronome on *detected* beats (rather than a fixed BPM) and Moises's "Smart Metronome" both show that the click should follow the song's real grid. Splitune's beat stage already gives this.

### Gaps
- Exact Moises speed range and step on paid tiers (an older third-party review reportedly said 31–250 BPM for Premium, but I could not identify or verify the source), and Moises mobile layout (where mixer, chords and lyrics tabs sit), could not be confirmed because help.moises.ai was blocked.
- I found no source on whether Chordify, Moises or Chord AI draw bar numbers on the waveform, or on waveform zoom gestures beyond AudioStretch's missing pinch-zoom.
- Transcribe! keyboard shortcuts vary by version, and I only had a third-party guide and an old 5.20 help file.

## 3. Looping: A/B setting, bar snapping, section loops, saved loops, nudging, speed trainer, count-in before the loop

### Takeaway
There are four ways to set a loop. **Buttons pressed during playback** (A/B or "Set": Amazing Slow Downer, Music Speed Changer, Chord AI) are simple and pedal-friendly but imprecise. **Drag handles on the waveform** (Moises desktop, Capo regions) are precise but need two hands or a mouse. **Region = selection, Play loops it** (Capo, Transcribe!) needs no loop toggle. **Section-based loops from auto-detected structure** (Moises Sections, aligned to downbeats) are the fastest and need beat and downbeat data. Best-in-class details include Capo's default snap-to-beat (turned off by dragging your finger off-axis), count-in measured in *bars* before the loop (Capo: Off/1/2/4 bars), "shift loop by its own length" to step to the next phrase (Music Speed Changer, Anytune), and Anytune's Step-It-Up trainer (start/end tempo, steps, repeats per step).

### Cited Findings
**Capo regions**
- "Add Region" in the Regions control set creates a region spanning the **current bar**. Tapping a region activates it and shows side handles, which you drag to resize; regions cannot overlap. Regions **snap to the nearest beat by default**, and you "drag your finger above or below the handles to turn snapping off". When a region is selected, the Play button changes to show playback will loop inside it. Tap the title to rename; delete via "Remove Region" — [Capo help: advanced audio playback](https://supermegaultragroovy.com/products/capo/help/ios/4.5/advanced-audio-playback/).
- The App Store copy stresses there is no separate loop toggle: select a region and press Play — [Capo App Store (GB)](https://apps.apple.com/gb/app/capo/id696977615).
- Count-In options are **Off, 1, 2 or 4 bars**. The click plays for that duration before a looping region begins, and when a region is selected with count-in on, looping starts from the region start after the count — [Capo help: advanced audio playback](https://supermegaultragroovy.com/products/capo/help/ios/4.5/advanced-audio-playback/).
- You can navigate by region, marker and chord (separate navigation modes) — [Capo help: control strip](https://supermegaultragroovy.com/products/capo/help/ios/4.5/control-strip/).

**Moises**
- Sections (announced 11 Sep 2023, Premium) "automatically detect and isolate Intros, Verses, Choruses, and Bridges", aligned to the downbeat so loops start "on the right beat". It is available on web, desktop, iOS and Android — [Moises newsroom: Sections](https://moises.ai/newsroom/product-announcements/new-song-sections-feature).
- On web you loop a section via the three-dot menu next to it, and Sections work with the key changer, smart metronome and speed changer — [Moises help: Sections (search excerpt)](https://help.moises.ai/hc/articles/10138829000988-How-do-I-use-Sections).
- A forum user says the PC version has a waveform where "you drag the sliders to fit" a loop. Another said looping was "PAID version" only, contradicted by a later reply. An older post said looping was not supported on iPad yet (likely outdated) — [JustinGuitar community](https://community.justinguitar.com/t/check-out-the-moises-app/142726).
- The count-in can precede a selected loop — [Moises help: count-in (search excerpt)](https://help.moises.ai/hc/en-us/articles/6580752102044-How-do-I-set-up-the-count-in).

**Anytune**
- Step-It-Up trainer settings: start and end tempo, start and end pitch, step count, step repeat, and an end action (e.g. keep looping the final step). Starting the trainer uses the current A/B points and turns looping on. Loop tools also include A and B sliders, loop shifting, doubling loop length and an optional loop delay (pause between repeats). Source is a developer or draft documentation site, so treat it with caution — [develop.anytune.us (search excerpt; direct fetch returned HTTP 500)](https://develop.anytune.us/?p=4663).
- MacTech describes the trainer as letting learners "start off slowly and gradually increase the speed over a looped section" — [MacTech 2021](https://www.mactech.com/2021/07/29/anytune-is-a-handy-tool-for-musicians-dancers-singers-and-now-runs-on-m1-macs/amp/).
- Marks can be queued with "Play Next" and copied from Tune Info — [Anytune Pro App Store](https://apps.apple.com/us/app/anytune-pro-music-trainer/id427637607). Loop and audio marks can be shared by email or synced over iCloud — [MacTech 2014](https://www.mactech.com/2014/01/02/kool-tools-anytune-for-mac).
- On the free iOS app, the Pro Pack gates count-in, Step-It-Up, Transcribe Mode, gain/pan and *unlimited* marks — [Anytune App Store](https://apps.apple.com/us/app/-/id415365180).

**Music Speed Changer**
- In the full editor, tap **A** then **B** during playback. A pencil button opens wheel pickers (minutes/seconds/milliseconds) for each point, with a 1 ms vs 10 ms increment switch. **AB arrow buttons shift both points by the current loop length**, and X clears both points while playback continues — [Music Speed Changer help](https://help.musicspeedchanger.com/article/fb34fxvon7-a-b-practice-loop-points).

**Amazing Slow Downer**
- Seamless loops are set by touching "Set" buttons during playback. Saved loops are "automatically organized under a disc looking icon linked to the song", and a past bug lost saved loops on file rename (fixed 6.8.2). MIDI and Bluetooth remotes support Set Loop Start/End and "Play From Loop Start" — [ASD App Store](https://apps.apple.com/us/app/amazing-slow-downer/id308998718).
- A per-loop speed ramp exists in Song Surgeon, where loop controls "gradually increase the speed every time the loop runs". I could not confirm it in ASD itself — [search summary of 2014 review](https://downloads.silicon.co.uk/?p=25897).

**Transcribe!**
- Section markers auto-label alphabetically (A, B, …) and measure markers take the section label plus a number (A2, A3) — [FaChords guide](https://fachords.com/blog2014/transcribe-software-help-transcribe-recorded-music). Select in the waveform, enable "Play Selection" plus "Loop" in the Play menu, and stored loops or positions are available — [FaChords guide](https://fachords.com/blog2014/transcribe-software-help-transcribe-recorded-music); [Seventh String screenshots](https://seventhstring.com/xscribe/screenshots.html).

**AudioStretch / RipX / Chord AI / Chordify**
- AudioStretch supports unlimited markers and A-B loop, but "you can only have one loop-region at a time" — [AudioStretch App Store](https://apps.apple.com/us/app/id571863178?l=en-us); [Cult of Mac](https://www.cultofmac.com/?p=523495).
- RipX DAW v8.0.3: when creating a loop, "the start/end boundary is set to encompassing bars" (auto bar-snap) — [Hit'n'Mix version changes](https://hitnmix.com/?p=6938).
- Chord AI's developer calls its loop interface "very simple and intuitive", with loop start/end points — [Chord AI App Store](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109). Chordify's loop is Premium-only — [GuitarChalk](https://www.guitarchalk.com/chordify-review/).
- A free competitor (PracticeSession) advertises "no cap on regions or loops", while Up Tempo's free tier caps at 6 saved loops — [PracticeSession blog](https://www.practicesession.app/blog/best-slow-down-apps-iphone-android/) (vendor-authored).

### Inferences
- Splitune's "bar-snapped loops" fits the best-in-class pattern (Capo, RipX, Moises Sections). Copy Capo's details: a new loop defaults to the current bar, snap to beat or bar by default, a gesture or modifier to temporarily disable snap, and Play turns into "Play loop" when a loop is active (no separate loop toggle).
- Count-in should be measured in **bars** and default to on for loops (Capo's Off/1/2/4 bars is the clearest UI). Moises's limit of "4 clicks at the start" for free users shows count-in treated as a premium knob, which Splitune should not copy.
- "Shift loop by its length" (Music Speed Changer, Anytune shift) plus "double loop length" (Anytune) is the natural "next phrase / extend" pair. In a bar-snapped world it becomes "next N bars" and "×2 bars", both pedal-mappable.
- Step-It-Up gives a ready parameter set for Splitune's speed trainer: start %, target %, step size or count, repeats per step, end action, and optional gap between repeats. Pair it with the count-in.
- Pedal and remote control: ASD's MIDI/Bluetooth commands (Set Loop Start/End, Play From Loop Start) and Anytune's Watch remote confirm demand. The minimum pedal command set is play/pause, restart loop, set A, set B, next section.
- Saved loops attached to a song (ASD's disc icon, Anytune marks, Transcribe! stored loops) are expected. Losing them is a top-tier complaint (ASD's rename bug, and Capo's "no saving without subscription").

### Gaps
- No source documented Moises mobile loop gestures (drag handles vs buttons), loop nudging in Moises or Capo, or whether Moises offers a tempo ramp.
- Anytune's Step-It-Up defaults (e.g. default step size) were not available, because the official manual page failed to load.
- Soundslice has a documented "speed training" feature (it appeared in results: [Soundslice help](https://soundslice.com/help/en/player/basic/286/speed-training)), but I did not fetch it.

## 4. Stem mixer: per-stem volume/mute/solo, presets, naming and colour, and placement on mobile vs desktop

### Takeaway
Every stem tool converges on a per-stem row with volume plus **M**ute and **S**olo (BandLab, Moises), named by instrument (Vocals, Drums, Bass, Guitar, Piano, Other/Strings). Moises adds a Master Volume, and "backing track" presets are expressed as products (acapella, drum-less, bass-less, karaoke) rather than mixer states. Capo's mixer treats **song, chords (synth) and metronome as channels**, and Chordify separates "chord volume" from "song volume". Splitune should copy that: the click and chord-preview sounds belong in the same mixer as the stems. Placement details (bottom sheet vs side panel) are poorly documented.

### Cited Findings
- BandLab Splitter: "tap on S to Solo or M to Mute" the Vocals, Drums, Bass, Guitar, Piano or Others — [BandLab help](https://help.bandlab.com/hc/en-us/articles/16560236938777-What-is-Splitter).
- Moises separates vocals, drums, guitar, bass, piano, strings and other. Premium adds lead/rhythm guitar, acoustic/electric guitar and main/background vocals. Pro adds "drum-part" modules. Backing tracks are offered as acapella, drums, bass, guitar, karaoke and piano. Export covers mixes and stems including the metronome click track — [Moises App Store](https://apps.apple.com/us/app/moises-the-musicians-app/id1515796612).
- Moises's web player added Master Volume "useful for live performances" — [Moises newsroom](https://moises.ai/newsroom/product-announcements/new-moises-web-player).
- A reviewer says the Moises mixer "makes it easy to solo and mute stems, adjust volumes, and experiment with quick changes", and advises soloing to check for bleed — [search summary of reviews](https://www.musicseed.ai/reviews/moises-ai-reviews); [Violet Recording](https://violetrecording.com/moises-review/).
- Capo's Mixer (Playback control set) controls the volume of the song, the chords and the metronome, and the Mixer icon highlights whenever any volume is below 100 % — [Capo help: advanced audio playback](https://supermegaultragroovy.com/products/capo/help/ios/4.5/advanced-audio-playback/); [Capo help: control strip](https://supermegaultragroovy.com/products/capo/help/ios/4.5/control-strip/).
- Capo's older "Neptune" isolation (pre-AI, stereo-only) uses Solo / Mute / Off modes with Pan, Width and low/high frequency controls and a "Pan Energy" display. Its example ranges are ~300 Hz–8 kHz for vocals and 20–200 Hz for bass — [Capo help: advanced audio playback](https://supermegaultragroovy.com/products/capo/help/ios/4.5/advanced-audio-playback/). A competitor says Capo now has on-device stems — [PracticeSession blog](https://www.practicesession.app/blog/best-slow-down-apps-iphone-android/).
- Anytune's pre-AI isolation equivalents are "ReFrame Audio Isolation" (solo or mute vocals/instruments) and "FineTouch EQ" — [Anytune Pro App Store](https://apps.apple.com/us/app/anytune-pro-music-trainer/id427637607). Transcribe! offers Mono/Karaoke (phase-reverse vocal elimination) and a 31-band EQ with "remove/solo frequency range" presets — [Seventh String screenshots](https://seventhstring.com/xscribe/screenshots.html).
- Chordify Premium has separate "chord volume" and "song volume" sliders — [GuitarChalk](https://www.guitarchalk.com/chordify-review/).
- Chord AI separates into 4 stems (bass, drums, vocals, other), with a 6-stem option per release notes — [Chord AI App Store](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109).
- RipX separates "each individual note from every stem", letting users isolate a part and watch its pitches on a piano roll during playback — [Hit'n'Mix: RipX for guitarists](https://hitnmix.com/2024/01/03/ripx-deepremix-deepcreate-for-guitarists/).
- Fender Play lists "backing & isolated tracks" among practice features (it is unclear whether these are AI-separated or licensed multitracks) — [Fender Play App Store](https://apps.apple.com/app/id1226057939).

### Inferences
- Splitune's mixer should have one row per stem (name, volume, M, S), a master, and **click** and **count-in** rows (Capo pattern), plus an "altered" indicator on the mixer entry point (Capo highlights when anything is below 100 %). Mute and solo must not rely on colour alone (letters M/S plus pressed state), which fits the WCAG rule in CLAUDE.md.
- Learner-facing presets should be phrased as goals ("Play along: my part muted", "Hear only my part", "Rhythm section only"), mirroring Moises's backing-track language, rather than raw stem states. For a learner, "mute my instrument" is the primary action.
- Since the user's own part is the focus, a good default is the user's part soloed or highlighted at the top, with the rest grouped as "band".
- Bleed is the expected artifact, and reviewers already advise "solo to check bleed". A quick A/B between the original mix and the stem is a confidence tool that helps.

### Gaps
- I found no source describing stem colours, whether Moises uses vertical faders vs horizontal sliders, or where the mixer opens on mobile (sheet, tab, overlay) vs desktop (side panel). This needs hands-on screenshots.
- No evidence on pan per stem in Moises (reviews did not mention it).

## 5. Chord display: chord lane vs grid vs "current chord" card, diagrams, capo/transpose, simplification, key

### Takeaway
Three chord presentations recur: (a) a **chord lane under the waveform** (Capo Practice view, Moises), (b) a **bar-organized chord grid/chart** (Capo "Chords" view with Compact, Full-Width or Grid-Aligned layouts; Moises "Grid Mode"; Chord AI "bars and beats" boxes), and (c) a **running chord strip with a moving highlight and diagrams** (Chordify). The strongest supporting controls are instrument-specific diagrams with tuning and capo (Capo), left-handed flip (Capo), simplification levels (Chord AI: Simple/Basic/All; Chordify and Moises: simplify toggle), and per-song memory of capo, transpose and simplify (Chordify). Capo's Chord Chooser, with "alternates sorted by likelihood" plus voicing audition and "Replace all", is the best documented correction UI and doubles as a confidence affordance.

### Cited Findings
**Capo**
- Chord display options: Hide, Chord Names, guitar Chord Boxes, or Simple Piano diagrams. Chord Box settings: size Regular or Large (iPad only, ignored in the smallest split view); instrument guitar 6-string, bass 4–6 strings, mandolin, ukulele or banjo; tunings with shapes updating; a capo fret, with chords shown relative to it (G with capo 3 shows an open E shape); and Left-Handed Chords flip — [Capo help: project view](https://supermegaultragroovy.com/products/capo/help/ios/4.5/project-view/).
- Chords-view layouts: **Compact** (default; bars grouped left), **Full-Width** (bars spread, max 8 bars per line), **Grid-Aligned** (fixed quarter-width grid, 1–4 bars per line, tallest) — [Capo help: project view](https://supermegaultragroovy.com/products/capo/help/ios/4.5/project-view/). Release 4.6 (Oct 2025) added new chord layout options — [Capo App Store listings via search](https://apps.apple.com/dk/app/capo/id696977615).
- Editing: Add Chord (or press K on a keyboard) detects at the playhead. Tapping a chord opens the Chord Chooser with "Alternates" sorted by likelihood, free-form Search (e.g. "bbadd9"), and scrollable, auditionable Voicings. A "Replace all…" toggle changes every matching chord. Press-and-hold lifts a chord to drag it, with "a blue line" for alignment — [Capo help: automatic music analysis](https://supermegaultragroovy.com/products/capo/help/ios/4.5/automatic-music-analysis/).
- Capo admits detection can be "a little too accurate (or, picky)" vs the chords you want to play — [Capo help: automatic music analysis](https://supermegaultragroovy.com/products/capo/help/ios/4.5/automatic-music-analysis/). Its 4.0 engine (Nov 2020) recognizes inversions — [Capo 4.0 changelog](https://supermegaultragroovy.com/products/capo/changelog/en/ios/2020-11-17-4-0.html).
- Key: detected key shown under the key slider and updated when transposing. The most common error is the relative key (C major vs A minor). Override via "Change Song Key" → Major/Minor → key — [Capo help: automatic music analysis](https://supermegaultragroovy.com/products/capo/help/ios/4.5/automatic-music-analysis/).

**Moises**
- A help article titled "How to use the new Chords view — Grid Mode" exists — [Moises help (title only; fetch blocked)](https://help.moises.ai/hc/en-us/articles/9570133423772-How-to-use-the-new-Chords-view-Grid-Mode). On mobile, "Song Settings > Chords" lets you switch to simplified chords, add a capo or change notation — [Moises help: chord detection (search excerpt)](https://help.moises.ai/hc/articles/6569274648220-How-do-I-use-Chord-Detection).
- Chords show in real time "paced to your selected speed", with diagrams that "include finger placements" — [Moises newsroom: web player](https://moises.ai/newsroom/product-announcements/new-moises-web-player). The listing promises "guitar tabs and chords" synced to the bars and beats — [Moises App Store](https://apps.apple.com/us/app/moises-the-musicians-app/id1515796612).
- A reviewer notes key detection is sometimes wrong "especially with modal jazz" — [Moises App Store](https://apps.apple.com/us/app/moises-the-musicians-app/id1515796612).

**Chordify**
- Web has two tabs: "Diagrams" (default) and "Overview" (running chord list only). A black square "falls on each chord change". On mobile the marker moves left to right with measures separated by vertical lines, and you can show diagrams and letters together or letters only (the reviewer preferred letters only). Diagrams cover guitar, piano and ukulele — [GuitarChalk](https://www.guitarchalk.com/chordify-review/); [Chordify App Store](https://apps.apple.com/us/app/-/id1073624757).
- Free has Play, Rewind and a "Simplify Chords" toggle. Premium has transpose, capo (marketed as a way to "simplify songs"), chord and song volume, tempo, loop, MIDI and print — [GuitarChalk](https://www.guitarchalk.com/chordify-review/); [Chordify App Store (GB)](https://apps.apple.com/gb/app/id1073624757).
- Version 1755 added per-song memory: "next to saving the capo and transpose settings per song the app now also saves if the song was set to simplify or not" — [APKMirror changelog](https://www.apkmirror.com/apk/chordify-b-v/chordify/chordify-1755-release/).
- Complaints: diagrams in the app were wrong while the website's were right; a 2023 update inverted piano chord displays on mobile; chord timing "glitches" drift — [AppTail](https://apptail.io/app/chordify-songs-chords-tuner-zti/singapore); [GuitarChalk comments](https://www.guitarchalk.com/chordify-review/).

**Chord AI**
- Chords are organized into bars and beats, with a 100k+ guitar and 10k+ ukulele voicing library, chord levels **Simple / Basic / All**, and Pro "smart capo recommendations". Instruments are piano, guitar, ukulele, bass, mandolin and banjo — [Chord AI App Store](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109).
- Complaint: "Songs often switch between 1 beat per box to 2 beats per box and back again" — [Chord AI App Store](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109).

**Others**
- Fender Songs scrolls chords in time with the music — [MusicRadar](https://www.musicradar.com/news/new-fender-songs-app-features-over-750k-songs-to-learn). Youka (adjacent product) documents grid vs inline chord display and recommends "Transpose and Capo together to find … the simplest possible chord shapes" — [Youka docs](https://docs.youka.io/studio/chord-track).
- Transcribe! lists chord *guesses* for a selected region next to the spectrum rather than asserting one chord — [Seventh String screenshots](https://seventhstring.com/xscribe/screenshots.html).

### Inferences
- Splitune should offer at least two chord presentations: a **lane** aligned to the waveform and beat grid (for looping and editing), and a **bar grid / chart** (for reading on a music stand), with a fixed beats-per-cell rule. The Chord AI complaint shows that inconsistent box durations break reading. Capo's Grid-Aligned layout (1–4 bars per line, fixed cell width) is the reference.
- A large "current + next chord" card is not documented by any of these sources. It is a candidate addition for distance reading, not an established pattern (see Gaps).
- Simplification should be a level (Simple / Basic / All, per Chord AI), not just a toggle, and capo, transpose and simplify must persist per song (Chordify 1755).
- "Smart capo" (Chord AI) and "transpose + capo to find easy shapes" (Youka) point to a "suggest easiest capo" helper.
- Capo's likelihood-sorted alternates are a direct template for Splitune's confidence-aware notation: low-confidence chords get a non-colour marker (e.g. dotted outline or "?"), and tapping opens alternates ranked by model probability, with "Replace all" and audition.
- The relative-key error (Capo) and the modal-jazz complaint (Moises) argue for showing key as an editable estimate with an obvious override.
- Left-handed flip and alternate tunings are cheap and valued (Capo). Bass needs 4–6 string support (Capo).

### Gaps
- Moises Grid Mode details (beats per cell, how diagrams sit, tab sync) could not be read (403).
- No source confirmed any product showing a big current-chord or next-chord card, or a count-down to the next change.
- No information on how Chordify or Moises indicate chord uncertainty (if at all).

## 6. Mobile vs desktop/tablet layouts, landscape, one-hand use, music-stand use

### Takeaway
Public evidence is thin. What exists: Capo adapts with Song Views and a single swappable control strip, plus iPad-only large chord boxes and split-view handling. Chordify's mobile view is "narrower and vertical" but structurally the same, and users prefer a letters-only lane on phones. Moises syncs projects and setlists between web and mobile ("prep on a computer, use the phone at rehearsal"). Desktop tools (Transcribe!, Moises web) lean on keyboard shortcuts. Remote and pedal-style control (MIDI/Bluetooth in ASD, Apple Watch in Anytune) is the main documented "hands busy" solution. I found no documentation on landscape-specific layouts or one-handed reach design.

### Cited Findings
- Capo iPad: Chord Box size Regular/Large, "ignored in the smallest split view" — [Capo help: project view](https://supermegaultragroovy.com/products/capo/help/ios/4.5/project-view/). The Control Strip shows sets depending on the current Song View — [Capo help: control strip](https://supermegaultragroovy.com/products/capo/help/ios/4.5/control-strip/). A hardware keyboard shortcut exists (K = add chord) — [Capo help: automatic music analysis](https://supermegaultragroovy.com/products/capo/help/ios/4.5/automatic-music-analysis/).
- Chordify: "The mobile layout is narrower and vertical, but it uses the same basic interface", and the reviewer found letters-only easier on mobile — [GuitarChalk](https://www.guitarchalk.com/chordify-review/).
- Moises runs on web, desktop, iPhone, iPad and Android — [Moises](https://moises.ai/), and "your projects sync between them", so you can prep on a computer and use the phone at rehearsal — [Violet Recording](https://violetrecording.com/moises-review/). A competitor claims Moises's speed and key changes are not synced across devices — [PracticeSession blog](https://www.practicesession.app/blog/best-slow-down-apps-iphone-android/) (vendor-authored, unverified). An Android TV app exists — [APKMirror](https://www.apkmirror.com/apk/moises-systems/moises-the-musicians-ai-app-android-tv/).
- Moises web: space bar play and pause, plus "shortcuts for practice and production" (only space bar named) — [Moises newsroom](https://moises.ai/newsroom/product-announcements/new-moises-web-player).
- ASD: MIDI and Bluetooth remote commands (Set Loop Start/End, Play From Loop Start) — [ASD App Store](https://apps.apple.com/us/app/amazing-slow-downer/id308998718). Anytune: Apple Watch remote add-on — [Anytune Pro App Store](https://apps.apple.com/us/app/anytune-pro-music-trainer/id427637607).
- Transcribe! is desktop only (Windows, macOS, Linux), with single-key marker placement during playback — [Seventh String screenshots](https://seventhstring.com/xscribe/screenshots.html); [FaChords](https://fachords.com/blog2014/transcribe-software-help-transcribe-recorded-music).
- Cross-platform fragmentation: ASD requires separate purchases per platform with no shared library, and Anytune Android is "a separate product still reaching parity" — [PracticeSession blog](https://www.practicesession.app/blog/best-slow-down-apps-iphone-android/) (vendor-authored).
- A Bluetooth foot controller for practice apps (AirStep Play edition) is discussed on Rig-Talk — [Rig-Talk thread](https://www.rig-talk.com/forum/threads/airstep-play-edition-footcontroller.257605/) (title only; not read).

### Inferences
- With an instrument in hand, the phone is a remote and the tablet or laptop is a music stand. Splitune should give phones a large-target transport (play/loop/restart/speed preset) reachable from the bottom, and give tablet landscape a reading view (chord grid or tab) with a slim transport.
- Desktop users expect single-key shortcuts for marker, loop and speed (Transcribe! ⌘1/⌘2 for 100 %/50 %; Capo K). Splitune's "every practice action keyboard/pedal operable" rule matches this.
- Sync of song analysis plus practice state (loops, speed, capo, mixer) across devices is a differentiator, and the alleged Moises gap shows it is not universal.

### Gaps
- No source described landscape-mode layouts, one-handed reach zones, auto-scroll behaviour for tab or chords at distance, or screen-lock prevention for music-stand use in any of these apps. Hands-on testing or screenshot review is required.
- Moises mobile tab and panel structure is unverified (help center blocked).

## 7. Library and home: listing songs, metadata, setlists and playlists, search, recent practice

### Takeaway
Library features are secondary in every product. What is documented: **setlists** (Moises, collaborative), **playlists** (Anytune with shuffle, ASD playlist files), **per-song saved state** (ASD's saved loops under a disc icon, Chordify's per-song capo/transpose/simplify memory, Capo projects that persist edits only with a subscription), and **cross-device sync** (Moises; Anytune marks over iCloud). I found no documentation of card-vs-list layout, metadata shown or "recently practiced" surfaces.

### Cited Findings
- Moises: "Collaborative setlists"; setlists are included in the free tier — [Moises App Store](https://apps.apple.com/us/app/moises-the-musicians-app/id1515796612). Songs and setlists sync across devices — [PracticeSession blog](https://www.practicesession.app/blog/best-slow-down-apps-iphone-android/).
- Anytune: playlists with shuffle — [Anytune Pro App Store](https://apps.apple.com/us/app/anytune-pro-music-trainer/id427637607); marks shared over iCloud or email — [MacTech 2014](https://www.mactech.com/2014/01/02/kool-tools-anytune-for-mac).
- ASD: playlist files supported; saved loops "automatically organized under a disc looking icon linked to the song"; one reviewer praised it as "easy to organize what you're learning" — [ASD App Store](https://apps.apple.com/us/app/amazing-slow-downer/id308998718).
- Capo: "Without an active subscription, Capo will not save your edits to the chords, beats, regions, markers, tabs, or sections in your Projects"; Pro syncs edits across devices — [Capo App Store (DK)](https://apps.apple.com/dk/app/capo/id696977615).
- Chordify: a per-song memory of capo/transpose/simplify — [APKMirror](https://www.apkmirror.com/apk/chordify-b-v/chordify/chordify-1755-release/). Chordify's library is essentially YouTube search plus its catalogue, and the reviewer praised the "huge YouTube library" — [GuitarChalk](https://www.guitarchalk.com/chordify-review/).
- Transcribe!: stored loops or positions per file — [Seventh String screenshots](https://seventhstring.com/xscribe/screenshots.html).

### Inferences
- For Splitune, the home screen's real job is "resume practice". The most useful metadata per song is processing state, my instrument/part, last practiced, saved loops count and current speed goal (inferred from what users value: saved loops and per-song settings).
- Setlists are useful for gigging users (Moises's collaborative setlists) but are lower priority for a personal learner app than "practice queue / recent".

### Gaps
- No source described the Moises, Capo or Chordify home screen layout (cards vs list), sorting, search scope or "recent" sections. Screenshots or hands-on testing are needed.

## 8. Monetization surfaces that affect practice UX (brief)

### Takeaway
The friction users complain about most is not price but **paywalls that break an in-progress practice task or hold user work hostage**. Examples: Capo not saving edits without a subscription, Chord AI asking to subscribe before showing chords, Moises turning uploads into a paid feature, Chordify's daily song limit, LALAL.AI's download lock after preview, and Klangio tokens lost when a subscription ends. Splitune runs in personal mode with mock billing, so this mainly matters as a list of things to avoid.

### Cited Findings
- Capo: edits to chords, beats, regions, markers, tabs and sections are not saved without a subscription — [Capo App Store (DK)](https://apps.apple.com/dk/app/capo/id696977615). Users call "the trial limit and subscription cost" unacceptable — [Capo App Store listings via search](https://apps.apple.com/gb/app/capo/id696977615).
- Chord AI: "didn't let me see the chords of the songs and asked me to subscribe" — [Chord AI App Store reviews via search](https://apps.apple.com/app/1446177109). Aggregated feedback flags "paywall transitions" — [marlvel.ai summary](https://marlvel.ai/api/llm/apps/music/com-musicai-musicaiapp) (third-party aggregation). Pricing is $10.99/month and $69.99/year — [Chord AI App Store](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109).
- Moises: a Nov 2024 review objects that "being able to upload prerecorded tracks had been made paid" and calls the app "a scam" — [Moises App Store](https://apps.apple.com/us/app/moises-the-musicians-app/id1515796612). Billing, refund and auto-renewal complaints recur — [PissedConsumer](https://www.pissedconsumer.com/moises-app/RT-F.html); [Trustpilot DE](https://de.trustpilot.com/review/moises.ai). Count-in is limited to 4 clicks at song start for free users — [Moises help (search excerpt)](https://help.moises.ai/hc/en-us/articles/6580752102044-How-do-I-set-up-the-count-in).
- Chordify: a daily song limit for free users (a reader says 3/day); loop, tempo, transpose and capo are Premium — [GuitarChalk](https://www.guitarchalk.com/chordify-review/); [AppTail](https://apptail.io/app/chordify-songs-chords-tuner-zti/singapore).
- Klangio: "unused tokens are lost after a subscription ends", and users ask for per-song purchases. Free transcribes only the first 20 s — [Guitar2Tabs App Store](https://apps.apple.com/app/id1589660528).
- ASD Lite plays only the first quarter of each song — [PracticeSession blog](https://www.practicesession.app/blog/best-slow-down-apps-iphone-android/).

### Inferences
- Never block saving user-created practice data (loops, corrections, sections). Never gate count-in, loop or basic speed. Never surface an upsell mid-loop.

### Gaps
- None material for Splitune (personal mode).

## 9. What users praise and complain about (patterns across reviews and forums)

### Takeaway
**Praised, repeatedly:** isolating your own instrument and slowing it down (Moises), fast chord detection (Chord AI "accurate and VERY FAST"), low-artifact slow-down "to a crawl" (Anytune, ASD), intuitive loop/organize flows (ASD, Chord AI), and simplicity (LALAL.AI, Chordify). **Complained about, repeatedly:** paywall and limit changes and billing (Moises, Chord AI, Capo, Chordify), wrong or drifting chords and keys (Capo "terrible", Chordify timing "glitches", Moises modal key errors, Chord AI "confuses chords"), inconsistent chord grid timing (Chord AI beats per box), crashes during upload or analysis (Moises, Chord AI), lost saved work (ASD rename bug, Capo subscription), stagnant apps (Capo Mac "very little … updated in a decade"), basic or awkward tab output (Capo tab "basic"; Guitar2Tabs fret positions, no bends), and missing precision controls (ASD ±1 % buttons, markers; AudioStretch pinch-zoom).

### Cited Findings
**Praise**
- Moises: a bass player praised isolating the bass and slowing songs down (Aug 2023); "the most valuable thing" is the part separation (Aug 2024). Rating 4.7/5 from 28K ratings, Editors' Choice, v2.153.0 — [Moises App Store](https://apps.apple.com/us/app/moises-the-musicians-app/id1515796612).
- Chord AI: "accurate and VERY FAST" and "learned so so many new chords and progressions"; 4.6/5 from ~5.9K ratings, v6.3.0 — [Chord AI App Store](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109). On the JustinGuitar forum, users found the speed and loop controls work well — [JustinGuitar community](https://community.justinguitar.com/t/what-software-do-you-use-for-transcription/80645).
- Anytune: "It will slow things down to a crawl without a loss of quality"; 4.9/5 from 456 ratings — [Anytune Pro App Store](https://apps.apple.com/us/app/anytune-pro-music-trainer/id427637607).
- ASD: "amazingly intuitive, easy to organize what you're learning" (2018); 3.9/5 from 461 ratings, v7.1.3 — [ASD App Store](https://apps.apple.com/us/app/amazing-slow-downer/id308998718).
- Capo: one reviewer found beat detection "surprisingly accurate" — [Capo App Store via search](https://apps.apple.com/gb/app/capo/id696977615).
- Transcribe!: users describe looping between markers as easy — [Gearspace thread](https://gearspace.com/threads/seventh-string-transcribe.894338/). Comparison blogs cast it as the best one-time desktop purchase (~$39) — [Guitar Music Theory](https://www.guitarmusictheory.com/best-software-for-slowing-down-music-to-practice-guitar/); [StemConsole](https://stemconsole.ai/blog/capo-alternatives/) (summary of both; the latter is competitor-authored).
- LALAL.AI: "simple and user-friendly interface" — [Filmora review](https://filmora.wondershare.com/video-editor-review/lalal-ai-review.html); [MSPowerUser review](https://mspoweruser.com/lalal-ai-review).

**Complaints**
- Chord and key accuracy: Capo "chord detection terrible" (a reviewer who raised the rating after support helped with key change) — [Capo App Store via search](https://apps.apple.com/gb/app/capo/id696977615). Engadget: Capo's "chord detection isn't flawless" — [Engadget](https://www.engadget.com/tag/Capo). Chord AI "sometimes confuses chords" — [AppFollow](https://apps.appfollow.io/ios/chord-ai-play-any-song/1446177109?country=us). Moises key detection wrong "especially with modal jazz" — [Moises App Store](https://apps.apple.com/us/app/moises-the-musicians-app/id1515796612). Chordify chord timing glitches — [GuitarChalk](https://www.guitarchalk.com/chordify-review/).
- Beat grid in odd or mixed meters: a Capo reviewer notes beat detection can go wrong with odd or mixed meter — [Capo App Store via search](https://apps.apple.com/gb/app/capo/id696977615). Capo's own fix is to tap bar downbeats during playback (you can redo it) or set beats per bar per bar — [Capo help: automatic music analysis](https://supermegaultragroovy.com/products/capo/help/ios/4.5/automatic-music-analysis/).
- Grid reading: Chord AI "switch between 1 beat per box to 2 beats per box and back again" — [Chord AI App Store](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109).
- Tab quality: Capo's tab notation "basic, lacks basic features for guitarists" (old Capo 2 review) — [Premier Guitar](https://www.premierguitar.com/articles/SuperMegaUltraGroovy_Software_Capo_2_Review). Guitar2Tabs puts frets 9–14 notes as open or low-fret notes on higher strings and "couldn't interpret bends at all"; 3.3/5 from 29 ratings — [Guitar2Tabs App Store](https://apps.apple.com/app/id1589660528). MuseHub user: "a little too good actually… even turns the accidental background noises into tabs" — [MuseHub](https://musehub.com/app/guitar2tabs). MusicRadar calls Klang.io's built-in notation editor basic — [MusicRadar review](https://www.musicradar.com/music-tech/klang-io-promises-to-turn-audio-into-notated-transcriptions-lead-sheets-and-guitar-tabs-but-does-it-actually-work-klang-io-transcription-studio-review). MusicRadar's Songscription review headline: "Humans will be doing all the serious music transcription for the foreseeable future"; it reportedly found a piece shifted an eighth note late — [MusicRadar Songscription review](https://www.musicradar.com/music-tech/humans-will-be-doing-all-the-serious-music-transcription-for-the-foreseeable-future-songscription-review) (body not retrievable; detail via a [Songscription blog](https://www.songscription.ai/blog/songscription-vs-klangio) citing it).
- Stability: Moises "crashes frequently, especially when uploading songs" — [Trustpilot DE](https://de.trustpilot.com/review/moises.ai). Chord AI crashes loading YouTube chords — [AppFollow](https://apps.appfollow.io/ios/chord-ai-play-any-song/1446177109?country=us). ASD "consistently crashes" (2020; the developer blamed streaming connectivity) — [ASD App Store](https://apps.apple.com/us/app/amazing-slow-downer/id308998718). A RipX forum thread is titled "RipX DAW incredibly slow" — [Hit'n'Mix forum](https://hitnmix.com/community/ripx-daw-forum/ripx-daw-incredibly-slow/) (title only).
- Stagnation: Capo Mac "very little of the core functionality has been updated in a decade" — [Capo App Store listings via search](https://apps.apple.com/gb/app/capo/id696977615?mt=12).
- Precision and control wishes: ASD "+ or - 1" speed buttons, jump-to markers, 5/10/15 s skips — [ASD App Store](https://apps.apple.com/us/app/amazing-slow-downer/id308998718). AudioStretch: pinch zoom on the waveform, and only one loop region at a time — [AppsHunter](https://appshunter.io/ios/app/571863178/reviews/8); [Cult of Mac](https://www.cultofmac.com/?p=523495). Chordify: "inability to adjust tempo smoothly" (~10 % of feedback, third-party aggregation) — [OnClarity](https://www.onclarity.com/leaderboard/insight/chordify).
- Artifacts at extremes: "some distortion is present at very slow speeds" (ASD, 2017) — [ASD App Store](https://apps.apple.com/us/app/amazing-slow-downer/id308998718); "extreme shifts turn artifacts into obvious warble" (Moises) — [Violet Recording](https://violetrecording.com/moises-review/).
- Separation bleed: "on busy mixes you will hear some bleed and watery artifacts" — [Violet Recording](https://violetrecording.com/moises-review/); a Moises reviewer says some lower pitches get misidentified as bass — [Moises App Store](https://apps.apple.com/us/app/moises-the-musicians-app/id1515796612).

### Inferences
- The accuracy complaints are unavoidable for any AI transcriber. The products that fare better give fast, local corrections (Capo's chooser and bar tapping). Splitune's "corrections are overlays" plus confidence display directly answers the most common complaint class, and it should be as fast as Capo's long-press drag and "Replace all".
- Tab must handle playable fret positions and bends or slides to avoid the Guitar2Tabs criticism. Showing confidence lets users know which notes to check.
- Precision controls (±1 % speed, bar-step loop nudge, zoom) are asked for by intermediate users of simple apps. Splitune should expose them behind a "fine" affordance rather than hide them.

### Gaps
- No first-hand Reddit data (r/guitar, r/WeAreTheMusicMakers, r/bass): the domain is blocked for this crawler, and one mirror failed TLS. Forum and review evidence above stands in.
- No quantitative sentiment breakdowns beyond a few third-party aggregators of uncertain method (OnClarity, marlvel, Kimola).

## 10. Best-in-class interaction patterns vs anti-patterns (and what Splitune should adopt or avoid)

### Takeaway
Best-in-class patterns with documented evidence:
1. Capo's beat-snapped regions (new loop = current bar; snap by default, drag off-axis to disable; Play becomes "loop").
2. Count-in in bars before a loop (Capo Off/1/2/4).
3. Shift a loop by its own length and double it (Music Speed Changer, Anytune).
4. A parameterized speed trainer (Anytune Step-It-Up).
5. Section loops aligned to downbeats (Moises Sections).
6. A context-swapping control strip with "altered" indicators (Capo).
7. Separate Key (semitones) and Pitch (cents) controls.
8. Speed % shown together with resulting BPM.
9. Chord correction with likelihood-ranked alternates, audition and "Replace all" (Capo).
10. Chord layouts with fixed beats per cell (Capo Grid-Aligned).
11. Simplification levels and per-song memory of capo, transpose and simplify (Chord AI, Chordify).
12. Song, chord and click volumes in one mixer (Capo, Chordify).
13. Remote and pedal commands for loop start, end and replay (ASD, Anytune Watch).
14. Re-run a stage without re-uploading (Moises).

Anti-patterns:
1. Paywalls on saving, count-in, loop or basic speed.
2. Inconsistent beats per chord box.
3. A single loop region only.
4. No waveform zoom.
5. Time-only loop editing with millisecond wheel pickers instead of musical units.
6. Opaque processing with no partial use.
7. Losing saved loops on rename or sync.
8. Chord or diagram renderings that differ between platforms.

### Cited Findings
- Capo region snapping, current-bar default and Play-loops-selection — [Capo help: advanced audio playback](https://supermegaultragroovy.com/products/capo/help/ios/4.5/advanced-audio-playback/); [Capo App Store (GB)](https://apps.apple.com/gb/app/capo/id696977615).
- Capo count-in Off/1/2/4 bars before regions — [Capo help: advanced audio playback](https://supermegaultragroovy.com/products/capo/help/ios/4.5/advanced-audio-playback/).
- Loop shift by loop length and ms-level pickers — [Music Speed Changer help](https://help.musicspeedchanger.com/article/fb34fxvon7-a-b-practice-loop-points). Anytune loop shift, double, delay and Step-It-Up parameters — [develop.anytune.us (search excerpt)](https://develop.anytune.us/?p=4663).
- Moises downbeat-aligned Sections — [Moises newsroom](https://moises.ai/newsroom/product-announcements/new-song-sections-feature).
- Capo Control Strip with active highlights and the time/bar position toggle — [Capo help: control strip](https://supermegaultragroovy.com/products/capo/help/ios/4.5/control-strip/); [Capo help: project view](https://supermegaultragroovy.com/products/capo/help/ios/4.5/project-view/).
- Capo Chord Chooser (alternates by likelihood, voicings, Replace all) and bar re-tapping — [Capo help: automatic music analysis](https://supermegaultragroovy.com/products/capo/help/ios/4.5/automatic-music-analysis/).
- Capo chord layouts (Compact, Full-Width max 8 bars, Grid-Aligned 1–4 bars per line) — [Capo help: project view](https://supermegaultragroovy.com/products/capo/help/ios/4.5/project-view/).
- Chord AI simplification levels Simple/Basic/All and smart capo; beats-per-box inconsistency complaint — [Chord AI App Store](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109).
- Chordify per-song settings memory — [APKMirror](https://www.apkmirror.com/apk/chordify-b-v/chordify/chordify-1755-release/); separate chord/song volume — [GuitarChalk](https://www.guitarchalk.com/chordify-review/).
- ASD remote commands — [ASD App Store](https://apps.apple.com/us/app/amazing-slow-downer/id308998718).
- Moises re-separation without re-import — [Moises newsroom](https://moises.ai/newsroom/product-announcements/new-moises-web-player).
- AudioStretch LiveScrub and zero-speed freeze (best-in-class for finding notes by ear), but one loop region and no pinch zoom — [AudioStretch App Store](https://apps.apple.com/us/app/id571863178?l=en-us); [Cult of Mac](https://www.cultofmac.com/?p=523495); [AppsHunter](https://appshunter.io/ios/app/571863178/reviews/8).
- Transcribe! auto-labelled section/measure markers (A, A2, A3) and single-key marker drops — [FaChords](https://fachords.com/blog2014/transcribe-software-help-transcribe-recorded-music).
- RipX auto-extends loops to encompassing bars — [Hit'n'Mix version changes](https://hitnmix.com/?p=6938).
- Fixed slow-down presets (50 %/75 %) in Fender Play Practice Mode — [Guitar World](https://guitarworld.com/reviews/fender-play-review).
- Anti-pattern evidence: Capo's save-gate — [Capo App Store (DK)](https://apps.apple.com/dk/app/capo/id696977615); Moises's free count-in limit — [Moises help (search excerpt)](https://help.moises.ai/hc/en-us/articles/6580752102044-How-do-I-set-up-the-count-in); ASD's lost-loops-on-rename bug — [ASD App Store](https://apps.apple.com/us/app/amazing-slow-downer/id308998718); Chordify app/web diagram mismatch — [AppTail](https://apptail.io/app/chordify-songs-chords-tuner-zti/singapore).

### Inferences
Concrete recommendations for Splitune (inferred from the findings above):
- **Loop model:** a loop is a bar range. Create it from the current bar, a drag across bars, a section chip or A/B pedal presses (snapped to the nearest beat or bar). Add "next phrase" (shift by length), "×2/÷2 length" and "±1 bar" nudges at each edge. Allow multiple saved loops per song with names (Transcribe!-style auto labels like "Verse 1 · bars 9–16"). Play turns into loop-play when a loop is active.
- **Count-in:** in bars (Off/1/2/4), audible and visual (Anytune), on by default for loops, following the detected meter including odd meters.
- **Speed:** preset chips (50/60/70/75/80/90/100 %) plus ±1 % stepper and drag, showing % and resulting BPM. Allow a speed trainer with start %, target %, step, repeats per step, end action and optional gap between repeats.
- **Pitch:** Key (semitones, with notation and chords following) separate from Tune (±100 cents) for detuned recordings. Show the detected key as an editable estimate.
- **Timeline:** waveform with beat grid, bar numbers and section bands (Intro/Verse/Chorus/Bridge, per Moises). Position readout toggles time ↔ bar:beat. Add zoom (pinch/scroll) and a scrub-at-finger-speed mode (AudioStretch) for transcribing by ear.
- **Mixer:** one row per stem (name + M/S + level), master, and click/count-in and chord-preview rows. Goal-phrased presets ("mute my part", "only my part", "rhythm section"). Put an "altered" badge on the mixer entry point.
- **Chords:** a lane aligned to the grid plus a bar chart with a fixed beats-per-cell rule and selectable bars per line (Capo's 1–4 / up to 8). Diagrams per instrument, tuning, capo and left-hand. Simplification levels. Per-song persistence. Low-confidence chords flagged by shape or text (not colour), with tap → likelihood-ranked alternates, audition and "Replace all".
- **Processing:** show the original audio playable at once, then light up beats → sections → stems → chords → tab as stages finish. Allow re-running a stage (different part or separation) without re-upload, and notify when done.
- **Never:** paywall or limit saving of loops and corrections, count-in or looping; lose saved loops; render chords differently across platforms; mix beats-per-cell within a grid.

### Gaps
- Several "best-in-class" claims rest on official docs rather than observed usability (e.g. whether Capo's off-axis snap toggle is discoverable). No usability-test data was found for any product.
- Moises (the market leader) is under-documented here because its help center blocked fetching. Its mobile layout, loop gestures, Grid Mode and tab view should be checked in the app before final design decisions.
- Fender Studio's practice features, LALAL.AI's player UI and RipX's practice-specific UI were only lightly covered, because the sources found describe features, not layouts.
