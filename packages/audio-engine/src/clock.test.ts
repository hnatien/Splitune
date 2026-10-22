import { describe, expect, it } from 'vitest'
import { heardContextTime, PositionClock, performanceTimeOf, TimestampLag } from './clock.ts'

const playing = (frame: number, heard: number, rate = 1) =>
  ({ frame, heard, rate, transport: 'playing' }) as const

describe('heardContextTime', () => {
  it('uses getOutputTimestamp as is when it already trails by the latency (Chromium)', () => {
    const timing = {
      now: 1500,
      currentTime: 10.06,
      timestamp: { contextTime: 10, performanceTime: 1400 },
      outputLatency: 0.05,
      baseLatency: 0.01,
      timestampLag: 0.06,
    }
    expect(heardContextTime(timing)).toBeCloseTo(10.1, 9)
  })

  it('subtracts the latency a timestamp does not include (WebKit)', () => {
    const timing = {
      now: 1500,
      currentTime: 10.002,
      timestamp: { contextTime: 10, performanceTime: 1400 },
      outputLatency: 0.0128,
      baseLatency: 0.0027,
      timestampLag: 0.002,
    }
    expect(heardContextTime(timing)).toBeCloseTo(10.1 - 0.0135, 9)
  })

  it('uses the timestamp alone where outputLatency is missing', () => {
    const timing = {
      now: 1500,
      currentTime: 10.2,
      timestamp: { contextTime: 10, performanceTime: 1400 },
    }
    expect(heardContextTime(timing)).toBeCloseTo(10.1, 9)
  })

  it('falls back to currentTime minus outputLatency + baseLatency', () => {
    expect(
      heardContextTime({ now: 0, currentTime: 2, outputLatency: 0.04, baseLatency: 0.01 }),
    ).toBeCloseTo(1.95, 9)
  })

  it('ignores a timestamp before output has started (all zeros)', () => {
    const timing = {
      now: 0,
      currentTime: 0.5,
      timestamp: { contextTime: 0, performanceTime: 0 },
      outputLatency: 0.1,
    }
    expect(heardContextTime(timing)).toBeCloseTo(0.4, 9)
  })

  it('performanceTimeOf inverts heardContextTime', () => {
    const timing = {
      now: 1000,
      currentTime: 3,
      timestamp: { contextTime: 2.9, performanceTime: 990 },
    }
    const at = performanceTimeOf(3.5, timing)
    expect(heardContextTime({ ...timing, now: at })).toBeCloseTo(3.5, 9)
  })
})

describe('TimestampLag', () => {
  it('smooths currentTime − contextTime and ignores invalid timestamps', () => {
    const lag = new TimestampLag()
    expect(lag.update(1, { contextTime: 0, performanceTime: 0 })).toBeUndefined()
    expect(lag.update(1.03, { contextTime: 1, performanceTime: 10 })).toBeCloseTo(0.03, 9)
    expect(lag.update(1.05, { contextTime: 1, performanceTime: 10 })).toBeCloseTo(0.031, 9)
  })
})

describe('PositionClock', () => {
  it('extrapolates from the latest report at the reported rate', () => {
    const clock = new PositionClock()
    clock.push(playing(0, 1000, 0.5))
    clock.push(playing(960, 1480, 0.5))
    expect(clock.sourceAt(960 + 480)).toBe(1480 + 240)
  })

  it('uses the report at or before the frame when the device lags behind the reports', () => {
    const clock = new PositionClock()
    clock.push(playing(0, 0))
    clock.push(playing(960, 960))
    clock.push(playing(1920, 5000)) // after a seek
    expect(clock.sourceAt(1000)).toBe(1000)
    expect(clock.sourceAt(1920)).toBe(5000)
  })

  it('holds the position while stopped or counting in', () => {
    const clock = new PositionClock()
    clock.push({ frame: 0, heard: 4800, rate: 1, transport: 'countIn' })
    expect(clock.sourceAt(48000)).toBe(4800)
    expect(clock.transport).toBe('countIn')
  })

  it('wraps an extrapolated position into the loop it is in', () => {
    const clock = new PositionClock()
    clock.setLoop({ start: 1000, end: 2000 })
    clock.push(playing(0, 1900))
    expect(clock.sourceAt(150)).toBe(1050)
    clock.setLoop(null)
    expect(clock.sourceAt(150)).toBe(2050)
  })

  it('does not wrap a position that was before the loop', () => {
    const clock = new PositionClock()
    clock.setLoop({ start: 1000, end: 2000 })
    clock.push(playing(0, 500))
    expect(clock.sourceAt(2000)).toBe(2500)
  })

  it('starts over when the frames go backwards (new context)', () => {
    const clock = new PositionClock()
    clock.push(playing(48000, 100))
    clock.push(playing(0, 7))
    expect(clock.sourceAt(0)).toBe(7)
  })
})
