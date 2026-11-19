import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import { chartPath, chartPosition, speedRange } from './sparkline'

export type ProgressPoint = { at: Date; best: number; cold: number }

/**
 * The Progress tab's "Last 30 days" (26 §4.4, §12.2 ProgressChart; 27 §3.7.4): per session, the
 * best clean pass as a solid ink line with round markers and the first clean pass ("cold") as a
 * dashed --muted-foreground line with square markers, so the two never differ by colour alone.
 * The picture is one `img` named by `label`, its text alternative; the legend stays visible.
 */
export function ProgressChart({
  points,
  domain,
  label,
  legend,
  className,
}: {
  points: ProgressPoint[]
  domain: [Date, Date]
  label: string
  legend: { best: string; cold: string }
  className?: string
}) {
  const range = speedRange(points.flatMap((p) => [p.best, p.cold]))
  const best = points.map((p) => chartPosition({ at: p.at, value: p.best }, domain, range))
  const cold = points.map((p) => chartPosition({ at: p.at, value: p.cold }, domain, range))
  const ticks = [range[1], (range[0] + range[1]) / 2, range[0]]
  return (
    <div data-slot="progress-chart" className={cn('flex flex-col gap-2.5', className)}>
      <div role="img" aria-label={label} className="relative h-30 pr-9">
        <div aria-hidden className="relative size-full">
          {ticks.map((tick, i) => (
            <span
              key={tick}
              className="absolute inset-x-0 border-t border-border"
              style={{ top: `${i * 50}%` }}
            >
              {i < 2 && (
                <span className="absolute top-0.5 -right-9 w-8 text-right text-xs text-faint-foreground tabular-nums">
                  {formatPercent(tick)}
                </span>
              )}
            </span>
          ))}
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
          >
            <path
              data-series="cold"
              d={chartPath(cold)}
              fill="none"
              className="stroke-muted-foreground"
              strokeWidth={2}
              strokeDasharray="4 4"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              data-series="best"
              d={chartPath(best)}
              fill="none"
              className="stroke-signal"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {cold.map((p, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: one marker per session, in order
              key={`c${i}`}
              data-marker="cold"
              className="absolute size-2 -translate-1/2 border-2 border-muted-foreground bg-card"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            />
          ))}
          {best.map((p, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: one marker per session, in order
              key={`b${i}`}
              data-marker="best"
              className={cn(
                'absolute -translate-1/2 rounded-full bg-signal',
                i === best.length - 1 ? 'size-2.5' : 'size-1.5',
              )}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            />
          ))}
        </div>
      </div>
      <ul className="flex list-none flex-col gap-1 p-0 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <span aria-hidden className="h-0.75 w-4.5 rounded-full bg-signal" />
          {legend.best}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="w-4.5 border-t-2 border-dashed border-muted-foreground" />
          {legend.cold}
        </li>
      </ul>
    </div>
  )
}
