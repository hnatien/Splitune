import {
  chordShapes,
  parseChord,
  pcOfName,
  STANDARD_GUITAR_TUNING,
  transposeChord,
} from '@splitune/music-core'

// The audition synth's timing (12 §4, §6 "Audition"): what to sound, and when, read from the audio
// engine's clock. Events sit on the song's timeline (seconds on the decoded PCM); a tick maps the
// ones coming up in a short window to AudioContext times from the heard position and the playback
// rate, following the loop's wrap, so the synth stays on the loop at any speed without owning a
// transport. Pure: the Web Audio side is fix-synth.ts.

export interface SynthEvent {
  /** Timeline seconds. */
  t: number
  /** Timeline seconds (played at the engine's rate). */
  duration: number
  midi: readonly number[]
  /** A tab note, or an auditioned chord. */
  voice: 'pluck' | 'pad'
}

export interface ClockReading {
  /** Heard timeline position now (seconds). */
  position: number
  /** AudioContext.currentTime now. */
  time: number
  rate: number
  playing: boolean
  loop: { start: number; end: number } | null
}

export interface Due {
  event: SynthEvent
  /** AudioContext time to start at. */
  when: number
  /** Seconds it sounds for at this rate. */
  duration: number
}

/** How far ahead a tick schedules (AudioContext seconds); ticks come several times within it. */
export const LOOKAHEAD = 0.15
// A position this far (timeline seconds) from where the clock should be is a seek, not jitter.
const JUMP = 0.08

/**
 * Events starting in [from, to) with their unwrapped start times: `from` and `to` are timeline
 * seconds on the current pass, so inside a loop a window that runs past the loop's end takes in
 * the start of the next pass.
 */
export function dueEvents(
  events: readonly SynthEvent[],
  from: number,
  to: number,
  loop: { start: number; end: number } | null,
): { event: SynthEvent; at: number }[] {
  const length = loop ? loop.end - loop.start : 0
  if (!loop || length <= 0) {
    return events.filter((e) => e.t >= from && e.t < to).map((event) => ({ event, at: event.t }))
  }
  const due: { event: SynthEvent; at: number }[] = []
  const first = Math.max(0, Math.floor((from - loop.start) / length))
  const last = Math.max(first, Math.floor((to - loop.start) / length))
  for (let pass = first; pass <= last; pass++) {
    for (const event of events) {
      if (event.t < loop.start || event.t >= loop.end) continue
      const at = event.t + pass * length
      if (at >= from && at < to) due.push({ event, at })
    }
  }
  return due.sort((a, b) => a.at - b.at)
}

export class SynthScheduler {
  #events: readonly SynthEvent[] = []
  /** Everything before this (timeline seconds on the current pass) is already scheduled. */
  #horizon: number | null = null
  #last: { position: number; time: number } | null = null

  setEvents(events: readonly SynthEvent[]): void {
    this.#events = events
  }

  /** What to start now for the window ahead; call every few tens of milliseconds. */
  tick(clock: ClockReading): Due[] {
    if (!clock.playing || clock.rate <= 0) {
      this.#horizon = null
      this.#last = null
      return []
    }
    const length = clock.loop ? clock.loop.end - clock.loop.start : 0
    if (this.#last && this.#horizon !== null) {
      const expected = this.#last.position + (clock.time - this.#last.time) * clock.rate
      if (length > 0 && Math.abs(clock.position - (expected - length)) < JUMP) {
        // The loop wrapped: the next pass' start was scheduled as "past the end".
        this.#horizon -= length
      } else if (Math.abs(clock.position - expected) > JUMP) {
        this.#horizon = null
      }
    }
    this.#last = { position: clock.position, time: clock.time }
    const from = Math.max(this.#horizon ?? clock.position, clock.position)
    const to = clock.position + LOOKAHEAD * clock.rate
    if (to <= from) return []
    this.#horizon = to
    return dueEvents(this.#events, from, to, clock.loop).map(({ event, at }) => ({
      event,
      when: clock.time + (at - clock.position) / clock.rate,
      duration: event.duration / clock.rate,
    }))
  }
}

/**
 * A chord as the notes a learner would play: on guitar in standard tuning its first shape, as on
 * the chord diagram; otherwise (and for chords without a shape) its tones stacked from the bass
 * up, around middle C.
 */
export function chordVoicing(
  label: string,
  options: { bass?: string | undefined; guitar?: boolean; capo?: number } = {},
): number[] {
  const parsed = parseChord(label)
  if (parsed?.kind !== 'chord') return []
  // The shape is fretted above the capo, so it is the chord a capo's worth lower.
  const shape = options.guitar
    ? chordShapes(transposeChord(label, -(options.capo ?? 0)))[0]
    : undefined
  if (shape) {
    // frets[0] is string 1, as the tuning's first entry.
    return shape.frets
      .flatMap((fret, index) => {
        const open = STANDARD_GUITAR_TUNING[index]
        return fret === null || open === undefined ? [] : [open + fret + (options.capo ?? 0)]
      })
      .sort((x, y) => x - y)
  }
  const bassPc = options.bass
    ? (pcOfName(options.bass) ?? parsed.root)
    : (parsed.bassPc ?? parsed.root)
  const bass = 36 + bassPc
  const tones = parsed.pitchClasses
    .map((pc) => 48 + parsed.root + ((pc - parsed.root + 12) % 12))
    .sort((x, y) => x - y)
  return [bass, ...tones]
}

/** An auditioned chord over its part of the loop: struck on every beat it covers. */
export function chordEvents(
  midi: readonly number[],
  beats: readonly number[],
  span: { start: number; end: number },
): SynthEvent[] {
  if (midi.length === 0) return []
  const inside = beats.filter((t) => t >= span.start - 1e-3 && t < span.end - 1e-3)
  return inside.map((t, index) => ({
    t,
    duration: Math.max(0.2, (inside[index + 1] ?? span.end) - t),
    midi,
    voice: 'pad' as const,
  }))
}

/** The transcribed part as synth notes (their played timing, so they sit on the recording). */
export function noteEvents(
  notes: readonly { onset: number; offset: number; pitch: number }[],
): SynthEvent[] {
  return notes.map((note) => ({
    t: note.onset,
    duration: Math.max(0.12, note.offset - note.onset),
    midi: [note.pitch],
    voice: 'pluck' as const,
  }))
}
