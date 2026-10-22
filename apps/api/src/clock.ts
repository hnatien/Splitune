// "Now" for billing logic: renewals, expiry, renewal reminders and allowance resets (25 §2). The
// dev clock (POST /internal/dev/clock, ENABLE_DEV_CLOCK) moves it forward for this process only;
// a restart returns to real time.
export interface Clock {
  now(): Date
  advance(days: number): Date
}

const DAY_MS = 86_400_000

export function createClock(): Clock {
  let offsetMs = 0
  return {
    now: () => new Date(Date.now() + offsetMs),
    advance(days) {
      offsetMs += days * DAY_MS
      return new Date(Date.now() + offsetMs)
    },
  }
}
