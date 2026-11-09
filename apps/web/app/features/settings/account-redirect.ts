import { redirect } from '@tanstack/react-router'

// The old Profile, Plan & billing and Privacy pages are sections of Account now (27 §1 route map):
// their URLs land on the section's anchor and keep the return states. A return state names its own
// section, whichever old URL it arrives on: `?checkout=` is Plan's, `?confirm=delete` is Privacy's.
export function toAccount(
  section: 'profile' | 'plan' | 'privacy',
  search: Record<string, unknown>,
) {
  const { checkout, confirm } = search as { checkout?: unknown; confirm?: unknown }
  const kept: { checkout?: 'success' | 'cancelled'; confirm?: 'delete' } = {}
  if (checkout === 'success' || checkout === 'cancelled') kept.checkout = checkout
  if (confirm === 'delete') kept.confirm = confirm
  throw redirect({
    to: '/settings/account',
    search: kept,
    hash: kept.checkout ? 'plan' : kept.confirm ? 'privacy' : section,
    replace: true,
  })
}
