import { ipRateLimit, pub } from '../procedures.ts'

// Product events (16 §2) into analytics_events: a visitor's without a user, a signed-in user's
// with theirs. The contract's AnalyticsEvent union is the whole taxonomy accepted.
export const analytics = {
  track: pub.use(ipRateLimit('events')).analytics.track.handler(async ({ context, input }) => {
    await context.deps.repos.analytics.record(context.session?.userId ?? null, input.events)
  }),
}
