// Demo page logic: loads stems (files or synthetic), drives every engine control, and runs the
// Prototype 7 measurement. `window.demo` exposes the same actions for scripted runs.
import {
  type BeatMarker,
  CONTEXT_SAMPLE_RATE,
  createEngine,
  type DecodePath,
  decodeStem,
  type Engine,
  type Tier,
  type UnderrunEvent,
} from '../src/index.ts'
import { testStems } from './stems.ts'

interface Stem {
  name: string
  pcm: Int16Array
}

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const input = (id: string) => element<HTMLInputElement>(id)
const select = (id: string) => element<HTMLSelectElement>(id)

let engine: Engine | undefined
let stems: Stem[] = []
let loadedIntoEngine = false
let beats: BeatMarker[] = []
let duration = 0
const mixer: { muted: boolean; soloed: boolean }[] = []
let passes = 0
const loads: number[] = []
const underruns: UnderrunEvent[] = []

function status(id: string, text: string) {
  element(id).textContent = text
}

async function ensureEngine(): Promise<Engine> {
  if (!engine) {
    const tier = select('tier').value as Tier | ''
    engine = await createEngine({
      ...(tier ? { tier } : {}),
      adaptive: input('adaptive').checked,
    })
    engine.on('load', ({ load }) => loads.push(load))
    engine.on('audio_underrun', (event) => {
      underruns.push(event)
      status('engine-status', `Underrun (${event.reason}): tier ${event.previous} → ${event.tier}`)
    })
    engine.on('loopWrap', () => {
      passes++
      status('passes', `Passes: ${passes}`)
    })
    engine.on('interrupted', ({ state }) =>
      status('engine-status', `Interrupted (${state}): press Play to resume`),
    )
    engine.on('error', ({ message }) => status('engine-status', `Error: ${message}`))
    engine.setMediaMetadata({ title: 'Audio engine demo', artist: 'Splitune' })
    await engine.ready
    status('engine-status', `Running at ${engine.sampleRate} Hz, tier ${engine.tier}`)
  }
  if (!loadedIntoEngine && stems.length > 0) {
    // loadStem transfers the PCM; keep our copy for reloading into a new engine.
    await Promise.all(stems.map((stem, index) => engine?.loadStem(index, stem.pcm.slice())))
    loadedIntoEngine = true
    applyAll()
  }
  return engine
}

async function useStems(next: Stem[], grid: BeatMarker[] | undefined, label: string) {
  stems = next
  loadedIntoEngine = false
  duration = Math.max(...stems.map((stem) => stem.pcm.length / 2)) / CONTEXT_SAMPLE_RATE
  mixer.length = 0
  for (let i = 0; i < stems.length; i++) mixer.push({ muted: false, soloed: false })
  renderMixer()
  if (grid) beats = grid
  status(
    'stem-status',
    `${label}: ${stems.map((s) => s.name).join(', ')} (${duration.toFixed(2)} s)`,
  )
  if (engine) await ensureEngine()
}

async function loadFiles() {
  const files = [input('file-0').files?.[0], input('file-1').files?.[0]].filter(
    (f): f is File => !!f,
  )
  if (files.length === 0) return status('stem-status', 'Choose at least one file.')
  const json = input('stems-json').files?.[0]
  const durationSeconds = json
    ? (JSON.parse(await json.text()) as { duration_s?: number }).duration_s
    : undefined
  const path = select('decode-path').value as DecodePath | ''
  status('stem-status', 'Decoding…')
  const started = performance.now()
  const decoded = await Promise.all(
    files.map((file) =>
      file.arrayBuffer().then((bytes) =>
        decodeStem(bytes, {
          sampleRate: CONTEXT_SAMPLE_RATE,
          ...(durationSeconds === undefined ? {} : { durationSeconds }),
          ...(path ? { path } : {}),
        }),
      ),
    ),
  )
  const ms = Math.round(performance.now() - started)
  await useStems(
    decoded.map((stem, i) => ({ name: files[i]?.name ?? `stem ${i + 1}`, pcm: stem.pcm })),
    undefined,
    `Decoded in ${ms} ms via ${decoded.map((d) => d.path).join(', ')}`,
  )
  updateGrid()
}

async function loadTestStems() {
  const test = testStems(CONTEXT_SAMPLE_RATE)
  input('bpm').value = String(test.bpm)
  input('beats-per-bar').value = '4'
  input('offset').value = '0'
  await useStems(test.stems, test.beats, 'Test stems')
  applyAll()
}

function updateGrid() {
  const bpm = Number(input('bpm').value)
  const perBar = Math.max(1, Math.round(Number(input('beats-per-bar').value)))
  const offset = Number(input('offset').value)
  const period = 60 / bpm
  const count = Math.floor((duration - offset) / period) + 1
  beats = Array.from({ length: Math.max(0, count) }, (_, i) => ({
    time: offset + i * period,
    downbeat: i % perBar === 0,
  }))
  engine?.setBeatGrid(beats)
  updateLoop()
}

function barTime(bar: number): number {
  const downbeats = beats.filter((beat) => beat.downbeat)
  return downbeats[Math.max(0, bar - 1)]?.time ?? 0
}

function updateLoop() {
  if (!engine) return
  if (!input('loop').checked) {
    engine.setLoop(null)
    return
  }
  const first = Math.max(1, Math.round(Number(input('loop-start').value)))
  const bars = Math.max(1, Math.round(Number(input('loop-bars').value)))
  const start = barTime(first)
  const end = Math.min(duration, barTime(first + bars) || duration)
  engine.setLoop({ start, end })
  engine.seek(start)
  passes = 0
  status('passes', 'Passes: 0')
}

function updateMixer() {
  engine?.setMixer(mixer.map((channel) => ({ gain: 1, ...channel })))
}

function renderMixer() {
  const root = element('mixer')
  root.replaceChildren()
  stems.forEach((stem, i) => {
    const row = document.createElement('div')
    for (const key of ['muted', 'soloed'] as const) {
      const label = document.createElement('label')
      const box = document.createElement('input')
      box.type = 'checkbox'
      box.addEventListener('change', () => {
        const channel = mixer[i]
        if (channel) channel[key] = box.checked
        updateMixer()
      })
      label.append(box, ` ${key === 'muted' ? 'Mute' : 'Solo'} ${stem.name}`)
      row.append(label)
    }
    root.append(row)
  })
}

function applyAll() {
  if (!engine) return
  engine.setRate(Number(input('rate').value) / 100)
  engine.setTranspose(Number(input('transpose').value))
  engine.setMetronome(input('metronome').checked)
  engine.setBeatGrid(beats)
  updateMixer()
  updateLoop()
}

async function play() {
  const running = await ensureEngine()
  if (stems.length === 0) return status('stem-status', 'Load stems first.')
  await running.play({ countInBars: Number(select('count-in').value) })
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}

function tick() {
  if (engine && duration > 0) {
    const position = engine.position()
    const beat = beats.findLastIndex((b) => b.time <= position + 1e-6)
    const bar = beats.slice(0, beat + 1).filter((b) => b.downbeat).length
    status('position', `${formatTime(position)} · bar ${bar} · ${engine.transport}`)
    if (document.activeElement !== input('seek')) input('seek').value = String(position / duration)
  }
  requestAnimationFrame(tick)
}

// Prototype 7: fixed tier, both stems, 0.5×, N seconds.
async function measure(seconds: number) {
  const running = await ensureEngine()
  if (stems.length === 0) await loadTestStems()
  input('rate').value = '50'
  element('rate-value').textContent = '50%'
  input('loop').checked = false
  applyAll()
  running.seek(0)
  loads.length = 0
  underruns.length = 0
  const latencies: { output: number; base: number; timestampLag: number }[] = []
  await running.play()
  const context = running.context as AudioContext
  const sampler = setInterval(() => {
    const timestamp = context.getOutputTimestamp?.()
    latencies.push({
      output: context.outputLatency ?? Number.NaN,
      base: context.baseLatency ?? Number.NaN,
      timestampLag: timestamp?.contextTime
        ? context.currentTime - timestamp.contextTime
        : Number.NaN,
    })
  }, 500)
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
  clearInterval(sampler)
  running.pause()
  const average = (values: number[]) =>
    values.reduce((a, b) => a + b, 0) / Math.max(1, values.length)
  const ms = (values: number[]) => Math.round(average(values) * 10000) / 10
  const results = {
    tier: running.tier,
    rate: 0.5,
    stems: stems.length,
    seconds,
    loadAverage: Math.round(average(loads) * 1000) / 1000,
    loadMax: Math.round(Math.max(0, ...loads) * 1000) / 1000,
    underruns: underruns.length,
    sampleRate: context.sampleRate,
    outputLatencyMs: ms(latencies.map((l) => l.output)),
    baseLatencyMs: ms(latencies.map((l) => l.base)),
    currentTimeMinusTimestampMs: ms(latencies.map((l) => l.timestampLag)),
    userAgent: navigator.userAgent,
  }
  element('results').textContent = JSON.stringify(results, null, 2)
  return results
}

input('rate').addEventListener('input', () => {
  element('rate-value').textContent = `${input('rate').value}%`
  engine?.setRate(Number(input('rate').value) / 100)
})
const presets = element('rate-presets')
for (const percent of [50, 60, 70, 75, 80, 90, 100]) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = `${percent}%`
  button.addEventListener('click', () => {
    input('rate').value = String(percent)
    input('rate').dispatchEvent(new Event('input'))
  })
  presets.append(button)
}
input('transpose').addEventListener('change', () =>
  engine?.setTranspose(Number(input('transpose').value)),
)
input('metronome').addEventListener('change', () =>
  engine?.setMetronome(input('metronome').checked),
)
for (const id of ['bpm', 'beats-per-bar', 'offset'])
  input(id).addEventListener('change', updateGrid)
for (const id of ['loop', 'loop-start', 'loop-bars'])
  input(id).addEventListener('change', updateLoop)
input('seek').addEventListener('change', () => engine?.seek(Number(input('seek').value) * duration))
element('play').addEventListener('click', () => void play())
element('pause').addEventListener('click', () => engine?.pause())
element('load-files').addEventListener('click', () => void loadFiles())
element('load-test').addEventListener('click', () => void loadTestStems())
element('measure').addEventListener(
  'click',
  () => void measure(Number(input('measure-seconds').value)),
)
document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
  if (event.key === ' ') {
    event.preventDefault()
    if (engine?.transport === 'stopped') void play()
    else engine?.pause()
  } else if (event.key === 'l') {
    input('loop').checked = !input('loop').checked
    updateLoop()
  } else if (event.key === 'm') {
    input('metronome').checked = !input('metronome').checked
    engine?.setMetronome(input('metronome').checked)
  }
})
requestAnimationFrame(tick)

Object.assign(window, { demo: { loadTestStems, play, measure, engine: () => engine } })
