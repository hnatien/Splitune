// The iTunes gapless record (`iTunSMPB`) that AudioToolbox writes into AAC MP4 files instead of
// an edit list: " 00000000 <priming> <padding> <original length> …" in hex. Same parsing as the
// separation stage's encode verification (services/ml/…/stage_separation/encode.py).

const MARKER = [0x69, 0x54, 0x75, 0x6e, 0x53, 0x4d, 0x50, 0x42] // "iTunSMPB"
const DATA_HEADER = 16 // the `data` atom's size, type, flags and locale
const MAX_TEXT = 200

function find(bytes: Uint8Array, pattern: number[]): number {
  const first = pattern[0]
  for (let i = bytes.indexOf(first as number); i >= 0; i = bytes.indexOf(first as number, i + 1)) {
    if (pattern.every((byte, k) => bytes[i + k] === byte)) return i
  }
  return -1
}

export interface Gapless {
  // Frames, at the file's sample rate.
  priming: number
  padding: number
  length: number
}

// The gapless record, or undefined when the file has none (or a malformed one).
export function itunesGapless(bytes: Uint8Array): Gapless | undefined {
  const at = find(bytes, MARKER)
  if (at < 0) return undefined
  const start = at + MARKER.length + DATA_HEADER
  const raw = bytes.subarray(start, start + MAX_TEXT)
  const end = raw.indexOf(0)
  const text = new TextDecoder('latin1').decode(end < 0 ? raw : raw.subarray(0, end))
  const [, priming, padding, length] = text
    .trim()
    .split(/\s+/)
    .map((field) => Number.parseInt(field, 16))
  if (priming === undefined || padding === undefined || length === undefined) return undefined
  if (![priming, padding, length].every(Number.isFinite) || length <= 0) return undefined
  return { priming, padding, length }
}
