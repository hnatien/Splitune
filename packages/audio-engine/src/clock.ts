// Master clock (docs/specs/11-audio-engine.md §3). The worklet reports the source frame
// leaving it at an AudioContext frame (stretcher latency already compensated); the main thread
// works out which context frame the listener hears now and extrapolates from the reports.
import type { ProcessorEvent, Transport } from './protocol.ts'

export type PositionReport = Omit<Extract<ProcessorEvent, { type: 'position' }>, 'type'>

export interface OutputTiming {
  // performance.now() in ms.
  now: number
  currentTime: number
  // AudioContext.getOutputTimestamp(), where implemented.
  timestamp?: AudioTimestamp | undefined
  // AudioContext.outputLatency / baseLatency in seconds, where implemented.
  outputLatency?: number | undefined
  baseLatency?: number | undefined
  // How far the timestamp's context time trails currentTime (seconds, smoothed; see
  // TimestampLag): the part of the output latency the timestamp already includes.
  timestampLag?: number | undefined
}

const hasTimestamp = (
  timestamp: AudioTimestamp | undefined,
): timestamp is Required<AudioTimestamp> =>
  !!timestamp?.performanceTime && timestamp.contextTime !== undefined && timestamp.contextTime > 0

// Context time of the audio leaving the device at `now`. getOutputTimestamp() gives a smooth
// context ↔ performance time mapping, but browsers disagree on what it includes: Chromium's
// context time trails currentTime by outputLatency + baseLatency (measured 29.3 ms of 29.3 ms on
// a MacBook Air), WebKit's by almost nothing (0.1–2.7 ms of 15.5 ms). So the reported latency the
// timestamp doesn't already account for is subtracted on top. Without a timestamp (before output
// starts, or unsupported), currentTime minus the reported latency stands in.
export function heardContextTime(timing: OutputTiming): number {
  const latency =
    timing.outputLatency === undefined
      ? undefined
      : timing.outputLatency + (timing.baseLatency ?? 0)
  const { timestamp } = timing
  if (hasTimestamp(timestamp)) {
    const presented = timestamp.contextTime + (timing.now - timestamp.performanceTime) / 1000
    const included = timing.timestampLag ?? latency ?? 0
    return presented - Math.max(0, (latency ?? 0) - included)
  }
  return timing.currentTime - (latency ?? 0)
}

// Smooths currentTime − getOutputTimestamp().contextTime, which jumps with each render callback.
export class TimestampLag {
  #value: number | undefined

  update(currentTime: number, timestamp: AudioTimestamp | undefined): number | undefined {
    if (!hasTimestamp(timestamp)) return this.#value
    const lag = Math.max(0, currentTime - timestamp.contextTime)
    this.#value = this.#value === undefined ? lag : this.#value + (lag - this.#value) * 0.05
    return this.#value
  }
}

// Performance time (ms) at which a context time is heard: the inverse of heardContextTime.
export function performanceTimeOf(contextTime: number, timing: OutputTiming): number {
  return timing.now + (contextTime - heardContextTime(timing)) * 1000
}

const KEEP_REPORTS = 256 // ~5 s at one report per 20 ms; covers any output latency

export class PositionClock {
  #reports: PositionReport[] = []
  #loop: { start: number; end: number } | null = null

  push(report: PositionReport): void {
    const reports = this.#reports
    // Reports arrive in frame order; a restarted context (frame going back) starts over.
    if ((reports.at(-1)?.frame ?? Number.NEGATIVE_INFINITY) > report.frame) reports.length = 0
    reports.push(report)
    if (reports.length > KEEP_REPORTS) reports.splice(0, reports.length - KEEP_REPORTS)
  }

  setLoop(loop: { start: number; end: number } | null): void {
    this.#loop = loop
  }

  get transport(): Transport {
    return this.#reports.at(-1)?.transport ?? 'stopped'
  }

  get rate(): number {
    return this.#reports.at(-1)?.rate ?? 1
  }

  // Source frame heard at a context frame: the latest report at or before it, extrapolated at its
  // rate while playing and wrapped into the loop when it was inside the loop.
  sourceAt(frame: number): number {
    const reports = this.#reports
    let index = reports.length - 1
    while (index > 0 && (reports[index]?.frame ?? 0) > frame) index--
    const report = reports[index]
    if (!report) return 0
    if (report.transport !== 'playing' || frame <= report.frame) return report.heard
    const position = report.heard + (frame - report.frame) * report.rate
    const loop = this.#loop
    if (loop && report.heard >= loop.start && report.heard < loop.end && position >= loop.end) {
      return loop.start + ((position - loop.start) % (loop.end - loop.start))
    }
    return position
  }
}
