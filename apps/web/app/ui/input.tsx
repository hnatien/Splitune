import { Input as InputPrimitive } from '@base-ui/react/input'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/** Text field: 44 px tall (48 in practice density), 16 px text so iOS never zooms on focus. */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'min-h-control w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground transition-colors file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:border-2',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
