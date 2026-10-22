import { describe, expect, it } from 'vitest'
import { parseCspReports } from './csp-report.ts'

describe('CSP violation reports (17 §5)', () => {
  it('reads report-uri reports and drops query strings', () => {
    expect(
      parseCspReports({
        'csp-report': {
          'document-uri': 'https://app.splitune.test/songs/1/practice?loop=5-6&t=secret',
          'violated-directive': 'img-src',
          'effective-directive': 'img-src',
          'blocked-uri': 'https://tracker.example/pixel.png?u=someone@example.com',
        },
      }),
    ).toEqual([
      {
        directive: 'img-src',
        blocked: 'https://tracker.example/pixel.png',
        page: '/songs/1/practice',
      },
    ])
  })

  it('reads Reporting API batches and keeps only CSP violations', () => {
    expect(
      parseCspReports([
        {
          type: 'csp-violation',
          url: 'https://app.splitune.test/library',
          body: {
            documentURL: 'https://app.splitune.test/library?q=title',
            effectiveDirective: 'script-src-elem',
            blockedURL: 'inline',
          },
        },
        { type: 'deprecation', body: { id: 'x' } },
      ]),
    ).toEqual([{ directive: 'script-src-elem', blocked: 'inline', page: '/library' }])
  })

  it('ignores malformed bodies, caps fields and the number of reports', () => {
    expect(parseCspReports(undefined)).toEqual([])
    expect(parseCspReports('nonsense')).toEqual([])
    expect(parseCspReports({ 'csp-report': 'x' })).toEqual([])
    expect(parseCspReports({ 'csp-report': { 'blocked-uri': 'inline' } })).toEqual([])
    const many = Array.from({ length: 50 }, () => ({
      type: 'csp-violation',
      body: { effectiveDirective: 'a'.repeat(5000), blockedURL: 'eval', documentURL: '' },
    }))
    const parsed = parseCspReports(many)
    expect(parsed).toHaveLength(10)
    expect(parsed[0]?.directive).toHaveLength(200)
    expect(parsed[0]?.page).toBe('')
  })
})
