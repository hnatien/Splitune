import { type Database, queue } from '@splitune/db'
import { type Storage, stemFilesPrefix } from '@splitune/storage'
import { backupDatabase } from './backup.ts'
import type { LifecycleConfig } from './config.ts'
import { sendDigest } from './digest.ts'
import type { Logger } from './log.ts'
import type { ScheduledJob } from './scheduler.ts'

// The scheduled lifecycle jobs (15 §3, 25 §7): disk hygiene for personal mode. R2 has no expiry
// rules on purpose (only its 7-day abort of incomplete multipart uploads), so these own all expiry.

export interface LifecycleServices {
  maintenance: Database
  storage: Storage
  log: Logger
  config: LifecycleConfig
}

const DAY_MS = 86_400_000
const BATCH = 200
const YOUTUBE_DATA_DAYS = 30

// Stems of songs not opened for `stemsInactiveDays`: delete the audio files, keep stems.json, mark
// the artefact purged (the library and practice screen then offer "Re-create stems").
export async function sweepStems(s: LifecycleServices, now = new Date()) {
  const { lifecycle } = queue
  const inactiveBefore = new Date(now.getTime() - s.config.stemsInactiveDays * DAY_MS)
  let swept = 0
  let objects = 0
  let bytes = 0
  for (;;) {
    const batch = await lifecycle.stemsToSweep(s.maintenance, { inactiveBefore, limit: BATCH })
    if (batch.length === 0) break
    for (const candidate of batch) {
      const prefix = stemFilesPrefix(candidate.objectKey)
      const usage = await s.storage.usage(prefix)
      const deleted = await s.storage.deletePrefix(prefix)
      if ((await s.storage.usage(prefix)).objects > 0) throw new Error('stem files remain')
      if (
        await lifecycle.markStemsPurged(s.maintenance, candidate, {
          objects: deleted,
          bytes: usage.bytes,
        })
      ) {
        swept += 1
        objects += deleted
        bytes += usage.bytes
      }
    }
    if (batch.length < BATCH) break
  }
  return { stems_swept: swept, objects_deleted: objects, bytes_freed: bytes }
}

// Raw uploads past expires_at (off by default in personal mode: raw uploads are kept for re-analysis
// and Lite playback). Only the upload's own object is deleted; a URL import's video.mp4 is never an
// upload row, so it stays while the song exists.
export async function expireRawUploads(s: LifecycleServices, now = new Date()) {
  const { lifecycle } = queue
  let expired = 0
  for (const upload of await lifecycle.uploadsToExpire(s.maintenance, { now, limit: 1000 })) {
    if (upload.status === 'pending' && upload.multipartUploadId) {
      await s.storage.abortMultipartUpload(upload.objectKey, upload.multipartUploadId)
    }
    await s.storage.deleteKey(upload.objectKey)
    if (await lifecycle.markUploadExpired(s.maintenance, upload)) expired += 1
  }
  return { uploads_expired: expired }
}

// "Download my data" bundles are kept for a day (15 §4).
export async function expireExports(s: LifecycleServices, now = new Date()) {
  const { lifecycle } = queue
  const due = await lifecycle.exportsToExpire(s.maintenance, now)
  for (const row of due) {
    await s.storage.deleteKey(row.objectKey)
    await lifecycle.markExportExpired(s.maintenance, row.id)
  }
  return { exports_expired: due.length }
}

// YouTube API data older than 30 days is nulled (15 §3; only embed-fallback refs store titles).
export async function refreshYoutubeData(s: LifecycleServices, now = new Date()) {
  const olderThan = new Date(now.getTime() - YOUTUBE_DATA_DAYS * DAY_MS)
  return {
    youtube_titles_nulled: await queue.lifecycle.nullStaleYoutubeTitles(s.maintenance, olderThan),
  }
}

export function lifecycleJobs(s: LifecycleServices): ScheduledJob[] {
  const nightly = { every: 'day' as const, at: s.config.nightlyAt }
  const jobs: ScheduledJob[] = [
    { name: 'sweep-stems', cadence: nightly, run: () => sweepStems(s) },
    { name: 'expire-exports', cadence: { every: 'hour' }, run: () => expireExports(s) },
    { name: 'refresh-youtube-data', cadence: nightly, run: () => refreshYoutubeData(s) },
  ]
  if (s.config.expireRawUploads) {
    jobs.push({
      name: 'expire-raw-uploads',
      cadence: { every: 'hour' },
      run: () => expireRawUploads(s),
    })
  }
  const { dump, digest } = s.config
  if (dump) {
    jobs.push({ name: 'pg-dump', cadence: nightly, run: () => backupDatabase(dump) })
  }
  if (digest) {
    jobs.push({
      name: 'daily-digest',
      cadence: { every: 'day', at: digest.at },
      run: () => sendDigest(s, digest),
    })
  }
  return jobs
}
