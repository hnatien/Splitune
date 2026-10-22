import { z } from 'zod'
import { ArtefactKind, Instrument, ModelRef, Sha256Hex } from './analysis/common.ts'
import { StageState } from './analysis/manifest.ts'
import { RecommendedView } from './analysis/summary.ts'
import { ExampleId, ExampleLoop, ExamplePart, ExampleSpeeds } from './api/examples.ts'

// The examples.json manifest `pnpm examples:build` writes and the API ships (13 §1). Server-side
// only: its own entry point (`@splitune/contracts/examples-manifest`), so the browser bundle never
// carries it; visitors get the public `Example` shape from GET /v1/examples.

// A file of the build, relative to its prefix: an analysis document or a stem's audio.
export const ExamplePath = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_.-]{0,63}(\/[a-z0-9][a-z0-9_.-]{0,63})?$/)

export const ExampleArtefact = z.object({
  id: z.uuid(),
  kind: ArtefactKind,
  version: z.number().int().positive(),
  path: ExamplePath,
  bytes: z.number().int().nonnegative(),
  sha256: Sha256Hex,
  model_refs: z.array(ModelRef),
})

export const ManifestExample = z.object({
  id: ExampleId,
  // Object prefix assets/examples/{id}/{build}/: a rebuild never overwrites cached files.
  build: z.string().regex(/^\d{8}T\d{6}Z$/),
  title: z.string().min(1).max(200),
  artist: z.string().min(1).max(200).nullable(),
  instrument: Instrument,
  part: ExamplePart,
  duration_s: z.number().positive(),
  audio_hash: Sha256Hex,
  // Stable ids the visitor's browser uses for the song and its analysis before an account exists.
  song_id: z.uuid(),
  analysis: z.object({
    id: z.uuid(),
    pipeline_version: z.string().min(1),
    recommended_view: RecommendedView.nullable(),
    stages: z.record(z.string(), StageState),
    created_at: z.iso.datetime(),
    finished_at: z.iso.datetime(),
  }),
  artefacts: z.array(ExampleArtefact).min(1),
  loop: ExampleLoop,
  speed_pct: ExampleSpeeds,
})

export const ExamplesManifest = z.object({
  version: z.literal(1),
  examples: z.array(ManifestExample),
})
