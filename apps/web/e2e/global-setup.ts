import { type ChildProcess, execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runMigrations } from '@splitune/db'
import pg from 'pg'
import { APP_URL } from '../playwright.config.ts'

// A throwaway database on the compose Postgres, the built app server on :3000 (the origin the
// local bucket CORS allows) and the Mac workers in ML_MODE=mock, all torn down afterwards.
const WEB = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = join(WEB, '../..')

function loadEnv() {
  for (const file of ['.env', '.env.example']) {
    const path = join(REPO, file)
    if (existsSync(path)) {
      process.loadEnvFile(path)
      return
    }
  }
}

async function waitFor(url: string, child: ChildProcess, timeoutMs = 30_000) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}`)
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`${url} did not come up`)
}

export default async function setup() {
  loadEnv()
  const { DATABASE_URL: adminUrl, DB_ML_WORKER_PASSWORD, DB_NODE_WORKER_PASSWORD } = process.env
  if (!adminUrl) throw new Error('DATABASE_URL is not set')
  const server = join(WEB, '.output/server/index.mjs')
  if (!existsSync(server)) throw new Error('Build the app first: pnpm --filter @splitune/web build')

  const name = `splitune_e2e_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  const admin = new pg.Client({ connectionString: adminUrl })
  await admin.connect()
  await admin.query(`create database ${admin.escapeIdentifier(name)}`)
  const url = new URL(adminUrl)
  url.pathname = `/${name}`
  const databaseUrl = url.toString()
  await runMigrations(databaseUrl)
  execFileSync(process.execPath, [join(REPO, 'packages/db/scripts/roles.ts')], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'ignore',
  })
  const roleUrl = (role: string, password: string | undefined) => {
    const u = new URL(databaseUrl)
    u.username = role
    u.password = password ?? ''
    return u.toString()
  }

  const cacheDir = mkdtempSync(join(tmpdir(), 'splitune-e2e-'))
  const env = { ...process.env, DATABASE_URL: databaseUrl }
  const children: ChildProcess[] = [
    spawn(process.execPath, [server], {
      env: {
        ...env,
        NODE_ENV: 'test',
        PORT: '3000',
        APP_URL,
        BETTER_AUTH_URL: APP_URL,
        LOG_LEVEL: 'warn',
      },
      stdio: ['ignore', 'inherit', 'inherit'],
    }),
    spawn('uv', ['run', '--frozen', 'splitune-ml-worker'], {
      cwd: join(REPO, 'services/ml'),
      env: {
        ...env,
        ML_MODE: 'mock',
        ML_DATABASE_URL: roleUrl('ml_worker', DB_ML_WORKER_PASSWORD),
        ML_WORKER_ID: 'ml-e2e',
        ML_CACHE_DIR: cacheDir,
        ML_POLL_INTERVAL_S: '1',
        LOG_LEVEL: 'warning',
      },
      stdio: ['ignore', 'ignore', 'inherit'],
    }),
    spawn(process.execPath, ['src/main.ts'], {
      cwd: join(REPO, 'apps/node-worker'),
      env: {
        ...env,
        NODE_WORKER_DATABASE_URL: roleUrl('node_worker', DB_NODE_WORKER_PASSWORD),
        NODE_WORKER_ID: 'node-e2e',
        NODE_WORKER_POLL_INTERVAL_S: '1',
      },
      stdio: ['ignore', 'ignore', 'inherit'],
    }),
  ]
  const [web] = children
  if (!web) throw new Error('server did not start')
  await waitFor(`${APP_URL}/internal/ready`, web)

  return async () => {
    await Promise.all(
      children.map(
        (child) =>
          new Promise<void>((resolve) => {
            if (child.exitCode !== null) return resolve()
            child.once('exit', () => resolve())
            child.kill('SIGTERM')
          }),
      ),
    )
    await admin.query(`drop database ${admin.escapeIdentifier(name)} with (force)`)
    await admin.end()
    rmSync(cacheDir, { recursive: true, force: true })
  }
}
