import type { ConfidenceLevel } from '@splitune/ui-tokens'
import type * as React from 'react'
import { cn } from '@/lib/utils'

// Doc 26 §5, §12.2. Chips are music, so they sit on paper with ink in every appearance (a lit
// card in Dark). Confidence is ordinal and never hue: lighter ink, then a dashed outline, then "?".
// The current chip is enlarged with a 2 px loop-edge border; one chip can be selected for editing.
// Every chip is set at the chord size and the current one is scaled by the ratio of the two reading
// sizes at the distance (2/1.375 at Desk, 3/2 at Stand, 5.5/3.5 at Floor), so the emphasis eases in
// without reflowing the strip; the strip leaves room for the scaled chip.

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
        'relative inline-flex min-h-target-practice-2 min-w-[2.4em] origin-center items-center justify-center rounded-lg bg-paper px-3 py-px font-reading text-read-chord leading-none whitespace-nowrap transition-[scale,border-color,background-color] duration-(--duration-base) ease-spring',
        ink[confidence],
        uncertain ? 'border' : 'border border-solid border-staff',
        // The 2 px border takes 1 px from each side's padding, so the chip keeps its size.
        timing === 'current' &&
          'z-1 scale-[1.45] border-2 border-score-loop-edge bg-bar-current px-[calc(var(--spacing)*3-1px)] py-0 in-data-[distance=floor]:scale-[1.57] in-data-[distance=stand]:scale-[1.5]',
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
