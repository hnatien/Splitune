import { PauseIcon, RepeatIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'

// Doc 26 §12.2: "Loop · bars 17–20 · pass 3" in the top bar. States differ by icon, text, border
// style and fill, never by colour alone — off (sunken, no edge), armed (dashed edge: A tapped,
// waiting for B), active (solid 2 px edge on a raised fill), resting (active, muted text, pause icon).

export type LoopState = 'off' | 'armed' | 'active' | 'resting'

const styles: Record<LoopState, string> = {
  off: 'border-transparent bg-surface-sunken text-foreground contrast-more:border-input',
  armed: 'border-dashed border-loop-edge bg-surface-sunken text-foreground',
  active: 'border-loop-edge bg-surface-raised text-foreground shadow-1',
  resting: 'border-loop-edge bg-surface-raised text-muted-foreground shadow-1',
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
