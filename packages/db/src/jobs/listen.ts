import pg from 'pg'
import type { JobRunner } from '../schema/index.ts'
import { channelFor } from './queue.ts'

export interface JobListener {
  close(): Promise<void>
}

// Channel of the job_events trigger (migration 0006); the payload is the event's analysis id.
export const JOB_EVENTS_CHANNEL = 'job_events'

// LISTEN on a dedicated connection (pooled connections can't hold a LISTEN). `onNotify` gets each
// NOTIFY's payload; `onError` gets a dropped connection, after which the caller reconnects and
// relies on its poll interval meanwhile.
async function listenOn(
  url: string,
  channel: string,
  applicationName: string,
  onNotify: (payload: string) => void,
  onError: (error: Error) => void,
): Promise<JobListener> {
  const client = new pg.Client({ connectionString: url, application_name: applicationName })
  client.on('notification', (message) => onNotify(message.payload ?? ''))
  client.on('error', onError)
  await client.connect()
  await client.query(`LISTEN ${channel}`)
  return {
    close: async () => {
      client.removeAllListeners('error')
      client.on('error', () => {})
      await client.end()
    },
  }
}

// Workers: wake up on NOTIFY jobs_<runner>.
export function listenForJobs(
  url: string,
  runner: JobRunner,
  onNotify: () => void,
  onError: (error: Error) => void,
): Promise<JobListener> {
  return listenOn(url, channelFor(runner), `${runner}-listener`, () => onNotify(), onError)
}

// API SSE streams: wake up when an event of `analysisId` was written.
export function listenForJobEvents(
  url: string,
  onEvent: (analysisId: string) => void,
  onError: (error: Error) => void,
): Promise<JobListener> {
  return listenOn(url, JOB_EVENTS_CHANNEL, 'api-events-listener', onEvent, onError)
}
