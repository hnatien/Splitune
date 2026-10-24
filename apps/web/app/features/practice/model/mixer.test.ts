import type { Stems } from '@splitune/contracts'
import stems from '@splitune/contracts/fixtures/stems.json'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import {
  defaultMix,
  guideLevel,
  mixChannels,
  presetMix,
  presetOf,
  resolveMix,
  toggleMutePart,
  withGuide,
} from './mixer'

const channels = mixChannels(stems as z.infer<typeof Stems>, 'guitar')
const PART = 'guitar'
const BACKING = 'mix_minus_guitar'

describe('mixer', () => {
  it('plays the part and its mix-minus, part first', () => {
    expect(channels.map((c) => [c.stemId, c.role])).toEqual([
      ['guitar', 'part'],
      ['mix_minus_guitar', 'backing'],
    ])
    expect(channels[0]?.soloGainDb).toBe(5.4)
  })

  it('has no channels when the part was not isolated', () => {
    expect(mixChannels(stems as z.infer<typeof Stems>, 'piano')).toEqual([])
  })

  it('defaults to my part with the backing 6 dB down', () => {
    expect(defaultMix(channels)).toEqual({
      guitar: { gain_db: 0, muted: false, solo: false },
      mix_minus_guitar: { gain_db: -6, muted: false, solo: false },
    })
    expect(presetOf(channels, defaultMix(channels))).toBeNull()
  })

  it('recognises each preset', () => {
    for (const preset of ['part-loud', 'minus-one', 'original'] as const) {
      expect(presetOf(channels, presetMix(channels, preset))).toBe(preset)
    }
    expect(presetMix(channels, 'minus-one')[PART]?.muted).toBe(true)
  })

  it('keeps a saved mix and fills stems it doesn’t name', () => {
    const mix = resolveMix(channels, { guitar: { gain_db: 3, muted: false, solo: true } })
    expect(mix[PART]).toEqual({ gain_db: 3, muted: false, solo: true })
    expect(mix[BACKING]?.gain_db).toBe(-6)
  })

  it('mutes and unmutes my part', () => {
    const muted = toggleMutePart(channels, defaultMix(channels))
    expect(muted[PART]?.muted).toBe(true)
    expect(toggleMutePart(channels, muted)[PART]?.muted).toBe(false)
  })
})

describe('guide vocal', () => {
  it('reads and sets the part as on, quiet or off, leaving the backing alone', () => {
    const start = defaultMix(channels)
    expect(guideLevel(channels, start)).toBe('on')
    const quiet = withGuide(channels, start, 'quiet')
    expect(quiet[PART]).toEqual({ gain_db: -12, muted: false, solo: false })
    expect(quiet[BACKING]).toEqual(start[BACKING])
    expect(guideLevel(channels, quiet)).toBe('quiet')
    expect(guideLevel(channels, withGuide(channels, quiet, 'off'))).toBe('off')
    expect(guideLevel(channels, withGuide(channels, quiet, 'on'))).toBe('on')
    expect(guideLevel([], start)).toBeNull()
  })
})
