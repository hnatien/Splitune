import { createHash } from 'node:crypto'
import {
  assertCompatible,
  Beats,
  Chords,
  Instrument,
  Notes,
  StageRequest,
  Stems,
  Summary,
  Tab,
} from '@splitune/contracts'
import { type Database, queue } from '@splitune/db'

type Job = queue.Job

import { analysisPrefix, assertSafeKey, type Storage, userPrefix } from '@splitune/storage'
import { z } from 'zod'
import { type FinalizeInputs, finalize } from './finalize.ts'
import type { Logger } from './log.ts'
import type { ViewsConfig } from './views.ts'

// Runs one claimed finalize job: validate → stage.started → read artefacts → finalize → write
// tab/render/summary → one transaction that records the result, ends the analysis and completes
// the job (packages/db `finishStage`). Same request rules as the Python executor.

export interface Services {
  db: Database
  storage: Storage
  views: ViewsConfig
  workerId: string
  log: Logger
  jobHeartbeatMs: number
}

export class StageError extends Error {
  constructor(
    readonly code: string,
    readonly retry: boolean,
  ) {
    super(code)
  }
}

const MAX_JSON_BYTES = 64 * 1024 * 1024
const TAB_INSTRUMENTS = new Set(['guitar', 'bass'])

const FinalizeParams = z.object({
  instruments: z.array(Instrument).min(1),
  fingering_mode: z.enum(['easiest', 'as_played']).optional(),
})

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

async function loadInputs(storage: Storage, request: Request, params: Params) {
  const { inputs } = request
  const { beats: beatsKey, chords: chordsKey, stems: stemsKey } = inputs
  const beats = await readArtefact(storage, beatsKey, Beats, 'beats')
  if (beats === undefined) throw new StageError('beats_missing', false)
  const result: FinalizeInputs = { beats, notes: {} }
  const chords = await readArtefact(storage, chordsKey, Chords, 'chords')
  if (chords !== undefined) result.chords = chords
  const stems = await readArtefact(storage, stemsKey, Stems, 'stems')
  if (stems !== undefined) result.stems = stems
  for (const instrument of params.instruments) {
    const kind = `notes.${instrument}`
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
  const inputs = await loadInputs(services.storage, request, params)
  const result = finalize(
    analysis.id,
    inputs,
    {
      instruments: params.instruments,
      ...(params.fingering_mode === undefined ? {} : { fingeringMode: params.fingering_mode }),
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
    analysisDone: { status: result.status, summaryKind: 'summary' },
  })
}

// Returns the final job status: done, queued (retry), failed, or lost (lock taken over).
export async function executeJob(
  services: Services,
  job: Job,
): Promise<'done' | 'queued' | 'failed' | 'lost'> {
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

// Error class names only: messages may carry keys or URLs (06 §3, no user content in logs).
export function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error
}
