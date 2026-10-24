// Messages between the engine (main thread) and SplituneProcessor (AudioWorklet), shared with the
// tests. Positions are frames at the AudioContext rate on the decoded-PCM timeline ("source
// frames"); `frame` stamps are AudioContext frames (the worklet's currentFrame) at which the thing
// leaves the processor, before the device's output latency.
import type { Quality } from './dsp.ts'

export const PROCESSOR_NAME = 'splitune-processor'

export interface ProcessorOptions {
  module: WebAssembly.Module
  // Frames between position reports (~20 ms, docs/specs/11-audio-engine.md §2).
  reportInterval: number
}

type Scheduled = {
  // Apply in the render quantum containing this AudioContext frame (or the next one when it has
  // passed). Omitted: apply before the next quantum.
  at?: number
}

export type Command = Scheduled &
  (
    | { type: 'load'; stem: number; pcm: Int16Array }
    | { type: 'unload'; stem: number }
    | { type: 'gain'; stem: number; gain: number }
    | { type: 'rate'; rate: number }
    | { type: 'transpose'; semitones: number; tonalityLimitHz: number }
    | { type: 'loop'; loop: { start: number; end: number } | null }
    | { type: 'beats'; frames: Float64Array; downbeats: Uint8Array }
    | { type: 'metronome'; enabled: boolean }
    | { type: 'clickGain'; gain: number }
    | { type: 'quality'; quality: Quality }
    | { type: 'play'; countInBars: number }
    | { type: 'pause' }
    | { type: 'seek'; position: number }
    // Pause when the heard position crosses this source frame (loop rests, 12 §6); null clears it.
    | { type: 'stopAt'; position: number | null }
    | { type: 'flush'; id: number }
  )

export type Transport = 'stopped' | 'countIn' | 'playing'

export type ProcessorEvent =
  | { type: 'ready' }
  | { type: 'loaded'; stem: number; frames: number; duration: number }
  | { type: 'loadFailed'; stem: number }
  | {
      type: 'position'
      frame: number
      // Source frame leaving the processor at `frame` (stretcher latency compensated).
      heard: number
      transport: Transport
      rate: number
    }
  | { type: 'started'; frame: number; position: number; downbeat: boolean }
  | { type: 'stopped'; frame: number; position: number }
  | { type: 'ended'; frame: number; position: number }
  | { type: 'loopWrap'; frame: number; pass: number }
  // Paused by stopAt: the block at `frame` fades out as the heard position reaches `position`.
  | { type: 'stopReached'; frame: number; position: number }
  | { type: 'beat'; frame: number; index: number; accent: boolean }
  | { type: 'countIn'; frame: number; index: number; accent: boolean }
  // Processing time over audio time in the last window (≈1 s); 1 means no headroom left.
  | { type: 'load'; frame: number; load: number }
  | { type: 'flushed'; id: number; frame: number }
  | { type: 'error'; message: string }
