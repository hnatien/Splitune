import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import {
  AllowanceExhaustedError,
  type AnalysisRequest,
  analyses,
  createRepositories,
  dueSubscriptions,
  stageRuns,
  subscriptions,
  type UsageCharge,
  usageLedger,
} from '../src/index.ts'
import { asRole, createUser, seedUserGraph, testDb } from './helpers.ts'

const db = testDb(12)
const repo = createRepositories(db)

afterAll(() => db.$client.end())

const request = (overrides: Partial<AnalysisRequest> = {}): AnalysisRequest => ({
  pipelineVersion: 'p1',
  configProfile: 'personal',
  requestedInstrument: 'guitar',
  analysisType: 'lite',
  idempotencyKey: randomUUID(),
  ...overrides,
})
const noJobs = () => ({ jobs: [] })

const lite = (cap: number | null): UsageCharge => ({
  kind: 'lite_analysis',
  periodStart: '2026-11-01',
  counts: ['lite_analysis'],
  cap,
})
const welcome: UsageCharge = {
  kind: 'welcome_analysis',
  periodStart: '2026-11-01',
  counts: ['welcome_analysis'],
  lifetime: true,
  cap: 1,
}

async function ledger(userId: string) {
  return db
    .select({ kind: usageLedger.kind, analysisId: usageLedger.analysisId })
    .from(usageLedger)
    .where(eq(usageLedger.userId, userId))
}

async function freshUser() {
  const userId = await createUser(db)
  const { song } = await seedUserGraph(db, userId)
  // seedUserGraph leaves one full_analysis in 2026-10; start these tests from an empty ledger.
  await db.delete(usageLedger).where(eq(usageLedger.userId, userId))
  return { userId, song }
}

describe('allowance reservations', () => {
  it('reserves one unit per new run, never for a repeated request, up to the cap', async () => {
    const { userId, song } = await freshUser()
    const first = request()
    const run = await repo.analyses.create(userId, song.id, first, noJobs, lite(2))
    await repo.analyses.create(userId, song.id, first, noJobs, lite(2))
    expect(await ledger(userId)).toEqual([{ kind: 'lite_analysis', analysisId: run?.analysis.id }])
    await repo.analyses.create(userId, song.id, request(), noJobs, lite(2))
    const over = repo.analyses.create(userId, song.id, request(), noJobs, lite(2))
    await expect(over).rejects.toBeInstanceOf(AllowanceExhaustedError)
    expect(await ledger(userId)).toHaveLength(2)
    // The refused run left nothing behind.
    const runs = await db.select().from(analyses).where(eq(analyses.userId, userId))
    expect(runs).toHaveLength(3) // seedUserGraph's + 2
  })

  it('counts per period, lifetime for the Welcome analysis, and not at all without a cap', async () => {
    const { userId, song } = await freshUser()
    await repo.analyses.create(userId, song.id, request(), noJobs, lite(1))
    await repo.analyses.create(userId, song.id, request(), noJobs, {
      ...lite(1),
      periodStart: '2026-12-01',
    })
    await repo.analyses.create(
      userId,
      song.id,
      request({ analysisType: 'welcome' }),
      noJobs,
      welcome,
    )
    await expect(
      repo.analyses.create(userId, song.id, request({ analysisType: 'welcome' }), noJobs, {
        ...welcome,
        periodStart: '2027-06-01',
      }),
    ).rejects.toBeInstanceOf(AllowanceExhaustedError)
    for (let i = 0; i < 3; i++) {
      await repo.analyses.create(userId, song.id, request(), noJobs, lite(null))
    }
    expect(await ledger(userId)).toHaveLength(6)
  })

  it('never exceeds the cap under parallel requests', async () => {
    const { userId, song } = await freshUser()
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        repo.analyses.create(userId, song.id, request(), noJobs, lite(5)),
      ),
    )
    const refused = results.filter((r) => r.status === 'rejected')
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5)
    expect(refused).toHaveLength(5)
    for (const r of refused) expect(r.reason).toBeInstanceOf(AllowanceExhaustedError)
    expect(await ledger(userId)).toHaveLength(5)
  })

  it('charges the URL import together with its new song', async () => {
    const { userId } = await freshUser()
    const newSong = { title: 'Link', sourceKind: 'url' as const, instrument: 'guitar' as const }
    await repo.analyses.createWithSong(userId, newSong, request(), noJobs, lite(1))
    await expect(
      repo.analyses.createWithSong(userId, newSong, request(), noJobs, lite(1)),
    ).rejects.toBeInstanceOf(AllowanceExhaustedError)
    const songs = await repo.songs.list(userId, {})
    expect(songs.filter((s) => s.title === 'Link')).toHaveLength(1)
  })
})

describe('releasing unearned usage', () => {
  // Ends a run the way the node worker does: stage runs, then the analysis status, as its role.
  async function end(
    analysisId: string,
    status: 'done' | 'partial' | 'failed',
    stages: Record<string, 'done' | 'fallback' | 'failed'>,
  ) {
    await asRole(db, 'node_worker', async (tx) => {
      for (const [stage, stageStatus] of Object.entries(stages)) {
        await tx.insert(stageRuns).values({
          analysisId,
          stage: stage as 'chords',
          status: stageStatus,
          modelRefs: [],
          cacheKey: '',
        })
      }
      await tx.update(analyses).set({ status }).where(eq(analyses.id, analysisId))
    })
  }

  const full: UsageCharge = {
    kind: 'full_analysis',
    periodStart: '2026-11-01',
    counts: ['full_analysis'],
    cap: 15,
  }

  it.each([
    ['a failed Full run is released', 'full', 'failed', {}, 0],
    [
      'a Full run without stems is released',
      'full',
      'partial',
      { stem_post: 'failed', chords: 'done' },
      0,
    ],
    ['a Full run with stems counts', 'full', 'done', { stem_post: 'done', chords: 'done' }, 1],
    ['a Full run with fallback stems counts', 'full', 'partial', { stem_post: 'fallback' }, 1],
    ['a Lite run without chords is released', 'lite', 'partial', { chords: 'failed' }, 0],
    ['a Lite run with chords counts', 'lite', 'done', { chords: 'done' }, 1],
  ] as const)('%s', async (_, type, status, stages, kept) => {
    const { userId, song } = await freshUser()
    const run = await repo.analyses.create(
      userId,
      song.id,
      request({ analysisType: type }),
      noJobs,
      type === 'lite' ? lite(5) : full,
    )
    await end(run?.analysis.id as string, status, stages)
    expect(await ledger(userId)).toHaveLength(kept)
  })
})

describe('billing events', () => {
  const period = {
    plan: 'paid_monthly' as const,
    period_start: '2026-11-01T00:00:00Z',
    period_end: '2026-12-01T00:00:00Z',
    cancel_at_period_end: false,
  }

  it('applies each event id once and follows the subscription lifecycle', async () => {
    const userId = await createUser(db)
    const id = `evt_${randomUUID()}`
    const activated = { id, type: 'subscription.activated' as const, user_id: userId, ...period }
    const first = await repo.billing.applyEvent(userId, 'mock', activated)
    expect(first).toMatchObject({ applied: true, before: undefined })
    expect(first.after).toMatchObject({ status: 'active', plan: 'paid_monthly' })
    expect((await repo.billing.applyEvent(userId, 'mock', activated)).applied).toBe(false)

    const failed = await repo.billing.applyEvent(userId, 'mock', {
      id: `evt_${randomUUID()}`,
      type: 'payment.failed',
      user_id: userId,
      at: '2026-11-10T00:00:00Z',
    })
    expect(failed.after?.status).toBe('past_due')
    // An update (cancel at period end) keeps the status.
    const cancel = await repo.billing.applyEvent(userId, 'mock', {
      id: `evt_${randomUUID()}`,
      type: 'subscription.updated',
      user_id: userId,
      ...period,
      cancel_at_period_end: true,
    })
    expect(cancel.after).toMatchObject({ status: 'past_due', cancelAtPeriodEnd: true })
    const expired = await repo.billing.applyEvent(userId, 'mock', {
      id: `evt_${randomUUID()}`,
      type: 'subscription.expired',
      user_id: userId,
      at: '2026-12-01T00:00:00Z',
    })
    expect(expired.after?.status).toBe('expired')
  })

  it('finds due renewals and yearly reminders, and marks a reminder once', async () => {
    const userId = await createUser(db)
    await repo.billing.applyEvent(userId, 'mock', {
      id: `evt_${randomUUID()}`,
      type: 'subscription.activated',
      user_id: userId,
      ...period,
      plan: 'paid_yearly',
      period_end: '2027-11-01T00:00:00Z',
    })
    const due = async (now: string, remindFrom: string) =>
      (await dueSubscriptions(db, { now: new Date(now), remindFrom: new Date(remindFrom) }))
        .map((s) => s.userId)
        .includes(userId)
    expect(await due('2027-10-01T00:00:00Z', '2027-10-08T00:00:00Z')).toBe(false)
    expect(await due('2027-10-26T00:00:00Z', '2027-11-02T00:00:00Z')).toBe(true)
    const end = new Date('2027-11-01T00:00:00Z')
    expect(await repo.billing.markRenewalReminded(userId, end)).toBe(true)
    expect(await repo.billing.markRenewalReminded(userId, end)).toBe(false)
    expect(await due('2027-10-26T00:00:00Z', '2027-11-02T00:00:00Z')).toBe(false)
    // At the period end it is due again: renew or expire.
    expect(await due('2027-11-01T00:00:00Z', '2027-11-08T00:00:00Z')).toBe(true)
    const [row] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId))
    expect(row?.renewalReminderFor).toEqual(end)
  })

  it('keeps billing events per user', async () => {
    const alice = await createUser(db)
    const bob = await createUser(db)
    const id = `evt_${randomUUID()}`
    await repo.billing.applyEvent(alice, 'mock', {
      id,
      type: 'refund.issued',
      user_id: alice,
      amount_minor: 999,
      currency: 'USD',
    })
    const seen = await asRole(db, 'app', async (tx) => {
      await tx.execute(sql`select set_config('app.user_id', ${bob}, true)`)
      return tx.execute(sql`select id from billing_events where id = ${id}`)
    })
    expect(seen.rows).toEqual([])
  })
})
