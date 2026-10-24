// Decoded channels → the engine's stem format: interleaved stereo Int16 at the context rate,
// exactly `frames` long (docs/specs/11-audio-engine.md §4), plus waveform peaks.

export const PEAK_BLOCK = 512

export interface StemPcm {
  // Interleaved stereo Int16 (≈ 42 MB for 4 minutes at 48 kHz).
  pcm: Int16Array
  frames: number
  // Min/max pairs of the mono mix per PEAK_BLOCK frames, for the timeline.
  peaks: Float32Array
}

// Frames on the decoded-PCM timeline for a duration (stems.json `duration_s`).
export function timelineFrames(durationSeconds: number, sampleRate: number): number {
  return Math.round(durationSeconds * sampleRate)
}

// Mono is duplicated, extra channels are dropped; the decoder's end padding is trimmed and a
// short decode is padded with silence so every stem has the same length.
export function toStemPcm(channels: Float32Array[], frames: number): StemPcm {
  const left = channels[0] ?? new Float32Array(0)
  const right = channels[1] ?? left
  const pcm = new Int16Array(frames * 2)
  const blocks = Math.ceil(frames / PEAK_BLOCK)
  const peaks = new Float32Array(blocks * 2)
  const available = Math.min(frames, left.length, right.length)
  for (let block = 0; block < blocks; block++) {
    let min = 0
    let max = 0
    const end = Math.min(frames, (block + 1) * PEAK_BLOCK)
    for (let i = block * PEAK_BLOCK; i < end; i++) {
      const l = i < available ? (left[i] as number) : 0
      const r = i < available ? (right[i] as number) : 0
      pcm[2 * i] = toInt16(l)
      pcm[2 * i + 1] = toInt16(r)
      const mono = (l + r) / 2
      if (mono < min) min = mono
      if (mono > max) max = mono
    }
    peaks[2 * block] = min
    peaks[2 * block + 1] = max
  }
  return { pcm, frames, peaks }
}

function toInt16(sample: number): number {
  if (Number.isNaN(sample)) return 0
  if (sample <= -1) return -32768
  if (sample >= 1) return 32767
  return Math.round(sample < 0 ? sample * 32768 : sample * 32767)
}
