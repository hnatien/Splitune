import {
  BillingPlansOutput,
  CheckoutInput,
  MockCheckoutInput,
  MockCheckoutOutput,
  MockPortalInput,
  MockPortalOutput,
  MockSession,
  MockSessionInput,
} from './billing.ts'
import { RedirectOutput } from './common.ts'
import { procedureBase as base } from './router.ts'

// Billing (04 "Billing", 14 §3) in a contract of its own: only the pricing and billing pages load
// its client, so screens that never bill (practice, 10 §9 budget) carry none of its schemas.
export const billingContract = {
  billing: {
    plans: base.route({ method: 'GET', path: '/v1/billing/plans' }).output(BillingPlansOutput),
    checkout: base
      .route({ method: 'POST', path: '/v1/billing/checkout' })
      .input(CheckoutInput)
      .output(RedirectOutput),
    portal: base.route({ method: 'POST', path: '/v1/billing/portal' }).output(RedirectOutput),
    // Personal mode only (25 §2): the mock checkout and portal pages act through these.
    mockSession: base
      .route({ method: 'GET', path: '/v1/billing/mock/session' })
      .input(MockSessionInput)
      .output(MockSession),
    mockCheckout: base
      .route({ method: 'POST', path: '/v1/billing/mock/checkout' })
      .input(MockCheckoutInput)
      .output(MockCheckoutOutput),
    mockPortal: base
      .route({ method: 'POST', path: '/v1/billing/mock/portal' })
      .input(MockPortalInput)
      .output(MockPortalOutput),
  },
}

export type BillingContract = typeof billingContract
