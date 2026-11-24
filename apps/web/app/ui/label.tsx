import type * as React from 'react'
import { cn } from '@/lib/utils'

/** `.label` (doc 26 §12.1): the label role (14/20 at 500) in the ink, above its field or beside its check. */
function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: callers pass htmlFor or nest the control
    <label
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-label text-foreground select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:text-faint-foreground peer-disabled:cursor-not-allowed peer-disabled:text-faint-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
