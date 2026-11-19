import { describe, expect, it, vi } from 'vitest'
import { createActor } from 'xstate'
import { defaultLadder, type Ladder } from './ladder'
import type { LoopRange } from './loops'
import { type PlayerEngine, playerMachine } from './player-machine'

function fakeEngine() {
  const calls: string[] = []
  let position = 0
  const engine: PlayerEngine = {
    play: (bars) => calls.push(`play ${bars}`),
    pause: () => calls.push('pause'),
    seek: (s) => {
      position = s
      calls.push(`seek ${s}`)
    },
    setRate: (r) => calls.push(`rate ${r}`),
    setLoop: (l) => calls.push(l ? `loop ${l.start}-${l.end}` : 'loop off'),
    setStopAt: (s) => calls.push(s === null ? 'stopAt off' : `stopAt ${s}`),
    setMetronome: (on) => calls.push(`metronome ${on}`),
    position: () => position,
  }
  return { engine, calls, setPosition: (s: number) => (position = s) }
}

const LOOP: LoopRange = { startBar: 2, endBar: 3, start: 5.3, end: 10.1 }

function start(rest: 'none' | 'beat' | 'bar' = 'none', countInBars = 1) {
  const fake = fakeEngine()
  const actor = createActor(playerMachine, {
    input: { engine: fake.engine, speedPct: 100, countInBars, rest, restSeconds: 2.4 },
  })
  actor.start()
  actor.send({ type: 'LOADED' })
  actor.send({ type: 'SET_BEATS', hasBeats: true })
  fake.calls.length = 0
  return { actor, ...fake, state: () => actor.getSnapshot().value }
}

describe('player machine', () => {
  it('plays from Ready with the count-in, then Playing once the engine starts', () => {
    const { actor, calls, state } = start()
    actor.send({ type: 'PLAY' })
    expect(state()).toBe('countIn')
    expect(calls).toEqual(['stopAt off', 'loop off', 'play 1'])
    actor.send({ type: 'ENGINE.STARTED' })
    expect(state()).toBe('playing')
  })

  it('plays without a count-in before the beat grid exists', () => {
    const { actor, calls, state } = start()
    actor.send({ type: 'SET_BEATS', hasBeats: false })
    calls.length = 0
    actor.send({ type: 'PLAY' })
    expect(state()).toBe('playing')
    expect(calls.at(-1)).toBe('play 0')
  })

  it('loops seamlessly in the engine and counts passes', () => {
    const { actor, calls, state } = start('none', 0)
    actor.send({ type: 'SET_LOOP', loop: LOOP })
    expect(calls).toEqual(['stopAt off', 'loop 5.3-10.1'])
    calls.length = 0
    actor.send({ type: 'PLAY' })
    // Outside the loop: start at its beginning.
    expect(calls).toEqual(['seek 5.3', 'stopAt off', 'loop 5.3-10.1', 'play 0'])
    actor.send({ type: 'ENGINE.LOOP_WRAP' })
    actor.send({ type: 'ENGINE.LOOP_WRAP' })
    expect(state()).toBe('playing')
    expect(actor.getSnapshot().context.pass).toBe(2)
  })

  it('rests between passes, then counts in again from the loop start', () => {
    vi.useFakeTimers()
    try {
      const { actor, calls, state } = start('bar', 1)
      actor.send({ type: 'SET_SPEED', pct: 50 })
      actor.send({ type: 'SET_LOOP', loop: LOOP })
      expect(calls.slice(-2)).toEqual(['loop off', 'stopAt 10.1'])
      actor.send({ type: 'PLAY' })
      actor.send({ type: 'ENGINE.STARTED' })
      actor.send({ type: 'ENGINE.STOP_REACHED' })
      expect(state()).toBe('loopRest')
      expect(actor.getSnapshot().context.pass).toBe(1)
      calls.length = 0
      // 2.4 s at 50 % lasts 4.8 s.
      vi.advanceTimersByTime(4700)
      expect(state()).toBe('loopRest')
      vi.advanceTimersByTime(200)
      expect(state()).toBe('countIn')
      expect(calls).toEqual(['seek 5.3', 'loop off', 'stopAt 10.1', 'play 1'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('waits for the assessment when the pass prompt is on', () => {
    const { actor, calls, state } = start('none', 0)
    actor.send({ type: 'SET_ASSESS', on: true })
    actor.send({ type: 'SET_LOOP', loop: LOOP })
    actor.send({ type: 'PLAY' })
    actor.send({ type: 'ENGINE.STOP_REACHED' })
    expect(state()).toBe('assess')
    calls.length = 0
    actor.send({ type: 'PASS_RATED', outcome: 'not_yet' })
    expect(state()).toBe('playing')
    expect(calls).toEqual(['seek 5.3', 'loop off', 'stopAt 10.1', 'play 0'])
  })

  it('pauses, resumes and stops through the engine only', () => {
    const { actor, calls, state } = start('none', 0)
    actor.send({ type: 'TOGGLE' })
    actor.send({ type: 'TOGGLE' })
    expect(state()).toBe('paused')
    actor.send({ type: 'ENGINE.INTERRUPTED' })
    expect(state()).toBe('paused')
    actor.send({ type: 'PLAY' })
    expect(state()).toBe('playing')
    actor.send({ type: 'ENGINE.INTERRUPTED' })
    expect(actor.getSnapshot().context.interrupted).toBe(true)
    actor.send({ type: 'PLAY' })
    expect(actor.getSnapshot().context.interrupted).toBe(false)
    actor.send({ type: 'ENGINE.ENDED' })
    expect(state()).toBe('ready')
    expect(calls.filter((c) => c === 'pause')).toHaveLength(1)
  })

  it('auditions a bar once and restores the loop', () => {
    const { actor, calls, state } = start('none', 1)
    actor.send({ type: 'SET_LOOP', loop: LOOP })
    calls.length = 0
    actor.send({ type: 'AUDITION', start: 7.7, end: 10.1 })
    expect(state()).toBe('audition')
    expect(calls).toEqual(['pause', 'loop off', 'stopAt 10.1', 'seek 7.7', 'play 0'])
    calls.length = 0
    actor.send({ type: 'ENGINE.STOP_REACHED' })
    expect(state()).toBe('paused')
    expect(calls).toEqual(['stopAt off', 'loop 5.3-10.1'])
  })

  it('sets speed and metronome on the engine', () => {
    const { actor, calls } = start()
    actor.send({ type: 'SET_SPEED', pct: 70 })
    actor.send({ type: 'SET_METRONOME', on: true })
    expect(calls).toEqual(['rate 0.7', 'metronome true'])
  })
})

// The speed ladder (12 §5, 21 V1 accept): the tempo changes exactly at the loop seam and the
// count-in plays at the upcoming tempo. The engine pauses sample-accurately where the heard
// position crosses stopAt (audio-engine transport.test, "pauses where the heard position crosses
// stopAt, once"), so a rate set between that stop at the loop end and the next play lands on the
// seam. These tests assert that order on the engine's command stream.
describe('player machine: speed ladder', () => {
  const ladder = (patch: Partial<Ladder['settings']> = {}, clean = 0): Ladder => ({
    settings: { ...defaultLadder(null, 3), count_in_each_pass: false, ...patch },
    clean,
    misses: 0,
  })

  function looping(on: Ladder, speedPct = 70) {
    const run = start('none', 0)
    run.actor.send({ type: 'SET_SPEED', pct: speedPct })
    run.actor.send({ type: 'SET_LOOP', loop: LOOP })
    run.actor.send({ type: 'SET_LADDER', ladder: on })
    run.actor.send({ type: 'PLAY' })
    run.actor.send({ type: 'ENGINE.STARTED' })
    run.calls.length = 0
    return { ...run, context: () => run.actor.getSnapshot().context }
  }

  it('keeps the loop seamless until a move is due, then lands it on the seam', () => {
    vi.useFakeTimers()
    try {
      const { actor, calls, state, context, setPosition } = looping(ladder({}, 2))
      actor.send({ type: 'ENGINE.LOOP_WRAP' })
      expect(calls).toEqual([])
      // The third clean pass is rated while the next pass plays: the speed stays, the seamless
      // wrap is replaced by a stop at the loop end.
      setPosition(7)
      actor.send({ type: 'PASS_RATED', outcome: 'clean' })
      expect(context()).toMatchObject({ speedPct: 70, pendingSpeed: 75 })
      expect(calls).toEqual(['loop off', 'stopAt 10.1'])
      calls.length = 0
      setPosition(10.1)
      actor.send({ type: 'ENGINE.STOP_REACHED' })
      expect(calls).toEqual([])
      vi.advanceTimersByTime(0)
      // Stopped at the loop end: rate first, then back to the start and play, seamless again.
      expect(calls).toEqual(['rate 0.75', 'seek 5.3', 'stopAt off', 'loop 5.3-10.1', 'play 0'])
      expect(state()).toBe('playing')
      expect(context()).toMatchObject({
        speedPct: 75,
        pendingSpeed: null,
        ladder: { clean: 0, misses: 0 },
        ladderMoves: { count: 1, direction: 'up' },
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('counts in at the upcoming tempo before each pass', () => {
    vi.useFakeTimers()
    try {
      const { actor, calls, state } = looping(ladder({ count_in_each_pass: true }, 2))
      actor.send({ type: 'PASS_RATED', outcome: 'clean' })
      actor.send({ type: 'ENGINE.STOP_REACHED' })
      vi.advanceTimersByTime(0)
      expect(state()).toBe('countIn')
      // The rate is set before the count-in is asked for.
      expect(calls.slice(-5)).toEqual([
        'rate 0.75',
        'seek 5.3',
        'loop off',
        'stopAt 10.1',
        'play 1',
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('starts the count-in again at the new tempo when the pass is rated during it', () => {
    vi.useFakeTimers()
    try {
      const { actor, calls, state, context } = looping(ladder({ count_in_each_pass: true }, 2))
      actor.send({ type: 'ENGINE.STOP_REACHED' })
      vi.advanceTimersByTime(0)
      expect(state()).toBe('countIn')
      calls.length = 0
      actor.send({ type: 'PASS_RATED', outcome: 'clean' })
      expect(calls).toEqual(['pause', 'rate 0.75', 'seek 5.3', 'loop off', 'stopAt 10.1', 'play 1'])
      expect(state()).toBe('countIn')
      expect(context().speedPct).toBe(75)
    } finally {
      vi.useRealTimers()
    }
  })

  it('changes speed while paused for the pass prompt', () => {
    const { actor, calls, state, context } = looping(ladder({}, 2))
    actor.send({ type: 'SET_ASSESS', on: true })
    actor.send({ type: 'ENGINE.STOP_REACHED' })
    expect(state()).toBe('assess')
    calls.length = 0
    actor.send({ type: 'PASS_RATED', outcome: 'clean' })
    expect(calls).toEqual(['rate 0.75', 'seek 5.3', 'loop off', 'stopAt 10.1', 'play 0'])
    expect(state()).toBe('playing')
    expect(context().ladder).toMatchObject({ clean: 0 })
  })

  it('goes back a rung after the misses in a row, at the seam', () => {
    vi.useFakeTimers()
    try {
      const { actor, calls, context } = looping(ladder(), 80)
      actor.send({ type: 'PASS_RATED', outcome: 'not_yet' })
      expect(context().pendingSpeed).toBeNull()
      actor.send({ type: 'PASS_RATED', outcome: 'not_yet' })
      expect(context().pendingSpeed).toBe(75)
      actor.send({ type: 'ENGINE.STOP_REACHED' })
      vi.advanceTimersByTime(0)
      expect(calls).toContain('rate 0.75')
      expect(context().ladderMoves).toEqual({ count: 1, direction: 'down' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps looping at the goal, or stops at the seam when asked to', () => {
    const kept = looping(ladder({}, 2), 100)
    kept.actor.send({ type: 'PASS_RATED', outcome: 'clean' })
    expect(kept.calls).toEqual(['stopAt off', 'loop 5.3-10.1'])
    expect(kept.context()).toMatchObject({ pendingSpeed: null, finishing: false })

    const stopped = looping(ladder({ on_goal: 'stop' }, 2), 100)
    stopped.actor.send({ type: 'PASS_RATED', outcome: 'clean' })
    expect(stopped.calls).toEqual(['loop off', 'stopAt 10.1'])
    stopped.calls.length = 0
    stopped.actor.send({ type: 'ENGINE.STOP_REACHED' })
    expect(stopped.state()).toBe('paused')
    expect(stopped.calls).toEqual(['seek 5.3', 'stopAt off', 'loop 5.3-10.1'])
    expect(stopped.context()).toMatchObject({ finishing: false, ladderFinishes: 1 })
  })

  it('starts the counts over when the learner sets the speed, and drops a pending move', () => {
    const { actor, calls, context } = looping(ladder({}, 2))
    actor.send({ type: 'PASS_RATED', outcome: 'clean' })
    calls.length = 0
    actor.send({ type: 'SET_SPEED', pct: 90 })
    expect(calls).toEqual(['rate 0.9', 'stopAt off', 'loop 5.3-10.1'])
    expect(context()).toMatchObject({
      speedPct: 90,
      pendingSpeed: null,
      ladder: { clean: 0, misses: 0 },
    })
  })

  it('sets the new speed at once when the pass is rated while stopped', () => {
    const { actor, calls, context } = looping(ladder({ on_goal: 'stop' }, 2), 95)
    actor.send({ type: 'PAUSE' })
    calls.length = 0
    actor.send({ type: 'PASS_RATED', outcome: 'clean' })
    expect(calls).toEqual(['rate 1', 'stopAt off', 'loop 5.3-10.1'])
    expect(context()).toMatchObject({ speedPct: 100, pendingSpeed: null })
    // At the goal with nothing playing there is no loop to end.
    for (const _ of [1, 2, 3]) actor.send({ type: 'PASS_RATED', outcome: 'clean' })
    expect(context()).toMatchObject({ finishing: false, ladderFinishes: 0 })
  })

  it('counts nothing without a ladder', () => {
    const { actor } = start('none', 0)
    actor.send({ type: 'SET_LOOP', loop: LOOP })
    actor.send({ type: 'PASS_RATED', outcome: 'clean' })
    expect(actor.getSnapshot().context).toMatchObject({ ladder: null, pendingSpeed: null })
  })
})
