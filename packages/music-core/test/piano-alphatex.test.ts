import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  buildPianoScore,
  createBeatGrid,
  type PianoAlphaTexResult,
  type PianoTexNote,
  PPQ,
  toPianoAlphaTex,
} from '../src/index.ts'
import { loadAlphaTex, voiceDurationMismatches } from './alphatab.ts'
import { makeBeats, makeChords, makeNotes } from './helpers.ts'

const grid = createBeatGrid(makeBeats({ bars: 4, start: 0.5 }))
const base = { grid, meterDenominator: 4, tempo: 120, swingBars: [] }

const note = (
  noteId: string,
  pitch: number,
  hand: 'left' | 'right',
  onBeat: number,
  offBeat: number,
): PianoTexNote => ({ noteId, pitch, hand, onTick: onBeat * PPQ, offTick: offBeat * PPQ })

// Every noteMap entry points at a fresh (not tied) alphaTab note of the right pitch, and every
// note is mapped once.
function rendered(result: PianoAlphaTexResult, notes: readonly { id: string; pitch: number }[]) {
  const { score, diagnostics } = loadAlphaTex(result.tex)
  expect(diagnostics).toEqual([])
  expect(voiceDurationMismatches(score)).toEqual([])
  const staves = score.tracks[0]?.staves ?? []
  expect(staves).toHaveLength(2)
  const pitches = new Map(notes.map((n) => [n.id, n.pitch]))
  expect(result.noteMap.map((r) => r.noteId).sort()).toEqual([...pitches.keys()].sort())
  for (const ref of result.noteMap) {
    const beat = staves[ref.staff]?.bars[ref.bar]?.voices[ref.voice]?.beats[ref.beat]
    const found = beat?.notes[ref.note]
    if (found === undefined) throw new Error(`noteMap entry ${ref.noteId} not found`)
    expect(found.realValue).toBe(pitches.get(ref.noteId))
    // Written at pitch: no guitar-style octave transposition on either staff.
    expect(found.displayValue).toBe(found.realValue)
    expect(found.isTieDestination).toBe(false)
  }
  // …and every other rendered note continues one by a tie.
  const fresh = staves.flatMap((staff) =>
    staff.bars.flatMap((bar) =>
      bar.voices.flatMap((voice) =>
        voice.beats.flatMap((beat) => beat.notes.filter((n) => !n.isTieDestination)),
      ),
    ),
  )
  expect(fresh).toHaveLength(result.noteMap.length)
  return score
}

describe('toPianoAlphaTex', () => {
  it('writes the right hand on the treble staff and the left on the bass staff', () => {
    const notes = [
      note('c', 60, 'right', 0, 1),
      note('e', 64, 'right', 0, 1),
      note('g', 67, 'right', 1, 2),
      note('bass', 48, 'left', 0, 2),
    ]
    const result = toPianoAlphaTex({ ...base, notes })
    expect(result.tex).toBe(
      [
        '\\track "Piano"',
        '\\staff {score} \\tuning piano \\instrument acousticgrandpiano',
        '\\ts (4 4) \\tempo 120 \\ks Cmajor (C4 E4).4 G4.4 r.2',
        '\\staff {score} \\tuning piano',
        '\\clef F4 \\ks Cmajor C3.2 r.2',
        '',
      ].join('\n'),
    )
    const score = rendered(
      result,
      notes.map((n) => ({ id: n.noteId, pitch: n.pitch })),
    )
    expect(score.tracks[0]?.staves[1]?.bars[0]?.clef).toBe(3) // Clef.F4
  })

  it('ties notes over the bar line and inside a bar', () => {
    const result = toPianoAlphaTex({
      ...base,
      notes: [note('a', 69, 'right', 3, 5), note('b', 71, 'right', 5, 8)],
    })
    expect(result.tex).toContain('A4.4 |\nA4{t}.4 B4.4 B4{t}.2')
    const score = rendered(result, [
      { id: 'a', pitch: 69 },
      { id: 'b', pitch: 71 },
    ])
    const tied = score.tracks[0]?.staves[0]?.bars[1]?.voices[0]?.beats[0]?.notes[0]
    expect(tied?.isTieDestination).toBe(true)
    expect(tied?.tieOrigin?.realValue).toBe(69)
  })

  it('moves a held bass note to a second voice under a moving line', () => {
    const notes = [
      note('held', 36, 'left', 0, 4),
      note('m1', 43, 'left', 1, 2),
      note('m2', 48, 'left', 2, 3),
      note('m3', 52, 'left', 3, 4),
      note('r', 72, 'right', 0, 4),
    ]
    const result = toPianoAlphaTex({ ...base, notes })
    expect(result.tex).toContain('\\voice\n\\clef F4 \\ks Cmajor r.4 G2.4 C3.4 E3.4\n\\voice\nC2.1')
    rendered(
      result,
      notes.map((n) => ({ id: n.noteId, pitch: n.pitch })),
    )
    expect(result.noteMap.find((r) => r.noteId === 'held')).toMatchObject({ staff: 1, voice: 1 })
  })

  it('ends a legato overlap at the next onset instead of opening a voice', () => {
    const result = toPianoAlphaTex({
      ...base,
      notes: [note('a', 72, 'right', 0, 1.25), note('b', 74, 'right', 1, 2)],
    })
    expect(result.tex).not.toContain('\\voice')
    expect(result.tex).toContain('C5.4 D5.4 r.2')
  })

  it('cuts the voice that ends first when both voices still ring', () => {
    const notes = [
      note('a', 48, 'left', 0, 4),
      note('b', 55, 'left', 1, 4),
      note('c', 52, 'left', 2, 3),
    ]
    const result = toPianoAlphaTex({ ...base, notes })
    rendered(
      result,
      notes.map((n) => ({ id: n.noteId, pitch: n.pitch })),
    )
    expect(result.tex).toContain('\\voice')
  })

  it('changes clef for bars where a hand moves far over, and back', () => {
    // The left hand climbs above middle C for bar 2 (a short dip of the right hand stays put).
    const notes = [
      note('l1', 48, 'left', 0, 4),
      note('l2', 72, 'left', 4, 6),
      note('l3', 76, 'left', 6, 8),
      note('l4', 43, 'left', 8, 12),
      note('r1', 72, 'right', 0, 2),
      note('r2', 59, 'right', 2, 4),
      note('r3', 74, 'right', 4, 16),
    ]
    const result = toPianoAlphaTex({ ...base, notes })
    const score = rendered(
      result,
      notes.map((n) => ({ id: n.noteId, pitch: n.pitch })),
    )
    // Clef: 4 = G2, 3 = F4 (alphaTab's Clef enum).
    const clefs = (staff: number) => score.tracks[0]?.staves[staff]?.bars.map((b) => b.clef)
    expect(clefs(0)).toEqual([4, 4, 4, 4])
    expect(clefs(1)).toEqual([3, 4, 3, 3])
    expect(result.tex).toContain('\\clef G2 C5.2 E5.2 |\n\\clef F4 G2.1')
  })

  it('spells notes for the key under its key signature', () => {
    const flats = toPianoAlphaTex({
      ...base,
      key: { tonic: 'D#', mode: 'major' },
      notes: [note('a', 63, 'right', 0, 1), note('b', 70, 'right', 1, 2)],
    })
    expect(flats.tex).toContain('\\ks Ebmajor Eb4.4 Bb4.4')
    const flatScore = rendered(flats, [
      { id: 'a', pitch: 63 },
      { id: 'b', pitch: 70 },
    ])
    // Both staves carry the signature (alphaTab keeps it per staff).
    expect(flatScore.tracks[0]?.staves.map((st) => st.bars[0]?.keySignature)).toEqual([-3, -3])
    // C# minor's leading tone is B#, an octave number below the C it sounds as; G# minor's is F##.
    const sharps = toPianoAlphaTex({
      ...base,
      key: { tonic: 'C#', mode: 'minor' },
      notes: [note('b', 60, 'right', 0, 1)],
    })
    expect(sharps.tex).toContain('\\ks C#minor B#3.4')
    rendered(sharps, [{ id: 'b', pitch: 60 }])
    const doubleSharp = toPianoAlphaTex({
      ...base,
      key: { tonic: 'G#', mode: 'minor' },
      notes: [note('f', 67, 'right', 0, 1)],
    })
    expect(doubleSharp.tex).toContain('Fx4.4')
    rendered(doubleSharp, [{ id: 'f', pitch: 67 }])
  })

  it('writes a pickup bar and swing triplets', () => {
    const pickupGrid = createBeatGrid(makeBeats({ bars: 2, pickup: 1, start: 0.5 }))
    const pickup = toPianoAlphaTex({
      ...base,
      grid: pickupGrid,
      notes: [note('p', 64, 'right', 0, 1), note('d', 45, 'left', 1, 5)],
    })
    expect(pickup.firstBar).toBe(-1)
    expect(pickup.tex).toContain('\\ac E4.4 |')
    const score = rendered(pickup, [
      { id: 'p', pitch: 64 },
      { id: 'd', pitch: 45 },
    ])
    expect(score.masterBars[0]?.isAnacrusis).toBe(true)

    const swing = toPianoAlphaTex({
      ...base,
      swingBars: [0],
      notes: [0, 640, 960, 1600].map((t, i) => ({
        noteId: `s${i}`,
        pitch: 67,
        hand: 'right' as const,
        onTick: t,
        offTick: t + 320,
      })),
    })
    expect(swing.tex).toContain('{tu 3}')
    rendered(
      swing,
      [0, 1, 2, 3].map((i) => ({ id: `s${i}`, pitch: 67 })),
    )
  })

  it('loads with no notes at all', () => {
    const empty = toPianoAlphaTex({ ...base, notes: [] })
    rendered(empty, [])
  })
})

describe('buildPianoScore → alphaTab', () => {
  it('loads for random parts, pickups and meters (property)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            onset: fc.double({ min: 0, max: 9, noNaN: true }),
            length: fc.double({ min: 0.01, max: 4, noNaN: true }),
            pitch: fc.integer({ min: 21, max: 108 }),
          }),
          { maxLength: 40 },
        ),
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 2, max: 7 }),
        fc.constantFrom(
          { tonic: 'C', mode: 'major' as const },
          { tonic: 'Eb', mode: 'major' as const },
          { tonic: 'F#', mode: 'minor' as const },
        ),
        (raw, pickup, numerator, key) => {
          const notes = makeNotes(
            raw.map((n) => ({
              onset_s: n.onset,
              offset_s: n.onset + n.length,
              pitch_midi: n.pitch,
            })),
            'piano',
          )
          const chords = {
            ...makeChords([{ t0: 0, t1: 9, label: 'C:maj' }]),
            key: { ...key, confidence: 0.8 },
          }
          const result = buildPianoScore(
            notes,
            makeBeats({ bars: 4, pickup, numerator, start: 0.4 }),
            {},
            { chords },
          )
          rendered(
            { tex: result.alphaTex, firstBar: result.alphaTexFirstBar, noteMap: result.noteMap },
            result.notes.map((n) => ({ id: n.id, pitch: n.pitch })),
          )
        },
      ),
      { numRuns: 150 },
    )
  })
})
