import type { PracticeAttemptInput, PracticeSessionInput } from '@splitune/contracts'
import type { z } from 'zod'
import { client } from '@/lib/api'
import { uuidv7 } from '@/lib/uuid'
import { createOutboxDb, type OutboxDb, safely } from './outbox-db'

// Practice sessions and pass attempts (12 §5): written to the IndexedDB outbox first, then sent
// with POST /v1/practice/sync. Client ids make replays safe; accepted ids leave the outbox.

type Session = z.infer<typeof PracticeSessionInput>
type Attempt = z.infer<typeof PracticeAttemptInput>
type InputMode = Session['input_mode']

type StoredSession = Session & { id: string }
type StoredAttempt = Attempt & { id: string }

let outbox: OutboxDb = createOutboxDb()
let current: StoredSession | undefined
const modes = new Set<'touch' | 'keyboard' | 'pedal'>()
let flushing: Promise<void> | undefined

export function configurePracticeSync(options: { db: OutboxDb }) {
  outbox = options.db
}

export function startSession(songId: string, now = new Date()): string {
  modes.clear()
  const id = uuidv7(now.getTime())
  current = {
    id,
    client_session_id: id,
    song_id: songId,
    started_at: now.toISOString(),
    input_mode: 'touch',
  }
  void safely(() => outbox.put('sessions', current as StoredSession), undefined)
  return id
}

/** How the learner drives practice this session (touch, keys, a pedal, or several). */
export function noteInput(kind: 'touch' | 'keyboard' | 'pedal') {
  if (!current || modes.has(kind)) return
  modes.add(kind)
  const input_mode: InputMode = modes.size > 1 ? 'mixed' : kind
  current = { ...current, input_mode }
  void safely(() => outbox.put('sessions', current as StoredSession), undefined)
}

export function endSession(now = new Date()) {
  if (!current) return
  const ended = { ...current, ended_at: now.toISOString() }
  current = undefined
  void safely(() => outbox.put('sessions', ended), undefined).then(() => flushPractice())
}

export function recordAttempt(attempt: {
  loopClipId?: string | undefined
  tempoPct: number
  outcome: Attempt['outcome']
  at?: Date
}): void {
  if (!current) return
  const id = uuidv7()
  const stored: StoredAttempt = {
    id,
    client_attempt_id: id,
    client_session_id: current.client_session_id,
    tempo_pct: Math.round(Math.min(200, Math.max(1, attempt.tempoPct))),
    outcome: attempt.outcome,
    at: (attempt.at ?? new Date()).toISOString(),
    ...(attempt.loopClipId ? { loop_clip_id: attempt.loopClipId } : {}),
  }
  void safely(() => outbox.put('attempts', stored), undefined).then(() => flushPractice())
}

export function flushPractice(): Promise<void> {
  flushing ??= (async () => {
    try {
      const [sessions, attempts] = await Promise.all([
        safely(() => outbox.all<StoredSession>('sessions'), []),
        safely(() => outbox.all<StoredAttempt>('attempts'), []),
      ])
      if (sessions.length === 0 && attempts.length === 0) return
      const strip = <T extends { id: string }>({ id: _id, ...rest }: T) => rest
      const result = await client.practice.sync({
        sessions: sessions.slice(0, 100).map(strip),
        attempts: attempts.slice(0, 1000).map(strip),
      })
      // An open session stays in the outbox until it ends, so ended_at reaches the server.
      const done = result.accepted_sessions.filter((id) => id !== current?.client_session_id)
      await safely(() => outbox.delete('sessions', done), undefined)
      await safely(() => outbox.delete('attempts', result.accepted_attempts), undefined)
    } catch {
      // Offline or the API is away: the outbox keeps everything for the next flush.
    }
  })().finally(() => {
    flushing = undefined
  })
  return flushing
}
