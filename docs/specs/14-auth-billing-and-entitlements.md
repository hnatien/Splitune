---
title: Auth, billing and entitlements
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# Auth, billing and entitlements

Implements D10 (freemium subscription, published analysis cap, no tickets) and M16 (transparent billing). Billing complaints are the most frequent and severe pain in the category (`research/users/voice-of-customer-pain-points.md`), so billing hygiene is a feature, not plumbing.

> **Personal mode is current (`25-personal-mode.md`): payments are mocked.** `BILLING_PROVIDER=mock` — checkout and portal are local pages with *simulate success / decline / cancel / renewal / failure / refund* buttons that emit normalised `BillingEvent`s through the real webhook handler, so entitlements, allowances, reminders and cancel flows behave exactly as in production. No card inputs are rendered. Stripe/Paddle/RevenueCat sections are the dormant path. Auth email goes to Mailpit locally (or any free SMTP).

## TL;DR
- **Auth: Better Auth 1.7.x** (self-hosted library, tables in our Postgres): email magic link, Google, Sign in with Apple; passkeys later; account linking by verified email. No passwords at launch.
- **Payments: a merchant of record** so a small team doesn't run global VAT/GST. Stripe Billing + Managed Payments if the company's country is eligible (fees ≈ 2.9% + 30¢ + 3.5% MoR + 0.7% Billing), else Paddle (5% + 50¢) or Polar. Web billing first; RevenueCat when native IAP arrives.
- **Entitlements live in our DB** (`subscriptions`, `usage_ledger`), synced from provider webhooks; the analysis cap is enforced at job admission, not by billing metering.
- **Free vs Plus is decided in `23-plans-free-and-paid.md`:** Free = every practice tool, example songs, one Welcome full analysis, 5 Lite (beat + chords) analyses/month; Plus ($9.99/mo or $79.99/yr starting hypothesis) = 15 full analyses/month, unlimited Lite, extra instruments, priority, and v1 depth features (mic scoring, offline, export).
- **Hygiene rules are tests:** no tickets/credits, renewal reminder before every annual renewal, one-tap cancel on web, no removal of features from existing subscribers, failed analyses never consume the cap.

## 1. Auth
| Method | Notes |
|---|---|
| Magic link | Better Auth plugin; 5-minute tokens, rate-limited; emails via Resend + React Email |
| Google | OAuth; verified email links accounts |
| Apple | Required for parity once iOS app ships; client-secret JWT must be rotated at most every 6 months (calendar job); email claim only on first authorisation — store it then; localhost not accepted (use a tunnel in dev) |
| Passkeys | `@better-auth/passkey` in a later release |
- Sessions: HttpOnly secure cookies on web; bearer tokens for native (v1). Session lifetime 30 days rolling; re-auth required for account deletion and email change.
- Pre-signup progress (onboarding) stored locally and merged on first sign-in.
- Better Auth joined Vercel (2026-07); it remains open source and framework-agnostic — pin versions (1.8 has breaking changes) and keep the auth layer behind `app/lib/auth.ts` so a switch to WorkOS AuthKit (hosted fallback) is contained.

## 2. Plans and entitlements
The feature split and its rationale are decided in `23-plans-free-and-paid.md`; this section only covers enforcement.

| Entitlement key | Free | Plus |
|---|---|---|
| `practice.core` (loop, slow-down, count-in, metronome, mixer, chords, tab, edits, level, pedals) | ✓ | ✓ |
| `analysis.welcome` | 1 lifetime | — |
| `analysis.full` | — | 15 / period |
| `analysis.lite` | 5 / period | unlimited (fair use 200) |
| `analysis.extra_instrument` | — | counts as 1 full |
| `processing.priority` | — | ✓ |
| `mic.scoring`, `midi.wait_mode`, `offline`, `export` (v1) | — | ✓ |
| `embed.view` | ✓ always (never gated; III.F.3.a) | ✓ |

- `entitlements(user)` is a pure function of `subscriptions` + `usage_ledger` + remote config; used by the API (admission, exports) and returned in `GET /v1/me`.
- **Admission check** in `POST /v1/analyses {type}`: within a transaction, count `usage_ledger` rows of that kind for the current period and insert a reservation; if the analysis ends `failed` (or only fallbacks ran), the reservation is reversed. User-requested re-runs count; re-runs after a Splitune model upgrade don't.
- Period = subscription period for Plus; calendar month (user's timezone) for Free. The remaining allowance and reset date are always visible in the library header.

## 3. Payment integration (provider-agnostic module `apps/api/src/billing/`)
```ts
interface BillingProvider {
  createCheckout(input: { userId: string; plan: "paid_monthly" | "paid_yearly"; country: string; successUrl: string; cancelUrl: string }): Promise<{ url: string }>;
  createPortal(input: { userId: string; returnUrl: string }): Promise<{ url: string }>;
  verifyWebhook(req: Request): Promise<BillingEvent>;   // normalised events
}
type BillingEvent =
  | { type: "subscription.activated" | "subscription.renewed" | "subscription.updated"; userId: string; plan: string; periodStart: string; periodEnd: string; cancelAtPeriodEnd: boolean }
  | { type: "subscription.cancelled" | "subscription.expired"; userId: string; at: string }
  | { type: "payment.failed"; userId: string; at: string }
  | { type: "refund.issued"; userId: string; amount: number; currency: string };
```
On the wire (`/internal/billing/webhook`, incl. the mock checkout and portal) the normalised event is `BillingEvent` in `packages/contracts/src/api/billing.ts`: the same variants with snake_case fields (`user_id`, `period_start`, `period_end`, `cancel_at_period_end`) and `amount_minor` (integer minor units) for refunds.
- Implementations: **`MockBillingProvider` (current; `25-personal-mode.md` §2)**; dormant: `StripeManagedPayments` (subscriptions must be created via Checkout/Payment Links under Managed Payments) and `Paddle`. Choice is a config value.
- Webhooks: verify signature, store raw event id for idempotency, upsert `subscriptions`, emit analytics event, never trust client redirects for entitlement.
- Prices are configured in the provider dashboard and fetched (`GET /v1/billing/plans`) — no hard-coded prices in the client.
- **Fake-door test (Phase 0):** `/pricing` shows the plans; "Subscribe" records `pricing_cta_clicked {plan, price_variant}` and shows "We're not charging yet — you'll be first to know", via PostHog experiment variants ($8 / $9.99 / $12).

## 4. Billing hygiene rules (each has an automated test or monitor)
1. No tickets, credits or lifetime plans tied to content.
2. Trial → paid: if a trial is used, show the charge date at signup and send a reminder 3 days before (email + in-app).
3. Annual renewal reminder 7–14 days before (email), with a direct cancel link.
4. Cancel: one tap from Settings → provider portal (or in-app confirm) — never a retention maze; cancellation keeps access to the period end.
5. No feature removal for existing subscribers; price changes only for new periods with notice.
6. Failed analyses don't consume the cap; refunds policy published.
7. Monitors: refund rate, chargeback rate, "billing" tagged support tickets, cancellations per cohort (`16-observability-analytics-experiments.md`).

## 5. Native apps (v1)
- App-store rules require IAP for digital subscriptions bought in-app; use RevenueCat (free up to $2.5k MTR, then 1%) to unify web + iOS + Android entitlements, mapping its webhooks into the same `BillingEvent` stream.
- Store fees (placeholder 30% in research; QK2 not researched) change the margin math in D10 — keep web checkout as the primary path where store rules allow.

## 6. Unit-economics guardrails
- `analyses.cost_usd_estimate` from the cost ledger; dashboard: cost per analysis, per active user, per paying user vs plan revenue net of MoR fees.
- Alert when the 7-day mean cost per analysis exceeds the D10 break-even ($0.28) or vendor spend grows >30% week over week.
- Cap is a config value per plan so it can be tuned without a deploy.

## Implementation notes (step 04, 2026-10-20)
- Better Auth 1.7.11 in `apps/api/src/auth.ts` (the only module that imports it): Drizzle adapter on the app database, models mapped to `users`/`auth_sessions`/`auth_accounts`/`auth_verifications`; magic link (5-minute single-use tokens stored hashed, emails via SMTP — Mailpit locally); Google only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set, with account linking for Google; email/password off; telemetry off; Better Auth's limiter off in favour of the API's Postgres limiter.
- Re-auth: `requireRecentAuth(session, { maxAgeS = 600 })` compares the session's creation time (each sign-in creates a session).
- `GET /v1/me` computes plan, entitlements and usage with pure functions in `apps/api/src/entitlements.ts` (Free: UTC calendar month — no user time zone yet; Plus: subscription period; `extra_instrument` counts toward full). Caps are constants for now; remote config and admission arrive with step 14.

## Implementation notes (step 14, 2026-10-22)
- `apps/api/src/entitlements.ts`: pure `entitlements({subscription, ledger, limits}, now)` → plan, keys, period, `Me.usage`, `liteCap`; `admit(ent, type, limits, {charged})` → kind (welcome/full/lite), priority (Plus 50, Free 100), `UsageCharge`, 402 details. Limits: defaults 5 Lite/month (Free), 15 full/period and fair use 200 Lite (Plus), Welcome 1 lifetime; flags `plan.free.lite_per_month`, `plan.plus.full_per_month`, `plan.plus.lite_fair_use` (enabled + non-negative integer value) override. `admission.ts` settles the user's due billing, loads entitlements on the billing clock, and `reserving()` turns `AllowanceExhaustedError` into 402. The count happens only in the run's transaction, so an idempotent repeat at the cap still returns its run.
- `apps/api/src/billing/`: `provider.ts` (interface, `addInterval` with month-end clamping), `mock.ts` (MockBillingProvider: signed sessions, checkout success → `subscription.activated` with a per-session event id; portal cancel/resume/switch → `subscription.updated` (switch keeps the current period; the new interval applies at renewal), payment failure → `payment.failed` (status past_due, Plus kept), refund → `refund.issued` (recorded only); `due()` emits renewals or, when cancelling or past due, expiry, with period-based ids), `service.ts` (webhook side effects: `checkout_completed` and `subscription_cancelled` analytics, cancellation and payment-failed emails; `settle()` for renewals/expiry and the yearly reminder 7 days ahead, once per period), `emails.ts`. Every mock event is POSTed through the app's own `/internal/billing/webhook`.
- Settling runs every 10 min while the app is awake (not under `NODE_ENV=test`), after each dev-clock move, and for the caller before `GET /v1/me` and admission.
- Dev clock: in-memory offset per API process (a restart returns to real time); only billing logic reads it.
- Config: `BILLING_PROVIDER=mock`, `BILLING_WEBHOOK_SECRET` (required, ≥ 16 chars), `BILLING_CURRENCY`, `BILLING_PRICE_MONTHLY_MINOR` (999), `BILLING_PRICE_YEARLY_MINOR` (7999), `ENABLE_DEV_CLOCK`.
- Not built: classifying a second instrument on the same song as `extra_instrument` (Plus full requests are always `full_analysis`; both count against the same cap); trials (none in personal mode).

## Open questions
- Company jurisdiction → Stripe Managed Payments eligibility (US, CA, most EU/EEA, GB, CH, AU, HK, JP, SG) or Paddle.
- Free-tier analysis allowance after the first song (0 vs 1–3/month) — decide from Phase 0 and beta data.
- Store fees and payment-processing fees (QK2).

## Sources
- [Better Auth releases and docs (magic link, Apple, passkey; joins Vercel)](https://github.com/better-auth/better-auth/releases) — tier 2, accessed 2026-10-20
- [Stripe pricing](https://stripe.com/pricing), [Stripe Managed Payments](https://docs.stripe.com/payments/managed-payments) and eligibility page — tier 2, accessed 2026-10-20
- [Paddle pricing](https://www.paddle.com/pricing), [Polar pricing](https://polar.sh/resources/pricing), [RevenueCat pricing](https://www.revenuecat.com/pricing/) — tier 2, accessed 2026-10-20
- Cross-linked: `research/product/recommendations-and-decisions.md` D10, `research/market/pricing-and-business-models.md`, `research/users/voice-of-customer-pain-points.md` §3, `research/product/feature-roadmap-beginner-to-intermediate.md` M16.
