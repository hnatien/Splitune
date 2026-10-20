import { expect, test } from 'vitest'
import { buildTab } from '../src/index.ts'
import { denseGuitarPart } from './helpers.ts'

const part = denseGuitarPart()

// Budget (07-music-algorithms.md): full re-quantize + re-fret of a 4-min part ≤150 ms.
test(`buildTab on a synthetic dense 4-minute guitar part (${part.notes.notes.length} notes)`, async ({
  bench,
}) => {
  const results = await bench.compare(
    bench('as_transcribed, easiest', () => {
      buildTab(part.notes, part.beats, {}, { chords: part.chords })
    }),
    bench('simplified, easiest', () => {
      buildTab(part.notes, part.beats, {}, { chords: part.chords, level: 'simplified' })
    }),
  )
  expect(results.get('as_transcribed, easiest').latency.mean).toBeGreaterThan(0)
})
