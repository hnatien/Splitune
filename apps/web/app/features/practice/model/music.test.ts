import beats from '@splitune/contracts/fixtures/beats.json'
import chords from '@splitune/contracts/fixtures/chords.json'
import notes from '@splitune/contracts/fixtures/notes.guitar.json'
import type { Beats, Chords, Notes } from '@splitune/music-core'
import { describe, expect, it } from 'vitest'
import { computeMusic, type MusicInput } from './music'

const input = (patch: Partial<MusicInput> = {}): MusicInput => ({
  beats: beats as Beats,
  chords: chords as Chords,
  notes: notes as Notes,
  ops: { beats: [], chords: [], notes: [] },
  beatsRev: 0,
  options: { capo: 0, level: 'as_transcribed', fingeringMode: 'easiest' },
  ...patch,
})

describe('effective music', () => {
  it('builds the tab and display chords', () => {
    const out = computeMusic(input())
    expect(out.tab?.noteMap.length).toBeGreaterThan(0)
    expect(out.tab?.alphaTex).toContain('\\staff {tabs}')
    expect(out.displayChords.map((c) => c.label)).toContain('A:min')
    // Chord names ride above the bars of the tab.
    expect(out.tab?.alphaTex).toMatch(/ch "Am\??"/)
  })

  it('applies chord and note corrections as overlays', () => {
    const out = computeMusic(
      input({
        ops: {
          beats: [],
          chords: [{ op: 'set_chord', segment_id: 'c0002', label: 'D:min' }],
          notes: [{ op: 'delete_note', note_id: 'n000000' }],
        },
      }),
    )
    expect(out.chords?.segments.find((s) => s.id === 'c0002')?.label).toBe('D:min')
    expect(out.tab?.notes.some((n) => n.id === 'n000000')).toBe(false)
    expect(out.tab?.noteMap.some((r) => r.noteId === 'n000000')).toBe(false)
  })

  it('re-frets for a capo', () => {
    const open = computeMusic(input())
    const capo = computeMusic(
      input({ options: { capo: 2, level: 'as_transcribed', fingeringMode: 'easiest' } }),
    )
    expect(capo.tab?.capo).toBe(2)
    expect(capo.tab?.alphaTex).toContain('\\capo 2')
    expect(capo.tab?.events).not.toEqual(open.tab?.events)
  })

  it('falls back to a valid level for the instrument', () => {
    const out = computeMusic(
      input({ options: { capo: 0, level: 'roots', fingeringMode: 'easiest' } }),
    )
    expect(out.tab).toBeDefined()
  })

  it('gives chords and beats only without notes', () => {
    const out = computeMusic(
      input({
        notes: undefined,
        ops: { beats: [{ op: 'tempo_octave', factor: 'double' }], chords: [], notes: [] },
      }),
    )
    expect(out.tab).toBeUndefined()
    expect(out.beats.beats.length).toBeGreaterThan((beats as Beats).beats.length)
    expect(out.displayChords.length).toBeGreaterThan(0)
  })
})
