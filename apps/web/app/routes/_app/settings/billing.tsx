import { createFileRoute } from '@tanstack/react-router'
import { BillingSettings } from '@/features/billing/billing-settings'

// Plan & billing (27 §3.9); `?checkout=` is the mock checkout's return state (27 §3.10).
export const Route = createFileRoute('/_app/settings/billing')({ component: Billing })

function Billing() {
  const { me } = Route.useRouteContext()
  const { checkout }: { checkout?: unknown } = Route.useSearch()
  return (
    <BillingSettings
      me={me}
      checkout={checkout === 'success' || checkout === 'cancelled' ? checkout : undefined}
    />
  )
}
