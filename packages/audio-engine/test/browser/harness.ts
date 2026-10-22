// Browser side of the audio suite: renders a scenario through createEngine() and the real
// AudioWorklet in an OfflineAudioContext, and decodes stem fixtures through decodeStem().
import { type DecodePath, decodeStem, webCodecsAvailable } from '../../src/decode.ts'
import { createEngine, loadDspModule } from '../../src/engine.ts'
import type { ProcessorEvent } from '../../src/protocol.ts'
import { resample } from '../../src/resample.ts'
import { type Measurement, SAMPLE_RATE, scenarios } from '../scenarios.ts'

const QUANTUM = 128
const LAG_SEARCH = 4096

async function run(name: string): Promise<Measurement> {
  const scenario = scenarios.find((candidate) => candidate.name === name)
  if (!scenario) throw new Error(`unknown scenario ${name}`)
  const setup = scenario.setup()
  const length = Math.ceil((setup.seconds * SAMPLE_RATE) / QUANTUM) * QUANTUM + QUANTUM
  const context = new OfflineAudioContext({ numberOfChannels: 2, length, sampleRate: SAMPLE_RATE })
  const engine = await createEngine({ context, module: await loadDspModule(), tier: 'high' })
  const events: ProcessorEvent[] = []
  engine.on('processor', (event) => events.push(event))

  const configure = async () => {
    await engine.ready
    // The engine transfers the PCM away; scenarios may still measure their source.
    await Promise.all(setup.stems.map((pcm, stem) => engine.loadStem(stem, pcm.slice())))
    for (const command of setup.commands) engine.send(command)
    await engine.flush()
  }
  let rendered: AudioBuffer
  if (typeof context.suspend === 'function') {
    // Pause after the first quantum (the processor exists by then), configure, continue:
    // commands apply from frame 128.
    const configured = context.suspend(QUANTUM / SAMPLE_RATE).then(async () => {
      await configure()
      await context.resume()
    })
    rendered = await context.startRendering()
    await configured
  } else {
    // Firefox has no OfflineAudioContext.suspend() but runs the processor before rendering.
    await configure()
    rendered = await context.startRendering()
  }
  // Let the processor's last messages arrive.
  await new Promise((resolve) => setTimeout(resolve, 100))
  return scenario.measure(rendered.getChannelData(0), events)
}

interface DecodeCheck {
  file: string
  reference: string
  durationSeconds: number
  path: DecodePath
}

// Decodes a fixture and compares it with the PCM it was encoded from (resampled to 48 kHz):
// length must be the timeline length and the offset zero. The lag search spans ±4096 frames,
// more than any encoder's priming (AAC: 1024 or 2112 at 44.1 kHz).
async function decode(check: DecodeCheck) {
  if (check.path === 'webcodecs' && !webCodecsAvailable()) return { skipped: 'no WebCodecs' }
  const bytes = await (await fetch(check.file)).arrayBuffer()
  const source = new Float32Array(await (await fetch(check.reference)).arrayBuffer())
  const sourceLeft = source.filter((_, i) => i % 2 === 0)
  const reference = resample(sourceLeft, 44100, SAMPLE_RATE)
  let stem: Awaited<ReturnType<typeof decodeStem>>
  try {
    stem = await decodeStem(bytes, {
      sampleRate: SAMPLE_RATE,
      durationSeconds: check.durationSeconds,
      path: check.path,
    })
  } catch (error) {
    return { error: String(error) }
  }
  const left = Float32Array.from({ length: stem.frames }, (_, i) => (stem.pcm[2 * i] ?? 0) / 32768)
  const start = Math.floor(stem.frames / 2) - SAMPLE_RATE / 2
  let best = Number.NEGATIVE_INFINITY
  let lag = 0
  for (let k = -LAG_SEARCH; k <= LAG_SEARCH; k++) {
    let score = 0
    for (let i = start; i < start + SAMPLE_RATE; i++)
      score += (left[i + k] ?? 0) * (reference[i] ?? 0)
    if (score > best) {
      best = score
      lag = k
    }
  }
  return { frames: stem.frames, path: stem.path, lag, peaks: stem.peaks.length }
}

const harness = { run, decode }
export type Harness = typeof harness

declare global {
  interface Window {
    harness: Harness
  }
}

window.harness = harness
