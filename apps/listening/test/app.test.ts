// Against the compose Postgres, in a throwaway schema (dropped afterwards).
import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { byteRange, createApp } from '../src/app.ts'
import { Store } from '../src/store.ts'
import { manifest, sessionDir } from './fixture.ts'

// DATABASE_URL from the environment, .env or .env.example (as packages/db's tests do).
for (const file of ['../../../.env', '../../../.env.example']) {
  try {
    process.loadEnvFile(new URL(file, import.meta.url))
  } catch {
    // Missing file: fall through to the next one.
  }
}
const { DATABASE_URL: url } = process.env
if (!url) throw new Error('DATABASE_URL is not set')
const schema = `listening_test_${randomBytes(4).toString('hex')}`
const pool = new pg.Pool({ connectionString: url, max: 2 })
const store = new Store(pool, schema)
const app = createApp(manifest, sessionDir(), store)

const post = (path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeAll(async () => {
  await store.bootstrap()
  await store.bootstrap() // idempotent
})

afterAll(async () => {
  await pool.query(`drop schema if exists ${schema} cascade`)
  await pool.end()
})

async function newRater(): Promise<string> {
  const res = await post('/api/raters', {
    name: 'Owner',
    instrument: 'guitar',
    experience: 'intermediate',
  })
  expect(res.status).toBe(200)
  return ((await res.json()) as { rater: string }).rater
}

describe('listening app', () => {
  it('saves ratings and preferences and resumes with them', async () => {
    const rater = await newRater()
    expect((await post('/api/ratings', { rater, item: 'item0000000002', score: 4 })).status).toBe(
      200,
    )
    expect((await post('/api/ratings', { rater, item: 'item0000000002', score: 5 })).status).toBe(
      200,
    )
    expect(
      (await post('/api/preferences', { rater, pair: 'pair0000000001', choice: 'b' })).status,
    ).toBe(200)

    const res = await app.request(`/api/tasks?rater=${rater}`)
    const { tasks } = (await res.json()) as {
      tasks: { id: string; type: string; a?: string; b?: string; answer: unknown }[]
    }
    expect(tasks.find((t) => t.id === 'item0000000002')?.answer).toBe(5)
    expect(tasks.find((t) => t.id === 'item0000000001')?.answer).toBeNull()
    const compare = tasks.find((t) => t.type === 'compare')
    expect(compare?.answer).toBe('b')

    // The stored answer is the preferred item, independent of how the sides were shuffled.
    const { rows } = await pool.query(
      `select preferred from ${schema}.preferences where rater_id = $1`,
      [rater],
    )
    expect(rows).toEqual([{ preferred: compare?.b }])
    const scores = await pool.query(
      `select item, score from ${schema}.ratings where rater_id = $1`,
      [rater],
    )
    expect(scores.rows).toEqual([{ item: 'item0000000002', score: 5 }])
  })

  it('records "no preference" as null', async () => {
    const rater = await newRater()
    await post('/api/preferences', { rater, pair: 'pair0000000001', choice: 'none' })
    const { rows } = await pool.query(
      `select preferred from ${schema}.preferences where rater_id = $1`,
      [rater],
    )
    expect(rows).toEqual([{ preferred: null }])
  })

  it('rejects bad input and unknown raters', async () => {
    const rater = await newRater()
    expect((await post('/api/ratings', { rater, item: 'item0000000002', score: 6 })).status).toBe(
      400,
    )
    expect((await post('/api/ratings', { rater, item: 'nope', score: 3 })).status).toBe(400)
    expect(
      (await post('/api/preferences', { rater, pair: 'pair0000000001', choice: 'c' })).status,
    ).toBe(400)
    expect(
      (await post('/api/raters', { name: '', instrument: 'x', experience: 'learner' })).status,
    ).toBe(400)
    const stranger = '00000000-0000-4000-8000-000000000000'
    expect(
      (await post('/api/ratings', { rater: stranger, item: 'item0000000002', score: 3 })).status,
    ).toBe(404)
    expect((await app.request(`/api/tasks?rater=${stranger}`)).status).toBe(404)
  })

  it('answers byte-range requests, as Safari needs for audio', async () => {
    const whole = await app.request('/media/item0000000003')
    expect(whole.headers.get('accept-ranges')).toBe('bytes')
    expect(whole.headers.get('content-length')).toBe(String('audio:song-b.kim.m4a'.length))
    const part = await app.request('/media/item0000000003', { headers: { range: 'bytes=0-1' } })
    expect(part.status).toBe(206)
    expect(part.headers.get('content-range')).toBe('bytes 0-1/20')
    expect(await part.text()).toBe('au')
    const tail = await app.request('/media/item0000000003', { headers: { range: 'bytes=-3' } })
    expect(await tail.text()).toBe('m4a')
    const bad = await app.request('/media/item0000000003', { headers: { range: 'bytes=50-60' } })
    expect(bad.status).toBe(416)
    expect(byteRange('bytes=5-', 20)).toEqual([5, 19])
    expect(byteRange('bytes=0-99', 20)).toEqual([0, 19])
    expect(byteRange('items=0-1', 20)).toBe('invalid')
  })

  it('serves media by token only, without system names in the tasks', async () => {
    const ok = await app.request('/media/item0000000003')
    expect(ok.status).toBe(200)
    expect(await ok.text()).toBe('audio:song-b.kim.m4a')
    expect((await app.request('/media/song-b.kim.m4a')).status).toBe(404)
    expect((await app.request('/media/..%2Fsession.json')).status).toBe(404)
    const rater = await newRater()
    const text = await (await app.request(`/api/tasks?rater=${rater}`)).text()
    expect(text).not.toMatch(/roformer|demucs|kim/)
  })
})
