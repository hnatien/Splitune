import type { Instrument, Stems } from '@splitune/contracts'
import type { z } from 'zod'

// The mixer model (12 §7). A Full analysis since s40a lists every stem its separation run made
// (stem_post leaves out the empty ones) plus the mix-minus of the learner's part. When those
// isolated stems are the whole song, each one is a channel and the mix-minus isn't played (it
// would double them). Otherwise (an analysis from before s40a, which kept only drums and bass
// beside the part, or a two-stem head with no extras at all) the isolated stems are a subset of
// the song, so the channels stay "Your part" and "Band" (the mix-minus).

type StemsDoc = z.infer<typeof Stems>
type StemDoc = StemsDoc['stems'][number]
type InstrumentName = z.infer<typeof Instrument>

/** `part`: the learner's stem. `stem`: another isolated stem. `backing`: the mix-minus ("Band"). */
export type MixRole = 'part' | 'stem' | 'backing'

export interface MixChannel {
  stemId: string
  role: MixRole
  /** The isolated stem's instrument; none for the mix-minus. */
  instrument: InstrumentName | undefined
  rough: boolean
  /** Gain while soloed (stems.json gain_to_unity_db), so solo levels feel equal. */
  soloGainDb: number
  stem: StemDoc
}

export interface StemMix {
  gain_db: number
  muted: boolean
  solo: boolean
}

export type Mix = Record<string, StemMix>

export type MixPreset = 'part-loud' | 'minus-one' | 'original' | 'rhythm'

/** Mixer order (27 §3.7.4, Practice-Mix): your part first, then the others in this order. */
const MIXER_ORDER: readonly InstrumentName[] = [
  'guitar',
  'vocals',
  'bass',
  'drums',
  'piano',
  'other',
]

// Before s40a separation kept only drums and bass beside the learner's stem; s40a keeps every
// non-empty output, so any other extra means the list is the whole run.
const KEPT_BEFORE_S40A: readonly InstrumentName[] = ['drums', 'bass']

const channelOf = (stem: StemDoc, role: MixRole): MixChannel => ({
  stemId: stem.stem_id,
  role,
  instrument: stem.kind === 'isolated' ? stem.instrument : undefined,
  rough: stem.quality_hint === 'rough',
  soloGainDb: stem.gain_to_unity_db,
  stem,
})

/** The playable channels, "Your part" first; empty when the part wasn't isolated. */
export function mixChannels(stems: StemsDoc, instrument: string): MixChannel[] {
  const isolated = stems.stems.filter(
    (s) => s.kind === 'isolated' && s.instrument !== undefined && !s.empty,
  )
  const part = isolated.find((s) => s.instrument === instrument)
  if (!part) return []
  const extras = isolated
    .filter((s) => s !== part)
    .sort(
      (a, b) =>
        MIXER_ORDER.indexOf(a.instrument as InstrumentName) -
        MIXER_ORDER.indexOf(b.instrument as InstrumentName),
    )
  const whole = extras.some((s) => !KEPT_BEFORE_S40A.includes(s.instrument as InstrumentName))
  if (whole) return [channelOf(part, 'part'), ...extras.map((s) => channelOf(s, 'stem'))]
  const backing = stems.stems.find((s) => s.kind === 'mix_minus')
  return backing ? [channelOf(part, 'part'), channelOf(backing, 'backing')] : []
}

const RHYTHM: readonly InstrumentName[] = ['bass', 'drums']

/** Rhythm only needs a bass and a drums channel of their own (12 §7). */
export function hasRhythm(channels: readonly MixChannel[]): boolean {
  return RHYTHM.every((instrument) => channels.some((c) => c.instrument === instrument))
}

/** The presets these channels offer, in the Mix tab's order. */
export function presetsFor(channels: readonly MixChannel[]): MixPreset[] {
  const presets: MixPreset[] = ['part-loud', 'minus-one', 'original']
  return hasRhythm(channels) ? [...presets, 'rhythm'] : presets
}

const flat = (gain_db: number, muted = false): StemMix => ({ gain_db, muted, solo: false })

export function presetMix(channels: readonly MixChannel[], preset: MixPreset): Mix {
  const rhythm = preset === 'rhythm' && hasRhythm(channels)
  return Object.fromEntries(
    channels.map((c) => {
      const part = c.role === 'part'
      switch (preset) {
        case 'part-loud':
          return [c.stemId, flat(part ? 6 : -6)]
        case 'minus-one':
          return [c.stemId, flat(0, part)]
        case 'rhythm':
          return [c.stemId, flat(0, rhythm && !RHYTHM.includes(c.instrument as InstrumentName))]
        default:
          return [c.stemId, flat(0)]
      }
    }),
  )
}

/**
 * A saved default ("Use as default for {part}", per device): levels by the stem's instrument,
 * with `band` for the mix-minus, so it fits every song of that part whatever its stems.
 */
export type MixDefault = Record<string, StemMix>

const BAND_KEY = 'band'

const keyOf = (channel: MixChannel) =>
  channel.role === 'backing' ? BAND_KEY : (channel.instrument ?? channel.stemId)

/** First open (12 §7): the saved default, else my part at unity and the rest 6 dB down. */
export function defaultMix(channels: readonly MixChannel[], saved?: MixDefault): Mix {
  return Object.fromEntries(
    channels.map((c) => [c.stemId, saved?.[keyOf(c)] ?? flat(c.role === 'part' ? 0 : -6)]),
  )
}

/** The mix as a default for any song of this part (its band level too, for two-channel songs). */
export function toDefault(channels: readonly MixChannel[], mix: Mix): MixDefault {
  const out: MixDefault = {}
  for (const c of channels) {
    const state = mix[c.stemId]
    if (state) out[keyOf(c)] = { ...state, solo: false }
  }
  const band = bandLevel(channels, mix)
  if (band) out[BAND_KEY] = { gain_db: band.gain_db, muted: band.muted, solo: false }
  return out
}

const same = (a: StemMix | undefined, b: StemMix | undefined) =>
  a !== undefined &&
  b !== undefined &&
  a.gain_db === b.gain_db &&
  a.muted === b.muted &&
  a.solo === b.solo

/** Whether two mixes set every channel alike. */
export function sameMix(channels: readonly MixChannel[], a: Mix, b: Mix): boolean {
  return channels.every((c) => same(a[c.stemId], b[c.stemId]))
}

/** The preset a mix is exactly, if any (the preset group shows it pressed). */
export function presetOf(channels: readonly MixChannel[], mix: Mix): MixPreset | null {
  if (channels.length === 0) return null
  return (
    presetsFor(channels).find((preset) => sameMix(channels, mix, presetMix(channels, preset))) ??
    null
  )
}

/** Mix for the stems at hand: the saved one where it names them, else the default. */
export function resolveMix(
  channels: readonly MixChannel[],
  saved: Mix | undefined,
  fallback: Mix = defaultMix(channels),
): Mix {
  return Object.fromEntries(
    channels.map((c) => [c.stemId, saved?.[c.stemId] ?? (fallback[c.stemId] as StemMix)]),
  )
}

export function toggleMutePart(channels: readonly MixChannel[], mix: Mix): Mix {
  const part = channels.find((c) => c.role === 'part')
  const current = part && mix[part.stemId]
  if (!part || !current) return mix
  return { ...mix, [part.stemId]: { ...current, muted: !current.muted } }
}

/**
 * The band as one fader (the phone mini-mixer, 27 §3.7.2): every channel but your part. Its level
 * is the loudest of them; it is muted when all of them are.
 */
export function bandLevel(
  channels: readonly MixChannel[],
  mix: Mix,
): { gain_db: number; muted: boolean } | null {
  const band = channels.flatMap((c) => (c.role === 'part' ? [] : [mix[c.stemId]])).filter(Boolean)
  if (band.length === 0) return null
  return {
    gain_db: Math.max(...band.map((s) => (s as StemMix).gain_db)),
    muted: band.every((s) => (s as StemMix).muted),
  }
}

/** Moves the whole band to `gainDb` (its loudest stem there), keeping its balance in range. */
export function withBandLevel(
  channels: readonly MixChannel[],
  mix: Mix,
  gainDb: number,
  range: { min: number; max: number },
): Mix {
  const current = bandLevel(channels, mix)
  if (!current) return mix
  const shift = gainDb - current.gain_db
  const next = { ...mix }
  for (const c of channels) {
    const state = mix[c.stemId]
    if (c.role === 'part' || !state) continue
    next[c.stemId] = {
      ...state,
      gain_db: Math.min(range.max, Math.max(range.min, state.gain_db + shift)),
    }
  }
  return next
}

export function withBandMuted(channels: readonly MixChannel[], mix: Mix, muted: boolean): Mix {
  const next = { ...mix }
  for (const c of channels) {
    const state = mix[c.stemId]
    if (c.role !== 'part' && state) next[c.stemId] = { ...state, muted }
  }
  return next
}

export type GuideLevel = 'on' | 'quiet' | 'off'

/** A guide vocal held back but still there to lean on (step 18c). */
export const QUIET_GUIDE_DB = -12

/** The part's level as the singer's Guide vocal switch reads it, or null without stems. */
export function guideLevel(channels: readonly MixChannel[], mix: Mix): GuideLevel | null {
  const part = channels.find((c) => c.role === 'part')
  const current = part && mix[part.stemId]
  if (!current) return null
  if (current.muted) return 'off'
  return current.gain_db <= QUIET_GUIDE_DB / 2 ? 'quiet' : 'on'
}

/** The mix with the part (the guide vocal) on at unity, quiet, or muted; the backing as it was. */
export function withGuide(channels: readonly MixChannel[], mix: Mix, level: GuideLevel): Mix {
  const part = channels.find((c) => c.role === 'part')
  if (!part) return mix
  return {
    ...mix,
    [part.stemId]: {
      gain_db: level === 'quiet' ? QUIET_GUIDE_DB : 0,
      muted: level === 'off',
      solo: false,
    },
  }
}

/**
 * The limiter rule (12 §7, WHO H.870 safe listening): no mix pushes the master above unity. Gains
 * above 0 dB lower every stem by the same amount, so the balance stays and the loudest stem plays
 * at unity ("Your part loud" plays your part at 0 dB and the band at −12 dB). The engine's peak
 * limiter at 0 dBFS catches what a balance can't (stems summing over full scale, solo gains).
 */
export function limitToUnity(gainsDb: readonly number[]): number[] {
  const loudest = Math.max(0, ...gainsDb)
  return gainsDb.map((gain) => gain - loudest)
}
