import { eq } from 'drizzle-orm'
import { type Database, withUser } from '../client.ts'
import { auditLog, featureFlags, subscriptions, users } from '../schema/index.ts'

export type User = typeof users.$inferSelect
export type Subscription = typeof subscriptions.$inferSelect
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

// Rows are created by Better Auth or the seed script, not through this repository.
export function usersRepo(db: Database) {
  return {
    get: (userId: string) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx.select().from(users).where(eq(users.id, userId))
        return row
      }),

    // What GET /v1/me reads besides usage: the user, their cached subscription and the flags.
    profile: (userId: string) =>
      withUser(db, userId, async (tx) => {
        const [user] = await tx.select().from(users).where(eq(users.id, userId))
        if (!user) return undefined
        const [subscription] = await tx
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, userId))
        const flags = await tx
          .select({
            key: featureFlags.key,
            enabled: featureFlags.enabled,
            value: featureFlags.value,
          })
          .from(featureFlags)
        return { user, subscription, flags }
      }),

    // A change of training_opt_in is written to audit_log in the same transaction (04 "Me").
    updateProfile: (userId: string, patch: UserProfilePatch) =>
      withUser(db, userId, async (tx) => {
        const [before] = await tx
          .select({ trainingOptIn: users.trainingOptIn })
          .from(users)
          .where(eq(users.id, userId))
          .for('update')
        if (!before) return undefined
        const [row] = await tx
          .update(users)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(users.id, userId))
          .returning()
        if (patch.trainingOptIn !== undefined && patch.trainingOptIn !== before.trainingOptIn) {
          await tx.insert(auditLog).values({
            actor: userId,
            action: 'training_opt_in.changed',
            subjectUserId: userId,
            subject: { from: before.trainingOptIn, to: patch.trainingOptIn },
          })
        }
        return row
      }),
  }
}
