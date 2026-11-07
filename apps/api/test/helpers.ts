import { createHash, randomInt, randomUUID } from 'node:crypto'
import { createDb, type Database } from '@splitune/db'
import { createStorage, type Storage, storageConfigFromEnv } from '@splitune/storage'
import { expect, inject } from 'vitest'
import { type Api, CSRF_HEADER, createApi } from '../src/app.ts'
import { placeholderEmail } from '../src/auth.ts'
import { type ApiConfig, configFromEnv } from '../src/config.ts'
import type { Mail } from '../src/mailer.ts'

export interface TestApi {
  app: Api
  db: Database
  storage: Storage
  config: ApiConfig
  // Every email any test app in this file sent, newest last (no SMTP server in tests).
  outbox: Mail[]
  close(): Promise<void>
}

const outbox: Mail[] = []
const mailer = {
  async send(mail: Mail) {
    outbox.push(mail)
  },
}

// The real app on the throwaway database and SeaweedFS, with an in-memory mailer. TRUST_PROXY lets
// each test pick its client address with X-Forwarded-For (per-IP limits).
export function createTestApi(env: Record<string, string> = {}): TestApi {
  const config = configFromEnv({
    ...process.env,
    NODE_ENV: 'test',
    TRUST_PROXY: 'true',
    LOG_LEVEL: 'silent',
    ...env,
  })
  const db = createDb({ url: inject('databaseUrl'), max: 10 })
  const storage = createStorage(storageConfigFromEnv())
  const app = createApi({ db, storage, config, mailer })
  return { app, db, storage, config, outbox, close: () => db.$client.end() }
}

// Random private addresses: the rate-limit table is shared by every test file, so a
// per-file counter would make files collide on the per-IP sign-in limit.
export const nextIp = () => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`

// Unique per call; within Better Auth's 3–30 characters of letters, digits and underscores.
export const testUsername = () => `t_${randomUUID().replaceAll('-', '').slice(0, 24)}`
export const TEST_PASSWORD = 'practice-slowly-42'
// The placeholder address the server gives a username account (auth.ts).
export const emailOf = (username: string) => placeholderEmail(username)

// "name=value; name2=value2" from a response's Set-Cookie headers.
export function cookieHeader(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

const authPost = (api: TestApi, path: string, body: unknown, ip = nextIp()) =>
  api.app.request(`/v1/auth${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: api.config.appUrl,
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  })

export const signUpRequest = (
  api: TestApi,
  username: string,
  password = TEST_PASSWORD,
  ip = nextIp(),
) => authPost(api, '/sign-up/email', { username, password, name: '' }, ip)

export const signInRequest = (
  api: TestApi,
  username: string,
  password = TEST_PASSWORD,
  ip = nextIp(),
) => authPost(api, '/sign-in/username', { username, password }, ip)

const sessionCookie = (res: Response) => {
  expect(res.status).toBe(200)
  const cookie = cookieHeader(res)
  expect(cookie).toContain('splitune.session_token=')
  return cookie
}

// Signs in as `username`, creating the account first when it doesn't exist yet. Returns the
// session cookie header.
export async function signIn(api: TestApi, username = testUsername()): Promise<string> {
  const created = await signUpRequest(api, username)
  if (created.status === 200) return sessionCookie(created)
  expect(((await created.json()) as { code?: string }).code).toBe('USERNAME_IS_ALREADY_TAKEN')
  return sessionCookie(await signInRequest(api, username))
}

export interface Caller {
  request(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<Response>
}

// Calls the API like the web client: session cookie plus the CSRF header on every request.
export function caller(api: TestApi, cookie?: string): Caller {
  return {
    async request(method, path, body, headers = {}) {
      return api.app.request(path, {
        method,
        headers: {
          ...(cookie ? { cookie } : {}),
          [CSRF_HEADER]: '1',
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    },
  }
}

export const sha256Hex = (seed: string) => createHash('sha256').update(seed).digest('hex')

// The id behind a session cookie, via Better Auth's own session endpoint.
export async function userIdOf(api: TestApi, cookie: string): Promise<string> {
  const res = await api.app.request('/v1/auth/get-session', { headers: { cookie } })
  const body = (await res.json()) as { user: { id: string } }
  return body.user.id
}

export interface SseMessage {
  id: string | undefined
  event: string | undefined
  data: unknown
}

// Server-sent events of a streaming response, frame by frame (comments and keep-alives skipped).
export async function* sseMessages(res: Response): AsyncGenerator<SseMessage> {
  if (!res.body) throw new Error('response has no body')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) return
      buffer += decoder.decode(value, { stream: true })
      for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
        const frame = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        const fields = new Map<string, string>()
        for (const line of frame.split('\n')) {
          const colon = line.indexOf(':')
          if (colon <= 0) continue
          const name = line.slice(0, colon)
          const value = line.slice(colon + 1).trimStart()
          const previous = fields.get(name)
          fields.set(name, previous === undefined ? value : `${previous}\n${value}`)
        }
        const data = fields.get('data')
        if (data !== undefined) {
          yield { id: fields.get('id'), event: fields.get('event'), data: JSON.parse(data) }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// Gives a user a live Plus subscription straight in the cache (as the webhook would leave it), for
// tests about something other than billing.
export async function subscribePlus(api: TestApi, userId: string, plan = 'paid_monthly') {
  await api.db.$client.query(
    `insert into subscriptions (user_id, provider, plan, status, current_period_start, current_period_end)
     values ($1, 'mock', $2, 'active', now() - interval '1 day', now() + interval '29 days')
     on conflict (user_id) do update set plan = excluded.plan, status = 'active',
       current_period_start = excluded.current_period_start,
       current_period_end = excluded.current_period_end`,
    [userId, plan],
  )
}
