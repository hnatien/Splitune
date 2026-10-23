import { execFile } from 'node:child_process'
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { createDb, queue } from '@splitune/db'
import type { LifecycleConfig } from './config.ts'
import { LifecycleError } from './scheduler.ts'

// Nightly pg_dump of the database to a local or external disk on the Mac (25 §7), keeping the
// newest `keep` dumps, in custom format: restore into an empty database with
// `pg_restore --no-owner --dbname=<url> <file>` after `pnpm db:roles` there (grants name the roles).
// The whole database the role can read, extensions and the migration journal included; schemas it
// may not use (e.g. the local listening app's) are skipped and reported. The password goes to
// pg_dump through PGPASSWORD, never on its command line.

const run = promisify(execFile)
const DUMP_NAME = /^splitune-\d{8}T\d{6}Z\.dump$/

const stamp = (now: Date) =>
  `${now.toISOString().replaceAll('-', '').replaceAll(':', '').slice(0, 15)}Z`

/**
 * pg_dump's connection: the URL without its password (that goes in PGPASSWORD), with
 * node-postgres's `sslmode=no-verify` (Railway's self-signed certificate over the TCP proxy)
 * spelt as libpq's equivalent `require`, which pg_dump would otherwise refuse.
 */
export function pgDumpTarget(databaseUrl: string): { dbname: string; password: string } {
  const url = new URL(databaseUrl)
  const password = decodeURIComponent(url.password)
  url.password = ''
  if (url.searchParams.get('sslmode') === 'no-verify') url.searchParams.set('sslmode', 'require')
  return { dbname: url.toString(), password }
}

export async function backupDatabase(
  dump: NonNullable<LifecycleConfig['dump']>,
  now = new Date(),
): Promise<{
  dump_bytes: number
  dumps_kept: number
  dumps_removed: number
  schemas_skipped: string[]
}> {
  await mkdir(dump.dir, { recursive: true, mode: 0o700 })
  const probe = createDb({ url: dump.databaseUrl, max: 1, applicationName: 'splitune-pg-dump' })
  let skipped: string[]
  try {
    skipped = await queue.lifecycle.unreadableSchemas(probe)
  } catch {
    throw new LifecycleError('pg_dump_failed')
  } finally {
    await probe.$client.end()
  }
  const name = `splitune-${stamp(now)}.dump`
  const partial = join(dump.dir, `${name}.partial`)
  const { dbname, password } = pgDumpTarget(dump.databaseUrl)
  try {
    await run(
      dump.bin,
      [
        '--format=custom',
        '--no-owner',
        ...skipped.map((schema) => `--exclude-schema=${schema}`),
        `--file=${partial}`,
        `--dbname=${dbname}`,
      ],
      { env: { ...process.env, PGPASSWORD: password }, maxBuffer: 1024 * 1024 },
    )
  } catch {
    // stderr can carry connection details: the code alone goes to logs and the digest.
    await rm(partial, { force: true })
    throw new LifecycleError('pg_dump_failed')
  }
  await rename(partial, join(dump.dir, name))
  const { size } = await stat(join(dump.dir, name))
  const dumps = (await readdir(dump.dir))
    .filter((file) => DUMP_NAME.test(file))
    .sort()
    .reverse()
  const stale = dumps.slice(dump.keep)
  for (const file of stale) await rm(join(dump.dir, file))
  return {
    dump_bytes: size,
    dumps_kept: dumps.length - stale.length,
    dumps_removed: stale.length,
    schemas_skipped: skipped,
  }
}
