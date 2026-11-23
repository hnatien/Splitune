import type { ConfidenceLevel } from '@splitune/ui-tokens'
import type * as React from 'react'
import { cn } from '@/lib/utils'

// Doc 26 §5, §12.2, s47 direction §4. Chips are music, so they sit on the page with ink in every
// appearance, and every chord name stays ink whatever its confidence. Confidence is ordinal and
// never hue alone: "Probably" adds a 1.5 px dotted box in `--conf-medium-edge`; "Unsure" a 1.5 px
// dashed box and a "?" in `--conf-low-edge`, the only place the unsure hue appears; "Edited" a
// 2 px underline in `--edited`. With uncertainty hidden the name is plain ink. In the strip
// (`name`) the chords are plain names; the current chord is set at the larger reading size on the
// current-bar wash with a 2 px ink line under it (the wash is never there without the line). The
// one chip open in the editor (`selected`) has the 1.5 px ink edge. `pill` is the Now column's
// "Then" chip: a pill with a hairline edge at `--read-chord`, painted inside a 48 px box (26 §8).

export type ChordTiming = 'past' | 'current' | 'upcoming'

const outline: Record<ConfidenceLevel, string> = {
  high: '',
  medium: 'border-[1.5px] border-dotted border-conf-medium-edge',
  low: 'border-[1.5px] border-dashed border-conf-low-edge',
}

type ChordChipProps = Omit<React.ComponentProps<'button'>, 'children'> & {
  /** Display label, e.g. "Am", "Eb", "G7"; set with ♭/♯ glyphs and a raised quality. */
  label: string
  confidence: ConfidenceLevel
  timing?: ChordTiming
  /** Open in the editor sheet. */
  selected?: boolean
  /** Corrected by the learner: a 2 px underline (§5). */
  edited?: boolean
  /** "Show uncertainty" off removes the boxes and the glyph but keeps the ink (§5). */
  showUncertainty?: boolean
  /** Spoken after the label for medium/low confidence ("Am, unsure"); the "?" itself is hidden. */
  confidenceText?: string | undefined
  /** Spoken after the label for an edited chord ("Am, edited"). */
  editedText?: string | undefined
  variant?: 'name' | 'pill'
}

/** The "?" after an unsure name, in the unsure hue. */
function Unsure() {
  return (
    <sup
      aria-hidden
      data-slot="unsure-glyph"
      className="ml-0.5 text-[0.55em] font-medium text-conf-low-edge"
    >
      ?
    </sup>
  )
}

function ChordChip({
  label,
  confidence,
  timing = 'upcoming',
  selected = false,
  edited = false,
  showUncertainty = true,
  confidenceText,
  editedText,
  variant = 'name',
  className,
  ...props
}: ChordChipProps) {
  const uncertain = showUncertainty && confidence !== 'high'
  const spoken = [
    chordText(label),
    uncertain ? confidenceText : undefined,
    edited ? editedText : undefined,
  ].filter(Boolean)
  const name = spoken.length > 1 ? spoken.join(', ') : undefined
  const symbol = (
    <span
      data-slot="chord-name"
      className={cn(edited && 'underline decoration-edited decoration-2 underline-offset-[0.18em]')}
    >
      <ChordSymbol name={label} />
    </span>
  )
  if (variant === 'pill') {
    return (
      <button
        type="button"
        data-slot="chord-chip"
        data-variant="pill"
        data-confidence={confidence}
        aria-pressed={selected}
        aria-label={name}
        className={cn(
          'group/chip inline-flex min-h-target-practice items-center rounded-full',
          className,
        )}
        {...props}
      >
        <span
          data-slot="chord-face"
          className={cn(
            'inline-flex items-center rounded-full px-3 py-1 font-reading text-read-chord leading-none whitespace-nowrap text-ink inset-ring transition-[background-color,box-shadow] duration-(--duration-fast) ease-standard group-hover/chip:bg-hover',
            uncertain ? outline[confidence] : 'border-[1.5px] border-transparent',
            selected ? 'inset-ring-[1.5px] inset-ring-selected' : 'inset-ring-border-strong',
          )}
        >
          {symbol}
          {uncertain && confidence === 'low' && <Unsure />}
        </span>
      </button>
    )
  }
  return (
    <button
      type="button"
      data-slot="chord-chip"
      data-confidence={confidence}
      data-timing={timing}
      aria-current={timing === 'current' ? 'true' : undefined}
      aria-pressed={selected}
      aria-label={name}
      className={cn(
        'relative inline-flex min-h-target-practice min-w-target-practice items-center justify-center rounded-field border-[1.5px] border-transparent bg-paper px-2 py-px font-reading leading-none whitespace-nowrap text-ink inset-ring inset-ring-transparent transition-[border-color,background-color,box-shadow] duration-(--duration-base) ease-enter hover:bg-hover',
        uncertain && outline[confidence],
        timing === 'current'
          ? 'min-w-[1.6em] bg-bar-current px-3 text-read-chord-current after:pointer-events-none after:absolute after:inset-x-2 after:bottom-1 after:h-0.5 after:rounded-full after:bg-score-loop-edge'
          : 'text-read-chord',
        selected && 'inset-ring-[1.5px] inset-ring-selected',
        className,
      )}
      {...props}
    >
      {symbol}
      {uncertain && confidence === 'low' && <Unsure />}
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
