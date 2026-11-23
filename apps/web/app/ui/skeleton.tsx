import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Placeholder matching the final layout (§13): the --panel well (step 2, whose jobs include
 * skeletons) with a --hover sweep that stops under reduced motion. Size it like what it stands
 * for; a row's skeleton keeps the row's height so nothing shifts when the content arrives.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        'animate-shimmer rounded-field bg-linear-to-r from-panel via-hover to-panel bg-size-[200%_100%]',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
