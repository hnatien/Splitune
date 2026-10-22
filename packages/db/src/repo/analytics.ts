import { sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { analyticsEvents } from '../schema/index.ts'

export interface NewAnalyticsEvent {
  name: string
  props: Record<string, unknown>
}

// Product events (16 §2) into analytics_events, as role `app`. Rows carry the salted user hash
// (`@splitune/analytics/server`) of a signed-in user, none for a visitor; never the user id.
export function analyticsRepo(db: Database) {
  return {
    record: async (userHash: string | null, events: NewAnalyticsEvent[]) => {
      if (events.length === 0) return
      await db.transaction(async (tx) => {
        await tx.execute(sql`set local role app`)
        await tx
          .insert(analyticsEvents)
          .values(events.map((e) => ({ userHash, name: e.name, props: e.props })))
      })
    },
  }
}
