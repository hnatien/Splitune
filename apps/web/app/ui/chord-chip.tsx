import type { ConfidenceLevel } from '@splitune/ui-tokens'
import type * as React from 'react'
import { cn } from '@/lib/utils'

// Doc 26 §5, §12.2. Chips are music, so they sit on paper with ink in every appearance (a lit
// card in Dark). Confidence is ordinal and never hue: lighter ink, then a dashed outline, then "?".
// The current chip is enlarged with a 2 px loop-edge border; one chip can be selected for editing.

export type ChordTiming = 'past' | 'current' | 'upcoming'

const ink: Record<ConfidenceLevel, string> = {
  high: 'text-ink border-solid border-staff',
  medium: 'text-conf-medium border-dashed border-conf-medium',
  low: 'text-conf-low border-dashed border-conf-low',
}

type ChordChipProps = Omit<React.ComponentProps<'button'>, 'children'> & {
  /** Display label, e.g. "Am", "F", "G7". */
  label: string
  confidence: ConfidenceLevel
  timing?: ChordTiming
  /** Open in the editor sheet. */
  selected?: boolean
  /** "Show uncertainty" off removes outlines and the glyph but keeps the ink (§5). */
  showUncertainty?: boolean
  /** Spoken after the label for medium/low confidence ("Am, unsure"); the "?" itself is hidden. */
  confidenceText?: string | undefined
}

function ChordChip({
  label,
  confidence,
  timing = 'upcoming',
  selected = false,
  showUncertainty = true,
  confidenceText,
  className,
  ...props
}: ChordChipProps) {
  const uncertain = showUncertainty && confidence !== 'high'
  return (
    <button
      type="button"
      data-slot="chord-chip"
      data-confidence={confidence}
      data-timing={timing}
      aria-current={timing === 'current' ? 'true' : undefined}
      aria-pressed={selected}
      aria-label={uncertain && confidenceText ? `${label}, ${confidenceText}` : undefined}
      className={cn(
        'relative inline-flex min-h-target-practice-2 min-w-[2.4em] items-center justify-center rounded-lg bg-paper px-3 font-reading leading-none whitespace-nowrap transition-[font-size] duration-(--duration-base) ease-standard',
        ink[confidence],
        uncertain ? 'border-[1.5px]' : 'border-[1.5px] border-solid border-staff',
        timing === 'current'
          ? 'border-2 border-score-loop-edge bg-bar-current text-read-chord-current'
          : 'text-read-chord',
        selected && 'outline-2 outline-offset-2 outline-ring outline-solid',
        className,
      )}
      {...props}
    >
      {label}
      {uncertain && confidence === 'low' && (
        <sup aria-hidden className="ml-0.5 text-[0.55em] font-bold">
          ?
        </sup>
      )}
    </button>
  )
}

export { ChordChip }
