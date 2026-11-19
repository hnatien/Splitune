import { describe, expect, it } from 'vitest'
import {
  type ClockReading,
  chordEvents,
  chordVoicing,
  dueEvents,
  LOOKAHEAD,
  noteEvents,
  type SynthEvent,
  SynthScheduler,
} from './synth-schedule'

const pluck = (t: number, midi = 60): SynthEvent => ({
  t,
  duration: 0.25,
  midi: [midi],
  voice: 'pluck',
})
const LOOP = { start: 10, end: 12 }
const reading = (
  position: number,
  time: number,
  patch: Partial<ClockReading> = {},
): ClockReading => ({
  position,
  time,
  rate: 1,
  playing: true,
  loop: LOOP,
  ...patch,
})

describe('dueEvents', () => {
  const events = [pluck(9.5), pluck(10), pluck(11), pluck(11.95), pluck(12.5)]

  it('takes the events starting inside the window', () => {
    expect(dueEvents(events, 10.9, 11.1, null).map((d) => d.at)).toEqual([11])
    expect(dueEvents(events, 11, 11.1, null).map((d) => d.at)).toEqual([11])
    expect(dueEvents(events, 10.9, 11, null)).toEqual([])
  })

  it('takes in the next pass when the window runs past the loop end', () => {
    const due = dueEvents(events, 11.9, 12.1, LOOP)
    expect(due.map((d) => [d.event.t, d.at])).toEqual([
      [11.95, 11.95],
      [10, 12],
    ])
  })

  it('leaves out what lies outside the loop', () => {
    expect(dueEvents(events, 9, 13, LOOP).map((d) => d.event.t)).toEqual([10, 11, 11.95, 10])
    expect(dueEvents(events, 12.4, 12.6, null).map((d) => d.event.t)).toEqual([12.5])
  })
})

describe('SynthScheduler', () => {
  it('schedules each event once, at the context time the clock reaches it', () => {
    const scheduler = new SynthScheduler()
    scheduler.setEvents([pluck(10.1), pluck(10.3)])
    const started: [number, number][] = []
    // 25 ms ticks from the loop's start at context time 100.
    for (let i = 0; i < 16; i++) {
      for (const due of scheduler.tick(reading(10 + i * 0.025, 100 + i * 0.025))) {
        started.push([due.event.t, due.when])
      }
    }
    expect(started.map(([t]) => t)).toEqual([10.1, 10.3])
    expect(started[0]?.[1]).toBeCloseTo(100.1)
    expect(started[1]?.[1]).toBeCloseTo(100.3)
  })

  it('follows the rate: half speed sounds an event twice as far ahead, twice as long', () => {
    const scheduler = new SynthScheduler()
    scheduler.setEvents([pluck(10.05)])
    const [due] = scheduler.tick(reading(10, 50, { rate: 0.5 }))
    expect(due?.when).toBeCloseTo(50.1)
    expect(due?.duration).toBeCloseTo(0.5)
    // The window covers LOOKAHEAD of context time, so less of the timeline when slowed.
    scheduler.setEvents([pluck(10 + LOOKAHEAD * 0.5 + 0.01)])
    expect(new SynthScheduler().tick(reading(10, 50, { rate: 0.5 }))).toEqual([])
  })

  it('carries on through the loop wrap without repeating or dropping the first note', () => {
    const scheduler = new SynthScheduler()
    scheduler.setEvents([pluck(10), pluck(11.9)])
    const started: [number, number][] = []
    // From 11.8 over the seam at context time 200.2 to 10.3 on the next pass.
    for (let i = 0; i < 20; i++) {
      const elapsed = i * 0.025
      const unwrapped = 11.8 + elapsed
      const position = unwrapped >= 12 ? unwrapped - 2 : unwrapped
      for (const due of scheduler.tick(reading(position, 200 + elapsed))) {
        started.push([due.event.t, due.when])
      }
    }
    expect(started.map(([t]) => t)).toEqual([11.9, 10])
    expect(started[0]?.[1]).toBeCloseTo(200.1)
    expect(started[1]?.[1]).toBeCloseTo(200.2)
  })

  it('starts over from the new position after a seek', () => {
    const scheduler = new SynthScheduler()
    scheduler.setEvents([pluck(10.05), pluck(11.05)])
    expect(scheduler.tick(reading(10, 0)).map((d) => d.event.t)).toEqual([10.05])
    expect(scheduler.tick(reading(11, 0.025)).map((d) => d.event.t)).toEqual([11.05])
    // Back to the start: the first note sounds again.
    expect(scheduler.tick(reading(10, 0.05)).map((d) => d.event.t)).toEqual([10.05])
  })

  it('schedules nothing while paused, and from the heard position when playback resumes', () => {
    const scheduler = new SynthScheduler()
    scheduler.setEvents([pluck(10.05), pluck(10.6)])
    expect(scheduler.tick(reading(10, 0, { playing: false }))).toEqual([])
    expect(scheduler.tick(reading(10, 5)).map((d) => d.event.t)).toEqual([10.05])
    expect(scheduler.tick(reading(10.02, 5.02, { playing: false }))).toEqual([])
    expect(scheduler.tick(reading(10.5, 9)).map((d) => [d.event.t, d.when])).toEqual([[10.6, 9.1]])
  })

  it('takes new events for what is still ahead', () => {
    const scheduler = new SynthScheduler()
    scheduler.setEvents([pluck(10.05)])
    scheduler.tick(reading(10, 0))
    scheduler.setEvents([pluck(10.05, 64), pluck(10.2, 64)])
    const due = scheduler.tick(reading(10.1, 0.1))
    expect(due.map((d) => d.event.t)).toEqual([10.2])
  })
})

describe('voicings and events', () => {
  it('voices a guitar chord as its first shape, low string first', () => {
    // x02210
    expect(chordVoicing('A:min', { guitar: true })).toEqual([45, 52, 57, 60, 64])
    // With a capo on 2, B minor is fretted as the A minor shape.
    expect(chordVoicing('B:min', { guitar: true, capo: 2 })).toEqual([47, 54, 59, 62, 66])
  })

  it('stacks the tones over the bass when there is no shape', () => {
    expect(chordVoicing('C:maj')).toEqual([36, 48, 52, 55])
    expect(chordVoicing('A:min7')).toEqual([45, 57, 60, 64, 67])
    expect(chordVoicing('C:maj', { bass: 'E' })).toEqual([40, 48, 52, 55])
    expect(chordVoicing('N')).toEqual([])
  })

  it('strikes an auditioned chord on every beat of its span', () => {
    const events = chordEvents([45, 52], [10, 10.5, 11, 11.5, 12], { start: 10.5, end: 11.75 })
    expect(events.map((e) => [e.t, e.duration])).toEqual([
      [10.5, 0.5],
      [11, 0.5],
      [11.5, 0.25],
    ])
    expect(events.every((e) => e.voice === 'pad')).toBe(true)
    expect(chordEvents([], [10], { start: 10, end: 11 })).toEqual([])
  })

  it('turns the transcribed notes into plucks at their played times', () => {
    expect(noteEvents([{ onset: 3, offset: 3.5, pitch: 62 }])).toEqual([
      { t: 3, duration: 0.5, midi: [62], voice: 'pluck' },
    ])
  })
})
