// The library's miniature of a song (27 §3.5, contracts SongWaveform): the lane's loudness in 96
// equal slices, each 0–100 of the loudest slice. RMS rather than peaks, so a heavily limited
// master still shows where the song is quiet and where it is full.

export const WAVEFORM_SLICES = 96

/** Null for a lane with no audio in it (nothing decoded, or silence). */
export function waveformSummary(rms: Float32Array, slices = WAVEFORM_SLICES): number[] | null {
  if (rms.length === 0) return null
  const levels: number[] = []
  for (let slice = 0; slice < slices; slice++) {
    const from = Math.min(rms.length - 1, Math.floor((slice * rms.length) / slices))
    const to = Math.max(from + 1, Math.floor(((slice + 1) * rms.length) / slices))
    let sum = 0
    for (let block = from; block < to; block++) sum += rms[block] ?? 0
    levels.push(sum / (to - from))
  }
  const loudest = Math.max(...levels)
  if (loudest <= 0) return null
  return levels.map((level) => Math.round((level / loudest) * 100))
}
