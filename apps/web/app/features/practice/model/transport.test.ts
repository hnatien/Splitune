import beats from '@splitune/contracts/fixtures/beats.json'
import type { Beats, MelodyNote, MelodyPhrase } from '@splitune/music-core'
import { describe, expect, it } from 'vitest'
import { practiceGrid } from './grid'
import type { LoopRange } from './loops'
import type { MusicOutput } from './music'
import { phraseLoop } from './phrases'
import type { PlayerEvent } from './player-machine'
import { createTransport, type Hud, type TransportState } from './transport'

// Fixture: 32 beats 0.6 s apart from 0.5 s, 4/4, bars 0–7 (bar n starts at 0.5 + 2.4n).
const grid = practiceGrid(beats as Beats)
const start = (bar: number) => grid.barStart(bar)

const note = (pitch: number, t0: number): MelodyNote => ({
  id: `n${t0}`,
  pitch,
  t0,
  t1: t0 + 0.5,
  confidence: 0.9,
  band: 'high',
})
const phrase = (index: number, t0: number, t1: number, bar: number): MelodyPhrase => ({
  from: index,
  to: index,
  first: index,
  t0,
  t1,
  startBar: bar,
  endBar: bar,
  letter: 'A',
  repeat: false,
})
// Three one-bar phrases on the downbeats of bars 1, 3 and 5.
const melody = {
  notes: [note(64, start(1)), note(67, start(3)), note(60, start(5))],
  phrases: [
    phrase(0, start(1), start(1) + 2, 1),
    phrase(1, start(3), start(3) + 2, 3),
    phrase(2, start(5), start(5) + 2, 5),
  ],
  range: null,
  scale: [],
}
const music: MusicOutput = {
  beats: beats as Beats,
  chords: undefined,
  displayChords: [],
  melody,
  bands: { high: 0.7, medium: 0.4 },
  noteNames: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'],
}

function setup(at: number, state: Partial<TransportState> = {}) {
  const sent: PlayerEvent[] = []
  const huds: Hud[] = []
  const loops: (LoopRange | null)[] = []
  const cued: number[] = []
  const transport = createTransport(
    { grid, player: { loop: null, loopOn: false }, music: undefined, ...state },
    {
      send: (event) => sent.push(event),
      position: () => at,
      cue: (pitch) => cued.push(pitch),
      hud: (hud) => huds.push(hud),
      setLoop: (range) => loops.push(range),
    },
  )
  return { transport, sent, huds, loops, cued }
}

describe('bar steps', () => {
  it('goes to the next bar', () => {
    const { transport, sent, huds } = setup(start(2) + 1)
    transport.stepBar(1)
    expect(sent).toEqual([{ type: 'SEEK', seconds: start(3) }])
    expect(huds).toEqual([{ kind: 'bar', bar: 4 }])
  })

  it("goes back to this bar's start, or the bar before when already near it", () => {
    const mid = setup(start(2) + 1)
    mid.transport.stepBar(-1)
    expect(mid.sent).toEqual([{ type: 'SEEK', seconds: start(2) }])
    const near = setup(start(2) + 0.2)
    near.transport.stepBar(-1)
    expect(near.sent).toEqual([{ type: 'SEEK', seconds: start(1) }])
  })

  it('stays inside the song', () => {
    const last = setup(start(grid.lastBar) + 1)
    last.transport.stepBar(1)
    expect(last.huds).toEqual([{ kind: 'bar', bar: grid.lastBar + 1 }])
    const first = setup(start(grid.firstBar))
    first.transport.stepBar(-1)
    expect(first.sent).toEqual([{ type: 'SEEK', seconds: start(grid.firstBar) }])
  })

  it('does nothing without a beat grid', () => {
    const { transport, sent, huds } = setup(3, { grid: undefined })
    transport.stepBar(1)
    expect([sent, huds]).toEqual([[], []])
  })
})

describe('restart', () => {
  const loop = { startBar: 2, endBar: 3, start: start(2), end: start(4) }

  it('restarts an active loop', () => {
    const { transport, sent, huds } = setup(start(3), { player: { loop, loopOn: true } })
    transport.restart()
    expect(sent).toEqual([{ type: 'RESTART' }])
    expect(huds).toEqual([{ kind: 'restart' }])
  })

  it('steps back a bar when the loop is off, and seeks to 0 without bars', () => {
    const off = setup(start(3) + 1, { player: { loop, loopOn: false } })
    off.transport.restart()
    expect(off.sent).toEqual([{ type: 'SEEK', seconds: start(3) }])
    const bare = setup(5, { grid: undefined })
    bare.transport.restart()
    expect(bare.sent).toEqual([{ type: 'SEEK', seconds: 0 }])
  })
})

describe('phrases', () => {
  it('says so when there are no phrases', () => {
    const { transport, huds } = setup(1)
    transport.stepPhrase(1)
    transport.cueNote()
    expect(huds).toEqual([{ kind: 'no-phrases' }, { kind: 'no-phrases' }])
  })

  it('steps to the next phrase and back past one just entered', () => {
    const forward = setup(start(1) + 1, { music })
    forward.transport.stepPhrase(1)
    expect(forward.huds).toEqual([{ kind: 'phrase', phrase: 2 }])
    // A phrase is entered a beat (0.6 s) before its first note.
    const entered = setup(start(3) - 0.4, { music })
    entered.transport.stepPhrase(-1)
    expect(entered.huds).toEqual([{ kind: 'phrase', phrase: 1 }])
    const inside = setup(start(3) + 0.5, { music })
    inside.transport.stepPhrase(-1)
    expect(inside.huds).toEqual([{ kind: 'phrase', phrase: 2 }])
  })

  it('clamps at the first and last phrase', () => {
    const before = setup(0.2, { music })
    before.transport.stepPhrase(-1)
    expect(before.huds).toEqual([{ kind: 'phrase', phrase: 1 }])
    const after = setup(start(6), { music })
    after.transport.stepPhrase(1)
    expect(after.huds).toEqual([{ kind: 'phrase', phrase: 3 }])
  })

  it('moves a phrase loop with the phrase', () => {
    const looped = phraseLoop(grid, melody.phrases[0] as MelodyPhrase)
    const { transport, loops } = setup(start(1) + 1, {
      music,
      player: { loop: looped, loopOn: true },
    })
    transport.stepPhrase(1)
    expect(loops).toEqual([phraseLoop(grid, melody.phrases[1] as MelodyPhrase)])
  })

  it('loops a phrase, and stops looping it on a second press', () => {
    const range = phraseLoop(grid, melody.phrases[1] as MelodyPhrase)
    const on = setup(0, { music })
    on.transport.loopPhrase(1)
    expect(on.loops).toEqual([range])
    expect(on.huds).toEqual([{ kind: 'loop', range }])
    const off = setup(0, { music, player: { loop: range, loopOn: true } })
    off.transport.loopPhrase(1)
    expect(off.loops).toEqual([null])
    expect(off.huds).toEqual([{ kind: 'loop-off' }])
  })

  it('cues the first note of the phrase about to be sung, named in the key', () => {
    const { transport, cued, huds } = setup(start(2), { music })
    transport.cueNote()
    expect(cued).toEqual([67])
    expect(huds).toEqual([{ kind: 'note', name: 'G4' }])
  })
})
