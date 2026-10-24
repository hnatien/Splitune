---
title: "Competitor teardown: LALAL.AI"
workstream: market
last_researched: 2026-10-20
confidence: medium
---

# Competitor teardown: LALAL.AI

## TL;DR
- LALAL.AI is a pure stem-separation utility (not a practice app): upload a file, get two stems per run (for example vocal + instrumental, or drums + drumless) from a menu of 10 stem types, on web, desktop, mobile and as a VST.
- Pricing is minutes-based with a fast/relaxed queue: free 10 minutes; Lite $90/yr; Pro $180/yr; one-time Fast Queue top-ups of 750/3,000/5,000 minutes for $50/$190/$300. That gives a public retail anchor of roughly $0.06-0.07 per processed Fast Queue minute; Lite ($7.50/mo for 90 Fast Queue minutes, about $0.083/min) is pricier per minute, and paid plans include unlimited Relaxed Queue minutes, so per-minute figures apply to Fast Queue minutes only.
- Has a developer API and enterprise offering; no practice tools, no chords, no YouTube-link import mentioned.
- Trustpilot reviewers like quality and pay-per-minute packs but dislike having to buy packs to download results.
- Splitune takeaway: separation is commoditized and priced per minute; do not build the product around separation alone.

## Findings

### Core features
- Ten stem types: vocal/instrumental, drums, bass, electric guitar, acoustic guitar, piano, synthesizer, voice/noise, strings, winds; each separation yields two stems ([LALAL.AI](https://www.lalal.ai/)).
- Marketing claims "transformer technology" and a "sixth-gen engine"; model names are not given on the page ([LALAL.AI](https://www.lalal.ai/)). Treat quality claims as unverified.
- Also noise reduction and other utilities; API for developers with an OpenAPI spec and a GitHub integration example ([LALAL.AI API](https://www.lalal.ai/api/)).

### UX flow of the "learn a song" path
There is none. Flow: upload file (audio MP3/OGG/WAV/FLAC/AIFF/AAC/M4A or video AVI/MP4/MKV/MOV/M4V) → choose stem type → wait in Fast or Relaxed queue → download. Link/YouTube import is not mentioned ([LALAL.AI](https://www.lalal.ai/)).

### Instruments and levels
Instrument-agnostic; no levels.

### Pricing and business model (accessed 2026-10-20, [pricing page](https://www.lalal.ai/pricing/))
| Plan | Price | Fast queue | Relaxed queue | Upload limit | Other |
|---|---|---|---|---|---|
| Starter | Free | none | 10 minutes | 200 MB | no VST/API |
| Lite | $90/yr (displayed as $7.5/mo) | 90 min/mo | unlimited | 2 GB | 1 voice pack slot |
| Pro | $180/yr (displayed as $15/mo) | 250 min/mo | unlimited | 2 GB | VST plugin, API, 3 voice pack slots |
| Top-up Master | $50 one-time | 750 min | | | |
| Top-up Premium | $190 one-time | 3,000 min | | | |
| Top-up Enterprise | $300 one-time | 5,000 min | | | |
Minutes are file duration, multiplied by the number of stem types selected for Vocal Remover/Stem Splitter; fast minutes reset each period and do not roll over; subscriptions are non-refundable ([pricing page](https://www.lalal.ai/pricing/)). The monthly-billing price of Lite/Pro was not clearly extractable from the page; the figures above are the annual price and its per-month display.

### Platforms (official)
Web, desktop apps (Windows, macOS, Linux), iOS and Android apps, and VST plugins that run locally inside a DAW ([LALAL.AI](https://www.lalal.ai/)).

### What is public about tech and company
Website footer shows OmniSale GmbH as the operator ([LALAL.AI API](https://www.lalal.ai/api/)). No papers or engineering blog were found in this pass; see `research/ml/source-separation-model-comparison.md` for models.

### Standout strengths
Per-minute and top-up pricing without forced subscription; broad platform coverage including local VST; API.

### Common complaints (tier 4, anecdotal)
Trustpilot 4.4/5 from 4,365 reviews: praise for clean, fast separation and the lack of forced subscription; recurring complaint that results can only be downloaded after buying packs; uneven quality; no kick/snare split ([Trustpilot](https://www.trustpilot.com/review/lalal.ai)). Profile caveats: Trustpilot does not verify claims.

### What Splitune can learn or do differently
- The minute-based pricing is a clear public benchmark for how the market prices server inference; see `research/market/pricing-and-business-models.md` and `research/ml/deployment-and-inference.md`.
- Free-tier friction (download gated behind payment) generates review backlash; allow a useful free outcome.
- Splitting "stems" from "what to play" is the opening: LALAL.AI outputs audio only.

## Implications for Splitune
A stem-only product is a commodity with an API-priced floor. Use separation as a pipeline step inside a learning flow, not as the headline.

## Open questions
- Monthly (non-annual) prices and what "Result Downloads" tiers include (page cells were incomplete when fetched).
- Actual separation quality vs open models (benchmark in `research/ml/source-separation-model-comparison.md`).

## Sources
- [LALAL.AI pricing](https://www.lalal.ai/pricing/) — tier 2, accessed 2026-10-20
- [LALAL.AI homepage](https://www.lalal.ai/) — tier 2, accessed 2026-10-20
- [LALAL.AI API page](https://www.lalal.ai/api/) — tier 2, accessed 2026-10-20
- [LALAL.AI on Trustpilot](https://www.trustpilot.com/review/lalal.ai) — tier 4, accessed 2026-10-20
