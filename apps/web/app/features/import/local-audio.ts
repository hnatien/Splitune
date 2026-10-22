import { ALL_FORMATS, AudioSampleSink, BlobSource, Input } from 'mediabunny'
import { type AudioStats, StatsAccumulator } from './audio-stats'

// Local decode of a picked file (13 §2 step 2–3): duration, a waveform for the preview and the
// numbers the pre-flight checks need. Mediabunny over WebCodecs first (audio and video
// containers), decodeAudioData where WebCodecs is missing (e.g. Firefox Android). Playback of
// the decoded audio arrives with the audio engine (step 11).

export type LocalAudio =
  | { kind: 'decoded'; stats: AudioStats }
  /** The browser can't decode it, but the server may (video without a usable decoder, AIFF…). */
  | { kind: 'needs_upload'; durationS?: number | undefined }
  | { kind: 'unreadable' }

function mono(planes: Float32Array[]): Float32Array {
  const [first] = planes
  if (!first || planes.length === 1) return first ?? new Float32Array()
  const mixed = new Float32Array(first.length)
  for (const plane of planes) {
    for (let i = 0; i < mixed.length; i++)
      mixed[i] = (mixed[i] ?? 0) + (plane[i] ?? 0) / planes.length
  }
  return mixed
}

async function withMediabunny(file: File): Promise<LocalAudio | undefined> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
  try {
    await input.getFormat()
  } catch {
    return undefined
  }
  try {
    const track = await input.getPrimaryAudioTrack()
    if (!track) return { kind: 'unreadable' }
    if (!(await track.canDecode())) {
      return {
        kind: 'needs_upload',
        durationS: await input.computeDuration().catch(() => undefined),
      }
    }
    const stats = new StatsAccumulator(track.sampleRate)
    for await (const sample of new AudioSampleSink(track).samples()) {
      const planes = Array.from({ length: sample.numberOfChannels }, (_, planeIndex) => {
        const plane = new Float32Array(sample.numberOfFrames)
        sample.copyTo(plane, { planeIndex, format: 'f32-planar' })
        return plane
      })
      stats.add(mono(planes))
      sample.close()
    }
    return { kind: 'decoded', stats: stats.finish(await track.computeDuration()) }
  } finally {
    input.dispose()
  }
}

// decodeAudioData holds the whole file and its PCM in memory; above this, wait for the server.
const FALLBACK_MAX_BYTES = 200 * 1024 * 1024

async function withWebAudio(file: File): Promise<LocalAudio | undefined> {
  if (typeof OfflineAudioContext === 'undefined' || file.size > FALLBACK_MAX_BYTES) return undefined
  try {
    const context = new OfflineAudioContext(1, 1, 44_100)
    const buffer = await context.decodeAudioData(await file.arrayBuffer())
    const stats = new StatsAccumulator(buffer.sampleRate)
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
      buffer.getChannelData(i),
    )
    const block = 4096
    for (let start = 0; start < buffer.length; start += block) {
      stats.add(mono(channels.map((c) => c.subarray(start, start + block))))
    }
    return { kind: 'decoded', stats: stats.finish(buffer.duration) }
  } catch {
    return undefined
  }
}

const MEDIA_EXTENSION = /\.(mp3|m4a|aac|wav|aiff?|flac|ogg|oga|opus|mp4|m4v|mov|webm|mkv)$/i

type Decoder = (file: File) => Promise<LocalAudio | undefined>

export async function decodeLocally(
  file: File,
  decoders: { demux: Decoder; webAudio: Decoder } = {
    demux: withMediabunny,
    webAudio: withWebAudio,
  },
): Promise<LocalAudio> {
  const demuxed = await decoders.demux(file).catch(() => undefined)
  if (demuxed?.kind === 'decoded' || demuxed?.kind === 'unreadable') return demuxed
  // No WebCodecs decoder for the codec (Firefox Android has none), or a container Mediabunny
  // doesn't read: the browser's own decoder may still manage it (24 §3).
  const decoded = await decoders.webAudio(file)
  if (decoded) return decoded
  if (demuxed) return demuxed
  const media = /^(audio|video)\//.test(file.type) || MEDIA_EXTENSION.test(file.name)
  return media ? { kind: 'needs_upload' } : { kind: 'unreadable' }
}
