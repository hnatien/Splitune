import {
  AttemptOutcome,
  PracticeSessionInput,
  RestBetween,
  type SpeedTrainer,
} from '@splitune/contracts'
import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core'
import type { z } from 'zod'
import { oneOf, timestamptz, values } from './columns.ts'
import { songs } from './library.ts'
import { users } from './users.ts'

const InputMode = PracticeSessionInput.shape.input_mode
const seconds = (name: string) => numeric(name, { precision: 9, scale: 3, mode: 'number' })

// Bars are the beat grid's 0-based bar_index (pickup -1); beats are 1-based within the bar.
export const loopClips = pgTable(
  'loop_clips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    name: text('name'),
    startBar: integer('start_bar').notNull(),
    startBeat: integer('start_beat').notNull().default(1),
    endBar: integer('end_bar').notNull(),
    endBeat: integer('end_beat').notNull(),
    startS: seconds('start_s').notNull(),
    endS: seconds('end_s').notNull(),
    restBetween: text('rest_between', { enum: values(RestBetween) })
      .notNull()
      .default('none'),
    countInBars: integer('count_in_bars').notNull().default(1),
    trainer: jsonb('trainer').$type<z.infer<typeof SpeedTrainer>>(),
    bestCleanTempoPct: integer('best_clean_tempo_pct'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('loop_clips_song_idx').on(t.songId),
    check('loop_clips_rest_between_check', oneOf(t.restBetween, values(RestBetween))),
    check('loop_clips_range_check', sql`${t.endS} > ${t.startS}`),
  ],
)

export const practiceSessions = pgTable(
  'practice_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    startedAt: timestamptz('started_at').notNull(),
    endedAt: timestamptz('ended_at'),
    inputMode: text('input_mode', { enum: values(InputMode) })
      .notNull()
      .default('touch'),
    clientSessionId: uuid('client_session_id').notNull().unique(),
  },
  (t) => [
    index('practice_sessions_user_song_idx').on(t.userId, t.songId),
    check('practice_sessions_input_mode_check', oneOf(t.inputMode, values(InputMode))),
  ],
)

export const practiceAttempts = pgTable(
  'practice_attempts',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => practiceSessions.id, { onDelete: 'cascade' }),
    loopClipId: uuid('loop_clip_id').references(() => loopClips.id, { onDelete: 'set null' }),
    tempoPct: integer('tempo_pct').notNull(),
    outcome: text('outcome', { enum: values(AttemptOutcome) }).notNull(),
    score: jsonb('score'),
    override: boolean('override').notNull().default(false),
    at: timestamptz('at').notNull(),
    clientAttemptId: uuid('client_attempt_id').notNull().unique(),
  },
  (t) => [
    index('practice_attempts_loop_clip_idx').on(t.loopClipId, t.at),
    check('practice_attempts_outcome_check', oneOf(t.outcome, values(AttemptOutcome))),
  ],
)
