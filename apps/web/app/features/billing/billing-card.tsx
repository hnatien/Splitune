import type * as React from 'react'
import { Card } from '@/ui/card'

// The Pricing card style (27 §3.2, §3.10; Pricing.dc.html) for mock checkout and the mock portal:
// the plan as an h2, its price (or renewal line) large, a muted note, then the card's own actions.
export function BillingCard({
  title,
  price,
  note,
  children,
}: {
  title: string
  price?: string | undefined
  note?: string | undefined
  children?: React.ReactNode
}) {
  return (
    <Card className="gap-4.5 p-7 max-sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl">{title}</h2>
        {price && <p className="text-2xl tabular-nums">{price}</p>}
        {note && <p className="text-base text-muted-foreground">{note}</p>}
      </div>
      {children}
    </Card>
  )
}
