import type { Stems } from '@splitune/contracts'
import type { z } from 'zod'

// The mixer model (12 §7). The MVP engine plays two stems (11 §4): the learner's isolated part and
// the server's mix-minus of it (the mixture minus that part, so both at unity are the original).
// Other isolated stems are subsets of the mix-minus and would double up; multi-stem mixing is v1.

type StemsDoc = z.infer<typeof Stems>
type StemDoc = StemsDoc['stems'][number]

export type MixRole = 'part' | 'backing'

export interface MixChannel {
  stemId: string
  role: MixRole
  rough: boolean
  /** Linear gain while soloed (stems.json gain_to_unity_db), so solo levels feel equal. */
  soloGainDb: number
  stem: StemDoc
}

export interface StemMix {
  gain_db: number
  muted: boolean
  solo: boolean
}

export type Mix = Record<string, StemMix>

export type MixPreset = 'part-loud' | 'minus-one' | 'original'

/** The playable channels, "Your part" first; empty when the stems lack either side. */
export function mixChannels(stems: StemsDoc, instrument: string): MixChannel[] {
  const part = stems.stems.find(
    (s) => s.kind === 'isolated' && s.instrument === instrument && !s.empty,
  )
  const backing = stems.stems.find((s) => s.kind === 'mix_minus')
  if (!part || !backing) return []
  return [
    {
      stemId: part.stem_id,
      role: 'part',
      rough: part.quality_hint === 'rough',
      soloGainDb: part.gain_to_unity_db,
      stem: part,
    },
    {
      stemId: backing.stem_id,
      role: 'backing',
      rough: backing.quality_hint === 'rough',
      soloGainDb: backing.gain_to_unity_db,
      stem: backing,
    },
  ]
}

const flat = (gain_db: number, muted = false): StemMix => ({ gain_db, muted, solo: false })

export function presetMix(channels: readonly MixChannel[], preset: MixPreset): Mix {
  return Object.fromEntries(
    channels.map((c) => {
      const part = c.role === 'part'
      switch (preset) {
        case 'part-loud':
          return [c.stemId, flat(part ? 6 : -6)]
        case 'minus-one':
          return [c.stemId, flat(0, part)]
        default:
          return [c.stemId, flat(0)]
      }
    }),
  )
}

/** First open (12 §7): my part at unity, the backing 6 dB down. */
export function defaultMix(channels: readonly MixChannel[]): Mix {
  return Object.fromEntries(channels.map((c) => [c.stemId, flat(c.role === 'part' ? 0 : -6)]))
}

/** The preset a mix is exactly, if any (the preset group shows it pressed). */
export function presetOf(channels: readonly MixChannel[], mix: Mix): MixPreset | null {
  const presets: MixPreset[] = ['part-loud', 'minus-one', 'original']
  return (
    presets.find((preset) => {
      const target = presetMix(channels, preset)
      return channels.every((c) => {
        const a = mix[c.stemId]
        const b = target[c.stemId]
        return a && b && a.gain_db === b.gain_db && a.muted === b.muted && a.solo === b.solo
      })
    }) ?? null
  )
}

/** Mix for the stems at hand: the saved one where it names them, else the default. */
export function resolveMix(channels: readonly MixChannel[], saved: Mix | undefined): Mix {
  const fallback = defaultMix(channels)
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
