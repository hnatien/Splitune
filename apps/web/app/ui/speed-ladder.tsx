import type * as React from 'react'
import { cn } from '@/lib/utils'
import { createIcon } from '@/ui/icons/create'
import { PopoverTrigger } from '@/ui/popover'

// Doc 26 §12.2, §12.3, s47 direction §4: the speed ladder's rungs from start to goal, 70 px tall
// and rising to the goal. Done = the ink fill with a paper label; current = a 2 px ink edge, ink
// label, no fill; upcoming = a hairline --edge (≥ 3:1) with a faint label, no fill. Fill, edge
// width and label differ, so the state never rests on colour alone (forced colours draw the edges
// as borders); the group's name says it in words ("70 percent done, 75 percent now, 80 percent
// next"). Labels are 11 px tabular figures, never smaller. A long ladder shows the rungs around
// the current one.

/** The most rungs drawn at once; a longer ladder shows a window around the current rung. */
const MAX_RUNGS = 9
/** The first rung's height; the last one fills the box. */
const FIRST_HEIGHT_PCT = 66

function windowOf(count: number, current: number): [from: number, to: number] {
  if (count <= MAX_RUNGS) return [0, count]
  // One done rung stays in view before the current one; the window never runs past the goal.
  const from = Math.max(0, Math.min(current - 1, count - MAX_RUNGS))
  return [from, from + MAX_RUNGS]
}

type SpeedLadderProps = {
  /** Every rung in percent, start to goal. */
  rungs: readonly number[]
  /** Index of the rung the speed stands on; the ones before it are done. */
  current: number
  /** The whole ladder in words (catalogue text). */
  label: string
  className?: string
}

function SpeedLadder({ rungs, current, label, className }: SpeedLadderProps) {
  const [from, to] = windowOf(rungs.length, current)
  const last = Math.max(1, rungs.length - 1)
  return (
    <div
      role="img"
      aria-label={label}
      data-slot="speed-ladder"
      className={cn('flex h-17.5 items-end gap-1', className)}
    >
      {rungs.slice(from, to).map((pct, offset) => {
        const index = from + offset
        const state = index < current ? 'done' : index === current ? 'current' : 'upcoming'
        return (
          <div
            key={pct}
            aria-hidden
            data-state={state}
            style={{
              height: `${FIRST_HEIGHT_PCT + ((100 - FIRST_HEIGHT_PCT) * index) / last}%`,
            }}
            className={cn(
              'flex min-w-0 flex-1 items-start justify-center rounded-media pt-1.25 transition-[background-color,box-shadow] duration-(--duration-fast) ease-standard',
              state === 'done' &&
                'bg-primary text-primary-foreground inset-ring inset-ring-primary forced-colors:border',
              state === 'current' &&
                'text-foreground inset-ring-2 inset-ring-selected forced-colors:border-3',
              state === 'upcoming' &&
                'text-faint-foreground inset-ring inset-ring-edge forced-colors:border',
            )}
          >
            <span className="text-kbd tabular-nums">{pct}</span>
          </div>
        )
      })}
    </div>
  )
}

/** The ladder mark (Main.dc.html): four steps rising to the right. */
const LadderIcon = createIcon('ladder', [['path', { d: 'M4 20h4v-4h4v-4h4V8h4', key: 'steps' }]])

/**
 * A ladder parameter chip ("Start 70 %", "Goal 100 %", "Step 5 %", "3 clean passes", "More")
 * that opens its stepper: a 32 px pill with a hairline edge painted inside a 48 px box (§8); while
 * its stepper is open the edge is the 1.5 px ink.
 */
function LadderChip({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PopoverTrigger>) {
  return (
    <PopoverTrigger
      data-slot="ladder-chip"
      className={cn(
        'group/chip inline-flex min-h-target-practice items-center rounded-full focus-visible:outline-offset-[-6px]',
        className,
      )}
      {...props}
    >
      <span className="inline-flex h-8 items-center rounded-full px-3 text-label-sm whitespace-nowrap text-muted-foreground tabular-nums inset-ring inset-ring-border-strong transition-[color,background-color,box-shadow] duration-(--duration-fast) ease-standard group-hover/chip:bg-hover group-hover/chip:text-foreground group-aria-expanded/chip:text-foreground group-aria-expanded/chip:inset-ring-[1.5px] group-aria-expanded/chip:inset-ring-selected">
        {children}
      </span>
    </PopoverTrigger>
  )
}

export { LadderChip, LadderIcon, SpeedLadder }
