import beats from '@splitune/contracts/fixtures/beats.json'
import type { Beats } from '@splitune/music-core'
import { describe, expect, it } from 'vitest'
import { chartLines } from './chart'
import { practiceGrid } from './grid'
import type { ChordModel } from './view-model'

// Fixture: 4/4, beats 0.6 s apart from 0.5 s, bars 0–7 (bar n starts at 0.5 + 2.4 n).
const grid = practiceGrid(beats as Beats)
const at = (bar: number, beat = 0) => 0.5 + bar * 2.4 + beat * 0.6

function chord(name: string, t0: number, t1: number): ChordModel {
  return {
    id: `${name}@${t0}`,
    name,
    label: name,
    confidence: 'high',
    t0,
    t1,
    bar: 0,
    beat: 1,
    alternatives: [],
  }
}

describe('chartLines', () => {
  it('lays out four bars to a line', () => {
    const lines = chartLines(grid, [chord('Am', at(0), at(8))])
    expect(lines.map((line) => line.bars.map((b) => b.bar))).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
    ])
    expect(lines[0]?.bars[0]?.beats).toBe(4)
  })

  it('writes a chord once, where it changes, over its beat', () => {
    const lines = chartLines(grid, [
      chord('Abmaj7', at(0), at(1, 2)),
      chord('Bb7', at(1, 2), at(2)),
      chord('Ebmaj7', at(2), at(4)),
    ])
    const written = lines[0]?.bars.map((b) => b.chords.map((c) => [c.chord.name, c.beat]))
    expect(written).toEqual([[['Abmaj7', 0]], [['Bb7', 2]], [['Ebmaj7', 0]], []])
  })

  it('writes a chord again after a different one or a silence', () => {
    const lines = chartLines(grid, [
      chord('F', at(0), at(1)),
      chord('C', at(1), at(2)),
      chord('F', at(2), at(3)),
      chord('F', at(4), at(5)),
    ])
    const names = lines.flatMap((l) => l.bars.map((b) => b.chords.map((c) => c.chord.name)))
    expect(names).toEqual([['F'], ['C'], ['F'], [], ['F'], [], [], []])
  })

  it('reads N.C. once at the start of a run of empty bars', () => {
    const lines = chartLines(grid, [chord('Fm7', at(3), at(8))])
    expect(lines[0]?.bars.map((b) => b.noChord)).toEqual([true, false, false, false])
    expect(lines[0]?.bars[3]?.chords[0]?.chord.name).toBe('Fm7')
  })

  it('keeps the later of two changes on one beat', () => {
    const lines = chartLines(grid, [chord('C', at(0), at(0, 0.3)), chord('G', at(0, 0.3), at(1))])
    expect(lines[0]?.bars[0]?.chords.map((c) => [c.chord.name, c.beat])).toEqual([['G', 0]])
  })

  it('has no chords to write without chords', () => {
    const lines = chartLines(grid, [])
    expect(lines.flatMap((l) => l.bars.filter((b) => b.chords.length > 0))).toEqual([])
    expect(lines[0]?.bars[0]?.noChord).toBe(true)
  })
})
