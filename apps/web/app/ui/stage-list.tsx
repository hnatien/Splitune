import { CheckIcon, CircleXIcon, TriangleAlertIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Progress, ProgressLabel } from '@/ui/progress'
import { Spinner } from '@/ui/spinner'

// Doc 26 §12.2, §13, 27 §3.7.3 (Practice-Ready.dc.html): the overall bar with "Analysing your song"
// and the ETA beside it, then the stages in order — a 22 px status dot (done: --success with a
// check; running: a spinner on --primary-soft; waiting: an --input ring; a fallback or failure
// carries its icon), the stage's name (600; faint while waiting), a detail line naming the
// artefact it leaves ("84 BPM in 4/4, starts on a pickup bar") and its status in words ("Done",
// "about 2 min", "Waiting"). The list is not a live region; callers announce stage milestones once.

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

const DOT: Record<StageStatus, { className: string; icon: React.ReactNode }> = {
  done: {
    className: 'bg-success text-background',
    icon: <CheckIcon aria-hidden strokeWidth={2.6} className="size-3.5" />,
  },
  running: {
    className: 'bg-primary-soft text-primary-ink',
    icon: <Spinner className="size-3.5" />,
  },
  queued: { className: 'border-2 border-input', icon: null },
  fallback: {
    className: 'bg-warning-surface text-warning',
    icon: <TriangleAlertIcon aria-hidden className="size-3.5" />,
  },
  failed: {
    className: 'bg-destructive-surface text-destructive',
    icon: <CircleXIcon aria-hidden className="size-3.5" />,
  },
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
  return (
    <div data-slot="stage-list" className={cn('flex flex-col gap-4', className)}>
      <Progress
        value={progress}
        {...(valueText ? { getAriaValueText: () => valueText } : {})}
        className="gap-y-1.5"
      >
        <ProgressLabel className="text-sm font-normal text-muted-foreground">
          {progressLabel}
        </ProgressLabel>
        {eta && <span className="ml-auto font-mono text-sm tabular-nums">{eta}</span>}
      </Progress>
      <ol className="flex flex-col">
        {stages.map((stage) => (
          <li
            key={stage.id}
            data-status={stage.status}
            className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-x-2.5 py-1.75"
          >
            <span
              className={cn(
                'mt-px grid size-5.5 place-items-center rounded-full',
                DOT[stage.status].className,
              )}
            >
              {DOT[stage.status].icon}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span
                className={cn(
                  'text-base font-semibold',
                  stage.status === 'queued' && 'text-faint-foreground',
                )}
              >
                {stage.label}
              </span>
              {stage.detail && (
                <span className="text-sm text-faint-foreground">{stage.detail}</span>
              )}
            </span>
            <span className="font-mono text-sm text-muted-foreground tabular-nums">
              {stage.statusText}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export { StageList }
