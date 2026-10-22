import { z } from 'zod'
import { ArtefactKind, Instrument } from '../analysis/common.ts'
import { CorrectionsBatchInput } from './corrections.ts'
import { CreateLoopInput } from './loops.ts'
import { Level } from './me.ts'
import { PracticeAttemptInput, PracticeSessionInput } from './practice.ts'
import { PlayerState, SongDetail } from './songs.ts'

// Example songs (13 §1, 03 "Example songs"): Splitune's own analysed recordings, built by
// `pnpm examples:build` into the bucket under assets/examples/{id}/{build}/ and described by the
// committed examples.json manifest (examples-manifest.ts, server-side only). Visitors practise
// them before signing up; claiming one gives the account a `source_kind: example` song that
// points at the shared artefacts.

export const ExampleId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/)

// The phrase the example is chosen for (13 §1: guitar rhythm, guitar riff, bass line).
export const ExamplePart = z.enum(['rhythm', 'riff', 'bass_line'])

// Bars are the beat grid's 0-based bar_index (05 "indexing"), inclusive.
export const ExampleLoop = z
  .object({ start_bar: z.number().int().min(-1), end_bar: z.number().int().min(-1) })
  .refine((loop) => loop.end_bar >= loop.start_bar && loop.end_bar - loop.start_bar <= 3, {
    message: 'a suggested loop is 1–4 bars',
  })

// Starting speed per self-rated level (13 §1: 70 % for "just started").
export const ExampleSpeeds = z.object({
  just_started: z.number().int().min(50).max(100),
  few_songs: z.number().int().min(50).max(100),
  returning: z.number().int().min(50).max(100),
})

// What a visitor gets: the example as a ready song (the practice screen reads it like any other).
export const Example = z.object({
  id: ExampleId,
  title: z.string(),
  artist: z.string().nullable(),
  instrument: Instrument,
  part: ExamplePart,
  duration_s: z.number().positive(),
  loop: ExampleLoop,
  speed_pct: ExampleSpeeds,
  song: SongDetail,
})

export const ListExamplesOutput = z.object({ items: z.array(Example) })

// Like ArtefactUrlInput: a document, or with `stem_id` that stem's audio in `variant`.
export const ExampleUrlInput = z.object({
  id: ExampleId,
  artefact_id: z.uuid(),
  stem_id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9_.-]{0,63}$/)
    .optional(),
  variant: z.enum(['opus_webm', 'aac_mp4']).optional(),
})

// Progress made before signing up (13 §1), kept on the device and sent once signed in. Client ids
// make the claim idempotent: loops keep the ids the device gave them, sessions and attempts their
// client ids, corrections their client_op_ids.
export const ClaimLoop = CreateLoopInput.omit({ id: true }).extend({ id: z.uuid() })

export const ClaimExampleInput = z.object({
  id: ExampleId,
  // The visitor's onboarding answers; they become the profile's unless it has its own.
  instrument: Instrument.optional(),
  level: Level.optional(),
  player_state: PlayerState.optional(),
  loops: z.array(ClaimLoop).max(100),
  sessions: z.array(PracticeSessionInput.omit({ song_id: true })).max(100),
  attempts: z.array(PracticeAttemptInput).max(1000),
  corrections: z
    .array(z.object({ kind: ArtefactKind, ops: CorrectionsBatchInput.shape.ops }))
    .max(10),
})

export const ClaimExampleOutput = z.object({ song_id: z.uuid() })
