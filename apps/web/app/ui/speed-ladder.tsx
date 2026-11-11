import type * as React from 'react'
import { cn } from '@/lib/utils'
import { createIcon } from '@/ui/icons/create'
import { PopoverTrigger } from '@/ui/popover'

// Doc 26 §12.2, §12.3 (`.ladder`, Main.dc.html): the speed ladder's rungs from start to goal, 70 px
// tall and rising to the goal. Done = amber fill with a 1 px --signal edge and graphite label (the
// edge keeps done apart from upcoming in Daylight, V16), current = --primary-soft with a 2 px inset
// --signal ring, upcoming = --accent. Fill, edge and ring differ, so the state never rests on
// colour alone (forced colours draw the ring as a border: thin for done, thick for current); the
// group's name says it in words ("70 percent done, 75 percent now, 80 percent
// next"). Labels are mono 11 px (V10). A long ladder shows the rungs around the current one.

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
              'flex min-w-0 flex-1 items-start justify-center rounded-xs pt-1.25 font-mono text-2xs tabular-nums transition-colors duration-(--duration-fast)',
              state === 'done' &&
                'bg-primary text-primary-foreground inset-ring inset-ring-signal forced-colors:border',
              state === 'current' &&
                'bg-primary-soft text-primary-ink inset-ring-2 inset-ring-signal forced-colors:border-3',
              state === 'upcoming' && 'bg-accent text-faint-foreground',
            )}
          >
            {pct}
          </div>
        )
      })}
    </div>
  )
}

/** The ladder mark (Main.dc.html): four steps rising to the right. */
const LadderIcon = createIcon('ladder', [['path', { d: 'M4 20h4v-4h4v-4h4V8h4', key: 'steps' }]])

/**
 * A ladder parameter chip (`.chip`: "Start 70 %", "Goal 100 %", "Step 5 %", "3 clean passes",
 * "More") that opens its stepper: a 30 px pill painted inside a 48 px box, the secondary practice
 * target (§8, V12).
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
        'group/chip inline-flex min-h-target-practice-2 items-center rounded-full focus-visible:outline-offset-[-7px]',
        className,
      )}
      {...props}
    >
      <span className="inline-flex h-7.5 items-center rounded-full border border-border-strong px-2.75 text-sm font-medium whitespace-nowrap text-muted-foreground tabular-nums transition-colors duration-(--duration-fast) group-hover/chip:bg-muted group-hover/chip:text-foreground group-aria-expanded/chip:border-primary-line group-aria-expanded/chip:bg-primary-soft group-aria-expanded/chip:text-primary-ink">
        {children}
      </span>
    </PopoverTrigger>
  )
}

export { LadderChip, LadderIcon, SpeedLadder }
