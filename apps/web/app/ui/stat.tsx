import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Stat (doc 26 §12.2): a figure over its label, with no card around it ("1 h 14 / practised").
 * Figures are tabular so a row of them lines up and a changing one never shifts its neighbours.
 */
function Stat({
  value,
  label,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
  value: React.ReactNode
  label: React.ReactNode
}) {
  return (
    <div data-slot="stat" className={cn('flex min-w-0 flex-col gap-0.5', className)} {...props}>
      <span className="text-heading tabular-nums">{value}</span>
      <span className="text-caption text-muted-foreground">{label}</span>
    </div>
  )
}

/** Stats side by side, separated by space only. */
function Stats({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="stats"
      className={cn('flex flex-wrap items-start gap-x-8 gap-y-4', className)}
      {...props}
    />
  )
}

export { Stat, Stats }
