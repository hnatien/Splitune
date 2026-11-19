import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { orpc } from '@/lib/api'
import { onPracticeChange, pendingPractice } from './model/practice-sync'
import { PROGRESS_DAYS, type Progress, withPending } from './model/progress-metrics'

// Progress data (s39) for the Progress tab and the library's strips: GET /v1/progress for the last
// 31 days of every song (one cache entry both screens share; the service worker keeps the last
// answer for offline use, like the library's), plus the passes this device hasn't sent yet. A
// new pass refreshes the outbox part at once and the server part once it has been sent; a view
// that mounts asks again.

export const progressQuery = orpc.practice.progress.queryOptions({
  input: { days: PROGRESS_DAYS },
})

const OUTBOX_KEY = ['practice-outbox'] as const
const EMPTY: Progress = { clips: [], sessions: [] }

export function useProgressData({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient()
  // Both refetch whenever a view mounts: passes made while no progress view was open (the tab
  // closed, the library behind a dialog) never reach a listener.
  const server = useQuery({ ...progressQuery, enabled, refetchOnMount: 'always' })
  const pending = useQuery({
    queryKey: OUTBOX_KEY,
    queryFn: pendingPractice,
    staleTime: Infinity,
    refetchOnMount: 'always',
  })
  useEffect(
    () =>
      onPracticeChange((sent) => {
        void queryClient.invalidateQueries({ queryKey: OUTBOX_KEY })
        if (sent) void queryClient.invalidateQueries({ queryKey: progressQuery.queryKey })
      }),
    [queryClient],
  )
  const data = withPending(server.data ?? EMPTY, pending.data ?? { sessions: [], attempts: [] })
  return {
    data,
    /** Nothing to show yet: the first answer is on its way. */
    loading: enabled ? server.isPending : pending.isPending,
    failed: enabled && server.isError && data.sessions.length === 0,
    refetch: () => server.refetch(),
  }
}
