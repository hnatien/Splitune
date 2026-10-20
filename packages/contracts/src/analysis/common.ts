import { z } from 'zod'
import { contracts } from '../registry.ts'

export const SCHEMA_VERSION = '1.3.0'

const SCHEMA_MAJOR = Number(SCHEMA_VERSION.split('.')[0])

export class IncompatibleSchemaVersionError extends Error {
  constructor(version: string) {
    super(`schema_version ${JSON.stringify(version)} is not compatible with ${SCHEMA_VERSION}`)
    this.name = 'IncompatibleSchemaVersionError'
  }
}

// S8: readers ignore unknown fields but must refuse a different major version.
export function assertCompatible(version: string): void {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (match === null || Number(match[1]) !== SCHEMA_MAJOR) {
    throw new IncompatibleSchemaVersionError(version)
  }
}

export const SchemaVersion = z
  .string()
  .regex(new RegExp(`^${SCHEMA_MAJOR}\\.\\d+\\.\\d+$`))
  .register(contracts, { id: 'SchemaVersion' })

export const Sha256Hex = z
  .string()
  .regex(/^[0-9a-f]{64}$/)
  .register(contracts, { id: 'Sha256Hex' })

// Machine-readable codes (error_code, fallback_reason, banner reasons): never raw exception text.
export const MachineCode = z
  .string()
  .regex(/^[a-z][a-z0-9_.]*$/)
  .max(64)
  .register(contracts, { id: 'MachineCode' })

export const Instrument = z
  .enum(['guitar', 'bass', 'piano', 'drums', 'vocals', 'other'])
  .register(contracts, { id: 'Instrument' })

export const StageStatus = z
  .enum(['pending', 'running', 'done', 'failed', 'fallback', 'skipped'])
  .register(contracts, { id: 'StageStatus' })

// Thresholds per model live in the calibration file (services/ml/config/calibration/).
export const ConfidenceBand = z
  .enum(['high', 'medium', 'low'])
  .register(contracts, { id: 'ConfidenceBand' })

export const SourceKind = z
  .enum(['upload', 'recording', 'url', 'example', 'licensed'])
  .register(contracts, { id: 'SourceKind' })

export const ArtefactKind = z
  .string()
  .regex(
    /^(manifest|probe|beats|tags|separation|presence|stems|sections|chords|summary|(notes|tab|render)\.(guitar|bass|piano|drums|vocals|other))$/,
  )
  .register(contracts, { id: 'ArtefactKind' })

export const ModelRef = z
  .object({
    model_id: z.string().min(1), // e.g. "beat_this/final0"
    version: z.string().min(1), // e.g. "1.1.0"
    weights_sha256: Sha256Hex,
    provider: z.enum(['self_hosted', 'vendor']),
    register_tier: z.enum(['green', 'amber', 'red']), // copied from the licence register at run time
  })
  .register(contracts, { id: 'ModelRef' })

export const Confidence = z.object({
  confidence: z.number().min(0).max(1), // calibrated
  confidence_raw: z.number().optional(), // model posterior / activation
})

export const ArtefactHeader = z
  .object({
    schema_version: SchemaVersion,
    artefact: ArtefactKind,
    artefact_version: z.number().int().positive(),
    analysis_id: z.uuid(),
    user_id: z.string().min(1),
    audio_hash: Sha256Hex, // sha256 of decoded PCM (03-data-model-and-storage.md "Keys")
    sample_rate: z.literal(44100),
    duration_s: z.number().positive(),
    models: z.array(ModelRef),
    params: z.record(z.string(), z.unknown()), // exact params used; part of the cache key
    created_at: z.iso.datetime(),
  })
  .register(contracts, { id: 'ArtefactHeader' })
