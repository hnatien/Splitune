import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  chordDisplayName,
  chordShapes,
  estimateKey,
  formatChord,
  keyNoteNames,
  keyScale,
  parseChord,
  shapeDifficulty,
  simplifyToTriad,
  transposeChord,
  tuningOffset,
} from '../src/index.ts'
import { makeChords } from './helpers.ts'

describe('Harte parse/format', () => {
  it('parses roots, shorthands, degrees and slash basses', () => {
    expect(parseChord('A:min7/b7')).toMatchObject({
      kind: 'chord',
      root: 9,
      shorthand: 'min7',
      bassPc: 7,
      pitchClasses: [0, 4, 7, 9],
    })
    expect(parseChord('C')).toMatchObject({ shorthand: 'maj', pitchClasses: [0, 4, 7] })
    expect(parseChord('C:maj(9)')).toMatchObject({ pitchClasses: [0, 2, 4, 7] })
    expect(parseChord('C:(1,5)')).toMatchObject({ shorthand: null, pitchClasses: [0, 7] })
    expect(parseChord('C:7(*5)')).toMatchObject({ pitchClasses: [0, 4, 10] })
    expect(parseChord('N')).toEqual({ kind: 'none' })
    expect(parseChord('X')).toEqual({ kind: 'unknown' })
    for (const bad of ['H:maj', 'C:blah', 'C/x', '', 'C:maj(15)'])
      expect(parseChord(bad)).toBeNull()
  })

  it('formats canonically (shorthand always written)', () => {
    expect(formatChord(parseChord('C') as never)).toBe('C:maj')
    for (const label of ['A:min7/b7', 'Bb:hdim7', 'F#:maj(9)', 'C:(1,5)', 'N', 'X']) {
      expect(formatChord(parseChord(label) as never)).toBe(label)
    }
  })
})

describe('chordDisplayName (display, separate from Harte formatting)', () => {
  it.each([
    ['C:maj7', 'Cmaj7'],
    ['F#:min', 'F#m'],
    ['Bb:maj', 'Bb'],
    ['A:min7/b7', 'Am7/G'],
    ['B:hdim7', 'Bm7b5'],
    ['E:sus4', 'Esus4'],
    ['G:5', 'G5'],
    ['N', 'N.C.'],
  ])('%s → %s', (label, name) => {
    expect(chordDisplayName(label)).toBe(name)
  })

  it('uses ChordSegment.bass for the slash', () => {
    expect(chordDisplayName('G:maj', 'B')).toBe('G/B')
  })

  it('respells the root and bass for the key when given its names', () => {
    const eb = keyNoteNames({ tonic: 'Eb', mode: 'major' })
    expect(chordDisplayName('D#:maj7', undefined, eb)).toBe('Ebmaj7')
    expect(chordDisplayName('G#:min7', undefined, eb)).toBe('Abm7')
    expect(chordDisplayName('A#:7/3', undefined, eb)).toBe('Bb7/D')
    expect(chordDisplayName('G#:maj', 'C', eb)).toBe('Ab/C')
    expect(chordDisplayName('N', undefined, eb)).toBe('N.C.')
  })
})

describe('keyScale', () => {
  it('gives the pitch classes of a key from its tonic', () => {
    expect(keyScale({ tonic: 'Ab', mode: 'major' })).toEqual([8, 10, 0, 1, 3, 5, 7])
    expect(keyScale({ tonic: 'F#', mode: 'minor' })).toEqual([6, 8, 9, 11, 1, 2, 4])
  })
})

describe('keyNoteNames', () => {
  const scale = (tonic: string, mode: 'major' | 'minor', pcs: number[]) =>
    pcs.map((pc) => keyNoteNames({ tonic, mode })[pc])

  it('names the scale with its own letters', () => {
    expect(scale('Eb', 'major', [3, 5, 7, 8, 10, 0, 2])).toEqual([
      'Eb',
      'F',
      'G',
      'Ab',
      'Bb',
      'C',
      'D',
    ])
    expect(scale('D#', 'major', [3, 8, 10])).toEqual(['Eb', 'Ab', 'Bb'])
    expect(scale('F#', 'minor', [6, 8, 9, 1])).toEqual(['F#', 'G#', 'A', 'C#'])
    expect(scale('Gb', 'major', [11])).toEqual(['Cb'])
  })

  it('raises the leading tone in minor keys', () => {
    expect(scale('D', 'minor', [1, 10])).toEqual(['C#', 'Bb'])
    expect(scale('A', 'minor', [8])).toEqual(['G#'])
  })

  it("spells the other notes in the key's style", () => {
    expect(scale('Eb', 'major', [1, 6, 11])).toEqual(['Db', 'Gb', 'B'])
    expect(scale('E', 'major', [3, 10])).toEqual(['D#', 'A#'])
    expect(scale('C', 'major', [1, 3, 8, 10])).toEqual(['C#', 'Eb', 'Ab', 'Bb'])
  })

  it('falls back to common chart spellings for an unreadable tonic', () => {
    expect(keyNoteNames({ tonic: 'N', mode: 'major' })[3]).toBe('Eb')
  })
})

describe('transpose and simplify', () => {
  it('transposes the root keeping the accidental style', () => {
    expect(transposeChord('A:min7/b7', 3)).toBe('C:min7/b7')
    expect(transposeChord('Bb:maj', 2)).toBe('C:maj')
    expect(transposeChord('C#:min', 1)).toBe('D:min')
    expect(transposeChord('Eb:7', -1)).toBe('D:7')
    expect(transposeChord('N', 5)).toBe('N')
    expect(transposeChord('C:maj', 1, 'flat')).toBe('Db:maj')
  })

  it('round-trips +n then −n (property)', () => {
    const roots = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const qualities = ['maj', 'min', '7', 'min7', 'maj7', 'sus4', 'hdim7', 'dim', 'aug']
    fc.assert(
      fc.property(
        fc.constantFrom(...roots),
        fc.constantFrom(...qualities),
        fc.integer({ min: -24, max: 24 }),
        (root, quality, n) => {
          const label = `${root}:${quality}`
          expect(transposeChord(transposeChord(label, n, 'sharp'), -n, 'sharp')).toBe(label)
        },
      ),
    )
  })

  it('simplifies to triads', () => {
    expect(simplifyToTriad('A:min7/b7')).toBe('A:min')
    expect(simplifyToTriad('G:9')).toBe('G:maj')
    expect(simplifyToTriad('B:hdim7')).toBe('B:dim')
    expect(simplifyToTriad('D:sus4')).toBe('D:sus4')
    expect(simplifyToTriad('N')).toBe('N')
  })
})

describe('shape library', () => {
  it('has open shapes for beginner chords and barre shapes for the rest', () => {
    expect(chordShapes('C:maj')[0]).toMatchObject({
      kind: 'open',
      frets: [0, 1, 0, 2, 3, null],
      difficulty: 1,
    })
    const fShapes = chordShapes('F:maj')
    expect(fShapes.every((s) => s.kind === 'barre')).toBe(true)
    expect(fShapes[0]?.frets).toEqual([1, 1, 2, 3, 3, 1])
    expect(shapeDifficulty('G:maj')).toBe(1)
    expect(shapeDifficulty('B:min')).toBe(3)
    expect(shapeDifficulty('C:dim7')).toBe(4)
    expect(shapeDifficulty('N')).toBe(0)
  })

  it('every library shape sounds its chord tones', () => {
    const open = [64, 59, 55, 50, 45, 40]
    for (const label of ['C:maj', 'A:min', 'G:7', 'E:min7', 'D:maj7', 'B:min', 'F#:7', 'C#:min7']) {
      const parsed = parseChord(label)
      if (parsed === null || parsed.kind !== 'chord') throw new Error(label)
      for (const shape of chordShapes(label)) {
        const pcs = shape.frets.flatMap((f, i) =>
          f === null ? [] : [((open[i] as number) + f) % 12],
        )
        expect(new Set(pcs), `${shape.name}`).toEqual(new Set(parsed.pitchClasses))
      }
    }
  })

  it('recognises uniformly shifted tunings only', () => {
    expect(tuningOffset([63, 58, 54, 49, 44, 39])).toBe(-1)
    expect(tuningOffset([64, 59, 55, 50, 45, 38])).toBeNull()
  })
})

describe('estimateKey', () => {
  it('finds the key of a diatonic progression', () => {
    const am = makeChords([
      { t0: 0, t1: 4, label: 'A:min' },
      { t0: 4, t1: 6, label: 'D:min' },
      { t0: 6, t1: 8, label: 'E:7' },
      { t0: 8, t1: 12, label: 'A:min' },
    ])
    expect(estimateKey(am.segments)).toMatchObject({ tonic: 'A', mode: 'minor' })
    const g = makeChords(
      ['G:maj', 'C:maj', 'D:maj', 'G:maj'].map((label, i) => ({ t0: i * 2, t1: i * 2 + 2, label })),
    )
    expect(estimateKey(g.segments)).toMatchObject({ tonic: 'G', mode: 'major' })
  })

  it('spells flat keys with flats and reports a margin confidence in [0, 1]', () => {
    const bb = makeChords(
      ['Bb:maj', 'Eb:maj', 'F:maj', 'Bb:maj'].map((label, i) => ({ t0: i, t1: i + 1, label })),
    )
    const key = estimateKey(bb.segments)
    expect(key.tonic).toBe('Bb')
    expect(key.confidence).toBeGreaterThan(0)
    expect(key.confidence).toBeLessThanOrEqual(1)
  })

  it('returns zero confidence without evidence', () => {
    expect(estimateKey([])).toMatchObject({ confidence: 0 })
  })
})
