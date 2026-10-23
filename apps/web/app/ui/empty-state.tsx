import type * as React from 'react'
import { cn } from '@/lib/utils'

// Doc 26 §12.2: icon, one-sentence explanation, one primary action, optional example.

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
        'mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-12 text-center',
        className,
      )}
    >
      <span className="grid size-16 place-items-center rounded-2xl bg-surface-sunken text-muted-foreground [&_svg]:size-8">
        {icon}
      </span>
      {title && <h2 className="text-xl">{title}</h2>}
      <p className="text-base text-muted-foreground">{description}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {action}
        {secondaryAction}
      </div>
    </section>
  )
}

export { EmptyState }
