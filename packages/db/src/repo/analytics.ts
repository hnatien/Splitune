import { sql } from 'drizzle-orm'
import { type Database, withUser } from '../client.ts'
import { analyticsEvents } from '../schema/index.ts'

export interface NewAnalyticsEvent {
  name: string
  props: Record<string, unknown>
}

// Product events (16 §2) into analytics_events, as role `app`: a signed-in user's events carry
// their id (RLS checks it), a visitor's carry none.
export function analyticsRepo(db: Database) {
  return {
    record: async (userId: string | null, events: NewAnalyticsEvent[]) => {
      if (events.length === 0) return
      const rows = events.map((e) => ({ userId, name: e.name, props: e.props }))
      if (userId !== null) {
        await withUser(db, userId, (tx) => tx.insert(analyticsEvents).values(rows))
        return
      }
      await db.transaction(async (tx) => {
        await tx.execute(sql`set local role app`)
        await tx.insert(analyticsEvents).values(rows)
      })
    },
  }
}
