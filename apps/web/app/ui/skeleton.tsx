import type * as React from 'react'
import { cn } from '@/lib/utils'

/** Placeholder matching the final layout (§13); the pulse stops under reduced motion. */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn('animate-pulse rounded-md bg-muted motion-reduce:animate-none', className)}
      {...props}
    />
  )
}

export { Skeleton }
