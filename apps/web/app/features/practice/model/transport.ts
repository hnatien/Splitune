import type { PracticeGrid } from './grid'
import type { LoopRange } from './loops'
import type { MusicOutput } from './music'
import { cuePhrase, loopedPhrase, phraseAtTime, phraseEntry, phraseLoop } from './phrases'
import type { PlayerContext, PlayerEvent } from './player-machine'
import { spelledNote } from './view-model'

// The practice screen's moves through the song (12 §2, step 18c): restart, a bar or a sung phrase
// back and forward (a phrase loop moves with the phrase), loop a phrase, cue its first note. Plain
// functions over the player's snapshot and a few ports, so the rules are tested with a fake engine;
// the provider wires the ports to the machine, the audio and the HUD.

/** What the HUD says after a move; the provider words it. Bars and phrases are 1-based. */
export type Hud =
  | { kind: 'bar'; bar: number }
  | { kind: 'restart' }
  | { kind: 'phrase'; phrase: number }
  | { kind: 'no-phrases' }
  | { kind: 'loop'; range: LoopRange }
  | { kind: 'loop-off' }
  | { kind: 'note'; name: string }

export interface TransportPorts {
  send: (event: PlayerEvent) => void
  position: () => number
  cue: (pitch: number) => void
  hud: (hud: Hud) => void
  /** The provider's loop setter: the machine, the rest, the saved clip. */
  setLoop: (range: LoopRange | null, method?: 'tap') => void
}

export interface TransportState {
  grid: PracticeGrid | undefined
  player: Pick<PlayerContext, 'loop' | 'loopOn'>
  music: MusicOutput | undefined
}

export interface Transport {
  restart: () => void
  stepBar: (direction: 1 | -1) => void
  stepPhrase: (direction: 1 | -1) => void
  loopPhrase: (index: number) => void
  cueNote: () => void
}

// Back from closer than this to a bar's (or phrase's) start goes to the one before.
const NEAR_START_S = 0.5

export function createTransport(
  { grid, player, music }: TransportState,
  { send, position, cue, hud, setLoop }: TransportPorts,
): Transport {
  const phrases = music?.melody?.phrases ?? []

  const stepBar = (direction: 1 | -1) => {
    if (!grid) return
    const now = position()
    const { bar } = grid.positionAt(now)
    const nearStart = now - grid.barStart(bar) < NEAR_START_S
    const target = Math.min(
      grid.lastBar,
      direction === 1 ? bar + 1 : nearStart ? Math.max(grid.firstBar, bar - 1) : bar,
    )
    send({ type: 'SEEK', seconds: grid.barStart(target) })
    hud({ kind: 'bar', bar: target + 1 })
  }

  return {
    restart: () => {
      if (player.loop && player.loopOn) {
        send({ type: 'RESTART' })
        hud({ kind: 'restart' })
      } else if (grid) {
        stepBar(-1)
      } else {
        send({ type: 'SEEK', seconds: 0 })
      }
    },
    stepBar,
    stepPhrase: (direction) => {
      if (!grid || phrases.length === 0) {
        hud({ kind: 'no-phrases' })
        return
      }
      const now = position()
      const current = phraseAtTime(grid, phrases, now)
      const nearStart = current >= 0 && now - phraseEntry(grid, phrases, current) < NEAR_START_S
      const target = Math.max(
        0,
        Math.min(
          phrases.length - 1,
          direction === 1 ? current + 1 : nearStart ? current - 1 : current,
        ),
      )
      const phrase = phrases[target]
      if (!phrase) return
      if (loopedPhrase(phrases, player.loop) >= 0) setLoop(phraseLoop(grid, phrase))
      send({ type: 'SEEK', seconds: phraseEntry(grid, phrases, target) })
      hud({ kind: 'phrase', phrase: target + 1 })
    },
    loopPhrase: (index) => {
      const phrase = phrases[index]
      if (!grid || !phrase) return
      if (player.loopOn && loopedPhrase(phrases, player.loop) === index) {
        setLoop(null)
        hud({ kind: 'loop-off' })
        return
      }
      const range = phraseLoop(grid, phrase)
      setLoop(range, 'tap')
      send({ type: 'SEEK', seconds: phraseEntry(grid, phrases, index) })
      hud({ kind: 'loop', range })
    },
    cueNote: () => {
      const melody = music?.melody
      const phrase = melody?.phrases[cuePhrase(phrases, position(), player.loop)]
      const note = phrase && melody?.notes[phrase.first]
      if (!note || !music) {
        hud({ kind: 'no-phrases' })
        return
      }
      cue(note.pitch)
      hud({ kind: 'note', name: spelledNote(note.pitch, music.noteNames) })
    },
  }
}
