import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loopClips, songs, withUser } from '../src/index.ts'
import {
  asRole,
  createUser,
  INSUFFICIENT_PRIVILEGE,
  pgErrorCode,
  seedUserGraph,
  testDb,
} from './helpers.ts'

// Every table RLS scopes to a user, directly (user_id/id) or through a parent row.
const USER_TABLES = [
  'users',
  'songs',
  'uploads',
  'youtube_refs',
  'sync_points',
  'analyses',
  'stage_runs',
  'artefacts',
  'correction_ops',
  'loop_clips',
  'practice_sessions',
  'practice_attempts',
  'subscriptions',
  'usage_ledger',
  'jobs',
  'job_events',
] as const

const db = testDb(1)
let alice: string
let bob: string
let aliceGraph: Awaited<ReturnType<typeof seedUserGraph>>

const count = async (tx: Parameters<Parameters<typeof db.transaction>[0]>[0], table: string) => {
  const result = await tx.execute(sql.raw(`select count(*)::int as n from ${table}`))
  return (result.rows[0] as { n: number }).n
}

beforeAll(async () => {
  alice = await createUser(db)
  bob = await createUser(db)
  aliceGraph = await seedUserGraph(db, alice)
})

afterAll(() => db.$client.end())

describe('row-level security for role app', () => {
  it('covers every table that has a user_id column or RLS enabled', async () => {
    const result = await db.execute(sql`
      select c.relname as table, c.relrowsecurity as rls,
        exists (select 1 from pg_attribute a
                where a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped) as has_user_id,
        has_table_privilege('app', c.oid, 'SELECT, INSERT, UPDATE, DELETE') as app_access
      from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
    `)
    const rows = result.rows as {
      table: string
      rls: boolean
      has_user_id: boolean
      app_access: boolean
    }[]
    for (const row of rows) {
      // A user-owned table the API can touch must have RLS.
      if (row.has_user_id && row.app_access) expect(row.rls, row.table).toBe(true)
    }
    const withRls = rows.filter((r) => r.rls).map((r) => r.table)
    expect(withRls.sort()).toEqual([...USER_TABLES, 'analytics_events'].sort())
  })

  it.each(USER_TABLES)('hides another user’s rows in %s', async (table) => {
    expect(await withUser(db, alice, (tx) => count(tx, table))).toBeGreaterThan(0)
    // Bob owns only his users row.
    expect(await withUser(db, bob, (tx) => count(tx, table))).toBe(table === 'users' ? 1 : 0)
  })

  it('shows nothing when app.user_id is not set', async () => {
    for (const table of USER_TABLES) {
      expect(await asRole(db, 'app', (tx) => count(tx, table)), table).toBe(0)
    }
  })

  it('keeps analytics_events write-only', async () => {
    const code = await pgErrorCode(
      withUser(db, alice, (tx) => tx.execute(sql`select * from analytics_events`)),
    )
    expect(code).toBe(INSUFFICIENT_PRIVILEGE)
  })

  it('rejects rows written for another user', async () => {
    const code = await pgErrorCode(
      withUser(db, bob, (tx) =>
        tx
          .insert(songs)
          .values({ userId: alice, title: 'x', sourceKind: 'upload', instrument: 'bass' }),
      ),
    )
    expect(code).toBe(INSUFFICIENT_PRIVILEGE)
  })

  it('rejects rows attached to another user’s parent row', async () => {
    const code = await pgErrorCode(
      withUser(db, bob, (tx) =>
        tx.insert(loopClips).values({
          userId: bob,
          songId: aliceGraph.song.id,
          startBar: 0,
          endBar: 1,
          endBeat: 1,
          startS: 0,
          endS: 1,
        }),
      ),
    )
    expect(code).toBe(INSUFFICIENT_PRIVILEGE)
  })

  it('cannot update or delete another user’s rows', async () => {
    const updated = await withUser(db, bob, (tx) =>
      tx.execute(sql`update songs set title = 'stolen' where id = ${aliceGraph.song.id}`),
    )
    const deleted = await withUser(db, bob, (tx) =>
      tx.execute(sql`delete from songs where id = ${aliceGraph.song.id}`),
    )
    expect(updated.rowCount).toBe(0)
    expect(deleted.rowCount).toBe(0)
  })

  it('resets role and user after the transaction (pooled connection reuse)', async () => {
    await withUser(db, alice, (tx) => count(tx, 'songs'))
    const result = await db.execute(
      sql`select current_user as role, coalesce(current_setting('app.user_id', true), '') as uid`,
    )
    const row = result.rows[0] as { role: string; uid: string }
    expect(row.role).not.toBe('app')
    expect(row.uid).toBe('')
  })

  it('rolls back the scope when the callback throws', async () => {
    await expect(
      withUser(db, alice, async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    const result = await db.execute(sql`select current_user as role`)
    expect((result.rows[0] as { role: string }).role).not.toBe('app')
  })

  it('rejects malformed user ids before touching the database', async () => {
    for (const id of ['', 'a b', "x'; drop table songs; --", 'x'.repeat(129)]) {
      await expect(withUser(db, id, async () => 1)).rejects.toThrow('invalid user id')
    }
  })
})

describe('cleanup jobs (jobs_owner_cleanup)', () => {
  const enqueueAs = (userId: string, payload: unknown, kind = 'delete_prefix') =>
    withUser(db, userId, (tx) =>
      tx.execute(sql`insert into jobs (kind, runner, payload)
        values (${kind}, 'node', ${JSON.stringify(payload)}::jsonb) returning id`),
    )

  it('lets app enqueue delete_prefix for its own prefixes and read it back', async () => {
    const result = await enqueueAs(alice, {
      user_id: alice,
      prefixes: [`u/${alice}/raw/x/`, `u/${alice}/a/y/`],
    })
    expect(result.rows).toHaveLength(1)
  })

  it.each([
    ['another user', (a: string, b: string) => ({ user_id: a, prefixes: [`u/${b}/raw/x/`] })],
    [
      'a payload for another user',
      (_: string, b: string) => ({ user_id: b, prefixes: [`u/${b}/`] }),
    ],
    ['a traversal', (a: string) => ({ user_id: a, prefixes: [`u/${a}/../x/`] })],
    ['a prefix without trailing slash', (a: string) => ({ user_id: a, prefixes: [`u/${a}/raw`] })],
    ['no prefixes', (a: string) => ({ user_id: a, prefixes: [] })],
    ['prefixes not an array', (a: string) => ({ user_id: a, prefixes: `u/${a}/` })],
    ['a non-string prefix', (a: string) => ({ user_id: a, prefixes: [1] })],
  ])('refuses %s', async (_, payload) => {
    expect(await pgErrorCode(enqueueAs(alice, payload(alice, bob)))).toBe(INSUFFICIENT_PRIVILEGE)
  })

  it('refuses other job kinds without an analysis', async () => {
    const code = await pgErrorCode(
      enqueueAs(alice, { user_id: alice, prefixes: [`u/${alice}/`] }, 'sweep'),
    )
    expect(code).toBe(INSUFFICIENT_PRIVILEGE)
  })
})

describe('auth and rate-limit tables', () => {
  it.each(['app', 'ml_worker', 'node_worker'] as const)('are closed to %s', async (role) => {
    for (const table of ['auth_sessions', 'auth_accounts', 'auth_verifications', 'rate_limits']) {
      expect(await pgErrorCode(asRole(db, role, (tx) => count(tx, table))), table).toBe(
        INSUFFICIENT_PRIVILEGE,
      )
    }
  })
})

describe('worker and maintenance roles', () => {
  it.each(['ml_worker', 'node_worker'] as const)(
    '%s cannot read users or correction_ops',
    async (role) => {
      for (const table of ['users', 'correction_ops', 'uploads', 'loop_clips', 'subscriptions']) {
        expect(await pgErrorCode(asRole(db, role, (tx) => count(tx, table))), table).toBe(
          INSUFFICIENT_PRIVILEGE,
        )
      }
    },
  )

  it.each(['ml_worker', 'node_worker'] as const)(
    '%s sees status columns, not song titles',
    async (role) => {
      const id = aliceGraph.song.id
      const title = asRole(db, role, (tx) =>
        tx.execute(sql`select title from songs where id = ${id}`),
      )
      expect(await pgErrorCode(title)).toBe(INSUFFICIENT_PRIVILEGE)

      const updated = await asRole(db, role, async (tx) => {
        await tx.execute(sql`update songs set status = 'analysing' where id = ${id}`)
        await tx.execute(
          sql`update analyses set progress = 0.5 where id = ${aliceGraph.analysis.id}`,
        )
        return tx.execute(sql`select status from songs where id = ${id}`)
      })
      expect((updated.rows[0] as { status: string }).status).toBe('analysing')

      const owner = asRole(db, role, (tx) =>
        tx.execute(sql`update analyses set user_id = ${bob} where id = ${aliceGraph.analysis.id}`),
      )
      expect(await pgErrorCode(owner)).toBe(INSUFFICIENT_PRIVILEGE)
    },
  )

  it('ml_worker can write stage runs, artefacts and job events', async () => {
    const analysisId = aliceGraph.analysis.id
    await asRole(db, 'ml_worker', async (tx) => {
      await tx.execute(sql`
        insert into stage_runs (analysis_id, stage, status, model_refs, cache_key)
        values (${analysisId}, 'chords', 'running', '[]', ${'d'.repeat(64)})`)
      await tx.execute(sql`
        insert into artefacts (user_id, analysis_id, kind, version, object_key, bytes, sha256, model_refs)
        values (${alice}, ${analysisId}, 'chords', 1, ${`u/${alice}/a/${analysisId}/v1/chords.json`}, 10, ${'e'.repeat(64)}, '[]')`)
      await tx.execute(sql`
        insert into job_events (analysis_id, user_id, event)
        values (${analysisId}, ${alice}, ${JSON.stringify({ type: 'progress', value: 0.6 })})`)
      await tx.execute(sql`
        insert into worker_heartbeats (worker_id, runner) values ('mac-1', 'python')
        on conflict (worker_id) do update set heartbeat_at = now()`)
    })
    expect(await withUser(db, alice, (tx) => count(tx, 'artefacts'))).toBe(2)
  })

  it('maintenance bypasses RLS and can change every table', async () => {
    const result = await db.execute(sql`
      select c.relname as table
      from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
        and not has_table_privilege('maintenance', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
    `)
    expect(result.rows).toEqual([])
    const all = await asRole(db, 'maintenance', (tx) => count(tx, 'songs'))
    const owner = await db.$count(songs)
    expect(all).toBe(owner)
    expect(all).toBeGreaterThan(0)
  })

  it('maintenance is the only restricted role with BYPASSRLS', async () => {
    const result = await db.execute(sql`
      select rolname, rolbypassrls, rolsuper from pg_roles
      where rolname in ('app', 'ml_worker', 'node_worker', 'maintenance') order by rolname`)
    expect(result.rows).toEqual([
      { rolname: 'app', rolbypassrls: false, rolsuper: false },
      { rolname: 'maintenance', rolbypassrls: true, rolsuper: false },
      { rolname: 'ml_worker', rolbypassrls: false, rolsuper: false },
      { rolname: 'node_worker', rolbypassrls: false, rolsuper: false },
    ])
  })
})
