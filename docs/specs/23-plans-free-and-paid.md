---
title: Plans — free vs paid features
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# Plans: free vs paid features

The packaging decision that `14-auth-billing-and-entitlements.md` enforces. It refines D10 (freemium subscription, published cap, first song free, no tickets) into a feature-by-feature split, using three inputs: **what each feature costs us per use**, **what users punish competitors for gating**, and **what the law requires to stay free**. All prices and caps are **starting hypotheses** to validate with the Phase 0 fake-door test and beta data.

> **Personal mode is current (`25-personal-mode.md`).** The Free/Plus split is implemented for real; purchasing is simulated by `MockBillingProvider`. With self-hosted models the metered unit costs **compute time on your Mac** rather than money (Full ≈ minutes with separation on MPS; Lite ≈ seconds), so allowances protect machine time and keep the paywall UX exercised. The dollar unit-economics in §4 describe the dormant commercial path. F7 (embed never paywalled) still holds as a product rule.

## TL;DR
- **Two plans at launch: Free and Plus** ($9.99/month or $79.99/year as the starting point; test $8–12/month). Teacher and Family plans come later.
- **Free is a real practice app, not a demo.** Every practice tool works for free on example songs and on every song the user has already analysed: loop, slow-down, count-in, metronome, mixer, chord strip, tab view, edits, level toggle, pedal control. Users punish competitors for gating exactly these (Chordify slow/loop, Moises "paywall at the door").
- **What Free limits is new *full* analyses,** because each one costs us ~$0.25–0.45 in vendor separation. Free gets **one Welcome analysis** (full: isolated part + minus-one + tab) and **5 Lite analyses per month** (beat grid + chords + key on the full mix; ~$0.01 each, self-hosted).
- **Plus pays for volume and depth:** 15 full analyses/month, unlimited Lite (fair use), extra instruments per song, priority processing, and — as they ship in v1 — mic scoring, offline, export, advanced progress insights.
- **Never gated, ever:** watching the YouTube embed (Developer Policy III.F.3.a, pending QL1), the user's own data (library, edits, loops, export of personal data), and anything already given to Free (no take-backs).

## 1. Decision principles
| # | Principle | Evidence / reason |
|---|---|---|
| F1 | **Don't paywall the "aha" or the basics.** Slow-down, loop, transpose and a first isolated part stay free | Paywalled practice basics are a High-frequency pain (Chordify gates slow/loop/transpose; Moises "most features locked") — `research/users/voice-of-customer-pain-points.md` §3; roadmap M5 "keep it free" |
| F2 | **Meter what costs money per use** — vendor separation and heavy GPU work | Vendor single-stem separation ≈ $0.24–0.28 per 4-min song (Music.AI guitar line is $0.10/min → ≈ $0.40); self-hosted beats/chords ≈ $0.005–0.02 (`research/product/recommendations-and-decisions.md` D6) |
| F3 | **Zero-marginal-cost tools stay free.** They run on the device | Practice keeps free users active; conversion happens when they want *new* songs (inference) |
| F4 | **Charge for depth that committed learners value** — offline, export, mic scoring, multi-part, insights | These serve repeat, weekly users (personas P1–P3) and several carry cost or legal review (export, offline retention) |
| F5 | **Caps are published, predictable, and never consumed by failures** | Tickets/credits read as bait-and-switch (Klangio); Songsterr's monthly cap is the predictable model (`research/market/pricing-and-business-models.md`) |
| F6 | **No take-backs.** A feature given to Free or to existing subscribers is never moved up later | "Basic features switched to paid without warning" (Moises App Store) |
| F7 | **The embed is never behind a paywall** | YouTube Developer Policy III.F.3.a (`research/legal/youtube-copyright-and-platform-policy.md`); QL1 |
| F8 | **No card-required trials.** The Welcome analysis *is* the trial | Trial-to-annual surprise charges dominate negative reviews |

## 2. Analysis types (the metered unit)
| Type | What runs | Output the learner gets | Our cost (est.) | Free | Plus |
|---|---|---|---|---|---|
| **Welcome analysis** | Full pipeline for one instrument | Isolated part + minus-one + chords + tab (guitar/bass at MVP; piano/drums in v1) | ≈ $0.25–0.45 once | **1 per account (lifetime)** | — |
| **Full analysis** | decode → beats → tag → vendor separation (1 target) → stem_post → chords → notes → finalize | Same as Welcome | ≈ $0.25–0.45 | — (after Welcome) | **15 / month** |
| **Extra instrument on the same song** | separation target + notes for a second instrument | Second isolated part + its notation | ≈ $0.25–0.45 | — | Counts as 1 full analysis |
| **Lite analysis** | decode → beats → chords/key (→ sections in v1) on the full mix; no vendor call | Bar-snapped loops, count-in/metronome on the real beat, chord strip, key, full-mix slow-down | ≈ $0.005–0.02 | **5 / month** | **Unlimited** (fair use 200/month) |
| **Upgrade Lite → Full** | Runs only the missing stages (cache keys reuse beats/chords) | Adds stems + tab | as Full | uses the Welcome analysis if unused | Counts as 1 full analysis |
| **Re-analysis after a Splitune model upgrade** | Re-runs changed stages | New artefact version (old edits kept) | varies | Free for the Welcome song | **Free** (doesn't count) |
| **Failed or fallback-only run** | — | — | — | Never counts | Never counts |

**Conditional option (decide at G0):** if Prototype 1 shows a green self-hosted model's bass/drums/vocals stems rate acceptably (median ≥3.5 "could I practise with this?"), Lite also includes **Standard stems** (vocals/drums/bass/other via Spleeter, MIT weights, labelled "Standard quality"). Guitar/piano isolation stays Full-only. If the ratings miss, Lite stays chords-and-beat only — shipping muddy stems for free would feed the #1 trust complaint.

## 3. Feature matrix
✓ = included · — = not included · "v1" = ships in v1 in that tier

| Area | Feature (roadmap id) | Free | Plus | Why this split |
|---|---|---|---|---|
| Practice core | Bar-snapped A–B loop, saved clips, pass counter (M6) | ✓ | ✓ | F1, F3 |
| | Slow-down 50–100% without pitch change (M5) | ✓ | ✓ | F1 — the most-cited paywall pain |
| | Count-in, metronome on detected beats, half/double fix (M7) | ✓ | ✓ | F3 |
| | Stem mixer, minus-one / your-part-loud presets (M4) on analysed songs | ✓ | ✓ | F1 (the isolated part is the aha) |
| | Chord strip, tab, confidence shading, edit, report wrong (M8–M10) | ✓ | ✓ | Trust features must not be paid (F1); edits improve our quality data |
| | Level toggle (M11) | ✓ | ✓ | Core differentiator; drives retention |
| | Hands-busy controls, pedals, accessibility (M15) | ✓ | ✓ | Accessibility is never a paid feature |
| | Speed trainer, manual (V1) | ✓ v1 | ✓ v1 | Practice basic, zero cost (F3) |
| | Transpose + capo suggestions (V2) | ✓ v1 | ✓ v1 | Chordify gating transpose is a cited pain (F1) |
| | Tuner (V7 part) | ✓ v1 | ✓ v1 | Utility; on-device |
| | Record-and-compare (V8) | ✓ v1 | ✓ v1 | On-device; supports self-assessment |
| | Visual/haptic metronome (V9) | ✓ v1 | ✓ v1 | Accessibility |
| Content | Example songs (M13) | ✓ unlimited | ✓ | Onboarding |
| | Import own file / record yourself (M1) | ✓ | ✓ | Import is free; analysis is metered |
| | YouTube embed + syncpoints (M12) | ✓ | ✓ | F7 (legal) |
| | Library, resume, never removed by Splitune (M14) | ✓ unlimited songs | ✓ | Storage cost is negligible (JSON + per-user stems); a song limit would be a petty paywall |
| Analysis | Welcome analysis | 1 lifetime | — | F8 |
| | Full analyses | — | 15 / month | F2 |
| | Lite analyses | 5 / month | Unlimited (fair use) | F2 (cheap, but bounded against abuse) |
| | Extra instrument per song | — | ✓ (counts as 1) | F2 |
| | Piano / drums notation (V4, V6) | Welcome analysis only | ✓ v1 | Same unit as Full |
| | Priority processing (warm GPU pool, front of queue) | — | ✓ | Real cost (warm containers) |
| Depth | Mic listen-and-score (V7) | — | ✓ v1 | F4; also limits exposure while accuracy is proven |
| | Piano wait mode via MIDI (V5) | — | ✓ v1 | F4 |
| | Offline practice (V10) | — | ✓ v1 | F4; retention policy pending counsel |
| | Export MusicXML / Guitar Pro / PDF (V11) | — | ✓ v1 | F4; counsel review of portable copies |
| | Alternative fingerings, tuning presets (V12) | ✓ v1 | ✓ v1 | Correctness of the tab, not a luxury |
| | Richer level adaptation (V13) | ✓ v1 | ✓ v1 | Core differentiator |
| | Progress: tempo reached per clip, last 30 days | ✓ | ✓ | Motivation for everyone |
| | Progress insights: full history, weekly trends, spaced-review queue (L2) | — | ✓ later | F4 |
| | Sections auto-detection (V3) | ✓ (with Lite or Full) | ✓ | Runs in the cheap path |
| Account | Personal data export, account deletion | ✓ | ✓ | Legal/privacy; never gated |

## 4. Unit economics check (illustrative; re-run after P4 and vendor quotes)
| Case | Revenue (net of MoR ≈ 7–10%) | Analysis cost | Margin before infra/support |
|---|---|---|---|
| Plus monthly, uses 15 full @ $0.30 | ≈ $9.00 | $4.50 | ≈ $4.50 |
| Plus monthly, guitar-heavy, 15 full @ $0.42 | ≈ $9.00 | $6.30 | ≈ $2.70 |
| Plus yearly ($6.67/mo), 15 full @ $0.30 | ≈ $6.05 | $4.50 | ≈ $1.55 |
| Plus monthly, typical 6 full + 10 Lite (assumption) | ≈ $9.00 | ≈ $1.90 | ≈ $7.10 |
| Free user, Welcome + 5 Lite in month 1 | $0 | ≈ $0.35 | −$0.35 (then ≈ −$0.05/month) |

- Full-cap annual users on guitar are near break-even; the cap is a config value per plan and must be revisited with real songs-per-user data (QP2). The structural fix is self-hosted separation on licensed data (D2), which cuts unit cost ≈ 15–50×.
- Alerts: cost per analysis above $0.28 (D10 break-even) or Free cost per new signup above $0.50 (`16-observability-analytics-experiments.md`).

## 5. UX rules for the paywall
Screen layouts (pricing, upgrade sheet, mock checkout/portal) and copy keys are in `27-screens-flows-and-content.md` §3.2, §3.10 and §5.6.

- Locks are shown **only where the user acts** (e.g., "Analyse with stems + tab" on a Lite song), never as decoration over free features.
- Copy states the exact limit and reset date ("4 of 5 Lite analyses left · resets 1 Dec").
- Hitting a cap never blocks practising anything already analysed.
- Upgrade sheet lists what Plus adds in one screen, with monthly and yearly prices and "cancel anytime in one tap".
- No dark patterns: no pre-selected annual plan, no countdown timers, no "are you sure?" loops on cancel.

## 6. Implementation hooks
- `usage_ledger.kind` values: `welcome_analysis`, `full_analysis`, `lite_analysis`, `extra_instrument` (`03-data-model-and-storage.md`).
- Pipeline profiles `full` and `lite` in `services/ml/config/` (`06-ml-pipeline-service.md`); upgrade Lite → Full reuses per-user stage cache keys.
- `POST /v1/analyses` takes `type: "full" | "lite"` (`04-api-contract.md`); admission computes entitlements (`14-…`).
- Flags: `plan.free.lite_per_month`, `plan.plus.full_per_month`, `plan.free.standard_stems_enabled` — all remotely configurable.
- Experiments: price variants ($8 / $9.99 / $12), Lite allowance (3 vs 5 vs 10), Welcome analysis instrument restriction — via PostHog experiments with conversion and cost per signup as metrics.

## Open questions
- Does a Free tier with Lite analyses cannibalise Plus, or feed it? Measure Lite → Full upgrade rate in beta.
- Annual-plan margin at full cap (table above) — adjust cap or price after QP2 data.
- Whether Standard stems pass the P1 bar (decides the conditional option).
- Teacher plan (students, sharing loops privately) and Family plan — after launch (QP5).

## Sources
Cross-linked research: `research/product/recommendations-and-decisions.md` D6 (per-song cost), D10 (plans), `research/market/pricing-and-business-models.md` (competitor free tiers, caps, ticket backlash), `research/users/voice-of-customer-pain-points.md` §3 (paywall and billing pain), `research/users/personas.md` (WTP anchors), `research/legal/youtube-copyright-and-platform-policy.md` (III.F.3.a), `research/product/feature-roadmap-beginner-to-intermediate.md` (feature ids). Vendor prices: [Music.AI pricing](https://music.ai/pricing/) ($0.07/min per stem, $0.10 guitar), accessed 2026-10-20.
