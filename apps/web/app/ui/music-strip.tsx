import type * as React from 'react'
import { cn } from '@/lib/utils'

export type MusicStripSection = {
  /** Start and end as shares of the song, 0–1. */
  start: number
  end: number
  label: string
}

const BARS = 48

/** `levels` resampled to `count` columns by taking the peak of each column's span. */
export function stripColumns(levels: readonly number[], count = BARS): number[] {
  if (levels.length === 0) return []
  return Array.from({ length: count }, (_, column) => {
    const from = Math.floor((column * levels.length) / count)
    const to = Math.max(from + 1, Math.floor(((column + 1) * levels.length) / count))
    let peak = 0
    for (let i = from; i < to && i < levels.length; i += 1) peak = Math.max(peak, levels[i] ?? 0)
    return Math.min(1, Math.max(0, peak))
  })
}

/**
 * MusicStrip (doc 26 §12.2): a song as its music, small enough for a list row. The waveform as
 * bars when its levels are known, with a tick at each section start and the part already
 * practised in ink; with no levels yet, the sections alone as a ruled line. Decorative next to
 * the song's title, so it is hidden from assistive technology unless given a label.
 */
function MusicStrip({
  levels,
  sections = [],
  progress,
  label,
  className,
  ...props
}: Omit<React.ComponentProps<'svg'>, 'children'> & {
  /** Peak levels, 0–1, in time order. */
  levels?: readonly number[]
  sections?: readonly MusicStripSection[]
  /** The share of the song already practised, 0–1: drawn in ink. */
  progress?: number
  label?: string
}) {
  const columns = stripColumns(levels ?? [])
  const width = BARS * 3
  const played = progress === undefined ? 0 : Math.min(1, Math.max(0, progress))
  return (
    <svg
      data-slot="music-strip"
      viewBox={`0 0 ${width} 24`}
      preserveAspectRatio="none"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('h-6 w-36 shrink-0', className)}
      {...props}
    >
      {columns.length > 0 ? (
        columns.map((level, column) => {
          const height = Math.max(2, level * 20)
          return (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional and never reorder
              key={column}
              x={column * 3}
              y={12 - height / 2}
              width={2}
              height={height}
              fill={(column + 0.5) / BARS <= played ? 'var(--signal)' : 'var(--waveform-peak)'}
            />
          )
        })
      ) : (
        <rect x={0} y={11.5} width={width} height={1} fill="var(--waveform-peak)" />
      )}
      {sections.map((section) => (
        <rect
          key={`${section.label}-${section.start}`}
          x={section.start * width}
          y={columns.length > 0 ? 0 : 6}
          width={1}
          height={columns.length > 0 ? 24 : 12}
          fill="var(--muted-foreground)"
        >
          <title>{section.label}</title>
        </rect>
      ))}
    </svg>
  )
}

export { MusicStrip }
