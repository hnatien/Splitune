import { CheckIcon, RotateCcwIcon } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { CheckDrawIcon } from '@/ui/icons/check-draw'
import { WithTooltip } from '@/ui/tooltip'

// Doc 26 §12.2, 27 §5.5: "Felt clean" / "Not yet" at practice size plus the best clean tempo —
// competence evidence, never a score or streak. A new best draws a tick before it; while a pass is
// being asked about, the tray is ringed.

type PassControlProps = {
  labels: {
    /** "How was that pass?" — names the group. */
    prompt: string
    clean: string
    notYet: string
  }
  /** "Best clean pass: 85 %", or undefined before the first clean pass. */
  best?: string | undefined
  /** A pass is waiting for its answer: rings the tray. */
  prompting?: boolean
  shortcuts?: { clean?: string; notYet?: string }
  onClean: () => void
  onNotYet: () => void
  disabled?: boolean
  /** Out of reach of the pointer, keyboard and assistive tech (a reserved, hidden slot). */
  inert?: boolean
  className?: string
}

function PassControl({
  labels,
  best,
  prompting = false,
  shortcuts,
  onClean,
  onNotYet,
  disabled = false,
  inert = false,
  className,
}: PassControlProps) {
  // The tick follows a change of best, not the best a song opens with.
  const [seen, setSeen] = useState(best)
  const [improved, setImproved] = useState(false)
  if (best !== seen) {
    setSeen(best)
    if (best !== undefined) setImproved(true)
  }
  return (
    <fieldset
      data-slot="pass-control"
      inert={inert}
      className={cn(
        'flex flex-wrap items-center gap-1.5 rounded-2xl border-0 bg-surface-sunken p-1',
        prompting && 'ring-2 ring-primary',
        className,
      )}
    >
      <legend className="sr-only">{labels.prompt}</legend>
      {best && (
        <p
          className="mx-2 flex items-center gap-1 text-read-label text-foreground tabular-nums"
          aria-live="polite"
        >
          {improved && <CheckDrawIcon key={best} aria-hidden className="size-5 text-success" />}
          {best}
        </p>
      )}
      <WithTooltip label={labels.clean} shortcut={shortcuts?.clean}>
        <Button
          size="practice"
          variant="outline"
          disabled={disabled}
          onClick={onClean}
          className="rounded-2xl border-2 border-success bg-surface-raised px-3 text-success shadow-1 hover:bg-muted"
        >
          <CheckIcon aria-hidden />
          {labels.clean}
        </Button>
      </WithTooltip>
      <WithTooltip label={labels.notYet} shortcut={shortcuts?.notYet}>
        <Button
          size="practice"
          variant="outline"
          disabled={disabled}
          onClick={onNotYet}
          className="rounded-2xl bg-surface-raised px-3 shadow-1"
        >
          <RotateCcwIcon aria-hidden />
          {labels.notYet}
        </Button>
      </WithTooltip>
    </fieldset>
  )
}

export { PassControl }
