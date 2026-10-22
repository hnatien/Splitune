import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seedSyntheticWeek } from '../scripts/synthetic-week.ts'
import type { Transaction } from '../src/index.ts'
import { INSUFFICIENT_PRIVILEGE, pgErrorCode, testDb } from './helpers.ts'

// A fixed past week, so rows other test files write today never mix in.
const WEEK = '2026-01-05' // Monday
const db = testDb(2)

const asReader = <T>(fn: (tx: Transaction) => Promise<T>) =>
  db.transaction(async (tx) => {
    await tx.execute(sql`set local role dashboard_reader`)
    return fn(tx)
  })

type Row = Map<string, unknown>

async function view(name: string, where = sql`true`): Promise<Row[]> {
  const result = await asReader((tx) =>
    tx.execute(
      sql`select * from ${sql.identifier('dashboards')}.${sql.identifier(name)} where ${where}`,
    ),
  )
  return result.rows.map((row) => new Map(Object.entries(row)))
}

const num = (row: Row | undefined, column: string) => Number(row?.get(column))
const pick = (row: Row | undefined, ...columns: string[]) =>
  Object.fromEntries(columns.map((c) => [c, row?.get(c)]))

const inWeek = (column: string) =>
  sql`${sql.identifier(column)} between ${WEEK}::date and ${WEEK}::date + 6`

beforeAll(async () => {
  await seedSyntheticWeek(db, { start: new Date(`${WEEK}T00:00:00Z`) })
})

afterAll(async () => {
  await db.$client.end()
})

describe('dashboards over a synthetic week', () => {
  it('activation: funnel and time to first slowed loop per day', async () => {
    const days = await view('activation_daily', inWeek('day'))
    expect(days).toHaveLength(7)
    for (const day of days) {
      expect(pick(day, 'onboarding_started', 'first_slowed_loop')).toEqual({
        onboarding_started: '6',
        first_slowed_loop: '4',
      })
      expect(num(day, 'slowed_loop_pct')).toBeCloseTo(66.7, 1)
      expect(num(day, 'first_slowed_loop_p50_s')).toBeGreaterThan(0)
    }
    const funnel = await view('onboarding_funnel', inWeek('week'))
    const views = Object.fromEntries(funnel.map((r) => [r.get('step'), num(r, 'views')]))
    expect(views).toMatchObject({ instrument: 42, loop: 28 })
  })

  it('practice quality: passes per session and clean-pass ratio', async () => {
    const [week] = await view('practice_quality_weekly', inWeek('week'))
    expect(pick(week, 'sessions', 'passes', 'passes_per_session')).toEqual({
      sessions: '42',
      passes: '126',
      passes_per_session: '3.00',
    })
    // Odd learners miss the third pass: 3 of 6 learners × 7 days → 21 of 126 not clean.
    expect(num(week, 'clean_pass_pct')).toBeCloseTo(83.3, 1)
    expect(num(week, 'keyboard_pedal_session_pct')).toBeCloseTo(50, 1)
    expect(num(week, 'median_best_clean_pct')).toBeGreaterThanOrEqual(70)
    const input = await view('practice_input_weekly', inWeek('week'))
    expect(input.map((r) => r.get('input_mode')).sort()).toEqual(['keyboard', 'pedal', 'touch'])
  })

  it('trust: fallback and corrections per model', async () => {
    const rows = await view('trust_by_model', sql`model like 'btc/sevenths@%'`)
    const chords = rows.find((r) => r.get('stage') === 'chords')
    expect(chords).toBeDefined()
    expect(num(chords, 'analyses')).toBeGreaterThanOrEqual(42)
    expect(num(chords, 'fallback_pct')).toBeGreaterThan(0)
    expect(num(chords, 'corrections')).toBeGreaterThanOrEqual(42)
    expect(num(chords, 'reports')).toBeGreaterThanOrEqual(21)
    const views = await view('view_fallback_weekly', inWeek('week'))
    expect(views.map((r) => r.get('instrument')).sort()).toEqual(['bass', 'guitar'])
  })

  it('pipeline: stage latency, time to beat grid and compute per analysis', async () => {
    const stages = await view('stage_latency_daily', inWeek('day'))
    const separate = stages.filter((r) => r.get('stage') === 'separate')
    expect(separate).toHaveLength(7)
    expect(num(separate[0], 'p50_s')).toBeGreaterThanOrEqual(120)
    const latency = await view('analysis_latency_daily', inWeek('day'))
    expect(latency).toHaveLength(7)
    expect(num(latency[0], 'wall_p50_s')).toBeGreaterThanOrEqual(150)
    expect(num(latency[0], 'beat_grid_p50_s')).toBeGreaterThan(18)
    expect(num(latency[0], 'gpu_mean_s')).toBeGreaterThanOrEqual(120)
  })

  it('import funnel: file and link success', async () => {
    const days = await view('import_funnel_daily', inWeek('day'))
    expect(days).toHaveLength(7)
    for (const day of days) {
      expect(pick(day, 'file_started', 'file_completed', 'file_failed')).toEqual({
        file_started: '6',
        file_completed: '5',
        file_failed: '1',
      })
    }
    const linkDays = days.filter((d) => num(d, 'link_started') > 0)
    expect(linkDays.length).toBeGreaterThan(0)
    expect(num(linkDays[0], 'link_success_pct')).toBeCloseTo(83.3, 1)
  })

  it('platform health, conversion and display choices', async () => {
    const health = await view('platform_health_weekly', inWeek('week'))
    const webkit = health.find((r) => r.get('browser') === 'webkit')
    expect(pick(webkit, 'probes', 'underruns')).toEqual({ probes: '21', underruns: '7' })
    const [money] = await view('conversion_weekly', inWeek('week'))
    expect(pick(money, 'paywall_viewed', 'upgrade_clicked', 'checkout_completed')).toEqual({
      paywall_viewed: '7',
      upgrade_clicked: '7',
      checkout_completed: '1',
    })
    const choices = await view('display_choices', sql`setting = 'appearance'`)
    expect(choices.map((r) => r.get('choice'))).toEqual(expect.arrayContaining(['dark', 'stage']))
  })

  it('lets dashboard_reader read the views and nothing else', async () => {
    expect(
      await pgErrorCode(asReader((tx) => tx.execute(sql`select 1 from analytics_events`))),
    ).toBe(INSUFFICIENT_PRIVILEGE)
    expect(await pgErrorCode(asReader((tx) => tx.execute(sql`select 1 from users`)))).toBe(
      INSUFFICIENT_PRIVILEGE,
    )
  })

  it('exposes no titles, emails, keys or user ids', async () => {
    const columns = await db.execute<{ column_name: string }>(sql`
      select column_name from information_schema.columns where table_schema = 'dashboards'`)
    for (const { column_name } of columns.rows) {
      expect(column_name).not.toMatch(/title|email|object_key|user_id|user_hash|url/)
    }
  })
})
