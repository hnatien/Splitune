import { CheckIcon, RotateCcwIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { WithTooltip } from '@/ui/tooltip'

// Doc 26 §12.2, 27 §5.5: "Felt clean" / "Not yet" at practice size plus the best clean tempo —
// competence evidence, never a score or streak.

type PassControlProps = {
  labels: {
    /** "How was that pass?" — names the group. */
    prompt: string
    clean: string
    notYet: string
  }
  /** "Best clean pass: 85 %", or undefined before the first clean pass. */
  best?: string | undefined
  shortcuts?: { clean?: string; notYet?: string }
  onClean: () => void
  onNotYet: () => void
  disabled?: boolean
  className?: string
}

function PassControl({
  labels,
  best,
  shortcuts,
  onClean,
  onNotYet,
  disabled = false,
  className,
}: PassControlProps) {
  return (
    <fieldset
      data-slot="pass-control"
      className={cn('flex flex-wrap items-center gap-3 border-0 p-0', className)}
    >
      <legend className="sr-only">{labels.prompt}</legend>
      {best && (
        <p className="mr-1 text-read-label text-foreground tabular-nums" aria-live="polite">
          {best}
        </p>
      )}
      <WithTooltip label={labels.clean} shortcut={shortcuts?.clean}>
        <Button
          size="practice"
          variant="outline"
          disabled={disabled}
          onClick={onClean}
          className="border-2 border-success text-success hover:bg-muted"
        >
          <CheckIcon aria-hidden />
          {labels.clean}
        </Button>
      </WithTooltip>
      <WithTooltip label={labels.notYet} shortcut={shortcuts?.notYet}>
        <Button size="practice" variant="outline" disabled={disabled} onClick={onNotYet}>
          <RotateCcwIcon aria-hidden />
          {labels.notYet}
        </Button>
      </WithTooltip>
    </fieldset>
  )
}

export { PassControl }
