import { describe, expect, it } from 'vitest'
import { dbToGain, resolveGains } from './mixer.ts'

const channel = (gain: number, muted = false, soloed = false, soloGain?: number) => ({
  gain,
  muted,
  soloed,
  ...(soloGain === undefined ? {} : { soloGain }),
})

describe('resolveGains', () => {
  it('silences muted stems', () => {
    expect(resolveGains([channel(0.8), channel(1, true)])).toEqual([0.8, 0])
  })

  it('plays only soloed stems, at their solo gain, ignoring mute', () => {
    expect(
      resolveGains([channel(0.8, true, true, 2), channel(1), channel(0.5, false, true)]),
    ).toEqual([1.6, 0, 0.5])
  })

  it('converts decibels', () => {
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3)
    expect(dbToGain(0)).toBe(1)
  })
})
