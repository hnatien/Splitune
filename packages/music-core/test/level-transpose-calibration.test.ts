import { describe, expect, it } from 'vitest'
import {
  bassRoots,
  calibrate,
  calibrateWithBand,
  confidenceBand,
  correctBassOctaves,
  createBeatGrid,
  PPQ,
  resolveShapes,
  simplifyChords,
  simplifyGuitar,
  suggestCapo,
  transposeSegments,
} from '../src/index.ts'
import type { CalibrationTable } from '../src/types.ts'
import { makeBeats, makeChords, makeNotes } from './helpers.ts'

describe('correctBassOctaves', () => {
  const chords = makeChords([{ t0: 0, t1: 8, label: 'A:min' }])

  it('pulls a lone second-harmonic note down to the root register', () => {
    const notes = makeNotes(
      [45, 57, 45, 45].map((p, i) => ({ pitch_midi: p, onset_s: i * 0.5 })),
      'bass',
    ).notes
    expect(correctBassOctaves(notes, chords.segments).map((n) => n.pitch_midi)).toEqual([
      45, 45, 45, 45,
    ])
  })

  it('keeps notes unchanged (same objects) when the evidence is weak', () => {
    const notes = makeNotes(
      [33, 40, 45].map((p, i) => ({ pitch_midi: p, onset_s: i })),
      'bass',
    ).notes
    const out = correctBassOctaves(notes, [])
    expect(out).toEqual(notes)
    expect(out[0]).toBe(notes[0])
  })

  it('uses low-band energy to move a note down an octave', () => {
    const notes = makeNotes([{ id: 'a', pitch_midi: 52, onset_s: 0 }], 'bass').notes
    expect(correctBassOctaves(notes, [], { lowBandEnergy: { a: 1 } })[0]?.pitch_midi).toBe(40)
    expect(correctBassOctaves(notes, [], { lowBandEnergy: { a: 0 } })[0]?.pitch_midi).toBe(52)
  })

  it('ignores low-confidence chords and stays within range', () => {
    const weak = makeChords([{ t0: 0, t1: 8, label: 'E:maj', confidence: 0.1 }])
    const notes = makeNotes([{ pitch_midi: 52, onset_s: 0 }], 'bass').notes
    expect(correctBassOctaves(notes, weak.segments)[0]?.pitch_midi).toBe(52)
    const low = makeNotes([{ pitch_midi: 29, onset_s: 0 }], 'bass').notes
    expect(
      correctBassOctaves(low, makeChords([{ t0: 0, t1: 1, label: 'F:maj' }]).segments)[0]
        ?.pitch_midi,
    ).toBe(29)
  })
})

describe('level simplification', () => {
  const notes = [
    { id: 'on', pitch: 60, confidence: 0.9, onTick: 0, offTick: 240 },
    { id: 'off', pitch: 62, confidence: 0.9, onTick: 480, offTick: 720 },
    { id: 'low', pitch: 64, confidence: 0.2, onTick: PPQ, offTick: PPQ + 240 },
    { id: 'med', pitch: 65, confidence: 0.5, onTick: 2 * PPQ, offTick: 2 * PPQ + 240 },
  ]

  it('applies the guitar levels', () => {
    expect(simplifyGuitar(notes, 'chords_only')).toEqual([])
    expect(simplifyGuitar(notes, 'as_transcribed')).toEqual(notes)
    expect(simplifyGuitar(notes, 'simplified').map((n) => n.id)).toEqual(['on', 'med'])
  })

  it('simplifies chord labels only at the simplified level', () => {
    const chords = makeChords([{ t0: 0, t1: 1, label: 'A:min7/b7' }]).segments
    expect(simplifyChords(chords, 'simplified')[0]?.label).toBe('A:min')
    expect(simplifyChords(chords, 'as_transcribed')[0]?.label).toBe('A:min7/b7')
  })

  it('puts one bass root on each downbeat of a chord segment', () => {
    const grid = createBeatGrid(makeBeats({ bars: 4, start: 0 }))
    const chords = makeChords([
      { t0: 0, t1: 4, label: 'A:min' },
      { t0: 4, t1: 5, label: 'G:maj/3' },
      { t0: 5, t1: 6, label: 'C:maj' },
    ]).segments
    const roots = bassRoots(chords, grid, [], { lowest: 28, highest: 52 })
    expect(roots.map((r) => [r.id, r.pitch, r.onTick / PPQ])).toEqual([
      ['root:c0000@0', 33, 0],
      ['root:c0000@1', 33, 4],
      ['root:c0001@2', 35, 8],
      ['root:c0002@2', 36, 10],
    ])
  })
})

describe('transposition and capo', () => {
  it('keeps shapes by moving the capo, and falls back when the capo would leave 0–12', () => {
    expect(resolveShapes(2, 3, true)).toEqual({ capo: 5, keepShapes: true })
    expect(resolveShapes(0, -2, true)).toEqual({ capo: 0, keepShapes: false })
    expect(resolveShapes(2, 3, false)).toEqual({ capo: 2, keepShapes: false })
  })

  it('transposes chord labels, top-k and slash basses', () => {
    const [seg] = transposeSegments(
      [
        {
          ...makeChords([{ t0: 0, t1: 1, label: 'G:maj' }]).segments[0],
          bass: 'B',
          top_k: [{ label: 'E:min', prob: 0.2 }],
        } as never,
      ],
      2,
    )
    expect(seg).toMatchObject({ label: 'A:maj', bass: 'C#', top_k: [{ label: 'F#:min' }] })
  })

  it('suggests the capo with the cheapest shapes', () => {
    const chords = makeChords(
      ['Ab:maj', 'Db:maj', 'Eb:maj', 'F:min'].map((label, i) => ({ t0: i, t1: i + 1, label })),
    ).segments
    const [best] = suggestCapo(chords)
    expect(best?.capo).toBe(1)
    expect(best?.shapes).toMatchObject({
      'Ab:maj': 'G:maj',
      'Db:maj': 'C:maj',
      'Eb:maj': 'D:maj',
      'F:min': 'E:min',
    })
    expect(suggestCapo(chords, { tuningMidi: [64, 59, 55, 50, 45, 38] })).toEqual([])
  })
})

describe('calibration lookup', () => {
  const table: CalibrationTable = {
    model_id: 'basic_pitch',
    version: '0.4.0',
    method: 'isotonic',
    knots: [
      [0.1, 0.05],
      [0.5, 0.4],
      [0.9, 0.95],
    ],
    bands: { high: 0.7, medium: 0.4 },
  }

  it('interpolates between knots and clamps outside', () => {
    expect(calibrate(0, table)).toBe(0.05)
    expect(calibrate(0.3, table)).toBeCloseTo(0.225)
    expect(calibrate(1, table)).toBe(0.95)
    expect(calibrate(1.5, { ...table, method: 'identity' })).toBe(1)
  })

  it('bands calibrated confidence', () => {
    expect(confidenceBand(0.7)).toBe('high')
    expect(confidenceBand(0.4)).toBe('medium')
    expect(confidenceBand(0.39)).toBe('low')
    expect(calibrateWithBand(0.5, table)).toEqual({ confidence: 0.4, band: 'medium' })
  })
})
