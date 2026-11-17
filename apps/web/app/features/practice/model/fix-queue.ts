import { parseChord } from '@splitune/music-core'
import type { PracticeGrid } from './grid'
import type { ViewModel } from './view-model'

// The Fix queue (12 §4, 26 §5): every unsure spot of the effective music — each unsure chord, each
// unsure note outside a shaky bar, and a mostly-unsure bar once, as one "shaky bar" — ranked by
// what a wrong guess costs the learner and then by how likely the guess is wrong. The same spots
// the Fix tab's badge and the legend chip count (view-model `unsureSpots`).

/** What is likely wrong, most costly first: a wrong pitch or string/fret, a note an octave out,
 * a chord's root, a chord's quality. */
export const CONSEQUENCES = ['pitch', 'octave', 'chord-root', 'chord-quality'] as const
export type Consequence = (typeof CONSEQUENCES)[number]

export interface Spot {
  /** `chord:{id}`, `note:{id}` or `bar:{bar}`: stable while the spot stays unsure. */
  id: string
  kind: 'chord' | 'note' | 'bar'
  startBar: number
  endBar: number
  chordId?: string
  noteId?: string
  consequence: Consequence
  /** How likely the guess is wrong: 1 − its calibrated confidence (a shaky bar: the mean over its
   * unsure notes). */
  wrong: number
  /** Where it sounds, to keep equal spots in song order. */
  at: number
}

type QueueMusic = {
  displayChords: readonly { id: string; confidence: number }[]
  tab?: { notes: readonly { id: string; confidence: number }[] } | undefined
}

const mean = (values: readonly number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

export function buildQueue(
  view: Pick<ViewModel, 'chords' | 'notes' | 'marks' | 'unsureBars'>,
  music: QueueMusic,
  grid: Pick<PracticeGrid, 'positionAt'>,
): Spot[] {
  const chordConfidence = new Map(music.displayChords.map((c) => [c.id, c.confidence]))
  const noteConfidence = new Map((music.tab?.notes ?? []).map((n) => [n.id, n.confidence]))
  const spots: Spot[] = []

  for (const chord of view.chords) {
    if (chord.confidence !== 'low') continue
    const own = parseChord(chord.label)
    const second = chord.alternatives[0] ? parseChord(chord.alternatives[0].label) : null
    const rootMoves =
      own?.kind === 'chord' && second?.kind === 'chord' ? own.root !== second.root : false
    spots.push({
      id: `chord:${chord.id}`,
      kind: 'chord',
      startBar: chord.bar,
      endBar: Math.max(chord.bar, grid.positionAt(Math.max(chord.t0, chord.t1 - 1e-3)).bar),
      chordId: chord.id,
      consequence: rootMoves ? 'chord-root' : 'chord-quality',
      wrong: 1 - (chordConfidence.get(chord.id) ?? 0),
      at: chord.t0,
    })
  }

  const shaky = new Map<number, { wrong: number[]; at: number }>()
  for (const note of view.notes) {
    if (note.confidence !== 'low') continue
    const wrong = 1 - (noteConfidence.get(note.id) ?? 0)
    if (view.unsureBars.has(note.bar)) {
      const bar = shaky.get(note.bar) ?? { wrong: [], at: note.onset }
      bar.wrong.push(wrong)
      bar.at = Math.min(bar.at, note.onset)
      shaky.set(note.bar, bar)
      continue
    }
    spots.push({
      id: `note:${note.id}`,
      kind: 'note',
      startBar: note.bar,
      endBar: note.bar,
      noteId: note.id,
      // A note the tab had to move by octaves is the octave question; any other is its pitch.
      consequence: view.marks.get(note.id)?.octave ? 'octave' : 'pitch',
      wrong,
      at: note.onset,
    })
  }
  for (const [bar, { wrong, at }] of shaky) {
    spots.push({
      id: `bar:${bar}`,
      kind: 'bar',
      startBar: bar,
      endBar: bar,
      consequence: 'pitch',
      wrong: mean(wrong),
      at,
    })
  }

  const rank = (spot: Spot) => CONSEQUENCES.indexOf(spot.consequence)
  return spots.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      b.wrong - a.wrong ||
      a.startBar - b.startBar ||
      a.at - b.at ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
}

/** The spot after (1) or before (−1) the current one, wrapping; the first one from outside. */
export function stepSpot(
  queue: readonly Spot[],
  currentId: string | undefined,
  direction: 1 | -1,
): Spot | undefined {
  if (queue.length === 0) return undefined
  const index = queue.findIndex((spot) => spot.id === currentId)
  if (index < 0) return direction === 1 ? queue[0] : queue.at(-1)
  return queue[(index + direction + queue.length) % queue.length]
}

/** The spot a selection sits on: its note's (or that note's shaky bar's), its chord's, or the
 * first one in its bar. */
export function spotFor(
  queue: readonly Spot[],
  target: { bar: number; chordId?: string | undefined; noteId?: string | undefined },
): Spot | undefined {
  return (
    (target.noteId ? queue.find((spot) => spot.noteId === target.noteId) : undefined) ??
    (target.chordId ? queue.find((spot) => spot.chordId === target.chordId) : undefined) ??
    queue.find((spot) => spot.kind === 'bar' && spot.startBar === target.bar) ??
    (target.noteId || target.chordId
      ? undefined
      : queue.find((spot) => spot.startBar <= target.bar && spot.endBar >= target.bar))
  )
}
