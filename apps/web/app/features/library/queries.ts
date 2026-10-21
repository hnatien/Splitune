import type { LibrarySort, LibraryStatusFilter } from '@splitune/contracts'
import { infiniteQueryOptions } from '@tanstack/react-query'
import type { z } from 'zod'
import { client, orpc } from '@/lib/api'
import type { InstrumentName } from '@/lib/instruments'

export type LibraryFilters = {
  q?: string | undefined
  instrument?: InstrumentName | undefined
  status?: z.infer<typeof LibraryStatusFilter> | undefined
  sort?: z.infer<typeof LibrarySort> | undefined
}

const PAGE = 24

export function libraryQuery(filters: LibraryFilters) {
  const input = Object.fromEntries(
    Object.entries({ ...filters, limit: PAGE }).filter(([, value]) => value !== undefined),
  ) as Parameters<typeof client.songs.list>[0]
  return infiniteQueryOptions({
    queryKey: [...orpc.songs.list.key(), input],
    queryFn: ({ pageParam, signal }) =>
      client.songs.list({ ...input, ...(pageParam ? { cursor: pageParam } : {}) }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  })
}

export const statsQuery = orpc.system.stats.queryOptions({ staleTime: 5 * 60_000 })

export const workerStatusQuery = orpc.system.workerStatus.queryOptions({ refetchInterval: 30_000 })
