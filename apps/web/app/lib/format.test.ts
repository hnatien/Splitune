import { describe, expect, it } from 'vitest'
import {
  barNumber,
  formatDate,
  formatDateTime,
  formatDuration,
  formatPercent,
  formatRelativeDate,
} from './format.ts'

describe('format', () => {
  it('writes durations as m:ss and h:mm:ss', () => {
    expect(formatDuration(45)).toBe('0:45')
    expect(formatDuration(1199.6)).toBe('20:00')
    expect(formatDuration(3730)).toBe('1:02:10')
    expect(formatDuration(-3)).toBe('0:00')
  })

  it('puts a non-breaking space before %', () => {
    expect(formatPercent(84.6)).toBe('85 %')
  })

  it('is relative within a week and a short date after', () => {
    const now = new Date(2026, 10, 20, 12)
    expect(formatRelativeDate(new Date(2026, 10, 20, 8), now)).toBe('today')
    expect(formatRelativeDate(new Date(2026, 10, 19, 23), now)).toBe('yesterday')
    expect(formatRelativeDate(new Date(2026, 10, 17), now)).toBe('3 days ago')
    expect(formatRelativeDate(new Date(2026, 10, 1), now)).toBe('1 Nov')
    expect(formatDate(new Date(2027, 11, 1), now)).toBe('1 Dec 2027')
  })

  it('formats in a given time zone, so server and client agree before hydration', () => {
    const resets = new Date(Date.UTC(2026, 10, 1, 0, 30))
    const now = new Date(Date.UTC(2026, 9, 20))
    expect(formatDate(resets, now, 'UTC')).toBe('1 Nov')
    expect(formatDate(resets, now, 'America/New_York')).toBe('31 Oct')
    expect(formatDate(resets, now, 'Asia/Bangkok')).toBe('1 Nov')
  })

  it('shows bars 1-based', () => {
    expect(barNumber(0)).toBe(1)
    expect(barNumber(16)).toBe(17)
  })
})

describe('formatDateTime', () => {
  it('adds the 24 h time to the short date', () => {
    const now = new Date(2026, 9, 22, 9, 0)
    expect(formatDateTime(new Date(2026, 9, 23, 14, 5), now)).toBe('23 Oct, 14:05')
  })
})
