import { cn } from '@/lib/utils'

// Shared drawing for the progress charts (26 §4.4, §12.2): positions are percentages of the plot,
// so the line is one SVG path drawn with a non-scaling stroke (crisp at any width) and markers and
// labels are HTML at the token sizes. Values are speeds in percent; x is time.

export type ChartValue = { at: Date; value: number }

/** A y range around the values in steps of 10, at least 20 wide, so a flat line sits mid-plot. */
export function speedRange(values: number[]): [number, number] {
  if (values.length === 0) return [0, 100]
  let lo = Math.floor((Math.min(...values) - 5) / 10) * 10
  let hi = Math.ceil((Math.max(...values) + 5) / 10) * 10
  if (hi - lo < 20) {
    const pad = (20 - (hi - lo)) / 2
    lo -= pad
    hi += pad
  }
  return [Math.max(0, lo), hi]
}

/** Where a point sits, in percent of the plot from the left and from the top. */
export function chartPosition(
  point: ChartValue,
  domain: [Date, Date],
  range: [number, number],
): { x: number; y: number } {
  const [start, end] = domain.map((d) => d.getTime()) as [number, number]
  const span = Math.max(1, end - start)
  const x = Math.min(100, Math.max(0, ((point.at.getTime() - start) / span) * 100))
  const y = (1 - (point.value - range[0]) / Math.max(1, range[1] - range[0])) * 100
  return { x, y: Math.min(100, Math.max(0, y)) }
}

/** The SVG path through the points (viewBox 0 0 100 100). */
export function chartPath(positions: { x: number; y: number }[]): string {
  return positions
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ')
}

/**
 * The library's 30-day line of the best clean speed (27 §3.5): the ink line with the latest
 * session as a dot. `label` is its text alternative ("Best clean speed rose from 60 to 80 percent
 * over 9 sessions"); the picture itself is hidden from assistive tech.
 */
export function Sparkline({
  values,
  domain,
  label,
  className,
}: {
  values: ChartValue[]
  domain: [Date, Date]
  label: string
  className?: string
}) {
  const range = speedRange(values.map((v) => v.value))
  const positions = values.map((v) => chartPosition(v, domain, range))
  const last = positions.at(-1)
  return (
    <div
      role="img"
      aria-label={label}
      data-slot="sparkline"
      className={cn('relative h-12 w-full', className)}
    >
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
      >
        <path
          d={chartPath(positions)}
          fill="none"
          className="stroke-signal"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {last && (
        <span
          aria-hidden
          className="absolute size-2 -translate-1/2 rounded-full bg-signal"
          style={{ left: `${last.x}%`, top: `${last.y}%` }}
        />
      )}
    </div>
  )
}
