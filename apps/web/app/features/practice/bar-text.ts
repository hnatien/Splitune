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

/** "Next · in 3 beats", or "Next · in 1 beat" for one. */
export function nextInBeats(count: number): string {
  return count === 1
    ? m['practice.next_in_beat']()
    : m['practice.next_in_beats']({ count: String(count) })
}

/** The position readout's "26.3" for bar 26, beat 3. Before the first bar there is no bar to name
 * (the score shows none either), so the lead-in reads as a dash, never as a bar 0. */
export const barAndBeat = (at: { bar: number; beat: number }) =>
  at.bar < 0 ? '–' : `${at.bar + 1}.${at.beat}`
