import { type ChildProcess, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { userHasher } from '@splitune/analytics/server'
import { DataExport } from '@splitune/contracts'
import { rawUploadKey, userPrefix } from '@splitune/storage'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import {
  type Caller,
  caller,
  createTestApi,
  sha256Hex,
  signIn,
  testEmail,
  userIdOf,
} from './helpers.ts'

// Privacy self-service (15 §4) through the API, with the real node worker (its maintenance login)
// doing the work: "Download my data" and "Delete my account" (re-auth required). Plus the
// analytics privacy rules (16 §6) and the typed flags (16 §5) at the API boundary.

const REPO = new URL('../../../', import.meta.url).pathname
const api = createTestApi()
const sql = (text: string, params: unknown[] = []) => api.db.$client.query(text, params)
const hash = userHasher(api.config.analyticsSalt)
let worker: ChildProcess | undefined

const json = async <T = Record<string, unknown>>(res: Response) => (await res.json()) as T

interface User {
  id: string
  email: string
  cookie: string
  call: Caller
}

async function newUser(): Promise<User> {
  const email = testEmail()
  const cookie = await signIn(api, email)
  return { id: await userIdOf(api, cookie), email, cookie, call: caller(api, cookie) }
}

async function songWithUpload(user: User) {
  const res = await user.call.request('POST', '/v1/songs', {
    title: 'My song',
    instrument: 'guitar',
    source_kind: 'upload',
  })
  const { song_id: songId } = await json<{ song_id: string }>(res)
  const uploadId = randomUUID()
  const key = rawUploadKey(user.id, uploadId, 'song.mp3')
  await sql(
    `insert into uploads (id, user_id, song_id, object_key, bytes, mime, file_sha256, status, expires_at)
     values ($1, $2, $3, $4, 3, 'audio/mpeg', $5, 'uploaded', now() + interval '7 days')`,
    [uploadId, user.id, songId, key, sha256Hex(uploadId)],
  )
  await api.storage.putBytes(key, new Uint8Array([1, 2, 3]), 'audio/mpeg')
  return { songId, key }
}

const roleUrl = (role: string, password: string | undefined) => {
  const url = new URL(inject('databaseUrl'))
  url.username = role
  url.password = password ?? ''
  return url.toString()
}

beforeAll(() => {
  const { DB_NODE_WORKER_PASSWORD, DB_MAINTENANCE_PASSWORD } = process.env
  worker = spawn(process.execPath, ['src/main.ts'], {
    cwd: join(REPO, 'apps/node-worker'),
    env: {
      ...process.env,
      NODE_WORKER_DATABASE_URL: roleUrl('node_worker', DB_NODE_WORKER_PASSWORD),
      NODE_WORKER_MAINTENANCE_DATABASE_URL: roleUrl('maintenance', DB_MAINTENANCE_PASSWORD),
      NODE_WORKER_ID: 'node-privacy-test',
      NODE_WORKER_POLL_INTERVAL_S: '1',
      ANALYTICS_SALT: api.config.analyticsSalt,
      PG_DUMP_DIR: '',
      DIGEST_EMAIL_TO: '',
    },
    stdio: ['ignore', 'ignore', 'ignore'],
  })
})

afterAll(async () => {
  await new Promise<void>((resolve) => {
    if (!worker || worker.exitCode !== null) return resolve()
    worker.once('exit', () => resolve())
    worker.kill('SIGTERM')
  })
  await api.close()
})

async function until<T>(check: () => Promise<T | undefined>, timeoutMs = 20_000): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await check()
    if (value !== undefined) return value
    if (Date.now() > deadline) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 200))
  }
}

describe('download my data', () => {
  it('reports the request, then a 24 h link to a bundle with everything of the account', async () => {
    const user = await newUser()
    const { songId } = await songWithUpload(user)
    expect(await json(await user.call.request('GET', '/v1/me/export'))).toMatchObject({
      status: 'none',
      url: null,
    })
    const requested = await user.call.request('POST', '/v1/me/export')
    expect(requested.status).toBe(202)
    expect(await json(requested)).toMatchObject({ status: 'pending', url: null })

    const ready = await until(async () => {
      const state = await json<{ status: string; url: string | null; expires_at: string | null }>(
        await user.call.request('GET', '/v1/me/export'),
      )
      return state.status === 'ready' ? state : undefined
    })
    const hours = (Date.parse(ready.expires_at ?? '') - Date.now()) / 3_600_000
    expect(hours).toBeGreaterThan(23.9)
    expect(hours).toBeLessThanOrEqual(24)
    const bundle = DataExport.parse(await (await fetch(ready.url as string)).json())
    expect(bundle.account).toMatchObject({ id: user.id, email: user.email })
    expect(bundle.songs.map((s) => s.id)).toEqual([songId])
    const link = bundle.songs[0]?.uploads[0]?.download_url as string
    expect(new Uint8Array(await (await fetch(link)).arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    )
  })

  it('keeps one request pending at a time', async () => {
    const user = await newUser()
    await worker?.kill('SIGSTOP')
    try {
      const first = await json<{ requested_at: string }>(
        await user.call.request('POST', '/v1/me/export'),
      )
      const second = await json<{ requested_at: string }>(
        await user.call.request('POST', '/v1/me/export'),
      )
      expect(second.requested_at).toBe(first.requested_at)
    } finally {
      worker?.kill('SIGCONT')
    }
  })
})

describe('delete my account', () => {
  it('asks for a fresh sign-in when the session is older than 10 minutes', async () => {
    const user = await newUser()
    await sql(
      `update auth_sessions set created_at = now() - interval '11 minutes' where user_id = $1`,
      [user.id],
    )
    const res = await user.call.request('DELETE', '/v1/me')
    expect(res.status).toBe(403)
    expect(await json(res)).toMatchObject({
      code: 'forbidden',
      details: { reason: 'reauth_required' },
    })
    expect((await sql('select deleted_at from users where id = $1', [user.id])).rows).toEqual([
      { deleted_at: null },
    ])
  })

  it('ends every session at once, then the worker removes all rows and objects', async () => {
    const user = await newUser()
    const other = caller(api, await signIn(api, user.email)) // a second device
    const { key } = await songWithUpload(user)
    await user.call.request('POST', '/v1/events', {
      events: [{ name: 'speed_changed', props: { speed_pct: 70, input_mode: 'pedal' } }],
    })

    const res = await user.call.request('DELETE', '/v1/me')
    expect(res.status).toBe(202)
    expect(Date.parse((await json<{ purge_after: string }>(res)).purge_after)).not.toBeNaN()
    expect((await user.call.request('GET', '/v1/me')).status).toBe(401)
    expect((await other.request('GET', '/v1/me')).status).toBe(401)

    await until(async () =>
      (await sql('select 1 from users where id = $1', [user.id])).rowCount === 0 ? true : undefined,
    )
    expect(await api.storage.exists(key)).toBe(false)
    expect(await api.storage.listKeys(userPrefix(user.id))).toEqual([])
    const leftovers = await sql(
      `select (select count(*) from songs where user_id = $1)::int as songs,
              (select count(*) from uploads where user_id = $1)::int as uploads,
              (select count(*) from auth_sessions where user_id = $1)::int as sessions,
              (select count(*) from analytics_events where user_hash = $2)::int as events,
              (select count(*) from jobs where payload::text like '%' || $1 || '%')::int as jobs`,
      [user.id, hash(user.id)],
    )
    expect(leftovers.rows[0]).toEqual({ songs: 0, uploads: 0, sessions: 0, events: 0, jobs: 0 })
    const audit = await sql(`select action from audit_log where subject_user_id = $1 order by id`, [
      user.id,
    ])
    expect(audit.rows.map((r) => r.action)).toContain('account.deleted')
  })
})

describe('product events', () => {
  it('stores the salted user hash, never the id, and only declared props', async () => {
    const user = await newUser()
    const res = await user.call.request('POST', '/v1/events', {
      events: [
        {
          name: 'display_settings_changed',
          props: {
            appearance: 'stage',
            score_surface: 'paper',
            distance: 'stand',
            calibration_pct: 110,
            hyperlegible: true,
            reduced_motion: 'system',
            contrast: 'more',
            email: user.email,
            title: 'My song',
          },
        },
      ],
    })
    expect(res.status).toBe(204)
    const { rows } = await sql(
      `select * from analytics_events where user_hash = $1 and name = 'display_settings_changed'`,
      [hash(user.id)],
    )
    expect(rows).toHaveLength(1)
    expect(Object.keys(rows[0]).sort()).toEqual(['at', 'id', 'name', 'props', 'user_hash'])
    expect(Object.keys(rows[0].props).sort()).toEqual([
      'appearance',
      'calibration_pct',
      'contrast',
      'distance',
      'hyperlegible',
      'reduced_motion',
      'score_surface',
    ])
    expect(JSON.stringify(rows[0])).not.toContain(user.id)
  })

  it('records analysis_requested for a new run, not for a repeated request', async () => {
    const user = await newUser()
    const { songId } = await songWithUpload(user)
    const body = { song_id: songId, instrument: 'guitar', type: 'lite' }
    expect((await user.call.request('POST', '/v1/analyses', body)).status).toBe(202)
    expect((await user.call.request('POST', '/v1/analyses', body)).status).toBe(202)
    const { rows } = await sql(
      `select props from analytics_events where user_hash = $1 and name = 'analysis_requested'`,
      [hash(user.id)],
    )
    expect(rows.map((r) => r.props)).toEqual([
      { type: 'lite', instrument: 'guitar', source: 'file' },
    ])
  })
})

describe('feature flags', () => {
  it('evaluates declared flags for /v1/me and gates link import and the speed trainer', async () => {
    await sql(
      `insert into feature_flags (key, enabled) values ('import.url', false), ('v1.speed_trainer', false)
       on conflict (key) do update set enabled = excluded.enabled`,
    )
    // A fresh app: flags are cached per process for 30 s.
    const flagged = createTestApi()
    try {
      const cookie = await signIn(flagged)
      const user = caller(flagged, cookie)
      const me = await json<{ flags: Record<string, boolean> }>(await user.request('GET', '/v1/me'))
      expect(me.flags).toMatchObject({
        'import.url': false,
        examples: true,
        'v1.speed_trainer': false,
        'v1.mic_scoring': false,
      })
      const imported = await user.request('POST', '/v1/songs/import-url', {
        url: 'https://www.youtube.com/watch?v=h_N0-H49R6I',
        instrument: 'guitar',
        type: 'lite',
      })
      expect(imported.status).toBe(422)
      expect(await json(imported)).toMatchObject({
        code: 'url_unsupported',
        details: { reason: 'import_disabled' },
      })
      const song = await json<{ song_id: string }>(
        await user.request('POST', '/v1/songs', { instrument: 'guitar', source_kind: 'upload' }),
      )
      const loop = {
        start_bar: 0,
        start_beat: 1,
        end_bar: 1,
        end_beat: 4,
        start_s: 0,
        end_s: 2,
        trainer: {
          start_pct: 60,
          end_pct: 90,
          step_pct: 5,
          plays_per_step: 2,
          count_in_each_pass: false,
        },
      }
      const refused = await user.request('POST', `/v1/songs/${song.song_id}/loops`, loop)
      expect(refused.status).toBe(400)
      expect(await json(refused)).toMatchObject({
        details: { issues: [{ path: 'trainer', code: 'feature_disabled' }] },
      })
      const plain = await user.request('POST', `/v1/songs/${song.song_id}/loops`, {
        ...loop,
        trainer: null,
      })
      expect(plain.status).toBe(201)
    } finally {
      await sql(`delete from feature_flags where key in ('import.url', 'v1.speed_trainer')`)
      await flagged.close()
    }
  })
})
