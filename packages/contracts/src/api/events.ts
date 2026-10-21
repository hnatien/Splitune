import { z } from 'zod'
import { ArtefactKind, MachineCode } from '../analysis/common.ts'
import { StageName } from '../analysis/stage.ts'
import { contracts } from '../registry.ts'

// SSE events of GET /v1/analyses/{id}/events, stored in `job_events.event`. URLs are never
// embedded, so replays never hand out stale signatures; the client fetches them on stage.completed.

export const StageStartedEvent = z
  .object({ type: z.literal('stage.started'), stage: StageName, at: z.iso.datetime() })
  .register(contracts, { id: 'StageStartedEvent' })

export const ArtefactRef = z
  .object({ id: z.uuid(), kind: ArtefactKind, version: z.number().int().positive() })
  .register(contracts, { id: 'ArtefactRef' })

export const StageCompletedEvent = z
  .object({
    type: z.literal('stage.completed'),
    stage: StageName,
    artefact: ArtefactRef.optional(),
    at: z.iso.datetime(),
  })
  .register(contracts, { id: 'StageCompletedEvent' })

export const StageFailedEvent = z
  .object({
    type: z.literal('stage.failed'),
    stage: StageName,
    error_code: MachineCode,
    // What the analysis does instead (06 §6), e.g. stems_unavailable when separation failed; absent
    // when the stage is critical (the analysis then ends failed).
    fallback: MachineCode.optional(),
    at: z.iso.datetime(),
  })
  .register(contracts, { id: 'StageFailedEvent' })

export const ProgressEvent = z
  .object({ type: z.literal('progress'), value: z.number().min(0).max(1) })
  .register(contracts, { id: 'ProgressEvent' })

export const AnalysisDoneEvent = z
  .object({
    type: z.literal('analysis.done'),
    status: z.enum(['done', 'partial', 'failed']),
    summary_artefact_id: z.uuid().optional(),
  })
  .register(contracts, { id: 'AnalysisDoneEvent' })

// Runnable jobs of the analysis are waiting for a Mac worker that has no fresh heartbeat (25 §5);
// processing resumes on its own when the worker comes back (the next stage.started).
export const AnalysisWaitingEvent = z
  .object({
    type: z.literal('analysis.waiting'),
    reason: z.literal('queued_waiting_for_worker'),
    runner: z.enum(['python', 'node']),
    at: z.iso.datetime(),
  })
  .register(contracts, { id: 'AnalysisWaitingEvent' })

export const JobEvent = z
  .discriminatedUnion('type', [
    StageStartedEvent,
    StageCompletedEvent,
    StageFailedEvent,
    ProgressEvent,
    AnalysisWaitingEvent,
    AnalysisDoneEvent,
  ])
  .register(contracts, { id: 'JobEvent' })
