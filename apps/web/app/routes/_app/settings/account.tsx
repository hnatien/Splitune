import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AccountSettings } from '@/features/settings/account-settings'

// Account (27 §3.9): Profile, Privacy and Sign out. `?confirm=delete` is where Google
// re-authentication for account deletion returns, with the confirmation open.
export const Route = createFileRoute('/_app/settings/account')({
  validateSearch: z.object({
    confirm: z.literal('delete').optional().catch(undefined),
  }),
  component: Account,
})

function Account() {
  const { me } = Route.useRouteContext()
  const { confirm } = Route.useSearch()
  return <AccountSettings me={me} deleteDialog={confirm === 'delete' ? 'confirm' : undefined} />
}
