import { getConnInfo } from '@hono/node-server/conninfo'
import { SmartCoercionPlugin } from '@orpc/json-schema'
import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { ORPCError } from '@orpc/server'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { userHasher as analyticsHasher } from '@splitune/analytics/server'
import { inSpan } from '@splitune/analytics/tracing'
import { DevClockInput } from '@splitune/contracts'
import { createRepositories, type Database, hitRateLimit, ping } from '@splitune/db'
import type { Storage } from '@splitune/storage'
import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { type RequestIdVariables, requestId } from 'hono/request-id'
import { AUTH_BASE_PATH, createAuth, resolveSession, type SessionInfo } from './auth.ts'
import { createMockProvider, SIGNATURE_HEADER } from './billing/mock.ts'
import { WebhookRejected } from './billing/provider.ts'
import { createBilling } from './billing/service.ts'
import { createClock } from './clock.ts'
import type { ApiConfig } from './config.ts'
import { apiError, envelopeResponse, toEnvelope } from './errors.ts'
import { EventHub } from './events.ts'
import { createFlags } from './flags.ts'
import { createLogger, type Logger, userHasher } from './logger.ts'
import { createSmtpMailer, type Mailer } from './mailer.ts'
import { generateOpenApi } from './openapi.ts'
import { type ApiDeps, RATE_LIMITS, type RequestContext } from './procedures.ts'
import { router } from './router.ts'
import { HEARTBEAT_MS } from './routes/analyses.ts'

export interface CreateApiOptions {
  db: Database
  storage: Storage
  config: ApiConfig
  // Defaults to SMTP from config.
  mailer?: Mailer
}

type Env = { Variables: RequestIdVariables & { log: Logger; session: SessionInfo | null } }

// Cookie-authenticated mutations must carry this header (17-security.md §5). Browsers cannot add
// it cross-origin without a CORS preflight, which only the configured origins pass.
export const CSRF_HEADER = 'x-splitune-csrf'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
// JSON bodies only: audio goes straight to object storage through presigned URLs.
const MAX_BODY_BYTES = 1024 * 1024
export const WEBHOOK_PATH = '/internal/billing/webhook'
export const DEV_CLOCK_PATH = '/internal/dev/clock'
// How often renewals, expiries and reminders are settled while the app is awake (requests that
// read entitlements settle their own user first).
const SETTLE_INTERVAL_MS = 10 * 60_000

// The API as a Hono app: runs standalone (src/server.ts) or is mounted by the web server under
// the same origin (25-personal-mode.md §1). Routes: /v1/* (oRPC), /v1/auth/* (Better Auth),
// /v1/openapi.json, /internal/health, /internal/ready, the billing webhook and the dev clock.
export function createApi({ db, storage, config, mailer }: CreateApiOptions) {
  const log = createLogger(config.logLevel)
  const hashUser = userHasher(config.authSecret)
  const events = new EventHub(db.$client.options.connectionString ?? '', log)
  const mail = mailer ?? createSmtpMailer(config.smtp)
  const repos = createRepositories(db)
  const analyticsHash = analyticsHasher(config.analyticsSalt)
  const clock = createClock()
  const provider = createMockProvider({
    secret: config.billing.webhookSecret,
    clock,
    priceMinor: config.billing.priceMinor,
    currency: config.billing.currency,
  })
  // The mock provider's events take the real webhook path, through this app.
  const billing = createBilling({
    db,
    repos,
    config,
    mailer: mail,
    clock,
    provider,
    log,
    analyticsHash,
    post: async (body, signature) =>
      app.request(WEBHOOK_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [SIGNATURE_HEADER]: signature },
        body,
      }),
  })
  const flags = createFlags(() => repos.flags.list())
  const deps: ApiDeps = { db, repos, storage, config, events, billing, flags, analyticsHash }
  const auth = createAuth(db, config, mail)

  const handler = new OpenAPIHandler(router, {
    plugins: [new SmartCoercionPlugin({ schemaConverters: [new ZodToJsonSchemaConverter()] })],
    clientInterceptors: [
      async ({ next, context }) => {
        try {
          return await next()
        } catch (error) {
          if (error instanceof ORPCError && error.status < 500) throw error
          // Never echo internals to the client; log enough to debug (no request data).
          const err = error instanceof Error ? error : new Error(String(error))
          context.log.error(
            { err_name: err.name, err_message: err.message, stack: err.stack },
            'procedure failed',
          )
          throw apiError('internal_error')
        }
      },
    ],
    customErrorResponseBodyEncoder: toEnvelope,
    // SSE keep-alive comments (04: 15 s heartbeats; Railway closes streams idle for 5 min).
    eventIteratorKeepAliveInterval: HEARTBEAT_MS,
  })

  let openApi: Promise<unknown> | undefined

  const clientIp = (c: Context<Env>): string => {
    if (config.trustProxy) {
      const hops = c.req.header('x-forwarded-for')?.split(',') ?? []
      const last = hops.at(-1)?.trim()
      if (last) return last
    }
    try {
      return getConnInfo(c).remote.address ?? 'unknown'
    } catch {
      // Mounted in a server that is not @hono/node-server and no trusted proxy header.
      return 'unknown'
    }
  }

  const app = new Hono<Env>()

  app.use(requestId())
  app.use(async (c, next) => {
    const started = performance.now()
    c.set('log', log.child({ request_id: c.get('requestId') }))
    c.set('session', null)
    // One span per request when tracing is on (16 §1): method and path only, never the query.
    await inSpan(
      `${c.req.method} ${c.req.routePath}`,
      {
        'http.request.method': c.req.method,
        'url.path': c.req.path,
        request_id: c.get('requestId'),
      },
      async (span) => {
        await next()
        span.setAttribute('http.response.status_code', c.res.status)
      },
    )
    const session = c.get('session')
    c.get('log').info(
      {
        method: c.req.method,
        path: c.req.path, // never the query string
        status: c.res.status,
        duration_ms: Math.round(performance.now() - started),
        ...(session ? { user_hash: hashUser(session.userId) } : {}),
      },
      'request',
    )
  })
  app.use(async (c, next) => {
    await next()
    c.header('x-content-type-options', 'nosniff')
    c.header('referrer-policy', 'strict-origin-when-cross-origin')
    c.header('cache-control', 'no-store')
    if (config.env === 'production') {
      c.header('strict-transport-security', 'max-age=63072000; includeSubDomains; preload')
    }
  })

  app.get('/internal/health', (c) => c.json({ status: 'ok' }))
  app.get('/internal/ready', async (c) => {
    try {
      await ping(db)
      return c.json({ status: 'ok' })
    } catch (error) {
      c.get('log').error({ err_name: (error as Error).name }, 'readiness check failed')
      return c.json({ status: 'unavailable' }, 503)
    }
  })

  app.use(
    '/internal/*',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: () => envelopeResponse('file_too_large', { message: 'The request is too large.' }),
    }),
  )

  // Provider events (14 §3): verified signature, then applied once per event id. Entitlements
  // change only here, never from client redirects.
  app.post(WEBHOOK_PATH, async (c) => {
    let event: Awaited<ReturnType<typeof provider.verifyWebhook>>
    try {
      event = await provider.verifyWebhook(c.req.raw)
    } catch (error) {
      if (!(error instanceof WebhookRejected)) throw error
      return error.reason === 'signature'
        ? envelopeResponse('unauthenticated', { message: 'Invalid signature.' })
        : envelopeResponse('invalid_input')
    }
    if (!(await repos.users.get(event.user_id))) {
      return envelopeResponse('invalid_input', { details: { reason: 'unknown_user' } })
    }
    const applied = await billing.handle(event)
    return c.json({ received: true, applied })
  })

  // Dev clock (25 §2): only with ENABLE_DEV_CLOCK, for a signed-in caller, like a mutation.
  app.post(DEV_CLOCK_PATH, async (c) => {
    if (!config.devClock) return envelopeResponse('not_found')
    const session = await resolveSession(auth, c.req.raw.headers)
    if (!session) return envelopeResponse('unauthenticated')
    if (!c.req.header(CSRF_HEADER)) {
      return envelopeResponse('forbidden', { details: { reason: 'csrf_header_required' } })
    }
    const parsed = DevClockInput.safeParse(await c.req.json().catch(() => undefined))
    if (!parsed.success) return envelopeResponse('invalid_input')
    const now = clock.advance(parsed.data.advance_days)
    c.get('log').info({ advance_days: parsed.data.advance_days }, 'dev clock advanced')
    await billing.settle()
    return c.json({ now: now.toISOString() })
  })

  if (config.env !== 'test') {
    const settle = setInterval(() => {
      billing.settle().catch((error: Error) => {
        log.error({ err_name: error.name, err_message: error.message }, 'billing settle failed')
      })
    }, SETTLE_INTERVAL_MS)
    settle.unref()
  }

  app.use(
    '/v1/*',
    cors({
      origin: config.corsOrigins,
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowHeaders: ['content-type', CSRF_HEADER, 'idempotency-key', 'last-event-id'],
      exposeHeaders: ['x-request-id', 'retry-after'],
      maxAge: 600,
    }),
  )
  app.use(
    '/v1/*',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: () => envelopeResponse('file_too_large', { message: 'The request is too large.' }),
    }),
  )

  // Better Auth: magic link, Google OAuth, session cookies. Sign-in attempts are limited per IP.
  app.on(['GET', 'POST'], `${AUTH_BASE_PATH}/*`, async (c) => {
    if (c.req.method === 'POST' || c.req.path === `${AUTH_BASE_PATH}/magic-link/verify`) {
      const { limit, windowS } = RATE_LIMITS.auth
      const result = await hitRateLimit(db, `auth:ip:${clientIp(c)}`, limit, windowS)
      if (!result.allowed)
        return envelopeResponse('rate_limited', { retryAfterS: result.retryAfterS })
    }
    return auth.handler(c.req.raw)
  })

  app.get('/v1/openapi.json', async (c) => {
    openApi ??= generateOpenApi(config.appUrl)
    return c.json(await openApi)
  })

  app.all('/v1/*', async (c) => {
    const session = await resolveSession(auth, c.req.raw.headers)
    c.set('session', session)
    if (session && !SAFE_METHODS.has(c.req.method) && !c.req.header(CSRF_HEADER)) {
      return envelopeResponse('forbidden', {
        message: 'Missing CSRF header.',
        details: { reason: 'csrf_header_required' },
      })
    }
    const idempotencyKey = c.req.header('idempotency-key')?.trim()
    const context: RequestContext = {
      deps,
      session,
      log: c.get('log'),
      ip: clientIp(c),
      ...(idempotencyKey ? { idempotencyKey: idempotencyKey.slice(0, 200) } : {}),
    }
    const { matched, response } = await handler.handle(c.req.raw, { context })
    if (!matched) return envelopeResponse('not_found')
    if (response.status === 429) {
      const body = (await response.clone().json()) as { retry_after_s?: number }
      if (body.retry_after_s !== undefined) {
        response.headers.set('retry-after', String(body.retry_after_s))
      }
    }
    return response
  })

  app.notFound(() => envelopeResponse('not_found'))
  app.onError((error, c) => {
    ;(c.get('log') ?? log).error(
      { err_name: error.name, err_message: error.message, stack: error.stack },
      'unhandled error',
    )
    return envelopeResponse('internal_error')
  })

  return app
}

export type Api = ReturnType<typeof createApi>
