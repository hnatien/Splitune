import {
  Instrument,
  type PlayerState,
  SongStatus,
  SourceKind,
  UploadStatus,
} from '@splitune/contracts'
import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import type { z } from 'zod'
import { oneOf, timestamptz, values } from './columns.ts'
import { users } from './users.ts'

const seconds = (name: string) => numeric(name, { precision: 9, scale: 3, mode: 'number' })

export const songs = pgTable(
  'songs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    artist: text('artist'),
    sourceKind: text('source_kind', { enum: values(SourceKind) }).notNull(),
    sourceUrl: text('source_url'),
    instrument: text('instrument', { enum: values(Instrument) }).notNull(),
    durationS: seconds('duration_s'),
    audioHash: text('audio_hash'),
    status: text('status', { enum: values(SongStatus) })
      .notNull()
      .default('importing'),
    lastOpenedAt: timestamptz('last_opened_at'),
    playerState: jsonb('player_state')
      .$type<z.infer<typeof PlayerState>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('songs_user_audio_instrument_key').on(t.userId, t.audioHash, t.instrument),
    index('songs_user_last_opened_idx').on(t.userId, t.lastOpenedAt.desc()),
    check('songs_source_kind_check', oneOf(t.sourceKind, values(SourceKind))),
    check('songs_instrument_check', oneOf(t.instrument, values(Instrument))),
    check('songs_status_check', oneOf(t.status, values(SongStatus))),
  ],
)

export const uploads = pgTable(
  'uploads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    songId: uuid('song_id').references(() => songs.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(),
    // S3 multipart upload id and part size while the browser uploads (POST /v1/uploads).
    multipartUploadId: text('multipart_upload_id'),
    partSize: integer('part_size'),
    bytes: bigint('bytes', { mode: 'number' }).notNull(),
    mime: text('mime').notNull(),
    fileSha256: text('file_sha256').notNull(),
    container: text('container'),
    codec: text('codec'),
    durationS: seconds('duration_s'),
    // Nullable: personal mode has no upload warranty (25-personal-mode.md); the commercial profile
    // requires it at the API layer.
    rightsWarrantyAt: timestamptz('rights_warranty_at'),
    status: text('status', { enum: values(UploadStatus) }).notNull(),
    rejectReason: text('reject_reason'),
    expiresAt: timestamptz('expires_at').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('uploads_user_file_sha256_idx').on(t.userId, t.fileSha256),
    index('uploads_expires_at_idx').on(t.expiresAt),
    check('uploads_status_check', oneOf(t.status, values(UploadStatus))),
    check('uploads_bytes_check', sql`${t.bytes} >= 0`),
  ],
)

// Visual reference (Design B): only ids and user syncpoints, no media.
export const youtubeRefs = pgTable('youtube_refs', {
  songId: uuid('song_id')
    .primaryKey()
    .references(() => songs.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  videoId: text('video_id').notNull(),
  fetchedTitle: text('fetched_title'),
  apiDataRefreshedAt: timestamptz('api_data_refreshed_at'),
})

// No user_id column: RLS resolves ownership through songs.
export const syncPoints = pgTable(
  'sync_points',
  {
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    idx: integer('idx').notNull(),
    audioS: seconds('audio_s').notNull(),
    videoS: seconds('video_s').notNull(),
  },
  (t) => [primaryKey({ columns: [t.songId, t.idx] })],
)
