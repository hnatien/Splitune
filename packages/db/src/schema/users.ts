import { Handedness, Instrument, Level } from '@splitune/contracts'
import { sql } from 'drizzle-orm'
import { boolean, check, integer, pgTable, text } from 'drizzle-orm/pg-core'
import { citext, oneOf, timestamptz, values } from './columns.ts'

// Splitune's own user columns plus the ones Better Auth's user model owns (name, email_verified,
// image, updated_at; see auth.ts). Better Auth ids are text, so every `user_id` foreign key is text.
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: citext('email').notNull().unique(),
    // Better Auth: name from the OAuth profile ('' for magic-link sign-ups), not shown as-is.
    name: text('name').notNull().default(''),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    displayName: text('display_name'),
    primaryInstrument: text('primary_instrument', { enum: values(Instrument) }),
    level: text('level', { enum: values(Level) }),
    handedness: text('handedness', { enum: values(Handedness) })
      .notNull()
      .default('right'),
    trainingOptIn: boolean('training_opt_in').notNull().default(false),
    marketingOptIn: boolean('marketing_opt_in').notNull().default(false),
    country: text('country'),
    birthYear: integer('birth_year'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (t) => [
    check('users_primary_instrument_check', oneOf(t.primaryInstrument, values(Instrument))),
    check('users_level_check', oneOf(t.level, values(Level))),
    check('users_handedness_check', oneOf(t.handedness, values(Handedness))),
    check('users_id_check', sql`${t.id} <> ''`),
  ],
)
