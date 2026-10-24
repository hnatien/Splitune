---
title: "Competitor teardown: Anytune"
workstream: market
last_researched: 2026-10-20
confidence: medium
---

# Competitor teardown: Anytune

## TL;DR
- Anytune (Anytune Inc.) is a mature Apple-platform "slow downer" and practice player: tempo change down to 0.05x, pitch shift up to +/-24 semitones, loops, marks, count-in, EQ, "ReFrame" audio isolation, a transcribe mode and a performance recorder.
- Pro+ is a paid app ($14.99 with small IAPs) rather than a subscription; it cannot play DRM-protected (Apple Music subscription) tracks.
- Reviewers (4.9/5 from 8.4K ratings) praise sound quality at slow speeds and stability; complaints are minor (crowded UI, FLAC/format quirks).
- Splitune takeaway: the playback-DSP baseline (slow without artifacts, loop, step-it-up trainer) is solved and loved; match it. See `research/ml/playback-time-stretch-pitch-shift.md`.

## Findings

### Core features
Tempo change without pitch change down to 0.05x; pitch shift +/-24 semitones; marks and loops with a "Step-it-Up" loop trainer; waveform view; playlists; import from Files, Dropbox, Wi-Fi and other apps; extract audio from video; record and analyze your performance; scrolling lyrics or text tabs; audible and visual count-in; Transcribe Mode; ReFrame audio isolation for soloing or muting parts; FineTouch EQ; LiveMix play-along ([App Store listing](https://apps.apple.com/us/app/anytune-pro-studio-tools/id478293637)).

### UX flow of the "learn a song" path
Import a DRM-free file → mark sections → loop with gradually increasing speed (Step-it-Up) → optionally isolate/EQ a part → record yourself and compare. There is no chord or note analysis shown on the listing, so the learner still transcribes by ear.

### Instruments and levels
Instrument-agnostic; no levels.

### Pricing and business model (accessed 2026-10-20)
Anytune Pro+: Studio Tools is $14.99 with in-app purchases (Export Tuned Tracks add-on $4.99, Remote Control & Watch app $4.99) ([App Store listing](https://apps.apple.com/us/app/anytune-pro-studio-tools/id478293637)). One-time purchase model.

### Platforms (official)
iPhone/iPad (iOS/iPadOS 16+), Apple Vision, Apple Watch (watchOS 10+) ([App Store listing](https://apps.apple.com/us/app/anytune-pro-studio-tools/id478293637)). Other Anytune products exist (a Mac title and a free base app), not verified here.

### What is public about tech and company
Developer claims "amazing HQ audio quality" at 0.05x ([App Store listing](https://apps.apple.com/us/app/anytune-pro-studio-tools/id478293637)). ReFrame is described as isolation, not neural stem separation; the underlying method is not disclosed.

### Standout strengths
Audio quality at extreme slow speeds, a very complete practice toolset, Apple Watch remote, stable over ~10 years per reviewers.

### Common complaints (tier 4, anecdotal)
Crowded dashboard; keyboard shortcut connection drops on iPad; some file corruption and FLAC/local-network issues; one 2013 reviewer found it pricey ([App Store reviews](https://apps.apple.com/us/app/anytune-pro-studio-tools/id478293637?see-all=reviews&platform=iphone)).

### What Splitune can learn or do differently
- The "Step-it-Up" trainer (loop speed increases automatically) is a concrete practice-science feature to adopt; see `research/ux/practice-tool-patterns.md`.
- Reading local files only (no DRM) is the same constraint as Capo; Splitune's YouTube entry point must resolve this legally.
- Add what Anytune lacks: stems from neural separation and notes/chords.

## Implications for Splitune
Playback quality is a retention feature for serious learners; budget engineering time for a high-quality time-stretch engine.

## Open questions
- Whether ReFrame uses source separation or phase/pan/EQ tricks.
- Anytune's Mac and Android availability and current sales volumes (not captured).

## Sources
- [Anytune Pro+: Studio Tools (App Store)](https://apps.apple.com/us/app/anytune-pro-studio-tools/id478293637) — tier 2, accessed 2026-10-20
- [Anytune Pro+ App Store reviews](https://apps.apple.com/us/app/anytune-pro-studio-tools/id478293637?see-all=reviews&platform=iphone) — tier 4, accessed 2026-10-20
