import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { queue } from '@splitune/db'
import nodemailer from 'nodemailer'
import type { LifecycleConfig } from './config.ts'
import type { LifecycleServices } from './lifecycle.ts'

// Daily digest email (16 §4 at personal scale): yesterday's failures, the queue backlog, disk
// growth (database, bucket, the Mac's ML cache and dumps), the R2 bucket against its 10 GB-month
// free tier (25 §1) and workers that are offline or kept analyses waiting. Counts, sizes and
// machine codes only — no titles, emails or keys.

type Digest = NonNullable<LifecycleConfig['digest']>
type Facts = Awaited<ReturnType<typeof queue.lifecycle.digestFacts>>

export const R2_FREE_BYTES = 10 * 1000 ** 3
const OFFLINE_AFTER_S = 120
const DAY_MS = 86_400_000

export interface Sizes {
  database_bytes: number
  bucket_bytes: number
  bucket_objects: number
  cache_bytes: number | null
  dumps_bytes: number | null
}

async function directoryBytes(path: string): Promise<number | null> {
  try {
    let total = 0
    for (const entry of await readdir(path, { withFileTypes: true, recursive: true })) {
      if (entry.isFile()) total += (await stat(join(entry.parentPath, entry.name))).size
    }
    return total
  } catch {
    return null // not there (yet): reported as unknown
  }
}

const formatBytes = (bytes: number) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = Math.abs(bytes)
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit += 1
  }
  const sign = bytes < 0 ? '−' : ''
  return `${sign}${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

const growth = (now: number | null, before: unknown) =>
  now === null
    ? 'unknown'
    : typeof before === 'number'
      ? `${formatBytes(now)} (${now - before >= 0 ? '+' : ''}${formatBytes(now - before)} in a day)`
      : formatBytes(now)

export function renderDigest(
  facts: Facts,
  sizes: Sizes,
  previous: Record<string, unknown> | null,
  day: string,
): { subject: string; text: string; problems: number } {
  const before = (key: keyof Sizes) => previous?.[key]
  const lines: string[] = []
  const offline = facts.workers.filter((w) => w.heartbeat_age_s > OFFLINE_AFTER_S)
  const failed = facts.failedJobs.reduce((sum, row) => sum + row.count, 0)
  const bucketPct = (100 * sizes.bucket_bytes) / R2_FREE_BYTES
  const problems =
    failed + facts.failedSchedules.length + offline.length + (bucketPct >= 80 ? 1 : 0)

  lines.push(`Splitune daily digest for ${day} (last 24 hours).`, '')
  lines.push('Analyses finished')
  if (facts.analysesByStatus.length === 0) lines.push('  none')
  for (const row of facts.analysesByStatus) lines.push(`  ${row.status}: ${row.count}`)
  lines.push('', `Failed jobs: ${failed}`)
  for (const row of facts.failedJobs) {
    lines.push(`  ${row.kind} — ${row.errorCode ?? 'no code'}: ${row.count}`)
  }
  if (facts.failedSchedules.length > 0) {
    lines.push('', 'Lifecycle jobs whose last run failed')
    for (const row of facts.failedSchedules)
      lines.push(`  ${row.name} — ${row.errorCode ?? 'no code'}`)
  }
  lines.push('', 'Queue backlog (runnable now)')
  if (facts.backlog.length === 0) lines.push('  empty')
  for (const row of facts.backlog) {
    lines.push(`  ${row.runner}: ${row.queued} queued, oldest ${Math.round(row.oldestS / 60)} min`)
  }
  lines.push('', 'Workers')
  if (facts.workers.length === 0) lines.push('  none has ever reported')
  for (const w of facts.workers) {
    const state = w.heartbeat_age_s > OFFLINE_AFTER_S ? 'OFFLINE' : 'online'
    lines.push(
      `  ${w.worker_id} (${w.runner}): ${state}, last heartbeat ${Math.round(w.heartbeat_age_s / 60)} min ago`,
    )
  }
  lines.push(`  Analyses that waited for an offline worker: ${facts.waitingEvents}`)
  lines.push('', 'Storage')
  lines.push(`  Database: ${growth(sizes.database_bytes, before('database_bytes'))}`)
  lines.push(
    `  R2 bucket: ${growth(sizes.bucket_bytes, before('bucket_bytes'))}, ${sizes.bucket_objects} objects, ${bucketPct.toFixed(1)} % of the 10 GB-month free tier`,
  )
  lines.push(`  ML cache on the Mac: ${growth(sizes.cache_bytes, before('cache_bytes'))}`)
  if (sizes.dumps_bytes !== null || before('dumps_bytes') !== undefined) {
    lines.push(`  Database dumps: ${growth(sizes.dumps_bytes, before('dumps_bytes'))}`)
  }
  const subject = `Splitune digest ${day}: ${problems === 0 ? 'all quiet' : `${problems} to look at`}`
  return { subject, text: `${lines.join('\n')}\n`, problems }
}

export async function sendDigest(s: LifecycleServices, digest: Digest, now = new Date()) {
  const { lifecycle } = queue
  const facts = await lifecycle.digestFacts(s.maintenance, new Date(now.getTime() - DAY_MS))
  const bucket = await s.storage.usage()
  const sizes: Sizes = {
    database_bytes: facts.databaseBytes,
    bucket_bytes: bucket.bytes,
    bucket_objects: bucket.objects,
    cache_bytes: await directoryBytes(digest.cacheDir),
    dumps_bytes: s.config.dump ? await directoryBytes(s.config.dump.dir) : null,
  }
  // The previous digest's sizes (this run is claimed but not finished yet).
  const previous =
    (await lifecycle.scheduledRuns(s.maintenance)).find((r) => r.name === 'daily-digest')
      ?.lastResult ?? null
  const { subject, text, problems } = renderDigest(
    facts,
    sizes,
    previous,
    now.toISOString().slice(0, 10),
  )
  const transport = nodemailer.createTransport({
    host: digest.smtp.host,
    port: digest.smtp.port,
    secure: digest.smtp.secure,
    ...(digest.smtp.user && digest.smtp.password
      ? { auth: { user: digest.smtp.user, pass: digest.smtp.password } }
      : {}),
  })
  try {
    await transport.sendMail({ from: digest.from, to: digest.to, subject, text })
  } finally {
    transport.close()
  }
  return { ...sizes, problems }
}
