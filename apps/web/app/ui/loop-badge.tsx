import { PauseIcon, RepeatIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'

// Doc 26 §12.2: "Loop · bars 17–20 · pass 3" in the top bar. States differ by icon, border style
// and fill — off (outline), armed (dashed: A tapped, waiting for B), active (indigo), resting.

export type LoopState = 'off' | 'armed' | 'active' | 'resting'

const styles: Record<LoopState, string> = {
  off: 'border-input bg-card text-foreground',
  armed: 'border-dashed border-primary bg-card text-foreground',
  active: 'border-primary bg-accent text-accent-foreground',
  resting: 'border-input bg-muted text-foreground',
}

function LoopBadge({
  state,
  children,
  className,
  ...props
}: React.ComponentProps<'button'> & {
  state: LoopState
  /** Formatted catalogue text, e.g. "Loop · bars 17–20 · pass 3". */
  children: React.ReactNode
}) {
  const Icon = state === 'resting' ? PauseIcon : RepeatIcon
  return (
    <button
      type="button"
      data-slot="loop-badge"
      data-state={state}
      className={cn(
        'inline-flex min-h-target min-w-0 items-center gap-2 rounded-full border-2 px-4 font-semibold whitespace-nowrap tabular-nums text-read-bar-number hover:bg-muted [&_svg]:size-[1.1em] [&_svg]:shrink-0',
        styles[state],
        className,
      )}
      {...props}
    >
      <Icon aria-hidden />
      <span className="truncate">{children}</span>
    </button>
  )
}

export { LoopBadge }
