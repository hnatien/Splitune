import { CircleDashedIcon, CircleXIcon, TriangleAlertIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { CircleCheckDrawIcon } from '@/ui/icons/check-draw'
import { Progress, ProgressLabel, ProgressValue } from '@/ui/progress'
import { Spinner } from '@/ui/spinner'

// Doc 26 §12.2, §13: named stages with status icon + text, an honest ETA on the running stage and a
// determinate overall bar. The running stage gets an indeterminate bar of its own (decorative: the
// ETA in words is the information) and a finished stage's tick draws itself. The list is not a live
// region; callers announce stage changes once.

export type StageStatus = 'queued' | 'running' | 'done' | 'fallback' | 'failed'

const STATUS: Record<StageStatus, { icon: React.ReactNode; tone: string }> = {
  queued: { icon: <CircleDashedIcon aria-hidden />, tone: 'text-muted-foreground' },
  running: { icon: <Spinner />, tone: 'text-primary' },
  done: { icon: <CircleCheckDrawIcon aria-hidden />, tone: 'text-success' },
  fallback: { icon: <TriangleAlertIcon aria-hidden />, tone: 'text-warning' },
  failed: { icon: <CircleXIcon aria-hidden />, tone: 'text-destructive' },
}

export type Stage = {
  id: string
  /** "Separating your part" */
  label: string
  status: StageStatus
  /** Status in words ("Done", "Queued", "About 2 min left", "Used a fallback"). */
  statusText: string
}

type StageListProps = {
  stages: Stage[]
  /** Overall progress 0–100 and its label ("Analysing your song"). */
  progress: number
  progressLabel: string
  className?: string
}

function StageList({ stages, progress, progressLabel, className }: StageListProps) {
  return (
    <div data-slot="stage-list" className={cn('flex flex-col gap-4', className)}>
      <Progress value={progress}>
        <ProgressLabel>{progressLabel}</ProgressLabel>
        <ProgressValue />
      </Progress>
      <ol className="flex flex-col gap-1">
        {stages.map((stage) => (
          <li
            key={stage.id}
            data-status={stage.status}
            className="flex min-h-target flex-col justify-center gap-1"
          >
            <div className="flex items-center gap-3 text-base">
              <span
                className={cn(
                  'grid shrink-0 place-items-center [&_svg]:size-5',
                  STATUS[stage.status].tone,
                )}
              >
                {STATUS[stage.status].icon}
              </span>
              <span className="flex-1 font-medium">{stage.label}</span>
              <span className="text-sm text-muted-foreground tabular-nums">{stage.statusText}</span>
            </div>
            {stage.status === 'running' && (
              <div aria-hidden className="pl-8">
                <Progress value={null} />
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

export { StageList }
