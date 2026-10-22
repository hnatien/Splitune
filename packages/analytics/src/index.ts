import type { AnalyticsEvent } from '@splitune/contracts'
import type { z } from 'zod'

// Typed track() (16 §2): the event taxonomy is AnalyticsEvent in @splitune/contracts, so web and
// API send exactly what POST /v1/events accepts. Events are batched briefly and sent together;
// analytics is best effort, so a batch that can't be sent is dropped rather than retried.

export const VERSION = '0.0.0'

export type Event = z.infer<typeof AnalyticsEvent>
export type EventName = Event['name']
export type PropsOf<N extends EventName> = Extract<Event, { name: N }>['props']

export interface Tracker {
  track<N extends EventName>(name: N, props: PropsOf<N>): void
  /** Sends what is queued now (e.g. when the page is hidden). */
  flush(): Promise<void>
}

const MAX_BATCH = 20

export function createTracker({
  send,
  delayMs = 1000,
}: {
  send: (events: Event[]) => Promise<void>
  delayMs?: number
}): Tracker {
  let queue: Event[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = async () => {
    clearTimeout(timer)
    timer = undefined
    while (queue.length > 0) {
      const batch = queue.slice(0, MAX_BATCH)
      queue = queue.slice(MAX_BATCH)
      try {
        await send(batch)
      } catch {
        // Offline or the API is away: these events are lost (best effort, see above).
      }
    }
  }
  return {
    track(name, props) {
      queue.push({ name, props } as Event)
      if (queue.length >= MAX_BATCH) void flush()
      else timer ??= setTimeout(() => void flush(), delayMs)
    },
    flush,
  }
}
