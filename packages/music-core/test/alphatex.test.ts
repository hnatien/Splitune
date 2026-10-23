import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { buildTab, createBeatGrid, PPQ, toAlphaTex } from '../src/index.ts'
import { barDurationMismatches, loadAlphaTex } from './alphatab.ts'
import { denseGuitarPart, fixtures, makeBeats, makeChords, makeNotes } from './helpers.ts'

function realValues(
  tex: ReturnType<typeof toAlphaTex>,
  score: ReturnType<typeof loadAlphaTex>['score'],
) {
  const staff = score.tracks[0]?.staves[0]
  return tex.noteMap.map((ref) => {
    const note = staff?.bars[ref.bar]?.voices[ref.voice]?.beats[ref.beat]?.notes[ref.note]
    if (note === undefined) throw new Error(`noteMap entry ${ref.noteId} not found`)
    return {
      id: ref.noteId,
      pitch: note.realValue,
      string: (staff?.tuning.length ?? 0) - note.string + 1,
    }
  })
}

describe('toAlphaTex', () => {
  const grid = createBeatGrid(makeBeats({ bars: 4, start: 0.5 }))
  const base = {
    grid,
    tuningMidi: [64, 59, 55, 50, 45, 40],
    capo: 0,
    meterDenominator: 4,
    tempo: 120,
    chords: [],
    swingBars: [],
  }

  it('writes 1.8 syntax that alphaTab loads without any diagnostic', () => {
    const tex = toAlphaTex({
      ...base,
      title: 'He said "hi"',
      chordNames: true,
      chords: [{ onTick: 0, name: 'Am' }],
      events: [
        { noteId: 'a', onTick: 0, offTick: 720, string: 5, fret: 0 },
        { noteId: 'b', onTick: 0, offTick: 720, string: 3, fret: 2 },
        { noteId: 'c', onTick: 720, offTick: 960, string: 2, fret: 1 },
      ],
    })
    expect(tex.tex).not.toMatch(/^\.$/m)
    expect(tex.tex).toContain('\\ts (4 4) \\tempo 120')
    expect(tex.tex).toContain('(0.5 2.3).8 {d ch "Am"}')
    const { score, diagnostics } = loadAlphaTex(tex.tex)
    expect(diagnostics).toEqual([])
    expect(score.title).toBe('He said "hi"')
    expect(barDurationMismatches(score)).toEqual([])
  })

  it('omits chord names unless asked', () => {
    const tex = toAlphaTex({
      ...base,
      chords: [{ onTick: 0, name: 'Am' }],
      events: [{ noteId: 'a', onTick: 0, offTick: 960, string: 5, fret: 0 }],
    })
    expect(tex.tex).not.toContain('ch ')
  })

  it('writes frets relative to the capo, as alphaTab expects', () => {
    const tex = toAlphaTex({
      ...base,
      capo: 3,
      events: [{ noteId: 'a', onTick: 0, offTick: 960, string: 1, fret: 5 }],
    })
    expect(tex.tex).toContain('\\capo 3')
    const { score } = loadAlphaTex(tex.tex)
    expect(realValues(tex, score)).toEqual([{ id: 'a', pitch: 69, string: 1 }])
  })

  it('ties notes across bar lines', () => {
    const tex = toAlphaTex({
      ...base,
      events: [{ noteId: 'a', onTick: 3 * PPQ, offTick: 5 * PPQ, string: 3, fret: 2 }],
    })
    expect(tex.tex).toMatch(/2\.3\.4 \|\n-\.3\.4/)
    expect(loadAlphaTex(tex.tex).diagnostics).toEqual([])
  })

  it('marks a pickup bar with \\ac and maps notes into it', () => {
    const pickupGrid = createBeatGrid(makeBeats({ bars: 2, pickup: 1, start: 0.5 }))
    const tex = toAlphaTex({
      ...base,
      grid: pickupGrid,
      events: [
        { noteId: 'p', onTick: 0, offTick: 480, string: 2, fret: 1 },
        { noteId: 'd', onTick: PPQ, offTick: 2 * PPQ, string: 3, fret: 2 },
      ],
    })
    expect(tex.firstBar).toBe(-1)
    expect(tex.tex).toMatch(/\\ac 1\.2\.8 r\.8 \|/)
    const { score, diagnostics } = loadAlphaTex(tex.tex)
    expect(diagnostics).toEqual([])
    expect(score.masterBars[0]?.isAnacrusis).toBe(true)
    expect(tex.noteMap.map((r) => [r.noteId, r.bar, r.beat])).toEqual([
      ['p', 0, 0],
      ['d', 1, 0],
    ])
  })

  it('writes swing bars with complete triplet groups', () => {
    const tex = toAlphaTex({
      ...base,
      swingBars: [0],
      events: [0, 640, 960, 1600].map((t, i) => ({
        noteId: `s${i}`,
        onTick: t,
        offTick: t + 320,
        string: 3,
        fret: 2,
      })),
    })
    expect(tex.tex).toContain('{tu 3}')
    const { score, diagnostics } = loadAlphaTex(tex.tex)
    expect(diagnostics).toEqual([])
    expect(barDurationMismatches(score)).toEqual([])
  })

  it('never writes a dotted quarter in a swing bar', () => {
    // A swing bar whose first note is the last triplet of beat 2 opens with 1600 ticks of rest:
    // a dotted quarter (1440) would leave 160 ticks off the triplet grid.
    const tex = toAlphaTex({
      ...base,
      swingBars: [0],
      events: [{ noteId: 's', onTick: 1600, offTick: 1920, string: 3, fret: 2 }],
    })
    expect(tex.tex).toContain('r.4 r.8 {tu 3} r.8 {tu 3} 2.3.8 {tu 3} r.2')
    const { score, diagnostics } = loadAlphaTex(tex.tex)
    expect(diagnostics).toEqual([])
    expect(barDurationMismatches(score)).toEqual([])
  })
})

describe('buildTab → alphaTab', () => {
  it('round-trips pitch and string for every rendered note (fixtures with all corrections)', () => {
    const ops = fixtures.corrections()
    const result = buildTab(
      fixtures.notes(),
      fixtures.beats(),
      { notes: ops, beats: ops, chords: ops },
      { chords: fixtures.chords(), chordNames: true },
    )
    const { score, diagnostics } = loadAlphaTex(result.alphaTex)
    expect(diagnostics).toEqual([])
    expect(barDurationMismatches(score)).toEqual([])
    const events = new Map(result.tab.events.map((e) => [e.note_id, e]))
    const rendered = realValues(
      { tex: result.alphaTex, firstBar: result.alphaTexFirstBar, noteMap: result.noteMap },
      score,
    )
    expect(rendered).toHaveLength(result.tab.events.filter((e) => e.string !== undefined).length)
    for (const r of rendered) {
      const e = events.get(r.id)
      expect(r.string).toBe(e?.string)
      expect(r.pitch).toBe(
        (result.tab.tuning_midi[(e?.string ?? 1) - 1] as number) + (e?.fret ?? 0),
      )
    }
  })

  it('loads for random parts, levels, capos and swing (property)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            onset: fc.double({ min: 0, max: 9, noNaN: true }),
            length: fc.double({ min: 0.01, max: 3, noNaN: true }),
            pitch: fc.integer({ min: 30, max: 90 }),
          }),
          { maxLength: 30 },
        ),
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 2 }),
        fc.constantFrom('as_transcribed' as const, 'simplified' as const, 'chords_only' as const),
        fc.integer({ min: 2, max: 7 }),
        (raw, capo, pickup, level, numerator) => {
          const notes = makeNotes(
            raw.map((n) => ({
              onset_s: n.onset,
              offset_s: n.onset + n.length,
              pitch_midi: n.pitch,
            })),
          )
          const chords = makeChords([
            { t0: 0, t1: 4, label: 'A:min7' },
            { t0: 4, t1: 9, label: 'F:maj' },
          ])
          const result = buildTab(
            notes,
            makeBeats({ bars: 4, pickup, numerator, start: 0.4 }),
            {},
            { chords, capo, level, chordNames: true },
          )
          const { score, diagnostics } = loadAlphaTex(result.alphaTex)
          expect(diagnostics).toEqual([])
          expect(barDurationMismatches(score)).toEqual([])
        },
      ),
      { numRuns: 150 },
    )
  })

  it('marks low-confidence chord names with "?" above the tab', () => {
    const notes = makeNotes([{ onset_s: 0.5, offset_s: 1, pitch_midi: 57 }])
    const chords = makeChords([
      { t0: 0, t1: 4, label: 'A:min7', confidence: 0.95 },
      { t0: 4, t1: 9, label: 'F:maj', confidence: 0.05 },
    ])
    const beats = makeBeats({ bars: 4, pickup: 0, numerator: 4, start: 0 })
    const named = buildTab(notes, beats, {}, { chords, chordNames: true })
    expect(named.alphaTex).toContain('ch "Am7"')
    expect(named.alphaTex).toContain('ch "F?"')
    expect(loadAlphaTex(named.alphaTex).diagnostics).toEqual([])
    // Without chord names the tab carries none, marked or not.
    expect(buildTab(notes, beats, {}, { chords }).alphaTex).not.toContain('ch "')
  })

  it('spells chord names for the key, following the playback transposition', () => {
    const notes = makeNotes([{ onset_s: 0.5, offset_s: 1, pitch_midi: 63 }])
    const chords = {
      ...makeChords([
        { t0: 0, t1: 4, label: 'D#:maj7' },
        { t0: 4, t1: 9, label: 'A#:7' },
      ]),
      key: { tonic: 'D#', mode: 'major' as const, confidence: 0.8 },
    }
    const beats = makeBeats({ bars: 4, pickup: 0, numerator: 4, start: 0 })
    const named = buildTab(notes, beats, {}, { chords, chordNames: true })
    expect(named.alphaTex).toContain('ch "Ebmaj7"')
    expect(named.alphaTex).toContain('ch "Bb7"')
    // Up a semitone the song is in E major: sharps.
    const up = buildTab(notes, beats, {}, { chords, chordNames: true, transpose: { semitones: 1 } })
    expect(up.alphaTex).toContain('ch "Emaj7"')
    expect(up.alphaTex).toContain('ch "B7"')
  })

  it('loads the dense synthetic part', () => {
    const part = denseGuitarPart()
    const result = buildTab(part.notes, part.beats, {}, { chords: part.chords, chordNames: true })
    const { score, diagnostics } = loadAlphaTex(result.alphaTex)
    expect(diagnostics).toEqual([])
    expect(barDurationMismatches(score)).toEqual([])
  })
})
