import { randomUUID } from 'node:crypto'
import { withEventMeta } from '@orpc/server'
import {
  type Analysis as AnalysisSchema,
  type ArtefactIndexEntry,
  type JobEvent,
  StageName,
  type StageState,
} from '@splitune/contracts'
import type { Analysis, Artefact, ReusableStages, SongSource, stageRuns } from '@splitune/db'
import type { z } from 'zod'
import { admitAnalysis, reserving } from '../admission.ts'
import { apiError } from '../errors.ts'
import { analysisKey, CONFIG_PROFILE, planAnalysis } from '../pipeline.ts'
import { type ApiDeps, authed, userRateLimit } from '../procedures.ts'

type StageRun = typeof stageRuns.$inferSelect
type Detail = NonNullable<Awaited<ReturnType<ApiDeps['repos']['analyses']['detail']>>>
type State = z.infer<typeof StageState>

// Stream tuning (04 SSE): replay pages, a poll in case a NOTIFY is missed, and the 15 s cadence
// of keep-alive comments (OpenAPIHandler option) and "waiting for the Mac" checks.
const EVENT_PAGE = 200
const POLL_MS = 5_000
export const HEARTBEAT_MS = 15_000
// Stages reused from a base analysis (Lite → Full upgrade) and the artefacts they wrote.
const REUSED_STAGES = new Set(['decode', 'beats'])
const REUSED_KINDS = new Set(['probe', 'beats'])
const TERMINAL = new Set(['done', 'partial', 'failed', 'cancelled'])

const iso = (date: Date | null) => (date ? date.toISOString() : null)

function stateOfRun(run: StageRun): State {
  return {
    status: run.status,
    ...(run.startedAt ? { started_at: run.startedAt.toISOString() } : {}),
    ...(run.finishedAt ? { finished_at: run.finishedAt.toISOString() } : {}),
    ...(run.errorCode ? { error_code: run.errorCode } : {}),
  }
}

// A stage that never started has only its job: waiting, cancelled because a dependency failed,
// or failed before the worker could record a stage run (e.g. an invalid request).
function stateOfJob(job: Detail['jobs'][number]): State {
  const status = { queued: 'pending', running: 'running', done: 'done', failed: 'failed' } as const
  return {
    status: job.status === 'cancelled' ? 'skipped' : status[job.status],
    ...(job.errorCode ? { error_code: job.errorCode } : {}),
  }
}

function toArtefact(row: Artefact): z.infer<typeof ArtefactIndexEntry> {
  return {
    id: row.id,
    kind: row.kind,
    version: row.version,
    bytes: row.bytes,
    sha256: row.sha256,
    created_at: row.createdAt.toISOString(),
    purged_at: row.purgedAt ? row.purgedAt.toISOString() : null,
  }
}

// The analysis' own artefacts plus the decode/beats ones it reuses from its base analysis.
export function artefactIndex(detail: Detail): z.infer<typeof ArtefactIndexEntry>[] {
  const own = detail.artefacts.map(toArtefact)
  const kinds = new Set(own.map((a) => a.kind))
  const reused = (detail.base?.artefacts ?? [])
    .filter((a) => REUSED_KINDS.has(a.kind) && !kinds.has(a.kind))
    .map(toArtefact)
  return [...reused, ...own]
}

export function toAnalysis(detail: Detail): z.infer<typeof AnalysisSchema> {
  const { analysis } = detail
  const runs = new Map(detail.stages.map((run) => [run.stage, run]))
  const stages: Record<string, State> = {}
  for (const run of detail.base?.stages ?? []) {
    if (REUSED_STAGES.has(run.stage)) stages[run.stage] = stateOfRun(run)
  }
  for (const job of detail.jobs) {
    if (!StageName.safeParse(job.kind).success) continue
    const run = runs.get(job.kind as StageRun['stage'])
    stages[job.kind] = run ? stateOfRun(run) : stateOfJob(job)
  }
  return {
    id: analysis.id,
    song_id: analysis.songId,
    version: analysis.version,
    type: analysis.analysisType,
    requested_instrument: analysis.requestedInstrument,
    status: analysis.status,
    progress: analysis.progress,
    pipeline_version: analysis.pipelineVersion,
    stages,
    artefacts: artefactIndex(detail),
    created_at: analysis.createdAt.toISOString(),
    finished_at: iso(analysis.finishedAt),
  }
}

interface StartOptions {
  songId: string
  instrument: Analysis['requestedInstrument']
  type: 'full' | 'lite'
  idempotencyKey: (source: Exclude<SongSource, { kind: 'url_pending' }> | undefined) => string
  baseAnalysisId?: string
  reuse?: ReusableStages | undefined
  // false: a re-run after a Splitune model upgrade, which never uses an allowance (23 §2).
  charged?: boolean
}

// A URL song without a finished download gets a fresh url_import ahead of its graph.
const DOWNLOAD_VIDEO_DEFAULT = true

async function start(deps: ApiDeps, userId: string, options: StartOptions) {
  const found = await deps.repos.analyses.source(userId, options.songId)
  if (!found) throw apiError('not_found')
  const { source } = found
  if (source === undefined) {
    throw apiError('conflict', {
      message: 'The song has no uploaded audio yet.',
      details: { reason: 'source_not_ready' },
    })
  }
  const drums = await deps.flags.flag('v1.drums')
  const admission = await admitAnalysis(deps, userId, options.type, {
    charged: options.charged ?? true,
  })
  const ready = source.kind === 'url_pending' ? undefined : source
  const reuse = ready === undefined ? undefined : options.reuse
  const created = await reserving(admission, () =>
    deps.repos.analyses.create(
      userId,
      options.songId,
      {
        pipelineVersion: deps.config.pipelineVersion,
        configProfile: CONFIG_PROFILE,
        requestedInstrument: options.instrument,
        analysisType: admission.kind,
        idempotencyKey: options.idempotencyKey(ready),
        ...(options.baseAnalysisId === undefined && reuse === undefined
          ? {}
          : { baseAnalysisId: options.baseAnalysisId ?? reuse?.analysisId }),
      },
      (analysis) =>
        planAnalysis({
          userId,
          analysis,
          type: options.type,
          source:
            ready === undefined
              ? { download: { importId: randomUUID(), video: DOWNLOAD_VIDEO_DEFAULT } }
              : { rawKey: ready.rawKey },
          reuse,
          priority: admission.priority,
          drums,
        }),
      admission.charge,
    ),
  )
  if (!created) throw apiError('not_found')
  if (created.created) {
    await recordRequested(deps, userId, {
      type: admission.kind,
      instrument: options.instrument,
      source: source.kind === 'upload' ? 'file' : 'link',
    })
  }
  return { analysis_id: created.analysis.id, status: created.analysis.status }
}

// analysis_requested (16 §2), once per new run. Best effort: the run exists either way.
export async function recordRequested(
  deps: ApiDeps,
  userId: string,
  props: {
    type: Analysis['analysisType']
    instrument: Analysis['requestedInstrument']
    source: 'file' | 'link'
  },
): Promise<void> {
  try {
    await deps.repos.analytics.record(deps.analyticsHash(userId), [
      { name: 'analysis_requested', props },
    ])
  } catch {
    // Analytics never fails a request (16 §6).
  }
}

const analysesLimited = authed.use(userRateLimit('analyses'))

export const analyses = {
  create: analysesLimited.analyses.create.handler(async ({ context, input }) => {
    const { deps, userId } = context
    // Idempotent per source, instrument, type and pipeline (03 "Keys"; audio_hash is unknown
    // before decode, so the upload or download stands in for it). A failed run is retried with
    // POST /v1/analyses/{id}/rerun.
    const reuse = await deps.repos.analyses.reusableStages(userId, input.song_id)
    return start(deps, userId, {
      songId: input.song_id,
      instrument: input.instrument,
      type: input.type,
      reuse,
      idempotencyKey: (source) =>
        analysisKey([
          userId,
          source ? `${source.kind}:${source.id}` : `song:${input.song_id}`,
          input.instrument,
          input.type,
          deps.config.pipelineVersion,
          CONFIG_PROFILE,
        ]),
    })
  }),

  get: authed.analyses.get.handler(async ({ context, input }) => {
    const detail = await context.deps.repos.analyses.detail(context.userId, input.id)
    if (!detail) throw apiError('not_found')
    return toAnalysis(detail)
  }),

  // Re-analyses with the current pipeline as the song's next version; the old version's
  // artefacts stay. Repeats with the same Idempotency-Key return the same run. A re-run the
  // learner asks for uses an allowance; one after a Splitune model upgrade (a new pipeline
  // version) or of a run whose stems the sweeper removed doesn't, and is never refused.
  rerun: analysesLimited.analyses.rerun.handler(async ({ context, input }) => {
    const { deps, userId } = context
    const detail = await deps.repos.analyses.detail(userId, input.id)
    if (!detail) throw apiError('not_found')
    const previous = detail.analysis
    // "Re-create stems" after the sweeper removed them (15 §3) is free too: nothing the learner did.
    const stemsPurged = detail.artefacts.some((a) => a.kind === 'stems' && a.purgedAt !== null)
    const request = context.idempotencyKey ?? randomUUID()
    return start(deps, userId, {
      songId: previous.songId,
      instrument: previous.requestedInstrument,
      type: previous.analysisType === 'lite' ? 'lite' : 'full',
      charged: previous.pipelineVersion === deps.config.pipelineVersion && !stemsPurged,
      idempotencyKey: () => analysisKey([userId, 'rerun', previous.id, request]),
    })
  }),

  // SSE (04 "SSE event shapes"): replays the analysis' events after Last-Event-ID, then streams
  // new ones as NOTIFY job_events (or the poll) reports them, until `analysis.done`.
  events: authed.analyses.events.handler(async ({ context, input, lastEventId, signal }) => {
    const { deps, userId } = context
    const parsed = Number.parseInt(lastEventId ?? '0', 10)
    const after = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0
    // Ownership is checked before the stream starts, so a stranger gets a plain 404.
    const page = await deps.repos.analyses.events(userId, input.id, after, EVENT_PAGE)
    if (!page) throw apiError('not_found')
    return streamEvents(deps, userId, input.id, after, page, signal)
  }),
}

type EventPage = NonNullable<Awaited<ReturnType<ApiDeps['repos']['analyses']['events']>>>

async function* streamEvents(
  deps: ApiDeps,
  userId: string,
  analysisId: string,
  start: number,
  first: EventPage,
  signal: AbortSignal | undefined,
) {
  let after = start
  let page: EventPage | undefined = first
  let wake: (() => void) | undefined
  let woken = false
  const unsubscribe = deps.events.subscribe(analysisId, () => {
    woken = true
    wake?.()
  })
  let checkedWaiting = 0
  try {
    while (page) {
      for (const row of page.rows) {
        after = row.id
        const event = row.event as z.infer<typeof JobEvent>
        yield withEventMeta(event, { id: String(row.id) })
        if (event.type === 'analysis.done') return
      }
      if (page.rows.length < EVENT_PAGE) {
        // Ended without analysis.done (e.g. cancelled): nothing more will come.
        if (TERMINAL.has(page.status)) return
        if (Date.now() - checkedWaiting >= HEARTBEAT_MS) {
          checkedWaiting = Date.now()
          await deps.repos.analyses.noteWaiting(userId, analysisId)
        }
        if (!woken) {
          await new Promise<void>((resolve) => {
            const done = () => {
              clearTimeout(timer)
              signal?.removeEventListener('abort', done)
              resolve()
            }
            const timer = setTimeout(done, POLL_MS)
            wake = done
            signal?.addEventListener('abort', done, { once: true })
          })
          wake = undefined
        }
        woken = false
        if (signal?.aborted) return
      }
      // Undefined once the analysis is gone (its song was deleted): the stream ends.
      page = await deps.repos.analyses.events(userId, analysisId, after, EVENT_PAGE)
    }
  } finally {
    unsubscribe()
  }
}
