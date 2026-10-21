import { type JobEvent, JobEvent as JobEventSchema } from '@splitune/contracts'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { z } from 'zod'
import { orpc } from '@/lib/api'
import type { StageFailure } from '@/lib/reasons'

type Event = z.infer<typeof JobEvent>

export type AnalysisLiveState = {
  /** A runner whose worker is offline while jobs wait for it (25 §5). */
  waitingFor: 'python' | 'node' | undefined
  failures: StageFailure[]
  /** The last stage change, for a polite live-region announcement (26 §13). */
  lastEvent: Event | undefined
}

/**
 * Follows GET /v1/analyses/{id}/events (04 SSE) and keeps the Query cache current: each stage
 * change refetches the analysis, `analysis.done` also refreshes the song and the library.
 * EventSource resumes with Last-Event-ID by itself after a dropped connection.
 */
export function useAnalysisEvents(
  analysisId: string | undefined,
  songId: string,
): AnalysisLiveState {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AnalysisLiveState>({
    waitingFor: undefined,
    failures: [],
    lastEvent: undefined,
  })

  useEffect(() => {
    if (!analysisId || typeof EventSource === 'undefined') return
    const analysisKey = orpc.analyses.get.queryKey({ input: { id: analysisId } })
    const source = new EventSource(`/v1/analyses/${analysisId}/events`, { withCredentials: true })
    source.onmessage = (message) => {
      let parsed: Event
      try {
        const result = JobEventSchema.safeParse(JSON.parse(message.data))
        if (!result.success) return // a newer event type: the refetch below still catches up
        parsed = result.data
      } catch {
        return
      }
      if (parsed.type === 'progress') return
      setState((previous) => ({
        waitingFor:
          parsed.type === 'analysis.waiting'
            ? parsed.runner
            : parsed.type === 'stage.started'
              ? undefined
              : previous.waitingFor,
        failures:
          parsed.type === 'stage.failed'
            ? [
                ...previous.failures.filter((f) => f.stage !== parsed.stage),
                {
                  stage: parsed.stage,
                  errorCode: parsed.error_code,
                  ...(parsed.fallback ? { fallback: parsed.fallback } : {}),
                },
              ]
            : previous.failures,
        lastEvent: parsed,
      }))
      void queryClient.invalidateQueries({ queryKey: analysisKey })
      if (parsed.type === 'analysis.done') {
        source.close()
        void queryClient.invalidateQueries({
          queryKey: orpc.songs.get.queryKey({ input: { id: songId } }),
        })
        void queryClient.invalidateQueries({ queryKey: orpc.songs.list.key() })
      }
    }
    return () => source.close()
  }, [analysisId, songId, queryClient])

  return state
}
