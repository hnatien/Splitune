import { type ChildProcess, execFile, execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { runMigrations } from '@splitune/db'
import pg from 'pg'
import { APP_URL } from '../playwright.config.ts'
import { wav } from './helpers.ts'

// A throwaway database on the compose Postgres, the Mac workers in ML_MODE=mock, an example song
// built through `pnpm examples:build` (onboarding, 13 §1) and the built app server on :3000 (the
// origin the local bucket CORS allows) serving that example's manifest, all torn down afterwards.
export const E2E_EXAMPLE = { id: 'e2e-riff', title: 'E2E riff' }
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
  // Specs that check what the API stored (billing.spec.ts: queue priority) read it here.
  Object.assign(process.env, { E2E_DATABASE_URL: databaseUrl })
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
  const workers: ChildProcess[] = [
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
  const examplesManifest = join(cacheDir, 'examples.json')
  const exampleAudio = join(cacheDir, 'e2e-riff.wav')
  writeFileSync(exampleAudio, wav(20))
  const built = promisify(execFile)(
    process.execPath,
    [
      join(REPO, 'apps/api/scripts/examples/build.ts'),
      '--out',
      examplesManifest,
      '--id',
      E2E_EXAMPLE.id,
      '--title',
      E2E_EXAMPLE.title,
      '--instrument',
      'guitar',
      '--part',
      'riff',
      exampleAudio,
    ],
    { env, timeout: 120_000 },
  )
  try {
    await built
  } catch (error) {
    for (const worker of workers) worker.kill('SIGTERM')
    throw error
  }
  const web = spawn(process.execPath, [server], {
    env: {
      ...env,
      NODE_ENV: 'test',
      PORT: '3000',
      APP_URL,
      BETTER_AUTH_URL: APP_URL,
      LOG_LEVEL: 'warn',
      EXAMPLES_MANIFEST: examplesManifest,
      // billing.spec.ts moves the billing clock past a period end.
      ENABLE_DEV_CLOCK: 'true',
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  })
  const children = [web, ...workers]
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
