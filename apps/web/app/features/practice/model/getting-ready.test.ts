import { describe, expect, it } from 'vitest'
import {
  analysingStep,
  currentStage,
  etaMinutes,
  oneInBand,
  overallProgress,
  remaining,
  unlocks,
} from './getting-ready'

const timings = [
  { stage: 'decode', median_s: 10 },
  { stage: 'beats', median_s: 20 },
  { stage: 'tag', median_s: 10 },
  { stage: 'separate', median_s: 120 },
  { stage: 'stem_post', median_s: 15 },
  { stage: 'chords', median_s: 30 },
  { stage: 'notes.guitar', median_s: 60 },
  { stage: 'finalize', median_s: 10 },
]

const analysis = (statuses: Record<string, string>) => ({
  status: 'running',
  stages: Object.fromEntries(
    Object.entries(statuses).map(([stage, status]) => [stage, { status }]),
  ),
})

// Practice-Ready.dc.html: four stages done, separation running, three waiting.
const midway = analysis({
  finalize: 'pending',
  'notes.guitar': 'pending',
  chords: 'pending',
  stem_post: 'pending',
  separate: 'running',
  tag: 'done',
  beats: 'done',
  decode: 'done',
})

describe('Getting ready (27 §3.7.3)', () => {
  it('counts every unfinished stage at its typical time, so the ETA moves only when one finishes', () => {
    expect(remaining(midway, timings)).toBe(120 + 15 + 30 + 60 + 10)
    // Up to a stage: what unlocks the mixer.
    expect(remaining(midway, timings, 'stem_post')).toBe(135)
    // Finished stages need nothing more.
    expect(remaining(midway, timings, 'beats')).toBe(0)
  })

  it('hides the ETA while a remaining stage has no timing yet', () => {
    expect(
      remaining(
        midway,
        timings.filter((t) => t.stage !== 'chords'),
      ),
    ).toBeUndefined()
    // Stages before it can still be estimated.
    expect(
      remaining(
        midway,
        timings.filter((t) => t.stage !== 'chords'),
        'stem_post',
      ),
    ).toBe(135)
  })

  it('says one number for short waits and a padded range for longer ones', () => {
    expect(etaMinutes(undefined)).toBeUndefined()
    expect(etaMinutes(0)).toBeUndefined()
    expect(etaMinutes(40)).toBe('1')
    expect(etaMinutes(130)).toBe('3')
    expect(etaMinutes(235)).toBe('3–5')
  })

  it('weights progress by typical times and never shows 100 before the end', () => {
    // 40 s of 275 s done.
    expect(overallProgress(midway, timings)).toBe(14)
    const almost = analysis({
      ...Object.fromEntries(timings.map((t) => [t.stage, 'done'])),
      finalize: 'running',
    })
    expect(overallProgress(almost, timings)).toBe(96)
    const done = analysis(Object.fromEntries(timings.map((t) => [t.stage, 'done'])))
    expect(overallProgress(done, timings)).toBe(100)
    // A huge last stage still can't read 100 % until it finishes.
    expect(
      overallProgress(almost, [...timings, { stage: 'finalize', median_s: 0.001 }]),
    ).toBeLessThan(100)
  })

  it('names the stage being worked on as "n of total"', () => {
    expect(analysingStep(midway)).toEqual({ current: 4, total: 8 })
    expect(currentStage(midway)).toBe('separate')
  })

  it('lists what works now: Ready, then the next as Soon, the rest Later, with times', () => {
    expect(
      unlocks({
        analysis: midway,
        timings,
        layers: { audio: true, beats: true, stems: false, chords: false, notation: false },
      }),
    ).toEqual([
      { id: 'loop', state: 'ready' },
      { id: 'count-in', state: 'ready' },
      { id: 'mixer', state: 'soon', minutes: '3' },
      { id: 'chords', state: 'later', minutes: '2–4' },
      { id: 'notation', state: 'later', minutes: '3–5' },
    ])
  })

  it('leaves out what a Lite analysis never makes', () => {
    const lite = analysis({ decode: 'done', beats: 'running', chords: 'pending' })
    expect(
      unlocks({
        analysis: lite,
        timings,
        layers: { audio: true, beats: false, stems: false, chords: false, notation: false },
      }).map((u) => u.id),
    ).toEqual(['loop', 'count-in', 'chords'])
  })

  it('rounds frequencies to 1 in 2 / 3 / 4 / 5 / 10 / 20 (27 §5.3)', () => {
    expect(oneInBand(0)).toBeUndefined()
    expect(oneInBand(0.5)).toBe(2)
    expect(oneInBand(0.3)).toBe(3)
    expect(oneInBand(1 / 8)).toBe(10)
    expect(oneInBand(0.12)).toBe(10)
    expect(oneInBand(0.01)).toBe(20)
  })
})
