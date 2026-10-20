import { sql } from 'drizzle-orm'
import type { Database } from './client.ts'

export interface RateLimitResult {
  allowed: boolean
  // Requests counted in the current window, including this one.
  count: number
  // Seconds until the window resets (0 when allowed and the window just started).
  retryAfterS: number
}

// Counts one request against `key` in a fixed window of `windowS` seconds and reports whether it
// is within `limit` (17-security.md §5: Postgres-backed, no Redis). One atomic upsert, so
// concurrent requests on several connections or instances are counted exactly; the window starts
// with the first request after the previous one expired. Not user data: runs as the table owner.
export async function hitRateLimit(
  db: Database,
  key: string,
  limit: number,
  windowS: number,
): Promise<RateLimitResult> {
  const result = await db.execute(sql`
    insert into rate_limits as r (key, window_start, count)
    values (${key}, now(), 1)
    on conflict (key) do update set
      window_start = case when r.window_start <= now() - make_interval(secs => ${windowS})
                          then now() else r.window_start end,
      count = case when r.window_start <= now() - make_interval(secs => ${windowS})
                   then 1 else r.count + 1 end
    returning count,
      ceil(extract(epoch from (window_start + make_interval(secs => ${windowS}) - now())))::int
        as retry_after_s
  `)
  const row = result.rows[0] as { count: number; retry_after_s: number }
  const allowed = row.count <= limit
  return { allowed, count: row.count, retryAfterS: allowed ? 0 : Math.max(1, row.retry_after_s) }
}
