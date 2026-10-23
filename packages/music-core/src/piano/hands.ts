import { PPQ } from '../grid/beatgrid.ts'

// Left/right hand assignment for transcribed piano notes (21 V4: the roll and staff colour and
// label each hand). A moving split point: notes below it go to the left hand. The split is
// chosen per onset group by Viterbi over every split pitch, trading off
// - reach: each hand's span beyond an octave, and more than five notes in one hand;
// - steadiness: moving the split costs more the sooner the next group comes;
// - habit: a mild pull towards middle C, which decides when nothing else does.
// A heuristic stand-in for a learned hand model (PM2S in 21 V4); its output is a display hint
// the learner can correct like any other mark.

export type Hand = 'left' | 'right'

export interface HandInputNote {
  id: string
  pitch: number // MIDI
  onTick: number // quantized onset; notes sharing it form one group
}

export interface HandSplitOptions {
  reach?: number // semitones one hand covers without cost
  reachCost?: number // per semitone beyond `reach`
  crowdCost?: number // per note beyond five in one hand
  moveCost?: number // per octave the split moves between groups a beat apart
  habitCost?: number // per octave between the split and middle C
}

const DEFAULTS: Required<HandSplitOptions> = {
  reach: 12,
  reachCost: 1,
  crowdCost: 10,
  moveCost: 2,
  habitCost: 0.25,
}

const MIDDLE_C = 60
// Split pitches: a note goes left when its pitch is below the split. 21 = all right, 109 = all left.
const LOWEST_SPLIT = 21
const HIGHEST_SPLIT = 109
const FINGERS = 5

function handCost(pitches: readonly number[], o: Required<HandSplitOptions>): number {
  if (pitches.length === 0) return 0
  const span = (pitches.at(-1) as number) - (pitches[0] as number)
  return (
    Math.max(0, span - o.reach) * o.reachCost + Math.max(0, pitches.length - FINGERS) * o.crowdCost
  )
}

// Cost of each split for one group (pitches sorted low to high).
function groupCosts(pitches: readonly number[], o: Required<HandSplitOptions>): Float64Array {
  // Splits only differ by how many notes fall below them: price each cut once.
  const byCut = Array.from(
    { length: pitches.length + 1 },
    (_, cut) => handCost(pitches.slice(0, cut), o) + handCost(pitches.slice(cut), o),
  )
  const costs = new Float64Array(HIGHEST_SPLIT - LOWEST_SPLIT + 1)
  let cut = 0 // pitches[0..cut) are below the split
  for (let s = LOWEST_SPLIT; s <= HIGHEST_SPLIT; s++) {
    while (cut < pitches.length && (pitches[cut] as number) < s) cut++
    costs[s - LOWEST_SPLIT] = (byCut[cut] as number) + (Math.abs(s - MIDDLE_C) / 12) * o.habitCost
  }
  return costs
}

export function splitHands(
  notes: readonly HandInputNote[],
  options: HandSplitOptions = {},
): Map<string, Hand> {
  const o = { ...DEFAULTS, ...options }
  const byTick = new Map<number, HandInputNote[]>()
  for (const n of notes) byTick.set(n.onTick, [...(byTick.get(n.onTick) ?? []), n])
  const ticks = [...byTick.keys()].sort((a, b) => a - b)
  const groups = ticks.map((t) =>
    [...(byTick.get(t) as HandInputNote[])].sort((a, b) => a.pitch - b.pitch),
  )
  const states = HIGHEST_SPLIT - LOWEST_SPLIT + 1
  const back: Int16Array[] = []
  let total: Float64Array = new Float64Array(states)
  groups.forEach((group, g) => {
    const own = groupCosts(
      group.map((n) => n.pitch),
      o,
    )
    if (g === 0) {
      total = own
      return
    }
    const beats = ((ticks[g] as number) - (ticks[g - 1] as number)) / PPQ
    const move = o.moveCost / 12 / (1 + beats)
    // min over p of total[p] + |s - p| * move, as two linear sweeps (staying wins ties).
    const next = Float64Array.from(total)
    const from = Int16Array.from({ length: states }, (_, s) => s)
    for (let s = 1; s < states; s++) {
      const carried = (next[s - 1] as number) + move
      if (carried < (next[s] as number) - 1e-12) {
        next[s] = carried
        from[s] = from[s - 1] as number
      }
    }
    for (let s = states - 2; s >= 0; s--) {
      const carried = (next[s + 1] as number) + move
      if (carried < (next[s] as number) - 1e-12) {
        next[s] = carried
        from[s] = from[s + 1] as number
      }
    }
    for (let s = 0; s < states; s++) next[s] = (next[s] as number) + (own[s] as number)
    back.push(from)
    total = next
  })
  // Ties go to the split nearest middle C, then the lower one.
  let state = 0
  for (let s = 1; s < states; s++) {
    const d = (total[s] as number) - (total[state] as number)
    const nearer = Math.abs(s + LOWEST_SPLIT - MIDDLE_C) < Math.abs(state + LOWEST_SPLIT - MIDDLE_C)
    if (d < -1e-9 || (Math.abs(d) <= 1e-9 && nearer)) state = s
  }
  const hands = new Map<string, Hand>()
  for (let g = groups.length - 1; g >= 0; g--) {
    const split = state + LOWEST_SPLIT
    for (const n of groups[g] as HandInputNote[]) {
      hands.set(n.id, n.pitch < split ? 'left' : 'right')
    }
    if (g > 0) state = (back[g - 1] as Int16Array)[state] as number
  }
  return hands
}
