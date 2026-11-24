import { CheckIcon, RotateCcwIcon } from 'lucide-react'
import type * as React from 'react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { CheckDrawIcon } from '@/ui/icons/check-draw'
import { Kbd } from '@/ui/kbd'

// Doc 26 §12.2, 27 §3.7.1, s47 direction §6–§7: "Not yet" and "Felt clean" — competence
// evidence, never a score or streak. Two outline pills at the practice target (48), Not yet first
// and Felt clean second, as the pedal reads them (left means again, right means go), each with
// its key cap on fine pointers (N, C). It sits inside the transport, never over the music: after
// a looped pass (`prompting`) it takes the loop line's place on wide screens, or the full-width
// status row on phones, as "How was pass 3?" then the pair, fading in. The row wraps, so when
// the room runs out the question takes its own line above the answers. Otherwise it shows the
// best clean tempo before the pair; a new best draws a tick before it. Neither answer is filled:
// Play stays the one filled control on the screen.

type PassControlProps = {
  labels: {
    /** Names the group ("Rate this pass", or the question). */
    prompt: string
    clean: string
    notYet: string
  }
  /** "Best clean pass: 85 %", or undefined before the first clean pass. */
  best?: string | undefined
  /** "How was pass 3?", shown while that pass is being asked about. */
  question?: string | undefined
  /** A pass is waiting for its answer: the question shows in place of the best tempo. */
  prompting?: boolean
  shortcuts?: { clean?: string; notYet?: string }
  onClean: () => void
  onNotYet: () => void
  disabled?: boolean
  /** Out of reach of the pointer, keyboard and assistive tech (a reserved, hidden slot). */
  inert?: boolean
  /** Phones: icon-only answers (the labels stay their names). */
  compact?: boolean
  className?: string
}

function Answer({
  label,
  icon,
  shortcut,
  compact,
  disabled,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  shortcut: string | undefined
  compact: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Button
      size={compact ? 'icon-practice' : 'practice'}
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      aria-keyshortcuts={shortcut}
      className={cn('shrink-0', !compact && 'px-4')}
    >
      {icon}
      {compact ? <span className="sr-only">{label}</span> : label}
      {shortcut && (
        <Kbd aria-hidden className="pointer-coarse:hidden">
          {shortcut}
        </Kbd>
      )}
    </Button>
  )
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
  className,
}: PassControlProps) {
  // The tick follows a change of best, not the best a song opens with.
  const [seen, setSeen] = useState(best)
  const [improved, setImproved] = useState(false)
  if (best !== seen) {
    setSeen(best)
    if (best !== undefined) setImproved(true)
  }
  const asking = prompting && question !== undefined
  return (
    <fieldset
      data-slot="pass-control"
      data-prompting={asking || undefined}
      inert={inert}
      className={cn(
        'm-0 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-0 p-0',
        asking &&
          'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-(--duration-base) motion-safe:ease-enter',
        className,
      )}
    >
      <legend className="sr-only">{asking ? question : labels.prompt}</legend>
      {asking && (
        <span
          aria-hidden
          data-slot="pass-question"
          className="min-w-0 flex-[1_1_auto] truncate pr-1 text-body-sm text-foreground tabular-nums"
        >
          {question}
        </span>
      )}
      {!asking && best && (
        <p
          className="mr-1 flex items-center gap-1 text-body-sm text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          {improved && <CheckDrawIcon key={best} aria-hidden className="size-5 text-success" />}
          {best}
        </p>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-2">
        <Answer
          label={labels.notYet}
          icon={<RotateCcwIcon aria-hidden />}
          shortcut={shortcuts?.notYet}
          compact={compact}
          disabled={disabled}
          onClick={onNotYet}
        />
        <Answer
          label={labels.clean}
          icon={<CheckIcon aria-hidden />}
          shortcut={shortcuts?.clean}
          compact={compact}
          disabled={disabled}
          onClick={onClean}
        />
      </span>
    </fieldset>
  )
}

export { PassControl }
