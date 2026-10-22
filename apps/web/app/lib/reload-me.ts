import type { QueryClient } from '@tanstack/react-query'
import { meQuery } from '@/lib/session'

/**
 * Fetches the account again now (a new analysis used an allowance, the plan changed). Route
 * context reads it on the next navigation or `router.invalidate()`. A failed fetch (offline) keeps
 * the cached account: the allowance shown is then the previous one until the next load.
 */
export async function reloadMe(queryClient: QueryClient): Promise<void> {
  try {
    await queryClient.fetchQuery({ ...meQuery, staleTime: 0 })
  } catch {
    // Nothing to do: see above.
  }
}
