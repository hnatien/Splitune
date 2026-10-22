import { describe, expect, it, vi } from 'vitest'
import { createActor } from 'xstate'
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
    actor.send({ type: 'ASSESSED' })
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
