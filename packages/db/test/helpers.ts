import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { inject } from 'vitest'
import { createDb, type Database, type Transaction, users } from '../src/index.ts'

export const testDb = (max = 5) => createDb({ url: inject('databaseUrl'), max })

export async function createUser(db: Database, id = `u${randomUUID().slice(0, 8)}`) {
  await db.insert(users).values({ id, email: `${id}@test.splitune.localhost` })
  return id
}

export type DbRole = 'app' | 'ml_worker' | 'node_worker' | 'maintenance'

// Runs `fn` as `role` (no app.user_id), the way a worker connection would.
export function asRole<T>(db: Database, role: DbRole, fn: (tx: Transaction) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw(`set local role ${role}`))
    return fn(tx)
  })
}

// Resolves with the Postgres error code, or fails the test if `promise` resolves.
export async function pgErrorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    const cause = (error as { cause?: { code?: string }; code?: string }).cause ?? error
    return (cause as { code?: string }).code ?? 'no-code'
  }
  throw new Error('expected a database error')
}

export const INSUFFICIENT_PRIVILEGE = '42501'

// One row in every user-scoped table, inserted as the table owner (RLS does not apply).
export async function seedUserGraph(db: Database, userId: string) {
  const s = await import('../src/schema/index.ts')
  const [song] = await db
    .insert(s.songs)
    .values({ userId, title: 'Song', sourceKind: 'upload', instrument: 'guitar' })
    .returning()
  if (!song) throw new Error('seed failed')
  await db.insert(s.uploads).values({
    userId,
    songId: song.id,
    objectKey: `u/${userId}/raw/x/source.mp3`,
    bytes: 10,
    mime: 'audio/mpeg',
    fileSha256: 'a'.repeat(64),
    status: 'uploaded',
    expiresAt: new Date(Date.now() + 86_400_000),
  })
  await db.insert(s.youtubeRefs).values({ songId: song.id, userId, videoId: 'dQw4w9WgXcQ' })
  await db.insert(s.syncPoints).values({ songId: song.id, idx: 0, audioS: 0, videoS: 0.5 })
  const [analysis] = await db
    .insert(s.analyses)
    .values({
      userId,
      songId: song.id,
      version: 1,
      pipelineVersion: 'test',
      configProfile: 'production',
      requestedInstrument: 'guitar',
      analysisType: 'full',
      status: 'running',
      idempotencyKey: randomUUID(),
    })
    .returning()
  if (!analysis) throw new Error('seed failed')
  await db.insert(s.stageRuns).values({
    analysisId: analysis.id,
    stage: 'beats',
    status: 'done',
    modelRefs: [],
    cacheKey: 'c'.repeat(64),
  })
  const [artefact] = await db
    .insert(s.artefacts)
    .values({
      userId,
      analysisId: analysis.id,
      kind: 'beats',
      version: 1,
      objectKey: `u/${userId}/a/${analysis.id}/v1/beats.json`,
      bytes: 100,
      sha256: 'b'.repeat(64),
      modelRefs: [],
    })
    .returning()
  if (!artefact) throw new Error('seed failed')
  await db.insert(s.correctionOps).values({
    userId,
    artefactId: artefact.id,
    rev: 1,
    op: { op: 'delete_note', note_id: 'n1' },
    clientOpId: randomUUID(),
  })
  const [loop] = await db
    .insert(s.loopClips)
    .values({ userId, songId: song.id, startBar: 0, endBar: 1, endBeat: 4, startS: 0, endS: 2.4 })
    .returning()
  const [session] = await db
    .insert(s.practiceSessions)
    .values({ userId, songId: song.id, startedAt: new Date(), clientSessionId: randomUUID() })
    .returning()
  if (!loop || !session) throw new Error('seed failed')
  await db.insert(s.practiceAttempts).values({
    userId,
    sessionId: session.id,
    loopClipId: loop.id,
    tempoPct: 80,
    outcome: 'clean',
    at: new Date(),
    clientAttemptId: randomUUID(),
  })
  await db
    .insert(s.subscriptions)
    .values({ userId, provider: 'mock', plan: 'paid_monthly', status: 'active' })
  await db.insert(s.billingEvents).values({
    id: `evt_${randomUUID()}`,
    provider: 'mock',
    type: 'payment.failed',
    userId,
    payload: {},
  })
  await db
    .insert(s.usageLedger)
    .values({ userId, periodStart: '2026-10-01', kind: 'full_analysis', analysisId: analysis.id })
  await db.insert(s.jobs).values({ kind: 'beats', runner: 'python', analysisId: analysis.id })
  await db.insert(s.jobEvents).values({
    analysisId: analysis.id,
    userId,
    event: { type: 'progress', value: 0.5 },
  })
  await db.insert(s.analyticsEvents).values({ userId, name: 'song_opened' })
  return { song, analysis, artefact, loop, session }
}
