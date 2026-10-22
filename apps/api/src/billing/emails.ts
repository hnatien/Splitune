import type { Mail } from '../mailer.ts'
import type { PaidPlanName } from './provider.ts'

// Billing emails (14 §4.3–4.4, 25 §2): the annual renewal reminder with a direct cancel link, the
// payment-failed notice and the cancellation confirmation. Voice of 27 §5.1; mock payments say so.

const DEMO = 'Demo mode — no real charges.'

const date = (value: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value)

export const price = (minor: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100)

const PLAN_NAME: Record<PaidPlanName, string> = {
  paid_monthly: 'Splitune Plus (monthly)',
  paid_yearly: 'Splitune Plus (yearly)',
}

export function renewalReminder(input: {
  to: string
  plan: PaidPlanName
  renewsAt: Date
  amount: string
  billingUrl: string
}): Mail {
  return {
    to: input.to,
    subject: `Your Splitune Plus renews on ${date(input.renewsAt)}`,
    text: [
      `${PLAN_NAME[input.plan]} renews on ${date(input.renewsAt)} for ${input.amount}.`,
      '',
      'Nothing to do if you want to keep it.',
      `To cancel, open Plan & billing — it takes one tap, and Plus stays active until ${date(input.renewsAt)}:`,
      input.billingUrl,
      '',
      DEMO,
    ].join('\n'),
  }
}

export function paymentFailed(input: { to: string; billingUrl: string }): Mail {
  return {
    to: input.to,
    subject: "Your Splitune Plus payment didn't go through",
    text: [
      "We couldn't take the (simulated) payment for Splitune Plus. Nothing was charged.",
      '',
      'Plus stays active for now. You can check your plan or cancel in Plan & billing:',
      input.billingUrl,
      '',
      DEMO,
    ].join('\n'),
  }
}

export function cancellationConfirmed(input: {
  to: string
  // When Plus ends; undefined = it already has.
  activeUntil: Date | undefined
  billingUrl: string
}): Mail {
  const when = input.activeUntil
  return {
    to: input.to,
    subject: 'Your Splitune Plus is cancelled',
    text: [
      when
        ? `Plus stays active until ${date(when)}. Then you'll be on Free — nothing you've made is removed.`
        : "Your Plus plan has ended and you're on Free now — nothing you've made is removed.",
      '',
      when
        ? 'Changed your mind? Resume Plus in Plan & billing:'
        : 'You can come back to Plus any time in Plan & billing:',
      input.billingUrl,
      '',
      DEMO,
    ].join('\n'),
  }
}
