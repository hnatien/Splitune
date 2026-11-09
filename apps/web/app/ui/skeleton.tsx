import type * as React from 'react'
import { cn } from '@/lib/utils'

/** Placeholder matching the final layout (§13); the sweep stops under reduced motion. */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        'animate-shimmer rounded-lg bg-linear-to-r from-muted via-accent to-muted bg-size-[200%_100%]',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
