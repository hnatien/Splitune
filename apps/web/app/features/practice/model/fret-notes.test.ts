import beats from '@splitune/contracts/fixtures/beats.json'
import chords from '@splitune/contracts/fixtures/chords.json'
import notes from '@splitune/contracts/fixtures/notes.guitar.json'
import type { Beats, Chords, Notes } from '@splitune/music-core'
import { describe, expect, it } from 'vitest'
import { fretNotes, stringNames } from './fret-notes'
import { practiceGrid } from './grid'
import { computeMusic } from './music'
import { buildViewModel } from './view-model'

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
const tab = music.tab as NonNullable<typeof music.tab>

describe('fret notes', () => {
  const { notes: placed, markers } = fretNotes(tab, view, grid.grid)

  it('puts every placed tab note on its string and fret, by onset', () => {
    expect(placed).toHaveLength(tab.events.length)
    expect(markers).toEqual([])
    const first = tab.events[0]
    expect(placed[0]).toMatchObject({
      id: first?.note_id,
      string: first?.string,
      fret: first?.fret,
    })
    for (let i = 1; i < placed.length; i++) {
      expect(placed[i]?.t0).toBeGreaterThanOrEqual(placed[i - 1]?.t0 ?? 0)
    }
  })

  it('times notes on the quantized grid, as the tab cursor plays them', () => {
    // Bar 1's first note is on its downbeat and ends within the beat (the tab clips it).
    expect(placed[0]?.t0).toBeCloseTo(grid.barStart(0), 6)
    expect(placed[0]?.t1).toBeGreaterThan(placed[0]?.t0 ?? 0)
    expect(placed[0]?.t1).toBeLessThanOrEqual((grid.beatsOf(0)[1] ?? 0) + 1e-9)
    // Within the quantizer's residual of when it was heard.
    for (const note of placed) {
      const heard = view.notes.find((n) => n.id === note.id)?.onset ?? 0
      expect(Math.abs(note.t0 - heard)).toBeLessThan(0.08)
    }
  })

  it('carries confidence; notes with no place become "!" markers', () => {
    expect(placed.some((n) => n.band === 'low')).toBe(true)
    const unplaced = tab.events.map((e, i) =>
      i === 0 ? { ...e, string: undefined, fret: undefined } : e,
    )
    const result = fretNotes({ events: unplaced }, view, grid.grid)
    expect(result.notes).toHaveLength(tab.events.length - 1)
    expect(result.markers).toEqual([{ t: placed[0]?.t0, label: '!' }])
  })
})

describe('string names', () => {
  const sharps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  it('names the strings from the top, e over E', () => {
    expect(stringNames([64, 59, 55, 50, 45, 40], sharps)).toEqual(['e', 'B', 'G', 'D', 'A', 'E'])
    expect(stringNames([43, 38, 33, 28], sharps)).toEqual(['G', 'D', 'A', 'E'])
    expect(
      stringNames(
        [62, 57, 53, 48, 43, 38],
        ['C', 'D♭', 'D', 'E♭', 'E', 'F'].concat(sharps.slice(6)),
      ),
    ).toEqual(['d', 'A', 'F', 'C', 'G', 'D'])
  })
})
