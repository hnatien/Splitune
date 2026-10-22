import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { plansQuery } from '@/features/billing/plans'
import { PricingPage } from '@/features/billing/pricing-page'
import { m } from '@/lib/i18n'
import { InlineError } from '@/ui/status-message'

// Pricing (27 §3.2): plans and prices from the provider (14 §3), rendered on the server. The
// loader sits in every page's entry chunk (10 §9), so it loads the billing client when it runs.
export const Route = createFileRoute('/_marketing/pricing')({
  loader: async ({ context }) => {
    const billing = await import('@/features/billing/plans')
    await context.queryClient.prefetchQuery(billing.plansQuery)
  },
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['pricing.title']() }) }] }),
  component: Pricing,
})

function Pricing() {
  const { me } = Route.useRouteContext()
  const plans = useQuery(plansQuery)
  if (!plans.data) {
    return (
      <div className="mx-auto w-full max-w-reading px-4 py-12">
        {plans.isError && <InlineError title={m['plan.prices_failed']()} />}
      </div>
    )
  }
  return <PricingPage me={me} plans={plans.data} />
}
