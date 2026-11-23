import { Input as InputPrimitive } from '@base-ui/react/input'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Text field (doc 26 §12.1, s47 direction §6): 44 px tall (48 in practice density), 10 px corners,
 * the --background well with a 1 px --edge (≥ 3:1, its only boundary) that turns to the ink on
 * hover and focus; focus lays the 2 px ink outline over that edge (−1 px offset). Text is 15 px,
 * and 16 px on coarse pointers so iOS doesn't zoom into the field. Disabled keeps the edge and
 * fades only the text, with no fill. Invalid fields take a --destructive edge; the message under
 * the field (FieldError) carries the icon and words.
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'min-h-control w-full min-w-0 rounded-field border border-edge bg-background px-4 text-body text-foreground transition-colors duration-(--duration-fast) ease-standard file:inline-flex file:border-0 file:bg-transparent file:text-label-sm file:text-foreground placeholder:text-faint-foreground hover:border-foreground focus-visible:border-foreground focus-visible:-outline-offset-1 pointer-coarse:text-field disabled:cursor-not-allowed disabled:border-edge disabled:bg-transparent disabled:text-faint-foreground aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
