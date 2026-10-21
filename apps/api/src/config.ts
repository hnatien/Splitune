import { z } from 'zod'

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
  }
}
