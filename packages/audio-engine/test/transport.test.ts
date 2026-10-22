// Transport behaviour of ProcessorCore + dsp.wasm, driven block by block in Node.
import { describe, expect, it } from 'vitest'
import { ProcessorCore } from '../src/core.ts'
import { Quality } from '../src/dsp.ts'
import type { Command, ProcessorEvent } from '../src/protocol.ts'
import { peak } from './analysis.ts'
import { dspModule } from './render.ts'
import { beatGrid, tone } from './signals.ts'

const sr = 48000
const QUANTUM = 128

function engine(seconds = 4) {
  const events: ProcessorEvent[] = []
  const core = new ProcessorCore(
    dspModule,
    sr,
    960,
    (event) => events.push(event),
    () => 0,
  )
  core.receive({ type: 'load', stem: 0, pcm: tone(sr, seconds, 440) })
  let frame = 0
  const left = new Float32Array(QUANTUM)
  const right = new Float32Array(QUANTUM)
  return {
    events,
    send: (command: Command) => core.receive(command),
    // Renders `seconds` and returns the left channel.
    run(seconds: number) {
      const out = new Float32Array(Math.ceil((seconds * sr) / QUANTUM) * QUANTUM)
      for (let at = 0; at < out.length; at += QUANTUM) {
        core.render(frame, left, right)
        out.set(left, at)
        frame += QUANTUM
      }
      return out
    },
    of: <T extends ProcessorEvent['type']>(type: T) =>
      events.filter((e): e is Extract<ProcessorEvent, { type: T }> => e.type === type),
    get frame() {
      return frame
    },
  }
}

describe('transport', () => {
  it('reports ready and the loaded stem', () => {
    const e = engine()
    expect(e.events.slice(0, 2)).toEqual([
      { type: 'ready' },
      { type: 'loaded', stem: 0, frames: 4 * sr, duration: 4 * sr },
    ])
  })

  it('is silent until play and starts aligned at the current position', () => {
    const e = engine()
    expect(peak(e.run(0.5))).toBe(0)
    const from = e.frame
    e.send({ type: 'seek', position: sr })
    e.send({ type: 'play', countInBars: 0 })
    const out = e.run(0.5)
    expect(e.of('started')).toEqual([
      { type: 'started', frame: from, position: sr, downbeat: false },
    ])
    expect(peak(out, 0, 128)).toBeGreaterThan(0.1)
    expect(e.of('position').at(-1)?.transport).toBe('playing')
  })

  it('fades out on pause and resumes from the heard position', () => {
    const e = engine()
    e.send({ type: 'play', countInBars: 0 })
    e.run(1)
    const from = e.frame
    e.send({ type: 'pause' })
    const out = e.run(0.5)
    const [stopped] = e.of('stopped')
    expect(stopped?.frame).toBe(from + QUANTUM - 1)
    expect(Math.abs((stopped?.position ?? 0) - (from + QUANTUM))).toBeLessThanOrEqual(1)
    expect(Math.abs(out[QUANTUM - 1] ?? 1)).toBeLessThan(0.01)
    expect(peak(out, QUANTUM)).toBe(0)
    e.send({ type: 'play', countInBars: 0 })
    e.run(0.1)
    expect(e.of('started').at(-1)?.position).toBe(stopped?.position)
  })

  it('seeks during playback after a one-block fade', () => {
    const e = engine()
    e.send({ type: 'play', countInBars: 0 })
    e.run(0.5)
    const from = e.frame
    e.send({ type: 'seek', position: 3 * sr })
    e.run(0.1)
    expect(e.of('started').at(-1)).toEqual({
      type: 'started',
      frame: from + QUANTUM,
      position: 3 * sr,
      downbeat: false,
    })
  })

  it('stops with `ended` when the end is heard', () => {
    const e = engine(1)
    e.send({ type: 'play', countInBars: 0 })
    e.run(1.5)
    expect(e.of('ended')).toEqual([{ type: 'ended', frame: sr, position: sr }])
    expect(e.of('position').at(-1)?.transport).toBe('stopped')
  })

  it('pauses where the heard position crosses stopAt, once', () => {
    const e = engine()
    e.send({ type: 'stopAt', position: sr })
    e.send({ type: 'play', countInBars: 0 })
    const out = e.run(1.5)
    const [reached] = e.of('stopReached')
    expect(reached?.position).toBe(sr)
    const [stopped] = e.of('stopped')
    // The fading block ends within one block of the target.
    expect(Math.abs((stopped?.position ?? 0) - sr)).toBeLessThanOrEqual(QUANTUM)
    expect(peak(out, (reached?.frame ?? 0) + QUANTUM)).toBe(0)
    // One-shot: playing on from there does not stop again.
    e.send({ type: 'play', countInBars: 0 })
    e.run(0.5)
    expect(e.of('stopReached')).toHaveLength(1)
    expect(e.of('position').at(-1)?.transport).toBe('playing')
  })

  it('never stops for a stopAt behind the start or after it is cleared', () => {
    const e = engine()
    e.send({ type: 'seek', position: 2 * sr })
    e.send({ type: 'stopAt', position: sr })
    e.send({ type: 'play', countInBars: 0 })
    e.run(0.5)
    e.send({ type: 'stopAt', position: 3 * sr })
    e.send({ type: 'stopAt', position: null })
    e.run(1)
    expect(e.of('stopReached')).toEqual([])
    expect(e.of('position').at(-1)?.transport).toBe('playing')
  })

  it('emits beats with downbeat accents and metronome clicks only when enabled', () => {
    const grid = beatGrid(sr, 4, 120)
    const quiet = engine(4)
    quiet.send({ type: 'beats', ...grid })
    quiet.send({ type: 'gain', stem: 0, gain: 0 })
    quiet.send({ type: 'play', countInBars: 0 })
    const silent = quiet.run(2.2)
    expect(quiet.of('beat').map((b) => [b.index, b.accent])).toEqual([
      [0, true],
      [1, false],
      [2, false],
      [3, false],
      [4, true],
    ])
    expect(peak(silent)).toBe(0)

    const ticking = engine(4)
    ticking.send({ type: 'beats', ...grid })
    ticking.send({ type: 'gain', stem: 0, gain: 0 })
    ticking.send({ type: 'metronome', enabled: true })
    ticking.send({ type: 'play', countInBars: 0 })
    const clicks = ticking.run(2.2)
    for (const beat of ticking.of('beat')) {
      expect(peak(clicks, beat.frame, beat.frame + 0.02 * sr)).toBeGreaterThan(0.1)
    }
  })

  it('applies a scheduled command in the quantum containing its frame', () => {
    const e = engine()
    e.send({ type: 'play', countInBars: 0, at: 1000 })
    e.run(0.1)
    expect(e.of('started')[0]?.frame).toBe(896) // the quantum 896–1023
  })

  it('cancels a count-in on pause', () => {
    const e = engine()
    e.send({ type: 'play', countInBars: 1 })
    e.run(0.6)
    e.send({ type: 'pause' })
    const out = e.run(2)
    expect(e.of('countIn')).toHaveLength(2)
    expect(e.of('started')).toEqual([])
    expect(e.of('stopped')).toHaveLength(1)
    expect(peak(out, 0.05 * sr)).toBe(0)
  })

  it('switches to the cheaper preset mid-play without losing the position', () => {
    const e = engine()
    e.send({ type: 'play', countInBars: 0 })
    e.run(1)
    const from = e.frame
    e.send({ type: 'quality', quality: Quality.cheaper })
    e.run(0.5)
    const restart = e.of('started').at(-1)
    expect(e.of('started')).toHaveLength(2)
    expect(Math.abs((restart?.position ?? 0) - (from + QUANTUM))).toBeLessThanOrEqual(1)
  })

  it('posts flushed with the frame where earlier commands applied', () => {
    const e = engine()
    e.run(0.01)
    e.send({ type: 'flush', id: 7 })
    expect(e.of('flushed')).toEqual([{ type: 'flushed', id: 7, frame: e.frame }])
  })
})
