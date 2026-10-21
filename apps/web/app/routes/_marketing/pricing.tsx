import { createFileRoute, Link } from '@tanstack/react-router'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/ui/button'
import { Banner } from '@/ui/status-message'

// Pricing stub (27 §3.2): the plan matrix and mock checkout arrive with step 14.
export const Route = createFileRoute('/_marketing/pricing')({
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['pricing.title']() }) }] }),
  component: Pricing,
})

function Pricing() {
  return (
    <div className="flex flex-col">
      <Banner tone="info" title={m['billing.demo']()} />
      <div className="mx-auto flex max-w-reading flex-col gap-4 px-4 py-12">
        <h1 className="text-4xl">{m['pricing.title']()}</h1>
        <p className="text-lg text-muted-foreground">{m['pricing.free_body']()}</p>
        <p className="text-base text-muted-foreground">{m['pricing.coming']()}</p>
        <Link to="/start" className={cn(buttonVariants({ variant: 'primary' }), 'self-start')}>
          {m['home.cta_example']()}
        </Link>
      </div>
    </div>
  )
}
