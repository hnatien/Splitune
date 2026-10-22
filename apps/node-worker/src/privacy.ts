import { DataExport, UserJobPayload } from '@splitune/contracts'
import { type Database, queue } from '@splitune/db'
import { assertOwnedKey, type Storage, StorageKeyError, userPrefix } from '@splitune/storage'
import { z } from 'zod'
import type { LifecycleConfig } from './config.ts'
import type { Logger } from './log.ts'

// Privacy self-service jobs (15 §4), enqueued by the API for the signed-in user: build the "Download
// my data" bundle, and delete an account with everything in it. Both run as maintenance.

type Job = queue.Job
type Bundle = z.infer<typeof DataExport>
type Rows = NonNullable<Awaited<ReturnType<typeof queue.lifecycle.exportRows>>>

export interface PrivacyServices {
  db: Database // node_worker: the job's lock
  maintenance: Database
  storage: Storage
  log: Logger
  workerId: string
  config: LifecycleConfig
  hashUser: (userId: string) => string
}

// Permanent (bad payload) or retryable failure with a machine code.
export class PrivacyJobError extends Error {
  readonly code: string
  readonly retry: boolean

  constructor(code: string, retry: boolean) {
    super(code)
    this.code = code
    this.retry = retry
  }
}

export const EXPORT_KIND = 'export_user_data'
export const DELETE_ACCOUNT_KIND = 'delete_account'

// Objects a still-running stage of a deleted account may upload are removed by a second pass.
export const FOLLOW_UP_AFTER_S = 30 * 60

const ExportPayload = UserJobPayload.extend({ export_id: z.uuid() })

const iso = (date: Date | null | undefined) => (date ? date.toISOString() : null)

function payloadOf<T extends z.ZodType>(job: Job, schema: T): z.infer<T> {
  const parsed = schema.safeParse(job.payload)
  if (!parsed.success || job.analysisId !== null)
    throw new PrivacyJobError('invalid_request', false)
  try {
    userPrefix((parsed.data as { user_id: string }).user_id)
  } catch {
    throw new PrivacyJobError('invalid_request', false)
  }
  return parsed.data
}

export async function buildBundle(
  rows: Rows,
  storage: Storage,
  { now, linkTtlS }: { now: Date; linkTtlS: number },
): Promise<Bundle> {
  const { user, subscription } = rows
  const uploadLinks = new Map<string, string>()
  for (const upload of rows.uploads) {
    if (upload.status !== 'uploaded' && upload.status !== 'validated') continue
    if (!(await storage.exists(upload.objectKey))) continue
    uploadLinks.set(upload.id, await storage.presignGet(upload.objectKey, { expiresIn: linkTtlS }))
  }
  const bySong = <T extends { songId: string | null }>(items: T[], songId: string) =>
    items.filter((item) => item.songId === songId)
  return {
    format: 'splitune.data_export',
    version: 1,
    generated_at: now.toISOString(),
    account: {
      id: user.id,
      email: user.email,
      display_name: user.displayName,
      primary_instrument: user.primaryInstrument,
      level: user.level,
      handedness: user.handedness,
      training_opt_in: user.trainingOptIn,
      marketing_opt_in: user.marketingOptIn,
      created_at: user.createdAt.toISOString(),
    },
    subscription: subscription
      ? {
          plan: subscription.plan,
          status: subscription.status,
          current_period_start: iso(subscription.currentPeriodStart),
          current_period_end: iso(subscription.currentPeriodEnd),
          cancel_at_period_end: subscription.cancelAtPeriodEnd,
        }
      : null,
    usage: rows.usage.map((u) => ({
      kind: u.kind,
      period_start: u.periodStart,
      at: u.createdAt.toISOString(),
    })),
    billing_events: rows.billingEvents.map((e) => ({
      id: e.id,
      type: e.type,
      at: e.at.toISOString(),
    })),
    songs: rows.songs.map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      instrument: song.instrument,
      source_kind: song.sourceKind,
      source_url: song.sourceUrl,
      duration_s: song.durationS,
      status: song.status,
      player_state: song.playerState,
      created_at: song.createdAt.toISOString(),
      last_opened_at: iso(song.lastOpenedAt),
      analyses: bySong(rows.analyses, song.id).map((a) => ({
        id: a.id,
        version: a.version,
        type: a.analysisType,
        status: a.status,
        instrument: a.requestedInstrument,
        created_at: a.createdAt.toISOString(),
        finished_at: iso(a.finishedAt),
      })),
      uploads: bySong(rows.uploads, song.id).map((u) => ({
        id: u.id,
        mime: u.mime,
        bytes: u.bytes,
        status: u.status,
        created_at: u.createdAt.toISOString(),
        download_url: uploadLinks.get(u.id) ?? null,
      })),
      loops: bySong(rows.loops, song.id).map((l) => ({
        id: l.id,
        name: l.name,
        start_bar: l.startBar,
        start_beat: l.startBeat,
        end_bar: l.endBar,
        end_beat: l.endBeat,
        rest_between: l.restBetween,
        count_in_bars: l.countInBars,
        trainer: l.trainer ?? null,
        best_clean_tempo_pct: l.bestCleanTempoPct,
        created_at: l.createdAt.toISOString(),
      })),
      corrections: bySong(rows.corrections, song.id).map((c) => ({
        artefact_kind: c.artefactKind,
        analysis_id: c.analysisId,
        rev: c.rev,
        op: c.op,
        created_at: c.createdAt.toISOString(),
      })),
    })),
    practice_sessions: rows.sessions.map((session) => ({
      id: session.id,
      song_id: session.songId,
      started_at: session.startedAt.toISOString(),
      ended_at: iso(session.endedAt),
      input_mode: session.inputMode,
      attempts: rows.attempts
        .filter((a) => a.sessionId === session.id)
        .map((a) => ({
          loop_clip_id: a.loopClipId,
          tempo_pct: a.tempoPct,
          outcome: a.outcome,
          override: a.override,
          at: a.at.toISOString(),
        })),
    })),
  }
}

export async function exportUserData(s: PrivacyServices, job: Job): Promise<boolean> {
  const { lifecycle } = queue
  const { user_id: userId, export_id: exportId } = payloadOf(job, ExportPayload)
  const row = await lifecycle.loadExport(s.maintenance, exportId)
  if (!row || row.userId !== userId) throw new PrivacyJobError('invalid_request', false)
  try {
    assertOwnedKey(userId, row.objectKey)
  } catch {
    throw new PrivacyJobError('invalid_request', false)
  }
  if (row.status === 'pending') {
    const rows = await lifecycle.exportRows(s.maintenance, userId)
    if (!rows) {
      await lifecycle.finishExport(s.maintenance, row, {
        status: 'failed',
        errorCode: 'user_missing',
      })
    } else {
      const now = new Date()
      const bundle = DataExport.parse(
        await buildBundle(rows, s.storage, { now, linkTtlS: s.config.exportTtlS }),
      )
      const body = JSON.stringify(bundle)
      await s.storage.putBytes(row.objectKey, body, 'application/json')
      await lifecycle.finishExport(s.maintenance, row, {
        status: 'ready',
        bytes: new TextEncoder().encode(body).byteLength,
        expiresAt: new Date(now.getTime() + s.config.exportTtlS * 1000),
      })
      s.log.info('data export ready', { job_id: job.id, songs: bundle.songs.length })
    }
  }
  return queue.complete(s.db, job.id, s.workerId)
}

// 15 §3: sessions were revoked by the API and the subscription is the mock provider's own rows, so
// what's left is: delete every object under u/{user}/ → hard-delete the rows → delete again and
// verify the prefix is empty. A stage that was running may still upload: then a follow-up pass
// runs after FOLLOW_UP_AFTER_S. Idempotent: a retry or the follow-up finds nothing and succeeds.
export async function deleteAccount(s: PrivacyServices, job: Job): Promise<boolean> {
  const { lifecycle } = queue
  const { user_id: userId } = payloadOf(job, UserJobPayload)
  const prefix = userPrefix(userId)
  const running = await lifecycle.hasRunningJobs(s.maintenance, userId)
  let objects: number
  try {
    objects = await s.storage.deletePrefix(prefix)
    const { users } = await lifecycle.purgeUserRows(s.maintenance, {
      userId,
      userHash: s.hashUser(userId),
      jobId: job.id,
      objects,
    })
    objects += await s.storage.deletePrefix(prefix)
    if ((await s.storage.usage(prefix)).objects > 0)
      throw new PrivacyJobError('objects_remain', true)
    if (running) {
      await queue.enqueue(
        s.maintenance,
        DELETE_ACCOUNT_KIND,
        'node',
        { user_id: userId },
        {
          runAfter: new Date(Date.now() + FOLLOW_UP_AFTER_S * 1000),
        },
      )
    }
    await lifecycle.scrubJobPayload(s.maintenance, job.id)
    s.log.info('account deleted', { job_id: job.id, objects, user_rows: users, follow_up: running })
  } catch (error) {
    if (error instanceof StorageKeyError) throw new PrivacyJobError('invalid_request', false)
    throw error
  }
  return queue.complete(s.db, job.id, s.workerId)
}
