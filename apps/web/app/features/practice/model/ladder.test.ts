import { SpeedTrainer } from '@splitune/contracts'
import { describe, expect, it } from 'vitest'
import {
  defaultLadder,
  fromTrainer,
  type Ladder,
  ladderView,
  ratePass,
  rungIndex,
  rungs,
  toTrainer,
  withSetting,
} from './ladder'

const settings = defaultLadder(null, 3)
const fresh: Ladder = { settings, clean: 0, misses: 0 }

/** Rates passes in order at a speed that follows the ladder's moves. */
function play(ladder: Ladder, speedPct: number, outcomes: ('clean' | 'not_yet')[]) {
  let state = ladder
  let speed = speedPct
  let finished = false
  for (const outcome of outcomes) {
    const result = ratePass(state, speed, outcome)
    state = result.ladder
    speed = result.speedPct ?? speed
    finished = result.finished
  }
  return { ladder: state, speed, finished }
}

describe('speed ladder', () => {
  it('defaults to 70 → 100 in 5 % steps, 3 clean passes, down after 2 misses (12 §5)', () => {
    expect(settings).toEqual({
      start_pct: 70,
      end_pct: 100,
      step_pct: 5,
      plays_per_step: 3,
      count_in_each_pass: true,
      drop_after_misses: 2,
      on_goal: 'keep',
    })
    expect(rungs(settings)).toEqual([70, 75, 80, 85, 90, 95, 100])
  })

  it('starts from the best clean tempo when the clip has one', () => {
    expect(defaultLadder(80, 3).start_pct).toBe(80)
    expect(defaultLadder(40, 3).start_pct).toBe(50)
    // Already clean above the goal: the ladder starts at its goal.
    expect(rungs(defaultLadder(110, 2))).toEqual([100])
    expect(defaultLadder(null, 2).plays_per_step).toBe(2)
    // Turning it on never speeds the learner up.
    expect(defaultLadder(80, 3, 60).start_pct).toBe(60)
    expect(defaultLadder(null, 3, 85).start_pct).toBe(70)
  })

  it('ends on the goal when the step does not divide the range', () => {
    expect(rungs({ ...settings, start_pct: 70, end_pct: 100, step_pct: 20 })).toEqual([70, 90, 100])
    expect(rungs({ ...settings, start_pct: 50, end_pct: 110, step_pct: 1 })).toHaveLength(61)
  })

  it('moves up a rung on the nth clean pass and starts counting again', () => {
    expect(play(fresh, 70, ['clean', 'clean'])).toMatchObject({
      speed: 70,
      ladder: { clean: 2, misses: 0 },
    })
    expect(play(fresh, 70, ['clean', 'clean', 'clean'])).toMatchObject({
      speed: 75,
      ladder: { clean: 0, misses: 0 },
    })
    // A miss between clean passes doesn't undo them.
    expect(play(fresh, 70, ['clean', 'not_yet', 'clean', 'clean']).speed).toBe(75)
  })

  it('goes back a rung after n misses in a row, never below the start', () => {
    expect(play(fresh, 80, ['not_yet'])).toMatchObject({ speed: 80, ladder: { misses: 1 } })
    expect(play({ ...fresh, clean: 2 }, 80, ['not_yet', 'not_yet'])).toMatchObject({
      speed: 75,
      ladder: { clean: 0, misses: 0 },
    })
    // A clean pass ends the run.
    expect(play(fresh, 80, ['not_yet', 'clean', 'not_yet']).speed).toBe(80)
    expect(play({ ...fresh, clean: 1 }, 70, ['not_yet', 'not_yet'])).toMatchObject({
      speed: 70,
      ladder: { clean: 1, misses: 0 },
    })
  })

  it('never goes back with the miss rule off', () => {
    const off: Ladder = { ...fresh, settings: { ...settings, drop_after_misses: 0 } }
    expect(play(off, 80, ['not_yet', 'not_yet', 'not_yet', 'not_yet']).speed).toBe(80)
  })

  it('keeps looping at the goal, or stops there', () => {
    const kept = play(fresh, 100, ['clean', 'clean', 'clean', 'clean'])
    expect(kept).toMatchObject({ speed: 100, finished: false, ladder: { clean: 3 } })
    const stop: Ladder = { ...fresh, settings: { ...settings, on_goal: 'stop' } }
    expect(play(stop, 100, ['clean', 'clean']).finished).toBe(false)
    expect(play(stop, 100, ['clean', 'clean', 'clean']).finished).toBe(true)
    // Below the goal the last clean pass moves up instead.
    expect(play(stop, 95, ['clean', 'clean', 'clean'])).toMatchObject({
      speed: 100,
      finished: false,
    })
  })

  it('stands on the rung at or below a speed the learner set by hand', () => {
    expect(rungIndex(settings, 60)).toBe(0)
    expect(rungIndex(settings, 78)).toBe(1)
    expect(rungIndex(settings, 110)).toBe(6)
    // From 78 % the next rung is 80 %, and back down is 75 %.
    expect(play(fresh, 78, ['clean', 'clean', 'clean']).speed).toBe(80)
    expect(play(fresh, 78, ['not_yet', 'not_yet']).speed).toBe(75)
  })

  it('says where the learner is: the pass played for and the next rung', () => {
    expect(ladderView({ ...fresh, clean: 1 }, 75)).toEqual({
      rungs: [70, 75, 80, 85, 90, 95, 100],
      current: 1,
      pass: 2,
      of: 3,
      nextPct: 80,
    })
    expect(ladderView({ ...fresh, clean: 3 }, 100)).toMatchObject({
      current: 6,
      pass: 3,
      nextPct: null,
    })
  })

  it('keeps the goal at or above the start when either is changed', () => {
    expect(withSetting(settings, { start_pct: 105 })).toMatchObject({
      start_pct: 105,
      end_pct: 105,
    })
    expect(withSetting(settings, { end_pct: 60 })).toMatchObject({ start_pct: 60, end_pct: 60 })
    expect(withSetting(settings, { step_pct: 1 })).toMatchObject({ start_pct: 70, end_pct: 100 })
  })

  it('round-trips through the clip, place on the ladder included', () => {
    const climbed: Ladder = { settings: { ...settings, on_goal: 'stop' }, clean: 2, misses: 1 }
    const trainer = SpeedTrainer.parse(toTrainer(climbed, 80))
    expect(trainer).toMatchObject({ current_pct: 80, clean_count: 2, miss_count: 1 })
    expect(fromTrainer(SpeedTrainer.parse(JSON.parse(JSON.stringify(trainer))))).toEqual({
      ladder: climbed,
      speedPct: 80,
    })
    // A trainer saved without a place (settings only) starts at its first rung.
    expect(fromTrainer(SpeedTrainer.parse(settings))).toEqual({ ladder: fresh, speedPct: 70 })
  })
})
