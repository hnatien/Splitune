import type * as React from 'react'
import { cn } from '@/lib/utils'

// Doc 26 §12.2, 27 §4, s47 direction §5: no box and no fill, just space. A muted icon, an h2 in the
// display role, one sentence, the primary action (the view's one filled control) and an optional
// secondary one, centred.

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
      className={cn('flex flex-col items-center gap-3 px-6 py-16 text-center', className)}
    >
      <span
        data-slot="empty-state-icon"
        className="mb-1 flex text-muted-foreground [&_svg]:size-8 [&_.lucide]:stroke-[1.5]"
      >
        {icon}
      </span>
      {title && <h2 className="text-display text-balance">{title}</h2>}
      <p className="max-w-sm text-body text-pretty text-muted-foreground">{description}</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {action}
        {secondaryAction}
      </div>
    </section>
  )
}

export { EmptyState }
