import {
  AnalysisKind,
  AnalysisStatus,
  type CorrectionOp,
  Instrument,
  type ModelRef,
  RecommendedView,
  StageName,
  StageStatus,
} from '@splitune/contracts'
import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  bigint,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import type { z } from 'zod'
import { oneOf, timestamptz, values } from './columns.ts'
import { songs } from './library.ts'
import { users } from './users.ts'

type ModelRefs = z.infer<typeof ModelRef>[]
const usd = (name: string) => numeric(name, { precision: 10, scale: 5, mode: 'number' })

export const analyses = pgTable(
  'analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    pipelineVersion: text('pipeline_version').notNull(),
    configProfile: text('config_profile').notNull(),
    requestedInstrument: text('requested_instrument', { enum: values(Instrument) }).notNull(),
    analysisType: text('analysis_type', { enum: values(AnalysisKind) }).notNull(),
    status: text('status', { enum: values(AnalysisStatus) }).notNull(),
    progress: real('progress').notNull().default(0),
    idempotencyKey: text('idempotency_key').notNull(),
    workflowRunId: text('workflow_run_id'),
    // Earlier analysis of the same song whose decode and beats this one reuses instead of running
    // them again (Lite → Full upgrade; 23 §2). Their artefacts stay that analysis' rows.
    baseAnalysisId: uuid('base_analysis_id').references((): AnyPgColumn => analyses.id, {
      onDelete: 'set null',
    }),
    costUsdEstimate: usd('cost_usd_estimate'),
    // summary.json's recommended_view for the requested instrument, written by finalize, so the
    // library can show "Chords only" without reading the artefact (27 §3.5).
    recommendedView: text('recommended_view', { enum: values(RecommendedView) }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    finishedAt: timestamptz('finished_at'),
  },
  (t) => [
    unique('analyses_user_idempotency_key').on(t.userId, t.idempotencyKey),
    index('analyses_song_idx').on(t.songId, t.createdAt.desc()),
    check('analyses_requested_instrument_check', oneOf(t.requestedInstrument, values(Instrument))),
    check('analyses_analysis_type_check', oneOf(t.analysisType, values(AnalysisKind))),
    check('analyses_status_check', oneOf(t.status, values(AnalysisStatus))),
    check('analyses_progress_check', sql`${t.progress} between 0 and 1`),
    check('analyses_recommended_view_check', oneOf(t.recommendedView, values(RecommendedView))),
  ],
)

// No user_id column: RLS resolves ownership through analyses.
export const stageRuns = pgTable(
  'stage_runs',
  {
    analysisId: uuid('analysis_id')
      .notNull()
      .references(() => analyses.id, { onDelete: 'cascade' }),
    stage: text('stage', { enum: values(StageName) }).notNull(),
    status: text('status', { enum: values(StageStatus) }).notNull(),
    modelRefs: jsonb('model_refs').$type<ModelRefs>().notNull(),
    cacheKey: text('cache_key').notNull(),
    attempts: integer('attempts').notNull().default(0),
    errorCode: text('error_code'),
    gpuSeconds: real('gpu_seconds'),
    vendorMinutes: real('vendor_minutes'),
    vendorCostUsd: usd('vendor_cost_usd'),
    startedAt: timestamptz('started_at'),
    finishedAt: timestamptz('finished_at'),
  },
  (t) => [
    primaryKey({ columns: [t.analysisId, t.stage] }),
    index('stage_runs_cache_key_idx').on(t.cacheKey),
    check('stage_runs_stage_check', oneOf(t.stage, values(StageName))),
    check('stage_runs_status_check', oneOf(t.status, values(StageStatus))),
  ],
)

export const artefacts = pgTable(
  'artefacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    analysisId: uuid('analysis_id')
      .notNull()
      .references(() => analyses.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    version: integer('version').notNull(),
    objectKey: text('object_key').notNull(),
    bytes: integer('bytes').notNull(),
    sha256: text('sha256').notNull(),
    modelRefs: jsonb('model_refs').$type<ModelRefs>().notNull(),
    // Stems expire after inactivity (sweeper); JSON artefacts are kept while the song exists.
    expiresAt: timestamptz('expires_at'),
    // When the sweeper deleted a stems artefact's audio files (15 §3); the row and its JSON stay.
    purgedAt: timestamptz('purged_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('artefacts_analysis_kind_version_key').on(t.analysisId, t.kind, t.version),
    index('artefacts_expires_at_idx').on(t.expiresAt),
  ],
)

export const correctionOps = pgTable(
  'correction_ops',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    artefactId: uuid('artefact_id')
      .notNull()
      .references(() => artefacts.id, { onDelete: 'cascade' }),
    rev: integer('rev').notNull(),
    op: jsonb('op').$type<z.infer<typeof CorrectionOp>>().notNull(),
    clientOpId: uuid('client_op_id').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('correction_ops_artefact_rev_key').on(t.artefactId, t.rev),
    unique('correction_ops_user_client_op_key').on(t.userId, t.clientOpId),
    check('correction_ops_rev_check', sql`${t.rev} > 0`),
  ],
)
