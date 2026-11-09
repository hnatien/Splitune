import type * as React from 'react'
import { cn } from '@/lib/utils'

/** `.label` (doc 26 §12.1): 13/600 --muted-foreground. */
function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: callers pass htmlFor or nest the control
    <label
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-sm font-semibold text-muted-foreground select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:text-faint-foreground peer-disabled:cursor-not-allowed peer-disabled:text-faint-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
