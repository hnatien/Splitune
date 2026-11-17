import { type Mix, type MixChannel, presetMix } from './mixer'

// "Listen to" in the Fix dock (27 §3.7.4): what plays over the selected bars while fixing. The
// learner's own mix comes back when Fix mode ends.

export const FIX_LISTEN = ['original', 'part', 'synth', 'both'] as const
/** Original: the song as recorded. Your part: the isolated stem alone. Tab synth: only the synth
 * playing what we transcribed. Both: your part with the synth over it. */
export type FixListen = (typeof FIX_LISTEN)[number]

/** Whether the synth plays the transcribed part. */
export const listensToSynth = (listen: FixListen) => listen === 'synth' || listen === 'both'

/** The stems' mix for a choice; before the stems exist the one lane is the song itself. */
export function listenMix(channels: readonly MixChannel[], listen: FixListen): Mix {
  if (listen === 'original') return presetMix(channels, 'original')
  return Object.fromEntries(
    channels.map((channel) => [
      channel.stemId,
      { gain_db: 0, muted: listen === 'synth' || channel.role !== 'part', solo: false },
    ]),
  )
}
