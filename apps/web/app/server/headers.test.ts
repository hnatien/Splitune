import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy, securityHeaders, storageSources } from './headers.ts'

const directive = (csp: string, name: string) =>
  csp
    .split('; ')
    .find((d) => d.startsWith(`${name} `))
    ?.split(' ')
    .slice(1) ?? []

describe('security headers (17 §5)', () => {
  it('allows the local SeaweedFS origin in development and R2 subdomains in production', () => {
    expect(
      storageSources({ S3_ENDPOINT: 'http://localhost:8333', S3_FORCE_PATH_STYLE: 'true' }),
    ).toEqual(['http://localhost:8333'])
    expect(
      storageSources({
        S3_ENDPOINT: 'https://0123abcd.r2.cloudflarestorage.com',
        S3_FORCE_PATH_STYLE: 'false',
      }),
    ).toEqual(['https://*.r2.cloudflarestorage.com'])
    expect(storageSources({})).toEqual([])
  })

  it('puts storage in connect-src and media-src, YouTube in frame-src, and a nonce on scripts', () => {
    const csp = contentSecurityPolicy({
      nonce: 'abc',
      storage: ['https://*.r2.cloudflarestorage.com'],
      dev: false,
    })
    expect(directive(csp, 'connect-src')).toEqual(["'self'", 'https://*.r2.cloudflarestorage.com'])
    expect(directive(csp, 'media-src')).toEqual([
      "'self'",
      'blob:',
      'https://*.r2.cloudflarestorage.com',
    ])
    expect(directive(csp, 'frame-src')).toEqual([
      'https://www.youtube-nocookie.com',
      'https://www.youtube.com',
    ])
    expect(directive(csp, 'script-src')).toEqual(["'self'", "'nonce-abc'", "'wasm-unsafe-eval'"])
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"])
    expect(directive(csp, 'object-src')).toEqual(["'none'"])
  })

  it('never isolates the page (no COOP/COEP) and adds HSTS only in production', () => {
    const local = securityHeaders({ nonce: 'n', storage: [], dev: false, production: false })
    const live = securityHeaders({ nonce: 'n', storage: [], dev: false, production: true })
    for (const headers of [local, live]) {
      expect(headers).not.toHaveProperty('cross-origin-opener-policy')
      expect(headers).not.toHaveProperty('cross-origin-embedder-policy')
      expect(headers['x-content-type-options']).toBe('nosniff')
    }
    expect(local).not.toHaveProperty('strict-transport-security')
    expect(live['strict-transport-security']).toContain('max-age=63072000')
  })

  it('reports violations to the API, and sends the policy report-only when asked', () => {
    const csp = contentSecurityPolicy({ nonce: 'n', storage: [], dev: false })
    expect(directive(csp, 'report-uri')).toEqual(['/internal/csp-report'])
    const enforced = securityHeaders({ nonce: 'n', storage: [], dev: false, production: true })
    expect(enforced['content-security-policy']).toContain("default-src 'self'")
    expect(enforced).not.toHaveProperty('content-security-policy-report-only')
    const trial = securityHeaders({
      nonce: 'n',
      storage: [],
      dev: false,
      production: true,
      reportOnly: true,
    })
    expect(trial).not.toHaveProperty('content-security-policy')
    expect(trial['content-security-policy-report-only']).toBe(enforced['content-security-policy'])
  })
})
