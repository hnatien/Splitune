// The AudioWorklet processor's logic without the AudioWorkletProcessor shell, so tests can drive
// it in Node: applies commands (now or at a scheduled frame), renders blocks through dsp.wasm,
// and turns DSP events into protocol events stamped with AudioContext frames.
import { Dsp, DspEventType, instantiateDsp, Transport as TransportCode } from './dsp.ts'
import type { Command, ProcessorEvent, Transport } from './protocol.ts'

const LOAD_WINDOW_SECONDS = 1

const TRANSPORT: Record<TransportCode, Transport> = {
  [TransportCode.stopped]: 'stopped',
  [TransportCode.countIn]: 'countIn',
  [TransportCode.playing]: 'playing',
}

export type Post = (event: ProcessorEvent) => void
export type Clock = () => number

export class ProcessorCore {
  readonly #dsp: Dsp
  readonly #post: Post
  readonly #now: Clock
  readonly #reportInterval: number
  readonly #loadWindow: number
  #queue: Command[] = []
  #nextFrame = 0
  #sinceReport = Number.POSITIVE_INFINITY
  #busy = 0
  #loadFrames = 0

  constructor(
    module: WebAssembly.Module,
    sampleRate: number,
    reportInterval: number,
    post: Post,
    now: Clock,
  ) {
    this.#dsp = new Dsp(instantiateDsp(module), sampleRate)
    this.#post = post
    this.#now = now
    this.#reportInterval = reportInterval
    this.#loadWindow = Math.round(LOAD_WINDOW_SECONDS * sampleRate)
    post({ type: 'ready' })
  }

  receive(command: Command): void {
    if (command.at === undefined) {
      this.#apply(command, this.#nextFrame)
      return
    }
    // Stable insert by frame, so commands for one frame keep their order.
    const at = command.at
    const index = this.#queue.findIndex((queued) => (queued.at ?? 0) > at)
    if (index < 0) this.#queue.push(command)
    else this.#queue.splice(index, 0, command)
  }

  render(frame: number, left: Float32Array, right: Float32Array): void {
    const frames = left.length
    while (this.#queue.length > 0 && (this.#queue[0]?.at ?? 0) < frame + frames) {
      const command = this.#queue.shift()
      if (command) this.#apply(command, frame)
    }

    const started = this.#now()
    const [outLeft, outRight] = this.#dsp.process(frames)
    left.set(outLeft)
    right.set(outRight)
    const events = this.#dsp.events()
    const heard = this.#dsp.heard(0)
    this.#busy += this.#now() - started

    let transportChanged = false
    for (const event of events) {
      if (this.#forward(frame, event)) transportChanged = true
    }
    this.#sinceReport += frames
    if (transportChanged || this.#sinceReport >= this.#reportInterval) {
      this.#sinceReport = 0
      this.#post({
        type: 'position',
        frame,
        heard,
        transport: TRANSPORT[this.#dsp.transport],
        rate: this.#dsp.rate,
      })
    }

    this.#nextFrame = frame + frames
    this.#loadFrames += frames
    if (this.#loadFrames >= this.#loadWindow) {
      const audioMs = (this.#loadFrames / this.#loadWindow) * LOAD_WINDOW_SECONDS * 1000
      this.#post({ type: 'load', frame, load: this.#busy / audioMs })
      this.#busy = 0
      this.#loadFrames = 0
    }
  }

  #forward(frame: number, event: ReturnType<Dsp['events']>[number]): boolean {
    const at = frame + event.offset
    switch (event.type) {
      case DspEventType.beat:
        this.#post({ type: 'beat', frame: at, index: event.value, accent: event.accent })
        return false
      case DspEventType.countInBeat:
        this.#post({ type: 'countIn', frame: at, index: event.value, accent: event.accent })
        return false
      case DspEventType.started:
        this.#post({ type: 'started', frame: at, position: event.value, downbeat: event.accent })
        return true
      case DspEventType.loopWrap:
        this.#post({ type: 'loopWrap', frame: at, pass: event.value })
        return false
      case DspEventType.ended:
        this.#post({ type: 'ended', frame: at, position: event.value })
        return true
      case DspEventType.stopped:
        this.#post({ type: 'stopped', frame: at, position: event.value })
        return true
    }
  }

  #apply(command: Command, frame: number): void {
    const dsp = this.#dsp
    switch (command.type) {
      case 'load':
        if (dsp.loadStem(command.stem, command.pcm)) {
          this.#post({
            type: 'loaded',
            stem: command.stem,
            frames: command.pcm.length >> 1,
            duration: dsp.duration,
          })
        } else {
          this.#post({ type: 'loadFailed', stem: command.stem })
        }
        return
      case 'unload':
        dsp.clearStem(command.stem)
        return
      case 'gain':
        dsp.setGain(command.stem, command.gain)
        return
      case 'rate':
        dsp.setRate(command.rate)
        return
      case 'transpose':
        dsp.setTranspose(command.semitones, command.tonalityLimitHz)
        return
      case 'loop':
        dsp.setLoop(command.loop)
        return
      case 'beats':
        dsp.setBeats(command.frames, command.downbeats)
        return
      case 'metronome':
        dsp.setMetronome(command.enabled)
        return
      case 'clickGain':
        dsp.setClickGain(command.gain)
        return
      case 'quality':
        dsp.setQuality(command.quality)
        return
      case 'play':
        dsp.play(command.countInBars)
        return
      case 'pause':
        dsp.pause()
        return
      case 'seek':
        dsp.seek(Math.round(command.position))
        return
      case 'flush':
        this.#post({ type: 'flushed', id: command.id, frame })
        return
    }
  }
}
