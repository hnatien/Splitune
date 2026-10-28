import { createHash } from 'node:crypto'
import {
  assertCompatible,
  Beats,
  Chords,
  DrumNotes,
  Instrument,
  Notes,
  StageRequest,
  Stems,
  Summary,
  Tab,
} from '@splitune/contracts'
import { type Database, queue } from '@splitune/db'

type Job = queue.Job

import {
  analysisPrefix,
  assertSafeKey,
  type Storage,
  StorageKeyError,
  userPrefix,
} from '@splitune/storage'
import { z } from 'zod'
import { type FinalizeInputs, finalize } from './finalize.ts'
import type { Logger } from './log.ts'
import {
  DELETE_ACCOUNT_KIND,
  deleteAccount,
  EXPORT_KIND,
  exportUserData,
  PrivacyJobError,
  type PrivacyServices,
} from './privacy.ts'
import type { ViewsConfig } from './views.ts'

// Runs one claimed job. finalize: validate → stage.started → read artefacts → finalize → write
// tab/render/summary → one transaction that records the result, ends the analysis and completes
// the job (packages/db `finishStage`); same request rules as the Python executor; then the
// analysis' product events (16 §2). delete_prefix: remove a deleted song's objects (03 "Retention
// and deletion"). export_user_data / delete_account: privacy self-service (privacy.ts).

export interface Services {
  db: Database
  storage: Storage
  views: ViewsConfig
  workerId: string
  log: Logger
  jobHeartbeatMs: number
  // Pseudonymous user hash for analytics events; none = no events recorded.
  hashUser?: (userId: string) => string
  // Privacy jobs need the maintenance login (worker.ts claims them only then).
  privacy?: PrivacyServices
}

export class StageError extends Error {
  readonly code: string
  readonly retry: boolean

  constructor(code: string, retry: boolean) {
    super(code)
    this.code = code
    this.retry = retry
  }
}

const MAX_JSON_BYTES = 64 * 1024 * 1024
const TAB_INSTRUMENTS = new Set(['guitar', 'bass'])

const FinalizeParams = z.object({
  instruments: z.array(Instrument).min(1),
  fingering_mode: z.enum(['easiest', 'as_played']).optional(),
  // lite (23 §2): beats and chords only, so missing stems and notes are expected, not partial.
  profile: z.enum(['full', 'lite']).optional(),
})

// Payload the API writes when a song is deleted (RLS policy jobs_owner_cleanup checks it).
const CleanupPayload = z.object({
  user_id: z.string().min(1),
  prefixes: z.array(z.string().min(1)).min(1),
})

// No beats: a critical stage (url_import, decode or beats) failed and the queue cancelled what
// depended on it. Its own stage.failed already says why; finalize ends the analysis `failed`.
class NothingToFinalize extends Error {}

type Request = z.infer<typeof StageRequest>
type Params = z.infer<typeof FinalizeParams>

function parseRequest(job: Job): { request: Request; params: Params } {
  const request = StageRequest.safeParse(job.payload)
  if (!request.success) throw new StageError('invalid_request', false)
  const params = FinalizeParams.safeParse(request.data.params)
  if (
    !params.success ||
    request.data.stage !== 'finalize' ||
    job.kind !== 'finalize' ||
    request.data.analysis_id !== job.analysisId
  ) {
    throw new StageError('invalid_request', false)
  }
  return { request: request.data, params: params.data }
}

// Inputs: beats (required), chords, stems and notes.<instrument> (each optional: a missing one
// means that stage failed or was skipped). Outputs: summary plus tab/render per fretted
// instrument. Inputs stay inside the user's prefix, outputs inside the analysis' prefix.
function checkRequest(request: Request, params: Params, analysis: queue.AnalysisRef): void {
  if (request.user_id !== analysis.userId) throw new StageError('invalid_request', false)
  const allowedInputs = new Set([
    'beats',
    'chords',
    'stems',
    ...params.instruments.map((i) => `notes.${i}`),
  ])
  const expectedOutputs = new Set([
    'summary',
    ...params.instruments
      .filter((i) => TAB_INSTRUMENTS.has(i))
      .flatMap((i) => [`tab.${i}`, `render.${i}`]),
  ])
  const outputs = Object.keys(request.outputs)
  if (
    !('beats' in request.inputs) ||
    !Object.keys(request.inputs).every((name) => allowedInputs.has(name)) ||
    outputs.length !== expectedOutputs.size ||
    !outputs.every((name) => expectedOutputs.has(name))
  ) {
    throw new StageError('invalid_request', false)
  }
  const own = userPrefix(analysis.userId)
  const out = analysisPrefix(analysis.userId, analysis.id)
  const safe = (key: string, prefix: string) => {
    try {
      return assertSafeKey(key) === key && key.startsWith(prefix)
    } catch {
      return false
    }
  }
  if (
    !Object.values(request.inputs).every((k) => safe(k, own)) ||
    !Object.values(request.outputs).every((k) => safe(k, out))
  ) {
    throw new StageError('invalid_request', false)
  }
}

async function readArtefact<T extends z.ZodType>(
  storage: Storage,
  key: string | undefined,
  schema: T,
  kind: string,
): Promise<z.infer<T> | undefined> {
  if (key === undefined) return undefined
  const bytes = await storage.getBytes(key, { maxBytes: MAX_JSON_BYTES })
  if (bytes === undefined) return undefined
  let document: unknown
  try {
    document = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new StageError('artefact_invalid', false)
  }
  const parsed = schema.safeParse(document)
  if (!parsed.success) throw new StageError('artefact_invalid', false)
  const header = parsed.data as { schema_version: string; artefact: string }
  try {
    assertCompatible(header.schema_version)
  } catch {
    throw new StageError('artefact_incompatible', false)
  }
  if (header.artefact !== kind) throw new StageError('artefact_invalid', false)
  return parsed.data
}

async function loadInputs(services: Services, request: Request, params: Params) {
  const { storage } = services
  const recorded = await queue.recordedKeys(services.db, Object.values(request.inputs))
  const inputs = Object.fromEntries(
    Object.entries(request.inputs).filter(([, key]) => recorded.has(key)),
  )
  const { beats: beatsKey, chords: chordsKey, stems: stemsKey } = inputs
  if (beatsKey === undefined) throw new NothingToFinalize()
  const beats = await readArtefact(storage, beatsKey, Beats, 'beats')
  if (beats === undefined) throw new StageError('beats_missing', false)
  const result: FinalizeInputs = { beats, notes: {} }
  const chords = await readArtefact(storage, chordsKey, Chords, 'chords')
  if (chords !== undefined) result.chords = chords
  const stems = await readArtefact(storage, stemsKey, Stems, 'stems')
  if (stems !== undefined) result.stems = stems
  for (const instrument of params.instruments) {
    const kind = `notes.${instrument}`
    if (instrument === 'drums') {
      const drums = await readArtefact(storage, inputs[kind], DrumNotes, kind)
      if (drums !== undefined) result.drums = drums
      continue
    }
    const notes = await readArtefact(storage, inputs[kind], Notes, kind)
    if (notes !== undefined) result.notes[instrument] = notes
  }
  return result
}

async function put(
  storage: Storage,
  key: string,
  kind: string,
  body: string,
  contentType: string,
): Promise<queue.WrittenArtefact> {
  const bytes = new TextEncoder().encode(body)
  await storage.putBytes(key, bytes, contentType)
  return {
    kind,
    key,
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

async function run(
  services: Services,
  job: Job,
  request: Request,
  params: Params,
  analysis: queue.AnalysisRef,
): Promise<boolean> {
  let inputs: FinalizeInputs
  try {
    inputs = await loadInputs(services, request, params)
  } catch (error) {
    if (!(error instanceof NothingToFinalize)) throw error
    return queue.finishAnalysisFailed(services.db, job, services.workerId, analysis, 'finalize')
  }
  const result = finalize(
    analysis.id,
    inputs,
    {
      instruments: params.instruments,
      ...(params.fingering_mode === undefined ? {} : { fingeringMode: params.fingering_mode }),
      ...(params.profile === undefined ? {} : { profile: params.profile }),
    },
    services.views,
  )
  const written: queue.WrittenArtefact[] = []
  for (const { instrument, tab, alphaTex } of result.tabs) {
    const tabKey = request.outputs[`tab.${instrument}`] as string
    const renderKey = request.outputs[`render.${instrument}`] as string
    written.push(
      await put(
        services.storage,
        tabKey,
        `tab.${instrument}`,
        JSON.stringify(Tab.parse(tab)),
        'application/json',
      ),
      await put(
        services.storage,
        renderKey,
        `render.${instrument}`,
        alphaTex,
        'text/plain; charset=utf-8',
      ),
    )
  }
  // Summary last: a reader that sees it can fetch every tab it implies.
  const { summary: summaryKey } = request.outputs
  written.push(
    await put(
      services.storage,
      summaryKey as string,
      'summary',
      JSON.stringify(Summary.parse(result.summary)),
      'application/json',
    ),
  )
  return queue.finishStage(services.db, {
    job,
    workerId: services.workerId,
    analysis,
    stage: 'finalize',
    status: 'done',
    written,
    modelRefs: [],
    primaryKind: 'summary',
    // The requested instrument comes first (the API plans `instruments: [requested]`).
    analysisDone: {
      status: result.status,
      summaryKind: 'summary',
      ...(result.summary.per_instrument[0] === undefined
        ? {}
        : { recommendedView: result.summary.per_instrument[0].recommended_view }),
    },
  })
}

// delete_prefix: every prefix must lie inside the payload user's prefix (the API's RLS policy
// checked that already; storage.deletePrefix checks the key rules again).
async function cleanup(services: Services, job: Job): Promise<boolean> {
  const payload = CleanupPayload.safeParse(job.payload)
  if (!payload.success || job.analysisId !== null) throw new StageError('invalid_request', false)
  const { user_id: userId, prefixes } = payload.data
  let own: string
  try {
    own = userPrefix(userId)
  } catch {
    throw new StageError('invalid_request', false)
  }
  if (!prefixes.every((p) => p.startsWith(own) && p.endsWith('/'))) {
    throw new StageError('invalid_request', false)
  }
  let deleted = 0
  for (const prefix of prefixes) {
    try {
      deleted += await services.storage.deletePrefix(prefix)
    } catch (error) {
      if (error instanceof StorageKeyError) throw new StageError('invalid_request', false)
      throw error
    }
  }
  services.log.info('prefixes deleted', { job_id: job.id, prefixes: prefixes.length, deleted })
  return queue.complete(services.db, job.id, services.workerId)
}

// Returns the final job status: done, queued (retry), failed, or lost (lock taken over).
export async function executeJob(
  services: Services,
  job: Job,
): Promise<'done' | 'queued' | 'failed' | 'lost'> {
  if (job.kind === 'delete_prefix') return executeCleanup(services, job, cleanup)
  const { privacy } = services
  if (privacy && job.kind === EXPORT_KIND) {
    return executeCleanup(services, job, () => exportUserData(privacy, job))
  }
  if (privacy && job.kind === DELETE_ACCOUNT_KIND) {
    return executeCleanup(services, job, () => deleteAccount(privacy, job))
  }
  const started = Date.now()
  const context = {
    job_id: job.id,
    stage: job.kind,
    analysis_id: job.analysisId,
    attempt: job.attempts,
  }
  let analysis: queue.AnalysisRef | undefined
  let lost = false
  const beat = setInterval(() => {
    queue.heartbeat(services.db, job.id, services.workerId).then(
      (held) => {
        if (!held) lost = true
      },
      (error: unknown) =>
        services.log.warn('job heartbeat failed', { ...context, error_code: errorName(error) }),
    )
  }, services.jobHeartbeatMs)
  try {
    const { request, params } = parseRequest(job)
    analysis = await queue.loadAnalysis(services.db, request.analysis_id)
    if (analysis === undefined) throw new StageError('analysis_missing', false)
    checkRequest(request, params, analysis)
    await queue.markStageStarted(services.db, job, analysis, 'finalize')
    services.log.info('stage started', context)
    const done = !lost && (await run(services, job, request, params, analysis))
    if (!done) {
      services.log.warn('lock lost; result discarded', context)
      return 'lost'
    }
    services.log.info('stage done', { ...context, wall_s: (Date.now() - started) / 1000 })
    await recordTelemetry(services, analysis.id)
    return 'done'
  } catch (error) {
    const stageError = error instanceof StageError ? error : new StageError('internal_error', true)
    if (!(error instanceof StageError)) {
      services.log.error('stage crashed', { ...context, error_code: errorName(error) })
    }
    const status = await queue.recordStageFailure(
      services.db,
      job,
      services.workerId,
      analysis,
      analysis === undefined ? undefined : 'finalize',
      stageError.code,
      { retry: stageError.retry },
    )
    services.log.warn('stage failed', {
      ...context,
      error_code: stageError.code,
      job_status: status ?? 'lost',
      wall_s: (Date.now() - started) / 1000,
    })
    return status ?? 'lost'
  } finally {
    clearInterval(beat)
  }
}

// Best effort: an analysis without its events is still a finished analysis.
async function recordTelemetry(services: Services, analysisId: string): Promise<void> {
  if (!services.hashUser) return
  try {
    await queue.recordAnalysisTelemetry(services.db, analysisId, services.hashUser)
  } catch (error) {
    services.log.warn('analysis events not recorded', {
      analysis_id: analysisId,
      error_code: errorName(error),
    })
  }
}

// Jobs without an analysis (object cleanup, privacy requests): run, complete, or fail with a code.
async function executeCleanup(
  services: Services,
  job: Job,
  work: (services: Services, job: Job) => Promise<boolean>,
): Promise<'done' | 'queued' | 'failed' | 'lost'> {
  const context = { job_id: job.id, kind: job.kind, attempt: job.attempts }
  try {
    if (!(await work(services, job))) {
      services.log.warn('lock lost', context)
      return 'lost'
    }
    return 'done'
  } catch (error) {
    const stageError =
      error instanceof StageError
        ? error
        : error instanceof PrivacyJobError
          ? new StageError(error.code, error.retry)
          : new StageError('internal_error', true)
    if (!(error instanceof StageError) && !(error instanceof PrivacyJobError)) {
      services.log.error('cleanup crashed', { ...context, error_code: errorName(error) })
    }
    const status = await queue.fail(services.db, job.id, services.workerId, stageError.code, {
      retry: stageError.retry,
    })
    services.log.warn('cleanup failed', {
      ...context,
      error_code: stageError.code,
      job_status: status ?? 'lost',
    })
    return status ?? 'lost'
  }
}

// Error class names only: messages may carry keys or URLs (06 §3, no user content in logs). A failed
// query names its Postgres SQLSTATE instead (42P01: missing table), since its class says nothing.
export function errorName(error: unknown): string {
  if (!(error instanceof Error)) return typeof error
  const { cause } = error
  if (cause instanceof Error && 'code' in cause && typeof cause.code === 'string')
    return `${error.name}:${cause.code}`
  return error.name
}
