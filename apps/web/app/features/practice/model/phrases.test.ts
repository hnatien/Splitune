import beats from '@splitune/contracts/fixtures/beats.json'
import type { Beats } from '@splitune/music-core'
import { describe, expect, it } from 'vitest'
import { practiceGrid } from './grid'
import { cuePhrase, loopedPhrase, phraseAtTime, phraseEntry, phraseLoop } from './phrases'

// Fixture: 32 beats 0.6 s apart from 0.5 s, 4/4, bars 0–7 (bar n starts at 0.5 + 2.4n).
const grid = practiceGrid(beats as Beats)
const phrases = [
  // On beat 2 of bar 0 (1.1 s), into bar 1.
  { t0: 1.12, t1: 3.4, startBar: 0, endBar: 1 },
  // Straight after it, mid-bar 1: entered where the first one ends, not a beat earlier.
  { t0: 3.6, t1: 5.2, startBar: 1, endBar: 1 },
  // Bar 3, on the downbeat (7.7 s).
  { t0: 7.71, t1: 9.9, startBar: 3, endBar: 3 },
]

describe('phrases', () => {
  it('enters a phrase a beat before its first note, never inside the one before', () => {
    expect(phraseEntry(grid, phrases, 0)).toBeCloseTo(0.5)
    expect(phraseEntry(grid, phrases, 1)).toBeCloseTo(3.4)
    expect(phraseEntry(grid, phrases, 2)).toBeCloseTo(7.1)
  })

  it('knows the phrase entered by a time', () => {
    expect(phraseAtTime(grid, phrases, 0.2)).toBe(-1)
    expect(phraseAtTime(grid, phrases, 0.5)).toBe(0)
    expect(phraseAtTime(grid, phrases, 3.5)).toBe(1)
    expect(phraseAtTime(grid, phrases, 6)).toBe(1)
    expect(phraseAtTime(grid, phrases, 7.1)).toBe(2)
  })

  it('loops the bars a phrase touches, and recognises that loop', () => {
    const loop = phraseLoop(grid, phrases[0] as (typeof phrases)[number])
    expect(loop).toMatchObject({ startBar: 0, endBar: 1 })
    expect(loop.start).toBeCloseTo(0.5)
    expect(loop.end).toBeCloseTo(5.3)
    expect(loopedPhrase(phrases, loop)).toBe(0)
    expect(loopedPhrase(phrases, { startBar: 0, endBar: 3 })).toBe(-1)
  })

  it('cues the looped phrase, else the next one to start', () => {
    expect(cuePhrase(phrases, 0, null)).toBe(0)
    expect(cuePhrase(phrases, 2, null)).toBe(1)
    expect(cuePhrase(phrases, 2, { startBar: 3, endBar: 3 })).toBe(2)
    expect(cuePhrase(phrases, 20, null)).toBe(-1)
  })
})
