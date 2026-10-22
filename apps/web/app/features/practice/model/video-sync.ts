// Local video slaved to the master clock (13 §6a): playbackRate follows the engine rate, a loop
// wrap or a drift over 80 ms re-seeks, smaller drift is nudged by ±2 % until it closes.

export const RESEEK_DRIFT_S = 0.08
export const NUDGE = 0.02
const SETTLED_S = 0.015

export interface VideoCorrection {
  /** Set currentTime to this (seconds), or undefined to leave it. */
  seek?: number
  playbackRate: number
}

export function correctVideo(
  audio: number,
  video: number,
  rate: number,
  wrapped = false,
): VideoCorrection {
  const drift = video - audio
  if (wrapped || Math.abs(drift) > RESEEK_DRIFT_S) return { seek: audio, playbackRate: rate }
  if (Math.abs(drift) <= SETTLED_S) return { playbackRate: rate }
  // Ahead → slightly slower; behind → slightly faster.
  return { playbackRate: rate * (drift > 0 ? 1 - NUDGE : 1 + NUDGE) }
}
