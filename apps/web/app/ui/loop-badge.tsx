import { PauseIcon, RepeatIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Kbd } from '@/ui/kbd'

// Doc 26 §12.2, s47 direction §6: the loop line in the transport, a 48 px pill ("Bars 5–8 · 70 %"
// with an optional second line, "pass 2 · rest 1 beat"). States differ by edge, icon and words,
// never by colour or a fill: off (a hairline edge, muted text: "No loop · tap two bars"), armed
// (a dashed ink edge: bar A tapped, waiting for B), active (the 1.5 px ink edge, ink text) and
// resting (active with a pause icon). Its key cap is printed on fine pointers.

export type LoopState = 'off' | 'armed' | 'active' | 'resting'

const styles: Record<LoopState, string> = {
  off: 'text-muted-foreground inset-ring-border-strong hover:bg-hover hover:text-foreground',
  armed:
    'border-[1.5px] border-dashed border-selected text-foreground inset-ring-transparent hover:bg-hover',
  active: 'text-foreground inset-ring-[1.5px] inset-ring-selected hover:bg-hover',
  resting: 'text-foreground inset-ring-[1.5px] inset-ring-selected hover:bg-hover',
}

function LoopBadge({
  state,
  children,
  detail,
  shortcut,
  className,
  ...props
}: React.ComponentProps<'button'> & {
  state: LoopState
  /** Formatted catalogue text, e.g. "Bars 5–8 · 70 %". */
  children: React.ReactNode
  /** The second line ("pass 2 · rest 1 beat", "tap two bars, or a section"). */
  detail?: React.ReactNode
  /** The key that opens or toggles the loop ("L"), printed as a key cap on fine pointers. */
  shortcut?: string | undefined
}) {
  const Icon = state === 'resting' ? PauseIcon : RepeatIcon
  return (
    <button
      type="button"
      data-slot="loop-badge"
      data-state={state}
      aria-keyshortcuts={shortcut}
      className={cn(
        'inline-flex min-h-target-practice min-w-0 items-center gap-2 rounded-full px-4 text-left text-label whitespace-nowrap inset-ring transition-[color,background-color,box-shadow] duration-(--duration-fast) ease-standard [&_svg]:size-5 [&_svg]:shrink-0',
        styles[state],
        className,
      )}
      {...props}
    >
      <Icon aria-hidden strokeWidth={1.8} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate tabular-nums">
          {children}
          {/* Read as one name: "Bars 5–8 · 70 %, pass 2 · rest 1 beat". The comma is plain inline
              text painted clear: Chrome reads a positioned or inline-block one with a space before. */}
          {detail && <span className="opacity-0 select-none">,</span>}
        </span>
        {detail && (
          <span className="truncate text-caption text-muted-foreground tabular-nums">{detail}</span>
        )}
      </span>
      {shortcut && (
        <Kbd aria-hidden className="pointer-coarse:hidden">
          {shortcut}
        </Kbd>
      )}
    </button>
  )
}

export { LoopBadge }
