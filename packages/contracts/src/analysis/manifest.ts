import { z } from 'zod'
import { contracts } from '../registry.ts'
import { ArtefactHeader, Instrument, MachineCode, SourceKind, StageStatus } from './common.ts'

export const StageState = z
  .object({
    status: StageStatus,
    started_at: z.iso.datetime().optional(),
    finished_at: z.iso.datetime().optional(),
    artefact_path: z.string().optional(),
    error_code: MachineCode.optional(), // machine code, never raw exception text
    fallback_reason: MachineCode.optional(),
  })
  .register(contracts, { id: 'StageState' })

export const Manifest = ArtefactHeader.extend({
  artefact: z.literal('manifest'),
  source_kind: SourceKind,
  requested_instrument: Instrument,
  pipeline_version: z.string().min(1), // git sha or semver of services/ml
  stages: z.record(z.string(), StageState), // key = stage name
  progress: z.number().min(0).max(1),
}).register(contracts, { id: 'Manifest' })
