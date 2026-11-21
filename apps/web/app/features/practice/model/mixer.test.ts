import type { Stems } from '@splitune/contracts'
import stems from '@splitune/contracts/fixtures/stems.json'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import {
  bandLevel,
  defaultMix,
  guideLevel,
  hasRhythm,
  limitToUnity,
  type Mix,
  type MixChannel,
  mixChannels,
  presetMix,
  presetOf,
  presetsFor,
  resolveMix,
  sameMix,
  toDefault,
  toggleMutePart,
  withBandLevel,
  withBandMuted,
  withGuide,
} from './mixer'

type StemsDoc = z.infer<typeof Stems>
type StemDoc = StemsDoc['stems'][number]

const fixture = stems as StemsDoc
const stem = (mix: Mix, id: string) => mix[id]

/** The fixture's header with these stems: isolated ones by instrument, plus a mix-minus. */
function doc(
  instruments: string[],
  options: { empty?: string[]; rough?: string[]; mixMinus?: string | null } = {},
): StemsDoc {
  const base = fixture.stems[0] as StemDoc
  const isolated = instruments.map(
    (instrument): StemDoc => ({
      ...base,
      stem_id: instrument,
      instrument: instrument as StemDoc['instrument'],
      empty: options.empty?.includes(instrument) ?? false,
      quality_hint: options.rough?.includes(instrument) ? 'rough' : 'good',
    }),
  )
  const minus = options.mixMinus === undefined ? instruments[0] : options.mixMinus
  const backing: StemDoc[] =
    minus === null
      ? []
      : [{ ...base, stem_id: `mix_minus_${minus}`, kind: 'mix_minus', instrument: undefined }]
  return { ...fixture, stems: [...isolated, ...backing] }
}

const roles = (channels: MixChannel[]) => channels.map((c) => [c.stemId, c.role])
const ALL = ['guitar', 'bass', 'drums', 'piano', 'vocals', 'other']
const all = mixChannels(doc(ALL), 'guitar')

describe('channels', () => {
  it('plays every stem in mixer order, your part first, without the mix-minus', () => {
    expect(roles(all)).toEqual([
      ['guitar', 'part'],
      ['vocals', 'stem'],
      ['bass', 'stem'],
      ['drums', 'stem'],
      ['piano', 'stem'],
      ['other', 'stem'],
    ])
    expect(all.some((c) => c.role === 'backing')).toBe(false)
  })

  it('reads the stems fixture as every stem of the run (stem_post left the empty ones out)', () => {
    const channels = mixChannels(fixture, 'guitar')
    expect(roles(channels)).toEqual([
      ['guitar', 'part'],
      ['drums', 'stem'],
      ['other', 'stem'],
    ])
    expect(channels[0]?.soloGainDb).toBe(5.4)
    expect(channels[1]?.rough).toBe(true)
  })

  it('falls back to your part and the band when only drums and bass were kept (before s40a)', () => {
    expect(roles(mixChannels(doc(['guitar', 'drums', 'bass']), 'guitar'))).toEqual([
      ['guitar', 'part'],
      ['mix_minus_guitar', 'backing'],
    ])
  })

  it('falls back to your part and the band for a two-stem run', () => {
    expect(roles(mixChannels(doc(['vocals']), 'vocals'))).toEqual([
      ['vocals', 'part'],
      ['mix_minus_vocals', 'backing'],
    ])
  })

  it('leaves out stems marked empty, and plays nothing when your part is empty', () => {
    const channels = mixChannels(doc(ALL, { empty: ['piano', 'vocals'] }), 'guitar')
    expect(channels.map((c) => c.stemId)).toEqual(['guitar', 'bass', 'drums', 'other'])
    expect(mixChannels(doc(ALL, { empty: ['guitar'] }), 'guitar')).toEqual([])
  })

  it('treats stems that are only empty extras beside drums and bass as the fallback', () => {
    const channels = mixChannels(doc(ALL, { empty: ['piano', 'vocals', 'other'] }), 'guitar')
    expect(roles(channels)).toEqual([
      ['guitar', 'part'],
      ['mix_minus_guitar', 'backing'],
    ])
  })

  it('has no channels when the part was not isolated, or the fallback has no mix-minus', () => {
    expect(mixChannels(fixture, 'piano')).toEqual([])
    expect(mixChannels(doc(['guitar', 'drums'], { mixMinus: null }), 'guitar')).toEqual([])
  })

  it('marks rough stems', () => {
    const channels = mixChannels(doc(ALL, { rough: ['other'] }), 'guitar')
    expect(channels.filter((c) => c.rough).map((c) => c.stemId)).toEqual(['other'])
  })
})

describe('presets', () => {
  it('offers Rhythm only when bass and drums are channels of their own', () => {
    expect(hasRhythm(all)).toBe(true)
    expect(presetsFor(all)).toEqual(['part-loud', 'minus-one', 'original', 'rhythm'])
    const fallback = mixChannels(doc(['guitar', 'drums', 'bass']), 'guitar')
    expect(hasRhythm(fallback)).toBe(false)
    expect(presetsFor(fallback)).not.toContain('rhythm')
    expect(hasRhythm(mixChannels(fixture, 'guitar'))).toBe(false)
    expect(hasRhythm(mixChannels(doc(['drums', ...ALL.slice(0, 2), 'other']), 'drums'))).toBe(true)
  })

  it('sets the gains of each preset', () => {
    const gains = (preset: Parameters<typeof presetMix>[1]) =>
      Object.fromEntries(
        Object.entries(presetMix(all, preset)).map(([id, s]) => [
          id,
          s.muted ? 'muted' : s.gain_db,
        ]),
      )
    expect(gains('part-loud')).toEqual({
      guitar: 6,
      vocals: -6,
      bass: -6,
      drums: -6,
      piano: -6,
      other: -6,
    })
    expect(gains('minus-one')).toEqual({
      guitar: 'muted',
      vocals: 0,
      bass: 0,
      drums: 0,
      piano: 0,
      other: 0,
    })
    expect(gains('original')).toEqual({
      guitar: 0,
      vocals: 0,
      bass: 0,
      drums: 0,
      piano: 0,
      other: 0,
    })
    expect(gains('rhythm')).toEqual({
      guitar: 'muted',
      vocals: 'muted',
      bass: 0,
      drums: 0,
      piano: 'muted',
      other: 'muted',
    })
  })

  it('keeps a drummer’s own part in Rhythm only', () => {
    const drums = mixChannels(doc(['drums', 'bass', 'guitar', 'other']), 'drums')
    const rhythm = presetMix(drums, 'rhythm')
    expect(stem(rhythm, 'drums')?.muted).toBe(false)
    expect(stem(rhythm, 'bass')?.muted).toBe(false)
    expect(stem(rhythm, 'guitar')?.muted).toBe(true)
  })

  it('recognises each preset it offers, and Rhythm only nowhere else', () => {
    for (const preset of presetsFor(all)) expect(presetOf(all, presetMix(all, preset))).toBe(preset)
    const fallback = mixChannels(doc(['guitar']), 'guitar')
    for (const preset of presetsFor(fallback)) {
      expect(presetOf(fallback, presetMix(fallback, preset))).toBe(preset)
    }
    expect(presetOf(fallback, presetMix(fallback, 'rhythm'))).toBe('original')
    expect(presetOf([], {})).toBeNull()
  })

  it('never lets a preset push a stem above unity once limited (12 §7)', () => {
    for (const preset of presetsFor(all)) {
      const mix = presetMix(all, preset)
      const limited = limitToUnity(
        all.map((c) =>
          mix[c.stemId]?.muted ? Number.NEGATIVE_INFINITY : (mix[c.stemId]?.gain_db ?? 0),
        ),
      )
      expect(Math.max(...limited)).toBeLessThanOrEqual(0)
    }
  })
})

describe('mix', () => {
  const fallback = mixChannels(doc(['guitar']), 'guitar')

  it('defaults to my part with the rest 6 dB down', () => {
    expect(defaultMix(fallback)).toEqual({
      guitar: { gain_db: 0, muted: false, solo: false },
      mix_minus_guitar: { gain_db: -6, muted: false, solo: false },
    })
    expect(presetOf(fallback, defaultMix(fallback))).toBeNull()
    expect(Object.values(defaultMix(all)).map((s) => s.gain_db)).toEqual([0, -6, -6, -6, -6, -6])
  })

  it('keeps a saved mix and fills stems it doesn’t name', () => {
    const mix = resolveMix(fallback, { guitar: { gain_db: 3, muted: false, solo: true } })
    expect(stem(mix, 'guitar')).toEqual({ gain_db: 3, muted: false, solo: true })
    expect(stem(mix, 'mix_minus_guitar')?.gain_db).toBe(-6)
  })

  it('mutes and unmutes my part', () => {
    const muted = toggleMutePart(all, defaultMix(all))
    expect(stem(muted, 'guitar')?.muted).toBe(true)
    expect(stem(muted, 'bass')?.muted).toBe(false)
    expect(stem(toggleMutePart(all, muted), 'guitar')?.muted).toBe(false)
  })

  it('carries a default for the part from a song with every stem to one with two channels', () => {
    const mix: Mix = {
      ...presetMix(all, 'part-loud'),
      drums: { gain_db: -2, muted: false, solo: true },
    }
    const saved = toDefault(all, mix)
    expect(stem(saved, 'guitar')).toEqual({ gain_db: 6, muted: false, solo: false })
    expect(stem(saved, 'drums')).toEqual({ gain_db: -2, muted: false, solo: false })
    expect(stem(saved, 'band')).toEqual({ gain_db: -2, muted: false, solo: false })
    expect(defaultMix(fallback, saved)).toEqual({
      guitar: { gain_db: 6, muted: false, solo: false },
      mix_minus_guitar: { gain_db: -2, muted: false, solo: false },
    })
    expect(stem(defaultMix(all, saved), 'vocals')).toEqual({
      gain_db: -6,
      muted: false,
      solo: false,
    })
    expect(sameMix(all, defaultMix(all, saved), defaultMix(all, saved))).toBe(true)
    expect(sameMix(all, defaultMix(all, saved), defaultMix(all))).toBe(false)
  })
})

describe('band fader (phone mini-mixer)', () => {
  const range = { min: -30, max: 6 }

  it('moves every stem but your part together, keeping their balance', () => {
    const mix: Mix = { ...defaultMix(all), drums: { gain_db: -2, muted: false, solo: false } }
    expect(bandLevel(all, mix)).toEqual({ gain_db: -2, muted: false })
    const quieter = withBandLevel(all, mix, -8, range)
    expect(stem(quieter, 'drums')?.gain_db).toBe(-8)
    expect(stem(quieter, 'bass')?.gain_db).toBe(-12)
    expect(stem(quieter, 'guitar')).toEqual(stem(mix, 'guitar'))
    expect(stem(withBandLevel(all, mix, -30, range), 'bass')?.gain_db).toBe(-30)
  })

  it('mutes the band as one, and reads muted only when all of it is', () => {
    const muted = withBandMuted(all, defaultMix(all), true)
    expect(bandLevel(all, muted)?.muted).toBe(true)
    expect(stem(muted, 'guitar')?.muted).toBe(false)
    expect(
      bandLevel(all, { ...muted, bass: { gain_db: -6, muted: false, solo: false } })?.muted,
    ).toBe(false)
    expect(bandLevel([], {})).toBeNull()
  })
})

describe('guide vocal', () => {
  const channels = mixChannels(doc(['vocals']), 'vocals')

  it('reads and sets the part as on, quiet or off, leaving the backing alone', () => {
    const start = defaultMix(channels)
    expect(guideLevel(channels, start)).toBe('on')
    const quiet = withGuide(channels, start, 'quiet')
    expect(stem(quiet, 'vocals')).toEqual({ gain_db: -12, muted: false, solo: false })
    expect(stem(quiet, 'mix_minus_vocals')).toEqual(stem(start, 'mix_minus_vocals'))
    expect(guideLevel(channels, quiet)).toBe('quiet')
    expect(guideLevel(channels, withGuide(channels, quiet, 'off'))).toBe('off')
    expect(guideLevel(channels, withGuide(channels, quiet, 'on'))).toBe('on')
    expect(guideLevel([], start)).toBeNull()
  })
})

describe('the limiter rule (12 §7)', () => {
  it('keeps the master at or below unity and the balance as set', () => {
    expect(limitToUnity([6, -6])).toEqual([0, -12])
    expect(limitToUnity([0, -6])).toEqual([0, -6])
    expect(limitToUnity([-3, -9])).toEqual([-3, -9])
    expect(limitToUnity([])).toEqual([])
  })
})
