import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PlanSettings } from '@/features/billing/billing-settings'

// Plan (27 §3.9, §3.10): the plan, its renewal and its actions. `?checkout=` is the mock
// checkout's return state.
export const Route = createFileRoute('/_app/settings/plan')({
  validateSearch: z.object({
    checkout: z.enum(['success', 'cancelled']).optional().catch(undefined),
  }),
  component: Plan,
})

function Plan() {
  const { me } = Route.useRouteContext()
  const { checkout } = Route.useSearch()
  return <PlanSettings me={me} checkout={checkout} />
}
