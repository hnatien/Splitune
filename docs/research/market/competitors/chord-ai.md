---
title: "Competitor teardown: Chord ai"
workstream: market
last_researched: 2026-10-20
confidence: medium
---

# Competitor teardown: Chord ai

## TL;DR
- Chord ai (Nomad AI OU) is a mobile-first "chords for any song" app that works from YouTube, SoundCloud, local audio files or the microphone, with beat tracking, 4-stem separation (bass, drums, vocals, other), "Midify" audio-to-MIDI, lyrics recognition (on-device), pitch/speed/loop controls and PDF export.
- It bundles in one small app what Splitune's pipeline would do in stages (chords + stems + MIDI) but with no tab output and no teaching layer.
- Free for core features; Pro $10.99/mo or $69.99/yr (US App Store), with higher "family sharing" prices.
- 4.6/5 from 5.9K ratings; reviewers like the free core, but report accuracy problems on minor chords and 3/4 and 6/8 beat tracking, plus update bugs.
- Splitune takeaway: demonstrates that YouTube + stems + chords + MIDI in one phone app is feasible; the opportunity is turning this into instrument-specific lessons.

## Findings

### Core features
Browse YouTube, SoundCloud or audio files, or use the mic for real-time chords; chord recognition (major, minor, aug, dim, 7th, M7, sus2/4; Pro adds half-dim, dim7, 6/9/11/13); slash chords; voicing/position recognition (Pro); on-device lyrics recognition (~100 languages); beat tracking in bars/beats; stem separation into bass, drums, vocals, other; "Midify" audio to MIDI export; speed/pitch/loop; save and share, export PDF; chord library of 100k+ guitar and 10k+ ukulele positions; smart capo (Pro) ([App Store](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109)).

### UX flow of the "learn a song" path
Pick a source (YouTube/SoundCloud/file/mic) → analysis → chords on a beat grid → loop/slow/transpose → optionally separate stems or export MIDI/PDF. Spotify is handled by sharing to the app, which searches for a matching YouTube video; the app does not access Spotify audio (per a search-result summary of the FAQ, not opened).

### Instruments and levels
Piano, guitar, ukulele, bass, mandolin, banjo ([App Store](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109)). No levels.

### Pricing and business model (accessed 2026-10-20)
App free; Chord ai Pro monthly $10.99, yearly $69.99; "family sharing" variants $14.99 monthly and $99.99 yearly ([App Store](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109)). Freemium subscription.

### Platforms (official)
iOS/iPadOS 17+, macOS 14+ on Apple silicon, Apple Vision ([App Store](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109)). A Google Play listing appears in search results but was not opened.

### What is public about tech and company
Developer Nomad AI OU; lyrics are recognized on-device ([App Store](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109)). Models undisclosed.

### Standout strengths
Feature density at a low price; YouTube support; works as a real-time listener; MIDI export.

### Common complaints (tier 4, anecdotal)
Update bugs (lost saved songs), phone overheating and privacy worries, minor chords misdetected as major (disputed by the developer), beat markers inconsistent in 3/4 and 6/8, long chord names do not fit on PDFs; praise for no paywall on core features, export options and support ([reviews](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109?see-all=reviews&platform=iphone)).

### What Splitune can learn or do differently
- Beat grid in non-4/4 meters is a known failure; test early (`research/ml/chords-beats-key-structure.md`).
- Free core features are a user-acquisition tactic that works for small apps; pair with paid depth.
- Combine its building blocks with tab and fingering output.

## Implications for Splitune
Shows the YouTube-to-chords/stems/MIDI stack is already available at about $70/yr; Splitune cannot win on that stack alone.

## Open questions
- Whether the YouTube access is compliant with YouTube terms (see `research/legal/youtube-copyright-and-platform-policy.md`).
- Android availability and parity.

## Sources
- [Chord ai - Play any song! (US App Store)](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109) — tier 2, accessed 2026-10-20
- [Chord ai App Store reviews](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109?see-all=reviews&platform=iphone) — tier 4, accessed 2026-10-20
