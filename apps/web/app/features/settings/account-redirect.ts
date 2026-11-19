import { redirect } from '@tanstack/react-router'

// The old Profile, Plan & billing and Privacy pages (27 §1 route map): Profile and Privacy are
// sections of Account, Plan is its own section. Their URLs keep the return states, and a return
// state names its own page, whichever old URL it arrives on: `?checkout=` is Plan's,
// `?confirm=delete` is Privacy's.
export function toAccount(
  section: 'profile' | 'plan' | 'privacy',
  search: Record<string, unknown>,
) {
  const { checkout, confirm } = search as { checkout?: unknown; confirm?: unknown }
  const kept = checkout === 'success' || checkout === 'cancelled' ? checkout : undefined
  if (kept || section === 'plan') {
    throw redirect({ to: '/settings/plan', search: kept ? { checkout: kept } : {}, replace: true })
  }
  throw redirect({
    to: '/settings/account',
    search: confirm === 'delete' ? { confirm } : {},
    hash: confirm === 'delete' ? 'privacy' : section,
    replace: true,
  })
}
