import { assign, enqueueActions, setup } from 'xstate'
import { type Ladder, ratePass } from './ladder'
import type { LoopRange } from './loops'

// The player state machine (12 §6, XState v5). It only sends commands through the engine
// interface; scheduling audio lives in the engine, so the practice logic is testable without
// audio. Loops wrap seamlessly in the engine unless a rest or the pass prompt sits between
// passes: then the engine stops at the loop end (setStopAt), the machine rests or waits for the
// assessment, and starts the next pass (with the count-in).
//
// The speed ladder (12 §5, 21 V1) lives here too: its counts in the context, its rules in
// ladder.ts. A rated pass may ask for another speed; the tempo only ever changes at the loop seam.
// The machine keeps the new speed pending, makes the engine stop at the loop end (even where the
// loop would wrap seamlessly), and sets the rate while the engine is stopped there, before the
// next pass and its count-in start. So the count-in always plays at the upcoming tempo.

export interface PlayerEngine {
  play(countInBars: number): void
  pause(): void
  seek(seconds: number): void
  setRate(rate: number): void
  setLoop(loop: { start: number; end: number } | null): void
  setStopAt(seconds: number | null): void
  setMetronome(on: boolean): void
  /** Heard position now (seconds). */
  position(): number
}

export type RestBetween = 'none' | 'beat' | 'bar'

export interface PlayerContext {
  engine: PlayerEngine
  speedPct: number
  countIn: boolean
  countInBars: number
  metronome: boolean
  rest: RestBetween
  /** Seconds a rest lasts at speed 100 % (one beat or bar of the loop). */
  restSeconds: number
  assessPrompt: boolean
  loop: LoopRange | null
  loopOn: boolean
  /** Count-in and metronome need the beat grid (27 §3.7.3). */
  hasBeats: boolean
  /** Passes through the current loop. */
  pass: number
  interrupted: boolean
  /** The loop's speed ladder: its settings and the counts at the current speed; null is off. */
  ladder: Ladder | null
  /** The speed the ladder moves to at the next loop seam. */
  pendingSpeed: number | null
  /** The goal's last clean pass was played and the ladder stops there: end at the seam. */
  finishing: boolean
  /** Ladder moves so far and the last one's direction (the provider's HUD and analytics). */
  ladderMoves: { count: number; direction: 'up' | 'down' }
  /** Times the ladder ended the loop at its goal. */
  ladderFinishes: number
}

export type PlayerEvent =
  | { type: 'LOADED' }
  | { type: 'UNLOADED' }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TOGGLE' }
  | { type: 'STOP' }
  | { type: 'SEEK'; seconds: number }
  | { type: 'RESTART' }
  | { type: 'SET_SPEED'; pct: number }
  | { type: 'SET_LOOP'; loop: LoopRange | null }
  | { type: 'SET_LOOP_ON'; on: boolean }
  | { type: 'SET_COUNT_IN'; on: boolean; bars?: number }
  | { type: 'SET_METRONOME'; on: boolean }
  | { type: 'SET_REST'; rest: RestBetween; restSeconds: number }
  | { type: 'SET_ASSESS'; on: boolean }
  | { type: 'SET_BEATS'; hasBeats: boolean }
  | { type: 'SET_LADDER'; ladder: Ladder | null }
  /** Felt clean / Not yet for the last pass: the ladder counts it, a waiting loop goes on. */
  | { type: 'PASS_RATED'; outcome: 'clean' | 'not_yet' }
  /** "Hear this bar": play a range once from paused, then come back (editor sheet, 27 §3.7.4). */
  | { type: 'AUDITION'; start: number; end: number }
  | { type: 'ENGINE.STARTED' }
  | { type: 'ENGINE.LOOP_WRAP' }
  | { type: 'ENGINE.STOP_REACHED' }
  | { type: 'ENGINE.ENDED' }
  | { type: 'ENGINE.INTERRUPTED' }

export interface PlayerInput {
  engine: PlayerEngine
  speedPct: number
  countInBars: number
  rest: RestBetween
  restSeconds?: number
}

const looping = (c: PlayerContext) => c.loop !== null && c.loopOn
const laddered = (c: PlayerContext) => (looping(c) ? c.ladder : null)
const countsEachPass = (c: PlayerContext) =>
  c.hasBeats && laddered(c)?.settings.count_in_each_pass === true
const gapped = (c: PlayerContext) =>
  looping(c) &&
  (c.rest !== 'none' ||
    c.assessPrompt ||
    countsEachPass(c) ||
    c.pendingSpeed !== null ||
    c.finishing)
/** Count-in bars when playback starts: the count-in switch, or the ladder's before each pass. */
const countInBars = (c: PlayerContext) =>
  c.hasBeats && (c.countIn || countsEachPass(c)) ? c.countInBars : 0
/** Count-in bars between two passes: with a ladder its own setting decides. */
const passCountInBars = (c: PlayerContext) =>
  laddered(c) ? (countsEachPass(c) ? c.countInBars : 0) : countInBars(c)

/** What rating the last pass does to the ladder (nothing without one). */
function rated(c: PlayerContext, event: PlayerEvent) {
  const ladder = laddered(c)
  if (!ladder || event.type !== 'PASS_RATED') return null
  return ratePass(ladder, c.pendingSpeed ?? c.speedPct, event.outcome)
}

// A count-in between passes holds the engine at the loop start: the seam.
const atSeam = (c: PlayerContext) =>
  c.loop !== null && Math.abs(c.engine.position() - c.loop.start) < 0.05

// Seamless engine loop, or a stop at the loop end when something happens between passes.
function applyLoop(c: PlayerContext) {
  if (c.loop && c.loopOn) {
    if (gapped(c)) {
      c.engine.setLoop(null)
      c.engine.setStopAt(c.loop.end)
    } else {
      c.engine.setStopAt(null)
      c.engine.setLoop({ start: c.loop.start, end: c.loop.end })
    }
  } else {
    c.engine.setStopAt(null)
    c.engine.setLoop(null)
  }
}

function enterLoopIfOutside(c: PlayerContext) {
  if (!c.loop || !c.loopOn) return
  const at = c.engine.position()
  if (at < c.loop.start || at >= c.loop.end - 0.01) c.engine.seek(c.loop.start)
}

export const playerMachine = setup({
  types: {
    context: {} as PlayerContext,
    events: {} as PlayerEvent,
    input: {} as PlayerInput,
  },
  guards: {
    countsIn: ({ context }) => countInBars(context) > 0,
    passCountsIn: ({ context }) => passCountInBars(context) > 0,
    assessing: ({ context }) => context.assessPrompt,
    finishing: ({ context }) => context.finishing,
    ratingFinishes: ({ context, event }) => rated(context, event)?.finished === true,
    ratingMovesAtSeam: ({ context, event }) =>
      (rated(context, event)?.speedPct ?? null) !== null && atSeam(context),
  },
  delays: {
    // No rest: straight on (a ladder's stop at the seam passes through here too).
    rest: ({ context }) =>
      context.rest === 'none' ? 0 : (context.restSeconds * 1000 * 100) / context.speedPct,
  },
  actions: {
    startPlayback: ({ context }) => {
      enterLoopIfOutside(context)
      applyLoop(context)
      context.engine.play(countInBars(context))
    },
    // The seam: the engine is stopped at the loop end (or paused in the count-in), so a pending
    // ladder speed is set here, before the next pass starts from the loop's beginning.
    commitSpeed: enqueueActions(({ context, enqueue }) => {
      const pct = context.pendingSpeed
      if (pct === null) return
      enqueue.assign({
        speedPct: pct,
        pendingSpeed: null,
        ladderMoves: {
          count: context.ladderMoves.count + 1,
          direction: pct > context.speedPct ? 'up' : 'down',
        },
      })
      enqueue(() => context.engine.setRate(pct / 100))
    }),
    startPass: ({ context }) => {
      if (context.loop) context.engine.seek(context.loop.start)
      applyLoop(context)
      context.engine.play(passCountInBars(context))
    },
    ratePass: assign(({ context, event }) => {
      const result = rated(context, event)
      if (!result) return {}
      return {
        ladder: result.ladder,
        pendingSpeed: result.speedPct ?? context.pendingSpeed,
        finishing: result.finished,
      }
    }),
    // The ladder is done: back to the loop's start, stopped.
    finish: enqueueActions(({ context, enqueue }) => {
      enqueue.assign({ finishing: false, ladderFinishes: context.ladderFinishes + 1 })
      enqueue(({ context: next }) => {
        if (next.loop) next.engine.seek(next.loop.start)
        applyLoop(next)
      })
    }),
    clearLadderMove: assign({ pendingSpeed: null, finishing: false }),
    pause: ({ context }) => context.engine.pause(),
    audition: ({ context, event }) => {
      if (event.type !== 'AUDITION') return
      context.engine.pause()
      context.engine.setLoop(null)
      context.engine.setStopAt(event.end)
      context.engine.seek(event.start)
      context.engine.play(0)
    },
    applyLoop: ({ context }) => applyLoop(context),
    countPass: assign({ pass: ({ context }) => context.pass + 1 }),
    clearInterrupted: assign({ interrupted: false }),
  },
}).createMachine({
  id: 'player',
  initial: 'loading',
  context: ({ input }) => ({
    engine: input.engine,
    speedPct: input.speedPct,
    countIn: input.countInBars > 0,
    countInBars: Math.max(1, input.countInBars),
    metronome: false,
    rest: input.rest,
    restSeconds: input.restSeconds ?? 0,
    assessPrompt: false,
    loop: null,
    loopOn: true,
    hasBeats: false,
    pass: 0,
    interrupted: false,
    ladder: null,
    pendingSpeed: null,
    finishing: false,
    ladderMoves: { count: 0, direction: 'up' },
    ladderFinishes: 0,
  }),
  on: {
    // A speed the learner sets is a new place on the ladder: its counts start over.
    SET_SPEED: {
      actions: enqueueActions(({ context, event, enqueue }) => {
        enqueue.assign({
          speedPct: event.pct,
          ...(context.ladder
            ? {
                ladder: { settings: context.ladder.settings, clean: 0, misses: 0 },
                pendingSpeed: null,
                finishing: false,
              }
            : {}),
        })
        enqueue(({ context: next }) => {
          next.engine.setRate(next.speedPct / 100)
          if (next.ladder) applyLoop(next)
        })
      }),
    },
    SET_LOOP: {
      actions: [
        assign({ loop: ({ event }) => event.loop, loopOn: true, pass: 0 }),
        'clearLadderMove',
        'applyLoop',
      ],
    },
    SET_LOOP_ON: {
      actions: [
        assign({ loopOn: ({ event }) => event.on, pass: 0 }),
        'clearLadderMove',
        'applyLoop',
      ],
    },
    SET_LADDER: {
      actions: [assign({ ladder: ({ event }) => event.ladder }), 'clearLadderMove', 'applyLoop'],
    },
    // Playing: the move waits for the seam (the engine stops there).
    PASS_RATED: { actions: ['ratePass', 'applyLoop'] },
    SET_COUNT_IN: {
      actions: assign({
        countIn: ({ event }) => event.on,
        countInBars: ({ context, event }) => event.bars ?? context.countInBars,
      }),
    },
    SET_METRONOME: {
      actions: [
        assign({ metronome: ({ event }) => event.on }),
        ({ context }) => context.engine.setMetronome(context.metronome && context.hasBeats),
      ],
    },
    SET_REST: {
      actions: [
        assign({
          rest: ({ event }) => event.rest,
          restSeconds: ({ event }) => event.restSeconds,
        }),
        'applyLoop',
      ],
    },
    SET_ASSESS: {
      actions: [assign({ assessPrompt: ({ event }) => event.on }), 'applyLoop'],
    },
    SET_BEATS: {
      actions: [
        assign({ hasBeats: ({ event }) => event.hasBeats }),
        ({ context }) => context.engine.setMetronome(context.metronome && context.hasBeats),
      ],
    },
    SEEK: { actions: ({ context, event }) => context.engine.seek(event.seconds) },
    UNLOADED: { target: '.loading', actions: 'pause' },
    AUDITION: { target: '.audition', actions: 'audition' },
  },
  states: {
    loading: {
      on: { LOADED: 'ready' },
    },
    ready: {
      on: {
        PLAY: [
          { guard: 'countsIn', target: 'countIn', actions: 'startPlayback' },
          { target: 'playing', actions: 'startPlayback' },
        ],
        TOGGLE: [
          { guard: 'countsIn', target: 'countIn', actions: 'startPlayback' },
          { target: 'playing', actions: 'startPlayback' },
        ],
        RESTART: {
          actions: ({ context }) =>
            context.engine.seek(context.loopOn && context.loop ? context.loop.start : 0),
        },
        // Nothing is sounding: the new speed is set at once, and there is no loop to end.
        PASS_RATED: {
          actions: ['ratePass', assign({ finishing: false }), 'commitSpeed', 'applyLoop'],
        },
      },
    },
    countIn: {
      on: {
        'ENGINE.STARTED': 'playing',
        // Rated while the next pass counts in: the count-in starts again at the new speed.
        PASS_RATED: [
          { guard: 'ratingFinishes', target: 'paused', actions: ['ratePass', 'pause', 'finish'] },
          {
            guard: 'ratingMovesAtSeam',
            actions: ['ratePass', 'pause', 'commitSpeed', 'startPass'],
          },
          { actions: ['ratePass', 'applyLoop'] },
        ],
        PAUSE: { target: 'paused', actions: 'pause' },
        TOGGLE: { target: 'paused', actions: 'pause' },
        STOP: { target: 'ready', actions: 'pause' },
        'ENGINE.INTERRUPTED': {
          target: 'paused',
          actions: assign({ interrupted: true }),
        },
      },
    },
    playing: {
      entry: 'clearInterrupted',
      on: {
        PAUSE: { target: 'paused', actions: 'pause' },
        TOGGLE: { target: 'paused', actions: 'pause' },
        STOP: { target: 'ready', actions: 'pause' },
        'ENGINE.LOOP_WRAP': { actions: 'countPass' },
        'ENGINE.STOP_REACHED': [
          { guard: 'finishing', target: 'paused', actions: ['countPass', 'finish'] },
          { guard: 'assessing', target: 'assess', actions: 'countPass' },
          { target: 'loopRest', actions: 'countPass' },
        ],
        'ENGINE.ENDED': 'ready',
        'ENGINE.INTERRUPTED': { target: 'paused', actions: assign({ interrupted: true }) },
        RESTART: [
          { guard: 'passCountsIn', target: 'countIn', actions: ['commitSpeed', 'startPass'] },
          { actions: ['commitSpeed', 'startPass'] },
        ],
      },
    },
    paused: {
      on: {
        PLAY: [
          { guard: 'countsIn', target: 'countIn', actions: 'startPlayback' },
          { target: 'playing', actions: 'startPlayback' },
        ],
        TOGGLE: [
          { guard: 'countsIn', target: 'countIn', actions: 'startPlayback' },
          { target: 'playing', actions: 'startPlayback' },
        ],
        STOP: 'ready',
        RESTART: {
          actions: ({ context }) =>
            context.engine.seek(context.loopOn && context.loop ? context.loop.start : 0),
        },
        // Nothing is sounding: the new speed is set at once, and there is no loop to end.
        PASS_RATED: {
          actions: ['ratePass', assign({ finishing: false }), 'commitSpeed', 'applyLoop'],
        },
      },
    },
    loopRest: {
      after: {
        rest: [
          { guard: 'passCountsIn', target: 'countIn', actions: ['commitSpeed', 'startPass'] },
          { target: 'playing', actions: ['commitSpeed', 'startPass'] },
        ],
      },
      on: {
        PASS_RATED: [
          { guard: 'ratingFinishes', target: 'paused', actions: ['ratePass', 'finish'] },
          { actions: 'ratePass' },
        ],
        PAUSE: 'paused',
        TOGGLE: 'paused',
        STOP: 'ready',
      },
    },
    audition: {
      exit: 'applyLoop',
      on: {
        'ENGINE.STOP_REACHED': 'paused',
        'ENGINE.ENDED': 'paused',
        PAUSE: { target: 'paused', actions: 'pause' },
        TOGGLE: { target: 'paused', actions: 'pause' },
        STOP: { target: 'ready', actions: 'pause' },
        'ENGINE.INTERRUPTED': { target: 'paused', actions: assign({ interrupted: true }) },
      },
    },
    assess: {
      on: {
        PASS_RATED: [
          { guard: 'ratingFinishes', target: 'paused', actions: ['ratePass', 'finish'] },
          {
            guard: 'passCountsIn',
            target: 'countIn',
            actions: ['ratePass', 'commitSpeed', 'startPass'],
          },
          { target: 'playing', actions: ['ratePass', 'commitSpeed', 'startPass'] },
        ],
        PLAY: [
          { guard: 'passCountsIn', target: 'countIn', actions: ['commitSpeed', 'startPass'] },
          { target: 'playing', actions: ['commitSpeed', 'startPass'] },
        ],
        TOGGLE: [
          { guard: 'passCountsIn', target: 'countIn', actions: ['commitSpeed', 'startPass'] },
          { target: 'playing', actions: ['commitSpeed', 'startPass'] },
        ],
        PAUSE: 'paused',
        STOP: 'ready',
      },
    },
  },
})

export type PlayerState =
  | 'loading'
  | 'ready'
  | 'countIn'
  | 'playing'
  | 'paused'
  | 'loopRest'
  | 'assess'
  | 'audition'
