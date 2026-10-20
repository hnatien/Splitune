import { Tab } from '@splitune/contracts'
import { describe, expect, it } from 'vitest'
import { buildTab, MUSIC_CORE_VERSION } from '../src/index.ts'
import { denseGuitarPart, fixtures, makeBeats, makeChords, makeNotes } from './helpers.ts'

describe('buildTab', () => {
  it('produces a valid Tab contract from the fixtures with every correction applied', () => {
    const ops = fixtures.corrections()
    const result = buildTab(
      fixtures.notes(),
      fixtures.beats(),
      { notes: ops, beats: ops, chords: ops, beatsRev: 7 },
      { chords: fixtures.chords() },
    )
    expect(Tab.safeParse(result.tab).error).toBeUndefined()
    expect(result.tab).toMatchObject({
      artefact: 'tab.guitar',
      notes_ref: { artefact: 'notes.guitar', artefact_version: 1 },
      beats_ref: { artefact_version: 1, corrections_rev: 7 },
      level: 'as_transcribed',
      fingering_mode: 'easiest',
      music_core_version: MUSIC_CORE_VERSION,
    })
    const ids = result.tab.events.map((e) => e.note_id)
    expect(ids).toContain('u000001')
    expect(ids).not.toContain('n000027')
    expect(result.tab.events.find((e) => e.note_id === 'n000013')).toMatchObject({
      string: 3,
      fret: 2,
    })
    expect(result.skippedCorrections).toEqual({ notes: [], beats: [], chords: [] })
  })

  it('is the plain transcription when there are no corrections', () => {
    const notes = fixtures.notes()
    const result = buildTab(notes, fixtures.beats())
    expect(result.tab.events).toHaveLength(notes.notes.length)
    expect(result.effective.notes).toBe(notes)
    expect(result.tab.events.every((e) => e.string !== undefined)).toBe(true)
  })

  it('clips a note at the next onset on the same string', () => {
    const notes = makeNotes([
      { id: 'a', onset_s: 0.5, offset_s: 2.5, pitch_midi: 64 },
      { id: 'b', onset_s: 1, offset_s: 1.5, pitch_midi: 64 },
    ])
    const events = buildTab(notes, makeBeats()).tab.events
    expect(events.map((e) => [e.note_id, e.duration_ticks])).toEqual([
      ['a', 960],
      ['b', 960],
    ])
  })

  it('applies levels', () => {
    const notes = makeNotes([
      { onset_s: 0.5, pitch_midi: 64, confidence: 0.9 },
      { onset_s: 0.75, pitch_midi: 67, confidence: 0.9 },
      { onset_s: 1, pitch_midi: 69, confidence: 0.1 },
    ])
    expect(buildTab(notes, makeBeats(), {}, { level: 'chords_only' }).tab.events).toEqual([])
    expect(
      buildTab(notes, makeBeats(), {}, { level: 'simplified' }).tab.events.map((e) => e.note_id),
    ).toEqual(['n000000'])
    expect(() => buildTab(notes, makeBeats(), {}, { level: 'roots' })).toThrow(RangeError)
  })

  it('builds bass roots from chords on downbeats', () => {
    const notes = makeNotes([{ onset_s: 0.5, pitch_midi: 45 }], 'bass')
    const chords = makeChords([{ t0: 0.5, t1: 4.5, label: 'A:min' }])
    const tab = buildTab(notes, makeBeats(), {}, { chords, level: 'roots' }).tab
    expect(tab.events.map((e) => [e.note_id, e.bar, e.string, e.fret])).toEqual([
      // The root follows the transcribed register (A2), i.e. G string fret 2.
      ['root:c0000@0', 0, 1, 2],
      ['root:c0000@1', 1, 1, 2],
    ])
    expect(tab.tuning_midi).toEqual([43, 38, 33, 28])
  })

  it('keeps shapes under a playback transposition by moving the capo', () => {
    const notes = makeNotes([
      { onset_s: 0.5, pitch_midi: 48 },
      { onset_s: 0.5, pitch_midi: 52 },
      { onset_s: 0.5, pitch_midi: 55 },
    ])
    const plain = buildTab(notes, makeBeats()).tab
    const shifted = buildTab(notes, makeBeats(), {}, { transpose: { semitones: 2 } })
    expect(shifted.tab.capo).toBe(2)
    expect(shifted.tab.events.map((e) => [e.string, (e.fret ?? 0) - 2])).toEqual(
      plain.events.map((e) => [e.string, e.fret]),
    )
    const down = buildTab(notes, makeBeats(), {}, { transpose: { semitones: -2 } })
    expect(down.warnings).toContain('keep_shapes_unavailable')
    expect(down.tab.capo).toBe(0)
  })

  it('flags unplayable notes and far-off-grid notes', () => {
    const notes = makeNotes([
      { id: 'low', onset_s: 0.5, pitch_midi: 30 },
      { id: 'late', onset_s: 1.08, pitch_midi: 60 },
    ])
    const result = buildTab(notes, makeBeats({ bpm: 60 }))
    expect(result.tab.events.find((e) => e.note_id === 'low')).toMatchObject({ unplayable: true })
    expect(result.warnings).toContain('unplayable_notes')
    expect(result.residualFlagged).toEqual(['late'])
  })

  it('records swing bars', () => {
    const times = [0, 1, 2, 3].flatMap((b) => [0.5 + b * 0.5, 0.5 + b * 0.5 + 0.34])
    const notes = makeNotes(times.map((t) => ({ onset_s: t, pitch_midi: 60 })))
    expect(buildTab(notes, makeBeats()).tab.swing_bars).toEqual([0])
  })

  it('rejects instruments without tab', () => {
    const notes = { ...makeNotes([]), instrument: 'piano' as const, artefact: 'notes.piano' }
    expect(() => buildTab(notes, makeBeats())).toThrow(RangeError)
  })

  it('handles the dense synthetic part', () => {
    const part = denseGuitarPart()
    const result = buildTab(part.notes, part.beats, {}, { chords: part.chords })
    expect(Tab.safeParse(result.tab).error).toBeUndefined()
    expect(result.tab.events).toHaveLength(part.notes.notes.length)
  })
})
