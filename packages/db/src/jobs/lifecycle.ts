import { and, asc, desc, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm'
import type { Database, Executor } from '../client.ts'
import {
  analyses,
  analyticsEvents,
  artefacts,
  auditLog,
  billingEvents,
  correctionOps,
  dataExports,
  jobs,
  loopClips,
  practiceAttempts,
  practiceSessions,
  rateLimits,
  scheduleRuns,
  songs,
  subscriptions,
  uploads,
  usageLedger,
  users,
  youtubeRefs,
} from '../schema/index.ts'

// Data lifecycle (15 §3–§4, 03 "Retention and deletion") for the node worker's scheduler and its
// privacy jobs. Every function runs as role `maintenance` (BYPASSRLS): it works across users and
// deletes what RLS would hide. Each step is idempotent and leaves an audit_log entry.

export const LIFECYCLE_ACTOR = 'lifecycle'

export async function audit(
  db: Executor,
  action: string,
  subjectUserId: string | null,
  subject: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditLog).values({ actor: LIFECYCLE_ACTOR, action, subjectUserId, subject })
}

// --- Scheduled runs ---------------------------------------------------------------------------

// Claims one run of a scheduled job due at `dueAt`: true for exactly one caller per due time, even
// with several workers or a restart in between (compare-and-set on last_started_at).
export async function claimScheduledRun(db: Executor, name: string, dueAt: Date): Promise<boolean> {
  await db.insert(scheduleRuns).values({ name }).onConflictDoNothing()
  const claimed = await db
    .update(scheduleRuns)
    .set({ lastStartedAt: sql`now()` })
    .where(
      and(
        eq(scheduleRuns.name, name),
        or(isNull(scheduleRuns.lastStartedAt), lt(scheduleRuns.lastStartedAt, dueAt)),
      ),
    )
    .returning({ name: scheduleRuns.name })
  return claimed.length === 1
}

export async function finishScheduledRun(
  db: Executor,
  name: string,
  outcome: { status: 'done' | 'failed'; result?: Record<string, unknown>; errorCode?: string },
): Promise<void> {
  await db
    .update(scheduleRuns)
    .set({
      lastFinishedAt: sql`now()`,
      lastStatus: outcome.status,
      lastErrorCode: outcome.errorCode ?? null,
      ...(outcome.result === undefined ? {} : { lastResult: outcome.result }),
    })
    .where(eq(scheduleRuns.name, name))
}

export const scheduledRuns = (db: Executor) =>
  db.select().from(scheduleRuns).orderBy(asc(scheduleRuns.name))

// --- Stems sweeper ----------------------------------------------------------------------------

export interface StemsCandidate {
  artefactId: string
  userId: string
  songId: string
  analysisId: string
  objectKey: string
}

// Stems artefacts whose song was last opened (or, never opened, created) before `inactiveBefore`
// and that were themselves made before it: a stem re-created today survives tonight's sweep.
// Shared example objects (assets/examples/…) are never swept.
export async function stemsToSweep(
  db: Executor,
  { inactiveBefore, limit }: { inactiveBefore: Date; limit: number },
): Promise<StemsCandidate[]> {
  return db
    .select({
      artefactId: artefacts.id,
      userId: artefacts.userId,
      songId: songs.id,
      analysisId: artefacts.analysisId,
      objectKey: artefacts.objectKey,
    })
    .from(artefacts)
    .innerJoin(analyses, eq(analyses.id, artefacts.analysisId))
    .innerJoin(songs, eq(songs.id, analyses.songId))
    .where(
      and(
        eq(artefacts.kind, 'stems'),
        isNull(artefacts.purgedAt),
        sql`${artefacts.objectKey} like 'u/%'`,
        sql`greatest(coalesce(${songs.lastOpenedAt}, ${songs.createdAt}), ${artefacts.createdAt}) < ${inactiveBefore}`,
      ),
    )
    .orderBy(asc(artefacts.createdAt))
    .limit(limit)
}

// Records that the sweeper deleted a stems artefact's audio (the row and stems.json stay).
export async function markStemsPurged(
  db: Database,
  candidate: StemsCandidate,
  freed: { objects: number; bytes: number },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const marked = await tx
      .update(artefacts)
      .set({ purgedAt: sql`now()` })
      .where(and(eq(artefacts.id, candidate.artefactId), isNull(artefacts.purgedAt)))
      .returning({ id: artefacts.id })
    if (marked.length === 0) return false
    await audit(tx, 'stems.swept', candidate.userId, {
      artefact_id: candidate.artefactId,
      song_id: candidate.songId,
      analysis_id: candidate.analysisId,
      ...freed,
    })
    return true
  })
}

// --- Raw uploads (off by default in personal mode) --------------------------------------------

export async function uploadsToExpire(db: Executor, { now, limit }: { now: Date; limit: number }) {
  return db
    .select({
      id: uploads.id,
      userId: uploads.userId,
      objectKey: uploads.objectKey,
      multipartUploadId: uploads.multipartUploadId,
      status: uploads.status,
    })
    .from(uploads)
    .where(
      and(
        lt(uploads.expiresAt, now),
        inArray(uploads.status, ['pending', 'uploaded', 'validated']),
      ),
    )
    .orderBy(asc(uploads.expiresAt))
    .limit(limit)
}

export async function markUploadExpired(db: Database, upload: { id: string; userId: string }) {
  return db.transaction(async (tx) => {
    const marked = await tx
      .update(uploads)
      .set({ status: 'expired', multipartUploadId: null })
      .where(
        and(
          eq(uploads.id, upload.id),
          inArray(uploads.status, ['pending', 'uploaded', 'validated']),
        ),
      )
      .returning({ id: uploads.id })
    if (marked.length === 0) return false
    await audit(tx, 'upload.expired', upload.userId, { upload_id: upload.id })
    return true
  })
}

// --- YouTube API data (15 §3: refresh or null fetched titles older than 30 days) --------------

export async function nullStaleYoutubeTitles(db: Database, olderThan: Date): Promise<number> {
  return db.transaction(async (tx) => {
    const touched = await tx
      .update(youtubeRefs)
      .set({ fetchedTitle: null, apiDataRefreshedAt: sql`now()` })
      .where(
        and(
          sql`${youtubeRefs.fetchedTitle} is not null`,
          or(isNull(youtubeRefs.apiDataRefreshedAt), lt(youtubeRefs.apiDataRefreshedAt, olderThan)),
        ),
      )
      .returning({ songId: youtubeRefs.songId })
    if (touched.length > 0) await audit(tx, 'youtube_titles.nulled', null, { rows: touched.length })
    return touched.length
  })
}

// --- Data export (15 §4) ----------------------------------------------------------------------

export type DataExportRow = typeof dataExports.$inferSelect

export async function loadExport(db: Executor, exportId: string) {
  const [row] = await db.select().from(dataExports).where(eq(dataExports.id, exportId))
  return row
}

// Everything the bundle holds about one user, read in one snapshot.
export async function exportRows(db: Database, userId: string) {
  return db.transaction(
    async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, userId))
      if (!user) return undefined
      const [subscription] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
      return {
        user,
        subscription,
        usage: await tx
          .select()
          .from(usageLedger)
          .where(eq(usageLedger.userId, userId))
          .orderBy(asc(usageLedger.id)),
        billingEvents: await tx
          .select({ id: billingEvents.id, type: billingEvents.type, at: billingEvents.receivedAt })
          .from(billingEvents)
          .where(eq(billingEvents.userId, userId))
          .orderBy(asc(billingEvents.receivedAt)),
        songs: await tx
          .select()
          .from(songs)
          .where(eq(songs.userId, userId))
          .orderBy(asc(songs.createdAt)),
        analyses: await tx
          .select()
          .from(analyses)
          .where(eq(analyses.userId, userId))
          .orderBy(asc(analyses.createdAt)),
        uploads: await tx
          .select()
          .from(uploads)
          .where(eq(uploads.userId, userId))
          .orderBy(asc(uploads.createdAt)),
        loops: await tx
          .select()
          .from(loopClips)
          .where(eq(loopClips.userId, userId))
          .orderBy(asc(loopClips.createdAt)),
        corrections: await tx
          .select({
            songId: analyses.songId,
            analysisId: artefacts.analysisId,
            artefactKind: artefacts.kind,
            rev: correctionOps.rev,
            op: correctionOps.op,
            createdAt: correctionOps.createdAt,
          })
          .from(correctionOps)
          .innerJoin(artefacts, eq(artefacts.id, correctionOps.artefactId))
          .innerJoin(analyses, eq(analyses.id, artefacts.analysisId))
          .where(eq(correctionOps.userId, userId))
          .orderBy(asc(correctionOps.id)),
        sessions: await tx
          .select()
          .from(practiceSessions)
          .where(eq(practiceSessions.userId, userId))
          .orderBy(asc(practiceSessions.startedAt)),
        attempts: await tx
          .select()
          .from(practiceAttempts)
          .where(eq(practiceAttempts.userId, userId))
          .orderBy(asc(practiceAttempts.at)),
      }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}

export async function finishExport(
  db: Database,
  row: DataExportRow,
  outcome:
    | { status: 'ready'; bytes: number; expiresAt: Date }
    | { status: 'failed'; errorCode: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(dataExports)
      .set(
        outcome.status === 'ready'
          ? {
              status: 'ready',
              bytes: outcome.bytes,
              readyAt: sql`now()`,
              expiresAt: outcome.expiresAt,
            }
          : { status: 'failed', errorCode: outcome.errorCode },
      )
      .where(and(eq(dataExports.id, row.id), eq(dataExports.status, 'pending')))
    await audit(tx, `data_export.${outcome.status}`, row.userId, { export_id: row.id })
  })
}

export async function exportsToExpire(db: Executor, now: Date) {
  return db
    .select({ id: dataExports.id, userId: dataExports.userId, objectKey: dataExports.objectKey })
    .from(dataExports)
    .where(and(eq(dataExports.status, 'ready'), lt(dataExports.expiresAt, now)))
}

export async function markExportExpired(db: Executor, exportId: string): Promise<void> {
  await db
    .update(dataExports)
    .set({ status: 'expired' })
    .where(and(eq(dataExports.id, exportId), eq(dataExports.status, 'ready')))
}

// --- Account deletion (15 §3: revoke → cancel → delete prefixes → hard-delete rows) ---------

export async function userExists(db: Executor, userId: string): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId))
  return row !== undefined
}

// Whether any of the user's analysis jobs is running now: a stage may still upload objects after
// its rows are gone, so the worker checks the prefix again later.
export async function hasRunningJobs(db: Executor, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .innerJoin(analyses, eq(analyses.id, jobs.analysisId))
    .where(and(eq(analyses.userId, userId), eq(jobs.status, 'running')))
    .limit(1)
  return row !== undefined
}

// Hard-deletes every row of the user: the users row (everything with a user_id cascades from it),
// their analytics events (by hash), rate-limit counters and their other account jobs except the
// running one, `jobId` (scrubJobPayload empties it once the purge is verified). Only audit_log
// keeps the id (legal record).
export async function purgeUserRows(
  db: Database,
  {
    userId,
    userHash,
    jobId,
    objects,
  }: { userId: string; userHash: string; jobId: number; objects: number },
): Promise<{ users: number; events: number }> {
  return db.transaction(async (tx) => {
    const events = await tx
      .delete(analyticsEvents)
      .where(eq(analyticsEvents.userHash, userHash))
      .returning({ id: analyticsEvents.id })
    await tx.delete(rateLimits).where(sql`${rateLimits.key} like ${`%:user:${userId}`}`)
    await tx
      .delete(jobs)
      .where(
        and(
          isNull(jobs.analysisId),
          sql`${jobs.payload} ->> 'user_id' = ${userId}`,
          ne(jobs.id, jobId),
        ),
      )
    const deleted = await tx.delete(users).where(eq(users.id, userId)).returning({ id: users.id })
    await audit(tx, 'account.deleted', userId, {
      objects_deleted: objects,
      user_row: deleted.length,
      events_deleted: events.length,
    })
    return { users: deleted.length, events: events.length }
  })
}

// The finished deletion job forgets whose account it was.
export async function scrubJobPayload(db: Executor, jobId: number): Promise<void> {
  await db.update(jobs).set({ payload: {} }).where(eq(jobs.id, jobId))
}

// --- Backups -----------------------------------------------------------------------------------

// Schemas the connected role may not use (e.g. a local tool's own schema): pg_dump skips them.
export async function unreadableSchemas(db: Executor): Promise<string[]> {
  const result = await db.execute<{ name: string }>(sql`
    select nspname as name from pg_namespace
    where nspname not like 'pg\_%' and nspname <> 'information_schema'
      and not has_schema_privilege(nspname, 'USAGE')
    order by nspname`)
  return result.rows.map((row) => row.name)
}

// --- Daily digest (16 §4 at personal scale) ---------------------------------------------------

export async function digestFacts(db: Database, since: Date) {
  const failedJobs = await db
    .select({ kind: jobs.kind, errorCode: jobs.errorCode, count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(
      and(
        eq(jobs.status, 'failed'),
        sql`coalesce(${jobs.heartbeatAt}, ${jobs.runAfter}) >= ${since}`,
      ),
    )
    .groupBy(jobs.kind, jobs.errorCode)
    .orderBy(desc(sql`count(*)`))
  const analysesByStatus = await db
    .select({ status: analyses.status, count: sql<number>`count(*)::int` })
    .from(analyses)
    .where(sql`${analyses.finishedAt} >= ${since}`)
    .groupBy(analyses.status)
  const backlog = await db
    .select({
      runner: jobs.runner,
      queued: sql<number>`count(*)::int`,
      oldestS: sql<number>`coalesce(extract(epoch from now() - min(${jobs.runAfter})), 0)::int`,
    })
    .from(jobs)
    .where(and(eq(jobs.status, 'queued'), sql`${jobs.runAfter} <= now()`))
    .groupBy(jobs.runner)
  const workers = await db.execute<{
    worker_id: string
    runner: string
    heartbeat_age_s: number
  }>(sql`
    select worker_id, runner, extract(epoch from now() - heartbeat_at)::int as heartbeat_age_s
    from worker_heartbeats order by runner, worker_id`)
  const waiting = await db.execute<{ count: number }>(sql`
    select count(*)::int as count from job_events
    where event ->> 'type' = 'analysis.waiting' and at >= ${since}`)
  const [size] = (
    await db.execute<{ bytes: string }>(sql`select pg_database_size(current_database()) as bytes`)
  ).rows
  const failedSchedules = await db
    .select({ name: scheduleRuns.name, errorCode: scheduleRuns.lastErrorCode })
    .from(scheduleRuns)
    .where(eq(scheduleRuns.lastStatus, 'failed'))
  return {
    failedJobs,
    analysesByStatus,
    backlog,
    workers: workers.rows,
    waitingEvents: waiting.rows[0]?.count ?? 0,
    databaseBytes: Number(size?.bytes ?? 0),
    failedSchedules,
  }
}
