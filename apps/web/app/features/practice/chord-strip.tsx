import { ArrowRightIcon } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ChordChip, type ChordTiming } from '@/ui/chord-chip'
import { type ChordModel, chordsAround } from './model/view-model'
import { useShownView } from './notation-pane'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// The diagram and the level/capo popover load on demand (12 §10 route budget).
const ChordShape = lazy(() =>
  import('./chord-shape').then((module) => ({ default: module.ChordShape })),
)
const ScoreTools = lazy(() =>
  import('./score-tools').then((module) => ({ default: module.ScoreTools })),
)
const PianoStrip = lazy(() =>
  import('./piano-strip').then((module) => ({ default: module.PianoStrip })),
)
const PhraseStrip = lazy(() =>
  import('./phrase-strip').then((module) => ({ default: module.PhraseStrip })),
)

// ChordStrip (12 §2, §4): the top of the paper — "now → next". The current chord follows the clock
// at the larger reading size with its guitar shape beside it; the next chords run after it as
// plain names, confidence by ink, dashed outline and "?" (never colour alone); tap any → editor
// sheet. Level and capo sit at the strip's end. The names that don't fit fade out at the end, so
// a cut name doesn't read as a shorter chord; the list's padding keeps focus rings unclipped.
// Piano gets its own strip with the voicing on a keyboard (piano-strip.tsx), except on phones;
// over vocals' melody the strip follows the phrases instead (phrase-strip.tsx).

const AFTER = 6

export function ChordStrip({
  compact = false,
  className,
}: {
  /** Phone landscape: no diagram, no level/capo. */
  compact?: boolean
  className?: string
}) {
  const { view, audio, layers, data, options } = usePractice()
  // Phones in portrait show the glance view instead, so the desktop default stands for the rest.
  const shown = useShownView('desktop')
  const melody = layers.melody && shown === 'tab'
  const showUncertainty = usePracticeDefaults((s) => s.showUncertainty)
  const chords = view?.chords ?? []
  const [index, setIndex] = useState(-1)
  const last = useRef(-2)
  useEffect(() => {
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const at = chordsAround(chords, audio.position())
      const current = at.current ? at.index : -1
      if (current !== last.current) {
        last.current = current
        setIndex(current)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [chords, audio])

  const current = chords[index]
  const upcoming = chords.slice(index + 1, index + 1 + AFTER)
  const chip = (chord: ChordModel, timing: ChordTiming) => (
    <ChordChip
      label={chord.name}
      confidence={chord.confidence}
      timing={timing}
      showUncertainty={showUncertainty}
      confidenceText={
        chord.confidence === 'low' ? m['practice.unsure']() : m['practice.probably']()
      }
      onClick={() =>
        usePracticeUi.setState({ editor: { kind: 'bar', bar: chord.bar, chordId: chord.id } })
      }
    />
  )

  return (
    <div
      data-slot="chord-strip"
      className={cn(
        'flex min-h-18 shrink-0 items-center gap-4 border-b border-border bg-paper px-4 py-2 text-ink motion-safe:animate-in motion-safe:fade-in motion-safe:duration-(--duration-base) motion-safe:ease-enter in-data-[distance=floor]:min-h-26',
        className,
      )}
    >
      {melody ? (
        <Suspense fallback={null}>
          <PhraseStrip compact={compact} />
        </Suspense>
      ) : layers.chords && data.instrument === 'piano' && !compact ? (
        <Suspense fallback={null}>
          <PianoStrip chip={chip} />
        </Suspense>
      ) : layers.chords ? (
        <ol
          aria-label={m['practice.chords']()}
          className="-m-1.5 flex min-w-0 flex-1 items-center gap-2 overflow-hidden p-1.5 mask-r-from-[calc(100%-var(--spacing)*8)] in-data-[distance=stand]:gap-4"
        >
          {current && (
            <li className="flex shrink-0 items-center gap-3 pr-2">
              {chip(current, 'current')}
              {!compact && data.instrument === 'guitar' && (
                <Suspense fallback={null}>
                  <ChordShape
                    className="aspect-[60/72] h-[calc(var(--read-chord-current)*1.3)] shrink-0 text-ink"
                    label={current.label}
                    name={current.name}
                    capo={options.capo}
                  />
                </Suspense>
              )}
              <ArrowRightIcon aria-hidden className="size-6 shrink-0 text-staff" />
            </li>
          )}
          {upcoming.map((chord) => (
            <li key={chord.id} className="shrink-0">
              {chip(chord, 'upcoming')}
            </li>
          ))}
        </ol>
      ) : null}
      {layers.tab && !compact && (
        <Suspense fallback={null}>
          <ScoreTools />
        </Suspense>
      )}
    </div>
  )
}
