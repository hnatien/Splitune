import { z } from 'zod'
import { contracts } from '../registry.ts'
import { ArtefactKind, MachineCode, ModelRef, Sha256Hex } from './common.ts'

// Stage catalogue of 06-ml-pipeline-service.md §0 and §2 (also the `jobs.kind` values for stages).
export const StageName = z
  .enum([
    'url_import',
    'decode',
    'beats',
    'tag',
    'separate',
    'stem_post',
    'chords',
    'notes.guitar',
    'notes.bass',
    'notes.piano',
    'notes.drums',
    'notes.vocals',
    'notes.other',
    'f0.vocals',
    'sections',
    'lyrics',
    'finalize',
  ])
  .register(contracts, { id: 'StageName' })

// Bucket object key, e.g. "u/{user_id}/a/{analysis_id}/v1/beats.json".
export const ObjectKey = z.string().min(1).max(1024).register(contracts, { id: 'ObjectKey' })

export const HttpUrl = z
  .url({ protocol: /^https?$/ })
  .regex(/^https?:\/\//)
  .register(contracts, { id: 'HttpUrl' })

// Commercial path only (hosted workers without bucket credentials): presigned GET/PUT URLs for the
// same logical names as `inputs`/`outputs`. Presigned URLs are credentials: never log them.
export const PresignedUrls = z
  .object({
    inputs: z.record(z.string(), HttpUrl),
    outputs: z.record(z.string(), HttpUrl),
  })
  .register(contracts, { id: 'PresignedUrls' })

export const StageCallback = z
  .object({ url: HttpUrl, nonce: z.string().min(16) })
  .register(contracts, { id: 'StageCallback' })

// Personal mode: the worker reads this from `jobs.payload` and uses its own bucket credentials, so
// only object keys are required. Output keys are fixed per stage, which makes re-runs idempotent.
// `cache_key` is optional because the enqueuer cannot know `audio_hash` before decode has run; the
// worker then computes it (03-data-model-and-storage.md "Keys") from the decoded audio, the model
// refs and the params.
export const StageRequest = z
  .object({
    analysis_id: z.uuid(),
    user_id: z.string().min(1),
    stage: StageName,
    cache_key: Sha256Hex.optional(),
    inputs: z.record(z.string(), ObjectKey),
    outputs: z.record(z.string(), ObjectKey),
    params: z.record(z.string(), z.unknown()),
    presigned: PresignedUrls.optional(),
    callback: StageCallback.optional(),
  })
  .register(contracts, { id: 'StageRequest' })

export const ArtefactWritten = z
  .object({
    kind: ArtefactKind,
    version: z.number().int().positive(),
    key: ObjectKey,
    sha256: Sha256Hex,
    bytes: z.number().int().nonnegative(),
  })
  .register(contracts, { id: 'ArtefactWritten' })

export const StageMetrics = z
  .object({
    gpu_s: z.number().nonnegative().optional(),
    cpu_s: z.number().nonnegative().optional(),
    peak_vram_mb: z.number().nonnegative().optional(),
    cold_start_s: z.number().nonnegative().optional(),
    audio_s: z.number().nonnegative().optional(),
  })
  .register(contracts, { id: 'StageMetrics' })

export const StageResult = z
  .object({
    analysis_id: z.uuid(),
    stage: StageName,
    status: z.enum(['done', 'failed', 'fallback']),
    artefacts: z.array(ArtefactWritten),
    model_refs: z.array(ModelRef),
    metrics: StageMetrics,
    error_code: MachineCode.optional(), // stack traces go to logs, never into results
    fallback_reason: MachineCode.optional(),
  })
  .register(contracts, { id: 'StageResult' })
