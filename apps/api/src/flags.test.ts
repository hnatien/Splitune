import { describe, expect, it } from 'vitest'
import { createFlags, evaluateFlags, type FlagRow } from './flags.ts'

// Stored rows (built through a helper: a `key: '…'` literal reads like a credential to gitleaks).
const row = (key: string, enabled: boolean): FlagRow => ({ key, enabled })

describe('flags', () => {
  it('uses a stored row over the declared default, the default without one', () => {
    const flags = evaluateFlags([
      row('import.url', false),
      row('v1.speed_trainer', true),
      row('not.declared', true),
    ])
    expect(flags['import.url']).toBe(false)
    expect(flags['v1.speed_trainer']).toBe(true)
    expect(flags.examples).toBe(true)
    expect(flags['v1.mic_scoring']).toBe(false)
    expect('not.declared' in flags).toBe(false)
  })

  it('caches rows for the TTL and retries after a failed load', async () => {
    let clock = 0
    let loads = 0
    let fail = false
    const flags = createFlags(
      async () => {
        loads += 1
        if (fail) throw new Error('db down')
        return [row('examples', loads > 1)]
      },
      { ttlMs: 1000, now: () => clock },
    )
    expect(await flags.flag('examples')).toBe(false)
    expect(await flags.flag('examples')).toBe(false)
    expect(loads).toBe(1)
    clock = 1000
    expect(await flags.flag('examples')).toBe(true)
    clock = 2000
    fail = true
    await expect(flags.all()).rejects.toThrow('db down')
    fail = false
    expect(await flags.flag('examples')).toBe(true)
    expect(loads).toBe(4)
  })
})
