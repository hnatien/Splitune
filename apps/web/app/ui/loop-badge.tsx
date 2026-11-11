import { PauseIcon, RepeatIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'

// Doc 26 §12.2 (the loop pill, Main.dc.html): a main practice control, 64 px tall (V11), with the
// loop on its first line and the pass and rest under it ("Loop · bars 25–28" / "pass 2 · rest 1
// beat"; off "No loop" / "tap two bars, or a section"). States differ by icon, text, edge and
// fill, never by colour alone: off (quiet, solid edge), armed (dashed loop edge: A tapped,
// waiting for B), active (amber wash, amber line, amber ink), resting (active with a pause icon).

export type LoopState = 'off' | 'armed' | 'active' | 'resting'

const styles: Record<LoopState, string> = {
  off: 'bg-muted text-foreground inset-ring-border-strong hover:bg-accent',
  armed:
    'border-2 border-dashed border-loop-edge bg-muted text-foreground inset-ring-transparent hover:bg-accent',
  active:
    'bg-primary-soft text-primary-ink inset-ring-primary-line forced-colors:bg-card forced-colors:inset-ring-signal',
  resting:
    'bg-primary-soft text-primary-ink inset-ring-primary-line forced-colors:bg-card forced-colors:inset-ring-signal',
}

function LoopBadge({
  state,
  children,
  detail,
  className,
  ...props
}: React.ComponentProps<'button'> & {
  state: LoopState
  /** Formatted catalogue text, e.g. "Loop · bars 17–20". */
  children: React.ReactNode
  /** The second line ("pass 2 · rest 1 beat", "tap two bars, or a section"). */
  detail?: React.ReactNode
}) {
  const Icon = state === 'resting' ? PauseIcon : RepeatIcon
  return (
    <button
      type="button"
      data-slot="loop-badge"
      data-state={state}
      className={cn(
        'inline-flex min-h-target-practice min-w-0 items-center gap-2.5 rounded-2xl px-4 text-left text-md font-semibold whitespace-nowrap inset-ring transition-colors duration-(--duration-fast) [&_svg]:size-5 [&_svg]:shrink-0',
        styles[state],
        className,
      )}
      {...props}
    >
      <Icon aria-hidden strokeWidth={1.8} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate tabular-nums">
          {children}
          {/* Read as one name: "Loop · bars 25–28, pass 2 · rest 1 beat". The comma is plain inline
              text painted clear: Chrome reads a positioned or inline-block one with a space before. */}
          {detail && <span className="opacity-0 select-none">,</span>}
        </span>
        {detail && <span className="truncate text-sm font-medium tabular-nums">{detail}</span>}
      </span>
    </button>
  )
}

export { LoopBadge }
