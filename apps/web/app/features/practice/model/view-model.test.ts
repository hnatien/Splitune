import beats from '@splitune/contracts/fixtures/beats.json'
import chords from '@splitune/contracts/fixtures/chords.json'
import notes from '@splitune/contracts/fixtures/notes.guitar.json'
import type { Beats, Chords, Notes } from '@splitune/music-core'
import { describe, expect, it } from 'vitest'
import { practiceGrid } from './grid'
import { computeMusic } from './music'
import { buildViewModel, chordsAround, chordsInBar, noteName } from './view-model'

const music = computeMusic({
  beats: beats as Beats,
  chords: chords as Chords,
  notes: notes as Notes,
  ops: { beats: [], chords: [], notes: [] },
  beatsRev: 0,
  options: { capo: 0, level: 'as_transcribed', fingeringMode: 'easiest' },
})
const grid = practiceGrid(music.beats)
const view = buildViewModel(music, grid)

describe('view model', () => {
  it('lists chords with display names, bars and confidence, skipping no-chord', () => {
    expect(view.chords.map((c) => c.name)).toEqual(['Am', 'F', 'C', 'G'])
    expect(view.chords[0]).toMatchObject({ bar: 0, beat: 1, confidence: 'high' })
    expect(view.chords[3]?.confidence).toBe('medium')
  })

  it('marks every rendered note with its confidence', () => {
    expect(view.marks.size).toBe(view.notes.length)
    const low = view.notes.filter((n) => n.confidence === 'low')
    expect(low.length).toBeGreaterThan(0)
    expect(view.marks.get(low[0]?.id ?? '')?.level).toBe('low')
  })

  it('finds the current and next chord', () => {
    const around = chordsAround(view.chords, 6)
    expect(around.current?.name).toBe('F')
    expect(around.next?.name).toBe('C')
    expect(chordsAround(view.chords, 0.1).current).toBeUndefined()
    expect(chordsInBar(view.chords, grid, 2).map((c) => c.name)).toEqual(['F'])
  })

  it('names notes with octaves', () => {
    expect(noteName(45)).toBe('A2')
    expect(noteName(64)).toBe('E4')
  })
})
