import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createBeatGrid, PPQ, quantizeDrumHits, quantizeNotes, tickToTime } from '../src/index.ts'
import type { DrumHit } from '../src/types.ts'
import { makeBeats } from './helpers.ts'

const grid = createBeatGrid(makeBeats({ bpm: 120, bars: 4, start: 0.5 }))
const at = (beat: number) => 0.5 + beat * 0.5

describe('quantizeNotes', () => {
  it('snaps onsets to the 1/16 grid with a signed residual', () => {
    const { notes } = quantizeNotes([{ id: 'a', onset_s: at(1) + 0.135, offset_s: at(2) }], grid)
    expect(notes[0]).toMatchObject({ bar: 0, beat: 2, tick: 240, durationTicks: 720 })
    expect(notes[0]?.residualMs).toBeCloseTo(10)
    expect(notes[0]?.residualFlagged).toBe(false)
  })

  it('flags residuals above 60 ms', () => {
    const { notes } = quantizeNotes(
      [{ id: 'a', onset_s: at(0) + 0.0624 + 0.001, offset_s: at(1) }],
      createBeatGrid(makeBeats({ bpm: 60, start: 0.5 })),
    )
    expect(notes[0]?.residualFlagged).toBe(true)
  })

  it('collapses onsets within 30 ms into one chord tick', () => {
    const { notes } = quantizeNotes(
      [0, 0.012, 0.025].map((d, i) => ({
        id: `s${i}`,
        onset_s: at(2) + 0.06 + d,
        offset_s: at(3),
      })),
      grid,
    )
    expect(new Set(notes.map((n) => n.onTick)).size).toBe(1)
  })

  it('gives every note at least one grid step', () => {
    const { notes } = quantizeNotes([{ id: 'a', onset_s: at(1), offset_s: at(1) + 0.01 }], grid)
    expect(notes[0]?.durationTicks).toBe(240)
  })

  it('detects swing per bar and uses the triplet-1/8 grid there', () => {
    const swung = [0, 1, 2, 3].flatMap((b) => [at(b), at(b) + 0.5 * (2 / 3) + 0.01])
    const straight = [4, 5, 6, 7].flatMap((b) => [at(b), at(b) + 0.25])
    const { notes, swingBars } = quantizeNotes(
      [...swung, ...straight].map((t, i) => ({ id: `n${i}`, onset_s: t, offset_s: t + 0.1 })),
      grid,
    )
    expect(swingBars).toEqual([0])
    expect(notes[1]?.tick).toBe(640)
    expect(notes[9]?.tick).toBe(480)
  })

  it('takes the grid step of the bar a note snaps into, not the bar it was played in', () => {
    // The last onset of a swung bar lands on the next (straight) bar's downbeat: its minimum
    // length is a straight 1/16, so its end stays on that bar's grid (and alphaTex can write it).
    const swung = [0, 1, 2, 3].flatMap((b) => [at(b), at(b) + 0.5 * (2 / 3) + 0.01])
    const straight = [5, 6, 7].flatMap((b) => [at(b), at(b) + 0.25])
    const late = { id: 'late', onset_s: at(3) + 0.49, offset_s: at(3) + 0.5 }
    const { notes, swingBars } = quantizeNotes(
      [
        ...[...swung, ...straight].map((t, i) => ({ id: `n${i}`, onset_s: t, offset_s: t + 0.1 })),
        late,
      ],
      grid,
    )
    expect(swingBars).toEqual([0])
    expect(notes.at(-1)).toMatchObject({ onTick: 4 * PPQ, bar: 1, durationTicks: 240 })
  })

  it('clamps notes before the pickup bar to its first beat', () => {
    const { notes } = quantizeNotes(
      [{ id: 'a', onset_s: 0, offset_s: 0.1 }],
      createBeatGrid(makeBeats({ start: 3 })),
    )
    expect(notes[0]).toMatchObject({ bar: -1, beat: 1, tick: 0 })
    expect(notes[0]?.residualFlagged).toBe(true)
  })

  it('is idempotent (property)', () => {
    const tempoGrid = fc.record({
      bpm: fc.integer({ min: 50, max: 240 }),
      start: fc.double({ min: 0, max: 2, noNaN: true }),
    })
    const note = fc.record({
      onset: fc.double({ min: 0, max: 12, noNaN: true }),
      length: fc.double({ min: 0, max: 2, noNaN: true }),
    })
    fc.assert(
      fc.property(tempoGrid, fc.array(note, { maxLength: 40 }), (g, raw) => {
        const beatGrid = createBeatGrid(makeBeats({ bpm: g.bpm, bars: 6, start: g.start }))
        const input = raw.map((n, i) => ({
          id: `n${i}`,
          onset_s: n.onset,
          offset_s: n.onset + n.length,
        }))
        const first = quantizeNotes(input, beatGrid)
        const again = quantizeNotes(
          first.notes.map((q) => ({
            id: q.noteId,
            onset_s: tickToTime(beatGrid, q.onTick),
            offset_s: tickToTime(beatGrid, q.offTick),
          })),
          beatGrid,
        )
        expect(again.notes.map(({ residualMs: _r, residualFlagged: _f, ...rest }) => rest)).toEqual(
          first.notes.map(({ residualMs: _r, residualFlagged: _f, ...rest }) => rest),
        )
        expect(again.swingBars).toEqual(first.swingBars)
        for (const q of again.notes) expect(Math.abs(q.residualMs)).toBeLessThan(1e-6)
      }),
      { numRuns: 1000 },
    )
  })

  it('is idempotent for notes long before the first beat (regression)', () => {
    const beatGrid = createBeatGrid(makeBeats({ bpm: 216, bars: 6, start: 1.7476805 }))
    const first = quantizeNotes(
      [0, 0].map((t, i) => ({ id: `n${i}`, onset_s: t, offset_s: t })),
      beatGrid,
    )
    const again = quantizeNotes(
      first.notes.map((q) => ({
        id: q.noteId,
        onset_s: tickToTime(beatGrid, q.onTick),
        offset_s: tickToTime(beatGrid, q.offTick),
      })),
      beatGrid,
    )
    expect(again.notes.map((q) => [q.onTick, q.offTick])).toEqual(
      first.notes.map((q) => [q.onTick, q.offTick]),
    )
  })
})

describe('quantizeDrumHits', () => {
  const hit = (id: string, t: number, class5: DrumHit['class5'] = 'snare'): DrumHit => ({
    id,
    onset_s: t,
    class5,
    gm_note: 38,
    confidence: 0.9,
    approximate: false,
  })

  it('collapses same-class hits within 25 ms into one flam', () => {
    const { hits } = quantizeDrumHits(
      [hit('a', at(1)), hit('b', at(1) + 0.02), hit('k', at(1) + 0.01, 'kick')],
      grid,
    )
    expect(hits.map((h) => [h.hitId, h.flam, h.mergedIds])).toEqual([
      ['a', true, ['b']],
      ['k', false, []],
    ])
    expect(hits[0]?.onTick).toBe(PPQ)
  })

  it('keeps hits further apart than the flam window', () => {
    const { hits } = quantizeDrumHits([hit('a', at(1)), hit('b', at(1) + 0.125)], grid)
    expect(hits).toHaveLength(2)
  })
})
