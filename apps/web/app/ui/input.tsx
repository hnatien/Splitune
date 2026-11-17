import { Input as InputPrimitive } from '@base-ui/react/input'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Text field (doc 26 §12.1): 44 px tall (48 in practice density), 12 px corners, the --background
 * well with an --input edge that turns to the ink on hover and focus. Hover adds a 1 px inset ring
 * so the 2 px edge stays solid round the corners, where a lone 1 px curve anti-aliases to grey;
 * focus lays the outline over the edge instead. Invalid fields take a
 * --destructive edge; the message under the field (FieldError) carries the icon and words.
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'min-h-control w-full min-w-0 rounded-xl border border-input bg-background px-4 text-base text-foreground transition-[border-color,box-shadow] duration-(--duration-base) hover:border-foreground hover:inset-ring hover:inset-ring-foreground focus-visible:border-foreground file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-faint-foreground focus-visible:-outline-offset-1 disabled:cursor-not-allowed disabled:bg-muted disabled:text-faint-foreground disabled:inset-ring-0 aria-invalid:border-destructive aria-invalid:inset-ring-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
