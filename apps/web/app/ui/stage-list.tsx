import { CircleCheckIcon, CircleDashedIcon, CircleXIcon, TriangleAlertIcon } from 'lucide-react'
import type * as React from 'react'
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { CircleCheckDrawIcon } from '@/ui/icons/check-draw'
import { Progress, ProgressLabel } from '@/ui/progress'
import { ProgressRing } from '@/ui/status'

// Doc 26 §12.2, §13, 27 §3.7.3: the overall bar with "Analysing your song" and the ETA beside it,
// then the stages in order. Each stage is a Status-style glyph (done: a circled check in --success;
// running: the ring that fills; waiting: a dashed circle; a fallback: a triangle; failed: a crossed
// circle in --destructive), no filled dots, then the stage's name (faint while waiting), a detail
// line naming the artefact it leaves ("84 BPM in 4/4, starts on a pickup bar") and its status in
// words ("Done", "about 2 min", "Waiting"). Only the running stage opens its detail on a line of
// its own; a finished one says its result beside its name and a waiting one keeps its detail
// folded, so the list holds one height through the run and fits one screen. Motion marks the
// handoff only: a stage that changes state after the list first rendered pops its new glyph in (a
// finished one draws its tick and its result rises beside its name), its name brightens from
// faint, and the running ring turns while it works; a page opened
// mid-run shows what is already done without replaying it. Reduced motion makes each change
// instant and stills the ring. The list is not a live region; callers announce stage milestones
// once.

export type StageStatus = 'queued' | 'running' | 'done' | 'fallback' | 'failed'

export type Stage = {
  id: string
  /** "Isolating your part" */
  label: string
  status: StageStatus
  /** Status in words ("Done", "Waiting", "about 2 min", "Used a fallback"). */
  statusText: string
  /** What the stage leaves or does ("Separating guitar from the band"). */
  detail?: string | undefined
}

const GLYPH: Record<StageStatus, React.ReactNode> = {
  done: <CircleCheckIcon aria-hidden className="text-success" />,
  running: (
    <span className="grid animate-spin place-items-center [animation-duration:1.6s]">
      <ProgressRing />
    </span>
  ),
  queued: <CircleDashedIcon aria-hidden className="text-faint-foreground" />,
  fallback: <TriangleAlertIcon aria-hidden className="text-muted-foreground" />,
  failed: <CircleXIcon aria-hidden className="text-destructive" />,
}

type StageListProps = {
  stages: Stage[]
  /** Overall progress 0–100 and its label ("Analysing your song"). */
  progress: number
  progressLabel: string
  /** "about 4 min left", beside the label; omitted when no honest estimate exists. */
  eta?: string | undefined
  /** The running stage in words for the bar (`aria-valuetext`). */
  valueText?: string | undefined
  className?: string
}

function StageList({ stages, progress, progressLabel, eta, valueText, className }: StageListProps) {
  // Each stage's status as first rendered: only a change after that animates.
  const first = useRef<Map<string, StageStatus> | null>(null)
  first.current ??= new Map(stages.map((stage) => [stage.id, stage.status]))
  const seen = first.current
  return (
    <div data-slot="stage-list" className={cn('flex flex-col gap-4', className)}>
      <Progress
        value={progress}
        {...(valueText ? { getAriaValueText: () => valueText } : {})}
        className="gap-y-1.5"
      >
        <ProgressLabel className="text-body-sm text-muted-foreground">
          {progressLabel}
        </ProgressLabel>
        {eta && <span className="ml-auto text-body-sm tabular-nums">{eta}</span>}
      </Progress>
      <ol className="flex flex-col">
        {stages.map((stage) => {
          const arrived = seen.get(stage.id) !== stage.status
          const waiting = stage.status === 'queued'
          const settled = !waiting && stage.status !== 'running'
          return (
            <li
              key={stage.id}
              data-status={stage.status}
              className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-3 py-2"
            >
              <span
                key={stage.status}
                data-slot="stage-glyph"
                className={cn(
                  'mt-0.5 grid size-5 place-items-center [&_svg]:size-4 [&_.lucide]:stroke-[1.8]',
                  arrived && 'animate-pop-in',
                )}
              >
                {stage.status === 'done' && arrived ? (
                  <CircleCheckDrawIcon aria-hidden className="text-success" />
                ) : (
                  GLYPH[stage.status]
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span
                    className={cn(
                      'text-label transition-colors duration-(--duration-slow) ease-standard',
                      waiting ? 'text-faint-foreground' : 'text-foreground',
                    )}
                  >
                    {stage.label}
                  </span>
                  {settled && stage.detail && (
                    <span
                      data-slot="stage-result"
                      className={cn(
                        'text-body-sm text-muted-foreground',
                        arrived && 'animate-rise-in',
                      )}
                    >
                      {stage.detail}
                    </span>
                  )}
                </span>
                {stage.detail && (
                  <span
                    data-slot="stage-detail"
                    data-folded={stage.status !== 'running' || undefined}
                    // A settled stage says its result beside its name; this copy only folds away.
                    aria-hidden={settled || undefined}
                    // A settling stage's copy vanishes at once: its result is already beside its name.
                    className={cn(
                      'grid duration-(--duration-slow) ease-standard',
                      settled
                        ? 'transition-[grid-template-rows]'
                        : 'transition-[grid-template-rows,opacity]',
                      stage.status === 'running' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <span className="min-h-0 overflow-hidden">
                      <span className="block pt-0.5 text-body-sm text-muted-foreground">
                        {stage.detail}
                      </span>
                    </span>
                  </span>
                )}
              </span>
              <span className="text-body-sm text-muted-foreground tabular-nums">
                {stage.statusText}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export { StageList }
