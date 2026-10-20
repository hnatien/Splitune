import { z } from 'zod'
import { contracts } from '../registry.ts'
import { ArtefactHeader, Confidence } from './common.ts'

export const ChordCandidate = z
  .object({
    label: z.string().min(1),
    prob: z.number().min(0).max(1),
  })
  .register(contracts, { id: 'ChordCandidate' })

export const ChordSegment = Confidence.extend({
  id: z.string().min(1),
  t0: z.number().nonnegative(),
  t1: z.number().nonnegative(),
  label: z.string().min(1), // Harte syntax, e.g. "A:min", "G:7", "N"
  bass: z.string().optional(), // e.g. "C" for slash chords
  top_k: z.array(ChordCandidate).max(5),
  beat_aligned: z.boolean(),
}).register(contracts, { id: 'ChordSegment' })

export const Key = z
  .object({
    tonic: z.string().min(1),
    mode: z.enum(['major', 'minor']),
    confidence: z.number().min(0).max(1),
  })
  .register(contracts, { id: 'Key' })

// Default display is majmin; a `sevenths` artefact is written alongside when the model supports it.
export const Chords = ArtefactHeader.extend({
  artefact: z.literal('chords'),
  vocabulary: z.enum(['majmin', 'sevenths']),
  segments: z.array(ChordSegment),
  key: Key,
  inputs_fused: z.array(z.enum(['mixture', 'no_drums', 'bass_root'])),
}).register(contracts, { id: 'Chords' })
