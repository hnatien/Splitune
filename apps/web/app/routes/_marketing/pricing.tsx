import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { plansQuery } from '@/features/billing/plans'
import { PricingPage, PricingUnavailable } from '@/features/billing/pricing-page'
import { m } from '@/lib/i18n'

// Pricing (27 §3.2): plans and prices from the provider (14 §3), rendered on the server. The
// loader sits in every page's entry chunk (10 §9), so it loads the billing client when it runs.
// Prices that fail to load stay on the page, in the marketing shell.
export const Route = createFileRoute('/_marketing/pricing')({
  loader: async ({ context }) => {
    const billing = await import('@/features/billing/plans')
    await context.queryClient.prefetchQuery(billing.plansQuery)
  },
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['nav.pricing']() }) }] }),
  component: Pricing,
})

function Pricing() {
  const { me } = Route.useRouteContext()
  const plans = useQuery(plansQuery)
  if (!plans.data) {
    return (
      <PricingUnavailable
        signedIn={me !== null}
        failed={plans.isError}
        onRetry={() => plans.refetch()}
      />
    )
  }
  return <PricingPage me={me} plans={plans.data} />
}
