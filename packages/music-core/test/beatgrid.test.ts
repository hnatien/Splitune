import { describe, expect, it } from 'vitest'
import {
  beatLabel,
  createBeatGrid,
  minTick,
  nudgeBeat,
  PPQ,
  positionOfTick,
  shiftDownbeat,
  snapToBar,
  tempoOctave,
  tickOfPosition,
  tickToTime,
  timeToTick,
} from '../src/index.ts'
import { fixtures, makeBeats } from './helpers.ts'

describe('timeToTick / tickToTime', () => {
  const grid = createBeatGrid(makeBeats({ bpm: 120, bars: 2, start: 1 }))

  it('interpolates linearly inside a beat interval at PPQ 960', () => {
    expect(timeToTick(grid, 1)).toBe(0)
    expect(timeToTick(grid, 1.25)).toBeCloseTo(PPQ / 2)
    expect(tickToTime(grid, PPQ * 3 + 240)).toBeCloseTo(1 + 1.5 + 0.125)
  })

  it('extrapolates before the first and after the last beat with the nearest interval', () => {
    expect(timeToTick(grid, 0.5)).toBeCloseTo(-PPQ)
    expect(tickToTime(grid, -PPQ)).toBeCloseTo(0.5)
    expect(timeToTick(grid, 1 + 10 * 0.5)).toBeCloseTo(10 * PPQ)
  })

  it('round-trips on a tempo-varying grid', () => {
    const beats = makeBeats({ bars: 2 })
    beats.beats = beats.beats.map((b, i) => ({ ...b, t: 0.5 + i * 0.5 + i * i * 0.01 }))
    const g = createBeatGrid(beats)
    for (const t of [0.1, 0.77, 2.3, 4.9, 9])
      expect(tickToTime(g, timeToTick(g, t))).toBeCloseTo(t, 9)
  })
})

describe('bar/beat labels', () => {
  it('derives labels from downbeats, including pickups', () => {
    const grid = createBeatGrid(makeBeats({ pickup: 1, bars: 2 }))
    expect(beatLabel(grid, 0)).toEqual({ bar: -1, beat: 4 })
    expect(beatLabel(grid, 1)).toEqual({ bar: 0, beat: 1 })
    expect(beatLabel(grid, -1)).toEqual({ bar: -1, beat: 3 })
    expect(beatLabel(grid, 9)).toEqual({ bar: 2, beat: 1 }) // extrapolated past the end
    expect(minTick(grid)).toBe(-3 * PPQ)
  })

  it('follows meter changes from downbeats instead of the meter field', () => {
    const beats = makeBeats({ bars: 3 })
    beats.beats = beats.beats.map((b, i) => ({ ...b, is_downbeat: [0, 4, 7].includes(i) }))
    const grid = createBeatGrid(beats)
    expect(beatLabel(grid, 6)).toEqual({ bar: 1, beat: 3 })
    expect(beatLabel(grid, 7)).toEqual({ bar: 2, beat: 1 })
  })

  it('infers downbeats when the pickup is a full bar or longer', () => {
    const beats = makeBeats({ bars: 2, pickup: 5 })
    const grid = createBeatGrid(beats)
    expect(beatLabel(grid, 0)).toEqual({ bar: -1, beat: 4 })
    expect(beatLabel(grid, 1)).toEqual({ bar: 0, beat: 1 })
  })

  it('synthesises a grid from bpm when fewer than two beats were detected', () => {
    const beats = { ...makeBeats(), beats: [] }
    const grid = createBeatGrid(beats)
    expect(grid.times.length).toBeGreaterThan(2)
    expect(tickToTime(grid, PPQ)).toBeCloseTo(beats.first_downbeat_t + 0.5)
  })

  it('maps global ticks to bar/beat/tick', () => {
    const grid = createBeatGrid(makeBeats())
    expect(positionOfTick(grid, 5 * PPQ + 240)).toEqual({ bar: 1, beat: 2, tick: 240 })
  })

  it('maps bar/beat/tick back to global ticks, pickups and extrapolated bars included', () => {
    const grid = createBeatGrid(makeBeats({ pickup: 1, bars: 2 }))
    for (const tick of [-3 * PPQ, -PPQ + 120, 0, PPQ + 480, 7 * PPQ + 959, 13 * PPQ, 30 * PPQ]) {
      expect(tickOfPosition(grid, positionOfTick(grid, tick))).toBe(tick)
    }
    expect(tickOfPosition(grid, { bar: 0, beat: 1, tick: 0 })).toBe(PPQ)
  })

  it('maps positions on a grid whose bars change length', () => {
    const beats = makeBeats({ bars: 3 })
    beats.beats = beats.beats.map((b, i) => ({ ...b, is_downbeat: [0, 4, 7].includes(i) }))
    const grid = createBeatGrid(beats)
    expect(tickOfPosition(grid, { bar: 1, beat: 3, tick: 10 })).toBe(6 * PPQ + 10)
    expect(tickOfPosition(grid, { bar: 2, beat: 1, tick: 0 })).toBe(7 * PPQ)
  })
})

describe('snapToBar', () => {
  const grid = createBeatGrid(makeBeats({ bars: 3, start: 0 }))

  it('snaps to the nearest, previous or next downbeat', () => {
    expect(snapToBar(grid, 2.9)).toMatchObject({ t: 2, bar: 1, beat: 1 })
    expect(snapToBar(grid, 3.1)).toMatchObject({ t: 4, bar: 2, beat: 1 })
    expect(snapToBar(grid, 3.1, { direction: 'floor' })).toMatchObject({ t: 2, bar: 1 })
    expect(snapToBar(grid, 2.1, { direction: 'ceil' })).toMatchObject({ t: 4, bar: 2 })
    expect(snapToBar(grid, 2, { direction: 'ceil' })).toMatchObject({ t: 2, bar: 1 })
  })

  it('snaps into the anacrusis when asked for a pickup', () => {
    expect(snapToBar(grid, 3.6, { pickup: true })).toMatchObject({ t: 3.5, bar: 1, beat: 4 })
    expect(snapToBar(grid, 3.2, { pickup: true })).toMatchObject({ t: 4, bar: 2, beat: 1 })
  })
})

describe('beat-grid corrections', () => {
  it('tempo_octave double inserts midpoints and keeps the meter per bar', () => {
    const beats = makeBeats({ bars: 2 })
    const doubled = tempoOctave(beats, 'double')
    expect(doubled.beats).toHaveLength(beats.beats.length * 2 - 1)
    expect(doubled.bpm).toBe(240)
    expect(doubled.beats[1]?.t).toBeCloseTo(0.75)
    expect(doubled.beats.filter((b) => b.is_downbeat).map((b) => b.t)).toEqual([0.5, 1.5, 2.5, 3.5])
  })

  it('tempo_octave half drops every second beat and keeps the first downbeat', () => {
    const beats = makeBeats({ bars: 4, pickup: 1 })
    const halved = tempoOctave(beats, 'half')
    expect(halved.bpm).toBe(60)
    expect(halved.beats.map((b) => b.t)).toContain(beats.first_downbeat_t)
    expect(halved.first_downbeat_t).toBe(beats.first_downbeat_t)
    expect(halved.beats.every((b, i, all) => i === 0 || b.t - (all[i - 1]?.t ?? 0) === 1)).toBe(
      true,
    )
  })

  it('shift_downbeat rotates bar starts by k beats', () => {
    const shifted = shiftDownbeat(makeBeats({ bars: 2 }), 1)
    expect(shifted.beats[0]).toMatchObject({ bar_index: -1, beat_in_bar: 4 })
    expect(shifted.beats[1]).toMatchObject({ is_downbeat: true, bar_index: 0, beat_in_bar: 1 })
  })

  it('nudge_beat moves one beat without crossing its neighbours', () => {
    const beats = fixtures.beats()
    const nudged = nudgeBeat(beats, 'b0005', -0.012)
    expect(nudged?.beats[5]?.t).toBeCloseTo(3.488)
    expect(nudged?.beats[4]?.t).toBe(beats.beats[4]?.t)
    const clamped = nudgeBeat(beats, 'b0005', -10)
    expect(clamped?.beats[5]?.t).toBeGreaterThan(beats.beats[4]?.t ?? 0)
    expect(nudgeBeat(beats, 'missing', 1)).toBeNull()
  })
})
