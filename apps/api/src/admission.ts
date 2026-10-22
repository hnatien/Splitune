import { AllowanceExhaustedError } from '@splitune/db'
import { type Admission, admit, loadEntitlements } from './entitlements.ts'
import { apiError } from './errors.ts'
import type { ApiDeps } from './procedures.ts'

// Admission of a new analysis (POST /v1/analyses, rerun, import-url; 14 §2): the user's due
// billing changes first, then entitlements on the billing clock decide the run's kind, priority
// and reservation. `reserving` refuses a new run whose allowance is used up with
// `analysis_cap_reached` (402).
export async function admitAnalysis(
  deps: ApiDeps,
  userId: string,
  type: 'full' | 'lite',
  options: { charged?: boolean } = {},
): Promise<Admission> {
  await deps.billing.settle({ userId })
  const loaded = await loadEntitlements(deps, userId, deps.billing.clock.now())
  if (!loaded) throw apiError('unauthenticated')
  return admit(loaded.ent, type, loaded.limits, options)
}

// Runs the creation that reserves `admission.charge` in the run's own transaction: a new run past
// the allowance (also one that lost a race for the last unit) rolls back into a 402.
export async function reserving<T>(admission: Admission, create: () => Promise<T>): Promise<T> {
  try {
    return await create()
  } catch (error) {
    if (!(error instanceof AllowanceExhaustedError)) throw error
    throw capReached(admission.exhausted)
  }
}

function capReached(details: Admission['exhausted']) {
  return apiError('analysis_cap_reached', {
    message: 'This analysis is not available on your plan right now.',
    details,
  })
}
