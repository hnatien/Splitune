import { z } from 'zod'
import { Instrument } from '../analysis/common.ts'
import { PaidPlan } from './billing.ts'
import { ExampleId } from './examples.ts'
import { Level } from './me.ts'

// Product events (16 §2), the personal-mode stand-in for PostHog: rows in analytics_events. Only
// the events built so far; props never carry audio, titles, file names or emails. The typed
// track() wrapper is packages/analytics.

const Ms = z.number().int().nonnegative().max(86_400_000)

export const OnboardingStep = z.enum(['instrument', 'level', 'screen', 'song', 'loop', 'save'])

// Where a learner met the paywall (23 §5: locks only at points of action).
export const PaywallTrigger = z.enum(['cap_lite', 'cap_full', 'lite_song', 'pricing', 'settings'])

export const AnalyticsEvent = z.discriminatedUnion('name', [
  z.object({
    name: z.literal('onboarding_step_viewed'),
    props: z.object({
      step: OnboardingStep,
      instrument: Instrument.nullable(),
      level: Level.nullable(),
    }),
  }),
  z.object({ name: z.literal('example_song_opened'), props: z.object({ example_id: ExampleId }) }),
  z.object({
    name: z.literal('first_isolated_playback'),
    props: z.object({ ms_since_song_selected: Ms, source: z.enum(['example', 'upload']) }),
  }),
  z.object({
    name: z.literal('first_loop_reduced_speed'),
    props: z.object({ ms_since_landing: Ms, tempo_pct: z.number().int().min(25).max(99) }),
  }),
  z.object({ name: z.literal('paywall_viewed'), props: z.object({ trigger: PaywallTrigger }) }),
  z.object({
    name: z.literal('upgrade_clicked'),
    props: z.object({ trigger: PaywallTrigger, plan: PaidPlan }),
  }),
])

// Recorded by the API from billing webhooks, never sent by clients.
export const ServerAnalyticsEvent = z.discriminatedUnion('name', [
  z.object({ name: z.literal('checkout_completed'), props: z.object({ plan: PaidPlan }) }),
  z.object({
    name: z.literal('subscription_cancelled'),
    props: z.object({ tenure_days: z.number().int().nonnegative() }),
  }),
])

export const TrackInput = z.object({ events: z.array(AnalyticsEvent).min(1).max(20) })
