import type { Beat, Beats } from '../types.ts'

export const PPQ = 960

// Global ticks count from the first beat of the grid (tick 0); beat i starts at i * PPQ. Beats
// before the first and after the last are extrapolated with the nearest interval, so ticks and
// bar/beat labels exist for pickups and fade-outs too.
export interface BeatGrid {
  readonly times: readonly number[] // strictly increasing, length >= 2
  readonly bars: readonly number[] // bar_index per beat (pickup = -1)
  readonly beatInBar: readonly number[] // 1-based
  readonly beatsPerBar: number // nominal bar length used for extrapolation
}

export interface GridPosition {
  bar: number
  beat: number // 1-based
  tick: number // 0..PPQ-1
}

function modalBarLength(isDownbeat: readonly boolean[], fallback: number): number {
  const counts = new Map<number, number>()
  let last = -1
  for (let i = 0; i < isDownbeat.length; i++) {
    if (!isDownbeat[i]) continue
    if (last >= 0) counts.set(i - last, (counts.get(i - last) ?? 0) + 1)
    last = i
  }
  let best = fallback
  let bestCount = 0
  for (const [length, count] of [...counts].sort((a, b) => a[0] - b[0])) {
    if (count > bestCount) {
      best = length
      bestCount = count
    }
  }
  return best
}

// Derives bar_index/beat_in_bar from downbeats (meter only fills gaps). Beats before the first
// downbeat form a pickup bar (-1); when there are a full bar's worth or more of them, earlier
// downbeats are inferred every `beatsPerBar` beats so labels stay within the contract.
export function labelBeats(
  isDownbeat: readonly boolean[],
  beatsPerBar: number,
): { bars: number[]; beatInBar: number[]; isDownbeat: boolean[] } {
  const flags = [...isDownbeat]
  const n = flags.length
  let first = flags.indexOf(true)
  if (first < 0) {
    for (let i = 0; i < n; i += beatsPerBar) flags[i] = true
    first = 0
  }
  while (first >= beatsPerBar) {
    first -= beatsPerBar
    flags[first] = true
  }
  const bars: number[] = []
  const beatInBar: number[] = []
  for (let i = 0; i < first; i++) {
    bars.push(-1)
    beatInBar.push(beatsPerBar - first + i + 1)
  }
  let bar = -1
  let beat = 0
  for (let i = first; i < n; i++) {
    if (flags[i]) {
      bar++
      beat = 1
    } else {
      beat++
    }
    bars.push(bar)
    beatInBar.push(beat)
  }
  return { bars, beatInBar, isDownbeat: flags }
}

export function createBeatGrid(beats: Beats): BeatGrid {
  const sorted = [...beats.beats].sort((a, b) => a.t - b.t)
  const distinct: Beat[] = []
  for (const beat of sorted) {
    const prev = distinct.at(-1)
    if (prev === undefined || beat.t > prev.t) distinct.push(beat)
  }
  const numerator = beats.meter.numerator
  if (distinct.length < 2) {
    // Too few detected beats: synthesise a constant-tempo grid from bpm and the first downbeat.
    const period = 60 / beats.bpm
    const start = distinct[0]?.t ?? beats.first_downbeat_t
    const count = Math.max(2, Math.ceil((beats.duration_s - start) / period) + 1)
    const times = Array.from({ length: count }, (_, i) => start + i * period)
    const labels = labelBeats(
      times.map((_, i) => i % numerator === 0),
      numerator,
    )
    return { times, bars: labels.bars, beatInBar: labels.beatInBar, beatsPerBar: numerator }
  }
  const isDownbeat = distinct.map((b) => b.is_downbeat)
  const beatsPerBar = modalBarLength(isDownbeat, numerator)
  const labels = labelBeats(isDownbeat, beatsPerBar)
  return {
    times: distinct.map((b) => b.t),
    bars: labels.bars,
    beatInBar: labels.beatInBar,
    beatsPerBar,
  }
}

function at(values: readonly number[], i: number): number {
  const value = values[i]
  if (value === undefined) throw new RangeError(`beat index ${i} out of range`)
  return value
}

// Time of beat index i, extrapolating outside the detected beats.
export function beatTime(grid: BeatGrid, i: number): number {
  const { times } = grid
  const n = times.length
  if (i < 0) return at(times, 0) + i * (at(times, 1) - at(times, 0))
  if (i >= n) return at(times, n - 1) + (i - n + 1) * (at(times, n - 1) - at(times, n - 2))
  return at(times, i)
}

export function timeToTick(grid: BeatGrid, t: number): number {
  const { times } = grid
  const n = times.length
  let i: number
  if (t < at(times, 0)) i = 0
  else if (t >= at(times, n - 1)) i = n - 2
  else {
    let lo = 0
    let hi = n - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (at(times, mid) <= t) lo = mid
      else hi = mid
    }
    i = lo
  }
  const t0 = at(times, i)
  const t1 = at(times, i + 1)
  return (i + (t - t0) / (t1 - t0)) * PPQ
}

export function tickToTime(grid: BeatGrid, tick: number): number {
  const i = Math.floor(tick / PPQ)
  const frac = tick / PPQ - i
  const t0 = beatTime(grid, i)
  return frac === 0 ? t0 : t0 + frac * (beatTime(grid, i + 1) - t0)
}

// Bar/beat label of beat index i (real or extrapolated).
export function beatLabel(grid: BeatGrid, i: number): { bar: number; beat: number } {
  const n = grid.times.length
  const B = grid.beatsPerBar
  if (i >= 0 && i < n) return { bar: at(grid.bars, i), beat: at(grid.beatInBar, i) }
  if (i >= n) {
    const index = at(grid.beatInBar, n - 1) - 1 + (i - n + 1)
    const lastBarLength = Math.max(B, at(grid.beatInBar, n - 1))
    const offset = Math.floor(index / lastBarLength)
    return {
      bar: at(grid.bars, n - 1) + offset,
      beat: (index % lastBarLength) + 1,
    }
  }
  const index = at(grid.beatInBar, 0) - 1 + i
  if (index >= 0) return { bar: at(grid.bars, 0), beat: index + 1 }
  return {
    bar: at(grid.bars, 0) + Math.floor(index / B),
    beat: (((index % B) + B) % B) + 1,
  }
}

// Earliest representable tick: beat 1 of bar -1 (TabEvent.bar >= -1).
export function minTick(grid: BeatGrid): number {
  const first = beatLabel(grid, 0)
  return -(first.beat - 1 + (first.bar + 1) * grid.beatsPerBar) * PPQ
}

export function positionOfTick(grid: BeatGrid, tick: number): GridPosition {
  const i = Math.floor(tick / PPQ)
  const { bar, beat } = beatLabel(grid, i)
  return { bar, beat, tick: tick - i * PPQ }
}

// Beat index of the downbeat that starts the bar containing beat i, and that bar's length.
export function barOfBeat(grid: BeatGrid, i: number): { start: number; length: number } {
  const start = i - (beatLabel(grid, i).beat - 1)
  let length = 1
  while (beatLabel(grid, start + length).beat !== 1) length++
  return { start, length }
}

export type SnapDirection = 'nearest' | 'floor' | 'ceil'

export interface SnapResult {
  t: number
  bar: number
  beat: number
}

// Loop snapping (ux/practice-tool-patterns.md Pattern 1). With `pickup`, a time inside the last
// beat of a bar snaps to that beat (the anacrusis) instead of to a downbeat.
export function snapToBar(
  grid: BeatGrid,
  t: number,
  options: { direction?: SnapDirection; pickup?: boolean } = {},
): SnapResult {
  const direction = options.direction ?? 'nearest'
  const tick = timeToTick(grid, t)
  const i = Math.floor(tick / PPQ)
  const { start, length } = barOfBeat(grid, i)
  if (options.pickup === true && length > 1 && i === start + length - 1) {
    return { t: beatTime(grid, i), ...beatLabel(grid, i) }
  }
  const startT = beatTime(grid, start)
  const endT = beatTime(grid, start + length)
  let target: number
  if (direction === 'floor' || t === startT) target = start
  else if (direction === 'ceil') target = start + length
  else target = t - startT <= endT - t ? start : start + length
  return { t: beatTime(grid, target), ...beatLabel(grid, target) }
}

// --- Beat-grid corrections (applied to the Beats artefact; see corrections/apply.ts) ---

function withBeats(beats: Beats, list: Beat[], bpm: number, beatsPerBar: number): Beats {
  const labels = labelBeats(
    list.map((b) => b.is_downbeat),
    beatsPerBar,
  )
  const relabelled = list.map((b, i) => ({
    ...b,
    is_downbeat: labels.isDownbeat[i] === true,
    bar_index: at(labels.bars, i),
    beat_in_bar: at(labels.beatInBar, i),
  }))
  const firstDownbeat = relabelled.find((b) => b.is_downbeat)
  return {
    ...beats,
    beats: relabelled,
    bpm,
    first_downbeat_t: firstDownbeat?.t ?? beats.first_downbeat_t,
  }
}

function sortedBeats(beats: Beats): Beat[] {
  return [...beats.beats].sort((a, b) => a.t - b.t)
}

// Periodic downbeats every `period` beats, phase-locked to beat index `anchor`.
function periodicDownbeats(list: Beat[], anchor: number, period: number): Beat[] {
  return list.map((b, i) => ({
    ...b,
    is_downbeat: (((i - anchor) % period) + period) % period === 0,
  }))
}

// `double` inserts a beat at the midpoint of every interval; `half` drops every second beat,
// keeping the first downbeat. Bars keep the meter's beat count, phase-locked to the first downbeat.
export function tempoOctave(beats: Beats, factor: 'double' | 'half'): Beats {
  const list = sortedBeats(beats)
  if (list.length < 2) return beats
  const beatsPerBar = beats.meter.numerator
  const firstDown = Math.max(
    0,
    list.findIndex((b) => b.is_downbeat),
  )
  if (factor === 'double') {
    const doubled: Beat[] = []
    for (let i = 0; i < list.length; i++) {
      const beat = list[i] as Beat
      doubled.push(beat)
      const next = list[i + 1]
      if (next !== undefined) {
        doubled.push({
          id: `${beat.id}+`,
          t: (beat.t + next.t) / 2,
          activation: Math.min(beat.activation, next.activation),
          is_downbeat: false,
          bar_index: beat.bar_index,
          beat_in_bar: beat.beat_in_bar,
        })
      }
    }
    return withBeats(
      beats,
      periodicDownbeats(doubled, firstDown * 2, beatsPerBar),
      beats.bpm * 2,
      beatsPerBar,
    )
  }
  const kept = list.filter((_, i) => (i - firstDown) % 2 === 0)
  if (kept.length < 2) return beats
  return withBeats(
    beats,
    periodicDownbeats(kept, Math.floor(firstDown / 2), beatsPerBar),
    beats.bpm / 2,
    beatsPerBar,
  )
}

// Moves every downbeat by `k` beats (positive = later) and relabels the bars.
export function shiftDownbeat(beats: Beats, k: number): Beats {
  const list = sortedBeats(beats)
  const n = list.length
  if (n === 0 || k === 0) return beats
  const beatsPerBar = modalBarLength(
    list.map((b) => b.is_downbeat),
    beats.meter.numerator,
  )
  const shifted = new Set<number>()
  list.forEach((b, i) => {
    if (b.is_downbeat && i + k >= 0 && i + k < n) shifted.add(i + k)
  })
  return withBeats(
    beats,
    list.map((b, i) => ({ ...b, is_downbeat: shifted.has(i) })),
    beats.bpm,
    beatsPerBar,
  )
}

const MIN_BEAT_GAP_S = 0.001

// Moves one beat; neighbours are unchanged and the beat cannot cross them. Returns null when the
// beat does not exist.
export function nudgeBeat(beats: Beats, beatId: string, deltaS: number): Beats | null {
  const list = sortedBeats(beats)
  const i = list.findIndex((b) => b.id === beatId)
  const beat = list[i]
  if (beat === undefined) return null
  const lo = Math.max(0, (list[i - 1]?.t ?? Number.NEGATIVE_INFINITY) + MIN_BEAT_GAP_S)
  const hi = (list[i + 1]?.t ?? Number.POSITIVE_INFINITY) - MIN_BEAT_GAP_S
  const t = Math.min(hi, Math.max(lo, beat.t + deltaS))
  const nudged = list.map((b, j) => (j === i ? { ...b, t } : b))
  return {
    ...beats,
    beats: nudged,
    first_downbeat_t: nudged.find((b) => b.is_downbeat)?.t ?? beats.first_downbeat_t,
  }
}
