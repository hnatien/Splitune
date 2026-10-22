import { ipRateLimit, pub } from '../procedures.ts'

// Product events (16 §2) into analytics_events: a visitor's without a user key, a signed-in user's
// under their salted hash. The contract's AnalyticsEvent union is the whole taxonomy accepted, and
// parsing it dropped every undeclared prop.
export const analytics = {
  track: pub.use(ipRateLimit('events')).analytics.track.handler(async ({ context, input }) => {
    const { deps, session } = context
    await deps.repos.analytics.record(
      session ? deps.analyticsHash(session.userId) : null,
      input.events,
    )
  }),
}
