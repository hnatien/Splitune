import { type BeatGrid, barOfBeat, beatLabel, PPQ } from '../grid/beatgrid.ts'

// What both alphaTex writers (tab and grand staff) share: the bars to render on the beat grid and
// how a length of ticks splits into written durations.

export interface Duration {
  ticks: number
  token: string // duration value after the dot
  props: string[] // beat properties
  unit: number // start alignment within the bar
}

// A duration may start only on a multiple of `unit`; dotted values need twice their base unit
// so splits read like ordinary notation (♪. ♬ on the beat, never mid-beat).
const STRAIGHT_DURATIONS: Duration[] = [
  { ticks: 3840, token: '1', props: [], unit: 3840 },
  { ticks: 2880, token: '2', props: ['d'], unit: 3840 },
  { ticks: 1920, token: '2', props: [], unit: 1920 },
  { ticks: 1440, token: '4', props: ['d'], unit: 1920 },
  { ticks: 960, token: '4', props: [], unit: 960 },
  { ticks: 720, token: '8', props: ['d'], unit: 960 },
  { ticks: 480, token: '8', props: [], unit: 480 },
  { ticks: 360, token: '16', props: ['d'], unit: 480 },
  { ticks: 240, token: '16', props: [], unit: 240 },
  { ticks: 120, token: '32', props: [], unit: 120 },
]

// Swing bars hold only whole numbers of beats and triplet eighths, so every tuplet group is a
// complete beat of three. A dotted quarter is a beat and a half, off the triplet grid.
const SWING_DURATIONS: Duration[] = [
  ...STRAIGHT_DURATIONS.filter((d) => d.ticks % PPQ === 0),
  { ticks: 320, token: '8', props: ['tu 3'], unit: 320 },
]

export function split(pos: number, length: number, swing: boolean): Duration[] {
  const table = swing ? SWING_DURATIONS : STRAIGHT_DURATIONS
  const out: Duration[] = []
  let p = pos
  let remaining = length
  while (remaining > 0) {
    const d = table.find((x) => x.ticks <= remaining && p % x.unit === 0)
    if (d === undefined) {
      throw new Error(`alphaTex: cannot express ${remaining} ticks at ${p} (swing=${swing})`)
    }
    out.push(d)
    p += d.ticks
    remaining -= d.ticks
  }
  return out
}

export function quote(text: string): string {
  return `"${text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

export interface Bar {
  bar: number
  startTick: number // first rendered tick (later than the bar start for a pickup)
  endTick: number
  length: number // nominal beats
  pickup: boolean
}

export function barZeroTick(grid: BeatGrid): number {
  let beat = 0
  while (beatLabel(grid, beat).bar < 0) beat++
  while (beatLabel(grid, beat).bar > 0 || beatLabel(grid, beat).beat > 1) beat--
  return beat * PPQ
}

export function barsToRender(grid: BeatGrid, contentStart: number, contentEnd: number): Bar[] {
  const out: Bar[] = []
  let beat = Math.floor(contentStart / PPQ)
  const first = barOfBeat(grid, beat)
  const pickup = beatLabel(grid, first.start).bar === -1
  if (!pickup) {
    // Start at bar 0 so the score lines up with the beat grid from the first downbeat.
    while (beatLabel(grid, barOfBeat(grid, beat).start).bar > 0)
      beat = barOfBeat(grid, beat).start - 1
  }
  let { start, length } = barOfBeat(grid, beat)
  if (pickup) {
    out.push({
      bar: -1,
      startTick: beat * PPQ,
      endTick: (start + length) * PPQ,
      length,
      pickup: true,
    })
    ;({ start, length } = barOfBeat(grid, start + length))
  }
  while (out.length === 0 || start * PPQ < contentEnd) {
    out.push({
      bar: beatLabel(grid, start).bar,
      startTick: start * PPQ,
      endTick: (start + length) * PPQ,
      length,
      pickup: false,
    })
    ;({ start, length } = barOfBeat(grid, start + length))
  }
  return out
}
