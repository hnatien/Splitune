---
title: "Competitor teardown: Moises"
workstream: market
last_researched: 2026-10-20
confidence: medium
---

# Competitor teardown: Moises

## TL;DR
- Moises is the category leader for "AI stem separation + practice tools" aimed at musicians: stems, chord detection, key/BPM detection, metronome/count-in, speed and pitch change, loops, setlists, and (for some languages) lyric transcription, on web, desktop, iOS/iPadOS, Android.
- It has no YouTube/streaming import (official help says no, per a search-result summary; see Findings) and no real note-level tab transcription or curriculum. The user must bring an audio/video file or a public file-host URL.
- Pricing on the official site is login-gated; the only prices we could verify are the App Store ones: Premium $5.99/mo or $39.99/yr, Pro $29.99/mo. Free tier exists but is limited (upload cap not published).
- Reviews (anecdotal) praise stem quality and key/speed tools; complain about usage caps/credits, billing/refund friction, and weak drum/multi-vocal separation and lyric accuracy.
- Splitune takeaway: Moises proves demand and sets the quality/UX bar for stems, but leaves open "from a specific performance to an instrument-specific, learnable lesson".

## Findings

### Core features
- Stem separation: App Store listing names vocals, drums, bass, guitar, piano, strings and "other"; Premium adds lead/rhythm guitar, acoustic/electric guitar and main/background vocals; Pro adds "Hi-Fi" models, drum-part and multimedia stems, up to 180 minutes per upload and Voice Studio VST plugins ([App Store](https://apps.apple.com/us/app/id1515796612)). The marketing homepage claims 27 stem types and "Hi-Fi" models ([moises.ai](https://moises.ai/)); treat the 27 figure as marketing, not verified.
- Practice tools: smart metronome and count-in, speed and pitch change, loop/trim, key detection with transposition to all 12 keys, BPM detection, collaborative setlists, export of mixes/stems/click tracks ([App Store](https://apps.apple.com/us/app/id1515796612)).
- Chords: "AI chord detection with synced guitar tabs" per the listing (in practice chord names/diagrams; we did not verify full tab output). The homepage mentions only a "Chord Finder" ([moises.ai](https://moises.ai/)).
- Lyrics: AI lyric transcription for English, Spanish, Portuguese, French, Italian ([App Store](https://apps.apple.com/us/app/id1515796612)).

### UX flow of the "learn a song" path
1. Upload an audio/video file (from device, iCloud/Dropbox/Google Drive, iTunes library) or paste a public file-host URL ([App Store](https://apps.apple.com/us/app/id1515796612)).
2. Server-side processing, then a mixer-style player: mute/solo stems, change speed/pitch/key, loop sections, view chords, count-in.
3. Optionally save to a setlist, export stems.
There is no step that tells the learner what to play on their instrument beyond chords; the learner works by ear with the isolated part.

### Import sources (important for Splitune)
- The Moises homepage does not mention YouTube import ([moises.ai](https://moises.ai/)). A search-result summary of the Moises help article "My URL isn't working" states YouTube and other streaming/social links are not processed; we could not open that page ourselves (HTTP 403), so treat as likely but unverified: [help article](https://help.moises.ai/hc/en-us/articles/360020130539-My-URL-isn-t-working-Why).
- The App Store listing says Apple Music/streaming tracks are not the model; imports are via Google Drive, Dropbox, iCloud and public URLs ([App Store](https://apps.apple.com/us/app/id1515796612)).

### Instruments and levels
Instrument-agnostic (any recording). Free tier gives vocals/drums/bass stems plus chord detection, metronome, pitch shift, BPM detection and setlists; Premium unlocks unlimited separation and guitar/vocal sub-stems; Pro targets professionals ([App Store](https://apps.apple.com/us/app/id1515796612)). No skill-level model.

### Pricing and business model (accessed 2026-10-20)
| Plan | Price | Source |
|---|---|---|
| Free | $0, "limited number of uploads each month" (cap not published) | [moises.ai/pricing](https://moises.ai/pricing/) |
| Premium | $5.99/mo or $39.99/yr (US App Store) | [App Store](https://apps.apple.com/us/app/id1515796612) |
| Pro | $29.99/mo (US App Store) | [App Store](https://apps.apple.com/us/app/id1515796612) |
The pricing page itself says the comparison table is behind a login ([moises.ai/pricing](https://moises.ai/pricing/)). Search-result summaries of third-party reviews quoted lower web prices ($3.99 and $9.99 per month); we could not open those pages, so they are unverified and may reflect web-vs-app-store differences. B2B: the company also operates Music.AI, an audio-model platform for businesses that claims to process over two million minutes of audio per day ([music.ai](https://music.ai/)).

### Platforms (official)
Web app, desktop app, iPhone/iPad, Android ([moises.ai](https://moises.ai/)); App Store compatibility also lists Mac (Apple silicon), Apple Vision and Apple TV ([App Store](https://apps.apple.com/us/app/id1515796612)).

### What is public about tech and company
Funding announcement (Aug 2022): $8.65M led by Kickstart Fund and Monashees; 20M+ registered users then; 50+ employees in Salt Lake City and João Pessoa, Brazil; stated use of funds includes algorithm research and B2B partnerships ([Moises newsroom](https://moises.ai/newsroom/company-milestones/moises-raises-8-65-million)). Later rounds and user counts (homepage now claims 70-80 million; the page itself gives two different figures) are self-reported ([moises.ai](https://moises.ai/)). Search results also mentioned a larger Series A; we could not open a primary source, so treat as unverified. No engineering blog or model details found; for what models are plausible see `ml/source-separation.md`.

### Standout strengths
Breadth of stems, polished cross-platform apps, Editors' Choice recognition and 4.7/5 from 28K App Store ratings ([App Store](https://apps.apple.com/us/app/id1515796612)); fast setlist/practice workflow; a B2B arm that diversifies revenue.

### Common complaints (tier 4, anecdotal)
- App Store sample: credit/download caps feel restrictive; export errors; weak separation when several vocal parts overlap; some UI confusion ([App Store reviews](https://apps.apple.com/us/app/moises-the-musicians-app/id1515796612?see-all=reviews&platform=iphone)).
- Trustpilot: 1.7/5 from 67 reviews (unclaimed profile, may be unrepresentative) citing refused refunds, hard-to-reach support, features removed mid-subscription, poor drum separation, unreliable chords and lyrics ([Trustpilot](https://www.trustpilot.com/review/moises.ai)).
- An App Store reviewer said uploading prerecorded tracks became a paid feature ([App Store](https://apps.apple.com/us/app/id1515796612)).

### What Splitune can learn or do differently
- Match the practice-tool baseline (loop, speed, key, count-in, mixer) as table stakes; see `ux/practice-tool-patterns.md`.
- Differentiate on the missing step: instrument-specific notes/chords/tab for the isolated part, plus lesson scaffolding. Moises stops at "listen and figure it out".
- YouTube-link entry is a gap in Moises but has legal weight; see `legal/youtube-copyright-and-platform-policy.md`.
- Billing transparency and clear free-tier limits are a visible pain point; see `users/voice-of-customer-pain-points.md`.

## Implications for Splitune
Treat Moises as the reference competitor for stems. Do not compete on stem breadth early; compete on turning one stem into a playable, leveled lesson. See `market/competitor-landscape.md` and `market/feature-matrix.md`.

## Open questions
- Exact free-tier cap and web prices (need a logged-in view or an updated public page).
- Whether the "synced guitar tabs" claim means note-accurate tab or chord diagrams (test with a real account).
- Current registered vs active user numbers.

## Sources
- [Moises: The Musician's App (US App Store)](https://apps.apple.com/us/app/id1515796612) — tier 2, accessed 2026-10-20
- [Moises App Store ratings and reviews](https://apps.apple.com/us/app/moises-the-musicians-app/id1515796612?see-all=reviews&platform=iphone) — tier 4, accessed 2026-10-20
- [Moises homepage](https://moises.ai/) — tier 2, accessed 2026-10-20
- [Moises pricing page](https://moises.ai/pricing/) — tier 2, accessed 2026-10-20
- [Moises raises $8.65 million (newsroom)](https://moises.ai/newsroom/company-milestones/moises-raises-8-65-million) — tier 2, accessed 2026-10-20
- [Moises help: My URL isn't working (not opened; search snippet only, HTTP 403)](https://help.moises.ai/hc/en-us/articles/360020130539-My-URL-isn-t-working-Why) — tier 2, accessed 2026-10-20
- [Music.AI homepage](https://music.ai/) — tier 2, accessed 2026-10-20
- [Moises on Trustpilot](https://www.trustpilot.com/review/moises.ai) — tier 4, accessed 2026-10-20
