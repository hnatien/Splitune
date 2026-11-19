import { formatRelativeDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { type ChartPoint, trend } from './model/progress-metrics'

// Words for progress (27 §5.3, §5.5), shared by the Progress tab and the library: the charts' text
// alternatives, practice time ("18 min", "1 h 20") and session dates. Plain numbers, no streaks,
// no missed days; a speed that went down is "went from", never a loss.

const NBSP = ' '

/** "18 min", "1 h 20", "2 h" (27 §5.3): practice time, rounded to the minute. */
export function formatPracticeTime(minutes: number): string {
  const total = Math.round(minutes)
  if (total < 60) return `${total}${NBSP}min`
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return rest === 0 ? `${hours}${NBSP}h` : `${hours}${NBSP}h ${rest}`
}

/** "Best clean speed rose from 60 to 80 percent over 9 sessions" (the sparkline's alternative). */
export function bestTrendLabel(values: number[]): string {
  const t = trend(values)
  if (!t) return ''
  if (t.kind === 'one') return m['progress.alt_best_one']({ pct: String(t.to) })
  const n = String(t.sessions)
  if (t.kind === 'same') return m['progress.alt_best_same']({ pct: String(t.to), n })
  const values_ = { from: String(t.from), to: String(t.to), n }
  return t.kind === 'rose'
    ? m['progress.alt_best_rose'](values_)
    : m['progress.alt_best_went'](values_)
}

function coldTrendLabel(values: number[]): string {
  const t = trend(values)
  if (!t) return ''
  if (t.kind === 'one') return m['progress.alt_cold_one']({ pct: String(t.to) })
  if (t.kind === 'same') return m['progress.alt_cold_same']({ pct: String(t.to) })
  const values_ = { from: String(t.from), to: String(t.to) }
  return t.kind === 'rose'
    ? m['progress.alt_cold_rose'](values_)
    : m['progress.alt_cold_went'](values_)
}

/** The Last 30 days chart's text alternative: both series, in words. */
export function chartLabel(points: ChartPoint[]): string {
  return `${bestTrendLabel(points.map((p) => p.best))}. ${coldTrendLabel(points.map((p) => p.cold))}`
}

/** "Today", "Yesterday", "3 days ago", "27 Oct": a session row's date, sentence case. */
export function sessionDate(date: Date, now: Date): string {
  const text = formatRelativeDate(date, now)
  return text.charAt(0).toUpperCase() + text.slice(1)
}
