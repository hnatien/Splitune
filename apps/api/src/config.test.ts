import { describe, expect, it } from 'vitest'
import { configFromEnv } from './config.ts'

const base = {
  APP_URL: 'http://localhost:3000/',
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  EMAIL_FROM: 'Splitune <no-reply@splitune.localhost>',
}

describe('configFromEnv', () => {
  it('defaults CORS to the app origin and disables Google without credentials', () => {
    const config = configFromEnv(base)
    expect(config.corsOrigins).toEqual(['http://localhost:3000'])
    expect(config.google).toBeUndefined()
    expect(
      configFromEnv({ ...base, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: '' }).google,
    ).toBe(undefined)
    expect(
      configFromEnv({ ...base, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's' }).google,
    ).toEqual({ clientId: 'id', clientSecret: 's' })
  })

  it('parses origin lists and flags', () => {
    const config = configFromEnv({
      ...base,
      CORS_ORIGINS: 'https://splitune.up.railway.app, http://localhost:3000',
      TRUST_PROXY: 'true',
      SMTP_SECURE: 'true',
    })
    expect(config.corsOrigins).toEqual(['https://splitune.up.railway.app', 'http://localhost:3000'])
    expect(config.trustProxy).toBe(true)
    expect(config.smtp.secure).toBe(true)
  })

  it('names bad settings without echoing their values', () => {
    expect(() => configFromEnv({ ...base, BETTER_AUTH_SECRET: 'short-secret' })).toThrow(
      /BETTER_AUTH_SECRET/,
    )
    expect(() => configFromEnv({ ...base, BETTER_AUTH_SECRET: 'short-secret' })).not.toThrow(
      /short-secret/,
    )
    expect(() => configFromEnv({ ...base, CORS_ORIGINS: '*' })).toThrow()
  })
})
