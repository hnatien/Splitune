// Number, time and date formatting per 27 §5.3: numerals, a non-breaking space before units,
// m:ss (h:mm:ss over an hour), relative dates up to 7 days, "1 Dec" / "1 Dec 2027" after that.

const NBSP = ' '

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = String(s % 60).padStart(2, '0')
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}${NBSP}%`
}

const DAY_MS = 24 * 3600 * 1000

/**
 * "1 Dec" (with the year when it isn't this year), in this runtime's time zone or `timeZone`.
 * Server-rendered dates pass 'UTC' until hydration (useHydrated): the server's zone is not the
 * learner's, and a different day would break hydration.
 */
export function formatDate(date: Date, now: Date = new Date(), timeZone?: string): string {
  const sameYear = date.getFullYear() === now.getFullYear()
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    ...(timeZone ? { timeZone } : {}),
  }).format(date)
}

/** "22 Oct, 14:30": a date with its time, for deadlines within a day or two. */
export function formatDateTime(date: Date, now: Date = new Date()): string {
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date)
  return `${formatDate(date, now)}, ${time}`
}

/** "today", "yesterday", "3 days ago" within a week; a date after that. */
export function formatRelativeDate(date: Date, now: Date = new Date()): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(date)) / DAY_MS)
  if (days < 0 || days > 7) return formatDate(date, now)
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-days, 'day')
}

/** 0-based bar_index → the 1-based bar label of the UI; −1 is the pickup (27 §5.3). */
export function barNumber(barIndex: number): number {
  return barIndex + 1
}

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return mb >= 1
    ? `${mb.toFixed(mb >= 10 ? 0 : 1)}${NBSP}MB`
    : `${Math.ceil(bytes / 1024)}${NBSP}KB`
}
