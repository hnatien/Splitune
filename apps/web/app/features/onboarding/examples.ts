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
 * The examples offered for an instrument: its own parts, else the guitar ones ("Something else"),
 * so a song is listed once and never for another instrument's part.
 */
export function examplesFor(examples: ExampleSong[], instrument: string | null): ExampleSong[] {
  const own = examples.filter((e) => e.instrument === instrument)
  const guitar = examples.filter((e) => e.instrument === 'guitar')
  return own.length > 0 ? own : guitar.length > 0 ? guitar : examples
}

/**
 * The example for the onboarding answers: of the instrument's examples, chords for someone who
 * just started and the riff otherwise.
 */
export function exampleFor(
  examples: ExampleSong[],
  instrument: string | null,
  level: string | null,
): ExampleSong | undefined {
  const pool = examplesFor(examples, instrument)
  const part = level === 'just_started' ? 'rhythm' : 'riff'
  return pool.find((e) => e.part === part) ?? pool[0]
}
