// Typed wrapper over dsp.wasm (packages/audio-dsp/include/splitune/dsp.h). Runs wherever the
// module is instantiated: the AudioWorklet in the browser, Node in tests.

interface DspExports {
  memory: WebAssembly.Memory
  _initialize(): void
  dsp_create(sampleRate: number, seed: number): number
  dsp_destroy(dsp: number): void
  dsp_alloc(bytes: number): number
  dsp_free(ptr: number): void
  dsp_stem_alloc(dsp: number, stem: number, frames: number): number
  dsp_stem_clear(dsp: number, stem: number): void
  dsp_duration(dsp: number): number
  dsp_set_gain(dsp: number, stem: number, gain: number): void
  dsp_set_rate(dsp: number, rate: number): void
  dsp_set_transpose(dsp: number, semitones: number, tonalityLimitHz: number): void
  dsp_set_loop(dsp: number, enabled: number, start: number, end: number): void
  dsp_set_beats(dsp: number, frames: number, downbeats: number, count: number): void
  dsp_set_metronome(dsp: number, enabled: number): void
  dsp_set_click_gain(dsp: number, gain: number): void
  dsp_set_quality(dsp: number, quality: number): void
  dsp_play(dsp: number, countInBars: number): void
  dsp_pause(dsp: number): void
  dsp_seek(dsp: number, frame: number): void
  dsp_process(dsp: number, frames: number): void
  dsp_output(dsp: number, channel: number): number
  dsp_event_count(dsp: number): number
  dsp_events(dsp: number): number
  dsp_heard(dsp: number, offset: number): number
  dsp_transport(dsp: number): number
  dsp_rate(dsp: number): number
  dsp_latency(dsp: number): number
  dsp_input_latency(dsp: number): number
  dsp_output_latency(dsp: number): number
}

export const MAX_STEMS = 8
export const MAX_BLOCK = 4096

export const DspEventType = {
  beat: 1,
  countInBeat: 2,
  started: 3,
  loopWrap: 4,
  ended: 5,
  stopped: 6,
} as const
export type DspEventType = (typeof DspEventType)[keyof typeof DspEventType]

export const Transport = { stopped: 0, countIn: 1, playing: 2 } as const
export type Transport = (typeof Transport)[keyof typeof Transport]

export const Quality = { default: 0, cheaper: 1 } as const
export type Quality = (typeof Quality)[keyof typeof Quality]

export interface DspEvent {
  type: DspEventType
  offset: number
  accent: boolean
  value: number
}

const EVENT_BYTES = 24

// Instantiates synchronously: the AudioWorklet scope can't fetch or await a compile, so the main
// thread compiles the module and hands it over.
export function instantiateDsp(module: WebAssembly.Module): DspExports {
  const instance = new WebAssembly.Instance(module, {
    env: { emscripten_notify_memory_growth: () => {} },
  })
  const exports = instance.exports as unknown as DspExports
  exports._initialize()
  return exports
}

export class Dsp {
  readonly #wasm: DspExports
  readonly #handle: number

  constructor(wasm: DspExports, sampleRate: number, seed = 1) {
    this.#wasm = wasm
    this.#handle = wasm.dsp_create(sampleRate, seed)
    if (this.#handle === 0) throw new Error('dsp_create failed')
  }

  destroy(): void {
    this.#wasm.dsp_destroy(this.#handle)
  }

  // Copies interleaved stereo Int16 PCM into the module's memory. False when memory runs out.
  loadStem(stem: number, pcm: Int16Array): boolean {
    const frames = pcm.length >> 1
    const ptr = this.#wasm.dsp_stem_alloc(this.#handle, stem, frames)
    if (ptr === 0) return false
    new Int16Array(this.#wasm.memory.buffer, ptr, frames * 2).set(pcm.subarray(0, frames * 2))
    return true
  }

  clearStem(stem: number): void {
    this.#wasm.dsp_stem_clear(this.#handle, stem)
  }

  get duration(): number {
    return this.#wasm.dsp_duration(this.#handle)
  }

  setGain(stem: number, gain: number): void {
    this.#wasm.dsp_set_gain(this.#handle, stem, gain)
  }

  setRate(rate: number): void {
    this.#wasm.dsp_set_rate(this.#handle, rate)
  }

  setTranspose(semitones: number, tonalityLimitHz: number): void {
    this.#wasm.dsp_set_transpose(this.#handle, semitones, tonalityLimitHz)
  }

  setLoop(loop: { start: number; end: number } | null): void {
    this.#wasm.dsp_set_loop(this.#handle, loop ? 1 : 0, loop?.start ?? 0, loop?.end ?? 0)
  }

  setBeats(frames: Float64Array, downbeats: Uint8Array): void {
    const count = Math.min(frames.length, downbeats.length)
    if (count === 0) {
      this.#wasm.dsp_set_beats(this.#handle, 0, 0, 0)
      return
    }
    const framesPtr = this.#wasm.dsp_alloc(count * 8)
    const downbeatsPtr = this.#wasm.dsp_alloc(count)
    if (framesPtr === 0 || downbeatsPtr === 0) {
      this.#wasm.dsp_free(framesPtr)
      this.#wasm.dsp_free(downbeatsPtr)
      throw new Error('dsp_alloc failed')
    }
    new Float64Array(this.#wasm.memory.buffer, framesPtr, count).set(frames.subarray(0, count))
    new Uint8Array(this.#wasm.memory.buffer, downbeatsPtr, count).set(downbeats.subarray(0, count))
    this.#wasm.dsp_set_beats(this.#handle, framesPtr, downbeatsPtr, count)
    this.#wasm.dsp_free(framesPtr)
    this.#wasm.dsp_free(downbeatsPtr)
  }

  setMetronome(enabled: boolean): void {
    this.#wasm.dsp_set_metronome(this.#handle, enabled ? 1 : 0)
  }

  setClickGain(gain: number): void {
    this.#wasm.dsp_set_click_gain(this.#handle, gain)
  }

  setQuality(quality: Quality): void {
    this.#wasm.dsp_set_quality(this.#handle, quality)
  }

  play(countInBars: number): void {
    this.#wasm.dsp_play(this.#handle, countInBars)
  }

  pause(): void {
    this.#wasm.dsp_pause(this.#handle)
  }

  seek(frame: number): void {
    this.#wasm.dsp_seek(this.#handle, frame)
  }

  // Renders a block; the returned views stay valid until the next call into the module.
  process(frames: number): [Float32Array, Float32Array] {
    this.#wasm.dsp_process(this.#handle, frames)
    const buffer = this.#wasm.memory.buffer
    return [
      new Float32Array(buffer, this.#wasm.dsp_output(this.#handle, 0), frames),
      new Float32Array(buffer, this.#wasm.dsp_output(this.#handle, 1), frames),
    ]
  }

  events(): DspEvent[] {
    const count = this.#wasm.dsp_event_count(this.#handle)
    if (count === 0) return []
    const view = new DataView(this.#wasm.memory.buffer, this.#wasm.dsp_events(this.#handle))
    const events: DspEvent[] = []
    for (let i = 0; i < count; i++) {
      const at = i * EVENT_BYTES
      events.push({
        type: view.getInt32(at, true) as DspEventType,
        offset: view.getInt32(at + 4, true),
        accent: view.getInt32(at + 8, true) !== 0,
        value: view.getFloat64(at + 16, true),
      })
    }
    return events
  }

  heard(offset = 0): number {
    return this.#wasm.dsp_heard(this.#handle, offset)
  }

  get transport(): Transport {
    return this.#wasm.dsp_transport(this.#handle) as Transport
  }

  get rate(): number {
    return this.#wasm.dsp_rate(this.#handle)
  }

  // Stretcher latency in source frames at the current rate.
  get latency(): number {
    return this.#wasm.dsp_latency(this.#handle)
  }

  get outputLatency(): number {
    return this.#wasm.dsp_output_latency(this.#handle)
  }
}
