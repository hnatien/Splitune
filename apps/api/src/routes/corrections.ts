import { apiError } from '../errors.ts'
import { authed, userRateLimit } from '../procedures.ts'

// Corrections overlay (05 "Corrections overlay"): ops per artefact in rev order. Appends are
// idempotent on client_op_id, so the web app's offline queue can replay a batch safely.
export const corrections = {
  listCorrections: authed.artefacts.listCorrections.handler(async ({ context, input }) => {
    const { deps, userId } = context
    if (!(await deps.repos.artefacts.get(userId, input.id))) throw apiError('not_found')
    const rows = await deps.repos.corrections.listSince(userId, input.id, input.after_rev ?? 0)
    return {
      ops: rows.map((row) => ({
        rev: row.rev,
        client_op_id: row.clientOpId,
        op: row.op,
        created_at: row.createdAt.toISOString(),
      })),
    }
  }),

  applyCorrections: authed
    .use(userRateLimit('corrections'))
    .artefacts.applyCorrections.handler(async ({ context, input }) => {
      const { deps, userId } = context
      const result = await deps.repos.corrections.append(
        userId,
        input.id,
        input.ops.map((o) => ({ clientOpId: o.client_op_id, op: o.op })),
      )
      if (!result) throw apiError('not_found')
      // Replayed ops keep the rev they were first stored with.
      const ids = input.ops.map((o) => o.client_op_id)
      const stored = await deps.repos.corrections.revsOf(userId, input.id, ids)
      return {
        applied: ids.flatMap((id) => {
          const rev = stored.get(id)
          return rev === undefined ? [] : [{ client_op_id: id, rev }]
        }),
      }
    }),
}
