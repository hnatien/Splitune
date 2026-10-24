---
title: Competitor feature matrix
workstream: market
last_researched: 2026-10-20
confidence: medium
---

# Competitor feature matrix

## TL;DR
- 22 products compared on 16 capabilities. Almost every cell is derived from official store listings, vendor pages or help pages opened on 2026-10-20; unverified cells are marked ❓ rather than guessed.
- No product combines (a) YouTube/link import, (b) instrument-specific notes or tab from that performance, (c) a practice toolset, and (d) a curriculum. Songsterr and Klangio cover (a)+(b); Moises and Chord ai cover (a or file)+stems+chords; Yousician, Simply, Fender Play, flowkey, Skoove, Melodics, Rocksmith+ and Musora cover (c)+(d) on curated catalogs only.
- Practice-tool basics (slow-down without pitch change, loop, metronome/count-in) are offered by most products that expose a player (the exceptions are pure separators such as LALAL.AI and catalog tools such as Chordify without Premium).
- Real-time listen-and-score is found only in the structured-learning apps (and in Chord ai/Chordify as live chord detection, not scoring).
- Offline use and exact price tiers are the least documented dimensions.

## Findings

### Legend
- ✅ documented as supported in a source we opened.
- ⚠️ partial, limited, plan-gated in a way that matters, or an approximation (see Notes).
- ❌ not found in the sources we opened (absence of evidence, not proof of absence; where a vendor states it, the note says so).
- ❓ not verified (source blocked or silent).
- Price tier (per month equivalent of the cheapest paid option at US list prices, accessed 2026-10-20): Free; $ under $5; $$ $5-$15; $$$ over $15; 1x one-time purchase. Detailed prices are in `pricing-and-business-models.md`.
- Column "Licensed catalog": the vendor ships a catalog of songs it has licensed or created content for, as opposed to user-supplied audio only.

### Matrix

| App | Stem sep. | Stems (types) | Chord detect. | Tab / notation transcription | YouTube link import | Local file import | Licensed catalog | Slow / pitch | A-B loop | Metronome / count-in | Listen & score | Curriculum | Instruments | Platforms | Offline | Price tier | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Moises** | ✅ | vocals, drums, bass, guitar, piano, strings, other; guitar/vocal sub-stems on Premium | ✅ | ⚠️ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | any (audio) | web, desktop, iOS/iPadOS, Android | ❓ | Free; $ (annual); $$$ (Pro monthly) | Features per [App Store](https://apps.apple.com/us/app/id1515796612); "synced guitar tabs" unverified beyond chords. YouTube/streaming reported unsupported in a help article we could not open ([help](https://help.moises.ai/hc/en-us/articles/360020130539-My-URL-isn-t-working-Why)); homepage silent ([moises.ai](https://moises.ai/)). |
| **LALAL.AI** | ✅ | 10 types (vocal/instr., drums, bass, e-guitar, ac-guitar, piano, synth, voice/noise, strings, winds), 2 stems per run | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | any | web, desktop (Win/Mac/Linux), iOS, Android, VST | ⚠️ VST runs locally | Free; $$ (annual) | [LALAL.AI](https://www.lalal.ai/); upload only, no link import mentioned. |
| **RipX DAW** | ✅ | 6+ (types unlisted) | ✅ | ⚠️ | ❌ | ✅ | ❌ | ✅ | ❓ | ❓ | ❌ | ❌ | any; guitar chord/capo views | Windows, macOS | ✅ | 1x $99 / $198 | Notes shown on piano roll, MIDI export per layer; no tab ([RipX](https://hitnmix.com/2024/01/05/ripx-deepremix-for-musicians/)). Online activation check every 15 runs ([buy page](https://hitnmix.com/buy-ripx-wp/)). |
| **Capo** | ⚠️ | iOS listing says it isolates instruments or vocals; product page does not mention it | ✅ | ⚠️ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | diagrams for guitar, bass, ukulele, banjo, mandolin, piano | macOS, iOS | ✅ | Free; $ | 168 chords, on-device; Mac spectrogram "Tabbing" view and MIDI export; own files only ([Capo](https://supermegaultragroovy.com/products/capo/), [iOS](https://apps.apple.com/us/app/capo-learn-music-by-ear/id887497388)). |
| **Anytune Pro+** | ⚠️ | "ReFrame" isolation for soloing/muting (method undisclosed) | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | any | iOS/iPadOS, visionOS, watchOS | ✅ | 1x $14.99 | 0.05x speed, +/-24 semitones, Step-it-Up trainer; no DRM tracks ([App Store](https://apps.apple.com/us/app/anytune-pro-studio-tools/id478293637)). |
| **Transcribe!** | ❌ | EQ and mono/karaoke mix only | ⚠️ | ⚠️ | ❌ | ✅ | ❌ | ✅ | ✅ | ❓ | ❌ | ❌ | any | Windows, Mac, Linux | ✅ | 1x $39 | "Guessing" of notes/chords from spectrum, assists the human ([overview](https://www.seventhstring.com/xscribe/overview.html), [buy](https://www.seventhstring.com/xscribe/buy.html)). |
| **Chordify** | ❌ | none | ✅ | ❌ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ❓ | ⚠️ | ❌ | guitar, piano, ukulele | iOS (web library sync; Android ❓) | ❓ | Free (capped); $-$$ | YouTube integration, 36M-title search; slow/loop/capo are Premium; Toolkit "Live Chord Detection" and chord practice ([App Store](https://apps.apple.com/us/app/id1073624757), [Techleap](https://techleap.nl/blog/chordify-striking-the-right-note-in-music-education-and-ai-innovation)). Publisher partnerships claimed. |
| **Songsterr** | ⚠️ | solo/mute of notated tracks (not audio separation) | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ❓ | ❌ | ❌ | guitar, bass, drums; AI adds vocals, piano/keys, strings, winds | web, iOS, Android | ⚠️ | $ (web $2.99) to $$ (App Store $9.99) | UGC library (~400K songs) plus AI tab from YouTube link or audio, 50 tabs/mo cap, 20-s free preview; slow/loop are Plus ([help](https://www.songsterr.com/help), [Plus](https://www.songsterr.com/plus), [About](https://www.songsterr.com/about)). YouTube audio not offline in apps. |
| **Ultimate Guitar** | ❌ | none | ✅ | ✅ | ❌ | ❌ | ✅ | ❓ | ❓ | ✅ | ❌ | ⚠️ | guitar, bass, ukulele | iOS/iPadOS, visionOS (Android, web ❓) | ✅ | Free; $-$$ | UGC tabs plus Official interactive tabs, Simplify, metronome (Pro), UG Courses, offline access listed ([App Store](https://apps.apple.com/us/app/ultimate-guitar-chords-tabs/id357828853)). |
| **Guitar Pro** | ❌ | none | ⚠️ | ✅ | ❌ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ❌ | ❌ | guitar-centric; bass, drums, piano views | Windows, macOS; iOS player | ✅ | 1x $69.95 (iOS $6.99) | Editor/player; audio sync with score; mySongBook paid scores ([product](https://www.guitar-pro.com/products/7-buy-guitar-pro), [iOS](https://apps.apple.com/us/app/guitar-pro/id400666114)). |
| **Soundslice** | ✅ | 4 (vocals, drums, bass, other), MP3 only | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ❓ | ❌ | ⚠️ | any | web (any browser) | ❓ | Free; $ | Manual notation synced to YouTube (free) or MP3 (Plus); ML scanning of sheet music; no audio-to-notation found; auto stems Nov 2025 ([plans](https://www.soundslice.com/plans/), [stems post](https://www.soundslice.com/blog/298/automatic-multitrack-stem-generation/), [blog](https://www.soundslice.com/blog/)). |
| **Klangio** | ❌ | none (instrument-specific models) | ✅ | ✅ | ✅ | ✅ | ❌ | ❓ | ❓ | ❓ | ⚠️ | ❌ | piano, guitar, drums, voice, violin, winds | web, iOS, Android, DAW plugin | ❌ | Free demo; $$-$$$ | Piano2Notes needs internet; free demo ~20 s; 50/250 tickets per month ([klang.io](https://www.klang.io/), [subscriptions](https://klang.io/help/klangio-subscriptions/), [App Store](https://apps.apple.com/us/app/piano2notes/id1589420929)). Live-recording transcription counted as ⚠️ listen. |
| **Chord ai** | ✅ | 4 (bass, drums, vocals, other) | ✅ | ⚠️ | ✅ | ✅ | ❌ | ✅ | ✅ | ❓ | ⚠️ | ❌ | piano, guitar, ukulele, bass, mandolin, banjo | iOS/iPadOS, macOS (Android ❓) | ❓ | Free; $$ | Audio-to-MIDI "Midify", PDF export, on-device lyrics; mic real-time chords ([App Store](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109)). |
| **Yousician** | ❌ | none | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ❓ | ✅ | ✅ | guitar, bass, piano, ukulele, singing | iOS, Android, PC | ❓ | $$-$$$ | Real-time accuracy/timing feedback; 2,000+ songs claimed ([site](https://yousician.com/), [App Store](https://apps.apple.com/us/app/yousician-learn-play-guitar/id959883039)); loop/tempo from reviewer comments on Trustpilot. |
| **Simply Piano / Guitar** | ❌ | none | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❓ | ❓ | ✅ | ✅ | piano; guitar (separate app) | iOS, Android, Chromebook | ❓ | $$-$$$ | Mic listening; piano songs can be slowed ([Piano](https://apps.apple.com/us/app/simply-piano-learn-piano-fast/id1019442026), [Guitar](https://apps.apple.com/us/app/simply-guitar-learn-guitar/id1476695335)). |
| **Fender Play** | ⚠️ | produced "backing and isolated tracks" per song, not user separation | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | guitar, bass, ukulele | iOS/iPadOS, macOS (Apple silicon), visionOS (Android ❓) | ❓ | $-$$ | MatchMySound listening, scrolling tab, chord drills ([App Store](https://apps.apple.com/us/app/fender-play-learn-guitar/id1226057939)). |
| **flowkey** | ❌ | none | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ❓ | ✅ | ✅ | piano | iOS, Android | ❓ | $$-$$$ | Wait Mode, hand separation, mic/MIDI ([App Store](https://apps.apple.com/us/app/flowkey-learn-to-play-piano/id1020357408)). |
| **Skoove** | ❌ | none | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ❓ | ✅ | ✅ | piano | iOS (Android ❓) | ❓ | $$-$$$ (prices unclear) | AI feedback, mic or MIDI ([App Store](https://apps.apple.com/us/app/skoove-learn-to-play-piano/id1160668178)). |
| **Melodics** | ❌ | none | ❌ | ⚠️ | ❌ | ❌ | ✅ | ✅ | ✅ | ❓ | ✅ | ✅ | drums (keys/pads on other platforms, unverified) | iPhone | ❓ | $$$ | Mic or e-kit per-hit feedback ([App Store](https://apps.apple.com/us/app/melodics-drum-lessons-app/id6504540940)). |
| **Rocksmith+** | ❌ | none | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ❓ | ✅ | ✅ | guitar, bass, piano | PC, PlayStation, iOS, Android | ❓ | $-$$ | Adaptive difficulty, Riff Repeater, UGC arrangements of licensed songs ([Steam](https://store.steampowered.com/app/2834910/Rocksmith/), [Ubisoft](https://www.ubisoft.com/en-us/game/rocksmith)). |
| **Musora (Drumeo, Pianote...)** | ⚠️ | "instrument removal from the mix" on transcribed songs | ✅ | ✅ | ❌ | ❌ | ⚠️ | ✅ | ✅ | ❓ | ❌ | ✅ | drums, piano, guitar, bass, singing | iOS, macOS (Apple silicon), visionOS, web | ✅ | $$$ | Human-transcribed songs, offline downloads ([App Store](https://apps.apple.com/us/app/musora-the-music-lessons-app/id1460388277), [Drumeo](https://www.drumeo.com/choose-plan)). |
| **JustinGuitar app** | ❌ | none | ✅ | ⚠️ | ❌ | ❌ | ✅ | ✅ | ❓ | ❓ | ❓ | ✅ | guitar (Grades 1-3) | iOS/iPadOS, macOS (Apple silicon), visionOS | ❓ | $-$$ | 1,500+ songs with adjustable tempo and chord prompts ([App Store](https://apps.apple.com/us/app/justin-guitar-lessons-songs/id1176125504)). |

### Reading the matrix: what clusters
1. Utilities (Moises, LALAL.AI, RipX, Capo, Anytune, Transcribe!): audio in, stems/slow-down/chords out, no teaching, mostly local files.
2. Catalog and tab tools (Chordify, Songsterr, Ultimate Guitar, Guitar Pro, Soundslice): music notation as the product; only Chordify and Songsterr accept YouTube links, and only Songsterr (plus Klangio and Chord ai in the long tail) generates notation from a link.
3. AI transcription specialists (Klangio, Songsterr AI, Chord ai): link or file to chords/notes, no learning layer.
4. Structured learning (Yousician, Simply, Fender Play, flowkey, Skoove, Melodics, Rocksmith+, Musora, JustinGuitar): curricula and feedback on a curated catalog; none imports a user-chosen performance.

## Implications for Splitune
- The empty cell cluster is "YouTube link import" crossed with "curriculum" and "listen-and-score": no learning app imports user-chosen songs. For Splitune, "link import" means a YouTube embed as visual reference plus user-supplied audio (own file or recording), never a stream download; competitor cells describe what those products do.
- Table-stakes to match: slow-down, loop, count-in, key change. Moises and Capo set the bar for UX polish; Anytune for audio quality at slow speeds.
- Offline and local processing (Capo, RipX, Anytune, Transcribe!) is a rare differentiator among newer AI tools, which are server-based (Klangio explicitly needs internet).
- See `competitor-landscape.md` for the differentiation analysis.

## Open questions
- ❓ cells (metronome/count-in in many apps, offline status, Android availability) need hands-on verification or fresh store pages.
- Quality (accuracy) is not in this matrix; capability does not equal quality. See `research/ml/transcription-guitar-and-bass-tabs.md` and `research/ml/source-separation-model-comparison.md`.

## Sources
- [Moises (US App Store)](https://apps.apple.com/us/app/id1515796612) — tier 2, accessed 2026-10-20
- [Moises homepage](https://moises.ai/) — tier 2, accessed 2026-10-20
- [Moises help: My URL isn't working (not opened; search snippet only)](https://help.moises.ai/hc/en-us/articles/360020130539-My-URL-isn-t-working-Why) — tier 2, accessed 2026-10-20
- [LALAL.AI homepage](https://www.lalal.ai/) — tier 2, accessed 2026-10-20
- [RipX DAW for Musicians](https://hitnmix.com/2024/01/05/ripx-deepremix-for-musicians/) — tier 2, accessed 2026-10-20
- [Buy RipX DAW & RipX DAW PRO](https://hitnmix.com/buy-ripx-wp/) — tier 2, accessed 2026-10-20
- [Capo product page](https://supermegaultragroovy.com/products/capo/) — tier 2, accessed 2026-10-20
- [Capo - Learn Music by Ear (iOS App Store)](https://apps.apple.com/us/app/capo-learn-music-by-ear/id887497388) — tier 2, accessed 2026-10-20
- [Anytune Pro+: Studio Tools (App Store)](https://apps.apple.com/us/app/anytune-pro-studio-tools/id478293637) — tier 2, accessed 2026-10-20
- [Transcribe! overview](https://www.seventhstring.com/xscribe/overview.html) — tier 2, accessed 2026-10-20
- [Buy Transcribe!](https://www.seventhstring.com/xscribe/buy.html) — tier 2, accessed 2026-10-20
- [Chordify: Songs, Chords, Tuner (App Store)](https://apps.apple.com/us/app/id1073624757) — tier 2, accessed 2026-10-20
- [Techleap: Chordify, striking the right note](https://techleap.nl/blog/chordify-striking-the-right-note-in-music-education-and-ai-innovation) — tier 3, accessed 2026-10-20
- [Songsterr help / questions](https://www.songsterr.com/help) — tier 2, accessed 2026-10-20
- [Songsterr Plus](https://www.songsterr.com/plus) — tier 2, accessed 2026-10-20
- [Songsterr About](https://www.songsterr.com/about) — tier 2, accessed 2026-10-20
- [Ultimate Guitar: Chords & Tabs (US App Store)](https://apps.apple.com/us/app/ultimate-guitar-chords-tabs/id357828853) — tier 2, accessed 2026-10-20
- [Buy Guitar Pro 8](https://www.guitar-pro.com/products/7-buy-guitar-pro) — tier 2, accessed 2026-10-20
- [Guitar Pro (iOS App Store)](https://apps.apple.com/us/app/guitar-pro/id400666114) — tier 2, accessed 2026-10-20
- [Soundslice plans](https://www.soundslice.com/plans/) — tier 2, accessed 2026-10-20
- [Soundslice blog index](https://www.soundslice.com/blog/) — tier 2, accessed 2026-10-20
- [Automatic multitrack stem generation (Soundslice blog)](https://www.soundslice.com/blog/298/automatic-multitrack-stem-generation/) — tier 2, accessed 2026-10-20
- [Klangio homepage](https://www.klang.io/) — tier 2, accessed 2026-10-20
- [What are Klangio Subscriptions?](https://klang.io/help/klangio-subscriptions/) — tier 2, accessed 2026-10-20
- [Piano2Notes (US App Store)](https://apps.apple.com/us/app/piano2notes/id1589420929) — tier 2, accessed 2026-10-20
- [Chord ai - Play any song! (US App Store)](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109) — tier 2, accessed 2026-10-20
- [Yousician homepage](https://yousician.com/) — tier 2, accessed 2026-10-20
- [Yousician: Learn & Play Guitar (US App Store)](https://apps.apple.com/us/app/yousician-learn-play-guitar/id959883039) — tier 2, accessed 2026-10-20
- [Simply Piano: Learn Piano Fast (US App Store)](https://apps.apple.com/us/app/simply-piano-learn-piano-fast/id1019442026) — tier 2, accessed 2026-10-20
- [Simply Guitar (US App Store)](https://apps.apple.com/us/app/simply-guitar-learn-guitar/id1476695335) — tier 2, accessed 2026-10-20
- [Fender Play: Learn Guitar (US App Store)](https://apps.apple.com/us/app/fender-play-learn-guitar/id1226057939) — tier 2, accessed 2026-10-20
- [flowkey - Learn to Play Piano (US App Store)](https://apps.apple.com/us/app/flowkey-learn-to-play-piano/id1020357408) — tier 2, accessed 2026-10-20
- [Skoove: Learn to Play Piano (US App Store)](https://apps.apple.com/us/app/skoove-learn-to-play-piano/id1160668178) — tier 2, accessed 2026-10-20
- [Melodics: Drum Lessons App (US App Store)](https://apps.apple.com/us/app/melodics-drum-lessons-app/id6504540940) — tier 2, accessed 2026-10-20
- [Rocksmith+ on Steam](https://store.steampowered.com/app/2834910/Rocksmith/) — tier 2, accessed 2026-10-20
- [Rocksmith (Ubisoft US)](https://www.ubisoft.com/en-us/game/rocksmith) — tier 2, accessed 2026-10-20
- [Musora: The Music Lessons App (US App Store)](https://apps.apple.com/us/app/musora-the-music-lessons-app/id1460388277) — tier 2, accessed 2026-10-20
- [Drumeo choose a plan](https://www.drumeo.com/choose-plan) — tier 2, accessed 2026-10-20
- [Justin Guitar Lessons & Songs (US App Store)](https://apps.apple.com/us/app/justin-guitar-lessons-songs/id1176125504) — tier 2, accessed 2026-10-20
