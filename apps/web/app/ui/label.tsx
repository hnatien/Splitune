import type * as React from 'react'
import { cn } from '@/lib/utils'

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: callers pass htmlFor or nest the control
    <label
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-sm leading-5 font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
