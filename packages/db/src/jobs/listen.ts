import pg from 'pg'
import type { JobRunner } from '../schema/index.ts'
import { channelFor } from './queue.ts'

export interface JobListener {
  close(): Promise<void>
}

// LISTEN jobs_<runner> on a dedicated connection (pooled connections can't hold a LISTEN).
// `onNotify` gets each NOTIFY; `onError` gets a dropped connection, after which the caller
// reconnects and relies on its poll interval meanwhile.
export async function listenForJobs(
  url: string,
  runner: JobRunner,
  onNotify: () => void,
  onError: (error: Error) => void,
): Promise<JobListener> {
  const client = new pg.Client({ connectionString: url, application_name: `${runner}-listener` })
  client.on('notification', () => onNotify())
  client.on('error', onError)
  await client.connect()
  await client.query(`LISTEN ${channelFor(runner)}`)
  return {
    close: async () => {
      client.removeAllListeners('error')
      client.on('error', () => {})
      await client.end()
    },
  }
}
