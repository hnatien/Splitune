// Progressive practice (27 §3.7.3, 13 §4): what the "Getting ready" card, the top bar's analysing
// badge and the "What works now" card say while the analysis runs. Pure, so every rule is a table
// test; the components only render the answer.
//
// ETA rules: typical stage times (recent medians) weight every stage, so separation takes its
// large share; the estimate counts every stage not finished at its full typical time, so it only
// changes when a stage finishes and never creeps to 99 %; it's a padded range when uncertain
// ("about 3–5 min"); and it's hidden when a remaining stage has no timing yet.

export interface StageState {
  status: string
}

export interface AnalysisLike {
  status: string
  stages: Record<string, StageState>
}

export interface TimingLike {
  stage: string
  median_s: number
}

const FINISHED = new Set(['done', 'fallback', 'failed', 'skipped'])
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

export const family = (stage: string) => stage.split('.')[0] ?? stage

const rank = (stage: string) => {
  const index = ORDER.indexOf(family(stage))
  return index === -1 ? ORDER.length : index
}

/** The stages in the order a learner meets them. */
export function orderedStages(analysis: AnalysisLike): [string, StageState][] {
  return Object.entries(analysis.stages).sort(([a], [b]) => rank(a) - rank(b))
}

export const finished = (state: StageState | undefined) =>
  state !== undefined && FINISHED.has(state.status)

export const running = (analysis: AnalysisLike | undefined) =>
  analysis !== undefined && (analysis.status === 'queued' || analysis.status === 'running')

/**
 * Seconds of typical work left in the stages up to and including `until` (a stage family; every
 * stage when omitted), counting each unfinished stage in full. 0 when they're all finished;
 * undefined when one of them has no typical time yet.
 */
export function remaining(
  analysis: AnalysisLike,
  timings: readonly TimingLike[],
  until?: string,
): number | undefined {
  const median = new Map(timings.map((t) => [t.stage, t.median_s]))
  const stages = orderedStages(analysis)
  const last =
    until === undefined ? stages.length - 1 : stages.findLastIndex(([s]) => family(s) === until)
  if (last < 0) return undefined
  let total = 0
  for (const [stage, state] of stages.slice(0, last + 1)) {
    if (finished(state)) continue
    const typical = median.get(stage) ?? median.get(family(stage))
    if (typical === undefined) return undefined
    total += typical
  }
  return total
}

/**
 * Whole minutes for "about {minutes} min left": one number for short or certain waits, a padded
 * range ("3–5") once several minutes are left (−20 % / +25 %).
 */
export function etaMinutes(seconds: number | undefined): string | undefined {
  if (seconds === undefined || seconds <= 0) return undefined
  const minutes = Math.max(1, Math.ceil(seconds / 60))
  if (seconds < 150) return String(minutes)
  const low = Math.max(1, Math.floor((seconds * 0.8) / 60))
  const high = Math.ceil((seconds * 1.25) / 60)
  return low < high ? `${low}–${high}` : String(minutes)
}

/** Overall progress 0–99 from finished stages weighted by their typical times (equal weights
 * where no timing exists); 100 only when every stage has finished. */
export function overallProgress(analysis: AnalysisLike, timings: readonly TimingLike[]): number {
  const median = new Map(timings.map((t) => [t.stage, t.median_s]))
  const stages = orderedStages(analysis)
  if (stages.length === 0) return 0
  const weight = (stage: string) => Math.max(1, median.get(stage) ?? median.get(family(stage)) ?? 1)
  const total = stages.reduce((sum, [stage]) => sum + weight(stage), 0)
  const done = stages.reduce(
    (sum, [stage, state]) => sum + (finished(state) ? weight(stage) : 0),
    0,
  )
  if (done >= total) return 100
  return Math.min(99, Math.floor((done / total) * 100))
}

/** "Analysing 5 of 8": the stage being worked on (finished + 1) out of all stages. */
export function analysingStep(analysis: AnalysisLike): { current: number; total: number } {
  const stages = orderedStages(analysis)
  const done = stages.filter(([, state]) => finished(state)).length
  return { current: Math.min(stages.length, done + 1), total: stages.length }
}

/** The stage working now (or next up), for the progress bar's `aria-valuetext`. */
export function currentStage(analysis: AnalysisLike): string | undefined {
  const stages = orderedStages(analysis)
  return (
    stages.find(([, s]) => s.status === 'running')?.[0] ?? stages.find(([, s]) => !finished(s))?.[0]
  )
}

export type UnlockState = 'ready' | 'soon' | 'later'

export interface Unlock {
  id: 'loop' | 'count-in' | 'mixer' | 'chords' | 'notation'
  state: UnlockState
  /** Whole minutes (or a range) until it unlocks; undefined when ready or unknown. */
  minutes?: string | undefined
}

export interface UnlockInput {
  analysis: AnalysisLike
  timings: readonly TimingLike[]
  /** What already works (the practice screen's layers). */
  layers: { audio: boolean; beats: boolean; stems: boolean; chords: boolean; notation: boolean }
}

/**
 * "What works now" (27 §3.7.3): loop and slow-down, count-in and metronome, the mixer, chords and
 * the notation, each Ready, Soon (the next to unlock) or Later, with how long until it unlocks.
 * The mixer, chords and notation rows exist only when the analysis has their stages (a Lite
 * analysis has no stems or tab).
 */
export function unlocks({ analysis, timings, layers }: UnlockInput): Unlock[] {
  const has = (stage: string) => Object.keys(analysis.stages).some((s) => family(s) === stage)
  const notationStage = has('finalize') ? 'finalize' : has('notes') ? 'notes' : undefined
  const rows: { id: Unlock['id']; ready: boolean; until?: string }[] = [
    { id: 'loop', ready: layers.audio },
    { id: 'count-in', ready: layers.beats, until: 'beats' },
    ...(has('stem_post') || has('separate')
      ? [
          {
            id: 'mixer' as const,
            ready: layers.stems,
            until: has('stem_post') ? 'stem_post' : 'separate',
          },
        ]
      : []),
    ...(has('chords') ? [{ id: 'chords' as const, ready: layers.chords, until: 'chords' }] : []),
    ...(notationStage
      ? [{ id: 'notation' as const, ready: layers.notation, until: notationStage }]
      : []),
  ]
  let soonGiven = false
  return rows.map((row) => {
    if (row.ready) return { id: row.id, state: 'ready' }
    const state: UnlockState = soonGiven ? 'later' : 'soon'
    soonGiven = true
    const minutes = row.until ? etaMinutes(remaining(analysis, timings, row.until)) : undefined
    return { id: row.id, state, minutes }
  })
}

/** "about 1 in 3": a probability or share as the nearest of 1 in 2 / 3 / 4 / 5 / 10 / 20. */
export function oneInBand(share: number): number | undefined {
  if (!(share > 0)) return undefined
  const bands = [2, 3, 4, 5, 10, 20]
  const target = 1 / share
  return bands.reduce((best, band) =>
    Math.abs(Math.log(band / target)) < Math.abs(Math.log(best / target)) ? band : best,
  )
}
