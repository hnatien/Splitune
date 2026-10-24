---
title: "Competitor teardown: Soundslice"
workstream: market
last_researched: 2026-10-20
confidence: medium
---

# Competitor teardown: Soundslice

## TL;DR
- Soundslice is a browser-based interactive notation/tab player and editor that syncs notation to real recordings (YouTube free; uploaded MP3/video on Plus), with slow-down, looping, transposing, soloing, and click-a-note-to-jump-in-video.
- Strong on tooling for teachers and creators: sheet-music scanning (ML), course/lesson organization, and a licensing plan for embedding in other sites.
- Recent AI-adjacent additions: automatic 4-stem generation from MP3 (Nov 2025) and chord-diagram detection in scans (Dec 2025, per the blog index). It does not generate notation from audio: transcription remains manual with slowdown/loop help.
- Pricing: Free; Plus $5/mo or $50/yr; Teacher $20/mo (100 students); Licensing $100/mo (200 users).
- Splitune takeaway: Soundslice is both a competitor and a potential integration/export target; its synced player pattern (notation cursor + video) is the UI standard to beat.

## Findings

### Core features
Synced notation with recordings (YouTube free; MP3/video on Plus); click a note to jump to that moment; drag across notes to loop; slow down, transpose, solo parts; free notation/tab editor with unlimited slices; import MusicXML and Guitar Pro; scan PDFs/photos (Free 2 pages/mo, Plus 100, Teacher/Licensing 200); share by secret link; courses for teachers; embed (Licensing) ([Soundslice homepage](https://www.soundslice.com/), [Plans](https://www.soundslice.com/plans/)).

### UX flow of the "learn a song" path
Find a slice (creator-published notation synced to a video) or make your own: paste a YouTube link, enter notation by hand or import, align sync points (a recent post adds visible detected beats while editing sync points) → practice with the player. The "transcribe" workflow combines slowdown, looping and notation entry in one tool ([Soundslice homepage](https://www.soundslice.com/), [blog index](https://www.soundslice.com/blog/)).

### Instruments and levels
Any instrument/genre; strong guitar/tab support. No levels, but lesson/course tooling for teachers.

### Pricing and business model (accessed 2026-10-20, [Plans](https://www.soundslice.com/plans/))
| Plan | Price | Notable |
|---|---|---|
| Free | $0 | editor, sync with YouTube, import MusicXML/GP, 2 scan pages/mo |
| Plus | $5/mo or $50/yr | sync with uploaded MP3/video, print/export, secret-link sharing, scan 100 pages/mo, auto-save player settings |
| Teacher | $20/mo or $200/yr (100 students; +$0.20/student/mo) | private courses, comments, 200 scan pages/mo |
| Licensing | $100/mo (200 unique users; +$0.50/user) | embed in your site/app, org accounts |

Licensing is usage-based: one "unique user" is one computer that viewed an embed in a month ([licensing page](https://www.soundslice.com/licensing/)). The Plus yearly option launched in Sep 2022 at $50/yr ([blog](https://www.soundslice.com/blog/225/yearly-plus-plan-now-available/)).

### Platforms (official)
Any modern web browser on phone, tablet or desktop, nothing to install ([Soundslice homepage](https://www.soundslice.com/)). Offline use not documented.

### What is public about tech and company
Product updates: "Automatic multitrack stem generation" (Nov 18, 2025) extracts four stems (vocals, drums, bass, other) from an MP3 recording after upload; it supports MP3 only, not video ([blog](https://www.soundslice.com/blog/298/automatic-multitrack-stem-generation/)). Plan availability for that feature is not stated. The blog index through Oct 2026 lists scan improvements, chord-diagram detection in scans and notation features but no audio-to-notation feature ([blog index](https://www.soundslice.com/blog/)); this is negative evidence from titles only.

### Standout strengths
Best-in-class synced player; strong teacher workflow; scan-to-notation OCR praised by users; transparent pricing; B2B embed model.

### Common complaints (tier 4, anecdotal)
Trustpilot 3.3/5 from only 10 reviews (no review in the last 12 months; unclaimed profile): lost work and auto-save paywalled, free-trial limits, iPad/Safari editor failures, poor MusicXML export; praise for OCR and support speed ([Trustpilot](https://www.trustpilot.com/review/soundslice.com)).

### What Splitune can learn or do differently
- Use a "notation cursor synced to the source video" as a primary view; see `research/ux/music-display-ui.md`.
- Soundslice's creator/licensing model hints at an alternate route to a legal catalog: partner with licensed creators; see `research/legal/youtube-copyright-and-platform-policy.md`.
- Auto-generating notation from audio is Soundslice's visible gap and Songsterr's/Klangio's strength.

## Implications for Splitune
Potential partner and export target. Compete on automation and personalization, not on editor depth.

## Open questions
- Which plan includes auto stems; accuracy of the stems.
- Whether Soundslice will add audio-to-notation (monitor the blog).

## Sources
- [Soundslice homepage](https://www.soundslice.com/) — tier 2, accessed 2026-10-20
- [Soundslice plans](https://www.soundslice.com/plans/) — tier 2, accessed 2026-10-20
- [Soundslice licensing](https://www.soundslice.com/licensing/) — tier 2, accessed 2026-10-20
- [Soundslice blog index](https://www.soundslice.com/blog/) — tier 2, accessed 2026-10-20
- [Automatic multitrack stem generation (Soundslice blog)](https://www.soundslice.com/blog/298/automatic-multitrack-stem-generation/) — tier 2, accessed 2026-10-20
- [Yearly Plus plan now available (Soundslice blog)](https://www.soundslice.com/blog/225/yearly-plus-plan-now-available/) — tier 2, accessed 2026-10-20
- [Soundslice on Trustpilot](https://www.trustpilot.com/review/soundslice.com) — tier 4, accessed 2026-10-20
