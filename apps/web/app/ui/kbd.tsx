import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * `.kbd` (doc 26 §12.1): a key cap. 11 px at 500 in the mono face (it has ⌘ ⇧ ⌥ ↵), 20 px tall,
 * a flat 1 px --border-strong edge and no fill, so a cap printed on a control reads as a label
 * and not as a second button. Beside every action that has a key, in tooltips and in the list.
 */
function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-media border border-border-strong px-1 font-mono text-kbd leading-none text-muted-foreground tabular-nums select-none [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn('inline-flex items-center gap-1', className)}
      {...props}
    />
  )
}

export { Kbd, KbdGroup }
