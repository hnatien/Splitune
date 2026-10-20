import { eq } from 'drizzle-orm'
import { type Database, withUser } from '../client.ts'
import { users } from '../schema/index.ts'

export type User = typeof users.$inferSelect
export type UserProfilePatch = Partial<
  Pick<
    User,
    | 'displayName'
    | 'primaryInstrument'
    | 'level'
    | 'handedness'
    | 'trainingOptIn'
    | 'marketingOptIn'
    | 'country'
  >
>

// Rows are created by Better Auth (step 04) or the seed script, not through this repository.
export function usersRepo(db: Database) {
  return {
    get: (userId: string) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx.select().from(users).where(eq(users.id, userId))
        return row
      }),

    updateProfile: (userId: string, patch: UserProfilePatch) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx.update(users).set(patch).where(eq(users.id, userId)).returning()
        return row
      }),
  }
}
