import { afterAll, describe, expect, it } from 'vitest'
import { requireRecentAuth } from '../src/auth.ts'
import {
  caller,
  cookieHeader,
  createTestApi,
  emailOf,
  nextIp,
  signIn,
  signInRequest,
  signUpRequest,
  TEST_PASSWORD,
  testUsername,
} from './helpers.ts'

const api = createTestApi()
afterAll(() => api.close())

const code = async (res: Response) => ((await res.json()) as { code?: string }).code

describe('username and password sign-in', () => {
  it('signs up with a session cookie usable on /v1/me, and no email', async () => {
    const username = `Ana_${testUsername()}`.slice(0, 30)
    const created = await signUpRequest(api, username)
    expect(created.status).toBe(200)
    const [sessionCookie] = created.headers
      .getSetCookie()
      .filter((c) => c.startsWith('splitune.session_token='))
    expect(sessionCookie).toMatch(/HttpOnly/i)
    expect(sessionCookie).toMatch(/SameSite=Lax/i)
    expect(sessionCookie).not.toMatch(/Secure/i) // HTTP locally; Secure in production
    const cookie = cookieHeader(created)

    const me = await caller(api, cookie).request('GET', '/v1/me')
    expect(me.status).toBe(200)
    expect(await me.json()).toMatchObject({
      email: emailOf(username),
      username,
      plan: 'free',
      display_name: null,
      handedness: 'right',
      subscription: null,
      usage: {
        welcome_available: true,
        full: { used: 0, cap: 0 },
        lite: { used: 0, cap: 5 },
      },
      entitlements: expect.arrayContaining(['practice.core', 'analysis.welcome', 'embed.view']),
    })
    expect(api.outbox).toEqual([])

    // Usernames are case-insensitive for sign-in.
    const again = await signInRequest(api, username.toUpperCase())
    expect(again.status).toBe(200)
    expect(cookieHeader(again)).toContain('splitune.session_token=')
  })

  it('derives the email from the username, whatever the request says', async () => {
    const username = testUsername()
    const res = await api.app.request('/v1/auth/sign-up/email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: api.config.appUrl,
        'x-forwarded-for': nextIp(),
      },
      body: JSON.stringify({
        username,
        email: 'someone-else@example.com',
        password: TEST_PASSWORD,
        name: '',
      }),
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { user: { email: string } }).user.email).toBe(emailOf(username))
  })

  it('refuses a wrong password, a taken username and weak input', async () => {
    const username = testUsername()
    await signIn(api, username)
    const wrong = await signInRequest(api, username, 'not-the-password')
    expect(wrong.status).toBe(401)
    expect(await code(wrong)).toBe('INVALID_USERNAME_OR_PASSWORD')
    expect(cookieHeader(wrong)).not.toContain('splitune.session_token=')
    expect(await code(await signInRequest(api, testUsername()))).toBe(
      'INVALID_USERNAME_OR_PASSWORD',
    )

    expect(await code(await signUpRequest(api, username.toUpperCase()))).toBe(
      'USERNAME_IS_ALREADY_TAKEN',
    )
    expect((await signUpRequest(api, 'no spaces allowed')).status).toBe(400)
    expect((await signUpRequest(api, 'ab')).status).toBe(400)
    expect((await signUpRequest(api, testUsername(), 'short')).status).toBe(400)
    const noUsername = await api.app.request('/v1/auth/sign-up/email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: api.config.appUrl,
        'x-forwarded-for': nextIp(),
      },
      body: JSON.stringify({ email: 'a@example.com', password: TEST_PASSWORD, name: '' }),
    })
    expect(noUsername.status).toBe(400)
  })

  it('signs out', async () => {
    const cookie = await signIn(api)
    const out = await api.app.request('/v1/auth/sign-out', {
      method: 'POST',
      headers: { cookie, origin: api.config.appUrl, 'x-forwarded-for': nextIp() },
    })
    expect(out.status).toBe(200)
    expect((await caller(api, cookie).request('GET', '/v1/me')).status).toBe(401)
  })

  it('answers 401 with the error envelope without a session', async () => {
    const res = await caller(api).request('GET', '/v1/me')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ code: 'unauthenticated', message: 'Please sign in.' })
    const forged = await caller(api, 'splitune.session_token=forged.value').request('GET', '/v1/me')
    expect(forged.status).toBe(401)
  })

  it('limits sign-in attempts per IP (10/min)', async () => {
    const ip = nextIp()
    for (let i = 0; i < 10; i++) {
      expect((await signInRequest(api, testUsername(), TEST_PASSWORD, ip)).status).toBe(401)
    }
    const limited = await signInRequest(api, testUsername(), TEST_PASSWORD, ip)
    expect(limited.status).toBe(429)
    const retryAfter = Number(limited.headers.get('retry-after'))
    expect(retryAfter).toBeGreaterThan(0)
    expect(await limited.json()).toEqual({
      code: 'rate_limited',
      message: expect.any(String),
      retry_after_s: retryAfter,
    })
    // Another address is unaffected.
    expect((await signInRequest(api, testUsername(), TEST_PASSWORD, nextIp())).status).toBe(401)
  })

  it('has Google sign-in only when its credentials are configured', async () => {
    const google = (target: typeof api) =>
      target.app.request('/v1/auth/sign-in/social', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: target.config.appUrl,
          'x-forwarded-for': nextIp(),
        },
        body: JSON.stringify({ provider: 'google', callbackURL: '/' }),
      })
    expect(api.config.google).toBeUndefined()
    expect((await google(api)).status).toBeGreaterThanOrEqual(400)

    const withGoogle = createTestApi({
      GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
    })
    try {
      const res = await google(withGoogle)
      expect(res.status).toBe(200)
      const { url } = (await res.json()) as { url: string }
      expect(new URL(url).hostname).toBe('accounts.google.com')
    } finally {
      await withGoogle.close()
    }
  })
})

describe('requireRecentAuth', () => {
  const session = (ageS: number) => ({
    userId: 'u1',
    sessionId: 's1',
    authenticatedAt: new Date(Date.now() - ageS * 1000),
  })

  it('accepts a recent sign-in', () => {
    expect(() => requireRecentAuth(session(60))).not.toThrow()
  })

  it('asks for a fresh sign-in after the window', () => {
    expect(() => requireRecentAuth(session(11 * 60))).toThrow(
      expect.objectContaining({
        code: 'forbidden',
        status: 403,
        data: { reason: 'reauth_required' },
      }),
    )
    expect(() => requireRecentAuth(session(120), { maxAgeS: 60 })).toThrow()
  })
})
