import { z } from 'zod'
import { Instrument } from '../analysis/common.ts'
import { StageState } from '../analysis/manifest.ts'
import { ArtefactIndexEntry } from './artefacts.ts'

// What the client asks for (23-plans-free-and-paid.md §2); a Free user's first full request is
// recorded as the Welcome analysis.
export const AnalysisType = z.enum(['full', 'lite'])
export const AnalysisKind = z.enum(['welcome', 'full', 'lite'])
export const AnalysisStatus = z.enum([
  'queued',
  'running',
  'done',
  'partial',
  'failed',
  'cancelled',
])

export const CreateAnalysisInput = z.object({
  song_id: z.uuid(),
  instrument: Instrument,
  type: AnalysisType,
})

export const AnalysisAccepted = z.object({ analysis_id: z.uuid(), status: AnalysisStatus })

export const Analysis = z.object({
  id: z.uuid(),
  song_id: z.uuid(),
  version: z.number().int().positive(),
  type: AnalysisKind,
  requested_instrument: Instrument,
  status: AnalysisStatus,
  progress: z.number().min(0).max(1),
  pipeline_version: z.string(),
  stages: z.record(z.string(), StageState),
  artefacts: z.array(ArtefactIndexEntry),
  created_at: z.iso.datetime(),
  finished_at: z.iso.datetime().nullable(),
})
