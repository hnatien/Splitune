import { createHmac } from 'node:crypto'

// Pseudonymous user key of analytics_events (16 §6), shared by the API and the node worker so both
// write the same hash for a user: HMAC-SHA-256 of the user id under ANALYTICS_SALT, truncated. The
// salt never leaves the servers, so a hash can't be turned back into an id or joined with other
// data without it; account deletion recomputes it to remove the user's events.
export const MIN_SALT_LENGTH = 16

export function userHasher(salt: string): (userId: string) => string {
  if (salt.length < MIN_SALT_LENGTH) {
    throw new Error(`ANALYTICS_SALT must be at least ${MIN_SALT_LENGTH} characters`)
  }
  const key = createHmac('sha256', salt).update('splitune.analytics.user_hash').digest()
  return (userId) => createHmac('sha256', key).update(userId).digest('hex').slice(0, 32)
}
