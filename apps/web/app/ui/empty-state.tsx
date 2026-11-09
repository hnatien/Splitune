import type * as React from 'react'
import { cn } from '@/lib/utils'

// Doc 26 §12.2, 27 §4: a dashed drop-style panel (`.drop`) with an icon, an h2 in the h3 size, one
// sentence, the primary action and an optional secondary one.

type EmptyStateProps = {
  icon: React.ReactNode
  title?: string | undefined
  description: string
  /** The single primary action (a primary Button). */
  action: React.ReactNode
  /** Optional secondary path, e.g. "Try an example". */
  secondaryAction?: React.ReactNode
  className?: string
}

function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <section
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center gap-3.5 rounded-4xl border-2 border-dashed border-border-strong bg-card px-6 py-8 text-center',
        className,
      )}
    >
      <span className="text-faint-foreground [&_svg]:size-7">{icon}</span>
      {title && <h2 className="text-lg">{title}</h2>}
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {action}
        {secondaryAction}
      </div>
    </section>
  )
}

export { EmptyState }
