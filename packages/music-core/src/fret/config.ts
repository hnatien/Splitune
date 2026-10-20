// Fret-assignment configuration (07-music-algorithms.md §5). Guitar weights were tuned in
// Prototype 3 (services/ml/eval/results/p3/); bass weights are the doc's initial values
// plus the guitar's stretch penalty (untuned until a bass tab set exists).

export type FingeringMode = 'easiest' | 'as_played'
export type StringedInstrument = 'guitar' | 'bass'

export interface FretWeights {
  fretHeight: number // × mean fret above the capo
  openString: number // bonus per open string
  span: number // × (max − min) fretted fret; spans above maxSpan are never generated
  handShift: number // × |Δ hand position| in frets, damped by the time available
  handShiftTimeS: number // damping constant: factor = 1 / (1 + Δt / handShiftTimeS)
  stringSkip: number // × strings jumped between consecutive single notes
  chordShape: number // bonus when the notes lie inside a library shape of the current chord
  legato: number // bonus for consecutive single notes on one string within 2 frets
  rootFifth: number // bass: bonus for a fifth (or octave) placed on the next higher string(s)
  stretch: number // per note beyond the four-finger box (index finger + 3 frets)
  handPrior: number // × |hand position − handPositionPrior| when a prior is given
  ringing: number // penalty for re-using a string whose previous note is still sounding
}

export interface FretConfig {
  instrument: StringedInstrument
  tuningMidi: readonly number[] // high → low, string 1 first
  capo: number
  maxFret: number
  maxSpan: number
  mode: FingeringMode
  handPositionPrior?: number
  candidatesPerStep: number
  weights: FretWeights
}

export type FretConfigInput = Partial<Omit<FretConfig, 'weights'>> & {
  weights?: Partial<FretWeights>
}

export const TUNINGS = {
  guitar_standard: [64, 59, 55, 50, 45, 40],
  guitar_drop_d: [64, 59, 55, 50, 45, 38],
  guitar_half_step_down: [63, 58, 54, 49, 44, 39],
  guitar_full_step_down: [62, 57, 53, 48, 43, 38],
  bass4_standard: [43, 38, 33, 28],
  bass5_standard: [43, 38, 33, 28, 23],
} as const satisfies Record<string, readonly number[]>

export const DEFAULT_WEIGHTS: Record<StringedInstrument, Record<FingeringMode, FretWeights>> = {
  guitar: {
    // Beginner bias (D3): open position and open strings; playability terms as tuned for as_played.
    easiest: {
      fretHeight: 0.3,
      openString: 0.5,
      span: 1,
      handShift: 0.8,
      handShiftTimeS: 1,
      stringSkip: 0.2,
      chordShape: 0.7,
      legato: 0,
      rootFifth: 0,
      stretch: 1,
      handPrior: 0.2,
      ringing: 0.3,
    },
    // Tuned in P3 on GuitarSet players 00–02, checked on 03–05 (services/ml/eval/results/p3/).
    as_played: {
      fretHeight: 0,
      openString: -0.2,
      span: 0.2,
      handShift: 1,
      handShiftTimeS: 1,
      stringSkip: 0.2,
      chordShape: 0.3,
      legato: 0.3,
      rootFifth: 0,
      stretch: 1,
      handPrior: 0.2,
      ringing: 0.3,
    },
  },
  bass: {
    easiest: {
      fretHeight: 0.3,
      openString: 0.5,
      span: 1,
      handShift: 1.2,
      handShiftTimeS: 0.5,
      stringSkip: 0.2,
      chordShape: 0,
      legato: 0,
      rootFifth: 0.5,
      stretch: 1,
      handPrior: 0.2,
      ringing: 0,
    },
    as_played: {
      fretHeight: 0.1,
      openString: 0.1,
      span: 0.6,
      handShift: 1.2,
      handShiftTimeS: 0.5,
      stringSkip: 0.2,
      chordShape: 0,
      legato: 0.3,
      rootFifth: 0.5,
      stretch: 1,
      handPrior: 0.2,
      ringing: 0,
    },
  },
}

export const MAX_FRET_LIMIT = 24 // TabEvent.fret ≤ 24
export const MAX_STRINGS = 7 // TabEvent.string ≤ 7

export function fretConfig(input: FretConfigInput = {}): FretConfig {
  const instrument = input.instrument ?? 'guitar'
  const mode = input.mode ?? 'easiest'
  const tuningMidi =
    input.tuningMidi ?? (instrument === 'bass' ? TUNINGS.bass4_standard : TUNINGS.guitar_standard)
  const capo = input.capo ?? 0
  const maxFret = input.maxFret ?? 20
  const maxSpan = input.maxSpan ?? (mode === 'easiest' || instrument === 'bass' ? 4 : 5)
  const candidatesPerStep = input.candidatesPerStep ?? 24
  if (tuningMidi.length < 1 || tuningMidi.length > MAX_STRINGS) {
    throw new RangeError(`tuning must have 1–${MAX_STRINGS} strings`)
  }
  if (!tuningMidi.every((p) => Number.isInteger(p) && p >= 0 && p <= 127)) {
    throw new RangeError('tuning pitches must be MIDI integers')
  }
  if (!Number.isInteger(capo) || capo < 0 || capo > 12) throw new RangeError('capo must be 0–12')
  if (!Number.isInteger(maxFret) || maxFret <= capo || maxFret > MAX_FRET_LIMIT) {
    throw new RangeError(`maxFret must be an integer in (capo, ${MAX_FRET_LIMIT}]`)
  }
  if (!Number.isInteger(maxSpan) || maxSpan < 0)
    throw new RangeError('maxSpan must be a non-negative integer')
  if (!Number.isInteger(candidatesPerStep) || candidatesPerStep < 1) {
    throw new RangeError('candidatesPerStep must be a positive integer')
  }
  const config: FretConfig = {
    instrument,
    tuningMidi: [...tuningMidi],
    capo,
    maxFret,
    maxSpan,
    mode,
    candidatesPerStep,
    weights: { ...DEFAULT_WEIGHTS[instrument][mode], ...input.weights },
  }
  if (input.handPositionPrior !== undefined) config.handPositionPrior = input.handPositionPrior
  return config
}
