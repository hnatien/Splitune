import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * `.kbd` (doc 26 §12.1): JetBrains Mono 12 (it has ⌘ ⇧ ⌥ ↵), 22 tall, a --muted fill and a
 * --border-strong edge with a 2 px bottom. Tooltips and the shortcuts list ("Space", "⇧ ←").
 */
function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5.5 w-fit min-w-5.5 items-center justify-center gap-1 rounded-xs border border-b-2 border-border-strong bg-muted px-1.5 font-mono text-xs leading-none font-normal text-muted-foreground tabular-nums select-none [&_svg:not([class*='size-'])]:size-3",
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
