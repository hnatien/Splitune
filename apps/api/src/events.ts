import { queue } from '@splitune/db'
import type { Logger } from './logger.ts'

const RETRY_MS = 5_000

// Wakes SSE streams when their analysis gets a job event (LISTEN job_events; migration 0006 adds
// the trigger). One connection serves every stream; it opens with the first subscriber and closes
// with the last, so an idle API holds no extra connection. Streams poll as well, so a lost
// listener only delays them until it reconnects.
export class EventHub {
  private readonly subscribers = new Map<string, Set<() => void>>()
  private listener: Promise<queue.JobListener | undefined> | undefined
  private retry: NodeJS.Timeout | undefined
  private readonly url: string
  private readonly log: Logger

  constructor(url: string, log: Logger) {
    this.url = url
    this.log = log
  }

  // Returns the unsubscribe function.
  subscribe(analysisId: string, wake: () => void): () => void {
    let wakers = this.subscribers.get(analysisId)
    if (wakers === undefined) {
      wakers = new Set()
      this.subscribers.set(analysisId, wakers)
    }
    wakers.add(wake)
    this.connect()
    return () => {
      wakers.delete(wake)
      if (wakers.size === 0) this.subscribers.delete(analysisId)
      if (this.subscribers.size === 0) void this.disconnect()
    }
  }

  private connect(): void {
    if (this.listener !== undefined || this.subscribers.size === 0) return
    this.listener = queue
      .listenForJobEvents(
        this.url,
        (analysisId) => {
          for (const wake of this.subscribers.get(analysisId) ?? []) wake()
        },
        (error) => {
          this.log.warn({ err_name: error.name }, 'job event listener lost')
          void this.disconnect().then(() => this.scheduleRetry())
        },
      )
      .catch((error: unknown) => {
        this.log.warn({ err_name: (error as Error).name }, 'job event listener failed')
        this.listener = undefined
        this.scheduleRetry()
        return undefined
      })
  }

  private scheduleRetry(): void {
    clearTimeout(this.retry)
    if (this.subscribers.size === 0) return
    this.retry = setTimeout(() => this.connect(), RETRY_MS)
  }

  private async disconnect(): Promise<void> {
    clearTimeout(this.retry)
    const listener = this.listener
    this.listener = undefined
    try {
      await (await listener)?.close()
    } catch (error) {
      this.log.warn({ err_name: (error as Error).name }, 'job event listener close failed')
    }
  }
}
