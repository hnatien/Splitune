import { describe, expect, it } from 'vitest'
import { userHasher } from './server.ts'

describe('userHasher', () => {
  it('is stable per salt, differs between users and salts, and hides the id', () => {
    const hash = userHasher('a-salt-of-sixteen-chars')
    const other = userHasher('another-salt-sixteen+')
    expect(hash('user-1')).toBe(hash('user-1'))
    expect(hash('user-1')).toMatch(/^[0-9a-f]{32}$/)
    expect(hash('user-1')).not.toBe(hash('user-2'))
    expect(hash('user-1')).not.toBe(other('user-1'))
    expect(hash('user-1')).not.toContain('user-1')
  })

  it('refuses a short salt', () => {
    expect(() => userHasher('short')).toThrow(/ANALYTICS_SALT/)
  })
})
