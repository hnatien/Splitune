import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * `.kbd` (doc 26 §12.1): JetBrains Mono 12 (it has ⌘ ⇧ ⌥ ↵), 22 tall, a --panel fill and a
 * flat 1 px --border-strong edge. Tooltips and the shortcuts list ("Space", "⇧ ←").
 */
function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5.5 w-fit min-w-5.5 items-center justify-center gap-1 rounded-media border border-border-strong bg-panel px-1.5 font-mono text-caption leading-none font-normal text-muted-foreground tabular-nums select-none [&_svg:not([class*='size-'])]:size-3",
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
