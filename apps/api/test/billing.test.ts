import { randomUUID } from 'node:crypto'
import { rawUploadKey } from '@splitune/storage'
import { afterAll, describe, expect, it } from 'vitest'
import { DEV_CLOCK_PATH, WEBHOOK_PATH } from '../src/app.ts'
import { createMockProvider, SIGNATURE_HEADER } from '../src/billing/mock.ts'
import { createClock } from '../src/clock.ts'
import {
  type Caller,
  caller,
  createTestApi,
  MAILPIT_URL,
  sha256Hex,
  signIn,
  type TestApi,
  testEmail,
  userIdOf,
} from './helpers.ts'

// Mock billing end to end over HTTP (14 §2–§4, 25 §2): allowances and admission, checkout and
// portal through the signed webhook, the dev clock, and the billing emails in Mailpit.

const api = createTestApi({ ENABLE_DEV_CLOCK: 'true' })
const sql = (text: string, values: unknown[] = []) => api.db.$client.query(text, values)
afterAll(() => api.close())

const json = async <T = Record<string, unknown>>(res: Response) => (await res.json()) as T

interface Me {
  plan: string
  subscription: {
    plan: string
    status: string
    current_period_end: string | null
    cancel_at_period_end: boolean
  } | null
  usage: {
    welcome_available: boolean
    full: { used: number; cap: number | null; resets_at: string | null }
    lite: { used: number; cap: number | null; resets_at: string | null }
  }
  entitlements: string[]
}

interface User {
  id: string
  email: string
  call: Caller
}

async function newUser(on: TestApi = api): Promise<User> {
  const email = testEmail()
  const cookie = await signIn(on, email)
  return { id: await userIdOf(on, cookie), email, call: caller(on, cookie) }
}

const me = async (user: User) => json<Me>(await user.call.request('GET', '/v1/me'))

async function uploadedSong(user: User, instrument = 'guitar') {
  const res = await user.call.request('POST', '/v1/songs', { instrument, source_kind: 'upload' })
  const { song_id: songId } = await json<{ song_id: string }>(res)
  const uploadId = randomUUID()
  await sql(
    `insert into uploads (id, user_id, song_id, object_key, bytes, mime, file_sha256, status, expires_at)
     values ($1, $2, $3, $4, 10, 'audio/mpeg', $5, 'uploaded', now() + interval '7 days')`,
    [uploadId, user.id, songId, rawUploadKey(user.id, uploadId, 'song.mp3'), sha256Hex(uploadId)],
  )
  return songId
}

const analyse = (user: User, songId: string, type: 'full' | 'lite') =>
  user.call.request('POST', '/v1/analyses', { song_id: songId, instrument: 'guitar', type })

async function analysed(user: User, type: 'full' | 'lite') {
  const res = await analyse(user, await uploadedSong(user), type)
  expect(res.status).toBe(202)
  return (await json<{ analysis_id: string }>(res)).analysis_id
}

async function ledger(userId: string) {
  const { rows } = await sql(
    'select kind, analysis_id from usage_ledger where user_id = $1 order by id',
    [userId],
  )
  return rows as { kind: string; analysis_id: string | null }[]
}

async function checkout(user: User, plan: 'paid_monthly' | 'paid_yearly') {
  const res = await user.call.request('POST', '/v1/billing/checkout', { plan })
  expect(res.status).toBe(200)
  const { url } = await json<{ url: string }>(res)
  return new URL(url, 'http://localhost').searchParams.get('session') as string
}

async function subscribe(user: User, plan: 'paid_monthly' | 'paid_yearly' = 'paid_monthly') {
  const session = await checkout(user, plan)
  const res = await user.call.request('POST', '/v1/billing/mock/checkout', {
    session,
    outcome: 'success',
  })
  expect(await json(res)).toEqual({ outcome: 'success', url: '/settings/billing?checkout=success' })
  return session
}

async function portal(user: User, action: string) {
  const { url } = await json<{ url: string }>(await user.call.request('POST', '/v1/billing/portal'))
  const session = new URL(url, 'http://localhost').searchParams.get('session')
  return user.call.request('POST', '/v1/billing/mock/portal', { session, action })
}

async function advance(on: TestApi, user: User, days: number) {
  const res = await on.app.request(DEV_CLOCK_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-splitune-csrf': '1', ...cookieOf(user) },
    body: JSON.stringify({ advance_days: days }),
  })
  expect(res.status).toBe(200)
  return json<{ now: string }>(res)
}

// The caller's cookie, for raw requests outside /v1.
const cookies = new Map<string, string>()
const cookieOf = (user: User) => ({ cookie: cookies.get(user.id) ?? '' })
async function signedIn(on: TestApi = api): Promise<User> {
  const email = testEmail()
  const cookie = await signIn(on, email)
  const id = await userIdOf(on, cookie)
  cookies.set(id, cookie)
  return { id, email, call: caller(on, cookie) }
}

interface MailpitMessage {
  ID: string
  Subject: string
}

async function mails(to: string, subject: string, timeoutMs = 10_000): Promise<string[]> {
  const deadline = Date.now() + timeoutMs
  const query = encodeURIComponent(`to:"${to}" subject:"${subject}"`)
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`)
    const { messages } = (await res.json()) as { messages: MailpitMessage[] }
    if (messages.length > 0) {
      return Promise.all(
        messages.map(async (m) => {
          const message = await fetch(`${MAILPIT_URL}/api/v1/message/${m.ID}`)
          return ((await message.json()) as { Text: string }).Text
        }),
      )
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return []
}

describe('plans', () => {
  it('lists the mock prices for anyone', async () => {
    const res = await caller(api).request('GET', '/v1/billing/plans')
    expect(await json(res)).toEqual({
      provider: 'mock',
      plans: [
        { plan: 'paid_monthly', interval: 'month', price_minor: 999, currency: 'USD' },
        { plan: 'paid_yearly', interval: 'year', price_minor: 7999, currency: 'USD' },
      ],
      allowances: { welcome: 1, free_lite_per_month: 5, plus_full_per_period: 15 },
    })
  })
})

describe('remote limits', () => {
  it('follow an enabled flag in the plans list, /v1/me and admission', async () => {
    const user = await newUser()
    await sql(
      `insert into feature_flags (key, enabled, value) values ('plan.free.lite_per_month', true, '1')`,
    )
    try {
      const plans = await json<{ allowances: unknown }>(
        await caller(api).request('GET', '/v1/billing/plans'),
      )
      expect(plans.allowances).toMatchObject({ free_lite_per_month: 1 })
      expect((await me(user)).usage.lite.cap).toBe(1)
      await analysed(user, 'lite')
      expect((await analyse(user, await uploadedSong(user), 'lite')).status).toBe(402)
    } finally {
      await sql(`delete from feature_flags where key = 'plan.free.lite_per_month'`)
    }
  })
})

describe('Free allowances and admission', () => {
  it('turns the first full request into the Welcome analysis, once', async () => {
    const user = await newUser()
    expect((await me(user)).usage).toMatchObject({
      welcome_available: true,
      full: { used: 0, cap: 0 },
      lite: { used: 0, cap: 5 },
    })
    const id = await analysed(user, 'full')
    const { rows } = await sql('select analysis_type from analyses where id = $1', [id])
    expect(rows[0]).toEqual({ analysis_type: 'welcome' })
    expect((await me(user)).usage.welcome_available).toBe(false)

    const refused = await analyse(user, await uploadedSong(user), 'full')
    expect(refused.status).toBe(402)
    expect(await json(refused)).toMatchObject({
      code: 'analysis_cap_reached',
      details: { type: 'welcome', resets_at: null, upgrade_available: true },
    })
  })

  it('allows 5 Lite analyses a month and names the reset date', async () => {
    const user = await newUser()
    for (let i = 0; i < 5; i++) await analysed(user, 'lite')
    const after = await me(user)
    expect(after.usage.lite).toMatchObject({ used: 5, cap: 5 })
    const refused = await analyse(user, await uploadedSong(user), 'lite')
    expect(refused.status).toBe(402)
    expect(await json(refused)).toMatchObject({
      details: { type: 'lite', resets_at: after.usage.lite.resets_at, upgrade_available: true },
    })
    // A repeated request for a run that exists is not charged again.
    const [first] = await ledger(user.id)
    const { rows } = await sql('select song_id from analyses where id = $1', [first?.analysis_id])
    expect((await analyse(user, (rows[0] as { song_id: string }).song_id, 'lite')).status).toBe(202)
    expect(await ledger(user.id)).toHaveLength(5)
  })

  it('never exceeds the allowance under parallel requests', async () => {
    const user = await newUser()
    const songs = await Promise.all(Array.from({ length: 10 }, () => uploadedSong(user)))
    const answers = await Promise.all(songs.map((song) => analyse(user, song, 'lite')))
    const statuses = answers.map((r) => r.status).sort()
    expect(statuses).toEqual([...Array(5).fill(202), ...Array(5).fill(402)])
    expect(await ledger(user.id)).toHaveLength(5)
  })

  it('gives the allowance back when the analysis fails or only falls back', async () => {
    const user = await newUser()
    const failed = await analysed(user, 'lite')
    const chordless = await analysed(user, 'lite')
    const fine = await analysed(user, 'lite')
    await sql(`update analyses set status = 'failed' where id = $1`, [failed])
    await sql(
      `insert into stage_runs (analysis_id, stage, status, model_refs, cache_key) values
       ($1, 'chords', 'failed', '[]', ''), ($2, 'chords', 'done', '[]', '')`,
      [chordless, fine],
    )
    await sql(`update analyses set status = 'partial' where id = $1`, [chordless])
    await sql(`update analyses set status = 'done' where id = $1`, [fine])
    expect((await ledger(user.id)).map((r) => r.analysis_id)).toEqual([fine])
    expect((await me(user)).usage.lite.used).toBe(1)
  })

  it('counts a Lite → Full upgrade as the Welcome analysis', async () => {
    const user = await newUser()
    const songId = await uploadedSong(user)
    expect((await analyse(user, songId, 'lite')).status).toBe(202)
    expect((await analyse(user, songId, 'full')).status).toBe(202)
    expect((await ledger(user.id)).map((r) => r.kind)).toEqual([
      'lite_analysis',
      'welcome_analysis',
    ])
  })

  it('charges a requested re-run but not one after a model upgrade', async () => {
    const user = await newUser()
    const id = await analysed(user, 'lite')
    const rerun = await user.call.request('POST', `/v1/analyses/${id}/rerun`)
    expect(rerun.status).toBe(202)
    expect(await ledger(user.id)).toHaveLength(2)

    const upgraded = createTestApi({ PIPELINE_VERSION: `next-${randomUUID()}` })
    try {
      const cookie = cookies.get(user.id)
      const afterUpgrade = caller(upgraded, cookie ?? (await signIn(upgraded, user.email)))
      expect((await afterUpgrade.request('POST', `/v1/analyses/${id}/rerun`)).status).toBe(202)
      expect(await ledger(user.id)).toHaveLength(2)
    } finally {
      await upgraded.close()
    }
  })
})

describe('checkout and Plus', () => {
  it('declines without charging, then upgrades through the webhook', async () => {
    const user = await signedIn()
    const session = await checkout(user, 'paid_monthly')
    expect(
      await json(
        await user.call.request(
          'GET',
          `/v1/billing/mock/session?session=${encodeURIComponent(session)}`,
        ),
      ),
    ).toEqual({
      kind: 'checkout',
      plan: 'paid_monthly',
      return_url: '/settings/billing?checkout=success',
    })

    const declined = await user.call.request('POST', '/v1/billing/mock/checkout', {
      session,
      outcome: 'declined',
    })
    expect(await json(declined)).toEqual({ outcome: 'declined', url: null })
    expect((await me(user)).plan).toBe('free')
    const cancelled = await user.call.request('POST', '/v1/billing/mock/checkout', {
      session,
      outcome: 'cancel',
    })
    expect(await json(cancelled)).toEqual({ outcome: 'cancel', url: '/pricing' })

    // Pressing success twice activates once; a second checkout session can't buy Plus again.
    const other = await checkout(user, 'paid_yearly')
    for (let i = 0; i < 2; i++) {
      const res = await user.call.request('POST', '/v1/billing/mock/checkout', {
        session,
        outcome: 'success',
      })
      expect(res.status).toBe(200)
    }
    const twice = await user.call.request('POST', '/v1/billing/mock/checkout', {
      session: other,
      outcome: 'success',
    })
    expect(twice.status).toBe(409)
    const { rows } = await sql(
      `select type from billing_events where user_id = $1 order by received_at`,
      [user.id],
    )
    expect(rows).toEqual([{ type: 'subscription.activated' }])

    const plus = await me(user)
    expect(plus).toMatchObject({
      plan: 'paid_monthly',
      subscription: { plan: 'paid_monthly', status: 'active', cancel_at_period_end: false },
      usage: { welcome_available: false, full: { used: 0, cap: 15 }, lite: { cap: null } },
    })
    expect(plus.entitlements).toContain('processing.priority')
    expect(plus.usage.full.resets_at).toBe(plus.subscription?.current_period_end)
    const again = await user.call.request('POST', '/v1/billing/checkout', { plan: 'paid_yearly' })
    expect(again.status).toBe(409)

    // Full analyses are allowed and run ahead of Free ones.
    const id = await analysed(user, 'full')
    const jobs = await sql('select distinct priority from jobs where analysis_id = $1', [id])
    expect(jobs.rows).toEqual([{ priority: 50 }])
    const { rows: events } = await sql(
      `select name, props from analytics_events where user_id = $1 and name = 'checkout_completed'`,
      [user.id],
    )
    expect(events).toEqual([{ name: 'checkout_completed', props: { plan: 'paid_monthly' } }])
  })

  it('binds checkout and portal sessions to the user who opened them', async () => {
    const alice = await signedIn()
    const bob = await signedIn()
    const session = await checkout(alice, 'paid_monthly')
    const query = `/v1/billing/mock/session?session=${encodeURIComponent(session)}`
    expect((await bob.call.request('GET', query)).status).toBe(404)
    const stolen = await bob.call.request('POST', '/v1/billing/mock/checkout', {
      session,
      outcome: 'success',
    })
    expect(stolen.status).toBe(404)
    const forged = `${session.split('.')[0]}.${Buffer.from('nope').toString('base64url')}`
    expect(
      (
        await alice.call.request(
          'GET',
          `/v1/billing/mock/session?session=${encodeURIComponent(forged)}`,
        )
      ).status,
    ).toBe(404)
    expect((await me(bob)).plan).toBe('free')
    // No subscription, no portal.
    expect((await bob.call.request('POST', '/v1/billing/portal')).status).toBe(404)
  })

  it('cancels in one tap, keeps Plus to the period end, then returns to Free', async () => {
    const clocked = createTestApi({ ENABLE_DEV_CLOCK: 'true' })
    try {
      const user = await signedIn(clocked)
      await subscribe(user)
      const end = (await me(user)).subscription?.current_period_end
      expect((await portal(user, 'cancel')).status).toBe(200)
      expect((await me(user)).subscription).toMatchObject({
        status: 'active',
        cancel_at_period_end: true,
      })
      const [confirmation] = await mails(user.email, 'Splitune Plus is cancelled')
      expect(confirmation).toContain('Plus stays active until')
      expect(confirmation).toContain('/settings/billing')
      expect((await portal(user, 'cancel')).status).toBe(409)
      expect((await portal(user, 'resume')).status).toBe(200)
      expect((await me(user)).subscription?.cancel_at_period_end).toBe(false)
      expect((await portal(user, 'cancel')).status).toBe(200)

      await advance(clocked, user, 15)
      expect((await me(user)).plan).toBe('paid_monthly')
      const { now } = await advance(clocked, user, 20)
      expect(new Date(now) > new Date(end as string)).toBe(true)
      const after = await me(user)
      expect(after).toMatchObject({
        plan: 'free',
        subscription: { status: 'expired' },
        usage: { full: { cap: 0 }, lite: { cap: 5 } },
      })
      // Plus can't be managed any more, but can be bought again.
      expect((await portal(user, 'resume')).status).toBe(409)
      expect(
        (await user.call.request('POST', '/v1/billing/checkout', { plan: 'paid_monthly' })).status,
      ).toBe(200)
    } finally {
      await clocked.close()
    }
  })

  it('renews monthly and resets the full allowance with the new period', async () => {
    const clocked = createTestApi({ ENABLE_DEV_CLOCK: 'true' })
    try {
      const user = await signedIn(clocked)
      await subscribe(user)
      await analysed(user, 'full')
      const before = await me(user)
      expect(before.usage.full.used).toBe(1)
      await advance(clocked, user, 31)
      const after = await me(user)
      expect(after).toMatchObject({ plan: 'paid_monthly', subscription: { status: 'active' } })
      expect(after.usage.full).toMatchObject({ used: 0, cap: 15 })
      expect(
        new Date(after.subscription?.current_period_end as string) >
          new Date(before.subscription?.current_period_end as string),
      ).toBe(true)
    } finally {
      await clocked.close()
    }
  })

  it('reminds 7 days before a yearly renewal, once, then renews', async () => {
    const clocked = createTestApi({ ENABLE_DEV_CLOCK: 'true' })
    try {
      const user = await signedIn(clocked)
      await subscribe(user, 'paid_yearly')
      await advance(clocked, user, 350)
      expect(await mails(user.email, 'renews on', 500)).toEqual([])
      await advance(clocked, user, 10)
      const reminders = await mails(user.email, 'renews on')
      expect(reminders).toHaveLength(1)
      expect(reminders[0]).toContain('$79.99')
      expect(reminders[0]).toContain('/settings/billing')
      await advance(clocked, user, 1)
      expect(await mails(user.email, 'renews on')).toHaveLength(1)
      await advance(clocked, user, 10)
      expect(await me(user)).toMatchObject({
        plan: 'paid_yearly',
        subscription: { status: 'active' },
      })
    } finally {
      await clocked.close()
    }
  })

  it('switches interval, simulates a failed payment and a refund', async () => {
    const user = await signedIn()
    await subscribe(user)
    expect((await portal(user, 'switch')).status).toBe(200)
    expect((await me(user)).subscription?.plan).toBe('paid_yearly')
    expect((await portal(user, 'payment_failed')).status).toBe(200)
    expect((await me(user)).subscription?.status).toBe('past_due')
    // Past due keeps Plus during the retry window.
    expect((await me(user)).plan).toBe('paid_yearly')
    const [notice] = await mails(user.email, "payment didn't go through")
    expect(notice).toContain('Nothing was charged')
    expect((await portal(user, 'refund')).status).toBe(200)
    const { rows } = await sql(
      `select payload from billing_events where user_id = $1 and type = 'refund.issued'`,
      [user.id],
    )
    expect(rows).toMatchObject([{ payload: { amount_minor: 7999, currency: 'USD' } }])
  })
})

describe('webhook', () => {
  const provider = createMockProvider({
    secret: api.config.billing.webhookSecret,
    clock: createClock(),
    priceMinor: api.config.billing.priceMinor,
    currency: 'USD',
  })
  const post = (body: string, signature: string) =>
    api.app.request(WEBHOOK_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [SIGNATURE_HEADER]: signature },
      body,
    })

  it('applies a signed event once and refuses anything unsigned, stale or unknown', async () => {
    const user = await newUser()
    const event = {
      type: 'payment.failed' as const,
      id: `evt_${randomUUID()}`,
      user_id: user.id,
      at: new Date().toISOString(),
    }
    const { body, signature } = provider.sign(event)
    expect(await json(await post(body, signature))).toEqual({ received: true, applied: true })
    expect(await json(await post(body, signature))).toEqual({ received: true, applied: false })

    expect((await post(body, 't=1,v1=00')).status).toBe(401)
    expect((await post(`${body} `, signature)).status).toBe(401)
    const stale = provider.sign(
      { ...event, id: `evt_${randomUUID()}` },
      new Date(Date.now() - 600_000),
    )
    expect((await post(stale.body, stale.signature)).status).toBe(401)
    const wrongKey = createMockProvider({
      secret: 'another-secret-of-16+',
      clock: createClock(),
      priceMinor: api.config.billing.priceMinor,
      currency: 'USD',
    }).sign({ ...event, id: `evt_${randomUUID()}` })
    expect((await post(wrongKey.body, wrongKey.signature)).status).toBe(401)

    const nonsense = provider.sign({ ...event, type: 'subscription.nonsense' } as never)
    expect((await post(nonsense.body, nonsense.signature)).status).toBe(400)
    const stranger = provider.sign({ ...event, id: `evt_${randomUUID()}`, user_id: 'nobody' })
    expect((await post(stranger.body, stranger.signature)).status).toBe(400)
  })
})

describe('dev clock', () => {
  it('is off unless enabled, and needs a signed-in caller with the CSRF header', async () => {
    const user = await signedIn()
    const body = JSON.stringify({ advance_days: 1 })
    const plain = createTestApi()
    try {
      const off = await plain.app.request(DEV_CLOCK_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-splitune-csrf': '1', ...cookieOf(user) },
        body,
      })
      expect(off.status).toBe(404)
    } finally {
      await plain.close()
    }
    const anonymous = await api.app.request(DEV_CLOCK_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-splitune-csrf': '1' },
      body,
    })
    expect(anonymous.status).toBe(401)
    const noCsrf = await api.app.request(DEV_CLOCK_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...cookieOf(user) },
      body,
    })
    expect(noCsrf.status).toBe(403)
    const bad = await api.app.request(DEV_CLOCK_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-splitune-csrf': '1', ...cookieOf(user) },
      body: JSON.stringify({ advance_days: 0 }),
    })
    expect(bad.status).toBe(400)
  })

  it('resets the Free Lite allowance with the next month', async () => {
    const clocked = createTestApi({ ENABLE_DEV_CLOCK: 'true' })
    try {
      const user = await signedIn(clocked)
      for (let i = 0; i < 5; i++) await analysed(user, 'lite')
      const capped = await me(user)
      expect(capped.usage.lite.used).toBe(5)
      await advance(clocked, user, 32)
      const next = await me(user)
      expect(next.usage.lite).toMatchObject({ used: 0, cap: 5 })
      expect(next.usage.lite.resets_at).not.toBe(capped.usage.lite.resets_at)
      await analysed(user, 'lite')
    } finally {
      await clocked.close()
    }
  })
})
