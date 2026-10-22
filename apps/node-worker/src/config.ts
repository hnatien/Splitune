import { homedir, hostname } from 'node:os'
import { join } from 'node:path'

// Names follow the repo's .env.example (Mac worker section).
export interface WorkerConfig {
  databaseUrl: string // the restricted node_worker role
  workerId: string
  viewsPath?: string
  pollIntervalMs: number
  jobHeartbeatMs: number
  workerHeartbeatMs: number
  staleAfterS: number
  // Salt of the pseudonymous user hash in analytics_events (16 §6); without it the worker records
  // no analysis events.
  analyticsSalt?: string
  // Scheduled lifecycle jobs and privacy requests (15 §3–§4); off without a maintenance login.
  lifecycle?: LifecycleConfig
}

export interface TimeOfDay {
  hour: number
  minute: number
}

export interface LifecycleConfig {
  maintenanceUrl: string // role maintenance (BYPASSRLS)
  stemsInactiveDays: number
  expireRawUploads: boolean
  nightlyAt: TimeOfDay // local time of the Mac
  exportTtlS: number
  dump?: { dir: string; keep: number; databaseUrl: string; bin: string }
  digest?: {
    to: string
    at: TimeOfDay
    from: string
    smtp: { host: string; port: number; secure: boolean; user?: string; password?: string }
    cacheDir: string
  }
}

const positive = (value: string | undefined, fallback: number, name: string): number => {
  if (value === undefined || value === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive number`)
  return n
}

const timeOfDay = (value: string | undefined, fallback: string, name: string): TimeOfDay => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || fallback)
  if (!match) throw new Error(`${name} must be HH:MM (24 h, local time)`)
  return { hour: Number(match[1]), minute: Number(match[2]) }
}

const flag = (value: string | undefined, name: string): boolean => {
  if (value === undefined || value === '' || value === 'false') return false
  if (value === 'true') return true
  throw new Error(`${name} must be true or false`)
}

const expandHome = (path: string) => (path.startsWith('~/') ? join(homedir(), path.slice(2)) : path)

export const MIN_ANALYTICS_SALT = 16
const DAY_S = 86_400

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const {
    NODE_WORKER_DATABASE_URL,
    DATABASE_PUBLIC_URL,
    NODE_WORKER_ID,
    NODE_WORKER_VIEWS_CONFIG,
    NODE_WORKER_POLL_INTERVAL_S,
    ANALYTICS_SALT,
    NODE_WORKER_MAINTENANCE_DATABASE_URL,
  } = env
  const databaseUrl = NODE_WORKER_DATABASE_URL || DATABASE_PUBLIC_URL
  if (!databaseUrl) throw new Error('NODE_WORKER_DATABASE_URL (or DATABASE_PUBLIC_URL) is not set')
  if (ANALYTICS_SALT && ANALYTICS_SALT.length < MIN_ANALYTICS_SALT) {
    throw new Error(`ANALYTICS_SALT must be at least ${MIN_ANALYTICS_SALT} characters`)
  }
  // Account deletion removes the user's events by their hash, so it needs the salt.
  if (NODE_WORKER_MAINTENANCE_DATABASE_URL && !ANALYTICS_SALT) {
    throw new Error('ANALYTICS_SALT is required with NODE_WORKER_MAINTENANCE_DATABASE_URL')
  }
  return {
    databaseUrl,
    workerId: NODE_WORKER_ID || `node-${hostname().split('.')[0]?.toLowerCase()}`,
    ...(NODE_WORKER_VIEWS_CONFIG ? { viewsPath: NODE_WORKER_VIEWS_CONFIG } : {}),
    pollIntervalMs: positive(NODE_WORKER_POLL_INTERVAL_S, 5, 'NODE_WORKER_POLL_INTERVAL_S') * 1000,
    jobHeartbeatMs: 15_000,
    workerHeartbeatMs: 30_000,
    staleAfterS: 120,
    ...(ANALYTICS_SALT ? { analyticsSalt: ANALYTICS_SALT } : {}),
    ...(NODE_WORKER_MAINTENANCE_DATABASE_URL
      ? { lifecycle: lifecycleFromEnv(env, NODE_WORKER_MAINTENANCE_DATABASE_URL) }
      : {}),
  }
}

function lifecycleFromEnv(env: NodeJS.ProcessEnv, maintenanceUrl: string): LifecycleConfig {
  const {
    LIFECYCLE_STEMS_INACTIVE_DAYS,
    LIFECYCLE_EXPIRE_RAW_UPLOADS,
    LIFECYCLE_NIGHTLY_AT,
    PG_DUMP_DIR,
    PG_DUMP_KEEP,
    PG_DUMP_DATABASE_URL,
    PG_DUMP_BIN,
    DIGEST_EMAIL_TO,
    DIGEST_AT,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASSWORD,
    EMAIL_FROM,
    ML_CACHE_DIR,
  } = env
  const config: LifecycleConfig = {
    maintenanceUrl,
    stemsInactiveDays: positive(
      LIFECYCLE_STEMS_INACTIVE_DAYS,
      180,
      'LIFECYCLE_STEMS_INACTIVE_DAYS',
    ),
    expireRawUploads: flag(LIFECYCLE_EXPIRE_RAW_UPLOADS, 'LIFECYCLE_EXPIRE_RAW_UPLOADS'),
    nightlyAt: timeOfDay(LIFECYCLE_NIGHTLY_AT, '03:30', 'LIFECYCLE_NIGHTLY_AT'),
    exportTtlS: DAY_S,
  }
  if (PG_DUMP_DIR) {
    config.dump = {
      dir: expandHome(PG_DUMP_DIR),
      keep: positive(PG_DUMP_KEEP, 14, 'PG_DUMP_KEEP'),
      databaseUrl: PG_DUMP_DATABASE_URL || maintenanceUrl,
      bin: PG_DUMP_BIN || 'pg_dump',
    }
  }
  if (DIGEST_EMAIL_TO) {
    if (!SMTP_HOST || !EMAIL_FROM) throw new Error('DIGEST_EMAIL_TO needs SMTP_HOST and EMAIL_FROM')
    config.digest = {
      to: DIGEST_EMAIL_TO,
      at: timeOfDay(DIGEST_AT, '08:00', 'DIGEST_AT'),
      from: EMAIL_FROM,
      smtp: {
        host: SMTP_HOST,
        port: positive(SMTP_PORT, 587, 'SMTP_PORT'),
        secure: flag(SMTP_SECURE, 'SMTP_SECURE'),
        ...(SMTP_USER ? { user: SMTP_USER } : {}),
        ...(SMTP_PASSWORD ? { password: SMTP_PASSWORD } : {}),
      },
      cacheDir: expandHome(ML_CACHE_DIR || '~/.cache/splitune/ml'),
    }
  }
  return config
}
