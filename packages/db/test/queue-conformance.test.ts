import { readFileSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { type JobRunner, jobs, queue } from '../src/index.ts'
import { testDb } from './helpers.ts'

// Runs the shared queue corpus (test/conformance/queue.json) against src/jobs/queue.ts; the Python
// adapter runs the same file in services/ml (test_queue_conformance.py).

type Label = string
type RowExpectation = {
  status?: string
  attempts?: number
  error_code?: string | null
  locked_by?: string | null
  run_after_in_s?: [number, number]
}
type Step =
  | {
      op: 'enqueue'
      as: Label
      kind: string
      runner: JobRunner
      depends_on?: Label[]
      soft_depends_on?: Label[]
      priority?: number
      max_attempts?: number
    }
  | {
      op: 'enqueue_error'
      kind: string
      runner: JobRunner
      depends_on?: Label[]
      soft_depends_on?: Label[]
      unknown_in: 'depends_on' | 'soft_depends_on'
    }
  | { op: 'claim'; runner: JobRunner; worker: string; kinds?: string[]; expect: Label | null }
  | { op: 'heartbeat' | 'complete'; job: Label; worker: string; expect: boolean }
  | {
      op: 'fail'
      job: Label
      worker: string
      code: string
      retry?: boolean
      expect: 'queued' | 'failed' | null
    }
  | {
      op: 'requeue_stale'
      stale_after_s?: number
      expect: { requeued: Label[]; failed: Label[] }
    }
  | { op: 'age'; job: Label; column: 'heartbeat_at' | 'run_after'; seconds_ago: number }
  | { op: 'make_due'; job: Label }
  | { op: 'expect_rows'; rows: Record<Label, RowExpectation> }
type Corpus = {
  constants: { backoff_base_s: number; backoff_max_s: number; stale_after_s: number }
  scenarios: { id: string; description: string; steps: Step[] }[]
}

const corpus = JSON.parse(
  readFileSync(new URL('./conformance/queue.json', import.meta.url), 'utf8'),
) as Corpus
// No job has a negative id: stands in for a dependency that does not exist.
const MISSING_ID = -1
const AGEABLE = new Set(['heartbeat_at', 'run_after'])

const db = testDb()

beforeEach(async () => {
  await db.delete(jobs)
})

afterAll(() => db.$client.end())

async function run(steps: Step[]) {
  const ids = new Map<Label, number>()
  const idOf = (label: Label) => {
    const id = ids.get(label)
    if (id === undefined) throw new Error(`unknown job label ${label}`)
    return id
  }
  const labelOf = (id: number) => [...ids].find(([, v]) => v === id)?.[0] ?? `#${id}`
  const sortedLabels = (list: number[]) => list.map(labelOf).sort()

  for (const step of steps) {
    switch (step.op) {
      case 'enqueue': {
        const job = await queue.enqueue(
          db,
          step.kind,
          step.runner,
          {},
          {
            dependsOn: (step.depends_on ?? []).map(idOf),
            softDependsOn: (step.soft_depends_on ?? []).map(idOf),
            ...(step.priority === undefined ? {} : { priority: step.priority }),
            ...(step.max_attempts === undefined ? {} : { maxAttempts: step.max_attempts }),
          },
        )
        ids.set(step.as, job.id)
        break
      }
      case 'enqueue_error': {
        const dependsOn = (step.depends_on ?? []).map(idOf)
        const softDependsOn = (step.soft_depends_on ?? []).map(idOf)
        ;(step.unknown_in === 'depends_on' ? dependsOn : softDependsOn).push(MISSING_ID)
        await expect(
          queue.enqueue(db, step.kind, step.runner, {}, { dependsOn, softDependsOn }),
        ).rejects.toThrow('unknown dependency')
        break
      }
      case 'claim': {
        const job = await queue.claim(
          db,
          step.runner,
          step.worker,
          step.kinds === undefined ? {} : { kinds: step.kinds },
        )
        expect(job === undefined ? null : labelOf(job.id), JSON.stringify(step)).toBe(step.expect)
        break
      }
      case 'heartbeat':
      case 'complete': {
        const ok = await queue[step.op](db, idOf(step.job), step.worker)
        expect(ok, JSON.stringify(step)).toBe(step.expect)
        break
      }
      case 'fail': {
        const status = await queue.fail(db, idOf(step.job), step.worker, step.code, {
          retry: step.retry ?? true,
        })
        expect(status ?? null, JSON.stringify(step)).toBe(step.expect)
        break
      }
      case 'requeue_stale': {
        const result = await queue.requeueStale(
          db,
          step.stale_after_s === undefined ? {} : { staleAfterSeconds: step.stale_after_s },
        )
        expect(
          { requeued: sortedLabels(result.requeued), failed: sortedLabels(result.failed) },
          JSON.stringify(step),
        ).toEqual({
          requeued: [...step.expect.requeued].sort(),
          failed: [...step.expect.failed].sort(),
        })
        break
      }
      case 'age': {
        if (!AGEABLE.has(step.column)) throw new Error(`cannot age column ${step.column}`)
        await db.execute(sql`
          update jobs set ${sql.identifier(step.column)} = now() - make_interval(secs => ${step.seconds_ago}::float8)
          where id = ${idOf(step.job)}
        `)
        break
      }
      case 'make_due':
        await db.execute(sql`update jobs set run_after = now() where id = ${idOf(step.job)}`)
        break
      case 'expect_rows':
        for (const [label, want] of Object.entries(step.rows)) {
          const result = await db.execute(sql`
            select status, attempts, error_code, locked_by,
                   extract(epoch from run_after - now())::float8 as run_after_in_s
            from jobs where id = ${idOf(label)}
          `)
          const [row] = result.rows as {
            status: string
            attempts: number
            error_code: string | null
            locked_by: string | null
            run_after_in_s: number
          }[]
          expect(row, label).toBeDefined()
          const { run_after_in_s: window, ...columns } = want
          expect(row, label).toMatchObject(columns)
          if (window) {
            expect(row?.run_after_in_s, `${label}.run_after_in_s`).toBeGreaterThanOrEqual(window[0])
            expect(row?.run_after_in_s, `${label}.run_after_in_s`).toBeLessThanOrEqual(window[1])
          }
        }
        break
    }
  }
}

describe('queue conformance corpus', () => {
  it('pins the protocol constants', () => {
    expect({
      backoff_base_s: queue.BACKOFF_BASE_S,
      backoff_max_s: queue.BACKOFF_MAX_S,
      stale_after_s: queue.STALE_AFTER_S,
    }).toEqual(corpus.constants)
  })

  it.each(corpus.scenarios.map((s) => [s.id, s] as const))('%s', async (_id, scenario) => {
    await run(scenario.steps)
  })
})
