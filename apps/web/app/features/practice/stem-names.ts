import type { StemKind } from '@splitune/ui-tokens'
import { m } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/instruments'
import type { MixChannel } from './model/mixer'

// A channel's name and colour family in the mixer (26 §4.4, 27 §5.2): the instrument's name
// ("Other" for the rest of the band), "Band" for the mix-minus. The colour is never the only cue.

const KIND: Record<string, StemKind> = {
  guitar: 'guitar',
  bass: 'bass',
  drums: 'drums',
  vocals: 'vocals',
  piano: 'keys',
  other: 'other',
}

export function stemKind(channel: MixChannel): StemKind {
  return channel.instrument ? (KIND[channel.instrument] ?? 'other') : 'mix'
}

export function stemName(channel: MixChannel): string {
  if (!channel.instrument) return m['mixer.backing']()
  return channel.instrument === 'other'
    ? m['mixer.stem_other']()
    : instrumentLabel(channel.instrument)
}
