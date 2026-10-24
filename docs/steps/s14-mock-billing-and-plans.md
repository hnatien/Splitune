# Step 14 — Mock billing, Free/Plus entitlements and paywall UX

## Before you start
Read `docs/steps/00-shared-context.md`, then:
- `docs/specs/23-plans-free-and-paid.md` (primary: feature matrix, analysis types, paywall UX rules)
- `docs/specs/14-auth-billing-and-entitlements.md` §2–§4 (entitlement keys, admission check, provider interface, hygiene rules)
- `docs/specs/25-personal-mode.md` §2 (MockBillingProvider spec, dev clock)
- `docs/specs/03-data-model-and-storage.md` (`subscriptions`, `usage_ledger`)
- `docs/specs/27-screens-flows-and-content.md` §3.2 (pricing), §3.9 (Plan & billing settings), §3.10 (upgrade sheet, mock checkout/portal, return states), §5.6 `plan.*` / `billing.*` copy

Prerequisites: Steps 09, 10 (12 for gating practice-depth features later).

## Goal
The Free/Plus split works for real — allowances, admission, priority, locks and upgrade/cancel flows — with purchases simulated end to end through the same webhook path a real provider would use. No card fields anywhere.

## Deliverables
1. **`BillingProvider` interface + `MockBillingProvider`** (`apps/api/src/billing/`): `createCheckout`, `createPortal`, `verifyWebhook`; mock checkout page `/billing/mock-checkout` (plan, price from config, "Demo mode — no real charges", buttons: simulate success / declined / cancel) and mock portal `/billing/mock-portal` (cancel at period end, resume, switch monthly↔yearly, simulate payment failure, simulate refund). Events are HMAC-signed with a local secret and POSTed to `/internal/billing/webhook`; the handler is provider-agnostic and idempotent by event id.
2. **Dev clock:** `POST /internal/dev/clock { advance_days }` (admin/dev only; disabled unless `ENABLE_DEV_CLOCK=true`) affecting billing logic for renewals, expiry, reminders and allowance resets.
3. **Entitlements:** pure `entitlements(user, now)` from `subscriptions` + `usage_ledger` + config (`plan.free.lite_per_month=5`, `plan.plus.full_per_month=15`, Welcome analysis = 1 lifetime, Lite fair use 200 for Plus); `GET /v1/me` returns allowances and reset dates.
4. **Admission** in `POST /v1/analyses` (the hook from step 09): transactional reservation in `usage_ledger`; reversal when the analysis ends `failed` or fallback-only; Welcome analysis auto-applied to a Free user's first Full request; Lite→Full upgrade counts as one Full; re-runs after a Splitune model upgrade don't count; Plus jobs get higher queue priority.
5. **UI** (layouts and copy per doc 27 §3.2, §3.10; `AllowanceMeter` from the kit; demo-mode banner on pricing and checkout; no "most popular" badge; `plan.welcome_available` prompt on the Import page while the Welcome analysis is unused): `/pricing` (Free vs Plus matrix from doc 23 §3, monthly/yearly toggle, no pre-selected annual, no countdowns), allowance meter in the library header ("4 of 5 Lite analyses left · resets 1 Dec"), locks only at points of action (e.g., "Analyse with stems + tab" on a Lite song), upgrade sheet, Settings → Billing (plan, renewal date, one-tap cancel via mock portal). The YouTube embed fallback is never gated.
6. **Emails** to Mailpit/SMTP: renewal reminder 7 days before yearly renewal, payment-failed notice, cancellation confirmation.

## Out of scope
Real payment providers; RevenueCat.

## Acceptance criteria
- Tests: entitlement function table tests (every plan × allowance edge); admission race test (parallel requests never exceed allowance); failed analysis refunds the reservation.
- Playwright: Free user uses Welcome analysis → Lite allowance → hits cap message → upgrades via mock checkout → Full analysis allowed and prioritized → cancels in one tap → access continues to period end → dev clock past period end → back to Free.
- No `<input>` for card data exists anywhere (add a test that scans rendered billing pages).
- Design QA checklist (doc 28 §5) passed for pricing, the upgrade sheet, mock checkout/portal and Settings → Plan & billing; copy matches the `plan.*` / `billing.*` catalogue keys.

## Verification to run and report
`pnpm --filter api test -- billing`, `pnpm --filter web e2e -- --grep billing`, screenshots or Playwright trace of the checkout flow, the card-input scan result.
