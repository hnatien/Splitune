import { authed } from '../procedures.ts'

// Practice sessions and attempts (12 §5, 13 §5): batches from the device's outbox. Client ids make
// every write idempotent; ids already stored count as accepted so the outbox can be cleared.
export const practice = {
  sync: authed.practice.sync.handler(async ({ context, input }) => {
    const { deps, userId } = context
    const acceptedSessions = await deps.repos.practice.upsertSessions(
      userId,
      input.sessions.map((s) => ({
        clientSessionId: s.client_session_id,
        songId: s.song_id,
        startedAt: new Date(s.started_at),
        endedAt: s.ended_at === undefined ? null : new Date(s.ended_at),
        inputMode: s.input_mode,
      })),
    )
    const acceptedAttempts = await deps.repos.practice.recordAttempts(
      userId,
      input.attempts.map((a) => ({
        clientAttemptId: a.client_attempt_id,
        clientSessionId: a.client_session_id,
        loopClipId: a.loop_clip_id ?? null,
        tempoPct: a.tempo_pct,
        outcome: a.outcome,
        override: a.override ?? false,
        at: new Date(a.at),
      })),
    )
    return { accepted_sessions: acceptedSessions, accepted_attempts: acceptedAttempts }
  }),

  progress: authed.practice.progress.handler(async ({ context, input }) => {
    const clips = await context.deps.repos.practice.progress(context.userId, input.song_id)
    return {
      clips: clips.map((clip) => ({
        loop_clip_id: clip.id,
        song_id: clip.songId,
        best_clean_tempo_pct: clip.bestCleanTempoPct,
        attempts: clip.attempts.map((a) => ({
          at: a.at.toISOString(),
          tempo_pct: a.tempoPct,
          outcome: a.outcome,
        })),
      })),
    }
  }),
}
