import { randomUUID } from 'node:crypto'
import pg from 'pg'
import type { TestProject } from 'vitest/node'
import { runMigrations } from '../src/migrate.ts'

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string
  }
}

// Creates a fresh database on the compose Postgres (DATABASE_URL from the environment, .env or
// .env.example), migrates it, and drops it afterwards. Roles are cluster-wide and shared.
export default async function setup(project: TestProject) {
  for (const file of ['../../../.env', '../../../.env.example']) {
    try {
      process.loadEnvFile(new URL(file, import.meta.url))
    } catch {
      // Missing file: fall through to the next one.
    }
  }
  const { DATABASE_URL: adminUrl } = process.env
  if (!adminUrl) throw new Error('DATABASE_URL is not set')

  const name = `splitune_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`
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
