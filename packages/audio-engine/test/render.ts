// Node renderer for the scenarios: ProcessorCore with the built dsp.wasm, 128-frame quanta.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { ProcessorCore } from '../src/core.ts'
import type { ProcessorEvent } from '../src/protocol.ts'
import type { Setup } from './scenarios.ts'

const require = createRequire(import.meta.url)
export const dspModule = new WebAssembly.Module(
  readFileSync(require.resolve('@splitune/audio-dsp/dsp.wasm')),
)

const QUANTUM = 128

export function render(setup: Setup, sampleRate: number) {
  const events: ProcessorEvent[] = []
  const core = new ProcessorCore(
    dspModule,
    sampleRate,
    Math.round(0.02 * sampleRate),
    (event) => events.push(event),
    () => performance.now(),
  )
  setup.stems.forEach((pcm, stem) => {
    core.receive({ type: 'load', stem, pcm })
  })
  for (const command of setup.commands) core.receive(command)
  const frames = Math.ceil((setup.seconds * sampleRate) / QUANTUM) * QUANTUM
  const left = new Float32Array(frames)
  const right = new Float32Array(frames)
  for (let frame = 0; frame < frames; frame += QUANTUM) {
    core.render(
      frame,
      left.subarray(frame, frame + QUANTUM),
      right.subarray(frame, frame + QUANTUM),
    )
  }
  return { left, right, events }
}
