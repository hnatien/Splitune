import type * as alphaTab from '@coderline/alphatab'

// alphaTab's player in PlayerMode.EnabledExternalMedia (12 §3): its synth is off and the display
// never owns the clock — the view pushes the engine's heard position with updatePosition(ms)
// every frame. alphaTab's own controls are off (no cursor, no user interaction), so the only
// play/pause/seek calls it makes are side effects of loading or re-rendering a score; they are
// not the learner's and must not move the audio, so the handler takes them as no-ops.

export interface MediaTarget {
  /** Timeline length in seconds. */
  duration(): number
}

export function externalMediaHandler(target: MediaTarget): alphaTab.synth.IExternalMediaHandler {
  return {
    get backingTrackDuration() {
      return target.duration() * 1000
    },
    // alphaTab's own speed stays 1: positions are pushed in timeline ms, already slowed down.
    playbackRate: 1,
    masterVolume: 1,
    seekTo: () => undefined,
    play: () => undefined,
    pause: () => undefined,
  }
}

/** The external-media output of an API in that mode, once its player exists. */
export function externalOutput(
  api: Pick<alphaTab.AlphaTabApi, 'player'>,
): alphaTab.synth.IExternalMediaSynthOutput | undefined {
  const output = api.player?.output as alphaTab.synth.IExternalMediaSynthOutput | undefined
  return output && 'updatePosition' in output ? output : undefined
}
