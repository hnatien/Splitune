import { parseChord } from '../harmony/chordtools.ts'
import type { ChordSegment, Note } from '../types.ts'

// Bass trackers lock onto the second harmonic (ml/transcription-guitar-and-bass-tabs.md §6).
// Viterbi over each note's octave candidates {p−12, p, p+12} (07-music-algorithms.md §3).

export interface OctaveWeights {
  chordRoot: number // w1 × semitones outside [root, root + 12] in the bass register / 12
  smooth: number // w2 × |candidate − previous note| / 12
  spectral: number // w3 × penalty from low_band_energy
  change: number // hysteresis: cost of moving a note at all, so weak evidence never flips it
}

export interface OctaveOptions {
  lowestMidi?: number // instrument range; 4-string E1 = 28 (5-string B0 = 23)
  highestMidi?: number // G4 = 67
  minChordConfidence?: number // chord prior applies from the medium band up
  weights?: Partial<OctaveWeights>
  // Per note id: share of stem energy around the f0 of the octave below (p−12), in [0, 1],
  // computed server-side. High energy there means p is probably a harmonic of p−12.
  lowBandEnergy?: Readonly<Record<string, number>>
}

export const DEFAULT_OCTAVE_WEIGHTS: OctaveWeights = {
  chordRoot: 1,
  smooth: 0.5,
  spectral: 1,
  change: 0.75,
}

// Chord roots are referenced in E1 (28) … D#2 (39); notes up to an octave above that are free.
const ROOT_REGISTER_LOW = 28

function rootReference(segment: ChordSegment | undefined, minConfidence: number): number | null {
  if (segment === undefined || segment.confidence < minConfidence) return null
  const parsed = parseChord(segment.label)
  if (parsed === null || parsed.kind !== 'chord') return null
  const pc = parsed.bassPc ?? parsed.root
  return ROOT_REGISTER_LOW + ((pc - (ROOT_REGISTER_LOW % 12) + 12) % 12)
}

function segmentAt(segments: readonly ChordSegment[], t: number): ChordSegment | undefined {
  return segments.find((s) => s.t0 <= t && t < s.t1)
}

// Returns notes in the input order; unchanged notes keep their object identity.
export function correctBassOctaves(
  notes: readonly Note[],
  segments: readonly ChordSegment[],
  options: OctaveOptions = {},
): Note[] {
  const lowest = options.lowestMidi ?? 28
  const highest = options.highestMidi ?? 67
  const minConfidence = options.minChordConfidence ?? 0.4
  const w = { ...DEFAULT_OCTAVE_WEIGHTS, ...options.weights }
  const order = notes
    .map((_, i) => i)
    .sort((a, b) => (notes[a] as Note).onset_s - (notes[b] as Note).onset_s || a - b)
  if (order.length === 0) return []
  const states = order.map((i) => {
    const note = notes[i] as Note
    const p = note.pitch_midi
    const ref = rootReference(segmentAt(segments, note.onset_s), minConfidence)
    const energy = options.lowBandEnergy?.[note.id]
    return [p - 12, p, p + 12]
      .filter((c) => c === p || (c >= lowest && c <= highest && c >= 21 && c <= 108))
      .map((c) => {
        let cost = c === p ? 0 : w.change
        if (ref !== null)
          cost += (w.chordRoot * (Math.max(0, ref - c) + Math.max(0, c - ref - 12))) / 12
        if (energy !== undefined) cost += w.spectral * (c === p - 12 ? 1 - energy : energy)
        return { pitch: c, cost }
      })
  })
  const totals: number[][] = [(states[0] as { cost: number }[]).map((s) => s.cost)]
  const back: number[][] = [[]]
  for (let k = 1; k < states.length; k++) {
    const prev = states[k - 1] as { pitch: number }[]
    const prevTotals = totals[k - 1] as number[]
    const row: number[] = []
    const ptr: number[] = []
    for (const s of states[k] as { pitch: number; cost: number }[]) {
      let best = Number.POSITIVE_INFINITY
      let arg = 0
      prev.forEach((p, j) => {
        const total = (prevTotals[j] as number) + (w.smooth * Math.abs(s.pitch - p.pitch)) / 12
        if (total < best) {
          best = total
          arg = j
        }
      })
      row.push(best + s.cost)
      ptr.push(arg)
    }
    totals.push(row)
    back.push(ptr)
  }
  const lastTotals = totals.at(-1) as number[]
  let arg = lastTotals.indexOf(Math.min(...lastTotals))
  const out = [...notes]
  for (let k = states.length - 1; k >= 0; k--) {
    const pitch = ((states[k] as { pitch: number }[])[arg] as { pitch: number }).pitch
    const i = order[k] as number
    const note = notes[i] as Note
    if (pitch !== note.pitch_midi) out[i] = { ...note, pitch_midi: pitch }
    arg = (back[k] as number[])[arg] ?? 0
  }
  return out
}
