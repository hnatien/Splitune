---
title: "Competitor teardown: Guitar Pro (Arobas Music)"
workstream: market
last_researched: 2026-10-20
confidence: medium
---

# Competitor teardown: Guitar Pro (Arobas Music)

## TL;DR
- Guitar Pro is the de facto tab/notation editor and player: desktop Guitar Pro 8 at $69.95 (Windows/macOS) and a $6.99 iOS player/NotePad app; the file format (.gp3-.gp8) is the interchange standard other tools export to (Songsterr, Soundslice, Klangio).
- It supports syncing an audio file with a score for transcription or play-along, a looper, metronome, chord/scale libraries, and fretboard views. It does not analyze audio.
- Revenue is mostly one-time licenses plus mySongBook (paid scores, 12-month subscription $40.00).
- Trustpilot 4.4/5 (426 reviews) is positive; iOS app is 3.6/5 (901 ratings) with complaints about missing desktop features and Songbook sync.
- Splitune takeaway: Guitar Pro file export is a must for interoperability; Guitar Pro itself is an authoring tool, not a learning path.

## Findings

### Core features
Audio import synchronized with a score; looper; metronome; chord and scale libraries; guitar and piano fretboard views; note entry via keypad, mouse or MIDI; thousands of free GP tabs available online; Guitar Pro tracks can serve as accompaniment ([Guitar Pro 8 product page](https://www.guitar-pro.com/products/7-buy-guitar-pro)).

### UX flow of the "learn a song" path
Open or download a .gp file → play with built-in sounds → loop and slow → optionally import the original recording and align it to the score. Learners rely on other people's tabs.

### Instruments and levels
Guitar-centric but multi-instrument (bass, drums, piano views). No levels.

### Pricing and business model (accessed 2026-10-20)
- Guitar Pro 8: $69.95; mySongBook 12-month subscription $40.00 ([product page](https://www.guitar-pro.com/products/7-buy-guitar-pro)). The page does not state the license type; a search-result summary described a lifetime license for up to 5 computers, unverified.
- iOS app: $6.99, no IAPs listed ([App Store](https://apps.apple.com/us/app/guitar-pro/id400666114)).

### Platforms (official)
Windows 8/10/11 and macOS 10.13+ desktop (64-bit; 4 GB RAM; 2 GB disk) ([product page](https://www.guitar-pro.com/products/7-buy-guitar-pro)); iOS/iPadOS 15+ and Apple Vision for the mobile app ([App Store](https://apps.apple.com/us/app/guitar-pro/id400666114)). The mobile app cannot edit existing notation or create standard notation and cannot edit drum tracks ([App Store](https://apps.apple.com/us/app/guitar-pro/id400666114)).

### What is public about tech and company
Developer Arobas Music. No ML claims; audio sync is manual. The page stresses ASIO/Core Audio cards for guitar input latency ([product page](https://www.guitar-pro.com/products/7-buy-guitar-pro)).

### Standout strengths
Ubiquitous format; strong sound engine praised by users; mature editor; value for money.

### Common complaints (tier 4, anecdotal)
- Trustpilot: want more than one audio track and automatic tempo detection; drum tool hard; mobile license is separate ([Trustpilot](https://www.trustpilot.com/review/www.guitar-pro.com)).
- iOS reviews: missing desktop features, weak editing, Songbook purchases not syncing, file loading errors, no dark mode, dated sound ([App Store reviews](https://apps.apple.com/us/app/guitar-pro/id400666114?see-all=reviews&platform=iphone)).

### What Splitune can learn or do differently
- Export to .gp and MusicXML; see `research/ml/transcription-guitar-and-bass-tabs.md`.
- Users explicitly request automatic tempo detection and multi-audio-track sync: validated needs.
- Mobile players should be first-class and not an afterthought.

## Implications for Splitune
Do not build a full editor; build import/export and a lightweight correction UI. Guitar Pro is a complement and a target format.

## Open questions
- Whether Arobas plans AI transcription (nothing public found).
- Current GP upgrade pricing (only a search summary: $34.95, unverified).

## Sources
- [Buy Guitar Pro 8](https://www.guitar-pro.com/products/7-buy-guitar-pro) — tier 2, accessed 2026-10-20
- [Guitar Pro (iOS App Store)](https://apps.apple.com/us/app/guitar-pro/id400666114) — tier 2, accessed 2026-10-20
- [Guitar Pro App Store reviews](https://apps.apple.com/us/app/guitar-pro/id400666114?see-all=reviews&platform=iphone) — tier 4, accessed 2026-10-20
- [Guitar Pro on Trustpilot](https://www.trustpilot.com/review/www.guitar-pro.com) — tier 4, accessed 2026-10-20
