import { assign, setup } from 'xstate'
import type { LoopRange } from './loops'

// The player state machine (12 §6, XState v5). It only sends commands through the engine
// interface; scheduling audio lives in the engine, so the practice logic is testable without
// audio. Loops wrap seamlessly in the engine unless a rest or the pass prompt sits between
// passes: then the engine stops at the loop end (setStopAt), the machine rests or waits for the
// assessment, and starts the next pass (with the count-in).

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
  | { type: 'ASSESSED' }
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
const gapped = (c: PlayerContext) => looping(c) && (c.rest !== 'none' || c.assessPrompt)
const countInBars = (c: PlayerContext) => (c.countIn && c.hasBeats ? c.countInBars : 0)

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
    assessing: ({ context }) => context.assessPrompt,
    gapped: ({ context }) => gapped(context),
  },
  delays: {
    rest: ({ context }) => (context.restSeconds * 1000 * 100) / context.speedPct,
  },
  actions: {
    startPlayback: ({ context }) => {
      enterLoopIfOutside(context)
      applyLoop(context)
      context.engine.play(countInBars(context))
    },
    nextPass: ({ context }) => {
      if (context.loop) context.engine.seek(context.loop.start)
      applyLoop(context)
      context.engine.play(countInBars(context))
    },
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
  }),
  on: {
    SET_SPEED: {
      actions: [
        assign({ speedPct: ({ event }) => event.pct }),
        ({ context }) => context.engine.setRate(context.speedPct / 100),
      ],
    },
    SET_LOOP: {
      actions: [assign({ loop: ({ event }) => event.loop, loopOn: true, pass: 0 }), 'applyLoop'],
    },
    SET_LOOP_ON: {
      actions: [assign({ loopOn: ({ event }) => event.on, pass: 0 }), 'applyLoop'],
    },
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
      },
    },
    countIn: {
      on: {
        'ENGINE.STARTED': 'playing',
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
          { guard: 'assessing', target: 'assess', actions: 'countPass' },
          { target: 'loopRest', actions: 'countPass' },
        ],
        'ENGINE.ENDED': 'ready',
        'ENGINE.INTERRUPTED': { target: 'paused', actions: assign({ interrupted: true }) },
        RESTART: [
          { guard: 'countsIn', target: 'countIn', actions: 'nextPass' },
          { actions: 'nextPass' },
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
      },
    },
    loopRest: {
      after: {
        rest: [
          { guard: 'countsIn', target: 'countIn', actions: 'nextPass' },
          { target: 'playing', actions: 'nextPass' },
        ],
      },
      on: {
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
        ASSESSED: [
          { guard: 'countsIn', target: 'countIn', actions: 'nextPass' },
          { target: 'playing', actions: 'nextPass' },
        ],
        PLAY: [
          { guard: 'countsIn', target: 'countIn', actions: 'nextPass' },
          { target: 'playing', actions: 'nextPass' },
        ],
        TOGGLE: [
          { guard: 'countsIn', target: 'countIn', actions: 'nextPass' },
          { target: 'playing', actions: 'nextPass' },
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
