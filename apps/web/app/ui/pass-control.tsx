import { CheckIcon, RotateCcwIcon } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { CheckDrawIcon } from '@/ui/icons/check-draw'
import { Kbd } from '@/ui/kbd'
import { WithTooltip } from '@/ui/tooltip'

// Doc 26 §12.2, 27 §3.7.1, §5.5: "Felt clean" / "Not yet" at the main practice size (64, V11) —
// competence evidence, never a score or streak.
// - `prompt` (desktop, Main.dc.html): the pass prompt, a floating sheet with the question "Pass 2 at
//   75 % — how was it?", Felt clean (the view's primary, check icon, `C`) and Not yet (`N`).
// - `inline` (tablets and phones until s43): the pair in the transport with the best clean tempo; a
//   new best draws a tick before it, and while a pass is being asked about the question shows above
//   the best and the group is ringed.

type PassControlProps = {
  labels: {
    /** Names the group ("Rate this pass", or the question). */
    prompt: string
    clean: string
    notYet: string
  }
  /** "Best clean pass: 85 %", or undefined before the first clean pass (inline). */
  best?: string | undefined
  /** "Pass 2 at 75 % — how was it?", shown while that pass is being asked about. */
  question?: string | undefined
  /** A pass is waiting for its answer: rings the tray (inline). */
  prompting?: boolean
  shortcuts?: { clean?: string; notYet?: string }
  onClean: () => void
  onNotYet: () => void
  disabled?: boolean
  /** Out of reach of the pointer, keyboard and assistive tech (a reserved, hidden slot). */
  inert?: boolean
  /** Phones: icon-only answers (the labels stay their names and tooltips). */
  compact?: boolean
  variant?: 'inline' | 'prompt'
  className?: string
}

function PassControl({
  labels,
  best,
  question,
  prompting = false,
  shortcuts,
  onClean,
  onNotYet,
  disabled = false,
  inert = false,
  compact = false,
  variant = 'inline',
  className,
}: PassControlProps) {
  // The tick follows a change of best, not the best a song opens with.
  const [seen, setSeen] = useState(best)
  const [improved, setImproved] = useState(false)
  if (best !== seen) {
    setSeen(best)
    if (best !== undefined) setImproved(true)
  }
  if (variant === 'prompt') {
    return (
      <fieldset
        data-slot="pass-prompt"
        inert={inert}
        className={cn(
          'm-0 flex items-center gap-3 rounded-4xl border border-border bg-card py-2.5 pr-2.5 pl-5 whitespace-nowrap shadow-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-(--duration-base) motion-safe:ease-enter',
          className,
        )}
      >
        <legend className="sr-only">{labels.prompt}</legend>
        {question && <span className="text-base font-semibold">{question}</span>}
        <Button
          size="practice"
          variant="primary"
          disabled={disabled}
          onClick={onClean}
          className="gap-2 px-5"
        >
          <CheckIcon aria-hidden />
          {labels.clean}
          {shortcuts?.clean && (
            <Kbd aria-hidden className="border-current/35 bg-transparent text-current">
              {shortcuts.clean}
            </Kbd>
          )}
        </Button>
        <Button
          size="practice"
          variant="secondary"
          disabled={disabled}
          onClick={onNotYet}
          className="gap-2 px-5"
        >
          {labels.notYet}
          {shortcuts?.notYet && <Kbd aria-hidden>{shortcuts.notYet}</Kbd>}
        </Button>
      </fieldset>
    )
  }
  return (
    <fieldset
      data-slot="pass-control"
      inert={inert}
      className={cn(
        'm-0 flex flex-wrap items-center gap-2 rounded-3xl border-0 p-1',
        prompting && 'ring-2 ring-signal',
        className,
      )}
    >
      <legend className="sr-only">{labels.prompt}</legend>
      {(best || (prompting && question)) && (
        <div className="mx-2 flex flex-col items-end">
          {prompting && question && (
            <p aria-hidden className="text-read-label font-semibold text-foreground">
              {question}
            </p>
          )}
          {best && (
            <p
              className="flex items-center gap-1 text-sm text-muted-foreground tabular-nums"
              aria-live="polite"
            >
              {improved && <CheckDrawIcon key={best} aria-hidden className="size-5 text-success" />}
              {best}
            </p>
          )}
        </div>
      )}
      <WithTooltip label={labels.clean} shortcut={shortcuts?.clean}>
        <Button
          size={compact ? 'icon-practice' : 'practice'}
          variant="primary"
          disabled={disabled}
          onClick={onClean}
          aria-label={compact ? labels.clean : undefined}
          className="px-4"
        >
          <CheckIcon aria-hidden />
          {!compact && labels.clean}
        </Button>
      </WithTooltip>
      <WithTooltip label={labels.notYet} shortcut={shortcuts?.notYet}>
        <Button
          size={compact ? 'icon-practice' : 'practice'}
          variant="secondary"
          disabled={disabled}
          onClick={onNotYet}
          aria-label={compact ? labels.notYet : undefined}
          className="px-4"
        >
          <RotateCcwIcon aria-hidden />
          {!compact && labels.notYet}
        </Button>
      </WithTooltip>
    </fieldset>
  )
}

export { PassControl }
