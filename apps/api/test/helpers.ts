import { createHash, randomInt, randomUUID } from 'node:crypto'
import { createDb, type Database } from '@splitune/db'
import { createStorage, type Storage, storageConfigFromEnv } from '@splitune/storage'
import { expect, inject } from 'vitest'
import { type Api, CSRF_HEADER, createApi } from '../src/app.ts'
import { type ApiConfig, configFromEnv } from '../src/config.ts'

export const { MAILPIT_URL = 'http://localhost:8025' } = process.env

export interface TestApi {
  app: Api
  db: Database
  storage: Storage
  config: ApiConfig
  close(): Promise<void>
}

// The real app on the throwaway database, SeaweedFS and Mailpit. TRUST_PROXY lets each test pick
// its client address with X-Forwarded-For (per-IP limits).
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
  const app = createApi({ db, storage, config })
  return { app, db, storage, config, close: () => db.$client.end() }
}

// Random private addresses: the rate-limit table is shared by every test file, so a
// per-file counter would make files collide on the per-IP sign-in limit.
export const nextIp = () => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`

export const testEmail = () => `${randomUUID()}@test.splitune.localhost`

interface MailpitSummary {
  ID: string
}

// Waits for the newest email to `to` in Mailpit and returns its plain-text body.
export async function waitForMail(to: string, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const query = encodeURIComponent(`to:"${to}"`)
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`)
    const { messages } = (await res.json()) as { messages: MailpitSummary[] }
    const [latest] = messages
    if (latest) {
      const message = await fetch(`${MAILPIT_URL}/api/v1/message/${latest.ID}`)
      return ((await message.json()) as { Text: string }).Text
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`no email to ${to} within ${timeoutMs} ms`)
}

export function magicLinkFrom(text: string): URL {
  const match = /https?:\/\/\S+\/v1\/auth\/magic-link\/verify\?\S+/.exec(text)
  if (!match) throw new Error('no magic link in email')
  return new URL(match[0])
}

// "name=value; name2=value2" from a response's Set-Cookie headers.
export function cookieHeader(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

export async function requestMagicLink(api: TestApi, email: string, ip = nextIp()) {
  return api.app.request('/v1/auth/sign-in/magic-link', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: api.config.appUrl,
      'x-forwarded-for': ip,
    },
    body: JSON.stringify({ email, callbackURL: '/' }),
  })
}

// Full magic-link sign-in: request the link, read it from Mailpit, follow it. Returns the session
// cookie header.
export async function signIn(api: TestApi, email = testEmail()): Promise<string> {
  const ip = nextIp()
  const sent = await requestMagicLink(api, email, ip)
  expect(sent.status).toBe(200)
  const link = magicLinkFrom(await waitForMail(email))
  const verified = await api.app.request(`${link.pathname}${link.search}`, {
    headers: { 'x-forwarded-for': ip },
  })
  expect(verified.status).toBe(302)
  const cookie = cookieHeader(verified)
  expect(cookie).toContain('splitune.session_token=')
  return cookie
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
