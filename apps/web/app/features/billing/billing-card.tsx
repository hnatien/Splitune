import type * as React from 'react'
import { useId } from 'react'

// The plan block of mock checkout and the mock portal (27 §3.10): the plan as an h2, its price (or
// renewal line) large and a muted note, then the block's own content and actions. One column with
// space between its parts and no rules or box around them (s47 direction §1: whitespace before
// rules).
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
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h2 id={id} className="text-title">
          {title}
        </h2>
        {price && <p className="text-display tabular-nums">{price}</p>}
        {note && <p className="text-body text-pretty text-muted-foreground">{note}</p>}
      </div>
      {children && <div className="flex flex-col gap-4">{children}</div>}
    </section>
  )
}
