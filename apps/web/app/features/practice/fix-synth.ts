import {
  type ClockReading,
  type Due,
  LOOKAHEAD,
  type SynthEvent,
  SynthScheduler,
} from './model/synth-schedule'

// The audition synth (12 §4, §6 "Audition"; "Hear the chords" reuses it): a soft pluck for the
// transcribed notes and a softer held tone for a chord, scheduled from the audio engine's clock
// (model/synth-schedule.ts), so it stays on the loop at any speed. It plays into the engine's
// helpers input, so it sounds with the stems, outside their mixer, through the master volume and
// the limiter at 0 dBFS (12 §7).

export interface SynthClock {
  /** The engine's context and its helpers input, once the first play created the engine. */
  output(): { context: BaseAudioContext; input: AudioNode } | null
  read(): Omit<ClockReading, 'time'>
}

/** A context to play a one-off on ("Hear the tab"), at the master volume as a linear gain. */
export interface OnceClock {
  context(): BaseAudioContext | null
  volume(): number
}

const TICK_MS = (LOOKAHEAD * 1000) / 5
const LEVEL = { pluck: 0.22, pad: 0.1 }
const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

function sound(context: BaseAudioContext, out: AudioNode, due: Due): void {
  const { event } = due
  const at = Math.max(due.when, context.currentTime)
  const pad = event.voice === 'pad'
  const length = pad ? Math.min(4, due.duration) : Math.min(2, Math.max(0.15, due.duration))
  const peak = LEVEL[event.voice] / Math.sqrt(event.midi.length)
  for (const midi of event.midi) {
    const tone = context.createOscillator()
    const envelope = context.createGain()
    tone.type = 'triangle'
    tone.frequency.value = frequency(midi)
    envelope.gain.setValueAtTime(0, at)
    envelope.gain.linearRampToValueAtTime(peak, at + (pad ? 0.03 : 0.005))
    if (pad) {
      envelope.gain.setValueAtTime(peak, at + Math.max(0.04, length - 0.08))
      envelope.gain.linearRampToValueAtTime(0, at + length)
    } else {
      envelope.gain.exponentialRampToValueAtTime(0.001, at + length)
    }
    tone.connect(envelope).connect(out)
    tone.start(at)
    tone.stop(at + length + 0.02)
  }
}

export class FixSynth {
  readonly #clock: SynthClock
  readonly #scheduler = new SynthScheduler()
  #timer: ReturnType<typeof setInterval> | undefined
  #bus: { input: AudioNode; tone: BiquadFilterNode } | null = null

  constructor(clock: SynthClock) {
    this.#clock = clock
  }

  /** What to sound (timeline seconds); empty is silence. Takes effect for what is still ahead. */
  setEvents(events: readonly SynthEvent[]): void {
    this.#scheduler.setEvents(events)
    if (events.length > 0) this.#start()
    else this.stop()
  }

  #start(): void {
    this.#timer ??= setInterval(() => this.#tick(), TICK_MS)
  }

  #output(context: BaseAudioContext, input: AudioNode): AudioNode {
    if (this.#bus?.input !== input) {
      this.#bus?.tone.disconnect()
      // A soft top end: the synth sits behind the recording, it doesn't cut through it.
      const tone = context.createBiquadFilter()
      tone.type = 'lowpass'
      tone.frequency.value = 2400
      tone.connect(input)
      this.#bus = { input, tone }
    }
    return this.#bus.tone
  }

  #tick(): void {
    const output = this.#clock.output()
    if (!output) return
    const { context, input } = output
    const due = this.#scheduler.tick({ ...this.#clock.read(), time: context.currentTime })
    if (due.length === 0) return
    const out = this.#output(context, input)
    for (const item of due) sound(context, out, item)
  }

  /** Silence: nothing more is scheduled and what is ringing is cut. */
  stop(): void {
    clearInterval(this.#timer)
    this.#timer = undefined
    this.#scheduler.setEvents([])
    this.#bus?.tone.disconnect()
    this.#bus = null
  }
}

const MAX_SECONDS = 12

/**
 * "Hear the tab" (27 §3.7.4): a bar's notes once, at `rate`, on their own. Uses the engine's
 * context when there is one, else a short-lived one made in this gesture.
 */
export async function playOnce(
  events: readonly SynthEvent[],
  from: number,
  rate: number,
  clock: OnceClock,
): Promise<void> {
  if (events.length === 0 || typeof AudioContext === 'undefined') return
  const shared = clock.context()
  const context = shared ?? new AudioContext({ latencyHint: 'interactive' })
  if (context instanceof AudioContext) await context.resume().catch(() => undefined)
  const gain = context.createGain()
  gain.gain.value = clock.volume()
  gain.connect(context.destination)
  const start = context.currentTime + 0.05
  let end = start
  for (const event of events) {
    const when = start + (event.t - from) / rate
    if (when - start > MAX_SECONDS || when < start) continue
    const duration = event.duration / rate
    sound(context, gain, { event, when, duration })
    end = Math.max(end, when + Math.min(4, duration) + 0.05)
  }
  await new Promise((resolve) => setTimeout(resolve, (end - context.currentTime) * 1000 + 50))
  gain.disconnect()
  if (!shared && context instanceof AudioContext) await context.close()
}
