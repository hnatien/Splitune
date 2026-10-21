import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { runMigrations } from '@splitune/db'
import pg from 'pg'
import type { TestProject } from 'vitest/node'

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string
  }
}

// Fresh database on the compose Postgres (DATABASE_URL from the environment, .env or
// .env.example), migrated with role logins enabled, dropped afterwards.
export default async function setup(project: TestProject) {
  await import('./env.ts')
  const { DATABASE_URL: adminUrl } = process.env
  if (!adminUrl) throw new Error('DATABASE_URL is not set')

  const name = `splitune_node_worker_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  const admin = new pg.Client({ connectionString: adminUrl })
  await admin.connect()
  await admin.query(`create database ${admin.escapeIdentifier(name)}`)

  const url = new URL(adminUrl)
  url.pathname = `/${name}`
  await runMigrations(url.toString())
  // The worker logs in as node_worker: give the restricted roles their passwords (pnpm db:roles).
  execFileSync(process.execPath, ['../../packages/db/scripts/roles.ts'], {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'ignore',
  })
  project.provide('databaseUrl', url.toString())

  return async () => {
    await admin.query(`drop database ${admin.escapeIdentifier(name)} with (force)`)
    await admin.end()
  }
}
