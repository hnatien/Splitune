import type { CorrectionOp } from '@splitune/contracts'
import { and, asc, eq, gt, inArray, max, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { type Database, withUser } from '../client.ts'
import { artefacts, correctionOps } from '../schema/index.ts'

export type CorrectionOpRow = typeof correctionOps.$inferSelect
export interface PendingOp {
  clientOpId: string
  op: z.infer<typeof CorrectionOp>
}

export function correctionsRepo(db: Database) {
  return {
    // Appends ops in order with consecutive revs. Ops whose client_op_id is already stored are
    // skipped, so offline batches can be replayed. Returns undefined if the artefact is not the
    // user's. A per-artefact advisory lock serialises concurrent appends.
    append: (userId: string, artefactId: string, ops: PendingOp[]) =>
      withUser(db, userId, async (tx) => {
        const [artefact] = await tx
          .select({ id: artefacts.id })
          .from(artefacts)
          .where(and(eq(artefacts.userId, userId), eq(artefacts.id, artefactId)))
        if (!artefact) return undefined
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${artefactId}, 0))`)

        const ids = ops.map((o) => o.clientOpId)
        const seen =
          ids.length === 0
            ? []
            : await tx
                .select({ clientOpId: correctionOps.clientOpId })
                .from(correctionOps)
                .where(
                  and(eq(correctionOps.userId, userId), inArray(correctionOps.clientOpId, ids)),
                )
        const skip = new Set(seen.map((s) => s.clientOpId))
        const fresh = ops.filter(
          (o, i) => !skip.has(o.clientOpId) && ids.indexOf(o.clientOpId) === i,
        )

        const [head] = await tx
          .select({ rev: max(correctionOps.rev) })
          .from(correctionOps)
          .where(eq(correctionOps.artefactId, artefactId))
        let rev = head?.rev ?? 0
        if (fresh.length > 0) {
          await tx.insert(correctionOps).values(
            fresh.map((o) => {
              rev += 1
              return { userId, artefactId, rev, op: o.op, clientOpId: o.clientOpId }
            }),
          )
        }
        return { rev, applied: fresh.map((o) => o.clientOpId) }
      }),

    // The rev each client op was stored with on this artefact (replays included).
    revsOf: (userId: string, artefactId: string, clientOpIds: string[]) =>
      withUser(db, userId, async (tx) => {
        if (clientOpIds.length === 0) return new Map<string, number>()
        const rows = await tx
          .select({ clientOpId: correctionOps.clientOpId, rev: correctionOps.rev })
          .from(correctionOps)
          .where(
            and(
              eq(correctionOps.userId, userId),
              eq(correctionOps.artefactId, artefactId),
              inArray(correctionOps.clientOpId, clientOpIds),
            ),
          )
        return new Map(rows.map((r) => [r.clientOpId, r.rev]))
      }),

    listSince: (userId: string, artefactId: string, afterRev = 0) =>
      withUser(db, userId, (tx) =>
        tx
          .select()
          .from(correctionOps)
          .where(
            and(
              eq(correctionOps.userId, userId),
              eq(correctionOps.artefactId, artefactId),
              gt(correctionOps.rev, afterRev),
            ),
          )
          .orderBy(asc(correctionOps.rev)),
      ),
  }
}
