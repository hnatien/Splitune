import type { Analysis, StageTiming } from '@splitune/contracts'
import type { z } from 'zod'
import { m } from '@/lib/i18n'
import type { Stage, StageStatus } from '@/ui/stage-list'

type AnalysisData = z.infer<typeof Analysis>
type Timing = z.infer<typeof StageTiming>

// Pipeline stages in the order a learner meets them (06 §1; url_import first for links).
const ORDER = [
  'url_import',
  'decode',
  'beats',
  'tag',
  'separate',
  'stem_post',
  'chords',
  'notes',
  'f0',
  'sections',
  'lyrics',
  'finalize',
]

const rank = (stage: string) => {
  const index = ORDER.indexOf(stage.split('.')[0] ?? stage)
  return index === -1 ? ORDER.length : index
}

export function stageLabel(stage: string): string {
  const family = stage.split('.')[0]
  switch (family) {
    case 'url_import':
      return m['stage.url_import']()
    case 'decode':
      return m['stage.decode']()
    case 'beats':
      return m['stage.beats']()
    case 'tag':
      return m['stage.tag']()
    case 'separate':
      return m['stage.separate']()
    case 'stem_post':
      return m['stage.stem_post']()
    case 'chords':
      return m['stage.chords']()
    case 'notes':
    case 'f0':
      return m['stage.notes']()
    case 'finalize':
      return m['stage.finalize']()
    default:
      return m['stage.other']()
  }
}

const VISUAL: Record<string, StageStatus> = {
  pending: 'queued',
  running: 'running',
  done: 'done',
  fallback: 'fallback',
  failed: 'failed',
  skipped: 'queued',
}

/**
 * Remaining time from recent median stage times (13 §4): pending stages count in full, the running
 * one minus what it has used. Undefined when any remaining stage has no recent timing, because a
 * guess would be a fake progress bar.
 */
export function remainingSeconds(
  analysis: AnalysisData,
  timings: Timing[],
  now: number = Date.now(),
): number | undefined {
  const median = new Map(timings.map((t) => [t.stage, t.median_s]))
  let total = 0
  for (const [stage, state] of Object.entries(analysis.stages)) {
    if (state.status !== 'pending' && state.status !== 'running') continue
    const typical = median.get(stage as Timing['stage'])
    if (typical === undefined) return undefined
    const used =
      state.status === 'running' && state.started_at
        ? (now - Date.parse(state.started_at)) / 1000
        : 0
    total += Math.max(0, typical - used)
  }
  return total
}

export function etaText(seconds: number | undefined): string | undefined {
  if (seconds === undefined) return undefined
  return m['analysis.eta']({ minutes: String(Math.max(1, Math.ceil(seconds / 60))) })
}

/** The analysis as StageList rows, in pipeline order, with an honest status text each. */
export function stageRows(analysis: AnalysisData, eta: string | undefined): Stage[] {
  return Object.entries(analysis.stages)
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([id, state]) => ({
      id,
      label: stageLabel(id),
      status: VISUAL[state.status] ?? 'queued',
      statusText: statusText(state.status, eta),
    }))
}

function statusText(status: string, eta: string | undefined): string {
  switch (status) {
    case 'running':
      return eta ?? m['stage.status.running']()
    case 'done':
      return m['stage.status.done']()
    case 'fallback':
      return m['stage.status.fallback']()
    case 'failed':
      return m['stage.status.failed']()
    case 'skipped':
      return m['stage.status.skipped']()
    default:
      return m['stage.status.queued']()
  }
}

/** Share of stages that have finished (any outcome), 0–100, for the determinate overall bar. */
export function progressPercent(analysis: AnalysisData): number {
  const states = Object.values(analysis.stages)
  if (states.length === 0) return 0
  const finished = states.filter((s) => s.status !== 'pending' && s.status !== 'running').length
  return Math.round((finished / states.length) * 100)
}

/** The stage working now (or next up), for the compact library card. */
export function currentStage(analysis: AnalysisData): string | undefined {
  const entries = Object.entries(analysis.stages).sort(([a], [b]) => rank(a) - rank(b))
  return (
    entries.find(([, s]) => s.status === 'running')?.[0] ??
    entries.find(([, s]) => s.status === 'pending')?.[0]
  )
}
