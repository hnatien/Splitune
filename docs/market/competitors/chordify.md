---
title: "Competitor teardown: Chordify"
workstream: market
last_researched: 2026-10-20
confidence: medium
---

# Competitor teardown: Chordify

## TL;DR
- Chordify turns a song (via a YouTube-integrated catalog or your own files) into scrolling chord diagrams for guitar, piano and ukulele, with a digital capo, speed-down, loops and a newer "Toolkit" (live chord detection, practice).
- Dutch company (founded 2013, Groningen) that began as a Utrecht University chord-recognition research project; says it built partnerships with music publishers to operate within copyright law.
- Free tier is capped; Premium on the iOS App Store is shown at $8-$9/mo or $42-$54/yr (labels ambiguous). The official site pricing page was blocked (HTTP 403) to our fetcher; see caveat below.
- Trustpilot 4.8/5 (2,201 reviews) mostly positive, with account-access and AI chord accuracy complaints; App Store reviewers complain about the free daily song limit and wrong auto-chords.
- Splitune takeaway: "paste a YouTube link, get chords" is a proven, mass-market, publisher-licensed behavior; chords-only is the ceiling of the product.

## Findings

### Core features
Free: chord charts with animated chord views for piano, ukulele and guitar; search in a catalog the listing puts at 36,000,000 titles; YouTube integration; personal library and sync. Premium: transposing, capo support, slowing songs, looping, MIDI/PDF export ([App Store listing](https://apps.apple.com/us/app/id1073624757)). The 9.0.0 update added a "Chords over Lyrics" view for 7,500+ songs ([App Store listing](https://apps.apple.com/us/app/id1073624757)). A 2024 profile adds a digital capo, uploading personal files, and a Toolkit with Live Chord Detection and Practise your Chords ([Techleap](https://techleap.nl/blog/chordify-striking-the-right-note-in-music-education-and-ai-innovation)).

### UX flow of the "learn a song" path
Search a song or paste a link → a chord timeline plays in sync with the YouTube video (or uploaded file) → pick instrument diagrams → transpose/capo/slow/loop (Premium). No lesson, no feedback, no note-level detail.

### Instruments and levels
Guitar, piano, ukulele ([App Store listing](https://apps.apple.com/us/app/id1073624757)). Aimed at "musicians of all levels"; no levels in-product.

### Pricing and business model (accessed 2026-10-20)
- App Store (US): monthly subscription entries $8.00, $9.00, $8.99; yearly $54.00, $42.00; a Black Friday entry $47.90 ([App Store listing](https://apps.apple.com/us/app/id1073624757)). The listing does not label which entry is which plan.
- Official site: the premium and "is Chordify free" pages returned HTTP 403 when we fetched them, so we could not verify tier prices or the daily free-song cap directly. A search-result summary reported Basic $2/mo, Premium $3.50/mo (billed $42/yr) and Premium Plus with a Toolkit, plus a free cap of 2 songs/day (4 with account); this is unverified. The yearly $42 matches one App Store yearly entry, which weakly corroborates it. An App Store reviewer asked "why am i only allowed to practice three songs a day?" ([reviews](https://apps.apple.com/us/app/id1073624757?see-all=reviews&platform=iphone)), so the cap may have varied over time.
- Model: freemium subscription; publisher licensing means revenue share cost (details not public).

### Platforms (official)
iOS 16+/iPadOS 16+ app; the listing mentions library syncing across desktop and mobile ([App Store listing](https://apps.apple.com/us/app/id1073624757)). Web app exists (library syncs "across desktop and mobile"). Android not verified (support page blocked).

### What is public about tech and company
Founded 2013 in Groningen by four former band members; started as a university research project on chord recognition; uses AI to analyze audio into chords and beats; relies on community feedback for accuracy; built publisher partnerships "to operate within copyright law" ([Techleap, Sep 2024](https://techleap.nl/blog/chordify-striking-the-right-note-in-music-education-and-ai-innovation)). Academic origin: the paper "Chordify: Chord transcription for the masses" (Utrecht) exists, but we could only see search metadata, not the paper. See `ml/chords-beats-key-structure.md`.

### Standout strengths
Instant, zero-learning-curve "any song to chords" flow; large catalog and YouTube sync; clean UI; strong Trustpilot support praise; publisher deals.

### Common complaints (tier 4, anecdotal)
- Trustpilot: 4.8/5 from 2,201 reviews (88% five-star). Complaints: login/verification problems; one reviewer says content is AI-generated with insufficient quality control; occasional billing issues ([Trustpilot](https://www.trustpilot.com/review/chordify.net)).
- App Store: free-tier song limit; lost history/saved songs; auto chords "sometimes wrong"; no dark mode; piano chord voicings too complex ([reviews](https://apps.apple.com/us/app/id1073624757?see-all=reviews&platform=iphone)).

### What Splitune can learn or do differently
- The default entry point (paste a link) is already normal for users; Splitune must be better than chord diagrams (notes, fingering, rhythm).
- Surface that chords are auto-generated and let users correct them.
- Publisher partnerships are the credible path for catalog-based legal cover; see `legal/youtube-copyright-and-platform-policy.md`.

## Implications for Splitune
Chordify is the benchmark for the chord layer in `ml/chords-beats-key-structure.md` and for how to price it (single digits per month).

## Open questions
- Verified official prices and free caps (retry from a normal browser).
- How the publisher partnerships work economically.

## Sources
- [Chordify: Songs, Chords, Tuner (App Store)](https://apps.apple.com/us/app/id1073624757) — tier 2, accessed 2026-10-20
- [Chordify App Store reviews](https://apps.apple.com/us/app/id1073624757?see-all=reviews&platform=iphone) — tier 4, accessed 2026-10-20
- [Techleap: Chordify, striking the right note](https://techleap.nl/blog/chordify-striking-the-right-note-in-music-education-and-ai-innovation) — tier 3, accessed 2026-10-20
- [Chordify on Trustpilot](https://www.trustpilot.com/review/chordify.net) — tier 4, accessed 2026-10-20
