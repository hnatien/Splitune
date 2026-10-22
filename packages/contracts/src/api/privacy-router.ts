import { z } from 'zod'
import { TrackInput } from './analytics.ts'
import { DataExportState, DeleteMeOutput } from './privacy.ts'
import { procedureBase as base } from './router.ts'

// Privacy self-service (15 §4) and product events (16 §2) in contracts of their own, like billing:
// only Settings → Privacy loads the privacy client, and the browser posts events with a plain
// fetch, so no other screen (practice, 10 §9 budget) carries these schemas or the event taxonomy.
export const privacyContract = {
  me: {
    export: base
      .route({ method: 'POST', path: '/v1/me/export', successStatus: 202 })
      .output(DataExportState),
    exportState: base.route({ method: 'GET', path: '/v1/me/export' }).output(DataExportState),
    delete: base
      .route({ method: 'DELETE', path: '/v1/me', successStatus: 202 })
      .output(DeleteMeOutput),
  },
}

// Product events, from visitors and signed-in users alike.
export const eventsContract = {
  analytics: {
    track: base
      .route({ method: 'POST', path: '/v1/events', successStatus: 204 })
      .input(TrackInput)
      .output(z.void()),
  },
}

export type PrivacyContract = typeof privacyContract
