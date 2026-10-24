---
title: Hands-busy use and device context
workstream: ux
last_researched: 2026-10-20
confidence: medium
---

# Hands-busy use and device context

## TL;DR
- Learners hold an instrument while operating the app. Make every in-practice control reachable with a foot pedal, a keyboard, or a very large touch target. Apple's guidance is controls of at least 44 x 44 points; Google's accessibility help says at least 48 x 48 dp with about 8 dp of spacing; WCAG 2.2 sets 24 x 24 CSS px as the AA minimum and 44 x 44 CSS px as the AAA target.
- Bluetooth page turners (AirTurn, PageFlip) present themselves as keyboards that send configurable keys. Documented defaults include up/down arrow, left/right arrow, page up/down, space/return, and mouse buttons, but the mode-to-key mapping differs by model and sources conflict. **Bind Up/Down/Left/Right/PageUp/PageDown/Space/Enter** to practice actions and let users remap.
- Voice control is plausible for coarse commands but unreliable while playing (noise; the Web Speech API is "limited availability" and in Chrome sends audio to a server). Treat it as optional.
- Reading distance is a real constraint: community guidance cites 8.5 mm staves for instrumental parts on stands; a 1-2 m phone-on-floor setup needs roughly 2x larger notation than a music-stand setup (arithmetic below, not from a source).
- Use auto-pause, rest beats, and "play once then wait" patterns to avoid reaching for the screen after every attempt.

## Findings

### Touch target sizes (official guidelines)

| Guideline | Value | Notes |
|---|---|---|
| Apple design tips | Controls at least 44 x 44 points to be accurately tapped with a finger ([Apple Design Tips](https://developer.apple.com/design/tips/)) | Apple's fuller HIG pages are JavaScript-rendered and did not load for me; this is the static Apple page |
| Google accessibility help (Android) | Elements at least 48dp wide and high; space targets 8dp or more apart ([Google Accessibility Help](https://support.google.com/accessibility/android/answer/7101858)) | The Material Design 3 and Android developer pages I tried did not state the number; this is the page that did |
| WCAG 2.2 SC 2.5.8 Target Size (Minimum), Level AA | At least 24 x 24 CSS px, with exceptions (spacing, equivalent control, inline, user-agent, essential) ([Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)) | Legal floor for web |
| WCAG 2.2 SC 2.5.5 Target Size (Enhanced), Level AAA | At least 44 x 44 CSS px ([Understanding 2.5.5](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)) | Matches Apple's 44 |

**Hands-busy recommendation (not from a source):** in practice mode make primary controls (play/pause, loop restart, tempo +/-, mute my part) at least 64 pt/dp, because the player is often using a non-dominant hand, a knuckle, or a stylus, and spaced at least 16 dp. Keep secondary controls at 48 dp or larger.

### Foot pedals and Bluetooth page turners
- **AirTurn.** AirTurn's FAQ says its pedals "send computer keyboard keys or MIDI commands," can be reprogrammed in AirTurn Manager (iOS and Android), and recommends Mode 2 for iOS/Android on BT200, BT200S, and PEDpro; Mode 3 is for Mac/PC and Mode 7 is MIDI on those models ([AirTurn FAQ](https://www.airturn.com/blogs/support/faq)). The AirDirect developer FAQ lists Mode 1 as direct connection and "other devices" profiles with defaults: Mode 2 up/down, Mode 3 left/right, Mode 4 page up/down, Mode 5 space bar/return, Mode 6 mouse buttons ([AirDirect FAQ](https://dev.airturn.com/sdk/docs/main/airdirect-faq.html)). An AirTurn solutions article says every footswitch has six user-defined modes and that a switch can be programmed to send a keyboard code plus modifiers ([Pedal hack](https://www.airturn.com/blogs/solutions/pedal-hack-macro-assistance-for-documents)). **Source conflict:** a blog excerpt I saw via search placed page up/down in Mode 3, while the developer FAQ puts it in Mode 4; the mapping depends on model and firmware. Do not hard-code a mode.
- **PageFlip.** OnSong's Firefly page lists programmable pedal modes and independently programmed external pedals but gives no key table ([OnSong: PageFlip Firefly](https://onsongapp.com/docs/features/foot-pedals/supported/pageflip/firefly)). Search excerpts of OnSong's Cicada page (not opened by me) say the Cicada works with iPads and Android tablets in apps that accept keyboard commands. Retailer excerpts (not opened by me; the retailer page returned HTTP 403) say the Firefly has selectable modes (up/down, left/right, arrow keys, mouse click, spacebar/enter) and is reprogrammable. Treat the exact key lists as **unverified**.
- **Implication.** They are keyboards from the web or OS point of view. In a web app, `keydown` events with `ArrowUp/ArrowDown/ArrowLeft/ArrowRight/PageUp/PageDown/Space/Enter` will fire. A native app on iOS needs hardware-keyboard command support. WCAG 2.1.1 requires all functionality to be keyboard-operable anyway ([Understanding 2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)).
- **Recommended default pedal mapping (recommendation):**

| Key | Action in practice mode |
|---|---|
| Right / PageDown (pedal 2) | Next phrase (or play/pause, user-selectable) |
| Left / PageUp (pedal 1) | Restart loop |
| Space | Play/pause |
| Up / Down | Tempo +5% / -5% |
| Enter | "That was clean" (counts a pass if scoring is self-assessed) |

Offer a "learn this pedal" screen that asks the user to press each pedal and assigns it, since the mode-dependent keys are unpredictable. Debounce: pedals can double-fire; ignore repeats within about 150 ms (recommendation).

### Keyboard shortcuts
Provide a documented shortcut set (desktop and tablets with keyboards): Space play/pause, `[` `]` set loop A/B, `L` loop on/off, `-`/`+` tempo, `M` mute my stem, `S` solo my stem, `C` count-in. Avoid single-letter shortcuts that conflict with text inputs, and let users turn them off (WCAG 2.1.4 Character Key Shortcuts; I did not open that page, so treat as a pointer). All functions must also be reachable by keyboard (2.1.1 above).

### Voice control
- **Web.** The `SpeechRecognition` interface is marked "Limited availability" by MDN, and on some browsers such as Chrome it uses a server-based engine, so audio is sent to a web service and the feature will not work offline; `processLocally`, `available()`, and `install()` provide on-device options ([MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)).
- **iOS and Android native.** Apple's Speech framework and Android's recognisers support on-device modes in principle; I could not load the Apple documentation page content (JavaScript-rendered) and did not open the Android one, so no platform-specific claims are made here. Check `SFSpeechRecognizer` and `SpeechRecognizer` docs when designing.
- **Problems specific to music (inference).** The instrument and the backing track are loud sources; a learner's command competes with them; recognition latency of hundreds of milliseconds is fine for "pause" but not for "now". The microphone is also needed for scoring (`practice-tool-patterns.md`), so voice commands would share that stream and may be mistaken for notes.
- **Recommendation.** Voice is a P3 feature: only a small closed vocabulary ("pause", "restart", "slower", "faster", "loop"), push-to-talk or "between takes" listening, and always with a visible and pedal alternative. Do not rely on it for accessibility needs without a fallback.

### Screen distance and readability
- **Instrumental-part staff size.** A forum thread quoting the Major Orchestra Librarians' Association gives 8.5 mm as the most readable staff size for instruments (about 24 pt), and notes parts can be as far as around 3 ft from the eye; for choral music, Gould's guidance of 4.8-5.5 mm is cited and a forum poster suggests at least 16 pt (about 5.6 mm) ([Musica Sacra forum thread](https://forum.musicasacra.com/forum/discussion/comment/179594)). This is **tier 4** (community; I could not verify MOLA or Gould directly).
- **Screen reading.** A study of digital music stands found some reduction in displayed music size was possible without significantly harming reading accuracy ([Bell et al. 2005](https://researchcommons.waikato.ac.nz/entities/publication/921242c4-41c4-4cbc-a130-989da1517138)); abstract only.
- **Large print.** Modified Stave Notation is the term for large-print music and is used by exam boards for candidates with partial sight; MuseScore's guidance is to increase the staff space until the music is comfortable, without a mm target ([MuseScore: Modified Stave Notation](https://musescore.org/en/tutorials/modified-stave-notation)).
- **Scaling arithmetic (mine, not a source).** If an 8.5 mm staff is comfortable at about 0.9 m (the forum's "3 ft"), the same visual angle at 2 m needs about 8.5 x (2.0 / 0.9) = about 19 mm staff height, and at 1.5 m about 14 mm. A 6-inch phone screen is roughly 70-75 mm wide in portrait, so a single 19 mm staff leaves room for very few bars: at 2 m, show **one or two bars at a time** or switch to chord names and big tab numerals. Validate with actual users and devices.
- **Recommendation.** Provide a "distance" setting (Close 0.5 m, Stand 1 m, Far 2 m) that scales notation, fretboard, and now-line, in addition to OS text scaling (WCAG 1.4.4 requires text to scale to 200% without loss of content ([Understanding 1.4.4](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html))).

### Phone vs tablet vs desktop

| Device | Strengths | Weaknesses | Suggested role |
|---|---|---|---|
| Phone (portrait on a stand) | Always at hand; mic built in; low friction | Small display; 1-2 bars of readable notation at a distance; mic quality varies | Quick practice, loop/tempo control, chord strip |
| Tablet (stand or music desk) | Closest to sheet-music size; multi-bar view; pedal support common among gigging users | Heavier; cost; fewer in homes | Primary practice screen for notation/tab |
| Desktop/laptop | Large screen; keyboard shortcuts; MIDI/USB easy; best for importing videos and editing transcriptions | Not near the instrument unless set up; fan noise into mic | Setup, review, editing, piano with MIDI |
| Phone as remote | Controls desktop/tablet session | Needs pairing | Optional later |

These are design inferences; no cited study. The decision is platform-dependent (undecided in the project), so keep the UI responsive with a "practice mode" layout that works on all three.

### Auto-pause, auto-rewind, and hands-free loop patterns
- **Loop once then wait.** Soundslice offers "Play loop only once" so a learner can replay without navigating back ([looping](https://www.soundslice.com/help/en/player/basic/4/looping/)).
- **Count-in between loop passes.** Guitar Pro can run a countdown between loops ([tempo and metronome](https://www.guitar-pro.com/docs/gp8/audio/playback/tempo-metronome)); Soundslice can play a count-in before each loop iteration ([metronome and count-in](https://www.soundslice.com/help/en/player/basic/8/metronome-and-count-in/)). This gives time to reposition without touching the screen.
- **Wait mode.** flowkey's Wait Mode pauses until the right notes are played, which makes it naturally hands-free for piano ([App Store listing](https://apps.apple.com/us/app/flowkey-learn-to-play-piano/id1020357408)).
- **Thinking time.** Experienced players pause before trials (Palese & Duke 2022); an optional rest beat between repeats supports this and doubles as time to adjust ([PDF](https://cml.music.utexas.edu/sites/default/files/documents/paleseduke2022.pdf)).
- **Recommended behaviours:**
  - **Auto-rewind on resume:** after a pause longer than 5 s, resume 1 bar earlier (number is a recommendation).
  - **Auto-pause on interruption:** pause on incoming call, app backgrounding, headphones disconnect, or when the mic hears a prolonged long silence in scoring mode (offer to resume with a count-in).
  - **Pass-end behaviour as a setting:** loop immediately / wait 2 beats / wait for pedal.
  - **Never auto-advance after a failed pass without the learner's say-so**; auto-advance only after a clean pass under auto speed trainer.

### Camera and microphone positioning
- **Mic.** Simply Piano's help reminds users not to cover the microphone with stickers, cases, or debris ([Simply Piano help](https://piano-help.hellosimply.com/en/articles/12647864-enable-microphone-access-for-simply-piano)). Android's audio guide warns not to assume speaker and microphone acoustics are good ([Android audio latency](https://developer.android.com/ndk/guides/audio/audio-latency)). Yousician's troubleshooting (search excerpt) suggests headphones to keep the backing track out of the mic.
- **Wireless audio.** Ubisoft discourages Bluetooth for Rocksmith+ because it is too slow for most players ([Ubisoft](https://www.ubisoft.com/en-us/game/rocksmith/plus/news-updates/0ObO0tPaR4kiGmmgpkeJZ/minimizing-audio-latency-on-console)). Warn when a Bluetooth output is selected during scored practice.
- **Camera (if used for fretboard/hand analysis, see `research/ml/video-and-audio-visual-analysis.md`).** No source opened on camera placement. Recommendation: a guided setup screen with an on-screen silhouette showing the fretboard/keyboard, a stable stand, and plenty of light; this is a prototype question, not a documented standard.
- **Placement hint UI:** show a small diagram ("phone 30-60 cm from the guitar's soundhole, screen facing you, backing in headphones") - values are rough recommendations to test.

## Implications for Splitune
- Treat **pedal and keyboard input as first-class** from day one; this is cheap on web (keyboard events) and a major differentiator for hands-busy users.
- Design a **practice-mode layout** separate from the library/browse layout: fewer, larger controls; large-type now-line; optional dark theme for low light.
- Add a **distance/size preset** and a one-bar view for far-away phones.
- Treat voice commands as optional and push-to-talk; do not plan accessibility around them.
- Warn about Bluetooth audio during scored practice and detect headphone presence if the platform allows.
- Pair with `accessibility.md` for target size, focus, and dragging alternatives, and with `practice-tool-patterns.md` for the loop/pass behaviours.

## Open questions
- Which exact keys do the target pedals send in each mode, today? Experiment: buy or borrow an AirTurn and a PageFlip pedal, log `keydown` codes on web, iOS, and Android in each mode.
- Does iOS Safari receive pedal key events reliably in a web app (focus, PWA mode)? Test.
- What is the best practice-mode font/size for far-away phones? Run a legibility test with real learners at 1 m and 2 m.
- Is there a rigorous reading-distance standard for notation? I found only forum-level citations of MOLA and Gould; ask a music librarian or engraver for the primary guidelines.
- Do voice commands work while an instrument plays? Measure recognition accuracy while strumming at normal volume on typical phones.
- Camera placement for fingering analysis depends on ML capabilities in `research/ml/video-and-audio-visual-analysis.md`.

## Sources
- [Apple Design Tips (hit targets)](https://developer.apple.com/design/tips/) — tier 2, accessed 2026-10-20
- [Google Accessibility Help: touch target size](https://support.google.com/accessibility/android/answer/7101858) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding SC 2.5.5 Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding SC 2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding SC 1.4.4 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) — tier 2, accessed 2026-10-20
- [AirTurn FAQ](https://www.airturn.com/blogs/support/faq) — tier 2, accessed 2026-10-20
- [AirTurn AirDirect FAQ](https://dev.airturn.com/sdk/docs/main/airdirect-faq.html) — tier 2, accessed 2026-10-20
- [AirTurn: Pedal hack, macro assistance for documents](https://www.airturn.com/blogs/solutions/pedal-hack-macro-assistance-for-documents) — tier 2, accessed 2026-10-20
- [OnSong: PageFlip Firefly](https://onsongapp.com/docs/features/foot-pedals/supported/pageflip/firefly) — tier 2, accessed 2026-10-20
- [MDN: SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) — tier 2, accessed 2026-10-20
- [Musica Sacra forum: typesetting question on score size](https://forum.musicasacra.com/forum/discussion/comment/179594) — tier 4, accessed 2026-10-20
- [Bell et al. 2005, digital music stand](https://researchcommons.waikato.ac.nz/entities/publication/921242c4-41c4-4cbc-a130-989da1517138) — tier 1, accessed 2026-10-20
- [MuseScore: Modified Stave Notation](https://musescore.org/en/tutorials/modified-stave-notation) — tier 2, accessed 2026-10-20
- [Soundslice: Looping](https://www.soundslice.com/help/en/player/basic/4/looping/) — tier 2, accessed 2026-10-20
- [Soundslice: Metronome and count-in](https://www.soundslice.com/help/en/player/basic/8/metronome-and-count-in/) — tier 2, accessed 2026-10-20
- [Guitar Pro 8: Tempo and metronome](https://www.guitar-pro.com/docs/gp8/audio/playback/tempo-metronome) — tier 2, accessed 2026-10-20
- [flowkey on the App Store](https://apps.apple.com/us/app/flowkey-learn-to-play-piano/id1020357408) — tier 2, accessed 2026-10-20
- [Palese & Duke 2022](https://cml.music.utexas.edu/sites/default/files/documents/paleseduke2022.pdf) — tier 1, accessed 2026-10-20
- [Simply Piano help: enable microphone access](https://piano-help.hellosimply.com/en/articles/12647864-enable-microphone-access-for-simply-piano) — tier 2, accessed 2026-10-20
- [Android NDK: Audio latency](https://developer.android.com/ndk/guides/audio/audio-latency) — tier 2, accessed 2026-10-20
- [Ubisoft: Minimizing audio latency on console (Rocksmith+)](https://www.ubisoft.com/en-us/game/rocksmith/plus/news-updates/0ObO0tPaR4kiGmmgpkeJZ/minimizing-audio-latency-on-console) — tier 2, accessed 2026-10-20
