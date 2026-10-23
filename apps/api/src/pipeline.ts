import { createHash } from 'node:crypto'
import type { AnalysisType, Instrument, JobEvent } from '@splitune/contracts'
import type { Analysis, AnalysisPlan, PlannedJob, ReusableStages } from '@splitune/db'
import { artefactKey, rawUploadKey, rawVideoKey, renderKey } from '@splitune/storage'
import type { z } from 'zod'

// Stage graphs of an analysis (01 §3, 06 §2, 23 §2) as jobs for the Postgres queue. Payloads are
// StageRequests in the shapes services/ml expects (`devtools.stage_request`); edges follow
// packages/db README "Analysis graphs": hard where a stage can't run without its input, soft where
// it has a fallback, and finalize soft-depends on everything so it always decides the outcome.
//
//   full: [url_import →] decode → {beats, tag} → separate → stem_post → {chords, notes.<i>} → finalize
//   lite: [url_import →] decode → beats → chords (mixture) → finalize

type InstrumentName = z.infer<typeof Instrument>
type Event = z.infer<typeof JobEvent>

export const CONFIG_PROFILE = 'personal'

// Instruments with a notes stage in services/ml (`stages.py`); the others get a chords-only
// summary until v1 adds theirs (drums).
const NOTES_INSTRUMENTS: ReadonlySet<InstrumentName> = new Set([
  'guitar',
  'bass',
  'piano',
  'vocals',
])
// finalize writes tab + alphaTex for fretted instruments (music-core buildTab).
const TAB_INSTRUMENTS: ReadonlySet<InstrumentName> = new Set(['guitar', 'bass'])

export interface DownloadRequest {
  importId: string
  video: boolean
}

export interface PlanOptions {
  userId: string
  analysis: Analysis
  type: z.infer<typeof AnalysisType>
  // The audio to analyse: a raw object that exists, or a URL download that url_import makes first.
  source: { rawKey: string } | { download: DownloadRequest }
  // decode and beats of an earlier analysis of the song, reused instead of run again.
  reuse?: ReusableStages | undefined
  priority: number
}

const at = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

// sha256 of the parts, newline-separated (03 "Keys": the analysis idempotency key).
export function analysisKey(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('\n')).digest('hex')
}

export function planAnalysis({
  userId,
  analysis,
  type,
  source,
  reuse,
  priority,
}: PlanOptions): AnalysisPlan {
  const { id: analysisId, version } = analysis
  const instrument = analysis.requestedInstrument
  const key = (file: string) => artefactKey(userId, analysisId, version, file)
  const jobs: PlannedJob[] = []
  const add = (
    name: string,
    inputs: Record<string, string>,
    outputs: Record<string, string>,
    edges: { hard?: string[]; soft?: string[] } = {},
    params: Record<string, unknown> = {},
  ) => {
    jobs.push({
      name,
      kind: name,
      runner: name === 'finalize' ? 'node' : 'python',
      payload: { analysis_id: analysisId, user_id: userId, stage: name, inputs, outputs, params },
      dependsOn: (edges.hard ?? []).filter((dep) => jobs.some((j) => j.name === dep)),
      softDependsOn: edges.soft ?? [],
      priority,
    })
  }

  let rawKey: string
  if ('download' in source) {
    const { importId, video } = source.download
    rawKey = rawUploadKey(userId, importId, 'download')
    add(
      'url_import',
      {},
      { source: rawKey, ...(video ? { video: rawVideoKey(userId, importId) } : {}) },
      {},
      { download_video: video },
    )
  } else {
    rawKey = source.rawKey
  }

  const events: Event[] = []
  let probe = key('probe.json')
  let beats = key('beats.json')
  if (reuse === undefined) {
    add('decode', { source: rawKey }, { probe }, { hard: ['url_import'] })
    add('beats', { source: rawKey, probe }, { beats }, { hard: ['decode'] })
  } else {
    probe = reuse.probe.objectKey
    beats = reuse.beats.objectKey
    for (const [stage, artefact] of [
      ['decode', reuse.probe],
      ['beats', reuse.beats],
    ] as const) {
      events.push({
        type: 'stage.completed',
        stage,
        artefact: { id: artefact.id, kind: artefact.kind, version: artefact.version },
        at: at(),
      })
    }
  }
  const audio = { source: rawKey, probe }

  const chords = key('chords.json')
  const finalizeInputs = new Map([
    ['beats', beats],
    ['chords', chords],
  ])
  if (type === 'full') {
    const tags = key('tags.json')
    const separation = key('separation.json')
    const stems = key('stems.json')
    add('tag', audio, { tags }, { hard: ['decode'] })
    add(
      'separate',
      { ...audio, tags },
      { separation },
      { hard: ['decode'], soft: ['tag'] },
      {
        instrument,
      },
    )
    add(
      'stem_post',
      { ...audio, separation, tags },
      { stems, presence: key('presence.json') },
      { hard: ['decode', 'separate'], soft: ['tag'] },
    )
    add(
      'chords',
      { ...audio, beats, separation, stems },
      { chords },
      { hard: ['decode', 'beats'], soft: ['stem_post'] },
    )
    finalizeInputs.set('stems', stems)
    if (NOTES_INSTRUMENTS.has(instrument)) {
      const notes = key(`notes.${instrument}.json`)
      add(
        `notes.${instrument}`,
        { ...audio, separation, stems },
        { notes },
        { hard: ['decode'], soft: ['stem_post'] },
      )
      finalizeInputs.set(`notes.${instrument}`, notes)
    }
  } else {
    add('chords', { ...audio, beats }, { chords }, { hard: ['decode', 'beats'] })
  }

  add(
    'finalize',
    Object.fromEntries(finalizeInputs),
    {
      summary: key('summary.json'),
      ...(TAB_INSTRUMENTS.has(instrument)
        ? {
            [`tab.${instrument}`]: key(`tab.${instrument}.json`),
            [`render.${instrument}`]: renderKey(userId, analysisId, version, instrument),
          }
        : {}),
    },
    { soft: jobs.map((j) => j.name) },
    { instruments: [instrument], profile: type },
  )

  return {
    jobs,
    events,
    songStatus: 'download' in source ? 'importing' : 'analysing',
  }
}
