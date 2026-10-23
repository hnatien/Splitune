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
    expect(out.piano).toBeUndefined()
    expect(out.beats.beats.length).toBeGreaterThan((beats as Beats).beats.length)
    expect(out.displayChords.length).toBeGreaterThan(0)
  })

  it('gives piano the hand-split notes and the grand staff, with corrections, and no tab', () => {
    const piano = { ...(notes as Notes), artefact: 'notes.piano', instrument: 'piano' } as Notes
    const out = computeMusic(
      input({
        notes: piano,
        ops: { beats: [], chords: [], notes: [{ op: 'delete_note', note_id: 'n000000' }] },
      }),
    )
    expect(out.tab).toBeUndefined()
    expect(out.piano?.notes.length).toBe(piano.notes.length - 1)
    expect(out.piano?.notes.some((n) => n.id === 'n000000')).toBe(false)
    expect(new Set(out.piano?.notes.map((n) => n.hand))).toEqual(new Set(['left', 'right']))
    expect(out.displayChords.length).toBeGreaterThan(0)
    // The staff maps every note once, the deleted one not at all, on both staves.
    const staff = out.piano?.staff
    expect(staff?.alphaTex).toContain('\\clef F4')
    expect(staff?.noteMap.map((r) => r.noteId).sort()).toEqual(
      out.piano?.notes.map((n) => n.id).sort(),
    )
    expect(new Set(staff?.noteMap.map((r) => r.staff))).toEqual(new Set([0, 1]))
  })
})
