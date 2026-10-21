import { hostname } from 'node:os'

// Names follow the repo's .env.example (Mac worker section).
export interface WorkerConfig {
  databaseUrl: string // the restricted node_worker role
  workerId: string
  viewsPath?: string
  pollIntervalMs: number
  jobHeartbeatMs: number
  workerHeartbeatMs: number
  staleAfterS: number
}

const positive = (value: string | undefined, fallback: number, name: string): number => {
  if (value === undefined || value === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive number`)
  return n
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const {
    NODE_WORKER_DATABASE_URL,
    DATABASE_PUBLIC_URL,
    NODE_WORKER_ID,
    NODE_WORKER_VIEWS_CONFIG,
    NODE_WORKER_POLL_INTERVAL_S,
  } = env
  const databaseUrl = NODE_WORKER_DATABASE_URL || DATABASE_PUBLIC_URL
  if (!databaseUrl) throw new Error('NODE_WORKER_DATABASE_URL (or DATABASE_PUBLIC_URL) is not set')
  return {
    databaseUrl,
    workerId: NODE_WORKER_ID || `node-${hostname().split('.')[0]?.toLowerCase()}`,
    ...(NODE_WORKER_VIEWS_CONFIG ? { viewsPath: NODE_WORKER_VIEWS_CONFIG } : {}),
    pollIntervalMs: positive(NODE_WORKER_POLL_INTERVAL_S, 5, 'NODE_WORKER_POLL_INTERVAL_S') * 1000,
    jobHeartbeatMs: 15_000,
    workerHeartbeatMs: 30_000,
    staleAfterS: 120,
  }
}
