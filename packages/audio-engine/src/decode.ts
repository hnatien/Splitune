// Stem decoding (docs/specs/11-audio-engine.md §4, 24-browser-compatibility.md §3):
// WebCodecs in the decode Worker where AudioDecoder exists, else decodeAudioData (which resamples
// to the context rate natively). Both trim to the timeline length from stems.json, so encoder
// priming and padding never shift a stem against the others.
import type { DecodeRequest, DecodeResponse } from './decode.worker.ts'
import { itunesGapless } from './gapless.ts'
import { type StemPcm, timelineFrames, toStemPcm } from './pcm.ts'

export type DecodePath = 'webcodecs' | 'decodeAudioData'

export interface DecodeOptions {
  sampleRate: number
  // stems.json `duration_s`; omitted for a local file, whose own duration is used.
  durationSeconds?: number
  // Forces one path (tests, and the startup check of a codec).
  path?: DecodePath
}

export interface DecodedStem extends StemPcm {
  path: DecodePath
}

export class DecodeError extends Error {
  override name = 'DecodeError'
}

export function webCodecsAvailable(): boolean {
  return typeof AudioDecoder !== 'undefined' && typeof Worker !== 'undefined'
}

export async function decodeStem(bytes: ArrayBuffer, options: DecodeOptions): Promise<DecodedStem> {
  const { sampleRate, durationSeconds, path } = options
  if (path !== 'decodeAudioData' && (path === 'webcodecs' || webCodecsAvailable())) {
    const result = await decodeInWorker({ bytes: bytes.slice(0), sampleRate, durationSeconds })
    if (result.ok) {
      return { path: 'webcodecs', pcm: result.pcm, frames: result.frames, peaks: result.peaks }
    }
    if (path === 'webcodecs') throw new DecodeError(result.reason)
  }
  return {
    path: 'decodeAudioData',
    ...(await decodeWithAudioContext(bytes, sampleRate, durationSeconds)),
  }
}

function decodeInWorker(request: DecodeRequest): Promise<DecodeResponse> {
  const worker = new Worker(new URL('./decode.worker.ts', import.meta.url), { type: 'module' })
  return new Promise<DecodeResponse>((resolve) => {
    worker.onmessage = (event: MessageEvent<DecodeResponse>) => resolve(event.data)
    worker.onerror = (event) => resolve({ ok: false, reason: event.message || 'worker error' })
    worker.postMessage(request, [request.bytes])
  }).finally(() => worker.terminate())
}

async function decodeWithAudioContext(
  bytes: ArrayBuffer,
  sampleRate: number,
  durationSeconds: number | undefined,
): Promise<StemPcm> {
  let buffer: AudioBuffer
  try {
    // decodeAudioData detaches its argument, so it gets a copy.
    buffer = await new OfflineAudioContext(2, 1, sampleRate).decodeAudioData(bytes.slice(0))
  } catch (error) {
    throw new DecodeError(String(error))
  }
  const frames =
    durationSeconds === undefined ? buffer.length : timelineFrames(durationSeconds, sampleRate)
  const skip = durationSeconds === undefined ? 0 : keptPriming(bytes, buffer.length, frames)
  const channels = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, c) =>
    buffer.getChannelData(c).subarray(skip),
  )
  return toStemPcm(channels, frames)
}

// Chromium and WebKit apply an AudioToolbox file's iTunes gapless record; Firefox decodes every
// frame, priming included. When the decode is longer than the timeline by at least the priming,
// the priming (at the context rate) is still at the start.
function keptPriming(bytes: ArrayBuffer, decoded: number, frames: number): number {
  const gapless = itunesGapless(new Uint8Array(bytes))
  if (!gapless) return 0
  const priming = Math.round((gapless.priming * frames) / gapless.length)
  return decoded - frames >= priming ? priming : 0
}
