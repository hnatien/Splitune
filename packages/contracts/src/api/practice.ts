import { z } from 'zod'

const TempoPct = z.number().int().min(1).max(200)

export const AttemptOutcome = z.enum(['clean', 'not_yet', 'unrated'])

// Client ids are UUIDv7 made on the device, so offline batches can be replayed safely.
export const PracticeSessionInput = z.object({
  client_session_id: z.uuid(),
  song_id: z.uuid(),
  started_at: z.iso.datetime(),
  ended_at: z.iso.datetime().optional(),
  input_mode: z.enum(['touch', 'keyboard', 'pedal', 'mixed']),
})

export const PracticeAttemptInput = z.object({
  client_attempt_id: z.uuid(),
  client_session_id: z.uuid(),
  loop_clip_id: z.uuid().optional(),
  tempo_pct: TempoPct,
  outcome: AttemptOutcome,
  override: z.boolean().optional(), // "I played it right" (V7)
  at: z.iso.datetime(),
})

export const PracticeSyncInput = z.object({
  sessions: z.array(PracticeSessionInput).max(100),
  attempts: z.array(PracticeAttemptInput).max(1000),
})

// Ids already stored count as accepted, so the client can clear its outbox either way.
export const PracticeSyncOutput = z.object({
  accepted_sessions: z.array(z.uuid()),
  accepted_attempts: z.array(z.uuid()),
})

export const ProgressInput = z.object({ song_id: z.uuid().optional() })

export const ClipProgress = z.object({
  loop_clip_id: z.uuid(),
  song_id: z.uuid(),
  best_clean_tempo_pct: TempoPct.nullable(),
  attempts: z.array(
    z.object({ at: z.iso.datetime(), tempo_pct: TempoPct, outcome: AttemptOutcome }),
  ),
})

export const ProgressOutput = z.object({ clips: z.array(ClipProgress) })
