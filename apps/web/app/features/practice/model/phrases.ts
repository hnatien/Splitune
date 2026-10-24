import { beatTime, type MelodyPhrase, PPQ, timeToTick } from '@splitune/music-core'
import type { PracticeGrid } from './grid'
import { barRange, type LoopRange } from './loops'

// The sung phrases as the practice screen moves between them (step 18c): a phrase is entered a
// beat before the beat its first note is on (a singer breathes there), never earlier than the end
// of the phrase before; its loop covers the bars it touches, like every loop (12 §6); a cue plays
// the first note of the phrase about to be sung.

type Phrase = Pick<MelodyPhrase, 't0' | 't1' | 'startBar' | 'endBar'>

/** Where phrase `index` is entered. */
export function phraseEntry(grid: PracticeGrid, phrases: readonly Phrase[], index: number): number {
  const phrase = phrases[index]
  if (!phrase) return 0
  // The beat the first note is on: sung a little early or late, it rounds to it.
  const beat = Math.round(timeToTick(grid.grid, phrase.t0) / PPQ)
  const before = phrases[index - 1]?.t1 ?? Number.NEGATIVE_INFINITY
  return Math.max(0, before, Math.min(phrase.t0, beatTime(grid.grid, beat - 1)))
}

/** The phrase entered by `t` (being sung, or rested after), or -1 before the first. */
export function phraseAtTime(grid: PracticeGrid, phrases: readonly Phrase[], t: number): number {
  let index = -1
  for (let i = 0; i < phrases.length; i++) {
    if (phraseEntry(grid, phrases, i) <= t + 1e-3) index = i
    else break
  }
  return index
}

export function phraseLoop(grid: PracticeGrid, phrase: Phrase): LoopRange {
  return barRange(grid, phrase.startBar, phrase.endBar)
}

/** The phrase a loop is exactly the loop of, or -1. */
export function loopedPhrase(
  phrases: readonly Phrase[],
  loop: Pick<LoopRange, 'startBar' | 'endBar'> | null,
): number {
  if (!loop) return -1
  return phrases.findIndex((p) => p.startBar === loop.startBar && p.endBar === loop.endBar)
}

/** The phrase whose first note a cue plays: the looped one, else the next one still to start. */
export function cuePhrase(
  phrases: readonly Phrase[],
  t: number,
  loop: Pick<LoopRange, 'startBar' | 'endBar'> | null,
): number {
  const looped = loopedPhrase(phrases, loop)
  if (looped >= 0) return looped
  return phrases.findIndex((p) => p.t0 > t + 0.05)
}
