import { z } from 'zod'
import { Instrument } from '../analysis/common.ts'
import { PaidPlan, Plan } from './plan.ts'

// Entitlement keys of 14-auth-billing-and-entitlements.md §2.
export const EntitlementKey = z.enum([
  'practice.core',
  'analysis.welcome',
  'analysis.full',
  'analysis.lite',
  'analysis.extra_instrument',
  'processing.priority',
  'mic.scoring',
  'midi.wait_mode',
  'offline',
  'export',
  'embed.view',
])

// cap null = no cap for this plan; resets_at null = the allowance never resets.
export const Allowance = z.object({
  used: z.number().int().nonnegative(),
  cap: z.number().int().nonnegative().nullable(),
  resets_at: z.iso.datetime().nullable(),
})

export const Usage = z.object({
  welcome_available: z.boolean(),
  full: Allowance,
  lite: Allowance,
})

export const Subscription = z.object({
  plan: PaidPlan,
  status: z.enum(['active', 'trialing', 'past_due', 'cancelled', 'expired']),
  current_period_end: z.iso.datetime().nullable(),
  cancel_at_period_end: z.boolean(),
})

export const Level = z.enum(['just_started', 'few_songs', 'returning'])
export const Handedness = z.enum(['right', 'left'])

export const Me = z.object({
  id: z.string().min(1),
  email: z.email(),
  display_name: z.string().nullable(),
  primary_instrument: Instrument.nullable(),
  level: Level.nullable(),
  handedness: Handedness,
  training_opt_in: z.boolean(),
  marketing_opt_in: z.boolean(),
  plan: Plan,
  subscription: Subscription.nullable(),
  usage: Usage,
  entitlements: z.array(EntitlementKey),
  flags: z.record(z.string(), z.boolean()),
})

export const UpdateMeInput = z.object({
  display_name: z.string().trim().min(1).max(100).nullable().optional(),
  primary_instrument: Instrument.optional(),
  level: Level.optional(),
  handedness: Handedness.optional(),
  training_opt_in: z.boolean().optional(), // changes are audited
  marketing_opt_in: z.boolean().optional(),
})
