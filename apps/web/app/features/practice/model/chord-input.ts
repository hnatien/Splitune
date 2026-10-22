import { parseChord, SHORTHAND_INTERVALS } from '@splitune/music-core'

// "Type a chord" (27 §3.7.4): chart names as learners write them ("Am7", "F#m", "G/B") or Harte
// labels ("A:min7"); the result is always Harte-validated before it becomes a set_chord op.

const CHART_SUFFIX: Record<string, string> = {
  '': 'maj',
  M: 'maj',
  maj: 'maj',
  m: 'min',
  min: 'min',
  '-': 'min',
  '7': '7',
  maj7: 'maj7',
  M7: 'maj7',
  m7: 'min7',
  min7: 'min7',
  '-7': 'min7',
  dim: 'dim',
  o: 'dim',
  dim7: 'dim7',
  m7b5: 'hdim7',
  aug: 'aug',
  '+': 'aug',
  sus2: 'sus2',
  sus4: 'sus4',
  sus: 'sus4',
  '5': '5',
  '6': 'maj6',
  m6: 'min6',
  '9': '9',
  maj9: 'maj9',
  m9: 'min9',
}

export function parseChordInput(text: string): { label: string; bass?: string } | null {
  const input = text.trim()
  if (input === '') return null
  if (input === 'N' || input === 'N.C.') return { label: 'N' }
  if (input.includes(':')) {
    const parsed = parseChord(input)
    return parsed?.kind === 'chord' ? { label: input } : null
  }
  const match = /^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/.exec(input)
  if (!match) return null
  const [, root, suffix = '', bass] = match
  const shorthand = CHART_SUFFIX[suffix]
  if (shorthand === undefined || !(shorthand in SHORTHAND_INTERVALS)) return null
  const label = `${root}:${shorthand}`
  if (parseChord(label)?.kind !== 'chord') return null
  return bass ? { label, bass } : { label }
}

/** "about 1 in 3" style frequency for a top-k probability (26 §5). */
export function oneIn(prob: number): number {
  return Math.max(1, Math.round(1 / Math.max(prob, 1e-3)))
}
