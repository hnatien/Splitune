import { z } from 'zod'
import { CorrectionOp } from '../analysis/corrections.ts'

export const ListCorrectionsInput = z.object({
  id: z.uuid(), // artefact id
  after_rev: z.number().int().nonnegative().optional(),
})

export const CorrectionRecord = z.object({
  rev: z.number().int().positive(),
  client_op_id: z.uuid(),
  op: CorrectionOp,
  created_at: z.iso.datetime(),
})

export const ListCorrectionsOutput = z.object({ ops: z.array(CorrectionRecord) })

// client_op_id (UUIDv7 made on the device) makes offline replays idempotent.
export const CorrectionsBatchInput = z.object({
  id: z.uuid(), // artefact id
  ops: z
    .array(z.object({ client_op_id: z.uuid(), op: CorrectionOp }))
    .min(1)
    .max(500),
})

export const CorrectionsBatchOutput = z.object({
  applied: z.array(z.object({ client_op_id: z.uuid(), rev: z.number().int().positive() })),
})
