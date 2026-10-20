import { eq, sql } from 'drizzle-orm'
import pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { jobs, queue, withUser } from '../src/index.ts'
import {
  asRole,
  createUser,
  INSUFFICIENT_PRIVILEGE,
  pgErrorCode,
  seedUserGraph,
  testDb,
} from './helpers.ts'

const { claim, complete, enqueue, fail, heartbeat, requeueStale } = queue
const db = testDb(12)

const statusOf = async (id: number) => {
  const [row] = await db.select().from(jobs).where(eq(jobs.id, id))
  return row
}

let alice: string
let analysisId: string

beforeAll(async () => {
  alice = await createUser(db)
  analysisId = (await seedUserGraph(db, alice)).analysis.id
})

beforeEach(async () => {
  await db.delete(jobs)
})

afterAll(() => db.$client.end())

describe('enqueue', () => {
  it('stores a queued job and notifies jobs_<runner> on commit', async () => {
    const listener = new pg.Client({ connectionString: db.$client.options.connectionString })
    await listener.connect()
    try {
      await listener.query('listen jobs_python')
      const notified = new Promise<pg.Notification>((resolve) => {
        listener.once('notification', resolve)
      })
      const job = await enqueue(db, 'beats', 'python', { input: 'k' }, { analysisId, priority: 10 })
      const notification = await notified
      expect(notification.channel).toBe('jobs_python')
      expect(notification.payload).toBe(String(job.id))
      expect(job).toMatchObject({
        kind: 'beats',
        runner: 'python',
        status: 'queued',
        priority: 10,
        attempts: 0,
        maxAttempts: 3,
        payload: { input: 'k' },
        dependsOn: [],
        analysisId,
      })
    } finally {
      await listener.end()
    }
  })

  it('rejects unknown dependencies', async () => {
    await expect(enqueue(db, 'finalize', 'node', {}, { dependsOn: [987654] })).rejects.toThrow(
      'unknown dependency',
    )
  })

  it('lets the API enqueue only for its own user’s analyses', async () => {
    const bob = await createUser(db)
    const own = await withUser(db, alice, (tx) =>
      enqueue(tx, 'decode', 'python', {}, { analysisId }),
    )
    expect(own.analysisId).toBe(analysisId)
    const code = await pgErrorCode(
      withUser(db, bob, (tx) => enqueue(tx, 'decode', 'python', {}, { analysisId })),
    )
    expect(code).toBe(INSUFFICIENT_PRIVILEGE)
  })
})

describe('claim', () => {
  it('hands each job to exactly one of 10 concurrent claimers', async () => {
    const ids: number[] = []
    for (let i = 0; i < 40; i++) ids.push((await enqueue(db, 'beats', 'python', { i })).id)

    const claimed: number[] = []
    await Promise.all(
      Array.from({ length: 10 }, async (_, w) => {
        for (;;) {
          const job = await claim(db, 'python', `worker-${w}`)
          if (!job) return
          claimed.push(job.id)
          expect(await complete(db, job.id, `worker-${w}`)).toBe(true)
        }
      }),
    )
    expect(claimed).toHaveLength(ids.length)
    expect(new Set(claimed).size).toBe(ids.length)
    expect([...claimed].sort((a, b) => a - b)).toEqual(ids)
  })

  it('marks the job running, locked and attempted', async () => {
    const { id } = await enqueue(db, 'beats', 'python', {})
    const job = await claim(db, 'python', 'mac-1')
    expect(job).toMatchObject({ id, status: 'running', attempts: 1, lockedBy: 'mac-1' })
    expect(job?.lockedAt).toBeInstanceOf(Date)
    expect(job?.heartbeatAt).toBeInstanceOf(Date)
  })

  it('orders by priority, then age, and respects runner, kinds and run_after', async () => {
    const late = await enqueue(db, 'beats', 'python', {}, { priority: 100 })
    const urgent = await enqueue(db, 'beats', 'python', {}, { priority: 10 })
    const later = await enqueue(db, 'beats', 'python', {}, { priority: 100 })
    await enqueue(db, 'finalize', 'node', {})
    await enqueue(db, 'beats', 'python', {}, { runAfter: new Date(Date.now() + 60_000) })
    const chords = await enqueue(db, 'chords', 'python', {}, { priority: 200 })

    expect((await claim(db, 'python', 'w', { kinds: ['chords'] }))?.id).toBe(chords.id)
    expect((await claim(db, 'python', 'w', { kinds: [] }))?.id).toBeUndefined()
    expect((await claim(db, 'python', 'w'))?.id).toBe(urgent.id)
    expect((await claim(db, 'python', 'w'))?.id).toBe(late.id)
    expect((await claim(db, 'python', 'w'))?.id).toBe(later.id)
    expect(await claim(db, 'python', 'w')).toBeUndefined()
  })

  it('waits until every dependency is done', async () => {
    const decode = await enqueue(db, 'decode', 'python', {})
    const beats = await enqueue(db, 'beats', 'python', {}, { dependsOn: [decode.id] })
    const chords = await enqueue(db, 'chords', 'python', {}, { dependsOn: [decode.id] })
    const finalize = await enqueue(db, 'finalize', 'node', {}, { dependsOn: [beats.id, chords.id] })

    expect((await claim(db, 'python', 'w'))?.id).toBe(decode.id)
    expect(await claim(db, 'python', 'w')).toBeUndefined()
    await complete(db, decode.id, 'w')

    expect((await claim(db, 'python', 'w'))?.id).toBe(beats.id)
    expect((await claim(db, 'python', 'w'))?.id).toBe(chords.id)
    await complete(db, beats.id, 'w')
    expect(await claim(db, 'node', 'n')).toBeUndefined()
    await complete(db, chords.id, 'w')
    expect((await claim(db, 'node', 'n'))?.id).toBe(finalize.id)
  })

  it('works under the ml_worker role', async () => {
    const { id } = await enqueue(db, 'beats', 'python', {}, { analysisId })
    const done = await asRole(db, 'ml_worker', async (tx) => {
      const job = await claim(tx, 'python', 'mac-1')
      return job && (await heartbeat(tx, job.id, 'mac-1')) && complete(tx, job.id, 'mac-1')
    })
    expect(done).toBe(true)
    expect((await statusOf(id))?.status).toBe('done')
  })
})

describe('heartbeat and complete', () => {
  it('only succeed for the worker holding the lock', async () => {
    const { id } = await enqueue(db, 'beats', 'python', {})
    await claim(db, 'python', 'mac-1')
    expect(await heartbeat(db, id, 'mac-2')).toBe(false)
    expect(await complete(db, id, 'mac-2')).toBe(false)
    expect(await heartbeat(db, id, 'mac-1')).toBe(true)
    expect(await complete(db, id, 'mac-1')).toBe(true)
    expect(await complete(db, id, 'mac-1')).toBe(false)
  })
})

describe('fail', () => {
  it('retries with exponential backoff until max_attempts, then fails', async () => {
    const { id } = await enqueue(db, 'beats', 'python', {}, { maxAttempts: 2 })
    await claim(db, 'python', 'w')
    const before = Date.now()
    expect(await fail(db, id, 'w', 'model_oom')).toBe('queued')
    const retried = await statusOf(id)
    expect(retried).toMatchObject({
      status: 'queued',
      attempts: 1,
      errorCode: 'model_oom',
      lockedBy: null,
    })
    const delayS = ((retried?.runAfter.getTime() ?? 0) - before) / 1000
    expect(delayS).toBeGreaterThan(queue.BACKOFF_BASE_S - 2)
    expect(delayS).toBeLessThan(queue.BACKOFF_BASE_S + 2)
    expect(await claim(db, 'python', 'w')).toBeUndefined()

    await db.update(jobs).set({ runAfter: sql`now()` }).where(eq(jobs.id, id))
    expect((await claim(db, 'python', 'w'))?.attempts).toBe(2)
    expect(await fail(db, id, 'w', 'model_oom')).toBe('failed')
    expect(await statusOf(id)).toMatchObject({
      status: 'failed',
      attempts: 2,
      errorCode: 'model_oom',
    })
  })

  it('fails at once without retry and cancels dependents transitively', async () => {
    const separate = await enqueue(db, 'separate', 'python', {})
    const notes = await enqueue(db, 'notes.guitar', 'python', {}, { dependsOn: [separate.id] })
    const finalize = await enqueue(db, 'finalize', 'node', {}, { dependsOn: [notes.id] })
    const unrelated = await enqueue(db, 'beats', 'python', {})
    await claim(db, 'python', 'w', { kinds: ['separate'] })

    expect(await fail(db, separate.id, 'w', 'invalid_audio', { retry: false })).toBe('failed')
    expect((await statusOf(separate.id))?.attempts).toBe(1)
    for (const id of [notes.id, finalize.id]) {
      expect(await statusOf(id)).toMatchObject({
        status: 'cancelled',
        errorCode: 'dependency_failed',
      })
    }
    expect((await statusOf(unrelated.id))?.status).toBe('queued')
  })

  it('returns undefined when the lock was lost', async () => {
    const { id } = await enqueue(db, 'beats', 'python', {})
    await claim(db, 'python', 'w')
    expect(await fail(db, id, 'other', 'x')).toBeUndefined()
  })
})

describe('requeueStale', () => {
  const ageHeartbeat = (id: number, seconds: number) =>
    db
      .update(jobs)
      .set({ heartbeatAt: sql`now() - make_interval(secs => ${seconds})` })
      .where(eq(jobs.id, id))

  it('re-queues running jobs whose heartbeat is older than 2 minutes', async () => {
    const stale = await enqueue(db, 'beats', 'python', {})
    const fresh = await enqueue(db, 'chords', 'python', {})
    await claim(db, 'python', 'crashed')
    await claim(db, 'python', 'alive')
    await ageHeartbeat(stale.id, 300)
    await ageHeartbeat(fresh.id, 30)

    expect(await requeueStale(db)).toEqual({ requeued: [stale.id], failed: [] })
    expect(await statusOf(stale.id)).toMatchObject({
      status: 'queued',
      lockedBy: null,
      errorCode: 'lock_expired',
      attempts: 1,
    })
    expect((await statusOf(fresh.id))?.status).toBe('running')
    // The crashed worker comes back: its lock is gone, so it must drop the work.
    expect(await heartbeat(db, stale.id, 'crashed')).toBe(false)
    expect(await complete(db, stale.id, 'crashed')).toBe(false)
    expect((await claim(db, 'python', 'alive'))?.id).toBe(stale.id)
  })

  it('fails jobs that used their last attempt and cancels dependents', async () => {
    const job = await enqueue(db, 'separate', 'python', {}, { maxAttempts: 1 })
    const dependent = await enqueue(db, 'finalize', 'node', {}, { dependsOn: [job.id] })
    await claim(db, 'python', 'crashed')
    await ageHeartbeat(job.id, 300)

    expect(await requeueStale(db)).toEqual({ requeued: [], failed: [job.id] })
    expect((await statusOf(job.id))?.status).toBe('failed')
    expect((await statusOf(dependent.id))?.status).toBe('cancelled')
  })

  it('honours a custom staleness window', async () => {
    const job = await enqueue(db, 'beats', 'python', {})
    await claim(db, 'python', 'w')
    await ageHeartbeat(job.id, 30)
    expect(await requeueStale(db, { staleAfterSeconds: 10 })).toEqual({
      requeued: [job.id],
      failed: [],
    })
  })
})
