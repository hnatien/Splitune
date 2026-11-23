import type * as React from 'react'
import { useId } from 'react'

// The plan block of mock checkout and the mock portal (27 §3.10): a hairline, the plan as an h2,
// its price (or renewal line) large and a muted note, then another hairline and the block's own
// actions. One column, no box.
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
    <section aria-labelledby={id} className="flex flex-col border-t border-border">
      <div className="flex flex-col gap-1.5 py-6">
        <h2 id={id} className="text-heading">
          {title}
        </h2>
        {price && <p className="text-display tabular-nums">{price}</p>}
        {note && <p className="text-body text-muted-foreground">{note}</p>}
      </div>
      {children && (
        <div className="flex flex-col gap-4 border-t border-border pt-6">{children}</div>
      )}
    </section>
  )
}
