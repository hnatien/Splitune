import type { SpeedTrainer } from '@splitune/contracts'
import type { z } from 'zod'

// The speed ladder (21 V1, 12 §5): a loop's speed climbs from Start to Goal one step at a time,
// up after a number of clean passes, back down after misses in a row. Pure rules over the clip's
// trainer, so the player machine, the Loop tab and the tests share them. The ladder is an
// adjustable default, never presented as science: every number here is a setting.

export type Trainer = z.infer<typeof SpeedTrainer>

/** The ladder's settings: the trainer without the learner's place on it. */
export type LadderSettings = Omit<Trainer, 'current_pct' | 'clean_count' | 'miss_count'>

/** The settings and the counts at the current speed (the rung is the player's speed). */
export interface Ladder {
  settings: LadderSettings
  /** Clean passes at this speed. */
  clean: number
  /** "Not yet" answers in a row. */
  misses: number
}

/** What the engine can play (`MIN_RATE`…; the speed control stops at 110 %, 26 §12.2). */
export const LADDER_MIN_PCT = 50
export const LADDER_MAX_PCT = 110

const FALLBACK_START_PCT = 70

/**
 * 12 §5: Start = best clean tempo else 70 %, Goal 100 %, Step 5 %, back down after 2 misses,
 * count-in before each pass, keep looping at the goal. Clean passes per step come from Settings
 * (3 by default, D3). Turning the ladder on never speeds the learner up: a speed already below
 * the start becomes the start.
 */
export function defaultLadder(
  best: number | null,
  cleanPasses: number,
  speedPct = 100,
): LadderSettings {
  const end = 100
  const start = Math.min(end, speedPct, best ?? FALLBACK_START_PCT)
  return {
    start_pct: Math.max(LADDER_MIN_PCT, start),
    end_pct: end,
    step_pct: 5,
    plays_per_step: cleanPasses,
    count_in_each_pass: true,
    drop_after_misses: 2,
    on_goal: 'keep',
  }
}

/** A changed setting, kept consistent: the goal never sits below the start. */
export function withSetting(settings: LadderSettings, patch: Partial<LadderSettings>) {
  const next = { ...settings, ...patch }
  if (patch.start_pct !== undefined) next.end_pct = Math.max(next.end_pct, next.start_pct)
  if (patch.end_pct !== undefined) next.start_pct = Math.min(next.start_pct, next.end_pct)
  return next
}

/** Start, each step above it, and the goal (the last step is shorter when it doesn't divide). */
export function rungs({ start_pct, end_pct, step_pct }: LadderSettings): number[] {
  const out: number[] = []
  for (let pct = start_pct; pct < end_pct; pct += step_pct) out.push(pct)
  out.push(end_pct)
  return out
}

/** The rung a speed stands on: the highest one at or below it (the first when slower). */
export function rungIndex(settings: LadderSettings, speedPct: number): number {
  const all = rungs(settings)
  let index = 0
  for (let i = 0; i < all.length; i++) if ((all[i] ?? 0) <= speedPct) index = i
  return index
}

const stepUp = (settings: LadderSettings, speedPct: number) =>
  rungs(settings).find((pct) => pct > speedPct) ?? null

const stepDown = (settings: LadderSettings, speedPct: number) =>
  rungs(settings).findLast((pct) => pct < speedPct) ?? null

export interface Rated {
  ladder: Ladder
  /** The speed to move to at the next loop seam; null stays. */
  speedPct: number | null
  /** The goal's last clean pass with "stop" chosen: the loop ends at the seam. */
  finished: boolean
}

/**
 * One rated pass at `speedPct`: the nth clean pass moves up a rung (at the goal it keeps looping
 * or stops); the nth "Not yet" in a row moves down one (never below the start). A clean pass
 * ends a run of misses; misses don't undo clean passes.
 */
export function ratePass(ladder: Ladder, speedPct: number, outcome: 'clean' | 'not_yet'): Rated {
  const { settings } = ladder
  if (outcome === 'clean') {
    const clean = ladder.clean + 1
    if (clean < settings.plays_per_step) {
      return { ladder: { settings, clean, misses: 0 }, speedPct: null, finished: false }
    }
    const up = stepUp(settings, speedPct)
    if (up === null) {
      return {
        ladder: { settings, clean: settings.plays_per_step, misses: 0 },
        speedPct: null,
        finished: settings.on_goal === 'stop',
      }
    }
    return { ladder: { settings, clean: 0, misses: 0 }, speedPct: up, finished: false }
  }
  const misses = ladder.misses + 1
  if (settings.drop_after_misses === 0 || misses < settings.drop_after_misses) {
    return { ladder: { ...ladder, misses }, speedPct: null, finished: false }
  }
  const down = stepDown(settings, speedPct)
  return {
    ladder: { settings, clean: down === null ? ladder.clean : 0, misses: 0 },
    speedPct: down,
    finished: false,
  }
}

/** What the Loop tab, the loop pill and the bracket say about the ladder now. */
export interface LadderView {
  rungs: number[]
  /** Index of the rung the speed stands on; the ones before it are done. */
  current: number
  /** The clean pass being played for (1-based, at most `of`). */
  pass: number
  of: number
  /** The rung after this one; null at the goal. */
  nextPct: number | null
}

export function ladderView(ladder: Ladder, speedPct: number): LadderView {
  const all = rungs(ladder.settings)
  const current = rungIndex(ladder.settings, speedPct)
  const of = ladder.settings.plays_per_step
  return {
    rungs: all,
    current,
    pass: Math.min(of, ladder.clean + 1),
    of,
    nextPct: stepUp(ladder.settings, speedPct),
  }
}

/** The clip's stored trainer → the ladder and the speed it was left at. */
export function fromTrainer(trainer: Trainer): { ladder: Ladder; speedPct: number } {
  const { current_pct, clean_count, miss_count, ...settings } = trainer
  return {
    ladder: {
      settings,
      clean: Math.min(settings.plays_per_step, clean_count ?? 0),
      misses: miss_count ?? 0,
    },
    speedPct: current_pct ?? settings.start_pct,
  }
}

/** The ladder and the speed now → the trainer saved on the clip, so a reload resumes there. */
export function toTrainer(ladder: Ladder, speedPct: number): Trainer {
  return {
    ...ladder.settings,
    current_pct: speedPct,
    clean_count: ladder.clean,
    miss_count: Math.min(5, ladder.misses),
  }
}
