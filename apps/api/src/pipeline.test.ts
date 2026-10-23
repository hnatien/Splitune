import type { Analysis } from '@splitune/db'
import { describe, expect, it } from 'vitest'
import { planAnalysis } from './pipeline.ts'

// The stage graph per instrument (POST /v1/analyses itself is covered in test/analyses.test.ts).
const analysis = (requestedInstrument: Analysis['requestedInstrument']): Analysis => ({
  id: '0192f6c4-8b00-7a00-8000-0000000000aa',
  userId: 'usr_test',
  songId: '0192f6c4-8b00-7a00-8000-0000000000bb',
  version: 1,
  pipelineVersion: 'test',
  configProfile: 'personal',
  requestedInstrument,
  analysisType: 'full',
  status: 'queued',
  progress: 0,
  idempotencyKey: 'k',
  workflowRunId: null,
  baseAnalysisId: null,
  costUsdEstimate: null,
  recommendedView: null,
  createdAt: new Date('2026-10-23T00:00:00Z'),
  finishedAt: null,
})

// The StageRequest fields these tests read.
type Payload = { inputs: Record<string, string>; outputs: { notes?: string; summary?: string } }
const io = (job: { payload: Record<string, unknown> } | undefined) => job?.payload as Payload

const plan = (instrument: Analysis['requestedInstrument']) =>
  planAnalysis({
    userId: 'usr_test',
    analysis: analysis(instrument),
    type: 'full',
    source: { rawKey: 'u/usr_test/raw/up1/song.mp3' },
    priority: 0,
  }).jobs

describe('planAnalysis', () => {
  it('transcribes piano notes from its stem and finalizes them without a tab', () => {
    const jobs = plan('piano')
    const notes = jobs.find((j) => j.name === 'notes.piano')
    expect(io(notes).inputs).toMatchObject({
      separation: expect.stringMatching(/separation\.json$/),
      stems: expect.stringMatching(/stems\.json$/),
    })
    expect(notes?.dependsOn).toEqual(['decode'])
    expect(notes?.softDependsOn).toEqual(['stem_post'])
    const finalize = jobs.at(-1)
    expect(io(finalize).inputs['notes.piano']).toBe(io(notes).outputs.notes)
    expect(Object.keys(io(finalize).outputs)).toEqual(['summary'])
  })

  it('gives drums no notes stage yet', () => {
    expect(plan('drums').map((j) => j.name)).not.toContain('notes.drums')
  })
})
