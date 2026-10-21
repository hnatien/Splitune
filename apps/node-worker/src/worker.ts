import { queue } from '@splitune/db'
import type { WorkerConfig } from './config.ts'
import { errorName, executeJob, type Services } from './execute.ts'

// One slot claiming `finalize` and `delete_prefix` jobs (runner `node`): sleeps until NOTIFY
// jobs_node or the poll interval, heartbeats its job, writes worker_heartbeats every 30 s and
// re-queues stale jobs of crashed workers. stop() finishes the running job before resolving.

export const KINDS = ['finalize', 'delete_prefix']
export const WORKER_VERSION = '0.0.0'

export class NodeWorker {
  private stopping = false
  private wake: (() => void) | undefined
  private listener: queue.JobListener | undefined
  private housekeeping: NodeJS.Timeout | undefined
  private reconnect: NodeJS.Timeout | undefined
  private loop: Promise<void> | undefined

  private readonly services: Services
  private readonly config: WorkerConfig
  private readonly hostname: string

  constructor(services: Services, config: WorkerConfig, hostname: string) {
    this.services = services
    this.config = config
    this.hostname = hostname
  }

  async start(): Promise<void> {
    await this.writePresence(true)
    await this.listen()
    this.housekeeping = setInterval(() => void this.tick(), this.config.workerHeartbeatMs)
    this.loop = this.run()
  }

  async stop(): Promise<void> {
    this.stopping = true
    this.wake?.()
    clearInterval(this.housekeeping)
    clearTimeout(this.reconnect)
    await this.loop
    await this.listener?.close()
  }

  private async run(): Promise<void> {
    const { db, log, workerId } = this.services
    while (!this.stopping) {
      let job: queue.Job | undefined
      try {
        job = await queue.claim(db, 'node', workerId, { kinds: KINDS })
      } catch (error) {
        log.warn('claim failed', { error_code: errorName(error) })
      }
      if (job !== undefined) {
        await executeJob(this.services, job)
        continue
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, this.config.pollIntervalMs)
        this.wake = () => {
          clearTimeout(timer)
          resolve()
        }
      })
      this.wake = undefined
    }
  }

  private async listen(): Promise<void> {
    try {
      this.listener = await queue.listenForJobs(
        this.config.databaseUrl,
        'node',
        () => this.wake?.(),
        (error) => {
          this.services.log.warn('listener lost', { error_code: errorName(error) })
          this.listener = undefined
          this.scheduleReconnect()
        },
      )
    } catch (error) {
      this.services.log.warn('listen failed', { error_code: errorName(error) })
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.stopping) return
    clearTimeout(this.reconnect)
    this.reconnect = setTimeout(() => void this.listen(), this.config.pollIntervalMs)
  }

  private async writePresence(first: boolean): Promise<void> {
    await queue.writeWorkerHeartbeat(
      this.services.db,
      {
        workerId: this.services.workerId,
        runner: 'node',
        hostname: this.hostname,
        version: WORKER_VERSION,
      },
      { first },
    )
  }

  private async tick(): Promise<void> {
    try {
      await this.writePresence(false)
      const { requeued, failed } = await queue.requeueStale(this.services.db, {
        staleAfterSeconds: this.config.staleAfterS,
      })
      if (requeued.length > 0 || failed.length > 0) {
        this.services.log.info('stale jobs swept', { requeued, failed })
      }
    } catch (error) {
      this.services.log.warn('housekeeping failed', { error_code: errorName(error) })
    }
  }
}
