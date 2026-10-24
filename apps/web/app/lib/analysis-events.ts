import { type JobEvent, JobEvent as JobEventSchema } from '@splitune/contracts'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { z } from 'zod'
import { answeredLocally, orpc } from '@/lib/api'
import type { StageFailure } from '@/lib/reasons'

type Event = z.infer<typeof JobEvent>

export type AnalysisLiveState = {
  /** A runner whose worker is offline while jobs wait for it (25 §5). */
  waitingFor: 'python' | 'node' | undefined
  failures: StageFailure[]
  /** The last stage change, for a polite live-region announcement (26 §13). */
  lastEvent: Event | undefined
}

/** Live state of the analysis it was collected for, so a re-run starts without the old run's. */
export type ScopedLiveState = { analysisId: string | undefined; live: AnalysisLiveState }

const IDLE: AnalysisLiveState = { waitingFor: undefined, failures: [], lastEvent: undefined }

export function liveStateOf(
  scoped: ScopedLiveState,
  analysisId: string | undefined,
): AnalysisLiveState {
  return scoped.analysisId === analysisId ? scoped.live : IDLE
}

export function applyEvent(
  scoped: ScopedLiveState,
  analysisId: string,
  event: Event,
): ScopedLiveState {
  const previous = liveStateOf(scoped, analysisId)
  return {
    analysisId,
    live: {
      waitingFor:
        event.type === 'analysis.waiting'
          ? event.runner
          : event.type === 'stage.started'
            ? undefined
            : previous.waitingFor,
      failures:
        event.type === 'stage.failed'
          ? [
              ...previous.failures.filter((f) => f.stage !== event.stage),
              {
                stage: event.stage,
                errorCode: event.error_code,
                ...(event.fallback ? { fallback: event.fallback } : {}),
              },
            ]
          : previous.failures,
      lastEvent: event,
    },
  }
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
  const [state, setState] = useState<ScopedLiveState>({ analysisId: undefined, live: IDLE })

  useEffect(() => {
    if (!analysisId || typeof EventSource === 'undefined') return
    // An example song's finished analysis on a visitor's device has no stream.
    if (answeredLocally(['analyses', 'events'], { id: analysisId })) return
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
      setState((previous) => applyEvent(previous, analysisId, parsed))
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

  return liveStateOf(state, analysisId)
}
