import { z } from 'zod'
import { contracts } from '../registry.ts'
import { ArtefactHeader, Sha256Hex } from './common.ts'

// The source's first audio stream as ffprobe reports it (only the fields decode decisions need).
export const ProbeStream = z
  .object({
    codec: z.string().min(1),
    sample_rate: z.number().int().positive().optional(),
    channels: z.number().int().positive().optional(),
    channel_layout: z.string().optional(),
    bit_rate: z.number().int().nonnegative().optional(),
    duration_s: z.number().nonnegative().optional(),
  })
  .register(contracts, { id: 'ProbeStream' })

// Written by the decode stage (06-ml-pipeline-service.md §4). Describes the source file and the
// canonical decode whose sha256 is `audio_hash`. File tags (title, artist) are never copied.
export const Probe = ArtefactHeader.extend({
  artefact: z.literal('probe'),
  container: z.string().min(1), // ffprobe format_name, e.g. "mov,mp4,m4a,3gp,3g2,mj2"
  source_bytes: z.number().int().nonnegative(),
  source_sha256: Sha256Hex,
  source_duration_s: z.number().nonnegative().optional(),
  audio_streams: z.number().int().positive(),
  audio_stream: ProbeStream, // the stream that was decoded (a:0)
  decoded_frames: z.number().int().positive(), // 44.1 kHz stereo f32le frames
  loudness_lufs: z.number().optional(), // integrated, ITU-R BS.1770-4 (pyloudnorm); absent for silence
  peak_dbfs: z.number().optional(), // sample peak; absent for silence
}).register(contracts, { id: 'Probe' })
