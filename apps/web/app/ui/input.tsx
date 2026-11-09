import { Input as InputPrimitive } from '@base-ui/react/input'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * `.field` (doc 26 §12.1): 44 px tall (48 in practice density), the --background well with an
 * --input edge, focus 1 px off the edge. Invalid fields take a --destructive edge; the message
 * under the field (FieldError) carries the icon and words.
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'min-h-control w-full min-w-0 rounded-lg border border-input bg-background px-3.5 text-base text-foreground transition-colors file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-foreground placeholder:text-faint-foreground focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:bg-muted disabled:text-faint-foreground aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
