import { sql } from 'drizzle-orm'
import { bigint, check, jsonb, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core'
import { oneOf, timestamptz } from './columns.ts'
import { users } from './users.ts'

// Dormant in personal mode (no DMCA programme); kept so the commercial profile needs no migration.
const NOTICE_STATUSES = [
  'received',
  'invalid',
  'actioned',
  'counter_noticed',
  'restored',
  'closed',
] as const

export const dmcaNotices = pgTable(
  'dmca_notices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    receivedAt: timestamptz('received_at').notNull(),
    channel: text('channel').notNull(),
    claimant: jsonb('claimant').notNull(),
    workDescription: text('work_description').notNull(),
    identifiedSongIds: uuid('identified_song_ids').array().notNull().default(sql`'{}'::uuid[]`),
    status: text('status', { enum: NOTICE_STATUSES }).notNull(),
    rawNoticeKey: text('raw_notice_key').notNull(),
  },
  (t) => [
    check('dmca_notices_status_check', oneOf(t.status, NOTICE_STATUSES)),
    check('dmca_notices_channel_check', oneOf(t.channel, ['form', 'email'])),
  ],
)

// No foreign keys to users/songs: the record outlives them.
export const dmcaActions = pgTable('dmca_actions', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  noticeId: uuid('notice_id').references(() => dmcaNotices.id),
  songId: uuid('song_id'),
  userId: text('user_id'),
  action: text('action').notNull(),
  at: timestamptz('at').notNull().defaultNow(),
  actor: text('actor').notNull(),
})

export const dmcaStrikes = pgTable(
  'dmca_strikes',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    noticeId: uuid('notice_id')
      .notNull()
      .references(() => dmcaNotices.id),
    at: timestamptz('at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.noticeId] })],
)
