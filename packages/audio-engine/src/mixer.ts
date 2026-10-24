// Mute/solo resolve to per-stem gains on the main thread (docs/specs/11-audio-engine.md
// §2): with any stem soloed only soloed stems sound, at their solo gain (stems.json
// `gain_to_unity_db`); otherwise muted stems are silent.

export interface MixerChannel {
  // Linear volume from the mixer fader.
  gain: number
  muted: boolean
  soloed: boolean
  // Linear gain applied while soloed, so solo levels feel equal.
  soloGain?: number
}

export function resolveGains(channels: MixerChannel[]): number[] {
  const soloing = channels.some((channel) => channel.soloed)
  return channels.map((channel) => {
    if (soloing) return channel.soloed ? channel.gain * (channel.soloGain ?? 1) : 0
    return channel.muted ? 0 : channel.gain
  })
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20)
}
