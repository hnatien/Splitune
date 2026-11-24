import { CircleCheckIcon, CircleDashedIcon, CircleXIcon, TriangleAlertIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Progress, ProgressLabel } from '@/ui/progress'
import { ProgressRing } from '@/ui/status'

// Doc 26 §12.2, §13, 27 §3.7.3: the overall bar with "Analysing your song" and the ETA beside it,
// then the stages in order. Each stage is a Status-style glyph (done: a circled check in --success;
// running: the ring that fills; waiting: a dashed circle; a fallback: a triangle; failed: a crossed
// circle in --destructive), no filled dots, then the stage's name (faint while waiting), a detail
// line naming the artefact it leaves ("84 BPM in 4/4, starts on a pickup bar") and its status in
// words ("Done", "about 2 min", "Waiting"). The list is not a live region; callers announce stage
// milestones once.

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
  running: <ProgressRing />,
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
        {stages.map((stage) => (
          <li
            key={stage.id}
            data-status={stage.status}
            className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-3 py-2"
          >
            <span
              data-slot="stage-glyph"
              className="mt-0.5 grid size-5 place-items-center [&_svg]:size-4 [&_.lucide]:stroke-[1.8]"
            >
              {GLYPH[stage.status]}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span
                className={cn(
                  'text-label',
                  stage.status === 'queued' ? 'text-faint-foreground' : 'text-foreground',
                )}
              >
                {stage.label}
              </span>
              {stage.detail && (
                <span className="text-body-sm text-muted-foreground">{stage.detail}</span>
              )}
            </span>
            <span className="text-body-sm text-muted-foreground tabular-nums">
              {stage.statusText}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export { StageList }
