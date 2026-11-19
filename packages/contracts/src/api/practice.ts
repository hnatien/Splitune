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

// GET /v1/progress (12 §5, s39). `days` keeps sessions and attempts to the last n days on the
// server's clock (the client trims to its own local days); omitted, all of them.
export const ProgressInput = z.object({
  song_id: z.uuid().optional(),
  days: z.number().int().min(1).max(366).optional(),
})

export const ClipProgress = z.object({
  loop_clip_id: z.uuid(),
  song_id: z.uuid(),
  name: z.string().nullable(),
  best_clean_tempo_pct: TempoPct.nullable(),
  last_attempt_at: z.iso.datetime().nullable(), // over all time, whatever `days` says
  attempts: z.array(
    z.object({
      at: z.iso.datetime(),
      tempo_pct: TempoPct,
      outcome: AttemptOutcome,
      client_session_id: z.uuid(),
    }),
  ),
})

// One practice session (a visit to a song's practice screen) with its passes over every loop,
// saved as a clip or not. `ended_at` is null while the session is open or if it never ended.
export const ProgressSession = z.object({
  client_session_id: z.uuid(),
  song_id: z.uuid(),
  started_at: z.iso.datetime(),
  ended_at: z.iso.datetime().nullable(),
  passes: z.number().int().nonnegative(),
  clean_passes: z.number().int().nonnegative(),
})

export const ProgressOutput = z.object({
  clips: z.array(ClipProgress),
  sessions: z.array(ProgressSession),
})
