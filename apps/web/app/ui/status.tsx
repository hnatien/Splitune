import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  ClockAlertIcon,
  CloudOffIcon,
  ListMusicIcon,
  PauseCircleIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * What a thing's state is, by the shape of its glyph: a check in a circle, a ring that fills, a
 * dashed circle, a warning triangle, a cross in a circle, lines of music, a struck clock, a pause,
 * a struck cloud. Green and red are only added to the two glyphs that mean them.
 */
export type StatusKind =
  | 'ready'
  | 'working'
  | 'queued'
  | 'attention'
  | 'failed'
  | 'partial'
  | 'expired'
  | 'paused'
  | 'offline'

const GLYPH = {
  ready: CircleCheckIcon,
  queued: CircleDashedIcon,
  attention: TriangleAlertIcon,
  failed: CircleXIcon,
  partial: ListMusicIcon,
  expired: ClockAlertIcon,
  paused: PauseCircleIcon,
  offline: CloudOffIcon,
} as const satisfies Record<Exclude<StatusKind, 'working'>, React.ComponentType>

const TONE: Partial<Record<StatusKind, string>> = {
  ready: 'text-success',
  failed: 'text-destructive',
}

/** A 16 px ring that fills clockwise with `value` (0–1); without a value it shows a quarter arc. */
function ProgressRing({ value }: { value?: number | undefined }) {
  const share = value === undefined ? 0.25 : Math.min(1, Math.max(0, value))
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="size-4 shrink-0 -rotate-90">
      <circle cx="8" cy="8" r="6" fill="none" stroke="var(--edge)" strokeWidth="2" />
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={`${share} 1`}
      />
    </svg>
  )
}

/**
 * Status (doc 26 §12.2): a glyph and the words that say it ("Ready", "Analysing · about 3 min",
 * "Chords only"). No pill and no tint: the shape of the glyph carries the state, the words name
 * it, and hue only joins in for ready and failed.
 */
function Status({
  kind,
  progress,
  className,
  children,
  ...props
}: React.ComponentProps<'span'> & {
  kind: StatusKind
  /** For `working`: the share done, 0–1. */
  progress?: number
}) {
  const Glyph = kind === 'working' ? null : GLYPH[kind]
  return (
    <span
      data-slot="status"
      data-kind={kind}
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 text-label-sm text-muted-foreground',
        className,
      )}
      {...props}
    >
      <span className={cn('inline-flex shrink-0 text-foreground', TONE[kind])}>
        {Glyph ? (
          <Glyph aria-hidden className="size-4 stroke-[1.8]" />
        ) : (
          <ProgressRing value={progress} />
        )}
      </span>
      <span className="min-w-0 truncate tabular-nums">{children}</span>
    </span>
  )
}

export { ProgressRing, Status }
