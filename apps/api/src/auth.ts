import { authAccounts, authSessions, authVerifications, type Database, users } from '@splitune/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins/magic-link'
import type { ApiConfig } from './config.ts'
import { apiError } from './errors.ts'
import type { Mailer } from './mailer.ts'

// The only module that knows Better Auth (14-auth-billing-and-entitlements.md §1: keep the auth
// layer contained so a switch to a hosted provider stays local).

export const AUTH_BASE_PATH = '/v1/auth'
export const MAGIC_LINK_TTL_S = 5 * 60
const SESSION_TTL_S = 30 * 24 * 3600 // rolling: refreshed at most once a day while in use

export function createAuth(db: Database, config: ApiConfig, mailer: Mailer) {
  return betterAuth({
    appName: 'Splitune',
    baseURL: config.authUrl,
    basePath: AUTH_BASE_PATH,
    secret: config.authSecret,
    trustedOrigins: config.corsOrigins,
    // Runs as the table owner (no withUser): Better Auth reads and writes users and its own tables.
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { users, authSessions, authAccounts, authVerifications },
    }),
    // deleted_at: an account whose deletion is under way signs in to nothing (resolveSession).
    user: {
      modelName: 'users',
      additionalFields: { deletedAt: { type: 'date', required: false, input: false } },
    },
    session: { modelName: 'authSessions', expiresIn: SESSION_TTL_S, updateAge: 24 * 3600 },
    account: {
      modelName: 'authAccounts',
      // A verified Google email signs into the existing magic-link account with that email.
      accountLinking: { enabled: true, trustedProviders: ['google'] },
    },
    verification: { modelName: 'authVerifications' },
    emailAndPassword: { enabled: false },
    socialProviders: config.google
      ? { google: { clientId: config.google.clientId, clientSecret: config.google.clientSecret } }
      : {},
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_TTL_S,
        storeToken: 'hashed',
        sendMagicLink: async ({ email, url }) => {
          await mailer.send({
            to: email,
            subject: 'Your Splitune sign-in link',
            text: `Sign in to Splitune:\n\n${url}\n\nThe link works once and expires in 5 minutes. If you did not ask for it, ignore this email.`,
          })
        },
      }),
    ],
    // The API's Postgres-backed limiter covers /v1/auth/* (rateLimit.ts); one limiter, one place.
    rateLimit: { enabled: false },
    telemetry: { enabled: false },
    advanced: {
      cookiePrefix: 'splitune',
      useSecureCookies: config.env === 'production',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>

export interface SessionInfo {
  userId: string
  sessionId: string
  // When the user last proved who they are (sign-in creates a new session).
  authenticatedAt: Date
}

export async function resolveSession(auth: Auth, headers: Headers): Promise<SessionInfo | null> {
  const result = await auth.api.getSession({ headers })
  if (!result || result.user.deletedAt) return null
  return {
    userId: result.user.id,
    sessionId: result.session.id,
    authenticatedAt: new Date(result.session.createdAt),
  }
}

export const REAUTH_MAX_AGE_S = 10 * 60

// Destructive account actions (account deletion, email change; 14 §1) require a sign-in within
// the last `maxAgeS` seconds. The client reacts to details.reason = 'reauth_required' by sending a
// fresh magic link.
export function requireRecentAuth(
  session: SessionInfo,
  { maxAgeS = REAUTH_MAX_AGE_S, now = new Date() }: { maxAgeS?: number; now?: Date } = {},
): void {
  if (now.getTime() - session.authenticatedAt.getTime() > maxAgeS * 1000) {
    throw apiError('forbidden', {
      message: 'Please sign in again to continue.',
      details: { reason: 'reauth_required' },
    })
  }
}
