import { m } from '@/lib/i18n'

// The notation's text alternative per bar (12 §9): "Bar 12: G; notes G2, B2".
export function barText(bar: number, chords: string[], notes: string[]): string {
  const number = bar < 0 ? m['practice.pickup']() : m['practice.bar']({ bar: String(bar + 1) })
  if (chords.length === 0 && notes.length === 0) return number
  return m['practice.bar_text']({
    bar: number,
    chords: chords.length > 0 ? chords.join(', ') : m['practice.no_chord'](),
    notes: notes.length > 0 ? notes.join(', ') : m['practice.no_notes'](),
  })
}
