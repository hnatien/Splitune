import { describe, expect, it } from 'vitest'
import { safeNext } from './next-path.ts'

describe('safeNext', () => {
  it('keeps same-origin paths', () => {
    expect(safeNext('/import?tab=link')).toBe('/import?tab=link')
  })

  it('refuses other origins, protocol-relative and auth loops', () => {
    for (const value of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/auth/verify',
      42,
    ]) {
      expect(safeNext(value)).toBe('/library')
    }
  })
})
