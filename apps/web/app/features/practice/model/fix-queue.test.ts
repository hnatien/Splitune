import { describe, expect, it } from 'vitest'
import { buildQueue, spotFor, stepSpot } from './fix-queue'
import type { ChordModel, NoteModel, ViewModel } from './view-model'

// Four beats to a bar, two seconds a bar.
const grid = {
  positionAt: (seconds: number) => ({ bar: Math.floor(seconds / 2), beat: 1 }),
}

const chord = (
  id: string,
  bar: number,
  confidence: number,
  label = 'A:min',
  alternatives: string[] = [],
  bars = 1,
): [ChordModel, { id: string; confidence: number }] => [
  {
    id,
    name: label,
    label,
    confidence: confidence < 0.4 ? 'low' : confidence < 0.7 ? 'medium' : 'high',
    t0: bar * 2,
    t1: (bar + bars) * 2,
    bar,
    beat: 1,
    alternatives: alternatives.map((alt, i) => ({ label: alt, name: alt, prob: 0.3 - i * 0.1 })),
  },
  { id, confidence },
]

const note = (
  id: string,
  bar: number,
  confidence: number,
  at = 0,
): [NoteModel, { id: string; confidence: number }] => [
  {
    id,
    onset: bar * 2 + at,
    offset: bar * 2 + at + 0.25,
    pitch: 60,
    confidence: confidence < 0.4 ? 'low' : confidence < 0.7 ? 'medium' : 'high',
    bar,
    beat: 1,
    string: 2,
    fret: 1,
  },
  { id, confidence },
]

function queueOf(
  chords: ReturnType<typeof chord>[],
  notes: ReturnType<typeof note>[],
  options: { shaky?: number[]; octave?: string[] } = {},
) {
  const view: Pick<ViewModel, 'chords' | 'notes' | 'marks' | 'unsureBars'> = {
    chords: chords.map(([model]) => model),
    notes: notes.map(([model]) => model),
    marks: new Map(
      notes.map(([model]) => [
        model.id,
        options.octave?.includes(model.id)
          ? { level: model.confidence, octave: '8va' as const }
          : { level: model.confidence },
      ]),
    ),
    unsureBars: new Set(options.shaky ?? []),
  }
  const music = {
    displayChords: chords.map(([, raw]) => raw),
    tab: { notes: notes.map(([, raw]) => raw) },
  }
  return buildQueue(view, music, grid)
}

describe('fix queue', () => {
  it('holds only what is marked unsure', () => {
    const queue = queueOf(
      [chord('c1', 0, 0.9), chord('c2', 1, 0.5), chord('c3', 2, 0.3)],
      [note('n1', 0, 0.95), note('n2', 1, 0.6), note('n3', 3, 0.2)],
    )
    expect(queue.map((spot) => spot.id)).toEqual(['note:n3', 'chord:c3'])
  })

  it('ranks by consequence: pitch, then octave, then chord root, then chord quality', () => {
    const queue = queueOf(
      [
        chord('quality', 0, 0.1, 'A:min', ['A:min7']),
        chord('root', 1, 0.3, 'A:min', ['C:maj']),
        chord('alone', 2, 0.05),
      ],
      [note('octave', 3, 0.1), note('pitch', 4, 0.35)],
      { octave: ['octave'] },
    )
    expect(queue.map((spot) => [spot.id, spot.consequence])).toEqual([
      ['note:pitch', 'pitch'],
      ['note:octave', 'octave'],
      ['chord:root', 'chord-root'],
      ['chord:alone', 'chord-quality'],
      ['chord:quality', 'chord-quality'],
    ])
  })

  it('ranks by how likely the guess is wrong inside a consequence', () => {
    const queue = queueOf([], [note('a', 0, 0.35), note('b', 5, 0.1), note('c', 2, 0.2)])
    expect(queue.map((spot) => spot.id)).toEqual(['note:b', 'note:c', 'note:a'])
    expect(queue[0]?.wrong).toBeCloseTo(0.9)
  })

  it('makes a mostly-unsure bar one shaky-bar spot instead of one per note', () => {
    const queue = queueOf(
      [],
      [
        note('s1', 6, 0.2, 0.5),
        note('s2', 6, 0.3, 0),
        note('s3', 6, 0.1, 1),
        note('sure', 6, 0.9, 1.5),
        note('lone', 2, 0.3),
      ],
      { shaky: [6] },
    )
    expect(queue.map((spot) => spot.id)).toEqual(['bar:6', 'note:lone'])
    const bar = queue[0]
    expect(bar).toMatchObject({ kind: 'bar', startBar: 6, endBar: 6, consequence: 'pitch' })
    expect(bar?.wrong).toBeCloseTo(0.8)
    expect(bar?.at).toBe(12)
  })

  it('spans the bars a chord sounds over', () => {
    const queue = queueOf([chord('long', 26, 0.2, 'A:min', [], 2)], [])
    expect(queue[0]).toMatchObject({ startBar: 26, endBar: 27 })
  })

  it('keeps equal spots in song order, the same on every build', () => {
    const notes = [note('z', 7, 0.2), note('a', 3, 0.2), note('m', 3, 0.2, 1), note('b', 5, 0.2)]
    const first = queueOf([], notes).map((spot) => spot.id)
    expect(first).toEqual(['note:a', 'note:m', 'note:b', 'note:z'])
    expect(queueOf([], [...notes].reverse()).map((spot) => spot.id)).toEqual(first)
  })

  it('orders well over 99 spots the same way', () => {
    const notes = Array.from({ length: 150 }, (_, i) =>
      note(`n${String(i).padStart(3, '0')}`, i, 0.05 + (i % 7) * 0.05),
    )
    const queue = queueOf([], notes)
    expect(queue).toHaveLength(150)
    for (let i = 1; i < queue.length; i++) {
      const [before, after] = [queue[i - 1], queue[i]] as [(typeof queue)[0], (typeof queue)[0]]
      expect(before.wrong).toBeGreaterThanOrEqual(after.wrong)
      if (before.wrong === after.wrong) expect(before.startBar).toBeLessThan(after.startBar)
    }
    expect(queueOf([], [...notes].reverse())).toEqual(queue)
  })

  it('steps through the queue and wraps', () => {
    const queue = queueOf([], [note('a', 0, 0.1), note('b', 1, 0.2), note('c', 2, 0.3)])
    expect(stepSpot(queue, undefined, 1)?.id).toBe('note:a')
    expect(stepSpot(queue, undefined, -1)?.id).toBe('note:c')
    expect(stepSpot(queue, 'note:a', 1)?.id).toBe('note:b')
    expect(stepSpot(queue, 'note:c', 1)?.id).toBe('note:a')
    expect(stepSpot(queue, 'note:a', -1)?.id).toBe('note:c')
    expect(stepSpot([], undefined, 1)).toBeUndefined()
  })

  it('finds the spot a selection sits on', () => {
    const queue = queueOf(
      [chord('c', 4, 0.2)],
      [note('lone', 2, 0.3), note('s1', 6, 0.2), note('s2', 6, 0.2, 1)],
      { shaky: [6] },
    )
    expect(spotFor(queue, { bar: 2, noteId: 'lone' })?.id).toBe('note:lone')
    expect(spotFor(queue, { bar: 4, chordId: 'c' })?.id).toBe('chord:c')
    expect(spotFor(queue, { bar: 6, noteId: 's1' })?.id).toBe('bar:6')
    expect(spotFor(queue, { bar: 4 })?.id).toBe('chord:c')
    expect(spotFor(queue, { bar: 0 })).toBeUndefined()
    expect(spotFor(queue, { bar: 2, noteId: 'sure-note' })).toBeUndefined()
  })
})
