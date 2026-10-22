import { z } from 'zod'
import { Instrument, SourceKind } from '../analysis/common.ts'
import { CorrectionOp } from '../analysis/corrections.ts'
import { AnalysisKind, AnalysisStatus } from './analyses.ts'
import { RestBetween, SpeedTrainer } from './loops.ts'
import { Handedness, Level } from './me.ts'
import { Plan } from './plan.ts'
import { AttemptOutcome } from './practice.ts'
import { PlayerState, SongStatus } from './songs.ts'
import { UploadStatus } from './uploads.ts'

// Privacy self-service (15 §4): "Download my data" and "Delete my account".

// The latest export request. The node worker writes the bundle to the bucket; it can be downloaded
// until expires_at (24 h after it was written), then the sweeper removes it.
export const DataExportState = z.object({
  status: z.enum(['none', 'pending', 'ready', 'failed']),
  requested_at: z.iso.datetime().nullable(),
  ready_at: z.iso.datetime().nullable(),
  expires_at: z.iso.datetime().nullable(),
  url: z.url().nullable(), // presigned GET, valid until expires_at
})

// Deletion is queued at once; the node worker removes every object and row soon after.
export const DeleteMeOutput = z.object({ purge_after: z.iso.datetime() })

const Instant = z.iso.datetime()

// The bundle itself (JSON, `u/{user}/exports/{id}.json`): everything Splitune holds about the
// account, plus links to the user's own uploads that still exist (valid as long as the bundle).
export const DataExport = z.object({
  format: z.literal('splitune.data_export'),
  version: z.literal(1),
  generated_at: Instant,
  account: z.object({
    id: z.string().min(1),
    email: z.email(),
    display_name: z.string().nullable(),
    primary_instrument: Instrument.nullable(),
    level: Level.nullable(),
    handedness: Handedness,
    training_opt_in: z.boolean(),
    marketing_opt_in: z.boolean(),
    created_at: Instant,
  }),
  subscription: z
    .object({
      plan: Plan,
      status: z.string().min(1),
      current_period_start: Instant.nullable(),
      current_period_end: Instant.nullable(),
      cancel_at_period_end: z.boolean(),
    })
    .nullable(),
  usage: z.array(z.object({ kind: z.string().min(1), period_start: z.iso.date(), at: Instant })),
  billing_events: z.array(z.object({ id: z.string().min(1), type: z.string(), at: Instant })),
  songs: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      artist: z.string().nullable(),
      instrument: Instrument,
      source_kind: SourceKind,
      source_url: z.string().nullable(),
      duration_s: z.number().nonnegative().nullable(),
      status: SongStatus,
      player_state: PlayerState,
      created_at: Instant,
      last_opened_at: Instant.nullable(),
      analyses: z.array(
        z.object({
          id: z.uuid(),
          version: z.number().int().positive(),
          type: AnalysisKind,
          status: AnalysisStatus,
          instrument: Instrument,
          created_at: Instant,
          finished_at: Instant.nullable(),
        }),
      ),
      uploads: z.array(
        z.object({
          id: z.uuid(),
          mime: z.string(),
          bytes: z.number().int().nonnegative(),
          status: UploadStatus,
          created_at: Instant,
          download_url: z.url().nullable(),
        }),
      ),
      loops: z.array(
        z.object({
          id: z.uuid(),
          name: z.string().nullable(),
          start_bar: z.number().int(),
          start_beat: z.number().int(),
          end_bar: z.number().int(),
          end_beat: z.number().int(),
          rest_between: RestBetween,
          count_in_bars: z.number().int(),
          trainer: SpeedTrainer.nullable(),
          best_clean_tempo_pct: z.number().int().nullable(),
          created_at: Instant,
        }),
      ),
      corrections: z.array(
        z.object({
          artefact_kind: z.string().min(1),
          analysis_id: z.uuid(),
          rev: z.number().int().positive(),
          op: CorrectionOp,
          created_at: Instant,
        }),
      ),
    }),
  ),
  practice_sessions: z.array(
    z.object({
      id: z.uuid(),
      song_id: z.uuid(),
      started_at: Instant,
      ended_at: Instant.nullable(),
      input_mode: z.string(),
      attempts: z.array(
        z.object({
          loop_clip_id: z.uuid().nullable(),
          tempo_pct: z.number().int(),
          outcome: AttemptOutcome,
          override: z.boolean(),
          at: Instant,
        }),
      ),
    }),
  ),
})

// Job payloads the API enqueues for the node worker (`export_user_data`, `delete_account`).
export const UserJobPayload = z.object({ user_id: z.string().min(1) })
