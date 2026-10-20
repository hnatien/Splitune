import { afterAll, describe, expect, it } from 'vitest'
import { requireRecentAuth } from '../src/auth.ts'
import {
  caller,
  cookieHeader,
  createTestApi,
  magicLinkFrom,
  nextIp,
  requestMagicLink,
  signIn,
  testEmail,
  waitForMail,
} from './helpers.ts'

const api = createTestApi()
afterAll(() => api.close())

describe('magic-link sign-in (Mailpit, end to end)', () => {
  it('emails a link that creates a session cookie usable on /v1/me', async () => {
    const email = testEmail()
    const ip = nextIp()
    expect((await requestMagicLink(api, email, ip)).status).toBe(200)

    const text = await waitForMail(email)
    const link = magicLinkFrom(text)
    expect(link.origin).toBe(api.config.authUrl)
    expect(text).toContain('expires in 5 minutes')

    const verified = await api.app.request(`${link.pathname}${link.search}`, {
      headers: { 'x-forwarded-for': ip },
    })
    expect(verified.status).toBe(302)
    const [sessionCookie] = verified.headers
      .getSetCookie()
      .filter((c) => c.startsWith('splitune.session_token='))
    expect(sessionCookie).toMatch(/HttpOnly/i)
    expect(sessionCookie).toMatch(/SameSite=Lax/i)
    expect(sessionCookie).not.toMatch(/Secure/i) // HTTP locally; Secure in production
    const cookie = cookieHeader(verified)

    const session = await api.app.request('/v1/auth/get-session', { headers: { cookie } })
    expect(((await session.json()) as { user: { email: string } }).user.email).toBe(email)

    const me = await caller(api, cookie).request('GET', '/v1/me')
    expect(me.status).toBe(200)
    expect(await me.json()).toMatchObject({
      email,
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

    // Single use: a second click is refused and sets no session.
    const reused = await api.app.request(`${link.pathname}${link.search}`, {
      headers: { 'x-forwarded-for': ip },
    })
    expect(reused.status).toBe(302)
    expect(reused.headers.get('location')).toContain('error=')
    expect(cookieHeader(reused)).not.toContain('splitune.session_token=')
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
      expect((await requestMagicLink(api, testEmail(), ip)).status).toBe(200)
    }
    const limited = await requestMagicLink(api, testEmail(), ip)
    expect(limited.status).toBe(429)
    const retryAfter = Number(limited.headers.get('retry-after'))
    expect(retryAfter).toBeGreaterThan(0)
    expect(await limited.json()).toEqual({
      code: 'rate_limited',
      message: expect.any(String),
      retry_after_s: retryAfter,
    })
    // Another address is unaffected.
    expect((await requestMagicLink(api, testEmail(), nextIp())).status).toBe(200)
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
