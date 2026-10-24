---
title: "Competitor teardown: flowkey"
workstream: market
last_researched: 2026-10-20
confidence: medium
---

# Competitor teardown: flowkey

## TL;DR
- flowkey (seller: flowkey GmbH) is a piano-learning app built around video of a real pianist with synchronized sheet music, Wait Mode (pauses until you play the right notes), hand separation, loop, speed control and microphone/MIDI note detection.
- Tiered subscriptions: Classic (classical and non-copyrighted songs), Premium (full library), Family (up to 5). Seven-day free trial on yearly. US App Store lists many unlabeled prices ($19.99-$179.99).
- 4.7/5 from 66K iOS ratings; the dominant complaint across years is microphone note detection; developer recommends MIDI.
- Splitune takeaway: the Classic vs Premium split shows how licensing costs shape tiers (public-domain content is cheap; copyrighted pop costs more).

## Findings

### Core features
Songs and courses written by professional pianists across classical, pop, film and TV at four difficulty levels; loop; select a hand; Wait Mode; video of the pianist with upcoming notes highlighted; Just Play mode; full sheet music view; note detection by device microphone or MIDI/Bluetooth ([App Store](https://apps.apple.com/us/app/flowkey-learn-to-play-piano/id1020357408)). The website adds slow motion and separate hand practice ([flowkey.com](https://www.flowkey.com/en)).

### UX flow of the "learn a song" path
Pick a song at your level → watch pianist video with synced sheet → practice hands separately/slowed in Wait Mode → play full tempo in Just Play. Songs are curated, not user imported.

### Instruments and levels
Piano (acoustic, digital, keyboards); four difficulty levels ([App Store](https://apps.apple.com/us/app/flowkey-learn-to-play-piano/id1020357408)).

### Pricing and business model (accessed 2026-10-20)
App Store IAPs (US, labels ambiguous): flowkey Classic $19.99, $38.99, $119.99 (x3); flowkey Premium $24.99, $29.99, $139.99, $149.99, $179.99; Yearly plan includes a 7-day trial; limited lessons and classical songs free ([App Store](https://apps.apple.com/us/app/flowkey-learn-to-play-piano/id1020357408)). The website did not list prices ([flowkey.com](https://www.flowkey.com/en)).

### Platforms (official)
iOS/iPadOS 15.6+, Apple Vision ([App Store](https://apps.apple.com/us/app/flowkey-learn-to-play-piano/id1020357408)); site links App Store and Google Play badges ([flowkey.com](https://www.flowkey.com/en)).

### What is public about tech and company
Seller flowkey GmbH; no public engineering detail found. Developer replies say the app is "not meant to replace a teacher" and that drills and adaptive behavior are in progress ([reviews](https://apps.apple.com/us/app/flowkey-learn-to-play-piano/id1020357408?see-all=reviews&platform=iphone)).

### Standout strengths
Video-plus-notation UX; Wait Mode; hand separation; plan structure by licensing class.

### Common complaints (tier 4, anecdotal)
Microphone detection misses notes and chords (most frequent, 2017-2025 samples); adaptive tempo "over punishes" mistakes; wait mode halts on errors; limited drills; free trial and cost; interface taps ([reviews](https://apps.apple.com/us/app/flowkey-learn-to-play-piano/id1020357408?see-all=reviews&platform=iphone)).

### What Splitune can learn or do differently
- Offer MIDI/Bluetooth input as the accurate path and mic as convenience (`research/ux/hands-busy-and-device-context.md`).
- Wait mode and "just play" mode are complementary practice patterns; see `research/ux/practice-tool-patterns.md`.

## Implications for Splitune
Piano is a crowded curriculum market (flowkey, Skoove, Simply, Playground, Pianote); Splitune's piano angle must be user-chosen songs and transcription (`research/ml/transcription-piano.md`).

## Open questions
- Official prices and subscription mix; Android listing details.

## Sources
- [flowkey - Learn to Play Piano (US App Store)](https://apps.apple.com/us/app/flowkey-learn-to-play-piano/id1020357408) — tier 2, accessed 2026-10-20
- [flowkey App Store reviews](https://apps.apple.com/us/app/flowkey-learn-to-play-piano/id1020357408?see-all=reviews&platform=iphone) — tier 4, accessed 2026-10-20
- [flowkey homepage](https://www.flowkey.com/en) — tier 2, accessed 2026-10-20
