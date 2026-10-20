import { chordShapes, transposeChord, tuningOffset } from '../harmony/chordtools.ts'
import type { AltFingering } from '../types.ts'
import type { FretConfig, FretWeights } from './config.ts'

// Fret assignment as a min-cost path over quantized steps (07-music-algorithms.md §5). Each step
// is one onset (a single note or a chord); a candidate assigns every note of the step to a
// distinct string with a playable fret. Frets are absolute (from the nut): with a capo, the capo
// fret plays as an open string and lower frets are unavailable.
//
// The DP state is (candidate, hand position p): the index finger sits at fret p and the fingers
// cover p … p+3, with one stretch to p+4 (maxSpan 4). Open strings fit any position, so the hand
// position carries through open notes, and moving within a box costs nothing — guitarists play in
// positions (P3: 96–99% of consecutive GuitarSet notes stay within 3 frets).

export interface FretNote {
  id: string
  pitch: number // sounding MIDI pitch
  endTime?: number // seconds; lets the DP avoid cutting off a string that is still ringing
  pin?: { string: number; fret: number } // user correction (set_note string/fret)
}

export interface FretStep {
  time: number // seconds
  notes: readonly FretNote[]
  chord?: string // sounding Harte label at this step, for the shape prior
}

export interface FretAssignment {
  noteId: string
  string?: number // 1 = highest-pitched string
  fret?: number
  soundingPitch: number // the pitch actually placed (an octave off when unplayable)
  unplayable: boolean // out of range (moved by octaves) or not placeable within the span
  altFingerings: AltFingering[]
}

interface Position {
  string: number // 1-based
  fret: number
}

interface PreparedNote {
  note: FretNote
  pitch: number
  outOfRange: boolean
  positions: Position[]
}

interface Candidate {
  positions: (Position | null)[] // aligned with the step's notes; null = dropped
  local: number
  minFret: number | null // fretted notes only; null when everything is open or dropped
  maxFret: number | null
  single: { string: number; fret: number; pitch: number } | null
  strings: number // bitmask of used strings
}

interface StepStates {
  candidate: Int32Array
  position: Int32Array
  local: Float64Array
}

const MAX_OCTAVE_SHIFT = 4
const ALTERNATIVES = 2
const BOX = 3 // frets the four fingers cover beyond the index finger without a stretch
const OPEN_POSITIONS = 12 // hand positions considered while only open strings sound

function positionsFor(pitch: number, config: FretConfig): Position[] {
  const out: Position[] = []
  config.tuningMidi.forEach((open, s) => {
    const fret = pitch - open
    if (fret >= config.capo && fret <= config.maxFret) out.push({ string: s + 1, fret })
  })
  return out
}

function prepare(note: FretNote, config: FretConfig): PreparedNote {
  const positions = positionsFor(note.pitch, config)
  if (positions.length > 0) {
    const pin = note.pin
    const pinned =
      pin === undefined
        ? undefined
        : positions.find((p) => p.string === pin.string && p.fret === pin.fret)
    return {
      note,
      pitch: note.pitch,
      outOfRange: false,
      positions: pinned === undefined ? positions : [pinned],
    }
  }
  for (let k = 1; k <= MAX_OCTAVE_SHIFT; k++) {
    for (const pitch of [note.pitch - 12 * k, note.pitch + 12 * k]) {
      const shifted = positionsFor(pitch, config)
      if (shifted.length > 0) return { note, pitch, outOfRange: true, positions: shifted }
    }
  }
  return { note, pitch: note.pitch, outOfRange: true, positions: [] }
}

// Shapes of the step's chord as sets of "string:absoluteFret", or none when the tuning is not a
// uniform shift of standard tuning.
function shapeSets(
  label: string | undefined,
  config: FretConfig,
  cache: Map<string, Set<string>[]>,
): Set<string>[] {
  if (label === undefined || config.weights.chordShape === 0) return []
  const cached = cache.get(label)
  if (cached !== undefined) return cached
  const offset = tuningOffset(config.tuningMidi)
  let sets: Set<string>[] = []
  if (offset !== null) {
    try {
      const shapesKey = transposeChord(label, -(config.capo + offset))
      sets = chordShapes(shapesKey).map(
        (shape) =>
          new Set(
            shape.frets.flatMap((fret, i) =>
              fret === null ? [] : [`${i + 1}:${fret + config.capo}`],
            ),
          ),
      )
    } catch {
      sets = [] // unparseable label: no shape prior
    }
  }
  cache.set(label, sets)
  return sets
}

function localCost(
  positions: readonly (Position | null)[],
  pitches: readonly number[],
  config: FretConfig,
  shapes: readonly Set<string>[],
): Candidate {
  const w = config.weights
  let count = 0
  let heightSum = 0
  let open = 0
  let fretted = 0
  let minFret = Number.POSITIVE_INFINITY
  let maxFret = Number.NEGATIVE_INFINITY
  let strings = 0
  let single: Candidate['single'] = null
  positions.forEach((p, i) => {
    if (p === null) return
    count++
    strings |= 1 << p.string
    const rel = p.fret - config.capo
    heightSum += rel
    if (rel === 0) open++
    else {
      fretted++
      minFret = Math.min(minFret, p.fret)
      maxFret = Math.max(maxFret, p.fret)
    }
    single = { string: p.string, fret: p.fret, pitch: pitches[i] as number }
  })
  if (count !== 1) single = null
  let local = 0
  if (count > 0) {
    local += w.fretHeight * (heightSum / count) - w.openString * open
    if (fretted > 0) local += w.span * (maxFret - minFret)
    if (shapes.length > 0) {
      const keys = positions.flatMap((p) => (p === null ? [] : [`${p.string}:${p.fret}`]))
      if (shapes.some((set) => keys.every((k) => set.has(k)))) local -= w.chordShape
    }
  }
  return {
    positions: [...positions],
    local,
    minFret: fretted > 0 ? minFret : null,
    maxFret: fretted > 0 ? maxFret : null,
    single,
    strings,
  }
}

// All assignments of `subset` (indices into notes) to distinct strings within the span limit.
function enumerate(
  notes: readonly PreparedNote[],
  subset: readonly number[],
  config: FretConfig,
  shapes: readonly Set<string>[],
  out: Candidate[],
): void {
  const order = [...subset].sort(
    (a, b) =>
      (notes[a] as PreparedNote).positions.length - (notes[b] as PreparedNote).positions.length ||
      a - b,
  )
  const current: (Position | null)[] = notes.map(() => null)
  const pitches = notes.map((n) => n.pitch)
  const walk = (depth: number, used: number, lo: number, hi: number): void => {
    if (depth === order.length) {
      out.push(localCost(current, pitches, config, shapes))
      return
    }
    const index = order[depth] as number
    for (const p of (notes[index] as PreparedNote).positions) {
      if (used & (1 << p.string)) continue
      let nlo = lo
      let nhi = hi
      if (p.fret > config.capo) {
        nlo = Math.min(lo, p.fret)
        nhi = Math.max(hi, p.fret)
        if (nhi - nlo > config.maxSpan) continue
      }
      current[index] = p
      walk(depth + 1, used | (1 << p.string), nlo, nhi)
      current[index] = null
    }
  }
  walk(0, 0, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY)
}

function combinations(n: number, k: number): number[][] {
  const out: number[][] = []
  const pick = (start: number, acc: number[]): void => {
    if (acc.length === k) {
      out.push([...acc])
      return
    }
    for (let i = start; i < n; i++) pick(i + 1, [...acc, i])
  }
  pick(0, [])
  return out
}

// Order in which notes are kept when a chord cannot be played whole: lowest and highest first,
// then inward (bass and melody matter most).
function keepPriority(indices: readonly number[], notes: readonly PreparedNote[]): number[] {
  const byPitch = [...indices].sort(
    (a, b) => (notes[a] as PreparedNote).pitch - (notes[b] as PreparedNote).pitch || a - b,
  )
  const out: number[] = []
  let lo = 0
  let hi = byPitch.length - 1
  while (lo <= hi) {
    out.push(byPitch[lo++] as number)
    if (lo <= hi) out.push(byPitch[hi--] as number)
  }
  return out
}

function stepCandidates(
  notes: readonly PreparedNote[],
  config: FretConfig,
  shapes: readonly Set<string>[],
): Candidate[] {
  const placeable = notes.flatMap((n, i) => (n.positions.length > 0 ? [i] : []))
  const priority = keepPriority(placeable, notes).slice(0, config.tuningMidi.length)
  for (let keep = priority.length; keep > 0; keep--) {
    const out: Candidate[] = []
    // Subsets of size `keep`, preferring ones that keep higher-priority notes.
    for (const combo of combinations(priority.length, keep)) {
      enumerate(
        notes,
        combo.map((i) => priority[i] as number),
        config,
        shapes,
        out,
      )
    }
    if (out.length > 0) {
      const sorted = out
        .map((c, i) => ({ c, i }))
        .sort((a, b) => a.c.local - b.c.local || a.i - b.i)
        .map((x) => x.c)
      return sorted.slice(0, config.candidatesPerStep)
    }
  }
  return [
    localCost(
      notes.map(() => null),
      [],
      config,
      [],
    ),
  ]
}

// Candidate-to-candidate part of a transition; the hand-position shift is added per state.
function transition(
  prev: Candidate,
  prevStep: readonly PreparedNote[],
  next: Candidate,
  w: FretWeights,
  nextTime: number,
): number {
  let cost = 0
  const a = prev.single
  const b = next.single
  if (a !== null && b !== null) {
    cost += w.stringSkip * Math.max(0, Math.abs(a.string - b.string) - 1)
    if (a.string === b.string && Math.abs(a.fret - b.fret) <= 2) cost -= w.legato
    const interval = b.pitch - a.pitch
    if (
      (interval === 7 && b.string === a.string - 1) ||
      (interval === 12 && b.string === a.string - 2)
    ) {
      cost -= w.rootFifth
    }
  }
  if (w.ringing > 0) {
    prev.positions.forEach((p, i) => {
      const end = prevStep[i]?.note.endTime
      if (p !== null && end !== undefined && end > nextTime && next.strings & (1 << p.string))
        cost += w.ringing
    })
  }
  return cost
}

// Hand positions a candidate can be played from, with the stretch and prior costs of each.
function statesFor(candidates: readonly Candidate[], config: FretConfig): StepStates {
  const w = config.weights
  const lowest = config.capo + 1
  const cand: number[] = []
  const pos: number[] = []
  const local: number[] = []
  candidates.forEach((c, ci) => {
    const from = c.maxFret === null ? lowest : Math.max(lowest, c.maxFret - config.maxSpan)
    const to =
      c.minFret === null ? Math.min(config.maxFret, lowest + OPEN_POSITIONS - 1) : c.minFret
    for (let p = from; p <= to; p++) {
      let cost = c.local
      for (const position of c.positions) {
        if (position !== null && position.fret > config.capo && position.fret - p > BOX)
          cost += w.stretch
      }
      if (config.handPositionPrior !== undefined) {
        cost += w.handPrior * Math.abs(p - config.handPositionPrior)
      }
      cand.push(ci)
      pos.push(p)
      local.push(cost)
    }
  })
  return {
    candidate: Int32Array.from(cand),
    position: Int32Array.from(pos),
    local: Float64Array.from(local),
  }
}

export function assignFrets(steps: readonly FretStep[], config: FretConfig): FretAssignment[][] {
  const shapeCache = new Map<string, Set<string>[]>()
  const prepared = steps.map((step) => step.notes.map((n) => prepare(n, config)))
  const candidates = steps.map((step, i) =>
    stepCandidates(
      prepared[i] as PreparedNote[],
      config,
      shapeSets(step.chord, config, shapeCache),
    ),
  )
  const n = steps.length
  if (n === 0) return []
  const w = config.weights
  const states = candidates.map((c) => statesFor(c, config))
  // trans[i]: candidate transition costs from step i-1 to step i, row-major [prev * cur].
  const trans: Float64Array[] = [new Float64Array(0)]
  const shiftWeight: number[] = [0]
  for (let i = 1; i < n; i++) {
    const prevC = candidates[i - 1] as Candidate[]
    const curC = candidates[i] as Candidate[]
    const time = (steps[i] as FretStep).time
    const t = new Float64Array(prevC.length * curC.length)
    prevC.forEach((p, pi) => {
      curC.forEach((c, ci) => {
        t[pi * curC.length + ci] = transition(p, prepared[i - 1] as PreparedNote[], c, w, time)
      })
    })
    trans.push(t)
    const dt = Math.max(0, time - (steps[i - 1] as FretStep).time)
    shiftWeight.push(w.handShift / (1 + dt / w.handShiftTimeS))
  }
  // Forward pass (min-sum) with back pointers, then a backward pass for per-state through-costs,
  // which rank the alternative fingerings.
  const fwd: Float64Array[] = [Float64Array.from((states[0] as StepStates).local)]
  const back: Int32Array[] = [new Int32Array((states[0] as StepStates).local.length).fill(-1)]
  for (let i = 1; i < n; i++) {
    const prev = states[i - 1] as StepStates
    const cur = states[i] as StepStates
    const width = (candidates[i] as Candidate[]).length
    const t = trans[i] as Float64Array
    const shift = shiftWeight[i] as number
    const prevF = fwd[i - 1] as Float64Array
    const f = new Float64Array(cur.local.length)
    const b = new Int32Array(cur.local.length)
    for (let s = 0; s < cur.local.length; s++) {
      const c = cur.candidate[s] as number
      const p = cur.position[s] as number
      let best = Number.POSITIVE_INFINITY
      let arg = 0
      for (let q = 0; q < prev.local.length; q++) {
        const total =
          (prevF[q] as number) +
          (t[(prev.candidate[q] as number) * width + c] as number) +
          shift * Math.abs(p - (prev.position[q] as number))
        if (total < best) {
          best = total
          arg = q
        }
      }
      f[s] = best + (cur.local[s] as number)
      b[s] = arg
    }
    fwd.push(f)
    back.push(b)
  }
  const bwd: Float64Array[] = new Array(n)
  bwd[n - 1] = new Float64Array((states[n - 1] as StepStates).local.length)
  for (let i = n - 2; i >= 0; i--) {
    const cur = states[i] as StepStates
    const next = states[i + 1] as StepStates
    const width = (candidates[i + 1] as Candidate[]).length
    const t = trans[i + 1] as Float64Array
    const shift = shiftWeight[i + 1] as number
    const nextB = bwd[i + 1] as Float64Array
    const out = new Float64Array(cur.local.length)
    for (let s = 0; s < cur.local.length; s++) {
      const c = cur.candidate[s] as number
      const p = cur.position[s] as number
      let best = Number.POSITIVE_INFINITY
      for (let q = 0; q < next.local.length; q++) {
        const total =
          (t[c * width + (next.candidate[q] as number)] as number) +
          shift * Math.abs((next.position[q] as number) - p) +
          (next.local[q] as number) +
          (nextB[q] as number)
        if (total < best) best = total
      }
      out[s] = best
    }
    bwd[i] = out
  }
  // Backtrack the optimum.
  const last = fwd[n - 1] as Float64Array
  let arg = 0
  for (let s = 1; s < last.length; s++) if ((last[s] as number) < (last[arg] as number)) arg = s
  const optimum = last[arg] as number
  const chosen = new Array<number>(n)
  for (let i = n - 1; i >= 0; i--) {
    chosen[i] = (states[i] as StepStates).candidate[arg] as number
    arg = (back[i] as Int32Array)[arg] as number
  }
  return steps.map((_, i) => {
    const curC = candidates[i] as Candidate[]
    const st = states[i] as StepStates
    const through = curC.map(() => Number.POSITIVE_INFINITY)
    for (let s = 0; s < st.local.length; s++) {
      const c = st.candidate[s] as number
      const total =
        ((fwd[i] as Float64Array)[s] as number) + ((bwd[i] as Float64Array)[s] as number)
      if (total < (through[c] as number)) through[c] = total
    }
    const ranked = curC
      .map((_, ci) => ci)
      .sort((a, b) => (through[a] as number) - (through[b] as number) || a - b)
    const pick = curC[chosen[i] as number] as Candidate
    return (prepared[i] as PreparedNote[]).map((note, ni): FretAssignment => {
      const position = pick.positions[ni] ?? null
      const alts: AltFingering[] = []
      const seen = new Set<string>(position === null ? [] : [`${position.string}:${position.fret}`])
      for (const ci of ranked) {
        if (alts.length >= ALTERNATIVES) break
        const p = (curC[ci] as Candidate).positions[ni]
        if (p === null || p === undefined || seen.has(`${p.string}:${p.fret}`)) continue
        seen.add(`${p.string}:${p.fret}`)
        alts.push({
          string: p.string,
          fret: p.fret,
          cost: Math.max(0, Math.round(((through[ci] as number) - optimum) * 1000) / 1000),
        })
      }
      const assignment: FretAssignment = {
        noteId: note.note.id,
        soundingPitch: note.pitch,
        unplayable: note.outOfRange || position === null,
        altFingerings: alts,
      }
      if (position !== null) {
        assignment.string = position.string
        assignment.fret = position.fret
      }
      return assignment
    })
  })
}

// Groups notes whose onsets lie within `windowS` of the group's first onset into steps (used
// when no beat grid is available, e.g. the P3 evaluation on ground-truth notes).
export function groupIntoSteps<T extends { onset_s: number }>(
  notes: readonly T[],
  windowS = 0.03,
): T[][] {
  const sorted = [...notes].sort((a, b) => a.onset_s - b.onset_s)
  const groups: T[][] = []
  let anchor = Number.NEGATIVE_INFINITY
  for (const note of sorted) {
    if (note.onset_s - anchor > windowS + 1e-9) {
      anchor = note.onset_s
      groups.push([])
    }
    ;(groups.at(-1) as T[]).push(note)
  }
  return groups
}
