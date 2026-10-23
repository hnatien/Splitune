import type { ConfidenceLevel } from '@splitune/ui-tokens'
import type * as React from 'react'
import { cn } from '@/lib/utils'

// Doc 26 §5, §12.2. Chips are music, so they sit on paper with ink in every appearance (a lit
// card in Dark). Confidence is ordinal and never hue: lighter ink, then a dashed outline, then "?".
// Upcoming and past chords are plain names — the outline only appears where a chord is uncertain,
// so the strip reads as text, not a row of boxes. The current chord is set at the larger reading
// size on the current-bar wash with a 2 px loop-edge border; one chip can be selected for editing.

export type ChordTiming = 'past' | 'current' | 'upcoming'

const ink: Record<ConfidenceLevel, string> = {
  high: 'text-ink',
  medium: 'text-conf-medium',
  low: 'text-conf-low',
}

const outline: Record<ConfidenceLevel, string> = {
  high: '',
  medium: 'border-dashed border-conf-medium',
  low: 'border-dashed border-conf-low',
}

type ChordChipProps = Omit<React.ComponentProps<'button'>, 'children'> & {
  /** Display label, e.g. "Am", "Eb", "G7"; set with ♭/♯ glyphs and a raised quality. */
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
      aria-label={
        uncertain && confidenceText ? `${chordText(label)}, ${confidenceText}` : undefined
      }
      className={cn(
        'relative inline-flex min-h-target-practice-2 items-center justify-center rounded-lg border border-transparent bg-paper px-2 py-px font-reading leading-none font-semibold whitespace-nowrap transition-[border-color,background-color] duration-(--duration-base) ease-spring hover:bg-bar-current',
        ink[confidence],
        uncertain && outline[confidence],
        timing === 'current'
          ? 'min-w-[1.6em] border-2 border-solid border-score-loop-edge bg-bar-current px-3 text-read-chord-current font-bold'
          : 'text-read-chord',
        selected && 'outline-2 outline-offset-2 outline-ring outline-solid',
        className,
      )}
      {...props}
    >
      <ChordSymbol name={label} />
      {uncertain && confidence === 'low' && (
        <sup aria-hidden className="ml-0.5 text-[0.55em] font-bold">
          ?
        </sup>
      )}
    </button>
  )
}

// A chord name set as charts print it (26 §12.2): real ♭ and ♯, the quality raised and smaller
// than the root (minor's "m" on the line), a slash bass after it ("E♭maj7", "Am7/G"). Text the pattern doesn't know ("N.C.",
// "?") is shown as it is. Screen readers get the same text, glyphs included ("E flat maj 7").

const NAME = /^([A-G])([b#]*)([^/]*)(?:\/([A-G])([b#]*))?$/

const glyphs = (accidentals: string) => accidentals.replaceAll('b', '♭').replaceAll('#', '♯')
// In the quality only an accidental before a degree is one ("m7b5", "7(#11)").
const qualityGlyphs = (quality: string) => quality.replace(/[b#](?=\d)/g, glyphs)

/** "Ebmaj7/Bb" → "E♭maj7/B♭", "Bm7b5" → "Bm7♭5": a display name with its accidental glyphs. */
export function chordText(name: string): string {
  const match = NAME.exec(name)
  if (!match) return name
  const [, root, accidental = '', quality = '', bass, bassAccidental = ''] = match
  return `${root}${glyphs(accidental)}${qualityGlyphs(quality)}${bass ? `/${bass}${glyphs(bassAccidental)}` : ''}`
}

// The reading fonts have no ♭/♯, so the fallback's glyph is lifted to sit as a chart's does.
function Accidental({ text }: { text: string | undefined }) {
  'use no memo'
  return text ? <span className="relative -top-[0.16em] ml-[0.02em]">{glyphs(text)}</span> : null
}

export function ChordSymbol({ name }: { name: string }) {
  // Cheaper to render than to memoise; it rides in the practice route's JS budget (12 §10).
  'use no memo'
  const match = NAME.exec(name)
  if (!match) return name
  const [, root, accidental, quality = '', bass, bassAccidental] = match
  // Minor's "m" stays on the line ("Am", "Am⁷"); the rest of the quality is raised.
  const minor = /^m(?!aj)/.test(quality)
  const raised = minor ? quality.slice(1) : quality
  return (
    <span data-slot="chord-symbol" className="whitespace-nowrap">
      {root}
      <Accidental text={accidental} />
      {minor && 'm'}
      {raised && (
        <span className="relative -top-[0.36em] ml-0.5 text-[0.68em]">{qualityGlyphs(raised)}</span>
      )}
      {bass && (
        <span className="text-[0.88em]">
          /{bass}
          <Accidental text={bassAccidental} />
        </span>
      )}
    </span>
  )
}

export { ChordChip }
