import { createFileRoute, notFound } from '@tanstack/react-router'
import { MockCheckout } from '@/features/billing/mock-checkout'
import { MockPortal } from '@/features/billing/mock-portal'
import { m } from '@/lib/i18n'

// Mock checkout and portal (27 §3.10, 25 §2): /billing/mock-checkout and /billing/mock-portal,
// one route so the app's entry chunk stays small (10 §9). Sessions belong to the account that
// opened them; anyone else (or a signed-out visitor) gets the expired-link state.
export const Route = createFileRoute('/_bare/billing/$view')({
  head: ({ params }) => ({
    meta: [
      {
        title: m['meta.page']({
          page:
            params.view === 'mock-portal'
              ? m['billing.portal_title']()
              : m['billing.checkout_title'](),
        }),
      },
    ],
  }),
  component: Billing,
})

function Billing() {
  const { view } = Route.useParams()
  if (view !== 'mock-checkout' && view !== 'mock-portal') throw notFound()
  const search: { session?: unknown } = Route.useSearch()
  const session = typeof search.session === 'string' ? search.session : ''
  return view === 'mock-portal' ? (
    <MockPortal session={session} />
  ) : (
    <MockCheckout session={session} />
  )
}
