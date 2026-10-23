// Main-thread engine API (docs/implementation/11-audio-engine.md). Owns the AudioContext and the
// SplituneProcessor node, speaks the command/event protocol, and turns position reports into the
// master clock. Public times are seconds on the decoded-PCM timeline.
import { dspUrl, processorUrl } from './assets.ts'
import {
  heardContextTime,
  type OutputTiming,
  PositionClock,
  performanceTimeOf,
  TimestampLag,
} from './clock.ts'
import { Quality } from './dsp.ts'
import { type MixerChannel, resolveGains } from './mixer.ts'
import { bindMediaSession, preferPlaybackAudioSession, ScreenWakeLock } from './platform.ts'
import {
  type Command,
  PROCESSOR_NAME,
  type ProcessorEvent,
  type ProcessorOptions,
  type Transport,
} from './protocol.ts'
import { initialTier, type Tier, type UnderrunEvent, UnderrunMonitor } from './tiers.ts'

export const CONTEXT_SAMPLE_RATE = 48000
export const MIN_RATE = 0.5
export const MAX_RATE = 1.5
export const MAX_DISPLAY_OFFSET = 0.15
const REPORT_SECONDS = 0.02
const GLITCH_CHECK_MS = 1000
const TONALITY_LIMIT_HZ = 8000
const VOLUME_RAMP = 0.015

export interface EngineOptions {
  // Defaults to a new AudioContext at 48 kHz (create the engine from a user gesture). Tests pass
  // an OfflineAudioContext.
  context?: BaseAudioContext
  // Defaults to dsp.wasm compiled once per page (loadDspModule).
  module?: WebAssembly.Module
  destination?: AudioNode
  // Starting CPU tier; defaults to initialTier() of this device.
  tier?: Tier
  // Step down a tier on underruns (default true); off for fixed-tier CPU measurements.
  adaptive?: boolean
  // Hold a Screen Wake Lock while playing (default true).
  keepScreenOn?: boolean
}

export interface BeatMarker {
  time: number
  downbeat: boolean
}

export interface EngineEvents {
  loaded: { stem: number; duration: number }
  started: { position: number; frame: number; at: number; downbeat: boolean }
  stopped: { position: number; frame: number }
  ended: { position: number; frame: number }
  loopWrap: { pass: number; frame: number; at: number }
  // Paused at the position given to setStopAt (seconds; `at` = performance time heard).
  stopReached: { position: number; frame: number; at: number }
  beat: { index: number; accent: boolean; frame: number; at: number }
  countIn: { index: number; accent: boolean; frame: number; at: number }
  // The browser suspended audio (iOS call, Siri, route change): show "Tap to resume".
  interrupted: { state: string }
  audio_underrun: UnderrunEvent
  load: { load: number }
  error: { message: string }
  // Every raw processor event, for diagnostics and the offline-render tests.
  processor: ProcessorEvent
}

type Listener<T> = (event: T) => void

let modulePromise: Promise<WebAssembly.Module> | undefined

// Fetches and compiles dsp.wasm once per page; can run before the first user gesture.
export function loadDspModule(url: string = dspUrl): Promise<WebAssembly.Module> {
  modulePromise ??= fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`dsp.wasm: HTTP ${response.status}`)
      return response.arrayBuffer()
    })
    .then((bytes) => WebAssembly.compile(bytes))
    .catch((error: unknown) => {
      modulePromise = undefined
      throw error
    })
  return modulePromise
}

export async function createEngine(options: EngineOptions = {}): Promise<Engine> {
  // Everything up to the first await runs inside the caller's user gesture (iOS unlock).
  const ownsContext = options.context === undefined
  const context =
    options.context ??
    new AudioContext({ latencyHint: 'interactive', sampleRate: CONTEXT_SAMPLE_RATE })
  if (context instanceof AudioContext) {
    preferPlaybackAudioSession()
    // Best effort while still in the gesture; play() resumes again and reports a failure.
    context.resume().catch(() => undefined)
  }
  const [module] = await Promise.all([
    options.module ?? loadDspModule(),
    context.audioWorklet.addModule(processorUrl),
  ])
  const processorOptions: ProcessorOptions = {
    module,
    reportInterval: Math.round(REPORT_SECONDS * context.sampleRate),
  }
  const node = new AudioWorkletNode(context, PROCESSOR_NAME, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    processorOptions,
  })
  // Master volume: a gain after the processor, so it scales the stems and the click together.
  const output = context.createGain()
  node.connect(output).connect(options.destination ?? context.destination)
  const tier =
    options.tier ??
    initialTier({
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
    })
  return new Engine(context, node, output, {
    ownsContext,
    tier,
    adaptive: options.adaptive ?? true,
    keepScreenOn: options.keepScreenOn ?? true,
  })
}

export class Engine {
  readonly context: BaseAudioContext
  readonly sampleRate: number
  readonly #node: AudioWorkletNode
  readonly #output: GainNode
  readonly #ownsContext: boolean
  readonly #clock = new PositionClock()
  readonly #timestampLag = new TimestampLag()
  readonly #listeners = new Map<keyof EngineEvents, Set<Listener<never>>>()
  readonly #pending = new Map<string, (event: ProcessorEvent) => void>()
  readonly #monitor: UnderrunMonitor
  readonly #wakeLock: ScreenWakeLock | null
  #ready: Promise<void>
  #duration = 0
  #transpose = 0
  #displayOffset = 0
  #flushId = 0
  #glitchTimer: ReturnType<typeof setInterval> | undefined
  #mediaSession: ReturnType<typeof bindMediaSession> = null

  constructor(
    context: BaseAudioContext,
    node: AudioWorkletNode,
    output: GainNode,
    options: { ownsContext: boolean; tier: Tier; adaptive: boolean; keepScreenOn: boolean },
  ) {
    this.context = context
    this.sampleRate = context.sampleRate
    this.#node = node
    this.#output = output
    this.#ownsContext = options.ownsContext
    this.#wakeLock =
      options.keepScreenOn && context instanceof AudioContext ? new ScreenWakeLock() : null
    this.#monitor = new UnderrunMonitor(
      options.tier,
      (event) => this.#applyTier(event),
      options.adaptive,
    )
    this.#ready = new Promise((resolve, reject) => {
      this.#pending.set('ready', (event) => {
        if (event.type === 'error') reject(new Error(event.message))
        else resolve()
      })
    })
    // A failed start is also reported as an `error` event, so nobody has to await `ready`.
    this.#ready.catch(() => undefined)
    node.port.onmessage = (event: MessageEvent<ProcessorEvent>) => this.#receive(event.data)
    node.onprocessorerror = () => this.#emit('error', { message: 'processor error' })
    if (context instanceof AudioContext) {
      context.addEventListener('statechange', this.#onStateChange)
    }
    if (options.tier !== 'high') this.#applyTier(undefined)
  }

  // Resolves once the processor has instantiated dsp.wasm (an OfflineAudioContext constructs it
  // only once rendering starts).
  get ready(): Promise<void> {
    return this.#ready
  }

  get duration(): number {
    return this.#duration / this.sampleRate
  }

  get transport(): Transport {
    return this.#clock.transport
  }

  get tier(): Tier {
    return this.#monitor.tier
  }

  on<K extends keyof EngineEvents>(type: K, listener: Listener<EngineEvents[K]>): () => void {
    let set = this.#listeners.get(type)
    if (!set) {
      set = new Set()
      this.#listeners.set(type, set)
    }
    set.add(listener as Listener<never>)
    return () => set.delete(listener as Listener<never>)
  }

  // Low-level access to the protocol (tests schedule commands at exact frames with `at`).
  send(command: Command, transfer: Transferable[] = []): void {
    this.#node.port.postMessage(command, transfer)
  }

  // Resolves with the frame of the quantum in which every earlier command had been applied.
  flush(): Promise<number> {
    const id = ++this.#flushId
    return new Promise((resolve) => {
      this.#pending.set(`flushed:${id}`, (event) =>
        resolve(event.type === 'flushed' ? event.frame : 0),
      )
      this.send({ type: 'flush', id })
    })
  }

  // Loads interleaved stereo Int16 PCM at the context rate (decodeStem output). The PCM's buffer
  // is transferred to the worklet, so the caller's array is detached afterwards.
  loadStem(stem: number, pcm: Int16Array): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#pending.set(`loaded:${stem}`, (event) => {
        if (event.type === 'loaded') {
          this.#duration = event.duration
          this.#emit('loaded', { stem, duration: event.duration / this.sampleRate })
          resolve()
        } else {
          reject(new Error(`stem ${stem} did not fit in memory`))
        }
      })
      this.send({ type: 'load', stem, pcm }, [pcm.buffer])
    })
  }

  unloadStem(stem: number): void {
    this.send({ type: 'unload', stem })
  }

  setGain(stem: number, gain: number): void {
    this.send({ type: 'gain', stem, gain })
  }

  setMixer(channels: MixerChannel[]): void {
    resolveGains(channels).forEach((gain, stem) => {
      this.setGain(stem, gain)
    })
  }

  setRate(rate: number): void {
    this.send({ type: 'rate', rate: Math.min(MAX_RATE, Math.max(MIN_RATE, rate)) })
  }

  // Playback key in semitones; ignored (0) on the low CPU tier.
  setTranspose(semitones: number): void {
    this.#transpose = semitones
    this.#sendTranspose()
  }

  setLoop(loop: { start: number; end: number } | null): void {
    const frames = loop
      ? {
          start: Math.round(loop.start * this.sampleRate),
          end: Math.round(loop.end * this.sampleRate),
        }
      : null
    this.#clock.setLoop(frames)
    this.send({ type: 'loop', loop: frames })
  }

  setBeatGrid(beats: readonly BeatMarker[]): void {
    const frames = new Float64Array(beats.map((beat) => beat.time * this.sampleRate))
    const downbeats = new Uint8Array(beats.map((beat) => (beat.downbeat ? 1 : 0)))
    this.send({ type: 'beats', frames, downbeats }, [frames.buffer, downbeats.buffer])
  }

  setMetronome(enabled: boolean): void {
    this.send({ type: 'metronome', enabled })
  }

  setClickVolume(gain: number): void {
    this.send({ type: 'clickGain', gain })
  }

  // Linear master gain over everything heard; a short ramp so a dragged slider doesn't click.
  setVolume(gain: number): void {
    this.#output.gain.setTargetAtTime(Math.max(0, gain), this.context.currentTime, VOLUME_RAMP)
  }

  // Bluetooth headphones and odd devices: shifts the clock by ±150 ms (settings slider).
  setDisplayOffset(seconds: number): void {
    this.#displayOffset = Math.min(MAX_DISPLAY_OFFSET, Math.max(-MAX_DISPLAY_OFFSET, seconds))
  }

  async play(options: { countInBars?: number } = {}): Promise<void> {
    if (this.context instanceof AudioContext && this.context.state !== 'running') {
      try {
        await this.context.resume()
      } catch (error) {
        // Disposed while resuming (the page left right after the tap): nothing to play any more.
        if (this.context.state === 'closed') return
        throw error
      }
    }
    this.send({ type: 'play', countInBars: options.countInBars ?? 0 })
    void this.#wakeLock?.acquire()
  }

  pause(): void {
    this.send({ type: 'pause' })
  }

  seek(seconds: number): void {
    this.send({ type: 'seek', position: Math.round(seconds * this.sampleRate) })
  }

  // Pauses when the heard position reaches `seconds` (a loop end with a rest after it, where the
  // seamless loop wrap must not happen); null cancels. One-shot: cleared once it fires.
  setStopAt(seconds: number | null): void {
    this.send({
      type: 'stopAt',
      position: seconds === null ? null : Math.round(seconds * this.sampleRate),
    })
  }

  // The heard position in seconds (what the listener hears at performance time `now`).
  position(now: number = performance.now()): number {
    const heard = heardContextTime(this.#timing(now)) - this.#displayOffset
    return this.#clock.sourceAt(heard * this.sampleRate) / this.sampleRate
  }

  // Performance time (ms) at which an AudioContext frame from an event is heard.
  timeOf(frame: number, now: number = performance.now()): number {
    return performanceTimeOf(frame / this.sampleRate + this.#displayOffset, this.#timing(now))
  }

  setMediaMetadata(metadata: { title: string; artist?: string } | null): void {
    this.#mediaSession?.dispose()
    this.#mediaSession = metadata
      ? bindMediaSession(metadata, {
          play: () => void this.play(),
          pause: () => this.pause(),
          seekTo: (seconds) => this.seek(seconds),
          seekBy: (seconds) => this.seek(Math.max(0, this.position() + seconds)),
        })
      : null
  }

  async dispose(): Promise<void> {
    this.#stopGlitchChecks()
    this.#mediaSession?.dispose()
    this.#wakeLock?.dispose()
    this.#node.port.onmessage = null
    this.#node.disconnect()
    this.#output.disconnect()
    if (this.context instanceof AudioContext) {
      this.context.removeEventListener('statechange', this.#onStateChange)
      if (this.#ownsContext) await this.context.close()
    }
  }

  #timing(now: number): OutputTiming {
    const context = this.context
    if (!(context instanceof AudioContext)) return { now, currentTime: context.currentTime }
    const timestamp = context.getOutputTimestamp?.()
    return {
      now,
      currentTime: context.currentTime,
      timestamp,
      outputLatency: context.outputLatency,
      baseLatency: context.baseLatency,
      timestampLag: this.#timestampLag.update(context.currentTime, timestamp),
    }
  }

  #receive(event: ProcessorEvent): void {
    this.#emit('processor', event)
    switch (event.type) {
      case 'ready':
        this.#resolve('ready', event)
        return
      case 'error':
        this.#resolve('ready', event)
        this.#emit('error', { message: event.message })
        return
      case 'loaded':
      case 'loadFailed':
        this.#resolve(`loaded:${event.stem}`, event)
        return
      case 'flushed':
        this.#resolve(`flushed:${event.id}`, event)
        return
      case 'position':
        this.#clock.push(event)
        return
      case 'load':
        this.#monitor.load(event.load)
        this.#emit('load', { load: event.load })
        return
      case 'started':
        this.#startGlitchChecks()
        this.#updateMediaSession(true, event.position)
        this.#emit('started', {
          position: event.position / this.sampleRate,
          frame: event.frame,
          at: this.timeOf(event.frame),
          downbeat: event.downbeat,
        })
        return
      case 'stopped':
      case 'ended':
        this.#stopGlitchChecks()
        void this.#wakeLock?.release()
        this.#updateMediaSession(false, event.position)
        this.#emit(event.type, { position: event.position / this.sampleRate, frame: event.frame })
        return
      case 'stopReached':
        this.#emit('stopReached', {
          position: event.position / this.sampleRate,
          frame: event.frame,
          at: this.timeOf(event.frame),
        })
        return
      case 'loopWrap':
        this.#emit('loopWrap', {
          pass: event.pass,
          frame: event.frame,
          at: this.timeOf(event.frame),
        })
        return
      case 'beat':
      case 'countIn':
        this.#emit(event.type, {
          index: event.index,
          accent: event.accent,
          frame: event.frame,
          at: this.timeOf(event.frame),
        })
        return
    }
  }

  #resolve(key: string, event: ProcessorEvent): void {
    const pending = this.#pending.get(key)
    if (!pending) return
    this.#pending.delete(key)
    pending(event)
  }

  #emit<K extends keyof EngineEvents>(type: K, event: EngineEvents[K]): void {
    for (const listener of this.#listeners.get(type) ?? [])
      (listener as Listener<EngineEvents[K]>)(event)
  }

  #updateMediaSession(playing: boolean, position: number): void {
    this.#mediaSession?.update({
      playing,
      position: position / this.sampleRate,
      duration: this.duration,
      rate: this.#clock.rate,
    })
  }

  readonly #onStateChange = () => {
    const context = this.context as AudioContext
    // Safari reports "interrupted" (calls, Siri); others "suspended". Either way audio stopped
    // under us: pause the transport so resuming starts cleanly from where it was.
    if (context.state !== 'running' && this.#clock.transport !== 'stopped') {
      this.pause()
      this.#emit('interrupted', { state: context.state })
    }
    this.#monitor.reset()
  }

  #startGlitchChecks(): void {
    if (!(this.context instanceof AudioContext) || this.#glitchTimer !== undefined) return
    const context = this.context
    this.#monitor.reset()
    this.#glitchTimer = setInterval(() => {
      if (context.state === 'running') this.#monitor.sample(context.currentTime, performance.now())
    }, GLITCH_CHECK_MS)
  }

  #stopGlitchChecks(): void {
    clearInterval(this.#glitchTimer)
    this.#glitchTimer = undefined
    this.#monitor.reset()
  }

  #sendTranspose(): void {
    const semitones = this.#monitor.tier === 'low' ? 0 : this.#transpose
    this.send({ type: 'transpose', semitones, tonalityLimitHz: TONALITY_LIMIT_HZ })
  }

  #applyTier(event: UnderrunEvent | undefined): void {
    const tier = this.#monitor.tier
    this.send({ type: 'quality', quality: tier === 'high' ? Quality.default : Quality.cheaper })
    if (tier === 'low') this.#sendTranspose()
    if (event) this.#emit('audio_underrun', event)
  }
}
