import { sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { featureFlags } from '../schema/index.ts'

// Remote flags and plan limits (23 §6) for requests without a user, e.g. the public plans list.
// Read as role `app`, like a signed-in request reads them.
export function flagsRepo(db: Database) {
  return {
    list: () =>
      db.transaction(async (tx) => {
        await tx.execute(sql`set local role app`)
        return tx
          .select({
            key: featureFlags.key,
            enabled: featureFlags.enabled,
            value: featureFlags.value,
          })
          .from(featureFlags)
      }),
  }
}
