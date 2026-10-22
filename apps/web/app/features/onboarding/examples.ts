import type { Example } from '@splitune/contracts'
import { queryOptions } from '@tanstack/react-query'
import type { z } from 'zod'
import { answerLocally, client } from '@/lib/api'
import { guestProcedures } from './guest-link'
import { guestStore } from './guest-store'

export type ExampleSong = z.infer<typeof Example>

// The example songs (13 §1), from the manifest the API ships. They change only with a deploy.
export const examplesQuery = queryOptions({
  queryKey: ['examples'],
  queryFn: ({ signal }) => client.examples.list(undefined, { signal }),
  staleTime: Number.POSITIVE_INFINITY,
})

/** From here on this page answers the example songs' procedures on the device (guest-link.ts). */
export function practiseAsGuest(examples: ExampleSong[]) {
  answerLocally(guestProcedures(examples, guestStore))
}

/**
 * The example for the onboarding answers: the instrument's own part (guitar: chords for someone
 * who just started, the riff otherwise), else a guitar one ("Something else").
 */
export function exampleFor(
  examples: ExampleSong[],
  instrument: string | null,
  level: string | null,
): ExampleSong | undefined {
  const own = examples.filter((e) => e.instrument === instrument)
  const guitar = examples.filter((e) => e.instrument === 'guitar')
  const pool = own.length > 0 ? own : guitar.length > 0 ? guitar : examples
  const part = level === 'just_started' ? 'rhythm' : 'riff'
  return pool.find((e) => e.part === part) ?? pool[0]
}
