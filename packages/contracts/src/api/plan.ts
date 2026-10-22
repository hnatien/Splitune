import { z } from 'zod'

// The plans (23-plans-free-and-paid.md). Apart from the billing schemas (billing.ts) because every
// screen reads the plan (`Me`), while only billing pages need those (10 §9 bundle budget).
export const PaidPlan = z.enum(['paid_monthly', 'paid_yearly'])
export const Plan = z.enum(['free', ...PaidPlan.options])
