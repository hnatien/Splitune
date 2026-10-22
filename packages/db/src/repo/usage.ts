import { and, eq, inArray, sql } from 'drizzle-orm'
import { type Database, withUser } from '../client.ts'
import { type UsageKind, usageLedger } from '../schema/index.ts'

export type UsageEntry = typeof usageLedger.$inferSelect
export type NewUsageEntry = Omit<typeof usageLedger.$inferInsert, 'id' | 'userId' | 'createdAt'>

export function usageRepo(db: Database) {
  return {
    record: (userId: string, entry: NewUsageEntry) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .insert(usageLedger)
          .values({ ...entry, userId })
          .returning()
        return row as UsageEntry
      }),

    // Units per kind; `periodStart` omitted = lifetime (the Welcome analysis never resets).
    totals: (userId: string, kinds: readonly UsageKind[], periodStart?: string) =>
      withUser(db, userId, async (tx) => {
        const rows = await tx
          .select({
            kind: usageLedger.kind,
            units: sql<number>`coalesce(sum(${usageLedger.units}), 0)::int`,
          })
          .from(usageLedger)
          .where(
            and(
              eq(usageLedger.userId, userId),
              inArray(usageLedger.kind, [...kinds]),
              periodStart === undefined ? undefined : eq(usageLedger.periodStart, periodStart),
            ),
          )
          .groupBy(usageLedger.kind)
        const totals = Object.fromEntries(kinds.map((k) => [k, 0])) as Record<UsageKind, number>
        for (const row of rows) totals[row.kind] = row.units
        return totals
      }),

    // Units per kind and period, every period: what entitlements() needs (small: one row per
    // kind and month).
    summary: (userId: string) =>
      withUser(db, userId, (tx) =>
        tx
          .select({
            kind: usageLedger.kind,
            periodStart: usageLedger.periodStart,
            units: sql<number>`coalesce(sum(${usageLedger.units}), 0)::int`,
          })
          .from(usageLedger)
          .where(eq(usageLedger.userId, userId))
          .groupBy(usageLedger.kind, usageLedger.periodStart),
      ),

    // Failed or fallback-only runs never count (23-plans-free-and-paid.md §2).
    refundAnalysis: (userId: string, analysisId: string) =>
      withUser(db, userId, async (tx) => {
        const rows = await tx
          .delete(usageLedger)
          .where(and(eq(usageLedger.userId, userId), eq(usageLedger.analysisId, analysisId)))
          .returning({ id: usageLedger.id })
        return rows.length
      }),
  }
}
