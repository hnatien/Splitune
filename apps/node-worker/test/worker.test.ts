import { randomUUID } from 'node:crypto'
import { Summary, Tab } from '@splitune/contracts'
import { createDb, createRepositories, type Database, queue } from '@splitune/db'
import {
  artefactKey,
  createStorage,
  renderKey,
  storageConfigFromEnv,
  userPrefix,
} from '@splitune/storage'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import type { WorkerConfig } from '../src/config.ts'
import { createLogger } from '../src/log.ts'
import { loadViews } from '../src/views.ts'
import { NodeWorker } from '../src/worker.ts'
import { beats, chords, guitarNotes, parseAlphaTex, stems } from './fixtures.ts'

// The worker connects as node_worker (grants of migration 0002) to a throwaway database; the
// owner connection seeds users and reads results back.
const ownerUrl = inject('databaseUrl')
const workerUrl = (() => {
  const url = new URL(ownerUrl)
  url.username = 'node_worker'
  const { DB_NODE_WORKER_PASSWORD = '' } = process.env
  url.password = DB_NODE_WORKER_PASSWORD
  return url.toString()
})()

const owner = new pg.Client({ connectionString: ownerUrl })
const ownerDb: Database = createDb({ url: ownerUrl, max: 2 })
const workerDb: Database = createDb({ url: workerUrl, max: 2 })
const storage = createStorage(storageConfigFromEnv())
const userId = `nw${randomUUID().slice(0, 8)}`
const logs: string[] = []

// A long poll interval: a job finishing quickly proves NOTIFY woke the worker.
const config: WorkerConfig = {
  databaseUrl: workerUrl,
  workerId: 'node-test',
  pollIntervalMs: 60_000,
  jobHeartbeatMs: 1_000,
  workerHeartbeatMs: 60_000,
  staleAfterS: 120,
}
const worker = new NodeWorker(
  {
    db: workerDb,
    storage,
    views: loadViews(),
    workerId: config.workerId,
    log: createLogger((line) => logs.push(line)),
    jobHeartbeatMs: config.jobHeartbeatMs,
  },
  config,
  'test-host',
)

beforeAll(async () => {
  await owner.connect()
  await owner.query('insert into users (id, email) values ($1, $2)', [
    userId,
    `${userId}@test.splitune.localhost`,
  ])
  await worker.start()
})

afterAll(async () => {
  await worker.stop()
  await storage.deletePrefix(userPrefix(userId))
  storage.client.destroy()
  await owner.end()
  await ownerDb.$client.end()
  await workerDb.$client.end()
})

async function seedAnalysis() {
  const repos = createRepositories(ownerDb)
  const song = await repos.songs.create(userId, {
    title: 'Test',
    sourceKind: 'upload',
    instrument: 'guitar',
  })
  const { analysis } = await repos.analyses.createOrGet(userId, {
    songId: song.id,
    version: 1,
    pipelineVersion: 'test',
    configProfile: 'personal',
    requestedInstrument: 'guitar',
    analysisType: 'full',
    status: 'running',
    idempotencyKey: randomUUID(),
  })
  return analysis.id
}

// Fixture artefacts re-issued for the analysis.
async function upload(analysisId: string, file: string, document: Record<string, unknown>) {
  const key = artefactKey(userId, analysisId, 1, file)
  await storage.putBytes(
    key,
    JSON.stringify({ ...document, analysis_id: analysisId, user_id: userId }),
    'application/json',
  )
  return key
}

function request(
  analysisId: string,
  inputs: Record<string, string>,
  outputs?: Record<string, string>,
) {
  return {
    analysis_id: analysisId,
    user_id: userId,
    stage: 'finalize',
    inputs,
    outputs: outputs ?? {
      'tab.guitar': artefactKey(userId, analysisId, 1, 'tab.guitar.json'),
      'render.guitar': renderKey(userId, analysisId, 1, 'guitar'),
      summary: artefactKey(userId, analysisId, 1, 'summary.json'),
    },
    params: { instruments: ['guitar'] },
  }
}

const summaryKey = (payload: ReturnType<typeof request>) => {
  const { summary } = payload.outputs
  return summary as string
}

async function waitForJob(id: number, timeoutMs = 10_000) {
  const until = Date.now() + timeoutMs
  for (;;) {
    const { rows } = await owner.query('select status, error_code from jobs where id = $1', [id])
    const row = rows[0] as { status: string; error_code: string | null }
    if (row.status === 'done' || row.status === 'failed') return row
    if (Date.now() > until) throw new Error(`job ${id} still ${row.status}`)
    await new Promise((r) => setTimeout(r, 100))
  }
}

const text = async (key: string) =>
  new TextDecoder().decode(await storage.getBytes(key, { maxBytes: 1 << 24 }))

describe('node worker finalize', () => {
  it('claims a finalize job on NOTIFY and writes tab, alphaTex, summary and bookkeeping', async () => {
    const analysisId = await seedAnalysis()
    const inputs = {
      beats: await upload(analysisId, 'beats.json', beats()),
      chords: await upload(analysisId, 'chords.json', chords()),
      stems: await upload(analysisId, 'stems.json', stems()),
      'notes.guitar': await upload(analysisId, 'notes.guitar.json', guitarNotes()),
    }
    const payload = request(analysisId, inputs)
    const job = await queue.enqueue(ownerDb, 'finalize', 'node', payload, { analysisId })
    const started = Date.now()
    expect(await waitForJob(job.id)).toEqual({ status: 'done', error_code: null })
    expect(Date.now() - started).toBeLessThan(10_000)

    const tab = Tab.parse(JSON.parse(await text(payload.outputs['tab.guitar'] as string)))
    expect(tab.analysis_id).toBe(analysisId)
    expect(parseAlphaTex(await text(payload.outputs['render.guitar'] as string)).errors).toEqual([])
    const summary = Summary.parse(JSON.parse(await text(summaryKey(payload))))
    expect(summary.per_instrument[0]?.recommended_view).toBe('tab')

    const { rows: arts } = await owner.query(
      'select kind, object_key from artefacts where analysis_id = $1 order by kind',
      [analysisId],
    )
    expect(arts.map((r) => r.kind)).toEqual(['render.guitar', 'summary', 'tab.guitar'])
    const { rows: analysis } = await owner.query(
      'select status, progress, finished_at from analyses where id = $1',
      [analysisId],
    )
    expect(analysis[0]).toMatchObject({ status: 'done', progress: 1 })
    const { rows: events } = await owner.query(
      "select event->>'type' as type from job_events where analysis_id = $1 order by id",
      [analysisId],
    )
    expect(events.map((e) => e.type)).toEqual(['stage.started', 'stage.completed', 'analysis.done'])
    const { rows: presence } = await owner.query(
      "select runner from worker_heartbeats where worker_id = 'node-test'",
    )
    expect(presence).toEqual([{ runner: 'node' }])
    // No object keys or URLs in the logs.
    expect(logs.join('')).not.toContain(userId)
  })

  it('finishes a partial analysis when notes and chords are missing', async () => {
    const analysisId = await seedAnalysis()
    const payload = request(analysisId, {
      beats: await upload(analysisId, 'beats.json', beats()),
      chords: artefactKey(userId, analysisId, 1, 'chords.json'), // never written
    })
    const job = await queue.enqueue(ownerDb, 'finalize', 'node', payload, { analysisId })
    expect((await waitForJob(job.id)).status).toBe('done')
    const summary = Summary.parse(JSON.parse(await text(summaryKey(payload))))
    expect(summary.per_instrument[0]).toMatchObject({
      recommended_view: 'chords_only',
      reasons: ['notes_unavailable'],
    })
    const { rows } = await owner.query('select status from analyses where id = $1', [analysisId])
    expect(rows[0]).toEqual({ status: 'partial' })
  })

  it('fails permanently without beats, and on outputs outside the analysis prefix', async () => {
    const analysisId = await seedAnalysis()
    const noBeats = await queue.enqueue(
      ownerDb,
      'finalize',
      'node',
      request(analysisId, { beats: artefactKey(userId, analysisId, 1, 'beats.json') }),
      { analysisId },
    )
    expect(await waitForJob(noBeats.id)).toEqual({ status: 'failed', error_code: 'beats_missing' })
    const { rows } = await owner.query('select status from analyses where id = $1', [analysisId])
    expect(rows[0]).toEqual({ status: 'failed' })

    const other = await seedAnalysis()
    const escaping = await queue.enqueue(
      ownerDb,
      'finalize',
      'node',
      request(
        other,
        { beats: await upload(other, 'beats.json', beats()) },
        {
          'tab.guitar': artefactKey(userId, analysisId, 1, 'tab.guitar.json'),
          'render.guitar': renderKey(userId, other, 1, 'guitar'),
          summary: artefactKey(userId, other, 1, 'summary.json'),
        },
      ),
      { analysisId: other },
    )
    expect(await waitForJob(escaping.id)).toEqual({
      status: 'failed',
      error_code: 'invalid_request',
    })
  })
})
