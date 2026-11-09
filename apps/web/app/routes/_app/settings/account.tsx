import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AccountSettings } from '@/features/settings/account-settings'

// Account (27 §3.9): Profile, Plan, Privacy and Sign out. `?checkout=` is the mock checkout's
// return state (27 §3.10); `?confirm=delete` is where Google re-authentication for account
// deletion returns, with the confirmation open.
export const Route = createFileRoute('/_app/settings/account')({
  validateSearch: z.object({
    checkout: z.enum(['success', 'cancelled']).optional().catch(undefined),
    confirm: z.literal('delete').optional().catch(undefined),
  }),
  component: Account,
})

function Account() {
  const { me } = Route.useRouteContext()
  const { checkout, confirm } = Route.useSearch()
  return (
    <AccountSettings
      me={me}
      checkout={checkout}
      deleteDialog={confirm === 'delete' ? 'confirm' : undefined}
    />
  )
}
