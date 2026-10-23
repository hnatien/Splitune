import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { DataExport } from '@splitune/contracts'
import { createDb, createRepositories, type Database, queue } from '@splitune/db'
import {
  artefactKey,
  createStorage,
  exportKey,
  stemKey,
  storageConfigFromEnv,
  userPrefix,
} from '@splitune/storage'
import { Ajv2020 } from 'ajv/dist/2020.js'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { z } from 'zod'
import { backupDatabase, pgDumpTarget } from '../src/backup.ts'
import type { LifecycleConfig } from '../src/config.ts'
import { renderDigest, sendDigest } from '../src/digest.ts'
import { expireExports, sweepStems } from '../src/lifecycle.ts'
import { createLogger } from '../src/log.ts'
import { LifecycleError, lastDueAt, Scheduler } from '../src/scheduler.ts'
import { loadViews } from '../src/views.ts'
import { NodeWorker } from '../src/worker.ts'

const run = promisify(execFile)
const ownerUrl = inject('databaseUrl')
const roleUrl = (role: string, password: string | undefined) => {
  const url = new URL(ownerUrl)
  url.username = role
  url.password = password ?? ''
  return url.toString()
}
const { DB_NODE_WORKER_PASSWORD, DB_MAINTENANCE_PASSWORD } = process.env
const maintenanceUrl = roleUrl('maintenance', DB_MAINTENANCE_PASSWORD)

const owner = new pg.Client({ connectionString: ownerUrl })
const ownerDb: Database = createDb({ url: ownerUrl, max: 2 })
const workerDb: Database = createDb({
  url: roleUrl('node_worker', DB_NODE_WORKER_PASSWORD),
  max: 2,
})
const maintenance: Database = createDb({ url: maintenanceUrl, max: 2 })
const storage = createStorage(storageConfigFromEnv())
const repos = createRepositories(ownerDb)
const logs: string[] = []
const log = createLogger((line) => logs.push(line))
const DAY = 86_400_000
const hashUser = (id: string) => `lc-hash-${id}`

const config: LifecycleConfig = {
  maintenanceUrl,
  stemsInactiveDays: 180,
  expireRawUploads: false,
  nightlyAt: { hour: 3, minute: 30 },
  exportTtlS: 86_400,
}
const services = { maintenance, storage, log, config }
const users: string[] = []

async function newUser() {
  const id = `lc${randomUUID().slice(0, 8)}`
  users.push(id)
  await owner.query('insert into users (id, email) values ($1, $2)', [
    id,
    `${id}@test.splitune.localhost`,
  ])
  return id
}

// A song with a finished analysis whose stems artefact (stems.json + two stem files) is stored.
async function songWithStems(userId: string, lastOpened: Date | null) {
  const song = await repos.songs.create(userId, {
    title: 'Song',
    sourceKind: 'upload',
    instrument: 'guitar',
  })
  await owner.query(
    `update songs set last_opened_at = $2, created_at = now() - interval '400 days' where id = $1`,
    [song.id, lastOpened],
  )
  const created = await repos.analyses.create(
    userId,
    song.id,
    {
      pipelineVersion: 'test',
      configProfile: 'personal',
      requestedInstrument: 'guitar',
      analysisType: 'full',
      idempotencyKey: randomUUID(),
    },
    () => ({ jobs: [] }),
  )
  if (!created) throw new Error('seed failed')
  const analysisId = created.analysis.id
  const json = artefactKey(userId, analysisId, 1, 'stems.json')
  const files = [
    stemKey(userId, analysisId, 1, 'guitar', 'm4a'),
    stemKey(userId, analysisId, 1, 'minus_guitar', 'm4a'),
  ]
  await storage.putBytes(json, '{}', 'application/json')
  for (const file of files) await storage.putBytes(file, new Uint8Array(4096), 'audio/mp4')
  await owner.query(
    `insert into artefacts (user_id, analysis_id, kind, version, object_key, bytes, sha256, model_refs, created_at)
     values ($1, $2, 'stems', 1, $3, 2, $4, '[]', now() - interval '300 days')`,
    [userId, analysisId, json, 'e'.repeat(64)],
  )
  return { songId: song.id, analysisId, json, files }
}

beforeAll(async () => {
  await owner.connect()
})

afterAll(async () => {
  for (const id of users) await storage.deletePrefix(userPrefix(id))
  storage.client.destroy()
  await owner.end()
  await Promise.all([ownerDb.$client.end(), workerDb.$client.end(), maintenance.$client.end()])
})

describe('scheduler', () => {
  it('computes the last due time per cadence', () => {
    const now = new Date(2026, 9, 22, 2, 10, 0) // 02:10 local
    expect(lastDueAt({ every: 'day', at: { hour: 3, minute: 30 } }, now)).toEqual(
      new Date(2026, 9, 21, 3, 30, 0),
    )
    expect(lastDueAt({ every: 'day', at: { hour: 1, minute: 0 } }, now)).toEqual(
      new Date(2026, 9, 22, 1, 0, 0),
    )
    const hourly = lastDueAt({ every: 'hour' }, new Date('2026-10-22T10:59:59Z'))
    expect(hourly.toISOString()).toBe('2026-10-22T10:00:00.000Z')
  })

  it('runs a job once per due time across workers and records failures by code', async () => {
    let runs = 0
    const name = `test-${randomUUID()}`
    const jobs = [
      { name, cadence: { every: 'hour' as const }, run: async () => ({ n: ++runs }) },
      {
        name: `${name}-failing`,
        cadence: { every: 'hour' as const },
        run: async () => {
          throw new LifecycleError('pg_dump_failed')
        },
      },
    ]
    const a = new Scheduler(maintenance, jobs, log)
    const b = new Scheduler(maintenance, jobs, log)
    const now = new Date()
    const [ranA, ranB] = await Promise.all([a.runDue(now), b.runDue(now)])
    expect([...ranA, ...ranB].filter((n) => n === name)).toHaveLength(1)
    expect(runs).toBe(1)
    expect(await a.runDue(now)).toEqual([])
    const rows = await queue.lifecycle.scheduledRuns(maintenance)
    expect(rows.find((r) => r.name === name)).toMatchObject({
      lastStatus: 'done',
      lastResult: { n: 1 },
    })
    expect(rows.find((r) => r.name === `${name}-failing`)).toMatchObject({
      lastStatus: 'failed',
      lastErrorCode: 'pg_dump_failed',
    })
  })
})

describe('sweep-stems', () => {
  it('deletes the stem files of inactive songs only, keeps stems.json, and is idempotent', async () => {
    const userId = await newUser()
    const stale = await songWithStems(userId, new Date(Date.now() - 200 * DAY))
    const active = await songWithStems(userId, new Date(Date.now() - 2 * DAY))

    const first = await sweepStems(services)
    expect(first.stems_swept).toBeGreaterThanOrEqual(1)
    expect(await storage.exists(stale.json)).toBe(true)
    for (const file of stale.files) expect(await storage.exists(file)).toBe(false)
    for (const file of [active.json, ...active.files]) expect(await storage.exists(file)).toBe(true)
    const { rows } = await owner.query(
      'select analysis_id, purged_at from artefacts where analysis_id = any($1)',
      [[stale.analysisId, active.analysisId]],
    )
    const purged = Object.fromEntries(rows.map((r) => [r.analysis_id, r.purged_at !== null]))
    expect(purged).toEqual({ [stale.analysisId]: true, [active.analysisId]: false })

    const second = await sweepStems(services)
    expect(second).toEqual({ stems_swept: 0, objects_deleted: 0, bytes_freed: 0 })
    const { rows: audit } = await owner.query(
      `select count(*)::int as n from audit_log where action = 'stems.swept' and subject->>'analysis_id' = $1`,
      [stale.analysisId],
    )
    expect(audit[0]).toEqual({ n: 1 })
  })
})

// The worker with its maintenance login handles the privacy jobs end to end.
describe('privacy jobs', () => {
  const worker = new NodeWorker(
    {
      db: workerDb,
      storage,
      views: loadViews(),
      workerId: 'node-lifecycle-test',
      log,
      jobHeartbeatMs: 1_000,
      hashUser,
      privacy: {
        db: workerDb,
        maintenance,
        storage,
        log,
        workerId: 'node-lifecycle-test',
        config,
        hashUser,
      },
    },
    {
      databaseUrl: roleUrl('node_worker', DB_NODE_WORKER_PASSWORD),
      workerId: 'node-lifecycle-test',
      pollIntervalMs: 200,
      jobHeartbeatMs: 1_000,
      workerHeartbeatMs: 60_000,
      staleAfterS: 120,
    },
    'test-host',
  )

  beforeAll(async () => {
    await worker.start()
  })
  afterAll(async () => {
    await worker.stop()
  })

  async function waitForJob(kind: string, userId: string, timeoutMs = 15_000) {
    const until = Date.now() + timeoutMs
    for (;;) {
      const { rows } = await owner.query(
        `select id, status, error_code from jobs where kind = $1
         and (payload->>'user_id' = $2 or (payload = '{}'::jsonb and status = 'done'))
         order by id desc limit 1`,
        [kind, userId],
      )
      const row = rows[0] as { status: string; error_code: string | null } | undefined
      if (row && (row.status === 'done' || row.status === 'failed')) return row
      if (Date.now() > until) throw new Error(`${kind} still ${row?.status ?? 'missing'}`)
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  it('writes an export bundle that validates against the JSON schema and expires it after a day', async () => {
    const userId = await newUser()
    const { songId } = await songWithStems(userId, null)
    const upload = await repos.uploads.create(userId, {
      songId,
      objectKey: `${userPrefix(userId)}raw/${randomUUID()}/source.mp3`,
      bytes: 5,
      mime: 'audio/mpeg',
      fileSha256: 'a'.repeat(64),
      status: 'uploaded',
      expiresAt: new Date(Date.now() + DAY),
    })
    await storage.putBytes(upload.objectKey, new Uint8Array(5), 'audio/mpeg')
    const request = await repos.privacy.requestExport(userId, (id) => exportKey(userId, id))
    expect(await waitForJob('export_user_data', userId)).toMatchObject({
      status: 'done',
      error_code: null,
    })

    const ready = await repos.privacy.latestExport(userId)
    expect(ready).toMatchObject({ id: request.id, status: 'ready' })
    expect(ready?.expiresAt?.getTime()).toBeGreaterThan(Date.now() + DAY - 60_000)
    const bytes = await storage.getBytes(request.objectKey, { maxBytes: 1 << 24 })
    const bundle: unknown = JSON.parse(new TextDecoder().decode(bytes))

    const schema = z.toJSONSchema(DataExport, { target: 'draft-2020-12' })
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)
    expect(validate(bundle), JSON.stringify(validate.errors)).toBe(true)
    const parsed = DataExport.parse(bundle)
    expect(parsed.account.id).toBe(userId)
    expect(parsed.songs).toHaveLength(1)
    // The user's own upload is linked while it exists.
    const link = parsed.songs[0]?.uploads[0]?.download_url
    expect(link).toBeTruthy()
    expect((await fetch(link as string)).status).toBe(200)

    // A day later the sweeper removes the bundle.
    await owner.query(
      `update data_exports set expires_at = now() - interval '1 minute' where id = $1`,
      [request.id],
    )
    expect((await expireExports(services)).exports_expired).toBeGreaterThanOrEqual(1)
    expect(await storage.exists(request.objectKey)).toBe(false)
    expect((await repos.privacy.latestExport(userId))?.status).toBe('expired')
  })

  it('deletes an account: no objects under the user prefix, no rows but the audit log', async () => {
    const userId = await newUser()
    const { songId } = await songWithStems(userId, null)
    await repos.loops.create(userId, songId, {
      startBar: 0,
      startBeat: 1,
      endBar: 1,
      endBeat: 4,
      startS: 0,
      endS: 2,
    })
    await owner.query(
      `insert into analytics_events (user_hash, name) values ($1, 'speed_changed')`,
      [hashUser(userId)],
    )
    expect((await storage.listKeys(userPrefix(userId))).length).toBeGreaterThan(0)

    await repos.privacy.requestDeletion(userId)
    expect(await waitForJob('delete_account', userId)).toMatchObject({
      status: 'done',
      error_code: null,
    })

    expect(await storage.listKeys(userPrefix(userId))).toEqual([])
    for (const table of ['users', 'songs', 'analyses', 'artefacts', 'loop_clips', 'data_exports']) {
      const column = table === 'users' ? 'id' : 'user_id'
      const { rows } = await owner.query(
        `select count(*)::int as n from ${table} where ${column} = $1`,
        [userId],
      )
      expect(rows[0], table).toEqual({ n: 0 })
    }
    const { rows: events } = await owner.query(
      'select count(*)::int as n from analytics_events where user_hash = $1',
      [hashUser(userId)],
    )
    expect(events[0]).toEqual({ n: 0 })
    const { rows: jobs } = await owner.query(
      `select count(*)::int as n from jobs where payload::text like $1`,
      [`%${userId}%`],
    )
    expect(jobs[0]).toEqual({ n: 0 })
    const { rows: audit } = await owner.query(
      `select action from audit_log where subject_user_id = $1 and action = 'account.deleted'`,
      [userId],
    )
    expect(audit).toHaveLength(1)
    // Logs carry codes and counts, never the user's keys.
    expect(logs.join('')).not.toContain(userPrefix(userId))
  })
})

describe('pg-dump', () => {
  it('writes a restorable dump as maintenance and keeps the newest N', async () => {
    await songWithStems(await newUser(), null)
    const dir = await mkdtemp(join(tmpdir(), 'splitune-dump-'))
    const scratch = `splitune_restore_${randomUUID().replaceAll('-', '').slice(0, 10)}`
    try {
      const dump = { dir, keep: 2, databaseUrl: maintenanceUrl, bin: 'pg_dump' }
      const result = await backupDatabase(dump, new Date('2026-10-20T03:30:00Z'))
      expect(result.dump_bytes).toBeGreaterThan(0)
      await backupDatabase(dump, new Date('2026-10-21T03:30:00Z'))
      await backupDatabase(dump, new Date('2026-10-22T03:30:00Z'))
      // A file that is not a dump is left alone.
      await writeFile(join(dir, 'notes.txt'), 'keep me')
      expect((await readdir(dir)).sort()).toEqual([
        'notes.txt',
        'splitune-20261021T033000Z.dump',
        'splitune-20261022T033000Z.dump',
      ])

      await owner.query(`create database ${scratch}`)
      const target = new URL(ownerUrl)
      target.pathname = `/${scratch}`
      const password = decodeURIComponent(target.password)
      target.password = ''
      await run(
        'pg_restore',
        [
          '--no-owner',
          '--exit-on-error',
          `--dbname=${target}`,
          join(dir, 'splitune-20261022T033000Z.dump'),
        ],
        { env: { ...process.env, PGPASSWORD: password } },
      )
      const restored = new pg.Client({
        connectionString: ownerUrl.replace(/\/[^/?]+(\?|$)/, `/${scratch}$1`),
      })
      await restored.connect()
      try {
        const count = async (client: pg.Client, sql: string) =>
          ((await client.query(sql)).rows[0] as { n: number }).n
        for (const sql of [
          'select count(*)::int as n from users',
          'select count(*)::int as n from artefacts',
          'select count(*)::int as n from drizzle.__drizzle_migrations',
          `select count(*)::int as n from pg_views where schemaname = 'dashboards'`,
        ]) {
          expect(await count(restored, sql), sql).toBeGreaterThan(0)
        }
        expect(await count(restored, 'select count(*)::int as n from users')).toBe(
          await count(owner, 'select count(*)::int as n from users'),
        )
      } finally {
        await restored.end()
      }
    } finally {
      await owner.query(`drop database if exists ${scratch} with (force)`)
      await rm(dir, { recursive: true, force: true })
    }
  })

  it("passes pg_dump a libpq URL: no password, Railway's no-verify TLS as require", () => {
    const railway = pgDumpTarget(
      'postgres://maintenance:p%40ss@proxy.example:42309/railway?sslmode=no-verify',
    )
    expect(railway).toEqual({
      dbname: 'postgres://maintenance@proxy.example:42309/railway?sslmode=require',
      password: 'p@ss',
    })
    expect(pgDumpTarget('postgres://maintenance:pw@localhost:5432/splitune').dbname).toBe(
      'postgres://maintenance@localhost:5432/splitune',
    )
  })

  it('fails with a code, not pg_dump output, and leaves no partial file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'splitune-dump-'))
    try {
      const bad = new URL(maintenanceUrl)
      bad.password = 'wrong'
      await expect(
        backupDatabase({ dir, keep: 2, databaseUrl: bad.toString(), bin: 'pg_dump' }),
      ).rejects.toThrow(LifecycleError)
      expect(await readdir(dir)).toEqual([])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('daily digest', () => {
  const facts = {
    failedJobs: [{ kind: 'separate', errorCode: 'separation_failed', count: 2 }],
    analysesByStatus: [{ status: 'done' as const, count: 5 }],
    backlog: [{ runner: 'python' as const, queued: 3, oldestS: 1800 }],
    workers: [
      { worker_id: 'ml-mac', runner: 'python', heartbeat_age_s: 7200 },
      { worker_id: 'node-mac', runner: 'node', heartbeat_age_s: 10 },
    ],
    waitingEvents: 4,
    databaseBytes: 50_000_000,
    failedSchedules: [{ name: 'pg-dump', errorCode: 'pg_dump_failed' }],
  }

  it('reports failures, backlog, offline workers and growth against yesterday', () => {
    const sizes = {
      database_bytes: 50_000_000,
      bucket_bytes: 8_500_000_000,
      bucket_objects: 1200,
      cache_bytes: 2_000_000_000,
      dumps_bytes: null,
    }
    const { subject, text, problems } = renderDigest(
      facts,
      sizes,
      { database_bytes: 45_000_000, bucket_bytes: 8_000_000_000 },
      '2026-10-22',
    )
    // 2 failed jobs + 1 failed schedule + 1 offline worker + bucket ≥ 80 % of the free tier.
    expect(problems).toBe(5)
    expect(subject).toBe('Splitune digest 2026-10-22: 5 to look at')
    expect(text).toContain('separate — separation_failed: 2')
    expect(text).toContain('pg-dump — pg_dump_failed')
    expect(text).toContain('python: 3 queued, oldest 30 min')
    expect(text).toContain('ml-mac (python): OFFLINE, last heartbeat 120 min ago')
    expect(text).toContain('Analyses that waited for an offline worker: 4')
    expect(text).toContain('Database: 50.0 MB (+5.0 MB in a day)')
    expect(text).toContain('85.0 % of the 10 GB-month free tier')
  })

  it('sends the digest by SMTP (Mailpit)', async () => {
    const to = `digest-${randomUUID().slice(0, 8)}@test.splitune.localhost`
    const {
      SMTP_HOST = 'localhost',
      SMTP_PORT = '1025',
      EMAIL_FROM = 'Splitune <no-reply@splitune.localhost>',
    } = process.env
    const result = await sendDigest(services, {
      to,
      at: { hour: 8, minute: 0 },
      from: EMAIL_FROM,
      smtp: { host: SMTP_HOST, port: Number(SMTP_PORT), secure: false },
      cacheDir: join(tmpdir(), 'splitune-no-such-cache'),
    })
    expect(result.bucket_objects).toBeGreaterThanOrEqual(0)
    expect(result.cache_bytes).toBeNull()
    const search = await fetch(
      `http://localhost:8025/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
    )
    const found = (await search.json()) as { messages: { Subject: string }[] }
    expect(found.messages).toHaveLength(1)
    expect(found.messages[0]?.Subject).toMatch(/^Splitune digest \d{4}-\d{2}-\d{2}: /)
  })
})
