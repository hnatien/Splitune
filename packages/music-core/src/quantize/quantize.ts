import {
  type BeatGrid,
  beatLabel,
  minTick,
  PPQ,
  positionOfTick,
  tickToTime,
  timeToTick,
} from '../grid/beatgrid.ts'
import type { DrumHit } from '../types.ts'

export const STRAIGHT_STEP = PPQ / 4 // 1/16
export const SWING_STEP = PPQ / 3 // triplet 1/8

export interface QuantizeOptions {
  chordWindowS?: number // onsets within this window of a group's first onset share one snap
  residualFlagMs?: number
  swingShare?: number // share of off-beat 1/8 onsets nearer 2/3 than 1/2 that marks a swing bar
  minSwingOnsets?: number
  flamWindowS?: number // drums: same-class hits within this window collapse to one flam
}

const DEFAULTS: Required<QuantizeOptions> = {
  chordWindowS: 0.03,
  residualFlagMs: 60,
  swingShare: 0.6,
  minSwingOnsets: 2,
  flamWindowS: 0.025,
}

export interface QuantizeInputNote {
  id: string
  onset_s: number
  offset_s: number
}

export interface QuantizedNote {
  noteId: string
  onTick: number // global tick (see grid/beatgrid.ts)
  offTick: number
  bar: number
  beat: number
  tick: number
  durationTicks: number
  residualMs: number // signed: positive = played after the grid point
  residualFlagged: boolean
}

export interface QuantizeResult {
  notes: QuantizedNote[] // same order as the input
  swingBars: number[]
}

// Position classes within a beat; only the 1/2 and 2/3 classes vote on swing.
const CLASSES = [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1]
const HALF = 3
const TWO_THIRDS = 4

function classify(frac: number): number {
  let best = 0
  for (let i = 1; i < CLASSES.length; i++) {
    if (Math.abs(frac - (CLASSES[i] as number)) < Math.abs(frac - (CLASSES[best] as number)))
      best = i
  }
  return best
}

interface Anchor {
  ft: number // fractional global tick of the group's first onset
  weight: number // notes in the group (swing votes are per note so merging groups is neutral)
}

function beatOf(ft: number): { index: number; frac: number } {
  const index = Math.floor(ft / PPQ)
  return { index, frac: ft / PPQ - index }
}

function detectSwingBars(
  grid: BeatGrid,
  anchors: readonly Anchor[],
  o: Required<QuantizeOptions>,
): Set<number> {
  const votes = new Map<number, { half: number; swing: number }>()
  for (const anchor of anchors) {
    const { index, frac } = beatOf(anchor.ft)
    const cls = classify(frac)
    if (cls !== HALF && cls !== TWO_THIRDS) continue
    const bar = beatLabel(grid, index).bar
    const vote = votes.get(bar) ?? { half: 0, swing: 0 }
    if (cls === HALF) vote.half += anchor.weight
    else vote.swing += anchor.weight
    votes.set(bar, vote)
  }
  const swing = new Set<number>()
  for (const [bar, { half, swing: s }] of votes) {
    if (s >= o.minSwingOnsets && s >= o.swingShare * (half + s)) swing.add(bar)
  }
  return swing
}

function snapTick(
  grid: BeatGrid,
  ft: number,
  swingBars: ReadonlySet<number>,
): { tick: number; step: number } {
  const { index, frac } = beatOf(ft)
  const step = swingBars.has(beatLabel(grid, index).bar) ? SWING_STEP : STRAIGHT_STEP
  return { tick: index * PPQ + Math.round((frac * PPQ) / step) * step, step }
}

interface Grouped {
  order: number[] // input indices sorted by onset
  groupOf: number[] // input index → group index
  anchors: Anchor[]
}

// Anchors before beat 1 of bar -1 are clamped there first, so swing votes and the grid step
// come from the bar the note ends up in.
function groupOnsets(onsets: readonly number[], grid: BeatGrid, windowS: number): Grouped {
  const floor = minTick(grid)
  const order = onsets
    .map((_, i) => i)
    .sort((a, b) => (onsets[a] as number) - (onsets[b] as number) || a - b)
  const groupOf = new Array<number>(onsets.length).fill(0)
  const anchors: Anchor[] = []
  let anchorT = Number.NEGATIVE_INFINITY
  for (const i of order) {
    const t = onsets[i] as number
    if (t - anchorT > windowS + 1e-9) {
      anchorT = t
      anchors.push({ ft: Math.max(floor, timeToTick(grid, t)), weight: 0 })
    }
    const g = anchors.length - 1
    ;(anchors[g] as Anchor).weight++
    groupOf[i] = g
  }
  return { order, groupOf, anchors }
}

// Onsets snap to the 1/16 grid (triplet 1/8 in swing bars) of the beat grid; chord tones within
// `chordWindowS` share their group's snap. Offsets snap the same way, minimum one grid step.
// Idempotent: re-quantizing tickToTime() of the output reproduces it.
export function quantizeNotes(
  notes: readonly QuantizeInputNote[],
  grid: BeatGrid,
  options: QuantizeOptions = {},
): QuantizeResult {
  const o = { ...DEFAULTS, ...options }
  const { groupOf, anchors } = groupOnsets(
    notes.map((n) => n.onset_s),
    grid,
    o.chordWindowS,
  )
  const swingBars = detectSwingBars(grid, anchors, o)
  const snapped = anchors.map((a) => snapTick(grid, a.ft, swingBars))
  const out = notes.map((note, i): QuantizedNote => {
    const { tick: onTick, step } = snapped[groupOf[i] as number] as { tick: number; step: number }
    const off = snapTick(grid, timeToTick(grid, Math.max(note.offset_s, note.onset_s)), swingBars)
    const offTick = Math.max(off.tick, onTick + step)
    const residualMs = (note.onset_s - tickToTime(grid, onTick)) * 1000
    const position = positionOfTick(grid, onTick)
    return {
      noteId: note.id,
      onTick,
      offTick,
      ...position,
      durationTicks: offTick - onTick,
      residualMs,
      residualFlagged: Math.abs(residualMs) > o.residualFlagMs,
    }
  })
  return { notes: out, swingBars: [...swingBars].sort((a, b) => a - b) }
}

export interface QuantizedHit {
  hitId: string
  mergedIds: string[] // later hits of a flam folded into this one
  class5: DrumHit['class5']
  gmNote: number
  onTick: number
  bar: number
  beat: number
  tick: number
  residualMs: number
  residualFlagged: boolean
  flam: boolean
}

// Drums: same grid as pitched parts; two hits of one class within `flamWindowS` become one flam.
export function quantizeDrumHits(
  hits: readonly DrumHit[],
  grid: BeatGrid,
  options: QuantizeOptions = {},
): { hits: QuantizedHit[]; swingBars: number[] } {
  const o = { ...DEFAULTS, ...options }
  const sorted = [...hits].sort((a, b) => a.onset_s - b.onset_s || a.id.localeCompare(b.id))
  const kept: { hit: DrumHit; merged: string[] }[] = []
  const lastByClass = new Map<string, { hit: DrumHit; merged: string[] }>()
  for (const hit of sorted) {
    const previous = lastByClass.get(hit.class5)
    if (
      previous !== undefined &&
      previous.merged.length === 0 &&
      hit.onset_s - previous.hit.onset_s <= o.flamWindowS
    ) {
      previous.merged.push(hit.id)
      continue
    }
    const entry = { hit, merged: [] as string[] }
    kept.push(entry)
    lastByClass.set(hit.class5, entry)
  }
  const floor = minTick(grid)
  const anchors = kept.map((k) => ({
    ft: Math.max(floor, timeToTick(grid, k.hit.onset_s)),
    weight: 1,
  }))
  const swingBars = detectSwingBars(grid, anchors, o)
  const out = kept.map(({ hit, merged }, i): QuantizedHit => {
    const onTick = snapTick(grid, (anchors[i] as Anchor).ft, swingBars).tick
    const residualMs = (hit.onset_s - tickToTime(grid, onTick)) * 1000
    return {
      hitId: hit.id,
      mergedIds: merged,
      class5: hit.class5,
      gmNote: hit.gm_note,
      onTick,
      ...positionOfTick(grid, onTick),
      residualMs,
      residualFlagged: Math.abs(residualMs) > o.residualFlagMs,
      flam: merged.length > 0,
    }
  })
  return { hits: out, swingBars: [...swingBars].sort((a, b) => a - b) }
}

// Snaps one time (e.g. a chord change) to the grid used for notes, given their swing bars.
export function snapTimeToGrid(grid: BeatGrid, t: number, swingBars: readonly number[]): number {
  return snapTick(grid, Math.max(minTick(grid), timeToTick(grid, t)), new Set(swingBars)).tick
}
