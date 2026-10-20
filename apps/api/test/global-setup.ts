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
// .env.example), migrated, dropped afterwards.
export default async function setup(project: TestProject) {
  await import('./env.ts')
  const { DATABASE_URL: adminUrl } = process.env
  if (!adminUrl) throw new Error('DATABASE_URL is not set')

  const name = `splitune_api_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  const admin = new pg.Client({ connectionString: adminUrl })
  await admin.connect()
  await admin.query(`create database ${admin.escapeIdentifier(name)}`)

  const url = new URL(adminUrl)
  url.pathname = `/${name}`
  await runMigrations(url.toString())
  project.provide('databaseUrl', url.toString())

  return async () => {
    await admin.query(`drop database ${admin.escapeIdentifier(name)} with (force)`)
    await admin.end()
  }
}
