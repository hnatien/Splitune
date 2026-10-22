// Decode Worker: Mediabunny demux + WebCodecs AudioDecoder, placed on the timeline by sample
// timestamp, resampled to the AudioContext rate and converted to stem PCM
// (docs/implementation/11-audio-engine.md §4). AAC priming: FFmpeg's encoder writes an MP4 edit
// list, which Mediabunny applies (the priming gets negative timestamps); AudioToolbox, which
// encodes stems on the Mac worker, writes only the iTunes gapless record, applied here.
import { ALL_FORMATS, AudioSampleSink, BufferSource, Input } from 'mediabunny'
import { itunesGapless } from './gapless.ts'
import { type StemPcm, timelineFrames, toStemPcm } from './pcm.ts'
import { resample } from './resample.ts'

export interface DecodeRequest {
  bytes: ArrayBuffer
  sampleRate: number
  durationSeconds: number | undefined
}

export type DecodeResponse = ({ ok: true } & StemPcm) | { ok: false; reason: string }

async function decode({ bytes, sampleRate, durationSeconds }: DecodeRequest): Promise<StemPcm> {
  const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS })
  try {
    const track = await input.getPrimaryAudioTrack()
    if (!track) throw new Error('no audio track')
    if (!(await track.canDecode())) throw new Error(`cannot decode ${track.codec ?? 'unknown'}`)
    const sourceRate = track.sampleRate
    const seconds = durationSeconds ?? (await track.computeDuration())
    const sourceFrames = timelineFrames(seconds, sourceRate)
    const planes = [new Float32Array(sourceFrames), new Float32Array(sourceFrames)]
    const editListApplied = (await track.getFirstTimestamp()) < 0
    const priming = editListApplied ? 0 : (itunesGapless(new Uint8Array(bytes))?.priming ?? 0)
    let channels = 1
    for await (const sample of new AudioSampleSink(track).samples()) {
      const start = Math.round(sample.timestamp * sourceRate) - priming
      channels = Math.max(channels, Math.min(2, sample.numberOfChannels))
      for (let c = 0; c < Math.min(2, sample.numberOfChannels); c++) {
        const data = new Float32Array(sample.numberOfFrames)
        sample.copyTo(data, { planeIndex: c, format: 'f32-planar' })
        const from = Math.max(0, -start)
        const to = Math.min(data.length, sourceFrames - start)
        if (to > from) planes[c]?.set(data.subarray(from, to), start + from)
      }
      sample.close()
    }
    const used = channels === 2 ? planes : [planes[0] as Float32Array]
    const resampled = used.map((plane) => resample(plane, sourceRate, sampleRate))
    return toStemPcm(resampled, timelineFrames(seconds, sampleRate))
  } finally {
    input.dispose()
  }
}

self.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  try {
    const stem = await decode(event.data)
    const response: DecodeResponse = { ok: true, ...stem }
    self.postMessage(response, { transfer: [stem.pcm.buffer, stem.peaks.buffer] })
  } catch (error) {
    const response: DecodeResponse = { ok: false, reason: String(error) }
    self.postMessage(response)
  }
}
