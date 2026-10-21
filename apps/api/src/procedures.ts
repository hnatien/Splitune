import { implement, os } from '@orpc/server'
import { contract } from '@splitune/contracts'
import { type Database, hitRateLimit, type Repositories } from '@splitune/db'
import type { Storage } from '@splitune/storage'
import type { SessionInfo } from './auth.ts'
import type { ApiConfig } from './config.ts'
import { apiError } from './errors.ts'
import type { EventHub } from './events.ts'
import type { Logger } from './logger.ts'

export interface ApiDeps {
  db: Database
  repos: Repositories
  storage: Storage
  config: ApiConfig
  events: EventHub
}

// Per-request context the Hono layer hands to oRPC.
export interface RequestContext {
  deps: ApiDeps
  session: SessionInfo | null
  log: Logger
  // Idempotency-Key header (04 "Conventions"), for procedures that are not idempotent by body.
  idempotencyKey?: string
}

// The procedures implemented so far (04-api-contract.md); corrections, loops, practice, billing
// and the YouTube reference join in later steps. Only these are routed and documented.
export const v1Contract = {
  me: { get: contract.me.get, update: contract.me.update },
  songs: {
    create: contract.songs.create,
    list: contract.songs.list,
    get: contract.songs.get,
    update: contract.songs.update,
    delete: contract.songs.delete,
    importUrl: contract.songs.importUrl,
  },
  uploads: contract.uploads,
  analyses: contract.analyses,
  artefacts: { url: contract.artefacts.url },
  system: contract.system,
}

// Every v1 procedure needs a session; handlers get `userId` and resolve resources through it.
export const pub = implement(v1Contract).$context<RequestContext>()

export const authed = pub.use(({ context, next }) => {
  if (!context.session) throw apiError('unauthenticated')
  return next({ context: { userId: context.session.userId } })
})

// Per-user and per-IP limits (04 "Conventions", 17-security.md §5), counted in Postgres so they
// hold across instances and survive Railway's serverless sleep.
export const RATE_LIMITS = {
  // per IP, POST /v1/auth/* and magic-link verification
  auth: { limit: 10, windowS: 60 },
  // per user, POST /v1/uploads
  uploads: { limit: 20, windowS: 3600 },
  // per user, POST /v1/analyses, /v1/analyses/{id}/rerun and /v1/songs/import-url
  analyses: { limit: 30, windowS: 3600 },
} as const

export function userRateLimit(policy: keyof typeof RATE_LIMITS) {
  const { limit, windowS } = RATE_LIMITS[policy]
  return os.$context<{ deps: ApiDeps; userId: string }>().middleware(async ({ context, next }) => {
    const result = await hitRateLimit(
      context.deps.db,
      `${policy}:user:${context.userId}`,
      limit,
      windowS,
    )
    if (!result.allowed) {
      throw apiError('rate_limited', { details: { retry_after_s: result.retryAfterS } })
    }
    return next()
  })
}
