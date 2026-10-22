// Polyphase windowed-sinc resampler for the WebCodecs decode path, which decodes at the file's
// rate (stems are 44.1 kHz) while the AudioContext runs at 48 kHz. decodeAudioData resamples
// natively and doesn't need it.

const ZERO_CROSSINGS = 16
const KAISER_BETA = 8.6
const PASSBAND = 0.96

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

function besselI0(x: number): number {
  let sum = 1
  let term = 1
  for (let k = 1; k < 30; k++) {
    term *= (x / (2 * k)) ** 2
    sum += term
  }
  return sum
}

export function resampledLength(frames: number, from: number, to: number): number {
  return Math.round((frames * to) / from)
}

// Resamples one channel. Output frame n sits at input position n·from/to, so frame 0 stays
// aligned and the length scales exactly (rounded).
export function resample(input: Float32Array, from: number, to: number): Float32Array {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from <= 0 || to <= 0) {
    throw new RangeError(`unsupported rates ${from} → ${to}`)
  }
  if (from === to) return input.slice()
  const divisor = gcd(from, to)
  const up = to / divisor
  const down = from / divisor
  const cutoff = Math.min(1, to / from) * PASSBAND // fraction of the input Nyquist
  const width = Math.ceil(ZERO_CROSSINGS / cutoff)
  const taps = 2 * width
  const norm = besselI0(KAISER_BETA)

  // table[phase][k] weighs input[i − width + 1 + k] for an output at input position i + phase/up.
  const table = new Float32Array(up * taps)
  for (let phase = 0; phase < up; phase++) {
    const fraction = phase / up
    let sum = 0
    for (let k = 0; k < taps; k++) {
      const x = k - width + 1 - fraction
      const sinc = x === 0 ? 1 : Math.sin(Math.PI * cutoff * x) / (Math.PI * cutoff * x)
      const r = x / width
      const window = Math.abs(r) >= 1 ? 0 : besselI0(KAISER_BETA * Math.sqrt(1 - r * r)) / norm
      const value = cutoff * sinc * window
      table[phase * taps + k] = value
      sum += value
    }
    // Unity gain at DC for every phase.
    for (let k = 0; k < taps; k++) table[phase * taps + k] = (table[phase * taps + k] ?? 0) / sum
  }

  const length = resampledLength(input.length, from, to)
  const output = new Float32Array(length)
  const last = input.length - 1
  for (let n = 0; n < length; n++) {
    const position = n * down
    const i = Math.floor(position / up)
    const phase = position - i * up
    const base = phase * taps
    const first = i - width + 1
    let acc = 0
    if (first >= 0 && first + taps - 1 <= last) {
      for (let k = 0; k < taps; k++)
        acc += (input[first + k] as number) * (table[base + k] as number)
    } else {
      for (let k = 0; k < taps; k++) {
        const j = first + k
        if (j >= 0 && j <= last) acc += (input[j] as number) * (table[base + k] as number)
      }
    }
    output[n] = acc
  }
  return output
}
