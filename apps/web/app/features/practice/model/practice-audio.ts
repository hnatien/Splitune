import type { BeatMarker, Engine, EngineEvents } from '@splitune/audio-engine'
import type { PlayerEngine } from './player-machine'

// The practice screen's side of the audio engine (11, 12 §6). Audio is decoded as soon as it's
// known (stems, or the song's own audio before stems exist), but the AudioContext only exists from
// the first gesture (iOS unlocks audio there): play() creates the engine inside that gesture and
// every command sent before is mirrored and applied once it's up. The engine module itself loads
// after the page renders, outside the route's JS budget (12 §10).

type EngineModule = typeof import('@splitune/audio-engine')

let enginePromise: Promise<EngineModule> | undefined
let engineModule: EngineModule | undefined
const loadEngine = () => {
  enginePromise ??= import('@splitune/audio-engine').then((module) => {
    engineModule = module
    return module
  })
  return enginePromise
}

export type LaneRole = 'part' | 'backing' | 'mix'

export interface Lane {
  id: string
  role: LaneRole
  /** Min/max pairs of the mono mix per block. */
  peaks: Float32Array
  /** RMS per block. */
  rms: Float32Array
  /** Seconds per block. */
  blockSeconds: number
}

export interface AudioInput {
  id: string
  role: LaneRole
  bytes: ArrayBuffer
}

/** A mixer channel in dB; the engine gets linear gains. */
export interface ChannelMix {
  gainDb: number
  muted: boolean
  soloed: boolean
  soloGainDb?: number
}

export type AudioEvent =
  | { type: 'started' }
  | { type: 'loopWrap' }
  | { type: 'stopReached' }
  | { type: 'ended' }
  | { type: 'interrupted' }
  | { type: 'beat'; accent: boolean; at: number }
  | { type: 'countIn'; index: number; accent: boolean; at: number }
  | { type: 'underrun'; event: EngineEvents['audio_underrun'] }

function rmsOf(pcm: Int16Array, frames: number, block: number): Float32Array {
  const blocks = Math.ceil(frames / block)
  const out = new Float32Array(blocks)
  for (let b = 0; b < blocks; b++) {
    let sum = 0
    const end = Math.min(frames, (b + 1) * block)
    for (let i = b * block; i < end; i++) {
      const mono = ((pcm[2 * i] ?? 0) + (pcm[2 * i + 1] ?? 0)) / 65536
      sum += mono * mono
    }
    out[b] = Math.sqrt(sum / Math.max(1, end - b * block))
  }
  return out
}

export class PracticeAudio implements PlayerEngine {
  #engine: Engine | null = null
  #creating: Promise<Engine> | null = null
  #pending: Int16Array[] = []
  #loadedCount = 0
  #rate = 1
  #loop: { start: number; end: number } | null = null
  #stopAt: number | null = null
  #metronome = false
  #displayOffset = 0
  #volume = 1
  #position = 0
  #beats: BeatMarker[] = []
  #mixer: ChannelMix[] = []
  #duration = 0
  #title: string | null = null
  #listener: (event: AudioEvent) => void = () => undefined
  #offs: (() => void)[] = []
  #wakeLock: { acquire(): Promise<boolean>; release(): Promise<void> } | null = null
  #cueContext: AudioContext | null = null
  lanes: Lane[] = []

  constructor() {
    // Compile dsp.wasm before any gesture, so the first play starts quickly.
    void loadEngine()
      .then((engine) => engine.loadDspModule())
      .catch(() => undefined)
  }

  onEvent(listener: (event: AudioEvent) => void) {
    this.#listener = listener
  }

  get duration(): number {
    return this.#duration
  }

  get started(): boolean {
    return this.#engine !== null
  }

  /**
   * Keeps the screen on while the practice screen is open (12 §1), where supported. False when
   * this browser can't (no Wake Lock, or the request was refused).
   */
  async keepScreenOn(): Promise<boolean> {
    const { ScreenWakeLock } = await loadEngine()
    this.#wakeLock = new ScreenWakeLock()
    return this.#wakeLock.acquire()
  }

  /** Decodes new audio at the engine's rate; it replaces what's loaded on the next play. */
  async prepare(inputs: AudioInput[], durationSeconds?: number): Promise<Lane[]> {
    const { CONTEXT_SAMPLE_RATE, PEAK_BLOCK, decodeStem } = await loadEngine()
    const decoded = await Promise.all(
      inputs.map((input) =>
        decodeStem(input.bytes, {
          sampleRate: CONTEXT_SAMPLE_RATE,
          ...(durationSeconds === undefined ? {} : { durationSeconds }),
        }),
      ),
    )
    this.#duration = (decoded[0]?.frames ?? 0) / CONTEXT_SAMPLE_RATE
    this.lanes = decoded.map((stem, i) => ({
      id: inputs[i]?.id ?? String(i),
      role: inputs[i]?.role ?? 'mix',
      peaks: stem.peaks,
      rms: rmsOf(stem.pcm, stem.frames, PEAK_BLOCK),
      blockSeconds: PEAK_BLOCK / CONTEXT_SAMPLE_RATE,
    }))
    this.#pending = decoded.map((stem) => stem.pcm)
    if (this.#engine) await this.#load(this.#engine)
    return this.lanes
  }

  async #load(engine: Engine) {
    const pcm = this.#pending
    this.#pending = []
    if (pcm.length === 0) return
    for (let i = pcm.length; i < this.#loadedCount; i++) engine.unloadStem(i)
    await Promise.all(pcm.map((data, i) => engine.loadStem(i, data)))
    this.#loadedCount = pcm.length
    await this.#applyMixer(engine)
    engine.seek(this.#position)
  }

  async #applyMixer(engine: Engine) {
    const { dbToGain } = await loadEngine()
    engine.setMixer(
      this.#mixer.map((c) => ({
        gain: dbToGain(c.gainDb),
        muted: c.muted,
        soloed: c.soloed,
        ...(c.soloGainDb === undefined ? {} : { soloGain: dbToGain(c.soloGainDb) }),
      })),
    )
  }

  #ensure(): Promise<Engine> {
    // createEngine runs synchronously up to its first await, so it must be called inside the
    // caller's gesture (iOS): with the module in (requested when the page opens), it is.
    this.#creating ??= engineModule
      ? this.#start(engineModule.createEngine())
      : loadEngine().then((module) => this.#start(module.createEngine()))
    return this.#creating
  }

  async #start(created: Promise<Engine>): Promise<Engine> {
    const engine = await created
    this.#engine = engine
    const emit = (event: AudioEvent) => this.#listener(event)
    this.#offs = [
      engine.on('started', () => emit({ type: 'started' })),
      engine.on('loopWrap', () => emit({ type: 'loopWrap' })),
      engine.on('stopReached', () => emit({ type: 'stopReached' })),
      engine.on('ended', () => emit({ type: 'ended' })),
      engine.on('interrupted', () => emit({ type: 'interrupted' })),
      engine.on('beat', (e) => emit({ type: 'beat', accent: e.accent, at: e.at })),
      engine.on('countIn', (e) =>
        emit({ type: 'countIn', index: e.index, accent: e.accent, at: e.at }),
      ),
      engine.on('audio_underrun', (event) => emit({ type: 'underrun', event })),
    ]
    engine.setRate(this.#rate)
    engine.setBeatGrid(this.#beats)
    engine.setMetronome(this.#metronome)
    engine.setLoop(this.#loop)
    engine.setStopAt(this.#stopAt)
    engine.setDisplayOffset(this.#displayOffset)
    engine.setVolume(this.#volume)
    if (this.#title) engine.setMediaMetadata({ title: this.#title })
    await engine.ready
    await this.#load(engine)
    return engine
  }

  // PlayerEngine: every command is applied now or mirrored for the engine to come.
  play(countInBars: number): void {
    void this.#ensure().then((engine) => engine.play({ countInBars }))
  }

  pause(): void {
    this.#engine?.pause()
  }

  seek(seconds: number): void {
    this.#position = Math.max(0, seconds)
    this.#engine?.seek(this.#position)
  }

  setRate(rate: number): void {
    this.#rate = rate
    this.#engine?.setRate(rate)
  }

  setLoop(loop: { start: number; end: number } | null): void {
    this.#loop = loop
    this.#engine?.setLoop(loop)
  }

  setStopAt(seconds: number | null): void {
    this.#stopAt = seconds
    this.#engine?.setStopAt(seconds)
  }

  setMetronome(on: boolean): void {
    this.#metronome = on
    this.#engine?.setMetronome(on)
  }

  /** The learner's sound delay (Bluetooth headphones): the cursor follows what is heard. */
  setDisplayOffset(seconds: number): void {
    this.#displayOffset = seconds
    this.#engine?.setDisplayOffset(seconds)
  }

  /** Master volume as a linear gain over the stems and the click. */
  setVolume(gain: number): void {
    this.#volume = gain
    this.#engine?.setVolume(gain)
  }

  position(): number {
    return this.#engine ? this.#engine.position() : this.#position
  }

  playing(): boolean {
    return this.#engine?.transport === 'playing'
  }

  setBeats(beats: BeatMarker[]): void {
    this.#beats = beats
    this.#engine?.setBeatGrid(beats)
  }

  setMixer(channels: ChannelMix[]): void {
    this.#mixer = channels
    if (this.#engine) void this.#applyMixer(this.#engine)
  }

  setTitle(title: string): void {
    this.#title = title
    this.#engine?.setMediaMetadata({ title })
  }

  /** A sine at `pitch` (MIDI): the note a singer pitches a phrase from (step 18c). It sounds over
   * the stems, outside their mixer, at the master volume; before the first play it gets a context
   * of its own, created in this gesture. */
  cue(pitch: number, seconds = 0.9): void {
    if (!this.#engine && !this.#cueContext) this.#cueContext = new AudioContext()
    const context = this.#engine?.context ?? this.#cueContext
    if (!context) return
    const at = context.currentTime
    const tone = context.createOscillator()
    const envelope = context.createGain()
    const peak = 0.25 * this.#volume
    tone.frequency.value = 440 * 2 ** ((pitch - 69) / 12)
    envelope.gain.setValueAtTime(0, at)
    envelope.gain.linearRampToValueAtTime(peak, at + 0.02)
    envelope.gain.setValueAtTime(peak, at + seconds - 0.08)
    envelope.gain.linearRampToValueAtTime(0, at + seconds)
    tone.connect(envelope).connect(context.destination)
    tone.start(at)
    tone.stop(at + seconds + 0.02)
  }

  /** The engine once the first gesture created it (diagnostics and tests). */
  get engine(): Engine | null {
    return this.#engine
  }

  async dispose(): Promise<void> {
    for (const off of this.#offs) off()
    void this.#wakeLock?.release()
    void this.#cueContext?.close()
    const engine = this.#engine ?? (this.#creating ? await this.#creating.catch(() => null) : null)
    this.#engine = null
    this.#creating = null
    await engine?.dispose()
  }
}
