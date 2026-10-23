import { useEffect, useRef, useState } from 'react'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ChordChip, type ChordTiming } from '@/ui/chord-chip'
import { ConfidenceLegend, ConfidenceLegendPopover } from '@/ui/confidence-legend'
import { chordsAround } from './model/view-model'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// ChordStrip (12 §2, §4): beat-synchronous chips following the clock, the current one enlarged,
// confidence by ink, dashed border and "?" (never colour alone); tap → editor sheet. The legend
// sits at the end with the "Show uncertainty" switch. Chips that don't fit are clipped inside the
// list, which fades at its end so a cut name doesn't read as a shorter chord (padded by --bleed so
// the scaled current chip and its focus ring show); the list keeps at least 20rem and the legend
// wraps when the strip is narrower than both. Below `lg` a button opens the legend in a popover.

const BEFORE = 1
const AFTER = 5

export function ChordStrip({ legend = true, className }: { legend?: boolean; className?: string }) {
  const { view, audio, data } = usePractice()
  const showUncertainty = usePracticeDefaults((s) => s.showUncertainty)
  const update = usePracticeDefaults((s) => s.update)
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

  const anchor = Math.max(0, index)
  const shown = chords.slice(Math.max(0, anchor - BEFORE), anchor + AFTER + 1)
  // The legend names the transcription's model version (26 §5).
  const model =
    data.notes.data?.models[0]?.version ??
    data.chords.data?.models[0]?.version ??
    data.analysis.data?.pipeline_version ??
    ''

  const legendProps = {
    text: m['practice.legend']({ model }),
    labels: {
      showUncertainty: m['practice.show_uncertainty'](),
      medium: m['practice.probably'](),
      low: m['practice.unsure'](),
    },
    showUncertainty,
    onShowUncertaintyChange: (show: boolean) => update({ showUncertainty: show }),
  }

  return (
    <div
      data-slot="chord-strip"
      className={cn(
        'flex min-h-[5.5rem] shrink-0 items-center gap-3 overflow-hidden border-b border-border px-(--bleed) py-2 [--bleed:calc(var(--spacing)*6)] in-data-[distance=floor]:min-h-[6.5rem] in-data-[distance=floor]:[--bleed:calc(var(--spacing)*14)] in-data-[distance=stand]:[--bleed:calc(var(--spacing)*8)] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-(--duration-base) motion-safe:ease-enter',
        className,
      )}
    >
      <ol
        aria-label={m['practice.chords']()}
        className="-m-(--bleed) flex min-w-80 flex-1 items-center gap-5 overflow-hidden p-(--bleed) mask-r-from-[calc(100%-var(--spacing)*6)] in-data-[distance=floor]:gap-10 in-data-[distance=stand]:gap-7"
      >
        {shown.map((chord) => {
          const position = chords.indexOf(chord)
          const timing: ChordTiming =
            position === index ? 'current' : position < index ? 'past' : 'upcoming'
          return (
            <li key={chord.id}>
              <ChordChip
                label={chord.name}
                confidence={chord.confidence}
                timing={timing}
                showUncertainty={showUncertainty}
                confidenceText={
                  chord.confidence === 'low' ? m['practice.unsure']() : m['practice.probably']()
                }
                onClick={() =>
                  usePracticeUi.setState({
                    editor: { kind: 'bar', bar: chord.bar, chordId: chord.id },
                  })
                }
              />
            </li>
          )
        })}
      </ol>
      {legend && (
        <>
          <ConfidenceLegend className="hidden lg:inline-flex" {...legendProps} />
          <ConfidenceLegendPopover
            className="lg:hidden"
            buttonLabel={m['practice.legend_button']()}
            {...legendProps}
          />
        </>
      )}
    </div>
  )
}
