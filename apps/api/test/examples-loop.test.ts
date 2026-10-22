import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Beats, Notes } from '@splitune/contracts'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { suggestLoop } from '../scripts/examples/loop.ts'

const FIXTURES = join(import.meta.dirname, '../../../packages/contracts/fixtures')
const fixture = <S extends z.ZodType>(name: string, schema: S): z.infer<S> =>
  schema.parse(JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')))

// A 4/4 grid of `bars` bars at `bpm`, starting at 0.5 s.
function grid(bars: number, bpm: number): z.infer<typeof Beats> {
  const base = fixture('beats.json', Beats)
  const beat = 60 / bpm
  return {
    ...base,
    bpm,
    duration_s: 0.5 + bars * 4 * beat,
    beats: Array.from({ length: bars * 4 }, (_, i) => ({
      id: `b${String(i).padStart(4, '0')}`,
      t: 0.5 + i * beat,
      activation: 0.9,
      is_downbeat: i % 4 === 0,
      bar_index: Math.floor(i / 4),
      beat_in_bar: (i % 4) + 1,
    })),
  }
}

function notesIn(beats: z.infer<typeof Beats>, playing: Record<number, number>) {
  const base = fixture('notes.guitar.json', Notes)
  const notes = beats.beats
    .filter((b) => playing[b.bar_index] !== undefined)
    .map((b, i) => ({
      ...(base.notes[0] as z.infer<typeof Notes>['notes'][number]),
      id: `n${String(i).padStart(6, '0')}`,
      onset_s: b.t,
      offset_s: b.t + 0.2,
      confidence: playing[b.bar_index] as number,
    }))
  return { ...base, notes }
}

describe('suggestLoop', () => {
  it('picks the four bars where the part plays most surely, skipping the first bar', () => {
    const beats = grid(12, 100)
    const notes = notesIn(beats, { 0: 0.99, 1: 0.5, 2: 0.5, 5: 0.9, 6: 0.95, 7: 0.9, 8: 0.92 })
    expect(suggestLoop(beats, notes)).toEqual({ start_bar: 5, end_bar: 8 })
  })

  it('suggests two bars when bars are long', () => {
    const beats = grid(10, 60)
    expect(suggestLoop(beats, notesIn(beats, { 3: 0.9, 4: 0.9 }))).toEqual({
      start_bar: 3,
      end_bar: 4,
    })
  })

  it('takes the earliest full window when there are no notes', () => {
    expect(suggestLoop(grid(8, 100), undefined)).toEqual({ start_bar: 1, end_bar: 4 })
  })

  it('works on the contracts fixture (8 bars at 100 BPM)', () => {
    const loop = suggestLoop(fixture('beats.json', Beats), fixture('notes.guitar.json', Notes))
    expect(loop.end_bar - loop.start_bar).toBe(3)
    expect(loop.start_bar).toBeGreaterThanOrEqual(1)
  })
})
