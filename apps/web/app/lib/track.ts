import type { EventName, PropsOf } from '@splitune/analytics'

// Product events from any screen (16 §2). Calls only queue here; the sender (telemetry.ts) attaches
// after the first render from a chunk outside the route budgets (10 §9) and adds what describes
// the device (browser family, device class, the app around an in-app browser). Analytics fails
// closed: blocked or offline, events are dropped and nothing else changes (16 §6).

const DEVICE_PROPS = ['browser', 'device_class', 'app'] as const
type Queued<N extends EventName> = Omit<PropsOf<N>, (typeof DEVICE_PROPS)[number]>
export type QueuedEvent = { name: EventName; props: Record<string, unknown> }

let sink: ((event: QueuedEvent) => void) | undefined
const queue: QueuedEvent[] = []

export function track<N extends EventName>(name: N, props: Queued<N>): void {
  const event = { name, props }
  if (sink) sink(event)
  else if (queue.length < 100) queue.push(event)
}

/** The sender takes over; what was queued before goes first. */
export function connectTracker(send: (event: QueuedEvent) => void): void {
  sink = send
  for (const event of queue.splice(0)) send(event)
}

// An edit in the practice editor (16 §2 correction rate): the op and the model that made the
// artefact. mark_correct is a confirmation, not a correction.
export function trackCorrection(
  kind: 'chords' | 'notes' | 'beats',
  op: string,
  model: { model_id: string; version: string } | undefined,
): void {
  const model_ref = model ? `${model.model_id}@${model.version}` : null
  const entity = kind === 'chords' ? 'chord' : kind === 'notes' ? 'note' : 'beat'
  if (op === 'report_wrong') {
    if (entity !== 'beat') track('wrong_reported', { entity, model_ref })
  } else if (op !== 'mark_correct') {
    track('correction_made', { op, entity: op === 'set_section' ? 'section' : entity, model_ref })
  }
}
