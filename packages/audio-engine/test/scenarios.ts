// Offline-render scenarios (docs/implementation/18-testing-strategy.md §2). Each one sets up the
// engine with commands, renders, measures, and checks the measurements. The same scenarios run
// in Node through ProcessorCore (test/engine.test.ts) and in Chromium, Firefox and WebKit through
// the real AudioWorklet in an OfflineAudioContext (test/browser/offline.spec.ts).
import type { Command, ProcessorEvent } from '../src/protocol.ts'
import {
  allFinite,
  cents,
  frequency,
  heardAt,
  interleavedChannel,
  maxCurvature,
  onsets,
  peak,
  rms,
} from './analysis.ts'
import { beatGrid, chord, clickTrack, tone } from './signals.ts'

export const SAMPLE_RATE = 48000

export interface Setup {
  seconds: number
  stems: Int16Array[]
  commands: Command[]
}

export type Measurement = Record<string, number | boolean | number[]>

// The subset of Vitest's and Playwright's `expect` the checks use.
export type Expect = (
  actual: unknown,
  message?: string,
) => {
  toBe(expected: unknown): void
  toBeLessThanOrEqual(expected: number): void
  toBeGreaterThanOrEqual(expected: number): void
  toBeGreaterThan(expected: number): void
}

export interface Scenario<M extends Measurement = Measurement> {
  name: string
  setup(): Setup
  measure(output: Float32Array, events: ProcessorEvent[]): M
  check(result: M, expect: Expect): void
}

// Infers each scenario's measurement type from `measure`, so `check` reads it typed.
const scenario = <M extends Measurement>(definition: Scenario<M>): Scenario<M> => definition

const sr = SAMPLE_RATE
type Position = Extract<ProcessorEvent, { type: 'position' }>
const positions = (events: ProcessorEvent[]) =>
  events.filter((e): e is Position => e.type === 'position')
const firstOf = <T extends ProcessorEvent['type']>(events: ProcessorEvent[], type: T) =>
  events.find((e): e is Extract<ProcessorEvent, { type: T }> => e.type === type)
const db = (ratio: number) => 20 * Math.log10(ratio)

function duration(rate: number) {
  const source = tone(sr, 10, 440, 0.5)
  return scenario({
    name: `duration at ${rate}×`,
    setup: () => ({
      seconds: 10 / rate + 1,
      stems: [source],
      commands: [
        { type: 'rate', rate },
        { type: 'play', countInBars: 0 },
      ],
    }),
    measure(output, events) {
      const expected = (firstOf(events, 'started')?.frame ?? 0) + (10 * sr) / rate
      let lastAudible = 0
      for (let i = 0; i < output.length; i++) if (Math.abs(output[i] ?? 0) > 1e-3) lastAudible = i
      return {
        finite: allFinite(output),
        ended: firstOf(events, 'ended')?.frame ?? -1,
        expected,
        lastAudible,
        levelDb: db(
          rms(output, 2 * sr, Math.floor(expected - sr)) / rms(interleavedChannel(source)),
        ),
      }
    },
    check(r, expect) {
      expect(r.finite).toBe(true)
      expect(Math.abs(r.ended - r.expected), 'ended frame').toBeLessThanOrEqual(128)
      expect(Math.abs(r.lastAudible - r.expected), 'last audible').toBeLessThanOrEqual(128)
      expect(Math.abs(r.levelDb), 'level change (dB)').toBeLessThanOrEqual(1)
    },
  })
}

function pitch(name: string, rate: number, semitones: number) {
  return scenario({
    name,
    setup: () => ({
      seconds: 6,
      stems: [tone(sr, 6 * rate + 1, 440, 0.5)],
      commands: [
        { type: 'rate', rate },
        { type: 'transpose', semitones, tonalityLimitHz: 0 },
        { type: 'play', countInBars: 0 },
      ],
    }),
    measure: (output) => ({
      finite: allFinite(output),
      cents: cents(frequency(output, sr, 1 * sr, 5 * sr), 440 * 2 ** (semitones / 12)),
    }),
    check(r, expect) {
      expect(r.finite).toBe(true)
      expect(Math.abs(r.cents), 'pitch error (cents)').toBeLessThanOrEqual(5)
    },
  })
}

// A 4-bar loop (160 BPM, 6 s) played five times at 0.75×: seams must not stand out from the
// music in curvature (clicks) or level (dips).
function loopSeam() {
  const rate = 0.75
  const loop = { start: 1 * sr, end: 7 * sr }
  return scenario({
    name: 'loop seam',
    setup: () => ({
      seconds: (5 * 6) / rate + 0.5,
      stems: [chord(sr, 10)],
      commands: [
        { type: 'rate', rate },
        { type: 'loop', loop },
        { type: 'seek', position: loop.start },
        { type: 'play', countInBars: 0 },
      ],
    }),
    measure(output, events) {
      const seams = events.flatMap((e) => (e.type === 'loopWrap' ? [e.frame] : []))
      const window = Math.round(0.01 * sr)
      const steadyFrom = 1 * sr
      const steadyTo = Math.round((6 / rate) * sr) - 4 * window
      const steadyCurvature = maxCurvature(output, steadyFrom, steadyTo)
      const steadyRms = rms(output, steadyFrom, steadyTo)
      let worstCurvature = 0
      let worstDipDb = 0
      for (const seam of seams) {
        worstCurvature = Math.max(
          worstCurvature,
          maxCurvature(output, seam - 4 * window, seam + 4 * window),
        )
        for (let at = seam - 4 * window; at < seam + 4 * window; at += window) {
          worstDipDb = Math.min(worstDipDb, db(rms(output, at, at + window) / steadyRms))
        }
      }
      return {
        finite: allFinite(output),
        seams,
        curvatureRatio: worstCurvature / steadyCurvature,
        worstDipDb,
      }
    },
    check(r, expect) {
      expect(r.finite).toBe(true)
      expect(r.seams.length, 'loop wraps').toBeGreaterThanOrEqual(4)
      expect(r.curvatureRatio, 'seam curvature / music curvature').toBeLessThanOrEqual(1.5)
      expect(r.worstDipDb, 'level dip at seams (dB)').toBeGreaterThanOrEqual(-3)
    },
  })
}

// Clicks at known, irregular times; each click heard in the output must match the engine's
// reported heard position within 5 ms.
function clock(rate: number) {
  const times = [0.5, 1.13, 1.71, 2.4, 3.05, 3.62, 4.41, 5.0, 5.77, 6.3, 7.12, 7.8]
  const source = clickTrack(sr, 8.5, times)
  return scenario({
    name: `clock accuracy at ${rate}×`,
    setup: () => ({
      seconds: 8.5 / rate + 0.5,
      stems: [source],
      commands: [
        { type: 'rate', rate },
        { type: 'play', countInBars: 0 },
      ],
    }),
    measure(output, events) {
      const reference = onsets(interleavedChannel(source), 0.3, 0.1 * sr)
      const detected = onsets(output, 0.3, 0.1 * sr)
      const reports = positions(events)
      const errorsMs = detected.map((frame) => {
        const heard = heardAt(reports, frame) ?? Number.NaN
        const nearest = reference.reduce((a, b) =>
          Math.abs(b - heard) < Math.abs(a - heard) ? b : a,
        )
        return ((heard - nearest) / sr) * 1000
      })
      return { finite: allFinite(output), clicks: detected.length, errorsMs }
    },
    check(r, expect) {
      expect(r.finite).toBe(true)
      expect(r.clicks, 'clicks detected').toBe(12)
      for (const error of r.errorsMs) {
        expect(Math.abs(error), 'clock error (ms)').toBeLessThanOrEqual(5)
      }
    },
  })
}

// One bar of count-in at 0.7× before a bar that starts with a click: the count-in clicks are a
// beat apart at the slowed tempo and the bar's first click is heard on the downbeat.
function countIn() {
  const rate = 0.7
  const start = 2
  const source = clickTrack(sr, 6, [start, start + 0.5, start + 1])
  const grid = beatGrid(sr, 6, 120)
  return scenario({
    name: 'count-in at 0.7×',
    setup: () => ({
      seconds: 4.5,
      stems: [source],
      commands: [
        { type: 'beats', frames: grid.frames, downbeats: grid.downbeats },
        { type: 'rate', rate },
        { type: 'seek', position: start * sr },
        { type: 'play', countInBars: 1 },
      ],
    }),
    measure(output, events) {
      const clicks = events.flatMap((e) => (e.type === 'countIn' ? [e.frame] : []))
      const started = firstOf(events, 'started')
      const downbeat = started?.frame ?? -1
      const window = output.subarray(
        downbeat - Math.round(0.05 * sr),
        downbeat + Math.round(0.05 * sr),
      )
      const heard = onsets(window, 0.3, 0.04 * sr)[0] ?? Number.NaN
      return {
        countInClicks: clicks.length,
        spacing:
          clicks.length > 1 ? ((clicks.at(-1) ?? 0) - (clicks[0] ?? 0)) / (clicks.length - 1) : 0,
        expectedSpacing: (0.5 * sr) / rate,
        downbeat,
        expectedDownbeat: (clicks[0] ?? 0) + (4 * 0.5 * sr) / rate,
        onDownbeat: started?.downbeat === true,
        heardOffsetMs: ((heard - Math.round(0.05 * sr)) / sr) * 1000,
        startPosition: started?.position ?? -1,
      }
    },
    check(r, expect) {
      expect(r.countInClicks).toBe(4)
      expect(Math.abs(r.spacing - r.expectedSpacing), 'click spacing').toBeLessThanOrEqual(1)
      expect(Math.abs(r.downbeat - r.expectedDownbeat), 'downbeat frame').toBeLessThanOrEqual(1)
      expect(r.onDownbeat).toBe(true)
      expect(r.startPosition).toBe(start * sr)
      expect(Math.abs(r.heardOffsetMs), 'first click vs downbeat (ms)').toBeLessThanOrEqual(1)
    },
  })
}

// Muting a stem mid-note ramps (≈10 ms one-pole, so ≈22 ms from 90 % to 10 %) instead of stepping.
// The stretcher reacts to the level change with up to ~1.5× a steady sine's curvature; a stepped
// gain would show ~70× (a 0.125 jump against 0.0017).
function gainRamp() {
  const at = 2 * sr
  return scenario({
    name: 'gain ramp on mute',
    setup: () => ({
      seconds: 3,
      stems: [tone(sr, 4, 440, 0.5)],
      commands: [
        { type: 'play', countInBars: 0 },
        { type: 'gain', stem: 0, gain: 0, at },
      ],
    }),
    measure(output) {
      const window = Math.round(0.001 * sr)
      const level = rms(output, at - 0.5 * sr, at - 0.1 * sr)
      const envelope = (frame: number) => rms(output, frame, frame + window) / level
      let fall90 = -1
      let fall10 = -1
      for (let frame = at - 0.1 * sr; frame < at + 0.5 * sr; frame += window) {
        const value = envelope(frame)
        if (fall90 < 0 && value < 0.9) fall90 = frame
        if (fall10 < 0 && value < 0.1) fall10 = frame
      }
      return {
        finite: allFinite(output),
        fallMs: ((fall10 - fall90) / sr) * 1000,
        curvatureRatio:
          maxCurvature(output, at, at + 0.3 * sr) / maxCurvature(output, sr, at - 0.1 * sr),
        silentAfter: peak(output, at + 0.3 * sr, at + 0.5 * sr),
      }
    },
    check(r, expect) {
      expect(r.finite).toBe(true)
      expect(r.fallMs, '90→10 % fall (ms)').toBeGreaterThanOrEqual(5)
      expect(r.fallMs, '90→10 % fall (ms)').toBeLessThanOrEqual(80)
      expect(r.curvatureRatio, 'curvature during the ramp').toBeLessThanOrEqual(2)
      expect(r.silentAfter, 'level after mute').toBeLessThanOrEqual(1e-3)
    },
  })
}

export const scenarios: Scenario[] = [
  duration(0.5),
  duration(0.75),
  duration(1),
  pitch('pitch preserved at 0.5×', 0.5, 0),
  pitch('transpose +2 semitones', 1, 2),
  loopSeam(),
  clock(0.5),
  clock(0.75),
  clock(1),
  countIn(),
  gainRamp(),
]
