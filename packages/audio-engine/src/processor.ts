// SplituneProcessor: the AudioWorklet shell around ProcessorCore. Loaded with
// audioWorklet.addModule(); dsp.wasm arrives compiled in processorOptions because the worklet
// scope can't fetch.
import { ProcessorCore } from './core.ts'
import {
  type Command,
  PROCESSOR_NAME,
  type ProcessorEvent,
  type ProcessorOptions,
} from './protocol.ts'

interface WorkletProcessor {
  readonly port: MessagePort
}

// AudioWorkletGlobalScope, which the DOM lib doesn't describe.
const scope = globalThis as unknown as {
  AudioWorkletProcessor: new (options?: AudioWorkletNodeOptions) => WorkletProcessor
  registerProcessor(
    name: string,
    processor: new (options: AudioWorkletNodeOptions) => unknown,
  ): void
  currentFrame: number
  sampleRate: number
  performance?: { now(): number }
}

const now = scope.performance ? () => (scope.performance as { now(): number }).now() : Date.now

class SplituneProcessor extends scope.AudioWorkletProcessor {
  readonly #core: ProcessorCore | undefined

  constructor(options: AudioWorkletNodeOptions) {
    super(options)
    const { module, reportInterval } = options.processorOptions as ProcessorOptions
    const post = (event: ProcessorEvent) => this.port.postMessage(event)
    try {
      this.#core = new ProcessorCore(module, scope.sampleRate, reportInterval, post, now)
    } catch (error) {
      post({ type: 'error', message: String(error) })
    }
    this.port.onmessage = (event: MessageEvent<Command>) => this.#core?.receive(event.data)
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const [left, right] = outputs[0] ?? []
    if (this.#core && left) this.#core.render(scope.currentFrame, left, right ?? left)
    return true
  }
}

scope.registerProcessor(PROCESSOR_NAME, SplituneProcessor)
