import { parseChord, pcOfName } from './chordtools.ts'

// Piano voicings for a chord chart (V13: left-hand bass, right-hand block chords from the chord
// labels). The left hand plays the bass (the slash note when there is one) in the octave from C2;
// the right hand plays the chord in close position between E3 and the C above middle C. "smooth"
// picks the inversion that moves least from the previous chord, so shared notes stay put;
// "root" stacks the chord from its root (or its third once the left hand has the root).

export type VoicingStyle = 'smooth' | 'root'

export interface PianoVoicing {
  /** MIDI pitches, low to high. */
  left: number[]
  right: number[]
}

const BASS_FLOOR = 36 // C2
const RIGHT_LOWEST = 52 // E3
const RIGHT_HIGHEST = 72 // C5
const RIGHT_CENTRE = 62 // D4
const MAX_RIGHT = 4

// Which chord tones the right hand drops first when there are too many: root (in the left
// hand), then the fifth, then the highest extensions.
function rightHandTones(intervals: number[], bassIsRoot: boolean): number[] {
  let tones = [...intervals]
  if (bassIsRoot && tones.length >= 4) tones = tones.filter((i) => i !== 0)
  if (tones.length > MAX_RIGHT) tones = tones.filter((i) => i !== 7)
  return tones.slice(0, MAX_RIGHT)
}

// Every close-position stack of the tones in the right hand's range, one per inversion and octave.
function candidates(pcs: number[]): number[][] {
  const out: number[][] = []
  for (let first = 0; first < pcs.length; first++) {
    const order = [...pcs.slice(first), ...pcs.slice(0, first)]
    for (let base = RIGHT_LOWEST; base < RIGHT_LOWEST + 12; base++) {
      if (base % 12 !== order[0]) continue
      for (let octave = 0; base + octave * 12 <= RIGHT_CENTRE + 6; octave++) {
        const stack = [base + octave * 12]
        for (const pc of order.slice(1)) {
          const below = stack.at(-1) as number
          stack.push(below + ((((pc - below) % 12) + 12) % 12 || 12))
        }
        if ((stack.at(-1) as number) <= RIGHT_HIGHEST) out.push(stack)
      }
    }
  }
  return out
}

const centre = (notes: readonly number[]) => notes.reduce((a, b) => a + b, 0) / notes.length

// Total distance from each note to the nearest note of the other chord, both ways.
function movement(from: readonly number[], to: readonly number[]): number {
  const nearest = (n: number, set: readonly number[]) =>
    Math.min(...set.map((m) => Math.abs(m - n)))
  return (
    to.reduce((sum, n) => sum + nearest(n, from), 0) +
    from.reduce((sum, n) => sum + nearest(n, to), 0)
  )
}

/** The voicing of one Harte label; null for N, X and labels it cannot parse. */
export function pianoVoicing(
  label: string,
  options: {
    bass?: string | undefined
    previous?: readonly number[] | null
    style?: VoicingStyle
  } = {},
): PianoVoicing | null {
  const parsed = parseChord(label)
  if (parsed === null || parsed.kind !== 'chord') return null
  const bassPc =
    (options.bass === undefined ? parsed.bassPc : pcOfName(options.bass)) ?? parsed.root
  const intervals = parsed.pitchClasses
    .map((pc) => (pc - parsed.root + 12) % 12)
    .sort((a, b) => a - b)
  const pcs = rightHandTones(intervals, bassPc === parsed.root).map((i) => (parsed.root + i) % 12)
  const all = candidates(pcs)
  const previous = options.previous ?? null
  const style = options.style ?? 'smooth'
  const byCentre = (a: number[], b: number[]) =>
    Math.abs(centre(a) - RIGHT_CENTRE) - Math.abs(centre(b) - RIGHT_CENTRE)
  let right: number[] | undefined
  if (style === 'smooth' && previous && previous.length > 0) {
    right = [...all].sort(
      (a, b) => movement(previous, a) - movement(previous, b) || byCentre(a, b),
    )[0]
  } else {
    const lowest = pcs[0] as number
    right = all.filter((stack) => (stack[0] as number) % 12 === lowest).sort(byCentre)[0]
  }
  return { left: [BASS_FLOOR + bassPc], right: right ?? [] }
}

/** Voicings for a chart's chords in order, each smooth one led from the last one voiced. */
export function voiceChords(
  chords: readonly { label: string; bass?: string | undefined }[],
  style: VoicingStyle,
): (PianoVoicing | null)[] {
  let previous: number[] | null = null
  return chords.map((chord) => {
    const voicing = pianoVoicing(chord.label, { bass: chord.bass, previous, style })
    if (voicing) previous = voicing.right
    return voicing
  })
}
