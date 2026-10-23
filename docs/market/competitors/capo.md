---
title: "Competitor teardown: Capo (SuperMegaUltraGroovy)"
workstream: market
last_researched: 2026-10-20
confidence: medium
---

# Competitor teardown: Capo (SuperMegaUltraGroovy)

## TL;DR
- Capo is a long-lived Mac/iOS "learn by ear" app: on-device chord, beat and key detection for audio files you own, with slow-down, looping, chord diagrams for many instruments, and (Mac) a spectrogram "Tabbing" view and MIDI export.
- Everything runs locally: no upload, offline, no tracking of songs; no streaming-service support and no YouTube import.
- Free Edition has full detection/slowing/looping but cannot save edits or export. Paid: Mac Pro $39.99/yr, iOS Pro $19.99/yr, Platinum (Mac+iOS) $49.99/yr.
- Reviews (anecdotal) praise clean slowdown; the recurring complaint over years is chord accuracy and the move to subscription.
- Splitune takeaway: local on-device analysis is a credible, privacy-friendly, zero-marginal-cost model, and chords alone (about "90% of the way" by the developer's own claim) are not enough.

## Findings

### Core features
- Chord detection across 168 chords (12 roots x 14 qualities) plus inversions, editable; beat and key analysis; slowing and looping; diagrams for guitar, bass, ukulele, banjo, mandolin (various tunings, left-handed, virtual capo) and piano; Mac-only Tabbing view, MIDI export and lead-sheet PDF; iCloud project sync ([Capo product page](https://supermegaultragroovy.com/products/capo/)).
- Stem separation: the product page does not mention it, but the iOS App Store listing says the app "isolates instruments or vocals" ([iOS listing](https://apps.apple.com/us/app/capo-learn-music-by-ear/id887497388)). Treat as unclear and unverified; the two official descriptions disagree.
- Recent iOS releases added a Call & Response practice mode (alternating playback and silence), count-in options and click mute ([iOS listing](https://apps.apple.com/us/app/capo-learn-music-by-ear/id887497388)).

### UX flow of the "learn a song" path
Pick a track from the local library (MP3, WAV, AIFF, M4A, FLAC, DRM-free iTunes purchases) → on-device analysis → chord timeline with diagrams → slow down, loop a region, edit chords, transpose → optional export. Spotify and Apple Music tracks are not supported because they are not files on the device ([Capo product page](https://supermegaultragroovy.com/products/capo/)).

### Instruments and levels
Chord diagrams for multiple fretted instruments and piano; no curriculum or levels.

### Pricing and business model (accessed 2026-10-20, [pricing page](https://supermegaultragroovy.com/products/capo/pricing/))
- Free Edition: Mac and iOS, full detection and slowing/looping, but limited project saving; no audio export; no MIDI/lead sheet on Mac.
- Mac: Pro $39.99/yr; Platinum $49.99/yr (Mac+iPhone+iPad); retail "Capo Pro 4" one-time $99 (Mac only, optional paid major upgrades).
- iOS: Pro $19.99/yr; Platinum $49.99/yr. Longtime owners get a discount; Family Sharing supported.
- The iOS App Store listing shows additional legacy IAP entries (monthly $4.99, $2.49, upgrade $9.99, Platinum upgrade $39.99) ([iOS listing](https://apps.apple.com/us/app/capo-learn-music-by-ear/id887497388)).

### Platforms (official)
macOS and iOS/iPadOS only; "no plans for Windows or Android"; iOS requires iOS 17.6+ ([product page](https://supermegaultragroovy.com/products/capo/), [iOS listing](https://apps.apple.com/us/app/capo-learn-music-by-ear/id887497388)). Works offline.

### What is public about tech and company
A neural network trained on a large song library does chord recognition, fully on-device; the developer states it "gets you about 90% of the way there" and says accuracy drops with out-of-tune recordings, fast changes or sparse harmony ([product page](https://supermegaultragroovy.com/products/capo/)). Self-reported; no benchmark given.

### Standout strengths
Privacy and offline use; mature playback engine; simple pricing; diagrams for many instruments; indie developer responsiveness (reviewers cite helpful support).

### Common complaints (tier 4, anecdotal)
From App Store reviews (dated 2014-2020 in the sample): chord detection often wrong on complex recordings; annual subscription "beyond my means" for one reviewer; capo option reported missing; some praise for "cleanest" slow-down ([iOS reviews](https://apps.apple.com/us/app/capo-learn-music-by-ear/id887497388?see-all=reviews&platform=iphone)). The sample is old; current state may differ.

### What Splitune can learn or do differently
- On-device inference makes marginal cost near zero and removes upload/legal exposure; see `ml/deployment-and-inference.md`.
- Show detection confidence and make chord editing easy, because accuracy complaints dominate.
- Own-files-only is a deliberate design that avoids licensing issues but also blocks the main use case (learn the song I just saw). See `legal/youtube-copyright-and-platform-policy.md`.

## Implications for Splitune
A local-first mode is viable and has a 10+ year market precedent. Pair it with note/tab output and lessons to go beyond Capo's chord-only model.

## Open questions
- Whether current iOS builds include instrument isolation, and how good it is.
- Current rating on the Mac App Store (not captured).

## Sources
- [Capo product page](https://supermegaultragroovy.com/products/capo/) — tier 2, accessed 2026-10-20
- [Capo pricing page](https://supermegaultragroovy.com/products/capo/pricing/) — tier 2, accessed 2026-10-20
- [Capo - Learn Music by Ear (iOS App Store)](https://apps.apple.com/us/app/capo-learn-music-by-ear/id887497388) — tier 2, accessed 2026-10-20
- [Capo iOS App Store reviews](https://apps.apple.com/us/app/capo-learn-music-by-ear/id887497388?see-all=reviews&platform=iphone) — tier 4, accessed 2026-10-20
