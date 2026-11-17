import type { Op } from './corrections'

// "It's right" (12 §4): the unsure mark goes, the chord or note stays. The overlay has no op that
// takes a confirmation back, so its undo is a report on the same entity carrying this comment:
// the mark returns and nothing else changes.
export const UNCONFIRM = 'undo:mark_correct'

/** The chords and notes the learner confirmed and hasn't taken back, from the ops in order. */
export function confirmedEntities(ops: readonly Op[]): Set<string> {
  const confirmed = new Set<string>()
  for (const op of ops) {
    if (op.op === 'mark_correct') confirmed.add(op.entity_id)
    else if (op.op === 'report_wrong' && op.comment === UNCONFIRM) confirmed.delete(op.entity_id)
  }
  return confirmed
}
