import { readFileSync } from 'node:fs'
import type { PaidPlan } from '@splitune/contracts'
import { ExamplesManifest } from '@splitune/contracts/examples-manifest'
import { z } from 'zod'
import bundledExamples from '../examples.json' with { type: 'json' }

// Runtime configuration of the API, read once from the environment (names from .env.example).
export interface ApiConfig {
  env: 'development' | 'test' | 'production'
  // Public origin of the app; Better Auth builds magic links and OAuth callbacks from authUrl.
  appUrl: string
  authUrl: string
  authSecret: string
  // Origins allowed by CORS and Better Auth's origin check (no wildcard).
  corsOrigins: string[]
  google: { clientId: string; clientSecret: string } | undefined
  smtp: {
    host: string
    port: number
    secure: boolean
    user: string | undefined
    password: string | undefined
    from: string
  }
  // Behind Railway's proxy the client address is the last X-Forwarded-For hop.
  trustProxy: boolean
  logLevel: string
  // analyses.pipeline_version (05 "manifest"): part of the analysis idempotency key, so a new
  // pipeline release analyses an already analysed song again.
  pipelineVersion: string
  // Example songs (13 §1): the committed examples.json written by `pnpm examples:build`, or the
  // file EXAMPLES_MANIFEST names (end-to-end tests build their own).
  examples: z.infer<typeof ExamplesManifest>
  // Payments (25 §2): the mock provider is the only one in personal mode. Prices are the
  // provider's (14 §3), here config; the secret signs the provider's webhook events.
  billing: {
    provider: 'mock'
    webhookSecret: string
    currency: string
    priceMinor: Record<z.infer<typeof PaidPlan>, number>
  }
  // POST /internal/dev/clock (04 "Internal"): moves the billing clock. Never in production.
  devClock: boolean
  // Salt of the pseudonymous user hash in analytics_events (16 §6), shared with the node worker.
  analyticsSalt: string
}

const origin = z.url({ protocol: /^https?$/ }).transform((value) => new URL(value).origin)
const optional = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === '' ? undefined : value))
const flag = z.enum(['true', 'false']).transform((value) => value === 'true')

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: origin,
  BETTER_AUTH_URL: origin,
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  CORS_ORIGINS: optional,
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535),
  SMTP_SECURE: flag.default(false),
  SMTP_USER: optional,
  SMTP_PASSWORD: optional,
  EMAIL_FROM: z.string().min(3),
  TRUST_PROXY: flag.default(false),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Railway sets RAILWAY_GIT_COMMIT_SHA on deploys from GitHub.
  PIPELINE_VERSION: optional,
  RAILWAY_GIT_COMMIT_SHA: optional,
  EXAMPLES_MANIFEST: optional,
  BILLING_PROVIDER: z.literal('mock').default('mock'),
  BILLING_WEBHOOK_SECRET: z
    .string()
    .min(16, 'BILLING_WEBHOOK_SECRET must be at least 16 characters'),
  // Starting prices of 23 TL;DR (US$9.99 / US$79.99), in minor units.
  BILLING_CURRENCY: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default('USD'),
  BILLING_PRICE_MONTHLY_MINOR: z.coerce.number().int().positive().default(999),
  BILLING_PRICE_YEARLY_MINOR: z.coerce.number().int().positive().default(7999),
  ENABLE_DEV_CLOCK: flag.default(false),
  ANALYTICS_SALT: z.string().min(16, 'ANALYTICS_SALT must be at least 16 characters'),
})

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = Env.safeParse(env)
  if (!parsed.success) {
    // Names and messages only: values may be secrets.
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(`invalid API configuration: ${problems.join('; ')}`)
  }
  const e = parsed.data
  const corsOrigins = e.CORS_ORIGINS
    ? e.CORS_ORIGINS.split(',').map((value) => origin.parse(value.trim()))
    : [e.APP_URL]
  return {
    env: e.NODE_ENV,
    appUrl: e.APP_URL,
    authUrl: e.BETTER_AUTH_URL,
    authSecret: e.BETTER_AUTH_SECRET,
    corsOrigins,
    // Google sign-in is enabled only when both values are present.
    google:
      e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
        ? { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET }
        : undefined,
    smtp: {
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_SECURE,
      user: e.SMTP_USER,
      password: e.SMTP_PASSWORD,
      from: e.EMAIL_FROM,
    },
    trustProxy: e.TRUST_PROXY,
    logLevel: e.LOG_LEVEL,
    pipelineVersion: e.PIPELINE_VERSION ?? e.RAILWAY_GIT_COMMIT_SHA?.slice(0, 12) ?? 'dev',
    examples: loadExamples(e.EXAMPLES_MANIFEST),
    billing: {
      provider: e.BILLING_PROVIDER,
      webhookSecret: e.BILLING_WEBHOOK_SECRET,
      currency: e.BILLING_CURRENCY,
      priceMinor: {
        paid_monthly: e.BILLING_PRICE_MONTHLY_MINOR,
        paid_yearly: e.BILLING_PRICE_YEARLY_MINOR,
      },
    },
    devClock: e.ENABLE_DEV_CLOCK,
    analyticsSalt: e.ANALYTICS_SALT,
  }
}

function loadExamples(path: string | undefined): z.infer<typeof ExamplesManifest> {
  const raw: unknown = path === undefined ? bundledExamples : JSON.parse(readFileSync(path, 'utf8'))
  const parsed = ExamplesManifest.safeParse(raw)
  if (!parsed.success) {
    throw new Error(
      `invalid examples manifest: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    )
  }
  return parsed.data
}
