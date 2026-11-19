import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * One figure with its label (26 §12.2 StatCard): the value at text-xl in tabular figures, the
 * label under it. A term/description pair, so a row of them sits in a `<dl>` (StatCards).
 */
export function StatCard({
  value,
  label,
  className,
}: {
  value: string
  label: string
  className?: string
}) {
  return (
    <div
      data-slot="stat-card"
      className={cn('flex min-w-0 flex-col-reverse rounded-xl border border-border p-3', className)}
    >
      <dt className="text-sm text-faint-foreground">{label}</dt>
      <dd className="text-xl tabular-nums">{value}</dd>
    </div>
  )
}

/** Three stat cards in a row (the Progress tab's cold start, clean passes and minutes). */
export function StatCards({ className, ...props }: React.ComponentProps<'dl'>) {
  return <dl className={cn('m-0 grid grid-cols-3 gap-2', className)} {...props} />
}
